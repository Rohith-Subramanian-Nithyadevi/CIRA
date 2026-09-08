"""
src/main.py
────────────
FastAPI application entry point for the CIRA AI service.
All six AI/ML routers are registered here under /api/v1/.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os

load_dotenv()

from src.routes import analytics, assignment, weak_topics, department, topic_matcher, nlp
from src.dependencies import get_db


# ── Lifespan: startup + shutdown ──────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once on startup and once on shutdown.
    Startup: verify MongoDB is reachable before accepting requests.
    Shutdown: close the Motor connection cleanly.
    """
    db = get_db()
    try:
        await db.client.admin.command("ping")
        print("✓ MongoDB connected")
    except Exception as e:
        print(f"✗ MongoDB connection failed: {e}")
        raise

    yield   # ← server runs here

    db.client.close()
    print("✓ MongoDB connection closed")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CIRA AI Service",
    description=(
        "Predictive telemetry and adaptive learning engine for the "
        "College Industry Readiness Assessment platform."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


# ── CORS Hardening (CIRA-002) ────────────────────────────────────────────────
# Avoid wildcard allow_origins with credentials; restrict to explicit local/internal origins
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS")
if allowed_origins_env:
    origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(analytics.router,     prefix="/api/v1/analytics",     tags=["Analytics"])
app.include_router(weak_topics.router,    prefix="/api/v1/weak-topics",    tags=["Weak Topics"])
app.include_router(department.router,    prefix="/api/v1/department",     tags=["Department"])
app.include_router(topic_matcher.router, prefix="/api/v1/topic-matcher",  tags=["Topic Matcher"])
app.include_router(assignment.router,   prefix="/api/v1/assignments",    tags=["Assignments"])
app.include_router(nlp.router,           prefix="/api/v1/nlp",            tags=["NLP"])


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "backend-ai", "version": "1.0.0"}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
