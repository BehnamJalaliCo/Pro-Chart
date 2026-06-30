[⬅ 7. Institutional‑Grade Risk Management](risk-management.md) · [🏠 Home · خانه](../README.md) · [9. The API Layer — FastAPI Gateway, Routing, Auth & Real‑Time ➡](api.md)

---

## 8. Backtesting, Walk-Forward & Live-Readiness Gating

> **Module map**
> `src/backtest/` — `engine.py`, `simulator.py`, `cost_model.py`, `metrics.py`, `walk_forward.py`, `advanced_metrics.py`, `reporting.py`
> `src/launch/` — `paper_trading.py`, `divergence.py`, `preflight.py`

This chapter documents the part of CoinePro-FX that decides whether the strategy is *allowed* to touch real money. It is the most safety-critical layer in the project, and its design follows one philosophy: **a signal is guilty until proven profitable, after costs, on data it has never seen.** Nothing reaches a live account until it has survived (1) bar-by-bar simulation with realistic costs, (2) out-of-sample walk-forward validation, (3) a multi-week paper-trading forward test, (4) a paper-vs-backtest divergence check, and (5) a hard preflight gate. Each of those five stages is real code; we walk through all of it.

---

### 8.1 The big picture — five gates between an idea and a live order

```
                 ┌─────────────────────────────────────────────────────────┐
   historical    │  GATE 1  BacktestEngine.run()                           │
   signals  ───► │   per-signal bar-by-bar TradeSimulator.simulate()       │
                 │   + CostModel (spread / commission / swap / slippage)   │
                 └───────────────────────────┬─────────────────────────────┘
                                             ▼
                 ┌─────────────────────────────────────────────────────────┐
   full          │  GATE 2  WalkForwardValidator.run()                     │
   history  ───► │   rolling train/test folds → aggregated OOS metrics     │
                 │   (overfit exposed: tested only on the *future*)        │
                 └───────────────────────────┬─────────────────────────────┘
                                             ▼
                 ┌─────────────────────────────────────────────────────────┐
   live engine   │  GATE 3  paper_trading.py  (TRADING_MODE=paper)         │
   (real-time)──►│   signals emitted exactly like live but NOT published   │
                 │   to users; stored is_paper=true; tracked normally      │
                 └───────────────────────────┬─────────────────────────────┘
                                             ▼
                 ┌─────────────────────────────────────────────────────────┐
   paper vs      │  GATE 4  divergence.compare_paper_with_backtest()       │
   backtest  ───►│   degradation detector → block_launch / proceed         │
                 └───────────────────────────┬─────────────────────────────┘
                                             ▼
                 ┌─────────────────────────────────────────────────────────┐
   environment   │  GATE 5  preflight.run_preflight()                      │
   + DB + ML ───►│   CRITICAL checks all green → flip TRADING_MODE=live     │
                 └─────────────────────────────────────────────────────────┘
```

The current project state (per `CLAUDE.md`) is **`TRADING_MODE=paper`**: the system is sitting between Gate 3 and Gate 5, accumulating forward-test data on the live broker before the divergence report is allowed to authorize `live`.

---

### 8.2 The cost model — making backtest P&L resemble reality

`src/backtest/cost_model.py` is the foundation. A backtest that ignores transaction costs always looks brilliant and always lies. Every other component receives a `CostModel`, so cost realism is centralized.

#### 8.2.1 Per-symbol cost profiles

Costs are *not* global — they are per instrument, because spread, pip value, and swap differ enormously between, say, `EURUSD` and `XAUUSD`. Each instrument has a `SymbolCostProfile`:

| Field | Meaning |
|---|---|
| `pip_size` | price increment of one pip (e.g. `0.0001` EURUSD, `0.1` XAUUSD, `0.01` USDJPY) |
| `pip_dollar_per_lot` | $ P&L per 1 pip × 1 standard lot (EURUSD `10.0`, XAGUSD `50.0`) |
| `spread_pips` | average spread (EURUSD `1.0`, XAUUSD `3.0`, GBPJPY `2.5`) |
| `commission_per_side_per_lot` | ECN-style commission per side (default `0.0` → standard account) |
| `swap_long_pips_per_night` / `swap_short_pips_per_night` | overnight financing in pips/lot, signed (+ receive / − pay) |
| `entry_slippage_pips` | default `1.0` — fills are ~1 pip worse than seen |
| `stop_slippage_pips` | default `2.0` — stop-outs get chased ~2 pips worse |

`CostModel.default()` builds profiles for ~20 instruments (FX majors/crosses, metals, energies, indices). For an **unknown** symbol, `profile()` returns a deliberately *conservative* fallback (spread 3.0, swap −0.5 both sides) — the cost model never flatters an unrecognized instrument.

#### 8.2.2 The four cost components

**1. Spread.** Markets are two-sided. The model enforces the market-maker rule throughout:

- **LONG** enters at **ASK** = `mid + ½·spread`, exits at **BID** = `mid − ½·spread`
- **SHORT** enters at **BID** = `mid − ½·spread`, exits at **ASK** = `mid + ½·spread`

So *every* trade starts underwater by the full spread before price moves at all. In `simulator.py`:

```python
half_spread = profile.spread_pips * pip * 0.5
if direction == "long":
    entry_actual = entry_price_mid + half_spread
else:
    entry_actual = entry_price_mid - half_spread
```

**2. Slippage.** Two flavours, applied via `apply_entry_slippage` / `apply_stop_slippage`. Both always move the price *against* the trader:

```python
# entry: LONG fills higher (worse), SHORT fills lower (worse)
return entry_price + slip if direction == "long" else entry_price - slip
# stop:  LONG stop executes lower, SHORT stop executes higher
return stop_price - slip if direction == "long" else stop_price + slip
```

Stop slippage (`2.0` pips) is intentionally double entry slippage (`1.0`) because stops are filled into a fast-moving market that "chases" you.

**3. Commission.** Round-turn = 2 × per-side: `commission_round_turn() → 2.0 * commission_per_side_per_lot * lot_size`. Default is `$0` (standard account); set the per-side value to model an ECN account.

**4. Swap (overnight financing).** This is the subtle one. `swap_cost_dollar()` counts rollover nights between entry and exit and multiplies by the directional swap rate:

```
swap_$ = rollover_units × swap_pips_per_night × pip_dollar_per_lot × lot_size
```

`_count_rollover_nights()` implements genuine FX rollover convention by stepping a cursor through 22:00 UTC each day:

| Weekday | Treatment | Why |
|---|---|---|
| Mon, Tue, Thu | `+1` night | normal single swap |
| **Wed** | **`+3` nights (triple)** | T+2 settlement: Wed's roll settles over the weekend |
| Fri, Sat, Sun | `+0` | market closed; Friday's settlement was already triple-charged Wednesday |

That Wednesday-triple-swap rule is the kind of detail amateur backtesters miss, and it materially changes the P&L of multi-day holds on negative-carry pairs (e.g. `XAUUSD` long at `−1.5` pips/night).

> **Reporting note.** In `TradeOutcome`, `gross_pips` is computed from the *already cost-adjusted* `entry_actual`/`exit_actual`, so spread and slippage are baked into the realized price. The separate `spread_cost_pips` / `slippage_cost_pips` fields are informational only (`net_pips = gross_pips`), preventing the classic bug of double-subtracting costs.

---

### 8.3 The trade simulator — one signal, replayed bar by bar

`src/backtest/simulator.py` turns *(signal + future candles)* into a fully-costed `TradeOutcome`. This is event-driven replay at the bar level: each candle is inspected in order, and the trade closes the moment a stop or target is touched.

#### 8.3.1 Inputs and the mid-price convention

Levels (`sl`, `tp1`, `tp2`, `tp3`) and `entry_price_mid` live in **mid-price space** — the same space the signal engine produced them in. The simulator translates to executable ASK/BID prices internally. This keeps the SL distance (and therefore the R-multiple denominator) consistent with how the strategy reasoned about the trade:

```python
initial_risk_pips = abs(entry_price_mid - sl) / pip
```

#### 8.3.2 The per-bar loop

For each of up to `max_bars` future candles the simulator checks, **in priority order**:

1. **Gap-through on the open** (worst/best case first). If the bar *opens* already past a level, the fill is at the open, not the level — modelling weekend/news gaps honestly:
   - LONG: `open ≤ active_sl` → stop fill at `open` (worse than SL); `open ≥ best_tp` → target fill at `open` (better than TP).
   - SHORT: mirror image.
2. **Intrabar range** (`low`/`high`). LONG: `low ≤ sl` = stop hit; `high ≥ tp3/tp2/tp1` = target hit (highest reachable TP wins). SHORT mirrored.
3. **Stop-vs-target tie-break.** If a single bar's range covers *both* the stop and a target, **the stop wins** (conservative worst-case):

