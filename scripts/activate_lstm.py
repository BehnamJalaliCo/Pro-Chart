"""فعال‌سازیِ کاملِ مدل‌های LSTM برای همهٔ نمادها.

ریشهٔ «LSTM فعال نیست»: اسکریپت‌های آموزش منابعِ فید را connect نمی‌کردند و به
دیتابیسِ پراکنده (~۴۰۳ ردیف < حداقلِ ۵۰۰) fallback می‌کردند → train_lstm همیشه
«insufficient data» می‌داد و هیچ lstm_*.pt ساخته نمی‌شد.

این اسکریپت منابع را connect می‌کند، ~۵۰۰۰ کندلِ H1 از yfinance می‌گیرد و برای هر
نماد فقط final-fitِ LSTM (با early-stopping) را اجرا و ذخیره می‌کند. مدل خودکفاست
(scaler + feature_columns داخلِ .pt/.npz)، پس ensemble مستقیماً بارگذاری‌اش می‌کند.

اجرا (همه):   docker compose exec -T signal-engine python -m scripts.activate_lstm
اجرا (تست):   docker compose exec -T signal-engine python -m scripts.activate_lstm EURUSD
"""

from __future__ import annotations

import asyncio
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.config import settings
from src.core.database import init_db
from src.core.logger import get_logger, setup_logging
from src.data.feed_manager import feed_manager
from src.ml.feature_engine import FeatureEngine
from src.ml.lstm_model import LSTMModel

logger = get_logger("scripts.activate_lstm")

EPOCHS = 80         # early-stopping (patience=20) معمولاً زودتر قطع می‌کند
BATCH_SIZE = 128    # batchِ بزرگ‌تر → گام‌های کمتر در هر epoch → سریع‌تر روی CPU
ROWS = 2500         # ~۵ ماه H1؛ برای LSTM کافی و چند برابر سریع‌تر از ۵۰۰۰
MIN_ROWS = 500


async def train_symbol(symbol: str, fe: FeatureEngine) -> dict:
    t0 = time.monotonic()
    df = await feed_manager.get_candles(symbol, "H1", count=ROWS)
    if df is None or len(df) < MIN_ROWS:
        return {"symbol": symbol, "ok": False, "reason": f"insufficient data ({0 if df is None else len(df)})"}

    feats = fe.build_features(df)
    if feats.empty or len(feats) < MIN_ROWS:
        return {"symbol": symbol, "ok": False, "reason": f"insufficient features ({len(feats)})"}
    feats = fe.build_target(feats, forward_periods=4, threshold_pct=0.1)
    cols = fe.get_feature_columns(feats)

    model = LSTMModel(symbol)
    metrics = model.train(feats, cols, epochs=EPOCHS, batch_size=BATCH_SIZE)
    if "error" in metrics:
        return {"symbol": symbol, "ok": False, "reason": metrics["error"]}
    model.save()
    return {
        "symbol": symbol, "ok": True,
        "rows": len(df), "features": len(cols),
        "rmse": round(metrics.get("rmse", 0), 5),
        "mape": round(metrics.get("mape", 0), 2),
        "secs": round(time.monotonic() - t0, 1),
    }


async def main() -> None:
    setup_logging()
    await init_db()
    await feed_manager.connect_sources()

    # محدودِ CPU را با همهٔ هسته‌ها سریع‌تر کن
    try:
        import torch
        torch.set_num_threads(max(1, (os.cpu_count() or 2)))
    except Exception:  # noqa: BLE001
        pass

    symbols = sys.argv[1:] if len(sys.argv) > 1 else list(settings.SYMBOLS)
    fe = FeatureEngine()
    ok, fail = 0, 0
    for i, sym in enumerate(symbols, 1):
        try:
            res = await train_symbol(sym, fe)
        except Exception as exc:  # noqa: BLE001
            res = {"symbol": sym, "ok": False, "reason": repr(exc)}
        if res["ok"]:
            ok += 1
            logger.info("lstm_activated", **res)
            print(f"[{i}/{len(symbols)}] OK  {sym:7} rmse={res['rmse']} mape={res['mape']}% "
                  f"rows={res['rows']} feat={res['features']} {res['secs']}s", flush=True)
        else:
            fail += 1
            logger.warning("lstm_activation_failed", symbol=sym, reason=res["reason"])
            print(f"[{i}/{len(symbols)}] FAIL {sym:7} — {res['reason']}", flush=True)

    print(f"\nLSTM activation done — {ok} ok / {fail} failed (of {len(symbols)})", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
