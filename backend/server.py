"""CreatorOS FastAPI application entrypoint."""

import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from database import client
from routes import auth, profile, income, deals, content, invoices, dashboard, ai
from routes import brands, outreach, network
from routes import notifications


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="CreatorOS API",
    version="1.0.0",
)

api_router = APIRouter(
    prefix="/api"
)


# Domain routers
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(income.router)
api_router.include_router(deals.router)
api_router.include_router(content.router)
api_router.include_router(invoices.router)
api_router.include_router(dashboard.router)
api_router.include_router(ai.router)
api_router.include_router(brands.router)
api_router.include_router(outreach.router)
api_router.include_router(network.router)
api_router.include_router(notifications.router)


@api_router.get("/")
async def root():
    return {
        "message": "CreatorOS API"
    }


@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy"
    }


app.include_router(api_router)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://creatorsos-2.onrender.com",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
