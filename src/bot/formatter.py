"""
Signal Formatter — all output in Farsi.

Formats trading signals, update messages (TP/SL hit),
progress bars, and numeric helpers.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Optional

from src.core.logger import get_logger

logger = get_logger("bot.formatter")

# ───────────────────────── Constants ─────────────────────────

SEPARATOR = "━━━━━━━━━━━━━━━━━━━━━"

PERSIAN_DIGITS = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

DIRECTION_MAP = {
    "BUY": ("خرید", "🟢🟢🟢"),
    "STRONG_BUY": ("خرید قوی", "🟢🟢🟢"),
    "SELL": ("فروش", "🔴🔴🔴"),
    "STRONG_SELL": ("فروش قوی", "🔴🔴🔴"),
}

SYMBOL_NAMES: dict[str, str] = {
    "XAU/USD": "طلا",
    "XAUUSD": "طلا",
    "EUR/USD": "یورو/دلار",
    "EURUSD": "یورو/دلار",
    "GBP/USD": "پوند/دلار",
    "GBPUSD": "پوند/دلار",
    "USD/JPY": "دلار/ین",
    "USDJPY": "دلار/ین",
    "USD/CHF": "دلار/فرانک",
    "USDCHF": "دلار/فرانک",
    "AUD/USD": "دلار استرالیا/دلار",
    "AUDUSD": "دلار استرالیا/دلار",
    "NZD/USD": "دلار نیوزلند/دلار",
    "NZDUSD": "دلار نیوزلند/دلار",
    "USD/CAD": "دلار/دلار کانادا",
    "USDCAD": "دلار/دلار کانادا",
    "EUR/GBP": "یورو/پوند",
    "EURGBP": "یورو/پوند",
    "EUR/JPY": "یورو/ین",
    "EURJPY": "یورو/ین",
    "GBP/JPY": "پوند/ین",
    "GBPJPY": "پوند/ین",
    "XAG/USD": "نقره",
    "XAGUSD": "نقره",
    "US30": "داوجونز",
    "US100": "نزدک",
    "SPX500": "اس‌اندپی ۵۰۰",
    "WTI": "نفت خام",
    "USOIL": "نفت خام",
    "BTC/USD": "بیت‌کوین",
    "BTCUSD": "بیت‌کوین",
    "ETH/USD": "اتریوم",
    "ETHUSD": "اتریوم",
}


# ───────────────────────── Helpers ───────────────────────────

def to_persian(text: str | int | float) -> str:
    """Convert Latin digits to Persian digits."""
    return str(text).translate(PERSIAN_DIGITS)


def format_number(value: float, decimals: int = 2) -> str:
    """Format a number with commas and optional decimal places."""
    if decimals == 0:
        formatted = f"{int(round(value)):,}"
    else:
        formatted = f"{value:,.{decimals}f}"
    return formatted


def format_number_fa(value: float, decimals: int = 2) -> str:
    """Format a number with commas and convert to Persian digits."""
    return to_persian(format_number(value, decimals))


def progress_bar(percentage: float, length: int = 10) -> str:
    """
    Build a progress bar using block characters.
    E.g. 87% with length 10  ->  █████████░
    """
    percentage = max(0.0, min(100.0, percentage))
    filled = round(percentage / 100 * length)
    empty = length - filled
    return "\u2588" * filled + "\u2591" * empty


def _pip_value(symbol: str) -> float:
    """Return the pip multiplier for a given symbol (for display)."""
    sym = symbol.upper().replace("/", "")
    if sym in ("XAUUSD",):
        return 10.0  # gold: 1 pip = 0.10 -> multiply by 10
    if "JPY" in sym:
        return 100.0
    return 10_000.0


def calc_pips(symbol: str, entry: float, target: float) -> float:
    """Calculate pip distance between entry and target."""
    mult = _pip_value(symbol)
    return round(abs(target - entry) * mult, 1)


def _shamsi_now() -> str:
    """
    Return a rough Shamsi (Jalali) date string.
    Uses a simple arithmetic conversion (good enough for display).
    """
    now = datetime.now(timezone.utc)
    return _gregorian_to_shamsi(now)


def _gregorian_to_shamsi(dt: datetime) -> str:
    """Convert a Gregorian datetime to a Shamsi date string."""
    gy = dt.year
    gm = dt.month
    gd = dt.day

    g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    gy2 = gy + 1 if gm > 2 else gy
    days = (
        355666
        + (365 * gy)
        + ((gy2 + 3) // 4)
        - ((gy2 + 99) // 100)
        + ((gy2 + 399) // 400)
        + gd
        + g_d_m[gm - 1]
    )
    jy = -1595 + (33 * (days // 12053))
    days %= 12053
    jy += 4 * (days // 1461)
    days %= 1461
    if days > 365:
        jy += (days - 1) // 365
        days = (days - 1) % 365
    if days < 186:
        jm = 1 + (days // 31)
        jd = 1 + (days % 31)
    else:
        jm = 7 + ((days - 186) // 30)
        jd = 1 + ((days - 186) % 30)
    return f"{jy:04d}/{jm:02d}/{jd:02d}"


def _get_symbol_display(symbol: str) -> str:
    """Return the display string for a symbol, e.g. 'XAU/USD (طلا)'."""
    canonical = symbol.upper()
    fa_name = SYMBOL_NAMES.get(canonical, "")
    if fa_name:
        return f"{canonical} ({fa_name})"
    return canonical


# ───────────────────────── Signal Formatting ─────────────────

def format_signal(sig: dict[str, Any]) -> str:
    """
    Format a full signal message in Farsi.

    Expected keys in *sig*:
        direction       : str   — BUY / STRONG_BUY / SELL / STRONG_SELL
        symbol          : str   — e.g. "XAU/USD"
        timeframe       : str   — e.g. "H1"
        entry_low       : float
        entry_high      : float
        stop_loss       : float
        targets         : list[float]   — up to 3 target prices
        analysis        : list[str]     — bullet-point analysis lines
        rsi             : float | None
        rsi_label       : str | None    — e.g. "صعودی"
        macd_label      : str | None    — e.g. "تقاطع صعودی"
        ema_summary     : str | None    — e.g. "EMA 20 > 50 > 200"
        ai_score        : int           — 0-100
        mtf_confirms    : list[str]     — e.g. ["H1", "H4", "D1"]
        stats_win_rate  : float         — e.g. 73.0
        stats_avg_rr    : float         — e.g. 2.1
        stats_total     : int
        stats_wins      : int
        created_at      : datetime | None
    """
    direction = sig.get("direction", "BUY").upper()
    fa_dir, icons = DIRECTION_MAP.get(direction, ("خرید", "🟢🟢🟢"))

    symbol = sig.get("symbol", "")
    timeframe = sig.get("timeframe", "")
    entry_low = sig.get("entry_low", 0.0)
    entry_high = sig.get("entry_high", 0.0)
    stop_loss = sig.get("stop_loss", 0.0)
    targets: list[float] = sig.get("targets", [])
    analysis: list[str] = sig.get("analysis", [])
    rsi = sig.get("rsi")
    rsi_label = sig.get("rsi_label", "")
    macd_label = sig.get("macd_label", "")
    ema_summary = sig.get("ema_summary", "")
    ai_score = sig.get("ai_score", 0)
    mtf_confirms: list[str] = sig.get("mtf_confirms", [])
    stats_win_rate = sig.get("stats_win_rate", 0.0)
    stats_avg_rr = sig.get("stats_avg_rr", 0.0)
    stats_total = sig.get("stats_total", 0)
    stats_wins = sig.get("stats_wins", 0)
    created_at: datetime | None = sig.get("created_at")

    # Determine decimal places by symbol
    dec = _decimals_for(symbol)

    # Date
    if created_at:
        shamsi = _gregorian_to_shamsi(created_at)
        time_str = created_at.strftime("%H:%M")
    else:
        now = datetime.now(timezone.utc)
        shamsi = _gregorian_to_shamsi(now)
        time_str = now.strftime("%H:%M")
    shamsi_fa = to_persian(shamsi)
    time_fa = to_persian(time_str)

    # Entry midpoint for pip calc
    entry_mid = (entry_low + entry_high) / 2

    # SL pips
    sl_pips = calc_pips(symbol, entry_mid, stop_loss)
    sl_sign = "−" if (
        (direction in ("BUY", "STRONG_BUY") and stop_loss < entry_mid)
        or (direction in ("SELL", "STRONG_SELL") and stop_loss > entry_mid)
    ) else "+"

    # MTF line
    mtf_str = ""
    if mtf_confirms:
        mtf_str = " ".join(f"\u2705{tf}" for tf in mtf_confirms)

    # Targets with RR
    target_lines: list[str] = []
    for idx, tp in enumerate(targets, 1):
        tp_pips = calc_pips(symbol, entry_mid, tp)
        rr = round(tp_pips / sl_pips, 1) if sl_pips else 0.0
        tp_sign = "+" if (
            (direction in ("BUY", "STRONG_BUY") and tp > entry_mid)
            or (direction in ("SELL", "STRONG_SELL") and tp < entry_mid)
        ) else "−"
        emoji = "🟢" if direction in ("BUY", "STRONG_BUY") else "🔴"
        target_lines.append(
            f"{emoji} هدف {to_persian(idx)}: "
            f"{format_number(tp, dec)} "
            f"({tp_sign}{to_persian(format_number(tp_pips, 0))} پیپ) "
            f"— R:R 1:{to_persian(format_number(rr, 1))}"
        )

    # Analysis bullets
    analysis_str = ""
    if analysis:
        bullets = "\n".join(f"• {line}" for line in analysis)
        analysis_str = f"\n\n📈 تحلیل ورود:\n{bullets}"

    # Indicators
    indicators: list[str] = []
    if rsi is not None:
        label = f" ({rsi_label})" if rsi_label else ""
        indicators.append(f"• RSI: {to_persian(int(rsi))}{label}")
    if macd_label:
        indicators.append(f"• MACD: {macd_label}")
    if ema_summary:
        indicators.append(f"• {ema_summary}")
    indicators_block = ""
    if indicators:
        indicators_block = "\n" + "\n".join(indicators)

    # AI score bar
    bar = progress_bar(ai_score)
    ai_block = (
        f"\n\n🤖 امتیاز هوش مصنوعی: {to_persian(ai_score)}/۱۰۰\n"
        f"⚡ قدرت سیگنال: {bar} {to_persian(ai_score)}%"
    )

    # ── متادیتای فاز ۲/۳ (در صورت وجود) ──
    extras_lines: list[str] = []
    dominant = sig.get("dominant_component")
    if dominant:
        dominant_fa = {
            "technical": "تحلیل تکنیکال",
            "pattern": "الگوهای قیمتی",
            "ml": "هوش مصنوعی",
            "mixed": "ترکیبی",
        }.get(dominant, dominant)
        extras_lines.append(f"🎯 مؤلفه‌ی غالب: {dominant_fa}")

    regime = sig.get("market_regime")
    if regime:
        regime_fa = {
            "trending_up": "روند صعودی",
            "trending_down": "روند نزولی",
            "ranging": "سایدوی",
            "transitional": "گذار",
            "high_volatility": "نوسان بالا",
            "low_volatility": "نوسان پایین",
        }.get(regime, regime)
        extras_lines.append(f"📊 رژیم بازار: {regime_fa}")

    session = sig.get("session")
    if session:
        session_fa = {
            "tokyo": "توکیو", "london": "لندن", "new_york": "نیویورک",
            "sydney": "سیدنی", "frankfurt": "فرانکفورت",
        }.get(session, session)
        extras_lines.append(f"🕐 session: {session_fa}")

    higher_bias = sig.get("higher_tf_bias")
    if higher_bias and higher_bias != "neutral":
        bias_fa = {
            "bullish": "صعودی", "slightly_bullish": "کمی صعودی",
            "bearish": "نزولی", "slightly_bearish": "کمی نزولی",
        }.get(higher_bias, higher_bias)
        extras_lines.append(f"📈 bias تایم‌فریم بالاتر (W1/D1): {bias_fa}")

    extras_block = ""
    if extras_lines:
        extras_block = "\n\n" + "\n".join(extras_lines)

    # Performance stats
    stats_block = ""
    if stats_total > 0:
        stats_block = (
            f"\n\n{SEPARATOR}\n\n"
            f"📊 عملکرد ربات ({to_persian(30)} روز اخیر):\n"
            f"🏆 وین ریت: {to_persian(format_number(stats_win_rate, 0))}% | "
            f"📈 میانگین R:R: 1:{to_persian(format_number(stats_avg_rr, 1))}\n"
            f"📋 کل سیگنال‌ها: {to_persian(format_number(stats_total, 0))} | "
            f"✅ موفق: {to_persian(format_number(stats_wins, 0))}"
        )

    # Assemble
    targets_text = "\n".join(target_lines)

    text = (
        f"{icons} سیگنال {fa_dir}\n\n"
        f"📊 نماد: {_get_symbol_display(symbol)}\n"
        f"⏰ تایم\u200cفریم: {timeframe}\n"
        f"📅 تاریخ: {shamsi_fa} — {time_fa} UTC"
    )

    if mtf_str:
        text += f"\n🔄 تأیید چند تایم\u200cفریمی: {mtf_str}"

    text += (
        f"\n\n{SEPARATOR}\n\n"
        f"💰 محدوده ورود: {format_number(entry_low, dec)} — {format_number(entry_high, dec)}\n"
        f"🔴 حد ضرر: {format_number(stop_loss, dec)} "
        f"({sl_sign}{to_persian(format_number(sl_pips, 0))} پیپ)\n"
        f"{targets_text}\n\n"
        f"{SEPARATOR}"
        f"{analysis_str}"
        f"{indicators_block}"
        f"{ai_block}"
        f"{extras_block}"
        f"{stats_block}\n\n"
        f"{SEPARATOR}\n\n"
        f"⚠️ هشدار: حداکثر ۱-۲٪ سرمایه ریسک کنید\n"
        f"📌 این سیگنال مشاوره مالی نیست\n"
        f"🆔 @CoinePro_FX"
    )
    return text


def _decimals_for(symbol: str) -> int:
    """Return the number of decimal places for a symbol's price."""
    sym = symbol.upper().replace("/", "")
    if sym in ("XAUUSD",):
        return 2
    if sym in ("XAGUSD",):
        return 3
    if "JPY" in sym:
        return 3
    if sym in ("US30", "US100", "SPX500", "BTCUSD"):
        return 2
    if sym in ("ETHUSD",):
        return 2
    if sym in ("USOIL", "WTI"):
        return 2
    return 5


