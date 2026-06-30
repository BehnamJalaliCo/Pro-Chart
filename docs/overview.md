[🏠 Home · خانه](../README.md) · [2. System Architecture & Service Topology ➡](architecture.md)

---

## 1. Executive Summary, Vision & Design Philosophy

> *"A trading system is not a model — it is a city. Data is the water supply, the signal engine is the power plant, risk management is the building code, and observability is the police force. CoinePro‑FX was engineered as that whole city, not as a single clever house."*

### 1.1 What CoinePro‑FX is, in one paragraph

**CoinePro‑FX** is a production‑grade, **event‑driven, microservice** platform that fuses three businesses normally built by three different companies into a single coherent codebase: (1) an **algorithmic Forex trading engine** that ingests live market data, derives technical and structural features, scores trade setups with an ensemble of machine‑learning models, filters them through institutional‑grade risk controls, emits auditable signals, tracks them to outcome, and — when explicitly unlocked — mirrors them onto a **real broker account** through a Windows MT5 copy‑trading agent; (2) a **media & growth machine** that automatically produces cinematic YouTube videos and Instagram reels from blog content, runs a multi‑account Instagram automation suite, mines Google Search Console for SEO, and posts richly‑formatted signals to Telegram channels; and (3) a **trading‑education university** — a 160‑lesson VIP academy with an AI mentor, a watermarked video pipeline narrated by a voice‑cloned instructor, and **BazaarNama**, an in‑house TradingView‑class charting application with its own Pine‑style scripting language (**NamaScript**) executed in a sandboxed Web Worker.

In hard numbers, the system is approximately **64,578 lines of Python** spread across **19 bounded‑context backend modules**, **5 independent React 18 single‑page applications**, **41 Alembic database migrations**, **29 test suites**, and **35+ Docker services** (46 declared compose entries including volumes) orchestrated by a single `docker-compose.yml` and deployed onto **one** Hetzner host (Ubuntu 24.04, 16 GB RAM, 8 vCPU, no GPU).

### 1.2 The real‑world problem it solves

Retail Forex traders — and especially the Persian‑speaking audience this platform serves — face a triad of problems that no single off‑the‑shelf product solves:

| Problem | Why existing tools fail | How CoinePro‑FX answers it |
|---|---|---|
| **Signal quality & trust** | Most "signal channels" are opaque, unbacktested, and emotionally driven; users cannot audit *why* a trade was suggested. | A deterministic, **auditable pipeline** (data → analysis → ML score → risk veto → tracked outcome) with real P&L accounting (commission/swap/net) and a calibrated 0–100 confidence score. |
| **Execution gap** | Even good signals fail because retail users react late, size positions wrong, or trade closed/illiquid markets. | A **copy‑trading agent** mirrors confirmed signals to a real MT5 account with instrument‑aware position sizing and spread‑buffered stops; server‑side dismissal guarantees a manually closed position never re‑opens on any device. |
| **Safety** | "Go live" buttons in retail tools risk real capital before a strategy is proven on the *specific broker*. | A hard **paper‑before‑live gate**: `TRADING_MODE` defaults to `paper`, and live execution is locked behind a `divergence`/`preflight` verification that compares paper performance against the live broker feed. |
| **Education** | Courses are static videos disconnected from real charts; learners cannot *practice* on the same instruments they trade. | A full academy with **BazaarNama**, a live charting tool with forward‑projected reward/risk zones, AI setups, and a scriptable backtester — learning and doing on the same surface. |
| **Distribution on filtered networks** | The target users live behind network filtering where third‑party CDNs, fonts, and analytics are slow or blocked. | **Self‑hosted everything**: fonts, scripts, charts, and assets are served from the platform's own edge — no render‑blocking external CDNs — so the product stays fast and reachable. |

The thesis is simple: **a signal is worthless without disciplined execution, execution is dangerous without risk controls, risk controls are unconvincing without education, and the whole thing is invisible without observability.** CoinePro‑FX builds all four pillars under one roof.

### 1.3 Who it serves (the product surfaces)

The platform exposes **five production web applications**, a **Telegram bot**, and a set of **automation pipelines**, each aimed at a distinct audience. All five web apps are React 18 + Vite + TailwindCSS + zustand + `@tanstack/react-query` SPAs, each behind its own nginx container on its own subdomain.

| Surface | Audience | What they get |
|---|---|---|
| **Public website** (`FX.trade-future.ir`) | Prospects, organic search visitors | SEO‑optimized marketing & education site, blog/article CMS, dynamic sitemap, JSON‑LD structured data, performance‑tuned for filtered networks. |
| **Admin console** (`Panel.FX.trade-future.ir`) | The operator (business owner) | User management, broadcasts, signal control & kill‑switch, SEO dashboard, visitor analytics, Instagram‑user administration, system health gauges. |
| **VIP user panel** (`user.fx.trade-future.ir`) | Paying subscribers | Telegram + OTP login, KYC, broker linking, the copy‑trade engine, kill‑switch, and real P&L history. |
| **VIP academy** (`academy.fx.trade-future.ir`) | Students | 160 video lessons across 3 stages, an AI mentor, a trading journal, certificates, and the **BazaarNama** charting workbench. |
| **Instagram panel** (`ig.trade-future.ir`) | Social‑media operators (multi‑tenant) | Per‑user login, up to 3 accounts each, smart keyword auto‑reply, link‑as‑card DMs, and AI‑generated posts/reels. |
| **Telegram bot** (`@…Bot`, aiogram 3) | Channel subscribers | Rich signal delivery (chart image + caption, pro TP/SL/break‑even/trailing alerts), onboarding, gated access, on‑demand project backups. |

