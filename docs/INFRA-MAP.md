# 🗺️ نقشهٔ زیرساختِ Pro-Chart (خروجیِ فازِ M1)

> وضعیت: ✅ **کامل** — هر ۳ سرورِ لینوکسیِ دخیل + سرورِ مرکزی از داخل ممیزی شدند؛ سرورِ MT5 شناسایی شد (کانتینرِ Wine روی فارکس).
> همهٔ ممیزی‌ها ۱۰۰٪ فقط-خواندنی بوده‌اند. تنها تغییرات: افزودنِ کلیدِ SSHِ سرورِ مرکزی به ۳ سرور + تنظیمِ رمزِ root کریپتو — **هر دو با تأییدِ صریحِ مالک** (پایینِ سند).

## موجودیِ هتزنر (۲۰۲۶-۰۷-۰۱)

| نامِ هتزنر | نقش | id | سایز | IP عمومی | SSH | ممیزی |
|---|---|---|---|---|---|---|
| TraydeYar-Bot | **کریپتو (سرور ۱)** — رباتِ TradeYar / سیگنال + کپی‌تریدِ LBank | 138390751 | cpx52 — ۱۲c/۲۴GB/۴۸۰GB | 91.107.245.191 | 1367 | ✅ |
| CoinePro-FX | **فارکس + آکادمی + MT5 (سرور ۲)** — `fx.trade-future.ir` | 133765432 | cpx42 — ۸c/۱۶GB/۳۲۰GB | 91.107.160.235 | 1367 | ✅ |
| CoineproFX-Win-Base | **ویندوزِ کپی‌تریدِ فارکس (سرور ۳) — زنده و فعال** (`WIN-GMJGNU3M9FH`) | 144735169 | cx43 — ۸c/۱۶GB/۱۶۰GB | 91.107.186.20 | RDP 3389 + WinRM 5985 | 🟡 از بیرون+فارکس؛ درونِ‌OS منتظرِ رمزِ Administrator |
| Po-Chart | **هابِ اپ (سرور ۴)** — `pro-chart.com` (استکِ این ریپو) | 143926687 | cpx42 — ۸c/۱۶GB/۳۲۰GB | 91.107.181.124 | 1367 | ✅ |
| App-Central-Server | **مرکزی (سرور ۵)** — هدفِ M2 (Auth + DB مرکزی) | 146981310 | cpx42 — ۸c/۱۶GB/۳۲۰GB | 91.107.183.210 | 1367 | ✅ |
| Germani-Server | ⛔ **خارج از محدوده** (دستورِ مالک) — دست نمی‌زنیم | 142802373 | cx23 — ۲c/۴GB/۴۰GB | 91.107.179.84 | 22 | — |

همه Ubuntu 24.04، وضعیت running. **SSHِ همهٔ سرورهای پروژه روی پورتِ 1367** (کریپتو/فارکس/هاب/مرکزی).

### ✅ شبکهٔ خصوصیِ Hetzner (ساخته‌شده ۲۰۲۶-۰۷-۰۲ — با مجوزِ مالک)

شبکهٔ `prochart-internal` (id=12401217، رنج `10.10.0.0/16`، سابنت `10.10.1.0/24`، zone=eu-central). هر ۵ سرور وصل شدند (بدونِ ریبوت):

| سرور | IP خصوصی |
|---|---|
| App-Central-Server (مرکزی) | **10.10.1.1** |
| Po-Chart (هاب) | **10.10.1.2** |
| CoinePro-FX (فارکس) | **10.10.1.3** |
| TraydeYar-Bot (کریپتو) | **10.10.1.4** |
| CoineproFX-Win-Base (ویندوز) | **10.10.1.5** |

- اینترفیسِ خصوصی روی لینوکس‌ها خودکار (DHCP) بالا آمد؛ تأیید شد هاب → مرکزی روی `10.10.1.1` می‌رسد.
- `central-auth` علاوه بر 127.0.0.1، روی `10.10.1.1:8100` هم bind شد (پورتِ عمومی همچنان بسته). تست: هاب `http://10.10.1.1:8100/health` و JWKS را می‌گیرد.
- ✅ ویندوز (10.10.1.5): NIC خصوصی روی «Ethernet 2» بالا است (با WinRM تأیید شد؛ ICMP به‌خاطرِ فایروالِ ویندوز بسته است، ولی اینترفیس فعال است).

### ⚠️ یافته‌های امنیتیِ سطحِ ابر (باقی‌مانده)

