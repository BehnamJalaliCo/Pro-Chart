"""امنیت — امضای RS256 + سازگاریِ عقب‌روِ HS256 + هشِ پسورد + JWKS."""
from __future__ import annotations

import base64
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Optional

from jose import JWTError, jwt
from jose.utils import long_to_base64
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


@lru_cache
def _private_key() -> str:
    with open(settings.JWT_PRIVATE_KEY_PATH, "r", encoding="utf-8") as f:
        return f.read()


@lru_cache
def _public_key() -> str:
    with open(settings.JWT_PUBLIC_KEY_PATH, "r", encoding="utf-8") as f:
        return f.read()


def _mint(data: dict[str, Any], ttl: timedelta, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    payload = data.copy()
    payload.update({
        "exp": now + ttl,
        "iat": now,
        "iss": settings.JWT_ISSUER,
        "jti": uuid.uuid4().hex,
        "type": token_type,
    })
    headers = {"kid": settings.JWT_KID}
    return jwt.encode(payload, _private_key(), algorithm="RS256", headers=headers)


def create_access_token(data: dict[str, Any]) -> str:
    return _mint(data, timedelta(minutes=settings.JWT_ACCESS_TTL_MIN), "access")


def create_refresh_token(data: dict[str, Any]) -> str:
    return _mint(data, timedelta(days=settings.JWT_REFRESH_TTL_DAYS), "refresh")


def decode_token(token: str) -> Optional[dict[str, Any]]:
    """اول RS256 (کلیدِ مرکزی)، بعد در صورتِ فعال بودن، HS256ِ قدیمی."""
    try:
        return jwt.decode(token, _public_key(), algorithms=["RS256"], options={"verify_aud": False})
    except JWTError:
        pass
    if settings.LEGACY_HS256_ENABLED and settings.LEGACY_HS256_SECRET:
        try:
            return jwt.decode(token, settings.LEGACY_HS256_SECRET, algorithms=["HS256"], options={"verify_aud": False})
        except JWTError:
            return None
    return None


def jwks() -> dict[str, Any]:
    """کلیدِ عمومی به فرمتِ JWKS برای verifyِ سرویس‌های دیگر."""
    from cryptography.hazmat.primitives import serialization

    pub = serialization.load_pem_public_key(_public_key().encode())
    numbers = pub.public_numbers()  # type: ignore[attr-defined]
    e = long_to_base64(numbers.e).decode().rstrip("=")
    n = long_to_base64(numbers.n).decode().rstrip("=")
    return {"keys": [{"kty": "RSA", "use": "sig", "alg": "RS256", "kid": settings.JWT_KID, "n": n, "e": e}]}
