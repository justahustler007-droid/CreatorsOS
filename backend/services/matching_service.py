"""Brand & creator matching algorithms (lightweight, deterministic, server-side)."""
from typing import List, Optional


def score_brand_match(
    brand: dict,
    creator_niche: Optional[str],
    creator_platform: Optional[str],
    creator_region: Optional[str],
    creator_city: Optional[str],
    follower_count: int = 0,
    engagement_rate: float = 0.0,
) -> int:
    """Return 0–100 match score for a brand vs a creator profile."""
    score = 50  # baseline so cards never look dead

    # Niche fit (heaviest weight)
    if creator_niche:
        fit = [n.lower() for n in brand.get("fit_niches", [])]
        if creator_niche.lower() in fit:
            score += 25
        elif brand.get("category", "").lower() == creator_niche.lower():
            score += 20

    # Platform fit
    if creator_platform and brand.get("fit_platforms"):
        if creator_platform in brand["fit_platforms"]:
            score += 12

    # Region / city fit
    region = (brand.get("region") or "").lower()
    if creator_region:
        if region == creator_region.lower():
            score += 8
        elif region == "global":
            score += 4
    if creator_city and brand.get("city") and creator_city.lower() == brand["city"].lower():
        score += 5

    # Audience-size sanity (very small audience → harder for high-budget brands)
    budget_max = brand.get("budget_max", 0)
    if budget_max >= 500_000 and follower_count and follower_count < 50_000:
        score -= 6
    if engagement_rate >= 4.0:
        score += 3

    return max(35, min(99, score))


def score_creator_compatibility(self_profile: dict, other_profile: dict) -> int:
    """Return 0–100 compatibility score between two creator profiles."""
    score = 50

    s_niche = (self_profile.get("niche") or "").lower()
    o_niche = (other_profile.get("niche") or "").lower()
    if s_niche and s_niche == o_niche:
        score += 25
    elif s_niche and o_niche:
        score += 5  # cross-niche collab still possible

    s_plat = (self_profile.get("detected_platform") or "").lower()
    o_plat = (other_profile.get("detected_platform") or "").lower()
    if s_plat and s_plat == o_plat:
        score += 10
    elif "both" in (s_plat, o_plat):
        score += 6

    s_city = (self_profile.get("address") or "").lower()
    o_city = (other_profile.get("address") or "").lower()
    if s_city and o_city and any(part in o_city for part in s_city.split()[:2] if len(part) > 3):
        score += 12

    # Follower-band proximity (within 5× either way feels balanced)
    s_fol = self_profile.get("follower_count") or 0
    o_fol = other_profile.get("follower_count") or 0
    if s_fol and o_fol:
        ratio = max(s_fol, o_fol) / max(min(s_fol, o_fol), 1)
        if ratio <= 3:
            score += 10
        elif ratio <= 8:
            score += 4

    return max(35, min(99, score))


def estimate_authentic_audience(creator: dict) -> int:
    """Pseudo fake-follower-risk estimate (0=clean, 30+=suspect).

    Uses follower_count and detected_platform as a stable hash so the same
    creator always scores the same risk. Production should plug HypeAuditor
    or similar; this gives a stable visual indicator for now.
    """
    seed = (creator.get("follower_count") or 0) % 23
    base = 4 + (seed % 11)         # 4-14 range
    if (creator.get("follower_count") or 0) > 1_000_000:
        base += 2
    return min(28, base)


def gradient_for_niche(niche: Optional[str]) -> str:
    table = {
        "beauty":    "from-pink-500 to-rose-500",
        "fashion":   "from-fuchsia-500 to-pink-600",
        "tech":      "from-blue-500 to-cyan-500",
        "gaming":    "from-indigo-500 to-purple-600",
        "fitness":   "from-amber-500 to-orange-600",
        "food":      "from-orange-500 to-red-500",
        "travel":    "from-emerald-500 to-teal-600",
        "finance":   "from-violet-600 to-fuchsia-600",
        "education": "from-sky-500 to-blue-600",
        "lifestyle": "from-rose-400 to-pink-500",
    }
    return table.get((niche or "").lower(), "from-slate-600 to-slate-800")


def rank_brands_for_creator(brands: List[dict], creator_profile: dict, saved_ids: set) -> List[dict]:
    """Annotate each brand with `match_score`, `saved`, then return sorted desc."""
    niche = creator_profile.get("niche")
    platform = creator_profile.get("detected_platform")
    region = "India" if creator_profile.get("address") else None
    city = creator_profile.get("address")
    followers = creator_profile.get("follower_count") or 0

    enriched = []
    for b in brands:
        match = score_brand_match(b, niche, platform, region, city, followers)
        enriched.append({**b, "match_score": match, "saved": b["brand_id"] in saved_ids})
    enriched.sort(key=lambda x: x["match_score"], reverse=True)
    return enriched
