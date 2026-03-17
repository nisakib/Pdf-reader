import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    redis_url: str = "redis://redis:6379/0"
    data_dir: str = "/data"
    max_upload_size_mb: int = 50
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    translation_provider: str = "openai"  # openai | mock

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
