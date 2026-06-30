"""موتورِ کپی‌ترید — هستهٔ هماهنگ‌سازی.

طراحی:
  - مَستر = همان حسابِ سرورِ ما (اتو-تریدِ ادمین). وضعیتِ بازِ آن از Redis `ea:status`
    خوانده می‌شود (همان فیدی که EA می‌نویسد).
  - برای هر کاربرِ دارایِ حسابِ متصل + CopySettings.enabled، معاملاتِ بازِ مَستر روی
    حسابِ او «آینه» می‌شود: حجم بر اساسِ مدلِ ریسکِ کاربر تعیین می‌شود.
  - اجرای واقعیِ سفارش از طریقِ یک Executorِ قابل‌جایگزین انجام می‌شود:
      * PaperExecutor (پیش‌فرض، امن): هیچ سفارشِ واقعی نمی‌زند؛ وضعیت/پوزیشن‌های
        آینه‌ای را برای نمایش در پنل شبیه‌سازی می‌کند. برای آزمونِ کاملِ جریان بدون ریسک.
      * LiveMT5Executor (آینده): به حسابِ MT5 کاربر وصل می‌شود و واقعاً سفارش می‌زند.
        نیازمندِ زیرساختِ اتصالِ MT5 per-account (یا سرویسِ کپیِ بروکر) است.

ایمنیِ نقدینگی (باگِ close-all):
  چون کاربر آینهٔ مَستر است، وقتی مَستر «بستنِ همه» می‌شود و EA دیگر بازشان نمی‌کند
  (رفع‌شده در EA)، کاربر هم پوزیشنی نمی‌بیند. علاوه بر این، کلیدِ enabled هر کاربر
  گِیتِ بازکردن است: اگر کاربر کپی را خاموش کند، هیچ سفارشِ جدیدی باز نمی‌شود.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import CopySettings, TradingAccount
from src.core.logger import get_logger
from src.core.redis_client import redis_client

logger = get_logger("copy.engine")


@dataclass
class MasterPosition:
    symbol: str
    direction: str   # BUY/SELL
    lots: float
    profit: float


async def read_master_positions() -> list[MasterPosition]:
    """پوزیشن‌های بازِ مَستر از وضعیتِ EA (Redis `ea:status`)."""
    out: list[MasterPosition] = []
    try:
        from src.api.routes.ea import get_ea_status
        raw = await get_ea_status()
        praw = raw.get("positions", "")
        if praw:
            for chunk in praw.split("|"):
                p = chunk.split(";")
                if len(p) >= 4:
                    out.append(MasterPosition(p[0], p[1], float(p[2] or 0), float(p[3] or 0)))
    except Exception as exc:  # noqa: BLE001
        logger.warning("read_master_failed", error=str(exc))
    return out


def size_for_user(master: MasterPosition, cs: CopySettings, equity: float | None) -> float:
    """حجمِ پوزیشنِ کاربر بر اساسِ مدلِ ریسک. سقفِ max_lot رعایت می‌شود."""
    mode = cs.risk_mode
    val = float(cs.risk_value)
    if mode == "fixed_lot":
        lot = val
    elif mode == "proportional":
        lot = master.lots * val            # ضریبِ تناسب
    elif mode == "risk_percent":
        # تقریبِ ساده: درصدِ ریسک × ضریب پایه. اجرای دقیق در LiveMT5Executor با
        # فاصلهٔ SL محاسبه می‌شود؛ اینجا یک تخمینِ محافظه‌کارانه.
        base = max((equity or 1000.0) / 10000.0, 0.01)
        lot = base * val
    else:
        lot = master.lots
    return round(max(min(lot, float(cs.max_lot)), 0.0), 2)


class Executor(Protocol):
    async def sync_account(self, acc: TradingAccount, cs: CopySettings,
                           masters: list[MasterPosition], db: AsyncSession) -> dict: ...


class PaperExecutor:
    """اجراکنندهٔ امن: سفارشِ واقعی نمی‌زند. وضعیتِ حساب را «متصل (آزمایشی)» علامت
    می‌زند و پوزیشن‌های آینه‌ای را در Redis برای نمایشِ پنل می‌نویسد."""

    async def sync_account(self, acc, cs, masters, db) -> dict:
        now = datetime.now(timezone.utc)
        # در حالتِ کاغذی، حساب را «متصل» در نظر می‌گیریم تا جریانِ پنل کامل دیده شود.
        acc.status = "connected"
        acc.last_seen = now
        if acc.connected_at is None:
            acc.connected_at = now
        if acc.balance is None:
            acc.balance = 10000  # موجودیِ نمایشیِ اولیه تا اتصالِ واقعی
            acc.equity = 10000
            acc.currency = "USD"
        await db.commit()

        mirrored = []
        if cs.enabled:
            for m in masters:
                lot = size_for_user(m, cs, float(acc.equity) if acc.equity else None)
                if lot <= 0:
                    continue
                mirrored.append({"symbol": m.symbol, "direction": m.direction, "lots": lot})
        try:
            await redis_client.client.set(
                f"copy:user:{acc.user_id}:positions",
                json.dumps({"ts": now.isoformat(), "positions": mirrored, "mode": "paper"}),
                ex=120,
            )
        except Exception:  # noqa: BLE001
            pass
        return {"mirrored": len(mirrored), "mode": "paper"}


def get_executor() -> Executor:
    """انتخابِ اجراکننده. تا وقتی زیرساختِ اتصالِ زندهٔ MT5 آماده نشده، Paper امن است."""
    # برای فعال‌سازیِ Live، اینجا LiveMT5Executor برگردانده می‌شود (پس از پیاده‌سازیِ
    # لایهٔ اتصالِ per-account). فعلاً پیش‌فرضِ امن:
    return PaperExecutor()


async def sync_once(db: AsyncSession) -> dict:
    """یک دورِ هماهنگ‌سازی برای همهٔ حساب‌های متصل."""
    masters = await read_master_positions()
    ex = get_executor()
    accounts = (await db.execute(
        select(TradingAccount).where(TradingAccount.status.in_(("pending", "connected", "error")))
    )).scalars().all()
    total = 0
    for acc in accounts:
        cs = (await db.execute(select(CopySettings).where(CopySettings.user_id == acc.user_id))).scalar_one_or_none()
        if cs is None:
            cs = CopySettings(user_id=acc.user_id)
            db.add(cs)
            await db.commit()
            await db.refresh(cs)
        try:
            r = await ex.sync_account(acc, cs, masters, db)
            total += r.get("mirrored", 0)
        except Exception as exc:  # noqa: BLE001
            acc.status = "error"
            acc.last_error = str(exc)[:300]
            await db.commit()
            logger.warning("sync_account_failed", account_id=acc.id, error=str(exc))
    return {"accounts": len(accounts), "mirrored_total": total, "master_open": len(masters)}
