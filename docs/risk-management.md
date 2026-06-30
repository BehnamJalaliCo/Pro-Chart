[⬅ 6. The Signal Engine — Decision Core & Lifecycle](signal-engine.md) · [🏠 Home · خانه](../README.md) · [8. Backtesting, Walk‑Forward & Live‑Readiness Gating ➡](backtesting.md)

---

## 7. Institutional-Grade Risk Management

> **Philosophy.** A signal engine that finds 100 trades but blows the account on one bad day is worthless. CoinePro-FX therefore treats risk management not as an afterthought but as a **first-class gateway**: every candidate signal must survive a deterministic gauntlet of independent vetoes before it is allowed to become a published signal or — in `live` mode — an order routed to the master account. The entire layer lives in `src/risk/` and is orchestrated by a single class, `RiskGuard`, that composes ten self-contained filters. Each filter answers one narrow question ("is the market open?", "is this correlated with what I already hold?", "would this breach my daily loss limit?"), can be unit-tested in isolation, and contributes its own machine-readable `RejectionReason` so that the dashboard, Prometheus metrics, and audit log all speak the same language.

This chapter documents **every file** in `src/risk/`, the exact algorithm and thresholds each implements, the market-microstructure rationale behind those thresholds, and — critically — **how a veto actually blocks a trade**. Where the code contains real formulas (position sizing, Kelly, VaR, leverage, margin level), they are reproduced verbatim and explained.

### 7.0 Architecture at a glance

```
                         ┌─────────────────────────────────────────────┐
   candidate signal ───► │                RiskGuard.evaluate()          │
   (symbol, dir, entry,  │                                              │
    SL, TP1, candles,    │  1) weekend_filter   (no I/O, fastest)       │
    open_positions,      │  2) holiday_calendar (no I/O)                │
    balance, strategy)   │  3) session_filter   (no I/O, DST-aware)     │
                         │  4) daily_loss_limit (Redis)                 │
                         │  5) correlation      (needs open positions)  │
                         │  6) symbol_config    (R/R + SL bounds)       │
                         │  7) regime_detector  (DataFrame, expensive)  │
                         │  8) liquidity check  (volume profile)        │
                         └──────────────────────┬──────────────────────┘
                                                ▼
                              GuardResult{allowed, reasons[], regime, metadata}
                                                │
                       allowed?  ── no ──► publish rejection to Redis +
                          │                Prometheus counter, drop signal
                          └─ yes ──► position_sizer → margin_validator →
                                     portfolio_var → multi_level_limits → emit
```

The **ordering is intentional and documented in the source**: cheap, pure-function checks (weekend, holiday, session) run first so that an obviously-dead market short-circuits before any Redis round-trip or pandas computation; the expensive regime detector (which smooths a 100-candle ADX/ATR series) runs last, only if everything else passed. Weekend and holiday vetoes `return` immediately — there is no point reporting a tight stop-loss on a day the market is closed. All other vetoes **accumulate**: the guard keeps evaluating so that a single rejected signal reports *every* reason it failed, which is invaluable for tuning.

`RiskGuard` is constructed with a set of policy toggles, each of which can be flipped without touching filter code:

| Constructor flag | Default | Effect when `True` |
|---|---|---|
| `reject_in_transitional_regime` | `False` | Veto signals when ADX is in the 20–25 "no-man's-land" |
| `reject_in_high_volatility` | `True` | Veto when regime is `HIGH_VOLATILITY` (likely news/panic) |
| `block_trend_signals_in_ranging` | `True` | Veto trend-following setups when market is ranging |
| `block_reversion_signals_in_trending` | `True` | Veto mean-reversion setups when market is trending |
| `publish_rejections_to_redis` | `True` | Push every rejection to `risk:rejections` for the UI |
| `max_rejection_log_size` | `500` | LTRIM length of the rejection ring buffer |

---

### 7.1 `guard.py` — the unified risk gateway

**What it guards:** everything. It is the single entry point used by the signal engine and the live router.

**The `GuardResult` contract.** Each evaluation returns a dataclass:

```python
@dataclass
class GuardResult:
    allowed: bool
    reasons: List[tuple[RejectionReason, str]] = field(default_factory=list)
    regime: Optional[RegimeAnalysis] = None
    metadata: dict = field(default_factory=dict)

    def reject(self, code: RejectionReason, detail: str) -> None:
        self.allowed = False
        self.reasons.append((code, detail))
```

A "veto" is mechanically just a call to `result.reject(...)`, which sets `allowed = False` and appends a `(code, human-readable-detail)` pair. Because reasons accumulate, the result is **not** "first failure wins" — it is "report all failures". The caller's contract is simply:

```python
result = await guard.evaluate(...)
if not result.allowed:
    # signal is dropped; result.reasons explains why
```

**The enumerated rejection vocabulary** (`RejectionReason`) is the spine of observability:

| Code | Meaning |
|---|---|
| `WEEKEND_BLACKOUT` | Friday-night / Saturday / early-Sunday |
| `HOLIDAY_BLACKOUT` | Market holiday (full or partial) |
| `SESSION_NOT_ALLOWED` | Outside the symbol's liquid sessions |
| `LOW_LIQUIDITY` | Post-NY dead window or thin volume |
| `DAILY_LOSS_LIMIT` | Daily circuit breaker tripped |
| `CORRELATION_RISK` | Over-exposed to one currency leg |
| `LOW_RR` | Reward/risk below the symbol's floor |
| `SL_TOO_TIGHT` / `SL_TOO_WIDE` | Stop distance outside sane bounds |
| `REGIME_MISMATCH` | Strategy ⟷ regime mismatch |
| `VOLATILITY_SPIKE` | ATR in extreme percentile |

**Owner's emission philosophy (a critical design decision).** Two of the heaviest vetoes — daily-loss and correlation — are **non-blocking for the public signal feed by default**. The source comments this explicitly: signal *quality* should live in the structure of the signal itself (score, R/R out to TP3, regime fit, Claude's veto, SL/TP geometry), **not** in a circuit breaker that strangles the entire feed because of one losing day. So:

```python
from src.core.config import settings as _scfg
if getattr(_scfg, "DAILY_LOSS_BLOCKS_EMISSION", False):
    ok, reason = await self._daily.can_emit_signal(account_balance, now)
    if not ok:
        result.reject(RejectionReason.DAILY_LOSS_LIMIT, reason)
else:
    ok, reason = await self._daily.can_emit_signal(account_balance, now)
    if not ok:
        result.metadata["daily_loss_note"] = reason  # informational only
```

The same dual path applies to correlation via `CORRELATION_BLOCKS_EMISSION`. These flags exist so that when the master auto-trader needs *hard* capital protection the operator can flip them to `True`, while the educational signal feed never goes silent. This is a deliberate separation of "portfolio risk of one real account" from "informational signal stream".

**The R/R and stop-loss bounds block (filter 6).** Once pip size is known (from `symbol_config` / `settings.pip_values`), the guard computes:

```python
sl_pips  = abs(entry_price - sl) / pip_size
tp1_pips = abs(tp1 - entry_price) / pip_size
rr       = tp1_pips / sl_pips
```

and vetoes:
- `LOW_RR` if `rr < cfg.min_rr_tp1`,
- `SL_TOO_TIGHT` if `sl_pips < cfg.min_sl_pips`,
- `SL_TOO_WIDE` using an **ATR-relative cap** rather than a fixed pip cap.

The ATR-relative cap is a hard-won fix. A fixed pip ceiling (e.g. NAS100 = 3000 pips) was being *broken by healthy stops* during normal volatility, because the engine's own stop is roughly `4.875 × ATR`. The new ceiling is:

```
max_sl_dist = cfg.max_sl_atr_mult × ATR          (default 8 × ATR)
price_backstop = |entry_price| × 0.05            (hard 5% sanity guard)
reject SL_TOO_WIDE if sl_dist > max_sl_dist OR sl_dist > price_backstop
```

If ATR is unavailable, it **fails open** to the legacy fixed pip cap (`cfg.max_sl_pips`) rather than silently rejecting everything — a fail-open is correct here because a too-wide stop is a quality issue, not a capital-destruction event.

**Observability side-effect.** When a signal is rejected and `publish_rejections_to_redis` is on, `_publish_rejection` does two things, both wrapped in `try/except` so they can never break the main path:
1. increments a Prometheus counter `risk_rejections_total{symbol, reason}`;
2. `LPUSH`es a JSON payload (`timestamp, symbol, direction, reasons, metadata`) onto `risk:rejections` and `LTRIM`s it to the last 500 entries — feeding the admin RiskPage.

---

### 7.2 `daily_loss_limit.py` — the daily circuit breaker

**What it guards:** intraday capital. In professional trading firms, if a trader loses X% of capital in one day the system auto-locks the account for that day. This kills **revenge-trading** and the downward **loss-spiral**.

**The "day" definition.** In FX, a day runs *rollover-to-rollover* (~22:00 UTC), not midnight-to-midnight. The class therefore buckets state into period keys anchored on `rollover_hour_utc`:

```python
def _current_period_key(self, now):
    if now.hour < self._rollover_hour_utc:               # still yesterday's session
        period_start = (now - timedelta(days=1)).replace(hour=22, ...)
    else:
        period_start = now.replace(hour=22, ...)
    return period_start.strftime("risk:daily_loss:%Y-%m-%dT%H")
```

**State** lives in a Redis hash per period with fields `realized_pnl`, `signal_count`, `consecutive_losses`, `is_locked`, `locked_reason`, each updated **atomically** (`HINCRBY` / `HINCRBYFLOAT`) so that multiple Celery workers can record outcomes concurrently without lost updates. Every write also refreshes a 28-hour TTL (one period + margin).

**Default thresholds:**

| Parameter | Default | Guards against |
|---|---|---|
| `max_daily_loss_dollar` | `$1500` | Absolute dollar bleed |
| `max_daily_loss_pct` | `10%` of balance | Percentage bleed (scales with account) |
| `max_consecutive_losses` | `6` | Tilt / bad-streak |
| `max_signals_per_day` | `120` | Over-trading |
| `rollover_hour_utc` | `22` | Correct FX day boundary |

**The veto logic** (`can_emit_signal`):

```python
if snap.is_locked:                                   return False, locked_reason
if snap.signal_count >= max_signals_per_day:         return False, "over-trading cap"
if snap.realized_pnl <= -max_daily_loss_dollar:      return False, "abs loss (until recovery)"
if loss_pct >= max_daily_loss_pct:                   return False, "pct loss (until recovery)"
if snap.consecutive_losses >= max_consecutive_losses:return False, "streak (auto-clears on first win)"
return True, None
```

**Non-latching by design (a real bug fix).** The dollar/percentage/streak vetoes are now **self-recovering**: they block *only while* the realized loss is actually above the ceiling. The previous implementation `_lock()`ed the whole day, so a single small loss strangled the signal service until rollover — the infamous "no signals are coming" bug. Now a winning trade resets `consecutive_losses` to zero via `record_trade_outcome`, instantly re-opening the gate:

```python
async def record_trade_outcome(self, pnl_dollar, now=None):
    await self._hincrbyfloat(key, "realized_pnl", pnl_dollar)
    if pnl_dollar < 0:   await self._hincrby(key, "consecutive_losses", 1)
    elif pnl_dollar > 0: await self._set_field(key, "consecutive_losses", 0)
```

