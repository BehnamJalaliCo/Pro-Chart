"""
Feature selection — کاهش ۶۰ feature به ۲۰-۳۰ feature معنادار.

منطق متخصص ML:
    Rule of thumb (Mowbray): حداقل 10-20 sample per feature.
    با ۵۰۰ training sample و ۶۰ feature → ratio = 8 → overfit certain.

    Two-step pipeline:
        1. Correlation pruning: حذف feature هایی که با feature دیگر
           |corr| > 0.95 دارند (highly redundant)
        2. Importance ranking: نگه‌داری top-K feature بر اساس
           XGBoost feature_importances_ یا mutual information
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np


@dataclass
class FeatureSelectionResult:
    """نتیجه‌ی feature selection."""

    selected_features: list[str]
    n_original: int
    n_after_correlation_prune: int
    n_after_importance_top_k: int
    pruned_correlated: list[tuple[str, str, float]] = field(default_factory=list)
    importance_scores: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "selected_features": list(self.selected_features),
            "n_selected": len(self.selected_features),
            "n_original": self.n_original,
            "n_after_correlation_prune": self.n_after_correlation_prune,
            "n_after_importance_top_k": self.n_after_importance_top_k,
            "pruned_correlated": [
                {"f1": a, "f2": b, "corr": round(c, 3)}
                for a, b, c in self.pruned_correlated
            ],
            "importance_scores": {
                k: round(v, 4) for k, v in self.importance_scores.items()
            },
        }


def correlation_prune(
    X: np.ndarray,
    feature_names: list[str],
    threshold: float = 0.95,
) -> tuple[list[str], list[tuple[str, str, float]]]:
    """
    حذف features با correlation بالا.

    اگر |corr(f_i, f_j)| > threshold، یکی از آن‌ها حذف می‌شود.
    تصمیم: feature با variance کمتر حذف می‌شود (کم‌اطلاعات‌تر).

    خروجی:
        (kept_features, pruned_pairs)
    """
    n_features = X.shape[1]
    if n_features != len(feature_names):
        raise ValueError("تعداد columns در X با feature_names برابر نیست.")

    # محاسبه correlation matrix
    # rowvar=False: هر column یک متغیر است
    with np.errstate(invalid="ignore", divide="ignore"):
        corr = np.corrcoef(X, rowvar=False)
    corr = np.nan_to_num(corr, nan=0.0)

    # variance per feature
    variances = X.var(axis=0)

    # set of indices to drop
    drop: set[int] = set()
    pruned_pairs: list[tuple[str, str, float]] = []

    for i in range(n_features):
        if i in drop:
            continue
        for j in range(i + 1, n_features):
            if j in drop:
                continue
            c = abs(corr[i, j])
            if c > threshold:
                # حذف آن که variance کمتر دارد
                if variances[i] < variances[j]:
                    drop.add(i)
                    pruned_pairs.append((feature_names[i], feature_names[j], c))
                    break  # i رفت، loop داخلی پایان
                else:
                    drop.add(j)
                    pruned_pairs.append((feature_names[j], feature_names[i], c))

    kept = [feature_names[i] for i in range(n_features) if i not in drop]
    return kept, pruned_pairs


def select_top_k_by_importance(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: list[str],
    k: int = 30,
) -> tuple[list[str], dict[str, float]]:
    """
    انتخاب top-K feature بر اساس importance.

    استفاده از XGBoost (در صورت موجود بودن) — gain-based importance.
    اگر XGBoost موجود نباشد، از mutual information ساده استفاده می‌کنیم.
    """
    n_features = X.shape[1]
    k = min(k, n_features)

    try:
        import xgboost as xgb
        # quick model برای importance
        model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            n_jobs=1,
            use_label_encoder=False,
            eval_metric="mlogloss",
            verbosity=0,
            random_state=42,
        )
        model.fit(X, y)
        importances = model.feature_importances_
    except Exception:
        # Fallback: mutual information ساده (variance-based)
        importances = _quick_importance(X, y)

    scores = {name: float(imp) for name, imp in zip(feature_names, importances)}
    # sort by importance desc
    sorted_features = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    selected = [name for name, _ in sorted_features[:k]]
    return selected, scores


def _quick_importance(X: np.ndarray, y: np.ndarray) -> np.ndarray:
    """
    Fallback importance — F-score-like بر اساس class separability.
    """
    n_features = X.shape[1]
    importances = np.zeros(n_features)
    unique_classes = np.unique(y)
    if len(unique_classes) < 2:
        return importances

    for i in range(n_features):
        col = X[:, i]
        # variance between classes / variance within
        between = 0.0
        within = 0.0
        overall_mean = col.mean()
        for c in unique_classes:
            mask = y == c
            if mask.sum() < 2:
                continue
            class_mean = col[mask].mean()
            class_var = col[mask].var()
            between += mask.sum() * (class_mean - overall_mean) ** 2
            within += mask.sum() * class_var
        importances[i] = between / (within + 1e-9)
    return importances


def select_features(
    X: np.ndarray,
    y: np.ndarray,
    feature_names: list[str],
    correlation_threshold: float = 0.95,
    top_k: int = 30,
) -> FeatureSelectionResult:
    """
    Pipeline کامل feature selection.

    مراحل:
        1. correlation pruning (حذف redundant)
        2. top-K بر اساس importance

    خروجی: FeatureSelectionResult
    """
    n_original = len(feature_names)

    # ── ۱) correlation prune ──
    kept_names, pruned = correlation_prune(
        X, feature_names, threshold=correlation_threshold
    )
    name_to_idx = {n: i for i, n in enumerate(feature_names)}
    kept_indices = [name_to_idx[n] for n in kept_names]
    X_pruned = X[:, kept_indices]

    n_after_corr = len(kept_names)

    # ── ۲) top-K by importance ──
    if len(kept_names) > top_k:
        selected, importance_scores = select_top_k_by_importance(
            X_pruned, y, kept_names, k=top_k
        )
    else:
        selected = kept_names
        _, importance_scores = select_top_k_by_importance(
            X_pruned, y, kept_names, k=len(kept_names)
        )

    return FeatureSelectionResult(
        selected_features=selected,
        n_original=n_original,
        n_after_correlation_prune=n_after_corr,
        n_after_importance_top_k=len(selected),
        pruned_correlated=pruned,
        importance_scores=importance_scores,
    )
