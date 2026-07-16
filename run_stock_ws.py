"""فیدِ قیمتِ سهام/ETFِ Pro-Chart — از finnhub REST `/quote` (پلنِ رایگان: ۶۰ فراخوان/دقیقه).
هر نماد را با فاصلهٔ ~۱.۱ثانیه poll می‌کند (رعایتِ نرخ) و در Redis `price:{SYM}` می‌نویسد.
prevClose هم ذخیره می‌شود تا واچ‌لیست «تغییرِ٪» را درست نشان دهد. کندلِ سهام از yfinance می‌آید (جدا).
"""
from __future__ import annotations

import asyncio
import logging
import os
import time

import httpx

from src.core.redis_client import redis_client
from src.api.routes._stock_feed import STOCKS_TOP

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("stock_ws")

_KEY = os.getenv("FINNHUB_API_KEY", "")
_QUOTE = "https://finnhub.io/api/v1/quote"
_GAP = float(os.getenv("BN_STOCK_QUOTE_GAP", "1.1"))   # فاصلهٔ بینِ فراخوان‌ها (رعایتِ ۶۰/دقیقه)
_TTL = 120                                              # قیمت ۲دقیقه زنده می‌ماند


async def _poll_one(cli: httpx.AsyncClient, sym: str) -> bool:
    try:
        r = await cli.get(_QUOTE, params={"symbol": sym, "token": _KEY})
        if r.status_code != 200:
            return False
        q = r.json() or {}
        c = float(q.get("c") or 0)
        if c <= 0:
            return False
        pc = float(q.get("pc") or 0)
        val = {"bid": c, "ask": c, "price": c, "mid": c,
               "ts": int(time.time()), "source": "finnhub-stock"}
        if pc > 0:
            val["prevClose"] = pc
        await redis_client.set_price(sym, val)
        return True
    except Exception as e:  # noqa: BLE001
        log.warning("quote %s: %s", sym, str(e)[:80])
        return False


async def run() -> None:
    if not _KEY:
        log.error("FINNHUB_API_KEY تنظیم نشده — فیدِ سهام غیرفعال.")
        return
    await redis_client.connect()
    syms = sorted(STOCKS_TOP)
    log.info("stock price feed → %d symbols, gap %.1fs (finnhub quote)", len(syms), _GAP)
    async with httpx.AsyncClient(timeout=8.0) as cli:
        cyc = 0
        while True:
            ok = 0
            for sym in syms:
                if await _poll_one(cli, sym):
                    ok += 1
                await asyncio.sleep(_GAP)
            cyc += 1
            if cyc % 1 == 0:
                log.info("stock cycle done — %d/%d priced", ok, len(syms))


if __name__ == "__main__":
    asyncio.run(run())
