[⬅ 5. The Machine‑Learning Subsystem](machine-learning.md) · [🏠 Home · خانه](../README.md) · [7. Institutional‑Grade Risk Management ➡](risk-management.md)

---

## 6. The Signal Engine — Decision Core & Lifecycle

> **Source of truth for this chapter:** every file in `src/signals/` — `engine.py` (orchestrator, 1540+ lines), `scorer.py` (calibrated‑probability + confluence blend), `risk_manager.py` (SL / TP1‑3 / trailing geometry, real P&L math), `tracker.py` (live price watcher, TP/SL/break‑even/trailing transitions, P&L recording, no‑reopen), `state_machine.py` (formal lifecycle), plus `trailing_stop.py` (Chandelier exit), `news_filter.py`, `macro_filter.py`, `candle_utils.py`. Nothing below is invented; it is documented from the running code.

The signal subsystem is the **decision core** of CoinePro‑FX. It pulls multi‑timeframe candles, fans them out to seven analyzers + the ML ensemble in parallel, collapses everything into a single calibrated **0–100 score**, runs the score through a stack of gates (regime, multi‑timeframe veto, confluence, risk guard, a Claude "second opinion"), computes the full SL/TP geometry with a per‑instrument risk manager, persists the signal, and then hands it to a live **tracker** that manages the position to its grave — TP1 → trailing, TP2 → ladder lock, TP3/SL/break‑even close — while recording real net P&L and guaranteeing a closed position can never silently reopen.

---

### 6.1 Architecture at a glance

```
            ┌──────────────────────────────────────────────────────────────────┐
            │                         SignalEngine                              │
            │  (src/signals/engine.py — async service, one analysis loop)       │
            └──────────────────────────────────────────────────────────────────┘
                          │  every ANALYSIS_INTERVAL_SECONDS = 300s
                          ▼
  ┌─ _analyze_symbol(symbol) ──────────────────────────────────────────────────┐
  │ 1. _fetch_candles  → all timeframes from Redis/TimescaleDB                  │
  │ 2. drop_unclosed_candle  → analyze only CLOSED candles (no look-ahead)      │
  │ 3. asyncio.gather over a thread-pool:                                       │
  │      technical · candlestick · chart_pattern · smart_money · volume · S/R   │
  │      · EnsemblePredictor.predict (ML)                                       │
  │ 4. MultiTimeframeAnalyzer.analyze  → confluence_count, net_confluence,      │
  │                                       higher_tf_bias, conflict              │
  │ 5. NewsFilter.get_penalty_score  ·  detect_regime(df)                       │
  │ 6. _determine_direction / _reversion / _breakout  (regime-aware)           │
  │ 7. SignalScorer.score_from_analysis  → ScoreBreakdown (0–100)              │
  │ 8. MacroFilter.score_adjustment  (soft COT bias, ± never hard-block)        │
  │ 9. GATES: MTF veto · H1 min-score · confluence-required                     │
  │10. if strength != NO_SIGNAL and direction != neutral → _create_signal      │
  └────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
  ┌─ _create_signal ───────────────────────────────────────────────────────────┐
  │  entry = live ask(long)/bid(short)  ·  ATR  ·  RiskManager.calculate        │
  │  PositionSizer.fixed_fractional → lot                                       │
  │  RiskGuard.evaluate (weekend/session/daily-loss/correlation/regime/RR)      │
  │  Claude sanity_gate.review_signal (fail-open veto)                          │
  │  dedup + per-(symbol,direction) cooldown + scalp scale-in rules             │
  │  persist Signal(status="active") → Redis active set → publish               │
  └────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
  ┌─ SignalTracker (src/signals/tracker.py — 10s loop) ────────────────────────┐
  │  reconcile DB↔Redis · TP3→TP2→TP1→break-even→SL→trailing per tick          │
  │  RiskManager.calculate_pnl · DailyLossLimit.record_trade_outcome           │
  │  idempotent close lock · server-side dismissal (no reopen)                 │
  └────────────────────────────────────────────────────────────────────────────┘
```

The engine instantiates **two scorers** — a default (trend) one and a *ranging* one with ML/pattern‑heavy weights — because trend indicators are structurally neutral inside a range:

```python
self._scorer = SignalScorer()
self._scorer_ranging = SignalScorer(
    technical_weight=0.25, pattern_weight=0.30, ml_weight=0.45,
)
```

---

### 6.2 The Scorer — calibrated ML × rule confluence → 0–100

`src/signals/scorer.py` is where heterogeneous evidence (technical, patterns, ML) becomes a single number. The design philosophy is encoded directly in the constants and their comments: **the ML model has historically shown negative skill** (win‑rate ≈ 27–33 %), so its weight was *cut* from 0.30 → 0.22 and its influence is further **shrunk toward neutral** before it ever touches the blend.

#### 6.2.1 Weights and trust

```python
TECHNICAL_WEIGHT: float = 0.43
PATTERN_WEIGHT:   float = 0.35
ML_WEIGHT:        float = 0.22

# ML trust: the deviation of the ML score from neutral (50) is multiplied by this
# so a noisy / confidently-wrong prediction cannot drag the whole score. 1.0 = no shrink.
ML_TRUST: float = 0.55
```

#### 6.2.2 The core formula

Given raw sub‑scores `T`, `P`, `M` (each clamped to 0–100), the scorer first **de‑risks the ML score** by pulling it toward the neutral midpoint 50 by the trust factor, then takes a weighted base, then applies additive bonuses and penalties, then clamps:

```python
# 1) ML effective score — shrink deviation from neutral 50
ml_eff = 50.0 + (ml_score - 50.0) * ML_TRUST          # ML_TRUST = 0.55

# 2) weighted base
weighted_base = (technical_score * tech_w
               + pattern_score   * pattern_w
               + ml_eff          * ml_w)

# 3) final
raw_final  = weighted_base + total_bonus + total_penalty
final_score = clamp(raw_final, 0, 100)
```

Written compactly, with the default trend weights:

```
score = clamp(
            0.43·T  +  0.35·P  +  0.22·(50 + 0.55·(M − 50))
          + Σ bonuses  −  Σ penalties,
        0, 100)
```

The `ml_eff` transform means a maximally bullish ML output of `M = 100` only contributes as if it were `50 + 0.55·50 = 77.5`, and a panicked `M = 0` only as `22.5` — extreme, noisy ML can nudge but never dominate a structurally sound technical/pattern setup.

A subtle but important safety detail is the clamp itself: it is **NaN/inf‑hardened**, because an unguarded `max/min` would turn a `NaN` into the ceiling and fabricate a "perfect" 100 signal:

```python
@staticmethod
def _clamp(value, low=0.0, high=100.0):
    if not math.isfinite(value):
        return (low + high) / 2     # NaN/inf → neutral 50, never a fake 100
    return max(low, min(high, value))
```

#### 6.2.3 Where the three sub‑scores come from

`score_from_analysis()` is the adapter that turns raw analyzer dicts into `T/P/M`:

- **Technical** `T` = `technical_result["technical_score"]`.
- **Pattern** `P` is itself a blend: candlestick 50 % + chart‑pattern 30 % + smart‑money 20 %:
  ```python
  pattern_score = candle_score*0.50 + chart_score*0.30 + smc_score*0.20
  ```
- **ML** `M` = `ml_result["ml_score"]`, the ensemble's calibrated directional score (see §6.2.6).

#### 6.2.4 Bonuses and penalties (the confluence layer)

