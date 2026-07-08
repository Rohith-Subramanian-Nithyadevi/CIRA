"""
services/assignment_service.py
───────────────────────────────
Generates a formatted, adaptive PDF assignment from matched questions.

PDF layout
──────────
┌─────────────────────────────────────────────┐
│  AMRITA VISHWA VIDYAPEETHAM          [CIRA] │  ← header
│  Adaptive Assignment                         │
├─────────────────────────────────────────────┤
│  Student: Santhosh K  │ Dept: CSE │ Date:…  │  ← student info table
│  Exam ID: exam_001    │ Marks: 30  │         │
├─────────────────────────────────────────────┤
│  TOPIC: Algorithms                           │  ← topic section header
│  (Addressing weak area: recursion)           │
│                                              │
│  Q1. What is the time complexity of…   [2M] │  ← question
│      (A) O(n)    (B) O(n²)                  │
│      (C) O(log n)(D) O(1)                   │
│                                              │
│  Q2. …                                       │
│                                              │
│  TOPIC: Databases                            │  ← next topic section
│  …                                           │
├─────────────────────────────────────────────┤
│  Page 1 of 2                                 │  ← footer
└─────────────────────────────────────────────┘

Design decisions
────────────────
• ReportLab Platypus (high-level) over Canvas (low-level) so we get
  automatic page breaks and flowing text for long question strings.
• Questions grouped by weak topic so students see which area each
  section is targeting — pedagogically clearer than a flat list.
• Returns raw bytes so the route can serve them as StreamingResponse
  without touching the filesystem (no temp files to clean up).
"""

from __future__ import annotations

import io
from collections import defaultdict
from datetime import date
from typing import List, Dict

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..schemas.assignment import AssignmentMeta, AssignmentRequest
from ..schemas.topic_matcher import MatchedQuestion

# ── Colour palette ────────────────────────────────────────────────────────────
MAROON   = colors.HexColor("#8B0000")   # Amrita brand colour
DARK     = colors.HexColor("#1A1A2E")
LIGHT_BG = colors.HexColor("#F5F5F5")
BORDER   = colors.HexColor("#CCCCCC")
WHITE    = colors.white


