"""Creator profile endpoints."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from database import db
from deps import get_current_user
from models import CreatorProfileCreate

router = APIRouter(tags=["profile"])


# ─── Minimal no-auth profile creation ────────────────────────────────────
# Lightweight `{name, email}` form intended for the Vercel frontend's
# first-touch onboarding (or a public lead-capture mode). Distinct from the
# full authenticated `/profile` endpoint above.

class CreateProfileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr


@router.post("/create-profile")
async def create_minimal_profile(data: CreateProfileRequest):
    """Persist a minimal {name, email} profile. Idempotent by email."""
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.minimal_profiles.find_one({"email": data.email.lower()}, {"_id": 0})
    if existing:
        await db.minimal_profiles.update_one(
            {"email": data.email.lower()},
            {"$set": {"name": data.name, "updated_at": now}},
        )
        return {**existing, "name": data.name, "updated_at": now, "updated": True}

    doc = {
        "profile_id": f"prof_{uuid.uuid4().hex[:12]}",
        "name": data.name,
        "email": data.email.lower(),
        "created_at": now,
    }
    await db.minimal_profiles.insert_one(doc)
    doc.pop("_id", None)
    return {**doc, "created": True}


@router.get("/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    """Get creator profile."""
    profile = await db.creator_profiles.find_one(
        {"user_id": user["user_id"]},
        {"_id": 0}
    )
    return profile


@router.post("/profile")
async def create_or_update_profile(profile_data: CreatorProfileCreate, user: dict = Depends(get_current_user)):
    """Create or update creator profile."""
    detected_platform = None
    if profile_data.youtube_link and profile_data.instagram_handle:
        detected_platform = "both"
    elif profile_data.youtube_link:
        detected_platform = "youtube"
    elif profile_data.instagram_handle:
        detected_platform = "instagram"

    profile_doc = {
        "user_id": user["user_id"],
        **profile_data.model_dump(),
        "detected_platform": detected_platform,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    existing = await db.creator_profiles.find_one({"user_id": user["user_id"]})

    if existing:
        await db.creator_profiles.update_one(
            {"user_id": user["user_id"]},
            {"$set": profile_doc}
        )
    else:
        profile_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.creator_profiles.insert_one(profile_doc)

    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"onboarding_complete": True}}
    )

    result = await db.creator_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return result