```python
# محافظه‌کارانه: اگر هم stop و هم TP در یک کندل hit شدند → stop می‌برد
if hit_stop:
    exit_price_mid = active_sl
    ...
    break
```

This single assumption is what separates an honest backtest from a fantasy one. Most overfit backtests silently assume the target was hit first; CoinePro-FX assumes the loss.

#### 8.3.3 Optional trailing after TP1

When `use_trailing_after_tp1=True`, hitting TP1 does **not** close the trade; instead it moves the stop to break-even (`active_sl = entry_price_mid`) and the trade continues hunting TP2/TP3. A subsequent stop-out is then labelled `TRAILING_STOP` rather than `STOP_LOSS`. (The signal-replay engine calls the simulator with this off by default, but the capability exists for trailing-strategy studies.)

#### 8.3.4 Exit reasons and timeout

`ExitReason` ∈ {`STOP_LOSS`, `TAKE_PROFIT_1/2/3`, `TRAILING_STOP`, `TIMEOUT`, `END_OF_DATA`}. If no level is touched within `max_bars` (default 500), the trade is force-closed at the last candle's close — `TIMEOUT` if it hit the bar cap, `END_OF_DATA` if it simply ran out of candles. No trade is left open forever, so metrics can never be inflated by "still hoping" positions.

#### 8.3.5 The output: a fully-costed `TradeOutcome`

```python
gross_pnl_dollar = gross_pips * profile.pip_dollar_per_lot * lot_size
commission_dollar = self._cost.commission_round_turn(symbol, lot_size)
swap_dollar       = self._cost.swap_cost_dollar(symbol, direction, entry_time, exit_time, lot_size)
net_pnl_dollar    = gross_pnl_dollar - commission_dollar + swap_dollar
r_multiple        = net_pips / initial_risk_pips
```

`TradeOutcome` carries everything downstream needs: pip and dollar P&L (gross *and* net), each cost component, the **R-multiple** (the universal risk-normalized unit), duration, candles held, and a free-form `tags` dict used for attribution.

---

### 8.4 The backtest engine — signal-replay over history

`src/backtest/engine.py` orchestrates a whole campaign of signals through the simulator. Its purpose (from the docstring): *run past live signals to measure real, post-cost performance, which can then be compared against the ML model's in-sample metrics to quantify overfit.*

#### 8.4.1 The replay loop

`BacktestEngine.run()`:

1. Sorts signals by `entry_time` (chronological causality is mandatory).
2. For each signal, slices **only the candles strictly after entry** via `_slice_future()` (UTC-normalized to avoid double-timezone bugs). A signal with no future data is *skipped*, not faked.
3. Computes a **risk-based lot size** from the *current running balance* (compounding):

```
risk_$   = balance × risk_pct/100
sl_pips  = |entry − sl| / pip_size
lot      = risk_$ / (sl_pips × pip_dollar_per_lot)
```

   Crucially, if `lot < 0.01` the trade is **rejected, not clamped** — clamping up to the minimum lot would silently inflate risk by up to 10× and corrupt the equity curve. Lots are capped at 100.

4. Runs the simulator, appends the `TradeOutcome`, and updates `balance += net_pnl_dollar`.
5. **Ruin stop:** if `balance ≤ 0`, the loop breaks — a blown account cannot keep trading.

#### 8.4.2 Component attribution — *which part of the brain earned the money?*

Each `BacktestSignal` knows its `technical_score`, `pattern_score`, and `ml_score`. `dominant_component()` attributes the signal to whichever component pulled it furthest from neutral (50), using the scorer's production weights:

```python
contribs = {
    "technical": (technical_score - 50.0) * 0.4,
    "pattern":   (pattern_score   - 50.0) * 0.3,
    "ml":        (ml_score        - 50.0) * 0.3,
}
```

The engine tags every trade with `dominant_component` (and a `signal_score_bucket` of strong/medium/weak), then `attribute_by_tag()` splits performance by tag. The `BacktestResult.attribution_by_component` answers a question most systems can't: *is the ML model actually adding alpha, or is technical analysis carrying it?* If the `ml`-dominant bucket has a worse expectancy than the `technical` bucket, that's a direct, data-driven signal to retrain or down-weight ML.

`BacktestResult.summary()` serializes everything (returns %, full metrics, per-component attribution, config snapshot) to a DB/API-friendly dict.

---

### 8.5 Performance metrics — the scorecard

`src/backtest/metrics.py::calculate_metrics()` reduces a list of `TradeOutcome` into a `PerformanceMetrics` scorecard.

#### 8.5.1 Core formulas

| Metric | Formula / definition |
|---|---|
| Win rate | `winning_trades / total_trades` |
| Payoff ratio | `avg_win_$ / |avg_loss_$|` |
| **Profit factor** | `gross_profit / gross_loss` (`∞` if no losses) |
| Expectancy ($) | `total_net_$ / total_trades` |
| **Expectancy (R)** | `mean(r_multiple)` — the single most important edge number |
| Max drawdown ($, %, R) | peak-to-trough on the equity curve |
| Longest win/loss streak | run-length over signed P&L |
| **Sharpe** (annualized) | `mean(R)/std(R) · √252` |
| **Sortino** | like Sharpe but denominator is *downside* deviation only |
| Calmar | `expectancy_R · 252 / max_drawdown_R` |

#### 8.5.2 Two anti-bug subtleties worth highlighting

- **Equity curve seeded at 0.0.** Both the dollar and R equity curves start with a `[0.0]` baseline before the first trade. Without this, a first losing trade would make `peak == equity[0]` negative and render the drawdown *percentage* meaningless. The seed guarantees a sane peak.
- **Sortino's "no downside" case** correctly returns `+∞` when the mean is positive (a strategy that literally never had a losing period), instead of dividing by zero.

#### 8.5.3 Recursive per-symbol breakdown

With `group_by_symbol=True`, `calculate_metrics` recurses per symbol (with `group_by_symbol=False` to stop infinite recursion), so `PerformanceMetrics.by_symbol["XAUUSD"]` is itself a full scorecard. Combined with `attribute_by_tag`, you can slice performance by symbol *and* by signal component independently.

---

### 8.6 Advanced metrics — institutional-grade, López-de-Prado-aware

`src/backtest/advanced_metrics.py` adds the metrics that distinguish a real quant report from a hobbyist's. They require larger samples and reference the academic literature (Bailey & López de Prado 2012/2014, Keating & Shadwick 2002, Acerbi & Tasche 2002).

`compute_advanced_metrics(returns, periods_per_year=252, threshold=0.0, n_trials=1)` returns an `AdvancedMetrics` bundle:

| Metric | What it measures | Intuition |
|---|---|---|
| **MAR ratio** | `CAGR / |MaxDD|` | managed-account return-over-pain |
| **Calmar** | MAR over the trailing 36 months | recency-weighted MAR |
| **Ulcer index** | `√(mean(drawdown²))` | penalizes *deep and prolonged* drawdowns |
| **Omega** | `Σ max(r−θ,0) / Σ max(θ−r,0)` | full-distribution gain/loss ratio, no normality assumption |
| **Tail ratio** | `|P95 gain| / |P5 loss|` | >1 good upside tail; <1 = "nickels in front of a steamroller" |
| **PSR** | `Pr(true SR > benchmark)` | confidence that the Sharpe is *real*, not luck |
| **DSR** | PSR deflated for multiple testing | guards against backtest cherry-picking |
| skew / excess kurtosis | shape of the return distribution | fat-tail / asymmetry awareness |

#### 8.6.1 Compounded equity (a fixed bug, documented in-code)

A comment records that drawdown/MAR previously used additive `cumsum`, which is dimensionally wrong for *fractional* returns. The current code compounds correctly:

```python
eq  = np.cumprod(1.0 + r)
pk  = np.maximum.accumulate(eq)
dd  = (pk - eq) / np.where(pk > 0, pk, 1.0)
mdd = float(dd.max())
cagr = end**(1/yrs) - 1
```

#### 8.6.2 PSR — is the Sharpe statistically real?

The Probabilistic Sharpe Ratio asks: given the *shape* (skew, kurtosis) and *length* of the return series, what is the probability the true Sharpe exceeds a benchmark (default 0)?

```
PSR = Φ( (SR_obs − SR_bench) · √(n−1) / σ_SR )

σ_SR = √( (1 − γ3·SR + (γ4−1)/4 · SR²) / (n−1) )
```

where `γ3` = skewness, `γ4` = (full) kurtosis. A PSR > 0.95 means 95% confidence the edge is real. Fat tails and negative skew *increase* `σ_SR` and *lower* PSR — exactly the conservatism you want.

#### 8.6.3 DSR — the overfitting deflator

