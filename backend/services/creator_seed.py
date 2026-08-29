"""Demo creator seeder.

Run once per environment to populate the network with sample discoverable
profiles so the Network page has data on day one. Idempotent — skips if a
demo user with the same email already exists.

Usage:
    cd backend && python -m services.creator_seed
"""
import asyncio
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

import sys
sys.path.insert(0, str(ROOT))

from database import db  # noqa: E402

logger = logging.getLogger(__name__)


DEMO_CREATORS = [
    {
        "email": "aanya@demo.creatoros.app",
        "name": "Aanya Kapoor",
        "user_id": "demo_aanya",
        "creator_name": "Aanya Kapoor",
        "bio": "Mumbai-based fashion + lifestyle creator. Sustainable styling, GRWMs, and city diaries.",
        "niche": "Fashion",
        "instagram_handle": "aanyakreates",
        "youtube_link": None,
        "follower_count": 285_000,
        "address": "Mumbai, India",
        "detected_platform": "instagram",
    },
    {
        "email": "dev@demo.creatoros.app",
        "name": "Dev Patel",
        "user_id": "demo_dev",
        "creator_name": "Dev Patel",
        "bio": "Software engineer turned creator. Indie hacking, no-code, and dev productivity tutorials.",
        "niche": "Tech",
        "instagram_handle": "dev.builds",
        "youtube_link": "https://youtube.com/@devbuilds",
        "follower_count": 612_000,
        "address": "Bangalore, India",
        "detected_platform": "both",
    },
    {
        "email": "sneha@demo.creatoros.app",
        "name": "Sneha Iyer",
        "user_id": "demo_sneha",
        "creator_name": "Sneha Iyer",
        "bio": "Home cook documenting regional Indian recipes one reel at a time.",
        "niche": "Food",
        "instagram_handle": "snehaeats",
        "youtube_link": None,
        "follower_count": 198_000,
        "address": "Mumbai, India",
        "detected_platform": "instagram",
    },
    {
        "email": "rohan@demo.creatoros.app",
        "name": "Rohan Singh",
        "user_id": "demo_rohan",
        "creator_name": "Rohan Singh",
        "bio": "Strength coach. Functional training, programming + supplement breakdowns.",
        "niche": "Fitness",
        "instagram_handle": "rohanlifts",
        "youtube_link": "https://youtube.com/@rohanlifts",
        "follower_count": 412_000,
        "address": "Delhi, India",
        "detected_platform": "both",
    },
    {
        "email": "priya@demo.creatoros.app",
        "name": "Priya Nair",
        "user_id": "demo_priya",
        "creator_name": "Priya Nair",
        "bio": "Slow travel storyteller. Long-form vlogs across Western Ghats & Northeast India.",
        "niche": "Travel",
        "instagram_handle": "priyatravels",
        "youtube_link": "https://youtube.com/@priyatravels",
        "follower_count": 720_000,
        "address": "Goa, India",
        "detected_platform": "youtube",
    },
    {
        "email": "kunal@demo.creatoros.app",
        "name": "Kunal Bhatt",
        "user_id": "demo_kunal",
        "creator_name": "Kunal Bhatt",
        "bio": "Personal finance for Indian millennials. Stocks, taxes, SIP playbooks in plain English.",
        "niche": "Finance",
        "instagram_handle": "kunalfinance",
        "youtube_link": "https://youtube.com/@kunalfinance",
        "follower_count": 1_100_000,
        "address": "Mumbai, India",
        "detected_platform": "youtube",
    },
    {
        "email": "ishita@demo.creatoros.app",
        "name": "Ishita Roy",
        "user_id": "demo_ishita",
        "creator_name": "Ishita Roy",
        "bio": "BGMI + mobile gaming creator. Tournament casts, mech-keyboard reviews.",
        "niche": "Gaming",
        "instagram_handle": "ishitaplays",
        "youtube_link": "https://youtube.com/@ishitaplays",
        "follower_count": 340_000,
        "address": "Kolkata, India",
        "detected_platform": "youtube",
    },
    {
        "email": "mira@demo.creatoros.app",
        "name": "Mira Shah",
        "user_id": "demo_mira",
        "creator_name": "Mira Shah",
        "bio": "Pilates & mobility coach. Free 5-min routines, certified RYT-200.",
        "niche": "Fitness",
        "instagram_handle": "miragains",
        "youtube_link": None,
        "follower_count": 165_000,
        "address": "Pune, India",
        "detected_platform": "instagram",
    },
    {
        "email": "arjun@demo.creatoros.app",
        "name": "Arjun Mehta",
        "user_id": "demo_arjun",
        "creator_name": "Arjun Mehta",
        "bio": "Notion templates + productivity systems for founders.",
        "niche": "Tech",
        "instagram_handle": "arjun.systems",
        "youtube_link": "https://youtube.com/@arjunsystems",
        "follower_count": 92_000,
        "address": "Bangalore, India",
        "detected_platform": "both",
    },
    {
        "email": "tanvi@demo.creatoros.app",
        "name": "Tanvi Desai",
        "user_id": "demo_tanvi",
        "creator_name": "Tanvi Desai",
        "bio": "Clean beauty reviews and skincare science explainers.",
        "niche": "Beauty",
        "instagram_handle": "tanvi.skin",
        "youtube_link": None,
        "follower_count": 230_000,
        "address": "Mumbai, India",
        "detected_platform": "instagram",
    },
]


async def seed_demo_creators() -> int:
    inserted = 0
    now = datetime.now(timezone.utc).isoformat()

    for c in DEMO_CREATORS:
        existing = await db.users.find_one({"user_id": c["user_id"]})
        if existing:
            continue

        await db.users.insert_one({
            "user_id": c["user_id"],
            "email": c["email"],
            "name": c["name"],
            "picture": None,
            "early_access": True,
            "onboarding_complete": True,
            "demo": True,
            "created_at": now,
        })

        await db.creator_profiles.insert_one({
            "user_id": c["user_id"],
            "creator_name": c["creator_name"],
            "bio": c["bio"],
            "youtube_link": c.get("youtube_link"),
            "instagram_handle": c.get("instagram_handle"),
            "follower_count": c["follower_count"],
            "niche": c["niche"],
            "address": c["address"],
            "gstin": None,
            "detected_platform": c["detected_platform"],
            "discoverable": True,
            "demo": True,
            "created_at": now,
            "updated_at": now,
        })
        inserted += 1

    return inserted


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    n = asyncio.run(seed_demo_creators())
    print(f"Seeded {n} demo creators")
