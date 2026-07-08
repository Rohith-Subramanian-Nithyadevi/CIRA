"""
tests/test_weak_topic_service.py
─────────────────────────────────
Run with:  pytest tests/test_weak_topic_service.py -v

Tests cover every function in WeakTopicService independently
without touching MongoDB — the DB is always mocked.
"""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.weak_topic_service import (
    WeakTopicService,
    WEAK_THRESHOLD,
    MIN_TOPICS_FOR_CLUSTERING,
)


# ── Fixture ───────────────────────────────────────────────────────────────────

@pytest.fixture
def service():
    mock_db = MagicMock()
    return WeakTopicService(db=mock_db)


# ── Helper ────────────────────────────────────────────────────────────────────

def make_docs(rows):
    """
    rows = list of (topic, difficulty, is_correct)
    Returns raw MongoDB-style dicts.
    """
    return [
        {"topic": topic, "difficulty": diff, "is_correct": correct}
        for topic, diff, correct in rows
    ]


# ── _build_question_dataframe ─────────────────────────────────────────────────

class TestBuildQuestionDataframe:

    def test_columns_present(self, service):
        docs = make_docs([("algorithms", "easy", True)])
        df = service._build_question_dataframe(docs)
        assert set(df.columns) >= {"topic", "difficulty", "is_correct", "difficulty_weight"}

    def test_topic_lowercased_and_stripped(self, service):
        docs = make_docs([("  Algorithms  ", "easy", True)])
        df = service._build_question_dataframe(docs)
        assert df["topic"].iloc[0] == "algorithms"

    def test_difficulty_weights_applied(self, service):
        docs = make_docs([
            ("t", "easy",   True),
            ("t", "medium", True),
            ("t", "hard",   True),
        ])
        df = service._build_question_dataframe(docs)
        assert list(df["difficulty_weight"]) == [1.0, 1.5, 2.0]

    def test_unknown_difficulty_defaults_to_1(self, service):
        docs = [{"topic": "x", "difficulty": "extreme", "is_correct": True}]
        df = service._build_question_dataframe(docs)
        assert df["difficulty_weight"].iloc[0] == 1.0

    def test_missing_fields_use_defaults(self, service):
        docs = [{}]   # completely empty doc
        df = service._build_question_dataframe(docs)
        assert df["topic"].iloc[0] == "unknown"
        assert df["is_correct"].iloc[0] == False


# ── _aggregate_by_topic ───────────────────────────────────────────────────────

class TestAggregateByTopic:

    def test_two_topics_produce_two_rows(self, service):
        docs = make_docs([
            ("algorithms", "easy", True),
            ("databases",  "easy", False),
        ])
        df = service._build_question_dataframe(docs)
        agg = service._aggregate_by_topic(df)
        assert len(agg) == 2

    def test_score_is_simple_ratio(self, service):
        docs = make_docs([
            ("t", "easy", True),
            ("t", "easy", False),
        ])
        df = service._build_question_dataframe(docs)
        agg = service._aggregate_by_topic(df)
        assert agg.loc[agg["topic"] == "t", "score"].iloc[0] == pytest.approx(0.5)

    def test_difficulty_score_weighted(self, service):
        """
        1 hard correct (w=2.0) + 1 easy wrong (w=1.0)
        difficulty_score = 2.0 / (2.0 + 1.0) = 0.667
        """
        docs = make_docs([
            ("t", "hard", True),
            ("t", "easy", False),
        ])
        df = service._build_question_dataframe(docs)
        agg = service._aggregate_by_topic(df)
        assert agg.loc[agg["topic"] == "t", "difficulty_score"].iloc[0] == pytest.approx(2/3, rel=1e-3)

    def test_hard_ratio_calculated(self, service):
        docs = make_docs([
            ("t", "hard",   True),
            ("t", "easy",   True),
            ("t", "medium", True),
        ])
        df = service._build_question_dataframe(docs)
        agg = service._aggregate_by_topic(df)
        assert agg.loc[agg["topic"] == "t", "hard_ratio"].iloc[0] == pytest.approx(1/3, rel=1e-3)

    def test_questions_attempted_count(self, service):
        docs = make_docs([("t", "easy", True)] * 5)
        df = service._build_question_dataframe(docs)
        agg = service._aggregate_by_topic(df)
        assert agg.loc[agg["topic"] == "t", "questions_attempted"].iloc[0] == 5

    def test_is_weak_defaults_false(self, service):
        docs = make_docs([("t", "easy", False)])
        df = service._build_question_dataframe(docs)
        agg = service._aggregate_by_topic(df)
        assert agg["is_weak"].iloc[0] == False  # not yet classified


# ── _detect_by_threshold ──────────────────────────────────────────────────────

class TestThresholdDetection:

    def _agg(self, service, rows):
        df = service._build_question_dataframe(make_docs(rows))
        return service._aggregate_by_topic(df)

    def test_below_threshold_is_weak(self, service):
        agg = self._agg(service, [("t", "easy", False), ("t", "easy", False)])
        result, method = service._detect_by_threshold(agg)
        assert result.loc[result["topic"] == "t", "is_weak"].iloc[0] == True
        assert method == "threshold"

    def test_above_threshold_not_weak(self, service):
        agg = self._agg(service, [("t", "easy", True), ("t", "easy", True)])
        result, method = service._detect_by_threshold(agg)
        assert result.loc[result["topic"] == "t", "is_weak"].iloc[0] == False

    def test_exactly_at_threshold_not_weak(self, service):
        """score == 0.5 should NOT be flagged (condition is strictly < threshold)"""
        agg = self._agg(service, [("t", "medium", True), ("t", "medium", False)])
        result, _ = service._detect_by_threshold(agg)
        ds = result.loc[result["topic"] == "t", "difficulty_score"].iloc[0]
        assert ds == pytest.approx(0.5)
        assert result.loc[result["topic"] == "t", "is_weak"].iloc[0] == False

    def test_original_dataframe_not_mutated(self, service):
        agg = self._agg(service, [("t", "easy", False)])
        original_copy = agg.copy()
        service._detect_by_threshold(agg)
        pd.testing.assert_frame_equal(agg, original_copy)


