"""
فیلتر session — اطمینان از معامله در ساعات liquid مناسب هر نماد.

منطق متخصص بازار:
    - JPY pairs: بهترین liquidity در Tokyo + early London
    - EUR/GBP: London + همپوشانی London-NY
    - USD majors: London-NY overlap (۱۳:۰۰-۱۶:۰۰ UTC) بهترین حالت
    - XAUUSD: London + NY (در Asian session نوسان کم است)
    - US indices: ساعات بازار NY (۱۳:۳۰-۲۰:۰۰ UTC)
    - DE40: ساعات بازار Frankfurt (۰۸:۰۰-۱۶:۳۰ UTC)

DST handling:
    UK/EU: شنبه‌ی آخر مارس → یکشنبه‌ی آخر اکتبر (BST/CEST = UTC+1)
    US: یکشنبه‌ی دوم مارس → یکشنبه‌ی اول نوامبر (EDT = UTC-4)

    در DST، session های آن منطقه ۱ ساعت زودتر در UTC شروع می‌شوند.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from typing import Dict, FrozenSet, Optional, Set


class Session(str, Enum):
    """session های اصلی بازار FX."""

    SYDNEY = "sydney"
    TOKYO = "tokyo"
    LONDON = "london"
    NEW_YORK = "new_york"
    FRANKFURT = "frankfurt"


# ── ساعات هر session — winter time (UTC ثابت) ───────────────
_WINTER_SESSION_HOURS: Dict[Session, tuple[time, time]] = {
    Session.SYDNEY:    (time(22, 0), time(6, 0)),
    Session.TOKYO:     (time(0, 0),  time(9, 0)),    # Japan ندارد DST
    Session.FRANKFURT: (time(7, 0),  time(15, 30)),
    Session.LONDON:    (time(8, 0),  time(16, 0)),
    Session.NEW_YORK:  (time(13, 0), time(21, 0)),
}

# ── ساعات هر session — summer time (DST) ────────────────────
# UK/EU/US همگی ۱ ساعت زودتر در UTC.
# Japan و Australia DST خود را دارند (Australia شیفت معکوس)
_SUMMER_SESSION_HOURS: Dict[Session, tuple[time, time]] = {
    Session.SYDNEY:    (time(21, 0), time(5, 0)),    # AEDT
    Session.TOKYO:     (time(0, 0),  time(9, 0)),
    Session.FRANKFURT: (time(6, 0),  time(14, 30)),  # CEST
    Session.LONDON:    (time(7, 0),  time(15, 0)),   # BST
    Session.NEW_YORK:  (time(12, 0), time(20, 0)),   # EDT
}

_LOW_LIQUIDITY_WINDOW: tuple[time, time] = (time(21, 0), time(22, 0))


# ── منطق DST ──────────────────────────────────────────────

def _last_sunday(year: int, month: int) -> date:
    """آخرین یکشنبه‌ی یک ماه."""
    d = date(year, month, 28)  # ۲۸ همیشه در ماه است
    while d.month == month:
        d += timedelta(days=1)
    d -= timedelta(days=1)
    while d.weekday() != 6:  # 6 = Sunday
        d -= timedelta(days=1)
    return d


def _nth_sunday(year: int, month: int, n: int) -> date:
    """nامین یکشنبه‌ی یک ماه (n از ۱ شروع می‌شود)."""
    d = date(year, month, 1)
    while d.weekday() != 6:
        d += timedelta(days=1)
    return d + timedelta(weeks=n - 1)


def is_eu_dst(dt: datetime) -> bool:
    """آیا تاریخ در DST اروپایی (UK + EU) است؟"""
    year = dt.year
    start = _last_sunday(year, 3)   # آخرین یکشنبه مارس
    end = _last_sunday(year, 10)    # آخرین یکشنبه اکتبر
    today = dt.date()
    return start <= today < end


def is_us_dst(dt: datetime) -> bool:
    """آیا تاریخ در DST آمریکا است؟"""
    year = dt.year
    start = _nth_sunday(year, 3, 2)  # یکشنبه‌ی دوم مارس
    end = _nth_sunday(year, 11, 1)   # یکشنبه‌ی اول نوامبر
    today = dt.date()
    return start <= today < end


def is_au_dst(dt: datetime) -> bool:
    """آیا تاریخ در DST استرالیا (سیدنی) است؟

    سیدنی نیمکره‌ی جنوبی است؛ AEDT (UTC+11) از یکشنبه‌ی اول اکتبر تا یکشنبه‌ی
    اول آوریل (تابستان جنوبی = زمستان اروپا) فعال است — یعنی دقیقاً برعکس DST
    اروپا. استفاده از is_eu_dst برای سیدنی یک باگ بود (یک‌ساعت خطا در کل سال).
    """
    year = dt.year
    start = _nth_sunday(year, 10, 1)  # شروع AEDT (یکشنبه‌ی اول اکتبر)
    end = _nth_sunday(year, 4, 1)     # پایان AEDT (یکشنبه‌ی اول آوریل)
    today = dt.date()
    return today >= start or today < end  # wrap دور مرز سال


def _get_session_hours(now: datetime) -> Dict[Session, tuple[time, time]]:
    """
    دریافت ساعات session متناسب با DST.

    در دوره‌ی غیر-symmetric (مثلاً اوایل مارس که UK هنوز DST ندارد
    ولی US رفته یا برعکس)، ما هر session را independently چک می‌کنیم.
    """
    eu_dst = is_eu_dst(now)
    us_dst = is_us_dst(now)

    return {
        Session.SYDNEY: (
            # سیدنی نیمکره‌ی جنوبی — DST برعکس اروپا (Oct→Apr). جدول «summer»
            # برابر AEDT (21:00–05:00) است که در دوره‌ی AU-DST اعمال می‌شود.
            _SUMMER_SESSION_HOURS[Session.SYDNEY]
            if is_au_dst(now) else _WINTER_SESSION_HOURS[Session.SYDNEY]
        ),
        Session.TOKYO: _WINTER_SESSION_HOURS[Session.TOKYO],  # Japan بدون DST
        Session.FRANKFURT: (
            _SUMMER_SESSION_HOURS[Session.FRANKFURT]
            if eu_dst else _WINTER_SESSION_HOURS[Session.FRANKFURT]
        ),
        Session.LONDON: (
            _SUMMER_SESSION_HOURS[Session.LONDON]
            if eu_dst else _WINTER_SESSION_HOURS[Session.LONDON]
        ),
        Session.NEW_YORK: (
            _SUMMER_SESSION_HOURS[Session.NEW_YORK]
            if us_dst else _WINTER_SESSION_HOURS[Session.NEW_YORK]
        ),
    }


# alias قدیمی — برای backward compatibility
_SESSION_HOURS = _WINTER_SESSION_HOURS


@dataclass(frozen=True)
class SymbolSessionPolicy:
    """نمایش session‌های مجاز یک نماد."""

    symbol: str
    allowed_sessions: FrozenSet[Session]
    preferred_overlap: bool = False
    # ↑ اگر True، فقط در overlap لندن-نیویورک معامله شود


# ── policy های پیش‌فرض per-symbol ──────────────────────────
# پوشش کامل هر ۵ سشن (نتیجه‌ی ممیزی ۴۹ ایجنت متخصص نقدینگی/کوانت).
# اصل: هر نماد در سشن‌هایی مجاز است که نقدینگی واقعیِ قابل‌معامله دارد —
# نه باز کردن سشنی که نقدینگی‌اش ساختگی است (که کیفیت/اسپرد را خراب می‌کند).
# سیدنی فقط به نمادهای جریان واقعیِ آسیا-اقیانوسیه (AUD) افزوده شد تا منطقه‌ی
# مرده‌ی ۲۲:۰۰–۰۰:۰۰ UTC بسته شود. فرانکفورت پلِ زودهنگام اروپا برای majors/فلزات.
_POLICIES: Dict[str, SymbolSessionPolicy] = {
    # Majors → Frankfurt (پل اروپا) + London + NY
    "EURUSD": SymbolSessionPolicy(
        "EURUSD", frozenset({Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "GBPUSD": SymbolSessionPolicy(
        "GBPUSD", frozenset({Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "USDCHF": SymbolSessionPolicy(
        "USDCHF", frozenset({Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "USDCAD": SymbolSessionPolicy(
        "USDCAD", frozenset({Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    # Commodity currencies — AUD جریان واقعیِ سیدنی دارد؛ NZD از توکیو شروع می‌شود
    "AUDUSD": SymbolSessionPolicy(
        "AUDUSD", frozenset({Session.SYDNEY, Session.TOKYO, Session.LONDON, Session.NEW_YORK})
    ),
    "NZDUSD": SymbolSessionPolicy(
        "NZDUSD", frozenset({Session.TOKYO, Session.LONDON, Session.NEW_YORK})
    ),
    # JPY pairs → Tokyo + Frankfurt/London/NY (نقدینگی دو-لگه)
    "USDJPY": SymbolSessionPolicy(
        "USDJPY", frozenset({Session.TOKYO, Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "EURJPY": SymbolSessionPolicy(
        "EURJPY", frozenset({Session.TOKYO, Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "GBPJPY": SymbolSessionPolicy(
        "GBPJPY", frozenset({Session.TOKYO, Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "AUDJPY": SymbolSessionPolicy(
        "AUDJPY", frozenset({Session.SYDNEY, Session.TOKYO, Session.LONDON})
    ),
    # Crosses
    "EURGBP": SymbolSessionPolicy(
        "EURGBP", frozenset({Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "EURAUD": SymbolSessionPolicy(
        "EURAUD", frozenset({Session.SYDNEY, Session.TOKYO, Session.FRANKFURT, Session.LONDON})
    ),
    # Metals → Frankfurt + London (LBMA) + NY (COMEX)
    "XAUUSD": SymbolSessionPolicy(
        "XAUUSD", frozenset({Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "XAGUSD": SymbolSessionPolicy(
        "XAGUSD", frozenset({Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    # Energy — WTI: ICE London + NYMEX؛ NatGas: فقط London/NY (بنچمارک US)
    "XTIUSD": SymbolSessionPolicy(
        "XTIUSD", frozenset({Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})
    ),
    "XNGUSD": SymbolSessionPolicy(
        "XNGUSD", frozenset({Session.LONDON, Session.NEW_YORK})
    ),
    # US/EU Indices — محصولاتِ CFD/فیوچرزِ نزدیک به ۲۴ساعته‌اند و در سشنِ شبانهٔ
    # آسیا (سیدنی/توکیو/گلوبکس) هم نقدشونده‌اند. قبلاً فقط سشن‌های اروپا/US مجاز بود
    # که فضای مردهٔ ۲۰:۰۰–۰۶:۰۰ UTC (~۴۲٪ روز) می‌ساخت و سیگنال‌ها را رد می‌کرد.
    # پنجرهٔ نازکِ ۲۰:۰۰–۲۲:۰۰ هنوز با گیتِ مجزای is_low_liquidity_window محافظت می‌شود.
    "US30":   SymbolSessionPolicy("US30",   frozenset({Session.SYDNEY, Session.TOKYO, Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})),
    "US500":  SymbolSessionPolicy("US500",  frozenset({Session.SYDNEY, Session.TOKYO, Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})),
    "NAS100": SymbolSessionPolicy("NAS100", frozenset({Session.SYDNEY, Session.TOKYO, Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})),
    "DE40":   SymbolSessionPolicy("DE40",   frozenset({Session.SYDNEY, Session.TOKYO, Session.FRANKFURT, Session.LONDON, Session.NEW_YORK})),
}


def _in_window(now_utc_time: time, start: time, end: time) -> bool:
    """بررسی اینکه زمان داخل بازه‌ی [start, end) است (با پشتیبانی wrap-around)."""
    if start <= end:
        return start <= now_utc_time < end
    # wrap-around (مثلاً Sydney: 22:00 - 06:00)
    return now_utc_time >= start or now_utc_time < end


def current_sessions(now: Optional[datetime] = None) -> Set[Session]:
    """مجموعه‌ی session های فعال در لحظه — با DST handling."""
    if now is None:
        now = datetime.now(timezone.utc)
    t = now.timetz().replace(tzinfo=None)
    hours = _get_session_hours(now)
    active = set()
    for session, (start, end) in hours.items():
        if _in_window(t, start, end):
            active.add(session)
    return active


def is_low_liquidity_window(now: Optional[datetime] = None) -> bool:
    """آیا الان پنجره‌ی کم‌نقدینگی بلافاصله پس از بسته‌شدن NY است؟ (DST-aware).

    قبلاً ثابت ۲۱:۰۰–۲۲:۰۰ بود (فقط زمستان درست). در تابستان NY ساعت ۲۰:۰۰
    بسته می‌شود و این باعث یک حفره‌ی ۲۰:۰۰–۲۱:۰۰ می‌شد که در آن هیچ سشنی فعال
    نبود و نمادهای NY-only با دلیلِ غلط «خارج از سشن» رد می‌شدند. حالا پنجره
    به ساعتِ واقعیِ بسته‌شدن NY گره خورده است (۲۰:۰۰ تابستان / ۲۱:۰۰ زمستان).
    """
    if now is None:
        now = datetime.now(timezone.utc)
    t = now.timetz().replace(tzinfo=None)
    hours = _get_session_hours(now)
    ny_end = hours[Session.NEW_YORK][1]       # 20:00 تابستان / 21:00 زمستان
    sydney_start = hours[Session.SYDNEY][0]   # 22:00 AEST / 21:00 AEDT
    if ny_end == sydney_start:
        return False  # بدون شکاف (زمستان: NY و سیدنی هر دو 21:00)
    return _in_window(t, ny_end, sydney_start)


def get_policy(symbol: str) -> Optional[SymbolSessionPolicy]:
    """policy یک نماد یا None اگر تعریف نشده."""
    return _POLICIES.get(symbol)


def is_session_allowed(
    symbol: str,
    now: Optional[datetime] = None,
    strict_unknown: bool = False,
) -> tuple[bool, Optional[str]]:
    """
    آیا الان زمان مجاز برای معامله‌ی این نماد است؟

    پارامترها:
        symbol: نماد
        now: زمان مرجع (پیش‌فرض الان UTC)
        strict_unknown: اگر True و نماد policy نداشت، رد می‌شود.
            پیش‌فرض False → اجازه می‌دهد.

    خروجی: (allowed, reason_if_rejected)
    """
    if now is None:
        now = datetime.now(timezone.utc)

    if is_low_liquidity_window(now):
        # پیشوند ماشین‌خوان تا guard این را با RejectionReason.LOW_LIQUIDITY
        # برچسب بزند نه SESSION_NOT_ALLOWED (اصلاح metric/observability).
        return False, "low_liquidity_window: پنجره‌ی پس از پایان NY — اسپرد بالا و نوسان کم."

    policy = get_policy(symbol)
    if policy is None:
        if strict_unknown:
            return False, f"policy session برای {symbol} تعریف نشده."
        return True, None

    active = current_sessions(now)
    overlap = policy.allowed_sessions & active
    if not overlap:
        return False, (
            f"خارج از session مجاز {symbol}. "
            f"sessions مجاز: {sorted(s.value for s in policy.allowed_sessions)}، "
            f"فعال الان: {sorted(s.value for s in active) or '(هیچ‌کدام)'}"
        )

    # اگر preferred_overlap=True، فقط در همپوشانی London+NY مجاز است
    if policy.preferred_overlap:
        if Session.LONDON not in active or Session.NEW_YORK not in active:
            return False, (
                f"{symbol} ترجیحاً فقط در همپوشانی London-NY معامله شود."
            )

    return True, None
