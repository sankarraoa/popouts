import os
from pathlib import Path

from pydantic_settings import BaseSettings


def _default_sqlite_url() -> str:
    """Default SQLite path: DB_PATH or /data or ./data"""
    env_path = os.environ.get("DB_PATH")
    if env_path:
        db_dir = Path(env_path)
    elif Path("/data").exists():
        db_dir = Path("/data")
    else:
        db_dir = Path(__file__).parent.parent / "data"
    db_dir.mkdir(exist_ok=True)
    return f"sqlite+aiosqlite:///{db_dir / 'licenses.db'}"


class Settings(BaseSettings):
    app_name: str = "Database Service"
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8002  # Railway overrides via PORT env var

    # Database: sqlite+aiosqlite:///path or postgresql+asyncpg://user:pass@host:port/db
    # Railway provides DATABASE_URL; for local SQLite it's optional
    database_url: str | None = None

    @property
    def resolved_database_url(self) -> str:
        url = self.database_url or os.environ.get("DATABASE_URL") or _default_sqlite_url()
        # Railway DATABASE_URL is postgresql:// - convert to postgresql+asyncpg://
        if url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
