"""تسکِ Celeryِ هماهنگ‌سازیِ کپی‌ترید — هر دقیقه اجرا می‌شود."""

from __future__ import annotations

import asyncio
import contextvars

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from src.copy.engine import sync_once
from src.core.celery_app import celery_app
from src.core.config import settings
from src.core.logger import get_logger

logger = get_logger("copy.tasks")
_factory: contextvars.ContextVar = contextvars.ContextVar("copy_session_factory")


async def _guarded():
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    try:
        async with factory() as db:
            return await sync_once(db)
    finally:
        await engine.dispose()


@celery_app.task(name="src.copy.tasks.copy_sync")
def copy_sync() -> dict:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        res = loop.run_until_complete(_guarded())
        logger.info("copy_sync_done", **res)
        return res
    finally:
        loop.close()


async def _scale():
    """scale-out افقی: اگر کاربرِ فعالِ کپی از ظرفیتِ سرورهای موجود بیشتر شد، سرورِ ویندوزِ
    جدید از snapshot ساخته می‌شود (هر سرور COPY_USERS_PER_SERVER کاربر). سرورِ جدید با بوت
    خودش را با IP ثبت می‌کند و کاربرانِ سرریز خودکار به آن assign می‌شوند. هرگز سرورِ پایه
    را حذف نمی‌کند (گاردِ نام/برچسب در hetzner.delete_server)."""
    import math
    from datetime import datetime, timedelta, timezone

    import httpx
    from sqlalchemy import func, select, update

    from src.api.routes.ea import _assign_unassigned
    from src.copy import hetzner
    from src.core.database import CopyServer, CopySettings, TradingAccount

    if not (settings.HETZNER_API_TOKEN and settings.COPY_LIVE_ENABLED):
        return {"skipped": "disabled"}
    cap = max(1, settings.COPY_USERS_PER_SERVER)
    stale_sec = 180  # اگر سروری این‌قدر heartbeat نفرستد، افتاده فرض می‌شود
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    actions: list[str] = []
    try:
        # ── (۰) بازیابیِ خطا: سرورِ افتاده (VM/شبکه قطع) را تشخیص بده، کاربرانش را آزاد و
        #     به سرورهای سالم منتقل کن تا تریدشان قطع نماند. (crashِ خودِ agent را wrapper جبران می‌کند.)
        async with factory() as db:
            cutoff = datetime.now(timezone.utc) - timedelta(seconds=stale_sec)
            down = (await db.execute(select(CopyServer).where(
                CopyServer.status == "active",
                CopyServer.last_seen_at.isnot(None),
                CopyServer.last_seen_at < cutoff))).scalars().all()
            for s in down:
                s.status = "down"
                res = await db.execute(update(TradingAccount)
                                       .where(TradingAccount.server_id == s.id).values(server_id=None))
                actions.append(f"server {s.ip} DOWN -> freed {res.rowcount or 0} users")
            await db.commit()
            if down:
                await _assign_unassigned(db)  # کاربرانِ آزادشده را به سرورهای فعال منتقل کن

        async with factory() as db:
            demand = (await db.execute(
                select(func.count()).select_from(TradingAccount)
                .join(CopySettings, CopySettings.user_id == TradingAccount.user_id)
                .where(CopySettings.enabled.is_(True)))).scalar() or 0
        needed = math.ceil(demand / cap) if demand > 0 else 0

        async with httpx.AsyncClient() as client:
            existing = await hetzner.list_servers(client)  # سرورهای برچسب‌خوردهٔ کپی (شاملِ در حالِ بوت)
            hz_ids = {h["id"] for h in existing}
            # شمارشِ سرورهای قابلِ‌حذفِ خودکار (coinepro-copy-<عدد> — نه سرورِ پایه)
            managed = [h for h in existing if hetzner._DELETABLE_NAME.match(h.get("name", ""))]
            have = len(existing)

            # ── scale-out: ساختِ سرورهای کم ──
            for i in range(have, needed):
                name = f"coinepro-copy-{i + 1}"
                srv = await hetzner.create_server(client, name, settings.HETZNER_SERVER_TYPE)
                actions.append(f"created {name}" if srv else f"FAILED create {name} (snapshot?)")

            # ── reconcile رجیستریِ DB با واقعیتِ Hetzner + scale-in امن ──
            async with factory() as db:
                db_servers = (await db.execute(select(CopyServer))).scalars().all()
                assigned = {}
                for s in db_servers:
                    assigned[s.id] = (await db.execute(
                        select(func.count()).select_from(TradingAccount)
                        .where(TradingAccount.server_id == s.id))).scalar() or 0

                # (الف) ردیفِ یتیم: سرورِ Hetznerش دیگر وجود ندارد → کاربرانش آزاد، ردیف حذف
                for s in list(db_servers):
                    if s.hetzner_id and s.hetzner_id not in hz_ids:
                        await db.execute(update(TradingAccount)
                                         .where(TradingAccount.server_id == s.id).values(server_id=None))
                        await db.delete(s)
                        actions.append(f"removed orphan registry {s.ip}")

                # (ب) scale-in: اگر سرورِ مدیریت‌شدهٔ بیشتری از نیاز داریم، خالی‌ها را حذف کن.
                #     فقط coinepro-copy-<عدد>ِ بدونِ کاربر؛ سرورِ پایه هرگز (گاردِ delete_server).
                if len(managed) > max(0, needed - 1):  # needed-1 چون سرورِ پایه جزوِ ظرفیت است
                    db_by_hid = {s.hetzner_id: s for s in db_servers if s.hetzner_id}
                    surplus = len(managed) - max(0, needed - 1)
                    for h in managed:
                        if surplus <= 0:
                            break
                        s = db_by_hid.get(h["id"])
                        if s is None:
                            continue  # سرورِ ثبت‌نشده (احتمالاً در حالِ بوت) — هرگز حذف نکن
                        if assigned.get(s.id, 0) > 0:
                            continue  # سرورِ دارای کاربر را حذف نکن (drain لازم دارد)
                        okd = await hetzner.delete_server(client, h["id"])  # گاردِ ۴شرطی
                        if okd:
                            if s:
                                await db.delete(s)
                            actions.append(f"scaled-in {h.get('name')}")
                            surplus -= 1
                await db.commit()

        return {"demand": demand, "needed_servers": needed, "have_servers": have,
                "managed_servers": len(managed), "capacity_per": cap, "actions": actions}
    finally:
        await engine.dispose()


@celery_app.task(name="src.copy.tasks.scale_servers")
def scale_servers() -> dict:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        res = loop.run_until_complete(_scale())
        logger.info("scale_servers_done", **(res if isinstance(res, dict) else {}))
        return res
    finally:
        loop.close()
