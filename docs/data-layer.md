[⬅ 2. System Architecture & Service Topology](architecture.md) · [🏠 Home · خانه](../README.md) · [4. Market Analysis Engine ➡](market-analysis.md)

---

## 3. The Data Layer — Ingestion, Time-Series Storage & Caching

> *Every signal CoinePro-FX ever publishes is only as trustworthy as the candle it was computed on.* This chapter documents — exhaustively — how raw market data enters the system, how it is validated, where it is cached for millisecond reads, how it is persisted as a queryable time series, and **why** each engineering decision was made. The data layer lives almost entirely in [`src/data/`](../src/data/), [`src/core/redis_client.py`](../src/core/redis_client.py), and the candle/tick portions of [`src/core/database.py`](../src/core/database.py) + [`alembic/versions/001_initial_schema.py`](../alembic/versions/001_initial_schema.py).

### 3.0 Bird's-eye view

```
                         ┌──────────────────────────────────────────────┐
                         │              DataFeedManager                  │
   ┌──────────┐         │  (src/data/feed_manager.py — singleton)        │
   │ MT5      │◀──┐     │                                                │
   ├──────────┤   │     │   _health_check_loop()   every 300s            │
   │ OANDA    │◀──┼─────│   _price_update_loop()   every  30s            │
   ├──────────┤   │     │   _candle_update_loop()  every 300s            │
   │ TwelveD. │◀──┤     │   failover chain (asyncio.Lock-guarded)        │
   ├──────────┤   │     └───────────────┬───────────────┬───────────────┘
   │ yfinance │◀──┘                     │ ticks         │ candles
   └──────────┘                         ▼               ▼
        ▲                       ┌───────────────┐  ┌────────────────────┐
        │ get_candles/get_tick  │  Redis        │  │  TimescaleDB        │
        │ (validated)           │  price:{sym}  │  │  candles / ticks    │
        └───────────────────────│  TTL=600s     │  │  (hypertables)      │
                                │  pub/sub      │  │  compress+retention │
                                └───────┬───────┘  └────────────────────┘
                                        │ publish("price_updates", tick)
                                        ▼
                                 WebSocket clients / "Market status"
```

There are **two independent persistence targets** with very different access patterns:

| Target | Holds | Access pattern | Lifetime |
|---|---|---|---|
| **Redis** | latest tick per symbol (`price:{symbol}`), live pub/sub fan-out, service health | O(1) hot read, sub-millisecond, ephemeral | seconds (TTL) |
| **TimescaleDB** | closed OHLCV candles + raw ticks, multi-timeframe | range scans, ordered history, analytics | up to 2 years (candles) / 90 days (ticks) |

Redis answers *"what is the price right now?"*. TimescaleDB answers *"what did EURUSD H1 do over the last 200 bars?"*. The signal engine reads the latter; the website/WebSocket reads the former.

---

### 3.1 The `DataFeedManager` — orchestration & failover

The manager ([`feed_manager.py`](../src/data/feed_manager.py)) is a **singleton** (`feed_manager = DataFeedManager()`, line 292) that owns one instance of every connector and runs the three background loops.

#### 3.1.1 The source priority chain

```python
# feed_manager.py:30-41
self.mt5 = MT5Connector()
self.oanda = OandaConnector()
self.twelvedata = TwelveDataConnector()
self.yfinance = YFinanceConnector()

# ترتیب اولویت — فقط yfinance فعال است (به‌درخواست کاربر؛ twelvedata به‌خاطر
# تمام‌شدن اعتبار API قطع شد و mt5/oanda در این محیط متصل نمی‌شوند ...)
self._sources = [
    ("yfinance", self.yfinance),
]
self._active_source: str = "yfinance"
```

All four connectors are **constructed**, but only `yfinance` is wired into the live `_sources` chain. **Why?**

- **TwelveData** ran out of free API credits (the free tier is **750 credits/day**, `TWELVEDATA_DAILY_CREDIT_LIMIT = 750` in [`config.py:222`](../src/core/config.py)). Once exhausted it would only add failed requests and latency.
- **MT5 / OANDA** require a connected terminal / authenticated account that is not present in this deployment environment. Keeping them in the chain would generate continuous connection errors and pointless failover churn.
- The other connectors are deliberately **left built** so re-enabling a richer source later is a one-line change to `_sources` — the failover machinery, the validators, and the persistence path are all source-agnostic.

The intended *full* priority ordering (encoded in the candle `ON CONFLICT` resolution, §3.6) is **mt5 → oanda → twelvedata → yfinance**: broker-direct data first (real executable prices, real volume), aggregator second, free retail feed last.

#### 3.1.2 Two start modes

```python
# feed_manager.py:47   connect_sources() — connect only, no loops
# feed_manager.py:67   start()           — connect + run all three loops
```

`connect_sources()` exists for processes (e.g. the **signal engine**) that need live `get_candles()` but must **not** run the price/candle/health loops — otherwise multiple processes would double-write Redis and TimescaleDB. `start()` is for the dedicated data-feed service and fans out via `asyncio.gather`:

```python
# feed_manager.py:80-84
await asyncio.gather(
    self._health_check_loop(),
    self._price_update_loop(),
    self._candle_update_loop(),
)
```

#### 3.1.3 Health-check loop & failover

```python
# feed_manager.py:94-124 (abridged)
async def _health_check_loop(self) -> None:
    while self._running:
        statuses = {}
        for name, connector in self._sources:
            healthy = await connector.health_check()
            statuses[name] = healthy
            data_feed_status.labels(source=name).set(1 if healthy else 0)
            await redis_client.set_service_status(
                f"datafeed_{name}", {"healthy": healthy, "timestamp": time.time()})
        if not statuses.get(self._active_source, False):
            active_conn = dict(self._sources).get(self._active_source)
            if active_conn is not None:
                active_conn._connected = False   # ← invalidate stale flag
            await self._failover()
        await asyncio.sleep(self._health_check_interval)   # 300s
```

Two correctness details worth highlighting:

1. **Stale-flag invalidation** (line 116): before calling `_failover()`, the dead source's `_connected` is forced to `False`. Without this, `_failover()` reading a cached `is_connected == True` could *re-select the very source that just failed health-check*.
2. **`asyncio.Lock`-guarded failover** ([`_failover`, line 126](../src/data/feed_manager.py), `self._failover_lock`): if two health checks fire concurrently and both observe the active source down, only one performs the switch. The other re-checks **inside** the lock (lines 137-140) and returns early if the source is already healthy again, preventing a double-switch to different sources.

The failover algorithm degrades gracefully:

```
1. Try the next already-connected source in priority order.
2. If none connected, attempt a fresh connect() on each in order.
3. If everything fails → logger.critical("all_data_feeds_down").
```

Health status is also mirrored into Redis as `service:datafeed_{name}` (TTL 120s, §3.4) so dashboards/the admin panel can render per-source health without touching Prometheus.

#### 3.1.4 The price-update loop

```python
# feed_manager.py:230-248
async def _price_update_loop(self) -> None:
    while self._running:
        tasks = [self._update_price(s) for s in settings.SYMBOLS]
        await asyncio.gather(*tasks, return_exceptions=True)
        await asyncio.sleep(settings.PRICE_UPDATE_INTERVAL_SECONDS)   # 30s

async def _update_price(self, symbol: str) -> None:
    tick = await self.get_tick(symbol)
    if tick:
        await redis_client.set_price(symbol, tick)
        await redis_client.publish("price_updates", tick)
```

Every **30 seconds** ([`PRICE_UPDATE_INTERVAL_SECONDS = 30`](../src/core/config.py)) the loop fetches a fresh tick for **all 19 symbols concurrently**, writes each to `price:{symbol}`, and publishes it on the `price_updates` pub/sub channel. `return_exceptions=True` guarantees that one symbol's failure never aborts the batch.

> **Note on the docstring drift:** the method docstring still reads *"هر ۲ ثانیه"* (every 2s) — a relic of an earlier tuning. The authoritative value is `PRICE_UPDATE_INTERVAL_SECONDS = 30`, deliberately raised from the old `300` precisely so the live price refreshes far faster than its Redis TTL can expire it (see §3.3).

#### 3.1.5 The candle-update loop

```python
# feed_manager.py:250-272
async def _candle_update_loop(self) -> None:
    while self._running:
        for symbol in settings.SYMBOLS:
            for tf in settings.TIMEFRAMES:        # M5, M15, H1, H4, D1
                try:
                    df, source = await self.get_candles_with_source(symbol, tf, count=5)
                    if df is not None and not df.empty:
                        async with async_session_factory() as session:
                            await CandleBuilder.save_candles(
                                session, symbol, tf, df, source or self._active_source)
                except Exception as e:
                    logger.error("candle_update_loop_error", symbol=symbol, timeframe=tf, error=str(e))
            await asyncio.sleep(0.5)              # gap between symbols → anti rate-limit
        await asyncio.sleep(settings.CANDLE_UPDATE_INTERVAL_SECONDS)   # 300s
```

