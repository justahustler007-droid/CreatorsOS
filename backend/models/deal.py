"""Brand deal models."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

DEAL_STAGES = ["lead", "negotiating", "confirmed", "content_delivered", "payment_pending", "paid"]


class Deal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    deal_id: str = Field(default_factory=lambda: f"deal_{uuid.uuid4().hex[:12]}")
    user_id: str
    brand_name: str
    platform: str
    deliverable_type: str
    deal_value: float
    stage: str = "lead"
    payment_due_date: Optional[datetime] = None
    contract_url: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DealCreate(BaseModel):
    brand_name: str
    platform: str
    deliverable_type: str
    deal_value: float
    stage: str = "lead"
    payment_due_date: Optional[str] = None
    contract_url: Optional[str] = None
    notes: Optional[str] = None


class DealUpdate(BaseModel):
    brand_name: Optional[str] = None
    platform: Optional[str] = None
    deliverable_type: Optional[str] = None
    deal_value: Optional[float] = None
    stage: Optional[str] = None
    payment_due_date: Optional[str] = None
    contract_url: Optional[str] = None
    notes: Optional[str] = None