| Factor | Constant | Value | When |
|---|---|---|---|
| Multi‑TF confluence | `MULTI_TF_CONFLUENCE_BONUS` | **+5** | `confluence_count ≥ 3` |
| Volume confirms trend | `VOLUME_CONFIRMS_BONUS` | **+3** | volume confirms |
| HTF‑aligned (strong bias) | `HTF_ALIGNED_STRONG_BONUS` | **+8** | direction agrees with strong daily/weekly bias |
| HTF‑aligned (weak bias) | `HTF_ALIGNED_WEAK_BONUS` | **+4** | direction agrees with `slightly_*` bias |
| Reversion quality | `extra_bonuses["reversion_quality"]` | **+6…+18** | range‑edge reversion with RSI extreme (computed in engine) |
| Against major trend | `AGAINST_MAJOR_TREND_PENALTY` | **−10** | trend setup fights the major trend |
| High‑impact news ≤ 1 h | `HIGH_IMPACT_NEWS_PENALTY` | **−15** | (replaced by exact `news_penalty` value) |
| HTF‑against reversion | `HTF_AGAINST_REVERSION_PENALTY` | **−6** | reversion fights a strong HTF bias |

The **HTF alignment bonus is described in the code as the single strongest win‑rate factor** ("the 26–47 % win‑rate gap between with‑HTF and against‑HTF trades"). A setup aligned with a strong daily/weekly bias gets a large +8 push so it reliably clears the threshold, biasing the whole signal mix toward high‑win‑rate, with‑trend trades:

```python
htf_bias = str(mtf_result.get("higher_tf_bias", "neutral")).lower()
_strong_bias = htf_bias in ("bullish", "bearish")
if signal_direction in ("long", "short") and (bull_bias or bear_bias):
    if aligned:
        ctx.extra_bonuses["htf_aligned"] = (
            HTF_ALIGNED_STRONG_BONUS if _strong_bias else HTF_ALIGNED_WEAK_BONUS)
    elif signal_strategy == "reversion":
        ctx.extra_penalties["htf_against"] = HTF_AGAINST_REVERSION_PENALTY
```

Two correctness notes baked into the code as comments:
- The **counter‑trend penalty is skipped for `reversion` strategies** — a mean‑reversion setup is *by definition* mildly against the trend, so penalizing it there was a category error that pushed legitimate range‑edge setups under 60.
- The **news penalty is applied exactly once** with its real value (`ctx.extra_penalties["news"] = news_penalty`); an earlier bug applied a fixed −15 *and* a second extra, double‑counting it.

#### 6.2.5 Classification thresholds

```python
def _classify(score):
    if score >= settings.STRONG_SIGNAL_SCORE:  # 85
        return STRONG
    elif score >= settings.MIN_SIGNAL_SCORE:   # 70
        return MEDIUM
    return NO_SIGNAL
```

So the live gate is **MIN_SIGNAL_SCORE = 70** (MEDIUM) and **STRONG_SIGNAL_SCORE = 85**. Only `STRONG`/`MEDIUM` with a non‑neutral direction proceed to `_create_signal`.

#### 6.2.6 The ML score itself (calibration upstream)

`ml_score` arrives from `EnsemblePredictor.predict()`. It is a **direction‑confidence score** centered on 50: each directional model (xgboost, lstm) votes with `±50·confidence·weight`, the deviation is normalized by the present directional weight, and the result is **shrunk toward 50** via `ML_SCORE_SHRINK` to undo the over‑confidence of overfit models that saturate to 0/100:

```python
direction_score = 50.0 + (deviation / dir_weight if dir_weight > 0 else 0.0)
direction_score = max(0.0, min(100.0, direction_score))
if _shrink < 1.0:
    direction_score = 50.0 + (direction_score - 50.0) * _shrink
```

If no directional model is loaded the result is **degraded** (`ml_score = 50`, direction neutral) — and the engine surfaces this loudly via `ml_fallback_total` metric and a warning, rather than silently dragging every score to the midpoint. This calibrated 50‑centered score is exactly what the scorer's `ml_eff` shrink then re‑centers a second time — a deliberate belt‑and‑suspenders dampening of an unreliable model.

---

### 6.3 Regime‑aware direction + the gate stack

Before scoring, the engine detects the market regime (`detect_regime(df)`) and picks a direction strategy accordingly:

- **Ranging** → `_determine_reversion_direction` (range‑edge mean reversion, requires `rev_conf ≥ 2` real confirmations; the old ML‑guess fallback was removed because it was the source of losing setups).
- **Low‑volatility squeeze** → `_determine_breakout_direction`.
- **Transitional** (ADX 20–25) → `_determine_direction` with `min_votes=2` plus a DI‑spread vote.
- **Trending / high‑vol** → `_determine_direction` with the full **3‑vote consensus**.

`_determine_direction` is a weighted voting ensemble: technical (±2), candlestick (±1), chart (±1), smart‑money (±2), ML (stepped: >0.55 conf = ±2, >0.35 = ±1), MTF (±2 strong / ±1 slight). A direction only wins if it both leads *and* reaches `min_votes`.

After scoring, **three hard gates** can still kill an otherwise‑qualifying signal:

1. **MTF directional veto** — for trend signals, block if the higher‑TF bias is strongly opposed (`bias == "bullish"` while going short, etc.) *or* `net_confluence` strongly opposes (`|net| ≥ 2`). `net = 0` means "no confirmation," not "opposition," so it passes — otherwise thin HTF data would block everything. Reversion signals are blocked only against a *strong* HTF bias, and **indices (US30/US500/NAS100/DE40) block reversion against any bias** because the data showed counter‑trend reversion on indices had the worst win‑rate.
2. **H1 min‑score** — `primary_tf == "H1"` must clear `H1_MIN_SCORE = 70`.
3. **Confluence‑required** — when `SIGNAL_REQUIRE_CONFLUENCE` and `final_score < SIGNAL_CONFLUENCE_FREE_SCORE (75)`, the signal must have *at least one* of: aligned MTF net, confirming volume, or aligned HTF bias. Strong signals (≥75) pass freely. The philosophy: "fewer but higher quality," not raw blocking.

---

### 6.4 The Risk Manager — SL / TP geometry + real P&L math

`src/signals/risk_manager.py` turns an entry + ATR + structure into concrete prices. The constants encode hard‑won, data‑calibrated lessons (the `2026-06` calibration):

```python
ATR_SL_MULTIPLIER      = 2.5    # SL floor = 2.5×ATR; S/R may only WIDEN it, never tighten
ATR_TRAILING_MULTIPLIER= 1.0
MIN_SL_ATR_RATIO       = 1.5    # noise guard

TP1_RR_RATIO = 1.5   # was 1.05 → mathematically losing at WR~46%; 1.5 makes PF positive
TP2_RR_RATIO = 2.2
TP3_RR_RATIO = 3.2
```

#### 6.4.1 Stop‑loss: widest of ATR vs S/R, then spread‑buffered

The SL starts at `entry ∓ ATR·2.5`, then is compared to the nearest support/resistance. Crucially, the **farther** of the two is chosen — S/R can only push the stop *wider*, never tighter into the noise (a previous bug took the nearest and glued the stop into the noise band):

```python
if is_long:  sl_price = min(atr_sl_price, sr_sl_price)   # lower = farther
else:        sl_price = max(atr_sl_price, sr_sl_price)    # higher = farther
```

Then a **spread buffer** is subtracted (a major cause of premature stops on wide‑spread instruments like gold/indices/oil was placing the stop on ATR distance *without* accounting for spread):

```python
spread_price = spread_pips_of(symbol) * pip_value
sl_price = sl_price - spread_price  (long)  /  + spread_price  (short)
```

Finally a **per‑instrument minimum distance** is enforced — `max(MIN_SL_PIPS=5, min_stop_pips_of(symbol))`, i.e. the broker's real `stops_level`.

#### 6.4.2 Targets: RR floor first, structure as confirmation

TP1/2/3 are computed as `entry ± risk_distance · RR`. Key fix encoded in the code: TP1 used to be *snapped* to the nearest S/R even when that broke the RR floor (the main cause of `LOW_RR` rejections). Now `raw_tp1` (which guarantees `RR = tp1_rr`) is kept as the floor; nearby S/R is only *recorded*, not allowed to choke TP1 below the floor. TP2 confirms against Fibonacci extensions (snaps only if within `FIB_PROXIMITY_PCT = 1.0 %`), TP3 against order‑blocks / supply‑demand zones (within `OB_PROXIMITY_PCT = 1.5 %`, taking the conservative edge).