# ───────────────────────── Compact Format ────────────────────


def format_signal_compact(sig: dict[str, Any]) -> str:
    """
    نسخه‌ی فشرده‌ی سیگنال — ۴-۵ خط به‌جای ۳۰.

    برای کاربران mobile که از scrolling طولانی خسته می‌شوند.
    فیلدهای اصلی فقط: نماد، جهت، entry، SL، TP1، AI score.
    کاربر می‌تواند با inline keyboard "جزئیات بیشتر" را بزند.

    کلیدهای دیکشنری sig:
        symbol, direction, entry_low, entry_high, stop_loss,
        targets (list)، ai_score, timeframe
    """
    direction = sig.get("direction", "BUY").upper()
    fa_dir, icon = (
        ("خرید", "🟢")
        if direction in ("BUY", "STRONG_BUY")
        else ("فروش", "🔴")
    )

    symbol = sig.get("symbol", "")
    symbol_fa = _get_symbol_display(symbol)
    timeframe = sig.get("timeframe", "")

    entry_low = float(sig.get("entry_low", 0) or 0)
    entry_high = float(sig.get("entry_high", 0) or 0)
    entry_mid = (entry_low + entry_high) / 2 if (entry_low and entry_high) else (entry_low or entry_high)
    stop_loss = float(sig.get("stop_loss", 0) or 0)
    targets = sig.get("targets", []) or []
    tp1 = float(targets[0]) if targets else 0.0
    ai_score = int(sig.get("ai_score", 0))

    dec = _decimals_for(symbol)

    # خط ۱: header
    line1 = f"{icon} <b>{symbol_fa}</b> | {fa_dir} | {timeframe}"

    # خط ۲: entry / SL / TP
    sl_pips = calc_pips(symbol, entry_mid, stop_loss) if (entry_mid and stop_loss) else 0
    tp_pips = calc_pips(symbol, entry_mid, tp1) if (entry_mid and tp1) else 0
    rr = round(tp_pips / sl_pips, 1) if sl_pips else 0
    line2 = (
        f"💰 {format_number(entry_mid, dec)} "
        f"→ 🎯 {format_number(tp1, dec)} "
        f"| 🛑 {format_number(stop_loss, dec)} "
        f"({to_persian(int(sl_pips))} پیپ)"
    )

    # خط ۳: امتیاز + R/R
    bar = progress_bar(ai_score, length=8)
    line3 = f"🤖 {bar} {to_persian(ai_score)}٪ | R/R 1:{to_persian(format_number(rr, 1))}"

    # خط ۴: footer
    line4 = "ℹ️ برای جزئیات کامل، دکمه‌ی زیر را بزنید."

    return f"{line1}\n{line2}\n{line3}\n\n{line4}"


