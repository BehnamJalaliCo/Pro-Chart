"""پیکربندیِ سرویسِ Auth مرکزی — از محیط خوانده می‌شود."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # DB
    DB_HOST: str = "central-postgres"
    DB_PORT: int = 5432
    DB_NAME: str = "central_identity"
    DB_USER: str = "central"
    DB_PASSWORD: str = "change-me"

    # RS256
    JWT_PRIVATE_KEY_PATH: str = "/app/keys/jwt_private.pem"
    JWT_PUBLIC_KEY_PATH: str = "/app/keys/jwt_public.pem"
    JWT_KID: str = "central-dev"
    JWT_ISSUER: str = "https://auth.pro-chart.internal"
    JWT_ACCESS_TTL_MIN: int = 30
    JWT_REFRESH_TTL_DAYS: int = 7

    # سازگاریِ عقب‌رو با HS256 قدیمی
    LEGACY_HS256_SECRET: str = ""
    LEGACY_HS256_ENABLED: int = 0

    MAX_DEVICES: int = 2

    # توکنِ داخلی برای مسیرِ bridge (/auth/issue) — باید با BN_BRIDGE_TOKENِ اپ یکی باشد
    BRIDGE_TOKEN: str = ""

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
