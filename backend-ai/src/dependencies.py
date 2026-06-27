"""
dependencies.py
────────────────
FastAPI dependency functions.
Add new service dependencies here as you build nlp_service and assignment_service.
"""

from motor.motor_asyncio import AsyncIOMotorClient,  AsyncIOMotorDatabase
from src.config import settings
from functools import lru_cache
import os
from .services.topic_matcher_service import TopicMatcherService
from .services.analytics_service import AnalyticsService

# ── MongoDB client (created once, reused for all requests) ────────────────────

@lru_cache
def _get_mongo_client() -> AsyncIOMotorClient:
    uri = os.environ["MONGO_URI"]          # e.g. mongodb://localhost:27017
    return AsyncIOMotorClient(uri)

def get_client() -> AsyncIOMotorClient:
    """
    Returns the Motor client singleton.
    Creates it on first call with a 5s server selection timeout
    so the app fails fast if MongoDB is unreachable on startup.
    """
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=5000,
        )
    return _client
 
 
def get_db() -> AsyncIOMotorDatabase:
    """
    Returns the cira-exams database handle.
    Always backed by the same Motor client singleton.
    """
    return get_client()["cira-exams"]


# ── Service dependencies ──────────────────────────────────────────────────────

def get_analytics_service() -> AnalyticsService:
    """
    Inject AnalyticsService into route handlers.
    Usage in a route:  service: AnalyticsService = Depends(get_analytics_service)
    """
    return AnalyticsService(db=get_db())

def get_weak_topic_service() -> WeakTopicService:
    """
    Inject WeakTopicService into route handlers.
    Usage in a route:  service: WeakTopicService = Depends(get_weak_topic_service)
    """
    return WeakTopicService(db=get_db())

def get_department_service() -> DepartmentService:
    """
    Inject DepartmentService into route handlers.
    Usage in a route:  service: DepartmentService = Depends(get_department_service)
    """
    return DepartmentService(db=get_db())

def get_topic_matcher_service() -> TopicMatcherService:
    """
    Inject TopicMatcherService into route handlers.
    The sentence-transformer model is lazy-loaded on first request
    and cached on the service instance for the lifetime of the worker.
    """
    return TopicMatcherService(db=get_db())