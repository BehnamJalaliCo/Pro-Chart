"""تسک‌های Celeryِ ماژولِ اینستاگرام — polling پاسخِ خودکار + پردازشِ محتوای زمان‌بندی‌شده."""
from __future__ import annotations

import asyncio

from src.core.celery_app import celery_app
from src.core.logger import get_logger

logger = get_logger(__name__)


def _run(coro):
    """loopِ تازه برای هر تسک + بستنِ Redis در همان loop (اتصالِ تازه، بدونِ stale)."""
    from src.core.redis_client import redis_client
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        try:
            loop.run_until_complete(redis_client.close())
        except Exception:
            pass
        loop.close()


@celery_app.task(name="src.instagram.tasks.ig_dm")
def ig_dm() -> dict:
    """مسیرِ سریعِ دایرکت: poll دایرکت + ارسالِ فوری (هر ~۳s). پاسخِ کاربر در چند ثانیه."""
    from src.instagram.engine import detect_and_enqueue
    try:
        return _run(detect_and_enqueue(scope="dm"))
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_dm_task_failed", error=str(e)[:200]); return {"error": str(e)[:200]}


@celery_app.task(name="src.instagram.tasks.ig_detect")
def ig_detect() -> dict:
    """آشکارسازِ کامنت: کامنتِ جدید را تشخیص و در صف می‌گذارد (هر ~۱۲s — polling کامنت سبک‌تر نگه داشته می‌شود)."""
    from src.instagram.engine import detect_and_enqueue
    try:
        return _run(detect_and_enqueue(scope="comment"))
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_detect_task_failed", error=str(e)[:200]); return {"error": str(e)[:200]}


@celery_app.task(name="src.instagram.tasks.ig_drain")
def ig_drain() -> dict:
    """فرستندهٔ نرخ‌دار: از صف با سقفِ ساعتیِ امن می‌فرستد (هر ~۲۰s)."""
    from src.instagram.engine import drain_queue
    try:
        return _run(drain_queue())
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_drain_task_failed", error=str(e)[:200]); return {"error": str(e)[:200]}


@celery_app.task(name="src.instagram.tasks.ig_poll_replies")
def ig_poll_replies() -> dict:
    """سازگاری/تستِ دستی — یک دورِ کاملِ تشخیص+ارسال."""
    from src.instagram.engine import poll_and_reply
    try:
        return _run(poll_and_reply())
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_poll_task_failed", error=str(e)[:200]); return {"error": str(e)[:200]}


@celery_app.task(name="src.instagram.tasks.ig_reminders")
def ig_reminders() -> dict:
    """ارسالِ پیام‌های یادآوریِ سررسیده."""
    from src.instagram.engine import send_reminders
    try:
        return _run(send_reminders())
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_reminders_task_failed", error=str(e)[:200]); return {"error": str(e)[:200]}


@celery_app.task(name="src.instagram.tasks.ig_autopilot")
def ig_autopilot() -> dict:
    """خلبانِ خودکار — طبق زمان‌بندی، محتوای جدید می‌سازد و زمان‌بندی می‌کند."""
    from src.instagram.autopilot import run_due
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(run_due())
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_autopilot_task_failed", error=str(e)[:200]); return {"error": str(e)[:200]}
    finally:
        loop.close()


@celery_app.task(name="src.instagram.tasks.ig_generate_video")
def ig_generate_video() -> dict:
    """ساختِ خودکارِ ویدیوی محتواهای در انتظار (ElevenLabs + رندر). سنگین → دستهٔ کوچک."""
    from src.instagram.video_gen import generate_pending
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(generate_pending())
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_genvideo_task_failed", error=str(e)[:200]); return {"error": str(e)[:200]}
    finally:
        loop.close()


@celery_app.task(name="src.instagram.tasks.ig_publish_due")
def ig_publish_due() -> dict:
    """انتشارِ محتواهای زمان‌بندی‌شده‌ای که موعدشان رسیده (فاز ۴)."""
    from src.instagram.publisher import publish_due
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(publish_due())
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_publish_task_failed", error=str(e)[:200])
        return {"error": str(e)[:200]}
    finally:
        loop.close()


@celery_app.task(name="src.instagram.tasks.ig_learn")
def ig_learn() -> dict:
    """حلقهٔ یادگیریِ روزانه — عملکردِ پست‌ها → وزنِ سبک‌های برنده."""
    from src.instagram.learn import collect_and_learn
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(collect_and_learn())
    except Exception as e:  # noqa: BLE001
        logger.warning("ig_learn_task_failed", error=str(e)[:200]); return {"error": str(e)[:200]}
    finally:
        loop.close()
