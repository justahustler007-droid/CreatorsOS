"""Brand directory + saved-brand models."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class Brand(BaseModel):
    """A curated brand in the discovery directory."""
    model_config = ConfigDict(extra="ignore")
    brand_id: str = Field(default_factory=lambda: f"brand_{uuid.uuid4().hex[:10]}")
    name: str
    slug: str
    category: str               # e.g. "Beauty", "Tech", "Finance"
    description: str
    website: Optional[str] = None
    instagram: Optional[str] = None
    contact_email: Optional[str] = None
    region: str                 # "India" | "Global" | "USA" | "UK" etc.
    city: Optional[str] = None
    budget_min: int             # in INR
    budget_max: int             # in INR
    fit_niches: List[str] = Field(default_factory=list)
    fit_platforms: List[str] = Field(default_factory=list)
    color: str = "from-slate-700 to-slate-900"   # tailwind gradient
    logo: Optional[str] = None  # single uppercase letter
    tags: List[str] = Field(default_factory=list)
    active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SavedBrand(BaseModel):
    """A creator's bookmark on a brand."""
    model_config = ConfigDict(extra="ignore")
    saved_id: str = Field(default_factory=lambda: f"sb_{uuid.uuid4().hex[:10]}")
    user_id: str
    brand_id: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SaveBrandRequest(BaseModel):
    brand_id: str
    notes: Optional[str] = None
