from pydantic import BaseModel, Field
from typing import Dict, List, Optional


# ─── Incoming data shape from MongoDB ────────────────────────────────────────

class QuestionResult(BaseModel):
    """
    Represents a single answered question from a student's exam.
    This is the raw data shape stored in MongoDB after exam submission.
    """
    question_id: str
    topic: str
    sub_topic: Optional[str] = None
    difficulty: str = Field(..., pattern="^(easy|medium|hard)$")
    is_correct: bool


# ─── Request models ───────────────────────────────────────────────────────────

class IRIRequest(BaseModel):
    """Request body for calculating a single student's IRI."""
    student_id: str
    exam_id: str


class DepartmentIRIRequest(BaseModel):
    """Request body for calculating IRI across an entire department."""
    department_id: str


# ─── Response models ──────────────────────────────────────────────────────────

class TopicBreakdown(BaseModel):
    """Per-topic score details returned alongside the IRI."""
    raw_score: float = Field(..., description="0.0 to 1.0 — proportion correct, weighted by difficulty")
    is_weak: bool = Field(..., description="True if raw_score < weak_threshold (default 0.5)")
    questions_attempted: int


class IRIResponse(BaseModel):
    """Full IRI result for one student."""
    student_id: str
    exam_id: str
    iri_score: float = Field(..., description="Final IRI score: 0–100")
    readiness_band: str = Field(..., description="Highly Ready | Industry Ready | Developing | Needs Improvement")
    topic_breakdown: Dict[str, TopicBreakdown]
    weak_topics: List[str] = Field(..., description="Topics where raw_score < weak_threshold")


class DepartmentIRIResponse(BaseModel):
    """Aggregate IRI statistics for an entire department."""
    department_id: str
    student_count: int
    average_iri: float
    std_deviation: float
    min_iri: float
    max_iri: float
    percentile_25: float
    percentile_75: float
    top_weak_topics: List[str] = Field(..., description="Most common weak topics across the department")
