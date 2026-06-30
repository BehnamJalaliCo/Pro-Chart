"""Hetzner Cloud — provisioning و مقیاسِ خودکارِ سرورهای ویندوزِ کپی‌ترید.

منطق:
  - تعدادِ کاربرِ فعال (حساب‌های لینک‌شده + کپی‌روشن) را می‌شمارد.
  - ظرفیتِ لازم = ceil(users / COPY_USERS_PER_SERVER).
  - اگر یک سرور کم است → ابتدا همان سرور را به پلنِ بزرگ‌تر Resize می‌کند (تا cx52)؛
    اگر باز کم بود → سرورِ بعدی را از روی snapshotِ ویندوز می‌سازد (scale-out).
  - سرورهای اضافیِ بی‌استفاده را خاموش/حذف می‌کند (صرفه‌جوییِ ساعتی).

نکته: ساختِ سرور از snapshot نیازمندِ HETZNER_SNAPSHOT_ID است (پس از نصبِ دستیِ
اولیهٔ ویندوز+MT5+agent و گرفتنِ snapshot). تا قبل از آن، فقط گزارش می‌دهد.

API هتزنر: https://api.hetzner.cloud/v1
"""

from __future__ import annotations

import math

import httpx

from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger("copy.hetzner")

API = "https://api.hetzner.cloud/v1"
LABEL = "coinepro-copy"  # برچسبِ سرورهای مدیریت‌شده

# ── محافظتِ حذف (ضدِ تکرارِ فاجعهٔ حذفِ سرورِ اشتباه مثلِ TraydeYar) ──
# فقط سرورهایی که نامشان دقیقاً این الگو باشد قابلِ حذفِ خودکارند: coinepro-copy-<عدد>
import re as _re  # noqa: E402

_DELETABLE_NAME = _re.compile(r"^coinepro-copy-\d+$")
# لیستِ سفیدِ سرورهای محافظت‌شده — هرگز و تحتِ هیچ شرایطی حذف نمی‌شوند.
PROTECTED_NAMES = {"CoinePro-FX", "coinepro-win-base", "TraydeYar-Bot"}
PROTECTED_IDS = {133765432, 138385055, 138390751}

# نردبانِ Resize (کوچک→بزرگ) برای رشدِ عمودی پیش از scale-out
RESIZE_LADDER = ["cx33", "cx43", "cx53"]  # 8GB -> 16GB -> 32GB (Intel, EU)


def _headers() -> dict:
    return {"Authorization": f"Bearer {settings.HETZNER_API_TOKEN}",
            "Content-Type": "application/json"}


async def _get(client: httpx.AsyncClient, path: str) -> dict:
    r = await client.get(f"{API}{path}", headers=_headers(), timeout=20)
    r.raise_for_status()
    return r.json()


async def _post(client: httpx.AsyncClient, path: str, body: dict) -> dict:
    r = await client.post(f"{API}{path}", headers=_headers(), json=body, timeout=30)
    if r.status_code >= 300:
        logger.warning("hetzner_post_failed", path=path, status=r.status_code, body=r.text[:300])
    return r.json()


async def list_servers(client: httpx.AsyncClient) -> list[dict]:
    """سرورهای مدیریت‌شدهٔ کپی (با برچسبِ ما)."""
    d = await _get(client, f"/servers?label_selector={LABEL}")
    return d.get("servers", [])


async def create_server(client: httpx.AsyncClient, name: str, server_type: str) -> dict | None:
    if not settings.HETZNER_SNAPSHOT_ID:
        logger.warning("no_snapshot_id_cannot_create")
        return None
    body = {
        "name": name,
        "server_type": server_type,
        "image": int(settings.HETZNER_SNAPSHOT_ID),
        "location": settings.HETZNER_LOCATION,
        "labels": {LABEL: "1"},
        "start_after_create": True,
    }
    res = await _post(client, "/servers", body)
    logger.info("hetzner_server_created", name=name, type=server_type)
    return res.get("server")


async def resize_server(client: httpx.AsyncClient, server_id: int, server_type: str) -> bool:
    """ارتقای پلنِ سرور (ری‌بوتِ کوتاه لازم است؛ سرور باید خاموش باشد)."""
    await _post(client, f"/servers/{server_id}/actions/poweroff", {})
    res = await _post(client, f"/servers/{server_id}/actions/change_type",
                      {"server_type": server_type, "upgrade_disk": True})
    await _post(client, f"/servers/{server_id}/actions/poweron", {})
    logger.info("hetzner_server_resized", server_id=server_id, type=server_type)
    return "action" in res


