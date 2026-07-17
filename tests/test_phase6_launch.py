"""
تست‌های فاز ۶ — paper trading، divergence، preflight، monitoring.

پوشش:
    - PaperTradingConfig و TradingMode
    - publish_signal در حالت‌های مختلف
    - DivergenceDetector تشخیص degradation
    - PreflightChecks
    - وجود monitoring files (alerts، dashboard)
    - وجود runbook و backup script
"""

from __future__ import annotations

import importlib.util
import pathlib
import sys
from dataclasses import dataclass

import pytest


def _load(name: str, relative_path: str):
    repo_root = pathlib.Path(__file__).resolve().parent.parent
    spec = importlib.util.spec_from_file_location(name, repo_root / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent

paper_mod = _load("_test_paper", "src/launch/paper_trading.py")
divergence_mod = _load("_test_divergence", "src/launch/divergence.py")


# ===========================================================================
# Paper Trading
# ===========================================================================


class TestTradingMode:
    def test_mode_enum_values(self):
        assert paper_mod.TradingMode.PAPER.value == "paper"
        assert paper_mod.TradingMode.LIVE.value == "live"
        assert paper_mod.TradingMode.DISABLED.value == "disabled"

    def test_default_config_is_paper(self):
        config = paper_mod.PaperTradingConfig()
        assert config.mode == paper_mod.TradingMode.PAPER

    def test_should_publish_to_users_true_only_in_live(self):
        live = paper_mod.PaperTradingConfig(mode=paper_mod.TradingMode.LIVE)
        paper = paper_mod.PaperTradingConfig(mode=paper_mod.TradingMode.PAPER)
        disabled = paper_mod.PaperTradingConfig(mode=paper_mod.TradingMode.DISABLED)

        assert paper_mod.should_publish_to_users(live) is True
        assert paper_mod.should_publish_to_users(paper) is False
        assert paper_mod.should_publish_to_users(disabled) is False

    def test_from_settings_unknown_mode_falls_back_to_paper(self):
        class FakeSettings:
            TRADING_MODE = "invalid_mode"
            BETA_CHANNEL_ID = None
        config = paper_mod.PaperTradingConfig.from_settings(FakeSettings())
        assert config.mode == paper_mod.TradingMode.PAPER

    def test_from_settings_reads_live(self):
        class FakeSettings:
            TRADING_MODE = "live"
            BETA_CHANNEL_ID = "@beta_channel"
        config = paper_mod.PaperTradingConfig.from_settings(FakeSettings())
        assert config.mode == paper_mod.TradingMode.LIVE
        assert config.beta_channel_id == "@beta_channel"


class TestPublishSignal:
    class FakeRedisClient:
        def __init__(self):
            self.json_keys = {}
            self.published = []
            self.active_signals = {}

        async def set_json(self, key, data, expire=None):
            self.json_keys[key] = data

        async def publish(self, channel, data):
            self.published.append((channel, data))

        async def set_active_signal(self, sid, data):
            self.active_signals[sid] = data

    @pytest.mark.asyncio
    async def test_disabled_mode_does_nothing(self):
        config = paper_mod.PaperTradingConfig(mode=paper_mod.TradingMode.DISABLED)
        client = self.FakeRedisClient()
        result = await paper_mod.publish_signal(
            config, client, {"id": 1, "symbol": "EURUSD"}, public_channel_id="@chan",
        )
        assert result["published"] is False
        assert len(client.published) == 0
        assert len(client.active_signals) == 0

    @pytest.mark.asyncio
    async def test_paper_mode_persists_in_paper_namespace(self):
        config = paper_mod.PaperTradingConfig(
            mode=paper_mod.TradingMode.PAPER,
            beta_channel_id="@beta",
        )
        client = self.FakeRedisClient()
        result = await paper_mod.publish_signal(
            config, client, {"id": 42, "symbol": "EURUSD"},
            public_channel_id="@public",
        )
        assert result["mode"] == "paper"
        # ذخیره در paper namespace، نه signal:active
        assert "paper:active:42" in client.json_keys
        assert 42 not in client.active_signals
        # is_paper=true flag در داده
        assert client.json_keys["paper:active:42"]["is_paper"] is True

    @pytest.mark.asyncio
    async def test_live_mode_persists_in_live_namespace(self):
        config = paper_mod.PaperTradingConfig(mode=paper_mod.TradingMode.LIVE)
        client = self.FakeRedisClient()
        result = await paper_mod.publish_signal(
            config, client, {"id": 99, "symbol": "EURUSD"},
            public_channel_id="@public",
        )
        assert result["mode"] == "live"
        assert 99 in client.active_signals
        assert client.active_signals[99]["is_paper"] is False


# ===========================================================================
# Divergence Detector
# ===========================================================================


@dataclass
class _FakeMetrics:
    total_trades: int = 0
    win_rate: float = 0.0
    profit_factor: float = 0.0
    expectancy_r: float = 0.0
    sharpe_ratio: float = 0.0
    avg_net_pips: float = 0.0


class TestDivergence:
    def test_insufficient_paper_trades_returns_wait(self):
        paper = _FakeMetrics(total_trades=5, win_rate=0.4)
        backtest = _FakeMetrics(total_trades=100, win_rate=0.6)
        report = divergence_mod.compare_paper_with_backtest(
            paper, backtest, paper_period_days=7, min_paper_trades=20,
        )
        assert report.recommendation == "wait_for_more_data"
        assert any("paper trades" in n for n in report.notes)

    def test_paper_matches_backtest_proceed(self):
        paper = _FakeMetrics(
            total_trades=50, win_rate=0.60, profit_factor=1.8,
            expectancy_r=0.3, sharpe_ratio=1.2, avg_net_pips=15.0,
        )
        backtest = _FakeMetrics(
            total_trades=200, win_rate=0.62, profit_factor=1.9,
            expectancy_r=0.32, sharpe_ratio=1.25, avg_net_pips=16.0,
        )
        report = divergence_mod.compare_paper_with_backtest(
            paper, backtest, paper_period_days=14,
        )
        assert report.overall_degraded is False
        assert report.recommendation in ("proceed_with_launch", "proceed_with_caution")

    def test_significant_degradation_blocks_launch(self):
        # paper بسیار بدتر از backtest
        paper = _FakeMetrics(
            total_trades=50, win_rate=0.35, profit_factor=0.7,
            expectancy_r=-0.2, sharpe_ratio=-0.5, avg_net_pips=-5.0,
        )
        backtest = _FakeMetrics(
            total_trades=200, win_rate=0.65, profit_factor=2.0,
            expectancy_r=0.35, sharpe_ratio=1.5, avg_net_pips=18.0,
        )
        report = divergence_mod.compare_paper_with_backtest(
            paper, backtest, paper_period_days=14,
        )
        assert report.overall_degraded is True
        assert report.recommendation == "block_launch"

    def test_per_metric_direction_labels(self):
        paper = _FakeMetrics(
            total_trades=50, win_rate=0.50, profit_factor=1.5,
            expectancy_r=0.1, sharpe_ratio=0.8, avg_net_pips=10.0,
        )
        backtest = _FakeMetrics(
            total_trades=200, win_rate=0.55, profit_factor=1.6,
            expectancy_r=0.11, sharpe_ratio=0.85, avg_net_pips=11.0,
        )
        report = divergence_mod.compare_paper_with_backtest(
            paper, backtest, paper_period_days=14,
        )
        # تمام متریک‌ها در محدوده‌ی تحمل هستند
        for m in report.metrics:
            assert m.direction in ("improved", "degraded", "unchanged")


# ===========================================================================
# Preflight Checks
# ===========================================================================


class TestPreflightChecks:
    def test_runbook_check_passes_when_file_exists(self):
        # ما در فاز ۶ runbook را ساخته‌ایم
        preflight = _load("_test_preflight", "src/launch/preflight.py")
        result = preflight.check_runbook_exists()
        assert result.status == preflight.CheckStatus.PASS, \
            f"runbook check باید pass باشد: {result.detail}"

    def test_backup_script_check_passes(self):
        preflight = _load("_test_preflight2", "src/launch/preflight.py")
        result = preflight.check_backup_script_exists()
        assert result.status == preflight.CheckStatus.PASS

    def test_monitoring_check_passes(self):
        preflight = _load("_test_preflight3", "src/launch/preflight.py")
        result = preflight.check_monitoring_active()
        # alerts.yml و prometheus.yml باید موجود باشند
        assert result.status == preflight.CheckStatus.PASS, \
            f"monitoring check: {result.detail}"

    def test_check_levels_enum(self):
        preflight = _load("_test_preflight4", "src/launch/preflight.py")
        assert preflight.CheckLevel.CRITICAL.value == "critical"
        assert preflight.CheckLevel.WARNING.value == "warning"

    def test_preflight_result_blocks_when_critical_fails(self):
        preflight = _load("_test_preflight5", "src/launch/preflight.py")
        result = preflight.PreflightResult()
        result.checks.append(preflight.PreflightCheck(
            "test_critical", preflight.CheckLevel.CRITICAL,
            preflight.CheckStatus.FAIL, "intentional fail"
        ))
        assert result.is_ready_for_launch is False

    def test_preflight_result_ready_when_only_warnings_fail(self):
        preflight = _load("_test_preflight6", "src/launch/preflight.py")
        result = preflight.PreflightResult()
        result.checks.append(preflight.PreflightCheck(
            "test_warn", preflight.CheckLevel.WARNING,
            preflight.CheckStatus.FAIL, "warning only"
        ))
        result.checks.append(preflight.PreflightCheck(
            "test_critical", preflight.CheckLevel.CRITICAL,
            preflight.CheckStatus.PASS,
        ))
        assert result.is_ready_for_launch is True


# ===========================================================================
# Monitoring & Documentation files
# ===========================================================================


class TestMonitoringFiles:
    def test_alerts_yml_exists(self):
        path = REPO_ROOT / "monitoring/alerts.yml"
        assert path.exists(), "monitoring/alerts.yml باید موجود باشد"
        content = path.read_text(encoding="utf-8")
        assert "AllDataFeedsDown" in content
        assert "SystemLockedDueToDailyLoss" in content
        assert "PaperVsBacktestDegradation" in content

    def test_grafana_dashboard_exists(self):
        path = REPO_ROOT / "monitoring/grafana/dashboards/risk_overview.json"
        assert path.exists(), "Grafana dashboard ساخته نشده"
        # دست‌کم JSON معتبر
        import json
        data = json.loads(path.read_text(encoding="utf-8"))
        assert "panels" in data
        assert len(data["panels"]) >= 4


class TestDocumentation:
    def test_runbook_exists(self):
        path = REPO_ROOT / "docs/RUNBOOK.md"
        assert path.exists()
        content = path.read_text(encoding="utf-8")
        # سرفصل‌های اصلی
        assert "Circuit Breaker" in content or "قفل شد" in content
        assert "data feed" in content.lower()
        assert "backup" in content.lower()
        assert "Paper trading" in content or "paper" in content.lower()

    def test_backup_script_exists_and_is_executable(self):
        import os
        path = REPO_ROOT / "scripts/backup.sh"
        assert path.exists()
        # روی Linux، executable bit
        assert os.access(path, os.X_OK), "backup.sh executable نیست"
        content = path.read_text(encoding="utf-8")
        assert "pg_dump" in content
        assert "models" in content
        assert "RETENTION_DAYS" in content


# ===========================================================================
# Integration: metrics و config
# ===========================================================================


class TestNewMetrics:
    def test_phase6_metrics_defined(self):
        # ماژول core.metrics باید گیج‌ها/کاونتر های فاز ۶ را داشته باشد
        content = (REPO_ROOT / "src/core/metrics.py").read_text(encoding="utf-8")
        assert "risk_rejections_total" in content
        assert "daily_pnl_dollar" in content
        assert "system_locked" in content
        assert "market_regime" in content
        assert "trading_mode" in content
        assert "paper_signals_generated" in content
        assert "paper_vs_live_divergence" in content


class TestConfigTradingMode:
    def test_trading_mode_in_settings(self):
        content = (REPO_ROOT / "src/core/config.py").read_text(encoding="utf-8")
        assert "TRADING_MODE" in content
        assert "BETA_CHANNEL_ID" in content
        # پیش‌فرض amن: paper
        assert '"paper"' in content
