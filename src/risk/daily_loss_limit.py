"""
قطع‌کننده‌ی روزانه (Circuit Breaker) — پایان کار پس از زیان مشخص در یک روز.

منطق متخصص بازار:
    در firms حرفه‌ای، اگر تریدر در یک روز X% از سرمایه را از دست بدهد،
    سیستم به‌صورت خودکار حساب را برای آن روز قفل می‌کند. این از
    revenge-trading و spiral losses جلوگیری می‌کند.

    "روز" در FX = از rollover تا rollover (تقریباً ۲۲:۰۰ UTC).
    برای سادگی، از UTC midnight استفاده می‌کنیم با امکان تنظیم offset.

ساختار داده در Redis:
    کلید: risk:daily_loss:{YYYY-MM-DD}
    مقدار: hash با فیلدهای:
        - realized_pnl: زیان/سود تحقق‌یافته‌ی روز (دلار)
        - signal_count: تعداد سیگنال صادرشده
        - consecutive_losses: زیان‌های متوالی
        - reset_at_utc: زمان بعدی بازنشانی

این روش atomic است و چندین worker می‌توانند به‌طور همزمان به‌روزرسانی کنند.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional, Protocol


class DailyLossCheckUnavailable(Exception):
    """
    خطای دردسترس‌نبودن وضعیت ریسک روزانه (مثلاً قطع Redis).

    این circuit breaker مالی باید fail-closed باشد: اگر نتوانیم وضعیت
    واقعی روز را بخوانیم/بنویسیم، باید صدور سیگنال رد شود نه اینکه به
    حالت پیش‌فرض صفر برگردیم. لایه‌ی بالادست (guard) این استثناء را
    می‌گیرد و سیگنال را رد می‌کند.
    """


class _RedisLike(Protocol):
    """پروتکل حداقلی برای کلاینت Redis که این ماژول استفاده می‌کند."""

    async def get(self, key: str) -> Optional[str]: ...
    async def set(self, key: str, value: str, **kwargs) -> object: ...
    async def hgetall(self, key: str) -> dict: ...
    async def hset(self, key: str, field: str | None = None,
                   value: str | None = None,
                   mapping: dict | None = None) -> int: ...
    async def expire(self, key: str, seconds: int) -> bool: ...
    async def hincrby(self, key: str, field: str, amount: int = 1) -> int: ...
    async def hincrbyfloat(self, key: str, field: str,
                           amount: float = 1.0) -> float: ...
    async def hsetnx(self, key: str, field: str, value: str) -> int: ...


@dataclass
class DailyLossSnapshot:
    """تصویر فعلی وضعیت ریسک روزانه."""

    date_key: str
    realized_pnl: float
    signal_count: int
    consecutive_losses: int
    is_locked: bool
    reset_at: datetime
    locked_reason: Optional[str] = None


class DailyLossLimit:
    """
    قطع‌کننده‌ی روزانه با پشتیبانی Redis یا حافظه‌ی محلی.

    پیکربندی:
        max_daily_loss_dollar: حداکثر زیان مطلق دلاری در یک روز
        max_daily_loss_pct: حداکثر زیان به‌صورت درصد از موجودی
        max_consecutive_losses: حداکثر زیان‌های متوالی
        max_signals_per_day: حد بالای تعداد سیگنال
        rollover_hour_utc: ساعت روز در UTC برای reset (پیش‌فرض ۲۲:۰۰)
    """

    def __init__(
        self,
        redis_client: Optional[_RedisLike] = None,
        max_daily_loss_dollar: float = 1500.0,
        max_daily_loss_pct: float = 10.0,
        max_consecutive_losses: int = 6,
        max_signals_per_day: int = 120,
        rollover_hour_utc: int = 22,
    ) -> None:
        self._redis = redis_client
        self._max_daily_loss_dollar = max_daily_loss_dollar
        self._max_daily_loss_pct = max_daily_loss_pct
        self._max_consecutive_losses = max_consecutive_losses
        self._max_signals_per_day = max_signals_per_day
        self._rollover_hour_utc = rollover_hour_utc
        # حافظه محلی به‌عنوان fallback اگر Redis نبود (برای تست/dev)
        self._local_store: dict = {}

    # ── کلیدسازی و زمان ─────────────────────────────────

    def _current_period_key(self, now: Optional[datetime] = None) -> str:
        """
        کلید دوره‌ی فعلی.

        دوره از rollover_hour_utc یک روز شروع و به rollover_hour_utc روز بعد ختم می‌شود.
        """
        if now is None:
            now = datetime.now(timezone.utc)
        if now.hour < self._rollover_hour_utc:
            # هنوز در دوره‌ی روز قبل هستیم
            period_start = (now - timedelta(days=1)).replace(
                hour=self._rollover_hour_utc, minute=0, second=0, microsecond=0
            )
        else:
            period_start = now.replace(
                hour=self._rollover_hour_utc, minute=0, second=0, microsecond=0
            )
        return period_start.strftime("risk:daily_loss:%Y-%m-%dT%H")

    def _next_reset(self, now: Optional[datetime] = None) -> datetime:
        if now is None:
            now = datetime.now(timezone.utc)
        if now.hour < self._rollover_hour_utc:
            return now.replace(
                hour=self._rollover_hour_utc, minute=0, second=0, microsecond=0
            )
        return (now + timedelta(days=1)).replace(
            hour=self._rollover_hour_utc, minute=0, second=0, microsecond=0
        )

    # ── خواندن وضعیت ─────────────────────────────────────

    async def snapshot(self, now: Optional[datetime] = None) -> DailyLossSnapshot:
        """دریافت تصویر فعلی روز."""
        key = self._current_period_key(now)
        data = await self._read(key)

        realized = float(data.get("realized_pnl", 0.0) or 0.0)
        sig_count = int(data.get("signal_count", 0) or 0)
        cons_losses = int(data.get("consecutive_losses", 0) or 0)
        locked = bool(int(data.get("is_locked", 0) or 0))
        locked_reason = data.get("locked_reason")

        return DailyLossSnapshot(
            date_key=key,
            realized_pnl=realized,
            signal_count=sig_count,
            consecutive_losses=cons_losses,
            is_locked=locked,
            reset_at=self._next_reset(now),
            locked_reason=locked_reason,
        )

    # ── بررسی اجازه ──────────────────────────────────────

    async def can_emit_signal(
        self,
        account_balance: Optional[float] = None,
        now: Optional[datetime] = None,
    ) -> tuple[bool, Optional[str]]:
        """
        آیا اجازه‌ی صدور سیگنال جدید داریم؟

        خروجی: (allowed, rejection_reason)
        """
        snap = await self.snapshot(now)

        if snap.is_locked:
            return False, snap.locked_reason or "حساب روز برای ریسک قفل شده است."

        if snap.signal_count >= self._max_signals_per_day:
            return False, (
                f"حد سقف سیگنال روزانه ({self._max_signals_per_day}) "
                "رسید — برای جلوگیری از over-trading."
            )

        # غیرلَچ (self-recovering): فقط تا زمانی که زیانِ تحقق‌یافته واقعاً بالای
        # سقف است بلاک می‌کنیم؛ به‌محضِ بهبود (یا اولین برد که شمارنده را صفر می‌کند)
        # خودکار آزاد می‌شود. قبلاً _lock() کلِ روز را قفل می‌کرد و یک باختِ کوچک،
        # سرویسِ سیگنال را تا rollover خفه می‌کرد (باگِ «سیگنال نمی‌آید»).
        if snap.realized_pnl <= -self._max_daily_loss_dollar:
            return False, "حد زیان مطلق روزانه رد شد (تا بهبودِ وضعیت)."

        if account_balance is not None and account_balance > 0:
            loss_pct = abs(snap.realized_pnl) / account_balance * 100.0 \
                       if snap.realized_pnl < 0 else 0.0
            if loss_pct >= self._max_daily_loss_pct:
                return False, (
                    f"حد زیان روزانه ({self._max_daily_loss_pct}% از موجودی) رد شد (تا بهبود)."
                )

        if snap.consecutive_losses >= self._max_consecutive_losses:
            return False, (
                f"{snap.consecutive_losses} زیان متوالی — صدور سیگنال موقتاً متوقف "
                "است (با اولین برد خودکار آزاد می‌شود)."
            )

        return True, None

    # ── ثبت رویدادها ─────────────────────────────────────

    async def record_signal_emitted(self, now: Optional[datetime] = None) -> None:
        """افزایش شمارنده‌ی سیگنال هنگام صدور."""
        key = self._current_period_key(now)
        # افزایش atomic تا race بین workerها (lost update) رخ ندهد.
        await self._hincrby(key, "signal_count", 1)

    async def record_trade_outcome(
        self,
        pnl_dollar: float,
        now: Optional[datetime] = None,
    ) -> None:
        """
        ثبت نتیجه‌ی یک معامله‌ی بسته‌شده.

        - PnL به مجموع روز اضافه می‌شود
        - اگر زیان: consecutive_losses += 1
        - اگر سود: consecutive_losses = 0 (ریست)
        """
        key = self._current_period_key(now)
        # افزایش atomic مجموع PnL تا lost-update تحت همزمانی رخ ندهد.
        await self._hincrbyfloat(key, "realized_pnl", pnl_dollar)
        if pnl_dollar < 0:
            await self._hincrby(key, "consecutive_losses", 1)
        elif pnl_dollar > 0:
            # ریست شمارنده‌ی زیان متوالی روی برد.
            await self._set_field(key, "consecutive_losses", 0)

    async def manual_lock(self, reason: str, now: Optional[datetime] = None) -> None:
        """قفل دستی توسط ادمین."""
        key = self._current_period_key(now)
        await self._lock(key, reason)

    async def manual_unlock(self, now: Optional[datetime] = None) -> None:
        """آزادسازی دستی — فقط ادمین."""
        key = self._current_period_key(now)
        data = await self._read(key)
        data["is_locked"] = 0
        data["locked_reason"] = ""
        await self._write(key, data)

    # ── کمکی‌های داخلی ──────────────────────────────────

    async def _lock(self, key: str, reason: str) -> None:
        # check-and-set اتمی: تنها اولین caller واقعاً قفل می‌کند تا دو
        # caller همزمان از پنجره‌ی TOCTOU بین read و write رد نشوند.
        if self._redis is not None:
            try:
                acquired = await self._redis.hsetnx(key, "is_locked", "1")
                if acquired:
                    await self._redis.hset(key, "locked_reason", reason)
                    await self._redis.expire(key, 28 * 3600)
            except Exception as e:
                raise DailyLossCheckUnavailable(
                    f"daily_loss lock failed: {e}"
                ) from e
            return
        # مسیر حافظه‌ی محلی (تست/dev): تنها در صورت قفل‌نبودن، قفل کن.
        data = dict(self._local_store.get(key, {}))
        if not bool(int(data.get("is_locked", 0) or 0)):
            data["is_locked"] = 1
            data["locked_reason"] = reason
            self._local_store[key] = data

    async def _hincrby(self, key: str, field: str, amount: int) -> None:
        if self._redis is not None:
            try:
                await self._redis.hincrby(key, field, amount)
                await self._redis.expire(key, 28 * 3600)
            except Exception as e:
                raise DailyLossCheckUnavailable(
                    f"daily_loss hincrby failed: {e}"
                ) from e
            return
        data = dict(self._local_store.get(key, {}))
        data[field] = int(data.get(field, 0) or 0) + amount
        self._local_store[key] = data

    async def _hincrbyfloat(self, key: str, field: str, amount: float) -> None:
        if self._redis is not None:
            try:
                await self._redis.hincrbyfloat(key, field, amount)
                await self._redis.expire(key, 28 * 3600)
            except Exception as e:
                raise DailyLossCheckUnavailable(
                    f"daily_loss hincrbyfloat failed: {e}"
                ) from e
            return
        data = dict(self._local_store.get(key, {}))
        data[field] = float(data.get(field, 0.0) or 0.0) + amount
        self._local_store[key] = data

    async def _set_field(self, key: str, field: str, value: object) -> None:
        if self._redis is not None:
            try:
                await self._redis.hset(key, field, str(value))
                await self._redis.expire(key, 28 * 3600)
            except Exception as e:
                raise DailyLossCheckUnavailable(
                    f"daily_loss set_field failed: {e}"
                ) from e
            return
        data = dict(self._local_store.get(key, {}))
        data[field] = value
        self._local_store[key] = data

    async def _read(self, key: str) -> dict:
        if self._redis is not None:
            # fail-closed: اگر Redis در دسترس نباشد، نباید به وضعیت صفرِ
            # حافظه‌ی محلی برگردیم (که circuit breaker را خنثی می‌کند).
            try:
                raw = await self._redis.hgetall(key)
            except Exception as e:
                raise DailyLossCheckUnavailable(
                    f"daily_loss read failed: {e}"
                ) from e
            return dict(raw or {})
        return dict(self._local_store.get(key, {}))

    async def _write(self, key: str, data: dict) -> None:
        # تبدیل به str برای Redis hash
        normalized = {k: str(v) for k, v in data.items()}
        if self._redis is not None:
            # fail-closed: خطای نوشتن نباید بی‌صدا به حافظه‌ی محلی fallback شود.
            try:
                await self._redis.hset(key, mapping=normalized)
                # TTL = ۲۸ ساعت (یک دوره + مارجین)
                await self._redis.expire(key, 28 * 3600)
            except Exception as e:
                raise DailyLossCheckUnavailable(
                    f"daily_loss write failed: {e}"
                ) from e
            return
        self._local_store[key] = data
