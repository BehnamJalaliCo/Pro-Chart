[⬅ 10. The Telegram Bot — aiogram Delivery, Onboarding & Access](telegram-bot.md) · [🏠 Home · خانه](../README.md) · [12. The VIP Academy & BazaarNama (+ NamaScript) ➡](academy-bazaarnama.md)

---

## 11. The Web Front-Ends & Copy-Trading

CoinePro-FX ships **three independent React applications** plus the **copy-trading orchestration backend** that ties the VIP user panel to a real broker account. Each app is a self-contained Vite project with its own `package.json`, `Dockerfile`, Tailwind theme and routing tree, yet all three share a deliberate, opinionated stack and a set of conventions tuned for the Iranian market (RTL Persian UI, self-hosted fonts, no reliance on filtered CDNs, hash-chunk auto-recovery after deploys).

| App | Directory | Audience | Auth | Base API prefix |
|-----|-----------|----------|------|-----------------|
| **Public site** | `frontend/website/` | Anonymous visitors + VIP | Telegram login → `vip_token` | `/api` |
| **Admin console** | `frontend/admin/` | Operators / owner | Username+password → JWT access/refresh | `/api/v1` |
| **VIP user panel** | `frontend/user/` | Paying VIP traders | Telegram + e-mail OTP → `cp_user_token` | `/api` |
| **Copy-trading core** | `src/copy/` | (backend) | server-to-server | — |

---

### 11.1 The Shared Stack & Conventions

Every front-end is built on the same foundation, so a developer who knows one can move to another instantly.

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | **React 18** (`18.2`–`18.3`) | function components + hooks only |
| Bundler / dev server | **Vite 5/6** with `@vitejs/plugin-react` | `vite dev`, `vite build`, `vite preview` |
| Styling | **Tailwind CSS 3.4** + PostCSS + autoprefixer | per-app `tailwind.config.js` design tokens |
| Routing | **react-router-dom 6** | lazy routes + `<Suspense>` |
| Server state | **@tanstack/react-query 5** | polling via `refetchInterval` |
| Client state | **zustand 4/5** | auth/theme stores, some with `persist` |
| HTTP | **axios** | one `api/client.js` per app with interceptors |
| Charts | **recharts 2** | equity curves, win-rate, heatmaps, P&L |
| Animation | **framer-motion** (website only) | header/hero/section reveals |
| Icons | **react-icons** (website), **lucide-react** (admin + user) | tree-shaken |
| Forms | **react-hook-form** + **zod** (where used) | validated inputs |

**Self-hosted fonts, no filtered CDNs.** The Persian typeface **Vazirmatn** is bundled locally under `frontend/website/public/fonts/` (`Vazirmatn-Regular.woff2`, `-Bold`, `-Black`, `-ExtraBold`, `-SemiBold`, `-Medium`, `-Light`, `-ExtraLight`, `-Thin`, all `woff2`) and loaded by a local stylesheet, not from Google Fonts:

```html
<!-- frontend/website/index.html -->
<link rel="stylesheet" href="/fonts/vazirmatn.css" />
...
<body class="font-vazir bg-dark-950 text-white antialiased">
```

This matters in Iran where Google Fonts and many CDNs are filtered — a CDN font would simply fail to load, breaking the layout. Each app (`website`, `admin`, `user`) carries its own `public/fonts/` copy so it is fully self-contained.

**Hash-chunk auto-recovery.** Because Vite emits content-hashed JS chunks and old chunks are pruned on each deploy, a user holding a stale `index.html` would 404 on a dynamic import. Both the website and admin wrap their lazy imports in a guard that reloads the page exactly once (guarded by `sessionStorage`) so the fresh `index.html` and chunks load:

```js
// frontend/website/src/App.jsx
const lazyWithReload = (factory) =>
  lazy(() => factory().catch((err) => {
    if (!sessionStorage.getItem('chunk_reloaded')) {
      sessionStorage.setItem('chunk_reloaded', '1');
      window.location.reload();
      return new Promise(() => {}); // suspend until reload
    }
    throw err;
  }));
```

The admin uses the identical pattern keyed on `admin_chunk_reloaded`. On a successful mount the guard is cleared (`useEffect(() => sessionStorage.removeItem('chunk_reloaded'), [])`) so the *next* deploy also self-recovers.

**Axios interceptor pattern.** Each app stores its bearer token in `localStorage` and injects it on every request; on `401` it clears the token (website/user) or transparently refreshes (admin). Responses are normalised so components receive `response.data` directly.

---

### 11.2 The Public Website — `frontend/website/`

The public SEO site (`coinepro-forex-signals`) is the marketing and content surface at **fx.trade-future.ir**. It is anonymous-first with a VIP gate unlocked via Telegram login.

#### Routing map (`src/App.jsx`)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `HomePage` | hero, live stats, signal/feature showcase |
| `/academy` | `AcademyPage` | VIP academy promo |
| `/copy-trade` | `CopyTradePage` | copy-trading landing/sell page |
| `/signals` | `SignalsPage` | active + recent public signals |
| `/performance` | `PerformancePage` | equity curve, monthly, by-symbol, drawdown |
| `/backtest` | `BacktestPage` | interactive backtest simulator |
| `/live-prices` | `LivePricesPage` | real-time prices via WebSocket |
| `/live` | `LivePage` | WebRTC live-trading stream + chat |
| `/education` | `EducationPage` | 120 academy lessons (Article model) |
| `/news` | `NewsPage` | market news feed |
| `/analysis` | `AnalysisPage` | analysis articles |
| `/blog` | `BlogPage` | blog index |
| `/article/:slug` | `ArticlePage` | clean keyword-slug article page |
| `/tag/:tag` | `TagPage` | tag archive |
| `/broker` | `BrokerPage` | broker (OneRoyal) onboarding |
| `/about`, `/contact` | static pages | company info, contact form |
| `*` | `NotFoundPage` | soft-404-safe not-found |

All routes are lazy-loaded behind a global `<ErrorBoundary>` + `<Layout>` (`Header`/`Footer`). `Header.jsx` carries a full 15-item Persian nav (خانه، 🎓 آکادمی VIP، کپی‌ترید VIP، سیگنال‌ها، عملکرد، بک‌تست، قیمت لحظه‌ای، لایو ترید، اخبار، تحلیل، آموزش، بلاگ، بروکر، درباره ما، تماس) with scroll-aware backdrop blur and a mobile drawer that locks body scroll.

#### SEO engine — `hooks/useSeo.js`

Because the site is an SPA, every route must rewrite its document metadata so crawlers (which render JS) see the correct title/description/canonical. `useSeo` upserts `<title>`, `description`, the full Open Graph + Twitter card set, `canonical`, and (for `type === 'article'`) `article:published_time` / `article:modified_time`. It also injects a **JSON-LD** `<script type="application/ld+json">` per page and removes it on unmount:

```js
const SITE = 'کوین پرو FX';
const BASE = 'https://fx.trade-future.ir';
// upsertMeta(...) for og:*, twitter:*; upsertLink('canonical', url);
if (jsonLd) { script.type='application/ld+json'; script.textContent = JSON.stringify(jsonLd); }
```

This pairs with a server-side **dynamic `sitemap.xml`** (every published article auto-indexed) and `robots.txt` shipped in `public/`.

#### Privacy-respecting analytics — `utils/tracker.js`

On every route change `App.jsx` calls `trackPageview(location.pathname + location.search)`. The tracker assigns an anonymous persistent `visitor_id` (`localStorage` `cp_vid`) and per-tab `session_id` (`sessionStorage` `cp_sid`), derives referrer + UTM params, and ships the beacon with `navigator.sendBeacon`/`fetch keepalive` so navigation is never blocked. No personal data is collected; the server hashes IP. This feed powers the admin **Visitors** dashboard.

#### Live prices over WebSocket — `api/client.js` + `hooks/useWebSocket.js`