A **monotonicity guard** then ensures `TP1 < TP2 < TP3` (long) — snapping to fib/OB sometimes pulled TP3 inside TP2; if so it falls back to the raw RR‑based target which is always correctly ordered:

```python
if is_long:
    if not (tp1_price < tp2_price): tp2_price = raw_tp2
    if not (tp2_price < tp3_price): tp3_price = max(raw_tp3, tp2_price + abs(tp2_price - tp1_price))
```

#### 6.4.3 P&L math (direction‑aware, per‑lot dollars)

`calculate_pnl` is the single source of P&L for both the live tracker and weekend close:

```python
pip_value  = settings.pip_values.get(symbol, 0.0001)
pip_dollar = pip_dollar_of(symbol) * lot_size
pnl_pips   = (current - entry)/pip_value  if long  else  (entry - current)/pip_value
pnl_dollar = pnl_pips * pip_dollar
```

The tracker feeds it the **direction‑correct exit price** (long closes at BID, short at ASK), so spread is never silently ignored.

---

### 6.5 The Tracker — the live lifecycle manager

`src/signals/tracker.py` runs a `TRACKING_INTERVAL_SECONDS = 10` loop. Each cycle it:

1. **Reconciles DB↔Redis** (throttled to every 10 min): any signal `active` in the DB but missing from Redis (key expiry / LRU eviction) is *rehydrated* so it keeps being monitored — without this an orphaned position stays open forever (the "3‑day position" bug).
2. Loads all active signals and checks each **in parallel** (`asyncio.gather` + a `Semaphore(20)` to avoid pool exhaustion / thundering herd).

#### 6.5.1 Per‑tick decision order

`_check_single_signal` evaluates levels in a strict priority — **TP3 → TP2 → TP1 → pre‑TP1 break‑even → SL → trailing update**:

```python
if tp3 and _is_tp_hit(price, tp3, is_long):                       → _handle_tp3_hit  (close)
if tp2 and tp1_hit and not tp2_hit and _is_tp_hit(price, tp2):    → _handle_tp2_hit  (ladder lock)
if tp1 and not tp1_hit and _is_tp_hit(price, tp1):               → _handle_tp1_hit  (arm trailing)
# pre-TP1 break-even pre-move (see below)
active_sl = trailing_sl or sl
if _is_sl_hit(price, active_sl, is_long):                         → _handle_sl_hit
if tp1_hit and trailing_sl is not None:                           → _update_trailing_stop
```

Booleans from Redis may be strings (`"False"` is truthy in Python!), so a hardened `_coerce_bool` is used everywhere.

#### 6.5.2 TP1 → arm trailing + spread‑aware break‑even floor

On TP1 the position is *not* closed (unless `EXIT_CLOSE_AT_TP1`). Instead the trailing stop is armed at `current − ATR·1.0`, then **floored above entry by (spread + 2 pips)** so a pullback closes with a small *profit*, not a small loss — the fix for the "losing break‑even" pain:

```python
trailing_sl = risk_manager.calculate_trailing_stop(symbol, direction, current, atr)
_floor = (spread_pips_of(symbol) + 2.0) * pip_size_of(symbol)
be_floor = entry + _floor  (long)  /  entry - _floor  (short)
trailing_sl = max(trailing_sl, be_floor)  (long)  /  min(...)  (short)
```

#### 6.5.3 The pre‑TP1 break‑even pre‑move

A defining calibration lesson lives here. Early break‑even (moving the stop to entry at 33 % of the way to TP1) was cutting winners on the smallest natural pullback and recording **phantom wins** while the account got nothing. The rewrite moves the stop only once price has travelled **80 % of the way to TP1** (`BREAKEVEN_TRIGGER_FRAC = 0.8`), and locks not at zero but at a **spread‑aware small profit** (`BE_LOCK_FRAC = 0.25` of the TP1 path, floored at `spread + 2 pips`):

```python
_prog = (current - entry) if is_long else (entry - current)
_tgt  = abs(tp1 - entry)
if _tgt > 0 and _prog >= BREAKEVEN_TRIGGER_FRAC * _tgt:        # 80% of the way
    _min_lock = (spread_pips_of(symbol) + 2.0) * pip_size_of(symbol)
    _lock = max(BE_LOCK_FRAC * _tgt, _min_lock)               # ≥ 25% of TP1 path
    be_level = entry + _lock  (long)  /  entry - _lock  (short)
    signal_data["trailing_sl"] = be_level
    signal_data["be_premove"]  = True
```

This `be_premove` flag is later used to label the close correctly (`BREAKEVEN` vs `TRAILING_SL` vs `SL_HIT`).

#### 6.5.4 TP2 → ladder lock

On TP2 the stop is raised at least to **TP1** (never below a previous trail), locking in the TP1 profit so any reversal from here banks at least TP1 rather than break‑even.

#### 6.5.5 Trailing update (monotonic, profit‑only)

`_update_trailing_stop` recomputes `current ∓ ATR·1.0` and **only moves the stop if it improves** (higher for long, lower for short) — it can never retreat. (A richer Chandelier‑exit + staged engine lives in `trailing_stop.py`: `chandelier_exit = highest_high(22) − ATR·mult`, with `INITIAL → BREAKEVEN → LOCKED_TP1 → LOCKED_TP2 → TIGHT` stages, the TIGHT stage compressing the multiplier when unrealized R ≥ 3 to prevent give‑back.)

#### 6.5.6 Close: idempotent, fail‑closed, no double‑count

`_close_signal` is the one funnel for every terminal event. Two independent guards prevent double‑close / double‑count across concurrent ticks:

```python
# 1) Redis lock — fail-CLOSED: if Redis errors, we block the close (no double-count)
locked = await redis.client.set(f"lock:close:{signal_id}", "1", nx=True, ex=300)
if not locked: return

# 2) DB-level guard — only an 'active' row may close
UPDATE signal SET status='closed', ... WHERE id=:id AND status='active'
if rowcount == 0:            # already closed → clean Redis, do not re-count
    await redis.remove_active_signal(signal_id); return
```

On a real close it: writes `pnl_pips`, `pnl_dollar`, `close_reason`, `hit_target`, `duration_minutes`; removes the Redis active entry; observes the `signal_pnl_pips` metric; and **reports the outcome to the daily circuit breaker** so `consecutive_losses` and `realized_pnl` advance (failure here is logged at ERROR — a missed write means the capital breaker under‑counts losses).

#### 6.5.7 Correct exit labelling (close_reason / hit_target)

`_handle_sl_hit` derives the *meaning* of an SL touch instead of always stamping "SL" (which used to corrupt reports and ML labels):

| trailing == sl_price | tp1_hit | be_premove | close_reason | hit_target |
|---|---|---|---|---|
| yes | yes | — | `TRAILING_SL` | `TRAIL_WIN` / `TRAIL_BE` / `TRAIL_SL` by P&L sign |
| yes | no | yes | `BREAKEVEN` | derived |
| no | — | — | `SL_HIT` | `SL` |

#### 6.5.8 No‑reopen guarantee & weekend close

Because closing is gated by `WHERE status='active'` *and* a Redis lock, a position that was closed (by TP/SL, by the weekend job, or manually on any device) is **dismissed server‑side** — the next tracker cycle finds no active row/Redis key and re‑creation is a no‑op. The Celery `close_positions_weekend` task closes every open position at market on Friday, fans an explicit EA `close_all_id` increment to master + every copy user (so real MT5 positions close immediately, not just via `close_on_signal_gone`), and is gated by `WEEKEND_AUTO_CLOSE_ENABLED`.

#### 6.5.9 Periodic performance (Celery)

`calculate_performance(period_type)` aggregates closed signals into `SignalPerformance` rows (overall + per‑symbol): win‑rate, total/avg pips, max win/loss, **profit factor** (`gross_profit/gross_loss`, capped 999.99), avg duration — persisted to DB, mirrored to Redis (`performance:{period}`, 7‑day TTL), and exported to the `win_rate_gauge` Prometheus metric. It runs in a fresh event loop with a `NullPool` engine to avoid the Celery+asyncio "TCPTransport closed" pool corruption.

