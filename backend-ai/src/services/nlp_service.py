"""
services/nlp_service.py
────────────────────────
Two capabilities built on the same sentence-transformer model:

  1. Subjective answer grading
     Encodes a student's answer and a faculty-supplied model answer,
     computes cosine similarity, and maps it to marks and a feedback
     string using configurable tolerance bands.

  2. Plagiarism detection
     Encodes all student answers to the same question, builds a
     pairwise cosine similarity matrix, and flags any pair that
     exceeds the similarity threshold.

Why sentence-transformers for both?
────────────────────────────────────
Both tasks reduce to the same question: "how semantically similar are
these two texts?"  The same model handles both without needing a
separate grading model or a separate plagiarism detector.

Model: all-MiniLM-L6-v2 (80 MB, fast on CPU, accurate on short text)

Model singleton
───────────────
The model is stored at module level (_MODEL) so it is initialised once
per Python process, not once per FastAPI request.  NLPService reads it
via _get_model(), which lazy-loads on the first call.
"""

from __future__ import annotations

from typing import List, Tuple
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from ..schemas.nlp import (
    GradeRequest, GradeResponse, GradeResult,
    PlagiarismRequest, PlagiarismResponse, PlagiarismFlag,
    StudentAnswer,
)

MODEL_NAME = "all-MiniLM-L6-v2"

# ── Module-level model singleton ──────────────────────────────────────────────
# Stored here so the ~1-second initialisation happens once per worker process,
# regardless of how many NLPService instances FastAPI creates.
_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer
        _MODEL = SentenceTransformer(MODEL_NAME)
    return _MODEL


# ── Grade tolerance bands ─────────────────────────────────────────────────────
# Each entry: (min_similarity, marks_fraction, band_label, feedback_template)
# Bands are checked top-to-bottom; first match wins.
GRADE_BANDS: List[Tuple[float, float, str, str]] = [
    (0.85, 1.00, "Excellent",    "Your answer aligns closely with the model answer."),
    (0.70, 0.80, "Good",         "Your answer captures the main concepts well."),
    (0.55, 0.50, "Partial",      "Your answer touches on some key points but lacks depth."),
    (0.40, 0.25, "Minimal",      "Your answer shows basic understanding but misses key ideas."),
    (0.00, 0.00, "Insufficient", "Your answer does not sufficiently address the question."),
]

# Plagiarism severity thresholds
SEVERITY_HIGH   = 0.97
SEVERITY_MEDIUM = 0.92   # == default PlagiarismRequest.similarity_threshold


# ── Service ───────────────────────────────────────────────────────────────────

class NLPService:
    """
    Stateless — no DB access.  All text arrives in the request body.
    Injected per-request via FastAPI dependency; model is shared at module level.
    """

    # ── Public: grading ───────────────────────────────────────────────────────

    def grade(self, request: GradeRequest) -> GradeResponse:
        """
        Grade all student answers to one subjective question.

        Steps
        ─────
        1  Encode the model answer once.
        2  Encode all student answers in a single batch call
           (sentence-transformers batches internally for efficiency).
        3  Compute cosine similarity of each student answer to the model answer.
        4  Map each similarity score to marks + feedback via GRADE_BANDS.
        """
        if not request.student_answers:
            return GradeResponse(
                question_id=request.question_id,
                total_students=0,
                results=[],
                model_name=MODEL_NAME,
            )

        model = _get_model()

        # ── Step 1 + 2: encode ────────────────────────────────────────────────
        model_embedding    = model.encode(
            [request.model_answer], convert_to_numpy=True
        )                                          # shape (1, dim)
        student_texts      = [a.answer_text for a in request.student_answers]
        student_embeddings = model.encode(
            student_texts, convert_to_numpy=True, batch_size=32
        )                                          # shape (n, dim)

        # ── Step 3: cosine similarity ─────────────────────────────────────────
        # shape (n, 1)  →  flatten to (n,)
        similarities = cosine_similarity(student_embeddings, model_embedding).flatten()

        # ── Step 4: map to grade bands ────────────────────────────────────────
        results = [
            self._grade_one(answer, float(sim), request.max_marks)
            for answer, sim in zip(request.student_answers, similarities)
        ]

        return GradeResponse(
            question_id=request.question_id,
            total_students=len(results),
            results=results,
            model_name=MODEL_NAME,
        )

    # ── Public: plagiarism detection ──────────────────────────────────────────

    def detect_plagiarism(self, request: PlagiarismRequest) -> PlagiarismResponse:
        """
        Detect plagiarism across all submitted answers to one question.

        Steps
        ─────
        1  Encode all student answers in a single batch.
        2  Build an (n × n) pairwise cosine similarity matrix.
        3  Scan the upper triangle (avoids duplicates and self-comparisons).
        4  Flag any pair whose similarity ≥ threshold.
        5  Sort flagged pairs by similarity descending so the worst cases
           appear first in the faculty report.
        """
        model = _get_model()
        answers = request.student_answers
        n = len(answers)

        # ── Step 1 ────────────────────────────────────────────────────────────
        texts      = [a.answer_text for a in answers]
        embeddings = model.encode(texts, convert_to_numpy=True, batch_size=32)

        # ── Step 2 ────────────────────────────────────────────────────────────
        sim_matrix = cosine_similarity(embeddings)          # (n, n)

        # ── Step 3 + 4 ────────────────────────────────────────────────────────
        flagged: List[PlagiarismFlag] = []
        for i in range(n):
            for j in range(i + 1, n):                      # upper triangle only
                score = float(sim_matrix[i][j])
                if score >= request.similarity_threshold:
                    flagged.append(PlagiarismFlag(
                        student_id_1=answers[i].student_id,
                        student_id_2=answers[j].student_id,
                        similarity_score=round(score, 4),
                        severity=self._severity(score),
                    ))

        # ── Step 5 ────────────────────────────────────────────────────────────
        flagged.sort(key=lambda f: f.similarity_score, reverse=True)

        return PlagiarismResponse(
            question_id=request.question_id,
            total_students_checked=n,
            flagged_pairs=flagged,
            plagiarism_detected=len(flagged) > 0,
            threshold_used=request.similarity_threshold,
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _grade_one(
        answer: StudentAnswer,
        similarity: float,
        max_marks: int,
    ) -> GradeResult:
        """
        Map a single cosine similarity score to marks + feedback.

        The tolerance bands in GRADE_BANDS are checked top-to-bottom;
        the first band whose min_similarity threshold is met wins.
        Marks are rounded to 1 decimal place to allow partial credit.
        """
        for min_sim, marks_fraction, band, feedback in GRADE_BANDS:
            if similarity >= min_sim:
                marks = round(marks_fraction * max_marks, 1)
                return GradeResult(
                    student_id=answer.student_id,
                    marks_awarded=marks,
                    max_marks=max_marks,
                    similarity_score=round(similarity, 4),
                    grade_band=band,
                    feedback=feedback,
                )

        # Unreachable — GRADE_BANDS covers 0.0 — but keeps the type-checker happy
        return GradeResult(
            student_id=answer.student_id,
            marks_awarded=0.0,
            max_marks=max_marks,
            similarity_score=round(similarity, 4),
            grade_band="Insufficient",
            feedback=GRADE_BANDS[-1][3],
        )

    @staticmethod
    def _severity(score: float) -> str:
        if score >= SEVERITY_HIGH:
            return "High"
        return "Medium"