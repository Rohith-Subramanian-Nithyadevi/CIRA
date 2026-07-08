"""
tests/test_topic_matcher_service.py
─────────────────────────────────────
Run with:  pytest tests/test_topic_matcher_service.py -v

Key testing strategy
────────────────────
We never load the real sentence-transformer model in tests.
Instead we inject controlled 2-D unit-vector embeddings so cosine
similarity results are mathematically predictable:

  "recursion"            → [1.0, 0.0]
  "recursive algorithms" → [0.99, 0.14]   ← cosine_sim ≈ 0.99  (should match)
  "databases"            → [0.0, 1.0]     ← cosine_sim = 0.0   (should NOT match)

This lets every test assert exact thresholds without randomness.
MongoDB is always mocked — no running instance needed.
"""

import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock, patch

from src.services.topic_matcher_service import TopicMatcherService
from src.schemas.topic_matcher import TopicMatchRequest


# ── Controlled embeddings ─────────────────────────────────────────────────────
#
# We use 2-D unit vectors.  Cosine similarity between unit vectors equals
# their dot product, which is easy to reason about.
#
# "recursion"              [1.000, 0.000]
# "recursive algorithms"  [0.990, 0.141]   dot → 0.990  (very similar)
# "recursive functions"   [0.940, 0.342]   dot → 0.940  (similar)
# "databases"             [0.000, 1.000]   dot → 0.000  (unrelated)
# "sql queries"           [0.174, 0.985]   dot → 0.174  (unrelated)

EMBEDDINGS: dict[str, np.ndarray] = {
    "recursion":             np.array([1.000, 0.000]),
    "recursive algorithms":  np.array([0.990, 0.141]),
    "recursive functions":   np.array([0.940, 0.342]),
    "databases":             np.array([0.000, 1.000]),
    "sql queries":           np.array([0.174, 0.985]),
}


def fake_encode(texts, **kwargs):
    """Return the controlled embedding for each text; fall back to a zero vector."""
    return np.array([
        EMBEDDINGS.get(t.lower().strip(), np.array([0.0, 0.0]))
        for t in (texts if isinstance(texts, list) else [texts])
    ])


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def service():
    """TopicMatcherService with mocked DB and injected fake encoder."""
    svc = TopicMatcherService(db=MagicMock())
    # Bypass lazy loading — inject a mock whose encode uses fake_encode
    mock_model = MagicMock()
    mock_model.encode = MagicMock(side_effect=fake_encode)
    svc._model = mock_model
    return svc


def make_request(
    weak_topics,
    difficulty="medium",
    questions_per_topic=3,
    threshold=0.60,
):
    return TopicMatchRequest(
        weak_topics=weak_topics,
        difficulty=difficulty,
        questions_per_topic=questions_per_topic,
        similarity_threshold=threshold,
    )


# ── _build_topic_matches ──────────────────────────────────────────────────────

