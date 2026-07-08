"""
analytics_service.py
Implements the Industry Readiness Index (IRI) scoring algorithm for CIRA.

Pipeline per student:
  1. Fetch raw question results from MongoDB (topic, difficulty, correct?)
  2. Compute a difficulty-adjusted score for each topic  (0.0 – 1.0)
  3. Apply topic importance weights                       (configurable)
  4. Produce a raw weighted IRI                          (0 – 100)

Pipeline for a cohort (department):
  5. Collect raw IRIs for every student in the dept
  6. Normalize with sklearn MinMaxScaler → scores become relative (0 – 100)
     so the best student in the cohort = 100 and the weakest = 0.
     This prevents inflation when the exam itself is too easy.
"""

from __future__ import annotations

import numpy as np
from collections import defaultdict
from typing import Dict, List, Tuple

from dataclasses import dataclass
from motor.motor_asyncio import AsyncIOMotorDatabase
from sklearn.preprocessing import MinMaxScaler

class QuestionResult:
    def __init__(self, **data):
        self.topic = data.get("topic", "")
        self.difficulty = data.get("difficulty", "easy")
        self.is_correct = bool(data.get("is_correct", False))

@dataclass
class TopicBreakdown:
    raw_score: float
    is_weak: bool
    questions_attempted: int

@dataclass
class IRIResponse:
    student_id: str
    exam_id: str
    iri_score: float
    readiness_band: str
    topic_breakdown: Dict[str, TopicBreakdown]
    weak_topics: List[str]

@dataclass
class DepartmentIRIResponse:
    department_id: str
    student_count: int
    average_iri: float
    std_deviation: float
    min_iri: float
    max_iri: float
    percentile_25: float
    percentile_75: float
    top_weak_topics: List[str]

#  Tunable constants 

# How much extra credit each difficulty level is worth.
# A hard question answered correctly contributes twice as much as an easy one.
DIFFICULTY_WEIGHTS: Dict[str, float] = {
    "easy": 1.0,
    "medium": 1.5,
    "hard": 2.0,
}

# Industry importance multiplier per topic.
# Topics more relevant to job-readiness get a higher weight.
# Any topic not listed here falls back to DEFAULT_TOPIC_WEIGHT.
# Your team should agree on these values; they drive IRI significantly.
TOPIC_IMPORTANCE: Dict[str, float] = {
    "data structures": 1.5,
    "algorithms": 1.5,
    "databases": 1.4,
    "operating systems": 1.3,
    "networking": 1.2,
    "object oriented programming": 1.2,
    "software engineering": 1.1,
    "mathematics": 1.0,
}
DEFAULT_TOPIC_WEIGHT = 1.0

# A student's topic score must be at or above this to be considered "strong".
# Below this → flagged as a weak topic for adaptive assignment generation.
WEAK_TOPIC_THRESHOLD = 0.50   # 50 %

# IRI band cutoffs (applied to the final 0–100 score).
READINESS_BANDS: List[Tuple[float, str]] = [
    (80, "Highly Ready"),
    (60, "Industry Ready"),
    (40, "Developing"),
    (0,  "Needs Improvement"),
]


# ─── Service class ────────────────────────────────────────────────────────────

