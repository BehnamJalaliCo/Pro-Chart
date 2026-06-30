#!/usr/bin/env python3
"""نقطه ورود اصلی ربات تلگرام"""

import asyncio
import os
import sys

# اضافه کردن مسیر پروژه
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def main() -> None:
    from src.core.logger import get_logger, setup_logging
    setup_logging()  # فعال‌سازی structured logging + redactor در پروسه‌ی ربات
    logger = get_logger("bot_runner")

    worker_id = int(os.environ.get("WORKER_ID", "1"))
    logger.info("starting_bot_worker", worker_id=worker_id)

    from src.bot.main import ALLOWED_UPDATES, create_bot, create_dispatcher
    bot = create_bot()
    dp = create_dispatcher()

    logger.info("bot_handlers_registered", worker_id=worker_id)

    # شروع polling — allowed_updates شامل chat_member برای تأیید عضویت کانال
    try:
        await dp.start_polling(
            bot,
            allowed_updates=ALLOWED_UPDATES,
            drop_pending_updates=True,
        )
    except Exception as e:
        logger.error("bot_polling_error", error=str(e), worker_id=worker_id)
        raise


if __name__ == "__main__":
    from src.core.fast_loop import install_uvloop
    install_uvloop()
    asyncio.run(main())
