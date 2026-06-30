"""
مسیرهای مدیریت و داشبورد ادمین.

شامل آمار کلی داشبورد، وضعیت سرویس‌ها و قابلیت ری‌استارت سرویس‌ها.
فقط ادمین‌ها دسترسی دارند.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from src.api.deps import get_current_admin, get_db, get_redis
from src.core.database import Admin, Signal, User
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

MANAGED_SERVICES = [
    "telegram_bot",
    "signal_analyzer",
    "price_fetcher",
    "ml_predictor",
    "notification_worker",
]


@router.get("/stats")
async def dashboard_stats(
    admin: Admin = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """
    آمار داشبورد مدیریت.

    شامل تعداد کل کاربران، کاربران فعال، تعداد سیگنال‌ها، سیگنال‌های
    فعال، نرخ موفقیت و درآمد تخمینی. این آمار در ردیس کش می‌شود.
    """
    cache_key = "admin:dashboard_stats"
    cached = await redis.get(cache_key)
    if cached:
        import json
        return json.loads(cached)

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_users_r = await db.execute(select(func.count(User.id)))
    total_users = total_users_r.scalar() or 0

    active_users_conditions = []
    if hasattr(User, "is_active"):
        active_users_conditions.append(User.is_active.is_(True))
    if hasattr(User, "is_banned"):
        active_users_conditions.append(User.is_banned.is_(False))
    if active_users_conditions:
        from sqlalchemy import and_
        active_users_r = await db.execute(
            select(func.count(User.id)).where(and_(*active_users_conditions))
        )
    else:
        active_users_r = await db.execute(select(func.count(User.id)))
    active_users = active_users_r.scalar() or 0

    new_today_r = await db.execute(
        select(func.count(User.id)).where(User.joined_at >= today_start)
    )
    new_users_today = new_today_r.scalar() or 0

    total_signals_r = await db.execute(select(func.count(Signal.id)))
    total_signals = total_signals_r.scalar() or 0

    active_signals_r = await db.execute(
        select(func.count(Signal.id)).where(Signal.status == "active")
    )
    active_signals = active_signals_r.scalar() or 0

    signals_today_r = await db.execute(
        select(func.count(Signal.id)).where(Signal.created_at >= today_start)
    )
    signals_today = signals_today_r.scalar() or 0

    closed_signals_r = await db.execute(
        select(func.count(Signal.id)).where(Signal.status.in_(["tp_hit", "sl_hit", "closed"]))
    )
    closed_signals = closed_signals_r.scalar() or 0

    won_signals_r = await db.execute(
        select(func.count(Signal.id)).where(Signal.pnl_pips > 0, Signal.status.in_(["tp_hit", "sl_hit", "closed"]))
    )
    won_signals = won_signals_r.scalar() or 0

    win_rate = round((won_signals / closed_signals * 100) if closed_signals > 0 else 0, 2)

    total_pips_r = await db.execute(
        select(func.sum(Signal.pnl_pips)).where(Signal.status.in_(["tp_hit", "sl_hit", "closed"]))
    )
    total_pips = round(float(total_pips_r.scalar() or 0), 1)

    premium_count = 0
    if hasattr(User, "plan"):
        premium_r = await db.execute(
            select(func.count(User.id)).where(User.plan != "free")
        )
        premium_count = premium_r.scalar() or 0

    stats = {
        "users": {
            "total": total_users,
            "active": active_users,
            "new_today": new_users_today,
            "premium": premium_count,
        },
        "signals": {
            "total": total_signals,
            "active": active_signals,
            "today": signals_today,
            "closed": closed_signals,
        },
        "performance": {
            "win_rate": win_rate,
            "total_pips": total_pips,
            "won": won_signals,
            "lost": closed_signals - won_signals,
        },
        "generated_at": now.isoformat(),
    }

    import json
    await redis.setex(cache_key, 300, json.dumps(stats))

    return stats


@router.get("/services")
async def service_statuses(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    وضعیت تمام سرویس‌های سیستم.

    وضعیت هر سرویس (فعال/غیرفعال) و زمان آخرین فعالیت (heartbeat)
    را از ردیس خوانده و برمی‌گرداند.
    """
    services = []

    for service_name in MANAGED_SERVICES:
        heartbeat_key = f"service:heartbeat:{service_name}"
        status_key = f"service:status:{service_name}"

        last_heartbeat = await redis.get(heartbeat_key)
        service_status = await redis.get(status_key)

        if last_heartbeat:
            last_seen = datetime.fromisoformat(last_heartbeat.decode() if isinstance(last_heartbeat, bytes) else last_heartbeat)
            now = datetime.now(timezone.utc)
            is_healthy = (now - last_seen).total_seconds() < 120
        else:
            last_seen = None
            is_healthy = False

        services.append({
            "name": service_name,
            "status": service_status.decode() if isinstance(service_status, bytes) and service_status else "unknown",
            "healthy": is_healthy,
            "last_heartbeat": last_seen.isoformat() if last_seen else None,
        })

    return {"services": services}


@router.post("/services/{service_name}/restart")
async def restart_service(
    service_name: str,
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    ری‌استارت یک سرویس.

    دستور ری‌استارت را از طریق ردیس به سرویس مربوطه ارسال می‌کند.
    سرویس مورد نظر باید در لیست سرویس‌های مدیریت‌شده باشد.
    """
    if service_name not in MANAGED_SERVICES:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"سرویس '{service_name}' یافت نشد. سرویس‌های مجاز: {', '.join(MANAGED_SERVICES)}",
        )

    import json

    restart_command = json.dumps({
        "action": "restart",
        "service": service_name,
        "requested_by": admin.id,
        "requested_at": datetime.now(timezone.utc).isoformat(),
    })

    await redis.publish(f"service:commands:{service_name}", restart_command)
    await redis.set(
        f"service:status:{service_name}",
        "restarting",
        ex=300,
    )

    logger.info(
        "دستور ری‌استارت سرویس '%s' توسط ادمین '%s' ارسال شد.",
        service_name,
        admin.username,
    )

    return {
        "message": f"دستور ری‌استارت سرویس '{service_name}' ارسال شد.",
        "service": service_name,
        "status": "restarting",
    }
