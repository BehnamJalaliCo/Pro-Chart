[⬅ 3. The Data Layer — Ingestion, Time‑Series Storage & Caching](data-layer.md) · [🏠 Home · خانه](../README.md) · [5. The Machine‑Learning Subsystem ➡](machine-learning.md)

---

## 4. Market Analysis Engine

> **Technicals · Candlestick & Chart Patterns · Smart‑Money Concepts · Volume Profile · Multi‑Timeframe Confluence**
>
> Source of truth: every module under [`src/analysis/`](../src/analysis/). This chapter documents the *exact* computations, scoring algorithms and trading concepts implemented in code — not idealised textbook versions — and then traces how each analyzer's output is consumed by the **scorer** (`src/signals/scorer.py`) and the **engine** (`src/signals/engine.py`).

The Market Analysis Engine is a **fan‑out / fan‑in** subsystem. For one OHLCV `DataFrame` (columns `timestamp, open, high, low, close, volume`) it runs seven independent analyzers, each emitting a self‑contained `dict`. Every analyzer maps the market state onto a **0–100 score where 50 is strictly neutral, >50 is bullish and <50 is bearish**. This invariant is the contract that lets the scorer linearly blend heterogeneous evidence (oscillators, candlesticks, institutional footprints, machine‑learning) without unit mismatch.

### 4.0 Architecture & data contract

| Module | Class / entry point | Output key(s) | Concept domain |
|---|---|---|---|
| `technical.py` | `TechnicalAnalyzer.analyze(df, timeframe)` | `technical_score`, `category_scores`, `trend/momentum/volatility/volume` | 21 classical indicators |
| `candlestick_patterns.py` | `CandlestickAnalyzer.analyze(df)` | `pattern_score`, `patterns_found`, `bullish_count`, `bearish_count` | 27 candlestick patterns |
| `chart_patterns.py` | `ChartPatternAnalyzer.analyze(df)` | `pattern_score`, `patterns_found`, `dominant_direction` | 17 geometric chart patterns |
| `smart_money.py` | `SmartMoneyAnalyzer.analyze(df)` | `smc_score`, `smc_bias`, `order_blocks`, `fair_value_gaps`, `structure`, `supply_demand_zones`, `liquidity_sweeps`, `premium_discount` | SMC / ICT |
| `volume_analysis.py` + `volume_profile.py` | `VolumeAnalyzer.analyze(df)`, `calculate_volume_profile`, `assess_liquidity` | `volume_score`, `volume_confirms_trend`, `poc/vah/val`, liquidity | Volume / order‑flow |
| `support_resistance.py` | `SupportResistanceAnalyzer.analyze(df, pip_size)` | `sr_levels`, `pivots`, `fibonacci_*`, `nearest_support/resistance` | Levels & Fibonacci |
| `multi_timeframe.py` | `MultiTimeframeAnalyzer.analyze(candles_by_tf)` | `confluence_count`, `net_confluence`, `direction`, `higher_tf_bias`, `conflict`, `aligned` | Top‑down confluence |

The engine instantiates all of them once (`engine.py` lines 78–84) and calls each per‑symbol per‑cycle. The scorer then collapses the dicts into a single trade score (§4.8).

---

### 4.1 `technical.py` — the 21‑indicator weighted ensemble

`TechnicalAnalyzer` is the largest analyzer (≈1820 LOC). It computes **21 indicators** grouped into four categories, each indicator returning an `IndicatorResult(name, signal, score, details)`. The category averages are blended by fixed weights:

```python
_CATEGORY_WEIGHTS = {"trend": 0.35, "momentum": 0.30, "volatility": 0.15, "volume": 0.20}
technical_score = Σ_cat  mean(scores_in_cat) · weight_cat
```

`Signal` is a 5‑level enum mapped to anchor scores `{STRONG_BULLISH:100, BULLISH:75, NEUTRAL:50, BEARISH:25, STRONG_BEARISH:0}`, and `_score_to_signal` thresholds them back at 80/60/40/20. Every indicator starts at the neutral baseline `score = 50.0` and is nudged ± by discrete rule weights, then `np.clip(score, 0, 100)`.

Two cross‑cutting helpers are worth highlighting because they encode genuine trading nuance:

**Divergence engine** — `_detect_divergence(price, indicator, lookback=30)` splits the lookback window in half and compares the price extreme of each half against the indicator value *at that same bar*:

```python
regular_bullish = (p_second_low  < p_first_low)  and (ind_second_low  > ind_first_low)
regular_bearish = (p_second_high > p_first_high) and (ind_second_high < ind_first_high)
hidden_bullish  = (p_second_low  > p_first_low)  and (ind_second_low  < ind_first_low)
hidden_bearish  = (p_second_high < p_first_high) and (ind_second_high > ind_first_high)
```

This is reused by both RSI and MACD. Regular divergence is a reversal cue (+12/−12); hidden divergence is a continuation cue (+8/−8).

#### 4.1.1 Trend category (weight 0.35)

| Indicator | Params | Bullish logic (score deltas) |
|---|---|---|
| **EMA Cross** | 20/50/200 | golden cross +25, alignment `ef>em>es` +15, `price>EMA200` +10 (symmetric −) |
| **SuperTrend** | length 10, mult 3.0 | direction +20, flip‑to‑bull +15 |
| **Ichimoku** | 9/26/52 | TK cross +12, above Kumo +12, bullish Kumo +6, Chikou +8, TK+Kumo combo +6 |
| **ADX** | 14 | if ADX≥25 & DI+>DI− +15 (+10 if ADX≥40); ranging → ±5 |
| **Parabolic SAR** | default | SAR below price +20, flip +10 |
| **VWMA** | 20 | `min(|dist%|·5, 25)` above/below |

The **Ichimoku** implementation is notably correct about *repaint*: the cloud the price sits in is the Senkou span computed **26 periods ago**, so `span_a`/`span_b` are read via `.shift(26)`, and Chikou confirmation compares the current close to `close[-27]` rather than plotting a forward line:

```python
span_a = _safe_last(ichimoku_df["ISA_9"].shift(26))   # current cloud, not future
chikou_bullish = float(df["close"].iloc[-1]) > float(df["close"].iloc[-27])
```

#### 4.1.2 Momentum category (weight 0.30)

Seven oscillators: **RSI(14)**, **MACD(12,26,9)**, **Stochastic(14,3,3)**, **Williams %R(14)**, **CCI(20)**, **ROC(12)**, **Ultimate Oscillator(7,14,28)**. The grammar is consistent: oversold zones add bullish points (mean‑reversion expectation), and signal‑line crossovers in extreme zones are weighted heavier. Example — Stochastic rewards a bullish %K/%D cross, then *doubles* the reward if it happened in oversold territory:

```python
if bullish_cross:
    score += 15.0
    if oversold:  score += 10.0   # cross inside oversold is stronger
```

RSI and MACD additionally fold in the divergence engine. ROC is linearly normalised over ±5 %: `score += clip(roc, -5, 5)/5 · 25`.

#### 4.1.3 Volatility category (weight 0.15)

**ATR(14)**, **Bollinger(20, 2σ)**, **Keltner(20, ATR·1.5)**, **Donchian(20)**, **Historical Volatility(20)**. Volatility is largely directionless, so these contribute small deltas — except for **breakouts**, which are directional. Bollinger detects a *squeeze* by percent‑rank of bandwidth over the last 120 bars and, when squeezing, pulls the score back toward neutral (a squeeze signals an imminent move of *unknown* direction):

