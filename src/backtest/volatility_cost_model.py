"""
Cost model پیشرفته با volatility-adjustment.

منطق متخصص بازار:
    در NFP، FOMC، CPI و سایر news events:
        - اسپرد EURUSD از 1 pip به 5-10 pips می‌رود
        - Slippage در stop-out از 2 pip به 8-15 pips
        - Probability of rejection up to 30%

    backtest سنتی این را زیر-تخمین می‌زند → live performance ~۲۰-۳۰٪
    بدتر از backtest. این ماژول اصلاح می‌کند.

    Formula اصلاحی:
        spread_actual = spread_base × (1 + 4 × (vol_percentile ^ 1.5))
        slippage_stop = base × (1 + 3 × vol_percentile)
        partial_fill_pct = max(0.5, 1 - lot_size × 0.1) if lot > 2

References:
    Almgren & Chriss (2001) "Optimal Execution of Portfolio Transactions"
    Hasbrouck (2007) "Empirical Market Microstructure"
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from src.backtest.cost_model import CostModel, SymbolCostProfile


@dataclass
class ExecutionResult:
    """نتیجه‌ی execution یک order."""

    requested_lot: float
    filled_lot: float
    fill_pct: float
    entry_price_actual: float
    spread_pips: float
    slippage_pips: float
    rejected: bool
    rejection_reason: str = ""

    def to_dict(self) -> dict:
        return {
            "requested_lot": round(self.requested_lot, 4),
            "filled_lot": round(self.filled_lot, 4),
            "fill_pct": round(self.fill_pct, 3),
            "entry_price_actual": round(self.entry_price_actual, 5),
            "spread_pips": round(self.spread_pips, 2),
            "slippage_pips": round(self.slippage_pips, 2),
            "rejected": self.rejected,
            "rejection_reason": self.rejection_reason,
        }


class VolatilityAdjustedCostModel(CostModel):
    """
    Cost model پیشرفته با dynamic spread، slippage، و partial fills.

    تفاوت با CostModel ساده:
        1. spread بر اساس volatility_percentile مقیاس می‌شود (1× تا 5×)
        2. stop_slippage در high-vol چندبرابر
        3. partial fills برای large orders
        4. rejection probability در volatility extreme
    """

    def __init__(
        self,
        profiles: Optional[dict[str, SymbolCostProfile]] = None,
        max_spread_multiplier: float = 5.0,
        max_slippage_multiplier: float = 4.0,
        large_order_threshold_lot: float = 2.0,
    ) -> None:
        super().__init__(profiles)
        self._max_spread_mult = max_spread_multiplier
        self._max_slip_mult = max_slippage_multiplier
        self._large_order_threshold = large_order_threshold_lot

    # ── Dynamic Spread ─────────────────────────────────

    def adjusted_spread_pips(self, symbol: str, volatility_percentile: float) -> float:
        """
        اسپرد تنظیم‌شده با volatility.

        volatility_percentile ∈ [0, 1]:
            0.0 = آرام‌ترین roomanly (median اسپرد)
            0.95 = volatility spike (3× اسپرد)
            0.99 = news event (5× اسپرد)

        منحنی: spread × (1 + 4 × p^1.5) → smooth curve
        """
        base = self.profile(symbol).spread_pips
        p = max(0.0, min(1.0, volatility_percentile))
        multiplier = 1.0 + (self._max_spread_mult - 1.0) * (p ** 1.5)
        return base * multiplier

    # ── Dynamic Slippage ───────────────────────────────

    def adjusted_entry_slippage_pips(
        self, symbol: str, volatility_percentile: float
    ) -> float:
        """slippage entry با volatility مقیاس."""
        base = self.profile(symbol).entry_slippage_pips
        p = max(0.0, min(1.0, volatility_percentile))
        return base * (1.0 + 2.0 * p)

    def adjusted_stop_slippage_pips(
        self, symbol: str, volatility_percentile: float
    ) -> float:
        """
        slippage stop-out — خصوصاً مهم در news.

        دلیل: وقتی panic selling است، broker نمی‌تواند stop order را
        دقیقاً اجرا کند → fill چند pip بدتر.
        """
        base = self.profile(symbol).stop_slippage_pips
        p = max(0.0, min(1.0, volatility_percentile))
        return base * (1.0 + (self._max_slip_mult - 1.0) * p)

    # ── Partial Fill ───────────────────────────────────

    def estimate_fill_percentage(
        self,
        symbol: str,
        lot_size: float,
        volatility_percentile: float,
    ) -> float:
        """
        تخمین درصد fill برای یک order.

        منطق:
            - lot ≤ threshold: 100% fill
            - lot > threshold: کاهش خطی
            - در high-vol: کاهش بیشتر

        fill_pct = max(0.3, 1 - (excess_lot × 0.1) - (vol × 0.2))
        """
        if lot_size <= self._large_order_threshold:
            base_fill = 1.0
        else:
            excess = lot_size - self._large_order_threshold
            base_fill = max(0.5, 1.0 - excess * 0.1)

        vol_penalty = volatility_percentile * 0.2
        return max(0.3, base_fill - vol_penalty)

    # ── Rejection Probability ──────────────────────────

    def rejection_probability(
        self,
        lot_size: float,
        volatility_percentile: float,
    ) -> float:
        """
        احتمال رد شدن order توسط broker.

        در news events: تا 30٪ orders را reject می‌کنند.
        Large orders بیشتر در معرض رد هستند.
        """
        base_rejection = 0.05 * volatility_percentile  # max 5% در high vol
        # large order penalty
        if lot_size > self._large_order_threshold:
            excess = lot_size - self._large_order_threshold
            size_penalty = min(excess * 0.05, 0.25)
        else:
            size_penalty = 0.0
        return min(base_rejection + size_penalty, 0.7)

    # ── Combined: simulate execution ───────────────────

    def simulate_execution(
        self,
        symbol: str,
        direction: str,
        mid_price: float,
        lot_size: float,
        volatility_percentile: float,
        deterministic: bool = False,
        rng_seed: Optional[int] = None,
    ) -> ExecutionResult:
        """
        شبیه‌سازی execution یک order با تمام عوامل.

        پارامترها:
            symbol, direction, mid_price: مشخصات order
            lot_size: حجم درخواستی
            volatility_percentile: 0 (آرام) تا 1 (news)
            deterministic: اگر True، رد نشدن و fill کامل (برای test)
            rng_seed: seed برای reproducibility

        خروجی: ExecutionResult
        """
        import random
        p = self.profile(symbol)
        pip = p.pip_size

        rng = random.Random(rng_seed) if rng_seed is not None else random.Random()

        # rejection
        if not deterministic:
            reject_prob = self.rejection_probability(lot_size, volatility_percentile)
            if rng.random() < reject_prob:
                return ExecutionResult(
                    requested_lot=lot_size,
                    filled_lot=0.0,
                    fill_pct=0.0,
                    entry_price_actual=0.0,
                    spread_pips=0.0,
                    slippage_pips=0.0,
                    rejected=True,
                    rejection_reason=f"broker_rejection (prob={reject_prob:.2%})",
                )

        # partial fill
        fill_pct = (
            1.0 if deterministic
            else self.estimate_fill_percentage(symbol, lot_size, volatility_percentile)
        )
        filled_lot = round(lot_size * fill_pct, 4)

        # spread
        spread = self.adjusted_spread_pips(symbol, volatility_percentile)
        half_spread_price = spread * 0.5 * pip

        # entry slippage
        entry_slip = self.adjusted_entry_slippage_pips(symbol, volatility_percentile)
        entry_slip_price = entry_slip * pip

        if direction == "long":
            entry_actual = mid_price + half_spread_price + entry_slip_price
        else:
            entry_actual = mid_price - half_spread_price - entry_slip_price

        return ExecutionResult(
            requested_lot=lot_size,
            filled_lot=filled_lot,
            fill_pct=fill_pct,
            entry_price_actual=entry_actual,
            spread_pips=spread,
            slippage_pips=entry_slip,
            rejected=False,
        )
