"""Repository for extract_action_items table."""
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_async_session
from app.database.models import ExtractActionItem
from app.utils.logger import get_logger

logger = get_logger(__name__)

MAX_JSON_LEN = 100_000


async def get_by_input_hash(input_hash: str) -> Optional[Dict]:
    """Get extract_action_item by input_hash. Returns dict with id, correlation_id, status, output_json or None."""
    async with get_async_session() as session:
        result = await session.execute(
            select(ExtractActionItem).where(ExtractActionItem.input_hash == input_hash)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return {
            "id": row.id,
            "correlation_id": row.correlation_id,
            "status": row.status,
            "output_json": row.output_json,
        }


def _truncate(s: str | None, max_len: int = MAX_JSON_LEN) -> str | None:
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


async def create_extract_action_item(
    correlation_id: str,
    license_key: str | None = None,
    installation_id: str | None = None,
    input_json: str | None = None,
    input_hash: str | None = None,
) -> Dict:
    """
    Create a new extract_action_item record, or return existing if input_hash duplicate.
    Returns dict: { id, correlation_id, status, output_json, created }.
    created=True if new row inserted, False if duplicate input_hash.
    """
    now = datetime.utcnow().isoformat()
    try:
        async with get_async_session() as session:
            req = ExtractActionItem(
                correlation_id=correlation_id,
                created_at=now,
                updated_at=now,
                license_key=license_key,
                installation_id=installation_id,
                input_json=_truncate(input_json),
                input_hash=input_hash,
                status="pending",
            )
            session.add(req)
            await session.flush()
            return {
                "id": req.id,
                "correlation_id": req.correlation_id,
                "status": req.status,
                "output_json": req.output_json,
                "created": True,
            }
    except IntegrityError:
        # Duplicate input_hash - return existing record
        if input_hash:
            existing = await get_by_input_hash(input_hash)
            if existing:
                return {
                    "id": existing["id"],
                    "correlation_id": existing["correlation_id"],
                    "status": existing["status"],
                    "output_json": existing["output_json"],
                    "created": False,
                }
        raise
    except Exception as e:
        logger.error(f"[ExtractActionItem] Create error: {e}")
        raise


async def update_extract_action_item(
    correlation_id: str,
    output_json: str | None = None,
    status: str = "completed",
    error_message: str | None = None,
    http_status_code: int | None = None,
    duration_ms: int | None = None,
) -> bool:
    """Update an extract_action_item by correlation_id. Returns True if updated."""
    now = datetime.utcnow().isoformat()
    try:
        async with get_async_session() as session:
            result = await session.execute(
                select(ExtractActionItem).where(
                    ExtractActionItem.correlation_id == correlation_id
                )
            )
            row = result.scalar_one_or_none()
            if not row:
                logger.warning(f"[ExtractActionItem] Not found: {correlation_id}")
                return False
            row.updated_at = now
            if output_json is not None:
                row.output_json = _truncate(output_json)
            row.status = status
            if error_message is not None:
                row.error_message = _truncate(error_message, 4000)
            if http_status_code is not None:
                row.http_status_code = http_status_code
            if duration_ms is not None:
                row.duration_ms = duration_ms
            await session.flush()
            return True
    except Exception as e:
        logger.error(f"[ExtractActionItem] Update error: {e}")
        raise


async def list_extract_action_items(
    limit: int = 50,
    offset: int = 0,
    status: str | None = None,
    search: str | None = None,
) -> tuple[List[Dict], int]:
    """List extract_action_items. Returns (items, total_count). Sorted by created_at desc (latest first)."""
    async with get_async_session() as session:
        q = select(ExtractActionItem)
        count_q = select(func.count()).select_from(ExtractActionItem)
        if status:
            q = q.where(ExtractActionItem.status == status)
            count_q = count_q.where(ExtractActionItem.status == status)
        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            search_filter = or_(
                func.lower(func.coalesce(ExtractActionItem.license_key, "")).like(term),
                func.lower(func.coalesce(ExtractActionItem.installation_id, "")).like(term),
            )
            q = q.where(search_filter)
            count_q = count_q.where(search_filter)
        total = (await session.execute(count_q)).scalar() or 0
        result = await session.execute(
            q.order_by(ExtractActionItem.id.desc()).limit(limit).offset(offset)
        )
        rows = result.scalars().all()
        return ([_row_to_dict(r) for r in rows], total)
