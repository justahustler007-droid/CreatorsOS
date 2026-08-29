"""Creator-to-creator collaboration request models."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

COLLAB_STATUSES = ["pending", "accepted", "rejected", "cancelled"]


class CollabRequest(BaseModel):
    """A collaboration request between two creators."""
    model_config = ConfigDict(extra="ignore")
    request_id: str = Field(default_factory=lambda: f"collab_{uuid.uuid4().hex[:12]}")
    from_user_id: str
    to_user_id: str
    message: str
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CollabRequestCreate(BaseModel):
    to_user_id: str
    message: str


class CollabStatusUpdate(BaseModel):
    status: str
