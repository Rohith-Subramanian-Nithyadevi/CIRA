"""
schemas/assignment.py
──────────────────────
Pydantic models for the adaptive PDF assignment generator.
"""

from pydantic import BaseModel, Field
from typing import List, Optional
from ..schemas.topic_matcher import MatchedQuestion


# ── Request ───────────────────────────────────────────────────────────────────

class AssignmentRequest(BaseModel):
    """
    Sent by backend-core after topic matching is complete.
    matched_questions comes directly from TopicMatchResponse.matched_questions.
    """
    student_id:   str
    student_name: str
    department:   str
    exam_id:      str

    matched_questions: List[MatchedQuestion] = Field(
        ..., description="Output of topic_matcher_service — questions to include"
    )
    difficulty_override: Optional[str] = Field(
        None,
        pattern="^(easy|medium|hard)$",
        description="Faculty can override the AI-chosen difficulty for all questions",
    )
    college_name: str = Field("Amrita Vishwa Vidyapeetham", description="Printed in the PDF header")
    max_marks:    Optional[int] = Field(None, description="If set, printed as total marks on cover")


# ── Response metadata ─────────────────────────────────────────────────────────

class AssignmentMeta(BaseModel):
    """
    Returned as a JSON response alongside the PDF download link.
    backend-core stores this so the student can re-download the PDF.
    """
    student_id:        str
    exam_id:           str
    total_questions:   int
    total_marks:       int
    topics_covered:    List[str]
    weak_topics_addressed: List[str]
    difficulty:        str
    pdf_filename:      str