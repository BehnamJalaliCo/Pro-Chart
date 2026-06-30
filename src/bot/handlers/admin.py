"""هندلر ادمین — تأیید/رد درخواست‌های پرداخت از داخل DM ادمین."""

from __future__ import annotations

import json

from aiogram import F, Router
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from src.bot.services.access import approve_payment, grant_free_vip, reject_payment
from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("bot.handlers.admin")

admin_router = Router(name="admin")


def _is_admin(user_id: int) -> bool:
    return user_id in (settings.admin_ids or [])


async def _enqueue_event(payload: dict) -> None:
    """رویداد را در صف Redis می‌گذارد تا event_consumer لینک/پیام را بفرستد."""
    try:
        await redis_client.client.rpush("telegram:events", json.dumps(payload))
    except Exception as exc:  # noqa: BLE001
        logger.error("enqueue_event_failed", error=str(exc))


@admin_router.message(Command("freevip"))
async def cmd_free_vip(message: Message) -> None:
    """اعطای اشتراکِ رایگانِ همیشگی پس از تأییدِ واریز در پنلِ بروکر.

    کاربرد (در DM ربات، فقط ادمین):  /freevip <آیدی عددیِ کاربر>
    """
    if not _is_admin(message.from_user.id):
        return  # برای غیرادمین‌ها بی‌صدا
    parts = (message.text or "").split()
    if len(parts) < 2 or not parts[1].lstrip("-").isdigit():
        await message.answer(
            "کاربرد:\n<code>/freevip ‏&lt;آیدی عددیِ کاربر&gt;</code>\n"
            "مثال: <code>/freevip 123456789</code>\n\n"
            "آیدیِ کاربر را از همان پیامی که در «🎁 اشتراکِ رایگان» برایتان فرستاده بردارید."
        )
        return
    tid = int(parts[1])
    result = await grant_free_vip(tid, admin_id=message.from_user.id)
    if result is None:
        await message.answer(
            f"❌ کاربری با آیدی <code>{tid}</code> یافت نشد. "
            "(کاربر باید قبلاً در ربات /start زده و ثبت‌نام کرده باشد.)"
        )
        return
    await _enqueue_event({
        "action": "subscription_approved",
        "telegram_id": tid,
        "plan_label": result["plan_label"],
    })
    await message.answer(
        f"✅ اشتراکِ <b>رایگانِ همیشگیِ VIP</b> برای <code>{tid}</code> فعال شد "
        "و لینکِ کانال برایش ارسال شد."
    )
    logger.info("admin_free_vip", target=tid, admin=message.from_user.id)


@admin_router.callback_query(F.data.startswith("adm:pay:approve:"))
async def cb_approve(callback: CallbackQuery) -> None:
    if not _is_admin(callback.from_user.id):
        await callback.answer("اجازه ندارید.", show_alert=True)
        return
    payment_id = int(callback.data.split(":")[-1])
    result = await approve_payment(payment_id, admin_id=None)
    if result is None:
        await callback.answer("این درخواست قبلاً بررسی شده یا یافت نشد.", show_alert=True)
        return
    await _enqueue_event({
        "action": "subscription_approved",
        "telegram_id": result["telegram_id"],
        "plan_label": result["plan_label"],
    })
    await callback.answer("✅ تأیید شد و اشتراک فعال شد.")
    if callback.message:
        await callback.message.edit_text(
            (callback.message.html_text or "") + "\n\n✅ <b>تأیید شد</b>"
        )


@admin_router.callback_query(F.data.startswith("adm:pay:reject:"))
async def cb_reject(callback: CallbackQuery) -> None:
    if not _is_admin(callback.from_user.id):
        await callback.answer("اجازه ندارید.", show_alert=True)
        return
    payment_id = int(callback.data.split(":")[-1])
    result = await reject_payment(payment_id, admin_id=None, note=None)
    if result is None:
        await callback.answer("این درخواست قبلاً بررسی شده یا یافت نشد.", show_alert=True)
        return
    await _enqueue_event({
        "action": "subscription_rejected",
        "telegram_id": result["telegram_id"],
        "admin_note": result.get("admin_note"),
    })
    await callback.answer("❌ رد شد.")
    if callback.message:
        await callback.message.edit_text(
            (callback.message.html_text or "") + "\n\n❌ <b>رد شد</b>"
        )