class TestBuildTopicMatches:

    def _sim_matrix(self, weak, bank):
        from sklearn.metrics.pairwise import cosine_similarity
        w = fake_encode(weak)
        b = fake_encode(bank)
        return cosine_similarity(w, b)

    def test_similar_topic_included(self, service):
        bank    = ["recursive algorithms", "databases"]
        weak    = ["recursion"]
        matrix  = self._sim_matrix(weak, bank)
        matches, bank_map = service._build_topic_matches(weak, bank, matrix, threshold=0.60)

        assert matches[0].has_match is True
        assert "recursive algorithms" in matches[0].matched_bank_topics

    def test_unrelated_topic_excluded(self, service):
        bank    = ["databases"]
        weak    = ["recursion"]
        matrix  = self._sim_matrix(weak, bank)
        matches, bank_map = service._build_topic_matches(weak, bank, matrix, threshold=0.60)

        assert matches[0].has_match is False
        assert matches[0].matched_bank_topics == []

    def test_results_sorted_best_first(self, service):
        bank   = ["recursive functions", "recursive algorithms"]
        weak   = ["recursion"]
        matrix = self._sim_matrix(weak, bank)
        matches, _ = service._build_topic_matches(weak, bank, matrix, threshold=0.60)

        scores = [
            EMBEDDINGS["recursion"] @ EMBEDDINGS[t]
            for t in matches[0].matched_bank_topics
        ]
        assert scores == sorted(scores, reverse=True)

    def test_top_similarity_score_is_highest(self, service):
        bank   = ["recursive functions", "recursive algorithms"]
        weak   = ["recursion"]
        matrix = self._sim_matrix(weak, bank)
        matches, _ = service._build_topic_matches(weak, bank, matrix, threshold=0.60)

        best_possible = max(
            float(EMBEDDINGS["recursion"] @ EMBEDDINGS[t]) for t in bank
        )
        assert matches[0].top_similarity_score == pytest.approx(best_possible, abs=1e-3)

    def test_bank_topic_map_contains_matched_topics(self, service):
        bank   = ["recursive algorithms", "databases"]
        weak   = ["recursion"]
        matrix = self._sim_matrix(weak, bank)
        _, bank_map = service._build_topic_matches(weak, bank, matrix, threshold=0.60)

        assert "recursive algorithms" in bank_map
        assert "databases" not in bank_map

    def test_bank_topic_map_stores_weak_topic_and_score(self, service):
        bank   = ["recursive algorithms"]
        weak   = ["recursion"]
        matrix = self._sim_matrix(weak, bank)
        _, bank_map = service._build_topic_matches(weak, bank, matrix, threshold=0.60)

        source_weak, score = bank_map["recursive algorithms"]
        assert source_weak == "recursion"
        assert score > 0.60

    def test_higher_score_wins_when_two_weak_topics_match_same_bank_topic(self, service):
        """
        Both "recursion" and "recursive functions" are similar to "recursive algorithms".
        The one with the higher cosine similarity should win in the map.
        """
        bank   = ["recursive algorithms"]
        weak   = ["recursion", "recursive functions"]
        matrix = self._sim_matrix(weak, bank)
        _, bank_map = service._build_topic_matches(weak, bank, matrix, threshold=0.50)

        winning_weak, _ = bank_map["recursive algorithms"]
        score_recursion  = float(EMBEDDINGS["recursion"]  @ EMBEDDINGS["recursive algorithms"])
        score_rec_func   = float(EMBEDDINGS["recursive functions"] @ EMBEDDINGS["recursive algorithms"])
        expected_winner  = "recursion" if score_recursion >= score_rec_func else "recursive functions"
        assert winning_weak == expected_winner

    def test_no_match_above_zero_threshold_with_zero_vector(self, service):
        """A zero embedding (unknown topic) should never match anything."""
        bank   = ["recursive algorithms"]
        weak   = ["completely unknown xyz"]      # → zero vector in fake_encode
        matrix = self._sim_matrix(weak, bank)
        matches, _ = service._build_topic_matches(weak, bank, matrix, threshold=0.60)
        assert matches[0].has_match is False

    def test_threshold_boundary_exactly_at_threshold_included(self, service):
        """Score exactly equal to threshold should be included (≥ not >)."""
        bank   = ["recursive algorithms"]
        weak   = ["recursion"]
        matrix = self._sim_matrix(weak, bank)
        exact_score = float(cosine_similarity_val(weak[0], bank[0]))
        matches, _ = service._build_topic_matches(weak, bank, matrix, threshold=exact_score)
        assert matches[0].has_match is True

    def test_multiple_weak_topics_produce_one_match_each(self, service):
        bank   = ["recursive algorithms", "sql queries"]
        weak   = ["recursion", "databases"]
        matrix = self._sim_matrix(weak, bank)
        matches, _ = service._build_topic_matches(weak, bank, matrix, threshold=0.60)
        assert len(matches) == 2


# ── _fetch_distinct_topics ────────────────────────────────────────────────────

class TestFetchDistinctTopics:

    @pytest.mark.asyncio
    async def test_returns_list_of_strings(self, service):
        service.db["questions"].aggregate = MagicMock(return_value=async_iter([
            {"_id": "Recursive Algorithms"},
            {"_id": "Databases"},
        ]))
        topics = await service._fetch_distinct_topics()
        assert topics == ["recursive algorithms", "databases"]

    @pytest.mark.asyncio
    async def test_empty_collection_returns_empty_list(self, service):
        service.db["questions"].aggregate = MagicMock(return_value=async_iter([]))
        topics = await service._fetch_distinct_topics()
        assert topics == []

    @pytest.mark.asyncio
    async def test_none_topic_filtered_out(self, service):
        service.db["questions"].aggregate = MagicMock(return_value=async_iter([
            {"_id": None},
            {"_id": "algorithms"},
        ]))
        topics = await service._fetch_distinct_topics()
        assert None not in topics
        assert "algorithms" in topics


# ── _fetch_questions ──────────────────────────────────────────────────────────

