"""In-app notification model — premium, intelligent, low-noise."""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


# Centralized type registry so triggers and UI stay aligned.
NOTIFICATION_TYPES = [
    "collab_request_received",
    "collab_request_accepted",
    "collab_request_rejected",
    "collab_request_cancelled",
    "outreach_replied",
    "outreach_viewed",
    "outreach_negotiating",
    "outreach_won",
    "outreach_lost",
    "weekly_digest",
    "milestone",
    "system",
]

# Category groups (drive the filter chips in the UI).
NOTIFICATION_CATEGORIES = {
    "collab_request_received":  "network",
    "collab_request_accepted":  "network",
    "collab_request_rejected":  "network",
    "collab_request_cancelled": "network",
    "outreach_replied":      "outreach",
    "outreach_viewed":       "outreach",
    "outreach_negotiating":  "outreach",
    "outreach_won":          "outreach",
    "outreach_lost":         "outreach",
    "weekly_digest":         "insights",
    "milestone":             "insights",
    "system":                "system",
}

PRIORITIES = ["low", "normal", "high"]


class Notification(BaseModel):
    """A single, deliberate in-app notification.

    Tone: calm, business-focused, occasional insight.
    """
    model_config = ConfigDict(extra="ignore")

    notification_id: str = Field(default_factory=lambda: f"ntf_{uuid.uuid4().hex[:14]}")
    user_id: str
    type: str
    category: str = "system"
    title: str
    body: str
    action_label: Optional[str] = None        # e.g. "Open Inbox"
    action_url: Optional[str] = None          # e.g. "/network?tab=inbox"
    priority: str = "normal"
    read: bool = False
    meta: Dict[str, Any] = Field(default_factory=dict)   # arbitrary context (brand_name, score, etc.)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MarkReadRequest(BaseModel):
    notification_ids: list[str]
