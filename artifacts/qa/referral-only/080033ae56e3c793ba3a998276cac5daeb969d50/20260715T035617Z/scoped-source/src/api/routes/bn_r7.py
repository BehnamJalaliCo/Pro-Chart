"""R7 — مرکزِ حساب + اتاقِ کنترل: تاریخچهٔ پرداخت، کیل‌سوییچ، آمارِ ادمین،
چتِ پشتیبانِ AI، آمارِ رفرال، سلامتِ سرورها."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.api.routes.bazaarnama import current_bn_admin
from src.core.database import AcademyStudent
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


# ── §1 تاریخچهٔ پرداختِ کاربر ──
@router.get("/payment/history")
async def payment_history(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(text(
        "SELECT id, product, plan, tx_hash, usdt, status, created_at FROM bn_payments "
        "WHERE student_id=:s ORDER BY id DESC LIMIT 100"), {"s": st.id})).all()
    return {"payments": [
        {"id": r.id, "product": r.product, "plan": r.plan, "tx_hash": r.tx_hash,
         "usdt": r.usdt, "status": r.status,
         "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]}


# ── §5 آمارِ رفرال ──
@router.get("/referral-stats")
async def referral_stats(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    # کاربرانی که با کدِ دعوتِ این کاربر ثبت‌نام کرده‌اند (اگر ستون موجود باشد)
    invited = verified = 0
    try:
        invited = (await db.execute(text(
            "SELECT count(*) FROM academy_students WHERE referred_by=:s"), {"s": st.id})).scalar() or 0
        verified = (await db.execute(text(
            "SELECT count(*) FROM academy_students WHERE referred_by=:s AND (prochart_until>now() OR tier IN ('vip','premium'))"),
            {"s": st.id})).scalar() or 0
    except Exception:  # noqa: BLE001
        pass
    return {"invited": int(invited), "verified": int(verified), "reward_usdt": round(int(verified) * 5.0, 2)}


# ── §4 چتِ پشتیبانِ AIِ حساب‌آگاه ──
@router.post("/ai-support")
async def ai_support(payload: dict = Body(...),
                     st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    msg = (payload.get("message") or "").strip()[:2000]
    if not msg:
        raise HTTPException(400, "پیام خالی است.")
    tier = getattr(st, "tier", "free")
    pc = getattr(st, "prochart_until", None)
    pro_active = bool(pc and pc > datetime.now(timezone.utc))
    ctx = (f"کاربر: {st.username or st.id} | آکادمی-tier: {tier} | "
           f"اشتراکِ پرو-چارت: {'فعال' if pro_active else 'ندارد'}.")
    sysp = ("تو پشتیبانِ فارسیِ اپِ Pro-Chart هستی (چارت/سیگنال/کپی‌ترید/اشتراک). کوتاه، دقیق و مؤدب "
            "پاسخ بده. اگر سؤال دربارهٔ اشتراک/پرداخت است بر اساسِ وضعیتِ کاربر راهنمایی کن. "
            "هرگز توصیهٔ سرمایه‌گذاریِ قطعی نده. " + ctx)
    try:
        from src.llm.client import llm_client
        ans = await llm_client.complete(msg, system=sysp, cache_ttl=0)
    except Exception as e:  # noqa: BLE001
        logger.warning("ai_support_failed", error=str(e))
        raise HTTPException(503, "دستیارِ هوشِ مصنوعی موقتاً در دسترس نیست.")
    return {"answer": (ans or "").strip() or "متأسفم، پاسخی تولید نشد.",
            "thread_id": payload.get("thread_id")}


# ── §2 کیل‌سوییچِ اجرای معاملات ──
@router.get("/admin/killswitch")
async def get_killswitch(is_admin: bool = Depends(current_bn_admin)):
    from src.core.redis_client import redis_client
    try:
        v = await redis_client.client.get("bn:killswitch")
        enabled = v in (b"1", "1")
    except Exception:  # noqa: BLE001
        enabled = False
    return {"enabled": bool(enabled)}


@router.post("/admin/killswitch")
async def set_killswitch(payload: dict = Body(...), is_admin: bool = Depends(current_bn_admin)):
    from src.core.redis_client import redis_client
    enabled = bool(payload.get("enabled"))
    try:
        if enabled:
            await redis_client.client.set("bn:killswitch", "1")
        else:
            await redis_client.client.delete("bn:killswitch")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(503, f"redis error: {e}")
    logger.warning("bn_killswitch", enabled=enabled)
    return {"enabled": enabled}


# ── §3 آمارِ تجمیعیِ ادمین ──
@router.get("/admin/stats")
async def admin_stats(is_admin: bool = Depends(current_bn_admin), db: AsyncSession = Depends(get_db)):
    q = lambda sql: db.execute(text(sql))  # noqa: E731
    users_total = (await q("SELECT count(*) FROM academy_students")).scalar() or 0
    users_today = (await q("SELECT count(*) FROM academy_students WHERE created_at::date=now()::date")).scalar() or 0
    subs_active = (await q("SELECT count(*) FROM academy_students WHERE prochart_until>now() "
                           "OR forex_copy_until>now() OR (tier IN ('vip','premium') AND (expires_at IS NULL OR expires_at>now()))")).scalar() or 0
    subs_today = (await q("SELECT count(*) FROM bn_payments WHERE created_at::date=now()::date")).scalar() or 0
    try:
        payments_pending = (await q("SELECT count(*) FROM bn_orders WHERE status='pending'")).scalar() or 0
    except Exception:  # noqa: BLE001
        payments_pending = 0
    return {"users_total": int(users_total), "users_today": int(users_today),
            "subs_active": int(subs_active), "subs_today": int(subs_today),
            "payments_pending": int(payments_pending)}


# ── §6 سلامتِ سرورها ──
@router.get("/admin/servers")
async def admin_servers(is_admin: bool = Depends(current_bn_admin)):
    """آخرین گزارشِ سلامت که ایجنتِ سرورِ مرکزی در Redis نوشته (bn:server_health)."""
    from src.core.redis_client import redis_client
    import json as _json
    data = None
    try:
        raw = await redis_client.client.get("bn:server_health")
        if raw:
            data = _json.loads(raw.decode() if isinstance(raw, (bytes, bytearray)) else raw)
    except Exception:  # noqa: BLE001
        data = None
    if not data:
        names = ["مرکزی", "هاب", "کریپتو", "فارکس", "ویندوز"]
        return {"servers": [{"name": n, "status": "unknown", "cpu": None, "mem": None} for n in names],
                "stale": True}
    return {"servers": data.get("servers", []), "reported_at": data.get("reported_at"), "stale": False}


@router.post("/admin/servers/report")
async def servers_report(payload: dict = Body(...), x_internal_token: str = Header(default="")):
    """ورودیِ گزارشِ ایجنتِ سرورِ مرکزی — توکن‌دار با BN_BRIDGE_TOKEN، شبکهٔ خصوصی."""
    import os as _os, json as _json
    tok = _os.getenv("BN_BRIDGE_TOKEN", "")
    if not tok or x_internal_token != tok:
        raise HTTPException(401, "unauthorized")
    from src.core.redis_client import redis_client
    doc = {"servers": payload.get("servers", []), "reported_at": payload.get("reported_at")}
    await redis_client.client.set("bn:server_health", _json.dumps(doc), ex=300)
    return {"ok": True, "count": len(doc["servers"])}


# ── مرزِ سازگاریِ legacy: OneRoyal فقط مسیرِ معرفی است ──
@router.get("/copytrade/forex/config")
async def forex_copy_config(st: AcademyStudent = Depends(current_student)):
    """Return a static, non-actionable referral contract without DB or network I/O."""
    del st
    return {
        "referral_only": True,
        "integration_level": "referral_only",
        "referral_path": "/go/oneroyal",
        "connected": False,
        "eligible": False,
        "enabled": False,
    }
