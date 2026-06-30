"""منطق دسترسی — ساخت trial، اشتراک فعال، و ثبت درخواست پرداخت."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from aiogram import Bot
from sqlalchemy import select

from src.bot.services import channel, subscription as sub_svc
from src.core.config import settings
from src.core.database import (
    ChannelMember,
    PaymentRequest,
    Subscription,
    User,
    async_session_factory,
)
from src.core.logger import get_logger

logger = get_logger("bot.services.access")


async def get_active_subscription(telegram_id: int) -> Subscription | None:
    """جدیدترین اشتراک فعالِ منقضی‌نشده را برمی‌گرداند."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as s:
        res = await s.execute(
            select(Subscription)
            .where(
                Subscription.telegram_id == telegram_id,
                Subscription.status == "active",
                Subscription.expires_at > now,
            )
            .order_by(Subscription.expires_at.desc())
        )
        return res.scalars().first()


async def has_pending_payment(telegram_id: int) -> bool:
    async with async_session_factory() as s:
        res = await s.execute(
            select(PaymentRequest.id).where(
                PaymentRequest.telegram_id == telegram_id,
                PaymentRequest.status == "pending",
            )
        )
        return res.scalars().first() is not None


def _canon_tx(tx_hash: str | None) -> str:
    """فرم canonical هش تراکنش برای dedup (هش‌های هگز/EVM حساس به حروف نیستند)."""
    return (tx_hash or "").strip().lower()


async def tx_hash_used(tx_hash: str) -> bool:
    """آیا این هش تراکنش قبلاً (توسط هر کاربری) ثبت شده؟ — جلوگیری از replay/سوءاستفاده."""
    norm = _canon_tx(tx_hash)
    if not norm:
        return False
    async with async_session_factory() as s:
        res = await s.execute(
            select(PaymentRequest.id).where(PaymentRequest.tx_hash == norm)
        )
        return res.scalars().first() is not None


async def create_trial(bot: Bot, user: User) -> tuple[Subscription, str | None]:
    """ساخت اشتراک trial + رکورد عضویت کانال + لینک دعوت + زمان‌بندی انقضا.

    لینک دعوت را برمی‌گرداند (ممکن است None باشد اگر ربات ادمین نباشد).
    """
    expires_at = sub_svc.trial_expiry()
    async with async_session_factory() as s:
        sub = Subscription(
            user_id=user.id,
            telegram_id=user.telegram_id,
            plan="trial",
            status="active",
            amount_usdt=0,
            expires_at=expires_at,
        )
        s.add(sub)
        cm = ChannelMember(
            user_id=user.id,
            telegram_id=user.telegram_id,
            channel_id=settings.TELEGRAM_CHANNEL_ID,
            status="invited",
            is_active=True,
        )
        s.add(cm)
        await s.commit()
        await s.refresh(sub)
        await s.refresh(cm)

    # ساخت لینک دعوت (شبکه — خارج از تراکنش)
    link = await channel.create_invite(bot, ttl_hours=24, name=f"trial:{user.telegram_id}")
    if link:
        async with async_session_factory() as s:
            obj = await s.get(ChannelMember, cm.id)
            if obj:
                obj.invite_link = link
                await s.commit()

    # زمان‌بندی انقضای دقیق با Celery (import محلی برای جلوگیری از circular import)
    try:
        from src.bot.tasks import expire_trial
        expire_trial.apply_async(args=[sub.id], eta=expires_at)
    except Exception as exc:  # noqa: BLE001 — sweep به‌عنوان شبکه‌ی ایمنی عمل می‌کند
        logger.warning("trial_schedule_failed", error=str(exc), subscription_id=sub.id)

    logger.info("trial_created", telegram_id=user.telegram_id, expires_at=expires_at.isoformat())
    return sub, link


