"""خوداصلاح‌گرِ خودکار (Self-Healing Watchdog).

هر چند ثانیه وضعیتِ سیستم را می‌سنجد و در صورتِ مشکل، **خودکار اقدامِ اصلاحی** می‌کند
(به‌جای فقط هشدار). با محدودیت/کول‌داون تا در حلقهٔ ری‌استارت نیفتد. اقدامات و دلایل لاگ
می‌شوند و در Loki قابل‌مشاهده‌اند.

بررسی‌ها:
  ۱) تازگیِ کندل (DB): اگر تازه‌ترین کندلِ M15 خیلی کهنه شد → ری‌استارتِ data-feed.
  ۲) سلامتِ کانتینرها: هر سرویسِ پایش‌شده که unhealthy شد → ری‌استارت.
  ۳) مدل‌های ML: اگر هیچ مدلی در ml_models نبود → ری‌استارتِ signal-engine و ml-inference.

اقدامِ اصلاحی از طریقِ Docker socket (docker restart) انجام می‌شود.
"""

from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timezone

import httpx

from src.core.logger import get_logger, setup_logging

logger = get_logger("watchdog")

# ── پیکربندی ──
CHECK_INTERVAL = int(os.getenv("WATCHDOG_INTERVAL_SECONDS", "60"))
CANDLE_STALE_MINUTES = int(os.getenv("WATCHDOG_CANDLE_STALE_MIN", "20"))
COOLDOWN_SECONDS = int(os.getenv("WATCHDOG_COOLDOWN_SECONDS", "600"))   # حداقل فاصلهٔ ری‌استارتِ یک سرویس
MAX_ACTIONS_PER_HOUR = int(os.getenv("WATCHDOG_MAX_ACTIONS_HOUR", "6")) # سقفِ کلِ اقدامات/ساعت (ضدِّ لوپ)
PROJECT = os.getenv("COMPOSE_PROJECT", "coinepro-fx")
DOCKER_SOCK = "http://localhost/v1.41"  # از طریقِ unix socket (transport جدا)

# آخرین زمانِ اقدام برای هر سرویس + تاریخچهٔ اقدامات (ضدِّ لوپ)
_last_action: dict[str, float] = {}
_action_times: list[float] = []


def _docker_client() -> httpx.AsyncClient:
    transport = httpx.AsyncHTTPTransport(uds="/var/run/docker.sock")
    return httpx.AsyncClient(transport=transport, base_url=DOCKER_SOCK, timeout=30)


def _container_name(service: str) -> str:
    # نامِ کانتینرِ compose: <project>-<service>-1 (bot-worker-1 → ...-bot-worker-1-1)
    return f"{PROJECT}-{service}-1"


def _can_act(service: str) -> bool:
    now = time.monotonic()
    # کول‌داونِ همان سرویس
    if now - _last_action.get(service, 0) < COOLDOWN_SECONDS:
        return False
    # سقفِ کلِ اقدامات در ساعتِ گذشته
    cutoff = now - 3600
    recent = [t for t in _action_times if t > cutoff]
    if len(recent) >= MAX_ACTIONS_PER_HOUR:
        logger.warning("watchdog_action_capped", recent_actions=len(recent))
        return False
    return True


async def _restart(service: str, reason: str) -> bool:
    """ری‌استارتِ امنِ یک سرویس از طریقِ Docker socket؛ با محدودیت."""
    if not _can_act(service):
        logger.info("watchdog_skip_cooldown", service=service, reason=reason)
        return False
    name = _container_name(service)
    try:
        async with _docker_client() as cli:
            resp = await cli.post(f"/containers/{name}/restart", params={"t": 10})
        ok = resp.status_code in (204, 304)
        now = time.monotonic()
        _last_action[service] = now
        _action_times.append(now)
        logger.warning(
            "watchdog_self_heal", action="restart", service=service,
            reason=reason, status=resp.status_code, ok=ok,
        )
        return ok
    except Exception as exc:  # noqa: BLE001
        logger.error("watchdog_restart_failed", service=service, error=str(exc))
        return False


async def _check_candle_freshness() -> None:
    """اگر تازه‌ترین کندلِ M15 کهنه شد، data-feed را ری‌استارت کن."""
    try:
        from sqlalchemy import text
        from src.core.database import async_session_factory
        async with async_session_factory() as s:
            latest = (
                await s.execute(text("SELECT max(time) FROM candles WHERE timeframe='M15'"))
            ).scalar()
    except Exception as exc:  # noqa: BLE001
        logger.error("watchdog_candle_check_failed", error=str(exc))
        return
    if latest is None:
        return
    age_min = (datetime.now(timezone.utc) - latest).total_seconds() / 60
    if age_min > CANDLE_STALE_MINUTES:
        logger.warning("watchdog_candle_stale", age_minutes=round(age_min, 1))
        await _restart("data-feed", reason=f"candle_stale_{round(age_min)}min")


async def _check_container_health() -> None:
    """هر سرویسِ پایش‌شده که unhealthy باشد را ری‌استارت کن."""
    watched = ["signal-engine", "signal-tracker", "data-feed", "bot-worker-1",
               "ml-inference", "claude-llm", "celery-worker", "api"]
    try:
        async with _docker_client() as cli:
            for service in watched:
                name = _container_name(service)
                try:
                    r = await cli.get(f"/containers/{name}/json")
                    if r.status_code != 200:
                        continue
                    state = r.json().get("State", {})
                    health = (state.get("Health") or {}).get("Status")
                    status = state.get("Status")
                    if status == "exited" or health == "unhealthy":
                        await _restart(service, reason=f"status={status}/health={health}")
                except Exception:  # noqa: BLE001 — یک سرویس، کلِ حلقه را قطع نکند
                    continue
    except Exception as exc:  # noqa: BLE001
        logger.error("watchdog_health_check_failed", error=str(exc))


async def _check_ml_models() -> None:
    """اگر هیچ مدلی در ml_models نباشد، سرویس‌های ML را ری‌استارت کن (لودِ مجدد)."""
    model_dir = os.getenv("ML_MODELS_DIR", "/app/ml_models")
    try:
        present = os.path.isdir(model_dir) and any(
            f.endswith(".joblib") for f in os.listdir(model_dir)
        )
    except Exception:  # noqa: BLE001
        present = True  # در شکِ دسترسی، اقدام نکن
    if not present:
        logger.warning("watchdog_ml_models_missing", dir=model_dir)
        await _restart("ml-inference", reason="ml_models_missing")


async def main() -> None:
    setup_logging()
    logger.info("watchdog_started", interval=CHECK_INTERVAL, stale_min=CANDLE_STALE_MINUTES)
    # کمی صبر تا بقیهٔ سرویس‌ها بالا بیایند
    await asyncio.sleep(30)
    while True:
        try:
            await _check_candle_freshness()
            await _check_container_health()
            await _check_ml_models()
        except Exception as exc:  # noqa: BLE001 — watchdog هرگز نباید بمیرد
            logger.error("watchdog_loop_error", error=str(exc))
        await asyncio.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    from src.core.fast_loop import install_uvloop
    install_uvloop()
    asyncio.run(main())