### 1.4 The guiding engineering principles ("the why behind the what")

Every major architectural decision in CoinePro‑FX traces back to one of eight principles. These are not slogans — each is enforced by concrete structure in the codebase.

#### Principle 1 — Event‑driven microservices, not a monolith
The platform is **horizontally decomposed** into independent services that communicate through **Redis** (pub/sub for live prices and signal fan‑out, plus key/value caching) and a shared **TimescaleDB**. *Why:* a fault in the Instagram worker, a slow ML retrain, or a crashing chart renderer must never take down the trading core. Decomposition turns a catastrophic failure into a degraded‑mode failure. The `data-feed`, `signal-engine`, `ml-inference`, and `signal-tracker` services each own a single stage of the pipeline and can be restarted, scaled, or debugged in isolation.

#### Principle 2 — Queue isolation so trading is never starved
Celery runs across **four separate workers** — `celery-worker` (general + `critical` trading jobs), `celery-ml-worker` (`ml` inference/retrain), `celery-ig-worker` (`ig` Instagram), and `celery-beat` (scheduler) — each bound to its own queue. *Why:* this is a scar earned in production. On 2026‑06‑19 a runaway Instagram backlog exploded the shared queue to ~240,000 tasks and the weekend auto‑close job never ran. The fix — and now an inviolable rule — is that **trading lives on a dedicated `critical` queue** that a noisy subsystem can never crowd out. Isolation is not an optimization; it is a safety property.

#### Principle 3 — Forex‑only scope (a hard product boundary)
Every product surface is **Forex‑only — zero crypto.** *Why:* focus. A narrow instrument universe lets the risk engine encode per‑symbol session policy, DST/liquidity awareness, and instrument‑specific contract sizes precisely, and lets the brand and education content stay coherent. This is a deliberately enforced constraint, documented as a hard rule, not an accident of scope.

#### Principle 4 — Paper‑before‑live safety gating
`TRADING_MODE` defaults to **`paper`**. Live execution is gated behind `src/launch/` modules (`paper_trading`, `divergence`, `preflight`). *Why:* a strategy that backtests well can still bleed on a *specific* broker due to spread, slippage, swap, and fill behavior. The divergence report compares paper decisions to the live feed before a single dollar of real capital is risked. Capital preservation outranks ambition.

#### Principle 5 — Self‑hosted assets for filtered networks
Fonts, scripts, chart rendering (`chart-renderer`, headless Chromium via Playwright), and all static assets are served from the platform's own nginx edge. *Why:* the target audience sits behind network filtering where Google Fonts, third‑party analytics, and CDNs are slow or blocked. Self‑hosting removes render‑blocking external dependencies and keeps the product fast and reachable where it matters.

#### Principle 6 — Encryption at rest
Broker and Instagram credentials are encrypted with **Fernet** (`src/core/crypto.py`); plaintext only ever transits the internal Docker network. *Why:* a database snapshot, a leaked backup, or a compromised volume must not yield usable broker logins or social sessions. Combined with `.gitignore` rules that exclude `.env`, `*.key`, `*.session`, and `/secrets/`, the secret surface is minimized at rest and in transit.

#### Principle 7 — Observability‑first
Every service is wired into **Prometheus** (metrics, including `prometheus-fastapi-instrumentator` on the API), **Grafana** (dashboards), **Loki + Promtail** (structured logs), **cAdvisor**/`node-exporter` (container & host), **Flower** (Celery), and a `watchdog` self‑healing service. *Why:* a trading system that fails silently is worse than one that fails loudly. You cannot operate what you cannot see; observability is treated as a first‑class subsystem, not an afterthought.

#### Principle 8 — Reproducibility & MLOps discipline
The ML subsystem uses **purged K‑fold** cross‑validation with embargo (to kill look‑ahead leakage on overlapping labels), probability **calibration**, a **drift detector**, finance‑specific metrics (expectancy, profit factor, Sharpe, max drawdown), experiment tracking in **MLflow**, and retraining flows orchestrated by **Prefect**. *Why:* financial ML is a minefield of subtle leakage and over‑fitting. Research rigor is encoded structurally so that a "good" model is good for the right reasons.

### 1.5 The scale of the system

| Dimension | Count | Notes |
|---|---:|---|
| Python LOC | **≈ 64,578** | Measured across `src/` |
| Backend modules (bounded contexts) | **19** | `api`, `signals`, `analysis`, `ml`, `risk`, `backtest`, `launch`, `bot`, `data`, `core`, `bazaarnama`, `instagram`, `publish`, `llm`, `news`, `seo`, `academy`, `analytics`, `copy` |
| React front‑ends | **5** | website, admin, user, academy, ig |
| Alembic migrations | **41** | `alembic upgrade head` on deploy |
| Test suites | **29** | `tests/test_phase*.py` (15 development phases) |
| Docker services | **35+** | 46 declared compose entries (incl. volumes) |
| Largest modules | `api` (42), `bot` (41), `core` (21), `ml` (18), `signals` (14), `risk` (13) | file counts per directory |

The development history spans **15 phases** with a cumulative test corpus, reflecting an incremental, test‑gated build rather than a single big‑bang construction.

### 1.6 Macro architecture — a narrative walkthrough

At the highest level, data flows **left to right** through the system, while control and observability flow **top to bottom**. Picture four horizontal bands:

