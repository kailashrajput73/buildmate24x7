from functools import lru_cache
from pathlib import Path

from pydantic import EmailStr, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IMAGE_CLOUD_", case_sensitive=False)

    database_url: str
    jwt_secret: SecretStr
    jwt_ttl_minutes: int = 30
    enable_api_docs: bool = False
    bootstrap_admin_email: EmailStr
    bootstrap_admin_password: SecretStr
    cors_origins: list[str] = ["http://localhost:5173"]
    storage_root: Path = Path("/var/lib/buildmate-image-cloud")
    cdn_origin: str = "http://localhost:8000"
    upload_max_bytes: int = 52_428_800
    upload_max_pixels: int = 80_000_000

    @field_validator("cdn_origin")
    @classmethod
    def validate_cdn_origin(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if not value.startswith(("http://", "https://")):
            raise ValueError("IMAGE_CLOUD_CDN_ORIGIN must be an HTTP(S) origin")
        return value

    @field_validator("upload_max_bytes")
    @classmethod
    def validate_upload_max_bytes(cls, value: int) -> int:
        if not 1 <= value <= 524_288_000:
            raise ValueError("IMAGE_CLOUD_UPLOAD_MAX_BYTES must be between 1 and 524288000")
        return value

    @field_validator("jwt_secret")
    @classmethod
    def validate_jwt_secret(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value().encode("utf-8")) < 32:
            raise ValueError("IMAGE_CLOUD_JWT_SECRET must contain at least 32 bytes")
        return value

    @field_validator("jwt_ttl_minutes")
    @classmethod
    def validate_ttl(cls, value: int) -> int:
        if not 5 <= value <= 1440:
            raise ValueError("IMAGE_CLOUD_JWT_TTL_MINUTES must be between 5 and 1440")
        return value

    @field_validator("bootstrap_admin_password")
    @classmethod
    def validate_admin_password(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 14:
            raise ValueError("Bootstrap admin password must be at least 14 characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
