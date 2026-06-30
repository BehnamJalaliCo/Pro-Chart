"""تست نرمال‌سازی و اعتبارسنجی شماره موبایل ایران."""

from __future__ import annotations

import pytest

from src.bot.services import phone


@pytest.mark.parametrize("raw", [
    "09121234567",
    "+989121234567",
    "00989121234567",
    "989121234567",
    "9121234567",
    "0912 123 4567",
    "0912-123-4567",
    "۰۹۱۲۱۲۳۴۵۶۷",  # ارقام فارسی
])
def test_valid_numbers_normalize_to_canonical(raw):
    assert phone.normalize_iran(raw) == "09121234567"


@pytest.mark.parametrize("raw", [
    "",
    "12345",
    "0812123456",       # کد غیرموبایل
    "081234567890",
    "+1202555019",      # غیرایران
    "0912abc4567",      # حروف
    "0912123456",       # یک رقم کم
    "091212345678",     # یک رقم زیاد
])
def test_invalid_numbers_return_none(raw):
    assert phone.normalize_iran(raw) is None


def test_is_valid_helper():
    assert phone.is_valid_iran("09121234567") is True
    assert phone.is_valid_iran("nope") is False