def build_signal_inline_keyboard(signal_id: int) -> list[list[dict[str, Any]]]:
    """
    Inline keyboard برای سیگنال — actions کاربر.

    خروجی: format `InlineKeyboardMarkup.inline_keyboard`:
        [[{text, callback_data}, ...], ...]

    دکمه‌ها:
        • جزئیات کامل (signal:detail:{id})
        • ذخیره (signal:save:{id})
        • قطع اطلاع‌رسانی (signal:mute:{id})

    aiogram code فقط باید:
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
        rows = build_signal_inline_keyboard(sig_id)
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(**btn) for btn in row]
            for row in rows
        ])
    """
    return [
        [
            {"text": "📊 جزئیات کامل", "callback_data": f"signal:detail:{signal_id}"},
            {"text": "📌 ذخیره", "callback_data": f"signal:save:{signal_id}"},
        ],
        [
            {"text": "🔕 اطلاع‌رسانی کم", "callback_data": f"signal:mute:{signal_id}"},
            {"text": "👎 بازخورد", "callback_data": f"signal:feedback:{signal_id}"},
        ],
    ]


def format_user_tier_summary(
    plan: str,
    daily_limit: int,
    daily_used: int,
    expires_at: Optional[Any] = None,
) -> str:
    """
    خلاصه‌ی tier کاربر — برای /start و /me.

    پارامترها:
        plan: "free" | "premium" | "vip"
        daily_limit: حداکثر سیگنال در روز
        daily_used: تعداد دریافت‌شده تا الان
        expires_at: تاریخ انقضای اشتراک (None برای رایگان)
    """
    tier_labels = {
        "free": ("رایگان", "🆓"),
        "premium": ("پرمیوم", "⭐"),
        "vip": ("VIP", "👑"),
    }
    label, emoji = tier_labels.get(str(plan).lower(), ("رایگان", "🆓"))

    remaining = max(0, daily_limit - daily_used) if daily_limit else 0
    used_bar = progress_bar(
        (daily_used / daily_limit * 100) if daily_limit else 0,
        length=8,
    )

    lines = [
        f"📋 پلن شما: {emoji} <b>{label}</b>",
        f"📊 سیگنال‌های امروز: {to_persian(daily_used)}/{to_persian(daily_limit)}",
        f"   {used_bar} ({to_persian(remaining)} باقی‌مانده)",
    ]
    if expires_at:
        try:
            shamsi = _gregorian_to_shamsi(expires_at)
            lines.append(f"⏰ انقضای اشتراک: {to_persian(shamsi)}")
        except Exception:
            pass
    else:
        if str(plan).lower() == "free":
            lines.append("💎 با ارتقا به پرمیوم، سیگنال‌های نامحدود + dDخدمات VIP")

    return "\n".join(lines)


