"""
services/department_service.py
───────────────────────────────
Computes department-level IRI aggregates from individual student scores.

Architecture
────────────
Work is split between MongoDB and Python deliberately:

  MongoDB (Motor aggregation pipeline)
  ├── Groups every question result by (student_id, topic)
  ├── Computes difficulty-weighted sums per group  ← do this in the DB
  └── Returns one document per student             ← less data over the wire

  Python (this service)
  ├── Applies topic-importance weights             ← config-driven, easier in Python
  ├── Computes raw IRI per student
  ├── Normalises cohort with MinMaxScaler          ← sklearn
  └── Produces numpy aggregate statistics

Why do the difficulty weighting inside the MongoDB pipeline?
  Each result document carries topic + difficulty + is_correct.
  Aggregating the weights in MongoDB means we ship one document per student
  instead of one document per answered question. For a dept of 200 students
  each sitting a 50-question exam that's 200 docs vs 10 000 docs over the wire.
"""

from __future__ import annotations

from collections import Counter
from typing import List, Tuple

import numpy as np
from sklearn.preprocessing import MinMaxScaler
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..schemas.department import (
    DepartmentReadinessRequest,
    DepartmentReadinessResponse,
    ReadinessBandCount,
    StudentIRISummary,
)
from .analytics_service import (
    TOPIC_IMPORTANCE,
    DEFAULT_TOPIC_WEIGHT,
    READINESS_BANDS,
    WEAK_TOPIC_THRESHOLD,
)

# Topics above this score are considered "strong" for the top_strong_topics list
STRONG_TOPIC_THRESHOLD = 0.80