async def maybe_grant_referral_reward(referrer_telegram_id: int) -> dict | None:
    """اگر معرف به آستانهٔ دعوتِ موفق رسیده و قبلاً پاداش نگرفته، N روز اشتراکِ رایگان بده.

    دعوتِ موفق = کاربری که با کد او آمده و ثبت‌نام را کامل کرده (registration_date).
    یک‌بار اعطا می‌شود (dedup با وجودِ اشتراکِ plan='referral_3m'). None اگر شرایط برقرار نبود.
    """
    from sqlalchemy import func

    threshold = settings.REFERRAL_REWARD_THRESHOLD
    days = settings.REFERRAL_REWARD_DAYS
    now = datetime.now(timezone.utc)
    async with async_session_factory() as s:
        count = (
            await s.execute(
                select(func.count(User.id)).where(
                    User.referred_by == referrer_telegram_id,
                    User.registration_date.isnot(None),
                )
            )
        ).scalar() or 0
        if count < threshold:
            return None

        referrer = (
            await s.execute(select(User).where(User.telegram_id == referrer_telegram_id))
        ).scalar_one_or_none()
        if referrer is None:
            return None

        # dedup: یک‌بار پاداش
        already = (
            await s.execute(
                select(Subscription.id).where(
                    Subscription.telegram_id == referrer_telegram_id,
                    Subscription.plan == "referral_3m",
                )
            )
        ).scalars().first()
        if already:
            return None

        active = (
            await s.execute(
                select(Subscription)
                .where(
                    Subscription.telegram_id == referrer_telegram_id,
                    Subscription.status == "active",
                    Subscription.expires_at > now,
                )
                .order_by(Subscription.expires_at.desc())
            )
        ).scalars().first()
        base = active.expires_at if (active and active.expires_at > now) else now
        expires_at = base + timedelta(days=days)

        s.add(
            Subscription(
                user_id=referrer.id,
                telegram_id=referrer_telegram_id,
                plan="referral_3m",
                status="active",
                amount_usdt=0,
                expires_at=expires_at,
            )
        )
        referrer.status = "active"
        # پلن را فقط در صورتی به referral_3m تغییر بده که پلنِ بهتری نداشته باشد
        if (referrer.plan or "") in ("", "new", "trial"):
            referrer.plan = "referral_3m"
        await s.commit()

    logger.info(
        "referral_reward_granted", referrer=referrer_telegram_id, count=count, days=days
    )
    return {"telegram_id": referrer_telegram_id, "days": days, "count": count}


