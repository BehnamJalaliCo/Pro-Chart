"""هندلر ثبت‌نام — /start، نام، تلفن، آزمون سطح‌سنجی، فعال‌سازی trial."""

from __future__ import annotations

import json
import re
from contextlib import suppress
from datetime import datetime, timezone

from aiogram import Bot, F, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message, ReplyKeyboardRemove
from sqlalchemy import func, select

from src.bot import keyboards as kb
from src.bot import texts
from src.bot.services import quiz, users
from src.bot.services.access import (
    create_trial,
    get_active_subscription,
    maybe_grant_referral_reward,
)
from src.bot.states import OnboardingStates
from src.core.database import Signal, User, async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("bot.handlers.onboarding")

onboarding_router = Router(name="onboarding")

# نام: حروف فارسی/انگلیسی + فاصله + نیم‌فاصله، حداقل ۳ کاراکتر
_NAME_RE = re.compile(r"^[A-Za-z؀-ۿ‌\s]{3,}$")


async def _welcome_stats() -> tuple[int, int]:
    """(کاربران فعال، سیگنال‌های این ماه)."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    async with async_session_factory() as s:
        users_count = int(
            (await s.execute(select(func.count(User.id)).where(User.is_active.is_(True)))).scalar() or 0
        )
        signals_count = int(
            (await s.execute(
                select(func.count(Signal.id)).where(Signal.created_at >= month_start)
            )).scalar() or 0
        )
    return users_count, signals_count


@onboarding_router.message(CommandStart(deep_link=True))
@onboarding_router.message(CommandStart())
async def cmd_start(message: Message, command: CommandObject, state: FSMContext, bot: Bot) -> None:
    await state.clear()
    u = message.from_user
    user = await users.get_or_create_user(u.id, u.username, u.first_name, u.last_name)

    # deep-link رفرال: /start <code>
    if command and command.args and (user.status == "new"):
        referrer = await users.resolve_referrer(command.args)
        if referrer:
            await users.set_referred_by(u.id, referrer)

    # اگر قبلاً ثبت‌نام کامل کرده، مستقیم منوی اصلی
    if user.registration_date is not None:
        await message.answer(texts.MAIN_MENU_WELCOME, reply_markup=kb.main_menu_keyboard())
        return

    active_users, signals_month = await _welcome_stats()
    await message.answer(
        texts.welcome(active_users, signals_month),
        reply_markup=kb.start_onboarding_keyboard(),
    )


@onboarding_router.callback_query(F.data == "ob:start")
async def start_onboarding(callback: CallbackQuery, state: FSMContext) -> None:
    await state.set_state(OnboardingStates.waiting_name)
    await callback.message.answer(texts.ASK_NAME)
    await callback.answer()


@onboarding_router.message(
    OnboardingStates.waiting_name, F.text,
    ~F.text.in_(texts.MENU_BUTTONS), ~F.text.startswith("/"),
)
async def receive_name(message: Message, state: FSMContext) -> None:
    name = (message.text or "").strip()
    if not _NAME_RE.match(name):
        await message.answer(texts.INVALID_NAME)
        return
    await state.update_data(full_name=name)
    await state.set_state(OnboardingStates.waiting_phone)
    await message.answer(texts.ASK_PHONE, reply_markup=kb.share_contact_keyboard())


@onboarding_router.message(OnboardingStates.waiting_phone, F.contact)
async def receive_contact(message: Message, state: FSMContext) -> None:
    from src.bot.services import phone as phone_svc
    normalized = phone_svc.normalize_iran(message.contact.phone_number)
    if normalized is None:
        # شماره‌ی شیر شده ممکن است بین‌المللی باشد؛ همان را بپذیر اگر متعلق به کاربر است
        await message.answer(texts.INVALID_PHONE)
        return
    await _store_phone_and_start_quiz(message, state, normalized)


@onboarding_router.message(
    OnboardingStates.waiting_phone, F.text,
    ~F.text.in_(texts.MENU_BUTTONS), ~F.text.startswith("/"),
)
async def receive_phone_text(message: Message, state: FSMContext) -> None:
    from src.bot.services import phone as phone_svc
    normalized = phone_svc.normalize_iran(message.text or "")
    if normalized is None:
        await message.answer(texts.INVALID_PHONE)
        return
    await _store_phone_and_start_quiz(message, state, normalized)


@onboarding_router.message(OnboardingStates.waiting_phone)
async def waiting_phone_fallback(message: Message, state: FSMContext) -> None:
    """هر ورودیِ دیگر در مرحلهٔ شماره (دکمهٔ منو، دستور، استیکر، عکس…) → دوباره شماره بخواه.

    جلوی فرار از مرحلهٔ اجباریِ شماره را می‌گیرد (نشتیِ قبلی: منو/دستورها رد می‌شدند)."""
    await message.answer(texts.ASK_PHONE, reply_markup=kb.share_contact_keyboard())


async def _store_phone_and_start_quiz(message: Message, state: FSMContext, phone: str) -> None:
    await state.update_data(phone=phone, answers={})
    await state.set_state(OnboardingStates.quiz)
    await message.answer("✅ شماره ثبت شد.", reply_markup=ReplyKeyboardRemove())
    await message.answer(texts.QUIZ_INTRO, reply_markup=kb.quiz_intro_keyboard())


@onboarding_router.callback_query(OnboardingStates.quiz, F.data == "quiz:begin")
async def quiz_begin(callback: CallbackQuery, state: FSMContext) -> None:
    await _send_question(callback.message, 0)
    await callback.answer()


@onboarding_router.callback_query(OnboardingStates.quiz, F.data.startswith("quiz:"))
async def quiz_answer(callback: CallbackQuery, state: FSMContext, bot: Bot) -> None:
    parts = callback.data.split(":")
    if len(parts) != 3:
        await callback.answer()
        return
    _, idx_str, opt = parts
    try:
        idx = int(idx_str)
    except ValueError:
        await callback.answer()
        return
    # محافظت در برابر callback کهنه/دستکاری‌شده (IndexError یا ایندکس منفی)
    if not (0 <= idx < quiz.TOTAL_QUESTIONS):
        await callback.answer()
        return

    data = await state.get_data()
    answers: dict = data.get("answers", {})
    answers[quiz.get_question(idx).key] = opt
    await state.update_data(answers=answers)

    next_idx = idx + 1
    if next_idx < quiz.TOTAL_QUESTIONS:
        await _send_question(callback.message, next_idx)
        await callback.answer()
        return

    # پایان آزمون — محاسبه و فعال‌سازی trial
    await callback.answer("در حال محاسبه…")
    # کیبورد را بردار تا گزینه‌ی آخر دوباره زده نشود
    with suppress(Exception):
        await callback.message.edit_reply_markup(reply_markup=None)
    full_name = data.get("full_name", callback.from_user.first_name or "کاربر")
    phone = data.get("phone", "")
    # state را پیش از کار DB پاک کن تا callback تکراری دیگر با state آزمون مطابقت نکند
    await state.clear()
    await _finish_onboarding(callback, bot, answers, full_name, phone)


async def _send_question(message: Message, index: int) -> None:
    q = quiz.get_question(index)
    await message.answer(
        texts.quiz_question(index, quiz.TOTAL_QUESTIONS, q.text),
        reply_markup=kb.quiz_keyboard(index),
    )


async def _finish_onboarding(
    callback: CallbackQuery, bot: Bot, answers: dict, full_name: str, phone: str
) -> None:
    raw_score = quiz.score(answers)
    level = quiz.skill_level(raw_score)
    pct = quiz.skill_score_percent(raw_score)

    user = await users.complete_onboarding(
        telegram_id=callback.from_user.id,
        full_name=full_name,
        phone=phone,
        quiz_score=raw_score,
        skill_level=level,
        skill_score_pct=pct,
        quiz_answers=answers,
    )

    await callback.message.answer(
        texts.quiz_result(full_name, raw_score, quiz.TOTAL_QUESTIONS, quiz.skill_label(level))
    )

    # فعال‌سازی trial + لینک کانال
    existing = await get_active_subscription(user.telegram_id)
    if existing is None:
        _, link = await create_trial(bot, user)
        await callback.message.answer(texts.trial_granted(link))

    await callback.message.answer(texts.MAIN_MENU_WELCOME, reply_markup=kb.main_menu_keyboard())

    # پاداشِ معرفی: این کاربر یک «دعوتِ موفق» برای معرف است؛ اگر معرف به آستانه رسید،
    # پاداشِ اشتراکِ رایگان بگیرد (fail-soft؛ هرگز ثبت‌نام را مختل نکند).
    if user.referred_by:
        try:
            reward = await maybe_grant_referral_reward(user.referred_by)
            if reward:
                with suppress(Exception):
                    await redis_client.client.rpush(
                        "telegram:events",
                        json.dumps({
                            "action": "referral_reward",
                            "telegram_id": reward["telegram_id"],
                            "days": reward["days"],
                        }),
                    )
        except Exception as exc:  # noqa: BLE001
            logger.warning("referral_reward_failed", error=str(exc))
