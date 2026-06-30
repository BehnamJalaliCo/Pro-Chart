"""
آکادمیِ VIP — APIهای دانش‌آموز (روی /api/academy).

احراز: نام‌کاربری/رمزِ مستقل (ادمین می‌سازد یا ثبت‌نامِ ایمیلی). بدونِ تلگرام.
گیتِ دسترسی بر اساسِ تیرِ دانش‌آموز (free<vip<premium). مربیِ AI در academy.mentor.
مدیریتِ کاملِ ادمین در src/api/routes/admin_academy.py.
"""

from __future__ import annotations

import json
import os
import random
import re
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, Header, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_db
from src.core.config import settings
from src.core.database import (
    AcademyAchievement,
    AcademyCertificate,
    AcademyDevice,
    AcademyJournalEntry,
    AcademyLesson,
    AcademyLessonComment,
    AcademyLessonNote,
    AcademyLessonRating,
    AcademyMentorMessage,
    AcademyMentorThread,
    AcademyPaperPosition,
    AcademyPost,
    AcademyPostReply,
    AcademyPracticeTrade,
    AcademyProgress,
    AcademyQuiz,
    AcademySavedStrategy,
    AcademyStreak,
    AcademyStudent,
    AcademyStudyPlan,
    AcademySubscription,
    AcademyTerminalWorkspace,
    AcademyVideo,
)
from sqlalchemy.orm.attributes import flag_modified
from src.academy.moderation import ai_review, hard_block
from src.core.email_otp import consume_reset_token, request_otp, send_password_reset, verify_otp
from src.core.redis_client import redis_client
from src.llm.client import llm_client
from src.core.logger import get_logger
from src.core.security import create_access_token, hash_password, verify_access_token, verify_password

router = APIRouter()
logger = get_logger(__name__)

_TIER_RANK = {"free": 0, "vip": 1, "premium": 2}
_LEVELS = ["beginner", "intermediate", "advanced", "ai", "mt4", "mt5"]
_LEVEL_FA = {"beginner": "مقدماتی", "intermediate": "متوسط", "advanced": "پیشرفته", "ai": "حرفه‌ای",
             "mt4": "متاتریدر ۴ (MT4)", "mt5": "متاتریدر ۵ (MT5)"}
_USERNAME_RE = re.compile(r"^[A-Za-z0-9_.]{3,64}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^(\+?98|0)?9\d{9}$")        # موبایلِ ایران
MAX_DEVICES = 2                                       # سقفِ دستگاهِ هم‌زمان per کاربر
_VIDEO_SAFE = re.compile(r"^[A-Za-z0-9._-]+\.(mp4|m3u8|ts|webm)$")
_EDU_DIR = os.environ.get("EDU_ASSETS_DIR", "/app/edu_assets")


def _norm_device_id(raw: str | None, ua: str | None) -> str:
    """شناسهٔ دستگاه: اثرانگشتِ فرانت یا فالبکِ هشِ User-Agent."""
    import hashlib
    raw = (raw or "").strip()[:80]
    if raw:
        return raw
    return "ua-" + hashlib.sha256((ua or "x").encode()).hexdigest()[:24]


def _device_name(ua: str | None) -> str:
    ua = (ua or "").lower()
    os_ = ("iPhone" if "iphone" in ua else "iPad" if "ipad" in ua else "Android" if "android" in ua
           else "Windows" if "windows" in ua else "Mac" if "mac" in ua else "Linux" if "linux" in ua else "دستگاه")
    br = ("Chrome" if "chrome" in ua and "edg" not in ua else "Edge" if "edg" in ua else "Safari" if "safari" in ua
          else "Firefox" if "firefox" in ua else "مرورگر")
    return f"{br} روی {os_}"


# ── احراز ──
async def current_student(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> AcademyStudent:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="ورود لازم است.")
    p = verify_access_token(authorization.split(" ", 1)[1].strip())
    if not p or p.get("scope") != "academy":
        raise HTTPException(status_code=401, detail="توکنِ نامعتبر.")
    sid = int(p.get("sid", 0) or 0)
    # حالتِ standalone (سرورِ Pro-Chart): توکن فقط با امضا اعتبارسنجی می‌شود (همان JWT_SECRET_KEY
    # سرورِ اصلی)؛ هویت از claimها ساخته می‌شود، بدونِ نیاز به DBِ دانشجویانِ سرورِ اصلی.
    if os.getenv("BN_STANDALONE_AUTH") == "1":
        if sid <= 0:
            raise HTTPException(status_code=401, detail="توکنِ نامعتبر.")
        # دانشجو را در DBِ محلیِ Pro-Chart در صورتِ نبود می‌سازیم تا FKهای bn_* برقرار بمانند
        # (هویت از توکنِ آکادمی می‌آید؛ این سرور DBِ مستقلِ خود را دارد).
        st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
        if st is None:
            st = AcademyStudent(
                id=sid, username=f"student-{sid}", password_hash="!standalone",
                tier=(p.get("tier") if p.get("tier") in _TIER_RANK else "vip"),
                status="active", phone_number="standalone",
            )
            db.add(st)
            try:
                await db.commit()
                await db.refresh(st)
            except Exception:
                await db.rollback()
                st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
        return st
    st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if st is None or st.status != "active":
        raise HTTPException(status_code=403, detail="حساب غیرفعال است.")
    # اعتبارِ دستگاه: توکنِ جدید did دارد؛ اگر آن دستگاه حذف شده باشد → خروج (توکن‌های قدیمیِ بدونِ did مجازند تا انقضا)
    did = p.get("did")
    if did:
        dev = (await db.execute(select(AcademyDevice).where(
            AcademyDevice.student_id == sid, AcademyDevice.device_id == did))).scalar_one_or_none()
        if dev is None:
            raise HTTPException(status_code=401, detail="این دستگاه از حسابِ شما حذف شده است؛ دوباره وارد شوید.")
    return st


def _effective_tier(st: AcademyStudent) -> str:
    """تیرِ مؤثر: اگر منقضی شده → free."""
    now = datetime.now(timezone.utc)
    if st.expires_at is not None and st.expires_at <= now:
        return "free"
    return st.tier if st.tier in _TIER_RANK else "free"


def _can_access(lesson_tier: str, utier: str) -> bool:
    return _TIER_RANK.get(utier, 0) >= _TIER_RANK.get(lesson_tier or "vip", 1)


def _phone_ok(st: AcademyStudent) -> bool:
    """vip/premium بدونِ شماره موبایل → سطح‌های پولی قفل می‌مانند تا شماره وارد کنند."""
    if _effective_tier(st) == "free":
        return True
    return bool(st.phone_number)


def _lesson_locked(lesson_tier: str, st: AcademyStudent):
    """(locked, reason) — reason: tier / phone / None."""
    et = _effective_tier(st)
    if not _can_access(lesson_tier, et):
        return True, "tier"
    if (lesson_tier or "vip") != "free" and not _phone_ok(st):
        return True, "phone"
    return False, None


async def require_vip(st: AcademyStudent = Depends(current_student)) -> AcademyStudent:
    """گیتِ بخش‌های ویژه: فقط VIP/پرمیومِ فعال. کاربرِ رایگان/منقضی → ۴۰۳."""
    if _TIER_RANK.get(_effective_tier(st), 0) < 1:
        raise HTTPException(status_code=403,
                            detail="این بخش ویژهٔ اعضای VIP است. برای دسترسی، اشتراک تهیه کنید.")
    return st


@router.post("/auth/login")
async def login(username: str = Body(..., embed=True), password: str = Body(..., embed=True),
                device_id: str | None = Body(None, embed=True), device_name: str | None = Body(None, embed=True),
                user_agent: str | None = Header(None), x_forwarded_for: str | None = Header(None),
                db: AsyncSession = Depends(get_db)):
    """ورودِ دانش‌آموز — با سقفِ ۲ دستگاهِ هم‌زمان (ضدِ اشتراکِ حساب)."""
    uname = (username or "").strip().lower()
    # ورودِ جامع: با نام‌کاربری یا ایمیل
    st = (await db.execute(select(AcademyStudent).where(
        (AcademyStudent.username == uname) | (AcademyStudent.email == uname)))).scalar_one_or_none()
    if st is None or not verify_password(password or "", st.password_hash):
        raise HTTPException(status_code=401, detail="نام‌کاربری/ایمیل یا رمز اشتباه است.")
    if st.status != "active":
        raise HTTPException(status_code=403, detail="حسابِ شما غیرفعال است؛ با پشتیبانی تماس بگیرید.")
    did = _norm_device_id(device_id, user_agent)
    now = datetime.now(timezone.utc)
    devices = (await db.execute(select(AcademyDevice).where(AcademyDevice.student_id == st.id))).scalars().all()
    existing = next((d for d in devices if d.device_id == did), None)
    if existing is None and len(devices) >= MAX_DEVICES:
        # سقفِ دستگاه پر است → بلاک + توکنِ کوتاهِ مدیریت برای حذفِ یکی از دستگاه‌ها
        manage = create_access_token({"sub": f"student:{st.id}", "scope": "academy_manage", "sid": st.id},
                                     expires_delta=timedelta(minutes=15))
        return {"device_limit": True, "max": MAX_DEVICES, "manage_token": manage,
                "devices": [{"id": d.id, "name": d.device_name,
                             "last_seen": d.last_seen_at.isoformat() if d.last_seen_at else None} for d in devices]}
    ip = (x_forwarded_for or "").split(",")[0].strip()[:45] or None
    if existing:
        existing.last_seen_at = now
        if ip:
            existing.ip = ip
    else:
        db.add(AcademyDevice(student_id=st.id, device_id=did,
                             device_name=(device_name or _device_name(user_agent))[:180],
                             user_agent=(user_agent or "")[:400], ip=ip, last_seen_at=now))
    st.last_login_at = now
    await db.commit()
    token = create_access_token({"sub": f"student:{st.id}", "scope": "academy", "sid": st.id, "did": did})
    return {"token": token, "username": st.username, "tier": _effective_tier(st),
            "account_type": getattr(st, "account_type", None)}


# ── مدیریتِ دستگاه‌ها ──
@router.get("/devices")
async def list_devices(authorization: str | None = Header(None), st: AcademyStudent = Depends(current_student),
                       db: AsyncSession = Depends(get_db)):
    p = verify_access_token((authorization or "").split(" ", 1)[-1].strip()) or {}
    cur = p.get("did")
    rows = (await db.execute(select(AcademyDevice).where(AcademyDevice.student_id == st.id).order_by(AcademyDevice.id))).scalars().all()
    return {"max": MAX_DEVICES, "devices": [{"id": d.id, "name": d.device_name, "ip": d.ip,
            "current": d.device_id == cur,
            "last_seen": d.last_seen_at.isoformat() if d.last_seen_at else None} for d in rows]}


@router.delete("/devices/{device_id}")
async def remove_device(device_id: int, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    d = (await db.execute(select(AcademyDevice).where(AcademyDevice.id == device_id, AcademyDevice.student_id == st.id))).scalar_one_or_none()
    if d is None:
        raise HTTPException(404, "دستگاه یافت نشد.")
    await db.delete(d); await db.commit()
    return {"ok": True}


@router.post("/auth/remove-device")
async def remove_device_premanage(manage_token: str = Body(..., embed=True), device_id: int = Body(..., embed=True),
                                  db: AsyncSession = Depends(get_db)):
    """حذفِ دستگاه پیش از ورود (وقتی سقف پر است) با توکنِ مدیریتِ کوتاه."""
    p = verify_access_token((manage_token or "").strip())
    if not p or p.get("scope") != "academy_manage":
        raise HTTPException(401, "توکنِ مدیریت نامعتبر است.")
    sid = int(p.get("sid", 0) or 0)
    d = (await db.execute(select(AcademyDevice).where(AcademyDevice.id == device_id, AcademyDevice.student_id == sid))).scalar_one_or_none()
    if d is None:
        raise HTTPException(404, "دستگاه یافت نشد.")
    await db.delete(d); await db.commit()
    return {"ok": True}


@router.post("/auth/register/request")
async def register_request(email: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    """مرحلهٔ ۱ ثبت‌نامِ رایگان: ارسالِ کدِ تأیید به ایمیل (Resend)."""
    if not settings.ACADEMY_SELF_REGISTER:
        raise HTTPException(status_code=403, detail="ثبت‌نام فعلاً غیرفعال است.")
    em = (email or "").strip().lower()
    if not _EMAIL_RE.match(em):
        raise HTTPException(status_code=400, detail="ایمیلِ معتبر وارد کنید.")
    dup = (await db.execute(select(AcademyStudent).where(AcademyStudent.email == em))).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=409, detail="این ایمیل قبلاً ثبت‌نام کرده؛ وارد شوید.")
    res = await request_otp(em, brand="academy", ttl=120)  # کد ۲ دقیقه معتبر است
    if not res.get("sent"):
        if res.get("cooldown"):
            raise HTTPException(status_code=429, detail=f"کد به‌تازگی ارسال شده؛ {res['cooldown']} ثانیه صبر کنید.")
        raise HTTPException(status_code=502, detail=res.get("error", "ارسالِ ایمیل ناموفق بود."))
    return {"sent": True, "cooldown": res.get("cooldown", 60), "ttl": res.get("ttl", 120)}


@router.post("/auth/register/verify")
async def register_verify(
    email: str = Body(..., embed=True), code: str = Body(..., embed=True),
    username: str = Body(..., embed=True), password: str = Body(..., embed=True),
    full_name: str = Body("", embed=True), account_type: str = Body("", embed=True),
    db: AsyncSession = Depends(get_db),
):
    """مرحلهٔ ۲: تأییدِ کد + ساختِ حسابِ رایگان."""
    if not settings.ACADEMY_SELF_REGISTER:
        raise HTTPException(status_code=403, detail="ثبت‌نام فعلاً غیرفعال است.")
    em = (email or "").strip().lower()
    uname = (username or "").strip().lower()
    # نام‌کاربری الزامی است (ورود بعداً با نام‌کاربری یا ایمیل ممکن است).
    if not _USERNAME_RE.match(uname):
        raise HTTPException(status_code=400, detail="نام‌کاربری الزامی است: ۳ تا ۶۴ کاراکترِ انگلیسی/عدد/_/. .")
    if len(password or "") < 6:
        raise HTTPException(status_code=400, detail="رمز حداقل ۶ کاراکتر.")
    if not await verify_otp(em, code):
        raise HTTPException(status_code=400, detail="کدِ تأیید اشتباه یا منقضی است.")
    if (await db.execute(select(AcademyStudent).where(AcademyStudent.username == uname))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="این نام‌کاربری قبلاً گرفته شده.")
    if (await db.execute(select(AcademyStudent).where(AcademyStudent.email == em))).scalar_one_or_none():
        raise HTTPException(status_code=409, detail="این ایمیل قبلاً ثبت‌نام کرده.")
    st = AcademyStudent(username=uname, password_hash=hash_password(password),
                        email=em, full_name=(full_name or None), tier="free", status="active",
                        account_type=(account_type if account_type in ("crypto", "broker") else None))
    db.add(st)
    await db.commit()
    token = create_access_token({"sub": f"student:{st.id}", "scope": "academy", "sid": st.id})
    logger.info("academy_self_register", sid=st.id)
    return {"token": token, "username": st.username, "tier": "free"}


@router.post("/auth/forgot-password")
async def forgot_password(email: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    """درخواستِ بازیابیِ رمز: لینکِ امن به ایمیلِ دانش‌آموز فرستاده می‌شود.
    ضدِ افشا: پاسخ همیشه موفق است (نمی‌گوید ایمیل ثبت‌شده هست یا نه)."""
    em = (email or "").strip().lower()
    if not _EMAIL_RE.match(em):
        raise HTTPException(status_code=400, detail="ایمیلِ معتبر وارد کنید.")
    st = (await db.execute(select(AcademyStudent).where(AcademyStudent.email == em))).scalar_one_or_none()
    if st is not None and st.status == "active":
        res = await send_password_reset(em, st.id, settings.ACADEMY_APP_URL)
        if not res.get("sent") and res.get("cooldown"):
            raise HTTPException(status_code=429,
                                detail=f"ایمیل به‌تازگی ارسال شده؛ {res['cooldown']} ثانیه صبر کنید.")
    return {"sent": True}


@router.post("/auth/reset-password")
async def reset_password_self(token: str = Body(..., embed=True), password: str = Body(..., embed=True),
                              db: AsyncSession = Depends(get_db)):
    """تنظیمِ رمزِ جدید با توکنِ یک‌بارمصرفِ داخلِ لینکِ ایمیل."""
    if len(password or "") < 6:
        raise HTTPException(status_code=400, detail="رمز حداقل ۶ کاراکتر باشد.")
    sid = await consume_reset_token((token or "").strip())
    if not sid:
        raise HTTPException(status_code=400, detail="لینکِ بازیابی نامعتبر یا منقضی است. دوباره درخواست دهید.")
    st = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == sid))).scalar_one_or_none()
    if st is None:
        raise HTTPException(status_code=404, detail="حساب یافت نشد.")
    st.password_hash = hash_password(password)
    await db.commit()
    logger.info("academy_password_reset", sid=sid)
    return {"ok": True}


@router.post("/auth/bn-guest")
async def bn_guest():
    """ورودِ مهمانِ مستقلِ بازارنما (Pro-Chart) — بدونِ نیاز به حسابِ آکادمی.
    داربستِ ثبت‌نامِ مستقلِ آینده؛ فعلاً یک هویتِ مهمانِ یکتا (range ۹xx) می‌دهد تا بازارنما
    کاملاً مستقل از آکادمی کار کند. فقط در سرورِ standalone فعال است."""
    import secrets
    if os.getenv("BN_STANDALONE_AUTH") != "1":
        raise HTTPException(status_code=404, detail="یافت نشد.")
    sid = 900_000_000 + secrets.randbelow(99_000_000)  # محدودهٔ مهمان، جدا از دانشجویانِ واقعی
    # مهمان = free: چارت/واچ‌لیست/اندیکاتور/ترسیم آزاد است، اما قابلیت‌های پرمیوم
    # (هوشِ مصنوعی، اسکریپت‌نویسی، ترید روی چارت) قفل‌اند تا کاربر ثبت‌نام/واریز/تأیید شود.
    token = create_access_token(
        {"sub": f"student:{sid}", "scope": "academy", "sid": sid, "tier": "free", "guest": True}
    )
    logger.info("bn_guest_issued", sid=sid)
    return {"token": token, "guest": True, "tier": "free"}


@router.get("/pricing")
async def pricing():
    """عمومی — تیرها، قیمت‌ها و آدرسِ کیفِ‌پولِ BEP-20."""
    return {
        "currency": "USDT", "network": "BEP-20 (BSC)",
        "wallet": settings.ACADEMY_BEP20_ADDRESS or "",
        "self_register": settings.ACADEMY_SELF_REGISTER,
        "tiers": [
            {"key": "free", "name": "رایگان", "price_monthly": 0,
             "tagline": "آشنایی و نمونه",
             "perks": ["۵ درسِ مقدماتیِ نمونه", "مربیِ AI — ۱۰ سوال در روز", "بدونِ ویدیو"]},
            {"key": "vip", "name": "VIP", "price_monthly": settings.ACADEMY_PRICE_VIP_MONTHLY,
             "tagline": "دورهٔ کاملِ معامله‌گری",
             "perks": ["مسیرِ مقدماتی + متوسط (۷۵+ درس)", "همهٔ ویدیوهای آموزشی",
                       "مربیِ AI — ۸۰ سوال در روز", "آزمون و گواهیِ پیشرفت"]},
            {"key": "premium", "name": "پرمیوم", "price_monthly": settings.ACADEMY_PRICE_PREMIUM_MONTHLY,
             "tagline": "حرفه‌ای + مربیِ شخصی",
             "perks": ["همه‌چیزِ VIP", "سطحِ پیشرفته/حرفه‌ای (۴۰ درسِ انحصاری)",
                       "نقدِ تصویریِ معاملهٔ شما توسطِ مربیِ AI", "مربیِ AI — ۳۰۰ سوال در روز",
                       "پشتیبانیِ اولویت‌دار + وبینار"]},
        ],
    }


_LEVEL_BADGE = {"beginner": "🥉 مبتدیِ تأییدشده", "intermediate": "🥈 متوسطِ تأییدشده",
                "advanced": "🥇 پیشرفتهٔ تأییدشده", "ai": "🏆 حرفه‌ای"}


# ── نشان‌ها (گیمیفیکیشن) ──
_ACHIEVEMENTS = [
    {"key": "first_lesson", "title": "اولین قدم", "desc": "اولین درست را کامل کردی.", "icon": "🎯"},
    {"key": "lessons_10", "title": "ده‌تایی", "desc": "۱۰ درس را کامل کردی.", "icon": "🔟"},
    {"key": "lessons_50", "title": "نیمه‌راه", "desc": "۵۰ درس را کامل کردی.", "icon": "🏃"},
    {"key": "lessons_100", "title": "صدتایی", "desc": "۱۰۰ درس را کامل کردی.", "icon": "💯"},
    {"key": "streak_7", "title": "هفتهٔ آتشین", "desc": "۷ روزِ پیاپی فعال بودی.", "icon": "🔥"},
    {"key": "streak_30", "title": "ماراتن", "desc": "۳۰ روزِ پیاپی فعال بودی.", "icon": "🏅"},
    {"key": "perfect_quiz", "title": "نمرهٔ کامل", "desc": "در یک آزمون نمرهٔ ۱۰۰ گرفتی.", "icon": "⭐"},
    {"key": "level_master_beginner", "title": "استادِ مقدماتی", "desc": "سطحِ مقدماتی را کامل کردی.", "icon": "🥉"},
    {"key": "level_master_intermediate", "title": "استادِ متوسط", "desc": "سطحِ متوسط را کامل کردی.", "icon": "🥈"},
    {"key": "level_master_advanced", "title": "استادِ پیشرفته", "desc": "سطحِ پیشرفته را کامل کردی.", "icon": "🥇"},
    {"key": "level_master_ai", "title": "استادِ حرفه‌ای", "desc": "سطحِ حرفه‌ای را کامل کردی.", "icon": "👑"},
]


