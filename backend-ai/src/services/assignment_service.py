import random
from src.config.db import db
from src.schemas.assignment_schema import AssignmentRequest
from src.services.nlp_service import match_failed_topics_to_db

async def generate_adaptive_assignment(request: AssignmentRequest):
    """
    Core engine to modulate difficulty and fetch questions.
    """
    # Determine Difficulty Tier
    if request.faculty_override_tier:
        target_difficulty = request.faculty_override_tier
    else:
        # Default AI Mapping
        tier_map = {
            "Poor": "Easy",
            "Average": "Medium",
            "Excellent": "Hard"
        }
        target_difficulty = tier_map.get(request.tier, "Medium")

    # NLP Semantic Match for Sub Topics
    matched_sub_topics = await match_failed_topics_to_db(request.failed_topics)

    # Query QuestionBank
    # Find questions matching the difficulty and containing any of the matched sub_topics
    cursor = db.questionbanks.find({
        "difficulty": target_difficulty,
        "sub_topics": { "$in": matched_sub_topics }
    })
    
    candidate_questions = await cursor.to_list(length=100)

    # If no questions found, fall back to ignoring difficulty constraint to ensure they get something
    if not candidate_questions:
        cursor = db.questionbanks.find({
            "sub_topics": { "$in": matched_sub_topics }
        })
        candidate_questions = await cursor.to_list(length=100)

    # If still empty, fall back to returning completely random questions of the target difficulty
    if not candidate_questions:
        cursor = db.questionbanks.find({
            "difficulty": target_difficulty
        }).limit(20)
        candidate_questions = await cursor.to_list(length=20)

    # Adaptive Sampling: pick up to 3 questions per matched topic logic. 
    # For simplicity, let's just group by sub_topic and pick 3 per sub_topic
    selected_questions = []
    grouped_by_topic = {}
    
    for q in candidate_questions:
        # Just use the first sub_topic for grouping purposes
        st = q.get('sub_topics', ['Unknown'])[0]
        if st not in grouped_by_topic:
            grouped_by_topic[st] = []
        grouped_by_topic[st].append(q)
        
    for st, qs in grouped_by_topic.items():
        # Select up to 3 random questions per sub_topic
        sample_size = min(3, len(qs))
        selected_questions.extend(random.sample(qs, sample_size))

    # Convert MongoDB _id to string
    for q in selected_questions:
        q['_id'] = str(q['_id'])

    return {
        "student_id": request.student_id,
        "difficulty": target_difficulty,
        "topics_covered": matched_sub_topics,
        "questions": selected_questions
    }
