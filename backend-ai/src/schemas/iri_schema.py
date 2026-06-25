from pydantic import BaseModel, Field, model_validator
from typing import List

class Weights(BaseModel):
    w1: float = Field(..., ge=0.0, le=1.0, description="Weight for initial and final assessments")
    w2: float = Field(..., ge=0.0, le=1.0, description="Weight for weekly quizzes")
    w3: float = Field(..., ge=0.0, le=1.0, description="Weight for faculty scores")

class ScoreItem(BaseModel):
    score: float = Field(..., ge=0.0, le=100.0)
    topic: str
    sub_division: str

class IRIRequest(BaseModel):
    weights: Weights
    initial_assessment: float = Field(..., ge=0.0, le=100.0)
    final_assessment: float = Field(..., ge=0.0, le=100.0)
    weekly_quizzes: List[ScoreItem] = []
    faculty_scores: List[ScoreItem] = []

    @model_validator(mode='after')
    def validate_weights_sum(self):
        total_weight = self.weights.w1 + self.weights.w2 + self.weights.w3
        # Use a small tolerance for floating point arithmetic
        if abs(total_weight - 1.0) > 1e-5:
            raise ValueError(f"The sum of weights must equal 1.0. Current sum: {total_weight}")
        return self

class DiagnosticFlag(BaseModel):
    topic: str
    sub_division: str
    average_score: float
    source: str

class IRIResponse(BaseModel):
    iri_score: float
    tier: str
    diagnostic_flags: List[DiagnosticFlag]
