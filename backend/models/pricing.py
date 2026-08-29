"""AI pricing request model."""
from pydantic import BaseModel


class PricingSuggestionRequest(BaseModel):
    follower_count: int
    engagement_rate: float
    platform: str
    content_type: str
