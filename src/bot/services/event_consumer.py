"""مصرف‌کننده‌ی صف‌های Redis — پلی بین API (که Bot ندارد) و ربات.

API هنگام تأیید/رد پرداخت یا ارسال پیام مستقیم، رویداد را در صف Redis می‌گذارد
و این تسک پس‌زمینه (که داخل bot worker اجرا می‌شود و به Bot دسترسی دارد) آن را
مصرف می‌کند: لینک دعوت می‌سازد، پیام می‌فرستد، یا کاربر را از کانال حذف می‌کند.

صف‌ها:
  - telegram:direct_messages  → پیام مستقیم ادمین به کاربر (از routes/users.py)
  - telegram:events           → رویدادهای اشتراک (approve/reject/expire) از routes/payments.py
"""

from __future__ import annotations

import asyncio
import html
import json
import re
from datetime import datetime, timezone

from aiogram import Bot
from sqlalchemy import select

from src.core.database import ChannelMember, async_session_factory
from src.core.logger import get_logger
from src.core.redis_client import redis_client
from src.bot.services import channel, messaging

logger = get_logger("bot.services.event_consumer")

_QUEUES = ("telegram:events", "telegram:direct_messages", "telegram:broadcasts")
_stop = False


async def _handle_direct_message(bot: Bot, payload: dict) -> None:
    tid = payload.get("telegram_id_raw") or payload.get("telegram_id")
    text = payload.get("message")
    if tid and text:
        # پیام ادمین متن خام است؛ برای parse_mode=HTML باید escape شود
        await messaging.send(bot, int(tid), html.escape(str(text)), handler="admin_direct_message")


async def _handle_broadcast(bot: Bot, payload: dict) -> None:
    """ارسالِ واقعیِ پیامِ انبوهِ پنل (صفِ telegram:broadcasts که قبلاً مصرف‌کننده نداشت).

    مخاطب را طبقِ target_plan انتخاب، با نرخِ امن ارسال، و شمارش را در DB و Redis
    (broadcast:{id}:delivered/failed/total) ثبت می‌کند تا endpointِ status واقعی باشد.
    """
    from src.bot.broadcast import broadcast_message
    from src.core.database import Broadcast, User

    bid = payload.get("broadcast_id")
    text = payload.get("message") or ""
    media = payload.get("media_url") or payload.get("image_url")
    target_plan = payload.get("target_plan") or "all"

    target_ids = None
    if target_plan and target_plan != "all":
        async with async_session_factory() as s:
            rows = (await s.execute(
                select(User.telegram_id).where(
                    User.is_active.is_(True), User.is_banned.is_(False),
                    User.plan == target_plan,
                )
            )).scalars().all()
            target_ids = [int(x) for x in rows]

    delivered, failed, total = await broadcast_message(
        bot=bot, text=text, photo_file_id=media, target_user_ids=target_ids,
    )

    async with async_session_factory() as s:
        bc = (await s.execute(select(Broadcast).where(Broadcast.id == bid))).scalar_one_or_none()
        if bc is not None:
            bc.total_recipients = total
            bc.delivered_count = delivered
            bc.failed_count = failed
            bc.status = "sent"
            if not bc.sent_at:
                bc.sent_at = datetime.now(timezone.utc)
            await s.commit()
    try:
        await redis_client.client.set(f"broadcast:{bid}:delivered", delivered)
        await redis_client.client.set(f"broadcast:{bid}:failed", failed)
        await redis_client.client.set(f"broadcast:{bid}:total", total)
    except Exception:  # noqa: BLE001
        pass
    logger.info("broadcast_sent", id=bid, delivered=delivered, failed=failed, total=total)


async def _grant_channel_access(bot: Bot, telegram_id: int) -> str | None:
    """ساخت لینک دعوت و به‌روزرسانی رکورد channel_members. لینک را برمی‌گرداند."""
    link = await channel.create_invite(bot, ttl_hours=24, name=f"user:{telegram_id}")
    async with async_session_factory() as s:
        cm = (
            await s.execute(
                select(ChannelMember)
                .where(ChannelMember.telegram_id == telegram_id)
                .order_by(ChannelMember.id.desc())
            )
        ).scalars().first()
        if cm is None:
            return link
        if link:
            cm.invite_link = link
            cm.status = "invited"
            cm.is_active = True
        await s.commit()
    return link


