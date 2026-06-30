"""
تست‌های فاز ۴ — کیفیت کد و پایداری.

پوشش:
    - Log secret redactor (JWT, API key, password fields)
    - CORS configuration (production vs dev)
    - get_db smart commit
    - feed_manager failover lock (race condition prevention)
    - تنظیمات pool size
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys

import pytest


def _load(name: str, relative_path: str):
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location(name, repo_root / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# ── ماژول‌ها — logger مستقل از سایرین قابل بارگذاری است ──
logger_mod = _load("_test_logger", "src/core/logger.py")


# ===========================================================================
# Secret Redactor
# ===========================================================================


class TestSecretRedactor:
    def test_redacts_password_field(self):
        event = {"event": "user login", "password": "supersecret123"}
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert cleaned["password"] == "[REDACTED]"
        assert cleaned["event"] == "user login"  # غیر-حساس دست‌نخورده

    def test_redacts_token_fields(self):
        event = {
            "event": "auth",
            "token": "abc123xyz",
            "access_token": "def456",
            "refresh_token": "ghi789",
            "api_key": "secret_api_key",
        }
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert cleaned["token"] == "[REDACTED]"
        assert cleaned["access_token"] == "[REDACTED]"
        assert cleaned["refresh_token"] == "[REDACTED]"
        assert cleaned["api_key"] == "[REDACTED]"

    def test_redacts_authorization_field(self):
        event = {"event": "request", "authorization": "Bearer abc123"}
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert cleaned["authorization"] == "[REDACTED]"

    def test_redacts_jwt_in_string_value(self):
        # JWT format: eyJ...header.eyJ...payload.signature
        jwt = (
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
            "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ."
            "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        )
        event = {"event": "user logged in", "headers": f"Authorization: {jwt}"}
        cleaned = logger_mod.secret_redactor(None, None, event)
        # JWT داخل value هم باید redact شود
        assert "[JWT_REDACTED]" in cleaned["headers"]
        assert "eyJhbGc" not in cleaned["headers"]

    def test_redacts_bearer_token_in_string(self):
        event = {"event": "http", "auth_header": "Bearer abcdef1234567890qrstuvwxyz"}
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert "[REDACTED]" in cleaned["auth_header"]
        assert "abcdef" not in cleaned["auth_header"]

    def test_redacts_recursively_in_nested_dict(self):
        event = {
            "event": "request",
            "user": {
                "name": "alice",
                "password": "shouldnotleak",
                "session": {"token": "secret_token"},
            },
        }
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert cleaned["user"]["password"] == "[REDACTED]"
        assert cleaned["user"]["session"] == "[REDACTED]"  # session نام حساس است
        assert cleaned["user"]["name"] == "alice"  # غیر-حساس

    def test_redacts_in_lists(self):
        jwt = (
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
            "eyJzdWIiOiIxMjM0NTY3ODkwIn0."
            "abcdefghijklmnopqrstuvwxyz1234567890"
        )
        event = {"event": "batch", "items": [{"password": "x"}, f"value:{jwt}"]}
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert cleaned["items"][0]["password"] == "[REDACTED]"
        assert "[JWT_REDACTED]" in cleaned["items"][1]

    def test_non_string_values_unchanged(self):
        event = {"event": "stats", "count": 42, "rate": 0.95}
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert cleaned["count"] == 42
        assert cleaned["rate"] == 0.95

    def test_case_insensitive_key_matching(self):
        event = {"PASSWORD": "x", "Token": "y", "API_Key": "z"}
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert cleaned["PASSWORD"] == "[REDACTED]"
        assert cleaned["Token"] == "[REDACTED]"
        assert cleaned["API_Key"] == "[REDACTED]"

    def test_safe_keys_not_redacted(self):
        # کلیدهایی که نباید redact شوند
        event = {
            "username": "alice",
            "email": "a@b.com",
            "user_id": 123,
            "method": "POST",
            "endpoint": "/api/foo",
        }
        cleaned = logger_mod.secret_redactor(None, None, event)
        assert cleaned["username"] == "alice"
        assert cleaned["email"] == "a@b.com"


# ===========================================================================
# CORS configuration
# ===========================================================================


class TestCorsConfig:
    """CORS منطق انتخاب origins بدون نیاز به FastAPI app کامل."""

    def test_parse_origins_empty(self):
        cors_mod = _load("_test_cors", "src/api/middleware/cors.py")
        assert cors_mod._parse_origins("") == []
        assert cors_mod._parse_origins("   ") == []

    def test_parse_origins_single(self):
        cors_mod = _load("_test_cors2", "src/api/middleware/cors.py")
        assert cors_mod._parse_origins("https://a.com") == ["https://a.com"]

    def test_parse_origins_multiple(self):
        cors_mod = _load("_test_cors3", "src/api/middleware/cors.py")
        result = cors_mod._parse_origins("https://a.com, https://b.com,https://c.com")
        assert result == ["https://a.com", "https://b.com", "https://c.com"]

    def test_default_dev_origins_no_wildcard(self):
        cors_mod = _load("_test_cors4", "src/api/middleware/cors.py")
        # هیچ origin dev نباید "*" باشد
        for origin in cors_mod.DEFAULT_DEV_ORIGINS:
            assert origin != "*"
            assert origin.startswith("http")

    def test_default_production_origins_https_only(self):
        cors_mod = _load("_test_cors5", "src/api/middleware/cors.py")
        for origin in cors_mod.DEFAULT_PRODUCTION_ORIGINS:
            assert origin.startswith("https://"), f"production origin غیر-https: {origin}"


# ===========================================================================
# FeedManager Failover Lock
# ===========================================================================


class TestFailoverLock:
    """تست race condition prevention در failover."""

    def test_feed_manager_has_failover_lock(self):
        """بررسی اینکه DataFeedManager از asyncio.Lock استفاده می‌کند."""
        import re
        repo_root = pathlib.Path(__file__).resolve().parent.parent
        content = (repo_root / "src/data/feed_manager.py").read_text(encoding="utf-8")

        # باید asyncio.Lock تعریف شده باشد
        assert re.search(r"_failover_lock\s*[:=]\s*asyncio\.Lock", content), \
            "FeedManager باید _failover_lock داشته باشد"

        # و در _failover استفاده شود
        assert "async with self._failover_lock" in content, \
            "_failover باید درون lock اجرا شود"


# ===========================================================================
# Connection pool sizes
# ===========================================================================


class TestConnectionPools:
    def test_db_pool_settings_present(self):
        """تنظیمات pool DB در config باید موجود باشند."""
        import re
        repo_root = pathlib.Path(__file__).resolve().parent.parent
        content = (repo_root / "src/core/config.py").read_text(encoding="utf-8")

        assert re.search(r"DB_POOL_SIZE\s*:\s*int", content)
        assert re.search(r"DB_MAX_OVERFLOW\s*:\s*int", content)
        assert re.search(r"REDIS_MAX_CONNECTIONS\s*:\s*int", content)

    def test_database_uses_settings_pool_size(self):
        """database.py باید از settings برای pool size بخواند."""
        repo_root = pathlib.Path(__file__).resolve().parent.parent
        content = (repo_root / "src/core/database.py").read_text(encoding="utf-8")
        assert "DB_POOL_SIZE" in content
        assert "DB_MAX_OVERFLOW" in content


# ===========================================================================
# get_db smart commit
# ===========================================================================


class TestGetDb:
    """get_db باید فقط در صورت وجود تراکنش فعال commit کند."""

    def test_get_db_uses_in_transaction_check(self):
        """deps.py باید بررسی in_transaction() داشته باشد."""
        repo_root = pathlib.Path(__file__).resolve().parent.parent
        content = (repo_root / "src/api/deps.py").read_text(encoding="utf-8")
        assert "in_transaction" in content, \
            "get_db باید قبل از commit بررسی in_transaction کند"


# ===========================================================================
# Timezone consistency
# ===========================================================================


class TestTimezoneConsistency:
    """utcnow() حذف شده و فقط now(timezone.utc) استفاده می‌شود."""

    def test_no_utcnow_in_src(self):
        """هیچ‌جای src نباید datetime.utcnow() استفاده شود."""
        repo_root = pathlib.Path(__file__).resolve().parent.parent
        src_path = repo_root / "src"
        violations = []
        for py_file in src_path.rglob("*.py"):
            content = py_file.read_text(encoding="utf-8")
            if "utcnow()" in content:
                violations.append(str(py_file.relative_to(repo_root)))
        assert not violations, (
            f"datetime.utcnow() پیدا شد در: {violations}. "
            "از datetime.now(timezone.utc) استفاده کنید."
        )
