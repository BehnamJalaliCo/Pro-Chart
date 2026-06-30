"""مدل XGBoost — پیش‌بینی جهت بازار"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score
from sklearn.model_selection import TimeSeriesSplit
from xgboost import XGBClassifier

from src.core.logger import get_logger

logger = get_logger(__name__)

MODEL_DIR = Path("/app/ml_models")


class XGBoostModel:
    """مدل XGBoost برای پیش‌بینی جهت: Long / Short / Neutral"""

    def __init__(self, symbol: str = "default") -> None:
        self.symbol = symbol
        self.model: Optional[XGBClassifier] = None
        self.feature_columns: list[str] = []
        self.version: str = "1.0"
        self._model_path = MODEL_DIR / f"xgboost_{symbol}.joblib"
        self._meta_path = MODEL_DIR / f"xgboost_{symbol}_meta.joblib"
        self._calib_path = MODEL_DIR / f"calib_{symbol}.joblib"
        self.calibrator: Optional[dict] = None  # {platt_long, platt_short} — رفعِ بیش‌اطمینان

    def train(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        feature_columns: list[str],
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, float]:
        """آموزش مدل"""
        self.feature_columns = feature_columns
        X_train = X[feature_columns].values

        if params is None:
            params = {
                "n_estimators": 500,
                "max_depth": 6,
                "learning_rate": 0.05,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "min_child_weight": 3,
                "gamma": 0.1,
                "reg_alpha": 0.1,
                "reg_lambda": 1.0,
                "objective": "multi:softprob",
                "num_class": 3,
                "eval_metric": "mlogloss",
                "random_state": 42,
                "n_jobs": -1,
                "use_label_encoder": False,
            }

        self.model = XGBClassifier(**params)

        # Walk-forward validation
        tscv = TimeSeriesSplit(n_splits=5)
        scores: list[float] = []

        for train_idx, val_idx in tscv.split(X_train):
            X_tr, X_val = X_train[train_idx], X_train[val_idx]
            y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

            self.model.fit(
                X_tr, y_tr,
                eval_set=[(X_val, y_val)],
                verbose=False,
            )
            y_pred = self.model.predict(X_val)
            scores.append(accuracy_score(y_val, y_pred))

        # آموزش نهایی روی تمام داده
        self.model.fit(X_train, y.values, verbose=False)

        # ارزیابی نهایی — این متریک‌ها in-sample هستند (روی همان داده آموزش)
        y_pred_final = self.model.predict(X_train)
        cv_accuracy_mean = float(np.mean(scores))
        metrics = {
            "train_accuracy": accuracy_score(y.values, y_pred_final),
            "train_precision": precision_score(y.values, y_pred_final, average="weighted", zero_division=0),
            "train_recall": recall_score(y.values, y_pred_final, average="weighted", zero_division=0),
            "train_f1": f1_score(y.values, y_pred_final, average="weighted", zero_division=0),
            "cv_accuracy_mean": cv_accuracy_mean,
            "cv_accuracy_std": float(np.std(scores)),
            "training_samples": len(X_train),
        }

        # هشدار بیش‌برازش: فاصله‌ی in-sample با cv بیش از حد
        if metrics["train_accuracy"] - cv_accuracy_mean > 0.05:
            logger.warning(
                "xgboost_possible_overfit",
                symbol=self.symbol,
                train_accuracy=round(metrics["train_accuracy"], 4),
                cv_accuracy=round(cv_accuracy_mean, 4),
                gap=round(metrics["train_accuracy"] - cv_accuracy_mean, 4),
            )

        logger.info(
            "xgboost_trained",
            symbol=self.symbol,
            train_accuracy=round(metrics["train_accuracy"], 4),
            cv_accuracy=round(metrics["cv_accuracy_mean"], 4),
        )
        return metrics

    def predict(self, X: pd.DataFrame) -> dict[str, Any]:
        """پیش‌بینی"""
        if self.model is None:
            self.load()
        if self.model is None:
            return {"direction": "neutral", "confidence": 0.0, "probabilities": {}}

        # ورودی باید DataFrame باشد؛ Series پشتیبانی نمی‌شود — انتخاب ستون
        # روی Series پیش از بررسی shape خطا می‌دهد، پس شاخه‌ی reshape عملاً مرده است.
        features = X[self.feature_columns].values.reshape(1, -1) if len(X.shape) == 1 else X[self.feature_columns].values
        probas = self.model.predict_proba(features)
        p = probas[0].astype(float)   # [short, neutral, long]

        # ── کالیبراسیون: احتمالِ خامِ اشباع‌شده → احتمالِ واقعیِ درست‌بودن (Platt) ──
        if self.calibrator:
            try:
                pl = float(self.calibrator["platt_long"].transform(np.array([p[2]]))[0])
                ps = float(self.calibrator["platt_short"].transform(np.array([p[0]]))[0])
                pn = max(0.0, 1.0 - pl - ps)   # خنثی = باقی‌مانده
                tot = (pl + ps + pn) or 1.0
                p = np.array([ps / tot, pn / tot, pl / tot])
            except Exception:  # noqa: BLE001 — fail-safe به خامِ مدل
                p = probas[0].astype(float)

        pred_class = int(np.argmax(p))
        direction_map = {0: "short", 1: "neutral", 2: "long"}
        direction = direction_map.get(pred_class, "neutral")
        confidence = float(p[pred_class])

        return {
            "direction": direction,
            "confidence": round(confidence, 4),
            "probabilities": {
                "short": round(float(p[0]), 4),
                "neutral": round(float(p[1]), 4),
                "long": round(float(p[2]), 4),
            },
        }

    def feature_importance(self) -> dict[str, float]:
        """اهمیت فیچرها"""
        if self.model is None:
            return {}
        importance = self.model.feature_importances_
        return {
            col: round(float(imp), 6)
            for col, imp in sorted(
                zip(self.feature_columns, importance),
                key=lambda x: x[1],
                reverse=True,
            )
        }

    def save(self) -> None:
        """ذخیره مدل"""
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        if self.model:
            joblib.dump(self.model, self._model_path)
            joblib.dump(
                {"feature_columns": self.feature_columns, "version": self.version},
                self._meta_path,
            )
            logger.info("xgboost_saved", path=str(self._model_path))

    def load(self) -> bool:
        """بارگذاری مدل"""
        if self._model_path.exists() and self._meta_path.exists():
            self.model = joblib.load(self._model_path)
            meta = joblib.load(self._meta_path)
            self.feature_columns = meta["feature_columns"]
            self.version = meta.get("version", "1.0")
            # کالیبراتورِ احتمال (در صورتِ وجود) — خروجی را از اشباع درمی‌آورد
            try:
                if self._calib_path.exists():
                    self.calibrator = joblib.load(self._calib_path)
                    logger.info("xgboost_calibrator_loaded", symbol=self.symbol)
            except Exception as exc:  # noqa: BLE001
                logger.warning("xgboost_calibrator_load_failed", symbol=self.symbol, error=str(exc))
            logger.info("xgboost_loaded", path=str(self._model_path))
            return True
        logger.warning("xgboost_model_not_found", path=str(self._model_path))
        return False
