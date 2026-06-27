from dotenv import load_dotenv
load_dotenv()

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from src.routes import department, analytics, assignments, weak_topic
from src.routes import topic_matcher
from src.dependencies import get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup: connect and verify MongoDB is reachable ──────
    db = get_db()
    await db.client.admin.command("ping")
    app.state.db = db
    print("✓ MongoDB connected")
    yield
    # ── Shutdown: close the connection pool ───────────────────
    app.state.db.client.close()
    print("✓ MongoDB connection closed")


app = FastAPI(
    title="CIRA AI Telemetry Service",
    description="Mathematical foundation and predictive telemetry service",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────
# allow_origins="*" and allow_credentials=True cannot coexist
# (browsers reject it). Use explicit origins instead.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        os.environ.get("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(analytics.router,   prefix="/api/v1/analytics",   tags=["Analytics"])
app.include_router(assignments.router, prefix="/api/v1/assignments",  tags=["Assignments"])
app.include_router(weak_topic.router,  prefix="/api/v1/weak-topics",  tags=["Weak Topics"])
app.include_router(department.router,  prefix="/api/v1/department",   tags=["Department"])
app.include_router(topic_matcher.router, prefix="/api/v1/topic-matcher", tags=["Topic Matcher"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "backend-ai"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("ENV", "development") == "development"
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=debug)