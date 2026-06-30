"""منطق پلن‌های اشتراک — قیمت، مدت و محاسبه‌ی تاریخ انقضا. خالص و قابل‌تست."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from src.core.config import settings

# مدت هر پلن بر حسب روز
PLAN_DAYS: dict[str, int] = {
    "monthly": 30,
    "quarterly": 90,
    "biannual": 180,
}

# برچسب فارسی پلن‌ها
PLAN_LABELS: dict[str, str] = {
    "trial": "آزمایشی رایگان",
    "monthly": "ماهیانه",
    "quarterly": "سه‌ماهه",
    "biannual": "شش‌ماهه",
    "free_lifetime": "رایگانِ همیشگی",
    "referral_3m": "هدیهٔ معرفی (۳ ماه)",
}


def plan_price(plan: str) -> int:
    """قیمت پلن (USDT) — از تنظیمات خوانده می‌شود."""
    return {
        "monthly": settings.SUB_PRICE_MONTHLY,
        "quarterly": settings.SUB_PRICE_QUARTERLY,
        "biannual": settings.SUB_PRICE_BIANNUAL,
    }.get(plan, 0)


def plan_days(plan: str) -> int:
    """مدت پلن بر حسب روز (trial بر اساس TRIAL_HOURS محاسبه می‌شود)."""
    return PLAN_DAYS.get(plan, 0)


def plan_label(plan: str) -> str:
    return PLAN_LABELS.get(plan, plan)


def is_paid_plan(plan: str) -> bool:
    return plan in PLAN_DAYS


def trial_expiry(start: datetime | None = None) -> datetime:
    """تاریخ پایان دوره‌ی آزمایشی = شروع + TRIAL_HOURS ساعت."""
    base = start or datetime.now(timezone.utc)
    return base + timedelta(hours=settings.TRIAL_HOURS)


def compute_expiry(plan: str, current_expiry: datetime | None = None,
                   now: datetime | None = None) -> datetime:
    """محاسبه‌ی تاریخ انقضای جدید.

    اگر اشتراک فعالی هنوز منقضی نشده باشد، تمدید از روی expiry فعلی انجام
    می‌شود (نه از now) تا روزهای باقی‌مانده از بین نرود.
    """
    now = now or datetime.now(timezone.utc)
    if plan == "trial":
        return trial_expiry(now)
    days = plan_days(plan)
    base = current_expiry if (current_expiry and current_expiry > now) else now
    return base + timedelta(days=days)