```python
bw_pct_rank = (bandwidth - bw_min) / (bw_max - bw_min)
squeeze = bw_pct_rank < 0.20
if squeeze:  score = score * 0.8 + 50.0 * 0.2    # de‑confidence
```

Historical volatility is annualised with timeframe awareness: `hv = std(log_returns,20) · √(252 · bars_per_day)` where `bars_per_day = {M15:96, H1:24, H4:6, D1:1}`.

#### 4.1.4 Volume category (weight 0.20)

**OBV**, **VWAP**, **MFI(14)**, **CMF(20)**, **A/D Line**. OBV and A/D use `np.polyfit` to estimate the 10‑bar slope and detect price‑vs‑flow divergence over a 20‑bar window. A critical forex‑specific guard lives in VWAP: spot‑forex feeds frequently report `volume=0`, making VWAP meaningless, so the indicator returns a clean neutral instead of injecting noise:

```python
if vol is None or float(np.nan_to_num(vol).sum()) <= 0.0:
    return IndicatorResult("VWAP", Signal.NEUTRAL, 50.0, {"note": "no volume — VWAP skipped"})
```

When volume *is* present, VWAP is anchored daily (`anchor="D"`) on a sorted UTC `DatetimeIndex` to avoid pandas‑ta repaint warnings.

---

### 4.2 `candlestick_patterns.py` — 27 patterns with volume confirmation

`CandlestickAnalyzer` slides a window across every bar, scanning **single‑, double‑ and triple‑candle** formations. Each detector returns a `PatternResult(name, direction, strength, confidence, volume_confirmed, …)`. Geometry is computed from four primitives:

```python
body  = |close − open|
upper_shadow = high − max(open, close)
lower_shadow = min(open, close) − low
range = high − low
```

**Pattern inventory & predictive weights** (`PATTERN_WEIGHTS`):

| Class | Patterns (weight) |
|---|---|
| Single | doji_standard(3), long‑legged(4), dragonfly(5), gravestone(5), hammer(6), inverted_hammer(5), shooting_star(6), spinning_top(2), marubozu ±(7), hanging_man(6) |
| Double | bullish/bearish engulfing(8), tweezer top/bottom(6), bullish/bearish harami(5), piercing_line(7), dark_cloud_cover(7) |
| Triple | morning/evening star(9), three white soldiers / black crows(9), three inside up/down(8), abandoned baby ±(10) |

Detection rules are explicit thresholds. A **hammer** requires a small top body, a long lower wick and a bullish close:

```python
body_ratio < 0.33  and  lower >= body·2.0  and  upper <= body·0.5  and  close > open
```

A **doji** is `body/range ≤ 0.05`, then sub‑classified: gravestone (`upper > 0.6·range, lower < 0.1·range`, bearish), dragonfly (mirror, bullish), long‑legged (both shadows large, neutral), else standard.

**Volume confirmation** multiplies confidence: `_is_volume_confirmed` tests the bar's volume against a 20‑period average; confirmed patterns are scored with `volume_multiplier = 1.5`, unconfirmed with `0.8`. Each detector also carries a hard‑coded `confidence` that is higher when volume‑confirmed (e.g. hammer 0.72 vs 0.48).

**Aggregate score** (`_calculate_pattern_score`):

```python
weighted_value = weight · volume_multiplier · confidence       # per pattern
net_score      = Σ bullish_weighted − Σ bearish_weighted
max_possible   = total_weight · 1.5 · 1.0
score          = clip(50 + (net_score / max_possible)·50, 0, 100)
```

So with no patterns the analyzer returns a perfectly neutral **50**, never a false bearish drag.

---

### 4.3 `chart_patterns.py` — geometric reversal & continuation patterns

`ChartPatternAnalyzer` works on **swing extrema** rather than individual candles. It builds a multi‑scale set of peaks/valleys by sweeping `scipy.signal.argrelextrema` across several `order` values around `extrema_order=5`, unioning the results so both small and large structures surface:

```python
for order in range(max(2, extrema_order-2), extrema_order+3):
    peaks   = argrelextrema(highs, np.greater, order=order)[0]
    valleys = argrelextrema(lows,  np.less,    order=order)[0]
```

**17 patterns**, each with an intrinsic direction (`_PATTERN_DIRECTION`):

| Category | Patterns | Direction |
|---|---|---|
| Reversal | head_and_shoulders / inverse, double top/bottom, triple top/bottom, rounding top/bottom | bearish / bullish respectively |
| Continuation | ascending / descending / symmetrical triangle, bull/bear flag, pennant, rectangle | per type |
| Wedges | rising_wedge (bearish), falling_wedge (bullish) | reversal |

Every `DetectedPattern` carries `breakout_price`, a **measured‑move `target_price`**, and a geometric `confidence`. For a **double top** the neckline is the intervening trough, the projected target is `trough − (peak − trough)`, and confidence blends shoulder symmetry with proximity to breakout:

```python
target_price = trough_price - pattern_height          # measured move
symmetry  = 1.0 - |p1 − p2| / max(p1, 1e‑10)
proximity = max(0, 1 - dist·15)
confidence = min(100, symmetry·40 + proximity·30 + 30)
```

**Head‑and‑shoulders confidence** (`_hs_confidence`) is a 100‑point rubric: shoulder symmetry (25), neckline flatness (20), head‑to‑shoulder ratio ideally in `[0.02, 0.10]` (20), breakout proximity (20), plus a 15‑point structural base. Trendline‑based patterns (triangles, wedges, channels) fit lines with `np.polyfit` and validate **R²** of the fit; triangles classify on slope signs with a `flat_threshold = 0.05` to call a line "horizontal".

Final aggregation:

```python
score = avg_confidence·0.5 + direction_agreement·100·0.3 + min(1, n/5)·100·0.2   # _compute_pattern_score
```

Overlapping same‑type detections are removed by `_deduplicate_patterns` (keep highest confidence when temporal overlap > 50 %). `dominant_direction` requires a 60 % confidence‑weighted majority, else `neutral`.

---

### 4.4 `smart_money.py` — Smart‑Money / ICT concepts

`SmartMoneyAnalyzer` is the institutional‑footprint engine. It detects six SMC primitives and fuses them into `smc_score` (0–100) and `smc_bias`. All structure uses a vectorised Wilder **ATR(14)** computed in‑module (`_compute_atr`) for impulse thresholds, and **swing points** detected with a symmetric `lookback=3` fractal:

```python
is_swing_high = all(highs[i] > highs[i±j]  for j in 1..lookback)
```

#### 4.4.1 Order Blocks (`_detect_order_blocks`)

A **bullish order block** is *the last down‑candle before an impulsive up‑move*; bearish is the mirror. "Impulsive" means the body exceeds `ATR · impulsive_multiplier (2.0)`:

```python
if close[i] > open[i] and body_current > atr[i]·2.0:      # bullish impulse
    if close[i-1] < open[i-1]:  ob = last bearish candle (i-1)
    else: scan back up to 5 bars for the last bearish candle
```

Each OB stores a zone `[low, high]`. **Strength** rewards a large impulse and a *tight* OB body:

```python
impulse_ratio = min(impulsive_body/atr, 5)/5
ob_ratio      = 1 - min(ob_body/atr, 3)/3
strength      = clip(impulse_ratio·0.6 + ob_ratio·0.4, 0, 1)
```

**Mitigation** uses *close*, not wick — `_check_ob_mitigation` marks a bullish OB mitigated only when a later candle **closes** below `zone_low`, preventing premature invalidation by a stop‑hunt wick at the optimal entry.

