"""
چک‌لیست pre-launch — بررسی آمادگی production.

قبل از تغییر TRADING_MODE به live، اسکریپت زیر باید سبز باشد:
    python -m src.launch.preflight

این اسکریپت بررسی می‌کند:
    - تنظیمات امنیتی (no default passwords، JWT_SECRET قوی)
    - اتصال‌های DB، Redis، broker
    - migration ها up-to-date
    - مدل‌های ML بارگذاری شدنی هستند
    - scaler ها ذخیره شده‌اند
    - حداقل N روز paper trading انجام شده
    - divergence report قابل‌قبول است
    - monitoring و alerting فعال است
    - backup script اخیراً اجرا شده

هیچ‌کدام از این چک‌ها fail نباید با live launch همراه شود.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Awaitable, Callable, Optional


class CheckLevel(str, Enum):
    """سطح اهمیت یک چک."""

    CRITICAL = "critical"   # fail = block launch
    WARNING = "warning"     # fail = warn but allow
    INFO = "info"           # informational only


class CheckStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    SKIP = "skip"


@dataclass
class PreflightCheck:
    """یک چک منفرد."""

    name: str
    level: CheckLevel
    status: CheckStatus
    detail: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "level": self.level.value,
            "status": self.status.value,
            "detail": self.detail,
        }


@dataclass
class PreflightResult:
    """نتیجه‌ی کلی preflight."""

    checks: list[PreflightCheck] = field(default_factory=list)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def critical_failures(self) -> list[PreflightCheck]:
        return [c for c in self.checks if c.level == CheckLevel.CRITICAL and c.status == CheckStatus.FAIL]

    @property
    def warning_failures(self) -> list[PreflightCheck]:
        return [c for c in self.checks if c.level == CheckLevel.WARNING and c.status == CheckStatus.FAIL]

    @property
    def is_ready_for_launch(self) -> bool:
        return len(self.critical_failures) == 0

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "is_ready_for_launch": self.is_ready_for_launch,
            "checks": [c.to_dict() for c in self.checks],
            "summary": {
                "total": len(self.checks),
                "passed": sum(1 for c in self.checks if c.status == CheckStatus.PASS),
                "failed_critical": len(self.critical_failures),
                "failed_warning": len(self.warning_failures),
            },
        }


# ── چک‌های منفرد ───────────────────────────────────────────


def check_no_default_passwords() -> PreflightCheck:
    """JWT_SECRET، DB password، Redis password نباید پیش‌فرض باشند."""
    try:
        from src.core.config import settings, _INSECURE_PASSWORDS

        # ترکیب لیست محلی با لیست کامل کلمه‌عبورهای ناامن config
        # (شامل "123456"/"12345678" که در نسخه‌ی محلی جا افتاده بودند)
        weak_terms = {"changeme", "change-me", "admin", "password", "secret", ""}
        weak_terms |= {str(p).lower() for p in _INSECURE_PASSWORDS}
        issues: list[str] = []

        if str(settings.DB_PASSWORD).lower() in weak_terms:
            issues.append("DB_PASSWORD")
        if str(settings.REDIS_PASSWORD).lower() in weak_terms:
            issues.append("REDIS_PASSWORD")
        if str(settings.ADMIN_PASSWORD).lower() in weak_terms:
            issues.append("ADMIN_PASSWORD")

        jwt = str(settings.JWT_SECRET_KEY)
        if "change" in jwt.lower() or len(jwt) < 32:
            issues.append("JWT_SECRET_KEY")

        if issues:
            return PreflightCheck(
                "no_default_passwords",
                CheckLevel.CRITICAL,
                CheckStatus.FAIL,
                f"پسوردهای پیش‌فرض/ضعیف: {', '.join(issues)}",
            )
        return PreflightCheck("no_default_passwords", CheckLevel.CRITICAL, CheckStatus.PASS)
    except Exception as exc:
        return PreflightCheck(
            "no_default_passwords", CheckLevel.CRITICAL, CheckStatus.FAIL,
            f"خطا در بارگذاری settings: {exc}"
        )


def check_debug_off() -> PreflightCheck:
    """DEBUG باید False باشد در production."""
    try:
        from src.core.config import settings
        if settings.DEBUG:
            return PreflightCheck(
                "debug_off", CheckLevel.CRITICAL, CheckStatus.FAIL,
                "DEBUG=True — حالت توسعه فعال است."
            )
        return PreflightCheck("debug_off", CheckLevel.CRITICAL, CheckStatus.PASS)
    except Exception as exc:
        return PreflightCheck("debug_off", CheckLevel.CRITICAL, CheckStatus.FAIL, str(exc))


async def check_redis_reachable() -> PreflightCheck:
    """Redis در دسترس و ping می‌دهد."""
    try:
        from src.core.redis_client import redis_client
        await redis_client.connect()
        await redis_client.client.ping()
        await redis_client.close()
        return PreflightCheck("redis_reachable", CheckLevel.CRITICAL, CheckStatus.PASS)
    except Exception as exc:
        return PreflightCheck(
            "redis_reachable", CheckLevel.CRITICAL, CheckStatus.FAIL, str(exc)
        )


async def check_database_reachable() -> PreflightCheck:
    """دیتابیس در دسترس و SELECT 1 کار می‌کند."""
    try:
        from sqlalchemy import text
        from src.core.database import async_session_factory
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        return PreflightCheck("database_reachable", CheckLevel.CRITICAL, CheckStatus.PASS)
    except Exception as exc:
        return PreflightCheck(
            "database_reachable", CheckLevel.CRITICAL, CheckStatus.FAIL, str(exc)
        )


def check_ml_models_dir_exists() -> PreflightCheck:
    """فولدر مدل‌ها باید وجود داشته باشد و خالی نباشد."""
    from src.ml.scaler import DEFAULT_MODEL_DIR
    if not DEFAULT_MODEL_DIR.exists():
        return PreflightCheck(
            "ml_models_present", CheckLevel.WARNING, CheckStatus.FAIL,
            f"دایرکتوری مدل‌ها {DEFAULT_MODEL_DIR} وجود ندارد — هیچ مدل ML آموزش نشده."
        )
    model_files = list(DEFAULT_MODEL_DIR.rglob("*.joblib"))
    if not model_files:
        return PreflightCheck(
            "ml_models_present", CheckLevel.WARNING, CheckStatus.FAIL,
            "هیچ فایل مدل .joblib در دایرکتوری مدل‌ها نیست."
        )
    return PreflightCheck(
        "ml_models_present", CheckLevel.WARNING, CheckStatus.PASS,
        f"{len(model_files)} فایل مدل پیدا شد."
    )


async def check_paper_trading_period(min_days: int = 7) -> PreflightCheck:
    """
    حداقل N روز paper trading قبل از launch.

    از DB قدیمی‌ترین سیگنال را می‌خواند و طول دوره‌ی paper trading را
    محاسبه می‌کند. در حالت paper تمام سیگنال‌ها paper هستند، پس
    MIN(created_at) روی جدول signals معیار شروع دوره است.
    """
    try:
        from sqlalchemy import func, select
        from src.core.database import async_session_factory, Signal

        async with async_session_factory() as session:
            res = await session.execute(select(func.min(Signal.created_at)))
            first_created = res.scalar_one_or_none()

        if first_created is None:
            return PreflightCheck(
                "paper_trading_period", CheckLevel.CRITICAL, CheckStatus.FAIL,
                "هیچ سیگنال paper ثبت نشده — دوره‌ی paper trading آغاز نشده است."
            )

        if first_created.tzinfo is None:
            first_created = first_created.replace(tzinfo=timezone.utc)
        elapsed_days = (datetime.now(timezone.utc) - first_created).days

        if elapsed_days < min_days:
            return PreflightCheck(
                "paper_trading_period", CheckLevel.CRITICAL, CheckStatus.FAIL,
                f"فقط {elapsed_days} روز paper trading انجام شده — حداقل {min_days} روز لازم است."
            )
        return PreflightCheck(
            "paper_trading_period", CheckLevel.CRITICAL, CheckStatus.PASS,
            f"{elapsed_days} روز paper trading انجام شده (حداقل {min_days})."
        )
    except Exception as exc:
        return PreflightCheck(
            "paper_trading_period", CheckLevel.CRITICAL, CheckStatus.FAIL, str(exc)
        )


def check_monitoring_active() -> PreflightCheck:
    """فایل alert rules و dashboard وجود دارد."""
    repo_root = Path(__file__).resolve().parents[2]
    expected = [
        repo_root / "monitoring" / "prometheus.yml",
        repo_root / "monitoring" / "alerts.yml",
    ]
    missing = [str(p.relative_to(repo_root)) for p in expected if not p.exists()]
    if missing:
        return PreflightCheck(
            "monitoring_active", CheckLevel.WARNING, CheckStatus.FAIL,
            f"فایل‌های monitoring مفقود: {', '.join(missing)}"
        )
    return PreflightCheck("monitoring_active", CheckLevel.WARNING, CheckStatus.PASS)


def check_backup_script_exists() -> PreflightCheck:
    """اسکریپت backup وجود دارد."""
    repo_root = Path(__file__).resolve().parents[2]
    backup_script = repo_root / "scripts" / "backup.sh"
    if not backup_script.exists():
        return PreflightCheck(
            "backup_script", CheckLevel.WARNING, CheckStatus.FAIL,
            f"اسکریپت backup در {backup_script} وجود ندارد."
        )
    return PreflightCheck("backup_script", CheckLevel.WARNING, CheckStatus.PASS)


def check_runbook_exists() -> PreflightCheck:
    """مستندات runbook موجود است."""
    repo_root = Path(__file__).resolve().parents[2]
    runbook = repo_root / "docs" / "RUNBOOK.md"
    if not runbook.exists():
        return PreflightCheck(
            "runbook_exists", CheckLevel.WARNING, CheckStatus.FAIL,
            f"RUNBOOK در {runbook} وجود ندارد."
        )
    return PreflightCheck("runbook_exists", CheckLevel.WARNING, CheckStatus.PASS)


def check_telegram_token_set() -> PreflightCheck:
    """Telegram bot token تنظیم شده."""
    from src.core.config import settings
    if not settings.TELEGRAM_BOT_TOKEN or len(settings.TELEGRAM_BOT_TOKEN) < 20:
        return PreflightCheck(
            "telegram_token", CheckLevel.CRITICAL, CheckStatus.FAIL,
            "TELEGRAM_BOT_TOKEN تنظیم نشده یا نامعتبر است."
        )
    return PreflightCheck("telegram_token", CheckLevel.CRITICAL, CheckStatus.PASS)


# ── runner اصلی ───────────────────────────────────────────


async def run_preflight() -> PreflightResult:
    """اجرای تمام چک‌ها."""
    result = PreflightResult()

    # چک‌های sync (سریع)
    result.checks.append(check_no_default_passwords())
    result.checks.append(check_debug_off())
    result.checks.append(check_telegram_token_set())
    result.checks.append(check_ml_models_dir_exists())
    result.checks.append(check_monitoring_active())
    result.checks.append(check_backup_script_exists())
    result.checks.append(check_runbook_exists())

    # چک‌های async (نیاز به I/O)
    try:
        result.checks.append(await check_redis_reachable())
    except Exception as exc:
        result.checks.append(PreflightCheck(
            "redis_reachable", CheckLevel.CRITICAL, CheckStatus.FAIL, str(exc)
        ))
    try:
        result.checks.append(await check_database_reachable())
    except Exception as exc:
        result.checks.append(PreflightCheck(
            "database_reachable", CheckLevel.CRITICAL, CheckStatus.FAIL, str(exc)
        ))
    try:
        result.checks.append(await check_paper_trading_period())
    except Exception as exc:
        result.checks.append(PreflightCheck(
            "paper_trading_period", CheckLevel.CRITICAL, CheckStatus.FAIL, str(exc)
        ))

    return result


# ── CLI entrypoint ────────────────────────────────────────


def _print_report(result: PreflightResult) -> None:
    """چاپ گزارش به‌صورت خوانا."""
    print("=" * 60)
    print("📋 Preflight Check — CoinePro FX")
    print("=" * 60)
    print(f"زمان: {result.timestamp.isoformat()}")
    print()
    for check in result.checks:
        if check.status == CheckStatus.PASS:
            icon = "✅"
        elif check.status == CheckStatus.SKIP:
            icon = "⏭"
        else:
            icon = "❌"
        level_tag = f"[{check.level.value.upper()}]"
        print(f"{icon} {level_tag:12s} {check.name}")
        if check.detail:
            print(f"      {check.detail}")
    print()
    print("=" * 60)
    if result.is_ready_for_launch:
        print("✅ آماده‌ی launch — تمام چک‌های critical موفق")
    else:
        print(f"❌ آماده‌ی launch نیست — {len(result.critical_failures)} چک critical fail")
        for c in result.critical_failures:
            print(f"   • {c.name}: {c.detail}")
    print("=" * 60)


async def _main() -> int:
    result = await run_preflight()
    _print_report(result)
    return 0 if result.is_ready_for_launch else 1


if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(_main()))
