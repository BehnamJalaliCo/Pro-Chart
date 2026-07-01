# 🗺️ نقشهٔ زیرساختِ Pro-Chart (خروجیِ فازِ M1)

> وضعیت: ✅ **کامل** — هر ۳ سرورِ لینوکسیِ دخیل + سرورِ مرکزی از داخل ممیزی شدند؛ سرورِ MT5 شناسایی شد (کانتینرِ Wine روی فارکس).
> همهٔ ممیزی‌ها ۱۰۰٪ فقط-خواندنی بوده‌اند. تنها تغییرات: افزودنِ کلیدِ SSHِ سرورِ مرکزی به ۳ سرور + تنظیمِ رمزِ root کریپتو — **هر دو با تأییدِ صریحِ مالک** (پایینِ سند).

## موجودیِ هتزنر (۲۰۲۶-۰۷-۰۱)

| نامِ هتزنر | نقش | id | سایز | IP عمومی | SSH | ممیزی |
|---|---|---|---|---|---|---|
| TraydeYar-Bot | **کریپتو (سرور ۱)** — رباتِ TradeYar / سیگنال + کپی‌تریدِ LBank | 138390751 | cpx52 — ۱۲c/۲۴GB/۴۸۰GB | 91.107.245.191 | 1367 | ✅ |
| CoinePro-FX | **فارکس + آکادمی + MT5 (سرور ۲)** — `fx.trade-future.ir` | 133765432 | cpx42 — ۸c/۱۶GB/۳۲۰GB | 91.107.160.235 | 1367 | ✅ |
| CoineproFX-Win-Base | **ویندوز base (سرور ۳)** — RDP:3389 باز؛ MT5ِ فعال اینجا نیست | 144735169 | cx43 — ۸c/۱۶GB/۱۶۰GB | 91.107.186.20 | RDP 3389 | 🟡 غیرفعال؟ |
| Po-Chart | **هابِ اپ (سرور ۴)** — `pro-chart.com` (استکِ این ریپو) | 143926687 | cpx42 — ۸c/۱۶GB/۳۲۰GB | 91.107.181.124 | 1367 | ✅ |
| App-Central-Server | **مرکزی (سرور ۵)** — هدفِ M2 (Auth + DB مرکزی) | 146981310 | cpx42 — ۸c/۱۶GB/۳۲۰GB | 91.107.183.210 | 1367 | ✅ |
| Germani-Server | ⛔ **خارج از محدوده** (دستورِ مالک) — دست نمی‌زنیم | 142802373 | cx23 — ۲c/۴GB/۴۰GB | 91.107.179.84 | 22 | — |

همه Ubuntu 24.04، وضعیت running. **SSHِ همهٔ سرورهای پروژه روی پورتِ 1367** (کریپتو/فارکس/هاب/مرکزی).

### ⚠️ یافته‌های امنیتیِ سطحِ ابر (فقط گزارش — چیزی تغییر نکرد)

1. **هیچ Firewall ابریِ هتزنر نیست** — پورت‌های 80/443/1367 همه مستقیم روی اینترنت.
2. **هیچ شبکهٔ خصوصیِ هتزنر (Cloud Network) نیست** — ترافیکِ بینِ سرورها از اینترنتِ عمومی می‌رود. پیشنهادِ M2/M5: ساختِ Cloud Network + فایروال (با تأییدِ مالک).
3. ولیوم و Load Balancer وجود ندارد؛ بکاپِ جدا از دیسک فقط روی هاب (Google Drive) هست.
4. یک کلیدِ SSH در پنل ثبت است: `prochart-rescue`.

---

## سرور ۱ — کریپتو (TraydeYar-Bot) ✅

