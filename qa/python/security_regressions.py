from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from importlib import metadata
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest

from src.api.middleware.cors import DEFAULT_PRODUCTION_ORIGINS
from src.api.middleware.security_headers import SecurityHeadersMiddleware
from src.core.html_sanitizer import sanitize_article_html
from starlette.requests import Request
from starlette.responses import Response


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]


def _effective_routes(app):
    """Yield concrete routes across legacy flat and FastAPI lazy routers."""
    for route in app.routes:
        candidates = getattr(route, "effective_candidates", None)
        if callable(candidates):
            yield from candidates()
        else:
            yield route


def _route_path(route) -> str:
    starlette_route = getattr(route, "starlette_route", None)
    return getattr(starlette_route, "path", None) or getattr(route, "path", "")


def _is_websocket_route(route) -> bool:
    original = getattr(route, "original_route", route)
    return original.__class__.__name__ == "APIWebSocketRoute"


class HtmlSanitizerRegressionTests(unittest.TestCase):
    def test_dangerous_raw_text_blocks_are_removed_with_content(self) -> None:
        raw = '<p>safe</p><script>alert("XSS")</script><style>body{display:none}</style>'
        cleaned = sanitize_article_html(raw)
        self.assertEqual(cleaned, "<p>safe</p>")

    def test_plain_text_mode_does_not_retain_script_payload(self) -> None:
        cleaned = sanitize_article_html('<b>safe</b><script>alert(1)</script>', allow_tags=False)
        self.assertEqual(cleaned, "safe")


class CorsRegressionTests(unittest.TestCase):
    def test_current_production_defaults_use_https_origins_only(self) -> None:
        self.assertTrue(DEFAULT_PRODUCTION_ORIGINS)
        self.assertTrue(all(origin.startswith("https://") for origin in DEFAULT_PRODUCTION_ORIGINS))
        self.assertIn("https://localhost", DEFAULT_PRODUCTION_ORIGINS)
        self.assertNotIn("capacitor://localhost", DEFAULT_PRODUCTION_ORIGINS)


class SecurityHeaderRegressionTests(unittest.TestCase):
    def test_api_disables_deprecated_xss_auditor_and_uses_restrictive_csp(self) -> None:
        middleware = SecurityHeadersMiddleware(lambda _scope, _receive, _send: None)
        request = Request({
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "GET",
            "scheme": "https",
            "path": "/health",
            "raw_path": b"/health",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "server": ("prochart.local", 443),
        })

        async def call_next(_request: Request) -> Response:
            return Response("ok")

        response = asyncio.run(middleware.dispatch(request, call_next))
        self.assertEqual(response.headers["X-XSS-Protection"], "0")
        self.assertIn("default-src 'none'", response.headers["Content-Security-Policy"])
        self.assertIn("object-src 'none'", response.headers["Content-Security-Policy"])
        self.assertIn("base-uri 'none'", response.headers["Content-Security-Policy"])


class TimezoneRegressionTests(unittest.TestCase):
    def test_source_has_no_naive_datetime_utcnow_calls(self) -> None:
        offenders = []
        for source_file in (REPO_ROOT / "src").rglob("*.py"):
            if "datetime.utcnow()" in source_file.read_text(encoding="utf-8"):
                offenders.append(str(source_file.relative_to(REPO_ROOT)))
        self.assertEqual(offenders, [])


class DependencyRegressionTests(unittest.TestCase):
    def test_unused_pandas_ta_numba_stack_is_not_installed(self) -> None:
        # Query installed distributions instead of ``find_spec``. Some legacy
        # tests inject a synthetic ``pandas_ta`` module into ``sys.modules``;
        # that module has no spec and is not evidence that the package exists.
        for distribution in ("pandas-ta", "numba"):
            with self.subTest(distribution=distribution):
                with self.assertRaises(metadata.PackageNotFoundError):
                    metadata.version(distribution)

    def test_supported_analytics_stack_imports(self) -> None:
        import numpy  # noqa: F401
        import pandas  # noqa: F401
        import talib  # noqa: F401

    def test_api_image_uses_hardened_runtime_dependencies(self) -> None:
        for distribution in ("python-jose", "torch", "prometheus-fastapi-instrumentator"):
            with self.subTest(distribution=distribution):
                with self.assertRaises(metadata.PackageNotFoundError):
                    metadata.version(distribution)

        self.assertEqual(metadata.version("PyJWT"), "2.13.0")
        self.assertEqual(metadata.version("xgboost-cpu"), "2.1.3")


