"""Real creator collaboration network endpoints."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from database import db
from deps import get_current_user
from models import CollabRequest, CollabRequestCreate, CollabStatusUpdate, COLLAB_STATUSES
from services.matching_service import (
    estimate_authentic_audience,
    gradient_for_niche,
    score_creator_compatibility,
)
from services.notification_service import create_notification

router = APIRouter(prefix="/network", tags=["network"])


def _public_creator_view(profile: dict, user_doc: dict) -> dict:
    """Sanitize a creator profile + user doc into a public-facing payload."""
    return {
        "user_id": profile.get("user_id"),
        "creator_name": profile.get("creator_name") or user_doc.get("name") or "Creator",
        "display_name": user_doc.get("name"),
        "picture": user_doc.get("picture"),
        "bio": profile.get("bio"),
        "niche": profile.get("niche"),
        "platform": profile.get("detected_platform"),
        "youtube_link": profile.get("youtube_link"),
        "instagram_handle": profile.get("instagram_handle"),
        "follower_count": profile.get("follower_count") or 0,
        "location": profile.get("address"),
        "fake_follower_risk": estimate_authentic_audience(profile),
        "gradient": gradient_for_niche(profile.get("niche")),
    }


# ─── DISCOVERABILITY TOGGLE ────────────────────────────────────────────────
@router.post("/discoverable")
async def toggle_discoverable(
    user: dict = Depends(get_current_user),
    enabled: bool = Query(True),
):
    """Opt this user's profile in/out of the public discovery directory."""
    await db.creator_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"discoverable": enabled, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"discoverable": enabled}


@router.get("/me/discoverable")
async def get_discoverable(user: dict = Depends(get_current_user)):
    profile = await db.creator_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    ) or {}
    return {"discoverable": profile.get("discoverable", False)}


# ─── DISCOVER CREATORS ─────────────────────────────────────────────────────
@router.get("/discover")
async def discover_creators(
    user: dict = Depends(get_current_user),
    q: Optional[str] = None,
    niche: Optional[str] = None,
    platform: Optional[str] = None,
    sort: str = "compatibility",
):
    """Return discoverable creators (excluding the requester) with compatibility scores."""
    my_profile = await db.creator_profiles.find_one(
        {"user_id": user["user_id"]}, {"_id": 0}
    ) or {}

    mongo_filter = {
        "user_id": {"$ne": user["user_id"]},
        "discoverable": True,
    }
    if niche:
        mongo_filter["niche"] = niche
    if platform:
        mongo_filter["detected_platform"] = platform
    if q:
        mongo_filter["$or"] = [
            {"creator_name": {"$regex": q, "$options": "i"}},
            {"bio": {"$regex": q, "$options": "i"}},
            {"niche": {"$regex": q, "$options": "i"}},
            {"address": {"$regex": q, "$options": "i"}},
        ]

    profiles = await db.creator_profiles.find(mongo_filter, {"_id": 0}).to_list(500)

    user_ids = [p["user_id"] for p in profiles]
    user_docs = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0}).to_list(500)
    user_map = {u["user_id"]: u for u in user_docs}

    # Pre-load my outgoing requests so the UI can render "Sent" instead of "Collab"
    my_outgoing = await db.collab_requests.find(
        {"from_user_id": user["user_id"]}, {"_id": 0}
    ).to_list(500)
    outgoing_map = {r["to_user_id"]: r for r in my_outgoing}

    results = []
    for p in profiles:
        ud = user_map.get(p["user_id"], {})
        public = _public_creator_view(p, ud)
        public["compatibility"] = score_creator_compatibility(my_profile, p)
        req = outgoing_map.get(p["user_id"])
        public["request_status"] = req["status"] if req else None
        public["request_id"] = req["request_id"] if req else None
        results.append(public)

    if sort == "compatibility":
        results.sort(key=lambda x: x["compatibility"], reverse=True)
    elif sort == "followers":
        results.sort(key=lambda x: x["follower_count"], reverse=True)
    elif sort == "trusted":
        results.sort(key=lambda x: x["fake_follower_risk"])

    return results