1. **هیچ Firewall ابریِ هتزنر نیست** — پورت‌های 80/443/1367/3389/5985 مستقیم روی اینترنت. (پیشنهادِ بعدی با تأیید.)
2. ولیوم و Load Balancer وجود ندارد؛ بکاپِ جدا از دیسک فقط روی هاب (Google Drive) هست.
3. یک کلیدِ SSH در پنل ثبت است: `prochart-rescue`.
4. **ورودِ root با رمز:** به تصمیمِ مالک باز می‌ماند (سخت‌سازی رد شد).
5. WinRM (5985، غیرِTLS) و RDP روی ویندوز به‌صورتِ عمومی باز است — کاندیدای محدودسازی با فایروال به IP مالک/شبکهٔ خصوصی.

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
- **🎯 MT5ِ روی Wine (فقط مَستر/سیگنال):** کانتینرِ `coinepro-fx-mt5-1` روی **Wine + Selkies + GPU** — دسکتاپِ MT5 را استریم می‌کند (mediamtx/coturn). پلِ EA با `EA_TOKEN`/`API_URL`. **این مَستر/تولیدِ سیگنال است؛ اجرای واقعیِ کاربران روی سرورِ ویندوز است (پایین ↓).**
- **استریمِ چارت/مدیا:** `chart-renderer` (8086), `mediamtx` (1935/8888/8189udp), `coturn` (3478/5349)
- **آکادمی/سایت:** `frontend-academy`, `frontend-website`, `frontend-user`, `frontend-admin` — پشتِ `nginx:alpine` روی 80/443
- **داده:** `timescale/timescaledb:latest-pg16` (5432) + `redis:7` (6379)
- **مانیتورینگ/MLOps:** Grafana/Prometheus/Loki/cAdvisor/node-exporter + **Prefect (4200)** + **MLflow (5000)** + Flower (5555)
- **همزیستیِ استکِ هاب:** روی این سرور `docker-compose.prochart.yml` هم هست (timescaledb pg17 + valkey) — یعنی بخشی از استکِ pro-chart اینجا هم تعریف شده (برای بررسی در M5).
- **`.env` کلیدها:** DB_*, REDIS_*, TELEGRAM_*, **MT5_LOGIN/PASSWORD/SERVER**, **OANDA_*, TWELVEDATA_API_KEY**, JWT_SECRET_KEY

## سرور ۳ — ویندوزِ کپی‌تریدِ فارکس (CoineproFX-Win-Base) 🟡 زنده

> **تصحیحِ M1 (تأییدِ مالک):** این سرور در مسیرِ زندهٔ کپی‌ترید است — اجرای واقعیِ حساب‌های کاربران اینجاست، نه Wineِ فارکس. کلِ کدش در `deploy/windows/` روی سرورِ فارکس است.

**معماریِ واقعیِ کپی‌تریدِ فارکس (از فایل‌های `/home/forex/CoinePro-FX/deploy/windows/`):**
- **EA:** `CoineProAutoTrader.ex5/.mq5` (نسخهٔ ea=1.8) — روی MT5 هر کاربر.
- **عامل:** `coinepro_agent.py` (نسخهٔ agent=39) روی ویندوز؛ هر ۱۲ ثانیه فهرستِ حساب‌های فعال را از `https://fx.trade-future.ir/api` (با `EA_TOKEN`) می‌گیرد و برای هر کاربر یک **ترمینالِ MT5ِ portable ایزوله** با ریسکِ خودش اجرا می‌کند (native، نه Wine → پایدار). به‌صورتِ سرویس (NSSM/Task Scheduler) اجرا می‌شود.
- **مقیاسِ خودکار:** تسکِ `scale_servers` (در `src/copy/tasks.py`) از روی اسنپ‌شاتِ Hetzner (`HETZNER_SNAPSHOT_ID=402568340`) سرورِ ویندوز اضافه/حذف می‌کند؛ هر سرور ~۲۴ کاربر (capacity). فعال‌ساز: `COPY_LIVE_ENABLED=true` (روی فارکس **فعال است**).
- **حسابِ مَستر:** `9991073` (سیگنال‌دِه؛ در SETUP.md).
- **رجیستریِ ناوگان (جدولِ `copy_servers` روی فارکس):** یک سرورِ فعال ثبت است — `WIN-GMJGNU3M9FH` / IP `91.107.186.20` / hetzner_id `144735169` / status=active / capacity=24 / `last_seen` تازه (عامل زنده و در حالِ call-home). جداولِ مرتبط: `trading_accounts` (۱ متصل)، `copy_settings` (۴).
- **دسترسی:** RDP:3389 + **WinRM:5985** باز؛ SSH ندارد. کاربر: `Administrator`. (ممیزی از سرورِ مرکزی با `pypsrp` روی WinRM انجام شد.)

**✅ ممیزیِ درونِ‌OS (۲۰۲۶-۰۷-۰۲، فقط-خواندنی از طریقِ WinRM):**
- **OS/منابع:** Windows Server 2022 Standard، ۸ هسته، ۱۶GB رم (~۱۲GB آزاد)، دیسک C: ۸۷GB مصرف / ۶۵GB آزاد. آپ‌تایم از ۲۴ ژوئن.
- **عامل زنده:** Scheduled Task `CoineProAgent` = Ready؛ فرآیندِ `pythonw` (pid 1932) از ۲۶ ژوئن در حال اجرا (اجرا با `run_agent.bat`/`run_hidden.vbs` + تسک). عامل روی **پورتِ محلیِ 8770** listen می‌کند.
- **MT5:** نصب در `C:\Program Files\MetaTrader 5`؛ **۴ ترمینالِ `terminal64` در حال اجرا** (یکی ~۸۵۴MB = مَستر، بقیه سبک = کاربران).
- **کاربران:** `C:\CoinePro\users` شاملِ **۲۸ پوشهٔ کاربر** (نامشان = شناسه). ⚠️ ولی `trading_accounts` روی فارکس فقط ۱ «connected» دارد → اختلاف؛ احتمالاً پوشه‌های باقی‌مانده از تست/پروویژن. برای M5 بررسی شود.
- **کانفیگِ عامل:** `api_url = https://win.fx.trade-future.ir/api`, `poll=12`, `mt5_dir/users_dir` استاندارد (توکن مخفی).
- **شبکه:** NIC خصوصیِ **10.10.1.5 بالا است** (Ethernet 2) — یعنی شبکهٔ خصوصی روی ویندوز هم فعال شد. NIC عمومی: 91.107.186.20.
- **پورت‌های listen:** 3389(RDP)، 5985(WinRM)، 8770(python/agent)، 139/445(SMB)، 135/RPC. فایروال: هر سه پروفایل روشن.

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
