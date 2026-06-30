"""ingest_dukascopy — بک‌فیلِ دادهٔ تاریخیِ رایگانِ Dukascopy به جدولِ candles.

برای شبیه‌سازِ تمرین + بک‌تست: تیک‌های ساعتیِ .bi5 را دانلود، LZMA باز، به M1 OHLC
تجمیع و سپس به M5/M15/H1/H4/D1 ری‌سمپل و در candles (source='dukascopy') upsert می‌کند.
سرورِ ما (آلمان) مستقیم به datafeed.dukascopy.com دسترسی دارد.

اجرا (داخلِ کانتینرِ api):
  python scripts/ingest_dukascopy.py --symbols EURUSD,GBPUSD,XAUUSD --start 2024-06-01 --end 2026-06-19
گزینه‌ها: --symbols (پیش‌فرض: FXِ اصلی+فلزات) --start --end --concurrency --m1 (ذخیرهٔ M1 هم)
"""
from __future__ import annotations

import argparse
import asyncio
import lzma
import struct
import sys
from datetime import datetime, timedelta, timezone

import httpx
import pandas as pd

sys.path.insert(0, "/app")
from src.core.database import async_session_factory  # noqa: E402
from sqlalchemy import text  # noqa: E402

BASE = "https://datafeed.dukascopy.com/datafeed"

# نماد ما → (کدِ Dukascopy, ضریبِ مقیاسِ قیمت). فقط نمادهایی که کدِ تمیز دارند.
INSTRUMENTS: dict[str, tuple[str, float]] = {
    "EURUSD": ("EURUSD", 1e5), "GBPUSD": ("GBPUSD", 1e5), "AUDUSD": ("AUDUSD", 1e5),
    "NZDUSD": ("NZDUSD", 1e5), "USDCAD": ("USDCAD", 1e5), "USDCHF": ("USDCHF", 1e5),
    "EURGBP": ("EURGBP", 1e5), "EURAUD": ("EURAUD", 1e5),
    "USDJPY": ("USDJPY", 1e3), "EURJPY": ("EURJPY", 1e3), "GBPJPY": ("GBPJPY", 1e3),
    "AUDJPY": ("AUDJPY", 1e3),
    "XAUUSD": ("XAUUSD", 1e3), "XAGUSD": ("XAGUSD", 1e3),
}
DEFAULT_SYMBOLS = list(INSTRUMENTS.keys())

# تایم‌فریم‌های مقصد (freqِ pandas)
TF_FREQ = {"M5": "5min", "M15": "15min", "H1": "1h", "H4": "4h", "D1": "1D"}


async def _fetch_hour(client: httpx.AsyncClient, code: str, dt: datetime) -> bytes | None:
    # ماه در URL صفر-ایندکس است (00=ژانویه)
    url = f"{BASE}/{code}/{dt.year}/{dt.month - 1:02d}/{dt.day:02d}/{dt.hour:02d}h_ticks.bi5"
    for attempt in range(3):
        try:
            r = await client.get(url, timeout=30)
            if r.status_code == 200:
                return r.content
            if r.status_code == 404:
                return b""
        except Exception:  # noqa: BLE001
            await asyncio.sleep(1 + attempt)
    return None


def _parse_ticks(raw: bytes, hour_start: datetime, scale: float):
    """خروجی: list[(epoch_seconds_float, bid, vol)] از بیدِ هر تیک."""
    if not raw:
        return []
    try:
        data = lzma.decompress(raw)
    except Exception:  # noqa: BLE001
        return []
    base = hour_start.timestamp()
    out = []
    for ms, ask_pts, bid_pts, ask_vol, bid_vol in struct.iter_unpack(">IIIff", data):
        out.append((base + ms / 1000.0, bid_pts / scale, float(bid_vol) + float(ask_vol)))
    return out


def _is_market_hour(dt: datetime) -> bool:
    """فارکس: شنبه کامل بسته؛ جمعه بعد از ۲۱:۰۰ UTC و یکشنبه قبل از ۲۱:۰۰ UTC بسته."""
    wd = dt.weekday()  # 0=Mon .. 6=Sun
    if wd == 5:
        return False
    if wd == 4 and dt.hour >= 21:
        return False
    if wd == 6 and dt.hour < 21:
        return False
    return True


