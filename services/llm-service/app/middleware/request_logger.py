"""Middleware to log API requests to database service."""
import asyncio
import time
from typing import Callable

import httpx
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)


async def _log_to_db(
    service: str,
    endpoint: str,
    method: str,
    status_code: int,
    duration_ms: int,
):
    """Send log to database service (fire-and-forget)."""
    url = getattr(settings, "database_service_url", None) or ""
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{url.rstrip('/')}/api/v1/db/requests",
                json={
                    "service": service,
                    "endpoint": endpoint,
                    "method": method,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                },
            )
    except Exception as e:
        logger.warning(f"Failed to log request to database service: {e}")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log each request to database service."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        path = request.url.path
        method = request.method

        # Skip health and static
        if path in ("/health", "/", "/docs", "/redoc", "/openapi.json"):
            return await call_next(request)

        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start) * 1000)

        # Fire-and-forget log (don't block response)
        asyncio.create_task(
            _log_to_db(
                service="llm",
                endpoint=path,
                method=method,
                status_code=response.status_code,
                duration_ms=duration_ms,
            )
        )
        return response
