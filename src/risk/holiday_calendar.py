"""
تقویم تعطیلات بازار FX و بازارهای مرتبط.

منطق متخصص بازار:
    در تعطیلات اصلی، بازار FX کاهش liquidity شدید دارد. اسپرد بالا می‌رود،
    قیمت‌ها gap می‌خورند، و سیگنال‌های normal-time قابل اطمینان نیستند.

    تعطیلات کلیدی:
        - Christmas (25 Dec): تمام بازارها بسته
        - New Year (1 Jan): تمام بازارها بسته
        - Good Friday (متغیر): UK + US بسته
        - Easter Monday: UK + EU بسته
        - US holidays: Thanksgiving (پنجشنبه‌ی چهارم نوامبر), July 4, MLK day, …
        - JP holidays: Golden Week (اواخر آپریل/اوایل می), …

این ماژول تعطیلات اصلی را پوشش می‌دهد. تعطیلات جزئی‌تر را در صورت
نیاز اضافه کنید. تمام تاریخ‌ها در UTC هستند.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from typing import Optional


class HolidayImpact(str, Enum):
    """شدت تأثیر تعطیلات."""

    FULL_CLOSURE = "full_closure"      # تمام بازارها بسته
    PARTIAL = "partial"                # برخی بازارها بسته (مثلاً فقط US)
    LOW_LIQUIDITY = "low_liquidity"    # بازارها باز ولی thin


@dataclass(frozen=True)
class Holiday:
    """یک رویداد تعطیلات."""

    name: str
    impact: HolidayImpact
    affected_markets: tuple[str, ...]  # ("US", "UK", "EU", "JP", "ALL")


def _easter_sunday(year: int) -> date:
    """
    محاسبه‌ی Easter Sunday با الگوریتم Meeus/Jones/Butcher.

    این الگوریتم Easter را برای تقویم Gregorian به‌درستی محاسبه می‌کند.
    """
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    el = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * el) // 451
    month = (h + el - 7 * m + 114) // 31
    day = ((h + el - 7 * m + 114) % 31) + 1
    return date(year, month, day)


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """nامین weekday یک ماه (weekday: 0=دوشنبه، 6=یکشنبه)."""
    d = date(year, month, 1)
    while d.weekday() != weekday:
        d += timedelta(days=1)
    return d + timedelta(weeks=n - 1)


def _last_weekday(year: int, month: int, weekday: int) -> date:
    """آخرین weekday یک ماه."""
    d = date(year, month, 28)
    while d.month == month:
        d += timedelta(days=1)
    d -= timedelta(days=1)
    while d.weekday() != weekday:
        d -= timedelta(days=1)
    return d


def _is_observed_for(target: date, month: int, day: int) -> bool:
    """
    آیا target روزِ «observed» تعطیلیِ fixed-date (month, day) است؟

    قاعده‌ی استاندارد US: اگر تعطیلی روی شنبه بیفتد، جمعه‌ی قبل observed است؛
    اگر روی یکشنبه بیفتد، دوشنبه‌ی بعد observed است.
    """
    holiday = date(target.year, month, day)
    if holiday.weekday() == 5:  # شنبه → جمعه‌ی قبل
        return target == holiday - timedelta(days=1)
    if holiday.weekday() == 6:  # یکشنبه → دوشنبه‌ی بعد
        return target == holiday + timedelta(days=1)
    return False


def get_holiday(target: date) -> Optional[Holiday]:
    """
    آیا تاریخ مشخصی تعطیلات است؟

    خروجی: شیء Holiday اگر تعطیلات باشد، None اگر روز عادی.
    """
    year = target.year
    md = (target.month, target.day)

    # ── تعطیلات سالانه‌ی fixed-date ──
    if md == (1, 1):
        return Holiday("New Year's Day", HolidayImpact.FULL_CLOSURE, ("ALL",))
    # New Year observed: اگر 1 ژانویه شنبه باشد → جمعه (31 Dec)، اگر یکشنبه → دوشنبه (2 Jan).
    if _is_observed_for(target, 1, 1):
        return Holiday("New Year's Day (observed)", HolidayImpact.FULL_CLOSURE, ("ALL",))
    if md == (12, 25):
        return Holiday("Christmas Day", HolidayImpact.FULL_CLOSURE, ("ALL",))
    if md == (12, 26):
        return Holiday("Boxing Day", HolidayImpact.PARTIAL, ("UK", "EU", "AU"))
    if md == (12, 24):
        return Holiday("Christmas Eve", HolidayImpact.LOW_LIQUIDITY, ("ALL",))
    if md == (12, 31):
        return Holiday("New Year's Eve", HolidayImpact.LOW_LIQUIDITY, ("ALL",))

    # ── US holidays ──
    if md == (7, 4):
        return Holiday("US Independence Day", HolidayImpact.PARTIAL, ("US",))
    # Independence Day observed: شنبه → جمعه (3 Jul)، یکشنبه → دوشنبه (5 Jul).
    if _is_observed_for(target, 7, 4):
        return Holiday("US Independence Day (observed)", HolidayImpact.PARTIAL, ("US",))
    # MLK Day: یکشنبه‌ی سوم ژانویه (weekday=0 یعنی دوشنبه)
    if target == _nth_weekday(year, 1, 0, 3):
        return Holiday("MLK Day", HolidayImpact.PARTIAL, ("US",))
    # Presidents Day: دوشنبه‌ی سوم فوریه
    if target == _nth_weekday(year, 2, 0, 3):
        return Holiday("Presidents Day", HolidayImpact.PARTIAL, ("US",))
    # Memorial Day: آخرین دوشنبه‌ی می
    if target == _last_weekday(year, 5, 0):
        return Holiday("Memorial Day", HolidayImpact.PARTIAL, ("US",))
    # Labor Day: دوشنبه‌ی اول سپتامبر
    if target == _nth_weekday(year, 9, 0, 1):
        return Holiday("Labor Day", HolidayImpact.PARTIAL, ("US",))
    # Thanksgiving: پنجشنبه‌ی چهارم نوامبر (weekday=3)
    if target == _nth_weekday(year, 11, 3, 4):
        return Holiday("Thanksgiving", HolidayImpact.PARTIAL, ("US",))

    # ── Easter-related ──
    easter = _easter_sunday(year)
    good_friday = easter - timedelta(days=2)
    easter_monday = easter + timedelta(days=1)
    if target == good_friday:
        # Good Friday: FX spot همچنان معامله می‌شود؛ فقط liquidity کاهش می‌یابد.
        return Holiday("Good Friday", HolidayImpact.PARTIAL, ("UK", "US", "EU"))
    if target == easter_monday:
        return Holiday("Easter Monday", HolidayImpact.PARTIAL, ("UK", "EU"))

    return None


def is_holiday_blackout(now: Optional[datetime] = None) -> tuple[bool, Optional[str]]:
    """
    آیا الان در blackout تعطیلات هستیم؟

    خروجی: (is_blackout, reason).

    منطق:
        - FULL_CLOSURE: همیشه block (تمام ۲۴ ساعت)
        - PARTIAL: block فقط در حین session‌های متأثر (~13:00–22:00 UTC؛
          US/EU overlap). خارج از این بازه بازارهای Asia/Sydney باز هستند.
        - LOW_LIQUIDITY: block فقط در حین low-liquidity hours (~13:00–22:00 UTC).
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError(
            "is_holiday_blackout نیازمند datetime آگاه از timezone (aware) است؛ "
            "datetime ساده (naive) پذیرفته نمی‌شود."
        )
    today_holiday = get_holiday(now.date())
    if today_holiday is None:
        return False, None

    if today_holiday.impact == HolidayImpact.FULL_CLOSURE:
        return True, f"تعطیلات {today_holiday.name} — بازار FX بسته است."

    # بازه‌ی US/EU session (UTC). خارج از آن، تعطیلیِ US-only تأثیر کمی دارد.
    in_affected_hours = 13 <= now.hour < 22

    if today_holiday.impact == HolidayImpact.PARTIAL:
        if not in_affected_hours:
            return False, None
        markets = ", ".join(today_holiday.affected_markets)
        return True, (
            f"تعطیلات {today_holiday.name} — بازار {markets} بسته، "
            "liquidity پایین."
        )

    if today_holiday.impact == HolidayImpact.LOW_LIQUIDITY:
        if not in_affected_hours:
            return False, None
        return True, (
            f"{today_holiday.name} — liquidity بسیار کم در بازار، spread بالا."
        )

    return False, None
