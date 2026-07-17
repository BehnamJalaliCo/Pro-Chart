"""Portfolio VaR/CVaR and exposure guardrails."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.stats import norm


@dataclass
class VaRReport:
    var_pct: float
    var_dollar: float
    cvar_pct: float
    method: str


def parametric_var(portfolio_value: float, returns: np.ndarray, *, confidence: float = 0.95, horizon_days: int = 1) -> VaRReport:
    r = np.asarray(returns, dtype=float)
    sigma = float(np.std(r, ddof=1)) * np.sqrt(horizon_days)
    mu = float(np.mean(r)) * horizon_days
    z = float(norm.ppf(confidence))
    var = max(0.0, z * sigma - mu)
    cvar = var + sigma * float(norm.pdf(z) / max(1 - confidence, 1e-9))
    return VaRReport(var, portfolio_value * var, cvar, "parametric")


def historical_var(portfolio_value: float, returns: np.ndarray, *, confidence: float = 0.95) -> VaRReport:
    r = np.asarray(returns, dtype=float)
    var = max(0.0, -float(np.percentile(r, (1 - confidence) * 100)))
    tail = r[r <= -var]
    cvar = max(var, -float(tail.mean())) if tail.size else var
    return VaRReport(var, portfolio_value * var, cvar, "historical")


@dataclass
class RiskCheck:
    allowed: bool
    reason: str
    var_pct: float
    exposure_pct: float


def check_portfolio_risk(*, portfolio_value: float, historical_returns: np.ndarray, proposed_position_risk_dollar: float, open_positions_risk_dollar: float, var_limit_pct: float = 5.0, exposure_limit_pct: float = 30.0) -> RiskCheck:
    report = historical_var(portfolio_value, historical_returns)
    exposure = (proposed_position_risk_dollar + open_positions_risk_dollar) / portfolio_value * 100.0
    reasons = []
    if exposure > exposure_limit_pct:
        reasons.append("exposure limit exceeded")
    if report.var_pct * 100.0 > var_limit_pct:
        reasons.append("VaR limit exceeded")
    return RiskCheck(not reasons, "; ".join(reasons) or "within limits", report.var_pct * 100.0, exposure)
