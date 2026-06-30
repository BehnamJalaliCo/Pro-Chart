"""آموزش مدل‌ها — Walk-forward Training با TimeSeriesSplit"""

from __future__ import annotations

import asyncio
import statistics
from datetime import datetime, timezone
from typing import Any, Sequence

import pandas as pd
from sqlalchemy import text

from src.core.celery_app import celery_app
from src.core.config import settings
from src.core.database import async_session_factory
from src.core.logger import get_logger
from src.data.candle_builder import CandleBuilder
from src.data.feed_manager import feed_manager
from src.ml.feature_engine import FeatureEngine
from src.ml.purged_kfold import PurgedKFold
from src.ml.lgbm_model import LGBMModel
from src.ml.lstm_model import LSTMModel
from src.ml.scaler import fit_scaler, scaler_path
from src.ml.xgboost_model import XGBoostModel

logger = get_logger(__name__)

# تعداد فولدهای TimeSeriesSplit پیش‌فرض
# ۳ فولد (به‌جای ۵) — OOS معتبر می‌ماند ولی آموزش ~۴۰٪ سریع‌تر است
DEFAULT_N_SPLITS: int = 3


def _summarize_fold_metrics(fold_metrics: Sequence[dict]) -> dict[str, Any]:
    """
    تجمیع متریک‌های فولدها — میانگین، انحراف معیار، min، max.

    این پاسخ به سؤال "آیا مدل پایدار است؟" کمک می‌کند.
    اگر std بزرگ باشد، مدل ناپایدار است (overfit در برخی فولدها).
    """
    if not fold_metrics:
        return {}

    keys = {"accuracy", "precision", "recall", "f1"}
    summary: dict[str, Any] = {}
    for k in keys:
        values = [m.get(k) for m in fold_metrics if isinstance(m.get(k), (int, float))]
        if not values:
            continue
        summary[f"{k}_mean"] = round(sum(values) / len(values), 4)
        summary[f"{k}_std"] = round(
            statistics.pstdev(values) if len(values) > 1 else 0.0, 4
        )
        summary[f"{k}_min"] = round(min(values), 4)
        summary[f"{k}_max"] = round(max(values), 4)
    summary["n_folds"] = len(fold_metrics)
    return summary


