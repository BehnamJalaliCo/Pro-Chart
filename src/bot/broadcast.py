"""
Broadcast system — send messages to all active users.

Features:
- Rate limiting at 25 messages/second (Telegram bot API limit)
- Batch processing
- Delivered/failed tracking
- Text + image support
- Scheduled broadcast support via Redis
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from aiogram import Bot
from aiogram.types import InputMediaPhoto
from aiogram.exceptions import (
    TelegramBadRequest,
    TelegramForbiddenError,
    TelegramRetryAfter,
    TelegramNotFound,
)
from sqlalchemy import select

from src.core.config import settings
from src.core.logger import get_logger
from src.core.database import async_session_factory, User
from src.core.redis_client import redis_client

logger = get_logger("bot.broadcast")

# Telegram allows ~30 msg/sec, we use 25 for safety margin
RATE_LIMIT = 25
BATCH_SIZE = 25
BATCH_DELAY = 1.05  # seconds between batches


async def broadcast_message(
    bot: Bot,
    text: str,
    photo_file_id: Optional[str] = None,
    target_user_ids: Optional[list[int]] = None,
) -> tuple[int, int, int]:
    """
    Send a message to all active, non-blocked users.

    Args:
        bot: The aiogram Bot instance.
        text: Message text (HTML format).
        photo_file_id: Optional Telegram photo file_id.
        target_user_ids: Optional explicit list of user IDs.
                         If None, broadcasts to all active users.

    Returns:
        Tuple of (delivered, failed, total).
    """
    # Fetch target users
    if target_user_ids is not None:
        user_ids = target_user_ids
    else:
        user_ids = await _fetch_all_active_user_ids()

    total = len(user_ids)
    delivered = 0
    failed = 0

    logger.info(
        "Starting broadcast to %d users (photo=%s)",
        total,
        bool(photo_file_id),
    )

    # Store broadcast status in Redis
    broadcast_id = f"broadcast:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    await redis_client.hset(
        broadcast_id,
        mapping={
            "total": str(total),
            "delivered": "0",
            "failed": "0",
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    await redis_client.expire(broadcast_id, 86400)  # 24h TTL

    # Process in batches
    for batch_start in range(0, total, BATCH_SIZE):
        batch = user_ids[batch_start : batch_start + BATCH_SIZE]

        # ── pipeline برای fetch وضعیت block تمام users در یک RTT ──
        try:
            async with redis_client.client.pipeline(transaction=False) as pipe:
                for uid in batch:
                    pipe.get(f"user:{uid}:blocked")
                blocked_flags = await pipe.execute()
            blocked_set = {
                uid for uid, flag in zip(batch, blocked_flags) if flag
            }
        except Exception as e:
            logger.warning("broadcast_block_check_failed", error=str(e))
            blocked_set = set()

        # tasks فقط برای users غیر-blocked
        active_batch = [uid for uid in batch if uid not in blocked_set]
        tasks = [
            _send_to_user(bot, uid, text, photo_file_id)
            for uid in active_batch
        ]
        active_results = await asyncio.gather(*tasks, return_exceptions=True)

        # ساخت results به ترتیب batch اصلی (blocked = False)
        result_map = dict(zip(active_batch, active_results))
        results = [
            result_map.get(uid, False) for uid in batch
        ]

        for uid, result in zip(batch, results):
            if isinstance(result, Exception):
                failed += 1
                logger.warning("Broadcast failed for user %s: %s", uid, result)
            elif result is True:
                delivered += 1
            else:
                failed += 1

        # Update progress in Redis
        await redis_client.hset(
            broadcast_id,
            mapping={
                "delivered": str(delivered),
                "failed": str(failed),
            },
        )

        # Rate limit between batches
        if batch_start + BATCH_SIZE < total:
            await asyncio.sleep(BATCH_DELAY)

    # Mark broadcast complete
    await redis_client.hset(
        broadcast_id,
        mapping={
            "delivered": str(delivered),
            "failed": str(failed),
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    logger.info(
        "Broadcast complete: %d delivered, %d failed, %d total",
        delivered,
        failed,
        total,
    )
    return delivered, failed, total


async def _send_to_user(
    bot: Bot,
    user_id: int,
    text: str,
    photo_file_id: Optional[str] = None,
) -> bool:
    """
    Send a single message to a user.
    Returns True on success, False on permanent failure.
    Raises on temporary/retryable failures.
    """
    # Note: block check موش‌برانه توسط caller (در batch با pipeline) انجام می‌شود
    try:
        if photo_file_id:
            await bot.send_photo(
                chat_id=user_id,
                photo=photo_file_id,
                caption=text,
                parse_mode="HTML",
            )
        else:
            await bot.send_message(
                chat_id=user_id,
                text=text,
                parse_mode="HTML",
            )
        return True

    except TelegramRetryAfter as exc:
        # Telegram asks us to wait — respect the retry_after value
        logger.warning(
            "Rate limited for user %s — waiting %s seconds",
            user_id,
            exc.retry_after,
        )
        await asyncio.sleep(exc.retry_after)
        # Retry once
        try:
            if photo_file_id:
                await bot.send_photo(
                    chat_id=user_id,
                    photo=photo_file_id,
                    caption=text,
                    parse_mode="HTML",
                )
            else:
                await bot.send_message(
                    chat_id=user_id,
                    text=text,
                    parse_mode="HTML",
                )
            return True
        except Exception:
            return False

    except TelegramForbiddenError:
        # User blocked the bot — mark inactive
        logger.info("User %s blocked the bot — marking inactive.", user_id)
        await _mark_user_inactive(user_id)
        return False

    except TelegramNotFound:
        # Chat not found — mark inactive
        logger.info("Chat %s not found — marking inactive.", user_id)
        await _mark_user_inactive(user_id)
        return False

    except TelegramBadRequest as exc:
        logger.warning("Bad request for user %s: %s", user_id, exc)
        return False

    except Exception as exc:
        logger.error("Unexpected error sending to %s: %s", user_id, exc)
        return False


async def _fetch_all_active_user_ids() -> list[int]:
    """Fetch all active, non-blocked user Telegram IDs from the database."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(User.telegram_id).where(
                User.is_active == True,
                User.is_banned == False,
            )
        )
        return [row[0] for row in result.fetchall()]


