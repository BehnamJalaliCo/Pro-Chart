"""
بازارنما — APIِ سرورِ تریدینگ‌ویوِ ایرانی (درونِ آکادمی).

دادهٔ کندل/اندیکاتور از مسیرهای موجودِ academy می‌آید؛ این ماژول مالکیتِ
لِی‌اوت‌ها، اسکریپت‌های «نمااسکریپت»، واچ‌لیست‌ها و آلارم‌های هر دانشجو را مدیریت می‌کند.
همه پشتِ احرازِ دانشجو (scope=academy).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import (
    _chart_rows,
    _current_price,
    _ema_list,
    _effective_tier,
    _ind_atr,
    _rsi_list,
    current_student,
)
from src.core.database import (
    AcademyStudent,
    BnAiSignal,
    BnAlert,
    BnLayout,
    BnScript,
    BnWatchlist,
)
from src.core.logger import get_logger
from src.core.security import create_access_token, verify_access_token

router = APIRouter()
logger = get_logger(__name__)

# سهمیهٔ روزانهٔ سیگنالِ AI بر اساسِ تیر
_AI_QUOTA = {"vip": 2, "premium": 5}

# قابلیت‌های پرمیومِ بازارنما (کاربرِ عادی/free قفل است): اسکریپت‌نویسی، هوشِ مصنوعی،
# و ترید روی چارت (البنک/وان‌رویال). فعال‌سازی: ثبت‌نام → واریز → تأییدِ مدیر (tier=vip/premium).
_PREMIUM_MSG = "این قابلیت ویژهٔ کاربرانِ پرمیومِ بازارنماست؛ پس از ثبت‌نام، واریز و تأییدِ مدیر فعال می‌شود."


def _require_premium(st: "AcademyStudent") -> None:
    if _effective_tier(st) not in ("vip", "premium"):
        raise HTTPException(status_code=403,
                            detail={"msg": _PREMIUM_MSG, "premium_required": True})


def _now():
    return datetime.now(timezone.utc)


# ─────────────────────────── قیمتِ زنده (Real-time) ───────────────────────────

@router.get("/referral-link")
async def referral_link(st: AcademyStudent = Depends(current_student)):
    """لینکِ رفرالِ مناسبِ نوعِ حساب — کریپتو→LBank، فارکس→وان‌رویال.
    شرطِ تریدِ واقعی: کاربر باید با همین لینک زیرمجموعهٔ ما ثبت‌نام کند."""
    import os as _o
    at = getattr(st, "account_type", None)
    if at == "broker":
        return {"account_type": "broker", "broker": "OneRoyal",
                "url": _o.getenv("BN_ONEROYAL_REFERRAL_LINK", "https://www.oneroyal.com")}
    return {"account_type": "crypto", "broker": "LBank",
            "url": _o.getenv("LBANK_REFERRAL_LINK", "https://www.lbank.com"),
            "min_deposit": _o.getenv("LBANK_REFERRAL_MIN_DEPOSIT", "")}


@router.get("/prices")
async def live_prices(
    symbols: str = "",
    st: AcademyStudent = Depends(current_student),
):
    """
    قیمتِ زندهٔ لحظه‌ای از Redis (همان تیک‌هایی که data-feed منتشر می‌کند).
    در ساعاتِ بستهٔ بازار خالی برمی‌گردد → فرانت «بازار بسته» نشان می‌دهد.
    """
    from src.core.redis_client import redis_client

    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()][:40]
    out = {}
    for s in syms:
        try:
            p = await redis_client.get_price(s)
        except Exception:  # noqa: BLE001
            p = None
        if not p:
            continue
        bid = float(p.get("bid") or p.get("price") or 0)
        ask = float(p.get("ask") or bid or 0)
        if not bid and not ask:
            continue
        mid = (bid + ask) / 2 if (bid and ask) else (bid or ask)
        out[s] = {"bid": bid, "ask": ask, "mid": round(mid, 8), "ts": p.get("ts") or p.get("timestamp")}
    # کریپتو (LBank) → قیمتِ لحظه‌ایِ مستقلِ دینامیک از LBank (۲۴/۷، بدونِ کلید/وایت‌لیست)
    try:
        from src.api.routes._crypto_feed import crypto_prices, is_crypto, ensure_pairs
        await ensure_pairs()
        crypto_syms = [s for s in syms if is_crypto(s) and s not in out]
        if crypto_syms:
            out.update(await crypto_prices(crypto_syms))
    except Exception:  # noqa: BLE001
        pass
    return {"prices": out, "market_open": bool(out), "server_time": _now().isoformat()}


# ─────────────────── سفارش از روی چارت (trade-from-chart) ───────────────────
# فاز ۱+۲: اعتبارسنجی + R/R + پیش‌نمایش.  فاز ۳+۴: اجرای زنده روی حسابِ اتوترِیدِ مَستر.
# اجرای زنده دو گاردِ هم‌زمان دارد:
#   ۱) فلگِ سرور  BN_CHART_TRADING_LIVE=1
#   ۲) کلیدِ مالک  هدرِ X-BN-Owner-Key == BN_OWNER_KEY  (فقط مرورگرِ خودِ مالک داردش)
# سفارش به سرورِ اصلی (BN_MAIN_API) → /ea/manual-open فوروارد می‌شود که سیگنالِ
# signal_type=="manual" می‌سازد؛ آن سیگنال در /ea/signals فقط به مَستر سرو می‌شود و
# هرگز روی حساب‌های کپیِ کلاینت‌ها باز نمی‌شود (ایزولاسیونِ تست‌شده).

@router.post("/manual-order")
async def manual_order(
    request: Request,
    side: str = Body(..., embed=True),
    symbol: str = Body(..., embed=True),
    entry: float = Body(..., embed=True),
    sl: float = Body(..., embed=True),
    tp: float = Body(..., embed=True),
    st: AcademyStudent = Depends(current_student),
):
    """سفارشِ دستی از روی چارت — اعتبارسنجی + R/R + (اگر مالک و زنده) اجرا روی مَستر."""
    import os as _os

    side = (side or "").lower()
    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="جهتِ سفارش نامعتبر است.")
    ok = (side == "buy" and sl < entry < tp) or (side == "sell" and tp < entry < sl)
    if not ok:
        raise HTTPException(status_code=400, detail="ترتیبِ ورود/حدضرر/حدسود برای این جهت نامعتبر است.")
    risk = abs(entry - sl)
    reward = abs(tp - entry)
    rr = round(reward / risk, 2) if risk else 0.0
    sym = symbol.upper()

    live = _os.getenv("BN_CHART_TRADING_LIVE") == "1"
    owner_key = _os.getenv("BN_OWNER_KEY", "")
    req_key = request.headers.get("X-BN-Owner-Key", "")
    import hmac as _hmac
    is_owner = bool(owner_key) and bool(req_key) and _hmac.compare_digest(req_key, owner_key)

    # ترید روی چارت قابلیتِ پرمیوم است (کاربرِ free قفل). مالک با owner-key همیشه مجاز است.
    if not is_owner:
        _require_premium(st)

    # اجرای زنده فقط برای مالک (با کلید) و وقتی فلگ روشن است؛ بقیه → پیش‌نمایش
    if live and is_owner:
        main = _os.getenv("BN_MAIN_API", "https://fx.trade-future.ir/api").rstrip("/")
        bridge = _os.getenv("BN_BRIDGE_TOKEN", "")
        try:
            import httpx
            async with httpx.AsyncClient(timeout=8.0) as cli:
                r = await cli.post(
                    f"{main}/ea/manual-open",
                    json={"side": side, "symbol": sym, "entry": entry, "sl": sl, "tp1": tp},
                    headers={"X-Bridge-Token": bridge},
                )
            if r.status_code == 200:
                d = r.json()
                return {
                    "placed": True, "preview": False, "id": d.get("id"),
                    "side": side, "symbol": sym, "entry": entry, "sl": sl, "tp": tp, "rr": rr,
                    "reason": "سفارش روی حسابِ اتوترِیدِ شما (مَستر) ثبت شد.",
                }
            detail = "اجرای سفارش ناموفق بود."
            try:
                detail = r.json().get("detail", detail)
            except Exception:  # noqa: BLE001
                pass
            raise HTTPException(status_code=502, detail=detail)
        except HTTPException:
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=502, detail=f"ارتباط با سرورِ اجرا برقرار نشد: {exc}")

    # پیش‌نمایش (همهٔ کاربرانِ غیرِمالک، یا وقتی اجرای زنده خاموش است)
    return {
        "placed": False, "preview": True,
        "side": side, "symbol": sym, "entry": entry, "sl": sl, "tp": tp, "rr": rr,
        "reason": "حالتِ پیش‌نمایش — اعتبارسنجی انجام شد." if not live
        else "حالتِ پیش‌نمایش — این سفارش روی حسابِ معاملاتی اجرا نمی‌شود.",
    }


# ─────────────────────────── Layouts ───────────────────────────

@router.get("/layouts")
async def list_layouts(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BnLayout).where(BnLayout.student_id == st.id).order_by(BnLayout.updated_at.desc()))
    return [{"id": l.id, "name": l.name, "is_default": l.is_default,
             "updated_at": l.updated_at.isoformat() if l.updated_at else None} for l in res.scalars().all()]


@router.get("/layouts/{layout_id}")
async def get_layout(layout_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await db.get(BnLayout, layout_id)
    if not l or l.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    return {"id": l.id, "name": l.name, "is_default": l.is_default, "data": l.data}


@router.post("/layouts")
async def save_layout(payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    name = (payload.get("name") or "چیدمان").strip()[:120]
    data = payload.get("data") or {}
    lid = payload.get("id")
    if lid:
        l = await db.get(BnLayout, int(lid))
        if not l or l.student_id != st.id:
            raise HTTPException(404, "یافت نشد")
        l.name, l.data = name, data
    else:
        l = BnLayout(student_id=st.id, name=name, data=data)
        db.add(l)
    if payload.get("is_default"):
        # فقط یک پیش‌فرض
        res = await db.execute(select(BnLayout).where(BnLayout.student_id == st.id))
        for other in res.scalars().all():
            other.is_default = False
        l.is_default = True
    await db.commit()
    return {"ok": True, "id": l.id}


@router.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await db.get(BnLayout, layout_id)
    if not l or l.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    await db.delete(l)
    await db.commit()
    return {"ok": True}


# ─────────────────────────── Scripts (نمااسکریپت) ───────────────────────────

_STARTER = """// نمااسکریپت — نمونه: کراسِ HMA
study("HMA Cross", overlay=true)
fast = ta.hma(close, 9)
slow = ta.hma(close, 21)
plot(fast, "HMA سریع", color.blue)
plot(slow, "HMA کند", color.orange)
buy  = crossover(fast, slow)
sell = crossunder(fast, slow)
plotshape(buy,  "خرید",  shape.up,   color.green)
plotshape(sell, "فروش",  shape.down, color.red)
alertcondition(buy,  "سیگنالِ خرید")
alertcondition(sell, "سیگنالِ فروش")
"""


@router.get("/scripts")
async def list_scripts(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BnScript).where(BnScript.student_id == st.id).order_by(BnScript.updated_at.desc()))
    items = [{"id": s.id, "name": s.name, "kind": s.kind, "enabled": s.enabled,
              "updated_at": s.updated_at.isoformat() if s.updated_at else None} for s in res.scalars().all()]
    return {"scripts": items, "starter": _STARTER}


@router.get("/scripts/{script_id}")
async def get_script(script_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    s = await db.get(BnScript, script_id)
    if not s or s.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    return {"id": s.id, "name": s.name, "kind": s.kind, "source": s.source, "enabled": s.enabled}


@router.post("/scripts")
async def save_script(payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    _require_premium(st)  # اسکریپت‌نویسی/اسکریپتِ خودکار قابلیتِ پرمیوم است
    name = (payload.get("name") or "اسکریپت").strip()[:120]
    source = payload.get("source") or ""
    kind = payload.get("kind") if payload.get("kind") in ("indicator", "strategy") else "indicator"
    if len(source) > 40000:
        raise HTTPException(400, "اسکریپت بیش از حد بزرگ است.")
    sid = payload.get("id")
    if sid:
        s = await db.get(BnScript, int(sid))
        if not s or s.student_id != st.id:
            raise HTTPException(404, "یافت نشد")
        s.name, s.source, s.kind = name, source, kind
    else:
        # سقفِ ۵۰ اسکریپت per student
        cnt = len((await db.execute(select(BnScript.id).where(BnScript.student_id == st.id))).all())
        if cnt >= 50:
            raise HTTPException(429, "به سقفِ اسکریپت‌ها رسیدی.")
        s = BnScript(student_id=st.id, name=name, source=source, kind=kind)
        db.add(s)
    await db.commit()
    return {"ok": True, "id": s.id}


@router.delete("/scripts/{script_id}")
async def delete_script(script_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    s = await db.get(BnScript, script_id)
    if not s or s.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    await db.delete(s)
    await db.commit()
    return {"ok": True}


# ─────────────────────────── Watchlist ───────────────────────────

async def _get_or_make_wl(st, db) -> BnWatchlist:
    wl = (await db.execute(select(BnWatchlist).where(BnWatchlist.student_id == st.id).limit(1))).scalar_one_or_none()
    if not wl:
        wl = BnWatchlist(student_id=st.id, name="پیش‌فرض",
                         symbols=["EURUSD", "XAUUSD", "GBPUSD", "USDJPY", "BTCUSD"])
        db.add(wl)
        await db.commit()
    return wl


@router.get("/watchlist")
async def get_watchlist(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    wl = await _get_or_make_wl(st, db)
    return {"id": wl.id, "name": wl.name, "symbols": wl.symbols or []}


@router.put("/watchlist")
async def set_watchlist(payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    wl = await _get_or_make_wl(st, db)
    syms = payload.get("symbols")
    if isinstance(syms, list):
        wl.symbols = [str(s).upper()[:20] for s in syms][:50]
    await db.commit()
    return {"ok": True, "symbols": wl.symbols}


# ─────────────────────────── Alerts ───────────────────────────

@router.get("/alerts")
async def list_alerts(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BnAlert).where(BnAlert.student_id == st.id).order_by(BnAlert.created_at.desc()))
    return [{"id": a.id, "symbol": a.symbol, "tf": a.tf, "name": a.name, "condition": a.condition,
             "active": a.active, "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None}
            for a in res.scalars().all()]


@router.post("/alerts")
async def create_alert(payload: dict = Body(...), st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    cond = payload.get("condition") or {}
    if not cond:
        raise HTTPException(400, "شرطِ آلارم لازم است.")
    a = BnAlert(student_id=st.id, symbol=(payload.get("symbol") or "EURUSD").upper()[:20],
                tf=(payload.get("tf") or "H1")[:8], name=(payload.get("name") or "")[:160] or None,
                condition=cond, active=True)
    db.add(a)
    await db.commit()
    return {"ok": True, "id": a.id}


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    a = await db.get(BnAlert, alert_id)
    if not a or a.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    await db.delete(a)
    await db.commit()
    return {"ok": True}


# ─────────────────────────── سیگنالِ لحظه‌ایِ AI ───────────────────────────

def _rnd(p: float) -> float:
    a = abs(p)
    d = 2 if a >= 100 else 3 if a >= 10 else 5
    return round(p, d)


def _last(arr):
    for v in reversed(arr or []):
        if v is not None:
            return v
    return None


async def _ai_used_today(db, sid: int) -> int:
    start = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    rows = (await db.execute(select(BnAiSignal.id).where(
        BnAiSignal.student_id == sid, BnAiSignal.created_at >= start))).all()
    return len(rows)


def _sig_dict(s: BnAiSignal) -> dict:
    f = lambda x: float(x) if x is not None else None  # noqa: E731
    return {"id": s.id, "symbol": s.symbol, "tf": s.tf, "direction": s.direction,
            "entry": f(s.entry), "sl": f(s.sl), "tp1": f(s.tp1), "tp2": f(s.tp2), "tp3": f(s.tp3),
            "confidence": s.confidence, "reason": s.reason, "status": s.status, "hit": s.hit,
            "created_at": s.created_at.isoformat() if s.created_at else None}


@router.get("/ai-signal/quota")
async def ai_quota(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    tier = _effective_tier(st)
    limit = _AI_QUOTA.get(tier, 0)
    used = await _ai_used_today(db, st.id) if limit else 0
    return {"tier": tier, "limit": limit, "used": used, "remaining": max(0, limit - used)}


@router.get("/ai-signal/active")
async def ai_active(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(BnAiSignal).where(BnAiSignal.student_id == st.id,
                                                    BnAiSignal.status != "deleted")
                           .order_by(BnAiSignal.created_at.desc()).limit(10))
    return [_sig_dict(s) for s in res.scalars().all()]


@router.post("/ai-signal")
async def ai_signal(payload: dict = Body(...), st: AcademyStudent = Depends(current_student),
                    db: AsyncSession = Depends(get_db)):
    """ستاپِ کاملِ AI در تایم‌فریمِ کاربر — ترکیبِ همگراییِ تکنیکال + هوشِ مصنوعی، SL/TP مبتنی بر ATR."""
    _require_premium(st)  # سیگنالِ AI قابلیتِ پرمیوم است (free → مودالِ ارتقاء)
    tier = _effective_tier(st)
    limit = _AI_QUOTA.get(tier, 0)
    if not limit:
        raise HTTPException(403, {"msg": "سیگنالِ AI ویژهٔ اعضای پرمیوم است.", "premium_required": True})
    used = await _ai_used_today(db, st.id)
    if used >= limit:
        raise HTTPException(429, f"سهمیهٔ امروزِ سیگنالِ AI ({limit}) تمام شد؛ فردا دوباره.")

    symbol = (payload.get("symbol") or "EURUSD").upper()[:20]
    tf = (payload.get("tf") or "H1")[:8]
    candles = await _chart_rows(db, symbol, tf, limit=220)
    if len(candles) < 60:
        raise HTTPException(400, "دادهٔ کافی برای این نماد/تایم‌فریم نیست.")

    closes = [c["c"] for c in candles]
    highs = [c["h"] for c in candles]
    lows = [c["l"] for c in candles]
    price = (await _current_price(db, symbol)) or closes[-1]
    atr = _last(_ind_atr(candles, 14).get("atr")) or (price * 0.002)
    rsi = _last(_rsi_list(closes, 14)) or 50.0
    ema20 = _last(_ema_list(closes, 20)) or price
    ema50 = _last(_ema_list(closes, 50)) or price
    ema200 = _last(_ema_list(closes, 200)) or price
    sw_hi = max(highs[-20:]); sw_lo = min(lows[-20:])

    up = (ema20 > ema50) + (ema50 > ema200) + (rsi > 50) + (price > ema20)
    dn = (ema20 < ema50) + (ema50 < ema200) + (rsi < 50) + (price < ema20)
    tech_dir = "buy" if up >= 3 else "sell" if dn >= 3 else None
    conf_base = 50 + 9 * max(up, dn)

    # هوشِ مصنوعیِ پروژه (Claude) — جهت/اطمینان/دلیل (با fallback به تکنیکال)
    ai_dir, ai_reason, ai_conf = None, "", None
    try:
        from src.llm.client import llm_client
        summary = (
            f"نماد {symbol} تایم‌فریم {tf}. قیمت {_rnd(price)}. "
            f"RSI14={rsi:.0f}. EMA20={_rnd(ema20)} EMA50={_rnd(ema50)} EMA200={_rnd(ema200)}. "
            f"ATR={_rnd(atr)}. سقفِ ۲۰کندل={_rnd(sw_hi)} کفِ ۲۰کندل={_rnd(sw_lo)}."
        )
        sysp = ("تو تحلیل‌گرِ ارشدِ فارکسی. فقط یک خطِ JSON برگردان بدونِ توضیح: "
                '{"direction":"buy|sell|none","confidence":<۰تا۱۰۰>,"reason":"یک جملهٔ فارسیِ کوتاهِ تحلیلی"}')
        out = await llm_client.complete(summary, system=sysp, cache_ttl=0)
        if out:
            import json as _json
            mt = re.search(r"\{.*\}", out, re.S)
            if mt:
                j = _json.loads(mt.group(0))
                ai_dir = (j.get("direction") or "").lower()
                ai_conf = int(j.get("confidence") or 0)
                ai_reason = str(j.get("reason") or "")[:400]
    except Exception as exc:  # noqa: BLE001
        logger.warning("ai_signal_llm_failed", error=str(exc))

    # تصمیمِ نهایی: ترجیحِ همگراییِ AI+تکنیکال → موفقیتِ بالاتر
    if ai_dir in ("buy", "sell"):
        direction = ai_dir
        agree = (tech_dir == ai_dir)
        confidence = max(40, min(93, conf_base + (12 if agree else -12) + (ai_conf - 60) // 5 if ai_conf else conf_base))
    elif tech_dir:
        direction = tech_dir
        confidence = max(40, min(85, conf_base))
        ai_reason = ai_reason or "بر اساسِ همگراییِ روند و مومنتوم."
    else:
        raise HTTPException(422, "بازار جهتِ روشنی ندارد؛ فعلاً ستاپِ معتبری نیست (سهمیه مصرف نشد).")

    risk = max(atr * 1.2, price * 0.0015)
    if direction == "buy":
        entry, sl = price, price - risk
        tp1, tp2, tp3 = price + risk, price + 2 * risk, price + 3 * risk
    else:
        entry, sl = price, price + risk
        tp1, tp2, tp3 = price - risk, price - 2 * risk, price - 3 * risk

    sig = BnAiSignal(student_id=st.id, symbol=symbol, tf=tf, direction=direction,
                     entry=_rnd(entry), sl=_rnd(sl), tp1=_rnd(tp1), tp2=_rnd(tp2), tp3=_rnd(tp3),
                     confidence=int(confidence), reason=ai_reason or "ستاپِ تکنیکال.", status="active",
                     last_price=_rnd(price))
    db.add(sig)
    await db.commit()
    logger.info("ai_signal_created", sid=st.id, symbol=symbol, tf=tf, dir=direction, conf=int(confidence))
    out = _sig_dict(sig)
    out["remaining"] = max(0, limit - used - 1)
    return out


@router.delete("/ai-signal/{sig_id}")
async def ai_delete(sig_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    s = await db.get(BnAiSignal, sig_id)
    if not s or s.student_id != st.id:
        raise HTTPException(404, "یافت نشد")
    # حذفِ نرم: ردیف می‌مانَد تا سهمیهٔ روزانه پس‌داده نشود (هزینهٔ تولید قبلاً صرف شده).
    # فقط از فهرست/چارت پنهان می‌شود؛ _ai_used_today همچنان آن را می‌شمارد.
    s.status = "deleted"
    await db.commit()
    return {"ok": True}


# ─────────────────────────── اخبارِ بازار (فارسی، بدونِ عکس) ───────────────────────────

@router.get("/news")
async def bn_news():
    """مهم‌ترین اخبارِ مؤثر بر بازار، ترجمه/خلاصه‌شده به فارسی توسطِ news-worker.

    عمومی است (دادهٔ کاربری ندارد). منبع: Redis کلیدِ bn:news. بدونِ عکس.
    """
    from src.core.redis_client import redis_client
    try:
        items = await redis_client.get_json("bn:news")
        return {"items": items or []}
    except Exception:
        return {"items": []}


@router.get("/calendar")
async def bn_calendar():
    """تقویمِ اقتصادیِ هفتگی (رویدادهای مؤثر بر بازار)، عنوان‌ها فارسی‌شده توسطِ news-worker.

    عمومی. منبع: Redis کلیدِ bn:calendar (دادهٔ واقعیِ faireconomy/ForexFactory).
    """
    from src.core.redis_client import redis_client
    try:
        items = await redis_client.get_json("bn:calendar")
        return {"items": items or []}
    except Exception:
        return {"items": []}


# ═══════════════════ پنلِ ادمینِ بازارنما (تأییدِ پرمیوم) ═══════════════════
# احراز با رمزِ BN_ADMIN_PASSWORD → توکنِ scope=bn_admin (۱۲ ساعت).
import os as _os_admin
import hmac as _hmac_admin


def _bn_admin_pw() -> str:
    return _os_admin.getenv("BN_ADMIN_PASSWORD", "")


async def current_bn_admin(authorization: str | None = Header(None)) -> bool:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="ورودِ ادمین لازم است.")
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if not p or p.get("scope") != "bn_admin":
        raise HTTPException(status_code=401, detail="توکنِ ادمینِ نامعتبر.")
    return True


@router.post("/admin/login")
async def bn_admin_login(password: str = Body(..., embed=True)):
    pw = _bn_admin_pw()
    if not pw or not _hmac_admin.compare_digest(password or "", pw):
        raise HTTPException(status_code=403, detail="رمزِ ادمین نادرست است.")
    token = create_access_token({"sub": "bn_admin", "scope": "bn_admin"}, expires_delta=timedelta(hours=12))
    return {"token": token}


@router.get("/admin/users")
async def bn_admin_users(q: str = "", _: bool = Depends(current_bn_admin),
                         db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(AcademyStudent).order_by(AcademyStudent.created_at.desc()).limit(1000)
    )).scalars().all()
    out, ql = [], (q or "").lower().strip()
    for s in rows:
        uname = s.username or ""
        if uname.startswith("student-9"):
            continue  # مهمان‌های موقت را نشان نده
        if ql and ql not in uname.lower() and ql not in (s.email or "").lower() and ql not in (s.full_name or "").lower():
            continue
        out.append({
            "id": s.id, "username": uname, "email": s.email, "full_name": s.full_name,
            "tier": s.tier, "status": s.status,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_login_at": s.last_login_at.isoformat() if s.last_login_at else None,
        })
    return {"users": out, "count": len(out)}


@router.post("/admin/set-tier")
async def bn_admin_set_tier(student_id: int = Body(..., embed=True),
                            tier: str = Body(..., embed=True),
                            days: int = Body(30, embed=True),
                            _: bool = Depends(current_bn_admin),
                            db: AsyncSession = Depends(get_db)):
    if tier not in ("free", "vip", "premium"):
        raise HTTPException(status_code=400, detail="تیرِ نامعتبر.")
    s = await db.get(AcademyStudent, int(student_id))
    if not s:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    s.tier = tier
    if tier == "free":
        s.expires_at = None
    elif days and int(days) > 0:
        s.expires_at = datetime.now(timezone.utc) + timedelta(days=int(days))
    await db.commit()
    logger.info("bn_admin_set_tier", sid=s.id, tier=tier, days=days)
    return {"ok": True, "id": s.id, "tier": s.tier,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None}


@router.post("/admin/set-status")
async def bn_admin_set_status(student_id: int = Body(..., embed=True),
                              status: str = Body(..., embed=True),
                              _: bool = Depends(current_bn_admin),
                              db: AsyncSession = Depends(get_db)):
    if status not in ("active", "disabled"):
        raise HTTPException(status_code=400, detail="وضعیتِ نامعتبر.")
    s = await db.get(AcademyStudent, int(student_id))
    if not s:
        raise HTTPException(status_code=404, detail="کاربر یافت نشد.")
    s.status = status
    await db.commit()
    return {"ok": True, "id": s.id, "status": s.status}


@router.post("/admin/set-referral")
async def bn_admin_set_referral(student_id: int = Body(..., embed=True),
                                kind: str = Body("lbank", embed=True),
                                verified: bool = Body(True, embed=True),
                                _: bool = Depends(current_bn_admin),
                                db: AsyncSession = Depends(get_db)):
    """override دستیِ تأییدِ رفرال توسطِ مدیر (وقتی API هنوز وایت‌لیست نشده)."""
    from src.core.database import BnExchangeAccount
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == int(student_id),
        BnExchangeAccount.kind == kind))).scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="حسابِ متصل یافت نشد.")
    a.referral_verified = bool(verified)
    a.note = "تأییدِ دستیِ مدیر" if verified else "ردِ رفرال توسطِ مدیر"
    await db.commit()
    return {"ok": True, "student_id": a.student_id, "kind": kind, "referral_verified": a.referral_verified}


@router.get("/admin/orders")
async def bn_admin_orders(status: str = "", market: str = "", limit: int = 100,
                          _: bool = Depends(current_bn_admin),
                          db: AsyncSession = Depends(get_db)):
    """سفارش‌های تریدِ واقعیِ بازارنما (کریپتو/فارکس) برای اشرافِ مدیر."""
    from src.core.database import BnOrder
    q = select(BnOrder).order_by(BnOrder.id.desc())
    if status:
        q = q.where(BnOrder.status == status)
    if market:
        q = q.where(BnOrder.market == market)
    rows = (await db.execute(q.limit(min(int(limit or 100), 500)))).scalars().all()
    sids = {r.student_id for r in rows}
    names = {}
    if sids:
        for s in (await db.execute(select(AcademyStudent).where(AcademyStudent.id.in_(sids)))).scalars().all():
            names[s.id] = s.username or s.email
    out = [{"id": r.id, "user": names.get(r.student_id), "market": r.market, "broker": r.broker,
            "account_ref": r.account_ref, "symbol": r.symbol, "side": r.side, "amount": r.amount,
            "price": r.price, "status": r.status, "broker_order_id": r.broker_order_id,
            "error": r.error, "created_at": r.created_at.isoformat() if r.created_at else None}
           for r in rows]
    return {"orders": out, "count": len(out)}


# ═══════════════ جایگاه‌های تبلیغاتیِ منو (#۱۴ — مدیریت‌پذیر از ادمین) ═══════════════
@router.get("/ads")
async def bn_ads():
    """جایگاه‌های تبلیغاتیِ منوی همبرگری (لوگوی صرافی/وان‌رویال + متن + لینک). از Redis."""
    from src.core.redis_client import redis_client
    import json as _j
    try:
        raw = await redis_client.client.get("bn:ads")
        return {"slots": _j.loads(raw) if raw else {}}
    except Exception:  # noqa: BLE001
        return {"slots": {}}


@router.post("/admin/ads")
async def bn_admin_set_ads(slot: str = Body(..., embed=True), logo: str = Body("", embed=True),
                           text: str = Body("", embed=True), link: str = Body("", embed=True),
                           active: bool = Body(True, embed=True), _: bool = Depends(current_bn_admin)):
    """تنظیمِ یک جایگاهِ تبلیغاتی توسطِ ادمین."""
    from src.core.redis_client import redis_client
    import json as _j
    try:
        raw = await redis_client.client.get("bn:ads"); d = _j.loads(raw) if raw else {}
    except Exception:  # noqa: BLE001
        d = {}
    if not active and slot in d:
        del d[slot]
    else:
        d[slot] = {"logo": logo, "text": text, "link": link, "active": True}
    await redis_client.client.set("bn:ads", _j.dumps(d))
    return {"ok": True, "slots": d}


# ═══════════════ پرداختِ خودکارِ اشتراک (USDT روی BSC) #222 ═══════════════
async def _notify_support(text: str) -> None:
    """پیامِ بهترین‌تلاش به پشتیبانی/ادمین در تلگرام."""
    import os as _o
    token = _o.getenv("TELEGRAM_BOT_TOKEN", "") or _o.getenv("BOT_TOKEN", "")
    chat = _o.getenv("BN_SUPPORT_CHAT_ID", "") or _o.getenv("TELEGRAM_ADMIN_ID", "") or "51213927"
    if not token:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as cli:
            await cli.post(f"https://api.telegram.org/bot{token}/sendMessage",
                           json={"chat_id": chat, "text": text})
    except Exception:  # noqa: BLE001
        pass


@router.post("/payment/submit")
async def payment_submit(tx_hash: str = Body(..., embed=True),
                         plan: str = Body("monthly", embed=True),
                         st: AcademyStudent = Depends(current_student),
                         db: AsyncSession = Depends(get_db)):
    """کاربر هشِ تراکنشِ USDT (BEP-20) را می‌فرستد → تأییدِ خودکار روی BSC →
    ارتقاء به پرمیوم + اطلاع به پشتیبانی. (پلن: monthly=۱۵ USDT/۳۰روز، yearly=۲۰۰/۳۶۵)"""
    from src.core.config import settings
    from src.core.redis_client import redis_client
    from src.api.routes._bsc import verify_usdt_payment

    plan = plan if plan in ("monthly", "yearly") else "monthly"
    min_amt, days = (15.0, 30) if plan == "monthly" else (200.0, 365)
    txk = (tx_hash or "").strip().lower()
    try:
        if await redis_client.exists(f"bn:tx:{txk}"):
            raise HTTPException(status_code=409, detail="این تراکنش قبلاً ثبت شده است.")
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001
        pass

    res = await verify_usdt_payment(tx_hash, settings.ACADEMY_BEP20_ADDRESS, min_amt)
    if not res.get("valid"):
        raise HTTPException(status_code=400, detail=res.get("reason", "تأییدِ پرداخت ناموفق بود."))

    try:
        await redis_client.client.set(f"bn:tx:{txk}", str(st.id), ex=86400 * 90)
    except Exception:  # noqa: BLE001
        pass
    st.tier = "premium"
    st.expires_at = datetime.now(timezone.utc) + timedelta(days=days)
    await db.commit()
    await _notify_support(
        "💰 پرداختِ پرمیومِ بازارنما\n"
        f"کاربر: {st.username} ({getattr(st, 'account_type', None) or '-'})\n"
        f"مبلغ: {res.get('amount')} USDT | پلن: {plan} ({days} روز)\n"
        f"از: {res.get('from')}\ntx: {tx_hash}"
    )
    logger.info("bn_payment_verified", sid=st.id, amount=res.get("amount"), plan=plan)
    return {"ok": True, "tier": "premium", "days": days, "amount": res.get("amount")}


# ═══════════════ اتصالِ حسابِ واقعیِ کاربر (LBank / MT5) #217 #218 ═══════════════
@router.get("/connect/status")
async def connect_status(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    from src.core.database import BnExchangeAccount
    rows = (await db.execute(select(BnExchangeAccount).where(BnExchangeAccount.student_id == st.id))).scalars().all()
    out = {}
    for a in rows:
        out[a.kind] = {"connected": True, "account_ref": a.account_ref, "server": a.server,
                       "referral_verified": a.referral_verified, "status": a.status, "note": a.note}
    return {"accounts": out, "account_type": getattr(st, "account_type", None)}


@router.post("/connect/lbank")
async def connect_lbank(api_key: str = Body(..., embed=True), api_secret: str = Body(..., embed=True),
                        uid: str = Body("", embed=True),
                        st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """ذخیرهٔ امنِ کلیدِ API صرافیِ LBankِ کاربر (Fernet). تریدِ واقعی پس از تأییدِ رفرال + پرمیوم."""
    _require_premium(st)
    from src.core.database import BnExchangeAccount
    from src.core.crypto import encrypt_secret
    if not (api_key or "").strip() or not (api_secret or "").strip():
        raise HTTPException(status_code=400, detail="کلیدِ API و Secret لازم است.")
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "lbank"))).scalar_one_or_none()
    if not a:
        a = BnExchangeAccount(student_id=st.id, kind="lbank"); db.add(a)
    a.enc_key = encrypt_secret(api_key.strip())
    a.enc_secret = encrypt_secret(api_secret.strip())
    a.account_ref = (uid or "").strip() or None
    a.status = "active"
    # تلاشِ خودکار برای تأییدِ رفرال (کاربر باید زیرمجموعهٔ لینکِ ما باشد؛ نیازمندِ وایت‌لیستِ IP)
    ref = {"verified": False, "reason": "no_uid"}
    if a.account_ref:
        try:
            from src.api.routes._lbank_referral import verify_referral
            ref = await verify_referral(a.account_ref)
        except Exception:  # noqa: BLE001
            ref = {"verified": False, "reason": "error"}
    a.referral_verified = bool(ref.get("verified"))
    a.note = ("تأیید شد — زیرمجموعهٔ رفرالِ ما" if a.referral_verified
              else f"در انتظارِ تأییدِ رفرال ({ref.get('reason')})")
    await db.commit()
    return {"ok": True, "kind": "lbank", "referral_verified": a.referral_verified, "note": a.note}


@router.post("/connect/mt5")
async def connect_mt5(login: str = Body(..., embed=True), password: str = Body(..., embed=True),
                      server: str = Body("", embed=True),
                      st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """ذخیرهٔ امنِ حسابِ MT5ِ وان‌رویالِ کاربر (Fernet). تریدِ واقعی پس از اتصال + پرمیوم."""
    _require_premium(st)
    from src.core.database import BnExchangeAccount
    from src.core.crypto import encrypt_secret
    if not (login or "").strip() or not (password or "").strip():
        raise HTTPException(status_code=400, detail="لاگین و رمزِ MT5 لازم است.")
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "mt5"))).scalar_one_or_none()
    if not a:
        a = BnExchangeAccount(student_id=st.id, kind="mt5"); db.add(a)
    a.enc_key = encrypt_secret(login.strip())
    a.enc_secret = encrypt_secret(password.strip())
    a.account_ref = login.strip()
    a.server = (server or "").strip() or None
    a.status = "active"
    a.note = "ذخیره شد — اتصالِ MT5 پس از دسترسیِ بروکر"
    await db.commit()
    return {"ok": True, "kind": "mt5", "account_ref": a.account_ref}


@router.delete("/connect/{kind}")
async def connect_remove(kind: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    from src.core.database import BnExchangeAccount
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == kind))).scalar_one_or_none()
    if a:
        await db.delete(a); await db.commit()
    return {"ok": True}


# ═══════════════ تریدِ واقعی روی حسابِ خودِ کاربر (نه کپی) #219 ═══════════════
@router.post("/real-order")
async def real_order(side: str = Body(..., embed=True), symbol: str = Body(..., embed=True),
                     amount: float = Body(..., embed=True), price: float = Body(0, embed=True),
                     st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """سفارشِ واقعی روی حسابِ خودِ کاربر — کریپتو→LBankِ کاربر، فارکس→MT5ِ کاربر.
    ویژهٔ پرمیومِ متصل. (نه کپی‌ترید — تریدِ مستقیمِ حسابِ کاربر.)"""
    _require_premium(st)
    from src.core.database import BnExchangeAccount
    from src.api.routes._crypto_feed import is_crypto, ensure_pairs
    side = (side or "").lower()
    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="جهتِ سفارش نامعتبر است.")
    sym = (symbol or "").upper()
    await ensure_pairs()
    crypto = is_crypto(sym)
    kind = "lbank" if crypto else "mt5"
    a = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == kind))).scalar_one_or_none()
    if not a or a.status != "active":
        raise HTTPException(status_code=400, detail={
            "msg": f"ابتدا حسابِ {'LBank' if crypto else 'MT5'} خود را در پنلِ کاربری وصل کن.",
            "connect_required": True, "kind": kind})
    if crypto and not a.referral_verified:
        raise HTTPException(status_code=403, detail={
            "msg": "برای تریدِ واقعی باید با لینکِ رفرالِ ما زیرمجموعه شوی و تأیید شود.",
            "referral_required": True})
    import os as _os
    from src.core.database import BnOrder
    if crypto:
        from src.api.routes._lbank_exec import place_order
        from src.core.crypto import decrypt_secret
        key = decrypt_secret(a.enc_key or "") or ""
        sec = decrypt_secret(a.enc_secret or "") or ""
        if not key or not sec:
            raise HTTPException(status_code=400, detail="کلیدِ API نامعتبر؛ دوباره وصل کن.")
        order = BnOrder(student_id=st.id, market="crypto", broker="LBank",
                        account_ref=a.account_ref, symbol=sym, side=side,
                        amount=float(amount), price=float(price) or None, status="pending")
        db.add(order)
        await db.flush()
        res = await place_order(key, sec, sym, side, float(amount), float(price) or None)
        if res.get("ok"):
            order.status = "filled"
            order.broker_order_id = str(res.get("order_id") or "")[:64]
            await db.commit()
            logger.info("bn_real_order_lbank", sid=st.id, sym=sym, side=side)
            return {"placed": True, "broker": "LBank", "order_id": res.get("order_id"),
                    "symbol": sym, "side": side, "amount": amount}
        order.status = "failed"
        order.error = str(res.get("error") or "")[:255]
        await db.commit()
        raise HTTPException(status_code=502, detail=res.get("error", "سفارش روی LBank ناموفق بود."))

    # فارکس → MT5ِ خودِ کاربر روی سرورِ اجرا (per-user؛ هرگز روی مَستر).
    # سفارش در صفِ مستقلِ pro-chart می‌نشیند؛ اجرای زنده با فلگِ BN_FOREX_LIVE + سرورِ اجرا.
    order = BnOrder(student_id=st.id, market="forex", broker="OneRoyal",
                    account_ref=a.account_ref, server=a.server, symbol=sym, side=side,
                    amount=float(amount), price=float(price) or None, status="pending")
    db.add(order)
    await db.commit()
    await db.refresh(order)
    live = _os.getenv("BN_FOREX_LIVE") == "1"
    exec_url = _os.getenv("BN_FOREX_EXEC_URL", "").rstrip("/")
    if live and exec_url:
        from src.core.crypto import decrypt_secret
        pwd = decrypt_secret(a.enc_secret or "") or ""
        try:
            import httpx
            async with httpx.AsyncClient(timeout=8.0) as cli:
                r = await cli.post(
                    f"{exec_url}/bn-forex-open",
                    json={"order_id": order.id, "login": a.account_ref, "password": pwd,
                          "server": a.server, "side": side, "symbol": sym,
                          "amount": float(amount), "price": float(price) or 0,
                          "sl": 0, "tp": 0},
                    headers={"X-Exec-Token": _os.getenv("BN_EXEC_TOKEN", "")},
                )
            if r.status_code == 200:
                order.status = "sent"
                await db.commit()
                logger.info("bn_real_order_forex_sent", sid=st.id, sym=sym, side=side, oid=order.id)
                return {"placed": True, "queued": True, "broker": "OneRoyal", "order_id": order.id,
                        "status": "sent", "symbol": sym, "side": side, "amount": amount,
                        "msg": "سفارش به سرورِ اجرای MT5 ارسال شد."}
        except Exception:  # noqa: BLE001
            logger.warning("bn_real_order_forex_exec_fail", oid=order.id)
    # اجرای زنده هنوز فعال نیست → در صف می‌ماند تا پلِ MT5 فعال شود
    return {"placed": False, "queued": True, "broker": "OneRoyal", "order_id": order.id,
            "status": "pending",
            "msg": "سفارشِ فارکس در صفِ اجرا ثبت شد؛ اجرای زندهٔ MT5 پس از فعال‌سازیِ پلِ بروکرِ وان‌رویال انجام می‌شود."}


# ═══════════ فیدِ دادهٔ زندهٔ فارکس از حسابِ مَسترِ MT5 (اکسپورترِ سرورِ کپی) ═══════════
# اکسپورتر روی سرورِ ویندوزِ مَستر اجرا می‌شود (همان‌جا که MT5ِ مَسترِ OneRoyal هست)،
# همهٔ نمادها + کندل + قیمت را با BN_FEED_TOKEN به اینجا می‌فرستد. کندل در candles
# upsert و قیمت در Redis می‌نشیند؛ نمادها در bn:fxsyms تا dropdown همه را نشان دهد.
@router.post("/feed/forex")
async def feed_forex(payload: dict = Body(...),
                     x_feed_token: str | None = Header(None),
                     db: AsyncSession = Depends(get_db)):
    import hmac as _hmac
    import os as _os
    want = _os.getenv("BN_FEED_TOKEN", "")
    if not (want and x_feed_token and _hmac.compare_digest(x_feed_token, want)):
        raise HTTPException(status_code=401, detail="unauthorized")
    from sqlalchemy import text as _text
    from src.core.redis_client import redis_client

    symbols = payload.get("symbols") or []
    candles = payload.get("candles") or []     # [{symbol,timeframe,rows:[[ts,o,h,l,c,v],...]}]
    quotes = payload.get("quotes") or []       # [{symbol,bid,ask}]

    if symbols:
        try:
            await redis_client.client.sadd("bn:fxsyms", *[str(s)[:10] for s in symbols])
        except Exception:  # noqa: BLE001
            pass

    n = 0
    for c in candles:
        sym = (c.get("symbol") or "")[:10]
        tf = (c.get("timeframe") or "")[:5]
        rows = c.get("rows") or []
        if not (sym and tf and rows):
            continue
        for r in rows:
            try:
                ts = int(r[0]); o = float(r[1]); h = float(r[2]); lo = float(r[3]); cl = float(r[4])
                v = float(r[5]) if len(r) > 5 and r[5] is not None else 0.0
            except Exception:  # noqa: BLE001
                continue
            await db.execute(_text(
                "INSERT INTO candles(time,symbol,timeframe,open,high,low,close,volume,source) "
                "VALUES (to_timestamp(:ts),:s,:tf,:o,:h,:l,:c,:v,'mt5_master') "
                "ON CONFLICT (time,symbol,timeframe) DO UPDATE SET "
                "open=excluded.open,high=excluded.high,low=excluded.low,"
                "close=excluded.close,volume=excluded.volume,source='mt5_master'"),
                {"ts": ts, "s": sym, "tf": tf, "o": o, "h": h, "l": lo, "c": cl, "v": v})
            n += 1
    if n:
        await db.commit()

    for q in quotes:
        sym = (q.get("symbol") or "")[:10]
        try:
            bid = float(q.get("bid") or 0); ask = float(q.get("ask") or bid)
        except Exception:  # noqa: BLE001
            continue
        if sym and (bid or ask):
            mid = (bid + ask) / 2 if (bid and ask) else (bid or ask)
            await redis_client.set_price(sym, {"bid": bid, "ask": ask, "price": mid,
                                               "ts": _now().isoformat()})
    return {"ok": True, "candles": n, "symbols": len(symbols), "quotes": len(quotes)}
