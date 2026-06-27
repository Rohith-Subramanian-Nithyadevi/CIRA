"""
routes/nlp.py
──────────────
Two endpoints for faculty-facing NLP capabilities.
Both are called by backend-core, never directly by the frontend.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas.nlp import (
    GradeRequest, GradeResponse,
    PlagiarismRequest, PlagiarismResponse,
)
from ..services.nlp_service import NLPService
from ..dependencies import get_nlp_service

router = APIRouter(prefix="/nlp", tags=["NLP"])


@router.post(
    "/grade",
    response_model=GradeResponse,
    summary="Grade subjective answers against a model answer",
)
async def grade_answers(
    request: GradeRequest,
    service: NLPService = Depends(get_nlp_service),
) -> GradeResponse:
    """
    Grades all student answers to one subjective question in a single call.
    Batching answers reduces the number of model encode() calls.

    Returns marks (possibly fractional), a grade band label, and a
    feedback sentence per student.
    """
    try:
        return service.grade(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Grading failed: {exc}",
        )


@router.post(
    "/plagiarism",
    response_model=PlagiarismResponse,
    summary="Detect plagiarism across student answers to one question",
)
async def detect_plagiarism(
    request: PlagiarismRequest,
    service: NLPService = Depends(get_nlp_service),
) -> PlagiarismResponse:
    """
    Computes pairwise cosine similarity across all submitted answers and
    flags any pair above the threshold for faculty review.

    Results are sorted by severity (highest similarity first).
    """
    try:
        return service.detect_plagiarism(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Plagiarism detection failed: {exc}",
        )