- **میزبان:** `TraydeYar-Bot` — ۱۲c/۲۴GB/۴۸۰GB (قوی‌ترین)؛ آپ‌تایم ۲۳ روز
- **پروژه:** `/home/crypto/tradeyarbot/` — Compose با ۳۰ کانتینر (`tradeyar`)
- **هستهٔ ربات:** ایمیج‌های `tradeyar/bot:3.0.0`, `bot-core:3.0.0` + Celery (scanner/analytics/ml/backtest/priority/beat/notification)
- **سرویس‌های وب:** `tradeyar/api:3.0.0` (127.0.0.1:8000)، `web` (3001)، `user-web` (3002)، `demo-web` (3003)، `landing-web` (3005) — همه پشتِ `tradeyar-nginx` روی 80/443
- **پلِ هوش:** `tradeyar-claude-bridge:3.0.0` (پورتِ داخلی 8765)
- **داده:** `timescale/timescaledb:2.25.2-pg16` (5432) + `pgbouncer` (5433) + `redis:7` (6379)
- **اتوماسیون:** `n8n` (5678)
- **مانیتورینگِ کامل:** Grafana/Prometheus/Alertmanager/Loki/Jaeger/Flower + otel-collector + exporterها (node/redis/postgres)
- **⚠️ نکته:** `docker-socket-proxy` (tecnativa) در حال اجراست — دسترسیِ محدود به داکر سوکت برای اتوماسیون.
- **`.env` کلیدها (مقادیر ندیدم):** REDIS_*, API_SECRET_KEY, WEBHOOK_SECRET, WEB_API_URL, WEB_WS_URL, GRAFANA_*, PG_* — **کلیدِ LBank در ۲۵ خطِ اولِ env دیده نشد؛ احتمالاً پایین‌تر یا در کانتینرِ bot است (برای M5 باید دقیق دربیاید).**

## سرور ۲ — فارکس + آکادمی + MT5 (CoinePro-FX) ✅

- **میزبان:** `CoinePro-FX` — ۸c/۱۶GB/۳۲۰GB؛ آپ‌تایم ۳۴ روز؛ **لودِ بالا (~۴)** چون MT5+ML روی همین سرورند
- **پروژه:** `/home/forex/CoinePro-FX/` — Compose با ۳۴ کانتینر (`coinepro-fx`)
- **هستهٔ فارکس:** `api` (8000), `signal-engine`, `signal-tracker`, `bot-worker`, `ml-inference`, `data-feed`, `watchdog` + Celery (worker/ml-worker/beat)
- **🎯 موتورِ MT5 (مهم برای M5):** کانتینرِ `coinepro-fx-mt5-1` (ایمیجِ `coinepro-fx-mt5`) روی **Wine** اجرا می‌شود (`WINEPREFIX`, `WINEARCH`) — نه سرورِ ویندوزِ جدا. با **Selkies + GPU (NVIDIA)** دسکتاپِ MT5 را استریم می‌کند، خروجی از طریقِ `mediamtx` (WebRTC/RTMP) + `coturn` (TURN/STUN). پلِ Expert Advisor با `EA_TOKEN` و `EA_START_SYMBOL` و `API_URL` کار می‌کند. → **این همان نقطه‌ای است که M5 برای «لایو تریدِ فارکس» باید به آن سیم‌کشی شود.**
- **استریمِ چارت/مدیا:** `chart-renderer` (8086), `mediamtx` (1935/8888/8189udp), `coturn` (3478/5349)
- **آکادمی/سایت:** `frontend-academy`, `frontend-website`, `frontend-user`, `frontend-admin` — پشتِ `nginx:alpine` روی 80/443
- **داده:** `timescale/timescaledb:latest-pg16` (5432) + `redis:7` (6379)
- **مانیتورینگ/MLOps:** Grafana/Prometheus/Loki/cAdvisor/node-exporter + **Prefect (4200)** + **MLflow (5000)** + Flower (5555)
- **همزیستیِ استکِ هاب:** روی این سرور `docker-compose.prochart.yml` هم هست (timescaledb pg17 + valkey) — یعنی بخشی از استکِ pro-chart اینجا هم تعریف شده (برای بررسی در M5).
- **`.env` کلیدها:** DB_*, REDIS_*, TELEGRAM_*, **MT5_LOGIN/PASSWORD/SERVER**, **OANDA_*, TWELVEDATA_API_KEY**, JWT_SECRET_KEY

## سرور ۳ — ویندوز base (CoineproFX-Win-Base) 🟡

