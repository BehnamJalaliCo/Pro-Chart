"""B-AUTH — احراز هویتِ ایمیلیِ اجباری + بازیابیِ رمز (Resend) + KYC + رفرال.
هویت روی academy_students؛ توکنِ RS256 از central-auth (/auth/issue). مسیرها ریشه‌ای: /auth /kyc /referral.
"""
from __future__ import annotations

import hashlib
import os
import re
import secrets

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.api.routes.academy import current_student
from src.api.routes.referrals import internal_referral_path
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


async def _send_prochart_welcome(email: str) -> bool:
    """ایمیلِ خوش‌آمدِ Pro-Chart در ثبت‌نام (غیرمسدودکننده، best-effort)."""
    from src.core.config import settings
    key = getattr(settings, "RESEND_API_KEY", "") or os.getenv("RESEND_API_KEY", "")
    if not key:
        return False
    html = (
        '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#0b0f17;padding:32px;'
        'color:#e5e7eb;border-radius:16px;max-width:480px;margin:auto">'
        '<h2 style="color:#2962FF;margin:0 0 8px">🎉 به Pro-Chart خوش آمدی</h2>'
        '<p style="margin:0 0 16px;color:#9ca3af">حسابت با موفقیت ساخته شد. حالا می‌تونی وارد اپ بشی، '
        'سیگنال‌ها رو ببینی و کیف‌پول/کپی‌ترید رو راه‌اندازی کنی.</p>'
        '<a href="https://pro-chart.com" style="display:block;text-align:center;background:#2962FF;color:#fff;'
        'font-weight:800;text-decoration:none;border-radius:12px;padding:14px;font-size:16px">ورود به Pro-Chart</a>'
        '<hr style="border:none;border-top:1px solid #1f2937;margin:20px 0">'
        '<p style="margin:0;color:#6b7280;font-size:12px">اگر این ثبت‌نام کارِ تو نبوده، این ایمیل را نادیده بگیر.<br>'
        '<b style="color:#2962FF">Pro-Chart</b> · <a href="https://pro-chart.com" style="color:#6b7280;text-decoration:none">pro-chart.com</a></p></div>'
    )
    try:
        import httpx
        async with httpx.AsyncClient(timeout=12) as cx:
            r = await cx.post("https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {key}"},
                json={"from": "Pro-Chart <noreply@trade-future.ir>", "to": [email],
                      "subject": "به Pro-Chart خوش آمدی 🎉",
                      "html": html,
                      "text": "به Pro-Chart خوش آمدی! حسابت ساخته شد. ورود: https://pro-chart.com"})
        ok = r.status_code < 300
        logger.info("prochart_welcome_sent", email=email, status=r.status_code) if ok else \
            logger.warning("prochart_welcome_rejected", status=r.status_code, body=r.text[:200])
        return ok
    except Exception as e:  # noqa: BLE001
        logger.warning("prochart_welcome_failed", error=str(e))
        return False


async def _send_prochart_verify(email: str, code: str) -> bool:
    """ایمیلِ کدِ تأییدِ ثبت‌نامِ Pro-Chart (OTP ۶رقمی)."""
    from src.core.config import settings
    key = getattr(settings, "RESEND_API_KEY", "") or os.getenv("RESEND_API_KEY", "")
    if not key:
        return False
    html = (
        '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#0b0f17;padding:32px;'
        'color:#e5e7eb;border-radius:16px;max-width:480px;margin:auto">'
        '<h2 style="color:#2962FF;margin:0 0 8px">✅ تأییدِ ایمیل — Pro-Chart</h2>'
        '<p style="margin:0 0 16px;color:#9ca3af">برای تکمیلِ ثبت‌نام، کدِ زیر را در اپ وارد کنید:</p>'
        f'<div style="text-align:center;background:#111827;border:1px dashed #2962FF;border-radius:12px;'
        'padding:16px;margin:0 0 16px"><div style="color:#9ca3af;font-size:12px">کدِ تأیید</div>'
        f'<div style="color:#2962FF;font-size:32px;font-weight:800;letter-spacing:6px;direction:ltr">{code}</div></div>'
        '<p style="margin:0;color:#6b7280;font-size:13px">این کد تا ۱۵ دقیقه معتبر است. اگر شما ثبت‌نام نکرده‌اید، نادیده بگیرید.</p>'
        '<hr style="border:none;border-top:1px solid #1f2937;margin:20px 0">'
        '<p style="margin:0;color:#6b7280;font-size:12px"><b style="color:#2962FF">Pro-Chart</b> · '
        '<a href="https://pro-chart.com" style="color:#6b7280;text-decoration:none">pro-chart.com</a></p></div>'
    )
    try:
        import httpx
        async with httpx.AsyncClient(timeout=12) as cx:
            r = await cx.post("https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {key}"},
                json={"from": "Pro-Chart <noreply@trade-future.ir>", "to": [email],
                      "subject": "کدِ تأییدِ ثبت‌نامِ Pro-Chart",
                      "html": html, "text": f"کدِ تأییدِ Pro-Chart: {code}\n\nتا ۱۵ دقیقه معتبر است."})
        ok = r.status_code < 300
        logger.info("prochart_verify_sent", email=email, status=r.status_code) if ok else \
            logger.warning("prochart_verify_rejected", status=r.status_code, body=r.text[:200])
        return ok
    except Exception as e:  # noqa: BLE001
        logger.warning("prochart_verify_failed", error=str(e))
        return False


