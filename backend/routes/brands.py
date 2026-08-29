"""Brand discovery + saved brand endpoints."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from deps import get_current_user
from models import SavedBrand, SaveBrandRequest
from services.brand_seed import seed_brands_if_empty
from services.matching_service import rank_brands_for_creator

router = APIRouter(prefix="/brands", tags=["brands"])


async def _ensure_seeded():
    await seed_brands_if_empty()


@router.get("")
async def list_brands(
    user: dict = Depends(get_current_user),
    q: Optional[str] = Query(None, description="Free-text search across name/tags"),
    category: Optional[str] = None,
    region: Optional[str] = None,
    min_budget: Optional[int] = None,
    max_budget: Optional[int] = None,
):
    """Return curated brand directory annotated with match_score + saved flag."""
    await _ensure_seeded()

    mongo_filter = {"active": True}
    if category:
        mongo_filter["category"] = category
    if region:
        mongo_filter["region"] = region
    if min_budget is not None:
        mongo_filter["budget_max"] = {"$gte": min_budget}
    if max_budget is not None:
        mongo_filter.setdefault("budget_min", {})["$lte"] = max_budget
    if q:
        mongo_filter["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]

    brands = await db.brands.find(mongo_filter, {"_id": 0}).to_list(500)

    saved_docs = await db.saved_brands.find(
        {"user_id": user["user_id"]}, {"_id": 0, "brand_id": 1}
    ).to_list(500)
    saved_ids = {s["brand_id"] for s in saved_docs}

    profile = await db.creator_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}

    return rank_brands_for_creator(brands, profile, saved_ids)


@router.get("/{brand_id}")
async def get_brand(brand_id: str, user: dict = Depends(get_current_user)):
    await _ensure_seeded()
    brand = await db.brands.find_one({"brand_id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    saved = await db.saved_brands.find_one(
        {"user_id": user["user_id"], "brand_id": brand_id}, {"_id": 0}
    )
    brand["saved"] = bool(saved)
    if saved:
        brand["notes"] = saved.get("notes")
    return brand


@router.get("/saved/list")
async def list_saved_brands(user: dict = Depends(get_current_user)):
    saved = await db.saved_brands.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    brand_ids = [s["brand_id"] for s in saved]
    brands = await db.brands.find({"brand_id": {"$in": brand_ids}}, {"_id": 0}).to_list(500)
    brand_map = {b["brand_id"]: b for b in brands}

    out = []
    for s in saved:
        b = brand_map.get(s["brand_id"])
        if b:
            out.append({**b, "saved": True, "notes": s.get("notes"), "saved_at": s["created_at"]})
    return out


@router.post("/save")
async def save_brand(data: SaveBrandRequest, user: dict = Depends(get_current_user)):
    brand = await db.brands.find_one({"brand_id": data.brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    existing = await db.saved_brands.find_one(
        {"user_id": user["user_id"], "brand_id": data.brand_id}
    )
    if existing:
        await db.saved_brands.update_one(
            {"user_id": user["user_id"], "brand_id": data.brand_id},
            {"$set": {"notes": data.notes}}
        )
        return {"message": "Brand updated", "saved": True}

    sb = SavedBrand(user_id=user["user_id"], brand_id=data.brand_id, notes=data.notes)
    doc = sb.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.saved_brands.insert_one(doc)
    return {"message": "Brand saved", "saved": True}


@router.delete("/save/{brand_id}")
async def unsave_brand(brand_id: str, user: dict = Depends(get_current_user)):
    result = await db.saved_brands.delete_one(
        {"user_id": user["user_id"], "brand_id": brand_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not saved")
    return {"message": "Brand removed", "saved": False}


@router.get("/meta/filters")
async def get_filter_options(user: dict = Depends(get_current_user)):
    """Return available categories + regions for filter dropdowns."""
    await _ensure_seeded()
    categories = await db.brands.distinct("category", {"active": True})
    regions = await db.brands.distinct("region", {"active": True})
    return {
        "categories": sorted(categories),
        "regions": sorted(regions),
    }
