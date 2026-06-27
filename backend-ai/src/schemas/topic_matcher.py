"""
schemas/topic_matcher.py
─────────────────────────
Pydantic models for semantic topic matching.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


# ── Request ───────────────────────────────────────────────────────────────────

class TopicMatchRequest(BaseModel):
    """
    Sent by assignment_service after weak topic detection.
    weak_topics comes directly from WeakTopicResponse.weak_topics.
    """
    weak_topics: List[str] = Field(..., description="Output of weak topic detection")
    difficulty: str = Field("medium", pattern="^(easy|medium|hard)$")
    questions_per_topic: int = Field(3, ge=1, le=10)
    similarity_threshold: float = Field(
        0.60,
        ge=0.0,
        le=1.0,
        description="Min cosine similarity to consider a bank topic a match. "
                    "0.60 is a good default — lower = more matches but noisier.",
    )


# ── Internal intermediate types ───────────────────────────────────────────────

class TopicMatch(BaseModel):
    """
    For one weak topic, which question bank topics matched it
    and how similar was the closest one.
    """
    weak_topic: str
    matched_bank_topics: List[str] = Field(
        ..., description="Bank topics above the similarity threshold, best first"
    )
    top_similarity_score: float = Field(
        ..., description="Cosine similarity of the best match (0.0–1.0)"
    )
    has_match: bool


# ── Question shape from MongoDB ───────────────────────────────────────────────

class MatchedQuestion(BaseModel):
    """
    One question from the bank, enriched with which weak topic caused
    it to be selected and how similar that topic match was.
    assignment_service uses this to build the adaptive PDF.
    """
    question_id: str
    topic: str          # the bank topic string as stored in MongoDB
    sub_topic: Optional[str] = None
    difficulty: str
    question_text: str
    options: List[str] = Field(default_factory=list)
    correct_answer: Optional[str] = None
    marks: int = 1

    # Traceability — which weak topic triggered selection of this question
    matched_from_weak_topic: str
    similarity_score: float = Field(..., description="Cosine similarity that caused this match")


# ── Response ──────────────────────────────────────────────────────────────────

class TopicMatchResponse(BaseModel):
    """
    Full response: per-topic match breakdown + the actual questions to use.
    """
    weak_topics_received: List[str]
    topic_matches: List[TopicMatch]
    matched_questions: List[MatchedQuestion]
    total_questions: int
    unmatched_weak_topics: List[str] = Field(
        ..., description="Weak topics for which no bank topic exceeded the threshold"
    )
    similarity_threshold_used: float