---

### 6.6 The State Machine — formal lifecycle

`src/signals/state_machine.py` centralizes what used to be hand‑written status mutations spread across `engine.py`, `tracker.py`, and the API (a recipe for drift and bugs). Every state and every legal transition is declared; illegal transitions raise `InvalidSignalStateError`; each transition is recorded in an audit `history` with `actor`, `reason`, `metadata`, `timestamp`.

#### 6.6.1 States

| State | Meaning |
|---|---|
| `PENDING` | created, not yet published |
| `ACTIVE` | published, awaiting TP/SL |
| `TP1_HIT` | TP1 touched, trailing armed |
| `TP2_HIT` | TP2 touched, stop laddered to TP1 |
| `TP3_HIT` | final target — terminal |
| `SL_HIT` | stop hit — terminal |
| `TRAILING_HIT` | trailing stop hit — terminal |
| `CLOSED_MANUAL` | admin close — terminal |
| `EXPIRED` | timeout — terminal |
| `CANCELLED` | cancelled before ACTIVE — terminal |

#### 6.6.2 Transition diagram

```
                      ┌───────────┐
                      │  PENDING  │
                      └─────┬─────┘
              ┌─────────────┼─────────────┐
              ▼                           ▼
        ┌───────────┐               ┌───────────┐
        │ CANCELLED │◄(terminal)    │  ACTIVE   │
        └───────────┘               └─────┬─────┘
                      ┌────────────────────┼────────────────────────────┐
                      ▼          ▼         ▼            ▼                ▼
                ┌─────────┐ ┌─────────┐ ┌──────┐ ┌──────────────┐ ┌─────────┐
                │ TP1_HIT │ │ TP2_HIT*│ │SL_HIT│ │CLOSED_MANUAL │ │ EXPIRED │
                └────┬────┘ └────┬────┘ └──────┘ └──────────────┘ └─────────┘
       ┌────────────┼─────────┐ │ (* gap tick may skip TP1 → TP2 directly)
       ▼      ▼     ▼         ▼ ▼
  ┌────────┐ ┌──────────┐ ┌──────┐ ┌──────────────┐ ┌─────────┐
  │TP2_HIT │ │TRAILING_ │ │SL_HIT│ │CLOSED_MANUAL │ │ EXPIRED │
  └───┬────┘ │   HIT    │ └──────┘ └──────────────┘ └─────────┘
      ▼      └──────────┘
  ┌────────┐ ┌──────────┐ ┌──────┐ ...
  │TP3_HIT │ │TRAILING_ │ │SL_HIT│
  │(term.) │ │HIT(term.)│ └──────┘
  └────────┘ └──────────┘

Terminal (no outgoing): TP3_HIT, SL_HIT, TRAILING_HIT, CLOSED_MANUAL, EXPIRED, CANCELLED
```

The allowed‑transition table verbatim:

```python
_ALLOWED_TRANSITIONS = {
  PENDING:  {ACTIVE, CANCELLED},
  ACTIVE:   {TP1_HIT, TP2_HIT, SL_HIT, CLOSED_MANUAL, EXPIRED},  # TP2: gap tick may skip TP1
  TP1_HIT:  {TP2_HIT, TRAILING_HIT, SL_HIT, CLOSED_MANUAL, EXPIRED},
  TP2_HIT:  {TP3_HIT, TRAILING_HIT, SL_HIT, CLOSED_MANUAL, EXPIRED},
  TP3_HIT: set(), SL_HIT: set(), TRAILING_HIT: set(),
  CLOSED_MANUAL: set(), EXPIRED: set(), CANCELLED: set(),
}
```

`transition_to(new_state, actor, reason, metadata)` validates against this table, appends a `StateTransition` to history, and updates `current_state`. Helpers: `is_terminal()`, `is_active()` (active = not terminal and not PENDING), `can_transition_to()`, plus `fresh()` (new PENDING machine) and `from_state()` (rehydrate from DB).

---

### 6.7 End‑to‑end summary

A tick of life through CoinePro‑FX's brain: **candles → 7 analyzers + ML in parallel → calibrated 0–100 score (ML shrunk twice, HTF alignment rewarded) → regime‑aware direction → MTF/H1/confluence gates → per‑instrument SL/TP geometry (ATR‑floored, spread‑buffered, RR‑guaranteed) → position sizing → RiskGuard → Claude veto → dedup/cooldown → persisted `ACTIVE` signal → published.** Then the tracker watches every 10 seconds, ladders the stop from arm‑at‑TP1 through spread‑aware break‑even to TP2‑lock and profit‑only trailing, records real net P&L with idempotent fail‑closed closing, feeds the daily circuit breaker, and guarantees a closed position can never silently come back. The state machine is the referee that makes every one of those transitions legal, auditable, and impossible to drift.

---
---

## ۶. موتورِ سیگنال — هستهٔ تصمیم و چرخهٔ عمر

> **منبعِ این فصل:** تک‌تکِ فایل‌های `src/signals/` — `engine.py` (هماهنگ‌کننده، ۱۵۴۰+ خط)، `scorer.py` (ترکیبِ احتمالِ کالیبره‌شدهٔ ML با هم‌گراییِ قاعده‌محور)، `risk_manager.py` (هندسهٔ SL/TP۱‑۳/تریلینگ و ریاضیِ سود/زیانِ واقعی)، `tracker.py` (ردیابِ قیمتِ زنده، گذارهای TP/SL/سربه‌سر/تریلینگ، ثبتِ P&L، عدم‌بازگشایی)، `state_machine.py` (چرخهٔ عمرِ رسمی)، به‌علاوهٔ `trailing_stop.py` (Chandelier exit)، `news_filter.py`، `macro_filter.py`، `candle_utils.py`. هیچ‌چیزِ زیر ساختگی نیست؛ همه از کدِ در حالِ اجرا مستند شده است.

زیرسیستمِ سیگنال **هستهٔ تصمیم‌گیریِ** CoinePro‑FX است. کندل‌های چند‌تایم‌فریمی را می‌گیرد، آن‌ها را به‌موازات به هفت آنالایزر + اِنسمبلِ ML می‌فرستد، همه‌چیز را در یک **امتیازِ کالیبره‌شدهٔ ۰ تا ۱۰۰** فشرده می‌کند، امتیاز را از یک پشتهٔ گیت عبور می‌دهد (رژیم، وتوی چند‌تایم‌فریم، هم‌گرایی، گاردِ ریسک، «نظرِ دومِ» کلود)، هندسهٔ کاملِ SL/TP را با مدیرِ ریسکِ per‑instrument محاسبه می‌کند، سیگنال را ذخیره می‌کند و سپس آن را به یک **ردیابِ زنده** می‌سپارد که پوزیشن را تا پایان مدیریت می‌کند — TP1←تریلینگ، TP2←قفلِ نردبانی، بسته‌شدن با TP3/SL/سربه‌سر — ضمنِ ثبتِ سود/زیانِ خالصِ واقعی و تضمینِ این‌که پوزیشنِ بسته‌شده هرگز بی‌صدا دوباره باز نشود.

---

### ۶.۱ معماری در یک نگاه

