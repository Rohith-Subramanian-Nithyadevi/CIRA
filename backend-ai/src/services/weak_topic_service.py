"""
services/weak_topic_service.py
───────────────────────────────
Detects weak topics from a student's exam results using two methods:

METHOD 1 — KMeans Clustering  (used when student attempted ≥ 3 topics)
  • Builds a pandas DataFrame from raw question results
  • Computes per-topic features: difficulty-adjusted score, questions
    attempted, fraction of hard questions
  • Runs sklearn Pipeline: StandardScaler → KMeans(k=3)
  • Labels the cluster with the lowest centroid score as "weak"
  • Advantage: adapts to exam difficulty — if all questions were hard
    and everyone scored ~40%, the algorithm still finds the relatively
    weakest topics rather than flagging everything

METHOD 2 — Threshold  (fallback when < 3 topics, not enough for k=3)
  • Same pandas aggregation
  • Flags any topic whose difficulty-adjusted score < WEAK_THRESHOLD (0.5)

Both methods use the same pandas aggregation pipeline.
The route always returns which method was used so callers know.
"""

from __future__ import annotations

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from typing import List, Tuple

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..schemas.weak_topic import TopicSummary, WeakTopicResponse

# ── Constants ─────────────────────────────────────────────────────────────────

DIFFICULTY_WEIGHTS: dict[str, float] = {
    "easy":   1.0,
    "medium": 1.5,
    "hard":   2.0,
}

# Used only by the threshold fallback method
WEAK_THRESHOLD = 0.50

# Minimum number of distinct topics needed to run clustering
MIN_TOPICS_FOR_CLUSTERING = 3


# ── Service ───────────────────────────────────────────────────────────────────