def _strip_html(s: str) -> str:
    return re.sub(r"<[^>]+>", " ", s or "")


async def _resolve_lesson(db: AsyncSession, slug: str) -> AcademyLesson:
    """درس را با slug پیدا می‌کند؛ اگر نبود → ۴۰۴."""
    l = (await db.execute(select(AcademyLesson).where(AcademyLesson.slug == slug))).scalar_one_or_none()
    if l is None or not l.is_published:
        raise HTTPException(status_code=404, detail="درس یافت نشد.")
    return l


def _mask_username(uname: str) -> str:
    u = uname or ""
    return (u[:2] + "***") if u else "***"


async def _award_and_streak(db: AsyncSession, st: AcademyStudent) -> dict:
    """به‌روزرسانیِ استریک + اعطای نشان‌ها (idempotent). برمی‌گرداند نشان‌های تازه + استریک."""
    today = datetime.now(timezone.utc).date()
    # استریک
    streak = (await db.execute(select(AcademyStreak).where(
        AcademyStreak.student_id == st.id))).scalar_one_or_none()
    if streak is None:
        streak = AcademyStreak(student_id=st.id, current_streak=1, longest_streak=1, last_active_date=today)
        db.add(streak)
    else:
        last = streak.last_active_date
        if last == today:
            pass  # امروز قبلاً ثبت شده
        elif last == today - timedelta(days=1):
            streak.current_streak = (streak.current_streak or 0) + 1
        else:
            streak.current_streak = 1
        streak.longest_streak = max(streak.longest_streak or 0, streak.current_streak or 0)
        streak.last_active_date = today
    cur_streak = streak.current_streak or 0

    # تعدادِ دروسِ کامل‌شده
    done_count = (await db.execute(select(func.count()).select_from(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.status == "completed"))).scalar() or 0
    # بیشترین نمرهٔ آزمون
    max_quiz = (await db.execute(select(func.max(AcademyProgress.quiz_score)).where(
        AcademyProgress.student_id == st.id, AcademyProgress.status == "completed"))).scalar()

    earned = {a.badge for a in (await db.execute(select(AcademyAchievement).where(
        AcademyAchievement.student_id == st.id))).scalars().all()}
    to_award: list[str] = []

    def _try(key: str, cond: bool):
        if cond and key not in earned and key not in to_award:
            to_award.append(key)

    _try("first_lesson", done_count >= 1)
    _try("lessons_10", done_count >= 10)
    _try("lessons_50", done_count >= 50)
    _try("lessons_100", done_count >= 100)
    _try("streak_7", cur_streak >= 7)
    _try("streak_30", cur_streak >= 30)
    _try("perfect_quiz", max_quiz is not None and max_quiz >= 100)
    for lv in ("beginner", "intermediate", "advanced", "ai"):
        if await _mastered(db, st.id, lv):
            _try(f"level_master_{lv}", True)

    for key in to_award:
        db.add(AcademyAchievement(student_id=st.id, badge=key))
    return {"new_achievements": to_award, "streak": {"current": cur_streak}}


@router.get("/me")
async def me(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    tier = _effective_tier(st)
    prog = (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.status == "completed"))).scalars().all()
    done_ids = {p.lesson_id for p in prog}
    quiz_scores = [p.quiz_score for p in prog if p.quiz_score is not None]
    lessons = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True)))).scalars().all()
    total = len(lessons)
    # XP: هر درس ۱۰ امتیاز + سهمِ نمرهٔ آزمون
    xp = len(done_ids) * 10 + sum(quiz_scores)
    # پیشرفت + نشانِ هر سطح (تسلط = همهٔ دروسِ آن سطح کامل)
    by_level, badges = {}, []
    for lv in _LEVELS:
        lv_lessons = [l for l in lessons if l.level == lv]
        if not lv_lessons:
            continue
        d = sum(1 for l in lv_lessons if l.id in done_ids)
        by_level[lv] = {"name": _LEVEL_FA.get(lv, lv), "done": d, "total": len(lv_lessons),
                        "mastered": d == len(lv_lessons)}
        if d == len(lv_lessons):
            badges.append(_LEVEL_BADGE.get(lv, lv))
    avg_quiz = round(sum(quiz_scores) / len(quiz_scores)) if quiz_scores else None
    streak = (await db.execute(select(AcademyStreak).where(
        AcademyStreak.student_id == st.id))).scalar_one_or_none()
    streak_out = {"current": streak.current_streak or 0, "longest": streak.longest_streak or 0} if streak else {"current": 0, "longest": 0}
    ach_count = (await db.execute(select(func.count()).select_from(AcademyAchievement).where(
        AcademyAchievement.student_id == st.id))).scalar() or 0
    return {"username": st.username, "full_name": st.full_name, "tier": tier,
            "account_type": getattr(st, "account_type", None),
            "phone_number": st.phone_number,
            "phone_required": (not st.phone_number),
            "expires_at": st.expires_at.isoformat() if st.expires_at else None,
            "completed": len(done_ids), "total_lessons": total,
            "progress_pct": round(100 * len(done_ids) / max(1, total), 1),
            "xp": xp, "badges": badges, "by_level": by_level,
            "quizzes_taken": len(quiz_scores), "avg_quiz": avg_quiz,
            "streak": streak_out, "achievements_count": ach_count}


@router.get("/catalog")
async def catalog(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    tier = _effective_tier(st)
    rows = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True))
            .order_by(AcademyLesson.level, AcademyLesson.order_in_level))).scalars().all()
    prog = {p.lesson_id: p.status for p in (await db.execute(
        select(AcademyProgress).where(AcademyProgress.student_id == st.id))).scalars().all()}
    vids = {v.lesson_id for v in (await db.execute(
        select(AcademyVideo).where(AcademyVideo.status == "ready"))).scalars().all()}
    levels: dict[str, list] = {lv: [] for lv in _LEVELS}
    for l in rows:
        locked, reason = _lesson_locked(l.min_tier, st)
        levels.setdefault(l.level, []).append({
            "slug": l.slug, "title": l.title_fa, "order": l.order_in_level, "tier": l.min_tier,
            "locked": locked, "lock_reason": reason,
            "completed": prog.get(l.id) == "completed", "has_video": l.id in vids})
    return {"tier": tier, "levels": [
        {"key": lv, "name": _LEVEL_FA.get(lv, lv), "lessons": levels.get(lv, [])}
        for lv in _LEVELS if levels.get(lv)]}


@router.get("/lesson/{slug}")
async def lesson(slug: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = (await db.execute(select(AcademyLesson).where(AcademyLesson.slug == slug))).scalar_one_or_none()
    if l is None or not l.is_published:
        raise HTTPException(status_code=404, detail="درس یافت نشد.")
    locked, reason = _lesson_locked(l.min_tier, st)
    if locked:
        if reason == "phone":
            raise HTTPException(status_code=403, detail="برای بازکردنِ سطح‌های حرفه‌ای، شمارهٔ موبایلت را در پروفایل وارد کن.")
        raise HTTPException(status_code=403, detail="این درس نیازمندِ اشتراکِ بالاتر است.")
    p = (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.lesson_id == l.id))).scalar_one_or_none()
    if p is None:
        db.add(AcademyProgress(student_id=st.id, lesson_id=l.id, status="started"))
        await db.commit()
    vid = (await db.execute(select(AcademyVideo).where(
        AcademyVideo.lesson_id == l.id, AcademyVideo.status == "ready")
        .order_by(AcademyVideo.id.desc()))).scalars().first()
    video_url = None
    if vid:
        # لینکِ خامِ ویدیو لو نمی‌رود: توکنِ کوتاهِ بسته به دانش‌آموز
        vt = create_access_token({"scope": "academy_video", "sid": st.id, "vid": vid.id},
                                 expires_delta=timedelta(hours=3))
        video_url = f"/api/academy/video/{vid.id}?t={vt}"
    reading_time_min = max(1, round(len(_strip_html(l.content_fa or "")) / 900))
    return {"slug": l.slug, "level": l.level, "title": l.title_fa, "summary": l.summary_fa,
            "content": l.content_fa, "diagram_image": l.diagram_image, "tier": l.min_tier,
            "video_url": video_url,
            "video_duration": vid.duration_sec if vid else None,
            "reading_time_min": reading_time_min,
            "watermark": st.username}


@router.get("/video/{video_id}")
async def stream_video(video_id: int, t: str = "", db: AsyncSession = Depends(get_db)):
    """سروِ امنِ ویدیوی درس با توکنِ کوتاهِ بسته به دانش‌آموز (لینکِ خام افشا نمی‌شود)."""
    from fastapi.responses import FileResponse, RedirectResponse
    p = verify_access_token((t or "").strip())
    if not p or p.get("scope") != "academy_video" or int(p.get("vid", 0) or 0) != int(video_id):
        raise HTTPException(status_code=403, detail="لینکِ ویدیو نامعتبر یا منقضی است.")
    vid = (await db.execute(select(AcademyVideo).where(AcademyVideo.id == video_id))).scalar_one_or_none()
    if vid is None or not vid.hls_url:
        raise HTTPException(status_code=404, detail="ویدیو یافت نشد.")
    name = os.path.basename(vid.hls_url.split("?")[0])
    if not _VIDEO_SAFE.match(name):
        if vid.hls_url.startswith("http"):
            return RedirectResponse(vid.hls_url)
        raise HTTPException(status_code=400, detail="نامِ ویدیو نامعتبر است.")
    path = os.path.join(_EDU_DIR, name)
    if not os.path.isfile(path):
        if vid.hls_url.startswith("http"):
            return RedirectResponse(vid.hls_url)
        raise HTTPException(status_code=404, detail="فایلِ ویدیو یافت نشد.")
    return FileResponse(path, headers={"Cache-Control": "private, no-store, max-age=0", "Content-Disposition": "inline"})


@router.post("/profile")
async def update_profile(full_name: str | None = Body(None, embed=True), phone: str | None = Body(None, embed=True),
                         country: str | None = Body(None, embed=True),
                         st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """به‌روزرسانیِ پروفایل — شمارهٔ موبایل برای فعال‌سازیِ حساب لازم است (داخلی + بین‌المللی)."""
    if full_name is not None:
        st.full_name = (full_name.strip()[:120] or None)
    if phone is not None:
        raw = (phone or "").strip()
        digits = re.sub(r"[^\d]", "", raw)
        is_intl = raw.startswith("+")
        if digits:
            # ایران: 98 + 9xxxxxxxxx یا 9xxxxxxxxx (بدونِ صفر) → 0xxxxxxxxxx
            iran = re.fullmatch(r"(?:98)?(9\d{9})", digits)
            if iran:
                st.phone_number = "0" + iran.group(1)
            elif is_intl and 8 <= len(digits) <= 15:
                st.phone_number = "+" + digits
            elif _PHONE_RE.match(digits):
                st.phone_number = "0" + digits[-10:]
            else:
                raise HTTPException(status_code=400, detail="شمارهٔ موبایلِ معتبر وارد کن (بدونِ صفر و کدِ کشور).")
            st.phone_verified = True
            if country:
                st.notes = (st.notes or "")  # کشور صرفاً جهتِ آینده؛ نگه‌داری نمی‌شود
    await db.commit()
    return {"ok": True, "full_name": st.full_name, "phone_number": st.phone_number,
            "phone_required": not st.phone_number}


@router.post("/progress/{slug}")
async def set_progress(slug: str, quiz_score: int | None = Body(None, embed=True),
                       st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = (await db.execute(select(AcademyLesson).where(AcademyLesson.slug == slug))).scalar_one_or_none()
    if l is None:
        raise HTTPException(status_code=404, detail="درس یافت نشد.")
    p = (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.lesson_id == l.id))).scalar_one_or_none()
    if p is None:
        p = AcademyProgress(student_id=st.id, lesson_id=l.id)
        db.add(p)
    p.status = "completed"
    p.completed_at = datetime.now(timezone.utc)
    if quiz_score is not None:
        p.quiz_score = int(quiz_score)
    await db.commit()
    award = await _award_and_streak(db, st)
    await db.commit()
    return {"ok": True, "slug": slug, "status": "completed",
            "new_achievements": award["new_achievements"], "streak": award["streak"]}


