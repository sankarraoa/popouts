from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from app.api.routes import router
from app.config import settings
from app.utils.logger import setup_logging

setup_logging()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="Microservice for extracting action items from meeting notes using LLM",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Required when using * — CORS spec forbids * with credentials
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {
        "service": settings.app_name,
        "version": settings.version,
        "status": "running",
        "test_page": "/test",
    }


@app.get("/test")
async def test_page():
    test_file = Path(__file__).parent.parent / "test.html"
    if test_file.exists():
        return FileResponse(test_file)
    return {"error": "Test page not found"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