class ModelTrainer:
    """
    آموزش‌دهنده مدل‌ها با TimeSeriesSplit.

    در هر فراخوانی:
        ۱. فیچرها ساخته می‌شوند
        ۲. هدف (target) به‌صورت forward-looking تعریف می‌شود (در labeling)
        ۳. TimeSeriesSplit با n_splits فولد، روی داده عمل می‌کند
        ۴. در هر فولد، مدل روی train آموزش می‌بیند و روی test ارزیابی می‌شود
        ۵. متریک‌های out-of-sample میانگین و std گزارش می‌شوند
        ۶. مدل نهایی روی تمام داده‌ی train شده re-fit می‌شود (برای deployment)

    این روش از overfit جلوگیری می‌کند چون متریک گزارش‌شده تماماً OOS است.
    """

    def __init__(self, n_splits: int = DEFAULT_N_SPLITS) -> None:
        self.feature_engine = FeatureEngine()
        self.n_splits = n_splits

    def _fit_and_save_scaler(
        self,
        symbol: str,
        model_name: str,
        features: pd.DataFrame,
        feature_cols: list[str],
    ) -> None:
        """
        Fit و save scaler به‌همراه مدل نهایی.

        این متد در پایان هر train_* صدا زده می‌شود تا مطمئن شویم
        scaler ذخیره‌شده مطابق با feature distribution training است.
        در predict-time، EnsemblePredictor همین scaler را load می‌کند.
        """
        try:
            fitted = fit_scaler(features, feature_cols, scaler_type="robust")
            path = scaler_path(symbol, model_name)
            fitted.save(path)
            logger.info(
                "scaler_saved",
                symbol=symbol,
                model=model_name,
                n_features=len(feature_cols),
                path=str(path),
            )
        except Exception as exc:
            logger.error(
                "scaler_save_failed",
                symbol=symbol,
                model=model_name,
                error=str(exc),
            )

    async def get_training_data(self, symbol: str, timeframe: str = "H1") -> pd.DataFrame | None:
        """دریافت داده آموزشی — ابتدا از feed_manager (yfinance، حجم کافی)،
        و در صورت نبود، fallback به دیتابیس. (DB در این استقرار پراکنده است.)"""
        try:
            df = await feed_manager.get_candles(symbol, timeframe, count=5000)
            if df is not None and len(df) >= 500:
                return df
        except Exception as exc:  # noqa: BLE001
            logger.warning("training_feed_fetch_failed", symbol=symbol, error=str(exc))
        async with async_session_factory() as session:
            return await CandleBuilder.get_candles(session, symbol, timeframe, count=5000)

    def train_xgboost(self, symbol: str, df: pd.DataFrame) -> dict[str, Any]:
        """
        آموزش مدل XGBoost با TimeSeriesSplit.

        متریک گزارش‌شده میانگین OOS روی فولدهاست، نه in-sample.
        """
        logger.info("training_xgboost_tscv", symbol=symbol, rows=len(df), n_splits=self.n_splits)

        features = self.feature_engine.build_features(df)
        if features.empty or len(features) < 500:
            logger.warning("insufficient_data_xgboost", symbol=symbol)
            return {"error": "insufficient data"}

        features = self.feature_engine.build_target(features, forward_periods=4, threshold_pct=0.1)
        feature_cols = self.feature_engine.get_feature_columns(features)

        # ── Purged K-Fold (جلوگیری از نشت افق لیبلِ forward=4) ──
        pkf = PurgedKFold(n_splits=self.n_splits, label_lookforward=4)
        fold_metrics: list[dict] = []

        for fold in pkf.split(len(features)):
            train_df = features.iloc[fold.train_indices]
            test_df = features.iloc[fold.test_indices]

            if len(train_df) < 100 or len(test_df) < 50:
                logger.info(
                    "fold_skipped_small",
                    symbol=symbol,
                    fold=fold.fold_index,
                    train=len(train_df),
                    test=len(test_df),
                )
                continue

            fold_model = XGBoostModel(symbol)
            try:
                fold_model.train(train_df, train_df["target_class"], feature_cols)
                fold_eval = self._evaluate(
                    fold_model, test_df, test_df["target_class"], feature_cols
                )
                fold_eval["fold"] = fold.fold_index
                fold_metrics.append(fold_eval)
            except Exception as e:
                logger.error("fold_training_error", symbol=symbol, fold=fold.fold_index, error=str(e))

        # ── مدل نهایی روی تمام داده ──
        final_model = XGBoostModel(symbol)
        try:
            final_model.train(features, features["target_class"], feature_cols)
            final_model.save()
            self._fit_and_save_scaler(symbol, "xgboost", features, feature_cols)
        except Exception as e:
            logger.error("final_fit_error", symbol=symbol, error=str(e))
            return {"error": "final_fit_failed", "detail": str(e)}

        oos_summary = _summarize_fold_metrics(fold_metrics)
        oos_summary["training_samples"] = len(features)
        oos_summary["feature_count"] = len(feature_cols)
        oos_summary["model"] = "xgboost"
        oos_summary["folds"] = fold_metrics
        return oos_summary

    def train_lgbm(self, symbol: str, df: pd.DataFrame) -> dict[str, Any]:
        """آموزش مدل LightGBM با TimeSeriesSplit."""
        logger.info("training_lgbm_tscv", symbol=symbol, rows=len(df), n_splits=self.n_splits)

        features = self.feature_engine.build_features(df)
        if features.empty or len(features) < 500:
            logger.warning("insufficient_data_lgbm", symbol=symbol)
            return {"error": "insufficient data"}

        strength_target = LGBMModel.build_strength_target(features)
        feature_cols = self.feature_engine.get_feature_columns(features)

        # هم‌طول کردن
        valid_idx = strength_target.dropna().index.intersection(features.index)
        features = features.loc[valid_idx].reset_index(drop=True)
        strength_target = strength_target.loc[valid_idx].reset_index(drop=True)

        pkf = PurgedKFold(n_splits=self.n_splits, label_lookforward=4)
        fold_metrics: list[dict] = []
        for fold in pkf.split(len(features)):
            train_X = features.iloc[fold.train_indices]
            train_y = strength_target.iloc[fold.train_indices]
            test_X = features.iloc[fold.test_indices]
            test_y = strength_target.iloc[fold.test_indices]

            if len(train_X) < 100 or len(test_X) < 50:
                continue

            fold_model = LGBMModel(symbol)
            try:
                fold_model.train(train_X, train_y, feature_cols)
                fold_eval = self._evaluate(fold_model, test_X, test_y, feature_cols)
                fold_eval["fold"] = fold.fold_index
                fold_metrics.append(fold_eval)
            except Exception as e:
                logger.error("fold_training_error", symbol=symbol, fold=fold.fold_index, error=str(e))

        final_model = LGBMModel(symbol)
        try:
            final_model.train(features, strength_target, feature_cols)
            final_model.save()
            self._fit_and_save_scaler(symbol, "lgbm", features, feature_cols)
        except Exception as e:
            logger.error("final_fit_error", symbol=symbol, error=str(e))
            return {"error": "final_fit_failed", "detail": str(e)}

        oos = _summarize_fold_metrics(fold_metrics)
        oos["training_samples"] = len(features)
        oos["feature_count"] = len(feature_cols)
        oos["model"] = "lgbm"
        oos["folds"] = fold_metrics
        return oos

    def train_lstm(self, symbol: str, df: pd.DataFrame) -> dict[str, Any]:
        """
        آموزش مدل LSTM با TimeSeriesSplit.

        توجه: LSTM به‌خاطر هزینه‌ی محاسباتی بالا، با تعداد epochs کمتر
        در هر فولد آموزش می‌بیند. مدل نهایی با epochs کامل re-fit می‌شود.
        """
        logger.info("training_lstm_tscv", symbol=symbol, rows=len(df), n_splits=self.n_splits)

        features = self.feature_engine.build_features(df)
        if features.empty or len(features) < 500:
            logger.warning("insufficient_data_lstm", symbol=symbol)
            return {"error": "insufficient data"}

        # برای LSTM، target_class را اضافه می‌کنیم تا train روی همان طبقه‌بندی باشد
        features = self.feature_engine.build_target(features, forward_periods=4, threshold_pct=0.1)
        feature_cols = self.feature_engine.get_feature_columns(features)

        # ── Purged K-Fold (جلوگیری از نشت افق لیبلِ forward=4) ──
        pkf = PurgedKFold(n_splits=self.n_splits, label_lookforward=4)
        fold_metrics: list[dict] = []
        for fold in pkf.split(len(features)):
            train_df = features.iloc[fold.train_indices]
            test_df = features.iloc[fold.test_indices]
            if len(train_df) < 200 or len(test_df) < 50:
                continue

            fold_model = LSTMModel(symbol)
            try:
                # epochs/batch سبک‌تر برای کنترلِ زمانِ CPU (early-stopping داخلِ
                # خودِ مدل، بیش‌برازش را هم مهار می‌کند).
                fold_model.train(train_df, feature_cols, epochs=12, batch_size=64)
                fold_eval = self._evaluate_lstm(fold_model, test_df, feature_cols)
                fold_eval["fold"] = fold.fold_index
                fold_metrics.append(fold_eval)
            except Exception as e:
                logger.error("fold_training_error", symbol=symbol, fold=fold.fold_index, error=str(e))

        final_model = LSTMModel(symbol)
        try:
            final_model.train(features, feature_cols, epochs=80, batch_size=64)
            final_model.save()
            # LSTM به‌خصوص نیاز به scaler دارد چون input distribution حساس است
            self._fit_and_save_scaler(symbol, "lstm", features, feature_cols)
        except Exception as e:
            logger.error("final_fit_error", symbol=symbol, error=str(e))
            return {"error": "final_fit_failed", "detail": str(e)}

        oos = _summarize_fold_metrics(fold_metrics)
        oos["training_samples"] = len(features)
        oos["feature_count"] = len(feature_cols)
        oos["model"] = "lstm"
        oos["folds"] = fold_metrics
        return oos

    # ── ابزارهای ارزیابی ────────────────────────────────

    @staticmethod
    def _evaluate(
        model: Any,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        feature_cols: list[str],
    ) -> dict[str, float]:
        """
        ارزیابی مدل روی داده‌ی out-of-sample.

        اگر مدل متد .evaluate داشته باشد، آن را صدا می‌زند؛ در غیر این
        صورت از predict و sklearn metrics استفاده می‌کند.
        """
        from sklearn.metrics import (
            accuracy_score,
            f1_score,
            precision_score,
            recall_score,
        )

        # ترجیحاً متد ارزیابی خود مدل
        if hasattr(model, "evaluate"):
            try:
                return model.evaluate(X_test, y_test, feature_cols)
            except Exception:
                pass

        # fallback: predict + sklearn metrics — از estimator خامِ sklearn برای پیش‌بینی
        # batch استفاده می‌شود (model.predict یک dict تک‌ردیفی برای حالت زنده برمی‌گرداند).
        try:
            import numpy as _np
            X = X_test[feature_cols] if feature_cols else X_test
            raw = getattr(model, "model", None)
            estimator = raw if (raw is not None and hasattr(raw, "predict")) else model
            preds = _np.asarray(estimator.predict(X))
            if preds.ndim > 1:
                preds = preds.argmax(axis=1)
            return {
                "accuracy": float(accuracy_score(y_test, preds)),
                "precision": float(precision_score(y_test, preds, average="weighted", zero_division=0)),
                "recall": float(recall_score(y_test, preds, average="weighted", zero_division=0)),
                "f1": float(f1_score(y_test, preds, average="weighted", zero_division=0)),
            }
        except Exception as e:
            logger.warning("evaluate_failed", error=str(e))
            return {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}

    @staticmethod
    def _evaluate_lstm(model: Any, test_df: pd.DataFrame, feature_cols: list[str]) -> dict[str, float]:
        """ارزیابی LSTM — احتمالاً نیاز به sequence preparation."""
        if hasattr(model, "evaluate"):
            try:
                return model.evaluate(test_df, feature_cols)
            except Exception as e:
                logger.warning("lstm_evaluate_failed", error=str(e))
        return {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0}

    async def train_all(self, symbol: str) -> dict[str, Any]:
        """آموزش تمام مدل‌ها برای یک نماد"""
        df = await self.get_training_data(symbol)
        if df is None or len(df) < 500:
            return {"error": "insufficient data", "symbol": symbol}

        results = {}
        results["xgboost"] = self.train_xgboost(symbol, df)
        results["lgbm"] = self.train_lgbm(symbol, df)
        results["lstm"] = self.train_lstm(symbol, df)

        # ذخیره نتایج در دیتابیس
        await self._save_training_results(symbol, results)

        # لاگِ run و آرتیفکتِ مدل در MLflow (fail-soft؛ اگر غیرفعال بود no-op)
        try:
            from src.ml.mlflow_tracking import log_training_run
            log_training_run(symbol, results)
        except Exception:  # noqa: BLE001
            pass

        return results

    async def _save_training_results(self, symbol: str, results: dict) -> None:
        """
        ذخیره نتایج آموزش — متریک‌های OOS را ثبت می‌کند.

        نکته: مقادیر *_mean از TimeSeriesSplit هستند و قابل اعتماد‌اند
        (out-of-sample). مقادیر in-sample که قبلاً ذخیره می‌شد، فریبنده بود.
        """
        async with async_session_factory() as session:
            for model_name, metrics in results.items():
                if "error" in metrics:
                    continue
                try:
                    await session.execute(
                        text("""
                            INSERT INTO ml_model_performance
                            (model_name, version, accuracy, precision_score, recall_score, f1_score,
                             training_samples, trained_at)
                            VALUES (:model_name, :version, :accuracy, :precision, :recall, :f1,
                                    :samples, :trained_at)
                        """),
                        {
                            "model_name": f"{model_name}_{symbol}",
                            "version": "tscv-1.0",
                            # ترجیحاً mean از فولدها (OOS) — fallback به accuracy ساده
                            "accuracy": metrics.get(
                                "accuracy_mean",
                                metrics.get("accuracy", metrics.get("mape", 0)),
                            ),
                            "precision": metrics.get(
                                "precision_mean", metrics.get("precision", 0)
                            ),
                            "recall": metrics.get(
                                "recall_mean", metrics.get("recall", 0)
                            ),
                            "f1": metrics.get("f1_mean", metrics.get("f1", 0)),
                            "samples": metrics.get("training_samples", 0),
                            "trained_at": datetime.now(timezone.utc),
                        },
                    )
                    await session.commit()
                except Exception as e:
                    logger.error("save_training_results_error", model=model_name, error=str(e))