# ── _detect_by_clustering ─────────────────────────────────────────────────────

class TestClusteringDetection:

    def _agg_from_docs(self, service, rows):
        df = service._build_question_dataframe(make_docs(rows))
        return service._aggregate_by_topic(df)

    def test_returns_clustering_method_label(self, service):
        rows = (
            [("algorithms", "hard", False)] * 5 +   # clearly weak
            [("databases",  "medium", True)]  * 5 +  # moderate
            [("networking", "easy",   True)]  * 5    # strong
        )
        agg = self._agg_from_docs(service, rows)
        _, method = service._detect_by_clustering(agg)
        assert method == "clustering"

    def test_worst_topic_flagged_as_weak(self, service):
        """algorithms (all wrong) should land in the weak cluster."""
        rows = (
            [("algorithms", "easy", False)] * 6 +
            [("databases",  "easy", True)]  * 6 +
            [("networking", "easy", True)]  * 6
        )
        agg = self._agg_from_docs(service, rows)
        result, _ = service._detect_by_clustering(agg)
        assert result.loc[result["topic"] == "algorithms", "is_weak"].iloc[0] == True

    def test_best_topic_not_weak(self, service):
        """networking (all correct) should NOT be in the weak cluster."""
        rows = (
            [("algorithms", "easy", False)] * 6 +
            [("databases",  "easy", True)]  * 3 +
            [("networking", "easy", True)]  * 6
        )
        agg = self._agg_from_docs(service, rows)
        result, _ = service._detect_by_clustering(agg)
        assert result.loc[result["topic"] == "networking", "is_weak"].iloc[0] == False

    def test_cluster_label_column_added(self, service):
        rows = (
            [("a", "easy", False)] * 5 +
            [("b", "easy", True)]  * 5 +
            [("c", "hard", True)]  * 5
        )
        agg = self._agg_from_docs(service, rows)
        result, _ = service._detect_by_clustering(agg)
        assert "cluster_label" in result.columns
        assert result["cluster_label"].notna().all()

    def test_original_dataframe_not_mutated(self, service):
        rows = (
            [("a", "easy", False)] * 5 +
            [("b", "easy", True)]  * 5 +
            [("c", "hard", True)]  * 5
        )
        agg = self._agg_from_docs(service, rows)
        original_copy = agg.copy()
        service._detect_by_clustering(agg)
        pd.testing.assert_frame_equal(agg[["topic", "score"]], original_copy[["topic", "score"]])


# ── Method selection logic ────────────────────────────────────────────────────

class TestMethodSelection:

    @pytest.mark.asyncio
    async def test_uses_clustering_when_3_or_more_topics(self, service):
        docs = make_docs(
            [("algorithms", "easy", False)] * 3 +
            [("databases",  "easy", True)]  * 3 +
            [("networking", "easy", True)]  * 3
        )
        service._fetch_docs = AsyncMock(return_value=docs)
        result = await service.detect("s1", "e1")
        assert result.method_used == "clustering"

    @pytest.mark.asyncio
    async def test_uses_threshold_when_fewer_than_3_topics(self, service):
        docs = make_docs(
            [("algorithms", "easy", False)] * 3 +
            [("databases",  "easy", True)]  * 3
        )
        service._fetch_docs = AsyncMock(return_value=docs)
        result = await service.detect("s1", "e1")
        assert result.method_used == "threshold"

    @pytest.mark.asyncio
    async def test_empty_results_return_empty_response(self, service):
        service._fetch_docs = AsyncMock(return_value=[])
        result = await service.detect("s1", "e1")
        assert result.weak_topics == []
        assert result.total_topics == 0


# ── Full response shape ───────────────────────────────────────────────────────

class TestResponseShape:

    @pytest.mark.asyncio
    async def test_weak_count_matches_weak_topics_list(self, service):
        docs = make_docs(
            [("algorithms", "easy", False)] * 4 +
            [("databases",  "easy", True)]  * 4 +
            [("networking", "easy", True)]  * 4
        )
        service._fetch_docs = AsyncMock(return_value=docs)
        result = await service.detect("s1", "e1")
        assert result.weak_count == len(result.weak_topics)

    @pytest.mark.asyncio
    async def test_total_topics_matches_summaries(self, service):
        docs = make_docs(
            [("algorithms", "easy", True)] * 3 +
            [("databases",  "easy", True)] * 3 +
            [("networking", "easy", True)] * 3
        )
        service._fetch_docs = AsyncMock(return_value=docs)
        result = await service.detect("s1", "e1")
        assert result.total_topics == len(result.topic_summaries)

    @pytest.mark.asyncio
    async def test_topic_summaries_contain_all_fields(self, service):
        docs = make_docs([("algorithms", "hard", True)] * 4 +
                         [("databases",  "easy", False)] * 4 +
                         [("networking", "medium", True)] * 4)
        service._fetch_docs = AsyncMock(return_value=docs)
        result = await service.detect("s1", "e1")
        for summary in result.topic_summaries:
            assert hasattr(summary, "topic")
            assert hasattr(summary, "score")
            assert hasattr(summary, "difficulty_score")
            assert hasattr(summary, "is_weak")
            assert 0.0 <= summary.score <= 1.0