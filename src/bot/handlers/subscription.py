"""هندلر اشتراک VIP — نمایش پلن‌ها، آدرس پرداخت، دریافت هش و فوروارد به ادمین."""

from __future__ import annotations

import re

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

from src.bot import keyboards as kb
from src.bot import texts
from src.bot.services import subscription as sub_svc, users
from src.bot.services.access import create_payment_request, has_pending_payment, tx_hash_used
from src.bot.services.messaging import send as send_msg
from src.bot.states import PaymentStates
from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger("bot.handlers.subscription")

subscription_router = Router(name="subscription")

_TXHASH_RE = re.compile(r"^(0x)?[A-Za-z0-9]{20,100}$")
_VALID_PLANS = {"monthly", "quarterly", "biannual"}


async def _show_plans(message: Message) -> None:
    await message.answer(texts.vip_plans(), reply_markup=kb.vip_plans_keyboard())


@subscription_router.message(F.text == texts.BTN_VIP)
async def vip_menu(message: Message, state: FSMContext) -> None:
    await state.clear()
    await _show_plans(message)


@subscription_router.callback_query(F.data == "sub:plans")
async def cb_plans(callback: CallbackQuery) -> None:
    await _show_plans(callback.message)
    await callback.answer()


@subscription_router.callback_query(F.data == "sub:free")
async def cb_free_subscription(callback: CallbackQuery) -> None:
    """اشتراکِ رایگانِ همیشگی از طریقِ ثبت‌نام و شارژِ حساب در بروکر."""
    import os

    from aiogram.types import FSInputFile

    asset = os.path.join(os.getenv("EDU_ASSET_DIR", "/app/edu_assets"), "free-sub.png")
    if os.path.exists(asset):
        try:
            await callback.message.answer_photo(FSInputFile(asset))
        except Exception as exc:  # noqa: BLE001
            logger.warning("free_sub_photo_failed", error=str(exc))
    await callback.message.answer(
        texts.free_subscription(),
        reply_markup=kb.free_subscription_keyboard(),
    )
    await callback.answer()


@subscription_router.callback_query(F.data.startswith("sub:plan:"))
async def cb_select_plan(callback: CallbackQuery) -> None:
    plan = callback.data.split(":")[-1]
    if plan not in _VALID_PLANS:
        await callback.answer()
        return
    await callback.message.answer(
        texts.payment_addresses(sub_svc.plan_label(plan), sub_svc.plan_price(plan)),
        reply_markup=kb.payment_submit_keyboard(plan),
    )
    await callback.answer()


@subscription_router.callback_query(F.data.startswith("sub:paid:"))
async def cb_paid(callback: CallbackQuery, state: FSMContext) -> None:
    plan = callback.data.split(":")[-1]
    if plan not in _VALID_PLANS:
        await callback.answer()
        return
    await state.set_state(PaymentStates.waiting_tx_hash)
    await state.update_data(plan=plan)
    await callback.message.answer(texts.ASK_TX_HASH)
    await callback.answer()


@subscription_router.message(
    PaymentStates.waiting_tx_hash,
    F.text,
    ~F.text.in_(texts.MENU_BUTTONS),
    ~F.text.startswith("/"),
)
async def receive_tx_hash(message: Message, state: FSMContext, bot: Bot) -> None:
    tx = (message.text or "").strip()
    if not _TXHASH_RE.match(tx):
        await message.answer(texts.INVALID_TX_HASH)
        return

    data = await state.get_data()
    plan = data.get("plan")
    if plan not in _VALID_PLANS:
        await state.clear()
        await message.answer(texts.GENERIC_ERROR)
        return

    if await has_pending_payment(message.from_user.id):
        await state.clear()
        await message.answer("شما یک درخواست پرداخت در حال بررسی دارید. لطفاً منتظر بمانید. 🙏")
        return

    # جلوگیری از استفاده‌ی مجدد از یک هش تراکنش (replay)
    if await tx_hash_used(tx):
        await state.clear()
        await message.answer(
            "این هش تراکنش قبلاً ثبت شده است. اگر فکر می‌کنید اشتباهی رخ داده، "
            "با پشتیبانی تماس بگیرید."
        )
        return

    user = await users.get_or_create_user(
        message.from_user.id, message.from_user.username,
        message.from_user.first_name, message.from_user.last_name,
    )
    network = "BSC" if tx.lower().startswith("0x") else "TRC20"
    pr = await create_payment_request(user, plan, network, tx)
    await state.clear()

    if pr is None:
        await message.answer(
            "این هش تراکنش قبلاً ثبت شده است. در صورت اشتباه با پشتیبانی تماس بگیرید."
        )
        return

    await message.answer(texts.PAYMENT_RECEIVED)
    await _forward_to_admins(bot, user, pr, tx, network, plan)


async def _forward_to_admins(bot: Bot, user, pr, tx: str, network: str, plan: str) -> None:
    """ارسال درخواست پرداخت به همه‌ی ادمین‌ها با دکمه‌های تأیید/رد."""
    uname = f"@{user.username}" if user.username else "—"
    body = (
        "🧾 <b>درخواست پرداخت جدید</b>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 کاربر: {uname} (<code>{user.telegram_id}</code>)\n"
        f"📦 پلن: <b>{sub_svc.plan_label(plan)}</b>\n"
        f"💵 مبلغ: <b>{sub_svc.plan_price(plan)} USDT</b>\n"
        f"🌐 شبکه: {network}\n"
        f"🔗 TxID:\n<code>{tx}</code>\n\n"
        f"شناسه‌ی درخواست: #{pr.id}"
    )
    markup = kb.admin_payment_review_keyboard(pr.id)
    targets = settings.admin_ids or []
    for admin_id in targets:
        await send_msg(bot, admin_id, body, log=False, reply_markup=markup)
    if not targets:
        logger.warning("no_admin_ids_for_payment_forward", payment_id=pr.id)
