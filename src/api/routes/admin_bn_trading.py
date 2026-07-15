"""
BazaarNama — پنلِ ادمینِ اختصاصی: بخشِ تریدینگ.

این ماژول endpointهای مدیریتیِ ترید را زیر پیشوندِ /admin/bn ارائه می‌کند:
سفارش‌ها (orders)، حساب‌های صرافی (exchange-accounts) و سیگنال‌های AI.

قواعد:
    - احراز هویت: get_current_admin (همان auth جدولِ admins اصلی)
    - خروجی JSON کاملاً camelCase طبقِ قرارداد
    - EMPTY-SAFE: جدولِ خالی → [] یا صفر، هرگز 500؛ مخرجِ صفر گارد می‌شود
    - هرگز enc_key / enc_secret (کردنشالِ رمزنگاری‌شده) برنمی‌گردد
"""

from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.api.deps import get_current_admin, get_db
from src.core.database import (
    AcademyStudent,
    Admin,
    BnAiSignal,
    BnExchangeAccount,
    BnOrder,
)

router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────
def _iso(dt: datetime | None) -> str | None:
    """تبدیلِ امنِ datetime به ISO — None-safe."""
    return dt.isoformat() if dt else None


def _num(v) -> float | None:
    """تبدیلِ امنِ Numeric/Decimal به float — None-safe."""
    return float(v) if v is not None else None


def _clamp_page(page: int, limit: int) -> tuple[int, int]:
    """گاردِ صفحه‌بندی — page>=1، limit در بازهٔ 1..200."""
    page = max(int(page or 1), 1)
    limit = min(max(int(limit or 25), 1), 200)
    return page, limit


async def _username_map(db: AsyncSession, student_ids: set[int]) -> dict[int, str | None]:
    """نگاشتِ student_id → username (fallback به email). خالی‌امن."""
    if not student_ids:
        return {}
    rows = (
        await db.execute(
            select(AcademyStudent.id, AcademyStudent.username, AcademyStudent.email).where(
                AcademyStudent.id.in_(student_ids)
            )
        )
    ).all()
    return {r.id: (r.username or r.email) for r in rows}


