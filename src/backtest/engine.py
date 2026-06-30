"""
موتور بک‌تست — اجرای دنباله سیگنال‌ها روی داده‌ی تاریخی.

دو حالت کار:
    ۱) بازپخش سیگنال‌های ثبت‌شده (signal-replay):
       لیست سیگنال‌های واقعی از DB یا یک منبع، روی کندل‌های تاریخی شبیه‌سازی
       می‌شوند. اسپرد، اسلیپج، کمیسیون و سواپ اعمال شده و متریک کامل
       به‌علاوه‌ی attribution per-component محاسبه می‌شود.

    ۲) Walk-forward (در walk_forward.py): تقسیم تاریخچه به فولدهای
       train/test پشت‌سر‌هم و گزارش متریک out-of-sample.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

import pandas as pd

from src.backtest.cost_model import CostModel
from src.backtest.metrics import (
    PerformanceMetrics,
    attribute_by_tag,
    calculate_metrics,
)
from src.backtest.simulator import TradeOutcome, TradeSimulator


@dataclass
class BacktestSignal:
    """ساختار سبک سیگنال برای ورودی بک‌تست — بی‌نیاز از DB ORM."""

    symbol: str
    direction: str
    entry_time: datetime
    entry_price: float
    sl: float
    tp1: float
    tp2: Optional[float] = None
    tp3: Optional[float] = None
    lot_size: float = 1.0
    technical_score: float = 50.0
    pattern_score: float = 50.0
    ml_score: float = 50.0
    signal_score: float = 50.0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def dominant_component(self) -> str:
        """
        تعیین مؤلفه‌ی غالب در امتیاز این سیگنال.

        منطق: کدام مؤلفه از حد متوسط (۵۰) بیشترین فاصله را دارد؟
        وزن‌ها مطابق scorer: technical=0.4, pattern=0.3, ml=0.3.
        """
        contribs = {
            "technical": (self.technical_score - 50.0) * 0.4,
            "pattern": (self.pattern_score - 50.0) * 0.3,
            "ml": (self.ml_score - 50.0) * 0.3,
        }
        # اگر همه نزدیک صفر باشند → mixed
        max_abs = max(abs(v) for v in contribs.values())
        if max_abs < 1.0:
            return "mixed"
        return max(contribs.items(), key=lambda kv: abs(kv[1]))[0]


@dataclass
class BacktestResult:
    """نتیجه‌ی یک run بک‌تست."""

    name: str
    start_time: datetime
    end_time: datetime
    total_signals: int
    skipped_signals: int
    trades: List[TradeOutcome]
    metrics: PerformanceMetrics
    attribution_by_component: Dict[str, PerformanceMetrics]
    initial_balance: float
    final_balance: float
    config_snapshot: Dict[str, Any] = field(default_factory=dict)

    def summary(self) -> Dict[str, Any]:
        """خلاصه‌ی قابل ذخیره در DB یا ارسال در API."""
        return {
            "name": self.name,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "total_signals": self.total_signals,
            "skipped_signals": self.skipped_signals,
            "trades_executed": len(self.trades),
            "initial_balance": round(self.initial_balance, 2),
            "final_balance": round(self.final_balance, 2),
            "return_pct": round(
                (self.final_balance - self.initial_balance) / self.initial_balance * 100.0
                if self.initial_balance > 0 else 0.0,
                3,
            ),
            "metrics": self.metrics.to_dict(),
            "attribution_by_component": {
                k: v.to_dict() for k, v in self.attribution_by_component.items()
            },
            "config": self.config_snapshot,
        }


class BacktestEngine:
    """
    موتور بک‌تست signal-replay.

    ورودی:
        - سیگنال‌ها (BacktestSignal)
        - کندل‌های تاریخی per (symbol, timeframe)
    خروجی:
        - BacktestResult

    کاربرد:
        روی سیگنال‌های live گذشته اجرا کنیم تا performance واقعی
        (پس از هزینه‌ها) را اندازه‌گیری کنیم. این متریک می‌تواند با
        متریک in-sample مدل ML مقایسه شود تا میزان overfit مشخص گردد.
    """

    def __init__(
        self,
        cost_model: Optional[CostModel] = None,
        max_bars_per_trade: int = 500,
        initial_balance: float = 10_000.0,
    ) -> None:
        self._cost = cost_model or CostModel.default()
        self._simulator = TradeSimulator(self._cost, max_bars=max_bars_per_trade)
        self._initial_balance = initial_balance

    def run(
        self,
        name: str,
        signals: Sequence[BacktestSignal],
        candles_by_symbol_tf: Dict[tuple[str, str], pd.DataFrame],
        primary_timeframe: str = "H1",
        risk_per_trade_pct: float = 1.0,
    ) -> BacktestResult:
        """
        اجرای بک‌تست.

        پارامترها:
            name: نام run (برای ذخیره)
            signals: لیست سیگنال‌ها به ترتیب زمان ورود
            candles_by_symbol_tf: dict[(symbol, timeframe)] → DataFrame
            primary_timeframe: تایم‌فریم اجرای معامله (پیش‌فرض H1)
            risk_per_trade_pct: درصد ریسک per trade (برای محاسبه‌ی lot)

        خروجی:
            BacktestResult با متریک کامل
        """
        if not signals:
            raise ValueError("بدون سیگنال نمی‌توان بک‌تست را اجرا کرد.")

        sorted_signals = sorted(signals, key=lambda s: s.entry_time)
        start = sorted_signals[0].entry_time
        end = sorted_signals[-1].entry_time

        trades: List[TradeOutcome] = []
        skipped = 0
        balance = self._initial_balance

        for sig in sorted_signals:
            key = (sig.symbol, primary_timeframe)
            df = candles_by_symbol_tf.get(key)
            if df is None or df.empty:
                skipped += 1
                continue

            future = self._slice_future(df, sig.entry_time)
            if future is None or future.empty:
                skipped += 1
                continue

            # محاسبه lot از balance و ریسک per trade
            lot_size = self._calculate_lot_size(
                sig, balance, risk_per_trade_pct
            )
            if lot_size <= 0:
                skipped += 1
                continue

            outcome = self._simulator.simulate(
                symbol=sig.symbol,
                direction=sig.direction,
                entry_time=sig.entry_time,
                entry_price_mid=sig.entry_price,
                sl=sig.sl,
                tp1=sig.tp1,
                tp2=sig.tp2,
                tp3=sig.tp3,
                future_candles=future,
                lot_size=lot_size,
                use_trailing_after_tp1=False,
                tags={
                    "dominant_component": sig.dominant_component(),
                    "signal_score_bucket": _score_bucket(sig.signal_score),
                },
            )
            trades.append(outcome)
            balance += outcome.net_pnl_dollar
            # پس از ruin معامله را متوقف کن
            if balance <= 0:
                break

        metrics = calculate_metrics(trades)
        attribution = attribute_by_tag(trades, "dominant_component")

        return BacktestResult(
            name=name,
            start_time=start,
            end_time=end,
            total_signals=len(sorted_signals),
            skipped_signals=skipped,
            trades=trades,
            metrics=metrics,
            attribution_by_component=attribution,
            initial_balance=self._initial_balance,
            final_balance=balance,
            config_snapshot={
                "primary_timeframe": primary_timeframe,
                "risk_per_trade_pct": risk_per_trade_pct,
            },
        )

    # ── کمکی‌ها ─────────────────────────────────────────

    @staticmethod
    def _slice_future(df: pd.DataFrame, entry_time: datetime) -> Optional[pd.DataFrame]:
        """انتخاب کندل‌های پس از entry_time."""
        if "timestamp" not in df.columns:
            return None
        ts = pd.to_datetime(df["timestamp"], utc=True)
        # نرمال‌سازی entry_time به UTC (بدون double-tz)
        entry_ts = pd.Timestamp(entry_time)
        if entry_ts.tzinfo is None:
            entry_ts = entry_ts.tz_localize("UTC")
        else:
            entry_ts = entry_ts.tz_convert("UTC")
        mask = ts > entry_ts
        future = df.loc[mask].reset_index(drop=True)
        return future if not future.empty else None

    def _calculate_lot_size(
        self,
        sig: BacktestSignal,
        balance: float,
        risk_pct: float,
    ) -> float:
        """
        محاسبه‌ی حجم بر اساس درصد ریسک از موجودی.

        Risk $ = balance × risk_pct / 100
        SL in pips = |entry - sl| / pip_size
        lot = Risk $ / (SL_pips × pip_dollar_per_lot)
        """
        # موجودی منفی/صفر → معامله ممنوع (پس از ruin ادامه نده)
        if balance <= 0:
            return 0.0
        profile = self._cost.profile(sig.symbol)
        if profile.pip_size <= 0 or profile.pip_dollar_per_lot <= 0:
            return 0.0
        risk_dollar = balance * (risk_pct / 100.0)
        sl_pips = abs(sig.entry_price - sig.sl) / profile.pip_size
        if sl_pips <= 0:
            return 0.0
        lot = risk_dollar / (sl_pips * profile.pip_dollar_per_lot)
        # کمتر از حداقل لات → معامله را رد کن (نه clamp که ریسک را تا ۱۰ برابر بالا می‌برد)
        if lot < 0.01:
            return 0.0
        # سقف ۱۰۰ لات
        return min(lot, 100.0)


def _score_bucket(score: float) -> str:
    """دسته‌بندی امتیاز به سه bucket."""
    if score >= 85:
        return "strong"
    if score >= 70:
        return "medium"
    return "weak"