`compute_dsr` is the headline anti-overfit tool. When you backtest `N` strategy variants and pick the best, its Sharpe is biased upward by selection alone. DSR estimates the expected maximum Sharpe under the null hypothesis using the Euler–Mascheroni-based extreme-value formula:

```
E[max SR_null] = σ_SR · [ (1−γ)·Φ⁻¹(1−1/N) + γ·Φ⁻¹(1−1/(N·e)) ],   γ = 0.5772…
```

and then computes PSR with *that* as the benchmark. The more variants you tried (`n_trials`), the higher the bar your real Sharpe must clear. With `n_trials=1`, DSR degrades gracefully to PSR.

---

### 8.7 Reporting — investor-grade visuals as plain dicts

`src/backtest/reporting.py` produces JSON-ready structures for the admin dashboard and investor reports. Everything is `dict`/`list` so it drops straight into the API.

- **Monthly returns heatmap** (`build_monthly_heatmap`): per-month % return computed against the *running balance at the start of each month*, and a properly **compounded** annual figure (`∏(1+rₘ) − 1`), not a naive sum. Output is `HeatmapRow` per year with 12 months + annual.
- **Rolling CAGR** (`rolling_cagr`, default 365-day window, 7-day step): `(final/initial)^(365/days) − 1`, skipping windows with < 5 trades.
- **Rolling Sharpe** (`rolling_sharpe`, default 90-day window on R-multiples), skipping windows with < 10 trades or zero variance.
- **Drawdown periods** (`identify_drawdown_periods`): walks the equity curve identifying every peak→trough→recovery episode above `min_drawdown_pct` (default 1%), recording trough depth ($ and %), days-to-trough, days-to-recovery, and an `is_ongoing` flag for an unrecovered drawdown. Sorted worst-first.
- **Benchmark comparison** (`compare_to_benchmark`): full Jensen analysis vs a benchmark (DXY, SPX…): annualized CAGRs, **beta** = `cov(s,b)/var(b)`, **alpha** = `R_s − [R_f + β(R_b − R_f)]`, correlation, and **information ratio** = `mean(active)/tracking_error · √252`.

---

### 8.8 Walk-forward validation — why a single split is not enough

`src/backtest/walk_forward.py` is Gate 2, and it is the antidote to the single biggest failure mode in quant trading: **overfitting**.

#### 8.8.1 The problem with one train/test split

A single 80/20 split tells you how the strategy did on *one* unseen period. But you (the researcher) saw the result, tweaked the strategy, and re-ran — leaking the test set into your decisions. After enough tweaks, your "out-of-sample" test is just a slower form of in-sample fitting. One split also can't tell you whether the edge is *stable* or got lucky in one regime.

#### 8.8.2 Rolling walk-forward

Walk-forward slides train/test windows across the entire history, always testing on the **future** relative to training:

```
fold 0:  [=== train ===][ test ]
fold 1:        [=== train ===][ test ]
fold 2:               [=== train ===][ test ]
...                                step →
```

`WalkForwardValidator.run(signals, candles, train_window, test_window, step=None, on_train=None)`:

```python
train_end  = train_start + train_window
test_start = train_end                       # test is strictly AFTER train
test_end   = test_start + test_window
if test_end > history_end: break             # stop when history is exhausted
train_sigs = [s for s in sorted_sigs if train_start <= s.entry_time < train_end]
test_sigs  = [s for s in sorted_sigs if test_start  <= s.entry_time < test_end]
if on_train: on_train(train_sigs)            # hook to RETRAIN ML on this fold
bt = engine.run(name=f"wf_fold_{i}", signals=test_sigs, ...)   # OOS only
all_oos_trades.extend(bt.trades)
train_start += step
```

Key design points:

- **Test is always strictly after train** (`test_start = train_end`) — no look-ahead leakage is structurally possible.
- **`step` defaults to `test_window`**, producing **non-overlapping** test windows, so every out-of-sample trade is counted exactly once when aggregating.
- **`on_train` callback** is the retraining hook: each fold can re-fit the ML model on that fold's training signals, mirroring how the live system would periodically retrain. This makes the OOS metrics a faithful simulation of *production reality*, not of a frozen model.
- It **fails loudly** if `history < train_window + test_window` (not even one fold is possible).

#### 8.8.3 The output that matters: aggregated OOS metrics

`WalkForwardResult` keeps each fold's metrics *and* the headline number: `aggregated_oos_metrics = calculate_metrics(all_oos_trades)` — the performance across *all* out-of-sample trades stitched together. Per-fold metrics expose **stability**: a strategy with a great average but one catastrophic fold is fragile and is treated as such. This is the number that should be compared to the in-sample/ML training metrics — a large gap *is* the overfit, quantified.

---

### 8.9 The launch module — the paper→live safety philosophy

Everything above measures the strategy on *history*. The launch module (`src/launch/`) governs the transition to *real time*, on the *real broker*, with real latency and real fills. The governing rule lives in `CLAUDE.md`:

> *TRADING_MODE stays `paper` until signal quality is confirmed on this broker; it flips to `live` only after the divergence report approves.*

#### 8.9.1 `paper_trading.py` — forward-test without exposure

`TradingMode` ∈ {`PAPER`, `LIVE`, `DISABLED`}. `PaperTradingConfig.from_settings()` reads `TRADING_MODE` and `BETA_CHANNEL_ID` from env, defaulting safely to `PAPER` on any unknown value. Two tiny gate functions decide system behaviour:

```python
should_publish_to_users(cfg) -> bool   # True only in LIVE
should_emit_signal(cfg)      -> bool   # False only in DISABLED
```

So in `paper` mode the engine still computes and tracks signals exactly as it would live — it simply **does not publish them to the public channel**. `publish_signal()` routes by mode:

| Mode | User channel? | Persistence key | Pub/Sub channel |
|---|---|---|---|
| `LIVE` | ✅ public channel | `signal:active:{id}` | `live_signals` |
| `PAPER` | ❌ (optional `beta_channel` only) | `paper:active:{id}` (7-day TTL) | `paper_signals` / `beta_signals` |
| `DISABLED` | ❌ nothing | — | — |

The `is_paper=true` flag is stamped onto every paper signal so performance is computed on a clean, separate population. The philosophy: **forward-test under live conditions, with zero downside to real users**, accumulating the very data Gate 4 needs.

#### 8.9.2 `divergence.py` — does live match the backtest?

This is the crux of the paper→live decision. If the backtest claims 65% win-rate but paper delivers 45%, the strategy is degrading on live data, and the documented causes are: ML overfit, regime change, an optimistic cost model (real slippage worse than assumed), or execution delay. `compare_paper_with_backtest(paper_metrics, backtest_metrics, paper_period_days, …)` produces a `DivergenceReport`.

Default per-metric degradation thresholds (% allowed drop from backtest):

| Metric | Threshold |
|---|---|
| `win_rate` | 15% |
| `profit_factor` | 30% |
| `expectancy_r` | 30% |
| `sharpe_ratio` | 40% |
| `avg_net_pips` | 25% |

The decision logic:

- **Guard rails first.** If `paper_n < min_paper_trades` (default 20) → `wait_for_more_data`. If backtest `n < 10` → `rerun_backtest_with_larger_window`. Statistically meaningless comparisons never produce a verdict.
- For each metric, compute `delta_pct = (paper − backtest)/|backtest|·100`, flag `is_significant` if `|delta_pct| ≥ threshold`, and label direction (improved / degraded / unchanged — for all these metrics, higher = better).
- **Verdict:** `overall_degraded = (significantly_degraded ≥ 2)` → `block_launch`. If something improved and nothing degraded → `proceed_with_launch`. Otherwise → `proceed_with_caution` (launch allowed but heavy monitoring required).

Requiring **two** significantly-degraded metrics avoids blocking on a single noisy number, while still catching genuine broad degradation. The report is meant to run weekly and gate the launch automatically.

#### 8.9.3 `preflight.py` — the final hard gate

`python -m src.launch.preflight` (also `docker compose exec api python -m src.launch.preflight`) is the last thing run before flipping to `live`. Each check is `CRITICAL`, `WARNING`, or `INFO`; **`is_ready_for_launch` is true iff zero CRITICAL checks fail** — warnings are surfaced but don't block.

