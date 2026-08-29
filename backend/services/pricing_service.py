"""AI services: pricing + pitch generation via Gemini.

Standard `google-genai` SDK (works on any deployment — Render, Fly, EC2, etc.).
Gracefully falls back to a heuristic / template when no API key is configured
so the app stays functional offline or for free-tier users.

Required env vars (any ONE is enough):
  - GEMINI_API_KEY          (preferred, from https://aistudio.google.com/apikey)
  - GOOGLE_API_KEY          (alias accepted by the SDK)
  - EMERGENT_LLM_KEY        (legacy — only works inside the Emergent platform broker)
"""
import json
import logging
import os
import re
from typing import Optional

from models import PricingSuggestionRequest

logger = logging.getLogger(__name__)


def _resolve_api_key() -> Optional[str]:
    return (
        os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
        or os.environ.get("EMERGENT_LLM_KEY")
    )


async def _call_gemini(system_message: str, prompt: str) -> Optional[str]:
    """Call Gemini via google-genai. Returns None if SDK / key is unavailable.

    Wrapped in defensive try/except so a missing dep or transient error never
    crashes the request — callers always have a deterministic fallback.
    """
    api_key = _resolve_api_key()
    if not api_key:
        return None
    try:
        from google import genai  # google-genai >= 1.0
        from google.genai import types
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_message,
                temperature=0.7,
            ),
        )
        return response.text
    except Exception as e:
        logger.warning(f"Gemini call failed, using fallback: {e}")
        return None


async def suggest_brand_deal_price(data: PricingSuggestionRequest, user_id: str) -> dict:
    """Suggest INR price range. Heuristic fallback if LLM unavailable."""
    system = (
        "You are a brand deal pricing expert for content creators in India. "
        "Suggest fair INR price ranges based on creator metrics. "
        'Always respond with JSON: {"min_price": number, "max_price": number, "reasoning": "..."}'
    )
    prompt = (
        f"Suggest a brand deal price range for a creator:\n"
        f"- Platform: {data.platform}\n- Content: {data.content_type}\n"
        f"- Followers: {data.follower_count:,}\n- Engagement: {data.engagement_rate}%\n\n"
        'Respond with JSON: {"min_price": number, "max_price": number, "reasoning": "brief"}'
    )
    text = await _call_gemini(system, prompt)
    if text:
        match = re.search(r"\{[^{}]*\}", text)
        if match:
            try:
                result = json.loads(match.group())
                return {
                    "min_price": int(result.get("min_price", 10000)),
                    "max_price": int(result.get("max_price", 50000)),
                    "reasoning": result.get("reasoning", "Based on metrics and market rates."),
                }
            except Exception:
                pass

    # Deterministic heuristic fallback
    base = data.follower_count * 0.01
    mult = 1 + (data.engagement_rate / 10)
    return {
        "min_price": max(5000, int(base * mult * 0.8)),
        "max_price": max(10000, int(base * mult * 1.2)),
        "reasoning": "Estimated from your follower count and engagement rate.",
    }


async def generate_pitch(
    user_id: str,
    creator_profile: dict,
    brand: dict,
    extra_context: Optional[str] = None,
) -> dict:
    """Generate a personalized outreach pitch (subject + body)."""
    name = creator_profile.get("creator_name") or "I"
    niche = creator_profile.get("niche") or "lifestyle"
    platform = (
        "Instagram & YouTube" if creator_profile.get("detected_platform") == "both"
        else (creator_profile.get("detected_platform") or "Instagram").capitalize()
    )
    followers = creator_profile.get("follower_count") or 0
    followers_str = f"{followers:,}" if followers else "an engaged"

    system = (
        "You write punchy brand-outreach emails for Indian content creators. "
        "Tone: confident, specific, no fluff. Maximum 130 words in body. "
        'Always respond as JSON: {"subject": "...", "body": "..."}.'
    )
    prompt = (
        f"Write a brand outreach email.\n\n"
        f"Creator: {name}, {niche} creator on {platform}, {followers_str} followers.\n"
        f"Brand: {brand['name']} ({brand.get('category')}). {brand.get('description', '')}\n"
        f"Brand tags: {', '.join(brand.get('tags', []))}\n"
        f"Extra context from creator: {extra_context or 'None'}\n\n"
        'Return JSON: {"subject": "short subject", "body": "email body with line breaks"}'
    )
    text = await _call_gemini(system, prompt)
    if text:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                parsed = json.loads(match.group())
                return {
                    "subject": parsed.get("subject") or f"Collaboration with {name} × {brand['name']}",
                    "body": parsed.get("body") or _template_pitch(name, niche, platform, followers_str, brand),
                }
            except Exception:
                pass

    return {
        "subject": f"Collaboration with {name} × {brand['name']}",
        "body": _template_pitch(name, niche, platform, followers_str, brand),
    }


def _template_pitch(name: str, niche: str, platform: str, followers_str: str, brand: dict) -> str:
    return (
        f"Hi {brand['name']} team,\n\n"
        f"I'm {name}, a {niche.lower()} creator on {platform} with {followers_str} engaged followers. "
        f"I've been following {brand['name']}'s recent campaigns and feel my audience aligns strongly with your brand voice.\n\n"
        "I'd love to collaborate on:\n"
        "• 1 main-feed Reel (60-90s)\n"
        "• 3 story frames with native link/swipe-up\n"
        "• Optional long-form integration\n\n"
        "Recent collabs have driven 8–12% link CTR and 2.4× engagement lift. Happy to share my media kit & rate card.\n\n"
        "Would a 15-min call this week work?\n\n"
        f"Best,\n{name}"
    )
