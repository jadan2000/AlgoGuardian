"""Validate a Supabase access token before allowing broker credential management."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import Header, HTTPException


def require_authenticated_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to manage your broker account.")
    token = authorization.split(" ", 1)[1].strip()
    base_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    anon_key = (os.getenv("SUPABASE_ANON_KEY") or "").strip()
    if not base_url or not anon_key:
        raise HTTPException(status_code=503, detail="Account authentication is not configured on the backend.")
    request = Request(f"{base_url}/auth/v1/user", headers={"Authorization": f"Bearer {token}", "apikey": anon_key}, method="GET")
    try:
        with urlopen(request, timeout=8) as response:
            user = json.loads(response.read().decode("utf-8"))
        if not isinstance(user, dict) or not user.get("id"):
            raise HTTPException(status_code=401, detail="Your session is invalid. Please sign in again.")
        return {"id": str(user["id"]), "email": user.get("email")}
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.") from exc
        raise HTTPException(status_code=502, detail="Could not validate your session.") from exc
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail="Could not validate your session. Try again shortly.") from exc
