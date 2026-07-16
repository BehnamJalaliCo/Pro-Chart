"""کاتالوگِ لوگوی TradingView برای کریپتو — نگاشتِ نمادِ USDT → logoidِ TV.

هدف (به‌خواستِ مالک): جهانِ نمادهای کریپتو = جفت‌های LBank ∩ «نمادهایی که TV لوگو دارد».
- seed از فایلِ shipped `src/data/tv_crypto_catalog.json` (۵۹۶ نماد؛ با تطبیقِ دقیقِ تیکر ساخته شده).
- در Redis کش می‌شود؛ workerِ کریپتو به‌صورتِ افزایشی نمادهای جدیدِ LBank را با TV تطبیق می‌دهد
  (سینکِ خودکار — وقتی TV نمادی را با لوگو اضافه کرد، بی‌نیاز به بیلد به سایت می‌آید).
- منطقِ resolve فقط داده است (نه ترید)؛ همه‌ی خطاها بی‌صدا رد می‌شوند تا هرگز لیستِ نمادها را نشکند.
"""
from __future__ import annotations

import json
import os
import re
from typing import Dict, Optional, Set

import httpx

from src.core.redis_client import redis_client

# ── فایلِ seedِ shipped ──────────────────────────────────────────────
_SEED_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "tv_crypto_catalog.json")
_seed_cache: Optional[Dict[str, str]] = None

# ── کلیدهای Redis ────────────────────────────────────────────────────
RKEY_MAP = "bn:tvlogo"          # hash: SYMBOL(USDT) → logoidِ TV
RKEY_OK = "bn:tv_crypto_ok"     # set: نمادهایی که لوگوی TV دارند
RKEY_NO = "bn:tv_crypto_no"     # set: نمادهایی که تطبیق ندادند (کشِ منفی — دوباره resolve نشوند)

_SS_URL = "https://symbol-search.tradingview.com/symbol_search/v3/"
_SS_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Origin": "https://www.tradingview.com",
    "Referer": "https://www.tradingview.com/",
}
# توکن‌های اهرمی/ساختگیِ LBank (TV اینها را ندارد) — پیش‌فیلتر تا فراخوانیِ بی‌جا به TV نزنیم.
_LEV = re.compile(r"(\d+[LS]|\d{2,}|UP|DOWN|BULL|BEAR|HALF)$")
_TAG = re.compile(r"<[^>]+>")


def _seed() -> Dict[str, str]:
    global _seed_cache
    if _seed_cache is None:
        try:
            with open(_SEED_PATH, encoding="utf-8") as f:
                _seed_cache = {str(k).upper(): str(v) for k, v in json.load(f).items()}
        except Exception:  # noqa: BLE001
            _seed_cache = {}
    return _seed_cache


def _norm(sym: str) -> str:
    """نمادِ داخلی را نرمال می‌کند به فرمِ USDT (BTC → BTCUSDT، btc_usdt → BTCUSDT)."""
    s = (sym or "").upper().replace("_", "")
    if s.endswith("USD") and not s.endswith("USDT"):
        s = s[:-3] + "USDT"
    if not s.endswith("USDT"):
        s = s + "USDT"
    return s


async def ensure_seeded() -> None:
    """اگر Redis خالی بود، از فایلِ shipped یک‌بار seed کن (idempotent)."""
    try:
        n = await redis_client.client.scard(RKEY_OK)
        if n and int(n) > 50:
            return
        seed = _seed()
        if not seed:
            return
        async with redis_client.client.pipeline(transaction=False) as pipe:
            pipe.hset(RKEY_MAP, mapping=seed)
            pipe.sadd(RKEY_OK, *list(seed.keys()))
            await pipe.execute()
    except Exception:  # noqa: BLE001
        pass


async def tv_ok_symbols() -> Set[str]:
    """مجموعهٔ نمادهای کریپتویی که لوگوی TV دارند (Redis؛ fallback به seed)."""
    try:
        s = await redis_client.client.smembers(RKEY_OK)
        if s:
            return {str(x).upper() for x in s}
    except Exception:  # noqa: BLE001
        pass
    return set(_seed().keys())


async def logoid_map() -> Dict[str, str]:
    """نگاشتِ SYMBOL → logoid (برای فرانت/پراکسی). Redis؛ fallback به seed."""
    try:
        h = await redis_client.client.hgetall(RKEY_MAP)
        if h:
            return {str(k).upper(): str(v) for k, v in h.items()}
    except Exception:  # noqa: BLE001
        pass
    return dict(_seed())


def _match_logoid(payload: dict, base: str) -> Optional[str]:
    """logoidِ کریپتوی TV را با تطبیقِ دقیقِ تیکر برمی‌گرداند (بدون مثبتِ کاذب)."""
    for it in payload.get("symbols", []):
        sym = _TAG.sub("", it.get("symbol", "") or "").upper()
        lid = (it.get("logo") or {}).get("logoid") or it.get("logoid")
        if lid and str(lid).startswith("crypto/") and sym == base:
            return str(lid)
    return None


async def _resolve_one(base: str, cli: httpx.AsyncClient) -> Optional[str]:
    try:
        r = await cli.get(_SS_URL, params={
            "text": base, "hl": "0", "exchange": "", "lang": "en",
            "search_type": "", "domain": "production"}, headers=_SS_HEADERS)
        if r.status_code != 200:
            return None
        return _match_logoid(r.json(), base)
    except Exception:  # noqa: BLE001
        return None


async def sync_new(pairs, limit: int = 40) -> int:
    """برای جفت‌های تازهٔ LBank که هنوز در کاتالوگ نیستند، logoidِ TV را resolve و ذخیره کن.
    هر فراخوانی حداکثر `limit` نمادِ جدید (سینکِ تدریجی — بارِ کم روی TV/worker).
    `pairs`: لیستی از نمادها به هر فرمی (BTCUSDT / btc_usdt / BTC)."""
    await ensure_seeded()
    try:
        known = {str(x).upper() for x in (await redis_client.client.smembers(RKEY_OK) or [])}
        neg = {str(x).upper() for x in (await redis_client.client.smembers(RKEY_NO) or [])}
    except Exception:  # noqa: BLE001
        known, neg = set(), set()

    todo = []
    seen = set()
    for p in pairs or []:
        sym = _norm(p)
        if sym in seen or sym in known or sym in neg:
            continue
        seen.add(sym)
        if _LEV.search(sym[:-4]):
            continue
        todo.append(sym)
        if len(todo) >= limit:
            break
    if not todo:
        return 0

    added = 0
    async with httpx.AsyncClient(timeout=12.0) as cli:
        for sym in todo:
            lid = await _resolve_one(sym[:-4], cli)
            try:
                if lid:
                    await redis_client.client.hset(RKEY_MAP, sym, lid)
                    await redis_client.client.sadd(RKEY_OK, sym)
                    added += 1
                else:
                    await redis_client.client.sadd(RKEY_NO, sym)
            except Exception:  # noqa: BLE001
                pass
    return added
