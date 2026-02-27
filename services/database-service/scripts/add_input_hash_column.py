#!/usr/bin/env python3
"""
Add input_hash column to extract_action_items for both SQLite and PostgreSQL.
Run this to migrate existing databases (local SQLite and Railway PostgreSQL).

Usage:
    # PostgreSQL (Railway) - uses DATABASE_URL from .env:
    cd services/database-service && python scripts/add_input_hash_column.py

    # SQLite - specify DB_PATH or use default (./data/licenses.db):
    DB_PATH=./data python scripts/add_input_hash_column.py

    # Or run against a specific SQLite file:
    python scripts/add_input_hash_column.py --sqlite ../db-data/licenses.db
"""
import argparse
import asyncio
import hashlib
import json
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


def _run_sqlite_migration(db_path: Path) -> None:
    """Add input_hash column to SQLite extract_action_items."""
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()

    # Check if column exists
    cur.execute("PRAGMA table_info(extract_action_items)")
    columns = [row[1] for row in cur.fetchall()]
    if "input_hash" in columns:
        print(f"  SQLite: input_hash column already exists in {db_path}")
        conn.close()
        return

    print(f"  SQLite: Adding input_hash column to {db_path}")
    cur.execute("ALTER TABLE extract_action_items ADD COLUMN input_hash VARCHAR(64)")
    conn.commit()

    # Create unique index (SQLite allows multiple NULLs in unique index)
    cur.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_extract_action_items_input_hash "
        "ON extract_action_items (input_hash) WHERE input_hash IS NOT NULL"
    )
    conn.commit()

    # Backfill input_hash from input_json (only first row per unique hash to avoid constraint violation)
    cur.execute(
        "SELECT id, input_json FROM extract_action_items "
        "WHERE input_hash IS NULL AND input_json IS NOT NULL ORDER BY id"
    )
    rows = cur.fetchall()
    seen_hashes = set()
    backfilled = 0
    for row_id, input_json in rows:
        if input_json:
            try:
                canonical = json.dumps(json.loads(input_json), sort_keys=True)
                h = hashlib.sha256(canonical.encode()).hexdigest()
                if h in seen_hashes:
                    continue
                seen_hashes.add(h)
                cur.execute("UPDATE extract_action_items SET input_hash = ? WHERE id = ?", (h, row_id))
                backfilled += 1
            except (json.JSONDecodeError, TypeError):
                pass
    conn.commit()
    print(f"  SQLite: Backfilled {backfilled} row(s)")
    conn.close()


async def _run_postgres_migration(database_url: str) -> None:
    """Add input_hash column to PostgreSQL extract_action_items."""
    if database_url.startswith("postgresql://") and "+asyncpg" not in database_url:
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(database_url)

    # Schema changes (transaction 1)
    async with engine.begin() as conn:
        print("  PostgreSQL: Adding input_hash column (if not exists)")
        await conn.execute(text(
            "ALTER TABLE extract_action_items ADD COLUMN IF NOT EXISTS input_hash VARCHAR(64)"
        ))
        await conn.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS ix_extract_action_items_input_hash
            ON extract_action_items (input_hash) WHERE input_hash IS NOT NULL
        """))

    # Backfill: only update first row per unique hash to avoid unique violation
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            SELECT id, input_json FROM extract_action_items
            WHERE input_hash IS NULL AND input_json IS NOT NULL
            ORDER BY id
        """))
        rows = result.fetchall()
        seen_hashes = set()
        backfilled = 0
        for row_id, input_json in rows:
            if input_json:
                try:
                    canonical = json.dumps(json.loads(input_json), sort_keys=True)
                    h = hashlib.sha256(canonical.encode()).hexdigest()
                    if h in seen_hashes:
                        continue  # Skip duplicate input - first row already has this hash
                    seen_hashes.add(h)
                    await conn.execute(
                        text("UPDATE extract_action_items SET input_hash = :h WHERE id = :id"),
                        {"h": h, "id": row_id}
                    )
                    backfilled += 1
                except (json.JSONDecodeError, TypeError):
                    pass
        print(f"  PostgreSQL: Backfilled {backfilled} row(s)")

    await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Add input_hash column to extract_action_items")
    parser.add_argument(
        "--sqlite",
        metavar="PATH",
        help="Path to SQLite DB (e.g. ../db-data/licenses.db). If not set, uses DATABASE_URL or default.",
    )
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    sqlite_path = args.sqlite

    if sqlite_path:
        # Explicit SQLite path
        path = Path(sqlite_path)
        if not path.is_absolute():
            path = (DB_SERVICE_ROOT / path).resolve()
        if not path.exists():
            print(f"Error: SQLite file not found: {path}")
            sys.exit(1)
        print(f"Migrating SQLite: {path}")
        _run_sqlite_migration(path)
        print("Done.")
        return

    if database_url and "postgresql" in database_url:
        # PostgreSQL (Railway)
        print("Migrating PostgreSQL (Railway)...")
        asyncio.run(_run_postgres_migration(database_url))
        print("Done.")
        return

    # Default: SQLite
    db_path = os.environ.get("DB_PATH", str(DB_SERVICE_ROOT / "data" / "licenses.db"))
    path = Path(db_path)
    if path.is_dir():
        path = path / "licenses.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        print(f"SQLite DB not found at {path}. Creating tables on first run will include input_hash.")
        sys.exit(0)
    print(f"Migrating SQLite: {path}")
    _run_sqlite_migration(path)
    print("Done.")


if __name__ == "__main__":
    main()
