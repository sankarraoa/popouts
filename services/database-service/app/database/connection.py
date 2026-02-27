"""Async database connection - SQLite or PostgreSQL via SQLAlchemy."""
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database.models import Base
from app.utils.logger import get_logger

logger = get_logger(__name__)

_engine = None
_async_session_factory = None


def _get_engine():
    global _engine
    if _engine is None:
        url = settings.resolved_database_url
        # SQLite needs check_same_thread=False for async
        connect_args = {} if "postgresql" in url else {"check_same_thread": False}
        _engine = create_async_engine(
            url,
            echo=False,
            connect_args=connect_args,
        )
        if "postgresql" in url:
            db_info = url.split("@")[-1].split("/")[-1] if "@" in url else "postgresql"
            logger.info(f"Database: PostgreSQL ({db_info})")
        else:
            db_path = url.split("///")[-1] if "///" in url else url
            logger.info(f"Database: SQLite ({db_path})")
    return _engine


def _get_session_factory():
    global _async_session_factory
    if _async_session_factory is None:
        engine = _get_engine()
        _async_session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _async_session_factory


async def init_database():
    """Create tables if they don't exist."""
    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized")


@asynccontextmanager
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for async session."""
    factory = _get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def async_session_factory():
    return _get_session_factory()
