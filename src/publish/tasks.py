"""تسک‌های celery برای انتشارِ خودکارِ ویدیوی آکادمی."""
from __future__ import annotations

import asyncio

from src.core.celery_app import celery_app
from src.core.logger import get_logger

logger = get_logger(__name__)


def _run(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # هر تسک یک loopِ جدید می‌سازد؛ poolِ engineِ سراسری به loopِ بسته‌شدهٔ تسکِ
        # قبلی گره می‌خورد و «TCPTransport closed=True … the handler is closed» می‌دهد
        # (دلیلِ شکستِ blog_to_video). اتصال‌های بیاتِ آن loop را بدونِ بستن رها می‌کنیم
        # تا در همین loop اتصالِ تازه ساخته شود.
        from src.core.database import engine
        loop.run_until_complete(engine.dispose(close=False))
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(name="src.publish.tasks.academy_video_drip")
def academy_video_drip() -> dict:
    """روزی یک درس را در یوتیوب/آپارات منتشر می‌کند (مقدماتی→حرفه‌ای)."""
    from src.publish.academy_drip import drip_once
    res = _run(drip_once())
    logger.info("academy_video_drip_result", result=res)
    return res


@celery_app.task(name="src.publish.tasks.academy_drip_status")
def academy_drip_status() -> dict:
    from src.publish.academy_drip import status_summary
    return _run(status_summary())


@celery_app.task(name="src.publish.tasks.blog_to_video", time_limit=4000, soft_time_limit=3800)
def blog_to_video() -> dict:
    """یک بلاگِ تازه را به ویدیوی یوتیوب (۳-۸ دقیقه) + شورت تبدیل و منتشر می‌کند."""
    from src.publish.blog_video import run_once
    res = _run(run_once())
    logger.info("blog_to_video_result", result=res)
    return res
