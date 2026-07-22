"""پنلِ ادمین فاز۸ — بخشِ ۸C: اشتراک/پرداخت/پلن + KYC.

قرارداد: `SERVER_HANDOFF_09_admin.md` §۸C. مسیرها زیرِ `/academy/admin/`.
KYC documentها با URLِ **signed کوتاه‌عمر (~۱۰دقیقه)** سرو می‌شوند (توکنِ scope=kyc_doc).
"""

from __future__ import annotations

import base64
import binascii
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes import admin_audit
from src.api.routes.admin_panel import require_admin, _require_confirm
from src.api.routes.admin_roles import has_permission, role_for
from src.api.routes.admin_users import _uid, _kyc_display, mask_email
from src.core.config import settings
from src.core.database import AcademyStudent, async_session_factory
from src.core.logger import get_logger
from src.core.security import create_access_token, verify_access_token

logger = get_logger(__name__)
router = APIRouter()

KYC_DOC_TTL_SECONDS = 600  # ۱۰ دقیقه
_PUBLIC_BASE = "https://user.pro-chart.com/api"


def _ms(dt) -> Optional[int]:
    return int(dt.timestamp() * 1000) if dt else None


async def _student(db, uid: int) -> Optional[AcademyStudent]:
    from sqlalchemy import select
    return (await db.execute(select(AcademyStudent).where(AcademyStudent.id == uid))).scalar_one_or_none()


async def _user_masked(db, uid: int) -> str:
    st = await _student(db, uid)
    if not st:
        return f"u_{uid}"
    return mask_email(getattr(st, "email", None)) or getattr(st, "username", None) or f"u_{uid}"


# ── پلن‌ها (سروری، از config) ──
@router.get("/admin/plans")
async def admin_plans(st=Depends(require_admin("subscriptions.read"))) -> dict:
    plans = [
        {"id": "free", "name": "Free", "price": 0.0, "currency": "USDT", "interval": "month",
         "features": ["نمونهٔ آموزش", "چارت پایه"]},
        {"id": "vip", "name": "VIP", "price": float(settings.ACADEMY_PRICE_VIP_MONTHLY),
         "currency": "USDT", "interval": "month", "features": ["سیگنال VIP", "پرو-چارت", "کپی‌ترید"]},
        {"id": "premium", "name": "Premium", "price": float(settings.ACADEMY_PRICE_PREMIUM_MONTHLY),
         "currency": "USDT", "interval": "month", "features": ["همهٔ VIP", "هوشِ مصنوعی", "اجرای واقعی"]},
    ]
    return {"plans": plans}


# ── اشتراک‌ها ──
@router.get("/admin/subscriptions")
async def admin_subscriptions(status: str = "", plan: str = "", cursor: str = "", limit: int = 25,
                              st=Depends(require_admin("subscriptions.read")),
                              db: AsyncSession = Depends(get_db)) -> dict:
    limit = max(1, min(int(limit), 100))
    offset = int(cursor) if (cursor and cursor.isdigit()) else 0
    where = []
    params: dict[str, Any] = {"lim": limit, "off": offset}
    if status:
        where.append("status=:st"); params["st"] = status
    if plan:
        where.append("tier=:pl"); params["pl"] = plan
    wsql = (" WHERE " + " AND ".join(where)) if where else ""
    try:
        rows = (await db.execute(text(
            f"SELECT id,student_id,tier,status,started_at,expires_at,payment_request_id "
            f"FROM academy_subscriptions{wsql} ORDER BY id DESC OFFSET :off LIMIT :lim"), params)).all()
    except Exception:  # noqa: BLE001
        return {"items": [], "next_cursor": None}
    items = []
    for r in rows:
        items.append({"id": str(r[0]), "user_id": f"u_{r[1]}", "user_masked": await _user_masked(db, r[1]),
                      "plan": r[2], "status": r[3], "started_at": _ms(r[4]), "expires_at": _ms(r[5]),
                      "source": "manual", "auto_renew": False})
    next_cursor = str(offset + limit) if len(rows) >= limit else None
    return {"items": items, "next_cursor": next_cursor}


@router.get("/admin/users/{id}/payments")
async def admin_user_payments(id: str, st=Depends(require_admin("subscriptions.read")),
                              db: AsyncSession = Depends(get_db)) -> dict:
    uid = _uid(id)
    try:
        rows = (await db.execute(text(
            "SELECT id,amount_usdt,status,product,tx_hash,created_at FROM academy_payments "
            "WHERE student_id=:s ORDER BY id DESC LIMIT 100"), {"s": uid})).all()
    except Exception:  # noqa: BLE001
        return {"payments": []}
    return {"payments": [{"id": str(r[0]), "amount": float(r[1] or 0), "currency": "USDT",
                          "method": "crypto", "status": r[2], "created_at": _ms(r[5]),
                          "reference": r[4] or r[3], "refundable": False} for r in rows]}


