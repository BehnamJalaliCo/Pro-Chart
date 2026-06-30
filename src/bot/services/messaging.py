"""هلپرهای ارسال پیام + لاگ خروجی در جدول bot_messages."""

from __future__ import annotations

from typing import Any

from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError, TelegramRetryAfter

from src.core.database import BotMessage, async_session_factory
from src.core.logger import get_logger

logger = get_logger("bot.services.messaging")

_MAX_CONTENT = 1000


async def log_message(
    telegram_id: int,
    direction: str,
    content: str | None,
    message_type: str | None = None,
    handler: str | None = None,
) -> None:
    """درج یک رکورد لاگ در bot_messages. خطاها بلعیده می‌شوند (لاگ نباید جریان را بشکند)."""
    try:
        async with async_session_factory() as session:
            session.add(
                BotMessage(
                    telegram_id=telegram_id,
                    direction=direction,
                    message_type=message_type,
                    content=(content or "")[:_MAX_CONTENT] or None,
                    handler=handler,
                )
            )
            await session.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("bot_message_log_failed", error=str(exc))


async def send(
    bot: Bot,
    chat_id: int,
    text: str,
    *,
    log: bool = True,
    handler: str | None = None,
    **kwargs: Any,
) -> bool:
    """ارسال پیام متنی + لاگ خروجی. در صورت بلاک‌بودن کاربر False برمی‌گرداند."""
    try:
        await bot.send_message(chat_id, text, **kwargs)
    except TelegramRetryAfter as exc:
        import asyncio
        await asyncio.sleep(exc.retry_after)
        try:
            await bot.send_message(chat_id, text, **kwargs)
        except Exception as exc2:  # noqa: BLE001
            logger.warning("send_retry_failed", chat_id=chat_id, error=str(exc2))
            return False
    except TelegramForbiddenError:
        logger.info("send_forbidden", chat_id=chat_id)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("send_failed", chat_id=chat_id, error=str(exc))
        return False

    if log:
        await log_message(chat_id, "out", text, message_type="text", handler=handler)
    return True
