from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from app.api.routes import router
from app.api.license_routes import router as license_router
from app.config import settings
from app.utils.logger import setup_logging
from app.database import init_database

# Setup logging
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_database()
    yield
    # Shutdown (if needed)


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Microservice for extracting action items from meeting notes using LLM",
    lifespan=lifespan
)

# CORS middleware for local development and Railway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(router)
app.include_router(license_router)


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": settings.version,
        "status": "running",
        "test_page": "/test"
    }


@app.get("/test")
async def test_page():
    """Serve the test HTML page"""
    test_file = Path(__file__).parent.parent / "test.html"
    if test_file.exists():
        return FileResponse(test_file)
    return {"error": "Test page not found"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True
    )