@router.post("/admin/users/{id}/subscription")
async def admin_user_subscription(id: str, plan: str = Body(..., embed=True),
                                  action: str = Body(..., embed=True),
                                  duration_days: int = Body(30, embed=True),
                                  reason: str = Body(..., embed=True),
                                  x_admin_confirm: Optional[str] = Header(None),
                                  st=Depends(require_admin("subscriptions.grant")),
                                  db: AsyncSession = Depends(get_db)) -> dict:
    if action not in ("grant", "extend", "cancel"):
        raise HTTPException(status_code=400, detail={"error": {"code": "bad_action", "message": "action نامعتبر."}})
    if action == "cancel" and not has_permission(role_for(st), "subscriptions.cancel"):
        raise HTTPException(status_code=403, detail={"error": {"code": "forbidden",
                            "message": "مجوزِ لغو ندارید.", "required_permission": "subscriptions.cancel"}})
    if not (reason or "").strip():
        raise HTTPException(status_code=400, detail={"error": {"code": "reason_required", "message": "reason لازم است."}})
    _require_confirm(x_admin_confirm)
    target = await _student(db, _uid(id))
    if not target:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "کاربر یافت نشد."}})
    now = datetime.now(timezone.utc)
    dd = max(1, int(duration_days or 30))
    if action == "cancel":
        target.tier = "free"; target.expires_at = now
        sub_status = "cancelled"; started = now; expires = now
    else:
        base = target.expires_at if (action == "extend" and target.expires_at and target.expires_at > now) else now
        expires = base + timedelta(days=dd)
        target.tier = plan if plan in ("vip", "premium") else target.tier
        target.expires_at = expires
        sub_status = "active"; started = now
    # ثبتِ رکوردِ اشتراک (append)
    try:
        await db.execute(text(
            "INSERT INTO academy_subscriptions (student_id,tier,status,amount_usdt,started_at,expires_at,created_at) "
            "VALUES (:s,:t,:st,0,:sa,:ea,now())"),
            {"s": target.id, "t": target.tier, "st": sub_status, "sa": started, "ea": expires})
    except Exception as e:  # noqa: BLE001
        logger.warning("admin_sub_insert_failed", error=str(e))
    await db.commit(); await db.refresh(target)
    sub = {"id": f"sub_{target.id}", "user_id": f"u_{target.id}",
           "user_masked": mask_email(getattr(target, "email", None)) or target.username,
           "plan": target.tier, "status": sub_status, "started_at": _ms(started),
           "expires_at": _ms(target.expires_at), "source": "manual", "auto_renew": False}
    audit = await admin_audit.record(actor_id=st.id, actor_name=st.username, actor_role=role_for(st),
                                     action=f"subscriptions.{action}", target_type="user", target_id=target.id,
                                     target_label=sub["user_masked"], reason=reason,
                                     metadata={"plan": plan, "duration_days": dd})
    return {"accepted": True, "subscription": sub, "audit": audit}


# ── KYC ──
_KYC_COLS = "id,student_id,status,reason,submitted_at,reviewed_at"


async def _kyc_case(db, row, *, with_docs: bool, admin_id=None) -> dict:
    (kid, sid, status, reason, submitted, reviewed) = row
    case = {"id": f"k_{kid}", "user_id": f"u_{sid}", "user_masked": await _user_masked(db, sid),
            "status": _kyc_display(status), "submitted_at": _ms(submitted), "reviewed_at": _ms(reviewed),
            "reviewer": None, "reject_reason_code": None, "reject_note": reason, "documents": []}
    if with_docs:
        docs = (await db.execute(text("SELECT id,doc_type FROM academy_kyc_docs WHERE kyc_id=:k ORDER BY id"),
                                 {"k": kid})).all()
        exp = datetime.now(timezone.utc) + timedelta(seconds=KYC_DOC_TTL_SECONDS)
        for d in docs:
            tok = create_access_token({"scope": "kyc_doc", "doc_id": int(d[0]), "sid": admin_id},
                                      expires_delta=timedelta(seconds=KYC_DOC_TTL_SECONDS))
            case["documents"].append({
                "kind": d[1], "url": f"{_PUBLIC_BASE}/academy/admin/kyc/doc/{d[0]}?t={tok}",
                "expires_at": _ms(exp), "mime": "image/jpeg"})
    return case