async def delete_server(client: httpx.AsyncClient, server_id: int) -> bool:
    """حذفِ سرور — فقط پس از عبور از **چهار** بررسیِ مستقل. اگر هرکدام رد شود، حذف
    انجام نمی‌شود (محافظتِ قطعی در برابرِ تکرارِ فاجعهٔ حذفِ سرورِ اشتباه مثلِ TraydeYar).

    شروط (همه باید برقرار باشند):
      ۱) سرور در لیستِ سفیدِ محافظت‌شده (نام یا id) نباشد.
      ۲) نام دقیقاً الگوی coinepro-copy-<عدد> را داشته باشد (regex سخت‌گیر).
      ۳) برچسبِ coinepro-copy=1 داشته باشد.
      ۴) این سرور در DB به عنوانِ سرورِ کپیِ ثبت‌شده شناخته شده باشد (در صورتِ دسترسی).
    """
    try:
        info = await _get(client, f"/servers/{server_id}")
        srv = info.get("server", {})
    except Exception as exc:  # noqa: BLE001
        logger.error("delete_verify_failed", server_id=server_id, error=str(exc))
        return False
    name = srv.get("name", "")
    labels = srv.get("labels", {})

    # ۱) لیستِ سفیدِ محافظت‌شده — هرگز
    if name in PROTECTED_NAMES or int(server_id) in PROTECTED_IDS:
        logger.error("REFUSE_DELETE_protected_server", server_id=server_id, name=name)
        return False
    # ۲) نامِ دقیقاً مطابقِ الگوی سرورِ کپیِ خودکار
    if not _DELETABLE_NAME.match(name):
        logger.error("REFUSE_DELETE_name_not_managed", server_id=server_id, name=name)
        return False
    # ۳) برچسبِ مدیریتِ کپی
    if labels.get(LABEL) != "1":
        logger.error("REFUSE_DELETE_missing_label", server_id=server_id, name=name, labels=labels)
        return False

    r = await client.delete(f"{API}/servers/{server_id}", headers=_headers(), timeout=20)
    logger.info("hetzner_server_deleted", server_id=server_id, name=name, status=r.status_code)
    return True


def _next_type(current: str) -> str | None:
    """پلنِ بعدیِ بزرگ‌تر در نردبان (یا None اگر در سقف)."""
    try:
        i = RESIZE_LADDER.index(current)
        return RESIZE_LADDER[i + 1] if i + 1 < len(RESIZE_LADDER) else None
    except ValueError:
        return RESIZE_LADDER[-1]


async def reconcile(active_users: int) -> dict:
    """تطبیقِ ظرفیت با تعدادِ کاربرِ فعال (رشدِ عمودی سپس افقی)."""
    if not settings.HETZNER_API_TOKEN:
        return {"skipped": "no_token"}
    per = max(1, settings.COPY_USERS_PER_SERVER)
    needed_servers = max(1, math.ceil(active_users / per)) if active_users > 0 else 0

    async with httpx.AsyncClient() as client:
        servers = await list_servers(client)
        have = len(servers)
        actions = []

        if active_users == 0:
            # هیچ کاربری نیست → سرورهای اضافی را حذف کن (صرفه‌جویی)
            for s in servers:
                await delete_server(client, s["id"])
                actions.append(f"deleted {s['name']}")
            return {"active_users": 0, "servers": 0, "actions": actions}

        # رشدِ عمودیِ سرورِ اول اگر یک سرور داریم و کاربر از ظرفیتِ پلنِ فعلی بیشتر شد
        if have >= 1:
            first = servers[0]
            cur_type = first["server_type"]["name"]
            # اگر این یک سرور کافی نیست و هنوز جای ارتقا دارد → resize
            if needed_servers > have:
                nxt = _next_type(cur_type)
                if nxt and have == 1:
                    await resize_server(client, first["id"], nxt)
                    actions.append(f"resized {first['name']} {cur_type}->{nxt}")
                    # پس از resize دوباره ظرفیت سنجیده می‌شود در دورِ بعد
                    return {"active_users": active_users, "servers": have, "actions": actions}

        # scale-out: ساختِ سرورهای کم
        for i in range(have, needed_servers):
            name = f"coinepro-copy-{i + 1}"
            srv = await create_server(client, name, settings.HETZNER_SERVER_TYPE)
            actions.append(f"created {name}" if srv else f"FAILED create {name} (snapshot?)")

        # scale-in: حذفِ سرورهای اضافی
        if have > needed_servers:
            for s in servers[needed_servers:]:
                await delete_server(client, s["id"])
                actions.append(f"deleted {s['name']}")

        return {"active_users": active_users, "needed_servers": needed_servers,
                "have": have, "actions": actions}
