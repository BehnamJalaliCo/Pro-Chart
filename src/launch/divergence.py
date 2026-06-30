"""
تشخیص واگرایی paper-trading از backtest.

منطق متخصص بازار:
    اگر backtest می‌گوید win_rate = 65% ولی paper (forward-test) فقط 45% است،
    یعنی استراتژی روی داده‌ی live کار نمی‌کند → degradation.

    دلایل احتمالی degradation:
        - overfit (مدل ML روی train data بیش از حد سفارشی شده)
        - market regime change (داده‌ی train قدیمی، بازار تغییر کرده)
        - cost model اشتباه (slippage واقعی بیشتر از فرض)
        - execution delay (سیگنال زمان دیده شدن، dead شده)

    این ماژول هفته‌ای یک‌بار اجرا می‌شود و divergence را گزارش می‌کند.
    اگر divergence از threshold فراتر برود → alert و block launch.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class DivergenceMetric:
    """واگرایی یک متریک."""

    metric_name: str
    paper_value: float
    backtest_value: float
    delta: float           # paper - backtest
    delta_pct: float       # (paper - backtest) / |backtest| × 100
    threshold_pct: float
    is_significant: bool
    direction: str         # "improved" | "degraded" | "unchanged"

    def to_dict(self) -> dict:
        return {
            "metric_name": self.metric_name,
            "paper_value": round(self.paper_value, 4),
            "backtest_value": round(self.backtest_value, 4),
            "delta": round(self.delta, 4),
            "delta_pct": round(self.delta_pct, 2),
            "threshold_pct": self.threshold_pct,
            "is_significant": self.is_significant,
            "direction": self.direction,
        }


@dataclass
class DivergenceReport:
    """گزارش کامل واگرایی paper vs backtest."""

    paper_period_days: int
    paper_n_trades: int
    backtest_n_trades: int
    metrics: list[DivergenceMetric] = field(default_factory=list)
    overall_degraded: bool = False
    recommendation: str = ""
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "paper_period_days": self.paper_period_days,
            "paper_n_trades": self.paper_n_trades,
            "backtest_n_trades": self.backtest_n_trades,
            "metrics": [m.to_dict() for m in self.metrics],
            "overall_degraded": self.overall_degraded,
            "recommendation": self.recommendation,
            "notes": list(self.notes),
        }


# threshold های پیش‌فرض — به‌صورت درصد اختلاف از backtest
_DEFAULT_THRESHOLDS: dict[str, float] = {
    "win_rate": 15.0,         # win_rate نباید بیش از 15% کاهش یابد
    "profit_factor": 30.0,    # PF نباید بیش از 30% کاهش یابد
    "expectancy_r": 30.0,
    "sharpe_ratio": 40.0,
    "avg_net_pips": 25.0,
}


def _direction_label(delta: float, metric_name: str) -> str:
    """آیا تغییر مثبت (بهبود) یا منفی (افت)؟"""
    if abs(delta) < 1e-6:
        return "unchanged"
    # برای تمام متریک‌های ما، بیشتر = بهتر
    return "improved" if delta > 0 else "degraded"


def compare_paper_with_backtest(
    paper_metrics: Any,
    backtest_metrics: Any,
    paper_period_days: int,
    thresholds: Optional[dict[str, float]] = None,
    min_paper_trades: int = 20,
) -> DivergenceReport:
    """
    مقایسه‌ی paper trading metrics با backtest metrics.

    پارامترها:
        paper_metrics: نمونه PerformanceMetrics از paper trades
        backtest_metrics: نمونه PerformanceMetrics از backtest روی همان دوره
        paper_period_days: طول دوره paper
        thresholds: thresholds سفارشی (None → پیش‌فرض)
        min_paper_trades: حداقل trade در paper برای تصمیم معتبر

    خروجی:
        DivergenceReport
    """
    ths = thresholds or _DEFAULT_THRESHOLDS
    paper_n = int(getattr(paper_metrics, "total_trades", 0))
    bt_n = int(getattr(backtest_metrics, "total_trades", 0))

    report = DivergenceReport(
        paper_period_days=paper_period_days,
        paper_n_trades=paper_n,
        backtest_n_trades=bt_n,
    )

    if paper_n < min_paper_trades:
        report.notes.append(
            f"تعداد paper trades ({paper_n}) کمتر از حداقل ({min_paper_trades}) — "
            "تصمیم به تأخیر می‌افتد."
        )
        report.recommendation = "wait_for_more_data"
        return report

    if bt_n < 10:
        report.notes.append("backtest با حجم نمونه کم — قابل اتکا نیست.")
        report.recommendation = "rerun_backtest_with_larger_window"
        return report

    significantly_degraded = 0
    significantly_improved = 0

    for metric_name, threshold in ths.items():
        p_val = float(getattr(paper_metrics, metric_name, 0.0) or 0.0)
        b_val = float(getattr(backtest_metrics, metric_name, 0.0) or 0.0)
        delta = p_val - b_val
        if abs(b_val) > 1e-6:
            delta_pct = delta / abs(b_val) * 100.0
        else:
            delta_pct = 0.0 if delta == 0 else float("inf") * (1 if delta > 0 else -1)

        is_sig = abs(delta_pct) >= threshold
        direction = _direction_label(delta, metric_name)
        if is_sig:
            if direction == "degraded":
                significantly_degraded += 1
            elif direction == "improved":
                significantly_improved += 1

        report.metrics.append(DivergenceMetric(
            metric_name=metric_name,
            paper_value=p_val,
            backtest_value=b_val,
            delta=delta,
            delta_pct=delta_pct if math.isfinite(delta_pct) else (999.0 if delta_pct > 0 else -999.0),
            threshold_pct=threshold,
            is_significant=is_sig,
            direction=direction,
        ))

    # تصمیم کلی
    report.overall_degraded = significantly_degraded >= 2

    if report.overall_degraded:
        report.recommendation = "block_launch"
        report.notes.append(
            f"{significantly_degraded} متریک به‌طور معنی‌دار افت کرده‌اند. "
            "قبل از live، علت degradation بررسی شود."
        )
    elif significantly_improved > 0 and significantly_degraded == 0:
        report.recommendation = "proceed_with_launch"
        report.notes.append("Paper performance بهتر از backtest — احتمالاً امن.")
    else:
        report.recommendation = "proceed_with_caution"
        report.notes.append(
            "تفاوت در محدوده‌ی threshold است — می‌توان launch کرد ولی مانیتورینگ شدید لازم است."
        )

    return report
