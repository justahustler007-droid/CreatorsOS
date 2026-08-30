```python
"""CreatorOS authentication and access endpoints."""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from database import db
from deps import get_current_user
from models import AccessCodeRequest

router = APIRouter(tags=["auth"])


# ============================================================
# PASSWORD HELPERS
# ============================================================

def hash_password(password: str) -> str:
    """Securely hash a password using PBKDF2-SHA256."""
    salt = secrets.token_hex(16)

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        200_000,
    ).hex()

    return f"{salt}${password_hash}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored PBKDF2 hash."""
    try:
        salt, password_hash = stored_hash.split("$", 1)

        calculated_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            200_000,
        ).hex()

        return secrets.compare_digest(
            calculated_hash,
            password_hash,
        )

    except (ValueError, AttributeError):
        return False


# ============================================================
# SESSION HELPER
# ============================================================

async def create_login_session(
    user: dict,
    response: Response,
) -> dict:
    """Create a 7-day session and return safe user data."""

    session_token = f"sess_{uuid.uuid4().hex}"

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(days=7)
    )

    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.user_sessions.insert_one(session_doc)

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )

    # Never send password hash to the browser.
    safe_user = {
        key: value
        for key, value in user.items()
        if key != "password_hash"
    }

    # AuthContext will also store this token in localStorage.
    return {
        **safe_user,
        "session_token": session_token,
    }


# ============================================================
# REGISTER
# ============================================================

@router.post("/auth/register")
async def register(
    request: Request,
    response: Response,
):
    """Create a new CreatorOS account."""

    body = await request.json()

    name = (body.get("name") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Name is required",
        )

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required",
        )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Password is required",
        )

    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters",
        )

    existing_user = await db.users.find_one(
        {"email": email},
        {"_id": 0},
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists",
        )

    user_id = f"user_{uuid.uuid4().hex[:12]}"

    new_user = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": None,

        "password_hash": hash_password(password),

        # MVP: allow new users to enter the app.
        # You can change this to False later if you want
        # FIRST100 to be mandatory.
        "early_access": True,

        "onboarding_complete": False,

        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(new_user)

    return await create_login_session(
        new_user,
        response,
    )


# ============================================================
# LOGIN
# ============================================================

@router.post("/auth/login")
async def login(
    request: Request,
    response: Response,
):
    """Log an existing CreatorOS user in."""

    body = await request.json()

    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        raise HTTPException(
            status_code=400,
            detail="Email and password are required",
        )

    user = await db.users.find_one(
        {"email": email},
        {"_id": 0},
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    stored_hash = user.get("password_hash")

    if not stored_hash:
        raise HTTPException(
            status_code=401,
            detail="This account needs to be recreated with email and password",
        )

    if not verify_password(
        password,
        stored_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    return await create_login_session(
        user,
        response,
    )


# ============================================================
# CURRENT USER
# ============================================================

@router.get("/auth/me")
async def get_me(
    user: dict = Depends(get_current_user),
):
    """Return the currently authenticated user."""

    return user


# ============================================================
# LOGOUT
# ============================================================

@router.post("/auth/logout")
async def logout(
    request: Request,
    response: Response,
):
    """Logout the current user."""

    session_token = request.cookies.get(
        "session_token"
    )

    # Also support Authorization Bearer token.
    if not session_token:
        auth_header = request.headers.get(
            "Authorization"
        )

        if (
            auth_header
            and auth_header.startswith("Bearer ")
        ):
            session_token = auth_header.split(
                " ",
                1,
            )[1]

    if session_token:
        await db.user_sessions.delete_one(
            {"session_token": session_token}
        )

    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none",
    )

    return {
        "message": "Logged out successfully"
    }


# ============================================================
# EARLY ACCESS CODE
# ============================================================

@router.post("/auth/verify-access-code")
async def verify_access_code(
    data: AccessCodeRequest,
    user: dict = Depends(get_current_user),
):
    """Verify the CreatorOS early-access code."""

    submitted = (
        data.code or ""
    ).strip().upper()

    if submitted == "FIRST100":

        await db.users.update_one(
            {"user_id": user["user_id"]},
            {
                "$set": {
                    "early_access": True
                }
            },
        )

        return {
            "success": True,
            "message": "Early access granted!",
        }

    return {
        "success": False,
        "message": "Invalid access code",
    }


# ============================================================
# ACCESS STATUS
# ============================================================

@router.get("/auth/access-status")
async def get_access_status(
    user: dict = Depends(get_current_user),
):
    """Return the user's access and onboarding status."""

    return {
        "early_access": user.get(
            "early_access",
            False,
        ),
        "onboarding_complete": user.get(
            "onboarding_complete",
            False,
        ),
    }
```
