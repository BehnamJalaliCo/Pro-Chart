"""میان‌افزار لاگ پیام‌های ورودی + چک مسدودیت کاربر.

ورودی‌ها را به‌صورت غیرمسدودکننده در bot_messages لاگ می‌کند و کاربران مسدود
(User.is_banned) را short-circuit می‌کند.
"""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Update
from sqlalchemy import select

from src.bot import texts
from src.bot.services.messaging import log_message
from src.core.database import User, async_session_factory
from src.core.logger import get_logger

logger = get_logger("bot.middleware.logging")


def _extract(event: Update) -> tuple[int | None, str | None, str | None]:
    """(telegram_id, message_type, content) از یک Update."""
    if event.message and event.message.from_user:
        msg = event.message
        if msg.contact is not None:
            return msg.from_user.id, "contact", msg.contact.phone_number
        text = msg.text or msg.caption or msg.content_type
        mtype = "command" if (msg.text or "").startswith("/") else "text"
        return msg.from_user.id, mtype, text
    if event.callback_query and event.callback_query.from_user:
        return event.callback_query.from_user.id, "callback", event.callback_query.data
    return None, None, None


async def _is_banned(telegram_id: int) -> bool:
    try:
        async with async_session_factory() as s:
            res = await s.execute(
                select(User.is_banned).where(User.telegram_id == telegram_id)
            )
            return bool(res.scalar_one_or_none())
    except Exception:  # noqa: BLE001 — در تردید، مسدود نکن
        return False


class MessageLoggingMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        if not isinstance(event, Update):
            return await handler(event, data)

        tid, mtype, content = _extract(event)
        if tid is None:
            return await handler(event, data)

        # لاگ ورودی به‌صورت غیرمسدودکننده
        asyncio.create_task(log_message(tid, "in", content, message_type=mtype))

        # چک مسدودیت — اجازه‌ی /start را بده تا کاربر بتواند پیام ببیند؟ خیر، مسدود یعنی مسدود.
        if await _is_banned(tid):
            if event.message:
                with_suppress = getattr(event.message, "answer", None)
                if with_suppress:
                    try:
                        await event.message.answer(texts.BANNED)
                    except Exception:  # noqa: BLE001
                        pass
            elif event.callback_query:
                try:
                    await event.callback_query.answer(texts.BANNED, show_alert=True)
                except Exception:  # noqa: BLE001
                    pass
            return None

        return await handler(event, data)
