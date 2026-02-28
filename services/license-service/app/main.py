from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.utils.logger import setup_logging

setup_logging()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="License management service for Popouts",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {"service": settings.app_name, "version": settings.version, "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/status")
async def status():
    """Report which database backend is configured (for verification)."""
    import os
    url = os.environ.get("DATABASE_SERVICE_URL", "http://localhost:8002")
    # Mask credentials if present
    masked = url.split("@")[-1] if "@" in url else url
    return {
        "database_backend": "database-service (HTTP)",
        "database_service_url": masked,
        "uses_local_sqlite": False,
    }


@app.get("/debug/sqlite-licenses")
async def debug_sqlite_licenses():
    """
    Read licenses from local SQLite using fixed paths only (no .env).
    Tries: /data/licenses.db (Railway/Docker), services/db-data, license-service/data.
    """
    from app.sqlite_reader import get_licenses_from_sqlite

    return get_licenses_from_sqlite()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
