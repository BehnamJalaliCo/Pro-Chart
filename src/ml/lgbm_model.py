"""مدل LightGBM — پیش‌بینی قدرت حرکت"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import TimeSeriesSplit

from src.core.logger import get_logger

logger = get_logger(__name__)

MODEL_DIR = Path("/app/ml_models")


class LGBMModel:
    """مدل LightGBM برای پیش‌بینی قدرت حرکت: Strong / Medium / Weak"""

    def __init__(self, symbol: str = "default") -> None:
        self.symbol = symbol
        self.model: Optional[LGBMClassifier] = None
        self.feature_columns: list[str] = []
        self.version: str = "1.0"
        self._model_path = MODEL_DIR / f"lgbm_{symbol}.joblib"
        self._meta_path = MODEL_DIR / f"lgbm_{symbol}_meta.joblib"

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
                "max_depth": 5,
                "learning_rate": 0.05,
                "subsample": 0.8,
                "colsample_bytree": 0.8,
                "min_child_samples": 20,
                "reg_alpha": 0.1,
                "reg_lambda": 1.0,
                "objective": "multiclass",
                "num_class": 3,
                "metric": "multi_logloss",
                "random_state": 42,
                "n_jobs": -1,
                "verbose": -1,
            }

        self.model = LGBMClassifier(**params)

        # Walk-forward validation
        tscv = TimeSeriesSplit(n_splits=5)
        scores: list[float] = []

        for train_idx, val_idx in tscv.split(X_train):
            X_tr, X_val = X_train[train_idx], X_train[val_idx]
            y_tr, y_val = y.iloc[train_idx], y.iloc[val_idx]

            self.model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)])
            y_pred = self.model.predict(X_val)
            scores.append(accuracy_score(y_val, y_pred))

        # آموزش نهایی
        self.model.fit(X_train, y.values)

        y_pred_final = self.model.predict(X_train)
        # این معیارها in-sample هستند (روی داده آموزش)؛ با پیشوند train_ مشخص شده‌اند
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

        # هشدار بیش‌برازش: فاصله زیاد بین دقت in-sample و cross-validation
        if metrics["train_accuracy"] - cv_accuracy_mean > 0.05:
            logger.warning(
                "lgbm_possible_overfit",
                symbol=self.symbol,
                train_accuracy=round(metrics["train_accuracy"], 4),
                cv_accuracy_mean=round(cv_accuracy_mean, 4),
            )

        logger.info(
            "lgbm_trained",
            symbol=self.symbol,
            train_accuracy=round(metrics["train_accuracy"], 4),
        )
        return metrics

    def predict(self, X: pd.DataFrame) -> dict[str, Any]:
        """پیش‌بینی قدرت حرکت"""
        if self.model is None:
            self.load()
        if self.model is None:
            return {"strength": "medium", "confidence": 0.0, "probabilities": {}}

        # ورودی باید DataFrame باشد؛ Series یک‌بعدی پشتیبانی نمی‌شود
        # (انتخاب ستون X[self.feature_columns] روی Series پیش از این شرط خطا می‌دهد)
        features = X[self.feature_columns].values.reshape(1, -1) if len(X.shape) == 1 else X[self.feature_columns].values
        probas = self.model.predict_proba(features)
        pred_class = int(self.model.predict(features)[0])

        strength_map = {0: "weak", 1: "medium", 2: "strong"}
        strength = strength_map.get(pred_class, "medium")
        confidence = float(probas[0][pred_class])

        return {
            "strength": strength,
            "confidence": round(confidence, 4),
            "probabilities": {
                "weak": round(float(probas[0][0]), 4),
                "medium": round(float(probas[0][1]), 4),
                "strong": round(float(probas[0][2]), 4),
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
            logger.info("lgbm_saved", path=str(self._model_path))

    def load(self) -> bool:
        """بارگذاری مدل"""
        if self._model_path.exists() and self._meta_path.exists():
            self.model = joblib.load(self._model_path)
            meta = joblib.load(self._meta_path)
            self.feature_columns = meta["feature_columns"]
            self.version = meta.get("version", "1.0")
            logger.info("lgbm_loaded", path=str(self._model_path))
            return True
        logger.warning("lgbm_model_not_found", path=str(self._model_path))
        return False

    @staticmethod
    def build_strength_target(df: pd.DataFrame, forward: int = 4) -> pd.Series:
        """ساخت هدف قدرت حرکت"""
        future_change = abs(df["close"].shift(-forward) / df["close"] - 1) * 100
        target = pd.Series(1, index=df.index)  # Medium
        target[future_change > 0.3] = 2  # Strong
        target[future_change < 0.1] = 0  # Weak
        # ردیف‌های انتهایی که future_change ندارند (NaN) نباید کلاس ۱ کاذب بگیرند
        target = target.where(future_change.notna())
        return target