`createPriceSocket` opens `wss://…/ws/prices` (it forces `wss` on HTTPS pages to avoid mixed-content `SecurityError`s), auto-reconnects after 5 s, and never lets a constructor error crash the page. `LivePricesPage` consumes the stream; `PriceTickerBar` renders the scrolling ticker.

#### Public data surface (`api/client.js`)

| Module | Endpoints | Used by |
|--------|-----------|---------|
| `signalsAPI` | `/public/signals/active`, `/recent`, `/stats` | Signals page, home |
| `vipAuthAPI` | `/public/auth/config`, `/public/auth/telegram` | Telegram login gate |
| `backtestAPI` | `/public/backtest/simulate` | Backtest page |
| `pricesAPI` | `/public/prices/live`, `/prices/history/:sym` | Live prices |
| `performanceAPI` | `/performance/{summary,equity-curve,monthly,by-symbol,drawdown}` | Performance page (recharts) |
| `educationAPI` | `/articles`, `/articles/:slug`, `/articles/categories` | Education = 120 academy lessons |
| `liveAPI` | `/live/config`, `/live/auth/telegram` | WebRTC live page |
| `contactAPI` | `/contact` | Contact form |

VIP session is held in `vipSession` (helpers `get/save/clear/isVip`) reading `vip_token` + `vip_user`. The `VipGate` component blurs premium content for non-VIP visitors; `TelegramLogin` performs the Telegram-widget login. `eduAssetUrl()` rewrites server lesson-image paths (`/app/edu_assets/x.png`) into browser-loadable `/api/public/edu-asset/:name` URLs.

| Feature | Component / file |
|---------|------------------|
| Signal cards | `components/common/SignalCard.jsx` |
| Article feed | `components/common/ArticleFeed.jsx` |
| Live ticker bar | `components/common/PriceTickerBar.jsx` |
| VIP blur gate | `components/common/VipGate.jsx` |
| Telegram login | `components/common/TelegramLogin.jsx` |
| Loading skeletons | `components/common/LoadingSkeleton.jsx` |
| Error boundary / 404 | `components/common/ErrorBoundary.jsx`, `NotFoundPage.jsx` |
| Animated count-up | `hooks/useCountUp.js` + `react-countup` |
| Theme | `hooks/useTheme.js` (dark default) |

---

### 11.3 The Admin Console — `frontend/admin/`

`forex-signal-admin` is the operator cockpit. It is **fully gated**: every route except `/login` is wrapped in `<ProtectedRoute>` (redirect to `/login` when `!isAuthenticated`) inside a shared `<AdminLayout>` with `Sidebar`.

#### Auth: JWT access + transparent refresh (`api/client.js`)

The admin uses real JWTs persisted by zustand (`useAuthStore`, `persist` key `auth-storage`: `token`, `refreshToken`, `user`, `isAuthenticated`). The axios response interceptor implements a **single-flight refresh queue**: on `401`, the first request hits `POST /auth/refresh`, stores the new pair via `setTokens`, and replays itself; concurrent 401s queue and resume once the refresh resolves. If refresh fails, it logs out and hard-redirects to `/login`.

#### Navigation (`components/Layout/Sidebar.jsx`)

The sidebar is responsive (desktop collapse via `useThemeStore.sidebarCollapsed`, mobile slide-out drawer via `mobileDrawerOpen`), each item lucide-iconed:

| Route | Label | Page |
|-------|-------|------|
| `/dashboard` | داشبورد | `DashboardPage` — KPIs, signal chart, user growth, service status |
| `/signals` | سیگنال‌ها | `SignalsPage` — list/create/close/delete signals |
| `/backtest` | بک‌تست | `BacktestPage` — trigger runs, view trades |
| `/risk` | مدیریت ریسک | `RiskPage` — daily status, rejections, **kill-switch** lock/unlock |
| `/users` | کاربران | `UsersPage` — ban, plan, grant, message, roster export |
| `/performance` | عملکرد | `PerformancePage` — equity, win-rate, heatmap, metrics |
| `/reports` | گزارش‌های پیشرفته | `ReportsPage` — CAGR/Sharpe rolling, drawdown periods, benchmark |
| `/ml-models` | مدل‌های ML | `MLModelsPage` — retrain, feature importance, ensemble weights |
| `/monitoring` | مانیتورینگ | `MonitoringPage` — system/containers/data-feeds/logs |
| `/visitors` | بازدیدکنندگان | `VisitorsPage` — analytics overview/live/online |
| `/seo` | سئو و عملکرد | `SeoPage` — Search Console + PageSpeed dashboard |
| `/articles` | مقالات | `ArticlesPage` — article CMS CRUD |
| `/broadcasts` | پیام‌ها | `BroadcastsPage` — Telegram broadcasts |
| `/live` | لایو ترید | `LiveControlPage` — stream + chat moderation |
| `/auto-trade` | اتو ترید | `AutoTradePage` — EA config, master account, close-all |
| `/trade-history` | تاریخچهٔ سود/زیان | `TradeHistoryPage` — real P&L, CSV export |
| `/panel-users` | کاربران پنل | `PanelUsersPage` — VIP panel users + copy control |
| `/academy` | آکادمی VIP | `AcademyPage` — students, lessons, payments, community |
| `/ig-users` | کاربران IG | `IgUsersPage` — Instagram multi-tenant panel users |
| `/settings` | تنظیمات | `SettingsPage` — settings + API keys |

There is also a full `pages/instagram/` sub-tree (`Inbox`, `SmartReply`, `ContentPublish`, `CoverMaker`, `FormBuilder`, `StaticMenu`, `NewMessageModal`) for the Instagram automation module, surfaced through `InstagramPage.jsx`.

#### Key admin API groups (`api/client.js`)

| Group | Highlights |
|-------|-----------|
| `dashboardAPI` | stats, signal-chart, user-growth, services, active-signals |
| `signalsAPI` | CRUD + `close(id)` |
| `usersAPI` | `ban/unban`, `updatePlan`, `grant`, `sendMessage`, **`exportRoster`** (print/Excel), **`grantSignalAccess(days)`** |
| `riskAPI` | `getDailyStatus`, `getRejections`, `getPositions`, `getRegimes`, **`unlock()` / `manualLock(reason)`** (kill-switch) |
| `mlAPI` | `getModels`, `retrain`, `getFeatureImportance`, ensemble-weight get/set |
| `monitoringAPI` | system, containers, data-feeds, logs |
| `analyticsAPI` | overview, live, online |
| `seoAPI` | overview, actions resolve/dismiss, `runNow`, PageSpeed URL CRUD + history + test, Search Console queries/pages |
| `tradeHistoryAPI` | list, daily, stats, clear, `exportUrl(uid)` (CSV) |
| `articlesAPI` | full CRUD |
| `broadcastsAPI` | targets the complete `/broadcasts` router (stats/send/status/create) — note the comment that this avoids the incomplete `panel.py` version |
| `eaAPI` | EA `getConfig/setConfig`, `getStatus`, `closeAll`, master account get/set/logout |
| `panelUsersAPI` | approve/reject/remove/extend, `copyToggle`, `stop`, `closeAll`, `kyc` |
| `liveAPI` | start/stop/mode, chat-toggle, slowmode, pin, ban/mute, delete-message |
| `academyAPI` | students, lessons, payments approve/reject, community moderation |
| `igUsersAPI` / `instagramAPI` | IG multi-tenant users + full IG automation (auto-reply, forms, autopilot, AI caption/cover) |

#### Reusable component kit

`components/common/` provides a small but complete design system: `DataTable`, `StatCard`, `StatusBadge`, `Modal`, `ConfirmDialog` (+ `useConfirm` hook), `CommandPalette` (⌘K navigation), `SearchInput` (+ `useDebounce`), `Toast`, `Skeleton`, `EmptyState`. Pagination is centralised in `hooks/usePagination.js`, responsiveness in `hooks/useMediaQuery.js`. Notifications/toasts flow through `useNotificationStore` (`success`/`error` helpers). There is an i18n scaffold under `src/i18n/`.

