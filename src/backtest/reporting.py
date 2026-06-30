"""
Reporting institutional-grade — heatmap، rolling metrics، drawdown periods، benchmark.

این ماژول داده‌های آماده‌ی نمایش برای admin dashboard و investor reports
تولید می‌کند. تمام خروجی‌ها dict/list هستند که مستقیماً به API می‌روند.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional, Sequence

import numpy as np


# ===========================================================================
# Monthly Returns Heatmap
# ===========================================================================


@dataclass
class MonthlyReturn:
    """یک ماه — درصد return."""

    year: int
    month: int
    return_pct: float
    n_trades: int

    def to_dict(self) -> dict:
        return {
            "year": self.year,
            "month": self.month,
            "return_pct": round(self.return_pct, 3),
            "n_trades": self.n_trades,
        }


@dataclass
class HeatmapRow:
    """یک سال — ۱۲ ماه + سالانه."""

    year: int
    months: dict[int, float] = field(default_factory=dict)  # {month: return_pct}
    n_trades: dict[int, int] = field(default_factory=dict)

    @property
    def annual_return_pct(self) -> float:
        # محاسبه compounded سالانه (نه sum ساده)
        result = 1.0
        for m, ret in self.months.items():
            result *= (1.0 + ret / 100.0)
        return (result - 1.0) * 100.0

    def to_dict(self) -> dict:
        return {
            "year": self.year,
            "months": {str(m): round(r, 3) for m, r in self.months.items()},
            "n_trades": {str(m): n for m, n in self.n_trades.items()},
            "annual_return_pct": round(self.annual_return_pct, 3),
        }


def build_monthly_heatmap(
    timestamps: Sequence[datetime],
    pnls: Sequence[float],
    initial_balance: float = 10_000.0,
) -> list[HeatmapRow]:
    """
    ساخت heatmap بازده ماهانه.

    پارامترها:
        timestamps: زمان هر معامله
        pnls: PnL هر معامله ($)
        initial_balance: equity اولیه (برای محاسبه‌ی درصد)

    خروجی:
        list[HeatmapRow] مرتب بر اساس سال
    """
    if len(timestamps) != len(pnls):
        raise ValueError("طول timestamps و pnls باید برابر باشد.")
    if not timestamps:
        return []

    # tracking balance per timestep — اما برای heatmap درصد per ماه:
    # درصد = sum(pnls در ماه) / balance ابتدای ماه × ۱۰۰
    # ساده‌سازی: equity تجمعی، درصد بر اساس equity شروع هر ماه

    # sort by time
    indexed = sorted(zip(timestamps, pnls), key=lambda x: x[0])

    # ساخت per-month aggregate
    monthly_pnl: dict[tuple[int, int], float] = {}
    monthly_count: dict[tuple[int, int], int] = {}
    for ts, pnl in indexed:
        key = (ts.year, ts.month)
        monthly_pnl[key] = monthly_pnl.get(key, 0.0) + float(pnl)
        monthly_count[key] = monthly_count.get(key, 0) + 1

    # equity در ابتدای هر ماه — به ترتیب زمان
    sorted_keys = sorted(monthly_pnl.keys())
    rows_by_year: dict[int, HeatmapRow] = {}

    running_balance = initial_balance
    for key in sorted_keys:
        year, month = key
        month_pnl = monthly_pnl[key]
        month_pct = (
            (month_pnl / running_balance) * 100.0 if running_balance > 0 else 0.0
        )

        if year not in rows_by_year:
            rows_by_year[year] = HeatmapRow(year=year)
        rows_by_year[year].months[month] = month_pct
        rows_by_year[year].n_trades[month] = monthly_count[key]

        running_balance += month_pnl

    return sorted(rows_by_year.values(), key=lambda r: r.year)


# ===========================================================================
# Rolling Metrics (12-month CAGR، Sharpe، DD)
# ===========================================================================


@dataclass
class RollingMetricPoint:
    """یک نقطه از rolling metric."""

    date: date
    value: float
    sample_size: int

    def to_dict(self) -> dict:
        return {
            "date": self.date.isoformat(),
            "value": round(self.value, 4),
            "sample_size": self.sample_size,
        }


def rolling_cagr(
    timestamps: Sequence[datetime],
    pnls: Sequence[float],
    window_days: int = 365,
    initial_balance: float = 10_000.0,
    step_days: int = 7,
) -> list[RollingMetricPoint]:
    """
    rolling 12-month CAGR (یا window دلخواه).

    Compound Annual Growth Rate برای پنجره‌ی متحرک.

    استفاده:
        roll = rolling_cagr(times, pnls, window_days=365)
        # plot به‌صورت time-series
    """
    if not timestamps or len(timestamps) != len(pnls):
        return []

    indexed = sorted(zip(timestamps, pnls), key=lambda x: x[0])
    start_time = indexed[0][0]
    end_time = indexed[-1][0]

    window = timedelta(days=window_days)
    step = timedelta(days=step_days)

    points: list[RollingMetricPoint] = []
    current = start_time + window

    while current <= end_time:
        window_start = current - window
        # PnL در window
        window_pnls = [pnl for ts, pnl in indexed if window_start <= ts <= current]
        n = len(window_pnls)
        if n < 5:
            current += step
            continue

        total_pnl = sum(window_pnls)
        final_balance = initial_balance + total_pnl
        if final_balance <= 0 or initial_balance <= 0:
            current += step
            continue

        # CAGR = (final/initial)^(365/days) - 1
        years = window_days / 365.0
        ratio = final_balance / initial_balance
        try:
            cagr = (ratio ** (1.0 / years)) - 1.0 if ratio > 0 else -1.0
        except (ValueError, ZeroDivisionError):
            cagr = 0.0

        points.append(RollingMetricPoint(
            date=current.date(),
            value=cagr * 100.0,  # درصد
            sample_size=n,
        ))
        current += step

    return points


def rolling_sharpe(
    timestamps: Sequence[datetime],
    r_multiples: Sequence[float],
    window_days: int = 90,
    step_days: int = 7,
    periods_per_year: int = 252,
) -> list[RollingMetricPoint]:
    """rolling Sharpe ratio (annualized، روی R-multiples)."""
    if not timestamps or len(timestamps) != len(r_multiples):
        return []

    indexed = sorted(zip(timestamps, r_multiples), key=lambda x: x[0])
    start_time = indexed[0][0]
    end_time = indexed[-1][0]

    window = timedelta(days=window_days)
    step = timedelta(days=step_days)

    points: list[RollingMetricPoint] = []
    current = start_time + window
    while current <= end_time:
        window_start = current - window
        rs = [r for ts, r in indexed if window_start <= ts <= current]
        n = len(rs)
        if n < 10:
            current += step
            continue
        arr = np.asarray(rs, dtype=float)
        std = float(arr.std(ddof=1))
        if std <= 1e-12:
            current += step
            continue
        sharpe = float(arr.mean()) / std * math.sqrt(periods_per_year)
        points.append(RollingMetricPoint(
            date=current.date(),
            value=sharpe,
            sample_size=n,
        ))
        current += step
    return points


# ===========================================================================
# Drawdown Periods
# ===========================================================================


@dataclass
class DrawdownPeriod:
    """یک دوره‌ی drawdown — از peak تا recovery."""

    peak_date: date
    trough_date: date
    recovery_date: Optional[date]
    peak_equity: float
    trough_equity: float
    drawdown_dollar: float
    drawdown_pct: float
    duration_to_trough_days: int
    duration_to_recovery_days: Optional[int]

    @property
    def is_ongoing(self) -> bool:
        return self.recovery_date is None

    def to_dict(self) -> dict:
        return {
            "peak_date": self.peak_date.isoformat(),
            "trough_date": self.trough_date.isoformat(),
            "recovery_date": (
                self.recovery_date.isoformat() if self.recovery_date else None
            ),
            "peak_equity": round(self.peak_equity, 2),
            "trough_equity": round(self.trough_equity, 2),
            "drawdown_dollar": round(self.drawdown_dollar, 2),
            "drawdown_pct": round(self.drawdown_pct * 100, 3),
            "duration_to_trough_days": self.duration_to_trough_days,
            "duration_to_recovery_days": self.duration_to_recovery_days,
            "is_ongoing": self.is_ongoing,
        }


def identify_drawdown_periods(
    timestamps: Sequence[datetime],
    pnls: Sequence[float],
    initial_balance: float = 10_000.0,
    min_drawdown_pct: float = 0.01,
) -> list[DrawdownPeriod]:
    """
    شناسایی دوره‌های drawdown — از peak تا recovery (یا ongoing).

    پارامترها:
        timestamps, pnls: لیست معاملات
        initial_balance: equity اولیه
        min_drawdown_pct: حداقل DD برای ثبت (پیش‌فرض ۱٪)

    خروجی:
        list[DrawdownPeriod] — مرتب بر اساس بزرگی drawdown_pct (worst first)
    """
    if not timestamps or len(timestamps) != len(pnls):
        return []

    indexed = sorted(zip(timestamps, pnls), key=lambda x: x[0])

    equity = [initial_balance]
    dates = [indexed[0][0].date() if indexed else date.today()]
    for ts, pnl in indexed:
        equity.append(equity[-1] + float(pnl))
        dates.append(ts.date())

    periods: list[DrawdownPeriod] = []

    peak_value = equity[0]
    peak_idx = 0

    i = 1
    while i < len(equity):
        if equity[i] >= peak_value:
            # new peak یا equal — peak به‌روز می‌شود
            peak_value = equity[i]
            peak_idx = i
            i += 1
            continue

        # شروع drawdown
        trough_value = equity[i]
        trough_idx = i

        # دنبال trough و recovery
        j = i
        while j < len(equity):
            if equity[j] < trough_value:
                trough_value = equity[j]
                trough_idx = j
            if equity[j] >= peak_value:
                # recovery
                break
            j += 1

        # محاسبه DD
        dd_dollar = peak_value - trough_value
        dd_pct = dd_dollar / peak_value if peak_value > 0 else 0.0

        recovery_idx = j if j < len(equity) else None

        if dd_pct >= min_drawdown_pct:
            periods.append(DrawdownPeriod(
                peak_date=dates[peak_idx],
                trough_date=dates[trough_idx],
                recovery_date=dates[recovery_idx] if recovery_idx else None,
                peak_equity=peak_value,
                trough_equity=trough_value,
                drawdown_dollar=dd_dollar,
                drawdown_pct=dd_pct,
                duration_to_trough_days=(dates[trough_idx] - dates[peak_idx]).days,
                duration_to_recovery_days=(
                    (dates[recovery_idx] - dates[peak_idx]).days
                    if recovery_idx is not None
                    else None
                ),
            ))

        # continue پس از recovery
        if recovery_idx is not None:
            peak_value = equity[recovery_idx]
            peak_idx = recovery_idx
            i = recovery_idx + 1
        else:
            # ongoing — finish
            break

    # sort worst first
    periods.sort(key=lambda p: p.drawdown_pct, reverse=True)
    return periods


# ===========================================================================
# Benchmark Comparison (Alpha/Beta)
# ===========================================================================


@dataclass
class BenchmarkComparison:
    """مقایسه‌ی strategy با benchmark (DXY, S&P 500, ...)."""

    benchmark_name: str
    strategy_cagr_pct: float
    benchmark_cagr_pct: float
    alpha_pct: float  # excess return
    beta: float       # sensitivity to benchmark
    correlation: float
    information_ratio: float
    n_periods: int

    def to_dict(self) -> dict:
        return {
            "benchmark_name": self.benchmark_name,
            "strategy_cagr_pct": round(self.strategy_cagr_pct, 3),
            "benchmark_cagr_pct": round(self.benchmark_cagr_pct, 3),
            "alpha_pct": round(self.alpha_pct, 3),
            "beta": round(self.beta, 3),
            "correlation": round(self.correlation, 3),
            "information_ratio": round(self.information_ratio, 3),
            "n_periods": self.n_periods,
        }


def compare_to_benchmark(
    strategy_returns: Sequence[float],
    benchmark_returns: Sequence[float],
    benchmark_name: str = "BENCHMARK",
    periods_per_year: int = 252,
    risk_free_rate: float = 0.0,
) -> BenchmarkComparison:
    """
    مقایسه‌ی strategy با benchmark.

    پارامترها:
        strategy_returns: per-period returns of strategy
        benchmark_returns: per-period returns of benchmark (طول برابر)
        benchmark_name: مثلاً "DXY" یا "SPX"
        periods_per_year: ۲۵۲ daily
        risk_free_rate: per-year (برای alpha)

    خروجی: BenchmarkComparison شامل alpha، beta، IR
    """
    n = min(len(strategy_returns), len(benchmark_returns))
    if n < 10:
        return BenchmarkComparison(
            benchmark_name=benchmark_name,
            strategy_cagr_pct=0.0,
            benchmark_cagr_pct=0.0,
            alpha_pct=0.0,
            beta=0.0,
            correlation=0.0,
            information_ratio=0.0,
            n_periods=n,
        )

    s = np.asarray(strategy_returns[:n], dtype=float)
    b = np.asarray(benchmark_returns[:n], dtype=float)

    # annualized returns (compounded)
    strat_total = float(np.prod(1.0 + s) - 1.0)
    bench_total = float(np.prod(1.0 + b) - 1.0)
    years = n / periods_per_year
    strat_cagr = ((1.0 + strat_total) ** (1.0 / years) - 1.0) if years > 0 else 0.0
    bench_cagr = ((1.0 + bench_total) ** (1.0 / years) - 1.0) if years > 0 else 0.0

    # beta: cov(s, b) / var(b)
    cov_matrix = np.cov(s, b, ddof=1)
    cov_sb = float(cov_matrix[0, 1])
    var_b = float(cov_matrix[1, 1])
    beta = cov_sb / var_b if var_b > 1e-12 else 0.0

    # alpha (Jensen): R_s - [R_f + β × (R_b - R_f)]
    rf = risk_free_rate
    alpha_annual = strat_cagr - (rf + beta * (bench_cagr - rf))

    # correlation
    s_std = float(s.std(ddof=1))
    b_std = float(b.std(ddof=1))
    correlation = cov_sb / (s_std * b_std) if (s_std * b_std) > 1e-12 else 0.0

    # information ratio = (strategy_return - benchmark_return) / tracking_error
    active_returns = s - b
    tracking_error = float(active_returns.std(ddof=1))
    active_mean = float(active_returns.mean())
    information_ratio = (
        active_mean / tracking_error * math.sqrt(periods_per_year)
        if tracking_error > 1e-12 else 0.0
    )

    return BenchmarkComparison(
        benchmark_name=benchmark_name,
        strategy_cagr_pct=strat_cagr * 100.0,
        benchmark_cagr_pct=bench_cagr * 100.0,
        alpha_pct=alpha_annual * 100.0,
        beta=beta,
        correlation=correlation,
        information_ratio=information_ratio,
        n_periods=n,
    )
