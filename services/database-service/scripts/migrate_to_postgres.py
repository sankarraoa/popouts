#!/usr/bin/env python3
"""
Migrate data from SQLite to PostgreSQL (e.g. Railway).
Migrates: licenses, installations, extract_action_items.
Skips api_requests (audit log) by default - set MIGRATE_API_REQUESTS=1 to include.

Usage:
    # From services/database-service directory:
    DATABASE_URL=postgresql://user:pass@shortline.proxy.rlwy.net:27253/railway python scripts/migrate_to_postgres.py

    # Or with source override:
    LICENSE_SOURCE_DB=../db-data/licenses.db DATABASE_URL=postgresql://... python scripts/migrate_to_postgres.py

Environment:
    LICENSE_SOURCE_DB: Path to source SQLite (default: ../db-data/licenses.db)
    DATABASE_URL: PostgreSQL connection URL (required)
    MIGRATE_API_REQUESTS: Set to 1 to migrate api_requests table (default: skip)
"""
import asyncio
import os
import sqlite3
import sys
from pathlib import Path

# Add parent to path for imports
SCRIPT_DIR = Path(__file__).resolve().parent
DB_SERVICE_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(DB_SERVICE_ROOT))

# Load .env from database-service root if DATABASE_URL not set
if not os.environ.get("DATABASE_URL"):
    try:
        from dotenv import load_dotenv
        env_path = DB_SERVICE_ROOT / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except ImportError:
        pass

SERVICES_ROOT = DB_SERVICE_ROOT.parent
DEFAULT_SOURCE = SERVICES_ROOT / "db-data" / "licenses.db"


def _fetch_table(src, table, columns, required=True):
    """Fetch rows from table. Return [] if table missing and not required."""
    try:
        col_str = ", ".join(columns)
        return src.execute(f"SELECT {col_str} FROM {table}").fetchall()
    except sqlite3.OperationalError as e:
        if "no such table" in str(e).lower() and not required:
            return []
        raise


async def migrate_to_postgres():
    """Copy from SQLite to PostgreSQL via SQLAlchemy."""
    source = Path(os.environ.get("LICENSE_SOURCE_DB", str(DEFAULT_SOURCE)))
    database_url = os.environ.get("DATABASE_URL")
    migrate_api_requests = os.environ.get("MIGRATE_API_REQUESTS", "") == "1"

    if not database_url:
        print("Error: DATABASE_URL is required (e.g. postgresql://user:pass@host:port/db)")
        sys.exit(1)

    if not source.exists():
        print(f"Error: Source database not found: {source}")
        sys.exit(1)

    # Convert to asyncpg URL
    if database_url.startswith("postgresql://") and "+asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    print(f"Migrating to PostgreSQL:")
    print(f"  Source: {source}")
    print(f"  Target: PostgreSQL")

    # Read from SQLite
    src = sqlite3.connect(str(source))
    src.row_factory = sqlite3.Row
    try:
        licenses = _fetch_table(
            src, "licenses",
            ["id", "email", "license_key", "expiry_date", "created_at", "status"],
        )
        installations = _fetch_table(
            src, "installations",
            ["id", "email", "installation_id", "activated_at", "last_seen"],
        )
        # input_hash optional - source may not have it yet (run add_input_hash_column.py first to add it)
        try:
            extract_items = _fetch_table(
                src, "extract_action_items",
                ["correlation_id", "created_at", "updated_at", "license_key", "installation_id",
                 "input_json", "output_json", "input_hash", "status", "error_message", "http_status_code", "duration_ms"],
                required=False,
            )
        except sqlite3.OperationalError:
            extract_items = _fetch_table(
                src, "extract_action_items",
                ["correlation_id", "created_at", "updated_at", "license_key", "installation_id",
                 "input_json", "output_json", "status", "error_message", "http_status_code", "duration_ms"],
                required=False,
            )
        api_requests = []
        if migrate_api_requests:
            api_requests = _fetch_table(
                src, "api_requests",
                ["timestamp", "service", "endpoint", "method", "user_identifier",
                 "request_body", "response_body", "status_code", "duration_ms"],
                required=False,
            )
    finally:
        src.close()

    # Write to PostgreSQL via SQLAlchemy
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from app.database.models import Base, License, Installation, ExtractActionItem, ApiRequest

    engine = create_async_engine(database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        for r in licenses:
            result = await session.execute(
                select(License).where(License.license_key == r["license_key"])
            )
            if result.scalar_one_or_none():
                continue
            lic = License(
                email=r["email"],
                license_key=r["license_key"],
                expiry_date=r["expiry_date"],
                created_at=r["created_at"],
                status=r["status"] or "active",
            )
            session.add(lic)

        for r in installations:
            result = await session.execute(
                select(Installation).where(
                    Installation.email == r["email"],
                    Installation.installation_id == r["installation_id"],
                )
            )
            if result.scalar_one_or_none():
                continue
            inst = Installation(
                email=r["email"],
                installation_id=r["installation_id"],
                activated_at=r["activated_at"],
                last_seen=r["last_seen"],
            )
            session.add(inst)

        for r in extract_items:
            result = await session.execute(
                select(ExtractActionItem).where(
                    ExtractActionItem.correlation_id == r["correlation_id"]
                )
            )
            if result.scalar_one_or_none():
                continue
            item = ExtractActionItem(
                correlation_id=r["correlation_id"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                license_key=r["license_key"],
                installation_id=r["installation_id"],
                input_json=r["input_json"],
                output_json=r["output_json"],
                input_hash=r["input_hash"] if "input_hash" in r.keys() else None,
                status=r["status"] or "pending",
                error_message=r["error_message"],
                http_status_code=r["http_status_code"],
                duration_ms=r["duration_ms"],
            )
            session.add(item)

        for r in api_requests:
            req = ApiRequest(
                timestamp=r["timestamp"],
                service=r["service"],
                endpoint=r["endpoint"],
                method=r["method"],
                user_identifier=r["user_identifier"],
                request_body=r["request_body"],
                response_body=r["response_body"],
                status_code=r["status_code"],
                duration_ms=r["duration_ms"],
            )
            session.add(req)

        await session.commit()

    await engine.dispose()
    print(f"  Migrated {len(licenses)} license(s)")
    print(f"  Migrated {len(installations)} installation(s)")
    print(f"  Migrated {len(extract_items)} extract_action_item(s)")
    if migrate_api_requests:
        print(f"  Migrated {len(api_requests)} api_request(s)")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(migrate_to_postgres())
