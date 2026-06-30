"""بک‌تستِ کمی با vectorbt — کندل‌ها را از TimescaleDB می‌خواند و به‌واحدِ R/درصد می‌سنجد.

این اسکلتِ کاری است: کندل‌ها را لود و یک نمونهٔ پایه (ATR-stop + RR) را بک‌تست می‌کند تا
خطِ‌لولهٔ سنجشِ edge کار کند. گامِ بعد: جایگزینیِ منطقِ ورود با همان سیگنال‌های موتور
(src/signals) برای سنجشِ واقعیِ استراتژی پیش از live.

اجرا (ایمیجِ on-demand):
    docker build -f backtest/Dockerfile.backtest -t coinepro-backtest .
    docker run --rm --network coinepro-network --env-file .env coinepro-backtest \
        python -m backtest.run_backtest XTIUSD H1 2000
"""

from __future__ import annotations

import os
import sys

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text


def _db_url() -> str:
    # نسخهٔ sync (psycopg2) — از همان env varهای app (DB_USER/DB_PASSWORD/...)
    from urllib.parse import quote

    user = os.getenv("DB_USER", "coinepro")
    pwd = quote(os.getenv("DB_PASSWORD", ""), safe="")
    host = os.getenv("DB_HOST", "timescaledb")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "forex_signal")
    return f"postgresql+psycopg2://{user}:{pwd}@{host}:{port}/{name}"


def load_candles(symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
    eng = create_engine(_db_url(), future=True)
    q = text(
        "SELECT time, open, high, low, close, volume FROM candles "
        "WHERE symbol=:s AND timeframe=:tf ORDER BY time DESC LIMIT :n"
    )
    with eng.connect() as c:
        df = pd.read_sql(q, c, params={"s": symbol, "tf": timeframe, "n": limit})
    df = df.sort_values("time").set_index("time")
    for col in ("open", "high", "low", "close", "volume"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.dropna()


def run(symbol: str, timeframe: str, limit: int) -> None:
    import vectorbt as vbt

    df = load_candles(symbol, timeframe, limit)
    if len(df) < 100:
        print(f"دادهٔ کافی نیست: {len(df)} کندل برای {symbol} {timeframe}")
        return

    close = df["close"]
    # نمونهٔ پایه: تقاطعِ MA (۲۰/۵۰) — صرفاً برای راه‌اندازیِ خطِ‌لوله
    fast = vbt.MA.run(close, 20).ma
    slow = vbt.MA.run(close, 50).ma
    entries = fast.vbt.crossed_above(slow)
    exits = fast.vbt.crossed_below(slow)

    _FREQ = {"M1": "1min", "M5": "5min", "M15": "15min", "M30": "30min",
             "H1": "1h", "H4": "4h", "D1": "1D", "W1": "1W"}
    pf = vbt.Portfolio.from_signals(
        close, entries, exits, init_cash=10000, fees=0.0002,
        freq=_FREQ.get(timeframe, "1h"),
    )
    s = pf.stats()
    print(f"\n=== Backtest {symbol} {timeframe} (n={len(df)} candles) ===")
    for k in (
        "Total Return [%]", "Win Rate [%]", "Profit Factor",
        "Max Drawdown [%]", "Total Trades", "Sharpe Ratio",
    ):
        try:
            print(f"  {k}: {s[k]}")
        except Exception:
            pass
    print("\n(این نمونهٔ MA-cross است؛ گامِ بعد: تزریقِ سیگنال‌های موتورِ src/signals.)")


if __name__ == "__main__":
    sym = sys.argv[1] if len(sys.argv) > 1 else "XTIUSD"
    tf = sys.argv[2] if len(sys.argv) > 2 else "H1"
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 2000
    run(sym, tf, n)
