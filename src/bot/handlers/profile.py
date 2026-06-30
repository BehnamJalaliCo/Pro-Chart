"""هندلر پروفایل — نمایش اطلاعات کاربر، سطح و وضعیت اشتراک."""

from __future__ import annotations

from datetime import datetime, timezone

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from src.bot import texts
from src.bot.services import quiz, subscription as sub_svc, users
from src.bot.services.access import get_active_subscription

profile_router = Router(name="profile")


def _fmt_remaining(expires_at: datetime) -> str:
    now = datetime.now(timezone.utc)
    delta = expires_at - now
    if delta.total_seconds() <= 0:
        return "منقضی شده"
    days = delta.days
    hours = delta.seconds // 3600
    if days > 0:
        return f"{days} روز و {hours} ساعت"
    return f"{hours} ساعت"


@profile_router.message(F.text == texts.BTN_PROFILE)
async def show_profile(message: Message, state: FSMContext) -> None:
    await state.clear()
    user = await users.get_user(message.from_user.id)
    if user is None or user.registration_date is None:
        await message.answer(texts.NEED_ONBOARDING)
        return

    name = " ".join(p for p in [user.first_name, user.last_name] if p) or "—"
    level = quiz.skill_label(user.skill_level) if user.skill_level else "—"
    joined = user.registration_date.strftime("%Y-%m-%d") if user.registration_date else "—"

    sub = await get_active_subscription(user.telegram_id)
    if sub is not None:
        sub_line = (
            f"💎 اشتراک: <b>{sub_svc.plan_label(sub.plan)}</b>\n"
            f"⏳ باقی‌مانده: {_fmt_remaining(sub.expires_at)}\n"
            f"📅 انقضا: {sub.expires_at.strftime('%Y-%m-%d %H:%M')}"
        )
    else:
        sub_line = "💎 اشتراک: <b>غیرفعال</b> — برای فعال‌سازی «💎 اشتراک VIP» را بزنید."

    text = (
        "👤 <b>پروفایل من</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"نام: {name}\n"
        f"شماره: {user.phone_number or '—'}\n"
        f"🏅 سطح: {level}\n"
        f"📆 عضویت: {joined}\n"
        f"🔖 کد معرف: <code>{user.referral_code or '—'}</code>\n\n"
        f"{sub_line}"
    )
    await message.answer(text)
