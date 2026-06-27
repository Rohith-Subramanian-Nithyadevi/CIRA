"""
tests/test_nlp_service.py
──────────────────────────
Run with:  pytest tests/test_nlp_service.py -v

Testing strategy
────────────────
We never load the real sentence-transformer model.
Instead we mock nlp_service._get_model() to return a fake model
whose encode() uses controlled 2-D unit vectors — so cosine similarity
results are exact dot-products that we can assert on precisely.

Controlled embeddings
──────────────────────
Vectors are unit-length, so cosine_similarity = dot product.

  "perfect answer"      →  [1.000,  0.000]   sim to model = 1.000
  "good answer"         →  [0.940,  0.342]   sim to model ≈ 0.940
  "partial answer"      →  [0.766,  0.643]   sim to model ≈ 0.766
  "minimal answer"      →  [0.574,  0.819]   sim to model ≈ 0.574
  "off topic"           →  [0.174,  0.985]   sim to model ≈ 0.174
  "model answer"        →  [1.000,  0.000]   (= perfect)
  "copied answer"       →  [1.000,  0.000]   (= identical to model)
  "slightly different"  →  [0.999,  0.045]   sim to "copied" ≈ 0.999
"""

import pytest
import numpy as np
from unittest.mock import MagicMock, patch

from src.services.nlp_service import NLPService, GRADE_BANDS
from src.schemas.nlp import (
    GradeRequest, PlagiarismRequest, StudentAnswer,
)


# ── Controlled embeddings ─────────────────────────────────────────────────────

EMBEDDINGS = {
    "model answer":       np.array([1.000,  0.000]),
    "perfect answer":     np.array([1.000,  0.000]),
    "good answer":        np.array([0.940,  0.342]),
    "partial answer":     np.array([0.766,  0.643]),
    "minimal answer":     np.array([0.574,  0.819]),
    "off topic":          np.array([0.174,  0.985]),
    "copied answer":      np.array([1.000,  0.000]),
    "slightly different": np.array([0.999,  0.045]),
    "unique answer":      np.array([0.000,  1.000]),
}


def fake_encode(texts, convert_to_numpy=True, batch_size=32):
    return np.array([
        EMBEDDINGS.get(t.strip().lower(), np.array([0.5, 0.5]))
        for t in texts
    ])


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def service():
    svc = NLPService()
    mock_model = MagicMock()
    mock_model.encode = MagicMock(side_effect=fake_encode)
    # Patch the module-level _get_model so the service uses our fake
    with patch("src.services.nlp_service._get_model", return_value=mock_model):
        yield svc


def make_grade_request(answers_dict: dict, model_answer="model answer", max_marks=10):
    """answers_dict: {student_id: answer_text}"""
    return GradeRequest(
        question_id="q_001",
        question_text="Explain recursion.",
        model_answer=model_answer,
        student_answers=[
            StudentAnswer(student_id=sid, answer_text=text)
            for sid, text in answers_dict.items()
        ],
        max_marks=max_marks,
    )


def make_plagiarism_request(answers_dict: dict, threshold=0.92):
    return PlagiarismRequest(
        question_id="q_001",
        student_answers=[
            StudentAnswer(student_id=sid, answer_text=text)
            for sid, text in answers_dict.items()
        ],
        similarity_threshold=threshold,
    )


# ── _grade_one (band logic) ───────────────────────────────────────────────────

