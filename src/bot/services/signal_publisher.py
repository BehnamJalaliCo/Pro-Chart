"""انتشار سیگنال‌های موتور روی کانال VIP.

به کانال Redis `new_signals` (که SignalEngine روی آن منتشر می‌کند) گوش می‌دهد،
هر سیگنال را به‌صورت حرفه‌ای فرمت کرده و به settings.TELEGRAM_CHANNEL_ID پست می‌کند.
dedup با کلید Redis تا یک سیگنال دوبار پست نشود.
"""

from __future__ import annotations

import asyncio

import orjson
from aiogram import Bot
from aiogram.exceptions import TelegramRetryAfter

from src.core.config import settings
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("bot.services.signal_publisher")

_stop = False


def _direction_label(direction, signal_type=None) -> tuple[str, str]:
    """نگاشت جهت موتور (long/short یا buy/sell) به برچسب فارسی + ایموجی.

    موتور مقدار direction را به‌صورت 'long'/'short' منتشر می‌کند (نه BUY/SELL).
    """
    d = str(direction or "").strip().lower()
    strong = "STRONG" in str(signal_type or "").upper()
    is_sell = d in ("sell", "short", "strong_sell", "bearish")
    if is_sell:
        return ("فروش قوی", "🔴🔥") if strong else ("فروش", "🔴")
    return ("خرید قوی", "🟢🔥") if strong else ("خرید", "🟢")


def _fmt_price(v) -> str:
    """قیمت را با حداکثر ۵ رقم اعشار و بدون صفرهای انتهایی نمایش می‌دهد."""
    if v is None:
        return "—"
    try:
        s = f"{float(v):.5f}".rstrip("0").rstrip(".")
        return s or "0"
    except (TypeError, ValueError):
        return str(v)


def _rr(v) -> str:
    try:
        return f"{float(v):.1f}"
    except (TypeError, ValueError):
        return "—"


def format_channel_signal(signal: dict, summary: dict | None = None) -> str:
    """فرمت پیام سیگنال برای کانال VIP."""
    summary = summary or {}
    symbol = signal.get("symbol", "")
    name_fa = settings.symbol_names_fa.get(symbol, "")
    fa_dir, icon = _direction_label(signal.get("direction"), signal.get("signal_type"))
    tf = signal.get("timeframe", "")
    try:
        score = int(float(signal.get("signal_score", summary.get("final_score", 0)) or 0))
    except (TypeError, ValueError):
        score = 0

    # ناحیه‌ی ورود یا قیمت ورود
    elow, ehigh = signal.get("entry_zone_low"), signal.get("entry_zone_high")
    if elow is not None and ehigh is not None:
        entry_str = f"{_fmt_price(elow)} - {_fmt_price(ehigh)}"
    else:
        entry_str = _fmt_price(signal.get("entry_price"))

    header_name = f"{symbol}" + (f" ({name_fa})" if name_fa else "")
    lines = [
        f"{icon} <b>سیگنال {fa_dir}</b> | <b>{header_name}</b>",
        f"⏱ تایم‌فریم: {tf}  |  ⭐️ امتیاز: {int(score)}/100",
        "━━━━━━━━━━━━━━━━━━━━",
        f"🔵 ورود: <b>{entry_str}</b>",
        f"🛑 حد ضرر: <b>{_fmt_price(signal.get('sl'))}</b>",
    ]
    tps = [
        ("🎯 هدف ۱", signal.get("tp1"), signal.get("rr_tp1")),
        ("🎯 هدف ۲", signal.get("tp2"), signal.get("rr_tp2")),
        ("🎯 هدف ۳", signal.get("tp3"), signal.get("rr_tp3")),
    ]
    for label, price, rr in tps:
        if price is not None:
            lines.append(f"{label}: <b>{_fmt_price(price)}</b>  (R/R {_rr(rr)})")

    lines.append("━━━━━━━━━━━━━━━━━━━━")
    # خلاصه‌ی تحلیل
    tech = summary.get("tech_score")
    pat = summary.get("pattern_score")
    ml = summary.get("ml_score")
    parts = []
    if tech is not None:
        parts.append(f"تکنیکال {int(float(tech))}")
    if pat is not None:
        parts.append(f"الگو {int(float(pat))}")
    if ml is not None:
        parts.append(f"هوش مصنوعی {int(float(ml))}")
    if parts:
        lines.append("📊 " + " | ".join(parts))
    mtf = summary.get("mtf_confluence")
    if mtf:
        lines.append(f"🔗 تأیید چند تایم‌فریم: {mtf}")

    lines.append("")
    lines.append("⚠️ مدیریت ریسک و حجم معامله بر عهده‌ی شماست.")
    # امضای کانال — اگر @username بود نمایش بده، وگرنه برند (id عددی را نشان نده)
    cid = settings.TELEGRAM_CHANNEL_ID
    lines.append(cid if str(cid).startswith("@") else "💎 CoinePro FX VIP")
    return "\n".join(lines)


