"""
بازارنما — موتورِ آلارمِ سمتِ‌سرور.

تسکِ Celery که هر دقیقه آلارم‌های فعال را روی قیمتِ زندهٔ Redis (همان تیک‌های
data-feed) ارزیابی می‌کند — مستقل از باز بودنِ مرورگر. هنگامِ برخورد،
`last_triggered_at` ست می‌شود (با کول‌داونِ ۱ ساعته) تا فرانت نشانِ «رخ داد» بدهد.
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
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


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

            def _one(o, v):
                if o == "above":
                    return mid >= v
                if o == "below":
                    return mid <= v
                if o == "cross_up":
                    return prev is not None and prev < v <= mid
                if o == "cross_down":
                    return prev is not None and prev > v >= mid
                if o == "cross":
                    return prev is not None and ((prev < v <= mid) or (prev > v >= mid))
                if o in ("pct_up", "pct_down") and prev:
                    chg = (mid - prev) / prev * 100.0
                    return (o == "pct_up" and chg >= v) or (o == "pct_down" and chg <= -v)
                return False
            # آلارمِ چندشرطی (AND): اگر conditions آرایه باشد، همهٔ شرط‌ها باید با هم برقرار شوند
            conds = cond.get("conditions")
            if isinstance(conds, list) and conds:
                try:
                    hit = all(_one(c.get("op"), float(c.get("value") or 0)) for c in conds)
                except (TypeError, ValueError):
                    hit = False
            else:
                hit = _one(op, val)
            if not hit:
                continue

            trigger = cond.get("trigger") or "recurring"  # once | recurring
            if trigger == "recurring" and a.last_triggered_at and (now - a.last_triggered_at).total_seconds() < _COOLDOWN:
                continue

            a.last_triggered_at = now
            triggered += 1
            if trigger == "once":
                a.active = False

            # پیامِ سفارشی با متغیرها
            tmpl = cond.get("message") or "آلارمِ {symbol}: شرط برقرار شد (قیمت {price})"
            msg = (str(tmpl).replace("{symbol}", sym).replace("{price}", f"{mid:.5f}")
                   .replace("{value}", f"{val:g}").replace("{tf}", a.tf or ""))
            logger.info("bn_alert_triggered", alert_id=a.id, symbol=sym, op=op, value=val, price=mid)
            if cond.get("telegram"):
                await _send_telegram(f"🔔 {msg}")
        if triggered or any((c.condition or {}).get("expiry") for c in alerts):
            await s.commit()

    return {"checked": len(alerts), "triggered": triggered}


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
