"""Income models."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class Income(BaseModel):
    model_config = ConfigDict(extra="ignore")
    income_id: str = Field(default_factory=lambda: f"inc_{uuid.uuid4().hex[:12]}")
    user_id: str
    source: str
    platform: str
    amount: float
    date: datetime
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class IncomeCreate(BaseModel):
    source: str
    platform: str
    amount: float
    date: str
    notes: Optional[str] = None
