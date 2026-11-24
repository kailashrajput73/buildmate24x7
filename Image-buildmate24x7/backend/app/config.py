from functools import lru_cache

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