class JwtIssuerRegressionTests(unittest.TestCase):
    def test_central_rs256_token_requires_expected_issuer(self) -> None:
        import jwt
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        from src.core.config import settings
        from src.core.security import decode_token

        previous_enabled = settings.CENTRAL_AUTH_ENABLED
        previous_key = settings.CENTRAL_JWT_PUBLIC_KEY
        try:
            private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            settings.CENTRAL_AUTH_ENABLED = True
            settings.CENTRAL_JWT_PUBLIC_KEY = private.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode()
            common = {
                "sub": "central-user",
                "type": "access",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            }
            valid = jwt.encode(
                {**common, "iss": settings.CENTRAL_JWT_ISSUER},
                private,
                algorithm="RS256",
            )
            wrong = jwt.encode(
                {**common, "iss": "https://unexpected-issuer.invalid"},
                private,
                algorithm="RS256",
            )
            self.assertEqual(decode_token(valid)["sub"], "central-user")
            self.assertIsNone(decode_token(wrong))
        finally:
            settings.CENTRAL_AUTH_ENABLED = previous_enabled
            settings.CENTRAL_JWT_PUBLIC_KEY = previous_key


class LocalSecretHygieneRegressionTests(unittest.TestCase):
    def test_cloudflare_template_is_empty_and_runtime_file_is_excluded(self) -> None:
        template_lines = (REPO_ROOT / ".cf.example").read_text(encoding="utf-8").splitlines()
        values = {
            key: value
            for line in template_lines
            if line and not line.startswith("#")
            for key, value in [line.split("=", 1)]
        }
        self.assertEqual(values, {"CF_API_TOKEN": "", "CF_ZONE_ID": ""})

        gitignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
        dockerignore = (REPO_ROOT / ".dockerignore").read_text(encoding="utf-8").splitlines()
        self.assertIn(".cf", gitignore)
        self.assertIn(".cf", dockerignore)
        self.assertIn(".env*", dockerignore)

    def test_cloudflare_loader_rejects_open_permissions_and_symlinks(self) -> None:
        source = REPO_ROOT / "cf_purge.sh"
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            script = root / "cf_purge.sh"
            shutil.copy2(source, script)
            script.chmod(0o700)
            config = root / ".cf"

            config.write_text("CF_API_TOKEN=\nCF_ZONE_ID=\n", encoding="utf-8")
            config.chmod(0o644)
            open_mode = subprocess.run(
                ["bash", str(script)],
                cwd=root,
                env={**os.environ, "LC_ALL": "C.UTF-8"},
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(open_mode.returncode, 2)
            self.assertIn("chmod 600", open_mode.stderr)

            config.unlink()
            config.symlink_to(root / "missing-secret-file")
            symlink = subprocess.run(
                ["bash", str(script)],
                cwd=root,
                env={**os.environ, "LC_ALL": "C.UTF-8"},
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(symlink.returncode, 2)
            self.assertIn("symbolic link", symlink.stderr)


class BackupSecretHygieneRegressionTests(unittest.TestCase):
    def test_hourly_archive_excludes_secret_and_backup_paths(self) -> None:
        from scripts.hourly_backup import excluded

        excluded_paths = [
            "/project/.env",
            "/project/.env.production",
            "/project/.cf",
            "/project/.igkey",
            "/project/secrets/provider-token",
            "/project/certbot/live/private.pem",
            "/project/config/signing.key",
            "/project/backups/archive.tar.gz",
            "/project/backup-logs/hourly.log",
            "/project/.codex-backups/snapshot/config",
        ]
        for candidate in excluded_paths:
            with self.subTest(candidate=candidate):
                self.assertTrue(excluded(candidate))
        self.assertFalse(excluded("/project/src/api/main.py"))

    def test_remote_backup_keeps_compose_unresolved_and_excludes_secrets(self) -> None:
        script = (REPO_ROOT / "scripts" / "gdrive_backup.sh").read_text(encoding="utf-8")
        self.assertIn("config --no-interpolate --no-env-resolution", script)
        for pattern in (
            "--exclude '.env'",
            "--exclude '.env.*'",
            "--exclude '.cf'",
            "--exclude '/secrets/'",
            "--exclude '*.pem'",
            "--exclude '*.key'",
        ):
            with self.subTest(pattern=pattern):
                self.assertIn(pattern, script)

    def test_env_backup_passphrase_is_not_exposed_in_process_arguments(self) -> None:
        script = (REPO_ROOT / "scripts" / "backup.sh").read_text(encoding="utf-8")
        self.assertIn("-pass env:BACKUP_PASSPHRASE", script)
        self.assertNotIn('-pass "pass:${BACKUP_PASSPHRASE}"', script)

    def test_rotation_output_is_owner_only_and_values_are_not_logged(self) -> None:
        script = REPO_ROOT / "scripts" / "rotate_secrets.sh"
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            output = root / ".env.new"
            result = subprocess.run(
                ["bash", str(script), str(output)],
                cwd=root,
                env={**os.environ, "ENV_FILE": str(root / "absent.env")},
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)

            secret_keys = {
                "DB_PASSWORD",
                "REDIS_PASSWORD",
                "ADMIN_PASSWORD",
                "GRAFANA_PASSWORD",
                "JWT_SECRET_KEY",
                "BACKUP_PASSPHRASE",
            }
            generated_values = {
                key: value
                for line in output.read_text(encoding="utf-8").splitlines()
                if "=" in line
                for key, value in [line.split("=", 1)]
                if key in secret_keys and value
            }
            self.assertEqual(set(generated_values), secret_keys)
            self.assertEqual(len(set(generated_values.values())), len(secret_keys))
            combined_output = result.stdout + result.stderr
            for key, value in generated_values.items():
                with self.subTest(key=key, value_length=len(value)):
                    self.assertGreaterEqual(len(value), 32)
                    self.assertNotIn(value, combined_output)

    def test_rotation_rejects_symlink_output_and_open_source_permissions(self) -> None:
        script = REPO_ROOT / "scripts" / "rotate_secrets.sh"
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            victim = root / "victim"
            victim.write_text("unchanged\n", encoding="utf-8")
            output = root / ".env.new"
            output.symlink_to(victim)
            symlink = subprocess.run(
                ["bash", str(script), str(output)],
                cwd=root,
                env={**os.environ, "ENV_FILE": str(root / "absent.env")},
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(symlink.returncode, 1)
            self.assertEqual(victim.read_text(encoding="utf-8"), "unchanged\n")

            output.unlink()
            source = root / ".env"
            source.write_text("DB_PASSWORD=\n", encoding="utf-8")
            source.chmod(0o644)
            open_source = subprocess.run(
                ["bash", str(script), str(output)],
                cwd=root,
                env={**os.environ, "ENV_FILE": str(source)},
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(open_source.returncode, 1)
            self.assertIn("chmod 600", open_source.stdout + open_source.stderr)
            self.assertFalse(output.exists())


class RouteRegistrationRegressionTests(unittest.TestCase):
    def test_live_frontend_contract_is_mounted(self) -> None:
        from src.api.main import app

        routes = list(_effective_routes(app))
        registered = {
            (method, _route_path(route))
            for route in routes
            for method in getattr(route, "methods", set())
        }
        websocket_paths = {
            _route_path(route)
            for route in routes
            if _is_websocket_route(route)
        }

        self.assertIn(("GET", "/live/config"), registered)
        self.assertIn(("POST", "/live/auth/telegram"), registered)
        self.assertIn("/live/ws/chat", websocket_paths)

    def test_live_admin_contract_remains_admin_protected(self) -> None:
        from src.api.deps import get_current_admin
        from src.api.main import app

        admin_routes = [
            route
            for route in _effective_routes(app)
            if _route_path(route).startswith("/live/admin/")
        ]
        self.assertEqual(len(admin_routes), 15)
        for route in admin_routes:
            with self.subTest(path=_route_path(route)):
                dependencies = {
                    dependency.call
                    for dependency in route.dependant.dependencies
                }
                self.assertIn(get_current_admin, dependencies)

if __name__ == "__main__":
    unittest.main(verbosity=2)
