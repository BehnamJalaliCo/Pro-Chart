"""کاتالوگِ نمادِ یکپارچه (فاز۶+) — هم‌ترازیِ نمادها با TradingView.

هدف (به‌خواستِ مالک):
- کریپتو = جفت‌های **LBank ∩ نمادهای دارای لوگوی TradingView** (از `_tv_catalog`، سینکِ خودکار).
- فارکس/فلز/نفت/شاخص/سهام/ETF = جهانِ زندهٔ فیدِ پلتفرم (کلیدهای `price:*` در Redis) که همان
  «موجود در OneRoyal + لیستِ TradingView» است؛ به‌محضِ افزوده‌شدنِ نمادِ جدید توسطِ فید،
  همان‌لحظه در کاتالوگ می‌آید (بدونِ نیاز به دیپلوی).

REST: `GET /academy/market/catalog` (+ `?market=`, `?q=`, `?limit=`) و `GET /academy/market/catalog/version`.
WS:   `/academy/market/catalog/stream` — snapshot → added/removed/version → pong.

عمومی/مهمان مجاز، فقط‌خواندنی، **fail-soft** (هرگز لیستِ نماد را نمی‌شکند).
"""
from __future__ import annotations

import asyncio
import json
import time
import zlib
from typing import Any, Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from src.api.routes._tv_catalog import ensure_seeded, logoid_map, tv_ok_symbols
from src.api.routes.markets import _all_tickers
from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)
router = APIRouter()

CATALOG_TTL = 30.0            # کشِ درون‌پروسه
STREAM_POLL_SECONDS = 20.0
PING_EVERY = 20.0
TV_LOGO_BASE = "https://s3-symbol-logo.tradingview.com"

# کدهای ارزیِ فارکس برای تشخیصِ جفتِ ۶حرفی
_FX = {"USD", "EUR", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD", "SGD", "HKD",
       "NOK", "SEK", "MXN", "TRY", "ZAR", "PLN", "CNH", "DKK", "CZK", "HUF"}
# فلزات/انرژی (پایهٔ نمادِ داخلی)
_METALS = {"XAU": "طلا", "XAG": "نقره", "XPT": "پلاتین", "XPD": "پالادیوم"}
_METAL_ETF = {"GLD"}
_ENERGY = {"XTIUSD": "نفت WTI", "XBRUSD": "نفت برنت", "XNGUSD": "گاز طبیعی",
           "WTI": "نفت WTI", "USOIL": "نفت WTI", "UKOIL": "نفت برنت"}
# شاخص‌ها (نمادِ داخلی → نامِ نمایشی)
_INDICES = {
    "US30": "داوجونز", "US500": "اس‌اندپی ۵۰۰", "NAS100": "نزدک ۱۰۰", "US2000": "راسل ۲۰۰۰",
    "DE40": "داکس آلمان", "UK100": "فوتسی ۱۰۰", "EU50": "یورواستاکس ۵۰", "FRA40": "کک فرانسه",
    "JP225": "نیکی ۲۲۵", "HK50": "هنگ‌سنگ", "AUS200": "ای‌اس‌ایکس ۲۰۰",
}
_INDEX_ETF = {"SPY", "QQQ", "DIA", "IWM"}


def _tv_prefix_noncrypto(symbol: str, market: str, base: str, quote: str) -> str:
    """نمادِ استانداردِ TradingView (برای ویجت/جست‌وجوی سمتِ اپ)."""
    if market == "forex":
        return f"OANDA:{symbol}"
    if market == "metal":
        if symbol in _METAL_ETF:
            return f"AMEX:{symbol}"
        return f"OANDA:{base}{quote}"
    if market == "energy":
        return "TVC:USOIL" if base in ("XTI", "WTI") else "TVC:UKOIL"
    if market == "index":
        return f"OANDA:{symbol}"
    if market == "etf":
        return f"AMEX:{symbol}"
    return f"NASDAQ:{symbol}"  # سهام — best-effort (اپ می‌تواند اصلاح کند)


def _classify_noncrypto(symbol: str) -> tuple[str, str, str, Optional[str]]:
    """(market, base, quote, name_fa|None) برای نمادِ غیرکریپتوییِ فیدشده."""
    s = symbol.upper()
    names = settings.symbol_names_fa
    # فلز/انرژیِ ۶حرفی مثلِ XAUUSD/XTIUSD
    if s in _ENERGY:
        return "energy", s[:3], s[3:] if len(s) > 3 else "USD", _ENERGY[s]
    if len(s) == 6 and s[:3] in _METALS:
        return "metal", s[:3], s[3:], _METALS[s[:3]]
    if s in _METAL_ETF:
        return "metal", s, "USD", "طلا (ETF)"
    if s in _INDICES:
        return "index", s, "USD", _INDICES[s]
    if s in _INDEX_ETF:
        return "etf", s, "USD", names.get(s)
    if len(s) == 6 and s[:3] in _FX and s[3:] in _FX:
        return "forex", s[:3], s[3:], names.get(s)
    # هرچیزِ دیگر = سهام
    return "stock", s, "USD", names.get(s)


async def _noncrypto_symbols() -> list[str]:
    """جهانِ زندهٔ غیرکریپتو = کلیدهای `price:*` در Redis (فیدِ OneRoyal/finnhub/…)."""
    out: list[str] = []
    try:
        c = redis_client.client
        async for k in c.scan_iter(match="price:*", count=1000):
            key = k if isinstance(k, str) else k.decode()
            sym = key.split("price:", 1)[1]
            if sym:
                out.append(sym.upper())
            if len(out) >= 5000:
                break
    except Exception:  # noqa: BLE001
        pass
    return sorted(set(out))


