"""تسک‌های Celery ربات — انقضای trial/اشتراک، حذف از کانال و یادآوری تمدید.

الگوی async-در-celery مطابق src/signals/tracker.py: حلقه‌ی رویداد دستی.
هر تسک یک Bot کوتاه‌عمر می‌سازد (worker سلری Bot زنده ندارد) و آن را می‌بندد.

idempotency:
  - Subscription.expiry_processed به‌صورت check-and-set
  - ChannelMember.is_active دوباره لود می‌شود پیش از حذف
  - channel.remove_member ذاتاً idempotent است
  - فلگ‌های reminder_3d_sent/reminder_1d_sent مانع پیام تکراری
"""

from __future__ import annotations

import asyncio
import contextvars
from datetime import datetime, timedelta, timezone

from aiogram import Bot
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.bot.services import channel
from src.core.celery_app import celery_app
from src.core.config import settings
from src.core.database import ChannelMember, CopySettings, Subscription, TradingAccount, User
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("bot.tasks")

# هر تسک Celery در یک event-loop تازهٔ خودش اجرا می‌شود. استفاده‌ی مجدد از engine
# سراسری (که کانکشن‌هایش به loop دیگری بسته‌اند) RuntimeError می‌دهد. به‌جای آن،
# هر تسک یک engine مستقل با NullPool می‌سازد و در همان loop تمیز dispose می‌کند.
_task_factory: contextvars.ContextVar = contextvars.ContextVar("task_session_factory")


def task_session() -> AsyncSession:
    """سشن دیتابیسِ مخصوص تسک جاری (engine مستقلِ همین event-loop)."""
    return _task_factory.get()()


async def _guarded(coro):
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    token = _task_factory.set(factory)
    try:
        return await coro
    finally:
        _task_factory.reset(token)
        await engine.dispose()


