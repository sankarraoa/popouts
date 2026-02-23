from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "License Management Service"
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8001  # Railway overrides via PORT env var

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