Design decisions:

- **`count=5`, not 200.** The loop only needs the *latest few* closed candles each cycle; the historical backfill is handled on demand by the engine. Pulling 5 minimises bandwidth and API cost while the `ON CONFLICT … DO UPDATE` upsert (§3.6) keeps the table consistent.
- **`try/except per (symbol, timeframe)`** — one DB error or one bad symbol must not abort the entire sweep across 19 symbols × 5 timeframes.
- **`await asyncio.sleep(0.5)` between symbols** — a deliberate throttle so a free feed isn't hammered with a burst of requests and rate-limited.
- **Source label is the *real* returning source** — `get_candles_with_source` returns the name of whichever connector actually produced the data (it may have silently fallen back), so the persisted `source` column is accurate rather than just echoing `_active_source`.

#### 3.1.6 `get_candles_with_source` — silent fallback, quality gate

```python
# feed_manager.py:165-198 (abridged)
ordered = sorted(self._sources, key=lambda nc: 0 if nc[0] == self._active_source else 1)
for name, connector in ordered:
    if not connector.is_connected:
        continue
    df = await connector.get_candles(symbol, timeframe, count)
    if df is not None and not df.empty:
        from src.data.candle_quality import validate_candles
        validate_candles(df, symbol, timeframe)   # warn-only, never blocks
        return df, name
return None, None
```

The active source is tried first, then the rest by priority. Crucially, **quality validation is warn-only** — `validate_candles` logs/metrics problems but **never** drops the data or blocks a signal (§3.5). The philosophy: a stale-but-present feed is better than a dark one; consumers carry timestamps and decide staleness themselves.

#### 3.1.7 `get_tick` — multi-source best-price selection

```python
# feed_manager.py:210-228 (abridged)
ticks = []
for name, connector in self._sources:
    tick = await connector.get_tick(symbol)
    if tick and DataValidator.validate_tick(tick):
        ticks.append(tick)
        if name == self._active_source:
            break
return DataValidator.select_best_price(symbol, ticks)
```

Each candidate tick is validated *before* being collected, and the final choice goes through `select_best_price` (§3.5), which — when multiple sources are live — averages the bids and returns the one closest to the mean, cross-checking the rest.

---

### 3.2 The connectors

Every connector implements the **same duck-typed interface**, which is exactly what lets the manager treat them interchangeably:

```python
async def connect() -> bool
async def disconnect() -> None
is_connected -> bool            # property
async def health_check() -> bool
async def get_candles(symbol, timeframe, count=200) -> Optional[pd.DataFrame]
async def get_tick(symbol) -> Optional[dict]
```

Each returns candles as a normalized `pandas.DataFrame` with columns `[timestamp(UTC), open, high, low, close, volume]`, and ticks as a dict `{symbol, bid, ask, last, volume, timestamp(ISO), source}`. Every connector also feeds three Prometheus metrics: `data_feed_status{source}`, `data_feed_latency{source}`, `data_feed_errors{source}`.

| Connector | File | Symbol fmt | Auth | Notable |
|---|---|---|---|---|
| **MT5** | [`mt5_connector.py`](../src/data/mt5_connector.py) | `XAUUSD` | terminal login | broker-direct, real `tick_volume`, `copy_rates_from_pos`, `copy_ticks_range` |
| **OANDA** | [`oanda_connector.py`](../src/data/oanda_connector.py) | `XAU_USD` | Bearer token | v20 REST, `price=MBA`, drops `complete=false` candles |
| **TwelveData** | [`twelvedata_connector.py`](../src/data/twelvedata_connector.py) | `XAU/USD` | API key | daily credit budget guard |
| **yfinance** | [`yfinance_connector.py`](../src/data/yfinance_connector.py) | `GC=F` / `EURUSD=X` | none | the only live source; curl_cffi impersonation, H4 resampling |

#### 3.2.1 yfinance — the live backbone

yfinance is free and keyless, which is exactly why it's the production source — and exactly why it needs the most defensive code.

**(a) Bot-block evasion with `curl_cffi`.** Yahoo aggressively blocks plain HTTP clients. The connector impersonates Chrome's TLS fingerprint:

```python
# yfinance_connector.py:62-69
self._session = None
if _CURL_CFFI_AVAILABLE:
    try:
        self._session = _cffi_requests.Session(impersonate="chrome")
    except Exception:
        self._session = None
```

Without this, older yfinance versions raised `JSONDecodeError` as Yahoo returned an HTML challenge page instead of JSON.

**(b) Blocking I/O off the event loop.** yfinance is synchronous, so every call is wrapped in `run_in_executor` so it never blocks the asyncio loop:

```python
# yfinance_connector.py:128-137
df = await asyncio.get_event_loop().run_in_executor(
    None,
    lambda: yf.download(yf_symbol, period=yf_period, interval=yf_interval,
                        progress=False, session=self._session),
)
```

**(c) Three lookup maps** ([lines 25-46](../src/data/yfinance_connector.py)) translate the internal contract:
- `YF_SYMBOL_MAP` — `XAUUSD→GC=F` (gold *futures*), `EURUSD→EURUSD=X` (FX), `US30→YM=F` (index futures), `DE40→^GDAXI`.
- `YF_INTERVAL_MAP` — note **`H4→1h`**: yfinance has no native 4h bar, so we pull 1h and resample.
- `YF_PERIOD_MAP` — caps how far back we ask (`M1→7d`, `H1→730d`, …) to respect yfinance's per-interval history limits.

**(d) H4 synthesis by resampling** ([lines 182-194](../src/data/yfinance_connector.py)):

```python
if timeframe == "H4":
    df = (df.set_index("timestamp")
            .resample("4h", label="left", closed="left")
            .agg({"open":"first","high":"max","low":"min","close":"last","volume":"sum"})
            .dropna().reset_index())
    if len(df) > 1:
        df = df.iloc[1:].reset_index(drop=True)   # drop epoch-misaligned first bucket
```

