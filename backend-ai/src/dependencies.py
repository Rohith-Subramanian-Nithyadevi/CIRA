"""
dependencies.py
────────────────
FastAPI dependency functions.
Add new service dependencies here as you build nlp_service and assignment_service.
"""

from motor.motor_asyncio import AsyncIOMotorClient
from functools import lru_cache
import os

from .services.analytics_service import AnalyticsService

# ── MongoDB client (created once, reused for all requests) ────────────────────

@lru_cache
def _get_mongo_client() -> AsyncIOMotorClient:
    uri = os.environ["MONGO_URI"]          # e.g. mongodb://localhost:27017
    return AsyncIOMotorClient(uri)


def get_db():
    client = _get_mongo_client()
    return client["cira-exams"]            # your DB name from docker-compose


# ── Service dependencies ──────────────────────────────────────────────────────

def get_analytics_service() -> AnalyticsService:
    """
    Inject AnalyticsService into route handlers.
    Usage in a route:  service: AnalyticsService = Depends(get_analytics_service)
    """
    return AnalyticsService(db=get_db())
