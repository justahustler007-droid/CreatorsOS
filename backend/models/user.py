"""User, session, profile & paywall models."""
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    early_access: bool = False
    onboarding_complete: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreatorProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    creator_name: str
    bio: Optional[str] = None
    youtube_link: Optional[str] = None
    instagram_handle: Optional[str] = None
    follower_count: int = 0
    niche: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    detected_platform: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreatorProfileCreate(BaseModel):
    creator_name: str
    bio: Optional[str] = None
    youtube_link: Optional[str] = None
    instagram_handle: Optional[str] = None
    follower_count: int = 0
    niche: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None


class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AccessCodeRequest(BaseModel):
    code: str
