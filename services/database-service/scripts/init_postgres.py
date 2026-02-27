#!/usr/bin/env python3
"""
Initialize PostgreSQL tables for the database service.
Uses SQLAlchemy to create all tables from models.

Usage:
    # From project root or database-service directory:
    DATABASE_URL=postgresql://user:pass@host:port/db python scripts/init_postgres.py

    # Or with .env (ensure DATABASE_URL is set):
    python scripts/init_postgres.py

The app also creates tables automatically on startup. Use this script when you need
to initialize the schema before first deploy, or to verify the connection.
"""
import asyncio
import os
import sys
from pathlib import Path

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


async def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL is required (e.g. postgresql://user:pass@host:port/db)")
        sys.exit(1)

    if database_url.startswith("postgresql://") and "+asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    print(f"Initializing PostgreSQL schema...")
    print(f"  URL: {database_url.split('@')[-1] if '@' in database_url else '(hidden)'}")

    from sqlalchemy.ext.asyncio import create_async_engine
    from app.database.models import Base

    engine = create_async_engine(database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await engine.dispose()
    print("  Tables created: licenses, installations, api_requests, extract_action_items")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