```
            ┌──────────────────────────────────────────────────────────────────┐
            │                         SignalEngine                              │
            │   (engine.py — سرویسِ async، یک حلقهٔ تحلیل)                       │
            └──────────────────────────────────────────────────────────────────┘
                          │  هر ANALYSIS_INTERVAL_SECONDS = ۳۰۰ ثانیه
                          ▼
  ┌─ _analyze_symbol(symbol) ──────────────────────────────────────────────────┐
  │ ۱. _fetch_candles → همهٔ تایم‌فریم‌ها از Redis/TimescaleDB                  │
  │ ۲. drop_unclosed_candle → فقط روی کندلِ بسته (بدونِ look-ahead)            │
  │ ۳. asyncio.gather روی thread-pool:                                          │
  │      تکنیکال · کندل · الگوی نموداری · اسمارت‌مانی · حجم · S/R · ML          │
  │ ۴. MultiTimeframe → confluence_count, net_confluence, higher_tf_bias       │
  │ ۵. NewsFilter · detect_regime(df)                                          │
  │ ۶. تعیینِ جهت (روند/reversion/breakout) — رژیم‌آگاه                        │
  │ ۷. SignalScorer.score_from_analysis → ScoreBreakdown (۰–۱۰۰)              │
  │ ۸. MacroFilter (سوگیریِ نرمِ COT، ± هرگز هارد-بلاک)                        │
  │ ۹. گیت‌ها: وتوی MTF · کفِ امتیازِ H1 · الزامِ هم‌گرایی                      │
  │۱۰. اگر strength≠NO_SIGNAL و جهت≠neutral → _create_signal                    │
  └────────────────────────────────────────────────────────────────────────────┘
                          ▼
  ┌─ _create_signal → entry زنده · ATR · RiskManager · PositionSizer ·          │
  │    RiskGuard · Claude · dedup/cooldown/scalp · ذخیره · انتشار              │
                          ▼
  ┌─ SignalTracker (tracker.py — حلقهٔ ۱۰ ثانیه) ──────────────────────────────┐
  │  reconcile DB↔Redis · TP3→TP2→TP1→سربه‌سر→SL→تریلینگ                       │
  │  calculate_pnl · DailyLossLimit · قفلِ idempotent · عدم‌بازگشایی          │
  └────────────────────────────────────────────────────────────────────────────┘
```

موتور **دو scorer** می‌سازد — پیش‌فرض (روند) و یک نسخهٔ *رنج* با وزنِ سنگین روی ML/الگو — چون اندیکاتورهای روندی داخلِ رنج ساختاراً خنثی‌اند:

```python
self._scorer = SignalScorer()
self._scorer_ranging = SignalScorer(
    technical_weight=0.25, pattern_weight=0.30, ml_weight=0.45,
)
```

---

### ۶.۲ Scorer — احتمالِ کالیبره‌شدهٔ ML × هم‌گراییِ قاعده‌محور ← ۰ تا ۱۰۰

`scorer.py` جایی است که شواهدِ ناهمگن (تکنیکال، الگو، ML) به یک عدد تبدیل می‌شوند. فلسفهٔ طراحی مستقیماً در ثابت‌ها رمزگذاری شده: **مدلِ ML از نظرِ تاریخی مهارتِ منفی نشان داده** (نرخِ برد ≈ ۲۷–۳۳٪)، پس وزنش از ۰.۳۰ به ۰.۲۲ کاهش یافت و تأثیرش پیش از ورود به ترکیب، **به‌سمتِ خنثی کوچک می‌شود**.

#### ۶.۲.۱ وزن‌ها و اعتماد

```python
TECHNICAL_WEIGHT = 0.43
PATTERN_WEIGHT   = 0.35
ML_WEIGHT        = 0.22
ML_TRUST         = 0.55   # انحرافِ نمرهٔ ML از خنثی (۵۰) در این ضریب کوچک می‌شود
```

#### ۶.۲.۲ فرمولِ هسته

با زیرنمرات `T`, `P`, `M` (هرکدام clamp‑شده به ۰–۱۰۰)، ابتدا نمرهٔ ML به‌سمتِ میانهٔ ۵۰ کوچک می‌شود، سپس میانگینِ وزنی، سپس بونوس/جریمه، سپس clamp:

```python
ml_eff = 50.0 + (ml_score - 50.0) * ML_TRUST          # ML_TRUST = ۰.۵۵
weighted_base = (technical*tech_w + pattern*pattern_w + ml_eff*ml_w)
final = clamp(weighted_base + total_bonus + total_penalty, 0, 100)
```

به‌صورتِ فشرده، با وزن‌های پیش‌فرضِ روند:

```
score = clamp( 0.43·T + 0.35·P + 0.22·(50 + 0.55·(M − 50))
             + Σ بونوس − Σ جریمه , 0, 100)
```

تبدیلِ `ml_eff` یعنی یک خروجیِ ML کاملاً صعودیِ `M=100` فقط مثلِ `50 + 0.55·50 = 77.5` اثر می‌گذارد و `M=0` فقط مثلِ `22.5` — ML افراطی و نویزی می‌تواند تلنگر بزند ولی هرگز یک ستاپِ سالمِ تکنیکال/الگو را تسخیر نکند.

نکتهٔ ایمنیِ ظریف، خودِ clamp است که در برابرِ **NaN/inf مقاوم** شده، چون `max/min`ِ محافظت‌نشده یک `NaN` را به سقف تبدیل و یک سیگنالِ «کاملِ» ۱۰۰ جعل می‌کند:

```python
@staticmethod
def _clamp(value, low=0.0, high=100.0):
    if not math.isfinite(value):
        return (low + high) / 2     # NaN/inf → خنثیِ ۵۰، نه ۱۰۰ِ جعلی
    return max(low, min(high, value))
```

#### ۶.۲.۳ منشأِ سه زیرنمره

`score_from_analysis()` آداپتوری است که دیکشنری‌های خامِ آنالایزر را به `T/P/M` تبدیل می‌کند:

- **تکنیکال** `T` = `technical_score`.
- **الگو** `P` خودش ترکیب است: کندل ۵۰٪ + الگوی نموداری ۳۰٪ + اسمارت‌مانی ۲۰٪.
- **ML** `M` = `ml_score`، نمرهٔ جهتیِ کالیبره‌شدهٔ اِنسمبل (§۶.۲.۶).

#### ۶.۲.۴ بونوس‌ها و جریمه‌ها (لایهٔ هم‌گرایی)

| عامل | ثابت | مقدار | شرط |
|---|---|---|---|
| هم‌گراییِ چند‌TF | `MULTI_TF_CONFLUENCE_BONUS` | **+۵** | `confluence_count ≥ ۳` |
| تأییدِ حجم | `VOLUME_CONFIRMS_BONUS` | **+۳** | حجم تأیید کند |
| هم‌جهتِ HTF (قوی) | `HTF_ALIGNED_STRONG_BONUS` | **+۸** | جهت با بایاسِ قویِ روزانه/هفتگی |
| هم‌جهتِ HTF (ضعیف) | `HTF_ALIGNED_WEAK_BONUS` | **+۴** | جهت با بایاسِ `slightly_*` |
| کیفیتِ reversion | `reversion_quality` | **+۶…+۱۸** | reversionِ لبهٔ رنج با RSI افراطی |
| خلافِ روندِ اصلی | `AGAINST_MAJOR_TREND_PENALTY` | **−۱۰** | ستاپِ روندیِ خلافِ روند |
| اخبارِ پرتأثیرِ ≤۱h | `HIGH_IMPACT_NEWS_PENALTY` | **−۱۵** | (با مقدارِ دقیقِ `news_penalty` جایگزین) |
| reversionِ خلافِ HTF | `HTF_AGAINST_REVERSION_PENALTY` | **−۶** | reversionِ خلافِ بایاسِ قویِ HTF |

کد، **بونوسِ هم‌جهتیِ HTF را قوی‌ترین عاملِ نرخِ برد** توصیف می‌کند («شکافِ ۲۶–۴۷٪ بینِ معاملاتِ هم‌جهت و خلافِ HTF»). یک ستاپِ هم‌جهت با بایاسِ قویِ روزانه/هفتگی یک پاداشِ بزرگِ +۸ می‌گیرد تا مطمئن از آستانه عبور کند:

```python
if aligned:
    ctx.extra_bonuses["htf_aligned"] = (
        HTF_ALIGNED_STRONG_BONUS if _strong_bias else HTF_ALIGNED_WEAK_BONUS)
elif signal_strategy == "reversion":
    ctx.extra_penalties["htf_against"] = HTF_AGAINST_REVERSION_PENALTY
```

