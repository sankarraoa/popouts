"""Repository layer for license and installation data - SQLAlchemy (SQLite + PostgreSQL)."""
from datetime import datetime
from typing import Dict, List, Optional

from sqlalchemy import select, update

from app.database.connection import get_async_session
from app.database.models import Installation, License
from app.utils.logger import get_logger

logger = get_logger(__name__)


def _row_to_dict(row) -> Dict:
    """Convert SQLAlchemy model instance to dict."""
    if hasattr(row, "__table__"):
        return {c.name: getattr(row, c.name) for c in row.__table__.columns}
    if hasattr(row, "_mapping"):
        return dict(row._mapping)
    return dict(row)


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


async def get_license_by_key(license_key: str) -> Optional[Dict]:
    """Get license by license_key. Returns None if not found."""
    async with get_async_session() as session:
        result = await session.execute(
            select(License).where(License.license_key == license_key, License.status == "active")
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _row_to_dict(row)


async def get_license_by_email(email: str) -> Optional[Dict]:
    """Get most recent active license by email. Returns None if not found."""
    async with get_async_session() as session:
        result = await session.execute(
            select(License)
            .where(License.email == email.lower(), License.status == "active")
            .order_by(License.created_at.desc().nullslast())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _row_to_dict(row)


async def get_installations(email: str) -> List[Dict]:
    """Get all installations for an email, ordered by last_seen DESC."""
    async with get_async_session() as session:
        result = await session.execute(
            select(Installation)
            .where(Installation.email == email.lower())
            .order_by(Installation.last_seen.desc().nullslast())
        )
        rows = result.scalars().all()
        return [_row_to_dict(r) for r in rows]


async def get_installation_by_id(email: str, installation_id: str) -> Optional[Dict]:
    """Get single installation by email and installation_id."""
    async with get_async_session() as session:
        result = await session.execute(
            select(Installation).where(
                Installation.email == email.lower(),
                Installation.installation_id == installation_id,
            )
        )
        row = result.scalar_one_or_none()
        if not row:
            return None
        return _row_to_dict(row)


async def create_license(email: str, license_key: str, expiry_date: str, status: str = "active") -> Dict:
    """Create or update license. Returns created/updated license info."""
    try:
        async with get_async_session() as session:
            # Use dialect-specific upsert
            stmt = select(License).where(License.license_key == license_key)
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing:
                existing.expiry_date = expiry_date
                existing.status = status
                await session.flush()
            else:
                lic = License(
                    email=email.lower(),
                    license_key=license_key,
                    expiry_date=expiry_date,
                    status=status,
                    created_at=_now_iso(),
                )
                session.add(lic)
                await session.flush()
            logger.info(f"[Create] License for {email}, expires {expiry_date}")
        return {"success": True, "email": email, "license_key": license_key, "expiry": expiry_date}
    except Exception as e:
        logger.error(f"[Create] Error: {e}")
        return {"success": False, "error": str(e)}


async def delete_license(license_id: int) -> Dict:
    """Delete license by id."""
    try:
        async with get_async_session() as session:
            result = await session.execute(select(License).where(License.id == license_id))
            lic = result.scalar_one_or_none()
            if not lic:
                return {"success": False, "error": "License not found"}
            await session.delete(lic)
            await session.flush()
            logger.info(f"[Delete] License id={license_id} deleted")
        return {"success": True}
    except Exception as e:
        logger.error(f"[Delete] Error: {e}")
        return {"success": False, "error": str(e)}


async def upsert_installation(email: str, installation_id: str) -> Dict:
    """Insert or replace installation. For new: insert. For replace: update oldest."""
    try:
        async with get_async_session() as session:
            result = await session.execute(
                select(Installation).where(
                    Installation.email == email.lower(),
                    Installation.installation_id == installation_id,
                )
            )
            existing = result.scalar_one_or_none()
            now = _now_iso()
            if existing:
                existing.last_seen = now
                await session.flush()
            else:
                inst = Installation(
                    email=email.lower(),
                    installation_id=installation_id,
                    activated_at=now,
                    last_seen=now,
                )
                session.add(inst)
                await session.flush()
        return {"success": True}
    except Exception as e:
        logger.error(f"[UpsertInstall] Error: {e}")
        return {"success": False, "error": str(e)}


async def update_installation_last_seen(email: str, installation_id: str) -> bool:
    """Update last_seen for an installation. Returns True if updated."""
    try:
        async with get_async_session() as session:
            result = await session.execute(
                update(Installation)
                .where(
                    Installation.email == email.lower(),
                    Installation.installation_id == installation_id,
                )
                .values(last_seen=_now_iso())
            )
            return result.rowcount > 0
    except Exception as e:
        logger.error(f"[UpdateLastSeen] Error: {e}")
        return False


async def list_licenses() -> List[Dict]:
    """List all licenses ordered by created_at DESC."""
    async with get_async_session() as session:
        result = await session.execute(
            select(License).order_by(License.created_at.desc().nullslast())
        )
        rows = result.scalars().all()
        return [_row_to_dict(r) for r in rows]


async def insert_installation(email: str, installation_id: str) -> bool:
    """Insert new installation. Returns True if inserted. Fails if (email, installation_id) exists."""
    try:
        async with get_async_session() as session:
            result = await session.execute(
                select(Installation).where(
                    Installation.email == email.lower(),
                    Installation.installation_id == installation_id,
                )
            )
            if result.scalar_one_or_none():
                return False
            now = _now_iso()
            inst = Installation(
                email=email.lower(),
                installation_id=installation_id,
                activated_at=now,
                last_seen=now,
            )
            session.add(inst)
            await session.flush()
        return True
    except Exception as e:
        logger.error(f"[InsertInstall] Error: {e}")
        return False


async def replace_oldest_installation(email: str, installation_id: str) -> Optional[Dict]:
    """
    Replace the oldest installation for this email with the new installation_id.
    Returns the replaced installation info, or None if no installations exist.
    """
    try:
        async with get_async_session() as session:
            result = await session.execute(
                select(Installation)
                .where(Installation.email == email.lower())
                .order_by(Installation.last_seen.asc().nullsfirst())
                .limit(1)
            )
            oldest = result.scalar_one_or_none()
            if not oldest:
                return None
            replaced_info = _row_to_dict(oldest)
            now = _now_iso()
            oldest.installation_id = installation_id
            oldest.activated_at = now
            oldest.last_seen = now
            await session.flush()
            return replaced_info
    except Exception as e:
        logger.error(f"[ReplaceOldest] Error: {e}")
        return None
