"""
موتور اصلی تولید سیگنال — هماهنگ‌کننده تمام ماژول‌های تحلیلی.

این ماژول حلقه اصلی تحلیل را مدیریت می‌کند:
    ۱. هر ۵ دقیقه (قابل تنظیم) برای هر نماد اجرا می‌شود
    ۲. کندل‌های تمام تایم‌فریم‌ها دریافت می‌شود
    ۳. تحلیل تکنیکال، الگویی، اسمارت مانی، حجمی انجام می‌شود
    ۴. پیش‌بینی هوش مصنوعی اجرا می‌شود
    ۵. تحلیل چند تایم‌فریمی ترکیب می‌شود
    ۶. امتیازدهی با scorer انجام می‌شود
    ۷. در صورت کسب حداقل امتیاز، سیگنال ساخته می‌شود
    ۸. سطوح TP/SL با risk_manager محاسبه می‌شود
    ۹. سیگنال در دیتابیس و Redis ذخیره می‌شود
    ۱۰. به کانال Redis برای ربات تلگرام ارسال می‌شود
    ۱۱. سیگنال‌های فعال ردیابی می‌شوند

می‌تواند به صورت سرویس مستقل async اجرا شود.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy import select

from src.analysis.candlestick_patterns import CandlestickAnalyzer
from src.analysis.chart_patterns import ChartPatternAnalyzer
from src.analysis.multi_timeframe import MultiTimeframeAnalyzer
from src.analysis.smart_money import SmartMoneyAnalyzer
from src.analysis.support_resistance import SupportResistanceAnalyzer
from src.analysis.technical import TechnicalAnalyzer
from src.analysis.volume_analysis import VolumeAnalyzer
from src.core import instruments
from src.core.config import settings
from src.core.database import Signal, async_session_factory
from src.core.logger import get_logger, setup_logging
from src.core.metrics import (
    analysis_duration,
    signal_score_histogram,
    signals_active,
    signals_generated,
)
from src.core.redis_client import redis_client
from src.data.candle_builder import CandleBuilder
from src.data.feed_manager import feed_manager
from src.ml.ensemble import EnsemblePredictor
from src.risk.guard import RejectionReason, RiskGuard
from src.risk.regime_detector import MarketRegime, detect_regime
from src.risk.symbol_config import get_symbol_config
from src.signals.candle_utils import (
    TIMEFRAME_SECONDS as _TIMEFRAME_SECONDS_MAP,
    drop_unclosed_candle,
)
from src.signals.news_filter import NewsFilter
from src.signals.macro_filter import MacroFilter
from src.signals.risk_manager import RiskManager
from src.signals.scorer import ScoringContext, SignalScorer, SignalStrength
from src.signals.tracker import SignalTracker

logger = get_logger(__name__)


class SignalEngine:
    """
    موتور اصلی تولید سیگنال.

    تمام ماژول‌های تحلیلی، امتیازدهی و مدیریت ریسک را هماهنگ
    کرده و سیگنال‌های معاملاتی تولید می‌کند.
    """

    def __init__(self) -> None:
        """ساخت نمونه موتور سیگنال و مقداردهی اولیه تحلیلگرها"""
        # تحلیلگرها
        self._technical = TechnicalAnalyzer()
        self._candlestick = CandlestickAnalyzer()
        self._chart_pattern = ChartPatternAnalyzer()
        self._smc = SmartMoneyAnalyzer()
        self._sr = SupportResistanceAnalyzer()
        self._volume = VolumeAnalyzer()
        self._mtf = MultiTimeframeAnalyzer(technical_analyzer=self._technical)

        # هوش مصنوعی
        self._ml_predictors: Dict[str, EnsemblePredictor] = {}

        # سیگنال — دو scorer: روند (پیش‌فرض) و رنج (وزن بیشتر به ML/الگو چون
        # اندیکاتورهای روندی در بازار رنج ساختاراً خنثی‌اند).
        self._scorer = SignalScorer()
        self._scorer_ranging = SignalScorer(
            technical_weight=0.25, pattern_weight=0.30, ml_weight=0.45,
        )
        # RiskManager per-symbol (تا ضریب ATR هر نماد از symbol_config اعمال شود؛
        # قبلاً RiskManager() بدون آرگومان ساخته می‌شد و ضرایب per-symbol مرده بودند).
        self._risk_managers: Dict[str, RiskManager] = {}
        self._news_filter = NewsFilter()
        self._macro_filter = MacroFilter()
        self._tracker = SignalTracker()

        # مدیریت ریسک — daily loss limit، session، correlation، regime
        self._risk_guard = RiskGuard()

        # وضعیت
        self._running: bool = False
        self._analysis_interval: int = settings.ANALYSIS_INTERVAL_SECONDS
        self._symbols: List[str] = settings.SYMBOLS
        self._timeframes: List[str] = settings.TIMEFRAMES

    # ------------------------------------------------------------------
    # چرخه حیات سرویس
    # ------------------------------------------------------------------

    async def _refresh_broker_specs(self) -> None:
        """مشخصاتِ واقعیِ بروکر را از redis (symspec:*) می‌خواند و روی پیش‌فرضِ ثابت
        می‌نشاند (overlay). EAِ MT5 این‌ها را گزارش می‌کند؛ تا قبل از گزارش، مقادیرِ
        تحقیق‌شدهٔ ثابت استفاده می‌شود."""
        try:
            import json as _json
            keys = [k async for k in redis_client.client.scan_iter("symspec:*")]
            for k in keys:
                raw = await redis_client.client.get(k)
                if not raw:
                    continue
                d = _json.loads(raw)
                instruments.apply_broker_spec(
                    d.get("symbol", ""),
                    contract_size=d.get("contract_size"),
                    pip_size=d.get("pip_size"),
                    pip_dollar_per_lot=d.get("pip_dollar_per_lot"),
                    spread_pips=d.get("spread_pips"),
                    min_stop_pips=d.get("min_stop_pips"),
                )
        except Exception as exc:  # noqa: BLE001 — overlay اختیاری است
            logger.debug("broker_specs_refresh_failed", error=str(exc))

    async def start(self) -> None:
        """
        شروع موتور سیگنال.

        اتصال به Redis، بارگذاری مدل‌های ML و شروع حلقه‌های
        تحلیل و ردیابی.
        """
        logger.info("signal_engine_starting")
        self._running = True

        # اتصال به Redis
        await redis_client.connect()

        # اتصال منابع داده تا get_candles زنده (yfinance رایگان) کار کند —
        # وگرنه موتور به کندل‌های پراکنده‌ی DB می‌افتد و همیشه NO_SIGNAL می‌دهد
        try:
            await feed_manager.connect_sources()
        except Exception as exc:  # noqa: BLE001
            logger.error("feed_manager_connect_failed", error=str(exc))

        # RiskGuard را با DailyLossLimitِ Redis-backed بساز تا با tracker یک store
        # مشترک داشته باشد؛ وگرنه مدارشکن daily-loss همیشه ۰ می‌بیند و فعال نمی‌شود.
        try:
            from src.risk.daily_loss_limit import DailyLossLimit
            self._risk_guard = RiskGuard(
                daily_loss_limit=DailyLossLimit(
                    redis_client=redis_client.client,
                    max_daily_loss_dollar=settings.MAX_DAILY_LOSS_DOLLAR,
                    max_daily_loss_pct=settings.MAX_DAILY_LOSS_PCT,
                    max_consecutive_losses=settings.MAX_CONSECUTIVE_LOSSES,
                    max_signals_per_day=settings.MAX_SIGNALS_PER_DAY,
                )
            )
            logger.info("risk_guard_redis_backed")
        except Exception as exc:  # noqa: BLE001
            logger.error("risk_guard_init_failed", error=str(exc))

        # بارگذاری مدل‌های ML
        self._load_ml_models()

        # بروزرسانی وضعیت سرویس
        await redis_client.set_service_status("signal_engine", {
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "symbols": len(self._symbols),
            "interval_seconds": self._analysis_interval,
        })

        logger.info(
            "signal_engine_started",
            symbols=len(self._symbols),
            timeframes=self._timeframes,
            interval=self._analysis_interval,
        )

        # اجرای همزمان حلقه تحلیل و ردیابی
        await asyncio.gather(
            self._analysis_loop(),
            self._tracker.start(),
        )

    async def stop(self) -> None:
        """توقف موتور سیگنال و آزادسازی منابع"""
        logger.info("signal_engine_stopping")
        self._running = False
        await self._tracker.stop()
        await self._news_filter.close()
        await self._macro_filter.close()

        await redis_client.set_service_status("signal_engine", {
            "status": "stopped",
            "stopped_at": datetime.now(timezone.utc).isoformat(),
        })

        await redis_client.close()
        logger.info("signal_engine_stopped")

    def _load_ml_models(self) -> None:
        """
        بارگذاری مدل‌های یادگیری ماشین برای تمام نمادها.

        برای هر نماد یک EnsemblePredictor ساخته شده و مدل‌ها
        بارگذاری می‌شوند.
        """
        for symbol in self._symbols:
            try:
                predictor = EnsemblePredictor(symbol)
                load_results = predictor.load_models()
                self._ml_predictors[symbol] = predictor
                logger.info(
                    "ml_models_loaded",
                    symbol=symbol,
                    results=load_results,
                )
            except Exception as e:
                logger.error(
                    "ml_model_load_error",
                    symbol=symbol,
                    error=str(e),
                )
                # ساخت predictor حتی در صورت خطا
                self._ml_predictors[symbol] = EnsemblePredictor(symbol)

    # ------------------------------------------------------------------
    # حلقه تحلیل
    # ------------------------------------------------------------------

    async def _analysis_loop(self) -> None:
        """
        حلقه اصلی تحلیل — هر ۵ دقیقه تمام نمادها تحلیل می‌شوند.

        نمادها به صورت ترتیبی (با فاصله کوتاه) تحلیل می‌شوند
        تا از فشار بیش از حد بر منابع جلوگیری شود.
        """
        while self._running:
            cycle_start = time.monotonic()

            # مشخصاتِ واقعیِ بروکر (contract_size/spread/min_stop) را از redis تازه کن
            # تا SL/TP بر پایهٔ دادهٔ دقیقِ بروکر محاسبه شود (نه تخمینِ ثابت).
            await self._refresh_broker_specs()  # noqa: تعریف در پایینِ همین کلاس

            logger.info(
                "analysis_cycle_starting",
                symbols=len(self._symbols),
            )

            for symbol in self._symbols:
                if not self._running:
                    break

                # نمادهای بلاک‌شدهٔ داده‌محور (مثلِ US30 با ۰٪ برد) کاملاً رد می‌شوند
                if symbol in (settings.SIGNAL_SYMBOL_BLOCKLIST or []):
                    continue

                # هر تایم‌فریمِ سیگنال (M15 و M5) جداگانه تحلیل می‌شود تا هر دو
                # سیگنال بدهند. dedup بر اساس (نماد، تایم‌فریم، جهت) از اسپم جلوگیری می‌کند.
                for tf in settings.SIGNAL_TIMEFRAMES:
                    if not self._running:
                        break
                    try:
                        await self._analyze_symbol(symbol, only_tf=tf)
                    except Exception as e:
                        logger.error(
                            "symbol_analysis_error",
                            symbol=symbol,
                            timeframe=tf,
                            error=str(e),
                        )
                    await asyncio.sleep(0.3)

            cycle_duration = time.monotonic() - cycle_start
            logger.info(
                "analysis_cycle_completed",
                duration_seconds=round(cycle_duration, 2),
            )

            # انتظار تا دور بعدی
            remaining = max(0, self._analysis_interval - cycle_duration)
            if remaining > 0:
                await asyncio.sleep(remaining)

    async def _analyze_symbol(self, symbol: str, only_tf: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        تحلیل کامل یک نماد.

        مراحل:
            ۱. دریافت کندل تمام تایم‌فریم‌ها
            ۲. تحلیل تکنیکال
            ۳. تحلیل الگوهای کندل‌استیک
            ۴. تحلیل الگوهای نموداری
            ۵. تحلیل اسمارت مانی
            ۶. تحلیل حجم
            ۷. تحلیل حمایت/مقاومت
            ۸. پیش‌بینی ML
            ۹. تحلیل چند تایم‌فریمی
            ۱۰. امتیازدهی
            ۱۱. صدور سیگنال (در صورت کسب حداقل امتیاز)

        پارامترها:
            symbol: نماد معاملاتی

        خروجی:
            دیکشنری سیگنال یا None
        """
        start_time = time.monotonic()

        # ---- ۱. دریافت کندل‌ها ----
        candles_by_tf = await self._fetch_candles(symbol)
        if not candles_by_tf:
            logger.warning("no_candles_available", symbol=symbol)
            return None

        # ---- ۱.۱ حذف کندل ناقص از تمام تایم‌فریم‌ها ----
        # تمام تحلیل‌ها باید روی کندل بسته انجام شوند تا look-ahead bias
        # ایجاد نشود و الگوها/اندیکاتورها پایدار باشند.
        candles_by_tf = {
            tf: self._drop_unclosed_candle(tf_df, tf)
            for tf, tf_df in candles_by_tf.items()
            if tf_df is not None
        }

        # تایم‌فریمِ انتشارِ سیگنال (اسکلپ: M15 → M5 طبقِ SIGNAL_TIMEFRAMES).
        # تایم‌فریم‌های بالاتر (H1/H4/D1) فقط برای تأییدِ روندِ MTF گرفته می‌شوند و
        # هیچ سیگنالی روی آن‌ها منتشر نمی‌شود (تا انتظارِ چندروزه ایجاد نشود).
        primary_tf = None
        df = None
        _signal_tfs = [only_tf] if only_tf else settings.SIGNAL_TIMEFRAMES
        for tf in _signal_tfs:
            cand = candles_by_tf.get(tf)
            if cand is not None and not cand.empty:
                primary_tf = tf
                df = cand
                break

        if df is None or df.empty:
            logger.warning("no_signal_timeframe_candles", symbol=symbol,
                           signal_tfs=settings.SIGNAL_TIMEFRAMES)
            return None

        # ---- ۲-۸. تحلیل‌های pandas-heavy موازی در thread pool ----
        # قبلاً: تحلیل‌ها sequential در event loop blocking بودند → up to 2s freeze
        # حالا: gather موازی روی thread pool — event loop آزاد می‌ماند
        from src.core.async_utils import run_in_thread

        async def _safe_analyze(name: str, analyze_fn, fallback: Dict[str, Any]) -> Dict[str, Any]:
            try:
                return await run_in_thread(analyze_fn, df, timeout=10.0)
            except Exception as e:
                logger.error(f"{name}_analysis_error", symbol=symbol, error=str(e))
                return fallback

        # ML prediction
        predictor = self._ml_predictors.get(symbol)

        async def _ml_predict() -> Dict[str, Any]:
            # نکته: fallbackِ خنثی (۵۰) سیگنال را بلاک نمی‌کند، اما تا الان بی‌صدا بود و
            # امتیاز را مصنوعاً به میانه می‌کشید. حالا با متریک/هشدار آشکار می‌شود.
            if predictor is None:
                from src.core.metrics import ml_fallback_total
                ml_fallback_total.labels(symbol=symbol, reason="no_model").inc()
                logger.warning("ml_degraded_no_model", symbol=symbol, ml_score=50.0)
                return {"ml_score": 50.0, "direction": "neutral", "confidence": 0}
            try:
                return await run_in_thread(predictor.predict, df, timeout=5.0)
            except Exception as e:
                from src.core.metrics import ml_fallback_total
                ml_fallback_total.labels(symbol=symbol, reason="predict_error").inc()
                logger.error("ml_prediction_error", symbol=symbol, error=str(e))
                return {"ml_score": 50.0, "direction": "neutral", "confidence": 0}

        # تمام تحلیل‌ها به‌صورت gather موازی
        (
            tech_result,
            candle_result,
            chart_result,
            smc_result,
            volume_result,
            sr_result,
            ml_result,
        ) = await asyncio.gather(
            _safe_analyze("technical", self._technical.analyze, {"technical_score": 50.0, "signal": "neutral"}),
            _safe_analyze("candlestick", self._candlestick.analyze, {"pattern_score": 50.0, "patterns_found": []}),
            _safe_analyze("chart_pattern", self._chart_pattern.analyze, {"pattern_score": 50.0, "patterns_found": []}),
            _safe_analyze("smc", self._smc.analyze, {
                "smc_score": 50.0, "smc_bias": "neutral",
                "order_blocks": [], "supply_demand_zones": [],
            }),
            _safe_analyze("volume", self._volume.analyze, {"volume_score": 50.0, "volume_confirms_trend": False}),
            _safe_analyze("sr", self._sr.analyze, {"sr_levels": [], "fibonacci_extension": {}}),
            _ml_predict(),
        )

        # ---- ۹. تحلیل چند تایم‌فریمی (موازی روی thread pool) ----
        try:
            tf_items = [
                (tf, tf_df) for tf, tf_df in candles_by_tf.items()
                if tf_df is not None and not tf_df.empty
            ]

            async def _tf_analyze(tf: str, tf_df) -> tuple[str, Optional[Dict]]:
                try:
                    res = await run_in_thread(self._technical.analyze, tf_df, timeout=5.0)
                    return tf, res
                except Exception as tf_err:
                    logger.warning("tf_analysis_skipped", symbol=symbol, tf=tf, error=str(tf_err))
                    return tf, None

            results = await asyncio.gather(*[_tf_analyze(tf, tf_df) for tf, tf_df in tf_items])
            analyses_by_tf: Dict[str, Dict] = {tf: r for tf, r in results if r is not None}
            mtf_result = await run_in_thread(
                self._mtf.analyze, candles_by_tf, analyses_by_tf, timeout=5.0,
            )
        except Exception as e:
            logger.error("mtf_analysis_error", symbol=symbol, error=str(e))
            mtf_result = {
                "confluence_count": 0, "direction": "neutral",
                "weighted_score": 50.0, "aligned": False,
            }

        # ---- بررسی اخبار ----
        try:
            news_penalty = await self._news_filter.get_penalty_score(symbol)
        except Exception as e:
            logger.error("news_filter_error", symbol=symbol, error=str(e))
            news_penalty = 0.0

        # ---- ۹.۵ تشخیص رژیم بازار — هر رژیم روشِ جهتِ متناسب با ساختارِ همان رژیم ----
        regime = detect_regime(df)
        is_ranging = regime is not None and regime.is_ranging()
        is_transitional = regime is not None and regime.regime == MarketRegime.TRANSITIONAL
        is_low_vol = regime is not None and regime.regime == MarketRegime.LOW_VOLATILITY

        # ---- ۱۰. تعیین جهت سیگنال (بر اساس رژیم) ----
        # رنج → بازگشت‌به‌میانگینِ لبه‌ی رنج؛ low-vol(squeeze) → breakout؛
        # transitional → رای با آستانه‌ی ۲ + ووت DI-spread؛ روند → اجماع ۳ رای (بدون تغییر).
        rev_conf = 0
        if is_ranging:
            signal_direction, signal_strategy, rev_conf = self._determine_reversion_direction(
                tech_result, sr_result, df,
            )
            # نکته (کاهش ضرر): ML-fallbackِ ۰.۳۰ حذف شد. یک پیش‌بینیِ جهتِ ML با
            # اطمینانِ پایین در بازارِ نه-رونده-نه-بازگشتی، ضعیف‌ترین مبدأِ سیگنال
            # بود و دقیقاً منشأِ ستاپ‌های ضررده. سیگنالِ رنج فقط از reversionِ
            # واقعیِ لبه‌ی رنج می‌آید (rev_conf>=2)، نه از حدسِ ML.
        elif is_low_vol:
            signal_direction, signal_strategy = self._determine_breakout_direction(
                tech_result, regime, volume_result,
            )
        elif is_transitional:
            signal_direction = self._determine_direction(
                tech_result, candle_result, chart_result,
                smc_result, ml_result, mtf_result,
                di_plus=regime.di_plus, di_minus=regime.di_minus, min_votes=2,
            )
            signal_strategy = "trend"
        else:  # TRENDING_UP / TRENDING_DOWN / HIGH_VOLATILITY
            signal_direction = self._determine_direction(
                tech_result, candle_result, chart_result,
                smc_result, ml_result, mtf_result,
            )
            signal_strategy = "trend"

        # استخراج RSI (تو در تو در momentum) برای بونوس کیفیت reversion
        rsi_val = 50.0
        for _ind in tech_result.get("momentum", []):
            if _ind.get("name") == "RSI":
                rsi_val = float(_ind.get("details", {}).get("rsi", 50.0))
                break
        # بونوس کیفیت reversion: بر اساس قدرتِ تأیید (۲ یا ۳ از: RSI extreme،
        # برخورد باند بولینگر، نزدیکی به S/R) + شدت RSI. ستاپ ۳-تأییدی یک reversion
        # باکیفیت است و سزاوار رسیدن به MEDIUM؛ ستاپ ۲-تأییدیِ مرزی کمتر.
        reversion_bonus = 0.0
        # بونوس فقط وقتی reversionِ واقعی تأیید شده (rev_conf>=1)؛ نه برای
        # سیگنالی که جهتش از ML-fallback آمده (rev_conf=0) — وگرنه بونوسِ نادرست.
        if is_ranging and signal_direction != "neutral" and rev_conf >= 2:
            # base بر اساس قدرت تأیید + جزء RSI (چرخش momentum). فقط reversionِ
            # واقعیِ لبه‌ی رنج با RSI به‌قدر کافی extreme به MEDIUM می‌رسد.
            _base = 10.0 if rev_conf >= 3 else 6.0
            _dist = abs(50.0 - rsi_val)
            reversion_bonus = _base + max(0.0, min(8.0, (_dist - 10.0) * 0.5))

        # ---- ۱۱. امتیازدهی (وزن‌های متناسب با رژیم) ----
        scorer = self._scorer_ranging if is_ranging else self._scorer
        score_breakdown = scorer.score_from_analysis(
            technical_result=tech_result,
            candlestick_result=candle_result,
            chart_pattern_result=chart_result,
            ml_result=ml_result,
            mtf_result=mtf_result,
            volume_result=volume_result,
            smc_result=smc_result,
            news_penalty=news_penalty,
            signal_direction=signal_direction,
            extra_bonus=reversion_bonus,
            signal_strategy=signal_strategy,
        )

        # ---- فاز ۲: سوگیریِ بنیادیِ COT (هم‌گراییِ نرم، +/−؛ هرگز هارد-بلاک) ----
        try:
            macro_adj = await self._macro_filter.score_adjustment(symbol, signal_direction)
        except Exception:  # noqa: BLE001 — fail-safe
            macro_adj = 0.0
        if macro_adj:
            _new = scorer._clamp(float(score_breakdown.final_score) + macro_adj)
            score_breakdown.final_score = _new
            score_breakdown.signal_strength = scorer._classify(_new)
            logger.info("macro_bias_applied", symbol=symbol, direction=signal_direction,
                        adj=macro_adj, score=round(_new, 1))

        # ثبت متریک
        signal_score_histogram.observe(score_breakdown.final_score)
        analysis_duration.labels(symbol=symbol).observe(time.monotonic() - start_time)

        logger.info(
            "symbol_analyzed",
            symbol=symbol,
            score=round(score_breakdown.final_score, 2),
            strength=score_breakdown.signal_strength.value,
            direction=signal_direction,
            strategy=signal_strategy,
            regime=regime.regime.value if regime else "unknown",
            duration=round(time.monotonic() - start_time, 3),
        )

        # ---- گیتِ جهت‌دارِ چند-تایم‌فریم + وتوی bias (رفعِ جهت‌های اشتباهِ پرضرر) ----
        # باگِ قبلی: از confluence_count = |net| استفاده می‌شد (جهت‌کور)، پس short در
        # بازارِ صعودی هم رد نمی‌شد. حالا علامتِ net و bias تایمِ بالا لحاظ می‌شود.
        if signal_direction != "neutral":
            _net = int(mtf_result.get("net_confluence", 0) or 0)
            _bias = str(mtf_result.get("higher_tf_bias", "neutral") or "neutral")
            _conflict = bool(mtf_result.get("conflict", False))
            # فقط بایاسِ «قوی» (bullish/bearish) وتو کند؛ لینِ ضعیفِ تک‌بازه
            # (slightly_*) صرفاً اطلاعاتِ کم دارد و نباید سیگنالِ سالم را هارد-بلاک کند
            # (مخالفتِ قویِ |net|>=2 با چکِ _opposed جداگانه پوشش داده می‌شود).
            _against_bias = (
                (_bias == "bullish" and signal_direction == "short")
                or (_bias == "bearish" and signal_direction == "long")
            )
            if signal_strategy == "trend":
                # فقط وقتی بلاک که MTF واقعاً «مخالف» باشد: علامتِ net مخالفِ جهت، یا
                # against_bias. net=0 یعنی «نبودِ تأیید» (نه مخالفت) → عبور کند؛ وگرنه با
                # دادهٔ نازکِ تایم‌فریمِ بالا (که همیشه net=0/neutral می‌دهد) همه‌چیز بلاک می‌شد.
                # وتوی against_bias دست‌نخورده می‌ماند، پس جهتِ اشتباهِ پرضرر برنمی‌گردد.
                # فقط مخالفتِ «قوی» (|net|>=2) بلاک کند؛ net=±1 صرفاً ضعفِ تأیید است
                # نه تضاد → عبور کند تا سیگنال‌های سالم بی‌دلیل خفه نشوند (وتوی
                # against_bias دست‌نخورده می‌ماند و جهتِ پرضررِ مخالفِ bias را می‌گیرد).
                _opposed = (
                    (signal_direction == "long" and _net <= -2)
                    or (signal_direction == "short" and _net >= 2)
                )
                if _against_bias or _opposed:
                    logger.info(
                        "signal_blocked_mtf_trend", symbol=symbol,
                        net=_net, bias=_bias, conflict=_conflict, against_bias=_against_bias,
                    )
                    return None
            else:
                # reversion ذاتاً counter-trend است؛ فقط وقتی رد که خلافِ یک bias قویِ
                # تایمِ بالا باشد (نه در رنج/سوگیریِ ضعیف).
                # ── اندیس‌ها (US30/US500/NAS100/DE40) ذاتاً رونددارند و طبقِ دادهٔ
                # واقعیِ ما، reversionِ ضدروند رویشان بدترین نرخِ برد و سریع‌ترین استاپ
                # را داشت → برای اندیس‌ها خلافِ هر bias (حتی ضعیف) را هم بلاک می‌کنیم.
                _is_index = symbol in ("US30", "US500", "NAS100", "DE40")
                # هم برای اندیس‌ها و هم بقیه: فقط خلافِ بایاسِ قوی بلاک شود (نه لینِ ضعیف).
                # _against_bias حالا ذاتاً strong-only است.
                _block = (
                    (_bias in ("bullish", "bearish") and _against_bias)
                    or (_is_index and _bias in ("bullish", "bearish") and _against_bias)
                )
                if _block:
                    logger.info(
                        "signal_blocked_reversion_vs_bias", symbol=symbol,
                        bias=_bias, direction=signal_direction, is_index=_is_index,
                    )
                    return None

        # ---- گیتِ کیفیتِ داده‌محور (کمتر ولی باکیفیت‌تر — کالیبراسیونِ ۲۰۲۶-۰۶) ----
        # بر اساسِ تحلیلِ نتایجِ واقعی: H1 در هر امتیازی بازدهِ منفی داشت → فقط بهترین
        # H1ها عبور کنند. (کفِ امتیاز ۶۰ در MIN_SIGNAL_SCORE اعمال شده و سطلِ ۵۵-۵۹
        # که ۲۰٪ برد/-1.74R بود را حذف کرد. کفِ ML آزموده شد ولی برنده‌های بزرگ را
        # می‌بُرید، پس اعمال نشد.)
        if signal_direction != "neutral":
            _fs = float(score_breakdown.final_score)
            if primary_tf == "H1" and _fs < settings.H1_MIN_SCORE:
                logger.info("signal_blocked_h1_lowscore", symbol=symbol, score=round(_fs, 1),
                            need=settings.H1_MIN_SCORE)
                return None

            # ---- فاز ۱: الزامِ کانفلوئنس برای سیگنال‌های کم‌امتیاز ----
            # سیگنالی با امتیازِ زیرِ آستانه باید حداقل یک تأییدِ هم‌گرایی داشته باشد:
            # MTF هم‌جهت، یا حجمِ تأییدکننده، یا بایاسِ تایمِ بالا هم‌جهت. سیگنال‌های قوی
            # (≥ آستانه) بدونِ نیاز عبور می‌کنند. «کمتر ولی باکیفیت‌تر» — نه بلاکِ خام.
            if settings.SIGNAL_REQUIRE_CONFLUENCE and _fs < settings.SIGNAL_CONFLUENCE_FREE_SCORE:
                _dir_long = signal_direction == "long"
                _mtf_ok = (_net >= 1 and _dir_long) or (_net <= -1 and not _dir_long)
                _vol_ok = bool(volume_result.get("volume_confirms_trend"))
                _bias_ok = (_bias == "bullish" and _dir_long) or (_bias == "bearish" and not _dir_long)
                if not (_mtf_ok or _vol_ok or _bias_ok):
                    logger.info("signal_blocked_no_confluence", symbol=symbol,
                                score=round(_fs, 1), net=_net, bias=_bias, vol=_vol_ok)
                    return None

        # ---- ۱۲. صدور سیگنال (نیازمند امتیاز کافی + جهت مشخص) ----
        if (score_breakdown.signal_strength != SignalStrength.NO_SIGNAL
                and signal_direction != "neutral"):
            signal = await self._create_signal(
                symbol=symbol,
                direction=signal_direction,
                signal_strategy=signal_strategy,
                score_breakdown=score_breakdown,
                tech_result=tech_result,
                candle_result=candle_result,
                chart_result=chart_result,
                smc_result=smc_result,
                sr_result=sr_result,
                volume_result=volume_result,
                ml_result=ml_result,
                mtf_result=mtf_result,
                df=df,
                primary_tf=primary_tf,
            )
            return signal

        return None

    # ------------------------------------------------------------------
    # دریافت داده
    # ------------------------------------------------------------------

    async def _fetch_candles(
        self, symbol: str
    ) -> Dict[str, Optional[pd.DataFrame]]:
        """
        دریافت کندل‌های تمام تایم‌فریم‌ها برای یک نماد.

        ابتدا از Redis کش بررسی شده و در صورت عدم وجود، از
        feed_manager دریافت می‌شود.

        پارامترها:
            symbol: نماد معاملاتی

        خروجی:
            دیکشنری از تایم‌فریم به DataFrame
        """
        candles_by_tf: Dict[str, Optional[pd.DataFrame]] = {}

        for tf in self._timeframes:
            try:
                # بررسی کش Redis
                cached = await redis_client.get_json(f"candles:{symbol}:{tf}")
                if cached:
                    df = pd.DataFrame(cached)
                    if not df.empty:
                        candles_by_tf[tf] = df
                        continue

                # دریافت از feed_manager
                df = await feed_manager.get_candles(symbol, tf, count=300)

                # fallback: خواندن مستقیم از دیتابیس
                if (df is None or df.empty):
                    async with async_session_factory() as session:
                        df = await CandleBuilder.get_candles(session, symbol, tf, count=300)

                if df is not None and not df.empty:
                    candles_by_tf[tf] = df

                    # کش در Redis — تبدیل Timestamp به رشته برای سریالایز JSON
                    cache_data = df.to_dict(orient="records")
                    for row in cache_data:
                        for k, v in row.items():
                            if hasattr(v, "isoformat"):
                                row[k] = v.isoformat()
                    await redis_client.set_json(
                        f"candles:{symbol}:{tf}",
                        cache_data,
                        expire=self._get_candle_cache_ttl(tf),
                    )

            except Exception as e:
                logger.error(
                    "fetch_candles_error",
                    symbol=symbol,
                    timeframe=tf,
                    error=str(e),
                )

        return candles_by_tf

    @staticmethod
    def _get_candle_cache_ttl(timeframe: str) -> int:
        """
        زمان انقضای کش کندل بر اساس تایم‌فریم.

        تایم‌فریم‌های بزرگ‌تر مدت بیشتری کش می‌شوند.

        پارامترها:
            timeframe: نام تایم‌فریم

        خروجی:
            زمان انقضا به ثانیه
        """
        ttl_map = {
            "M15": 840,
            "H1": 60 * 15,
            "H4": 60 * 60,
            "D1": 60 * 60 * 4,
        }
        return ttl_map.get(timeframe, 60 * 15)

    # ------------------------------------------------------------------
    # تعیین جهت
    # ------------------------------------------------------------------

    def _determine_direction(
        self,
        tech_result: Dict[str, Any],
        candle_result: Dict[str, Any],
        chart_result: Dict[str, Any],
        smc_result: Dict[str, Any],
        ml_result: Dict[str, Any],
        mtf_result: Dict[str, Any],
        di_plus: float | None = None,
        di_minus: float | None = None,
        min_votes: int = 3,
    ) -> str:
        """
        تعیین جهت نهایی سیگنال بر اساس اجماع تحلیلگرها.

        پارامترها:
            di_plus/di_minus: در رژیم transitional ووت DI-spread اضافه می‌کند.
            min_votes: حداقل آرا (روند=۳، transitional=۲).

        خروجی: جهت ('long' / 'short' / 'neutral')
        """
        bullish_votes = 0
        bearish_votes = 0

        # ووت DI-spread (فقط transitional) — قوی‌ترین سیگنالِ جهتِ ارزان در ADX
        # ۲۰-۲۵. آستانه‌ی ۴.۰: در این محدوده هر دو DI حدود ۱۵-۲۵ هستند، پس شکاف
        # ۴ واحدی ≈ یک DI حدود ۲۰٪ قوی‌تر = تمایلِ نوپای واقعی، نه نویز.
        if di_plus is not None and di_minus is not None:
            if di_plus > di_minus + 4.0:
                bullish_votes += 1
            elif di_minus > di_plus + 4.0:
                bearish_votes += 1

        # تحلیل تکنیکال
        tech_score = float(tech_result.get("technical_score", 50))
        if tech_score >= 60:
            bullish_votes += 2
        elif tech_score <= 40:
            bearish_votes += 2

        # الگوهای کندل‌استیک
        candle_score = float(candle_result.get("pattern_score", 50))
        if candle_score >= 60:
            bullish_votes += 1
        elif candle_score <= 40:
            bearish_votes += 1

        # الگوهای نموداری
        chart_direction = chart_result.get("dominant_direction", "neutral")
        if chart_direction == "bullish":
            bullish_votes += 1
        elif chart_direction == "bearish":
            bearish_votes += 1

        # اسمارت مانی
        smc_bias = smc_result.get("smc_bias", "neutral")
        if smc_bias == "bullish":
            bullish_votes += 2
        elif smc_bias == "bearish":
            bearish_votes += 2

        # هوش مصنوعی — رای پلکانی: ML قویِ (>0.55) دو رای، ML متوسطِ (>0.35) یک رای.
        # جلوگیری از این‌که یک ML ضعیف به‌تنهایی به حد نصاب برسد یا SMC قوی را خنثی کند.
        ml_direction = ml_result.get("direction", "neutral")
        ml_confidence = float(ml_result.get("confidence", 0))
        if ml_direction == "long":
            if ml_confidence > 0.55:
                bullish_votes += 2
            elif ml_confidence > 0.35:
                bullish_votes += 1
        elif ml_direction == "short":
            if ml_confidence > 0.55:
                bearish_votes += 2
            elif ml_confidence > 0.35:
                bearish_votes += 1

        # چند تایم‌فریم
        mtf_direction = mtf_result.get("direction", "neutral")
        if mtf_direction == "bullish":
            bullish_votes += 2
        elif mtf_direction == "bearish":
            bearish_votes += 2
        elif mtf_direction == "slightly_bullish":
            bullish_votes += 1
        elif mtf_direction == "slightly_bearish":
            bearish_votes += 1

        # تعیین جهت نهایی — حداقل min_votes رای (روند=۳، transitional=۲).
        if bullish_votes > bearish_votes and bullish_votes >= min_votes:
            return "long"
        elif bearish_votes > bullish_votes and bearish_votes >= min_votes:
            return "short"
        return "neutral"

    def _determine_reversion_direction(
        self,
        tech_result: Dict[str, Any],
        sr_result: Dict[str, Any],
        df: pd.DataFrame,
    ) -> tuple[str, str]:
        """
        ورود بازگشت‌به‌میانگین برای رژیم رنجِ تأییدشده (ADX پایین).

        LONG نزدیک کف رنج: RSI اشباع‌فروش + برخورد به باند پایین بولینگر + نزدیک حمایت.
        SHORT نزدیک سقف رنج: RSI اشباع‌خرید + برخورد به باند بالا + نزدیک مقاومت.
        نیازمند حداقل ۲ از ۳ تأیید است؛ وگرنه neutral (بدون ادج → سیگنال نمی‌دهیم).

        خروجی: (direction, "reversion", confirmation_count)
        """
        price = float(df["close"].iloc[-1])

        # RSI (تو در تو در momentum details)
        rsi = 50.0
        for ind in tech_result.get("momentum", []):
            if ind.get("name") == "RSI":
                rsi = float(ind.get("details", {}).get("rsi", 50.0))
                break

        # موقعیت بولینگر: percent_b + flag squeeze
        bb_pct = None
        bb_squeeze = False
        for ind in tech_result.get("volatility", []):
            if ind.get("name") in ("Bollinger", "BollingerBands"):
                d = ind.get("details", {})
                bb_pct = d.get("percent_b")
                bb_squeeze = bool(d.get("squeeze", False))
                break

        nearest_support = sr_result.get("nearest_support")
        nearest_resistance = sr_result.get("nearest_resistance")
        atr = self._calculate_atr(df) or (price * 0.001)
        # آستانه‌ها به نوسانِ رژیمِ رنج کالیبره شدند (RSI 40/60 معادلِ ساختاریِ
        # 30/70 در روند است؛ ۲.۵×ATR پوششِ استانداردِ ناحیه‌ی S/R). تأییدِ ۲از۳
        # دست‌نخورده ماند — این گیتِ کیفیت است؛ فقط عرضِ باندها اصلاح شد.
        near_band = 2.5 * atr

        # LONG (کف رنج) — RSI 35 (نه 40): ۴۰ ناحیه‌ی خنثی است نه لبه‌ی اشباع.
        # ۳۵/۶۵ ساختارِ ۲از۳ را حفظ می‌کند (سیگنال از BB+S/R هم می‌آید) ولی RSI
        # فقط روی اکستریمِ واقعی تأیید می‌دهد — جلوگیری از ورودِ وسط‌رنج (منشأ ضرر).
        long_conf = 0
        if rsi <= 35.0:
            long_conf += 1
        if bb_pct is not None and (bb_pct <= 0.15 or (bb_pct <= 0.25 and bb_squeeze)):
            long_conf += 1
        if nearest_support is not None and 0 < (price - nearest_support) <= near_band:
            long_conf += 1

        # SHORT (سقف رنج)
        short_conf = 0
        if rsi >= 65.0:
            short_conf += 1
        if bb_pct is not None and (bb_pct >= 0.85 or (bb_pct >= 0.75 and bb_squeeze)):
            short_conf += 1
        if nearest_resistance is not None and 0 < (nearest_resistance - price) <= near_band:
            short_conf += 1

        if long_conf >= 2 and long_conf > short_conf:
            return "long", "reversion", long_conf
        if short_conf >= 2 and short_conf > long_conf:
            return "short", "reversion", short_conf
        return "neutral", "reversion", 0

    def _determine_breakout_direction(
        self,
        tech_result: Dict[str, Any],
        regime: Any,
        volume_result: Dict[str, Any],
    ) -> tuple[str, str]:
        """رژیم low-volatility (squeeze) → پیش‌از‌شکست. جهت از شکستِ محقق‌شده‌ی
        بولینگر (با تأیید حجم برای فیلتر شکست کاذب)؛ وگرنه تمایلِ DI-spread.

        خروجی: (direction, "breakout")
        """
        breakout_up = breakout_down = False
        for ind in tech_result.get("volatility", []):
            if ind.get("name") in ("Bollinger", "BollingerBands"):
                d = ind.get("details", {})
                breakout_up = bool(d.get("breakout_up", False))
                breakout_down = bool(d.get("breakout_down", False))
                break

        vol_ok = bool(volume_result.get("volume_confirms_trend", False))

        if breakout_up and vol_ok:
            return "long", "breakout"
        if breakout_down and vol_ok:
            return "short", "breakout"
        # squeeze بدون شکستِ محقق → تمایل از شکافِ DI (>=4)
        if regime.di_plus > regime.di_minus + 4.0:
            return "long", "breakout"
        if regime.di_minus > regime.di_plus + 4.0:
            return "short", "breakout"
        return "neutral", "breakout"

    @staticmethod
    def _sl_widen(primary_tf: str) -> float:
        """ضریبِ پهن‌سازیِ حد ضرر برای تایم‌فریمِ داده‌شده (پیش‌فرض ۱.۰)."""
        try:
            return float(settings.SL_ATR_WIDEN_BY_TF.get(primary_tf, 1.0))
        except Exception:  # noqa: BLE001
            return 1.0

    def _get_risk_manager(self, symbol: str, primary_tf: str = "") -> RiskManager:
        """RiskManager کش‌شده per-(نماد، تایم‌فریم) با ضریب ATRِ نماد × پهن‌سازیِ تایم‌فریم."""
        key = f"{symbol}|{primary_tf}"
        rm = self._risk_managers.get(key)
        if rm is None:
            cfg = get_symbol_config(symbol)
            widen = self._sl_widen(primary_tf)
            rm = RiskManager(
                atr_sl_mult=cfg.atr_sl_multiplier * widen,
                atr_trail_mult=cfg.atr_trailing_multiplier,
            )
            self._risk_managers[key] = rm
        return rm

    # ------------------------------------------------------------------
    # ساخت سیگنال
    # ------------------------------------------------------------------

    async def _create_signal(
        self,
        symbol: str,
        direction: str,
        signal_strategy: str,
        score_breakdown: Any,
        tech_result: Dict[str, Any],
        candle_result: Dict[str, Any],
        chart_result: Dict[str, Any],
        smc_result: Dict[str, Any],
        sr_result: Dict[str, Any],
        volume_result: Dict[str, Any],
        ml_result: Dict[str, Any],
        mtf_result: Dict[str, Any],
        df: pd.DataFrame,
        primary_tf: str,
    ) -> Optional[Dict[str, Any]]:
        """
        ساخت و ذخیره سیگنال جدید.

        قیمت ورود، سطوح TP/SL محاسبه شده، در دیتابیس ذخیره
        و به کانال Redis برای ربات تلگرام ارسال می‌شود.

        پارامترها:
            symbol: نماد
            direction: جهت ('long' / 'short')
            score_breakdown: نتیجه امتیازدهی
            tech_result: نتیجه تحلیل تکنیکال
            candle_result: نتیجه الگوهای کندل‌استیک
            chart_result: نتیجه الگوهای نموداری
            smc_result: نتیجه اسمارت مانی
            sr_result: نتیجه حمایت/مقاومت
            volume_result: نتیجه حجم
            ml_result: نتیجه هوش مصنوعی
            mtf_result: نتیجه چند تایم‌فریم
            df: دیتافریم کندل‌ها
            primary_tf: تایم‌فریم اصلی

        خروجی:
            دیکشنری اطلاعات سیگنال یا None
        """
        if direction == "neutral":
            return None

        # قیمت ورود — قیمت بسته‌شدن آخرین کندل بسته
        # توجه: df در این مرحله از کندل ناقص پاک‌سازی شده است
        entry_price = float(df["close"].iloc[-1])

        # ── دریافت قیمت لحظه‌ای + اعمال اسپرد ──
        # LONG با ASK وارد می‌شود و SHORT با BID. اگر قیمت لحظه‌ای موجود
        # نباشد، از close کندل بسته به‌علاوه نصف اسپرد تخمینی استفاده می‌کنیم
        # تا R/R به واقعیت نزدیک‌تر باشد.
        live_price = await redis_client.get_price(symbol)
        if live_price:
            bid = float(live_price.get("bid", 0) or 0)
            ask = float(live_price.get("ask", 0) or 0)
            mid = float(live_price.get("price", 0) or 0)

            if direction == "long":
                # برای ورود لانگ، ask اولویت دارد
                candidate = ask if ask > 0 else (mid if mid > 0 else bid)
            else:
                # برای ورود شورت، bid اولویت دارد
                candidate = bid if bid > 0 else (mid if mid > 0 else ask)

            if candidate > 0:
                entry_price = candidate

        # محاسبه ATR (روی کندل‌های بسته)
        atr_value = self._calculate_atr(df)

        # محاسبه سطوح مدیریت ریسک — RiskManager متناسب با استراتژی/نماد.
        # reversion: SL تنگ‌تر (پشت لبه‌ی رنج) و TP نزدیک‌تر (لبه‌ی مقابل رنج).
        cfg = get_symbol_config(symbol)
        if signal_strategy == "reversion":
            # SL مطابق استاندارد جهانی (همان ضریب ATR کامل نماد، نه تنگ‌تر) تا با
            # اسپایک خبری/stop-hunt زودهنگام استاپ نخورد. tp1_rr=1.5 حاشیه‌ی امن از
            # آستانه‌ی min_rr دارد. TPها کمی نزدیک‌تر از روند چون هدف لبه‌ی مقابل رنج است.
            rm = RiskManager(
                atr_sl_mult=cfg.atr_sl_multiplier * self._sl_widen(primary_tf),
                atr_trail_mult=cfg.atr_trailing_multiplier,
                tp1_rr=1.05, tp2_rr=1.54, tp3_rr=2.1,  # ~۳۰٪ نزدیک‌تر (هماهنگ با کاهشِ کلیِ TP)
            )
        else:
            rm = self._get_risk_manager(symbol, primary_tf)
        risk_levels = rm.calculate(
            symbol=symbol,
            direction=direction,
            entry_price=entry_price,
            atr_value=atr_value,
            sr_result=sr_result,
            smc_result=smc_result,
        )

        # ── Position Sizing (غیرمسدودکننده): حجم بر اساس ریسکِ ثابتِ درصدی ──
        # فقط حجم/دلار را تعیین می‌کند؛ هرگز سیگنال را بلاک نمی‌کند. lot در signal_data
        # و analysis_details ذخیره و به tracker پاس می‌شود تا سود/زیانِ دلاری سازگار بماند.
        signal_lot = 1.0
        try:
            from src.core.instruments import pip_dollar_of
            from src.risk.position_sizer import PositionSizer

            _pip_dollar = pip_dollar_of(symbol)
            _sz = PositionSizer(
                max_risk_per_trade_pct=settings.RISK_PER_TRADE_PCT
            ).fixed_fractional(
                account_equity=settings.PAPER_ACCOUNT_BALANCE,
                risk_pct=settings.RISK_PER_TRADE_PCT,
                sl_pips=risk_levels.sl_pips,
                pip_dollar_per_lot=_pip_dollar,
            )
            signal_lot = float(_sz.lot_size)
            # مقیاسِ مقادیرِ دلاریِ نمایشی از ۱ لات به لاتِ واقعی
            for _f in ("sl_dollar", "tp1_dollar", "tp2_dollar", "tp3_dollar"):
                setattr(risk_levels, _f, round(getattr(risk_levels, _f) * signal_lot, 2))
        except Exception as _e:  # noqa: BLE001 — هرگز سیگنال را بلاک نکند
            logger.warning("position_sizing_failed", symbol=symbol, error=str(_e))

        # ── ارزیابی RiskGuard — تمام لایه‌های ریسک به‌صورت یکپارچه ──
        # weekend، session، daily loss limit، correlation، رژیم بازار، R/R
        try:
            # دریافت معاملات باز فعلی برای correlation check
            open_positions = await self._get_open_positions_for_risk()

            guard_result = await self._risk_guard.evaluate(
                symbol=symbol,
                direction=direction,
                entry_price=entry_price,
                sl=risk_levels.sl_price,
                tp1=risk_levels.tp1_price,
                candles_df=df,
                open_positions=open_positions,
                account_balance=settings.PAPER_ACCOUNT_BALANCE,  # فعال‌کردن گیتِ درصدِ افتِ روزانه
                signal_strategy=signal_strategy,
                pip_size=settings.pip_values.get(symbol),
            )

            # ── انتشار رژیم بازار برای UI و monitoring ──
            if guard_result.regime is not None:
                await self._publish_regime(symbol, guard_result.regime)

            if not guard_result.allowed:
                reason_codes = [r[0].value for r in guard_result.reasons]
                logger.info(
                    "signal_rejected_by_risk_guard",
                    symbol=symbol,
                    reasons=reason_codes,
                    metadata=guard_result.metadata,
                )
                return None
        except Exception as exc:
            # fail-closed: اگر ارزیابی ریسک خطا داد، سیگنال منتشر نمی‌شود
            logger.error("risk_guard_failure", symbol=symbol, error=str(exc))
            return None

        # تعیین نوع سیگنال
        signal_type = score_breakdown.signal_strength.value

        # ناحیه ورود
        entry_zone_low = entry_price - (atr_value * 0.3)
        entry_zone_high = entry_price + (atr_value * 0.3)

        now = datetime.now(timezone.utc)

        # جزئیات تحلیل
        analysis_details = {
            "lot": round(signal_lot, 2),
            "risk_pct": settings.RISK_PER_TRADE_PCT,
            "score_breakdown": score_breakdown.to_dict(),
            "technical": {
                "score": tech_result.get("technical_score"),
                "signal": tech_result.get("signal"),
            },
            "candlestick": {
                "score": candle_result.get("pattern_score"),
                "patterns_count": len(candle_result.get("patterns_found", [])),
            },
            "chart_pattern": {
                "score": chart_result.get("pattern_score"),
                "direction": chart_result.get("dominant_direction"),
            },
            "smc": {
                "score": smc_result.get("smc_score"),
                "bias": smc_result.get("smc_bias"),
            },
            "volume": {
                "score": volume_result.get("volume_score"),
                "confirms": volume_result.get("volume_confirms_trend"),
            },
            "ml": {
                "score": ml_result.get("ml_score"),
                "direction": ml_result.get("direction"),
                "confidence": ml_result.get("confidence"),
            },
            "risk_levels": risk_levels.to_dict(),
        }

        # ---- گیت نظر دومِ Claude (پیش از ساخت سیگنال) ----
        # اگر Claude ستاپ را رد کند، سیگنال هرگز در DB ساخته، توسط tracker ردیابی
        # یا روی کانال منتشر نمی‌شود — اثر واقعی و سازگار روی سیگنال‌ها.
        # fail-open: هر خطا/ابهام/غیرفعال‌بودن = ادامه (سیگنال معتبر هرگز به‌خاطر
        # خطای LLM بلاک نمی‌شود؛ سیاست «سیگنال حتماً بیاید»).
        try:
            from src.llm.sanity_gate import review_signal as _claude_review

            _greg = guard_result.regime if guard_result else None
            _gate_signal = {
                "symbol": symbol,
                "direction": direction,
                "timeframe": primary_tf,
                "signal_score": int(score_breakdown.final_score),
                "entry_zone_low": entry_zone_low,
                "entry_zone_high": entry_zone_high,
                "sl": risk_levels.sl_price,
                "tp1": risk_levels.tp1_price,
                "tp2": risk_levels.tp2_price,
                "tp3": risk_levels.tp3_price,
                "rr_tp1": risk_levels.rr_tp1,
                "rr_tp2": risk_levels.rr_tp2,
                "rr_tp3": risk_levels.rr_tp3,
                "regime": _greg.regime.value if _greg else "unknown",
                "adx": round(float(_greg.adx), 1) if _greg else None,
                "signal_strategy": signal_strategy,
            }
            _gate_summary = {
                "tech_score": score_breakdown.technical_score,
                "pattern_score": score_breakdown.pattern_score,
                "ml_score": score_breakdown.ml_score,
                "final_score": score_breakdown.final_score,
                "mtf_direction": mtf_result.get("direction"),
                "mtf_confluence": mtf_result.get("confluence_count"),
                "mtf_conflict": mtf_result.get("conflict"),
                "higher_tf_bias": mtf_result.get("higher_tf_bias"),
                "smc_bias": smc_result.get("smc_bias"),
                "volume_confirms_trend": volume_result.get("volume_confirms_trend"),
            }
            _verdict = await _claude_review(_gate_signal, _gate_summary)
            if not _verdict.get("approve", True):
                logger.info(
                    "signal_vetoed_by_claude_gate",
                    symbol=symbol,
                    direction=direction,
                    score=int(score_breakdown.final_score),
                    confidence=_verdict.get("confidence"),
                    reason=_verdict.get("reason"),
                )
                return None
        except Exception as exc:  # noqa: BLE001 — fail-open
            logger.warning("claude_gate_skipped", symbol=symbol, error=str(exc))

        # ---- ذخیره در دیتابیس ----
        async with async_session_factory() as session:
            # ── دداپِ تطبیقیِ نوسان‌محور (اسکلپ-سوینگ) ──
            # نوسانِ عادی → ۱ سیگنالِ فعال به‌ازای (نماد،TF،جهت). نوسانِ بالا + روند →
            # تا N پوزیشن، ولی فقط با: (الف) scale-in روی بریک‌ایونِ همهٔ فعلی‌ها،
            # (ب) فاصله‌گذاریِ ≥SCALP_REENTRY_ATR_FRAC×ATR، (ج) هم‌جهت با روندِ غالب.
            existing = (
                await session.execute(
                    select(Signal).where(
                        Signal.symbol == symbol,
                        Signal.timeframe == primary_tf,
                        Signal.direction == direction,
                        Signal.status == "active",
                    )
                )
            ).scalars().all()
            n_active = len(existing)

            # ── فاز ۱: cooldownِ هر (نماد، جهت) فقط برای ورودِ تازه (n_active==0) ──
            # ریشهٔ churn: پس از بسته‌شدنِ یک سیگنال، چرخهٔ بعدی فوراً همان را دوباره می‌زد
            # (۷۲ سیگنال/روز، زنجیرهٔ ۴۹تایی باخت). scale-inِ مشروع (n_active≥۱) معاف است.
            _cd_min = int(settings.SIGNAL_COOLDOWN_MINUTES or 0)
            _cd_key = f"signal:cooldown:{symbol}:{direction}"
            if _cd_min > 0 and n_active == 0:
                try:
                    if await redis_client.client.get(_cd_key):
                        logger.info("signal_cooldown_active", symbol=symbol,
                                    direction=direction, minutes=_cd_min)
                        return None
                except Exception:  # noqa: BLE001 — fail-open
                    pass

            _reg = guard_result.regime if guard_result else None
            _atr_rank = float(getattr(_reg, "atr_rank", 0.0) or 0.0)
            _adx = float(getattr(_reg, "adx", 0.0) or 0.0)
            _di_plus = float(getattr(_reg, "di_plus", 0.0) or 0.0)
            _di_minus = float(getattr(_reg, "di_minus", 0.0) or 0.0)

            _max_concurrent = 1
            if settings.SCALP_ENABLED:
                if _atr_rank >= settings.SCALP_VOL_RANK_T2 and _adx >= settings.SCALP_ADX_T2:
                    _max_concurrent = settings.SCALP_MAX_T2
                elif _atr_rank >= settings.SCALP_VOL_RANK_T1 and _adx >= settings.SCALP_ADX_T1:
                    _max_concurrent = settings.SCALP_MAX_T1

            if n_active >= _max_concurrent:
                logger.info("dedup_max_concurrent", symbol=symbol, timeframe=primary_tf,
                            direction=direction, n_active=n_active, max=_max_concurrent,
                            atr_rank=round(_atr_rank, 2), adx=round(_adx, 1))
                return None

            if n_active >= 1:
                # scale-in فقط هم‌جهتِ روندِ غالب (نه ضدِ روند، نه رنجِ choppy)
                _trend_long = _di_plus > _di_minus
                if (direction == "long" and not _trend_long) or (direction == "short" and _trend_long):
                    logger.info("scalp_skip_counter_trend", symbol=symbol, direction=direction)
                    return None
                # همهٔ پوزیشن‌های فعلی باید به بریک‌ایون رسیده باشند (trailing_sl ست شده)
                if not all(e.trailing_sl is not None for e in existing):
                    logger.info("scalp_skip_prior_not_breakeven", symbol=symbol, n_active=n_active)
                    return None
                # فاصله‌گذاری: ورودِ جدید نباید به ورودهای فعال نزدیک‌تر از حدِ ATR باشد
                _min_dist = settings.SCALP_REENTRY_ATR_FRAC * (atr_value or 0)
                if _min_dist > 0 and any(
                    abs(entry_price - float(e.entry_price)) < _min_dist for e in existing
                ):
                    logger.info("scalp_skip_too_close", symbol=symbol, min_dist=round(_min_dist, 6))
                    return None
                logger.info("scalp_scale_in", symbol=symbol, timeframe=primary_tf, direction=direction,
                            n_active=n_active, max=_max_concurrent, atr_rank=round(_atr_rank, 2), adx=round(_adx, 1))

            signal_record = Signal(
                symbol=symbol,
                direction=direction,
                signal_type=signal_type,
                entry_price=entry_price,
                entry_zone_low=entry_zone_low,
                entry_zone_high=entry_zone_high,
                sl=risk_levels.sl_price,
                tp1=risk_levels.tp1_price,
                tp2=risk_levels.tp2_price,
                tp3=risk_levels.tp3_price,
                signal_score=int(score_breakdown.final_score),
                technical_score=score_breakdown.technical_score,
                pattern_score=score_breakdown.pattern_score,
                ml_score=score_breakdown.ml_score,
                timeframe=primary_tf,
                mtf_confirmation=mtf_result.get("timeframe_details"),
                analysis_details=analysis_details,
                status="active",
                created_at=now,
            )
            session.add(signal_record)
            await session.flush()
            signal_id = signal_record.id
            await session.commit()
            # cooldown را پس از صدورِ موفق ست کن (TTL = SIGNAL_COOLDOWN_MINUTES)
            if _cd_min > 0:
                try:
                    await redis_client.client.set(_cd_key, "1", ex=_cd_min * 60)
                except Exception:  # noqa: BLE001
                    pass

        # ---- ثبت صدور سیگنال برای سقف روزانه (daily signal cap) ----
        # وگرنه signal_count همیشه ۰ می‌ماند و max_signals_per_day هرگز اعمال نمی‌شود.
        try:
            await self._risk_guard._daily.record_signal_emitted()
        except Exception as exc:  # noqa: BLE001 — non-blocking
            logger.warning("record_signal_emitted_failed", symbol=symbol, error=str(exc))

        # ---- ذخیره در Redis ----
        signal_data = {
            "id": signal_id,
            "symbol": symbol,
            "direction": direction,
            "signal_type": signal_type,
            "lot": round(signal_lot, 2),
            "entry_price": entry_price,
            "entry_zone_low": entry_zone_low,
            "entry_zone_high": entry_zone_high,
            "sl": risk_levels.sl_price,
            "tp1": risk_levels.tp1_price,
            "tp2": risk_levels.tp2_price,
            "tp3": risk_levels.tp3_price,
            "trailing_sl": None,
            "signal_score": int(score_breakdown.final_score),
            "timeframe": primary_tf,
            "atr_value": atr_value,
            "tp1_hit": False,
            "tp2_hit": False,
            "status": "active",
            "created_at": now.isoformat(),
            "sl_pips": risk_levels.sl_pips,
            "tp1_pips": risk_levels.tp1_pips,
            "tp2_pips": risk_levels.tp2_pips,
            "tp3_pips": risk_levels.tp3_pips,
            "sl_dollar": risk_levels.sl_dollar,
            "tp1_dollar": risk_levels.tp1_dollar,
            "tp2_dollar": risk_levels.tp2_dollar,
            "tp3_dollar": risk_levels.tp3_dollar,
            "rr_tp1": risk_levels.rr_tp1,
            "rr_tp2": risk_levels.rr_tp2,
            "rr_tp3": risk_levels.rr_tp3,
        }
        # ---- گیت paper/live: سیگنال paper نباید به کانال عمومی نشت کند ----
        # در live: ثبت در signal:active:{id} + انتشار روی new_signals (که publisher
        # عمومی به آن گوش می‌دهد). در paper: namespace جدا paper:active:{id} +
        # کانال paper_signals؛ هرگز به کانال عمومی کاربران ارسال نمی‌شود.
        try:
            from src.launch.paper_trading import (
                PaperTradingConfig,
                should_publish_to_users,
            )
            _paper_cfg = PaperTradingConfig.from_settings(settings)
            _is_live = should_publish_to_users(_paper_cfg)
        except Exception:  # noqa: BLE001 — fail-safe به paper
            _is_live = False

        # ── سطوح کلیدیِ حمایت/مقاومت (با قوتِ هر سطح) برای تحلیلِ کلود ──
        _sr_levels = sr_result.get("sr_levels") or []
        _cur_price = signal_data.get("entry_price")
        _supports = sorted(
            [{"price": round(float(lv["price"]), 6), "strength": int(lv.get("strength", 0))}
             for lv in _sr_levels if lv.get("type") == "support" and lv.get("price") is not None],
            key=lambda x: x["strength"], reverse=True,
        )[:3]
        _resistances = sorted(
            [{"price": round(float(lv["price"]), 6), "strength": int(lv.get("strength", 0))}
             for lv in _sr_levels if lv.get("type") == "resistance" and lv.get("price") is not None],
            key=lambda x: x["strength"], reverse=True,
        )[:3]

        publish_data = {
            "type": "new_signal",
            "signal": signal_data,
            "analysis_summary": {
                "tech_score": score_breakdown.technical_score,
                "pattern_score": score_breakdown.pattern_score,
                "ml_score": score_breakdown.ml_score,
                "final_score": score_breakdown.final_score,
                "signal_strength": signal_type,
                "mtf_direction": mtf_result.get("direction"),
                "mtf_confluence": mtf_result.get("confluence_count"),
                "smc_bias": smc_result.get("smc_bias"),
                "volume_confirms": volume_result.get("volume_confirms_trend"),
                # ── سطوح کلیدی + جهت‌دهی ──
                "current_price": _cur_price,
                "nearest_support": sr_result.get("nearest_support"),
                "nearest_resistance": sr_result.get("nearest_resistance"),
                "support_levels": _supports,
                "resistance_levels": _resistances,
                "pivot": (sr_result.get("pivots") or {}).get("pivot"),
            },
            "timestamp": now.isoformat(),
        }

        if _is_live:
            await redis_client.set_active_signal(signal_id, signal_data)
            await redis_client.publish("new_signals", publish_data)
        else:
            # paper: namespace جدا + کانال paper — بدون نشت به کاربران عمومی
            try:
                await redis_client.set_json(
                    f"paper:active:{signal_id}", signal_data, expire=86400 * 7,
                )
            except Exception:  # noqa: BLE001
                pass
            await redis_client.publish("paper_signals", publish_data)

        # ---- ثبت متریک‌ها ----
        signals_generated.labels(
            symbol=symbol,
            direction=direction,
            signal_type=signal_type,
        ).inc()

        logger.info(
            "signal_created",
            signal_id=signal_id,
            symbol=symbol,
            direction=direction,
            type=signal_type,
            score=int(score_breakdown.final_score),
            entry=entry_price,
            sl=round(risk_levels.sl_price, 6),
            tp1=round(risk_levels.tp1_price, 6),
            tp2=round(risk_levels.tp2_price, 6),
            tp3=round(risk_levels.tp3_price, 6),
            rr_tp1=risk_levels.rr_tp1,
        )

        return signal_data

    # ------------------------------------------------------------------
    # ابزارهای کمکی
    # ------------------------------------------------------------------

    async def _get_open_positions_for_risk(self):
        """
        دریافت معاملات باز فعلی از Redis برای correlation check.

        خروجی: list[OpenPosition] برای استفاده در RiskGuard.
        """
        from src.risk.correlation import OpenPosition

        try:
            active = await redis_client.get_all_active_signals()
        except Exception:
            return []

        positions = []
        for sig in active or []:
            try:
                positions.append(OpenPosition(
                    symbol=sig.get("symbol", ""),
                    direction=sig.get("direction", "long"),
                    risk_weight=1.0,
                ))
            except Exception:
                continue
        return positions

    async def _publish_regime(self, symbol: str, regime) -> None:
        """
        کش رژیم بازار در Redis برای نمایش در RiskPage.

        کلید: risk:regime:{symbol}
        TTL: ۳۰ دقیقه (هر چرخه‌ی تحلیل به‌روز می‌شود)
        """
        try:
            data = regime.to_dict() if hasattr(regime, "to_dict") else dict(regime)
            await redis_client.set_json(f"risk:regime:{symbol}", data, expire=1800)

            # Prometheus gauge — مپ رشته → عدد
            try:
                from src.core.metrics import market_regime
                regime_to_num = {
                    "trending_down": -2.0,
                    "ranging": 0.0,
                    "transitional": 1.0,
                    "high_volatility": 1.0,
                    "low_volatility": -1.0,
                    "trending_up": 2.0,
                }
                num = regime_to_num.get(data.get("regime", ""), 0.0)
                market_regime.labels(symbol=symbol).set(num)
            except Exception:
                pass
        except Exception as exc:
            logger.debug("publish_regime_failed", symbol=symbol, error=str(exc))

    # نگاشت تایم‌فریم → ثانیه (از candle_utils import می‌شود)
    _TIMEFRAME_SECONDS: Dict[str, int] = _TIMEFRAME_SECONDS_MAP

    @staticmethod
    def _drop_unclosed_candle(
        df: pd.DataFrame,
        timeframe: str,
    ) -> pd.DataFrame:
        """wrapper روی candle_utils.drop_unclosed_candle — حفظ سازگاری API"""
        return drop_unclosed_candle(df, timeframe)

    @staticmethod
    def _calculate_atr(df: pd.DataFrame, period: int = 14) -> float:
        """
        محاسبه ATR (Average True Range) از دیتافریم.

        پارامترها:
            df: دیتافریم با ستون‌های high, low, close (فقط کندل بسته)
            period: تعداد دوره‌ها (پیش‌فرض ۱۴)

        خروجی:
            مقدار ATR فعلی
        """
        if df is None or len(df) < period + 1:
            return 0.0

        high = df["high"].astype(float)
        low = df["low"].astype(float)
        close = df["close"].astype(float)

        # True Range
        tr1 = high - low
        tr2 = abs(high - close.shift(1))
        tr3 = abs(low - close.shift(1))

        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(window=period).mean()

        return float(atr.iloc[-1]) if not atr.empty else 0.0


# ---------------------------------------------------------------------------
# نمونه سینگلتون
# ---------------------------------------------------------------------------

signal_engine = SignalEngine()


async def main() -> None:
    """
    نقطه شروع سرویس موتور سیگنال.

    می‌تواند به صورت مستقل با 'python -m src.signals.engine' اجرا شود.
    """
    setup_logging()
    logger.info("signal_engine_service_starting")
    try:
        await signal_engine.start()
    except KeyboardInterrupt:
        logger.info("signal_engine_service_interrupted")
    finally:
        await signal_engine.stop()


if __name__ == "__main__":
    asyncio.run(main())