# ── امتیاز/نظرِ درس ──
@router.post("/lesson/{slug}/rate")
async def rate_lesson(slug: str, stars: int = Body(..., embed=True), review: str | None = Body(None, embed=True),
                      st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await _resolve_lesson(db, slug)
    s = int(stars)
    if s < 1 or s > 5:
        raise HTTPException(status_code=400, detail="امتیاز باید بینِ ۱ تا ۵ باشد.")
    rev = (review or "").strip()[:2000] or None
    r = (await db.execute(select(AcademyLessonRating).where(
        AcademyLessonRating.student_id == st.id, AcademyLessonRating.lesson_id == l.id))).scalar_one_or_none()
    if r is None:
        db.add(AcademyLessonRating(student_id=st.id, lesson_id=l.id, stars=s, review=rev))
    else:
        r.stars = s
        r.review = rev
    await db.commit()
    agg = (await db.execute(select(func.avg(AcademyLessonRating.stars), func.count())
           .where(AcademyLessonRating.lesson_id == l.id))).first()
    avg = float(agg[0]) if agg and agg[0] is not None else 0.0
    return {"ok": True, "avg": round(avg, 1), "count": int(agg[1] or 0)}


@router.get("/lesson/{slug}/rating")
async def lesson_rating(slug: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await _resolve_lesson(db, slug)
    agg = (await db.execute(select(func.avg(AcademyLessonRating.stars), func.count())
           .where(AcademyLessonRating.lesson_id == l.id))).first()
    avg = float(agg[0]) if agg and agg[0] is not None else 0.0
    mine = (await db.execute(select(AcademyLessonRating).where(
        AcademyLessonRating.student_id == st.id, AcademyLessonRating.lesson_id == l.id))).scalar_one_or_none()
    return {"avg": round(avg, 1), "count": int(agg[1] or 0),
            "my_stars": mine.stars if mine else None, "my_review": mine.review if mine else None}


# ── بحث/پرسشِ زیرِ درس ──
@router.get("/lesson/{slug}/comments")
async def lesson_comments(slug: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await _resolve_lesson(db, slug)
    rows = (await db.execute(select(AcademyLessonComment, AcademyStudent.username)
            .join(AcademyStudent, AcademyLessonComment.student_id == AcademyStudent.id)
            .where(AcademyLessonComment.lesson_id == l.id, AcademyLessonComment.status == "published")
            .order_by(AcademyLessonComment.id.desc()).limit(100))).all()
    return {"items": [{"id": c.id, "author": _mask_username(uname), "content": c.content,
                       "created_at": c.created_at.isoformat() if c.created_at else None,
                       "mine": c.student_id == st.id} for c, uname in rows]}


@router.post("/lesson/{slug}/comment")
async def lesson_comment(slug: str, content: str = Body(..., embed=True),
                         st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await _resolve_lesson(db, slug)
    text = (content or "").strip()
    if len(text) < 5:
        raise HTTPException(status_code=400, detail="متن خیلی کوتاه است.")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="متن خیلی بلند است.")
    reason = hard_block(text)
    if reason:
        raise HTTPException(status_code=400, detail=f"دیدگاه منتشر نشد: شاملِ {reason} است. اشتراکِ اطلاعاتِ تماس/لینک/تبلیغ مجاز نیست.")
    status = "published" if await ai_review(text) else "pending"
    db.add(AcademyLessonComment(lesson_id=l.id, student_id=st.id, content=text, status=status))
    await db.commit()
    return {"ok": True, "status": status}


# ── یادداشتِ شخصیِ درس ──
@router.get("/lesson/{slug}/note")
async def lesson_note_get(slug: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await _resolve_lesson(db, slug)
    n = (await db.execute(select(AcademyLessonNote).where(
        AcademyLessonNote.student_id == st.id, AcademyLessonNote.lesson_id == l.id))).scalar_one_or_none()
    return {"content": (n.content or "") if n else ""}


@router.put("/lesson/{slug}/note")
async def lesson_note_put(slug: str, content: str = Body(..., embed=True),
                          st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    l = await _resolve_lesson(db, slug)
    body = (content or "")[:20000]
    n = (await db.execute(select(AcademyLessonNote).where(
        AcademyLessonNote.student_id == st.id, AcademyLessonNote.lesson_id == l.id))).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if n is None:
        db.add(AcademyLessonNote(student_id=st.id, lesson_id=l.id, content=body, updated_at=now))
    else:
        n.content = body
        n.updated_at = now
    await db.commit()
    return {"ok": True}


# ── استریک ──
@router.get("/streak")
async def streak_get(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(AcademyStreak).where(AcademyStreak.student_id == st.id))).scalar_one_or_none()
    if s is None:
        return {"current": 0, "longest": 0, "last_active": None, "today_done": False}
    today = datetime.now(timezone.utc).date()
    return {"current": s.current_streak or 0, "longest": s.longest_streak or 0,
            "last_active": s.last_active_date.isoformat() if s.last_active_date else None,
            "today_done": s.last_active_date == today}


# ── نشان‌ها ──
@router.get("/achievements")
async def achievements(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    earned = {a.badge: a.earned_at for a in (await db.execute(select(AcademyAchievement).where(
        AcademyAchievement.student_id == st.id))).scalars().all()}
    items = []
    for a in _ACHIEVEMENTS:
        is_earned = a["key"] in earned
        items.append({"badge": a["key"], "title": a["title"], "desc": a["desc"], "icon": a["icon"],
                      "earned": is_earned,
                      "earned_at": earned[a["key"]].isoformat() if (is_earned and earned[a["key"]]) else None})
    return {"items": items, "earned_count": sum(1 for i in items if i["earned"]), "total": len(_ACHIEVEMENTS)}


# ── جدولِ امتیازات ──
@router.get("/leaderboard")
async def leaderboard(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(AcademyProgress.student_id, func.count(), func.coalesce(func.sum(AcademyProgress.quiz_score), 0))
        .where(AcademyProgress.status == "completed")
        .group_by(AcademyProgress.student_id))).all()
    ranked = []
    for sid, cnt, sumq in rows:
        ranked.append({"student_id": sid, "xp": int(cnt) * 10 + int(sumq or 0), "completed": int(cnt)})
    ranked.sort(key=lambda r: r["xp"], reverse=True)
    total_students = (await db.execute(select(func.count()).select_from(AcademyStudent))).scalar() or 0
    # رتبهٔ من بینِ همه
    my_rank = None
    for idx, r in enumerate(ranked, start=1):
        if r["student_id"] == st.id:
            my_rank = idx
            break
    top = ranked[:50]
    sids = [r["student_id"] for r in top]
    names = {}
    if sids:
        for sid, uname in (await db.execute(select(AcademyStudent.id, AcademyStudent.username)
                           .where(AcademyStudent.id.in_(sids)))).all():
            names[sid] = uname
    items = [{"rank": idx, "username": names.get(r["student_id"], "—"), "xp": r["xp"],
              "completed": r["completed"], "is_me": r["student_id"] == st.id}
             for idx, r in enumerate(top, start=1)]
    return {"items": items, "my_rank": my_rank, "total_students": total_students}


# ── نقشهٔ راهِ سطح (ماژول‌بندی) ──
@router.get("/lessons/{level}/roadmap")
async def level_roadmap(level: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    if level not in _LEVELS:
        raise HTTPException(status_code=404, detail="سطح نامعتبر.")
    rows = (await db.execute(select(AcademyLesson).where(
        AcademyLesson.level == level, AcademyLesson.is_published.is_(True))
        .order_by(AcademyLesson.order_in_level))).scalars().all()
    prog = {p.lesson_id: p.status for p in (await db.execute(
        select(AcademyProgress).where(AcademyProgress.student_id == st.id))).scalars().all()}
    lessons = []
    for l in rows:
        locked, _reason = _lesson_locked(l.min_tier, st)
        lessons.append({"slug": l.slug, "title": l.title_fa, "order": l.order_in_level,
                        "completed": prog.get(l.id) == "completed", "locked": locked})
    modules = []
    for i in range(0, len(lessons), 8):
        chunk = lessons[i:i + 8]
        idx = i // 8
        modules.append({"index": idx, "title": f"ماژول {idx + 1}", "lessons": chunk,
                        "done": sum(1 for x in chunk if x["completed"]), "total": len(chunk)})
    return {"level": level, "name": _LEVEL_FA.get(level), "modules": modules}


# ── ترمینال: سینکِ چیدمانِ نمودارِ هر دانش‌آموز (بین‌دستگاه) ──
@router.get("/terminal/workspace")
async def terminal_workspace_get(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    w = (await db.execute(select(AcademyTerminalWorkspace).where(
        AcademyTerminalWorkspace.student_id == st.id))).scalar_one_or_none()
    return {"layout": (w.layout if w else None)}


@router.put("/terminal/workspace")
async def terminal_workspace_put(layout: dict = Body(..., embed=True),
                                 st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """upsert چیدمانِ ترمینال — هر شیِ JSON پذیرفته می‌شود (سقفِ ~۱۰۰ کیلوبایتِ سریال‌شده)."""
    if not isinstance(layout, dict):
        raise HTTPException(status_code=400, detail="چیدمان باید یک شیِ JSON باشد.")
    try:
        size = len(json.dumps(layout, ensure_ascii=False).encode("utf-8"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="چیدمانِ نامعتبر.")
    if size > 100_000:
        raise HTTPException(status_code=400, detail="چیدمان خیلی بزرگ است (سقف ۱۰۰ کیلوبایت).")
    now = datetime.now(timezone.utc)
    w = (await db.execute(select(AcademyTerminalWorkspace).where(
        AcademyTerminalWorkspace.student_id == st.id))).scalar_one_or_none()
    if w is None:
        db.add(AcademyTerminalWorkspace(student_id=st.id, layout=layout, updated_at=now))
    else:
        w.layout = layout
        w.updated_at = now
    await db.commit()
    return {"ok": True}


# ── درختِ مهارت (نقشهٔ پیش‌نیازمحور) ──
@router.get("/lessons/skilltree")
async def skill_tree(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """درختِ مهارت: هر سطحِ منتشرشده → ماژول‌های ۸‌تایی با قفلِ پیش‌نیازی.

    یک ماژول باز است اگر ماژولِ ۰ سطحِ مقدماتی باشد یا ماژولِ قبلیِ همان سطح کاملاً انجام شده باشد.
    """
    rows = (await db.execute(select(AcademyLesson).where(
        AcademyLesson.is_published.is_(True))
        .order_by(AcademyLesson.level, AcademyLesson.order_in_level))).scalars().all()
    prog = {p.lesson_id: p.status for p in (await db.execute(
        select(AcademyProgress).where(AcademyProgress.student_id == st.id))).scalars().all()}
    by_level: dict[str, list] = {}
    for l in rows:
        by_level.setdefault(l.level, []).append(l)
    levels_out = []
    for lv in _LEVELS:
        lv_rows = by_level.get(lv)
        if not lv_rows:
            continue
        lessons = []
        for l in lv_rows:
            locked, _reason = _lesson_locked(l.min_tier, st)
            lessons.append({"slug": l.slug, "title": l.title_fa,
                            "completed": prog.get(l.id) == "completed", "locked": locked})
        modules = []
        prev_done_all = True       # «ماژولِ قبلی»؛ پیش از اولین ماژول → True
        prev_title = None
        for i in range(0, len(lessons), 8):
            chunk = lessons[i:i + 8]
            idx = i // 8
            done = sum(1 for x in chunk if x["completed"])
            total = len(chunk)
            unlocked = (lv == "beginner" and idx == 0) or prev_done_all
            modules.append({"index": idx, "title": f"ماژول {idx + 1}", "lessons": chunk,
                            "done": done, "total": total, "unlocked": unlocked,
                            "prereq": (prev_title if idx > 0 else None)})
            prev_done_all = (done == total and total > 0)
            prev_title = f"ماژول {idx + 1}"
        levels_out.append({"level": lv, "name": _LEVEL_FA.get(lv, lv), "modules": modules})
    return {"levels": levels_out}


_EDU_DIR = os.environ.get("EDU_ASSETS_DIR", "/app/edu_assets")


# ── جستجو در دروس ──
@router.get("/search")
async def search(q: str = "", st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    term = (q or "").strip()
    if len(term) < 2:
        return {"results": []}
    tier = _effective_tier(st)
    like = f"%{term}%"
    rows = (await db.execute(select(AcademyLesson).where(
        AcademyLesson.is_published.is_(True),
        AcademyLesson.title_fa.ilike(like) | AcademyLesson.content_fa.ilike(like))
        .order_by(AcademyLesson.level, AcademyLesson.order_in_level).limit(40))).scalars().all()
    return {"results": [{"slug": l.slug, "title": l.title_fa, "level": _LEVEL_FA.get(l.level, l.level),
                         "locked": not _can_access(l.min_tier, tier)} for l in rows]}


# ── جستجوی سراسری (دروس + واژه‌نامه + انجمن) ──
def _load_glossary() -> list:
    path = os.path.join(_EDU_DIR, "glossary.json")
    if not os.path.isfile(path):
        return []
    try:
        data = json.load(open(path, encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception:  # noqa: BLE001
        return []


@router.get("/search/global")
async def search_global(q: str = "", st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """جستجوی سراسری در سه منبع: دروس، واژه‌نامه و پست‌های انجمن."""
    term = (q or "").strip()
    if len(term) < 2:
        return {"q": term, "lessons": [], "glossary": [], "posts": [],
                "counts": {"lessons": 0, "glossary": 0, "posts": 0}}
    tier = _effective_tier(st)
    like = f"%{term}%"

    # دروس
    lrows = (await db.execute(select(AcademyLesson).where(
        AcademyLesson.is_published.is_(True),
        AcademyLesson.title_fa.ilike(like) | AcademyLesson.content_fa.ilike(like))
        .order_by(AcademyLesson.level, AcademyLesson.order_in_level).limit(15))).scalars().all()
    lessons = [{"slug": l.slug, "title": l.title_fa, "level": _LEVEL_FA.get(l.level, l.level),
                "locked": not _can_access(l.min_tier, tier)} for l in lrows]

    # واژه‌نامه (فیلترِ بدونِ حساسیت به حروف روی term/def)
    tl = term.lower()
    glossary = []
    for g in _load_glossary():
        if not isinstance(g, dict):
            continue
        t = str(g.get("term", ""))
        d = str(g.get("def", g.get("definition", "")))
        if tl in t.lower() or tl in d.lower():
            glossary.append({"term": t, "def": d, "cat": g.get("cat", g.get("category"))})
        if len(glossary) >= 15:
            break

    # پست‌های انجمن
    prows = (await db.execute(select(AcademyPost).where(
        AcademyPost.status == "published",
        AcademyPost.content.ilike(like)).order_by(AcademyPost.id.desc()).limit(10))).scalars().all()
    posts = [{"id": p.id, "content": (p.content or "")[:120], "category": p.category,
              "created_at": p.created_at.isoformat() if p.created_at else None} for p in prows]

    return {"q": term, "lessons": lessons, "glossary": glossary, "posts": posts,
            "counts": {"lessons": len(lessons), "glossary": len(glossary), "posts": len(posts)}}


@router.get("/search/suggestions")
async def search_suggestions(prefix: str = "", st: AcademyStudent = Depends(current_student),
                             db: AsyncSession = Depends(get_db)):
    """پیشنهادِ خودکار: عنوانِ دروسی که با prefix شروع می‌شوند."""
    pre = (prefix or "").strip()
    if len(pre) < 1:
        return {"items": []}
    like = f"{pre}%"
    rows = (await db.execute(select(AcademyLesson.title_fa).where(
        AcademyLesson.is_published.is_(True),
        AcademyLesson.title_fa.ilike(like))
        .order_by(AcademyLesson.level, AcademyLesson.order_in_level).limit(8))).all()
    return {"items": [r[0] for r in rows if r[0]]}


# ── واژه‌نامه ──
@router.get("/glossary")
async def glossary(st: AcademyStudent = Depends(current_student)):
    path = os.path.join(_EDU_DIR, "glossary.json")
    if not os.path.isfile(path):
        return {"terms": []}
    try:
        return {"terms": json.load(open(path, encoding="utf-8"))}
    except Exception:  # noqa: BLE001
        return {"terms": []}


# ── چیت‌شیتِ هر سطح ──
@router.get("/cheatsheet/{level}")
async def cheatsheet(level: str, st: AcademyStudent = Depends(current_student)):
    if level not in _LEVELS:
        raise HTTPException(status_code=404, detail="سطح نامعتبر.")
    if _TIER_RANK.get(_effective_tier(st), 0) < 1 and level not in ("beginner",):
        raise HTTPException(status_code=403, detail="این چیت‌شیت ویژهٔ اشتراک است.")
    path = os.path.join(_EDU_DIR, f"cheatsheet-{level}.json")
    if not os.path.isfile(path):
        return {"title": _LEVEL_FA.get(level, level), "points": []}
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {"title": _LEVEL_FA.get(level, level), "points": []}


# ── آزمونِ هر درس ──
@router.get("/lesson/{slug}/quiz")
async def lesson_quiz(slug: str, st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """سوال‌های آزمونِ یک درس (بدونِ پاسخِ درست)."""
    l = (await db.execute(select(AcademyLesson).where(AcademyLesson.slug == slug))).scalar_one_or_none()
    if l is None or not l.is_published:
        raise HTTPException(status_code=404, detail="درس یافت نشد.")
    if not _can_access(l.min_tier, _effective_tier(st)):
        raise HTTPException(status_code=403, detail="این درس نیازمندِ اشتراکِ بالاتر است.")
    qs = (await db.execute(select(AcademyQuiz).where(AcademyQuiz.lesson_id == l.id)
          .order_by(AcademyQuiz.id))).scalars().all()
    p = (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.lesson_id == l.id))).scalar_one_or_none()
    return {"slug": slug, "count": len(qs),
            "last_score": p.quiz_score if p else None,
            "questions": [{"id": q.id, "question": q.question_fa, "options": q.options} for q in qs]}


@router.post("/lesson/{slug}/quiz/submit")
async def submit_quiz(slug: str, answers: dict = Body(..., embed=True),
                      st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """تصحیحِ آزمون: answers = {quiz_id: chosen_index}. نمره + پاسخِ درست + توضیح."""
    l = (await db.execute(select(AcademyLesson).where(AcademyLesson.slug == slug))).scalar_one_or_none()
    if l is None:
        raise HTTPException(status_code=404, detail="درس یافت نشد.")
    if not _can_access(l.min_tier, _effective_tier(st)):
        raise HTTPException(status_code=403, detail="دسترسی ندارید.")
    qs = (await db.execute(select(AcademyQuiz).where(AcademyQuiz.lesson_id == l.id))).scalars().all()
    if not qs:
        raise HTTPException(status_code=404, detail="این درس آزمون ندارد.")
    results, correct = [], 0
    for q in qs:
        chosen = answers.get(str(q.id), answers.get(q.id))
        ok = (chosen is not None and int(chosen) == q.correct_index)
        if ok:
            correct += 1
        results.append({"id": q.id, "correct_index": q.correct_index, "your_index": chosen,
                        "is_correct": ok, "explanation": q.explanation_fa})
    score = round(100 * correct / max(1, len(qs)))
    passed = score >= 60
    p = (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.lesson_id == l.id))).scalar_one_or_none()
    if p is None:
        p = AcademyProgress(student_id=st.id, lesson_id=l.id); db.add(p)
    if p.quiz_score is None or score > p.quiz_score:
        p.quiz_score = score
    if passed:
        p.status = "completed"; p.completed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"score": score, "correct": correct, "total": len(qs), "passed": passed, "results": results}


# ── ژورنالِ معاملاتی ──
def _journal_dict(j: AcademyJournalEntry) -> dict:
    f = lambda v: float(v) if v is not None else None
    return {"id": j.id, "symbol": j.symbol, "direction": j.direction, "entry": f(j.entry),
            "exit": f(j.exit), "size": f(j.size), "pnl": f(j.pnl), "emotion": j.emotion,
            "note": j.note, "lesson_learned": j.lesson_learned,
            "tags": j.tags if isinstance(j.tags, list) else [],
            "screenshot_url": j.screenshot_url, "ai_review": j.ai_review,
            "created_at": j.created_at.isoformat() if j.created_at else None}


@router.get("/journal")
async def journal_list(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AcademyJournalEntry).where(AcademyJournalEntry.student_id == st.id)
            .order_by(AcademyJournalEntry.id.desc()).limit(200))).scalars().all()
    return {"entries": [_journal_dict(j) for j in rows]}


@router.post("/journal")
async def journal_create(
    symbol: str = Body("", embed=True), direction: str = Body("", embed=True),
    entry: float | None = Body(None, embed=True), exit: float | None = Body(None, embed=True),
    size: float | None = Body(None, embed=True), pnl: float | None = Body(None, embed=True),
    emotion: str = Body("", embed=True), note: str = Body("", embed=True),
    lesson_learned: str = Body("", embed=True),
    tags: list | None = Body(None, embed=True), screenshot_url: str = Body("", embed=True),
    st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db),
):
    clean_tags = [str(t).strip()[:40] for t in tags if str(t).strip()][:12] if isinstance(tags, list) else None
    j = AcademyJournalEntry(student_id=st.id, symbol=(symbol or None)[:30] if symbol else None,
                            direction=(direction or None), entry=entry, exit=exit, size=size, pnl=pnl,
                            emotion=(emotion or None), note=(note or None), lesson_learned=(lesson_learned or None),
                            tags=(clean_tags or None),
                            screenshot_url=((screenshot_url or "").strip()[:1000] or None))
    db.add(j)
    await db.commit()
    return _journal_dict(j)


@router.delete("/journal/{jid}")
async def journal_delete(jid: int, st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    j = (await db.execute(select(AcademyJournalEntry).where(
        AcademyJournalEntry.id == jid, AcademyJournalEntry.student_id == st.id))).scalar_one_or_none()
    if j is None:
        raise HTTPException(status_code=404, detail="یافت نشد.")
    await db.delete(j)
    await db.commit()
    return {"ok": True}


@router.post("/journal/{jid}/ai-review")
async def journal_ai_review(jid: int, st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """بازبینیِ AIِ یک معاملهٔ ژورنال (مالکِ خودش): سنجشِ ریسک + ۲-۳ نکتهٔ بهبود."""
    j = (await db.execute(select(AcademyJournalEntry).where(
        AcademyJournalEntry.id == jid, AcademyJournalEntry.student_id == st.id))).scalar_one_or_none()
    if j is None:
        raise HTTPException(status_code=404, detail="یافت نشد.")
    f = lambda v: (str(round(float(v), 5)) if v is not None else "—")
    facts = (
        f"نماد: {j.symbol or '—'}. جهت: {j.direction or '—'}. ورود: {f(j.entry)}. خروج: {f(j.exit)}. "
        f"سود/زیان: {f(j.pnl)}. احساس: {j.emotion or '—'}. "
        f"یادداشت: {(j.note or '—')[:600]}. درسِ گرفته‌شده: {(j.lesson_learned or '—')[:600]}.")
    review = await llm_client.complete(
        "تو مربیِ معامله‌گریِ حرفه‌ای هستی. این معاملهٔ ثبت‌شدهٔ دانش‌آموز را بازبینی کن: "
        "ابتدا یک سنجشِ کوتاهِ ریسک بده، سپس ۲ تا ۳ نکتهٔ مشخصِ بهبود به‌صورتِ فهرست. "
        "فارسی، صمیمی و دقیق، حداکثر ۷ جمله.\n\nمعامله: " + facts,
        system="تو مربیِ معامله‌گری هستی و معاملاتِ دانش‌آموز را بازبینیِ ریسک‌محور می‌کنی.",
        system_replace=True, timeout=50) or "بازبینی در دسترس نیست."
    j.ai_review = review
    await db.commit()
    return {"ai_review": review}


@router.get("/journal/stats")
async def journal_stats(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AcademyJournalEntry).where(
        AcademyJournalEntry.student_id == st.id))).scalars().all()
    pnls = [float(j.pnl) for j in rows if j.pnl is not None]
    wins = [p for p in pnls if p > 0]
    by_emotion: dict[str, int] = {}
    for j in rows:
        if j.emotion:
            by_emotion[j.emotion] = by_emotion.get(j.emotion, 0) + 1
    return {"total": len(rows), "with_pnl": len(pnls),
            "net_pnl": round(sum(pnls), 2), "win_rate": round(100 * len(wins) / len(pnls)) if pnls else None,
            "avg_win": round(sum(wins) / len(wins), 2) if wins else None,
            "by_emotion": by_emotion}


# ── انجمن (جامعه) ──
async def _post_dict(p: AcademyPost, db: AsyncSession) -> dict:
    author = (await db.execute(select(AcademyStudent.username, AcademyStudent.full_name)
              .where(AcademyStudent.id == p.student_id))).first()
    name = (author[1] or author[0]) if author else "—"
    return {"id": p.id, "content": p.content, "author": name, "likes": p.likes,
            "replies_count": p.replies_count, "status": p.status, "category": p.category,
            "reactions": p.reactions if isinstance(p.reactions, dict) else {},
            "best_reply_id": p.best_reply_id,
            "created_at": p.created_at.isoformat() if p.created_at else None}


_POST_CATS = ("تحلیل", "سوال", "تجربه", "اخبار", "عمومی")
_REACT_EMOJIS = ("👍", "🔥", "🤔", "❤️", "💡")


@router.get("/community")
async def community_feed(page: int = 1, category: str = "",
                        st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    per = 20
    q = select(AcademyPost).where(AcademyPost.status == "published")
    if category in _POST_CATS:
        q = q.where(AcademyPost.category == category)
    rows = (await db.execute(q.order_by(AcademyPost.id.desc())
            .limit(per).offset((page - 1) * per))).scalars().all()
    posts = []
    for p in rows:
        d = await _post_dict(p, db)
        try:
            d["liked"] = bool(await redis_client.client.sismember(f"academy:likes:{p.id}", str(st.id)))
        except Exception:  # noqa: BLE001
            d["liked"] = False
        posts.append(d)
    return {"posts": posts}


@router.post("/community")
async def community_post(content: str = Body(..., embed=True), category: str = Body("عمومی", embed=True),
                         st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    text = (content or "").strip()
    cat = category if category in _POST_CATS else "عمومی"
    if len(text) < 5:
        raise HTTPException(status_code=400, detail="متن خیلی کوتاه است.")
    if len(text) > 2000:
        raise HTTPException(status_code=400, detail="متن خیلی بلند است.")
    # محدودیتِ نرخ: حداکثر ۱۰ پست در ۲۴ ساعت
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    cnt = (await db.execute(select(func.count()).select_from(AcademyPost)
           .where(AcademyPost.student_id == st.id, AcademyPost.created_at >= since))).scalar() or 0
    if cnt >= 10:
        raise HTTPException(status_code=429, detail="امروز به سقفِ ارسالِ پست رسیدی.")
    # مودراسیون: بلاکِ سخت → رد؛ بررسیِ AI → انتشار یا صفِ بازبینی
    reason = hard_block(text)
    if reason:
        raise HTTPException(status_code=400, detail=f"پست منتشر نشد: شاملِ {reason} است. اشتراکِ اطلاعاتِ تماس/لینک/تبلیغ مجاز نیست.")
    status = "published" if await ai_review(text) else "pending"
    p = AcademyPost(student_id=st.id, content=text, status=status, category=cat)
    db.add(p)
    await db.commit()
    return {"id": p.id, "status": status,
            "message": "منتشر شد." if status == "published" else "برای بازبینیِ ادمین ارسال شد."}


@router.get("/community/search")
async def community_search(q: str = "", st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """جست‌وجوی پست‌های منتشرشده بر اساسِ متن (حداقل ۲ کاراکتر)."""
    term = (q or "").strip()
    if len(term) < 2:
        return {"items": []}
    rows = (await db.execute(select(AcademyPost).where(
        AcademyPost.status == "published",
        AcademyPost.content.ilike(f"%{term}%")).order_by(AcademyPost.id.desc()).limit(30))).scalars().all()
    items = []
    for p in rows:
        a = (await db.execute(select(AcademyStudent.username).where(AcademyStudent.id == p.student_id))).first()
        items.append({"id": p.id, "content": (p.content or "")[:200], "category": p.category,
                      "author": _mask_username(a[0] if a else ""), "likes": p.likes,
                      "replies_count": p.replies_count,
                      "created_at": p.created_at.isoformat() if p.created_at else None})
    return {"items": items}


@router.get("/community/{pid}")
async def community_detail(pid: int, st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(AcademyPost).where(AcademyPost.id == pid))).scalar_one_or_none()
    if p is None or p.status != "published":
        raise HTTPException(status_code=404, detail="پست یافت نشد.")
    replies = (await db.execute(select(AcademyPostReply).where(
        AcademyPostReply.post_id == pid, AcademyPostReply.status == "published")
        .order_by(AcademyPostReply.id))).scalars().all()
    out_replies = []
    for r in replies:
        a = (await db.execute(select(AcademyStudent.username, AcademyStudent.full_name)
             .where(AcademyStudent.id == r.student_id))).first()
        out_replies.append({"id": r.id, "content": r.content, "author": (a[1] or a[0]) if a else "—",
                            "parent_id": r.parent_id,
                            "is_best": (p.best_reply_id is not None and r.id == p.best_reply_id),
                            "created_at": r.created_at.isoformat() if r.created_at else None})
    return {"post": await _post_dict(p, db), "replies": out_replies}


@router.post("/community/{pid}/reply")
async def community_reply(pid: int, content: str = Body(..., embed=True),
                          parent_id: int | None = Body(None, embed=True),
                          st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(AcademyPost).where(AcademyPost.id == pid))).scalar_one_or_none()
    if p is None or p.status != "published":
        raise HTTPException(status_code=404, detail="پست یافت نشد.")
    text = (content or "").strip()
    if len(text) < 2:
        raise HTTPException(status_code=400, detail="متنِ کوتاه.")
    parent = None
    if parent_id:
        par = (await db.execute(select(AcademyPostReply).where(
            AcademyPostReply.id == parent_id, AcademyPostReply.post_id == pid))).scalar_one_or_none()
        if par is None:
            raise HTTPException(status_code=400, detail="پاسخِ والد نامعتبر است.")
        parent = parent_id
    reason = hard_block(text)
    if reason:
        raise HTTPException(status_code=400, detail=f"پاسخ منتشر نشد: شاملِ {reason} است.")
    status = "published" if await ai_review(text) else "pending"
    db.add(AcademyPostReply(post_id=pid, student_id=st.id, content=text, status=status, parent_id=parent))
    if status == "published":
        p.replies_count = (p.replies_count or 0) + 1
    await db.commit()
    return {"status": status}


@router.post("/community/{pid}/like")
async def community_like(pid: int, st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """لایکِ یک‌بار per کاربر (toggle) — با مجموعهٔ Redis، ضدِ لایکِ فیک."""
    p = (await db.execute(select(AcademyPost).where(AcademyPost.id == pid))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="یافت نشد.")
    key = f"academy:likes:{pid}"
    r = redis_client.client
    if await r.sismember(key, str(st.id)):
        await r.srem(key, str(st.id)); liked = False
    else:
        await r.sadd(key, str(st.id)); liked = True
    cnt = int(await r.scard(key))
    p.likes = cnt
    await db.commit()
    return {"likes": cnt, "liked": liked}


@router.post("/community/{pid}/react")
async def community_react(pid: int, emoji: str = Body(..., embed=True),
                          st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """ری‌اکشنِ toggle per کاربر per ایموجی — با مجموعهٔ Redis؛ شمارش در reactions ذخیره می‌شود."""
    emoji = (emoji or "").strip()
    if emoji not in _REACT_EMOJIS:
        raise HTTPException(status_code=400, detail="ایموجی مجاز نیست.")
    p = (await db.execute(select(AcademyPost).where(AcademyPost.id == pid))).scalar_one_or_none()
    if p is None or p.status != "published":
        raise HTTPException(status_code=404, detail="یافت نشد.")
    r = redis_client.client
    key = f"academy:react:{pid}:{emoji}"
    if await r.sismember(key, str(st.id)):
        await r.srem(key, str(st.id))
    else:
        await r.sadd(key, str(st.id))
    counts: dict[str, int] = {}
    mine: list[str] = []
    for e in _REACT_EMOJIS:
        k = f"academy:react:{pid}:{e}"
        c = int(await r.scard(k))
        if c > 0:
            counts[e] = c
        if await r.sismember(k, str(st.id)):
            mine.append(e)
    p.reactions = counts
    flag_modified(p, "reactions")
    await db.commit()
    return {"reactions": counts, "mine": mine}


@router.post("/community/{pid}/best-reply/{rid}")
async def community_best_reply(pid: int, rid: int,
                               st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """نویسندهٔ پست یک پاسخ را به‌عنوانِ «بهترین» انتخاب می‌کند (rid=0 برای پاک‌کردن)."""
    p = (await db.execute(select(AcademyPost).where(AcademyPost.id == pid))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="پست یافت نشد.")
    if p.student_id != st.id:
        raise HTTPException(status_code=403, detail="فقط نویسندهٔ پست می‌تواند پاسخِ برگزیده را تعیین کند.")
    if rid == 0:
        p.best_reply_id = None
        await db.commit()
        return {"ok": True, "best_reply_id": None}
    rep = (await db.execute(select(AcademyPostReply).where(
        AcademyPostReply.id == rid, AcademyPostReply.post_id == pid))).scalar_one_or_none()
    if rep is None:
        raise HTTPException(status_code=400, detail="پاسخ نامعتبر است.")
    p.best_reply_id = rid
    await db.commit()
    return {"ok": True, "best_reply_id": rid}


@router.post("/community/{pid}/report")
async def community_report(pid: int, st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(AcademyPost).where(AcademyPost.id == pid))).scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="یافت نشد.")
    p.reports = (p.reports or 0) + 1
    if p.reports >= 3 and p.status == "published":
        p.status = "pending"; p.flag_reason = "گزارشِ کاربران"
    await db.commit()
    return {"ok": True}


# ── تمرینِ بک‌تست (روی دادهٔ تاریخیِ واقعی) ──
@router.get("/backtest")
async def backtest(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """یک پنجرهٔ تصادفیِ تاریخی از کندل‌ها برمی‌گرداند: ۵۰ کندلِ اول دیده می‌شود،
    ۳۰ کندلِ بعدی «آینده» است که کاربر بعد از معامله می‌بیند."""
    combos = (await db.execute(text(
        "SELECT symbol, timeframe, count(*) c FROM candles GROUP BY symbol, timeframe "
        "HAVING count(*) >= 100 ORDER BY c DESC LIMIT 25"))).fetchall()
    if not combos:
        raise HTTPException(status_code=404, detail="دادهٔ کافی برای تمرین نیست.")
    sym, tf, total = random.choice(combos)
    win = 80
    offset = random.randint(0, max(0, int(total) - win - 1))
    rows = (await db.execute(text(
        "SELECT time, open, high, low, close FROM candles WHERE symbol=:s AND timeframe=:t "
        "ORDER BY time LIMIT :w OFFSET :o"), {"s": sym, "t": tf, "w": win, "o": offset})).fetchall()
    candles = [{"o": float(r[1]), "h": float(r[2]), "l": float(r[3]), "c": float(r[4])} for r in rows]
    return {"symbol": sym, "timeframe": tf, "reveal_from": 50, "candles": candles}


# ── چارتِ زنده + مربیِ تحلیلِ AI ──
def _ma(arr, p):
    return sum(arr[-p:]) / p if len(arr) >= p else None


def _rsi(closes, p=14):
    if len(closes) <= p:
        return None
    g = l = 0.0
    for i in range(1, p + 1):
        ch = closes[i] - closes[i - 1]
        g += max(ch, 0); l += max(-ch, 0)
    g /= p; l /= p
    for i in range(p + 1, len(closes)):
        ch = closes[i] - closes[i - 1]
        g = (g * (p - 1) + max(ch, 0)) / p
        l = (l * (p - 1) + max(-ch, 0)) / p
    return round(100 - 100 / (1 + g / (l or 1e-9)), 1)


def _swing_points(candles, win=3):
    """نقاطِ سوینگ به‌صورتِ (اندیس، قیمت)."""
    highs, lows = [], []
    for i in range(win, len(candles) - win):
        seg = candles[i - win:i + win + 1]
        if candles[i]["h"] == max(c["h"] for c in seg):
            highs.append((i, candles[i]["h"]))
        if candles[i]["l"] == min(c["l"] for c in seg):
            lows.append((i, candles[i]["l"]))
    return highs, lows


def _cluster_zone(prices, tol=0.004):
    """نزدیک‌ترین خوشهٔ قیمت‌ها → ناحیه (lo, hi)."""
    if not prices:
        return None
    prices = sorted(prices)
    best, cur = [prices[0]], [prices[0]]
    for p in prices[1:]:
        if abs(p - cur[-1]) / cur[-1] <= tol:
            cur.append(p)
        else:
            if len(cur) > len(best):
                best = cur
            cur = [p]
    if len(cur) > len(best):
        best = cur
    return (min(best), max(best))


def _trendline(points):
    """رگرسیونِ خطی روی نقاطِ سوینگ → دو انتهای خط (i,p)."""
    if len(points) < 2:
        return None
    xs = [p[0] for p in points]; ys = [p[1] for p in points]
    n = len(xs); sx = sum(xs); sy = sum(ys)
    sxx = sum(x * x for x in xs); sxy = sum(x * y for x, y in zip(xs, ys))
    denom = (n * sxx - sx * sx) or 1e-9
    m = (n * sxy - sx * sy) / denom
    b = (sy - m * sx) / n
    i1, i2 = min(xs), max(xs)
    return {"i1": i1, "p1": round(m * i1 + b, 5), "i2": i2, "p2": round(m * i2 + b, 5)}


async def _chart_rows(db, symbol, tf, limit=130, before=None):
    q = ("SELECT time,open,high,low,close,COALESCE(volume,0) FROM candles WHERE symbol=:s AND timeframe=:t "
         + ("AND time <= to_timestamp(:b) " if before else "")
         + "ORDER BY time DESC LIMIT :n")
    params = {"s": symbol, "t": tf, "n": int(limit)}
    if before:
        params["b"] = int(before)
    rows = (await db.execute(text(q), params)).fetchall()
    out = []
    for r in reversed(rows):
        try:
            ts = int(r[0].timestamp())
        except Exception:  # noqa: BLE001
            ts = 0
        out.append({"t": ts, "o": float(r[1]), "h": float(r[2]), "l": float(r[3]),
                    "c": float(r[4]), "v": float(r[5] or 0)})
    return out


# ── اندیکاتورهای نمودار (روی همان آرایهٔ کندل‌ها، طول‌ها هم‌ترازِ candles؛ مقادیرِ ابتدایی null) ──
def _ema_list(vals, p):
    """EMA با همان طولِ ورودی؛ مقادیرِ پیش از پُرشدنِ پنجره None."""
    n = len(vals)
    out = [None] * n
    if n < p or p < 1:
        return out
    k = 2.0 / (p + 1)
    seed = sum(vals[:p]) / p
    out[p - 1] = seed
    prev = seed
    for i in range(p, n):
        prev = (vals[i] - prev) * k + prev
        out[i] = prev
    return out


def _ind_macd(candles, fast=12, slow=26, sig=9):
    closes = [c["c"] for c in candles]
    n = len(closes)
    ef, es = _ema_list(closes, fast), _ema_list(closes, slow)
    macd = [None] * n
    for i in range(n):
        if ef[i] is not None and es[i] is not None:
            macd[i] = round(ef[i] - es[i], 6)
    macd_vals = [m for m in macd if m is not None]
    sig_line = [None] * n
    if len(macd_vals) >= sig:
        start = n - len(macd_vals)  # اولین اندیسِ معتبرِ macd
        sig_sub = _ema_list(macd_vals, sig)
        for j in range(len(sig_sub)):
            sig_line[start + j] = None if sig_sub[j] is None else round(sig_sub[j], 6)
    hist = [None] * n
    for i in range(n):
        if macd[i] is not None and sig_line[i] is not None:
            hist[i] = round(macd[i] - sig_line[i], 6)
    return {"macd": macd, "signal": sig_line, "hist": hist}


def _ind_stoch(candles, p=14, d=3):
    n = len(candles)
    k = [None] * n
    for i in range(p - 1, n):
        seg = candles[i - p + 1:i + 1]
        hi = max(c["h"] for c in seg)
        lo = min(c["l"] for c in seg)
        rng = hi - lo
        k[i] = round(100 * (candles[i]["c"] - lo) / rng, 2) if rng else 50.0
    dl = [None] * n
    for i in range(n):
        window = [k[j] for j in range(max(0, i - d + 1), i + 1) if k[j] is not None]
        if i >= p - 1 + (d - 1) and len(window) == d:
            dl[i] = round(sum(window) / d, 2)
    return {"k": k, "d": dl}


def _ind_atr(candles, p=14):
    n = len(candles)
    out = [None] * n
    if n < p + 1:
        return {"atr": out}
    trs = [None] * n
    for i in range(1, n):
        h, lo, pc = candles[i]["h"], candles[i]["l"], candles[i - 1]["c"]
        trs[i] = max(h - lo, abs(h - pc), abs(lo - pc))
    seed = sum(trs[1:p + 1]) / p
    out[p] = round(seed, 6)
    prev = seed
    for i in range(p + 1, n):
        prev = (prev * (p - 1) + trs[i]) / p
        out[i] = round(prev, 6)
    return {"atr": out}


def _ind_adx(candles, p=14):
    n = len(candles)
    out = [None] * n
    if n < 2 * p:
        return {"adx": out}
    tr = [0.0] * n
    plus_dm = [0.0] * n
    minus_dm = [0.0] * n
    for i in range(1, n):
        up = candles[i]["h"] - candles[i - 1]["h"]
        down = candles[i - 1]["l"] - candles[i]["l"]
        plus_dm[i] = up if (up > down and up > 0) else 0.0
        minus_dm[i] = down if (down > up and down > 0) else 0.0
        h, lo, pc = candles[i]["h"], candles[i]["l"], candles[i - 1]["c"]
        tr[i] = max(h - lo, abs(h - pc), abs(lo - pc))
    # میانگینِ ویلدر
    atr_w = sum(tr[1:p + 1])
    pdm_w = sum(plus_dm[1:p + 1])
    mdm_w = sum(minus_dm[1:p + 1])
    dx = [None] * n
    for i in range(p + 1, n):
        atr_w = atr_w - atr_w / p + tr[i]
        pdm_w = pdm_w - pdm_w / p + plus_dm[i]
        mdm_w = mdm_w - mdm_w / p + minus_dm[i]
        pdi = 100 * pdm_w / atr_w if atr_w else 0.0
        mdi = 100 * mdm_w / atr_w if atr_w else 0.0
        s = pdi + mdi
        dx[i] = 100 * abs(pdi - mdi) / s if s else 0.0
    # ADX = میانگینِ ویلدرِ DX
    first = p + 1
    valid = [dx[i] for i in range(first, n) if dx[i] is not None]
    if len(valid) >= p:
        adx = sum(valid[:p]) / p
        idx = first + p - 1
        out[idx] = round(adx, 2)
        for i in range(idx + 1, n):
            if dx[i] is not None:
                adx = (adx * (p - 1) + dx[i]) / p
                out[i] = round(adx, 2)
    return {"adx": out}


def _ind_rsi(candles):
    return _rsi_list([c["c"] for c in candles], 14)   # آرایهٔ تخت (هم‌ترازِ کندل‌ها)


_CHART_INDICATORS = {"macd": _ind_macd, "stoch": _ind_stoch, "atr": _ind_atr,
                     "adx": _ind_adx, "rsi": _ind_rsi}


@router.get("/chart/symbols")
async def chart_symbols(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    import re as _re
    # کریپتو-CFDهای فارکس (BTCUSD/ETHUSD/...) حذف می‌شوند چون کریپتو از LBank می‌آید (#۶)
    _CRYPTO_CFD = _re.compile(r'^(BTC|ETH|XRP|DOGE|SOL|LTC|BNB|ADA|DOT|MATIC|AVAX|LINK|TRX|BCH|XLM|ATOM|UNI|SHIB|PEPE|TON|NEAR)USD[T]?$', _re.I)
    syms = [r[0] for r in (await db.execute(text("SELECT DISTINCT symbol FROM candles ORDER BY symbol"))).fetchall() if not _CRYPTO_CFD.match(r[0])]
    tfs = [r[0] for r in (await db.execute(text("SELECT DISTINCT timeframe FROM candles"))).fetchall()]
    order = {"M1": 0, "M5": 1, "M15": 2, "M30": 3, "H1": 4, "H2": 5, "H4": 6, "D1": 7, "W1": 8, "MN": 9}
    tfs.sort(key=lambda t: order.get(t, 99))
    have = set(syms)
    # نمادهای فارکسِ حسابِ مَسترِ MT5 (همهٔ نمادهای OneRoyal که اکسپورتر می‌فرستد)
    try:
        from src.core.redis_client import redis_client
        fx = await redis_client.client.smembers("bn:fxsyms")
        for s in sorted(x.decode() if isinstance(x, bytes) else x for x in (fx or [])):
            if s and s not in have and not _CRYPTO_CFD.match(s):
                syms.append(s); have.add(s)
    except Exception:  # noqa: BLE001
        pass
    # نمادهای کریپتوی LBank (دینامیک، خودبه‌خود آپدیت) را هم به دامنه اضافه کن
    from src.api.routes._crypto_feed import ensure_pairs
    for cs in await ensure_pairs():
        if cs not in have:
            syms.append(cs)
    return {"symbols": syms, "timeframes": tfs}


@router.get("/chart/{symbol}/range")
async def chart_range(symbol: str, tf: str = "H1",
                      st: AcademyStudent = Depends(current_student),
                      db: AsyncSession = Depends(get_db)):
    """بازهٔ زمانیِ موجودِ داده برای انتخابِ نقطهٔ تصادفیِ تاریخی در شبیه‌ساز."""
    r = (await db.execute(text(
        "SELECT EXTRACT(EPOCH FROM min(time)), EXTRACT(EPOCH FROM max(time)), count(*) "
        "FROM candles WHERE symbol=:s AND timeframe=:t"), {"s": symbol, "t": tf})).one()
    return {"symbol": symbol, "tf": tf,
            "min_ts": int(r[0]) if r[0] else None,
            "max_ts": int(r[1]) if r[1] else None, "count": int(r[2] or 0)}


@router.get("/chart/{symbol}")
async def chart_data(symbol: str, tf: str = "H1", indicators: str = "", limit: int = 130,
                     before: int | None = None,
                     st: AcademyStudent = Depends(current_student),
                     db: AsyncSession = Depends(get_db)):
    # کریپتو → دادهٔ مستقل و دینامیک از LBank (بدونِ DB/کلید). فارکس → جدولِ candles.
    from src.api.routes._crypto_feed import is_crypto, crypto_klines, ensure_pairs
    await ensure_pairs()
    if is_crypto(symbol):
        try:
            candles = await crypto_klines(symbol, tf, limit=max(50, min(int(limit), 1000)), before=before)
        except Exception:  # noqa: BLE001
            candles = []
    else:
        candles = await _chart_rows(db, symbol, tf, limit=max(50, min(int(limit), 3000)), before=before)
    if not candles:
        raise HTTPException(status_code=404, detail="دادهٔ این نماد نیست.")
    out = {"symbol": symbol, "timeframe": tf, "candles": candles, "price": candles[-1]["c"]}
    req = (indicators or "").strip()
    if req:
        names = [n.strip().lower() for n in req.split(",") if n.strip()]
        ind: dict = {}
        for name in names:
            fn = _CHART_INDICATORS.get(name)
            if fn and name not in ind:
                ind[name] = fn(candles)
        out["indicators"] = ind
    return out


@router.post("/chart/analyze")
async def chart_analyze(symbol: str = Body(..., embed=True), tf: str = Body("H1", embed=True),
                        st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """مربیِ AI: تحلیلِ آموزشیِ چارت + سطوحِ حمایت/مقاومت برای رسم روی نمودار."""
    candles = await _chart_rows(db, symbol, tf)
    if len(candles) < 30:
        raise HTTPException(status_code=404, detail="دادهٔ کافی نیست.")
    closes = [c["c"] for c in candles]
    price = closes[-1]
    n = len(candles)
    ma20, ma50, rsi_v = _ma(closes, 20), _ma(closes, 50), _rsi(closes)
    highs, lows = _swing_points(candles)
    hp = [p for _, p in highs]; lp = [p for _, p in lows]
    if ma20 and ma50:
        trend = "صعودی" if (price > ma20 > ma50) else "نزولی" if (price < ma20 < ma50) else "خنثی/رنج"
    else:
        trend = "نامشخص"
    # ناحیه‌های حمایت/مقاومت (zone) و خطوطِ سطح
    res_zone = _cluster_zone([p for p in hp if p > price]) if hp else None
    sup_zone = _cluster_zone([p for p in lp if p < price]) if lp else None
    res = sorted({round(p, 5) for p in hp if p > price})[:2]
    sup = sorted({round(p, 5) for p in lp if p < price}, reverse=True)[:2]
    levels = ([{"type": "resistance", "price": r, "label": "مقاومت"} for r in res]
              + [{"type": "support", "price": s, "label": "حمایت"} for s in sup])
    # خطِ روند: روی سوینگ‌لوها (صعودی) یا سوینگ‌های (نزولی)
    pts = lows[-3:] if trend == "صعودی" else highs[-3:] if trend == "نزولی" else (lows[-3:] or highs[-3:])
    trendline = _trendline(pts) if len(pts) >= 2 else None
    # نواحیِ عرضه/تقاضا (zone) برای رسم
    zones = []
    if res_zone:
        zones.append({"type": "resistance", "lo": round(res_zone[0], 5), "hi": round(res_zone[1], 5), "label": "ناحیهٔ عرضه"})
    if sup_zone:
        zones.append({"type": "support", "lo": round(sup_zone[0], 5), "hi": round(sup_zone[1], 5), "label": "ناحیهٔ تقاضا"})
    # تشخیصِ الگو (دو قله/دو دره) + نشانگرها
    markers, pattern = [], None
    if len(highs) >= 2 and abs(highs[-1][1] - highs[-2][1]) / highs[-1][1] < 0.004:
        pattern = "دو قله (احتمالِ برگشتِ نزولی)"
        markers += [{"i": highs[-2][0], "price": highs[-2][1], "label": "قله", "dir": "down"},
                    {"i": highs[-1][0], "price": highs[-1][1], "label": "قله", "dir": "down"}]
    elif len(lows) >= 2 and abs(lows[-1][1] - lows[-2][1]) / lows[-1][1] < 0.004:
        pattern = "دو دره (احتمالِ برگشتِ صعودی)"
        markers += [{"i": lows[-2][0], "price": lows[-2][1], "label": "دره", "dir": "up"},
                    {"i": lows[-1][0], "price": lows[-1][1], "label": "دره", "dir": "up"}]
    drawings = {"trendline": trendline, "zones": zones, "markers": markers, "candles_n": n}
    facts = (f"نماد {symbol} تایم‌فریم {tf}. قیمتِ فعلی {price}. روند {trend}. "
             f"MA20={round(ma20, 5) if ma20 else '-'}، MA50={round(ma50, 5) if ma50 else '-'}، RSI={rsi_v}. "
             f"مقاومت‌ها {res}، حمایت‌ها {sup}. " + (f"الگو: {pattern}." if pattern else ""))
    explanation = await llm_client.complete(
        f"به‌عنوان مربیِ تحلیلِ تکنیکال، این چارت را برای دانش‌آموز ساده و آموزشی تحلیل کن: روند، خطِ روند، "
        f"نواحیِ حمایت/مقاومت، آنچه RSI می‌گوید"
        + (f"، و الگوی «{pattern}» که روی چارت علامت زده شد" if pattern else "")
        + f". حداکثر ۵ جملهٔ کوتاه و کاربردی، بدونِ توصیهٔ خرید/فروشِ قطعی.\n\n{facts}",
        system="تو مربیِ آموزشیِ تحلیلِ تکنیکالِ فارسی هستی؛ ساده و دقیق آموزش می‌دهی.",
        system_replace=True, timeout=45) or "تحلیل در دسترس نیست."
    return {"symbol": symbol, "tf": tf, "trend": trend, "rsi": rsi_v, "pattern": pattern,
            "ma20": round(ma20, 5) if ma20 else None, "ma50": round(ma50, 5) if ma50 else None,
            "levels": levels, "drawings": drawings, "explanation": explanation,
            "suggest": {"ma20": True, "ma50": True, "rsi": True}}


# ── شبیه‌سازِ تمرین: حسابِ مجازی + بازخوردِ AI ──
_PRACTICE_START = 10000.0
_PRACTICE_RISK = 100.0   # دلار به ازای هر ۱R


@router.post("/practice/record")
async def practice_record(
    symbol: str = Body("", embed=True), direction: str = Body("", embed=True),
    entry: float | None = Body(None, embed=True), exit: float | None = Body(None, embed=True),
    pnl_r: float = Body(0.0, embed=True), outcome: str = Body("manual", embed=True),
    st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db),
):
    t = AcademyPracticeTrade(student_id=st.id, symbol=(symbol or None), direction=(direction or None),
                             entry=entry, exit=exit, pnl_r=round(float(pnl_r), 2),
                             outcome=outcome if outcome in ("tp", "sl", "manual", "time") else "manual")
    db.add(t)
    await db.commit()
    total_r = (await db.execute(select(func.coalesce(func.sum(AcademyPracticeTrade.pnl_r), 0))
               .where(AcademyPracticeTrade.student_id == st.id))).scalar() or 0
    return {"ok": True, "balance": round(_PRACTICE_START + float(total_r) * _PRACTICE_RISK, 2)}


@router.get("/practice/stats")
async def practice_stats(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AcademyPracticeTrade).where(AcademyPracticeTrade.student_id == st.id)
            .order_by(AcademyPracticeTrade.id))).scalars().all()
    rs = [float(t.pnl_r) for t in rows if t.pnl_r is not None]
    wins = [r for r in rs if r > 0]
    bal, equity = _PRACTICE_START, [_PRACTICE_START]
    for r in rs:
        bal += r * _PRACTICE_RISK; equity.append(round(bal, 2))
    gross_p = sum(r for r in rs if r > 0); gross_l = -sum(r for r in rs if r < 0)
    profit_factor = round(gross_p / gross_l, 2) if gross_l else (round(gross_p, 2) if gross_p else 0)
    best_streak = worst_streak = bw = bl = 0
    for r in rs:
        if r > 0:
            bw += 1; bl = 0; best_streak = max(best_streak, bw)
        elif r < 0:
            bl += 1; bw = 0; worst_streak = max(worst_streak, bl)
        else:
            bw = bl = 0
    return {"balance": round(bal, 2), "start": _PRACTICE_START, "count": len(rows),
            "win_rate": round(100 * len(wins) / len(rs)) if rs else None,
            "total_r": round(sum(rs), 2), "best": max(rs) if rs else 0, "worst": min(rs) if rs else 0,
            "equity": equity[-60:], "profit_factor": profit_factor,
            "best_streak": best_streak, "worst_streak": worst_streak}


@router.post("/practice/feedback")
async def practice_feedback(
    symbol: str = Body("", embed=True), direction: str = Body("", embed=True),
    entry: float | None = Body(None, embed=True), sl: float | None = Body(None, embed=True),
    tp: float | None = Body(None, embed=True), rr: float | None = Body(None, embed=True),
    outcome: str = Body("", embed=True), context: str = Body("", embed=True),
    st: AcademyStudent = Depends(require_vip),
):
    """بازخوردِ آموزشیِ AI روی یک معاملهٔ تمرینی."""
    out_fa = {"tp": "به حد سود رسید", "sl": "به حد ضرر خورد", "time": "بدونِ نتیجهٔ روشن بسته شد"}.get(outcome, "دستی بسته شد")
    fb = await llm_client.complete(
        f"یک معاملهٔ تمرینیِ دانش‌آموز را نقد کن (آموزشی، صمیمی، حداکثر ۴ جمله): "
        f"نماد {symbol}، جهت {'خرید' if direction == 'buy' else 'فروش'}، ورود {entry}، حد ضرر {sl}، حد سود {tp}، "
        f"ریسک‌به‌ریوارد {rr}، نتیجه: {out_fa}. {context}\n"
        f"بگو چه خوب بود و چه چیزی را دفعهٔ بعد بهتر کند (مثلاً تأییدِ روند، نقطهٔ ورود، نسبتِ R:R).",
        system="تو مربیِ معامله‌گریِ فارسی هستی؛ سازنده و دقیق بازخورد می‌دهی، بدونِ توصیهٔ مالیِ قطعی.",
        system_replace=True, timeout=40) or "بازخورد در دسترس نیست."
    return {"feedback": fb}


# ── معاملهٔ کاغذی (Paper-Trading) روی قیمتِ زنده ──
_PAPER_START = 10000.0


def _pip_size(symbol: str) -> float:
    return 0.01 if "JPY" in (symbol or "").upper() else 0.0001


def _ffloat(v, name: str) -> float:
    """تبدیلِ امنِ ورودیِ عددی → در صورتِ خطا ۴۰۰."""
    try:
        return float(v)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"مقدارِ «{name}» باید عدد باشد.")


async def _current_price(db, symbol):
    r = (await db.execute(text(
        "SELECT close FROM candles WHERE symbol=:s ORDER BY time DESC LIMIT 1"), {"s": symbol})).first()
    return float(r[0]) if r else None


def _paper_dict(p, cur):
    f = lambda v: float(v) if v is not None else None
    d = {"id": p.id, "symbol": p.symbol, "direction": p.direction, "entry": f(p.entry),
         "sl": f(p.sl), "tp": f(p.tp), "size": f(p.size), "risk_usd": f(p.risk_usd),
         "status": p.status, "exit": f(p.exit), "pnl_usd": f(p.pnl_usd), "outcome": p.outcome,
         "order_type": p.order_type or "market", "limit_price": f(p.limit_price),
         "opened_at": p.opened_at.isoformat() if p.opened_at else None}
    if p.status == "open" and cur is not None:
        d["price"] = cur
        d["float_pnl"] = round((cur - float(p.entry)) * float(p.size) * (1 if p.direction == "buy" else -1), 2)
    return d


async def _balance(db, sid):
    s = (await db.execute(select(func.coalesce(func.sum(AcademyPaperPosition.pnl_usd), 0))
         .where(AcademyPaperPosition.student_id == sid, AcademyPaperPosition.status == "closed"))).scalar() or 0
    return round(_PAPER_START + float(s), 2)


@router.post("/paper/open")
async def paper_open(symbol: str = Body(..., embed=True), direction: str = Body(..., embed=True),
                     sl: float | None = Body(None, embed=True), tp: float | None = Body(None, embed=True),
                     risk_usd: float = Body(100.0, embed=True),
                     order_type: str = Body("market", embed=True),
                     limit_price: float | None = Body(None, embed=True),
                     st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    if direction not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="جهتِ نامعتبر.")
    otype = order_type if order_type in ("market", "limit", "stop") else "market"
    cur = await _current_price(db, symbol)
    if cur is None:
        raise HTTPException(status_code=404, detail="قیمتِ این نماد در دسترس نیست.")
    open_cnt = (await db.execute(select(func.count()).select_from(AcademyPaperPosition)
                .where(AcademyPaperPosition.student_id == st.id,
                       AcademyPaperPosition.status.in_(("open", "pending"))))).scalar() or 0
    if open_cnt >= 10:
        raise HTTPException(status_code=429, detail="حداکثر ۱۰ پوزیشنِ باز/معلق مجاز است.")
    risk = max(1.0, min(_ffloat(risk_usd if risk_usd is not None else 100, "risk_usd"), 1000))
    if otype == "market":
        entry = cur
        status = "open"
        lp = None
    else:
        if limit_price is None:
            raise HTTPException(status_code=400, detail="برای سفارشِ معلق، قیمتِ هدف لازم است.")
        lp = _ffloat(limit_price, "limit_price")
        entry = lp
        status = "pending"
    dist = abs(entry - sl) if sl else entry * 0.01
    size = round(risk / (dist or entry * 0.001), 4)
    p = AcademyPaperPosition(student_id=st.id, symbol=symbol, direction=direction, entry=entry,
                             sl=sl, tp=tp, size=size, risk_usd=risk, status=status,
                             order_type=otype, limit_price=lp)
    db.add(p)
    await db.commit()
    return _paper_dict(p, cur if status == "open" else None)


async def _fill_pending(db, sid):
    """پُرکردنِ سفارش‌های معلق که قیمت به آن‌ها رسیده."""
    rows = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == sid, AcademyPaperPosition.status == "pending"))).scalars().all()
    if not rows:
        return
    prices = {}
    now = datetime.now(timezone.utc)
    for p in rows:
        if p.limit_price is None:
            continue
        if p.symbol not in prices:
            prices[p.symbol] = await _current_price(db, p.symbol)
        cur = prices[p.symbol]
        if cur is None:
            continue
        lp = float(p.limit_price)
        ot = p.order_type or "limit"
        fill = False
        if ot == "limit":
            fill = (cur <= lp) if p.direction == "buy" else (cur >= lp)
        else:  # stop
            fill = (cur >= lp) if p.direction == "buy" else (cur <= lp)
        if fill:
            p.status = "open"
            p.entry = cur
            p.opened_at = now
    await db.commit()


async def _settle_open(db, sid):
    """بستنِ خودکارِ پوزیشن‌هایی که قیمت به SL/TP رسیده."""
    rows = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == sid, AcademyPaperPosition.status == "open"))).scalars().all()
    for p in rows:
        cur = await _current_price(db, p.symbol)
        if cur is None:
            continue
        hit = None
        if p.direction == "buy":
            if p.sl and cur <= float(p.sl): hit = ("sl", float(p.sl))
            elif p.tp and cur >= float(p.tp): hit = ("tp", float(p.tp))
        else:
            if p.sl and cur >= float(p.sl): hit = ("sl", float(p.sl))
            elif p.tp and cur <= float(p.tp): hit = ("tp", float(p.tp))
        if hit:
            out, px = hit
            p.exit = px; p.status = "closed"; p.outcome = out
            p.pnl_usd = round((px - float(p.entry)) * float(p.size) * (1 if p.direction == "buy" else -1), 2)
            p.closed_at = datetime.now(timezone.utc)
    await db.commit()


@router.get("/paper/positions")
async def paper_positions(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    await _fill_pending(db, st.id)
    await _settle_open(db, st.id)
    op = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == st.id, AcademyPaperPosition.status == "open")
        .order_by(AcademyPaperPosition.id.desc()))).scalars().all()
    pend = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == st.id, AcademyPaperPosition.status == "pending")
        .order_by(AcademyPaperPosition.id.desc()))).scalars().all()
    cl = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == st.id, AcademyPaperPosition.status == "closed")
        .order_by(AcademyPaperPosition.id.desc()).limit(20))).scalars().all()
    prices = {}
    out_open = []
    for p in op:
        if p.symbol not in prices:
            prices[p.symbol] = await _current_price(db, p.symbol)
        out_open.append(_paper_dict(p, prices[p.symbol]))
    return {"open": out_open, "pending": [_paper_dict(p, None) for p in pend],
            "closed": [_paper_dict(p, None) for p in cl]}


