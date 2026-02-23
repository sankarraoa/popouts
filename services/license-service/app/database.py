import os
import aiosqlite
from pathlib import Path
from app.utils.logger import get_logger

logger = get_logger(__name__)

# Determine database directory:
# 1. DB_PATH env var (explicit override)
# 2. /data (Railway volume mount)
# 3. Sibling 'data' directory (local dev)
_env_path = os.environ.get("DB_PATH")
if _env_path:
    DB_DIR = Path(_env_path)
elif Path("/data").exists():
    DB_DIR = Path("/data")
else:
    DB_DIR = Path(__file__).parent.parent.parent / "data"

DB_FILE = DB_DIR / "licenses.db"
DB_DIR.mkdir(exist_ok=True)


async def get_db_connection():
    conn = await aiosqlite.connect(str(DB_FILE))
    conn.row_factory = aiosqlite.Row
    return conn


async def init_database():
    conn = await get_db_connection()
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS licenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                license_key TEXT UNIQUE NOT NULL,
                expiry_date TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'active',
                UNIQUE(email, license_key)
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS installations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                installation_id TEXT NOT NULL,
                activated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(email, installation_id),
                FOREIGN KEY (email) REFERENCES licenses(email)
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_installations_email ON installations(email)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_installations_id ON installations(installation_id)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email)")
        await conn.commit()
        logger.info(f"Database initialized at {DB_FILE}")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        raise
    finally:
        await conn.close()