@router.get("/admin/kyc")
async def admin_kyc_list(status: str = "pending", cursor: str = "", limit: int = 25,
                         st=Depends(require_admin("kyc.review")), db: AsyncSession = Depends(get_db)) -> dict:
    limit = max(1, min(int(limit), 100))
    offset = int(cursor) if (cursor and cursor.isdigit()) else 0
    params = {"lim": limit, "off": offset}
    wsql = ""
    if status and status != "all":
        wsql = " WHERE status=:st"; params["st"] = status
    rows = (await db.execute(text(
        f"SELECT {_KYC_COLS} FROM academy_kyc{wsql} ORDER BY id DESC OFFSET :off LIMIT :lim"), params)).all()
    items = [await _kyc_case(db, r, with_docs=False) for r in rows]
    next_cursor = str(offset + limit) if len(rows) >= limit else None
    return {"items": items, "next_cursor": next_cursor}


@router.get("/admin/kyc/{id}")
async def admin_kyc_detail(id: str, st=Depends(require_admin("kyc.review")),
                           db: AsyncSession = Depends(get_db)) -> dict:
    kid = int(id[2:]) if id.startswith("k_") else (int(id) if id.isdigit() else None)
    if kid is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "یافت نشد."}})
    r = (await db.execute(text(f"SELECT {_KYC_COLS} FROM academy_kyc WHERE id=:k"), {"k": kid})).first()
    if not r:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "پروندهٔ KYC یافت نشد."}})
    return await _kyc_case(db, r, with_docs=True, admin_id=st.id)


@router.get("/admin/kyc/doc/{doc_id}")
async def admin_kyc_doc(doc_id: int, t: str = Query(...), db: AsyncSession = Depends(get_db)):
    """سرو کردنِ سندِ KYC با توکنِ signed کوتاه‌عمر (بدونِ نیاز به Bearer؛ برای <img>)."""
    p = verify_access_token(t)
    if not p or p.get("scope") != "kyc_doc" or int(p.get("doc_id", -1)) != int(doc_id):
        raise HTTPException(status_code=403, detail={"error": {"code": "forbidden", "message": "لینک نامعتبر یا منقضی."}})
    row = (await db.execute(text("SELECT data_b64 FROM academy_kyc_docs WHERE id=:d"), {"d": doc_id})).first()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "سند یافت نشد."}})
    data = row[0]
    if isinstance(data, str) and "," in data[:64] and data[:5].lower() in ("data:", "data："):
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=422, detail={"error": {"code": "bad_doc", "message": "سندِ نامعتبر."}})
    return Response(content=raw, media_type="image/jpeg",
                    headers={"Cache-Control": "private, max-age=600"})


@router.post("/admin/kyc/{id}/decision")
async def admin_kyc_decision(id: str, decision: str = Body(..., embed=True),
                             reason_code: Optional[str] = Body(None, embed=True),
                             note: str = Body("", embed=True),
                             x_admin_confirm: Optional[str] = Header(None),
                             st=Depends(require_admin("kyc.review")), db: AsyncSession = Depends(get_db)) -> dict:
    if decision not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail={"error": {"code": "bad_decision", "message": "decision نامعتبر."}})
    _require_confirm(x_admin_confirm)
    kid = int(id[2:]) if id.startswith("k_") else (int(id) if id.isdigit() else None)
    if kid is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "یافت نشد."}})
    r = (await db.execute(text("SELECT id,student_id FROM academy_kyc WHERE id=:k"), {"k": kid})).first()
    if not r:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": "پروندهٔ KYC یافت نشد."}})
    sid = r[1]
    new_status = "approved" if decision == "approve" else "rejected"
    note_full = note or ""
    if decision == "reject" and reason_code:
        note_full = f"[{reason_code}] {note_full}".strip()
    await db.execute(text("UPDATE academy_kyc SET status=:s, reviewed_at=now(), reason=:r WHERE id=:k"),
                     {"s": new_status, "r": note_full, "k": kid})
    await db.execute(text("UPDATE academy_students SET kyc_status=:s WHERE id=:sid"),
                     {"s": new_status, "sid": sid})
    await db.commit()
    r2 = (await db.execute(text(f"SELECT {_KYC_COLS} FROM academy_kyc WHERE id=:k"), {"k": kid})).first()
    case = await _kyc_case(db, r2, with_docs=False)
    audit = await admin_audit.record(actor_id=st.id, actor_name=st.username, actor_role=role_for(st),
                                     action="kyc.review", target_type="kyc", target_id=kid,
                                     target_label=case["user_masked"], reason=note_full or decision,
                                     metadata={"decision": decision, "reason_code": reason_code})
    return {"accepted": True, "case": case, "audit": audit}
