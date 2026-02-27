"""Repository for API request logs."""
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_async_session
from app.database.models import ApiRequest
from app.utils.logger import get_logger

logger = get_logger(__name__)

MAX_BODY_LEN = 2000


def _truncate(s: str | None, max_len: int = MAX_BODY_LEN) -> str | None:
    if s is None:
        return None
    if len(s) <= max_len:
        return s
    return s[:max_len] + "... [truncated]"


def _row_to_dict(row) -> Dict:
    if hasattr(row, "__table__"):
        return {c.name: getattr(row, c.name) for c in row.__table__.columns}
    if hasattr(row, "_mapping"):
        return dict(row._mapping)
    return dict(row)


async def insert_request(
    service: str,
    endpoint: str,
    method: str,
    user_identifier: str | None = None,
    request_body: str | None = None,
    response_body: str | None = None,
    status_code: int | None = None,
    duration_ms: int | None = None,
) -> int:
    """Insert API request log. Returns the new id."""
    try:
        async with get_async_session() as session:
            req = ApiRequest(
                timestamp=datetime.utcnow().isoformat(),
                service=service,
                endpoint=endpoint,
                method=method,
                user_identifier=user_identifier,
                request_body=_truncate(request_body),
                response_body=_truncate(response_body),
                status_code=status_code,
                duration_ms=duration_ms,
            )
            session.add(req)
            await session.flush()
            return req.id
    except Exception as e:
        logger.error(f"[InsertRequest] Error: {e}")
        return -1


async def list_requests(
    limit: int = 50,
    offset: int = 0,
    service: str | None = None,
) -> tuple[List[Dict], int]:
    """List API requests with optional filter. Returns (items, total_count)."""
    async with get_async_session() as session:
        q = select(ApiRequest)
        count_q = select(func.count()).select_from(ApiRequest)
        if service:
            q = q.where(ApiRequest.service == service)
            count_q = count_q.where(ApiRequest.service == service)
        total = (await session.execute(count_q)).scalar() or 0
        result = await session.execute(
            q.order_by(ApiRequest.id.desc()).limit(limit).offset(offset)
        )
        rows = result.scalars().all()
        return ([_row_to_dict(r) for r in rows], total)


async def get_request(req_id: int) -> Optional[Dict]:
    """Get single API request by id."""
    async with get_async_session() as session:
        result = await session.execute(select(ApiRequest).where(ApiRequest.id == req_id))
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _row_to_dict(row)
