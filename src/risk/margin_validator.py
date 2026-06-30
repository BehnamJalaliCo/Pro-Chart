"""
Margin & leverage validation — مطابق regulations معتبر.

منطق متخصص بازار:
    Regulator‌های مختلف، حد leverage برای retail accounts را محدود کرده‌اند:

    UK FCA (Financial Conduct Authority):
        - Major FX: 1:30 max
        - Minor FX: 1:20 max
        - Commodities: 1:20 max
        - Indices: 1:10-20 max

    US NFA (National Futures Association):
        - Major FX: 1:50 max
        - Minor FX: 1:20 max

    EU ESMA:
        - Major FX: 1:30
        - Indices: 1:20
        - Gold: 1:20
        - Crypto: 1:2

    اگر signal نیاز به margin > limit دارد، باید رد شود.

    همچنین Stop-Out Level (معمولاً 50٪ از margin): اگر account_equity
    کمتر از 50٪ margin_used شود، broker تمام positions را close می‌کند.
    این پایان دنیا است — باید پیش‌بینی شود.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Regulator(str, Enum):
    """رگولاتور برای تعیین حد leverage."""

    FCA = "fca"       # UK
    NFA = "nfa"       # US
    ESMA = "esma"     # EU
    ASIC = "asic"     # Australia
    UNREGULATED = "unregulated"  # offshore (high leverage allowed)


# ── جدول leverage limits ──────────────────────────────────
# (regulator, instrument_category) → max_leverage
_LEVERAGE_LIMITS: dict[tuple[Regulator, str], float] = {
    # ── FCA ──
    (Regulator.FCA, "fx_major"): 30.0,
    (Regulator.FCA, "fx_cross"): 20.0,
    (Regulator.FCA, "metal"): 20.0,
    (Regulator.FCA, "energy"): 10.0,
    (Regulator.FCA, "index"): 20.0,
    (Regulator.FCA, "crypto"): 2.0,
    # ── NFA ──
    (Regulator.NFA, "fx_major"): 50.0,
    (Regulator.NFA, "fx_cross"): 20.0,
    (Regulator.NFA, "metal"): 20.0,
    (Regulator.NFA, "energy"): 10.0,
    (Regulator.NFA, "index"): 20.0,
    # ── ESMA ──
    (Regulator.ESMA, "fx_major"): 30.0,
    (Regulator.ESMA, "fx_cross"): 20.0,
    (Regulator.ESMA, "metal"): 20.0,
    (Regulator.ESMA, "energy"): 10.0,
    (Regulator.ESMA, "index"): 20.0,
    (Regulator.ESMA, "crypto"): 2.0,
    # ── ASIC ──
    (Regulator.ASIC, "fx_major"): 30.0,
    (Regulator.ASIC, "fx_cross"): 20.0,
    (Regulator.ASIC, "metal"): 20.0,
    # ── Unregulated (offshore brokers) ──
    (Regulator.UNREGULATED, "fx_major"): 500.0,
    (Regulator.UNREGULATED, "fx_cross"): 200.0,
    (Regulator.UNREGULATED, "metal"): 200.0,
    (Regulator.UNREGULATED, "index"): 100.0,
}


# اندازه‌ی notional در یک لات (units of base currency)
_STANDARD_LOT_UNITS: dict[str, float] = {
    "fx_major": 100_000.0,
    "fx_cross": 100_000.0,
    "metal": 100.0,   # XAU = 100 oz/lot
    "energy": 1000.0,
    "index": 1.0,     # contract per lot
}

# override به‌ازای نماد خاص (contract size متفاوت با دسته)
# نقره (XAGUSD) قرارداد 5000 oz دارد، نه 100 oz مثل طلا.
_SYMBOL_LOT_UNITS: dict[str, float] = {
    "XAGUSD": 5000.0,
}


@dataclass
class MarginValidationResult:
    """نتیجه‌ی validation margin."""

    allowed: bool
    required_margin_dollar: float
    available_margin_dollar: float
    leverage_used: float
    leverage_limit: float
    margin_level_pct: float    # equity / margin_used × 100
    stop_out_risk: bool
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "required_margin_dollar": round(self.required_margin_dollar, 2),
            "available_margin_dollar": round(self.available_margin_dollar, 2),
            "leverage_used": round(self.leverage_used, 1),
            "leverage_limit": round(self.leverage_limit, 1),
            "margin_level_pct": round(self.margin_level_pct, 1),
            "stop_out_risk": self.stop_out_risk,
            "reason": self.reason,
        }


def max_leverage_for(regulator: Regulator, instrument_category: str) -> float:
    """حد leverage برای یک رگولاتور و دسته‌ی نماد."""
    return _LEVERAGE_LIMITS.get((regulator, instrument_category), 30.0)


def required_margin(
    instrument_category: str,
    lot_size: float,
    entry_price: float,
    leverage: float,
    symbol: Optional[str] = None,
    quote_usd_rate: Optional[float] = None,
) -> float:
    """
    محاسبه‌ی margin مورد نیاز برای یک position.

    margin = notional / leverage

    محاسبه‌ی notional (به دلار) بسته به نوع pair فرق می‌کند:
        - XXX/USD (USD ارز quote، مثل EURUSD، XAUUSD): units × lot × entry_price
        - USD/XXX (USD ارز base، مثل USDJPY، USDCHF): units × lot
          (notional در ارز base یعنی همان USD است؛ ضرب در entry_price اشتباه است)
        - XXX/YYY (cross بدون USD، مثل EURGBP): units × lot × entry_price / quote_usd_rate
          (در نبود نرخ، fallback به همان units × lot × entry_price)

    contract size به‌ازای نماد خاص (مثل XAGUSD=5000) بر دسته اولویت دارد.
    """
    sym = (symbol or "").upper()
    units = _SYMBOL_LOT_UNITS.get(sym)
    if units is None:
        units = _STANDARD_LOT_UNITS.get(instrument_category, 100_000.0)

    base_notional = units * lot_size

    # تعیین جهت pair برای دسته‌های FX (متال/انرژی/index به‌صورت quote=USD رفتار می‌کنند)
    if sym.startswith("USD") and len(sym) >= 6:
        # USD/XXX → notional در ارز base (USD) است؛ نیازی به ضرب در entry_price نیست
        notional = base_notional
    elif sym.endswith("USD") or instrument_category in ("metal", "energy", "index"):
        # XXX/USD → quote currency همان USD است
        notional = base_notional * entry_price
    elif len(sym) >= 6:
        # cross بدون USD → تبدیل به دلار با نرخ quote→USD در صورت موجود بودن
        if quote_usd_rate and quote_usd_rate > 0:
            notional = base_notional * entry_price / quote_usd_rate
        else:
            notional = base_notional * entry_price
    else:
        # نماد ناشناخته → رفتار محافظه‌کارانه‌ی پیشین
        notional = base_notional * entry_price

    return notional / leverage if leverage > 0 else float("inf")


def validate_margin(
    instrument_category: str,
    lot_size: float,
    entry_price: float,
    account_equity: float,
    used_margin: float,
    regulator: Regulator = Regulator.FCA,
    requested_leverage: Optional[float] = None,
    stop_out_level_pct: float = 50.0,
    symbol: Optional[str] = None,
    quote_usd_rate: Optional[float] = None,
) -> MarginValidationResult:
    """
    اعتبارسنجی یک signal از نظر margin و leverage.

    پارامترها:
        instrument_category: "fx_major" / "fx_cross" / "metal" / ...
        lot_size: حجم درخواستی
        entry_price: قیمت ورود
        account_equity: equity فعلی (balance + unrealized PnL)
        used_margin: margin استفاده شده توسط positions باز
        regulator: رگولاتور
        requested_leverage: leverage درخواست شده (None = max for regulator)
        stop_out_level_pct: حد margin level برای stop-out (پیش‌فرض 50%)

    خروجی:
        MarginValidationResult
    """
    leverage_limit = max_leverage_for(regulator, instrument_category)
    leverage_used = (
        min(requested_leverage, leverage_limit)
        if requested_leverage is not None
        else leverage_limit
    )

    req_margin = required_margin(
        instrument_category,
        lot_size,
        entry_price,
        leverage_used,
        symbol=symbol,
        quote_usd_rate=quote_usd_rate,
    )
    available = account_equity - used_margin

    # ── Check 1: leverage exceeds regulator ──
    if requested_leverage is not None and requested_leverage > leverage_limit:
        return MarginValidationResult(
            allowed=False,
            required_margin_dollar=req_margin,
            available_margin_dollar=available,
            leverage_used=requested_leverage,
            leverage_limit=leverage_limit,
            margin_level_pct=0.0,
            stop_out_risk=False,
            reason=(
                f"leverage درخواست‌شده ({requested_leverage}:1) از حد "
                f"{regulator.value.upper()} ({leverage_limit}:1) عبور می‌کند."
            ),
        )

    # ── Check 2: کافی نبودن margin ──
    if req_margin > available:
        return MarginValidationResult(
            allowed=False,
            required_margin_dollar=req_margin,
            available_margin_dollar=available,
            leverage_used=leverage_used,
            leverage_limit=leverage_limit,
            margin_level_pct=0.0,
            stop_out_risk=True,
            reason=(
                f"margin مورد نیاز (${req_margin:.0f}) بیش از موجودی "
                f"(${available:.0f}) است."
            ),
        )

    # ── Check 3: stop-out risk ──
    total_margin_after = used_margin + req_margin
    if total_margin_after > 0:
        margin_level = (account_equity / total_margin_after) * 100.0
    else:
        margin_level = float("inf")

    # margin level باید حداقل 2× stop-out level باشد (safety buffer)
    safe_min = stop_out_level_pct * 2.0
    if margin_level < safe_min:
        return MarginValidationResult(
            allowed=False,
            required_margin_dollar=req_margin,
            available_margin_dollar=available,
            leverage_used=leverage_used,
            leverage_limit=leverage_limit,
            margin_level_pct=margin_level,
            stop_out_risk=True,
            reason=(
                f"margin level بعد از این trade ({margin_level:.0f}%) "
                f"به stop-out نزدیک است (حد ایمن {safe_min:.0f}%)."
            ),
        )

    return MarginValidationResult(
        allowed=True,
        required_margin_dollar=req_margin,
        available_margin_dollar=available,
        leverage_used=leverage_used,
        leverage_limit=leverage_limit,
        margin_level_pct=margin_level,
        stop_out_risk=False,
    )
