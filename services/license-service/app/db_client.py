"""HTTP client for database service."""
import os
from typing import Any, Dict, List, Optional

import httpx
from app.utils.logger import get_logger

logger = get_logger(__name__)

DATABASE_SERVICE_URL = os.environ.get("DATABASE_SERVICE_URL", "http://localhost:8002")
BASE = f"{DATABASE_SERVICE_URL.rstrip('/')}/api/v1/db"


async def _get(path: str, params: Optional[Dict[str, str]] = None) -> Any:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(f"{BASE}{path}", params=params)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()


async def _post(path: str, json: Dict) -> Any:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(f"{BASE}{path}", json=json)
        r.raise_for_status()
        return r.json()


async def _patch(path: str, params: Optional[Dict[str, str]] = None) -> Any:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.patch(f"{BASE}{path}", params=params)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()


async def _delete(path: str) -> Any:
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.delete(f"{BASE}{path}")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()


async def get_license_by_key(license_key: str) -> Optional[Dict]:
    """Get license by key. Returns None if 404."""
    try:
        return await _get("/license/by-key", {"license_key": license_key})
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        raise


async def get_license_by_email(email: str) -> Optional[Dict]:
    """Get most recent active license by email. Returns None if 404."""
    try:
        return await _get("/license/by-email", {"email": email})
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        raise


async def list_licenses() -> List[Dict]:
    """List all licenses."""
    data = await _get("/license/list")
    return data.get("licenses", [])


async def create_license(email: str, license_key: str, expiry_date: str, status: str = "active") -> Dict:
    """Create or update license."""
    return await _post("/license", {
        "email": email,
        "license_key": license_key,
        "expiry_date": expiry_date,
        "status": status,
    })


async def delete_license(license_id: int) -> Optional[Dict]:
    """Delete license. Returns None if 404."""
    return await _delete(f"/license/{license_id}")


async def get_installations(email: str) -> List[Dict]:
    """Get installations for email (ordered by last_seen DESC from API)."""
    data = await _get("/installations", {"email": email})
    return data.get("installations", [])


async def get_installation(email: str, installation_id: str) -> Optional[Dict]:
    """Get single installation. Returns None if 404."""
    try:
        return await _get("/installations", {"email": email, "installation_id": installation_id})
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        raise


async def insert_installation(email: str, installation_id: str) -> bool:
    """Insert new installation. Returns True on success, raises on 409."""
    try:
        await _post("/installations", {"email": email, "installation_id": installation_id})
        return True
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            return False
        raise


async def replace_oldest_installation(email: str, installation_id: str) -> Optional[str]:
    """Replace oldest installation. Returns replaced installation_id or None."""
    try:
        data = await _post("/installations/replace-oldest", {"email": email, "installation_id": installation_id})
        return data.get("replaced")
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return None
        raise


async def update_installation_last_seen(email: str, installation_id: str) -> bool:
    """Update last_seen. Returns True on success, False if 404."""
    try:
        await _patch("/installations/last-seen", {"email": email, "installation_id": installation_id})
        return True
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return False
        raise