class TestFetchQuestions:

    @pytest.mark.asyncio
    async def test_questions_tagged_with_weak_topic(self, service):
        bank_topic_map = {"recursive algorithms": ("recursion", 0.99)}
        docs = [make_question_doc("q1", "recursive algorithms", "medium")]
        service.db["questions"].aggregate = MagicMock(return_value=async_iter(docs))

        questions = await service._fetch_questions(bank_topic_map, "medium", 3)

        assert questions[0].matched_from_weak_topic == "recursion"
        assert questions[0].similarity_score == pytest.approx(0.99)

    @pytest.mark.asyncio
    async def test_question_fields_mapped_correctly(self, service):
        bank_topic_map = {"recursive algorithms": ("recursion", 0.95)}
        doc = make_question_doc("q42", "recursive algorithms", "hard",
                                text="What is the base case?", marks=3)
        service.db["questions"].aggregate = MagicMock(return_value=async_iter([doc]))

        questions = await service._fetch_questions(bank_topic_map, "hard", 3)

        q = questions[0]
        assert q.question_id == "q42"
        assert q.question_text == "What is the base case?"
        assert q.marks == 3
        assert q.difficulty == "hard"

    @pytest.mark.asyncio
    async def test_empty_pipeline_result_returns_empty_list(self, service):
        bank_topic_map = {"recursive algorithms": ("recursion", 0.95)}
        service.db["questions"].aggregate = MagicMock(return_value=async_iter([]))

        questions = await service._fetch_questions(bank_topic_map, "medium", 3)
        assert questions == []


# ── Full match() pipeline ─────────────────────────────────────────────────────

class TestFullMatch:

    @pytest.mark.asyncio
    async def test_empty_weak_topics_returns_empty_response(self, service):
        req = make_request([])
        result = await service.match(req)
        assert result.total_questions == 0
        assert result.matched_questions == []

    @pytest.mark.asyncio
    async def test_empty_question_bank_returns_all_unmatched(self, service):
        service._fetch_distinct_topics = AsyncMock(return_value=[])
        req = make_request(["recursion"])
        result = await service.match(req)
        assert "recursion" in result.unmatched_weak_topics

    @pytest.mark.asyncio
    async def test_matched_questions_returned(self, service):
        service._fetch_distinct_topics = AsyncMock(
            return_value=["recursive algorithms", "databases"]
        )
        service._fetch_questions = AsyncMock(return_value=[
            make_matched_question("q1", "recursive algorithms", "recursion", 0.99)
        ])
        req = make_request(["recursion"])
        result = await service.match(req)
        assert result.total_questions == 1
        assert result.matched_questions[0].question_id == "q1"

    @pytest.mark.asyncio
    async def test_unmatched_topics_listed(self, service):
        service._fetch_distinct_topics = AsyncMock(
            return_value=["recursive algorithms"]
        )
        service._fetch_questions = AsyncMock(return_value=[])
        # "databases" has zero cosine similarity with "recursive algorithms"
        req = make_request(["databases"], threshold=0.60)
        result = await service.match(req)
        assert "databases" in result.unmatched_weak_topics

    @pytest.mark.asyncio
    async def test_similarity_threshold_stored_in_response(self, service):
        service._fetch_distinct_topics = AsyncMock(return_value=[])
        req = make_request(["recursion"], threshold=0.75)
        result = await service.match(req)
        assert result.similarity_threshold_used == 0.75

    @pytest.mark.asyncio
    async def test_weak_topics_normalised_before_encoding(self, service):
        """
        Spaces and capitalisation must be stripped before encoding.
        Provide a real bank topic so the service does not return early —
        it only calls encode() when there are bank topics to compare against.
        """
        service._fetch_distinct_topics = AsyncMock(
            return_value=["recursive algorithms"]
        )
        service._fetch_questions = AsyncMock(return_value=[])
        req = make_request(["  RECURSION  "])
        result = await service.match(req)
        assert result.weak_topics_received[0] == "  RECURSION  "
        first_call_texts = service._model.encode.call_args_list[0][0][0]
        assert first_call_texts == ["recursion"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def cosine_similarity_val(a: str, b: str) -> float:
    from sklearn.metrics.pairwise import cosine_similarity
    ea = fake_encode([a])
    eb = fake_encode([b])
    return float(cosine_similarity(ea, eb)[0][0])


def make_question_doc(qid, topic, difficulty, text="Question text?", marks=1):
    return {
        "_id":           qid,
        "topic":         topic,
        "sub_topic":     None,
        "difficulty":    difficulty,
        "question_text": text,
        "options":       ["A", "B", "C", "D"],
        "correct_answer": "A",
        "marks":         marks,
    }


def make_matched_question(qid, topic, weak_topic, score):
    from src.schemas.topic_matcher import MatchedQuestion
    return MatchedQuestion(
        question_id=qid,
        topic=topic,
        difficulty="medium",
        question_text="Sample?",
        options=[],
        marks=1,
        matched_from_weak_topic=weak_topic,
        similarity_score=score,
    )


class async_iter:
    """Minimal async iterable that wraps a plain list, mimicking Motor cursors."""
    def __init__(self, items):
        self._items = items

    def __aiter__(self):
        return self

    async def __anext__(self):
        if not self._items:
            raise StopAsyncIteration
        return self._items.pop(0)

    async def to_list(self, length=None):
        return self._items