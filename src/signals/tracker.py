"""
ردیاب سیگنال‌های فعال — بررسی لحظه‌ای برخورد قیمت با TP و SL.

این ماژول هر ۱۰ ثانیه سیگنال‌های فعال را بررسی کرده و:
    - در صورت برخورد TP1: اطلاع‌رسانی + فعال‌سازی تریلینگ استاپ
    - در صورت برخورد TP2: اطلاع‌رسانی
    - در صورت برخورد TP3: اطلاع‌رسانی + بستن سیگنال
    - در صورت برخورد SL: اطلاع‌رسانی + بستن سیگنال
    - محاسبه PnL به پیپ و دلار
    - محاسبه عملکرد دوره‌ای (روزانه/هفتگی/ماهانه) به صورت وظیفه Celery
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.core.celery_app import celery_app
from src.core.config import settings
from src.core.database import (
    Signal,
    SignalPerformance,
    async_session_factory,
)
from src.core.instruments import pip_size_of, spread_pips_of
from src.core.logger import get_logger
from src.core.metrics import signal_pnl_pips, signal_score_histogram, signals_active, win_rate_gauge
from src.core.redis_client import redis_client
from src.signals.risk_manager import RiskManager

logger = get_logger(__name__)

# کسری از مسیرِ ورود→TP1 که با عبور از آن، استاپ به «بالای نقطهٔ ورود» (سودِ کوچک) منتقل می‌شود.
# کالیبراسیونِ ۲۰۲۶-۰۶ (داده): سربه‌سرِ زودرسِ ۰.۵ برنده‌ها را در ~۰.۵R می‌بُرید و ۲۷ معاملهٔ
# «سربه‌سر» هنوز منفی بسته می‌شد. → دیرتر (۰.۸ راهِ TP1) تا برنده‌ها بدوند و قفل واقعاً مثبت باشد.
BREAKEVEN_TRIGGER_FRAC: float = 0.8   # در ۸۰٪ راهِ TP1 استاپ بالای ورود قفل شود
BE_LOCK_FRAC: float = 0.25            # ۲۵٪ سودِ مسیرِ TP1 را قفل کن (بالای ورود، پوششِ مطمئنِ اسپرد)


def _coerce_bool(v) -> bool:
    """بولینِ امن — مقادیرِ Redis ممکن است رشته باشند ("False" در پایتون truthy است)."""
    return v in (True, "true", "True", 1, "1")


class SignalTracker:
    """
    ردیاب لحظه‌ای سیگنال‌های فعال.

    هر ۱۰ ثانیه قیمت فعلی نمادها را از Redis خوانده و با سطوح
    TP و SL هر سیگنال فعال مقایسه می‌کند.
    """

    def __init__(self) -> None:
        """ساخت نمونه ردیاب سیگنال"""
        self._running: bool = False
        self._risk_manager = RiskManager()
        self._check_interval: int = settings.TRACKING_INTERVAL_SECONDS
        self._last_reconcile: float = 0.0      # برای throttleِ هم‌سان‌سازیِ DB↔Redis
        self._reconcile_every: float = 600.0   # هر ۱۰ دقیقه

    async def start(self) -> None:
        """
        شروع حلقه ردیابی.

        تا زمانی که _running برابر True باشد، هر ۱۰ ثانیه
        سیگنال‌های فعال را بررسی می‌کند.
        """
        self._running = True
        logger.info("signal_tracker_started", interval=self._check_interval)

        while self._running:
            try:
                await self._check_all_signals()
            except Exception as e:
                logger.error("tracker_loop_error", error=str(e))

            await asyncio.sleep(self._check_interval)

    async def stop(self) -> None:
        """توقف حلقه ردیابی"""
        self._running = False
        logger.info("signal_tracker_stopped")

    async def _check_all_signals(self) -> None:
        """
        بررسی تمام سیگنال‌های فعال — موازی با asyncio.gather.

        قبلاً sequential بود → برای ۱۰۰ سیگنال × ۲۰ms = ۲۰۰۰ms
        حالا موازی → ۱۰۰ سیگنال در ~۱۰۰-۲۰۰ms

        برای جلوگیری از thundering herd روی DB/Redis، concurrency limited.
        """
        # هم‌سان‌سازیِ throttle‌شدهٔ DB↔Redis: پوزیشن‌های یتیم (در DB فعال ولی از redis
        # افتاده) را قبل از هر چیز برمی‌گرداند تا دوباره مانیتور شوند. باید پیش از
        # early-return اجرا شود (وگرنه وقتی redis خالی است یتیم‌ها نادیده می‌مانند).
        now_mono = time.monotonic()
        if now_mono - self._last_reconcile >= self._reconcile_every:
            self._last_reconcile = now_mono
            try:
                await self.reconcile_active()
            except Exception as e:  # noqa: BLE001
                logger.error("reconcile_error", error=str(e))

        active_signals = await redis_client.get_all_active_signals()
        if not active_signals:
            signals_active.set(0)
            return

        signals_active.set(len(active_signals))

        # Semaphore برای محدود کردن همزمانی (جلوگیری از pool exhaustion)
        sem = asyncio.Semaphore(20)

        async def _checked(signal_data: Dict[str, Any]) -> None:
            async with sem:
                try:
                    await self._check_single_signal(signal_data)
                except Exception as e:
                    signal_id = signal_data.get("id", "unknown")
                    logger.error(
                        "tracker_check_signal_error",
                        signal_id=signal_id,
                        error=str(e),
                    )

        await asyncio.gather(*[_checked(s) for s in active_signals])

    async def reconcile_active(self) -> Dict[str, Any]:
        """هم‌سان‌سازیِ DB↔Redis برای پوزیشن‌های فعال (منبعِ حقیقت = DB).

        پوزیشن‌هایی که در DB فعال‌اند ولی از redis افتاده‌اند (انقضای کلید یا
        evictionِ LRU) را دوباره می‌سازد تا tracker آن‌ها را برای TP/SL مانیتور کند.
        بدونِ این، پوزیشنِ یتیم برای همیشه باز می‌ماند (باگِ پوزیشن‌های ۳روزه).
        """
        async with async_session_factory() as session:
            rows = (
                await session.execute(select(Signal).where(Signal.status == "active"))
            ).scalars().all()
        db_active = {s.id: s for s in rows}

        try:
            redis_ids = {
                int(x) for x in await redis_client.client.zrevrange(
                    redis_client._ACTIVE_INDEX_KEY, 0, 1000
                )
            }
        except Exception:  # noqa: BLE001
            redis_ids = set()

        missing = [sid for sid in db_active if sid not in redis_ids]
        rehydrated = 0
        for sid in missing:
            s = db_active[sid]
            trailing = float(s.trailing_sl) if s.trailing_sl is not None else None
            data = {
                "id": s.id,
                "symbol": s.symbol,
                "direction": s.direction,
                "entry_price": float(s.entry_price) if s.entry_price is not None else 0.0,
                "sl": float(s.sl) if s.sl is not None else 0.0,
                "tp1": float(s.tp1) if s.tp1 is not None else 0.0,
                "tp2": float(s.tp2) if s.tp2 is not None else 0.0,
                "tp3": float(s.tp3) if s.tp3 is not None else 0.0,
                "trailing_sl": trailing,
                # وجودِ trailing یعنی TP1 قبلاً خورده و trailing فعال شده
                "tp1_hit": trailing is not None,
                "tp2_hit": False,
                "lot": 1.0,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            try:
                await redis_client.set_active_signal(s.id, data)
                rehydrated += 1
            except Exception as exc:  # noqa: BLE001
                logger.error("reconcile_rehydrate_error", signal_id=s.id, error=str(exc))

        if rehydrated:
            logger.info(
                "active_signals_reconciled",
                db_active=len(db_active), redis=len(redis_ids),
                rehydrated=rehydrated, ids=missing,
            )
        return {"db_active": len(db_active), "redis": len(redis_ids), "rehydrated": rehydrated}

    async def close_all_active(
        self, reason: str = "WEEKEND_CLOSE", hit_target: str = "WEEKEND"
    ) -> Dict[str, Any]:
        """بستنِ همهٔ پوزیشن‌های فعال به قیمتِ بازار (مثلاً آخرین ساعتِ جمعه).

        برای هر سیگنال، قیمتِ خروجِ وابسته به جهت (long→bid، short→ask) گرفته و با
        همان مسیرِ _close_signal بسته و به کانال اطلاع داده می‌شود. اگر قیمت در دسترس
        نباشد، با قیمتِ ورود (PnL≈۰) بسته می‌شود تا پوزیشن باز و در معرضِ گپ نماند.
        """
        active = await redis_client.get_all_active_signals()
        if not active:
            logger.info("weekend_close_no_active")
            return {"closed": 0, "reason": reason}

        closed = 0
        for signal_data in active:
            signal_id = signal_data.get("id")
            try:
                symbol = signal_data.get("symbol")
                direction = signal_data.get("direction")
                entry_price = float(signal_data.get("entry_price", 0) or 0)
                if not all([symbol, signal_id, direction]) or entry_price <= 0:
                    continue
                is_long = direction == "long"
                price_data = await redis_client.get_price(symbol)
                current_price = 0.0
                if price_data:
                    key_first = "bid" if is_long else "ask"
                    current_price = float(
                        price_data.get(key_first, 0) or price_data.get("last", 0)
                        or price_data.get("price", 0) or 0
                    )
                if current_price <= 0:
                    current_price = entry_price  # fallback: بستنِ flat تا باز نماند
                _lot = float(signal_data.get("lot", 1.0) or 1.0)
                pnl = RiskManager.calculate_pnl(
                    symbol, direction, entry_price, current_price, lot_size=_lot
                )
                await self._close_signal(
                    signal_id, signal_data, current_price, pnl,
                    close_reason=reason, hit_target=hit_target,
                )
                closed += 1
            except Exception as exc:  # noqa: BLE001
                logger.error("weekend_close_error", signal_id=signal_id, error=str(exc))

        logger.info("weekend_close_done", closed=closed, total=len(active), reason=reason)
        return {"closed": closed, "total": len(active), "reason": reason}

    async def _check_single_signal(self, signal_data: Dict[str, Any]) -> None:
        """
        بررسی یک سیگنال فعال در برابر قیمت فعلی.

        قیمت فعلی نماد از Redis دریافت شده و ترتیب بررسی:
        TP3 -> TP2 -> TP1 -> SL -> Trailing SL

        پارامترها:
            signal_data: دیکشنری اطلاعات سیگنال از Redis
        """
        symbol = signal_data.get("symbol")
        signal_id = signal_data.get("id")
        direction = signal_data.get("direction")
        entry_price = float(signal_data.get("entry_price", 0))
        sl_price = float(signal_data.get("sl", 0))
        tp1_price = float(signal_data.get("tp1", 0))
        tp2_price = float(signal_data.get("tp2", 0))
        tp3_price = float(signal_data.get("tp3", 0))
        # مقادیر بولین از Redis ممکن است رشته باشند → از _coerce_bool ماژول استفاده می‌شود
        trailing_sl = signal_data.get("trailing_sl")
        if trailing_sl in (None, "", "None", "null"):
            trailing_sl = None
        tp1_hit = _coerce_bool(signal_data.get("tp1_hit", False))
        tp2_hit = _coerce_bool(signal_data.get("tp2_hit", False))

        if not all([symbol, signal_id, direction, entry_price]):
            return

        # دریافت قیمت فعلی
        price_data = await redis_client.get_price(symbol)
        if not price_data:
            return

        is_long = direction == "long"
        # قیمت خروج وابسته به جهت است: بستن لانگ=فروش→BID، بستن شورت=خرید→ASK.
        # استفاده از bid برای هر دو، اسپرد را نادیده می‌گرفت و PnL شورت را بیش‌برآورد می‌کرد.
        if is_long:
            current_price = float(
                price_data.get("bid", 0) or price_data.get("last", 0)
                or price_data.get("price", 0)
            )
        else:
            current_price = float(
                price_data.get("ask", 0) or price_data.get("last", 0)
                or price_data.get("price", 0)
            )
        if current_price <= 0:
            return

        # محاسبه PnL فعلی — با حجمِ واقعیِ سیگنال (PositionSizer) تا دلار سازگار بماند
        _lot = float(signal_data.get("lot", 1.0) or 1.0)
        pnl = RiskManager.calculate_pnl(
            symbol, direction, entry_price, current_price, lot_size=_lot
        )

        # ---- بررسی TP3 ----
        if tp3_price and self._is_tp_hit(current_price, tp3_price, is_long):
            await self._handle_tp3_hit(signal_id, signal_data, current_price, pnl)
            return

        # ---- بررسی TP2 ----
        if tp2_price and tp1_hit and not tp2_hit and self._is_tp_hit(current_price, tp2_price, is_long):
            await self._handle_tp2_hit(signal_id, signal_data, current_price, pnl)
            return

        # ---- بررسی TP1 ----
        if tp1_price and not tp1_hit and self._is_tp_hit(current_price, tp1_price, is_long):
            await self._handle_tp1_hit(signal_id, signal_data, current_price, pnl)
            return

        # ---- بریک‌ایونِ پیش از TP1 (محافظه‌کارانه — اصلاحِ ۲۰۲۶-۰۶) ----
        # درسِ مهم: سربه‌سرِ زودرس (۳۳٪ روی نقطهٔ ورود) بردها را با کوچک‌ترین برگشتِ
        # طبیعی «سرِ صفر» می‌بست و سود را می‌خورد (tracker بُردِ فانتوم ثبت می‌کرد ولی
        # حساب چیزی نمی‌گرفت). حالا فقط وقتی معامله ≥۸۵٪ راهِ TP1 را رفت (یعنی تقریباً
        # برنده شده) استاپ را می‌بریم — آن‌هم نه روی صفر بلکه با یک buffer سودِ کوچک
        # (BE_LOCK_FRAC از مسیرِ TP1) تا اسپرد/کمیسیون پوشش داده شود و بُرد سرِ صفر نشود.
        if tp1_price and not tp1_hit and trailing_sl is None:
            _prog = (current_price - entry_price) if is_long else (entry_price - current_price)
            _tgt = abs(tp1_price - entry_price)
            if _tgt > 0 and _prog >= BREAKEVEN_TRIGGER_FRAC * _tgt:
                # قفلِ سودِ اسپرد-آگاه: استاپ باید به‌قدرِ کافی بالاتر از ورود باشد که
                # «بعد از کسرِ اسپرد» هم سودِ کوچک بماند — وگرنه برگشت با ضررِ کوچک بسته
                # می‌شد (دردِ «سربه‌سرِ ضررده»). حداقل = اسپردِ نماد + ۲ پیپ سودِ تضمینی.
                _pip = pip_size_of(symbol) or 0.0
                _min_lock = (spread_pips_of(symbol) + 2.0) * _pip if _pip else 0.0
                _lock = max(BE_LOCK_FRAC * _tgt, _min_lock)
                be_level = (entry_price + _lock) if is_long else (entry_price - _lock)
                signal_data["trailing_sl"] = be_level
                signal_data["be_premove"] = True
                trailing_sl = be_level
                await redis_client.set_active_signal(signal_id, signal_data)
                async with async_session_factory() as session:
                    await session.execute(
                        update(Signal).where(Signal.id == signal_id).values(trailing_sl=be_level)
                    )
                    await session.commit()
                logger.info("breakeven_premove", signal_id=signal_id, symbol=symbol, be=be_level)

        # ---- بررسی SL ----
        active_sl = float(trailing_sl) if trailing_sl else sl_price
        if active_sl and self._is_sl_hit(current_price, active_sl, is_long):
            await self._handle_sl_hit(signal_id, signal_data, current_price, pnl, active_sl)
            return

        # ---- بروزرسانی تریلینگ استاپ ----
        if tp1_hit and trailing_sl is not None:
            await self._update_trailing_stop(signal_id, signal_data, current_price)

    # ------------------------------------------------------------------
    # مدیریت رویدادها
    # ------------------------------------------------------------------

    async def _handle_tp1_hit(
        self,
        signal_id: int,
        signal_data: Dict[str, Any],
        current_price: float,
        pnl: Dict[str, float],
    ) -> None:
        """
        رسیدن به هدف اول — فعال‌سازی تریلینگ استاپ.

        اطلاع‌رسانی به کانال Redis و بروزرسانی وضعیت سیگنال
        در Redis و دیتابیس.
        """
        symbol = signal_data["symbol"]
        direction = signal_data["direction"]
        atr_value = float(signal_data.get("atr_value", 0))
        entry_price = float(signal_data["entry_price"])

        # حالتِ اختیاری: بستنِ کاملِ پوزیشن دقیقاً در TP1 (محافظه‌کارانه)
        if getattr(settings, "EXIT_CLOSE_AT_TP1", False):
            await self._close_signal(
                signal_id, signal_data, current_price, pnl,
                close_reason="TP1_HIT", hit_target="TP1",
            )
            return

        # محاسبه تریلینگ استاپ اولیه
        trailing_sl = self._risk_manager.calculate_trailing_stop(
            symbol=symbol,
            direction=direction,
            current_price=current_price,
            atr_value=atr_value,
        )

        # قفلِ سربه‌سرِ سودده: پس از تاچِ TP1، استاپ نه‌تنها زیرِ ورود نرود، بلکه
        # حداقل به‌اندازهٔ (اسپرد + ۲ پیپ) بالاتر از ورود قفل شود → برگشت با سودِ کوچک
        # بسته می‌شود نه ضررِ کوچک (رفعِ «سربه‌سرِ ضررده»).
        is_long = direction == "long"
        _pip = pip_size_of(symbol) or 0.0
        _floor = (spread_pips_of(symbol) + 2.0) * _pip if _pip else 0.0
        be_floor = (entry_price + _floor) if is_long else (entry_price - _floor)
        if is_long:
            trailing_sl = max(trailing_sl, be_floor)
        else:
            trailing_sl = min(trailing_sl, be_floor)

        # بروزرسانی Redis
        signal_data["tp1_hit"] = True
        signal_data["tp1_hit_at"] = datetime.now(timezone.utc).isoformat()
        signal_data["tp1_hit_price"] = current_price
        signal_data["trailing_sl"] = trailing_sl
        await redis_client.set_active_signal(signal_id, signal_data)

        # بروزرسانی دیتابیس
        async with async_session_factory() as session:
            await session.execute(
                update(Signal)
                .where(Signal.id == signal_id)
                .values(
                    trailing_sl=trailing_sl,
                    hit_target="TP1",
                )
            )
            await session.commit()

        # اطلاع‌رسانی
        notification = {
            "type": "tp1_hit",
            "signal_id": signal_id,
            "symbol": symbol,
            "direction": direction,
            "entry_price": float(signal_data["entry_price"]),
            "tp1_price": float(signal_data["tp1"]),
            "current_price": current_price,
            "trailing_sl": trailing_sl,
            "pnl_pips": pnl["pnl_pips"],
            "pnl_dollar": pnl["pnl_dollar"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await redis_client.publish("signal_updates", notification)

        logger.info(
            "tp1_hit",
            signal_id=signal_id,
            symbol=symbol,
            price=current_price,
            pnl_pips=pnl["pnl_pips"],
            trailing_sl=trailing_sl,
        )

    async def _handle_tp2_hit(
        self,
        signal_id: int,
        signal_data: Dict[str, Any],
        current_price: float,
        pnl: Dict[str, float],
    ) -> None:
        """
        رسیدن به هدف دوم — اطلاع‌رسانی.

        سیگنال بسته نمی‌شود و تریلینگ استاپ ادامه پیدا می‌کند.
        """
        symbol = signal_data["symbol"]
        direction = signal_data["direction"]

        # نردبان: با تاچِ TP2 استاپ حداقل تا TP1 بالا می‌آید (قفلِ سودِ TP1 — برگشت
        # از اینجا به بعد دستِ‌کم سودِ TP1 را تثبیت می‌کند، نه سربه‌سر).
        is_long = direction == "long"
        tp1_price = float(signal_data.get("tp1", signal_data["entry_price"]))
        prev_trail = signal_data.get("trailing_sl")
        prev_trail = (
            float(prev_trail) if prev_trail not in (None, "", "None", "null") else None
        )
        if is_long:
            new_trail = tp1_price if prev_trail is None else max(tp1_price, prev_trail)
        else:
            new_trail = tp1_price if prev_trail is None else min(tp1_price, prev_trail)

        # بروزرسانی Redis
        signal_data["tp2_hit"] = True
        signal_data["tp2_hit_at"] = datetime.now(timezone.utc).isoformat()
        signal_data["tp2_hit_price"] = current_price
        signal_data["trailing_sl"] = new_trail
        await redis_client.set_active_signal(signal_id, signal_data)

        # بروزرسانی دیتابیس
        async with async_session_factory() as session:
            await session.execute(
                update(Signal)
                .where(Signal.id == signal_id)
                .values(hit_target="TP2", trailing_sl=new_trail)
            )
            await session.commit()

        # اطلاع‌رسانی
        notification = {
            "type": "tp2_hit",
            "signal_id": signal_id,
            "symbol": symbol,
            "direction": direction,
            "entry_price": float(signal_data["entry_price"]),
            "tp2_price": float(signal_data["tp2"]),
            "current_price": current_price,
            "pnl_pips": pnl["pnl_pips"],
            "pnl_dollar": pnl["pnl_dollar"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await redis_client.publish("signal_updates", notification)

        logger.info(
            "tp2_hit",
            signal_id=signal_id,
            symbol=symbol,
            price=current_price,
            pnl_pips=pnl["pnl_pips"],
        )

    async def _handle_tp3_hit(
        self,
        signal_id: int,
        signal_data: Dict[str, Any],
        current_price: float,
        pnl: Dict[str, float],
    ) -> None:
        """
        رسیدن به هدف سوم — بستن سیگنال.

        سیگنال با وضعیت TP3_HIT بسته شده و از Redis حذف می‌شود.
        """
        await self._close_signal(
            signal_id=signal_id,
            signal_data=signal_data,
            current_price=current_price,
            pnl=pnl,
            close_reason="TP3_HIT",
            hit_target="TP3",
        )

    async def _handle_sl_hit(
        self,
        signal_id: int,
        signal_data: Dict[str, Any],
        current_price: float,
        pnl: Dict[str, float],
        sl_price: float,
    ) -> None:
        """
        برخورد با حد ضرر — بستن سیگنال.

        بررسی می‌شود که حد ضرر اصلی یا تریلینگ فعال شده است.
        """
        # طبقه‌بندیِ نوعِ بستن برای پستِ مجزا:
        #   TRAILING_SL → بعد از تاچِ TP1 سود قفل و بسته شد (پستِ «تریلینگ استاپ» + تبریک)
        #   BREAKEVEN   → قبل از TP1 برگشت و در نقطهٔ ورود بسته شد (پستِ «سربه‌سر»)
        #   SL_HIT      → حد ضررِ اصلی خورد (پستِ «حد ضرر»)
        trailing_sl = signal_data.get("trailing_sl")
        tp1_hit = _coerce_bool(signal_data.get("tp1_hit", False))
        be_premove = _coerce_bool(signal_data.get("be_premove", False))
        if trailing_sl and float(trailing_sl) == sl_price:
            if tp1_hit:
                close_reason = "TRAILING_SL"
            elif be_premove:
                close_reason = "BREAKEVEN"
            else:
                close_reason = "TRAILING_SL"
        else:
            close_reason = "SL_HIT"

        # رفعِ برچسبِ غلط: قبلاً همیشه "SL" بود حتی برای خروجِ تریلینگِ سودده →
        # گزارش و لِیبلِ ML را خراب می‌کرد. حالا از close_reason و علامتِ pnl مشتق می‌شود.
        if close_reason == "TRAILING_SL":
            ht = "TRAIL_WIN" if (pnl or 0) > 0 else "TRAIL_BE" if abs(pnl or 0) < 1e-6 else "TRAIL_SL"
        else:
            ht = "SL"
        await self._close_signal(
            signal_id=signal_id,
            signal_data=signal_data,
            current_price=current_price,
            pnl=pnl,
            close_reason=close_reason,
            hit_target=ht,
        )

    async def _close_signal(
        self,
        signal_id: int,
        signal_data: Dict[str, Any],
        current_price: float,
        pnl: Dict[str, float],
        close_reason: str,
        hit_target: str,
    ) -> None:
        """
        بستن سیگنال و بروزرسانی دیتابیس و Redis.

        پارامترها:
            signal_id: شناسه سیگنال
            signal_data: دیکشنری اطلاعات سیگنال
            current_price: قیمت فعلی
            pnl: سود/زیان محاسبه‌شده
            close_reason: دلیل بسته شدن
            hit_target: هدف برخورد‌شده
        """
        symbol = signal_data["symbol"]
        direction = signal_data["direction"]
        now = datetime.now(timezone.utc)

        # قفل idempotency: جلوگیری از double-close/double-count توسط چرخه‌های هم‌زمان
        # fail-closed: اگر Redis خطا داد، close را block می‌کنیم تا double-count رخ ندهد.
        try:
            locked = await redis_client.client.set(
                f"lock:close:{signal_id}", "1", nx=True, ex=300
            )
            if not locked:
                logger.info("close_skipped_locked", signal_id=signal_id)
                return
        except Exception as e:  # noqa: BLE001
            logger.error("close_lock_redis_error", signal_id=signal_id, error=str(e))
            return

        # محاسبه مدت‌زمان
        created_at_str = signal_data.get("created_at")
        duration_minutes = 0
        if created_at_str:
            try:
                created_at = datetime.fromisoformat(created_at_str)
                # نرمال‌سازی tzinfo: اگر created_at ساده (naive) باشد به UTC تبدیل می‌شود
                # تا تفریق با now (aware) خطای TypeError ندهد.
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                duration_minutes = int((now - created_at).total_seconds() / 60)
            except (ValueError, TypeError):
                logger.debug("signal_created_at_parse_failed", signal_id=signal_id)

        # بروزرسانی دیتابیس — گارد سطح DB: فقط سیگنال‌های active بسته می‌شوند
        # تا re-entry بعد از انقضای TTL قفل، یک no-op باشد (جلوگیری از double-count).
        async with async_session_factory() as session:
            db_result = await session.execute(
                update(Signal)
                .where(and_(Signal.id == signal_id, Signal.status == "active"))
                .values(
                    status="closed",
                    closed_at=now,
                    close_reason=close_reason,
                    pnl_pips=pnl["pnl_pips"],
                    pnl_dollar=pnl["pnl_dollar"],
                    hit_target=hit_target,
                    duration_minutes=duration_minutes,
                )
            )
            await session.commit()

        if db_result.rowcount == 0:
            # سیگنال قبلاً بسته شده — close را تکرار نمی‌کنیم ولی Redis را پاک می‌کنیم.
            logger.info("close_skipped_not_active", signal_id=signal_id)
            await redis_client.remove_active_signal(signal_id)
            return

        # حذف از Redis
        await redis_client.remove_active_signal(signal_id)

        # ثبت متریک
        signal_pnl_pips.observe(pnl["pnl_pips"])

        # ── ثبت در daily-loss-limit (فاز ۲ wire-up) ──
        # نتیجه‌ی هر معامله را به circuit breaker روزانه گزارش می‌کنیم
        # تا consecutive_losses و realized_pnl به‌روز شوند.
        try:
            from src.risk.daily_loss_limit import DailyLossLimit
            daily = DailyLossLimit(redis_client=redis_client.client)
            await daily.record_trade_outcome(float(pnl.get("pnl_dollar", 0.0)))
            # به‌روزرسانی Prometheus gauge
            try:
                from src.core.metrics import (
                    daily_consecutive_losses,
                    daily_pnl_dollar,
                    system_locked,
                )
                snap = await daily.snapshot()
                daily_pnl_dollar.set(snap.realized_pnl)
                daily_consecutive_losses.set(snap.consecutive_losses)
                system_locked.set(1 if snap.is_locked else 0)
            except Exception:
                pass
        except Exception as exc:
            # خطا در risk-tracking نباید close را block کند، ولی ERROR است چون
            # نوشتنِ ناموفق یعنی مدارشکنِ سرمایه ضررها را کمتر می‌شمارد.
            logger.error("daily_loss_record_failed", signal_id=signal_id, error=str(exc))

        # اطلاع‌رسانی
        notification = {
            "type": "signal_closed",
            "signal_id": signal_id,
            "symbol": symbol,
            "direction": direction,
            "entry_price": float(signal_data["entry_price"]),
            "close_price": current_price,
            "close_reason": close_reason,
            "hit_target": hit_target,
            "pnl_pips": pnl["pnl_pips"],
            "pnl_dollar": pnl["pnl_dollar"],
            "duration_minutes": duration_minutes,
            "timestamp": now.isoformat(),
        }
        await redis_client.publish("signal_updates", notification)

        logger.info(
            "signal_closed",
            signal_id=signal_id,
            symbol=symbol,
            reason=close_reason,
            pnl_pips=pnl["pnl_pips"],
            pnl_dollar=pnl["pnl_dollar"],
            duration=duration_minutes,
        )

    # ------------------------------------------------------------------
    # تریلینگ استاپ
    # ------------------------------------------------------------------

    async def _update_trailing_stop(
        self,
        signal_id: int,
        signal_data: Dict[str, Any],
        current_price: float,
    ) -> None:
        """
        بروزرسانی سطح تریلینگ استاپ.

        فقط در صورتی که سطح جدید بهتر (نزدیک‌تر به سود) از سطح
        فعلی باشد، جابجایی انجام می‌شود.

        پارامترها:
            signal_id: شناسه سیگنال
            signal_data: دیکشنری اطلاعات سیگنال
            current_price: قیمت فعلی
        """
        symbol = signal_data["symbol"]
        direction = signal_data["direction"]
        atr_value = float(signal_data.get("atr_value", 0))
        current_trailing = float(signal_data.get("trailing_sl", 0))

        new_trailing = self._risk_manager.calculate_trailing_stop(
            symbol=symbol,
            direction=direction,
            current_price=current_price,
            atr_value=atr_value,
            current_trailing_sl=current_trailing,
        )

        # بررسی بهبود
        is_long = direction == "long"
        improved = (
            (is_long and new_trailing > current_trailing)
            or (not is_long and new_trailing < current_trailing)
        )

        if improved:
            signal_data["trailing_sl"] = new_trailing
            await redis_client.set_active_signal(signal_id, signal_data)

            # بروزرسانی دیتابیس
            async with async_session_factory() as session:
                await session.execute(
                    update(Signal)
                    .where(Signal.id == signal_id)
                    .values(trailing_sl=new_trailing)
                )
                await session.commit()

            logger.debug(
                "trailing_sl_updated",
                signal_id=signal_id,
                symbol=symbol,
                old=current_trailing,
                new=new_trailing,
            )

    # ------------------------------------------------------------------
    # کمکی‌ها
    # ------------------------------------------------------------------

    @staticmethod
    def _is_tp_hit(current_price: float, tp_price: float, is_long: bool) -> bool:
        """بررسی اینکه آیا قیمت به هدف رسیده است.

        پارامترها:
            current_price: قیمت فعلی
            tp_price: قیمت هدف
            is_long: آیا معامله لانگ است

        خروجی:
            True اگر قیمت به هدف رسیده باشد
        """
        if is_long:
            return current_price >= tp_price
        return current_price <= tp_price

    @staticmethod
    def _is_sl_hit(current_price: float, sl_price: float, is_long: bool) -> bool:
        """بررسی اینکه آیا قیمت به حد ضرر رسیده است.

        پارامترها:
            current_price: قیمت فعلی
            sl_price: قیمت حد ضرر
            is_long: آیا معامله لانگ است

        خروجی:
            True اگر قیمت به حد ضرر رسیده باشد
        """
        if is_long:
            return current_price <= sl_price
        return current_price >= sl_price


# ---------------------------------------------------------------------------
# وظایف Celery — محاسبه عملکرد دوره‌ای
# ---------------------------------------------------------------------------

@celery_app.task(name="src.signals.tracker.calculate_performance")
def calculate_performance(period_type: str = "daily") -> Dict[str, Any]:
    """
    وظیفه Celery برای محاسبه عملکرد سیگنال‌ها.

    این وظیفه بر اساس نوع دوره (روزانه/هفتگی/ماهانه) سیگنال‌های
    بسته‌شده را تحلیل کرده و آمار عملکرد را ذخیره می‌کند.

    پارامترها:
        period_type: نوع دوره ('daily' / 'weekly' / 'monthly')

    خروجی:
        دیکشنری شامل آمار عملکرد
    """
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(_async_calculate_performance(period_type))
        return result
    finally:
        loop.close()


async def _async_calculate_performance(period_type: str) -> Dict[str, Any]:
    """
    محاسبه غیرهمگام عملکرد سیگنال‌ها.

    بر اساس نوع دوره، بازه زمانی مشخص شده و سیگنال‌های بسته‌شده
    در آن بازه استخراج و تحلیل می‌شوند.

    پارامترها:
        period_type: نوع دوره

    خروجی:
        دیکشنری شامل آمار محاسبه‌شده
    """
    now = datetime.now(timezone.utc)

    if period_type == "daily":
        period_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
        period_end = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period_type == "weekly":
        start_of_this_week = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        period_start = start_of_this_week - timedelta(days=7)
        period_end = start_of_this_week
    elif period_type == "monthly":
        first_of_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        period_end = first_of_this_month
        if now.month == 1:
            period_start = first_of_this_month.replace(year=now.year - 1, month=12)
        else:
            period_start = first_of_this_month.replace(month=now.month - 1)
    else:
        logger.error("unknown_period_type", period_type=period_type)
        return {"error": f"نوع دوره ناشناخته: {period_type}"}

    # engine مستقل با NullPool در همین event-loop تازه (تسک Celery).
    # استفاده از async_session_factory ماژول که به loop دیگری bind شده باعث
    # RuntimeError / خرابی pool می‌شود؛ این engine در finally تمیز dispose می‌شود.
    _perf_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    _perf_factory = async_sessionmaker(
        _perf_engine, class_=AsyncSession, expire_on_commit=False
    )
    try:
      async with _perf_factory() as session:
        # دریافت سیگنال‌های بسته‌شده در بازه
        query = select(Signal).where(
            and_(
                Signal.status == "closed",
                Signal.closed_at >= period_start,
                Signal.closed_at < period_end,
                Signal.pnl_pips.isnot(None),
            )
        )
        result = await session.execute(query)
        closed_signals = result.scalars().all()

        if not closed_signals:
            logger.info(
                "no_closed_signals_in_period",
                period_type=period_type,
                start=period_start.isoformat(),
                end=period_end.isoformat(),
            )
            return {"period_type": period_type, "total_signals": 0}

        # محاسبه آمار
        total = len(closed_signals)
        wins = [s for s in closed_signals if float(s.pnl_pips or 0) > 0]
        losses = [s for s in closed_signals if float(s.pnl_pips or 0) <= 0]
        win_count = len(wins)
        loss_count = len(losses)

        all_pips = [float(s.pnl_pips) for s in closed_signals if s.pnl_pips is not None]
        total_pips = sum(all_pips)
        avg_pips = total_pips / total if total > 0 else 0

        win_pips = [float(s.pnl_pips) for s in wins if s.pnl_pips is not None]
        loss_pips = [abs(float(s.pnl_pips)) for s in losses if s.pnl_pips is not None]

        max_win = max(win_pips) if win_pips else 0
        max_loss = max(loss_pips) if loss_pips else 0

        win_rate = (win_count / total * 100) if total > 0 else 0
        gross_profit = sum(win_pips) if win_pips else 0
        gross_loss = sum(loss_pips) if loss_pips else 0
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else 999.99

        durations = [
            s.duration_minutes for s in closed_signals if s.duration_minutes is not None
        ]
        avg_duration = int(sum(durations) / len(durations)) if durations else 0

        # ذخیره در دیتابیس — عملکرد کلی
        perf = SignalPerformance(
            period_type=period_type,
            period_start=period_start.date(),
            period_end=period_end.date(),
            symbol=None,
            total_signals=total,
            win_count=win_count,
            loss_count=loss_count,
            win_rate=round(win_rate, 2),
            total_pips=round(total_pips, 2),
            avg_pips=round(avg_pips, 2),
            max_win_pips=round(max_win, 2),
            max_loss_pips=round(max_loss, 2),
            profit_factor=round(min(profit_factor, 999.99), 2),
            avg_duration_minutes=avg_duration,
        )
        session.add(perf)

        # عملکرد به تفکیک نماد
        symbols_in_period = set(s.symbol for s in closed_signals)
        for sym in symbols_in_period:
            sym_signals = [s for s in closed_signals if s.symbol == sym]
            sym_total = len(sym_signals)
            sym_wins = [s for s in sym_signals if float(s.pnl_pips or 0) > 0]
            sym_losses = [s for s in sym_signals if float(s.pnl_pips or 0) <= 0]

            sym_pips = [float(s.pnl_pips) for s in sym_signals if s.pnl_pips is not None]
            sym_total_pips = sum(sym_pips)
            sym_avg_pips = sym_total_pips / sym_total if sym_total > 0 else 0

            sym_win_pips = [float(s.pnl_pips) for s in sym_wins if s.pnl_pips is not None]
            sym_loss_pips = [abs(float(s.pnl_pips)) for s in sym_losses if s.pnl_pips is not None]

            sym_win_rate = (len(sym_wins) / sym_total * 100) if sym_total > 0 else 0
            sym_gross_profit = sum(sym_win_pips) if sym_win_pips else 0
            sym_gross_loss = sum(sym_loss_pips) if sym_loss_pips else 0
            sym_profit_factor = (
                sym_gross_profit / sym_gross_loss if sym_gross_loss > 0 else 999.99
            )

            sym_durations = [
                s.duration_minutes for s in sym_signals if s.duration_minutes is not None
            ]
            sym_avg_duration = (
                int(sum(sym_durations) / len(sym_durations)) if sym_durations else 0
            )

            sym_perf = SignalPerformance(
                period_type=period_type,
                period_start=period_start.date(),
                period_end=period_end.date(),
                symbol=sym,
                total_signals=sym_total,
                win_count=len(sym_wins),
                loss_count=len(sym_losses),
                win_rate=round(sym_win_rate, 2),
                total_pips=round(sym_total_pips, 2),
                avg_pips=round(sym_avg_pips, 2),
                max_win_pips=round(max(sym_win_pips) if sym_win_pips else 0, 2),
                max_loss_pips=round(max(sym_loss_pips) if sym_loss_pips else 0, 2),
                profit_factor=round(min(sym_profit_factor, 999.99), 2),
                avg_duration_minutes=sym_avg_duration,
            )
            session.add(sym_perf)

        await session.commit()

        # بروزرسانی متریک
        win_rate_gauge.labels(period=period_type).set(win_rate)

        # ذخیره در Redis برای دسترسی سریع
        summary = {
            "period_type": period_type,
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
            "total_signals": total,
            "win_count": win_count,
            "loss_count": loss_count,
            "win_rate": round(win_rate, 2),
            "total_pips": round(total_pips, 2),
            "avg_pips": round(avg_pips, 2),
            "max_win_pips": round(max_win, 2),
            "max_loss_pips": round(max_loss, 2),
            "profit_factor": round(min(profit_factor, 999.99), 2),
            "avg_duration_minutes": avg_duration,
        }
        await redis_client.set_json(
            f"performance:{period_type}",
            summary,
            expire=86400 * 7,
        )

        logger.info(
            "performance_calculated",
            period=period_type,
            total=total,
            win_rate=round(win_rate, 2),
            total_pips=round(total_pips, 2),
            profit_factor=round(min(profit_factor, 999.99), 2),
        )

        return summary
    finally:
        await _perf_engine.dispose()


@celery_app.task(name="src.signals.tracker.close_positions_weekend")
def close_positions_weekend() -> Dict[str, Any]:
    """بستنِ خودکارِ همهٔ پوزیشن‌ها در آخرین ساعتِ بازارِ جمعه.

    جلوگیری از ریسکِ گپِ آخرهفته: همهٔ پوزیشن‌های باز به قیمتِ بازار بسته و به کانال
    اطلاع داده می‌شوند. با تنظیمِ WEEKEND_AUTO_CLOSE_ENABLED قابلِ خاموش‌کردن است.
    (فیلترِ آخرهفته از جمعه ۲۰:۰۰ UTC سیگنالِ جدید را می‌بندد، پس بعد از این بستن
    پوزیشنِ جدیدی باز نمی‌شود.)
    """
    if not getattr(settings, "WEEKEND_AUTO_CLOSE_ENABLED", True):
        logger.info("weekend_close_disabled")
        return {"skipped": True, "reason": "disabled"}

    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        # poolِ engineِ سراسری را در همین loop تازه می‌کنیم تا «TCPTransport closed»
        # (باگِ celery+asyncio که blog_to_video را خراب کرد) بستنِ پوزیشن را خراب نکند.
        from src.core.database import engine
        loop.run_until_complete(engine.dispose(close=False))
        tracker = SignalTracker()
        res = loop.run_until_complete(
            tracker.close_all_active(reason="WEEKEND_CLOSE", hit_target="WEEKEND")
        )
        # close-allِ صریحِ EA (مَستر + کاربرانِ کپی) تا پوزیشن‌های واقعیِ MT5 «همان لحظه»
        # بسته شوند — نه صرفاً از طریقِ close_on_signal_gone (که یک‌پل تأخیر دارد).
        loop.run_until_complete(_trigger_ea_close_all())
        return res
    finally:
        loop.close()


async def _trigger_ea_close_all() -> None:
    """idِ «بستنِ همه» را برای مَستر (ea:settings) و همهٔ کاربرانِ کپی افزایش می‌دهد تا
    EA در پولِ بعدی همهٔ پوزیشن‌ها را به‌صورتِ قطعی ببندد."""
    import json as _json
    try:
        await redis_client.connect()
        raw = await redis_client.client.get("ea:settings")
        s = _json.loads(raw) if raw else {}
        s["close_all_id"] = int(s.get("close_all_id", 0) or 0) + 1
        await redis_client.client.set("ea:settings", _json.dumps(s))
        # افزایشِ revِ مَستر تا کانتینر/ایجنت تغییر را ببیند
        await redis_client.client.incr("ea:master:rev")
        from sqlalchemy import select
        from src.core.database import TradingAccount, async_session_factory
        async with async_session_factory() as db:
            accts = (await db.execute(select(TradingAccount))).scalars().all()
        for a in accts:
            k = f"ea:user:{a.user_id}:close_all_id"
            cur = int(await redis_client.client.get(k) or 0)
            await redis_client.client.set(k, str(cur + 1))
        logger.info("weekend_ea_close_all_triggered", copy_users=len(accts))
    except Exception as exc:  # noqa: BLE001
        logger.error("weekend_ea_close_all_failed", error=str(exc))