| Check | Level | Pass condition |
|---|---|---|
| `no_default_passwords` | CRITICAL | DB/Redis/Admin passwords not in the weak-list (incl. config's `_INSECURE_PASSWORDS`, `123456`…); `JWT_SECRET_KEY` ≥ 32 chars and no "change" |
| `debug_off` | CRITICAL | `settings.DEBUG is False` |
| `telegram_token` | CRITICAL | `TELEGRAM_BOT_TOKEN` set, ≥ 20 chars |
| `redis_reachable` | CRITICAL | `connect()` + `ping()` succeed |
| `database_reachable` | CRITICAL | `SELECT 1` succeeds |
| `paper_trading_period` | CRITICAL | `MIN(Signal.created_at)` ≥ `min_days` ago (default 7) |
| `ml_models_present` | WARNING | ≥ 1 `*.joblib` under the model dir |
| `monitoring_active` | WARNING | `monitoring/prometheus.yml` + `alerts.yml` exist |
| `backup_script` | WARNING | `scripts/backup.sh` exists |
| `runbook_exists` | WARNING | `docs/RUNBOOK.md` exists |

The `paper_trading_period` CRITICAL check is the structural enforcement of the philosophy: **you physically cannot pass preflight until at least 7 days of real paper data exist.** The CLI prints a per-check report and exits `0` (ready) or `1` (blocked), making it usable as a CI/CD or deploy-script gate.

#### 8.9.4 Defense in depth — the full live-readiness contract

A signal can only become a live order if **all** of the following hold simultaneously:

1. It was profitable in costed bar-by-bar backtest (Gate 1), with the **stop-wins tie-break** and full spread/slippage/swap applied.
2. Its **aggregated out-of-sample** walk-forward metrics held up (Gate 2) — and the in-sample-vs-OOS gap is small (no overfit), optionally cross-checked by DSR.
3. ≥ 7 days of live **paper** trading have accumulated, tracked identically to live (Gate 3).
4. The **divergence report** shows fewer than 2 significantly-degraded metrics vs backtest (Gate 4).
5. **Preflight** is green on every CRITICAL check (Gate 5).

Only then does `TRADING_MODE` flip to `live`, at which point `should_publish_to_users()` returns `True` and `publish_signal()` begins routing to the public channel and `signal:active:{id}`. Until that moment, the worst a flawed strategy can do is disappoint a private beta channel — never a paying user, and never a real account.

That is the entire safety thesis of CoinePro-FX: **prove it on the past, prove it stays true on the unseen future, prove it survives the live broker in paper, prove paper matches backtest, prove the environment is production-hard — and only then risk a dollar.**

---
---

## ۸. بک‌تست، اعتبارسنجیِ پیش‌رونده و دروازهٔ آمادگیِ زنده

> **نقشهٔ ماژول‌ها**
> `src/backtest/` — `engine.py`، `simulator.py`، `cost_model.py`، `metrics.py`، `walk_forward.py`، `advanced_metrics.py`، `reporting.py`
> `src/launch/` — `paper_trading.py`، `divergence.py`، `preflight.py`

این فصل، بخشی از CoinePro-FX را مستند می‌کند که تصمیم می‌گیرد آیا استراتژی *اجازه دارد* به پول واقعی دست بزند یا نه. این حساس‌ترین لایهٔ ایمنیِ کل پروژه است و طراحی‌اش از یک فلسفه پیروی می‌کند: **هر سیگنال تا وقتی سودآوریِ آن — پس از کسر هزینه‌ها، روی داده‌ای که هرگز ندیده — اثبات نشود، مجرم فرض می‌شود.** هیچ‌چیز به حساب زنده نمی‌رسد مگر آنکه از پنج مرحله جان سالم به‌در ببرد: (۱) شبیه‌سازی کندل‌به‌کندل با هزینه‌های واقعی، (۲) اعتبارسنجیِ پیش‌روندهٔ خارج‌از‌نمونه، (۳) فوروارد-تستِ چندهفته‌ای paper-trading، (۴) بررسی واگراییِ paper در برابر backtest، و (۵) دروازهٔ سختِ preflight. هر پنج مرحله کدِ واقعی‌اند و همه را مرور می‌کنیم.

---

### ۸.۱ تصویر کلان — پنج دروازه میان یک ایده و یک سفارش زنده

```
                 ┌─────────────────────────────────────────────────────────┐
   سیگنال‌های    │  دروازهٔ ۱:  BacktestEngine.run()                       │
   تاریخی   ───► │   شبیه‌سازی کندل‌به‌کندلِ TradeSimulator.simulate()      │
                 │   + CostModel (اسپرد / کمیسیون / سواپ / اسلیپج)          │
                 └───────────────────────────┬─────────────────────────────┘
                                             ▼
                 ┌─────────────────────────────────────────────────────────┐
   کل تاریخچه ──►│  دروازهٔ ۲:  WalkForwardValidator.run()                 │
                 │   فولدهای rolling train/test → متریک تجمیعی OOS          │
                 │   (overfit آشکار می‌شود: فقط روی *آینده* تست می‌شود)     │
                 └───────────────────────────┬─────────────────────────────┘
                                             ▼
                 ┌─────────────────────────────────────────────────────────┐
   موتور زنده ──►│  دروازهٔ ۳:  paper_trading.py  (TRADING_MODE=paper)     │
                 │   سیگنال‌ها دقیقاً مثل live صادر اما به کاربر منتشر نمی‌شوند│
                 │   با is_paper=true ذخیره و عادی track می‌شوند             │
                 └───────────────────────────┬─────────────────────────────┘
                                             ▼
                 ┌─────────────────────────────────────────────────────────┐
   paper vs   ──►│  دروازهٔ ۴:  divergence.compare_paper_with_backtest()   │
   backtest      │   آشکارساز degradation → block_launch / proceed         │
                 └───────────────────────────┬─────────────────────────────┘
                                             ▼
                 ┌─────────────────────────────────────────────────────────┐
   محیط+DB+ML ──►│  دروازهٔ ۵:  preflight.run_preflight()                  │
                 │   همهٔ چک‌های CRITICAL سبز → چرخش TRADING_MODE=live       │
                 └─────────────────────────────────────────────────────────┘
```

وضعیت فعلیِ پروژه (طبق `CLAUDE.md`) **`TRADING_MODE=paper`** است: سیستم بین دروازهٔ ۳ و ۵ ایستاده و پیش از آنکه گزارش divergence اجازهٔ `live` بدهد، روی بروکر واقعی داده‌ی فوروارد-تست جمع می‌کند.

---

### ۸.۲ مدل هزینه — نزدیک‌کردنِ P&L بک‌تست به واقعیت

`src/backtest/cost_model.py` پایه است. بک‌تستی که هزینه‌ها را نادیده بگیرد همیشه درخشان به‌نظر می‌رسد و همیشه دروغ می‌گوید. هر مؤلفهٔ دیگر یک `CostModel` می‌گیرد، پس واقع‌گراییِ هزینه متمرکز است.

#### ۸.۲.۱ پروفایل هزینهٔ هر نماد

هزینه‌ها سراسری **نیستند** — per نماد‌اند، چون اسپرد، ارزش پیپ و سواپ بین مثلاً `EURUSD` و `XAUUSD` به‌شدت فرق دارند. هر نماد یک `SymbolCostProfile` دارد:

| فیلد | معنی |
|---|---|
| `pip_size` | اندازهٔ یک پیپ به قیمت (`0.0001` یورودلار، `0.1` طلا، `0.01` ین) |
| `pip_dollar_per_lot` | دلار P&L به‌ازای ۱ پیپ × ۱ لات استاندارد (EURUSD `10.0`، XAGUSD `50.0`) |
| `spread_pips` | اسپرد متوسط (EURUSD `1.0`، XAUUSD `3.0`، GBPJPY `2.5`) |
| `commission_per_side_per_lot` | کمیسیون per side سبک ECN (پیش‌فرض `0.0` → حساب standard) |
| `swap_long/short_pips_per_night` | سواپ شبانه به پیپ/لات، علامت‌دار (+دریافت / −پرداخت) |
| `entry_slippage_pips` | پیش‌فرض `1.0` — فیل ~۱ پیپ بدتر از آنچه دیده شده |
| `stop_slippage_pips` | پیش‌فرض `2.0` — stop-out ~۲ پیپ بدتر chase می‌شود |

`CostModel.default()` پروفایل ~۲۰ نماد را می‌سازد (مِیجر/کراسِ فارکس، فلزات، انرژی، شاخص‌ها). برای نماد **ناشناخته**، `profile()` یک fallbackِ عمداً **محافظه‌کارانه** برمی‌گرداند (اسپرد ۳.۰، سواپ −۰.۵ هر دو سمت) — مدل هزینه هرگز یک نمادِ ناشناخته را تحویل نمی‌گیرد و چاپلوسی نمی‌کند.

#### ۸.۲.۲ چهار مؤلفهٔ هزینه

**۱. اسپرد.** بازار دوطرفه است. مدل قاعدهٔ بازارساز را همه‌جا اعمال می‌کند:

- **LONG** در **ASK** = `mid + ½·spread` وارد، در **BID** = `mid − ½·spread` خارج می‌شود
- **SHORT** در **BID** وارد، در **ASK** خارج می‌شود

پس *هر* معامله پیش از حرکتِ قیمت، به‌اندازهٔ کاملِ اسپرد زیر آب است. در `simulator.py`:

```python
half_spread = profile.spread_pips * pip * 0.5
if direction == "long":
    entry_actual = entry_price_mid + half_spread
else:
    entry_actual = entry_price_mid - half_spread
```

**۲. اسلیپج.** دو نوع، از طریق `apply_entry_slippage` / `apply_stop_slippage`. هر دو همیشه قیمت را *به‌ضرر* معامله‌گر جابه‌جا می‌کنند:

```python
# ورود: LONG بالاتر (بدتر)، SHORT پایین‌تر (بدتر)
return entry_price + slip if direction == "long" else entry_price - slip
# استاپ: LONG پایین‌تر اجرا می‌شود، SHORT بالاتر
return stop_price - slip if direction == "long" else stop_price + slip
```

اسلیپجِ استاپ (`2.0`) عمداً دوبرابر اسلیپجِ ورود (`1.0`) است، چون استاپ‌ها در بازارِ تندِ در حال حرکت پر می‌شوند که شما را «chase» می‌کند.

**۳. کمیسیون.** رفت‌و‌برگشت = ۲ × per-side: `commission_round_turn() → 2.0 * commission_per_side_per_lot * lot_size`. پیش‌فرض `$0` (حساب standard)؛ مقدار per-side را برای مدل‌کردن حساب ECN تنظیم کنید.

**۴. سواپ (تأمین مالی شبانه).** ظریف‌ترین مؤلفه. `swap_cost_dollar()` تعداد شب‌های rollover بین ورود و خروج را می‌شمارد و در نرخ سواپِ جهت‌دار ضرب می‌کند:

```
swap_$ = rollover_units × swap_pips_per_night × pip_dollar_per_lot × lot_size
```

`_count_rollover_nights()` با حرکت یک cursor از ساعت ۲۲:۰۰ UTC هر روز، عرفِ واقعیِ rollover فارکس را پیاده می‌کند:

| روز هفته | رفتار | چرا |
|---|---|---|
| دوشنبه، سه‌شنبه، پنج‌شنبه | `+1` شب | سواپ عادیِ تکی |
| **چهارشنبه** | **`+3` شب (سه‌گانه)** | تسویهٔ T+2: رولِ چهارشنبه روی آخرهفته تسویه می‌شود |
| جمعه، شنبه، یکشنبه | `+0` | بازار بسته؛ تسویهٔ جمعه قبلاً چهارشنبه سه‌گانه شده |

قاعدهٔ سواپِ سه‌گانهٔ چهارشنبه از همان جزئیاتی است که بک‌تستِ آماتور از قلم می‌اندازد و در هولدهای چندروزه روی جفت‌های carryِ منفی (مثلاً `XAUUSD` لانگ با `−1.5` پیپ/شب) P&L را به‌طور معنادار تغییر می‌دهد.

> **نکتهٔ گزارش‌گیری.** در `TradeOutcome`، مقدار `gross_pips` از قیمت‌های *از پیش هزینه‌خوردهٔ* `entry_actual`/`exit_actual` محاسبه می‌شود، پس اسپرد و اسلیپج درون قیمتِ تحقق‌یافته پخته شده‌اند. فیلدهای جدا‌ی `spread_cost_pips`/`slippage_cost_pips` صرفاً اطلاعاتی‌اند (`net_pips = gross_pips`) تا باگِ کلاسیکِ کسرِ دوبارهٔ هزینه رخ ندهد.

---

### ۸.۳ شبیه‌ساز معامله — یک سیگنال، بازپخش کندل‌به‌کندل

`src/backtest/simulator.py` تبدیل *(سیگنال + کندل‌های آینده)* به یک `TradeOutcome`ِ کاملاً هزینه‌خورده است. این بازپخشِ رویدادمحور در سطح کندل است: هر کندل به‌ترتیب بررسی می‌شود و معامله لحظه‌ای که استاپ یا تارگت لمس شود بسته می‌گردد.

#### ۸.۳.۱ ورودی‌ها و قرارداد قیمتِ mid

سطوح (`sl`, `tp1/2/3`) و `entry_price_mid` در **فضای mid** زندگی می‌کنند — همان فضایی که موتور سیگنال آن‌ها را تولید کرده. شبیه‌ساز داخلی به قیمت‌های اجراییِ ASK/BID ترجمه می‌کند. این کار فاصلهٔ SL (و در نتیجه مخرجِ R-multiple) را با نحوهٔ استدلالِ استراتژی هم‌خوان نگه می‌دارد:

```python
initial_risk_pips = abs(entry_price_mid - sl) / pip
```

#### ۸.۳.۲ حلقهٔ هر کندل

برای هر کندلِ آینده (تا `max_bars`) شبیه‌ساز این‌ها را **به‌ترتیب اولویت** بررسی می‌کند:

۱. **gap روی open** (بدترین/بهترین حالت اول). اگر کندل *همان open* را از سطح رد کند، فیل در open است نه در سطح — مدل‌کردن صادقانهٔ gapِ آخرهفته/خبر:
   - LONG: `open ≤ active_sl` → فیلِ استاپ در `open` (بدتر از SL)؛ `open ≥ best_tp` → فیلِ تارگت در `open` (بهتر از TP).
   - SHORT: قرینه.
۲. **محدودهٔ درون‌کندل** (`low`/`high`). LONG: `low ≤ sl` = استاپ خورد؛ `high ≥ tp3/tp2/tp1` = تارگت (بالاترین TPِ قابل‌دسترس برنده). SHORT قرینه.
۳. **تساویِ استاپ‌وتارگت.** اگر محدودهٔ یک کندل *هم* استاپ و *هم* تارگت را بپوشاند، **استاپ برنده است** (محافظه‌کارانه):

```python
# محافظه‌کارانه: اگر هم stop و هم TP در یک کندل hit شدند → stop می‌برد
if hit_stop:
    exit_price_mid = active_sl
    ...
    break
```

همین یک فرض است که بک‌تستِ صادق را از بک‌تستِ خیالی جدا می‌کند. بیشترِ بک‌تست‌های overfit بی‌سروصدا فرض می‌کنند تارگت اول خورده؛ CoinePro-FX فرض می‌کند ضرر اول رخ داده.

#### ۸.۳.۳ trailing اختیاری پس از TP1

با `use_trailing_after_tp1=True`، خوردنِ TP1 معامله را **نمی‌بندد**؛ بلکه استاپ را به سر‌به‌سر می‌برد (`active_sl = entry_price_mid`) و معامله به شکار TP2/TP3 ادامه می‌دهد. استاپِ بعدی به‌جای `STOP_LOSS` با برچسب `TRAILING_STOP` ثبت می‌شود. (موتورِ signal-replay پیش‌فرض این را خاموش صدا می‌زند، اما قابلیت برای مطالعهٔ استراتژی‌های trailing موجود است.)

#### ۸.۳.۴ دلایل خروج و timeout

`ExitReason` ∈ {`STOP_LOSS`، `TAKE_PROFIT_1/2/3`، `TRAILING_STOP`، `TIMEOUT`، `END_OF_DATA`}. اگر در `max_bars` (پیش‌فرض ۵۰۰) هیچ سطحی لمس نشود، معامله در closeِ آخرین کندل به‌اجبار بسته می‌شود — `TIMEOUT` اگر به سقفِ کندل خورده باشد، `END_OF_DATA` اگر صرفاً کندل تمام شده. هیچ معامله‌ای برای همیشه باز نمی‌ماند، پس متریک‌ها هرگز با پوزیشن‌های «هنوز امیدوار» متورم نمی‌شوند.

#### ۸.۳.۵ خروجی: `TradeOutcome`ِ کاملاً هزینه‌خورده

```python
gross_pnl_dollar = gross_pips * profile.pip_dollar_per_lot * lot_size
commission_dollar = self._cost.commission_round_turn(symbol, lot_size)
swap_dollar       = self._cost.swap_cost_dollar(symbol, direction, entry_time, exit_time, lot_size)
net_pnl_dollar    = gross_pnl_dollar - commission_dollar + swap_dollar
r_multiple        = net_pips / initial_risk_pips
```

`TradeOutcome` هرچه پایین‌دست لازم است را حمل می‌کند: P&L به پیپ و دلار (gross *و* net)، هر مؤلفهٔ هزینه، **R-multiple** (واحد جهانیِ نرمال‌شده با ریسک)، مدت، تعداد کندلِ نگه‌داشته، و یک dictِ آزادِ `tags` برای attribution.

---

### ۸.۴ موتور بک‌تست — بازپخش سیگنال روی تاریخچه

`src/backtest/engine.py` کل کارزارِ سیگنال‌ها را از میان شبیه‌ساز هماهنگ می‌کند. هدفش (از docstring): *اجرای سیگنال‌های زندهٔ گذشته برای سنجشِ عملکردِ واقعیِ پس از هزینه، که سپس می‌توان آن را با متریکِ in-sampleِ مدل ML مقایسه و میزان overfit را کمّی کرد.*

#### ۸.۴.۱ حلقهٔ بازپخش

`BacktestEngine.run()`:

۱. سیگنال‌ها را بر اساس `entry_time` مرتب می‌کند (علیّتِ زمانی الزامی است).
۲. برای هر سیگنال، تنها کندل‌های **اکیداً پس از ورود** را با `_slice_future()` می‌بُرد (نرمال‌سازیِ UTC برای پرهیز از باگِ دو‌منطقه‌ایِ زمانی). سیگنالی که داده‌ی آینده ندارد *skip* می‌شود، نه جعل.
۳. یک **lot مبتنی بر ریسک** از *موجودیِ جاری* محاسبه می‌کند (مرکب):

```
risk_$   = balance × risk_pct/100
sl_pips  = |entry − sl| / pip_size
lot      = risk_$ / (sl_pips × pip_dollar_per_lot)
```

   نکتهٔ کلیدی: اگر `lot < 0.01` معامله **رد می‌شود، نه clamp** — clamp‌کردن تا حداقل لات، ریسک را بی‌سروصدا تا ۱۰ برابر بالا می‌برد و منحنیِ equity را خراب می‌کند. سقفِ لات ۱۰۰ است.
۴. شبیه‌ساز را اجرا، `TradeOutcome` را اضافه و `balance += net_pnl_dollar` را به‌روز می‌کند.
۵. **توقفِ ruin:** اگر `balance ≤ 0` حلقه می‌شکند — حسابِ سوخته نمی‌تواند معامله‌اش را ادامه دهد.

#### ۸.۴.۲ Attribution مؤلفه‌ای — *کدام بخشِ مغز پول درآورد؟*

هر `BacktestSignal` امتیازهای `technical_score`، `pattern_score` و `ml_score` خود را می‌داند. `dominant_component()` سیگنال را به مؤلفه‌ای نسبت می‌دهد که آن را بیش‌ترین فاصله از خنثی (۵۰) دور کرده، با وزن‌های تولیدیِ scorer:

```python
contribs = {
    "technical": (technical_score - 50.0) * 0.4,
    "pattern":   (pattern_score   - 50.0) * 0.3,
    "ml":        (ml_score        - 50.0) * 0.3,
}
```

موتور هر معامله را با `dominant_component` (و یک `signal_score_bucket` از strong/medium/weak) برچسب می‌زند، سپس `attribute_by_tag()` عملکرد را بر اساس برچسب می‌شکند. `BacktestResult.attribution_by_component` به پرسشی پاسخ می‌دهد که بیشترِ سیستم‌ها نمی‌توانند: *آیا مدلِ ML واقعاً alpha اضافه می‌کند، یا تحلیلِ تکنیکال آن را به‌دوش می‌کشد؟* اگر باکتِ ml-dominant انتظارِ بدتری از باکتِ technical داشته باشد، این یک سیگنالِ مستقیم و داده‌محور برای retrain یا کم‌وزن‌کردنِ ML است.

`BacktestResult.summary()` همه‌چیز را (بازده٪، متریک کامل، attribution مؤلفه‌ای، snapshotِ config) به یک dictِ مناسبِ DB/API سریالایز می‌کند.

---

### ۸.۵ متریک‌های عملکرد — کارنامه

`src/backtest/metrics.py::calculate_metrics()` یک فهرست `TradeOutcome` را به کارنامهٔ `PerformanceMetrics` تقلیل می‌دهد.

#### ۸.۵.۱ فرمول‌های پایه

| متریک | فرمول / تعریف |
|---|---|
| نرخ برد | `winning_trades / total_trades` |
| نسبت payoff | `avg_win_$ / |avg_loss_$|` |
| **profit factor** | `gross_profit / gross_loss` (اگر باخت نباشد `∞`) |
| انتظار ($) | `total_net_$ / total_trades` |
| **انتظار (R)** | `mean(r_multiple)` — مهم‌ترین عددِ لبه |
| max drawdown ($،٪،R) | اوج‌تا‌فرود روی منحنیِ equity |
| بلندترین رشتهٔ برد/باخت | طولِ run روی P&Lِ علامت‌دار |
| **Sharpe** (سالانه) | `mean(R)/std(R) · √252` |
| **Sortino** | مثل Sharpe اما مخرج فقط انحراف *نزولی* |
| Calmar | `expectancy_R · 252 / max_drawdown_R` |

#### ۸.۵.۲ دو ظرافتِ ضدِ‌باگ

- **منحنیِ equity با پایهٔ 0.0.** هر دو منحنیِ دلاری و R پیش از اولین معامله با پایهٔ `[0.0]` شروع می‌شوند. بدون این، یک معاملهٔ بازندهٔ اول، `peak == equity[0]` را منفی و درصدِ drawdown را بی‌معنا می‌کرد. این پایه peakِ سالم را تضمین می‌کند.
- **حالتِ «بدون نزول»ِ Sortino** وقتی میانگین مثبت است درست `+∞` برمی‌گرداند (استراتژی‌ای که هرگز دورهٔ بازنده نداشته)، به‌جای تقسیم‌بر‌صفر.

#### ۸.۵.۳ شکستِ بازگشتیِ per-symbol

با `group_by_symbol=True`، `calculate_metrics` به‌ازای هر نماد بازگشتی فراخوانی می‌شود (با `group_by_symbol=False` برای توقفِ بازگشتِ بی‌نهایت)، پس `PerformanceMetrics.by_symbol["XAUUSD"]` خود یک کارنامهٔ کامل است. در ترکیب با `attribute_by_tag`، می‌توان عملکرد را مستقلاً بر اساس نماد *و* مؤلفهٔ سیگنال برش زد.

---

### ۸.۶ متریک‌های پیشرفته — تراز‌مؤسسه‌ای، آگاه به López de Prado

`src/backtest/advanced_metrics.py` متریک‌هایی را اضافه می‌کند که یک گزارشِ کوانتِ واقعی را از کارِ آماتور جدا می‌کند. این‌ها نمونهٔ بزرگ‌تر می‌خواهند و به ادبیاتِ آکادمیک ارجاع می‌دهند (Bailey & López de Prado ۲۰۱۲/۲۰۱۴، Keating & Shadwick ۲۰۰۲، Acerbi & Tasche ۲۰۰۲).

`compute_advanced_metrics(returns, periods_per_year=252, threshold=0.0, n_trials=1)` یک بستهٔ `AdvancedMetrics` برمی‌گرداند:

| متریک | چه می‌سنجد | شهود |
|---|---|---|
| **MAR** | `CAGR / |MaxDD|` | بازده‌بر‌دردِ حسابِ مدیریت‌شده |
| **Calmar** | MAR روی ۳۶ ماه اخیر | MARِ وزن‌دار به تازگی |
| **شاخص Ulcer** | `√(میانگین(drawdown²))` | جریمهٔ drawdownِ *عمیق و طولانی* |
| **Omega** | `Σ max(r−θ,0) / Σ max(θ−r,0)` | نسبتِ سود/زیانِ کلِ توزیع، بدون فرضِ نرمال |
| **نسبت دم** | `|صدکِ۹۵ سود| / |صدکِ۵ زیان|` | >۱ دمِ صعودیِ خوب؛ <۱ = «جمع‌کردنِ سکه جلوی غلتک» |
| **PSR** | `Pr(SR واقعی > benchmark)` | اعتماد به اینکه Sharpe *واقعی* است نه شانس |
| **DSR** | PSRِ تعدیل‌شده برای آزمونِ چندگانه | محافظ در برابر cherry-pickingِ بک‌تست |
| skew / کشیدگیِ مازاد | شکلِ توزیعِ بازده | آگاهی از دمِ‌چاق/عدم‌تقارن |

#### ۸.۶.۱ equityِ مرکب (باگِ رفع‌شده، مستند در کد)

یک کامنت ثبت می‌کند که drawdown/MAR قبلاً از `cumsum`ِ افزایشی استفاده می‌کرد که برای بازده‌های *کسری* از نظر بُعدی غلط است. کدِ فعلی درست مرکب می‌کند:

```python
eq  = np.cumprod(1.0 + r)
pk  = np.maximum.accumulate(eq)
dd  = (pk - eq) / np.where(pk > 0, pk, 1.0)
mdd = float(dd.max())
cagr = end**(1/yrs) - 1
```

#### ۸.۶.۲ PSR — آیا Sharpe از نظر آماری واقعی است؟

PSR می‌پرسد: با توجه به *شکل* (skew، کشیدگی) و *طولِ* سری بازده، احتمالِ اینکه Sharpe واقعی از یک benchmark (پیش‌فرض ۰) فراتر رود چقدر است؟

```
PSR = Φ( (SR_obs − SR_bench) · √(n−1) / σ_SR )

σ_SR = √( (1 − γ3·SR + (γ4−1)/4 · SR²) / (n−1) )
```

که `γ3` چولگی و `γ4` کشیدگیِ (کاملِ) بازده است. PSR > 0.95 یعنی ۹۵٪ اعتماد که لبه واقعی است. دمِ‌چاق و چولگیِ منفی، `σ_SR` را *افزایش* و PSR را *کاهش* می‌دهند — دقیقاً همان محافظه‌کاری‌ای که می‌خواهید.

#### ۸.۶.۳ DSR — تعدیل‌کنندهٔ overfitting

`compute_dsr` ابزارِ پرچم‌دارِ ضدِ‌overfit است. وقتی `N` نسخهٔ استراتژی را بک‌تست و بهترین را برمی‌گزینید، Sharpe آن صرفاً به‌خاطرِ انتخاب رو به بالا اریب می‌شود. DSR بیشینهٔ Sharpeِ موردانتظار تحت فرضِ صفر را با فرمولِ مقدار-حدیِ مبتنی بر Euler–Mascheroni تخمین می‌زند:

```
E[max SR_null] = σ_SR · [ (1−γ)·Φ⁻¹(1−1/N) + γ·Φ⁻¹(1−1/(N·e)) ],   γ = 0.5772…
```

و سپس PSR را با *همان* به‌عنوان benchmark محاسبه می‌کند. هرچه نسخه‌های بیشتری امتحان کرده باشید (`n_trials`)، سدِ بلندتری که Sharpe واقعی باید رد کند. با `n_trials=1`، DSR به‌نرمی به PSR تنزل می‌یابد.

---

### ۸.۷ گزارش‌گیری — تصاویرِ تراز‌سرمایه‌گذار به‌صورتِ dictِ ساده

`src/backtest/reporting.py` ساختارهای آمادهٔ JSON برای داشبوردِ ادمین و گزارش‌های سرمایه‌گذار تولید می‌کند. همه‌چیز `dict`/`list` است تا مستقیم به API برود.

- **heatmapِ بازده ماهانه** (`build_monthly_heatmap`): بازدهٔ٪ هر ماه نسبت به *موجودیِ جاریِ ابتدای آن ماه*، و رقمِ سالانهٔ درست **مرکب** (`∏(1+rₘ) − 1`)، نه جمعِ ساده. خروجی per سال یک `HeatmapRow` با ۱۲ ماه + سالانه.
- **CAGRِ غلتان** (`rolling_cagr`، پنجرهٔ پیش‌فرض ۳۶۵ روز، گام ۷): `(final/initial)^(365/days) − 1`، با رد‌کردنِ پنجره‌های < ۵ معامله.
- **Sharpeِ غلتان** (`rolling_sharpe`، پنجرهٔ پیش‌فرض ۹۰ روز روی R-multiple)، با رد‌کردنِ پنجره‌های < ۱۰ معامله یا واریانسِ صفر.
- **دوره‌های drawdown** (`identify_drawdown_periods`): منحنیِ equity را پیموده و هر اپیزودِ اوج→فرود→بازیابیِ بالای `min_drawdown_pct` (پیش‌فرض ۱٪) را ثبت می‌کند: عمقِ فرود ($ و ٪)، روزها‌تا‌فرود، روزها‌تا‌بازیابی و یک پرچمِ `is_ongoing` برای drawdownِ بازنیافته. مرتب از بدترین.
- **مقایسه با benchmark** (`compare_to_benchmark`): تحلیلِ کاملِ Jensen در برابر یک benchmark (DXY، SPX…): CAGRهای سالانه، **beta** = `cov(s,b)/var(b)`، **alpha** = `R_s − [R_f + β(R_b − R_f)]`، همبستگی، و **نسبت اطلاعات** = `mean(active)/tracking_error · √252`.

---

### ۸.۸ اعتبارسنجیِ پیش‌رونده — چرا یک تقسیمِ ساده کافی نیست

`src/backtest/walk_forward.py` دروازهٔ ۲ است و پادزهرِ بزرگ‌ترین حالتِ شکستِ معاملهٔ کوانتی: **overfitting**.

#### ۸.۸.۱ مشکلِ یک تقسیمِ train/test

یک تقسیمِ ۸۰/۲۰ به شما می‌گوید استراتژی روی *یک* دورهٔ نادیده چه کرد. اما شما (پژوهشگر) نتیجه را دیدید، استراتژی را تغییر دادید و دوباره اجرا کردید — و مجموعهٔ تست را به تصمیم‌هایتان نشت دادید. پس از تعدادِ کافی تغییر، «خارج‌از‌نمونه»ی شما فقط شکلِ کندتری از فیتِ in-sample است. یک تقسیم هم نمی‌تواند بگوید لبه *پایدار* است یا در یک رژیمِ خاص شانس آورده.

#### ۸.۸.۲ walk-forwardِ غلتان

walk-forward پنجره‌های train/test را روی کلِ تاریخچه می‌لغزاند و همیشه روی *آینده* نسبت به train تست می‌کند:

```
فولد ۰:  [=== train ===][ test ]
فولد ۱:        [=== train ===][ test ]
فولد ۲:               [=== train ===][ test ]
...                                    step →
```

`WalkForwardValidator.run(signals, candles, train_window, test_window, step=None, on_train=None)`:

```python
train_end  = train_start + train_window
test_start = train_end                       # تست اکیداً بعد از train
test_end   = test_start + test_window
if test_end > history_end: break             # توقف وقتی تاریخچه تمام شد
train_sigs = [s for s in sorted_sigs if train_start <= s.entry_time < train_end]
test_sigs  = [s for s in sorted_sigs if test_start  <= s.entry_time < test_end]
if on_train: on_train(train_sigs)            # قلابِ RETRAINِ ML روی این فولد
bt = engine.run(name=f"wf_fold_{i}", signals=test_sigs, ...)   # فقط OOS
all_oos_trades.extend(bt.trades)
train_start += step
```

نکات کلیدیِ طراحی:

- **تست همیشه اکیداً بعد از train است** (`test_start = train_end`) — نشتِ نگاه‌به‌جلو از نظر ساختاری ناممکن است.
- **`step` پیش‌فرض `test_window`** است و پنجره‌های تستِ **بدونِ هم‌پوشانی** می‌سازد، پس هر معاملهٔ خارج‌از‌نمونه دقیقاً یک‌بار در تجمیع شمرده می‌شود.
- **قلابِ `on_train`** قلابِ بازآموزی است: هر فولد می‌تواند مدلِ ML را روی سیگنال‌های trainِ همان فولد دوباره fit کند، آینهٔ روشی که سیستمِ زنده دوره‌ای retrain می‌کند. این، متریکِ OOS را به شبیه‌سازیِ وفادارِ *واقعیتِ تولید* بدل می‌کند، نه مدلی منجمد.
- اگر `history < train_window + test_window` باشد **با صدای بلند fail می‌کند** (حتی یک فولد ممکن نیست).

#### ۸.۸.۳ خروجیِ مهم: متریکِ تجمیعیِ OOS

`WalkForwardResult` هم متریکِ هر فولد را نگه می‌دارد و هم عددِ تیتر را: `aggregated_oos_metrics = calculate_metrics(all_oos_trades)` — عملکرد روی *تمامِ* معاملاتِ خارج‌از‌نمونهٔ به‌هم‌دوخته. متریکِ per-fold **پایداری** را آشکار می‌کند: استراتژی‌ای با میانگینِ عالی اما یک فولدِ فاجعه‌بار، شکننده است و همان‌طور رفتار می‌شود. این عددی است که باید با متریکِ in-sample/آموزشِ ML مقایسه شود — یک شکافِ بزرگ، خودِ overfit است، کمّی‌شده.

---

### ۸.۹ ماژولِ launch — فلسفهٔ ایمنیِ paper→live

هرچه بالاتر آمد، استراتژی را روی *تاریخچه* می‌سنجد. ماژولِ launch (`src/launch/`) گذار به *زمانِ واقعی* را — روی *بروکرِ واقعی*، با تأخیر و فیلِ واقعی — اداره می‌کند. قاعدهٔ حاکم در `CLAUDE.md` است:

> *TRADING_MODE تا تأییدِ کیفیتِ سیگنال روی این بروکر `paper` می‌ماند؛ تنها پس از تأییدِ گزارشِ divergence به `live` می‌چرخد.*

#### ۸.۹.۱ `paper_trading.py` — فوروارد-تستِ بدونِ مواجهه

`TradingMode` ∈ {`PAPER`، `LIVE`، `DISABLED`}. `PaperTradingConfig.from_settings()` مقادیرِ `TRADING_MODE` و `BETA_CHANNEL_ID` را از env می‌خواند و در هر مقدارِ ناشناخته به‌امنی به `PAPER` پیش‌فرض می‌رود. دو تابعِ دروازهٔ کوچک رفتار را تعیین می‌کنند:

```python
should_publish_to_users(cfg) -> bool   # فقط در LIVE برابرِ True
should_emit_signal(cfg)      -> bool   # فقط در DISABLED برابرِ False
```

پس در حالتِ `paper`، موتور همچنان سیگنال را دقیقاً مثل زنده محاسبه و track می‌کند — صرفاً **به کانالِ عمومی منتشر نمی‌کند**. `publish_signal()` بر اساس mode مسیریابی می‌کند:

| حالت | کانالِ کاربر؟ | کلیدِ ماندگاری | کانالِ Pub/Sub |
|---|---|---|---|
| `LIVE` | ✅ کانالِ عمومی | `signal:active:{id}` | `live_signals` |
| `PAPER` | ❌ (فقط `beta_channel`ِ اختیاری) | `paper:active:{id}` (TTLِ ۷روزه) | `paper_signals` / `beta_signals` |
| `DISABLED` | ❌ هیچ | — | — |

پرچمِ `is_paper=true` روی هر سیگنالِ paper مهر می‌خورد تا عملکرد روی جمعیتی تمیز و جدا محاسبه شود. فلسفه: **فوروارد-تست تحتِ شرایطِ زنده، با صفرِ ضرر برای کاربرِ واقعی**، و انباشتِ همان داده‌ای که دروازهٔ ۴ نیاز دارد.

#### ۸.۹.۲ `divergence.py` — آیا زنده با backtest می‌خواند؟

این هستهٔ تصمیمِ paper→live است. اگر backtest نرخِ بردِ ۶۵٪ ادعا کند ولی paper ۴۵٪ بدهد، استراتژی روی دادهٔ زنده افت می‌کند و علل مستند این‌هاست: overfitِ ML، تغییرِ رژیم، مدلِ هزینهٔ خوش‌بینانه (اسلیپجِ واقعی بدتر از فرض)، یا تأخیرِ اجرا. `compare_paper_with_backtest(paper_metrics, backtest_metrics, paper_period_days, …)` یک `DivergenceReport` می‌سازد.

آستانه‌های پیش‌فرضِ افتِ per-metric (٪ افتِ مجاز از backtest):

| متریک | آستانه |
|---|---|
| `win_rate` | ۱۵٪ |
| `profit_factor` | ۳۰٪ |
| `expectancy_r` | ۳۰٪ |
| `sharpe_ratio` | ۴۰٪ |
| `avg_net_pips` | ۲۵٪ |

منطقِ تصمیم:

- **حفاظ‌ها اول.** اگر `paper_n < min_paper_trades` (پیش‌فرض ۲۰) → `wait_for_more_data`. اگر backtest `n < 10` → `rerun_backtest_with_larger_window`. مقایسه‌های بی‌معنای آماری هرگز حکم تولید نمی‌کنند.
- برای هر متریک `delta_pct = (paper − backtest)/|backtest|·100` محاسبه، اگر `|delta_pct| ≥ آستانه` آن را `is_significant` و جهتش را برچسب می‌زند (بهبود / افت / بی‌تغییر — برای همهٔ این‌ها، بیشتر = بهتر).
- **حکم:** `overall_degraded = (تعدادِ افتِ معنادار ≥ 2)` → `block_launch`. اگر چیزی بهتر شد و چیزی افت نکرد → `proceed_with_launch`. در غیر این صورت → `proceed_with_caution` (launch مجاز اما با مانیتورینگِ شدید).

شرطِ **دو** متریکِ به‌طور معنادار افت‌کرده، از بلاک‌شدن روی یک عددِ پرنویز جلوگیری می‌کند و در عینِ حال افتِ گستردهٔ واقعی را می‌گیرد. این گزارش قرار است هفتگی اجرا شود و launch را خودکار دروازه‌بانی کند.

#### ۸.۹.۳ `preflight.py` — دروازهٔ سختِ نهایی

`python -m src.launch.preflight` (و نیز `docker compose exec api python -m src.launch.preflight`) آخرین چیزی است که پیش از چرخش به `live` اجرا می‌شود. هر چک `CRITICAL`، `WARNING` یا `INFO` است؛ **`is_ready_for_launch` تنها وقتی True است که هیچ چکِ CRITICAL fail نشود** — هشدارها نمایش داده می‌شوند اما بلاک نمی‌کنند.

| چک | سطح | شرطِ قبولی |
|---|---|---|
| `no_default_passwords` | CRITICAL | پسوردهای DB/Redis/Admin در فهرستِ ضعیف نباشند (شاملِ `_INSECURE_PASSWORDS`ِ config، `123456`…)؛ `JWT_SECRET_KEY` ≥ ۳۲ کاراکتر و بدونِ «change» |
| `debug_off` | CRITICAL | `settings.DEBUG is False` |
| `telegram_token` | CRITICAL | `TELEGRAM_BOT_TOKEN` تنظیم، ≥ ۲۰ کاراکتر |
| `redis_reachable` | CRITICAL | `connect()` + `ping()` موفق |
| `database_reachable` | CRITICAL | `SELECT 1` موفق |
| `paper_trading_period` | CRITICAL | `MIN(Signal.created_at)` ≥ `min_days` پیش (پیش‌فرض ۷) |
| `ml_models_present` | WARNING | ≥ ۱ فایلِ `*.joblib` زیرِ دایرکتوریِ مدل |
| `monitoring_active` | WARNING | `monitoring/prometheus.yml` + `alerts.yml` موجود |
| `backup_script` | WARNING | `scripts/backup.sh` موجود |
| `runbook_exists` | WARNING | `docs/RUNBOOK.md` موجود |

چکِ CRITICALِ `paper_trading_period` همان اجرای ساختاریِ فلسفه است: **تا وقتی دستِ‌کم ۷ روز دادهٔ paperِ واقعی وجود نداشته باشد، عبور از preflight فیزیکاً ممکن نیست.** CLI یک گزارشِ per-check چاپ و با `0` (آماده) یا `1` (بلاک) خارج می‌شود، که آن را به‌عنوان دروازهٔ CI/CD یا اسکریپتِ deploy قابل‌استفاده می‌کند.

#### ۸.۹.۴ دفاع در عمق — قراردادِ کاملِ آمادگیِ زنده

یک سیگنال تنها وقتی می‌تواند سفارشِ زنده شود که **همهٔ** این‌ها هم‌زمان برقرار باشند:

۱. در بک‌تستِ هزینه‌خوردهٔ کندل‌به‌کندل (دروازهٔ ۱) سودآور بوده، با **تساویِ استاپ-برنده** و اسپرد/اسلیپج/سواپِ کامل.
۲. متریکِ **تجمیعیِ خارج‌از‌نمونهٔ** walk-forward (دروازهٔ ۲) دوام آورده — و شکافِ in-sample با OOS کوچک است (بی‌overfit)، به‌اختیار با DSR چک‌متقابل شده.
۳. دستِ‌کم ۷ روز معاملهٔ **paperِ** زنده انباشته شده، دقیقاً مثل زنده track‌شده (دروازهٔ ۳).
۴. **گزارشِ divergence** کمتر از ۲ متریکِ به‌طور معنادار افت‌کرده نسبت به backtest نشان می‌دهد (دروازهٔ ۴).
۵. **preflight** روی هر چکِ CRITICAL سبز است (دروازهٔ ۵).

تنها آن‌گاه `TRADING_MODE` به `live` می‌چرخد، و در آن لحظه `should_publish_to_users()` برابرِ `True` می‌شود و `publish_signal()` مسیریابی به کانالِ عمومی و `signal:active:{id}` را آغاز می‌کند. تا آن لحظه، بدترین کاری که یک استراتژیِ معیوب می‌تواند بکند ناامید‌کردنِ یک کانالِ بتایِ خصوصی است — هرگز یک کاربرِ پولی، و هرگز یک حسابِ واقعی.

این، کلِ تزِ ایمنیِ CoinePro-FX است: **روی گذشته اثباتش کن، اثبات کن روی آیندهٔ نادیده هم درست می‌ماند، اثبات کن در paper روی بروکرِ زنده دوام می‌آورد، اثبات کن paper با backtest می‌خواند، اثبات کن محیط production-hard است — و تنها آن‌گاه یک دلار را ریسک کن.**

---

[⬅ 7. Institutional‑Grade Risk Management](risk-management.md) · [🏠 Home · خانه](../README.md) · [9. The API Layer — FastAPI Gateway, Routing, Auth & Real‑Time ➡](api.md)
