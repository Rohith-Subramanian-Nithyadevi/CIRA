"""
routes/analytics.py
────────────────────
FastAPI router that exposes the IRI analytics endpoints.
These are called internally by backend-core — not directly by the frontend.

Endpoints
─────────
POST /analytics/iri/student       → IRIResponse
POST /analytics/iri/department    → DepartmentIRIResponse
"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas.analytics import (
    DepartmentIRIRequest,
    DepartmentIRIResponse,
    IRIRequest,
    IRIResponse,
)
from ..services.analytics_service import AnalyticsService
from ..dependencies import get_analytics_service   # see note below

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.post(
    "/iri/student",
    response_model=IRIResponse,
    summary="Calculate IRI for a single student",
)
async def calculate_student_iri(
    request: IRIRequest,
    service: AnalyticsService = Depends(get_analytics_service),
) -> IRIResponse:
    """
    Called by backend-core after a student submits an exam.

    Returns:
    - iri_score        : 0–100 industry readiness score
    - readiness_band   : human-readable band label
    - topic_breakdown  : per-topic score + weak flag
    - weak_topics      : list of topics to target with adaptive assignment
    """
    try:
        return await service.calculate_student_iri(request.student_id, request.exam_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"IRI calculation failed: {exc}",
        )


@router.post(
    "/iri/department",
    response_model=DepartmentIRIResponse,
    summary="Aggregate IRI across a whole department",
)
async def calculate_department_iri(
    request: DepartmentIRIRequest,
    service: AnalyticsService = Depends(get_analytics_service),
) -> DepartmentIRIResponse:
    """
    Called by backend-core when faculty or admin request department analytics.

    Scores are MinMaxScaler-normalized across the cohort so faculty can
    see relative performance — not just absolute exam scores.
    """
    try:
        return await service.calculate_department_iri(request.department_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Department IRI calculation failed: {exc}",
        )