async def _build_catalog() -> dict:
    """کاتالوگِ کامل را می‌سازد (کریپتو ∩ TV + غیرکریپتوی فیدشده)."""
    await ensure_seeded()
    items: list[dict] = []

    # ── کریپتو: LBank ∩ tv_ok ──
    try:
        ok = await tv_ok_symbols()
        lm = await logoid_map()
        tickers = await _all_tickers()
        for m in tickers:
            sym = str(m.get("symbol", "")).upper()
            if not sym or sym not in ok:
                continue
            lid = lm.get(sym)
            items.append({
                "symbol": sym, "market": "crypto",
                "base": m.get("base"), "quote": m.get("quote") or "USDT",
                "name": m.get("base"), "name_fa": None,
                "tv": f"LBANK:{sym}",
                "logoid": lid,
                "logo": f"{TV_LOGO_BASE}/{lid}.svg" if lid else None,
                "tradable": True,
            })
    except Exception as e:  # noqa: BLE001
        logger.warning("catalog_crypto_failed", error=str(e))

    # ── غیرکریپتو: فیدِ زنده ──
    try:
        for sym in await _noncrypto_symbols():
            market, base, quote, name_fa = _classify_noncrypto(sym)
            items.append({
                "symbol": sym, "market": market,
                "base": base, "quote": quote,
                "name": sym, "name_fa": name_fa,
                "tv": _tv_prefix_noncrypto(sym, market, base, quote),
                "logoid": None, "logo": None,
                "tradable": True,
            })
    except Exception as e:  # noqa: BLE001
        logger.warning("catalog_noncrypto_failed", error=str(e))

    syms = sorted(x["symbol"] for x in items)
    version = format(zlib.crc32("|".join(syms).encode()), "08x")
    counts: dict[str, int] = {}
    for x in items:
        counts[x["market"]] = counts.get(x["market"], 0) + 1
    return {"version": version, "count": len(items), "counts": counts,
            "updated_at": int(time.time()), "symbols": items}


# کشِ درون‌پروسه (اشتراکی REST/WS)
_cache: dict[str, Any] = {"ts": 0.0, "data": None}


async def _catalog(force: bool = False) -> dict:
    now = time.time()
    if not force and _cache["data"] is not None and (now - _cache["ts"]) < CATALOG_TTL:
        return _cache["data"]
    data = await _build_catalog()
    _cache["ts"] = now
    _cache["data"] = data
    return data


@router.get("/market/catalog")
async def market_catalog(market: str = "all", q: str = "", limit: int = 0) -> dict:
    """کاتالوگِ نمادِ هم‌ترازشده با TradingView. عمومی. `market`=all|crypto|forex|metal|energy|index|etf|stock."""
    data = await _catalog()
    items = data["symbols"]
    m = (market or "all").lower()
    if m != "all":
        items = [x for x in items if x["market"] == m]
    if q:
        qq = q.strip().upper()
        items = [x for x in items if qq in x["symbol"] or qq in (x.get("base") or "").upper()]
    if limit and limit > 0:
        items = items[: int(limit)]
    return {"version": data["version"], "count": len(items),
            "counts": data["counts"], "updated_at": data["updated_at"],
            "market": m, "symbols": items}


@router.get("/market/catalog/version")
async def market_catalog_version() -> dict:
    """فقط نسخه + شمارش — برای پولینگِ سبک (اپ می‌تواند تغییر را تشخیص دهد)."""
    data = await _catalog()
    return {"version": data["version"], "count": data["count"],
            "counts": data["counts"], "updated_at": data["updated_at"]}


@router.websocket("/market/catalog/stream")
async def market_catalog_stream(ws: WebSocket) -> None:
    """استریمِ زندهٔ کاتالوگ: snapshot سپس added/removed/version. عمومی (بدونِ توکن)."""
    await ws.accept()

    async def send(obj: dict) -> bool:
        try:
            await ws.send_text(json.dumps(obj, ensure_ascii=False))
            return True
        except Exception:  # noqa: BLE001
            return False

    try:
        data = await _catalog()
        prev = {x["symbol"] for x in data["symbols"]}
        prev_ver = data["version"]
        if not await send({"type": "snapshot", "version": prev_ver, "count": data["count"],
                           "counts": data["counts"], "symbols": data["symbols"]}):
            return
        last_ping = time.time()
        while ws.application_state == WebSocketState.CONNECTED:
            await asyncio.sleep(STREAM_POLL_SECONDS)
            try:
                data = await _catalog(force=True)
            except Exception:  # noqa: BLE001
                continue
            cur = {x["symbol"]: x for x in data["symbols"]}
            cur_set = set(cur.keys())
            added = [cur[s] for s in sorted(cur_set - prev)]
            removed = sorted(prev - cur_set)
            if data["version"] != prev_ver or added or removed:
                if not await send({"type": "delta", "version": data["version"],
                                   "count": data["count"], "counts": data["counts"],
                                   "added": added, "removed": removed}):
                    return
                prev, prev_ver = cur_set, data["version"]
            now = time.time()
            if now - last_ping >= PING_EVERY:
                last_ping = now
                if not await send({"type": "pong", "ts": int(now)}):
                    return
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        logger.warning("catalog_stream_error", error=str(e))
    finally:
        if ws.application_state == WebSocketState.CONNECTED:
            try:
                await ws.close()
            except Exception:  # noqa: BLE001
                pass