# ───────────────────────── Update Messages ───────────────────

def format_tp_hit(
    symbol: str,
    direction: str,
    tp_number: int,
    tp_price: float,
    entry_price: float,
    pips: float,
    rr: float,
    remaining_targets: int,
) -> str:
    """Format a Take-Profit hit update message."""
    dec = _decimals_for(symbol)
    _, icons = DIRECTION_MAP.get(direction.upper(), ("خرید", "🟢🟢🟢"))

    status_emoji = "🎯" if remaining_targets > 0 else "🏆"

    status_line = ""
    if remaining_targets > 0:
        status_line = (
            f"\n📌 وضعیت: {to_persian(remaining_targets)} هدف باقی‌مانده — "
            f"حد ضرر را به نقطه ورود منتقل کنید"
        )
    else:
        status_line = "\n🏁 تمامی اهداف محقق شدند!"

    text = (
        f"{status_emoji} هدف {to_persian(tp_number)} فعال شد!\n\n"
        f"📊 نماد: {_get_symbol_display(symbol)}\n"
        f"💰 قیمت ورود: {format_number(entry_price, dec)}\n"
        f"🎯 قیمت هدف: {format_number(tp_price, dec)}\n"
        f"📈 سود: +{to_persian(format_number(pips, 0))} پیپ\n"
        f"📊 نسبت ریسک به ریوارد: 1:{to_persian(format_number(rr, 1))}"
        f"{status_line}\n\n"
        f"🆔 @CoinePro_FX"
    )
    return text


