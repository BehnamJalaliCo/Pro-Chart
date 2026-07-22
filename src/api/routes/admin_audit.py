"""Audit log و kill-switchِ ادمین (فاز۸) — append-only در Redis (بدونِ migration).

audit: لیستِ `bn:admin:audit` (LPUSH + LTRIM سقف)، هیچ endpointِ ویرایش/حذف. هر رکورد
هم‌زمان روی کانالِ pub/sub `admin:audit` منتشر می‌شود تا WSِ `/admin/stream` tail کند.
kill-switch: `bn:ks:{key}` JSON. برای سازگاری، کلیدِ `trading` با فلگِ قدیمیِ `bn:killswitch`
هم‌گام می‌شود (halt = enabled:false).
"""

from __future__ import annotations

import json
import time
from typing import Any, Optional

from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger(__name__)

_AUDIT_KEY = "bn:admin:audit"
_AUDIT_CHAN = "admin:audit"
_AUDIT_MAX = 10000

KILL_SWITCHES = {
    "trading": "Trade execution",
    "copy": "Copy trading",
    "signals": "Signals",
    "kyc": "KYC review",
    "payments": "Payments",
    "notifications": "Notifications",
}


def _now_ms() -> int:
    return int(time.time() * 1000)


async def record(*, actor_id, actor_name, actor_role, action, target_type=None,
                 target_id=None, target_label=None, reason=None, metadata=None,
                 result: str = "accepted") -> dict:
    """یک رکوردِ audit بساز، append کن و منتشر کن. رکورد را برمی‌گرداند."""
    entry = {
        "id": f"a_{_now_ms()}_{str(actor_id)[-4:]}",
        "actor_id": str(actor_id), "actor_name": actor_name, "actor_role": actor_role,
        "action": action, "target_type": target_type, "target_id": str(target_id) if target_id is not None else None,
        "target_label": target_label, "reason": reason, "metadata": metadata or {},
        "ip": None, "created_at": _now_ms(), "result": result,
    }
    try:
        raw = json.dumps(entry, ensure_ascii=False)
        await redis_client.client.lpush(_AUDIT_KEY, raw)
        await redis_client.client.ltrim(_AUDIT_KEY, 0, _AUDIT_MAX - 1)
        await redis_client.client.publish(_AUDIT_CHAN, raw)
    except Exception as e:  # noqa: BLE001
        logger.error("admin_audit_write_failed", error=str(e))
    return entry


async def read(*, actor: Optional[str] = None, action: Optional[str] = None,
               target_type: Optional[str] = None, cursor: Optional[str] = None,
               limit: int = 50) -> dict:
    """خواندنِ audit با فیلتر + cursor سادهٔ offset. append-only؛ بدونِ ویرایش."""
    limit = max(1, min(int(limit), 200))
    start = int(cursor) if (cursor and str(cursor).isdigit()) else 0
    # برای فیلتر، پنجرهٔ بزرگ‌تری می‌خوانیم و در حافظه فیلتر می‌کنیم
    window = start + limit * 10 if (actor or action or target_type) else start + limit
    try:
        raw = await redis_client.client.lrange(_AUDIT_KEY, start, window - 1)
    except Exception as e:  # noqa: BLE001
        logger.error("admin_audit_read_failed", error=str(e))
        return {"items": [], "next_cursor": None}
    items = []
    consumed = start
    for r in raw:
        consumed += 1
        try:
            e = json.loads(r.decode() if isinstance(r, bytes) else r)
        except Exception:  # noqa: BLE001
            continue
        if actor and e.get("actor_id") != actor and e.get("actor_name") != actor:
            continue
        if action and e.get("action") != action:
            continue
        if target_type and e.get("target_type") != target_type:
            continue
        items.append(e)
        if len(items) >= limit:
            break
    next_cursor = str(consumed) if len(items) >= limit else None
    return {"items": items, "next_cursor": next_cursor}


_TICKET_KEY = "bn:admin:ticket"


async def ticket_event(data: dict) -> dict:
    """رویدادِ live تیکت برای WSِ /admin/stream (topic=ticket). tail از Redis list."""
    entry = {"id": f"te_{_now_ms()}", **data}
    try:
        raw = json.dumps(entry, ensure_ascii=False)
        await redis_client.client.lpush(_TICKET_KEY, raw)
        await redis_client.client.ltrim(_TICKET_KEY, 0, 999)
        await redis_client.client.publish("admin:ticket", raw)
    except Exception as e:  # noqa: BLE001
        logger.error("admin_ticket_event_failed", error=str(e))
    return entry


async def read_ticket_events(limit: int = 5) -> list[dict]:
    try:
        raw = await redis_client.client.lrange(_TICKET_KEY, 0, max(1, limit) - 1)
    except Exception:  # noqa: BLE001
        return []
    out = []
    for r in raw:
        try:
            out.append(json.loads(r.decode() if isinstance(r, bytes) else r))
        except Exception:  # noqa: BLE001
            continue
    return out


async def ks_get(key: str) -> dict:
    default = {"key": key, "label": KILL_SWITCHES.get(key, key), "enabled": True,
              "scope": "global", "updated_at": None, "updated_by": None}
    try:
        v = await redis_client.get_json(f"bn:ks:{key}")
    except Exception:  # noqa: BLE001
        v = None
    if isinstance(v, dict):
        default.update({k: v.get(k, default[k]) for k in default})
        default["key"] = key
        default["label"] = KILL_SWITCHES.get(key, key)
    return default


async def ks_all() -> list[dict]:
    return [await ks_get(k) for k in KILL_SWITCHES]


async def ks_set(key: str, enabled: bool, by: str) -> dict:
    sw = {"key": key, "label": KILL_SWITCHES.get(key, key), "enabled": bool(enabled),
          "scope": "global", "updated_at": _now_ms(), "updated_by": by}
    try:
        await redis_client.set_json(f"bn:ks:{key}", sw)
        # سازگاری با فلگِ قدیمیِ اجرای ترید: halt = enabled:false
        if key == "trading":
            if enabled:
                await redis_client.client.delete("bn:killswitch")
            else:
                await redis_client.client.set("bn:killswitch", "1")
        await redis_client.client.publish("admin:kill_switch", json.dumps(sw, ensure_ascii=False))
    except Exception as e:  # noqa: BLE001
        logger.error("admin_ks_set_failed", key=key, error=str(e))
    return sw
