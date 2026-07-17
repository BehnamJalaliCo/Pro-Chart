"""تست منطق پلن اشتراک — قیمت، مدت و محاسبه‌ی انقضا."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from src.bot.services import subscription as sub
from src.core.config import settings


def test_plan_prices_from_settings():
    assert sub.plan_price("monthly") == settings.SUB_PRICE_MONTHLY
    assert sub.plan_price("quarterly") == settings.SUB_PRICE_QUARTERLY
    assert sub.plan_price("biannual") == settings.SUB_PRICE_BIANNUAL
    assert sub.plan_price("trial") == 0
    assert sub.plan_price("unknown") == 0


@pytest.mark.parametrize("plan,days", [("monthly", 30), ("quarterly", 90), ("biannual", 180)])
def test_plan_days(plan, days):
    assert sub.plan_days(plan) == days


def test_is_paid_plan():
    assert sub.is_paid_plan("monthly") is True
    assert sub.is_paid_plan("trial") is False


def test_trial_expiry_uses_trial_hours():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert sub.trial_expiry(start) == start + timedelta(hours=settings.TRIAL_HOURS)


def test_compute_expiry_fresh_monthly():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert sub.compute_expiry("monthly", None, now) == now + timedelta(days=30)


def test_compute_expiry_trial():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert sub.compute_expiry("trial", None, now) == now + timedelta(hours=settings.TRIAL_HOURS)


def test_renewal_extends_from_current_expiry_not_now():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    current = now + timedelta(days=10)  # هنوز ۱۰ روز مانده
    # تمدید ماهیانه باید از current باشد، نه از now
    assert sub.compute_expiry("monthly", current, now) == current + timedelta(days=30)


def test_renewal_from_now_when_already_expired():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    expired = now - timedelta(days=5)
    assert sub.compute_expiry("monthly", expired, now) == now + timedelta(days=30)


def test_plan_label():
    assert sub.plan_label("trial") == "آزمایشی رایگان"
    assert sub.plan_label("monthly") == "ماهیانه"
