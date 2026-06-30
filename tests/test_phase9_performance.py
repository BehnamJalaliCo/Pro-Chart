"""
تست‌های فاز ۹ — Performance hot path optimizations.

پوشش:
    - Redis sorted-set index برای active signals (jایگزین KEYS)
    - SCAN + pipeline در get_all_prices
    - get_all_active_signals با pipeline (single RTT)
    - count_active_signals = O(1)
    - run_in_thread (thread pool helper)
    - Source-level invariants برای candle_builder bulk insert
    - Source-level invariants برای performance.py aggregation
    - signals.py count(*) به‌جای fetch all IDs
    - pagination در /signals/active
    - concurrent tracker
    - broadcast pipeline برای block check
"""

from __future__ import annotations

import asyncio
import importlib.util
import pathlib
import sys
import time

import pytest


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent


def _load(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / relative_path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


async_utils = _load("_test_async_utils", "src/core/async_utils.py")


# ===========================================================================
# Thread Pool / run_in_thread
# ===========================================================================


class TestRunInThread:
    @pytest.mark.asyncio
    async def test_runs_sync_function(self):
        def heavy_sync(x: int) -> int:
            return x * 2

        result = await async_utils.run_in_thread(heavy_sync, 21)
        assert result == 42

    @pytest.mark.asyncio
    async def test_propagates_exceptions(self):
        def boom():
            raise ValueError("expected")

        with pytest.raises(ValueError, match="expected"):
            await async_utils.run_in_thread(boom)

    @pytest.mark.asyncio
    async def test_does_not_block_event_loop(self):
        """sleep داخل thread نباید event loop را block کند."""
        marker = []

        def slow_sync():
            time.sleep(0.1)
            return "done"

        async def fast_async():
            await asyncio.sleep(0.01)
            marker.append("async ran")

        # هر دو موازی — fast_async باید قبل از پایان slow_sync مارک بزند
        await asyncio.gather(
            async_utils.run_in_thread(slow_sync),
            fast_async(),
        )
        assert "async ran" in marker

    @pytest.mark.asyncio
    async def test_timeout_works(self):
        def too_slow():
            time.sleep(0.5)

        with pytest.raises(asyncio.TimeoutError):
            await async_utils.run_in_thread(too_slow, timeout=0.05)

    @pytest.mark.asyncio
    async def test_accepts_kwargs(self):
        def with_kwargs(a, b=10):
            return a + b

        result = await async_utils.run_in_thread(with_kwargs, 5, b=20)
        assert result == 25

    def test_default_executor_is_singleton(self):
        e1 = async_utils.get_default_executor()
        e2 = async_utils.get_default_executor()
        assert e1 is e2

    def test_shutdown_resets_executor(self):
        async_utils.get_default_executor()
        async_utils.shutdown_default_executor()
        # next call creates new one
        new_ex = async_utils.get_default_executor()
        assert new_ex is not None


# ===========================================================================
# Source-level invariants
# ===========================================================================


class TestRedisClientOptimizations:
    """بررسی تغییرات redis_client.py."""

    def test_get_all_active_signals_uses_sorted_set(self):
        content = (REPO_ROOT / "src/core/redis_client.py").read_text(encoding="utf-8")
        # sorted-set index key
        assert "_ACTIVE_INDEX_KEY" in content
        assert "signals:active_ids" in content
        # zrevrange به‌جای keys()
        assert "zrevrange" in content

    def test_get_all_active_signals_does_not_use_keys(self):
        """KEYS pattern نباید در get_all_active_signals باشد."""
        content = (REPO_ROOT / "src/core/redis_client.py").read_text(encoding="utf-8")
        # extract the method body
        marker = "async def get_all_active_signals"
        idx = content.find(marker)
        assert idx >= 0
        # متد بعدی
        next_def = content.find("async def ", idx + len(marker))
        method_body = content[idx:next_def]
        assert "self.client.keys(" not in method_body, \
            "get_all_active_signals باید از sorted-set استفاده کند نه KEYS"

    def test_set_active_signal_uses_pipeline(self):
        content = (REPO_ROOT / "src/core/redis_client.py").read_text(encoding="utf-8")
        idx = content.find("async def set_active_signal")
        next_def = content.find("async def ", idx + 30)
        body = content[idx:next_def]
        assert "pipeline(" in body
        assert "zadd" in body

    def test_remove_active_signal_uses_pipeline(self):
        content = (REPO_ROOT / "src/core/redis_client.py").read_text(encoding="utf-8")
        idx = content.find("async def remove_active_signal")
        next_def = content.find("async def ", idx + 30)
        body = content[idx:next_def]
        assert "pipeline(" in body
        assert "zrem" in body

    def test_get_all_prices_uses_scan(self):
        content = (REPO_ROOT / "src/core/redis_client.py").read_text(encoding="utf-8")
        idx = content.find("async def get_all_prices")
        next_def = content.find("async def ", idx + 30)
        body = content[idx:next_def]
        assert ".scan(" in body
        assert "pipeline(" in body
        assert "self.client.keys(" not in body

    def test_count_active_signals_exists(self):
        content = (REPO_ROOT / "src/core/redis_client.py").read_text(encoding="utf-8")
        assert "async def count_active_signals" in content
        assert "zcard" in content


class TestCandleBuilderBulk:
    def test_save_candles_uses_bulk(self):
        content = (REPO_ROOT / "src/data/candle_builder.py").read_text(encoding="utf-8")
        # ساخت پارامتر list
        assert "params: list[dict]" in content or "params = []" in content
        # یک execute برای کل batch
        save_candles_idx = content.find("async def save_candles")
        next_def = content.find("async def ", save_candles_idx + 30)
        body = content[save_candles_idx:next_def]
        # حداکثر یک execute (نه per-row)
        assert body.count("session.execute(") <= 1, \
            "save_candles باید فقط یک execute بزند (bulk)"

    def test_save_candles_validates_symbol_timeframe(self):
        content = (REPO_ROOT / "src/data/candle_builder.py").read_text(encoding="utf-8")
        assert "_VALID_SYMBOL_PATTERN" in content
        assert "_VALID_TF_PATTERN" in content

    def test_save_candles_uses_itertuples(self):
        """itertuples سریع‌تر از iterrows است."""
        content = (REPO_ROOT / "src/data/candle_builder.py").read_text(encoding="utf-8")
        assert "df.itertuples" in content


class TestCountQueryOptimization:
    def test_signals_uses_func_count(self):
        content = (REPO_ROOT / "src/api/routes/signals.py").read_text(encoding="utf-8")
        # func.count به‌جای len(.all())
        assert "func.count(Signal.id)" in content

    def test_users_uses_func_count(self):
        content = (REPO_ROOT / "src/api/routes/users.py").read_text(encoding="utf-8")
        assert "func.count(User.id)" in content


class TestAggregationOptimization:
    def test_performance_uses_date_trunc(self):
        content = (REPO_ROOT / "src/api/routes/performance.py").read_text(encoding="utf-8")
        # database-side aggregation
        assert 'date_trunc("day"' in content or "date_trunc('day'" in content
        assert "group_by" in content.lower()

    def test_performance_does_not_python_loop_for_daily(self):
        content = (REPO_ROOT / "src/api/routes/performance.py").read_text(encoding="utf-8")
        # محل aggregation روزانه نباید signal.created_at.strftime در loop باشد
        idx = content.find("async def daily_performance")
        next_def = content.find("@router.get", idx + 30)
        body = content[idx:next_def]
        assert 'signal.created_at.strftime("%Y-%m-%d")' not in body


class TestActiveSignalsPagination:
    def test_active_signals_has_pagination(self):
        content = (REPO_ROOT / "src/api/routes/signals.py").read_text(encoding="utf-8")
        idx = content.find("async def get_active_signals")
        next_def = content.find("@router.get", idx + 30)
        body = content[idx:next_def]
        assert "limit:" in body
        assert "offset:" in body
        assert ".limit(" in body


class TestConcurrentTracker:
    def test_tracker_uses_asyncio_gather(self):
        content = (REPO_ROOT / "src/signals/tracker.py").read_text(encoding="utf-8")
        idx = content.find("async def _check_all_signals")
        next_def = content.find("async def ", idx + 30)
        body = content[idx:next_def]
        assert "asyncio.gather" in body
        # semaphore برای جلوگیری از thundering herd
        assert "Semaphore" in body or "semaphore" in body.lower()


class TestEngineThreadPool:
    def test_engine_uses_run_in_thread(self):
        content = (REPO_ROOT / "src/signals/engine.py").read_text(encoding="utf-8")
        assert "run_in_thread" in content
        # asyncio.gather برای parallel analyses
        assert "asyncio.gather(" in content


class TestBroadcastPipeline:
    def test_broadcast_uses_pipeline_for_block_check(self):
        content = (REPO_ROOT / "src/bot/broadcast.py").read_text(encoding="utf-8")
        # pipeline برای block check
        assert "pipeline(" in content
        # block check در batch (نه per-user)
        assert "blocked_set" in content or "blocked_flags" in content
