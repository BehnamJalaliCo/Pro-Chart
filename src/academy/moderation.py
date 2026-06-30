"""مودراسیونِ انجمنِ آکادمی — مسدودسازیِ تبلیغات/اطلاعاتِ تماس/لینک + بررسیِ AI.

hard_block(text) → اگر شماره/ایمیل/لینک/آیدی/کلمهٔ تبلیغی باشد، دلیل را برمی‌گرداند (رد).
ai_review(text) → True یعنی تمیز (انتشار)، False یعنی برود به صفِ بازبینیِ ادمین.
"""
from __future__ import annotations

import re

from src.llm.client import llm_client
from src.core.logger import get_logger

logger = get_logger(__name__)

_PATTERNS = [
    (re.compile(r"(?:\+?\d[\d\s\-\(\)]{8,}\d)"), "شمارهٔ تماس"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "ایمیل"),
    (re.compile(r"(?:https?://|www\.|t\.me/|wa\.me/|telegram\.me|whatsapp|instagram\.com|\.ir\b|\.com\b)", re.I), "لینک/شبکهٔ اجتماعی"),
    (re.compile(r"@[A-Za-z0-9_]{4,}"), "آیدیِ کاربری"),
    (re.compile(r"[۰-۹]{7,}"), "شمارهٔ فارسی"),
]
_AD_WORDS = re.compile(
    r"(تخفیف|بخر[یي]د|سیگنالِ?\s*رایگان|کانالِ?\s*ما|عضو\s*شو|سودِ?\s*تضمین|ثبتِ?\s*نام\s*کن|"
    r"آیدی\s*بدم|دایرکت|پیج\s*ما|لینکِ?\s*ثبت|قیمتِ?\s*ویژه|همکاری\s*در\s*فروش)", re.I)


def hard_block(text: str) -> str | None:
    t = text or ""
    for pat, label in _PATTERNS:
        if pat.search(t):
            return label
    if _AD_WORDS.search(t):
        return "تبلیغ/اسپم"
    return None


async def ai_review(text: str) -> bool:
    """True = تمیز و قابلِ انتشار؛ False = مشکوک (صفِ بازبینی)."""
    try:
        r = await llm_client.complete(
            f"پیامِ زیر در انجمنِ آموزشیِ فارکس است. اگر تبلیغ، اسپم، توهین، کلاهبرداری یا "
            f"کاملاً خارج از موضوعِ آموزش/بازار است فقط «BAD» بنویس؛ در غیرِ این صورت فقط «OK».\n\nپیام: {text[:1000]}",
            system="تو مودراتورِ سخت‌گیرِ یک انجمنِ آموزشی هستی. فقط یک کلمه: OK یا BAD.",
            system_replace=True, timeout=30)
        if r and "BAD" in r.upper():
            return False
        return True
    except Exception as exc:  # noqa: BLE001 — در خطا، محتاطانه به بازبینی
        logger.warning("moderation_ai_failed", error=str(exc))
        return False
