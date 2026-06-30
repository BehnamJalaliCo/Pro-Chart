"""کانکتور OANDA v20 API — منبع داده دوم"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
import pandas as pd

from src.core.config import settings
from src.core.logger import get_logger
from src.core.metrics import data_feed_errors, data_feed_latency, data_feed_status

logger = get_logger(__name__)

# مپ نمادها به فرمت OANDA
OANDA_SYMBOL_MAP: dict[str, str] = {
    "XAUUSD": "XAU_USD", "XAGUSD": "XAG_USD",
    "EURUSD": "EUR_USD", "GBPUSD": "GBP_USD",
    "USDJPY": "USD_JPY", "USDCHF": "USD_CHF",
    "AUDUSD": "AUD_USD", "NZDUSD": "NZD_USD",
    "USDCAD": "USD_CAD", "EURGBP": "EUR_GBP",
    "EURJPY": "EUR_JPY", "GBPJPY": "GBP_JPY",
    "AUDJPY": "AUD_JPY", "EURAUD": "EUR_AUD",
    "XTIUSD": "WTICO_USD", "XNGUSD": "NATGAS_USD",
    "US30": "US30_USD", "US500": "SPX500_USD",
    "NAS100": "NAS100_USD", "DE40": "DE30_EUR",
}

# مپ تایم‌فریم‌ها
OANDA_TF_MAP: dict[str, str] = {
    "M1": "M1", "M5": "M5", "M15": "M15", "M30": "M30",
    "H1": "H1", "H4": "H4", "D1": "D", "W1": "W", "MN1": "M",
}


class OandaConnector:
    """اتصال به OANDA v20 API"""

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None
        self._connected: bool = False
        base_url = (
            "https://api-fxpractice.oanda.com"
            if settings.OANDA_ENVIRONMENT == "practice"
            else "https://api-fxtrade.oanda.com"
        )
        self._base_url = base_url
        self._stream_url = base_url.replace("api-fx", "stream-fx")

    async def connect(self) -> bool:
        """اتصال به OANDA"""
        if not settings.OANDA_API_KEY or settings.OANDA_API_KEY == "CHANGE_ME":
            logger.warning("oanda_no_api_key")
            data_feed_status.labels(source="oanda").set(0)
            return False

        try:
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                headers={
                    "Authorization": f"Bearer {settings.OANDA_API_KEY}",
                    "Content-Type": "application/json",
                },
                timeout=httpx.Timeout(30.0),
            )
            # تست اتصال
            resp = await self._client.get(f"/v3/accounts/{settings.OANDA_ACCOUNT_ID}")
            if resp.status_code == 200:
                self._connected = True
                data_feed_status.labels(source="oanda").set(1)
                logger.info("oanda_connected", account=settings.OANDA_ACCOUNT_ID)
                return True
            else:
                logger.error("oanda_auth_failed", status=resp.status_code)
                data_feed_status.labels(source="oanda").set(0)
                return False
        except Exception as e:
            data_feed_errors.labels(source="oanda").inc()
            data_feed_status.labels(source="oanda").set(0)
            logger.error("oanda_connection_error", error=str(e))
            return False

    async def disconnect(self) -> None:
        """قطع اتصال"""
        if self._client:
            await self._client.aclose()
            self._connected = False
            data_feed_status.labels(source="oanda").set(0)
            logger.info("oanda_disconnected")

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def health_check(self) -> bool:
        """بررسی سلامت"""
        if not self._connected or not self._client:
            return False
        try:
            resp = await self._client.get(f"/v3/accounts/{settings.OANDA_ACCOUNT_ID}")
            return resp.status_code == 200
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

        oanda_symbol = OANDA_SYMBOL_MAP.get(symbol)
        oanda_tf = OANDA_TF_MAP.get(timeframe)
        if not oanda_symbol or not oanda_tf:
            logger.warning("oanda_symbol_not_mapped", symbol=symbol)
            return None

        try:
            start = time.monotonic()
            resp = await self._client.get(
                f"/v3/instruments/{oanda_symbol}/candles",
                params={
                    "granularity": oanda_tf,
                    "count": count,
                    "price": "MBA",
                },
            )
            latency = time.monotonic() - start
            data_feed_latency.labels(source="oanda").observe(latency)

            if resp.status_code != 200:
                logger.error("oanda_candle_error", status=resp.status_code, symbol=symbol)
                return None

            data = resp.json()
            candles = data.get("candles", [])
            if not candles:
                return None

            rows = []
            for c in candles:
                if not c.get("complete", True):
                    continue
                mid = c.get("mid", {})
                rows.append({
                    "timestamp": pd.Timestamp(c["time"]),
                    "open": float(mid.get("o", 0)),
                    "high": float(mid.get("h", 0)),
                    "low": float(mid.get("l", 0)),
                    "close": float(mid.get("c", 0)),
                    "volume": int(c.get("volume", 0)),
                })

            df = pd.DataFrame(rows)
            if df.empty:
                return None

            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
            return df

        except Exception as e:
            data_feed_errors.labels(source="oanda").inc()
            logger.error("oanda_get_candles_error", symbol=symbol, error=str(e))
            return None

    async def get_tick(self, symbol: str) -> Optional[dict[str, Any]]:
        """دریافت آخرین قیمت"""
        if not self._connected or not self._client:
            return None

        oanda_symbol = OANDA_SYMBOL_MAP.get(symbol)
        if not oanda_symbol:
            return None

        try:
            resp = await self._client.get(
                f"/v3/accounts/{settings.OANDA_ACCOUNT_ID}/pricing",
                params={"instruments": oanda_symbol},
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            prices = data.get("prices", [])
            if not prices:
                return None

            p = prices[0]
            bids = p.get("bids", [{}])
            asks = p.get("asks", [{}])

            return {
                "symbol": symbol,
                "bid": float(bids[0].get("price", 0)) if bids else 0.0,
                "ask": float(asks[0].get("price", 0)) if asks else 0.0,
                "last": (float(bids[0].get("price", 0)) + float(asks[0].get("price", 0))) / 2 if bids and asks else 0.0,
                "volume": 0,
                "timestamp": p.get("time", datetime.now(timezone.utc).isoformat()),
                "source": "oanda",
            }
        except Exception as e:
            data_feed_errors.labels(source="oanda").inc()
            logger.error("oanda_get_tick_error", symbol=symbol, error=str(e))
            return None
