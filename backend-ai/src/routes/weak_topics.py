"""
routes/weak_topic.py
─────────────────────
Exposes the weak topic detection endpoint.
Called internally by backend-core after a student submits an exam.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas.weak_topic import WeakTopicRequest, WeakTopicResponse
from ..services.weak_topic_service import WeakTopicService
from ..dependencies import get_weak_topic_service

router = APIRouter(prefix="/weak-topics", tags=["Weak Topics"])


@router.post(
    "/detect",
    response_model=WeakTopicResponse,
    summary="Detect weak topics for a student from their exam results",
)
async def detect_weak_topics(
    request: WeakTopicRequest,
    service: WeakTopicService = Depends(get_weak_topic_service),
) -> WeakTopicResponse:
    """
    Called by backend-core right after exam submission.

    Returns:
    - weak_topics       : flat list of topic names to feed into assignment_service
    - topic_summaries   : full per-topic breakdown with scores and cluster info
    - method_used       : 'clustering' (≥3 topics) or 'threshold' (fallback)
    - weak_count        : number of weak topics found
    - total_topics      : total distinct topics attempted
    """
    try:
        return await service.detect(request.student_id, request.exam_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Weak topic detection failed: {exc}",
        )