async def _is_signal_still_fresh(signal: dict, sid) -> bool:
    """گیتِ تازگیِ پیش از انتشار (بحرانی): اگر بینِ ساختِ سیگنال و این لحظه (رندرِ چارت/صف)
    قیمتِ زنده SL را زده باشد — یا بیش از ۶۰٪ مسیرِ ورود→SL نامساعد رفته باشد (ورودِ بیات،
    R/R خراب) — سیگنال نباید روی کانال پست شود. fail-open: نبودِ قیمت = اجازهٔ انتشار."""
    try:
        sym = signal.get("symbol")
        direction = signal.get("direction")
        sl = float(signal.get("sl") or 0)
        entry = float(signal.get("entry_price") or 0)
        if not sym or sl <= 0:
            return True
        live = await redis_client.get_price(sym)
        if not live:
            return True
        cur = float(live.get("price") or live.get("bid") or live.get("ask") or 0)
        if cur <= 0:
            return True
        sl_hit = (direction == "long" and cur <= sl) or (direction == "short" and cur >= sl)
        stale = False
        if entry > 0:
            dist = abs(entry - sl)
            if dist > 0:
                adverse = (entry - cur) if direction == "long" else (cur - entry)
                stale = adverse >= 0.6 * dist
        if sl_hit or stale:
            logger.warning("signal_invalidated_before_publish", signal_id=sid, symbol=sym,
                           cur=cur, sl=sl, entry=entry, sl_hit=sl_hit, stale=stale)
            try:
                await redis_client.remove_active_signal(sid)
            except Exception:  # noqa: BLE001
                pass
            return False
        return True
    except Exception as exc:  # noqa: BLE001 — fail-open: سیگنالِ معتبر را هرگز بلاک نکن
        logger.warning("freshness_check_failed", signal_id=sid, error=str(exc))
        return True


