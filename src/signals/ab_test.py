"""
A/B test framework — مقایسه‌ی دو نسخه‌ی استراتژی روی سیگنال‌های live.

منطق متخصص بازار:
    وقتی پارامتر/استراتژی را تغییر می‌دهیم، بهترین راه برای دانستن
    "این تغییر سود می‌برد یا نه؟" مقایسه‌ی موازی است:
        - گروه A: استراتژی فعلی (control)
        - گروه B: استراتژی جدید (variant)
        - تخصیص: random بر اساس signal_id یا hash
        - متریک‌ها هفته‌ای مقایسه می‌شوند

    pitfall اصلی: significance test. اگر فقط ۱۰ trade در هر گروه باشد،
    تفاوت ۲٪ win rate نویز است نه سیگنال. ما با بوت‌استرپ + p-value
    این را گزارش می‌کنیم.

این ماژول state-less است: assignment را با hash می‌سازد، metric‌ها از
trades خارجی محاسبه می‌شوند، آماره روی نتایج اعمال می‌شود.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Sequence


@dataclass(frozen=True)
class Experiment:
    """تعریف یک آزمایش A/B."""

    name: str
    variant_a: str = "control"
    variant_b: str = "variant"
    traffic_split: float = 0.5  # درصد به variant_b

    def assign(self, key: str) -> str:
        """
        تخصیص deterministic بر اساس hash کلید.

        کلید معمولاً signal_id یا symbol+timestamp است. این تضمین می‌کند
        یک سیگنال همیشه به یک variant برود، حتی اگر سرور restart شود.
        """
        h = hashlib.md5(key.encode("utf-8"), usedforsecurity=False).hexdigest()
        # ۸ کاراکتر hex → عدد ۰..2^32
        bucket = int(h[:8], 16) / 0xFFFFFFFF
        return self.variant_b if bucket < self.traffic_split else self.variant_a


@dataclass
class GroupStats:
    """آمار یک گروه از معاملات."""

    name: str
    n: int
    win_rate: float
    avg_r: float
    total_pnl: float
    std_r: float
    profit_factor: float

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "n": self.n,
            "win_rate": round(self.win_rate, 4),
            "avg_r": round(self.avg_r, 4),
            "total_pnl": round(self.total_pnl, 2),
            "std_r": round(self.std_r, 4),
            "profit_factor": round(self.profit_factor, 3),
        }


@dataclass
class ABTestReport:
    """نتیجه‌ی مقایسه A/B."""

    experiment: str
    a_stats: GroupStats
    b_stats: GroupStats
    delta_win_rate: float
    delta_avg_r: float
    p_value_avg_r: float           # احتمال مشاهده‌ی این تفاوت تحت H0
    is_significant: bool           # p < 0.05
    sample_size_adequate: bool     # حداقل ۳۰ trade در هر گروه
    recommendation: str
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "experiment": self.experiment,
            "a": self.a_stats.to_dict(),
            "b": self.b_stats.to_dict(),
            "delta_win_rate": round(self.delta_win_rate, 4),
            "delta_avg_r": round(self.delta_avg_r, 4),
            "p_value_avg_r": round(self.p_value_avg_r, 4),
            "is_significant": self.is_significant,
            "sample_size_adequate": self.sample_size_adequate,
            "recommendation": self.recommendation,
            "notes": list(self.notes),
        }


def _stats(name: str, r_values: Sequence[float], pnls: Sequence[float]) -> GroupStats:
    """محاسبه‌ی آمار یک گروه."""
    n = len(r_values)
    if n == 0:
        return GroupStats(name, 0, 0.0, 0.0, 0.0, 0.0, 0.0)
    wins = sum(1 for r in r_values if r > 0)
    avg_r = sum(r_values) / n
    total_pnl = float(sum(pnls))
    variance = sum((r - avg_r) ** 2 for r in r_values) / max(1, n - 1)
    std = math.sqrt(variance)
    gross_win = sum(p for p in pnls if p > 0)
    gross_loss = -sum(p for p in pnls if p < 0)
    pf = gross_win / gross_loss if gross_loss > 0 else float("inf")
    pf = min(pf, 20.0) if pf != float("inf") else 20.0
    return GroupStats(
        name=name,
        n=n,
        win_rate=wins / n,
        avg_r=avg_r,
        total_pnl=total_pnl,
        std_r=std,
        profit_factor=pf,
    )


def _welchs_t_test(
    a_values: Sequence[float], b_values: Sequence[float]
) -> float:
    """
    Welch's t-test برای دو نمونه با variance ممکن نامساوی.

    خروجی: p-value تقریبی (دو‌طرفه) با استفاده از normal approximation.
    برای n < 30 تقریب کاملاً دقیق نیست ولی کافی برای raised eyebrow test است.
    """
    n_a = len(a_values)
    n_b = len(b_values)
    if n_a < 2 or n_b < 2:
        return 1.0
    mean_a = sum(a_values) / n_a
    mean_b = sum(b_values) / n_b
    var_a = sum((x - mean_a) ** 2 for x in a_values) / (n_a - 1)
    var_b = sum((x - mean_b) ** 2 for x in b_values) / (n_b - 1)
    se = math.sqrt(var_a / n_a + var_b / n_b)
    if se == 0:
        return 1.0
    t_stat = (mean_b - mean_a) / se
    # تقریب normal — برای n های متوسط/بزرگ کافی است
    # CDF نرمال دو‌طرفه:
    p = 2.0 * (1.0 - _normal_cdf(abs(t_stat)))
    return max(0.0, min(1.0, p))


def _normal_cdf(x: float) -> float:
    """تقریب CDF نرمال استاندارد با Abramowitz/Stegun."""
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def analyze_ab_test(
    experiment_name: str,
    a_trades_r: Sequence[float],
    a_trades_pnl: Sequence[float],
    b_trades_r: Sequence[float],
    b_trades_pnl: Sequence[float],
    significance_level: float = 0.05,
    min_sample_size: int = 30,
) -> ABTestReport:
    """
    تحلیل آماری A/B test.

    پارامترها:
        a_trades_r, a_trades_pnl: R-multiples و $-PnLs گروه A
        b_trades_r, b_trades_pnl: گروه B
        significance_level: حد p-value
        min_sample_size: حداقل n برای adequate sample

    خروجی:
        ABTestReport شامل آمار، p-value، و توصیه.
    """
    a_stats = _stats("A_control", a_trades_r, a_trades_pnl)
    b_stats = _stats("B_variant", b_trades_r, b_trades_pnl)

    delta_wr = b_stats.win_rate - a_stats.win_rate
    delta_r = b_stats.avg_r - a_stats.avg_r

    p_value = _welchs_t_test(a_trades_r, b_trades_r)
    is_significant = p_value < significance_level
    adequate = a_stats.n >= min_sample_size and b_stats.n >= min_sample_size

    notes: list[str] = []
    if not adequate:
        notes.append(
            f"حجم نمونه کم — حداقل {min_sample_size} trade در هر گروه نیاز است."
        )
    if is_significant and adequate and delta_r > 0:
        rec = "B بهتر از A است — می‌توان roll-out کرد."
    elif is_significant and adequate and delta_r < 0:
        rec = "B بدتر از A است — variant رد شود."
    elif adequate:
        rec = "تفاوت معنی‌دار نیست — A را نگه‌دار."
    else:
        rec = "تصمیم به تأخیر — منتظر داده‌ی بیشتر باش."

    return ABTestReport(
        experiment=experiment_name,
        a_stats=a_stats,
        b_stats=b_stats,
        delta_win_rate=delta_wr,
        delta_avg_r=delta_r,
        p_value_avg_r=p_value,
        is_significant=is_significant,
        sample_size_adequate=adequate,
        recommendation=rec,
        notes=notes,
    )
