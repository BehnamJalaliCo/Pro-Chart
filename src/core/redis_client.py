"""کلاینت Redis — کش و pub/sub"""

from __future__ import annotations

from typing import Any, Optional

import redis.asyncio as aioredis
import orjson

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger(__name__)


class RedisClient:
    """مدیریت اتصال Redis"""

    def __init__(self) -> None:
        self._pool: Optional[aioredis.Redis] = None

    async def connect(self) -> None:
        """اتصال به Redis — pool size از تنظیمات می‌خواند."""
        max_conn = getattr(settings, "REDIS_MAX_CONNECTIONS", 150)
        self._pool = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=max_conn,
            socket_keepalive=True,
            health_check_interval=30,
        )
        await self._pool.ping()
        logger.info("redis_connected", host=settings.REDIS_HOST, max_connections=max_conn)

    async def close(self) -> None:
        """بستن اتصال"""
        if self._pool:
            await self._pool.close()
            logger.info("redis_disconnected")

    @property
    def client(self) -> aioredis.Redis:
        if self._pool is None:
            raise RuntimeError("Redis متصل نیست. ابتدا connect() را صدا بزنید.")
        return self._pool

    # ── عملیات کش ────────────────────────────────────────
    async def set_json(self, key: str, data: Any, expire: int = 300) -> None:
        """ذخیره JSON در کش"""
        value = orjson.dumps(data).decode("utf-8")
        await self.client.set(key, value, ex=expire)

    async def get_json(self, key: str) -> Optional[Any]:
        """خواندن JSON از کش"""
        value = await self.client.get(key)
        if value is None:
            return None
        return orjson.loads(value)

    async def delete(self, key: str) -> None:
        """حذف کلید"""
        await self.client.delete(key)

    async def exists(self, key: str) -> bool:
        """بررسی وجود کلید"""
        return bool(await self.client.exists(key))

    # ── عملیات قیمت لحظه‌ای ──────────────────────────────
    async def set_price(self, symbol: str, price_data: dict) -> None:
        """ذخیره قیمت لحظه‌ای — TTL باید بزرگ‌تر از فاصلهٔ آپدیت باشد وگرنه قیمت بینِ
        دو آپدیت منقضی می‌شود و «وضعیت بازار» خالی می‌ماند. چون منبعِ رایگانِ yfinance
        گاه چند دقیقه rate-limit می‌شود، TTL=۶۰۰ تا یک فِچِ موفق هر ≤۱۰دقیقه قیمت را
        زنده نگه دارد و چارت/«وضعیت بازار» بینِ فاصله‌ها خالی نشود (مصرف‌کننده‌ها timestamp
        را دارند و خودشان کهنگی را تشخیص می‌دهند)."""
        key = f"price:{symbol}"
        await self.set_json(key, price_data, expire=600)

    async def get_price(self, symbol: str) -> Optional[dict]:
        """دریافت قیمت لحظه‌ای"""
        return await self.get_json(f"price:{symbol}")

    async def get_all_prices(self) -> dict[str, dict]:
        """
        دریافت تمام قیمت‌ها — با SCAN + pipeline.

        قبلاً: KEYS price:* (blocking) + N × get (N RTT)
        حالا: SCAN (non-blocking) + MGET در یک pipeline (۱ RTT)
        """
        keys: list[str] = []
        cursor = 0
        # SCAN با count=200 برای کمتر شدن round-trips
        while True:
            cursor, batch = await self.client.scan(cursor, match="price:*", count=200)
            keys.extend(batch)
            if cursor == 0:
                break

        if not keys:
            return {}

        async with self.client.pipeline(transaction=False) as pipe:
            for k in keys:
                pipe.get(k)
            values = await pipe.execute()

        result: dict[str, dict] = {}
        for key, raw in zip(keys, values):
            if raw is None:
                continue
            try:
                result[key.replace("price:", "")] = orjson.loads(raw)
            except Exception:
                continue
        return result

    # ── عملیات سیگنال فعال ───────────────────────────────
    #
    # نکته‌ی performance (فاز ۹):
    #   قبلاً برای get_all_active_signals از KEYS "signal:active:*" استفاده
    #   می‌شد که در hot path هر ۱۰ ثانیه (tracker) و در API endpoints صدا
    #   می‌خورد. KEYS برای ۱۰۰۰ active signal تا ۲۰۰ms طول می‌کشد و یک
    #   blocking operation است (Redis single-threaded).
    #
    #   راه‌حل: یک Sorted Set ("signals:active_ids") به‌عنوان index نگه‌داری
    #   می‌کنیم. score = timestamp ایجاد. خواندن O(log N) و non-blocking است.
    #   همچنین برای fetch چندتایی از pipeline استفاده می‌کنیم → ۱ RTT به‌جای N.

    _ACTIVE_INDEX_KEY: str = "signals:active_ids"

    async def set_active_signal(self, signal_id: int, data: dict) -> None:
        """
        ذخیره سیگنال فعال — همراه با index برای lookup سریع.

        از pipeline استفاده می‌کنیم تا set_json و zadd در یک RTT باشند.
        """
        import time as _t
        key = f"signal:active:{signal_id}"
        value = orjson.dumps(data).decode("utf-8")
        # TTLِ بلند (۱۴ روز) به‌جای ۲۴ ساعت: باگِ قبلی باعث می‌شد هر پوزیشنِ بازِ
        # بیش از ۲۴ ساعت کلیدش منقضی شود، از index بیفتد و tracker دیگر TP/SL را
        # چک نکند (پوزیشن در DB برای همیشه active می‌ماند). پوزیشن‌ها صریحاً هنگامِ
        # بسته‌شدن حذف می‌شوند؛ این TTL فقط شبکهٔ ایمنیِ ضدِ نشتی است.
        async with self.client.pipeline(transaction=False) as pipe:
            pipe.set(key, value, ex=1209600)
            pipe.zadd(self._ACTIVE_INDEX_KEY, {str(signal_id): _t.time()})
            await pipe.execute()

    async def get_active_signal(self, signal_id: int) -> Optional[dict]:
        """دریافت سیگنال فعال"""
        return await self.get_json(f"signal:active:{signal_id}")

    async def remove_active_signal(self, signal_id: int) -> None:
        """حذف سیگنال فعال — از key و از index"""
        key = f"signal:active:{signal_id}"
        async with self.client.pipeline(transaction=False) as pipe:
            pipe.delete(key)
            pipe.zrem(self._ACTIVE_INDEX_KEY, str(signal_id))
            await pipe.execute()

    async def get_all_active_signals(self, limit: int = 1000) -> list[dict]:
        """
        دریافت تمام سیگنال‌های فعال — با sorted-set index و pipeline.

        پارامترها:
            limit: حداکثر تعداد (پیش‌فرض ۱۰۰۰ برای جلوگیری از انفجار حافظه)

        منطق:
            1) ZREVRANGE روی index → ID های سیگنال (جدید به قدیم)
            2) MGET موازی روی تمام key ها در یک pipeline → ۱ RTT
            3) deserialize با orjson

        speedup در عمل: ۲۰۰ms (با KEYS) → ۱۵-۲۰ms (با index+pipeline)
        """
        try:
            ids = await self.client.zrevrange(self._ACTIVE_INDEX_KEY, 0, limit - 1)
        except Exception:
            ids = []

        if not ids:
            return []

        # MGET تمام keys در یک pipeline
        keys = [f"signal:active:{sid}" for sid in ids]
        async with self.client.pipeline(transaction=False) as pipe:
            for k in keys:
                pipe.get(k)
            raw_values = await pipe.execute()

        signals = []
        stale_ids: list[str] = []
        for sid, raw in zip(ids, raw_values):
            if raw is None:
                # key منقضی شده ولی هنوز در index است — cleanup
                stale_ids.append(sid)
                continue
            try:
                signals.append(orjson.loads(raw))
            except Exception:
                stale_ids.append(sid)

        # cleanup stale entries (lazy gc)
        if stale_ids:
            try:
                await self.client.zrem(self._ACTIVE_INDEX_KEY, *stale_ids)
            except Exception:
                pass

        return signals

    async def count_active_signals(self) -> int:
        """تعداد سیگنال‌های فعال — O(1) از sorted set."""
        try:
            return int(await self.client.zcard(self._ACTIVE_INDEX_KEY))
        except Exception:
            return 0

    # ── عملیات Pub/Sub ───────────────────────────────────
    async def publish(self, channel: str, data: Any) -> None:
        """ارسال پیام به کانال"""
        message = orjson.dumps(data).decode("utf-8")
        await self.client.publish(channel, message)

    def make_pubsub(self) -> aioredis.client.PubSub:
        """یک شیء PubSub خام برمی‌گرداند (هنوز روی هیچ کانالی subscribe نشده).

        نکته: این متد فقط handle می‌سازد؛ caller باید خودش
        ``await pubsub.subscribe(*channels)`` را صدا بزند. قبلاً نام این متد
        ``subscribe`` بود و آرگومان channels را بی‌صدا نادیده می‌گرفت که
        منجر به از دست رفتن پیام‌ها می‌شد.
        """
        return self.client.pubsub()

    # ── عملیات وضعیت سرویس‌ها ────────────────────────────
    async def set_service_status(self, service: str, status: dict) -> None:
        """ذخیره وضعیت سرویس"""
        await self.set_json(f"service:{service}", status, expire=120)

    async def get_service_status(self, service: str) -> Optional[dict]:
        """دریافت وضعیت سرویس"""
        return await self.get_json(f"service:{service}")

    # ── شمارنده‌ها ───────────────────────────────────────
    async def increment(self, key: str, expire: int = 86400) -> int:
        """افزایش شمارنده — incr+expire در یک pipeline تا اگر crash قبل از
        تنظیم expire رخ دهد، کلید برای همیشه باقی نماند."""
        async with self.client.pipeline(transaction=False) as pipe:
            pipe.incr(key)
            pipe.expire(key, expire)
            results = await pipe.execute()
        return int(results[0])

    # ── عملیات مجموعه (Set) ────────────────────────────
    async def smembers(self, key: str) -> set:
        """دریافت اعضای مجموعه"""
        return await self.client.smembers(key)

    async def sadd(self, key: str, *values: Any) -> int:
        """افزودن به مجموعه"""
        return await self.client.sadd(key, *values)

    async def srem(self, key: str, *values: Any) -> int:
        """حذف از مجموعه"""
        return await self.client.srem(key, *values)

    # ── عملیات هش (Hash) ──────────────────────────────
    async def hgetall(self, key: str) -> dict:
        """دریافت تمام فیلدهای هش"""
        return await self.client.hgetall(key)

    async def hset(self, key: str, field: str | None = None,
                   value: str | None = None, mapping: dict | None = None) -> int:
        """تنظیم فیلد هش"""
        if mapping:
            return await self.client.hset(key, mapping=mapping)
        return await self.client.hset(key, field, value)

    # ── عملیات عمومی ──────────────────────────────────
    async def expire(self, key: str, seconds: int) -> bool:
        """تنظیم انقضا"""
        return await self.client.expire(key, seconds)

    async def set(self, key: str, value: Any, **kwargs: Any) -> Any:
        """ذخیره مقدار ساده"""
        return await self.client.set(key, value, **kwargs)

    async def get(self, key: str) -> Any:
        """دریافت مقدار ساده"""
        return await self.client.get(key)


# نمونه سینگلتون
redis_client = RedisClient()
