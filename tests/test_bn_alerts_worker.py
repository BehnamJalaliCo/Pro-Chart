"""گاردِ رگرسیون — ورکرِ آلارمِ بازارنما باید واقعاً بالا بیاید و **مکرراً** کار کند.

دو باگ که این تست جلویشان را می‌گیرد:

۱. `celery_app.conf.include` به `src.copy.tasks` و `src.ml.ensemble` ارجاع می‌داد که
   **وجود ندارند**. هر ورکری که از این ریپو بالا می‌آمد با ModuleNotFoundError می‌مرد،
   پس `check_alerts` هرگز اجرا نشد — آلارم‌های کاربران فقط در DB می‌نشستند.

۲. `_run` هر بار یک event loopِ تازه می‌ساخت، ولی `engine` (asyncpg) و `redis_client`
   singletonهای ماژول‌اند و اتصالاتِ pool به loopِ سازنده قفل می‌شوند. اجرای اول کار
   می‌کرد، اجرای **دوم به بعد** با «got Future attached to a different loop» می‌شکست.
   در یک ورکر یعنی فقط تیکِ اول کار می‌کرد.

اجرا:  pytest tests/test_bn_alerts_worker.py -v
"""

from __future__ import annotations

import importlib
import os

import pytest


def test_every_include_module_is_importable():
    """هیچ ورودیِ include نباید به ماژولِ ناموجود اشاره کند — وگرنه ورکر بوت نمی‌شود."""
    from src.core.celery_app import celery_app

    broken = []
    for mod in celery_app.conf.include or []:
        try:
            importlib.import_module(mod)
        except Exception as exc:  # noqa: BLE001
            broken.append(f"{mod} → {type(exc).__name__}: {exc}")
    assert not broken, "ماژول‌های include که import نمی‌شوند (ورکر بوت نخواهد شد):\n" + "\n".join(broken)


def test_worker_can_import_default_modules():
    """همان کاری که Celery هنگامِ بوت می‌کند."""
    from src.core.celery_app import celery_app

    celery_app.loader.import_default_modules()


def test_bn_alert_tasks_are_registered():
    from src.core.celery_app import celery_app

    celery_app.loader.import_default_modules()
    for name in ("src.bazaarnama.tasks.check_alerts", "src.bazaarnama.tasks.check_ai_signals"):
        assert name in celery_app.tasks, f"{name} ثبت نشده — beat آن را صدا می‌زند ولی پیدا نمی‌شود"


@pytest.mark.skipif(
    os.getenv("BN_CELERY_PROCHART_ONLY", "") not in {"1", "true", "True"},
    reason=(
        "زمان‌بندیِ قدیمیِ CoinePro FX ۸ ورودیِ خراب دارد (calculate_performance، "
        "retrain_all_models، close_positions_weekend، copy.tasks، ml.ensemble). "
        "استکِ prochart آن را اجرا نمی‌کند؛ اصلاحش کارِ همان استک است."
    ),
)
def test_every_beat_task_resolves():
    """هر ورودیِ beat باید به یک تابعِ موجود اشاره کند، وگرنه beat هر بار خطا می‌دهد."""
    from src.core.celery_app import celery_app

    broken = []
    for name, cfg in (celery_app.conf.beat_schedule or {}).items():
        path = cfg.get("task", "")
        mod_name, _, fn_name = path.rpartition(".")
        try:
            mod = importlib.import_module(mod_name)
        except Exception as exc:  # noqa: BLE001
            broken.append(f"{name}: {path} → {type(exc).__name__}")
            continue
        if not hasattr(mod, fn_name):
            broken.append(f"{name}: {path} → تابع وجود ندارد")
    assert not broken, "ورودی‌های beat که resolve نمی‌شوند:\n" + "\n".join(broken)


@pytest.mark.skipif(
    os.getenv("BN_CELERY_PROCHART_ONLY", "") not in {"1", "true", "True"},
    reason="فقط در حالتِ prochart-only معنا دارد (BN_CELERY_PROCHART_ONLY=1)",
)
def test_prochart_only_schedules_exactly_the_two_bn_tasks():
    """استکِ prochart نباید زمان‌بندیِ قدیمیِ CoinePro FX را بالا بیاورد.

    ۸ ورودیِ آن به توابعِ ناموجود اشاره می‌کند، و تسک‌های اینستاگرامش با تکرارِ
    ۲–۳ ثانیه همان چیزی‌اند که در حادثهٔ ۲۰۲۶-۰۶-۱۹ صف را به ۲۴۰هزار تسک رساندند.
    """
    from src.core.celery_app import celery_app

    assert set(celery_app.conf.beat_schedule) == {"bn-check-alerts", "bn-check-ai-signals"}


def test_run_helper_survives_repeated_calls():
    """باگِ «different loop»: تیکِ دوم نباید بشکند.

    این هستهٔ باگ است — `_run` باید pool‌ها را داخلِ همان loop آزاد کند.
    """
    from src.bazaarnama import tasks

    calls = []

    async def _probe():
        calls.append(1)
        return len(calls)

    # نکته: یکتاییِ loop را با id() نمی‌سنجیم — CPython آدرسِ loopِ بسته‌شده را
    # بازاستفاده می‌کند، پس id تکراری می‌شود و تست مثبتِ کاذب می‌دهد.
    # چیزی که اهمیت دارد این است که هیچ فراخوانی throw نکند.
    assert tasks._run(_probe()) == 1
    assert tasks._run(_probe()) == 2  # پیش‌تر اینجا: RuntimeError «different loop»
    assert tasks._run(_probe()) == 3


def test_run_disposes_pools_between_calls():
    """پس از هر _run، poolِ Redis باید آزاد شده باشد تا تیکِ بعدی از آن استفاده نکند."""
    from src.bazaarnama import tasks
    from src.core.redis_client import redis_client

    async def _noop():
        return True

    tasks._run(_noop())
    assert getattr(redis_client, "_pool", None) is None, (
        "poolِ Redis پس از _run آزاد نشده — تیکِ بعدی روی loopِ دیگری از آن استفاده می‌کند و می‌شکند"
    )
