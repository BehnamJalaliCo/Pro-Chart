"""استریمرِ WebSocketِ واقعیِ کریپتوی Pro-Chart — LBank WS V2، قیمتِ لحظه‌ایِ میلی‌ثانیه‌ای.
فقط ۱۰۰ جفتِ برترِ USDT (بر اساسِ حجمِ ۲۴ساعته). هر tick → Redis `bn:cprice:{SYM}` بلافاصله.
+ بکاپِ REST هر ۱۰ثانیه (تازگیِ کلید). + set `bn:crypto_top100` برای trimِ کاتالوگ.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time

import httpx

from src.core.redis_client import redis_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("crypto_ws")

_WS = "wss://www.lbkex.net/ws/V2/"
_TICKER = "https://api.lbkex.com/v2/ticker/24hr.do"
_TTL = 60
_TOPN = 100
_REFRESH = 1800  # هر ۳۰دقیقه top-100 بازبینی


def _bn(pair: str) -> str:
    a, _, b = pair.partition("_")
    return (a + b).upper()


async def _top_pairs(cli: httpx.AsyncClient) -> list[str]:
    r = await cli.get(_TICKER, params={"symbol": "all"})
    data = r.json().get("data") or []
    usdt = [x for x in data if str(x.get("symbol", "")).endswith("_usdt")]

    def turn(x):
        try:
            return float((x.get("ticker") or {}).get("turnover") or 0)
        except Exception:  # noqa: BLE001
            return 0
    usdt.sort(key=turn, reverse=True)
    return [x["symbol"] for x in usdt[:_TOPN] if x.get("symbol")]


async def _write(pair: str, px: float) -> None:
    sym = _bn(pair)
    val = {"bid": px, "ask": px, "mid": px, "ts": int(time.time())}
    await redis_client.set_json(f"bn:cprice:{sym}", val, expire=_TTL)
    await redis_client.set_json(f"bn:cprice:{sym[:-4]}USD", val, expire=_TTL)


async def _store_top(pairs: list[str]) -> None:
    try:
        await redis_client.client.delete("bn:crypto_top100")
        if pairs:
            await redis_client.client.sadd("bn:crypto_top100", *[_bn(p) for p in pairs])
    except Exception as e:  # noqa: BLE001
        log.warning("store_top: %s", e)


async def _rest_backup(cli: httpx.AsyncClient, get_set) -> None:
    while True:
        try:
            r = await cli.get(_TICKER, params={"symbol": "all"})
            ps = get_set()
            for row in (r.json().get("data") or []):
                p = row.get("symbol") or ""
                if p in ps:
                    px = float((row.get("ticker") or {}).get("latest") or 0)
                    if px > 0:
                        await _write(p, px)
        except Exception as e:  # noqa: BLE001
            log.warning("rest backup: %s", str(e)[:100])
        await asyncio.sleep(10)


async def run() -> None:
    await redis_client.connect()
    import websockets
    state = {"pairs": [], "set": set()}
    async with httpx.AsyncClient(timeout=12.0) as cli:
        state["pairs"] = await _top_pairs(cli)
        state["set"] = set(state["pairs"])
        await _store_top(state["pairs"])
        log.info("top-100 crypto by volume ready (%d pairs)", len(state["pairs"]))
        asyncio.create_task(_rest_backup(cli, lambda: state["set"]))
        last = time.time()
        while True:
            try:
                async with websockets.connect(_WS, open_timeout=15, ping_interval=None,
                                               close_timeout=5, max_size=2 ** 20) as ws:
                    for p in state["pairs"]:
                        await ws.send(json.dumps({"action": "subscribe", "subscribe": "tick", "pair": p}))
                    log.info("LBank WS connected — %d pairs (میلی‌ثانیه‌ای)", len(state["pairs"]))
                    async for raw in ws:
                        try:
                            m = json.loads(raw)
                        except Exception:  # noqa: BLE001
                            continue
                        if m.get("action") == "ping":
                            await ws.send(json.dumps({"action": "pong", "pong": m.get("ping")}))
                            continue
                        tk = m.get("tick")
                        if tk and m.get("pair"):
                            try:
                                px = float(tk.get("latest") or 0)
                            except Exception:  # noqa: BLE001
                                px = 0
                            if px > 0:
                                await _write(m["pair"], px)
                        if time.time() - last > _REFRESH:
                            last = time.time()
                            newp = await _top_pairs(cli)
                            if newp and set(newp) != state["set"]:
                                state["pairs"] = newp
                                state["set"] = set(newp)
                                await _store_top(newp)
                                log.info("top-100 refreshed → resubscribe")
                                break
            except Exception as e:  # noqa: BLE001
                log.warning("LBank WS reconnect: %s", str(e)[:120])
                await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run())
