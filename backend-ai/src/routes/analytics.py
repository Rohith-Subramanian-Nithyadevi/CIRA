from fastapi import APIRouter, HTTPException
from src.schemas.iri_schema import IRIRequest, IRIResponse
from src.services.analytics_service import calculate_iri

router = APIRouter()

@router.post("/calculate-iri", response_model=IRIResponse, status_code=200)
async def compute_iri(request: IRIRequest):
    """
    Computes the Industry Readiness Index (IRI) based on assessment, quiz, and faculty scores.
    Returns the final IRI score, tier, and a list of diagnostic flags for topics < 60%.
    """
    try:
        response = calculate_iri(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
