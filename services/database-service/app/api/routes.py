import hashlib
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query
from app.db import api_request_repository, extract_action_item_repository, license_repository
from app.models.schemas import (
    CreateExtractActionItemBody,
    CreateInstallationBody,
    CreateLicenseBody,
    CreateLicenseWithDaysBody,
    LogApiRequestBody,
    ReplaceOldestInstallationBody,
    UpdateExtractActionItemBody,
    UpdateLicenseBody,
)

router = APIRouter(prefix="/api/v1/db", tags=["db"])

LICENSE_SALT = "popouts-license-salt-change-in-production"


def _generate_license_key(email: str, days: int = 365) -> tuple[str, str]:
    expiry = datetime.now() + timedelta(days=days)
    expiry_str = expiry.strftime("%Y%m%d")
    hash_input = f"{email.lower()}{LICENSE_SALT}{expiry_str}"
    hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:8].upper()
    email_clean = email.lower().replace("@", "-").replace(".", "-")
    license_key = f"{email_clean}-{expiry_str}-{hash_value}"
    return license_key, expiry.isoformat()


# --- License endpoints ---

@router.get("/license/by-key")
async def get_license_by_key(license_key: str = Query(...)):
    """Get license by license_key. Returns 404 if not found."""
    license = await license_repository.get_license_by_key(license_key)
    if not license:
        raise HTTPException(status_code=404, detail="License not found")
    return license


@router.get("/license/by-email")
async def get_license_by_email(email: str = Query(...)):
    """Get most recent active license by email. Returns 404 if not found."""
    license = await license_repository.get_license_by_email(email)
    if not license:
        raise HTTPException(status_code=404, detail="License not found")
    return license


@router.get("/license/list")
async def list_licenses():
    """List all licenses (for admin UI)."""
    raw = await license_repository.list_licenses()
    result = []
    for r in raw:
        created = datetime.fromisoformat(r["created_at"]) if r.get("created_at") else None
        expiry = datetime.fromisoformat(r["expiry_date"]) if r.get("expiry_date") else None
        days_val = (expiry - created).days if (created and expiry) else None
        result.append({
            **r,
            "days": days_val,
        })
    return {"licenses": result, "count": len(result)}


@router.post("/license")
async def create_license(body: CreateLicenseBody):
    """Create or update license."""
    result = await license_repository.create_license(
        email=body.email,
        license_key=body.license_key,
        expiry_date=body.expiry_date,
        status=body.status,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
    return result


@router.post("/license/create")
async def create_license_with_days(body: CreateLicenseWithDaysBody):
    """Create license with auto-generated key (for admin UI)."""
    license_key, expiry_date = _generate_license_key(body.email, body.days)
    result = await license_repository.create_license(
        email=body.email,
        license_key=license_key,
        expiry_date=expiry_date,
        status="active",
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
    return {"success": True, "email": body.email, "license_key": license_key, "expiry": expiry_date}


@router.patch("/license/{license_id}")
async def update_license(license_id: int, body: UpdateLicenseBody):
    """Update license email, license_key, expiry_date."""
    result = await license_repository.update_license(
        license_id=license_id,
        email=body.email,
        license_key=body.license_key,
        expiry_date=body.expiry_date,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Unknown error"))
    return result


@router.delete("/license/{license_id}")
async def delete_license(license_id: int):
    """Delete license by id."""
    result = await license_repository.delete_license(license_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error", "License not found"))
    return result


# --- Installation endpoints ---

@router.get("/installations")
async def get_installations(
    email: str = Query(...),
    installation_id: str | None = Query(None),
):
    """
    Get installations for email.
    If installation_id is provided, returns single installation or 404.
    Otherwise returns list of all installations.
    """
    if installation_id:
        inst = await license_repository.get_installation_by_id(email, installation_id)
        if not inst:
            raise HTTPException(status_code=404, detail="Installation not found")
        return inst
    installations = await license_repository.get_installations(email)
    return {"installations": installations, "count": len(installations)}


@router.post("/installations")
async def create_installation(body: CreateInstallationBody):
    """Insert new installation. Fails if (email, installation_id) already exists."""
    ok = await license_repository.insert_installation(body.email, body.installation_id)
    if not ok:
        raise HTTPException(status_code=409, detail="Installation already exists")
    return {"success": True}


@router.post("/installations/replace-oldest")
async def replace_oldest_installation(body: ReplaceOldestInstallationBody):
    """Replace oldest installation for email with new installation_id. Returns replaced info."""
    replaced = await license_repository.replace_oldest_installation(body.email, body.installation_id)
    if not replaced:
        raise HTTPException(status_code=404, detail="No installations to replace")
    return {"success": True, "replaced": replaced["installation_id"]}


@router.patch("/installations/last-seen")
async def update_installation_last_seen(
    email: str = Query(...),
    installation_id: str = Query(...),
):
    """Update last_seen timestamp for installation."""
    ok = await license_repository.update_installation_last_seen(email, installation_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Installation not found")
    return {"success": True}


# --- API request logging ---

@router.post("/requests")
async def log_api_request(body: LogApiRequestBody):
    """Log an API request (called by LLM service etc)."""
    req_id = await api_request_repository.insert_request(
        service=body.service,
        endpoint=body.endpoint,
        method=body.method,
        user_identifier=body.user_identifier,
        request_body=body.request_body,
        response_body=body.response_body,
        status_code=body.status_code,
        duration_ms=body.duration_ms,
    )
    return {"id": req_id}


@router.get("/requests")
async def list_api_requests(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    service: str | None = Query(None),
):
    """List API requests (for admin UI)."""
    items, total = await api_request_repository.list_requests(
        limit=limit, offset=offset, service=service
    )
    return {"requests": items, "count": len(items), "total": total}


# --- Extract action items (LLM extract-actions tracking) ---

@router.get("/extract-action-items/by-input-hash")
async def get_extract_action_item_by_input_hash(input_hash: str = Query(..., alias="hash")):
    """Get extract_action_item by input_hash. Returns 404 if not found."""
    record = await extract_action_item_repository.get_by_input_hash(input_hash)
    if not record:
        raise HTTPException(status_code=404, detail="Not found")
    return record


@router.post("/extract-action-items")
async def create_extract_action_item(body: CreateExtractActionItemBody):
    """Create extract_action_item record (or return existing if input_hash duplicate)."""
    result = await extract_action_item_repository.create_extract_action_item(
        correlation_id=body.correlation_id,
        license_key=body.license_key,
        installation_id=body.installation_id,
        input_json=body.input_json,
        input_hash=body.input_hash,
    )
    return result


@router.patch("/extract-action-items")
async def update_extract_action_item(body: UpdateExtractActionItemBody):
    """Update extract_action_item with response (called by LLM service after response)."""
    ok = await extract_action_item_repository.update_extract_action_item(
        correlation_id=body.correlation_id,
        output_json=body.output_json,
        status=body.status,
        error_message=body.error_message,
        http_status_code=body.http_status_code,
        duration_ms=body.duration_ms,
    )
    return {"ok": ok}


@router.get("/extract-action-items")
async def list_extract_action_items(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    search: str | None = Query(None),
):
    """List extract_action_items (for admin/debugging). Sorted by date desc, latest first."""
    items, total = await extract_action_item_repository.list_extract_action_items(
        limit=limit, offset=offset, status=status, search=search
    )
    return {"items": items, "count": len(items), "total": total}