async def _mark_user_inactive(telegram_id: int) -> None:
    """Mark a user as inactive in the database."""
    try:
        async with async_session_factory() as session:
            result = await session.execute(
                select(User).where(User.telegram_id == telegram_id)
            )
            user = result.scalar_one_or_none()
            if user:
                user.is_active = False
                await session.commit()
    except Exception as exc:
        logger.error("Failed to mark user %s inactive: %s", telegram_id, exc)


# ──────────────────────── Scheduled Broadcasts ───────────────

async def schedule_broadcast(
    text: str,
    scheduled_at: datetime,
    photo_file_id: Optional[str] = None,
) -> str:
    """
    Schedule a broadcast for a future time.
    Stores the broadcast in Redis and returns a schedule ID.
    """
    schedule_id = f"scheduled:{scheduled_at.strftime('%Y%m%d%H%M%S')}"

    payload = {
        "text": text,
        "photo": photo_file_id or "",
        "scheduled_at": scheduled_at.isoformat(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await redis_client.hset(schedule_id, mapping=payload)
    # Set TTL to scheduled time + 1 day
    ttl = int((scheduled_at - datetime.now(timezone.utc)).total_seconds()) + 86400
    await redis_client.expire(schedule_id, max(ttl, 3600))

    # Add to the sorted set of pending broadcasts
    await redis_client.zadd(
        "broadcast:scheduled",
        {schedule_id: scheduled_at.timestamp()},
    )

    logger.info("Broadcast scheduled: %s at %s", schedule_id, scheduled_at)
    return schedule_id


async def process_scheduled_broadcasts(bot: Bot) -> None:
    """
    Check and execute any scheduled broadcasts whose time has arrived.
    Should be called periodically (e.g. every 30 seconds).
    """
    now = datetime.now(timezone.utc).timestamp()

    # Get all broadcasts due now or in the past
    due_ids = await redis_client.zrangebyscore("broadcast:scheduled", 0, now)

    for schedule_id_raw in due_ids:
        schedule_id = schedule_id_raw.decode() if isinstance(schedule_id_raw, bytes) else schedule_id_raw

        data = await redis_client.hgetall(schedule_id)
        if not data:
            await redis_client.zrem("broadcast:scheduled", schedule_id)
            continue

        # Decode values
        decoded = {}
        for k, v in data.items():
            key = k.decode() if isinstance(k, bytes) else k
            val = v.decode() if isinstance(v, bytes) else v
            decoded[key] = val

        if decoded.get("status") != "pending":
            await redis_client.zrem("broadcast:scheduled", schedule_id)
            continue

        # Mark as running
        await redis_client.hset(schedule_id, "status", "running")

        text = decoded.get("text", "")
        photo = decoded.get("photo") or None

        logger.info("Executing scheduled broadcast: %s", schedule_id)

        delivered, failed, total = await broadcast_message(
            bot=bot,
            text=text,
            photo_file_id=photo,
        )

        # Update status
        await redis_client.hset(
            schedule_id,
            mapping={
                "status": "completed",
                "delivered": str(delivered),
                "failed": str(failed),
                "total": str(total),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        await redis_client.zrem("broadcast:scheduled", schedule_id)

        logger.info(
            "Scheduled broadcast %s completed: %d/%d delivered",
            schedule_id,
            delivered,
            total,
        )


async def get_broadcast_status(broadcast_id: str) -> Optional[dict]:
    """Get the status of a broadcast."""
    data = await redis_client.hgetall(broadcast_id)
    if not data:
        return None

    return {
        (k.decode() if isinstance(k, bytes) else k): (v.decode() if isinstance(v, bytes) else v)
        for k, v in data.items()
    }


async def cancel_scheduled_broadcast(schedule_id: str) -> bool:
    """Cancel a pending scheduled broadcast."""
    data = await redis_client.hgetall(schedule_id)
    if not data:
        return False

    status_raw = data.get(b"status", data.get("status", b""))
    status = status_raw.decode() if isinstance(status_raw, bytes) else status_raw

    if status != "pending":
        return False

    await redis_client.hset(schedule_id, "status", "cancelled")
    await redis_client.zrem("broadcast:scheduled", schedule_id)

    logger.info("Scheduled broadcast cancelled: %s", schedule_id)
    return True
