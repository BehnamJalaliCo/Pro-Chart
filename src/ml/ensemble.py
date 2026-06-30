"""سیستم Ensemble — ترکیب وزنی داینامیک مدل‌ها"""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import pandas as pd

from src.core.celery_app import celery_app
from src.core.config import settings
from src.core.logger import get_logger, setup_logging
from src.core.metrics import ml_inference_duration, ml_model_accuracy
from src.core.redis_client import redis_client
from src.ml.feature_engine import FeatureEngine
from src.ml.lgbm_model import LGBMModel
from src.ml.lstm_model import LSTMModel
from src.ml.xgboost_model import XGBoostModel

logger = get_logger(__name__)

# وزن‌های پیش‌فرض
DEFAULT_WEIGHTS: dict[str, float] = {
    "xgboost": 0.40,
    "lgbm": 0.35,
    "lstm": 0.25,
}


class EnsemblePredictor:
    """ترکیب وزنی داینامیک مدل‌های ML"""

    def __init__(self, symbol: str = "default") -> None:
        self.symbol = symbol
        self.xgboost = XGBoostModel(symbol)
        self.lgbm = LGBMModel(symbol)
        self.lstm = LSTMModel(symbol)
        self.feature_engine = FeatureEngine()
        self.weights = DEFAULT_WEIGHTS.copy()
        self._loaded = False

    def load_models(self) -> dict[str, bool]:
        """بارگذاری تمام مدل‌ها"""
        results = {
            "xgboost": self.xgboost.load(),
            "lgbm": self.lgbm.load(),
            "lstm": self.lstm.load(),
        }
        self._loaded = any(results.values())
        logger.info("ensemble_models_loaded", symbol=self.symbol, results=results)
        return results

    def predict(self, df: pd.DataFrame) -> dict[str, Any]:
        """پیش‌بینی ترکیبی"""
        if not self._loaded:
            self.load_models()

        # ساخت فیچرها
        features = self.feature_engine.build_features(df)
        if features.empty:
            return self._empty_result()

        last_row = features.iloc[-1:]
        results: dict[str, dict] = {}

        # XGBoost — جهت
        import time
        try:
            start = time.monotonic()
            xgb_pred = self.xgboost.predict(last_row)
            ml_inference_duration.labels(model="xgboost").observe(time.monotonic() - start)
            results["xgboost"] = xgb_pred
        except Exception as e:
            logger.error("xgboost_predict_error", error=str(e))
            results["xgboost"] = {"direction": "neutral", "confidence": 0}

        # LightGBM — قدرت
        try:
            start = time.monotonic()
            lgbm_pred = self.lgbm.predict(last_row)
            ml_inference_duration.labels(model="lgbm").observe(time.monotonic() - start)
            results["lgbm"] = lgbm_pred
        except Exception as e:
            logger.error("lgbm_predict_error", error=str(e))
            results["lgbm"] = {"strength": "weak", "confidence": 0}

        # LSTM — قیمت
        try:
            start = time.monotonic()
            lstm_pred = self.lstm.predict(features)
            ml_inference_duration.labels(model="lstm").observe(time.monotonic() - start)
            results["lstm"] = lstm_pred
        except Exception as e:
            logger.error("lstm_predict_error", error=str(e))
            results["lstm"] = {"direction": "neutral", "confidence": 0}

        # ترکیب نتایج
        ensemble = self._combine_predictions(results)
        ensemble["model_results"] = results
        ensemble["weights"] = self.weights

        return ensemble

    def _combine_predictions(self, results: dict[str, dict]) -> dict[str, Any]:
        """ترکیب پیش‌بینی‌ها با وزن داینامیک"""
        # ── امتیاز جهت (0-100) — فقط از مدل‌های جهت‌دار (XGBoost/LSTM)،
        #    نرمال‌شده بر وزنِ مدل‌های «موجود» تا امتیاز مستقل از وزن‌ها باشد.
        #    LightGBM فقط «قدرت» می‌دهد (بدون جهت) → نباید جهت بسازد، فقط confidence. ──
        deviation = 0.0      # انحراف علامت‌دار از خنثی
        dir_weight = 0.0     # مجموع وزن مدل‌های جهت‌دارِ حاضر
        present = 0
        for name in ("xgboost", "lstm"):
            r = results.get(name)
            if not r:
                continue
            d = r.get("direction", "neutral")
            c = float(r.get("confidence", 0) or 0)
            w = self.weights.get(name, 0)
            if d == "long":
                deviation += 50 * c * w
            elif d == "short":
                deviation -= 50 * c * w
            else:
                # مدلِ خنثی هیچ وزنی به مخرج اضافه نمی‌کند — وگرنه (مثل LSTMِ
                # بارگذاری‌نشده) confidence را ~۳۸٪ رقیق می‌کرد و gateهای ML
                # (fallback 0.3/0.5) عملاً غیرقابل‌دسترس می‌شدند.
                continue
            present += 1  # فقط مدل‌های جهت‌دار شمرده شوند
            dir_weight += w

        direction_score = 50.0 + (deviation / dir_weight if dir_weight > 0 else 0.0)
        direction_score = max(0.0, min(100.0, direction_score))
        # ── رفعِ بیش‌اطمینان: جمع‌کردنِ امتیاز به‌سمتِ ۵۰ (مدل‌های اورفیت به ۰/۱۰۰ اشباع
        #    می‌شدند؛ این، اطمینان را واقع‌بینانه می‌کند بدونِ تغییرِ جهت) ──
        from src.core.config import settings as _st
        _shrink = float(getattr(_st, "ML_SCORE_SHRINK", 1.0) or 1.0)
        if _shrink < 1.0:
            direction_score = 50.0 + (direction_score - 50.0) * _shrink

        lgbm = results.get("lgbm", {})
        strength = lgbm.get("strength", "medium")
        # اگر هیچ مدل جهت‌داری لود نشده، نتیجه degraded و خنثی است
        degraded = present == 0

        # اگر degraded (هیچ مدل جهت‌دار)، خنثی و امتیاز ۵۰
        if degraded:
            direction_score = 50.0

        # تعیین جهت نهایی — آستانه 60/40 (نه 65/35): یک lean ۴۰٪ روی مدل ۳-کلاسه
        # (پایه‌ی یکنواخت ۳۳٪) یک تمایل واقعی است، نه نویز.
        if direction_score >= 60:
            final_direction = "long"
        elif direction_score <= 40:
            final_direction = "short"
        else:
            final_direction = "neutral"

        # اعتماد نهایی — strength فقط اینجا (روی اطمینان/سایز) اثر می‌گذارد، نه جهت
        strength_conf = {"strong": 1.0, "medium": 0.85, "weak": 0.7}.get(strength, 0.85)
        confidence = (abs(direction_score - 50) / 50) * strength_conf

        return {
            "ml_score": round(direction_score, 2),
            "direction": final_direction,
            "strength": strength,
            "confidence": round(confidence, 4),
            "degraded": degraded,
            "predicted_prices": results.get("lstm", {}).get("predicted_prices", []),
        }

    def update_weights(self, performance: dict[str, float]) -> None:
        """بروزرسانی وزن‌ها بر اساس عملکرد"""
        total_perf = sum(performance.values())
        if total_perf <= 0:
            return

        for model_name in self.weights:
            perf = performance.get(model_name, 0)
            self.weights[model_name] = perf / total_perf

        # حداقل وزن ۰.۱
        for model_name in self.weights:
            self.weights[model_name] = max(0.1, self.weights[model_name])

        # نرمال‌سازی
        total = sum(self.weights.values())
        for model_name in self.weights:
            self.weights[model_name] = round(self.weights[model_name] / total, 3)

        logger.info("ensemble_weights_updated", weights=self.weights)

    def _empty_result(self) -> dict[str, Any]:
        """نتیجه خالی"""
        return {
            "ml_score": 50.0,
            "direction": "neutral",
            "strength": "medium",
            "confidence": 0.0,
            "degraded": True,
            "predicted_prices": [],
            "model_results": {},
            "weights": self.weights,
        }


