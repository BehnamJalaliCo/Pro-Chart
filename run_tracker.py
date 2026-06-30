#!/usr/bin/env python3
"""نقطه ورود سیستم ترکینگ سیگنال"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def main() -> None:
    from src.core.logger import get_logger
    logger = get_logger("tracker_runner")

    logger.info("starting_signal_tracker")

    from src.core.redis_client import redis_client
    from src.signals.tracker import SignalTracker

    await redis_client.connect()

    tracker = SignalTracker()

    try:
        await tracker.start()
    except KeyboardInterrupt:
        logger.info("signal_tracker_stopped_by_user")
    except Exception as e:
        logger.error("signal_tracker_error", error=str(e))
        raise
    finally:
        await redis_client.close()


if __name__ == "__main__":
    from src.core.fast_loop import install_uvloop
    install_uvloop()
    asyncio.run(main())
