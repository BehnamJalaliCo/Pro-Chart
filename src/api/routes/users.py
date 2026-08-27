"""
مسیرهای مدیریت کاربران.

شامل لیست کاربران با جستجو، مشاهده جزئیات، تغییر پلن، مسدودسازی،
رفع مسدودیت و ارسال پیام به کاربر.
فقط ادمین‌ها به این مسیرها دسترسی دارند.
"""

from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import String, and_, cast, desc, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.api.deps import get_current_admin, get_db, get_redis
from src.core.database import Admin, User
from src.core.html_sanitizer import mask_sensitive_id
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


class PlanUpdateRequest(BaseModel):
    """مدل درخواست تغییر پلن کاربر."""

    plan: str = Field(
        ...,
        min_length=1,
        max_length=32,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="نام پلن جدید",
    )
    duration_days: Optional[int] = Field(None, ge=1, description="مدت اعتبار بر حسب روز")


class UserMessageRequest(BaseModel):
    """مدل درخواست ارسال پیام به کاربر."""

    message: str = Field(..., min_length=1, max_length=4096, description="متن پیام")
    message_type: Literal["text", "image", "document"] = Field(
        "text", description="نوع پیام (text/image/document)"
    )


class GrantSignalRequest(BaseModel):
    """اعطای دسترسیِ رایگانِ کانالِ سیگنال برای N روز + اعلان به کاربر."""

    days: int = Field(..., ge=1, le=3650, description="تعدادِ روزِ دسترسیِ رایگان")
    message: Optional[str] = Field(
        None, max_length=2048, description="پیامِ سفارشیِ اختیاری (خالی=پیامِ پیش‌فرض)"
    )


def _user_full_dict(user: User) -> dict:
    """نسخهٔ کاملِ کاربر برای خروجیِ پرینت/اکسلِ پشتیبانی (شمارهٔ تماس کامل)."""
    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": " ".join(x for x in [user.first_name, user.last_name] if x) or None,
        "phone_number": getattr(user, "phone_number", None),
        "email": getattr(user, "email", None),
        "plan": user.plan or "free",
        "skill_level": getattr(user, "skill_level", None),
        "skill_score": getattr(user, "skill_score", None),
        "status": getattr(user, "status", None),
        "is_banned": user.is_banned,
        "is_active": user.is_active,
        "referral_code": getattr(user, "referral_code", None),
        "joined_at": user.joined_at.isoformat() if user.joined_at else None,
        "last_activity": user.last_active.isoformat() if user.last_active else None,
        "registration_date": (
            user.registration_date.isoformat()
            if getattr(user, "registration_date", None) else None
        ),
    }


def _user_to_dict(user: User) -> dict:
    """
    تبدیل آبجکت کاربر به دیکشنری.

    فیلدهای اصلی کاربر را به فرمت مناسب برای پاسخ API تبدیل می‌کند.
    اطلاعات حساس مانند شناسه تلگرام ماسک می‌شوند.
    """
    return {
        "id": user.id,
        "telegram_id": mask_sensitive_id(user.telegram_id),
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "plan": user.plan or "free",
        "is_banned": user.is_banned,
        "is_active": user.is_active,
        "joined_at": user.joined_at.isoformat() if user.joined_at else None,
        "last_activity": user.last_active.isoformat() if user.last_active else None,
        # ── فیلدهای ربات نسخه‌ی ۲ ──
        "status": getattr(user, "status", None),
        "skill_level": getattr(user, "skill_level", None),
        "skill_score": getattr(user, "skill_score", None),
        "phone_number": getattr(user, "phone_number", None),
        "referral_code": getattr(user, "referral_code", None),
        "referred_by": getattr(user, "referred_by", None),
        "registration_date": (
            user.registration_date.isoformat()
            if getattr(user, "registration_date", None) else None
        ),
    }


