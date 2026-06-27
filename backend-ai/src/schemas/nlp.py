"""
schemas/nlp.py
───────────────
Pydantic models for subjective answer grading and plagiarism detection.
"""

from pydantic import BaseModel, Field
from typing import List


# ── Shared sub-model ──────────────────────────────────────────────────────────

class StudentAnswer(BaseModel):
    """One student's written answer to a subjective question."""
    student_id:  str
    answer_text: str


# ── Grading ───────────────────────────────────────────────────────────────────

class GradeRequest(BaseModel):
    """
    Sent by backend-core after students submit subjective answers.
    Batch: send all answers to the same question in one request so the
    model only encodes the model_answer once.
    """
    question_id:     str
    question_text:   str
    model_answer:    str = Field(..., description="The reference/ideal answer set by faculty")
    student_answers: List[StudentAnswer]
    max_marks:       int = Field(10, ge=1)


class GradeResult(BaseModel):
    """Grading outcome for one student."""
    student_id:       str
    marks_awarded:    float = Field(..., description="Marks given (may be fractional)")
    max_marks:        int
    similarity_score: float = Field(..., description="Cosine similarity to model answer (0.0–1.0)")
    grade_band:       str   = Field(..., description="Excellent | Good | Partial | Minimal | Insufficient")
    feedback:         str   = Field(..., description="Human-readable feedback sentence for the student")


class GradeResponse(BaseModel):
    """Full grading result for one question."""
    question_id:    str
    total_students: int
    results:        List[GradeResult]
    model_name:     str = Field(..., description="Sentence-transformer model used")


# ── Plagiarism ────────────────────────────────────────────────────────────────

class PlagiarismRequest(BaseModel):
    """
    Check pairwise similarity across all submitted answers to a question.
    Typically called by faculty after the exam window closes.
    """
    question_id:          str
    student_answers:      List[StudentAnswer] = Field(..., min_length=2)
    similarity_threshold: float = Field(
        0.92,
        ge=0.0,
        le=1.0,
        description="Pairs above this cosine similarity are flagged. "
                    "0.92 is a tight threshold — lower it (e.g. 0.85) "
                    "to cast a wider net.",
    )


class PlagiarismFlag(BaseModel):
    """One flagged pair of student answers."""
    student_id_1:     str
    student_id_2:     str
    similarity_score: float
    severity:         str = Field(..., description="High (≥0.97) | Medium (≥0.92)")


class PlagiarismResponse(BaseModel):
    """Plagiarism detection result for one question."""
    question_id:             str
    total_students_checked:  int
    flagged_pairs:           List[PlagiarismFlag]
    plagiarism_detected:     bool
    threshold_used:          float