@router.post("/paper/close/{pid}")
async def paper_close(pid: int, st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.id == pid, AcademyPaperPosition.student_id == st.id))).scalar_one_or_none()
    if p is None or p.status != "open":
        raise HTTPException(status_code=404, detail="پوزیشنِ باز یافت نشد.")
    cur = await _current_price(db, p.symbol)
    p.exit = cur; p.status = "closed"; p.outcome = "manual"
    p.pnl_usd = round((cur - float(p.entry)) * float(p.size) * (1 if p.direction == "buy" else -1), 2)
    p.closed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "pnl_usd": float(p.pnl_usd), "balance": await _balance(db, st.id)}


@router.post("/paper/close-partial/{pid}")
async def paper_close_partial(pid: int, fraction: float = Body(0.5, embed=True),
                              st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """بستنِ بخشی از یک پوزیشنِ باز: کسری از حجم را در قیمتِ فعلی می‌بندد و سودِ آن را ثبت می‌کند."""
    fr = _ffloat(fraction, "fraction")
    if fr < 0.1 or fr > 0.9:
        raise HTTPException(status_code=400, detail="کسر باید بینِ ۰٫۱ تا ۰٫۹ باشد.")
    p = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.id == pid, AcademyPaperPosition.student_id == st.id))).scalar_one_or_none()
    if p is None or p.status != "open":
        raise HTTPException(status_code=404, detail="پوزیشنِ باز یافت نشد.")
    cur = await _current_price(db, p.symbol)
    if cur is None:
        raise HTTPException(status_code=404, detail="قیمتِ این نماد در دسترس نیست.")
    closed_size = round(float(p.size) * fr, 4)
    pnl = round((cur - float(p.entry)) * closed_size * (1 if p.direction == "buy" else -1), 2)
    # رکوردِ بستهٔ بخشِ بسته‌شده (تا آمارِ حساب درست بماند)
    child = AcademyPaperPosition(
        student_id=st.id, symbol=p.symbol, direction=p.direction, entry=p.entry,
        sl=p.sl, tp=p.tp, size=closed_size, risk_usd=None, status="closed",
        exit=cur, pnl_usd=pnl, outcome="partial", order_type="market",
        opened_at=p.opened_at, closed_at=datetime.now(timezone.utc))
    db.add(child)
    p.size = round(float(p.size) - closed_size, 4)
    await db.commit()
    return {"ok": True, "closed_fraction": fr, "pnl_usd": pnl, "balance": await _balance(db, st.id)}


