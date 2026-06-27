from fastapi import FastAPI
from contextlib import asynccontextmanager    
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv
import os

load_dotenv()

from src.routes import analytics, assignments
from src.routes import weak_topic 
from src.dependencies import get_db  

@asynccontextmanager                                          

async def lifespan(app: FastAPI):                             

    # ── Startup: verify MongoDB is reachable ──────────────── 

    db = get_db()                                             

    await db.client.admin.command("ping")                     

    print("✓ MongoDB connected")                              

    yield                                                     

    # ── Shutdown: close the connection ─────────────────────  

    db.client.close()                                         

    print("✓ MongoDB connection closed")   

app = FastAPI(
    title="CIRA AI Telemetry Service",
    description="Mathematical foundation and predictive telemetry service",
    version="1.0.0",
    lifespan=lifespan,    
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
app.include_router(weak_topic.router,  prefix="/api/v1/weak-topics", tags=["Weak Topics"])

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "backend-ai"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
