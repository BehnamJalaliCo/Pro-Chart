[⬅ 11. The Web Front‑Ends & Copy‑Trading](frontends.md) · [🏠 Home · خانه](../README.md) · [13. The Instagram Automation Suite ➡](instagram.md)

---

## 12. The VIP Academy & BazaarNama

> *An entire trading university and a self-hosted TradingView — with its own scripting language — bolted onto a production forex engine.*

CoinePro-FX is not only a signal engine and a Telegram channel. It ships a **complete, standalone, VIP educational platform** (`frontend/academy`, backed by `src/api/routes/academy.py`, a 3,134-line FastAPI router) and inside that platform a **fully in-house charting terminal called BazaarNama (بازارنما — "market-view")**, written from scratch on top of `lightweight-charts` v5, complete with a drawing toolbox, real-time forward-moving candles, AI-generated risk-reward setups, and **NamaScript** — a sandboxed, vectorized, Pine-Script-flavored domain-specific language that compiles and runs entirely in a Web Worker.

This chapter documents both halves exhaustively, with the real code that powers them.

---

### 12.1 The Academy at a glance

The academy is a separate React SPA (`frontend/academy/src/App.jsx`) with its own authentication realm (`AcademyStudent`, scope `academy`), its own subscription gating (`VipGate`, `PhoneGate`), and its own backend tables. The route map in `App.jsx` reveals the full surface area:

| Route | Page | Gate | What it is |
|---|---|---|---|
| `/` | `Catalog` | login | Lesson catalog + skill tree, 4 levels |
| `/lesson/:slug` | `Lesson` | login | Video lesson + quiz + notes + comments |
| `/mentor` | `Mentor` | **VIP** | AI mentor chat + smart study plan |
| `/coach` | `Coach` | **VIP** | Behavioral coach (analyzes *your* data) |
| `/glossary` | `Glossary` | login | Trading dictionary + flashcard mode |
| `/journal` | `Journal` | **VIP** | Trading journal + AI trade review |
| `/backtest` | `Backtest` | **VIP** | Practice simulator |
| `/bazaarnama` | `BazaarNama` | **VIP** | The in-house TradingView |
| `/paper` | `PaperTrade` | **VIP** | Virtual account |
| `/lab` | `StrategyLab` | **VIP** | Strategy backtest + optimizer + walk-forward |
| `/algo` | `AlgoLab` | **VIP** | Codegen (Python/JS/MQL5/Pine) + live signal |
| `/assessment` | `Assessment` | login | Level placement test |
| `/certificate/:level` | `Certificate` | **VIP** | Printable certificate |
| `/funded` | `Funded` | **VIP** | Prop-firm-style challenge |
| `/leaderboard`, `/achievements`, `/community`, `/bootcamp`, `/tools` | — | mixed | Gamification & community |

A global content-protection layer in `App.jsx` blocks right-click, `F12`, `Ctrl+Shift+I/J/C`, and `Ctrl+U/S/P` outside input fields, and every lesson page renders a **tiled username watermark** (`Watermark()` in `Lesson.jsx`) so leaked screenshots are traceable.

#### 160 video lessons