@router.post("/paper/calc-size")
async def paper_calc_size(symbol: str = Body(..., embed=True), entry: float = Body(..., embed=True),
                          sl: float = Body(..., embed=True), risk_usd: float = Body(100.0, embed=True),
                          st: AcademyStudent = Depends(require_vip)):
    """محاسبهٔ حجم بر پایهٔ ریسکِ دلاری و فاصلهٔ ورود تا حد ضرر (مدلِ سادهٔ پیپ)."""
    e = _ffloat(entry, "entry"); s = _ffloat(sl, "sl"); risk = _ffloat(risk_usd, "risk_usd")
    pip = _pip_size(symbol)
    sl_pips = abs(e - s) / pip
    size = risk / max(sl_pips * pip, 1e-9)
    return {"size": round(size, 4), "sl_pips": round(sl_pips, 1), "risk_usd": round(risk, 2)}


@router.get("/paper/account")
async def paper_account(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    await _fill_pending(db, st.id)
    await _settle_open(db, st.id)
    closed = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == st.id, AcademyPaperPosition.status == "closed")
        .order_by(AcademyPaperPosition.id))).scalars().all()
    pnls = [float(c.pnl_usd) for c in closed if c.pnl_usd is not None]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p < 0]
    bal = _PAPER_START + sum(pnls)
    eq = [_PAPER_START]; run = _PAPER_START
    peak = _PAPER_START; max_dd_pct = 0.0
    for p in pnls:
        run += p; eq.append(round(run, 2))
        peak = max(peak, run)
        dd = 100 * (peak - run) / peak if peak else 0
        max_dd_pct = max(max_dd_pct, dd)
    # توالی‌های بُرد/باخت
    max_cw = max_cl = cw = cl = 0
    for p in pnls:
        if p > 0:
            cw += 1; cl = 0; max_cw = max(max_cw, cw)
        elif p < 0:
            cl += 1; cw = 0; max_cl = max(max_cl, cl)
        else:
            cw = cl = 0
    gross_p = sum(wins); gross_l = -sum(losses)
    profit_factor = round(gross_p / gross_l, 2) if gross_l else (round(gross_p, 2) if gross_p else 0)
    # شناورِ پوزیشن‌های باز
    op = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == st.id, AcademyPaperPosition.status == "open"))).scalars().all()
    floating = 0.0
    for p in op:
        cur = await _current_price(db, p.symbol)
        if cur is not None:
            floating += (cur - float(p.entry)) * float(p.size) * (1 if p.direction == "buy" else -1)
    return {"balance": round(bal, 2), "equity": round(bal + floating, 2), "start": _PAPER_START,
            "floating": round(floating, 2), "open_count": len(op), "closed_count": len(closed),
            "win_rate": round(100 * len(wins) / len(pnls)) if pnls else None,
            "net_pnl": round(sum(pnls), 2), "curve": eq[-60:],
            "profit_factor": profit_factor,
            "avg_win": round(sum(wins) / len(wins), 2) if wins else None,
            "avg_loss": round(sum(losses) / len(losses), 2) if losses else None,
            "max_consec_wins": max_cw, "max_consec_losses": max_cl,
            "max_drawdown_pct": round(max_dd_pct, 2),
            "true_equity": round(bal + floating, 2)}


# ── مربیِ رفتاری (Behavioral AI Coach) ──
_COACH_EMOTIONS = ["calm", "fear", "greed", "revenge", "impatience", "confident"]
_NEG_EMOTIONS = {"greed", "revenge", "impatience", "fear"}
_EMOTION_FA = {"calm": "آرام", "fear": "ترس", "greed": "طمع", "revenge": "انتقام",
               "impatience": "بی‌صبری", "confident": "اعتمادبه‌نفس"}


def _coach_journal_metrics(jrows: list) -> dict:
    """متریک‌های احساس/تگ/نسبتِ ریسک‌به‌ریوارد از ژورنال (همه با گاردِ تقسیم)."""
    # احساسات
    emo_stat = {}
    for j in jrows:
        e = (j.emotion or "").strip().lower()
        if not e:
            continue
        s = emo_stat.setdefault(e, {"trades": 0, "wins": 0, "pnl_sum": 0.0})
        s["trades"] += 1
        p = float(j.pnl) if j.pnl is not None else 0.0
        if p > 0:
            s["wins"] += 1
        s["pnl_sum"] += p
    emotions = []
    for e, s in emo_stat.items():
        n = s["trades"]
        emotions.append({
            "emotion": e, "emotion_fa": _EMOTION_FA.get(e, e), "trades": n,
            "win_rate": round(100 * s["wins"] / n) if n else 0,
            "avg_pnl": round(s["pnl_sum"] / n, 2) if n else 0.0})
    emotions.sort(key=lambda x: -x["trades"])

    # تگ‌ها
    tag_stat = {}
    for j in jrows:
        tags = j.tags if isinstance(j.tags, list) else []
        won = (float(j.pnl) if j.pnl is not None else 0.0) > 0
        for t in tags:
            t = str(t).strip()
            if not t:
                continue
            s = tag_stat.setdefault(t, {"trades": 0, "wins": 0})
            s["trades"] += 1
            if won:
                s["wins"] += 1
    tags = [{"tag": t, "trades": s["trades"],
             "win_rate": round(100 * s["wins"] / s["trades"]) if s["trades"] else 0}
            for t, s in tag_stat.items()]
    tags.sort(key=lambda x: -x["trades"])
    tags = tags[:12]

    # میانگینِ بُرد/باخت (برای نسبتِ R)
    pnls = [float(j.pnl) for j in jrows if j.pnl is not None]
    wins = [p for p in pnls if p > 0]
    losses = [-p for p in pnls if p < 0]
    avg_win = sum(wins) / len(wins) if wins else 0.0
    avg_loss = sum(losses) / len(losses) if losses else 0.0
    return {"emotions": emotions, "tags": tags, "avg_win": avg_win, "avg_loss": avg_loss,
            "win_rate": round(100 * len(wins) / len(pnls)) if pnls else 0, "n": len(pnls)}


def _streaks(seq: list) -> tuple[int, int]:
    """طولانی‌ترین رشتهٔ برد و باخت (seq از +1/-1)."""
    best_w = best_l = cur_w = cur_l = 0
    for v in seq:
        if v > 0:
            cur_w += 1
            cur_l = 0
        elif v < 0:
            cur_l += 1
            cur_w = 0
        else:
            cur_w = cur_l = 0
        best_w = max(best_w, cur_w)
        best_l = max(best_l, cur_l)
    return best_w, best_l


