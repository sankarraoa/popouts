from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # Server Configuration
    app_name: str = "LLM Action Extraction Service"
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8000
    
    # LLM Provider Configuration
    llm_provider: Literal["toqan", "openai"] = "openai"
    
    # Toqan Configuration
    toqan_api_key: str = ""
    
    # OpenAI Configuration
    openai_api_key: str = ""
    openai_model: str = "gpt-4"
    
    # Service Configuration
    request_timeout: int = 30
    max_retries: int = 3
    toqan_poll_interval: int = 2  # seconds between polling get_answer
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