@router.get("")
async def list_users(
    search: Optional[str] = Query(None, description="جستجو بر اساس نام، نام کاربری یا شناسه تلگرام"),
    plan: Optional[str] = Query(None, description="فیلتر بر اساس پلن"),
    is_banned: Optional[bool] = Query(None, description="فیلتر کاربران مسدود"),
    page: int = Query(1, ge=1, description="شماره صفحه"),
    per_page: int = Query(20, ge=1, le=100, description="تعداد در هر صفحه"),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    دریافت لیست کاربران با قابلیت جستجو و فیلتر.

    کاربران بر اساس نام، نام کاربری، شناسه تلگرام، پلن و وضعیت
    مسدودیت قابل فیلتر هستند. نتایج صفحه‌بندی شده هستند.
    """
    conditions = []

    if search:
        search_term = f"%{search}%"
        search_conditions = [cast(User.telegram_id, String).like(search_term)]

        if hasattr(User, "username"):
            search_conditions.append(User.username.ilike(search_term))
        if hasattr(User, "first_name"):
            search_conditions.append(User.first_name.ilike(search_term))
        if hasattr(User, "last_name"):
            search_conditions.append(User.last_name.ilike(search_term))

        conditions.append(or_(*search_conditions))

    if plan:
        conditions.append(User.plan == plan)

    if is_banned is not None:
        if hasattr(User, "is_banned"):
            conditions.append(User.is_banned == is_banned)

    query = select(User)
    if conditions:
        query = query.where(and_(*conditions))

    # DB-side COUNT — یک عدد به‌جای fetch تمام IDها
    count_query = select(func.count(User.id))
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * per_page
    query = query.order_by(desc(User.joined_at)).offset(offset).limit(per_page)

    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "items": [_user_to_dict(u) for u in users],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/export")
async def export_users(
    search: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),
    skill_level: Optional[str] = Query(None),
    is_banned: Optional[bool] = Query(None),
    limit: int = Query(5000, ge=1, le=20000),
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """خروجیِ کاملِ کاربران (بدونِ صفحه‌بندی) برای پرینت/اکسلِ پشتیبانی — با شمارهٔ تماس."""
    conditions = []
    if search:
        term = f"%{search}%"
        conditions.append(or_(
            cast(User.telegram_id, String).like(term),
            User.username.ilike(term),
            User.first_name.ilike(term),
            User.last_name.ilike(term),
            User.phone_number.ilike(term),
        ))
    if plan:
        conditions.append(User.plan == plan)
    if skill_level:
        conditions.append(User.skill_level == skill_level)
    if is_banned is not None:
        conditions.append(User.is_banned == is_banned)

    query = select(User)
    if conditions:
        query = query.where(and_(*conditions))
    query = query.order_by(desc(User.joined_at)).limit(limit)
    users = (await db.execute(query)).scalars().all()
    return {
        "items": [_user_full_dict(u) for u in users],
        "count": len(users),
        "filters": {"search": search, "plan": plan, "skill_level": skill_level, "is_banned": is_banned},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    دریافت جزئیات یک کاربر.

    اطلاعات کامل کاربر شامل پلن، وضعیت فعالیت و تاریخ‌ها
    را برمی‌گرداند.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کاربر یافت نشد.",
        )

    return _user_to_dict(user)


@router.patch("/{user_id}/plan")
async def change_user_plan(
    user_id: int,
    body: PlanUpdateRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    تغییر پلن اشتراک کاربر.

    پلن کاربر به پلن جدید تغییر می‌کند. در صورت تعیین مدت اعتبار،
    تاریخ انقضا نیز تنظیم می‌شود.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کاربر یافت نشد.",
        )

    old_plan = getattr(user, "plan", "free")
    user.plan = body.plan

    if body.duration_days and hasattr(user, "plan_expires_at"):
        from datetime import timedelta
        user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=body.duration_days)

    if hasattr(user, "updated_at"):
        user.updated_at = datetime.now(timezone.utc)

    await db.flush()

    logger.info(
        "پلن کاربر %d توسط ادمین '%s' از '%s' به '%s' تغییر کرد.",
        user.id,
        admin.username,
        old_plan,
        body.plan,
    )

    return {
        "message": f"پلن کاربر با موفقیت به '{body.plan}' تغییر کرد.",
        "user": _user_to_dict(user),
    }


@router.post("/{user_id}/ban")
async def ban_user(
    user_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    مسدود کردن کاربر.

    کاربر مسدود شده دیگر قادر به استفاده از خدمات نخواهد بود.
    دسترسی به ربات تلگرام و سیگنال‌ها قطع می‌شود.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کاربر یافت نشد.",
        )

    if getattr(user, "is_banned", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کاربر قبلا مسدود شده است.",
        )

    if hasattr(user, "is_banned"):
        user.is_banned = True
    if hasattr(user, "banned_at"):
        user.banned_at = datetime.now(timezone.utc)
    if hasattr(user, "banned_by"):
        user.banned_by = admin.id

    await db.flush()

    logger.info("کاربر %d توسط ادمین '%s' مسدود شد.", user.id, admin.username)

    return {"message": "کاربر با موفقیت مسدود شد.", "user": _user_to_dict(user)}


@router.post("/{user_id}/unban")
async def unban_user(
    user_id: int,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    رفع مسدودیت کاربر.

    دسترسی کاربر به خدمات بازگردانده می‌شود.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کاربر یافت نشد.",
        )

    if not getattr(user, "is_banned", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کاربر مسدود نیست.",
        )

    if hasattr(user, "is_banned"):
        user.is_banned = False
    if hasattr(user, "banned_at"):
        user.banned_at = None
    if hasattr(user, "banned_by"):
        user.banned_by = None

    await db.flush()

    logger.info("مسدودیت کاربر %d توسط ادمین '%s' رفع شد.", user.id, admin.username)

    return {"message": "مسدودیت کاربر با موفقیت رفع شد.", "user": _user_to_dict(user)}


@router.post("/{user_id}/message")
async def send_message_to_user(
    user_id: int,
    body: UserMessageRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    ارسال پیام مستقیم به کاربر.

    پیام از طریق ربات تلگرام به کاربر ارسال می‌شود. پیام در صف ردیس
    قرار گرفته و توسط ورکر تلگرام پردازش می‌شود.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="کاربر یافت نشد.",
        )

    import json

    message_payload = json.dumps({
        "telegram_id": mask_sensitive_id(user.telegram_id),
        "telegram_id_raw": user.telegram_id,  # برای عملیات backend
        "message": body.message,
        "message_type": body.message_type,
        "sent_by": admin.id,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    })

    await redis.rpush("telegram:direct_messages", message_payload)

    logger.info(
        "پیام مستقیم به کاربر %d توسط ادمین '%s' در صف قرار گرفت.",
        user.id,
        admin.username,
    )

    return {
        "message": "پیام با موفقیت در صف ارسال قرار گرفت.",
        "user_id": user.id,
        "telegram_id": mask_sensitive_id(user.telegram_id),
    }


@router.post("/{user_id}/grant-signal-access")
async def grant_signal_access(
    user_id: int,
    body: GrantSignalRequest,
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """اعطای دسترسیِ رایگانِ کانالِ سیگنال برای N روز + اعلانِ آنیِ تلگرامی به کاربر.

    اشتراکِ موقت می‌سازد، عضویتِ کانال را فعال می‌کند، لینکِ دعوت را (از طریقِ
    رویدادِ subscription_approved) و یک پیامِ اطلاع‌رسانی برای کاربر می‌فرستد.
    """
    import json

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="کاربر یافت نشد.")

    from src.bot.services.access import grant_free_signal_days

    result = await grant_free_signal_days(user.telegram_id, body.days, admin_id=admin.id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="کاربر هنوز ربات را /start نکرده؛ امکانِ اعطا نیست.",
        )

    # رویدادِ فعال‌سازی → event_consumer لینکِ دعوتِ کانال را برای کاربر می‌فرستد
    await redis.rpush("telegram:events", json.dumps({
        "action": "subscription_approved",
        "telegram_id": user.telegram_id,
        "plan_label": result["plan_label"],
    }))

    # پیامِ اطلاع‌رسانیِ شفاف (سفارشی یا پیش‌فرض)
    notify = body.message or (
        f"🎁 تبریک! به شما <b>{body.days} روز</b> دسترسیِ <b>رایگانِ کانالِ سیگنال</b> "
        f"داده شد.\nلینکِ ورود به کانال در پیامِ بعدی برایتان ارسال می‌شود. ✅"
    )
    await redis.rpush("telegram:direct_messages", json.dumps({
        "telegram_id": user.telegram_id,
        "telegram_id_raw": user.telegram_id,
        "message": notify,
        "message_type": "text",
        "sent_by": admin.id,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }))

    logger.info(
        "دسترسیِ رایگانِ %d روزهٔ کانالِ سیگنال به کاربر %d توسط ادمین '%s' داده شد.",
        body.days, user.id, admin.username,
    )
    return {
        "message": f"دسترسیِ رایگانِ {body.days} روزه اعطا و به کاربر اطلاع داده شد.",
        "user_id": user.id,
        "days": body.days,
        "expires_at": result["expires_at"],
    }
