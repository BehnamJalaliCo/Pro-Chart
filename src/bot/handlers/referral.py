"""هندلر معرفی به دوستان — لینک رفرال اختصاصی و آمار."""

from __future__ import annotations

from contextlib import suppress

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from src.bot import texts
from src.bot.services import users
from src.core.config import settings

referral_router = Router(name="referral")


@referral_router.message(F.text == texts.BTN_REFERRAL)
async def show_referral(message: Message, bot: Bot, state: FSMContext) -> None:
    await state.clear()
    user = await users.get_user(message.from_user.id)
    if user is None or user.registration_date is None:
        await message.answer(texts.NEED_ONBOARDING)
        return

    code = await users.ensure_referral_code(message.from_user.id)
    count = await users.count_referrals(message.from_user.id)

    bot_username = None
    with suppress(Exception):
        me = await bot.me()
        bot_username = me.username

    link = f"https://t.me/{bot_username}?start={code}" if (bot_username and code) else "—"

    threshold = settings.REFERRAL_REWARD_THRESHOLD
    months = settings.REFERRAL_REWARD_DAYS // 30
    remaining = max(0, threshold - count)
    filled = min(count, threshold)
    bar = "🟩" * filled + "⬜️" * (threshold - filled)

    if remaining > 0:
        progress = (
            f"📊 پیشرفتِ شما: <b>{count}/{threshold}</b>\n{bar}\n"
            f"تنها <b>{remaining}</b> دعوتِ موفقِ دیگر تا دریافتِ پاداش!"
        )
    else:
        progress = (
            f"📊 پیشرفتِ شما: <b>{count}/{threshold}</b>\n{bar}\n"
            "🎉 شما پاداشِ معرفی را دریافت کرده‌اید!"
        )

    text = (
        "🤝 <b>معرفی به دوستان</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "دوستان خود را به ربات دعوت کنید و جایزه بگیرید!\n\n"
        f"🎁 <b>با هر {threshold} دعوتِ موفق، {months} ماه اشتراکِ VIP رایگان</b> می‌گیرید.\n"
        "<i>«دعوتِ موفق» یعنی دوستِ شما با لینک‌تان وارد ربات شود و ثبت‌نامش را کامل کند.</i>\n\n"
        f"🔗 لینک اختصاصی شما:\n{link}\n\n"
        f"🔖 کد معرف: <code>{code or '—'}</code>\n\n"
        f"{progress}"
    )
    await message.answer(text)