- SSH ندارد؛ **RDP روی 3389 باز است.** چون MT5ِ فعال روی کانتینرِ Wineِ فارکس اجرا می‌شود، این سرور احتمالاً نسخهٔ پایه/بکاپِ ویندوزِ MT5 است و در مسیرِ اجرای زنده نیست. برای تأییدِ نهایی: ورودِ RDP و اجرای `scripts/audit/server-audit.ps1` (در فازِ M5 هم‌زمان با کارِ MT5).

## سرور ۴ — هاب (Po-Chart) ✅

- **میزبان:** `Po-Chart` — ۸c/۱۶GB/۳۲۰GB؛ آپ‌تایم ۹ روز؛ پروژه در `/home/bazaarnama/Pro-Chart/app/`
- **۱۰ کانتینر (`prochart`) — دقیقاً استکِ این ریپو:**
  - `prochart-frontend-prochart-1` (nginx) → **80/443** (تنها ورودیِ عمومی)
  - `prochart-api-1` (FastAPI) → 127.0.0.1:8000
  - `prochart-user-frontend`, `prochart-admin-frontend` (پشتِ nginx)
  - `prochart-data-feed-1`, `prochart-crypto-ws-1`, `prochart-news-worker-1`
  - `prochart-claude-llm-1` (sidecar، 8085)
  - `prochart-timescaledb-1` (pg17، 127.0.0.1:5432)، `prochart-redis-1` (valkey8، 6379)
- **بررسیِ بیرونی:** `pro-chart.com` → 200؛ `pro-chart.com/api/health` → 200؛ `/api/docs` → 404.
- **cron:** تمدیدِ خودکارِ certbot (۳:۱۷ شب) + **بکاپِ ساعتیِ Google Drive** (`gdrive_backup.sh`).
- **نکته:** این سرور تنها جایی است که پورت‌های وبش (80/443) روی `0.0.0.0` باز است؛ بقیهٔ سرویس‌ها روی 127.0.0.1 قفل‌اند (خوب).

## سرور ۵ — مرکزی (App-Central-Server) ✅ — هدفِ M2

- **میزبان:** `App-Central-Server` — ۸c/۱۶GB/۳۰۰GB (تقریباً خالی)؛ آپ‌تایم تازه
- **هیچ سرویسِ کاربردی/داکری نصب نیست** — بومِ سفید برای Auth مرکزی + PostgreSQL مرکزیِ اپ (M2). docker باید نصب شود (با تأییدِ مالک).
- فقط SSH روی 1367 باز است. کاربرِ عاملِ Claude: `Hub` (بدونِ sudo).

## شبکه / DNS

- **هر دو دامنه پشتِ Cloudflare** (`pro-chart.com`, `fx.trade-future.ir`) → IP واقعیِ سرور مخفی (خوب). IPهای واقعی در جدولِ بالا.
- **بدونِ شبکهٔ خصوصی:** ارتباطِ بینِ هاب و فارکس/کریپتو الان روی اینترنتِ عمومی + Cloudflare است. برای M2 (اتصالِ Auth/DB مرکزی به هاب) و M5 (فیدِ سیگنال) پیشنهاد می‌شود Cloud Network ساخته شود.

---

## نگاشتِ نقش‌ها (سند ↔ واقعیت)

| نقشِ موردِ نیازِ اپ | کجاست |
|---|---|
| سیگنال + کپی‌تریدِ کریپتو (LBank) | سرور ۱ — `tradeyar-api` + bot |
| سیگنال + کپی‌تریدِ فارکس | سرور ۲ — `coinepro-fx-api` + signal-engine |
| اجرای زندهٔ فارکس (MT5) | سرور ۲ — کانتینرِ Wineِ `coinepro-fx-mt5-1` (نه سرورِ ویندوز) |
| آکادمیِ VIP | سرور ۲ — `frontend-academy` |
| هابِ اپ + API عمومی | سرور ۴ — `prochart-api` پشتِ `pro-chart.com/api` |
| Auth یکپارچه + DB مرکزی (M2) | سرور ۵ — خالی، آماده |

---
*آخرین به‌روزرسانی: ۲۰۲۶-۰۷-۰۱ — Claude (سرورِ مرکزی)، فازِ M1 کامل.*
