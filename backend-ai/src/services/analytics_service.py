from src.schemas.iri_schema import IRIRequest, IRIResponse, DiagnosticFlag
from typing import List

def calculate_iri(data: IRIRequest) -> IRIResponse:
    # 1. Assessment average
    assessment_avg = (data.initial_assessment + data.final_assessment) / 2.0

    # 2. Quizzes average
    n = len(data.weekly_quizzes)
    if n > 0:
        quizzes_sum = sum(q.score for q in data.weekly_quizzes)
        quizzes_avg = quizzes_sum / n
    else:
        quizzes_avg = 0.0

    # 3. Faculty scores average
    m = len(data.faculty_scores)
    if m > 0:
        faculty_sum = sum(f.score for f in data.faculty_scores)
        faculty_avg = faculty_sum / m
    else:
        faculty_avg = 0.0

    # 4. Calculate IRI
    iri_score = (
        (data.weights.w1 * assessment_avg) +
        (data.weights.w2 * quizzes_avg) +
        (data.weights.w3 * faculty_avg)
    )

    # Round to 2 decimal places
    iri_score = round(iri_score, 2)

    # 5. Determine tier
    if iri_score > 85.0:
        tier = "Excellent"
    elif 60.0 <= iri_score <= 85.0:
        tier = "Average"
    else:
        tier = "Poor"

    # 6. Aggregate Diagnostic Flags (Averages below 60%)
    diagnostic_flags: List[DiagnosticFlag] = []

    # Helper function to aggregate by topic and sub_division
    def aggregate_and_flag(scores, source_name):
        # dictionary key: (topic, sub_division)
        # value: list of scores
        grouped = {}
        for item in scores:
            key = (item.topic, item.sub_division)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(item.score)
        
        for (topic, sub_div), values in grouped.items():
            avg_score = sum(values) / len(values)
            if avg_score < 60.0:
                diagnostic_flags.append(DiagnosticFlag(
                    topic=topic,
                    sub_division=sub_div,
                    average_score=round(avg_score, 2),
                    source=source_name
                ))

    aggregate_and_flag(data.weekly_quizzes, "Weekly Quiz")
    aggregate_and_flag(data.faculty_scores, "Faculty Score")

    return IRIResponse(
        iri_score=iri_score,
        tier=tier,
        diagnostic_flags=diagnostic_flags
    )
