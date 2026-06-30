"""Backfill تاریخچهٔ کندل برای همهٔ نمادها و تایم‌فریم‌ها.

ریشهٔ «نبودِ سیگنال»: تایم‌فریم‌های بالا (D1 ~۹، H4 ~۴۷ کندل) برای EMA200/اندیکاتورهای
روند بسیار نازک بودند → تحلیلِ تایمِ بالا همیشه خنثی → net_confluence ~۰. yfinance تا
چند صد کندل دارد؛ این اسکریپت یک‌بار آن‌ها را می‌گیرد و ذخیره می‌کند (upsert، idempotent).

اجرا:  docker compose exec -T signal-engine python -m scripts.backfill_candles
"""

from __future__ import annotations

import asyncio

from src.core.config import settings
from src.core.database import async_session_factory
from src.core.logger import get_logger, setup_logging
from src.data.candle_builder import CandleBuilder
from src.data.feed_manager import feed_manager

logger = get_logger("scripts.backfill")

_TFS = ["D1", "H4", "H1", "M15"]
# yfinance برای H1 تا ۷۳۰ روز (~۵۰۰۰ کندل) و M15 تا ۶۰ روز می‌دهد؛ سقفِ ۴۰۰
# قبلی هم تحلیلِ تایمِ بالا و هم آموزشِ ML (به‌ویژه LSTM که ≥۵۰۰ ردیف لازم دارد)
# را گرسنه نگه می‌داشت. اکنون تا ۵۰۰۰ می‌گیریم (connector به سقفِ منبع کلیپ می‌کند).
_COUNT = 5000


async def main() -> None:
    setup_logging()
    await feed_manager.connect_sources()
    total = 0
    for symbol in settings.SYMBOLS:
        for tf in _TFS:
            try:
                df, src = await feed_manager.get_candles_with_source(symbol, tf, count=_COUNT)
                if df is not None and not df.empty:
                    async with async_session_factory() as s:
                        await CandleBuilder.save_candles(s, symbol, tf, df, src or "yfinance")
                    total += len(df)
                    logger.info("backfilled", symbol=symbol, timeframe=tf, candles=len(df))
            except Exception as exc:  # noqa: BLE001
                logger.error("backfill_failed", symbol=symbol, timeframe=tf, error=str(exc))
            await asyncio.sleep(0.3)  # احترام به rate limit
    print(f"backfill done — ~{total} candles across {len(settings.SYMBOLS)} symbols")


if __name__ == "__main__":
    asyncio.run(main())
