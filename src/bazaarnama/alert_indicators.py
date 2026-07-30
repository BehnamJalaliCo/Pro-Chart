"""بازارنما — توابعِ خالصِ اندیکاتور برای موتورِ آلارمِ سمتِ‌سرور.

چرا ماژولِ جدا: این توابع هم در ورکرِ Celery (tasks.py) لازم‌اند و هم باید بدونِ
DB/Redis/شبکه تست‌پذیر باشند؛ ضمناً ورکر نباید ماژول‌های routeِ FastAPI
(academy.py) را import کند. فرمول‌ها آگاهانه همان فرمول‌های نمودارِ academy.py
هستند (EMA با seedِ SMA، RSI با هموارسازیِ ویلدر) تا مقداری که کاربر روی چارت
می‌بیند با مقداری که آلارم را می‌ترکاند یکی باشد — فقط «آخرین مقدار» لازم است،
پس پیاده‌سازی‌ها تک‌گذر و بدونِ وابستگی‌اند.
"""

from __future__ import annotations

# ثانیهٔ هر تایم‌فریم — سوپرستِ نگاشت‌های chart_stream/academy تا هر tf ذخیره‌شده
# در آلارم‌های قدیمی هم resolve شود (D/W/MN1 نام‌های جایگزین‌اند).
TF_SECONDS: dict[str, int] = {
    "M1": 60, "M5": 300, "M15": 900, "M30": 1800,
    "H1": 3600, "H2": 7200, "H3": 10800, "H4": 14400, "H6": 21600, "H8": 28800, "H12": 43200,
    "D1": 86400, "D": 86400, "W1": 604800, "W": 604800, "MN": 2592000, "MN1": 2592000,
}


def tf_seconds(tf: str | None, default: int = 3600) -> int:
    """ثانیهٔ یک تایم‌فریم؛ برای tf ناشناخته default (H1) — آلارم نباید به‌خاطرِ tf عجیب بمیرد."""
    return TF_SECONDS.get(str(tf or "").upper(), default)


def drop_forming(candles: list[dict], tf: str, now_ts: float) -> list[dict]:
    """کندلِ درحال‌شکل‌گیری را حذف می‌کند — اندیکاتور فقط روی کندلِ «بسته» ارزیابی می‌شود.

    چرا: مقدارِ RSI/MACD روی کندلِ باز با هر تیک بالا-پایین می‌رود و شرط‌های لبه‌ای
    (cross) را چندبار/اشتباه می‌ترکاند. t شروعِ سطل است؛ اگر پایانِ سطلِ آخر
    (t + tf) هنوز نگذشته یعنی کندل باز است. دادهٔ کهنه (بازارِ بسته) دست‌نخورده می‌ماند.
    """
    if not candles:
        return candles
    sec = tf_seconds(tf)
    try:
        last_t = float(candles[-1].get("t") or 0)
    except (TypeError, ValueError):
        return candles
    if last_t + sec > now_ts:
        return candles[:-1]
    return candles


def sma_last(vals: list[float], period: int) -> float | None:
    """آخرین مقدارِ میانگینِ سادهٔ period-تایی؛ دادهٔ ناکافی → None (آلارم بی‌صدا رد می‌شود)."""
    p = int(period)
    if p < 1 or len(vals) < p:
        return None
    return sum(vals[-p:]) / p


def _ema_series(vals: list[float], p: int) -> list[float | None]:
    """سری EMA هم‌طولِ ورودی (Noneهای ابتدایی) — همان قراردادِ _ema_list نمودار؛ فقط MACD لازمش دارد."""
    n = len(vals)
    out: list[float | None] = [None] * n
    if p < 1 or n < p:
        return out
    k = 2.0 / (p + 1)
    prev = sum(vals[:p]) / p  # seed = SMAِ پنجرهٔ اول، تا با نمودار یکی باشد
    out[p - 1] = prev
    for i in range(p, n):
        prev = (vals[i] - prev) * k + prev
        out[i] = prev
    return out


def ema_last(vals: list[float], period: int) -> float | None:
    """آخرین مقدارِ EMA (seed با SMA — قراردادِ نمودار)؛ دادهٔ ناکافی → None."""
    p = int(period)
    n = len(vals)
    if p < 1 or n < p:
        return None
    k = 2.0 / (p + 1)
    ema = sum(vals[:p]) / p
    for v in vals[p:]:
        ema = (v - ema) * k + ema
    return ema


