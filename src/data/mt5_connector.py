"""کانکتور MetaTrader 5 — منبع داده اصلی"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd

from src.core.config import settings
from src.core.logger import get_logger
from src.core.metrics import data_feed_latency, data_feed_errors, data_feed_status

logger = get_logger(__name__)

# مپ تایم‌فریم‌ها
TF_MAP: dict[str, int] = {}

try:
    import MetaTrader5 as mt5
    TF_MAP = {
        "M1": mt5.TIMEFRAME_M1,
        "M5": mt5.TIMEFRAME_M5,
        "M15": mt5.TIMEFRAME_M15,
        "M30": mt5.TIMEFRAME_M30,
        "H1": mt5.TIMEFRAME_H1,
        "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1,
        "W1": mt5.TIMEFRAME_W1,
        "MN1": mt5.TIMEFRAME_MN1,
    }
except ImportError:
    mt5 = None  # type: ignore
    logger.warning("mt5_not_available", msg="MetaTrader5 در این سیستم نصب نیست")


# مپ نمادهای MT5
SYMBOL_MAP: dict[str, str] = {
    "XAUUSD": "XAUUSD",
    "XAGUSD": "XAGUSD",
    "EURUSD": "EURUSD",
    "GBPUSD": "GBPUSD",
    "USDJPY": "USDJPY",
    "USDCHF": "USDCHF",
    "AUDUSD": "AUDUSD",
    "NZDUSD": "NZDUSD",
    "USDCAD": "USDCAD",
    "EURGBP": "EURGBP",
    "EURJPY": "EURJPY",
    "GBPJPY": "GBPJPY",
    "AUDJPY": "AUDJPY",
    "EURAUD": "EURAUD",
    "XTIUSD": "XTIUSD",
    "XNGUSD": "XNGUSD",
    "US30": "US30",
    "US500": "US500",
    "NAS100": "NAS100",
    "DE40": "DE40",
}


class MT5Connector:
    """اتصال به MetaTrader 5"""

    def __init__(self) -> None:
        self._connected: bool = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self) -> bool:
        """اتصال به MT5"""
        if mt5 is None:
            logger.error("mt5_import_failed")
            data_feed_status.labels(source="mt5").set(0)
            return False

        try:
            result = await asyncio.get_event_loop().run_in_executor(
                None, self._init_mt5
            )
            if result:
                self._connected = True
                data_feed_status.labels(source="mt5").set(1)
                logger.info("mt5_connected", server=settings.MT5_SERVER)
            else:
                data_feed_status.labels(source="mt5").set(0)
                error = mt5.last_error()
                logger.error("mt5_connection_failed", error=str(error))
            return result
        except Exception as e:
            data_feed_status.labels(source="mt5").set(0)
            data_feed_errors.labels(source="mt5").inc()
            logger.error("mt5_connection_error", error=str(e))
            return False

    def _init_mt5(self) -> bool:
        """مقداردهی اولیه MT5 (sync)"""
        if not mt5.initialize():
            return False
        if settings.MT5_LOGIN:
            return mt5.login(
                login=int(settings.MT5_LOGIN),
                password=settings.MT5_PASSWORD,
                server=settings.MT5_SERVER,
            )
        return True

    async def disconnect(self) -> None:
        """قطع اتصال"""
        if mt5 is not None and self._connected:
            await asyncio.get_event_loop().run_in_executor(None, mt5.shutdown)
            self._connected = False
            data_feed_status.labels(source="mt5").set(0)
            logger.info("mt5_disconnected")

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def health_check(self) -> bool:
        """بررسی سلامت اتصال"""
        if not self._connected or mt5 is None:
            return False
        try:
            info = await asyncio.get_event_loop().run_in_executor(
                None, mt5.terminal_info
            )
            return info is not None
        except Exception:
            return False

    async def get_candles(
        self,
        symbol: str,
        timeframe: str,
        count: int = 200,
    ) -> Optional[pd.DataFrame]:
        """دریافت کندل‌ها"""
        if not self._connected or mt5 is None:
            return None

        mt5_symbol = SYMBOL_MAP.get(symbol, symbol)
        mt5_tf = TF_MAP.get(timeframe)
        if mt5_tf is None:
            logger.error("mt5_invalid_timeframe", timeframe=timeframe)
            return None

        try:
            import time
            start = time.monotonic()

            rates = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: mt5.copy_rates_from_pos(mt5_symbol, mt5_tf, 0, count),
            )

            latency = time.monotonic() - start
            data_feed_latency.labels(source="mt5").observe(latency)

            if rates is None or len(rates) == 0:
                logger.warning("mt5_no_data", symbol=symbol, timeframe=timeframe)
                return None

            df = pd.DataFrame(rates)
            df["time"] = pd.to_datetime(df["time"], unit="s", utc=True)
            df.rename(
                columns={
                    "time": "timestamp",
                    "tick_volume": "volume",
                },
                inplace=True,
            )
            df = df[["timestamp", "open", "high", "low", "close", "volume"]]
            return df

        except Exception as e:
            data_feed_errors.labels(source="mt5").inc()
            logger.error("mt5_get_candles_error", symbol=symbol, error=str(e))
            return None

    async def get_tick(self, symbol: str) -> Optional[dict[str, Any]]:
        """دریافت آخرین تیک"""
        if not self._connected or mt5 is None:
            return None

        mt5_symbol = SYMBOL_MAP.get(symbol, symbol)
        try:
            tick = await asyncio.get_event_loop().run_in_executor(
                None, lambda: mt5.symbol_info_tick(mt5_symbol)
            )
            if tick is None:
                return None

            return {
                "symbol": symbol,
                "bid": tick.bid,
                "ask": tick.ask,
                "last": tick.last,
                "volume": tick.volume,
                "timestamp": datetime.fromtimestamp(tick.time, tz=timezone.utc).isoformat(),
                "source": "mt5",
            }
        except Exception as e:
            data_feed_errors.labels(source="mt5").inc()
            logger.error("mt5_get_tick_error", symbol=symbol, error=str(e))
            return None

    async def get_ticks_range(
        self,
        symbol: str,
        from_date: datetime,
        to_date: datetime,
    ) -> Optional[pd.DataFrame]:
        """دریافت تیک‌ها در بازه زمانی"""
        if not self._connected or mt5 is None:
            return None

        mt5_symbol = SYMBOL_MAP.get(symbol, symbol)
        try:
            ticks = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: mt5.copy_ticks_range(mt5_symbol, from_date, to_date, mt5.COPY_TICKS_ALL),
            )
            if ticks is None or len(ticks) == 0:
                return None

            df = pd.DataFrame(ticks)
            df["time"] = pd.to_datetime(df["time"], unit="s", utc=True)
            df.rename(columns={"time": "timestamp"}, inplace=True)
            return df

        except Exception as e:
            data_feed_errors.labels(source="mt5").inc()
            logger.error("mt5_get_ticks_error", symbol=symbol, error=str(e))
            return None