async def _post_signal(bot: Bot, payload: dict) -> None:
    signal = payload.get("signal") or {}
    summary = payload.get("analysis_summary") or {}
    sid = signal.get("id")

    # dedup — هر سیگنال یک‌بار. کلید فقط پس از ارسالِ موفق ست می‌شود تا
    # یک ارسال ناموفق سیگنال را برای همیشه بلاک نکند. NX برای جلوگیری از
    # ارسال هم‌زمان دو worker (best-effort).
    if sid is not None:
        try:
            ok = await redis_client.client.set(
                f"signal:posting:{sid}", "1", nx=True, ex=120
            )
            if not ok and await redis_client.client.exists(f"signal:posted:{sid}"):
                return
        except Exception:  # noqa: BLE001
            pass

    # نکته: گیت نظر دومِ Claude به موتور سیگنال (engine._create_signal) منتقل شد
    # تا سیگنالِ ردشده اصلاً ساخته/ردیابی نشود. اینجا فقط غنی‌سازی (narrator) می‌ماند.

    # ── گیتِ تازگی (بحرانی): سیگنالِ مرده/استاپ‌خورده هرگز روی کانال پست نشود ──
    if not await _is_signal_still_fresh(signal, sid):
        return

    try:
        text = format_channel_signal(signal, summary)
    except Exception as exc:  # noqa: BLE001
        logger.error("signal_format_failed", signal_id=sid, error=str(exc))
        return

    # عکس چارت TradingView (با خطوط Entry/SL/TP) ساخته می‌شود و سیگنال به‌صورت
    # «عکس + caption» ارسال می‌گردد تا عکس به بالای متن بچسبد بدون بهم‌ریختگی
    # (متن سیگنال ~۳۷۰ کاراکتر، زیر سقف ۱۰۲۴ کاراکترِ caption). تحلیل Claude
    # به‌صورت ریپلای جداگانه می‌آید. fail-soft: اگر عکس آماده نشد، فقط متن.
    chart_png: "bytes | None" = None
    try:
        from src.bot.services.chart_client import render_signal_chart
        chart_png = await render_signal_chart(signal)
    except Exception as exc:  # noqa: BLE001
        logger.warning("chart_render_skipped", signal_id=sid, error=str(exc))

    # caption تلگرام حداکثر ۱۰۲۴ کاراکتر؛ اگر متن بلندتر بود، عکس بدون caption +
    # متن به‌صورت پیامِ جدا (جلوگیری از خطای caption-too-long).
    _use_photo_caption = chart_png is not None and len(text) <= 1024

    async def _send() -> "object | None":
        if chart_png is not None:
            from aiogram.types import BufferedInputFile
            photo = BufferedInputFile(chart_png, filename="chart.png")
            if _use_photo_caption:
                return await bot.send_photo(
                    settings.TELEGRAM_CHANNEL_ID, photo, caption=text,
                )
            # متنِ بلند: عکس جدا، سپس متن به‌عنوان پاسخ
            pmsg = await bot.send_photo(settings.TELEGRAM_CHANNEL_ID, photo)
            return await bot.send_message(
                settings.TELEGRAM_CHANNEL_ID, text,
                reply_to_message_id=pmsg.message_id,
            )
        return await bot.send_message(settings.TELEGRAM_CHANNEL_ID, text)

    try:
        try:
            msg = await _send()
        except TelegramRetryAfter as exc:
            await asyncio.sleep(exc.retry_after)
            msg = await _send()
        logger.info("signal_posted_to_channel", signal_id=sid, message_id=msg.message_id)
        if sid is not None:
            try:
                async with redis_client.client.pipeline(transaction=False) as pipe:
                    # TTLِ ۱۴روزه (هم‌اندازهٔ signal:active) تا تا وقتی سیگنال فعال است
                    # فلگِ posted نمنقضی شود — /ea/signals فقط سیگنالِ posted را به EA
                    # می‌دهد، پس نباید این فلگ زودتر از خودِ سیگنال بمیرد.
                    pipe.set(f"signal:posted:{sid}", "1", ex=1209600)
                    pipe.set(f"signal:msg:{sid}", msg.message_id, ex=1209600)
                    await pipe.execute()
            except Exception:  # noqa: BLE001
                pass

        # ---- پستِ تحلیل کارشناسی (ریپلای به سیگنال) ----
        # غیرفعال‌شدنی با SIGNAL_NARRATION_ENABLED=False: نه تولید می‌شود (توکنِ Claude
        # مصرف نمی‌شود) و نه به کانال ارسال می‌شود.
        if getattr(settings, "SIGNAL_NARRATION_ENABLED", True):
          try:
            from src.llm.narrator import narrate_signal
            narration = await narrate_signal(signal, summary)
            if narration:
                analysis_text = "🔍 <b>تحلیل کارشناسی CoinePro FX</b>\n\n" + narration

                async def _send_analysis() -> None:
                    await bot.send_message(
                        settings.TELEGRAM_CHANNEL_ID,
                        analysis_text,
                        reply_to_message_id=msg.message_id,
                    )

                try:
                    await _send_analysis()
                except TelegramRetryAfter as exc:
                    await asyncio.sleep(exc.retry_after)
                    await _send_analysis()
                logger.info("signal_analysis_posted", signal_id=sid)
          except Exception as exc:  # noqa: BLE001 — تحلیل اختیاری است؛ هرگز سیگنال را خراب نکند
            logger.warning("analysis_post_skipped", signal_id=sid, error=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.error("signal_post_failed", signal_id=sid, error=str(exc))


def _fmt_pips(v) -> str:
    """پیپ با علامت (+/-)."""
    try:
        f = float(v)
        return f"{f:+.1f}"
    except (TypeError, ValueError):
        return "—"


def _fmt_dollar(v) -> str | None:
    """سود/ضرر دلاری به‌ازای هر ۱ لات استاندارد (با علامت)."""
    try:
        f = float(v)
        return f"{f:+,.0f}$"
    except (TypeError, ValueError):
        return None


def _result_line(payload: dict) -> str:
    """خط نتیجه: پیپ + دلار به‌ازای هر لات استاندارد (اگر موجود)."""
    pips = _fmt_pips(payload.get("pnl_pips"))
    dollar = _fmt_dollar(payload.get("pnl_dollar"))
    if dollar is not None:
        return f"<b>{pips} پیپ</b>  (≈ <b>{dollar}</b> به‌ازای هر ۱ لات استاندارد)"
    return f"<b>{pips} پیپ</b>"


def format_update(payload: dict) -> str | None:
    """فرمت پیام حرفه‌ای آپدیت چرخه‌ی حیات سیگنال (TP/SL/close)."""
    utype = payload.get("type")
    symbol = payload.get("symbol", "")
    name_fa = settings.symbol_names_fa.get(symbol, "")
    head = f"<b>{symbol}</b>" + (f" ({name_fa})" if name_fa else "")
    res = _result_line(payload)

    if utype == "tp1_hit":
        return (
            f"✅ <b>هدف اول (TP1) تاچ شد!</b>\n"
            f"{head}\n"
            f"📈 سود تا اینجا: {res}\n"
            f"🔒 حد ضرر به نقطه‌ی ورود منتقل شد — از این پس معامله بدون ریسک است.\n"
            f"💎 CoinePro FX VIP"
        )
    if utype == "tp2_hit":
        return (
            f"✅ <b>هدف دوم (TP2) تاچ شد!</b> 🚀\n"
            f"{head}\n"
            f"📈 سود تا اینجا: {res}\n"
            f"⏳ بخشی از حجم را ذخیره و باقی را تا هدف سوم رها کنید.\n"
            f"💎 CoinePro FX VIP"
        )
    if utype == "signal_closed":
        hit = (payload.get("hit_target") or "").upper()
        reason = (payload.get("close_reason") or "").upper()
        dur = payload.get("duration_minutes")
        dur_str = f"\n⏱ مدت معامله: {int(dur)} دقیقه" if dur is not None else ""
        if hit == "TP3":
            return (
                f"🏆 <b>هدف سوم (TP3) تاچ شد — سیگنال با موفقیت کامل بسته شد!</b> 🎉\n"
                f"{head}\n"
                f"💰 نتیجهٔ نهایی: {res}{dur_str}\n"
                f"تبریک به همراهانِ این معامله! 💎 CoinePro FX VIP"
            )
        # تریلینگ استاپ: بعد از تاچِ TP1 برگشت و سود قفل و بسته شد (نه ضرر!)
        if reason == "TRAILING_SL":
            return (
                f"🔒 <b>تریلینگ استاپ — سود قفل شد!</b> ✅\n"
                f"{head}\n"
                f"پس از تاچِ هدفِ اول، قیمت برگشت و معامله با <b>سودِ تضمین‌شده</b> بسته شد.\n"
                f"📈 نتیجه: {res}{dur_str}\n"
                f"تبریک — این یعنی مدیریتِ حرفه‌ایِ سود؛ هرگز سودِ به‌دست‌آمده را پس ندادیم. 💎 CoinePro FX VIP"
            )
        # سربه‌سر: پیش از TP1 برگشت و در نقطهٔ ورود بسته شد (صفر ضرر، نه پستِ حد ضرر)
        if reason == "BREAKEVEN":
            return (
                f"⚖️ <b>سربه‌سر (Break-Even) — بدونِ ضرر بسته شد</b>\n"
                f"{head}\n"
                f"معامله پیش از هدفِ اول برگشت و دقیقاً در <b>نقطهٔ ورود</b> بسته شد — صفرِ ضرر.\n"
                f"📊 نتیجه: {res}{dur_str}\n"
                f"سرمایه‌ات کاملاً حفظ شد؛ فرصت‌های بعدی در راه‌اند. 💎 CoinePro FX VIP"
            )
        if "SL" in reason or hit == "SL":
            return (
                f"🛑 <b>حد ضرر فعال شد — سیگنال بسته شد</b>\n"
                f"{head}\n"
                f"📉 نتیجه: {res}{dur_str}\n"
                f"مدیریت سرمایه مقدم بر هر معامله است؛ یک ضررِ کنترل‌شده بخشی از "
                f"استراتژیِ بلندمدتِ سودده است.\n💎 CoinePro FX VIP"
            )
        return (
            f"🔚 <b>سیگنال بسته شد</b>\n"
            f"{head}\n"
            f"📊 نتیجه: {res}{dur_str}\n"
            f"💎 CoinePro FX VIP"
        )
    return None


async def _handle_update(bot: Bot, payload: dict) -> None:
    text = format_update(payload)
    if text is None:
        return
    sid = payload.get("signal_id")
    reply_to = None
    if sid is not None:
        try:
            stored = await redis_client.client.get(f"signal:msg:{sid}")
            reply_to = int(stored) if stored else None
        except Exception:  # noqa: BLE001
            reply_to = None
    try:
        await bot.send_message(
            settings.TELEGRAM_CHANNEL_ID, text, reply_to_message_id=reply_to
        )
        logger.info("signal_update_posted", signal_id=sid, kind=payload.get("type"))
    except TelegramRetryAfter as exc:
        await asyncio.sleep(exc.retry_after)
        try:
            await bot.send_message(settings.TELEGRAM_CHANNEL_ID, text)
        except Exception as exc2:  # noqa: BLE001
            logger.error("signal_update_failed", signal_id=sid, error=str(exc2))
    except Exception as exc:  # noqa: BLE001
        # اگر پیام اصلی پیدا نشد (reply نامعتبر)، بدون reply دوباره تلاش کن
        try:
            await bot.send_message(settings.TELEGRAM_CHANNEL_ID, text)
        except Exception as exc2:  # noqa: BLE001
            logger.error("signal_update_failed", signal_id=sid, error=str(exc2))


async def run(bot: Bot) -> None:
    """حلقه‌ی subscribe روی new_signals + signal_updates و پست/آپدیت کانال."""
    global _stop
    _stop = False
    pubsub = redis_client.client.pubsub()
    await pubsub.subscribe("new_signals", "signal_updates")
    logger.info("signal_publisher_subscribed", channel=settings.TELEGRAM_CHANNEL_ID)
    try:
        while not _stop:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=5)
            if message is None:
                continue
            if message.get("type") != "message":
                continue
            try:
                payload = orjson.loads(message["data"])
            except Exception:  # noqa: BLE001
                logger.warning("signal_publisher_bad_payload")
                continue
            ptype = payload.get("type")
            try:
                if ptype == "new_signal":
                    await _post_signal(bot, payload)
                elif ptype in ("tp1_hit", "tp2_hit", "tp3_hit", "signal_closed"):
                    await _handle_update(bot, payload)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — یک سیگنال خراب نباید حلقه را بکشد
                logger.error("signal_dispatch_error", kind=ptype, error=str(exc))
    except asyncio.CancelledError:
        pass
    finally:
        try:
            await pubsub.unsubscribe("new_signals", "signal_updates")
            await pubsub.close()
        except Exception:  # noqa: BLE001
            pass
        logger.info("signal_publisher_stopped")


def stop() -> None:
    global _stop
    _stop = True
