"""
routes/department.py
─────────────────────
Two endpoints for department-level IRI aggregation.
Called by backend-core when faculty or admin request the department dashboard.
"""

from fastapi import APIRouter, Depends, HTTPException, status  # type: ignore[import]

from ..schemas.department import DepartmentReadinessRequest, DepartmentReadinessResponse
from ..services.department_service import DepartmentService
from ..dependencies import get_department_service

router = APIRouter(prefix="/department", tags=["Department"])


@router.post(
    "/readiness",
    response_model=DepartmentReadinessResponse,
    summary="Compute department-level IRI aggregates (POST body)",
)
async def department_readiness_post(
    request: DepartmentReadinessRequest,
    service: DepartmentService = Depends(get_department_service),
) -> DepartmentReadinessResponse:
    """
    POST version — used by backend-core when it sends the department_id
    as a JSON body (consistent with the other AI service endpoints).
    """
    try:
        return await service.get_readiness(request.department_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Department readiness computation failed: {exc}",
        )


@router.get(
    "/{department_id}/readiness",
    response_model=DepartmentReadinessResponse,
    summary="Compute department-level IRI aggregates (GET path param)",
)
async def department_readiness_get(
    department_id: str,
    service: DepartmentService = Depends(get_department_service),
) -> DepartmentReadinessResponse:
    """
    GET version — useful for testing directly in /docs or from a browser.
    Same logic as the POST endpoint, just a different way to pass the id.
    """
    try:
        return await service.get_readiness(department_id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Department readiness computation failed: {exc}",
        )