def _coach_behavioral_flags(jrows: list, jm: dict) -> list:
    """الگوهای رفتاری روی ژورنالِ مرتب‌شده بر اساسِ زمان."""
    flags = []

    def _sz(j):
        return float(j.size) if getattr(j, "size", None) is not None else None

    def _pnl(j):
        return float(j.pnl) if j.pnl is not None else 0.0

    ordered = sorted(jrows, key=lambda j: (j.traded_at or j.created_at or datetime.min.replace(tzinfo=timezone.utc)))

    # ۱) اوور-ترید بعد از برد: باختِ بلافاصله بعد از برد
    loss_after_win = win_pairs = 0
    for a, b in zip(ordered, ordered[1:]):
        if _pnl(a) > 0:
            win_pairs += 1
            if _pnl(b) < 0:
                loss_after_win += 1
    if win_pairs >= 3 and loss_after_win / win_pairs >= 0.6:
        flags.append({
            "key": "overtrade_after_win", "title_fa": "اوور-ترید بعد از برد", "severity": "med",
            "evidence_fa": f"در {loss_after_win} مورد از {win_pairs} معاملهٔ پس از یک برد، نتیجه باخت بوده "
                           f"({round(100 * loss_after_win / win_pairs)}٪). احتمالاً پس از برد بیش‌ازحد معامله می‌کنی."})

    # ۲) معاملهٔ انتقامی: بعد از باخت، معاملهٔ بزرگ‌تر یا با احساسِ انتقام/طمع
    revenge_hits = []
    for a, b in zip(ordered, ordered[1:]):
        if _pnl(a) < 0:
            be = (b.emotion or "").lower()
            sa, sb = _sz(a), _sz(b)
            bigger = (sa is not None and sb is not None and sb > sa * 1.5)
            if be in ("revenge", "greed") or bigger:
                revenge_hits.append((b, bigger, be))
    if revenge_hits:
        sev = "high" if len(revenge_hits) >= 2 else "med"
        sample = revenge_hits[0]
        why = "حجمِ بزرگ‌تر" if sample[1] else f"احساسِ «{_EMOTION_FA.get(sample[2], sample[2])}»"
        flags.append({
            "key": "revenge_trade", "title_fa": "معاملهٔ انتقامی", "severity": sev,
            "evidence_fa": f"{len(revenge_hits)} بار بلافاصله بعد از یک باخت، معامله‌ای با {why} باز کرده‌ای؛ "
                           f"این الگوی کلاسیکِ معاملهٔ انتقامی است."})

    # ۳) ضعفِ احساسی: احساس با نرخِ برد <۴۰٪ و ≥۳ معامله
    for e in jm["emotions"]:
        if e["trades"] >= 3 and e["win_rate"] < 40:
            flags.append({
                "key": f"weak_emotion_{e['emotion']}", "title_fa": "ضعفِ احساسی",
                "severity": "high" if e["win_rate"] < 25 else "med",
                "evidence_fa": f"وقتی با احساسِ «{e['emotion_fa']}» معامله می‌کنی، نرخِ بردت فقط "
                               f"{e['win_rate']}٪ است ({e['trades']} معامله). این حالت برایت زیان‌ده است."})

    # ۴) نسبتِ ریسک‌به‌ریوارد ضعیف: میانگینِ باخت ≥ میانگینِ برد
    if jm["avg_win"] > 0 and jm["avg_loss"] >= jm["avg_win"]:
        ratio = jm["avg_loss"] / jm["avg_win"] if jm["avg_win"] else 0
        flags.append({
            "key": "poor_rr", "title_fa": "نسبتِ ریسک‌به‌ریوارد ضعیف", "severity": "high",
            "evidence_fa": f"میانگینِ باختت ({round(jm['avg_loss'], 2)}) برابر یا بزرگ‌تر از میانگینِ بردت "
                           f"({round(jm['avg_win'], 2)}) است (نسبت ~{round(ratio, 2)}). سودها را زود می‌بندی و به ضررها میدان می‌دهی."})

    sev_rank = {"high": 0, "med": 1, "low": 2}
    flags.sort(key=lambda f: sev_rank.get(f["severity"], 3))
    return flags


@router.get("/coach/dashboard")
async def coach_dashboard(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """داشبوردِ مربیِ رفتاری: تحلیلِ احساسات/تگ/تمرین/پیپر + امتیازِ انضباط + پرچم‌های رفتاری + گزارشِ AI."""
    # ── داده‌ها ──
    jrows = (await db.execute(select(AcademyJournalEntry).where(
        AcademyJournalEntry.student_id == st.id))).scalars().all()
    prows = (await db.execute(select(AcademyPracticeTrade).where(
        AcademyPracticeTrade.student_id == st.id))).scalars().all()
    pprows = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == st.id, AcademyPaperPosition.status == "closed"))).scalars().all()
    prog = (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id))).scalars().all()
    lessons = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True))
               .order_by(AcademyLesson.level, AcademyLesson.order_in_level))).scalars().all()

    # ── ۱+۲: احساسات و تگ‌ها (+ متریک‌های کمکی) ──
    jm = _coach_journal_metrics(jrows)
    emotions, tags = jm["emotions"], jm["tags"]

    # ── ۳: تمرینِ شبیه‌ساز ──
    pr = [float(t.pnl_r) for t in prows if t.pnl_r is not None]
    p_wins = [r for r in pr if r > 0]
    p_gross_win = sum(r for r in pr if r > 0)
    p_gross_loss = -sum(r for r in pr if r < 0)
    p_best, p_worst = _streaks([1 if r > 0 else -1 if r < 0 else 0 for r in pr])
    practice = {
        "trades": len(pr),
        "win_rate": round(100 * len(p_wins) / len(pr)) if pr else 0,
        "profit_factor": round(p_gross_win / p_gross_loss, 2) if p_gross_loss > 0 else (round(p_gross_win, 2) if p_gross_win else 0.0),
        "avg_r": round(sum(pr) / len(pr), 2) if pr else 0.0,
        "best_streak": p_best, "worst_streak": p_worst}

    # ── ۴: پیپر (پوزیشن‌های بسته) ──
    pp = [float(x.pnl_usd) for x in pprows if x.pnl_usd is not None]
    pp_wins = [v for v in pp if v > 0]
    pp_gw = sum(v for v in pp if v > 0)
    pp_gl = -sum(v for v in pp if v < 0)
    paper = {
        "trades": len(pp),
        "win_rate": round(100 * len(pp_wins) / len(pp)) if pp else 0,
        "profit_factor": round(pp_gw / pp_gl, 2) if pp_gl > 0 else (round(pp_gw, 2) if pp_gw else 0.0),
        "total_pnl": round(sum(pp), 2) if pp else 0.0}

    # ── ۷: سطوحِ ضعیف از نمرهٔ کوییز ──
    done_ids = {p.lesson_id for p in prog if p.status == "completed"}
    lvl_quiz = {}   # level -> [scores]
    for p in prog:
        if p.quiz_score is None:
            continue
        lv = next((l.level for l in lessons if l.id == p.lesson_id), None)
        if lv:
            lvl_quiz.setdefault(lv, []).append(p.quiz_score)
    lvl_avg = [(lv, sum(s) / len(s)) for lv, s in lvl_quiz.items() if s]
    lvl_avg.sort(key=lambda x: x[1])
    weak = lvl_avg[:2]
    weak_level_keys = [lv for lv, _ in weak]
    recommended_lessons = []
    if weak_level_keys:
        target = weak_level_keys[0]
        for l in lessons:
            if l.level == target and l.id not in done_ids and len(recommended_lessons) < 5:
                recommended_lessons.append({"slug": l.slug, "title": l.title_fa})
    weak_levels = {
        "levels": [{"level": lv, "level_fa": _LEVEL_FA.get(lv, lv), "avg_quiz": round(avg)} for lv, avg in weak],
        "recommended_lessons": recommended_lessons}

    # ── ۶: پرچم‌های رفتاری ──
    flags = _coach_behavioral_flags(jrows, jm)

    # ── ۵: امتیازِ انضباط (۰..۱۰۰) ──
    # فرمول (مجموعِ وزن‌ها = ۱):
    #   emotion_control 0.30 — سهمِ معاملاتِ احساساتِ منفی (طمع/انتقام/بی‌صبری/ترس)؛ کمتر = بهتر.
    #   rr_discipline   0.25 — نسبتِ میانگینِ برد به (برد+باخت)؛ بردِ بزرگ‌تر از باخت = بهتر.
    #   consistency     0.25 — از profit_factorِ تمرین (PF≈2 → سقف)؛ نبودِ داده = خنثیِ ۵۰٪.
    #   learning        0.20 — نسبتِ درس‌های تکمیل‌شده.
    neg_trades = sum(e["trades"] for e in emotions if e["emotion"] in _NEG_EMOTIONS)
    all_emo_trades = sum(e["trades"] for e in emotions)
    emotion_control = (1 - neg_trades / all_emo_trades) if all_emo_trades else 0.5
    denom_rr = jm["avg_win"] + jm["avg_loss"]
    rr_discipline = (jm["avg_win"] / denom_rr) if denom_rr > 0 else 0.5
    consistency = min(1.0, practice["profit_factor"] / 2.0) if practice["trades"] else 0.5
    learning = (len(done_ids) / len(lessons)) if lessons else 0.0
    factors = [
        {"name": "کنترلِ احساسات", "value": round(100 * emotion_control), "weight": 0.30},
        {"name": "انضباطِ ریسک‌به‌ریوارد", "value": round(100 * rr_discipline), "weight": 0.25},
        {"name": "ثباتِ عملکرد", "value": round(100 * consistency), "weight": 0.25},
        {"name": "یادگیری", "value": round(100 * learning), "weight": 0.20}]
    score = round(sum(f["value"] * f["weight"] for f in factors))
    score = max(0, min(100, score))
    discipline_score = {"score": score, "factors": factors}

    # ── ۸: گزارشِ AI (یا فالبکِ بدونِ AI) ──
    flag_lines = "؛ ".join(f"{f['title_fa']} ({f['severity']}): {f['evidence_fa']}" for f in flags) or "موردِ رفتاریِ نگران‌کننده‌ای شناسایی نشد."
    emo_lines = "، ".join(f"{e['emotion_fa']}: {e['trades']} معامله/برد {e['win_rate']}٪" for e in emotions[:6]) or "ثبت‌نشده"
    weak_lines = "، ".join(f"{w['level_fa']} (میانگینِ آزمون {w['avg_quiz']}٪)" for w in weak_levels["levels"]) or "نامشخص"
    stats_block = (
        f"امتیازِ انضباط: {score}/۱۰۰ (کنترلِ احساسات {factors[0]['value']}، R {factors[1]['value']}، "
        f"ثبات {factors[2]['value']}، یادگیری {factors[3]['value']}). "
        f"احساسات: {emo_lines}. نرخِ بردِ کلیِ ژورنال: {jm['win_rate']}٪ روی {jm['n']} معامله. "
        f"تمرین: {practice['trades']} معامله، PF {practice['profit_factor']}، میانگین {practice['avg_r']}R. "
        f"ضعیف‌ترین سطوح: {weak_lines}. "
        f"پرچم‌های رفتاری: {flag_lines}")

    system = ("تو «مربیِ رفتاریِ» معامله‌گریِ یک دانش‌آموزِ آکادمی هستی. فقط آموزشی و روان‌شناسیِ معامله؛ "
              "هرگز سیگنال، توصیهٔ خرید/فروش یا قیمتِ ورود/خروج نده. صمیمی، دقیق و انگیزشی، کاملاً فارسی.")
    prompt = (
        "بر پایهٔ آمارِ واقعیِ زیر از دانش‌آموز، یک گزارشِ کوچینگِ رفتاریِ کوتاه و ساختاریافته به فارسی بنویس "
        "دقیقاً با این سه تیتر:\n«نقاطِ قوت»\n«۳ خطای اصلی»\n«برنامهٔ این هفته (۳ اقدامِ مشخص)»\n"
        "حداکثر ۱۰ جمله، بدونِ هیچ سیگنال یا توصیهٔ معاملاتی.\n\n"
        f"آمار:\n{stats_block}")
    ai_report = await llm_client.complete(
        prompt=prompt, system=system, model=settings.ACADEMY_MENTOR_MODEL,
        timeout=50, system_replace=True)
    ai_enabled = bool(ai_report)
    if not ai_report:
        # فالبکِ بدونِ AI از روی پرچم‌ها و سطوحِ ضعیف
        top_errors = [f["title_fa"] for f in flags[:3]] or ["دادهٔ کافی برای شناساییِ خطا هنوز ثبت نشده"]
        ai_report = (
            "نقاطِ قوت:\n"
            f"- امتیازِ انضباطِ تو {score} از ۱۰۰ است؛ ادامهٔ ثبتِ منظمِ ژورنال نقطهٔ قوتِ بزرگی است.\n\n"
            "۳ خطای اصلی:\n" + "".join(f"- {e}\n" for e in top_errors) + "\n"
            "برنامهٔ این هفته (۳ اقدامِ مشخص):\n"
            f"- روی ضعیف‌ترین سطح ({weak_lines}) تمرکز کن و درس‌های پیشنهادی را کامل کن.\n"
            "- پیش از هر معامله، احساسِ خود را در ژورنال ثبت کن و از معاملهٔ انتقامی پرهیز کن.\n"
            "- نسبتِ ریسک‌به‌ریوارد را حداقل ۱:۱.۵ نگه دار و سودها را زود نبند.")

    return {
        "emotions": emotions,
        "tags": tags,
        "practice": practice,
        "paper": paper,
        "discipline_score": discipline_score,
        "behavioral_flags": flags,
        "weak_levels": weak_levels,
        "ai_report": ai_report,
        "ai_enabled": ai_enabled,
    }


# ── مربیِ AI شخصی‌شده (کوچ) ──
@router.post("/mentor/coach")
async def mentor_coach(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """کوچینگِ اختصاصی: داده‌های پیشرفت/آزمون/ژورنال/تمرینِ خودِ دانش‌آموز را تحلیل می‌کند."""
    prog = (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.status == "completed"))).scalars().all()
    done_ids = {p.lesson_id for p in prog}
    quiz_scores = [p.quiz_score for p in prog if p.quiz_score is not None]
    lessons = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True))
               .order_by(AcademyLesson.level, AcademyLesson.order_in_level))).scalars().all()
    total = len(lessons)
    # ضعیف‌ترین سطح (کمترین نسبتِ تکمیل، با درسِ ناتمام)
    weak_level, weak_ratio = None, 2.0
    next_lessons = []
    for lv in _LEVELS:
        lvl = [l for l in lessons if l.level == lv]
        if not lvl:
            continue
        d = sum(1 for l in lvl if l.id in done_ids)
        ratio = d / len(lvl)
        if ratio < 1 and ratio < weak_ratio:
            weak_ratio, weak_level = ratio, lv
    if weak_level:
        for l in lessons:
            if l.level == weak_level and l.id not in done_ids and len(next_lessons) < 3:
                next_lessons.append({"slug": l.slug, "title": l.title_fa})
    # ژورنال
    jrows = (await db.execute(select(AcademyJournalEntry).where(AcademyJournalEntry.student_id == st.id))).scalars().all()
    jp = [float(j.pnl) for j in jrows if j.pnl is not None]
    jwins = [p for p in jp if p > 0]
    emos = {}
    for j in jrows:
        if j.emotion:
            emos[j.emotion] = emos.get(j.emotion, 0) + 1
    dom_emo = max(emos, key=emos.get) if emos else None
    # تمرین
    prows = (await db.execute(select(AcademyPracticeTrade).where(AcademyPracticeTrade.student_id == st.id))).scalars().all()
    pr = [float(t.pnl_r) for t in prows if t.pnl_r is not None]
    pwins = [x for x in pr if x > 0]
    facts = (
        f"پیشرفت: {len(done_ids)} از {total} درس ({round(100 * len(done_ids) / max(1, total))}٪). "
        f"میانگینِ آزمون‌ها: {round(sum(quiz_scores) / len(quiz_scores)) if quiz_scores else 'نامشخص'}٪. "
        f"ضعیف‌ترین سطح: {_LEVEL_FA.get(weak_level, '—')}. "
        f"ژورنال: {len(jrows)} معامله، نرخِ برد {round(100 * len(jwins) / len(jp)) if jp else '—'}٪، "
        f"احساسِ غالب: {dom_emo or 'ثبت‌نشده'}. "
        f"تمرینِ شبیه‌ساز: {len(prows)} معامله، نرخِ برد {round(100 * len(pwins) / len(pr)) if pr else '—'}٪.")
    report = await llm_client.complete(
        "تو مربیِ شخصیِ یک دانش‌آموزِ معامله‌گری هستی. بر اساسِ داده‌های واقعیِ زیر، یک کوچینگِ کوتاهِ "
        "شخصی‌شده بده در سه بخش با تیتر: «نقاط قوت»، «نقاط ضعف»، «برنامهٔ این هفته» (۲ تا ۳ اقدامِ مشخص). "
        f"صمیمی، انگیزشی و دقیق، حداکثر ۸ جمله.\n\nداده‌ها: {facts}",
        system="تو مربیِ شخصی‌سازِ معامله‌گری هستی؛ بر پایهٔ دادهٔ واقعیِ دانش‌آموز کوچ می‌دهی.",
        system_replace=True, timeout=50) or "کوچینگ در دسترس نیست."
    return {"report": report, "weak_level": _LEVEL_FA.get(weak_level) if weak_level else None,
            "recommended": next_lessons, "progress_pct": round(100 * len(done_ids) / max(1, total)),
            "avg_quiz": round(sum(quiz_scores) / len(quiz_scores)) if quiz_scores else None}


# ── برنامهٔ مطالعهٔ AI (فاز ۲ مربی) ──
def _plan_out(p: AcademyStudyPlan) -> dict:
    items = p.plan if isinstance(p.plan, list) else []
    return {"id": p.id, "goal": p.goal, "days": p.days, "items": items}


def _extract_json(raw: str) -> dict | None:
    """اولین بلاکِ {...} را از خروجیِ مدل بیرون می‌کشد و پارس می‌کند."""
    if not raw:
        return None
    s = raw.find("{")
    e = raw.rfind("}")
    if s < 0 or e <= s:
        return None
    try:
        return json.loads(raw[s:e + 1])
    except Exception:  # noqa: BLE001
        return None


@router.post("/mentor/study-plan")
async def mentor_study_plan_create(goal: str = Body("", embed=True), days: int = Body(30, embed=True),
                                   st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """برنامهٔ مطالعهٔ روزانه (با کلودِ سرور) بر پایهٔ درس‌های واقعی."""
    try:
        days = max(7, min(int(days), 90))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="تعدادِ روز نامعتبر است.")
    goal = (goal or "").strip()[:280] or "تسلطِ گام‌به‌گام بر معامله‌گری"

    lessons = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True))
               .order_by(AcademyLesson.level, AcademyLesson.order_in_level))).scalars().all()
    if not lessons:
        raise HTTPException(status_code=404, detail="درسی برای برنامه‌ریزی نیست.")
    done_ids = {p.lesson_id for p in (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.status == "completed"))).scalars().all()}

    # نمونه‌ای از درس‌های واقعی per سطح برای پرامپت
    sample_lines, by_level = [], {}
    for l in lessons:
        by_level.setdefault(l.level, []).append(l)
    for lv in _LEVELS:
        lvl = by_level.get(lv, [])[:12]
        if not lvl:
            continue
        sample_lines.append(f"سطحِ {_LEVEL_FA.get(lv, lv)}:")
        for l in lvl:
            sample_lines.append(f"  - {l.slug} | {l.title_fa}")
    valid_slugs = {l.slug for l in lessons}

    items = None
    prompt = (
        f"برای دانش‌آموزی با هدفِ «{goal}» یک برنامهٔ مطالعهٔ {days} روزه بساز. "
        f"هر روز یک ورودی داشته باشد و فقط از slugهای واقعیِ زیر استفاده کن.\n\n"
        + "\n".join(sample_lines) +
        '\n\nفقط و فقط JSON برگردان، دقیقاً با این ساختار:\n'
        '{"items":[{"day":1,"title":"...","lesson_slugs":["slug-واقعی"],"task":"یک تمرینِ کوتاه"}]}'
        f"\nباید دقیقاً {days} ورودی داشته باشد (day از ۱ تا {days})."
    )
    raw = await llm_client.complete(
        prompt=prompt, system="تو طراحِ مسیرِ یادگیریِ معامله‌گری هستی و فقط JSONِ معتبر برمی‌گردانی.",
        model=settings.ACADEMY_MENTOR_MODEL, timeout=90, system_replace=True)
    parsed = _extract_json(raw or "")
    if parsed and isinstance(parsed.get("items"), list) and parsed["items"]:
        cleaned = []
        for it in parsed["items"][:days]:
            if not isinstance(it, dict):
                continue
            slugs = [s for s in (it.get("lesson_slugs") or []) if s in valid_slugs]
            cleaned.append({"day": int(it.get("day") or len(cleaned) + 1),
                            "title": str(it.get("title") or f"روزِ {len(cleaned) + 1}")[:200],
                            "lesson_slugs": slugs[:5],
                            "task": str(it.get("task") or "")[:400], "done": False})
        if cleaned:
            items = cleaned

    if items is None:
        # فالبک: درس‌های ناتمام را روی روزها پخش کن
        todo = [l for l in lessons if l.id not in done_ids] or lessons
        per = max(1, (len(todo) + days - 1) // days)
        items = []
        for d in range(days):
            chunk = todo[d * per:(d + 1) * per]
            if not chunk and items:
                continue
            items.append({"day": d + 1,
                          "title": (chunk[0].title_fa if chunk else f"روزِ {d + 1} — مرور"),
                          "lesson_slugs": [l.slug for l in chunk],
                          "task": "درس‌های امروز را بخوان و آزمونِ هرکدام را بده.", "done": False})

    # آرشیوِ برنامهٔ فعالِ قبلی
    for old in (await db.execute(select(AcademyStudyPlan).where(
            AcademyStudyPlan.student_id == st.id, AcademyStudyPlan.status == "active"))).scalars().all():
        old.status = "archived"
    p = AcademyStudyPlan(student_id=st.id, goal=goal, days=days, plan=items, status="active")
    db.add(p)
    await db.commit()
    return {"plan": _plan_out(p)}


@router.get("/mentor/study-plan")
async def mentor_study_plan_get(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(AcademyStudyPlan).where(
        AcademyStudyPlan.student_id == st.id, AcademyStudyPlan.status == "active")
        .order_by(AcademyStudyPlan.id.desc()))).scalars().first()
    return {"plan": _plan_out(p) if p else None}


