"""Content revenue endpoints."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from database import db
from deps import get_current_user
from models import ContentRevenue, ContentRevenueCreate

router = APIRouter(tags=["content"])


@router.get("/content", response_model=List[dict])
async def get_content_revenue(user: dict = Depends(get_current_user)):
    """Get all content revenue records."""
    content = await db.content_revenue.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return content


@router.post("/content")
async def create_content_revenue(content_data: ContentRevenueCreate, user: dict = Depends(get_current_user)):
    """Create a new content revenue record."""
    content = ContentRevenue(
        user_id=user["user_id"],
        platform=content_data.platform,
        content_type=content_data.content_type,
        views=content_data.views,
        engagement_rate=content_data.engagement_rate,
        revenue=content_data.revenue
    )

    doc = content.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.content_revenue.insert_one(doc)
    doc.pop('_id', None)
    return doc


@router.delete("/content/{content_id}")
async def delete_content_revenue(content_id: str, user: dict = Depends(get_current_user)):
    """Delete a content revenue record."""
    result = await db.content_revenue.delete_one({"content_id": content_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"message": "Content deleted"}
