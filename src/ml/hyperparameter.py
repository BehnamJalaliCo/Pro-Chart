"""بهینه‌سازی هایپرپارامتر با Optuna"""

from __future__ import annotations

from typing import Any

import numpy as np
import optuna
import pandas as pd
from sklearn.metrics import accuracy_score
from sklearn.model_selection import TimeSeriesSplit
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

from src.core.logger import get_logger

logger = get_logger(__name__)

# جلوگیری از لاگ اضافی Optuna
optuna.logging.set_verbosity(optuna.logging.WARNING)


class HyperparameterTuner:
    """بهینه‌سازی هایپرپارامترها"""

    def __init__(self, n_trials: int = 50, n_splits: int = 5) -> None:
        self.n_trials = n_trials
        self.n_splits = n_splits

    def tune_xgboost(self, X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
        """بهینه‌سازی XGBoost"""
        def objective(trial: optuna.Trial) -> float:
            params = {
                "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
                "max_depth": trial.suggest_int("max_depth", 3, 10),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
                "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
                "gamma": trial.suggest_float("gamma", 0.0, 1.0),
                "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 1.0),
                "reg_lambda": trial.suggest_float("reg_lambda", 0.0, 2.0),
                "objective": "multi:softprob",
                "num_class": 3,
                "eval_metric": "mlogloss",
                "random_state": 42,
                "n_jobs": -1,
                "use_label_encoder": False,
            }

            tscv = TimeSeriesSplit(n_splits=self.n_splits)
            scores = []

            for train_idx, val_idx in tscv.split(X):
                X_tr, X_val = X[train_idx], X[val_idx]
                y_tr, y_val = y[train_idx], y[val_idx]

                model = XGBClassifier(**params)
                model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
                y_pred = model.predict(X_val)
                scores.append(accuracy_score(y_val, y_pred))

            return float(np.mean(scores))

        study = optuna.create_study(direction="maximize")
        study.optimize(objective, n_trials=self.n_trials, show_progress_bar=False)

        logger.info(
            "xgboost_tuning_complete",
            best_score=round(study.best_value, 4),
            best_params=study.best_params,
        )
        return study.best_params

    def tune_lgbm(self, X: np.ndarray, y: np.ndarray) -> dict[str, Any]:
        """بهینه‌سازی LightGBM"""
        def objective(trial: optuna.Trial) -> float:
            params = {
                "n_estimators": trial.suggest_int("n_estimators", 100, 1000),
                "max_depth": trial.suggest_int("max_depth", 3, 10),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.6, 1.0),
                "min_child_samples": trial.suggest_int("min_child_samples", 5, 50),
                "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 1.0),
                "reg_lambda": trial.suggest_float("reg_lambda", 0.0, 2.0),
                "num_leaves": trial.suggest_int("num_leaves", 20, 150),
                "objective": "multiclass",
                "num_class": 3,
                "metric": "multi_logloss",
                "random_state": 42,
                "n_jobs": -1,
                "verbose": -1,
            }

            tscv = TimeSeriesSplit(n_splits=self.n_splits)
            scores = []

            for train_idx, val_idx in tscv.split(X):
                X_tr, X_val = X[train_idx], X[val_idx]
                y_tr, y_val = y[train_idx], y[val_idx]

                model = LGBMClassifier(**params)
                model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)])
                y_pred = model.predict(X_val)
                scores.append(accuracy_score(y_val, y_pred))

            return float(np.mean(scores))

        study = optuna.create_study(direction="maximize")
        study.optimize(objective, n_trials=self.n_trials, show_progress_bar=False)

        logger.info(
            "lgbm_tuning_complete",
            best_score=round(study.best_value, 4),
            best_params=study.best_params,
        )
        return study.best_params
