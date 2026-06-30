"""
ابزار trade-off async/sync — اجرای کد CPU-bound در thread pool.

منطق متخصص:
    pandas/numpy/sklearn اغلب GIL را آزاد می‌کنند هنگام کار با numpy arrays
    بزرگ، بنابراین thread pool راه‌حل خوبی برای parallelism است.

    این ماژول یک wrapper سبک ارائه می‌دهد که:
        - یک ThreadPoolExecutor شیر‌شده در application می‌سازد
        - تابع sync را در آن اجرا می‌کند
        - timeout اختیاری برای جلوگیری از hang

استفاده:
    from src.core.async_utils import run_in_thread

    result = await run_in_thread(technical.analyze, df)
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Any, Callable, Optional, TypeVar

from src.core.logger import get_logger

logger = get_logger(__name__)

T = TypeVar("T")

# Default thread pool — shared در طول application
# مقدار = ۲× CPU count برای کار‌های mixed I/O+CPU
_DEFAULT_WORKERS = 8
_default_executor: Optional[ThreadPoolExecutor] = None


def get_default_executor() -> ThreadPoolExecutor:
    """دریافت یا ساخت default thread pool — lazy init."""
    global _default_executor
    if _default_executor is None:
        _default_executor = ThreadPoolExecutor(
            max_workers=_DEFAULT_WORKERS,
            thread_name_prefix="cpu_bound",
        )
    return _default_executor


def shutdown_default_executor() -> None:
    """خاموش‌کردن default executor — هنگام shutdown app."""
    global _default_executor
    if _default_executor is not None:
        _default_executor.shutdown(wait=True, cancel_futures=False)
        _default_executor = None


async def run_in_thread(
    func: Callable[..., T],
    *args: Any,
    timeout: Optional[float] = None,
    executor: Optional[ThreadPoolExecutor] = None,
    **kwargs: Any,
) -> T:
    """
    اجرای یک تابع sync (CPU-bound) در thread pool بدون block کردن event loop.

    پارامترها:
        func: تابع sync
        *args, **kwargs: ورودی‌های تابع
        timeout: ثانیه — در صورت تجاوز TimeoutError
        executor: ThreadPoolExecutor (پیش‌فرض default shared)

    خروجی:
        نتیجه‌ی تابع

    خطاها:
        TimeoutError اگر timeout تجاوز کند
        Exception ها از تابع به‌صورت raise مستقیم
    """
    loop = asyncio.get_running_loop()
    ex = executor or get_default_executor()

    # بستن kwargs در یک lambda — run_in_executor فقط args می‌گیرد
    if kwargs:
        wrapped = lambda: func(*args, **kwargs)  # noqa: E731
        future = loop.run_in_executor(ex, wrapped)
    else:
        future = loop.run_in_executor(ex, func, *args)

    if timeout is not None:
        try:
            return await asyncio.wait_for(future, timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning(
                "run_in_thread_timeout",
                func=getattr(func, "__name__", str(func)),
                timeout=timeout,
            )
            raise
    return await future


@asynccontextmanager
async def thread_pool_lifespan():
    """
    Context manager برای ادغام در lifespan FastAPI.

    استفاده:
        @asynccontextmanager
        async def lifespan(app):
            async with thread_pool_lifespan():
                yield
    """
    try:
        yield get_default_executor()
    finally:
        shutdown_default_executor()