async def _upsert(rows: list[dict]):
    if not rows:
        return 0
    sql = text(
        "INSERT INTO candles (time, symbol, timeframe, open, high, low, close, volume, source) "
        "VALUES (:t, :s, :tf, :o, :h, :l, :c, :v, 'dukascopy') "
        "ON CONFLICT (time, symbol, timeframe) DO NOTHING"
    )
    async with async_session_factory() as session:
        for i in range(0, len(rows), 4000):
            await session.execute(sql, rows[i:i + 4000])
        await session.commit()
    return len(rows)


def _candles_from_ticks(ticks, symbol, store_m1: bool):
    """تیک‌ها → DataFrameِ M1 → ری‌سمپل به همهٔ TFها → list[dict] برای upsert."""
    if not ticks:
        return []
    df = pd.DataFrame(ticks, columns=["ts", "bid", "vol"])
    df["dt"] = pd.to_datetime(df["ts"], unit="s", utc=True)
    df = df.set_index("dt").sort_index()
    m1 = df["bid"].resample("1min").ohlc()
    m1["volume"] = df["vol"].resample("1min").sum()
    m1 = m1.dropna(subset=["open"])
    rows: list[dict] = []

    def emit(frame, tf):
        for idx, r in frame.iterrows():
            if pd.isna(r["open"]):
                continue
            rows.append({"t": idx.to_pydatetime(), "s": symbol, "tf": tf,
                         "o": float(r["open"]), "h": float(r["high"]), "l": float(r["low"]),
                         "c": float(r["close"]), "v": float(r.get("volume", 0) or 0)})

    if store_m1:
        emit(m1, "M1")
    for tf, freq in TF_FREQ.items():
        agg = m1.resample(freq).agg({"open": "first", "high": "max", "low": "min",
                                     "close": "last", "volume": "sum"}).dropna(subset=["open"])
        emit(agg, tf)
    return rows


async def ingest_symbol(symbol: str, start: datetime, end: datetime, sem: asyncio.Semaphore,
                        store_m1: bool):
    code, scale = INSTRUMENTS[symbol]
    hours = []
    d = start
    while d <= end:
        if _is_market_hour(d):
            hours.append(d)
        d += timedelta(hours=1)
    all_ticks = []
    done = 0
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        async def one(dt):
            async with sem:
                raw = await _fetch_hour(client, code, dt)
                return _parse_ticks(raw, dt, scale) if raw else []
        # پردازشِ روزانه تا حافظه کنترل شود + upsertِ تدریجی
        day = start.date()
        buf = []
        i = 0
        while i < len(hours):
            chunk = [h for h in hours if h.date() == hours[i].date()]
            i += len(chunk)
            results = await asyncio.gather(*[one(h) for h in chunk])
            for tk in results:
                buf.extend(tk)
            done += len(chunk)
            # هر چند روز یک‌بار flush
            if len(buf) > 400000 or i >= len(hours):
                rows = _candles_from_ticks(buf, symbol, store_m1)
                n = await _upsert(rows)
                print(f"  [{symbol}] {hours[min(i, len(hours)-1)].date()} flushed candles={n} (hours {done}/{len(hours)})", flush=True)
                buf = []
    print(f"✓ {symbol} done ({done} market-hours)", flush=True)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbols", default=",".join(DEFAULT_SYMBOLS))
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--concurrency", type=int, default=16)
    ap.add_argument("--m1", action="store_true", help="ذخیرهٔ M1 هم")
    a = ap.parse_args()
    syms = [s.strip().upper() for s in a.symbols.split(",") if s.strip() in INSTRUMENTS]
    start = datetime.fromisoformat(a.start).replace(tzinfo=timezone.utc)
    end = datetime.fromisoformat(a.end).replace(hour=23, tzinfo=timezone.utc)
    sem = asyncio.Semaphore(a.concurrency)
    print(f"Dukascopy ingest: {syms} | {start.date()} → {end.date()} | m1={a.m1}", flush=True)
    for s in syms:
        try:
            await ingest_symbol(s, start, end, sem, a.m1)
        except Exception as exc:  # noqa: BLE001
            print(f"✗ {s} failed: {exc}", flush=True)
    print("ALL DONE", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
