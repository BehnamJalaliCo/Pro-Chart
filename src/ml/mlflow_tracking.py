"""لاگِ آموزشِ مدل در MLflow — fail-soft و اختیاری.

اگر MLFLOW_TRACKING_URI ست نباشد یا کلاینتِ mlflow نبود، بی‌صدا no-op می‌شود تا
هرگز آموزش را نشکند. وقتی فعال باشد، برای هر مدلِ هر نماد یک run با متریک‌ها و
آرتیفکتِ مدل (فایلِ joblib) ثبت و در experimentِ «coinepro-models» نسخه‌دار می‌شود.
"""

from __future__ import annotations

import glob
import os
from typing import Any

from src.core.logger import get_logger

logger = get_logger("ml.mlflow")


def log_training_run(symbol: str, results: dict[str, Any],
                     model_dir: str = "/app/ml_models") -> None:
    uri = os.getenv("MLFLOW_TRACKING_URI")
    if not uri:
        return
    try:
        import mlflow
    except Exception:  # noqa: BLE001 — کلاینت نصب نیست → no-op
        return
    try:
        mlflow.set_tracking_uri(uri)
        mlflow.set_experiment("coinepro-models")
        logged = 0
        for model_name, metrics in (results or {}).items():
            if not isinstance(metrics, dict) or "error" in metrics:
                continue
            with mlflow.start_run(run_name=f"{model_name}_{symbol}"):
                mlflow.set_tags({"symbol": symbol, "model": model_name})
                for k, v in metrics.items():
                    if isinstance(v, (int, float)) and not isinstance(v, bool):
                        try:
                            mlflow.log_metric(k, float(v))
                        except Exception:  # noqa: BLE001
                            pass
                # آرتیفکتِ مدل (joblib) — مدل + هرچه با نام نماد ذخیره شده
                for f in glob.glob(os.path.join(model_dir, f"*{symbol}*")):
                    if model_name.split("_")[0] in os.path.basename(f).lower() or True:
                        try:
                            mlflow.log_artifact(f, artifact_path="model")
                        except Exception:  # noqa: BLE001
                            pass
                logged += 1
        logger.info("mlflow_logged", symbol=symbol, runs=logged)
    except Exception as exc:  # noqa: BLE001
        logger.warning("mlflow_log_failed", symbol=symbol, error=str(exc))
