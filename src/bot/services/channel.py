"""عملیات کانال VIP — ساخت لینک دعوت و حذف عضو.

واقعیت فنی تلگرام: ربات نمی‌تواند کاربر را مستقیم به کانال add کند؛ فقط می‌تواند
لینک دعوت تک‌مصرفه بسازد. حذف = ban سپس unban (kick). تمام توابع خطاها را
مدیریت می‌کنند و هرگز به هندلر throw نمی‌کنند.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from aiogram import Bot
from aiogram.exceptions import (
    TelegramBadRequest,
    TelegramForbiddenError,
    TelegramRetryAfter,
)

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger("bot.services.channel")


def channel_id() -> str:
    """شناسه‌ی کانال VIP از تنظیمات."""
    return settings.TELEGRAM_CHANNEL_ID


async def create_invite(bot: Bot, ttl_hours: int = 24, name: str | None = None) -> str | None:
    """ساخت لینک دعوت تک‌مصرفه‌ی منقضی‌شونده. در صورت خطا None.

    ربات باید در کانال ادمین با دسترسی «دعوت کاربر» باشد.
    """
    try:
        link = await bot.create_chat_invite_link(
            chat_id=channel_id(),
            expire_date=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
            member_limit=1,
            name=(name or "")[:32] or None,
        )
        return link.invite_link
    except (TelegramForbiddenError, TelegramBadRequest) as exc:
        logger.error("invite_create_failed", error=str(exc))
        return None
    except TelegramRetryAfter as exc:
        logger.warning("invite_create_rate_limited", retry_after=exc.retry_after)
        return None


async def remove_member(bot: Bot, telegram_id: int) -> bool:
    """حذف کاربر از کانال = ban سپس unban (تا بتواند بعداً دوباره عضو شود).

    «عضو نیست» را موفقیت idempotent در نظر می‌گیرد.
    """
    cid = channel_id()
    try:
        await bot.ban_chat_member(chat_id=cid, user_id=telegram_id)
        await bot.unban_chat_member(chat_id=cid, user_id=telegram_id, only_if_banned=True)
        return True
    except TelegramBadRequest as exc:
        msg = str(exc).lower()
        # خطای «دسترسیِ کافی نیست» = شکستِ واقعی → باید بعداً دوباره تلاش شود (نه idempotent!)
        if "not enough rights" in msg or "admin" in msg or "rights" in msg or "restrict" in msg:
            logger.error("remove_member_no_rights", telegram_id=telegram_id, error=str(exc))
            return False
        # «کاربر یافت نشد»/«عضو نیست» → عملاً حذف‌شده محسوب می‌شود
        logger.warning("remove_member_noop", telegram_id=telegram_id, error=str(exc))
        return True
    except (TelegramForbiddenError, TelegramRetryAfter) as exc:
        logger.error("remove_member_failed", telegram_id=telegram_id, error=str(exc))
        return False
