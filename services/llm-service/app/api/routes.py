import asyncio
import hashlib
import json
import time
import uuid

import httpx
from fastapi import APIRouter, HTTPException, Request
from app.models.schemas import (
    ActionExtractionRequest,
    ActionExtractionResponse
)
from app.services.llm_provider import LLMProvider
from app.services.toqan_client import ToqanClient
from app.services.openai_client import OpenAIClient
from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["llm"])


def get_llm_provider() -> LLMProvider:
    """Factory function to get the configured LLM provider"""
    provider_name = settings.llm_provider
    
    if provider_name == "toqan":
        if not settings.toqan_api_key:
            raise HTTPException(
                status_code=500,
                detail="Toqan API key not configured"
            )
        return ToqanClient()
    elif provider_name == "openai":
        if not settings.openai_api_key:
            raise HTTPException(
                status_code=500,
                detail="OpenAI API key not configured"
            )
        return OpenAIClient()
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Unknown LLM provider configured: {provider_name}"
        )


def _compute_input_hash(meeting_details) -> str:
    """Canonical hash of meeting_details for deduplication."""
    canonical = json.dumps(meeting_details.model_dump(mode="json"), sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


async def _get_by_input_hash(input_hash: str) -> dict | None:
    """Fetch extract_action_item by input_hash. Returns None if not found."""
    url = getattr(settings, "database_service_url", None) or ""
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{url.rstrip('/')}/api/v1/db/extract-action-items/by-input-hash",
                params={"hash": input_hash},
            )
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()
    except Exception as e:
        logger.warning(f"Failed to get by input_hash: {e}")
        return None


async def _poll_until_completed(input_hash: str, timeout_sec: float = 120, poll_interval: float = 2.0) -> dict | None:
    """Poll for completed result. Returns record with output_json or None on timeout."""
    elapsed = 0.0
    while elapsed < timeout_sec:
        record = await _get_by_input_hash(input_hash)
        if not record:
            return None
        if record.get("status") == "completed":
            return record
        if record.get("status") == "failed":
            return None
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval
    return None


async def _create_extract_record(
    correlation_id: str,
    license_key: str | None,
    installation_id: str | None,
    input_json: str,
    input_hash: str | None = None,
):
    """Fire-and-forget: create extract_action_item record in database service."""
    url = getattr(settings, "database_service_url", None) or ""
    if not url:
        return
    try:
        payload = {
            "correlation_id": correlation_id,
            "license_key": license_key,
            "installation_id": installation_id,
            "input_json": input_json,
        }
        if input_hash:
            payload["input_hash"] = input_hash
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{url.rstrip('/')}/api/v1/db/extract-action-items",
                json=payload,
            )
    except Exception as e:
        logger.warning(f"Failed to create extract record: {e}")


async def _update_extract_record(
    correlation_id: str,
    output_json: str | None,
    status: str,
    error_message: str | None,
    http_status_code: int,
    duration_ms: int,
):
    """Fire-and-forget: update extract_action_item record in database service."""
    url = getattr(settings, "database_service_url", None) or ""
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.patch(
                f"{url.rstrip('/')}/api/v1/db/extract-action-items",
                json={
                    "correlation_id": correlation_id,
                    "output_json": output_json,
                    "status": status,
                    "error_message": error_message,
                    "http_status_code": http_status_code,
                    "duration_ms": duration_ms,
                },
            )
    except Exception as e:
        logger.warning(f"Failed to update extract record: {e}")


def _parse_cached_response(output_json: str | None) -> ActionExtractionResponse | None:
    """Parse output_json to ActionExtractionResponse. Returns None if invalid."""
    if not output_json:
        return None
    try:
        data = json.loads(output_json)
        return ActionExtractionResponse(**data)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


