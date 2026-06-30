[⬅ 4. Market Analysis Engine](market-analysis.md) · [🏠 Home · خانه](../README.md) · [6. The Signal Engine — Decision Core & Lifecycle ➡](signal-engine.md)

---

## 5. The Machine-Learning Subsystem — Models, Anti-Leakage Validation, Calibration & MLOps

> *"In finance, a model with 60% accuracy can bleed money and a model with 52% accuracy can print it. The right question is never «did we hit the right class?» — it is «do our predictions turn into P&L?»"*
> — paraphrasing the docstring of `src/ml/financial_metrics.py`

The machine-learning subsystem of **CoinePro-FX** lives almost entirely under `src/ml/` (≈3,840 lines across 18 modules), with MLOps glue spilling into `flows/`, `scripts/`, and `docker-compose.yml`. It is **not** a single black-box model. It is a *stacked, anti-leakage, calibration-aware, drift-monitored ensemble* engineered for the brutal realities of financial time series: overlapping labels, serial correlation, regime change, fat tails, near-zero Forex volume, and a 16 GB GPU-less Hetzner box that must never OOM.

This chapter dissects every file. The contract is simple and ruthless:

| Layer | File(s) | Responsibility |
|---|---|---|
| **Base learners** | `xgboost_model.py`, `lgbm_model.py`, `lstm_model.py` | Direction, strength, price forecast |
| **Combiner** | `ensemble.py` | Dynamic weighted fusion → a single `ml_score` ∈ [0,100] |
| **Features** | `feature_engine.py`, `feature_selector.py`, `scaler.py` | 60+ engineered features, pruning, train/serve parity |
| **Labels** | `feature_engine.build_target`, `triple_barrier.py` | Forward-return classes + Lopez de Prado triple barrier |
| **Validation** | `purged_kfold.py` | Purged K-Fold + embargo (anti look-ahead) |
| **Trust** | `calibration.py` | Platt / isotonic probability calibration |
| **Health** | `drift_detector.py` | KS feature-drift + KL prediction-drift |
| **Scoring** | `financial_metrics.py` | Expectancy, PF, Sharpe, Sortino, IC, max-DD, deploy gate |
| **Orchestration** | `trainer.py`, `flows/retrain_flow.py`, `mlflow_tracking.py`, `determinism.py` | Walk-forward training, Prefect schedule, MLflow registry, seeds |
| **Serving** | `ensemble.py::MLService` + `ml-inference` container | Real-time prediction loop |

---

### 5.1 Design philosophy: three weak heads are better than one confident head

The subsystem is built around a *division of cognitive labour*. No single model is asked to do everything; each predicts a different facet of the next move:

- **XGBoost → direction** (`short / neutral / long`, a 3-class problem).
- **LightGBM → strength** (`weak / medium / strong` — the *magnitude* of the impending move, deliberately **direction-agnostic**).
- **LSTM → price trajectory** (the next 4 candle closes, a 4-output regression that also yields a soft direction).

This is a deliberate hedge against the single greatest failure mode of financial ML: **over-confident overfitting**. Tree ensembles trained on noisy returns saturate to probabilities near 0 or 1; a lone over-confident model would dominate position sizing. By forcing direction and strength to be predicted *separately* and fusing them with explicit shrinkage (§5.4), the system manufactures a calibrated, conservative `ml_score` that the signal engine can trust.

---

### 5.2 `xgboost_model.py` — the direction head

`XGBoostModel` wraps `xgboost.XGBClassifier` for the 3-class direction problem. Default hyperparameters embody mild regularisation tuned for noisy financial data:

```python
params = {
    "n_estimators": 500, "max_depth": 6, "learning_rate": 0.05,
    "subsample": 0.8, "colsample_bytree": 0.8, "min_child_weight": 3,
    "gamma": 0.1, "reg_alpha": 0.1, "reg_lambda": 1.0,
    "objective": "multi:softprob", "num_class": 3, "eval_metric": "mlogloss",
    "random_state": 42, "n_jobs": -1, "use_label_encoder": False,
}
```

`subsample=0.8` and `colsample_bytree=0.8` inject stochasticity (row + column subsampling), `reg_alpha`/`reg_lambda` are the L1/L2 penalties, and `gamma=0.1` is the minimum-loss-reduction-to-split. `random_state=42` ties into the global determinism policy (§5.13).

**Internal walk-forward.** `train()` first runs a 5-split `TimeSeriesSplit`, collecting per-fold accuracy, then **re-fits the final model on the entire dataset** for deployment. It reports an *honest* `cv_accuracy_mean`/`std` alongside the (inflated) in-sample `train_accuracy`, and emits an explicit over-fit warning when the gap exceeds 5 points:

```python
if metrics["train_accuracy"] - cv_accuracy_mean > 0.05:
    logger.warning("xgboost_possible_overfit", ...)
```

This in-class `TimeSeriesSplit` is the *fast inner loop*; the *authoritative* out-of-sample evaluation is the **Purged K-Fold** run by `trainer.py` (§5.7) — the in-class metrics are explicitly labelled `train_*` to mark them as in-sample.

**Calibrated inference.** `predict()` returns raw class probabilities `[short, neutral, long]`, **but** if a calibrator artifact (`calib_{symbol}.joblib`) was loaded, it transforms the saturated long/short probabilities through fitted Platt sigmoids and renormalises (neutral = residual):

```python
if self.calibrator:
    pl = float(self.calibrator["platt_long"].transform(np.array([p[2]]))[0])
    ps = float(self.calibrator["platt_short"].transform(np.array([p[0]]))[0])
    pn = max(0.0, 1.0 - pl - ps)            # neutral = remainder
    tot = (pl + ps + pn) or 1.0
    p = np.array([ps / tot, pn / tot, pl / tot])
```

The `except` clause fails *safe* back to raw model output. Output is `{direction, confidence, probabilities}`. Persistence is via `joblib` to `/app/ml_models/`, with a sibling `_meta` file storing `feature_columns` + `version` so the serving side always reconstructs the exact feature ordering.

> **Known footgun, documented in-code:** the `len(X.shape) == 1` reshape branch in `predict()` is dead — selecting `X[self.feature_columns]` on a 1-D Series raises before the check. Callers must pass a `DataFrame` (the ensemble always does via `features.iloc[-1:]`).

---

### 5.3 `lgbm_model.py` — the strength head

`LGBMModel` wraps `lightgbm.LGBMClassifier` with `objective="multiclass", num_class=3` and `max_depth=5` (shallower than XGBoost — leaf-wise growth needs tighter depth control). The *target it predicts is fundamentally different*: not direction, but **move strength**, built by a static method:

```python
@staticmethod
def build_strength_target(df, forward=4):
    future_change = abs(df["close"].shift(-forward) / df["close"] - 1) * 100
    target = pd.Series(1, index=df.index)   # Medium
    target[future_change > 0.3] = 2         # Strong
    target[future_change < 0.1] = 0         # Weak
    target = target.where(future_change.notna())  # tail rows → NaN, not false-Medium
    return target
```

The `where(future_change.notna())` is a subtle but critical anti-leakage guard: the final `forward` rows have no future and must become `NaN` (dropped) rather than masquerade as legitimate "Medium" labels. The `predict()` returns `{strength, confidence, probabilities{weak,medium,strong}}`. LightGBM never contributes a *direction* — by design it only scales confidence/position size downstream (§5.4).

---

### 5.4 `ensemble.py` — dynamic weighted fusion + the serving service

This is the brain. `EnsemblePredictor` composes the three models and the `FeatureEngine`, with default static weights:

```python
DEFAULT_WEIGHTS = {"xgboost": 0.40, "lgbm": 0.35, "lstm": 0.25}
```

`predict(df)` builds features once, takes the last row, runs each model under a Prometheus timer (`ml_inference_duration.labels(model=...)`), and wraps each call in try/except so a single model crash degrades gracefully instead of nuking the signal.

**The fusion math (`_combine_predictions`).** Only *directional* models (XGBoost, LSTM) vote on direction; LightGBM is excluded from the directional sum. Each present directional model contributes a signed deviation from neutral, weighted by its model weight and its own confidence:

$$\text{deviation} = \sum_{m \in \{\text{xgb},\text{lstm}\}} \pm\,50 \cdot c_m \cdot w_m, \qquad \text{direction\_score} = 50 + \frac{\text{deviation}}{\sum_m w_m}$$

The denominator is the sum of weights of *present* directional models only. This normalisation is the fix for a documented bug: a not-loaded LSTM that returned "neutral" used to dilute confidence by ~38%, pushing every score toward 50 and starving the downstream ML gates. Now neutral models add nothing to the denominator:

```python
else:
    # neutral model adds no weight to denominator — else (e.g. unloaded LSTM)
    # it diluted confidence ~38% and the ML gates became unreachable.
    continue
present += 1
dir_weight += w
```

**Anti-over-confidence shrinkage.** The score is then pulled toward 50 by `ML_SCORE_SHRINK` (config default `0.6`):

```python
direction_score = 50.0 + (direction_score - 50.0) * _shrink
```

This is the *system-level* analogue of probability calibration: even after per-model Platt scaling, the *fused* score is geometrically compressed so an overfit head cannot drag the ensemble to 0/100. Final mapping uses a **60/40 threshold** (a 40% lean on a 3-class problem whose uniform base rate is 33% is a *real* tilt, not noise):

