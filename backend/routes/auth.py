"""Authentication & paywall endpoints."""
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from database import db
from deps import get_current_user
from models import AccessCodeRequest

router = APIRouter(tags=["auth"])


@router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id from Emergent Auth for a session token."""
    body = await request.json()
    session_id = body.get("session_id")

    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )

    if auth_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")

    auth_data = auth_response.json()
    user_id = f"user_{uuid.uuid4().hex[:12]}"

    existing_user = await db.users.find_one({"email": auth_data["email"]}, {"_id": 0})

    if existing_user:
        user_id = existing_user["user_id"]
    else:
        new_user = {
            "user_id": user_id,
            "email": auth_data["email"],
            "name": auth_data["name"],
            "picture": auth_data.get("picture"),
            "early_access": False,
            "onboarding_complete": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)

    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    # Return session_token in body so the frontend can also persist it in
    # localStorage as a fallback for cross-domain deployments where 3rd-party
    # cookies are blocked (Safari ITP, Brave, Chrome strict mode).
    return {**user_doc, "session_token": session_token}


@router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user."""
    return user


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session."""
    session_token = request.cookies.get("session_token")

    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})

    response.delete_cookie(key="session_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out successfully"}


@router.post("/auth/verify-access-code")
async def verify_access_code(data: AccessCodeRequest, user: dict = Depends(get_current_user)):
    """Verify early access code (case-insensitive, trims whitespace)."""
    submitted = (data.code or "").strip().upper()
    if submitted == "FIRST100":
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"early_access": True}}
        )
        return {"success": True, "message": "Early access granted!"}
    return {"success": False, "message": "Invalid access code"}


@router.get("/auth/access-status")
async def get_access_status(user: dict = Depends(get_current_user)):
    """Get user's access status."""
    return {
        "early_access": user.get("early_access", False),
        "onboarding_complete": user.get("onboarding_complete", False)
    }
