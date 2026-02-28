"""
Read licenses from local SQLite DB using fixed paths only (no .env).
Works for: local dev, Docker, and Railway (with volume at /data).
"""
import sqlite3
from pathlib import Path
from typing import Optional


def _get_sqlite_db_path() -> Optional[Path]:
    """
    Return path to licenses.db using fixed logic only (no env vars).
    Tries: Railway/Docker /data, then local services/db-data.
    """
    # 1. Railway / Docker: volume mounted at /data
    railway_path = Path("/data") / "licenses.db"
    if railway_path.exists():
        return railway_path

    # 2. Local: services/db-data/licenses.db (from license-service root)
    # __file__ is app/sqlite_reader.py -> parent.parent = license-service/
    # parent.parent.parent = services/
    services_root = Path(__file__).parent.parent.parent
    local_path = services_root / "db-data" / "licenses.db"
    if local_path.exists():
        return local_path

    # 3. Local uvicorn from license-service/: ./data/licenses.db
    local_data = Path(__file__).parent.parent / "data" / "licenses.db"
    if local_data.exists():
        return local_data

    return None


def get_licenses_from_sqlite() -> dict:
    """
    Read all licenses from SQLite. Does not use .env for DB path.
    Returns dict with path, count, licenses, or error.
    """
    db_file = _get_sqlite_db_path()
    if not db_file:
        return {
            "error": "SQLite file not found",
            "paths_checked": [
                "/data/licenses.db",
                str(Path(__file__).parent.parent.parent / "db-data" / "licenses.db"),
                str(Path(__file__).parent.parent / "data" / "licenses.db"),
            ],
        }

    try:
        conn = sqlite3.connect(str(db_file))
        conn.row_factory = sqlite3.Row
        cur = conn.execute(
            "SELECT id, email, license_key, expiry_date, created_at, status FROM licenses"
        )
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return {"path": str(db_file), "count": len(rows), "licenses": rows}
    except Exception as e:
        return {"error": str(e), "path": str(db_file)}