# ─── COLLAB REQUESTS ──────────────────────────────────────────────────────
@router.post("/requests")
async def send_collab_request(
    data: CollabRequestCreate,
    user: dict = Depends(get_current_user),
):
    if data.to_user_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot collab with yourself")

    target = await db.users.find_one({"user_id": data.to_user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Creator not found")

    existing = await db.collab_requests.find_one(
        {
            "from_user_id": user["user_id"],
            "to_user_id": data.to_user_id,
            "status": {"$in": ["pending", "accepted"]},
        },
        {"_id": 0},
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already requested")

    req = CollabRequest(
        from_user_id=user["user_id"],
        to_user_id=data.to_user_id,
        message=data.message,
    )
    doc = req.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.collab_requests.insert_one(doc)
    doc.pop("_id", None)

    # ── Notify recipient ────────────────────────────────────────────────
    sender_profile = await db.creator_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0}) or {}
    target_profile = await db.creator_profiles.find_one({"user_id": data.to_user_id}, {"_id": 0}) or {}
    sender_name = sender_profile.get("creator_name") or user.get("name") or "A creator"
    compatibility = score_creator_compatibility(target_profile, sender_profile)
    await create_notification(
        data.to_user_id,
        "collab_request_received",
        ctx={
            "from_name": sender_name,
            "from_user_id": user["user_id"],
            "niche": sender_profile.get("niche") or "Creator",
            "compatibility": compatibility,
            "request_id": req.request_id,
        },
    )

    return doc


async def _hydrate_request(req: dict, perspective: str) -> dict:
    """Attach the *other* creator's public profile to a request."""
    other_id = req["to_user_id"] if perspective == "outgoing" else req["from_user_id"]
    profile = await db.creator_profiles.find_one({"user_id": other_id}, {"_id": 0}) or {}
    user_doc = await db.users.find_one({"user_id": other_id}, {"_id": 0}) or {}
    return {**req, "other_creator": _public_creator_view(profile, user_doc)}


@router.get("/requests/incoming")
async def incoming_requests(user: dict = Depends(get_current_user)):
    raw = await db.collab_requests.find(
        {"to_user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [await _hydrate_request(r, "incoming") for r in raw]


@router.get("/requests/outgoing")
async def outgoing_requests(user: dict = Depends(get_current_user)):
    raw = await db.collab_requests.find(
        {"from_user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [await _hydrate_request(r, "outgoing") for r in raw]


@router.put("/requests/{request_id}")
async def update_request_status(
    request_id: str,
    data: CollabStatusUpdate,
    user: dict = Depends(get_current_user),
):
    if data.status not in COLLAB_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    req = await db.collab_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if data.status in ("accepted", "rejected") and req["to_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only recipient can accept/reject")
    if data.status == "cancelled" and req["from_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only sender can cancel")

    await db.collab_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )

    # ── Notify the *other* party of the state change ────────────────────
    if data.status in ("accepted", "rejected"):
        # recipient acted → notify sender
        responder_profile = await db.creator_profiles.find_one(
            {"user_id": req["to_user_id"]}, {"_id": 0}
        ) or {}
        responder_user = await db.users.find_one({"user_id": req["to_user_id"]}, {"_id": 0}) or {}
        responder_name = responder_profile.get("creator_name") or responder_user.get("name") or "A creator"
        ntype = "collab_request_accepted" if data.status == "accepted" else "collab_request_rejected"
        await create_notification(
            req["from_user_id"],
            ntype,
            ctx={"to_name": responder_name, "request_id": request_id},
        )
    elif data.status == "cancelled":
        # sender withdrew → notify recipient
        sender_profile = await db.creator_profiles.find_one(
            {"user_id": req["from_user_id"]}, {"_id": 0}
        ) or {}
        sender_user = await db.users.find_one({"user_id": req["from_user_id"]}, {"_id": 0}) or {}
        sender_name = sender_profile.get("creator_name") or sender_user.get("name") or "A creator"
        await create_notification(
            req["to_user_id"],
            "collab_request_cancelled",
            ctx={"from_name": sender_name, "request_id": request_id},
        )

    return {"message": "Updated", "status": data.status}


# ─── CONNECTIONS ──────────────────────────────────────────────────────────
@router.get("/connections")
async def list_connections(user: dict = Depends(get_current_user)):
    """All creators with whom there is an accepted request, either direction."""
    raw = await db.collab_requests.find(
        {
            "$or": [
                {"from_user_id": user["user_id"]},
                {"to_user_id": user["user_id"]},
            ],
            "status": "accepted",
        },
        {"_id": 0},
    ).to_list(500)

    out = []
    for r in raw:
        other_id = r["to_user_id"] if r["from_user_id"] == user["user_id"] else r["from_user_id"]
        profile = await db.creator_profiles.find_one({"user_id": other_id}, {"_id": 0}) or {}
        user_doc = await db.users.find_one({"user_id": other_id}, {"_id": 0}) or {}
        out.append({**_public_creator_view(profile, user_doc), "since": r["updated_at"]})
    return out


@router.get("/stats")
async def network_stats(user: dict = Depends(get_current_user)):
    """Summary counters for the dashboard widgets."""
    incoming_pending = await db.collab_requests.count_documents(
        {"to_user_id": user["user_id"], "status": "pending"}
    )
    sent = await db.collab_requests.count_documents({"from_user_id": user["user_id"]})
    connections = await db.collab_requests.count_documents(
        {
            "$or": [
                {"from_user_id": user["user_id"]},
                {"to_user_id": user["user_id"]},
            ],
            "status": "accepted",
        }
    )
    return {
        "incoming_pending": incoming_pending,
        "sent_total": sent,
        "connections": connections,
    }
