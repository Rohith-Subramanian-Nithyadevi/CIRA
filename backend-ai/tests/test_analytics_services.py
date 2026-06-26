"""
tests/test_analytics_service.py
────────────────────────────────
Run with:  pytest tests/test_analytics_service.py -v

These tests cover the pure-Python algorithm functions directly,
without touching MongoDB (no async DB calls are made here).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.analytics_service import AnalyticsService, WEAK_TOPIC_THRESHOLD
from src.schemas.analytics import QuestionResult


# ── Fixture: service with a mocked DB ────────────────────────────────────────

@pytest.fixture
def service():
    mock_db = MagicMock()
    return AnalyticsService(db=mock_db)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_results(rows):
    """
    rows = list of (topic, difficulty, is_correct)
    """
    return [
        QuestionResult(
            question_id=f"q{i}",
            topic=topic,
            difficulty=difficulty,
            is_correct=correct,
        )
        for i, (topic, difficulty, correct) in enumerate(rows)
    ]


# ── Topic breakdown tests ─────────────────────────────────────────────────────

class TestTopicBreakdown:

    def test_all_correct_easy(self, service):
        results = make_results([
            ("algorithms", "easy", True),
            ("algorithms", "easy", True),
        ])
        bd = service._compute_topic_breakdown(results)
        assert bd["algorithms"].raw_score == pytest.approx(1.0)
        assert bd["algorithms"].is_weak is False
        assert bd["algorithms"].questions_attempted == 2

    def test_all_wrong(self, service):
        results = make_results([
            ("databases", "medium", False),
            ("databases", "hard",   False),
        ])
        bd = service._compute_topic_breakdown(results)
        assert bd["databases"].raw_score == pytest.approx(0.0)
        assert bd["databases"].is_weak is True

    def test_hard_outweighs_easy(self, service):
        """
        1 hard correct (weight 2.0) vs 1 easy wrong (weight 1.0)
        earned = 2.0,  max = 3.0  →  score = 0.667
        """
        results = make_results([
            ("networking", "hard", True),
            ("networking", "easy", False),
        ])
        bd = service._compute_topic_breakdown(results)
        assert bd["networking"].raw_score == pytest.approx(2.0 / 3.0, rel=1e-3)

    def test_mixed_topics(self, service):
        results = make_results([
            ("algorithms", "easy",   True),
            ("databases",  "medium", False),
        ])
        bd = service._compute_topic_breakdown(results)
        assert "algorithms" in bd
        assert "databases" in bd
        assert bd["algorithms"].raw_score == pytest.approx(1.0)
        assert bd["databases"].raw_score  == pytest.approx(0.0)

    def test_weak_threshold_boundary(self, service):
        """
        Score exactly at threshold should NOT be flagged as weak.
        """
        # 1 medium correct (1.5), 1 medium wrong (1.5) → score = 0.5 = threshold
        results = make_results([
            ("topic_x", "medium", True),
            ("topic_x", "medium", False),
        ])
        bd = service._compute_topic_breakdown(results)
        # 0.5 is NOT < 0.5,  so is_weak should be False
        assert bd["topic_x"].raw_score == pytest.approx(0.5)
        assert bd["topic_x"].is_weak is False


# ── Raw IRI tests ─────────────────────────────────────────────────────────────

class TestRawIRI:

    def test_perfect_score(self, service):
        results = make_results([
            ("algorithms", "hard", True),
            ("databases",  "hard", True),
        ])
        bd = service._compute_topic_breakdown(results)
        iri = service._compute_raw_iri(bd)
        assert iri == pytest.approx(100.0)

    def test_zero_score(self, service):
        results = make_results([
            ("algorithms", "easy", False),
            ("databases",  "easy", False),
        ])
        bd = service._compute_topic_breakdown(results)
        iri = service._compute_raw_iri(bd)
        assert iri == pytest.approx(0.0)

    def test_half_score(self, service):
        """All topics at 50 % → IRI should be 50."""
        results = make_results([
            ("algorithms", "easy", True),
            ("algorithms", "easy", False),
        ])
        bd = service._compute_topic_breakdown(results)
        iri = service._compute_raw_iri(bd)
        assert iri == pytest.approx(50.0)

    def test_empty_breakdown(self, service):
        iri = service._compute_raw_iri({})
        assert iri == pytest.approx(0.0)


# ── Cohort normalization tests ────────────────────────────────────────────────

class TestCohortNormalization:

    def test_two_students_spread(self, service):
        """Student with 100 raw IRI → 100.0 normalized; student with 0 → 0.0."""
        normalized = service._normalize_cohort([0.0, 100.0])
        assert normalized[0] == pytest.approx(0.0)
        assert normalized[1] == pytest.approx(100.0)

    def test_single_student_returned_unchanged(self, service):
        """Can't normalize a cohort of one; return as-is."""
        result = service._normalize_cohort([75.0])
        assert result == [75.0]

    def test_all_identical_scores_unchanged(self, service):
        """All students scored the same — scaler would divide by zero; guard fires."""
        result = service._normalize_cohort([60.0, 60.0, 60.0])
        assert result == [60.0, 60.0, 60.0]

    def test_relative_ordering_preserved(self, service):
        raw = [30.0, 70.0, 50.0]
        normalized = service._normalize_cohort(raw)
        assert normalized[1] > normalized[2] > normalized[0]


# ── Readiness band tests ──────────────────────────────────────────────────────

class TestReadinessBand:

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
    def test_band_boundaries(self, service, score, expected):
        assert service._readiness_band(score) == expected


# ── Top weak topics ───────────────────────────────────────────────────────────

class TestTopWeakTopics:

    def test_returns_top_n(self, service):
        topics = ["algorithms"] * 5 + ["databases"] * 3 + ["networking"] * 1
        result = service._top_weak_topics(topics, top_n=2)
        assert result == ["algorithms", "databases"]

    def test_empty_list(self, service):
        assert service._top_weak_topics([]) == []
