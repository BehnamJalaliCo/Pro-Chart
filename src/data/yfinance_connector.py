"""کانکتور yfinance — منبع بکاپ نهایی"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pandas as pd
import yfinance as yf

try:
    from curl_cffi import requests as _cffi_requests
    _CURL_CFFI_AVAILABLE = True
except ImportError:  # pragma: no cover
    _CURL_CFFI_AVAILABLE = False

from src.core.logger import get_logger
from src.core.metrics import data_feed_errors, data_feed_latency, data_feed_status

logger = get_logger(__name__)

# مپ نمادها به فرمت yfinance
YF_SYMBOL_MAP: dict[str, str] = {
    "XAUUSD": "GC=F", "XAGUSD": "SI=F",
    "EURUSD": "EURUSD=X", "GBPUSD": "GBPUSD=X",
    "USDJPY": "JPY=X", "USDCHF": "CHF=X",
    "AUDUSD": "AUDUSD=X", "NZDUSD": "NZDUSD=X",
    "USDCAD": "CAD=X", "EURGBP": "EURGBP=X",
    "EURJPY": "EURJPY=X", "GBPJPY": "GBPJPY=X",
    "AUDJPY": "AUDJPY=X", "EURAUD": "EURAUD=X",
    "XTIUSD": "CL=F", "XNGUSD": "NG=F",
    "US30": "YM=F", "US500": "ES=F",
    "NAS100": "NQ=F", "DE40": "^GDAXI",
}

YF_INTERVAL_MAP: dict[str, str] = {
    "M1": "1m", "M5": "5m", "M15": "15m", "M30": "30m",
    "H1": "1h", "H4": "1h", "D1": "1d", "W1": "1wk", "MN1": "1mo",
}

YF_PERIOD_MAP: dict[str, str] = {
    "M1": "7d", "M5": "60d", "M15": "60d", "M30": "60d",
    "H1": "730d", "H4": "730d", "D1": "10y", "W1": "max", "MN1": "max",
}

# مدت هر تایم‌فریم — برای حذف کندلِ هنوز بسته‌نشده (جلوگیری از look-ahead)
_TF_DELTA: dict[str, timedelta] = {
    "M1": timedelta(minutes=1), "M5": timedelta(minutes=5),
    "M15": timedelta(minutes=15), "M30": timedelta(minutes=30),
    "H1": timedelta(hours=1), "H4": timedelta(hours=4),
    "D1": timedelta(days=1), "W1": timedelta(weeks=1),
}


class YFinanceConnector:
    """اتصال به yfinance — داده تاریخی و بکاپ"""

    def __init__(self) -> None:
        self._connected: bool = False
        # session ایمپرسونیت‌شده با curl_cffi برای دور زدن بلاک/کوکی یاهو
        # (نسخه‌های قدیمی yfinance بدون آن JSONDecodeError می‌دادند)
        self._session = None
        if _CURL_CFFI_AVAILABLE:
            try:
                self._session = _cffi_requests.Session(impersonate="chrome")
            except Exception:  # pragma: no cover
                self._session = None

    async def connect(self) -> bool:
        """بررسی دسترسی — yfinance همیشه در دسترسه"""
        try:
            # تست با یک درخواست ساده
            df = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: yf.download("EURUSD=X", period="1d", progress=False, session=self._session),
            )
            if df is not None and not df.empty:
                self._connected = True
                data_feed_status.labels(source="yfinance").set(1)
                logger.info("yfinance_connected")
                return True
            data_feed_status.labels(source="yfinance").set(0)
            return False
        except Exception as e:
            data_feed_status.labels(source="yfinance").set(0)
            logger.error("yfinance_connection_error", error=str(e))
            return False

    async def disconnect(self) -> None:
        """قطع اتصال"""
        self._connected = False
        data_feed_status.labels(source="yfinance").set(0)

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def health_check(self) -> bool:
        """بررسی سلامت"""
        try:
            df = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: yf.download("EURUSD=X", period="1d", progress=False, session=self._session),
            )
            return df is not None and not df.empty
        except Exception:
            return False

    async def get_candles(
        self,
        symbol: str,
        timeframe: str,
        count: int = 200,
    ) -> Optional[pd.DataFrame]:
        """دریافت کندل‌ها"""
        yf_symbol = YF_SYMBOL_MAP.get(symbol)
        yf_interval = YF_INTERVAL_MAP.get(timeframe)
        yf_period = YF_PERIOD_MAP.get(timeframe, "60d")

        if not yf_symbol or not yf_interval:
            return None

        try:
            start = time.monotonic()

            df = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: yf.download(
                    yf_symbol,
                    period=yf_period,
                    interval=yf_interval,
                    progress=False,
                    session=self._session,
                ),
            )

            latency = time.monotonic() - start
            data_feed_latency.labels(source="yfinance").observe(latency)

            if df is None or df.empty:
                return None

            df = df.reset_index()
            # هندل کردن multi-level columns
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = [col[0] if isinstance(col, tuple) else col for col in df.columns]

            # تبدیل نام ستون‌ها
            col_map = {}
            for col in df.columns:
                lower = col.lower()
                if lower in ("date", "datetime"):
                    col_map[col] = "timestamp"
                elif lower == "open":
                    col_map[col] = "open"
                elif lower == "high":
                    col_map[col] = "high"
                elif lower == "low":
                    col_map[col] = "low"
                elif lower == "close":
                    col_map[col] = "close"
                elif lower == "volume":
                    col_map[col] = "volume"

            df.rename(columns=col_map, inplace=True)

            required = ["timestamp", "open", "high", "low", "close"]
            if not all(c in df.columns for c in required):
                logger.warning("yfinance_missing_columns", symbol=symbol, cols=list(df.columns))
                return None

            if "volume" not in df.columns:
                df["volume"] = 0

            df = df[["timestamp", "open", "high", "low", "close", "volume"]].copy()
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
            df.sort_values("timestamp", inplace=True)

            # H4 از کندل‌های 1h ساخته می‌شود (نگاشت مستقیم interval=1h غلط بود)
            if timeframe == "H4":
                df = (
                    df.set_index("timestamp")
                    .resample("4h", label="left", closed="left")
                    .agg({"open": "first", "high": "max", "low": "min",
                          "close": "last", "volume": "sum"})
                    .dropna()
                    .reset_index()
                )
                # resampleِ هم‌تراز با epoch می‌تواند اولین باکت را ناقص بسازد
                # (داده‌ی 1h دقیقاً روی مرز 4h شروع نمی‌شود) — کندل اول را حذف کن
                if len(df) > 1:
                    df = df.iloc[1:].reset_index(drop=True)

            # حذف آخرین کندلِ هنوز بسته‌نشده (look-ahead): اگر بازه‌اش تا الان تمام نشده
            delta = _TF_DELTA.get(timeframe)
            if delta is not None and len(df) > 0:
                now = datetime.now(timezone.utc)
                if df["timestamp"].iloc[-1] + delta > now:
                    df = df.iloc[:-1]

            df = df.tail(count)
            df.reset_index(drop=True, inplace=True)

            return df

        except Exception as e:
            data_feed_errors.labels(source="yfinance").inc()
            logger.error("yfinance_get_candles_error", symbol=symbol, error=str(e))
            return None

    async def get_tick(self, symbol: str) -> Optional[dict[str, Any]]:
        """دریافت آخرین قیمت از yfinance"""
        yf_symbol = YF_SYMBOL_MAP.get(symbol)
        if not yf_symbol:
            return None

        try:
            ticker = yf.Ticker(yf_symbol, session=self._session)
            info = await asyncio.get_event_loop().run_in_executor(
                None, lambda: ticker.fast_info
            )

            last_price = getattr(info, "last_price", None)
            if last_price is None:
                return None

            return {
                "symbol": symbol,
                "bid": float(last_price),
                "ask": float(last_price),
                "last": float(last_price),
                "volume": 0,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "source": "yfinance",
            }
        except Exception as e:
            data_feed_errors.labels(source="yfinance").inc()
            logger.error("yfinance_get_tick_error", symbol=symbol, error=str(e))
            return None