Because pandas `resample` aligns to the epoch, the first 4h bucket can be partial (the 1h data doesn't start exactly on a 4h boundary). That first bar is dropped.

**(e) Look-ahead protection** — the single most important correctness guard:

```python
# yfinance_connector.py:196-202
delta = _TF_DELTA.get(timeframe)
if delta is not None and len(df) > 0:
    now = datetime.now(timezone.utc)
    if df["timestamp"].iloc[-1] + delta > now:
        df = df.iloc[:-1]      # drop the still-forming candle
```

If the last candle's interval hasn't fully elapsed, it is **still forming** and its OHLC will change. Feeding it to the analysis engine is *look-ahead bias* — the model would "see" a close that hasn't happened. The connector removes it unconditionally.

**(f) Ticks via `fast_info`** ([lines 213-237](../src/data/yfinance_connector.py)) — `last_price` becomes both bid and ask (yfinance has no real spread), tagged `source: "yfinance"`.

#### 3.2.2 TwelveData — the credit-budgeted source

The free tier allows **750 credits/day**. The connector implements a full client-side **budget guard** so it self-disables and yields to failover *before* the API hard-fails:

```python
# twelvedata_connector.py:52-78 (abridged)
def _budget_ok(self) -> bool:
    today = datetime.now(timezone.utc).date()
    if today != self._credit_date:           # auto-reset at UTC midnight
        self._credit_date = today
        self._credits_used = 0
        self._budget_warned = False
    if self._credits_used >= settings.TWELVEDATA_DAILY_CREDIT_LIMIT:
        ...                                   # warn once, then refuse
        return False
    return True

def _mark_exhausted(self) -> None:           # on "run out of API credits"
    self._credits_used = settings.TWELVEDATA_DAILY_CREDIT_LIMIT
    self._connected = False
```

Two layers of protection: **proactive** (`_budget_ok` refuses calls once `_credits_used` hits the limit, with an automatic UTC-midnight reset) and **reactive** (if the API itself replies *"run out of API credits"*, `_mark_exhausted` instantly flips the source to unhealthy so `_failover` routes around it). The `health_check` (lines 140-170) also **skips spending a credit** if a successful request happened within `HEALTH_CHECK_INTERVAL × 2` — it optimistically assumes health rather than burning budget on probes.

#### 3.2.3 OANDA — broker-grade REST

OANDA v20 gives real bid/ask. Key behaviours:
- `price=MBA` requests Mid/Bid/Ask; candles use the **mid** OHLC ([line 151](../src/data/oanda_connector.py)).
- **`complete=false` candles are skipped** ([line 149](../src/data/oanda_connector.py)) — OANDA's own look-ahead guard, equivalent to yfinance's still-forming drop.
- Environment-aware base URL: `api-fxpractice` vs `api-fxtrade` via `OANDA_ENVIRONMENT` (default `"practice"`).
- Tick `last` is computed as `(bid+ask)/2`.

#### 3.2.4 MT5 — broker-direct, real volume

MT5 is the *intended* top-priority source. It returns true `tick_volume` and supports tick-range history (`copy_ticks_range`) used by the backtester. The import itself is guarded:

```python
# mt5_connector.py:20-35
try:
    import MetaTrader5 as mt5
    TF_MAP = { "M1": mt5.TIMEFRAME_M1, ... "MN1": mt5.TIMEFRAME_MN1 }
except ImportError:
    mt5 = None
    logger.warning("mt5_not_available", ...)
```

So the module imports cleanly on a Linux server with no MT5 installed — every method short-circuits on `mt5 is None`. All synchronous MT5 calls run via `run_in_executor`.

---

### 3.3 The live-price Redis schema (the `price:{symbol}` story)

The single most subtle decision in the whole layer is the **TTL on `price:{symbol}`**. It lives here:

```python
# redis_client.py:70-77
async def set_price(self, symbol: str, price_data: dict) -> None:
    """ذخیره قیمت لحظه‌ای — TTL باید بزرگ‌تر از فاصلهٔ آپدیت باشد ...
    چون منبعِ رایگانِ yfinance گاه چند دقیقه rate-limit می‌شود، TTL=۶۰۰ ..."""
    key = f"price:{symbol}"
    await self.set_json(key, price_data, expire=600)
```

#### The 180s → 600s reasoning

The cache TTL **must be strictly greater than the price-update interval** — otherwise the key expires between two successive writes and the "Market status" widget / chart goes blank.

| Era | Update interval | TTL | Problem / fix |
|---|---|---|---|
| Original | 300s | (short) | price stale or missing between cycles |
| First fix | 30s | **180s** | survives ~6 missed cycles; OK when yfinance is happy |
| **Current** | 30s | **600s** | survives a multi-minute yfinance **rate-limit stall** |

The free yfinance endpoint is periodically rate-limited for **several minutes** at a stretch. At a 180s TTL, a 3–4-minute stall expires the key and the UI empties out. Bumping to **600s** means a *single* successful fetch every ≤10 minutes is enough to keep the price "live" in Redis. The config comment at [`config.py:313`](../src/core/config.py) preserves the earlier `TTL=180` rationale; the live value enforced in code is **600**. Consumers always receive the embedded `timestamp` and decide staleness for themselves — the cache deliberately errs toward *availability* over *strict freshness*.

#### Reading prices efficiently — SCAN + pipeline, never KEYS

```python
# redis_client.py:83-115 (abridged)
async def get_all_prices(self) -> dict[str, dict]:
    keys, cursor = [], 0
    while True:
        cursor, batch = await self.client.scan(cursor, match="price:*", count=200)
        keys.extend(batch)
        if cursor == 0:
            break
    async with self.client.pipeline(transaction=False) as pipe:
        for k in keys:
            pipe.get(k)
        values = await pipe.execute()      # 1 round-trip for N keys
```

Redis is single-threaded; `KEYS price:*` is **O(N) blocking** and would stall every other client for as long as it runs. The rewrite uses **non-blocking `SCAN`** (cursor, `count=200`) to enumerate keys and a **single pipelined `MGET`** (one RTT for all values) — eliminating both the blocking enumeration and the N-round-trip fetch.

---

### 3.4 The full Redis key catalogue

The data layer touches these keys (all values are `orjson`-serialized JSON unless noted):

| Key pattern | Written by | TTL | Purpose |
|---|---|---|---|
| `price:{symbol}` | `set_price` | **600s** | latest tick per symbol (live price) |
| `service:datafeed_{name}` | `set_service_status` | 120s | per-source health snapshot |
| `service:{name}` | `set_service_status` | 120s | generic service heartbeat |
| `signal:active:{id}` | `set_active_signal` | **1209600s (14d)** | open-position snapshot for the tracker |
| `signals:active_ids` | `set_active_signal` (zadd) | — | sorted-set **index** of active signal IDs |
| `{counter keys}` | `increment` | 86400s | rate counters (incr+expire atomically) |

A few cross-cutting design notes from [`redis_client.py`](../src/core/redis_client.py):

- **`orjson` everywhere** (`set_json`/`get_json`, lines 49-59) — the fastest Python JSON serializer, important on the 30s × 19-symbol hot path.
- **Active-signal index** (lines 117-216): instead of `KEYS signal:active:*` (200ms blocking for 1000 signals), a **sorted set** `signals:active_ids` (score = creation time) gives O(log N) reads; `get_all_active_signals` does `ZREVRANGE` + a single pipelined `MGET`, with **lazy GC** of stale IDs whose keys have expired. Measured: ~200ms → ~15-20ms.
- **14-day TTL on `signal:active:{id}`** (line 145): a prior 24h TTL caused a real bug — positions open >24h had their key expire, fell out of the index, and the tracker stopped checking TP/SL (leaving them `ACTIVE` forever in the DB). The long TTL is a leak-safety net; positions are explicitly removed on close.
- **`increment`** (lines 244-251) does `INCR` + `EXPIRE` in one pipeline so a crash between the two can't orphan a counter without a TTL.
- **Connection pool** (lines 22-34): `max_connections` from `REDIS_MAX_CONNECTIONS=150`, `socket_keepalive=True`, `health_check_interval=30`, `decode_responses=True`.

#### Pub/Sub channels

| Channel | Publisher | Subscriber | Payload |
|---|---|---|---|
| `price_updates` | `_update_price` → `publish` | WebSocket gateway / live chart | the validated tick dict |

```python
# redis_client.py:219-232
async def publish(self, channel, data):
    await self.client.publish(channel, orjson.dumps(data).decode("utf-8"))

def make_pubsub(self):
    return self.client.pubsub()   # caller must await pubsub.subscribe(*channels)
```

> **Bug-fix lore:** `make_pubsub` was renamed from `subscribe` after the old version silently ignored its `channels` argument (it created the handle but never subscribed), dropping every message. The contract is now explicit: the manager makes the handle, the caller subscribes.

---

### 3.5 Validation — two complementary layers

There are **two** validators with different jobs.

#### 3.5.1 `DataValidator` — hard, blocking (ticks & cross-source)

[`data_validator.py`](../src/data/data_validator.py) gates **ticks** before they're cached/published:

```python
# data_validator.py:34-57
@staticmethod
def validate_tick(tick: dict) -> bool:
    bid, ask = tick.get("bid", 0), tick.get("ask", 0)
    if bid <= 0 or ask <= 0:
        return False
    spread_pct = abs(ask - bid) / bid * 100
    if spread_pct > 1.0:          # spread > 1% of price ⇒ reject
        logger.warning("suspicious_spread", ...)
        return False
    return True
```

- **Positive-price check** rejects zeros/garbage.
- **Spread sanity** — a spread above **1%** of price is almost certainly a glitch (crossed book, bad parse) and is dropped.
- **Cross-source agreement** (`cross_validate_price`, lines 59-87) compares two sources against a **per-symbol tolerance**: `XAUUSD 0.05%`, `XAGUSD 0.1%`, forex `0.02%`, commodities `0.1%`, indices `0.05%` (`MAX_PRICE_DIFF_PERCENT`, lines 12-28). FX is held to the tightest band because spreads are razor-thin.
- **`validate_candle`** (lines 89-109) enforces OHLC integrity (`high ≥ max(o,c)`, `low ≤ min(o,c)`) and rejects an implausible **>10% single-bar range**.
- **`select_best_price`** (lines 111-136): with multiple live sources, average the bids and return the tick closest to the mean (robust to a single outlier feed), cross-validating the rest as it goes.

#### 3.5.2 `candle_quality` — soft, warn-only (DataFrames, Pandera)

[`candle_quality.py`](../src/data/candle_quality.py) runs a **Pandera** schema over a whole candle DataFrame *before* it reaches the engine — but it is **strictly warn-only**:

```python
# candle_quality.py:23-40 — schema
_CANDLE_SCHEMA = pa.DataFrameSchema({
    "open":  Column(float, Check.gt(0), nullable=False),
    "high":  Column(float, Check.gt(0), nullable=False),
    "low":   Column(float, Check.gt(0), nullable=False),
    "close": Column(float, Check.gt(0), nullable=False),
}, checks=[
    Check(lambda df: (df["high"] >= df["low"]).all(),   error="high<low"),
    Check(lambda df: (df["high"] >= df["open"]).all(),  error="high<open"),
    Check(lambda df: (df["high"] >= df["close"]).all(), error="high<close"),
    Check(lambda df: (df["low"] <= df["open"]).all(),   error="low>open"),
    Check(lambda df: (df["low"] <= df["close"]).all(),  error="low>close"),
])
```

```python
# candle_quality.py:47-66 — never raises, never blocks
def validate_candles(df, symbol, timeframe="") -> bool:
    if not _PANDERA_OK or df is None or df.empty:
        return True
    try:
        _CANDLE_SCHEMA.validate(df, lazy=True)
        return True
    except Exception as exc:
        logger.warning("candle_quality_issue", symbol=symbol, ...)
        candle_quality_issues.labels(symbol=symbol).inc()   # Prometheus
        return False
```

**Why warn-only?** Blocking on imperfect candles would silence the bot during exactly the volatile moments when a feed is most likely to hiccup. The design choice: **observe, never starve.** Problems become a `candle_quality_issues` Prometheus counter and a log line; the unmodified DataFrame flows on. If Pandera isn't installed, the whole thing degrades to a no-op (`_PANDERA_OK = False`), and it supports both the pre- and post-0.20 Pandera namespaces.

---

### 3.6 The `CandleBuilder` — persistence to TimescaleDB

[`candle_builder.py`](../src/data/candle_builder.py) is the only writer/reader of the `candles`/`ticks` hypertables. It deliberately uses **raw SQL** (not the ORM) for bulk efficiency.

#### 3.6.1 Bulk upsert with source-priority conflict resolution

```python
# candle_builder.py:79-98 (the core INSERT)
INSERT INTO candles (symbol, timeframe, time, open, high, low, close, volume, source)
VALUES (:symbol, :timeframe, :time, :open, :high, :low, :close, :volume, :source)
ON CONFLICT (time, symbol, timeframe) DO UPDATE
SET open=EXCLUDED.open, high=EXCLUDED.high, low=EXCLUDED.low,
    close=EXCLUDED.close, volume=EXCLUDED.volume, source=EXCLUDED.source
WHERE (CASE EXCLUDED.source
          WHEN 'mt5' THEN 1 WHEN 'oanda' THEN 2
          WHEN 'twelvedata' THEN 3 WHEN 'yfinance' THEN 4 ELSE 5 END)
   <= (CASE candles.source
          WHEN 'mt5' THEN 1 WHEN 'oanda' THEN 2
          WHEN 'twelvedata' THEN 3 WHEN 'yfinance' THEN 4 ELSE 5 END)
```

This is the heart of multi-source consistency. The conflict target is the composite PK `(time, symbol, timeframe)`. On collision, the row is **only overwritten if the incoming source has equal-or-higher priority** (lower number = higher quality). So a candle already stored from `mt5` is **never** clobbered by a later `yfinance` value, but a `yfinance` candle *is* upgraded the moment `mt5` data arrives. Source priority is data quality, encoded in SQL.

Performance: a single `executemany` round-trip replaced `df.iterrows()` + N executes — **~2000ms → <100ms for 200 candles** (lines 36-39).

**Security:** `symbol`/`timeframe` are regex-validated (`^[A-Z0-9]{1,16}$`, `^[A-Z]{1,2}\d{1,3}$`, lines 22-23) before use — defence-in-depth against identifier injection even though values are parameterised.

#### 3.6.2 Tick persistence & history read

```python
# candle_builder.py:120-124 — idempotent tick insert
INSERT INTO ticks (symbol, time, bid, ask, volume, source)
VALUES (:symbol, :time, :bid, :ask, :volume, :source)
ON CONFLICT (time, symbol) DO NOTHING
```

`get_candles` (lines 141-173) reads history back as a UTC-indexed DataFrame: `ORDER BY time DESC LIMIT :count`, re-sorted ascending, all OHLCV coerced to `float`.

#### 3.6.3 Server-side aggregation

`aggregate_candles` (lines 175-214) builds higher timeframes from M1 via pandas `resample` — and repeats the **look-ahead guard**: it drops the last bin if `last_bin_start + period > now(UTC)`, so a forming higher-TF candle never reaches analysis.

---

### 3.7 TimescaleDB — why a time-series database

The schema is created in [`001_initial_schema.py:191-261`](../alembic/versions/001_initial_schema.py).

**Why TimescaleDB (not plain Postgres, not InfluxDB)?**
- It *is* PostgreSQL — same SQL, same SQLAlchemy async driver, same migrations, same backups. Zero new operational surface.
- **Hypertables** auto-partition by time into "chunks", so inserts hit a small recent chunk (fast) and range queries prune irrelevant chunks.
- Native **columnar compression** and **retention policies** — exactly what append-only OHLCV/tick data wants.

#### 3.7.1 The `candles` hypertable

```sql
-- 001_initial_schema.py:192-228
CREATE TABLE candles (
  time TIMESTAMPTZ NOT NULL, symbol VARCHAR(10) NOT NULL, timeframe VARCHAR(5) NOT NULL,
  open NUMERIC(20,8) NOT NULL, high … low … close … volume NUMERIC(20,4),
  PRIMARY KEY (time, symbol, timeframe));               -- + source VARCHAR(20) via migration 003

SELECT create_hypertable('candles','time', chunk_time_interval => INTERVAL '1 week', …);
ALTER TABLE candles SET (timescaledb.compress,
                         timescaledb.compress_segmentby = 'symbol, timeframe');
SELECT add_compression_policy('candles', INTERVAL '30 days', …);
SELECT add_retention_policy('candles',  INTERVAL '2 years', …);
```

| Property | Value | Why |
|---|---|---|
| Chunk interval | **1 week** | candles are low-frequency; weekly chunks balance pruning vs chunk count |
| Compress after | **30 days** | recent data stays writable/fast; old data compressed |
| `compress_segmentby` | `symbol, timeframe` | each series compresses independently → high ratio |
| Retention | **2 years** | enough for ML training & long backtests; auto-drops older |
| PK | `(time, symbol, timeframe)` | the upsert conflict target; one row per bar per series |

#### 3.7.2 The `ticks` hypertable

```sql
-- 001_initial_schema.py:231-261
CREATE TABLE ticks (
  time TIMESTAMPTZ NOT NULL, symbol VARCHAR(10) NOT NULL,
  bid NUMERIC(20,8) NOT NULL, ask NUMERIC(20,8) NOT NULL, spread NUMERIC(10,4),
  PRIMARY KEY (time, symbol));                           -- + volume, source via migration 003
SELECT create_hypertable('ticks','time', chunk_time_interval => INTERVAL '1 day', …);
ALTER TABLE ticks SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol');
SELECT add_compression_policy('ticks', INTERVAL '7 days',  …);
SELECT add_retention_policy('ticks',  INTERVAL '90 days', …);
```

Ticks are **far higher-frequency** than candles, so the policies are tighter: **daily** chunks, compress after **7 days**, retain only **90 days**. Tick data is most useful fresh (microstructure/backtesting); long-term it would be costly and is auto-dropped.

#### 3.7.3 Migration 003 — schema/code alignment

[`003_add_source_columns.py`](../alembic/versions/003_add_source_columns.py) adds `candles.source`, `ticks.volume`, and `ticks.source` to match what `CandleBuilder` actually writes. Without `candles.source` the entire source-priority `ON CONFLICT` logic (§3.6.1) would have no column to compare against.

#### 3.7.4 The timeframe set

`TIMEFRAMES = ["M5","M15","H1","H4","D1"]` ([`config.py:389`](../src/core/config.py)). Per the config comment: **M5/M15** are the *signal* timeframes (scalping), while **H1/H4/D1** exist purely for **multi-timeframe trend confirmation**. Each `(symbol, timeframe)` pair is its own compressed series in the hypertable.

---

### 3.8 Freshness & staleness — the layered defence

Staleness is handled at **four** distinct layers, never just one:

1. **At ingestion** — the still-forming last candle is dropped (`_TF_DELTA` in yfinance, `complete=false` in OANDA, the look-ahead guard in `aggregate_candles`). Only *closed* bars are ever stored or analysed.
2. **In the cache** — `price:{symbol}` carries a 600s TTL; if no fetch succeeds for 10 minutes the key simply disappears (explicit absence beats silent staleness), yet a single fetch per 10 min keeps it alive through yfinance rate-limits.
3. **In the payload** — every tick embeds an ISO `timestamp` (and `source`); **consumers decide staleness themselves**, which is why the cache can safely favour availability.
4. **In monitoring** — `data_feed_status`, `data_feed_latency`, `data_feed_errors`, `candle_quality_issues` Prometheus metrics plus `service:datafeed_{name}` health snapshots make a degraded or stale feed *visible* before it silently corrupts a signal.

The throughline of the entire data layer: **fail soft, observe loudly, never look ahead.** A present-but-imperfect feed keeps the lights on; a forming candle never reaches the model; and every degradation is a metric, not a silent gap.

---
---

## ۳. لایهٔ داده — دریافت، ذخیره‌سازیِ سری‌زمانی و کش

> *هر سیگنالی که CoinePro-FX منتشر می‌کند، دقیقاً به‌اندازهٔ کندلی که روی آن محاسبه شده قابل‌اعتماد است.* این فصل — به‌صورت کامل — توضیح می‌دهد که دادهٔ خامِ بازار چگونه وارد سیستم می‌شود، چگونه اعتبارسنجی می‌شود، کجا برای خواندنِ میلی‌ثانیه‌ای کش می‌شود، چگونه به‌صورتِ یک سری‌زمانیِ قابل‌کوئری ذخیره می‌شود، و **چرا** هر تصمیمِ مهندسی گرفته شده است. این لایه تقریباً به‌طور کامل در [`src/data/`](../src/data/)، [`src/core/redis_client.py`](../src/core/redis_client.py) و بخش‌های کندل/تیکِ [`src/core/database.py`](../src/core/database.py) + [`alembic/versions/001_initial_schema.py`](../alembic/versions/001_initial_schema.py) قرار دارد.

### ۳.۰ نمای کلی

دو هدفِ نگهداریِ **مستقل** با الگوهای دسترسیِ کاملاً متفاوت وجود دارد:

| هدف | محتوا | الگوی دسترسی | عمر |
|---|---|---|---|
| **Redis** | آخرین تیکِ هر نماد (`price:{symbol}`)، fan-outِ زندهٔ pub/sub، سلامتِ سرویس‌ها | خواندنِ داغِ O(1)، زیرِ میلی‌ثانیه، گذرا | ثانیه‌ها (TTL) |
| **TimescaleDB** | کندل‌های بستهٔ OHLCV + تیک‌های خام، چندتایم‌فریمی | range scan، تاریخچهٔ مرتب، تحلیل | تا ۲ سال (کندل) / ۹۰ روز (تیک) |

Redis به پرسشِ «قیمت همین الان چنده؟» پاسخ می‌دهد و TimescaleDB به «EURUSD در H1 طیِ ۲۰۰ کندلِ اخیر چه کرد؟». موتورِ سیگنال دومی را می‌خواند؛ وب‌سایت/WebSocket اولی را.

```
   MT5 / OANDA / TwelveData / yfinance
                  │  get_candles / get_tick (اعتبارسنجی‌شده)
                  ▼
         DataFeedManager (singleton)
   ┌─ _health_check_loop()  هر ۳۰۰ث
   ├─ _price_update_loop()  هر  ۳۰ث ──► Redis price:{sym} TTL=۶۰۰  ─► publish(price_updates) ─► WebSocket
   └─ _candle_update_loop() هر ۳۰۰ث ──► TimescaleDB candles/ticks (hypertable، فشرده، retention)
```

---

### ۳.۱ کلاسِ `DataFeedManager` — هماهنگ‌سازی و failover

مدیر ([`feed_manager.py`](../src/data/feed_manager.py)) یک **singleton** است (`feed_manager = DataFeedManager()`، خط ۲۹۲) که از هر کانکتور یک نمونه دارد و سه حلقهٔ پس‌زمینه را اجرا می‌کند.

#### ۳.۱.۱ زنجیرهٔ اولویتِ منابع

```python
# feed_manager.py:38-41
self._sources = [
    ("yfinance", self.yfinance),
]
self._active_source: str = "yfinance"
```

هر چهار کانکتور **ساخته** می‌شوند، اما تنها `yfinance` در زنجیرهٔ زندهٔ `_sources` سیم‌کشی شده است. **چرا؟**
- **TwelveData** اعتبارِ رایگانش (۷۵۰ credit/روز، `TWELVEDATA_DAILY_CREDIT_LIMIT = 750`) تمام شد؛ نگه‌داشتنش فقط خطا و تأخیر اضافه می‌کرد.
- **MT5 / OANDA** نیازمندِ ترمینالِ متصل/حسابِ احرازشده هستند که در این محیط موجود نیست؛ ماندنشان در زنجیره خطای پیوستهٔ اتصال و failoverِ بیهوده تولید می‌کرد.
- بقیهٔ کانکتورها عمداً **ساخته‌شده باقی مانده‌اند** تا فعال‌سازیِ منبعِ غنی‌تر در آینده فقط یک تغییرِ یک‌خطی در `_sources` باشد — کلِ ماشینِ failover، اعتبارسنج‌ها و مسیرِ ذخیره‌سازی نسبت‌به منبع بی‌تفاوت‌اند.

ترتیبِ *کاملِ* موردِ نظر (که در منطقِ حلِ تعارضِ کندل، §۳.۶، رمزگذاری شده) **mt5 → oanda → twelvedata → yfinance** است: ابتدا دادهٔ مستقیمِ بروکر (قیمتِ واقعیِ قابلِ اجرا، حجمِ واقعی)، سپس aggregator، و در آخر فیدِ رایگانِ خرده‌فروشی.

#### ۳.۱.۲ دو حالتِ شروع

- `connect_sources()` (خط ۴۷): فقط اتصال، بدونِ اجرای حلقه‌ها — برای پروسه‌هایی مثلِ **موتورِ سیگنال** که به `get_candles` زنده نیاز دارند ولی نباید حلقه‌ها را اجرا کنند (وگرنه چند پروسه هم‌زمان روی Redis/DB می‌نویسند).
- `start()` (خط ۶۷): اتصال + اجرای هر سه حلقه با `asyncio.gather` (خطوط ۸۰–۸۴).

#### ۳.۱.۳ حلقهٔ سلامت و failover

دو نکتهٔ درستیِ کلیدی:
1. **باطل‌کردنِ پرچمِ کهنه** (خط ۱۱۶): پیش از `_failover()`، پرچمِ `_connected`ِ منبعِ مرده به `False` مجبور می‌شود؛ وگرنه `_failover` با خواندنِ `is_connected`ِ کش‌شده ممکن بود همان منبعِ تازه‌سقوط‌کرده را دوباره انتخاب کند.
2. **failoverِ محافظت‌شده با `asyncio.Lock`** (خط ۱۲۶): اگر دو health-check هم‌زمان منبعِ فعال را down ببینند، فقط یکی سوئیچ می‌کند؛ دیگری **داخلِ** lock دوباره بررسی می‌کند و اگر منبع دوباره سالم شده باشد زود برمی‌گردد — جلوگیری از سوئیچِ دوگانه به منابعِ متفاوت.

الگوریتمِ failover به‌نرمی تنزل می‌یابد: (۱) منبعِ متصلِ بعدی به‌ترتیبِ اولویت، (۲) اگر هیچ‌کدام متصل نیست، `connect()`ِ تازه روی هر کدام، (۳) اگر همه شکست خورد → `logger.critical("all_data_feeds_down")`. سلامت در Redis به‌صورتِ `service:datafeed_{name}` (TTL=۱۲۰ث) آینه می‌شود تا داشبورد/پنل بدونِ Prometheus وضعیتِ هر منبع را نشان دهد.

#### ۳.۱.۴ حلقهٔ بروزرسانیِ قیمت

```python
# feed_manager.py:242-248
async def _update_price(self, symbol: str) -> None:
    tick = await self.get_tick(symbol)
    if tick:
        await redis_client.set_price(symbol, tick)
        await redis_client.publish("price_updates", tick)
```

هر **۳۰ ثانیه** (`PRICE_UPDATE_INTERVAL_SECONDS = 30`) برای **هر ۱۹ نماد به‌صورتِ هم‌زمان** تیکِ تازه گرفته، در `price:{symbol}` نوشته و روی کانالِ `price_updates` منتشر می‌شود. `return_exceptions=True` تضمین می‌کند خطای یک نماد کلِ دسته را قطع نکند.

> **نکته دربارهٔ docstringِ کهنه:** docstringِ متد هنوز «هر ۲ ثانیه» می‌گوید — بازماندهٔ تنظیمِ قدیمی. مقدارِ معتبر `30` است؛ عمداً از `300`ِ قدیمی بالا برده شد تا قیمتِ زنده بسیار سریع‌تر از انقضای TTLِ Redis تازه شود (§۳.۳).

#### ۳.۱.۵ حلقهٔ بروزرسانیِ کندل

تصمیم‌های طراحی:
- **`count=5` نه ۲۰۰** — هر چرخه فقط چند کندلِ بستهٔ اخیر لازم است؛ بک‌فیلِ تاریخی بر اساسِ نیازِ موتور انجام می‌شود. کمینه‌سازیِ پهنای‌باند/هزینهٔ API، و upsertِ `ON CONFLICT … DO UPDATE` (§۳.۶) جدول را سازگار نگه می‌دارد.
- **`try/except` به‌ازای هر (نماد، تایم‌فریم)** — یک خطای DB یا یک نمادِ بد نباید کلِ جاروی ۱۹×۵ را قطع کند.
- **`await asyncio.sleep(0.5)` بینِ نمادها** — throttleِ عمدی تا فیدِ رایگان با رگبارِ درخواست rate-limit نشود.
- **برچسبِ منبع، منبعِ *واقعیِ* بازگرداننده است** — `get_candles_with_source` نامِ کانکتوری را برمی‌گرداند که واقعاً داده داد (شاید بی‌صدا fallback کرده باشد)، پس ستونِ `source`ِ ذخیره‌شده دقیق است نه صرفاً تکرارِ `_active_source`.

#### ۳.۱.۶ `get_candles_with_source` — fallbackِ خاموش + گیتِ کیفیت

ابتدا منبعِ فعال، سپس بقیه به‌ترتیبِ اولویت امتحان می‌شوند. نکتهٔ مهم: **اعتبارسنجیِ کیفیت warn-only است** — `validate_candles` مشکل را لاگ/متریک می‌کند ولی **هرگز** داده را حذف یا سیگنال را بلاک نمی‌کند (§۳.۵). فلسفه: فیدِ کهنه‌ولی‌موجود بهتر از فیدِ خاموش است؛ مصرف‌کننده‌ها timestamp دارند و خودشان کهنگی را تشخیص می‌دهند.

#### ۳.۱.۷ `get_tick` — انتخابِ بهترین قیمت از چند منبع

هر تیکِ کاندید *پیش از* جمع‌آوری اعتبارسنجی می‌شود و انتخابِ نهایی از `select_best_price` می‌گذرد (§۳.۵) که وقتی چند منبع زنده‌اند، میانگینِ bidها را می‌گیرد و نزدیک‌ترین را برمی‌گرداند و بقیه را cross-check می‌کند.

---

### ۳.۲ کانکتورها

هر کانکتور **همان واسطِ duck-typed** را پیاده می‌کند — دقیقاً همین چیزی است که اجازه می‌دهد مدیر آن‌ها را قابلِ‌تعویض ببیند: `connect / disconnect / is_connected / health_check / get_candles / get_tick`. کندل‌ها به‌صورتِ `DataFrame`ِ نرمال‌شده با ستون‌های `[timestamp(UTC), open, high, low, close, volume]` و تیک‌ها به‌صورتِ dictِ `{symbol, bid, ask, last, volume, timestamp(ISO), source}` برمی‌گردند. همه سه متریکِ Prometheus را تغذیه می‌کنند: `data_feed_status/latency/errors{source}`.

| کانکتور | فایل | فرمتِ نماد | احراز | نکته |
|---|---|---|---|---|
| **MT5** | `mt5_connector.py` | `XAUUSD` | لاگینِ ترمینال | مستقیمِ بروکر، `tick_volume`ِ واقعی، `copy_ticks_range` |
| **OANDA** | `oanda_connector.py` | `XAU_USD` | Bearer token | v20 REST، `price=MBA`، حذفِ کندلِ `complete=false` |
| **TwelveData** | `twelvedata_connector.py` | `XAU/USD` | API key | گاردِ بودجهٔ creditِ روزانه |
| **yfinance** | `yfinance_connector.py` | `GC=F`/`EURUSD=X` | بدون | تنها منبعِ زنده؛ impersonateِ curl_cffi، resampleِ H4 |

#### ۳.۲.۱ yfinance — ستونِ فقراتِ زنده

رایگان و بدونِ کلید است؛ به‌همین‌دلیل منبعِ تولید است — و به‌همین‌دلیل بیشترین کدِ دفاعی را دارد.

- **(الف) دورزدنِ بلاکِ بات با `curl_cffi`** (خطوط ۶۲–۶۹): یاهو کلاینت‌های HTTPِ ساده را بلاک می‌کند؛ کانکتور اثرانگشتِ TLSِ Chrome را جعل می‌کند (`impersonate="chrome"`). بدونِ آن، نسخه‌های قدیمیِ yfinance با `JSONDecodeError` شکست می‌خوردند چون یاهو به‌جای JSON صفحهٔ HTMLِ چالش برمی‌گرداند.
- **(ب) I/Oِ مسدودکننده خارج از event loop** (خطوط ۱۲۸–۱۳۷): yfinance همگام است، پس هر فراخوان در `run_in_executor` پیچیده می‌شود تا حلقهٔ asyncio را مسدود نکند.
- **(ج) سه نقشهٔ نگاشت** (خطوط ۲۵–۴۶): `YF_SYMBOL_MAP` (مثلاً `XAUUSD→GC=F` طلای *فیوچرز*، `US30→YM=F`، `DE40→^GDAXI`)؛ `YF_INTERVAL_MAP` (توجه: **`H4→1h`** چون yfinance کندلِ ۴ساعته ندارد)؛ `YF_PERIOD_MAP` (سقفِ تاریخچهٔ هر interval برای رعایتِ محدودیتِ yfinance).
- **(د) ساختِ H4 با resample** (خطوط ۱۸۲–۱۹۴): چون `resample`ِ pandas با epoch هم‌تراز می‌شود، اولین باکتِ ۴ساعته می‌تواند ناقص باشد؛ آن کندلِ اول حذف می‌شود.
- **(هـ) محافظت از look-ahead** (مهم‌ترین گاردِ درستی، خطوط ۱۹۶–۲۰۲):

```python
delta = _TF_DELTA.get(timeframe)
if delta is not None and len(df) > 0:
    now = datetime.now(timezone.utc)
    if df["timestamp"].iloc[-1] + delta > now:
        df = df.iloc[:-1]   # حذفِ کندلِ هنوز بسته‌نشده
```

اگر بازهٔ آخرین کندل کاملاً سپری نشده باشد، آن کندل **در حالِ شکل‌گیری** است و OHLCاش تغییر خواهد کرد. دادنِ آن به موتور = **سوگیریِ look-ahead**؛ مدل «close»ای را می‌بیند که هنوز رخ نداده. کانکتور آن را بی‌قیدوشرط حذف می‌کند.
- **(و) تیک از `fast_info`** (خطوط ۲۱۳–۲۳۷): `last_price` هم bid و هم ask می‌شود (yfinance اسپردِ واقعی ندارد).

#### ۳.۲.۲ TwelveData — منبعِ بودجه‌بندی‌شده

ردهٔ رایگان **۷۵۰ credit/روز** می‌دهد. کانکتور یک **گاردِ بودجهٔ** سمتِ‌کلاینتِ کامل دارد تا *پیش از* شکستِ سختِ API خودش را غیرفعال کند و به failover واگذار کند:

```python
# twelvedata_connector.py:52-68 (خلاصه)
def _budget_ok(self) -> bool:
    today = datetime.now(timezone.utc).date()
    if today != self._credit_date:          # ریستِ خودکار در نیمه‌شبِ UTC
        self._credit_date = today; self._credits_used = 0
    if self._credits_used >= settings.TWELVEDATA_DAILY_CREDIT_LIMIT:
        return False                         # سقف پر شد → رد کن
    return True
```

دو لایه: **پیشگیرانه** (`_budget_ok` پس از رسیدنِ مصرف به سقف، فراخوان را رد می‌کند، با ریستِ خودکارِ UTC) و **واکنشی** (اگر خودِ API «run out of API credits» بدهد، `_mark_exhausted` فوراً منبع را ناسالم می‌کند تا `_failover` دورش بزند). `health_check` (خطوط ۱۴۰–۱۷۰) اگر درخواستِ موفقی طیِ `HEALTH_CHECK_INTERVAL × 2` داشته باشد، **بدونِ مصرفِ credit** سالم فرض می‌کند تا بودجه روی probe هدر نرود.

#### ۳.۲.۳ OANDA — RESTِ ردهٔ بروکر

- `price=MBA` یعنی Mid/Bid/Ask؛ کندل از OHLCِ **mid** استفاده می‌کند (خط ۱۵۱).
- **کندل‌های `complete=false` حذف می‌شوند** (خط ۱۴۹) — گاردِ look-aheadِ خودِ OANDA، معادلِ حذفِ کندلِ در‌حال‌شکل‌گیریِ yfinance.
- آدرسِ پایه آگاه از محیط: `api-fxpractice` در برابر `api-fxtrade` از طریقِ `OANDA_ENVIRONMENT` (پیش‌فرض `"practice"`).
- `last`ِ تیک به‌صورتِ `(bid+ask)/2`.

#### ۳.۲.۴ MT5 — مستقیمِ بروکر، حجمِ واقعی

MT5 منبعِ *موردِ نظرِ* با بالاترین اولویت است؛ `tick_volume`ِ واقعی و تاریخچهٔ تیک (`copy_ticks_range`، استفاده‌شده توسطِ بک‌تستر) می‌دهد. خودِ import محافظت‌شده است (خطوط ۲۰–۳۵): روی سرورِ لینوکسیِ بدونِ MT5 ماژول تمیز import می‌شود و هر متد روی `mt5 is None` کوتاه می‌بندد. همهٔ فراخوان‌های همگامِ MT5 با `run_in_executor` اجرا می‌شوند.

---

### ۳.۳ اسکیمای قیمتِ زندهٔ Redis (داستانِ `price:{symbol}`)

ظریف‌ترین تصمیمِ کلِ لایه، **TTLِ روی `price:{symbol}`** است:

```python
# redis_client.py:70-77
async def set_price(self, symbol, price_data):
    key = f"price:{symbol}"
    await self.set_json(key, price_data, expire=600)
```

#### استدلالِ ۱۸۰ث → ۶۰۰ث

TTLِ کش **باید اکیداً بزرگ‌تر از فاصلهٔ بروزرسانی باشد** — وگرنه کلید بینِ دو نوشتنِ متوالی منقضی می‌شود و ویجتِ «وضعیت بازار» / چارت خالی می‌ماند.

| دوره | فاصلهٔ آپدیت | TTL | مشکل / اصلاح |
|---|---|---|---|
| اولیه | ۳۰۰ث | (کوتاه) | قیمت بینِ چرخه‌ها کهنه/غایب |
| اصلاحِ اول | ۳۰ث | **۱۸۰ث** | از ~۶ چرخهٔ ازدست‌رفته جان به‌در می‌برد؛ وقتی yfinance خوش‌حال است کافی است |
| **فعلی** | ۳۰ث | **۶۰۰ث** | از **رکودِ چنددقیقه‌ایِ rate-limitِ** yfinance جان به‌در می‌برد |

اندپوینتِ رایگانِ yfinance گاه برای **چند دقیقه** پشتِ‌هم rate-limit می‌شود. با TTL=۱۸۰، یک رکودِ ۳–۴ دقیقه‌ای کلید را منقضی و UI را خالی می‌کند. افزایش به **۶۰۰** یعنی *یک* فِچِ موفق هر ≤۱۰ دقیقه برای زنده‌نگه‌داشتنِ قیمت در Redis کافی است. کامنتِ `config.py:313` استدلالِ قدیمیِ `TTL=180` را حفظ کرده؛ مقدارِ اعمال‌شده در کد **۶۰۰** است. مصرف‌کننده‌ها همیشه `timestamp`ِ تعبیه‌شده را می‌گیرند و خودشان کهنگی را تصمیم می‌گیرند — کش عمداً به‌سمتِ *در‌دسترس‌بودن* تمایل دارد نه *تازگیِ سخت‌گیرانه*.

#### خواندنِ کارآمدِ قیمت‌ها — SCAN + pipeline، هرگز KEYS

```python
# redis_client.py:83-115 (خلاصه)
cursor, batch = await self.client.scan(cursor, match="price:*", count=200)  # غیرمسدودکننده
async with self.client.pipeline(transaction=False) as pipe:
    for k in keys: pipe.get(k)
    values = await pipe.execute()    # ۱ RTT برای N کلید
```

Redis تک‌نخی است؛ `KEYS price:*` یک عملیاتِ **O(N) مسدودکننده** است که هر کلاینتِ دیگری را تا پایانِ اجرا متوقف می‌کند. بازنویسی از **`SCAN`ِ غیرمسدودکننده** (cursor، `count=200`) برای شمارشِ کلیدها و یک **`MGET`ِ pipeline‌شده** (یک RTT برای همهٔ مقادیر) استفاده می‌کند.

---

### ۳.۴ فهرستِ کاملِ کلیدهای Redis

| الگوی کلید | نویسنده | TTL | هدف |
|---|---|---|---|
| `price:{symbol}` | `set_price` | **۶۰۰ث** | آخرین تیکِ هر نماد (قیمتِ زنده) |
| `service:datafeed_{name}` | `set_service_status` | ۱۲۰ث | اسنپ‌شاتِ سلامتِ هر منبع |
| `service:{name}` | `set_service_status` | ۱۲۰ث | ضربانِ سرویسِ عمومی |
| `signal:active:{id}` | `set_active_signal` | **۱۲۰۹۶۰۰ث (۱۴ روز)** | اسنپ‌شاتِ پوزیشنِ باز برای tracker |
| `signals:active_ids` | `set_active_signal` (zadd) | — | **اندکسِ** sorted-setِ شناسه‌های فعال |

نکاتِ طراحیِ عرضی از [`redis_client.py`](../src/core/redis_client.py):
- **`orjson` همه‌جا** (خطوط ۴۹–۵۹) — سریع‌ترین سریالایزرِ JSONِ پایتون، مهم روی مسیرِ داغِ ۳۰ث × ۱۹ نماد.
- **اندکسِ سیگنالِ فعال** (خطوط ۱۱۷–۲۱۶): به‌جای `KEYS signal:active:*` (۲۰۰ms مسدودکننده برای ۱۰۰۰ سیگنال)، یک sorted set (score = زمانِ ایجاد) خواندنِ O(log N) می‌دهد؛ `get_all_active_signals` با `ZREVRANGE` + یک `MGET`ِ pipeline‌شده و **GCِ تنبلِ** شناسه‌های کهنه. اندازه‌گیری‌شده: ~۲۰۰ms → ~۱۵–۲۰ms.
- **TTLِ ۱۴ روزه روی `signal:active:{id}`** (خط ۱۴۵): TTLِ قبلیِ ۲۴ساعته یک باگِ واقعی ساخت — پوزیشنِ بازِ بیش از ۲۴ ساعت کلیدش منقضی، از اندکس می‌افتاد و tracker دیگر TP/SL را چک نمی‌کرد (پوزیشن برای همیشه `ACTIVE`). TTLِ بلند فقط شبکهٔ ایمنیِ ضدِ نشتی است؛ پوزیشن‌ها هنگامِ بسته‌شدن صریحاً حذف می‌شوند.
- **`increment`** (خطوط ۲۴۴–۲۵۱): `INCR` + `EXPIRE` در یک pipeline تا crash بینِ آن دو، شمارنده را بدونِ TTL یتیم نکند.
- **استخرِ اتصال** (خطوط ۲۲–۳۴): `max_connections=REDIS_MAX_CONNECTIONS=150`، `socket_keepalive=True`، `health_check_interval=30`، `decode_responses=True`.

#### کانال‌های Pub/Sub

| کانال | منتشرکننده | مشترک | بار |
|---|---|---|---|
| `price_updates` | `_update_price` → `publish` | درگاهِ WebSocket / چارتِ زنده | dictِ تیکِ اعتبارسنجی‌شده |

> **داستانِ رفعِ‌باگ:** `make_pubsub` از `subscribe` تغییرِ نام داد، چون نسخهٔ قدیمی آرگومانِ `channels` را بی‌صدا نادیده می‌گرفت (handle می‌ساخت ولی هرگز subscribe نمی‌کرد) و هر پیام را گم می‌کرد. اکنون قرارداد صریح است: مدیر handle می‌سازد، caller خودش subscribe می‌کند.

---

### ۳.۵ اعتبارسنجی — دو لایهٔ مکمل

#### ۳.۵.۱ `DataValidator` — سخت و مسدودکننده (تیک‌ها و بین‌منبعی)

[`data_validator.py`](../src/data/data_validator.py) **تیک‌ها** را پیش از کش/انتشار گیت می‌کند:
- **بررسیِ قیمتِ مثبت** صفر/زباله را رد می‌کند.
- **سلامتِ اسپرد** — اسپردِ بالاتر از **۱٪** قیمت تقریباً قطعاً نقص است (orderbookِ کراس‌شده، parseِ بد) و حذف می‌شود.
- **توافقِ بین‌منبعی** (`cross_validate_price`، خطوط ۵۹–۸۷) دو منبع را با **تلورانسِ هر‌نماد** مقایسه می‌کند: `XAUUSD ۰.۰۵٪`، `XAGUSD ۰.۱٪`، فارکس `۰.۰۲٪`، کالا `۰.۱٪`، شاخص `۰.۰۵٪`. فارکس تنگ‌ترین باند را دارد چون اسپردهایش بسیار باریک‌اند.
- **`validate_candle`** (خطوط ۸۹–۱۰۹): یکپارچگیِ OHLC (`high ≥ max(o,c)`، `low ≤ min(o,c)`) و ردِ **رنجِ تک‌کندلیِ بیش از ۱۰٪**.
- **`select_best_price`** (خطوط ۱۱۱–۱۳۶): با چند منبعِ زنده، میانگینِ bidها و بازگرداندنِ نزدیک‌ترین تیک به میانگین (مقاوم در برابرِ یک فیدِ پرت).

#### ۳.۵.۲ `candle_quality` — نرم و warn-only (DataFrame، Pandera)

[`candle_quality.py`](../src/data/candle_quality.py) یک اسکیمای **Pandera** را روی کلِ DataFrameِ کندل *پیش از* رسیدن به موتور اجرا می‌کند — اما **اکیداً warn-only**:

```python
# candle_quality.py:47-66 (خلاصه)
def validate_candles(df, symbol, timeframe=""):
    if not _PANDERA_OK or df is None or df.empty: return True
    try:
        _CANDLE_SCHEMA.validate(df, lazy=True); return True
    except Exception as exc:
        logger.warning("candle_quality_issue", symbol=symbol, ...)
        candle_quality_issues.labels(symbol=symbol).inc()   # Prometheus
        return False
```

**چرا warn-only؟** بلاک‌کردن روی کندلِ ناقص دقیقاً در همان لحظاتِ پُرنوسانی که فید احتمالِ بیشتری برای سکسکه دارد، ربات را خاموش می‌کند. انتخاب: **مشاهده کن، هرگز قحطی نده.** مشکلات به شمارندهٔ `candle_quality_issues`ِ Prometheus و یک خطِ لاگ تبدیل می‌شوند؛ DataFrameِ دست‌نخورده جاری می‌ماند. اگر Pandera نصب نباشد، کل به no-op تنزل می‌یابد (`_PANDERA_OK = False`) و هر دو namespaceِ پیش‌ و پسا‌۰.۲۰ Pandera را پشتیبانی می‌کند.

---

### ۳.۶ کلاسِ `CandleBuilder` — ذخیره در TimescaleDB

[`candle_builder.py`](../src/data/candle_builder.py) تنها نویسنده/خوانندهٔ hypertableهای `candles`/`ticks` است و عمداً برای کاراییِ bulk از **SQLِ خام** (نه ORM) استفاده می‌کند.

#### ۳.۶.۱ Upsertِ انبوه با حلِ‌تعارضِ مبتنی‌بر اولویتِ منبع

```sql
-- candle_builder.py:79-98
INSERT INTO candles (...) VALUES (...)
ON CONFLICT (time, symbol, timeframe) DO UPDATE SET ...
WHERE (CASE EXCLUDED.source WHEN 'mt5' THEN 1 WHEN 'oanda' THEN 2
          WHEN 'twelvedata' THEN 3 WHEN 'yfinance' THEN 4 ELSE 5 END)
   <= (CASE candles.source WHEN 'mt5' THEN 1 ... END)
```

این قلبِ سازگاریِ چندمنبعی است. هدفِ تعارض، کلیدِ اصلیِ مرکبِ `(time, symbol, timeframe)` است. در برخورد، ردیف **تنها در صورتی بازنویسی می‌شود که منبعِ ورودی اولویتِ مساوی‌یا‌بالاتر داشته باشد** (عددِ کوچک‌تر = کیفیتِ بالاتر). پس کندلی که از `mt5` ذخیره شده **هرگز** با مقدارِ بعدیِ `yfinance` خراب نمی‌شود، اما کندلِ `yfinance` لحظه‌ای که دادهٔ `mt5` برسد ارتقا می‌یابد. **اولویتِ منبع = کیفیتِ داده، رمزگذاری‌شده در SQL.**

کارایی: یک `executemany`ِ تک‌RTT جای `df.iterrows()` + N اجرا — **~۲۰۰۰ms → <۱۰۰ms برای ۲۰۰ کندل** (خطوط ۳۶–۳۹).

**امنیت:** `symbol`/`timeframe` با regex اعتبارسنجی می‌شوند (`^[A-Z0-9]{1,16}$`، `^[A-Z]{1,2}\d{1,3}$`، خطوط ۲۲–۲۳) — دفاع‌در‌عمق در برابرِ تزریقِ identifier، حتی با وجودِ پارامتری‌بودنِ مقادیر.

#### ۳.۶.۲ ذخیرهٔ تیک و خواندنِ تاریخچه

```sql
-- candle_builder.py:120-124 — درجِ idempotent
INSERT INTO ticks (...) VALUES (...) ON CONFLICT (time, symbol) DO NOTHING
```

`get_candles` (خطوط ۱۴۱–۱۷۳) تاریخچه را به‌صورتِ DataFrameِ UTC-indexed برمی‌گرداند: `ORDER BY time DESC LIMIT :count`، مرتب‌شده به‌صعودی، همهٔ OHLCV به `float`.

#### ۳.۶.۳ تجمیعِ سمتِ سرور

`aggregate_candles` (خطوط ۱۷۵–۲۱۴) تایم‌فریمِ بالاتر را با `resample`ِ pandas از M1 می‌سازد — و **گاردِ look-ahead** را تکرار می‌کند: اگر `last_bin_start + period > now(UTC)` باشد، باکتِ آخر را حذف می‌کند تا کندلِ در‌حال‌شکل‌گیریِ تایم‌فریمِ بالاتر به تحلیل نرسد.

---

### ۳.۷ TimescaleDB — چرا یک پایگاه‌دادهٔ سری‌زمانی

اسکیما در [`001_initial_schema.py:191-261`](../alembic/versions/001_initial_schema.py) ساخته می‌شود.

**چرا TimescaleDB (نه Postgresِ ساده، نه InfluxDB)؟**
- *همان* PostgreSQL است — همان SQL، همان درایورِ async، همان migration، همان backup. صفر سطحِ عملیاتیِ جدید.
- **Hypertableها** بر اساسِ زمان به «chunk» پارتیشن می‌شوند؛ درج‌ها به chunkِ کوچکِ اخیر می‌خورند (سریع) و کوئریِ بازه‌ای chunkهای نامربوط را prune می‌کند.
- **فشرده‌سازیِ ستونیِ بومی** و **سیاست‌های retention** — دقیقاً چیزی که دادهٔ append-onlyِ OHLCV/تیک می‌خواهد.

#### ۳.۷.۱ hypertableِ `candles`

| ویژگی | مقدار | چرا |
|---|---|---|
| فاصلهٔ chunk | **۱ هفته** | کندل کم‌فرکانس است؛ تعادلِ pruning و تعدادِ chunk |
| فشرده‌سازی پس از | **۳۰ روز** | دادهٔ اخیر سریع/قابل‌نوشتن می‌ماند؛ قدیمی فشرده می‌شود |
| `compress_segmentby` | `symbol, timeframe` | هر سری مستقل فشرده می‌شود → نسبتِ بالا |
| retention | **۲ سال** | کافی برای آموزشِ ML و بک‌تستِ بلند؛ قدیمی‌تر auto-drop |
| PK | `(time, symbol, timeframe)` | هدفِ تعارضِ upsert؛ یک ردیف به‌ازای هر کندلِ هر سری |

#### ۳.۷.۲ hypertableِ `ticks`

تیک‌ها **بسیار پرفرکانس‌تر** از کندل‌اند، پس سیاست‌ها تنگ‌ترند: chunkِ **روزانه**، فشرده‌سازی پس از **۷ روز**، retention تنها **۹۰ روز**. دادهٔ تیک بیشتر تازه مفید است (ریزساختار/بک‌تست)؛ بلندمدت پرهزینه است و auto-drop می‌شود.

#### ۳.۷.۳ migration 003 — هم‌ترازیِ اسکیما/کد

[`003_add_source_columns.py`](../alembic/versions/003_add_source_columns.py) ستون‌های `candles.source`، `ticks.volume` و `ticks.source` را برای تطبیق با آنچه `CandleBuilder` واقعاً می‌نویسد اضافه می‌کند. بدونِ `candles.source` کلِ منطقِ اولویتِ منبعِ `ON CONFLICT` (§۳.۶.۱) ستونی برای مقایسه نمی‌داشت.

#### ۳.۷.۴ مجموعهٔ تایم‌فریم‌ها

`TIMEFRAMES = ["M5","M15","H1","H4","D1"]` (`config.py:389`). طبقِ کامنتِ config: **M5/M15** تایم‌فریم‌های *سیگنال* (اسکلپ) هستند، و **H1/H4/D1** صرفاً برای **تأییدِ روندِ چندتایم‌فریمی** وجود دارند. هر جفتِ `(symbol, timeframe)` سریِ فشردهٔ مستقلِ خودش در hypertable است.

---

### ۳.۸ تازگی و کهنگی — دفاعِ لایه‌ای

کهنگی در **چهار** لایهٔ مجزا مدیریت می‌شود، نه فقط یکی:

۱. **هنگامِ دریافت** — کندلِ در‌حال‌شکل‌گیریِ آخر حذف می‌شود (`_TF_DELTA` در yfinance، `complete=false` در OANDA، گاردِ look-ahead در `aggregate_candles`). فقط کندلِ *بسته* ذخیره یا تحلیل می‌شود.
۲. **در کش** — `price:{symbol}` با TTLِ ۶۰۰ث؛ اگر ۱۰ دقیقه هیچ فِچی موفق نشود کلید صرفاً ناپدید می‌شود (غیابِ صریح بهتر از کهنگیِ خاموش)، با‌این‌حال یک فِچ در هر ۱۰ دقیقه آن را در طولِ rate-limitِ yfinance زنده نگه می‌دارد.
۳. **در payload** — هر تیک `timestamp`ِ ISO (و `source`) را تعبیه دارد؛ **مصرف‌کننده‌ها خودشان کهنگی را تصمیم می‌گیرند** — به‌همین‌دلیل کش می‌تواند با‌خیال‌راحت به در‌دسترس‌بودن تمایل دهد.
۴. **در مانیتورینگ** — متریک‌های `data_feed_status/latency/errors` و `candle_quality_issues` به‌علاوهٔ اسنپ‌شاتِ سلامتِ `service:datafeed_{name}` فیدِ تنزل‌یافته یا کهنه را *پیش از* خرابیِ خاموشِ سیگنال **دیدنی** می‌کنند.

خطِ راهنمای کلِ لایهٔ داده: **نرم شکست بخور، بلند مشاهده کن، هرگز به جلو نگاه نکن.** فیدِ موجود‌ولی‌ناقص چراغ‌ها را روشن نگه می‌دارد؛ کندلِ در‌حال‌شکل‌گیری هرگز به مدل نمی‌رسد؛ و هر تنزل یک متریک است، نه یک شکافِ خاموش.

---

[⬅ 2. System Architecture & Service Topology](architecture.md) · [🏠 Home · خانه](../README.md) · [4. Market Analysis Engine ➡](market-analysis.md)
