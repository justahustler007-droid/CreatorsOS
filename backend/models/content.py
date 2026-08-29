"""Content revenue models."""
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel, ConfigDict, Field


class ContentRevenue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    content_id: str = Field(default_factory=lambda: f"content_{uuid.uuid4().hex[:12]}")
    user_id: str
    platform: str
    content_type: str
    views: int
    engagement_rate: float
    revenue: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ContentRevenueCreate(BaseModel):
    platform: str
    content_type: str
    views: int
    engagement_rate: float
    revenue: float