---

### 11.4 The VIP User Panel — `frontend/user/`

`coinepro-user-panel` (at **user.fx**) is where a paying VIP links a real broker account and turns on copy-trading. It is the leanest stack (no framer-motion, no react-icons — just lucide + recharts).

#### Boot, auth gate & mandatory onboarding (`src/App.jsx`)

On mount it reads `cp_user_token` and calls `userAPI.me()`; the resulting `profile` drives a layered gate inside `<Protected>`:

1. **No token** → `/login`.
2. **Profile loading** → `<Spinner>`.
3. **`!profile.panel_allowed`** → `<VipGate state={profile.panel_state} />` (not yet approved / expired).
4. **Onboarding not complete** (`!email_verified || !disclaimer_accepted`) → forced redirect to `/onboarding`.
5. Otherwise render the page in `<Layout>`.

| Route | Page | Purpose |
|-------|------|---------|
| `/login` | `LoginPage` | Telegram login + e-mail OTP |
| `/onboarding` | `OnboardingPage` | verify e-mail OTP + accept disclaimer |
| `/` | `DashboardPage` | health gauge, performance, notifications |
| `/copy` | `CopyTradePage` | the copy-trade engine UI |
| `/history` | `HistoryPage` | real P&L history |
| `/account` | `AccountPage` | KYC + broker linking |
| `/profile` | `ProfilePage` | subscription, profile |

Auth is held in a tiny zustand store (`useAuth`: `profile`, `login`, `logout`); theme (dark default, persisted `cp_theme`) toggles a `light` class on `<html>`.

#### Login & onboarding (`api/client.js`)

`userAPI` exposes `loginTelegram`, `loginWebApp(init_data)` (Telegram WebApp), and the **e-mail OTP** pair `requestOtp(email)` / `verifyOtp(email, code)`. Onboarding then calls `getDisclaimer()` and `acceptDisclaimer(version, full_name)` — onboarding is *mandatory* before any panel access.

#### Account linking & KYC (`pages/AccountPage.jsx`)

The user submits broker credentials via `linkAccount({ broker, server, login, password })` and can `unlinkAccount()`. A broker-policy banner enforces the business rule:

> Free plan → **only OneRoyal** is allowed; paid subscribers → any broker.

`submitKyc(payload)` handles identity verification; account status (`connected` / `pending` / `error`) is shown with a `StatusLight`. The page never stores credentials client-side beyond the submit.

#### The copy-trade engine UI (`pages/CopyTradePage.jsx`)

This is the centrepiece. It polls `copyStatus()` every 8 s and loads `getCopyConfig()`, then exposes:

