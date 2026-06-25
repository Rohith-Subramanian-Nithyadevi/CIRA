import io
import hashlib
import time
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.graphics.barcode import code128
from reportlab.lib.enums import TA_CENTER, TA_LEFT

def generate_assignment_pdf(assignment_data: dict) -> io.BytesIO:
    """
    Synthesize an executive-formatted offline PDF document.
    """
    buffer = io.BytesIO()
    
    # Setup document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        fontSize=18,
        spaceAfter=14
    )
    
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Heading2'],
        alignment=TA_CENTER,
        fontSize=12,
        spaceAfter=20,
        textColor='gray'
    )
    
    section_style = ParagraphStyle(
        'SectionStyle',
        parent=styles['Heading3'],
        alignment=TA_LEFT,
        fontSize=14,
        spaceBefore=15,
        spaceAfter=10,
        textColor='darkblue'
    )

    question_style = ParagraphStyle(
        'QuestionStyle',
        parent=styles['Normal'],
        fontSize=11,
        spaceAfter=6
    )

    option_style = ParagraphStyle(
        'OptionStyle',
        parent=styles['Normal'],
        fontSize=10,
        leftIndent=20,
        spaceAfter=4
    )

    elements = []

    # 1. Structural University Header Branding
    elements.append(Paragraph("<b>University Institute of Technology</b>", title_style))
    elements.append(Paragraph("Adaptive Performance Assessment", subtitle_style))
    
    # 2. Encrypted Validation Barcode Token
    student_id = assignment_data.get('student_id', 'unknown')
    timestamp = str(int(time.time()))
    # Hash the student_id and timestamp to create a unique validation token
    raw_token = f"{student_id}_{timestamp}"
    hashed_token = hashlib.sha256(raw_token.encode()).hexdigest()[:12].upper()
    
    barcode = code128.Code128(hashed_token, barHeight=30, barWidth=1.2)
    elements.append(barcode)
    elements.append(Spacer(1, 20))
    
    # Student Info
    elements.append(Paragraph(f"<b>Student ID:</b> {student_id}", styles['Normal']))
    elements.append(Paragraph(f"<b>Difficulty Tier:</b> {assignment_data.get('difficulty', 'Unknown')}", styles['Normal']))
    elements.append(Spacer(1, 20))

    # 3. Questions mapped by explicit sub-topic labels
    questions = assignment_data.get('questions', [])
    
    # Group questions by topic/sub_topic to display explicit headers
    grouped = {}
    for q in questions:
        st = q.get('sub_topics', ['General'])[0]
        if st not in grouped:
            grouped[st] = []
        grouped[st].append(q)

    question_number = 1
    for topic, qs in grouped.items():
        elements.append(Paragraph(f"Topic Focus: {topic.upper()}", section_style))
        
        for q in qs:
            q_text = f"<b>Q{question_number}.</b> {q.get('content', '')}"
            elements.append(Paragraph(q_text, question_style))
            
            options = q.get('options', [])
            labels = ['A', 'B', 'C', 'D', 'E', 'F']
            
            for idx, opt in enumerate(options):
                lbl = labels[idx] if idx < len(labels) else '*'
                elements.append(Paragraph(f"{lbl}) {opt}", option_style))
            
            elements.append(Spacer(1, 10))
            question_number += 1

    # Build the PDF
    doc.build(elements)
    
    # Reset buffer position
    buffer.seek(0)
    return buffer