def format_sl_hit(
    symbol: str,
    direction: str,
    sl_price: float,
    entry_price: float,
    pips: float,
) -> str:
    """Format a Stop-Loss hit update message."""
    dec = _decimals_for(symbol)

    text = (
        f"🔴 حد ضرر فعال شد!\n\n"
        f"📊 نماد: {_get_symbol_display(symbol)}\n"
        f"💰 قیمت ورود: {format_number(entry_price, dec)}\n"
        f"🔴 قیمت حد ضرر: {format_number(sl_price, dec)}\n"
        f"📉 ضرر: −{to_persian(format_number(pips, 0))} پیپ\n\n"
        f"⚠️ مدیریت سرمایه را فراموش نکنید\n"
        f"🆔 @CoinePro_FX"
    )
    return text


def format_breakeven_update(
    symbol: str,
    direction: str,
    tp_number: int,
) -> str:
    """Format a break-even update message."""
    text = (
        f"🔄 بروزرسانی سیگنال\n\n"
        f"📊 نماد: {_get_symbol_display(symbol)}\n"
        f"🎯 هدف {to_persian(tp_number)} محقق شد\n"
        f"✅ حد ضرر به نقطه ورود (Break-Even) منتقل شد\n\n"
        f"📌 ریسک این معامله اکنون صفر است\n"
        f"🆔 @CoinePro_FX"
    )
    return text


