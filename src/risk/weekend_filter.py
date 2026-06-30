"""
فیلتر آخر هفته — جلوگیری از گپ‌های آخر هفته.

منطق متخصص بازار:
    بازار FX جمعه ۲۱:۰۰-۲۲:۰۰ UTC تعطیل می‌شود و یکشنبه ۲۱:۰۰-۲۲:۰۰ UTC
    باز می‌گردد. در این فاصله:
        - معامله‌ی باز در معرض گپ‌های ۵۰-۲۰۰ پیپی است (NFP جمعه شب، اخبار اخر هفته)
        - SL ممکن است بدون اجرا "skip" شود → ضرر بزرگتر از انتظار

    پس:
        - از جمعه ۲۰:۰۰ UTC به بعد: سیگنال جدید صادر نشود
            (به جز اگر TP بسیار نزدیک باشد که در همان ۱ ساعت hit شود)
        - یکشنبه قبل از ۲۲:۰۰ UTC: بازار به‌طور رسمی باز نیست
        - شنبه: کاملاً بسته

    این محدودیت‌ها قابل تنظیم هستند چون بعضی بروکرها ساعات کمی متفاوت دارند.
"""

from __future__ import annotations

from datetime import datetime, time, timezone
from typing import Optional


# ── پنجره‌های blackout (به UTC) ────────────────────────────
# جمعه از ۲۰:۰۰ به بعد
_FRIDAY_BLACKOUT_FROM: time = time(20, 0)

# یکشنبه قبل از ۲۲:۰۰
_SUNDAY_BLACKOUT_UNTIL: time = time(22, 0)


def is_weekend_blackout(now: Optional[datetime] = None) -> tuple[bool, Optional[str]]:
    """
    آیا الان داخل blackout آخر هفته هستیم؟

    خروجی: (is_blackout, reason)
    """
    if now is None:
        now = datetime.now(timezone.utc)
    weekday = now.weekday()  # 0=دوشنبه ... 6=یکشنبه
    t = now.timetz().replace(tzinfo=None)

    # جمعه شب
    if weekday == 4 and t >= _FRIDAY_BLACKOUT_FROM:
        return True, (
            "جمعه پس از 20:00 UTC — ریسک گپ آخر هفته بالا، سیگنال جدید رد می‌شود."
        )

    # شنبه — کاملاً بسته
    if weekday == 5:
        return True, "شنبه — بازار FX بسته است."

    # یکشنبه قبل از باز شدن
    if weekday == 6 and t < _SUNDAY_BLACKOUT_UNTIL:
        return True, (
            "یکشنبه قبل از 22:00 UTC — بازار هنوز کاملاً باز نیست، "
            "اسپرد بالا و liquidity کم."
        )

    return False, None
