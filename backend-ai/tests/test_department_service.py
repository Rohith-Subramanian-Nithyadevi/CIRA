"""
tests/test_department_service.py
──────────────────────────────────
Run with:  pytest tests/test_department_service.py -v

All tests mock the Motor DB so no MongoDB instance is needed.
The tests work with simulated pipeline output (what Motor would return)
to verify every computation step in isolation.
"""

import pytest
import numpy as np
from collections import Counter
from unittest.mock import AsyncMock, MagicMock

from src.services.department_service import DepartmentService, STRONG_TOPIC_THRESHOLD
from src.services.analytics_service import WEAK_TOPIC_THRESHOLD


# ── Fixture ───────────────────────────────────────────────────────────────────

@pytest.fixture
def service():
    return DepartmentService(db=MagicMock())


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_pipeline_doc(student_id: str, topics: list[tuple]) -> dict:
    """
    Build a document in the shape Motor's aggregation pipeline returns.

    topics = list of (topic_name, weighted_correct, total_weight, q_attempted)
    e.g. [("algorithms", 2.0, 4.0, 3), ("databases", 1.5, 1.5, 1)]
    """
    return {
        "_id": student_id,
        "topics": [
            {
                "topic":               name,
                "weighted_correct":    wc,
                "total_weight":        tw,
                "questions_attempted": qa,
            }
            for name, wc, tw, qa in topics
        ],
    }


# ── _topic_scores_from_pipeline ───────────────────────────────────────────────

class TestTopicScoresFromPipeline:

    def test_perfect_score(self, service):
        doc = make_pipeline_doc("s1", [("algorithms", 4.0, 4.0, 3)])
        scores = service._topic_scores_from_pipeline(doc["topics"])
        assert scores["algorithms"] == pytest.approx(1.0)

    def test_zero_score(self, service):
        doc = make_pipeline_doc("s1", [("algorithms", 0.0, 3.0, 3)])
        scores = service._topic_scores_from_pipeline(doc["topics"])
        assert scores["algorithms"] == pytest.approx(0.0)

    def test_partial_score(self, service):
        # weighted_correct=2.0, total_weight=4.0 → 0.5
        doc = make_pipeline_doc("s1", [("databases", 2.0, 4.0, 4)])
        scores = service._topic_scores_from_pipeline(doc["topics"])
        assert scores["databases"] == pytest.approx(0.5)

    def test_topic_name_lowercased_and_stripped(self, service):
        topics = [{"topic": "  Algorithms  ", "weighted_correct": 2.0, "total_weight": 2.0, "questions_attempted": 2}]
        scores = service._topic_scores_from_pipeline(topics)
        assert "algorithms" in scores

    def test_zero_total_weight_returns_zero(self, service):
        topics = [{"topic": "t", "weighted_correct": 0.0, "total_weight": 0.0, "questions_attempted": 0}]
        scores = service._topic_scores_from_pipeline(topics)
        assert scores["t"] == pytest.approx(0.0)

    def test_multiple_topics(self, service):
        doc = make_pipeline_doc("s1", [
            ("algorithms", 2.0, 4.0, 3),
            ("databases",  1.5, 1.5, 1),
        ])
        scores = service._topic_scores_from_pipeline(doc["topics"])
        assert len(scores) == 2
        assert scores["databases"] == pytest.approx(1.0)


# ── _compute_raw_iri ──────────────────────────────────────────────────────────

class TestComputeRawIRI:

    def test_perfect_all_topics(self, service):
        scores = {"algorithms": 1.0, "databases": 1.0}
        assert service._compute_raw_iri(scores) == pytest.approx(100.0)

    def test_zero_all_topics(self, service):
        scores = {"algorithms": 0.0, "databases": 0.0}
        assert service._compute_raw_iri(scores) == pytest.approx(0.0)

    def test_half_score(self, service):
        scores = {"unknown_topic": 0.5}   # uses DEFAULT_TOPIC_WEIGHT
        assert service._compute_raw_iri(scores) == pytest.approx(50.0)

    def test_empty_scores_returns_zero(self, service):
        assert service._compute_raw_iri({}) == pytest.approx(0.0)

    def test_important_topic_weighted_more(self, service):
        """
        "algorithms" has weight 1.5, an unknown topic has weight 1.0.
        When algorithms scores 1.0 and unknown scores 0.0:
        IRI = (1.5×1.0 + 1.0×0.0) / (1.5+1.0) × 100 = 60.0
        """
        scores = {"algorithms": 1.0, "unknown_subject": 0.0}
        iri = service._compute_raw_iri(scores)
        assert iri == pytest.approx(60.0, rel=1e-2)