class WeakTopicService:
    """
    All weak-topic detection logic lives here.
    Called by the route handler via FastAPI dependency injection.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db

    # ── Public ────────────────────────────────────────────────────────────────

    async def detect(self, student_id: str, exam_id: str) -> WeakTopicResponse:
        """
        Full pipeline: fetch → DataFrame → aggregate → detect → respond.

        Steps
        -----
        1. Fetch this student's question-level results from MongoDB.
        2. Build a tidy pandas DataFrame (one row per question).
        3. Aggregate into a per-topic DataFrame (one row per topic).
        4. Choose detection method based on number of distinct topics.
        5. Return structured response.
        """
        docs = await self._fetch_docs(student_id, exam_id)

        if not docs:
            return self._empty_response(student_id, exam_id)

        # Step 2 — raw DataFrame
        question_df = self._build_question_dataframe(docs)

        # Step 3 — aggregate into one row per topic
        topic_df = self._aggregate_by_topic(question_df)

        # Step 4 — choose method
        n_topics = len(topic_df)
        if n_topics >= MIN_TOPICS_FOR_CLUSTERING:
            topic_df, method = self._detect_by_clustering(topic_df)
        else:
            topic_df, method = self._detect_by_threshold(topic_df)

        # Step 5 — build response
        weak_topics = topic_df.loc[topic_df["is_weak"], "topic"].tolist()

        summaries = [
            TopicSummary(
                topic=str(row["topic"]),
                score=round(float(row["score"]), 4),
                difficulty_score=round(float(row["difficulty_score"]), 4),
                questions_attempted=int(row["questions_attempted"]),
                hard_ratio=round(float(row["hard_ratio"]), 4),
                is_weak=bool(row["is_weak"]),
                cluster_label=int(row["cluster_label"]) if pd.notna(row.get("cluster_label")) else None,
            )
            for _, row in topic_df.iterrows()
        ]

        return WeakTopicResponse(
            student_id=student_id,
            exam_id=exam_id,
            weak_topics=weak_topics,
            topic_summaries=summaries,
            method_used=method,
            weak_count=len(weak_topics),
            total_topics=n_topics,
        )

    # ── Step 2: build question-level DataFrame ────────────────────────────────

    def _build_question_dataframe(self, docs: list[dict]) -> pd.DataFrame:
        """
        Convert raw MongoDB docs into a tidy pandas DataFrame.

        Input  (one dict per answered question):
            {"topic": "algorithms", "difficulty": "hard", "is_correct": True, ...}

        Output columns:
            topic            str    — topic name, lowercased and stripped
            difficulty       str    — easy / medium / hard
            is_correct       bool
            difficulty_weight float — 1.0 / 1.5 / 2.0
        """
        rows = [
            {
                "topic":            doc.get("topic", "unknown").lower().strip(),
                "difficulty":       doc.get("difficulty", "medium"),
                "is_correct":       bool(doc.get("is_correct", False)),
                "difficulty_weight": DIFFICULTY_WEIGHTS.get(
                    doc.get("difficulty", "medium"), 1.0
                ),
            }
            for doc in docs
        ]
        return pd.DataFrame(rows)

    # ── Step 3: aggregate into per-topic features ─────────────────────────────

    def _aggregate_by_topic(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Group the question-level DataFrame by topic and compute three features
        per topic. These features are used by both detection methods.

        Features
        --------
        score             float  Simple correct ratio = correct_count / total
        difficulty_score  float  Weighted correct ratio
                                 = Σ(weight × correct) / Σ(weight)
                                 A hard question answered correctly contributes
                                 2× as much as an easy one
        questions_attempted int  Total questions in this topic
        hard_ratio        float  Fraction of questions at hard difficulty
                                 (topic with many hard Qs deserves more credit)

        Returns a new DataFrame with one row per topic and an extra
        bool column `is_weak` (default False, set by the detection step).
        """

        def topic_stats(group: pd.DataFrame) -> pd.Series:
            total_weight = group["difficulty_weight"].sum()
            weighted_correct = (group["difficulty_weight"] * group["is_correct"]).sum()
            return pd.Series({
                "score":               group["is_correct"].mean(),
                "difficulty_score":    weighted_correct / total_weight if total_weight else 0.0,
                "questions_attempted": len(group),
                "hard_ratio":          (group["difficulty"] == "hard").mean(),
                "is_weak":             False,
                "cluster_label":       np.nan,
            })

        return (
            df.groupby("topic", as_index=False)
              .apply(topic_stats)
              .reset_index(drop=True)
        )

    # ── Step 4a: KMeans clustering detection ─────────────────────────────────

    def _detect_by_clustering(
        self, topic_df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, str]:
        """
        Automatically discovers which topics are weak using KMeans (k=3).

        Why clustering instead of a fixed threshold?
        If the exam was difficult and everyone scored 35–55%, a threshold
        of 0.5 would flag most topics as weak — not useful. Clustering finds
        the *relatively* weakest cluster regardless of absolute score levels.

        Pipeline
        --------
        1. Extract feature matrix X from [difficulty_score, hard_ratio]
        2. StandardScaler — removes scale differences between features
           (difficulty_score is 0–1, hard_ratio is 0–1, but their variances differ)
        3. KMeans(k=3) — produces three clusters: weak / moderate / strong
        4. Find which cluster has the lowest mean difficulty_score → weak cluster
        5. Label all topics in that cluster as is_weak=True

        Why StandardScaler before KMeans?
        KMeans uses Euclidean distance, which is biased toward features with
        larger variance. Scaling ensures difficulty_score and hard_ratio
        contribute equally to the clustering.
        """
        topic_df = topic_df.copy()

        # Feature matrix: rows = topics, cols = [difficulty_score, hard_ratio]
        X = topic_df[["difficulty_score", "hard_ratio"]].values

        sklearn_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("kmeans", KMeans(n_clusters=3, random_state=42, n_init=10)),
        ])

        cluster_labels = sklearn_pipeline.fit_predict(X)
        topic_df["cluster_label"] = cluster_labels

        # Identify the weak cluster = lowest average difficulty_score
        cluster_means = (
            topic_df.groupby("cluster_label")["difficulty_score"].mean()
        )
        weak_cluster_id = int(cluster_means.idxmin())

        topic_df["is_weak"] = topic_df["cluster_label"] == weak_cluster_id

        return topic_df, "clustering"

    # ── Step 4b: Threshold detection (fallback) ───────────────────────────────

    def _detect_by_threshold(
        self, topic_df: pd.DataFrame
    ) -> Tuple[pd.DataFrame, str]:
        """
        Simple fallback when there are fewer than 3 topics.
        Any topic whose difficulty-adjusted score is below WEAK_THRESHOLD is weak.
        Used when KMeans cannot run (k=3 requires ≥3 data points).
        """
        topic_df = topic_df.copy()
        topic_df["is_weak"] = topic_df["difficulty_score"] < WEAK_THRESHOLD
        return topic_df, "threshold"

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _fetch_docs(self, student_id: str, exam_id: str) -> list[dict]:
        return await self.db["results"].find(
            {"student_id": student_id, "exam_id": exam_id}
        ).to_list(length=None)

    @staticmethod
    def _empty_response(student_id: str, exam_id: str) -> WeakTopicResponse:
        return WeakTopicResponse(
            student_id=student_id,
            exam_id=exam_id,
            weak_topics=[],
            topic_summaries=[],
            method_used="threshold",
            weak_count=0,
            total_topics=0,
        )