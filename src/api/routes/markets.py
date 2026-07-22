"""مارکت/صرافیِ فاز ۶ — REST `/academy/market/*` + WS `/academy/market/stream`.

قرارداد (سمتِ اپ): `docs/reverse-engineering/SERVER_HANDOFF_07_markets.md`.
فقط‌خواندنی، اعدادِ خام، **fail-soft**. اغلب عمومی (مهمان مجاز)؛ واچ‌لیست نیازِ توکن (مهمان→401).

منابعِ واقعی روی این پروداکشن:
- تیکر: **LBank public `/v2/ticker/24hr.do?symbol=all`** (اسپات) → latest/change/high/low/vol/turnover.
- global: **CoinGecko `/global`** (مارکت‌کپ/حجم/دامیننسِ BTC) + **alternative.me** (Fear&Greed).
- catalog/movers: از همان لیستِ تیکرها محاسبه می‌شود.
- واچ‌لیست: JSON در Redis per-user (`bn:mwatch:{sid}`)، لیستِ پیش‌فرضِ Favorites.

fail-soft (منبع/ذخیره ندارند → حذف): market_cap per-symbol, circulating_supply, mark/index_price,
change_1h/7d, sparkline (به‌جز جزئیاتِ نماد)، funding_rate/open_interest/long_short_ratio.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Body, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from src.api.routes.academy import current_student
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.core.security import verify_access_token

logger = get_logger(__name__)
router = APIRouter()

_LBANK_TICKER = "https://api.lbkex.com/v2/ticker/24hr.do"
_CG_GLOBAL = "https://api.coingecko.com/api/v3/global"
_FNG = "https://api.alternative.me/fng/?limit=1"

TICKERS_TTL = 5.0
GLOBAL_TTL = 60.0
CLOSE_BAD_FRAME = 4400
AUTH_TIMEOUT_SECONDS = 5.0
STREAM_POLL_SECONDS = 3.0
GLOBAL_EVERY = 30.0
PING_EVERY = 20.0

# کشِ درون‌پروسه (اشتراکی بینِ REST و WS)
_tickers_cache: dict[str, Any] = {"ts": 0.0, "data": []}
_global_cache: dict[str, Any] = {"ts": 0.0, "data": None}


def _f(v: Any) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _norm_pair(lbank_symbol: str) -> tuple[str, str, str]:
    """'btc_usdt' → (BTCUSDT, BTC, USDT)."""
    base, _, quote = lbank_symbol.partition("_")
    return (base + quote).upper(), base.upper(), quote.upper()


def _map_ticker(raw: dict) -> Optional[dict]:
    sym = raw.get("symbol")
    if not sym or "_" not in sym:
        return None
    t = raw.get("ticker") or {}
    symbol, base, quote = _norm_pair(sym)
    out = {
        "symbol": symbol, "base": base, "quote": quote,
        "market_type": "spot", "display_name": f"{base}/{quote}",
        "last_price": _f(t.get("latest")),
        "price_change_percent": _f(t.get("change")),
        "high_24h": _f(t.get("high")), "low_24h": _f(t.get("low")),
        "volume_24h": _f(t.get("vol")), "quote_volume_24h": _f(t.get("turnover")),
        "status": "trading",
        "updated_at": raw.get("timestamp"),
    }
    return {k: v for k, v in out.items() if v is not None}


async def _all_tickers(force: bool = False) -> list[dict]:
    now = time.time()
    if not force and (now - _tickers_cache["ts"]) < TICKERS_TTL and _tickers_cache["data"]:
        return _tickers_cache["data"]
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            r = await cli.get(_LBANK_TICKER, params={"symbol": "all"})
            r.raise_for_status()
            data = r.json().get("data") or []
    except Exception as e:  # noqa: BLE001
        logger.warning("markets_tickers_failed", error=str(e))
        return _tickers_cache["data"] or []
    mapped = [m for m in (_map_ticker(x) for x in data if str(x.get("symbol", "")).endswith("_usdt")) if m]
    # is_trending = ۲۰ نمادِ برتر بر اساسِ حجمِ نقل‌وانتقال
    top = sorted(mapped, key=lambda m: m.get("quote_volume_24h") or 0, reverse=True)[:20]
    trending = {m["symbol"] for m in top}
    for m in mapped:
        if m["symbol"] in trending:
            m["is_trending"] = True
    _tickers_cache["ts"] = now
    _tickers_cache["data"] = mapped
    return mapped


async def _global(force: bool = False) -> Optional[dict]:
    now = time.time()
    if not force and (now - _global_cache["ts"]) < GLOBAL_TTL and _global_cache["data"]:
        return _global_cache["data"]
    out: dict = {}
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            g = (await cli.get(_CG_GLOBAL)).json().get("data") or {}
            out["total_market_cap"] = _f((g.get("total_market_cap") or {}).get("usd"))
            out["total_volume_24h"] = _f((g.get("total_volume") or {}).get("usd"))
            out["btc_dominance"] = _f((g.get("market_cap_percentage") or {}).get("btc"))
            out["market_cap_change_percent_24h"] = _f(g.get("market_cap_change_percentage_24h_usd"))
    except Exception as e:  # noqa: BLE001
        logger.warning("markets_global_cg_failed", error=str(e))
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            fng = ((await cli.get(_FNG)).json().get("data") or [{}])[0]
            out["fear_greed"] = _f(fng.get("value"))
            out["fear_greed_label"] = fng.get("value_classification")
    except Exception as e:  # noqa: BLE001
        logger.warning("markets_fng_failed", error=str(e))
    out = {k: v for k, v in out.items() if v is not None}
    if not out:
        return _global_cache["data"]
    out["updated_at"] = datetime.now(timezone.utc).isoformat()
    _global_cache["ts"] = now
    _global_cache["data"] = out
    return out


def _reject_guest(authorization: Optional[str]) -> None:
    if not authorization or " " not in authorization:
        return
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if p and p.get("guest"):
        raise HTTPException(status_code=401, detail={"error_code": "GUEST_FORBIDDEN",
                                                     "message": "واچ‌لیست برای مهمان نیست؛ وارد شو."})


# ── REST (عمومی؛ مهمان مجاز) — مسیرهای literal قبل از /market/{symbol} ──
@router.get("/market/symbols")
async def market_symbols() -> dict:
    ts = await _all_tickers()
    return {"symbols": [{"symbol": m["symbol"], "base": m["base"], "quote": m["quote"],
                         "market_type": m["market_type"], "display_name": m["display_name"],
                         "status": m.get("status", "trading")} for m in ts]}


@router.get("/market/snapshot")
async def market_snapshot(market: str = "all", limit: int = 500) -> dict:
    ts = await _all_tickers()
    limit = max(1, min(int(limit), 2000))
    ts = sorted(ts, key=lambda m: m.get("quote_volume_24h") or 0, reverse=True)[:limit]
    return {"market": market, "tickers": ts,
            "updated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/market/global")
async def market_global() -> dict:
    g = await _global()
    return g or {"updated_at": datetime.now(timezone.utc).isoformat()}


@router.get("/market/movers")
async def market_movers(type: str = "gainers") -> dict:
    ts = [m for m in await _all_tickers() if m.get("price_change_percent") is not None]
    t = (type or "gainers").lower()
    if t == "gainers":
        ts.sort(key=lambda m: m["price_change_percent"], reverse=True)
    elif t == "losers":
        ts.sort(key=lambda m: m["price_change_percent"])
    elif t == "trending":
        ts = [m for m in ts if m.get("is_trending")]
        ts.sort(key=lambda m: m.get("quote_volume_24h") or 0, reverse=True)
    elif t == "new":
        ts = []  # منبعِ زمانِ لیست‌شدنِ نماد نداریم → fail-soft خالی
    return {"type": t, "movers": ts[:50]}


# ── واچ‌لیست (نیازِ توکن) — قبل از /market/{symbol} ──
def _wl_key(sid: int) -> str:
    return f"bn:mwatch:{sid}"


async def _wl_get(sid: int) -> list[dict]:
    try:
        v = await redis_client.get_json(_wl_key(sid))
    except Exception:  # noqa: BLE001
        v = None
    lists = (v or {}).get("lists") if isinstance(v, dict) else None
    if not lists:
        lists = [{"id": "favorites", "name": "Favorites", "symbols": []}]
    return lists


async def _wl_save(sid: int, lists: list[dict]) -> None:
    await redis_client.set_json(_wl_key(sid), {"lists": lists})


@router.get("/market/watchlists")
async def watchlists_get(st=Depends(current_student), authorization: Optional[str] = Header(None)) -> dict:
    _reject_guest(authorization)
    return {"watchlists": await _wl_get(st.id)}


@router.post("/market/watchlists")
async def watchlists_create(name: str = Body(..., embed=True), symbols: list = Body(default=[], embed=True),
                            st=Depends(current_student), authorization: Optional[str] = Header(None)) -> dict:
    _reject_guest(authorization)
    lists = await _wl_get(st.id)
    import re as _re
    new_id = _re.sub(r"[^a-z0-9]+", "-", (name or "list").lower()).strip("-")[:40] or f"wl{len(lists)}"
    if any(x["id"] == new_id for x in lists):
        new_id = f"{new_id}-{len(lists)}"
    lists.append({"id": new_id, "name": name[:60], "symbols": [str(s).upper() for s in symbols][:200]})
    await _wl_save(st.id, lists)
    return {"watchlists": lists}


@router.put("/market/watchlists")
async def watchlists_update(id: str = Body(..., embed=True), name: Optional[str] = Body(None, embed=True),
                            symbols: Optional[list] = Body(None, embed=True),
                            st=Depends(current_student), authorization: Optional[str] = Header(None)) -> dict:
    _reject_guest(authorization)
    lists = await _wl_get(st.id)
    for x in lists:
        if x["id"] == id:
            if name is not None:
                x["name"] = name[:60]
            if symbols is not None:
                x["symbols"] = [str(s).upper() for s in symbols][:200]
            break
    else:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "واچ‌لیست یافت نشد."})
    await _wl_save(st.id, lists)
    return {"watchlists": lists}


@router.delete("/market/watchlists")
async def watchlists_delete(id: str, st=Depends(current_student),
                            authorization: Optional[str] = Header(None)) -> dict:
    _reject_guest(authorization)
    lists = [x for x in await _wl_get(st.id) if x["id"] != id]
    if not lists:
        lists = [{"id": "favorites", "name": "Favorites", "symbols": []}]
    await _wl_save(st.id, lists)
    return {"watchlists": lists}


# ── جزئیاتِ نماد (catch-all؛ آخر از همه) ──
@router.get("/market/{symbol}")
async def market_symbol(symbol: str) -> dict:
    from src.api.routes._crypto_feed import is_crypto, crypto_klines
    sym = symbol.upper()
    ts = await _all_tickers()
    hit = next((m for m in ts if m["symbol"] == sym), None)
    if not hit:
        raise HTTPException(status_code=404, detail={"error_code": "NOT_FOUND", "message": "نماد یافت نشد."})
    out = dict(hit)
    # sparkline از کندلِ H1 (fail-soft)
    try:
        if is_crypto(sym):
            candles = await crypto_klines(sym, "H1", limit=48)
            spark = [c["c"] for c in candles if c.get("c")]
            if spark:
                out["sparkline"] = spark
    except Exception:  # noqa: BLE001
        pass
    return out


# ── WebSocket (مهمان مجاز؛ بدونِ توکن) ──
async def _authenticate(ws: WebSocket) -> bool:
    """مهمان مجاز است؛ فقط اگر توکن بد صریحاً داده شد رد می‌کنیم. همیشه True مگر توکنِ نامعتبر."""
    token = ws.query_params.get("token")
    if not token:
        return True  # مهمان
    payload = verify_access_token(token)
    return payload is not None  # توکنِ نامعتبر → رد


def _delta(prev: dict, cur: list[dict]) -> list[dict]:
    """فقط تیکرهایی که last_price/change تغییر کرده."""
    out = []
    for m in cur:
        s = m["symbol"]
        p = prev.get(s)
        if p is None or p.get("last_price") != m.get("last_price") or \
                p.get("price_change_percent") != m.get("price_change_percent"):
            out.append(m)
    return out


@router.websocket("/market/stream")
async def market_stream(ws: WebSocket) -> None:
    await ws.accept()
    if not await _authenticate(ws):
        await ws.close(code=4401)
        return

    sub: Optional[set[str]] = None  # subscribe اختیاری برای فیلترِ نماد

    async def send(obj: dict) -> bool:
        if ws.client_state != WebSocketState.CONNECTED:
            return False
        try:
            await ws.send_json(obj)
            return True
        except Exception:  # noqa: BLE001
            return False

    async def receive_loop() -> None:
        nonlocal sub
        while True:
            try:
                raw = await ws.receive_text()
            except (WebSocketDisconnect, Exception):  # noqa: BLE001
                break
            try:
                msg = json.loads(raw)
            except Exception:  # noqa: BLE001
                await ws.close(code=CLOSE_BAD_FRAME)
                break
            if not isinstance(msg, dict):
                continue
            mt = msg.get("type")
            if mt == "ping":
                await send({"type": "pong"})
            elif mt == "subscribe":
                syms = msg.get("symbols")
                sub = {str(s).upper() for s in syms} if isinstance(syms, list) else None
            elif mt == "unsubscribe":
                sub = None

    async def stream_loop() -> None:
        cur = await _all_tickers(force=True)
        prev = {m["symbol"]: m for m in cur}
        shown = [m for m in cur if (sub is None or m["symbol"] in sub)]
        await send({"type": "snapshot", "tickers": shown,
                    "updated_at": datetime.now(timezone.utc).isoformat()})
        g = await _global()
        if g:
            await send({"type": "global", "data": g})
        last_global = time.time()
        last_ping = time.time()
        while True:
            if ws.client_state != WebSocketState.CONNECTED:
                break
            now = time.time()
            cur = await _all_tickers()
            delta = _delta(prev, cur)
            if sub is not None:
                delta = [m for m in delta if m["symbol"] in sub]
            if delta:
                prev.update({m["symbol"]: m for m in cur})
                await send({"type": "tick", "tickers": delta})
            if now - last_global >= GLOBAL_EVERY:
                last_global = now
                g = await _global()
                if g:
                    await send({"type": "global", "data": g})
                    await send({"type": "movers", "gainers":
                                sorted([m for m in cur if m.get("price_change_percent") is not None],
                                       key=lambda m: m["price_change_percent"], reverse=True)[:10]})
            if now - last_ping >= PING_EVERY:
                last_ping = now
                await send({"type": "ping"})
            await asyncio.sleep(STREAM_POLL_SECONDS)

    recv_task = asyncio.create_task(receive_loop())
    stream_task = asyncio.create_task(stream_loop())
    try:
        await asyncio.wait({recv_task, stream_task}, return_when=asyncio.FIRST_COMPLETED)
    except Exception as exc:  # noqa: BLE001
        logger.error("market_stream_error", error=str(exc))
    finally:
        for task in (recv_task, stream_task):
            if not task.done():
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):  # noqa: BLE001
                    pass
        if ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.close()
            except Exception:  # noqa: BLE001
                pass