# ── _normalise_cohort ─────────────────────────────────────────────────────────

class TestNormaliseCohort:

    def test_min_becomes_zero_max_becomes_hundred(self, service):
        result = service._normalise_cohort([20.0, 80.0])
        assert result[0] == pytest.approx(0.0)
        assert result[1] == pytest.approx(100.0)

    def test_single_score_returned_unchanged(self, service):
        assert service._normalise_cohort([75.0]) == [75.0]

    def test_all_identical_scores_returned_unchanged(self, service):
        result = service._normalise_cohort([50.0, 50.0, 50.0])
        assert result == [50.0, 50.0, 50.0]

    def test_relative_order_preserved(self, service):
        scores = [30.0, 70.0, 50.0]
        result = service._normalise_cohort(scores)
        assert result[1] > result[2] > result[0]

    def test_three_students_spread(self, service):
        result = service._normalise_cohort([0.0, 50.0, 100.0])
        assert result[0] == pytest.approx(0.0)
        assert result[2] == pytest.approx(100.0)
        assert result[1] == pytest.approx(50.0)


# ── _band ─────────────────────────────────────────────────────────────────────

class TestBand:

    @pytest.mark.parametrize("score,expected", [
        (100.0, "Highly Ready"),
        (80.0,  "Highly Ready"),
        (79.9,  "Industry Ready"),
        (60.0,  "Industry Ready"),
        (59.9,  "Developing"),
        (40.0,  "Developing"),
        (39.9,  "Needs Improvement"),
        (0.0,   "Needs Improvement"),
    ])
    def test_boundaries(self, service, score, expected):
        assert service._band(score) == expected


# ── Full get_readiness pipeline ───────────────────────────────────────────────