# ═══════════════════════════ ORDERS ═══════════════════════════
@router.get("/orders")
async def list_orders(
    status: str = "",
    market: str = "",
    page: int = 1,
    limit: int = 25,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """لیستِ سفارش‌های تریدِ واقعیِ بازارنما با صفحه‌بندی و فیلترِ status/market."""
    page, limit = _clamp_page(page, limit)

    base = select(BnOrder)
    if status:
        base = base.where(BnOrder.status == status)
    if market:
        base = base.where(BnOrder.market == market)

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0

    rows = (
        await db.execute(
            base.order_by(BnOrder.id.desc()).offset((page - 1) * limit).limit(limit)
        )
    ).scalars().all()

    names = await _username_map(db, {r.student_id for r in rows})
    items = [
        {
            "id": r.id,
            "studentId": r.student_id,
            "username": names.get(r.student_id),
            "market": r.market,
            "broker": r.broker,
            "symbol": r.symbol,
            "side": r.side,
            "amount": _num(r.amount),
            "price": _num(r.price),
            "sl": _num(r.sl),
            "tp": _num(r.tp),
            "status": r.status,
            "brokerOrderId": r.broker_order_id,
            "error": r.error,
            "createdAt": _iso(r.created_at),
        }
        for r in rows
    ]
    pages = (total + limit - 1) // limit if total else 0
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


@router.post("/orders/{order_id}/cancel")
async def cancel_order(
    order_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """لغوِ یک سفارش — status='canceled'."""
    order = (
        await db.execute(select(BnOrder).where(BnOrder.id == order_id))
    ).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="سفارش یافت نشد.")
    order.status = "canceled"
    await db.flush()
    return {"ok": True, "id": order.id, "status": order.status}


# ═══════════════════════ EXCHANGE ACCOUNTS ═══════════════════════
@router.get("/exchange-accounts")
async def list_exchange_accounts(
    q: str = "",
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """لیستِ حساب‌های صرافیِ متصلِ کاربران. هرگز enc_key/enc_secret برنمی‌گردد."""
    stmt = (
        select(BnExchangeAccount, AcademyStudent.username, AcademyStudent.email)
        .join(AcademyStudent, AcademyStudent.id == BnExchangeAccount.student_id, isouter=True)
        .where(BnExchangeAccount.kind == "lbank")
        .order_by(BnExchangeAccount.id.desc())
    )
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            (AcademyStudent.username.ilike(like))
            | (AcademyStudent.email.ilike(like))
            | (BnExchangeAccount.account_ref.ilike(like))
        )

    rows = (await db.execute(stmt)).all()
    return [
        {
            "id": acc.id,
            "studentId": acc.student_id,
            "username": username or email,
            "kind": acc.kind,
            "accountRef": acc.account_ref,
            "server": acc.server,
            "referralVerified": bool(acc.referral_verified),
            "status": acc.status,
            "lastCheckAt": _iso(acc.last_check_at),
            "note": acc.note,
            "createdAt": _iso(acc.created_at),
        }
        for acc, username, email in rows
    ]


@router.post("/exchange-accounts/{account_id}/referral")
async def set_exchange_referral(
    account_id: int,
    verified: bool = Body(..., embed=True),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """تأیید/رَدِ راستی‌آزماییِ رفرالِ حسابِ صرافی (لازم برای تریدِ واقعی)."""
    acc = (
        await db.execute(select(BnExchangeAccount).where(BnExchangeAccount.id == account_id))
    ).scalar_one_or_none()
    if acc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="حساب یافت نشد.")
    if acc.kind != "lbank":
        raise HTTPException(status_code=410, detail={
            "reason": "oneroyal_referral_only", "referral_only": True,
            "integration_level": "referral_only", "referral_path": "/go/oneroyal",
            "connected": False, "eligible": False, "enabled": False,
        })
    acc.referral_verified = bool(verified)
    await db.flush()
    return {"ok": True, "id": acc.id, "referralVerified": acc.referral_verified}


@router.post("/exchange-accounts/{account_id}/status")
async def set_exchange_status(
    account_id: int,
    status: str = Body(..., embed=True),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """تغییرِ وضعیتِ حسابِ صرافی (active/disabled/...)."""
    acc = (
        await db.execute(select(BnExchangeAccount).where(BnExchangeAccount.id == account_id))
    ).scalar_one_or_none()
    if acc is None:
        raise HTTPException(status_code=404, detail="حساب یافت نشد.")
    if acc.kind != "lbank":
        raise HTTPException(status_code=410, detail={
            "reason": "oneroyal_referral_only", "referral_only": True,
            "integration_level": "referral_only", "referral_path": "/go/oneroyal",
            "connected": False, "eligible": False, "enabled": False,
        })
    acc.status = status
    await db.flush()
    return {"ok": True, "id": acc.id, "status": acc.status}


# ═══════════════════════════ AI SIGNALS ═══════════════════════════
@router.get("/ai-signals")
async def list_ai_signals(
    status: str = "",
    page: int = 1,
    limit: int = 25,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """لیستِ سیگنال‌های AI با صفحه‌بندی و فیلترِ status."""
    page, limit = _clamp_page(page, limit)

    base = select(BnAiSignal)
    if status:
        base = base.where(BnAiSignal.status == status)

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar() or 0

    rows = (
        await db.execute(
            base.order_by(BnAiSignal.id.desc()).offset((page - 1) * limit).limit(limit)
        )
    ).scalars().all()

    names = await _username_map(db, {r.student_id for r in rows})
    items = [
        {
            "id": r.id,
            "studentId": r.student_id,
            "username": names.get(r.student_id),
            "symbol": r.symbol,
            "tf": r.tf,
            "direction": r.direction,
            "entry": _num(r.entry),
            "sl": _num(r.sl),
            "tp1": _num(r.tp1),
            "tp2": _num(r.tp2),
            "tp3": _num(r.tp3),
            "confidence": r.confidence,
            "status": r.status,
            "hit": r.hit,
            "createdAt": _iso(r.created_at),
        }
        for r in rows
    ]
    pages = (total + limit - 1) // limit if total else 0
    return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


@router.get("/ai-signals/stats")
async def ai_signals_stats(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """آمارِ سیگنال‌های AI — شمارش‌ها، نرخِ برخورد و تفکیکِ جهت. خالی‌امن."""
    total = (await db.execute(select(func.count(BnAiSignal.id)))).scalar() or 0
    active = (
        await db.execute(
            select(func.count(BnAiSignal.id)).where(BnAiSignal.status == "active")
        )
    ).scalar() or 0
    deleted = (
        await db.execute(
            select(func.count(BnAiSignal.id)).where(BnAiSignal.status == "deleted")
        )
    ).scalar() or 0

    # شمارشِ برخوردها بر اساسِ ستونِ hit
    hit_rows = (
        await db.execute(
            select(BnAiSignal.hit, func.count(BnAiSignal.id)).group_by(BnAiSignal.hit)
        )
    ).all()
    hit_counts = {(h or ""): c for h, c in hit_rows}
    tp1 = hit_counts.get("tp1", 0)
    tp2 = hit_counts.get("tp2", 0)
    tp3 = hit_counts.get("tp3", 0)
    sl = hit_counts.get("sl", 0)

    # تفکیکِ جهت
    dir_rows = (
        await db.execute(
            select(BnAiSignal.direction, func.count(BnAiSignal.id)).group_by(
                BnAiSignal.direction
            )
        )
    ).all()
    dir_counts = {(d or "").lower(): c for d, c in dir_rows}
    buy = dir_counts.get("buy", 0)
    sell = dir_counts.get("sell", 0)

    # نرخِ برخورد = (سیگنال‌هایی که به هر TP رسیده‌اند) / (بسته‌شده‌ها: TP یا SL)
    tp_total = tp1 + tp2 + tp3
    closed = tp_total + sl
    hit_rate = round((tp_total / closed) * 100, 2) if closed else 0.0

    return {
        "total": total,
        "active": active,
        "deleted": deleted,
        "hitRate": hit_rate,
        "tp1": tp1,
        "tp2": tp2,
        "tp3": tp3,
        "sl": sl,
        "byDirection": {"buy": buy, "sell": sell},
    }


@router.delete("/ai-signals/{signal_id}")
async def delete_ai_signal(
    signal_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """حذفِ نرمِ سیگنالِ AI — status='deleted'."""
    sig = (
        await db.execute(select(BnAiSignal).where(BnAiSignal.id == signal_id))
    ).scalar_one_or_none()
    if sig is None:
        raise HTTPException(status_code=404, detail="سیگنال یافت نشد.")
    sig.status = "deleted"
    await db.flush()
    return {"ok": True, "id": sig.id, "status": sig.status}