def rsi_last(vals: list[float], period: int = 14) -> float | None:
    """RSI با هموارسازیِ ویلدر — همان فرمولِ _rsi نمودار (seed: میانگینِ p تغییرِ اول).

    مقصود این است که «RSI(14)=71.3» آلارم با RSI روی چارتِ کاربر یکی باشد؛
    l==0 با همان epsilonِ نمودار خنثی می‌شود (سریِ یکسره‌صعودی → ~۱۰۰).
    """
    p = int(period)
    if p < 1 or len(vals) < p + 1:
        return None
    g = l = 0.0
    for i in range(1, p + 1):
        ch = vals[i] - vals[i - 1]
        g += max(ch, 0.0)
        l += max(-ch, 0.0)
    g /= p
    l /= p
    for i in range(p + 1, len(vals)):
        ch = vals[i] - vals[i - 1]
        g = (g * (p - 1) + max(ch, 0.0)) / p
        l = (l * (p - 1) + max(-ch, 0.0)) / p
    return 100.0 - 100.0 / (1.0 + g / (l or 1e-9))


def macd_last(vals: list[float], fast: int = 12, slow: int = 26,
              signal: int = 9) -> tuple[float | None, float | None, float | None]:
    """(خطِ MACD، خطِ سیگنال، هیستوگرام) روی آخرین مقدار؛ اجزای بی‌داده None.

    سیگنال EMA روی خودِ سریِ MACD است، پس سریِ کامل ساخته می‌شود (نه فقط آخرین
    EMAها) — همان هم‌ترازیِ _ind_macd نمودار: سیگنال از اولین مقدارِ معتبرِ MACD seed می‌گیرد.
    """
    f, s, g = int(fast), int(slow), int(signal)
    if f < 1 or s < 1 or len(vals) < max(f, s):
        return None, None, None
    ef = _ema_series(vals, f)
    es = _ema_series(vals, s)
    macd_series = [a - b for a, b in zip(ef, es) if a is not None and b is not None]
    if not macd_series:
        return None, None, None
    macd_v = macd_series[-1]
    sig_v = ema_last(macd_series, g) if g >= 1 else None
    hist_v = (macd_v - sig_v) if sig_v is not None else None
    return macd_v, sig_v, hist_v


def bars_needed(ind: dict) -> int:
    """تعدادِ کندلِ لازم برای یک ارزیابی: ~۳ برابرِ پنجره، در بازهٔ [۶۰،۳۰۰].

    چرا ۳ برابر: EMA/ویلدر بازگشتی‌اند و بعد از ~۳ پنجره عملاً به مقدارِ نمودار
    همگرا می‌شوند. چرا سقفِ ۳۰۰: فیدهای بیرونی (LBank/yfinance) هر دقیقه با همهٔ
    آلارم‌ها صدا می‌خورند و نباید درخواستِ سنگین بخورند.
    """
    key = str(ind.get("key") or "").lower()
    try:
        if key.startswith("macd"):
            # سیگنال روی سریِ MACD سوار است، پس پنجرهٔ مؤثر slow+signal است نه فقط slow.
            base = int(ind.get("slow") or 26) + int(ind.get("signal") or 9)
        else:
            base = int(ind.get("period") or (14 if key == "rsi" else 20))
    except (TypeError, ValueError):
        base = 20
    return max(60, min(300, base * 3))


# نگاشتِ sourceِ آلارم → فیلدِ کندل؛ پیش‌فرض close (تنها چیزی که UI فعلاً می‌فرستد).
_SOURCE_FIELD = {"close": "c", "open": "o", "high": "h", "low": "l"}


def indicator_last(candles: list[dict], ind: dict) -> tuple[float | None, str]:
    """مقدارِ اندیکاتور روی آخرین کندلِ ورودی + برچسبِ خوانا مثلِ «RSI(14)».

    (None, label) یعنی دادهٔ ناکافی یا کلیدِ ناشناخته — آلارم در آن تیک بی‌صدا رد
    می‌شود (نه خطا)، چون کمبودِ کندل در نمادهای تازه/بازارِ بسته حالتِ عادی است.
    """
    key = str(ind.get("key") or "").lower()
    field = _SOURCE_FIELD.get(str(ind.get("source") or "close").lower(), "c")
    vals: list[float] = []
    for c in candles:
        try:
            vals.append(float(c[field]))
        except (KeyError, TypeError, ValueError):
            continue

    def _i(name: str, dflt: int) -> int:
        try:
            return int(ind.get(name) or dflt)
        except (TypeError, ValueError):
            return dflt

    if key == "rsi":
        p = _i("period", 14)
        return rsi_last(vals, p), f"RSI({p})"
    if key == "sma":
        p = _i("period", 20)
        return sma_last(vals, p), f"SMA({p})"
    if key == "ema":
        p = _i("period", 20)
        return ema_last(vals, p), f"EMA({p})"
    if key in ("macd", "macd_signal", "macd_hist"):
        f, s, g = _i("fast", 12), _i("slow", 26), _i("signal", 9)
        m, sig, hist = macd_last(vals, f, s, g)
        if key == "macd":
            return m, f"MACD({f},{s})"
        if key == "macd_signal":
            return sig, f"MACD-Signal({f},{s},{g})"
        return hist, f"MACD-Hist({f},{s},{g})"
    return None, (key.upper() or "IND")