class TestGetReadiness:

    def _make_service_with_docs(self, docs):
        """Return a DepartmentService whose Motor pipeline returns `docs`."""
        svc = DepartmentService(db=MagicMock())
        svc._fetch_student_topic_data = AsyncMock(return_value=docs)
        return svc

    @pytest.mark.asyncio
    async def test_empty_department_returns_zero_response(self):
        svc = self._make_service_with_docs([])
        result = await svc.get_readiness("dept_cs")
        assert result.student_count == 0
        assert result.average_iri == 0.0
        assert result.student_scores == []

    @pytest.mark.asyncio
    async def test_student_count_matches_docs(self):
        docs = [
            make_pipeline_doc("s1", [("algorithms", 4.0, 4.0, 4)]),
            make_pipeline_doc("s2", [("algorithms", 2.0, 4.0, 4)]),
            make_pipeline_doc("s3", [("algorithms", 0.0, 4.0, 4)]),
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        assert result.student_count == 3
        assert len(result.student_scores) == 3

    @pytest.mark.asyncio
    async def test_scores_in_valid_range(self):
        docs = [
            make_pipeline_doc("s1", [("algorithms", 4.0, 4.0, 4), ("databases", 1.0, 2.0, 2)]),
            make_pipeline_doc("s2", [("algorithms", 0.0, 4.0, 4), ("databases", 2.0, 2.0, 2)]),
            make_pipeline_doc("s3", [("algorithms", 2.0, 4.0, 4), ("databases", 0.0, 2.0, 2)]),
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        for s in result.student_scores:
            assert 0.0 <= s.iri_score <= 100.0

    @pytest.mark.asyncio
    async def test_best_student_gets_highest_score(self):
        """
        s1 answers everything correctly → should have the highest IRI.
        """
        docs = [
            make_pipeline_doc("s1", [("algorithms", 4.0, 4.0, 4)]),  # 100 %
            make_pipeline_doc("s2", [("algorithms", 2.0, 4.0, 4)]),  # 50 %
            make_pipeline_doc("s3", [("algorithms", 0.0, 4.0, 4)]),  # 0 %
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        score_map = {s.student_id: s.iri_score for s in result.student_scores}
        assert score_map["s1"] > score_map["s2"] > score_map["s3"]

    @pytest.mark.asyncio
    async def test_average_iri_within_range(self):
        docs = [
            make_pipeline_doc("s1", [("algorithms", 3.0, 4.0, 4)]),
            make_pipeline_doc("s2", [("algorithms", 2.0, 4.0, 4)]),
            make_pipeline_doc("s3", [("algorithms", 1.0, 4.0, 4)]),
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        assert 0.0 <= result.average_iri <= 100.0

    @pytest.mark.asyncio
    async def test_percentile_25_less_than_75(self):
        docs = [
            make_pipeline_doc(f"s{i}", [("algorithms", float(i), 4.0, 4)])
            for i in range(1, 6)
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        assert result.percentile_25 <= result.percentile_75

    @pytest.mark.asyncio
    async def test_median_between_min_and_max(self):
        docs = [
            make_pipeline_doc("s1", [("algorithms", 4.0, 4.0, 4)]),
            make_pipeline_doc("s2", [("algorithms", 2.0, 4.0, 4)]),
            make_pipeline_doc("s3", [("algorithms", 0.0, 4.0, 4)]),
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        assert result.min_iri <= result.median_iri <= result.max_iri

    @pytest.mark.asyncio
    async def test_weak_topic_count_per_student(self):
        """
        s1 scores 0 % on every topic → all are weak → weak_topic_count > 0.
        """
        docs = [
            make_pipeline_doc("s1", [
                ("algorithms", 0.0, 4.0, 4),
                ("databases",  0.0, 4.0, 4),
            ]),
            make_pipeline_doc("s2", [
                ("algorithms", 4.0, 4.0, 4),
                ("databases",  4.0, 4.0, 4),
            ]),
            make_pipeline_doc("s3", [
                ("algorithms", 2.0, 4.0, 4),
                ("databases",  0.0, 4.0, 4),
            ]),
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        score_map = {s.student_id: s for s in result.student_scores}
        assert score_map["s1"].weak_topic_count == 2
        assert score_map["s2"].weak_topic_count == 0

    @pytest.mark.asyncio
    async def test_top_weak_topics_most_common(self):
        """
        All three students are weak in "databases" → it should appear in top_weak_topics.
        """
        docs = [
            make_pipeline_doc(f"s{i}", [
                ("algorithms", 4.0, 4.0, 4),   # strong
                ("databases",  0.0, 4.0, 4),   # weak for all
            ])
            for i in range(1, 4)
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        assert "databases" in result.top_weak_topics

    @pytest.mark.asyncio
    async def test_band_distribution_sums_to_student_count(self):
        docs = [
            make_pipeline_doc("s1", [("algorithms", 4.0, 4.0, 4)]),
            make_pipeline_doc("s2", [("algorithms", 0.0, 4.0, 4)]),
            make_pipeline_doc("s3", [("algorithms", 2.0, 4.0, 4)]),
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        total_in_bands = sum(b.count for b in result.readiness_band_distribution)
        assert total_in_bands == result.student_count

    @pytest.mark.asyncio
    async def test_band_percentages_sum_to_100(self):
        docs = [
            make_pipeline_doc(f"s{i}", [("algorithms", float(i), 4.0, 4)])
            for i in range(4)
        ]
        svc = self._make_service_with_docs(docs)
        result = await svc.get_readiness("dept_cs")
        total_pct = sum(b.percentage for b in result.readiness_band_distribution)
        assert total_pct == pytest.approx(100.0, abs=0.5)   # allow rounding