A *hard* lock still exists for admins via `manual_lock` / `manual_unlock`, and it is acquired with an **atomic check-and-set** (`HSETNX`) so two concurrent callers cannot both slip through the TOCTOU window.

**Fail-closed semantics.** This is a *financial* circuit breaker, so when Redis is unreachable it must **not** fall back to an in-memory zero state (which would neutralize the breaker). Every Redis helper raises `DailyLossCheckUnavailable` on error; the guard catches it and rejects the signal with a `DAILY_LOSS_LIMIT` reason. (Only the in-process test/dev path uses `_local_store`.)

---

### 7.3 `multi_level_limits.py` — hourly / daily / weekly / monthly breakers

**What it guards:** the realization that a single daily limit is insufficient. You can lose 2% of a year's gains in *one hour* (an NFP miss), 5% in a bad *week*, 10% in a failed *month*. Each timescale needs its own breaker, and breaches at different levels should produce different responses — some **soft** (shrink size), some **hard** (block entirely).

**Industry-standard config (prop-firm style):**

| Level | `max_loss_pct` | On breach | TTL | Type |
|---|---|---|---|---|
| `HOURLY` | 1.0% | `size_multiplier = 0.5` | 1 h | **soft** — halve size next hour |
| `DAILY` | 2.0% | `size_multiplier = 0.0` | 24 h | **hard** — block until rollover |
| `WEEKLY` | 5.0% | `size_multiplier = 0.0` | 7 d | **hard** — block until Monday |
| `MONTHLY` | 10.0% | `size_multiplier = 0.0` | 31 d | **hard** — block + downsize next month |

**Period keys** are timescale-appropriate: `…:hourly:2026-06-22T14`, `…:daily:2026-06-22`, `…:weekly:2026-W25` (ISO week), `…:monthly:2026-06`.

**TTL anchored to period end.** A subtle correctness detail: the counter must reset exactly when the period rolls over, so the TTL is computed as *seconds remaining until the boundary*, not a full fixed TTL — otherwise a trade near the boundary would carry the counter into the next period:

```python
@staticmethod
def _ttl_to_period_end(level, now, full_ttl):
    if level == HOURLY:  end = now.replace(minute=0,...) + timedelta(hours=1)
    elif level == DAILY: end = now.replace(hour=0,...)   + timedelta(days=1)
    elif level == WEEKLY:end = start_of_day + timedelta(days=7 - now.weekday())  # Monday
    elif level == MONTHLY: end = first-of-next-month
    return max(1, min(int((end - now).total_seconds()), full_ttl))
```

**Loss-only accumulation.** Only *losses* accumulate; profits do **not** offset accumulated losses (`new_val = current + min(pnl_dollar, 0.0)`). This is realistic for a circuit breaker: you don't want a lucky scalp to "unlock" a level that was tripped by a structural drawdown.

**How the veto translates to action.** `status()` computes, per level, a negative `limit = -|equity × max_loss_pct/100|`, marks `triggered` when `current_loss <= limit`, and assigns the level's multiplier. The **overall multiplier is the minimum** (most restrictive) across all four levels:

```python
report.overall_size_multiplier = min(l.size_multiplier for l in report.levels)
```

`can_emit_signal` then returns `(allowed, size_multiplier, reason)`:
- `1.0` → trade normally,
- `0.5` → trade at half size (a soft veto — the trade still happens, but smaller),
- `0.0` → **hard block**.

This is the cleanest illustration of the system's two-tier veto model: a soft limit *scales* a trade, a hard limit *kills* it.

---

### 7.4 `correlation.py` — currency-leg exposure caps

**What it guards:** hidden systemic concentration. `EURUSD long + GBPUSD long + AUDUSD long` are all *short USD*; if the dollar rallies, all three lose together. A naive position counter would see "three different pairs, diversified" — which is exactly backwards.

**Algorithm: currency-leg decomposition** (chosen over a static correlation matrix because it captures non-linear behavior). Every position is decomposed into ±1 exposures on its base and quote legs:

```python
LONG  EURUSD  → {EUR: +1, USD: -1}
SHORT USDJPY  → {USD: -1, JPY: +1}
LONG  XAUUSD  → {XAU: +1, USD: -1}
```

The guard sums net exposure across all open positions, adds the proposed trade, and vetoes if any currency's absolute net exposure would exceed the cap:

```python
for ccy, side in proposed_legs.items():
    future_exposure = net_exposure.get(ccy, 0) + side * proposed_risk_weight
    if abs(future_exposure) > self._max_currency_exposure:   # default 2.5
        return f"exposure to {ccy} exceeds cap ..."
```

**Second check — correlated same-direction count.** Beyond raw leg exposure, the guard also consults a **static correlation matrix** of well-known relationships (e.g. `EURUSD/GBPUSD = 0.85`, `AUDUSD/NZDUSD = 0.90`, `EURUSD/USDCHF = -0.95`, `US30/US500 = 0.95`). It counts how many open positions are *effectively same-direction* — positive correlation with same direction, **or** negative correlation with opposite direction:

```python
if (corr >= 0.7 and pos.direction == proposed_direction) or \
   (corr <= -0.7 and pos.direction != proposed_direction):
    correlated_same_direction += 1
    if correlated_same_direction >= self._max_same_dir_correlated:  # default 2
        return "N correlated same-direction trades open — systemic risk."
```

**Default thresholds:** `max_currency_exposure = 2.5`, `correlation_threshold = 0.7`, `max_same_direction_correlated = 2`. Unknown symbols (no leg mapping) are allowed through without a veto — the guard prefers a missed cap to a wrongful block. As noted in §7.1, correlation is *informational by default* and only becomes a hard veto when `CORRELATION_BLOCKS_EMISSION` is enabled for master-account protection.

---

### 7.5 `session_filter.py` — per-symbol session policy, DST- and liquidity-aware

**What it guards:** execution quality. Trading a JPY pair in the dead Sydney hour, or a US index at 03:00 UTC, means wide spreads, gappy fills, and signals built on noise. Each symbol is restricted to the sessions where it has *real, tradable* liquidity.

**Five sessions, each with winter (UTC-fixed) and summer (DST) hours:**

| Session | Winter (UTC) | Summer (UTC) | DST rule |
|---|---|---|---|
| Sydney | 22:00–06:00 | 21:00–05:00 (AEDT) | Southern-hemisphere: Oct→Apr |
| Tokyo | 00:00–09:00 | 00:00–09:00 | Japan has **no** DST |
| Frankfurt | 07:00–15:30 | 06:00–14:30 (CEST) | EU: last-Sun-Mar→last-Sun-Oct |
| London | 08:00–16:00 | 07:00–15:00 (BST) | EU |
| New York | 13:00–21:00 | 12:00–20:00 (EDT) | US: 2nd-Sun-Mar→1st-Sun-Nov |

**DST is computed per-region, not globally** — a real bug fix. During the asymmetric weeks (e.g. early March, when the US has switched but the EU has not), each session is shifted independently. Sydney is the trickiest: it is *southern-hemisphere*, so its DST is the **inverse** of Europe's (AEDT runs first-Sun-Oct → first-Sun-Apr, wrapping the year boundary). Using the European DST flag for Sydney was a one-hour-all-year bug; the dedicated `is_au_dst()` fixes it:

```python
def is_au_dst(dt):
    start = _nth_sunday(year, 10, 1)   # first Sunday of October
    end   = _nth_sunday(year, 4, 1)    # first Sunday of April
    return today >= start or today < end   # wraps the New-Year boundary
```

**Per-symbol policies** are the output of a 49-agent liquidity/quant audit. The principle: open a session for a symbol **only** where its liquidity is genuinely tradable, never where it is "synthetic" (which would degrade spread/quality). Examples from `_POLICIES`:

| Symbol | Allowed sessions | Rationale |
|---|---|---|
| EURUSD / GBPUSD / USDCHF / USDCAD | Frankfurt, London, NY | EU-bridge → European core |
| AUDUSD | Sydney, Tokyo, London, NY | Real Asia-Pacific flow |
| USDJPY / EURJPY / GBPJPY | Tokyo, Frankfurt, London, NY | Two-legged liquidity |
| XAUUSD / XAGUSD | Frankfurt, London (LBMA), NY (COMEX) | Metal benchmarks |
| XTIUSD | Frankfurt, London (ICE), NY (NYMEX) | Oil benchmarks |
| XNGUSD | London, NY only | US natural-gas benchmark |
| US30 / US500 / NAS100 / DE40 | All five | Near-24h CFD/futures products |

The index policies were widened to all five sessions after the original EU/US-only policy created a **dead zone of 20:00–06:00 UTC (~42% of the day)** in which CFD index signals were wrongly rejected; the thin 20:00–22:00 sliver is still protected by the separate low-liquidity gate below.

**The low-liquidity post-NY window** is itself DST-aware. Naively fixing it at 21:00–22:00 was only correct in winter; in summer NY closes at 20:00, opening a 20:00–21:00 hole where no session was active and NY-only symbols were rejected with the *wrong* reason. The fix ties the window to NY's actual close:

```python
def is_low_liquidity_window(now):
    ny_end       = hours[NEW_YORK][1]   # 20:00 summer / 21:00 winter
    sydney_start = hours[SYDNEY][0]     # 21:00 AEDT / 22:00 AEST
    if ny_end == sydney_start: return False   # no gap (winter)
    return _in_window(t, ny_end, sydney_start)
```

**The veto** (`is_session_allowed`) returns a machine-readable reason. Note the deliberate `"low_liquidity_window:"` prefix — the guard parses it to tag the rejection as `LOW_LIQUIDITY` rather than `SESSION_NOT_ALLOWED`, so metrics distinguish "wrong time of day" from "dead post-close window":

```python
if is_low_liquidity_window(now):
    return False, "low_liquidity_window: post-NY window — wide spread, low vol."
overlap = policy.allowed_sessions & current_sessions(now)
if not overlap:
    return False, f"outside allowed sessions for {symbol} ..."
```

`strict_unknown=True` (used by the guard) rejects symbols with no policy; the default `False` lets unknown symbols through.

---

### 7.6 `weekend_filter.py` — weekend-gap protection

**What it guards:** weekend gap risk. FX closes Friday ~21:00–22:00 UTC and reopens Sunday ~21:00–22:00 UTC. Across that gap a position is exposed to 50–200 pip jumps (Friday-night NFP, weekend geopolitical news), and a stop-loss can be *skipped* entirely, producing a loss far larger than planned.

**Blackout windows (UTC):**

| Window | Condition | Reason |
|---|---|---|
| Friday ≥ 20:00 | `weekday==4 and t >= 20:00` | High weekend-gap risk; reject new signals |
| Saturday (all day) | `weekday==5` | FX market fully closed |
| Sunday < 22:00 | `weekday==6 and t < 22:00` | Not yet fully open; wide spread, thin liquidity |

```python
if weekday == 4 and t >= _FRIDAY_BLACKOUT_FROM:  return True, "Friday after 20:00 UTC ..."
if weekday == 5:                                 return True, "Saturday — FX closed."
if weekday == 6 and t < _SUNDAY_BLACKOUT_UNTIL:  return True, "Sunday before 22:00 UTC ..."
return False, None
```

This is the **first** filter the guard runs, and a positive result short-circuits the entire evaluation (`return result`) — there is no point checking anything else on a closed market.

---

### 7.7 `holiday_calendar.py` — market-holiday awareness

**What it guards:** holiday liquidity collapse. On major holidays FX liquidity thins severely: spreads widen, prices gap, and normal-time signals become unreliable.

