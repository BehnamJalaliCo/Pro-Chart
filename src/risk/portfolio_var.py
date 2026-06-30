"""
Value at Risk (VaR) — اندازه‌گیری ریسک تجمعی portfolio.

منطق متخصص بازار:
    VaR پاسخ به پرسش: "با ۹۵٪ اعتماد، حداکثر ضرر یک روز چقدر است؟"

    دو روش استاندارد:
    1. Parametric (variance-covariance):
       فرض normal، استفاده از portfolio std × z_score
       سریع ولی فرض normal در tails صدق نمی‌کند

    2. Historical Simulation:
       Empirical distribution از returns تاریخی
       VaR = (1-confidence) percentile
       غیر-parametric ولی نیاز به sample بزرگ

    Conditional VaR (CVaR / Expected Shortfall):
        میانگین losses در بخش بدتر از VaR
        مهم‌تر از VaR برای tail risk

    اگر VaR یا CVaR بیش از حد portfolio باشد، signal جدید رد می‌شود.

References:
    Jorion (2007) "Value at Risk: The New Benchmark"
    Acerbi & Tasche (2002) "Expected Shortfall"
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Sequence

import numpy as np


@dataclass
class VaRReport:
    """گزارش VaR portfolio."""

    method: str
    confidence: float
    horizon_days: int
    portfolio_value: float
    var_dollar: float
    var_pct: float
    cvar_dollar: float
    cvar_pct: float
    n_observations: int
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "method": self.method,
            "confidence": self.confidence,
            "horizon_days": self.horizon_days,
            "portfolio_value": round(self.portfolio_value, 2),
            "var_dollar": round(self.var_dollar, 2),
            "var_pct": round(self.var_pct * 100, 3),
            "cvar_dollar": round(self.cvar_dollar, 2),
            "cvar_pct": round(self.cvar_pct * 100, 3),
            "n_observations": self.n_observations,
            "notes": list(self.notes),
        }


# ── Z-scores برای normal distribution ──
_Z_SCORES: dict[float, float] = {
    0.90: 1.282,
    0.95: 1.645,
    0.975: 1.960,
    0.99: 2.326,
    0.995: 2.576,
    0.999: 3.090,
}


def parametric_var(
    portfolio_value: float,
    returns: Sequence[float],
    confidence: float = 0.95,
    horizon_days: int = 1,
) -> VaRReport:
    """
    Parametric VaR — فرض normal distribution.

    VaR = portfolio_value × z × σ × sqrt(horizon)

    سریع ولی tail risk را underestimate می‌کند.
    """
    n = len(returns)
    if n < 2 or portfolio_value <= 0:
        return VaRReport(
            method="parametric",
            confidence=confidence,
            horizon_days=horizon_days,
            portfolio_value=portfolio_value,
            var_dollar=0.0,
            var_pct=0.0,
            cvar_dollar=0.0,
            cvar_pct=0.0,
            n_observations=n,
            notes=["داده‌ی ناکافی."],
        )

    rets = np.asarray(returns, dtype=float)
    mu = float(rets.mean())
    sigma = float(rets.std(ddof=1))

    # نزدیک‌ترین z-score
    z = _nearest_z(confidence)

    horizon_scale = np.sqrt(horizon_days)
    var_pct = z * sigma * horizon_scale - mu * horizon_days
    var_pct = max(0.0, var_pct)
    var_dollar = portfolio_value * var_pct

    # CVaR (Expected Shortfall) parametric
    # for normal: CVaR = mean + std × φ(z) / (1-confidence)
    phi_z = float(np.exp(-z * z / 2) / np.sqrt(2 * np.pi))
    cvar_pct = -mu * horizon_days + sigma * horizon_scale * (phi_z / (1 - confidence))
    cvar_pct = max(0.0, cvar_pct)
    cvar_dollar = portfolio_value * cvar_pct

    return VaRReport(
        method="parametric",
        confidence=confidence,
        horizon_days=horizon_days,
        portfolio_value=portfolio_value,
        var_dollar=var_dollar,
        var_pct=var_pct,
        cvar_dollar=cvar_dollar,
        cvar_pct=cvar_pct,
        n_observations=n,
        notes=[f"z={z:.3f}, σ={sigma:.4f}"],
    )


def historical_var(
    portfolio_value: float,
    returns: Sequence[float],
    confidence: float = 0.95,
    horizon_days: int = 1,
) -> VaRReport:
    """
    Historical VaR — empirical percentile.

    بدون فرض distribution — fat tails را به‌درستی capture می‌کند.
    نیاز به حداقل ~۲۵۰ observation برای reliable result.
    """
    n = len(returns)
    if n < 20 or portfolio_value <= 0:
        return VaRReport(
            method="historical",
            confidence=confidence,
            horizon_days=horizon_days,
            portfolio_value=portfolio_value,
            var_dollar=0.0,
            var_pct=0.0,
            cvar_dollar=0.0,
            cvar_pct=0.0,
            n_observations=n,
            notes=["نیاز به حداقل ۲۰ observation."],
        )

    # توجه: روی بازده‌های تجربی به‌صورت خام چندک می‌گیریم.
    # ضرب در sqrt(horizon) قبل از quantile یک فرض parametric را پنهان می‌کرد و
    # برای historical VaR نادرست است؛ بنابراین حذف شد.
    horizon_rets = np.sort(np.asarray(returns, dtype=float))

    # VaR = چندک (1-confidence) با درون‌یابی خطی (دقیق‌تر از int-index).
    # method="linear" (NumPy ≥ 1.22؛ نصب‌شده 2.x است — interpolation= حذف شده).
    q = float(np.percentile(horizon_rets, (1.0 - confidence) * 100.0, method="linear"))
    var_value = -q  # بازدهِ منفیِ tail → مقدار «زیان»
    var_pct = max(0.0, var_value)

    # CVaR = میانگین بازده‌های بدتر یا برابر آستانهٔ VaR
    tail_returns = horizon_rets[horizon_rets <= q]
    if tail_returns.size > 0:
        cvar_pct = max(0.0, float(-tail_returns.mean()))
    else:
        cvar_pct = var_pct

    notes = [f"n={n}, var_q={q:.5f}"]
    if horizon_days > 1:
        # افق چندروزه نیازمند overlapping windows است؛ اینجا فقط هشدار می‌دهیم.
        notes.append(
            "horizon_days>1: historical VaR بدون overlapping windows محاسبه شده — تنها افق ۱-روزه معتبر است."
        )
    if n < 250:
        notes.append("کمتر از ۲۵۰ observation — confidence پایین.")

    var_dollar = portfolio_value * var_pct
    cvar_dollar = portfolio_value * cvar_pct

    return VaRReport(
        method="historical",
        confidence=confidence,
        horizon_days=horizon_days,
        portfolio_value=portfolio_value,
        var_dollar=var_dollar,
        var_pct=var_pct,
        cvar_dollar=cvar_dollar,
        cvar_pct=cvar_pct,
        n_observations=n,
        notes=notes,
    )


def _nearest_z(confidence: float) -> float:
    """نزدیک‌ترین z-score به confidence درخواست‌شده."""
    nearest = min(_Z_SCORES.keys(), key=lambda c: abs(c - confidence))
    return _Z_SCORES[nearest]


# ── Portfolio Risk Check ────────────────────────────────


@dataclass
class PortfolioRiskCheck:
    """نتیجه‌ی بررسی ریسک portfolio برای signal جدید."""

    allowed: bool
    current_var_pct: float
    projected_var_pct: float
    var_limit_pct: float
    current_exposure_pct: float
    max_exposure_pct: float
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "current_var_pct": round(self.current_var_pct * 100, 3),
            "projected_var_pct": round(self.projected_var_pct * 100, 3),
            "var_limit_pct": round(self.var_limit_pct * 100, 3),
            "current_exposure_pct": round(self.current_exposure_pct * 100, 3),
            "max_exposure_pct": round(self.max_exposure_pct * 100, 3),
            "reason": self.reason,
        }


def check_portfolio_risk(
    portfolio_value: float,
    historical_returns: Sequence[float],
    proposed_position_risk_dollar: float,
    open_positions_risk_dollar: float,
    var_limit_pct: float = 5.0,
    exposure_limit_pct: float = 30.0,
    confidence: float = 0.95,
) -> PortfolioRiskCheck:
    """
    بررسی اینکه آیا signal جدید با VaR portfolio سازگار است.

    دو قانون:
        1. VaR projected (پس از signal) نباید از var_limit_pct بیشتر شود
        2. Total exposure (risk_dollar / portfolio_value) ≤ exposure_limit_pct

    این تابع توسط RiskGuard فراخوانی می‌شود قبل از allow کردن signal جدید.
    """
    if portfolio_value <= 0:
        return PortfolioRiskCheck(
            allowed=False,
            current_var_pct=0.0,
            projected_var_pct=0.0,
            var_limit_pct=var_limit_pct / 100.0,
            current_exposure_pct=0.0,
            max_exposure_pct=exposure_limit_pct / 100.0,
            reason="portfolio_value نامعتبر",
        )

    # محافظ: returns باید کسری باشند (مثلاً 0.01 برای ۱٪)، نه درصدِ خام.
    # میانگین |return| بزرگ‌تر از 10.0 نشانهٔ واحدِ اشتباه است و VaR را منفجر می‌کند.
    if len(historical_returns) > 0:
        mean_abs_ret = float(np.mean(np.abs(np.asarray(historical_returns, dtype=float))))
        if mean_abs_ret > 10.0:
            raise ValueError(
                f"historical_returns احتمالاً به‌جای کسری، درصد خام است (mean|ret|={mean_abs_ret:.2f})"
            )

    var = historical_var(portfolio_value, historical_returns, confidence=confidence)
    current_var_pct = var.var_pct

    # تخمین projected VaR: VaR_new ≈ sqrt(VaR_old² + risk_new²) (independent assumption)
    # برای signals correlated، اضافه می‌شود (worst case)
    current_risk = open_positions_risk_dollar
    total_risk = current_risk + proposed_position_risk_dollar
    # current_var_pct از پیش ریسک پوزیشن‌های باز را در دل بازده‌های تاریخی دارد؛
    # افزودن دوبارهٔ (current_risk/portfolio_value)² آن را double-count می‌کرد. حذف شد.
    projected_var_pct = float(np.sqrt(
        current_var_pct ** 2
        + (proposed_position_risk_dollar / portfolio_value) ** 2
    ))

    current_exposure_pct = current_risk / portfolio_value
    projected_exposure_pct = total_risk / portfolio_value
    max_exposure = exposure_limit_pct / 100.0
    var_limit = var_limit_pct / 100.0

    if projected_var_pct > var_limit:
        return PortfolioRiskCheck(
            allowed=False,
            current_var_pct=current_var_pct,
            projected_var_pct=projected_var_pct,
            var_limit_pct=var_limit,
            current_exposure_pct=current_exposure_pct,
            max_exposure_pct=max_exposure,
            reason=f"VaR projected ({projected_var_pct:.1%}) > حد ({var_limit:.1%})",
        )

    if projected_exposure_pct > max_exposure:
        return PortfolioRiskCheck(
            allowed=False,
            current_var_pct=current_var_pct,
            projected_var_pct=projected_var_pct,
            var_limit_pct=var_limit,
            current_exposure_pct=current_exposure_pct,
            max_exposure_pct=max_exposure,
            reason=f"exposure projected ({projected_exposure_pct:.1%}) > حد ({max_exposure:.1%})",
        )

    return PortfolioRiskCheck(
        allowed=True,
        current_var_pct=current_var_pct,
        projected_var_pct=projected_var_pct,
        var_limit_pct=var_limit,
        current_exposure_pct=current_exposure_pct,
        max_exposure_pct=max_exposure,
    )
