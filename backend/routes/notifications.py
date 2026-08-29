"""Notification Center endpoints — list, read, dismiss, digest."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from deps import get_current_user
from models.notification import MarkReadRequest, NOTIFICATION_CATEGORIES
from services.notification_service import build_weekly_digest

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    user: dict = Depends(get_current_user),
    category: Optional[str] = Query(None, description="network | outreach | insights | system"),
    unread_only: bool = False,
    limit: int = 50,
):
    """Return notifications for the current user, newest first."""
    q = {"user_id": user["user_id"]}
    if category:
        q["category"] = category
    if unread_only:
        q["read"] = False

    items = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items


@router.get("/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    """Live badge count for the top-bar bell."""
    total = await db.notifications.count_documents({"user_id": user["user_id"], "read": False})
    by_category = {}
    cursor = db.notifications.aggregate([
        {"$match": {"user_id": user["user_id"], "read": False}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
    ])
    async for row in cursor:
        by_category[row["_id"]] = row["count"]
    return {"total": total, "by_category": by_category}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"read": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"read": True}


@router.post("/read-bulk")
async def mark_read_bulk(data: MarkReadRequest, user: dict = Depends(get_current_user)):
    if not data.notification_ids:
        return {"updated": 0}
    result = await db.notifications.update_many(
        {
            "notification_id": {"$in": data.notification_ids},
            "user_id": user["user_id"],
        },
        {"$set": {"read": True}},
    )
    return {"updated": result.modified_count}


@router.post("/read-all")
async def mark_all_read(
    user: dict = Depends(get_current_user),
    category: Optional[str] = None,
):
    q = {"user_id": user["user_id"], "read": False}
    if category:
        q["category"] = category
    result = await db.notifications.update_many(q, {"$set": {"read": True}})
    return {"updated": result.modified_count}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, user: dict = Depends(get_current_user)):
    result = await db.notifications.delete_one(
        {"notification_id": notification_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"deleted": True}


@router.delete("")
async def clear_all(user: dict = Depends(get_current_user), only_read: bool = True):
    q = {"user_id": user["user_id"]}
    if only_read:
        q["read"] = True
    result = await db.notifications.delete_many(q)
    return {"deleted": result.deleted_count}


@router.post("/digest/weekly")
async def trigger_weekly_digest(user: dict = Depends(get_current_user)):
    """Manually trigger this user's weekly digest (or noop if too recent)."""
    n = await build_weekly_digest(user["user_id"])
    if not n:
        return {"created": False, "reason": "already_sent_this_week"}
    return {"created": True, "notification_id": n.notification_id}
