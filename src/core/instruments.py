"""
ثابت‌های مرکزی per-symbol — pip size، ارزش پیپ، contract size، اسپرد، حداقل‌استاپ.

منبعِ واحدِ مشخصاتِ تجاریِ هر ابزار. سایر ماژول‌ها از اینجا import می‌کنند.

دو لایه:
  ۱) مقادیرِ ثابتِ تحقیق‌شده (پیش‌فرضِ بازارِ استاندارد) — همیشه موجود.
  ۲) overlayِ بروکر: EAِ MT5 مشخصاتِ *واقعیِ* بروکر (contract_size، tick_value،
     stops_level، spread) را گزارش می‌کند → روی مقادیرِ ثابت می‌نشیند (دقیق‌تر،
     خودکار-اصلاح، و نمادهای جدید را هم پوشش می‌دهد). چون contract size/tick value
     بینِ بروکرها فرق دارد (مثلاً شاخص‌ها $۱ تا $۲۰ به ازای هر پوینت)، تنها منبعِ
     دقیق همان بروکر است.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class InstrumentSpec:
    """مشخصات تجاری یک ابزار."""

    symbol: str
    pip_size: float                # اندازه‌ی یک پیپ در فضای قیمت
    pip_dollar_per_lot: float      # دلار سود/زیان به ازای ۱ پیپ × ۱ لات استاندارد
    display_name_fa: str           # نام فارسی برای نمایش
    category: str                  # fx_major/fx_cross/metal/energy/index
    decimals: int                  # تعداد رقم اعشار برای نمایش
    contract_size: float = 100000.0      # واحدِ پایه به ازای ۱ لات
    typical_spread_pips: float = 2.0     # اسپردِ متوسط (پیپ) — برای بافرِ SL
    min_stop_pips: float = 5.0           # حداقلِ فاصلهٔ مجازِ استاپ از قیمت (پیپ)
    source: str = "static"               # static | broker


# ── مقادیرِ ثابتِ تحقیق‌شده (پیش‌فرضِ بازارِ استاندارد) ───────────────
# contract_size بر اساسِ استانداردِ صنعت: FX=100k، طلا=100oz، نقره=5000oz،
# نفتِ WTI=1000 بشکه، گازِ طبیعی=10000 MMBtu، شاخص‌های CFD=1 ($/point، بروکر-محور).
_INSTRUMENTS: Dict[str, InstrumentSpec] = {
    # ── FX Majors (USD-quoted) ──
    "EURUSD": InstrumentSpec("EURUSD", 0.0001, 10.0, "یورو/دلار",     "fx_major", 5, 100000, 1.2, 5),
    "GBPUSD": InstrumentSpec("GBPUSD", 0.0001, 10.0, "پوند/دلار",    "fx_major", 5, 100000, 1.5, 5),
    "AUDUSD": InstrumentSpec("AUDUSD", 0.0001, 10.0, "استرالیا/دلار","fx_major", 5, 100000, 1.5, 5),
    "NZDUSD": InstrumentSpec("NZDUSD", 0.0001, 10.0, "نیوزیلند/دلار","fx_major", 5, 100000, 2.0, 5),
    "USDJPY": InstrumentSpec("USDJPY", 0.01,    9.0, "دلار/ین",       "fx_major", 3, 100000, 1.5, 5),
    "USDCHF": InstrumentSpec("USDCHF", 0.0001, 11.0, "دلار/فرانک",    "fx_major", 5, 100000, 2.0, 5),
    "USDCAD": InstrumentSpec("USDCAD", 0.0001,  7.5, "دلار/کانادا",   "fx_major", 5, 100000, 2.0, 5),
    # ── FX Crosses ──
    "EURGBP": InstrumentSpec("EURGBP", 0.0001, 12.5, "یورو/پوند",    "fx_cross", 5, 100000, 2.0, 5),
    "EURJPY": InstrumentSpec("EURJPY", 0.01,    9.0, "یورو/ین",       "fx_cross", 3, 100000, 2.0, 5),
    "GBPJPY": InstrumentSpec("GBPJPY", 0.01,    9.0, "پوند/ین",       "fx_cross", 3, 100000, 2.5, 5),
    "AUDJPY": InstrumentSpec("AUDJPY", 0.01,    9.0, "استرالیا/ین",   "fx_cross", 3, 100000, 2.0, 5),
    "EURAUD": InstrumentSpec("EURAUD", 0.0001,  7.0, "یورو/استرالیا","fx_cross", 5, 100000, 2.5, 5),
    # ── Metals ── (طلا ۱۰۰oz، نقره ۵۰۰۰oz)
    "XAUUSD": InstrumentSpec("XAUUSD", 0.1,   10.0, "طلا",            "metal", 2, 100,   3.0, 10),
    "XAGUSD": InstrumentSpec("XAGUSD", 0.01,  50.0, "نقره",           "metal", 3, 5000,  4.0, 10),
    # ── Energy ── (WTI ۱۰۰۰ بشکه، گاز ۱۰۰۰۰ MMBtu)
    "XTIUSD": InstrumentSpec("XTIUSD", 0.01,  10.0, "نفت WTI",       "energy", 2, 1000,  5.0, 10),
    "XNGUSD": InstrumentSpec("XNGUSD", 0.001, 10.0, "گاز طبیعی",     "energy", 3, 10000, 5.0, 10),
    # ── Indices (CFD، $/point — contract/tick بروکر-محور، overlayِ بروکر اصلاح می‌کند) ──
    "US30":   InstrumentSpec("US30",   1.0,    1.0, "داوجونز",       "index", 1, 1, 4.0, 10),
    "US500":  InstrumentSpec("US500",  0.1,    1.0, "اس‌اندپی ۵۰۰",  "index", 1, 1, 1.0, 10),
    "NAS100": InstrumentSpec("NAS100", 0.1,    1.0, "نزدک",           "index", 1, 1, 2.0, 10),
    "DE40":   InstrumentSpec("DE40",   0.1,    1.0, "داکس آلمان",    "index", 1, 1, 3.0, 10),
}


# ── overlayِ بروکر (پر می‌شود از مشخصاتِ واقعیِ گزارش‌شدهٔ EA) ──
_BROKER_OVERLAY: Dict[str, InstrumentSpec] = {}


_FALLBACK = InstrumentSpec(
    symbol="UNKNOWN", pip_size=0.0001, pip_dollar_per_lot=10.0,
    display_name_fa="نامشخص", category="unknown", decimals=5,
    contract_size=100000.0, typical_spread_pips=3.0, min_stop_pips=5.0,
)


def apply_broker_spec(symbol: str, *, contract_size: float | None = None,
                      pip_size: float | None = None, pip_dollar_per_lot: float | None = None,
                      spread_pips: float | None = None, min_stop_pips: float | None = None) -> None:
    """مشخصاتِ واقعیِ بروکر را روی پیش‌فرضِ ثابت می‌نشاند (EA گزارش می‌دهد).
    فقط فیلدهای معتبر جایگزین می‌شوند؛ بقیه از ثابت/قبلی می‌ماند."""
    base = _BROKER_OVERLAY.get(symbol) or _INSTRUMENTS.get(symbol) or dataclasses.replace(_FALLBACK, symbol=symbol)
    upd = {"source": "broker"}
    if contract_size and contract_size > 0:
        upd["contract_size"] = float(contract_size)
    if pip_size and pip_size > 0:
        upd["pip_size"] = float(pip_size)
    if pip_dollar_per_lot and pip_dollar_per_lot > 0:
        upd["pip_dollar_per_lot"] = float(pip_dollar_per_lot)
    if spread_pips is not None and spread_pips >= 0:
        upd["typical_spread_pips"] = float(spread_pips)
    if min_stop_pips is not None and min_stop_pips >= 0:
        upd["min_stop_pips"] = float(min_stop_pips)
    _BROKER_OVERLAY[symbol] = dataclasses.replace(base, **upd)


def get_instrument(symbol: str) -> InstrumentSpec:
    """spec یک نماد — overlayِ بروکر اولویت دارد، سپس ثابت، سپس fallback."""
    return _BROKER_OVERLAY.get(symbol) or _INSTRUMENTS.get(symbol) or dataclasses.replace(_FALLBACK, symbol=symbol)


def pip_size_of(symbol: str) -> float:
    return get_instrument(symbol).pip_size


def static_pip_size_of(symbol: str) -> float:
    """pip_sizeِ مرسومِ ثابت (بدونِ overlayِ بروکر) — برای حفظِ سازگاریِ تاریخیِ
    شمارشِ پیپ. overlayِ بروکر pip_size را تغییر نمی‌دهد، فقط مقادیرِ دلاری/اسپرد را."""
    spec = _INSTRUMENTS.get(symbol)
    return spec.pip_size if spec else 0.0001


def pip_dollar_of(symbol: str) -> float:
    return get_instrument(symbol).pip_dollar_per_lot


def contract_size_of(symbol: str) -> float:
    return get_instrument(symbol).contract_size


def spread_pips_of(symbol: str) -> float:
    return get_instrument(symbol).typical_spread_pips


def min_stop_pips_of(symbol: str) -> float:
    return get_instrument(symbol).min_stop_pips


def display_name_fa(symbol: str) -> str:
    return get_instrument(symbol).display_name_fa


def all_symbols() -> list[str]:
    return list(_INSTRUMENTS.keys())