دو نکتهٔ درستی که در کد رمزگذاری شده:
- **جریمهٔ خلافِ روند برای استراتژی‌های `reversion` نادیده گرفته می‌شود** — یک ستاپِ بازگشت‌به‌میانگین *ذاتاً* اندکی خلافِ روند است؛ جریمه‌اش یک خطای دسته‌بندی بود که ستاپ‌های سالمِ لبهٔ رنج را زیر ۶۰ می‌انداخت.
- **جریمهٔ اخبار دقیقاً یک‌بار** با مقدارِ واقعی‌اش اعمال می‌شود (`ctx.extra_penalties["news"] = news_penalty`)؛ باگِ قبلی هم −۱۵ ثابت و هم یک extra اضافه می‌کرد و آن را دوبرابر می‌شمرد.

#### ۶.۲.۵ آستانه‌های طبقه‌بندی

```python
if score >= settings.STRONG_SIGNAL_SCORE:  # ۸۵ → STRONG
elif score >= settings.MIN_SIGNAL_SCORE:   # ۷۰ → MEDIUM
else: NO_SIGNAL
```

پس گیتِ زنده **MIN_SIGNAL_SCORE = ۷۰** و **STRONG = ۸۵** است. فقط `STRONG`/`MEDIUM` با جهتِ غیرخنثی به `_create_signal` می‌روند.

#### ۶.۲.۶ خودِ نمرهٔ ML (کالیبراسیونِ بالادست)

`ml_score` از `EnsemblePredictor.predict()` می‌آید — یک **نمرهٔ جهت‑اطمینان** حول ۵۰: هر مدلِ جهت‌دار با `±50·اطمینان·وزن` رأی می‌دهد، انحراف بر وزنِ جهت‌دارِ حاضر نرمال می‌شود و نتیجه با `ML_SCORE_SHRINK` **به‌سمتِ ۵۰ کوچک** می‌شود تا بیش‌اطمینانیِ مدل‌های اورفیت که به ۰/۱۰۰ اشباع می‌شوند خنثی شود:

```python
direction_score = 50.0 + (deviation / dir_weight if dir_weight > 0 else 0.0)
if _shrink < 1.0:
    direction_score = 50.0 + (direction_score - 50.0) * _shrink
```

اگر هیچ مدلِ جهت‌داری لود نشده باشد نتیجه **degraded** است (`ml_score=50`، خنثی) — و موتور این را با متریکِ `ml_fallback_total` و هشدار آشکار می‌کند نه این‌که بی‌صدا هر امتیاز را به میانه بکشد. همین نمرهٔ ۵۰‑محور است که `ml_eff`ِ scorer دوباره مرکزگرا می‌کند — یک میرایی‌سازیِ عمدیِ دولایه روی مدلی غیرقابل‌اتکا.

---

### ۶.۳ جهتِ رژیم‌آگاه + پشتهٔ گیت‌ها

پیش از امتیازدهی، موتور رژیم را تشخیص می‌دهد (`detect_regime(df)`) و استراتژیِ جهت را متناسب انتخاب می‌کند:

- **رنج** → `_determine_reversion_direction` (نیاز به `rev_conf ≥ ۲` تأییدِ واقعی؛ fallbackِ حدسِ ML حذف شد چون منشأِ ستاپ‌های ضررده بود).
- **نوسانِ‌پایینِ فشرده** → `_determine_breakout_direction`.
- **transitional** (ADX ۲۰–۲۵) → `_determine_direction` با `min_votes=2` + رأیِ DI‑spread.
- **روند/نوسانِ‌بالا** → `_determine_direction` با **اجماعِ ۳‑رأیه** کامل.

`_determine_direction` یک رأی‌گیریِ وزنی است: تکنیکال (±۲)، کندل (±۱)، نموداری (±۱)، اسمارت‌مانی (±۲)، ML (پلکانی: اطمینانِ >۰.۵۵ = ±۲، >۰.۳۵ = ±۱)، MTF (±۲ قوی / ±۱ ضعیف). جهتی برنده می‌شود که هم پیشتاز باشد و هم به `min_votes` برسد.

پس از امتیازدهی، **سه گیتِ سخت** هنوز می‌توانند سیگنالِ واجدِ شرایط را بکشند:

۱. **وتوی جهتیِ MTF** — برای سیگنال‌های روند، بلاک اگر بایاسِ تایمِ بالا قویاً مخالف باشد یا `net_confluence` قویاً مخالف (`|net| ≥ ۲`). `net=0` یعنی «نبودِ تأیید»، نه «مخالفت» → عبور می‌کند. reversion فقط خلافِ یک بایاسِ *قوی* بلاک می‌شود و **اندیس‌ها (US30/US500/NAS100/DE40) reversionِ خلافِ هر بایاس را بلاک می‌کنند** چون داده نشان داد reversionِ ضدروند روی اندیس‌ها بدترین نرخِ برد را داشت.
۲. **کفِ امتیازِ H1** — `primary_tf=="H1"` باید `H1_MIN_SCORE = ۷۰` را رد کند.
۳. **الزامِ هم‌گرایی** — وقتی `SIGNAL_REQUIRE_CONFLUENCE` و `final_score < SIGNAL_CONFLUENCE_FREE_SCORE (۷۵)`، سیگنال باید *دستِ‌کم یکی* از این‌ها را داشته باشد: netِ MTF هم‌جهت، حجمِ تأییدکننده، یا بایاسِ HTF هم‌جهت. سیگنال‌های قوی (≥۷۵) آزادانه عبور می‌کنند. فلسفه: «کمتر ولی باکیفیت‌تر».

---

### ۶.۴ مدیرِ ریسک — هندسهٔ SL/TP + ریاضیِ P&Lِ واقعی

`risk_manager.py` ورود + ATR + ساختار را به قیمت‌های مشخص تبدیل می‌کند. ثابت‌ها درس‌های داده‌محورِ کالیبراسیونِ `۲۰۲۶-۰۶` را رمزگذاری می‌کنند:

```python
ATR_SL_MULTIPLIER       = 2.5    # کفِ SL = ۲.۵×ATR؛ S/R فقط می‌تواند گشادتر کند
ATR_TRAILING_MULTIPLIER = 1.0
TP1_RR_RATIO = 1.5   # قبلاً ۱.۰۵ → ریاضاً ضررده در WR~۴۶٪؛ ۱.۵ → PF مثبت
TP2_RR_RATIO = 2.2
TP3_RR_RATIO = 3.2
```

#### ۶.۴.۱ حد ضرر: دورترین بینِ ATR و S/R، سپس بافرِ اسپرد

SL از `entry ∓ ATR·2.5` شروع می‌شود، سپس با نزدیک‌ترین S/R مقایسه و **دورتری** انتخاب می‌شود — S/R فقط می‌تواند استاپ را *گشادتر* کند، نه تنگ‌تر داخلِ نویز:

```python
if is_long:  sl_price = min(atr_sl_price, sr_sl_price)   # پایین‌تر = دورتر
else:        sl_price = max(atr_sl_price, sr_sl_price)    # بالاتر = دورتر
```

سپس یک **بافرِ اسپرد** کم می‌شود (علتِ مهمِ استاپِ زودرس روی نمادهای پراسپرد مثلِ طلا/شاخص/نفت این بود که استاپ روی فاصلهٔ ATR بدونِ درنظرگرفتنِ اسپرد گذاشته می‌شد)، و در پایان **حداقلِ فاصلهٔ per‑instrument** اعمال می‌شود: `max(MIN_SL_PIPS=5, min_stop_pips_of(symbol))` یعنی `stops_level`ِ واقعیِ بروکر.

#### ۶.۴.۲ اهداف: کفِ RR اول، ساختار به‌عنوانِ تأیید