# ───────────────────────── Performance ───────────────────────

def format_performance(stats: dict[str, Any]) -> str:
    """Format overall performance statistics."""
    win_rate = stats.get("win_rate", 0.0)
    total = stats.get("total_signals", 0)
    wins = stats.get("wins", 0)
    losses = stats.get("losses", 0)
    avg_rr = stats.get("avg_rr", 0.0)
    total_pips = stats.get("total_pips", 0.0)
    best_trade_pips = stats.get("best_trade_pips", 0.0)
    worst_trade_pips = stats.get("worst_trade_pips", 0.0)
    avg_pips = stats.get("avg_pips_per_trade", 0.0)
    streak_wins = stats.get("current_win_streak", 0)
    period = stats.get("period_days", 30)

    bar = progress_bar(win_rate)

    text = (
        f"📊 عملکرد ربات — {to_persian(period)} روز اخیر\n\n"
        f"{SEPARATOR}\n\n"
        f"🏆 وین ریت: {bar} {to_persian(format_number(win_rate, 1))}%\n\n"
        f"📋 کل سیگنال‌ها: {to_persian(format_number(total, 0))}\n"
        f"✅ موفق: {to_persian(format_number(wins, 0))}\n"
        f"❌ ناموفق: {to_persian(format_number(losses, 0))}\n"
        f"📈 میانگین R:R: 1:{to_persian(format_number(avg_rr, 1))}\n\n"
        f"{SEPARATOR}\n\n"
        f"💰 مجموع پیپ: {to_persian(format_number(total_pips, 0))}\n"
        f"📈 بهترین معامله: +{to_persian(format_number(best_trade_pips, 0))} پیپ\n"
        f"📉 بدترین معامله: −{to_persian(format_number(worst_trade_pips, 0))} پیپ\n"
        f"📊 میانگین پیپ: {to_persian(format_number(avg_pips, 1))}\n"
        f"🔥 سری بردهای متوالی: {to_persian(streak_wins)}\n\n"
        f"{SEPARATOR}\n\n"
        f"🆔 @CoinePro_FX"
    )
    return text


