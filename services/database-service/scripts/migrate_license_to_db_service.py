#!/usr/bin/env python3
"""
Migrate license data from license-service SQLite to database-service SQLite.

Usage:
    # From services/database-service directory:

    # For Docker (database-service uses services/db-data):
    DB_TARGET=../db-data/licenses.db python scripts/migrate_license_to_db_service.py

    # For local uvicorn (uses database-service/data):
    python scripts/migrate_license_to_db_service.py

    # With custom paths:
    LICENSE_SOURCE_DB=../data/licenses.db DB_TARGET=../db-data/licenses.db python scripts/migrate_license_to_db_service.py

Environment:
    LICENSE_SOURCE_DB: Path to license-service SQLite (default: ../data/licenses.db)
    DB_TARGET: Path to database-service SQLite (default: ./data/licenses.db for local; use ../db-data/licenses.db for Docker)
"""
import os
import sqlite3
import sys
from pathlib import Path

# Default paths relative to this script's location
SCRIPT_DIR = Path(__file__).resolve().parent
DB_SERVICE_ROOT = SCRIPT_DIR.parent
SERVICES_ROOT = DB_SERVICE_ROOT.parent
DEFAULT_SOURCE = SERVICES_ROOT / "data" / "licenses.db"
# Docker uses services/db-data; local uvicorn uses database-service/data
DEFAULT_TARGET = SERVICES_ROOT / "db-data" / "licenses.db"


def migrate(source_path: Path, target_path: Path) -> None:
    """Copy licenses and installations from source to target."""
    if not source_path.exists():
        print(f"Error: Source database not found: {source_path}")
        print("  Run license-service at least once to create the database.")
        sys.exit(1)

    target_path.parent.mkdir(parents=True, exist_ok=True)

    src = sqlite3.connect(str(source_path))
    src.row_factory = sqlite3.Row

    tgt = sqlite3.connect(str(target_path))
    tgt.row_factory = sqlite3.Row

    try:
        # Ensure target has tables
        tgt.executescript("""
            CREATE TABLE IF NOT EXISTS licenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                license_key TEXT UNIQUE NOT NULL,
                expiry_date TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active',
                UNIQUE(email, license_key)
            );
            CREATE TABLE IF NOT EXISTS installations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                installation_id TEXT NOT NULL,
                activated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(email, installation_id),
                FOREIGN KEY (email) REFERENCES licenses(email)
            );
        """)
        tgt.commit()

        # Copy licenses
        licenses = src.execute("SELECT id, email, license_key, expiry_date, created_at, status FROM licenses").fetchall()
        for r in licenses:
            try:
                tgt.execute(
                    """INSERT OR REPLACE INTO licenses (id, email, license_key, expiry_date, created_at, status)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (r["id"], r["email"], r["license_key"], r["expiry_date"], r["created_at"], r["status"]),
                )
            except sqlite3.IntegrityError as e:
                # Try without id for auto-increment
                tgt.execute(
                    """INSERT OR REPLACE INTO licenses (email, license_key, expiry_date, created_at, status)
                       VALUES (?, ?, ?, ?, ?)""",
                    (r["email"], r["license_key"], r["expiry_date"], r["created_at"], r["status"]),
                )
        tgt.commit()
        print(f"  Migrated {len(licenses)} license(s)")

        # Copy installations
        installations = src.execute(
            "SELECT id, email, installation_id, activated_at, last_seen FROM installations"
        ).fetchall()
        for r in installations:
            try:
                tgt.execute(
                    """INSERT OR REPLACE INTO installations (id, email, installation_id, activated_at, last_seen)
                       VALUES (?, ?, ?, ?, ?)""",
                    (r["id"], r["email"], r["installation_id"], r["activated_at"], r["last_seen"]),
                )
            except sqlite3.IntegrityError:
                tgt.execute(
                    """INSERT OR REPLACE INTO installations (email, installation_id, activated_at, last_seen)
                       VALUES (?, ?, ?, ?)""",
                    (r["email"], r["installation_id"], r["activated_at"], r["last_seen"]),
                )
        tgt.commit()
        print(f"  Migrated {len(installations)} installation(s)")

    finally:
        src.close()
        tgt.close()


def main():
    source = Path(os.environ.get("LICENSE_SOURCE_DB", str(DEFAULT_SOURCE)))
    target = Path(os.environ.get("DB_TARGET", str(DEFAULT_TARGET)))

    print(f"Migrating license data:")
    print(f"  Source: {source}")
    print(f"  Target: {target}")
    migrate(source, target)
    print("Done.")


if __name__ == "__main__":
    main()