@router.post("/extract-actions", response_model=ActionExtractionResponse)
async def extract_actions(http_request: Request, request: ActionExtractionRequest):
    """
    Extract action items from meeting notes using the configured LLM provider.
    Deduplicates by input_hash: returns cached result if same request seen before.
    If another request with same input is pending, polls until it completes.
    """
    input_hash = _compute_input_hash(request.meeting_details)
    license_key = http_request.headers.get("X-License-Key") or http_request.headers.get("x-license-key")
    installation_id = http_request.headers.get("X-Installation-Id") or http_request.headers.get("x-installation-id")
    input_json = json.dumps(request.model_dump(mode="json"))

    # Check for cached or in-flight duplicate
    existing = await _get_by_input_hash(input_hash)
    if existing:
        if existing.get("status") == "completed":
            cached = _parse_cached_response(existing.get("output_json"))
            if cached:
                logger.info(f"Returning cached extract result for input_hash={input_hash[:16]}...")
                return cached
        if existing.get("status") == "pending":
            logger.info(f"Duplicate request pending, polling for input_hash={input_hash[:16]}...")
            record = await _poll_until_completed(input_hash)
            if record:
                cached = _parse_cached_response(record.get("output_json"))
                if cached:
                    return cached
            raise HTTPException(status_code=504, detail="Timeout waiting for duplicate request")

    # New request: create record and call LLM
    correlation_id = str(uuid.uuid4())
    url = getattr(settings, "database_service_url", None) or ""
    create_result = None
    if url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.post(
                    f"{url.rstrip('/')}/api/v1/db/extract-action-items",
                    json={
                        "correlation_id": correlation_id,
                        "license_key": license_key,
                        "installation_id": installation_id,
                        "input_json": input_json,
                        "input_hash": input_hash,
                    },
                )
                r.raise_for_status()
                create_result = r.json()
        except Exception as e:
            logger.warning(f"Failed to create extract record: {e}")

    # If create returned existing (race), handle it
    if create_result and not create_result.get("created", True):
        if create_result.get("status") == "completed":
            cached = _parse_cached_response(create_result.get("output_json"))
            if cached:
                return cached
        if create_result.get("status") == "pending":
            record = await _poll_until_completed(input_hash)
            if record:
                cached = _parse_cached_response(record.get("output_json"))
                if cached:
                    return cached
            raise HTTPException(status_code=504, detail="Timeout waiting for duplicate request")

    start = time.perf_counter()
    try:
        provider = get_llm_provider()
        logger.info(f"Extracting actions using {provider.get_provider_name()} provider")

        notes_with_actions = await provider.extract_actions(request.meeting_details)

        logger.info(f"Successfully extracted actions for {len(notes_with_actions)} notes")

        response = ActionExtractionResponse(
            series_id=request.meeting_details.meeting_series.id,
            meeting_id=request.meeting_details.meeting_instance.id,
            notes_with_actions=notes_with_actions,
        )

        duration_ms = int((time.perf_counter() - start) * 1000)
        output_json = json.dumps(response.model_dump(mode="json"))

        asyncio.create_task(
            _update_extract_record(
                correlation_id=correlation_id,
                output_json=output_json,
                status="completed",
                error_message=None,
                http_status_code=200,
                duration_ms=duration_ms,
            )
        )

        return response

    except HTTPException as he:
        duration_ms = int((time.perf_counter() - start) * 1000)
        asyncio.create_task(
            _update_extract_record(
                correlation_id=correlation_id,
                output_json=None,
                status="failed",
                error_message=str(he.detail) if he.detail else str(he),
                http_status_code=he.status_code,
                duration_ms=duration_ms,
            )
        )
        raise
    except Exception as e:
        duration_ms = int((time.perf_counter() - start) * 1000)
        logger.error(f"Error extracting actions: {str(e)}")

        asyncio.create_task(
            _update_extract_record(
                correlation_id=correlation_id,
                output_json=None,
                status="failed",
                error_message=str(e),
                http_status_code=500,
                duration_ms=duration_ms,
            )
        )

        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract actions: {str(e)}",
        )


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "llm-action-extraction",
        "version": settings.version
    }