# وظیفه Celery
@celery_app.task(
    name="src.ml.trainer.retrain_all_models",
    # آموزشِ ۲۰ نماد × ۳ مدل (با LSTM) خیلی بیشتر از محدودیتِ سراسریِ ۶۰۰s است؛
    # این تسک روی صفِ اختصاصیِ ml_training و workerِ پرقدرت اجرا می‌شود، پس
    # محدودیتِ زمانیِ بلند می‌گذاریم تا وسطِ کار kill نشود.
    time_limit=10800,        # ۳ ساعت سقفِ سخت
    soft_time_limit=10500,
)
def retrain_all_models() -> dict:
    """بازآموزی تمام مدل‌ها — فراخوانی شده از Celery (صفِ ml_training)"""
    async def _run() -> dict:
        # منابع داده باید وصل شوند تا get_training_data از yfinance کندل بگیرد
        # (وگرنه به DB پراکنده می‌افتد و «insufficient data» می‌دهد)
        try:
            await feed_manager.connect_sources()
        except Exception as exc:  # noqa: BLE001
            logger.error("retrain_feed_connect_failed", error=str(exc))
        trainer = ModelTrainer()
        all_results: dict[str, Any] = {}
        for symbol in settings.SYMBOLS:
            try:
                result = await trainer.train_all(symbol)
                all_results[symbol] = result
                logger.info("model_retrained", symbol=symbol)
            except Exception as e:
                logger.error("retrain_error", symbol=symbol, error=str(e))
                all_results[symbol] = {"error": str(e)}
        return all_results

    return asyncio.run(_run())
