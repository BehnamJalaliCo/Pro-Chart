"""
پیکربندی per-symbol برای ریسک — جایگزین مقادیر hardcoded در risk_manager.

منطق متخصص بازار:
    - EURUSD/USDJPY (liquidity بالا، volatility کم): SL محکم‌تر، R/R کمتر قابل‌قبول
    - XAUUSD/GBPJPY (volatility بالا، spread بالا): SL گشادتر، R/R بیشتر لازم
    - Indices (US30, NAS100): تقریباً مشابه XAUUSD ولی ساعات محدود
    - Exotic pairs: R/R بسیار محافظه‌کارانه

تمام پارامترها قابل‌override از تنظیمات و env در آینده.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class SymbolRiskConfig:
    """تنظیمات ریسک یک نماد."""

    symbol: str
    atr_sl_multiplier: float       # ضریب ATR برای SL
    atr_trailing_multiplier: float  # ضریب ATR برای trailing
    min_rr_tp1: float              # حداقل R/R تا TP1 برای پذیرش سیگنال
    min_sl_pips: float             # حداقل پیپ SL (در نمادهای کم‌نوسان)
    max_sl_pips: float             # حداکثر پیپ SL (محدودیت اندازه‌ی ضرر)
    max_atr_percentile: float = 0.985
    # ↑ اگر ATR فعلی > این صدک تاریخی → بازار "اسپایک" است و سیگنال رد می‌شود.
    # از ۰.۹۵ به ۰.۹۸۵ → فقط نوسانِ واقعاً افراطی (خبر/پنیک، ~۱.۵٪ بالا) رد شود؛
    # بریک‌اوتِ روندیِ ایندکس‌ها که ذاتاً ATR بالا دارد و پرسود است باید عبور کند.
    max_sl_atr_mult: float = 8.0
    # ↑ سقفِ SL به‌صورتِ مضربِ ATR (سقفِ پیپیِ ثابت برای اندیس‌ها/فلزات اشتباه بود:
    # SLِ موتور ~۴.۸۷۵×ATR است؛ این سقفِ ۸×ATR با هدِروم بالای آن می‌نشیند).


# ---------------------------------------------------------------------------
# پیکربندی پیش‌فرض per-symbol
# مقادیر بر اساس رفتار تاریخی هر نماد در ماه‌های اخیر تنظیم شده‌اند.
# ---------------------------------------------------------------------------

# نکته: min_rr_tp1 (موقعیت ۴) با درخواست کاربر به سقف ۱.۳ کاهش یافت تا در بازار
# بی‌جهت/کم‌مومنتوم، ستاپ‌هایی با پاداش/ریسک متوسط هم سیگنال شوند (trade-off کیفیت).
_DEFAULT_CONFIGS: Dict[str, SymbolRiskConfig] = {
    # ── Majors (USD-quoted) ───────────────────────────────
    "EURUSD": SymbolRiskConfig("EURUSD", 2.0, 1.0, 1.2, 8.0, 60.0),
    "GBPUSD": SymbolRiskConfig("GBPUSD", 2.0, 1.0, 1.3, 10.0, 80.0),
    "USDJPY": SymbolRiskConfig("USDJPY", 2.0, 1.0, 1.2, 8.0, 70.0),
    "USDCHF": SymbolRiskConfig("USDCHF", 2.0, 1.0, 1.3, 8.0, 70.0),
    "AUDUSD": SymbolRiskConfig("AUDUSD", 2.0, 1.0, 1.3, 8.0, 70.0),
    "NZDUSD": SymbolRiskConfig("NZDUSD", 2.0, 1.0, 1.3, 10.0, 80.0),
    "USDCAD": SymbolRiskConfig("USDCAD", 2.0, 1.0, 1.3, 8.0, 70.0),
    # ── Crosses (no USD) ──────────────────────────────────
    "EURGBP": SymbolRiskConfig("EURGBP", 2.0, 1.0, 1.3, 8.0, 60.0),
    "EURJPY": SymbolRiskConfig("EURJPY", 2.0, 1.0, 1.3, 12.0, 100.0),
    "GBPJPY": SymbolRiskConfig("GBPJPY", 2.2, 1.2, 1.3, 15.0, 150.0),
    "AUDJPY": SymbolRiskConfig("AUDJPY", 2.0, 1.0, 1.3, 12.0, 100.0),
    "EURAUD": SymbolRiskConfig("EURAUD", 2.0, 1.0, 1.3, 12.0, 120.0),
    # ── Metals ────────────────────────────────────────────
    "XAUUSD": SymbolRiskConfig("XAUUSD", 2.5, 1.5, 1.3, 30.0, 400.0),
    "XAGUSD": SymbolRiskConfig("XAGUSD", 2.5, 1.5, 1.3, 20.0, 300.0),
    # ── Energy ────────────────────────────────────────────
    "XTIUSD": SymbolRiskConfig("XTIUSD", 2.5, 1.5, 1.3, 30.0, 300.0),
    "XNGUSD": SymbolRiskConfig("XNGUSD", 3.0, 1.5, 1.3, 50.0, 500.0),
    # ── Indices ───────────────────────────────────────────
    # max_sl_pips برحسب «پیپ» است (فاصله‌ی قیمت ÷ pip_size). شاخص‌ها pip_size
    # کوچک دارند (NAS100/US500/DE40=0.1، US30=1.0) پس عدد پیپ بزرگ می‌شود؛
    # مقادیر قبلی (۲۰۰-۵۰۰) معادل ۲۰-۵۰ واحد شاخص بود و همه‌ی SLها را
    # SL_TOO_WIDE می‌کرد. اکنون با headroom ~۳× ATR نرمال تنظیم شده.
    "US30":   SymbolRiskConfig("US30",   2.5, 1.5, 1.3, 20.0,  700.0),   # ۷۰۰ پوینت
    "US500":  SymbolRiskConfig("US500",  2.5, 1.5, 1.3, 10.0,  650.0),   # ۶۵ پوینت
    "NAS100": SymbolRiskConfig("NAS100", 2.5, 1.5, 1.3, 20.0, 3000.0),   # ۳۰۰ پوینت
    "DE40":   SymbolRiskConfig("DE40",   2.5, 1.5, 1.3, 15.0, 2500.0),   # ۲۵۰ پوینت
}

# پروفایل محافظه‌کارانه برای نمادهای ناشناخته
_FALLBACK = SymbolRiskConfig(
    symbol="UNKNOWN",
    atr_sl_multiplier=2.0,
    atr_trailing_multiplier=1.0,
    min_rr_tp1=1.0,  # ←۱.۳ بود؛ چون TP1 به R/R=1.05 نزدیک شد، آستانه پایین آمد تا سیگنال رد نشود
    min_sl_pips=10.0,
    max_sl_pips=200.0,
)


def get_symbol_config(symbol: str) -> SymbolRiskConfig:
    """
    دریافت پیکربندی ریسک یک نماد.

    در صورت نبود نماد در پیکربندی، پروفایل محافظه‌کارانه برمی‌گرداند.
    این تابع تنها نقطه ورود برای سایر ماژول‌هاست — تغییر پیکربندی فقط
    اینجا انجام می‌شود.
    """
    cfg = _DEFAULT_CONFIGS.get(symbol, _FALLBACK)
    # چون TPها ~۳۰٪ نزدیک‌تر شدند (TP1 R/R≈۱.۰۵)، سقفِ min_rr_tp1 را ۱.۰ می‌کنیم تا
    # هیچ نمادی سیگنالِ معتبر را به‌خاطرِ آستانهٔ R/R قدیمی (۱.۲-۱.۳) رد نکند.
    if cfg.min_rr_tp1 > 1.0:
        from dataclasses import replace
        cfg = replace(cfg, min_rr_tp1=1.0)
    return cfg


def all_configured_symbols() -> list[str]:
    """لیست تمام نمادهایی که پیکربندی ریسک دارند."""
    return list(_DEFAULT_CONFIGS.keys())
