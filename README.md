<div align="center">

# CoinePro‑FX

### An end‑to‑end, event‑driven algorithmic **Forex** platform — data → decision → execution → growth
### یک پلتفرمِ سرتاسری و رویدادمحورِ معاملاتیِ **فارکس** — داده ← تصمیم ← اجرا ← رشد

<br/>

`FastAPI` · `SQLAlchemy 2.0 async` · `TimescaleDB` · `Redis` · `Celery` · `XGBoost / LightGBM / LSTM` · `aiogram 3` · `React 18 + Vite` · `lightweight‑charts v5` · `Anthropic Claude` · `Docker Compose` · `Prometheus / Grafana / Loki` · `MLflow / Prefect`

**≈ 64,500 LOC Python · 19 backend modules · 5 React front‑ends · 41 DB migrations · 29 test suites · 35+ Docker services**

</div>

> **Scope & integrity note / یادداشتِ محدوده و صداقت.** This documentation describes a **real, deployed** system, written directly from the source code. The platform is **Forex‑only** (zero crypto on any product surface). The default `TRADING_MODE` is `paper`; live execution is gated behind explicit divergence + preflight verification. **No secrets, keys, or sessions are committed.** — این مستندات یک سیستمِ **واقعی و مستقر** را مستقیماً از روی کد توصیف می‌کند. پلتفرم **فقط فارکس** است؛ حالتِ پیش‌فرض `paper` است و اجرای زنده پشتِ بررسیِ divergence/preflight قفل است؛ هیچ secret/کلید/سشنی در گیت نیست.

---

## 📚 Documentation — 16 deep, fully bilingual chapters / مستندات — ۱۶ فصلِ عمیقِ کاملاً دوزبانه

Each chapter below is a standalone page under [`docs/`](docs/). Every page is **fully bilingual**: the complete English treatment, then the complete, standalone Persian (فارسی) treatment — grounded in real `file:line` citations, with formulas, code snippets, tables and diagrams. Total: **~830,000 characters** of technical reference.

هر فصلِ زیر یک صفحهٔ مستقل در پوشهٔ [`docs/`](docs/) است. هر صفحه **کاملاً دوزبانه** است: ابتدا شرحِ کاملِ انگلیسی، سپس شرحِ کاملِ مستقلِ فارسی — با ارجاعِ واقعیِ `file:line`، فرمول، قطعه‌کد، جدول و نمودار.

