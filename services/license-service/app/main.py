from pathlib import Path

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import settings
from app.database import init_database
from app.utils.logger import setup_logging

PUBLIC_DIR = Path(__file__).parent.parent / "public"

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="License management service for Popouts",
    lifespan=lifespan,
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


@app.get("/admin")
async def admin():
    """License management web interface."""
    index_path = PUBLIC_DIR / "admin.html"
    if not index_path.exists():
        return {"error": "Admin UI not found"}
    return FileResponse(index_path)


app.mount("/admin-assets", StaticFiles(directory=str(PUBLIC_DIR)), name="admin-assets")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
