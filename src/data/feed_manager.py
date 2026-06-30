"""مدیریت منابع داده — Failover خودکار + Health Check"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

import pandas as pd

from src.core.config import settings
from src.core.database import async_session_factory
from src.core.logger import get_logger, setup_logging
from src.core.metrics import data_feed_status
from src.core.redis_client import redis_client
from src.data.candle_builder import CandleBuilder
from src.data.data_validator import DataValidator
from src.data.mt5_connector import MT5Connector
from src.data.oanda_connector import OandaConnector
from src.data.twelvedata_connector import TwelveDataConnector
from src.data.yfinance_connector import YFinanceConnector

logger = get_logger(__name__)


class DataFeedManager:
    """مدیریت ۴ منبع داده با failover خودکار"""

    def __init__(self) -> None:
        self.mt5 = MT5Connector()
        self.oanda = OandaConnector()
        self.twelvedata = TwelveDataConnector()
        self.yfinance = YFinanceConnector()

        # ترتیب اولویت — فقط yfinance فعال است (به‌درخواست کاربر؛ twelvedata به‌خاطر
        # تمام‌شدن اعتبار API قطع شد و mt5/oanda در این محیط متصل نمی‌شوند، تا
        # تلاشِ بیهوده و خطا ایجاد نشود). connectorهای دیگر برای آینده ساخته می‌مانند.
        self._sources = [
            ("yfinance", self.yfinance),
        ]
        self._active_source: str = "yfinance"
        self._running: bool = False
        self._health_check_interval: int = settings.HEALTH_CHECK_INTERVAL_SECONDS
        # Lock برای جلوگیری از race در failover هنگام health-check موازی
        self._failover_lock: asyncio.Lock = asyncio.Lock()

    async def connect_sources(self) -> None:
        """فقط اتصال به منابع و تعیین منبع فعال (بدون اجرای حلقه‌ها).

        برای پروسه‌هایی مثل signal-engine که به get_candles زنده نیاز دارند ولی
        نباید حلقه‌های price/candle/health را اجرا کنند.
        """
        for name, connector in self._sources:
            try:
                connected = await connector.connect()
            except Exception as exc:  # noqa: BLE001
                connected = False
                logger.error("data_source_connect_error", source=name, error=str(exc))
            logger.info("data_source_init", source=name, connected=connected)

        for name, connector in self._sources:
            if connector.is_connected:
                self._active_source = name
                logger.info("active_source_set", source=name)
                break

    async def start(self) -> None:
        """شروع مدیریت داده"""
        logger.info("feed_manager_starting")

        # اتصال به Redis
        await redis_client.connect()

        # اتصال به منابع
        await self.connect_sources()

        self._running = True

        # شروع وظایف همزمان
        await asyncio.gather(
            self._health_check_loop(),
            self._price_update_loop(),
            self._candle_update_loop(),
        )

    async def stop(self) -> None:
        """توقف"""
        self._running = False
        for name, connector in self._sources:
            await connector.disconnect()
        await redis_client.close()
        logger.info("feed_manager_stopped")

    async def _health_check_loop(self) -> None:
        """بررسی سلامت منابع هر ۳۰ ثانیه"""
        while self._running:
            try:
                statuses: dict[str, bool] = {}
                for name, connector in self._sources:
                    healthy = await connector.health_check()
                    statuses[name] = healthy
                    data_feed_status.labels(source=name).set(1 if healthy else 0)

                    # ذخیره وضعیت در Redis
                    await redis_client.set_service_status(
                        f"datafeed_{name}",
                        {"healthy": healthy, "timestamp": time.time()},
                    )

                # اگه منبع فعال قطع شده، سوئیچ کن
                if not statuses.get(self._active_source, False):
                    # علامت‌گذاری منبع فعال به‌عنوان قطع تا failover با
                    # خواندن is_connected کهنه دوباره همان منبع را انتخاب نکند
                    active_conn = dict(self._sources).get(self._active_source)
                    if active_conn is not None:
                        active_conn._connected = False
                    await self._failover()

                logger.debug("health_check_completed", statuses=statuses)

            except Exception as e:
                logger.error("health_check_error", error=str(e))

            await asyncio.sleep(self._health_check_interval)

    async def _failover(self) -> None:
        """
        سوئیچ به منبع بعدی — atomic.

        از asyncio.Lock استفاده می‌کند تا اگر دو health-check موازی
        ببینند که منبع فعال down است، فقط یکی failover کند. در غیر
        این صورت ممکن است هر دو به منبع‌های مختلف سوئیچ کنند.
        """
        async with self._failover_lock:
            old_source = self._active_source
            # بررسی مجدد داخل lock — شاید همزمان failover دیگری انجام شده
            current_connector = dict(self._sources).get(old_source)
            if current_connector and current_connector.is_connected:
                # سوئیچ دیگر لازم نیست
                return

            for name, connector in self._sources:
                if name != old_source and connector.is_connected:
                    self._active_source = name
                    logger.warning(
                        "data_feed_failover",
                        from_source=old_source,
                        to_source=name,
                    )
                    return

            # اگه هیچ منبعی فعال نیست، تلاش مجدد اتصال
            for name, connector in self._sources:
                connected = await connector.connect()
                if connected:
                    self._active_source = name
                    logger.warning(
                        "data_feed_reconnected",
                        source=name,
                    )
                    return

            logger.critical("all_data_feeds_down")

    async def get_candles_with_source(
        self,
        symbol: str,
        timeframe: str,
        count: int = 200,
    ) -> tuple[Optional[pd.DataFrame], Optional[str]]:
        """دریافت کندل + نام منبعی که واقعاً داده را برگرداند.

        چون get_candles ممکن است به‌صورت خاموش به منبع دیگری fallback کند،
        منبع واقعی را همراه دیتافریم برمی‌گرداند تا ذخیره‌سازی برچسب درست
        منبع را ثبت کند (نه _active_source که ممکن است متفاوت باشد).
        """
        # ترتیب: منبع فعال اول، بعد سایر منابع به ترتیب اولویت (تا منبع سالمِ
        # انتخاب‌شده توسط failover، سایه‌ی یک منبعِ صرفاً «متصلِ» بی‌کیفیت نشود).
        ordered = sorted(
            self._sources, key=lambda nc: 0 if nc[0] == self._active_source else 1
        )
        for name, connector in ordered:
            if not connector.is_connected:
                continue
            try:
                df = await connector.get_candles(symbol, timeframe, count)
                if df is not None and not df.empty:
                    # کیفیتِ داده (warn-only) — هرگز جریانِ داده/سیگنال را بلاک نمی‌کند
                    try:
                        from src.data.candle_quality import validate_candles
                        validate_candles(df, symbol, timeframe)
                    except Exception:  # noqa: BLE001
                        pass
                    return df, name
            except Exception as e:
                logger.error("get_candles_failed", source=name, symbol=symbol, error=str(e))
                continue
        return None, None

    async def get_candles(
        self,
        symbol: str,
        timeframe: str,
        count: int = 200,
    ) -> Optional[pd.DataFrame]:
        """دریافت کندل از منبع فعال با fallback — ابتدا active_source، سپس بقیه."""
        df, _ = await self.get_candles_with_source(symbol, timeframe, count)
        return df

    async def get_tick(self, symbol: str) -> Optional[dict[str, Any]]:
        """دریافت تیک از منبع فعال با fallback"""
        ticks: list[dict] = []

        for name, connector in self._sources:
            if not connector.is_connected:
                continue
            try:
                tick = await connector.get_tick(symbol)
                if tick and DataValidator.validate_tick(tick):
                    ticks.append(tick)
                    if name == self._active_source:
                        break
            except Exception as e:
                logger.error("get_tick_failed", source=name, symbol=symbol, error=str(e))
                continue

        # انتخاب بهترین قیمت
        return DataValidator.select_best_price(symbol, ticks)

    async def _price_update_loop(self) -> None:
        """بروزرسانی قیمت لحظه‌ای هر ۲ ثانیه"""
        while self._running:
            try:
                tasks = []
                for symbol in settings.SYMBOLS:
                    tasks.append(self._update_price(symbol))
                await asyncio.gather(*tasks, return_exceptions=True)
            except Exception as e:
                logger.error("price_update_loop_error", error=str(e))
            await asyncio.sleep(settings.PRICE_UPDATE_INTERVAL_SECONDS)

    async def _update_price(self, symbol: str) -> None:
        """بروزرسانی قیمت یک نماد"""
        tick = await self.get_tick(symbol)
        if tick:
            await redis_client.set_price(symbol, tick)
            # ارسال از طریق pub/sub برای WebSocket
            await redis_client.publish("price_updates", tick)

    async def _candle_update_loop(self) -> None:
        """بروزرسانی کندل‌ها هر ۶۰ ثانیه"""
        while self._running:
            for symbol in settings.SYMBOLS:
                for tf in settings.TIMEFRAMES:
                    # try/except داخل حلقه — یک خطای DB کل دسته‌ی نمادها را قطع نکند
                    try:
                        df, source = await self.get_candles_with_source(symbol, tf, count=5)
                        if df is not None and not df.empty:
                            async with async_session_factory() as session:
                                await CandleBuilder.save_candles(
                                    session, symbol, tf, df, source or self._active_source
                                )
                    except Exception as e:
                        logger.error(
                            "candle_update_loop_error",
                            symbol=symbol,
                            timeframe=tf,
                            error=str(e),
                        )
                # فاصله بین نمادها برای جلوگیری از rate limit
                await asyncio.sleep(0.5)
            await asyncio.sleep(settings.CANDLE_UPDATE_INTERVAL_SECONDS)

    @property
    def active_source(self) -> str:
        return self._active_source

    def get_status(self) -> dict[str, Any]:
        """وضعیت کلی منابع داده"""
        return {
            "active_source": self._active_source,
            "sources": {
                name: {
                    "connected": connector.is_connected,
                }
                for name, connector in self._sources
            },
        }


# نمونه سینگلتون
feed_manager = DataFeedManager()


async def main() -> None:
    """نقطه شروع سرویس"""
    setup_logging()
    logger.info("data_feed_service_starting")
    try:
        await feed_manager.start()
    except KeyboardInterrupt:
        logger.info("data_feed_service_stopping")
    finally:
        await feed_manager.stop()


if __name__ == "__main__":
    asyncio.run(main())
