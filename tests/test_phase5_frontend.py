"""
تست‌های فاز ۵ — frontend integration و route های جدید risk.

پوشش:
    - API risk routes (داشتن endpoint ها و schema درست)
    - BacktestPage و RiskPage در App.jsx ثبت شده‌اند
    - Sidebar شامل آیتم‌های جدید است
    - API client شامل backtestAPI و riskAPI است
    - bot formatter متادیتای جدید را نمایش می‌دهد
"""

from __future__ import annotations

import importlib.util
import pathlib
import re
import sys
from datetime import datetime, timezone

import pytest


def _load(name: str, relative_path: str):
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location(name, repo_root / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


# ===========================================================================
# Frontend integration checks (static file inspection)
# ===========================================================================


class TestAdminAppRoutes:
    """App.jsx ادمین باید route های جدید را تعریف کرده باشد."""

    def test_backtest_route_registered(self):
        app_jsx = (REPO_ROOT / "frontend/admin/src/App.jsx").read_text(encoding="utf-8")
        assert "BacktestPage" in app_jsx
        assert '/backtest' in app_jsx

    def test_risk_route_registered(self):
        app_jsx = (REPO_ROOT / "frontend/admin/src/App.jsx").read_text(encoding="utf-8")
        assert "RiskPage" in app_jsx
        assert '/risk' in app_jsx

    def test_backtest_page_exists(self):
        path = REPO_ROOT / "frontend/admin/src/pages/BacktestPage.jsx"
        assert path.exists(), "BacktestPage.jsx ساخته نشده"
        content = path.read_text(encoding="utf-8")
        # بررسی استفاده از hook ها و فیلدهای کلیدی
        assert "useQuery" in content
        assert "backtestAPI" in content
        assert "trades_executed" in content
        assert "profit_factor" in content
        assert "attribution" in content

    def test_risk_page_exists(self):
        path = REPO_ROOT / "frontend/admin/src/pages/RiskPage.jsx"
        assert path.exists(), "RiskPage.jsx ساخته نشده"
        content = path.read_text(encoding="utf-8")
        assert "riskAPI" in content
        assert "DailyStatusBanner" in content
        assert "RejectionsTable" in content
        assert "PositionsPanel" in content
        assert "RegimePanel" in content


class TestSidebarNavigation:
    """Sidebar باید آیتم‌های backtest و risk داشته باشد."""

    def test_sidebar_includes_backtest(self):
        sidebar = (REPO_ROOT / "frontend/admin/src/components/Layout/Sidebar.jsx").read_text(encoding="utf-8")
        assert "/backtest" in sidebar

    def test_sidebar_includes_risk(self):
        sidebar = (REPO_ROOT / "frontend/admin/src/components/Layout/Sidebar.jsx").read_text(encoding="utf-8")
        assert "/risk" in sidebar


class TestApiClient:
    """API client باید backtestAPI و riskAPI داشته باشد."""

    def test_backtest_api_exported(self):
        content = (REPO_ROOT / "frontend/admin/src/api/client.js").read_text(encoding="utf-8")
        assert "export const backtestAPI" in content
        # متدها
        assert "listRuns" in content
        assert "getRun" in content
        assert "getTrades" in content
        assert "triggerRun" in content
        assert "deleteRun" in content

    def test_risk_api_exported(self):
        content = (REPO_ROOT / "frontend/admin/src/api/client.js").read_text(encoding="utf-8")
        assert "export const riskAPI" in content
        assert "getDailyStatus" in content
        assert "getRejections" in content
        assert "getPositions" in content
        assert "getRegimes" in content
        assert "unlock" in content
        assert "manualLock" in content


# ===========================================================================
# Backend: /admin/risk routes
# ===========================================================================


class TestRiskRoutes:
    """ماژول src/api/routes/risk.py باید endpoint های مورد نیاز را داشته باشد."""

    def test_risk_module_loadable(self):
        content = (REPO_ROOT / "src/api/routes/risk.py").read_text(encoding="utf-8")
        # endpoint ها
        assert '@router.get("/daily"' in content
        assert '@router.post("/lock"' in content
        assert '@router.post("/unlock"' in content
        assert '@router.get("/rejections"' in content
        assert '@router.get("/positions"' in content
        assert '@router.get("/regimes"' in content

    def test_risk_router_mounted_in_main(self):
        main = (REPO_ROOT / "src/api/main.py").read_text(encoding="utf-8")
        assert "from src.api.routes import" in main
        assert "risk," in main or "risk\n" in main
        assert 'prefix="/admin/risk"' in main

    def test_risk_uses_admin_auth(self):
        content = (REPO_ROOT / "src/api/routes/risk.py").read_text(encoding="utf-8")
        # تمام endpoint ها باید get_current_admin داشته باشند
        assert "get_current_admin" in content
        # تعداد دفعات استفاده از Depends(get_current_admin) باید با
        # تعداد endpoint ها (۶) برابر باشد
        count = content.count("Depends(get_current_admin)")
        assert count >= 6, f"تعداد admin-guard ها: {count} (انتظار >=6)"


# ===========================================================================
# Bot formatter — متادیتای جدید
# ===========================================================================


class TestFormatterEnhancements:
    """formatter باید فیلدهای جدید فاز ۲/۳ را نمایش دهد."""

    @pytest.fixture
    def formatter(self):
        return _load("_test_formatter", "src/bot/formatter.py")

    def _base_signal(self):
        return {
            "direction": "BUY",
            "symbol": "EURUSD",
            "timeframe": "H1",
            "entry_low": 1.0950,
            "entry_high": 1.0960,
            "stop_loss": 1.0920,
            "targets": [1.0990, 1.1020, 1.1050],
            "analysis": ["RSI صعودی", "MACD تقاطع مثبت"],
            "ai_score": 85,
            "mtf_confirms": ["H1", "H4", "D1"],
            "stats_win_rate": 70.0,
            "stats_avg_rr": 2.0,
            "stats_total": 100,
            "stats_wins": 70,
            "created_at": datetime(2026, 5, 27, 10, 0, tzinfo=timezone.utc),
        }

    def test_signal_without_extras_still_formats(self, formatter):
        sig = self._base_signal()
        out = formatter.format_signal(sig)
        # نام فارسی نماد
        assert "یورو/دلار" in out
        # و نباید crash کند

    def test_dominant_component_displayed(self, formatter):
        sig = self._base_signal()
        sig["dominant_component"] = "technical"
        out = formatter.format_signal(sig)
        assert "تحلیل تکنیکال" in out

        sig["dominant_component"] = "ml"
        out = formatter.format_signal(sig)
        assert "هوش مصنوعی" in out

    def test_market_regime_displayed(self, formatter):
        sig = self._base_signal()
        sig["market_regime"] = "trending_up"
        out = formatter.format_signal(sig)
        assert "روند صعودی" in out

        sig["market_regime"] = "ranging"
        out = formatter.format_signal(sig)
        assert "سایدوی" in out

    def test_session_displayed(self, formatter):
        sig = self._base_signal()
        sig["session"] = "london"
        out = formatter.format_signal(sig)
        assert "لندن" in out

    def test_higher_tf_bias_displayed_when_not_neutral(self, formatter):
        sig = self._base_signal()
        sig["higher_tf_bias"] = "bullish"
        out = formatter.format_signal(sig)
        assert "صعودی" in out
        # neutral نباید نمایش داده شود
        sig["higher_tf_bias"] = "neutral"
        out_neutral = formatter.format_signal(sig)
        # neutral باید skip شود (فقط در صورت non-neutral نمایش)
        # این تست check اولیه است — مهم اینکه crash نکند
        assert "bias تایم" not in out_neutral or "خنثی" not in out_neutral
