"""هندلر بخش بروکر OneRoyal — معرفی حرفه‌ای + لینک رفرال + راهنمای ثبت‌نام.

عکس‌های دیاگرامِ بخش بروکر در /app/edu_assets ذخیره می‌شوند (با scripts/seed_broker.py
ساخته می‌شوند)؛ اگر موجود نبودند، fail-soft فقط متن ارسال می‌شود.
"""

from __future__ import annotations

import os

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, FSInputFile, Message

from src.bot import keyboards as kb
from src.bot import texts
from src.core.logger import get_logger

logger = get_logger("bot.handlers.broker")

broker_router = Router(name="broker")

_ASSET_DIR = os.getenv("EDU_ASSET_DIR", "/app/edu_assets")


def _photo(name: str) -> FSInputFile | None:
    path = os.path.join(_ASSET_DIR, f"{name}.png")
    return FSInputFile(path) if os.path.exists(path) else None


async def _send(target_message: Message, image: str, text: str, markup) -> None:
    """عکس (در صورت وجود) + متن با کیبورد؛ fail-soft."""
    photo = _photo(image)
    if photo is not None:
        try:
            await target_message.answer_photo(photo)
        except Exception as exc:  # noqa: BLE001
            logger.warning("broker_photo_failed", image=image, error=str(exc))
    await target_message.answer(text, reply_markup=markup)


# ── دکمهٔ منوی اصلی: 🏦 بروکر OneRoyal ──
@broker_router.message(F.text == texts.BTN_BROKER)
async def broker_menu(message: Message, state: FSMContext) -> None:
    await state.clear()
    await _send(message, "broker-intro", texts.BROKER_INTRO, kb.broker_home_keyboard())


@broker_router.callback_query(F.data == "broker:home")
async def broker_home(callback: CallbackQuery) -> None:
    await _send(callback.message, "broker-intro", texts.BROKER_INTRO, kb.broker_home_keyboard())
    await callback.answer()


@broker_router.callback_query(F.data == "broker:referral:notice")
async def broker_referral_notice(callback: CallbackQuery) -> None:
    """نمایش شرایط پیش از آشکارشدن مسیر خروج ثابت OneRoyal."""
    await callback.message.answer(
        texts.BROKER_REFERRAL_NOTICE,
        reply_markup=kb.broker_referral_ack_keyboard(),
    )
    await callback.answer()


@broker_router.callback_query(F.data == "broker:guide")
async def broker_guide(callback: CallbackQuery) -> None:
    text = f"{texts.BROKER_GUIDE}\n\n{texts.BROKER_NO_VIDEO_NOTE}"
    await _send(callback.message, "broker-steps", text, kb.broker_section_keyboard())
    await callback.answer()


@broker_router.callback_query(F.data == "broker:funding")
async def broker_funding(callback: CallbackQuery) -> None:
    await _send(callback.message, "broker-funding", texts.BROKER_FUNDING, kb.broker_section_keyboard())
    await callback.answer()


@broker_router.callback_query(F.data == "broker:why")
async def broker_why(callback: CallbackQuery) -> None:
    await _send(callback.message, "broker-features", texts.BROKER_WHY, kb.broker_section_keyboard())
    await callback.answer()
