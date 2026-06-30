"""عملیات دیتابیسی کاربر — get/create، تکمیل onboarding، کد رفرال."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.bot.services import referral
from src.core.database import OnboardingSession, User, async_session_factory
from src.core.logger import get_logger

logger = get_logger("bot.services.users")


async def get_user(telegram_id: int) -> User | None:
    async with async_session_factory() as s:
        res = await s.execute(select(User).where(User.telegram_id == telegram_id))
        return res.scalar_one_or_none()


async def get_or_create_user(
    telegram_id: int,
    username: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> User:
    """کاربر را برمی‌گرداند یا با وضعیت اولیه می‌سازد."""
    async with async_session_factory() as s:
        res = await s.execute(select(User).where(User.telegram_id == telegram_id))
        user = res.scalar_one_or_none()
        if user is None:
            user = User(
                telegram_id=telegram_id,
                username=username,
                first_name=first_name,
                last_name=last_name,
                status="new",
            )
            s.add(user)
            try:
                await s.commit()
                await s.refresh(user)
                logger.info("user_created", telegram_id=telegram_id)
            except IntegrityError:
                # رقابت هم‌زمان: کاربر دیگری همین telegram_id را درج کرده — دوباره بخوان
                await s.rollback()
                user = (
                    await s.execute(select(User).where(User.telegram_id == telegram_id))
                ).scalar_one()
            return user
        else:
            # به‌روزرسانی متادیتای سبک
            changed = False
            if username and user.username != username:
                user.username = username
                changed = True
            user.last_active = datetime.now(timezone.utc)
            if changed:
                await s.commit()
            else:
                await s.commit()
        return user


async def _unique_referral_code(s: AsyncSession) -> str:
    for _ in range(10):
        code = referral.generate()
        exists = (
            await s.execute(select(User.id).where(User.referral_code == code))
        ).scalar_one_or_none()
        if exists is None:
            return code
    # احتمال بسیار کم — افزایش طول
    return referral.generate(10)


async def ensure_referral_code(telegram_id: int) -> str | None:
    """تضمین وجود کد رفرال یکتا برای کاربر و بازگرداندن آن."""
    async with async_session_factory() as s:
        user = (
            await s.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalar_one_or_none()
        if user is None:
            return None
        if not user.referral_code:
            user.referral_code = await _unique_referral_code(s)
            await s.commit()
        return user.referral_code


async def resolve_referrer(code: str) -> int | None:
    """telegram_id معرف را از روی کد رفرال پیدا می‌کند."""
    norm = referral.normalize(code)
    if not referral.is_valid(norm):
        return None
    async with async_session_factory() as s:
        tid = (
            await s.execute(select(User.telegram_id).where(User.referral_code == norm))
        ).scalar_one_or_none()
        return tid


async def set_referred_by(telegram_id: int, referrer_telegram_id: int) -> None:
    """ثبت معرف برای یک کاربر (فقط اگر قبلاً ثبت نشده و خودش نباشد)."""
    if telegram_id == referrer_telegram_id:
        return
    async with async_session_factory() as s:
        user = (
            await s.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalar_one_or_none()
        if user and user.referred_by is None:
            user.referred_by = referrer_telegram_id
            await s.commit()


async def count_referrals(telegram_id: int) -> int:
    """تعداد دعوت‌های موفق = کاربرانی که با کد این فرد آمده‌اند و ثبت‌نام را کامل کرده‌اند."""
    async with async_session_factory() as s:
        from sqlalchemy import func
        res = await s.execute(
            select(func.count(User.id)).where(
                User.referred_by == telegram_id,
                User.registration_date.isnot(None),
            )
        )
        return int(res.scalar() or 0)


async def complete_onboarding(
    telegram_id: int,
    full_name: str,
    phone: str,
    quiz_score: int,
    skill_level: str,
    skill_score_pct: int,
    quiz_answers: dict | None = None,
) -> User:
    """ذخیره‌ی نتایج onboarding روی User و بستن OnboardingSession."""
    async with async_session_factory() as s:
        user = (
            await s.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalar_one_or_none()
        # idempotency: اگر قبلاً ثبت‌نام کامل شده، دوباره مقداردهی نکن
        if user is not None and user.registration_date is not None:
            return user
        if user is None:
            user = User(telegram_id=telegram_id, status="new")
            s.add(user)

        parts = full_name.strip().split(maxsplit=1)
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else None
        user.phone_number = phone
        user.skill_level = skill_level
        user.skill_score = skill_score_pct
        user.status = "trial"
        user.registration_date = datetime.now(timezone.utc)
        if not user.referral_code:
            user.referral_code = await _unique_referral_code(s)

        # بستن سشن onboarding
        sess = (
            await s.execute(
                select(OnboardingSession)
                .where(OnboardingSession.telegram_id == telegram_id)
                .order_by(OnboardingSession.id.desc())
            )
        ).scalars().first()
        if sess is None:
            sess = OnboardingSession(telegram_id=telegram_id)
            s.add(sess)
        sess.step = "completed"
        sess.temp_name = full_name
        sess.temp_phone = phone
        sess.quiz_answers = quiz_answers
        sess.quiz_score = quiz_score
        sess.completed_at = datetime.now(timezone.utc)

        await s.commit()
        await s.refresh(user)
        return user


async def toggle_notify(telegram_id: int) -> bool:
    async with async_session_factory() as s:
        user = (
            await s.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalar_one_or_none()
        if user is None:
            return True
        user.notify_enabled = not bool(user.notify_enabled)
        await s.commit()
        return user.notify_enabled


async def toggle_language(telegram_id: int) -> str:
    async with async_session_factory() as s:
        user = (
            await s.execute(select(User).where(User.telegram_id == telegram_id))
        ).scalar_one_or_none()
        if user is None:
            return "fa"
        user.language = "en" if (user.language or "fa") == "fa" else "fa"
        await s.commit()
        return user.language
