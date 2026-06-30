"""
RiskGuard — gateway یکپارچه‌ای که تمام فیلترهای ریسک را اعمال می‌کند.

استفاده:
    guard = RiskGuard(redis_client=redis_client)
    result = await guard.evaluate(
        symbol="EURUSD", direction="long",
        entry_price=1.1000, sl=1.0980, tp1=1.1020,
        candles_df=df,
        open_positions=[...],
        account_balance=10000.0,
    )
    if not result.allowed:
        log("rejected", reasons=result.reasons)

نکته: ترتیب اجرای فیلترها مهم است:
    ۱) weekend (سریع، بدون I/O)
    ۲) session (سریع)
    ۳) daily loss (نیاز به Redis)
    ۴) correlation (نیاز به positions)
    ۵) symbol_config — حداقل R/R
    ۶) regime (محاسبه روی DataFrame، گران‌قیمت‌تر)

هر فیلتر می‌تواند مستقل از سایرین استفاده شود.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Iterable, List, Optional

import pandas as pd

from src.risk.correlation import CorrelationGuard, OpenPosition
from src.risk.daily_loss_limit import DailyLossLimit
from src.risk.holiday_calendar import is_holiday_blackout
from src.risk.regime_detector import MarketRegime, RegimeAnalysis, detect_regime
from src.risk.session_filter import is_session_allowed
from src.risk.symbol_config import get_symbol_config
from src.risk.weekend_filter import is_weekend_blackout


class RejectionReason(str, Enum):
    """دلایل ممکن رد یک سیگنال — برای متریک و گزارش‌گیری."""

    WEEKEND_BLACKOUT = "weekend_blackout"
    HOLIDAY_BLACKOUT = "holiday_blackout"
    SESSION_NOT_ALLOWED = "session_not_allowed"
    DAILY_LOSS_LIMIT = "daily_loss_limit"
    CORRELATION_RISK = "correlation_risk"
    LOW_RR = "low_rr"
    SL_TOO_TIGHT = "sl_too_tight"
    SL_TOO_WIDE = "sl_too_wide"
    REGIME_MISMATCH = "regime_mismatch"
    VOLATILITY_SPIKE = "volatility_spike"
    LOW_LIQUIDITY = "low_liquidity"


@dataclass
class GuardResult:
    """نتیجه‌ی ارزیابی RiskGuard."""

    allowed: bool
    reasons: List[tuple[RejectionReason, str]] = field(default_factory=list)
    regime: Optional[RegimeAnalysis] = None
    metadata: dict = field(default_factory=dict)

    def reject(self, code: RejectionReason, detail: str) -> None:
        self.allowed = False
        self.reasons.append((code, detail))

    def to_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "reasons": [{"code": r[0].value, "detail": r[1]} for r in self.reasons],
            "regime": self.regime.to_dict() if self.regime else None,
            "metadata": dict(self.metadata),
        }


class RiskGuard:
    """gateway اصلی ریسک — تمام فیلترها را اعمال می‌کند."""

    def __init__(
        self,
        daily_loss_limit: Optional[DailyLossLimit] = None,
        correlation_guard: Optional[CorrelationGuard] = None,
        reject_in_transitional_regime: bool = False,
        reject_in_high_volatility: bool = True,
        block_trend_signals_in_ranging: bool = True,
        block_reversion_signals_in_trending: bool = True,
        publish_rejections_to_redis: bool = True,
        max_rejection_log_size: int = 500,
    ) -> None:
        self._daily = daily_loss_limit or DailyLossLimit()
        self._correlation = correlation_guard or CorrelationGuard()
        self._reject_transitional = reject_in_transitional_regime
        self._reject_high_vol = reject_in_high_volatility
        self._block_trend_in_ranging = block_trend_signals_in_ranging
        self._block_reversion_in_trending = block_reversion_signals_in_trending
        self._publish_rejections = publish_rejections_to_redis
        self._max_rejection_log_size = max_rejection_log_size

    async def evaluate(
        self,
        symbol: str,
        direction: str,
        entry_price: float,
        sl: float,
        tp1: float,
        candles_df: Optional[pd.DataFrame] = None,
        open_positions: Optional[Iterable[OpenPosition]] = None,
        account_balance: Optional[float] = None,
        signal_strategy: str = "trend",
        now: Optional[datetime] = None,
        pip_size: Optional[float] = None,
    ) -> GuardResult:
        """
        ارزیابی کامل سیگنال پیشنهادی.

        پارامترها:
            symbol, direction, entry_price, sl, tp1: مشخصات سیگنال
            candles_df: DataFrame اخیر برای regime detection (اختیاری)
            open_positions: معاملات باز (برای correlation)
            account_balance: موجودی فعلی برای محاسبه‌ی درصد زیان
            signal_strategy: "trend" یا "reversion" — برای match با regime
            now: زمان مرجع (پیش‌فرض الان UTC)
            pip_size: اندازه پیپ — اگر None، از symbol_config محاسبه می‌شود

        خروجی: GuardResult با لیست دلایل و وضعیت کلی
        """
        if now is None:
            now = datetime.now(timezone.utc)
        result = GuardResult(allowed=True)
        cfg = get_symbol_config(symbol)

        # ── ۱) Weekend ──
        blackout, reason = is_weekend_blackout(now)
        if blackout:
            result.reject(RejectionReason.WEEKEND_BLACKOUT, reason or "weekend blackout")
            return result  # weekend → بقیه نیازی نیست

        # ── ۱.۵) Holiday ──
        h_blackout, h_reason = is_holiday_blackout(now)
        if h_blackout:
            result.reject(RejectionReason.HOLIDAY_BLACKOUT, h_reason or "holiday blackout")
            return result

        # ── ۲) Session ──
        allowed, reason = is_session_allowed(symbol, now, strict_unknown=True)
        if not allowed:
            # پنجره‌ی کم‌نقدینگیِ پس از NY با کد اختصاصیِ LOW_LIQUIDITY برچسب
            # می‌خورد (نه SESSION_NOT_ALLOWED) تا metric ها درست باشند.
            if reason and reason.startswith("low_liquidity_window:"):
                result.reject(RejectionReason.LOW_LIQUIDITY, reason)
            else:
                result.reject(RejectionReason.SESSION_NOT_ALLOWED, reason or "session not allowed")
            # ادامه می‌دهیم تا تمام مشکلات را گزارش کنیم

        # ── ۳) Daily loss limit ──
        # فلسفهٔ مالک: کیفیت باید در «ساختارِ خودِ سیگنال» باشد (امتیاز، R/R تا TP3،
        # رژیم، Claude، SL/TP)، نه در یک مدارشکنی که کلِ فید را خفه کند. پس مدارشکنِ
        # زیانِ روزانه دیگر «ارسالِ سیگنال» را قطع نمی‌کند؛ فقط برای آگاهی ثبت می‌شود
        # (و اگر روزی برای محافظتِ اتو-تریدِ مَستر لازم شد با DAILY_LOSS_BLOCKS_EMISSION
        # روشن می‌شود). هدف: فید هیچ‌وقت قطع نشود ولی سودده باشد.
        from src.core.config import settings as _scfg
        if getattr(_scfg, "DAILY_LOSS_BLOCKS_EMISSION", False):
            try:
                ok, reason = await self._daily.can_emit_signal(account_balance, now)
                if not ok:
                    result.reject(RejectionReason.DAILY_LOSS_LIMIT, reason or "daily limit")
            except Exception as exc:
                result.reject(RejectionReason.DAILY_LOSS_LIMIT, f"daily-loss check error: {exc}")
                result.metadata["daily_loss_check_error"] = str(exc)
        else:
            try:
                ok, reason = await self._daily.can_emit_signal(account_balance, now)
                if not ok:
                    result.metadata["daily_loss_note"] = reason or "daily limit (غیرمسدودکننده)"
            except Exception:  # noqa: BLE001
                pass

        # ── ۴) Correlation ──
        # همبستگی یک محدودیتِ «سبدِ تک‌حساب» است (نباید ۱۰ پوزیشنِ هم‌بسته باز شود)،
        # نه مناسبِ «فیدِ سیگنال» که کلِ سیگنال‌های فعال را یک سبد فرض کند و فید را
        # خفه کند. مثلِ daily-loss: پیش‌فرض غیرمسدودکننده (فقط ثبت)؛ برای محافظتِ
        # سختِ اتو-تریدِ مَستر با CORRELATION_BLOCKS_EMISSION=True روشن می‌شود.
        if open_positions is not None:
            try:
                reason = self._correlation.evaluate(symbol, direction, open_positions)
                if reason:
                    if getattr(_scfg, "CORRELATION_BLOCKS_EMISSION", False):
                        result.reject(RejectionReason.CORRELATION_RISK, reason)
                    else:
                        result.metadata["correlation_note"] = reason
            except Exception:  # noqa: BLE001 — هرگز فید را به‌خاطرِ خطای همبستگی قطع نکن
                pass

        # ── ۵) Symbol-specific R/R و SL bounds ──
        # اندازه‌ی پیپ
        if pip_size is None:
            from src.core.config import settings as _settings
            try:
                pip_size = _settings.pip_values.get(symbol, 0.0001)
            except Exception:
                pip_size = 0.0001

        if pip_size and pip_size > 0:
            sl_pips = abs(entry_price - sl) / pip_size
            tp1_pips = abs(tp1 - entry_price) / pip_size
            rr = tp1_pips / sl_pips if sl_pips > 0 else 0.0
            result.metadata["sl_pips"] = round(sl_pips, 1)
            result.metadata["tp1_pips"] = round(tp1_pips, 1)
            result.metadata["rr_tp1"] = round(rr, 3)

            if rr < cfg.min_rr_tp1:
                result.reject(
                    RejectionReason.LOW_RR,
                    f"R/R تا TP1 = {rr:.2f} < حد {symbol} ({cfg.min_rr_tp1}).",
                )
            if sl_pips < cfg.min_sl_pips:
                result.reject(
                    RejectionReason.SL_TOO_TIGHT,
                    f"SL = {sl_pips:.1f} پیپ کمتر از حداقل {symbol} ({cfg.min_sl_pips}).",
                )
            # سقفِ SL به‌صورتِ ATR-relative (رفعِ ردِ نادرستِ SLِ سالمِ اندیس/فلز).
            # سقفِ پیپیِ ثابت غلط بود: SLِ موتور ~۴.۸۷۵×ATR است ولی سقفِ ثابتِ
            # NAS100=3000 پیپ در ATRهای عادی شکسته می‌شد. حالا سقف = max_sl_atr_mult×ATR
            # با بک‌استاپِ ۵٪ قیمت؛ اگر ATR در دسترس نبود به سقفِ پیپیِ قدیمی fail-open.
            _atr_cap = None
            if candles_df is not None:
                try:
                    _rg = detect_regime(candles_df)
                    if _rg is not None and getattr(_rg, "atr", None) and _rg.atr > 0:
                        _atr_cap = float(_rg.atr)
                except Exception:  # noqa: BLE001
                    _atr_cap = None
            sl_dist = abs(entry_price - sl)
            if _atr_cap and _atr_cap > 0:
                _mult = getattr(cfg, "max_sl_atr_mult", 8.0)
                max_sl_dist = _atr_cap * _mult
                price_backstop = abs(entry_price) * 0.05  # سقفِ سختِ ۵٪ مقابلِ ATRِ خراب
                result.metadata["max_sl_atr_mult"] = _mult
                if sl_dist > max_sl_dist or sl_dist > price_backstop:
                    result.reject(
                        RejectionReason.SL_TOO_WIDE,
                        f"SL = {sl_pips:.1f} پیپ بیشتر از حدِ ATR-relative {symbol} ({_mult}×ATR).",
                    )
            elif sl_pips > cfg.max_sl_pips:
                # fail-open: ATR نبود → سقفِ پیپیِ قدیمی
                result.reject(
                    RejectionReason.SL_TOO_WIDE,
                    f"SL = {sl_pips:.1f} پیپ بیشتر از حداکثر {symbol} ({cfg.max_sl_pips}).",
                )

        # ── ۶) Regime ──
        if candles_df is not None:
            try:
                regime = detect_regime(candles_df)
                result.regime = regime
                if regime is not None:
                    self._check_regime_match(result, regime, direction, signal_strategy, cfg, symbol)
            except Exception as exc:
                result.metadata["regime_check_error"] = str(exc)

        # ── ۷) Liquidity check (فاز ۳ wire-up) ──
        if candles_df is not None and pip_size and pip_size > 0:
            try:
                from src.analysis.volume_profile import assess_liquidity
                liq = assess_liquidity(candles_df, pip_size=pip_size)
                if liq is not None:
                    result.metadata["liquidity_ratio"] = round(liq.volume_ratio, 3)
                    result.metadata["vwap_distance_pips"] = round(liq.vwap_distance_pips, 1)
                    if liq.is_low_liquidity:
                        result.reject(
                            RejectionReason.LOW_LIQUIDITY,
                            f"حجم {liq.volume_ratio:.2f}× میانگین — اسپرد بالا، اجرا نامطمئن.",
                        )
            except Exception as exc:
                result.metadata["liquidity_check_error"] = str(exc)

        # ── انتشار rejection برای UI و observability ──
        if not result.allowed and self._publish_rejections:
            await self._publish_rejection(symbol, direction, result, now)

        return result

    async def _publish_rejection(
        self,
        symbol: str,
        direction: str,
        result: "GuardResult",
        now: datetime,
    ) -> None:
        """
        ثبت یک rejection در Redis list برای نمایش در RiskPage.

        از LPUSH + LTRIM استفاده می‌کنیم تا فقط N مورد آخر نگهداری شود.
        خطا را silent می‌کنیم چون publish نباید مسیر اصلی را block کند.
        نیز در Prometheus counter اضافه می‌کنیم.
        """
        try:
            # Prometheus counter
            from src.core.metrics import risk_rejections_total
            for code, _detail in result.reasons:
                risk_rejections_total.labels(symbol=symbol, reason=code.value).inc()
        except Exception:
            pass

        try:
            import orjson
            from src.core.redis_client import redis_client

            payload = orjson.dumps({
                "timestamp": now.isoformat(),
                "symbol": symbol,
                "direction": direction,
                "reasons": [r[0].value for r in result.reasons],
                "metadata": result.metadata,
            }).decode("utf-8")
            await redis_client.client.lpush("risk:rejections", payload)
            await redis_client.client.ltrim(
                "risk:rejections", 0, self._max_rejection_log_size - 1
            )
        except Exception:
            # Redis قطع باشد؟ فقط در metrics ثبت کنیم، silent fail
            pass

    def _check_regime_match(
        self,
        result: GuardResult,
        regime: RegimeAnalysis,
        direction: str,
        strategy: str,
        cfg: Any,
        symbol: str,
    ) -> None:
        """بررسی تطبیق سیگنال با رژیم بازار."""

        # spike نوسانی → معمولاً سیگنال‌های جدید رد شوند (اخبار/panic)
        if regime.regime == MarketRegime.HIGH_VOLATILITY and self._reject_high_vol:
            result.reject(
                RejectionReason.VOLATILITY_SPIKE,
                "ATR در صدک بالا — احتمالاً خبر یا panic، صبر تا تسکین.",
            )

        # ATR بالاتر از حد percentile در symbol_config → spike شدید
        # elif تا با شاخه‌ی HIGH_VOLATILITY بالا rejection تکراری تولید نشود
        elif regime.atr_percentile > cfg.max_atr_percentile:
            result.reject(
                RejectionReason.VOLATILITY_SPIKE,
                f"ATR در صدک {regime.atr_percentile:.0%} > حد {cfg.max_atr_percentile:.0%} برای {symbol}.",
            )

        # transitional → اختیاری
        if regime.regime == MarketRegime.TRANSITIONAL and self._reject_transitional:
            result.reject(
                RejectionReason.REGIME_MISMATCH,
                "بازار در رژیم گذار — تأیید کافی نیست.",
            )

        # trend-following در ranging؟
        if strategy == "trend" and regime.is_ranging() and self._block_trend_in_ranging:
            result.reject(
                RejectionReason.REGIME_MISMATCH,
                "استراتژی trend-following در رژیم ranging → نسبت برد پایین.",
            )

        # mean-reversion در trending؟
        if strategy == "reversion" and regime.is_trending() and self._block_reversion_in_trending:
            result.reject(
                RejectionReason.REGIME_MISMATCH,
                "استراتژی mean-reversion در رژیم trending → ریسک catching falling knife.",
            )

        # تأیید جهت trend
        if regime.regime == MarketRegime.TRENDING_DOWN and direction == "long":
            result.metadata["regime_warning"] = (
                "روند نزولی است و سیگنال خرید — احتیاط بیشتر."
            )
        elif regime.regime == MarketRegime.TRENDING_UP and direction == "short":
            result.metadata["regime_warning"] = (
                "روند صعودی است و سیگنال فروش — احتیاط بیشتر."
            )