def _run(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(_guarded(coro))
    finally:
        loop.close()


def _new_bot() -> Bot:
    return Bot(
        token=settings.TELEGRAM_BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )


async def _first_name(telegram_id: int) -> str:
    async with task_session() as s:
        name = (
            await s.execute(select(User.first_name).where(User.telegram_id == telegram_id))
        ).scalar_one_or_none()
    # نام تلگرام کاربرساخته است و ممکن است < > & داشته باشد → escape برای parse_mode=HTML
    import html
    return html.escape(name) if name else "دوست عزیز"


def _trial_end_message(name: str) -> str:
    return (
        f"سلام {name} عزیز 👋\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "⏳ <b>دورهٔ آزمایشی ۴۸ ساعتهٔ شما به پایان رسید</b>\n\n"
        "دسترسی شما به کانال VIP و سیگنال‌های حرفه‌ای به‌صورت خودکار غیرفعال شد 🔒\n\n"
        "امیدواریم در این مدت از کیفیت تحلیل‌ها و دقت سیگنال‌های "
        "<b>CoinePro FX</b> راضی بوده باشید 💎\n\n"
        "🎁 <b>با تهیهٔ اشتراک VIP به این امکانات دسترسی دائمی دارید:</b>\n"
        "📈 سیگنال‌های لحظه‌ای با نقطهٔ ورود، حد ضرر و سه حد سود\n"
        "🛡 مدیریت ریسک حرفه‌ای و تریلینگ استاپ\n"
        "🧠 تحلیل هوش مصنوعی و سطوح کلیدی بازار\n"
        "📊 گزارش عملکرد و پشتیبانی اختصاصی\n\n"
        "برای فعال‌سازی مجدد و بازگشت به کانال، همین حالا اشتراک خود را تهیه کنید 👇"
    )


def _paid_end_message(name: str) -> str:
    return (
        f"سلام {name} عزیز 👋\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "🔔 <b>اشتراک VIP شما به پایان رسید</b>\n\n"
        "دسترسی شما به کانال سیگنال‌ها موقتاً قطع شد 🔒\n\n"
        "برای جلوگیری از دست‌دادن سیگنال‌های پیشِ‌رو و ادامهٔ مسیر سوددهی، "
        "اشتراک خود را تمدید کنید. به‌محض تأیید پرداخت، دسترسی شما "
        "بلافاصله و با مجوز مدیریت دوباره فعال می‌شود ✅\n\n"
        "از همراهی شما با <b>CoinePro FX</b> سپاسگزاریم 💎👇"
    )


# ── انقضای یک اشتراک (idempotent) ──
@celery_app.task(name="src.bot.tasks.expire_trial")
def expire_trial(subscription_id: int) -> dict:
    return _run(_expire_subscription(subscription_id))


async def _expire_subscription(subscription_id: int) -> dict:
    now = datetime.now(timezone.utc)
    cm_id = None
    plan = None
    telegram_id = None

    async with task_session() as s:
        sub = (
            await s.execute(
                select(Subscription)
                .where(Subscription.id == subscription_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if sub is None or sub.expiry_processed or sub.status != "active":
            return {"skipped": True, "reason": "processed_or_inactive"}
        # اگر تمدید شده و هنوز منقضی نشده → skip (eta زودتر فایر شده)
        if sub.expires_at > now:
            return {"skipped": True, "reason": "renewed"}

        sub.status = "expired"
        sub.expiry_processed = True
        plan = sub.plan
        telegram_id = sub.telegram_id

        cm = (
            await s.execute(
                select(ChannelMember).where(
                    ChannelMember.telegram_id == sub.telegram_id,
                    ChannelMember.is_active.is_(True),
                )
            )
        ).scalars().first()
        cm_id = cm.id if cm else None
        await s.commit()

    bot = _new_bot()
    try:
        if cm_id is not None:
            removed = await channel.remove_member(bot, telegram_id)
            if removed:
                async with task_session() as s2:
                    cm2 = await s2.get(ChannelMember, cm_id)
                    if cm2 and cm2.is_active:
                        cm2.is_active = False
                        cm2.status = "removed"
                        cm2.removed_at = datetime.now(timezone.utc)
                        await s2.commit()

        name = await _first_name(telegram_id)
        msg = _trial_end_message(name) if plan == "trial" else _paid_end_message(name)
        from src.bot.services.messaging import send as send_msg
        from src.bot.keyboards import buy_subscription_keyboard
        await send_msg(bot, telegram_id, msg, handler="expire", reply_markup=buy_subscription_keyboard())
    finally:
        await bot.session.close()

    logger.info("subscription_expired", subscription_id=subscription_id, plan=plan)
    return {"expired": subscription_id}


# ── پیام بسته‌شدن بازار (جمعه‌شب) ──
@celery_app.task(name="src.bot.tasks.post_market_closed")
def post_market_closed() -> dict:
    return asyncio.run(_post_market_closed())


async def _post_market_closed() -> dict:
    if not settings.PUBLISH_SIGNALS_TO_CHANNEL:
        return {"skipped": "publish_disabled"}
    from src.bot.texts import MARKET_CLOSED
    bot = _new_bot()
    try:
        await bot.send_message(settings.TELEGRAM_CHANNEL_ID, MARKET_CLOSED)
        logger.info("market_closed_message_posted")
    except Exception as exc:  # noqa: BLE001
        logger.error("market_closed_post_failed", error=str(exc))
        return {"posted": False, "error": str(exc)}
    finally:
        await bot.session.close()
    return {"posted": True}


# ── گزارش هفتگی عملکرد (Claude) ──
@celery_app.task(name="src.bot.tasks.post_weekly_report")
def post_weekly_report() -> dict:
    async def _go() -> dict:
        from src.core.database import engine
        await engine.dispose()  # کانکشن‌های loop تازه (تسک هفتگی، کم‌فرکانس)
        from src.llm.reporter import build_weekly_report
        text = await build_weekly_report()
        if not text:
            return {"skipped": "no report"}
        if not settings.PUBLISH_SIGNALS_TO_CHANNEL:
            return {"skipped": "publish disabled", "len": len(text)}
        bot = _new_bot()
        try:
            await bot.send_message(
                settings.TELEGRAM_CHANNEL_ID,
                "📊 <b>گزارش هفتگی عملکرد — CoinePro FX</b>\n"
                "━━━━━━━━━━━━━━━━━━━━\n" + text,
            )
        finally:
            await bot.session.close()
        return {"posted": True}
    return asyncio.run(_go())


# ── ارزیابی ریسک خبری (Claude) ──
@celery_app.task(name="src.bot.tasks.assess_news")
def assess_news() -> dict:
    async def _go() -> dict:
        try:
            await redis_client.connect()
        except Exception:  # noqa: BLE001
            pass
        from src.llm.news_sentiment import assess_news_risk
        r = await assess_news_risk()
        return {"assessed": r is not None}
    return asyncio.run(_go())


# ── سویپ دوره‌ای: شبکه‌ی ایمنی انقضا + یادآوری تمدید ──
@celery_app.task(name="src.bot.tasks.sweep_subscriptions")
def sweep_subscriptions() -> dict:
    return _run(_sweep())


async def _sweep() -> dict:
    now = datetime.now(timezone.utc)
    expired_ids: list[int] = []
    remind_3d: list[int] = []
    remind_1d: list[int] = []

    async with task_session() as s:
        active = (
            await s.execute(select(Subscription).where(Subscription.status == "active"))
        ).scalars().all()
        for sub in active:
            if sub.expires_at <= now and not sub.expiry_processed:
                expired_ids.append(sub.id)
            elif sub.expires_at > now:
                remaining = sub.expires_at - now
                if remaining <= timedelta(days=1) and not sub.reminder_1d_sent:
                    sub.reminder_1d_sent = True
                    remind_1d.append(sub.telegram_id)
                elif remaining <= timedelta(days=3) and not sub.reminder_3d_sent:
                    sub.reminder_3d_sent = True
                    remind_3d.append(sub.telegram_id)
        await s.commit()

    # انقضاها (idempotent)
    for sub_id in expired_ids:
        await _expire_subscription(sub_id)

    # ── تورِ امنیتی: کیکِ orphanها (عضوِ فعالِ کانال بدونِ اشتراکِ فعال) ──
    # اگر کیکِ زمانِ انقضا به هر دلیلی ناموفق مانده باشد، اینجا پاک‌سازی می‌شود.
    orphan_kicked = 0
    async with task_session() as s:
        active_tids = set((await s.execute(
            select(Subscription.telegram_id).where(
                Subscription.status == "active", Subscription.expires_at > now
            )
        )).scalars().all())
        members = (await s.execute(
            select(ChannelMember).where(
                ChannelMember.is_active.is_(True),
                ChannelMember.status.in_(("active", "invited")),
            )
        )).scalars().all()
        orphans = [(m.id, m.telegram_id) for m in members if m.telegram_id not in active_tids]
    if orphans:
        bot = _new_bot()
        try:
            for cm_id, tid in orphans:
                try:
                    if await channel.remove_member(bot, tid):
                        async with task_session() as s2:
                            cm = await s2.get(ChannelMember, cm_id)
                            if cm and cm.is_active:
                                cm.is_active = False
                                cm.status = "removed"
                                cm.removed_at = datetime.now(timezone.utc)
                                await s2.commit()
                        orphan_kicked += 1
                except Exception as exc:
                    logger.warning("orphan_kick_failed", telegram_id=tid, error=str(exc))
        finally:
            await bot.session.close()
    if orphan_kicked:
        logger.info("orphans_kicked", count=orphan_kicked)

    # یادآوری‌ها
    if remind_3d or remind_1d:
        bot = _new_bot()
        try:
            from src.bot.services.messaging import send as send_msg
            from src.bot.keyboards import buy_subscription_keyboard
            for tid in remind_3d:
                name = await _first_name(tid)
                await send_msg(
                    bot, tid,
                    f"سلام {name}! ⏳ اشتراک شما تا ۳ روز دیگر منقضی می‌شود. "
                    "برای جلوگیری از قطع دسترسی، همین حالا تمدید کنید 👇",
                    handler="reminder_3d", reply_markup=buy_subscription_keyboard(),
                )
            for tid in remind_1d:
                name = await _first_name(tid)
                await send_msg(
                    bot, tid,
                    f"سلام {name}! ⚠️ تنها ۱ روز تا پایان اشتراک شما باقی مانده است. "
                    "برای ادامه‌ی دریافت سیگنال‌ها تمدید کنید 👇",
                    handler="reminder_1d", reply_markup=buy_subscription_keyboard(),
                )
        finally:
            await bot.session.close()

    return {
        "expired": len(expired_ids),
        "orphan_kicked": orphan_kicked,
        "reminded_3d": len(remind_3d),
        "reminded_1d": len(remind_1d),
    }


# ── رصدِ منابعِ پنل: هشدار + حذفِ حساب‌های بی‌فعالیت/موجودیِ صفر ──
def _panel_warn_message(name: str, hours: int) -> str:
    return (
        f"سلام {name} عزیز 👋\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "⚠️ <b>اعلانِ مهم دربارهٔ حسابِ کپی‌ترید شما</b>\n\n"
        "متوجه شدیم که حسابِ شما در روزهای اخیر <b>بدونِ فعالیتِ معاملاتی</b> بوده "
        "یا <b>موجودیِ آن صفر</b> است. برای استفادهٔ بهینه از منابعِ سرور، حسابی که "
        "فعال نیست به‌زودی از سامانه قطع می‌شود.\n\n"
        f"⏳ اگر می‌خواهید فعال بمانید، تا <b>{hours} ساعت</b> آینده حساب را شارژ یا "
        "کپی‌ترید را روشن کنید. در غیرِ این صورت اتصال قطع می‌شود و هر زمان خواستید "
        "می‌توانید دوباره از پنل وصل شوید. 🙏"
    )


def _panel_removed_message(name: str) -> str:
    return (
        f"سلام {name} عزیز 👋\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "🔌 <b>اتصالِ حسابِ کپی‌ترید شما قطع شد</b>\n\n"
        "به‌دلیلِ بی‌فعالیتیِ طولانی یا موجودیِ صفر، برای حفظِ منابعِ سرور حسابتان "
        "موقتاً از سامانه جدا شد. این پایانِ کار نیست — هر وقت آماده بودید، از پنل "
        "دوباره حساب را وصل کنید و کپی‌ترید را روشن کنید. 🌟"
    )


@celery_app.task(name="src.bot.tasks.panel_resource_sweep")
def panel_resource_sweep() -> dict:
    return _run(_panel_resource_sweep())


async def _panel_resource_sweep() -> dict:
    """Disabled while OneRoyal remains referral-only; performs no DB or bot I/O."""
    return {"warned": 0, "removed": 0, "disabled": True, "integration_level": "referral_only"}

    # Historical cleanup implementation retained below for migration archaeology.
    now = datetime.now(timezone.utc)
    warn_h = settings.PANEL_IDLE_WARN_HOURS
    remove_h = settings.PANEL_IDLE_REMOVE_HOURS
    to_warn: list[int] = []
    to_remove: list[tuple[int, int]] = []  # (account_id, telegram_id)

    async with task_session() as s:
        accts = (await s.execute(select(TradingAccount))).scalars().all()
        for a in accts:
            balance = float(a.balance or 0)
            last_activity = a.last_trade_at or a.connected_at or a.created_at
            idle = last_activity is None or (now - last_activity) > timedelta(hours=warn_h)
            # موجودیِ صفر فقط برای حسابِ جاافتاده (نه تازه‌وصل) هشدار می‌گیرد
            settled = a.created_at is None or (now - a.created_at) > timedelta(hours=1)
            zero = balance <= 1.0 and settled
            bad = idle or zero
            if not bad:
                if a.warned_at:
                    a.warned_at = None  # بهبود یافت → ریستِ هشدار
                continue
            if a.warned_at is None:
                a.warned_at = now
                to_warn.append(a.telegram_id)
            elif (now - a.warned_at) > timedelta(hours=remove_h):
                to_remove.append((a.id, a.telegram_id))
        await s.commit()

    # حذفِ اتصالِ موارد منقضی (حذفِ حساب + خاموشیِ کپی + لغوِ تأیید)
    for acc_id, tid in to_remove:
        async with task_session() as s2:
            a = await s2.get(TradingAccount, acc_id)
            if a:
                uid = a.user_id
                await s2.delete(a)
                cs = (await s2.execute(select(CopySettings).where(CopySettings.user_id == uid))).scalar_one_or_none()
                if cs:
                    cs.enabled = False
                u = await s2.get(User, uid)
                if u:
                    u.panel_approved = False
                await s2.commit()

    if to_warn or to_remove:
        bot = _new_bot()
        try:
            from src.bot.services.messaging import send as send_msg
            for tid in to_warn:
                name = await _first_name(tid)
                await send_msg(bot, tid, _panel_warn_message(name, remove_h), handler="panel_warn")
            for _, tid in to_remove:
                name = await _first_name(tid)
                await send_msg(bot, tid, _panel_removed_message(name), handler="panel_removed")
        finally:
            await bot.session.close()

    logger.info("panel_resource_sweep", warned=len(to_warn), removed=len(to_remove))
    return {"warned": len(to_warn), "removed": len(to_remove)}
