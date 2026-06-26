"""
schemas/weak_topic.py
─────────────────────
Pydantic models for the weak topic detection endpoint.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


class WeakTopicRequest(BaseModel):
    """What backend-core sends us after a student submits an exam."""
    student_id: str
    exam_id: str


class TopicSummary(BaseModel):
    """
    Full breakdown for a single topic.
    Returned alongside the flat weak_topics list so the frontend
    can render a detailed per-topic breakdown if needed.
    """
    topic: str
    score: float = Field(..., description="Simple correct ratio  (0.0–1.0)")
    difficulty_score: float = Field(..., description="Difficulty-weighted correct ratio (0.0–1.0)")
    questions_attempted: int
    hard_ratio: float = Field(..., description="Fraction of questions at hard difficulty")
    is_weak: bool
    cluster_label: Optional[int] = Field(
        None,
        description="KMeans cluster id — only present when clustering method was used"
    )


class WeakTopicResponse(BaseModel):
    """What we return to backend-core."""
    student_id: str
    exam_id: str
    weak_topics: List[str] = Field(..., description="Topics flagged as weak — feed these into assignment_service")
    topic_summaries: List[TopicSummary] = Field(..., description="Full per-topic breakdown")
    method_used: str = Field(..., description="'clustering' (≥3 topics) or 'threshold' (fewer topics)")
    weak_count: int = Field(..., description="Number of weak topics")
    total_topics: int = Field(..., description="Total topics attempted")