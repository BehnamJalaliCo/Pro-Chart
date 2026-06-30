"""
متریک‌های عملکرد بک‌تست.

شامل:
    - Win rate, payoff, expectancy
    - Profit factor
    - Sharpe و Sortino (سالانه‌سازی شده)
    - Max drawdown (R و $)
    - بزرگ‌ترین رشته‌ی باخت
    - Calmar ratio
    - Exposure time
    - Per-symbol و per-component attribution
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Dict, List, Sequence

from src.backtest.simulator import ExitReason, TradeOutcome


@dataclass
class PerformanceMetrics:
    """متریک‌های جامع عملکرد یک سری معامله."""

    # تعداد و موفقیت
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    breakeven_trades: int = 0
    win_rate: float = 0.0  # 0..1

    # برآمده
    total_net_pips: float = 0.0
    total_net_dollar: float = 0.0
    avg_net_pips: float = 0.0
    avg_win_pips: float = 0.0
    avg_loss_pips: float = 0.0

    # ضرایب
    payoff_ratio: float = 0.0   # avg_win / |avg_loss|
    profit_factor: float = 0.0  # gross_profit / gross_loss
    expectancy_dollar: float = 0.0  # میانگین P&L per trade
    expectancy_r: float = 0.0       # میانگین R per trade

    # ریسک
    max_drawdown_r: float = 0.0
    max_drawdown_dollar: float = 0.0
    max_drawdown_pct: float = 0.0     # نسبت به اوج equity
    longest_losing_streak: int = 0
    longest_winning_streak: int = 0
    calmar_ratio: float = 0.0          # avg annual return / max DD

    # ریسک تعدیل‌شده
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0

    # هزینه‌ها (تجمعی)
    total_commission_dollar: float = 0.0
    total_swap_dollar: float = 0.0
    total_spread_cost_pips: float = 0.0

    # زمان
    avg_duration_minutes: float = 0.0

    # تجزیه‌ی per-symbol
    by_symbol: Dict[str, "PerformanceMetrics"] = field(default_factory=dict)
    by_exit_reason: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        """تبدیل به دیکشنری برای API/ذخیره."""
        d = {
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "breakeven_trades": self.breakeven_trades,
            "win_rate": round(self.win_rate, 4),
            "total_net_pips": round(self.total_net_pips, 2),
            "total_net_dollar": round(self.total_net_dollar, 2),
            "avg_net_pips": round(self.avg_net_pips, 2),
            "avg_win_pips": round(self.avg_win_pips, 2),
            "avg_loss_pips": round(self.avg_loss_pips, 2),
            "payoff_ratio": round(self.payoff_ratio, 3),
            "profit_factor": round(self.profit_factor, 3),
            "expectancy_dollar": round(self.expectancy_dollar, 2),
            "expectancy_r": round(self.expectancy_r, 3),
            "max_drawdown_r": round(self.max_drawdown_r, 3),
            "max_drawdown_dollar": round(self.max_drawdown_dollar, 2),
            "max_drawdown_pct": round(self.max_drawdown_pct, 4),
            "longest_losing_streak": self.longest_losing_streak,
            "longest_winning_streak": self.longest_winning_streak,
            "calmar_ratio": round(self.calmar_ratio, 3),
            "sharpe_ratio": round(self.sharpe_ratio, 3),
            "sortino_ratio": round(self.sortino_ratio, 3),
            "total_commission_dollar": round(self.total_commission_dollar, 2),
            "total_swap_dollar": round(self.total_swap_dollar, 2),
            "total_spread_cost_pips": round(self.total_spread_cost_pips, 2),
            "avg_duration_minutes": round(self.avg_duration_minutes, 1),
            "by_exit_reason": dict(self.by_exit_reason),
        }
        if self.by_symbol:
            d["by_symbol"] = {sym: m.to_dict() for sym, m in self.by_symbol.items()}
        return d


def calculate_metrics(
    trades: Sequence[TradeOutcome],
    risk_free_rate: float = 0.0,
    periods_per_year: int = 252,
    group_by_symbol: bool = True,
) -> PerformanceMetrics:
    """
    محاسبه‌ی متریک‌های جامع از یک دنباله معامله.

    پارامترها:
        trades: دنباله‌ی معاملات (به ترتیب زمانی)
        risk_free_rate: نرخ بدون ریسک سالانه (پیش‌فرض ۰)
        periods_per_year: تعداد دوره برای annualize (پیش‌فرض ۲۵۲ روز معاملاتی)
        group_by_symbol: تجزیه‌ی متریک‌ها per-symbol

    خروجی:
        PerformanceMetrics
    """
    m = PerformanceMetrics()
    if not trades:
        return m

    m.total_trades = len(trades)

    winning_pnls: List[float] = []
    losing_pnls: List[float] = []
    winning_pips: List[float] = []
    losing_pips: List[float] = []
    r_multiples: List[float] = []
    durations: List[int] = []

    for t in trades:
        durations.append(t.duration_minutes)
        m.total_net_dollar += t.net_pnl_dollar
        m.total_net_pips += t.net_pips
        m.total_commission_dollar += t.commission_dollar
        m.total_swap_dollar += t.swap_dollar
        m.total_spread_cost_pips += t.spread_cost_pips
        r_multiples.append(t.r_multiple)
        m.by_exit_reason[t.exit_reason.value] = (
            m.by_exit_reason.get(t.exit_reason.value, 0) + 1
        )

        if t.net_pnl_dollar > 0:
            m.winning_trades += 1
            winning_pnls.append(t.net_pnl_dollar)
            winning_pips.append(t.net_pips)
        elif t.net_pnl_dollar < 0:
            m.losing_trades += 1
            losing_pnls.append(t.net_pnl_dollar)
            losing_pips.append(t.net_pips)
        else:
            m.breakeven_trades += 1

    m.win_rate = m.winning_trades / m.total_trades

    m.avg_net_pips = m.total_net_pips / m.total_trades
    m.avg_win_pips = sum(winning_pips) / len(winning_pips) if winning_pips else 0.0
    m.avg_loss_pips = sum(losing_pips) / len(losing_pips) if losing_pips else 0.0

    avg_win_dollar = sum(winning_pnls) / len(winning_pnls) if winning_pnls else 0.0
    avg_loss_dollar = sum(losing_pnls) / len(losing_pnls) if losing_pnls else 0.0

    m.payoff_ratio = (
        avg_win_dollar / abs(avg_loss_dollar) if avg_loss_dollar < 0 else 0.0
    )

    gross_profit = sum(winning_pnls) if winning_pnls else 0.0
    gross_loss = -sum(losing_pnls) if losing_pnls else 0.0
    m.profit_factor = gross_profit / gross_loss if gross_loss > 0 else math.inf

    m.expectancy_dollar = m.total_net_dollar / m.total_trades
    m.expectancy_r = sum(r_multiples) / len(r_multiples) if r_multiples else 0.0
    m.avg_duration_minutes = sum(durations) / len(durations) if durations else 0.0

    # ── منحنی equity و drawdown ──
    # منحنی از یک نقطه‌ی پایه‌ی ۰.۰ شروع می‌شود تا اوج اولیه منفی نشود
    # (در غیر این صورت peak=equity[0] با اولین معامله‌ی بازنده منفی شده و
    # درصد drawdown بی‌معنا می‌گردد).
    equity_curve_dollar: List[float] = [0.0]
    running_total = 0.0
    for t in trades:
        running_total += t.net_pnl_dollar
        equity_curve_dollar.append(running_total)

    equity_curve_r: List[float] = [0.0]
    running_r = 0.0
    for r in r_multiples:
        running_r += r
        equity_curve_r.append(running_r)

    m.max_drawdown_dollar, m.max_drawdown_pct = _max_drawdown(equity_curve_dollar)
    m.max_drawdown_r, _ = _max_drawdown(equity_curve_r)

    # ── streaks ──
    m.longest_winning_streak, m.longest_losing_streak = _longest_streaks(
        [t.net_pnl_dollar for t in trades]
    )

    # ── Sharpe & Sortino ──
    if r_multiples:
        m.sharpe_ratio = _annualized_sharpe(r_multiples, risk_free_rate, periods_per_year)
        m.sortino_ratio = _annualized_sortino(r_multiples, risk_free_rate, periods_per_year)

    # ── Calmar = annualized return / |max DD| ──
    if m.max_drawdown_r > 0:
        annualized_r = m.expectancy_r * periods_per_year
        m.calmar_ratio = annualized_r / m.max_drawdown_r

    # ── تجزیه per-symbol ──
    if group_by_symbol:
        by_sym: Dict[str, List[TradeOutcome]] = {}
        for t in trades:
            by_sym.setdefault(t.symbol, []).append(t)
        m.by_symbol = {
            sym: calculate_metrics(sym_trades, group_by_symbol=False)
            for sym, sym_trades in by_sym.items()
        }

    return m


# ── کمکی‌های داخلی ──────────────────────────────────────

def _max_drawdown(equity: Sequence[float]) -> tuple[float, float]:
    """
    محاسبه‌ی حداکثر افت سرمایه از منحنی equity.

    خروجی: (max_drawdown_absolute, max_drawdown_pct)
    """
    if not equity:
        return 0.0, 0.0
    peak = equity[0]
    max_dd = 0.0
    max_dd_pct = 0.0
    for value in equity:
        if value > peak:
            peak = value
        dd = peak - value
        if dd > max_dd:
            max_dd = dd
            if peak > 0:
                max_dd_pct = dd / peak
            elif peak < 0:
                max_dd_pct = dd / abs(peak)
    return max_dd, max_dd_pct


def _longest_streaks(pnls: Sequence[float]) -> tuple[int, int]:
    """طول بلندترین رشته‌ی برد و باخت."""
    longest_win = 0
    longest_loss = 0
    cur_win = 0
    cur_loss = 0
    for pnl in pnls:
        if pnl > 0:
            cur_win += 1
            cur_loss = 0
            longest_win = max(longest_win, cur_win)
        elif pnl < 0:
            cur_loss += 1
            cur_win = 0
            longest_loss = max(longest_loss, cur_loss)
        else:
            cur_win = cur_loss = 0
    return longest_win, longest_loss


def _annualized_sharpe(
    returns: Sequence[float],
    risk_free: float,
    periods_per_year: int,
) -> float:
    """Sharpe ratio سالانه‌شده روی R-multiples."""
    n = len(returns)
    if n < 2:
        return 0.0
    mean = sum(returns) / n
    variance = sum((r - mean) ** 2 for r in returns) / (n - 1)
    std = math.sqrt(variance)
    if std == 0:
        return 0.0
    rf_per_period = risk_free / periods_per_year
    return (mean - rf_per_period) / std * math.sqrt(periods_per_year)


def _annualized_sortino(
    returns: Sequence[float],
    risk_free: float,
    periods_per_year: int,
) -> float:
    """Sortino ratio — فقط نوسان منفی را جریمه می‌کند."""
    n = len(returns)
    if n < 2:
        return 0.0
    mean = sum(returns) / n
    rf_per_period = risk_free / periods_per_year
    downside = [(r - rf_per_period) for r in returns if r < rf_per_period]
    if not downside:
        return math.inf if mean > rf_per_period else 0.0
    downside_var = sum(d ** 2 for d in downside) / len(downside)
    downside_std = math.sqrt(downside_var)
    if downside_std == 0:
        return 0.0
    return (mean - rf_per_period) / downside_std * math.sqrt(periods_per_year)


# ── Attribution: per-component performance ──────────────

def attribute_by_tag(
    trades: Sequence[TradeOutcome],
    tag_key: str,
) -> Dict[str, PerformanceMetrics]:
    """
    تجزیه‌ی متریک‌ها بر اساس یک tag.

    مثال:
        attribute_by_tag(trades, "dominant_component")
        → {"technical": metrics, "pattern": metrics, "ml": metrics}

    هر TradeOutcome ممکن است tag مربوطه نداشته باشد؛ این موارد
    تحت "untagged" دسته‌بندی می‌شوند.
    """
    buckets: Dict[str, List[TradeOutcome]] = {}
    for t in trades:
        bucket = str(t.tags.get(tag_key, "untagged"))
        buckets.setdefault(bucket, []).append(t)
    return {
        name: calculate_metrics(group, group_by_symbol=False)
        for name, group in buckets.items()
    }
