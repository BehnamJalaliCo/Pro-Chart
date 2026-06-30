"""
مدیریتِ آکادمیِ VIP در پنلِ ادمین (روی /admin/academy).

کنترلِ کاملِ ادمین: ساخت/ویرایش/غیرفعال/حذفِ دانش‌آموز (نام‌کاربری/رمز/تیر/انقضا)،
مدیریتِ دروس، و آمار. همه نیازمندِ نقشِ admin.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db, require_role
from datetime import timedelta

from src.core.database import (
    Admin,
    AcademyLesson,
    AcademyMentorMessage,
    AcademyMentorThread,
    AcademyPost,
    AcademyPostReply,
    AcademyProgress,
    AcademyStudent,
    AcademySubscription,
)
from src.core.logger import get_logger
from src.core.security import hash_password

router = APIRouter()
logger = get_logger(__name__)

_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,64}$")
_TIERS = ("free", "vip", "premium")


def _student_dict(s: AcademyStudent) -> dict:
    expired = bool(s.expires_at and s.expires_at <= datetime.now(timezone.utc))
    return {
        "id": s.id, "username": s.username, "email": s.email, "full_name": s.full_name,
        "tier": s.tier, "status": s.status, "expired": expired,
        # تیرِ مؤثر: منقضی یا غیرفعال → عملاً free
        "effective_tier": "free" if (expired or s.status != "active") else s.tier,
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        "notes": s.notes, "created_at": s.created_at.isoformat() if s.created_at else None,
        "last_login_at": s.last_login_at.isoformat() if s.last_login_at else None,
    }


def _parse_expiry(v) -> datetime | None:
    """رشتهٔ خالی → نامحدود. تاریخِ بدونِ ساعت (YYYY-MM-DD) = پایانِ همان روز (۲۳:۵۹:۵۹)
    تا «انقضا = ۱۴ ژوئن» یعنی کلِ آن روز معتبر باشد، نه نیمه‌شبِ آغازین که بلافاصله منقضی شود."""
    if not v:
        return None
    s = str(v).strip().replace("Z", "+00:00")
    try:
        d = datetime.fromisoformat(s)
    except (ValueError, TypeError):
        return None
    # تاریخِ خالص (بدونِ جزءِ زمان) → پایانِ روز
    if len(s) <= 10 and d.hour == 0 and d.minute == 0 and d.second == 0:
        d = d.replace(hour=23, minute=59, second=59)
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


# ── آمار ──
@router.get("/stats")
async def stats(admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    total = (await db.execute(select(func.count()).select_from(AcademyStudent))).scalar() or 0
    active = (await db.execute(select(func.count()).select_from(AcademyStudent)
              .where(AcademyStudent.status == "active",
                     or_(AcademyStudent.expires_at.is_(None), AcademyStudent.expires_at > now)))).scalar() or 0
    by_tier = {}
    for t in _TIERS:
        by_tier[t] = (await db.execute(select(func.count()).select_from(AcademyStudent)
                      .where(AcademyStudent.tier == t))).scalar() or 0
    lessons = (await db.execute(select(func.count()).select_from(AcademyLesson))).scalar() or 0
    mentor_msgs = (await db.execute(select(func.count()).select_from(AcademyMentorMessage)
                   .where(AcademyMentorMessage.role == "user"))).scalar() or 0
    completions = (await db.execute(select(func.count()).select_from(AcademyProgress)
                   .where(AcademyProgress.status == "completed"))).scalar() or 0
    expired = (await db.execute(select(func.count()).select_from(AcademyStudent)
               .where(AcademyStudent.expires_at.is_not(None), AcademyStudent.expires_at <= now))).scalar() or 0
    disabled = (await db.execute(select(func.count()).select_from(AcademyStudent)
                .where(AcademyStudent.status == "disabled"))).scalar() or 0
    return {"students_total": total, "students_active": active, "students_expired": expired,
            "students_disabled": disabled, "by_tier": by_tier,
            "lessons": lessons, "mentor_questions": mentor_msgs, "lesson_completions": completions}


# ── دانش‌آموزان ──
@router.get("/students")
async def list_students(
    q: str = Query(""), tier: str = Query(""), status: str = Query(""),
    page: int = Query(1, ge=1), per_page: int = Query(30, ge=1, le=100),
    admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db),
):
    conds = []
    if q:
        like = f"%{q.strip()}%"
        conds.append(or_(AcademyStudent.username.ilike(like), AcademyStudent.full_name.ilike(like),
                         AcademyStudent.email.ilike(like)))
    if tier in _TIERS:
        conds.append(AcademyStudent.tier == tier)
    if status in ("active", "disabled"):
        conds.append(AcademyStudent.status == status)
    base = select(AcademyStudent)
    if conds:
        base = base.where(*conds)
    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    rows = (await db.execute(base.order_by(AcademyStudent.id.desc())
            .limit(per_page).offset((page - 1) * per_page))).scalars().all()
    return {"items": [_student_dict(s) for s in rows], "total": total,
            "page": page, "per_page": per_page, "total_pages": (total + per_page - 1) // per_page}


@router.post("/students")
async def create_student(
    username: str = Body(..., embed=True), password: str = Body(..., embed=True),
    tier: str = Body("vip", embed=True), full_name: str = Body("", embed=True),
    email: str = Body("", embed=True), expires_at: str = Body("", embed=True),
    notes: str = Body("", embed=True),
    admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db),
):
    uname = (username or "").strip().lower()
    if not _USERNAME_RE.match(uname):
        raise HTTPException(status_code=400, detail="نام‌کاربری: ۳ تا ۶۴ کاراکترِ حرف/عدد/_/. .")
    if len(password or "") < 6:
        raise HTTPException(status_code=400, detail="رمز حداقل ۶ کاراکتر.")
    if tier not in _TIERS:
        tier = "vip"
    dup = (await db.execute(select(AcademyStudent).where(AcademyStudent.username == uname))).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=409, detail="این نام‌کاربری قبلاً وجود دارد.")
    em = (email or "").strip().lower()
    if em:
        edup = (await db.execute(select(AcademyStudent).where(func.lower(AcademyStudent.email) == em))).scalar_one_or_none()
        if edup:
            raise HTTPException(status_code=409, detail="این ایمیل قبلاً ثبت شده است.")
    s = AcademyStudent(username=uname, password_hash=hash_password(password), tier=tier,
                       full_name=(full_name or None), email=(email or None),
                       expires_at=_parse_expiry(expires_at), notes=(notes or None),
                       status="active", created_by=admin.id)
    db.add(s)
    await db.commit()
    logger.info("academy_student_created", admin=admin.id, username=uname, tier=tier)
    return _student_dict(s)


@router.get("/students/{sid}")
async def student_detail(sid: int, admin: Admin = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="دانش‌آموز یافت نشد.")
    completed = (await db.execute(select(func.count()).select_from(AcademyProgress)
                .where(AcademyProgress.student_id == sid, AcademyProgress.status == "completed"))).scalar() or 0
    questions = (await db.execute(select(func.count()).select_from(AcademyMentorMessage)
                 .join(AcademyMentorThread, AcademyMentorMessage.thread_id == AcademyMentorThread.id)
                 .where(AcademyMentorThread.student_id == sid, AcademyMentorMessage.role == "user"))).scalar() or 0
    return {**_student_dict(s), "completed_lessons": completed, "mentor_questions": questions}


@router.patch("/students/{sid}")
async def update_student(
    sid: int, tier: str | None = Body(None, embed=True), status: str | None = Body(None, embed=True),
    full_name: str | None = Body(None, embed=True), email: str | None = Body(None, embed=True),
    expires_at: str | None = Body(None, embed=True), notes: str | None = Body(None, embed=True),
    admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db),
):
    s = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="دانش‌آموز یافت نشد.")
    if tier in _TIERS:
        s.tier = tier
    if status in ("active", "disabled"):
        s.status = status
    if full_name is not None:
        s.full_name = full_name or None
    if email is not None:
        em = (email or "").strip().lower()
        if em:
            edup = (await db.execute(select(AcademyStudent).where(
                func.lower(AcademyStudent.email) == em, AcademyStudent.id != sid))).scalar_one_or_none()
            if edup:
                raise HTTPException(status_code=409, detail="این ایمیل برای دانش‌آموزِ دیگری ثبت شده.")
        s.email = em or None
    if notes is not None:
        s.notes = notes or None
    if expires_at is not None:
        s.expires_at = _parse_expiry(expires_at)  # رشتهٔ خالی → نامحدود
    await db.commit()
    return _student_dict(s)


@router.post("/students/{sid}/reset-password")
async def reset_password(sid: int, password: str = Body(..., embed=True),
                         admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    if len(password or "") < 6:
        raise HTTPException(status_code=400, detail="رمز حداقل ۶ کاراکتر.")
    s = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="دانش‌آموز یافت نشد.")
    s.password_hash = hash_password(password)
    await db.commit()
    return {"ok": True}


@router.post("/students/{sid}/extend")
async def extend_student(sid: int, days: int = Body(..., embed=True),
                         admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    """تمدیدِ اشتراک به‌اندازهٔ N روز. مبنا = بیشینهٔ (الان، انقضای فعلی) تا تمدیدِ پشتِ‌سرِهم درست جمع شود."""
    s = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="دانش‌آموز یافت نشد.")
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    base = s.expires_at if (s.expires_at and s.expires_at > now) else now
    s.expires_at = base + timedelta(days=int(days))
    await db.commit()
    return _student_dict(s)


@router.delete("/students/{sid}")
async def delete_student(sid: int, admin: Admin = Depends(require_role("admin")),
                         db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="دانش‌آموز یافت نشد.")
    # حذفِ آبشاری: پیام‌ها/تردها/پیشرفت
    threads = (await db.execute(select(AcademyMentorThread.id).where(AcademyMentorThread.student_id == sid))).scalars().all()
    if threads:
        await db.execute(delete(AcademyMentorMessage).where(AcademyMentorMessage.thread_id.in_(threads)))
    await db.execute(delete(AcademyMentorThread).where(AcademyMentorThread.student_id == sid))
    await db.execute(delete(AcademyProgress).where(AcademyProgress.student_id == sid))
    await db.execute(delete(AcademyStudent).where(AcademyStudent.id == sid))
    await db.commit()
    logger.info("academy_student_deleted", admin=admin.id, sid=sid)
    return {"ok": True}


# ── دروس ──
@router.get("/lessons")
async def list_lessons(level: str = Query(""), admin: Admin = Depends(require_role("admin")),
                       db: AsyncSession = Depends(get_db)):
    base = select(AcademyLesson)
    if level:
        base = base.where(AcademyLesson.level == level)
    rows = (await db.execute(base.order_by(AcademyLesson.level, AcademyLesson.order_in_level))).scalars().all()
    return {"items": [{"id": l.id, "slug": l.slug, "level": l.level, "order": l.order_in_level,
                       "title": l.title_fa, "min_tier": l.min_tier, "is_published": l.is_published,
                       "has_content": bool(l.content_fa)} for l in rows]}


@router.patch("/lessons/{lid}")
async def update_lesson(
    lid: int, title_fa: str | None = Body(None, embed=True), content_fa: str | None = Body(None, embed=True),
    summary_fa: str | None = Body(None, embed=True), min_tier: str | None = Body(None, embed=True),
    is_published: bool | None = Body(None, embed=True), order_in_level: int | None = Body(None, embed=True),
    admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db),
):
    l = (await db.execute(select(AcademyLesson).where(AcademyLesson.id == lid))).scalar_one_or_none()
    if l is None:
        raise HTTPException(status_code=404, detail="درس یافت نشد.")
    if title_fa is not None:
        l.title_fa = title_fa[:255]
    if content_fa is not None:
        l.content_fa = content_fa
    if summary_fa is not None:
        l.summary_fa = summary_fa
    if min_tier in _TIERS:
        l.min_tier = min_tier
    if is_published is not None:
        l.is_published = bool(is_published)
    if order_in_level is not None:
        l.order_in_level = int(order_in_level)
    await db.commit()
    return {"ok": True, "id": l.id}


# ── تأییدِ پرداختِ آکادمی (USDT BEP-20) ──
from src.core.config import settings as _settings  # noqa: E402


def _sub_dict(s: AcademySubscription, student: AcademyStudent | None) -> dict:
    note = ""
    if student and student.notes:
        for line in student.notes.splitlines():
            if f"[pay#{s.id}]" in line:
                note = line.strip()
    return {"id": s.id, "student_id": s.student_id,
            "username": student.username if student else None,
            "full_name": student.full_name if student else None,
            "tier": s.tier, "status": s.status,
            "amount_usdt": float(s.amount_usdt) if s.amount_usdt is not None else None,
            "tx_note": note,
            "created_at": s.created_at.isoformat() if s.created_at else None}


@router.get("/payments")
async def list_payments(status: str = Query("pending"),
                        admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    q = select(AcademySubscription).order_by(AcademySubscription.id.desc()).limit(100)
    if status:
        q = q.where(AcademySubscription.status == status)
    rows = (await db.execute(q)).scalars().all()
    out = []
    for s in rows:
        st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == s.student_id))).scalar_one_or_none()
        out.append(_sub_dict(s, st))
    return {"items": out}


@router.post("/payments/{pid}/approve")
async def approve_payment(pid: int, months: int = Body(None, embed=True),
                          admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(AcademySubscription).where(AcademySubscription.id == pid))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="درخواست یافت نشد.")
    st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == s.student_id))).scalar_one_or_none()
    if st is None:
        raise HTTPException(status_code=404, detail="دانش‌آموز یافت نشد.")
    price = _settings.ACADEMY_PRICE_VIP_MONTHLY if s.tier == "vip" else _settings.ACADEMY_PRICE_PREMIUM_MONTHLY
    m = int(months) if months else max(1, round(float(s.amount_usdt or price) / max(1, price)))
    now = datetime.now(timezone.utc)
    base = st.expires_at if (st.expires_at and st.expires_at > now) else now
    st.expires_at = base + timedelta(days=30 * m)
    st.tier = s.tier
    s.status = "active"
    s.started_at = now
    s.expires_at = st.expires_at
    await db.commit()
    logger.info("academy_payment_approved", admin=admin.id, sub=pid, sid=st.id, tier=s.tier, months=m)
    return {"ok": True, "tier": st.tier, "expires_at": st.expires_at.isoformat(), "months": m}


@router.post("/payments/{pid}/reject")
async def reject_payment(pid: int, admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(AcademySubscription).where(AcademySubscription.id == pid))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="یافت نشد.")
    s.status = "cancelled"
    await db.commit()
    return {"ok": True}


# ── مودراسیونِ انجمن ──
@router.get("/community")
async def admin_community(status: str = Query("pending"),
                          admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AcademyPost).where(AcademyPost.status == status)
            .order_by(AcademyPost.id.desc()).limit(100))).scalars().all()
    out = []
    for p in rows:
        st = (await db.execute(select(AcademyStudent.username).where(AcademyStudent.id == p.student_id))).scalar()
        out.append({"id": p.id, "content": p.content, "author": st, "status": p.status,
                    "reports": p.reports, "flag_reason": p.flag_reason,
                    "created_at": p.created_at.isoformat() if p.created_at else None})
    return {"items": out}


@router.post("/community/{pid}/approve")
async def approve_post(pid: int, admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(AcademyPost).where(AcademyPost.id == pid))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="یافت نشد.")
    p.status = "published"; p.reports = 0
    await db.commit()
    return {"ok": True}


@router.delete("/community/{pid}")
async def delete_post(pid: int, admin: Admin = Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    await db.execute(delete(AcademyPostReply).where(AcademyPostReply.post_id == pid))
    await db.execute(delete(AcademyPost).where(AcademyPost.id == pid))
    await db.commit()
    return {"ok": True}