class AssignmentService:
    """
    Stateless service — no DB needed.
    All question data comes in via AssignmentRequest.matched_questions.
    """

    def generate(self, request: AssignmentRequest) -> tuple[bytes, AssignmentMeta]:
        """
        Entry point. Returns:
          bytes      — raw PDF content for StreamingResponse
          AssignmentMeta — metadata for backend-core to store
        """
        grouped   = self._group_by_weak_topic(request.matched_questions)
        styles    = self._build_styles()
        story     = self._build_story(request, grouped, styles)
        pdf_bytes = self._render(story, request)
        meta      = self._build_meta(request, grouped)
        return pdf_bytes, meta

    # ── Step 1: group questions by weak topic ─────────────────────────────────

    @staticmethod
    def _group_by_weak_topic(
        questions: List[MatchedQuestion],
    ) -> Dict[str, List[MatchedQuestion]]:
        """
        Group questions by the weak topic that triggered their selection.
        Order within each group is preserved (topic_matcher returns best
        matches first, so the most relevant questions appear earliest).
        """
        grouped: Dict[str, List[MatchedQuestion]] = defaultdict(list)
        for q in questions:
            grouped[q.matched_from_weak_topic].append(q)
        return dict(grouped)

    # ── Step 2: build ReportLab story ────────────────────────────────────────

    def _build_story(
        self,
        request: AssignmentRequest,
        grouped:  Dict[str, List[MatchedQuestion]],
        styles:   dict,
    ) -> list:
        """
        Assembles the full list of Platypus flowables that make up the PDF.
        ReportLab renders them top-to-bottom, inserting page breaks as needed.
        """
        story = []

        # ── Header ────────────────────────────────────────────────────────────
        story.append(Paragraph(request.college_name.upper(), styles["college"]))
        story.append(Spacer(1, 0.15 * cm))
        story.append(Paragraph("CIRA — Adaptive Assignment", styles["subtitle"]))
        story.append(HRFlowable(width="100%", thickness=2, color=MAROON, spaceAfter=6))

        # ── Student info table ────────────────────────────────────────────────
        story.append(self._student_table(request, styles))
        story.append(Spacer(1, 0.5 * cm))

        # ── Instructions ──────────────────────────────────────────────────────
        story.append(Paragraph(
            "<b>Instructions:</b> Answer all questions. "
            "Each question carries the marks indicated in [brackets]. "
            "This assignment has been generated to address your identified weak areas.",
            styles["instruction"],
        ))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=10))

        # ── Questions grouped by weak topic ───────────────────────────────────
        q_number = 1
        for weak_topic, questions in grouped.items():
            bank_topic = questions[0].topic if questions else weak_topic
            story += self._topic_section(weak_topic, bank_topic, questions, q_number, styles)
            q_number += len(questions)
            story.append(Spacer(1, 0.4 * cm))

        return story

    def _student_table(self, request: AssignmentRequest, styles: dict) -> Table:
        """Two-column info strip below the header."""
        total_marks = sum(q.marks for q in request.matched_questions)
        if request.max_marks:
            total_marks = request.max_marks

        data = [
            [
                Paragraph(f"<b>Student:</b> {request.student_name}", styles["cell"]),
                Paragraph(f"<b>Date:</b> {date.today().strftime('%d %B %Y')}", styles["cell"]),
            ],
            [
                Paragraph(f"<b>ID:</b> {request.student_id}", styles["cell"]),
                Paragraph(f"<b>Department:</b> {request.department}", styles["cell"]),
            ],
            [
                Paragraph(f"<b>Exam ID:</b> {request.exam_id}", styles["cell"]),
                Paragraph(f"<b>Total Marks:</b> {total_marks}", styles["cell"]),
            ],
        ]
        t = Table(data, colWidths=["50%", "50%"])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
            ("BOX",        (0, 0), (-1, -1), 0.5, BORDER),
            ("INNERGRID",  (0, 0), (-1, -1), 0.25, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ]))
        return t

    def _topic_section(
        self,
        weak_topic: str,
        bank_topic: str,
        questions:  List[MatchedQuestion],
        start_num:  int,
        styles:     dict,
    ) -> list:
        """
        Flowables for one topic group:
          - Section header (bank topic name)
          - Sub-label showing which weak area this targets
          - Numbered questions with MCQ options
        """
        flowables = []

        # Section header
        flowables.append(Paragraph(
            f"TOPIC: {bank_topic.title()}",
            styles["topic_header"],
        ))
        flowables.append(Paragraph(
            f"Addressing identified weak area: <i>{weak_topic}</i>",
            styles["topic_sub"],
        ))
        flowables.append(Spacer(1, 0.25 * cm))

        for i, q in enumerate(questions):
            flowables += self._question_block(q, start_num + i, styles)

        return flowables

    def _question_block(
        self,
        question: MatchedQuestion,
        number:   int,
        styles:   dict,
    ) -> list:
        """
        Flowables for a single question:
          Q{n}. Question text                        [{marks}M]
              (A) Option 1     (B) Option 2
              (C) Option 3     (D) Option 4
        """
        flowables = []

        # Question text row
        q_text = f"<b>Q{number}.</b> {question.question_text}"
        marks_text = f"[{question.marks}M]"

        row = Table(
            [[Paragraph(q_text, styles["q_text"]),
              Paragraph(marks_text, styles["marks"])]],
            colWidths=["88%", "12%"],
        )
        row.setStyle(TableStyle([
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        flowables.append(row)

        # MCQ options in a 2×2 grid (or flat list if ≤2 options)
        opts = question.options
        option_labels = ["(A)", "(B)", "(C)", "(D)", "(E)", "(F)"]
        if opts:
            option_texts = [
                f"{option_labels[j]} {opts[j]}" if j < len(option_labels) else opts[j]
                for j in range(len(opts))
            ]
            if len(option_texts) >= 2:
                pairs = [option_texts[k:k+2] for k in range(0, len(option_texts), 2)]
                opt_data = [
                    [Paragraph(p[0], styles["option"]),
                     Paragraph(p[1] if len(p) > 1 else "", styles["option"])]
                    for p in pairs
                ]
                opt_table = Table(opt_data, colWidths=["50%", "50%"])
                opt_table.setStyle(TableStyle([
                    ("LEFTPADDING",   (0, 0), (-1, -1), 20),
                    ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                    ("TOPPADDING",    (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]))
                flowables.append(opt_table)
            else:
                for ot in option_texts:
                    flowables.append(Paragraph(ot, styles["option"]))

        flowables.append(Spacer(1, 0.3 * cm))
        return flowables

    # ── Step 3: render to bytes ───────────────────────────────────────────────

    def _render(self, story: list, request: AssignmentRequest) -> bytes:
        """
        Feed the Platypus story into a SimpleDocTemplate backed by an
        in-memory BytesIO buffer.  Returns the raw PDF bytes.
        No files are written to disk.
        """
        buffer = io.BytesIO()

        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
            title=f"CIRA Adaptive Assignment — {request.student_name}",
            author="CIRA AI Service",
        )

        def _add_footer(canvas, doc):
            canvas.saveState()
            canvas.setFont("Helvetica", 8)
            canvas.setFillColor(colors.grey)
            canvas.drawString(
                2 * cm, 1.2 * cm,
                "CIRA — College Industry Readiness Assessment | Amrita Vishwa Vidyapeetham",
            )
            canvas.drawRightString(
                A4[0] - 2 * cm, 1.2 * cm,
                f"Page {doc.page}",
            )
            canvas.restoreState()

        doc.build(story, onFirstPage=_add_footer, onLaterPages=_add_footer)
        return buffer.getvalue()

    # ── Step 4: build metadata ────────────────────────────────────────────────

    @staticmethod
    def _build_meta(
        request: AssignmentRequest,
        grouped: Dict[str, List[MatchedQuestion]],
    ) -> AssignmentMeta:
        all_questions  = request.matched_questions
        total_marks    = sum(q.marks for q in all_questions)
        topics_covered = list({q.topic for q in all_questions})
        weak_addressed = list(grouped.keys())
        difficulty     = request.difficulty_override or (
            all_questions[0].difficulty if all_questions else "medium"
        )
        filename = (
            f"CIRA_Assignment_{request.student_id}_{request.exam_id}.pdf"
        )
        return AssignmentMeta(
            student_id=request.student_id,
            exam_id=request.exam_id,
            total_questions=len(all_questions),
            total_marks=total_marks,
            topics_covered=topics_covered,
            weak_topics_addressed=weak_addressed,
            difficulty=difficulty,
            pdf_filename=filename,
        )

    # ── Style registry ────────────────────────────────────────────────────────

    @staticmethod
    def _build_styles() -> dict:
        base = getSampleStyleSheet()
        return {
            "college": ParagraphStyle(
                "college",
                parent=base["Normal"],
                fontSize=14, fontName="Helvetica-Bold",
                textColor=MAROON, alignment=TA_CENTER, spaceAfter=2,
            ),
            "subtitle": ParagraphStyle(
                "subtitle",
                parent=base["Normal"],
                fontSize=10, textColor=DARK,
                alignment=TA_CENTER, spaceAfter=6,
            ),
            "cell": ParagraphStyle(
                "cell", parent=base["Normal"], fontSize=9,
            ),
            "instruction": ParagraphStyle(
                "instruction", parent=base["Normal"],
                fontSize=8.5, textColor=colors.HexColor("#555555"),
                spaceAfter=6,
            ),
            "topic_header": ParagraphStyle(
                "topic_header", parent=base["Normal"],
                fontSize=11, fontName="Helvetica-Bold",
                textColor=WHITE, backColor=MAROON,
                leftIndent=-6, rightIndent=-6,
                spaceBefore=4, spaceAfter=2,
                borderPad=5,
            ),
            "topic_sub": ParagraphStyle(
                "topic_sub", parent=base["Normal"],
                fontSize=8.5, textColor=colors.HexColor("#555555"),
                leftIndent=4, spaceAfter=4,
            ),
            "q_text": ParagraphStyle(
                "q_text", parent=base["Normal"],
                fontSize=10, spaceAfter=2, leading=14,
            ),
            "marks": ParagraphStyle(
                "marks", parent=base["Normal"],
                fontSize=9, fontName="Helvetica-Bold",
                textColor=MAROON, alignment=TA_RIGHT,
            ),
            "option": ParagraphStyle(
                "option", parent=base["Normal"],
                fontSize=9.5, leftIndent=10, spaceAfter=1,
            ),
        }