"""
فیدِ مستقلِ کریپتو برای بازارنما (Pro-Chart) — مستقیماً از APIِ عمومیِ صرافیِ LBank (البنک).
بدونِ کلید، بدونِ وایت‌لیست (endpointهای عمومی). fetch سمتِ سرور.

- لیستِ نمادها: `currencyPairs.do` (کش ۱ساعته) → خودبه‌خود با کم/زیادشدنِ نمادِ LBank آپدیت می‌شود.
- کندل: `kline.do`.  قیمتِ لحظه‌ای: از Redis (که run_crypto_ws.py با poll ticker پر می‌کند) + fallback.
نمادها در بازارنما به‌شکلِ <COIN>USDT (مثلِ BTCUSDT)؛ نگاشت به فرمتِ LBank (btc_usdt).
"""
from __future__ import annotations

import time
from typing import Dict, Iterable, List, Optional

import httpx

LBANK_BASE = "https://api.lbkex.com/v2"

# نگاشتِ تایم‌فریمِ بازارنما → نوعِ کندلِ LBank + ثانیهٔ هر کندل
_TF_LBANK = {
    "M1": "minute1", "M5": "minute5", "M15": "minute15", "M30": "minute30",
    "H1": "hour1", "H4": "hour4", "H8": "hour8", "H12": "hour12",
    "D1": "day1", "W1": "week1", "MN": "month1",
}
_TF_SEC = {
    "minute1": 60, "minute5": 300, "minute15": 900, "minute30": 1800,
    "hour1": 3600, "hour4": 14400, "hour8": 28800, "hour12": 43200,
    "day1": 86400, "week1": 604800, "month1": 2592000,
}

# کشِ لیستِ نمادها (دینامیک از LBank). seedِ پایه تا اولین fetch، بعد گسترش می‌یابد.
_SEED = ["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "TRX", "AVAX", "LINK",
         "DOT", "LTC", "BCH", "ATOM", "UNI", "XLM", "ETC", "FIL", "TON", "NEAR"]
_pairs_set: set = {c + "USDT" for c in _SEED} | {c + "USD" for c in _SEED}
_pairs_list: List[str] = [c + "USDT" for c in _SEED]
_pairs_ts: float = 0.0
_PAIRS_TTL = 3600  # ۱ ساعت


def _bn_symbol(lbank_pair: str) -> str:
    a, _, b = lbank_pair.partition("_")
    return (a + b).upper()


def _lbank_pair(symbol: str) -> str:
    s = (symbol or "").upper()
    if s.endswith("USDT"):
        base = s[:-4]
    elif s.endswith("USD"):
        base = s[:-3]
    else:
        base = s
    return f"{base.lower()}_usdt"


async def ensure_pairs() -> List[str]:
    """لیستِ نمادهای USDTِ LBank را (با کش) برمی‌گرداند؛ خودبه‌خود آپدیت می‌شود."""
    global _pairs_set, _pairs_list, _pairs_ts
    now = time.time()
    if _pairs_list and (now - _pairs_ts) < _PAIRS_TTL:
        return _pairs_list
    try:
        async with httpx.AsyncClient(timeout=10.0) as cli:
            r = await cli.get(f"{LBANK_BASE}/currencyPairs.do")
            r.raise_for_status()
            data = r.json().get("data") or []
        usdt = [p for p in data if isinstance(p, str) and p.endswith("_usdt")]
        if usdt:
            syms = [_bn_symbol(p) for p in usdt]
            _pairs_list = syms
            _pairs_set = set(syms) | {s[:-1] for s in syms}  # BTCUSDT + BTCUSD(درواقع BTCUSD از brisۀ T)
            # دقیق‌تر: هم USDT و هم USD را بپذیر
            _pairs_set = set(syms) | {s[:-4] + "USD" for s in syms}
            _pairs_ts = now
    except Exception:  # noqa: BLE001
        pass
    return _pairs_list


def is_crypto(symbol: str) -> bool:
    return (symbol or "").upper() in _pairs_set


async def crypto_klines(symbol: str, tf: str, limit: int = 500,
                        before: Optional[int] = None) -> List[dict]:
    """کندل‌های LBank در فرمتِ بازارنما {t,o,h,l,c,v}."""
    t = _TF_LBANK.get((tf or "H1").upper(), "hour1")
    sec = _TF_SEC.get(t, 3600)
    n = max(1, min(int(limit), 2000))
    end = int(before) if before else int(time.time())
    start = max(0, end - n * sec)
    params = {"symbol": _lbank_pair(symbol), "size": n, "type": t, "time": start}
    async with httpx.AsyncClient(timeout=10.0) as cli:
        r = await cli.get(f"{LBANK_BASE}/kline.do", params=params)
        r.raise_for_status()
        data = r.json().get("data") or []
    out = []
    for k in data:
        try:
            out.append({"t": int(k[0]), "o": float(k[1]), "h": float(k[2]),
                        "l": float(k[3]), "c": float(k[4]), "v": float(k[5])})
        except Exception:  # noqa: BLE001
            continue
    return out


async def crypto_prices(symbols: Iterable[str]) -> Dict[str, dict]:
    """قیمتِ لحظه‌ای: اول از Redis (poll توسطِ run_crypto_ws.py)، سپس fallbackِ ticker."""
    wanted = [s.upper() for s in symbols if is_crypto(s)]
    if not wanted:
        return {}
    out: Dict[str, dict] = {}
    try:
        from src.core.redis_client import redis_client
        for su in wanted:
            v = await redis_client.get_json(f"bn:cprice:{su}")
            if v:
                out[su] = v
    except Exception:  # noqa: BLE001
        pass
    missing = [su for su in wanted if su not in out]
    if not missing:
        return out
    # fallback: تیکرِ تکیِ LBank برای موارد جامانده
    ts = int(time.time())
    async with httpx.AsyncClient(timeout=10.0) as cli:
        for su in missing[:20]:
            try:
                r = await cli.get(f"{LBANK_BASE}/ticker/24hr.do", params={"symbol": _lbank_pair(su)})
                d = (r.json().get("data") or [{}])[0].get("ticker") or {}
                px = float(d.get("latest") or 0)
                if px:
                    out[su] = {"bid": px, "ask": px, "mid": px, "ts": ts}
            except Exception:  # noqa: BLE001
                continue
    return out