| # | English | فارسی |
|---|---|---|
| 1 | [Executive Summary, Vision & Design Philosophy](docs/overview.md) | [خلاصهٔ اجرایی، چشم‌انداز و فلسفهٔ طراحی](docs/overview.md) |
| 2 | [System Architecture & Service Topology](docs/architecture.md) | [معماریِ سامانه و توپولوژیِ سرویس‌ها](docs/architecture.md) |
| 3 | [The Data Layer — Ingestion, Time‑Series Storage & Caching](docs/data-layer.md) | [لایهٔ داده — دریافت، ذخیره‌سازیِ سری‌زمانی و کش](docs/data-layer.md) |
| 4 | [Market Analysis Engine](docs/market-analysis.md) | [موتورِ تحلیلِ بازار](docs/market-analysis.md) |
| 5 | [The Machine‑Learning Subsystem](docs/machine-learning.md) | [زیرسیستمِ یادگیریِ ماشین](docs/machine-learning.md) |
| 6 | [The Signal Engine — Decision Core & Lifecycle](docs/signal-engine.md) | [موتورِ سیگنال — هستهٔ تصمیم و چرخهٔ عمر](docs/signal-engine.md) |
| 7 | [Institutional‑Grade Risk Management](docs/risk-management.md) | [مدیریتِ ریسکِ نهادی](docs/risk-management.md) |
| 8 | [Backtesting, Walk‑Forward & Live‑Readiness Gating](docs/backtesting.md) | [بک‌تست، اعتبارسنجیِ پیش‌رونده و دروازهٔ آمادگیِ زنده](docs/backtesting.md) |
| 9 | [The API Layer — FastAPI Gateway, Routing, Auth & Real‑Time](docs/api.md) | [لایهٔ API — درگاه، مسیریابی، احراز هویت و بلادرنگ](docs/api.md) |
| 10 | [The Telegram Bot — aiogram Delivery, Onboarding & Access](docs/telegram-bot.md) | [رباتِ تلگرام](docs/telegram-bot.md) |
| 11 | [The Web Front‑Ends & Copy‑Trading](docs/frontends.md) | [اپلیکیشن‌های وب و کپی‌تریدینگ](docs/frontends.md) |
| 12 | [The VIP Academy & BazaarNama (+ NamaScript)](docs/academy-bazaarnama.md) | [آکادمیِ VIP و بازارنما](docs/academy-bazaarnama.md) |
| 13 | [The Instagram Automation Suite](docs/instagram.md) | [سوئیتِ اتوماسیونِ اینستاگرام](docs/instagram.md) |
| 14 | [Content, SEO & AI Growth Engine](docs/content-seo.md) | [موتورِ محتوا، سئو و رشدِ هوشِ مصنوعی](docs/content-seo.md) |
| 15 | [Core Infrastructure & Security Posture](docs/core-security.md) | [زیرساختِ هسته و وضعیتِ امنیتی](docs/core-security.md) |
| 16 | [Observability, Operations & Deployment](docs/observability-ops.md) | [رصدپذیری، عملیات و استقرار](docs/observability-ops.md) |

> 💡 **Tip.** Start with [§1 — Executive Summary](docs/overview.md) for the vision, then [§2 — Architecture](docs/architecture.md) for the service topology, then dive into whichever subsystem interests you. — برای شروع، [فصلِ ۱ — خلاصهٔ اجرایی](docs/overview.md) و سپس [فصلِ ۲ — معماری](docs/architecture.md) را بخوانید.

---

## 🗺️ Repository layout / چیدمانِ مخزن

```
CoinePro-FX/
├── docs/                 # 16 bilingual documentation chapters (this reference)
├── src/                  # ≈64.5k LOC backend (19 bounded contexts)
│   ├── api/  signals/  analysis/  ml/  risk/  backtest/  launch/
│   ├── bot/  data/  core/  bazaarnama/  instagram/  publish/  llm/
│   └── news/  seo/  academy/  analytics/  copy/
├── frontend/             # 5 React SPAs: website, admin, user, academy, ig
├── alembic/versions/     # 41 DB migrations
├── tests/                # 29 test suites
├── nginx/                # edge config per subdomain (TLS via ssl_preread)
├── deploy/  scripts/     # deployment, secret rotation, backups
├── chart-renderer/       # headless Chromium (Playwright) chart images
├── ig-worker/            # multi‑account Instagram worker pool
├── docker-compose.yml    # 35+ services
└── run_*.py              # service entrypoints (data_feed, signal_engine, …)
```

---

## ⚡ Quick start / شروعِ سریع

```bash
cp .env.example .env          # fill in your own values (never commit .env)
docker compose up -d          # bring up the full stack
docker compose ps             # check health
docker compose exec api alembic upgrade head            # run DB migrations
docker compose exec api python -m src.launch.preflight  # live-readiness checks
docker compose logs -f signal-engine                    # follow the decision core
```

> Full operational guide, troubleshooting and deployment model: [§16 — Observability, Operations & Deployment](docs/observability-ops.md). — راهنمای کاملِ عملیات و استقرار: [فصلِ ۱۶](docs/observability-ops.md).

---

<div align="center">

**CoinePro‑FX** — built end‑to‑end: data, decisions, execution, growth.
ساخته‌شده به‌صورتِ سرتاسری: داده، تصمیم، اجرا، رشد.

</div>