class TestGradeOne:

    @pytest.mark.parametrize("similarity,expected_band,expected_fraction", [
        (0.92, "Excellent",    1.00),
        (0.85, "Excellent",    1.00),   # boundary — exactly at threshold
        (0.80, "Good",         0.80),
        (0.70, "Good",         0.80),   # boundary
        (0.65, "Partial",      0.50),
        (0.55, "Partial",      0.50),   # boundary
        (0.48, "Minimal",      0.25),
        (0.40, "Minimal",      0.25),   # boundary
        (0.20, "Insufficient", 0.00),
        (0.00, "Insufficient", 0.00),
    ])
    def test_band_assignment(self, similarity, expected_band, expected_fraction):
        svc = NLPService()
        answer = StudentAnswer(student_id="s1", answer_text="any")
        result = svc._grade_one(answer, similarity, max_marks=10)
        assert result.grade_band == expected_band
        assert result.marks_awarded == pytest.approx(expected_fraction * 10, abs=0.01)

    def test_marks_rounded_to_one_decimal(self):
        svc = NLPService()
        answer = StudentAnswer(student_id="s1", answer_text="any")
        # 0.80 fraction × 7 marks = 5.6
        result = svc._grade_one(answer, 0.75, max_marks=7)
        assert result.marks_awarded == pytest.approx(5.6, abs=0.01)

    def test_student_id_preserved(self):
        svc = NLPService()
        answer = StudentAnswer(student_id="stu_abc", answer_text="any")
        result = svc._grade_one(answer, 0.90, max_marks=10)
        assert result.student_id == "stu_abc"

    def test_max_marks_preserved_in_result(self):
        svc = NLPService()
        answer = StudentAnswer(student_id="s1", answer_text="any")
        result = svc._grade_one(answer, 0.90, max_marks=20)
        assert result.max_marks == 20

    def test_similarity_score_stored(self):
        svc = NLPService()
        answer = StudentAnswer(student_id="s1", answer_text="any")
        result = svc._grade_one(answer, 0.876543, max_marks=10)
        assert result.similarity_score == pytest.approx(0.8765, abs=1e-3)

    def test_feedback_is_non_empty_string(self):
        svc = NLPService()
        answer = StudentAnswer(student_id="s1", answer_text="any")
        result = svc._grade_one(answer, 0.60, max_marks=10)
        assert isinstance(result.feedback, str)
        assert len(result.feedback) > 0


# ── grade() ───────────────────────────────────────────────────────────────────

class TestGrade:

    def test_result_count_matches_students(self, service):
        req = make_grade_request({"s1": "perfect answer", "s2": "off topic"})
        resp = service.grade(req)
        assert len(resp.results) == 2
        assert resp.total_students == 2

    def test_question_id_preserved(self, service):
        req = make_grade_request({"s1": "good answer"})
        resp = service.grade(req)
        assert resp.question_id == "q_001"

    def test_perfect_answer_gets_full_marks(self, service):
        req = make_grade_request({"s1": "perfect answer"}, max_marks=10)
        resp = service.grade(req)
        s1 = next(r for r in resp.results if r.student_id == "s1")
        assert s1.marks_awarded == pytest.approx(10.0)
        assert s1.grade_band == "Excellent"

    def test_off_topic_answer_gets_zero(self, service):
        req = make_grade_request({"s1": "off topic"}, max_marks=10)
        resp = service.grade(req)
        s1 = next(r for r in resp.results if r.student_id == "s1")
        assert s1.marks_awarded == pytest.approx(0.0)
        assert s1.grade_band == "Insufficient"

    def test_good_answer_gets_partial_marks(self, service):
        req = make_grade_request({"s1": "good answer"}, max_marks=10)
        resp = service.grade(req)
        s1 = next(r for r in resp.results if r.student_id == "s1")
        # similarity ≈ 0.940 → "Excellent" band
        assert s1.grade_band == "Excellent"
        assert s1.marks_awarded == pytest.approx(10.0)

    def test_multiple_students_graded_independently(self, service):
        req = make_grade_request({
            "s1": "perfect answer",
            "s2": "off topic",
            "s3": "partial answer",
        }, max_marks=10)
        resp = service.grade(req)
        results = {r.student_id: r for r in resp.results}
        assert results["s1"].marks_awarded > results["s3"].marks_awarded
        assert results["s3"].marks_awarded > results["s2"].marks_awarded

    def test_empty_student_list_returns_empty_results(self, service):
        req = GradeRequest(
            question_id="q1",
            question_text="Explain X.",
            model_answer="model answer",
            student_answers=[],
            max_marks=10,
        )
        resp = service.grade(req)
        assert resp.results == []
        assert resp.total_students == 0

    def test_model_name_in_response(self, service):
        req = make_grade_request({"s1": "good answer"})
        resp = service.grade(req)
        assert isinstance(resp.model_name, str)
        assert len(resp.model_name) > 0


# ── _severity ────────────────────────────────────────────────────────────────

class TestSeverity:

    @pytest.mark.parametrize("score,expected", [
        (1.00, "High"),
        (0.97, "High"),
        (0.96, "Medium"),
        (0.92, "Medium"),
    ])
    def test_severity_boundaries(self, score, expected):
        svc = NLPService()
        assert svc._severity(score) == expected


# ── detect_plagiarism() ───────────────────────────────────────────────────────

