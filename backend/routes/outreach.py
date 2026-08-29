"""Outreach (pitch) lifecycle endpoints."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from database import db
from deps import get_current_user
from models import Outreach, OutreachCreate, OutreachStatusUpdate, OUTREACH_STATUSES
from services.notification_service import create_notification

router = APIRouter(prefix="/outreach", tags=["outreach"])


@router.get("")
async def list_outreach(user: dict = Depends(get_current_user)):
    """Return all outreach for the current user, newest first."""
    items = await db.outreach.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("updated_at", -1).to_list(500)
    return items


@router.get("/pipeline")
async def outreach_pipeline(user: dict = Depends(get_current_user)):
    items = await db.outreach.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    pipeline = {s: [] for s in OUTREACH_STATUSES}
    for o in items:
        pipeline.setdefault(o.get("status", "pending"), []).append(o)
    return pipeline


@router.post("")
async def create_outreach(data: OutreachCreate, user: dict = Depends(get_current_user)):
    brand = await db.brands.find_one({"brand_id": data.brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")

    out = Outreach(
        user_id=user["user_id"],
        brand_id=data.brand_id,
        brand_name=brand["name"],
        subject=data.subject,
        body=data.body,
        estimated_value=data.estimated_value,
        status="pending",
    )
    doc = out.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.outreach.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{outreach_id}/status")
async def update_outreach_status(
    outreach_id: str,
    data: OutreachStatusUpdate,
    user: dict = Depends(get_current_user),
):
    if data.status not in OUTREACH_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    existing = await db.outreach.find_one(
        {"outreach_id": outreach_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Outreach not found")

    await db.outreach.update_one(
        {"outreach_id": outreach_id, "user_id": user["user_id"]},
        {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    # ── Notify creator on meaningful brand-side transitions ─────────────
    # We only notify the *creator* (their own pipeline updated). Useful for "I
    # just dragged a card to Replied/Won/etc." reinforcement and for keeping
    # the notification center as the canonical history.
    _NOTIFY_STATUS = {
        "viewed": "outreach_viewed",
        "replied": "outreach_replied",
        "negotiating": "outreach_negotiating",
        "closed_won": "outreach_won",
        "closed_lost": "outreach_lost",
    }
    if existing.get("status") != data.status and data.status in _NOTIFY_STATUS:
        await create_notification(
            user["user_id"],
            _NOTIFY_STATUS[data.status],
            ctx={
                "brand_name": existing.get("brand_name", "a brand"),
                "outreach_id": outreach_id,
                "value_label": (
                    f"₹{existing.get('estimated_value'):,}"
                    if existing.get("estimated_value") else "an undisclosed amount"
                ),
            },
            dedupe_window_minutes=30,
        )

    return {"message": "Status updated", "status": data.status}


@router.delete("/{outreach_id}")
async def delete_outreach(outreach_id: str, user: dict = Depends(get_current_user)):
    result = await db.outreach.delete_one(
        {"outreach_id": outreach_id, "user_id": user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outreach not found")
    return {"message": "Deleted"}


@router.get("/stats")
async def outreach_stats(user: dict = Depends(get_current_user)):
    items = await db.outreach.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(500)
    by_status = {s: 0 for s in OUTREACH_STATUSES}
    for o in items:
        by_status[o.get("status", "pending")] = by_status.get(o.get("status", "pending"), 0) + 1

    response_rate = (
        (by_status["replied"] + by_status["negotiating"] + by_status["closed_won"]) /
        max(sum(by_status.values()), 1)
    ) * 100

    pipeline_value = sum(
        (o.get("estimated_value") or 0)
        for o in items
        if o.get("status") not in ("closed_lost", "pending")
    )

    return {
        "total": sum(by_status.values()),
        "by_status": by_status,
        "response_rate": round(response_rate, 1),
        "pipeline_value": pipeline_value,
    }
