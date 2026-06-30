"""هندلر پشتیبانی — مرکز پشتیبانی حرفه‌ای با FAQ دسته‌بندی‌شده و تماس مستقیم."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from src.bot import keyboards as kb
from src.bot import texts

support_router = Router(name="support")


@support_router.message(F.text == texts.BTN_SUPPORT)
@support_router.message(Command("help"))
async def show_support(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(texts.support_home(), reply_markup=kb.support_home_keyboard())


@support_router.callback_query(F.data == "sup:home")
async def back_to_support_home(callback: CallbackQuery) -> None:
    await callback.message.edit_text(
        texts.support_home(), reply_markup=kb.support_home_keyboard()
    )
    await callback.answer()


@support_router.callback_query(F.data.startswith("sup:cat:"))
async def show_faq_category(callback: CallbackQuery) -> None:
    cat = callback.data.split(":")[-1]
    entry = texts.FAQ.get(cat)
    if entry is None:
        await callback.answer()
        return
    _title, body = entry
    await callback.message.edit_text(
        body + texts.FAQ_RISK_NOTE,
        reply_markup=kb.support_section_keyboard(),
    )
    await callback.answer()
