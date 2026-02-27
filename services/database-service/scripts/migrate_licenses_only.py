#!/usr/bin/env python3
"""
Migrate ONLY licenses from SQLite to PostgreSQL.
Skips installations, extract_action_items, and api_requests.

Use when you have a SQLite file (e.g. from license-service volume) and want
to copy just the license records into Railway PostgreSQL.

If SQLite is in a Railway volume: download it first (e.g. Railway CLI, or run
a one-off container that copies the file to a downloadable location), then
run this script locally with LICENSE_SOURCE_DB pointing to the downloaded file.

Usage:
    cd services/database-service

    # With .env containing DATABASE_URL:
    python scripts/migrate_licenses_only.py

    # Or specify source and target:
    LICENSE_SOURCE_DB=/path/to/licenses.db DATABASE_URL=postgresql://... python scripts/migrate_licenses_only.py

Environment:
    LICENSE_SOURCE_DB: Path to source SQLite file (default: ../db-data/licenses.db)
    DATABASE_URL: PostgreSQL connection URL (required)
"""
import asyncio
import os
import sqlite3
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DB_SERVICE_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(DB_SERVICE_ROOT))

if not os.environ.get("DATABASE_URL"):
    try:
        from dotenv import load_dotenv
        load_dotenv(DB_SERVICE_ROOT / ".env")
    except ImportError:
        pass

SERVICES_ROOT = DB_SERVICE_ROOT.parent
DEFAULT_SOURCE = SERVICES_ROOT / "db-data" / "licenses.db"


def _fetch_licenses(src) -> list:
    """Fetch all rows from licenses table."""
    try:
        return src.execute(
            "SELECT email, license_key, expiry_date, created_at, status FROM licenses"
        ).fetchall()
    except sqlite3.OperationalError as e:
        if "no such table" in str(e).lower():
            return []
        raise


async def migrate_licenses():
    source = Path(os.environ.get("LICENSE_SOURCE_DB", str(DEFAULT_SOURCE)))
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        print("Error: DATABASE_URL is required (e.g. postgresql://user:pass@host:port/db)")
        sys.exit(1)

    if not source.exists():
        print(f"Error: Source SQLite not found: {source}")
        sys.exit(1)

    if database_url.startswith("postgresql://") and "+asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    print(f"Migrating licenses only:")
    print(f"  Source: {source}")
    print(f"  Target: PostgreSQL")

    # Read from SQLite
    src = sqlite3.connect(str(source))
    src.row_factory = sqlite3.Row
    try:
        rows = _fetch_licenses(src)
    finally:
        src.close()

    if not rows:
        print("  No licenses found in source.")
        return

    print(f"  Found {len(rows)} license(s)")

    # Write to PostgreSQL
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from app.database.models import License

    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    inserted = 0
    skipped = 0

    async with factory() as session:
        for row in rows:
            r = dict(row)
            result = await session.execute(
                select(License).where(License.license_key == r["license_key"])
            )
            if result.scalar_one_or_none():
                skipped += 1
                continue
            lic = License(
                email=r["email"],
                license_key=r["license_key"],
                expiry_date=r["expiry_date"],
                created_at=r["created_at"],
                status=r["status"] or "active",
            )
            session.add(lic)
            inserted += 1
        await session.commit()

    await engine.dispose()
    print(f"  Inserted: {inserted}")
    print(f"  Skipped (already exist): {skipped}")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(migrate_licenses())