**Three impact tiers:**

| Impact | Meaning | Blackout behavior |
|---|---|---|
| `FULL_CLOSURE` | All markets closed (New Year, Christmas) | Block **all 24h** |
| `PARTIAL` | Some markets closed (US-only, UK/EU) | Block only during 13:00–22:00 UTC (US/EU overlap) |
| `LOW_LIQUIDITY` | Open but thin (Christmas Eve, New Year's Eve) | Block only during 13:00–22:00 UTC |

**Computed holidays** (no hard-coded year tables). Easter is derived from the **Meeus/Jones/Butcher** Gregorian algorithm, then Good Friday (`Easter − 2`) and Easter Monday (`Easter + 1`) follow. Floating US holidays use `_nth_weekday`/`_last_weekday`: MLK (3rd Mon Jan), Presidents Day (3rd Mon Feb), Memorial Day (last Mon May), Labor Day (1st Mon Sep), Thanksgiving (4th Thu Nov). Fixed-date holidays implement the **observed-day rule** (`_is_observed_for`): a holiday on Saturday is observed the preceding Friday, on Sunday the following Monday.

**Time-of-day gating for partial holidays** avoids over-blocking: a US-only holiday only matters while US/EU sessions are live (13:00–22:00 UTC); outside that window Asia/Sydney are trading normally, so no veto. Full closures ignore the clock and block all day.

```python
if today_holiday.impact == FULL_CLOSURE:
    return True, f"Holiday {name} — FX market closed."
in_affected_hours = 13 <= now.hour < 22
if impact in (PARTIAL, LOW_LIQUIDITY) and in_affected_hours:
    return True, f"Holiday {name} — {markets} closed, low liquidity."
return False, None
```

The function also **requires a timezone-aware datetime** and raises `ValueError` on a naive one — a guard against silent UTC/local confusion in a date-sensitive calculation.

---

### 7.8 `regime_detector.py` — trending vs. ranging vs. volatility

**What it guards:** strategy/regime mismatch. Trend-following systems (breakout, MA crossover) only work in trends; mean-reversion systems (RSI extremes, S/R bounce) only work in ranges. Trading the wrong strategy for the regime is *systematic* loss.

**The decision rule (Wilder ADX + ATR percentile):**

| Indicator | Threshold | Regime |
|---|---|---|
| ADX ≥ 25 & +DI > −DI | strong directional | `TRENDING_UP` |
| ADX ≥ 25 & −DI > +DI | strong directional | `TRENDING_DOWN` |
| ADX ≤ 20 | no direction | `RANGING` |
| 20 < ADX < 25 | ambiguous | `TRANSITIONAL` |
| ATR percentile ≥ 0.95 | volatility spike (news) | note → `VOLATILITY_SPIKE` veto upstream |
| ATR percentile ≤ 0.20 | squeeze (pre-breakout) | note (informational) |

**ADX is computed with proper Wilder smoothing** (`α = 1/period`, EWM with `adjust=False`), including directional movement, true range, +DI/−DI, the DX, and finally the smoothed ADX. The code carefully coerces the `pd.NA`-laden DX to `float64` so the final smoothing *skips* NaNs instead of padding with zeros (which would artificially depress ADX) — and so it doesn't crash on an `object` dtype.

**ATR percentile** ranks the current ATR against the trailing window (default 100 candles), *excluding the current candle from its own window* to avoid a look-ahead bias:

```python
recent_atr = atr_series.iloc[-lookback - 1:-1]      # exclude current candle
atr_rank   = (recent_atr <= atr).sum() / len(recent_atr)
```

An all-zero ATR returns `None` (it would otherwise read as permanent `HIGH_VOLATILITY`). Crucially, the detector **does not early-return** on a volatility extreme — it records a note and continues to classify trend/range, so a high-ATR *breakout in a trend* is not thrown away. The `atr_percentile` is returned to the guard, which decides the actual veto.

**How the regime veto fires** (`guard._check_regime_match`):

```python
if regime.regime == HIGH_VOLATILITY and reject_high_vol:
    reject(VOLATILITY_SPIKE, "ATR in top percentile — likely news/panic.")
elif regime.atr_percentile > cfg.max_atr_percentile:        # per-symbol, default 0.985
    reject(VOLATILITY_SPIKE, f"ATR at {pct} > {symbol} cap.")
if regime.regime == TRANSITIONAL and reject_transitional:
    reject(REGIME_MISMATCH, "transitional regime — insufficient confirmation.")
if strategy == "trend" and regime.is_ranging() and block_trend_in_ranging:
    reject(REGIME_MISMATCH, "trend-following in a range → low win rate.")
if strategy == "reversion" and regime.is_trending() and block_reversion_in_trending:
    reject(REGIME_MISMATCH, "mean-reversion in a trend → catching a falling knife.")
```

Direction-vs-trend conflicts (e.g. a long signal in a down-trend) produce a **warning in metadata** rather than a hard veto — the regime informs but does not always block.

---

### 7.9 `symbol_config.py` — instrument-aware risk parameters

**What it guards:** the recognition that one set of stop/RR limits cannot fit every instrument. EURUSD (deep liquidity, low vol) tolerates tight stops and modest R/R; GBPJPY or XAUUSD (high vol, wide spread) need wider stops and richer R/R; indices need their own pip-scaled bounds.

**The config dataclass** carries, per symbol: `atr_sl_multiplier`, `atr_trailing_multiplier`, `min_rr_tp1`, `min_sl_pips`, `max_sl_pips`, `max_atr_percentile` (default 0.985), and `max_sl_atr_mult` (default 8.0). A representative slice:

| Symbol | ATR×SL | min R/R | min SL | max SL | Notes |
|---|---|---|---|---|---|
| EURUSD | 2.0 | 1.2 | 8 | 60 | tight major |
| GBPJPY | 2.2 | 1.3 | 15 | 150 | volatile cross |
| XAUUSD | 2.5 | 1.3 | 30 | 400 | gold, wide |
| NAS100 | 2.5 | 1.3 | 20 | 3000 | pip_size 0.1 → big pip counts |
| US30 | 2.5 | 1.3 | 20 | 700 | pip_size 1.0 |

The index `max_sl_pips` values look enormous because they are expressed in **pips** (`price_distance / pip_size`); indices have small pip sizes (NAS100/US500/DE40 = 0.1, US30 = 1.0), so 3000 "pips" on NAS100 is only ~300 index points, sized with ~3× headroom over normal ATR. Earlier values (200–500) were really only 20–50 index points and were flagging *every* index stop as `SL_TOO_WIDE`.

**The unknown-symbol fallback** is deliberately conservative (`min_sl_pips=10, max_sl_pips=200`). And there is a runtime cap: `get_symbol_config` clamps any `min_rr_tp1 > 1.0` down to `1.0`, because the engine's TPs were brought ~30% closer (TP1 R/R ≈ 1.05) and the older 1.2–1.3 R/R floors would otherwise reject every valid signal. This is the single tuning knob that connects signal-geometry changes to the risk floor.

---

### 7.10 `position_sizer.py` — risk-percent, Kelly, vol-targeting

**What it guards:** the size of every trade — the largest determinant of long-run Sharpe. Even a positive-expectancy edge can be driven to ruin by bad sizing.

**Method 1 — Fixed-Fractional (default, 1–2%):**

```
lot = (equity × risk_pct) / (sl_pips × pip_dollar_per_lot)
```

`risk_pct` is hard-capped at `max_risk_per_trade_pct` (default 2%). After computing the raw lot, `_apply_caps` clamps to `[min_lot=0.01, max_lot=50.0]` and rounds to 0.01-lot precision; the *actual* realized risk is recomputed from the capped lot so the result never overstates exposure.

**Method 2 — Fractional Kelly:**

```
b  = avg_win / |avg_loss|
q  = 1 − win_rate
f* = (b·p − q) / b                  (full Kelly)
f_used = fraction × f*              (default fraction = 0.25, i.e. ¼-Kelly)
```

The rationale (with industry numbers) is in the code: full Kelly maximizes geometric growth but produces brutal drawdowns; ½-Kelly ≈ 75% of the growth at 50% of the volatility; ¼-Kelly ≈ 56% growth at 25% volatility — the industry standard. Two guardrails: **negative Kelly ⇒ `lot_size = 0.0`** (no edge ⇒ do not trade), and `f_used` is capped at `max_risk_pct`.

**Method 3 — Volatility-Targeting:** keep portfolio volatility constant by scaling size inversely to current vol:

```
scaling      = (target_annual_vol / 100) / current_annualized_vol
adjusted_risk = (equity × 0.01) × scaling      # baseline 1% risk, then scaled
```

Calm market → larger size; stormy market → smaller size; capped at `max_risk_pct`.

**Anti-martingale drawdown reducer** (`reduce_size_for_drawdown`): below a 5% drawdown, size is untouched; above it, size is reduced *linearly* up to `max_reduction` (default 50%) — e.g. at 20% drawdown, size = 50%. This deliberately *cuts* exposure during losing streaks, the opposite of doubling-down.

---

### 7.11 `portfolio_var.py` — Value-at-Risk & Expected Shortfall

**What it guards:** aggregate portfolio tail risk. VaR answers "with 95% confidence, what is the most I can lose in a day?"; CVaR (Expected Shortfall) answers "and when I *do* breach it, how bad is the average?".

**Parametric (variance-covariance) VaR:**

```
VaR%  = z·σ·√h − μ·h                        (clamped ≥ 0)
CVaR% = −μ·h + σ·√h · φ(z)/(1−confidence)    (normal-tail ES)
```

with `z` looked up from a table (0.95 → 1.645, 0.99 → 2.326, 0.999 → 3.090). Fast, but understates fat tails.

**Historical (empirical) VaR:** sort the historical returns, take the `(1−confidence)` percentile with linear interpolation, and compute CVaR as the mean of the tail beyond it:

```python
q    = np.percentile(sorted_returns, (1-confidence)*100, method="linear")
var_pct  = max(0.0, -q)
tail     = sorted_returns[sorted_returns <= q]
cvar_pct = max(0.0, -tail.mean())
```

This is non-parametric and correctly captures fat tails, but needs ~250 observations to be reliable (the report appends a low-confidence note below that).

**The portfolio veto** (`check_portfolio_risk`) enforces two limits before a new signal is allowed (defaults: VaR ≤ 5%, exposure ≤ 30%):

```python
projected_var_pct = sqrt(current_var_pct² + (proposed_risk / portfolio_value)²)
projected_exposure = (open_risk + proposed_risk) / portfolio_value
if projected_var_pct  > var_limit:  return PortfolioRiskCheck(allowed=False, ...VaR...)
if projected_exposure > max_exposure: return PortfolioRiskCheck(allowed=False, ...exposure...)
```

The projected-VaR formula combines current and incremental risk in quadrature (independence assumption); a comment notes that double-counting the already-embedded open risk was removed. There is also a **unit-sanity guard**: if `mean(|returns|) > 10`, the input is almost certainly raw percentages instead of fractions and would explode VaR, so it raises `ValueError` rather than silently producing a garbage number.

---

### 7.12 `margin_validator.py` — leverage & margin per regulator

**What it guards:** broker-imposed margin reality and the **stop-out catastrophe**. Regulators cap retail leverage; if a signal needs more margin than is available, or would push the account toward the broker's stop-out level (where *all* positions are force-closed), it must be rejected before it is ever sent.

**Regulator leverage table** (`_LEVERAGE_LIMITS`):

| Category | FCA (UK) | NFA (US) | ESMA (EU) | ASIC (AU) | Unregulated |
|---|---|---|---|---|---|
| fx_major | 30 | 50 | 30 | 30 | 500 |
| fx_cross | 20 | 20 | 20 | 20 | 200 |
| metal | 20 | 20 | 20 | 20 | 200 |
| energy | 10 | 10 | 10 | — | — |
| index | 20 | 20 | 20 | — | 100 |
| crypto | 2 | — | 2 | — | — |

**Notional & margin math** (`required_margin`) is instrument-aware. Standard lot units differ by class (`fx = 100,000`, `metal = 100 oz`, `energy = 1000`, `index = 1 contract`), with a per-symbol override (`XAGUSD = 5000 oz`, since silver's contract differs from gold's). The notional is then computed *correctly per quote convention*:

```
margin = notional / leverage
  XXX/USD (EURUSD, XAUUSD):  notional = units × lot × entry_price
  USD/XXX (USDJPY, USDCHF):  notional = units × lot         (base already USD)
  XXX/YYY cross (EURGBP):    notional = units × lot × entry_price / quote_usd_rate
```

The USD-base case is a genuine fix: multiplying a `USD/XXX` notional by `entry_price` was wrong, since the notional is already denominated in USD.

**Three sequential checks** (`validate_margin`):

1. **Leverage cap** — if `requested_leverage > regulator_limit`, reject (`"leverage exceeds FCA 30:1"`).
2. **Sufficient margin** — if `required_margin > (equity − used_margin)`, reject with `stop_out_risk = True`.
3. **Stop-out buffer** — compute the post-trade margin level and require a 2× safety cushion over the broker's stop-out level:

```
margin_level = equity / (used_margin + required_margin) × 100
safe_min     = stop_out_level_pct × 2          # default stop-out 50% ⇒ safe_min 100%
reject if margin_level < safe_min
```

Requiring margin level ≥ 100% (double the 50% stop-out) means even an adverse move that halves equity still won't trigger a margin call — a deliberate, conservative buffer against the "end of the world" force-liquidation.

---

### 7.13 How a veto blocks a trade — end to end

Putting it together, the lifecycle of a single candidate is:

1. The engine builds a candidate `(symbol, direction, entry, SL, TP1, candles, open_positions, balance, strategy)`.
2. `RiskGuard.evaluate()` runs filters 1–8 in cost order. Weekend/holiday short-circuit; everything else accumulates reasons.
3. If `result.allowed is False`, the signal is **dropped**, a Prometheus counter ticks per `(symbol, reason)`, and a JSON record lands in `risk:rejections` for the dashboard. The engine never publishes it and the live router never sends it.
4. If allowed, sizing runs: `multi_level_limits.can_emit_signal` returns a `size_multiplier` (1.0 / 0.5 / 0.0); `position_sizer` turns risk-percent + SL pips into a capped lot; `margin_validator` confirms the broker can actually take it; `portfolio_var` confirms the book's VaR/exposure stays inside limits. A hard `0.0` multiplier or any failed validator is itself a veto.

The result is a layered defense where **no single point of failure can both let a bad trade through and hide why** — every rejection is typed, counted, logged, and explainable.

---
---

## ۷. مدیریتِ ریسکِ نهادی

> **فلسفه.** موتورِ سیگنالی که ۱۰۰ معامله پیدا می‌کند اما در یک روزِ بد حساب را منفجر می‌کند بی‌ارزش است. به همین دلیل CoinePro-FX مدیریتِ ریسک را نه یک فکرِ بعدی، بلکه یک **دروازه‌ی درجه‌یک** می‌داند: هر سیگنالِ نامزد باید پیش از آن‌که به یک سیگنالِ منتشرشده — یا در حالتِ `live` به یک سفارش روی حسابِ مَستر — تبدیل شود، از یک زنجیره‌ی قطعی از وتوهای مستقل عبور کند. کلِ این لایه در `src/risk/` زندگی می‌کند و توسطِ یک کلاسِ واحد، `RiskGuard`، هماهنگ می‌شود که ده فیلترِ خودبسنده را ترکیب می‌کند. هر فیلتر به یک پرسشِ باریک پاسخ می‌دهد («آیا بازار باز است؟»، «آیا این با چیزی که دارم هم‌بسته است؟»، «آیا این سقفِ زیانِ روزانه را می‌شکند؟»)، به‌تنهایی قابلِ تست است، و `RejectionReason`ِ ماشین‌خوانِ خودش را تولید می‌کند تا داشبورد، متریک‌های Prometheus و لاگِ ممیزی همه به یک زبان حرف بزنند.

این فصل **هر فایل** در `src/risk/` را مستند می‌کند: الگوریتم و آستانه‌های دقیقِ هر فایل، منطقِ ریزساختارِ بازار پشتِ آن آستانه‌ها، و — مهم‌تر از همه — این‌که **یک وتو در عمل چگونه یک معامله را مسدود می‌کند**. هرجا کد فرمولِ واقعی دارد (اندازه‌گیریِ پوزیشن، کِلی، VaR، اهرم، سطحِ مارجین)، عیناً بازتولید و توضیح داده شده است.

### ۷.۰ معماری در یک نگاه

```
                         ┌─────────────────────────────────────────────┐
   سیگنالِ نامزد   ───►   │                RiskGuard.evaluate()          │
   (نماد، جهت، ورود،     │  ۱) weekend_filter   (بدون I/O، سریع‌ترین)    │
    SL، TP1، کندل‌ها،     │  ۲) holiday_calendar (بدون I/O)               │
    پوزیشن‌های باز،       │  ۳) session_filter   (بدون I/O، DST-آگاه)     │
    موجودی، استراتژی)    │  ۴) daily_loss_limit (Redis)                 │
                         │  ۵) correlation      (نیاز به پوزیشن‌های باز) │
                         │  ۶) symbol_config    (R/R + حدودِ SL)         │
                         │  ۷) regime_detector  (DataFrame، گران)        │
                         │  ۸) liquidity check  (پروفایلِ حجم)           │
                         └──────────────────────┬──────────────────────┘
                                                ▼
                              GuardResult{allowed، reasons[]، regime، metadata}
```

**ترتیب عمدی و در کد مستند است**: چک‌های ارزانِ تابع-خالص (آخرهفته، تعطیلات، سشن) اول اجرا می‌شوند تا بازارِ آشکارا مرده پیش از هر رفت‌وبرگشتِ Redis یا محاسبه‌ی pandas مدار را کوتاه کند؛ تشخیص‌گرِ گرانِ رژیم (که یک سری ۱۰۰-کندلیِ ADX/ATR را هموار می‌کند) آخر و فقط اگر بقیه عبور کرده باشند اجرا می‌شود. وتوهای آخرهفته و تعطیلات فوراً `return` می‌کنند — گزارشِ یک حدِ ضررِ تنگ در روزی که بازار بسته است بی‌معناست. بقیه‌ی وتوها **انباشته** می‌شوند: گارد به ارزیابی ادامه می‌دهد تا یک سیگنالِ ردشده *تمامِ* دلایلِ شکستش را گزارش کند که برای تنظیم بسیار ارزشمند است.

`RiskGuard` با مجموعه‌ای از کلیدهای سیاستی ساخته می‌شود که هرکدام بدونِ دست‌زدن به کدِ فیلتر قابلِ تغییرند:

| پرچمِ سازنده | پیش‌فرض | اثر در `True` |
|---|---|---|
| `reject_in_transitional_regime` | `False` | وتوی سیگنال‌ها وقتی ADX در «منطقه‌ی خاکستریِ» ۲۰–۲۵ است |
| `reject_in_high_volatility` | `True` | وتو وقتی رژیم `HIGH_VOLATILITY` است (احتمالاً خبر/پنیک) |
| `block_trend_signals_in_ranging` | `True` | وتوی ستاپ‌های روندی در بازارِ بی‌جهت |
| `block_reversion_signals_in_trending` | `True` | وتوی ستاپ‌های بازگشتی در بازارِ روندی |
| `publish_rejections_to_redis` | `True` | هر ردشدن را برای UI به `risk:rejections` می‌فرستد |
| `max_rejection_log_size` | `500` | طولِ LTRIMِ بافرِ حلقویِ ردشدن‌ها |

---

### ۷.۱ `guard.py` — دروازه‌ی یکپارچه‌ی ریسک

**چه چیزی را محافظت می‌کند:** همه‌چیز. این تنها نقطه‌ی ورودِ موتورِ سیگنال و روترِ live است.

**قراردادِ `GuardResult`.** یک «وتو» از نظرِ مکانیکی فقط فراخوانیِ `result.reject(...)` است که `allowed = False` را می‌گذارد و یک جفتِ `(کد، شرحِ انسان‌خوان)` اضافه می‌کند. چون دلایل انباشته می‌شوند، نتیجه «اولین شکست برنده است» نیست بلکه «همه‌ی شکست‌ها را گزارش کن» است. قراردادِ فراخوان ساده است:

```python
result = await guard.evaluate(...)
if not result.allowed:
    # سیگنال حذف می‌شود؛ result.reasons دلیل را توضیح می‌دهد
```

**واژگانِ شمارش‌شده‌ی ردشدن** (`RejectionReason`) ستونِ فقراتِ مشاهده‌پذیری است:

| کد | معنا |
|---|---|
| `WEEKEND_BLACKOUT` | جمعه‌شب / شنبه / یکشنبه‌ی زود |
| `HOLIDAY_BLACKOUT` | تعطیلیِ بازار (کامل یا جزئی) |
| `SESSION_NOT_ALLOWED` | خارج از سشن‌های نقدشونده‌ی نماد |
| `LOW_LIQUIDITY` | پنجره‌ی مرده‌ی پس از NY یا حجمِ نازک |
| `DAILY_LOSS_LIMIT` | مدارشکنِ روزانه فعال شد |
| `CORRELATION_RISK` | اکسپوژرِ بیش‌ازحد به یک لگِ ارزی |
| `LOW_RR` | پاداش/ریسک زیرِ کفِ نماد |
| `SL_TOO_TIGHT` / `SL_TOO_WIDE` | فاصله‌ی استاپ خارج از محدوده‌ی عاقلانه |
| `REGIME_MISMATCH` | ناهمخوانیِ استراتژی ⟷ رژیم |
| `VOLATILITY_SPIKE` | ATR در صدکِ افراطی |

**فلسفه‌ی صدورِ مالک (یک تصمیمِ طراحیِ حیاتی).** دو وتوی سنگین — زیانِ روزانه و همبستگی — به‌صورتِ پیش‌فرض **برای فیدِ عمومیِ سیگنال غیرمسدودکننده‌اند**. کد این را صریح توضیح می‌دهد: کیفیتِ سیگنال باید در «ساختارِ خودِ سیگنال» باشد (امتیاز، R/R تا TP3، تطبیقِ رژیم، وتوی Claude، هندسه‌ی SL/TP)، **نه** در مدارشکنی که کلِ فید را به‌خاطرِ یک روزِ باخت خفه کند:

```python
from src.core.config import settings as _scfg
if getattr(_scfg, "DAILY_LOSS_BLOCKS_EMISSION", False):
    ok, reason = await self._daily.can_emit_signal(account_balance, now)
    if not ok:
        result.reject(RejectionReason.DAILY_LOSS_LIMIT, reason)
else:
    ok, reason = await self._daily.can_emit_signal(account_balance, now)
    if not ok:
        result.metadata["daily_loss_note"] = reason  # فقط اطلاع‌رسانی
```

همین مسیرِ دوگانه برای همبستگی از طریقِ `CORRELATION_BLOCKS_EMISSION` اعمال می‌شود. این پرچم‌ها وجود دارند تا وقتی اتو-تریدرِ مَستر به محافظتِ *سختِ* سرمایه نیاز دارد، اپراتور آن‌ها را `True` کند، در حالی که فیدِ آموزشیِ سیگنال هرگز ساکت نمی‌شود. این جداسازیِ عمدیِ «ریسکِ سبدِ یک حسابِ واقعی» از «جریانِ اطلاعاتیِ سیگنال» است.

**بلوکِ R/R و حدودِ حدِ ضرر (فیلتر ۶).** پس از معلوم‌شدنِ اندازه‌ی پیپ، گارد محاسبه می‌کند:

```python
sl_pips  = abs(entry_price - sl) / pip_size
tp1_pips = abs(tp1 - entry_price) / pip_size
rr       = tp1_pips / sl_pips
```

و وتو می‌کند: `LOW_RR` اگر `rr < cfg.min_rr_tp1`؛ `SL_TOO_TIGHT` اگر `sl_pips < cfg.min_sl_pips`؛ و `SL_TOO_WIDE` با یک **سقفِ نسبت‌به‌ATR** به‌جای سقفِ پیپیِ ثابت.

سقفِ نسبت‌به‌ATR یک رفعِ باگِ سخت‌به‌دست‌آمده است. سقفِ پیپیِ ثابت (مثلاً NAS100 = ۳۰۰۰ پیپ) توسطِ *استاپ‌های سالم* در نوسانِ عادی شکسته می‌شد، چون استاپِ خودِ موتور تقریباً `4.875 × ATR` است. سقفِ جدید:

```
max_sl_dist = cfg.max_sl_atr_mult × ATR          (پیش‌فرض 8 × ATR)
price_backstop = |entry_price| × 0.05            (محافظِ سختِ ۵٪)
reject SL_TOO_WIDE اگر sl_dist > max_sl_dist یا sl_dist > price_backstop
```

اگر ATR در دسترس نباشد، به سقفِ پیپیِ قدیمی (`cfg.max_sl_pips`) **fail-open** می‌شود نه این‌که بی‌صدا همه‌چیز را رد کند — fail-open اینجا درست است چون استاپِ زیادی-گشاد یک مسئله‌ی کیفیتی است، نه رخدادِ نابودیِ سرمایه.

**اثرِ جانبیِ مشاهده‌پذیری.** هنگامِ ردشدن، `_publish_rejection` (در `try/except` پیچیده تا هرگز مسیرِ اصلی را نشکند) دو کار می‌کند: شمارنده‌ی `risk_rejections_total{symbol, reason}` را افزایش می‌دهد، و یک payloadِ JSON را روی `risk:rejections` با `LPUSH` می‌گذارد و با `LTRIM` به ۵۰۰ موردِ آخر می‌بُرد تا RiskPageِ ادمین را تغذیه کند.

---

### ۷.۲ `daily_loss_limit.py` — مدارشکنِ روزانه

**چه چیزی را محافظت می‌کند:** سرمایه‌ی درون‌روزی. در firmهای حرفه‌ای اگر تریدر در یک روز X٪ از سرمایه را ببازد، سیستم حساب را برای آن روز قفل می‌کند تا جلوی **revenge-trading** و **مارپیچِ باخت** را بگیرد.

**تعریفِ «روز».** در FX روز *rollover تا rollover* است (~۲۲:۰۰ UTC)، نه نیمه‌شب تا نیمه‌شب. وضعیت در کلیدهای دوره‌ایِ لنگرشده روی `rollover_hour_utc` سطل‌بندی می‌شود و در یک hashِ Redis به‌صورتِ **اتمیک** (`HINCRBY` / `HINCRBYFLOAT`) به‌روز می‌شود تا چند workerِ Celery بدونِ lost-update هم‌زمان ثبت کنند؛ هر نوشتن TTLِ ۲۸ساعته را نیز تازه می‌کند.

**آستانه‌های پیش‌فرض:**

| پارامتر | پیش‌فرض | محافظت در برابرِ |
|---|---|---|
| `max_daily_loss_dollar` | ‎$۱۵۰۰ | خون‌ریزیِ دلاریِ مطلق |
| `max_daily_loss_pct` | ۱۰٪ موجودی | خون‌ریزیِ درصدی (مقیاس‌پذیر) |
| `max_consecutive_losses` | ۶ | tilt / استریکِ بد |
| `max_signals_per_day` | ۱۲۰ | over-trading |
| `rollover_hour_utc` | ۲۲ | مرزِ درستِ روزِ FX |

**منطقِ وتو** (`can_emit_signal`):

```python
if snap.is_locked:                                   return False, locked_reason
if snap.signal_count >= max_signals_per_day:         return False, "سقفِ over-trading"
if snap.realized_pnl <= -max_daily_loss_dollar:      return False, "زیانِ مطلق (تا بهبود)"
if loss_pct >= max_daily_loss_pct:                   return False, "زیانِ درصدی (تا بهبود)"
if snap.consecutive_losses >= max_consecutive_losses:return False, "استریک (با اولین برد آزاد)"
return True, None
```

**غیرلَچ به‌صورتِ طراحی (یک رفعِ باگِ واقعی).** وتوهای دلاری/درصدی/استریک حالا **خودبهبود** هستند: *فقط تا زمانی* که زیانِ تحقق‌یافته واقعاً بالای سقف است بلاک می‌کنند. پیاده‌سازیِ قبلی کلِ روز را `_lock()` می‌کرد، پس یک باختِ کوچک سرویسِ سیگنال را تا rollover خفه می‌کرد — باگِ بدنامِ «سیگنال نمی‌آید». حالا یک بردِ سیگنال `consecutive_losses` را از طریقِ `record_trade_outcome` صفر می‌کند و گیت را فوراً باز می‌کند:

```python
async def record_trade_outcome(self, pnl_dollar, now=None):
    await self._hincrbyfloat(key, "realized_pnl", pnl_dollar)
    if pnl_dollar < 0:   await self._hincrby(key, "consecutive_losses", 1)
    elif pnl_dollar > 0: await self._set_field(key, "consecutive_losses", 0)
```

قفلِ *سختِ* دستی هنوز برای ادمین‌ها از طریقِ `manual_lock`/`manual_unlock` وجود دارد و با **check-and-setِ اتمیک** (`HSETNX`) گرفته می‌شود تا دو فراخوانِ هم‌زمان از پنجره‌ی TOCTOU رد نشوند.

**معناشناسیِ fail-closed.** این یک مدارشکنِ *مالی* است، پس وقتی Redis در دسترس نباشد **نباید** به حالتِ صفرِ حافظه‌ی محلی برگردد (که مدارشکن را خنثی می‌کند). هر helperِ Redis در خطا `DailyLossCheckUnavailable` پرتاب می‌کند؛ گارد آن را می‌گیرد و سیگنال را با دلیلِ `DAILY_LOSS_LIMIT` رد می‌کند. (فقط مسیرِ درون‌پردازشیِ تست/dev از `_local_store` استفاده می‌کند.)

---

### ۷.۳ `multi_level_limits.py` — مدارشکنِ ساعتی/روزانه/هفتگی/ماهانه

**چه چیزی را محافظت می‌کند:** این درک که یک حدِ روزانه‌ی تنها کافی نیست. می‌توان ۲٪ از سودِ یک سال را در *یک ساعت* (NFP miss)، ۵٪ را در یک *هفته‌ی* بد، ۱۰٪ را در یک *ماهِ* شکست‌خورده باخت. هر بازه‌ی زمانی به مدارشکنِ خود نیاز دارد، و شکست‌ها در سطوحِ مختلف باید پاسخ‌های متفاوت بدهند — برخی **نرم** (کوچک‌کردنِ سایز)، برخی **سخت** (بلاکِ کامل).

**پیکربندیِ استانداردِ صنعتی (سبکِ prop-firm):**

| سطح | `max_loss_pct` | در شکست | TTL | نوع |
|---|---|---|---|---|
| `HOURLY` | ۱.۰٪ | `size_multiplier = 0.5` | ۱ ساعت | **نرم** — نصف سایز ساعتِ بعد |
| `DAILY` | ۲.۰٪ | `size_multiplier = 0.0` | ۲۴ ساعت | **سخت** — بلاک تا rollover |
| `WEEKLY` | ۵.۰٪ | `size_multiplier = 0.0` | ۷ روز | **سخت** — بلاک تا دوشنبه |
| `MONTHLY` | ۱۰.۰٪ | `size_multiplier = 0.0` | ۳۱ روز | **سخت** — بلاک + کوچک‌سازیِ ماهِ بعد |

**کلیدهای دوره** متناسب با بازه‌اند: `…:hourly:2026-06-22T14`، `…:daily:2026-06-22`، `…:weekly:2026-W25` (هفته‌ی ISO)، `…:monthly:2026-06`.

**TTL لنگرشده به پایانِ دوره.** یک نکته‌ی ظریفِ درستی: شمارنده باید دقیقاً هنگامِ rollover ریست شود، پس TTL به‌صورتِ *ثانیه‌های باقی‌مانده تا مرز* محاسبه می‌شود نه یک TTLِ ثابت — وگرنه معامله‌ی نزدیکِ مرز شمارنده را به دوره‌ی بعد می‌برد:

```python
@staticmethod
def _ttl_to_period_end(level, now, full_ttl):
    if level == HOURLY:  end = now.replace(minute=0,...) + timedelta(hours=1)
    elif level == DAILY: end = now.replace(hour=0,...)   + timedelta(days=1)
    elif level == WEEKLY:end = start_of_day + timedelta(days=7 - now.weekday())  # دوشنبه
    elif level == MONTHLY: end = اولِ ماهِ بعد
    return max(1, min(int((end - now).total_seconds()), full_ttl))
```

**انباشتِ فقط-زیان.** فقط *زیان‌ها* انباشته می‌شوند؛ سودها زیان‌های انباشته را جبران نمی‌کنند (`new_val = current + min(pnl_dollar, 0.0)`). این برای یک مدارشکن واقع‌بینانه است: نمی‌خواهی یک اسکالپِ خوش‌شانس سطحی را که با drawdownِ ساختاری فعال شده «باز کند».

**ترجمه‌ی وتو به عمل.** `status()` برای هر سطح `limit = -|equity × max_loss_pct/100|` را محاسبه می‌کند، وقتی `current_loss <= limit` آن را `triggered` می‌کند، و ضریبِ سطح را می‌دهد. **ضریبِ کلی، کمینه** (محدودکننده‌ترین) در میانِ هر چهار سطح است:

```python
report.overall_size_multiplier = min(l.size_multiplier for l in report.levels)
```

سپس `can_emit_signal` سه‌گانه‌ی `(allowed, size_multiplier, reason)` را برمی‌گرداند: `1.0` معامله‌ی عادی، `0.5` معامله با نیمی از سایز (وتوی نرم — معامله انجام می‌شود اما کوچک‌تر)، `0.0` **بلاکِ سخت**. این تمیزترین نمایشِ مدلِ دو-لایه‌ی وتوست: حدِ نرم معامله را *مقیاس* می‌کند، حدِ سخت آن را *می‌کُشد*.

---

### ۷.۴ `correlation.py` — سقف‌های اکسپوژرِ لگِ ارزی

**چه چیزی را محافظت می‌کند:** تمرکزِ سیستمیِ پنهان. `EURUSD long + GBPUSD long + AUDUSD long` همگی *short USD*اند؛ اگر دلار قوی شود هر سه با هم می‌بازند. یک شمارنده‌ی ساده‌ی پوزیشن «سه جفتِ متفاوت، متنوع» می‌بیند — که دقیقاً برعکس است.

**الگوریتم: تجزیه‌ی لگِ ارزی** (به‌جای ماتریسِ همبستگیِ استاتیک انتخاب شد چون رفتارِ غیرخطی را می‌گیرد). هر پوزیشن به اکسپوژرهای ±۱ روی لگِ پایه و مظنه‌اش تجزیه می‌شود:

```python
LONG  EURUSD  → {EUR: +1, USD: -1}
SHORT USDJPY  → {USD: -1, JPY: +1}
LONG  XAUUSD  → {XAU: +1, USD: -1}
```

گارد اکسپوژرِ خالص را روی همه‌ی پوزیشن‌های باز جمع می‌زند، پیشنهاد را اضافه می‌کند، و وتو می‌کند اگر اکسپوژرِ خالصِ مطلقِ هر ارز از سقف عبور کند:

```python
for ccy, side in proposed_legs.items():
    future_exposure = net_exposure.get(ccy, 0) + side * proposed_risk_weight
    if abs(future_exposure) > self._max_currency_exposure:   # پیش‌فرض 2.5
        return f"اکسپوژر به {ccy} از سقف عبور می‌کند ..."
```

**چکِ دوم — شمارشِ هم‌جهتِ هم‌بسته.** فراتر از اکسپوژرِ خام، گارد یک **ماتریسِ همبستگیِ استاتیک** از روابطِ معروف را نیز مشورت می‌کند (مثلاً `EURUSD/GBPUSD = 0.85`، `AUDUSD/NZDUSD = 0.90`، `EURUSD/USDCHF = -0.95`، `US30/US500 = 0.95`). شمارش می‌کند چند پوزیشنِ باز عملاً *هم‌جهت*اند — همبستگیِ مثبت با جهتِ یکسان، **یا** همبستگیِ منفی با جهتِ مخالف:

```python
if (corr >= 0.7 and pos.direction == proposed_direction) or \
   (corr <= -0.7 and pos.direction != proposed_direction):
    correlated_same_direction += 1
    if correlated_same_direction >= self._max_same_dir_correlated:  # پیش‌فرض 2
        return "N معامله‌ی هم‌جهتِ هم‌بسته باز است — ریسکِ سیستمی."
```

**آستانه‌های پیش‌فرض:** `max_currency_exposure = 2.5`، `correlation_threshold = 0.7`، `max_same_direction_correlated = 2`. نمادهای ناشناخته (بدونِ نگاشتِ لگ) بدونِ وتو عبور می‌کنند — گارد یک سقفِ ازدست‌رفته را به یک بلاکِ نادرست ترجیح می‌دهد. چنان‌که در ۷.۱ گفته شد، همبستگی به‌صورتِ پیش‌فرض *اطلاعاتی* است و فقط وقتی `CORRELATION_BLOCKS_EMISSION` برای محافظتِ حسابِ مَستر فعال شود به وتوی سخت تبدیل می‌شود.

---

### ۷.۵ `session_filter.py` — سیاستِ سشنِ هر-نماد، آگاه به DST و نقدینگی

**چه چیزی را محافظت می‌کند:** کیفیتِ اجرا. معامله‌ی یک جفتِ JPY در ساعتِ مرده‌ی سیدنی، یا یک اندیسِ US در ۰۳:۰۰ UTC، یعنی اسپردِ گشاد، پُرشدنِ گپ‌دار، و سیگنال‌هایی که روی نویز ساخته شده‌اند. هر نماد به سشن‌هایی محدود می‌شود که نقدینگیِ *واقعیِ قابل‌معامله* دارد.

**پنج سشن، هرکدام با ساعاتِ زمستانی (UTC-ثابت) و تابستانی (DST):**

| سشن | زمستان (UTC) | تابستان (UTC) | قاعده‌ی DST |
|---|---|---|---|
| سیدنی | ۲۲:۰۰–۰۶:۰۰ | ۲۱:۰۰–۰۵:۰۰ (AEDT) | نیمکره‌ی جنوبی: اکتبر→آوریل |
| توکیو | ۰۰:۰۰–۰۹:۰۰ | ۰۰:۰۰–۰۹:۰۰ | ژاپن DST **ندارد** |
| فرانکفورت | ۰۷:۰۰–۱۵:۳۰ | ۰۶:۰۰–۱۴:۳۰ (CEST) | EU: آخرین‌یک‌شنبه‌ی مارس→اکتبر |
| لندن | ۰۸:۰۰–۱۶:۰۰ | ۰۷:۰۰–۱۵:۰۰ (BST) | EU |
| نیویورک | ۱۳:۰۰–۲۱:۰۰ | ۱۲:۰۰–۲۰:۰۰ (EDT) | US: دومین‌مارس→اولین‌نوامبر |

**DST هر-منطقه محاسبه می‌شود، نه سراسری** — یک رفعِ باگِ واقعی. در هفته‌های نامتقارن (مثلاً اوایلِ مارس که US رفته اما EU نه)، هر سشن مستقل شیفت می‌شود. سیدنی پیچیده‌ترین است: *نیمکره‌ی جنوبی* است، پس DSTاش **معکوسِ** اروپاست (AEDT از اولین‌یک‌شنبه‌ی اکتبر تا اولین‌یک‌شنبه‌ی آوریل، با دورزدنِ مرزِ سال). استفاده از پرچمِ DSTِ اروپایی برای سیدنی یک باگِ یک‌ساعتی-تمامِ‌سال بود؛ `is_au_dst()` اختصاصی آن را رفع می‌کند:

```python
def is_au_dst(dt):
    start = _nth_sunday(year, 10, 1)   # اولین یک‌شنبه‌ی اکتبر
    end   = _nth_sunday(year, 4, 1)    # اولین یک‌شنبه‌ی آوریل
    return today >= start or today < end   # دورِ مرزِ سالِ نو می‌پیچد
```

**سیاست‌های هر-نماد** خروجیِ یک ممیزیِ ۴۹-ایجنتِ نقدینگی/کوانت‌اند. اصل: یک سشن را برای یک نماد **فقط** جایی باز کن که نقدینگی‌اش واقعاً قابل‌معامله است، نه جایی که «ساختگی» است (که اسپرد/کیفیت را خراب می‌کند). نمونه‌هایی از `_POLICIES`:

| نماد | سشن‌های مجاز | منطق |
|---|---|---|
| EURUSD / GBPUSD / USDCHF / USDCAD | فرانکفورت، لندن، NY | پلِ اروپا → هسته‌ی اروپایی |
| AUDUSD | سیدنی، توکیو، لندن، NY | جریانِ واقعیِ آسیا-اقیانوسیه |
| USDJPY / EURJPY / GBPJPY | توکیو، فرانکفورت، لندن، NY | نقدینگیِ دو-لگه |
| XAUUSD / XAGUSD | فرانکفورت، لندن (LBMA)، NY (COMEX) | بنچمارک‌های فلز |
| XTIUSD | فرانکفورت، لندن (ICE)، NY (NYMEX) | بنچمارک‌های نفت |
| XNGUSD | فقط لندن، NY | بنچمارکِ گازِ US |
| US30 / US500 / NAS100 / DE40 | هر پنج | محصولاتِ CFD/فیوچرزِ نزدیک‌به‌۲۴ساعته |

سیاستِ اندیس‌ها پس از آن‌که سیاستِ اولیه‌ی فقط-EU/US یک **منطقه‌ی مرده‌ی ۲۰:۰۰–۰۶:۰۰ UTC (~۴۲٪ روز)** ساخت که در آن سیگنال‌های اندیسِ CFD اشتباهاً رد می‌شدند، به هر پنج سشن گسترش یافت؛ نوارِ نازکِ ۲۰:۰۰–۲۲:۰۰ هنوز با گیتِ مجزای کم‌نقدینگیِ زیر محافظت می‌شود.

**پنجره‌ی کم‌نقدینگیِ پس از NY** خودش DST-آگاه است. تثبیتِ ساده‌ی آن روی ۲۱:۰۰–۲۲:۰۰ فقط در زمستان درست بود؛ در تابستان NY در ۲۰:۰۰ می‌بندد و یک حفره‌ی ۲۰:۰۰–۲۱:۰۰ باز می‌کرد که هیچ سشنی فعال نبود و نمادهای NY-only با دلیلِ *غلط* رد می‌شدند. رفع، پنجره را به بسته‌شدنِ واقعیِ NY گره می‌زند:

```python
def is_low_liquidity_window(now):
    ny_end       = hours[NEW_YORK][1]   # ۲۰:۰۰ تابستان / ۲۱:۰۰ زمستان
    sydney_start = hours[SYDNEY][0]     # ۲۱:۰۰ AEDT / ۲۲:۰۰ AEST
    if ny_end == sydney_start: return False   # بدونِ شکاف (زمستان)
    return _in_window(t, ny_end, sydney_start)
```

**وتو** (`is_session_allowed`) یک دلیلِ ماشین‌خوان برمی‌گرداند. به پیشوندِ عمدیِ `"low_liquidity_window:"` توجه کنید — گارد آن را parse می‌کند تا ردشدن را `LOW_LIQUIDITY` برچسب بزند نه `SESSION_NOT_ALLOWED`، تا متریک‌ها «زمانِ نادرستِ روز» را از «پنجره‌ی مرده‌ی پس از بسته‌شدن» تفکیک کنند:

```python
if is_low_liquidity_window(now):
    return False, "low_liquidity_window: پنجره‌ی پس از NY — اسپردِ گشاد، نوسانِ کم."
overlap = policy.allowed_sessions & current_sessions(now)
if not overlap:
    return False, f"خارج از سشن‌های مجازِ {symbol} ..."
```

`strict_unknown=True` (که گارد استفاده می‌کند) نمادهای بدونِ سیاست را رد می‌کند؛ پیش‌فرضِ `False` نمادهای ناشناخته را عبور می‌دهد.

---

### ۷.۶ `weekend_filter.py` — محافظتِ گپِ آخرهفته

**چه چیزی را محافظت می‌کند:** ریسکِ گپِ آخرهفته. FX جمعه ~۲۱:۰۰–۲۲:۰۰ UTC می‌بندد و یکشنبه ~۲۱:۰۰–۲۲:۰۰ UTC باز می‌شود. در این فاصله یک پوزیشن در معرضِ پرش‌های ۵۰–۲۰۰ پیپی (NFPِ جمعه‌شب، اخبارِ ژئوپلیتیکِ آخرهفته) است، و یک حدِ ضرر می‌تواند کاملاً *skip* شود و زیانی بسیار بزرگ‌تر از برنامه بسازد.

**پنجره‌های blackout (UTC):**

| پنجره | شرط | دلیل |
|---|---|---|
| جمعه ≥ ۲۰:۰۰ | `weekday==4 and t >= 20:00` | ریسکِ بالای گپ؛ سیگنالِ جدید رد |
| شنبه (تمامِ روز) | `weekday==5` | بازارِ FX کاملاً بسته |
| یکشنبه < ۲۲:۰۰ | `weekday==6 and t < 22:00` | هنوز کاملاً باز نیست؛ اسپردِ گشاد، نقدینگیِ نازک |

این **اولین** فیلتری است که گارد اجرا می‌کند، و نتیجه‌ی مثبت کلِ ارزیابی را کوتاه می‌کند (`return result`) — بررسیِ هرچیزِ دیگر در بازارِ بسته بی‌معناست.

---

### ۷.۷ `holiday_calendar.py` — آگاهی از تعطیلاتِ بازار

**چه چیزی را محافظت می‌کند:** فروپاشیِ نقدینگیِ تعطیلات. در تعطیلاتِ اصلی نقدینگیِ FX به‌شدت نازک می‌شود: اسپرد گشاد می‌شود، قیمت‌ها گپ می‌خورند، و سیگنال‌های زمانِ-عادی غیرقابل‌اعتمادند.

**سه ردهِ تأثیر:**

| تأثیر | معنا | رفتارِ blackout |
|---|---|---|
| `FULL_CLOSURE` | همه‌ی بازارها بسته (سالِ نو، کریسمس) | بلاکِ **تمامِ ۲۴ ساعت** |
| `PARTIAL` | برخی بازارها بسته (فقط US، UK/EU) | بلاک فقط در ۱۳:۰۰–۲۲:۰۰ UTC |
| `LOW_LIQUIDITY` | باز اما نازک (شبِ کریسمس، شبِ سالِ نو) | بلاک فقط در ۱۳:۰۰–۲۲:۰۰ UTC |

**تعطیلاتِ محاسبه‌شده** (بدونِ جدولِ سال‌های هاردکد). عید پاک از الگوریتمِ گریگوریِ **Meeus/Jones/Butcher** مشتق می‌شود، سپس Good Friday (`عیدِ پاک − 2`) و Easter Monday (`عیدِ پاک + 1`). تعطیلاتِ شناورِ US از `_nth_weekday`/`_last_weekday` استفاده می‌کنند: MLK (سومین دوشنبه‌ی ژانویه)، روزِ رؤسای‌جمهور (سومین دوشنبه‌ی فوریه)، Memorial Day (آخرین دوشنبه‌ی می)، Labor Day (اولین دوشنبه‌ی سپتامبر)، Thanksgiving (چهارمین پنجشنبه‌ی نوامبر). تعطیلاتِ تاریخ‌ثابت **قاعده‌ی روزِ observed** را پیاده می‌کنند (`_is_observed_for`): تعطیلیِ شنبه جمعه‌ی قبل، یکشنبه دوشنبه‌ی بعد رعایت می‌شود.

**گیتِ زمانِ-روز برای تعطیلاتِ جزئی** از بلاکِ بیش‌ازحد جلوگیری می‌کند: یک تعطیلیِ فقط-US فقط وقتی سشن‌های US/EU زنده‌اند (۱۳:۰۰–۲۲:۰۰ UTC) اهمیت دارد؛ خارج از آن، آسیا/سیدنی عادی معامله می‌کنند، پس وتویی نیست. بسته‌شدنِ کامل ساعت را نادیده می‌گیرد و کلِ روز بلاک می‌کند.

تابع همچنین **datetimeِ timezone-aware را الزامی می‌کند** و روی datetimeِ naive `ValueError` پرتاب می‌کند — محافظی در برابرِ خلطِ بی‌صدای UTC/محلی در یک محاسبه‌ی حساس‌به‌تاریخ.

---

### ۷.۸ `regime_detector.py` — روندی در برابرِ بی‌جهت در برابرِ نوسان

**چه چیزی را محافظت می‌کند:** ناهمخوانیِ استراتژی/رژیم. سیستم‌های روندی (بریک‌اوت، تقاطعِ MA) فقط در روند کار می‌کنند؛ سیستم‌های بازگشتی (اکستریم‌های RSI، بازگشتِ S/R) فقط در رِنج. معامله‌ی استراتژیِ نادرست برای رژیم، زیانِ *سیستماتیک* است.

**قاعده‌ی تصمیم (ADXِ Wilder + صدکِ ATR):**

| اندیکاتور | آستانه | رژیم |
|---|---|---|
| ADX ≥ ۲۵ و ‎+DI > −DI | جهت‌دارِ قوی | `TRENDING_UP` |
| ADX ≥ ۲۵ و −DI > +DI | جهت‌دارِ قوی | `TRENDING_DOWN` |
| ADX ≤ ۲۰ | بدونِ جهت | `RANGING` |
| ۲۰ < ADX < ۲۵ | مبهم | `TRANSITIONAL` |
| صدکِ ATR ≥ ۰.۹۵ | اسپایکِ نوسان (خبر) | note → وتوی `VOLATILITY_SPIKE` |
| صدکِ ATR ≤ ۰.۲۰ | squeeze (پیش‌بریک‌اوت) | note (اطلاعاتی) |

**ADX با هموارسازیِ صحیحِ Wilder** محاسبه می‌شود (`α = 1/period`، EWM با `adjust=False`)، شاملِ حرکتِ جهت‌دار، true range، ‎+DI/−DI، DX، و در نهایت ADXِ هموار. کد با دقت DXِ پُر از `pd.NA` را به `float64` تبدیل می‌کند تا هموارسازیِ نهایی NaNها را *skip* کند نه این‌که با صفر pad کند (که ADX را مصنوعاً پایین می‌آورد) — و تا روی dtypeِ `object` کرش نکند.

**صدکِ ATR** ATRِ فعلی را در برابرِ پنجره‌ی تریلینگ (پیش‌فرض ۱۰۰ کندل) رتبه می‌دهد، *با حذفِ کندلِ جاری از پنجره‌ی خودش* تا سوگیریِ look-ahead رخ ندهد:

```python
recent_atr = atr_series.iloc[-lookback - 1:-1]      # حذفِ کندلِ جاری
atr_rank   = (recent_atr <= atr).sum() / len(recent_atr)
```

ATRِ تماماً-صفر `None` برمی‌گرداند (وگرنه `HIGH_VOLATILITY`ِ دائمی خوانده می‌شد). مهم‌تر، تشخیص‌گر روی اکستریمِ نوسان **early-return نمی‌کند** — یک note ثبت می‌کند و به دسته‌بندیِ روند/رِنج ادامه می‌دهد، تا یک *بریک‌اوتِ پُر-ATR در روند* دور ریخته نشود. `atr_percentile` به گارد برمی‌گردد که وتوی واقعی را تصمیم می‌گیرد.

**نحوه‌ی شلیکِ وتوی رژیم** (`guard._check_regime_match`):

```python
if regime.regime == HIGH_VOLATILITY and reject_high_vol:
    reject(VOLATILITY_SPIKE, "ATR در صدکِ بالا — احتمالاً خبر/پنیک.")
elif regime.atr_percentile > cfg.max_atr_percentile:        # هر-نماد، پیش‌فرض 0.985
    reject(VOLATILITY_SPIKE, f"ATR در {pct} > سقفِ {symbol}.")
if regime.regime == TRANSITIONAL and reject_transitional:
    reject(REGIME_MISMATCH, "رژیمِ گذار — تأییدِ ناکافی.")
if strategy == "trend" and regime.is_ranging() and block_trend_in_ranging:
    reject(REGIME_MISMATCH, "روندی در رِنج → نرخِ بردِ پایین.")
if strategy == "reversion" and regime.is_trending() and block_reversion_in_trending:
    reject(REGIME_MISMATCH, "بازگشتی در روند → گرفتنِ چاقوی در حالِ سقوط.")
```

تضادهای جهت-با-روند (مثلاً سیگنالِ خرید در روندِ نزولی) یک **هشدار در metadata** تولید می‌کنند نه وتوی سخت — رژیم آگاه می‌کند اما همیشه بلاک نمی‌کند.

---

### ۷.۹ `symbol_config.py` — پارامترهای ریسکِ آگاه‌به‌ابزار

**چه چیزی را محافظت می‌کند:** این درک که یک مجموعه از حدودِ استاپ/RR نمی‌تواند به هر ابزار بخورد. EURUSD (نقدینگیِ عمیق، نوسانِ کم) استاپِ تنگ و R/Rِ متوسط را تحمل می‌کند؛ GBPJPY یا XAUUSD (نوسانِ بالا، اسپردِ گشاد) به استاپِ گشادتر و R/Rِ غنی‌تر نیاز دارند؛ اندیس‌ها حدودِ پیپ-مقیاسِ خود را می‌خواهند.

**دیتاکلسِ پیکربندی** برای هر نماد حمل می‌کند: `atr_sl_multiplier`، `atr_trailing_multiplier`، `min_rr_tp1`، `min_sl_pips`، `max_sl_pips`، `max_atr_percentile` (پیش‌فرض ۰.۹۸۵)، و `max_sl_atr_mult` (پیش‌فرض ۸.۰). یک برشِ نماینده:

| نماد | ATR×SL | min R/R | min SL | max SL | یادداشت |
|---|---|---|---|---|---|
| EURUSD | 2.0 | 1.2 | 8 | 60 | میجرِ تنگ |
| GBPJPY | 2.2 | 1.3 | 15 | 150 | کراسِ پُرنوسان |
| XAUUSD | 2.5 | 1.3 | 30 | 400 | طلا، گشاد |
| NAS100 | 2.5 | 1.3 | 20 | 3000 | pip_size 0.1 → پیپ‌های بزرگ |
| US30 | 2.5 | 1.3 | 20 | 700 | pip_size 1.0 |

مقادیرِ `max_sl_pips`ِ اندیس‌ها عظیم به‌نظر می‌رسند چون برحسبِ **پیپ** بیان شده‌اند (`price_distance / pip_size`)؛ اندیس‌ها pip_sizeِ کوچک دارند (NAS100/US500/DE40 = 0.1، US30 = 1.0)، پس ۳۰۰۰ «پیپ» روی NAS100 فقط ~۳۰۰ پوینتِ اندیس است، با ~۳× هدروم روی ATRِ عادی. مقادیرِ قبلی (۲۰۰–۵۰۰) واقعاً فقط ۲۰–۵۰ پوینت بودند و *هر* استاپِ اندیس را `SL_TOO_WIDE` می‌کردند.

**فال‌بکِ نمادِ ناشناخته** عمداً محافظه‌کار است (`min_sl_pips=10, max_sl_pips=200`). و یک سقفِ زمانِ-اجرا هست: `get_symbol_config` هر `min_rr_tp1 > 1.0` را به `1.0` می‌چسباند، چون TPهای موتور ~۳۰٪ نزدیک‌تر شدند (TP1 R/R ≈ 1.05) و کفِ R/Rِ قدیمیِ ۱.۲–۱.۳ وگرنه هر سیگنالِ معتبر را رد می‌کرد. این تنها پیچِ تنظیمی است که تغییراتِ هندسه‌ی سیگنال را به کفِ ریسک متصل می‌کند.

---

### ۷.۱۰ `position_sizer.py` — درصدِ ریسک، کِلی، هدف‌گذاریِ نوسان

**چه چیزی را محافظت می‌کند:** اندازه‌ی هر معامله — بزرگ‌ترین تعیین‌کننده‌ی Sharpeِ بلندمدت. حتی یک لبه‌ی expectancy-مثبت با sizingِ بد به ruin می‌رسد.

**روش ۱ — Fixed-Fractional (پیش‌فرض، ۱–۲٪):**

```
lot = (equity × risk_pct) / (sl_pips × pip_dollar_per_lot)
```

`risk_pct` در `max_risk_per_trade_pct` (پیش‌فرض ۲٪) سقف می‌خورد. پس از محاسبه‌ی لاتِ خام، `_apply_caps` به `[min_lot=0.01, max_lot=50.0]` می‌چسباند و به دقتِ ۰.۰۱-لات گرد می‌کند؛ ریسکِ *واقعیِ* تحقق‌یافته از لاتِ سقف‌خورده بازمحاسبه می‌شود تا نتیجه هرگز اکسپوژر را بیش‌برآورد نکند.

**روش ۲ — Fractional Kelly:**

```
b  = avg_win / |avg_loss|
q  = 1 − win_rate
f* = (b·p − q) / b                  (کِلیِ کامل)
f_used = fraction × f*              (پیش‌فرض fraction = 0.25، یعنی ¼-کِلی)
```

منطق (با اعدادِ صنعتی) در کد است: کِلیِ کامل رشدِ هندسی را بیشینه می‌کند اما drawdownِ بی‌رحم می‌سازد؛ ½-کِلی ≈ ۷۵٪ رشد با ۵۰٪ نوسان؛ ¼-کِلی ≈ ۵۶٪ رشد با ۲۵٪ نوسان — استانداردِ صنعتی. دو نرده‌ی محافظ: **کِلیِ منفی ⇒ `lot_size = 0.0`** (بدونِ لبه ⇒ معامله نکن)، و `f_used` در `max_risk_pct` سقف می‌خورد.

**روش ۳ — هدف‌گذاریِ نوسان:** نوسانِ سبد را ثابت نگه‌دار با مقیاسِ معکوسِ نوسانِ فعلی:

```
scaling      = (target_annual_vol / 100) / current_annualized_vol
adjusted_risk = (equity × 0.01) × scaling      # خط‌پایه‌ی ۱٪ ریسک، سپس مقیاس
```

بازارِ آرام → سایزِ بزرگ‌تر؛ بازارِ طوفانی → سایزِ کوچک‌تر؛ سقف در `max_risk_pct`.

**کاهنده‌ی drawdownِ ضد-مارتینگل** (`reduce_size_for_drawdown`): زیرِ ۵٪ drawdown، سایز دست‌نخورده؛ بالای آن، سایز *خطی* تا `max_reduction` (پیش‌فرض ۵۰٪) کم می‌شود — مثلاً در ۲۰٪ drawdown، سایز = ۵۰٪. این عمداً اکسپوژر را در استریک‌های باخت *می‌بُرد*، عکسِ دو-برابر-کردن.

---

### ۷.۱۱ `portfolio_var.py` — ارزشِ در معرضِ خطر و کسریِ مورد انتظار

**چه چیزی را محافظت می‌کند:** ریسکِ دُمِ تجمعیِ سبد. VaR پاسخ می‌دهد «با ۹۵٪ اعتماد، بیشترین زیانِ یک روز چقدر است؟»؛ CVaR (کسریِ مورد انتظار) پاسخ می‌دهد «و وقتی *واقعاً* آن را می‌شکنم، میانگین چقدر بد است؟».

**VaRِ پارامتریک (واریانس-کوواریانس):**

```
VaR%  = z·σ·√h − μ·h                        (چسبیده به ≥ 0)
CVaR% = −μ·h + σ·√h · φ(z)/(1−confidence)    (ESِ دُمِ نرمال)
```

با `z` از یک جدول (۰.۹۵ → ۱.۶۴۵، ۰.۹۹ → ۲.۳۲۶، ۰.۹۹۹ → ۳.۰۹۰). سریع، اما دُم‌های چاق را کم‌برآورد می‌کند.

**VaRِ تاریخی (تجربی):** بازده‌های تاریخی را مرتب کن، چندکِ `(1−confidence)` را با درون‌یابیِ خطی بگیر، و CVaR را میانگینِ دُمِ فراتر از آن بگیر:

```python
q    = np.percentile(sorted_returns, (1-confidence)*100, method="linear")
var_pct  = max(0.0, -q)
tail     = sorted_returns[sorted_returns <= q]
cvar_pct = max(0.0, -tail.mean())
```

این غیرپارامتریک است و دُم‌های چاق را درست می‌گیرد، اما برای اعتماد به ~۲۵۰ مشاهده نیاز دارد (گزارش زیرِ آن یک noteِ کم‌اعتماد می‌افزاید).

**وتوی سبد** (`check_portfolio_risk`) پیش از مجازشدنِ سیگنالِ جدید دو حد را اعمال می‌کند (پیش‌فرض: VaR ≤ ۵٪، اکسپوژر ≤ ۳۰٪):

```python
projected_var_pct = sqrt(current_var_pct² + (proposed_risk / portfolio_value)²)
projected_exposure = (open_risk + proposed_risk) / portfolio_value
if projected_var_pct  > var_limit:  return PortfolioRiskCheck(allowed=False, ...VaR...)
if projected_exposure > max_exposure: return PortfolioRiskCheck(allowed=False, ...exposure...)
```

فرمولِ VaRِ پیش‌بینی‌شده، ریسکِ فعلی و افزایشی را به‌صورتِ ربعی ترکیب می‌کند (فرضِ استقلال)؛ یک کامنت اشاره می‌کند که دوبار-شماریِ ریسکِ بازِ از-پیش-جاسازی‌شده حذف شد. یک **محافظِ سلامتِ واحد** هم هست: اگر `mean(|returns|) > 10`، ورودی تقریباً قطعاً به‌جای کسر، درصدِ خام است و VaR را منفجر می‌کند، پس به‌جای تولیدِ بی‌صدای یک عددِ آشغال `ValueError` پرتاب می‌کند.

---

### ۷.۱۲ `margin_validator.py` — اهرم و مارجین به‌ازای رگولاتور

**چه چیزی را محافظت می‌کند:** واقعیتِ مارجینِ تحمیلیِ بروکر و **فاجعه‌ی stop-out**. رگولاتورها اهرمِ retail را سقف می‌زنند؛ اگر سیگنالی بیش از مارجینِ موجود نیاز دارد، یا حساب را به‌سوی سطحِ stop-outِ بروکر (که در آن *همه‌ی* پوزیشن‌ها به‌اجبار بسته می‌شوند) هل می‌دهد، باید پیش از ارسال رد شود.

**جدولِ اهرمِ رگولاتور** (`_LEVERAGE_LIMITS`):

| دسته | FCA (UK) | NFA (US) | ESMA (EU) | ASIC (AU) | بدونِ‌رگولاتور |
|---|---|---|---|---|---|
| fx_major | ۳۰ | ۵۰ | ۳۰ | ۳۰ | ۵۰۰ |
| fx_cross | ۲۰ | ۲۰ | ۲۰ | ۲۰ | ۲۰۰ |
| metal | ۲۰ | ۲۰ | ۲۰ | ۲۰ | ۲۰۰ |
| energy | ۱۰ | ۱۰ | ۱۰ | — | — |
| index | ۲۰ | ۲۰ | ۲۰ | — | ۱۰۰ |
| crypto | ۲ | — | ۲ | — | — |

**ریاضیِ notional و مارجین** (`required_margin`) آگاه‌به‌ابزار است. واحدهای لاتِ استاندارد بر اساسِ دسته فرق دارند (`fx = 100,000`، `metal = 100 oz`، `energy = 1000`، `index = 1 contract`)، با override هر-نماد (`XAGUSD = 5000 oz`، چون قراردادِ نقره با طلا فرق دارد). سپس notional *درست بر اساسِ قراردادِ مظنه* محاسبه می‌شود:

```
margin = notional / leverage
  XXX/USD (EURUSD، XAUUSD):  notional = units × lot × entry_price
  USD/XXX (USDJPY، USDCHF):  notional = units × lot         (پایه از قبل USD)
  XXX/YYY کراس (EURGBP):     notional = units × lot × entry_price / quote_usd_rate
```

حالتِ USD-پایه یک رفعِ واقعی است: ضربِ notionalِ `USD/XXX` در `entry_price` غلط بود، چون notional از قبل به USD است.

**سه چکِ متوالی** (`validate_margin`):

۱. **سقفِ اهرم** — اگر `requested_leverage > regulator_limit`، رد (`"اهرم از FCA 30:1 عبور می‌کند"`).
۲. **مارجینِ کافی** — اگر `required_margin > (equity − used_margin)`، رد با `stop_out_risk = True`.
۳. **بافرِ stop-out** — سطحِ مارجینِ پس از معامله را محاسبه کن و یک بالشتکِ ایمنیِ ۲× روی سطحِ stop-outِ بروکر بخواه:

```
margin_level = equity / (used_margin + required_margin) × 100
safe_min     = stop_out_level_pct × 2          # stop-outِ پیش‌فرض ۵۰٪ ⇒ safe_min ۱۰۰٪
reject اگر margin_level < safe_min
```

الزامِ سطحِ مارجین ≥ ۱۰۰٪ (دو-برابرِ stop-outِ ۵۰٪) یعنی حتی یک حرکتِ نامساعد که equity را نصف کند هم margin call را فعال نمی‌کند — یک بافرِ عمدیِ محافظه‌کارانه در برابرِ تصفیه‌ی اجباریِ «پایانِ دنیا».

---

### ۷.۱۳ نحوه‌ی مسدودکردنِ معامله توسطِ وتو — سرتاسر

با کنارِ هم گذاشتن، چرخه‌ی حیاتِ یک نامزدِ واحد:

۱. موتور یک نامزدِ `(symbol, direction, entry, SL, TP1, candles, open_positions, balance, strategy)` می‌سازد.
۲. `RiskGuard.evaluate()` فیلترهای ۱–۸ را به‌ترتیبِ هزینه اجرا می‌کند. آخرهفته/تعطیلات کوتاه می‌کنند؛ بقیه دلایل را انباشته می‌کنند.
۳. اگر `result.allowed is False` باشد، سیگنال **حذف** می‌شود، یک شمارنده‌ی Prometheus به‌ازای `(symbol, reason)` تیک می‌خورد، و یک رکوردِ JSON روی `risk:rejections` برای داشبورد می‌نشیند. موتور هرگز آن را منتشر نمی‌کند و روترِ live هرگز نمی‌فرستد.
۴. اگر مجاز بود، sizing اجرا می‌شود: `multi_level_limits.can_emit_signal` یک `size_multiplier` (۱.۰ / ۰.۵ / ۰.۰) برمی‌گرداند؛ `position_sizer` درصدِ ریسک + پیپِ SL را به یک لاتِ سقف‌خورده تبدیل می‌کند؛ `margin_validator` تأیید می‌کند بروکر واقعاً می‌تواند آن را بگیرد؛ `portfolio_var` تأیید می‌کند VaR/اکسپوژرِ سبد درونِ حدود می‌ماند. یک ضریبِ سختِ `0.0` یا هر validatorِ شکست‌خورده خودش یک وتوست.

نتیجه یک دفاعِ لایه‌ای است که در آن **هیچ نقطه‌ی شکستِ واحدی نمی‌تواند هم یک معامله‌ی بد را عبور دهد و هم دلیلش را پنهان کند** — هر ردشدن تایپ‌شده، شمرده‌شده، لاگ‌شده و قابلِ‌توضیح است.

---

[⬅ 6. The Signal Engine — Decision Core & Lifecycle](signal-engine.md) · [🏠 Home · خانه](../README.md) · [8. Backtesting, Walk‑Forward & Live‑Readiness Gating ➡](backtesting.md)