#### 4.4.2 Fair Value Gaps (`_detect_fvg`)

A 3‑candle imbalance. Bullish FVG = `high[i‑2] < low[i]` (a gap the price skipped); bearish = `low[i‑2] > high[i]`. `_check_fvg_fill` later computes `fill_percentage` as the deepest penetration / gap range, flagging `filled` at 100 %.

#### 4.4.3 Market structure — BOS & CHoCH (`_detect_structure`)

Walking the merged swing sequence, the analyzer tracks higher‑highs / lower‑lows. A **Break of Structure (BOS)** continues the prevailing trend; a **Change of Character (CHoCH)** is the *first* break against it. Crucially, breaks demand a **confirmed close** beyond the prior swing, not merely a wick — defeating liquidity‑grab fake‑outs:

```python
confirmed_high_break = any(closes[k] > prev_sh.price
                           for k in range(prev_sh.index+1, curr_sh.index+1))
if curr_sh.price > prev_sh.price and confirmed_high_break:
    type = CHoCH if prev_trend == BEARISH else BOS
```

#### 4.4.4 Supply / Demand zones & Liquidity sweeps

Demand/supply zones are small basing candles (`|body| ≤ 0.5·ATR`) followed by an impulsive departure (`> 0.8·impulsive_mult·ATR`). Overlapping zones merge (`_merge_overlapping_zones`); `_update_zone_tests` counts touches and retires a zone as non‑`fresh` after `max_zone_tests=3` or a clean break.

A **liquidity sweep** is the canonical stop‑hunt: a wick pierces a swing level but the candle **reclaims** (closes back on the original side), beyond a `0.0002` penetration threshold:

```python
if lows[i] < swing_low and closes[i] > swing_low:   # bullish sweep below
```

#### 4.4.5 Premium / Discount (`_compute_premium_discount`)

Over the last (≤5) swings it builds a dealing range and classifies the current price: ≥75 % = **premium** (expensive → favour shorts), ≤25 % = **discount** (cheap → favour longs), else equilibrium.

#### 4.4.6 SMC scoring (`_compute_smc_score`)

Each primitive contributes to a *bullish* and a *bearish* tally with these caps: order blocks 25, FVGs 15, structure 25 (CHoCH ×1.0, BOS ×0.7), S/D zones 15, sweeps 10, premium/discount 10. The final score rewards both **alignment** (how strong the dominant side is) and **confidence** (how lopsided the contest is):

```python
alignment  = max(bull, bear) / max_possible
confidence = |bull − bear| / total
smc_score  = clip(round(alignment·60 + confidence·40), 0, 100)
smc_bias   = bullish/bearish/neutral  (threshold = 5 % of max_possible)
```

---

### 4.5 `volume_profile.py` & `volume_analysis.py` — order‑flow & POC

Two complementary modules.

**`volume_analysis.py`** (`VolumeAnalyzer`) re‑expresses OBV, VWAP, MFI(14), CMF(20), A/D and a raw volume‑trend ratio into 0–100 scores, averaging five of them into `volume_score` and exposing `volume_confirms_trend = score > 55`. It also produces a coarse 20‑bin volume profile (POC/VAH/VAL by closing price).

**`volume_profile.py`** is the rigorous profile, distributing each candle's volume across all price **bins its `[low, high]` spans** (true range‑weighted profile, not close‑only):

```python
lo_idx = searchsorted(edges, r_low, "right") - 1
hi_idx = searchsorted(edges, r_high, "left")
bin_volume[lo_idx:hi_idx] += r_vol / (hi_idx - lo_idx)
```

- **POC** = `centers[argmax(bin_volume)]` — the highest‑traded price (a liquidity magnet).
- **Value Area** = expand outward from POC, always taking the heavier neighbour, until 70 % of volume is enclosed → `value_area_high/low`.
- `is_balanced()` checks the weaker side holds ≥ 40 % of volume.

`assess_liquidity()` defends against thin markets. It is deliberately **robust to single‑bar noise and spikes**: the recent baseline is the *median* of the last 3 bars and the comparison baseline is the median of bars −20..−3 (median resists a recent volume spike inflating the average). `volume_ratio < 0.3` flags low liquidity (reject), `> 1.8` flags a possible news spike. The audit comments record a concrete bug this fixed: a strong gold setup at 65.14 with `ratio=0.336` was wrongly rejected under the old mean/0.5 logic.

---

### 4.6 `support_resistance.py` — levels, pivots & Fibonacci

`SupportResistanceAnalyzer` finds horizontal levels from local extrema over a `window=10` neighbourhood, then merges, ranks and scores them:

- **Level strength** = `min(touches · 20, 100)` where a touch is any bar within tolerance. **Tolerance is instrument‑aware**: `5 · pip_size` when the pip size is known, else `0.1 %` of price.
- **Merging** combines levels within `0.5 · mean(high−low)`, averaging price and taking the stronger side's type.
- **Pivot points** are computed from the **previous completed candle** (`iloc[-2]`, avoiding the forming bar) in four flavours — Standard, Fibonacci, Camarilla, Woodie — e.g. `PP = (H+L+C)/3`, `R1 = 2·PP − L`.
- **Fibonacci retracement/extension** over the last 100 bars, auto‑orienting by whether the swing low precedes the swing high (`is_uptrend = low_idx < high_idx`), yielding the 23.6/38.2/50/61.8/78.6 % grid and 127.2/161.8/200/261.8 % extensions.
- `_score_levels` nudges the score when price sits just above a strong support (bullish) or just under resistance (bearish), plus a ±5 pivot tilt.

---

### 4.7 `multi_timeframe.py` — top‑down confluence

`MultiTimeframeAnalyzer` is the confluence arbiter. It accepts either pre‑computed per‑TF analyses or raw candles (which it runs through `TechnicalAnalyzer`). Each timeframe's `technical_score` is bucketed with a **sensitised 55/45 threshold** (because ~79 % of scores fall in the 41–59 band; the old 60/40 left timeframes chronically neutral):

```python
if score >= 55: bullish (+higher_bias if D1/H4)
elif score <= 45: bearish
else: neutral
```

Per‑TF weights `TF_WEIGHTS = {MN1:.20, W1:.20, D1:.25, H4:.20, H1:.10, M15:.05}` produce a `weighted_score`. The headline metric is **net confluence** = `bullish_tfs − bearish_tfs` (signed, so contradictions cancel rather than being hidden by `max()`):

```python
net_confluence = bullish_count - bearish_count
direction = bullish/bearish        if |net| >= 2
            slightly_bullish/bearish if |net| == 1
            neutral                  otherwise
```

`higher_tf_bias` is derived only from the long‑horizon set `["D1","H4"]` (MN1/W1 are not fetched in the live config). A **conflict** is flagged when both sides are non‑zero and `|net| ≤ 1`; `aligned` requires `|net| ≥ 2` and no conflict. A guard forces a neutral result with **< 2 timeframes present**, because cross‑TF confluence is meaningless on a single frame. Static helpers add operational logic: `get_entry_timeframe` (lowest aligned TF for entry), `check_major_trend` (W1+D1+H4 vote), and `is_signal_against_higher_bias`.

---

### 4.8 How outputs feed the scorer & engine

The fan‑in happens in `Scorer.score_from_analyzers` (`scorer.py`). The seven dicts collapse as follows:

1. **Pattern fusion** — candlestick, chart and SMC scores merge into one pattern score:
   ```python
   pattern_score = candle_score·0.50 + chart_score·0.30 + smc_score·0.20
   ```
