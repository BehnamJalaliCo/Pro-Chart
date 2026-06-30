"""Snapshot زندهٔ بازار برای دستیارِ هوش مصنوعی.

از کندل‌های ذخیره‌شدهٔ فید (TimescaleDB) یک خلاصهٔ فشردهٔ «وضعیتِ هم‌اکنونِ بازار»
برای **کلِ نمادهای تحتِ پوششِ ربات** (settings.SYMBOLS — همان نمادهایی که روی‌شان
سیگنال می‌دهد) می‌سازد: قیمتِ فعلی (آخرین M15) + تغییرِ روزانه (نسبت به بستهٔ روزِ
کاریِ قبل) + زمان و سشن‌های فعال. در نبودِ داده None (fail-soft).
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import text

from src.core.config import settings
from src.core.database import async_session_factory
from src.core.logger import get_logger

logger = get_logger("bot.services.market_data")

# کلیدواژه‌های نشان‌دهندهٔ نیاز به دادهٔ زنده (وگرنه snapshot تزریق نمی‌شود)
_TRIGGER_WORDS = (
    "بازار", "قیمت", "نرخ", "امروز", "الان", "الآن", "اکنون", "وضعیت", "چنده",
    "چقدر", "چند", "طلا", "انس", "دلار", "یورو", "پوند", "ین", "فرانک", "نفت",
    "شاخص", "بورس", "داو", "نزدک", "نزدَک", "روند", "حرکت", "صعود", "نزول", "رنج",
    "سیگنال", "نماد",
)


def needs_market_data(question: str) -> bool:
    """آیا پرسش به دادهٔ زندهٔ بازار نیاز دارد؟ (کلیدواژه یا تیکرِ نماد)."""
    q = question or ""
    up = q.upper()
    if any(w in q for w in _TRIGGER_WORDS):
        return True
    return any(sym in up for sym in settings.SYMBOLS)


def _fmt_price(p: float) -> str:
    if p >= 1000:
        return f"{p:,.1f}"
    if p >= 10:
        return f"{p:.3f}"
    return f"{p:.5f}"


def _active_sessions(hour_utc: int) -> str:
    s = []
    if 22 <= hour_utc or hour_utc < 7:
        s.append("سیدنی")
    if hour_utc < 9:  # توکیو ~ 00–09 UTC
        s.append("توکیو")
    if 8 <= hour_utc < 17:
        s.append("لندن")
    if 13 <= hour_utc < 22:
        s.append("نیویورک")
    return "، ".join(s) if s else "بازارِ کم‌رمق (بینِ سشن‌ها)"


async def build_market_snapshot() -> str | None:
    """خلاصهٔ فشردهٔ وضعیتِ بازار، فقط برای نمادهایی که سیگنال می‌شوند؛ None اگر داده‌ای نباشد."""
    # کلِ نمادهای تحتِ پوششِ ربات (همان نمادهایی که روی‌شان سیگنال می‌دهد)
    symbols = list(settings.SYMBOLS)
    try:
        async with async_session_factory() as s:
            # قیمتِ فعلی (آخرین M15) و بستهٔ روزِ قبل (D1) برای همان نمادها
            cur_rows = (
                await s.execute(
                    text(
                        "SELECT DISTINCT ON (symbol) symbol, close, time "
                        "FROM candles WHERE timeframe='M15' AND symbol = ANY(:syms) "
                        "ORDER BY symbol, time DESC"
                    ),
                    {"syms": symbols},
                )
            ).all()
            prev_rows = (
                await s.execute(
                    text(
                        "SELECT DISTINCT ON (symbol) symbol, close "
                        "FROM candles WHERE timeframe='D1' AND symbol = ANY(:syms) "
                        "AND time < date_trunc('day', now()) "
                        "ORDER BY symbol, time DESC"
                    ),
                    {"syms": symbols},
                )
            ).all()
    except Exception as exc:  # noqa: BLE001
        logger.warning("market_snapshot_query_failed", error=str(exc))
        return None

    if not cur_rows:
        return None

    cur = {r[0]: (float(r[1]), r[2]) for r in cur_rows}
    prev = {r[0]: float(r[1]) for r in prev_rows}

    latest_t = max((t for _, t in cur.values()), default=None)
    now = datetime.now(timezone.utc)
    asof = latest_t.strftime("%Y-%m-%d %H:%M") if latest_t else now.strftime("%Y-%m-%d %H:%M")
    session = _active_sessions(now.hour)

    lines = []
    for sym in symbols:  # حفظِ ترتیبِ تعریف‌شده در settings.SYMBOLS
        if sym not in cur:
            continue
        price, _ = cur[sym]
        pc = prev.get(sym)
        if pc:
            chg = (price - pc) / pc * 100
            lines.append(f"• {sym}: {_fmt_price(price)} (روزانه {chg:+.2f}%)")
        else:
            lines.append(f"• {sym}: {_fmt_price(price)}")

    if not lines:
        return None

    return (
        f"📊 اطلاعاتِ زندهٔ بازار از فید CoinePro (نمادهای تحتِ پوششِ ربات) — "
        f"به‌وقتِ UTC {asof} | سشن‌های فعال: {session}\n"
        + "\n".join(lines)
        + "\n(منبع: فیدِ نقدیِ بازار؛ قیمتِ تقریبی است، نه قیمتِ دقیقِ بروکر. "
        "تغییرِ روزانه نسبت به بستهٔ روزِ کاریِ قبل.)"
    )
