"""
Health checks جدی — liveness + readiness با dependency checks.

منطق:
    قبلاً health check های services فقط `python -c "import os; exit(0)"`
    بودند که هرگز fail نمی‌شدند → orchestrator نمی‌فهمید service stuck است.

    Kubernetes/Docker convention:
        - liveness: آیا process زنده است؟ (اگر fail → restart)
        - readiness: آیا آماده‌ی پذیرفتن traffic است؟ (اگر fail → از LB حذف)

    این ماژول هر دو را به‌صورت standardized ارائه می‌دهد.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Awaitable, Callable, Optional


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


@dataclass
class CheckResult:
    """نتیجه‌ی یک health check."""

    name: str
    status: HealthStatus
    latency_ms: float = 0.0
    detail: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "status": self.status.value,
            "latency_ms": round(self.latency_ms, 2),
            "detail": self.detail,
        }


@dataclass
class HealthReport:
    """گزارش کلی همه‌ی check ها."""

    overall: HealthStatus
    checks: list[CheckResult] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        return {
            "status": self.overall.value,
            "timestamp": self.timestamp.isoformat(),
            "checks": [c.to_dict() for c in self.checks],
        }

    @property
    def http_status_code(self) -> int:
        """200 برای healthy/degraded، 503 برای unhealthy."""
        return 503 if self.overall == HealthStatus.UNHEALTHY else 200


# تابع check: async که CheckResult برمی‌گرداند
HealthCheckFn = Callable[[], Awaitable[CheckResult]]


class HealthChecker:
    """
    مدیر check ها — یک facade برای register و run.

    استفاده در FastAPI:
        checker = HealthChecker()
        checker.register("db", check_db, critical=True)
        checker.register("redis", check_redis, critical=True)
        checker.register("disk_space", check_disk, critical=False)

        @app.get("/health/ready")
        async def readiness():
            report = await checker.run_all()
            return JSONResponse(
                content=report.to_dict(),
                status_code=report.http_status_code,
            )
    """

    def __init__(self) -> None:
        self._checks: list[tuple[str, HealthCheckFn, bool]] = []
        # cache: name → (CheckResult, expiry_timestamp)
        self._cache: dict[str, tuple[CheckResult, float]] = {}
        self._cache_ttl: float = 5.0  # 5 ثانیه

    def register(
        self,
        name: str,
        check_fn: HealthCheckFn,
        critical: bool = True,
    ) -> None:
        """ثبت یک check.

        critical: اگر fail شد، کل health = UNHEALTHY. اگر non-critical،
        DEGRADED.
        """
        self._checks.append((name, check_fn, critical))

    async def run_all(self, use_cache: bool = True) -> HealthReport:
        """اجرای تمام check ها (موازی) و تجمیع."""
        now = time.monotonic()
        tasks = []
        names_critical = []

        for name, fn, critical in self._checks:
            # cache check
            if use_cache and name in self._cache:
                cached, expiry = self._cache[name]
                if now < expiry:
                    tasks.append(_immediate(cached))
                    names_critical.append((name, critical))
                    continue
            tasks.append(self._run_one(name, fn))
            names_critical.append((name, critical))

        results = await asyncio.gather(*tasks, return_exceptions=False)

        # update cache
        for result in results:
            self._cache[result.name] = (result, now + self._cache_ttl)

        overall = self._compute_overall(results, names_critical)
        return HealthReport(overall=overall, checks=list(results))

    async def run_liveness(self) -> HealthReport:
        """
        Liveness — فقط بررسی می‌کند process زنده است.

        یک check ساده (process up) — هرگز در `__call__` کار نمی‌کند مگر
        کل python interpreter dead باشد.
        """
        return HealthReport(
            overall=HealthStatus.HEALTHY,
            checks=[CheckResult(name="process", status=HealthStatus.HEALTHY)],
        )

    async def _run_one(self, name: str, fn: HealthCheckFn) -> CheckResult:
        """اجرای یک check با timeout و error handling."""
        start = time.monotonic()
        try:
            # 3 ثانیه timeout
            result = await asyncio.wait_for(fn(), timeout=3.0)
            if result.latency_ms == 0.0:
                result.latency_ms = (time.monotonic() - start) * 1000
            return result
        except asyncio.TimeoutError:
            return CheckResult(
                name=name,
                status=HealthStatus.UNHEALTHY,
                latency_ms=(time.monotonic() - start) * 1000,
                detail="timeout > 3s",
            )
        except Exception as exc:
            return CheckResult(
                name=name,
                status=HealthStatus.UNHEALTHY,
                latency_ms=(time.monotonic() - start) * 1000,
                detail=f"{type(exc).__name__}: {exc}",
            )

    @staticmethod
    def _compute_overall(
        results: list[CheckResult],
        names_critical: list[tuple[str, bool]],
    ) -> HealthStatus:
        """تعیین status کلی."""
        critical_map = {n: c for n, c in names_critical}
        for r in results:
            if r.status == HealthStatus.UNHEALTHY:
                if critical_map.get(r.name, True):
                    return HealthStatus.UNHEALTHY
        # هیچ critical unhealthy نیست
        for r in results:
            if r.status != HealthStatus.HEALTHY:
                return HealthStatus.DEGRADED
        return HealthStatus.HEALTHY


async def _immediate(result: CheckResult) -> CheckResult:
    return result


# ===========================================================================
# Built-in check factories
# ===========================================================================


async def db_check() -> CheckResult:
    """check اتصال DB با SELECT 1."""
    start = time.monotonic()
    try:
        from sqlalchemy import text
        from src.core.database import async_session_factory
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        latency = (time.monotonic() - start) * 1000
        status = HealthStatus.HEALTHY if latency < 100 else HealthStatus.DEGRADED
        return CheckResult(
            name="database",
            status=status,
            latency_ms=latency,
            detail=f"select 1 in {latency:.1f}ms",
        )
    except Exception as exc:
        return CheckResult(
            name="database",
            status=HealthStatus.UNHEALTHY,
            latency_ms=(time.monotonic() - start) * 1000,
            detail=str(exc)[:200],
        )


async def redis_check() -> CheckResult:
    """check اتصال Redis با PING."""
    start = time.monotonic()
    try:
        from src.core.redis_client import redis_client
        await redis_client.client.ping()
        latency = (time.monotonic() - start) * 1000
        status = HealthStatus.HEALTHY if latency < 50 else HealthStatus.DEGRADED
        return CheckResult(
            name="redis",
            status=status,
            latency_ms=latency,
            detail=f"ping in {latency:.1f}ms",
        )
    except Exception as exc:
        return CheckResult(
            name="redis",
            status=HealthStatus.UNHEALTHY,
            latency_ms=(time.monotonic() - start) * 1000,
            detail=str(exc)[:200],
        )


async def disk_space_check(min_free_gb: float = 1.0) -> CheckResult:
    """check فضای آزاد disk — non-critical."""
    start = time.monotonic()
    try:
        import shutil
        usage = shutil.disk_usage("/")
        free_gb = usage.free / (1024 ** 3)
        latency = (time.monotonic() - start) * 1000
        if free_gb < min_free_gb:
            return CheckResult(
                name="disk_space",
                status=HealthStatus.UNHEALTHY,
                latency_ms=latency,
                detail=f"only {free_gb:.2f} GB free (min {min_free_gb})",
            )
        return CheckResult(
            name="disk_space",
            status=HealthStatus.HEALTHY,
            latency_ms=latency,
            detail=f"{free_gb:.2f} GB free",
        )
    except Exception as exc:
        return CheckResult(
            name="disk_space",
            status=HealthStatus.DEGRADED,
            latency_ms=(time.monotonic() - start) * 1000,
            detail=str(exc)[:200],
        )


async def data_feed_check() -> CheckResult:
    """
    check اینکه data feed آخرین به‌روزرسانی را اخیر داشته.

    اگر آخرین قیمت بیش از ۳۰۰ ثانیه قدیمی باشد، فید stale است.
    """
    start = time.monotonic()
    try:
        from src.core.redis_client import redis_client
        all_prices = await redis_client.get_all_prices()
        if not all_prices:
            return CheckResult(
                name="data_feed",
                status=HealthStatus.UNHEALTHY,
                latency_ms=(time.monotonic() - start) * 1000,
                detail="no prices in redis",
            )
        # بررسی stale-ترین قیمت
        now_ts = time.time()
        max_age = 0.0
        for sym, data in all_prices.items():
            ts_raw = data.get("timestamp")
            if not ts_raw:
                continue
            try:
                if isinstance(ts_raw, (int, float)):
                    ts = float(ts_raw)
                else:
                    from datetime import datetime
                    ts = datetime.fromisoformat(str(ts_raw)).timestamp()
                age = now_ts - ts
                if age > max_age:
                    max_age = age
            except Exception:
                continue

        latency = (time.monotonic() - start) * 1000
        if max_age > 300:
            return CheckResult(
                name="data_feed",
                status=HealthStatus.UNHEALTHY,
                latency_ms=latency,
                detail=f"stale: oldest price {max_age:.0f}s old",
            )
        status = HealthStatus.HEALTHY if max_age < 60 else HealthStatus.DEGRADED
        return CheckResult(
            name="data_feed",
            status=status,
            latency_ms=latency,
            detail=f"{len(all_prices)} symbols, oldest {max_age:.0f}s",
        )
    except Exception as exc:
        return CheckResult(
            name="data_feed",
            status=HealthStatus.UNHEALTHY,
            latency_ms=(time.monotonic() - start) * 1000,
            detail=str(exc)[:200],
        )
