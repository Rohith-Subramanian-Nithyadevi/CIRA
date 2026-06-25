from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from src.schemas.assignment_schema import AssignmentRequest
from src.services.assignment_service import generate_adaptive_assignment
from src.utils.pdf_generator import generate_assignment_pdf

router = APIRouter()

@router.post("/generate", response_class=StreamingResponse)
async def generate_assignment(request: AssignmentRequest):
    """
    Core adaptive assignment engine endpoint.
    Modulates difficulty, runs semantic matching against DB, and returns a PDF binary payload.
    """
    try:
        # Generate the structured assignment data
        assignment_data = await generate_adaptive_assignment(request)
        
        # Synthesize the PDF
        pdf_buffer = generate_assignment_pdf(assignment_data)
        
        # Return as a downloadable binary payload
        headers = {
            'Content-Disposition': f'attachment; filename="Adaptive_Assignment_{request.student_id}.pdf"'
        }
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
