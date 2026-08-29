"""GST-compliant invoice models."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invoice_id: str = Field(default_factory=lambda: f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}")
    user_id: str
    creator_name: str
    creator_address: Optional[str] = None
    creator_gstin: Optional[str] = None
    client_name: str
    client_address: Optional[str] = None
    client_gstin: Optional[str] = None
    invoice_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    description: str
    sac_code: str = "998361"
    taxable_value: float
    cgst_rate: float = 9.0
    sgst_rate: float = 9.0
    igst_rate: float = 0.0
    cgst_amount: float = 0.0
    sgst_amount: float = 0.0
    igst_amount: float = 0.0
    total_tax: float = 0.0
    total_amount: float = 0.0
    status: str = "generated"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InvoiceCreate(BaseModel):
    creator_name: str
    creator_address: Optional[str] = None
    creator_gstin: Optional[str] = None
    client_name: str
    client_address: Optional[str] = None
    client_gstin: Optional[str] = None
    description: str
    sac_code: str = "998361"
    taxable_value: float
    is_igst: bool = False
    gst_rate: float = 18.0
