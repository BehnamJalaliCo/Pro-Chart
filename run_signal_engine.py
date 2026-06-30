#!/usr/bin/env python3
"""نقطه ورود سیگنال انجین"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


async def main() -> None:
    from src.core.logger import get_logger
    logger = get_logger("signal_engine_runner")

    logger.info("starting_signal_engine")

    from src.signals.engine import SignalEngine
    engine = SignalEngine()

    try:
        await engine.start()
    except KeyboardInterrupt:
        logger.info("signal_engine_stopped_by_user")
    except Exception as e:
        logger.error("signal_engine_error", error=str(e))
        raise


if __name__ == "__main__":
    from src.core.fast_loop import install_uvloop
    install_uvloop()
    asyncio.run(main())
