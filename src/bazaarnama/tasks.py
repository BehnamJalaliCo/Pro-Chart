"""
بازارنما — موتورِ آلارمِ سمتِ‌سرور.

تسکِ Celery که هر دقیقه آلارم‌های فعال را روی قیمتِ زندهٔ Redis (همان تیک‌های
data-feed) ارزیابی می‌کند — مستقل از باز بودنِ مرورگر. هنگامِ برخورد،
`last_triggered_at` ست می‌شود (با کول‌داونِ ۱ ساعته) تا فرانت نشانِ «رخ داد» بدهد.
آلارم‌های cond.type == "indicator" (RSI/SMA/EMA/MACD) روی آخرین کندلِ «بسته»ی
همان فیدِ چارت ارزیابی می‌شوند (توابعِ خالص در alert_indicators.py).
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from src.core.celery_app import celery_app
from src.core.database import BnAlert, async_session_factory
from src.core.logger import get_logger

logger = get_logger(__name__)
_COOLDOWN = 3600  # ثانیه — جلوگیری از تکرارِ آلارم


def _run(coro):
    """اجرای یک coroutine در یک event loopِ تازه، با آزادسازیِ pool‌ها پیش از بستنِ loop.

    چرا آزادسازی لازم است: `engine` (asyncpg) و `redis_client` singletonهای ماژول‌اند و
    اتصالاتِ pool به **همان loopی که ساخته‌شان** قفل می‌شوند. بدونِ dispose، فراخوانیِ
    دوم به بعد با «got Future attached to a different loop» می‌شکست — یعنی در یک ورکرِ
    Celery فقط تیکِ اول کار می‌کرد و بقیه برای همیشه خطا می‌دادند.
    (بازتولیدشده: اجرای اولِ check_alerts سه آلارم را چک کرد، اجرای دوم شکست.)

    آزادسازی **داخلِ** همان loop انجام می‌شود تا سوکت‌ها تمیز بسته شوند. هزینه‌اش یک
    اتصالِ تازهٔ DB/Redis در هر تیکِ ۶۰ ثانیه‌ای است — ناچیز.
    """
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        for teardown in (_dispose_db(), _dispose_redis()):
            try:
                loop.run_until_complete(teardown)
            except Exception:  # noqa: BLE001 — آزادسازی هرگز نباید نتیجهٔ تسک را ببلعد
                pass
        loop.close()


async def _dispose_db() -> None:
    from src.core.database import engine

    await engine.dispose()


async def _dispose_redis() -> None:
    from src.core.redis_client import redis_client

    if getattr(redis_client, "_pool", None) is not None:
        await redis_client.close()
        redis_client._pool = None  # noqa: SLF001 — وگرنه تیکِ بعدی از poolِ بسته استفاده می‌کند


def _line_level(cond: dict, now_dt: datetime):
    """سطحِ هدفِ یک آلارمِ خطِ شیب‌دار (Trend-Line) در لحظهٔ now.

    اگر cond["line"] دو لنگرِ زمانی/قیمتی داشته باشد (t1,p1,t2,p2 با t به ثانیهٔ یونیکس)،
    قیمتِ خط با درون‌یابیِ خطی (و برون‌یابی برای زمانِ آینده) برگردانده می‌شود؛ وگرنه None.
    افزایشی و بی‌اثر روی آلارم‌های موجود که فیلدِ line ندارند.
    """
    ln = cond.get("line")
    if not isinstance(ln, dict):
        return None
    try:
        t1 = float(ln["t1"]); p1 = float(ln["p1"])
        t2 = float(ln["t2"]); p2 = float(ln["p2"])
    except (KeyError, TypeError, ValueError):
        return None
    if t2 == t1:
        return p2
    return p1 + (p2 - p1) * (now_dt.timestamp() - t1) / (t2 - t1)


async def _db_candles(symbol: str, tf: str, limit: int) -> list[dict]:
    """کندل‌های فارکس/فلز از جدولِ candles با سشنِ تازه — بازتولیدِ کوچکِ academy._chart_rows.

    چرا import نمی‌کنیم: academy.py ماژولِ سنگینِ routeِ FastAPI است و ورکرِ Celery نباید
    به آن گره بخورد. حدِ پایینِ زمانیِ «درون‌خطی» عمداً همان ترفندِ _chart_rows است: بدونِ
    آن TimescaleDB در زمانِ پلن chunkها را هرس نمی‌کند و روی ۷۰۰+ chunk قفل می‌گیرد
    («out of shared memory / max_locks_per_transaction»). ضریبِ ۴ برای آخرهفته/شکافِ داده.
    """
    from sqlalchemy import text

    from src.bazaarnama.alert_indicators import tf_seconds

    n = max(1, int(limit))
    bs = tf_seconds(tf, 0)
    conds = "symbol=:s AND timeframe=:t "
    if bs:
        upper = int(datetime.now(timezone.utc).timestamp())
        conds += f"AND time >= to_timestamp({upper - n * bs * 4}) "
    q = ("SELECT time,open,high,low,close,COALESCE(volume,0) FROM candles WHERE "
         + conds + "ORDER BY time DESC LIMIT :n")
    async with async_session_factory() as db:
        rows = (await db.execute(text(q), {"s": symbol, "t": tf, "n": n})).fetchall()
    out = []
    for r in reversed(rows):
        try:
            ts = int(r[0].timestamp())
        except Exception:  # noqa: BLE001
            ts = 0
        out.append({"t": ts, "o": float(r[1]), "h": float(r[2]), "l": float(r[3]),
                    "c": float(r[4]), "v": float(r[5] or 0)})
    return out


async def _alert_candles(symbol: str, tf: str, limit: int) -> list[dict]:
    """کندل‌های اخیرِ یک نماد با همان مسیریابیِ REST چارت (academy.chart_data).

    _crypto_feed/_stock_feed توابعِ سادهٔ async بدونِ وابستگیِ FastAPI اند، پس importشان
    در ورکر بی‌خطر است؛ ensure_pairs لازم نیست چون مسیریابیِ کریپتو به *USDT ختم می‌شود.
    """
    from src.api.routes._crypto_feed import crypto_klines, is_crypto
    from src.api.routes._stock_feed import is_stock, stock_klines

    if is_crypto(symbol):
        return await crypto_klines(symbol, tf, limit=limit)
    if is_stock(symbol):
        return await stock_klines(symbol, tf, limit=limit)
    return await _db_candles(symbol, tf, limit)


async def _alert_indicator_value(a, ind: dict, now_dt: datetime, kcache: dict):
    """(مقدارِ اندیکاتورِ آلارم روی آخرین کندلِ بسته، برچسبی مثلِ «RSI(14)»).

    kcache در طولِ یک تیک نتیجهٔ fetch را بینِ آلارم‌های هم‌نماد/هم‌تایم‌فریم به‌اشتراک
    می‌گذارد تا N آلارم روی BTCUSDT/H1 فقط یک درخواستِ کندل بزند؛ مقدار (تعدادِ
    درخواستی، کندل‌ها) است تا آلارمی با پنجرهٔ بلندتر کشِ کوتاه را دوباره بگیرد.
    """
    from src.bazaarnama.alert_indicators import bars_needed, drop_forming, indicator_last

    tf = (a.tf or "H1").upper()
    need = bars_needed(ind)
    key = (a.symbol, tf)
    got = kcache.get(key)
    if got is None or got[0] < need:
        candles = await _alert_candles(a.symbol, tf, need)
        kcache[key] = (need, candles)
    else:
        candles = got[1]
    # فقط کندل‌های بسته — مقدارِ اندیکاتور روی کندلِ باز با هر تیک عوض می‌شود و cross را خراب می‌کند.
    closed = drop_forming(candles, tf, now_dt.timestamp())
    return indicator_last(closed, ind)


async def _check() -> dict:
    from src.core.redis_client import redis_client

    # در فرآیندِ celery، redis_client هنوز متصل نیست → اتصالِ تنبل
    try:
        if redis_client.client is None:
            await redis_client.connect()
    except Exception:  # noqa: BLE001
        try:
            await redis_client.connect()
        except Exception:  # noqa: BLE001
            return {"checked": 0, "triggered": 0, "error": "redis_unavailable"}

    now = datetime.now(timezone.utc)
    prices: dict[str, float | None] = {}
    kcache: dict = {}  # کشِ کندلِ یک تیک برای آلارم‌های اندیکاتور: (symbol, tf) → (need, candles)
    triggered = 0

    async with async_session_factory() as s:
        alerts = (await s.execute(select(BnAlert).where(BnAlert.active.is_(True)))).scalars().all()
        for a in alerts:
            sym = a.symbol
            if sym not in prices:
                try:
                    p = await redis_client.get_price(sym)
                except Exception:  # noqa: BLE001
                    p = None
                if p:
                    bid = float(p.get("bid") or p.get("price") or 0)
                    ask = float(p.get("ask") or bid or 0)
                    prices[sym] = (bid + ask) / 2 if (bid and ask) else (bid or ask)
                else:
                    prices[sym] = None
            mid = prices[sym]
            if mid is None:
                continue
            cond = a.condition or {}
            op = cond.get("op")
            # انقضا (Expiration)
            exp = cond.get("expiry")
            if exp:
                try:
                    if now >= datetime.fromisoformat(str(exp).replace("Z", "+00:00")):
                        a.active = False
                        continue
                except (ValueError, TypeError):
                    pass
            try:
                val = float(cond.get("value") or 0)
            except (TypeError, ValueError):
                continue
            # سطحِ خطِ شیب‌دار (اگر آلارم لنگرهای line داشته باشد) — None برای آلارم‌های معمولی.
            line_lvl = _line_level(cond, now)
            # قیمتِ قبلی برای شرط‌های تقاطع/درصد
            prev = None
            try:
                pv = await redis_client.get(f"bn:alertprev:{a.id}")
                prev = float(pv) if pv is not None else None
            except Exception:  # noqa: BLE001
                prev = None
            try:
                await redis_client.set(f"bn:alertprev:{a.id}", str(mid), ex=86400)
            except Exception:  # noqa: BLE001
                pass

            # ── آلارمِ اندیکاتور (cond.type == "indicator") — مقدارِ اندیکاتور جای قیمت می‌نشیند ──
            # افزایشی: هر cond بدونِ این type دقیقاً مثلِ قبل رفتار می‌کند.
            ind_cfg = cond.get("ind") if cond.get("type") == "indicator" else None
            ind_now = ind_prev = None
            ind_label = ""
            if cond.get("type") == "indicator" and not isinstance(ind_cfg, dict):
                continue  # type=indicator ولی ind غایب/خراب — نباید به‌غلط مثلِ آلارمِ قیمتی ارزیابی شود
            if isinstance(ind_cfg, dict):
                # هر خطای فید/محاسبه فقط همین آلارم را در این تیک رد می‌کند، نه کلِ حلقه را.
                try:
                    ind_now, ind_label = await _alert_indicator_value(a, ind_cfg, now, kcache)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("bn_alert_ind_error", alert_id=a.id, symbol=sym, error=str(exc))
                    continue
                if ind_now is None:
                    continue  # دادهٔ کندل/دورهٔ کافی نیست — تیکِ بعد دوباره
                # مقدارِ ارزیابیِ قبلی برای شرط‌های لبه‌ای (cross روی خودِ اندیکاتور)
                try:
                    pv = await redis_client.get(f"bn:alertprevind:{a.id}")
                    ind_prev = float(pv) if pv is not None else None
                except Exception:  # noqa: BLE001
                    ind_prev = None
                try:
                    # ۳ روز (نه ۱ روزِ قیمت): بینِ دو کندلِ بستهٔ H4/D1 ساعت‌ها فاصله است و
                    # پریدنِ prev یعنی cross بی‌صدا گم می‌شود.
                    await redis_client.set(f"bn:alertprevind:{a.id}", str(ind_now), ex=86400 * 3)
                except Exception:  # noqa: BLE001
                    pass

            def _one(o, v, cur=mid, pre=prev):
                # cur/pre پیش‌فرض قیمت‌اند؛ آلارمِ اندیکاتور همین سمانتیک را با ind_now/ind_prev صدا می‌زند.
                if o == "above":
                    return cur >= v
                if o == "below":
                    return cur <= v
                if o == "cross_up":
                    return pre is not None and pre < v <= cur
                if o == "cross_down":
                    return pre is not None and pre > v >= cur
                if o == "cross":
                    return pre is not None and ((pre < v <= cur) or (pre > v >= cur))
                if o in ("pct_up", "pct_down") and pre:
                    chg = (cur - pre) / pre * 100.0
                    return (o == "pct_up" and chg >= v) or (o == "pct_down" and chg <= -v)
                # حرکتِ مطلق (Moving Up/Down by value مثلِ TradingView): قیمت از تیکِ قبل به‌اندازهٔ v حرکت کند.
                if o == "move_up_value":
                    return pre is not None and (cur - pre) >= v
                if o == "move_down_value":
                    return pre is not None and (pre - cur) >= v
                # کانال (Entering/Exiting Channel مثلِ TV): مرزها lo/hi از خودِ cond؛ لبه‌ای (ورود/خروج نسبت به تیکِ قبل).
                if o in ("enter_channel", "exit_channel"):
                    if pre is None:
                        return False
                    lo = float(cond.get("lo") or 0.0)
                    hi = float(cond.get("hi") or 0.0)
                    if lo > hi:
                        lo, hi = hi, lo
                    inside_now = lo <= cur <= hi
                    inside_prev = lo <= pre <= hi
                    if o == "enter_channel":
                        return inside_now and not inside_prev
                    return (not inside_now) and inside_prev
                return False
            # آلارمِ چندشرطی (AND): اگر conditions آرایه باشد، همهٔ شرط‌ها باید با هم برقرار شوند
            conds = cond.get("conditions")
            if ind_cfg is not None:
                ikey = str(ind_cfg.get("key") or "").lower()
                if op in ("price_cross_up", "price_cross_down") and ikey in ("sma", "ema"):
                    # عبورِ «قیمت» از خطِ MA: مقایسهٔ mid/prev با سطحِ MA — نه مقدارِ اندیکاتور با value.
                    hit = _one("cross_up" if op == "price_cross_up" else "cross_down", ind_now)
                else:
                    hit = _one(op, val, cur=ind_now, pre=ind_prev)
            elif isinstance(conds, list) and conds:
                try:
                    hit = all(_one(c.get("op"), float(c.get("value") or 0)) for c in conds)
                except (TypeError, ValueError):
                    hit = False
            else:
                hit = _one(op, line_lvl if line_lvl is not None else val)
            if not hit:
                continue

            trigger = cond.get("trigger") or "recurring"  # once | recurring
            # کول‌داونِ سفارشی (cond.cooldown_s) — پیش‌تر ذخیره می‌شد و نادیده گرفته می‌شد،
            # پس گزینهٔ «هربار با کول‌داونِ N دقیقه» در رابط همیشه ۱ ساعت عمل می‌کرد.
            try:
                cd = int(cond.get("cooldown_s") or _COOLDOWN)
            except (TypeError, ValueError):
                cd = _COOLDOWN
            cd = max(0, cd)
            if trigger == "recurring" and a.last_triggered_at and (now - a.last_triggered_at).total_seconds() < cd:
                continue

            a.last_triggered_at = now
            triggered += 1
            if trigger == "once":
                a.active = False

            # پیامِ سفارشی با متغیرها؛ {ind} → مثلاً «RSI(14)=71.3» (فقط برای آلارمِ اندیکاتور مقدار دارد)
            ind_txt = f"{ind_label}={ind_now:.6g}" if ind_now is not None else ""
            _default = ("آلارمِ {symbol}: شرط برقرار شد ({ind} — قیمت {price})" if ind_txt
                        else "آلارمِ {symbol}: شرط برقرار شد (قیمت {price})")
            tmpl = cond.get("message") or _default
            msg = (str(tmpl).replace("{symbol}", sym).replace("{price}", f"{mid:.5f}")
                   .replace("{value}", f"{val:g}").replace("{tf}", a.tf or "")
                   .replace("{ind}", ind_txt))
            logger.info("bn_alert_triggered", alert_id=a.id, symbol=sym, op=op, value=val, price=mid)
            if cond.get("telegram"):
                await _send_telegram(f"🔔 {msg}")
            if cond.get("webhook"):
                await _send_webhook(str(cond["webhook"]), {
                    "alert_id": a.id, "symbol": sym, "price": mid, "op": op,
                    "value": val, "tf": a.tf or "", "message": msg,
                    "triggered_at": now.isoformat(),
                })
        if triggered or any((c.condition or {}).get("expiry") for c in alerts):
            await s.commit()

    return {"checked": len(alerts), "triggered": triggered}


async def _send_webhook(url: str, payload: dict) -> None:
    """ارسالِ هشدار به وبهوکِ کاربر.

    پیش‌تر cond["webhook"] ذخیره می‌شد و هرگز ارسال نمی‌شد — رابط کانالی را وعده
    می‌داد که وجود نداشت.

    امنیت: URL را کاربر می‌دهد، پس این یک سطحِ SSRF است. فقط https، و میزبان‌های
    داخلی/لوپ‌بک/لینک‌لوکال رد می‌شوند تا نتوان از سرور به شبکهٔ داخلی درخواست زد.
    """
    import ipaddress
    import socket
    from urllib.parse import urlparse

    import aiohttp

    try:
        u = urlparse(url)
        if u.scheme != "https" or not u.hostname:
            logger.warning("bn_alert_webhook_rejected", reason="scheme", url=url[:80])
            return
        # resolve و ردِ فضای آدرسِ خصوصی
        infos = await asyncio.get_running_loop().getaddrinfo(u.hostname, None)
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                logger.warning("bn_alert_webhook_rejected", reason="private_ip", host=u.hostname)
                return
    except (ValueError, socket.gaierror) as exc:
        logger.warning("bn_alert_webhook_rejected", reason="resolve", error=str(exc))
        return

    try:
        async with aiohttp.ClientSession() as sess:
            async with sess.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as r:
                if r.status >= 400:
                    logger.warning("bn_alert_webhook_status", status=r.status, url=url[:80])
    except Exception as exc:  # noqa: BLE001
        logger.warning("bn_alert_webhook_failed", error=str(exc), url=url[:80])


async def _send_telegram(text: str) -> None:
    """ارسالِ هشدار به تلگرام (چتِ پیکربندی‌شده)."""
    import os
    import aiohttp

    token = os.getenv("BN_ALERT_BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("BACKUP_BOT_TOKEN")
    chat = os.getenv("BN_ALERT_CHAT_ID") or os.getenv("BACKUP_CHAT_ID")
    if not token or not chat:
        return
    try:
        async with aiohttp.ClientSession() as sess:
            await sess.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat, "text": text},
                timeout=aiohttp.ClientTimeout(total=10),
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning("bn_alert_telegram_failed", error=str(exc))


@celery_app.task(name="src.bazaarnama.tasks.check_alerts")
def check_alerts() -> dict:
    """ارزیابیِ آلارم‌های بازارنما روی قیمتِ زنده (هر دقیقه)."""
    try:
        return _run(_check())
    except Exception as exc:  # noqa: BLE001
        logger.error("bn_alerts_error", error=str(exc))
        return {"error": str(exc)}


async def _check_signals() -> dict:
    """سیگنال‌های فعالِ AI را روی قیمتِ زنده چک می‌کند؛ برخوردِ TP/SL را ثبت و آلارم می‌دهد."""
    from datetime import datetime, timezone
    from src.core.database import BnAiSignal
    from src.core.redis_client import redis_client

    try:
        if redis_client.client is None:
            await redis_client.connect()
    except Exception:  # noqa: BLE001
        try:
            await redis_client.connect()
        except Exception:  # noqa: BLE001
            return {"checked": 0, "updated": 0, "error": "redis_unavailable"}

    prices: dict[str, float | None] = {}
    updated = 0
    async with async_session_factory() as s:
        sigs = (await s.execute(select(BnAiSignal).where(BnAiSignal.status == "active"))).scalars().all()
        for sg in sigs:
            sym = sg.symbol
            if sym not in prices:
                try:
                    p = await redis_client.get_price(sym)
                except Exception:  # noqa: BLE001
                    p = None
                if p:
                    bid = float(p.get("bid") or p.get("price") or 0)
                    ask = float(p.get("ask") or bid or 0)
                    prices[sym] = (bid + ask) / 2 if (bid and ask) else (bid or ask)
                else:
                    prices[sym] = None
            px = prices[sym]
            if px is None:           # بازار بسته یا قیمتِ زنده نیست
                continue
            sg.last_price = px
            d, sl = sg.direction, float(sg.sl)
            tps = [("tp1", sg.tp1), ("tp2", sg.tp2), ("tp3", sg.tp3)]
            hit = None
            if d == "buy":
                if px <= sl:
                    hit, sg.status = "sl", "sl"
                else:
                    for name, v in tps:
                        if v is not None and px >= float(v):
                            hit = name
                    if hit == "tp3":
                        sg.status = "tp3"
            else:
                if px >= sl:
                    hit, sg.status = "sl", "sl"
                else:
                    for name, v in tps:
                        if v is not None and px <= float(v):
                            hit = name
                    if hit == "tp3":
                        sg.status = "tp3"
            if hit and hit != sg.hit:
                sg.hit = hit
                if hit == "sl" or hit == "tp3":
                    sg.closed_at = datetime.now(timezone.utc)
                updated += 1
                logger.info("ai_signal_hit", id=sg.id, symbol=sym, hit=hit, price=px)
        await s.commit()
    return {"checked": len(sigs), "updated": updated}


@celery_app.task(name="src.bazaarnama.tasks.check_ai_signals")
def check_ai_signals() -> dict:
    """ردیابیِ برخوردِ TP/SL سیگنال‌های AI روی قیمتِ زنده (هر دقیقه، مستقل از مرورگر)."""
    try:
        return _run(_check_signals())
    except Exception as exc:  # noqa: BLE001
        logger.error("ai_signals_check_error", error=str(exc))
        return {"error": str(exc)}
