"""میرورِ قیمتِ زندهٔ فارکس/فلز/شاخصِ Pro-Chart.
قیمت را از کوین‌پرو (که Finnhub WS دارد) هر ~۱ثانیه می‌خواند و در Redis `price:{SYMBOL}` می‌نویسد.
اتصالِ دومِ Finnhub نمی‌زند (تداخلِ کلید با کوین‌پرو) — منبعِ واحد، mirror می‌شود.
"""
from __future__ import annotations

import asyncio
import logging
import os

import httpx

from src.core.redis_client import redis_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("fx_mirror")

_BASE = os.getenv("BN_FOREX_SVC_URL", "http://10.10.1.3:8000").rstrip("/")
_TOK = os.getenv("BN_BRIDGE_TOKEN", "")
_INTERVAL = float(os.getenv("BN_FX_MIRROR_INTERVAL", "1.0"))


async def main() -> None:
    await redis_client.connect()
    url = _BASE + "/public/prices/svc"
    log.info("fx price mirror → %s every %.1fs", url, _INTERVAL)
    n = 0
    async with httpx.AsyncClient(timeout=5.0) as cx:
        while True:
            try:
                r = await cx.get(url, headers={"X-Internal-Token": _TOK})
                if r.status_code == 200:
                    prices = (r.json() or {}).get("prices", {}) or {}
                    for sym, tick in prices.items():
                        if tick and tick.get("price"):
                            await redis_client.set_price(sym, tick)
                    n += 1
                    if n % 60 == 1:
                        log.info("mirrored %d forex prices", len(prices))
                else:
                    log.warning("mirror http %s", r.status_code)
            except Exception as e:  # noqa: BLE001
                log.warning("mirror err: %s", str(e)[:120])
            await asyncio.sleep(_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
