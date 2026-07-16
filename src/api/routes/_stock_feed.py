"""فیدِ مستقلِ سهام/ETF برای بازارنما (Pro-Chart).

- جهانِ نمادها: سهام/ETFِ پرمعامله‌ای که TradingView لوگو دارد (STOCKS_TOP).
- کندل/تاریخچه: از yfinance (Yahoo) — چون candleِ سهامِ finnhub در پلنِ رایگان بسته است.
- قیمتِ لحظه‌ای: workerِ run_stock_ws.py از finnhub `/quote` می‌گیرد و در Redis `price:{SYM}` می‌نویسد.
نمادها به‌شکلِ تیکرِ خام (AAPL, SPY) — که مستقیماً نمادِ yfinance/finnhub هم هست.
"""
from __future__ import annotations

import asyncio
import time
from typing import Dict, List, Optional

# سهام/ETFِ پرمعامله که TV لوگو دارد (زیرمجموعهٔ STOCK_LOGO فرانت؛ به‌قدرِ محدودیتِ نرخِ finnhub رایگان ~۵۰).
STOCKS_TOP = frozenset({
    # مگاکپ/تکنولوژی
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "NFLX", "AMD",
    "INTC", "CRM", "ORCL", "ADBE", "CSCO", "QCOM", "TXN", "AMAT", "IBM", "MU",
    "ARM", "PLTR", "SMCI", "DELL", "UBER",
    # مصرفی/مالی/صنعتی/دارو
    "PYPL", "DIS", "BABA", "KO", "PEP", "MCD", "NKE", "V", "MA", "JPM",
    "BAC", "WMT", "COST", "PFE", "BA", "GS", "SBUX", "COIN", "SHOP", "ABNB",
    "MSTR", "HOOD",
    # ETFهای پرمعامله
    "SPY", "QQQ", "IWM", "DIA", "GLD",
})

# نگاشتِ تایم‌فریمِ بازارنما → (interval, period) برای yfinance. H4 از H1 resample می‌شود.
_YF_TF = {
    "M1": ("1m", "7d"), "M5": ("5m", "60d"), "M15": ("15m", "60d"), "M30": ("30m", "60d"),
    "H1": ("60m", "730d"), "H4": ("60m", "730d"), "D1": ("1d", "10y"),
    "W1": ("1wk", "max"), "MN": ("1mo", "max"),
}
_KLINE_TTL = 60  # کشِ کندل ۶۰ثانیه (yfinance کند/rate-limited است)


def is_stock(symbol: str) -> bool:
    return (symbol or "").upper() in STOCKS_TOP


def _yf_fetch(symbol: str, interval: str, period: str, four_h: bool) -> List[dict]:
    """فراخوانیِ همگامِ yfinance (در threadpool اجرا می‌شود). خروجی: [{t,o,h,l,c,v}]."""
    import yfinance as yf
    df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=False)
    if df is None or df.empty:
        return []
    if four_h:
        df = df.resample("4h").agg({"Open": "first", "High": "max", "Low": "min",
                                    "Close": "last", "Volume": "sum"}).dropna()
    out: List[dict] = []
    for ts, row in df.iterrows():
        try:
            out.append({
                "t": int(ts.timestamp()),
                "o": float(row["Open"]), "h": float(row["High"]),
                "l": float(row["Low"]), "c": float(row["Close"]),
                "v": float(row.get("Volume", 0) or 0),
            })
        except Exception:  # noqa: BLE001
            continue
    return out


async def stock_klines(symbol: str, tf: str, limit: int = 300) -> List[dict]:
    """کندل‌های سهام از yfinance (با کشِ Redis). فرمتِ بازارنما {t,o,h,l,c,v}."""
    sym = (symbol or "").upper()
    tfu = (tf or "H1").upper()
    interval, period = _YF_TF.get(tfu, ("60m", "730d"))
    ckey = f"bn:sklines:{sym}:{tfu}"
    try:
        from src.core.redis_client import redis_client
        cached = await redis_client.get_json(ckey)
        if cached:
            return cached[-limit:] if limit else cached
    except Exception:  # noqa: BLE001
        pass
    try:
        rows = await asyncio.to_thread(_yf_fetch, sym, interval, period, tfu == "H4")
    except Exception:  # noqa: BLE001
        rows = []
    if rows:
        try:
            from src.core.redis_client import redis_client
            await redis_client.set_json(ckey, rows, expire=_KLINE_TTL)
        except Exception:  # noqa: BLE001
            pass
    return rows[-limit:] if limit else rows