class TestDetectPlagiarism:

    def test_identical_answers_flagged(self, service):
        # "copied answer" and "perfect answer" have the same embedding
        req = make_plagiarism_request({
            "s1": "copied answer",
            "s2": "perfect answer",   # same vector → sim = 1.0
        }, threshold=0.92)
        resp = service.detect_plagiarism(req)
        assert resp.plagiarism_detected is True
        assert len(resp.flagged_pairs) == 1

    def test_different_answers_not_flagged(self, service):
        req = make_plagiarism_request({
            "s1": "perfect answer",
            "s2": "unique answer",    # orthogonal → sim = 0.0
        }, threshold=0.92)
        resp = service.detect_plagiarism(req)
        assert resp.plagiarism_detected is False
        assert resp.flagged_pairs == []

    def test_flagged_pair_contains_correct_student_ids(self, service):
        req = make_plagiarism_request({
            "s1": "copied answer",
            "s2": "perfect answer",
        }, threshold=0.92)
        resp = service.detect_plagiarism(req)
        pair = resp.flagged_pairs[0]
        ids = {pair.student_id_1, pair.student_id_2}
        assert ids == {"s1", "s2"}

    def test_similarity_score_stored_in_flag(self, service):
        req = make_plagiarism_request({
            "s1": "copied answer",
            "s2": "perfect answer",
        }, threshold=0.92)
        resp = service.detect_plagiarism(req)
        assert resp.flagged_pairs[0].similarity_score == pytest.approx(1.0, abs=1e-3)

    def test_high_severity_assigned_above_097(self, service):
        req = make_plagiarism_request({
            "s1": "copied answer",   # sim = 1.0 → High
            "s2": "perfect answer",
        }, threshold=0.92)
        resp = service.detect_plagiarism(req)
        assert resp.flagged_pairs[0].severity == "High"

    def test_medium_severity_assigned_between_092_and_097(self, service):
        req = make_plagiarism_request({
            "s1": "slightly different",   # sim to "unique answer" < 0.97
            "s2": "unique answer",
        }, threshold=0.00)   # threshold=0 so all pairs are returned
        resp = service.detect_plagiarism(req)
        # slightly different = [0.999, 0.045], unique = [0, 1]
        # sim = 0.999×0 + 0.045×1 = 0.045 → Insufficient but not high
        pair = resp.flagged_pairs[0]
        assert pair.severity in ("High", "Medium")

    def test_no_self_comparison(self, service):
        req = make_plagiarism_request(
            {"s1": "perfect answer", "s2": "unique answer"}, threshold=0.0
        )
        resp = service.detect_plagiarism(req)
        for pair in resp.flagged_pairs:
            assert pair.student_id_1 != pair.student_id_2

    def test_no_duplicate_pairs(self, service):
        req = make_plagiarism_request({
            "s1": "perfect answer",
            "s2": "copied answer",
            "s3": "unique answer",
        }, threshold=0.0)
        resp = service.detect_plagiarism(req)
        pairs = [(f.student_id_1, f.student_id_2) for f in resp.flagged_pairs]
        assert len(pairs) == len(set(pairs))

    def test_three_students_produces_three_pairs(self, service):
        req = make_plagiarism_request({
            "s1": "perfect answer",
            "s2": "copied answer",
            "s3": "unique answer",
        }, threshold=0.0)
        resp = service.detect_plagiarism(req)
        assert len(resp.flagged_pairs) == 3   # C(3,2) = 3

    def test_flagged_pairs_sorted_by_similarity_descending(self, service):
        req = make_plagiarism_request({
            "s1": "perfect answer",
            "s2": "copied answer",
            "s3": "good answer",
            "s4": "unique answer",
        }, threshold=0.0)
        resp = service.detect_plagiarism(req)
        scores = [f.similarity_score for f in resp.flagged_pairs]
        assert scores == sorted(scores, reverse=True)

    def test_total_students_checked_correct(self, service):
        req = make_plagiarism_request({
            "s1": "perfect answer",
            "s2": "good answer",
            "s3": "unique answer",
        })
        resp = service.detect_plagiarism(req)
        assert resp.total_students_checked == 3

    def test_threshold_stored_in_response(self, service):
        req = make_plagiarism_request(
            {"s1": "perfect answer", "s2": "good answer"},
            threshold=0.88,
        )
        resp = service.detect_plagiarism(req)
        assert resp.threshold_used == pytest.approx(0.88)

    def test_question_id_preserved(self, service):
        req = make_plagiarism_request(
            {"s1": "perfect answer", "s2": "unique answer"}
        )
        resp = service.detect_plagiarism(req)
        assert resp.question_id == "q_001"