def _clean_summary(text: str, limit: int = 480) -> str:
    """خلاصهٔ تمیز و کامل (بدونِ HTML، بریده‌نشدن وسطِ جمله)."""
    text = re.sub(r"<[^>]+>", " ", text or "")          # حذفِ تگ‌های HTML
    text = re.sub(r"—\s*منبع\s*:.*$", "", text, flags=re.DOTALL)  # حذفِ خطِ «منبع»
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    best = -1
    for sep in ("؟", "!", ".", "۔", "؛"):
        best = max(best, cut.rfind(sep))
    if best > limit * 0.5:
        return cut[: best + 1]
    sp = cut.rfind(" ")
    return (cut[:sp] if sp > 0 else cut).rstrip() + " …"


# قالبِ هر نوع محتوا برای کانال: (ایموجیِ سرتیتر، هشتگ، متنِ دکمهٔ «متنِ کامل»)
_KIND_STYLE = {
    "news": ("🔴 📰", "#خبر", "📖 متن کامل خبر"),
    "analysis": ("📊 📈", "#تحلیل", "📖 متن کامل تحلیل"),
    "blog": ("📝 🎓", "#بلاگ", "📖 مطالعهٔ مقاله"),
}


async def _post_news_to_channel(bot: Bot, payload: dict) -> None:
    """پستِ تیتروار در کانالِ عمومی: تیتر + خلاصهٔ کامل + هشتگ + ۳ دکمه."""
    from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup

    from src.core.config import settings

    cid = settings.NEWS_CHANNEL_ID or channel.channel_id()
    if not cid:
        return
    tag = settings.NEWS_CHANNEL_TAG
    name = settings.NEWS_CHANNEL_NAME
    kind = payload.get("kind", "news")
    emoji, hashtag, full_btn = _KIND_STYLE.get(kind, _KIND_STYLE["news"])
    title = re.sub(r"\s+", " ", (payload.get("title") or "")).strip()
    summary = _clean_summary(payload.get("summary") or "")
    image = payload.get("image")
    url = payload.get("url") or f"{settings.NEWS_SITE_URL}/news"

    # ── کپشنِ تیتروار با ایموجی و هشتگِ مناسب ──
    parts = [f"{emoji} <b>{html.escape(title)}</b>"]
    if summary:
        parts.append(f"\n🔹 {html.escape(summary)}")
    parts.append(
        f"\n{hashtag}\n"
        "➖➖➖➖➖➖➖➖\n"
        f"🆔 {tag}  |  <b>{html.escape(name)}</b>"
    )
    caption = "\n".join(parts)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=full_btn, url=url)],
        [InlineKeyboardButton(text="🤖 ربات معاملات فارکس پیشرفته", url=settings.NEWS_BOT_URL)],
        [InlineKeyboardButton(text="🌐 وب‌سایت کوین پرو FX", url=settings.NEWS_SITE_URL)],
    ])
    try:
        if image:
            await bot.send_photo(
                chat_id=cid, photo=image, caption=caption[:1024],
                parse_mode="HTML", reply_markup=kb,
            )
        else:
            await bot.send_message(
                chat_id=cid, text=caption[:4096], parse_mode="HTML", reply_markup=kb,
            )
        logger.info("news_posted_to_channel", chat=str(cid), title=title[:60])
    except Exception as exc:  # noqa: BLE001
        logger.warning("news_channel_post_failed", chat=str(cid), error=str(exc))
        try:  # اگر عکس مشکل داشت، به پیامِ متنی fallback
            await bot.send_message(
                chat_id=cid, text=caption[:4096], parse_mode="HTML", reply_markup=kb,
            )
        except Exception:  # noqa: BLE001
            pass


