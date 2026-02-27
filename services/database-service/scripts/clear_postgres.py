#!/usr/bin/env python3
"""
Clear all data from PostgreSQL tables (licenses, installations, extract_action_items, api_requests).
Use before a fresh migration.

Usage:
    cd services/database-service
    python scripts/clear_postgres.py

    # Or with explicit DATABASE_URL:
    DATABASE_URL=postgresql://user:pass@host:port/db python scripts/clear_postgres.py
"""
import asyncio
import os
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


async def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url or "postgresql" not in database_url:
        print("Error: DATABASE_URL (PostgreSQL) is required")
        sys.exit(1)

    if database_url.startswith("postgresql://") and "+asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(database_url)
    # Order: child tables first (no FKs between ours, but safe order)
    tables = ["api_requests", "extract_action_items", "installations", "licenses"]

    async with engine.begin() as conn:
        for table in tables:
            try:
                await conn.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
                print(f"  Cleared {table}")
            except Exception as e:
                if "does not exist" in str(e).lower():
                    print(f"  Skipped {table} (table does not exist)")
                else:
                    raise

    await engine.dispose()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
