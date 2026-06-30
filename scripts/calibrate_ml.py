"""
کالیبراسیونِ احتمالِ ML (Phase 3) — رفعِ «بیش‌اطمینان» بدونِ retrainِ سنگین.

کشف شد: XGBoost احتمال‌ها را اشباع می‌دهد (۰/۱۰۰)، یعنی «اطمینانِ ۹۵٪» واقعاً ۹۵٪
نیست. این اسکریپت برای هر نماد یک Platt calibrator می‌سازد که احتمالِ خامِ مدل را به
«احتمالِ واقعیِ درست‌بودن» (بر اساسِ بازده‌ی آینده) نگاشت می‌کند، و در
ml_models/calib_{SYMBOL}.joblib ذخیره می‌کند. XGBoostModel.predict آن را لود و اعمال
می‌کند تا خروجی‌ها دیگر اشباع نباشند.

سبک است (فقط inference + fitِ یک سیگموید؛ بدونِ آموزشِ مدل) → روی سرورِ ۱۶GB امن.
اجرا:  docker compose exec signal-engine python -m scripts.calibrate_ml
"""

from __future__ import annotations

import asyncio

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import text

from src.core.config import settings
from src.core.database import async_session_factory
from src.ml.calibration import PlattCalibrator, calibration_report
from src.ml.feature_engine import FeatureEngine
from src.ml.xgboost_model import MODEL_DIR, XGBoostModel

LOOKFWD = 4          # افقِ برچسب (هماهنگ با trainer)
THRESH = 0.0005      # حداقل حرکتِ جهت‌دار برای برچسبِ مثبت


async def _candles(symbol: str, tf: str = "H1", n: int = 4000) -> pd.DataFrame | None:
    async with async_session_factory() as s:
        q = await s.execute(text(
            "SELECT time, open, high, low, close, volume FROM candles "
            "WHERE symbol=:s AND timeframe=:tf ORDER BY time DESC LIMIT :n"
        ), {"s": symbol, "tf": tf, "n": n})
        rows = [dict(r) for r in q.mappings()][::-1]
    if len(rows) < 300:
        return None
    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["time"])
    for c in ("open", "high", "low", "close", "volume"):
        df[c] = df[c].astype(float)
    return df


async def calibrate(symbol: str) -> dict | None:
    df = await _candles(symbol)
    if df is None:
        return None
    fe = FeatureEngine()
    feats = fe.build_features(df)
    if feats.empty:
        return None
    xgb = XGBoostModel(symbol)
    if not xgb.load():
        return None
    cols = xgb.feature_columns
    miss = [c for c in cols if c not in feats.columns]
    if miss:
        return None
    X = feats[cols].values
    proba = xgb.model.predict_proba(X)   # (n,3): [short, neutral, long]
    p_long = proba[:, 2]
    p_short = proba[:, 0]
    # برچسبِ بازده‌ی آینده روی همان ردیف‌ها (هم‌ترازِ feats با df از انتها)
    close = feats["close"].values if "close" in feats.columns else df["close"].values[-len(feats):]
    n = len(close)
    fr = np.full(n, np.nan)
    for i in range(n - LOOKFWD):
        fr[i] = close[i + LOOKFWD] / close[i] - 1.0
    valid = ~np.isnan(fr)
    y_long = (fr[valid] > THRESH).astype(float)
    y_short = (fr[valid] < -THRESH).astype(float)
    pl, ps = p_long[valid], p_short[valid]
    if valid.sum() < 200:
        return None
    cal_long = PlattCalibrator().fit(pl, y_long)
    cal_short = PlattCalibrator().fit(ps, y_short)
    rep_before = calibration_report(pl, y_long)
    rep_after = calibration_report(cal_long.transform(pl), y_long)
    path = MODEL_DIR / f"calib_{symbol}.joblib"
    # گارد: کالیبراتور فقط وقتی ذخیره/اعمال شود که reliability را «بهتر» کند (ECE کمتر).
    # وگرنه مدلِ خام نگه داشته می‌شود (و فایلِ قبلی پاک می‌شود) — جلوگیری از بدترشدن.
    kept = rep_after.ece <= rep_before.ece
    if kept:
        joblib.dump({"platt_long": cal_long, "platt_short": cal_short,
                     "lookfwd": LOOKFWD, "n": int(valid.sum())}, path)
    else:
        try:
            if path.exists():
                path.unlink()
        except Exception:  # noqa: BLE001
            pass
    return {
        "symbol": symbol, "n": int(valid.sum()), "kept": kept,
        "ece_before": round(rep_before.ece, 3), "ece_after": round(rep_after.ece, 3),
        "raw_long_max": round(float(pl.max()), 2), "cal_long_max": round(float(cal_long.transform(pl).max()), 2),
    }


async def main() -> None:
    results = []
    for sym in settings.SYMBOLS:
        try:
            r = await calibrate(sym)
            if r:
                results.append(r)
                tag = "KEPT" if r["kept"] else "skip(raw)"
                print(f"[calib] {r['symbol']:8} n={r['n']:5} ECE {r['ece_before']}→{r['ece_after']} "
                      f"P(long)max {r['raw_long_max']}→{r['cal_long_max']} [{tag}]", flush=True)
            else:
                print(f"[calib] {sym:8} skipped (no model/data)", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"[calib] {sym:8} ERROR {exc}", flush=True)
    kept = sum(1 for r in results if r.get("kept"))
    print(f"[calib] done — {kept}/{len(results)} kept (ECE improved); rest use raw model", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
