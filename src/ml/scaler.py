"""
Feature scaler — ذخیره/بازیابی scaler به‌همراه مدل برای جلوگیری از
distribution mismatch بین train و inference.

باگ بحرانی شناسایی‌شده در ممیزی:
    اگر مدل روی فیچرهای scaled آموزش ببیند ولی در runtime فیچرها
    scale نشوند، مدل روی distribution متفاوت predict می‌کند →
    دقت واقعی بسیار کمتر از گزارش‌شده.

این ماژول راه‌حل ارائه می‌دهد:
    1. هنگام train: scaler را fit کن، روی train apply کن، و save کن
    2. هنگام predict: همان scaler ذخیره‌شده را load کن و apply کن
    3. اگر scaler یافت نشد، خطا (بهتر از غلط predict کردن)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional, Sequence

import joblib
import pandas as pd
from sklearn.preprocessing import RobustScaler, StandardScaler

from src.core.logger import get_logger

logger = get_logger(__name__)

# مسیر پیش‌فرض ذخیره scaler — زیر ml_models که بین کانتینرها mount/به‌اشتراک است
# (قبلاً /app/models بود که mount نمی‌شد و موتور آن را نمی‌دید)
DEFAULT_MODEL_DIR = Path("/app/ml_models/scalers")


@dataclass
class FittedScaler:
    """scaler آموزش‌دیده به‌همراه ترتیب فیچرها."""

    scaler: Any
    feature_columns: list[str]
    scaler_type: str  # "standard" یا "robust"

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        اعمال scaler روی DataFrame — فقط فیچرهای ذخیره‌شده.

        ترتیب ستون‌ها همان ترتیب fit است (مهم برای reproducibility).
        ستون‌های اضافی (timestamp، target، …) حذف می‌شوند.
        """
        missing = set(self.feature_columns) - set(df.columns)
        if missing:
            raise ValueError(
                f"فیچرهای زیر در داده ورودی نیست: {sorted(missing)}"
            )
        ordered = df[self.feature_columns]
        scaled_values = self.scaler.transform(ordered)
        return pd.DataFrame(
            scaled_values, columns=self.feature_columns, index=df.index
        )

    def save(self, path: Path) -> None:
        """ذخیره‌ی scaler و metadata در یک فایل joblib."""
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(
            {
                "scaler": self.scaler,
                "feature_columns": list(self.feature_columns),
                "scaler_type": self.scaler_type,
            },
            path,
        )
        logger.info(
            "scaler_saved",
            path=str(path),
            n_features=len(self.feature_columns),
            type=self.scaler_type,
        )

    @classmethod
    def load(cls, path: Path) -> "FittedScaler":
        """بارگذاری scaler از فایل."""
        if not path.exists():
            raise FileNotFoundError(f"scaler یافت نشد: {path}")
        data = joblib.load(path)
        return cls(
            scaler=data["scaler"],
            feature_columns=list(data["feature_columns"]),
            scaler_type=data["scaler_type"],
        )


def fit_scaler(
    df: pd.DataFrame,
    feature_columns: Sequence[str],
    scaler_type: str = "robust",
) -> FittedScaler:
    """
    آموزش scaler روی DataFrame داده‌ی آموزش.

    نوع scaler:
        - "robust": مقاوم در برابر outlier (پیشنهاد برای داده‌ی مالی)
        - "standard": z-score (mean=0, std=1)

    نکته‌ی متخصص بازار: داده‌های قیمت پر از outlier است (spikes اخباری)،
    بنابراین RobustScaler که از median و IQR استفاده می‌کند پایدارتر است.
    """
    if scaler_type == "robust":
        scaler = RobustScaler()
    elif scaler_type == "standard":
        scaler = StandardScaler()
    else:
        raise ValueError(f"scaler_type ناشناخته: {scaler_type}")

    cols = list(feature_columns)
    scaler.fit(df[cols])
    return FittedScaler(
        scaler=scaler,
        feature_columns=cols,
        scaler_type=scaler_type,
    )


def scaler_path(symbol: str, model_name: str, base_dir: Optional[Path] = None) -> Path:
    """مسیر استاندارد فایل scaler برای یک مدل."""
    base = base_dir or DEFAULT_MODEL_DIR
    return base / symbol / f"{model_name}_scaler.joblib"