- **Master on/off switch** with a colour-coded status card: green = running, amber = on-but-waiting-for-account, red = off / no account. Title strings: «کپی‌ترید روشن — در حال اجرا», «… منتظرِ اتصالِ حساب», «کپی‌ترید خاموش است», «حسابی متصل نیست».
- **Emergency kill-switch panel** — two big buttons wired to `copyStop()` (disable copy, leave open positions untouched) and `copyCloseAll()` (send a close-all command for *all* the user's open positions), each behind a confirm dialog.
- **Risk-sizing model selector** — three modes that map 1:1 onto the backend `size_for_user()`:

| Mode (`risk_mode`) | UI label | Sizing |
|--------------------|----------|--------|
| `proportional` | متناسب با موجودی | `master.lots × risk_value` |
| `risk_percent` | درصدِ ریسک | fixed % of equity per trade |
| `fixed_lot` | لاتِ ثابت | constant lots |

- **Sliders** for `risk_value`, `max_lot`, `max_open_trades`, and `max_daily_loss_pct` (0 = disabled), plus a `copy_sl_tp` checkbox to mirror the master's SL/TP.
- **`RiskSimulator`** component to preview outcomes, and a `Guide` accordion explaining the engine in plain Persian.

`setCopyConfig(next)` persists the whole form; `save({ enabled: !form.enabled })` toggles copy.

#### Dashboard widgets & supporting components

| Component | Role |
|-----------|------|
| `PerformanceSection.jsx` / `PnlHistory.jsx` | real MT5-deal P&L: net (commission/swap), win-rate, profit factor, max-drawdown, recharts equity curve; ranges 7/30/90 days |
| `NotificationsBell.jsx` | unread badge via `notifications()` / `markNotificationsRead()` |
| `OnboardingChecklist.jsx` | guided setup progress |
| `SubscriptionStrip.jsx` | plan/expiry from `subscription()` |
| `AiAssistant.jsx` | market-scoped AI chat via `aiChat(message)` (Haiku, VIP-quota) |
| `EconomicCalendar.jsx` | `economicCalendar()` events |
| `RiskSimulator.jsx` | what-if position sizing |
| `Guide.jsx` | contextual help accordions |
| `ui.jsx` | shared `Spinner`, `StatusLight`, `Stat`, buttons |

The `PnlHistory` component is explicitly the **real deal-level** P&L (close reasons mapped: `sl`→حد ضرر, `tp`→حد سود, `breakeven`→سربه‌سر, `manual`→دستی, `stopout`→استاپ‌اوت), distinct from the public strategy performance.

---

### 11.5 The Copy-Trading Backend — `src/copy/`

The panel UI is only the steering wheel; the engine lives in `src/copy/` (`engine.py`, `tasks.py`, `hetzner.py`, `__init__.py`). Its job: **mirror the master account's live trades onto each VIP's real broker account**, all under the project's own server infrastructure (no separate terminal per user).

#### Design (`engine.py`)

- **Master = the project's own server account** (admin auto-trade). Its open positions are read from Redis `ea:status` — the exact feed the MT5 Expert Advisor (EA) writes — via `read_master_positions()`, which parses the `positions` string into `MasterPosition(symbol, direction, lots, profit)` records.
- For each `TradingAccount` with a linked account **and** `CopySettings.enabled`, the master's open trades are mirrored, with **size determined by the user's risk model** (`size_for_user`, clamped to `max_lot`).
- Execution goes through a **swappable `Executor` Protocol**:
  - **`PaperExecutor`** (default, safe): places **no real orders**. It marks the account `connected`, seeds a display balance/equity, and writes the mirrored positions to Redis `copy:user:{user_id}:positions` (TTL 120 s) so the panel shows the full flow risk-free.
  - **`LiveMT5Executor`** (live path): connects to the user's MT5 account and actually places orders — selected by `get_executor()` once the per-account connection layer is enabled.

```python
def size_for_user(master, cs, equity):
    if cs.risk_mode == "fixed_lot":      lot = cs.risk_value
    elif cs.risk_mode == "proportional": lot = master.lots * cs.risk_value
    elif cs.risk_mode == "risk_percent": lot = max(equity/10000, 0.01) * cs.risk_value
    return round(max(min(lot, cs.max_lot), 0.0), 2)
```

`sync_once(db)` runs one reconciliation pass over every account in (`pending`,`connected`,`error`): it loads/creates `CopySettings`, calls the executor, and records `mirrored` counts (errors flip the account to `status="error"` with `last_error`).

#### Safety: the no-reopen & close-all guarantees

Two correctness properties are baked in:

1. **`enabled` is the open-gate.** A user who turns copy off opens *no new* positions — the engine only mirrors when `cs.enabled` is true.
2. **No-reopen / close-all.** Because the user mirrors the master, when the master is flat the user is flat. Independently, the EA-status route (`src/api/routes/ea.py`) implements **per-account server-side dismissal**: when a position the user/admin manually closed (or close-all closed) is detected gone while the signal is still active, its `signal_id` is added to a Redis `ea:dismissed:{uid}` set (7-day TTL) and stripped from future EA pulls — `_detect_dismissed_atomic()` does this atomically inside the same request to defeat re-open races, so a closed position is **never reopened** from any device.

Trailing-stop execution is likewise threaded through: the per-user EA payload carries `trail_sl` (the latched trailing SL) as a field so trailing actually executes on real accounts.

#### Scheduling & horizontal scale-out (`tasks.py`)

Two Celery tasks drive the engine:

- **`copy_sync`** (every minute) — opens a `NullPool` async session and runs `sync_once`. It uses a fresh event loop per task to stay safe inside Celery workers.
- **`scale_servers`** — auto-provisions the Windows/MT5 copy servers on Hetzner when live copy is enabled:
  - **(0) failure recovery:** servers whose `last_seen_at` heartbeat is older than 180 s are marked `down`, their users freed (`server_id=None`) and reassigned to healthy servers via `_assign_unassigned`.
  - **demand → capacity:** `needed = ceil(active_copy_users / COPY_USERS_PER_SERVER)`.
  - **scale-out:** missing `coinepro-copy-<n>` servers are created from a Windows snapshot; each boots and self-registers its IP, and overflow users auto-assign to it.
  - **reconcile + safe scale-in:** orphan DB rows (Hetzner server gone) are cleaned; surplus *empty* managed servers are deleted.

#### Hetzner provisioning & the deletion guard (`hetzner.py`)

`hetzner.py` wraps the Hetzner Cloud API. Scaling is **vertical first** (a `RESIZE_LADDER` of `cx33 → cx43 → cx53`, i.e. 8→16→32 GB) then horizontal (new server from `HETZNER_SNAPSHOT_ID`). The standout safety feature is a hard **deletion guard** against ever deleting the wrong server (an explicit lesson from a past incident):

```python
_DELETABLE_NAME = re.compile(r"^coinepro-copy-\d+$")  # only these are auto-deletable
PROTECTED_NAMES = {"CoinePro-FX", "coinepro-win-base", "TraydeYar-Bot"}
PROTECTED_IDS   = {133765432, 138385055, 138390751}
```

Only servers whose name exactly matches `coinepro-copy-<number>` can be auto-deleted; the base server, the bot server and named/ID-listed servers are protected unconditionally. Servers that still have assigned users are never deleted (they require draining first).

#### End-to-end flow

```
EA (MT5, master) ──writes──▶ Redis ea:status
                                  │
              copy_sync (Celery, 1/min) reads master positions
                                  │
        for each enabled user: size_for_user() → Executor
                                  │
        Paper:  Redis copy:user:{uid}:positions (panel view)
        Live :  order on user's MT5 (via Windows copy server)
                                  │
 user panel  ◀── copyStatus()/copy-config ──▶  /copy UI (8s poll)
 kill-switch ──▶ copyStop()/copyCloseAll() ──▶ server-side dismissal (no-reopen)
 scale_servers (Celery) ──▶ Hetzner: heartbeat recovery + scale-out/in (guarded)
```

This is what makes CoinePro-FX's copy-trading both **safe by default** (paper executor, kill-switches, no-reopen, protected infrastructure) and **horizontally scalable** (per-server user capacity with automatic Hetzner provisioning) — the React user panel simply exposes the controls, while `src/copy/` does the real mirroring.

---
---

## ۱۱. اپلیکیشن‌های وب و کپی‌تریدینگ

CoinePro-FX سه **اپلیکیشن مستقلِ React** و همچنین **بک‌اندِ هماهنگ‌سازیِ کپی‌ترید** را عرضه می‌کند که پنلِ کاربریِ VIP را به یک حسابِ واقعیِ بروکر متصل می‌کند. هر اپ یک پروژهٔ Vite کاملاً مستقل با `package.json`، `Dockerfile`، تمِ Tailwind و درختِ مسیریابیِ خودش است؛ با این حال هر سه یک پشتهٔ فناوریِ مشترک و مجموعه‌ای از قراردادهای تنظیم‌شده برای بازارِ ایران دارند (رابطِ فارسیِ راست‌به‌چپ، فونتِ خودمیزبان، عدم اتکا به CDNهای فیلترشده، و بازیابیِ خودکارِ چانک‌های هش‌دار پس از هر دیپلوی).

| اپلیکیشن | پوشه | مخاطب | احراز هویت | پیشوندِ API |
|-----|-----------|----------|------|-----------------|
| **سایتِ عمومی** | `frontend/website/` | بازدیدکنندهٔ ناشناس + VIP | ورود با تلگرام → `vip_token` | `/api` |
| **پنلِ ادمین** | `frontend/admin/` | اپراتور/مالک | نام‌کاربری+رمز → JWT (access/refresh) | `/api/v1` |
| **پنلِ کاربریِ VIP** | `frontend/user/` | تریدرِ VIPِ پرداخت‌کننده | تلگرام + OTPِ ایمیل → `cp_user_token` | `/api` |
| **هستهٔ کپی‌ترید** | `src/copy/` | (بک‌اند) | سرور-به-سرور | — |

---

### ۱۱.۱ پشتهٔ مشترک و قراردادها

هر فرانت‌اند روی یک پایهٔ یکسان ساخته شده، پس توسعه‌دهنده‌ای که با یکی آشناست، فوراً می‌تواند به دیگری برود.

| موضوع | انتخاب | توضیح |
|---------|--------|-------|
| فریم‌ورک | **React 18** | فقط کامپوننتِ تابعی + هوک |
| باندلر/سرورِ توسعه | **Vite 5/6** + `@vitejs/plugin-react` | `dev`/`build`/`preview` |
| استایل | **Tailwind CSS 3.4** + PostCSS + autoprefixer | توکن‌های طراحیِ مجزا برای هر اپ |
| مسیریابی | **react-router-dom 6** | مسیرهای lazy + `<Suspense>` |
| وضعیتِ سرور | **@tanstack/react-query 5** | پولینگ با `refetchInterval` |
| وضعیتِ کلاینت | **zustand 4/5** | استورهای auth/theme، برخی با `persist` |
| HTTP | **axios** | یک `api/client.js` با interceptor برای هر اپ |
| نمودار | **recharts 2** | منحنیِ سرمایه، نرخِ برد، هیت‌مپ، سود/زیان |
| انیمیشن | **framer-motion** (فقط سایت) | نمایشِ هدر/هیرو/سکشن |
| آیکون | **react-icons** (سایت)، **lucide-react** (ادمین+کاربر) | tree-shake شده |
| فرم | **react-hook-form** + **zod** | ورودی‌های اعتبارسنجی‌شده |

**فونتِ خودمیزبان، بدونِ CDNهای فیلترشده.** فونتِ فارسیِ **Vazirmatn** به‌صورتِ محلی در `frontend/website/public/fonts/` قرار گرفته (تمامِ وزن‌ها در قالبِ `woff2`: Regular، Bold، Black، ExtraBold، SemiBold، Medium، Light، ExtraLight، Thin) و از یک استایل‌شیتِ محلی بارگذاری می‌شود، نه از Google Fonts:

```html
<!-- frontend/website/index.html -->
<link rel="stylesheet" href="/fonts/vazirmatn.css" />
...
<body class="font-vazir bg-dark-950 text-white antialiased">
```

این موضوع در ایران حیاتی است؛ جایی که Google Fonts و بسیاری از CDNها فیلتر هستند — فونتِ CDN به‌سادگی بارگذاری نمی‌شود و چیدمان به‌هم می‌ریزد. هر اپ (`website`، `admin`، `user`) نسخهٔ `public/fonts/` خودش را دارد تا کاملاً مستقل باشد.

**بازیابیِ خودکارِ چانکِ هش‌دار.** چون Vite چانک‌های JSِ هش‌دار تولید می‌کند و چانک‌های قدیمی در هر دیپلوی پاک می‌شوند، کاربری که `index.html`ِ کهنه دارد، روی importِ داینامیک ۴۰۴ می‌گیرد. سایت و ادمین importهای lazy را در گاردی می‌پیچند که صفحه را دقیقاً یک‌بار ریلود می‌کند (با گاردِ `sessionStorage`) تا نسخهٔ تازه بارگذاری شود:

```js
// frontend/website/src/App.jsx
const lazyWithReload = (factory) =>
  lazy(() => factory().catch((err) => {
    if (!sessionStorage.getItem('chunk_reloaded')) {
      sessionStorage.setItem('chunk_reloaded', '1');
      window.location.reload();
      return new Promise(() => {}); // معلق تا ریلود
    }
    throw err;
  }));
```

ادمین همین الگو را با کلیدِ `admin_chunk_reloaded` به‌کار می‌برد. پس از سوارشدنِ موفق، گارد پاک می‌شود تا دیپلویِ بعدی هم خودکار ریکاور شود.

**الگوی interceptorِ axios.** هر اپ توکنِ خود را در `localStorage` نگه می‌دارد و در هر درخواست تزریق می‌کند؛ روی `401` توکن را پاک می‌کند (سایت/کاربر) یا به‌صورت شفاف refresh می‌کند (ادمین). پاسخ‌ها نرمال می‌شوند تا کامپوننت‌ها مستقیماً `response.data` بگیرند.

---

### ۱۱.۲ سایتِ عمومی — `frontend/website/`

سایتِ سئوییِ عمومی (`coinepro-forex-signals`) سطحِ بازاریابی و محتوا در **fx.trade-future.ir** است. ناشناس-محور است با گیتِ VIP که با ورودِ تلگرام باز می‌شود.

#### نقشهٔ مسیرها (`src/App.jsx`)

| مسیر | صفحه | هدف |
|-------|------|---------|
| `/` | `HomePage` | هیرو، آمارِ زنده، نمایشِ سیگنال/امکانات |
| `/academy` | `AcademyPage` | معرفیِ آکادمیِ VIP |
| `/copy-trade` | `CopyTradePage` | صفحهٔ فروشِ کپی‌ترید |
| `/signals` | `SignalsPage` | سیگنال‌های فعال + اخیرِ عمومی |
| `/performance` | `PerformancePage` | منحنیِ سرمایه، ماهانه، بر اساسِ نماد، افت |
| `/backtest` | `BacktestPage` | شبیه‌سازِ بک‌تستِ تعاملی |
| `/live-prices` | `LivePricesPage` | قیمتِ لحظه‌ای با WebSocket |
| `/live` | `LivePage` | پخشِ زندهٔ ترید با WebRTC + چت |
| `/education` | `EducationPage` | ۱۲۰ درسِ آکادمی (مدلِ Article) |
| `/news` | `NewsPage` | فیدِ اخبارِ بازار |
| `/analysis` | `AnalysisPage` | مقالاتِ تحلیلی |
| `/blog` | `BlogPage` | فهرستِ بلاگ |
| `/article/:slug` | `ArticlePage` | صفحهٔ مقاله با اسلاگِ کلیدواژه‌ای |
| `/tag/:tag` | `TagPage` | آرشیوِ تگ |
| `/broker` | `BrokerPage` | معرفیِ بروکر (OneRoyal) |
| `/about`، `/contact` | صفحاتِ ثابت | دربارهٔ ما، فرمِ تماس |
| `*` | `NotFoundPage` | صفحهٔ نیافتنِ ایمن از نظرِ soft-404 |

تمامِ مسیرها lazy هستند و درون `<ErrorBoundary>` + `<Layout>` قرار می‌گیرند. `Header.jsx` یک نوار ناوبریِ کاملِ ۱۵-آیتمیِ فارسی دارد با بک‌دراپ‌بلورِ آگاه از اسکرول و draweerِ موبایل که اسکرولِ بدنه را قفل می‌کند.

#### موتورِ سئو — `hooks/useSeo.js`

چون سایت SPA است، هر مسیر باید متادیتای سندِ خود را بازنویسی کند تا کراولرها (که JS را رندر می‌کنند) عنوان/توضیح/canonicalِ درست را ببینند. `useSeo` تگ‌های `<title>`، `description`، مجموعهٔ کاملِ Open Graph + Twitter، `canonical` و (برای `type === 'article'`) `article:published_time`/`article:modified_time` را upsert می‌کند و یک **JSON-LD** برای هر صفحه تزریق و در unmount حذف می‌کند:

```js
const SITE = 'کوین پرو FX';
const BASE = 'https://fx.trade-future.ir';
if (jsonLd) { script.type='application/ld+json'; script.textContent = JSON.stringify(jsonLd); }
```

این با **`sitemap.xml`ِ پویای** سمتِ سرور (هر مقالهٔ منتشرشده خودکار ایندکس می‌شود) و `robots.txt`ِ موجود در `public/` جفت می‌شود.

#### آنالیتیکسِ حریم‌خصوصی-محور — `utils/tracker.js`

در هر تغییرِ مسیر، `App.jsx` تابعِ `trackPageview(...)` را صدا می‌زند. tracker یک `visitor_id`ِ ناشناسِ ماندگار (`localStorage` `cp_vid`) و `session_id`ِ هر-تب (`sessionStorage` `cp_sid`) می‌سازد، referrer و پارامترهای UTM را استخراج می‌کند و بیکن را با `navigator.sendBeacon`/`fetch keepalive` می‌فرستد تا ناوبری کند نشود. هیچ دادهٔ شخصی جمع نمی‌شود؛ IP فقط سمتِ سرور و هش‌شده ذخیره می‌شود. این فید، داشبوردِ **بازدیدکنندگانِ** ادمین را تغذیه می‌کند.

#### قیمتِ زنده روی WebSocket — `api/client.js`

`createPriceSocket` اتصالِ `wss://…/ws/prices` را باز می‌کند (روی صفحهٔ HTTPS اجباراً `wss` تا از خطای mixed-content جلوگیری شود)، بعد از ۵ ثانیه خودکار reconnect می‌کند و هرگز نمی‌گذارد خطای سازنده صفحه را کرش کند. `LivePricesPage` استریم را مصرف می‌کند و `PriceTickerBar` نوارِ روان را رندر می‌کند.

#### سطحِ دادهٔ عمومی (`api/client.js`)

| ماژول | اندپوینت‌ها | مصرف‌کننده |
|--------|-----------|---------|
| `signalsAPI` | `/public/signals/active`, `/recent`, `/stats` | صفحهٔ سیگنال، خانه |
| `vipAuthAPI` | `/public/auth/config`, `/public/auth/telegram` | گیتِ ورودِ تلگرام |
| `backtestAPI` | `/public/backtest/simulate` | صفحهٔ بک‌تست |
| `pricesAPI` | `/public/prices/live`, `/prices/history/:sym` | قیمتِ زنده |
| `performanceAPI` | `/performance/{summary,equity-curve,monthly,by-symbol,drawdown}` | صفحهٔ عملکرد |
| `educationAPI` | `/articles`, `/articles/:slug`, `/articles/categories` | آموزش = ۱۲۰ درسِ آکادمی |
| `liveAPI` | `/live/config`, `/live/auth/telegram` | صفحهٔ زندهٔ WebRTC |
| `contactAPI` | `/contact` | فرمِ تماس |

نشستِ VIP در `vipSession` نگه‌داری می‌شود (توابعِ `get/save/clear/isVip`) که `vip_token` + `vip_user` را می‌خواند. کامپوننتِ `VipGate` محتوای پولی را برای ناشناس‌ها بلور می‌کند؛ `TelegramLogin` ورودِ ویجتِ تلگرام را انجام می‌دهد. `eduAssetUrl()` مسیرِ سرورِ تصویرِ درس (`/app/edu_assets/x.png`) را به URLِ قابل‌بارگذاری `/api/public/edu-asset/:name` تبدیل می‌کند.

| امکان | کامپوننت / فایل |
|---------|------------------|
| کارتِ سیگنال | `components/common/SignalCard.jsx` |
| فیدِ مقاله | `components/common/ArticleFeed.jsx` |
| نوارِ تیکرِ زنده | `components/common/PriceTickerBar.jsx` |
| گیتِ بلورِ VIP | `components/common/VipGate.jsx` |
| ورودِ تلگرام | `components/common/TelegramLogin.jsx` |
| اسکلتِ بارگذاری | `components/common/LoadingSkeleton.jsx` |
| مرزِ خطا / ۴۰۴ | `ErrorBoundary.jsx`، `NotFoundPage.jsx` |
| شمارشِ انیمیشنی | `hooks/useCountUp.js` + `react-countup` |
| تم | `hooks/useTheme.js` (تاریکِ پیش‌فرض) |

---

### ۱۱.۳ پنلِ ادمین — `frontend/admin/`

`forex-signal-admin` کابینِ خلبانِ اپراتور است. کاملاً گیت‌شده است: هر مسیر به‌جز `/login` درونِ `<ProtectedRoute>` (ریدایرکت به `/login` وقتی `!isAuthenticated`) و `<AdminLayout>` با `Sidebar` قرار می‌گیرد.

#### احراز: JWT با refreshِ شفاف (`api/client.js`)

ادمین از JWTِ واقعی استفاده می‌کند که zustand آن را persist می‌کند (`useAuthStore`، کلیدِ `auth-storage`). interceptorِ پاسخ یک **صفِ refreshِ تک‌جریانه** پیاده می‌کند: در `401`، اولین درخواست به `POST /auth/refresh` می‌رود، جفتِ تازه را با `setTokens` ذخیره و خودش را replay می‌کند؛ ۴۰۱های هم‌زمان در صف می‌مانند و پس از حلِ refresh ادامه می‌یابند. اگر refresh شکست بخورد، logout و ریدایرکتِ سختِ `/login`.

#### ناوبری (`components/Layout/Sidebar.jsx`)

سایدبار واکنش‌گراست (جمع‌شدنِ دسکتاپ با `sidebarCollapsed`، drawerِ موبایل با `mobileDrawerOpen`)، هر آیتم با آیکونِ lucide:

| مسیر | برچسب | صفحه |
|-------|-------|------|
| `/dashboard` | داشبورد | KPIها، نمودارِ سیگنال، رشدِ کاربر، وضعیتِ سرویس |
| `/signals` | سیگنال‌ها | فهرست/ساخت/بستن/حذف |
| `/backtest` | بک‌تست | اجرای ران، مشاهدهٔ معاملات |
| `/risk` | مدیریت ریسک | وضعیتِ روزانه، ردها، **کیل‌سوییچ** lock/unlock |
| `/users` | کاربران | بن، پلن، اعطا، پیام، خروجیِ روستر |
| `/performance` | عملکرد | سرمایه، نرخِ برد، هیت‌مپ، متریک |
| `/reports` | گزارش‌های پیشرفته | CAGR/Sharpe رولینگ، دوره‌های افت، بنچمارک |
| `/ml-models` | مدل‌های ML | بازآموزی، اهمیتِ ویژگی، وزنِ ensemble |
| `/monitoring` | مانیتورینگ | سیستم/کانتینر/فیدِ داده/لاگ |
| `/visitors` | بازدیدکنندگان | آنالیتیکسِ overview/live/online |
| `/seo` | سئو و عملکرد | داشبوردِ Search Console + PageSpeed |
| `/articles` | مقالات | CMSِ مقاله |
| `/broadcasts` | پیام‌ها | برودکستِ تلگرام |
| `/live` | لایو ترید | استریم + مدیریتِ چت |
| `/auto-trade` | اتو ترید | تنظیماتِ EA، حسابِ مَستر، close-all |
| `/trade-history` | تاریخچهٔ سود/زیان | P&Lِ واقعی، خروجیِ CSV |
| `/panel-users` | کاربران پنل | کاربرانِ پنلِ VIP + کنترلِ کپی |
| `/academy` | آکادمی VIP | دانش‌آموزان، دروس، پرداخت، انجمن |
| `/ig-users` | کاربران IG | کاربرانِ پنلِ چندمستأجریِ اینستاگرام |
| `/settings` | تنظیمات | تنظیمات + کلیدهای API |

علاوه بر این، یک زیرشاخهٔ کاملِ `pages/instagram/` (`Inbox`، `SmartReply`، `ContentPublish`، `CoverMaker`، `FormBuilder`، `StaticMenu`، `NewMessageModal`) برای ماژولِ اتوماسیونِ اینستاگرام، از طریقِ `InstagramPage.jsx` در دسترس است.

#### گروه‌های کلیدیِ APIِ ادمین (`api/client.js`)

| گروه | نکات |
|-------|-----------|
| `dashboardAPI` | stats، signal-chart، user-growth، services، active-signals |
| `signalsAPI` | CRUD + `close(id)` |
| `usersAPI` | `ban/unban`، `updatePlan`، `grant`، `sendMessage`، **`exportRoster`** (پرینت/اکسل)، **`grantSignalAccess(days)`** |
| `riskAPI` | `getDailyStatus`، `getRejections`، `getPositions`، `getRegimes`، **`unlock()` / `manualLock(reason)`** (کیل‌سوییچ) |
| `mlAPI` | `getModels`، `retrain`، `getFeatureImportance`، وزن‌های ensemble |
| `monitoringAPI` | system، containers، data-feeds، logs |
| `analyticsAPI` | overview، live، online |
| `seoAPI` | overview، actions، `runNow`، PageSpeed (CRUD/history/test)، Search Console queries/pages |
| `tradeHistoryAPI` | list، daily، stats، clear، `exportUrl(uid)` (CSV) |
| `articlesAPI` | CRUDِ کامل |
| `broadcastsAPI` | روترِ کاملِ `/broadcasts` (نه `panel.py`ِ ناقص) |
| `eaAPI` | `getConfig/setConfig`، `getStatus`، `closeAll`، حسابِ مَستر |
| `panelUsersAPI` | approve/reject/remove/extend، `copyToggle`، `stop`، `closeAll`، `kyc` |
| `liveAPI` | start/stop/mode، chat-toggle، slowmode، pin، ban/mute، delete |
| `academyAPI` | دانش‌آموزان، دروس، پرداخت‌ها، انجمن |
| `igUsersAPI` / `instagramAPI` | کاربرانِ IG + اتوماسیونِ کاملِ اینستاگرام (auto-reply، فرم، خلبانِ خودکار، AIِ کپشن/کاور) |

#### کیتِ کامپوننتِ قابل‌استفادهٔ مجدد

`components/common/` یک سیستمِ طراحیِ کوچک اما کامل می‌دهد: `DataTable`، `StatCard`، `StatusBadge`، `Modal`، `ConfirmDialog` (+ هوکِ `useConfirm`)، `CommandPalette` (ناوبریِ ⌘K)، `SearchInput` (+ `useDebounce`)، `Toast`، `Skeleton`، `EmptyState`. صفحه‌بندی در `hooks/usePagination.js`، واکنش‌گرایی در `hooks/useMediaQuery.js`. اعلان‌ها/توست‌ها از `useNotificationStore` (توابعِ `success`/`error`) عبور می‌کنند. اسکلتِ i18n نیز در `src/i18n/` موجود است.

---

### ۱۱.۴ پنلِ کاربریِ VIP — `frontend/user/`

`coinepro-user-panel` (در **user.fx**) جایی است که VIPِ پرداخت‌کننده حسابِ واقعیِ بروکر را وصل و کپی‌ترید را روشن می‌کند. سبک‌ترین پشته است (بدونِ framer-motion و react-icons — فقط lucide + recharts).

#### بوت، گیتِ احراز و آنبوردینگِ اجباری (`src/App.jsx`)

در mount، `cp_user_token` خوانده و `userAPI.me()` صدا زده می‌شود؛ `profile`ِ حاصل یک گیتِ لایه‌ای را در `<Protected>` هدایت می‌کند:

1. **بدونِ توکن** → `/login`.
2. **پروفایل در حالِ بارگذاری** → `<Spinner>`.
3. **`!profile.panel_allowed`** → `<VipGate state={profile.panel_state} />` (تأییدنشده/منقضی).
4. **آنبوردینگِ ناتمام** (`!email_verified || !disclaimer_accepted`) → ریدایرکتِ اجباری به `/onboarding`.
5. در غیر این صورت صفحه در `<Layout>` رندر می‌شود.

| مسیر | صفحه | هدف |
|-------|------|---------|
| `/login` | `LoginPage` | ورودِ تلگرام + OTPِ ایمیل |
| `/onboarding` | `OnboardingPage` | تأییدِ OTPِ ایمیل + پذیرشِ سلبِ مسئولیت |
| `/` | `DashboardPage` | گِیجِ سلامت، عملکرد، اعلان‌ها |
| `/copy` | `CopyTradePage` | رابطِ موتورِ کپی‌ترید |
| `/history` | `HistoryPage` | تاریخچهٔ P&Lِ واقعی |
| `/account` | `AccountPage` | KYC + اتصالِ بروکر |
| `/profile` | `ProfilePage` | اشتراک، پروفایل |

احراز در یک استورِ کوچکِ zustand نگه‌داری می‌شود (`useAuth`)؛ تم (تاریکِ پیش‌فرض، ماندگار در `cp_theme`) کلاسِ `light` را روی `<html>` تغییر می‌دهد.

#### ورود و آنبوردینگ (`api/client.js`)

`userAPI` شاملِ `loginTelegram`، `loginWebApp(init_data)` (تلگرام WebApp) و جفتِ **OTPِ ایمیل** `requestOtp(email)` / `verifyOtp(email, code)` است. آنبوردینگ سپس `getDisclaimer()` و `acceptDisclaimer(version, full_name)` را صدا می‌زند — آنبوردینگ پیش از هر دسترسیِ پنل *اجباری* است.

#### اتصالِ حساب و KYC (`pages/AccountPage.jsx`)

کاربر اعتبارنامهٔ بروکر را با `linkAccount({ broker, server, login, password })` ثبت می‌کند و می‌تواند `unlinkAccount()` کند. یک بنرِ سیاستِ بروکر قانونِ کسب‌وکار را اعمال می‌کند:

> پلنِ رایگان → فقط **OneRoyal** مجاز است؛ مشترکِ پولی → هر بروکری.

`submitKyc(payload)` احرازِ هویت را مدیریت می‌کند؛ وضعیتِ حساب (`connected`/`pending`/`error`) با `StatusLight` نشان داده می‌شود.

#### رابطِ موتورِ کپی‌ترید (`pages/CopyTradePage.jsx`)

این قطعهٔ مرکزی است. هر ۸ ثانیه `copyStatus()` را پول می‌کند و `getCopyConfig()` را بار می‌زند، سپس ارائه می‌دهد:

- **کلیدِ روشن/خاموشِ مَستر** با کارتِ وضعیتِ رنگی: سبز = در حالِ اجرا، کهربایی = روشن اما منتظرِ اتصالِ حساب، قرمز = خاموش / بدونِ حساب.
- **پنلِ کیل‌سوییچِ اضطراری** — دو دکمهٔ بزرگ متصل به `copyStop()` (خاموش‌کردنِ کپی، دست‌نخورده ماندنِ پوزیشن‌های باز) و `copyCloseAll()` (ارسالِ فرمانِ بستنِ همهٔ پوزیشن‌های بازِ کاربر)، هرکدام پشتِ یک دیالوگِ تأیید.
- **انتخابگرِ مدلِ ریسک** — سه مدل که ۱:۱ روی `size_for_user()`ِ بک‌اند نگاشت می‌شوند:

| مدل (`risk_mode`) | برچسبِ UI | اندازه‌گیری |
|--------------------|----------|--------|
| `proportional` | متناسب با موجودی | `master.lots × risk_value` |
| `risk_percent` | درصدِ ریسک | درصدِ ثابتِ موجودی در هر معامله |
| `fixed_lot` | لاتِ ثابت | حجمِ ثابت |

- **اسلایدرها** برای `risk_value`، `max_lot`، `max_open_trades` و `max_daily_loss_pct` (۰ = غیرفعال)، به‌علاوهٔ چک‌باکسِ `copy_sl_tp` برای آینه‌کردنِ SL/TPِ مَستر.
- کامپوننتِ **`RiskSimulator`** برای پیش‌نمایشِ پیامد، و آکوردیونِ `Guide` با توضیحِ فارسیِ ساده.

`setCopyConfig(next)` کلِ فرم را persist می‌کند؛ `save({ enabled: !form.enabled })` کپی را toggle می‌کند.

#### ویجت‌های داشبورد و کامپوننت‌های پشتیبان

| کامپوننت | نقش |
|-----------|------|
| `PerformanceSection.jsx` / `PnlHistory.jsx` | P&Lِ واقعیِ دیلِ MT5: خالص (کمیسیون/سواپ)، نرخِ برد، profit factor، بیشترین افت، منحنیِ سرمایهٔ recharts؛ بازه‌های ۷/۳۰/۹۰ روز |
| `NotificationsBell.jsx` | نشانِ خوانده‌نشده با `notifications()` / `markNotificationsRead()` |
| `OnboardingChecklist.jsx` | پیشرفتِ راه‌اندازیِ راهنمایی‌شده |
| `SubscriptionStrip.jsx` | پلن/انقضا از `subscription()` |
| `AiAssistant.jsx` | چتِ هوشِ مصنوعیِ بازار-محدود با `aiChat(message)` (Haiku، سهمیهٔ VIP) |
| `EconomicCalendar.jsx` | رویدادهای `economicCalendar()` |
| `RiskSimulator.jsx` | اندازه‌گیریِ what-if |
| `Guide.jsx` | آکوردیون‌های راهنمای زمینه‌ای |
| `ui.jsx` | `Spinner`، `StatusLight`، `Stat`، دکمه‌های مشترک |

کامپوننتِ `PnlHistory` صریحاً سود/زیانِ **سطحِ-دیلِ واقعی** است (نگاشتِ دلایلِ بستن: `sl`→حد ضرر، `tp`→حد سود، `breakeven`→سربه‌سر، `manual`→دستی، `stopout`→استاپ‌اوت)، متمایز از عملکردِ عمومیِ راهبرد.

---

### ۱۱.۵ بک‌اندِ کپی‌تریدینگ — `src/copy/`

رابطِ پنل فقط فرمان است؛ موتور در `src/copy/` زندگی می‌کند (`engine.py`، `tasks.py`، `hetzner.py`، `__init__.py`). وظیفه‌اش: **آینه‌کردنِ معاملاتِ زندهٔ حسابِ مَستر روی حسابِ واقعیِ هر VIP**، همه زیرِ زیرساختِ سرورِ خودِ پروژه (بدونِ ترمینالِ جداگانه برای کاربر).

#### طراحی (`engine.py`)

- **مَستر = همان حسابِ سرورِ پروژه** (اتو-تریدِ ادمین). پوزیشن‌های بازِ آن از Redis `ea:status` خوانده می‌شود — همان فیدی که EA می‌نویسد — توسطِ `read_master_positions()` که رشتهٔ `positions` را به رکوردهای `MasterPosition(symbol, direction, lots, profit)` پارس می‌کند.
- برای هر `TradingAccount` با حسابِ لینک‌شده **و** `CopySettings.enabled`، معاملاتِ بازِ مَستر آینه می‌شوند، با **حجمِ تعیین‌شده بر اساسِ مدلِ ریسکِ کاربر** (`size_for_user`، محدود به `max_lot`).
- اجرا از طریقِ یک **Protocolِ `Executor`ِ قابل‌جایگزین** انجام می‌شود:
  - **`PaperExecutor`** (پیش‌فرضِ امن): **هیچ سفارشِ واقعی نمی‌زند**. حساب را `connected` علامت می‌زند، موجودی/equityِ نمایشی می‌گذارد و پوزیشن‌های آینه‌ای را در Redis `copy:user:{user_id}:positions` (TTL ۱۲۰ ثانیه) می‌نویسد تا پنل کلِ جریان را بدونِ ریسک نشان دهد.
  - **`LiveMT5Executor`** (مسیرِ زنده): به حسابِ MT5ِ کاربر وصل و واقعاً سفارش می‌زند — وقتی لایهٔ اتصالِ per-account فعال شود توسطِ `get_executor()` انتخاب می‌شود.

```python
def size_for_user(master, cs, equity):
    if cs.risk_mode == "fixed_lot":      lot = cs.risk_value
    elif cs.risk_mode == "proportional": lot = master.lots * cs.risk_value
    elif cs.risk_mode == "risk_percent": lot = max(equity/10000, 0.01) * cs.risk_value
    return round(max(min(lot, cs.max_lot), 0.0), 2)
```

`sync_once(db)` یک دورِ هماهنگ‌سازی روی هر حساب در (`pending`,`connected`,`error`) اجرا می‌کند: `CopySettings` را بار/می‌سازد، executor را صدا می‌زند و شمارشِ `mirrored` را ثبت می‌کند (خطا حساب را `status="error"` با `last_error` می‌کند).

#### ایمنی: تضمینِ no-reopen و close-all

دو خاصیتِ درستی در آن نهفته است:

1. **`enabled` گیتِ بازکردن است.** کاربری که کپی را خاموش کند، *هیچ* پوزیشنِ جدید باز نمی‌کند.
2. **no-reopen / close-all.** چون کاربر آینهٔ مَستر است، وقتی مَستر فلت است کاربر هم فلت است. مستقلاً، روترِ وضعیتِ EA (`src/api/routes/ea.py`) **dismissalِ سمتِ-سرورِ per-account** پیاده می‌کند: وقتی پوزیشنی که کاربر/ادمین دستی بسته (یا close-all بسته) درحالی‌که سیگنال هنوز فعال است گم‌شده تشخیص داده شود، `signal_id`ِ آن به مجموعهٔ Redis `ea:dismissed:{uid}` (TTLِ ۷ روز) اضافه و از pullهای بعدیِ EA حذف می‌شود — `_detect_dismissed_atomic()` این کار را اتمیک درونِ همان درخواست انجام می‌دهد تا raceِ re-open را شکست دهد، پس پوزیشنِ بسته **هرگز از هیچ دستگاهی دوباره باز نمی‌شود**.

اجرای trailing-stop نیز عبور داده می‌شود: payloadِ EAِ هر کاربر فیلدِ `trail_sl` (SLِ تریلِ latch‌شده) را حمل می‌کند تا trailing روی حساب‌های واقعی واقعاً اجرا شود.

#### زمان‌بندی و scale-outِ افقی (`tasks.py`)

دو تسکِ Celery موتور را می‌رانند:

- **`copy_sync`** (هر دقیقه) — یک نشستِ asyncِ `NullPool` باز و `sync_once` را اجرا می‌کند. برای ایمنی درونِ workerهای Celery، event loopِ تازه per-task می‌سازد.
- **`scale_servers`** — سرورهای ویندوز/MT5ِ کپی را روی Hetzner خودکار provision می‌کند:
  - **(۰) بازیابیِ خطا:** سرورهایی که heartbeatشان از ۱۸۰ ثانیه کهنه‌تر است `down` می‌شوند، کاربرانشان آزاد (`server_id=None`) و به سرورهای سالم منتقل می‌شوند (`_assign_unassigned`).
  - **تقاضا → ظرفیت:** `needed = ceil(active_copy_users / COPY_USERS_PER_SERVER)`.
  - **scale-out:** سرورهای کمِ `coinepro-copy-<n>` از snapshotِ ویندوز ساخته می‌شوند؛ هرکدام بوت و IP خود را ثبت می‌کند و کاربرانِ سرریز خودکار assign می‌شوند.
  - **reconcile + scale-inِ امن:** ردیف‌های یتیمِ DB پاک و سرورهای مدیریت‌شدهٔ *خالیِ* مازاد حذف می‌شوند.

#### provisioningِ Hetzner و گاردِ حذف (`hetzner.py`)

`hetzner.py` APIِ Hetzner Cloud را می‌پیچد. مقیاس‌گذاری **اول عمودی** است (نردبانِ `RESIZE_LADDER`: `cx33 → cx43 → cx53`، یعنی ۸→۱۶→۳۲ گیگ) سپس افقی (سرورِ جدید از `HETZNER_SNAPSHOT_ID`). ویژگیِ شاخصِ ایمنی یک **گاردِ سختِ حذف** برای جلوگیری از حذفِ سرورِ اشتباه است (درسی از یک حادثهٔ گذشته):

```python
_DELETABLE_NAME = re.compile(r"^coinepro-copy-\d+$")  # فقط این‌ها خودکار حذف‌شدنی‌اند
PROTECTED_NAMES = {"CoinePro-FX", "coinepro-win-base", "TraydeYar-Bot"}
PROTECTED_IDS   = {133765432, 138385055, 138390751}
```

فقط سرورهایی که نامشان دقیقاً با `coinepro-copy-<عدد>` بخواند خودکار حذف می‌شوند؛ سرورِ پایه، سرورِ ربات و سرورهای نام/ID-لیست‌شده بی‌قیدوشرط محافظت می‌شوند. سرورهای دارای کاربرِ assign‌شده هرگز حذف نمی‌شوند (اول باید drain شوند).

#### جریانِ سرتاسری

```
EA (MT5، مَستر) ──می‌نویسد──▶ Redis ea:status
                                  │
              copy_sync (Celery، ۱/دقیقه) پوزیشن‌های مَستر را می‌خواند
                                  │
        برای هر کاربرِ روشن: size_for_user() → Executor
                                  │
        Paper:  Redis copy:user:{uid}:positions (نمایِ پنل)
        Live :  سفارش روی MT5ِ کاربر (از طریقِ سرورِ ویندوز)
                                  │
 پنلِ کاربر  ◀── copyStatus()/copy-config ──▶  رابطِ /copy (پولِ ۸ث)
 کیل‌سوییچ ──▶ copyStop()/copyCloseAll() ──▶ dismissalِ سمتِ سرور (no-reopen)
 scale_servers (Celery) ──▶ Hetzner: بازیابیِ heartbeat + scale-out/in (گارد)
```

این همان چیزی است که کپی‌تریدینگِ CoinePro-FX را هم **پیش‌فرض-امن** می‌کند (executorِ کاغذی، کیل‌سوییچ‌ها، no-reopen، زیرساختِ محافظت‌شده) و هم **افقی-مقیاس‌پذیر** (ظرفیتِ کاربر per-server با provisioningِ خودکارِ Hetzner) — پنلِ React صرفاً کنترل‌ها را نمایان می‌کند، در حالی که `src/copy/` آینه‌کردنِ واقعی را انجام می‌دهد.

---

[⬅ 10. The Telegram Bot — aiogram Delivery, Onboarding & Access](telegram-bot.md) · [🏠 Home · خانه](../README.md) · [12. The VIP Academy & BazaarNama (+ NamaScript) ➡](academy-bazaarnama.md)
