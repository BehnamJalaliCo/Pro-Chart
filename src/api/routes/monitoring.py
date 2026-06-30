"""
مسیرهای مانیتورینگ سیستم.

شامل اطلاعات CPU، RAM، دیسک، وضعیت سرویس‌ها و لاگ‌های اخیر.
فقط ادمین‌ها دسترسی دارند.
"""

import os
from datetime import datetime, timezone
from typing import Optional

import psutil
from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.api.deps import get_current_admin, get_redis
from src.core.database import Admin
from src.core.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

SERVICE_NAMES = [
    "telegram_bot",
    "signal_analyzer",
    "price_fetcher",
    "ml_predictor",
    "notification_worker",
    "api_server",
]


@router.get("/system")
async def system_metrics(admin: Admin = Depends(get_current_admin)):
    """
    اطلاعات منابع سیستم.

    شامل مصرف CPU، حافظه RAM، فضای دیسک و اطلاعات شبکه.
    مقادیر به درصد و بایت ارائه می‌شوند.
    """
    cpu_percent = psutil.cpu_percent(interval=0.5)
    cpu_count = psutil.cpu_count()
    cpu_freq = psutil.cpu_freq()

    memory = psutil.virtual_memory()
    swap = psutil.swap_memory()

    disk = psutil.disk_usage("/")

    boot_time = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)
    uptime_seconds = (datetime.now(timezone.utc) - boot_time).total_seconds()

    net_io = psutil.net_io_counters()

    load_avg = os.getloadavg()

    return {
        "cpu": {
            "percent": cpu_percent,
            "count": cpu_count,
            "freq_mhz": round(cpu_freq.current, 2) if cpu_freq else None,
            "load_avg_1m": round(load_avg[0], 2),
            "load_avg_5m": round(load_avg[1], 2),
            "load_avg_15m": round(load_avg[2], 2),
        },
        "memory": {
            "total_gb": round(memory.total / (1024 ** 3), 2),
            "used_gb": round(memory.used / (1024 ** 3), 2),
            "available_gb": round(memory.available / (1024 ** 3), 2),
            "percent": memory.percent,
        },
        "swap": {
            "total_gb": round(swap.total / (1024 ** 3), 2),
            "used_gb": round(swap.used / (1024 ** 3), 2),
            "percent": swap.percent,
        },
        "disk": {
            "total_gb": round(disk.total / (1024 ** 3), 2),
            "used_gb": round(disk.used / (1024 ** 3), 2),
            "free_gb": round(disk.free / (1024 ** 3), 2),
            "percent": disk.percent,
        },
        "network": {
            "bytes_sent": net_io.bytes_sent,
            "bytes_recv": net_io.bytes_recv,
            "packets_sent": net_io.packets_sent,
            "packets_recv": net_io.packets_recv,
        },
        "uptime_hours": round(uptime_seconds / 3600, 2),
        "boot_time": boot_time.isoformat(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/services")
async def all_service_statuses(
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    وضعیت تمام سرویس‌های سیستم.

    وضعیت هر سرویس شامل آنلاین/آفلاین بودن، زمان آخرین heartbeat،
    مصرف حافظه و تعداد خطاهای اخیر.
    """
    services = []

    for service_name in SERVICE_NAMES:
        heartbeat_raw = await redis.get(f"service:heartbeat:{service_name}")
        status_raw = await redis.get(f"service:status:{service_name}")
        memory_raw = await redis.get(f"service:memory:{service_name}")
        errors_raw = await redis.get(f"service:errors:{service_name}")
        pid_raw = await redis.get(f"service:pid:{service_name}")

        last_heartbeat = None
        is_healthy = False

        if heartbeat_raw:
            heartbeat_str = heartbeat_raw.decode() if isinstance(heartbeat_raw, bytes) else heartbeat_raw
            try:
                last_heartbeat = datetime.fromisoformat(heartbeat_str)
                age_seconds = (datetime.now(timezone.utc) - last_heartbeat).total_seconds()
                is_healthy = age_seconds < 120
            except (ValueError, TypeError):
                logger.debug("heartbeat_parse_failed", service=service_name)

        status_str = "unknown"
        if status_raw:
            status_str = status_raw.decode() if isinstance(status_raw, bytes) else str(status_raw)

        memory_mb = None
        if memory_raw:
            try:
                memory_mb = float(memory_raw.decode() if isinstance(memory_raw, bytes) else memory_raw)
            except (ValueError, TypeError):
                logger.debug("memory_parse_failed", service=service_name)

        error_count = 0
        if errors_raw:
            try:
                error_count = int(errors_raw.decode() if isinstance(errors_raw, bytes) else errors_raw)
            except (ValueError, TypeError):
                logger.debug("error_count_parse_failed", service=service_name)

        pid = None
        if pid_raw:
            try:
                pid = int(pid_raw.decode() if isinstance(pid_raw, bytes) else pid_raw)
            except (ValueError, TypeError):
                logger.debug("pid_parse_failed", service=service_name)

        services.append({
            "name": service_name,
            "status": status_str,
            "healthy": is_healthy,
            "last_heartbeat": last_heartbeat.isoformat() if last_heartbeat else None,
            "memory_mb": round(memory_mb, 2) if memory_mb else None,
            "error_count": error_count,
            "pid": pid,
        })

    healthy_count = sum(1 for s in services if s["healthy"])

    return {
        "services": services,
        "total": len(services),
        "healthy": healthy_count,
        "unhealthy": len(services) - healthy_count,
    }


@router.get("/logs")
async def recent_logs(
    service: Optional[str] = Query(None, description="فیلتر بر اساس سرویس"),
    level: Optional[str] = Query(None, description="فیلتر بر اساس سطح لاگ (INFO/WARNING/ERROR)"),
    limit: int = Query(100, ge=1, le=500, description="تعداد لاگ‌ها"),
    admin: Admin = Depends(get_current_admin),
    redis=Depends(get_redis),
):
    """
    دریافت لاگ‌های اخیر.

    لاگ‌ها از ردیس خوانده می‌شوند. قابلیت فیلتر بر اساس نام سرویس
    و سطح لاگ وجود دارد.
    """
    if service and service not in SERVICE_NAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"سرویس نامعتبر. سرویس‌های مجاز: {', '.join(SERVICE_NAMES)}",
        )

    log_key = f"logs:{service}" if service else "logs:all"

    try:
        raw_logs = await redis.lrange(log_key, 0, limit - 1)
    except Exception as exc:
        logger.error("خطا در خواندن لاگ‌ها از ردیس: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="خطا در خواندن لاگ‌ها.",
        )

    import json

    logs = []
    for raw_entry in raw_logs:
        try:
            entry_str = raw_entry.decode() if isinstance(raw_entry, bytes) else raw_entry
            entry = json.loads(entry_str)

            if level and entry.get("level", "").upper() != level.upper():
                continue

            logs.append(entry)
        except (json.JSONDecodeError, AttributeError):
            logs.append({"raw": str(raw_entry), "level": "UNKNOWN"})

    return {
        "logs": logs,
        "count": len(logs),
        "service": service,
        "level": level,
    }
