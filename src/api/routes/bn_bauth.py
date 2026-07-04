"""B-AUTH — احراز هویتِ ایمیلیِ اجباری + بازیابیِ رمز (Resend) + KYC + رفرال.
هویت روی academy_students؛ توکنِ RS256 از central-auth (/auth/issue). مسیرها ریشه‌ای: /auth /kyc /referral.
"""
from __future__ import annotations

import os
import re

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.core.database import AcademyStudent, BnExchangeAccount
from src.core.logger import get_logger
from src.core.security import hash_password, verify_password

logger = get_logger(__name__)
router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CENTRAL = os.getenv("CENTRAL_AUTH_URL", "http://10.10.1.1:8100")
_FX = os.getenv("BN_FOREX_SVC_URL", "http://10.10.1.3:8000")
_TOK = lambda: os.getenv("BN_BRIDGE_TOKEN", "")  # noqa: E731


async def _issue_rs256(sid: int, email: str | None, tier: str) -> dict | None:
    """توکنِ RS256 از central-auth با legacy_student_id."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=6.0) as cx:
            r = await cx.post(_CENTRAL + "/auth/issue", headers={"X-Internal-Token": _TOK()},
                              json={"legacy_student_id": sid, "email": email, "tier": tier})
            if r.status_code == 200:
                return r.json()
    except Exception as e:  # noqa: BLE001
        logger.warning("issue_rs256_failed", error=str(e))
    return None


async def _email_sources(email: str, db) -> list[str]:
    """این ایمیل در کدام سیستم‌ها موجود است (برای dedup؛ اپ فقط exists را نشان می‌دهد)."""
    src = []
    em = email.strip().lower()
    row = (await db.execute(text("SELECT 1 FROM academy_students WHERE lower(email)=:e LIMIT 1"), {"e": em})).first()
    if row:
        src.append("prochart")
    try:
        import httpx
        async with httpx.AsyncClient(timeout=4.0) as cx:
            r = await cx.get(_FX + "/user/email-exists", params={"email": em}, headers={"X-Internal-Token": _TOK()})
            if r.status_code == 200 and r.json().get("exists"):
                src.append("forex")
    except Exception:  # noqa: BLE001
        pass
    return src


async def _user_out(st) -> dict:
    return {"email": st.email, "full_name": st.full_name,
            "tier": getattr(st, "tier", "free"),
            "kyc_status": getattr(st, "kyc_status", None) or "none"}


# ── ۰) پروبِ در دسترس‌بودن ──
@router.get("/auth/available")
async def auth_available():
    return {"available": True}


# ── ۱) احراز ──
@router.post("/auth/check-email")
async def check_email(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    em = (payload.get("email") or "").strip().lower()
    if not _EMAIL_RE.match(em):
        return {"exists": False}
    src = await _email_sources(em, db)
    return {"exists": bool(src), "sources": src}


async def do_email_login(raw: dict, db) -> dict:
    """ورودِ ایمیلی — از handlerِ /auth/login صدا زده می‌شود (شاخهٔ email)."""
    em = (raw.get("email") or "").strip().lower()
    pw = raw.get("password") or ""
    if not _EMAIL_RE.match(em):
        raise HTTPException(400, "ایمیلِ معتبر وارد کنید.")
    st = (await db.execute(select(AcademyStudent).where(AcademyStudent.email == em))).scalar_one_or_none()
    if st is None or not st.password_hash or not verify_password(pw, st.password_hash):
        raise HTTPException(401, {"reason": "bad_password"})
    if st.status == "disabled":
        raise HTTPException(403, {"reason": "disabled"})
    tok = await _issue_rs256(st.id, st.email, getattr(st, "tier", "free"))
    if not tok:
        raise HTTPException(503, "صدورِ توکن ناموفق بود.")
    return {"token": tok["access_token"], "refresh_token": tok.get("refresh_token"), "user": await _user_out(st)}


@router.post("/auth/register")
async def register(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    em = (payload.get("email") or "").strip().lower()
    pw = payload.get("password") or ""
    if not _EMAIL_RE.match(em):
        raise HTTPException(400, "ایمیلِ معتبر وارد کنید.")
    if len(pw) < 6:
        raise HTTPException(400, "رمز حداقل ۶ کاراکتر باشد.")
    src = await _email_sources(em, db)
    if src:
        raise HTTPException(409, {"exists": True, "sources": src})
    st = AcademyStudent(username=em, email=em, password_hash=hash_password(pw), tier="free", status="active")
    db.add(st)
    await db.flush()
    tok = await _issue_rs256(st.id, em, "free")
    await db.commit()
    if not tok:
        raise HTTPException(503, "صدورِ توکن ناموفق بود.")
    return {"token": tok["access_token"], "refresh_token": tok.get("refresh_token"), "user": await _user_out(st)}


@router.post("/auth/forgot")
async def forgot(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    em = (payload.get("email") or "").strip().lower()
    # همیشه ۲۰۰ (عدمِ نشتِ وجود)؛ فقط اگر کاربر بود ایمیلِ بازیابی می‌رود.
    if _EMAIL_RE.match(em):
        st = (await db.execute(select(AcademyStudent).where(AcademyStudent.email == em))).scalar_one_or_none()
        if st:
            try:
                from src.core.email_otp import send_password_reset
                await send_password_reset(em, st.id, os.getenv("APP_URL", "https://pro-chart.com"))
            except Exception as e:  # noqa: BLE001
                logger.warning("forgot_send_failed", error=str(e))
    return {"ok": True}


@router.post("/auth/reset")
async def reset(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    token = (payload.get("token") or "").strip()
    new_pw = payload.get("new_password") or ""
    if len(new_pw) < 6:
        raise HTTPException(400, "رمز حداقل ۶ کاراکتر باشد.")
    from src.core.email_otp import consume_reset_token
    sid = await consume_reset_token(token)
    if not sid:
        raise HTTPException(400, "لینکِ بازیابی نامعتبر یا منقضی است.")
    st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if st is None:
        raise HTTPException(404, "حساب یافت نشد.")
    st.password_hash = hash_password(new_pw)
    await db.commit()
    return {"ok": True}


# ── ۳) KYC (هویتِ کاربر — جدا از /academy/bn/kyc بروکر) ──
@router.get("/kyc/status")
async def kyc_status(st: AcademyStudent = Depends(current_student)):
    fields = {"full_name": st.full_name, "mobile": st.phone_number,
              "country": getattr(st, "kyc_country", None)}
    missing = [k for k, v in fields.items() if not v]
    # موبایل برای کاربرِ رایگان اجباری است
    return {"fields": fields, "missing": missing}


@router.post("/kyc")
async def kyc_save(payload: dict = Body(...),
                   st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    mobile = (payload.get("mobile") or "").strip()
    if not mobile or not re.match(r"^[0-9+]{8,15}$", mobile):
        raise HTTPException(400, "شمارهٔ موبایلِ معتبر لازم است.")
    st.phone_number = mobile
    if payload.get("full_name"):
        st.full_name = str(payload["full_name"]).strip()[:120]
    if payload.get("country"):
        st.kyc_country = str(payload["country"]).strip()[:60]
    await db.commit()
    return {"ok": True, "fields": {"full_name": st.full_name, "mobile": st.phone_number,
                                   "country": getattr(st, "kyc_country", None)}}


# ── ۴) رفرال ──
_LBANK_REF = os.getenv("LBANK_REFERRAL_LINK", "https://lbank.com/ref/TRADEYAR")
_ONEROYAL_REF = os.getenv("BROKER_REFERRAL_URL", "https://vc.cabinet.oneroyal.com/links/go/12412")


@router.get("/referral/crypto")
async def referral_crypto(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    acc = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "lbank"))).scalars().first()
    if acc and getattr(acc, "referral_verified", False):
        uid_status = "linked"
    elif acc:
        uid_status = "pending"
    else:
        uid_status = "none"
    return {"lbank_ref_link": _LBANK_REF, "uid_status": uid_status,
            "steps": ["در LBank با لینکِ رفرالِ ما ثبت‌نام کن",
                      "UIDِ حسابت را در بخشِ «اتصال» وارد کن",
                      "حداقلِ واریز/فعال‌سازی را انجام بده",
                      "«تأیید» را بزن تا سیگنالِ کریپتو باز شود"]}


@router.get("/referral/forex")
async def referral_forex(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    acc = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "mt5"))).scalars().first()
    account_status = "linked" if (acc and acc.status == "connected") else ("pending" if acc else "none")
    return {"oneroyal_ref_link": _ONEROYAL_REF, "account_status": account_status,
            "steps": ["در OneRoyal با لینکِ رفرالِ ما حساب باز کن",
                      "حسابِ MT5 را در بخشِ «اتصال» ثبت کن",
                      "«تأیید» را بزن تا سیگنالِ فارکس + کپی‌ترید باز شود"]}


@router.post("/referral/verify")
async def referral_verify(payload: dict = Body(default={}),
                          st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    kind = payload.get("kind", "crypto")
    if kind == "forex":
        acc = (await db.execute(select(BnExchangeAccount).where(
            BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "mt5"))).scalars().first()
        status = "linked" if (acc and acc.status == "connected") else ("pending" if acc else "none")
        return {"account_status": status, "verified": status == "linked"}
    acc = (await db.execute(select(BnExchangeAccount).where(
        BnExchangeAccount.student_id == st.id, BnExchangeAccount.kind == "lbank"))).scalars().first()
    if not acc:
        return {"uid_status": "none", "verified": False}
    # اجرای مجددِ تأییدِ رفرالِ LBank (همان مسیرِ connect/lbank)
    try:
        from src.api.routes._lbank_referral import verify_referral
        ref = await verify_referral(acc.account_ref)
        acc.referral_verified = bool(ref.get("verified"))
        await db.commit()
    except Exception as e:  # noqa: BLE001
        logger.warning("referral_verify_failed", error=str(e))
    return {"uid_status": "linked" if acc.referral_verified else "pending", "verified": bool(acc.referral_verified)}