@router.post("/mentor/study-plan/day/{idx}/toggle")
async def mentor_study_plan_toggle(idx: int, st: AcademyStudent = Depends(require_vip),
                                   db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(AcademyStudyPlan).where(
        AcademyStudyPlan.student_id == st.id, AcademyStudyPlan.status == "active")
        .order_by(AcademyStudyPlan.id.desc()))).scalars().first()
    if p is None:
        raise HTTPException(status_code=404, detail="برنامهٔ فعالی نیست.")
    items = list(p.plan) if isinstance(p.plan, list) else []
    if idx < 0 or idx >= len(items):
        raise HTTPException(status_code=404, detail="روزِ نامعتبر.")
    items[idx] = {**items[idx], "done": not items[idx].get("done")}
    p.plan = items
    flag_modified(p, "plan")
    await db.commit()
    return {"ok": True, "done": items[idx]["done"]}


@router.delete("/mentor/study-plan")
async def mentor_study_plan_delete(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(AcademyStudyPlan).where(
        AcademyStudyPlan.student_id == st.id, AcademyStudyPlan.status == "active")
        .order_by(AcademyStudyPlan.id.desc()))).scalars().first()
    if p is not None:
        p.status = "archived"
        await db.commit()
    return {"ok": True}


# ── آزمونِ سطح‌سنجیِ ورودی + مسیرِ شخصی ──
@router.get("/assessment")
async def assessment(st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    """سوال‌های سطح‌سنجی — چند سوال از هر سطح (بدونِ پاسخِ درست)."""
    qs = []
    for lv in _LEVELS:
        rows = (await db.execute(select(AcademyQuiz, AcademyLesson.level)
                .join(AcademyLesson, AcademyQuiz.lesson_id == AcademyLesson.id)
                .where(AcademyLesson.level == lv, AcademyLesson.is_published.is_(True))
                .order_by(func.random()).limit(3))).all()
        for q, lvl in rows:
            qs.append({"id": q.id, "question": q.question_fa, "options": q.options, "level": lvl})
    random.shuffle(qs)
    return {"questions": qs, "count": len(qs)}


@router.post("/assessment/submit")
async def assessment_submit(answers: dict = Body(..., embed=True),
                            st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    ids = [int(k) for k in answers.keys()] or [-1]
    rows = (await db.execute(select(AcademyQuiz, AcademyLesson.level)
            .join(AcademyLesson, AcademyQuiz.lesson_id == AcademyLesson.id)
            .where(AcademyQuiz.id.in_(ids)))).all()
    per = {lv: [0, 0] for lv in _LEVELS}
    correct = 0
    for q, lvl in rows:
        chosen = answers.get(str(q.id), answers.get(q.id))
        per[lvl][1] += 1
        if chosen is not None and int(chosen) == q.correct_index:
            per[lvl][0] += 1; correct += 1
    total = sum(t for _, t in per.values())
    score = round(100 * correct / max(1, total))
    rec = "beginner"
    for lv in _LEVELS:
        c, t = per[lv]
        if t and c / t >= 0.6:
            rec = lv
    st.assessment_level = rec; st.assessment_score = score
    await db.commit()
    path = (await db.execute(select(AcademyLesson).where(
        AcademyLesson.level == rec, AcademyLesson.is_published.is_(True))
        .order_by(AcademyLesson.order_in_level).limit(5))).scalars().all()
    breakdown = {_LEVEL_FA.get(lv, lv): round(100 * c / t) for lv, (c, t) in per.items() if t}
    answered = {lv: round(100 * c / t) for lv, (c, t) in per.items() if t}
    weak_topics = []
    if answered:
        worst = min(answered.values())
        weak_topics = [_LEVEL_FA.get(lv, lv) for lv, pct in answered.items() if pct == worst]
    return {"level": _LEVEL_FA.get(rec, rec), "level_key": rec, "score": score, "breakdown": breakdown,
            "weak_topics": weak_topics,
            "path": [{"slug": l.slug, "title": l.title_fa} for l in path]}


# ── آزمایشگاهِ استراتژی (بک‌تستِ واقعی) ──
def _atr(candles, p=14):
    trs = [0.0]
    for i in range(1, len(candles)):
        h, l, pc = candles[i]["h"], candles[i]["l"], candles[i - 1]["c"]
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    atr = [None] * len(candles)
    if len(candles) > p:
        a = sum(trs[1:p + 1]) / p; atr[p] = a
        for i in range(p + 1, len(candles)):
            a = (a * (p - 1) + trs[i]) / p; atr[i] = a
    return atr


def _sma_list(arr, p):
    return [None if i < p - 1 else sum(arr[i - p + 1:i + 1]) / p for i in range(len(arr))]


def _rsi_list(closes, p=14):
    o = [None] * len(closes)
    if len(closes) <= p:
        return o
    g = sum(max(closes[i] - closes[i - 1], 0) for i in range(1, p + 1)) / p
    l = sum(max(closes[i - 1] - closes[i], 0) for i in range(1, p + 1)) / p
    o[p] = 100 - 100 / (1 + g / (l or 1e-9))
    for i in range(p + 1, len(closes)):
        ch = closes[i] - closes[i - 1]
        g = (g * (p - 1) + max(ch, 0)) / p; l = (l * (p - 1) + max(-ch, 0)) / p
        o[i] = 100 - 100 / (1 + g / (l or 1e-9))
    return o


def _run_backtest(candles, fast, slow, use_rsi, rsi_lo, rsi_hi, sl_atr, tp_atr):
    """هستهٔ بک‌تستِ کراسِ میانگین روی فهرستِ کندلِ ازپیش‌بارگذاری‌شده.

    خروجی: dict شاملِ trades, win_rate, net_r, profit_factor, rr, equity, bars.
    تمامِ حلقه‌ها کران‌دار (طولِ کندل‌ها)؛ ورودی‌ها در توابعِ صداکننده مقیّد می‌شوند.
    """
    rr = tp_atr / sl_atr
    if len(candles) < slow + 20:
        return None
    closes = [c["c"] for c in candles]
    maf, mas, rs, atr = _sma_list(closes, fast), _sma_list(closes, slow), _rsi_list(closes), _atr(candles)
    trades, pos = [], None
    for i in range(slow + 1, len(candles)):
        c = candles[i]
        if pos:
            if pos["dir"] == "buy":
                if c["l"] <= pos["sl"]: trades.append(-1.0); pos = None
                elif c["h"] >= pos["tp"]: trades.append(rr); pos = None
            else:
                if c["h"] >= pos["sl"]: trades.append(-1.0); pos = None
                elif c["l"] <= pos["tp"]: trades.append(rr); pos = None
        if not pos and atr[i] and maf[i] and mas[i] and maf[i - 1] and mas[i - 1]:
            up = maf[i - 1] <= mas[i - 1] and maf[i] > mas[i]
            dn = maf[i - 1] >= mas[i - 1] and maf[i] < mas[i]
            rsi_ok = (not use_rsi) or (rs[i] is not None and rsi_lo <= rs[i] <= rsi_hi)
            price = c["c"]
            if up and rsi_ok:
                pos = {"dir": "buy", "sl": price - sl_atr * atr[i], "tp": price + tp_atr * atr[i]}
            elif dn and rsi_ok:
                pos = {"dir": "sell", "sl": price + sl_atr * atr[i], "tp": price - tp_atr * atr[i]}
    wins = [t for t in trades if t > 0]
    gross_p = sum(wins); gross_l = sum(-t for t in trades if t < 0)
    equity, run = [0.0], 0.0
    for t in trades:
        run += t; equity.append(round(run, 2))
    return {"trades": len(trades),
            "win_rate": round(100 * len(wins) / len(trades)) if trades else None,
            "net_r": round(sum(trades), 2), "rr": round(rr, 2),
            "profit_factor": round(gross_p / gross_l, 2) if gross_l else (round(gross_p, 2) if gross_p else 0),
            "equity": equity, "bars": len(candles)}


@router.post("/strategy/backtest")
async def strategy_backtest(
    symbol: str = Body(..., embed=True), tf: str = Body("H1", embed=True),
    fast: int = Body(20, embed=True), slow: int = Body(50, embed=True),
    use_rsi: bool = Body(False, embed=True), rsi_lo: float = Body(0, embed=True), rsi_hi: float = Body(100, embed=True),
    sl_atr: float = Body(1.5, embed=True), tp_atr: float = Body(3.0, embed=True),
    st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db),
):
    """بک‌تستِ استراتژیِ کراسِ میانگین (با فیلترِ RSI و SL/TP بر پایهٔ ATR) روی دادهٔ واقعی."""
    fast = max(2, min(int(fast), 100)); slow = max(fast + 1, min(int(slow), 200))
    sl_atr = max(0.3, min(float(sl_atr), 6)); tp_atr = max(0.3, min(float(tp_atr), 12))
    candles = await _chart_rows(db, symbol, tf, limit=1000)
    res = _run_backtest(candles, fast, slow, use_rsi, rsi_lo, rsi_hi, sl_atr, tp_atr)
    if res is None:
        raise HTTPException(status_code=404, detail="دادهٔ کافی برای این نماد/تایم‌فریم نیست.")
    return {"symbol": symbol, "tf": tf, **res}


# ── استراتژیِ ذخیره‌شده (فاز ۴) ──
@router.post("/strategy/save")
async def strategy_save(name: str = Body(..., embed=True), kind: str = Body("lab", embed=True),
                        params: dict = Body(..., embed=True), metrics: dict | None = Body(None, embed=True),
                        st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """ذخیرهٔ یک استراتژی (آزمایشگاه/الگو) برای دانش‌آموزِ جاری."""
    nm = (name or "").strip()[:120]
    if not nm:
        raise HTTPException(status_code=400, detail="نام لازم است.")
    if kind not in ("lab", "algo"):
        kind = "lab"
    row = AcademySavedStrategy(student_id=st.id, name=nm, kind=kind,
                               params=params if isinstance(params, dict) else {},
                               metrics=metrics if isinstance(metrics, dict) else None)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {"ok": True, "id": row.id}


@router.get("/strategy/saved")
async def strategy_saved(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """فهرستِ استراتژی‌های ذخیره‌شدهٔ دانش‌آموزِ جاری."""
    rows = (await db.execute(select(AcademySavedStrategy).where(
        AcademySavedStrategy.student_id == st.id).order_by(AcademySavedStrategy.id.desc()))).scalars().all()
    return {"items": [{"id": r.id, "name": r.name, "kind": r.kind, "params": r.params or {},
                       "metrics": r.metrics, "created_at": r.created_at.isoformat() if r.created_at else None}
                      for r in rows]}


@router.delete("/strategy/saved/{sid}")
async def strategy_saved_delete(sid: int, st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """حذفِ یک استراتژیِ ذخیره‌شده (فقط اگر متعلق به همین دانش‌آموز باشد)."""
    row = (await db.execute(select(AcademySavedStrategy).where(
        AcademySavedStrategy.id == sid, AcademySavedStrategy.student_id == st.id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="یافت نشد.")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


# ── بهینه‌سازیِ شبکه‌ای (Grid optimization) ──
@router.post("/strategy/optimize")
async def strategy_optimize(
    symbol: str = Body(..., embed=True), tf: str = Body("H1", embed=True),
    fast_list: list = Body([5, 10, 20], embed=True), slow_list: list = Body([50, 100], embed=True),
    use_rsi: bool = Body(False, embed=True),
    sl_atr: float = Body(1.5, embed=True), tp_atr: float = Body(3.0, embed=True),
    st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db),
):
    """جست‌وجوی شبکه‌ای روی ترکیب‌های fast×slow (سقفِ ۶۴ ترکیب)."""
    sl_atr = max(0.3, min(float(sl_atr), 6)); tp_atr = max(0.3, min(float(tp_atr), 12))

    def _clean_fast(v):
        try: return max(2, min(int(v), 100))
        except (TypeError, ValueError): return None

    def _clean_slow(v):
        try: return max(3, min(int(v), 200))
        except (TypeError, ValueError): return None

    fl = sorted({x for x in (_clean_fast(v) for v in (fast_list or [])[:64]) if x is not None})
    sl = sorted({x for x in (_clean_slow(v) for v in (slow_list or [])[:64]) if x is not None})
    if not fl or not sl:
        raise HTTPException(status_code=400, detail="فهرستِ میانگین‌ها نامعتبر است.")
    # ترکیب‌های معتبرِ fast<slow را بساز و در ۶۴ مورد کران‌دار کن.
    combos = [(f, s) for s in sl for f in fl if f < s]
    truncated = len(combos) > 64
    combos = combos[:64]
    if not combos:
        raise HTTPException(status_code=400, detail="هیچ ترکیبِ معتبری (fast<slow) وجود ندارد.")
    candles = await _chart_rows(db, symbol, tf, limit=1000)
    results = []
    for f, s in combos:
        r = _run_backtest(candles, f, s, use_rsi, 30, 70, sl_atr, tp_atr)
        if r is None:
            continue
        results.append({"fast": f, "slow": s, "win_rate": r["win_rate"], "net_r": r["net_r"],
                        "profit_factor": r["profit_factor"], "trades": r["trades"]})
    if not results:
        raise HTTPException(status_code=404, detail="دادهٔ کافی برای این نماد/تایم‌فریم نیست.")
    results.sort(key=lambda x: x["net_r"], reverse=True)
    return {"symbol": symbol, "tf": tf, "results": results, "best": results[0],
            "tested": len(results), "truncated": truncated}


# ── اعتبارسنجیِ پیش‌رونده (Walk-forward) ──
@router.post("/strategy/walkforward")
async def strategy_walkforward(
    symbol: str = Body(..., embed=True), tf: str = Body("H1", embed=True),
    fast: int = Body(20, embed=True), slow: int = Body(50, embed=True),
    use_rsi: bool = Body(False, embed=True),
    sl_atr: float = Body(1.5, embed=True), tp_atr: float = Body(3.0, embed=True),
    windows: int = Body(5, embed=True),
    st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db),
):
    """تقسیمِ سری به چند پنجرهٔ مساوی و بک‌تستِ مستقلِ هر پنجره (آزمونِ پایداری)."""
    fast = max(2, min(int(fast), 100)); slow = max(fast + 1, min(int(slow), 200))
    sl_atr = max(0.3, min(float(sl_atr), 6)); tp_atr = max(0.3, min(float(tp_atr), 12))
    windows = max(2, min(int(windows), 12))
    candles = await _chart_rows(db, symbol, tf, limit=1000)
    seg_len = len(candles) // windows
    if seg_len < slow + 20:
        raise HTTPException(status_code=404, detail="دادهٔ کافی برای این تعداد پنجره نیست.")
    out, net_rs = [], []
    for w in range(windows):
        seg = candles[w * seg_len:(w + 1) * seg_len] if w < windows - 1 else candles[w * seg_len:]
        r = _run_backtest(seg, fast, slow, use_rsi, 30, 70, sl_atr, tp_atr)
        if r is None:
            out.append({"i": w, "win_rate": None, "net_r": 0.0, "trades": 0})
            net_rs.append(0.0)
        else:
            out.append({"i": w, "win_rate": r["win_rate"], "net_r": r["net_r"], "trades": r["trades"]})
            net_rs.append(r["net_r"])
    avg = round(sum(net_rs) / len(net_rs), 2) if net_rs else 0.0
    consistency = sum(1 for x in net_rs if x > 0)
    return {"symbol": symbol, "tf": tf, "windows": out, "avg_net_r": avg, "consistency": consistency}


# ── مسیرِ Algo / اتوماسیون ──
def _strat_spec(symbol, tf, fast, slow, use_rsi, rsi_lo, rsi_hi, sl_atr, tp_atr):
    s = (f"نماد {symbol}، تایم‌فریم {tf}. ورود: وقتی میانگینِ متحرکِ {fast} از بالای میانگینِ {slow} عبور کند → خرید؛ "
         f"و برعکس → فروش. ")
    if use_rsi:
        s += f"فقط اگر RSI بینِ {rsi_lo} و {rsi_hi} باشد. "
    s += f"حد ضرر = {sl_atr}×ATR و حد سود = {tp_atr}×ATR."
    return s


_ALGO_LANG = {
    "python": {"label": "پایتون", "block": "python",
               "extra": "از pandas برای محاسبهٔ میانگین/RSI/ATR استفاده کن و یک تابعِ check_signal داشته باش که سیگنالِ خرید/فروش برمی‌گرداند."},
    "javascript": {"label": "جاوااسکریپت (Node.js)", "block": "javascript",
                   "extra": "محاسبهٔ میانگین/RSI/ATR را با توابعِ ساده پیاده‌سازی کن و یک تابعِ checkSignal داشته باش که سیگنالِ خرید/فروش برمی‌گرداند."},
    "mql5": {"label": "MQL5 (متاتریدر ۵)", "block": "cpp",
             "extra": "آن را به‌صورتِ یک Expert Advisor با توابعِ OnInit و OnTick بنویس و از اندیکاتورهای iMA/iRSI/iATR استفاده کن."},
    "pine": {"label": "Pine Script (TradingView v5)", "block": "pine",
             "extra": "آن را به‌صورتِ یک indicator/strategy با //@version=5 بنویس و از ta.sma/ta.rsi/ta.atr و strategy.entry استفاده کن."},
}


@router.post("/algo/code")
async def algo_code(symbol: str = Body("EURUSD", embed=True), tf: str = Body("H1", embed=True),
                    fast: int = Body(20, embed=True), slow: int = Body(50, embed=True),
                    use_rsi: bool = Body(False, embed=True), rsi_lo: float = Body(30, embed=True), rsi_hi: float = Body(70, embed=True),
                    sl_atr: float = Body(1.5, embed=True), tp_atr: float = Body(3.0, embed=True),
                    language: str = Body("python", embed=True),
                    st: AcademyStudent = Depends(require_vip)):
    """تولیدِ کدِ آموزشیِ رباتِ معاملاتی از روی استراتژی (با کلودِ سرور) — چندزبانه."""
    lang = language if language in _ALGO_LANG else "python"
    meta = _ALGO_LANG[lang]
    spec = _strat_spec(symbol, tf, fast, slow, use_rsi, rsi_lo, rsi_hi, sl_atr, tp_atr)
    code = await llm_client.complete(
        f"یک رباتِ معاملاتیِ سادهٔ {meta['label']} بنویس که این استراتژی را پیاده‌سازی کند. "
        f"کد باید **کامنت‌های آموزشیِ فارسی** داشته باشد (توضیحِ هر بخش)، {meta['extra']} "
        f"اول ۲ جملهٔ توضیح، بعد کد در بلاکِ ```{meta['block']}.\n\n"
        f"استراتژی: {spec}",
        system="تو مدرسِ برنامه‌نویسیِ معاملاتیِ فارسی هستی؛ کدِ تمیز و آموزشی می‌نویسی.",
        system_replace=True, timeout=60) or "تولیدِ کد در دسترس نیست."
    return {"spec": spec, "code": code, "language": lang}


@router.post("/algo/signal")
async def algo_signal(symbol: str = Body(..., embed=True), tf: str = Body("H1", embed=True),
                      fast: int = Body(20, embed=True), slow: int = Body(50, embed=True),
                      use_rsi: bool = Body(False, embed=True), rsi_lo: float = Body(30, embed=True), rsi_hi: float = Body(70, embed=True),
                      sl_atr: float = Body(1.5, embed=True), tp_atr: float = Body(3.0, embed=True),
                      st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """سیگنالِ زندهٔ استراتژی روی آخرین کندل."""
    fast = max(2, min(int(fast), 100)); slow = max(fast + 1, min(int(slow), 200))
    candles = await _chart_rows(db, symbol, tf, limit=max(slow + 30, 300))
    if len(candles) < slow + 2:
        raise HTTPException(status_code=404, detail="دادهٔ کافی نیست.")
    closes = [c["c"] for c in candles]
    maf, mas, rs, atr = _sma_list(closes, fast), _sma_list(closes, slow), _rsi_list(closes), _atr(candles)
    i = len(candles) - 1
    sig, price = "none", closes[-1]
    if maf[i] and mas[i] and maf[i - 1] and mas[i - 1]:
        rsi_ok = (not use_rsi) or (rs[i] is not None and rsi_lo <= rs[i] <= rsi_hi)
        if maf[i - 1] <= mas[i - 1] and maf[i] > mas[i] and rsi_ok:
            sig = "buy"
        elif maf[i - 1] >= mas[i - 1] and maf[i] < mas[i] and rsi_ok:
            sig = "sell"
    sl = tp = None
    if sig != "none" and atr[i]:
        sl = round(price - sl_atr * atr[i] if sig == "buy" else price + sl_atr * atr[i], 5)
        tp = round(price + tp_atr * atr[i] if sig == "buy" else price - tp_atr * atr[i], 5)
    return {"signal": sig, "price": price, "sl": sl, "tp": tp, "rsi": rs[i], "symbol": symbol, "tf": tf}


# ── چالشِ فاندد (ارزیابیِ سبکِ پراپ‌فرم روی حسابِ مجازی) ──
_FUNDED = {"target_pct": 8.0, "max_dd_pct": 5.0, "min_trades": 10}
_FUNDED_TIERS = {
    "bronze": {"target_pct": 5.0, "max_dd_pct": 8.0, "min_trades": 5},
    "silver": {"target_pct": 8.0, "max_dd_pct": 5.0, "min_trades": 10},
    "gold":   {"target_pct": 10.0, "max_dd_pct": 4.0, "min_trades": 15},
}


async def _funded_progress(db, sid):
    """محاسبهٔ پیشرفتِ حسابِ مجازی (سود، افتِ سرمایه، تعداد معامله)."""
    await _settle_open(db, sid)
    closed = (await db.execute(select(AcademyPaperPosition).where(
        AcademyPaperPosition.student_id == sid, AcademyPaperPosition.status == "closed")
        .order_by(AcademyPaperPosition.id))).scalars().all()
    pnls = [float(c.pnl_usd) for c in closed if c.pnl_usd is not None]
    run = peak = _PAPER_START; maxdd = 0.0
    for p in pnls:
        run += p; peak = max(peak, run)
        dd = 100 * (peak - run) / peak if peak else 0
        maxdd = max(maxdd, dd)
    bal = _PAPER_START + sum(pnls)
    profit_pct = 100 * (bal - _PAPER_START) / _PAPER_START
    return {"balance": bal, "profit_pct": profit_pct, "max_dd": maxdd, "trades": len(closed)}


def _funded_rules(tier_rules, prog):
    rules = [
        {"name": "سودِ هدف", "target": tier_rules["target_pct"], "current": round(prog["profit_pct"], 2), "unit": "٪", "passed": prog["profit_pct"] >= tier_rules["target_pct"]},
        {"name": "حداکثر افتِ سرمایه", "target": tier_rules["max_dd_pct"], "current": round(prog["max_dd"], 2), "unit": "٪", "invert": True, "passed": prog["max_dd"] <= tier_rules["max_dd_pct"]},
        {"name": "حداقل معاملات", "target": tier_rules["min_trades"], "current": prog["trades"], "unit": "", "passed": prog["trades"] >= tier_rules["min_trades"]},
    ]
    return rules, all(r["passed"] for r in rules)


@router.get("/funded/status")
async def funded_status(tier: str = "bronze", st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    tier = tier if tier in _FUNDED_TIERS else "bronze"
    tier_rules = _FUNDED_TIERS[tier]
    prog = await _funded_progress(db, st.id)
    rules, passed = _funded_rules(tier_rules, prog)
    return {"tier": tier, "rules": rules, "passed": passed, "balance": round(prog["balance"], 2),
            "profit_pct": round(prog["profit_pct"], 2), "max_dd": round(prog["max_dd"], 2),
            "trades": prog["trades"], "name": st.full_name or st.username}


@router.post("/funded/certificate")
async def funded_certificate(tier: str = Body("bronze", embed=True),
                             st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """صدورِ گواهیِ چالشِ فاندد در صورتِ پاس‌شدنِ تیرِ موردنظر."""
    tier = tier if tier in _FUNDED_TIERS else "bronze"
    prog = await _funded_progress(db, st.id)
    _, passed = _funded_rules(_FUNDED_TIERS[tier], prog)
    if not passed:
        raise HTTPException(status_code=400, detail="هنوز چالش را پاس نکرده‌اید")
    level = f"funded_{tier}"
    existing = (await db.execute(select(AcademyCertificate).where(
        AcademyCertificate.student_id == st.id, AcademyCertificate.level == level))).scalar_one_or_none()
    if existing:
        return {"code": existing.code, "tier": tier}
    code = _cert_code(st.username, level)
    db.add(AcademyCertificate(student_id=st.id, level=level, code=code))
    await db.commit()
    return {"code": code, "tier": tier}


# ── بوت‌کمپِ زمان‌دار ──
_BOOTCAMPS = [
    {"id": "starter4w", "name": "بوت‌کمپِ ۴ هفته‌ایِ شروع", "weeks": 4, "level": "beginner",
     "desc": "از صفر تا اولین معاملهٔ منظم — ۴ هفته، هفته‌ای ۱۰ درس."},
    {"id": "pro6w", "name": "بوت‌کمپِ ۶ هفته‌ایِ حرفه‌ای", "weeks": 6, "level": "advanced",
     "desc": "تحلیلِ پیشرفته و مدیریتِ ریسک — ۶ هفته."},
]


def _bootcamp_plan(lessons, level, weeks):
    lvl = [l for l in lessons if l.level == level]
    per = max(1, (len(lvl) + weeks - 1) // weeks)
    return [[{"slug": l.slug, "title": l.title_fa} for l in lvl[w * per:(w + 1) * per]] for w in range(weeks)]


@router.get("/bootcamps")
async def bootcamps(st: AcademyStudent = Depends(require_vip)):
    return {"bootcamps": _BOOTCAMPS, "enrolled": st.bootcamp}


@router.post("/bootcamp/enroll")
async def bootcamp_enroll(bootcamp_id: str = Body(..., embed=True),
                          st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    if not any(b["id"] == bootcamp_id for b in _BOOTCAMPS):
        raise HTTPException(status_code=404, detail="بوت‌کمپ یافت نشد.")
    st.bootcamp = bootcamp_id
    st.bootcamp_started_at = datetime.now(timezone.utc)
    await db.commit()
    return {"ok": True, "bootcamp": bootcamp_id}


@router.get("/bootcamp/my")
async def bootcamp_my(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    if not st.bootcamp:
        return {"enrolled": False, "bootcamps": _BOOTCAMPS}
    bc = next((b for b in _BOOTCAMPS if b["id"] == st.bootcamp), None)
    if not bc:
        return {"enrolled": False, "bootcamps": _BOOTCAMPS}
    lessons = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True))
               .order_by(AcademyLesson.order_in_level))).scalars().all()
    plan = _bootcamp_plan(lessons, bc["level"], bc["weeks"])
    done = {p.lesson_id for p in (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.status == "completed"))).scalars().all()}
    slug_done = {l.slug for l in lessons if l.id in done}
    days = (datetime.now(timezone.utc) - st.bootcamp_started_at).days if st.bootcamp_started_at else 0
    cur_week = min(bc["weeks"], days // 7 + 1)
    weeks = []
    for w, wl in enumerate(plan, start=1):
        dn = sum(1 for x in wl if x["slug"] in slug_done)
        weeks.append({"week": w, "lessons": [{**x, "done": x["slug"] in slug_done} for x in wl],
                      "done": dn, "total": len(wl), "current": w == cur_week, "due": w <= cur_week})
    due_total = sum(len(plan[w]) for w in range(min(cur_week, len(plan))))
    due_done = sum(1 for w in range(min(cur_week, len(plan))) for x in plan[w] if x["slug"] in slug_done)
    return {"enrolled": True, "name": bc["name"], "weeks": weeks, "current_week": cur_week, "total_weeks": bc["weeks"],
            "on_track_pct": round(100 * due_done / max(1, due_total)), "started_at": st.bootcamp_started_at.isoformat() if st.bootcamp_started_at else None}


@router.get("/bootcamp/leaderboard")
async def bootcamp_leaderboard(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """رتبه‌بندیِ هم‌بوت‌کمپی‌ها (یا همهٔ دانش‌آموزان) بر اساسِ تعدادِ دروسِ کامل‌شده."""
    q = select(AcademyStudent)
    if st.bootcamp:
        q = q.where(AcademyStudent.bootcamp == st.bootcamp)
    students = (await db.execute(q)).scalars().all()
    rows = []
    for s in students:
        done = (await db.execute(select(func.count()).select_from(AcademyProgress).where(
            AcademyProgress.student_id == s.id, AcademyProgress.status == "completed"))).scalar() or 0
        rows.append((s, done))
    rows.sort(key=lambda x: x[1], reverse=True)
    items, my_rank = [], None
    for i, (s, done) in enumerate(rows[:50], start=1):
        is_me = s.id == st.id
        if is_me:
            my_rank = i
        items.append({"rank": i, "username": (s.username if is_me else _mask_username(s.username)),
                      "done": done, "xp": done * 10, "is_me": is_me})
    if my_rank is None:
        for i, (s, _d) in enumerate(rows, start=1):
            if s.id == st.id:
                my_rank = i
                break
    return {"items": items, "my_rank": my_rank}


@router.get("/bootcamp/today")
async def bootcamp_today(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    """درس‌های موعدرسیدهٔ این هفته که هنوز کامل نشده‌اند، برای بوت‌کمپِ فعالِ دانش‌آموز."""
    if not st.bootcamp:
        return {"items": [], "week": None}
    bc = next((b for b in _BOOTCAMPS if b["id"] == st.bootcamp), None)
    if not bc:
        return {"items": [], "week": None}
    lessons = (await db.execute(select(AcademyLesson).where(AcademyLesson.is_published.is_(True))
               .order_by(AcademyLesson.order_in_level))).scalars().all()
    plan = _bootcamp_plan(lessons, bc["level"], bc["weeks"])
    done = {p.lesson_id for p in (await db.execute(select(AcademyProgress).where(
        AcademyProgress.student_id == st.id, AcademyProgress.status == "completed"))).scalars().all()}
    slug_done = {l.slug for l in lessons if l.id in done}
    days = (datetime.now(timezone.utc) - st.bootcamp_started_at).days if st.bootcamp_started_at else 0
    cur_week = min(bc["weeks"], days // 7 + 1)
    wl = plan[cur_week - 1] if 1 <= cur_week <= len(plan) else []
    items = [{"slug": x["slug"], "title": x["title"]} for x in wl if x["slug"] not in slug_done]
    return {"items": items, "week": cur_week}


# ── گواهیِ معتبر + پورتفولیوی عمومی ──
def _cert_code(username, level):
    h = 0
    for ch in f"{username}|{level}|coinepro":
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    import string
    base = string.digits + string.ascii_uppercase
    s = ""
    while h:
        s = base[h % 36] + s; h //= 36
    return f"CP-{level[:3].upper()}-{s[:7].zfill(7)}"


async def _mastered(db, sid, level):
    lvl = (await db.execute(select(AcademyLesson.id).where(
        AcademyLesson.level == level, AcademyLesson.is_published.is_(True)))).scalars().all()
    if not lvl:
        return False
    done = (await db.execute(select(func.count()).select_from(AcademyProgress).where(
        AcademyProgress.student_id == sid, AcademyProgress.status == "completed",
        AcademyProgress.lesson_id.in_(lvl)))).scalar() or 0
    return done == len(lvl)


@router.post("/certificate/claim/{level}")
async def claim_certificate(level: str, st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    if level not in _LEVELS:
        raise HTTPException(status_code=404, detail="سطح نامعتبر.")
    if not await _mastered(db, st.id, level):
        raise HTTPException(status_code=403, detail="هنوز همهٔ درس‌های این سطح را کامل نکرده‌ای.")
    existing = (await db.execute(select(AcademyCertificate).where(
        AcademyCertificate.student_id == st.id, AcademyCertificate.level == level))).scalar_one_or_none()
    if existing:
        return {"code": existing.code, "level": _LEVEL_FA.get(level, level)}
    code = _cert_code(st.username, level)
    db.add(AcademyCertificate(student_id=st.id, level=level, code=code))
    await db.commit()
    return {"code": code, "level": _LEVEL_FA.get(level, level)}


@router.get("/public/verify/{code}")
async def verify_certificate(code: str, db: AsyncSession = Depends(get_db)):
    """راستی‌آزماییِ عمومیِ گواهی (بدونِ ورود)."""
    c = (await db.execute(select(AcademyCertificate).where(AcademyCertificate.code == code.strip().upper()))).scalar_one_or_none()
    if c is None:
        return {"valid": False}
    s = (await db.execute(select(AcademyStudent).where(AcademyStudent.id == c.student_id))).scalar_one_or_none()
    return {"valid": True, "name": (s.full_name or s.username) if s else "—",
            "level": _LEVEL_FA.get(c.level, c.level),
            "issued_at": c.issued_at.isoformat() if c.issued_at else None}


@router.get("/public/portfolio/{username}")
async def public_portfolio(username: str, db: AsyncSession = Depends(get_db)):
    """پورتفولیوی عمومیِ دانش‌آموز (بدونِ ورود)."""
    s = (await db.execute(select(AcademyStudent).where(AcademyStudent.username == username.strip().lower()))).scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="یافت نشد.")
    done = (await db.execute(select(func.count()).select_from(AcademyProgress).where(
        AcademyProgress.student_id == s.id, AcademyProgress.status == "completed"))).scalar() or 0
    total = (await db.execute(select(func.count()).select_from(AcademyLesson).where(AcademyLesson.is_published.is_(True)))).scalar() or 0
    certs = (await db.execute(select(AcademyCertificate).where(AcademyCertificate.student_id == s.id))).scalars().all()
    masteries = []
    for lv in _LEVELS:
        if await _mastered(db, s.id, lv):
            masteries.append(_LEVEL_FA.get(lv, lv))
    return {"name": s.full_name or s.username, "username": s.username,
            "completed": done, "total": total,
            "certificates": [{"level": _LEVEL_FA.get(c.level, c.level), "code": c.code} for c in certs],
            "masteries": masteries}


# ── داشبوردِ ابزارها (نمای بازار + همبستگی) ──
@router.get("/tools/overview")
async def tools_overview(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    syms = [r[0] for r in (await db.execute(text("SELECT DISTINCT symbol FROM candles ORDER BY symbol"))).fetchall()]
    rows = []
    up = 0
    for sym in syms:
        r = (await db.execute(text(
            "SELECT close FROM candles WHERE symbol=:s AND timeframe='D1' ORDER BY time DESC LIMIT 2"), {"s": sym})).fetchall()
        if len(r) < 2:
            continue
        cur, prev = float(r[0][0]), float(r[1][0])
        ch = round(100 * (cur - prev) / prev, 2) if prev else 0
        if ch >= 0:
            up += 1
        rows.append({"symbol": sym, "price": cur, "change": ch})
    sentiment = round(100 * up / len(rows)) if rows else 50
    return {"symbols": rows, "sentiment": sentiment, "bullish": up, "total": len(rows)}


@router.get("/tools/correlations")
async def tools_correlations(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    syms = [r[0] for r in (await db.execute(text("SELECT DISTINCT symbol FROM candles ORDER BY symbol"))).fetchall()][:10]
    series = {}
    for sym in syms:
        cs = (await db.execute(text(
            "SELECT close FROM candles WHERE symbol=:s AND timeframe='H4' ORDER BY time DESC LIMIT 80"), {"s": sym})).fetchall()
        closes = [float(x[0]) for x in reversed(cs)]
        rets = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
        series[sym] = rets
    n = min((len(v) for v in series.values()), default=0)
    def corr(a, b):
        a, b = a[-n:], b[-n:]
        if n < 5:
            return 0
        ma, mb = sum(a) / n, sum(b) / n
        cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
        va = sum((x - ma) ** 2 for x in a) ** 0.5; vb = sum((x - mb) ** 2 for x in b) ** 0.5
        return round(cov / (va * vb), 2) if va and vb else 0
    matrix = [[corr(series[x], series[y]) for y in syms] for x in syms]
    return {"symbols": syms, "matrix": matrix}


# ── ماشین‌حساب‌های معامله‌گری (فاز ۳) ──
@router.get("/tools/position-size")
async def tools_position_size(account: float, risk_pct: float, entry: float, sl: float,
                              symbol: str = "EURUSD", st: AcademyStudent = Depends(require_vip)):
    acc = _ffloat(account, "account"); rp = _ffloat(risk_pct, "risk_pct")
    e = _ffloat(entry, "entry"); s = _ffloat(sl, "sl")
    risk_usd = acc * rp / 100
    pip = _pip_size(symbol)
    sl_pips = abs(e - s) / pip
    size = risk_usd / max(sl_pips * pip, 1e-9)
    return {"risk_usd": round(risk_usd, 2), "sl_pips": round(sl_pips, 1),
            "size": round(size, 4), "units": round(size, 4)}


@router.get("/tools/pip-calc")
async def tools_pip_calc(symbol: str, pips: float, size: float, st: AcademyStudent = Depends(require_vip)):
    p = _ffloat(pips, "pips"); sz = _ffloat(size, "size")
    pip = _pip_size(symbol)
    usd = p * pip * sz
    return {"usd": round(usd, 2)}


@router.get("/tools/rr")
async def tools_rr(entry: float, sl: float, tp: float, st: AcademyStudent = Depends(require_vip)):
    e = _ffloat(entry, "entry"); s = _ffloat(sl, "sl"); t = _ffloat(tp, "tp")
    risk = abs(e - s); reward = abs(t - e)
    rr = reward / risk if risk else 0
    return {"rr": round(rr, 2), "risk": round(risk, 5), "reward": round(reward, 5)}


@router.get("/tools/sessions")
async def tools_sessions(st: AcademyStudent = Depends(require_vip)):
    now = datetime.utcnow()
    h = now.hour
    defs = [("Sydney", 22, 7), ("Tokyo", 0, 9), ("London", 7, 16), ("New York", 13, 22)]
    out, active = [], []
    for name, o, c in defs:
        is_active = (o <= h < c) if o < c else (h >= o or h < c)
        if is_active:
            active.append(name)
        out.append({"name": name, "open": f"{o:02d}:00", "close": f"{c:02d}:00", "active": is_active})
    return {"now_utc": now.strftime("%H:%M"), "sessions": out, "active": active}


# ── اشتراک (پرداختِ USDT BEP-20) ──
@router.post("/subscribe")
async def subscribe(tier: str = Body(..., embed=True), tx_hash: str = Body(..., embed=True),
                    months: int = Body(1, embed=True),
                    st: AcademyStudent = Depends(current_student), db: AsyncSession = Depends(get_db)):
    if tier not in ("vip", "premium"):
        raise HTTPException(status_code=400, detail="پلنِ نامعتبر.")
    tx = (tx_hash or "").strip()
    if len(tx) < 10:
        raise HTTPException(status_code=400, detail="هشِ تراکنش را درست وارد کن.")
    months = max(1, min(int(months or 1), 24))
    price = settings.ACADEMY_PRICE_VIP_MONTHLY if tier == "vip" else settings.ACADEMY_PRICE_PREMIUM_MONTHLY
    sub = AcademySubscription(student_id=st.id, tier=tier, status="pending",
                              amount_usdt=round(price * months, 2))
    db.add(sub)
    await db.flush()
    # هشِ تراکنش را در noteِ دانش‌آموز نگه می‌داریم تا ادمین موقعِ تأیید ببیند
    st.notes = ((st.notes or "") + f"\n[pay#{sub.id}] {tier} {months}m tx={tx}").strip()[:1000]
    await db.commit()
    logger.info("academy_subscribe_request", sid=st.id, tier=tier, sub=sub.id)
    return {"ok": True, "request_id": sub.id, "amount_usdt": float(sub.amount_usdt),
            "message": "درخواستِ اشتراک ثبت شد؛ پس از تأییدِ ادمین فعال می‌شود."}


# ── مربیِ AI ──
@router.post("/mentor/ask")
async def mentor_ask(question: str = Body(..., embed=True), lang: str = Body("fa", embed=True),
                     thread_id: int | None = Body(None, embed=True),
                     lesson_slug: str | None = Body(None, embed=True),
                     st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    if not settings.ACADEMY_ENABLED:
        raise HTTPException(status_code=503, detail="آکادمی غیرفعال است.")
    current_lesson = None
    if lesson_slug:
        l = (await db.execute(select(AcademyLesson).where(
            AcademyLesson.slug == lesson_slug.strip(), AcademyLesson.is_published.is_(True)))).scalar_one_or_none()
        if l is not None:
            current_lesson = f"عنوان: {l.title_fa}\n" + _strip_html(l.content_fa or "")[:1500]
    from src.academy.mentor import ask as mentor_ask_fn
    res = await mentor_ask_fn(db, st.id, _effective_tier(st), question, lang=(lang or "fa"),
                              thread_id=thread_id, current_lesson=current_lesson)
    if res.get("error") and "answer" not in res:
        raise HTTPException(status_code=429 if res.get("quota_left") == 0 else 503, detail=res["error"])
    return res


@router.get("/mentor/threads")
async def mentor_threads(st: AcademyStudent = Depends(require_vip), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AcademyMentorThread).where(AcademyMentorThread.student_id == st.id)
            .order_by(AcademyMentorThread.last_at.desc()).limit(50))).scalars().all()
    return {"threads": [{"id": t.id, "title": t.title,
                         "last_at": t.last_at.isoformat() if t.last_at else None} for t in rows]}


@router.get("/mentor/thread/{thread_id}")
async def mentor_thread(thread_id: int, st: AcademyStudent = Depends(require_vip),
                        db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(AcademyMentorThread).where(
        AcademyMentorThread.id == thread_id, AcademyMentorThread.student_id == st.id))).scalar_one_or_none()
    if t is None:
        raise HTTPException(status_code=404, detail="ترد یافت نشد.")
    msgs = (await db.execute(select(AcademyMentorMessage).where(AcademyMentorMessage.thread_id == thread_id)
            .order_by(AcademyMentorMessage.id.asc()))).scalars().all()
    return {"id": t.id, "title": t.title, "messages": [
        {"role": m.role, "content": m.content,
         "at": m.created_at.isoformat() if m.created_at else None} for m in msgs]}