class DepartmentService:
    """
    Handles all department-level readiness aggregation.
    Injected via FastAPI dependency — one instance per request.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self._scaler = MinMaxScaler(feature_range=(0, 100))

    # ── Public ────────────────────────────────────────────────────────────────

    async def get_readiness(
        self, department_id: str
    ) -> DepartmentReadinessResponse:
        """
        Full pipeline:
        1. Motor aggregation pipeline → per-student topic data
        2. IRI computation per student
        3. Cohort normalisation with MinMaxScaler
        4. numpy aggregate statistics
        5. Band distribution + top topic signals
        """
        # ── Step 1: fetch from MongoDB ────────────────────────────────────────
        student_docs = await self._fetch_student_topic_data(department_id)

        if not student_docs:
            return self._empty_response(department_id)

        # ── Step 2: compute raw IRI per student ───────────────────────────────
        student_records: List[dict] = []
        all_weak_topics: List[str] = []
        all_strong_topics: List[str] = []

        for doc in student_docs:
            topic_scores = self._topic_scores_from_pipeline(doc["topics"])
            raw_iri = self._compute_raw_iri(topic_scores)

            weak   = [t for t, s in topic_scores.items() if s < WEAK_TOPIC_THRESHOLD]
            strong = [t for t, s in topic_scores.items() if s >= STRONG_TOPIC_THRESHOLD]

            all_weak_topics.extend(weak)
            all_strong_topics.extend(strong)

            student_records.append({
                "student_id":      doc["_id"],
                "raw_iri":         raw_iri,
                "weak_topics":     weak,
                "strong_topics":   strong,
                "weak_topic_count": len(weak),
            })

        # ── Step 3: normalise with MinMaxScaler ───────────────────────────────
        raw_scores = [r["raw_iri"] for r in student_records]
        normalised = self._normalise_cohort(raw_scores)

        for i, iri in enumerate(normalised):
            student_records[i]["iri_score"]      = iri
            student_records[i]["readiness_band"] = self._band(iri)

        # ── Step 4: numpy aggregates ──────────────────────────────────────────
        arr = np.array(normalised, dtype=float)
        n   = len(arr)

        # ── Step 5: band distribution ─────────────────────────────────────────
        band_counts = Counter(r["readiness_band"] for r in student_records)

        # Sort in logical order, not alphabetical
        band_order = ["Highly Ready", "Industry Ready", "Developing", "Needs Improvement"]
        band_dist  = [
            ReadinessBandCount(
                band=band,
                count=band_counts.get(band, 0),
                percentage=round(band_counts.get(band, 0) / n * 100, 1),
            )
            for band in band_order
            if band in band_counts
        ]

        top_weak   = [t for t, _ in Counter(all_weak_topics).most_common(5)]
        top_strong = [t for t, _ in Counter(all_strong_topics).most_common(5)]

        return DepartmentReadinessResponse(
            department_id=department_id,
            student_count=n,
            average_iri=round(float(arr.mean()), 2),
            median_iri=round(float(np.median(arr)), 2),
            std_deviation=round(float(arr.std()), 2),
            min_iri=round(float(arr.min()), 2),
            max_iri=round(float(arr.max()), 2),
            percentile_25=round(float(np.percentile(arr, 25)), 2),
            percentile_75=round(float(np.percentile(arr, 75)), 2),
            readiness_band_distribution=band_dist,
            top_weak_topics=top_weak,
            top_strong_topics=top_strong,
            student_scores=[
                StudentIRISummary(
                    student_id=r["student_id"],
                    iri_score=round(r["iri_score"], 2),
                    readiness_band=r["readiness_band"],
                    weak_topic_count=r["weak_topic_count"],
                )
                for r in student_records
            ],
        )

    # ── Step 1: Motor aggregation pipeline ───────────────────────────────────

    async def _fetch_student_topic_data(self, department_id: str) -> list[dict]:
        """
        Three-stage Motor aggregation pipeline.

        Stage 1 — $match
          Filter to this department only so we don't scan the whole collection.

        Stage 2 — $group by (student_id, topic)
          Compute difficulty-weighted sums inside MongoDB.
          $switch maps "easy"→1.0, "medium"→1.5, "hard"→2.0.
          This is the key efficiency gain: 50 questions per topic become
          two numbers (weighted_correct, total_weight) per student-topic pair.

        Stage 3 — $group by student_id
          Roll all (topic, weighted_correct, total_weight) pairs for one student
          into a single document using $push.

        Stage 4 — $sort
          Consistent ordering so tests are deterministic.
        """
        difficulty_switch = {
            "$switch": {
                "branches": [
                    {"case": {"$eq": ["$difficulty", "easy"]},   "then": 1.0},
                    {"case": {"$eq": ["$difficulty", "medium"]}, "then": 1.5},
                    {"case": {"$eq": ["$difficulty", "hard"]},   "then": 2.0},
                ],
                "default": 1.0,
            }
        }

        pipeline = [
            # ── Stage 1: filter ──────────────────────────────────────────────
            {"$match": {"department_id": department_id}},

            # ── Stage 2: per (student, topic) sums ──────────────────────────
            {
                "$group": {
                    "_id": {
                        "student_id": "$student_id",
                        "topic":      "$topic",
                    },
                    # Sum of difficulty weights for correct answers only
                    "weighted_correct": {
                        "$sum": {
                            "$multiply": [
                                {"$cond": [{"$eq": ["$is_correct", True]}, 1, 0]},
                                difficulty_switch,
                            ]
                        }
                    },
                    # Sum of difficulty weights for ALL answers (the denominator)
                    "total_weight": {"$sum": difficulty_switch},
                    "questions_attempted": {"$sum": 1},
                }
            },

            # ── Stage 3: collect all topics per student ──────────────────────
            {
                "$group": {
                    "_id": "$_id.student_id",
                    "topics": {
                        "$push": {
                            "topic":               "$_id.topic",
                            "weighted_correct":    "$weighted_correct",
                            "total_weight":        "$total_weight",
                            "questions_attempted": "$questions_attempted",
                        }
                    },
                }
            },

            # ── Stage 4: stable ordering ─────────────────────────────────────
            {"$sort": {"_id": 1}},
        ]

        return await self.db["results"].aggregate(pipeline).to_list(length=None)

    # ── Step 2 helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _topic_scores_from_pipeline(topics: list[dict]) -> dict[str, float]:
        """
        Convert pipeline output (pre-aggregated sums) into a topic→score dict.

        Each topic doc from the pipeline looks like:
          {"topic": "algorithms", "weighted_correct": 3.0, "total_weight": 4.0, ...}

        difficulty_score = weighted_correct / total_weight  → 0.0–1.0
        """
        scores: dict[str, float] = {}
        for t in topics:
            total = t.get("total_weight", 0)
            if total > 0:
                scores[t["topic"].lower().strip()] = t["weighted_correct"] / total
            else:
                scores[t["topic"].lower().strip()] = 0.0
        return scores

    @staticmethod
    def _compute_raw_iri(topic_scores: dict[str, float]) -> float:
        """
        Weighted average of topic scores using TOPIC_IMPORTANCE weights.
        Imported from analytics_service so the formula stays in one place.

        IRI = Σ(topic_weight × topic_score) / Σ(topic_weight)  × 100
        """
        if not topic_scores:
            return 0.0
        weighted_sum = sum(
            TOPIC_IMPORTANCE.get(topic, DEFAULT_TOPIC_WEIGHT) * score
            for topic, score in topic_scores.items()
        )
        total_weight = sum(
            TOPIC_IMPORTANCE.get(topic, DEFAULT_TOPIC_WEIGHT)
            for topic in topic_scores
        )
        return (weighted_sum / total_weight * 100) if total_weight else 0.0

    def _normalise_cohort(self, raw_iris: list[float]) -> list[float]:
        """
        MinMaxScaler over the whole cohort so scores are relative.
        Edge case: if every student scored identically, return as-is
        (scaler would produce all-zeros, which is misleading).
        """
        if len(raw_iris) < 2:
            return raw_iris

        arr = np.array(raw_iris, dtype=float).reshape(-1, 1)
        if arr.max() == arr.min():
            return raw_iris  # no spread — can't normalise meaningfully

        return [round(float(v[0]), 2) for v in self._scaler.fit_transform(arr)]

    @staticmethod
    def _band(iri: float) -> str:
        for threshold, label in READINESS_BANDS:
            if iri >= threshold:
                return label
        return "Needs Improvement"

    # ── Empty response guard ──────────────────────────────────────────────────

    @staticmethod
    def _empty_response(department_id: str) -> DepartmentReadinessResponse:
        return DepartmentReadinessResponse(
            department_id=department_id,
            student_count=0,
            average_iri=0.0,
            median_iri=0.0,
            std_deviation=0.0,
            min_iri=0.0,
            max_iri=0.0,
            percentile_25=0.0,
            percentile_75=0.0,
            readiness_band_distribution=[],
            top_weak_topics=[],
            top_strong_topics=[],
            student_scores=[],
        )