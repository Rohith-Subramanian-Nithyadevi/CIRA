"""
schemas/department.py
──────────────────────
Pydantic models for department-level IRI aggregation.
"""

from pydantic import BaseModel, Field
from typing import List


class DepartmentReadinessRequest(BaseModel):
    """What backend-core sends — just the department id."""
    department_id: str


class StudentIRISummary(BaseModel):
    """
    One row per student inside the department response.
    Gives the frontend enough data to render a per-student chart
    without a second round-trip.
    """
    student_id: str
    iri_score: float = Field(..., description="Cohort-normalised IRI (0–100)")
    readiness_band: str
    weak_topic_count: int


class ReadinessBandCount(BaseModel):
    """How many students fell into each readiness band."""
    band: str
    count: int
    percentage: float = Field(..., description="Rounded to one decimal place")


class DepartmentReadinessResponse(BaseModel):
    """
    Full department-level aggregate returned to backend-core.
    backend-core stores this and serves it to the admin/faculty dashboards.
    """
    department_id: str
    student_count: int

    # ── Central tendency ──────────────────────────────────────────────────────
    average_iri: float
    median_iri: float
    std_deviation: float

    # ── Spread ────────────────────────────────────────────────────────────────
    min_iri: float
    max_iri: float
    percentile_25: float
    percentile_75: float

    # ── Categorical breakdown ─────────────────────────────────────────────────
    readiness_band_distribution: List[ReadinessBandCount]

    # ── Topic signals — fed to assignment generation ──────────────────────────
    top_weak_topics: List[str] = Field(
        ..., description="Topics most students struggled with — up to 5"
    )
    top_strong_topics: List[str] = Field(
        ..., description="Topics most students excelled at — up to 5"
    )

    # ── Per-student breakdown (for charts) ───────────────────────────────────
    student_scores: List[StudentIRISummary]