async def grant_free_vip(telegram_id: int, admin_id: int | None = None) -> dict | None:
    """اعطای اشتراکِ رایگانِ همیشگیِ VIP (پس از تأییدِ دستیِ واریز در پنلِ بروکر).

    اشتراک با پلن «free_lifetime» و انقضای بسیار دور ساخته/به‌روزرسانی می‌شود و رکوردِ
    عضویتِ کانال upsert می‌شود. None اگر کاربر در دیتابیس نباشد (باید /start زده باشد).
    ارسالِ لینکِ دعوت از طریقِ event_consumer (رویدادِ subscription_approved) انجام می‌شود.
    """
    now = datetime.now(timezone.utc)
    far = now + timedelta(days=36500)  # ~۱۰۰ سال = عملاً همیشگی
    async with async_session_factory() as s:
        user = (
            await s.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalar_one_or_none()
        if user is None:
            return None

        existing = (
            await s.execute(
                select(Subscription)
                .where(
                    Subscription.telegram_id == telegram_id,
                    Subscription.status == "active",
                    Subscription.expires_at > now,
                )
                .order_by(Subscription.expires_at.desc())
            )
        ).scalars().first()
        if existing is not None:
            existing.plan = "free_lifetime"
            existing.expires_at = far
            existing.amount_usdt = 0
            existing.expiry_processed = False
            existing.reminder_3d_sent = False
            existing.reminder_1d_sent = False
        else:
            s.add(
                Subscription(
                    user_id=user.id,
                    telegram_id=telegram_id,
                    plan="free_lifetime",
                    status="active",
                    amount_usdt=0,
                    expires_at=far,
                )
            )
        user.status = "active"
        user.plan = "free_lifetime"

        cm = (
            await s.execute(
                select(ChannelMember)
                .where(ChannelMember.telegram_id == telegram_id)
                .order_by(ChannelMember.id.desc())
            )
        ).scalars().first()
        if cm is None:
            s.add(
                ChannelMember(
                    user_id=user.id,
                    telegram_id=telegram_id,
                    channel_id=settings.TELEGRAM_CHANNEL_ID,
                    status="invited",
                    is_active=True,
                )
            )
        else:
            cm.is_active = True
            cm.status = "invited"
        await s.commit()

    logger.info("free_vip_granted", telegram_id=telegram_id, admin_id=admin_id)
    return {"telegram_id": telegram_id, "plan_label": sub_svc.plan_label("free_lifetime")}


async def grant_free_signal_days(
    telegram_id: int, days: int, admin_id: int | None = None
) -> dict | None:
    """اعطای دسترسیِ رایگانِ کانالِ سیگنال برای N روز (هدیهٔ مدیریت).

    یک اشتراکِ موقت با انقضای now+days می‌سازد/تمدید می‌کند و عضویتِ کانال را upsert
    می‌کند. تسکِ sweep_subscriptions پس از N روز کاربر را خودکار از کانال حذف می‌کند.
    ارسالِ لینکِ دعوت از طریقِ رویدادِ subscription_approved انجام می‌شود.
    None اگر کاربر در دیتابیس نباشد.
    """
    days = max(1, min(int(days), 3650))
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=days)
    async with async_session_factory() as s:
        user = (
            await s.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalar_one_or_none()
        if user is None:
            return None

        existing = (
            await s.execute(
                select(Subscription)
                .where(
                    Subscription.telegram_id == telegram_id,
                    Subscription.status == "active",
                    Subscription.expires_at > now,
                )
                .order_by(Subscription.expires_at.desc())
            )
        ).scalars().first()
        # اگر اشتراکِ فعالِ بهتری دارد، فقط در صورتی تمدید کن که هدیه دیرتر تمام شود
        if existing is not None:
            if expires_at > existing.expires_at:
                existing.expires_at = expires_at
            existing.expiry_processed = False
            existing.reminder_3d_sent = False
            existing.reminder_1d_sent = False
        else:
            s.add(
                Subscription(
                    user_id=user.id,
                    telegram_id=telegram_id,
                    plan="gift_trial",
                    status="active",
                    amount_usdt=0,
                    expires_at=expires_at,
                )
            )
        user.status = "active"
        if (user.plan or "") in ("", "new", "free", "trial"):
            user.plan = "gift_trial"

        cm = (
            await s.execute(
                select(ChannelMember)
                .where(ChannelMember.telegram_id == telegram_id)
                .order_by(ChannelMember.id.desc())
            )
        ).scalars().first()
        if cm is None:
            s.add(
                ChannelMember(
                    user_id=user.id,
                    telegram_id=telegram_id,
                    channel_id=settings.TELEGRAM_CHANNEL_ID,
                    status="invited",
                    is_active=True,
                )
            )
        else:
            cm.is_active = True
            cm.status = "invited"
        await s.commit()

    logger.info("free_signal_days_granted", telegram_id=telegram_id, days=days, admin_id=admin_id)
    return {"telegram_id": telegram_id, "days": days,
            "expires_at": expires_at.isoformat(),
            "plan_label": f"{days} روزه (هدیهٔ کانالِ سیگنال)"}


async def approve_payment(payment_id: int, admin_id: int | None = None) -> dict | None:
    """تأیید یک درخواست پرداخت pending: ساخت/تمدید اشتراک، به‌روزرسانی کاربر و عضویت.

    برمی‌گرداند dict با اطلاعات لازم برای enqueue رویداد (یا None اگر معتبر نباشد).
    تمدید از روی expiry فعلی انجام می‌شود تا روزهای باقی‌مانده حفظ شود.
    """
    now = datetime.now(timezone.utc)
    async with async_session_factory() as s:
        # قفل ردیف تا دو ادمین/کلیک هم‌زمان یک پرداخت را دوبار تأیید نکنند
        pr = (
            await s.execute(
                select(PaymentRequest)
                .where(PaymentRequest.id == payment_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if pr is None or pr.status != "pending":
            return None
        pr.status = "approved"
        pr.admin_id = admin_id
        pr.reviewed_at = now

        user = (
            await s.execute(select(User).where(User.id == pr.user_id))
        ).scalar_one_or_none()

        existing = (
            await s.execute(
                select(Subscription)
                .where(
                    Subscription.telegram_id == pr.telegram_id,
                    Subscription.status == "active",
                    Subscription.expires_at > now,
                )
                .order_by(Subscription.expires_at.desc())
            )
        ).scalars().first()
        current_expiry = existing.expires_at if existing else None
        expires_at = sub_svc.compute_expiry(pr.plan, current_expiry, now)

        if existing is not None:
            existing.plan = pr.plan
            existing.expires_at = expires_at
            existing.amount_usdt = pr.amount_usdt
            existing.payment_request_id = pr.id
            existing.expiry_processed = False
            existing.reminder_3d_sent = False
            existing.reminder_1d_sent = False
            sub = existing
        else:
            sub = Subscription(
                user_id=pr.user_id,
                telegram_id=pr.telegram_id,
                plan=pr.plan,
                status="active",
                amount_usdt=pr.amount_usdt,
                expires_at=expires_at,
                payment_request_id=pr.id,
            )
            s.add(sub)

        if user is not None:
            user.status = "active"
            user.plan = pr.plan

        # upsert عضویت کانال
        cm = (
            await s.execute(
                select(ChannelMember).where(
                    ChannelMember.telegram_id == pr.telegram_id,
                    ChannelMember.is_active.is_(True),
                )
            )
        ).scalars().first()
        if cm is None:
            s.add(
                ChannelMember(
                    user_id=pr.user_id,
                    telegram_id=pr.telegram_id,
                    channel_id=settings.TELEGRAM_CHANNEL_ID,
                    status="invited",
                    is_active=True,
                )
            )

        await s.commit()
        await s.refresh(sub)
        return {
            "telegram_id": pr.telegram_id,
            "plan": pr.plan,
            "plan_label": sub_svc.plan_label(pr.plan),
            "subscription_id": sub.id,
            "expires_at": expires_at.isoformat(),
        }


async def reject_payment(payment_id: int, admin_id: int | None = None, note: str | None = None) -> dict | None:
    """رد یک درخواست پرداخت pending."""
    now = datetime.now(timezone.utc)
    async with async_session_factory() as s:
        pr = (
            await s.execute(select(PaymentRequest).where(PaymentRequest.id == payment_id))
        ).scalar_one_or_none()
        if pr is None or pr.status != "pending":
            return None
        pr.status = "rejected"
        pr.admin_id = admin_id
        pr.admin_note = note
        pr.reviewed_at = now
        await s.commit()
        return {"telegram_id": pr.telegram_id, "admin_note": note}


async def create_payment_request(
    user: User, plan: str, network: str | None, tx_hash: str
) -> PaymentRequest | None:
    """ثبت یک درخواست پرداخت pending. در صورت تکراری‌بودن tx_hash (UNIQUE) None."""
    from sqlalchemy.exc import IntegrityError
    async with async_session_factory() as s:
        pr = PaymentRequest(
            user_id=user.id,
            telegram_id=user.telegram_id,
            plan=plan,
            amount_usdt=sub_svc.plan_price(plan),
            network=network,
            tx_hash=_canon_tx(tx_hash),
            status="pending",
        )
        s.add(pr)
        try:
            await s.commit()
        except IntegrityError:
            await s.rollback()
            logger.info("payment_tx_duplicate", telegram_id=user.telegram_id)
            return None
        await s.refresh(pr)
        return pr
