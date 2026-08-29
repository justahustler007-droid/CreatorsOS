"""AI-powered endpoints — pricing + pitch generation."""
from fastapi import APIRouter, Depends, HTTPException

from database import db
from deps import get_current_user
from models import PricingSuggestionRequest
from services.pricing_service import generate_pitch, suggest_brand_deal_price

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/pricing-suggestion")
async def get_pricing_suggestion(
    data: PricingSuggestionRequest,
    user: dict = Depends(get_current_user),
):
    return await suggest_brand_deal_price(data, user["user_id"])


@router.post("/generate-pitch")
async def generate_pitch_for_brand(
    payload: dict,
    user: dict = Depends(get_current_user),
):
    """Generate a personalized outreach pitch for a brand.

    Payload: {"brand_id": "...", "context": "optional extra context"}
    """
    brand_id = payload.get("brand_id")
    if not brand_id:
        raise HTTPException(status_code=400, detail="brand_id required")

    brand = await db.brands.find_one({"brand_id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    profile = await db.creator_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    return await generate_pitch(user["user_id"], profile, brand, payload.get("context"))
