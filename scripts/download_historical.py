"""دانلود داده تاریخی برای آموزش مدل‌ها"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.config import settings
from src.core.database import async_session_factory, init_db
from src.core.logger import setup_logging, get_logger
from src.data.candle_builder import CandleBuilder
from src.data.yfinance_connector import YFinanceConnector

logger = get_logger(__name__)


async def download_all() -> None:
    """دانلود داده تاریخی تمام نمادها"""
    setup_logging()
    await init_db()

    yf = YFinanceConnector()
    await yf.connect()

    for symbol in settings.SYMBOLS:
        for tf in settings.TIMEFRAMES:
            logger.info("downloading", symbol=symbol, timeframe=tf)
            df = await yf.get_candles(symbol, tf, count=5000)
            if df is not None and not df.empty:
                async with async_session_factory() as session:
                    saved = await CandleBuilder.save_candles(session, symbol, tf, df, "yfinance")
                    logger.info("saved", symbol=symbol, timeframe=tf, candles=saved)
            else:
                logger.warning("no_data", symbol=symbol, timeframe=tf)

    await yf.disconnect()
    print("دانلود تمام شد!")


if __name__ == "__main__":
    asyncio.run(download_all())