1. **The external world** sits at the top: market‑data sources (yfinance and other connectors via a failover chain), Telegram, Instagram, and the broker (MT5).
2. **The ingestion & decision band** is the trading core: `data-feed` validates and publishes ticks/candles, `signal-engine` runs analysis → ML → risk to a verdict, `ml-inference` serves model scores, and `signal-tracker` follows each open idea through its TP/SL/break‑even/trailing lifecycle.
3. **The service & API band** is the connective tissue: the FastAPI `api` exposes REST + WebSocket endpoints for all five front‑ends and the bot, `claude-llm` is the Anthropic gateway for every AI feature, and `chart-renderer` produces server‑side chart images.
4. **The persistence & edge band** sits at the bottom: **TimescaleDB** stores candle/tick hypertables and all relational data; **Redis** is the live‑price bus and cache; **nginx** terminates TLS and routes to each subdomain; **mediamtx**/**coturn** carry WebRTC live streams.

Cross‑cutting through all bands run the **Celery** workers (isolated queues), the **observability stack** (Prometheus/Grafana/Loki/Promtail/cAdvisor/node‑exporter/Flower), the **MLOps stack** (MLflow/Prefect/flow‑runner), and the **self‑healing** watchdog.

```
╔══════════════════════════════════════ EXTERNAL WORLD ══════════════════════════════════════╗
║   Market data (yfinance / connectors)   │   Telegram   │   Instagram   │   Broker (MT5)      ║
╚════════════╤════════════════════════════════════╤═════════════╤═══════════════╤═════════════╝
             │ ticks + candles                     │ updates     │ DMs / posts   │ orders / fills
        ┌────▼─────┐                          ┌────▼──────┐  ┌───▼────────┐  ┌───▼─────────────┐
        │ data-feed│  validate → persist      │ bot-worker│  │ ig-worker  │  │  copy agent      │
        │ (ticks,  │  failover source chain   │ (aiogram3)│  │ (instagrapi│  │ (Windows / MT5)  │
        │  OHLCV)  │                          └────┬──────┘  │ multi-acct)│  └───▲──────────────┘
        └────┬─────┘                               │         └───┬────────┘      │ confirmed
   price:* ┌─▼──────────────────────── REDIS (pub/sub + cache) ──▼──────────────┼─ signals
  ┌────────┤  channels: price:{symbol} · signal fan-out · rate-limit · sessions  │
  │        └─┬───────────────────────────┬───────────────────────────┬──────────┘
  │   ┌──────▼────────┐          ┌────────▼─────────┐        ┌─────────▼──────────────────────┐
  │   │ signal-engine │  scores  │  ml-inference     │        │        api  (FastAPI)           │
  │   │ analysis →    │◄────────►│ XGBoost+LightGBM  │        │  REST + WebSocket for 5 SPAs +  │
  │   │ ML → RISK →   │          │ (+LSTM optional)  │        │  bot · auth · rate-limit · CORS │
  │   │ signal verdict│          └───────────────────┘        └───────┬─────────────────────────┘
  │   └──────┬────────┘                                                │
  │          │ writes signal                          ┌────────────────┼──────────────┬───────────┐
  │   ┌──────▼────────────┐                     ┌──────▼────┐  ┌────────▼───────┐  ┌───▼────────┐
  │   │  signal-tracker   │  TP1/TP2/TP3        │ website   │  │ academy +      │  │ user / ig  │
  │   │  SL · break-even ·│  trailing · real    │ (SEO/CMS) │  │ BazaarNama     │  │ + admin    │
  │   │  trailing-stop    │  P&L (comm/swap/net)│           │  │ (charts+Nama)  │  │ panels     │
  │   └──────┬────────────┘                     └───────────┘  └────────────────┘  └────────────┘
  │          │
  │   ┌──────▼──────────────────────────────────────────────────────────────────────────────────┐
  └──►│ TimescaleDB  ·  candle/tick hypertables · signals · students · IG · content · analytics   │
      └─────────────────────────────────────────────────────────────────────────────────────────┘

  CROSS-CUTTING (span all bands):
    Celery   →  celery-worker (critical/general) · celery-ml-worker (ml) · celery-ig-worker (ig) · celery-beat
    AI       →  claude-llm (Anthropic gateway)  ·  chart-renderer (headless Chromium / Playwright)
    Edge     →  nginx (TLS + routing) · nginx-reloader · mediamtx + coturn (WebRTC) · certbot · mt5
    Observe  →  prometheus · grafana · loki · promtail · cadvisor · node-exporter · flower · watchdog
    MLOps    →  mlflow · prefect · flow-runner
```

The defining quality of this diagram is **isolation with shared backbones**: services never call each other directly in tangled webs; they meet at two well‑defined backbones — Redis (fast, ephemeral, real‑time) and TimescaleDB (durable, queryable, historical) — and everything else is a leaf that can fail without bringing the trunk down.

### 1.7 Design philosophy distilled

If the entire platform had to be compressed into five sentences, they would be:

1. **Decompose ruthlessly** so that no non‑trading subsystem can ever degrade the trading path.
2. **Isolate the queues** because the trading critical path earned its own lane in blood.
3. **Gate live trading behind proof** because real capital deserves a paper‑verified, divergence‑checked promotion, never a hopeful button.
4. **Encrypt secrets and self‑host assets** because the users live behind hostile networks and the data is sensitive.
5. **Make everything observable** because an algorithmic system you cannot watch is an algorithmic system you cannot trust.

Everything that follows in this document — the signal pipeline, the ML subsystem, the risk engine, the five web apps, BazaarNama, the bot, and the growth automation — is an elaboration of these five commitments.

---
---

## ۱. خلاصهٔ اجرایی، چشم‌انداز و فلسفهٔ طراحی

> *«یک سامانهٔ معاملاتی فقط یک مدل نیست — یک شهر است. داده، شبکهٔ آب‌رسانی است؛ موتورِ سیگنال، نیروگاهِ برق؛ مدیریتِ ریسک، آیین‌نامهٔ ساختمان‌سازی؛ و رصدپذیری، نیروی انتظامی. CoinePro‑FX به‌عنوانِ تمامِ این شهر مهندسی شد، نه به‌عنوانِ یک خانهٔ هوشمندِ تنها.»*

### ۱.۱ CoinePro‑FX در یک بند چیست؟

**CoinePro‑FX** یک پلتفرمِ **رویدادمحورِ میکروسرویسی** در سطحِ تولید (production) است که سه کسب‌وکاری را که معمولاً سه شرکتِ جداگانه می‌سازند، در یک کدبیسِ یکپارچه درهم می‌آمیزد: (۱) یک **موتورِ معاملاتیِ الگوریتمیِ فارکس** که دادهٔ زندهٔ بازار را می‌گیرد، ویژگی‌های تکنیکال و ساختاری استخراج می‌کند، ستاپ‌های معاملاتی را با مجموعه‌ای از مدل‌های یادگیریِ ماشین امتیاز می‌دهد، آن‌ها را از کنترل‌های ریسکِ سطحِ نهادی عبور می‌دهد، سیگنال‌های قابلِ‌حسابرسی صادر می‌کند، آن‌ها را تا نتیجه ردیابی می‌کند و — تنها هنگامی که صراحتاً قفل باز شود — آن‌ها را روی یک **حسابِ واقعیِ بروکر** از طریقِ یک ایجنتِ کپی‌تریدِ ویندوزیِ MT5 آینه می‌کند؛ (۲) یک **ماشینِ رسانه و رشد** که به‌صورتِ خودکار از محتوای وبلاگ ویدیوهای سینماییِ یوتیوب و ریلزِ اینستاگرام می‌سازد، یک سوئیتِ اتوماسیونِ چنداکانتهٔ اینستاگرام را اجرا می‌کند، Google Search Console را برای سئو استخراج می‌کند و سیگنال‌های با قالب‌بندیِ غنی را به کانال‌های تلگرام می‌فرستد؛ و (۳) یک **دانشگاهِ آموزشِ معامله** — یک آکادمیِ VIP با ۱۶۰ درس، یک مربیِ هوشِ مصنوعی، یک خطِ تولیدِ ویدیوی واترمارک‌دار با روایتِ صدای کلون‌شدهٔ مدرس، و **بازارنما (BazaarNama)**، یک اپلیکیشنِ چارتِ اختصاصی در ردهٔ تریدینگ‌ویو با زبانِ اسکریپت‌نویسیِ خاصِ خودش (**نمااسکریپت / NamaScript**) که در یک Web Worker سندباکس‌شده اجرا می‌شود.

به زبانِ اعداد، این سامانه تقریباً **۶۴٬۵۷۸ خط پایتون** در **۱۹ ماژولِ بک‌اندِ مرزبندی‌شده**، **۵ اپلیکیشنِ تک‌صفحه‌ایِ مستقلِ React 18**، **۴۱ مهاجرتِ دیتابیسِ Alembic**، **۲۹ مجموعه‌تست** و **۳۵+ سرویسِ داکر** (۴۶ ورودیِ اعلام‌شده در compose شاملِ والیوم‌ها) است که با یک `docker-compose.yml` ارکستر می‌شوند و روی **یک** سرورِ Hetzner مستقر هستند (Ubuntu 24.04، ۱۶ گیگابایت RAM، ۸ vCPU، بدونِ GPU).

### ۱.۲ مسئلهٔ دنیای واقعی که حل می‌کند

معامله‌گرانِ خردهٔ فارکس — و به‌ویژه مخاطبِ فارسی‌زبانی که این پلتفرم به آن خدمت می‌کند — با سه‌گانه‌ای از مشکلات روبه‌رو هستند که هیچ محصولِ آماده‌ای آن را یکجا حل نمی‌کند:

| مسئله | چرا ابزارهای موجود شکست می‌خورند | پاسخِ CoinePro‑FX |
|---|---|---|
| **کیفیت و اعتمادِ سیگنال** | بیشترِ «کانال‌های سیگنال» مات، بک‌تست‌نشده و احساسی‌اند؛ کاربر نمی‌تواند *دلیلِ* پیشنهادِ یک معامله را حسابرسی کند. | یک خطِ لولهٔ **قطعی و قابلِ‌حسابرسی** (داده ← تحلیل ← امتیازِ ML ← وتوی ریسک ← نتیجهٔ ردیابی‌شده) با حساب‌داریِ P&L واقعی (کمیسیون/سواپ/خالص) و امتیازِ اطمینانِ کالیبره‌شدهٔ ۰–۱۰۰. |
| **شکافِ اجرا** | حتی سیگنال‌های خوب هم شکست می‌خورند چون کاربرِ خرد دیر واکنش می‌دهد، پوزیشن را اشتباه سایز می‌کند یا در بازارِ بسته/کم‌نقدینگی معامله می‌کند. | یک **ایجنتِ کپی‌ترید** سیگنال‌های تأییدشده را با سایزینگِ آگاه از ابزار و استاپِ بافرشده به یک حسابِ واقعیِ MT5 آینه می‌کند؛ dismissal سمتِ‌سرور تضمین می‌کند پوزیشنی که دستی بسته شده هرگز روی هیچ دستگاهی دوباره باز نشود. |
| **ایمنی** | دکمه‌های «زنده شو» در ابزارهای خرد، پیش از اثباتِ استراتژی روی *همان بروکرِ مشخص*، سرمایهٔ واقعی را به خطر می‌اندازند. | یک **دروازهٔ سختِ کاغذ‌پیش‌از‌زنده**: `TRADING_MODE` به‌صورتِ پیش‌فرض `paper` است و اجرای زنده پشتِ تأییدِ `divergence`/`preflight` قفل است. |
| **آموزش** | دوره‌ها ویدیوهای ایستا و جدا از چارتِ واقعی‌اند؛ یادگیرنده نمی‌تواند روی همان ابزارهایی که معامله می‌کند *تمرین* کند. | یک آکادمیِ کامل با **بازارنما**، یک ابزارِ چارتِ زنده با ناحیه‌های ریسک/ریوارد که رو به جلو پروجکت می‌شوند، ستاپ‌های AI و یک بک‌تستِرِ اسکریپت‌پذیر — یادگیری و انجام روی یک سطح. |
| **توزیع روی شبکه‌های فیلترشده** | کاربرانِ هدف پشتِ فیلترینگ هستند، جایی که CDNها، فونت‌ها و آنالیتیکسِ شخصِ‌ثالث کند یا مسدودند. | **همه‌چیز خودمیزبان**: فونت‌ها، اسکریپت‌ها، چارت‌ها و دارایی‌ها از لبهٔ خودِ پلتفرم سرو می‌شوند — بدونِ CDNِ بیرونیِ مسدودکننده — تا محصول سریع و در دسترس بماند. |

تزِ کار ساده است: **یک سیگنال بدونِ اجرای منضبط بی‌ارزش است، اجرا بدونِ کنترلِ ریسک خطرناک است، کنترلِ ریسک بدونِ آموزش قانع‌کننده نیست، و کلِ این مجموعه بدونِ رصدپذیری نامرئی است.** CoinePro‑FX هر چهار ستون را زیرِ یک سقف می‌سازد.

### ۱.۳ به چه کسانی خدمت می‌کند (سطوحِ محصول)

پلتفرم **پنج اپلیکیشنِ وبِ تولیدی**، یک **رباتِ تلگرام** و مجموعه‌ای از **خطوطِ اتوماسیون** را در معرض می‌گذارد که هرکدام مخاطبی متمایز را هدف می‌گیرند. هر پنج اپِ وب، SPAهای React 18 + Vite + TailwindCSS + zustand + `@tanstack/react-query` هستند، هرکدام پشتِ nginx اختصاصیِ خودش روی زیردامنهٔ خودش.

| سطح | مخاطب | چه می‌گیرد |
|---|---|---|
| **وب‌سایتِ عمومی** (`FX.trade-future.ir`) | مشتریانِ بالقوه، بازدیدکنندگانِ ارگانیکِ جستجو | سایتِ سئوشدهٔ بازاریابی و آموزش، CMSِ وبلاگ/مقاله، sitemap پویا، دادهٔ ساختاریافتهٔ JSON‑LD، بهینه‌شده برای شبکه‌های فیلترشده. |
| **کنسولِ ادمین** (`Panel.FX.trade-future.ir`) | اپراتور (مالکِ کسب‌وکار) | مدیریتِ کاربران، برودکست، کنترلِ سیگنال و کیل‌سوییچ، داشبوردِ سئو، آنالیتیکسِ بازدید، مدیریتِ کاربرانِ اینستاگرام، گیج‌های سلامتِ سیستم. |
| **پنلِ کاربریِ VIP** (`user.fx.trade-future.ir`) | مشترکینِ پولی | ورودِ تلگرام + OTP، KYC، اتصالِ بروکر، موتورِ کپی‌ترید، کیل‌سوییچ و تاریخچهٔ P&L واقعی. |
| **آکادمیِ VIP** (`academy.fx.trade-future.ir`) | دانشجویان | ۱۶۰ درسِ ویدیویی در ۳ مرحله، یک مربیِ AI، ژورنالِ معامله، گواهی‌نامه‌ها و میزِکارِ چارتِ **بازارنما**. |
| **پنلِ اینستاگرام** (`ig.trade-future.ir`) | اپراتورهای شبکهٔ اجتماعی (چندمستأجره) | ورودِ هر کاربر، تا ۳ اکانت برای هرکس، پاسخِ خودکارِ هوشمندِ کلیدواژه، DMِ کارت‌لینک و تولیدِ پست/ریلزِ AI. |
| **رباتِ تلگرام** (`@…Bot`، aiogram 3) | مشترکینِ کانال | تحویلِ غنیِ سیگنال (تصویرِ چارت + کپشن، هشدارهای حرفه‌ایِ TP/SL/سربه‌سر/تریلینگ)، آن‌بوردینگ، دسترسیِ گِیت‌شده، بکاپِ پروژه به‌محضِ درخواست. |

### ۱.۴ اصولِ راهنمای مهندسی («چراییِ پشتِ چیستی»)

هر تصمیمِ معماریِ مهم در CoinePro‑FX به یکی از هشت اصل برمی‌گردد. این‌ها شعار نیستند — هرکدام با ساختارِ مشخصی در کدبیس تحمیل می‌شود.

#### اصلِ ۱ — میکروسرویسِ رویدادمحور، نه یک مونولیت
پلتفرم به‌صورتِ **افقی‌تجزیه‌شده** به سرویس‌های مستقلی تقسیم شده که از طریقِ **Redis** (pub/sub برای قیمتِ زنده و توزیعِ سیگنال + کشِ کلید/مقدار) و یک **TimescaleDB** مشترک حرف می‌زنند. *چرا:* یک خطا در ورکرِ اینستاگرام، یک بازآموزیِ کندِ ML، یا یک چارت‌رندرِ کرش‌کرده هرگز نباید هستهٔ معامله را از کار بیندازد. تجزیه، یک شکستِ فاجعه‌بار را به یک شکستِ حالتِ‌تخریب‌یافته تبدیل می‌کند. سرویس‌های `data-feed`، `signal-engine`، `ml-inference` و `signal-tracker` هرکدام مالکِ یک مرحله از خطِ لوله‌اند و می‌توانند جداگانه ری‌استارت، مقیاس‌دهی یا دیباگ شوند.

#### اصلِ ۲ — جداسازیِ صف تا معامله هرگز قحطی نشود
Celery روی **چهار ورکرِ جداگانه** اجرا می‌شود — `celery-worker` (عمومی + کارهای `critical` معامله)، `celery-ml-worker` (`ml` استنتاج/بازآموزی)، `celery-ig-worker` (`ig` اینستاگرام) و `celery-beat` (زمان‌بند) — که هرکدام به صفِ خودش مقید است. *چرا:* این زخمی است که در تولید به دست آمده. در ۱۹ خردادِ ۱۴۰۵ (۲۰۲۶‑۰۶‑۱۹) یک بک‌لاگِ مهارنشدهٔ اینستاگرام صفِ مشترک را به ~۲۴۰٬۰۰۰ تسک منفجر کرد و کارِ بستنِ خودکارِ آخرهفته هرگز اجرا نشد. راه‌حل — و حالا یک قاعدهٔ نقض‌ناپذیر — این است که **معامله روی یک صفِ `critical` اختصاصی** زندگی کند که هیچ زیرسیستمِ پرسروصدایی نتواند آن را پس بزند. جداسازی یک بهینه‌سازی نیست؛ یک خاصیتِ ایمنی است.

#### اصلِ ۳ — محدودهٔ فقط‌فارکس (یک مرزِ سختِ محصول)
هر سطحِ محصول **فقط فارکس است — صفرِ ارزِ دیجیتال.** *چرا:* تمرکز. یک جهانِ ابزاریِ باریک به موتورِ ریسک اجازه می‌دهد سیاستِ سشنِ per‑symbol، آگاهیِ DST/نقدینگی و اندازهٔ قراردادِ مخصوصِ ابزار را دقیق کدگذاری کند و به برند و محتوای آموزشی اجازه می‌دهد منسجم بماند. این محدودیتی است که عمداً تحمیل شده و به‌عنوانِ یک قاعدهٔ سخت مستند است، نه یک اتفاقِ ناشی از دامنه.

#### اصلِ ۴ — دروازهٔ ایمنیِ کاغذ‌پیش‌از‌زنده
`TRADING_MODE` به‌صورتِ پیش‌فرض **`paper`** است. اجرای زنده پشتِ ماژول‌های `src/launch/` (`paper_trading`، `divergence`، `preflight`) قفل است. *چرا:* استراتژی‌ای که در بک‌تست خوب است، می‌تواند روی یک بروکرِ *مشخص* به‌خاطرِ اسپرد، اسلیپیج، سواپ و رفتارِ پرشدنِ سفارش زیان بدهد. گزارشِ divergence پیش از به‌خطر‌افتادنِ حتی یک دلارِ سرمایهٔ واقعی، تصمیم‌های کاغذی را با فیدِ زنده مقایسه می‌کند. حفظِ سرمایه بر جاه‌طلبی اولویت دارد.

#### اصلِ ۵ — دارایی‌های خودمیزبان برای شبکه‌های فیلترشده
فونت‌ها، اسکریپت‌ها، رندرِ چارت (`chart-renderer`، Chromium بدونِ‌هد از طریقِ Playwright) و همهٔ دارایی‌های ایستا از لبهٔ nginx خودِ پلتفرم سرو می‌شوند. *چرا:* مخاطبِ هدف پشتِ فیلترینگ نشسته که در آن Google Fonts، آنالیتیکسِ شخصِ‌ثالث و CDNها کند یا مسدودند. خودمیزبانی، وابستگی‌های بیرونیِ مسدودکنندهٔ رندر را حذف می‌کند و محصول را جایی که مهم است سریع و در دسترس نگه می‌دارد.

#### اصلِ ۶ — رمزنگاری در حالتِ سکون
کرِدِنشیال‌های بروکر و اینستاگرام با **Fernet** رمز می‌شوند (`src/core/crypto.py`)؛ متنِ ساده تنها روی شبکهٔ داخلیِ داکر در عبور است. *چرا:* یک اسنپ‌شاتِ دیتابیس، یک بکاپِ نشت‌کرده یا یک والیومِ به‌خطر‌افتاده نباید لاگین‌های قابلِ‌استفادهٔ بروکر یا سشن‌های اجتماعی بدهد. در ترکیب با قواعدِ `.gitignore` که `.env`، `*.key`، `*.session` و `/secrets/` را کنار می‌گذارد، سطحِ secret در سکون و در انتقال کمینه می‌شود.

#### اصلِ ۷ — رصدپذیری در درجهٔ اول
هر سرویس به **Prometheus** (متریک، شاملِ `prometheus-fastapi-instrumentator` روی API)، **Grafana** (داشبورد)، **Loki + Promtail** (لاگِ ساختاریافته)، **cAdvisor**/`node-exporter` (کانتینر و هاست)، **Flower** (Celery) و یک سرویسِ خودترمیمِ `watchdog` سیم‌کشی شده. *چرا:* یک سامانهٔ معاملاتی که بی‌صدا شکست می‌خورد بدتر از سامانه‌ای است که با صدای بلند شکست می‌خورد. چیزی را که نمی‌توانی ببینی نمی‌توانی اداره کنی؛ رصدپذیری به‌عنوانِ یک زیرسیستمِ درجه‌یک تلقی می‌شود، نه یک فکرِ بعدی.

