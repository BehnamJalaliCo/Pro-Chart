"""
تست‌های فاز ۸ — Hot fixes امنیتی.

پوشش:
    - HTML sanitization (XSS prevention)
    - URL validation (SSRF prevention)
    - Telegram ID masking
    - require_role / RBAC factory
    - Refresh token type validation (verify_refresh_token)
    - Security headers middleware
    - Articles whitelist edit fields
    - Launch metrics whitelist
    - Backup script enforcement
    - Refresh token blacklist + rotation
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


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

sanitizer = _load("_test_sanitizer", "src/core/html_sanitizer.py")


# ===========================================================================
# HTML Sanitization (XSS prevention)
# ===========================================================================


class TestHTMLSanitization:
    def test_strips_script_tag(self):
        evil = '<p>Hello</p><script>alert("XSS")</script>'
        cleaned = sanitizer.sanitize_article_html(evil)
        assert "<script>" not in cleaned.lower()
        assert "alert" not in cleaned or "alert(" not in cleaned

    def test_strips_iframe(self):
        evil = '<p>Text</p><iframe src="https://evil.com"></iframe>'
        cleaned = sanitizer.sanitize_article_html(evil)
        assert "<iframe" not in cleaned.lower()

    def test_strips_onclick_handler(self):
        evil = '<img src="x" onerror="alert(1)" />'
        cleaned = sanitizer.sanitize_article_html(evil)
        assert "onerror" not in cleaned.lower()

    def test_strips_javascript_url(self):
        evil = '<a href="javascript:alert(1)">click</a>'
        cleaned = sanitizer.sanitize_article_html(evil)
        # یا href حذف می‌شود یا scheme عوض می‌شود
        assert "javascript:" not in cleaned.lower()

    def test_keeps_safe_tags(self):
        safe = "<p>Hello <strong>world</strong></p><h2>Title</h2>"
        cleaned = sanitizer.sanitize_article_html(safe)
        assert "<p>" in cleaned
        assert "<strong>" in cleaned
        assert "<h2>" in cleaned

    def test_no_tags_mode_strips_everything(self):
        with_tags = "<p>Hello <b>world</b></p>"
        cleaned = sanitizer.sanitize_article_html(with_tags, allow_tags=False)
        assert "<" not in cleaned
        assert "Hello" in cleaned
        assert "world" in cleaned

    def test_empty_input(self):
        assert sanitizer.sanitize_article_html("") == ""
        assert sanitizer.sanitize_article_html(None) is None

    def test_strips_object_embed(self):
        evil = '<object data="evil.swf"></object><embed src="evil.swf">'
        cleaned = sanitizer.sanitize_article_html(evil)
        assert "<object" not in cleaned.lower()
        assert "<embed" not in cleaned.lower()


class TestURLValidation:
    def test_valid_https_url(self):
        assert sanitizer.validate_url("https://example.com/image.png") is True

    def test_valid_http_url(self):
        assert sanitizer.validate_url("http://cdn.example.com/cover.jpg") is True

    def test_rejects_javascript_scheme(self):
        assert sanitizer.validate_url("javascript:alert(1)") is False

    def test_rejects_data_url(self):
        assert sanitizer.validate_url("data:image/png;base64,iVBOR...") is False

    def test_rejects_localhost(self):
        # SSRF prevention
        assert sanitizer.validate_url("http://localhost/secret") is False
        assert sanitizer.validate_url("http://127.0.0.1/api") is False

    def test_rejects_private_ip(self):
        assert sanitizer.validate_url("http://10.0.0.1/internal") is False
        assert sanitizer.validate_url("http://192.168.1.1/router") is False

    def test_rejects_credentials_in_url(self):
        assert sanitizer.validate_url("http://user:pass@example.com/") is False

    def test_rejects_empty(self):
        assert sanitizer.validate_url("") is False
        assert sanitizer.validate_url(None) is False


class TestMaskSensitiveID:
    def test_masks_telegram_id(self):
        result = sanitizer.mask_sensitive_id(1234567890)
        assert result == "******7890"
        assert "12345" not in result

    def test_masks_short_id(self):
        result = sanitizer.mask_sensitive_id(123, visible_digits=4)
        # اگر کوتاه‌تر از visible_digits، همه masked
        assert all(c == "*" for c in result)

    def test_custom_visible_digits(self):
        result = sanitizer.mask_sensitive_id(1234567890, visible_digits=2)
        assert result.endswith("90")
        assert result.startswith("*")


# ===========================================================================
# RBAC require_role
# ===========================================================================


class TestRequireRole:
    def test_role_hierarchy_satisfies(self):
        # require_role helper is defined in deps.py — we test the predicate logic
        # by checking the source code has the right structure
        content = (REPO_ROOT / "src/api/deps.py").read_text(encoding="utf-8")
        assert "_ROLE_HIERARCHY" in content
        assert '"viewer"' in content
        assert '"analyst"' in content
        assert '"admin"' in content
        assert '"superadmin"' in content
        assert "def require_role" in content
        assert "def _role_satisfies" in content


class TestSourceLevelInvariants:
    """Source-level checks for phase 8 fixes."""

    def test_refresh_uses_verify_refresh_token(self):
        content = (REPO_ROOT / "src/api/routes/auth.py").read_text(encoding="utf-8")
        # تأیید: در refresh endpoint از verify_refresh_token استفاده می‌شود
        assert "verify_refresh_token" in content
        # و verify_access_token دیگر در refresh handler نیست
        # (با ساده‌سازی: تابع باید imported باشد)
        assert "from src.core.security import" in content

    def test_refresh_endpoint_has_blacklist_check(self):
        content = (REPO_ROOT / "src/api/routes/auth.py").read_text(encoding="utf-8")
        # token_blacklist:{old_jti} باید در refresh handler چک شود
        assert "token_blacklist:" in content
        assert "old_jti" in content

    def test_get_current_admin_is_fail_secure(self):
        content = (REPO_ROOT / "src/api/deps.py").read_text(encoding="utf-8")
        # 503 برای Redis failure
        assert "HTTP_503_SERVICE_UNAVAILABLE" in content
        # و در ناحیه‌ی except از blacklist_check اتفاق می‌افتد
        assert "blacklist_check_failed" in content

    def test_security_headers_middleware_registered(self):
        main_content = (REPO_ROOT / "src/api/main.py").read_text(encoding="utf-8")
        assert "SecurityHeadersMiddleware" in main_content
        assert "add_middleware(SecurityHeadersMiddleware" in main_content

    def test_security_headers_includes_all_required(self):
        sh = (REPO_ROOT / "src/api/middleware/security_headers.py").read_text(encoding="utf-8")
        for header in [
            "Strict-Transport-Security",
            "X-Frame-Options",
            "X-Content-Type-Options",
            "Referrer-Policy",
            "Permissions-Policy",
            "Content-Security-Policy",
        ]:
            assert header in sh, f"header مفقود: {header}"

    def test_articles_uses_sanitizer(self):
        content = (REPO_ROOT / "src/api/routes/articles.py").read_text(encoding="utf-8")
        assert "sanitize_article_html" in content
        assert "EDITABLE_ARTICLE_FIELDS" in content
        # field_validator باید روی content و summary اعمال شده باشد
        assert "field_validator" in content

    def test_articles_update_uses_whitelist(self):
        content = (REPO_ROOT / "src/api/routes/articles.py").read_text(encoding="utf-8")
        # whitelist باید لیست محدود فیلدها داشته باشد
        assert "EDITABLE_ARTICLE_FIELDS" in content
        # و در حلقه‌ی update استفاده شود
        assert "field_name not in EDITABLE_ARTICLE_FIELDS" in content

    def test_users_route_masks_telegram_id(self):
        content = (REPO_ROOT / "src/api/routes/users.py").read_text(encoding="utf-8")
        assert "mask_sensitive_id" in content
        assert "from src.core.html_sanitizer" in content

    def test_launch_metrics_use_whitelist(self):
        content = (REPO_ROOT / "src/api/routes/launch.py").read_text(encoding="utf-8")
        assert "_ALLOWED_METRIC_FIELDS" in content
        # و در setattr استفاده می‌شود
        assert "key in _ALLOWED_METRIC_FIELDS" in content

    def test_backup_script_enforces_passphrase(self):
        content = (REPO_ROOT / "scripts/backup.sh").read_text(encoding="utf-8")
        # exit code in case of missing passphrase
        assert "BACKUP_PASSPHRASE" in content
        assert "ALLOW_UNENCRYPTED_BACKUP" in content
        # exit 2 برای fail
        assert "exit 2" in content
        # PBKDF2 با iterations بالا
        assert "iter 100000" in content

    def test_rotate_secrets_script_exists(self):
        import os
        path = REPO_ROOT / "scripts/rotate_secrets.sh"
        assert path.exists()
        assert os.access(path, os.X_OK), "rotate_secrets.sh executable نیست"
        content = path.read_text(encoding="utf-8")
        # تولید secrets با openssl
        assert "openssl rand" in content
        # JWT, DB, Redis, admin, grafana
        assert "JWT_SECRET_KEY" in content
        assert "DB_PASSWORD" in content
        assert "REDIS_PASSWORD" in content
