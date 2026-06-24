import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App config
    PROJECT_NAME: str = "AIInspect Pro API"
    API_V1_STR: str = "/api"
    
    # JWT Auth Config
    SECRET_KEY: str = "g-r0-q-1n-sp-e-c-t-p-r-0-s-3-c-r-3-t-k-3-y-v-3-n-t-u-r-3-s"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days for demo
    
    # DB configuration (fallback handled in db module)
    DATABASE_URL: Optional[str] = None
    
    # Groq & AI Keys
    GROQ_API_KEY: Optional[str] = None
    
    # AWS S3 Storage
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET_NAME: Optional[str] = None
    
    # Email configs
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASS: Optional[str] = None
    ADMIN_EMAIL: Optional[str] = None
    ADMIN_PHONE: str = "+1234567890"

    model_config = SettingsConfigDict(
        env_file=[
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), ".env")
        ],
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
