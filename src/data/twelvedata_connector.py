"""کانکتور TwelveData — منبع داده سوم"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
import pandas as pd

from src.core.config import settings
from src.core.logger import get_logger
from src.core.metrics import data_feed_errors, data_feed_latency, data_feed_status

logger = get_logger(__name__)

# مپ نمادها
TD_SYMBOL_MAP: dict[str, str] = {
    "XAUUSD": "XAU/USD", "XAGUSD": "XAG/USD",
    "EURUSD": "EUR/USD", "GBPUSD": "GBP/USD",
    "USDJPY": "USD/JPY", "USDCHF": "USD/CHF",
    "AUDUSD": "AUD/USD", "NZDUSD": "NZD/USD",
    "USDCAD": "USD/CAD", "EURGBP": "EUR/GBP",
    "EURJPY": "EUR/JPY", "GBPJPY": "GBP/JPY",
    "AUDJPY": "AUD/JPY", "EURAUD": "EUR/AUD",
    "XTIUSD": "WTI/USD", "XNGUSD": "NG/USD",
    "US30": "DJI", "US500": "SPX",
    "NAS100": "IXIC", "DE40": "DAX",
}

TD_TF_MAP: dict[str, str] = {
    "M1": "1min", "M5": "5min", "M15": "15min", "M30": "30min",
    "H1": "1h", "H4": "4h", "D1": "1day", "W1": "1week", "MN1": "1month",
}

API_BASE = "https://api.twelvedata.com"


class TwelveDataConnector:
    """اتصال به TwelveData API"""

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None
        self._connected: bool = False
        # ── گاردِ credit روزانه ───────────────────────────
        self._credit_date: Optional[Any] = None   # تاریخ UTC جاری
        self._credits_used: int = 0
        self._budget_warned: bool = False
        self._last_ok_monotonic: float = 0.0

    def _budget_ok(self) -> bool:
        """آیا هنوز زیر سقف credit روزانه هستیم؟ (با ریست خودکار روزانهٔ UTC)"""
        today = datetime.now(timezone.utc).date()
        if today != self._credit_date:
            self._credit_date = today
            self._credits_used = 0
            self._budget_warned = False
        if self._credits_used >= settings.TWELVEDATA_DAILY_CREDIT_LIMIT:
            if not self._budget_warned:
                logger.warning(
                    "twelvedata_daily_budget_reached",
                    used=self._credits_used,
                    limit=settings.TWELVEDATA_DAILY_CREDIT_LIMIT,
                )
                self._budget_warned = True
            return False
        return True

    def _spend(self, n: int = 1) -> None:
        """ثبت مصرف credit."""
        self._credits_used += n

    def _mark_exhausted(self) -> None:
        """در پاسخ به پیام «run out of credits» بودجه را تا فردا تمام‌شده اعلام کن."""
        self._credits_used = settings.TWELVEDATA_DAILY_CREDIT_LIMIT
        self._connected = False
        data_feed_status.labels(source="twelvedata").set(0)

    async def connect(self) -> bool:
        """اتصال به TwelveData"""
        if not settings.TWELVEDATA_API_KEY or settings.TWELVEDATA_API_KEY == "CHANGE_ME":
            logger.warning("twelvedata_no_api_key")
            data_feed_status.labels(source="twelvedata").set(0)
            return False

        try:
            self._client = httpx.AsyncClient(
                base_url=API_BASE,
                timeout=httpx.Timeout(30.0),
            )
            # اگر بودجه از قبل تمام است، بدون مصرف credit رد شو
            if not self._budget_ok():
                data_feed_status.labels(source="twelvedata").set(0)
                return False
            # تست با یک درخواست ساده
            self._spend()
            resp = await self._client.get(
                "/time_series",
                params={
                    "symbol": "EUR/USD",
                    "interval": "1h",
                    "outputsize": 1,
                    "apikey": settings.TWELVEDATA_API_KEY,
                },
            )
            data = resp.json()
            if isinstance(data, dict) and "run out of API credits" in str(data.get("message", "")):
                self._mark_exhausted()
                logger.error("twelvedata_auth_failed", response=data.get("message", ""))
                return False
            if "values" in data:
                self._connected = True
                self._last_ok_monotonic = time.monotonic()
                data_feed_status.labels(source="twelvedata").set(1)
                logger.info("twelvedata_connected")
                return True
            else:
                logger.error("twelvedata_auth_failed", response=data.get("message", ""))
                data_feed_status.labels(source="twelvedata").set(0)
                return False
        except Exception as e:
            data_feed_errors.labels(source="twelvedata").inc()
            data_feed_status.labels(source="twelvedata").set(0)
            logger.error("twelvedata_connection_error", error=str(e))
            return False

    async def disconnect(self) -> None:
        """قطع اتصال"""
        if self._client:
            await self._client.aclose()
            self._connected = False
            data_feed_status.labels(source="twelvedata").set(0)
            logger.info("twelvedata_disconnected")

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def health_check(self) -> bool:
        """بررسی سلامت — بدون اتلاف credit در صورت موفقیت اخیر."""
        if not self._connected or not self._client:
            return False
        # بودجهٔ روزانه تمام شده → ناسالم گزارش کن تا failover به منبع بعدی (yfinance) برود
        if not self._budget_ok():
            return False
        # صرفه‌جویی credit: اگر اخیراً درخواست موفق داشتیم، بدون مصرف سالم فرض کن
        if self._last_ok_monotonic and (
            time.monotonic() - self._last_ok_monotonic
        ) < settings.HEALTH_CHECK_INTERVAL_SECONDS * 2:
            return True
        try:
            self._spend()
            resp = await self._client.get(
                "/price",
                params={
                    "symbol": "EUR/USD",
                    "apikey": settings.TWELVEDATA_API_KEY,
                },
            )
            data = resp.json()
            if isinstance(data, dict) and "run out of API credits" in str(data.get("message", "")):
                self._mark_exhausted()
                return False
            ok = resp.status_code == 200 and "price" in data
            if ok:
                self._last_ok_monotonic = time.monotonic()
            return ok
        except Exception:
            return False

    async def get_candles(
        self,
        symbol: str,
        timeframe: str,
        count: int = 200,
    ) -> Optional[pd.DataFrame]:
        """دریافت کندل‌ها"""
        if not self._connected or not self._client:
            return None

        td_symbol = TD_SYMBOL_MAP.get(symbol)
        td_tf = TD_TF_MAP.get(timeframe)
        if not td_symbol or not td_tf:
            return None

        # گاردِ بودجه: اگر به سقف روزانه رسیده‌ایم، None برگردان تا failover رخ دهد
        if not self._budget_ok():
            return None

        try:
            start = time.monotonic()
            self._spend()
            resp = await self._client.get(
                "/time_series",
                params={
                    "symbol": td_symbol,
                    "interval": td_tf,
                    "outputsize": count,
                    "apikey": settings.TWELVEDATA_API_KEY,
                    "timezone": "UTC",
                },
            )
            latency = time.monotonic() - start
            data_feed_latency.labels(source="twelvedata").observe(latency)

            data = resp.json()
            if isinstance(data, dict) and "run out of API credits" in str(data.get("message", "")):
                self._mark_exhausted()
                return None
            values = data.get("values", [])
            if not values:
                logger.warning("twelvedata_no_data", symbol=symbol)
                return None
            self._last_ok_monotonic = time.monotonic()

            rows = []
            for v in values:
                rows.append({
                    "timestamp": pd.Timestamp(v["datetime"], tz="UTC"),
                    "open": float(v["open"]),
                    "high": float(v["high"]),
                    "low": float(v["low"]),
                    "close": float(v["close"]),
                    "volume": int(v.get("volume", 0)),
                })

            df = pd.DataFrame(rows)
            df.sort_values("timestamp", inplace=True)
            df.reset_index(drop=True, inplace=True)
            return df

        except Exception as e:
            data_feed_errors.labels(source="twelvedata").inc()
            logger.error("twelvedata_get_candles_error", symbol=symbol, error=str(e))
            return None

    async def get_tick(self, symbol: str) -> Optional[dict[str, Any]]:
        """دریافت آخرین قیمت"""
        if not self._connected or not self._client:
            return None

        td_symbol = TD_SYMBOL_MAP.get(symbol)
        if not td_symbol:
            return None

        # گاردِ بودجه
        if not self._budget_ok():
            return None

        try:
            self._spend()
            resp = await self._client.get(
                "/price",
                params={
                    "symbol": td_symbol,
                    "apikey": settings.TWELVEDATA_API_KEY,
                },
            )
            data = resp.json()
            if isinstance(data, dict) and "run out of API credits" in str(data.get("message", "")):
                self._mark_exhausted()
                return None
            price = float(data.get("price", 0))
            if price == 0:
                return None
            self._last_ok_monotonic = time.monotonic()

            return {
                "symbol": symbol,
                "bid": price,
                "ask": price,
                "last": price,
                "volume": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "twelvedata",
            }
        except Exception as e:
            data_feed_errors.labels(source="twelvedata").inc()
            logger.error("twelvedata_get_tick_error", symbol=symbol, error=str(e))
            return None