TP۱/۲/۳ = `entry ± risk_distance · RR`. اصلاحِ کلیدی: قبلاً TP1 حتی وقتی RR را زیرِ کف می‌شکست به نزدیک‌ترین S/R اسنپ می‌شد (علتِ اصلیِ ردِ `LOW_RR`). حالا `raw_tp1` (که `RR = tp1_rr` را تضمین می‌کند) کف می‌ماند؛ S/R نزدیک فقط *ثبت* می‌شود. TP2 با فیبوناچی (اگر در `۱٪` باشد) و TP3 با اوردربلاک/عرضه‌تقاضا (در `۱.۵٪`، لبهٔ محافظه‌کارانه) تأیید می‌شوند. سپس یک **گاردِ یکنواختی** ترتیبِ `TP1<TP2<TP3` را تضمین می‌کند و در صورتِ شکست به TP خامِ RR برمی‌گردد.

#### ۶.۴.۳ ریاضیِ P&L (جهت‌آگاه، دلارِ per‑lot)

`calculate_pnl` منبعِ واحدِ سود/زیان برای ردیابِ زنده و بستنِ آخرهفته است:

```python
pnl_pips   = (current - entry)/pip_value  if long  else  (entry - current)/pip_value
pnl_dollar = pnl_pips * (pip_dollar_of(symbol) * lot_size)
```

ردیاب **قیمتِ خروجِ جهت‌درست** را به آن می‌دهد (لانگ با BID، شورت با ASK)، پس اسپرد هرگز بی‌صدا نادیده نمی‌ماند.

---

### ۶.۵ Tracker — مدیرِ زندهٔ چرخهٔ عمر

`tracker.py` یک حلقهٔ `TRACKING_INTERVAL_SECONDS = ۱۰` ثانیه‌ای اجرا می‌کند. هر چرخه:

۱. **هم‌سان‌سازیِ DB↔Redis** (هر ۱۰ دقیقه throttle): هر سیگنالِ `active` در DB که از Redis افتاده (انقضای کلید / evictionِ LRU) دوباره ساخته می‌شود تا مانیتور بماند — بدونِ این، پوزیشنِ یتیم برای همیشه باز می‌ماند (باگِ پوزیشنِ ۳‑روزه).
۲. همهٔ سیگنال‌های فعال را **به‌موازات** بررسی می‌کند (`asyncio.gather` + `Semaphore(20)`).

#### ۶.۵.۱ ترتیبِ تصمیمِ هر تیک

`_check_single_signal` سطوح را با اولویتِ سخت ارزیابی می‌کند — **TP3 → TP2 → TP1 → سربه‌سرِ پیش‌از‌TP1 → SL → بروزرسانیِ تریلینگ**. مقادیرِ بولینِ Redis ممکن است رشته باشند (`"False"` در پایتون truthy است!)، پس همه‌جا از `_coerce_bool`ِ مقاوم استفاده می‌شود.

#### ۶.۵.۲ TP1 ← مسلح‌سازیِ تریلینگ + کفِ سربه‌سرِ اسپرد‌آگاه

روی TP1 پوزیشن بسته *نمی‌شود* (مگر `EXIT_CLOSE_AT_TP1`). به‌جایش تریلینگ روی `current − ATR·1.0` مسلح و سپس **بالای ورود به‌اندازهٔ (اسپرد + ۲ پیپ) کف‌گذاری** می‌شود تا برگشت با سودِ کوچک بسته شود نه ضررِ کوچک — رفعِ دردِ «سربه‌سرِ ضررده»:

```python
_floor = (spread_pips_of(symbol) + 2.0) * pip_size_of(symbol)
be_floor = entry + _floor  (long)  /  entry - _floor  (short)
trailing_sl = max(trailing_sl, be_floor)  (long)  /  min(...)  (short)
```

#### ۶.۵.۳ سربه‌سرِ پیش‌از‌TP1 (pre‑move)

یک درسِ کلیدیِ کالیبراسیون اینجاست. سربه‌سرِ زودرس (انتقالِ استاپ به ورود در ۳۳٪ مسیرِ TP1) بردها را با کوچک‌ترین برگشتِ طبیعی «سرِ صفر» می‌بست و **بُردِ فانتوم** ثبت می‌کرد در‌حالی‌که حساب چیزی نمی‌گرفت. بازنویسی، استاپ را فقط وقتی جابه‌جا می‌کند که قیمت **۸۰٪ مسیرِ TP1** را رفته باشد (`BREAKEVEN_TRIGGER_FRAC = 0.8`) و نه روی صفر بلکه با یک **سودِ کوچکِ اسپرد‌آگاه** قفل می‌کند (`BE_LOCK_FRAC = 0.25` از مسیرِ TP1، با کفِ `اسپرد + ۲ پیپ`):

```python
if _tgt > 0 and _prog >= BREAKEVEN_TRIGGER_FRAC * _tgt:        # ۸۰٪ مسیر
    _min_lock = (spread_pips_of(symbol) + 2.0) * pip_size_of(symbol)
    _lock = max(BE_LOCK_FRAC * _tgt, _min_lock)               # ≥ ۲۵٪ مسیرِ TP1
    be_level = entry + _lock  (long)  /  entry - _lock  (short)
    signal_data["be_premove"]  = True
```

پرچمِ `be_premove` بعداً برای برچسب‌زنیِ درستِ بستن استفاده می‌شود (`BREAKEVEN` در برابرِ `TRAILING_SL` در برابرِ `SL_HIT`).

#### ۶.۵.۴ TP2 ← قفلِ نردبانی

روی TP2 استاپ دستِ‌کم تا **TP1** بالا می‌رود (هرگز زیرِ تریلِ قبلی)، پس برگشت از اینجا به بعد سودِ TP1 را تثبیت می‌کند نه سربه‌سر.

#### ۶.۵.۵ بروزرسانیِ تریلینگ (یکنواخت، فقط‌سود)

`_update_trailing_stop` دوباره `current ∓ ATR·1.0` را حساب می‌کند و **فقط اگر بهتر شود** استاپ را جابه‌جا می‌کند (بالاتر برای لانگ، پایین‌تر برای شورت) — هرگز عقب نمی‌رود. (یک موتورِ غنی‌ترِ Chandelier در `trailing_stop.py` هست: `chandelier_exit = highest_high(22) − ATR·mult`، با مراحلِ `INITIAL → BREAKEVEN → LOCKED_TP1 → LOCKED_TP2 → TIGHT`؛ مرحلهٔ TIGHT ضریب را وقتی Rِ تحقق‌نیافته ≥ ۳ است فشرده می‌کند تا از give‑back جلوگیری شود.)

#### ۶.۵.۶ بستن: idempotent، fail‑closed، بدونِ شمارشِ دوگانه

`_close_signal` تنها قیفِ هر رویدادِ پایانی است. دو گاردِ مستقل از double‑close/double‑count در چرخه‌های هم‌زمان جلوگیری می‌کنند:

```python
# ۱) قفلِ Redis — fail-CLOSED: اگر Redis خطا داد، بستن block می‌شود
locked = await redis.client.set(f"lock:close:{signal_id}", "1", nx=True, ex=300)
if not locked: return
# ۲) گاردِ سطحِ DB — فقط ردیفِ active بسته می‌شود
UPDATE signal SET status='closed', ... WHERE id=:id AND status='active'
if rowcount == 0: await redis.remove_active_signal(signal_id); return
```

روی بستنِ واقعی: `pnl_pips/pnl_dollar/close_reason/hit_target/duration_minutes` را می‌نویسد؛ ورودیِ فعالِ Redis را حذف می‌کند؛ متریکِ `signal_pnl_pips` را ثبت می‌کند؛ و **نتیجه را به مدارشکنِ روزانه گزارش می‌دهد** تا `consecutive_losses` و `realized_pnl` پیش بروند (خطا اینجا ERROR است — نوشتنِ ناموفق یعنی مدارشکنِ سرمایه ضررها را کمتر می‌شمارد).

#### ۶.۵.۷ برچسب‌زنیِ درستِ خروج

`_handle_sl_hit` *معنیِ* تاچِ SL را استنتاج می‌کند به‌جای مهرِ همیشگیِ «SL» (که قبلاً گزارش و لیبلِ ML را خراب می‌کرد):

