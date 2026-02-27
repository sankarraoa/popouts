from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    app_name: str = "LLM Action Extraction Service"
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8000  # Railway overrides via PORT env var

    llm_provider: Literal["toqan", "openai"] = "openai"

    toqan_api_key: str = ""
    openai_api_key: str = ""
    openai_model: str = "gpt-4"

    request_timeout: int = 30
    max_retries: int = 3
    toqan_poll_interval: int = 2

    database_service_url: str = ""  # e.g. http://localhost:8002

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