The curriculum is seeded from `src/academy/seed.py` ("سیدِ ۱۲۰ درسِ آکادمی…" — 120 base lessons imported from the bot's education dicts) and extended by `professional_seed.py`, reaching the full 160-lesson library across **four levels**: `beginner → intermediate → advanced → ai` (the "professional" track). Each lesson has a slug, an order within its level, a published flag, an attached video (served via `/video/{video_id}` with watermarking — see the academy video-pipeline memory), a quiz, ratings, threaded comments, and a server-synced personal note (`/lesson/{slug}/note`, GET/PUT). Progress is recorded per lesson (`POST /progress/{slug}`), which feeds streaks (`/streak`), achievements (`/achievements`), the leaderboard (`/leaderboard`), and the skill tree (`/lessons/skilltree`).

#### AI mentor & behavioral coach

`Mentor.jsx` is a full chat client (`POST /mentor/ask`, with persistent threads via `/mentor/threads` and `/mentor/thread/{id}`) plus a **smart study plan** generator (`/mentor/study-plan`, day-by-day, toggleable, deletable). The mentor answers in Markdown (rendered by a dependency-free `mdToHtml`), supports voice (mic + TTS), and offers Persian/English suggestion chips.

The **coach** (`/mentor/coach`, `/coach/dashboard`) is distinct: it ingests the student's *own* completed lessons, quiz scores, journal entries and practice records, finds the **weakest level** (lowest completion ratio with an unfinished lesson), and produces personalized coaching and next-lesson recommendations.

#### Journal, glossary, assessment, certificates

- **Journal** (`Journal.jsx`): tagged trade log (suggested tags: بریک‌اوت/ریتست/پولبک/رنج/ترند…), emotion tracking (آرام/ترس/طمع/انتقام/بی‌صبری/مطمئن), screenshot attachment, CSV export, stats (`/journal/stats`), and an **AI trade review** (`/journal/{jid}/ai-review`).
- **Glossary** (`Glossary.jsx`): categorized dictionary with a **flashcard mastery mode** persisted to `localStorage` (`cp_academy_glossary_mastery`).
- **Assessment** (`Assessment.jsx`): short adaptive placement quiz (`/assessment`, `/assessment/submit`) that outputs a suggested level and a personal learning path.
- **Certificate** (`Certificate.jsx`): printable, with a **deterministic verification code** derived from `username|level|coinepro` (a rolling hash → `CP-XXX-YYYYYYY`), publicly verifiable at `/public/verify/{code}`.

#### Paper trade, Strategy Lab, Algo Lab, Funded

- **PaperTrade** / `/paper/*`: a virtual account (`AcademyPaperPosition`) with open/close/partial-close, ATR-based sizing (`/paper/calc-size`), and settlement.
- **StrategyLab** (`StrategyLab.jsx`): runs `/strategy/backtest`, saves strategies, and exposes a parameter **optimizer** (`/strategy/optimize`) and a **walk-forward** test (`/strategy/walkforward`) with per-window `net_r` bar charts.
- **AlgoLab** (`AlgoLab.jsx`): turns an MA-cross+RSI+ATR config into source code in **Python / JavaScript / MQL5 / Pine** (`/algo/code`), computes a live signal on the last candle (`/algo/signal`), and can fire that signal straight onto the paper account.
- **Funded** (`/funded/*`): a prop-firm-style challenge over the paper account, with bronze/silver/gold rule tiers (target %, max drawdown %, min trades) and a claimable certificate.

#### Persistence model

Persistence is layered: **server-side** (per-`AcademyStudent` rows: progress, notes, journal, watchlists, layouts, scripts, alerts, AI signals, paper positions) and **client-side** (`localStorage` stores like `academy_strategylab`, `academy_algolab`, `cp_bookmarks`, and BazaarNama's `bn_workspace`). The terminal workspace also has a server endpoint pair (`/terminal/workspace`, GET/PUT). The result: a refresh, a logout, or switching devices never loses a student's setups.

---

### 12.2 BazaarNama — the in-house TradingView

`BazaarNama.jsx` is a ~1,000-line single-file terminal. It is gated behind VIP (`<Vip title="بازارنما ویژهٔ اعضای VIP است">`), branded with its own logo overlay, and renders fully right-to-left in Persian. Everything below is real, shipped behavior.

#### 12.2.1 Foundations: lightweight-charts v5, panes, markers

The chart is built once in a `useEffect` via `createChart`, with explicit (not `autoSize`) sizing driven by a `ResizeObserver` — the comment notes that `autoSize` returned zero height under the absolute-positioned DOM:

```js
const chart = createChart(el, {
  layout: { background: { color: TH.bg }, textColor: TH.text, fontFamily: 'Vazirmatn, sans-serif' },
  grid: { vertLines: { color: TH.grid }, horzLines: { color: TH.grid } },
  timeScale: { timeVisible: true, borderColor: TH.grid, rightOffset: 6 },
  rightPriceScale: { borderColor: TH.grid },
  crosshair: { mode: 0 },
});
```

It imports the v5 series primitives directly — `CandlestickSeries, LineSeries, AreaSeries, BarSeries, BaselineSeries, HistogramSeries, createSeriesMarkers` — and uses **native v5 panes**: sub-indicators (RSI, MACD, Stoch, ATR…) are added with `chart.addSeries(LineSeries, {...}, pane)` where `pane` is `idx + 1` (pane 0 is the price), then `chart.panes()[pane].setHeight(108)`. Markers use the v5 `createSeriesMarkers(series, [])` API, cached on the series as `s.__markers`.

#### 12.2.2 Chart types

Eight chart types are selectable from a dropdown (`CHART_TYPES`):

| id | Persian | Rendering |
|---|---|---|
| `candles` | کندل | `CandlestickSeries` |
| `hollow` | توخالی | hollow candles (transparent up body) |
| `heikin` | هایکین | Heikin-Ashi (computed by `heikin()`) |
| `bars` | میله | `BarSeries` |
| `line` | خطی | `LineSeries` |
| `area` | ناحیه | `AreaSeries` |
| `baseline` | پایه | `BaselineSeries` baselined at the first close |
| `step` | پلکانی | stepped line (`lineType: 1`) |

`buildPriceSeries()` switches on `chartType`, sets the right data shape (`valSeries` for line-likes, `ohlc` for candles/bars), and hands the series to the drawing layer.

#### 12.2.3 Indicators

`indicators.js` is a pure, series-oriented indicator library (every function returns arrays the same length as the candles, with `null` during warm-up). The `REGISTRY` exposes them to the UI, tagged `pane: 'main'` (overlay) or `pane: 'sub'` (separate pane), each with default inputs and a color:

- **Overlays**: MA/SMA, EMA, WMA, HMA, VWAP, Bollinger Bands, SuperTrend, Donchian, Keltner, Ichimoku.
- **Sub-pane oscillators**: RSI (30/70 guides), MACD (line+signal+histogram), Stochastic (20/80), ATR, CCI (±100), Williams %R, OBV, ADX.

Each active indicator gets a chip with a gear (settings dialog — edit period/mult/color live) and an ✕. `applyOverlays` and `applySubs` rebuild series on every load; multi-line indicators (Bollinger, Donchian, Keltner, Ichimoku) draw upper/basis/lower with dashed bands.

#### 12.2.4 The drawing toolbar

`drawings.js` implements `DrawingLayer`, a canvas overlay that stores points in **chart space** (`{t: unix, p: price}`) so drawings stay pinned through zoom/pan. The left toolbar (`TOOLS`) offers:

| Tool | Persian | Behavior |
|---|---|---|
| `cursor` | نشانگر | select / drag |
| `trend` | خط روند | trend line (segment) |
| `ray` | شعاع | ray (extends 4000× forward) |
| `hline` / `vline` | خط افقی/عمودی | horizontal / vertical |
| `rect` | مستطیل | filled rectangle |
| `fib` | فیبوناچی | retracement (0/.236/.382/.5/.618/.786/1) |
| `fibext` | فیبوناچی اکستنشن | extension (0/.618/1/1.272/1.618/2.618) |
| `channel` | کانال موازی | **3-click** parallel channel (filled) |
| `pitchfork` | چنگالِ اندروز | **3-click** Andrews pitchfork (median + tines) |
| `longshort` | لانگ/شورت | position tool with reward-risk boxes |
| `text` | متن | text label |

The **long/short** tool is a true reward-risk visual: from entry (`p0`) and stop (`p1`) it computes `risk = entry - stop` and a `target = entry + 2*risk`, painting a **green target box** and a **red stop box** with labeled lines (هدف 2R / ورود / حد ضرر). Extras: a **magnet** mode (`_snap` to the nearest candle O/H/L/C), a **Volume Profile** histogram (48 buckets, POC highlighted in amber), draggable **order lines** (entry/SL/TP with a live R:R readout), per-drawing color, select + `Delete`/`Backspace` removal, clear-last and clear-all. Drawings auto-persist: `dl.onChange = (drawings) => saveWS({ drawings })` and are restored ~500 ms after refresh.

#### 12.2.5 Real-time forward-moving candles

A 1.5-second poll loop (`api.bnPrices`) reads live mid prices from Redis (server route `/prices`, which pulls the same data-feed ticks). On each tick for the active symbol, `applyTick(mid)`:

- Guards against outliers (`> 20%` jump rejected).
- Computes the current bar boundary from wall-clock time (`Math.floor(now/sec)*sec`). **If a new bar started, it pushes a fresh candle and the whole chart scrolls forward** — candles move live. Otherwise it updates the forming candle's H/L/C.
- Redraws a dashed blue **LIVE** price line at the current mid.

When the market is closed the route returns empty and the header shows "بازار بسته". A WebSocket fast-path (`/ws/prices`) exists behind `VITE_BN_WS` for venues where it's proxied.

#### 12.2.6 Forward-projected reward-risk zones (up to TP3)

A signature feature: zones are projected **into the future**, not over past candles. `zoneWindow()` computes `{ from: lastT - sec, to: lastT + sec*16 }` — i.e. it extends ~16 bars to the right of the last candle. `drawSetupZones(entry, sl, tps, store)` then paints, using `BaselineSeries` baselined at `entry` with `autoscaleInfoProvider: () => null` (so the zones never distort the price scale):

- a faint **green box** (هدف) from entry up to the highest TP (TP3),
- a faint **red box** (حد ضرر) from entry to the SL,
- dashed green lines at **TP1/TP2/TP3** and a dashed red line at **SL**.

This same helper renders both NamaScript `riskreward()` output and AI signal setups.

#### 12.2.7 The AI signal system

The crown feature. Clicking **«سیگنالِ AI»** calls `POST /ai-signal` (`bazaarnama.py`). The backend:

1. **Quota & tier gate** — `_AI_QUOTA = {"vip": 2, "premium": 5}` signals/day; `_ai_used_today` counts today's rows; free tiers get a 403, exhausted quota a 429.
2. **Technical confluence** — pulls 220 candles, computes ATR(14), RSI(14), EMA20/50/200 and 20-bar swing high/low, then scores direction: `up = (ema20>ema50)+(ema50>ema200)+(rsi>50)+(price>ema20)` (and the mirror `dn`); `conf_base = 50 + 9*max(up,dn)`.
3. **Claude confluence** — sends a compact Persian market summary to `llm_client.complete(...)` with a system prompt forcing a single JSON line `{"direction","confidence","reason"}`. The final decision **prefers AI+technical agreement** (`+12` confidence when they agree, `-12` when they disagree), clamped to `[40, 93]`. If the market has no clear direction, it returns **422 and does not consume quota**.
4. **ATR-based levels** — `risk = max(atr*1.2, price*0.0015)`; entry/SL and TP1/TP2/TP3 at 1R/2R/3R; rounded by instrument scale (`_rnd`).
5. **Persistence** — stored as a `BnAiSignal` row (status `active`).

On the client (`getAiSignal`), the signal draws exact **entry/SL/TP1/TP2/TP3 price lines** plus the forward green/red zones, then `focusSetupView()` **zooms-to-fit** (~last 80 candles + 18 future bars). The right sidebar shows a confidence bar, the Persian reason, and the price table.

**Persistence, soft-delete, restore, and cost protection:**

- All recent signals live in a **sidebar list** (`/ai-signal/active`, returns up to 10 non-deleted, refreshed every 20 s). Each is **click-to-navigate** (`gotoSignal`): clicking switches the chart to that signal's symbol/timeframe and redraws + zooms; if it's already the current symbol/tf it draws in place without a reload.
- **Restore-after-refresh**: on every `load()` the active signal matching the current symbol/tf is fetched from the server and redrawn (the chart's series rebuild wipes prior drawing, so it is re-applied).
- **Soft-delete cost protection**: `DELETE /ai-signal/{id}` sets `status = "deleted"` rather than removing the row — the comment is explicit: *"the row stays so the daily quota is not refunded (the generation cost was already spent)."* `_ai_used_today` still counts it. The client's "clear from chart" (`clearAiSig`) only hides it; the quota is never given back.
- **Server-side TP/SL tracking**: a Celery task `check_ai_signals` (`src/bazaarnama/tasks.py`, every minute, browser-independent) walks all `active` signals against live Redis prices, marking `hit` = tp1/tp2/tp3/sl and closing the row on SL or TP3. The sidebar badges (`فعال / TP1 ✅ / TP3 🎯 / SL`) update from this.

#### 12.2.8 Workspace persistence, multi-chart, replay, alerts, paper trade

- **Workspace** (`bn_workspace` in `localStorage`): symbol, timeframe, chart type, theme, overlays, subs, NamaScript code, `scriptApplied`, and drawings are all saved and restored on refresh. Saved server-side **layouts** (`/layouts`) bundle the same plus drawings, with one default per student.
- **Multi-chart grid**: a `1× / 2× / 4×` toggle renders extra `MiniChart`s from the watchlist.
- **Replay**: historical bar-by-bar playback from the 55% mark, with `1×/2×/4×/8×` speeds (live ticks are suppressed during replay).
- **Alerts**: price-cross alerts (`/alerts`) evaluated **server-side every minute** by the `check_alerts` Celery task against live Redis prices, with a 1-hour cooldown; the UI badges them "رخ داد" when fired.
- **Quick paper trade**: the trade tab and the DOM ladder open draggable order lines and submit to the academy paper account (`api.paperOpen`).
- **Scale modes** (normal/log/percent), **fullscreen**, **light/dark theme**, **symbol search**, **watchlist**, and a **screener** of all symbols with live up/down arrows round out the terminal.

---

### 12.3 NamaScript — the sandboxed vectorized DSL

NamaScript (نمااسکریپت) is CoinePro's answer to Pine Script: a small, **vectorized** language where every series is a JS array, executed inside a **Web Worker sandbox** with **no DOM and no network**, terminated after a **5-second timeout** to defeat infinite loops. The entire engine is `namascript.js` (`runScript()` + an inlined `WORKER_SRC`).

#### 12.3.1 Execution model

`runScript(source, candles, inputs, timeoutMs=5000)` spawns a `Worker` from a Blob URL, posts the OHLCV arrays + inputs, and races the result against a timeout:

```js
const w = new Worker(workerUrl());
const to = setTimeout(() => { w.terminate(); resolve({ ok:false,
  error: 'اجرای اسکریپت بیش از حد طول کشید (حلقهٔ بی‌نهایت؟).' }); }, timeoutMs);
w.onmessage = (e) => { clearTimeout(to); w.terminate(); resolve(e.data); };
```

Inside the worker, the user's source is compiled with `new Function(...)`, receiving **every API symbol as an argument** (`ta`, `math`, `input`, `plot`, `plotshape`, `hline`, `bgcolor`, `riskreward`, `label`, `alertcondition`, `strategy`, the operators, `color`, `shape`, and the data series). Because the function only sees those injected names — and the worker has no `window`, `document`, `fetch`, or cookies — user code is contained. Output is collected into arrays (`plots`, `shapes`, `hlines`, `bgs`, `labels`, `alerts`, `inputs`, `zones`, `strat`) and posted back as `{ ok: true, ... }`, or `{ ok: false, error }` on exception.

#### 12.3.2 The `ta.*` indicator library

Re-implemented inside the worker (so it ships with the sandbox), the `ta` namespace covers:

`sma, ema, rma, wma, hma, vwma, vwap, stdev (dev), change, mom, roc, highest, lowest, rsi, tr, atr, cci, macd, bb, stoch, supertrend, crossover, crossunder, cross, rising, falling, barssince, valuewhen`.

Compound indicators return objects: `ta.macd → {macd, signal, hist}`, `ta.bb → {mid, upper, lower}`, `ta.stoch → {k, d}`, `ta.supertrend → {line, dir}`. A `math` helper namespace adds element-wise `abs/max/min/round/sqrt/pow/avg`, and convenience series `hl2`, `hlc3`, `ohlc4`, `bar_index` are precomputed.

#### 12.3.3 Operators

Because series are arrays, math/logic is done through helper functions that broadcast a scalar against an array (`arr()` fills) and apply element-wise:

`add, sub, mul, div, gt, lt, ge, le, and, or, iff(cond,a,b), nz(src,replacement)`, plus the cross helpers `crossover`, `crossunder`, `cross`.

#### 12.3.4 Output functions

| Function | Effect |
|---|---|
| `plot(src, name, color, width, style)` | line on the chart (rendered with `autoscaleInfoProvider:()=>null` so oscillators don't break the price scale) |
| `plotshape(cond, name, shape, color)` | up/down/circle markers at L/H of true bars |
| `plotchar(cond, name, color)` | circle marker shorthand |
| `hline(price, name, color)` | horizontal price line |
| `bgcolor(cond, color)` | background tint on true bars |
| `label.new(cond, src, text, color)` | text label markers |
| `alertcondition(cond, msg)` | named alert (also the backtest fallback) |
| `riskreward(entry, sl, tp1[, tp2, tp3])` | **forward green target box (to TP3) + red SL box** |
| `strategy.entry("long"\|"short", cond)` | strategy long/short entry |
| `strategy.exit / strategy.close(cond)` | exits |
| `input.int / input.float / input.bool(def, "title")` | typed inputs surfaced in the Inputs tab |

`riskreward` scans from the last bar backward for the most recent fully-defined `(entry, sl, tp1)` and emits a zone (with optional TP2/TP3) that the host renders via `drawSetupZones` — the same forward-projected boxes used by AI signals.

#### 12.3.5 The integrated backtester

`strategy.entry` makes a script a strategy. When present, the worker runs a position-based simulation: it walks bars, opens on long/short signals, closes on the opposite signal or an exit, and accumulates **net, win rate, profit factor, max drawdown, an equity curve, and the last 30 trades**. The result returns as `strategy` and the UI (`onBacktest`) renders a stats card with an inline SVG equity polyline. If a script has no `strategy.entry` but two `alertcondition`s (buy/sell), a **fallback backtester** in `BazaarNama.jsx` runs the same long-only simulation from the alert bars.

#### 12.3.6 The editor

`CodeEditor.jsx` is a from-scratch code editor (textarea + a synced highlighted `<pre>` overlay + a gutter):

- **Syntax highlighting** via a single tokenizer regex (comments grey, strings green, numbers amber, keywords purple, function-calls blue).
- **Autocomplete** from `COMPLETIONS` (all `ta.*`, operators, `input.*`, plot/strategy, colors, shapes), navigable with ↑/↓ and accepted with Enter/Tab.
- **Tab inserts two spaces**, `Ctrl/Cmd+Enter` runs the script, error lines highlight in the gutter.

The studio panel beside it has three tabs — **Console** (backtest card, plots, alerts), **Inputs** (auto-generated controls from `input(...)` declarations; changing one re-runs the script live), and **Reference** (the grouped function docs from `scriptlib.js`'s `REFERENCE`). A **Examples** dropdown loads ready-made scripts.

#### 12.3.7 Example NamaScript

A simple HMA cross with alerts:

```js
fastLen = input.int(9, "دورهٔ سریع")
slowLen = input.int(21, "دورهٔ کند")
fast = ta.hma(close, fastLen)
slow = ta.hma(close, slowLen)
plot(fast, "HMA سریع", color.aqua)
plot(slow, "HMA کند", color.orange)
buy  = crossover(fast, slow)
sell = crossunder(fast, slow)
plotshape(buy,  "خرید", shape.up,   color.green)
plotshape(sell, "فروش", shape.down, color.red)
alertcondition(buy,  "سیگنالِ خرید HMA")
alertcondition(sell, "سیگنالِ فروش HMA")
```

A **triple-confluence strategy** (trend + momentum + volatility) with a full ATR-based reward-risk setup and a backtestable entry — exactly the kind of setup the example library ships:

```js
// سه تأیید: روندِ EMA، سوپرترند، و مومنتومِ RSI
e  = ta.ema(close, 50)
st = ta.supertrend(10, 3)
r  = ta.rsi(close, 14)
a  = ta.atr(14)
long  = and(and(gt(close, e), gt(st.dir, 0)), gt(r, 52))
short = and(and(lt(close, e), lt(st.dir, 0)), lt(r, 48))
plot(e, "EMA50", color.orange)
plotshape(long,  "خرید", shape.up,   color.green)
plotshape(short, "فروش", shape.down, color.red)
// حد ضرر (قرمز) و سه هدف (سبز) بر پایهٔ ATR — R = فاصلهٔ ورود تا حد ضرر
slLong = sub(close, mul(a, 1.5))
tpLong = add(close, mul(a, 3))
riskreward(close, slLong, tpLong, add(tpLong, sub(close, slLong)), add(tpLong, mul(sub(close, slLong), 2)))
strategy.entry("long",  long)
strategy.entry("short", short)
```

A confluence **scoring** indicator (4 signals → strong setup when ≥3):

```js
s1 = gt(ta.ema(close,20), ta.ema(close,50))
s2 = gt(ta.rsi(close,14), 50)
s3 = gt(close, ta.vwap())
s4 = gt(ta.macd(close,12,26,9).hist, 0)
score = add(add(s1, s2), add(s3, s4))
plot(score, "امتیازِ صعودی (۰-۴)", color.aqua)
hline(3, "ستاپِ قوی", color.green)
buy = crossover(score, 3)
plotshape(buy, "ستاپِ خرید", shape.up, color.green)
alertcondition(buy, "امتیازِ همگرایی به ۳+ رسید")
```

### 12.4 NamaScript reference table

| Group | Symbols |
|---|---|
| **Moving averages** | `ta.sma · ta.ema · ta.wma · ta.hma · ta.rma · ta.vwma · ta.vwap` |
| **Oscillators** | `ta.rsi · ta.macd{macd,signal,hist} · ta.stoch{k,d} · ta.cci · ta.roc · ta.mom` |
| **Volatility/Trend** | `ta.atr · ta.stdev · ta.bb{mid,upper,lower} · ta.supertrend{line,dir} · ta.highest · ta.lowest` |
| **Signals** | `crossover · crossunder · cross · rising · falling · barssince · valuewhen` |
| **Operators** | `add sub mul div · gt lt ge le · and or · iff(c,a,b) · nz(src,r)` |
| **Inputs** | `input.int(def,"t") · input.float(def,"t") · input.bool(def,"t")` |
| **Draw/Alert** | `plot · plotshape · plotchar · hline · bgcolor · label.new · alertcondition · riskreward(entry,sl,tp1,tp2,tp3)` |
| **Strategy** | `strategy.entry("long"/"short",cond) · strategy.exit · strategy.close(cond)` |
| **Data** | `open high low close volume time · hl2 hlc3 ohlc4 bar_index · color.* shape.*` |

---

In sum, the VIP Academy turns CoinePro-FX into a self-contained trading university, and BazaarNama turns it into a self-hosted charting platform whose AI setups, forward-projected risk-reward zones, server-side signal tracking, and a real scripting language with its own sandbox and backtester would be at home in a commercial product — built entirely in-house, in Persian, on a single 16 GB server.

---

## ۱۲. آکادمیِ VIP و بازارنما

> *یک دانشگاهِ کاملِ معامله‌گری و یک تریدینگ‌ویوِ خودمیزبان — با زبانِ اسکریپت‌نویسیِ اختصاصیِ خودش — که روی یک موتورِ فارکسِ پروداکشن سوار شده است.*

کوین‌پرو-اف‌ایکس فقط یک موتورِ سیگنال و یک کانالِ تلگرام نیست. این پروژه یک **پلتفرمِ آموزشیِ کامل، مستقل و ویژهٔ VIP** را عرضه می‌کند (`frontend/academy`، با پشتیبانیِ `src/api/routes/academy.py` که یک روترِ FastAPIِ ۳٬۱۳۴ خطی است) و درونِ همان پلتفرم، یک **ترمینالِ چارتینگِ کاملاً درون‌خانگی به نامِ بازارنما** را — که از صفر روی `lightweight-charts` نسخهٔ ۵ نوشته شده، همراه با جعبه‌ابزارِ ترسیم، کندل‌های زنده و رو به جلو، ستاپ‌های ریسک/ریواردِ ساخته‌شده با هوشِ مصنوعی، و **نمااسکریپت** — یک زبانِ اختصاصیِ سندباکس‌شده، بُرداری و با طعمِ پاین‌اسکریپت که کاملاً درونِ یک Web Worker کامپایل و اجرا می‌شود.

این فصل هر دو نیمه را به‌طورِ کامل و با همان کدِ واقعیِ پشتشان مستند می‌کند.

---

### ۱۲.۱ آکادمی در یک نگاه

آکادمی یک اپلیکیشنِ تک‌صفحه‌ایِ React جداگانه است (`frontend/academy/src/App.jsx`) با محدودهٔ احرازِ هویتِ خودش (`AcademyStudent`، اسکوپِ `academy`)، گیتِ اشتراکِ خودش (`VipGate`, `PhoneGate`) و جدول‌های بک‌اندِ خودش. نقشهٔ مسیرها در `App.jsx` کلِ سطحِ کار را نشان می‌دهد:

| مسیر | صفحه | گیت | چیست |
|---|---|---|---|
| `/` | `Catalog` | ورود | فهرستِ درس‌ها + درختِ مهارت، ۴ سطح |
| `/lesson/:slug` | `Lesson` | ورود | درسِ ویدیویی + آزمون + یادداشت + نظرات |
| `/mentor` | `Mentor` | **VIP** | چتِ مربیِ AI + برنامهٔ مطالعهٔ هوشمند |
| `/coach` | `Coach` | **VIP** | کوچِ رفتاری (دادهٔ *خودت* را تحلیل می‌کند) |
| `/glossary` | `Glossary` | ورود | واژه‌نامه + حالتِ فلش‌کارت |
| `/journal` | `Journal` | **VIP** | ژورنالِ معاملاتی + بازبینیِ AIِ معامله |
| `/backtest` | `Backtest` | **VIP** | شبیه‌سازِ تمرین |
| `/bazaarnama` | `BazaarNama` | **VIP** | تریدینگ‌ویوِ درون‌خانگی |
| `/paper` | `PaperTrade` | **VIP** | حسابِ مجازی |
| `/lab` | `StrategyLab` | **VIP** | بک‌تست + بهینه‌ساز + تستِ پیش‌رونده |
| `/algo` | `AlgoLab` | **VIP** | تولیدِ کد (Python/JS/MQL5/Pine) + سیگنالِ زنده |
| `/assessment` | `Assessment` | ورود | آزمونِ سطح‌سنجی |
| `/certificate/:level` | `Certificate` | **VIP** | گواهی‌نامهٔ قابلِ‌چاپ |
| `/funded` | `Funded` | **VIP** | چالشِ سبکِ پراپ‌فرم |
| `/leaderboard`، `/achievements`، `/community`، `/bootcamp`، `/tools` | — | ترکیبی | گیمیفیکیشن و انجمن |

یک لایهٔ سراسریِ محافظتِ محتوا در `App.jsx`، راست‌کلیک، `F12`، `Ctrl+Shift+I/J/C` و `Ctrl+U/S/P` را بیرونِ فیلدهای ورودی مسدود می‌کند، و هر صفحهٔ درس یک **واترمارکِ کاشی‌شده از نامِ‌کاربری** را رندر می‌کند (`Watermark()` در `Lesson.jsx`) تا اسکرین‌شاتِ نشت‌یافته قابلِ‌ردیابی باشد.

#### ۱۶۰ درسِ ویدیویی

برنامهٔ درسی از `src/academy/seed.py` سید می‌شود («سیدِ ۱۲۰ درسِ آکادمی…» — ۱۲۰ درسِ پایه که از دیکشنری‌های آموزشِ رباتِ تلگرام وارد می‌شوند) و با `professional_seed.py` گسترش می‌یابد تا به کتابخانهٔ کاملِ ۱۶۰ درسی در **چهار سطح** برسد: `beginner → intermediate → advanced → ai` (مسیرِ «حرفه‌ای»). هر درس یک اسلاگ، یک ترتیب درونِ سطح، یک پرچمِ انتشار، یک ویدیوی پیوست (سرو از طریقِ `/video/{video_id}` با واترمارک — به مموریِ خطِ‌تولیدِ ویدیو رجوع کنید)، یک آزمون، امتیازدهی، نظراتِ رشته‌ای و یک یادداشتِ شخصیِ همگام‌شده با سرور دارد (`/lesson/{slug}/note`، GET/PUT). پیشرفت برای هر درس ثبت می‌شود (`POST /progress/{slug}`) و این، استریک‌ها (`/streak`)، دستاوردها (`/achievements`)، جدولِ امتیازات (`/leaderboard`) و درختِ مهارت (`/lessons/skilltree`) را تغذیه می‌کند.

#### مربیِ AI و کوچِ رفتاری

`Mentor.jsx` یک کلاینتِ چتِ کامل است (`POST /mentor/ask`، با رشته‌های پایدار از طریقِ `/mentor/threads` و `/mentor/thread/{id}`) به‌علاوهٔ یک سازندهٔ **برنامهٔ مطالعهٔ هوشمند** (`/mentor/study-plan`، روزبه‌روز، قابلِ‌تیک‌زدن، قابلِ‌حذف). مربی به‌صورتِ مارک‌داون پاسخ می‌دهد (رندرشده با `mdToHtml`ِ بدونِ‌وابستگی)، از صدا (میکروفون + متن‌به‌گفتار) پشتیبانی می‌کند و چیپ‌های پیشنهادِ فارسی/انگلیسی دارد.

**کوچ** (`/mentor/coach`, `/coach/dashboard`) متمایز است: درس‌های تکمیل‌شدهٔ *خودِ* دانشجو، نمراتِ آزمون، یادداشت‌های ژورنال و رکوردهای تمرین را می‌گیرد، **ضعیف‌ترین سطح** را پیدا می‌کند (کمترین نسبتِ تکمیل با یک درسِ ناتمام) و کوچینگِ شخصی و پیشنهادِ درسِ بعدی تولید می‌کند.

#### ژورنال، واژه‌نامه، سطح‌سنجی، گواهی‌نامه

- **ژورنال** (`Journal.jsx`): دفترِ معاملهٔ برچسب‌دار (برچسب‌های پیشنهادی: بریک‌اوت/ریتست/پولبک/رنج/ترند…)، ردیابیِ احساس (آرام/ترس/طمع/انتقام/بی‌صبری/مطمئن)، پیوستِ اسکرین‌شات، خروجیِ CSV، آمار (`/journal/stats`)، و یک **بازبینیِ AIِ معامله** (`/journal/{jid}/ai-review`).
- **واژه‌نامه** (`Glossary.jsx`): دیکشنریِ دسته‌بندی‌شده با یک **حالتِ تسلطِ فلش‌کارت** که در `localStorage` ذخیره می‌شود (`cp_academy_glossary_mastery`).
- **سطح‌سنجی** (`Assessment.jsx`): آزمونِ کوتاهِ تطبیقی (`/assessment`, `/assessment/submit`) که سطحِ پیشنهادی و یک مسیرِ یادگیریِ شخصی خروجی می‌دهد.
- **گواهی‌نامه** (`Certificate.jsx`): قابلِ‌چاپ، با یک **کدِ راستی‌آزماییِ قطعی** که از `username|level|coinepro` ساخته می‌شود (یک هشِ غلتان → `CP-XXX-YYYYYYY`)، به‌صورتِ عمومی در `/public/verify/{code}` قابلِ‌بررسی.

#### حسابِ مجازی، آزمایشگاهِ استراتژی، اتوماسیون، فاندد

- **PaperTrade** / `/paper/*`: یک حسابِ مجازی (`AcademyPaperPosition`) با باز/بستن/بستنِ جزئی، سایزدهیِ مبتنی بر ATR (`/paper/calc-size`) و تسویه.
- **StrategyLab** (`StrategyLab.jsx`): `/strategy/backtest` را اجرا می‌کند، استراتژی‌ها را ذخیره می‌کند، و یک **بهینه‌سازِ پارامتر** (`/strategy/optimize`) و یک **تستِ پیش‌رونده/walk-forward** (`/strategy/walkforward`) با نمودارهای میله‌ایِ `net_r` per پنجره عرضه می‌کند.
- **AlgoLab** (`AlgoLab.jsx`): یک پیکربندیِ کراسِ MA + RSI + ATR را به کدِ منبع در **Python / JavaScript / MQL5 / Pine** تبدیل می‌کند (`/algo/code`)، روی آخرین کندل یک سیگنالِ زنده محاسبه می‌کند (`/algo/signal`)، و می‌تواند آن سیگنال را مستقیماً روی حسابِ مجازی بفرستد.
- **Funded** (`/funded/*`): یک چالشِ سبکِ پراپ‌فرم روی حسابِ مجازی، با ردیف‌های قانونِ برنز/نقره/طلا (درصدِ هدف، حداکثر افتِ سرمایه، حداقل معاملات) و یک گواهیِ قابلِ‌دریافت.

#### مدلِ پایداری

پایداری لایه‌لایه است: **سمتِ سرور** (ردیف‌های per-`AcademyStudent`: پیشرفت، یادداشت، ژورنال، واچ‌لیست، چیدمان، اسکریپت، آلارم، سیگنال‌های AI، پوزیشن‌های مجازی) و **سمتِ کلاینت** (استورهای `localStorage` مثلِ `academy_strategylab`, `academy_algolab`, `cp_bookmarks` و `bn_workspace`ِ بازارنما). میزِکارِ ترمینال یک جفت اندپوینتِ سرور هم دارد (`/terminal/workspace`، GET/PUT). نتیجه: یک رفرش، یک خروج یا تعویضِ دستگاه هرگز ستاپ‌های دانشجو را از بین نمی‌برد.

---

### ۱۲.۲ بازارنما — تریدینگ‌ویوِ درون‌خانگی

`BazaarNama.jsx` یک ترمینالِ تک‌فایلیِ حدوداً ۱٬۰۰۰ خطی است. پشتِ گیتِ VIP قرار دارد (`<Vip title="بازارنما ویژهٔ اعضای VIP است">`)، با لوگوی خودش برندگذاری شده و کاملاً راست‌به‌چپ به فارسی رندر می‌شود. هرچه در ادامه می‌آید رفتارِ واقعی و عرضه‌شده است.

#### ۱۲.۲.۱ پایه‌ها: lightweight-charts v5، پِین‌ها، مارکرها

چارت یک‌بار در یک `useEffect` با `createChart` ساخته می‌شود، با سایزدهیِ صریح (نه `autoSize`) که با یک `ResizeObserver` هدایت می‌شود — کامنت توضیح می‌دهد که `autoSize` زیرِ DOMِ مطلق ارتفاعِ صفر برمی‌گرداند:

```js
const chart = createChart(el, {
  layout: { background: { color: TH.bg }, textColor: TH.text, fontFamily: 'Vazirmatn, sans-serif' },
  grid: { vertLines: { color: TH.grid }, horzLines: { color: TH.grid } },
  timeScale: { timeVisible: true, borderColor: TH.grid, rightOffset: 6 },
  crosshair: { mode: 0 },
});
```

پرایمیتیوهای سریِ v5 را مستقیم وارد می‌کند — `CandlestickSeries, LineSeries, AreaSeries, BarSeries, BaselineSeries, HistogramSeries, createSeriesMarkers` — و از **پِین‌های نیتیوِ v5** استفاده می‌کند: زیراندیکاتورها (RSI، MACD، Stoch، ATR…) با `chart.addSeries(LineSeries, {...}, pane)` اضافه می‌شوند که `pane` برابرِ `idx + 1` است (پِینِ ۰ قیمت است)، سپس `chart.panes()[pane].setHeight(108)`. مارکرها از API نیتیوِ v5 یعنی `createSeriesMarkers(series, [])` استفاده می‌کنند که روی سری به‌عنوانِ `s.__markers` کش می‌شود.

#### ۱۲.۲.۲ انواعِ چارت

هشت نوعِ چارت از یک دراپ‌داون قابلِ‌انتخاب‌اند (`CHART_TYPES`):

| شناسه | فارسی | رندر |
|---|---|---|
| `candles` | کندل | `CandlestickSeries` |
| `hollow` | توخالی | کندلِ توخالی (بدنهٔ صعودیِ شفاف) |
| `heikin` | هایکین | هایکین‌آشی (محاسبه با `heikin()`) |
| `bars` | میله | `BarSeries` |
| `line` | خطی | `LineSeries` |
| `area` | ناحیه | `AreaSeries` |
| `baseline` | پایه | `BaselineSeries` با خطِ پایه روی اولین close |
| `step` | پلکانی | خطِ پلکانی (`lineType: 1`) |

تابعِ `buildPriceSeries()` روی `chartType` سوییچ می‌کند، شکلِ دادهٔ درست را می‌سازد (`valSeries` برای خط‌مانندها، `ohlc` برای کندل/میله) و سری را به لایهٔ ترسیم تحویل می‌دهد.

#### ۱۲.۲.۳ اندیکاتورها

`indicators.js` یک کتابخانهٔ اندیکاتورِ خالص و سری‌محور است (هر تابع آرایه‌ای هم‌طولِ کندل‌ها برمی‌گرداند، با `null` در دورهٔ گرم‌شدن). رجیستری `REGISTRY` آن‌ها را به UI عرضه می‌کند، با برچسبِ `pane: 'main'` (اورلی) یا `pane: 'sub'` (پِینِ جدا)، هرکدام با ورودی‌های پیش‌فرض و یک رنگ:

- **اورلی‌ها**: MA/SMA، EMA، WMA، HMA، VWAP، باندِ بولینگر، سوپرترند، دونچیان، کلتنر، ایچیموکو.
- **نوسان‌گرهای زیرپِین**: RSI (راهنمای ۳۰/۷۰)، MACD (خط+سیگنال+هیستوگرام)، استوکاستیک (۲۰/۸۰)، ATR، CCI (±۱۰۰)، ویلیامز %R، OBV، ADX.

هر اندیکاتورِ فعال یک چیپ با چرخ‌دنده (دیالوگِ تنظیمات — ویرایشِ زندهٔ دوره/ضریب/رنگ) و یک ✕ می‌گیرد. `applyOverlays` و `applySubs` در هر بارگذاری سری‌ها را بازمی‌سازند؛ اندیکاتورهای چندخطی (بولینگر، دونچیان، کلتنر، ایچیموکو) بالا/میانه/پایین را با باندهای نقطه‌چین رسم می‌کنند.

#### ۱۲.۲.۴ جعبه‌ابزارِ ترسیم

`drawings.js` کلاسِ `DrawingLayer` را پیاده می‌کند، یک اورلیِ Canvas که نقاط را در **فضای چارت** ذخیره می‌کند (`{t: unix, p: price}`) تا ترسیم‌ها در زوم/پن ثابت بمانند. نوارِ ابزارِ سمتِ چپ (`TOOLS`) اینها را ارائه می‌دهد:

| ابزار | فارسی | رفتار |
|---|---|---|
| `cursor` | نشانگر | انتخاب / درگ |
| `trend` | خط روند | خطِ روند (پاره‌خط) |
| `ray` | شعاع | شعاع (۴۰۰۰ برابر به جلو) |
| `hline` / `vline` | خط افقی/عمودی | افقی / عمودی |
| `rect` | مستطیل | مستطیلِ پرشده |
| `fib` | فیبوناچی | اصلاحی (۰/.۲۳۶/.۳۸۲/.۵/.۶۱۸/.۷۸۶/۱) |
| `fibext` | فیبوناچی اکستنشن | گسترشی (۰/.۶۱۸/۱/۱.۲۷۲/۱.۶۱۸/۲.۶۱۸) |
| `channel` | کانالِ موازی | **۳ کلیک**، کانالِ موازیِ پرشده |
| `pitchfork` | چنگالِ اندروز | **۳ کلیک**، چنگالِ اندروز (مدین + شاخه‌ها) |
| `longshort` | لانگ/شورت | ابزارِ موقعیت با جعبه‌های ریسک/ریوارد |
| `text` | متن | برچسبِ متنی |

ابزارِ **لانگ/شورت** یک نمایشِ واقعیِ ریسک/ریوارد است: از ورود (`p0`) و حد ضرر (`p1`) مقدارِ `risk = entry - stop` و یک `target = entry + 2*risk` را حساب می‌کند و یک **جعبهٔ سبزِ هدف** و یک **جعبهٔ قرمزِ حد ضرر** با خطوطِ برچسب‌دار (هدف 2R / ورود / حد ضرر) می‌کشد. اضافه‌ها: حالتِ **مگنت** (`_snap` به نزدیک‌ترین O/H/L/Cِ کندل)، هیستوگرامِ **پروفایلِ حجم** (۴۸ سطل، POC با نارنجی برجسته)، **خطوطِ سفارشِ قابلِ‌درگ** (entry/SL/TP با خواندنِ زندهٔ R:R)، رنگِ per-ترسیم، انتخاب + حذف با `Delete`/`Backspace`، پاکِ‌آخر و پاکِ‌همه. ترسیم‌ها خودکار پایدار می‌شوند: `dl.onChange = (drawings) => saveWS({ drawings })` و حدوداً ۵۰۰ میلی‌ثانیه پس از رفرش بازیابی می‌شوند.

#### ۱۲.۲.۵ کندل‌های زنده و رو به جلو

یک حلقهٔ نظرسنجیِ ۱.۵ ثانیه‌ای (`api.bnPrices`) قیمتِ میدِ زنده را از Redis می‌خواند (روتِ سرور `/prices` که همان تیک‌های data-feed را می‌کشد). در هر تیک برای نمادِ فعال، `applyTick(mid)`:

- در برابرِ داده‌های پرت محافظت می‌کند (پرشِ `> ۲۰٪` رد می‌شود).
- مرزِ کندلِ جاری را از ساعتِ دیواری حساب می‌کند (`Math.floor(now/sec)*sec`). **اگر کندلِ جدیدی شروع شده باشد، یک کندلِ تازه push می‌شود و کلِ چارت رو به جلو حرکت می‌کند** — کندل‌ها لایو جابه‌جا می‌شوند. در غیرِ این‌صورت H/L/Cِ کندلِ در حالِ شکل‌گیری به‌روزرسانی می‌شود.
- یک خطِ قیمتِ آبیِ نقطه‌چینِ **LIVE** را روی میدِ جاری دوباره می‌کشد.

وقتی بازار بسته است، روت خالی برمی‌گردد و هدر «بازار بسته» نشان می‌دهد. یک مسیرِ سریعِ WebSocket (`/ws/prices`) پشتِ `VITE_BN_WS` برای جاهایی که proxy شده وجود دارد.

#### ۱۲.۲.۶ ناحیه‌های ریسک/ریواردِ پروجکشن‌شدهٔ رو به جلو (تا TP3)

یک ویژگیِ امضایی: ناحیه‌ها **به آینده** پروجکت می‌شوند، نه روی کندل‌های گذشته. تابعِ `zoneWindow()` مقدارِ `{ from: lastT - sec, to: lastT + sec*16 }` را حساب می‌کند — یعنی حدوداً ۱۶ کندل به سمتِ راستِ آخرین کندل امتداد می‌دهد. سپس `drawSetupZones(entry, sl, tps, store)` با استفاده از `BaselineSeries` با خطِ پایه روی `entry` و `autoscaleInfoProvider: () => null` (تا ناحیه‌ها هرگز مقیاسِ قیمت را به‌هم نزنند) اینها را می‌کشد:

- یک **جعبهٔ سبزِ** کم‌رنگ (هدف) از ورود تا بالاترین TP (TP3)،
- یک **جعبهٔ قرمزِ** کم‌رنگ (حد ضرر) از ورود تا SL،
- خطوطِ نقطه‌چینِ سبز روی **TP1/TP2/TP3** و یک خطِ نقطه‌چینِ قرمز روی **SL**.

همین تابعِ کمکی هم خروجیِ `riskreward()`ِ نمااسکریپت و هم ستاپ‌های سیگنالِ AI را رندر می‌کند.

#### ۱۲.۲.۷ سیستمِ سیگنالِ AI

ویژگیِ تاجی. کلیکِ **«سیگنالِ AI»** اندپوینتِ `POST /ai-signal` را صدا می‌زند (`bazaarnama.py`). بک‌اند:

۱. **گیتِ سهمیه و تیر** — `_AI_QUOTA = {"vip": 2, "premium": 5}` سیگنال در روز؛ `_ai_used_today` ردیف‌های امروز را می‌شمارد؛ تیرهای رایگان 403 و سهمیهٔ تمام‌شده 429 می‌گیرند.
۲. **همگراییِ تکنیکال** — ۲۲۰ کندل می‌کشد، ATR(14)، RSI(14)، EMA20/50/200 و سقف/کفِ ۲۰ کندلی را حساب می‌کند، سپس جهت را امتیاز می‌دهد: `up = (ema20>ema50)+(ema50>ema200)+(rsi>50)+(price>ema20)` (و قرینه‌اش `dn`)؛ `conf_base = 50 + 9*max(up,dn)`.
۳. **همگراییِ Claude** — یک خلاصهٔ فشردهٔ فارسیِ بازار را به `llm_client.complete(...)` می‌فرستد با یک سیستم‌پرامپت که یک خطِ JSON یعنی `{"direction","confidence","reason"}` را اجباری می‌کند. تصمیمِ نهایی **همگراییِ AI+تکنیکال را ترجیح می‌دهد** (وقتی موافق‌اند +۱۲ اطمینان، وقتی مخالف‌اند −۱۲)، محدود به `[40, 93]`. اگر بازار جهتِ روشنی نداشته باشد، **422 برمی‌گرداند و سهمیه مصرف نمی‌شود**.
۴. **سطوحِ مبتنی بر ATR** — `risk = max(atr*1.2, price*0.0015)`؛ ورود/SL و TP1/TP2/TP3 روی 1R/2R/3R؛ گردشده با مقیاسِ نماد (`_rnd`).
۵. **پایداری** — به‌عنوانِ یک ردیفِ `BnAiSignal` (وضعیتِ `active`) ذخیره می‌شود.

در کلاینت (`getAiSignal`)، سیگنال **خطوطِ دقیقِ قیمتِ ورود/SL/TP1/TP2/TP3** به‌علاوهٔ ناحیه‌های سبز/قرمزِ رو به جلو را می‌کشد، سپس `focusSetupView()` **زوم‌متناسب** می‌کند (حدوداً ۸۰ کندلِ آخر + ۱۸ کندلِ آینده). نوارِ کناریِ راست یک نوارِ اطمینان، دلیلِ فارسی و جدولِ قیمت‌ها را نشان می‌دهد.

**پایداری، حذفِ نرم، بازیابی و محافظتِ هزینه:**

- همهٔ سیگنال‌های اخیر در یک **فهرستِ نوارِ کناری** زندگی می‌کنند (`/ai-signal/active`، تا ۱۰ سیگنالِ حذف‌نشده برمی‌گرداند، هر ۲۰ ثانیه تازه می‌شود). هرکدام **کلیک‌برای‌رفتن** است (`gotoSignal`): کلیک، چارت را به نماد/تایم‌فریمِ آن سیگنال سوییچ و دوباره رسم و زوم می‌کند؛ اگر همان نماد/تایم‌فریمِ جاری باشد، بدونِ بارگذاریِ مجدد همان‌جا رسم می‌شود.
- **بازیابی پس از رفرش**: در هر `load()`، سیگنالِ فعالی که با نماد/تایم‌فریمِ جاری مطابقت دارد از سرور گرفته و دوباره رسم می‌شود (بازسازیِ سری‌های چارت ترسیمِ قبلی را پاک می‌کند، پس دوباره اعمال می‌شود).
- **محافظتِ هزینه با حذفِ نرم**: `DELETE /ai-signal/{id}` به‌جای حذفِ ردیف، `status = "deleted"` می‌گذارد — کامنت صریح است: *«ردیف می‌مانَد تا سهمیهٔ روزانه پس‌داده نشود (هزینهٔ تولید قبلاً صرف شده).»* `_ai_used_today` همچنان آن را می‌شمارد. «پاک‌کردنِ سیگنال از چارت»ِ کلاینت (`clearAiSig`) فقط آن را پنهان می‌کند؛ سهمیه هرگز برنمی‌گردد.
- **ردیابیِ TP/SL سمتِ سرور**: یک تسکِ Celery به نامِ `check_ai_signals` (`src/bazaarnama/tasks.py`، هر دقیقه، مستقل از مرورگر) همهٔ سیگنال‌های `active` را روی قیمتِ زندهٔ Redis می‌پیماید، `hit` را tp1/tp2/tp3/sl علامت می‌زند و ردیف را روی SL یا TP3 می‌بندد. بَج‌های نوارِ کناری (`فعال / TP1 ✅ / TP3 🎯 / SL`) از همین به‌روز می‌شوند.

#### ۱۲.۲.۸ پایداریِ میزِکار، چند-چارت، بازپخش، آلارم، ترید مجازی

- **میزِکار** (`bn_workspace` در `localStorage`): نماد، تایم‌فریم، نوعِ چارت، تم، اورلی‌ها، سابها، کدِ نمااسکریپت، `scriptApplied` و ترسیم‌ها همگی ذخیره و در رفرش بازیابی می‌شوند. **چیدمان‌های** ذخیره‌شدهٔ سمتِ سرور (`/layouts`) همین‌ها به‌علاوهٔ ترسیم‌ها را بسته‌بندی می‌کنند، با یک پیش‌فرض per دانشجو.
- **شبکهٔ چند-چارت**: یک تاگلِ `۱× / ۲× / ۴×`، `MiniChart`های اضافی را از واچ‌لیست رندر می‌کند.
- **بازپخش**: پخشِ تاریخیِ کندل‌به‌کندل از نقطهٔ ۵۵٪، با سرعت‌های `۱×/۲×/۴×/۸×` (تیک‌های زنده در حینِ بازپخش سرکوب می‌شوند).
- **آلارم‌ها**: آلارم‌های عبور از قیمت (`/alerts`) که **سمتِ سرور هر دقیقه** با تسکِ Celery به نامِ `check_alerts` روی قیمتِ زندهٔ Redis ارزیابی می‌شوند، با کول‌داونِ ۱ ساعته؛ UI هنگامِ برخورد آن‌ها را «رخ داد» بَج می‌زند.
- **ترید مجازیِ سریع**: تبِ ترید و نردبانِ DOM، خطوطِ سفارشِ قابلِ‌درگ را باز می‌کنند و به حسابِ مجازیِ آکادمی می‌فرستند (`api.paperOpen`).
- **حالت‌های مقیاس** (عادی/لگاریتمی/درصدی)، **تمام‌صفحه**، **تمِ روشن/تیره**، **جستجوی نماد**، **واچ‌لیست**، و یک **اسکنر** از همهٔ نمادها با فلش‌های زندهٔ بالا/پایین، ترمینال را کامل می‌کنند.

---

### ۱۲.۳ نمااسکریپت — DSLِ بُرداریِ سندباکس‌شده

نمااسکریپت پاسخِ کوین‌پرو به پاین‌اسکریپت است: یک زبانِ کوچک و **بُرداری** که در آن هر سری یک آرایهٔ JS است، درونِ یک **سندباکسِ Web Worker** اجرا می‌شود با **بدونِ DOM و بدونِ شبکه**، و پس از **تایم‌اوتِ ۵ ثانیه** خاتمه می‌یابد تا حلقه‌های بی‌نهایت را خنثی کند. کلِ موتور `namascript.js` است (`runScript()` + یک `WORKER_SRC`ِ درون‌خط).

#### ۱۲.۳.۱ مدلِ اجرا

`runScript(source, candles, inputs, timeoutMs=5000)` یک `Worker` از یک Blob URL می‌سازد، آرایه‌های OHLCV + ورودی‌ها را post می‌کند و نتیجه را با یک تایم‌اوت مسابقه می‌دهد:

```js
const w = new Worker(workerUrl());
const to = setTimeout(() => { w.terminate(); resolve({ ok:false,
  error: 'اجرای اسکریپت بیش از حد طول کشید (حلقهٔ بی‌نهایت؟).' }); }, timeoutMs);
w.onmessage = (e) => { clearTimeout(to); w.terminate(); resolve(e.data); };
```

درونِ ورکر، سورسِ کاربر با `new Function(...)` کامپایل می‌شود و **هر نمادِ API را به‌عنوانِ آرگومان** دریافت می‌کند (`ta`، `math`، `input`، `plot`، `plotshape`، `hline`، `bgcolor`، `riskreward`، `label`، `alertcondition`، `strategy`، عملگرها، `color`، `shape` و سری‌های داده). چون تابع فقط همان نام‌های تزریق‌شده را می‌بیند — و ورکر هیچ `window`، `document`، `fetch` یا کوکی ندارد — کدِ کاربر مهار می‌شود. خروجی در آرایه‌ها جمع می‌شود (`plots`, `shapes`, `hlines`, `bgs`, `labels`, `alerts`, `inputs`, `zones`, `strat`) و به‌صورتِ `{ ok: true, ... }` پس فرستاده می‌شود، یا در صورتِ خطا `{ ok: false, error }`.

#### ۱۲.۳.۲ کتابخانهٔ اندیکاتورِ `ta.*`

درونِ ورکر بازپیاده‌سازی شده (تا با سندباکس عرضه شود)، فضای‌نامِ `ta` اینها را پوشش می‌دهد:

`sma, ema, rma, wma, hma, vwma, vwap, stdev (dev), change, mom, roc, highest, lowest, rsi, tr, atr, cci, macd, bb, stoch, supertrend, crossover, crossunder, cross, rising, falling, barssince, valuewhen`.

اندیکاتورهای مرکب آبجکت برمی‌گردانند: `ta.macd → {macd, signal, hist}`، `ta.bb → {mid, upper, lower}`، `ta.stoch → {k, d}`، `ta.supertrend → {line, dir}`. یک فضای‌نامِ کمکیِ `math` عملگرهای عنصر-به-عنصرِ `abs/max/min/round/sqrt/pow/avg` را اضافه می‌کند، و سری‌های آمادهٔ `hl2`, `hlc3`, `ohlc4`, `bar_index` از پیش محاسبه می‌شوند.

#### ۱۲.۳.۳ عملگرها

چون سری‌ها آرایه‌اند، ریاضی/منطق از طریقِ توابعِ کمکی‌ای انجام می‌شود که یک اسکالر را در برابرِ آرایه پخش می‌کنند (`arr()` پر می‌کند) و عنصر-به-عنصر اعمال می‌کنند:

`add, sub, mul, div, gt, lt, ge, le, and, or, iff(cond,a,b), nz(src,replacement)`، به‌علاوهٔ کمکی‌های کراس یعنی `crossover`, `crossunder`, `cross`.

#### ۱۲.۳.۴ توابعِ خروجی

| تابع | اثر |
|---|---|
| `plot(src, name, color, width, style)` | خط روی چارت (با `autoscaleInfoProvider:()=>null` تا نوسان‌گرها مقیاسِ قیمت را نشکنند) |
| `plotshape(cond, name, shape, color)` | مارکرهای up/down/circle روی L/Hِ کندل‌های درست |
| `plotchar(cond, name, color)` | میان‌برِ مارکرِ دایره |
| `hline(price, name, color)` | خطِ افقیِ قیمت |
| `bgcolor(cond, color)` | رنگِ پس‌زمینه روی کندل‌های درست |
| `label.new(cond, src, text, color)` | مارکرهای برچسبِ متنی |
| `alertcondition(cond, msg)` | آلارمِ نام‌دار (همچنین fallbackِ بک‌تست) |
| `riskreward(entry, sl, tp1[, tp2, tp3])` | **جعبهٔ سبزِ هدف (تا TP3) + جعبهٔ قرمزِ SLِ رو به جلو** |
| `strategy.entry("long"\|"short", cond)` | ورودِ لانگ/شورتِ استراتژی |
| `strategy.exit / strategy.close(cond)` | خروج‌ها |
| `input.int / input.float / input.bool(def, "title")` | ورودی‌های نوع‌دار که در تبِ ورودی‌ها ظاهر می‌شوند |

`riskreward` از آخرین کندل به عقب به‌دنبالِ تازه‌ترین `(entry, sl, tp1)`ِ کاملاً تعریف‌شده می‌گردد و یک ناحیه (با TP2/TP3ِ اختیاری) می‌سازد که میزبان آن را با `drawSetupZones` رندر می‌کند — همان جعبه‌های پروجکشن‌شدهٔ رو به جلو که سیگنال‌های AI استفاده می‌کنند.

#### ۱۲.۳.۵ بک‌تسترِ یکپارچه

`strategy.entry` یک اسکریپت را به استراتژی تبدیل می‌کند. وقتی حاضر باشد، ورکر یک شبیه‌سازیِ موقعیت‌محور اجرا می‌کند: کندل‌ها را می‌پیماید، روی سیگنالِ لانگ/شورت باز می‌کند، روی سیگنالِ مخالف یا یک خروج می‌بندد، و **سودِ خالص، نرخِ برد، فاکتورِ سود، حداکثر افت، یک منحنیِ سرمایه و ۳۰ معاملهٔ آخر** را جمع می‌کند. نتیجه به‌عنوانِ `strategy` برمی‌گردد و UI (`onBacktest`) یک کارتِ آمار با یک خطِ سرمایهٔ SVGِ درون‌خطی رندر می‌کند. اگر اسکریپتی `strategy.entry` نداشته باشد ولی دو `alertcondition` (خرید/فروش) داشته باشد، یک **بک‌تسترِ fallback** در `BazaarNama.jsx` همان شبیه‌سازیِ فقط-لانگ را از کندل‌های آلارم اجرا می‌کند.

#### ۱۲.۳.۶ ویرایشگر

`CodeEditor.jsx` یک ویرایشگرِ کدِ از-صفر است (textarea + یک `<pre>`ِ هایلایت‌شدهٔ همگام + یک ستونِ شماره‌خط):

- **هایلایتِ نحوی** با یک رجکسِ توکن‌سازِ واحد (کامنت خاکستری، رشته سبز، عدد کهربایی، کلیدواژه بنفش، فراخوانیِ تابع آبی).
- **اتوکامپلیت** از `COMPLETIONS` (همهٔ `ta.*`، عملگرها، `input.*`، plot/strategy، رنگ‌ها، شکل‌ها)، با ↑/↓ قابلِ‌پیمایش و با Enter/Tab قابلِ‌پذیرش.
- **Tab دو فاصله** می‌گذارد، `Ctrl/Cmd+Enter` اسکریپت را اجرا می‌کند، خطوطِ خطا در ستونِ شماره‌خط قرمز می‌شوند.

پنلِ استودیو کنارِ آن سه تب دارد — **کنسول** (کارتِ بک‌تست، رسم‌ها، آلارم‌ها)، **ورودی‌ها** (کنترل‌های خودکارساخته از اعلانِ `input(...)`؛ تغییرِ یکی، اسکریپت را زنده بازاجرا می‌کند) و **مرجع** (مستنداتِ گروه‌بندی‌شدهٔ توابع از `REFERENCE`ِ `scriptlib.js`). یک دراپ‌داونِ **نمونه‌ها** اسکریپت‌های آمادهٔ ساخته‌شده را بارگذاری می‌کند.

#### ۱۲.۳.۷ نمونهٔ نمااسکریپت

یک کراسِ سادهٔ HMA با آلارم:

```js
fastLen = input.int(9, "دورهٔ سریع")
slowLen = input.int(21, "دورهٔ کند")
fast = ta.hma(close, fastLen)
slow = ta.hma(close, slowLen)
plot(fast, "HMA سریع", color.aqua)
plot(slow, "HMA کند", color.orange)
buy  = crossover(fast, slow)
sell = crossunder(fast, slow)
plotshape(buy,  "خرید", shape.up,   color.green)
plotshape(sell, "فروش", shape.down, color.red)
alertcondition(buy,  "سیگنالِ خرید HMA")
alertcondition(sell, "سیگنالِ فروش HMA")
```

یک **استراتژیِ همگراییِ سه‌گانه** (روند + مومنتوم + نوسان) با یک ستاپِ کاملِ ریسک/ریواردِ مبتنی بر ATR و یک ورودِ قابلِ‌بک‌تست — دقیقاً همان نوع ستاپی که کتابخانهٔ نمونه‌ها عرضه می‌کند:

```js
// سه تأیید: روندِ EMA، سوپرترند، و مومنتومِ RSI
e  = ta.ema(close, 50)
st = ta.supertrend(10, 3)
r  = ta.rsi(close, 14)
a  = ta.atr(14)
long  = and(and(gt(close, e), gt(st.dir, 0)), gt(r, 52))
short = and(and(lt(close, e), lt(st.dir, 0)), lt(r, 48))
plot(e, "EMA50", color.orange)
plotshape(long,  "خرید", shape.up,   color.green)
plotshape(short, "فروش", shape.down, color.red)
// حد ضرر (قرمز) و سه هدف (سبز) بر پایهٔ ATR — R = فاصلهٔ ورود تا حد ضرر
slLong = sub(close, mul(a, 1.5))
tpLong = add(close, mul(a, 3))
riskreward(close, slLong, tpLong, add(tpLong, sub(close, slLong)), add(tpLong, mul(sub(close, slLong), 2)))
strategy.entry("long",  long)
strategy.entry("short", short)
```

یک اندیکاتورِ **امتیازدهیِ همگرایی** (۴ سیگنال → ستاپِ قوی وقتی ≥۳):

```js
s1 = gt(ta.ema(close,20), ta.ema(close,50))
s2 = gt(ta.rsi(close,14), 50)
s3 = gt(close, ta.vwap())
s4 = gt(ta.macd(close,12,26,9).hist, 0)
score = add(add(s1, s2), add(s3, s4))
plot(score, "امتیازِ صعودی (۰-۴)", color.aqua)
hline(3, "ستاپِ قوی", color.green)
buy = crossover(score, 3)
plotshape(buy, "ستاپِ خرید", shape.up, color.green)
alertcondition(buy, "امتیازِ همگرایی به ۳+ رسید")
```

### ۱۲.۴ جدولِ مرجعِ نمااسکریپت

| گروه | نمادها |
|---|---|
| **میانگین‌ها** | `ta.sma · ta.ema · ta.wma · ta.hma · ta.rma · ta.vwma · ta.vwap` |
| **نوسان‌گرها** | `ta.rsi · ta.macd{macd,signal,hist} · ta.stoch{k,d} · ta.cci · ta.roc · ta.mom` |
| **نوسان/روند** | `ta.atr · ta.stdev · ta.bb{mid,upper,lower} · ta.supertrend{line,dir} · ta.highest · ta.lowest` |
| **سیگنال** | `crossover · crossunder · cross · rising · falling · barssince · valuewhen` |
| **عملگرها** | `add sub mul div · gt lt ge le · and or · iff(c,a,b) · nz(src,r)` |
| **ورودی‌ها** | `input.int(def,"t") · input.float(def,"t") · input.bool(def,"t")` |
| **رسم/هشدار** | `plot · plotshape · plotchar · hline · bgcolor · label.new · alertcondition · riskreward(entry,sl,tp1,tp2,tp3)` |
| **استراتژی** | `strategy.entry("long"/"short",cond) · strategy.exit · strategy.close(cond)` |
| **داده** | `open high low close volume time · hl2 hlc3 ohlc4 bar_index · color.* shape.*` |

---

به‌طورِ خلاصه، آکادمیِ VIP کوین‌پرو-اف‌ایکس را به یک دانشگاهِ معامله‌گریِ خودبسنده بدل می‌کند، و بازارنما آن را به یک پلتفرمِ چارتینگِ خودمیزبان تبدیل می‌کند که ستاپ‌های AI، ناحیه‌های ریسک/ریواردِ پروجکشن‌شدهٔ رو به جلو، ردیابیِ سیگنالِ سمتِ سرور، و یک زبانِ اسکریپت‌نویسیِ واقعی با سندباکس و بک‌تسترِ خودش، در یک محصولِ تجاری هم جای می‌گرفت — همه به‌طورِ کامل درون‌خانگی، به فارسی، روی یک سرورِ ۱۶ گیگابایتیِ واحد، ساخته شده است.

---

[⬅ 11. The Web Front‑Ends & Copy‑Trading](frontends.md) · [🏠 Home · خانه](../README.md) · [13. The Instagram Automation Suite ➡](instagram.md)