class AnalyticsService:
    """
    All IRI computation lives here.

    Instantiate once in your FastAPI lifespan / dependency and reuse
    the same sklearn scaler so it can be re-fit on larger cohorts later.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self._scaler = MinMaxScaler(feature_range=(0, 100))

    # ── Public: single student ────────────────────────────────────────────────

    async def calculate_student_iri(
        self, student_id: str, exam_id: str
    ) -> IRIResponse:
        """
        Full IRI calculation for one student.

        Steps
        -----
        1. Pull the student's question-level results from MongoDB.
        2. Compute per-topic difficulty-adjusted scores.
        3. Weight by topic importance and average → raw IRI (0–100).
        4. Identify weak topics.
        5. Return structured response.
        """
        raw_results = await self._fetch_results(student_id, exam_id)

        if not raw_results:
            return self._empty_response(student_id, exam_id)

        topic_breakdown = self._compute_topic_breakdown(raw_results)
        raw_iri = self._compute_raw_iri(topic_breakdown)
        weak_topics = [
            topic
            for topic, data in topic_breakdown.items()
            if data.is_weak
        ]

        return IRIResponse(
            student_id=student_id,
            exam_id=exam_id,
            iri_score=round(raw_iri, 2),
            readiness_band=self._readiness_band(raw_iri),
            topic_breakdown=topic_breakdown,
            weak_topics=weak_topics,
        )

    # ── Public: department cohort ─────────────────────────────────────────────

    async def calculate_department_iri(
        self, department_id: str
    ) -> DepartmentIRIResponse:
        """
        Aggregate IRI stats for all students in a department.

        The raw IRI values are normalized via MinMaxScaler so that
        individual scores are meaningful *relative to the cohort*.
        This prevents everyone scoring 95+ on an easy exam.

        Also surfaces the most common weak topics across the department
        so faculty can see where the whole cohort is struggling.
        """
        # Fetch every student's results grouped by student_id
        pipeline = [
            {"$match": {"department_id": department_id}},
            {"$group": {"_id": "$student_id", "results": {"$push": "$$ROOT"}}},
        ]
        student_groups = await self.db["results"].aggregate(pipeline).to_list(
            length=None
        )

        if not student_groups:
            return self._empty_department_response(department_id)

        raw_iris: List[float] = []
        all_weak_topics: List[str] = []

        for group in student_groups:
            results = [QuestionResult(**r) for r in group["results"]]
            breakdown = self._compute_topic_breakdown(results)
            raw_iris.append(self._compute_raw_iri(breakdown))
            all_weak_topics.extend(
                topic for topic, data in breakdown.items() if data.is_weak
            )

        normalized_iris = self._normalize_cohort(raw_iris)
        top_weak = self._top_weak_topics(all_weak_topics, top_n=5)
        arr = np.array(normalized_iris)

        return DepartmentIRIResponse(
            department_id=department_id,
            student_count=len(normalized_iris),
            average_iri=round(float(arr.mean()), 2),
            std_deviation=round(float(arr.std()), 2),
            min_iri=round(float(arr.min()), 2),
            max_iri=round(float(arr.max()), 2),
            percentile_25=round(float(np.percentile(arr, 25)), 2),
            percentile_75=round(float(np.percentile(arr, 75)), 2),
            top_weak_topics=top_weak,
        )

    # ── Private: core algorithm ───────────────────────────────────────────────

    def _compute_topic_breakdown(
        self, results: List[QuestionResult]
    ) -> Dict[str, TopicBreakdown]:
        """
        Step 1 + 2: For each topic, compute a difficulty-adjusted score.

        difficulty_adjusted_score =
            Σ(difficulty_weight × is_correct) / Σ(difficulty_weight)

        This means answering hard questions correctly contributes more
        to the topic score than answering easy questions correctly.
        """
        # Accumulate per topic: total earned weight and total max weight
        earned: Dict[str, float] = defaultdict(float)
        maximum: Dict[str, float] = defaultdict(float)
        attempts: Dict[str, int] = defaultdict(int)

        for r in results:
            topic = r.topic.lower().strip()
            w = DIFFICULTY_WEIGHTS.get(r.difficulty, 1.0)
            maximum[topic] += w
            attempts[topic] += 1
            if r.is_correct:
                earned[topic] += w

        breakdown: Dict[str, TopicBreakdown] = {}
        for topic in maximum:
            raw_score = earned[topic] / maximum[topic] if maximum[topic] else 0.0
            breakdown[topic] = TopicBreakdown(
                raw_score=round(raw_score, 4),
                is_weak=raw_score < WEAK_TOPIC_THRESHOLD,
                questions_attempted=attempts[topic],
            )

        return breakdown

    def _compute_raw_iri(
        self, topic_breakdown: Dict[str, TopicBreakdown]
    ) -> float:
        """
        Step 3: Weighted average of topic scores → raw IRI (0–100).

        IRI = Σ(topic_importance_weight × topic_score) / Σ(topic_importance_weight)

        A topic not listed in TOPIC_IMPORTANCE uses DEFAULT_TOPIC_WEIGHT (1.0),
        so it still contributes but doesn't skew the score unfairly.
        """
        weighted_sum = 0.0
        total_weight = 0.0

        for topic, data in topic_breakdown.items():
            w = TOPIC_IMPORTANCE.get(topic, DEFAULT_TOPIC_WEIGHT)
            weighted_sum += w * data.raw_score
            total_weight += w

        if total_weight == 0:
            return 0.0

        return (weighted_sum / total_weight) * 100

    def _normalize_cohort(
        self, raw_iris: List[float]
    ) -> List[float]:
        """
        Step 4 (cohort only): Use sklearn MinMaxScaler to re-scale raw IRI
        scores so they span 0–100 relative to the cohort.

        Why this matters:
        - If the exam was very easy, everyone might have a raw IRI of 85–95.
          After normalization the spread becomes 0–100, revealing real gaps.
        - Faculty see who is *relatively* weakest in the department, not just
          who scored below an absolute threshold on a potentially easy exam.

        Edge case: if all students scored identically, scaler would produce
        all-zero output (0 / 0 mathematically). We guard against that and
        return the raw values unchanged.
        """
        if len(raw_iris) < 2:
            return raw_iris  # nothing to normalize against

        arr = np.array(raw_iris, dtype=float).reshape(-1, 1)

        if arr.max() == arr.min():
            # All students scored the same — return raw values
            return raw_iris

        # Local instantiation makes this completely thread-safe
        scaler = MinMaxScaler(feature_range=(0, 100))
        normalized = scaler.fit_transform(arr)
        return [round(float(v[0]), 2) for v in normalized]

    #  Private: helpers

    @staticmethod
    def _readiness_band(iri: float) -> str:
        for threshold, label in READINESS_BANDS:
            if iri >= threshold:
                return label
        return "Needs Improvement"

    @staticmethod
    def _top_weak_topics(weak_topics: List[str], top_n: int = 5) -> List[str]:
        """Return the N most frequently occurring weak topics across the cohort."""
        from collections import Counter
        return [topic for topic, _ in Counter(weak_topics).most_common(top_n)]

    async def _fetch_results(
        self, student_id: str, exam_id: str
    ) -> List[QuestionResult]:
        docs = await self.db["results"].find(
            {"student_id": student_id, "exam_id": exam_id}
        ).to_list(length=None)
        return [QuestionResult(**d) for d in docs]

    @staticmethod
    def _empty_response(student_id: str, exam_id: str) -> IRIResponse:
        return IRIResponse(
            student_id=student_id,
            exam_id=exam_id,
            iri_score=0.0,
            readiness_band="Needs Improvement",
            topic_breakdown={},
            weak_topics=[],
        )

    @staticmethod
    def _empty_department_response(department_id: str) -> DepartmentIRIResponse:
        return DepartmentIRIResponse(
            department_id=department_id,
            student_count=0,
            average_iri=0.0,
            std_deviation=0.0,
            min_iri=0.0,
            max_iri=0.0,
            percentile_25=0.0,
            percentile_75=0.0,
            top_weak_topics=[],
        )