_REG_TTL = 900  # ۱۵ دقیقه
_REG_COOLDOWN = 60


@router.post("/auth/register")
async def register(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """مرحلهٔ ۱: اعتبارسنجی + ارسالِ کدِ تأییدِ ایمیل. توکن در verify صادر می‌شود."""
    import json
    from src.core.redis_client import redis_client
    em = (payload.get("email") or "").strip().lower()
    pw = payload.get("password") or ""
    if not _EMAIL_RE.match(em):
        raise HTTPException(400, "ایمیلِ معتبر وارد کنید.")
    if len(pw) < 6:
        raise HTTPException(400, "رمز حداقل ۶ کاراکتر باشد.")
    src = await _email_sources(em, db)
    if src:
        raise HTTPException(409, {"exists": True, "sources": src})
    if await redis_client.client.get(f"reg_cd:{em}"):
        raise HTTPException(429, {"reason": "cooldown", "msg": "کمی صبر کنید و دوباره تلاش کنید."})
    code = f"{secrets.randbelow(900000) + 100000}"
    await redis_client.client.set(f"reg_pending:{em}", json.dumps({
        "password_hash": hash_password(pw), "code": code,
        "device_id": payload.get("device_id"), "device_name": payload.get("device_name")}), ex=_REG_TTL)
    await redis_client.client.set(f"reg_cd:{em}", "1", ex=_REG_COOLDOWN)
    sent = await _send_prochart_verify(em, code)
    logger.info("register_code_sent", email=em, sent=sent)
    return {"verify_required": True, "email": em, "sent": bool(sent)}


@router.post("/auth/register/verify")
async def register_verify(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """مرحلهٔ ۲: تأییدِ کد → ساختِ حساب + توکن."""
    import json
    from src.core.redis_client import redis_client
    em = (payload.get("email") or "").strip().lower()
    code = str(payload.get("code") or "").strip()
    raw = await redis_client.client.get(f"reg_pending:{em}")
    if not raw:
        raise HTTPException(400, {"reason": "expired", "msg": "کدِ تأیید منقضی شده؛ دوباره ثبت‌نام کنید."})
    data = json.loads(raw)
    if not code or code != data.get("code"):
        raise HTTPException(400, {"reason": "bad_code", "msg": "کدِ تأیید نادرست است."})
    # مبادا در این فاصله ثبت شده باشد
    src = await _email_sources(em, db)
    if src:
        await redis_client.client.delete(f"reg_pending:{em}")
        raise HTTPException(409, {"exists": True, "sources": src})
    st = AcademyStudent(username=em, email=em, password_hash=data["password_hash"],
                        tier="free", status="active", phone_verified=True)
    db.add(st)
    await db.flush()
    await db.commit()
    await redis_client.client.delete(f"reg_pending:{em}")
    try:
        from src.api.routes.bn_gate import grant_forex_trial
        await grant_forex_trial(st, db)
    except Exception:  # noqa: BLE001
        pass
    try:
        await _send_prochart_welcome(em)
    except Exception:  # noqa: BLE001
        pass
    tok = await _issue_rs256(st.id, em, "free")
    if not tok:
        raise HTTPException(503, "صدورِ توکن ناموفق بود.")
    return {"token": tok["access_token"], "refresh_token": tok.get("refresh_token"), "user": await _user_out(st)}


@router.post("/auth/register/resend")
async def register_resend(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """ارسالِ مجددِ کدِ تأیید (کدِ تازه، با کول‌داون)."""
    import json
    from src.core.redis_client import redis_client
    em = (payload.get("email") or "").strip().lower()
    if not _EMAIL_RE.match(em):
        raise HTTPException(400, "ایمیلِ معتبر.")
    raw = await redis_client.client.get(f"reg_pending:{em}")
    if not raw:
        raise HTTPException(400, {"reason": "expired", "msg": "درخواستِ ثبت‌نامی یافت نشد."})
    if await redis_client.client.get(f"reg_cd:{em}"):
        raise HTTPException(429, {"reason": "cooldown"})
    data = json.loads(raw)
    code = f"{secrets.randbelow(900000) + 100000}"
    data["code"] = code
    await redis_client.client.set(f"reg_pending:{em}", json.dumps(data), ex=_REG_TTL)
    await redis_client.client.set(f"reg_cd:{em}", "1", ex=_REG_COOLDOWN)
    sent = await _send_prochart_verify(em, code)
    return {"sent": bool(sent), "email": em}


_RESET_TTL = 1800  # ۳۰ دقیقه


async def _send_prochart_reset(email: str, student_id: int) -> bool:
    """ایمیلِ بازیابیِ رمزِ اختصاصیِ Pro-Chart (جدا از قالبِ آکادمی) — برندِ Pro-Chart، فرستندهٔ Pro-Chart."""
    from src.core.config import settings
    from src.core.redis_client import redis_client
    key = getattr(settings, "RESEND_API_KEY", "") or os.getenv("RESEND_API_KEY", "")
    if not key:
        logger.warning("prochart_reset_no_resend_key")
        return False
    token = secrets.token_urlsafe(32)
    rk = "pwreset:" + hashlib.sha256(token.encode()).hexdigest()  # هم‌فرمت با consume_reset_token
    await redis_client.client.set(rk, str(student_id), ex=_RESET_TTL)
    code = f"{secrets.randbelow(900000) + 100000}"  # کدِ ۶رقمی
    await redis_client.client.set(f"reset_code:{code}", str(student_id), ex=_RESET_TTL)
    link = f"{os.getenv('APP_URL', 'https://pro-chart.com')}/reset-password?token={token}"
    html = (
        '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#0b0f17;padding:32px;'
        'color:#e5e7eb;border-radius:16px;max-width:480px;margin:auto">'
        '<h2 style="color:#2962FF;margin:0 0 8px">🔐 Pro-Chart</h2>'
        '<p style="margin:0 0 16px;color:#9ca3af">درخواستِ بازیابیِ رمزِ حسابِ Pro-Chart دریافت شد. '
        'کدِ بازیابیِ زیر را در اپ وارد کنید، یا روی دکمه بزنید:</p>'
        f'<div style="text-align:center;background:#111827;border:1px dashed #2962FF;border-radius:12px;'
        'padding:16px;margin:0 0 16px"><div style="color:#9ca3af;font-size:12px">کدِ بازیابی</div>'
        f'<div style="color:#2962FF;font-size:32px;font-weight:800;letter-spacing:6px;direction:ltr">{code}</div></div>'
        '<p style="margin:0 0 12px;color:#9ca3af">یا با دکمه:</p>'
        f'<a href="{link}" style="display:block;text-align:center;background:#2962FF;color:#fff;'
        'font-weight:800;text-decoration:none;border-radius:12px;padding:14px;font-size:16px">تنظیمِ رمزِ جدید</a>'
        '<p style="margin:16px 0 0;color:#6b7280;font-size:12px;word-break:break-all">'
        f'اگر دکمه کار نکرد این نشانی را باز کنید:<br>{link}</p>'
        '<p style="margin:12px 0 0;color:#6b7280;font-size:13px">این لینک تا ۳۰ دقیقه معتبر است. '
        'اگر شما درخواست نکرده‌اید، این ایمیل را نادیده بگیرید.</p>'
        '<hr style="border:none;border-top:1px solid #1f2937;margin:20px 0">'
        '<p style="margin:0;color:#6b7280;font-size:12px">این یک ایمیلِ خودکارِ '
        '<b style="color:#2962FF">Pro-Chart</b> است؛ لطفاً پاسخ ندهید.<br>'
        '<a href="https://pro-chart.com" style="color:#6b7280;text-decoration:none">pro-chart.com</a></p></div>'
    )
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15) as cx:
            r = await cx.post("https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {key}"},
                json={"from": "Pro-Chart <noreply@trade-future.ir>", "to": [email],
                      "reply_to": "Pro-Chart <noreply@trade-future.ir>",
                      "subject": "بازیابیِ رمزِ Pro-Chart",
                      "html": html,
                      "text": f"بازیابیِ رمزِ Pro-Chart\n\nکدِ بازیابی: {code}\n\nیا این نشانی را باز کنید:\n{link}\n\nتا ۳۰ دقیقه معتبر است."})
        ok = r.status_code < 300
        if ok:
            logger.info("prochart_reset_sent", email=email, status=r.status_code)
        else:
            logger.warning("prochart_reset_rejected", status=r.status_code, body=r.text[:200])
        return ok
    except Exception as e:  # noqa: BLE001
        logger.error("prochart_reset_send_failed", error=str(e))
        return False


@router.post("/auth/forgot")
async def forgot(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    em = (payload.get("email") or "").strip().lower()
    # همیشه ۲۰۰ (عدمِ نشتِ وجود)؛ فقط اگر کاربر بود ایمیلِ بازیابی می‌رود.
    if _EMAIL_RE.match(em):
        st = (await db.execute(select(AcademyStudent).where(AcademyStudent.email == em))).scalar_one_or_none()
        if st is None:
            # کاربرِ قدیمی (ایمیل در فارکس/کریپتو ولی نه هاب) → شِلِ هاب بساز تا با بازیابی claim کند
            src = await _email_sources(em, db)
            if src:
                st = AcademyStudent(username=em, email=em,
                                    password_hash=hash_password(secrets.token_urlsafe(16)),
                                    tier="free", status="active", account_type="legacy")
                db.add(st)
                await db.flush()
                await db.commit()
                logger.info("forgot_legacy_claim_created", email=em, sid=st.id, sources=src)
        logger.info("forgot_lookup", email=em, found=bool(st))
        if st:
            try:
                res = await _send_prochart_reset(em, st.id)
                logger.info("forgot_send_result", email=em, sent=res)
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
        # کدِ ۶رقمی؟
        try:
            from src.core.redis_client import redis_client
            v = await redis_client.client.get(f"reset_code:{token}")
            if v:
                sid = int(v)
                await redis_client.client.delete(f"reset_code:{token}")
        except Exception:  # noqa: BLE001
            pass
    if not sid:
        raise HTTPException(400, "کد یا لینکِ بازیابی نامعتبر یا منقضی است.")
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
    return {"lbank_ref_link": internal_referral_path("lbank"), "uid_status": uid_status,
            "steps": ["شرایط محل اقامت و ارائه‌دهنده را بررسی کن",
                      "از مسیر «لینک معرفی» وارد وب‌سایت LBank شو",
                      "UIDِ حسابت را در بخشِ «اتصال» وارد کن",
                      "«تأیید» را بزن تا سیگنالِ کریپتو باز شود"]}


@router.get("/referral/forex")
async def referral_forex(
    st: AcademyStudent = Depends(current_student),
    db: AsyncSession = Depends(get_db),
):
    return {"oneroyal_ref_link": internal_referral_path("oneroyal"),
            "referral_path": internal_referral_path("oneroyal"),
            "account_status": "none",
            "integration_level": "referral_only",
            "referral_only": True, "connected": False, "eligible": False, "enabled": False,
            "steps": ["شرایط محل اقامت و ارائه‌دهنده را بررسی کن",
                      "از مسیر «لینک معرفی» وارد وب‌سایت OneRoyal شو",
                      "ادامهٔ ثبت‌نام و ارائهٔ خدمت تابع شرایط OneRoyal است"]}


@router.post("/referral/verify")
async def referral_verify(payload: dict = Body(default={}),
                          st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    kind = payload.get("kind", "crypto")
    if kind == "forex":
        raise HTTPException(410, {
            "reason": "oneroyal_referral_only", "referral_only": True,
            "integration_level": "referral_only", "referral_path": internal_referral_path("oneroyal"),
            "connected": False, "eligible": False, "enabled": False,
        })
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