```python
if direction_score >= 60:  final_direction = "long"
elif direction_score <= 40: final_direction = "short"
else:                       final_direction = "neutral"
```

Strength affects **only confidence**, never direction: `strength_conf = {"strong":1.0,"medium":0.85,"weak":0.7}`, and `confidence = |score-50|/50 * strength_conf`. If *no* directional model loaded, the result is flagged `degraded=True` and forced neutral at 50 — a first-class observability signal, not a silent fallback.

**Dynamic re-weighting.** `update_weights(performance)` normalises model weights by realised performance, with a `0.1` floor per model and renormalisation, so a temporarily-bad model is down-weighted but never zeroed.

**The serving service.** `MLService` (run by the `ml-inference` container via `python -m src.ml.ensemble`) maintains one `EnsemblePredictor` per symbol, loads models on demand, and runs an async loop polling Redis for `ml:predict_request`, fetching `candles:{symbol}:H1`, predicting, and caching `ml:result:{symbol}` for 300 s. The container is RAM-boxed at **2 GB / 1 CPU** in `docker-compose.yml` — the GPU-less constraint made physical.

**How the signal engine consumes it.** `src/signals/engine.py` keeps a per-symbol `EnsemblePredictor`, calls `predict` in a thread with a 5 s timeout, and on any failure increments `ml_fallback_total{reason=...}` and returns a neutral `ml_score=50`. The scorer (`src/signals/scorer.py`) applies a further trust shrink — `ML_TRUST = 0.55`, `ml_eff = 50 + (ml_score-50)*ML_TRUST` — so ML is one weighted voice among technical/pattern analysis, never a dictator.

---

### 5.5 `lstm_model.py` — the price-trajectory head under CPU duress

The LSTM is the heaviest model and the project's most carefully sandboxed. PyTorch import is wrapped in try/except setting `TORCH_AVAILABLE`; if torch is absent the model **auto-disables** and every method becomes a safe no-op returning empty predictions. This directly honours the deployment rule *"the server has no GPU — LSTM is heavy; under RAM pressure keep only XGBoost+LightGBM."*

**Architecture (`LSTMNetwork`).** `BatchNorm1d(input) → LSTM(hidden=128, layers=2, dropout=0.3) → Attention → Dropout → FC(128→64) → ReLU → FC(64→4)`. The custom `Attention` layer computes softmax weights over the LSTM time axis and returns a context vector — letting the model focus on the most informative candles in the 60-step window:

```python
weights = torch.softmax(self.attention(lstm_output), dim=1)
context = torch.sum(weights * lstm_output, dim=1)
```

**Training discipline.** MinMax-scaled inputs and targets; a chronological 80/20 split; `MSELoss`; Adam; `ReduceLROnPlateau`; **gradient clipping** to `max_norm=1.0` (LSTM exploding-gradient defence); and **early stopping** with `max_patience=20`. The 4-step target is `close.shift(-1..-4)`, with a `valid_mask` dropping any row whose X or y contains NaN. Validation metrics are MAE/RMSE/MAPE on *inverse-transformed* prices (real units, not scaled).

**CPU budget.** In `trainer.py` the LSTM is trained with **12 epochs per fold** but **80 epochs for the final model** (`batch_size=64`) — fold metrics are cheap sanity checks; only the final fit gets the full budget. Sequence inference uses the last 60 rows; direction is derived from the mean predicted price vs current (±0.1% band).

**Scaler persistence subtlety.** The MinMax scalers are saved as raw `data_min_/data_max_` arrays in an `.npz` and **manually reconstructed** on load (recomputing `scale_`, `min_`, `data_range_`). The code carries a scar of a real bug — `np.savez` auto-appends `.npz`, so the meta path must *not* double-append it (`meta.npz.npz` once made LSTM never load):

```python
# _meta_path already ends in ".npz"; np.savez does not re-append.
# (previous bug: meta.npz.npz → LSTM never loaded)
```

`torch.load(..., weights_only=True)` is used for safe deserialisation.

---

### 5.6 `feature_engine.py` — 60+ features, zero-volume Forex, and leakage hygiene

`FeatureEngine.build_features(df, timeframe)` requires ≥200 rows and emits a wide feature frame across seven families, all via `pandas_ta`:

1. **Price** — body, shadows, range, `body_to_range`, typical/mid price, `close_to_high/low`, and `pct_change` over {1,2,3,5,10,20}.
2. **Trend** — EMA{8,13,20,50,100,200}, price-to-EMA distances, golden/death cross flags, ADX + DI±, SuperTrend, Parabolic SAR.
3. **Momentum** — RSI(+Δ), MACD (line/signal/hist/Δ), Stochastic, Williams %R, CCI, ROC, Ultimate Oscillator.
4. **Volatility** — ATR(+%), Bollinger (width/position), Keltner, **BB-squeeze** (BB inside KC), Donchian, and **timeframe-aware annualised historical volatility**.
5. **Volume** — OBV(+SMA), MFI, volume SMA & ratio.
6. **Temporal** — hour/day/month, four session flags (Asian/London/NY/overlap), and **cyclical sin/cos** encodings of hour and day-of-week.
7. **Lag/Regime** — 10 lagged closes & returns, rolling return means/stds, ATR percentile, vol-regime flag, trending/strong-momentum flags.

**Forex zero-volume handling (a market-specific masterstroke).** Forex feeds (e.g. yfinance) report `volume=0`. Naively, OBV/MFI/`vol_ratio` become all-NaN and the final `dropna()` *annihilates every row*. The engine neutralises them instead of warming-up-dropping them:

```python
df["vol_ratio"] = df["vol_ratio"].replace([inf,-inf], nan).fillna(1.0)
df["mfi"] = df["mfi"].fillna(50.0)   # neutral RSI-band midpoint
df["obv"] = df["obv"].fillna(0.0)
```

**Annualisation correctness.** Historical vol uses `np.sqrt(periods_per_year)` where `periods_per_year` is looked up per timeframe (`M15: 252*96, H1: 252*24, H4: 252*6, D1: 252`) — the naive `sqrt(252)` is only correct for daily bars and would mis-scale every intraday feature.

**Parabolic SAR repair.** `ta.psar` returns long/short in two columns, only one populated per row. Left raw, the final `dropna` would wipe the frame. The engine folds them into an active value + a `psar_is_long` flag.

**Inf hygiene.** Divisions by `open/low/close` can yield `inf`, which `dropna` does *not* catch; the engine explicitly `replace([inf,-inf], nan)` before `dropna()`.

**Leakage firewall in `get_feature_columns`.** This excludes `future_return`, `future_return_pct`, `target`, `target_class`, and raw OHLCV. The docstring is emphatic: leaving future-derived columns in would (1) leak the label and inflate accuracy, and (2) crash `predict` with "not in index" since those columns don't exist at serve time.

**Labels (`build_target`).** Forward return over `forward_periods=4`; class 2/0/1 = long/short/neutral by `threshold_pct=0.1`. Both a classification target (`target_class`) and a regression target (`target`) are produced, then NaN-pruned.

---

### 5.7 `purged_kfold.py` — the anti-look-ahead heart (Lopez de Prado AFML Ch. 7)

This is the methodological crown jewel, and it deserves rigour. **Why ordinary cross-validation lies in finance:**

