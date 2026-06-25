import logging
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from src.config.db import db

logger = logging.getLogger(__name__)

# Load the lightweight model once at startup (this takes time on the first run)
logger.info("Loading sentence-transformer model: all-MiniLM-L6-v2")
model = SentenceTransformer('all-MiniLM-L6-v2')
logger.info("Model loaded successfully")

async def get_all_db_sub_topics() -> list[str]:
    """Fetch all unique sub_topics from the MongoDB QuestionBank"""
    try:
        sub_topics = await db.questionbanks.distinct("sub_topics")
        return [str(st) for st in sub_topics if st]
    except Exception as e:
        logger.error(f"Failed to fetch sub_topics from DB: {e}")
        return []

async def match_failed_topics_to_db(failed_topics: list[str], threshold: float = 0.5) -> list[str]:
    """
    Uses NLP semantic similarity to map student's failed concepts to actual DB sub-topics.
    """
    db_sub_topics = await get_all_db_sub_topics()
    
    if not db_sub_topics:
        # Fallback if DB is empty or unreachable
        return failed_topics

    matched_sub_topics = set()
    
    # Compute embeddings for the database ontology
    db_embeddings = model.encode(db_sub_topics)
    
    for failed_topic in failed_topics:
        # Encode the student's failed concept
        failed_embedding = model.encode([failed_topic])
        
        # Calculate cosine similarities
        similarities = cosine_similarity(failed_embedding, db_embeddings)[0]
        
        # Find matches above the threshold
        for idx, score in enumerate(similarities):
            if score >= threshold:
                matched_sub_topics.add(db_sub_topics[idx])
                
    # Always include the original failed topics just in case of an exact match 
    # not crossing a threshold or to ensure coverage
    matched_sub_topics.update(failed_topics)
    
    return list(matched_sub_topics)
