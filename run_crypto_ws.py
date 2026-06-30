"""
استریمرِ مستقلِ قیمتِ کریپتو برای بازارنما (Pro-Chart) — از صرافیِ LBank (البنک).

هر ~۱.۵ ثانیه `ticker/24hr.do?symbol=all` را می‌خواند (همهٔ ~۱۲۷۱ جفتِ USDT در یک
درخواست) و قیمتِ `latest` را در Redis می‌نویسد (کلید `bn:cprice:{SYMBOL}`). مسیرِ
/prices ابتدا از همین Redis می‌خواند → قیمتِ بلادرنگ. بدونِ کلید، بدونِ وایت‌لیست.
"""
from __future__ import annotations

import asyncio
import logging
import time

import httpx

from src.core.redis_client import redis_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("crypto_ws")

_URL = "https://api.lbkex.com/v2/ticker/24hr.do"
_INTERVAL = 1.5
_TTL = 20  # اگر poll قطع شد، قیمتِ کهنه بعد از ۲۰ث پاک می‌شود


def _bn_symbol(lbank_pair: str) -> str:
    a, _, b = lbank_pair.partition("_")
    return (a + b).upper()


async def run() -> None:
    await redis_client.connect()
    log.info("LBank crypto price poller starting (interval=%.1fs)", _INTERVAL)
    async with httpx.AsyncClient(timeout=10.0) as cli:
        while True:
            try:
                r = await cli.get(_URL, params={"symbol": "all"})
                r.raise_for_status()
                data = r.json().get("data") or []
                n = 0
                for row in data:
                    pair = row.get("symbol") or ""
                    if not pair.endswith("_usdt"):
                        continue
                    tk = row.get("ticker") or {}
                    px = float(tk.get("latest") or 0)
                    if px <= 0:
                        continue
                    sym = _bn_symbol(pair)          # btc_usdt → BTCUSDT
                    coin = sym[:-4]                  # BTCUSDT → BTC
                    val = {"bid": px, "ask": px, "mid": px, "ts": int(time.time())}
                    await redis_client.set_json(f"bn:cprice:{sym}", val, expire=_TTL)
                    await redis_client.set_json(f"bn:cprice:{coin}USD", val, expire=_TTL)
                    n += 1
                if n:
                    log.debug("updated %d crypto prices", n)
            except Exception as exc:  # noqa: BLE001
                log.warning("LBank ticker poll error: %s", exc)
            await asyncio.sleep(_INTERVAL)


if __name__ == "__main__":
    asyncio.run(run())