# سرویس ML
class MLService:
    """سرویس ML برای اجرای مستقل"""

    def __init__(self) -> None:
        self.predictors: dict[str, EnsemblePredictor] = {}
        self._running = False

    def get_predictor(self, symbol: str) -> EnsemblePredictor:
        """دریافت predictor برای نماد"""
        if symbol not in self.predictors:
            self.predictors[symbol] = EnsemblePredictor(symbol)
            self.predictors[symbol].load_models()
        return self.predictors[symbol]

    async def start(self) -> None:
        """شروع سرویس"""
        await redis_client.connect()
        self._running = True

        # بارگذاری مدل‌های تمام نمادها
        for symbol in settings.SYMBOLS:
            self.get_predictor(symbol)

        logger.info("ml_service_started", symbols=len(self.predictors))

        # لوپ اصلی — گوش دادن به درخواست‌ها از Redis
        while self._running:
            try:
                # بررسی درخواست‌های پیش‌بینی از Redis
                request = await redis_client.get_json("ml:predict_request")
                if request:
                    symbol = request.get("symbol")
                    if symbol:
                        predictor = self.get_predictor(symbol)
                        # دریافت کندل‌ها
                        candles_data = await redis_client.get_json(f"candles:{symbol}:H1")
                        if candles_data:
                            df = pd.DataFrame(candles_data)
                            result = predictor.predict(df)
                            await redis_client.set_json(f"ml:result:{symbol}", result, expire=300)
                    await redis_client.delete("ml:predict_request")
            except Exception as e:
                logger.error("ml_service_error", error=str(e))

            await asyncio.sleep(1)

    async def stop(self) -> None:
        """توقف سرویس"""
        self._running = False
        await redis_client.close()


ml_service = MLService()


async def main() -> None:
    """نقطه شروع سرویس ML"""
    setup_logging()
    logger.info("ml_inference_service_starting")
    try:
        await ml_service.start()
    except KeyboardInterrupt:
        logger.info("ml_inference_service_interrupted")
    finally:
        await ml_service.stop()


# وظیفه Celery
@celery_app.task(name="src.ml.ensemble.recalibrate_weights")
def recalibrate_weights() -> dict:
    """بازتنظیم وزن‌های ensemble"""
    logger.info("recalibrating_ensemble_weights")
    return {"status": "ok"}


if __name__ == "__main__":
    asyncio.run(main())
