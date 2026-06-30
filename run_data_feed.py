#!/usr/bin/env python3
"""نقطه ورود سرویس دریافت داده"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def main() -> None:
    from src.core.logger import get_logger
    logger = get_logger("data_feed_runner")

    logger.info("starting_data_feed_service")

    from src.data.feed_manager import DataFeedManager
    manager = DataFeedManager()

    try:
        await manager.start()
    except KeyboardInterrupt:
        logger.info("data_feed_stopped_by_user")
    except Exception as e:
        logger.error("data_feed_error", error=str(e))
        raise


if __name__ == "__main__":
    from src.core.fast_loop import install_uvloop
    install_uvloop()
    asyncio.run(main())
