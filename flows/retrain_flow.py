"""فلوِ Prefect برای آموزشِ مجددِ مدل‌ها.

این فلو سبک است: تسکِ سنگینِ آموزش (`retrain_all_models`) را روی Celery‌ای که از قبل
هست enqueue می‌کند (پس runner نیازی به xgboost/داده ندارد). با retry و زمان‌بندیِ
هفتگی، و دیدِ خطا در داشبوردِ Prefect. آموزش وقتی اجرا شد، مدل‌ها را در MLflow هم لاگ می‌کند.

اجرا به‌صورتِ سرویسِ همیشه‌روشن:  python -m flows.retrain_flow
"""

from __future__ import annotations

import os

from prefect import flow, get_run_logger, task


@task(retries=2, retry_delay_seconds=120, name="enqueue-retrain")
def enqueue_retrain() -> str:
    """تسکِ آموزش را روی Celery enqueue می‌کند — با کلاینتِ مستقل (بدونِ importِ کلِ app
    تا تداخلِ dependency پیش نیاید)."""
    from celery import Celery

    broker = os.getenv("REDIS_URL", "redis://redis:6379/0")
    app = Celery(broker=broker, backend=broker)
    res = app.send_task("src.ml.trainer.retrain_all_models")
    return str(res.id)


@flow(name="coinepro-model-retrain")
def retrain_flow() -> str:
    logger = get_run_logger()
    task_id = enqueue_retrain()
    logger.info(f"retrain enqueued on Celery: task_id={task_id}")
    return task_id


if __name__ == "__main__":
    # serve = ثبتِ deployment + زمان‌بندی روی سرورِ Prefect و polling برای اجرای زمان‌بندی‌شده.
    cron = os.getenv("RETRAIN_CRON", "0 3 * * 0")  # یکشنبه ۰۳:۰۰ UTC
    retrain_flow.serve(name="weekly-retrain", cron=cron)
