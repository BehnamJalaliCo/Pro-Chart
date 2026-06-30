"""هندلر تنظیمات — اعلان‌ها و زبان."""

from __future__ import annotations

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from src.bot import keyboards as kb
from src.bot import texts
from src.bot.services import users

settings_router = Router(name="settings")


@settings_router.message(F.text == texts.BTN_SETTINGS)
async def show_settings(message: Message, state: FSMContext) -> None:
    await state.clear()
    user = await users.get_user(message.from_user.id)
    notify = bool(user.notify_enabled) if user else True
    lang = (user.language if user else "fa") or "fa"
    await message.answer(texts.SETTINGS_TEXT, reply_markup=kb.settings_keyboard(notify, lang))


@settings_router.callback_query(F.data == "set:notif:toggle")
async def toggle_notif(callback: CallbackQuery) -> None:
    enabled = await users.toggle_notify(callback.from_user.id)
    user = await users.get_user(callback.from_user.id)
    lang = (user.language if user else "fa") or "fa"
    await callback.message.edit_reply_markup(reply_markup=kb.settings_keyboard(enabled, lang))
    await callback.answer("اعلان‌ها روشن شد." if enabled else "اعلان‌ها خاموش شد.")


@settings_router.callback_query(F.data == "set:lang:toggle")
async def toggle_lang(callback: CallbackQuery) -> None:
    lang = await users.toggle_language(callback.from_user.id)
    user = await users.get_user(callback.from_user.id)
    notify = bool(user.notify_enabled) if user else True
    await callback.message.edit_reply_markup(reply_markup=kb.settings_keyboard(notify, lang))
    await callback.answer("زبان فارسی شد." if lang == "fa" else "Language set to English.")
