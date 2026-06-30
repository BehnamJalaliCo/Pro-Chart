"""
Telegram Bot Entry Point — aiogram 3.x (CoinePro FX v2).

قیف کاربر: ثبت‌نام → آزمون سطح‌سنجی → trial ۴۸ ساعته → اشتراک VIP.
FSM روی Redis نگه‌داری می‌شود تا بین workerها مشترک باشد.
"""

import asyncio
import os
import signal as os_signal
from contextlib import suppress

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.fsm.storage.redis import DefaultKeyBuilder, RedisStorage
from aiogram.types import BotCommand, BotCommandScopeDefault

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

from src.bot.handlers.onboarding import onboarding_router
from src.bot.handlers.menu import menu_router
from src.bot.handlers.subscription import subscription_router
from src.bot.handlers.profile import profile_router
from src.bot.handlers.referral import referral_router
from src.bot.handlers.support import support_router
from src.bot.handlers.settings import settings_router
from src.bot.handlers.broker import broker_router
from src.bot.handlers.ai import ai_router
from src.bot.handlers.admin import admin_router
from src.bot.middlewares.logging import MessageLoggingMiddleware
from src.bot.middlewares.phone_gate import PhoneGateMiddleware
from src.bot.middlewares.rate_limit import RateLimitMiddleware
from src.bot.services import event_consumer, signal_publisher

logger = get_logger("bot.main")

WORKER_ID = os.getenv("WORKER_ID", "1")
# فقط یک worker باید دستورات را ثبت کند تا race رخ ندهد
COMMAND_WORKER_ID = os.getenv("COMMAND_WORKER_ID", "1")

BOT_COMMANDS = [
    BotCommand(command="start", description="شروع و ثبت‌نام"),
    BotCommand(command="menu", description="منوی اصلی"),
    BotCommand(command="help", description="راهنما و پشتیبانی"),
]

# نگه‌داری تسک‌های پس‌زمینه برای توقف تمیز
_consumer_task: asyncio.Task | None = None
_publisher_task: asyncio.Task | None = None


def create_bot() -> Bot:
    """ساخت نمونه‌ی Bot."""
    return Bot(
        token=settings.TELEGRAM_BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


def create_dispatcher() -> Dispatcher:
    """ساخت Dispatcher با FSM روی Redis، ثبت middlewareها، routerها و hookها.

    hookها اینجا (نه در main()) ثبت می‌شوند تا مسیر run_bot.py هم Redis را وصل کند.
    """
    storage = RedisStorage.from_url(
        settings.REDIS_URL,
        key_builder=DefaultKeyBuilder(prefix="fsm", with_destiny=True),
    )
    dp = Dispatcher(storage=storage)

    # middlewareهای outer روی update — ترتیب: ابتدا rate-limit، سپس logging/ban
    dp.update.outer_middleware(RateLimitMiddleware())
    dp.update.outer_middleware(MessageLoggingMiddleware())

    # گیتِ شماره (inner — به FSMِ کاربر دسترسی دارد): تا شماره ندهد، اجازهٔ استفاده ندارد.
    dp.message.middleware(PhoneGateMiddleware())
    dp.callback_query.middleware(PhoneGateMiddleware())

    # onboarding اول تا stateهای FSM بر منو اولویت بگیرند
    dp.include_router(onboarding_router)
    dp.include_router(subscription_router)
    dp.include_router(profile_router)
    dp.include_router(referral_router)
    dp.include_router(support_router)
    dp.include_router(settings_router)
    dp.include_router(broker_router)
    dp.include_router(ai_router)
    dp.include_router(admin_router)
    dp.include_router(menu_router)  # آخر: catch-all دکمه‌های منو

    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)
    return dp


async def on_startup(bot: Bot) -> None:
    """اتصال Redis، ثبت دستورات، استارت مصرف‌کننده‌ی صف."""
    global _consumer_task
    logger.info("Worker %s — starting up...", WORKER_ID)

    redis_ok = False
    try:
        await redis_client.connect()
        redis_ok = True
        logger.info("Redis connected.")
    except Exception as exc:  # noqa: BLE001
        logger.error("Redis connection failed: %s", exc)

    if WORKER_ID == COMMAND_WORKER_ID:
        try:
            await bot.set_my_commands(commands=BOT_COMMANDS, scope=BotCommandScopeDefault())
            logger.info("Bot commands registered.")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not register bot commands: %s", exc)

    with suppress(Exception):
        await redis_client.set(f"worker:{WORKER_ID}:heartbeat", "alive", ex=60)

    # تسک‌های پس‌زمینه فقط وقتی Redis متصل است (وگرنه در حلقه‌ی خطا می‌افتند)
    global _publisher_task
    if redis_ok:
        # مصرف‌کننده‌ی صف رویدادها/پیام‌های مستقیم (پل بین API و ربات)
        _consumer_task = asyncio.create_task(event_consumer.run(bot))
        # انتشار سیگنال‌های موتور روی کانال VIP (در صورت فعال‌بودن)
        if settings.PUBLISH_SIGNALS_TO_CHANNEL:
            _publisher_task = asyncio.create_task(signal_publisher.run(bot))
            logger.info("signal_publisher_enabled", channel=settings.TELEGRAM_CHANNEL_ID)
        else:
            logger.info("signal_publisher_disabled")
    else:
        logger.error("background_tasks_skipped_redis_down")

    with suppress(Exception):
        bot_info = await bot.me()
        logger.info("Bot @%s (id=%s) started — worker %s", bot_info.username, bot_info.id, WORKER_ID)


async def on_shutdown(bot: Bot) -> None:
    """توقف تمیز: مصرف‌کننده، heartbeat، Redis، سشن Bot."""
    global _consumer_task
    logger.info("Worker %s — shutting down...", WORKER_ID)

    event_consumer.stop()
    signal_publisher.stop()
    for task in (_consumer_task, _publisher_task):
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await task

    with suppress(Exception):
        await redis_client.delete(f"worker:{WORKER_ID}:heartbeat")
    with suppress(Exception):
        await redis_client.close()
    with suppress(Exception):
        await bot.session.close()
    logger.info("Bot session closed.")


# آپدیت‌هایی که ربات نیاز دارد — شامل chat_member برای تأیید عضویت کانال
ALLOWED_UPDATES = ["message", "callback_query", "chat_member", "chat_join_request"]


async def main() -> None:
    """نقطه ورود — ساخت bot/dispatcher و شروع polling."""
    bot = create_bot()
    dp = create_dispatcher()

    logger.info("Starting polling — worker %s", WORKER_ID)
    try:
        await dp.start_polling(bot, allowed_updates=ALLOWED_UPDATES, drop_pending_updates=True)
    finally:
        logger.info("Polling stopped — worker %s", WORKER_ID)


if __name__ == "__main__":
    asyncio.run(main())
