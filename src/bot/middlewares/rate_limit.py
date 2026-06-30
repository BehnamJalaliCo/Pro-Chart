"""میان‌افزار محدودیت نرخ — حداکثر ۳۰ پیام در دقیقه برای هر کاربر.

پنجره‌ی ثابت دقیقه‌ای با Redis (INCR + EXPIRE). در صورت خطای Redis، fail-open
(جریان مسدود نمی‌شود). پیام هشدار فقط یک‌بار (در پیام سی‌ویکم) ارسال می‌شود.
"""

from __future__ import annotations

import time
from typing import Any, Awaitable, Callable

from aiogram import BaseMiddleware
from aiogram.types import TelegramObject, Update

from src.bot import texts
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("bot.middleware.rate_limit")

LIMIT = 30


def _user_id_from_update(event: Update) -> int | None:
    if event.message and event.message.from_user:
        return event.message.from_user.id
    if event.callback_query and event.callback_query.from_user:
        return event.callback_query.from_user.id
    return None


class RateLimitMiddleware(BaseMiddleware):
    async def __call__(
        self,
        handler: Callable[[TelegramObject, dict[str, Any]], Awaitable[Any]],
        event: TelegramObject,
        data: dict[str, Any],
    ) -> Any:
        uid = _user_id_from_update(event) if isinstance(event, Update) else None
        if uid is None:
            return await handler(event, data)

        bucket = int(time.time() // 60)
        key = f"rate:{uid}:{bucket}"
        try:
            count = await redis_client.client.incr(key)
            if count == 1:
                await redis_client.client.expire(key, 90)
        except Exception:  # noqa: BLE001 — fail-open
            return await handler(event, data)

        if count > LIMIT:
            if count == LIMIT + 1 and event.message:
                try:
                    await event.message.answer(texts.RATE_LIMITED)
                except Exception:  # noqa: BLE001
                    pass
            return None
        return await handler(event, data)
