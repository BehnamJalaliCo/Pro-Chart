"""تولید و اعتبارسنجی کد رفرال — منطق خالص و قابل‌تست."""

from __future__ import annotations

import secrets

# بدون کاراکترهای مبهم (0/O/1/I/L) برای خوانایی
_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8
_VALID_RE = None  # lazy


def generate(length: int = CODE_LENGTH) -> str:
    """تولید یک کد رفرال تصادفی با طول مشخص."""
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))


def is_valid(code: str) -> bool:
    """آیا رشته یک کد رفرال با فرمت معتبر است؟ (طول و کاراکترهای مجاز)"""
    if not code:
        return False
    code = code.strip().upper()
    if len(code) != CODE_LENGTH:
        return False
    return all(c in _ALPHABET for c in code)


def normalize(code: str) -> str:
    """یکدست‌سازی کد برای جستجو (حذف فاصله، بزرگ‌کردن حروف)."""
    return (code or "").strip().upper()