#### اصلِ ۸ — بازتولیدپذیری و انضباطِ MLOps
زیرسیستمِ ML از اعتبارسنجیِ **purged K‑fold** با embargo (برای کشتنِ نشتِ نگاه‌به‌آینده روی برچسب‌های هم‌پوشان)، **کالیبراسیونِ** احتمال، یک **آشکارسازِ drift**، متریک‌های مالی (انتظارِ ریاضی، فاکتورِ سود، شارپ، حداکثرِ افت)، ردیابیِ تجربه در **MLflow** و جریان‌های بازآموزیِ ارکستره‌شده با **Prefect** استفاده می‌کند. *چرا:* MLِ مالی میدانِ مینِ نشت‌های ظریف و بیش‌برازش است. دقتِ پژوهشی ساختاری کدگذاری می‌شود تا یک مدلِ «خوب» به دلایلِ درست خوب باشد.

### ۱.۵ مقیاسِ سامانه

| بُعد | تعداد | یادداشت |
|---|---:|---|
| خطوطِ پایتون | **≈ ۶۴٬۵۷۸** | اندازه‌گیری‌شده در `src/` |
| ماژول‌های بک‌اند (حوزه‌های مرزبندی‌شده) | **۱۹** | `api`، `signals`، `analysis`، `ml`، `risk`، `backtest`، `launch`، `bot`، `data`، `core`، `bazaarnama`، `instagram`، `publish`، `llm`، `news`، `seo`، `academy`، `analytics`، `copy` |
| فرانت‌اندهای React | **۵** | website، admin، user، academy، ig |
| مهاجرت‌های Alembic | **۴۱** | `alembic upgrade head` هنگامِ استقرار |
| مجموعه‌تست‌ها | **۲۹** | `tests/test_phase*.py` (۱۵ فازِ توسعه) |
| سرویس‌های داکر | **۳۵+** | ۴۶ ورودیِ اعلام‌شده در compose (شاملِ والیوم‌ها) |
| بزرگ‌ترین ماژول‌ها | `api` (۴۲)، `bot` (۴۱)، `core` (۲۱)، `ml` (۱۸)، `signals` (۱۴)، `risk` (۱۳) | تعدادِ فایل در هر پوشه |

