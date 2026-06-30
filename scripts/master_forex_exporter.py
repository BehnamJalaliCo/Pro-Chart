#!/usr/bin/env python3
"""
اکسپورترِ دادهٔ زندهٔ فارکس از حسابِ مَسترِ MT5 (OneRoyal) → بازارنما (pro-chart).

این اسکریپت روی همان سرورِ ویندوزی اجرا می‌شود که ترمینالِ MT5ِ مَستر روی آن باز است
(همان سرورِ کپی). همهٔ نمادهای قابلِ‌معاملهٔ OneRoyal + کندل‌ها + قیمتِ لحظه‌ای را
با توکنِ امن به اندپوینتِ مستقلِ pro-chart می‌فرستد. هیچ سفارشی نمی‌زند — فقط داده.

اجرا:
    set BN_FEED_URL=https://pro-chart.com/api/academy/bn/feed/forex
    set BN_FEED_TOKEN=<همان مقدارِ BN_FEED_TOKEN در .env سرورِ pro-chart>
    python master_forex_exporter.py

اگر MT5 از قبل لاگین نیست، این env ها را هم بده (حسابِ واقعیِ مَستر — نه دمو):
    set MT5_LOGIN=...   set MT5_PASSWORD=...   set MT5_SERVER=...
"""
import os
import time

import requests

try:
    import MetaTrader5 as mt5
except Exception as e:  # noqa: BLE001
    raise SystemExit("MetaTrader5 پکیج لازم است: pip install MetaTrader5  (فقط ویندوز)") from e

FEED_URL = os.getenv("BN_FEED_URL", "https://pro-chart.com/api/academy/bn/feed/forex")
FEED_TOKEN = os.getenv("BN_FEED_TOKEN", "")
TFS = {"M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
       "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4, "D1": mt5.TIMEFRAME_D1}
BARS = int(os.getenv("BN_FEED_BARS", "300"))           # کندل در هر تایم‌فریم
CANDLE_EVERY = int(os.getenv("BN_FEED_CANDLE_SEC", "60"))   # فاصلهٔ ارسالِ کندل
QUOTE_EVERY = float(os.getenv("BN_FEED_QUOTE_SEC", "2"))    # فاصلهٔ ارسالِ قیمت


def _norm(name: str) -> str:
    """نامِ نمادِ بروکر → نامِ کانونی (حذفِ پسوندِ بروکر مثل .r/.m، حداکثر ۱۰ کاراکتر)."""
    base = (name or "").split(".")[0].upper()
    return base[:10]


def _init() -> None:
    login = os.getenv("MT5_LOGIN")
    if login:
        ok = mt5.initialize(login=int(login), password=os.getenv("MT5_PASSWORD", ""),
                            server=os.getenv("MT5_SERVER", ""))
    else:
        ok = mt5.initialize()
    if not ok:
        raise SystemExit(f"mt5.initialize failed: {mt5.last_error()}")
    info = mt5.account_info()
    if info is None:
        raise SystemExit("no MT5 account — ترمینال باید به حسابِ مَسترِ واقعی لاگین باشد")
    print(f"MT5 connected: login={info.login} server={info.server} trade_mode={info.trade_mode}")


def _post(payload: dict) -> None:
    try:
        r = requests.post(FEED_URL, json=payload, headers={"X-Feed-Token": FEED_TOKEN}, timeout=15)
        if r.status_code != 200:
            print("feed error", r.status_code, r.text[:200])
    except Exception as e:  # noqa: BLE001
        print("feed exception", e)


def _forex_symbols() -> list:
    """نمادهای قابلِ‌معامله (فارکس/فلز/شاخص/انرژی) — کریپتو را رد می‌کنیم (آن از LBank می‌آید)."""
    out = []
    for s in (mt5.symbols_get() or []):
        name = s.name
        canon = _norm(name)
        # کریپتو-CFD ها را رد کن تا با فیدِ LBank تداخل نکنند
        if any(k in canon for k in ("BTC", "ETH", "USDT", "DOGE", "XRP", "SOL", "LTC", "BNB")):
            continue
        out.append((name, canon))
    return out


def main() -> None:
    if not FEED_TOKEN:
        raise SystemExit("BN_FEED_TOKEN لازم است (همان مقدارِ سرورِ pro-chart)")
    _init()
    syms = _forex_symbols()
    print(f"exporting {len(syms)} symbols → {FEED_URL}")
    # یک‌بار لیستِ کاملِ نمادها را بفرست تا در dropdown ظاهر شوند
    _post({"symbols": [c for _, c in syms]})

    last_candle = 0.0
    while True:
        now = time.time()
        # قیمتِ لحظه‌ای (هر چند ثانیه)
        quotes = []
        for broker_name, canon in syms:
            t = mt5.symbol_info_tick(broker_name)
            if t and (t.bid or t.ask):
                quotes.append({"symbol": canon, "bid": float(t.bid), "ask": float(t.ask)})
        if quotes:
            # در دسته‌های ۲۰۰تایی
            for i in range(0, len(quotes), 200):
                _post({"quotes": quotes[i:i + 200]})

        # کندل‌ها (کم‌تواتر)
        if now - last_candle >= CANDLE_EVERY:
            last_candle = now
            batch = []
            for broker_name, canon in syms:
                for tf_name, tf in TFS.items():
                    rates = mt5.copy_rates_from_pos(broker_name, tf, 0, BARS)
                    if rates is None or len(rates) == 0:
                        continue
                    rows = [[int(r["time"]), float(r["open"]), float(r["high"]),
                             float(r["low"]), float(r["close"]), float(r["tick_volume"])]
                            for r in rates]
                    batch.append({"symbol": canon, "timeframe": tf_name, "rows": rows})
                    if len(batch) >= 40:
                        _post({"candles": batch}); batch = []
            if batch:
                _post({"candles": batch})
            print(f"[{time.strftime('%H:%M:%S')}] candles pushed for {len(syms)} symbols")

        time.sleep(QUOTE_EVERY)


if __name__ == "__main__":
    main()
