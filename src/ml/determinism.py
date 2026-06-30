"""
ست کردن seed‌ها برای reproducibility در ML training.

این ماژول تنها نقطه‌ی ورود برای تمام seed ها است. در ابتدای هر
training script صدا زده می‌شود.

نکته: deterministic CUDA کامل نیست — بعضی operations مثل
torch.nn.functional.conv2d بنا به دلایل performance، NDeterministic
هستند. این ماژول best-effort است.
"""

from __future__ import annotations

import os
import random
from typing import Optional


def set_global_seed(seed: int = 42, deterministic_cuda: bool = True) -> None:
    """
    ست کردن seed تمام libraries.

    پارامترها:
        seed: مقدار seed (پیش‌فرض ۴۲)
        deterministic_cuda: آیا CUDA deterministic mode فعال شود؟
            هزینه‌ی performance دارد ولی reproducibility تضمین می‌کند.
    """
    # ── Python stdlib ──
    random.seed(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)

    # ── NumPy ──
    try:
        import numpy as np
        np.random.seed(seed)
    except ImportError:
        pass

    # ── PyTorch ──
    try:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed(seed)
            torch.cuda.manual_seed_all(seed)
            if deterministic_cuda:
                torch.backends.cudnn.deterministic = True
                torch.backends.cudnn.benchmark = False
                # برای CUDA >= 10.2:
                os.environ.setdefault(
                    "CUBLAS_WORKSPACE_CONFIG", ":4096:8"
                )
                try:
                    torch.use_deterministic_algorithms(True, warn_only=True)
                except Exception:
                    pass
    except ImportError:
        pass

    # ── TensorFlow (اگر استفاده شود) ──
    try:
        import tensorflow as tf
        tf.random.set_seed(seed)
    except ImportError:
        pass


def verify_determinism() -> dict:
    """
    بررسی اینکه seed ها فعال شده‌اند.

    خروجی: dict گزارش وضعیت
    """
    status: dict = {
        "pythonhashseed": os.environ.get("PYTHONHASHSEED"),
        "numpy_state": None,
        "torch_seed": None,
        "torch_cudnn_deterministic": None,
    }
    try:
        import numpy as np
        status["numpy_state"] = "set" if np.random.get_state()[1][0] != 0 else "unset"
    except ImportError:
        status["numpy_state"] = "not_installed"

    try:
        import torch
        status["torch_seed"] = torch.initial_seed()
        status["torch_cudnn_deterministic"] = (
            torch.backends.cudnn.deterministic if torch.cuda.is_available() else None
        )
    except ImportError:
        status["torch_seed"] = "not_installed"

    return status