تاریخچهٔ توسعه **۱۵ فاز** را با یک پیکرهٔ تجمیعیِ تست در بر می‌گیرد که نشان‌دهندهٔ یک ساختِ تدریجیِ تست‌محور است، نه یک ساختِ یکبارهٔ بزرگ.

### ۱.۶ معماریِ کلان — یک پیمایشِ روایی

در بالاترین سطح، داده **از چپ به راست** در سامانه جریان می‌یابد، در حالی که کنترل و رصدپذیری **از بالا به پایین** جریان دارند. چهار نوارِ افقی را تصور کنید:

۱. **جهانِ بیرونی** در بالا می‌نشیند: منابعِ دادهٔ بازار (yfinance و سایر کانکتورها از طریقِ زنجیرهٔ failover)، تلگرام، اینستاگرام و بروکر (MT5).
۲. **نوارِ دریافت و تصمیم** هستهٔ معامله است: `data-feed` تیک/کندل را اعتبارسنجی و منتشر می‌کند، `signal-engine` تحلیل ← ML ← ریسک را تا یک حکم اجرا می‌کند، `ml-inference` امتیازِ مدل را سرو می‌کند و `signal-tracker` هر ایدهٔ بازرا در چرخهٔ TP/SL/سربه‌سر/تریلینگ دنبال می‌کند.
۳. **نوارِ سرویس و API** بافتِ پیوندی است: `api` (FastAPI) نقاطِ REST + WebSocket را برای هر پنج فرانت‌اند و ربات در معرض می‌گذارد، `claude-llm` دروازهٔ Anthropic برای هر قابلیتِ AI است و `chart-renderer` تصاویرِ چارتِ سمتِ‌سرور را تولید می‌کند.
۴. **نوارِ ماندگاری و لبه** در پایین می‌نشیند: **TimescaleDB** هایپرتیبل‌های کندل/تیک و همهٔ دادهٔ رابطه‌ای را ذخیره می‌کند؛ **Redis** باسِ قیمتِ زنده و کش است؛ **nginx** تله TLS را پایان می‌دهد و به هر زیردامنه مسیریابی می‌کند؛ **mediamtx**/**coturn** استریم‌های زندهٔ WebRTC را حمل می‌کنند.

به‌صورتِ متقاطع از میانِ همهٔ نوارها، ورکرهای **Celery** (صف‌های جدا)، استکِ **رصد** (Prometheus/Grafana/Loki/Promtail/cAdvisor/node‑exporter/Flower)، استکِ **MLOps** (MLflow/Prefect/flow‑runner) و واچ‌داگِ **خودترمیم** عبور می‌کنند.

```
╔══════════════════════════════════════ جهانِ بیرونی ════════════════════════════════════════╗
║   دادهٔ بازار (yfinance / کانکتورها)   │   تلگرام   │   اینستاگرام   │   بروکر (MT5)         ║
╚════════════╤════════════════════════════════════╤═════════════╤═══════════════╤═════════════╝
             │ تیک + کندل                          │ به‌روزرسانی   │ DM / پست      │ سفارش / فیل
        ┌────▼─────┐                          ┌────▼──────┐  ┌───▼────────┐  ┌───▼─────────────┐
        │ data-feed│  اعتبارسنجی → ذخیره       │ bot-worker│  │ ig-worker  │  │  ایجنتِ کپی       │
        │ (تیک،    │  زنجیرهٔ failover         │ (aiogram3)│  │ (چنداکانتی)│  │ (ویندوز / MT5)   │
        │  OHLCV)  │                          └────┬──────┘  └───┬────────┘  └───▲──────────────┘
        └────┬─────┘                               │             │              │ سیگنالِ تأییدشده
   price:* ┌─▼──────────────────── REDIS (pub/sub + کش) ──────────▼─────────────┼──────────────
  ┌────────┤  کانال‌ها: price:{symbol} · توزیعِ سیگنال · ریت‌لیمیت · سشن‌ها        │
  │        └─┬───────────────────────────┬───────────────────────────┬──────────┘
  │   ┌──────▼────────┐          ┌────────▼─────────┐        ┌─────────▼──────────────────────┐
  │   │ signal-engine │  امتیاز  │  ml-inference     │        │        api  (FastAPI)           │
  │   │ تحلیل ←       │◄────────►│ XGBoost+LightGBM  │        │  REST + WebSocket برای ۵ SPA +  │
  │   │ ML ← ریسک ←  │          │ (+LSTM اختیاری)   │        │  ربات · auth · ریت‌لیمیت · CORS │
  │   │ حکمِ سیگنال   │          └───────────────────┘        └───────┬─────────────────────────┘
  │   └──────┬────────┘                                                │
  │          │ نوشتنِ سیگنال                          ┌────────────────┼──────────────┬───────────┐
  │   ┌──────▼────────────┐                     ┌──────▼────┐  ┌────────▼───────┐  ┌───▼────────┐
  │   │  signal-tracker   │  TP1/TP2/TP3        │ website   │  │ academy +      │  │ user / ig  │
  │   │  SL · سربه‌سر ·    │  تریلینگ · P&L      │ (SEO/CMS) │  │ بازارنما        │  │ + admin    │
  │   │  تریلینگ‌استاپ     │  واقعی (کمیسیون/سواپ)│           │  │ (چارت+نما)      │  │ پنل‌ها     │
  │   └──────┬────────────┘                     └───────────┘  └────────────────┘  └────────────┘
  │          │
  │   ┌──────▼──────────────────────────────────────────────────────────────────────────────────┐
  └──►│ TimescaleDB  ·  هایپرتیبلِ کندل/تیک · سیگنال‌ها · دانشجویان · IG · محتوا · آنالیتیکس      │
      └─────────────────────────────────────────────────────────────────────────────────────────┘

  متقاطع (در همهٔ نوارها):
    Celery   →  celery-worker (critical/عمومی) · celery-ml-worker (ml) · celery-ig-worker (ig) · celery-beat
    AI       →  claude-llm (دروازهٔ Anthropic)  ·  chart-renderer (Chromium بدونِ‌هد / Playwright)
    لبه       →  nginx (TLS + مسیریابی) · nginx-reloader · mediamtx + coturn (WebRTC) · certbot · mt5
    رصد       →  prometheus · grafana · loki · promtail · cadvisor · node-exporter · flower · watchdog
    MLOps    →  mlflow · prefect · flow-runner
```

ویژگیِ تعیین‌کنندهٔ این نمودار **جداسازی با ستون‌فقرات‌های مشترک** است: سرویس‌ها هرگز در شبکه‌های درهم‌تنیده مستقیماً همدیگر را صدا نمی‌زنند؛ آن‌ها در دو ستون‌فقراتِ خوش‌تعریف به هم می‌رسند — Redis (سریع، گذرا، بی‌درنگ) و TimescaleDB (بادوام، قابلِ‌پرس‌وجو، تاریخی) — و هر چیزِ دیگر یک برگ است که می‌تواند بدونِ سقوطِ تنه از کار بیفتد.

### ۱.۷ فلسفهٔ طراحی، چکیده‌شده

اگر کلِ پلتفرم باید در پنج جمله فشرده می‌شد، این‌ها بودند:

۱. **بی‌رحمانه تجزیه کن** تا هیچ زیرسیستمِ غیرمعاملاتی نتواند مسیرِ معامله را تخریب کند.
۲. **صف‌ها را جدا کن** چون مسیرِ بحرانیِ معامله لاینِ خودش را با خون به دست آورد.
۳. **معاملهٔ زنده را پشتِ اثبات قفل کن** چون سرمایهٔ واقعی شایستهٔ یک ارتقای کاغذ‌تأییدشده و divergence‑چک‌شده است، نه یک دکمهٔ امیدوارانه.
۴. **secrets را رمز کن و دارایی‌ها را خودمیزبان کن** چون کاربران پشتِ شبکه‌های خصمانه زندگی می‌کنند و داده حساس است.
۵. **همه‌چیز را رصدپذیر کن** چون یک سامانهٔ الگوریتمی که نمی‌توانی تماشایش کنی، سامانه‌ای است که نمی‌توانی به آن اعتماد کنی.

هر آنچه در ادامهٔ این مستند می‌آید — خطِ لولهٔ سیگنال، زیرسیستمِ ML، موتورِ ریسک، پنج اپِ وب، بازارنما، ربات و اتوماسیونِ رشد — بسطِ همین پنج تعهد است.

---

[🏠 Home · خانه](../README.md) · [2. System Architecture & Service Topology ➡](architecture.md)
