"""
routes/assignments.py
──────────────────────
Two endpoints:
  POST /assignments/generate      → streams the PDF directly
  POST /assignments/generate/meta → returns only the JSON metadata (no PDF)

The split is useful because backend-core often needs to store the metadata
(question count, marks, topics) before letting the student download the PDF.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
import io

from ..schemas.assignment import AssignmentRequest, AssignmentMeta
from ..services.assignment_service import AssignmentService
from ..dependencies import get_assignment_service

router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.post(
    "/generate",
    summary="Generate adaptive assignment PDF and stream it",
    response_class=StreamingResponse,
)
async def generate_assignment(
    request: AssignmentRequest,
    service: AssignmentService = Depends(get_assignment_service),
) -> StreamingResponse:
    """
    Generates the PDF and returns it as a binary stream.
    The browser / client receives a file download directly.

    frontend-web calls this and sets:
      <a href="..." download="assignment.pdf">Download Assignment</a>
    """
    try:
        pdf_bytes, meta = service.generate(request)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF generation failed: {exc}",
        )

    return StreamingResponse(
        content=io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{meta.pdf_filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router.post(
    "/generate/meta",
    response_model=AssignmentMeta,
    summary="Generate PDF and return only the metadata as JSON",
)
async def generate_assignment_meta(
    request: AssignmentRequest,
    service: AssignmentService = Depends(get_assignment_service),
) -> AssignmentMeta:
    """
    Same generation pipeline, but returns only the JSON metadata.
    backend-core calls this to persist the assignment record in PostgreSQL
    before the student actually downloads the file.
    """
    try:
        _, meta = service.generate(request)
        return meta
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assignment metadata generation failed: {exc}",
        )