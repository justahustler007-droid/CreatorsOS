"""Premium notification copy + creation helper.

Tone guidelines (balanced — mostly calm, occasional insight nudge):
  - No exclamation marks, no emoji in default copy
  - Lead with the fact, then a single sentence of context
  - Insights cite real metrics ("3× more replies", "top 8% of niches")
  - Never address the creator by first name (feels generic at scale)
  - 80 character title cap, 180 character body cap
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from database import db
from models.notification import (
    Notification,
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_TYPES,
)


# ─── COPY LIBRARY ───────────────────────────────────────────────────────────
# Lambdas receive a `ctx` dict and return (title, body, action_label, action_url, priority).

_COPY = {
    "collab_request_received": lambda c: (
        f"Collab request from {c.get('from_name', 'a creator')}",
        f"{c.get('niche', 'Their')} creator with {c.get('compatibility', 0)}% audience overlap. Worth a thoughtful reply.",
        "Open Inbox",
        "/network?tab=inbox",
        "high",
    ),
    "collab_request_accepted": lambda c: (
        f"{c.get('to_name', 'A creator')} accepted your collab",
        "A great match becomes a real connection. Align on goals and timeline while momentum is fresh.",
        "View Connection",
        "/network?tab=connections",
        "high",
    ),
    "collab_request_rejected": lambda c: (
        f"{c.get('to_name', 'A creator')} passed on your collab",
        "No reply needed. Strong creators say no often — that's how they protect their voice. Keep moving.",
        "Find New Creators",
        "/network",
        "low",
    ),
    "collab_request_cancelled": lambda c: (
        f"{c.get('from_name', 'A creator')} withdrew their request",
        "Their pitch is no longer in your inbox. No action required.",
        None,
        "/network?tab=inbox",
        "low",
    ),
    "outreach_viewed": lambda c: (
        f"{c.get('brand_name', 'A brand')} opened your pitch",
        "Most replies arrive within 48h of an open. A short, value-first follow-up doubles your response rate.",
        "View Pipeline",
        "/brand-finder",
        "normal",
    ),
    "outreach_replied": lambda c: (
        f"{c.get('brand_name', 'A brand')} just replied",
        "Pitches answered within 24h convert at roughly 3× the rate of cold leads. Reply with intent.",
        "Open Pipeline",
        "/brand-finder",
        "high",
    ),
    "outreach_negotiating": lambda c: (
        f"Negotiating with {c.get('brand_name', 'a brand')}",
        "Anchor on the value you create, not on a discount. Your audience trust is the premium.",
        "Update Status",
        "/brand-finder",
        "normal",
    ),
    "outreach_won": lambda c: (
        f"Closed: {c.get('brand_name', 'New brand deal')}",
        f"Deal locked at {c.get('value_label', '—')}. Add it to your income tracker — every closed loop sharpens the next pitch.",
        "Log in Income",
        "/income",
        "high",
    ),
    "outreach_lost": lambda c: (
        f"{c.get('brand_name', 'A brand')} passed this time",
        "A no today is data for tomorrow. Adjust the pitch, refine the niche, keep moving.",
        "Refine Pitch",
        "/brand-finder",
        "low",
    ),
    "weekly_digest": lambda c: (
        "Your week in numbers",
        (
            f"{c.get('outreach', 0)} pitches sent · {c.get('replies', 0)} replies · "
            f"{c.get('connections', 0)} new connections · {c.get('earned_label', '₹0')} earned. "
            f"{c.get('insight', 'Momentum is building.')}"
        ),
        "Open Dashboard",
        "/dashboard",
        "normal",
    ),
    "milestone": lambda c: (
        c.get("title") or "Milestone unlocked",
        c.get("body") or "Small wins compound. Keep the streak alive.",
        "View Dashboard",
        "/dashboard",
        "high",
    ),
    "system": lambda c: (
        c.get("title") or "Update from CreatorOS",
        c.get("body") or "Open the app for details.",
        c.get("action_label"),
        c.get("action_url"),
        "normal",
    ),
}


def _format_inr(amount: Optional[int]) -> str:
    if not amount:
        return "—"
    if amount >= 100000:
        return f"₹{amount/100000:.1f}L"
    if amount >= 1000:
        return f"₹{amount/1000:.0f}K"
    return f"₹{amount}"


async def create_notification(
    user_id: str,
    notification_type: str,
    ctx: Optional[Dict[str, Any]] = None,
    dedupe_window_minutes: int = 0,
) -> Optional[Notification]:
    """Create a notification with premium copy from the registry.

    Args:
        user_id: recipient
        notification_type: must be in NOTIFICATION_TYPES
        ctx: dict of context vars consumed by the copy lambda
        dedupe_window_minutes: if >0, skip if an identical (user_id, type, meta.key) was created
                               within the window. Prevents notification spam.

    Returns the created Notification, or None if deduped / invalid.
    """
    if notification_type not in NOTIFICATION_TYPES:
        return None

    ctx = ctx or {}
    builder = _COPY.get(notification_type, _COPY["system"])
    title, body, action_label, action_url, priority = builder(ctx)

    category = NOTIFICATION_CATEGORIES.get(notification_type, "system")

    # ─── Dedupe ─────────────────────────────────────────────────────────────
    if dedupe_window_minutes > 0:
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=dedupe_window_minutes)).isoformat()
        dupe = await db.notifications.find_one(
            {
                "user_id": user_id,
                "type": notification_type,
                "title": title,
                "created_at": {"$gte": cutoff},
            },
            {"_id": 0, "notification_id": 1},
        )
        if dupe:
            return None

    n = Notification(
        user_id=user_id,
        type=notification_type,
        category=category,
        title=title,
        body=body,
        action_label=action_label,
        action_url=action_url,
        priority=priority,
        meta=ctx,
    )
    doc = n.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    return n


# ─── WEEKLY DIGEST BUILDER ──────────────────────────────────────────────────
async def build_weekly_digest(user_id: str) -> Optional[Notification]:
    """Compute last-7-day stats and emit a weekly digest notification.

    Designed to be safe to call any time — dedupes within 6 days so cron / button
    presses don't spam.
    """
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    outreach_sent = await db.outreach.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": cutoff},
        "status": {"$ne": "pending"},
    })
    replies = await db.outreach.count_documents({
        "user_id": user_id,
        "updated_at": {"$gte": cutoff},
        "status": {"$in": ["replied", "negotiating", "closed_won"]},
    })
    connections = await db.collab_requests.count_documents({
        "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}],
        "updated_at": {"$gte": cutoff},
        "status": "accepted",
    })

    # Income — sum of last 7 days
    income_docs = await db.income.find(
        {"user_id": user_id, "date": {"$gte": cutoff[:10]}},
        {"_id": 0, "amount": 1},
    ).to_list(500)
    earned = sum(int(d.get("amount", 0)) for d in income_docs)

    # ── Choose insight by activity profile ─────────────────────────────────
    if outreach_sent == 0 and connections == 0 and earned == 0:
        insight = "A quiet week. One thoughtful pitch tomorrow restarts the loop."
    elif replies >= 3:
        insight = "Reply rate is in the top quartile — keep the cadence."
    elif outreach_sent >= 5 and replies == 0:
        insight = "Volume is strong; refine subject lines and try shorter openings."
    elif connections >= 2:
        insight = "Your network grew this week — those compounds long-term."
    elif earned >= 50000:
        insight = "Solid revenue. Re-invest 10% into the next collab."
    else:
        insight = "Momentum is building. Stay consistent."

    return await create_notification(
        user_id,
        "weekly_digest",
        ctx={
            "outreach": outreach_sent,
            "replies": replies,
            "connections": connections,
            "earned_label": _format_inr(earned),
            "insight": insight,
        },
        dedupe_window_minutes=60 * 24 * 6,  # 6 days
    )
