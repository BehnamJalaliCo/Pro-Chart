<div align="center">

# Pro‑Chart — TradingView‑Class Build Specification
## مشخصاتِ مهندسیِ ساختِ پلتفرمِ نموداریِ هم‌ترازِ TradingView

**سندِ مرجعِ پیاده‌سازی برای `Pro-Chart.ir`** — هر ناحیه، ابزار، اندیکاتور، رفتار و قابلیت، با جزئیاتِ چیدمان + وضعیتِ فعلیِ کدِ ما + نقشهٔ دقیقِ پیاده‌سازی.

</div>

> **ماهیتِ این سند.** این یک **مشخصاتِ فنیِ فیچر/رفتار** برای ساختِ محصولِ **خودمان** روی موتورِ متن‌بازِ **lightweight‑charts v5** + React + زبانِ اختصاصیِ **نمااسکریپت** است. هیچ کدِ اختصاصی/asset/CSS از TradingView در آن بازتولید نشده؛ فقط **فیچر و رفتار** (که قابلِ‌حمایتِ کپی‌رایت نیست) مستند و برای پیاده‌سازی روی استکِ ما نقشه‌برداری شده‌اند. هر بخش سه قسمت دارد: **رفتارِ هدف · وضعیتِ فعلیِ ما (با ارجاعِ خطِ کد) · نقشهٔ پیاده‌سازی.**

> **منبعِ داده‌ها.** همهٔ ادعاهای «وضعیتِ فعلی» مستقیماً از کدِ مخزن استخراج شده‌اند: `frontend/academy/src/pages/BazaarNama.jsx`، `frontend/academy/src/bazaarnama/{namascript.js, scriptlib.js, indicators.js, drawings.js, chartbuilders.js, CodeEditor.jsx}`، روت‌های `src/api/routes/bazaarnama.py`، تسکِ `src/bazaarnama/tasks.py`، و کاتالوگ‌های `docs/TRADINGVIEW_REFERENCE.md` + `docs/PINESCRIPT_REFERENCE.md`.

---

## 📋 فهرستِ مطالب

| # | بخش | محور |
|---|---|---|
| 1 | [UI Shell, Layout & Theming](#1-ui-shell-layout--theming) | چیدمانِ ۵‌ناحیه، ابعاد، تم، ریسپانسیو، RTL |
| 2 | [Chart Types — Catalog & Build Algorithms](#2-chart-types--complete-catalog--build-algorithms) | ۲۱+ نوعِ چارت + الگوریتمِ ساخت |
| 3 | [Timeframes, Axes, Scales, Crosshair & Sessions](#3-timeframes-axes-price-scales-crosshair--sessions) | تایم‌فریم‌ها، مقیاس‌ها، کراسهر، سشن‌ها |
| 4 | [Drawing Tools — 110+ Catalog & Interaction](#4-drawing-tools--complete-catalog--interaction-spec) | کاتالوگِ کاملِ ابزارهای ترسیم + تعامل |
| 5 | [Indicators — Catalog, Formulas & Settings](#5-indicators--complete-catalog-formulas--settings-dialog) | ~۱۰۰ اندیکاتور + فرمول + دیالوگِ تنظیمات |
| 6 | [NamaScript Language — Full Spec & Pine Parity](#6-namascript-language--full-spec--pine-parity) | زبانِ کامل + هم‌ترازیِ Pine + موتورِ بار‌به‌بار |
| 7 | [Alerts — Builder & Delivery](#7-alerts--complete-builder--delivery-spec) | سازندهٔ کاملِ آلارم + تحویل |
| 8 | [Watchlist, Screener, Details, News & Calendar](#8-watchlist-screener-details-news--calendar) | واچ‌لیست، اسکرینر، جزئیات، اخبار، تقویم |
| 9 | [Real‑time, Bar Replay & Trading‑from‑Chart](#9-real-time-bar-replay--trading-from-chart) | لایو/تیک، بازپخش، معامله از چارت |
| 10 | [Multi‑Chart Layouts, Templates, Settings & Hotkeys](#10-multi-chart-layouts-templates-settings--hotkeys) | چند‌چارت، قالب، تنظیمات، میان‌برها |
| 11 | [Data, Performance, Mobile & Pro‑Chart Deployment](#11-data-performance-mobile-accessibility--pro-chart-deployment) | داده، کارایی، موبایل، استقرارِ Pro‑Chart |

> **نشانه‌های وضعیت:** ✅ کامل · ◑ ناقص/پایه · ☐ نساخته. **برندِ Pro‑Chart:** آبیِ `#2962FF` + سبز/قرمزِ کندل.

---


---

## 1. UI Shell, Layout & Theming

This chapter is the build spec for the **Pro-Chart shell** — the outer chrome that frames everything else: the top toolbar, the left drawing rail, the central chart canvas, the right info panel, and the bottom studio panel. It is a *functional / behavioral / implementation* spec for **our own product** on **lightweight-charts v5 + React + NamaScript**. We describe what each region does, its exact geometry, behavior, our **current status** (cited from `frontend/academy/src/pages/BazaarNama.jsx`), and a concrete **implementation plan** (what to add, which file/component). We do **not** reproduce any proprietary TradingView code, CSS, or assets — only functional behavior and our own layout conventions.

> **Source of truth files**
> - Page component: `frontend/academy/src/pages/BazaarNama.jsx` (1236 lines, single component `BazaarNama()`).
> - Mounted at route `/bazaarnama` behind a VIP gate: `frontend/academy/src/App.jsx:109` (`<Vip ...><BazaarNama/></Vip>`).
> - Drawing engine: `frontend/academy/src/bazaarnama/drawings.js` (`DrawingLayer`).
> - Indicator registry: `frontend/academy/src/bazaarnama/indicators.js` (`REGISTRY`).
> - Logo asset: `frontend/academy/src/assets/bn-logo.png`.
> - Reference catalog: `docs/TRADINGVIEW_REFERENCE.md` §1.

### 1.0 Design principles for the shell

| Principle | Rule |
|---|---|
| **RTL-first, LTR-island** | The page root is `dir="rtl"` (Persian product). The *chart row* and all price/number text are `dir="ltr"` islands. This is already the convention in `BazaarNama.jsx` (root `dir="rtl"` line 783, chart row `dir="ltr"` line 847). |
| **Token-driven theming** | Every color comes from a single `THEMES[theme]` object (line 73–76). No hard-coded hex in layout. (Today many `#ffffff10`/`#00000008` literals leak — see §1.8 plan.) |
| **Explicit sizing over autoSize** | lightweight-charts `autoSize` returns 0-height under absolutely-positioned DOM; we size via `ResizeObserver` + `applyOptions({width,height})` (lines 212–220). Keep this. |
| **Persisted workspace** | Symbol/TF/type/theme/indicators/drawings persist to `localStorage` key `bn_workspace` (lines 39–41, 363). The shell must never lose layout on refresh. |
| **No proprietary assets** | Our own `bn-logo.png` watermark; our own icon set (lucide-react); our own NamaScript. |

### 1.1 The five regions — overview map

Pro-Chart uses the classic 5-region charting layout. Our current implementation already has all five (`docs/TRADINGVIEW_REFERENCE.md` §1 marks shell "✅ کامل" for top bar, "◑" for the rest).

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ① TOP TOOLBAR                                                          h ≈ 44px (flex)  │  ← border-b
│  [search][SYM][●live][M5 M15 …][type▾][indicators][script][replay][AI][grid][scale]    │
│  ………………………………………………… spacer (flex-1) ………………………………… [save][layouts▾][theme][★right] │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ①b ACTIVE-INDICATOR STRip (conditional)                               h ≈ 26px         │  ← only when overlays/subs > 0
├────┬────────────────────────────────────────────────────────────────────┬─────────────┤
│ ②  │ ③ CENTRAL CHART AREA                            flex-1 (fills)       │ ④ RIGHT     │
│ L  │   ┌─ legend (abs top-right)        ┌─ style-bar (abs top-center)     │   PANEL     │
│ E  │   │ object-tree (abs top-left)     │ script tables (abs top-right)   │  w = 208px  │
│ F  │   │                                                                  │ ┌─tabs────┐ │
│ T  │   │            <main chart pane(s)>  (lightweight-charts v5)         │ │watch ai │ │
│ R  │   │            <canvas overlay z-10> (drawings)                      │ │scan trd │ │
│ A  │   │                                                                  │ │ alerts  │ │
│ I  │   │   [bn-logo watermark abs bottom-left h48]   [⏱countdown br]      │ └─────────┘ │
│ L  │   └──────────────────────────────────────────────────────────────── │   …content… │
│ w  │   <sub-pane wrap (native v5 panes)>                                  │             │
│ 40 │                                                                      │  w 208px    │
├────┴────────────────────────────────────────────────────────────────────┴─────────────┤
│ ⑤ BOTTOM PANEL — NamaScript Studio (conditional, editorOpen)          h = 320px         │
│   [Code2 name] [▶run][bktest][save][clear][examples▾][my-scripts▾]   editor | side-tabs │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Outer container (line 783): `flex flex-col h-[calc(100vh-60px)] rounded-xl overflow-hidden border`, background `TH.bg`, border `TH.border`. The `60px` offset reserves the academy site header. Pro-Chart lives **inside** the academy SPA, so it is *not* a full viewport; fullscreen (§1.7) breaks out of that.

| # | Region | Current width/height | DOM anchor in `BazaarNama.jsx` |
|---|---|---|---|
| ① | Top toolbar | full width, `py-2` (~44px) | line 785 |
| ①b | Active-indicator strip | full width, `py-1` (~26px), conditional | line 833 |
| ② | Left drawing rail | `w-10` = **40px**, full height | line 849 |
| ③ | Central chart | `flex-1`, fills | line 866 |
| ④ | Right panel | `w-52` = **208px** | line 974 |
| ⑤ | Bottom studio | full width, **320px** | line 1116 |

---

### 1.2 Region ① — Top Toolbar

**What it is.** The command bar: symbol search + live readout, timeframe pills, chart-type menu, indicator menu, NamaScript toggle, Replay, AI signal, multi-chart grid, scale mode; then a flex spacer; then save-layout, load-layout, theme toggle, right-panel toggle.

**Geometry & spacing.** `flex items-center gap-2 px-3 py-2 border-b flex-wrap relative` (line 785). Horizontal gap `8px`, padding `12px` H / `8px` V, `flex-wrap` so it reflows on narrow widths. Group inputs sit in pill chips `rounded-lg px-2 py-1` with a subtle translucent fill.

**Element-by-element table.**

| Element | Behavior | Size / style | Current status (cite) | Plan |
|---|---|---|---|---|
| **Symbol search** | Type → dropdown of `filteredSymbols` (≤30); click sets symbol, clears box. Input is `dir="ltr"`, `w-24` (96px). | chip `rounded-lg px-2 py-1`, `Search` icon 14px | ✅ lines 786–794 | Add keyboard nav (↑↓↵), recent-symbols, fuzzy match, and category facets (FX/metals). New component `bazaarnama/SymbolSearch.jsx`. |
| **Symbol label + live dot** | Bold symbol; green pulsing dot + live price when `marketOpen`, else amber "بازار بسته". | text-sm; dot `w-2 h-2 animate-pulse` | ✅ lines 795–803 | Add %change & spread next to price. |
| **Timeframe pills** | `TFS = [M5,M15,M30,H1,H2,H4,D1,W1,MN]` buttons; active = blue. | `px-2 py-1 rounded text-xs` | ✅ line 804 (`TFS` line 21) | Add 1s/M1/M3/M45/3M/6M/12M (needs data; `docs/...REFERENCE.md` §3), custom-TF dialog, and a "+" overflow menu. |
| **Chart-type menu** | Dropdown of `CHART_TYPES` (13 entries). | button + `ChevronDown`; menu `w-32` abs | ✅ lines 805–808 (`CHART_TYPES` line 42) | Group into Standard / Non-standard; show per-type settings gear (Renko brick size etc.). |
| **Indicators menu** | Dropdown over `REGISTRY`; click adds indicator. | menu `w-52 max-h-72 overflow-auto` | ✅ lines 809–812 | Replace with searchable 3-tab dialog (Built-in/My/Community) — `bazaarnama/IndicatorDialog.jsx`. |
| **NamaScript toggle** | Toggles bottom studio (⑤); active = purple. | `Code2` 14px | ✅ line 813 | Keep; wire to a tabbed bottom dock (§1.6). |
| **Replay** | Enter/exit bar-replay; active = teal. | `Play` 14px | ✅ line 814 | Move replay controls to bottom dock tab. |
| **AI Signal** | Gradient violet→fuchsia button; requests full AI setup, shows quota `(remaining/limit)`. | `px-2.5 py-1` gradient | ✅ line 815 | Keep (our differentiator). |
| **Grid 1×/2×/4×** | Cycles multi-chart count. | `LayoutGrid` | ✅ line 816 | Add 3/6/8/16 + layout presets (rows×cols). |
| **Scale mode** | `<select>` Regular/Log/Percent. | inline select | ✅ lines 817–819 | Add Indexed-to-100 + Invert; move into a Scales settings dialog. |
| **Fullscreen** | `requestFullscreen()` on `rootRef`. | `Maximize2` 15px | ✅ line 820 | Add ESC hint + Esc handler & icon swap (§1.7). |
| **flex spacer** | pushes the rest right (in RTL → visually left). | `flex-1` | ✅ line 821 | — |
| **Save layout** | Saves named layout (symbol+TF+indicators+drawings). | `Save` 15px | ✅ line 822 | Add name prompt + templates. |
| **Load layout** | `<select>` over `layouts`. | select | ✅ lines 823–827 | Convert to manageable list (rename/delete). |
| **Theme toggle** | Sun/Moon flips `theme`. | 15px icon | ✅ line 828 | Keep; back with token system (§1.8). |
| **Right-panel toggle** | Star; show/hide right panel. | 15px | ✅ line 829 | Add per-tab deep-link. |

**Missing vs. catalog (`docs/TRADINGVIEW_REFERENCE.md` §1 checklist):** undo/redo are on the *left* rail not the top bar (fine); there is no **Publish/Share** action, no **Settings** gear opening a multi-tab dialog, no **alert bell** in the top bar (alerts live only in the right panel). 

**Implementation plan for ①.** Extract the whole toolbar into `bazaarnama/TopToolbar.jsx` taking props/handlers, so `BazaarNama.jsx` shrinks. Introduce a responsive **overflow menu** (a `⋯` button) that collapses low-priority buttons (scale, grid, layouts, theme) below the `lg` breakpoint instead of `flex-wrap` producing a 2-row bar. Add a `Settings` gear → `bazaarnama/SettingsDialog.jsx` with tabs Symbol / Scales / Appearance / Trading / Events (currently no such dialog; only the per-indicator dialog at line 1217 exists).

---

### 1.3 Region ②b — Active-Indicator Strip (sub-row of the top)

**What it is.** A thin secondary row listing each active overlay/sub indicator as a chip with a settings gear and an ✕, plus a "clear all" button. It only renders when `overlays.length || subs.length` (line 833).

**Geometry.** `flex items-center gap-1.5 px-3 py-1 border-b flex-wrap text-xs` (~26px). Each chip: `rounded px-2 py-0.5 border` with the indicator label, `Settings2` (12px) → opens the per-indicator dialog (`setEditInd`, line 839), and `X` (13px) → `rmInd` (line 840). "پاکِ همه" clears both arrays (line 843).

**Status.** ✅ lines 832–845.

**Plan.** Convert chips to TradingView-style on-pane legend rows (each rendered *inside* the chart top-left, per pane) with eye/lock/settings/delete on hover, so the strip can be removed for screen real estate. New component `bazaarnama/PaneLegend.jsx`. Keep this strip as a fallback on narrow screens.

---

### 1.4 Region ② — Left Drawing Rail

**What it is.** A 40px vertical rail of drawing tools + drawing controls, mirroring a charting platform's left toolbar.

**Geometry.** `w-10 border-r flex flex-col items-center py-2 gap-1 shrink-0` (line 849). Width **40px**, vertical gap `4px`, each tool button `p-1.5 rounded`, icon **16px**. Active tool = blue fill; inactive = `opacity-60 hover:opacity-100`. Thin `h-px w-6` divider rows separate groups (lines 851, 855).

**Contents (top → bottom), each a `<Tip>`-wrapped button with a hover tooltip (lines 94–103):**

```
┌────┐  ← w-10 (40px), py-2
│ ▣  │  cursor   (TOOLS[]) ── line 850 maps 13 tools
│ ✛  │  select/edit
│ ╱  │  trend, ray, hline, vline, rect, fib, fibext,
│ …  │  channel, pitchfork, longshort, text
│ ── │  divider (851)
│ 🎨 │  drawColor  <input type=color> (852)
│ 🧲 │  magnet toggle (853)
│ ▦  │  volume-profile toggle (854)
│ ── │  divider (855)
│ ↶  │  undo  (856)  disabled when !canUndo
│ ↷  │  redo  (857)
│ ✎  │  stay-in-draw toggle (858)
│ ☰  │  object-tree toggle (859)
│ ⋮  │  flex-1 spacer (860)
│ −  │  clear last (861)
│ 🗑 │  clear all (862)
└────┘
```

`TOOLS` (lines 57–71) = 13 entries: cursor, select, trend, ray, hline, vline, rect, fib, fibext, channel, pitchfork, longshort, text. The drawing engine (`DrawingLayer` from `bazaarnama/drawings.js`) is bound via `setTool(tool, drawColor)` (line 239) and renders onto the `<canvas>` overlay (line 878).

**Status (cite `docs/TRADINGVIEW_REFERENCE.md` §1):** "◑ 12 tools, no menu grouping." Object Tree (line 859, 918), undo/redo (856–857), stay-in-mode (858), magnet (853) already exist — better than the doc's older note.

**Gaps & plan.**
- **No grouped fly-out menus.** Catalog wants 110+ tools in 8 groups, each rail icon opening a sub-menu. Plan: redesign rail as **grouped buttons** — each group icon (Cursors, Lines, Channels, Fib, Gann, Patterns, Projection, Shapes, Annotations) opens a fly-out (`bazaarnama/ToolGroup.jsx`) listing the tools of `docs/TRADINGVIEW_REFERENCE.md` §4.1–4.9. Keep the rail 40px; fly-out is an absolutely-positioned panel anchored to the right of the rail.
- **Lock-all / Hide-all** belong on the rail (currently only inside Object Tree at lines 923–924). Add two rail toggles.
- **Per-tool default-style memory** and **Magnet strong/weak** (§4.10) → extend `DrawingLayer.setMagnet` to accept a mode.
- Persisted last-used tool per group.

---

### 1.5 Region ③ — Central Chart Area

**What it is.** The chart itself plus all overlays anchored to it. Layout: `flex-1 flex flex-col min-w-0 relative` (line 866). Inside, a `relative flex-1 min-h-0` holds the chart + canvas; below it a `subWrapRef` div for native v5 sub-panes (line 969).

**Stacked layers (z-order) inside the chart box (lines 876–967):**

| Layer | z | What | Cite |
|---|---|---|---|
| Chart DOM | base | `<div ref={mainRef} absolute inset-0>` — lightweight-charts mounts here | 877 |
| Drawing overlay | `z-10` | `<canvas ref={overlayRef}>` (pointer-events none) | 878 |
| Legend (OHLC) | `z-20` | abs **top-right**, `text-[11px] font-mono`, color by up/down %; shows `SYM·TF` + O/H/L/C + % | 867–875 |
| Script tables | `z-20` | abs **top-right**, `table.new` outputs from NamaScript | 880–902 |
| Object style-bar | `z-30` | abs **top-center**, appears when a drawing is selected: color/width 1-2-3/dashed/lock/delete | 904–916 |
| Object Tree panel | `z-30` | abs **top-left**, `w-56`, list of drawings w/ eye/lock/delete | 918–942 |
| Countdown chip | `z-20` | abs **bottom-right**, `⏱ mm:ss` candle-close countdown + market dot | 944–949 |
| **Watermark/logo** | `z-20` | abs **bottom-left**, `bn-logo.png` h=48 opacity .9, pointer-events none | 950 |
| Multi-chart grid | `z-30` | abs `inset-0` grid of `MiniChart` when `grid>1` | 951–957 |
| Replay controls | `z-20` | abs **bottom-center** pill: play/step/speed/exit | 958–967 |

**Chart construction.** `createChart()` (lines 192–200) with `layout.background = TH.bg`, `textColor = TH.text`, `fontFamily: 'Vazirmatn, sans-serif'`, grid from `TH.grid`, `timeScale.rightOffset: 6`, `crosshair.mode:0`. Sub-indicators use **native v5 panes** (`addSeries(..., pane)`, `panes()[pane].setHeight(108)` — lines 297–306), not separate chart instances.

**Sizing.** `ResizeObserver` → `applyOptions({width,height})` + canvas resize + `dl.render()` (lines 212–220). Lazy-load older candles when scrolled near the left edge (lines 221, 312–329).

**Watermark spec (the logo).** Currently a fixed `<img>` bottom-left, `height:48`, `opacity:0.9`, non-interactive (line 950). 
- *Plan:* make it **theme-aware** (swap light/dark logo or apply `mix-blend` so it reads on both `TH.bg`), add an optional **centered diagonal symbol+TF watermark** (faint, like pro charts) as a separate `z-0` element behind the series — render via an absolutely positioned `<div>` with `SYM` big + `TF` small, color `TH.text` at ~6% opacity. Gate visibility behind a setting. Keep our own asset only (no third-party marks).

**Legend spec.** Today a single floating OHLC chip (lines 867–875). *Plan:* move to **per-pane legend rows** at each pane's top-left (price series + every overlay), each with live value, color swatch, and hover controls — `bazaarnama/PaneLegend.jsx`. Keep crosshair-driven value updates (subscribe already at line 222).

**Crosshair.** Only `mode:0` (Cross) today. *Plan:* expose Cross/Dot/Arrow/Hidden in Settings (catalog §3) by toggling `crosshair.mode` and a custom marker.

**Implementation plan for ③.** Keep the layered absolute-overlay pattern (clean, no reflow). Promote the overlay set into small components: `ChartCanvas.jsx` (chart + drawing canvas + ResizeObserver), `Legend.jsx`, `ObjectTree.jsx`, `StyleBar.jsx`, `CountdownChip.jsx`, `ReplayBar.jsx`, `Watermark.jsx`. This decomposition is the single biggest maintainability win for the 1236-line monolith.

---

### 1.6 Region ④ — Right Panel

**What it is.** A 208px tabbed sidebar: Watchlist / AI / Screener / Trade / Alerts.

**Geometry.** `w-52 border-l overflow-auto shrink-0 flex flex-col` (line 974), `dir="rtl"`. **Width 208px.** Tab bar: 5 buttons `flex-1 py-1.5 text-[10px]`, active underlined (blue, or fuchsia for AI) — lines 975–977. Tab keys: `watch, ai, screener, trade, alerts` (line 976).

**Responsive behavior.** Below `md` it becomes an **overlay drawer**: `max-md:absolute max-md:left-0 max-md:top-0 max-md:bottom-0 max-md:z-40 max-md:shadow-2xl` (line 974). Initial visibility is width-gated: `showRight` defaults to `window.innerWidth > 760` (line 134).

**Tab contents.**

| Tab | What it shows | Cite | Status / plan |
|---|---|---|---|
| **watch** | Live watchlist: symbol + live mid, colored arrow by `live[s].dir`; ✕ to remove; chips to add more. Click sets symbol. | 978–990 | ✅ single list. Plan: multiple named lists, flags, sortable columns, %change/spread cols. |
| **ai** | AI signal button + quota; list of my setups (click→jump on chart); active-signal card (confidence bar, reason, Entry/SL/TP1-3, clear). | 991–1045 | ✅ rich (our feature). |
| **screener** | Live price table over all `symbols` w/ ▲▼; "market closed" note. | 1046–1056 | ◑ price-only. Plan: filter columns + indicator filters (`docs/...REFERENCE.md` §8). |
| **trade** | Buy/Sell → draggable order; entry/SL/TP inputs; R:R; submit (paper). Plus a simulated **DOM** ladder. | 1057–1078 | ◑ paper + sim DOM. Plan: real position P&L lines on chart. |
| **alerts** | Alert builder (op/value/trigger/expiry/message/telegram) + saved-alert list + quick buy/sell. | 1079–1108 | ◑. Plan: source = indicator/drawing; delivery email/push. |

**Missing tabs (catalog §1):** **News**, **Hotlists**, **Details**, **Calendar**. *Plan:* add to the tab set; News/Calendar can stream from our existing backend. Tabs overflow → make the tab bar horizontally scrollable or add a `⋯` more-menu when >5 tabs.

**Implementation plan for ④.** Extract `bazaarnama/RightPanel.jsx` with a tab registry array `[{key,label,Component}]` so adding News/Details is a one-line registration. Make width user-resizable (drag handle on the inner border), persisted to `bn_workspace`. Keep the `max-md` drawer behavior; add a backdrop scrim + swipe-to-close on touch.

---

### 1.7 Region ⑤ — Bottom Panel (NamaScript Studio)

**What it is.** A 320px-tall dock holding the NamaScript code editor + a side panel (Console / Inputs / Reference) and the Strategy-Tester results. Renders only when `editorOpen` (line 1115).

**Geometry.** `border-t flex flex-col` with `height:320`, `background: TH.panel` (line 1116). Toolbar row `px-3 py-1.5 border-b text-xs flex-wrap` (line 1118): script name input, ▶Run (`Ctrl+↵`), Backtest, Save, Clear-screen, Examples▾, My-scripts▾, status text. Body `flex flex-1 min-h-0`: editor `flex-1` (`<CodeEditor>` line 1133) + right side panel `w-60 border-r` with 3 tabs (lines 1134–1211):
- **console** — backtest cost inputs + tester result (overview/performance/trades sub-tabs with an equity sparkline SVG), plot list, alerts, hints. (1139–1187)
- **inputs** — auto-generated UI for `input(...)` declarations. (1188–1199)
- **reference** — grouped NamaScript function reference. (1200–1209)

**Status (cite `docs/...REFERENCE.md` §1):** "◑ only the NamaScript studio." The bottom region is **not tab-dock-ized** — it is a single editor panel; Replay and Strategy-Tester are not their own bottom tabs.

**Implementation plan for ⑤.** Convert to a proper **tabbed bottom dock** (`bazaarnama/BottomDock.jsx`) with tabs: **NamaScript Editor · Strategy Tester · Screener · Paper Trading · Notes** (catalog §1 checklist line 50). Add a drag handle on the top border to resize height (200–600px, persisted). Add maximize/minimize/close in the dock header. Move the Strategy-Tester out of the editor's side panel into its own dock tab so it has full width for the trades table + equity curve.

**Fullscreen (cross-cutting).** The fullscreen button (line 820) calls `requestFullscreen()` on `rootRef` (line 181, attached to the root at line 783). Because the root is `h-[calc(100vh-60px)]`, in fullscreen it should expand to `100vh`. 
- *Plan:* add a `fullscreen` state via `fullscreenchange` listener; when true, swap the root height to `100vh` and the icon to `Minimize2`; add an Esc handler and a small exit hint. Ensure the chart's `ResizeObserver` re-fires on the transition (it will, since the container resizes).

---

### 1.8 Theming tokens (light/dark)

**Current tokens** (`THEMES`, lines 73–76):

```js
dark : { bg:#0e1117, grid:#1c2230, text:#9aa0b5, up:#26a69a, down:#ef5350, panel:#0b0e14, border:#1c2230 }
light: { bg:#ffffff, grid:#eef1f6, text:#3a3f50, up:#089981, down:#f23645, panel:#f7f9fc, border:#e3e8f0 }
```

Applied to the chart on theme change (lines 233–237) and used throughout via `const TH = THEMES[theme]` (line 186).

**Problem:** the token set is too small. Dozens of places hard-code `theme === 'dark' ? '#ffffff10' : '#00000008'` (chip fills), `rgba(13,17,23,.97)` (popover bg), accent blues/greens/reds, etc. These should be tokens.

**Proposed token schema** (extend `THEMES`, new file `bazaarnama/theme.js`):

| Token | dark | light | Used for |
|---|---|---|---|
| `bg` | `#0e1117` | `#ffffff` | chart + page bg (exists) |
| `panel` | `#0b0e14` | `#f7f9fc` | popovers, bottom dock (exists) |
| `border` | `#1c2230` | `#e3e8f0` | all borders (exists) |
| `grid` | `#1c2230` | `#eef1f6` | chart grid (exists) |
| `text` | `#9aa0b5` | `#3a3f50` | primary text (exists) |
| `textStrong` | `#e6e9f2` | `#11161f` | **new** — labels/headings |
| `up`/`down` | `#26a69a`/`#ef5350` | `#089981`/`#f23645` | candles (exists) |
| `chipBg` | `rgba(255,255,255,.06)` | `rgba(0,0,0,.03)` | **new** — replaces the inline ternaries |
| `chipBgHover` | `rgba(255,255,255,.10)` | `rgba(0,0,0,.05)` | **new** |
| `popoverBg` | `rgba(13,17,23,.97)` | `rgba(255,255,255,.98)` | **new** — tree/style-bar/tables |
| `accent` | `#3b82f6` | `#2563eb` | **new** — selected tool/tab |
| `accentAi` | `#8b5cf6` | `#7c3aed` | **new** — AI accents |
| `tpColor`/`slColor` | `#22c55e`/`#ef4444` | same | TP/SL lines & zones |
| `overlayMask` | `#00000060` | `#ffffffcc` | legend backdrop |

**Plan.**
1. Add the new tokens to both themes; replace every inline `theme === 'dark' ? … : …` literal (search-and-replace the ~40 occurrences) with `TH.chipBg` etc.
2. Drive the **lightweight-charts** options entirely from tokens (already mostly done, lines 192–200, 233–237) and also push `up/down` into every `addSeries` call (today some series hard-code `#3b82f6`, lines 256–258, 276 — make these `TH.accent`).
3. Add a **system-theme** option (`prefers-color-scheme`) and a third "auto" value for `theme`, persisted in `bn_workspace`.
4. Keep `Vazirmatn` font (RTL-correct) as the chart font (line 193).

---

### 1.9 Responsive breakpoints & RTL

**Current responsive behavior:**
- Right panel hidden by default when viewport ≤ 760px (`showRight` init, line 134); becomes overlay drawer below Tailwind `md` (768px) via `max-md:*` (line 974).
- Top toolbar uses `flex-wrap` (line 785) so it stacks rows when cramped.
- No collapse for the left rail, no touch long-press menu, no pinch hint.

**Proposed breakpoint plan:**

| Range | Layout |
|---|---|
| **≥ 1280 (xl)** | Full 5-region layout, all toolbar buttons inline, right panel docked at 208px, optional resize. |
| **1024–1279 (lg)** | Low-priority top buttons collapse into a `⋯` menu (scale, grid, layouts, theme). Right panel docked. |
| **768–1023 (md)** | Right panel becomes a toggle drawer; bottom dock height caps at 280px. |
| **< 768 (sm)** | Left rail collapses to a single ✎ button → full-screen tool sheet; top bar becomes 2 essential rows (search+TF, actions in a sheet); right panel = full-screen drawer; AI/Trade reachable via a bottom action bar. |
| **Touch** | Add long-press → context menu on chart objects; pinch-zoom/pan already native to lightweight-charts; bigger 44px hit targets on the rail. |

**RTL handling (keep & formalize):**
- Page root `dir="rtl"` (line 783). The **chart row** wrapper is `dir="ltr"` (line 847) so the left rail stays on the visual left and the right panel on the visual right *regardless* of RTL — this is intentional and must be preserved.
- The right panel itself re-enters `dir="rtl"` for Persian content (line 974); price values inside it are `dir="ltr"` islands (e.g. lines 981, 1009, 1034).
- All numeric/price/symbol text uses `dir="ltr"` (legend 870, countdown 945, DOM 1077, tester rows). Rule: **any glyph string that is a number, ticker, or code is `dir="ltr"`; all prose is `rtl`.**
- *Plan:* centralize this with a tiny `<Num>` wrapper component to avoid scattered `dir="ltr"` and guarantee consistency, and add `font-feature-settings` for tabular figures so columns align.

---

### 1.10 Target component tree (refactor blueprint)

Today everything is one file (`BazaarNama.jsx`, 1236 lines). Target decomposition (new files under `frontend/academy/src/bazaarnama/`):

```
<BazaarNama>                         page shell, holds state + persistence (bn_workspace)
├─ <TopToolbar>                      region ①
│   ├─ <SymbolSearch>
│   ├─ <TimeframeBar>                TFS + custom-TF + overflow
│   ├─ <ChartTypeMenu>               CHART_TYPES grouped
│   ├─ <IndicatorButton>  → <IndicatorDialog>   (3 tabs)
│   ├─ <ToolbarActions>              script/replay/AI/grid/scale/fullscreen
│   ├─ <LayoutControls>              save/load/templates
│   ├─ <ThemeToggle>
│   └─ <OverflowMenu>                responsive collapse
├─ <IndicatorStrip>                  region ①b  (fallback; replaced by PaneLegend)
├─ <ChartRow dir="ltr">
│   ├─ <LeftRail>                    region ②
│   │   └─ <ToolGroup>×9             fly-out menus (110+ tools)
│   ├─ <ChartArea>                   region ③
│   │   ├─ <ChartCanvas>             createChart + DrawingLayer + ResizeObserver
│   │   ├─ <PaneLegend>×panes
│   │   ├─ <ObjectTree>
│   │   ├─ <StyleBar>
│   │   ├─ <ScriptTables>
│   │   ├─ <CountdownChip>
│   │   ├─ <Watermark>               bn-logo + optional diagonal SYM/TF
│   │   ├─ <ReplayBar>
│   │   └─ <MultiChartGrid>          MiniChart × grid
│   └─ <RightPanel>                  region ④  (tab registry)
│       ├─ Watchlist / AI / Screener / Trade / Alerts
│       └─ + News / Hotlists / Details / Calendar (new)
├─ <BottomDock>                      region ⑤  (tab registry, resizable)
│   ├─ NamaScript Editor (<CodeEditor> + side tabs)
│   ├─ Strategy Tester
│   ├─ Screener / Paper Trading / Notes
└─ <SettingsDialog>                  new multi-tab (Symbol/Scales/Appearance/Trading/Events)
   <IndicatorSettingsDialog>         exists (line 1217) — keep, add Style tab + Source picker
```

**State that stays in `<BazaarNama>` (persisted to `bn_workspace`):** `symbol, tf, chartType, theme, overlays, subs, code, scriptApplied, drawings` (lines 123–137, 363–366). Add to persistence: `rightTab`, `rightWidth`, `dockHeight`, `showRight`, `grid`, `scaleMode`.

---

### 1.11 Per-region status summary & priorities

| Region | Status | Top gaps | Priority |
|---|---|---|---|
| ① Top toolbar | ✅ functional | No Settings dialog, no Publish, weak responsive (wrap not collapse) | **P2** |
| ①b Indicator strip | ✅ | Should become per-pane legends | P3 |
| ② Left rail | ◑ | No grouped fly-outs (110+ tools), lock/hide-all not on rail | **P1** (drawing-engine chapter) |
| ③ Chart area | ✅ strong | Diagonal watermark, per-pane legend, crosshair modes | **P1** |
| ④ Right panel | ◑ | No News/Hotlists/Details, single watchlist, not resizable | **P2** |
| ⑤ Bottom dock | ◑ | Not tab-dockized, not resizable, tester cramped | **P2** |
| Theming | ✅ basic | Token set too small; inline literals everywhere | **P1** (quick win) |
| Responsive/RTL | ◑ | No mobile collapse, no touch menus | **P3** |

**Recommended build order for this chapter's work:** (1) expand theming tokens + kill inline ternaries (low-risk, unblocks consistency); (2) decompose the monolith into the component tree above; (3) grouped left-rail fly-outs (coordinated with the Drawing-Tools chapter); (4) tabbed resizable bottom dock; (5) right-panel tab registry + News/Details; (6) responsive overflow + mobile sheets; (7) fullscreen polish + diagonal watermark.

---

*End of Chapter 1 — UI Shell, Layout & Theming.*


---

## 2. Chart Types — Complete Catalog & Build Algorithms

This chapter is the single source of truth for every chart type Pro-Chart must support. For each type we specify: (a) the exact transform from the raw OHLCV array, (b) which `lightweight-charts` v5 series renders it and with what options, (c) user-facing settings, (d) our **current status** with a citation into `frontend/academy/src/bazaarnama/chartbuilders.js` and the `buildPriceSeries` callback in `frontend/academy/src/pages/BazaarNama.jsx`, and (e) the build plan for anything missing.

> **Engine reminder.** lightweight-charts v5 exposes exactly six series primitives — `CandlestickSeries`, `BarSeries`, `LineSeries`, `AreaSeries`, `BaselineSeries`, `HistogramSeries` — added via `chart.addSeries(SeriesCtor, options, pane)`. Pro-Chart already imports all six (`BazaarNama.jsx:2`). **There is no built-in Renko/Kagi/P&F/Volume-candle series.** Every "exotic" type is therefore a *data transform* that re-buckets OHLCV into one of those six primitives. That single fact drives this whole chapter: our job is mostly writing **builder functions**, not engine work.

### 2.0 Data contract

The canonical bar in our codebase is `{ t, o, h, l, c, v }` (`buildPriceSeries`, `heikin()` in `BazaarNama.jsx:78`). Two adapters convert it to the engine's `Time`-keyed shape:

```js
const valSeries = (cs) => cs.map((c) => ({ time: c.t, value: c.c }));      // line-family
const ohlc      = (cs) => cs.map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c })); // bar/candle-family
```

Time-independent types (Renko/Range/Line-Break/Kagi/P&F) ignore real timestamps and emit a **synthetic strictly-increasing time axis** via the `timer()` helper in `chartbuilders.js:18`, because lightweight-charts requires unique ascending `time` keys and these chart types are by definition *not* sampled on the calendar.

### 2.1 Master catalog & status

| # | Type | Family | Series ctor | Transform? | Status | Where |
|---|------|--------|-------------|-----------|--------|-------|
| 1 | Bars (OHLC) | bar | `BarSeries` | passthrough | ✅ Done | `buildPriceSeries` :260 |
| 2 | Candles | candle | `CandlestickSeries` | passthrough | ✅ Done | :262 |
| 3 | Hollow Candles | candle | `CandlestickSeries` | passthrough + per-bar color | ◑ Partial | :261 |
| 4 | Volume Candles | candle | `CandlestickSeries` (+overlay) | width ∝ volume | ☐ Missing | — |
| 5 | Line | line | `LineSeries` | `close`→value | ✅ Done | :256 |
| 6 | Line w/ markers | line | `LineSeries` + markers | `close` + point marker | ☐ Missing | — |
| 7 | Step Line | line | `LineSeries` `lineType:1` | `close`→value | ✅ Done | :257 |
| 8 | Area | area | `AreaSeries` | `close`→value | ✅ Done | :258 |
| 9 | HLC Area | area+lines | `AreaSeries`(close)+2`LineSeries` | hl band + close fill | ☐ Missing | — |
| 10 | Baseline | baseline | `BaselineSeries` | `close`→value, baseValue | ✅ Done | :259 |
| 11 | Columns | histogram | `HistogramSeries` | `close`→value, dir color | ☐ Missing | — |
| 12 | High-Low | bar/area | `BarSeries` no-tick OR `AreaSeries` band | h/l only | ☐ Missing | — |
| 13 | Heikin Ashi | candle | `CandlestickSeries` | HA recurrence | ✅ Done | `heikin()` :78 |
| 14 | Renko | candle | `CandlestickSeries` | brick re-bucket | ✅ Done | `renko()` :21 |
| 15 | Line Break | candle | `CandlestickSeries` | N-line break | ✅ Done | `lineBreak()` :50 |
| 16 | Kagi | line | `LineSeries` | reversal polyline | ◑ Basic | `kagi()` :71 |
| 17 | Point & Figure | line | `LineSeries` | box/reversal columns | ◑ Basic | `pnf()` :88 |
| 18 | Range | candle | `CandlestickSeries` | price-range bars | ✅ Done | `rangeBars()` :35 |
| 19 | Heikin-Ashi Hollow | candle | `CandlestickSeries` | HA + hollow color | ☐ Missing | — |
| 20 | Volume Footprint | custom pane | `CustomSeries`/canvas | bid/ask cluster | ☐ Future | — |
| 21 | Tick chart | line/candle | any | N-ticks per bar | ☐ Future (needs tick feed) |

**Coverage today: ~13 of 21** (8 base + Renko/Range/Line-Break + basic Kagi/P&F), exactly matching the dropdown in `CHART_TYPES` (`BazaarNama.jsx:42-56`) and `NONSTANDARD = ['renko','range','linebreak','kagi','pnf']` (`chartbuilders.js:103`).

---

### 2.2 Standard types — passthrough mappings (DONE)

These need no transform; they only choose a series ctor and feed `valSeries` or `ohlc`. The dispatch already lives in `buildPriceSeries` (`BazaarNama.jsx:256-263`):

- **Bars (1)** → `BarSeries { upColor, downColor }`, fed `ohlc(cs)`. Tick marks left = open, right = close.
- **Candles (2)** → `CandlestickSeries` with border/wick colors, fed `ohlc(cs)`.
- **Line (5)** → `LineSeries`, fed `valSeries(cs)` (close only).
- **Step (7)** → identical to Line but `lineType: 1` (lightweight-charts step interpolation).
- **Area (8)** → `AreaSeries { lineColor, topColor, bottomColor }`, fed `valSeries`.
- **Baseline (10)** → `BaselineSeries { baseValue:{type:'price',price: cs[0].c}, topLineColor, bottomLineColor }`. Above baseValue renders up-color, below renders down-color.

The live-update path already branches on the value-vs-OHLC distinction at `:528` and `:546` (`['line','area','baseline','step'].includes(chartType)`), so any *new* line-family type must be added to those three arrays or live ticks will throw.

---

### 2.3 Hollow Candles (3) — refinement needed ◑

**Current:** `:261` sets `upColor:'rgba(0,0,0,0)'` (transparent body for up bars) with `downColor` solid. This is the naive "transparent-when-up" approach.

**Correct TradingView semantics:** hollow vs filled is decided by **close vs previous close**, not close vs open, and border color is decided by close vs open. So a bar can be *green-bordered but filled* (up day that closed below prior close is rare, but the rule is: body hollow ⇔ `close > prevClose`).

**Build algorithm (per-bar coloring):**
```
prevClose = cs[0].c
for each bar i:
  bullishBody = c.close >= c.open           // border/wick color
  hollow      = c.close >= prevClose         // fill: hollow=up-tint, filled=down-tint
  color  = bullishBody ? UP : DOWN
  body   = hollow ? 'transparent' : color
  emit { ...ohlc, color: body, borderColor: color, wickColor: color }
  prevClose = c.close
```
**Render:** lightweight-charts `CandlestickSeries` supports **per-point** `color`/`borderColor`/`wickColor` overrides in the data array. So instead of global options we set them per data point. **Plan:** replace the global-option branch with a `hollowMap(cs)` builder that returns `ohlc`+colors and feed it directly.

---

### 2.4 Volume Candles (4) — missing ☐

Candles whose **width is proportional to that bar's volume** (a.k.a. "Equivolume"/"Volume Candles"). lightweight-charts cannot vary per-bar bar-width on the built-in `CandlestickSeries`. Two implementation routes:

**Route A — `CustomSeries` (correct, heavier).** v5 exposes `addCustomSeries(paneRenderer)` with `ICustomSeriesPaneRenderer`. We implement a renderer that, for each bar, draws a rectangle whose horizontal half-width = `kVol * (vol[i] / maxVol)` clamped to `[0.15, 0.95] * barSpacing`. Body fill = up/down by close vs open.

```
maxVol = max(v)
for each bar:
  w = clamp(0.15, 0.95, vol/maxVol) * barSpacing(timeScale)
  drawRect(x - w/2, yClose, w, |yOpen - yClose|, color)
  drawWick(x, yHigh..yLow)
```

**Route B — approximation (cheap).** Render normal candles + a bottom `HistogramSeries` volume sub-pane (we already build histogram volume elsewhere). Not true equivolume but ships in an afternoon. **Plan:** Route B for v1 (label it "Volume Candles (approx)"), Route A behind a feature flag once the `CustomSeries` drawing layer is proven (it is also needed for Volume Footprint #20).

---

### 2.5 Line with Markers (6) — missing ☐

Trivial. Same `LineSeries` as Line, but attach a circular marker at every data point.

**Build/render:**
```js
s = chart.addSeries(LineSeries, { color, lineWidth: 2, pointMarkersVisible: true });
s.setData(valSeries(cs));
```
v5 `LineSeries` has a native `pointMarkersVisible` (and `pointMarkersRadius`) option — no separate markers primitive required. **Plan:** add `'lwm'` to `CHART_TYPES`, one branch in `buildPriceSeries`, and add it to the four value-family arrays (`:263,:324,:528,:546`). ~10 lines.

---

### 2.6 HLC Area (9) — missing ☐

An `AreaSeries` filled to the **close**, overlaid with two faint lines tracing **high** and **low**, giving a sense of intrabar range without full candles.

**Build:** three datasets from the same `cs`: `closeVals`, `highVals`, `lowVals`.
**Render:**
```js
const area = chart.addSeries(AreaSeries,  { lineColor, topColor, bottomColor });
const hi   = chart.addSeries(LineSeries,  { color: 'rgba(up,.35)',  lineWidth: 1, lastValueVisible:false });
const lo   = chart.addSeries(LineSeries,  { color: 'rgba(down,.35)',lineWidth: 1, lastValueVisible:false });
area.setData(valSeries(cs)); hi.setData(highVals); lo.setData(lowVals);
```
**Caveat:** `priceSeriesRef` currently holds a *single* series; HLC-Area is the first multi-series price type. **Plan:** generalize `priceSeriesRef` to hold an array (or `{ primary, aux:[] }`), and update the teardown at `:244` and live-update path to iterate. The primary (area/close) stays the cursor/draw anchor via `drawRef.setSeries(area)`.

---

### 2.7 Columns (11) — missing ☐

A `HistogramSeries` of **close** values, each column colored by direction (close ≥ prevClose). Mainly used for indicator-like instruments; trivial.

**Build/render:**
```js
let prev = cs[0].c;
const data = cs.map((c)=>{ const up=c.c>=prev; prev=c.c; return { time:c.t, value:c.c, color: up?UP:DOWN }; });
s = chart.addSeries(HistogramSeries, { priceLineVisible:false });
s.setData(data);
```
**Plan:** add `'columns'` type; treat as a value-family member but note it uses `HistogramSeries` not `LineSeries`, so the live-update branches must special-case it (histogram `update` takes `{time,value,color}`). ~12 lines.

---

### 2.8 High-Low (12) — missing ☐

Shows only the high–low **range** of each bar as a thin vertical, no open/close ticks. Two render strategies:

- **Strategy A (preferred):** `CandlestickSeries` with `open=low, close=high` and **borderVisible:false, wick=transparent**, body colored single-tone — produces a filled high-low bar. But this fakes direction.
- **Strategy B (truer):** a `CustomSeries` drawing a 1px vertical line from `yHigh` to `yLow` per bar, colored by close-vs-prevClose. Same renderer family as Volume Candles.

**Plan:** ship Strategy A as the simple version; route through the same `CustomSeries` layer as #4/#12 when built. Settings: single color vs up/down coloring toggle.

---

### 2.9 Heikin Ashi (13) — DONE ✅

Already implemented (`heikin()` `BazaarNama.jsx:78-87`). The recurrence:

```
HA_close = (o + h + l + c) / 4
HA_open  = first bar: (o + c)/2 ;  else (prevHA_open + prevHA_close)/2
HA_high  = max(h, HA_open, HA_close)
HA_low   = min(l, HA_open, HA_close)
```
Rendered as ordinary candles via `chart.addSeries(CandlestickSeries, …)` with `data = heikin(cs)`. **Note the live-update guard:** `:554` / `:558` skip in-place `update()` when `chartType==='heikin'` because HA_open depends on the *previous HA bar*, so a forming bar must be recomputed from the full series, not patched. Keep that guard for any recurrence-based type (Line Break, Renko also recompute).

**Gap:** add **Heikin-Ashi Hollow (19)** — run `heikin(cs)` then apply the §2.3 hollow coloring on the HA series. Pure composition of two existing pieces.

---

### 2.10 Renko (14) — DONE ✅, settings upgrade needed

`renko(cs, brick)` (`chartbuilders.js:21-32`) walks closes, emitting a fixed-size brick each time price moves ≥ `brick` from the running `base`. Up bricks `{o:base,c:base+brick}`, down bricks inverted. Default brick = `avgRange(cs)` (our ATR-ish helper, `:6`).

**Render:** `{kind:'candle'}` → `CandlestickSeries` (`buildPriceSeries:249`, dispatched through `buildNonStandard:105`).

**Current limitations & plan:**
1. **Brick source.** TradingView offers **Traditional** (user-typed fixed price) and **ATR** (brick = ATR(period) recomputed). We hardcode `avgRange` (a truncated TR average). *Plan:* expose a settings popover `{ mode:'ATR'|'traditional', value, atrPeriod }`; pass `brick` explicitly. `avgRange` already accepts a period arg.
2. **Wick option.** TV has "Renko with wicks." Our bricks have flat wicks (`h=cl,l=o`). *Plan:* optional wick = furthest price excursion within the brick-forming window.
3. **No live forming brick.** NONSTANDARD types skip live update (`:541` returns early) and countdown (`:385`) — acceptable, but a future enhancement recomputes Renko on each closed candle.

---

### 2.11 Range (18) — DONE ✅

`rangeBars(cs)` (`chartbuilders.js:35-47`) opens a new bar, tracks running hi/lo across every sub-price (`o,h,l,c` of each source candle), and closes the bar the instant `hi - lo ≥ rng`, reopening at the breakout price. Default `rng = avgRange(cs)`.

**Render:** candle family, same as Renko.

**Plan:** identical settings work to Renko — expose `rng` (Traditional vs ATR). Algorithm is sound; only the UI for the size is missing.

---

### 2.12 Line Break (15) — DONE ✅

`lineBreak(cs, n=3)` (`chartbuilders.js:50-68`) implements **N-line break (3-Line Break default)**: a new "line" (box) is drawn only when close exceeds the extreme of the **last `n` lines**; continuation in-trend needs only to beat the last line's close, while a **reversal** must beat the high/low of the prior `n` lines.

```
keep list of lines {o,c}
up = lastLine.c >= lastLine.o
if  up and price > last.c          → new up line   (continuation)
elif !up and price < last.c        → new down line (continuation)
elif up  and price < min(last n)   → new down line (reversal, needs n-line break)
elif !up and price > max(last n)   → new up line   (reversal)
```
Rendered as candles. **Setting:** `n` (currently fixed 3 in `buildNonStandard:107`). *Plan:* surface `n` (2/3/5/10) in the settings popover and thread it through `buildNonStandard`.

---

### 2.13 Kagi (16) — BASIC ◑, needs thickness + render upgrade

`kagi(cs, reversal)` (`chartbuilders.js:71-85`) produces a **reversal polyline**: it extends the current direction as long as price keeps making new extremes (updating the last point in place), and pushes a new vertex only when price reverses by ≥ `reversal`. Default `reversal = avgRange`.

**What's missing vs TradingView Kagi:**
1. **Yang/Yin line thickness.** A real Kagi line is **thick (yang)** while above the prior high (shoulder) and **thin (yin)** below the prior low (waist), flipping at "shoulders/waists." Our single `LineSeries` (`buildNonStandard:108`) has uniform width.
2. **Horizontal connectors.** Kagi reversals are drawn as a horizontal segment + vertical leg (right-angle), not a diagonal. A plain `LineSeries` between two vertices draws a diagonal.
3. **Percent reversal mode.** TV supports reversal as **absolute** or **% of price** (and ATR).

**Plan:** move Kagi (and P&F) to a **`CustomSeries` renderer** so we can draw right-angle segments and switch stroke width per segment based on yang/yin state. Track `prevShoulder`/`prevWaist`; segment is yang when its level > prevShoulder. Until the custom renderer exists, the polyline is a usable approximation. Expose `{ reversalMode:'ATR'|'abs'|'pct', value }`.

```
# yang/yin thickness pass over kagi vertices
shoulder = -inf; waist = +inf; thick = false
for each segment (a→b):
  if b.value > shoulder: thick = true;  shoulder = b.value
  if b.value < waist:    thick = false; waist    = b.value
  drawSegment(a,b, width = thick ? 3 : 1)   # right-angle: (a.x,a.y)->(b.x,a.y)->(b.x,b.y)
```

### 2.14 Point & Figure (17) — BASIC ◑, needs X/O column render

`pnf(cs, box, reversal=3)` (`chartbuilders.js:88-101`) tracks columns: it advances the current column while price moves ≥ `box` in-trend (snapping `ext` to whole-box multiples), and starts a new opposite column only on a `reversal*box` move. It returns a **polyline of column tips** — a placeholder.

**What's missing vs real P&F:** TV renders **stacked X's (rising column) and O's (falling column)**, never a connecting line, and the price axis is **box-quantized**. Our `LineSeries` (`buildNonStandard:109`) only traces tips.

**Build (proper, column-of-boxes model):**
```
box = ATR or fixed; reversal = 3 (boxes)
columns = []        # each: { dir:+1/-1, from, to }  in box units
dir = 0; col = null
for price p in closes:        # (or high/low for "high-low" P&F source)
  bp = quantize(p, box)
  if dir==0: start column at bp
  elif dir==+1:
     if bp >= col.to+box: col.to = bp            # extend X column up
     elif bp <= col.to - reversal*box:           # reversal → new O column
        newcol(dir=-1, from=col.to-box, to=bp)
  elif dir==-1:  # mirror
     ...
# render: for each column, for each box level from..to draw glyph (X if dir+1 else O)
```
**Render:** a `CustomSeries` placing one X/O glyph per box cell at `x = columnIndex * cellW`, `y = priceToCoord(level)`. Color X=up, O=down. **Settings:** `boxSize` (Traditional/ATR/percentage) + `reversal` (default 3) + `source` (close vs high-low) + scaling (Traditional/Percentage/ATR). **Plan:** same `CustomSeries` infrastructure as Kagi; until then keep the line approximation but relabel "P&F (preview)".

---

### 2.15 Shared infrastructure: the missing `CustomSeries` layer

Four of the remaining types (Volume Candles, High-Low true, proper Kagi, proper P&F) plus future Footprint all need one thing we don't have yet: a **custom canvas renderer** registered via lightweight-charts v5 `addCustomSeries`. Building it once unblocks all of them. Minimal interface:

```
class ProGlyphSeries implements ICustomSeriesPaneView {
  priceValueBuilder(item) -> [item.high, item.low, item.close]   // for autoscale
  renderer() -> { draw(target, priceToCoord) { /* per-item canvas ops */ } }
  isWhitespace(item) -> item.value == null
}
```
Recommended sequence: (1) ship the cheap value-family gaps (Line+markers, Columns, HLC-Area, Hollow refinement, HA-Hollow) — all pure `addSeries` work, ~1 day; (2) build `ProGlyphSeries`; (3) port Kagi, P&F, Volume Candles, High-Low onto it; (4) Renko/Range/Line-Break settings popover (ATR vs Traditional sizing) since their algorithms are already correct.

### 2.16 Settings model (brick / box / reversal / range)

All time-independent types share a sizing config. Standardize one popover bound to the chart-type dropdown (`ctMenu`, `BazaarNama.jsx:806`):

| Type | Size param | Modes | Default | Extra |
|------|-----------|-------|---------|-------|
| Renko | brick | ATR(n) / Traditional | `avgRange` (ATR-ish) | wicks on/off |
| Range | range | ATR(n) / Traditional | `avgRange` | — |
| Line Break | lines `n` | integer | 3 | — |
| Kagi | reversal | ATR / Abs / Percent | `avgRange` | yang/yin width |
| P&F | box + reversal | ATR / Traditional / Percent | `avgRange` / 3 | source close vs HL |

`avgRange()` (`chartbuilders.js:6`) is our pragmatic ATR substitute (mean True-Range over `p` bars). For "Traditional" we bypass it and pass the user's literal price; for "ATR" we pass `avgRange(cs, atrPeriod)`. The builders already accept the size as their second argument, so wiring the popover requires no algorithm changes — only threading the value through `buildNonStandard(type, cs, opts)`.

### 2.17 Acceptance checklist for this chapter

- [ ] Hollow uses prevClose fill rule + per-point colors (§2.3)
- [ ] Line-with-markers via `pointMarkersVisible` (§2.5)
- [ ] Columns via `HistogramSeries` + live-update special case (§2.7)
- [ ] HLC-Area + multi-series `priceSeriesRef` generalization (§2.6)
- [ ] HA-Hollow = `heikin()` ∘ hollow coloring (§2.9)
- [ ] Settings popover: ATR vs Traditional for Renko/Range/Line-Break/Kagi/P&F (§2.16)
- [ ] `ProGlyphSeries` custom renderer (§2.15)
- [ ] Volume Candles, true High-Low, proper Kagi yang/yin, proper P&F X/O on top of it
- [ ] Verify each new value-family type is added to the four `['line','area','baseline','step']` guards (`:263, :324, :528, :546`)


---

## 3. Timeframes, Axes, Price Scales, Crosshair & Sessions

This chapter is the engineering build spec for the **time axis, price scale, crosshair, bar-close countdown, and trading-session machinery** of **Pro-Chart** — our `lightweight-charts` v5 + React charting product. It is a *feature/implementation* spec for our own product; it documents desired behavior, our current status (citing existing code in `frontend/academy/src/pages/BazaarNama.jsx`, the BazaarNama prototype), and a concrete implementation plan against the public `lightweight-charts` v5 API (`IPriceScaleApi.applyOptions`, `ITimeScaleApi`, `IChartApi.applyOptions({ crosshair })`, custom panes/primitives). Nothing here copies TradingView code or assets; the TradingView feature catalog in `docs/TRADINGVIEW_REFERENCE.md` §3 is used only as a parity checklist.

### 3.0 Scope & components

The "time + scale" subsystem of Pro-Chart is made of seven cooperating pieces:

1. **Timeframe selector & resolution model** — the discrete set of bar resolutions (`1s … 12M`, plus `Range`/`Custom`).
2. **Data provisioning** — which resolutions come from the backend as *base series* and which we synthesize via *client-side aggregation*.
3. **Price-scale modes** — Regular / Logarithmic / Percentage / Indexed-to-100, plus Auto, Lock, and Invert.
4. **Multiple price scales** — left/right dual scales and per-series overlay scales for indicators on different units.
5. **Crosshair** — Cross / Dot / Arrow / Hidden modes plus Magnet snapping.
6. **Bar-close countdown** — the live "time until current candle closes" indicator on the time axis.
7. **Sessions & time-zone** — London/NY/Tokyo session shading, session-break gaps, and the user-selectable display time-zone, plus axis label formatting.

Each of the following sub-sections gives: **desired behavior**, **current status (code citation)**, and **implementation plan**.

---

### 3.1 The full timeframe set

#### 3.1.1 Target resolution catalog

Pro-Chart must expose the complete professional resolution ladder. We group them into five families:

| Family | Resolutions | Seconds-per-bar |
|---|---|---|
| Seconds | `1s 5s 10s 15s 30s` | 1, 5, 10, 15, 30 |
| Minutes | `1m 3m 5m 15m 30m 45m` | 60, 180, 300, 900, 1800, 2700 |
| Hours | `1h 2h 3h 4h` | 3600, 7200, 10800, 14400 |
| Days+ | `1D 1W 1M 3M 6M 12M` | 86400, 604800, ~2.592e6, ~7.776e6, ~1.555e7, ~3.11e7 |
| Special | `Range` (price-step bars), `Custom` (user types e.g. `7m`, `8h`, `2D`) | n/a — see ch. on chart types |

Calendar resolutions (`1M`, `3M`, `6M`, `12M`, and to a degree `1W`) are **not** fixed-second; they must be bucketed by calendar boundary (month start, ISO week start), not by `floor(t/seconds)`. This is the single most important correctness caveat for the high timeframes and is called out explicitly in §3.1.4.

#### 3.1.2 Current status

The prototype defines a **restricted ladder of nine** and a fixed seconds table:

```js
// BazaarNama.jsx:21
const TFS = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'D1', 'W1', 'MN'];
// BazaarNama.jsx:22
const TF_SEC = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H2: 7200,
                 H4: 14400, D1: 86400, W1: 604800, MN: 2592000 };
const tfSec = (t) => TF_SEC[t] || 3600;           // :24
```

Observations:

- **No seconds tier** (`1s..30s`), **no `M1`** in the selector (it exists in `TF_SEC` but is not in `TFS`), **no `3m/45m/3h`**, **no `3M/6M/12M`**, **no Range/Custom**. `docs/TRADINGVIEW_REFERENCE.md` §3 confirms this gap: "◑ M5/M15/H1/H4/D1 (۵ — limited to available data)".
- `MN` is modeled as a flat `2592000` s (30 days) — a *calendar-wrong* approximation (see §3.1.4).
- `tfSec` is used for three things downstream: the **countdown** (`:386`), the **forward zone projection window** (`:398–401`), and the **live next-candle synthesis**. So any new resolution must have a correct (or correctly-bucketed) entry here.

The selector UI is a simple button row:

```js
// BazaarNama.jsx:804
{TFS.map((t) => (<button key={t} onClick={() => setTf(t)} ...>{t}</button>))}
```

#### 3.1.3 How resolutions are provided (base vs. derived)

The prototype already implements the **base + client-aggregation** pattern that the production design will generalize:

```js
// BazaarNama.jsx:26
const DERIVED_TF = { M30: ['M15', 2], H2: ['H1', 2], W1: ['D1', 5], MN: ['D1', 22] };

// BazaarNama.jsx:28 — every `factor` candles → one candle
const resampleCandles = (cs, factor) => {
  if (factor <= 1) return cs;
  const out = [];
  for (let i = 0; i < cs.length; i += factor) {
    const g = cs.slice(i, i + factor); if (!g.length) break;
    out.push({ t: g[0].t, o: g[0].o,
               h: Math.max(...g.map(c => c.h)), l: Math.min(...g.map(c => c.l)),
               c: g[g.length - 1].c, v: g.reduce((s, c) => s + (c.v || 0), 0) });
  }
  return out;
};
```

And the aggregation is wired into the data-fetch path: a derived TF requests its base from the backend then resamples (`BazaarNama.jsx:314, :336`):

```js
if (NONSTANDARD.includes(chartType) || DERIVED_TF[tf]) return;  // :314 skip live-tick for derived
const der = DERIVED_TF[tf];                                     // :336
// ... fetch der[0] base, then resampleCandles(base, der[1])
```

So today the data contract is: backend serves **M5, M15, H1, H4, D1** natively (per `docs` §3 and the `api.candles` endpoint), and **M30, H2, W1, MN are synthesized in the browser** (M30 from M15×2, H2 from H1×2, W1 from D1×5, MN from D1×22).

**What is missing from the data layer for full parity:**

- **Seconds & M1**: not available as a base series at all. The backend `candles` hypertable (TimescaleDB) would need an `s1`/`m1` feed (or live tick aggregation) before `1s..30s` and `1m..45m` are honest.
- **W1 / MN correctness**: derived by *count* (`D1×5`, `D1×22`), which is wrong across weekends, holidays, partial weeks, and variable-length months. These must move to **calendar bucketing**.
- **Intraday minute derivations** (`3m`, `45m`) from `M1` and **hour derivations** (`3h` from `H1×3`) are not defined in `DERIVED_TF`.

#### 3.1.4 Implementation plan — resolution model

**(a) Canonical resolution descriptor.** Replace the three ad-hoc maps (`TFS`, `TF_SEC`, `DERIVED_TF`) with one declarative table keyed by a canonical id, e.g.:

```js
// id, label, kind: 'sec'|'min'|'hour'|'day'|'week'|'month',
// approxSec (for countdown/projection geometry only),
// base: source resolution to aggregate from (or null = native from backend),
// factor: integer multiplier when bucketing is fixed-width.
const RESOLUTIONS = {
  s1:{label:'1s',kind:'sec',approxSec:1,base:null},  s5:{label:'5s',approxSec:5,base:'s1',factor:5},
  m1:{label:'1m',kind:'min',approxSec:60,base:null}, m3:{label:'3m',approxSec:180,base:'m1',factor:3},
  m5:{label:'5m',approxSec:300,base:null}, m15:{label:'15m',approxSec:900,base:null},
  m30:{label:'30m',approxSec:1800,base:'m15',factor:2}, m45:{label:'45m',approxSec:2700,base:'m15',factor:3},
  h1:{label:'1h',approxSec:3600,base:null}, h2:{label:'2h',approxSec:7200,base:'h1',factor:2},
  h3:{label:'3h',approxSec:10800,base:'h1',factor:3}, h4:{label:'4h',approxSec:14400,base:null},
  d1:{label:'1D',kind:'day',approxSec:86400,base:null},
  w1:{label:'1W',kind:'week',approxSec:604800,base:'d1',bucket:'isoWeek'},
  mn1:{label:'1M',kind:'month',approxSec:2.592e6,base:'d1',bucket:'month'},
  mn3:{label:'3M',kind:'month',base:'d1',bucket:'month',span:3},
  mn6:{label:'6M',kind:'month',base:'d1',bucket:'month',span:6},
  mn12:{label:'12M',kind:'month',base:'d1',bucket:'month',span:12},
};
```

**(b) Two aggregation paths.** Keep `resampleCandles(cs, factor)` for *fixed-width* derivations (`factor` set). Add `bucketCandles(cs, bucketFn)` for *calendar* derivations (`isoWeek`, `month`, with `span`), where the boundary is computed from the bar's wall-clock date **in the user's selected display time-zone** (§3.7), not from `floor(t/sec)`. Bucketing rule: a new bucket starts when `bucketKey(t)` changes; OHLCV merge logic is identical to `resampleCandles` (first open, max high, min low, last close, summed volume).

**(c) Honest gating of unavailable resolutions.** Until the backend ships `s1`/`m1` base series, the seconds family and `1m/3m/45m` must be **shown but disabled** (greyed) with a tooltip "requires tick feed", rather than silently broken. Drive this from `RESOLUTIONS[id].base` resolvability against an "available base series" set the data layer reports. This matches our project rule of never faking data.

**(d) Custom resolution input.** A small `+` button opens an input parsing `^(\d+)(s|m|h|D|W|M)$`; if the requested resolution is an integer multiple of an available base, build a synthetic `RESOLUTIONS` entry on the fly with `base` + `factor`; otherwise reject with a clear message.

**(e) Range bars** (`Range`) are *price-quantized*, not time-quantized — they belong to the chart-types chapter; here we only note that when `chartType ∈ NONSTANDARD` the time-axis countdown and live-candle synthesis are disabled (already done: `:314`, `:385`).

---

### 3.2 Price scale modes (Regular / Log / Percent / Indexed-to-100)

#### 3.2.1 Desired behavior

`lightweight-charts` exposes price-scale mode as an enum on the price scale via `IPriceScaleApi.applyOptions({ mode })`:

- `PriceScaleMode.Normal` (0) — linear price.
- `PriceScaleMode.Logarithmic` (1) — log price; correct for long-horizon proportional moves.
- `PriceScaleMode.Percentage` (2) — each value as % change from the first visible bar.
- `PriceScaleMode.IndexedTo100` (3) — first visible value normalized to 100; everything relative.

We want all four selectable, applied to the **right** scale (the main price scale) and remembered in the workspace.

#### 3.2.2 Current status

Three of four modes are wired:

```js
// BazaarNama.jsx:172
const [scaleMode, setScaleMode] = useState(0); // 0 normal / 1 log / 2 percent
// BazaarNama.jsx:240 — apply to the right scale on change
useEffect(() => { try { chartRef.current &&
  chartRef.current.priceScale('right').applyOptions({ mode: scaleMode }); } catch (e) {} }, [scaleMode]);
// BazaarNama.jsx:817 — selector with only 3 options
<select value={scaleMode} onChange={(e)=>setScaleMode(Number(e.target.value))}>
  <option value={0}>عادی</option><option value={1}>لگاریتمی</option><option value={2}>درصدی</option>
</select>
```

Per `docs` §3: Regular ✅, Log ✅, Percent ✅, **Indexed-to-100 ☐ (missing)**. `scaleMode` is **not** persisted to `WS_KEY` workspace (`saveWS`), so it resets on refresh.

#### 3.2.3 Implementation plan — scale modes

1. **Add Indexed-to-100**: append `<option value={3}>پایه ۱۰۰</option>`. The enum value `3` maps directly to `PriceScaleMode.IndexedTo100`; `:240` already forwards any numeric `scaleMode`, so no logic change is needed beyond the option.
2. **Use the enum, not magic numbers.** Import `{ PriceScaleMode }` from `lightweight-charts` and map the selector to `PriceScaleMode.Normal | Logarithmic | Percentage | IndexedTo100` for readability and forward-compat.
3. **Persist mode**: call `saveWS({ scaleMode })` in the effect and restore it in the workspace-load path alongside symbol/TF/indicators (the prototype already persists those via `WS_KEY` at `:39–41`).
4. **Guard incompatible modes**: Log mode is invalid with negative/zero values (e.g. some spread or indexed indicators). When mode is Log/Percent, indicators on a separate overlay scale (§3.3) must keep their own `Normal` mode so an oscillator like RSI isn't distorted.

---

### 3.3 Multiple / dual price scales & overlays

#### 3.3.1 Desired behavior

Professional charts need: a **right** main scale, an optional **left** scale (e.g. comparing a second symbol in different units), and **overlay scales** for indicators whose units differ from price (RSI 0–100, MACD around 0, volume). `lightweight-charts` v5 supports this through the `priceScaleId` series option: `'right'`, `'left'`, or any custom id (e.g. `'rsi'`), with each scale independently configurable via `chart.priceScale(id).applyOptions({...})`. Panes (v5 native multi-pane) handle the vertical stacking for sub-indicators.

#### 3.3.2 Current status

Only the **right** scale is configured at creation:

```js
// BazaarNama.jsx:196
rightPriceScale: { borderColor: TH.grid },
```

There is no `leftPriceScale` configuration and no dual-scale comparison feature; `docs` §3 marks "multiple simultaneous price scales (dual) ☐" and "Invert ☐". Indicators that need their own units already use v5 panes (the resize comment at `:217` notes "native v5 pane resizes automatically with the main chart"), which is the right substrate — but explicit overlay `priceScaleId` management for *same-pane* overlays (e.g. a second instrument on the price pane) is not implemented.

#### 3.3.3 Implementation plan — multiple scales

1. **Enable the left scale on demand.** Add `leftPriceScale: { visible: false, borderColor: TH.grid }` to `createChart` options; flip `visible: true` and assign a comparison series `priceScaleId: 'left'` when the user adds a "compare symbol".
2. **Overlay scales for price-pane indicators.** For indicators drawn on the price pane but in foreign units (e.g. a normalized line), create them with a custom `priceScaleId` and set `scaleMargins` so they occupy a band; for true sub-indicators (RSI/MACD) keep using separate **panes** (v5) which each carry their own scale automatically.
3. **Per-scale autoscale info.** Where an overlay must not be squeezed by price, set `autoScale: true` on its own scale only.
4. **Dual-axis sync.** When two symbols are compared, allow each its own mode (e.g. both `Percentage` for fair visual comparison) — wire mode independently per `priceScaleId`.

---

### 3.4 Auto-scale, lock, and invert

#### 3.4.1 Desired behavior

- **Auto** (default): the visible price range fits the visible bars automatically.
- **Lock / manual**: the user drags the price axis to set a fixed range that does not auto-refit as new bars arrive — toggled by `autoScale: false`.
- **Invert**: flip the axis vertically (`invertScale: true`) — useful for inverse instruments or hedge views.

`lightweight-charts` exposes all three on `IPriceScaleApi.applyOptions`: `{ autoScale: boolean, invertScale: boolean }`. (Dragging the scale natively toggles a manual range; programmatic lock sets `autoScale:false`.)

#### 3.4.2 Current status

The right scale is left at library defaults → **autoScale is implicitly on**, but there is **no UI** to lock it and **no invert** (`docs` §3: "Auto/Lock ◑", "Invert ☐"). The app *does* drive the visible range programmatically in a few places — `fitContent()` at `:345`, `:409`, `:520`, and an explicit `setVisibleLogicalRange` in `focusSetupView` (`:404–409`) — but these affect the **time** axis logical range, not a price lock.

#### 3.4.3 Implementation plan — auto/lock/invert

1. **Lock toggle**: a small lock button calling `chart.priceScale('right').applyOptions({ autoScale: next })`; persist to workspace. When locked, suppress our own `fitContent()` calls (guard them behind `if (!priceLocked)`).
2. **Invert toggle**: `chart.priceScale('right').applyOptions({ invertScale: next })`; persist.
3. **"Reset scale" / double-click**: re-enable `autoScale:true` and call `chart.timeScale().fitContent()` — restoring the default "fit everything" view, matching user expectation of double-clicking the axis.
4. Group these (Lock, Invert, Reset, Mode) into a single **price-axis context menu** opened by right-click on the right scale, so the toolbar stays clean.

---

### 3.5 Crosshair modes (Cross / Dot / Arrow / Hidden / Magnet)

#### 3.5.1 Desired behavior

The crosshair is configured chart-wide via `IChartApi.applyOptions({ crosshair: { mode, vertLine, horzLine } })`. `lightweight-charts` `CrosshairMode` enum: `Normal` (0) = free cross that follows the pointer, `Magnet` (1) = snaps the horizontal line to the nearest OHLC value of the hovered bar, `Hidden` (2) = no crosshair lines. Visual style of each line (color, width, dashed, label background) is set under `vertLine`/`horzLine`. "Dot" and "Arrow" are *cursor presentations* layered on top of these modes (the pointer glyph + a small marker at the intersection), since the native enum only covers Normal/Magnet/Hidden.

So our product matrix is:

| User-facing mode | Implementation |
|---|---|
| **Cross** | `CrosshairMode.Normal`, both lines visible, default cursor |
| **Dot** | `Normal` + a small filled dot drawn at the price/time intersection (overlay), thin lines |
| **Arrow** | `Normal` + arrow cursor + arrowhead marker, lines optionally dimmed |
| **Hidden** | `CrosshairMode.Hidden` |
| **Magnet** | `CrosshairMode.Magnet` (snaps to OHLC) — orthogonal toggle that can combine with the above |

#### 3.5.2 Current status

The crosshair is created in **Normal/Cross mode only**:

```js
// BazaarNama.jsx:197
crosshair: { mode: 0 },
```

`docs` §3: "Crosshair: Cross/Dot/Arrow/Hidden ◑ — only Cross". There is **no** Hidden, Dot, or Arrow. However a **Magnet** concept already exists, but it is bound to the **drawing layer**, not the chart crosshair:

```js
// BazaarNama.jsx:170
const [magnet, setMagnet] = useState(false);
// BazaarNama.jsx:381
useEffect(() => { if (drawRef.current) drawRef.current.setMagnet(magnet); }, [magnet]);
```

i.e. magnet currently snaps **drawing tool endpoints** (`DrawingLayer.setMagnet`) to bars, but does **not** switch the chart's `CrosshairMode` to `Magnet`. The crosshair move is subscribed for the legend/OHLC readout:

```js
// BazaarNama.jsx:222
chart.subscribeCrosshairMove((p) => {
  dl.render();
  if (!p || !p.time || !priceSeriesRef.current) { setLegend(null); return; }
  const d = p.seriesData.get(priceSeriesRef.current);
  if (d) setLegend(d.close != null ? d : { close: d.value });
});
```

#### 3.5.3 Implementation plan — crosshair

1. **Mode selector** (cursor sub-menu): `Cross | Dot | Arrow | Hidden`. Map:
   - Cross → `crosshair.mode = CrosshairMode.Normal`, `vertLine.visible/horzLine.visible = true`.
   - Hidden → `crosshair.mode = CrosshairMode.Hidden`.
   - Dot / Arrow → keep `Normal` but draw the dot/arrow glyph in the **overlay canvas** (`overlayRef`) at the coordinates from `subscribeCrosshairMove` (we already have the param `p` with `point` + `seriesData`); the existing `dl.render()` call in the crosshair handler is the natural hook to also paint this marker.
2. **Unify Magnet**: extend the existing `magnet` toggle so it *also* sets `chart.applyOptions({ crosshair: { mode: magnet ? CrosshairMode.Magnet : CrosshairMode.Normal } })`, keeping the drawing-snap behavior it already has. One toggle → both the crosshair snaps to OHLC and drawings snap to bars; this matches user mental model ("magnet on").
3. **Line styling**: expose color/width/dashed for `vertLine`/`horzLine` and the axis **label background** (`labelBackgroundColor`) themed from `TH` (the chart already themes grid/border via `applyOptions` at `:235`).
4. **Persist** the chosen crosshair mode + magnet state to the workspace.

---

### 3.6 Bar-close countdown

#### 3.6.1 Desired behavior

A live readout of **time remaining until the current bar closes**, shown on/near the price-axis last-bar label (or in the status strip), updating every second, formatted `H:MM:SS` or `M:SS`. It must reflect the active timeframe and pause for time-independent chart types.

#### 3.6.2 Current status — already implemented (state-based)

The prototype **has** the countdown logic, computed from wall-clock modulo the bar length:

```js
// BazaarNama.jsx:383
useEffect(() => {
  if (NONSTANDARD.includes(chartType)) { setCountdown(''); return undefined; } // skip Renko/Range/etc.
  const sec = tfSec(tf);
  const tick = () => {
    const now = Math.floor(Date.now() / 1000);
    const rem = sec - (now % sec);
    const h = Math.floor(rem/3600), m = Math.floor((rem%3600)/60), s = rem%60;
    setCountdown(h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                   : `${m}:${String(s).padStart(2,'0')}`);
  };
  tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
}, [tf, chartType]);
```

And it is rendered (status strip, `:944`):

```js
{countdown && (<span ...><span className="opacity-60">⏱</span><b>{countdown}</b></span>)}
```

`docs` §3 still lists this as "☐ bar-close countdown" because that checklist predates the implementation; **the feature exists at the state level** but has two limitations:

- It is rendered only in a **status strip**, not anchored to the **price-axis last-bar label** where pro users expect it.
- `rem = sec - (now % sec)` uses **UTC-epoch modulo**, which is correct for fixed-width intraday TFs but **wrong for calendar TFs** (`W1`, `MN`, future `3M/6M/12M`) — those don't close on epoch-multiples. With `MN` modeled as flat `2592000`, the countdown drifts from the true month end.

#### 3.6.3 Implementation plan — countdown

1. **Calendar-aware remaining time.** Replace `sec - (now % sec)` with a `nextBarClose(tf, now, tz)` helper: for fixed-width TFs keep the modulo math; for `isoWeek`/`month`/`span` TFs compute the next boundary date (in the display time-zone) and subtract. This reuses the same boundary logic as §3.1.4(b) bucketing — one source of truth for "where does a bar end".
2. **Anchor to the axis.** Render the countdown as a label attached to the **last price** on the right scale (a custom price-line label or an overlay-canvas badge positioned at the last bar's y/x), in addition to the status strip, so it reads like a native axis countdown.
3. **Color cue.** Tint the badge as it approaches zero (e.g. amber < 60 s, red < 10 s) to signal imminent close.
4. Keep the existing `NONSTANDARD` guard (`:385`) so Range/Renko/Kagi/P&F (time-independent) show no countdown.

---

### 3.7 Time-zone selection & axis label formatting

#### 3.7.1 Desired behavior

The user picks a **display time-zone** (e.g. UTC, Asia/Tehran, America/New_York, Europe/London, Asia/Tokyo). All **time-axis tick labels**, **crosshair time label**, **session shading boundaries** (§3.8), and the **calendar bucketing** (§3.1.4) must be computed in that zone. `lightweight-charts` v5 does not localize zones internally; it renders times from the numeric `time` you provide and from `timeScale` formatting hooks. The supported approach is to pass a `tickMarkFormatter` (on `timeScale`) and a `localization.timeFormatter` that convert the bar's UTC timestamp to the chosen zone using `Intl.DateTimeFormat(..., { timeZone })`.

#### 3.7.2 Current status

The time axis is created with only visibility/border options and **no zone handling**:

```js
// BazaarNama.jsx:195
timeScale: { timeVisible: true, borderColor: TH.grid, rightOffset: 6 },
```

There is no time-zone picker, no `tickMarkFormatter`, no `localization.timeFormatter`. Labels therefore render in the library default (UTC-based). `docs` §3 does not yet enumerate a TZ row, but the production parity target requires it (session shading is impossible to place correctly without it).

#### 3.7.3 Implementation plan — time-zone & formatting

1. **TZ state + picker** persisted to the workspace; default `Asia/Tehran` (our primary audience) with quick-picks for UTC/London/NY/Tokyo.
2. **Formatters** via `chart.applyOptions`:
   - `timeScale.tickMarkFormatter(time, tickType, locale)` → format the UTC epoch in the selected zone, choosing granularity by `tickType` (time for intraday, day/month for higher TFs).
   - `localization.timeFormatter(time)` → the crosshair vertical-line time label, also zone-converted.
   - `localization.priceFormatter` / per-series `priceFormat: { type:'price', precision, minMove }` for axis price label precision driven by the instrument's tick size (forex 5-digit vs. JPY pairs 3-digit) — ties into the instrument-specs work already in the project.
3. **Re-bucket on TZ change.** Because calendar TFs and sessions depend on local date, switching TZ must recompute derived candles (§3.1.4) and re-paint session bands (§3.8).
4. **DST correctness.** Use `Intl`/zone data (never fixed offsets) so London/NY DST transitions move session boundaries automatically — consistent with the project's existing DST-aware session handling on the backend.

---

### 3.8 Sessions: shading, breaks, and axis coloring (London / NY / Tokyo)

#### 3.8.1 Desired behavior

Two distinct features:

- **Session shading / coloring** — translucent vertical bands behind the candles (and/or a colored ribbon on the time axis) marking the **Tokyo (Asia)**, **London**, and **New York** trading sessions, with the London/NY overlap optionally highlighted. Boundaries are in the **display time-zone** (§3.7) and **DST-aware**.
- **Session breaks** — for instruments that pause (futures, some CFDs, weekends for FX), the time axis should **not** draw flat dead space across the gap; bars are contiguous and the break is shown as a thin separator. (Pure spot-FX is ~24×5, so the main visible "break" is the weekend gap, which `lightweight-charts`' business-day/contiguous time handling already collapses since we feed only existing bars.)

#### 3.8.2 Current status

**Neither** session shading nor explicit session-break markers exist on the chart. `docs` §3: "Session indicators (London/NY/Tokyo) on axis ☐". The app does have *market-open* state (`marketOpen`, `setMarketOpen` at `:159`) and a `session_filter`/session-coverage system on the **backend** (per project memory: all five sessions supported, DST-aware), but none of that is surfaced as on-chart session bands. The drawing/overlay infrastructure needed exists (`overlayRef` canvas + `DrawingLayer` + crosshair `dl.render()` hook), and forward-projection of colored zones is already done for AI signals (`aiZonesRef`, `drawZone` at `:417–419`, `zoneWindow` at `:397`), which is the exact rendering primitive session bands need.

#### 3.8.3 Implementation plan — sessions

1. **Session model.** Define sessions in UTC base hours and convert to the display TZ with DST awareness (reuse backend session definitions to stay consistent):
   - Tokyo/Asia ≈ 00:00–09:00 UTC, London ≈ 08:00–17:00 UTC, New York ≈ 13:00–22:00 UTC (illustrative; final values come from our session-coverage config). Compute each day's local start/end via `Intl` so DST shifts apply.
2. **Render bands.** Draw translucent rectangles spanning each session's time range across the visible bars on the **overlay canvas**, repainting on `subscribeVisibleLogicalRangeChange` (`:221`) and `subscribeCrosshairMove` (`:222`) — both already call `dl.render()`, so add a `paintSessions()` pass there. Convert session start/end epochs to x-pixels via `chart.timeScale().timeToCoordinate(...)`. Highlight the London↔NY overlap with a stronger tint.
3. **Axis ribbon (optional).** A thin colored strip along the bottom time axis (separate overlay strip) tinted per active session, for a compact indicator that doesn't obscure candles. Toggleable independently of full-height bands.
4. **Session-break separators.** For non-24h instruments, when consecutive bars straddle a configured break, draw a faint vertical separator at that x — derived from the same session model. For spot-FX the weekend gap is handled naturally by feeding only existing bars (contiguous time), so no flat dead space appears.
5. **Toggle + legend.** A "Sessions" toggle in the toolbar, plus a small legend (Tokyo/London/NY swatches). Persist to workspace.
6. **TZ coupling.** All band x-coordinates recompute whenever the display TZ (§3.7) changes; this is why §3.7 must land before/with §3.8.

---

### 3.9 Cross-cutting: workspace persistence

Symbol, timeframe, indicators, and drawings already persist to `localStorage` via the `WS_KEY` workspace (`BazaarNama.jsx:39–41`, restored at `:209–210`). The new settings in this chapter — **scaleMode, scale lock, invert, crosshair mode, magnet, display time-zone, sessions-on** — must all be added to the same `saveWS`/`loadWS` payload so a refresh restores the complete axis/scale/crosshair state. This is a small, uniform change applied per sub-section above and is listed here so it isn't forgotten in any one of them.

### 3.10 Parity scorecard (this chapter)

| Capability | TradingView | Pro-Chart now | After this spec |
|---|---|---|---|
| Timeframes 1s..12M | 20+ | ◑ 5 native + 4 derived (9 shown) | full ladder; seconds/M1 gated on tick feed |
| Custom / Range TF | yes | ☐ | Custom parser + Range (chart-types ch.) |
| Scale: Regular/Log/Percent | yes | ✅✅✅ | ✅ (+ persisted) |
| Scale: Indexed-to-100 | yes | ☐ | ✅ |
| Auto / Lock | yes | ◑ auto only | Lock + Reset added |
| Invert | yes | ☐ | ✅ |
| Dual / multi price scales | yes | ☐ (panes only) | left scale + overlay `priceScaleId` |
| Crosshair Cross/Dot/Arrow/Hidden | yes | ◑ Cross only | all four |
| Magnet crosshair | yes | ◑ drawings only | unified with chart `CrosshairMode.Magnet` |
| Bar-close countdown | yes | ◑ exists (status strip, fixed-width only) | axis-anchored + calendar-aware |
| Session shading (LDN/NY/TKY) | yes | ☐ | overlay bands + axis ribbon |
| Session breaks | yes | ☐ (weekend natural) | explicit separators for non-24h |
| Time-zone selection | yes | ☐ | Intl-based, DST-aware picker |
| Axis label formatting | yes | ◑ default | tickMark/time/price formatters |

This closes the §3 gap from `docs/TRADINGVIEW_REFERENCE.md` with concrete `lightweight-charts` v5 API bindings and exact insertion points in the existing BazaarNama code.


---

## 4. Drawing Tools — Complete Catalog & Interaction Spec

This chapter specifies **every** drawing tool TradingView ships (110+ across 10 groups) as a build target for **Pro-Chart** — lightweight-charts v5 + our custom Canvas `DrawingLayer` (`frontend/academy/src/bazaarnama/drawings.js`) + React. For each tool we give: the anchor **points** it needs, the **geometry/rendering math** (in chart-space coordinates `{t: unix, p: price}` → screen via `_x(t)`/`_y(p)`), the **interaction** (click sequence, handles, drag/edit), **style options**, our **current status** (cited from `drawings.js`), and the **implementation plan** (the canvas `draw` fn, `handlePoints`, and `hit-test`).

### 4.0 Current engine baseline (what `drawings.js` already gives us)

`DrawingLayer` is a single full-pane `<canvas>` overlay positioned above the lightweight-charts canvas. It stores drawings as plain objects in `this.drawings[]`, persists anchors in **chart-space** (`{t,p}`) so they survive pan/zoom, and re-projects every frame in `render()` using `_x = timeScale().timeToCoordinate(t)` and `_y = series.priceToCoordinate(p)`. This is the correct architecture and **every** tool below plugs into it.

Already implemented (≈12 tools): `trend`, `ray`, `hline`, `vline`, `rect`, `fib`, `fibext`, `longshort`, `text`, `channel` (parallel, 3-pt), `pitchfork` (Andrews, 3-pt). Plus the infrastructure that the whole catalog reuses:

- **Multi-point capture** via `this.pending` + `NEED = {channel:3, pitchfork:3}` (line 138). New N-point tools just add to this map.
- **Selection / handles / drag**: `selectAt`, `_handlePoints(d)` (line 95), `_hitHandle` (line 105), `dragHandle`/`dragMove` (lines 157–159), `_moveBy` (line 106), `_drawHandles` (line 280).
- **Hit-testing**: `_hit(x,y)` (line 189) with point-to-segment distance for lines and bbox for areas.
- **Undo/redo unlimited**: `_pushUndo`/`undo`/`redo` (lines 44–49), snapshot via deep clone.
- **Object Tree API**: `removeAt`, `toggleVisible`, `toggleLock`, `setStyle`, `lockAll`, `hideAll`, `static label()`.
- **Magnet snap**: `_snap(pt)` (line 69) snaps to nearest candle O/H/L/C.
- **Style fields already honored** in `_draw`: `color`, `width`, `dashed` (setLineDash line 289), `visible`, `locked`.

The catalog below is organized so each tool declares a **type string**, the **anchor schema**, and the three functions it must contribute. To scale past ~12 tools the recommended refactor (see §4.11) is a **tool registry**: `REGISTRY[type] = { points, draw(ctx,d,api), handles(d,api), hit(d,x,y,api), label, defaults }`. Until then, new tools are added as `if (d.type===...)` branches in `_draw`, `_handlePoints`, `_hit` exactly like the existing ones.

Shared coordinate helpers used by all tools (already in file): `_x(t)`, `_y(p)`, `_t(x)`, `_p(y)`, `_barWidth()`. Shared style read: `ctx.strokeStyle=d.color; ctx.lineWidth=d.width||1.5; ctx.setLineDash(d.dashed?[6,4]:[])`.

---

### 4.1 Cursors (6)

Cursors are not stored drawings — they are global pointer **modes** that change crosshair behavior and the snap policy. They live on `DrawingLayer` state, not in `this.drawings[]`.

| Tool | Anchor pts | Behavior | Status | Plan |
|---|---|---|---|---|
| Cross (crosshair) | — | Full-width/height crosshair lines following pointer; price/time labels on axes | ◑ baseline `cursor` mode (`setTool('cursor')`, line 82) | Use lightweight-charts native `crosshair: {mode: Normal}`; our overlay draws nothing |
| Dot | — | Small dot follows pointer, no lines | ☐ | `this.cursorStyle='dot'`; in `move` draw a 3px arc at `(x,y)` on a transient layer |
| Arrow | — | Plain OS arrow, no crosshair | ☐ | `crosshair.mode=Hidden`; `cv.style.cursor='default'` |
| Demonstration | — | Animated highlight ring to point at things during screen-share | ☐ | `move` pushes a fading ring `{x,y,born:Date.now()}`; render with decaying alpha over 1.2s |
| Magic (smart select) | — | Hover auto-highlights the nearest object & shows its handles without click | ☐ | In `move`, when no tool active, call `_hit(x,y)`; if ≥0 set `this.hover` and draw a faint outline (we already compute `this.hover`, line 162) |
| Eraser | — | Click/drag deletes any object touched | ☐ | tool `'eraser'`: in `down`/`move` call `_hit`, if ≥0 `removeAt(hit)` (respect `locked`) |

**Interaction:** selecting a cursor sets a radio state in the toolbar; only one active. Cross/Arrow/Dot affect `crosshair.mode` + `cv.style.cursor`. Magic & Eraser are overlay-driven.

**Implementation:** add `this.cursor='cross'` and a `setCursor(name)` that maps to lightweight-charts `applyOptions({crosshair:{mode}})` plus our hover/eraser logic. No new entries in `_handlePoints`/`_hit` (cursors aren't drawings).

---

### 4.2 Lines & Trend (9)

All line tools share a **2-anchor** base (`p0`,`p1`) except the single-anchor horizontals/verticals and the dual Cross Line. The math difference is only how far each end extends.

| Tool | type | Pts | Geometry | Status |
|---|---|---|---|---|
| Trend Line | `trend` | p0,p1 | segment p0→p1 | ✅ (line 323) |
| Ray | `ray` | p0,p1 | start p0, extend through p1 to +∞ | ✅ (line 324, k=4000) |
| Info Line | `infoline` | p0,p1 | segment + label: Δprice, Δ%, Δbars, Δtime, angle, slope | ☐ |
| Extended Line | `extline` | p0,p1 | infinite **both** directions through p0,p1 | ☐ |
| Trend Angle | `angle` | p0,p1 | ray + an arc at p0 showing degrees vs horizontal | ☐ |
| Horizontal Line | `hline` | p (1) | y=const full width, price label | ✅ (line 318) |
| Horizontal Ray | `hray` | p0 (anchor), extends right | horizontal from p0.t to +∞ at p0.p | ☐ |
| Vertical Line | `vline` | t (1) | x=const full height | ✅ (line 319) |
| Cross Line | `crossline` | p0 (1) | hline + vline through one anchor | ☐ |

**Geometry math (the extension factor is everything):**
- Trend: `moveTo(x0,y0); lineTo(x1,y1)`.
- Ray: direction `(dx,dy)=(x1-x0,y1-y0)`; draw `x0,y0 → x0+dx·k, y0+dy·k` with large `k`. Better than fixed k=4000: clip to canvas bounds via Liang–Barsky so the endpoint is exactly on the frame edge (cleaner at high zoom).
- Extended line: extend in **both** directions: `p_a = p0 - dir·k`, `p_b = p1 + dir·k` (clip both to frame).
- Horizontal Ray: `moveTo(x0,y); lineTo(W,y)` (right-extending); store `p0={t,p}` so the left end is anchored at a bar and only grows rightward.
- Trend Angle: same as ray, plus compute `θ = atan2(-(y1-y0), (x1-x0))·180/π` and draw a small arc + `θ.toFixed(1)+'°'` near p0. Note angle is **screen-space** (depends on bar spacing & price scale) — TradingView’s "angle" is pixel-based, so recompute on every render.
- Info Line: label content uses chart-space deltas: `Δp=p1-p0`, `Δ%=(p1-p0)/p0·100`, `Δbars=round((x1-x0)/barWidth)`, `Δtime=t1-t0`. Render a small boxed label at the segment midpoint.
- Cross Line: draw `hline(p0.p)` and `vline(p0.t)` together; single handle at the intersection.

**Interaction:** 2-pt tools = press-drag-release (already handled by `this.tmp` flow, lines 149–171) — `down` sets `p0=p1=pt; dragging=true`; `move` updates `p1`; `up` commits. 1-pt tools (`hline`,`vline`,`hray`,`crossline`,`angle`-pivot) = single click commit (pattern at lines 146–147). Handles: line tools expose endpoint handles (already done generically by `_handlePoints` falling through to `p0`/`p1`, lines 101–102); `hline`/`vline` expose one axis handle (lines 96–97). Add a **midpoint handle** for whole-line nudge (optional; `dragMove` already moves the whole object).

**Style:** color, width, dashed/dotted, left/right extend toggles, "show price/percent labels", arrow heads on ends (for `trend`).

**Status & plan:** `trend/ray/hline/vline` done. To add the other five:
- `infoline`/`extline`/`angle`: branches in `_draw` after the existing `trend`/`ray` block (line 323), reusing `x0,y0,x1,y1`. `_handlePoints` already returns p0/p1 handles. Add to `_hit` segment branch (line 199) — for `extline` skip the `t∈[0,1]` clamp so the whole infinite line is hittable.
- `hray`/`crossline`: store as single-anchor; add to `_handlePoints` (mirror `hline`), and to `_hit` (combine the `hline` + `vline` checks for `crossline`).

---

### 4.3 Channels & Pitchforks (10)

These are 3-point tools (one is 2-pt). Our `pending`/`NEED` system (line 138) already drives 3-pt capture for `channel` and `pitchfork`.

| Tool | type | Pts | Geometry | Status |
|---|---|---|---|---|
| Parallel Channel | `channel` | 3 | line p0→p1, parallel copy offset by p2 | ✅ (line 291) |
| Regression Trend | `regchannel` | 2 (span) | least-squares fit over bars in [t0,t1] + ±k·σ bands | ☐ |
| Flat Top/Bottom | `flatchannel` | 3 | one sloped line + one **horizontal** line | ☐ |
| Disjoint Channel | `disjoint` | 4 | two independently-anchored parallel-ish lines | ☐ |
| Andrews Pitchfork | `pitchfork` | 3 | median p0→mid(p1,p2) + two tine lines through p1,p2 | ✅ (line 300) |
| Schiff Pitchfork | `schiff` | 3 | handle moved to mid(p0, mid(p1,p2)) in **price only** | ☐ |
| Modified Schiff | `mschiff` | 3 | handle at mid(p0, mid(p1,p2)) in **both t & p** | ☐ |
| Inside Pitchfork | `inpitch` | 3 | tines drawn inside, narrower angle | ☐ |

**Parallel Channel math (current):** P0,P1 define the main line; P2 gives offset `(ox,oy)=(P2-P0)`; the parallel line is `P0+off → P1+off`; fill the quad. Already implemented (lines 291–298). **Improvement:** the offset should be perpendicular distance, not raw vector — for a true parallel channel offset only the component normal to the p0→p1 direction matters, but TradingView actually uses the full vector (channel can shear). Keep as-is.

**Regression channel:** collect candle closes between `t0,t1`; fit `price = a + b·bar`. Draw center line `a+b·x`; draw upper/lower at `±k·σ` (k user-set, default 2) where σ is the std of residuals. Needs `this.candles` (already available via `setCandles`). 2-pt span selection; recompute on pan only if endpoints change (cache the fit on the drawing object).

**Andrews Pitchfork (current):** median from P0 toward `mid(P1,P2)`; tines parallel to median through P1 and P2 (lines 303–306, factor k=3 to extend). **Schiff variants** change only the **origin** of the median:
- Schiff: origin = `(P0.t, (P0.p + mid(P1,P2).p)/2)` — shift origin in price to midpoint.
- Modified Schiff: origin = `mid(P0, mid(P1,P2))` in both axes.
- Inside: median from `mid(P1,P2)` style with tines drawn toward the inside.
All reuse the existing pitchfork draw; only the `origin` computation differs → factor a helper `_pitchforkOrigin(P, mode)` and pass `d.mode`.

**Optional median lines:** TradingView pitchforks can add Fibonacci tine multiples (0.25/0.382/0.5/0.618/0.75/1.0/1.5 of the channel width). Render extra parallel tines at those fractions of `(P2-P1)`.

**Interaction:** 3 sequential clicks (P0 pivot, P1, P2). Live preview after each click via `this.pending.preview` (lines 163, 255–260) — already works. Handles: three endpoint handles via the `d.pts` branch of `_handlePoints` (line 99) — already generic. Dragging any handle re-derives the geometry.

**Style:** color, width, dashed, fill opacity (channel quad / pitchfork body), extend left/right, "show median", Fib levels on pitchfork.

**Plan:** `flatchannel`/`disjoint`/`regchannel` add to `NEED` (3,4,2) and get `_draw` branches modeled on the existing `channel` block. `schiff`/`mschiff`/`inpitch` are `d.mode` variants of `pitchfork` — minimal code. `_hit` for channels: test both parallel segments + interior (reuse area bbox logic loosely, or test distance to each of the 2–3 lines).

---

### 4.4 Fibonacci (11)

The crown of the catalog. We have 2 of 11 (`fib`, `fibext`). All Fib tools share a **level array** and a `base`/`diff` price computed from anchors. The default ratio set: `[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2.0, 2.618, 3.618, 4.236]` (user-editable per drawing).

| Tool | type | Pts | Geometry | Status |
|---|---|---|---|---|
| Fib Retracement | `fib` | 2 | horizontal levels between p0.p,p1.p | ✅ (line 326) |
| Trend-Based Fib Extension | `fibext` | 2 (uses p0,p1) | projected levels beyond p1 | ✅ (line 310) — should be **3-pt** (A,B,C) |
| Fib Channel | `fibchannel` | 3 | parallel channel with Fib-spaced inner lines | ☐ |
| Fib Time Zone | `fibtime` | 2 | **vertical** lines at Fib bar-counts from anchor | ☐ |
| Fib Speed/Resistance Fan | `fibfan` | 2 | rays from p0 through Fib divisions of the box | ☐ |
| Trend-Based Fib Time | `fibtimeext` | 3 | vertical lines at Fib multiples of (t1-t0) projected from t2 | ☐ |
| Fib Circles | `fibcircles` | 2 | concentric circles radius = Fib·|p0→p1| | ☐ |
| Fib Spiral | `fibspiral` | 2 | golden/log spiral from center p0 | ☐ |
| Fib Speed/Resistance Arcs | `fibarcs` | 2 | concentric semicircles/ellipses at Fib radii | ☐ |
| Fib Wedge | `fibwedge` | 3 | rays fanning between two bounding lines | ☐ |
| Pitchfan | `pitchfan` | 3 | pitchfork-anchored fan of Fib rays | ☐ |

**Retracement (current):** `top=max(p0.p,p1.p)`, `bot=min`, `rng=top-bot`; for each level `price=top-rng·lv`; horizontal line `xa→xb` + label `%  price` (lines 326–330). ✅. **Add:** per-level color & fill bands (alternate translucent fills between consecutive levels — TradingView’s signature look): between level i and i+1 fill `rgba(level_color, 0.06)`.

**Extension (current):** uses only p0,p1 and a fixed level list (line 310). **Correct it to 3-pt (A→B→C):** measure `|A.p−B.p|`, project from C: `price = C.p ± retrace_dir·|A.p−B.p|·lv`. Change `fibext` into a `pts:[A,B,C]` tool in `NEED` (=3) and rewrite the draw to use the three anchors. Levels extend to the right of C.

**Fib Time Zone:** anchor defines bar-zero and unit = `t1-t0` (or 1 bar). Draw vertical lines at cumulative Fib bar counts `[0,1,2,3,5,8,13,21,34,55,89,...]`: `x = _x(t0 + n·barTime)`. Label each with the index. (`vline` rendering reused per level.)

**Fib Fan:** bounding box from p0→p1. Vertical division: for each `lv`, point on the right edge at `y = y0 + (y1−y0)·lv`; ray from `(x0,y0)` through that point, extended. Also horizontal Fib divisions optionally. Pure screen-space rays.

**Fib Circles / Arcs:** center = p0, base radius `R = hypot(x1−x0, y1−y0)`. For each `lv` draw `arc(x0,y0, R·lv, 0, 2π)` (circles) or `0..π` (arcs). Because price and time axes have different scales, TradingView draws these as **ellipses** in price/bar units — to stay scale-correct, draw with `ctx.ellipse(x0,y0, rx·lv, ry·lv, ...)` where `rx,ry` are the box half-extents. Recompute every frame (radius is pixel-derived, so it visually scales with zoom — acceptable, matches TV).

**Fib Spiral:** parametric log spiral `r(θ)=a·φ^(θ/(π/2))` with φ=1.618, center p0, scale `a` from p0→p1 distance. Sample θ over several turns, `lineTo` each point. Pure decorative.

**Fib Wedge / Pitchfan:** wedge = two bounding rays (from p0 through p1 and through p2) with Fib-spaced intermediate rays. Pitchfan = pitchfork median with Fib-fractioned tines (see §4.3 optional levels).

**Interaction:** 2-pt = drag (retracement/circles/arcs/spiral/timezone/fan); 3-pt = clicks (extension/channel/wedge/pitchfan/timeext). Each level row is editable in the style dialog (toggle visibility, set ratio, color). Dragging an anchor handle re-derives all levels. **Reverse** toggle swaps `0%`/`100%`.

**Style:** levels table (ratio, on/off, per-level color, line style), "use one color", show prices, show percents, fill background between levels, extend left/right, "reverse", "levels based on log scale".

**Plan:** `fib` mostly done (add fills + level table). `fibext` → make 3-pt + correct projection. New Fib tools each get a `_draw` branch; the level-iteration helper `_fibLevels(d)` returns `[{ratio, price|coord, color}]` to centralize. Hit-test: for line-based Fib (retracement/fan/timezone) test distance to each level line; for circles/arcs test distance to nearest ring (`|hypot(x−cx,y−cy) − R·lv| < near`).

---

### 4.5 Gann (4)

Square-based tools that mix price and time geometry. All use 2 anchors defining a box/scale.

| Tool | type | Pts | Geometry |
|---|---|---|---|
| Gann Box | `gannbox` | 2 | rectangle subdivided by Gann ratios on both axes (price levels + time levels) |
| Gann Square (Fixed) | `gannsq_fixed` | 1 anchor + size | fixed-pixel square grid with diagonals |
| Gann Square | `gannsq` | 2 | square fitted to box; price/time grid + 1×1/2×1/1×2 diagonals |
| Gann Fan | `gannfan` | 2 | rays at Gann angles 1×1, 2×1, 3×1, 4×1, 8×1 and inverses from p0 |

**Gann Box math:** box from p0→p1. Levels at ratios `[0,0.25,0.382,0.5,0.618,0.75,1]` on **price** (horizontal lines) and the same on **time** (vertical lines). Draw the grid + label price/percent. Diagonals from corner to corner.

**Gann Fan math:** the 1×1 line means "1 price unit per 1 time unit". Compute unit slope from the box: `slope_1x1 = (p1.p−p0.p)/(t1−t0)` mapped to pixels. Draw rays at slope multiples `{1/8,1/4,1/3,1/2,1,2,3,4,8}` from p0, each a ray clipped to frame, labeled (e.g. "1×1","2×1"). Because Gann needs a fixed price/time scale, store the per-bar price unit on the drawing so it stays consistent on zoom.

**Interaction:** 2-pt drag to set the box/scale; handles on the two corners; style dialog toggles which angles/levels show and their colors. **Plan:** new branches; reuse `rect` bbox for the box, draw grid lines via loops, fan via ray loop. Hit-test = bbox for box, nearest-ray for fan.

---

### 4.6 Patterns (13)

Pattern tools are **point-sequences** with connecting polylines and labels at vertices; several add ratio validation (harmonic patterns).

| Tool | type | Pts | Geometry / labels |
|---|---|---|---|
| XABCD | `xabcd` | 5 | polyline X-A-B-C-D; show Fib ratios AB/XA, BC/AB, CD/BC, AD/XA; shade triangles |
| Cypher | `cypher` | 5 | XABCD with Cypher-specific ratio targets |
| ABCD | `abcd` | 4 | polyline A-B-C-D; ratios BC/AB, CD/AB |
| Triangle Pattern | `tripattern` | 3 | filled triangle, vertex labels |
| Three Drives | `threedrives` | 7 | 3 drives + 2 corrections, ratio labels |
| Head & Shoulders | `hns` | 5 (or 7) | LS-H-RS peaks + neckline; labels | 
| Elliott Impulse (12345) | `ell_impulse` | 6 | polyline 0-1-2-3-4-5, degree-colored labels |
| Elliott Correction (ABC) | `ell_abc` | 4 | polyline 0-A-B-C |
| Elliott Triangle/Combo | `ell_combo` | up to 6 | WXYXZ / ABCDE labels |
| Cyclic Lines | `cyclic` | 2 | repeating vertical lines at fixed bar period |
| Time Cycles | `timecycles` | 2 | repeating verticals like cyclic, period from span |
| Sine Line | `sine` | 2 | sine wave fit between two anchors |

**XABCD/ABCD/Cypher math:** store `pts:[...]`; draw polyline connecting them; at each vertex draw a label (X,A,B,C,D). For each leg compute the **retracement ratio** between consecutive legs in **price**: e.g. `AB/XA = |B.p−A.p| / |A.p−X.p|`; display near the leg with a tolerance check (green if within harmonic tolerance, e.g. Gartley B≈0.618). Optionally shade the two triangles X-A-B and B-C-D with translucent fill. The "PRZ" (potential reversal zone) box at D can be drawn from the converging ratios.

**Head & Shoulders:** 5 pivots (LS, head, RS plus two trough points) → connect peaks, draw the **neckline** through the two troughs extended right; label "H","LS","RS"; optionally project target = neckline − head height.

**Elliott waves:** ordered pivots; polyline with wave labels in the chosen degree (color/size by degree: Grand Supercycle … Subminuette). Just labels + connecting lines; no validation required for v1.

**Cyclic / Time Cycles:** 2 anchors define period `Δt=t1−t0`; draw vertical lines at `t0 + n·Δt` for n=0..N across the visible range (recompute N each frame from visible time span). Cyclic uses equal spacing; could optionally use a half-sine guide.

**Sine Line:** anchors give wavelength (`λ=t1−t0`) and amplitude (`|p1−p0|`); plot `p(t)=mid + A·sin(2π·(t−t0)/λ)` sampled across the span.

**Interaction:** N sequential clicks (each click drops a vertex, preview line to cursor — reuse `pending`+`preview`). Backspace during construction removes last vertex. Handles per vertex (the generic `d.pts` path, line 99). **Plan:** add each `type` to `NEED` with its point count; `_draw` branch draws polyline via a shared `_polyline(ctx,pts)` helper + a `_vertexLabels(ctx,pts,labels)` helper + (harmonics) `_legRatios(pts)`. Hit-test: nearest segment among consecutive points (loop the existing segment-distance code).

---

### 4.7 Projection & Measurement (13)

Trade-planning and measurement tools — high value for our forex audience.

| Tool | type | Pts | Geometry |
|---|---|---|---|
| Long Position | `longshort` (long) | 2 | entry/stop → 2R target; risk(red)/reward(green) zones | ✅ (line 331) |
| Short Position | `longshort` (short) | 2 | mirror of long | ✅ (sign of risk) |
| Forecast | `forecast` | 2 | projected price path with target & time, % move label | ☐ |
| Bars Pattern | `barspattern` | 2 (span) | clones the selected bars’ OHLC shape elsewhere | ☐ |
| Ghost Feed | `ghostfeed` | 2 | synthetic future candles continuing the trend | ☐ |
| Projection | `projection` | 3 | extrapolate move by ratio | ☐ |
| Price Range | `pricerange` | 2 | vertical measure: Δprice, Δ% | ☐ |
| Date Range | `daterange` | 2 | horizontal measure: Δbars, Δtime | ☐ |
| Date & Price Range | `dprange` | 2 | box measure: Δp, Δ%, Δbars, Δtime | ☐ |
| Anchored VWAP | `avwap` | 1 (anchor bar) | cumulative VWAP from anchor forward | ☐ |
| Fixed Range Volume Profile | `frvp` | 2 (span) | histogram of volume-by-price in [t0,t1] | ◑ (global VP exists) |
| Anchored Volume Profile | `avp` | 1 (anchor) | VP from anchor to last bar | ☐ |

**Long/Short Position (current):** entry=`p0.p`, stop=`p1.p`, risk=`entry−stop`, target=`entry+2·risk` (line 332). Draws green reward zone (entry→target) and red risk zone (entry→stop) with labels (lines 335–339). ✅. **Add:** editable R-multiple (`d.rr`, default 2), account-risk sizing label (lot size from `risk` + account %), draggable separate target handle, and a third anchor for the **right edge** (time horizon). Currently target is hard 2R — expose `d.targetPrice` so the green zone is independently draggable.

**Price/Date/Date-Price Range:** the measure tools (TV’s ruler). `pricerange`: two anchors at same x; draw a vertical bracket + label `Δp / Δ%`. `daterange`: horizontal bracket + `Δbars / Δtime`. `dprange`: a box (reuse `rect`) with a center label showing all four deltas. These are trivially built from existing `rect` bbox + the delta formulas in §4.2.

**Anchored VWAP:** from anchor bar forward, accumulate `Σ(typical·vol)/Σvol` where `typical=(h+l+c)/3`; needs `this.candles` with volume. Produce a polyline `{t, vwap}` and draw it. Optionally ±1/2 σ bands. Recompute when anchor moves; cache series on the drawing.

**Fixed/Anchored Volume Profile:** we already have a **global** profile renderer (`setProfile` + render block lines 241–251) drawing horizontal volume bars with POC highlight. For **Fixed Range**, compute the histogram only over candles in `[t0,t1]` and draw it within that x-range (not full pane). Bucket prices into N bins, sum volume, mark POC (max bin) and Value Area (70% of volume around POC). Anchored VP = same but `[anchor, lastBar]`. Reuse the bar-drawing loop, parameterized by x-window.

**Forecast / Ghost Feed / Bars Pattern / Projection:** future-projection tools. Forecast: from p0 (now) to p1 (future target), draw a shaded cone + label `Δ%` and ETA. Ghost Feed: generate N synthetic candles continuing slope; draw as faux candlesticks on the overlay. Bars Pattern: copy OHLC of bars in a source span and re-render them starting at a target anchor (clone shape). These are advanced — schedule after the measurement/VWAP/VP set.

**Interaction:** Long/Short = drag entry→stop (done); ranges = drag box; VWAP/AVP = single click anchor; FRVP = drag span. Handles via existing generic paths. **Plan:** ranges & dprange are near-free (rect + labels). AVWAP and FRVP/AVP need `this.candles`/volume (available). Add `_draw` branches and, for VP variants, refactor the existing profile loop into `_drawProfile(ctx, buckets, x0, x1)` so global VP and ranged VP share it.

---

### 4.8 Shapes (12)

Free geometric shapes — area objects with a 2-anchor bbox (or point list for freehand).

| Tool | type | Pts | Geometry | Status |
|---|---|---|---|---|
| Rectangle | `rect` | 2 | axis-aligned box, fill+stroke | ✅ (line 325) |
| Rotated Rectangle | `rotrect` | 3 | box rotated to align p0→p1, width from p2 | ☐ |
| Circle | `circle` | 2 | center+radius or bbox-inscribed circle | ☐ |
| Ellipse | `ellipse` | 2 | bbox-inscribed ellipse | ☐ |
| Triangle | `tri` | 3 | 3 vertices, fill | ☐ |
| Arc | `arc` | 3 | curved arc through/by 3 points | ☐ |
| Curve | `curve` | 3 | quadratic Bézier | ☐ |
| Double Curve | `dcurve` | 4 | two joined Béziers (S-curve) | ☐ |
| Path | `path` | N | polyline of straight segments, click-to-add | ☐ |
| Polyline | `polyline` | N | closed/open polygon | ☐ |
| Brush | `brush` | N (freehand) | smoothed freehand stroke | ☐ |
| Highlighter | `highlighter` | N (freehand) | thick translucent freehand stroke | ☐ |

**Math:**
- Rotated rect: direction `u=normalize(p1−p0)`; width `w` = perpendicular distance of p2 to line p0p1; corners = `p0, p1, p1+n·w, p0+n·w` where `n=perp(u)`. Draw the quad.
- Circle/Ellipse: bbox `(x0,y0)-(x1,y1)`; `cx,cy=center`, `rx=|x1−x0|/2`, `ry=|y1−y0|/2`; `ctx.ellipse(cx,cy,rx,ry,0,0,2π)`; fill+stroke. Circle forces `rx=ry`.
- Triangle: `pts:[3]` → `moveTo/lineTo/closePath`, fill.
- Curve/Bézier: `ctx.quadraticCurveTo(ctrl, end)` (control = p1, ends p0,p2). Double = two quads.
- Path/Polyline: `pts:[N]`, sequential `lineTo`; polyline `closePath` if `d.closed`.
- Brush/Highlighter: capture raw `{t,p}` samples on `mousemove` while pressed (not press-drag-release of one segment — a stroke). Simplify with Douglas–Peucker to cut point count; smooth with Catmull-Rom. Highlighter = brush with `width≈12` and `globalAlpha≈0.3`, `lineCap='round'`.

**Interaction:** bbox shapes (rect/circle/ellipse) = press-drag-release (existing `tmp` flow). Triangle/arc/curve = N clicks. Path/polyline = click-to-add + double-click/Esc to finish (extend `pending` to allow variable length, finishing on dblclick). Brush/highlighter = press, sample on move, release commits the stroke. Handles: bbox shapes get 4–8 handles (corners+midpoints); poly tools get a handle per vertex.

**Style:** stroke color/width/dash, fill color, fill opacity, "background" toggle. Rect already does `globalAlpha=0.12` fill (line 325) — generalize to `d.fillOpacity`.

**Plan:** rect done. circle/ellipse/tri/rotrect are quick `_draw` branches reusing `x0,y0,x1,y1` (+p2). path/polyline/brush/highlighter need the variable-length capture mode — add `this.freehand` capture in `_bind` (`down` starts, `move` pushes samples, `up` commits). Hit-test: ellipse `((x−cx)/rx)²+((y−cy)/ry)²≈1`; polygon = point-in-poly or near-edge; freehand = near any sample.

---

### 4.9 Annotations (15+)

Text & marker objects, mostly single-anchor.

| Tool | type | Pts | Geometry | Status |
|---|---|---|---|---|
| Text | `text` | 1 | free text at anchor | ✅ (line 321) |
| Anchored Text | `atext` | 1 | text pinned to a screen corner | ☐ |
| Note / Price Note | `note` | 1 | small marker that expands to a tooltip note | ☐ |
| Callout | `callout` | 2 | text bubble + leader line to a target point | ☐ |
| Comment | `comment` | 1 | speech-bubble shape with text | ☐ |
| Price Label | `pricelabel` | 1 | tag showing the price at anchor, pinned to scale | ☐ |
| Signpost | `signpost` | 1 | flagpole + label hanging from a price | ☐ |
| Flag Mark | `flag` | 1 | colored flag icon at anchor | ☐ |
| Pin | `pin` | 1 | map-pin marker | ☐ |
| Table | `table` | 1 | grid of text cells anchored to a corner | ☐ |
| Arrow Marker | `arrowmark` | 2 | arrow with head from p0→p1 | ☐ |
| Arrow up/down/left/right | `arrowdir` | 1 | directional arrow glyph at anchor | ☐ |
| Image | `image` | 2 | bitmap placed in a bbox | ☐ |
| Icons / Emojis / Stickers | `icon` | 1 | glyph/emoji at anchor (hundreds) | ☐ |

**Text (current):** `fillText(d.text)` at `_x(d.t),_y(d.p)` (line 321); prompt-based input (line 148). ✅. **Upgrade:** in-place `<textarea>` editor positioned over the canvas (double-click to edit), multi-line, font family/size/weight/color/bg/border, alignment, rotation (`ctx.rotate`).

**Math/render:**
- Callout/Comment: rounded-rect bubble sized to text (`measureText`) at p0; leader line/tail from bubble to p1 (callout) or a small tail (comment). Draw with `roundRect` + `lineTo` tail.
- Price Label: pin to the right scale at `_y(d.p)`; draw a tag `◀ price` flush to the axis (`x=W−tagW`); follows price on zoom.
- Signpost: vertical pole from `_y(d.p)` up by fixed px, with a label box at top.
- Flag/Pin/Arrow-dir/Icon/Emoji: draw a glyph. Use an inline SVG-path set or a font (emoji via `fillText`). Anchor at `(x,y)`; pick from a palette in the style dialog (`d.glyph`).
- Arrow Marker: line p0→p1 + arrowhead polygon at p1 (`θ=atan2(dy,dx)`, two wings at `θ±150°`).
- Table: rows/cols of strings; lay out a grid of cells with `strokeRect`+`fillText`, anchored to a chosen pane corner (screen-pinned, not chart-space).
- Image: load into `Image()`, `drawImage` into the bbox. Store data-URL (or asset id) on the drawing.

**Interaction:** single-click place (text/flag/pin/icon/pricelabel/signpost/arrowdir/note/table); 2-click (callout target, arrow marker, image bbox). Double-click any text object to edit. Handles: anchor handle (move); callout gets a second handle for the target; table/image get bbox handles.

**Style:** font family/size/style/color, background color+opacity, border, text align, bold/italic, "wrap", rotation; glyph picker for icons/flags/arrows; for price label, "track price".

**Plan:** text done (upgrade input). The rest are `_draw` branches; most are single-anchor so they fall into the `_handlePoints` text-like path (line 98). Build a shared `_label(ctx, x, y, text, opts)` (measures text, draws bg box + border + text) reused by callout/comment/signpost/pricelabel/table-cell. Icons: ship a curated glyph set (our own SVG paths / emoji) — **do not import TradingView assets**. Hit-test annotations via their drawn bbox (`measureText` width × line-height).

---

### 4.10 Toolbar Controls (drawing UX)

These wrap the catalog and are mostly **done** in `drawings.js`:

| Control | Status / cite |
|---|---|
| Color picker | ✅ `this.color`, `setTool(t,color)` (line 82) |
| Magnet (weak, snap O/H/L/C) | ✅ `_snap` (line 69), `setMagnet` |
| Magnet (strong, snap to exact wick) | ◑ extend `_snap` to also snap **time** to bar center always (currently snaps price to OHLC; strong mode would force `t=best.t` and pick nearest of OHLC within a tighter radius) |
| Stay in Drawing Mode | ✅ `stayInMode`, `setStayInMode`, `_reset` keeps tool (line 207) |
| Lock All / Hide All | ✅ `lockAll`, `hideAll` (lines 59–60) |
| Remove selected / Remove all | ✅ `removeAt`, `clearAll`, `clearLast` |
| Undo/Redo unlimited | ✅ `_pushUndo`/`undo`/`redo` (lines 44–49) |
| Object move/edit via handles | ✅ `dragHandle`/`dragMove`/`_handlePoints`/`_hitHandle` |
| Per-object style dialog | ◑ `setStyle` exists (line 57); needs a React panel binding color/width/dashed/fill/font/text per `type` |
| Object Tree (list + show/hide/lock/delete) | ✅ API present (`static label`, `toggleVisible`, `toggleLock`, `removeAt`); needs the React tree UI |
| Sync drawings across charts | ☐ broadcast `getDrawings()` to sibling panes via a shared store |
| Selective "remove drawings/indicators" menu | ☐ filter `this.drawings` by type |

**Critical refactor (enables the other ~95 tools cleanly):** replace the growing `if (d.type===...)` chains in `_draw`/`_handlePoints`/`_hit` with a **tool registry** keyed by `type`:

```
REGISTRY[type] = {
  npts,                       // clicks needed (drives NEED / pending)
  draw(ctx, d, api),          // api = {x,y,t,p,barWidth,W,H}
  handles(d, api) -> [{x,y,set(t,p)}],
  hit(d, x, y, api) -> bool,
  label, defaults             // style defaults
}
```

`render()`, `_handlePoints`, `_hit`, and the `down`/`up` capture logic then iterate the registry instead of hard-coding types. Most tools become ~15-line registry entries. This is the single highest-leverage change to close the TradingView gap and is the recommended next step.

### 4.11 Implementation roadmap (priority order)

1. **Tool registry refactor** (§4.10) — unblocks everything; migrate the existing ~12 tools into entries first (no behavior change), then add new ones.
2. **Lines pack** (info/extended/angle/h-ray/cross) — cheapest, reuse p0/p1.
3. **Measurement pack** (price/date/date-price range) — reuse `rect`; high user value.
4. **Fibonacci pack** — fix `fibext` to 3-pt; add circles/arcs/fan/timezone/channel; level table + fills.
5. **Shapes pack** (circle/ellipse/triangle/rotated-rect) + freehand mode (path/polyline/brush/highlighter).
6. **Channels/Pitchforks** (regression/flat/disjoint + Schiff variants via `d.mode`).
7. **Annotations** (callout/price-label/signpost/flag/pin/arrow/icon) + in-place text editor + glyph palette.
8. **VWAP & Volume Profile variants** (anchored VWAP, fixed-range VP, anchored VP) — reuse existing profile loop.
9. **Patterns** (XABCD/ABCD/Cypher/HnS/Elliott/cyclic/sine) — polyline + labels + ratio helper.
10. **Gann** (box/square/fan) — grid + ray loops.
11. **Projection** (forecast/ghost/bars-pattern/projection) — advanced, last.
12. **Cursors** (dot/arrow/demonstration/magic/eraser) + **strong magnet** + **per-object style dialog UI** + **Object Tree UI** + **cross-chart sync** — UX polish layered throughout.

Each new tool is, concretely, three additions: a `draw(ctx,d)` branch (or registry entry), a `handles(d)` return for editing, and a `hit(d,x,y)` test — all three already have working exemplars in `drawings.js` (`channel`/`pitchfork` for multi-point, `fib`/`longshort` for level/zone math, `rect` for bbox, `trend` for segment hit, `text`/`hline` for single-anchor). The architecture is sound; the work is breadth, not depth.

---

**Status summary:** Pro-Chart currently ships ~12 of TradingView’s 110+ drawing tools (≈11%), but already has the hard parts — chart-space anchoring, selection, draggable handles, whole-object move, unlimited undo/redo, magnet snap, multi-point capture, and an Object-Tree API. The remaining ~95 tools are mostly straightforward geometry on top of this proven overlay; the gating task is the registry refactor that turns each tool into a small declarative entry.


---

## 5. Indicators — Complete Catalog, Formulas & Settings Dialog

This chapter is the single source of truth for Pro-Chart's indicator engine: the complete catalog of ~100 priority built-ins, the **exact formula** for each, default inputs, target pane (overlay vs. sub), guide/reference lines, our **current status** against the existing registry in `frontend/academy/src/bazaarnama/indicators.js`, and the precise **implementation plan** (the `calc(c, i)` registry entry + the render shape the chart layer consumes). It also fully specifies the **Indicator Settings Dialog** (Inputs / Style / Visibility tabs, source picker, pane targeting, templates / save-as-default).

We do **not** copy TradingView code or Pine source. We re-implement public-domain technical formulas in our own series-oriented JS (arrays aligned 1:1 with candles; warm-up periods return `null`). Our render engine is `lightweight-charts v5` with native multi-pane support.

> **Status legend:** ✅ shipped in REGISTRY · ◑ partial / helper exists but not registered · ☐ not built
>
> **Calc contract.** Every indicator is a registry entry:
> ```js
> key: {
>   label: 'Persian label',
>   pane: 'main' | 'sub',          // overlay on price, or its own sub-pane
>   inputs: { period: 20, ... },   // default user inputs
>   color: '#hex',                 // primary plot color
>   calc: (c, i) => RenderShape     // c = OHLCV series, i = resolved inputs
> }
> ```
> `c` is `{ open, high, low, close, volume, time }` — each an array of numbers aligned to candles. `i` is the resolved inputs object (defaults overlaid with user overrides + a resolved `source` array, see §5.7).
>
> **Render shapes** (what the chart layer reads — already used by our renderer):
> - `{ line, guides?, range? }` — single sub/overlay line series. `guides`=horizontal reference levels, `range`=[min,max] for fixed sub-pane scale.
> - `{ line, signal, hist, macd:true }` — MACD-style: line + signal + histogram columns.
> - `{ line, signal, guides, range }` — two-line oscillator (%K/%D, Aroon up/down).
> - `{ upper, basis, lower, multi:true }` — banded overlay (Bollinger).
> - `{ lines: [{ data, color, dashed?, type?, opacity? }] }` — arbitrary multi-line overlay (Ichimoku, Pivots, Donchian, Keltner, SAR-as-dots).
> - `{ hist, palette:(v,i)=>color }` — colored histogram (Volume, AO, MACD hist).
> - `{ fill: { top, bottom, color } }` — cloud/area fill between two series (Ichimoku cloud, BB shade).
> - `{ markers: [{ time, position, shape, color }] }` — pivots H/L, ZigZag nodes, signal arrows.
> - `{ levels: [{ price, color, label, extendRight }] }` — horizontal S&R / VPVR POC / supply-demand zones.
>
> **Shared helpers** (extend `indicators.js`): `sma, ema, wma, hma, smma, rma, stdev, highest, lowest, change, atr, tr, linreg, hl2, hlc3, ohlc4`. Some already exist; the plan below adds the missing primitives once and reuses them everywhere.

---

### 5.0 Coverage snapshot

Our REGISTRY currently ships **30 indicators** (`ma, ema, wma, hma, vwap, bb, supertrend, rsi, macd, stoch, atr, cci, willr, obv, adx, donchian, keltner, ichimoku, dema, tema, vwma, psar, pivots, aroon, mfi, cmf, stochrsi, ao, tsi, cmo`). Plus `bollinger`, `vwma`, helpers exist as exported functions. The catalog below targets ~100. Net gap ≈ 70 indicators + the full settings dialog.

| Category | Target | Shipped ✅ | Gap ☐/◑ |
|---|---|---|---|
| Trend / Moving Averages | 17 | 11 | 6 |
| Momentum / Oscillators | 16 | 9 | 7 |
| Volatility | 8 | 4 | 4 |
| Volume | 9 | 4 | 5 |
| Pivots / Structure | 7 | 1 | 6 |
| **Total catalog** | **57 core + variants → ~100** | **29** | **~71** |

---

### 5.1 Trend / Moving Averages (overlay pane = `main`)

All single-line MAs share render shape `{ line }`. Source defaults to `close` unless noted; source is user-selectable (§5.7).

| # | Indicator | Exact formula | Defaults | Pane | Guides | Status | Plan |
|---|---|---|---|---|---|---|---|
| 1 | **SMA** | `SMA_t = (1/p)·Σ_{k=0..p-1} src_{t-k}` | period 20 | main | — | ✅ `ma` | `sma(src,p)` |
| 2 | **EMA** | `k=2/(p+1)`; `EMA_t = src_t·k + EMA_{t-1}·(1-k)`; seed = SMA(p) or first value | period 20 | main | — | ✅ | `ema(src,p)` |
| 3 | **WMA** | `WMA_t = Σ(src_{t-k}·(p-k)) / (p(p+1)/2)` | period 20 | main | — | ✅ | `wma(src,p)` |
| 4 | **HMA (Hull)** | `HMA = WMA( 2·WMA(src,p/2) − WMA(src,p), round(√p) )` | period 21 | main | — | ✅ | `hma(src,p)` |
| 5 | **SMMA / RMA (Wilder)** | `SMMA_t = (SMMA_{t-1}·(p-1) + src_t)/p`; seed = SMA(p) | period 14 | main | — | ☐ (rma used inside ATR/RSI; not registered) | add `smma(src,p)` helper + `smma` entry, `{ line }` |
| 6 | **DEMA** | `DEMA = 2·EMA(src,p) − EMA(EMA(src,p),p)` | period 20 | main | — | ✅ | `dema` |
| 7 | **TEMA** | `TEMA = 3·EMA1 − 3·EMA2 + EMA3` where `EMA2=EMA(EMA1)`, `EMA3=EMA(EMA2)` | period 20 | main | — | ✅ | `tema` |
| 8 | **TRIX** | `e=EMA(EMA(EMA(log? close,p)))`; `TRIX_t = 10000·(e_t − e_{t-1})/e_{t-1}` (%·100); signal = EMA(TRIX, sig) | period 18, sig 9 | **sub** | 0 | ☐ | new `trix` (sub): `{ line, signal, guides:[0] }` |
| 9 | **VWMA** | `VWMA_t = Σ(src·vol) over p / Σ(vol) over p` = `SMA(src·vol,p)/SMA(vol,p)` | period 20 | main | — | ✅ | `vwma` |
| 10 | **VWAP (session)** | `VWAP_t = Σ(tp·vol)/Σ(vol)` cumulative **from session/anchor start**; `tp=hlc3` | anchor=session | main | — | ✅ (cumulative; no session reset) | upgrade `vwap` to reset on `anchor` (session/day/week/anchored-bar) |
| 11 | **SuperTrend** | `mid=(H+L)/2`; `upper=mid+m·ATR(p)`, `lower=mid−m·ATR(p)`; bands ratchet; flip when close crosses; plot active band | period 10, mult 3 | main | — | ✅ | `supertrend.line` (+ add `trend` color flip) |
| 12 | **Parabolic SAR** | `SAR_{t+1}=SAR_t+AF·(EP−SAR_t)`; AF starts 0.02 step 0.02 cap 0.2; flip & reset on penetration | 0.02/0.02/0.2 | main | — | ✅ (dots) | `psar` → `{ lines:[{type:'dots'}] }` |
| 13 | **Ichimoku Cloud** | Tenkan=`(HH9+LL9)/2`; Kijun=`(HH26+LL26)/2`; SpanA=`(Tenkan+Kijun)/2` shifted +26; SpanB=`(HH52+LL52)/2` shifted +26; Chikou=close shifted −26 | 9/26/52 | main | — | ◑ (4 lines, no shift/cloud/Chikou) | add +26 displacement, Chikou, cloud `fill` |
| 14 | **ADX / DMI** | `+DI=100·RMA(+DM,p)/ATR`; `−DI=100·RMA(−DM,p)/ATR`; `DX=100·|+DI−−DI|/(+DI+−DI)`; `ADX=RMA(DX,p)` | period 14 | **sub** | 25 | ✅ (ADX only) | extend `adx` to plot +DI/−DI as `{ line, plus, minus, guides:[25] }` |
| 15 | **Aroon** | `Up=100·(p − bars since HH_p)/p`; `Down=100·(p − bars since LL_p)/p` | period 14 | **sub** | 30,70 | ✅ | `aroon` |
| 16 | **LinReg Curve** | For each window of length p, fit `y=a+b·x` (least squares), plot value at last bar = `a+b·(p-1)` | period 100 | main | — | ☐ | add `linreg(src,p)` helper → `{ line }` |
| 17 | **LSMA / Least-Sq MA** | LinReg endpoint shifted by `offset` (same fit) | length 25, offset 0 | main | — | ☐ | reuse `linreg`, add offset → `{ line }` |

**Helper additions for §5.1:** `smma(src,p)`, `linreg(src,p)→{line,slope,intercept}`, session-anchor reducer for VWAP, +26 series-shift utility, ADX `+DI/−DI` exposure.

---

### 5.2 Momentum / Oscillators (sub-pane = `sub`, fixed scale via `range`)

| # | Indicator | Exact formula | Defaults | Pane | Guides / range | Status | Plan |
|---|---|---|---|---|---|---|---|
| 18 | **RSI** | `RS = RMA(gain,p)/RMA(loss,p)`; `RSI = 100 − 100/(1+RS)` | period 14 | sub | 30,70 / [0,100] | ✅ | `rsi` |
| 19 | **RSI + MA** | RSI plus `MA(RSI, maLen)` overlay line | 14, MA 14 | sub | 30,70 | ☐ | extend rsi → `{ line, signal:sma(rsi,maLen) }` |
| 20 | **Stochastic** | `%K = 100·(C−LL_p)/(HH_p−LL_p)`; `%D = SMA(%K, d)`; smooth `%K = SMA(rawK, smoothK)` | 14,1,3 | sub | 20,80 / [0,100] | ✅ | `stoch` (add smoothK) |
| 21 | **Stochastic RSI** | Stoch(p) applied to RSI series: `(RSI−LL)/(HH−LL)·100`, smooth K & D | 14,14,3,3 | sub | 20,80 / [0,100] | ✅ | `stochrsi` |
| 22 | **MACD** | `line=EMA(close,fast)−EMA(close,slow)`; `signal=EMA(line,sig)`; `hist=line−signal` | 12,26,9 | sub | 0 | ✅ | `macd` (+ palette for hist) |
| 23 | **CCI** | `CCI=(tp − SMA(tp,p))/(0.015·MeanDev)`, `tp=hlc3`, MeanDev=mean(|tp−SMA|) | period 20 | sub | −100,100 | ✅ | `cci` |
| 24 | **Williams %R** | `%R = −100·(HH_p − C)/(HH_p − LL_p)` | period 14 | sub | −20,−80 / [−100,0] | ✅ | `willr` |
| 25 | **Momentum** | `MOM_t = src_t − src_{t-p}` | period 10 | sub | 0 | ☐ | new `mom`: `{ line, guides:[0] }` |
| 26 | **ROC** | `ROC = 100·(src_t − src_{t-p})/src_{t-p}` | period 9 | sub | 0 | ☐ | new `roc` |
| 27 | **Awesome Osc (AO)** | `AO = SMA(hl2,5) − SMA(hl2,34)`; colored vs prior bar | — | sub | 0 | ✅ | `ao` + palette green/red |
| 28 | **Accelerator (AC)** | `AC = AO − SMA(AO,5)` | — | sub | 0 | ☐ | reuse `ao`, new `ac` histogram |
| 29 | **Ultimate Osc** | `BP=C−min(L,C_{-1})`; `TR`; `avg_n=ΣBP_n/ΣTR_n`; `UO=100·(4·avg7+2·avg14+avg28)/7` | 7/14/28 | sub | 30,70 / [0,100] | ☐ | new `uo` (needs BP/TR sums) |
| 30 | **TSI** | `TSI=100·EMA(EMA(mom,long),short)/EMA(EMA(|mom|,long),short)`; signal=EMA(TSI,sig) | 25,13,13 | sub | 0 | ✅ (no signal) | extend `tsi` → add signal line |
| 31 | **SMI Ergodic** | TSI(longLen,shortLen) as SMI; signal=EMA(SMI,sigLen); osc=SMI−signal | 20,5,5 | sub | 0 | ☐ | reuse TSI math → `{ line, signal, hist }` |
| 32 | **Connors RSI** | `CRSI = avg( RSI(close,3), RSI(streak,2), PercentRank(ROC1, p) )` | 3,2,100 | sub | 20,80 / [0,100] | ☐ | new `crsi` (needs streak + percentRank helpers) |
| 33 | **Fisher Transform** | normalize hl2 to [−1,1] over p → `x`; `Fish=0.5·ln((1+x)/(1−x))`, EMA-smoothed; signal=Fish_{−1} | period 9 | sub | 0 | ☐ | new `fisher` → `{ line, signal, guides:[0] }` |
| 34 | **CMO** | `CMO=100·(ΣUp − ΣDn)/(ΣUp + ΣDn)` over p | period 9 | sub | −50,50 | ✅ | `cmo` |
| 35 | **Stoch Momentum Index** | `SMI=100· EMA(EMA(C−mid,a),b) / (½·EMA(EMA(HH−LL,a),b))`, mid=(HH+LL)/2 | 10,3,3 | sub | −40,40 / [−100,100] | ☐ | new `smi` |
| 36 | **Balance of Power** | `BOP=(C−O)/(H−L)`, optional SMA | period 14 | sub | 0 / [−1,1] | ☐ | new `bop` |

**Helper additions for §5.2:** `change(src,n)`, `percentRank(src,p)`, `streak(close)`, generic colored-histogram palette `(v,i)=> v>prev?up:dn`.

---

### 5.3 Volatility

| # | Indicator | Exact formula | Defaults | Pane | Render | Status | Plan |
|---|---|---|---|---|---|---|---|
| 37 | **Bollinger Bands** | `basis=SMA(src,p)`; `dev=m·StdDev(src,p)`; `upper=basis+dev`, `lower=basis−dev` | 20,2 | main | banded + fill | ✅ | `bb` (+ optional `fill`) |
| 38 | **Bollinger %B** | `%B=(src − lower)/(upper − lower)` | 20,2 | **sub** | line, guides 0,1 | ☐ | new `bbpercent`: `{ line, guides:[0,0.5,1] }` |
| 39 | **Bollinger Bandwidth** | `BBW=(upper − lower)/basis` (×100 optional) | 20,2 | **sub** | line | ☐ | new `bbw`: `{ line }` |
| 40 | **Keltner Channel** | `basis=EMA(close,p)`; `upper=basis+m·ATR(atrLen)`, `lower=basis−m·ATR` | 20,2,10 | main | banded | ✅ | `keltner` |
| 41 | **Donchian Channel** | `upper=HH_p`, `lower=LL_p`, `basis=(upper+lower)/2` | period 20 | main | banded | ✅ | `donchian` |
| 42 | **ATR** | `TR=max(H−L, |H−C_{-1}|, |L−C_{-1}|)`; `ATR=RMA(TR,p)` | period 14 | **sub** | line | ✅ | `atr` |
| 43 | **Std Deviation** | `σ = sqrt( (1/p)·Σ(src−mean)² )` | period 20 | **sub** | line | ☐ | add `stdev(src,p)` helper → `stddev` entry |
| 44 | **Envelopes** | `basis=MA(src,p)`; `upper=basis·(1+pct/100)`, `lower=basis·(1−pct/100)` | 20,1% (EMA opt) | main | banded | ☐ | new `envelopes` → `{ upper, basis, lower, multi:true }` |
| 45 | **Historical Volatility** | `HV=100·√(annualize)·StdDev(ln(C_t/C_{t-1}), p)`; annualize=√(365 or 252) | period 10 | **sub** | line | ☐ | new `hv` |
| 46 | **Chaikin Volatility** | `EMA(H−L,p)`; `CV=100·(EMA_t − EMA_{t-roc})/EMA_{t-roc}` | 10,10 | **sub** | 0 | ☐ | new `chaikinVol` |

**Helper additions:** `stdev(src,p)` (single-pass mean+variance), log-return series.

---

### 5.4 Volume

| # | Indicator | Exact formula | Defaults | Pane | Render | Status | Plan |
|---|---|---|---|---|---|---|---|
| 47 | **Volume** | raw `vol_t`, colored by `close≥open` | — | **sub** | histogram | ◑ (drawn outside registry) | register `volume`: `{ hist:vol, palette:(_,i)=>close[i]>=open[i]?up:dn }` |
| 48 | **Volume MA** | `SMA(vol, p)` overlaid on volume sub-pane | period 20 | sub | line | ☐ | extend volume → `{ hist, line:sma(vol,p) }` |
| 49 | **OBV** | `OBV_t = OBV_{t-1} + sign(C_t−C_{t-1})·vol_t` | — | **sub** | line | ✅ | `obv` |
| 50 | **Accum/Dist (A/D)** | `MFM=((C−L)−(H−C))/(H−L)`; `A/D += MFM·vol` (cumulative) | — | **sub** | line | ☐ | new `adline` |
| 51 | **Chaikin Oscillator** | `EMA(A/D,3) − EMA(A/D,10)` | 3,10 | **sub** | 0 | ☐ | reuse A/D → `chaikinOsc` |
| 52 | **MFI** | `tp=hlc3`; `RMF=tp·vol`; pos/neg by tp direction; `MFI=100−100/(1+ΣposRMF/ΣnegRMF)` over p | period 14 | **sub** | 20,80 / [0,100] | ✅ | `mfi` |
| 53 | **CMF** | `CMF=Σ(MFM·vol over p)/Σ(vol over p)` | period 20 | **sub** | 0 | ✅ | `cmf` |
| 54 | **Ease of Movement** | `DM=((H+L)/2 − (H_{-1}+L_{-1})/2)`; `BR=(vol/scale)/(H−L)`; `EMV=DM/BR`; `EoM=SMA(EMV,p)` | period 14 | **sub** | 0 | ☐ | new `eom` |
| 55 | **VWAP Bands** | VWAP ± `m·StdDev(tp−VWAP)` (or ±m·session σ) | 1,2,3 σ | main | banded multi | ☐ | extend vwap → `{ lines:[vwap, +1σ,−1σ,+2σ,−2σ] }` |
| 56 | **VPVR (Visible Range Volume Profile)** | Bucket price range into N bins; per bin sum vol of bars whose hlc3∈bin; POC=max-vol bin; VA=70% around POC; up/down split by candle color | bins 24, VA 70% | main (right-anchored) | horizontal `levels`/profile | ✅ (have VPVR) | keep; expose POC + VAH/VAL as `levels` |
| 57 | **Session Volume Profile** | Same as VPVR but reset & drawn per trading session/day | bins 24 | main | per-session profile | ☐ | reuse VPVR bucketer, group by session key |
| 58 | **Volume-Weighted MACD** | MACD using VWMA instead of EMA | 12,26,9 | sub | 0 | ☐ | reuse macd math on vwma |

**Helper additions:** `mfm(h,l,c)` money-flow-multiplier, session/day grouping key, profile bucketer (shared VPVR/Session-VP).

---

### 5.5 Pivots / Structure

| # | Indicator | Exact formula | Defaults | Pane | Render | Status | Plan |
|---|---|---|---|---|---|---|---|
| 59 | **Pivot Points Standard** | `P=(H+L+C)/3`; `R1=2P−L`, `S1=2P−H`; `R2=P+(H−L)`, `S2=P−(H−L)`; `R3=H+2(P−L)`, `S3=L−2(H−P)` (prev session H/L/C) | Auto/Classic | main | step `levels` | ✅ (Classic, P/R1-2/S1-2) | extend `pivots` with R3/S3 + **types**: Fibonacci, Woodie, Camarilla, DM (selector) |
| 60 | **Pivots — Fibonacci** | `R1=P+0.382·(H−L)`, `R2=P+0.618·R`, `R3=P+1·R`; symmetric S | — | main | levels | ☐ | add `type:'fib'` branch |
| 61 | **Pivots — Camarilla** | `R1=C+1.1·(H−L)/12` … `R4=C+1.1·(H−L)/2`; symmetric S | — | main | levels | ☐ | add `type:'camarilla'` |
| 62 | **Pivots — Woodie** | `P=(H+L+2C)/4`; R/S as Classic from this P | — | main | levels | ☐ | add `type:'woodie'` |
| 63 | **Pivot Points High/Low** | Fractal: bar is pivot-high if `H_t > H_{t±1..lb}`; pivot-low symmetric | left 5, right 5 | main | `markers` (▲/▼) | ☐ | new `pivotHL` → markers + optional S/R levels |
| 64 | **ZigZag** | Connect swings where price reverses ≥ `dev%` (or ATR×); confirmed retro | dev 5%, depth 10 | main | polyline `markers`+lines | ☐ | new `zigzag` → `{ lines:[zigzag], markers }` |
| 65 | **Auto Fib Retracement** | Take last ZigZag leg (A→B); draw fib levels 0/.236/.382/.5/.618/.786/1 between | dev 5% | main | `levels` | ☐ | reuse zigzag last leg → fib `levels` |
| 66 | **Support & Resistance** | Cluster pivot-H/L into price bands (tolerance ε); strength=touch count | lb 15, ε 0.1% | main | horizontal `levels` (weighted) | ☐ | new `srLevels` from pivotHL clusters |
| 67 | **Supply / Demand Zones** | Base candles before strong impulse (range×N); zone = base H..L; rated by departure strength & freshness | impulse 2×ATR | main | zone `levels` (rect) | ☐ | new `supplyDemand` → rect `levels` |
| 68 | **Williams Fractals** | `up` if `H_t` is max of `±2`; `down` if `L_t` is min of `±2` | n 2 | main | `markers` | ☐ | new `fractals` |

**Helper additions:** generic `pivotHigh/pivotLow(series, left, right)`, swing detector (zigzag core), level-clustering.

---

### 5.6 Pane / overlay rules & guide lines

- **Overlay (`main`)** = plotted on the price scale (all MAs, bands, channels, SAR, Ichimoku, Pivots, VWAP, structure levels).
- **Sub (`sub`)** = own pane below price with independent scale. For bounded oscillators we pass `range:[min,max]` so the sub-pane scale is **fixed** (RSI 0–100, Stoch 0–100, W%R −100–0) instead of auto-fitting — this matches TradingView and keeps guide lines meaningful.
- **`guides`** render as dashed horizontal `priceLine`s on the sub-pane (e.g. RSI 30/70). They are **user-editable** in the Style tab (value + color + on/off) — see §5.8.
- **Multi-pane via v5:** each `sub` indicator gets `chart.addPane()`; overlays attach to pane 0. The renderer reads `pane` to decide. Multiple sub indicators can share or stack panes (user choice in dialog → "pane targeting", §5.9).

---

### 5.7 Settings Dialog — Inputs tab

**Current status: ◑** — we only render raw number fields from `inputs`. We must build the full Inputs tab.

**Target layout.** Two-column form, one row per input, label (Persian) + control. Control type inferred from input schema (extend each registry entry with an optional `schema`):

```js
// optional, per-input metadata appended to registry entries
schema: {
  period: { type:'int', min:1, max:1000, step:1, label:'دوره' },
  mult:   { type:'float', min:0.1, max:10, step:0.1, label:'ضریب' },
  source: { type:'source', label:'منبع' },
  maType: { type:'select', options:['SMA','EMA','WMA','RMA','HMA'], label:'نوع میانگین' },
  pivotType: { type:'select', options:['Classic','Fibonacci','Woodie','Camarilla','DM'] },
}
```

**Source picker (☐ today — must build).** A dropdown bound to a special `source` input. Resolves a series *before* `calc` runs, so `calc` receives `i.source` as an array:

| Option | Series |
|---|---|
| close (default) | `c.close` |
| open / high / low | `c.open` / `c.high` / `c.low` |
| hl2 | `(high+low)/2` |
| hlc3 (typical) | `(high+low+close)/3` |
| ohlc4 | `(open+high+low+close)/4` |
| hlcc4 | `(high+low+close+close)/4` |
| **Another indicator** | output of any *already-added* indicator on the chart (e.g. "RSI on EMA"). The picker lists active overlays/oscillators; we feed that indicator's `line` array as the source. |

**Resolution pipeline:**
```js
function resolveSource(c, name, activeIndicators) {
  switch(name){
    case 'hl2':  return c.high.map((h,i)=>(h+c.low[i])/2);
    case 'hlc3': return c.high.map((h,i)=>(h+c.low[i]+c.close[i])/3);
    case 'ohlc4':return c.open.map((o,i)=>(o+c.high[i]+c.low[i]+c.close[i])/4);
    case 'open': case 'high': case 'low': case 'close': return c[name];
    default:     return activeIndicators[name]?.output.line ?? c.close; // indicator-on-indicator
  }
}
// then: calc(c, { ...inputs, source: resolveSource(...) })
```
Indicators currently reading `c.close` directly switch to `i.source` (with `c.close` as default) so the source picker works uniformly. OHLC-based indicators (ATR, Stoch, channels) keep raw H/L/C but may still expose a source for their MA component.

**Live recompute.** Inputs changes recompute `calc` on debounce (120 ms) and re-render in place — no full chart rebuild.

---

### 5.8 Settings Dialog — Style tab

**Current status: ◑** — only a color swatch + (for some) one number. We build a per-plot style grid.

Each render shape yields one or more **named plots**. The Style tab lists every plot with controls:

| Control | Applies to | Notes |
|---|---|---|
| **Visibility** (eye toggle) | every plot | hides series without removing indicator |
| **Color** | every line/hist | swatch + hex + recent palette |
| **Line width** | lines | 1–4 px |
| **Line style** | lines | solid / dashed / dotted (maps to v5 `LineStyle`) |
| **Plot type** | lines | line / step / area / columns / **circles (dots)** (SAR, fractals) |
| **Opacity / fill** | bands & clouds | fill toggle + opacity 0–100% (Bollinger shade, Ichimoku cloud) |
| **Histogram colors** | hist plots | up-color / down-color (Volume, MACD hist, AO) |
| **Precision** | value labels | decimals shown in legend |
| **Reference lines** | sub oscillators | per-guide: value field + color + on/off + "fill between" (e.g. RSI 30–70 background) |
| **Price line** | any plot | show last-value tag on axis (on/off + color) |

**Plot enumeration.** Derive plot list from the shape:
- `{ line }` → 1 plot ("Plot").
- `{ line, signal, hist }` → 3 plots (MACD / Signal / Histogram).
- `{ upper, basis, lower }` → 3 plots (Upper / Basis / Lower) + 1 "Background" fill.
- `{ lines:[...] }` → one plot per entry, named from a `name` field we add.
- `{ guides:[...] }` → one reference-line row each.

We add a `plots` descriptor to each registry entry so the Style tab knows names/defaults:
```js
plots: [
  { id:'macd',   name:'MACD',      kind:'line', default:{ color:'#60a5fa', width:2 } },
  { id:'signal', name:'Signal',    kind:'line', default:{ color:'#f97316', width:2 } },
  { id:'hist',   name:'Histogram', kind:'hist', default:{ up:'#26a69a', dn:'#ef5350' } },
],
refs: [ { id:'zero', value:0, color:'#787b86' } ],
```
The renderer merges `default` style with the user's saved per-plot overrides (stored in the indicator instance state).

---

### 5.9 Pane targeting, defaults, templates

- **Pane targeting (☐).** A dialog control lets a `sub` indicator be: (a) **new pane** (default), (b) **merge into existing pane** (overlay two oscillators), or (c) for some, **move onto price** (overlay). Implemented by reassigning the series' `paneId` and calling `chart.addPane()`/`moveSeriesToPane` (v5). Persisted per indicator instance.
- **Save as Default (☐).** Per-indicator button writes current Inputs+Style to `localStorage['proChart.ind.default.<key>']`; future inserts of that indicator load it.
- **Indicator Templates (☐).** Save the *whole indicator set* (every active indicator + its settings + pane layout) as a named template in `localStorage['proChart.indTemplates']` and via API for cross-device. Apply = clear + re-add all. Lives next to existing `bn_layouts` chart-layout store.
- **Reset to defaults** restores `inputs`/`plots.default`.

**Dialog shell.** Modal, RTL, tabs: **ورودی‌ها (Inputs)** · **استایل (Style)** · **مرئی‌بودن/پنل (Visibility & Pane)**. Footer: «پیش‌فرض» (save default) · «بازنشانی» (reset) · «لغو» · «تأیید» (Ok = apply+close). Apply is live; Cancel reverts to pre-open snapshot.

---

### 5.10 Indicator browser (insert dialog)

**Current status: ◑** — simple flat menu. Target: searchable dialog with tabs **Built-in / My scripts (NamaScript) / Favorites**, grouped by the §5.1–5.5 categories, Persian + English search, ☆ favorites, recents row. Selecting inserts with saved defaults (§5.9) and opens nothing (TV-like); gear icon opens the Settings Dialog.

---

### 5.11 Implementation order (priority)

1. **Helpers first** (one PR): `smma/rma`, `stdev`, `change`, `highest/lowest`, `linreg`, `hl2/hlc3/ohlc4`, `mfm`, `pivotHigh/Low`, colored-hist palette. Unlocks ~20 indicators cheaply.
2. **Source picker + Inputs tab** (§5.7) — highest UX leverage; refactor MAs/RSI/etc. to read `i.source`.
3. **Style tab + `plots`/`refs` descriptors** (§5.8) for all 30 existing entries.
4. **Fill gaps by category**: Momentum (Momentum, ROC, UO, Fisher, CRSI, SMI) → Volatility (BB%B, BBW, StdDev, Envelopes) → Volume (Volume+MA, A/D, Chaikin, EoM, VWAP bands, Session-VP) → Structure (PivotHL, ZigZag, AutoFib, S&R, Supply/Demand, Fractals, Pivot variants).
5. **Ichimoku upgrade** (displacement + cloud fill + Chikou), ADX +DI/−DI, VWAP session reset.
6. **Pane targeting + Save-as-default + Templates** (§5.9).

**Acceptance per indicator:** formula unit-tested against a known reference series (golden values), warm-up returns `null`, render shape matches the table, settings dialog round-trips inputs+style, and it appears in the categorized browser. No TradingView code is used — formulas are public-domain, implemented in our own `indicators.js`.

---

### 5.12 Worked registry examples (new entries)

These are concrete `calc(c, i)` entries to add, in the exact style of the existing REGISTRY, so the implementer can paste-and-go. Each assumes the §5.11 helpers exist.

**SMMA / RMA (Wilder) — overlay**
```js
smma: { label: 'SMMA / RMA (وایلدر)', pane: 'main', inputs: { period: 14 }, color: '#84cc16',
  calc: (c, i) => ({ line: smma(i.source ?? c.close, i.period) }) },
```

**Momentum & ROC — sub, zero guide**
```js
mom: { label: 'مومنتوم', pane: 'sub', inputs: { period: 10 }, color: '#60a5fa',
  calc: (c, i) => { const s = i.source ?? c.close;
    return { line: s.map((v,k)=> k>=i.period ? v - s[k-i.period] : null), guides:[0] }; } },
roc: { label: 'ROC (نرخ تغییر)', pane: 'sub', inputs: { period: 9 }, color: '#f472b6',
  calc: (c, i) => { const s = i.source ?? c.close;
    return { line: s.map((v,k)=> k>=i.period && s[k-i.period] ? 100*(v - s[k-i.period])/s[k-i.period] : null), guides:[0] }; } },
```

**Bollinger %B & Bandwidth — sub (reuse `bollinger`)**
```js
bbpercent: { label: 'باند بولینگر ٪B', pane: 'sub', inputs: { period:20, mult:2 }, color:'#22d3ee',
  calc: (c,i)=>{ const b=bollinger(i.source??c.close, i.period, i.mult);
    return { line: b.upper.map((u,k)=> u!=null ? ((i.source??c.close)[k]-b.lower[k])/(u-b.lower[k]) : null), guides:[0,0.5,1], range:[-0.5,1.5] }; } },
bbw: { label: 'پهنای باند بولینگر', pane: 'sub', inputs: { period:20, mult:2 }, color:'#94a3b8',
  calc: (c,i)=>{ const b=bollinger(i.source??c.close, i.period, i.mult);
    return { line: b.upper.map((u,k)=> u!=null && b.basis[k] ? (u-b.lower[k])/b.basis[k] : null) }; } },
```

**Std Deviation & Envelopes**
```js
stddev: { label: 'انحراف معیار', pane: 'sub', inputs: { period:20 }, color:'#fb7185',
  calc: (c,i)=>({ line: stdev(i.source??c.close, i.period) }) },
envelopes: { label: 'پاکت‌ها (Envelopes)', pane: 'main', inputs: { period:20, pct:1 }, color:'#a78bfa',
  calc: (c,i)=>{ const b=sma(i.source??c.close, i.period);
    return { upper:b.map(v=>v==null?null:v*(1+i.pct/100)), basis:b, lower:b.map(v=>v==null?null:v*(1-i.pct/100)), multi:true }; } },
```

**Accumulation/Distribution & Volume (with palette)**
```js
adline: { label: 'تجمع/توزیع (A/D)', pane:'sub', inputs:{}, color:'#0ea5e9',
  calc:(c)=>{ const o=new Array(c.close.length).fill(null); let ad=0;
    for(let k=0;k<c.close.length;k++){ const r=c.high[k]-c.low[k];
      const mfm=r?((c.close[k]-c.low[k])-(c.high[k]-c.close[k]))/r:0; ad+=mfm*(c.volume[k]||0); o[k]=ad; } return { line:o }; } },
volume: { label: 'حجم', pane:'sub', inputs:{ maLen:20 }, color:'#26a69a',
  calc:(c,i)=>({ hist:c.volume, line:sma(c.volume,i.maLen),
    palette:(_,k)=> c.close[k]>=c.open[k] ? '#26a69a' : '#ef5350' }) },
```

**Pivot Points High/Low — markers**
```js
pivotHL: { label: 'نقاط چرخش بالا/پایین', pane:'main', inputs:{ left:5, right:5 }, color:'#f59e0b',
  calc:(c,i)=>{ const m=[];
    for(let k=i.left;k<c.high.length-i.right;k++){
      let ph=true, pl=true;
      for(let j=1;j<=i.left;j++){ if(c.high[k-j]>=c.high[k])ph=false; if(c.low[k-j]<=c.low[k])pl=false; }
      for(let j=1;j<=i.right;j++){ if(c.high[k+j]>=c.high[k])ph=false; if(c.low[k+j]<=c.low[k])pl=false; }
      if(ph) m.push({ time:c.time[k], position:'aboveBar', shape:'arrowDown', color:'#ef5350', text:'H' });
      if(pl) m.push({ time:c.time[k], position:'belowBar', shape:'arrowUp', color:'#26a69a', text:'L' });
    } return { markers:m }; } },
```

These confirm every new render shape (`{line,guides}`, `{...,multi}`, `{hist,line,palette}`, `{markers}`) is already consumable by the renderer described in §5.x, so no chart-layer rewrite is needed — only registry growth + the dialog.

---

### 5.13 Edge cases & numerical notes

- **Warm-up alignment.** Every output array is candle-length; indices before the period (and any composed warm-ups, e.g. StochRSI = RSI warm-up + Stoch warm-up + K + D) are `null`. The renderer skips `null` (no gap artifacts). This is already the convention in `indicators.js` and must be preserved for all new entries.
- **Division guards.** Any `/(hh−ll)`, `/(upper−lower)`, `/ATR`, `/(pos+neg)` denominator must guard zero (`||1e-9` or neutral fallback 50/0) — matching existing `stoch`/`rsi`/`mfi` patterns — to avoid `Infinity`/`NaN` reaching the chart.
- **Volume absence.** Forex feeds may lack true volume (tick-volume only). Volume-based indicators (OBV, MFI, CMF, VWAP, VWMA, A/D, VPVR) fall back to tick-count volume; if `volume` is all zero/undefined, the indicator returns `null` and the dialog shows a "no volume data" note rather than a flat line.
- **Repaint warning.** ZigZag, Auto-Fib (last leg), Pivots High/Low, Supply/Demand, and SAR flips are **retro-confirmed** — the most recent unconfirmed swing can move as new bars arrive. The Style tab shows an info badge for these so users understand last-leg repaint; this matches TradingView behavior and is honest about the formula's nature.
- **Source-on-indicator cycles.** When "source = another indicator" (§5.7) is allowed, we forbid self/cyclic references in the picker (an indicator cannot pick itself or anything downstream of it) to prevent infinite recompute loops.
- **Performance.** All calcs are O(n·p) worst case; for large windows (LinReg 100, VPVR bins) we cap work and memoize per (key,inputs,dataVersion) so panning/zoom doesn't recompute unchanged indicators. Recompute is debounced (120 ms) on input edits and incremental on new live bars (append-only — recompute only the tail window, not the full series).


---

## 6. NamaScript Language — Full Spec & Pine Parity

NamaScript is Pro-Chart's user-scripting language: a Pine-inspired DSL that compiles to JavaScript and executes inside a sandboxed Web Worker with no DOM/network access and a hard timeout. The entire engine lives in a single file, `frontend/academy/src/bazaarnama/namascript.js` (the worker source is the `WORKER_SRC` template string; the public entry point is `runScript(source, candles, inputs, timeoutMs)` on line 215). The reference/examples library is `frontend/academy/src/bazaarnama/scriptlib.js`, the editor component is `frontend/academy/src/bazaarnama/CodeEditor.jsx`, and the Pine→NamaScript mapping doc is `docs/PINESCRIPT_REFERENCE.md`.

This chapter documents the **complete** language as it exists today, every gap versus Pine Script v6, and a concrete implementation plan for each — with the **#1 priority being the migration from our vectorized execution model to a true bar-by-bar engine**, which is the single change that unlocks real `var`/`varip` state, the history operator on dynamic series, and faithful `strategy.*` semantics.

Legend used throughout: **DONE** = implemented and faithful · **PARTIAL** = works but diverges from Pine or lacks options · **MISSING** = not implemented.

---

### 6.1 Execution model — vectorized vs bar-by-bar (the big gap)

This is the most important architectural fact about NamaScript and the root cause of most parity gaps.

**Pine Script** uses a **bar-by-bar** model. The whole script body is re-executed once for every bar, left-to-right. On bar *i*, every variable holds a *scalar* (its value on that bar), the history operator `close[1]` reaches back into prior executions, and `var x = 0` initializes **once** and persists its mutated value across bars. Drawing/strategy calls accumulate as the engine walks forward in time.

**NamaScript** today uses a **vectorized (series-oriented)** model. The user's source is wrapped in a single `new Function(...)` and executed **once** (`namascript.js:178-179`). Every "series" is a full JS array of length `N` (the bar count). `close`, `high`, etc. are arrays (line 160). Indicator functions like `sma`/`ema`/`rsi` (lines 30-43) take an array and return an array. Element-wise operator helpers — `add/sub/mul/div/gt/lt/and/or/iff/nz` (lines 14-25) — broadcast a scalar against an array via `arr()` (line 11) and apply the op cell-by-cell. Plot/strategy/label calls collect their arrays into output buckets that are `postMessage`d back (line 205).

| Aspect | Pine Script | NamaScript today | Source |
|---|---|---|---|
| Evaluation | Bar-by-bar, script re-run per bar | Vectorized, script run once over full arrays | `namascript.js:178` |
| A variable's value | Scalar on current bar | Whole array (series) | `namascript.js:160` |
| `close[1]` | Prior-bar scalar (history of execution) | `ref(close,1)` array shift, preprocessor rewrite | `namascript.js:60,174` |
| `var x = 0` | Init once, persists across bars | **Stripped** by preprocessor (no persistence) | `namascript.js:171` |
| `varip x` | Persists across intrabar ticks | **Stripped** | `namascript.js:171` |
| `x := expr` | Reassign within bar | Rewritten to `=` (plain JS reassign) | `namascript.js:172` |
| `if`/`for` over bars | Engine loops; body sees scalars | User must write JS loops over arrays manually | n/a |
| Per-bar drawing (`label.new` in loop) | One object per bar reached | `label.new(cond,src,...)` scans whole array once | `namascript.js:147` |

**Consequences of the vectorized model.** Many things work *more* concisely (an SMA is one vectorized call, no loop). But several Pine idioms are impossible or misleading:

- `var float runningMax = na` / `runningMax := math.max(runningMax, high)` — a stateful accumulator — cannot be expressed; `var` is stripped, so each line just re-declares a JS variable.
- Self-referential recurrence written in user space (e.g. a custom EMA `e := na(e[1]) ? close : alpha*close + (1-alpha)*e[1]`) cannot work, because `e` is being defined in terms of its own history *as it is computed bar by bar*. We hide this by shipping such recurrences as **built-ins** (`ema`, `rma`, `supertrend`, `sar` all loop internally — lines 31,32,50,90), but a user cannot author a new one.
- `strategy.position_size`, `strategy.equity`, pyramiding, and intrabar fills are not observable mid-script.
- `barstate.isnew/isconfirmed/isrealtime` are faked as constant or last-bar arrays (line 164) rather than reflecting real-time bar state.

#### 6.1.1 Target architecture: a true bar-by-bar VM

To reach real Pine parity we introduce a **compiled bar-by-bar virtual machine** while keeping the existing vectorized library as the fast path. Recommended design:

1. **Parser → AST.** Replace the regex preprocessor (`namascript.js:169-176`) with a real tokenizer + Pratt parser producing an AST. This is mandatory: the regex `[]→ref` rewrite (line 174) only matches `IDENT[n]`, not `(expr)[n]` or `f(x)[1]`, and the blanket `var`/`varip` strip corrupts identifiers containing those substrings if not word-bounded carefully.

2. **Series as ring buffers, not full arrays.** Each declared series becomes a `Series` object backing a history ring buffer. Reading `x[n]` returns the value `n` bars back. Writing advances the head once per bar.

3. **The bar loop owns time.** The VM executes:
   ```
   for (let bar = 0; bar < N; bar++) {
     ctx.bar = bar;
     runUserBody(ctx);          // user AST, sees scalars
     commitSeries(ctx);         // push this bar's values into ring buffers
     flushDrawObjects(ctx);     // labels/lines/boxes created this bar
   }
   ```
   `var`/`varip` declarations are hoisted to an init slot evaluated only when `bar===0` (or first valid bar); their slot persists across iterations — giving real persistence.

4. **Built-in `ta.*` becomes stateful per call-site.** Pine identifies each `ta.sma(...)` *call site* and keeps its own rolling state. We give every built-in invocation a stable call-site ID (assigned at compile time by AST position) and a state cell in the VM; on each bar the function consumes the new input and emits one scalar. The existing array implementations become the **batch/warm-up path** and a reference oracle for tests.

5. **History operator generalized.** `expr[n]` compiles to `ctx.hist(seriesId, n)`. Any sub-expression that is referenced with `[]` is auto-promoted to a tracked series (Pine does the same — only `series`-qualified values support history).

6. **Hybrid execution for performance.** Pure indicator scripts (no `var`, no per-bar drawing, no strategy) are detected at compile time and routed to the **existing vectorized engine** (zero regression, fast). Scripts that use `var`/`varip`/loops-over-bars/strategy run on the bar-by-bar VM. A compile flag `needsBarEngine` drives the choice.

7. **Determinism + sandbox unchanged.** Still a Web Worker, still timeout-guarded (`namascript.js:219`); the VM adds a per-iteration instruction budget to kill pathological scripts without relying solely on the wall-clock timeout.

This is the spine of every remaining parity item below: `var` semantics, faithful `strategy.*`, real `barstate`, and authorable recurrences all fall out of it.

---

### 6.2 Types & declarations

| Pine | Meaning | NamaScript status | Plan |
|---|---|---|---|
| `int` `float` `bool` `string` `color` | Base scalar types | PARTIAL — dynamic, untyped JS values | Add optional type annotations parsed but erased; keep dynamic at runtime |
| `series` vs `simple` vs `const` | Type *qualifiers* (compile-time) | MISSING | Track qualifier in AST to decide vectorized vs bar-engine; not user-visible |
| `var x = …` | Init once, persist | MISSING — stripped (`:171`) | Bar-engine init slot (§6.1.1.3) |
| `varip x = …` | Persist across intrabar ticks | MISSING — stripped | Same slot + tick-survival flag (real-time only) |
| `x := expr` | Reassignment | PARTIAL — rewritten to `=` (`:172`) | Bar-engine: real mutable binding distinct from `=` declaration |
| `na` | Empty value | PARTIAL — JS `null` | Keep `null`; add `na` keyword literal binding to `null` |
| `na(x)` | Is-empty test | DONE — `naf` (`:65`), exported as `na` (`:179`) | — |
| `nz(x, r)` | Replace na | DONE — `nz` (`:25`) | — |
| `int(x)` `float(x)` `bool(x)` | Casts | DONE — `toint/tofloat/tobool` (`:66-68`) | — |
| `array<T>` | Dynamic array | MISSING | Add `array.*` namespace (medium priority) |
| `matrix<T>` / `map<K,V>` | Collections | MISSING | Low priority |
| `[a, b] = f()` | Tuple destructuring | PARTIAL — JS destructuring works for our object-returning fns only if user uses `{}`; our multi-out fns return objects (e.g. `macd→{macd,signal,hist}` `:47`) | Document object-return convention; optionally support `[a,b]=` array tuples in bar-engine |
| `type MyType` (UDT) | User-defined types | MISSING | Low priority; needs bar-engine + parser |

**Key gap:** `var`/`varip`/`:=` are the headline missing semantics and are entirely blocked on §6.1.1.

---

### 6.3 The history operator `close[1]` / `ref`

| Pine | NamaScript | Status |
|---|---|---|
| `close[1]`, `high[2]`, `src[n]` | `ref(src, n)` via preprocessor (`:60`, rewrite `:174`) | PARTIAL |
| `expr[n]` where `expr` is computed | — | MISSING (regex only matches bare identifiers) |
| `f(x)[1]` | — | MISSING |

`ref(s,n)` (line 60) shifts a series array right by `n`, filling leading positions with `null`. The preprocessor regex `([A-Za-z_$][\w$]*(?:\.[…])*)\s*\[\s*(num|ident)\s*\]` rewrites `close[1]` → `ref(close, 1)` and `st.line[2]` → `ref(st.line, 2)`. **Limitations:** only an identifier (optionally dotted) followed by `[index]` is matched; a parenthesized expression, a function-call result, or a chained index (`x[1][1]`) is not rewritten. The index must be a literal or a single identifier — arithmetic indices like `close[n+1]` are not handled.

**Plan:** the real parser (§6.1.1.1) makes `[]` a first-class postfix operator on any series-typed expression, compiling to `ctx.hist(node, n)` with `n` allowed to be any int expression. In the vectorized fast path it lowers to a generalized `ref` that accepts an offset series.

---

### 6.4 `ta.*` — technical-analysis library (our biggest asset)

NamaScript ships a large `ta` namespace (object assembled at `namascript.js:108`). Distinct functions implemented today (~55, plus the aliases `smma`→`rma` and `dev`→`stdev`):

`sma, ema, rma, wma, hma, swma, alma, linreg, dema, tema, trix, vwma, vwap, stdev, variance, change, mom, roc, cum, sum, highest, lowest, highestbars, lowestbars, median, correlation, rsi, stochrsi, wpr, cmo, tsi, ao, mfi, tr, atr, cci, macd, bb, bbw, kc, kcw, donchian, stoch, supertrend, sar, dmi, adx, aroon, ichimoku, obv, ad, cmf, crossover, crossunder, cross, rising, falling, barssince, valuewhen, pivothigh, pivotlow`.

#### 6.4.1 Moving averages & trend

| Pine signature | NamaScript | Status | Notes / plan |
|---|---|---|---|
| `ta.sma(src, len)` | `ta.sma` | DONE | Sliding-window sum (`:30`) |
| `ta.ema(src, len)` | `ta.ema` | DONE | Recurrence, k=2/(p+1) (`:31`) |
| `ta.rma(src, len)` | `ta.rma`, alias `smma` | DONE | Wilder smoothing (`:32`) |
| `ta.wma(src, len)` | `ta.wma` | DONE | (`:33`) |
| `ta.hma(src, len)` | `ta.hma` | DONE | (`:34`) |
| `ta.swma(src)` | `ta.swma` | DONE | Fixed [1,2,2,1]/6 (`:73`) |
| `ta.alma(src, len, off, sig)` | `ta.alma` | DONE | (`:74`) |
| `ta.linreg(src, len, off)` | `ta.linreg` | DONE | Least-squares endpoint (`:75`) |
| `ta.vwma(src, len)` | `ta.vwma` | DONE | (`:35`) |
| `ta.vwap` (session anchored) | `ta.vwap()` | PARTIAL | Cumulative from bar 0, not session-anchored (`:36`). Plan: add session/anchor param when `session.*` lands |
| `ta.dema/tema` | `ta.dema/tema` | DONE | (`:76,77`) |
| `ta.trix` | `ta.trix` | DONE | (`:78`) |
| `ta.hma`/`ta.alma` variants | — | — | Covered |

#### 6.4.2 Oscillators

| Pine | NamaScript | Status | Notes |
|---|---|---|---|
| `ta.rsi(src, len)` | `ta.rsi` | DONE | Wilder avg gain/loss (`:43`) |
| `ta.stoch(src, high, low, len)` | `ta.stoch(p, d)` | PARTIAL | Ours assumes H/L globals, returns `{k,d}`; Pine takes explicit src/high/low and returns %K only. Plan: accept Pine arg order, keep `{k,d}` convenience |
| `ta.stochrsi` (not native; common) | `ta.stochrsi` | DONE | `{k,d}` (`:85`) |
| `ta.macd(...)`→`[macd,signal,hist]` | `ta.macd`→`{macd,signal,hist}` | PARTIAL | Object vs tuple return (`:47`); add tuple destructuring in bar-engine |
| `ta.cci(src, len)` | `ta.cci(len)` | PARTIAL | Hard-wired to hlc3 typical price (`:46`); add `src` param |
| `ta.mom(src, len)` | `ta.mom` | DONE | =change (`:39`) |
| `ta.roc(src, len)` | `ta.roc` | DONE | (`:40`) |
| `ta.tsi(src, short, long)` | `ta.tsi` | DONE | (`:83`) |
| `ta.cmo(src, len)` | `ta.cmo` | DONE | (`:82`) |
| `ta.wpr(len)` | `ta.wpr` | DONE | (`:80`) |
| `ta.mfi(src, len)` | `ta.mfi(len)` | PARTIAL | Uses hlc3 internally; add `src` (`:81`) |
| `ta.ao()` (not native ns) | `ta.ao` | DONE | (`:84`) |

#### 6.4.3 Volatility & bands

| Pine | NamaScript | Status | Notes |
|---|---|---|---|
| `ta.atr(len)` | `ta.atr` | DONE | rma(tr) (`:45`) |
| `ta.tr` / `ta.tr(handle_na)` | `ta.tr` | PARTIAL | No `handle_na` arg (`:44`) |
| `ta.stdev(src, len)` | `ta.stdev`, alias `dev` | PARTIAL | Population stdev; `ta.dev` in Pine is *mean abs deviation*, not stdev — alias is **semantically wrong**. Plan: implement true `ta.dev` separately |
| `ta.variance(src, len)` | `ta.variance` | DONE | stdev² (`:72`) |
| `ta.bb(src, len, mult)`→`[mid,up,low]` | `ta.bb`→`{mid,upper,lower}` | PARTIAL | Object return (`:48`) |
| `ta.bbw(...)` | `ta.bbw` | DONE | (`:93`) |
| `ta.kc(src, len, mult, useTR)` | `ta.kc` | DONE | (`:94`) |
| `ta.kcw(...)` | `ta.kcw` | DONE | (`:95`) |
| `ta.supertrend(factor, atrLen)`→`[st,dir]` | `ta.supertrend(p,m)`→`{line,dir}` | PARTIAL | Arg order differs (we take atrLen, mult); object return (`:50`) |
| Donchian (no native ta) | `ta.donchian(p)` | DONE | `{upper,lower,basis}` (`:96`) |

#### 6.4.4 Directional / structure / volume

| Pine | NamaScript | Status | Notes |
|---|---|---|---|
| `ta.dmi(len, smooth)`→`[+di,-di,adx]` | `ta.dmi`→`{plus,minus,adx}` | DONE | (`:87`) |
| (adx via dmi) | `ta.adx(p,sm)` | DONE | Convenience (`:88`) |
| `ta.sar(start, inc, max)` | `ta.sar` | DONE | (`:90`) |
| Aroon (no native ta) | `ta.aroon(p)`→`{up,down}` | DONE | (`:89`) |
| Ichimoku (no native ta) | `ta.ichimoku(c,b,sp)` | DONE | `{conversion,base,spanA,spanB}` (`:91`) |
| `ta.highest/lowest(src,len)` | `ta.highest/lowest` | DONE | (`:41,42`) |
| `ta.highestbars/lowestbars` | DONE | DONE | (`:100,101`) |
| `ta.change(src, len)` | `ta.change` | DONE | (`:38`) |
| `ta.rising/falling(src, len)` | DONE | DONE | (`:54,55`) |
| `ta.crossover/crossunder/cross` | DONE | DONE | (`:51-53`) |
| `ta.barssince(cond)` | `ta.barssince` | DONE | (`:56`) |
| `ta.valuewhen(cond, src, occ)` | DONE | DONE | (`:57`) |
| `ta.cum(src)` | `ta.cum` | DONE | (`:69`) |
| `ta.sum(src, len)` | `ta.sum` | DONE | Rolling window (`:70`) |
| `ta.pivothigh/pivotlow(left,right)` | DONE | PARTIAL | Ours hard-wires H/L; Pine `ta.pivothigh(src,l,r)` takes src (`:98,99`) |
| `ta.median(src, len)` | `ta.median` | DONE | (`:103`) |
| `ta.correlation(a, b, len)` | DONE | DONE | (`:102`) |
| `ta.obv` / `ta.accdist` (`ad`) | `ta.obv`/`ta.ad` | DONE | (`:104,105`) |
| `ta.cmf(len)` (no native ta) | `ta.cmf` | DONE | (`:106`) |

#### 6.4.5 `ta.*` still MISSING vs Pine v6 (plan to add)

| Pine | Purpose | Priority | Plan |
|---|---|---|---|
| `ta.dev(src, len)` | Mean absolute deviation | High | Implement correctly (our `dev` alias is wrong) |
| `ta.percentrank(src, len)` | Percentile rank of last value | Medium | Rolling count ≤ current / len ×100 |
| `ta.percentile_linear_interpolation` / `..._nearest_rank` | Percentile | Medium | Rolling sorted window |
| `ta.mode(src, len)` | Most frequent | Low | Rolling histogram |
| `ta.range(src, len)` | max−min over window | Low | highest−lowest |
| `ta.cog(src, len)` | Center of gravity | Low | Weighted sum |
| `ta.bb(...)` w/ `ta.dev` source | — | — | Covered |
| `ta.wad`, `ta.wvad` | Williams A/D variants | Low | Add to volume group |
| `ta.pivot_point_levels(...)` | Auto pivot levels | Medium | After bar-engine drawing |
| `ta.supertrend` exact Pine arg order | — | High | Normalize signatures (§6.4.6) |
| `ta.atr` / `ta.rsi` w/ `na`-handling parity | — | Medium | Bar-engine na propagation |

#### 6.4.6 Signature-normalization plan

Several functions diverge from Pine in **argument order** (`supertrend(p,m)` vs `supertrend(factor, atrLen)`; `stoch(p,d)` vs `stoch(src,high,low,len)`) and **return shape** (objects `{macd,signal,hist}` vs tuples `[…]`). Plan: introduce a thin Pine-compatibility shim layer that accepts Pine's exact signatures and returns tuple-destructurable values, while keeping the current ergonomic object forms as documented NamaScript extensions. This is purely additive and shipped alongside the parser upgrade so tuple destructuring `[a,b,c] = ta.macd(...)` works.

---

### 6.5 `math.*`

The `math` namespace (`namascript.js:109`) is broad and element-wise (each fn `un`/`bin`-broadcasts over series).

| Pine | NamaScript | Status |
|---|---|---|
| `math.abs/max/min/round/sqrt/pow` | DONE | (`:109`) |
| `math.avg` | DONE | Pairwise mean |
| `math.floor/ceil/sign/exp/log/log10` | DONE | (`:109`) |
| `math.sin/cos/tan/asin/acos/atan` | DONE | (`:109`) |
| `math.todegrees/toradians` | DONE | (`:109`) |
| `math.round_to_mintick(x)` | PARTIAL | Hard-coded 1e5 precision; should use symbol mintick |
| `math.sum(src, len)` | DONE | Aliased to `sumf` |
| `math.pi / math.e / math.phi` | DONE | (`:109`) |
| `math.random(min, max, seed)` | MISSING | Plan: seeded PRNG (deterministic) |
| `math.atan2`, `math.cosh/sinh/tanh` | MISSING | Low — wrap `Math.*` |
| `math.factorial`, `math.gcd` | MISSING | Low |

---

### 6.6 `str.*`

The `str` namespace (`namascript.js:159`) covers common operations.

| Pine | NamaScript | Status | Notes |
|---|---|---|---|
| `str.tostring(x, format)` | DONE | PARTIAL | Ignores `format` arg (uses smart `disp`) |
| `str.tonumber(s)` | DONE | DONE | — |
| `str.length(s)` | DONE | DONE | — |
| `str.contains/startswith/endswith` | DONE | DONE | — |
| `str.replace_all/split/upper/lower` | DONE | DONE | — |
| `str.format(fmt, …)` | DONE | PARTIAL | Supports `{0}` index but ignores format spec inside braces |
| `str.substring(s, begin, end)` | MISSING | — | Wrap `String.slice` |
| `str.pos / str.match / str.format_time` | MISSING | — | Add when `time.*` lands |
| `str.repeat / str.trim` | MISSING | — | Trivial wrappers |

---

### 6.7 `input.*`

Inputs are collected into the `inputs[]` bucket (`namascript.js:111-118`) and rendered as an auto-generated "Inputs" tab; user-supplied values arrive via the `IN`/`inputs` map and override defaults.

| Pine | NamaScript | Status | Notes |
|---|---|---|---|
| `input(defval, title)` | DONE | DONE | (`:112`) |
| `input.int(def,title,minval,maxval,step)` | DONE | DONE | min/max/step captured into decl (`:113`) |
| `input.float(def,title,minval,maxval,step)` | DONE | DONE | (`:114`) |
| `input.bool(def, title)` | DONE | DONE | (`:115`) |
| `input.string(def, title, options=[…])` | DONE | DONE | options carried (`:116`) |
| `input.color(def, title)` | DONE | PARTIAL | Declared (`:117`); UI color picker required |
| `input.source(close, title)` | PARTIAL | PARTIAL | Returns default series, doesn't actually let UI re-map source (`:118`) |
| `input.timeframe(…)` | MISSING | — | Needs `request.security`/timeframe model |
| `input.symbol(…)` | MISSING | — | Needs multi-symbol data fetch |
| `input.session(…)` | MISSING | — | Needs `session.*` |
| `input.time(…)` / `input.price(…)` | MISSING | — | Interactive chart-click inputs |
| `inline`, `group`, `tooltip`, `confirm` kwargs | MISSING | — | Add to decl + render in Inputs tab |

**Plan:** the declaration object already supports `min/max/step/options/type`; extend the React Inputs tab to render real widgets for `color`/`source`/`string-dropdown`, and wire `input.source` so the chosen series (close/open/hl2/…) is substituted before run.

---

### 6.8 Built-in series (OHLCV & bar state)

Built-ins are materialized at `namascript.js:160-164`.

| Pine | NamaScript | Status | Source |
|---|---|---|---|
| `open high low close volume` | DONE | DONE | arrays (`:160`) |
| `time` | DONE | PARTIAL | `time` array; no `time_close` |
| `hl2 hlc3 ohlc4 hlcc4` | DONE | DONE | computed (`:161`) |
| `bar_index` | DONE | DONE | (`:161`) |
| `last_bar_index` | DONE | DONE | (`:162`) |
| `last_bar_time` | MISSING | — | Add `T[N-1]` |
| `barstate.isfirst` | DONE | DONE | true on bar 0 (`:164`) |
| `barstate.islast` | DONE | DONE | true on bar N-1 |
| `barstate.isconfirmed` | PARTIAL | All-true except last (vectorized heuristic) |
| `barstate.isnew` | PARTIAL | Constant `true` (no intrabar concept) |
| `barstate.isrealtime / ishistory` | PARTIAL | Constant false/true |

**Plan:** `barstate.*` only becomes faithful under the bar-by-bar VM with a real-time feed; until then the heuristics are acceptable for historical backtests. Add `time_close`, `last_bar_time`, and `timenow`.

---

### 6.9 Plotting

Outputs collected into `plots/shapes/hlines/bgs/fills/barcolors/candleplots/zones` buckets and posted back (`namascript.js:205`).

| Pine | NamaScript | Status | Source |
|---|---|---|---|
| `plot(series, title, color, linewidth, style)` | DONE | PARTIAL | style captured but limited renderer (`:121`) |
| `plotshape(cond, title, style, location, color, text)` | DONE | PARTIAL | No `location`/`text` args (`:122`) |
| `plotchar(cond, …, char)` | PARTIAL | Routes to circle shape (`:123`) |
| `plotarrow(series)` | DONE | DONE | up/down by sign (`:125`) |
| `plotcandle(o,h,l,c)` | DONE | DONE | custom candles (`:127`) |
| `plotbar(o,h,l,c)` | MISSING | — | Alias plotcandle as bars |
| `hline(price, title, color, linestyle)` | DONE | PARTIAL | No linestyle (`:128`) |
| `fill(p1, p2, color)` | DONE | PARTIAL | Series fill only; no plot-handle fill, no gradient (`:132`) |
| `bgcolor(color, …)` | DONE | PARTIAL | Collects bars; renderer partial (`:129`) |
| `barcolor(color[, cond])` | DONE | DONE | all-or-conditional (`:146`) |
| `riskreward(entry,sl,tp1,tp2,tp3)` | DONE | DONE | **NamaScript-only extension** — green TP box / red SL box (`:144`) |

`riskreward` is our own value-add (not in Pine): it draws forward-looking TP/SL zones up to TP3, tuned for the trade-setup teaching use-case. Plan: keep and extend with R-multiple labels.

**Plot plan:** add `plot.style_*` constants (columns/area/stepline/histogram/cross), `location.*` and `text` for `plotshape`, true `plotchar` glyphs, and a renderer pass that honors `linewidth`/`style`/`linestyle`.

---

### 6.10 Drawing objects

| Pine | NamaScript | Status | Source |
|---|---|---|---|
| `label.new(x,y,text,…)` | PARTIAL | Only `label.new(cond, src, text, color)`, scans series (`:147`); `label.set_*`/`delete` MISSING |
| `line.new(x1,y1,x2,y2,…)` | PARTIAL | Creates line, returns id; `set_xy1/xy2/color/width` are **no-ops** (`:134`); `delete` works |
| `box.new(left,top,right,bottom,…)` | PARTIAL | Creates box; `set_top/bottom` no-ops (`:135`); `delete` works |
| `table.new(pos, cols, rows)` | PARTIAL | `table.new()` ignores position/dims; `table.cell(t,c,r,txt,col)` works; `cell_set_text` works (`:137-139`) |
| `polyline.new(…)` | MISSING | — |
| `linefill.new(…)` | MISSING | — |
| `label/line/box .get_*` | MISSING | — |
| `chart.point` (Pine v6 point type) | MISSING | — |

**Why the setters are no-ops:** in the vectorized model there is no per-bar timeline for an object to be mutated *as the script walks forward*; objects are created once with their final coordinates. The `xtime()` helper (`:130`) maps an `x` that is either a bar index or a timestamp to a chart time.

**Plan (bar-engine-dependent):** under the VM, `*.new` returns a live handle into a per-object store; `set_*` mutates it on the current bar; the renderer plays back the final state (and, for replay mode, the per-bar state). Add `polyline` (array of points), `linefill` (region between two lines), and full getters/setters. Until then, document objects as create-once.

---

### 6.11 `strategy.*` (backtesting)

Current strategy support is collected via `strat` (`namascript.js:9,150`) and simulated in a post-run loop (`namascript.js:182-203`).

| Pine | NamaScript | Status | Notes |
|---|---|---|---|
| `strategy(title, …)` w/ capital/commission/slippage | PARTIAL | commission+slippage read from `IN.__comm`/`__slip` per trade (`:183`); no initial capital, no qty/contracts model |
| `strategy.entry(id, direction, qty, limit, stop)` | PARTIAL | `strategy.entry(dir, cond)` — boolean signal series, no qty/limit/stop (`:150`) |
| `strategy.exit(id, from, profit, loss, stop, limit, trail_*)` | PARTIAL | `strategy.exit(dir, cond)` — condition only (`:150`) |
| `strategy.close(id, when)` | PARTIAL | `strategy.close(cond)` (`:150`) |
| `strategy.order` / `strategy.cancel` | MISSING | — |
| `strategy.long` / `strategy.short` consts | PARTIAL | Plain strings `'long'`/`'short'` |
| `strategy.position_size / position_avg_price` | MISSING | Not observable mid-script (vectorized) |
| `strategy.equity / netprofit / grossprofit / …` | PARTIAL | Computed in post-loop & returned (`:202-203`), not readable in script |
| `strategy.opentrades/closedtrades` + `.profit()/.entry_price()` | MISSING | — |
| Pyramiding / position sizing / % equity | MISSING | — |
| `strategy.risk.*` | MISSING | — |

**What the current simulator does (`namascript.js:182-203`):** single-unit, always-in-or-flat position; enters on `long`/`short` signal at bar close, exits on opposite signal or explicit exit/close; can reverse. Each closed trade pays `comm+slip` cost. It then computes a rich **Strategy-Tester report**: trades count, net, win%, profit factor, max drawdown, equity curve, last-50 trade list, avg win/loss, max win/loss, long/short counts, win/loss streaks, avg trade, expectancy, and a Sharpe approximation. This is already a respectable Overview/Performance summary.

**Gaps vs Pine's tester:** no contract/quantity model (always 1 unit), no limit/stop/trailing orders, no intrabar fills (fills at bar close only — so MFE/MAE and intrabar stop-outs are unmodeled), no pyramiding, no initial-capital/percent-equity sizing, no per-trade list with entry/exit bars & MAE/MFE, no commission-as-percent.

**Plan (bar-engine-dependent):**
1. Move the simulator **into** the bar loop so `strategy.position_size`/`equity` are live and orders can fill intrabar against H/L.
2. Implement an order book: market/limit/stop/trailing, with `strategy.entry/exit/order/cancel` full signatures and `id`-keyed positions.
3. Add capital + sizing (`qty`, `% of equity`, fixed contracts), commission (cash/percent/per-contract), slippage in ticks.
4. Emit a full Trades List (entry/exit time+price, qty, P&L, runup/drawdown) feeding the Strategy Tester UI's Overview / Performance Summary / List of Trades tabs.

---

### 6.12 `request.security` (multi-timeframe / multi-symbol)

| Pine | NamaScript | Status | Source |
|---|---|---|---|
| `request.security(sym, tf, expr)` | PARTIAL | `request.security(mult, src, agg)` and bare `security(mult, src, agg)` (`:63,64`) |

Our `security(mult, s, agg)` aggregates the current symbol's series to a *higher* timeframe expressed as an integer multiple of the current bar interval (e.g. `security(4, close)` = 4-bar HTF close), with `agg` ∈ `last|max|min|sum` and **no look-ahead** (returns the last fully-closed HTF bar). It does **not** support a different symbol, a string timeframe ("D"/"240"), or an arbitrary expression evaluated in the HTF context.

**Plan:**
1. Accept Pine-style string timeframes by converting to a bar multiple against the chart interval.
2. Support multi-symbol by having the host fetch the referenced symbol's candles server-side and pass an extra `securityData` map into the worker (the worker stays network-free).
3. Evaluate `expr` in the HTF context (re-run a sub-program on the resampled series) rather than only resampling a single source — requires the parser to capture the expression closure.
4. Faithful gaps/`lookahead` and `gaps_off/on` flags.

Also add `request.financial/dividends/earnings/splits` (low priority, host-fetched) later.

---

### 6.13 Alerts

| Pine | NamaScript | Status | Source |
|---|---|---|---|
| `alertcondition(cond, title, message)` | DONE | PARTIAL | `alertcondition(cond, msg)`; no `title` (`:148`) |
| `alert(message, freq)` | DONE | PARTIAL | `alert(msg)` dynamic + `alert(condSeries, msg)` convenience (`:141`); `freq` ignored |

Both collect into the `alerts[]` bucket with the bars where the condition fired. **Plan:** honor `alert.freq_once_per_bar`/`..._close`; connect the alert bucket to the server-side alerting pipeline (Telegram/push) so user scripts can trigger real notifications — this is flagged **high priority** in `PINESCRIPT_REFERENCE.md`.

---

### 6.14 Colors, shapes & location constants

| Pine | NamaScript | Status | Source |
|---|---|---|---|
| `color.<name>` (16 named) | DONE | blue/red/green/orange/purple/gray/white/yellow/aqua/teal/black/silver/lime/maroon/navy/fuchsia (`:154`) |
| `color.new(col, transp)` | DONE | transp→rgba (`:155`) |
| `color.rgb(r,g,b,t)` | DONE | (`:156`) |
| `color.from_gradient(…)` | MISSING | Plan: lerp between two colors over a value range |
| `shape.*` | PARTIAL | up/down/circle/cross/flag + aliases triangleup→up etc. (`:157`); not all glyphs distinct |
| `location.*` (abovebar/belowbar/top/bottom/absolute) | MISSING | Needed by `plotshape` location arg |
| `plot.style_*` / `line.style_*` / `hline.style_*` | MISSING | Add constant tables |
| `size.*` / `text.align_*` / `position.*` (tables/labels) | MISSING | Add when objects upgraded |
| `display.*` / `format.*` / `scale.*` (indicator opts) | MISSING | Low priority |

---

### 6.15 Other Pine namespaces (status & priority)

| Namespace | Purpose | Status | Priority |
|---|---|---|---|
| `array.*` | Dynamic arrays | MISSING | Medium |
| `matrix.*` / `map.*` | Collections | MISSING | Low |
| `time(...)`, `timestamp(...)`, `timeframe.*` | Time math | MISSING | Medium |
| `session.*`, `dayofweek`, `chart.*` | Sessions/chart | MISSING | Medium |
| `ticker.new`, `syminfo.*` | Symbol info | MISSING | Low |
| `log.info/warning/error` | Debug logging | MISSING | Low (route to a console panel) |
| `runtime.error(msg)` | Abort with message | MISSING | Medium (we already surface `err.message`, `:207`) |
| `import user/lib/v` / `library(...)` / `export` | Reusable libraries | MISSING | Low |

---

### 6.16 The editor (current) & Monaco plan

**Current editor** (`CodeEditor.jsx`) is a custom, dependency-light component: a transparent `<textarea>` overlaid on a syntax-highlighted `<pre>` with a line-number gutter. Features that already work:

- **Tokenizer-based highlighting** (`CodeEditor.jsx:6-28`): comments, strings, numbers, keywords (from `KEYWORDS`), and call-like identifiers are colored distinctly.
- **Autocomplete** (`updateAc`, `:49-59`) driven by the `COMPLETIONS` list (`scriptlib.js:543`): prefix-matched popup, arrow-key navigation, Enter/Tab to accept, Esc to dismiss.
- **Inline error line**: `errorLine` highlights the gutter number red (`:88`) when the worker returns `{ok:false,error}` (`namascript.js:207`).
- **Keybindings**: Tab inserts 2 spaces; Ctrl/Cmd+Enter runs (`:80-81`).
- **Reference panel + examples**: `REFERENCE` (grouped docs) and `EXAMPLES` (24 ready scripts incl. Pine-compat `close[1]`/`var` and MTF demos) from `scriptlib.js`.

**Gaps vs a pro IDE:** no real parse-tree diagnostics (errors only appear after running), no hover docs / signature help, no go-to-definition, no bracket matching, no multi-cursor, no semantic (type-aware) completion, no per-token error squiggles.

**Monaco migration plan:**
1. Mount `monaco-editor` and register a `namascript` language with a Monarch tokenizer mirroring `CodeEditor.jsx`'s rules.
2. Provide a `CompletionItemProvider` backed by `COMPLETIONS` + `REFERENCE` (descriptions become detail/documentation), and a `HoverProvider` + `SignatureHelpProvider` from the same reference data (add per-function param specs).
3. Wire a `DiagnosticsProvider` to the **new parser** (§6.1.1.1): tokenize/parse on idle and surface syntax errors as squiggles *before* running — a major UX win over the current run-to-find-errors flow.
4. Keep the worker run pipeline (`runScript`) unchanged; Monaco is purely the front-end. Preserve the lightweight editor as a fallback for low-end devices (bundle-size sensitive).
5. Add a "Pine paste" assist: detect pasted Pine v6 and run it through the parser's compatibility layer, flagging unsupported constructs inline.

---

### 6.17 Consolidated roadmap (priority order)

1. **Bar-by-bar VM** (§6.1.1) — unlocks real `var`/`varip`/`:=`, generalized history `expr[n]`, live `strategy.*`, faithful `barstate`, mutable drawing objects, and authorable recurrences. Everything below leans on it.
2. **Parser/AST** replacing the regex preprocessor — prerequisite for #1 and for Monaco diagnostics.
3. **`strategy.*` full model** + complete Strategy Tester (orders, sizing, commission models, intrabar fills, trades list).
4. **`request.security` real timeframes + multi-symbol** (host-fed `securityData`).
5. **Drawing objects** — working `set_*`, `polyline`, `linefill`, label setters/getters.
6. **`alert()` → server pipeline** (Telegram/push) + `alertcondition` titles/freq.
7. **`ta.*` completeness** — fix `ta.dev`, add `percentrank/percentile/mode/range/cog`; normalize signatures + tuple returns.
8. **`input.*`** — real widgets for color/source/string-dropdown + `group/inline/tooltip`.
9. **Plot/color completeness** — `plot.style_*`, `location.*`, `plotbar`, `color.from_gradient`, distinct `plotshape`/`plotchar` glyphs.
10. **Monaco editor** with semantic completion, hover/signature help, and pre-run diagnostics.
11. **`array.*` + `time/session/timeframe.*`** for advanced scripts.

**Design invariant:** NamaScript stays an independent, Pine-*inspired* language (no Pine source is copied), always sandboxed in a Web Worker with no DOM/network and a hard timeout. The migration to a bar-by-bar VM is additive — pure indicator scripts keep running on the existing fast vectorized engine, so there is no regression for the ~24 shipped examples while we close the parity gap.


---

## 7. Alerts — Complete Builder & Delivery Spec

This chapter is the authoritative engineering build spec for the Pro-Chart (بازارنما / BazaarNama) **alert subsystem**: how a student composes an alert, how the alert is persisted, how it is evaluated *independently of the browser* on the server, and how it is delivered across multiple channels. It describes the full feature set we intend to ship (sources × conditions × triggers × expiration × message × delivery × log), states our **current implementation status with citations to the live code**, and lays out the concrete implementation plan (DB condition-JSON schema, Celery task evaluation logic, the alert-creation dialog UI, and delivery wiring to the existing Telegram bot).

The guiding architectural principle — and our single biggest advantage over a naive client-only implementation — is already in place: **alert evaluation is server-side**. Alerts fire even when the user's browser tab is closed, asleep, or offline. This is implemented today as the Celery beat task `src.bazaarnama.tasks.check_alerts`, scheduled every 60 seconds in `src/core/celery_app.py` (`bn-check-alerts`, `"schedule": 60.0`). Everything below builds on that foundation.

---

### 7.1 Overview & data model

An alert is one row in the `bn_alerts` table (`src/core/database.py`, class `BnAlert`). The schema is intentionally thin around a single flexible JSONB column so we can extend the condition vocabulary without migrations:

```
bn_alerts
  id                 PK
  student_id         FK academy_students(id) ON DELETE CASCADE, indexed
  symbol             String(20)        e.g. "EURUSD", "XAUUSD"
  tf                 String(8)         timeframe, default "H1"
  name              String(160)        human label (auto-generated or user-set)
  condition          JSONB             ← the entire alert definition lives here
  active             Boolean           true while armed; flipped false on expiry / once-fire
  last_triggered_at  DateTime(tz)      last time it fired (drives cooldown + UI "fired" badge)
  created_at         DateTime(tz)
```

The `condition` JSON is the heart of the system. Today (see `createAlert` in `BazaarNama.jsx` and `_check` in `tasks.py`) it carries:

```json
{
  "type": "price",
  "op": "above|below|cross_up|cross_down|cross|pct_up|pct_down",
  "value": 1.0850,
  "trigger": "recurring|once",
  "telegram": true,
  "message": "آلارمِ {symbol}: {price}",
  "expiry": "2026-06-23T12:00:00+00:00"
}
```

The **target schema** (section 7.9) generalizes `type`/`op` to cover indicator/drawing/script sources and channel/move conditions, while remaining 100% backward-compatible with rows already written.

**Ownership & quotas.** Every alert is scoped to a student (`scope=academy`, enforced by `current_student` dependency on all routes in `src/api/routes/bazaarnama.py`). We will add a per-tier active-alert cap (free=3, vip=20, premium=100) enforced in `create_alert`, mirroring the existing script cap (`cnt >= 50 → HTTPException(429)`).

---

### 7.2 Alert SOURCES

The *source* is the value stream the condition watches. Pro-Chart will support four source families, identified by `condition.source` (new field; absence ⇒ `"price"` for back-compat).

#### 7.2.1 Price (`source:"price"`) — DONE
Watches the live mid price. **Current status: implemented.** `_check` in `tasks.py` reads the symbol's live tick from Redis (`redis_client.get_price(sym)`), computes `mid = (bid+ask)/2` (the exact same tick stream the data-feed publishes), and compares against the condition. This is the same price model used by `/prices` and the AI-signal tracker, so behavior is consistent across the product. No candle dependency — fires intra-bar on the tick.

Sub-targets to add: `price_field ∈ {mid, bid, ask, close, open, high, low}`. Today only `mid` is used; `close/open/high/low` require the candle for the alert's `tf` (fetch via `_chart_rows`, already imported in the routes module).

#### 7.2.2 Indicator value (`source:"indicator"`) — PLANNED
Watches a computed indicator series (EMA, RSI, MACD line/signal/hist, ATR, Bollinger upper/mid/lower, Stoch %K/%D, etc.). The engine helpers already exist and are imported in `bazaarnama.py`: `_ema_list`, `_rsi_list`, `_ind_atr`. Plan: a small registry maps `indicator.id` + `params` to one of these functions; the task fetches candles for `(symbol, tf)`, computes the series, and takes the last (and previous) value as the comparison operand. The condition's right-hand operand may itself be a constant **or a second indicator** (enables "EMA20 crosses EMA50").

#### 7.2.3 Drawing line (`source:"drawing"`) — PLANNED
Watches a trendline/horizontal-ray/channel boundary the user drew on the chart. We persist drawings in the layout JSON (`BnLayout.data`). Plan: when a user picks "Alert on this line" from the drawing context menu, the frontend serializes the line geometry (`{p1:{t,price}, p2:{t,price}}` for sloped lines, or `{price}` for horizontals) into `condition.line`. For a sloped trendline the server projects the line's price at "now" (`price = p1.price + slope*(now - p1.t)`) each tick, so a rising trendline gives a moving threshold. Horizontal lines collapse to the existing price-cross logic.

#### 7.2.4 Script `alertcondition` (`source:"script"`) — PARTIAL
NamaScript (our Pine-like language) already supports `alertcondition()` — see the starter script in `bazaarnama.py` (`alertcondition(buy, "سیگنالِ خرید")`) and the compiler output consumed by `BazaarNama.jsx` (`onRun` reads `res.alerts`, the Strategy Tester falls back to two `alertcondition`s). **Current status: the language + client-side surfacing exist; server-side scheduled evaluation does not.** Plan: persist a script-source alert as `condition.script_id` + `condition.alert_name`; the task loads the `BnScript` source, runs the compiler headlessly over the latest candles for `(symbol, tf)`, and fires when the named `alertcondition` becomes true on the just-closed bar. This reuses the exact compiler the frontend uses, so on-chart and server results stay identical.

---

### 7.3 CONDITIONS

The *condition* is the boolean test applied to the source value (and its previous value, for cross/move conditions). Operator is `condition.op`.

| Op | Meaning | Status | Code |
|---|---|---|---|
| `above` | value ≥ threshold | **DONE** | `hit = mid >= val` |
| `below` | value ≤ threshold | **DONE** | `hit = mid <= val` |
| `cross_up` | crossed threshold upward (prev<val≤now) | **DONE** | `prev < val <= mid` |
| `cross_down` | crossed threshold downward (prev>val≥now) | **DONE** | `prev > val >= mid` |
| `cross` | crossed in either direction | **DONE** | `(prev<val<=mid) or (prev>val>=mid)` |
| `pct_up` | rose ≥ N% vs previous reading | **DONE** | `chg >= val` |
| `pct_down` | fell ≥ N% vs previous reading | **DONE** | `chg <= -val` |
| `enter_channel` | entered a [low,high] band | PLANNED | — |
| `exit_channel` | exited a [low,high] band | PLANNED | — |
| `move_up_value` | rose by absolute Δ vs anchor | PLANNED | — |
| `move_down_value` | fell by absolute Δ vs anchor | PLANNED | — |

**Crossing — DONE.** The crossing family is fully working server-side. The key implementation detail is that crossing needs *state*: the previous reading. We store it per-alert in Redis (`bn:alertprev:{a.id}`, 24h TTL) — see `tasks.py` lines reading `pv = await redis_client.get(...)` then `await redis_client.set(f"bn:alertprev:{a.id}", str(mid), ex=86400)`. On the first tick after creation `prev is None`, so crossing conditions correctly do **not** fire on the inaugural read (they require a genuine transition), avoiding the classic false-fire on alert creation.

**Greater/Less — DONE.** `above`/`below` are simple level tests; they fire continuously while the condition holds (subject to the trigger/cooldown logic in 7.4).

**Move up/down by % — DONE.** `pct_up`/`pct_down` compute `chg = (mid - prev) / prev * 100` and compare to `value`. Note the current semantics: "prev" is the *last evaluation* reading (≈60s ago given the beat cadence), so this is effectively "moved N% since the last check," not "since session open." The PLANNED `move_*` ops and a proper `anchor` (see below) will give precise semantics.

**Entering/Exiting channel — PLANNED.** Condition carries `{lo, hi}`. `enter_channel` fires when `prev` was outside `[lo,hi]` and `now` is inside; `exit_channel` is the inverse. Reuses the same `prev` Redis state already maintained.

**Move up/down by value or % — PLANNED (value variant) / partial (% variant).** Introduce `condition.anchor_mode ∈ {prev, create, session_open, bar_open}` and `condition.anchor_price` (captured at create time when `anchor_mode=create`). For "Moving up by 50 pips from when I set the alert," anchor at create, then `move_up_value` fires when `now - anchor ≥ value`. This makes the move conditions deterministic instead of dependent on beat cadence.

---

### 7.4 TRIGGERS (firing frequency)

The trigger controls how often a satisfied condition is allowed to produce a notification. `condition.trigger`.

| Trigger | Meaning | Status |
|---|---|---|
| `once` (Only Once) | fire exactly one time, then disarm | **DONE** |
| `recurring` (Every time) | fire each time the condition is true, throttled by cooldown | **DONE** |
| `once_per_bar` | fire at most once within a single bar of the alert's `tf` | PLANNED |
| `once_per_bar_close` | evaluate/fire only on bar close | PLANNED |

**Only Once — DONE.** `tasks.py`: when `trigger == "once"` and the condition hits, we set `a.active = False` (the alert disarms permanently) in addition to recording `last_triggered_at`.

**Every time — DONE (with cooldown).** For `recurring`, we apply a **1-hour cooldown** (`_COOLDOWN = 3600`) so a price hovering at the threshold doesn't spam every 60 seconds: `if trigger == "recurring" and a.last_triggered_at and (now - a.last_triggered_at) < _COOLDOWN: continue`. This is a pragmatic substitute for TradingView's per-bar semantics. We will make the cooldown configurable per alert (`condition.cooldown_s`, default 3600) and expose it in the UI.

**Once per bar / Once per bar close — PLANNED.** These require bar awareness. Plan: store the last-fired bar timestamp in Redis (`bn:alertbar:{id}`). For `once_per_bar`, compute the current bar's open-time from `tf` and refuse to re-fire within the same bar. For `once_per_bar_close`, the task only evaluates the condition against the **just-closed** candle (not the live tick) and fires at most once per close. The 60s beat is fine for ≥M1 closes; for true close-aligned evaluation we add a second lightweight beat aligned to common TF boundaries, or compute "did a bar just close since last run?" inside the existing task.

---

### 7.5 EXPIRATION

`condition.expiry` is an ISO-8601 UTC timestamp. **Current status: implemented.** In `tasks.py`, before evaluating each alert: `if now >= datetime.fromisoformat(expiry...): a.active = False; continue`. Expired alerts are disarmed (not deleted) so the user still sees them in the log with an "expired" state.

The UI currently captures expiry as a **relative duration in hours** (`alForm.expiryH`) and `createAlert` converts it to an absolute ISO timestamp client-side: `new Date(Date.now() + expiryH*3600*1000).toISOString()`. Planned enhancements: an absolute date-time picker, presets (1h / 1d / 1w / "open-ended"), a default cap (e.g. 90 days for free tier, unlimited for premium), and a server-side sweep that flips long-expired alerts to `active=false` even if never re-evaluated (handled implicitly today since every active alert is scanned each minute, but a dedicated index on `(active)` keeps the scan cheap as volume grows).

---

### 7.6 Custom MESSAGE with placeholders

`condition.message` is a template string rendered at fire time. **Current status: implemented (subset of placeholders).** `tasks.py` renders:

```python
tmpl = cond.get("message") or "آلارمِ {symbol}: شرط برقرار شد (قیمت {price})"
msg = (str(tmpl).replace("{symbol}", sym)
                .replace("{price}", f"{mid:.5f}")
                .replace("{value}", f"{val:g}")
                .replace("{tf}", a.tf or ""))
```

So today's supported placeholders are `{symbol}`, `{price}`, `{value}`, `{tf}`, and the UI hints `{symbol} {price} {value}` (see the message input placeholder in `BazaarNama.jsx`).

**Planned: full TradingView-style `{{...}}` placeholder set**, rendered by a single `render_message(template, ctx)` helper. We will support **both** our current `{x}` syntax and the TradingView-compatible `{{x}}` syntax (so pasted TradingView templates work). Target placeholder set:

| Placeholder | Value |
|---|---|
| `{{ticker}}` / `{{symbol}}` | symbol |
| `{{close}}` / `{{price}}` | live mid (or relevant `price_field`) |
| `{{open}}` `{{high}}` `{{low}}` | current bar OHLC |
| `{{volume}}` | current bar volume |
| `{{time}}` / `{{timenow}}` | bar time / now (UTC + Tehran) |
| `{{interval}}` / `{{tf}}` | timeframe |
| `{{exchange}}` | feed/broker label |
| `{{plot_0}}`, `{{plot("name")}}` | indicator/script plot value (script source) |
| `{{value}}` | the condition threshold |
| `{{change}}` `{{change_pct}}` | Δ since anchor |

Rendering is centralized so every delivery channel (Telegram, email, webhook, in-app) gets an identically-rendered body. Webhook payloads additionally receive the **raw JSON** context (so n8n/Make/trading bots can parse fields without regex), matching TradingView's JSON-in-message convention.

---

### 7.7 SERVER-SIDE EVALUATION (browser-independent) — DONE

This is the architectural keystone and it is **already live**.

- **Scheduler:** `src/core/celery_app.py` registers `bn-check-alerts → src.bazaarnama.tasks.check_alerts` on a 60-second beat. A sibling task `bn-check-ai-signals` tracks AI-signal TP/SL on the same cadence.
- **Task entry:** `check_alerts()` (`@celery_app.task`) wraps the async `_check()` via a private event loop helper `_run(coro)` (creates a fresh loop, runs to completion, closes it) — the standard pattern for async-in-Celery used across this project.
- **Lazy Redis:** inside the Celery worker process `redis_client` starts disconnected, so `_check` lazily calls `redis_client.connect()` (with a retry) and degrades gracefully to `{"error":"redis_unavailable"}` if the cache is down.
- **Batch price fetch:** prices are fetched **once per distinct symbol per run** and memoized in a local `prices` dict — so 500 alerts on `EURUSD` cost one Redis read, not 500.
- **Market-closed handling:** if `get_price` returns nothing (weekend/holiday), `mid is None` and the alert is skipped (not errored, not fired) — consistent with `/prices` returning `market_open:false`.
- **Persistence of fire:** on a hit the task sets `last_triggered_at = now`, increments a `triggered` counter, disarms `once` alerts, and commits. The commit is guarded so we only write when something actually changed (`if triggered or any(...expiry...)`).
- **Observability:** every fire logs `logger.info("bn_alert_triggered", alert_id=..., symbol=..., op=..., value=..., price=...)` for the structured-log pipeline.

**Hardening planned:** wrap each alert's evaluation in a per-alert try/except so one malformed condition can't abort the batch; add a Prometheus-style counter (`bn_alerts_checked`, `bn_alerts_fired`) exported via the existing metrics; and shard the scan by `student_id % N` if active-alert volume ever exceeds what a single 60s run can comfortably process (today's whole-table scan with per-symbol memoization is fine into the tens of thousands).

---

### 7.8 DELIVERY channels

The notification fan-out. `condition` carries per-channel opt-in flags. At fire time the task renders the message once (7.6) and dispatches to each enabled channel.

| Channel | Behavior | Status |
|---|---|---|
| In-app (badge/list) | the alert row shows a "fired" state; right-panel list refreshes | **DONE** |
| Telegram | push to a Telegram chat via Bot API | **DONE** |
| Popup (toast) | modal/toast in the open chart tab | PARTIAL (badge only) |
| Sound | play a chime on fire | PLANNED |
| Email | send rendered message by email | PLANNED |
| Web push | OS-level push when tab closed | PLANNED |
| Webhook | POST JSON to a user URL | PLANNED |

**In-app — DONE.** `last_triggered_at` is the signal. The frontend polls `api.bnAlerts()` every 30 s (`setInterval(... 30000)` in `BazaarNama.jsx`) plus on mount, and renders a green **"رخ داد" (fired)** badge if `now - last_triggered_at < 24h` (`const fired = a.last_triggered_at && (Date.now() - new Date(a.last_triggered_at).getTime()) < 86400000`). Planned upgrade: replace polling with the existing WebSocket/SSE channel so fires appear instantly, and add a notifications dropdown with unread counts.

**Telegram — DONE.** `condition.telegram === true` ⇒ `await _send_telegram("🔔 " + msg)`. `_send_telegram` resolves a bot token from env (`BN_ALERT_BOT_TOKEN` → `TELEGRAM_BOT_TOKEN` → `BACKUP_BOT_TOKEN`) and a chat id (`BN_ALERT_CHAT_ID` → `BACKUP_CHAT_ID`), then POSTs to `https://api.telegram.org/bot{token}/sendMessage` with a 10s timeout and swallows/logs failures. **Current limitation:** it delivers to a single configured chat, not to each student's own Telegram. **Plan (wire to the existing bot):** the academy/user panel already links a student's Telegram via OTP (see the user-panel module). We will store the student's `telegram_chat_id` on `AcademyStudent`, and `_send_telegram` will target *that* chat using the project's existing `src/bot` aiogram bot token — so alerts arrive in the student's own DM with the bot, with inline buttons (open chart / snooze / delete). The single-chat env fallback remains for ops/admin alerts.

**Popup/Sound — PARTIAL/PLANNED.** The fire state is available client-side; we add (a) a toast on transition to fired and (b) an optional `<audio>` chime gated by `condition.sound` and a per-user "sounds on" preference (browser autoplay policy requires a prior user gesture, satisfied by normal chart interaction).

**Email — PLANNED.** Reuse the project's transactional email path (Resend, already used for academy email-OTP). Gate by `condition.email` + verified student email; render the same template plus a chart snapshot thumbnail (we already render TradingView-style chart images elsewhere in the project — reuse that renderer for an attached PNG).

**Web push — PLANNED.** Service-worker + VAPID; subscription stored per student. Lets fires reach the user with the tab closed but the OS awake.

**Webhook — PLANNED.** `condition.webhook_url` (validated against SSRF — the project already has an SSRF guard from the security-hardening pass). POST the rendered message **and** the raw JSON context. This unlocks automation (n8n, trading bots, Make).

---

### 7.9 Target `condition` JSON schema (canonical)

The unified, forward-compatible schema. All new fields are optional; readers default missing fields to today's behavior, so existing rows keep working.

```jsonc
{
  // SOURCE
  "source": "price",            // price | indicator | drawing | script
  "price_field": "mid",         // price source: mid|bid|ask|close|open|high|low
  "indicator": {                // source=indicator
    "id": "rsi", "params": {"len": 14}, "field": "rsi"
  },
  "operand": {                  // RHS: constant or a second indicator
    "kind": "const", "value": 70
    // or {"kind":"indicator","id":"ema","params":{"len":50}}
  },
  "line": { "p1": {"t": 0, "price": 0}, "p2": {"t": 0, "price": 0} }, // source=drawing
  "script_id": 123, "alert_name": "سیگنالِ خرید",                     // source=script

  // CONDITION
  "op": "cross_up",             // above|below|cross|cross_up|cross_down|
                                // pct_up|pct_down|enter_channel|exit_channel|
                                // move_up_value|move_down_value
  "value": 1.0850,              // threshold / percent / delta
  "lo": 1.08, "hi": 1.09,       // channel ops
  "anchor_mode": "create",      // prev|create|session_open|bar_open  (move ops)
  "anchor_price": 1.0820,       // captured at create when anchor_mode=create

  // TRIGGER
  "trigger": "recurring",       // once | recurring | once_per_bar | once_per_bar_close
  "cooldown_s": 3600,           // recurring throttle (default _COOLDOWN)

  // EXPIRATION
  "expiry": "2026-09-20T00:00:00+00:00",   // ISO-8601 UTC, null = open-ended

  // MESSAGE
  "message": "{{ticker}} {{interval}} crossed {{value}} @ {{close}}",

  // DELIVERY (per-channel opt-in)
  "in_app": true,
  "popup": true,
  "sound": false,
  "telegram": true,
  "email": false,
  "webhook_url": null
}
```

**Backward-compat contract:** the evaluator reads `source` defaulting to `"price"`; reads `trigger` defaulting to `"recurring"`; reads `cooldown_s` defaulting to `_COOLDOWN`; treats absent delivery flags as `in_app:true` only. Every alert already in the DB therefore evaluates identically after the upgrade.

---

### 7.10 Task evaluation logic (target)

Refactor `_check` into a clear pipeline while preserving the proven primitives (per-symbol memoization, Redis `prev` state, cooldown, once-disarm):

1. **Load** all `active` alerts (single query). Group by `(source, symbol, tf)` to batch source computation.
2. **Resolve source value** `cur` (and `prev` from `bn:alertprev:{id}`):
   - `price` → live mid/field (today's path).
   - `indicator` → compute series from candles `(symbol, tf)`, take last/prev.
   - `drawing` → project line price at `now`.
   - `script` → run NamaScript compiler, read the named `alertcondition` boolean on the latest (closed) bar.
3. **Expiry gate** (existing): disarm + skip if `now ≥ expiry`.
4. **Resolve RHS operand** (`operand`): constant or second indicator's last value.
5. **Evaluate `op`** → `hit` boolean. Crossing/channel/move ops consume `prev`/`anchor`.
6. **Persist `prev`** (`bn:alertprev:{id}`, 24h TTL) — always, regardless of hit.
7. **Trigger gate:** `once` (fire once, disarm), `recurring` (cooldown), `once_per_bar`/`once_per_bar_close` (bar-key gate via `bn:alertbar:{id}`).
8. **On fire:** set `last_triggered_at`; render message (7.6); fan-out to enabled channels (7.8); append an **Alert Log** row (7.11); structured-log; disarm if `once`.
9. **Commit** once per run when anything changed.

Each alert's evaluation is wrapped in try/except so a single bad condition is logged and skipped, never aborting the batch.

---

### 7.11 Alert Log / history — PLANNED

Today the only "history" is `last_triggered_at` (last fire only) — the reference doc marks Alert Log as ◑. We add an append-only `bn_alert_events` table:

```
bn_alert_events
  id PK
  alert_id    FK bn_alerts(id) ON DELETE CASCADE, indexed
  student_id  FK academy_students(id), indexed
  fired_at    DateTime(tz)
  symbol, tf  snapshot
  price       value at fire
  message     rendered text
  channels    JSONB   {"telegram":"ok","email":"skipped"}  per-channel result
```

The task inserts one row per fire. New routes: `GET /bn/alert-log` (paginated, filter by alert/symbol/date) and a right-panel **"تاریخچهٔ آلارم‌ها"** tab listing recent fires with per-channel delivery status, plus CSV export (consistent with the panel's existing history/CSV pattern). Retention: keep 90 days, nightly prune via a Celery beat task.

---

### 7.12 Alert-creation dialog UI

**Current status (DONE, compact builder):** the right panel's **«آلارم»** tab (`BazaarNama.jsx`) renders an inline builder bound to `alForm` (`{ op, value, trigger, telegram, message, expiryH }`):

- **Operator** `<select>` — قیمت بالای / پایینِ / تقاطعِ صعودی از / تقاطعِ نزولی از / صعودِ ٪ / نزولِ ٪ (maps to `op`).
- **Value** input — placeholder switches to `٪` when `op` starts with `pct`.
- **Trigger** `<select>` — «هربار (با کول‌داون)» (`recurring`) / «فقط یک‌بار» (`once`).
- **Expiry** input — hours (`expiryH`), converted to absolute ISO in `createAlert`.
- **Custom message** input — hint `{symbol} {price} {value}`.
- **Telegram** checkbox — sets `telegram`.
- **Create** button → `createAlert` builds `cond = { type:'price', op, value:Number, trigger, telegram }`, attaches `message` if present and `expiry` if hours given, auto-generates `name` via `OP_LABELS`, POSTs `api.bnAlertCreate({symbol, tf, name, condition})`, then refreshes the list and resets the form.
- **Saved list** — each alert shows a `Bell` icon (green if fired in last 24h), the name, the **«رخ داد»** badge, and an `X` to delete (`delAlert → api.bnAlertDelete`).

**Planned full dialog (modal):** a tabbed "Create Alert" modal matching the TradingView layout while staying Persian/RTL:

1. **Condition tab** — Source picker (Symbol price / Indicator on chart / Drawing / Script) → operator (full list incl. channel & move) → operand (constant or second source) → live preview ("EURUSD crosses **1.0850** — currently 1.0843, distance −7 pips").
2. **Trigger tab** — Only Once / Every Time / Once Per Bar / Once Per Bar Close, plus cooldown slider for recurring.
3. **Expiration** — absolute date-time picker + presets + "open-ended."
4. **Notifications tab** — toggles for in-app, popup, sound, Telegram, email, web push, webhook URL (per-channel).
5. **Message tab** — multiline template with a placeholder palette (clickable `{{ticker}}`, `{{close}}`, …) and a live rendered preview.

The modal can be opened from the right-panel tab, from a **price-axis right-click** ("Add alert at 1.0850" pre-fills `above` + that price), and from a **drawing context menu** ("Alert on this line" pre-fills `source:"drawing"`). The compact inline builder stays as the fast path.

---

### 7.13 Wiring delivery to the existing Telegram bot — implementation plan

We do **not** build a new bot. The project already runs an aiogram bot (`src/bot`) and links student Telegram accounts via OTP in the user/academy panel. Concrete steps:

1. **Persist chat id:** add `telegram_chat_id` to `AcademyStudent` (populated during the existing Telegram-link OTP flow).
2. **Per-student delivery:** change `_send_telegram` to accept a `chat_id` argument; the task passes `student.telegram_chat_id`. Token comes from the project bot (`TELEGRAM_BOT_TOKEN`), env single-chat values remain the admin/ops fallback.
3. **Rich messages:** send via the bot with inline keyboard — **Open chart** (deep link to BazaarNama at the symbol/tf), **Snooze 1h**, **Delete alert** — handled by new bot callback handlers that call the same alert routes.
4. **Rate/abuse guard:** respect Telegram's per-chat limits; the existing 1h cooldown plus per-alert dedup keeps volume sane.
5. **Opt-in integrity:** only send if the student linked Telegram and enabled `condition.telegram`; otherwise silently skip (logged).

This reuses the **queue isolation** lesson from prior incidents (dedicated queues so a flood of alert sends can't starve trading tasks): alert delivery dispatches go to a low-priority `notifications` queue, never the `critical`/`ig` queues.

---

### 7.14 Acceptance criteria

- Creating each alert type persists a valid `condition` JSON and appears in the list immediately.
- A price alert fires within ≤60s of the threshold being crossed **with the browser closed** (server-side proof).
- `once` disarms after one fire; `recurring` respects its cooldown; `once_per_bar(_close)` fires at most once per bar.
- Expired alerts auto-disarm and show "expired."
- Custom messages render every documented `{{placeholder}}` (and legacy `{x}`) correctly across all channels.
- Telegram delivery lands in the **student's own** DM with working inline buttons.
- Every fire writes one `bn_alert_events` row with per-channel delivery status, visible in the Alert Log with CSV export.
- No single malformed alert aborts the batch run.

---

### 7.15 Current-status summary

| Area | Status | Evidence |
|---|---|---|
| Server-side evaluation (browser-independent) | **DONE** | `tasks.py check_alerts`; beat `bn-check-alerts` 60s |
| Price source (above/below) | **DONE** | `_check` Redis mid compare |
| Crossing (up/down/either) | **DONE** | `prev` via `bn:alertprev:{id}` |
| Move by % | **DONE** | `pct_up`/`pct_down` |
| Triggers once / recurring(+cooldown) | **DONE** | `trigger`, `_COOLDOWN=3600` |
| Expiration | **DONE** | `cond.expiry` disarm |
| Custom message (subset) | **DONE** | `{symbol}{price}{value}{tf}` |
| Telegram delivery (single chat) | **DONE** | `_send_telegram` |
| In-app fired badge | **DONE** | 30s poll + `last_triggered_at` |
| Builder UI (compact) | **DONE** | `alForm`/`createAlert`/«آلارم» tab |
| Indicator / drawing / script sources | PLANNED | helpers + compiler exist |
| Channel & move-by-value conditions | PLANNED | — |
| once_per_bar / per_bar_close | PLANNED | — |
| Full `{{...}}` placeholders | PLANNED | central renderer |
| Popup / sound / email / push / webhook | PARTIAL/PLANNED | — |
| Per-student Telegram via project bot | PLANNED | reuse `src/bot` + OTP link |
| Alert Log / history table | PLANNED | `bn_alert_events` |
| Full modal dialog | PLANNED | — |


---

## 8. Watchlist, Screener, Details, News & Calendar

This chapter specifies the entire **right-panel data surface** of Pro-Chart (our TradingView-class charting product inside the academy, internally "BazaarNama"): the Watchlist, the server-side Screener, the per-symbol Details tab, Hotlists (gainers/losers/most-active), the News stream, and the Economic Calendar (plus earnings/dividends). For each area we describe the target behavior, our **current implementation status with code citations**, and a concrete implementation plan: data models, FastAPI endpoints reading **our own candles/Redis** (never any third-party paid feed), a **server-side indicator-filter evaluator**, and the React UI tabs.

Hard constraints inherited from the platform:
- All endpoints sit behind academy student auth (`current_student`, `scope=academy`) exactly like the existing `src/api/routes/bazaarnama.py` router.
- We reuse the candle/indicator helpers already imported into that router: `_chart_rows`, `_current_price`, `_ema_list`, `_rsi_list`, `_ind_atr`, `_effective_tier` (all defined in `src/api/routes/academy.py`). We do **not** introduce a parallel data path.
- Live prices come from `redis_client.get_price(symbol)` (the same tick stream the data-feed publishes), as already used by `GET /prices` in `bazaarnama.py:50`.
- This is a **feature/behavior reimplementation** on our data, not a port of TradingView code.

Reference mapping (from `docs/TRADINGVIEW_REFERENCE.md` §8): we currently have a single live watchlist and a "simple live-price scanner"; everything else (named lists/flags, customizable columns, indicator screener, Details, Hotlists, News, Calendar) is marked ☐ and is the subject of this chapter.

---

### 8.1 Watchlist

#### 8.1.1 Target behavior
- Each row shows: symbol, live mid price, **change% since session/day open**, and a **colored direction arrow** (green ▲ up-tick, red ▼ down-tick, neutral). TradingView additionally colors the change% cell and shows a sparkline.
- **Multiple named lists** the user can create, rename, reorder, and switch between (e.g. "Majors", "Metals", "My picks").
- **Groups + flags** inside a list: a symbol can carry a colored flag (TradingView's 7 flag colors) and rows can be grouped under user-defined section headers; flagged symbols can be filtered to a "Colored" view.
- **Customizable columns**: user picks which columns appear (Last, Chg, Chg%, High, Low, Volume/ATR, RSI, a chosen indicator value) and their order.
- **Sorting** by any column (asc/desc), with the sort persisted per list.
- Click a row → loads that symbol into the chart. Right-click → context menu (flag, remove, add alert, move to list).

#### 8.1.2 Current status (cited)
- **Single live list.** Storage is `BnWatchlist` (`src/core/database.py:1202`): one row per student, `name` defaulting to "پیش‌فرض", `symbols` as a JSONB array. There is no concept of multiple lists, flags, columns, or per-symbol metadata.
- API: `GET /watchlist` and `PUT /watchlist` (`bazaarnama.py:208` and `:214`). `_get_or_make_wl` (`:198`) lazily creates one default list seeded with `["EURUSD","XAUUSD","GBPUSD","USDJPY","BTCUSD"]` and the setter clamps to 50 symbols, upper-cased, max 20 chars each.
- UI: `rightTab === 'watch'` block (`BazaarNama.jsx:978`). It maps `watch[]` to rows, reads `live[s]` (mid + tick direction) and colors by `lp.dir` (green/red/neutral at `:980`). It shows live mid only — **no change%, no arrow glyph, no columns, no sort.** Add/remove is `toggleWatch` (`:740`) which PUTs the whole array. Below the list it renders up to 10 "suggested" symbols not yet in the list (`:989`).
- Live data: the 700ms poll at `BazaarNama.jsx:597` fetches `api.bnPrices([symbol, ...watch])`, computes `dir` by comparing each symbol's new mid against `lastMidRef`, and stores `{mid, dir}` in `live`. So we already have the **arrow direction** signal; we are simply not rendering change% or an arrow glyph in the watch tab (the screener tab does render `▲/▼` at `:1052`).

#### 8.1.3 Implementation plan

**Data model — replace single-list with multi-list + items.** Keep `BnWatchlist` as the *list* row, add per-symbol item rows so flags/order/groups have a home:

```python
class BnWatchlist(Base):            # extend existing
    __tablename__ = "bn_watchlists"
    id; student_id; name
    sort_order: Mapped[int] = 0          # ordering of lists in the picker
    columns: Mapped[list] = JSONB        # ["last","chgPct","rsi14","atr14"] chosen columns
    sort_by:  Mapped[str]  = "symbol"    # active column sort key
    sort_dir: Mapped[str]  = "asc"
    is_default: Mapped[bool]
    created_at

class BnWatchItem(Base):
    __tablename__ = "bn_watch_items"
    id; list_id (FK→bn_watchlists, CASCADE, index)
    symbol: String(20)
    flag:   String(8)  = None    # one of: red,orange,yellow,green,blue,purple,gray
    group:  String(60) = None    # section header name, null = ungrouped
    pos:    Integer    = 0        # order within the list
```

Migration: for each existing `BnWatchlist.symbols[]`, create `BnWatchItem` rows in order (`pos` = index), then drop reliance on the JSONB array (keep the column for one release as a fallback).

**Endpoints** (all under the existing router, student-scoped):
- `GET /watchlists` → `[{id,name,is_default,sort_order,count}]`.
- `POST /watchlists` `{name}` → create (cap 20 lists/student).
- `PATCH /watchlists/{id}` `{name?,columns?,sort_by?,sort_dir?,sort_order?,is_default?}`.
- `DELETE /watchlists/{id}`.
- `GET /watchlists/{id}` → `{id,name,columns,sort_by,sort_dir,items:[{id,symbol,flag,group,pos}]}`.
- `POST /watchlists/{id}/items` `{symbol,flag?,group?}` → add (cap 200/list).
- `PATCH /watchlists/{id}/items/{itemId}` `{flag?,group?,pos?}` → flag / regroup / reorder.
- `DELETE /watchlists/{id}/items/{itemId}`.
- `POST /watchlists/{id}/quote` `{columns:[...]}` → **server-computed row payload** for the requested non-trivial columns (RSI/ATR/change%) so the client doesn't recompute indicators. Returns `{rows:{SYM:{last,chgPct,high,low,rsi14,atr14,...}}}`. `last` comes from Redis; `chgPct`, `high`, `low` and indicator columns are derived from `_chart_rows(db, sym, "D1", limit=2)` (today vs prior close) and `_chart_rows(db, sym, tf, limit=220)` for RSI/ATR. This shares the exact evaluator built for the screener (§8.2.4).

Note `change%` does **not** need a third-party "previous close": we compute it as `(last - openOfCurrentDailyCandle) / openOfCurrentDailyCandle * 100` using `_chart_rows(sym,"D1",limit=2)`; when the daily candle is unavailable we fall back to the first M5 candle of the current session.

**Live prices stay on the 700ms poll** (`GET /prices`) for `last`+arrow; the heavier `/quote` payload (change%/indicators) is polled at a slower cadence (e.g. every 5s) to keep Redis/DB load low.

**UI plan** (right panel, `rightTab === 'watch'`):
- Add a **list switcher** dropdown at the top of the tab (lists from `GET /watchlists`) + "＋ لیستِ جدید".
- Render a **header row of chosen columns** with click-to-sort; persist `sort_by/sort_dir` via `PATCH`.
- Each item row: optional **flag dot** (click cycles colors → `PATCH item.flag`), symbol, then the chosen columns. Reuse the existing color logic from `:980`; render the arrow glyph `▲/▼` (already done in the screener at `:1052`) and a colored `chgPct`.
- **Group headers** (collapsible) when items carry `group`.
- Drag handle to reorder (writes `pos`); right-click/long-press context menu: flag, add alert (reuse `POST /alerts`), move to list, remove.
- A **gear** opens a column-picker (checkbox list of: Last, Chg%, High, Low, ATR14, RSI14, EMA50-distance) writing `columns`.

---

### 8.2 Screener (Forex/Crypto screener on our candles)

#### 8.2.1 Target behavior
TradingView's screener filters the whole symbol universe by **price**, **change%**, **volume**, and **indicator values** (RSI, MA crossovers, ATR, MACD, etc.), with **saved presets**, **customizable result columns**, and sortable output. The result is a table; clicking a row loads the chart.

We do not have 400+ filters or fundamentals, but we own the candles, so an **indicator screener over our symbol universe** is fully buildable server-side.

#### 8.2.2 Current status (cited)
- "Simple live-price scanner": `rightTab === 'screener'` (`BazaarNama.jsx:1046`) lists **all** `symbols` (from `api.chartSymbols()`, populated at `:646`) with their live mid + `▲/▼` arrow. There is **no filtering, no indicator column, no sorting, no presets** — it is just the full symbol list with live prices.
- The poll at `:601` switches its symbol set to the full `symbols` array when the screener tab is open, so we already fan-out live prices for the whole universe.

#### 8.2.3 Filter schema (design)
A screener query is a JSON object the client builds and posts. Each filter targets a **metric** with an **operator** and **operand(s)**. Metrics are computed from our candles on a chosen timeframe.

```jsonc
{
  "tf": "H1",                       // timeframe all indicator metrics are computed on
  "universe": "all",                // "all" | "forex" | "crypto" | "metals" | <list_id>
  "match": "all",                   // "all" (AND) | "any" (OR)
  "filters": [
    {"metric": "price",     "op": "between", "v": [1.05, 1.20]},
    {"metric": "chgPct",    "op": ">",       "v": 0.5},
    {"metric": "rsi14",     "op": "<",       "v": 30},               // oversold
    {"metric": "ema50",     "op": "cross_above", "ref": "ema200"},   // golden cross
    {"metric": "atr14_pct", "op": ">",       "v": 0.4},              // volatility floor
    {"metric": "above",     "op": "ema200"}                          // price above EMA200
  ],
  "sort": {"by": "chgPct", "dir": "desc"},
  "columns": ["last","chgPct","rsi14","atr14_pct","ema50","ema200"],
  "limit": 100
}
```

**Supported metrics** (all derived from our candle/indicator helpers):
| metric | source |
|---|---|
| `price` / `last` | `_current_price` / Redis mid |
| `chgPct` | daily open vs last (D1 candle) |
| `high` / `low` | current D1 candle |
| `rsi14` (param `p`) | `_rsi_list(closes, p)` last value |
| `atr14` / `atr14_pct` | `_ind_atr(candles, p)` last (pct = atr/price·100) |
| `ema20/50/200` (any `p`) | `_ema_list(closes, p)` last |
| `ema_dist_pct` | (price−ema)/ema·100 |
| `macd` / `macd_sig` / `macd_hist` | EMA(12)−EMA(26), signal EMA(9) |
| `above` / `below` | price vs a named reference series |

**Operators:** `>`, `>=`, `<`, `<=`, `==`, `between`, `cross_above`, `cross_below`. `cross_*` compare the **last two** values of two series (e.g. ema50 crossing ema200) → enables crossover screens without client logic.

#### 8.2.4 Server-side indicator-filter evaluator
A single pure function evaluates the schema against one symbol and is reused by the watchlist `/quote` endpoint and Hotlists:

```python
async def _screen_symbol(db, sym, tf, needed_metrics) -> dict | None:
    candles = await _chart_rows(db, sym, tf, limit=220)
    if len(candles) < 30: return None
    closes = [c["c"] for c in candles]
    last = (await _current_price(db, sym)) or closes[-1]
    feats = {"price": last, "last": last}
    if "chgPct" in needed_metrics or ...:
        d = await _chart_rows(db, sym, "D1", limit=2)
        if d: feats["chgPct"] = (last - d[-1]["o"]) / d[-1]["o"] * 100
              feats["high"], feats["low"] = d[-1]["h"], d[-1]["l"]
    if "rsi14" in needed: feats["rsi14"] = _last(_rsi_list(closes, 14))
    if "atr14" in needed:
        atr = _last(_ind_atr(candles, 14).get("atr"))
        feats["atr14"] = atr; feats["atr14_pct"] = (atr/last*100) if atr else None
    # ema/macd series kept as last-two for cross_* ops
    feats["_ema50_2"]  = _ema_list(closes, 50)[-2:]
    feats["_ema200_2"] = _ema_list(closes, 200)[-2:]
    return feats

def _passes(feats, f) -> bool:
    op = f["op"]
    if op in ("cross_above","cross_below"):
        a = feats.get(f"_{f['metric']}_2"); b = feats.get(f"_{f['ref']}_2")
        if not a or not b: return False
        return (a[-2] <= b[-2] and a[-1] > b[-1]) if op=="cross_above" \
               else (a[-2] >= b[-2] and a[-1] < b[-1])
    if op in ("above","below"):
        ref = feats.get(f"{f['v'] if 'v' in f else f.get('ref')}")
        ...
    val = feats.get(f["metric"])
    if val is None: return False
    if op == "between": return f["v"][0] <= val <= f["v"][1]
    return {">":val>f["v"], "<":val<f["v"], ">=":val>=f["v"],
            "<=":val<=f["v"], "==":abs(val-f["v"])<1e-9}[op]
```

**Cost control & caching.** The universe is small (the symbols we serve candles for — tens, not thousands), so a full scan is cheap, but indicator math per symbol still costs DB reads. We therefore:
- Compute the **`needed_metrics` set** from the query so we only run the indicators a query actually references.
- Cache each symbol's `feats` dict in Redis under `bn:screen:{sym}:{tf}` with a short TTL (one candle interval, e.g. 60–300s). A background Celery beat task can pre-warm the cache for the default `tf`s so interactive screens are instant.
- Enforce `limit ≤ 200` and reject more than ~12 filters.

**Endpoint:**
- `POST /screener` body = filter schema → `{rows:[{symbol, last, chgPct, rsi14, ...chosen columns}], total, tf}`. Sorted server-side by `sort`. Student-scoped.
- `GET /screener/presets` / `POST /screener/presets` `{name, query}` / `DELETE /screener/presets/{id}` — saved screens stored in a small `BnScreenerPreset(student_id, name, query JSONB)` table (cap 30/student). Ship 4 built-in presets returned regardless of auth: **Oversold (RSI<30)**, **Overbought (RSI>70)**, **Golden Cross (ema50 cross_above ema200)**, **Top Movers (|chgPct|>1)**.

#### 8.2.5 UI plan
Replace the bare list at `:1046` with a real screener panel:
- **Preset bar**: chips for built-in + saved presets; selecting one loads its `filters` and `columns`.
- **Filter builder**: rows of `[metric ▾] [op ▾] [value]` with "＋ افزودن فیلتر", a TF selector (M5/M15/H1/H4/D1 — our available data per `docs` §3), and AND/OR toggle. "ذخیرهٔ اسکرین" saves a preset.
- **Result table**: chosen columns, click-to-sort headers (re-POST with new `sort`), live `last` cell still updated by the 700ms poll, colored `chgPct` with `▲/▼` (reuse `:1052` rendering). Row click → `setSymbol`. Empty/closed-market state reuses the "بازار بسته" banner (`:1055`).
- Because the screener can run on a large universe, keep it on the **bottom panel** as a full-width tab too (matches `docs` §1 checklist "Stock Screener in bottom panel"), while leaving a compact version in the right panel.

---

### 8.3 Symbol Details tab

#### 8.3.1 Target behavior
A read-only "Details" tab for the active symbol: current price + day change, **day/52-week range bars**, a **Technical Rating** gauge (Strong Buy…Strong Sell from an oscillator+MA basket), key indicator readouts (RSI, MACD, ATR, EMAs, pivots), and — for instruments where we have it — light fundamentals/metadata (instrument type, contract size, spread, session). TradingView's rating aggregates ~26 indicators into Buy/Neutral/Sell counts.

#### 8.3.2 Current status (cited)
- **Not built (☐).** There is no Details tab in the right-panel tab list (`BazaarNama.jsx:976` enumerates only watch/ai/screener/trade/alerts). The closest existing logic is the AI-signal builder (`bazaarnama.py:303`) which already computes EMA20/50/200, RSI14, ATR14, 20-bar swing high/low and an up/down confluence score (`up`/`dn` at `:332`) — exactly the ingredients a technical rating needs.

#### 8.3.3 Implementation plan
**Endpoint:** `GET /details?symbol=&tf=` → student-scoped, reads candles once and returns:
```jsonc
{
  "symbol":"EURUSD","tf":"H1",
  "price": 1.0842, "chgPct": 0.31, "chgAbs": 0.0033,
  "dayRange":  {"low":1.0810,"high":1.0867,"pos":0.56},   // pos = where price sits 0..1
  "weekRange": {"low":1.0620,"high":1.0980,"pos":0.61},   // from D1 candles, ~252 bars
  "rating": {"label":"buy","score":0.42,"buy":11,"neutral":9,"sell":6},
  "indicators": {"rsi14":58, "atr14":0.0011, "atr14_pct":0.10,
                 "ema20":1.0835,"ema50":1.0820,"ema200":1.0790,
                 "macd":0.0007,"macd_sig":0.0005,"macd_hist":0.0002},
  "pivots": {"p":1.0840,"r1":..,"s1":..,"r2":..,"s2":..},
  "meta": {"type":"forex","contract_size":100000,"spread":0.8,"session":"London/NY"}
}
```
- **Range bars**: day from current D1 candle; 52-week (`weekRange`) from `_chart_rows(sym,"D1",limit=252)` min/max. `pos` drives a horizontal bar with a marker.
- **Technical Rating**: reuse the confluence approach already in `bazaarnama.py:332`. Compute a basket of signals — EMA(price>ema for 20/50/100/200), RSI(>55 buy/<45 sell/else neutral), MACD hist sign, Stoch, CCI, ADX-direction — tally `buy/neutral/sell`, and map a normalized score `(buy−sell)/total` to labels: `≥0.5 strong_buy, ≥0.1 buy, >−0.1 neutral, >−0.5 sell, else strong_sell`. This is **our own deterministic formula**, not TV's exact weights.
- **Pivots**: classic floor pivots from the prior D1 candle (H,L,C).
- **`meta`**: pulled from our per-instrument specs (the project already maintains contract_size/spread/min-stop per instrument per `MEMORY: instrument specs`); when absent, omit fundamentals gracefully.

**UI:** add `['details','جزئیات']` to the tab list at `:976`. Render: big price + colored chg; two range bars (day, 52-week) with markers; a **rating gauge** (semicircle, 5 zones) with the buy/neutral/sell counts beneath; a compact indicator grid; a pivots row. Auto-refresh price via the existing `live[symbol]` so the header stays live without extra polling.

---

### 8.4 Hotlists (Gainers / Losers / Most-Active)

#### 8.4.1 Target behavior
Three quick lists computed across the universe: **Top Gainers**, **Top Losers** (by `chgPct`), and **Most Active** (by intraday range/volume proxy). Click a row → load chart.

#### 8.4.2 Current status (cited)
- **Not built (☐).** No hotlists endpoint or tab exists.

#### 8.4.3 Implementation plan
Hotlists are a **specialization of the screener evaluator** (§8.2.4) — no new compute path:
- `GET /hotlists?tf=D1&n=10` → `{gainers:[...], losers:[...], active:[...]}` where each item = `{symbol,last,chgPct,range_pct}`.
- For every symbol in the universe, compute `chgPct` (D1 open vs last) and `range_pct = (high−low)/open·100` for the current D1 candle.
  - **gainers** = top `n` by `chgPct` desc; **losers** = top `n` asc; **active** = top `n` by `range_pct` (our volume proxy, since FX has no consolidated volume; for crypto symbols where tick volume exists we can use it instead).
- Reuse the **same Redis feature cache** (`bn:screen:*`) so hotlists and screener share warmed data; refresh every 60–120s.

**UI:** either a third right-panel sub-tab or three small stacked cards inside the screener tab. Each card: header + `n` rows with colored `chgPct` and `▲/▼`. Row click → `setSymbol`.

---

### 8.5 News stream (wire our existing news module)

#### 8.5.1 Target behavior
A scrollable news feed in the right panel, **filtered to the active symbol when relevant** and otherwise showing the latest market headlines. Each item: headline, source, relative time, and a click that opens the full article. TradingView pulls Reuters/Dow Jones; we use **our own news pipeline**.

#### 8.5.2 Current status (cited)
- We have a **full news module** already: `src/news/ingest.py` fetches RSS feeds (`_fetch_feed` `:217`), de-dupes (`_norm_title`/`_is_dup_title`), filters market relevance (`_iran_is_market` `:114`, `_is_non_market`), translates to Persian, and **persists into the `Article` table** (`src/core/database.py:280`) with `category` (e.g. `news`), `summary`, `cover_image`, `published_at`, `slug`, `tags`.
- There is already a **public articles API**: `GET /articles?category=news` (`src/api/routes/articles.py:151`) returns published cards ordered by `published_at`, and `GET /articles/{slug}` (`:223`) returns the full article. So the data and a read API **already exist** — Pro-Chart just needs to consume them and add symbol relevance.
- **Not yet wired** into BazaarNama: no News tab in `:976`, and §8 of the reference marks News ☐.

#### 8.5.3 Implementation plan
Minimal new surface — mostly wiring:
- Add a thin BazaarNama endpoint `GET /news?symbol=&limit=20` (student-scoped) that queries `Article` where `category in ('news','analysis')` and `is_published`, ordered by `published_at desc`. **Symbol relevance**: match the symbol and its expansions against `Article.tags` and title/summary — e.g. `EURUSD → {EUR, USD, euro, dollar, یورو, دلار, EURUSD}`; we maintain a small symbol→keywords map (the news module already has `src/news/keywords.py`). If no symbol match yields enough items, fall back to latest general market news so the feed is never empty.
  - Returns cards: `{title, summary, source, image, slug, url, published_at, relevant: bool}`.
  - Alternatively the frontend can call the existing `GET /articles?category=news` directly; the dedicated endpoint exists only to add symbol filtering + a lighter card shape and to keep it behind academy auth consistently.
- **No new ingestion** — the Celery beat job that already runs `src/news/ingest.py` keeps the feed fresh.

**UI:** add `['news','اخبار']` to `:976`. The tab shows a vertical list of news cards (image thumb, title, source · relative time). A toggle "مرتبط با {symbol}" filters by relevance. Click → open the article (in-app reader route or new tab to `url`). Auto-refresh every ~60s.

---

### 8.6 Economic Calendar + Earnings/Dividends

#### 8.6.1 Target behavior
A calendar of scheduled macro releases (CPI, NFP, rate decisions, …) with **country/currency, time, impact (low/med/high), actual/forecast/previous**, filterable by date range, country, and impact. Plus an earnings/dividends calendar for equities.

#### 8.6.2 Current status (cited)
- **No structured economic-calendar data store.** The trading engine has a **news-time risk filter** `src/signals/news_filter.py` (referenced by `risk/guard.py`, `risk/multi_level_limits.py`) which knows about high-impact event *windows* to block trading, but it is a guard, not a queryable calendar feed, and there is no `EconomicEvent` table in `database.py`.
- Earnings/dividends: not applicable to our current FX/crypto-centric universe and **not stored** — lowest priority (☐).

#### 8.6.3 Implementation plan
**New data model** (the one genuinely new ingestion in this chapter):
```python
class EconomicEvent(Base):
    __tablename__ = "economic_events"
    id; ts: DateTime(tz)                 # event time (UTC)
    country: String(4)                   # ISO country
    currency: String(4)                  # affected currency (USD,EUR,...)
    title: String(200)                   # "CPI y/y", "Non-Farm Payrolls"
    impact: String(8)                    # low|medium|high
    actual: String(40) = None
    forecast: String(40) = None
    previous: String(40) = None
    source: String(60)
    # index on (ts), (currency)
```
**Ingestion:** a Celery beat task (sibling of news ingest) pulls a free economic-calendar feed (e.g. an ICS/JSON public source we're licensed to use, or the same source the existing `news_filter` windows are derived from) and upserts `EconomicEvent` rows keyed by `(ts, title, currency)`. This also lets us **back the existing `news_filter` guard with real rows** instead of hard-coded windows — a useful consolidation.

**Endpoints** (student-scoped):
- `GET /calendar?from=&to=&currency=&impact=&symbol=` → `{events:[{ts,country,currency,title,impact,actual,forecast,previous}]}`, ordered by `ts`. When `symbol` is passed, derive its currencies (EUR/USD for EURUSD) and filter to those — so the calendar can be **symbol-aware** like the news tab.
- `GET /calendar/earnings?...` — stubbed/empty until we add an equities universe; the schema and endpoint exist so the UI degrades gracefully.

**UI:** add `['cal','تقویم']` to `:976`. Render a day-grouped list: each row = time · currency flag · impact dots (1–3, colored) · title, with actual/forecast/previous when present. Filters: date range (Today/This Week), impact (high-only toggle), and "مرتبط با {symbol}". A red **"now" marker** and highlight for events within the next hour. High-impact upcoming events can also surface as a small banner on the chart (reusing the existing `news_filter` knowledge) so traders see the risk window.

---

### 8.7 Status rollup & build order

| Area | Current | After this chapter |
|---|---|---|
| Watchlist | single list, live mid only (`:978`, `BnWatchlist`) | multi named lists, flags/groups, columns, sort, change%+arrow |
| Screener | full-list live prices, no filters (`:1046`) | server-side indicator/price/change filter schema + presets + sortable table |
| Details | none | price/range/52w/rating/indicators/pivots/meta endpoint + gauge UI |
| Hotlists | none | gainers/losers/active off the shared evaluator + cache |
| News | ingest+`Article`+`/articles` exist (`ingest.py`, `articles.py:151`) but unwired | `/news` symbol-aware endpoint + News tab |
| Calendar | only `news_filter` guard windows | `EconomicEvent` table + ingest + `/calendar` + Calendar tab |

**Recommended build order** (cheapest leverage first):
1. **News tab** — pure wiring over existing `Article` data; no new compute. Fastest visible win.
2. **Watchlist change%+arrow** — the `dir` and live mid already exist (`:611`); add change% via D1 open. Then multi-list/flags/columns/sort.
3. **Screener evaluator** (`_screen_symbol`/`_passes`) + `POST /screener` + presets — this single evaluator unlocks Hotlists and the watchlist `/quote` columns too.
4. **Hotlists** — trivial once the evaluator + Redis feature cache exist.
5. **Details tab** — reuses the AI-signal indicator math (`bazaarnama.py:332`) for the rating.
6. **Economic Calendar** — only item needing a new table + ingestion; doubles as a real backing for the `news_filter` guard.

All six reuse the **same candle helpers** (`_chart_rows`, `_ema_list`, `_rsi_list`, `_ind_atr`, `_current_price`) and the **same Redis tick source** already wired in `bazaarnama.py`, so no new data infrastructure is introduced — only one new table (`EconomicEvent`) and two small ones (`BnWatchItem`, `BnScreenerPreset`).


---

## 9. Real-time, Bar Replay & Trading-from-Chart

This chapter specifies the **live behavior** of Pro-Chart: how prices stream onto the
chart tick-by-tick, how the forming candle is built and animated, how the user replays
historical bars to study or practice, and how the user trades directly from the chart
surface (Buy/Sell panel, draggable Entry/SL/TP lines, DOM ladder, order/position lines).
For each subsystem we give: (a) the **target behavior** (what the user sees and feels),
(b) **our current status** with exact code citations, and (c) the **implementation plan**
to close the gap. The reference catalog for this chapter is `docs/TRADINGVIEW_REFERENCE.md`
sections 9 (Live/Real-time) and 10 (Bar Replay & Trading-from-Chart).

The single source-of-truth file is `frontend/academy/src/pages/BazaarNama.jsx`
("Pro-Chart" in product copy; "بازارنما"/BazaarNama internally). The price source is
`src/data/feed_manager.py` and the push transport is `src/api/routes/live_prices.py`
(mounted at `/ws`, so the endpoint is `/ws/prices`). We reproduce **feature and behavior**,
never proprietary TradingView code; our engine is the open-source `lightweight-charts` v5.

---

### 9.1 Real-time: tick-by-tick streaming

#### 9.1.1 Target behavior

A professional chart must feel *alive*: the last price must move continuously, the forming
("live") candle must grow/shrink in place, a horizontal **last-price line** must track the
quote with a colored axis label, and a **countdown** must show how long until the current bar
closes. On a real broker feed (MT5) ticks arrive many times per second; the chart should
render each tick smoothly without jank, never redrawing the whole series.

#### 9.1.2 Our current status (cite code)

Pro-Chart already implements a sophisticated **two-stage smoothing pipeline** that decouples
the (slow, jittery) data source from the (smooth, 60fps) render, so even a 5–13s yfinance
poll *feels* like a live tick feed:

1. **Poll loop** — `BazaarNama.jsx` runs `poll()` on a `setInterval(poll, 700)` (the comment
   says ~1.5s; the interval is actually 700ms). It calls `api.bnPrices(syms)` →
   `GET /academy/bn/prices`, which reads Redis (populated by `feed_manager._update_price` →
   `redis_client.set_price`). It sets `marketOpen`, computes per-symbol direction arrows for
   the watchlist/screener (`lastMidRef`), and for the active symbol calls `applyTick(mid)`.
   When the market is closed (empty Redis) `setLivePrice(null)`.

2. **`applyTick(mid)`** — does **not** draw. It only sets the *target* of an easing animation:
   `e.target = mid`. The first tick snaps (`e.display = mid; applyMid(mid)`). It also
   `setLivePrice(mid)` for the header/legend. For non-standard chart types (Renko/Kagi/P&F)
   it bypasses easing and just sets the live price.

3. **60fps `requestAnimationFrame` loop** — the heart of the "tick-by-tick" feel. Each frame:
   - **Convergence:** `e.display += (e.target - e.display) * 0.18` — exponential ease toward
     the real price.
   - **Bounded micro-tick (visual only):** a damped random walk
     `e.noise = e.noise*0.86 + (rand-0.5)*amp*0.55`, **clamped** to
     `amp = max((last.h-last.l)*0.06, |target|*0.00003)` (≈0.3 pip). This makes the forming
     candle wiggle continuously like a real tick feed **without ever corrupting the real
     price** — the noise is added only to the *displayed* value passed to `applyMid`.
   - Calls `applyMid(e.display + e.noise)`.

4. **`applyMid(mid)`** — the only function that mutates the chart. It:
   - Guards against replay mode and non-standard types; sanity-checks the tick
     (`|mid-last.c|/last.c > 0.2` rejected as a glitch).
   - **Live candle building (client-side):** computes the current bar bucket
     `curBar = floor(now/sec)*sec` where `sec = tfSec(tf)`. If `curBar > last.t` it **pushes a
     new candle** `{t:curBar, o:last.c, h, l, c:mid}` (caps array at 2000) → rolls the bar over.
     Otherwise it **updates the forming candle** in place: `last.h=max(...)`, `last.l=min(...)`,
     `last.c=mid`. It then calls `series.update(...)` (the cheap incremental v5 API, never
     `setData`).
   - **Last-price line:** maintains a single `liveLineRef` price line titled `LIVE`
     (`color #2962FF`), updated every frame with the lightweight `applyOptions({price})` — no
     remove/create churn.

5. **Countdown** — a separate `setInterval(tick, 1000)` computes
   `rem = sec - (now % sec)` and formats `H:MM:SS` / `M:SS` into `countdown`, rendered bottom-right
   with a market-open/closed dot. (TRADINGVIEW_REFERENCE §9 lists this as ☐, but it **is**
   implemented — the reference is stale; this spec corrects it to ✅.)

6. **WebSocket path (present, gated)** — there is a full `useEffect` that opens
   `new WebSocket(${proto}://${host}/ws/prices)` **only if** `import.meta.env.VITE_BN_WS` is set.
   `onmessage` parses `{prices}` (or a bare map), extracts `mid` (or `(bid+ask)/2`), and calls
   the same `applyTick(mid)` — so the easing/candle pipeline is transport-agnostic. The backend
   `src/api/routes/live_prices.py` is complete: a `ConnectionManager`, a `@router.websocket("/prices")`
   handler that accepts a `{"action":"subscribe","symbols":[...]}` message (≤50 symbols),
   a `pong` responder, and a push loop reading `_read_prices_from_redis()`. It is mounted at
   `prefix="/ws"` in `src/api/main.py`. **The gap is purely deployment:** the academy nginx vhost
   does not proxy `/ws/prices`, and `VITE_BN_WS` is unset, so the client never connects (by design,
   to avoid console noise) and falls back to the 700ms poll.

**Data-source limit:** `feed_manager.py` currently has exactly one active source —
`self._sources = [("yfinance", self.yfinance)]`. MT5/OANDA/TwelveData connectors exist but are
disabled (`mt5/oanda` don't connect in this environment; TwelveData ran out of API credit).
yfinance ticks are effectively **delayed quotes refreshed every ~5–13s**, written by
`_price_update_loop` every `PRICE_UPDATE_INTERVAL_SECONDS` and `publish("price_updates", tick)`.
So today the "smoothness" is *manufactured client-side* by the easing+noise pipeline; the
**true tick granularity** the chart needs for serious trading must come from a real MT5 broker
feed.

#### 9.1.3 Implementation plan

**A. Wire a real MT5 tick feed into Redis (server side).** Our copy-trading stack already has
MT5 running on the Hetzner Windows copy server (see memory: *master-on-windows*, *copy-windows*).
Plan:
- Add an **MT5 tick source** to `feed_manager._sources` (re-enable `MT5Connector` against the
  Windows agent / a MetaApi-style bridge) so `get_tick(symbol)` returns real `{bid, ask, mid, ts}`.
  Keep yfinance as a labeled fallback in `get_candles_with_source` ordering so a broker outage
  degrades gracefully instead of going dark.
- Run `_price_update_loop` at a much tighter cadence for the streamed symbols (e.g. 250ms, or
  push *every* MT5 `on_tick` callback instead of polling) and `set_price` + `publish("price_updates")`
  each tick. The forming-candle math in `applyMid` already handles arbitrary tick rates, so no
  client change is needed beyond turning on WS.
- Mark the source in the price payload (`{src:"mt5"|"yfinance", delayed:bool}`) and surface a small
  badge near the `LIVE` label so users know whether they're on real or delayed data (compliance).

**B. Activate WebSocket push (replace 700ms poll).**
- **nginx:** add a `location /ws/prices` block to the academy vhost with
  `proxy_pass http://api:8000/ws/prices; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade"; proxy_read_timeout 3600s;`.
- **env:** set `VITE_BN_WS=1` (or the WS origin) for the academy build; rebuild the frontend image
  (Vite bakes env at build time — a restart is not enough; see memory: *deploy-rebuild*).
- **client hardening:** on WS open, send `{"action":"subscribe","symbols":[symbol,...watch]}` and
  re-subscribe whenever `symbol`/`watch` change; add exponential-backoff reconnect; **suppress the
  700ms poll while the socket is healthy** (keep poll as a watchdog fallback when `ws.readyState !== OPEN`
  for >2s). This cuts request volume ~Nx and gives genuinely smooth streaming.
- Keep the easing loop on top of WS: with real ticks the convergence (`*0.18`) still smooths
  transport jitter, and the synthetic noise amplitude can be **reduced toward zero** when real tick
  density is high (detect via inter-tick interval) so we don't add fake wiggle on top of real movement.

**C. Live candle correctness.** Today the client builds the forming candle from `mid` alone. With a
real feed, also: (i) seed the new bar's open from the **first real tick of the bucket** (not just
previous close) when available, and (ii) reconcile against the authoritative bar from
`api.chart(...)` on the next poll/WS candle event to correct any drift (replace the forming candle
when the server's closed bar arrives). Non-standard chart types (Renko/Range/etc.) intentionally do
**not** live-update (`applyMid` early-returns) — keep that, and only refresh them on the periodic
reload.

**D. Live P&L of open positions on the chart.** *Currently ☐.* Plan: poll `api.paperPositions()`
(`GET /academy/paper/positions`, which already returns `open[]` with current price baked in via
`_current_price`) every 1–2s, and for each open position draw a **position line** (entry price line
with a P&L tag) plus a small floating badge `+12.4 ($+24.80)` that recolors green/red and updates
each frame from the live `mid`. When real broker orders are connected (§9.3), the same panel shows
**real** unrealized P&L. Add a compact "Positions" strip docked to the chart bottom with per-position
close / reverse / breakeven buttons.

---

### 9.2 Bar Replay

#### 9.2.1 Target behavior

Bar Replay lets a user rewind history and step forward bar-by-bar to study price action or practice
trading "blind." Required behavior: **pick the start point by clicking a bar on the chart**, then
**Play / Pause / Step-forward**, a **speed selector (9 speeds)**, and **Jump-to-date**. While replay
runs, real-time updates must be frozen, and (ideally) the user can place paper trades that resolve
against the revealed bars.

#### 9.2.2 Our current status (cite code)

Replay exists but is **basic** (TRADINGVIEW_REFERENCE §10 marks it ◑):
- **Enter:** `enterReplay()` requires ≥30 bars, snapshots `candlesRef.current` into
  `replayRef.current.full`, and **hard-codes the start at 55%** of history
  (`start = floor(full.length*0.55)`) — there is **no click-to-pick-start**. It truncates the series
  to `full.slice(0, start+1)`, rebuilds price/overlays/subs, and `fitContent()`s.
- **Step:** `replayStep()` advances `idx` and `series.update(...)`s the next bar (value or OHLC by
  chart type). When `idx` reaches the end it auto-pauses.
- **Play loop:** a `useEffect` runs `setInterval(replayStep, max(120, 1600/speed))`.
- **Speeds:** only **4** (`[1,2,4,8]×`) in the floating control, not 9.
- **Jump-to-date:** **not implemented** (☐).
- **Real-time freeze:** correctly handled — `applyMid` and the 60fps frame both early-return when
  `replayRef.current && replayPlayingRef.current`, so streaming never fights replay.
- **Exit:** `exitReplay()` resets state and calls `load()` to restore live data.

#### 9.2.3 Implementation plan

**A. Click-to-pick start point.** Add a transient `replayArm` mode: clicking the chart toolbar's
Replay button first enters an **"arm"** state where the cursor shows a vertical guide; on the next
`subscribeClick` (lightweight-charts) we map the clicked `time`/logical index to a bar and set
`start = thatIndex` instead of the fixed 55%. Show a ghost overlay dimming bars to the right of the
chosen point until Play. Persist the chosen index in `replayRef`.

**B. Nine speeds.** Replace `[1,2,4,8]` with the TradingView-style ladder
`[0.1, 0.25, 0.5, 1, 2, 3, 5, 10, 30]×` (9 steps) and map to the interval as
`delay = clamp(baseMs / speed, 16, 4000)`. Keep Play/Pause/Step exactly as-is (they already work).
Add a **Step-back** button (decrement `idx`, rebuild slice) since users frequently want to re-watch
a bar.

**C. Jump-to-date.** Add a date/time input in the replay control; on submit, binary-search
`replayRef.current.full` for the nearest bar `t`, set `idx` there, rebuild the slice, and `fitContent`.
This also lets a deep-link / lesson preset open replay at a specific historical moment (useful for the
academy — see memory: *edu-academy*, *vip-academy-web*).

**D. Trade-during-replay (practice mode).** Allow the Buy/Sell panel (§9.3) while paused/playing in
replay; resolve SL/TP against the **revealed** bars only (never future bars) and accumulate a
session P&L, giving a self-contained "trading simulator." This reuses the paper engine but in a
sandboxed in-memory ledger keyed to the replay session so it doesn't pollute the real paper account.

**E. Multi-timeframe & lazy-history awareness.** Replay snapshots whatever 800 bars are loaded; when
the user picks a start near the left edge, trigger `loadMoreHistory()` first so there's runway. Disable
replay for derived/aggregated TFs and non-standard chart types (consistent with the existing guards).

---

### 9.3 Trading from the chart

#### 9.3.1 Target behavior

The chart is also an order ticket. Required: a **Buy/Sell panel**; **draggable Entry / SL / TP
lines** rendered on the price scale that the user can grab and drag, with live **Risk:Reward**
recompute; a **DOM (Depth-of-Market) ladder** to click a price level; **order lines** (pending
entries) and **position lines** (open trades with live P&L); and **broker integration** so the same
gestures place **real** orders. Closing/modifying on any device must reflect everywhere.

#### 9.3.2 Our current status (cite code)

Pro-Chart already has a **working from-chart trading surface against the paper engine**:
- **Buy/Sell panel:** the right "ترید" (Trade) tab. `startTrade(side)` seeds an order from
  `curPrice()` (= `livePrice` or last close) with a default 0.5% stop and 2R target:
  `sl = e ∓ d`, `tp = e ± 2d` (`d = e*0.005`). The panel lets the user edit Entry/SL/TP numerically
  and shows live **R:R** (`reward/risk`), green when ≥1.
- **Draggable Entry/SL/TP lines:** wired through the canvas drawing layer —
  `drawRef.current.setOrder(order)` renders the three lines and `drawRef.current.onOrder = (o)=>setOrder(o)`
  syncs drags back into React state. So dragging on the chart and editing in the panel are two-way bound.
- **DOM ladder:** rendered in the Trade tab — a ±8-level ladder around `curPrice()` with
  `step = px*0.0002`, center highlighted, sizes generated by `50*exp(-|i|/3)` (a **simulated** book,
  not a real Level-2 feed — TRADINGVIEW_REFERENCE §9/§10 marks DOM ◑). Clicking a level sets the
  order's `entry` to that price.
- **Submit:** `submitOrder()` posts `api.paperOpen({symbol, direction, entry, sl, tp, risk_pct:1})`
  → `POST /academy/paper/open` (`paper_open` in `src/api/routes/academy.py`). There is also a one-tap
  `quickTrade(dir)` with fixed 0.5%/1% SL/TP.
- **Order/position lines:** entry/SL/TP order lines exist (the draggable trio); **persistent
  open-position lines with live P&L are not yet drawn on the chart** (positions live in the paper
  account via `api.paperPositions/paperAccount/paperClose/paperClosePartial`). TRADINGVIEW_REFERENCE
  §10 marks order/position lines ◑.
- **Broker integration:** **paper only.** No real-broker order placement from this UI. The platform,
  however, **already owns a full real-broker execution path** elsewhere: the copy-trading MT5 engine
  (memory: *live-trading*, *copy-windows*, *master-on-windows*, *trailing-execution-fix*, *no-reopen*),
  with per-account server-side signal dismissal, trailing/breakeven, and real P&L tracking
  (memory: *pnl-history*).

#### 9.3.3 Implementation plan

**A. Persistent position lines + live P&L (near-term, no broker risk).** Poll `api.paperPositions()`
and render, per open position: a solid **entry line** (with lot/size + side), the protective **SL**
and **TP** lines, and a **P&L pill** that updates each animation frame from the live `mid`
(reuse §9.1.4). Add inline actions on the line: **Close**, **Close-partial** (we already have
`paperClosePartial`), **Move-to-breakeven**, and **drag SL/TP to modify** (POST a modify endpoint).
This is the highest-value, lowest-risk next step and finishes the §10 "order/position lines" item.

**B. Real DOM (optional).** If/when the MT5 feed exposes market depth, replace the simulated ladder
with real Level-2 data streamed over the same `/ws/prices` channel (extend the payload with a
`book[]`); otherwise keep the synthetic ladder but label it clearly as indicative. For FX (our brand
is **forex-only** — memory: *forex-only-brand*) genuine L2 depth is broker-dependent, so synthetic is
acceptable for education.

**C. Real broker orders (design — gated, owner-controlled).** Connect the from-chart Buy/Sell to the
existing MT5 execution engine instead of (or alongside) the paper engine:
- **Account binding:** the VIP user panel already links a broker account and runs a copy-trade engine
  (memory: *user-panel*, *copy-windows*). Add a per-user "trade live" toggle that routes
  `submitOrder()` to a new `POST /academy/broker/order` which forwards to the MT5 agent on the Windows
  copy server (the same transport that executes copy signals and the `trail_sl` 9th field —
  memory: *trailing-execution-fix*).
- **Order model:** map the chart's `{side, entry, sl, tp, risk_pct}` to a broker order. If `entry`
  ≈ current price → **market** order; else → **pending** (buy/sell limit/stop depending on side and
  side-of-market). Position-size from `risk_pct` using the instrument specs we already maintain
  (`contract_size`/`min-stop`/spread-buffered SL — memory: *instrument-specs*) and the existing
  `paperCalcSize` logic generalized server-side.
- **State sync & safety:** reflect fills as **position lines** (§9.3.A) fed by the real account's
  positions; honor the **no-reopen** rule (closed on any device stays closed — memory: *no-reopen*)
  and the kill-switch / daily-loss guards (memory: *panel-v2*, *signal-unblock*). Enforce
  **`TRADING_MODE` discipline** from `CLAUDE.md` (paper until divergence is approved) and keep live
  trading behind an explicit owner action + per-account opt-in. **Hard rule:** never a demo account
  anywhere (memory: *no-demo-accounts*) — live tests only on the owner's real account.
- **Modify/close:** dragging SL/TP on a real position issues a broker **modify**; the line snaps to
  the broker's confirmed value (don't trust the optimistic drag until ack). Partial close maps to a
  reduce-volume order.

**D. Order ticket polish.** Promote the Trade tab into a proper ticket: order type (market/limit/stop),
volume in lots (with risk→lots calculator), expiry for pendings, and a confirmation step for live
orders. Keep the two-way drag binding (already solid) as the headline UX.

---

### 9.4 Summary of status and priorities

| Capability | Behavior | Current status (code) | Plan |
|---|---|---|---|
| Tick streaming + 60fps easing | continuous smooth price | ✅ `applyTick`/`applyMid`/RAF loop + bounded noise | reduce synthetic noise once real ticks flow |
| Live candle building | forming bar grows in place | ✅ `applyMid` bucket math + `series.update` | seed open from first real tick; reconcile drift |
| Last-price line + countdown | `LIVE` line + bar timer | ✅ `liveLineRef` + countdown interval | (reference §9 is stale → mark ✅) |
| Real tick source | broker-grade ticks | ◑ yfinance ~5–13s only | add MT5 source to `feed_manager._sources` |
| WebSocket push | low-latency, low-load | ◑ code complete, not proxied | nginx `/ws/prices` + `VITE_BN_WS` + rebuild |
| Live P&L on chart | per-position unrealized P&L | ☐ | poll `paperPositions`, draw pills/lines |
| Bar Replay: pick start | click a bar | ◑ fixed 55% | `subscribeClick` → start index |
| Bar Replay: 9 speeds | full speed ladder | ◑ 4 speeds | replace with `[0.1…30]×` |
| Bar Replay: jump-to-date | seek to a date | ☐ | binary-search `replayRef.full` |
| Buy/Sell + draggable E/SL/TP | order ticket on chart | ✅ (paper) | order types + lots + confirm |
| DOM ladder | click-to-price depth | ◑ simulated | real L2 over WS if broker exposes it |
| Order/position lines | persistent lines + P&L | ◑ order lines only | add position lines (§9.3.A) |
| Real broker orders | place real trades | ☐ (paper only; MT5 engine exists) | route to MT5 agent, owner-gated |

**Build order (recommended):** (1) activate WebSocket (nginx + `VITE_BN_WS` + rebuild) — cheap, big
smoothness/load win; (2) live position lines + P&L on chart; (3) replay click-start + 9 speeds +
jump-to-date; (4) MT5 tick source into `feed_manager`; (5) owner-gated real-broker order routing via
the existing copy-trade MT5 engine, behind `TRADING_MODE`/kill-switch/no-demo guards.


---

## 10. Multi-Chart Layouts, Templates, Settings & Hotkeys

This chapter specifies the **workspace layer** of Pro-Chart: how multiple charts are arranged and synchronized, how a user's entire desk (symbols, intervals, indicators, drawings, theme) is saved as named layouts and reusable templates, the full multi-tab Settings dialog, the theming system, and the complete keyboard shortcut map. These are the features that turn a single chart widget into a *trading terminal*. Most of this layer is what the user touches constantly but never thinks about — it must be fast, persistent, and never lose work.

Reference behavior is TradingView section 11 (`docs/TRADINGVIEW_REFERENCE.md`); we reproduce **behavior**, not their proprietary code. Our chart engine is open-source `lightweight-charts` v5.

---

### 10.0 Current status at a glance

| Capability | TradingView | Pro-Chart today | Source of truth |
|---|---|---|---|
| Multi-chart grid | up to 16 charts | 1 / 2 / 4 minicharts | `BazaarNama.jsx:171,816,951-957`; `MiniChart.jsx` |
| Symbol/crosshair/time/interval sync across charts | full | **none** | — |
| Named saved layouts | yes | yes (server `bn_layouts`) | `BazaarNama.jsx:152,649,744-756` |
| Chart / indicator templates | yes | **none** | — |
| Multi-tab Settings dialog | Symbol/Scales/Appearance/Trading/Events/Status-line | simple per-indicator editor + a few toolbar selects | `BazaarNama.jsx:817,839` |
| Dark / light theme | yes | yes | `BazaarNama.jsx:73-76,123-126,233-237` |
| Custom theme | yes | **none** (two fixed palettes) | `THEMES` const |
| Keyboard shortcuts | full keymap | `Ctrl+Enter` (run script) only; `Ctrl+Z/Y` are **button tooltips, not bound** | `CodeEditor.jsx:81`; `BazaarNama.jsx:856-857` |
| Workspace persistence | cloud | `localStorage` (`bn_workspace`) + server layouts | `BazaarNama.jsx:39-41,363-366` |

The honest summary: **persistence is good, arrangement and configuration are thin.** We already auto-save the working desk to the browser and can store/restore named layouts on the server. What we lack is (a) real multi-chart with cross-chart sync, (b) templates as a first-class concept distinct from layouts, (c) a proper Settings dialog, (d) custom themes, and (e) a global hotkey layer.

---

### 10.1 Multi-chart grid

#### 10.1.1 Behavior (target)

A **layout** is a tiling of the chart area into N independent chart cells. TradingView ships 16 presets (1, 2h, 2v, 3, 4, 6, 8, ... up to 16). Each cell is a full chart: its own symbol, interval, chart type, indicators, drawings, and price scale. One cell is the **active cell** (highlighted border); the top toolbar (symbol search, interval, indicators, drawing tools) acts on the active cell. Cells can be resized by dragging the splitter gutters.

Crucially, cells can be **linked** through four independent sync toggles:

- **Symbol sync** — changing the symbol in the active cell changes it in all linked cells.
- **Interval sync** — changing the timeframe propagates to all linked cells.
- **Crosshair sync** — moving the crosshair in one cell draws a ghost crosshair at the same *time* (and optionally price) in the others.
- **Time/range sync** — panning or zooming the time axis in one cell scrolls all linked cells to the same visible time range.

Each toggle is independent, so a common desk is: symbol-synced + interval-*un*synced (same instrument across M5/M15/H1/H4 — a multi-timeframe wall), or symbol-*un*synced + time-synced (correlation desk: EURUSD, GBPUSD, DXY all scrolling together).

#### 10.1.2 Current status (cite code)

We have a **degraded** multi-chart. `grid` is a 1→2→4 cycle (`BazaarNama.jsx:171`, toggle button at `:816`). When `grid > 1` we render an **absolute-positioned overlay** of `MiniChart` cells on top of the main chart (`:951-957`):

```jsx
{grid > 1 && (
  <div className="absolute inset-0 z-30 grid gap-1 p-1" style={{ gridTemplateColumns: grid === 2 ? '1fr 1fr' : '1fr 1fr', gridTemplateRows: grid === 2 ? '1fr' : '1fr 1fr' }}>
    {Array.from({ length: grid }).map((_, i) => (
      <MiniChart key={i} symbols={symbols} tf={tf} initial={i === 0 ? symbol : (watch[i] || symbols[i] || symbol)} />
    ))}
  </div>
)}
```

`MiniChart.jsx` is intentionally minimal: a candlestick-only chart with a symbol `<select>` and a last-price label. It has **no indicators, no drawings, no chart-type choice, no sync, no active-cell concept**, and it shares only the parent `tf` prop (so interval is globally shared, not per-cell). Limitations versus target:

- Only 3 presets (1/2/4); no 3/6/8/16 and no v/h variants.
- Minicharts are second-class (candles only) — they are *previews*, not *charts*.
- The top toolbar always drives the **main** chart, never a minicell. There is no "active cell".
- No splitter resizing — the grid is fixed `1fr` fractions.
- No symbol/crosshair/time/interval sync of any kind.
- Each `MiniChart` polls `api.chart(symbol, tf, '', 400)` independently and is not wired into the live-tick stream, so minicells do not tick.

#### 10.1.3 Implementation plan

The architectural change is to stop treating "the chart" as a singleton and treat it as **a grid of N `ChartCell` instances**, where the existing single-chart code becomes the body of one cell.

1. **Extract `ChartCell` component.** Refactor the body of `BazaarNama` (chart creation effect at `:189`, series builders, overlays/subs, drawing layer, live-tick application) into a self-contained `<ChartCell cellId symbol tf chartType overlays subs drawings scaleMode theme active onActivate />`. The cell owns its own `chartRef`, `priceSeriesRef`, `drawRef`. `MiniChart` is then deleted — every cell is a real chart.

2. **Layout presets.** Define a `LAYOUTS` table keyed by id with a CSS-grid template:
   ```js
   const GRID_LAYOUTS = {
     '1':  { cells: 1,  cols: '1fr',           rows: '1fr' },
     '2h': { cells: 2,  cols: '1fr 1fr',       rows: '1fr' },
     '2v': { cells: 2,  cols: '1fr',           rows: '1fr 1fr' },
     '3h': { cells: 3,  cols: '1fr 1fr 1fr',   rows: '1fr' },
     '4':  { cells: 4,  cols: '1fr 1fr',       rows: '1fr 1fr' },
     '6':  { cells: 6,  cols: '1fr 1fr 1fr',   rows: '1fr 1fr' },
     '8':  { cells: 8,  cols: 'repeat(4,1fr)', rows: '1fr 1fr' },
     '16': { cells: 16, cols: 'repeat(4,1fr)', rows: 'repeat(4,1fr)' },
   };
   ```
   Replace the 1→2→4 toggle button with a **layout picker popover** (a 4×4 mini-grid of clickable preset icons, mirroring TV).

3. **Per-cell state.** Promote the single `{symbol, tf, chartType, overlays, subs, drawings}` to an array `cells[]`, with `activeCell` index. The top toolbar reads/writes `cells[activeCell]`. Clicking any cell sets `activeCell` and draws the highlight border (use `THEMES[theme].up` or an accent for the active ring).

4. **Sync toggles.** Add a `sync = { symbol, interval, crosshair, time }` object (booleans) persisted in workspace. Provide four toggle buttons in a "Sync" group on the toolbar (icons: link for symbol, clock for interval, crosshair, arrows-LR for time). Implementation:
   - **Symbol/interval:** when `sync.symbol`/`sync.interval` is on, mutating the active cell's `symbol`/`tf` writes the same value to *all* cells (a `setAllCells(patch)` helper) instead of just the active one.
   - **Time:** subscribe each cell's `chart.timeScale().subscribeVisibleLogicalRangeChange`. On change in cell X (guarded by an `isApplyingSync` flag to prevent feedback loops), convert its visible *time* range and call `setVisibleRange(...)` on the other cells. Because cells may differ in interval, sync on **time range** (`from`/`to` as unix seconds), not logical index.
   - **Crosshair:** subscribe `chart.subscribeCrosshairMove` (we already do at `:222`). On move, take `param.time` and call `cell.chart.setCrosshairPosition(price, time, series)` on the other cells (price taken from each cell's series at that time, or hidden if absent). Clear with `clearCrosshairPosition()` on mouse-leave.

5. **Splitter resize.** Wrap the grid in a resizable splitter (track-mouse on gutter, store column/row fractions per layout in workspace). Re-emit `applyOptions({width,height})` to each cell's chart on resize (we already use `ResizeObserver` per cell, so this mostly works for free).

6. **Live ticks to every cell.** Move the price-stream subscription (currently main-chart-only, `:639-643`) up to a shared provider so each cell's `applyTick` is fed. Minicells must tick like the main chart.

7. **Persistence.** The whole grid (`layoutId`, `cells[]`, `sync`, splitter fractions, `activeCell`) becomes part of the workspace blob (10.6) and part of a saved layout's `data` (10.2).

---

### 10.2 Saved named layouts

#### 10.2.1 Behavior

A **layout** is the entire saved state of the chart area: grid arrangement, every cell's symbol/interval/chart-type/indicators/drawings, theme, scale mode, and sync toggles. Users save many named layouts ("EURUSD scalp desk", "Gold swing", "Correlation wall") and switch between them in one click. A layout is a snapshot — loading it replaces the current desk.

#### 10.2.2 Current status

We already persist layouts to the **server** (not just localStorage), which is the right call. State lives in `layouts` (`:152`), loaded on mount via `api.bnLayouts()` (`:649`). Save (`:745-749`):

```js
const saveLayout = async () => {
  const name = window.prompt('نامِ چیدمان:', 'چیدمان من'); if (!name) return;
  const data = { symbol, tf, chartType, theme, overlays, subs, drawings: drawRef.current ? drawRef.current.getDrawings() : [] };
  const r = await api.bnLayoutSave({ name, data }); setLayouts((l) => [{ id: r.id, name }, ...l]);
};
```

Load (`:750-756`) restores theme, chartType, overlays, subs, symbol, tf, and drawings (the drawings restore is deferred 400 ms so the chart/series exist first). UI: a `Save` icon button (`:822`) and a `<select>` of saved layouts (`:824-825`).

**Gaps:** (a) `data` only captures a *single* chart, not the grid/cells/sync — so multi-chart layouts cannot round-trip; (b) no rename, no delete, no overwrite/update, no duplicate from the UI; (c) `scaleMode` and `magnet`/`showVP` view-state are not saved; (d) `window.prompt` is a placeholder UX; (e) no "default layout on open" flag.

#### 10.2.3 Implementation plan

1. **Extend the `data` schema** to the full desk: `{ version, layoutId, sync, splitters, cells: [{ symbol, tf, chartType, scaleMode, overlays, subs, drawings, priceScaleOpts }], theme, activeCell }`. Bump `version` and write a migrator that wraps an old single-chart `data` into `{ cells: [data], layoutId: '1' }`.
2. **Layout manager panel** replacing the prompt/select: list with name, last-modified, **Rename / Duplicate / Delete / Overwrite / Set as default** actions, and a "★ default" star. Persist via existing `api.bnLayoutSave` + new `api.bnLayoutDelete` / `api.bnLayoutRename` endpoints.
3. **Default-on-open:** store `defaultLayoutId` in workspace; on mount, if set, load it instead of the raw workspace blob (workspace remains the "unsaved scratch" desk).
4. **Autosave-as-you-go** is *workspace* (10.6); named layouts are explicit snapshots — keep that distinction clear so a bad edit never silently corrupts a saved layout.

---

### 10.3 Chart & indicator templates

#### 10.3.1 Behavior

Templates are **reusable fragments**, distinct from layouts (which are whole desks):

- **Indicator Template** — a named bundle of indicators *with their settings* (e.g. "My MTF kit": EMA(20), EMA(50), RSI(14), MACD). Applying it adds those studies to the current chart without touching symbol/timeframe/drawings. TV exposes this from the Indicators dialog "Templates" tab.
- **Chart Template (Style/Settings template)** — a named bundle of *appearance + scales + status-line* settings (candle colors, grid, scale mode, timezone, body/wick/border on-off). Applying it restyles the current chart without changing which indicators are present. TV calls this a chart-properties template, separate from indicator templates.
- **"Apply Default" / "Save as Default"** — every indicator and the chart itself has a default profile; new charts/studies are created from it.

#### 10.3.2 Current status

**None.** We have no template concept at all. We have per-indicator inline editing (`editInd`, settings cog at `:839`) and the `THEMES` palette, but nothing that bundles indicator-sets or style-sets for reuse. There is also no "save as default indicator settings". Indicators are added with their hard-coded `REGISTRY` defaults (`addInd`, `:736`).

#### 10.3.3 Implementation plan

1. **Indicator templates.** New store `bn_ind_templates` (server + workspace mirror). "Save indicator template" captures the current `overlays` + `subs` arrays (key + inputs + color, **without** ids — regenerate ids on apply). "Apply" merges them onto the active cell via the existing `addInd`/`updInd` path. Surface as a "Templates" tab inside the indicators popover (`:811`).
2. **Chart/style templates.** New store `bn_chart_templates` capturing `{ theme(or custom palette), scaleMode, chartType, priceScaleOpts, timezone, statusLineOpts, gridOpts }`. Apply = `chartRef.applyOptions(...)` + state setters. Surface from the Settings dialog (10.4) as a "Template ▾" dropdown with Save/Apply/Manage.
3. **Defaults.** Add `Save as Default` to both the per-indicator editor and the Settings dialog; persist a `bn_defaults` profile consulted by `addInd` and by `createChart`/`buildPriceSeries`. "Reset to default" restores it.
4. Templates are intentionally **portable** (no symbol/timeframe inside) so they layer cleanly on any chart — the core difference from layouts.

---

### 10.4 The Settings dialog (multi-tab)

#### 10.4.1 Behavior (target)

A single modal with tabs governing the *active cell*:

- **Symbol** — per-symbol body/border/wick colors, up/down colors, hollow/thin-bars, precision, "color bars based on previous close", price-line on/off & color, last-price label.
- **Scales & Lines** — scale mode (Regular / Log / Percent / Indexed-to-100), Auto vs Lock, **Invert**, labels on price scale (high/low, indicators, symbol last), grid lines (vert/horz on-off + color + style), crosshair style (Cross/Dot/Arrow/Hidden) + color.
- **Appearance / Canvas** — background (solid/gradient), text color & font, watermark (symbol + interval) on-off & opacity, top/bottom/left/right margins, navigation buttons.
- **Trading** — buy/sell button visibility, position & order lines, P&L display, instant-order vs confirm, default quantity.
- **Events & Timezone** — chart **timezone** (and session display), economic-event flags on the time axis, dividends/splits/earnings markers (FX: N/A but session markers London/NY/Tokyo apply), session-break lines.
- **Status line** — which fields show in the top-left legend (symbol, OHLC, change, volume, indicator values, open-market countdown, logo/watermark).

#### 10.4.2 Current status

We have **fragments, not a dialog**:

- Per-indicator editor only: `editInd` opens a tiny panel for one study's numeric inputs + color (`:839`, "fix all" inputs/style noted as ◑ in the reference).
- Scale mode is a 3-option `<select>` on the toolbar (`scaleMode` 0/1/2 = Regular/Log/Percent, `:817`, applied at `:240`).
- Theme is a dark/light toggle (10.5).
- Crosshair is hard-wired to `mode: 0` (Cross) in both `createChart` calls (`BazaarNama.jsx:197`, `MiniChart.jsx:23`) — no Dot/Arrow/Hidden.
- Grid/background/text colors come from the `THEMES` palette and `applyOptions` (`:233-237`); not user-editable.
- No timezone control, no status-line config, no Trading-tab settings, no margins, no Invert, no Indexed-to-100, no watermark control.

So: **scale mode** and **colors-by-theme** exist; everything else in the six tabs is missing.

#### 10.4.3 Implementation plan

1. **Build a `<SettingsDialog>`** modal with the six tabs above, operating on the active cell. Most controls map straight onto `lightweight-charts` `applyOptions`:
   - Symbol tab → `priceSeries.applyOptions({ upColor, downColor, borderUpColor, ... , priceLineVisible, lastValueVisible })`.
   - Scales tab → `chart.priceScale('right').applyOptions({ mode, autoScale, invertScale })` (extend current `scaleMode` effect at `:240` to carry auto/lock/invert; add **Indexed-to-100** as a data transform since LWC lacks a native mode); `chart.applyOptions({ grid, crosshair: { mode, vertLine, horzLine } })`.
   - Appearance → `chart.applyOptions({ layout: { background, textColor, fontFamily }, ... })`; add a `watermark` plugin series.
   - Events/Timezone → store `timezone`; convert candle timestamps for display (the time axis formatter) and add session-break vertical lines on the drawing canvas (we already render forward-projected lines, e.g. `drawZoneLine`).
   - Status line → drive the existing `legend` render (`:222-227`, `:148`) from a `statusLineOpts` config.
2. **Crosshair style** — replace the hard-coded `crosshair: { mode: 0 }` with state; expose Cross/Dot/Arrow/Hidden + color in the Scales tab.
3. **Persist** all of it per-cell into workspace + layout `data` (10.2) and make it template-able (10.3).
4. **Open paths:** a gear button on the toolbar (top-right of chart area), right-click chart → "Settings…", and double-click the price scale → Scales tab.

---

### 10.5 Themes (dark / light / custom)

#### 10.5.1 Behavior

A theme is a complete color palette applied to chart background, grid, text, up/down candles, panels, borders, and accent. TV ships Dark and Light and lets you **customize and save** palettes. Theme switching must be instant and applied to every chart cell and every panel.

#### 10.5.2 Current status

**Two fixed palettes, working well.** `THEMES` (`:73-76`):

```js
const THEMES = {
  dark:  { bg:'#0e1117', grid:'#1c2230', text:'#9aa0b5', up:'#26a69a', down:'#ef5350', panel:'#0b0e14', border:'#1c2230' },
  light: { bg:'#ffffff', grid:'#eef1f6', text:'#3a3f50', up:'#089981', down:'#f23645', panel:'#f7f9fc', border:'#e3e8f0' },
};
```

`theme` defaults from workspace (`:126`), a Sun/Moon toggle flips it, and a dedicated effect re-applies layout/grid/scale colors (`:233-237`). Panels, toolbar, popovers all read `TH.panel`/`TH.border`. Persisted via `saveWS({...theme...})` (`:363`). **Gap:** `MiniChart.jsx:5` hard-codes the dark palette — it ignores `theme` (so light-mode minicells stay dark). No custom palette, no per-element color editing, no theme save.

#### 10.5.3 Implementation plan

1. **Custom palette object.** Add a third theme `custom` whose values come from a user-edited object stored in workspace (`bn_custom_theme`). The Appearance tab (10.4) edits each swatch (bg/grid/text/up/down/panel/border/accent); `TH = theme==='custom' ? customPalette : THEMES[theme]`.
2. **Fix MiniChart** to receive `theme`/`TH` as a prop (moot once cells are unified per 10.1.1, since the extracted `ChartCell` already reads the shared palette).
3. **Theme = part of style template** (10.3) and saved with layouts. Optionally support multiple named custom themes.
4. Keep switching instant: the single `[theme]` effect already re-applies; extend it to also restyle the price series colors (currently up/down are baked at series-build time in `buildPriceSeries`, `:249-262` — re-apply on theme change or rebuild).

---

### 10.6 Workspace persistence

#### 10.6.1 Behavior

The "scratch" desk must survive refresh/close *without an explicit save*. On return, the user finds the same symbol, interval, chart type, indicators, drawings, theme, and script — exactly where they left it.

#### 10.6.2 Current status

**Solid and one of our stronger areas.** A `localStorage` blob under `bn_workspace` (`:39-41`) is read by every relevant `useState` initializer (`loadWS()` at `:123-129,136-137`) and written on change:

- `saveWS({ symbol, tf, chartType, theme, overlays, subs })` (`:363`).
- Script code + applied-flag persisted (`:365-366`).
- Drawings auto-persisted from the drawing layer's `onChange` (`:207`) and restored 500 ms after chart build (`:209-210`).

So a refresh restores the full single-chart desk. **Gaps:** grid/cells/sync/scaleMode/magnet/showVP view-state are not in the blob; persistence is browser-local only (no per-account server sync of the scratch desk); no schema `version` for migration; a corrupt blob silently resets (the `try/catch` returns `{}`).

#### 10.6.3 Implementation plan

1. **Widen the blob** to include `grid/layoutId/cells/sync/splitters/scaleMode/magnet/showVP/activeCell` (aligns with 10.1/10.2 schema). Add a `version` field + migrator.
2. **Debounce writes** (the `_persistRef`/`persistLayoutDebounced` stubs at `:743-744` exist for exactly this) to avoid thrashing `localStorage` on every tick/drag.
3. **Optional server mirror** of the workspace keyed to the academy account so the scratch desk follows the user across devices (reuse the `bn_layouts` storage path with a reserved `__workspace__` name).
4. **Robustness:** on malformed blob, keep the safe `{}` fallback but log once; never throw into render.

---

### 10.7 Keyboard shortcuts (full keymap)

#### 10.7.1 Current status

Effectively **one** real binding plus editor-local keys. `CodeEditor.jsx:81` binds `Ctrl/Cmd+Enter` → run script; `CodeEditor.jsx:75-80` handles autocomplete navigation (↑/↓/Enter/Tab/Esc) and Tab-to-indent **inside the script textarea only**. On the main chart, the toolbar shows `Ctrl+Z` / `Ctrl+Y` *as tooltip labels* on the undo/redo buttons (`BazaarNama.jsx:856-857`) but **no global `keydown` listener is registered** — pressing those keys does nothing unless a button is clicked. There is no global hotkey layer for tools, timeframes, navigation, or chart actions. (Confirmed: no `addEventListener('keydown')` / global key handler exists in `BazaarNama.jsx`.)

#### 10.7.2 Implementation plan

Add **one global `keydown` listener** on `rootRef` (the chart root at `:181,782`), active only when the chart area has focus and **not** when a text input / the code editor is focused (guard `e.target.tagName in {INPUT, TEXTAREA, SELECT}` and `isContentEditable`). Dispatch via a single keymap table so bindings are declarative and remappable later. `preventDefault` only for keys we own. Tool shortcuts call `setTool(...)`; timeframe keys call `setTf(...)`; undo/redo call `drawRef.current.undo()/redo()` then `treeRefresh()`; navigation calls `chart.timeScale()` helpers. `Alt/Option+Click` on the chart drops a horizontal line at the clicked price (handle in the chart's click subscription, not the keymap).

#### 10.7.3 Full hotkey table

| Action | Windows / Linux | macOS | Notes / current status |
|---|---|---|---|
| **Drawing tools** | | | |
| Cursor (default) | `Esc` | `Esc` | also cancels in-progress drawing → `setTool('cursor')` |
| Trend line | `Alt+T` | `⌥T` | `setTool('trend')` |
| Horizontal line | `Alt+H` | `⌥H` | `setTool('hline')` |
| Vertical line | `Alt+V` | `⌥V` | `setTool('vline')` |
| Ray | `Alt+R` | `⌥R` | `setTool('ray')` |
| Rectangle | `Alt+E` | `⌥E` | `setTool('rect')` |
| Fib retracement | `Alt+F` | `⌥F` | `setTool('fib')` |
| Parallel channel | `Alt+P` | `⌥P` | `setTool('channel')` |
| Text | `Alt+X` | `⌥X` | `setTool('text')` |
| Long position | `Alt+L` | `⌥L` | `setTool('longshort')` |
| Quick horizontal line at cursor | `Alt+Click` | `⌥Click` | drop hline at clicked price |
| Magnet toggle | `Ctrl+Alt+M` | `⌃⌥M` | `setMagnet(v=>!v)` (state exists `:163`) |
| Stay-in-drawing-mode toggle | `Ctrl+Alt+D` | `⌃⌥D` | `setStayDraw(v=>!v)` (state exists `:175`) |
| **Edit** | | | |
| Undo | `Ctrl+Z` | `⌘Z` | wire to `drawRef.undo()` — **label-only today** |
| Redo | `Ctrl+Y` / `Ctrl+Shift+Z` | `⌘⇧Z` | wire to `drawRef.redo()` — **label-only today** |
| Delete selected object | `Delete` / `Backspace` | `⌫` | remove `selDraw` object (`:176`) |
| Clone selected object | `Ctrl+D` | `⌘D` | duplicate active drawing |
| Remove all drawings | `Ctrl+Alt+Backspace` | `⌘⌥⌫` | clear drawing layer |
| Clear chart studies/markers | `Ctrl+Alt+R` | `⌘⌥R` | maps to `clearScreen` (`:701`) |
| Lock / unlock selected | `Ctrl+L` | `⌘L` | toggle object lock |
| Hide / show all drawings | `Ctrl+Alt+H` | `⌘⌥H` | — |
| Select all objects | `Ctrl+A` | `⌘A` | — |
| **Timeframes** | | | |
| Type interval (digit + unit) | e.g. `1` `5` `H` `D` then `Enter` | same | quick-bar like TV: number buffer → unit (M/H/D/W) |
| Cycle to next timeframe | `,` | `,` | next in `TFS` (`:21`) |
| Cycle to previous timeframe | `.` | `.` | previous in `TFS` |
| 5-minute | `Shift+1` | `⇧1` | `setTf('M5')` |
| 15-minute | `Shift+2` | `⇧2` | `setTf('M15')` |
| 1-hour | `Shift+3` | `⇧3` | `setTf('H1')` |
| 4-hour | `Shift+4` | `⇧4` | `setTf('H4')` |
| Daily | `Shift+5` | `⇧5` | `setTf('D1')` |
| **Chart type** | | | |
| Candles | `Alt+1` | `⌥1` | `setChartType('candles')` |
| Bars (OHLC) | `Alt+2` | `⌥2` | `setChartType('bars')` |
| Line | `Alt+3` | `⌥3` | `setChartType('line')` |
| Area | `Alt+4` | `⌥4` | `setChartType('area')` |
| Heikin Ashi | `Alt+5` | `⌥5` | `setChartType('heikin')` |
| **Navigation / zoom** | | | |
| Scroll left / right | `←` / `→` | `←` / `→` | `timeScale().scrollToPosition(±n)` |
| Zoom in / out | `↑` / `↓` (or `+` / `-`) | same | adjust `barSpacing` |
| Scroll to most-recent (reset) | `End` | `End` | `scrollToRealTime()` |
| Scroll to oldest | `Home` | `Home` | trigger lazy-load + scroll |
| Fit / reset chart | `Alt+R` reserved → use `Ctrl+Alt+0` | `⌘⌥0` | `timeScale().fitContent()` (we call this at `:345`) |
| Reset price scale (auto) | `Ctrl+Alt+S` | `⌘⌥S` | `priceScale.applyOptions({autoScale:true})` |
| **Panels / view** | | | |
| Toggle right panel | `Ctrl+R` | `⌘R` | `setShowRight(v=>!v)` (state `:134`) |
| Toggle full-screen | `F` | `F` | element fullscreen on `rootRef` |
| Toggle theme (dark/light) | `Ctrl+Alt+T` | `⌘⌥T` | `setTheme(t=> t==='dark'?'light':'dark')` |
| Open indicators dialog | `/` | `/` | `setIndMenu(true)` (`:130`) |
| Open symbol search | `Ctrl+K` | `⌘K` | focus the symbol search input (`:788`) |
| Open settings dialog | `Ctrl+,` | `⌘,` | open `<SettingsDialog>` (10.4) |
| **Layout / multi-chart** | | | |
| Save layout | `Ctrl+S` | `⌘S` | `saveLayout` (`:745`) — must `preventDefault` |
| Cycle grid layout | `Ctrl+Alt+G` | `⌘⌥G` | open layout picker (10.1) |
| Focus next cell | `Tab` (chart focus) | `Tab` | advance `activeCell` (multi-chart) |
| **Trading / alerts** | | | |
| New alert at cursor price | `Alt+A` | `⌥A` | prefill alert form (`:157`) with crosshair price |
| Quick buy | `Shift+B` | `⇧B` | `quickTrade('buy')` (`:774`) |
| Quick sell | `Shift+S` | `⇧S` | `quickTrade('sell')` |
| **Bar Replay** | | | |
| Enter / exit replay | `Ctrl+Alt+P` | `⌘⌥P` | `enterReplay`/`exitReplay` (`:513,523`) |
| Replay play / pause | `Space` (replay on) | `Space` | toggle `replay.playing` (`:531`) |
| Replay step forward | `Shift+→` | `⇧→` | `replayStep` (`:524`) |
| **Script studio** | | | |
| Run script | `Ctrl+Enter` | `⌘↵` | **implemented** (`CodeEditor.jsx:81`) |
| Save script | `Ctrl+Shift+S` | `⌘⇧S` | `onSaveScript` (`:733`) |
| Autocomplete navigate | `↑`/`↓`/`Enter`/`Tab`/`Esc` | same | **implemented**, editor-local (`CodeEditor.jsx:75-80`) |
| Indent | `Tab` (in editor) | `Tab` | **implemented** (`CodeEditor.jsx:80`) |

**Notes on collisions:** `Ctrl+S`, `Ctrl+R`, `Ctrl+K`, `Ctrl+,`, `/` collide with browser defaults — these must `preventDefault()` and only fire when chart focus is held (never while typing in an input). The interval quick-bar (digit buffer) and single-letter tool keys must be suppressed whenever a text field or the code editor has focus, using the same focus-guard described in 10.7.2. A future "Settings → Keyboard" tab should let users remap this table (store overrides in workspace), since the dispatch is already a declarative keymap.

---

### 10.8 Build order (this chapter)

1. **Hotkey layer** (10.7) — cheapest, highest daily value; one listener + keymap, wires to existing setters. Fixes the "Ctrl+Z is a lie" gap immediately.
2. **`ChartCell` extraction + real grid + sync** (10.1) — the structural change everything else depends on.
3. **Settings dialog** (10.4) + **custom theme** (10.5) — most controls are thin `applyOptions` wrappers.
4. **Templates** (10.3) and **extended layout/workspace schema** (10.2, 10.6) — once cells are first-class, snapshotting them is straightforward.

Each step is independently shippable and degrades gracefully: until the grid is unified, hotkeys simply drive the single active chart, exactly as today.


---

## 11. Data, Performance, Mobile, Accessibility & Pro-Chart Deployment

This chapter specifies the foundations underneath the Pro-Chart product: where candle and tick data come from and how they flow to the client; how the renderer stays smooth as the dataset grows toward tens of thousands of candles; how the cache layer is configured so users never get stuck on a stale bundle; how the experience behaves on touch devices; how it serves assistive technology and keyboard users; how Right-to-Left Persian is handled; and finally a concrete, copy-pastable plan for shipping the new branded domain **Pro-Chart.ir** (server IP `91.107.160.235`). Every subsection is written as *current status → implementation plan* so the build team can pick up exactly where the codebase is today.

Pro-Chart is the standalone-branded incarnation of what is internally the **BazaarNama** ("بازارنما") charting workspace, implemented in `frontend/academy/src/pages/BazaarNama.jsx` plus the `frontend/academy/src/bazaarnama/` engine modules. The rendering engine is the open-source **lightweight-charts v5** library (TradingView's own MIT-licensed library — legal to use); none of TradingView's proprietary charting-library code is reproduced. This chapter does not change that boundary: everything below is *our* feature and infrastructure spec.

---

### 11.1 Data pipeline

#### 11.1.1 Historical candles — TimescaleDB

**Current status.** All historical OHLCV data lives in a single TimescaleDB `candles` hypertable (`PostgreSQL + TimescaleDB`, see `CLAUDE.md` architecture notes). The schema is `(symbol, timeframe, time, open, high, low, close, volume)`. The product reads candles through one server helper, `_chart_rows()` in `src/api/routes/academy.py`:

```python
async def _chart_rows(db, symbol, tf, limit=130, before=None):
    q = ("SELECT time,open,high,low,close,COALESCE(volume,0) FROM candles "
         "WHERE symbol=:s AND timeframe=:t "
         + ("AND time <= to_timestamp(:b) " if before else "")
         + "ORDER BY time DESC LIMIT :n")
    ...
```

The public endpoint `GET /academy/chart/{symbol}` (`chart_data`, `src/api/routes/academy.py:1521`) wraps it, clamping `limit` to `max(50, min(limit, 3000))` and accepting an optional `before` epoch cursor. The browser client calls it via `api.chart(symbol, tf, indicators, limit, before)` (`frontend/academy/src/api/client.js:99`). Symbols and the set of timeframes that actually have data are discovered dynamically through `GET /academy/chart/symbols` → `{ symbols, timeframes }` (`chart_symbols`, `academy.py:1499`), so the symbol dropdown reflects exactly what is loaded in the DB rather than a hardcoded list. A coverage probe (`academy.py:1277`) runs `SELECT symbol, timeframe, count(*) GROUP BY symbol, timeframe` so we can see which symbol/timeframe pairs are dense enough to chart.

This is the same `candles` hypertable that powers the signal engine, backtester (`CandleBuilder.get_candles`, `src/api/routes/backtest.py:339`) and academy lessons, so Pro-Chart shares one authoritative data source — there is no separate chart database to keep in sync.

**Implementation plan.**
- **Continuous aggregates.** Add TimescaleDB continuous aggregates (`CREATE MATERIALIZED VIEW ... WITH (timescaledb.continuous)`) for the heavier timeframes (D1/W1) keyed off the base M5/M15/H1 hypertable, refreshed on a `timescaledb` refresh policy. Today higher TFs are derived *client-side* (see §11.1.3); moving the heavy ones server-side reduces payload size and lets us serve W1/MN with correct lazy-load semantics.
- **Compression + retention.** Enable native columnar compression on chunks older than e.g. 30 days (`ALTER TABLE candles SET (timescaledb.compress, timescaledb.compress_segmentby = 'symbol,timeframe')`) and a compression policy. This is what makes 50k-candle history per symbol cheap to store while staying queryable for deep scroll-back.
- **Composite index.** Confirm a `(symbol, timeframe, time DESC)` index exists so both the "latest N" load and the `time <= before` lazy-load are single index range scans, not sorts.
- **Symbol whitelist for branding.** Pro-Chart is forex-focused (per the project's forex-only brand rule). The `chart_symbols` endpoint should accept an optional `category` filter so the branded build can present FX majors/minors/metals first, while the underlying table can still hold everything.

#### 11.1.2 Live prices — Redis

**Current status.** Real-time quotes are read from Redis, not the database. `GET /academy/bn/prices?symbols=...` (`live_prices`, `src/api/routes/bazaarnama.py:50`) pulls each symbol's last tick via `redis_client.get_price(s)`, derives `mid = (bid+ask)/2`, caps the request at 40 symbols, and returns:

```json
{ "prices": { "EURUSD": {"bid":..,"ask":..,"mid":..,"ts":..} },
  "market_open": true, "server_time": "..." }
```

Crucially, **an empty `prices` map means the market is closed** — `market_open` is literally `bool(out)`. This is consumed in `BazaarNama.jsx` by the poll loop (lines ~597-622) which fires every **700 ms** (`setInterval(poll, 700)`) for the active symbol plus the watchlist (or the full symbol set when the screener tab is open). The same data feed that publishes ticks to Redis for the trading engine is reused here, so chart prices match engine prices.

The client turns those discrete polls into a continuous tick feel: `applyTick()` sets an *easing target*, and a 60fps `requestAnimationFrame` loop (lines ~577-594) eases the displayed price toward the target (`e.display += (e.target - e.display) * 0.18`) plus a small bounded visual noise term, so the live candle ticks smoothly like a real terminal even though the network poll is coarse. The forming live candle and the blue `LIVE` price line (`#2962FF`) are updated by `applyMid()` (lines ~539-563), which also rolls a brand-new candle when the wall clock crosses a timeframe boundary.

**Implementation plan.**
- **Promote WebSocket push.** A WebSocket client already exists (lines ~633-643), gated behind `import.meta.env.VITE_BN_WS` and pointing at `/ws/prices`. It is dormant because that route is not proxied on the academy vhost. The plan: proxy `/ws/prices` (with `Upgrade`/`Connection` headers and `proxy_read_timeout`) and set `VITE_BN_WS=1` for the Pro-Chart build. Push replaces the 700ms poll for the focused symbol, cutting request volume and latency; the poll loop stays as the watchlist/screener fallback and as a graceful degrade when the socket drops.
- **Closed-market UX.** Keep `market_open=false` driving a clear "بازار بسته" badge; the easing/noise loop must freeze when the market is closed so we don't animate phantom ticks (today the loop only animates while a target exists).
- **Spread surfacing.** `bid/ask` are already returned but only `mid` is charted; expose the live spread in the legend for FX realism.

#### 11.1.3 Our five timeframes + aggregation

**Current status.** The DB realistically carries the dense set **M5, M15, H1, H4, D1** (the five the reference doc, section 12, marks as available). The client UI, however, offers nine buttons: `TFS = ['M5','M15','M30','H1','H2','H4','D1','W1','MN']` (`BazaarNama.jsx:21`). The extra four are **derived client-side** via `DERIVED_TF` (line 26):

```js
const DERIVED_TF = { M30:['M15',2], H2:['H1',2], W1:['D1',5], MN:['D1',22] };
```

`load()` (lines ~331-360) detects a derived TF, fetches the *base* TF with `limit = 800 * factor`, then collapses each group of `factor` candles into one with `resampleCandles()` (lines 28-36) — first-open, max-high, min-low, last-close, summed-volume. Timeframe-second lengths for live-bar construction and the close countdown live in `TF_SEC` (line 23). The candle-close countdown (lines ~384-389) ticks every second.

**Implementation plan.**
- **Lazy-load parity for derived TFs.** Aggregated TFs (and the time-independent chart types) currently *opt out* of scroll lazy-load (`loadMoreHistory` returns early when `DERIVED_TF[tf]`). Replacing M30/H2 with TimescaleDB continuous aggregates (§11.1.1) lets them lazy-load like base TFs. Keep client aggregation only for the cheapest cases.
- **Sub-hour / seconds TFs.** If a future M1 or seconds feed lands in `candles`, the `TFS`/`TF_SEC`/`DERIVED_TF` tables and the countdown already generalize; only the symbol-coverage probe gates exposure.

#### 11.1.4 What symbols

**Current status.** Symbols are not hardcoded — they come from `chart_symbols` (whatever exists in `candles`); the workspace default is `EURUSD` (`useState(() => loadWS().symbol || 'EURUSD')`). The watchlist is per-student (`GET/POST /academy/bn/watchlist`). Pricing covers up to 40 symbols per poll.

**Implementation plan.** For the Pro-Chart brand, curate a forex-first ordering (EURUSD, GBPUSD, USDJPY, XAUUSD, …) returned by a `category`-aware `chart_symbols`, and seed a sensible default watchlist for first-time visitors so the right panel is populated on first paint.

---

### 11.2 Performance

#### 11.2.1 Lazy-load older history on scroll — our status

**Current status: implemented (this contradicts the older "☐ 800-candle fixed" note in TRADINGVIEW_REFERENCE.md section 12, which is now stale).** The full path exists end to end:

- The chart subscribes to visible-range changes: `chart.timeScale().subscribeVisibleLogicalRangeChange((rng) => { dl.render(); if (rng && rng.from < 12 && loadMoreRef.current) loadMoreRef.current(); })` (line 221). When the user scrolls within 12 bars of the left edge, it triggers a fetch.
- `loadMoreHistory()` (lines ~312-328) guards against re-entrancy and exhaustion (`lazyRef = {loading, exhausted}`), skips non-standard/derived TFs, takes the oldest loaded candle's timestamp, and calls `api.chart(symbol, tf, '', 500, oldest - 1)` — i.e. **500 older candles before the cursor**. It prepends them (`older.concat(cs)`), re-applies overlays/sub-indicators/drawings against the merged array, and sets `exhausted` when the server returns nothing more.
- The server side honors this through the `before` epoch param in `_chart_rows`/`chart_data` (§11.1.1), clamped to ≤3000 per request.

So Pro-Chart already does infinite back-scroll on the base timeframes.

**Implementation plan.**
- **Page size + prefetch.** 500/page is fine; consider prefetching the next page when `rng.from < 30` (not just `<12`) so the join is invisible during fast flicks.
- **Re-indicator cost.** Each lazy page currently recomputes *all* overlays and sub-indicators over the whole merged array (`applyOverlays(merged); applySubs(merged)`). For large datasets, switch indicator calc to incremental/prepend-only updates so a back-scroll page is O(page) not O(total).
- **Cover derived TFs** once continuous aggregates exist (§11.1.3).

#### 11.2.2 Handling 50k+ candles smoothly

**Current status.** lightweight-charts is a canvas/WebGL-grade renderer that handles large series well; the live-update path already caps the in-memory live array (`if (cs.length > 2000) cs.shift()`, line 552) so the forming-candle loop never grows unbounded. But there is no explicit large-dataset strategy yet, and the per-page full indicator recompute (§11.2.1) is the main scaling risk.

**Implementation plan.**
- **Let the engine viewport-cull.** lightweight-charts only draws the visible logical range, so feeding 50k candles is acceptable for the *price* series; the cost is in *our* JS (indicators, drawing-layer canvas, Volume Profile). Budget those, not the candles.
- **Downsampling for zoomed-out views.** When the visible range spans more bars than horizontal pixels, serve/render a downsampled series (min/max-preserving bucketing so wicks aren't lost) and swap back to full resolution on zoom-in. Implement as a server option (`?reduce=` returning min/max-per-bucket) plus a client LOD switch keyed on `visibleLogicalRange` width vs. chart pixel width.
- **Cap working set.** Keep a sliding window (e.g. most-recent 20k) hydrated; older pages load on demand and can be evicted from the tail when memory pressure rises.
- **Drawing-layer throttle.** The `DrawingLayer` re-renders on every crosshair move and range change (`dl.render()` in the crosshair and range subscriptions). Coalesce these into a single `requestAnimationFrame` so heavy drawings don't multiply per event.

#### 11.2.3 Immutable hashed bundle + no-cache service-worker strategy (just fixed)

**Current status — fixed and important to preserve.** The cache strategy was deliberately rebuilt to end a class of "stuck on old version" bugs:

- **Service worker is now pass-through, no-cache.** `frontend/academy/public/sw.js` installs with `skipWaiting()`, on `activate` deletes *every* existing cache (`caches.keys()` → `caches.delete(k)`) and calls `clients.claim()`, and its `fetch` handler is pure network pass-through with only a trivial offline 504 fallback. The previous SW cached aggressively (and `sw.js` itself had been cached for ~a year), which is exactly how users got pinned to stale builds. PWA installability is preserved precisely *because* a `fetch` handler still exists.
- **nginx cache headers are tiered** (`frontend/academy/nginx.conf`): `sw.js` and `manifest.webmanifest` get `Cache-Control: no-cache, no-store, must-revalidate` + `expires off` (and the SW rule is placed *before* the generic `.js` rule so it wins, with `Service-Worker-Allowed: /`); `index.html` is likewise never cached; but **content-hashed assets** (`.js|.css|png|woff2|…`) get `expires 1y; Cache-Control: public, immutable`. Because Vite emits hashed filenames, a new deploy yields new URLs that bypass cache entirely while the SW + `no-cache index.html` guarantee the new `index.html` (and therefore the new hashed references) is fetched immediately.

The net invariant: **users always get the latest build on next navigation; static assets are still cached for a year via content-hash immutability.**

**Implementation plan.**
- **Carry these two files verbatim into Pro-Chart.** The standalone vhost (§11.5) must reproduce the exact `sw.js` + `manifest` no-cache rules and the immutable-hashed asset rule. Any deviation reintroduces the stale-version bug on the new domain.
- **Optional precache, never for HTML/SW.** If we later want true offline shell, precache only the hashed static assets (cache-first with versioned cache name + old-cache deletion on activate); keep `index.html`, `sw.js`, `manifest`, and all `/academy/**` API calls network-first/no-store. Document this so nobody "optimizes" HTML back into the cache.
- **Build hygiene.** Keep Vite's default hashed output; add a deploy check that `index.html` references only hashed asset names.

---

### 11.3 Mobile / touch

**Current status — basic responsive.** The shell adapts on width: the right panel defaults open only on wide screens (`useState(() => window.innerWidth > 760)`, `BazaarNama.jsx:134`) and can be toggled. lightweight-charts ships with native **pinch-zoom and one-finger pan** on touch, so the core chart is already usable on phones. Explicit resize handling exists (a `ResizeObserver` plus `applyOptions({width,height})`, lines ~212-220) so rotation/resize is correct. What's missing: a mobile-tuned toolbar, long-press context menu, and touch-friendly drawing-handle hit targets. This matches the reference doc's "◑ ریسپانسیوِ پایه".

**Implementation plan.**
- **Collapsible toolbars.** Convert the left drawing toolbar (12 tools) and the top toolbar into collapsible drawers under a breakpoint (~760px): a hamburger reveals tools; the timeframe/chart-type/indicator menus become bottom-sheets. Reuse the existing `showRight` pattern for a `showLeft`/`showTopMore` state.
- **Long-press context menu.** Add a pointer/touch handler: a >450ms press without movement opens a context menu (object actions on a drawing, or chart actions on empty space — add alert here, trade here, reset scale). Wire it through the existing `DrawingLayer` selection (`dl.onSelect`) so long-press on an object selects + offers edit/delete/style.
- **Bigger touch targets for drawing handles.** The drawing layer's selection handles must use a larger hit radius on coarse pointers (`matchMedia('(pointer: coarse)')`) so trendline endpoints are draggable with a fingertip.
- **Gesture polish.** Keep lightweight-charts pinch/pan; add double-tap-to-fit (`timeScale().fitContent()`), and ensure the drawing tools don't hijack the pan gesture when `tool === 'cursor'`.
- **Responsive panes.** Sub-indicator panes are fixed at 108px (`panes[pane].setHeight(108)`); make pane height responsive to viewport so oscillators remain readable on small screens.

---

### 11.4 Accessibility, RTL/Persian, PWA

#### 11.4.1 Accessibility (ARIA, keyboard nav)

**Current status — minimal.** Tooltips exist for tool icons (the `Tip` component, lines 94-103) but they are hover-only spans, not ARIA-labelled controls; keyboard support is limited (e.g. Ctrl+Enter to run a script). The reference doc marks ARIA as "☐". A canvas-based chart is inherently opaque to screen readers.

**Implementation plan.**
- **Label every control.** Add `aria-label` (Persian) + `role="button"`/`aria-pressed` to all toolbar icon buttons (tools, timeframe, chart type, theme, magnet, lock). The `Tip.label` strings are ready-made accessible names.
- **Keyboard navigation.** Make the toolbars a roving-tabindex group (arrow-key traversal, Enter/Space to activate). Global shortcuts: `Esc` to deselect/cancel a drawing, `Delete` to remove the selected object, `+/-` zoom, `[`/`]` change timeframe, `f` fit content.
- **Chart data alternative.** Expose an off-screen, `aria-live` "current price / O-H-L-C of hovered bar" region fed by the existing crosshair legend (`subscribeCrosshairMove`), giving screen-reader users the data the canvas can't convey. Provide a tabular "data view" toggle for the visible range.
- **Focus + contrast.** Visible focus rings; verify both themes meet WCAG AA contrast (the light theme text `#3a3f50` on `#fff` and brand blue `#2962FF` on white both need a check).

#### 11.4.2 RTL / Persian

**Current status — done.** This is a first-class strength. The UI is fully Persian, the chart font is `Vazirmatn` (set in `createChart({ layout: { fontFamily: 'Vazirmatn, sans-serif' }})`, line 193), and the PWA manifest declares `"lang": "fa", "dir": "rtl"`. All labels, the legend, signal boxes (هدف/حد ضرر/TP/SL), and menus are Persian. The reference doc marks RTL/Persian "✅".

**Implementation plan.** Keep it. The only nuance: the numeric price axis stays LTR (correct for numbers); ensure any new mobile drawers and context menus inherit `dir="rtl"` from the root so they open on the correct side. Pro-Chart branding (§11.5) keeps Persian copy.

#### 11.4.3 PWA installability

**Current status — installable.** `manifest.webmanifest` is complete: `display: standalone`, icons at 192/512 (incl. maskable), `theme_color`/`background_color` `#070b12`, app shortcuts to `/bazaarnama`, `/livechart`, `/`. The no-cache SW still registers a `fetch` handler, which satisfies the installability criterion without caching. nginx serves the manifest with the correct no-cache header.

**Implementation plan (for Pro-Chart brand).** Ship a *Pro-Chart-branded* manifest: `name: "Pro-Chart"`, `short_name: "Pro-Chart"`, brand icons, `theme_color: #2962FF` (the brand blue) or a dark brand background, `start_url: "/"`, and shortcuts that land directly on the chart. Keep `dir: rtl`, `lang: fa`. Because the branded build may live at the site root (not `/bazaarnama`), set `scope`/`start_url` to `/`.

---

### 11.5 Pro-Chart.ir deployment

This is the concrete plan to put the workspace on its own branded domain **Pro-Chart.ir**, served from the existing Hetzner server at **`91.107.160.235`**, alongside the current `academy.fx.trade-future.ir`.

#### 11.5.1 Standalone branded build vs. branded entry into academy chart

There are two viable shapes; we recommend **(B) for launch, with (A) as the follow-up.**

**(A) Standalone branded build (the destination).** A dedicated front-end app (clone the `frontend/academy` Vite app, or carve `BazaarNama.jsx` + `src/bazaarnama/*` into a `frontend/prochart` app) whose **default route is the chart**, with Pro-Chart branding (logo, name, `#2962FF`), its own `manifest.webmanifest`, and its own nginx container. Pros: clean brand, chart-first UX, independent deploy/scale. Cons: more build surface; must keep the chart engine in sync with academy (factor `src/bazaarnama/` into a shared package to avoid drift).

**(B) Branded entry to the existing academy chart (fastest).** Point `Pro-Chart.ir` at the *same* `academy_frontend` container, but land visitors directly on the chart with a branded skin. Concretely: serve the existing build, but have the app detect `window.location.hostname === 'pro-chart.ir'` and (a) redirect `/` → the chart, (b) swap logo/title/theme to the Pro-Chart brand, (c) load the Pro-Chart manifest. Pros: zero new build pipeline, instant launch, one codebase. Cons: shares the academy bundle (heavier), and brand is conditional rather than baked.

**Recommendation:** launch with (B) — a new vhost on the *same* `academy_frontend` upstream plus host-conditional branding — then graduate to (A) by extracting a `frontend/prochart` app and its own container once the brand proves out. The current academy compose service is tiny (`frontend-academy`, `mem_limit: 128M, cpus: 0.1`, `docker-compose.yml:459`), so a sibling `frontend-prochart` container is cheap when we get there.

#### 11.5.2 The nginx vhost (clone academy.conf)

**Current status.** The reverse proxy is `nginx/conf.d/*.conf` fronting per-app upstreams defined in `nginx/nginx.conf` (e.g. `upstream academy_frontend` at `nginx.conf:71`). The academy vhost `nginx/conf.d/academy.conf` already encodes the pattern we need: HTTP→HTTPS redirect with an ACME location, TLS, security headers, the SPA proxy to `academy_frontend`, an `/api/...` rewrite that strips the `/api` prefix and forwards to `api_backend` (with a stricter rate-limit zone on `auth`), and rate-limit zones (`general`/`api`/`auth`).

**Implementation plan — `nginx/conf.d/prochart.conf`** (clone of `academy.conf` with the server_name swapped and the same `academy_frontend` upstream for shape (B)):

```nginx
# Pro-Chart — pro-chart.ir
server {
    listen 80;
    server_name pro-chart.ir www.pro-chart.ir;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl;            # (academy uses 8443 internally; pro-chart fronts 443)
    http2 on;
    server_name pro-chart.ir www.pro-chart.ir;

    ssl_certificate     /etc/letsencrypt/live/pro-chart.ir/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pro-chart.ir/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        limit_req zone=general burst=60 nodelay;
        proxy_pass http://academy_frontend;        # shape (B); → prochart_frontend for (A)
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Live-price WebSocket — proxy this so VITE_BN_WS push works on Pro-Chart (§11.1.2)
    location /ws/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location ~ ^/api(/v1)?/user/auth/ {
        limit_req zone=auth burst=5 nodelay;
        rewrite ^/api(/v1)?/(.*)$ /$2 break;
        proxy_pass http://api_backend;
        proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location ~ ^/api(/v1)?/ {
        limit_req zone=api burst=50 nodelay;
        rewrite ^/api(/v1)?/(.*)$ /$2 break;
        proxy_pass http://api_backend;
        proxy_read_timeout 120s;
        proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Notes: (1) The academy vhost listens on `8443` internally; for a public root domain, Pro-Chart should front `443` directly (the host nginx must publish 443). (2) The cache-header behavior (sw.js/manifest no-cache, hashed-asset immutable) is produced by the **front-end container's** internal `nginx.conf` (`frontend/academy/nginx.conf`), so it is inherited automatically in shape (B); for shape (A) we must copy that file into `frontend/prochart`. (3) Adding `/ws/` here is what finally enables WebSocket push from §11.1.2.

#### 11.5.3 Let's Encrypt certificate

**Current status.** The stack already runs certbot with the webroot challenge (`location /.well-known/acme-challenge/ { root /var/www/certbot; }` in `academy.conf`) and stores certs under `/etc/letsencrypt/live/<domain>/`. Today academy *borrows* the `fx.trade-future.ir` cert (noted as a temporary name-mismatch in `academy.conf:19`).

**Implementation plan.**
1. Create DNS A records (see §11.5.4) for `pro-chart.ir` and `www.pro-chart.ir` → `91.107.160.235`.
2. Deploy `prochart.conf` with only the HTTP/ACME server block first (so port 80 answers the challenge), reload nginx.
3. Issue the cert via the existing certbot path (webroot `/var/www/certbot`):
   `certbot certonly --webroot -w /var/www/certbot -d pro-chart.ir -d www.pro-chart.ir`
   (run through the project's certbot-in-docker flow already used for the other domains).
4. Add the `ssl_certificate*` lines pointing at `/etc/letsencrypt/live/pro-chart.ir/`, reload nginx. Auto-renewal piggybacks on the existing certbot renew timer + nginx reload hook.

**Important Iran/Cloudflare interaction:** if Cloudflare is left in proxy ("orange-cloud") mode, the webroot HTTP-01 challenge can be intercepted; that is the second reason (besides §11.5.4) to keep Pro-Chart **DNS-only**. With DNS-only, Let's Encrypt validates directly against `91.107.160.235` and renewals are reliable.

#### 11.5.4 Cloudflare DNS-only recommendation (Iran audience)

**Recommendation: use Cloudflare for DNS management but keep the Pro-Chart records DNS-only (grey-cloud), not proxied.**

Rationale for an Iran-based audience:
- **Reachability.** Cloudflare's proxy edge has a history of being unreliable/blocked for Iranian visitors; proxying can make the site intermittently unreachable inside Iran. Serving the origin IP directly (`91.107.160.235`) is the most reliable path to Iranian users.
- **Sanctions/feature gaps.** Cloudflare restricts some features for Iranian traffic; relying on its proxy/WAF for this audience is fragile.
- **TLS simplicity.** DNS-only means our Let's Encrypt origin cert *is* the cert users see (no Cloudflare edge cert, no "Full/Flexible" mode pitfalls), and HTTP-01 renewals just work (§11.5.3).

So: A record `pro-chart.ir` → `91.107.160.235` (grey cloud), A record `www` → same (grey cloud). We still get Cloudflare's fast, free authoritative DNS. If DDoS protection is later required, evaluate it as a separate decision, knowing the proxy trade-off for Iranian reachability.

#### 11.5.5 Cross-origin auth / token strategy

**Current status.** BazaarNama lives behind academy auth — every `bn/*` route depends on `current_student` (scope `academy`), and the browser client talks to same-origin `/api/...` which nginx rewrites to `api_backend`. On the academy origin, the student token is carried by the existing client (`api/client.js`). Moving the chart to a *different* origin (`pro-chart.ir` vs `academy.fx.trade-future.ir`) makes this a cross-origin problem if cookies are involved.

**Implementation plan — keep auth same-origin per host; avoid cross-site cookies.**
- **Shape (B) is the cleanest:** because `pro-chart.ir` proxies the *same* `api_backend` under its *own* `/api/...` path, the browser sees Pro-Chart's API as **same-origin**. Use the existing bearer-token-in-`Authorization`-header scheme (token in `localStorage`/in-memory, sent by the client), not third-party cookies — this sidesteps `SameSite`/cross-site cookie blocking entirely. No CORS needed because the front-end and the API it calls share the `pro-chart.ir` origin via the proxy.
- **Login on Pro-Chart.** Reuse the academy student auth endpoints (already proxied as `^/api(/v1)?/user/auth/` with the strict `auth` rate-limit zone). A user logs in on `pro-chart.ir`; the issued token is stored for the `pro-chart.ir` origin and used as `Authorization: Bearer`.
- **Optional SSO from academy → Pro-Chart.** If we want one-click hop from the academy into Pro-Chart, implement a short-lived signed handoff token: academy generates a one-time token (server-signed, ~60s TTL), redirects to `https://pro-chart.ir/#sso=<token>`; Pro-Chart exchanges it at `/api/.../auth/exchange` for a normal student token. This avoids sharing cookies across registrable domains and works even though `pro-chart.ir` and `*.trade-future.ir` are unrelated origins.
- **CORS only if needed.** If shape (A) ever calls the API on a *different* host, add explicit `Access-Control-Allow-Origin: https://pro-chart.ir` + `Allow-Credentials` and use bearer tokens (never wildcard with credentials). Prefer the same-origin proxy approach to keep CORS out of the picture.
- **Guest/preview mode.** Consider a read-only guest view (chart + live prices, no per-user watchlist/scripts/AI quota) for unauthenticated `pro-chart.ir` visitors, so the brand has a usable public front door; gate `bn/*` write routes behind login as today.

#### 11.5.6 Branding (logo / name / colors `#2962FF`)

**Current status.** The app is branded "بازارنما / آکادمی کوین‌پرو FX" with `#070b12` dark theme; the brand blue `#2962FF` already appears in the chart (the `LIVE` price line color, `BazaarNama.jsx:562`). Logo asset is `src/assets/bn-logo.png`.

**Implementation plan.**
- **Name + logo.** Swap the workspace title/logo to **Pro-Chart** (Persian + Latin lockup). In shape (B), do this host-conditionally (`hostname === 'pro-chart.ir'`); in shape (A), bake it into the `frontend/prochart` build. Replace `bn-logo.png` with the Pro-Chart logo and the PWA/favicon icon set.
- **Color system.** Promote `#2962FF` to the primary brand accent across the branded build: primary buttons, active toolbar state, links, the live line (already `#2962FF`), and the PWA `theme_color`. Keep the candle up/down semantics (`#26a69a`/`#ef5350` dark, `#089981`/`#f23645` light) — those are data colors, not brand colors. Define a small brand token set (`--pc-primary:#2962FF`, hover/active shades, neutral dark `#070b12`) so the skin is centralized.
- **Theme default.** Ship dark theme as the Pro-Chart default (matches the existing `#070b12` background and the blue accent), with the existing light theme available via the theme toggle.
- **Meta / SEO.** Branded `<title>`, OG tags, and manifest `name`/`short_name` = "Pro-Chart"; Persian description emphasizing forex charting + AI signals, consistent with the forex-only brand rule.

---

### 11.6 Status summary for this chapter

| Area | Status | Headline next step |
|---|---|---|
| Candles (TimescaleDB) | ✅ live, shared `candles` hypertable | Continuous aggregates + compression for 50k history |
| Live prices (Redis) | ✅ 700ms poll, market-open flag, eased ticks | Enable `/ws/prices` WebSocket push |
| 5 TFs + client aggregation | ✅ M5–D1 real, M30/H2/W1/MN derived | Server-side aggregates → lazy-load parity |
| Symbols | ✅ dynamic from DB, forex-first | `category` filter for branded ordering |
| Lazy-load on scroll | ✅ implemented (500/page, `before` cursor) — ref doc note is stale | Incremental indicator recompute |
| 50k candles | ◑ engine culls; JS is the cost | Downsampling LOD + drawing-layer rAF coalesce |
| Cache (SW + nginx) | ✅ fixed: no-cache SW/HTML, immutable hashed assets | Carry verbatim into Pro-Chart vhost |
| Mobile / touch | ◑ basic responsive + native pinch/pan | Collapsible toolbars, long-press menu, coarse hit targets |
| Accessibility | ☐ minimal | ARIA labels, roving tabindex, live OHLC region |
| RTL / Persian | ✅ done | Inherit `dir=rtl` into new drawers/menus |
| PWA install | ✅ installable | Pro-Chart-branded manifest/icons |
| Pro-Chart.ir vhost | ☐ to build | Clone `academy.conf` → `prochart.conf` (shape B) |
| Let's Encrypt | ☐ to issue | webroot certbot for `pro-chart.ir` (DNS-only) |
| Cloudflare | — | DNS-only (grey-cloud) for Iran reachability |
| Cross-origin auth | ☐ to wire | Same-origin proxy + bearer token; optional SSO handoff |
| Branding `#2962FF` | ◑ blue already in live line | Name/logo/theme_color rollout |


---

<div align="center">

**Pro‑Chart** — ساخته می‌شود، فیچر‌به‌فیچر، تا هم‌ترازیِ کامل.

</div>