# ───────────────────────── Profit Calculator ─────────────────

def format_profit_calc(
    symbol: str,
    direction: str,
    lot_size: float,
    entry: float,
    targets: list[float],
    stop_loss: float,
    pip_value_usd: float = 10.0,
) -> str:
    """
    Format a profit calculator result.
    pip_value_usd = dollar value per pip per standard lot.
    """
    pips_sl = calc_pips(symbol, entry, stop_loss)
    loss_usd = round(pips_sl * lot_size * pip_value_usd, 2)

    lines: list[str] = [
        f"💰 محاسبه سود/ضرر\n",
        f"📊 نماد: {_get_symbol_display(symbol)}",
        f"📐 حجم: {to_persian(format_number(lot_size, 2))} لات",
        f"",
        SEPARATOR,
        f"",
    ]

    for idx, tp in enumerate(targets, 1):
        pips_tp = calc_pips(symbol, entry, tp)
        profit_usd = round(pips_tp * lot_size * pip_value_usd, 2)
        lines.append(
            f"🎯 هدف {to_persian(idx)}: "
            f"+{to_persian(format_number(pips_tp, 0))} پیپ = "
            f"+${format_number(profit_usd, 2)}"
        )

    lines.extend([
        f"",
        f"🔴 حد ضرر: −{to_persian(format_number(pips_sl, 0))} پیپ = "
        f"−${format_number(loss_usd, 2)}",
        f"",
        SEPARATOR,
        f"",
        f"⚠️ مقادیر تقریبی هستند",
        f"🆔 @CoinePro_FX",
    ])
    return "\n".join(lines)


# ───────────────────────── Signal History ────────────────────

def format_signal_history_item(sig: dict[str, Any], index: int) -> str:
    """Format a single signal for history list."""
    direction = sig.get("direction", "BUY").upper()
    fa_dir, _ = DIRECTION_MAP.get(direction, ("خرید", "🟢🟢🟢"))
    symbol = sig.get("symbol", "")
    result = sig.get("result", "")  # "win" / "loss" / "active"
    pips = sig.get("result_pips", 0.0)
    created_at = sig.get("created_at")

    result_emoji = {"win": "✅", "loss": "❌", "active": "🔵"}.get(result, "⚪")
    result_label = {"win": "موفق", "loss": "ناموفق", "active": "فعال"}.get(
        result, "نامشخص"
    )

    date_str = ""
    if created_at:
        date_str = to_persian(_gregorian_to_shamsi(created_at))

    pips_str = ""
    if result == "win":
        pips_str = f" (+{to_persian(format_number(pips, 0))} پیپ)"
    elif result == "loss":
        pips_str = f" (−{to_persian(format_number(abs(pips), 0))} پیپ)"

    return (
        f"{to_persian(index)}. {result_emoji} {fa_dir} {_get_symbol_display(symbol)}\n"
        f"   📅 {date_str} | {result_label}{pips_str}"
    )


def format_signal_history(
    signals: list[dict[str, Any]],
    page: int,
    total_pages: int,
) -> str:
    """Format a page of signal history."""
    if not signals:
        return "📭 تاریخچه سیگنالی یافت نشد."

    items = []
    for idx, sig in enumerate(signals, start=(page - 1) * 10 + 1):
        items.append(format_signal_history_item(sig, idx))

    header = (
        f"📋 تاریخچه سیگنال‌ها — صفحه {to_persian(page)} از {to_persian(total_pages)}\n\n"
        f"{SEPARATOR}\n"
    )
    footer = f"\n{SEPARATOR}"

    return header + "\n\n".join(items) + footer
