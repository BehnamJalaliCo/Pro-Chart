"""اعتبارسنجی و نرمال‌سازی شماره موبایل ایران — منطق خالص و قابل‌تست."""

from __future__ import annotations

import re

# ارقام فارسی/عربی → لاتین
_DIGIT_MAP = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def _to_latin_digits(s: str) -> str:
    return s.translate(_DIGIT_MAP)


def normalize_iran(raw: str) -> str | None:
    """نرمال‌سازی شماره موبایل ایران به فرم استاندارد «09XXXXXXXXX».

    ورودی‌های پذیرفته‌شده (با/بدون فاصله، خط تیره، +):
      +989121234567 / 00989121234567 / 989121234567 / 09121234567 / 9121234567
    در صورت نامعتبر بودن None برمی‌گرداند.
    """
    if not raw:
        return None
    s = _to_latin_digits(raw).strip()
    # حذف هر چیزی جز رقم و +
    s = re.sub(r"[\s\-()]", "", s)
    # یکدست‌سازی پیشوند بین‌المللی به فرم ملی
    if s.startswith("+98"):
        s = "0" + s[3:]
    elif s.startswith("0098"):
        s = "0" + s[4:]
    elif s.startswith("98") and len(s) == 12:
        s = "0" + s[2:]
    elif s.startswith("9") and len(s) == 10:
        s = "0" + s
    # حالا باید دقیقاً 09 + ۹ رقم باشد و رقم سوم در 0..9 (اپراتورهای 091/092/093/099 و ...)
    if re.fullmatch(r"09\d{9}", s):
        return s
    return None


def is_valid_iran(raw: str) -> bool:
    """آیا شماره موبایل ایران معتبر است؟"""
    return normalize_iran(raw) is not None
