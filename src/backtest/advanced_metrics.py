"""
متریک‌های پیشرفته — MAR، Omega، Ulcer، Tail، PSR، DSR.

این‌ها در نسخه‌ی basic metrics.py نیستند چون نیاز به sample بیشتر و
محاسبات پیچیده‌تر دارند. مناسب برای reporting institutional-grade.

References:
    Bailey & López de Prado (2012) "The Sharpe Ratio Efficient Frontier"
    Bailey & López de Prado (2014) "The Deflated Sharpe Ratio"
    Acerbi & Tasche (2002) "Expected Shortfall"
    Keating & Shadwick (2002) "An Introduction to Omega"
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Sequence

import numpy as np


@dataclass
class AdvancedMetrics:
    """متریک‌های institutional-grade."""

    # Drawdown-based
    mar_ratio: float = 0.0
    """CAGR / |Max DD| — managed-account return"""

    calmar_ratio: float = 0.0
    """مشابه MAR ولی روی ۳۶ ماه اخیر — Calmar اصلی"""

    ulcer_index: float = 0.0
    """sqrt(mean(drawdown²)) — penalize prolonged DD"""

    # Distribution
    omega_ratio: float = 0.0
    """gains_above_threshold / losses_below_threshold (asymmetric)"""

    tail_ratio: float = 0.0
    """95th_percentile_gain / |5th_percentile_loss|"""

    # Statistical confidence
    probabilistic_sharpe_ratio: float = 0.0
    """احتمال اینکه Sharpe واقعی > benchmark (مثلاً ۰)"""

    deflated_sharpe_ratio: float = 0.0
    """PSR تعدیل‌شده برای multiple testing"""

    # Higher moments
    skewness: float = 0.0
    excess_kurtosis: float = 0.0

    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "mar_ratio": round(self.mar_ratio, 3),
            "calmar_ratio": round(self.calmar_ratio, 3),
            "ulcer_index": round(self.ulcer_index, 4),
            "omega_ratio": round(self.omega_ratio, 3),
            "tail_ratio": round(self.tail_ratio, 3),
            "probabilistic_sharpe_ratio": round(self.probabilistic_sharpe_ratio, 4),
            "deflated_sharpe_ratio": round(self.deflated_sharpe_ratio, 4),
            "skewness": round(self.skewness, 3),
            "excess_kurtosis": round(self.excess_kurtosis, 3),
            "notes": list(self.notes),
        }


def compute_advanced_metrics(
    returns: Sequence[float],
    periods_per_year: int = 252,
    threshold: float = 0.0,
    n_trials: int = 1,
) -> AdvancedMetrics:
    """
    محاسبه تمام advanced metrics از یک series of returns.

    پارامترها:
        returns: per-period returns (مثلاً daily PnL درصد یا R-multiple)
        periods_per_year: ۲۵۲ برای daily، ۵۲ برای weekly
        threshold: Omega threshold (پیش‌فرض = ۰ → MAR)
        n_trials: تعداد strategy‌های اکیپ شده — برای DSR multiple testing

    خروجی: AdvancedMetrics
    """
    n = len(returns)
    if n < 2:
        return AdvancedMetrics(notes=["sample too small"])

    arr = np.asarray(returns, dtype=float)
    metrics = AdvancedMetrics()

    # ── Cumulative equity curve (مرکب — فرض: بازده‌های کسریِ per-period) ──
    # قبلاً cumsum (افزایشی) بود که drawdown/MAR را بُعدی-غلط می‌کرد.
    def _compound_stats(r: np.ndarray, ppy: int) -> tuple[float, float]:
        """(CAGR, max_drawdown_pct) از یک سری بازده کسری."""
        if r.size < 1:
            return 0.0, 0.0
        eq = np.cumprod(1.0 + r)
        pk = np.maximum.accumulate(eq)
        dd_pct = (pk - eq) / np.where(pk > 0, pk, 1.0)
        mdd = float(dd_pct.max())
        yrs = r.size / ppy if ppy > 0 else 1.0
        end = float(eq[-1])
        cagr = (end ** (1.0 / yrs) - 1.0) if (yrs > 0 and end > 0) else 0.0
        return cagr, mdd

    equity = np.cumprod(1.0 + arr)
    peak = np.maximum.accumulate(equity)
    drawdown_pct = (peak - equity) / np.where(peak > 0, peak, 1.0)
    max_dd = float(drawdown_pct.max())
    metrics.ulcer_index = float(np.sqrt((drawdown_pct ** 2).mean()))

    # ── MAR / Calmar (CAGR / |MaxDD%|) ──
    annual_return, _ = _compound_stats(arr, periods_per_year)

    if max_dd > 1e-9:
        metrics.mar_ratio = annual_return / max_dd
        # Calmar: ۳۶ ماه اخیر
        cutoff = min(n, periods_per_year * 3)
        recent_arr = arr[-cutoff:] if cutoff > 1 else arr
        recent_cagr, recent_max_dd = _compound_stats(recent_arr, periods_per_year)
        metrics.calmar_ratio = (
            recent_cagr / recent_max_dd if recent_max_dd > 1e-9 else 0.0
        )

    # ── Omega ratio ──
    metrics.omega_ratio = compute_omega(arr, threshold=threshold)

    # ── Tail ratio ──
    metrics.tail_ratio = compute_tail_ratio(arr)

    # ── Higher moments ──
    if n >= 4:
        metrics.skewness = _skewness(arr)
        metrics.excess_kurtosis = _excess_kurtosis(arr)

    # ── PSR ──
    sharpe = _annualized_sharpe(arr, periods_per_year)
    metrics.probabilistic_sharpe_ratio = compute_psr(
        sharpe, arr, periods_per_year, benchmark_sr=0.0
    )

    # ── DSR (with multiple-testing deflator) ──
    if n_trials > 1:
        metrics.deflated_sharpe_ratio = compute_dsr(
            sharpe, arr, periods_per_year, n_trials=n_trials,
        )
    else:
        metrics.deflated_sharpe_ratio = metrics.probabilistic_sharpe_ratio

    return metrics


# ===========================================================================
# Individual metric functions
# ===========================================================================


def compute_omega(returns: Sequence[float], threshold: float = 0.0) -> float:
    """
    Omega ratio: integral_above_threshold / integral_below_threshold.

    Discrete version: sum(max(r - threshold, 0)) / sum(max(threshold - r, 0))

    Interpretation:
        Omega = 1 → just breakeven
        Omega > 1 → expected gains > expected losses (at threshold)
        Omega < 1 → strategy loses

    مزیت بر Sharpe: بدون فرض normal، تمام moments distribution را capture
    می‌کند.
    """
    arr = np.asarray(returns, dtype=float)
    if len(arr) == 0:
        return 0.0
    gains = float(np.maximum(arr - threshold, 0).sum())
    losses = float(np.maximum(threshold - arr, 0).sum())
    if losses <= 1e-12:
        return float("inf") if gains > 0 else 0.0
    return gains / losses


def compute_tail_ratio(returns: Sequence[float]) -> float:
    """
    Tail ratio = abs(95th percentile gain) / abs(5th percentile loss).

    Interpretation:
        > 1.0 → upside tail بزرگ‌تر از downside (مطلوب)
        < 1.0 → downside tail بزرگ‌تر (خطرناک — کلاسیک "picking up nickels in
                front of a steamroller")
    """
    arr = np.asarray(returns, dtype=float)
    if len(arr) < 10:
        return 0.0
    p95 = float(np.percentile(arr, 95))
    p5 = float(np.percentile(arr, 5))
    if abs(p5) <= 1e-12:
        return float("inf") if p95 > 0 else 0.0
    return abs(p95) / abs(p5)


def compute_psr(
    sharpe: float,
    returns: Sequence[float],
    periods_per_year: int = 252,
    benchmark_sr: float = 0.0,
) -> float:
    """
    Probabilistic Sharpe Ratio (Bailey & López de Prado 2012).

    PSR = Pr(true_SR > benchmark_SR)
        = Φ( (SR_obs - SR_bench) × sqrt(n-1) / sigma_SR )

    where sigma_SR = sqrt( (1 - γ3·SR + (γ4-1)/4 · SR²) / (n-1) )
        γ3 = skewness of returns
        γ4 = kurtosis of returns

    Interpretation: PSR > 0.95 → ۹۵٪ اعتماد به اینکه Sharpe واقعی > benchmark
    """
    arr = np.asarray(returns, dtype=float)
    n = len(arr)
    if n < 4:
        return 0.5

    # Sharpe (per-period، نه annualized)
    sr_per_period = sharpe / math.sqrt(periods_per_year) if periods_per_year > 0 else sharpe

    skew = _skewness(arr)
    kurt = _excess_kurtosis(arr) + 3.0  # kurtosis full (نه excess)

    # variance of Sharpe estimator
    sigma_sr_sq = (
        1.0 - skew * sr_per_period + (kurt - 1.0) / 4.0 * sr_per_period ** 2
    ) / (n - 1)
    if sigma_sr_sq <= 0:
        return 0.5
    sigma_sr = math.sqrt(sigma_sr_sq)

    benchmark_per_period = (
        benchmark_sr / math.sqrt(periods_per_year) if periods_per_year > 0 else benchmark_sr
    )
    z = (sr_per_period - benchmark_per_period) / sigma_sr
    return _normal_cdf(z)


def compute_dsr(
    sharpe: float,
    returns: Sequence[float],
    periods_per_year: int = 252,
    n_trials: int = 1,
) -> float:
    """
    Deflated Sharpe Ratio (Bailey & López de Prado 2014).

    DSR = PSR adjusted for the "selection bias" when picking the best of
    N back-tested strategies. تنها روش drama-free برای guarding against
    overfitting in multi-strategy backtests.

    Higher n_trials → more conservative PSR.

    Implementation: تخمین expected max Sharpe under H0 از n_trials random
    و سپس PSR با benchmark = آن.
    """
    if n_trials <= 1:
        return compute_psr(sharpe, returns, periods_per_year, benchmark_sr=0.0)

    # de Prado: E[max SR_null] = σ_SR × [(1−γ)Φ⁻¹(1−1/N) + γΦ⁻¹(1−1/(N·e))]
    # که σ_SR خطای استاندارد برآوردگر Sharpe است (نه عددی ثابت).
    from scipy.stats import norm

    gamma = 0.5772156649015329  # Euler–Mascheroni
    z1 = float(norm.ppf(1.0 - 1.0 / n_trials))
    z2 = float(norm.ppf(1.0 - 1.0 / (n_trials * math.e)))
    expected_max_z = (1.0 - gamma) * z1 + gamma * z2

    n_obs = len(returns)
    # σ_SRِ سالانه تحت H0 ≈ sqrt(periods_per_year / n)
    sigma_sr_annual = math.sqrt(periods_per_year / n_obs) if n_obs > 0 else 0.0
    benchmark_annual = sigma_sr_annual * expected_max_z
    return compute_psr(sharpe, returns, periods_per_year, benchmark_sr=benchmark_annual)


# ===========================================================================
# Helpers
# ===========================================================================


def _annualized_sharpe(returns: np.ndarray, periods_per_year: int) -> float:
    if len(returns) < 2:
        return 0.0
    mean = float(returns.mean())
    std = float(returns.std(ddof=1))
    if std <= 1e-12:
        return 0.0
    return mean / std * math.sqrt(periods_per_year)


def _skewness(arr: np.ndarray) -> float:
    """skewness بر اساس تعریف Pearson (m3 / m2^1.5)."""
    n = len(arr)
    if n < 3:
        return 0.0
    mean = float(arr.mean())
    centered = arr - mean
    m2 = float((centered ** 2).mean())
    m3 = float((centered ** 3).mean())
    if m2 <= 0:
        return 0.0
    return m3 / (m2 ** 1.5)


def _excess_kurtosis(arr: np.ndarray) -> float:
    """excess kurtosis = kurtosis - 3."""
    n = len(arr)
    if n < 4:
        return 0.0
    mean = float(arr.mean())
    centered = arr - mean
    m2 = float((centered ** 2).mean())
    m4 = float((centered ** 4).mean())
    if m2 <= 0:
        return 0.0
    return m4 / (m2 ** 2) - 3.0


def _normal_cdf(x: float) -> float:
    """تقریب CDF نرمال استاندارد."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))
