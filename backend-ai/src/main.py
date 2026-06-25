from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os

load_dotenv()

from src.routes import analytics, assignments

app = FastAPI(
    title="CIRA AI Telemetry Service",
    description="Mathematical foundation and predictive telemetry service",
    version="1.0.0"
)

# Configure CORS for integration with other microservices/frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(assignments.router, prefix="/api/v1/assignments", tags=["Assignments"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "backend-ai"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
