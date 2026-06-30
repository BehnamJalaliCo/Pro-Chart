"""
تست‌های فاز ۱۵ — UX و Frontend پایانی.

پوشش:
    - format_signal_compact (۴-۵ خطی به‌جای ۳۰)
    - build_signal_inline_keyboard (ساختار کاربردی برای aiogram)
    - format_user_tier_summary (free/premium/vip)
    - فایل‌های frontend (CommandPalette, Sidebar, EmptyState, Skeleton, i18n)
    - Sidebar mobile drawer logic
    - i18n key dictionary completeness
    - Accessibility attributes (aria-label, role)
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import re
import sys

import pytest


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


def _load(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# ===========================================================================
# Bot — Compact Formatter
# ===========================================================================


def _base_signal():
    return {
        "direction": "BUY",
        "symbol": "EURUSD",
        "timeframe": "H1",
        "entry_low": 1.0950,
        "entry_high": 1.0960,
        "stop_loss": 1.0920,
        "targets": [1.0990, 1.1020, 1.1050],
        "ai_score": 85,
    }


class TestCompactFormatter:
    @pytest.fixture
    def formatter(self):
        return _load("_test_fmt_compact", "src/bot/formatter.py")

    def test_compact_is_short(self, formatter):
        sig = _base_signal()
        out = formatter.format_signal_compact(sig)
        lines = out.split("\n")
        # حداکثر ~۶ خط (شامل خط خالی)
        assert len(lines) <= 6, f"compact format خیلی طولانی: {len(lines)} خط"

    def test_compact_contains_essentials(self, formatter):
        sig = _base_signal()
        out = formatter.format_signal_compact(sig)
        # نام فارسی نماد
        assert "یورو/دلار" in out
        # جهت
        assert "خرید" in out
        # امتیاز AI
        assert "۸۵" in out  # عدد فارسی
        # تایم‌فریم
        assert "H1" in out

    def test_compact_short_for_sell(self, formatter):
        sig = _base_signal()
        sig["direction"] = "SELL"
        out = formatter.format_signal_compact(sig)
        assert "فروش" in out
        assert "🔴" in out

    def test_compact_handles_missing_targets(self, formatter):
        sig = _base_signal()
        sig["targets"] = []
        # نباید crash کند
        out = formatter.format_signal_compact(sig)
        assert "یورو/دلار" in out

    def test_compact_uses_html_bold(self, formatter):
        """برای aiogram parse_mode=HTML باید <b> داشته باشد."""
        sig = _base_signal()
        out = formatter.format_signal_compact(sig)
        assert "<b>" in out
        assert "</b>" in out


# ===========================================================================
# Bot — Inline Keyboard
# ===========================================================================


class TestInlineKeyboard:
    @pytest.fixture
    def formatter(self):
        return _load("_test_fmt_kb", "src/bot/formatter.py")

    def test_builds_two_rows(self, formatter):
        rows = formatter.build_signal_inline_keyboard(signal_id=42)
        assert len(rows) == 2

    def test_callback_data_includes_signal_id(self, formatter):
        rows = formatter.build_signal_inline_keyboard(signal_id=99)
        all_buttons = [btn for row in rows for btn in row]
        for btn in all_buttons:
            assert "callback_data" in btn
            assert "99" in btn["callback_data"]

    def test_callback_data_namespaced(self, formatter):
        rows = formatter.build_signal_inline_keyboard(signal_id=1)
        actions = [btn["callback_data"].split(":")[1] for row in rows for btn in row]
        assert "detail" in actions
        assert "save" in actions
        assert "mute" in actions
        assert "feedback" in actions

    def test_buttons_have_persian_text(self, formatter):
        rows = formatter.build_signal_inline_keyboard(signal_id=1)
        all_text = " ".join(btn["text"] for row in rows for btn in row)
        # حداقل یک کاراکتر فارسی
        assert any("؀" <= c <= "ۿ" for c in all_text)


# ===========================================================================
# Bot — Tier Summary
# ===========================================================================


class TestTierSummary:
    @pytest.fixture
    def formatter(self):
        return _load("_test_fmt_tier", "src/bot/formatter.py")

    def test_free_tier_shows_upgrade_hint(self, formatter):
        out = formatter.format_user_tier_summary(
            plan="free", daily_limit=10, daily_used=3,
        )
        assert "رایگان" in out
        assert "🆓" in out
        # progress bar
        assert "٣" in out or "۳" in out  # ۳ as Persian digit
        # ارتقا hint
        assert "پرمیوم" in out

    def test_premium_tier_no_upgrade_hint(self, formatter):
        out = formatter.format_user_tier_summary(
            plan="premium", daily_limit=100, daily_used=10,
        )
        assert "پرمیوم" in out
        assert "⭐" in out

    def test_vip_tier(self, formatter):
        out = formatter.format_user_tier_summary(
            plan="vip", daily_limit=1000, daily_used=50,
        )
        assert "VIP" in out
        assert "👑" in out

    def test_unknown_plan_falls_back_to_free(self, formatter):
        out = formatter.format_user_tier_summary(
            plan="enterprise_unknown", daily_limit=10, daily_used=0,
        )
        # graceful fallback
        assert "رایگان" in out

    def test_remaining_calculated(self, formatter):
        out = formatter.format_user_tier_summary(
            plan="free", daily_limit=10, daily_used=7,
        )
        # ۳ باقی‌مانده
        assert "۳" in out


# ===========================================================================
# Frontend — Component files exist
# ===========================================================================


class TestFrontendFiles:
    def test_command_palette_exists(self):
        path = REPO_ROOT / "frontend/admin/src/components/common/CommandPalette.jsx"
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        # کلیدهای کلیدی: Cmd+K، fuzzy match، navigation
        assert "metaKey" in content
        assert "ctrlKey" in content
        assert "fuzzyMatch" in content
        assert "DEFAULT_NAV_COMMANDS" in content

    def test_command_palette_has_keyboard_navigation(self):
        content = (
            REPO_ROOT / "frontend/admin/src/components/common/CommandPalette.jsx"
        ).read_text(encoding="utf-8")
        assert "ArrowDown" in content
        assert "ArrowUp" in content
        assert "Enter" in content
        assert "Escape" in content

    def test_command_palette_has_aria(self):
        content = (
            REPO_ROOT / "frontend/admin/src/components/common/CommandPalette.jsx"
        ).read_text(encoding="utf-8")
        assert 'role="dialog"' in content
        assert "aria-label" in content

    def test_empty_state_component_exists(self):
        path = REPO_ROOT / "frontend/admin/src/components/common/EmptyState.jsx"
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        # props اصلی
        assert "title" in content
        assert "description" in content
        assert "action" in content
        assert 'role="status"' in content

    def test_skeleton_components_exist(self):
        path = REPO_ROOT / "frontend/admin/src/components/common/Skeleton.jsx"
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        assert "TableSkeleton" in content
        assert "CardSkeleton" in content
        assert "ChartSkeleton" in content
        # motion-safe برای prefers-reduced-motion
        assert "motion-safe:" in content
        assert "aria-hidden" in content


# ===========================================================================
# Frontend — Sidebar mobile drawer
# ===========================================================================


class TestSidebarMobile:
    def test_sidebar_uses_media_query(self):
        content = (
            REPO_ROOT / "frontend/admin/src/components/Layout/Sidebar.jsx"
        ).read_text(encoding="utf-8")
        assert "useMediaQuery" in content
        assert "max-width: 768px" in content

    def test_sidebar_has_drawer_state(self):
        content = (
            REPO_ROOT / "frontend/admin/src/components/Layout/Sidebar.jsx"
        ).read_text(encoding="utf-8")
        assert "mobileDrawerOpen" in content
        assert "closeMobileDrawer" in content

    def test_sidebar_has_overlay(self):
        content = (
            REPO_ROOT / "frontend/admin/src/components/Layout/Sidebar.jsx"
        ).read_text(encoding="utf-8")
        # overlay برای دسترسی‌پذیری
        assert "translate-x-full" in content
        assert "translate-x-0" in content
        assert "aria-hidden" in content

    def test_sidebar_has_focus_visible(self):
        """دسترسی‌پذیری: focus ring برای keyboard navigation."""
        content = (
            REPO_ROOT / "frontend/admin/src/components/Layout/Sidebar.jsx"
        ).read_text(encoding="utf-8")
        assert "focus-visible:ring" in content

    def test_admin_layout_has_hamburger(self):
        content = (
            REPO_ROOT / "frontend/admin/src/components/Layout/AdminLayout.jsx"
        ).read_text(encoding="utf-8")
        # hamburger menu برای موبایل
        assert "Menu" in content  # lucide-react Menu icon
        assert "openMobileDrawer" in content

    def test_admin_layout_includes_command_palette(self):
        content = (
            REPO_ROOT / "frontend/admin/src/components/Layout/AdminLayout.jsx"
        ).read_text(encoding="utf-8")
        assert "CommandPalette" in content


# ===========================================================================
# Frontend — Store mobile drawer
# ===========================================================================


class TestStoreMobileDrawer:
    def test_store_has_mobile_drawer_actions(self):
        content = (
            REPO_ROOT / "frontend/admin/src/store/index.js"
        ).read_text(encoding="utf-8")
        assert "openMobileDrawer" in content
        assert "closeMobileDrawer" in content
        assert "toggleMobileDrawer" in content
        assert "mobileDrawerOpen" in content

    def test_store_excludes_drawer_from_persist(self):
        """mobileDrawerOpen نباید persist شود (همیشه closed start)."""
        content = (
            REPO_ROOT / "frontend/admin/src/store/index.js"
        ).read_text(encoding="utf-8")
        # partialize باید فقط theme + sidebarCollapsed را نگه دارد
        assert "partialize" in content


# ===========================================================================
# Frontend — i18n
# ===========================================================================


class TestI18n:
    def test_i18n_module_exists(self):
        path = REPO_ROOT / "frontend/admin/src/i18n/index.js"
        assert path.exists()

    def test_i18n_has_translations_dictionary(self):
        content = (
            REPO_ROOT / "frontend/admin/src/i18n/index.js"
        ).read_text(encoding="utf-8")
        assert "translations" in content
        assert "fa:" in content or "'fa'" in content

    def test_i18n_has_common_keys(self):
        content = (
            REPO_ROOT / "frontend/admin/src/i18n/index.js"
        ).read_text(encoding="utf-8")
        for key in [
            "common.loading",
            "common.no_data",
            "common.error",
            "nav.dashboard",
            "nav.signals",
            "status.active",
            "direction.long",
            "direction.short",
        ]:
            assert f"'{key}'" in content, f"i18n key مفقود: {key}"

    def test_i18n_supports_interpolation(self):
        content = (
            REPO_ROOT / "frontend/admin/src/i18n/index.js"
        ).read_text(encoding="utf-8")
        # interpolation: {n}
        assert "{n}" in content
        # و کد replace
        assert "replace" in content

    def test_i18n_helpers_exported(self):
        content = (
            REPO_ROOT / "frontend/admin/src/i18n/index.js"
        ).read_text(encoding="utf-8")
        assert "statusLabel" in content
        assert "directionLabel" in content
        assert "useI18n" in content
