"""
Position sizing — Kelly criterion، fixed-fractional، volatility-targeting.

منطق متخصص بازار:
    اندازه‌ی معامله بزرگ‌ترین عامل تعیین‌کننده‌ی Sharpe ratio طولانی‌مدت است.
    حتی استراتژی با expectancy مثبت با sizing اشتباه می‌تواند ruin شود.

    سه روش استاندارد:

    1. Fixed-Fractional (ساده، محبوب):
       Risk per trade = X% از equity
       size = risk_dollar / sl_pips / pip_value

    2. Kelly Criterion (theoretical optimal):
       f* = (b·p - q) / b
       p = win_rate, q = 1-p, b = avg_win / |avg_loss|
       practical: استفاده از 1/4 Kelly برای protection از drawdown

    3. Volatility-Targeting:
       size = target_volatility / current_volatility
       ثابت نگه‌داشتن portfolio volatility در زمان

References:
    Kelly (1956) "A New Interpretation of Information Rate"
    Thorp (1969) "Optimal Gambling Systems for Favorable Games"
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class SizingMethod(str, Enum):
    """روش sizing."""

    FIXED_FRACTIONAL = "fixed_fractional"
    KELLY = "kelly"
    FRACTIONAL_KELLY = "fractional_kelly"  # 1/4 یا 1/2 Kelly
    VOLATILITY_TARGET = "volatility_target"
    FIXED_LOT = "fixed_lot"


@dataclass
class SizingResult:
    """نتیجه‌ی محاسبه‌ی size."""

    method: SizingMethod
    lot_size: float
    risk_dollar: float
    risk_pct: float
    capped: bool = False
    cap_reason: str = ""
    notes: list[str] = None

    def __post_init__(self):
        if self.notes is None:
            self.notes = []

    def to_dict(self) -> dict:
        return {
            "method": self.method.value,
            "lot_size": round(self.lot_size, 4),
            "risk_dollar": round(self.risk_dollar, 2),
            "risk_pct": round(self.risk_pct * 100, 3),
            "capped": self.capped,
            "cap_reason": self.cap_reason,
            "notes": list(self.notes),
        }


class PositionSizer:
    """
    محاسبه‌ی اندازه‌ی position.

    این کلاس یک facade است که روش‌های مختلف sizing را hide می‌کند.
    پیکربندی default = fixed-fractional 1%.
    """

    def __init__(
        self,
        max_risk_per_trade_pct: float = 2.0,
        min_lot: float = 0.01,
        max_lot: float = 50.0,
    ) -> None:
        self._max_risk_pct = max_risk_per_trade_pct / 100.0
        self._min_lot = min_lot
        self._max_lot = max_lot

    # ── Fixed-Fractional ─────────────────────────────────

    def fixed_fractional(
        self,
        account_equity: float,
        risk_pct: float,
        sl_pips: float,
        pip_dollar_per_lot: float,
    ) -> SizingResult:
        """
        Fixed-fractional: X% از equity در ریسک.

        lot = (equity × risk_pct) / (sl_pips × pip_dollar_per_lot)
        """
        if account_equity <= 0 or sl_pips <= 0 or pip_dollar_per_lot <= 0:
            return SizingResult(
                method=SizingMethod.FIXED_FRACTIONAL,
                lot_size=self._min_lot,
                risk_dollar=0.0,
                risk_pct=0.0,
                capped=True,
                cap_reason="invalid_inputs",
            )

        risk_pct_capped = min(risk_pct / 100.0, self._max_risk_pct)
        risk_dollar = account_equity * risk_pct_capped
        raw_lot = risk_dollar / (sl_pips * pip_dollar_per_lot)

        lot, capped, reason = self._apply_caps(raw_lot)
        actual_risk = lot * sl_pips * pip_dollar_per_lot

        return SizingResult(
            method=SizingMethod.FIXED_FRACTIONAL,
            lot_size=lot,
            risk_dollar=actual_risk,
            risk_pct=actual_risk / account_equity if account_equity > 0 else 0.0,
            capped=capped,
            cap_reason=reason,
        )

    # ── Kelly Criterion ──────────────────────────────────

    def kelly(
        self,
        account_equity: float,
        win_rate: float,
        avg_win: float,
        avg_loss: float,
        sl_pips: float,
        pip_dollar_per_lot: float,
        fraction: float = 0.25,
    ) -> SizingResult:
        """
        Kelly criterion — با fraction برای محافظت از over-betting.

        f* = (b·p - q) / b, where b = avg_win/|avg_loss|, p = win_rate
        actual_f = fraction × f* (پیش‌فرض 1/4 Kelly)

        منطق fraction:
            Full Kelly = maximizes geometric growth ولی drawdown پر-ریسک
            1/2 Kelly = 75% growth با 50% volatility
            1/4 Kelly = 56% growth با 25% volatility (industry standard)
        """
        if account_equity <= 0 or avg_loss >= 0 or win_rate <= 0 or win_rate >= 1:
            return SizingResult(
                method=SizingMethod.FRACTIONAL_KELLY,
                lot_size=self._min_lot,
                risk_dollar=0.0,
                risk_pct=0.0,
                capped=True,
                cap_reason="invalid_kelly_inputs",
            )

        b = avg_win / abs(avg_loss)
        q = 1.0 - win_rate
        kelly_f = (b * win_rate - q) / b

        notes: list[str] = []
        if kelly_f <= 0:
            # negative expectancy → don't trade
            return SizingResult(
                method=SizingMethod.FRACTIONAL_KELLY,
                lot_size=0.0,
                risk_dollar=0.0,
                risk_pct=0.0,
                capped=True,
                cap_reason="negative_kelly_expectancy",
                notes=[
                    f"Kelly={kelly_f:.3f} منفی است — استراتژی edge ندارد، معامله نشود."
                ],
            )

        actual_f = fraction * kelly_f
        # cap به max_risk_pct
        if actual_f > self._max_risk_pct:
            notes.append(
                f"Kelly fraction ({actual_f:.3f}) به max_risk_pct ({self._max_risk_pct}) محدود شد."
            )
            actual_f = self._max_risk_pct

        risk_dollar = account_equity * actual_f
        raw_lot = risk_dollar / (sl_pips * pip_dollar_per_lot)
        lot, capped, reason = self._apply_caps(raw_lot)
        actual_risk = lot * sl_pips * pip_dollar_per_lot

        notes.append(f"Kelly f* = {kelly_f:.3f}, used = {actual_f:.3f} ({fraction}× Kelly)")

        return SizingResult(
            method=SizingMethod.FRACTIONAL_KELLY,
            lot_size=lot,
            risk_dollar=actual_risk,
            risk_pct=actual_risk / account_equity,
            capped=capped or actual_f >= self._max_risk_pct,
            cap_reason=reason,
            notes=notes,
        )

    # ── Volatility-Targeting ─────────────────────────────

    def volatility_target(
        self,
        account_equity: float,
        target_annual_vol_pct: float,
        current_annualized_volatility: float,
        sl_pips: float,
        pip_dollar_per_lot: float,
    ) -> SizingResult:
        """
        Vol-targeting: ثابت نگه‌داشتن portfolio volatility.

        فرض ساده: σ_position ∝ lot
        size_scaling = target_vol / current_vol

        اگر بازار آرام (low vol)، سایز بزرگ‌تر.
        اگر بازار طوفانی (high vol)، سایز کوچک‌تر.
        """
        if (
            account_equity <= 0
            or current_annualized_volatility <= 0
            or sl_pips <= 0
            or pip_dollar_per_lot <= 0
        ):
            return SizingResult(
                method=SizingMethod.VOLATILITY_TARGET,
                lot_size=self._min_lot,
                risk_dollar=0.0,
                risk_pct=0.0,
                capped=True,
                cap_reason="invalid_vol_inputs",
            )

        scaling = (target_annual_vol_pct / 100.0) / current_annualized_volatility
        # base size = 1% risk (baseline)
        base_risk = account_equity * 0.01
        adjusted_risk = base_risk * scaling

        # cap به max_risk_pct
        max_risk = account_equity * self._max_risk_pct
        if adjusted_risk > max_risk:
            adjusted_risk = max_risk

        raw_lot = adjusted_risk / (sl_pips * pip_dollar_per_lot)
        lot, capped, reason = self._apply_caps(raw_lot)
        actual_risk = lot * sl_pips * pip_dollar_per_lot

        return SizingResult(
            method=SizingMethod.VOLATILITY_TARGET,
            lot_size=lot,
            risk_dollar=actual_risk,
            risk_pct=actual_risk / account_equity,
            capped=capped,
            cap_reason=reason,
            notes=[
                f"target_vol={target_annual_vol_pct}%, current_vol={current_annualized_volatility:.4f}, "
                f"scaling={scaling:.2f}×"
            ],
        )

    # ── helpers ─────────────────────────────────────────

    def _apply_caps(self, raw_lot: float) -> tuple[float, bool, str]:
        """اعمال min/max lot."""
        if raw_lot < self._min_lot:
            return self._min_lot, True, f"below_min_lot ({self._min_lot})"
        if raw_lot > self._max_lot:
            return self._max_lot, True, f"above_max_lot ({self._max_lot})"
        # round به ۲ رقم اعشار (0.01 lot precision)
        return round(raw_lot, 2), False, ""


def reduce_size_for_drawdown(
    base_lot: float,
    current_drawdown_pct: float,
    reduction_threshold_pct: float = 5.0,
    max_reduction: float = 0.5,
) -> tuple[float, str]:
    """
    کاهش size در drawdown — anti-martingale.

    منطق:
        - drawdown کمتر از threshold: size تغییر نمی‌کند
        - drawdown بیش از threshold: کاهش خطی تا max_reduction
        - این جلوگیری از over-betting در دوره‌ی losing streak است

    مثال:
        threshold=5%, max_reduction=0.5 → اگر DD=20%، size = 50%
    """
    if current_drawdown_pct <= reduction_threshold_pct:
        return base_lot, ""

    # خطی: 5% DD → 0% reduction, 20% DD → 50% reduction
    excess = current_drawdown_pct - reduction_threshold_pct
    # max excess = 20% - 5% = 15%
    reduction_factor = min(excess / 15.0 * max_reduction, max_reduction)
    new_lot = base_lot * (1.0 - reduction_factor)
    note = f"drawdown_reduction: DD={current_drawdown_pct:.1f}%, factor={reduction_factor:.2f}"
    return round(new_lot, 2), note