| trailing == sl | tp1_hit | be_premove | close_reason | hit_target |
|---|---|---|---|---|
| بله | بله | — | `TRAILING_SL` | `TRAIL_WIN`/`TRAIL_BE`/`TRAIL_SL` بر اساسِ علامتِ P&L |
| بله | خیر | بله | `BREAKEVEN` | مشتق |
| خیر | — | — | `SL_HIT` | `SL` |

#### ۶.۵.۸ تضمینِ عدم‌بازگشایی و بستنِ آخرهفته

چون بستن با `WHERE status='active'` *و* قفلِ Redis محدود است، پوزیشنِ بسته‌شده (با TP/SL، با تسکِ آخرهفته، یا دستی روی هر دستگاه) **سمتِ سرور dismiss** می‌شود — چرخهٔ بعدیِ ردیاب ردیف/کلیدِ فعالی نمی‌یابد و بازسازی no‑op است. تسکِ Celeryِ `close_positions_weekend` همهٔ پوزیشن‌ها را جمعه به قیمتِ بازار می‌بندد، یک افزایشِ صریحِ `close_all_id`ِ EA را به مَستر + همهٔ کاربرانِ کپی می‌فرستد (تا پوزیشن‌های واقعیِ MT5 همان لحظه بسته شوند)، و با `WEEKEND_AUTO_CLOSE_ENABLED` قابلِ خاموش‌کردن است.

#### ۶.۵.۹ عملکردِ دوره‌ای (Celery)

`calculate_performance(period_type)` سیگنال‌های بسته را در ردیف‌های `SignalPerformance` تجمیع می‌کند (کلی + per‑symbol): نرخِ برد، پیپِ کل/میانگین، بیشینهٔ برد/باخت، **profit factor** (سقفِ ۹۹۹.۹۹)، میانگینِ مدت — در DB ذخیره، در Redis آینه (`performance:{period}`، TTLِ ۷‑روزه) و در متریکِ `win_rate_gauge` صادر می‌شود. در یک event‑loopِ تازه با engineِ `NullPool` اجرا می‌شود تا خرابیِ poolِ «TCPTransport closed»ِ Celery+asyncio رخ ندهد.

---

### ۶.۶ State Machine — چرخهٔ عمرِ رسمی

`state_machine.py` چیزی را که قبلاً تغییراتِ دستیِ پراکنده در `engine.py`، `tracker.py` و API بود (دستورِ آشپزیِ drift و باگ) مرکزی می‌کند. هر state و هر گذارِ مجاز اعلام شده؛ گذارِ نامجاز `InvalidSignalStateError` می‌دهد؛ هر گذار در یک `history`ِ ممیزی با `actor/reason/metadata/timestamp` ثبت می‌شود.

#### ۶.۶.۱ State ها

| State | معنی |
|---|---|
| `PENDING` | ساخته‌شده، هنوز publish‌نشده |
| `ACTIVE` | publish‌شده، در انتظارِ TP/SL |
| `TP1_HIT` | TP1 خورد، تریلینگ مسلح |
| `TP2_HIT` | TP2 خورد، استاپ روی TP1 |
| `TP3_HIT` | هدفِ نهایی — terminal |
| `SL_HIT` | استاپ خورد — terminal |
| `TRAILING_HIT` | تریلینگ خورد — terminal |
| `CLOSED_MANUAL` | بستنِ ادمین — terminal |
| `EXPIRED` | timeout — terminal |
| `CANCELLED` | لغو پیش از ACTIVE — terminal |

#### ۶.۶.۲ نمودارِ گذار

```
                      ┌───────────┐
                      │  PENDING  │
                      └─────┬─────┘
              ┌─────────────┴─────────────┐
              ▼                           ▼
        ┌───────────┐               ┌───────────┐
        │ CANCELLED │ (terminal)    │  ACTIVE   │
        └───────────┘               └─────┬─────┘
                      ┌──────────┬─────────┼──────────┬──────────┐
                      ▼          ▼         ▼          ▼          ▼
                 ┌─────────┐┌─────────┐┌──────┐┌────────────┐┌─────────┐
                 │ TP1_HIT ││ TP2_HIT*││SL_HIT││CLOSED_MANUAL││ EXPIRED │
                 └────┬────┘└────┬────┘└──────┘└────────────┘└─────────┘
       ┌──────────────┼─────────┐ │  (* تیکِ گپ ممکن است TP1 را رد و مستقیم TP2 بزند)
       ▼      ▼       ▼         ▼ ▼
  ┌────────┐┌──────────┐┌──────┐┌────────────┐┌─────────┐
  │TP2_HIT ││TRAILING_ ││SL_HIT││CLOSED_MANUAL││ EXPIRED │
  └───┬────┘│   HIT    │└──────┘└────────────┘└─────────┘
      ▼     └──────────┘
  ┌────────┐┌──────────┐┌──────┐ ...
  │TP3_HIT ││TRAILING_ ││SL_HIT│
  │(term.) ││HIT(term.)│└──────┘
  └────────┘└──────────┘

Terminal (بدونِ خروجی): TP3_HIT, SL_HIT, TRAILING_HIT, CLOSED_MANUAL, EXPIRED, CANCELLED
```

جدولِ گذارِ مجاز عیناً:

```python
_ALLOWED_TRANSITIONS = {
  PENDING:  {ACTIVE, CANCELLED},
  ACTIVE:   {TP1_HIT, TP2_HIT, SL_HIT, CLOSED_MANUAL, EXPIRED},  # TP2: تیکِ گپ
  TP1_HIT:  {TP2_HIT, TRAILING_HIT, SL_HIT, CLOSED_MANUAL, EXPIRED},
  TP2_HIT:  {TP3_HIT, TRAILING_HIT, SL_HIT, CLOSED_MANUAL, EXPIRED},
  TP3_HIT: set(), SL_HIT: set(), TRAILING_HIT: set(),
  CLOSED_MANUAL: set(), EXPIRED: set(), CANCELLED: set(),
}
```

`transition_to(new_state, actor, reason, metadata)` در برابرِ این جدول اعتبارسنجی می‌کند، یک `StateTransition` به history می‌افزاید و `current_state` را به‌روز می‌کند. کمکی‌ها: `is_terminal()`، `is_active()` (فعال = نه terminal و نه PENDING)، `can_transition_to()`، به‌علاوهٔ `fresh()` (ماشینِ PENDINGِ جدید) و `from_state()` (بازسازی از DB).

---

### ۶.۷ جمع‌بندیِ سرتاسری

یک تپشِ حیات در مغزِ CoinePro‑FX: **کندل‌ها → ۷ آنالایزر + ML به‌موازات → امتیازِ کالیبره‌شدهٔ ۰–۱۰۰ (ML دوبار کوچک، هم‌جهتیِ HTF پاداش) → جهتِ رژیم‌آگاه → گیت‌های MTF/H1/هم‌گرایی → هندسهٔ SL/TPِ per‑instrument (کفِ ATR، بافرِ اسپرد، RRِ تضمین‌شده) → سایزینگِ پوزیشن → RiskGuard → وتوی کلود → dedup/cooldown → سیگنالِ `ACTIVE`ِ ذخیره‌شده → منتشر.** سپس ردیاب هر ۱۰ ثانیه می‌نگرد، استاپ را از مسلح‌شدن‌در‌TP1 تا سربه‌سرِ اسپرد‌آگاه، قفلِ TP2 و تریلینگِ فقط‌سود نردبان می‌کند، سود/زیانِ خالصِ واقعی را با بستنِ idempotent و fail‑closed ثبت می‌کند، مدارشکنِ روزانه را تغذیه می‌کند و تضمین می‌کند پوزیشنِ بسته‌شده هرگز بی‌صدا برنگردد. State machine داورِ ای است که هر یک از این گذارها را قانونی، قابلِ‌ممیزی و غیرقابلِ‌انحراف می‌کند.

---

[⬅ 5. The Machine‑Learning Subsystem](machine-learning.md) · [🏠 Home · خانه](../README.md) · [7. Institutional‑Grade Risk Management ➡](risk-management.md)