2. **Base blend** — three pillars with weights `TECHNICAL_WEIGHT=0.43`, `PATTERN_WEIGHT=0.35`, `ML_WEIGHT=0.22` (ML deviation from 50 is shrunk by `ML_TRUST=0.55` so a noisy model can't dominate).
3. **Confluence bonuses/penalties** built into `ScoringContext`:
   - `multi_tf_confluence ≥ 3` → **+5** (`MULTI_TF_CONFLUENCE_BONUS`).
   - `volume_confirms_trend` → **+3**.
   - `higher_tf_bias` alignment → **+8** (strong bias) / **+4** (slight); a counter‑bias reversion is penalised **−6**.
   - News penalty applied once as the real `news_penalty` value.

The **engine** consumes the richer fields beyond scores: `smc_bias` and `mtf_direction`/`higher_tf_bias` gate the trade direction and feed the rejection/explanation logic (`engine.py` ~787–810, 1134–1185), `mtf_result.conflict` can veto borderline setups, and SMC zones/levels supply context for the human‑readable rationale and chart annotations. Notably the **ML feature engine** (`src/ml/feature_engine.py`) does *not* re‑ingest these analyzer dicts; it recomputes its own raw indicator columns, so the analysis engine and the ML model form two independent evidence streams that the scorer reconciles.

> **Design throughline:** every analyzer is *neutral‑safe* (returns 50 / `neutral` on insufficient or degenerate data), *repaint‑aware* (Ichimoku shift, close‑confirmed structure breaks, previous‑candle pivots), and *forex‑aware* (volume‑zero VWAP guard, pip‑sized tolerances, median‑robust liquidity). The numbers in this chapter are the literal constants in the code as of this revision.

---
---

## ۴. موتورِ تحلیلِ بازار

> **تحلیلِ تکنیکال · الگوهای کندلی و نموداری · مفاهیمِ اسمارت‌مانی · پروفایلِ حجم · هم‌گراییِ چندتایم‌فریمی**
>
> مرجعِ حقیقت: تمامِ ماژول‌های زیرِ [`src/analysis/`](../src/analysis/). این فصل محاسباتِ *دقیق*، الگوریتم‌های امتیازدهی و مفاهیمِ معاملاتیِ پیاده‌سازی‌شده در کد را مستند می‌کند — نه نسخه‌های آرمانیِ کتابی — و سپس ردیابی می‌کند که خروجیِ هر آنالایزر چگونه توسطِ **اسکورر** (`src/signals/scorer.py`) و **موتور** (`src/signals/engine.py`) مصرف می‌شود.

موتورِ تحلیلِ بازار یک زیرسیستمِ **پخش‌شونده / گردآورنده (fan‑out / fan‑in)** است. برای یک `DataFrame` از OHLCV (با ستون‌های `timestamp, open, high, low, close, volume`) هفت آنالایزرِ مستقل اجرا می‌شوند که هر یک یک `dict` خوداتکا تولید می‌کند. هر آنالایزر وضعیتِ بازار را روی **امتیازِ ۰ تا ۱۰۰ نگاشت می‌کند که در آن ۵۰ دقیقاً خنثی، بالاتر از ۵۰ صعودی و پایین‌تر نزولی است.** این ناوردا (invariant) همان قراردادی است که به اسکورر اجازه می‌دهد شواهدِ ناهمگن (اسیلاتورها، کندل‌ها، ردِ پایِ نهادی، یادگیریِ ماشین) را بدونِ ناسازگاریِ واحد، خطی ترکیب کند.

### ۴.۰ معماری و قراردادِ داده

| ماژول | کلاس / نقطهٔ ورود | کلیدهای خروجی | حوزهٔ مفهومی |
|---|---|---|---|
| `technical.py` | `TechnicalAnalyzer.analyze(df, timeframe)` | `technical_score`، `category_scores`، چهار دسته | ۲۱ اندیکاتورِ کلاسیک |
| `candlestick_patterns.py` | `CandlestickAnalyzer.analyze(df)` | `pattern_score`، `patterns_found`، شمارش جهت | ۲۷ الگوی کندلی |
| `chart_patterns.py` | `ChartPatternAnalyzer.analyze(df)` | `pattern_score`، `patterns_found`، `dominant_direction` | ۱۷ الگوی نموداری |
| `smart_money.py` | `SmartMoneyAnalyzer.analyze(df)` | `smc_score`، `smc_bias`، اوردربلاک، FVG، ساختار، نواحی، سویپ، پریمیوم/دیسکانت | SMC / ICT |
| `volume_analysis.py` + `volume_profile.py` | `VolumeAnalyzer.analyze`، `calculate_volume_profile`، `assess_liquidity` | `volume_score`، `volume_confirms_trend`، `poc/vah/val`، نقدینگی | حجم / جریانِ سفارش |
| `support_resistance.py` | `SupportResistanceAnalyzer.analyze(df, pip_size)` | `sr_levels`، `pivots`، فیبوناچی، نزدیک‌ترین حمایت/مقاومت | سطوح و فیبوناچی |
| `multi_timeframe.py` | `MultiTimeframeAnalyzer.analyze(candles_by_tf)` | `confluence_count`، `net_confluence`، `direction`، `higher_tf_bias`، `conflict`، `aligned` | هم‌گراییِ بالا‑به‑پایین |

موتور همهٔ این‌ها را یک‌بار می‌سازد (`engine.py` خطوطِ ۷۸–۸۴) و هر یک را در هر چرخه و برای هر نماد فرامی‌خواند. سپس اسکورر این dictها را به یک امتیازِ معاملاتیِ واحد فرومی‌کاهد (§۴.۸).

---

### ۴.۱ `technical.py` — مجموعهٔ وزن‌دارِ ۲۱‑اندیکاتوری

`TechnicalAnalyzer` بزرگ‌ترین آنالایزر است (حدودِ ۱۸۲۰ خط). **۲۱ اندیکاتور** را در چهار دسته محاسبه می‌کند و هر اندیکاتور یک `IndicatorResult(name, signal, score, details)` برمی‌گرداند. میانگینِ هر دسته با وزن‌های ثابت ترکیب می‌شود:

```python
_CATEGORY_WEIGHTS = {"trend": 0.35, "momentum": 0.30, "volatility": 0.15, "volume": 0.20}
technical_score = Σ_cat  میانگین(امتیازهای دسته) · وزنِ دسته
```

`Signal` یک enum پنج‌سطحی است که به لنگرهای `{STRONG_BULLISH:100, BULLISH:75, NEUTRAL:50, BEARISH:25, STRONG_BEARISH:0}` نگاشت می‌شود و `_score_to_signal` آن را روی آستانه‌های ۸۰/۶۰/۴۰/۲۰ بازمی‌گرداند. هر اندیکاتور از پایهٔ خنثیِ `score = 50.0` آغاز شده و با وزن‌های گسسته ± تنظیم و سپس `np.clip(score, 0, 100)` می‌شود.

دو کمک‌تابعِ سراسری ارزشِ تأکید دارند:

**موتورِ واگرایی** — `_detect_divergence(price, indicator, lookback=30)` پنجره را نصف می‌کند و حدِ قیمتیِ هر نیمه را با مقدارِ اندیکاتور *در همان کندل* می‌سنجد:

```python
regular_bullish = (کفِ دوم < کفِ اول) و (اندیکاتورِ کفِ دوم > اندیکاتورِ کفِ اول)
regular_bearish = (سقفِ دوم > سقفِ اول) و (اندیکاتورِ سقفِ دوم < اندیکاتورِ سقفِ اول)
hidden_bullish  = (کفِ دوم > کفِ اول) و (اندیکاتورِ کفِ دوم < اندیکاتورِ کفِ اول)
hidden_bearish  = (سقفِ دوم < سقفِ اول) و (اندیکاتورِ سقفِ دوم > اندیکاتورِ سقفِ اول)
```

این تابع هم در RSI و هم در MACD استفاده می‌شود. واگراییِ معمولی نشانهٔ بازگشت (۱۲±) و واگراییِ مخفی نشانهٔ ادامه (۸±) است.

#### ۴.۱.۱ دستهٔ روند (وزنِ ۰.۳۵)

| اندیکاتور | پارامتر | منطقِ صعودی (تغییرِ امتیاز) |
|---|---|---|
| **EMA Cross** | ۲۰/۵۰/۲۰۰ | تقاطعِ طلایی ‎+۲۵‎، چینشِ `ef>em>es` ‎+۱۵‎، `price>EMA200` ‎+۱۰‎ |
| **SuperTrend** | طول ۱۰، ضریب ۳ | جهت ‎+۲۰‎، چرخش به صعودی ‎+۱۵‎ |
| **Ichimoku** | ۹/۲۶/۵۲ | تقاطعِ TK ‎+۱۲‎، بالای کومو ‎+۱۲‎، کوموی صعودی ‎+۶‎، چیکو ‎+۸‎، ترکیب ‎+۶‎ |
| **ADX** | ۱۴ | اگر ADX≥۲۵ و +DI>−DI ‎+۱۵‎ (‎+۱۰‎ اگر ADX≥۴۰) |
| **Parabolic SAR** | پیش‌فرض | SAR زیرِ قیمت ‎+۲۰‎، چرخش ‎+۱۰‎ |
| **VWMA** | ۲۰ | `min(|فاصله٪|·5, 25)` |

پیاده‌سازیِ **ایچیموکو** نسبت به repaint صحیح است: ابری که قیمت در آن قرار دارد، سنکو اسپَنِ محاسبه‌شدهٔ **۲۶ دوره قبل** است، پس `span_a/span_b` با `.shift(26)` خوانده می‌شوند و تأییدِ چیکو، کلوزِ جاری را با `close[-27]` می‌سنجد، نه یک خطِ رو به آینده:

```python
span_a = _safe_last(ichimoku_df["ISA_9"].shift(26))   # ابرِ جاری، نه آینده
chikou_bullish = close[-1] > close[-27]
```

#### ۴.۱.۲ دستهٔ مومنتوم (وزنِ ۰.۳۰)

هفت اسیلاتور: **RSI(14)**، **MACD(12,26,9)**، **استوکستیک(14,3,3)**، **ویلیامز %R(14)**، **CCI(20)**، **ROC(12)**، **اسیلاتورِ نهایی(7,14,28)**. دستورِ زبان یکسان است: نواحیِ اشباعِ فروش امتیازِ صعودی می‌افزایند (انتظارِ بازگشت‌به‌میانگین) و تقاطعِ خطِ سیگنال در نواحیِ حاد سنگین‌تر وزن می‌گیرد. نمونه — استوکستیک تقاطعِ صعودی را پاداش می‌دهد و اگر در اشباعِ فروش رخ داده باشد آن را *دوبرابر* می‌کند:

```python
if bullish_cross:
    score += 15.0
    if oversold:  score += 10.0   # تقاطع در اشباعِ فروش قوی‌تر
```

RSI و MACD افزون بر این، موتورِ واگرایی را نیز لحاظ می‌کنند. ROC به‌صورتِ خطی روی ±۵٪ نرمال می‌شود: `score += clip(roc,-5,5)/5·25`.

#### ۴.۱.۳ دستهٔ نوسان (وزنِ ۰.۱۵)

**ATR(14)**، **بولینگر(20, 2σ)**، **کلتنر(20, ATR·1.5)**، **دونچیان(20)**، **نوسانِ تاریخی(20)**. نوسان عمدتاً بی‌جهت است، پس این‌ها سهمِ کوچکی دارند — جز **شکست‌ها** که جهت‌دارند. بولینگر *فشردگی* را با رتبهٔ صدکیِ پهنای باند طیِ ۱۲۰ کندلِ اخیر تشخیص می‌دهد و هنگامِ فشردگی امتیاز را به‌سمتِ خنثی می‌کشد (فشردگی نشانهٔ حرکتِ قریب‌الوقوعِ *بی‌جهت* است):

```python
bw_pct_rank = (bandwidth - bw_min) / (bw_max - bw_min)
squeeze = bw_pct_rank < 0.20
if squeeze:  score = score*0.8 + 50.0*0.2    # کاهشِ اطمینان
```

نوسانِ تاریخی با آگاهی از تایم‌فریم سالانه می‌شود: `hv = std(log_returns,20)·√(252·bars_per_day)` که `bars_per_day = {M15:96, H1:24, H4:6, D1:1}`.

#### ۴.۱.۴ دستهٔ حجم (وزنِ ۰.۲۰)

**OBV**، **VWAP**، **MFI(14)**، **CMF(20)**، **خطِ A/D**. OBV و A/D شیبِ ۱۰‑کندلی را با `np.polyfit` برآورد کرده و واگراییِ قیمت‑جریان را روی پنجرهٔ ۲۰‑کندلی می‌سنجند. یک گاردِ مهمِ مخصوصِ فارکس در VWAP زندگی می‌کند: فیدهای اسپاتِ فارکس اغلب `volume=0` گزارش می‌کنند که VWAP را بی‌معنا می‌سازد، پس اندیکاتور به‌جای تزریقِ نویز، خنثیِ تمیز برمی‌گرداند:

```python
if vol is None or float(np.nan_to_num(vol).sum()) <= 0.0:
    return IndicatorResult("VWAP", Signal.NEUTRAL, 50.0, {"note": "بدون حجم — VWAP اعمال نشد"})
```

وقتی حجم *موجود* باشد، VWAP روی یک `DatetimeIndex`ِ مرتبِ UTC با لنگرِ روزانه (`anchor="D"`) محاسبه می‌شود تا از هشدارهای repaintِ pandas‑ta پرهیز شود.

---

### ۴.۲ `candlestick_patterns.py` — ۲۷ الگو با تأییدِ حجم

`CandlestickAnalyzer` پنجره‌ای را روی هر کندل می‌لغزاند و فرم‌های **تک‌، دو‑ و سه‑کندلی** را اسکن می‌کند. هر آشکارساز یک `PatternResult(name, direction, strength, confidence, volume_confirmed, …)` برمی‌گرداند. هندسه از چهار اولیه محاسبه می‌شود:

```python
body  = |close − open|
upper_shadow = high − max(open, close)
lower_shadow = min(open, close) − low
range = high − low
```

**فهرستِ الگوها و وزنِ پیش‌بینی** (`PATTERN_WEIGHTS`):

| دسته | الگوها (وزن) |
|---|---|
| تک‌کندلی | دوجی استاندارد(۳)، پابلند(۴)، سنجاقک(۵)، سنگ‌قبر(۵)، چکش(۶)، چکشِ معکوس(۵)، ستارهٔ دنباله‌دار(۶)، فرفره(۲)، ماروبوزو ±(۷)، مردِ دارآویز(۶) |
| دوکندلی | پوشای صعودی/نزولی(۸)، انبرکِ سقف/کف(۶)، هارامیِ صعودی/نزولی(۵)، نفوذی(۷)، ابرِ سیاه(۷) |
| سه‌کندلی | ستارهٔ صبح/شام(۹)، سه سربازِ سفید / سه کلاغِ سیاه(۹)، سه‌داخلیِ بالا/پایین(۸)، کودکِ رهاشده ±(۱۰) |

قواعدِ تشخیص آستانه‌های صریح‌اند. یک **چکش** بدنهٔ کوچکِ بالا، سایهٔ پایینِ بلند و کلوزِ صعودی می‌خواهد:

```python
body_ratio < 0.33  و  lower >= body·2.0  و  upper <= body·0.5  و  close > open
```

یک **دوجی** یعنی `body/range ≤ 0.05` و سپس زیرگونه‌بندی: سنگ‌قبر (`upper > 0.6·range, lower < 0.1·range`، نزولی)، سنجاقک (آینه، صعودی)، پابلند (هر دو سایه بزرگ، خنثی)، وگرنه استاندارد.

**تأییدِ حجم** اطمینان را ضرب می‌کند: `_is_volume_confirmed` حجمِ کندل را با میانگینِ ۲۰‑دوره‌ای می‌سنجد؛ الگوهای تأییدشده با `volume_multiplier = 1.5` و تأییدنشده با `0.8` امتیاز می‌گیرند. هر آشکارساز یک `confidence`ِ سفت‌کدشده دارد که در حالتِ تأییدِ حجم بالاتر است (مثلاً چکش ۰.۷۲ در برابر ۰.۴۸).

**امتیازِ تجمیعی** (`_calculate_pattern_score`):

```python
weighted_value = weight · volume_multiplier · confidence       # هر الگو
net_score      = Σ صعودی − Σ نزولی
max_possible   = total_weight · 1.5 · 1.0
score          = clip(50 + (net_score / max_possible)·50, 0, 100)
```

بنابراین بدونِ هیچ الگو، آنالایزر دقیقاً **۵۰**ِ خنثی برمی‌گرداند و هرگز یک کششِ نزولیِ کاذب وارد نمی‌کند.

---

### ۴.۳ `chart_patterns.py` — الگوهای هندسیِ بازگشتی و ادامه‌دهنده

`ChartPatternAnalyzer` به‌جای کندلِ منفرد، روی **اکستِرِمم‌های سوئینگ** کار می‌کند. مجموعه‌ای چندمقیاسی از قله/دره را با جاروبِ `scipy.signal.argrelextrema` روی چند `order` پیرامونِ `extrema_order=5` می‌سازد و نتایج را اجتماع می‌گیرد تا هم ساختارهای کوچک و هم بزرگ نمایان شوند:

```python
for order in range(max(2, extrema_order-2), extrema_order+3):
    peaks   = argrelextrema(highs, np.greater, order=order)[0]
    valleys = argrelextrema(lows,  np.less,    order=order)[0]
```

**۱۷ الگو**، هر یک با جهتِ ذاتی (`_PATTERN_DIRECTION`):

| دسته | الگوها | جهت |
|---|---|---|
| بازگشتی | سروشانه / معکوس، سقف/کفِ دوقلو، سقف/کفِ سه‌قلو، گردِ سقف/کف | نزولی / صعودی |
| ادامه‌دهنده | مثلثِ صعودی/نزولی/متقارن، پرچمِ صعودی/نزولی، پنانت، مستطیل | بسته به نوع |
| کنج‌ها | کنجِ صعودی (نزولی)، کنجِ نزولی (صعودی) | بازگشتی |

هر `DetectedPattern` شاملِ `breakout_price`، یک **هدفِ حرکتِ اندازه‌گیری‌شده `target_price`** و یک `confidence`ِ هندسی است. برای **سقفِ دوقلو** خطِ گردن همان درهٔ میانی است، هدفِ تصویرشده `trough − (peak − trough)` و اطمینان از تقارنِ شانه‌ها و نزدیکی به شکست ترکیب می‌شود:

```python
target_price = trough_price - pattern_height
symmetry  = 1.0 - |p1 − p2| / max(p1, 1e‑10)
proximity = max(0, 1 - dist·15)
confidence = min(100, symmetry·40 + proximity·30 + 30)
```

**اطمینانِ سروشانه** (`_hs_confidence`) یک روبریکِ ۱۰۰‑امتیازی است: تقارنِ شانه (۲۵)، افقی‌بودنِ خطِ گردن (۲۰)، نسبتِ سر‑به‑شانه که آرمانش در `[0.02, 0.10]` است (۲۰)، نزدیکی به شکست (۲۰) و پایهٔ ساختاریِ ۱۵. الگوهای خط‌روندی (مثلث‌ها، کنج‌ها، کانال‌ها) خط را با `np.polyfit` برازش کرده و **R²** را اعتبارسنجی می‌کنند؛ مثلث‌ها بر اساسِ علامتِ شیب و با `flat_threshold = 0.05` (برای «افقی» نامیدن یک خط) طبقه‌بندی می‌شوند.

تجمیعِ نهایی:

```python
score = میانگینِ اطمینان·0.5 + توافقِ جهت·100·0.3 + min(1, n/5)·100·0.2
```

تشخیص‌های هم‌نوعِ هم‌پوشان با `_deduplicate_patterns` (نگه‌داشتنِ بالاترین اطمینان وقتی هم‌پوشانیِ زمانی > ۵۰٪) حذف می‌شوند. `dominant_direction` به اکثریتِ ۶۰٪ِ وزن‌دارِ اطمینان نیاز دارد، وگرنه `neutral`.

---

### ۴.۴ `smart_money.py` — مفاهیمِ اسمارت‌مانی / ICT

`SmartMoneyAnalyzer` موتورِ ردِ پایِ نهادی است. شش اولیهٔ SMC را تشخیص داده و در `smc_score` (۰–۱۰۰) و `smc_bias` ادغام می‌کند. کلِ ساختار از یک **ATR(14)**ِ وایلدرِ درون‌ماژولی (`_compute_atr`) برای آستانهٔ ایمپالس استفاده می‌کند و **نقاطِ سوئینگ** با فرکتالِ متقارنِ `lookback=3` یافت می‌شوند:

```python
is_swing_high = all(highs[i] > highs[i±j]  for j in 1..lookback)
```

#### ۴.۴.۱ اوردربلاک (`_detect_order_blocks`)

یک **اوردربلاکِ صعودی** *آخرین کندلِ نزولی پیش از یک حرکتِ ایمپالسیِ صعودی* است؛ نزولی آینهٔ آن. «ایمپالسی» یعنی بدنه از `ATR·ضریبِ ایمپالس (2.0)` فراتر رود:

```python
if close[i] > open[i] and body_current > atr[i]·2.0:      # ایمپالسِ صعودی
    if close[i-1] < open[i-1]:  ob = آخرین کندلِ نزولی (i-1)
    else: تا ۵ کندل عقب برای آخرین کندلِ نزولی جست‌وجو کن
```

هر OB یک ناحیهٔ `[low, high]` ذخیره می‌کند. **قدرت** به ایمپالسِ بزرگ و بدنهٔ *جمع‌وجورِ* OB پاداش می‌دهد:

```python
impulse_ratio = min(impulsive_body/atr, 5)/5
ob_ratio      = 1 - min(ob_body/atr, 3)/3
strength      = clip(impulse_ratio·0.6 + ob_ratio·0.4, 0, 1)
```

**میتیگیشن** از *کلوز* استفاده می‌کند نه فتیله — `_check_ob_mitigation` یک OBِ صعودی را فقط زمانی میتیگیت می‌داند که کندلی بعداً زیرِ `zone_low` **بسته** شود؛ این از باطل‌شدنِ زودهنگام در اثرِ استاپ‌هانتِ فتیله‌ای در بهترین نقطهٔ ورود جلوگیری می‌کند.

#### ۴.۴.۲ شکافِ ارزشِ منصفانه (`_detect_fvg`)

عدمِ تعادلِ ۳‑کندلی. FVGِ صعودی = `high[i‑2] < low[i]` (شکافی که قیمت جا انداخت)؛ نزولی = `low[i‑2] > high[i]`. سپس `_check_fvg_fill` درصدِ پرشدن را به‌صورتِ عمیق‌ترین نفوذ / دامنهٔ شکاف محاسبه و در ۱۰۰٪ پرچمِ `filled` می‌زند.

#### ۴.۴.۳ ساختارِ بازار — BOS و CHoCH (`_detect_structure`)

با پیمایشِ توالیِ ادغام‌شدهٔ سوئینگ‌ها، سقف‌های بالاتر / کف‌های پایین‌تر ردیابی می‌شوند. **شکستِ ساختار (BOS)** روندِ غالب را ادامه می‌دهد؛ **تغییرِ کاراکتر (CHoCH)** *اولین* شکستِ خلافِ آن است. حیاتی این‌که شکست‌ها به **کلوزِ تأییدشده** فراتر از سوئینگِ قبلی نیاز دارند، نه صرفاً فتیله — که فریب‌های جمع‌آوریِ نقدینگی را خنثی می‌کند:

```python
confirmed_high_break = any(closes[k] > prev_sh.price
                           for k in range(prev_sh.index+1, curr_sh.index+1))
if curr_sh.price > prev_sh.price and confirmed_high_break:
    type = CHoCH if prev_trend == BEARISH else BOS
```

#### ۴.۴.۴ نواحیِ عرضه/تقاضا و سویپِ نقدینگی

نواحیِ عرضه/تقاضا کندل‌های پایه‌سازِ کوچک‌اند (`|body| ≤ 0.5·ATR`) که با خروجِ ایمپالسی دنبال می‌شوند (`> 0.8·ضریبِ‌ایمپالس·ATR`). نواحیِ هم‌پوشان ادغام می‌شوند (`_merge_overlapping_zones`)؛ `_update_zone_tests` تماس‌ها را شمرده و پس از `max_zone_tests=3` یا یک شکستِ تمیز، ناحیه را غیرِ`fresh` می‌کند.

یک **سویپِ نقدینگی** همان استاپ‌هانتِ کلاسیک است: فتیله سطحِ سوئینگ را می‌شکافد ولی کندل **بازپس می‌گیرد** (در سمتِ اولیه بسته می‌شود)، فراتر از آستانهٔ نفوذِ `0.0002`:

```python
if lows[i] < swing_low and closes[i] > swing_low:   # سویپِ صعودی زیرِ سطح
```

#### ۴.۴.۵ پریمیوم / دیسکانت (`_compute_premium_discount`)

روی (حداکثر ۵) سوئینگِ اخیر یک رنجِ معاملاتی می‌سازد و قیمتِ فعلی را طبقه‌بندی می‌کند: ≥۷۵٪ = **پریمیوم** (گران → ترجیحِ فروش)، ≤۲۵٪ = **دیسکانت** (ارزان → ترجیحِ خرید)، وگرنه تعادل.

#### ۴.۴.۶ امتیازدهیِ SMC (`_compute_smc_score`)

هر اولیه به یک تالیِ *صعودی* و یک *نزولی* با این سقف‌ها سهم می‌دهد: اوردربلاک ۲۵، FVG ۱۵، ساختار ۲۵ (CHoCH ×۱.۰، BOS ×۰.۷)، نواحی ۱۵، سویپ ۱۰، پریمیوم/دیسکانت ۱۰. امتیازِ نهایی هم به **هم‌راستایی** و هم به **اطمینان** پاداش می‌دهد:

```python
alignment  = max(bull, bear) / max_possible
confidence = |bull − bear| / total
smc_score  = clip(round(alignment·60 + confidence·40), 0, 100)
smc_bias   = صعودی/نزولی/خنثی  (آستانه = ۵٪ِ max_possible)
```

---

### ۴.۵ `volume_profile.py` و `volume_analysis.py` — جریانِ سفارش و POC

دو ماژولِ مکمل.

**`volume_analysis.py`** (`VolumeAnalyzer`) ‏OBV، VWAP، MFI(14)، CMF(20)، A/D و نسبتِ روندِ خامِ حجم را به امتیازهای ۰–۱۰۰ بازنویسی کرده، پنج‌تا را میانگین می‌گیرد تا `volume_score` شود و `volume_confirms_trend = score > 55` را عرضه می‌کند. هم‌چنین یک پروفایلِ حجمِ ۲۰‑بینیِ درشت (POC/VAH/VAL بر اساسِ قیمتِ بسته‌شدن) می‌سازد.

**`volume_profile.py`** پروفایلِ دقیق است که حجمِ هر کندل را روی همهٔ **بین‌هایی که بازهٔ `[low, high]` را پوشش می‌دهد** توزیع می‌کند (پروفایلِ واقعیِ وزن‌دارِ دامنه، نه فقط کلوز):

```python
lo_idx = searchsorted(edges, r_low, "right") - 1
hi_idx = searchsorted(edges, r_high, "left")
bin_volume[lo_idx:hi_idx] += r_vol / (hi_idx - lo_idx)
```

- **POC** = `centers[argmax(bin_volume)]` — پرمعامله‌ترین قیمت (آهنرُبای نقدینگی).
- **ناحیهٔ ارزش** = از POC به بیرون گسترش بده و همیشه همسایهٔ سنگین‌تر را بردار تا ۷۰٪ِ حجم در‌بر گرفته شود → `value_area_high/low`.
- `is_balanced()` بررسی می‌کند سمتِ ضعیف‌تر ≥۴۰٪ِ حجم را نگه دارد.

`assess_liquidity()` در برابرِ بازارهای کم‌عمق دفاع می‌کند و عمداً **مقاوم به نویزِ تک‌کندلی و اسپایک** است: مبنای اخیر *میانهٔ* ۳ کندلِ آخر و مبنای مقایسه میانهٔ کندل‌های −۲۰..−۳ است (میانه در برابرِ اسپایکِ حجمیِ اخیر مقاوم است). `volume_ratio < 0.3` کم‌نقدینگی (ردِ سیگنال) و `> 1.8` اسپایکِ احتمالیِ خبری را پرچم می‌زند. کامنت‌های ممیزی یک باگِ مشخص را ثبت کرده‌اند: یک ستاپِ قویِ طلا با `ratio=0.336` پیش‌تر زیرِ منطقِ قدیمیِ میانگین/۰.۵ به‌اشتباه رد می‌شد.

---

### ۴.۶ `support_resistance.py` — سطوح، پیوت و فیبوناچی

`SupportResistanceAnalyzer` سطوحِ افقی را از اکستِرِمم‌های محلی روی همسایگیِ `window=10` می‌یابد، سپس ادغام، رتبه‌بندی و امتیازدهی می‌کند:

- **قدرتِ سطح** = `min(touches·20, 100)` که یک تماس هر کندلِ درونِ تلورانس است. **تلورانس ابزارآگاه است**: `5·pip_size` وقتی اندازهٔ پیپ معلوم باشد، وگرنه `0.1٪`ِ قیمت.
- **ادغام** سطوحِ درونِ `0.5·میانگین(high−low)` را ترکیب می‌کند، قیمت را میانگین گرفته و نوعِ سمتِ قوی‌تر را برمی‌گزیند.
- **پیوت‌ها** از **کندلِ کامل‌شدهٔ قبلی** (`iloc[-2]`، با پرهیز از کندلِ در حالِ شکل‌گیری) در چهار سبک — استاندارد، فیبوناچی، کاماریلا، وودی — محاسبه می‌شوند، مثلاً `PP = (H+L+C)/3`, `R1 = 2·PP − L`.
- **فیبوناچیِ بازگشتی/اکستنشن** روی ۱۰۰ کندلِ آخر، با جهت‌گیریِ خودکار بر پایهٔ تقدمِ کفِ سوئینگ بر سقف (`is_uptrend = low_idx < high_idx`)، شبکهٔ ۲۳.۶/۳۸.۲/۵۰/۶۱.۸/۷۸.۶٪ و اکستنشن‌های ۱۲۷.۲/۱۶۱.۸/۲۰۰/۲۶۱.۸٪ را می‌دهد.
- `_score_levels` وقتی قیمت درست بالای حمایتِ قوی (صعودی) یا زیرِ مقاومت (نزولی) باشد امتیاز را جابه‌جا می‌کند، به‌علاوهٔ تمایلِ ±۵ پیوت.

---

### ۴.۷ `multi_timeframe.py` — هم‌گراییِ بالا‑به‑پایین

`MultiTimeframeAnalyzer` داورِ هم‌گرایی است. یا تحلیل‌های از پیش‌محاسبه‌شدهٔ هر تایم‌فریم را می‌پذیرد یا کندلِ خام را (که از `TechnicalAnalyzer` می‌گذراند). `technical_score`ِ هر تایم‌فریم با **آستانهٔ حساس‌شدهٔ ۵۵/۴۵** سطل‌بندی می‌شود (چون ~۷۹٪ِ امتیازها در باندِ ۴۱–۵۹ می‌افتند؛ آستانهٔ قدیمیِ ۶۰/۴۰ تایم‌فریم‌ها را مزمناً خنثی می‌گذاشت):

```python
if score >= 55: صعودی (+ بایاسِ بلندمدت اگر D1/H4)
elif score <= 45: نزولی
else: خنثی
```

وزنِ هر تایم‌فریم `TF_WEIGHTS = {MN1:.20, W1:.20, D1:.25, H4:.20, H1:.10, M15:.05}` یک `weighted_score` می‌سازد. سنجهٔ سرتیتر **هم‌گراییِ خالص** = `bullish_tfs − bearish_tfs` است (علامت‌دار، پس تناقض‌ها به‌جای پنهان‌شدن زیرِ `max()` خنثی می‌شوند):

```python
net_confluence = bullish_count - bearish_count
direction = صعودی/نزولی          اگر |net| >= 2
            تاحدی صعودی/نزولی     اگر |net| == 1
            خنثی                  در غیر این صورت
```

`higher_tf_bias` فقط از مجموعهٔ بلندمدتِ `["D1","H4"]` استخراج می‌شود (MN1/W1 در پیکربندیِ زنده fetch نمی‌شوند). یک **تضاد** وقتی پرچم می‌خورد که هر دو سمت ناصفر و `|net| ≤ 1` باشد؛ `aligned` به `|net| ≥ 2` و نبودِ تضاد نیاز دارد. یک گارد با **کمتر از ۲ تایم‌فریمِ حاضر** نتیجه را به خنثی وامی‌دارد، چون هم‌گراییِ میان‌تایم‌فریمی روی یک فریمِ تنها بی‌معناست. کمک‌تابع‌های ایستا منطقِ عملیاتی می‌افزایند: `get_entry_timeframe` (پایین‌ترین تایم‌فریمِ هم‌جهت برای ورود)، `check_major_trend` (رأیِ W1+D1+H4) و `is_signal_against_higher_bias`.

---

### ۴.۸ چگونگیِ تغذیهٔ اسکورر و موتور

گردآوری در `Scorer.score_from_analyzers` (`scorer.py`) رخ می‌دهد. هفت dict چنین فرومی‌ریزند:

۱. **ادغامِ الگو** — امتیازهای کندلی، نموداری و SMC در یک امتیازِ الگو ترکیب می‌شوند:
   ```python
   pattern_score = candle_score·0.50 + chart_score·0.30 + smc_score·0.20
   ```
۲. **ترکیبِ پایه** — سه ستون با وزن‌های `TECHNICAL_WEIGHT=0.43`، `PATTERN_WEIGHT=0.35`، `ML_WEIGHT=0.22` (انحرافِ ML از ۵۰ با `ML_TRUST=0.55` کوچک می‌شود تا مدلِ نویزی غالب نشود).
۳. **بونوس/جریمه‌های هم‌گرایی** در `ScoringContext`:
   - `multi_tf_confluence ≥ 3` → **+۵** (`MULTI_TF_CONFLUENCE_BONUS`).
   - `volume_confirms_trend` → **+۳**.
   - هم‌راستاییِ `higher_tf_bias` → **+۸** (بایاسِ قوی) / **+۴** (خفیف)؛ reversionِ خلافِ بایاس **−۶** جریمه می‌شود.
   - جریمهٔ خبری یک‌بار به‌اندازهٔ مقدارِ واقعیِ `news_penalty` اعمال می‌شود.

**موتور** فیلدهای غنی‌ترِ فراتر از امتیاز را مصرف می‌کند: `smc_bias` و `mtf_direction`/`higher_tf_bias` جهتِ معامله را گِیت کرده و به منطقِ رد/توضیح خوراک می‌دهند (`engine.py` حدودِ ۷۸۷–۸۱۰ و ۱۱۳۴–۱۱۸۵)، `mtf_result.conflict` می‌تواند ستاپ‌های مرزی را وتو کند، و نواحی/سطوحِ SMC زمینهٔ توضیحِ خواناربرای انسان و حاشیه‌نویسیِ چارت را فراهم می‌کنند. نکته این‌که **موتورِ فیچرِ ML** (`src/ml/feature_engine.py`) این dictها را دوباره مصرف *نمی‌کند*؛ ستون‌های اندیکاتورِ خامِ خود را بازمحاسبه می‌کند، پس موتورِ تحلیل و مدلِ ML دو جریانِ شواهدِ مستقل‌اند که اسکورر آن‌ها را آشتی می‌دهد.

> **خطِ طراحیِ سرتاسری:** هر آنالایزر *خنثی‑امن* است (روی دادهٔ ناکافی یا منحط ۵۰ / `neutral` برمی‌گرداند)، *repaint‑آگاه* است (شیفتِ ایچیموکو، شکست‌های ساختاریِ کلوز‑تأیید، پیوتِ کندلِ قبلی) و *فارکس‑آگاه* است (گاردِ VWAPِ حجم‑صفر، تلورانسِ پیپ‑مبنا، نقدینگیِ میانه‑مقاوم). اعدادِ این فصل دقیقاً همان ثوابتِ کد در این بازنگری‌اند.

---

[⬅ 3. The Data Layer — Ingestion, Time‑Series Storage & Caching](data-layer.md) · [🏠 Home · خانه](../README.md) · [5. The Machine‑Learning Subsystem ➡](machine-learning.md)
