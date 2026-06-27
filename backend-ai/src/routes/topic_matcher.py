"""
routes/topic_matcher.py
────────────────────────
Single endpoint consumed by assignment_service after weak topic detection.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas.topic_matcher import TopicMatchRequest, TopicMatchResponse
from ..services.topic_matcher_service import TopicMatcherService
from ..dependencies import get_topic_matcher_service

router = APIRouter(prefix="/topic-matcher", tags=["Topic Matcher"])


@router.post(
    "/match",
    response_model=TopicMatchResponse,
    summary="Match weak topic strings to question bank topics using semantic similarity",
)
async def match_topics(
    request: TopicMatchRequest,
    service: TopicMatcherService = Depends(get_topic_matcher_service),
) -> TopicMatchResponse:
    """
    Called by assignment_service with the weak_topics list from weak topic detection.

    Returns matched questions from the bank, each tagged with which
    weak topic triggered its selection and the similarity score.

    Tip: lower similarity_threshold (e.g. 0.50) → more matches but noisier.
         Higher (e.g. 0.75) → precise matches only.
    """
    try:
        return await service.match(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Topic matching failed: {exc}",
        )