In trading, each label is *forward-looking* — `target[t]` depends on prices at `t+1 … t+4`. Consequently, **labels overlap**: the label at index 100 and the label at index 101 both peer into the window 101–104. Standard K-Fold (which shuffles) or even a naïve `TimeSeriesSplit` (which doesn't purge) will place training sample 100 in the train set while sample 101 sits in test — and sample 100's label *already saw* test-set prices. The model thus enjoys **look-ahead leakage**: it implicitly trains on the future it is asked to predict, and out-of-sample accuracy is systematically **over-estimated**. A model that looks brilliant in backtest then bleeds live.

Lopez de Prado's remedy, implemented faithfully in `PurgedKFold`, is twofold:

1. **Purging.** Remove from *train* any sample whose label window overlaps the *test* window. Formally, drop training index `i` if `i + label_lookforward ≥ test_start` and `i < test_start`:

   ```python
   purge_lower = max(0, test_start - self.label_lookforward)
   if purge_lower < test_start:
       train_mask[purge_lower:test_start] = False
   ```

2. **Embargo.** Even after purging, *serial correlation* leaks information across the test→train boundary going forward. So a buffer immediately **after** the test window is also dropped. The embargo is `max(n·embargo_pct, label_lookforward)` — guaranteed at least as wide as the label horizon:

   ```python
   embargo_size = max(int(n_samples * self.embargo_pct), self.label_lookforward)
   embargo_upper = min(n_samples, test_end + embargo_size)
   train_mask[test_end:embargo_upper] = False
   ```

The splitter is additionally **walk-forward**: `train_mask[test_end:] = False` forbids *any* sample after the test window from entering train (no training on the future, period). The first fold — whose test sits at the series start and thus has an empty train set — is skipped, mirroring `TimeSeriesSplit` semantics. A `__post_init__` assertion *fatally* errors if train∩test is ever non-empty — a tripwire against silent leakage.

`trainer.py` instantiates it with `label_lookforward=4`, exactly matching `build_target`'s `forward_periods=4`. This alignment is the whole point: the purge width must equal the label horizon or the leakage seeps back in. The financial-ML thesis here is uncompromising — *the validation scheme must respect the dependency structure of the labels, or every reported metric is fiction.*

---

### 5.8 `triple_barrier.py` — economically-meaningful labels & meta-labelling (AFML Ch. 3)

Fixed-horizon labels have two flaws: (a) **class imbalance** — most N-bar returns are tiny, so "Neutral" dominates; (b) the horizon `N` is arbitrary. The **triple-barrier method** fixes both by defining, for each entry, three barriers scaled to *volatility*:

- upper = `price + upper_mult · vol` (a hypothetical take-profit),
- lower = `price − lower_mult · vol` (a hypothetical stop-loss),
- vertical = `t + max_periods` (timeout).

The label is the **first barrier touched**: `+1` (upper), `−1` (lower), `0` (timeout). Volatility, if not supplied, defaults to a 20-period rolling return std converted to price units (`vol_return · price`). This makes labels *economically* meaningful: a "win" is a move large enough to actually hit a realistic TP, not a coin-flip tick.

The module also provides:

- **`meta_label_features`** — the AFML two-stage trick. A *primary* model predicts direction; a *meta* model predicts *"is this prediction trustworthy?"* (1 iff primary's non-neutral call matches the barrier outcome). Trading only on `meta=1` trades **precision for recall**, suppressing false signals.
- **`compute_sample_weights_by_volatility`** — `inverse` (calm regimes = cleaner signal) or `direct` (volatile regimes = more informative; AFML's preference).
- **`temporal_decay_weights`** — exponential recency weighting with a configurable `half_life` (default 500), normalised to mean 1, so the model leans on recent regime behaviour.

These are first-class building blocks available to the trainer/research layer for label sophistication beyond the default forward-return classes.

---

### 5.9 `scaler.py` — train/serve distribution parity

A documented *audit-critical* bug motivates this module: if a model trains on scaled features but inference forgets to scale, the model predicts on a different distribution and **real accuracy collapses far below the reported number**. The fix is to bind the scaler to the model lifecycle.

`FittedScaler` (a dataclass) stores the sklearn scaler + the **exact `feature_columns` ordering** + the scaler type. `transform()` validates that no feature is missing (raising otherwise), reorders columns to the fit order (reproducibility), drops extras, and returns a scaled `DataFrame`. `fit_scaler` defaults to **`RobustScaler`** — and the choice is principled: price data is riddled with outliers (news spikes), so median/IQR scaling is far more stable than mean/std. Scalers persist to `/app/ml_models/scalers/{symbol}/{model}_scaler.joblib` — under the *shared, mounted* `ml_models` volume (a prior bug put them under un-mounted `/app/models` where the engine couldn't see them). `trainer.py` calls `_fit_and_save_scaler` after every final fit, with LSTM explicitly noted as the most scale-sensitive consumer.

---

### 5.10 `calibration.py` — turning confidence into truth

XGBoost/LightGBM emit *over-confident* probabilities: a reported `0.95` may be only 80% likely to be correct. This matters because the `risk_manager` literally sizes positions as `f(confidence)` and gates trades on `confidence > threshold` — **miscalibrated confidence ⇒ wrong bet sizes.** Two standard calibrators are implemented from scratch (no sklearn dependency):

- **`PlattCalibrator`** — fits a sigmoid `p_cal = 1/(1+exp(a·raw+b))` by 500 steps of gradient descent on log-loss, then **clips `a ≥ 0`** (a negative `a` would invert the sigmoid and *shrink* position size at the highest confidence — exactly backwards).
- **`IsotonicCalibrator`** — non-parametric, monotone, fitted with the **Pool Adjacent Violators (PAV)** algorithm and served by linear interpolation. Distribution-free but needs >500 samples for stability.

Quality is quantified by `calibration_report` → **ECE** (weighted mean |confidence−accuracy| across bins), **MCE** (max gap), and **Brier score**, with `is_well_calibrated = ECE < 0.05`. The production pipeline (`scripts/calibrate_ml.py`) fits per-symbol Platt long/short calibrators and writes `calib_{symbol}.joblib`, which `XGBoostModel.predict` auto-loads and applies (§5.2). Calibration thus closes the loop between the model's raw confidence and the risk engine's trust in it.

---

### 5.11 `drift_detector.py` — knowing when the model went stale

When the market regime shifts, the live feature distribution diverges from the training distribution and the model silently rots. This module quantifies that, **without scipy**:

- **Feature drift** via a hand-rolled **two-sample Kolmogorov–Smirnov** test. It builds ECDFs over the pooled support, takes `KS = max|F_train − F_live|`, and approximates the p-value with the Marsaglia–Tsang–Wang transform `λ = (√n + 0.12 + 0.11/√n)·KS` fed into `Q(λ) = 2Σ(−1)^{j−1} exp(−2j²λ²)`. Severity buckets: `<0.1` none, `<0.2` mild, `<0.35` moderate, else severe.
- **Per-feature gating**: only features with ≥10 valid train *and* live points are counted (clean denominator), NaNs stripped first.
- **Recommendation engine**: if `≥ severe_drift_ratio` (default 30%) of features drifted → **"retrain"**; if half that → **"monitor"**; else **"ok"**. This is the trigger philosophy behind the weekly Prefect retrain (§5.12).
- **Prediction drift** via **KL divergence** `Σ p·log(p/q)` over the class-prediction histograms, plus per-class shift deltas — catching the case where accuracy still looks fine but the model's *behaviour* (long/short/neutral mix) has shifted (`is_drift = KL > 0.1`).

---

### 5.12 `financial_metrics.py` — scoring models the way a trader scores them

The thesis: classification metrics (accuracy/F1) are *irrelevant* to profitability. `financial_evaluate` converts predictions into a P&L stream — `pnl = direction · future_return` (neutral = no trade) — and computes the metrics that actually matter:

| Metric | Definition in code | Why |
|---|---|---|
| **Total / mean return** | sum & mean of traded P&L | raw edge |
| **Win rate** | `wins / n_trades` | hit ratio |
| **Profit factor** | `gross_profit / gross_loss` (`inf` if no losses) | >1 ⇒ profitable |
| **Sharpe** | `mean/std · √(trades_per_year)` | risk-adjusted, **annualised by trade frequency** not bar count |
| **Sortino** | `mean / downside_dev · √(trades_per_year)` | penalises only downside |
| **Expectancy** | `WR·avg_win + (1−WR)·avg_loss` | $ per trade |
| **Information Coefficient** | Spearman(signed_confidence, return) | predictive skill |
| **Max drawdown** | peak-to-trough on cumulative equity | survivability |
| **PnL-weighted accuracy** | `Σ(match·|ret|)/Σ|ret|` | did we get the *big* moves right? |

Two subtle, correct choices stand out. **Annualisation** uses `trades_per_year = n_trades · periods_per_year / n` then `√` of that — because `traded_pnls` are *per-trade* returns, not per-bar, so naïve `√252` would distort Sharpe. **Max drawdown** seeds equity with a leading `0.0` and reports cumulative loss directly when the peak is still ≤0 — so an entirely-losing fold can't hide a zero drawdown. Spearman IC is computed via a hand-rolled `_rankdata` with tie-averaging (again, no scipy).

The **deployment gate** `is_model_tradable` is the final arbiter: a model ships only if `n_trades ≥ 30`, `Sharpe ≥ 0.5`, `profit_factor ≥ 1.2`, and `max_drawdown ≤ 0.3`. Accuracy is never a gate.

---

### 5.13 `trainer.py` — the walk-forward training pipeline

`ModelTrainer` orchestrates everything. Key decisions:

- **`DEFAULT_N_SPLITS = 3`** — three purged folds keep OOS valid while cutting training ~40% (a RAM/time concession to the 16 GB box).
- **Data sourcing** (`get_training_data`): prefer `feed_manager` (yfinance, 5000 candles) for volume; fall back to the TimescaleDB `CandleBuilder` only if the feed yields <500 rows.
- **Per-model training** (`train_xgboost/lgbm/lstm`): build features → build target → run **`PurgedKFold(n_splits, label_lookforward=4)`** → train a fresh fold-model and evaluate OOS per fold (skipping folds with <100 train / <50 test) → finally **re-fit on all data, save model + scaler**. LSTM runs 12 fold-epochs vs 80 final-epochs.
- **Honest reporting** (`_summarize_fold_metrics`): mean/std/min/max of accuracy/precision/recall/F1 across folds. **Std is the over-fit detector** — large variance ⇒ unstable model. Only OOS `*_mean` values are persisted (the docstring notes the old in-sample numbers were "deceptive").
- **Persistence**: `_save_training_results` writes `ml_model_performance` rows (preferring `*_mean` OOS metrics), and `train_all` then **fail-softly logs to MLflow**.
- **The Celery task** `retrain_all_models` carries a **3-hour `time_limit`** (20 symbols × 3 models including LSTM blows past the global 600 s cap) and runs on the dedicated **`ml_training` queue** with a low-concurrency, `--max-tasks-per-child=1` worker — a hard-won lesson from the queue-isolation incident. It reconnects feed sources first, else it starves on sparse DB data.

---

### 5.14 Supporting MLOps: MLflow, Prefect, feature selection, determinism

- **`mlflow_tracking.py`** — `log_training_run` is **fail-soft**: a no-op unless `MLFLOW_TRACKING_URI` is set and the client imports. When active it opens one run per `{model}_{symbol}` in experiment `coinepro-models`, logs every numeric metric, and uploads model joblibs as artifacts — giving versioned, comparable training runs. The `mlflow` service (`docker-compose.yml`, sqlite backend, `/mlflow/artifacts`) is the registry.
- **`flows/retrain_flow.py`** — a deliberately *thin* Prefect flow. It does **not** import the heavy ML stack; its single `@task` (with `retries=2`) constructs a bare Celery client and `send_task("src.ml.trainer.retrain_all_models")`. The `flow-runner` container `.serve()`s it on a weekly cron (`0 3 * * 0`, Sunday 03:00 UTC), boxed at 384 MB. Orchestration (schedule, retries, error dashboard via the `prefect` server on :4200) is cleanly separated from execution (Celery on the powerful worker).
- **`feature_selector.py`** — guards the 10–20-samples-per-feature rule of thumb (500 samples / 60 features ⇒ ratio 8 ⇒ certain overfit). A two-step pipeline: **correlation pruning** (drop the lower-variance member of any `|corr|>0.95` pair) then **top-K by XGBoost gain importance** (with an F-score-like `_quick_importance` fallback), returning a fully-auditable `FeatureSelectionResult`.
- **`determinism.py`** — the single seed entry point: seeds Python/`PYTHONHASHSEED`/NumPy/PyTorch(+CUDA)/TensorFlow, optionally enabling deterministic cuDNN and `torch.use_deterministic_algorithms`. `verify_determinism` reports the state. Honest about limits: "deterministic CUDA is best-effort."

---

### 5.15 End-to-end data flow

```
yfinance / TimescaleDB
        │  (5000 candles)
        ▼
FeatureEngine.build_features ──► 60+ features (zero-volume & inf hygiene)
        │
        ├─ build_target (fwd=4, ±0.1%) ──► target_class {short,neutral,long}
        └─ build_strength_target (fwd=4) ─► {weak,medium,strong}
        ▼
PurgedKFold(n=3, lookforward=4)  ── purge + embargo ──► honest OOS folds
        ▼
  XGBoost(dir)   LightGBM(strength)   LSTM(price, CPU-budgeted)
        │              │                    │
        └──── scaler (Robust) saved ────────┘
        ▼
financial_evaluate ──► Sharpe/PF/expectancy/DD ──► is_model_tradable gate
        ▼
  save joblib/.pt + scaler + calib_{symbol}  ──► MLflow registry
        ▼
EnsemblePredictor._combine_predictions  (60/40, ML_SCORE_SHRINK=0.6, degraded flag)
        ▼
ml_score ∈ [0,100] ──► scorer (ML_TRUST=0.55) ──► signal engine
        ▲
drift_detector (KS feature + KL prediction) ──► weekly Prefect → Celery retrain
```

Every arrow is defended: leakage by purging/embargo, distribution mismatch by the saved scaler, over-confidence by Platt + ensemble shrinkage + ML_TRUST, staleness by drift detection, and OOM by the no-GPU LSTM auto-disable and 2 GB container box. The result is a machine-learning subsystem that is *honest by construction* — it would rather report a humble, calibrated, slightly-conservative edge than a spectacular fiction.

---
---

## ۵. زیرسیستمِ یادگیریِ ماشین — مدل‌ها، اعتبارسنجیِ ضدِّنشت، کالیبراسیون و MLOps

> *«در بازارهای مالی، مدلی با دقتِ ۶۰٪ می‌تواند پول بسوزاند و مدلی با دقتِ ۵۲٪ می‌تواند سود بسازد. سؤالِ درست هیچ‌وقت «آیا کلاسِ درست را زدیم؟» نیست — بلکه «آیا پیش‌بینی‌هامان به P&L تبدیل می‌شوند؟» است.»*
> — برداشتی از مستندِ `src/ml/financial_metrics.py`

زیرسیستمِ یادگیریِ ماشینِ **CoinePro-FX** تقریباً به‌طورِ کامل زیرِ `src/ml/` زندگی می‌کند (حدوداً ۳۸۴۰ خط در ۱۸ ماژول)، و چسبِ MLOpsِ آن در `flows/`، `scripts/` و `docker-compose.yml` پخش شده است. این یک مدلِ تک‌جعبه‌سیاه **نیست**؛ یک **اِنسمبلِ لایه‌ای، ضدِّنشت، کالیبره و پایش‌شده‌از‌نظرِ drift** است که برای واقعیت‌های بی‌رحمِ سری‌های زمانیِ مالی مهندسی شده: لیبل‌های هم‌پوشان، خودهمبستگیِ سریالی، تغییرِ رژیم، دُمِ پهن، حجمِ نزدیکِ‌صفرِ فارکس، و یک سرورِ ۱۶ گیگابایتیِ بدونِ GPU که هرگز نباید OOM شود.

این فصل هر فایل را کالبدشکافی می‌کند. قرارداد ساده و بی‌رحمانه است:

| لایه | فایل(ها) | مسئولیت |
|---|---|---|
| **یادگیرنده‌های پایه** | `xgboost_model.py`، `lgbm_model.py`، `lstm_model.py` | جهت، قدرت، پیش‌بینیِ قیمت |
| **ترکیب‌کننده** | `ensemble.py` | ادغامِ وزنیِ داینامیک → یک `ml_score` ∈ [۰،۱۰۰] |
| **فیچرها** | `feature_engine.py`، `feature_selector.py`، `scaler.py` | ۶۰+ فیچر، هرس، تطابقِ train/serve |
| **لیبل‌ها** | `build_target`، `triple_barrier.py` | کلاسِ بازدهِ آینده + سه‌سدِّ لوپز دِ پرادو |
| **اعتبارسنجی** | `purged_kfold.py` | Purged K-Fold + embargo (ضدِّ نگاه‌به‌آینده) |
| **اعتماد** | `calibration.py` | کالیبراسیونِ احتمال (Platt / isotonic) |
| **سلامت** | `drift_detector.py` | drift فیچر (KS) + drift پیش‌بینی (KL) |
| **امتیازدهی** | `financial_metrics.py` | امیدِ‌ریاضی، PF، Sharpe، Sortino، IC، max-DD، gate استقرار |
| **ارکستریشن** | `trainer.py`، `flows/retrain_flow.py`، `mlflow_tracking.py`، `determinism.py` | آموزشِ walk-forward، زمان‌بندیِ Prefect، رجیستریِ MLflow، seed |
| **سرویس‌دهی** | `MLService` + کانتینرِ `ml-inference` | حلقه‌ی پیش‌بینیِ بلادرنگ |

---

### ۵.۱ فلسفه‌ی طراحی: سه سرِ ضعیف بهتر از یک سرِ پُراطمینان است

این زیرسیستم حولِ **تقسیمِ کارِ شناختی** ساخته شده. از هیچ مدلی خواسته نمی‌شود همه‌کار کند؛ هر کدام وجهِ متفاوتی از حرکتِ بعدی را پیش‌بینی می‌کند:

- **XGBoost ← جهت** (`short/neutral/long`، مسئله‌ی ۳-کلاسه).
- **LightGBM ← قدرت** (`weak/medium/strong` — *اندازه‌ی* حرکتِ پیشِ‌رو، عمداً **مستقل از جهت**).
- **LSTM ← مسیرِ قیمت** (۴ کلوزِ کندلِ آینده، رگرسیونِ ۴-خروجی که جهتِ نرم هم می‌دهد).

این یک پوششِ عمدی در برابرِ بزرگ‌ترین حالتِ شکستِ ML مالی است: **بیش‌برازشِ پُراطمینان**. اِنسمبل‌های درختیِ آموزش‌دیده روی بازدهِ نویزی، احتمال‌ها را به نزدیکِ ۰ یا ۱ اشباع می‌کنند؛ یک مدلِ تنهای پُراطمینان بر سایزِ پوزیشن مسلط می‌شد. با جداکردنِ پیش‌بینیِ جهت و قدرت و ادغامِ آن‌ها با shrinkageِ صریح (§۵.۴)، سیستم یک `ml_score`ِ کالیبره و محافظه‌کار می‌سازد که موتورِ سیگنال می‌تواند به آن اعتماد کند.

---

### ۵.۲ `xgboost_model.py` — سرِ جهت

`XGBoostModel` کلاسِ `XGBClassifier` را برای مسئله‌ی ۳-کلاسه می‌پیچد. ابرپارامترهای پیش‌فرض، رگولاریزاسیونِ ملایمِ تنظیم‌شده برای داده‌ی نویزیِ مالی را تجسم می‌کنند: `n_estimators=500`، `max_depth=6`، `learning_rate=0.05`، `subsample=0.8`، `colsample_bytree=0.8`، `reg_alpha=0.1`، `reg_lambda=1.0`، `gamma=0.1`. `subsample`/`colsample` نمونه‌گیریِ تصادفیِ سطر/ستون تزریق می‌کنند، `reg_*` جریمه‌های L1/L2 هستند و `random_state=42` به سیاستِ determinism (§۵.۱۳) گره می‌خورد.

**Walk-forwardِ درونی.** `train()` ابتدا یک `TimeSeriesSplit` پنج‌تکه اجرا می‌کند و دقتِ هر فولد را جمع می‌کند، سپس **مدلِ نهایی را روی کلِ داده دوباره fit می‌کند**. `cv_accuracy_mean/std`ِ صادقانه را در کنارِ `train_accuracy`ِ (متورّمِ in-sample) گزارش می‌دهد و اگر فاصله از ۵ واحد بگذرد هشدارِ بیش‌برازش می‌دهد. این `TimeSeriesSplit`ِ درون‌کلاسی حلقه‌ی سریعِ داخلی است؛ اعتبارسنجیِ *مرجع*، **Purged K-Fold**ِ `trainer.py` (§۵.۷) است — به همین خاطر متریک‌های درون‌کلاسی با پیشوندِ `train_*` به‌عنوانِ in-sample علامت‌گذاری شده‌اند.

**استنتاجِ کالیبره.** `predict()` احتمالاتِ خامِ `[short,neutral,long]` را برمی‌گرداند، **اما** اگر آرتیفکتِ کالیبراتور (`calib_{symbol}.joblib`) لود شده باشد، احتمال‌های اشباعِ long/short را از سیگموییدهای Plattِ fit‌شده عبور می‌دهد و دوباره نرمال می‌کند (neutral = باقی‌مانده). شاخه‌ی `except` به‌صورتِ *fail-safe* به خروجیِ خامِ مدل برمی‌گردد. ماندگاری با `joblib` در `/app/ml_models/` به‌همراهِ فایلِ `_meta` (شاملِ `feature_columns` + `version`) است تا سمتِ سرویس همیشه ترتیبِ دقیقِ فیچرها را بازسازی کند.

> **تله‌ی شناخته‌شده‌ی مستندشده:** شاخه‌ی reshape برای `len(X.shape)==1` مرده است — انتخابِ `X[self.feature_columns]` روی Seriesِ یک‌بعدی پیش از بررسی خطا می‌دهد. فراخوان‌ها باید `DataFrame` بدهند (اِنسمبل همیشه با `features.iloc[-1:]` همین کار را می‌کند).

---

### ۵.۳ `lgbm_model.py` — سرِ قدرت

`LGBMModel` کلاسِ `LGBMClassifier` را با `objective="multiclass"` و `max_depth=5` می‌پیچد (کم‌عمق‌تر از XGBoost — رشدِ leaf-wise نیاز به کنترلِ سخت‌گیرانه‌ترِ عمق دارد). هدفی که پیش‌بینی می‌کند بنیادین متفاوت است: نه جهت، بلکه **قدرتِ حرکت**، که با `build_strength_target` ساخته می‌شود: `future_change > 0.3 → 2 (Strong)`، `< 0.1 → 0 (Weak)`، در میان `1 (Medium)`. عبارتِ `where(future_change.notna())` یک محافظِ ظریفِ ضدِّنشت است: سطرهای انتهایی که آینده ندارند باید `NaN` (drop) شوند، نه اینکه نقابِ "Medium"ِ قلابی بزنند. LightGBM هرگز *جهت* نمی‌دهد — به‌طراحی فقط confidence/سایزِ پوزیشن را در پایین‌دست مقیاس می‌دهد (§۵.۴).

---

### ۵.۴ `ensemble.py` — ادغامِ وزنیِ داینامیک + سرویسِ سرویس‌دهی

این مغز است. `EnsemblePredictor` سه مدل و `FeatureEngine` را با وزن‌های ایستای پیش‌فرض ترکیب می‌کند: `{"xgboost":0.40, "lgbm":0.35, "lstm":0.25}`. `predict(df)` یک‌بار فیچر می‌سازد، آخرین سطر را برمی‌دارد، هر مدل را زیرِ تایمرِ Prometheus اجرا می‌کند و هر فراخوان را در try/except می‌پیچد تا کرشِ یک مدل به‌جای نابودیِ سیگنال، فقط degraded شود.

**ریاضیِ ادغام (`_combine_predictions`).** فقط مدل‌های *جهت‌دار* (XGBoost، LSTM) به جهت رأی می‌دهند؛ LightGBM از جمعِ جهت کنار گذاشته می‌شود. هر مدلِ جهت‌دارِ حاضر یک انحرافِ علامت‌دار از خنثی می‌سازد، وزن‌شده بر وزنِ مدل و اطمینانِ خودش:

$$\text{deviation} = \sum_{m \in \{\text{xgb},\text{lstm}\}} \pm\,50 \cdot c_m \cdot w_m, \qquad \text{direction\_score} = 50 + \frac{\text{deviation}}{\sum_m w_m}$$

مخرج فقط مجموعِ وزنِ مدل‌های جهت‌دارِ *حاضر* است. این نرمال‌سازی رفعِ یک باگِ مستند است: یک LSTMِ لودنشده که "neutral" می‌داد، اطمینان را ~۳۸٪ رقیق می‌کرد و gateهای MLِ پایین‌دست را گرسنه می‌گذاشت. حالا مدل‌های خنثی چیزی به مخرج اضافه نمی‌کنند (`continue`).

**shrinkageِ ضدِّ‌بیش‌اطمینان.** سپس امتیاز با `ML_SCORE_SHRINK` (پیش‌فرضِ پیکربندی `0.6`) به‌سمتِ ۵۰ کشیده می‌شود: `direction_score = 50 + (direction_score-50)*shrink`. این آنالوگِ *سطحِ‌سیستمیِ* کالیبراسیونِ احتمال است: حتی پس از Plattِ هر مدل، امتیازِ *ادغام‌شده* فشرده می‌شود تا یک سرِ بیش‌برازش نتواند اِنسمبل را به ۰/۱۰۰ بکشد. نگاشتِ نهایی **آستانه‌ی ۶۰/۴۰** دارد (یک lean ۴۰٪ روی مسئله‌ی ۳-کلاسه با نرخِ پایه‌ی یکنواختِ ۳۳٪ یک تمایلِ *واقعی* است، نه نویز): `≥60 → long`، `≤40 → short`، وگرنه `neutral`.

قدرت فقط بر **اطمینان** اثر می‌گذارد نه جهت: `strength_conf = {strong:1.0, medium:0.85, weak:0.7}` و `confidence = |score-50|/50 * strength_conf`. اگر *هیچ* مدلِ جهت‌داری لود نشده باشد، نتیجه `degraded=True` پرچم می‌خورد و در ۵۰ خنثی می‌شود — یک سیگنالِ مشاهده‌پذیریِ درجه‌یک، نه fallbackِ خاموش.

**باز‌وزن‌دهیِ داینامیک.** `update_weights(performance)` وزن‌ها را بر عملکردِ تحقق‌یافته نرمال می‌کند، با کفِ `0.1` برای هر مدل و نرمال‌سازیِ مجدد، تا مدلِ موقتاً‌بد کم‌وزن شود اما هرگز صفر نشود.

**سرویسِ سرویس‌دهی.** `MLService` (که کانتینرِ `ml-inference` با `python -m src.ml.ensemble` اجرایش می‌کند) برای هر نماد یک `EnsemblePredictor` نگه می‌دارد، مدل‌ها را on-demand لود می‌کند و حلقه‌ی asyncِ پایشِ Redis (`ml:predict_request`) را می‌چرخاند: کندل‌های `candles:{symbol}:H1` را می‌گیرد، پیش‌بینی می‌کند و `ml:result:{symbol}` را ۳۰۰ ثانیه کش می‌کند. کانتینر در `docker-compose.yml` به **۲ گیگ / ۱ CPU** محدود است — محدودیتِ بی‌GPU به‌صورتِ فیزیکی.

**نحوه‌ی مصرف توسطِ موتورِ سیگنال.** `src/signals/engine.py` برای هر نماد یک `EnsemblePredictor` نگه می‌دارد، `predict` را در یک thread با تایم‌اوتِ ۵ ثانیه صدا می‌زند و در هر خطا `ml_fallback_total{reason=...}` را افزایش و `ml_score=50`ِ خنثی برمی‌گرداند. scorer (`src/signals/scorer.py`) یک shrinkِ اعتمادِ دیگر اعمال می‌کند — `ML_TRUST = 0.55`، `ml_eff = 50 + (ml_score-50)*ML_TRUST` — تا ML یک رأیِ وزن‌دار در کنارِ تحلیلِ تکنیکال/الگو باشد، نه دیکتاتور.

---

### ۵.۵ `lstm_model.py` — سرِ مسیرِ قیمت زیرِ فشارِ CPU

LSTM سنگین‌ترین مدل و دقیق‌ترین sandboxِ پروژه است. importِ PyTorch در try/except با `TORCH_AVAILABLE` پیچیده شده؛ اگر torch نباشد مدل **خودکار غیرفعال** می‌شود و هر متد یک no-opِ امن می‌شود. این مستقیماً قاعده‌ی استقرار را محترم می‌شمارد: *«سرور GPU ندارد — LSTM سنگین است؛ زیرِ فشارِ RAM فقط XGBoost+LightGBM فعال بماند.»*

**معماری (`LSTMNetwork`).** `BatchNorm1d(input) → LSTM(hidden=128, layers=2, dropout=0.3) → Attention → Dropout → FC(128→64) → ReLU → FC(64→4)`. لایه‌ی سفارشیِ `Attention` وزن‌های softmax روی محورِ زمانی LSTM می‌سازد و بردارِ context برمی‌گرداند — مدل را قادر می‌کند روی آگاهی‌بخش‌ترین کندل‌ها در پنجره‌ی ۶۰-تایی تمرکز کند.

**انضباطِ آموزش.** ورودی/هدفِ MinMax-scaled؛ تقسیمِ زمانیِ ۸۰/۲۰؛ `MSELoss`؛ Adam؛ `ReduceLROnPlateau`؛ **gradient clipping** به `max_norm=1.0` (دفاع در برابرِ انفجارِ گرادیان)؛ و **early stopping** با `max_patience=20`. هدفِ ۴-گامه `close.shift(-1..-4)` است با `valid_mask`ی که هر سطرِ NaN را drop می‌کند. متریک‌های اعتبارسنجی MAE/RMSE/MAPE روی قیمت‌های *معکوس‌مقیاس‌شده* (واحدِ واقعی) هستند.

**بودجه‌ی CPU.** در `trainer.py`، LSTM با **۱۲ epoch در هر فولد** اما **۸۰ epoch برای مدلِ نهایی** آموزش می‌بیند — متریک‌های فولد بررسی‌های ارزانِ سلامت‌اند؛ فقط fitِ نهایی بودجه‌ی کامل می‌گیرد. استنتاج روی ۶۰ سطرِ آخر؛ جهت از میانگینِ قیمتِ پیش‌بینی‌شده در برابرِ جاری (باندِ ±۰.۱٪).

**ظرافتِ ماندگاریِ scaler.** scalerهای MinMax به‌صورتِ آرایه‌های خامِ `data_min_/data_max_` در یک `.npz` ذخیره و هنگامِ لود **دستی بازسازی** می‌شوند. کد زخمِ یک باگِ واقعی را حمل می‌کند — `np.savez` خودش `.npz` اضافه می‌کند، پس مسیرِ meta نباید دوبار اضافه‌اش کند (`meta.npz.npz` یک‌بار باعث شد LSTM هرگز لود نشود). از `torch.load(..., weights_only=True)` برای دیسریالایزِ امن استفاده می‌شود.

---

### ۵.۶ `feature_engine.py` — ۶۰+ فیچر، فارکسِ بی‌حجم و بهداشتِ نشت

`build_features(df, timeframe)` حداقل ۲۰۰ سطر می‌خواهد و یک فریمِ پهنِ فیچر در هفت خانواده تولید می‌کند، همه با `pandas_ta`:

۱. **قیمتی** — body، سایه‌ها، range، `body_to_range`، typical/mid، `close_to_high/low`، و `pct_change` روی {۱،۲،۳،۵،۱۰،۲۰}.
۲. **روند** — EMA{8..200}، فاصله‌های price-to-EMA، پرچم‌های golden/death cross، ADX + DI±، SuperTrend، Parabolic SAR.
۳. **مومنتوم** — RSI(+Δ)، MACD، Stochastic، Williams %R، CCI، ROC، Ultimate Oscillator.
۴. **نوسان** — ATR(+%)، Bollinger (width/position)، Keltner، **BB-squeeze**، Donchian، و **نوسانِ تاریخیِ سالانه‌شده‌ی آگاه‌از‌تایم‌فریم**.
۵. **حجم** — OBV(+SMA)، MFI، SMA و نسبتِ حجم.
۶. **زمانی** — ساعت/روز/ماه، چهار پرچمِ جلسه (Asian/London/NY/overlap)، و کدگذاریِ **چرخه‌ایِ sin/cos** ساعت و روزِ هفته.
۷. **لگ/رژیم** — ۱۰ کلوز و بازدهِ لگ‌دار، میانگین/انحرافِ غلتانِ بازده، صدکِ ATR، پرچمِ رژیمِ نوسان، پرچم‌های trending/strong-momentum.

**مدیریتِ حجمِ صفرِ فارکس (یک شاهکارِ بازارمحور).** فیدهای فارکس (مثلِ yfinance) `volume=0` گزارش می‌کنند. ساده‌لوحانه، OBV/MFI/`vol_ratio` همگی NaN می‌شوند و `dropna()`ِ نهایی *همه‌ی سطرها را نابود می‌کند*. موتور آن‌ها را به‌جای drop، خنثی می‌کند: `vol_ratio→1.0`، `mfi→50.0`، `obv→0.0`.

**درستیِ سالانه‌سازی.** نوسانِ تاریخی از `np.sqrt(periods_per_year)` استفاده می‌کند که per-timeframe جست‌وجو می‌شود (`M15:252*96`، `H1:252*24`، `H4:252*6`، `D1:252`) — `sqrt(252)`ِ ساده فقط برای کندلِ روزانه درست است و هر فیچرِ intraday را بد-مقیاس می‌کرد.

**تعمیرِ Parabolic SAR.** `ta.psar` long/short را در دو ستون می‌دهد که در هر سطر فقط یکی پُر است. خام رها شوند، `dropna`ِ نهایی فریم را پاک می‌کند. موتور آن‌ها را در یک مقدارِ فعال + پرچمِ `psar_is_long` تا می‌کند.

**بهداشتِ inf.** تقسیم بر `open/low/close` می‌تواند `inf` بدهد که `dropna` آن را *نمی‌گیرد*؛ موتور صریحاً پیش از `dropna()` آن را `replace([inf,-inf], nan)` می‌کند.

**دیوارِ آتشِ نشت در `get_feature_columns`.** این تابع `future_return`، `future_return_pct`، `target`، `target_class` و OHLCVِ خام را حذف می‌کند. مستند تأکید دارد: نگه‌داشتنِ ستون‌های مشتق‌از‌آینده (۱) لیبل را نشت می‌داد و دقت را قلابی بالا می‌برد و (۲) `predict` را با «not in index» کرش می‌کرد چون این ستون‌ها در زمانِ سرویس وجود ندارند.

**لیبل‌ها (`build_target`).** بازدهِ آینده روی `forward_periods=4`؛ کلاسِ ۲/۰/۱ = long/short/neutral با `threshold_pct=0.1`. هم هدفِ طبقه‌بندی (`target_class`) و هم رگرسیون (`target`) ساخته و سپس NaN-prune می‌شوند.

---

### ۵.۷ `purged_kfold.py` — قلبِ ضدِّ‌نگاه‌به‌آینده (لوپز دِ پرادو، AFML فصلِ ۷)

این جواهرِ روش‌شناختی است و سزاوارِ دقت. **چرا cross-validation معمولی در بازارهای مالی دروغ می‌گوید:**

در ترید، هر لیبل *آینده‌نگر* است — `target[t]` به قیمت‌های `t+1…t+4` وابسته است. در نتیجه **لیبل‌ها هم‌پوشانی دارند**: لیبلِ ایندکسِ ۱۰۰ و لیبلِ ایندکسِ ۱۰۱ هر دو به پنجره‌ی ۱۰۱–۱۰۴ نگاه می‌کنند. K-Foldِ استاندارد (که بُر می‌زند) یا حتی `TimeSeriesSplit`ِ ساده (که purge نمی‌کند) نمونه‌ی ۱۰۰ را در train می‌گذارد در حالی که ۱۰۱ در test است — و لیبلِ نمونه‌ی ۱۰۰ *همین‌حالا* قیمت‌های test را دیده است. مدل از **نشتِ نگاه‌به‌آینده** بهره می‌برد: ضمنی روی آینده‌ای که قرار است پیش‌بینی کند آموزش می‌بیند و دقتِ OOS سیستماتیک **بیش‌برآورد** می‌شود. مدلی که در بک‌تست درخشان است، زنده پول می‌بازد.

درمانِ لوپز دِ پرادو، که در `PurgedKFold` وفادارانه پیاده شده، دوگانه است:

۱. **Purging.** از *train* هر نمونه‌ای را که پنجره‌ی لیبلش با پنجره‌ی *test* هم‌پوشانی دارد حذف کن. رسماً، ایندکسِ `i` حذف شود اگر `i + label_lookforward ≥ test_start` و `i < test_start`:

   ```python
   purge_lower = max(0, test_start - self.label_lookforward)
   if purge_lower < test_start:
       train_mask[purge_lower:test_start] = False
   ```

۲. **Embargo.** حتی پس از purge، *خودهمبستگیِ سریالی* اطلاعات را روبه‌جلو از مرزِ test→train نشت می‌دهد. پس یک بافر بلافاصله **پس از** پنجره‌ی test هم حذف می‌شود. embargo برابرِ `max(n·embargo_pct, label_lookforward)` است — تضمیناً دستِ‌کم به پهنای افقِ لیبل.

این splitter علاوه‌بر این **walk-forward** است: `train_mask[test_end:]=False` ورودِ *هر* نمونه‌ی پس از test به train را ممنوع می‌کند (آموزش روی آینده، نقطه). فولدِ نخست — که test‌اش در ابتدای سری است و train خالی دارد — skip می‌شود، مطابقِ معناشناسیِ `TimeSeriesSplit`. یک assertionِ `__post_init__` اگر train∩test هرگز ناتهی شود **به‌صورتِ فاتال** خطا می‌دهد — یک تله‌سیم در برابرِ نشتِ خاموش.

`trainer.py` آن را با `label_lookforward=4` می‌سازد، دقیقاً منطبق با `forward_periods=4`ِ `build_target`. این هم‌ترازی کلِ نکته است: پهنای purge باید برابرِ افقِ لیبل باشد وگرنه نشت برمی‌گردد. تزِ ML مالی اینجا سازش‌ناپذیر است — *طرحِ اعتبارسنجی باید ساختارِ وابستگیِ لیبل‌ها را محترم بشمارد، وگرنه هر متریکِ گزارش‌شده افسانه است.*

---

### ۵.۸ `triple_barrier.py` — لیبل‌های اقتصادی‌معنادار و meta-labeling (AFML فصلِ ۳)

لیبلِ افق‌ثابت دو نقص دارد: (الف) **عدم‌توازنِ کلاس** — بیشترِ بازده‌های N-باری کوچک‌اند پس "Neutral" غالب می‌شود؛ (ب) افقِ `N` دلبخواه است. **روشِ سه‌سدّی** هر دو را با تعریفِ سه سدّ مقیاس‌شده با *نوسان* حل می‌کند: بالا = `price + upper_mult·vol` (TP فرضی)، پایین = `price − lower_mult·vol` (SL فرضی)، عمودی = `t + max_periods` (timeout). لیبل **اولین سدّی** است که لمس می‌شود: `+1`/`−1`/`0`. نوسان اگر داده نشود، به std بازدهِ غلتانِ ۲۰-تایی (تبدیل به واحدِ قیمت) پیش‌فرض می‌شود. این لیبل‌ها را *اقتصادی* معنادار می‌کند: یک "بُرد" حرکتی به‌اندازه‌ی کافی بزرگ برای زدنِ یک TP واقع‌بینانه است، نه یک تیکِ شیر-یا-خط.

ماژول همچنین فراهم می‌کند: **`meta_label_features`** (ترفندِ دومرحله‌ای AFML — مدلِ اولیه جهت می‌زند، مدلِ meta «آیا قابل‌اعتماد است؟» را می‌زند؛ تریدِ فقط روی `meta=1`، precision را به قیمتِ recall می‌خرد)؛ **`compute_sample_weights_by_volatility`** (`inverse` یا `direct`)؛ و **`temporal_decay_weights`** (وزن‌دهیِ نماییِ تازگی با `half_life` پیش‌فرضِ ۵۰۰). این‌ها بلوک‌های درجه‌یکِ در دسترسِ لایه‌ی trainer/پژوهش برای پیچیدگیِ لیبل فراتر از کلاس‌های پیش‌فرض‌اند.

---

### ۵.۹ `scaler.py` — تطابقِ توزیعِ train/serve

یک باگِ *بحرانیِ ممیزی* انگیزه‌ی این ماژول است: اگر مدل روی فیچرهای scaled آموزش ببیند ولی استنتاج فراموش کند scale کند، مدل روی توزیعِ متفاوت پیش‌بینی می‌کند و **دقتِ واقعی بسیار پایین‌تر از عددِ گزارش‌شده فرومی‌ریزد**. راه‌حل، گره‌زدنِ scaler به چرخه‌ی حیاتِ مدل است.

`FittedScaler` (dataclass) scalerِ sklearn + **ترتیبِ دقیقِ `feature_columns`** + نوعِ scaler را ذخیره می‌کند. `transform()` نبودِ هیچ فیچری را اعتبارسنجی می‌کند (وگرنه خطا)، ستون‌ها را به ترتیبِ fit بازچینی می‌کند (تکرارپذیری)، اضافی‌ها را drop و یک `DataFrame`ِ scaled برمی‌گرداند. `fit_scaler` به‌طورِ پیش‌فرض **`RobustScaler`** است — و انتخاب اصولی است: داده‌ی قیمت پُر از outlier است (spikeهای خبری)، پس مقیاسِ median/IQR بسیار پایدارتر از mean/std است. scalerها در `/app/ml_models/scalers/{symbol}/{model}_scaler.joblib` — زیرِ ولومِ *به‌اشتراکِ‌mountشده‌ی* `ml_models` (باگِ قبلی آن‌ها را زیرِ `/app/models`ِ mount-نشده می‌گذاشت) — ذخیره می‌شوند. `trainer.py` پس از هر fitِ نهایی `_fit_and_save_scaler` را صدا می‌زند، با LSTM به‌عنوانِ حساس‌ترین مصرف‌کننده.

---

### ۵.۱۰ `calibration.py` — تبدیلِ اطمینان به حقیقت

XGBoost/LightGBM احتمال‌های *پُراطمینان* می‌دهند: `0.95`ِ گزارش‌شده شاید فقط ۸۰٪ احتمالِ درستی داشته باشد. این مهم است چون `risk_manager` واقعاً پوزیشن را `f(confidence)` سایز می‌کند و ترید را روی `confidence > آستانه` gate می‌کند — **اطمینانِ غیرکالیبره ⇒ سایزِ شرطِ غلط.** دو کالیبراتورِ استاندارد از صفر پیاده شده‌اند (بدونِ وابستگی به sklearn):

- **`PlattCalibrator`** — یک سیگموییدِ `p_cal = 1/(1+exp(a·raw+b))` را با ۵۰۰ گامِ گرادیان‌کاهشی روی log-loss fit می‌کند، سپس **`a ≥ 0` را کلیپ می‌کند** (یک `a`ِ منفی سیگموید را معکوس و سایزِ پوزیشن را در بالاترین اطمینان *کوچک* می‌کند — دقیقاً برعکس).
- **`IsotonicCalibrator`** — ناپارامتری، یکنوا، با الگوریتمِ **Pool Adjacent Violators (PAV)** fit و با درون‌یابیِ خطی سرو می‌شود. توزیع‌آزاد اما برای پایداری >۵۰۰ نمونه می‌خواهد.

کیفیت با `calibration_report` کمّی می‌شود → **ECE** (میانگینِ وزنیِ |اطمینان−دقت| روی بین‌ها)، **MCE** (بیشینه)، و **Brier score**، با `is_well_calibrated = ECE < 0.05`. خط‌لوله‌ی تولید (`scripts/calibrate_ml.py`) کالیبراتورهای Plattِ long/shortِ per-symbol را fit و `calib_{symbol}.joblib` را می‌نویسد که `XGBoostModel.predict` خودکار لود و اعمال می‌کند (§۵.۲). کالیبراسیون بدین‌سان حلقه‌ی بینِ اطمینانِ خامِ مدل و اعتمادِ موتورِ ریسک را می‌بندد.

---

### ۵.۱۱ `drift_detector.py` — دانستنِ زمانِ کهنگیِ مدل

وقتی رژیمِ بازار جابه‌جا می‌شود، توزیعِ فیچرِ زنده از توزیعِ آموزش واگرا می‌شود و مدل بی‌صدا می‌پوسد. این ماژول آن را کمّی می‌کند، **بدونِ scipy**:

- **drift فیچر** با یک **Kolmogorov–Smirnov دو-نمونه‌ای**ِ دست‌ساز. ECDFها را روی پشتیبانِ تجمیعی می‌سازد، `KS = max|F_train−F_live|` را می‌گیرد و p-value را با تبدیلِ Marsaglia–Tsang–Wang تقریب می‌زند. سطح‌ها: `<0.1` هیچ، `<0.2` خفیف، `<0.35` متوسط، وگرنه شدید.
- **gateِ per-feature**: فقط فیچرهای با ≥۱۰ نقطه‌ی معتبرِ train *و* live شمرده می‌شوند (مخرجِ تمیز)، NaNها ابتدا حذف.
- **موتورِ توصیه**: اگر `≥ severe_drift_ratio` (پیش‌فرض ۳۰٪) فیچرها drift کرده باشند → **"retrain"**؛ نیمِ آن → **"monitor"**؛ وگرنه **"ok"**. این فلسفه‌ی trigger پشتِ retrainِ هفتگیِ Prefect است (§۵.۱۲).
- **drift پیش‌بینی** با **واگراییِ KL** `Σ p·log(p/q)` روی هیستوگرامِ کلاس‌های پیش‌بینی + دلتای جابه‌جاییِ هر کلاس — موردی را می‌گیرد که دقت هنوز خوب به‌نظر می‌رسد اما *رفتارِ* مدل (ترکیبِ long/short/neutral) جابه‌جا شده (`is_drift = KL > 0.1`).

---

### ۵.۱۲ `financial_metrics.py` — امتیازدهیِ مدل آن‌طور که یک تریدر می‌دهد

تز: متریک‌های طبقه‌بندی (accuracy/F1) برای سودآوری *بی‌ربط‌اند*. `financial_evaluate` پیش‌بینی‌ها را به جریانِ P&L تبدیل می‌کند — `pnl = direction · future_return` (neutral = بدونِ ترید) — و متریک‌هایی که واقعاً مهم‌اند را محاسبه می‌کند:

| متریک | تعریف در کد | چرا |
|---|---|---|
| **بازدهِ کل/میانگین** | جمع و میانگینِ P&Lِ ترید‌شده | لبه‌ی خام |
| **نرخِ برد** | `wins / n_trades` | نسبتِ اصابت |
| **profit factor** | `gross_profit/gross_loss` (`inf` بدونِ زیان) | >۱ ⇒ سودده |
| **Sharpe** | `mean/std · √(trades_per_year)` | ریسک‌تعدیل‌شده، **سالانه با فرکانسِ ترید** نه شمارِ بار |
| **Sortino** | `mean / downside_dev · √(trades_per_year)` | فقط downside را جریمه می‌کند |
| **expectancy** | `WR·avg_win + (1−WR)·avg_loss` | دلار به‌ازای هر ترید |
| **IC** | Spearman(اطمینانِ علامت‌دار، بازده) | مهارتِ پیش‌بینی |
| **max drawdown** | قله‌به‌دره روی equityِ تجمعی | بقاپذیری |
| **دقتِ وزن‌شده‌با‌PnL** | `Σ(match·|ret|)/Σ|ret|` | حرکت‌های *بزرگ* را درست زدیم؟ |

دو انتخابِ ظریف و درست برجسته‌اند. **سالانه‌سازی** از `trades_per_year = n_trades·periods_per_year/n` و سپس `√` آن استفاده می‌کند — چون `traded_pnls` بازدهِ *per-trade* است نه per-bar، پس `√252`ِ ساده Sharpe را تحریف می‌کرد. **max drawdown** با یک `0.0`ِ پیشروی equity را seed می‌کند و وقتی قله هنوز ≤۰ است زیانِ تجمعی را مستقیم گزارش می‌دهد — تا فولدِ تماماً‌زیان‌ده نتواند drawdownِ صفر را پنهان کند. ICِ Spearman با `_rankdata`ِ دست‌ساز و میانگین‌گیریِ tie محاسبه می‌شود (باز هم بدونِ scipy).

**gate استقرار** `is_model_tradable` داورِ نهایی است: مدل فقط اگر `n_trades ≥ 30`، `Sharpe ≥ 0.5`، `profit_factor ≥ 1.2` و `max_drawdown ≤ 0.3` باشد deploy می‌شود. دقت هرگز gate نیست.

---

### ۵.۱۳ `trainer.py` — خط‌لوله‌ی آموزشِ walk-forward

`ModelTrainer` همه‌چیز را ارکستره می‌کند. تصمیم‌های کلیدی:

- **`DEFAULT_N_SPLITS = 3`** — سه فولدِ purged، OOS را معتبر نگه می‌دارد و آموزش را ~۴۰٪ می‌بُرد (سازشِ RAM/زمان برای سرورِ ۱۶ گیگ).
- **منبعِ داده** (`get_training_data`): ترجیحِ `feed_manager` (yfinance، ۵۰۰۰ کندل) برای حجم؛ fallback به `CandleBuilder`ِ TimescaleDB فقط اگر فید <۵۰۰ سطر بدهد.
- **آموزشِ per-model**: ساختِ فیچر → هدف → **`PurgedKFold(n_splits, label_lookforward=4)`** → آموزشِ مدلِ تازه‌ی هر فولد و ارزیابیِ OOS (skip فولدِ <۱۰۰ train / <۵۰ test) → در پایان **re-fit روی کلِ داده، ذخیره‌ی مدل + scaler**. LSTM ۱۲ فولد-epoch در برابرِ ۸۰ نهایی-epoch.
- **گزارشِ صادقانه** (`_summarize_fold_metrics`): mean/std/min/max روی فولدها. **std آشکارسازِ بیش‌برازش است** — واریانسِ زیاد ⇒ مدلِ ناپایدار. فقط `*_mean`ِ OOS ماندگار می‌شود (مستند می‌گوید اعدادِ in-sampleِ قدیمی «فریبنده» بودند).
- **ماندگاری**: `_save_training_results` سطرهای `ml_model_performance` می‌نویسد (ترجیحِ متریک‌های `*_mean`)، و `train_all` سپس **به‌صورتِ fail-soft به MLflow لاگ می‌کند**.
- **تسکِ Celery** `retrain_all_models` یک **`time_limit`ِ ۳-ساعته** دارد (۲۰ نماد × ۳ مدل با LSTM از سقفِ سراسریِ ۶۰۰ ثانیه فراتر می‌رود) و روی صفِ اختصاصیِ **`ml_training`** با workerِ کم‌هم‌زمانی و `--max-tasks-per-child=1` اجرا می‌شود — درسِ سختِ حادثه‌ی queue-isolation. ابتدا منابعِ فید را وصل می‌کند، وگرنه روی داده‌ی پراکنده‌ی DB گرسنه می‌ماند.

---

### ۵.۱۴ MLOpsِ پشتیبان: MLflow، Prefect، انتخابِ فیچر، determinism

- **`mlflow_tracking.py`** — `log_training_run` عمداً **fail-soft** است: no-op مگر `MLFLOW_TRACKING_URI` ست باشد و کلاینت import شود. وقتی فعال، برای هر `{model}_{symbol}` یک run در experimentِ `coinepro-models` باز می‌کند، هر متریکِ عددی را لاگ و joblibها را به‌عنوانِ artifact آپلود می‌کند — runهای نسخه‌دارِ قابلِ‌مقایسه. سرویسِ `mlflow` (بک‌اندِ sqlite، `/mlflow/artifacts`) رجیستری است.
- **`flows/retrain_flow.py`** — یک فلوِ Prefectِ عمداً *نازک*. استکِ سنگینِ ML را import **نمی‌کند**؛ تنها `@task`ِ آن (با `retries=2`) یک کلاینتِ خامِ Celery می‌سازد و `send_task("src.ml.trainer.retrain_all_models")` می‌کند. کانتینرِ `flow-runner` آن را روی cronِ هفتگی (`0 3 * * 0`، یکشنبه ۰۳:۰۰ UTC) `.serve()` می‌کند، محدود به ۳۸۴ مگ. ارکستریشن (زمان‌بندی، retry، داشبوردِ خطا روی سرورِ `prefect`:۴۲۰۰) تمیز از اجرا (Celery روی workerِ قدرتمند) جدا است.
- **`feature_selector.py`** — قاعده‌ی سرانگشتیِ ۱۰–۲۰ نمونه‌per-فیچر را پاس می‌دارد (۵۰۰ نمونه / ۶۰ فیچر ⇒ نسبتِ ۸ ⇒ بیش‌برازشِ قطعی). خط‌لوله‌ی دومرحله‌ای: **هرسِ همبستگی** (حذفِ عضوِ کم‌واریانس‌ترِ هر جفتِ `|corr|>0.95`) سپس **top-K بر gain importanceِ XGBoost** (با fallbackِ F-score-like `_quick_importance`)، بازگشتِ `FeatureSelectionResult`ِ کاملاً قابلِ‌ممیزی.
- **`determinism.py`** — تنها نقطه‌ی ورودِ seed: Python/`PYTHONHASHSEED`/NumPy/PyTorch(+CUDA)/TensorFlow را seed می‌کند، اختیاری cuDNNِ deterministic و `torch.use_deterministic_algorithms` را فعال. `verify_determinism` وضعیت را گزارش می‌دهد. درباره‌ی محدودیت‌ها صادق است: «CUDA کاملاً deterministic نیست — best-effort.»

---

### ۵.۱۵ جریانِ داده‌ی سرتاسری

```
yfinance / TimescaleDB
        │  (۵۰۰۰ کندل)
        ▼
FeatureEngine.build_features ──► ۶۰+ فیچر (بهداشتِ حجم‌صفر و inf)
        │
        ├─ build_target (fwd=4, ±0.1%) ──► target_class {short,neutral,long}
        └─ build_strength_target (fwd=4) ─► {weak,medium,strong}
        ▼
PurgedKFold(n=3, lookforward=4)  ── purge + embargo ──► فولدهای OOSِ صادقانه
        ▼
  XGBoost(جهت)   LightGBM(قدرت)   LSTM(قیمت، بودجه‌ی CPU)
        │              │                    │
        └──── scaler (Robust) ذخیره ────────┘
        ▼
financial_evaluate ──► Sharpe/PF/expectancy/DD ──► gate is_model_tradable
        ▼
  ذخیره‌ی joblib/.pt + scaler + calib_{symbol}  ──► رجیستریِ MLflow
        ▼
EnsemblePredictor._combine_predictions  (۶۰/۴۰، ML_SCORE_SHRINK=0.6، پرچمِ degraded)
        ▼
ml_score ∈ [۰،۱۰۰] ──► scorer (ML_TRUST=0.55) ──► موتورِ سیگنال
        ▲
drift_detector (KS فیچر + KL پیش‌بینی) ──► Prefectِ هفتگی → retrainِ Celery
```

هر فلش دفاع شده است: نشت با purging/embargo، عدمِ‌تطابقِ توزیع با scalerِ ذخیره‌شده، بیش‌اطمینان با Platt + shrinkageِ اِنسمبل + ML_TRUST، کهنگی با تشخیصِ drift، و OOM با خودغیرفعالیِ LSTMِ بی‌GPU و کانتینرِ ۲ گیگ. نتیجه یک زیرسیستمِ یادگیریِ ماشین است که *به‌صورتِ ساختاری صادق* است — ترجیح می‌دهد یک لبه‌ی فروتن، کالیبره و اندکی‌محافظه‌کار گزارش کند تا یک افسانه‌ی خیره‌کننده.

---

[⬅ 4. Market Analysis Engine](market-analysis.md) · [🏠 Home · خانه](../README.md) · [6. The Signal Engine — Decision Core & Lifecycle ➡](signal-engine.md)
