"""Outreach / pitch tracking models."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

OUTREACH_STATUSES = ["pending", "sent", "viewed", "replied", "negotiating", "closed_won", "closed_lost"]


class Outreach(BaseModel):
    """A pitch a creator has drafted/sent toward a brand."""
    model_config = ConfigDict(extra="ignore")
    outreach_id: str = Field(default_factory=lambda: f"out_{uuid.uuid4().hex[:12]}")
    user_id: str
    brand_id: str
    brand_name: str            # denormalized for fast lists
    subject: str
    body: str
    status: str = "pending"
    estimated_value: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class OutreachCreate(BaseModel):
    brand_id: str
    subject: str
    body: str
    estimated_value: Optional[int] = None


class OutreachStatusUpdate(BaseModel):
    status: str