async def _handle_event(bot: Bot, payload: dict) -> None:
    action = payload.get("action")

    # پستِ خبر به کانال (هدف: کانال، نه کاربر — پس قبل از چکِ telegram_id)
    if action == "news_post":
        await _post_news_to_channel(bot, payload)
        return

    tid = payload.get("telegram_id")
    if not tid:
        return
    tid = int(tid)

    if action == "subscription_approved":
        link = await _grant_channel_access(bot, tid)
        plan_label = payload.get("plan_label", "")
        if link:
            text = (
                "✅ پرداخت شما تأیید شد!\n\n"
                f"اشتراک <b>{plan_label}</b> فعال شد 💎\n"
                "برای ورود به کانال VIP روی لینک زیر بزنید 👇\n\n"
                f"{link}"
            )
        else:
            text = (
                "✅ پرداخت شما تأیید شد!\n\n"
                f"اشتراک <b>{plan_label}</b> فعال شد 💎\n"
                "لینک کانال به‌زودی برای شما ارسال می‌شود. در صورت تأخیر با پشتیبانی تماس بگیرید."
            )
        await messaging.send(bot, tid, text, handler="subscription_approved")

    elif action == "referral_reward":
        days = int(payload.get("days", 90))
        link = await _grant_channel_access(bot, tid)
        months = days // 30
        base = (
            "🎉 <b>تبریک! پاداشِ معرفی فعال شد</b>\n\n"
            f"شما به اندازهٔ کافی دوست به ربات دعوت کردید و <b>{months} ماه اشتراکِ "
            "رایگانِ VIP</b> هدیه گرفتید! 🎁"
        )
        if link:
            base += "\n\nبرای ورود به کانال VIP روی لینک زیر بزنید 👇\n\n" + link
        await messaging.send(bot, tid, base, handler="referral_reward")

    elif action == "subscription_rejected":
        note = payload.get("admin_note") or ""
        text = "❌ متأسفانه پرداخت شما تأیید نشد."
        if note:
            text += f"\n\nدلیل: {html.escape(str(note))}"
        text += "\n\nبرای پیگیری با پشتیبانی در تماس باشید."
        await messaging.send(bot, tid, text, handler="subscription_rejected")

    elif action == "subscription_cancelled":
        ok = await channel.remove_member(bot, tid)
        async with async_session_factory() as s:
            cm = (
                await s.execute(
                    select(ChannelMember).where(
                        ChannelMember.telegram_id == tid,
                        ChannelMember.is_active.is_(True),
                    )
                )
            ).scalars().first()
            if cm and ok:
                cm.is_active = False
                cm.status = "removed"
                cm.removed_at = datetime.now(timezone.utc)
                await s.commit()
        await messaging.send(
            bot, tid,
            "اشتراک شما لغو شد و دسترسی به کانال VIP پایان یافت.",
            handler="subscription_cancelled",
        )


async def run(bot: Bot) -> None:
    """حلقه‌ی مصرف صف‌ها. تا زمان توقف اجرا می‌شود."""
    global _stop
    _stop = False
    logger.info("event_consumer_started", queues=_QUEUES)
    while not _stop:
        try:
            item = await redis_client.client.blpop(list(_QUEUES), timeout=5)
            if item is None:
                continue
            queue, raw = item
            try:
                payload = json.loads(raw)
            except (ValueError, TypeError):
                logger.warning("event_consumer_bad_payload", queue=queue)
                continue
            try:
                if queue == "telegram:direct_messages":
                    await _handle_direct_message(bot, payload)
                elif queue == "telegram:broadcasts":
                    await _handle_broadcast(bot, payload)
                else:
                    await _handle_event(bot, payload)
            except Exception as exc:  # noqa: BLE001 — رویداد را گم نکن: به انتهای صف برگردان
                logger.error("event_handle_failed_requeue", queue=queue, error=str(exc))
                try:
                    await redis_client.client.rpush(queue, raw)
                except Exception:  # noqa: BLE001
                    pass
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            break
        except Exception as exc:  # noqa: BLE001
            logger.error("event_consumer_error", error=str(exc))
            await asyncio.sleep(1)
    logger.info("event_consumer_stopped")


def stop() -> None:
    global _stop
    _stop = True
