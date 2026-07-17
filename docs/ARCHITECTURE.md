# معماری فعلی و مرز هدف

وضعیت: `BASELINED / تصمیم‌های تکمیلی لازم`

## نمای فعلی

```text
Browser/PWA
  ├─ frontend/prochart (Shell چارت و host-based panels)
  ├─ frontend/{website,academy,panel,user,ig}
  └─ Nginx/TLS
        ├─ FastAPI API (۴۸۷ route object؛ ۴۸۶ HTTP method/path؛ ۲ WebSocket)
        │    ├─ PostgreSQL/TimescaleDB
        │    ├─ Valkey/Redis
        │    ├─ data-feed / crypto-ws / finnhub-ws
        │    └─ news-worker / LLM sidecar
        └─ Central Auth مستقل
```

## قواعد معماری تا پایان Baseline

1. بازنویسی کامل یا جابه‌جایی route ممنوع است.
2. هر تغییر ناسازگار باید Characterization test، migration، Feature Flag و Rollback داشته باشد.
3. UI نباید schema خام Provider را مصرف کند؛ قرارداد `MarketDataProvider` مرز هدف است.
4. OneRoyal فقط Referral می‌ماند؛ `BrokerAdapter` بدون Scraping صرفاً Contract/scaffold خواهد بود.
5. Secret فقط در Backend/Vault؛ Browser، Log، Artifact و Screenshot نباید Secret بگیرند.
6. Alembic باید پس از ADR به مسیر canonical migration تبدیل شود؛ `create_all` جای Migration production را نمی‌گیرد.

## شکاف‌های ساختاری قطعی

- فایل اصلی `BazaarNama.jsx` بیش از ۴۰۰۰ خط است و مرزهای module با Build rule enforce نمی‌شوند.
- consumer فعلی `/live/*` پس از contract test mount شد؛ ۶۰ endpoint تعریف‌شده در `admin_instagram.py`، `ea.py` و `trade_history.py` هنوز تا تعیین ownership/consumer/collision/auth mount نیستند.
- شش frontend و دو compose هم‌پوشان، یک مسیر build/release واحد ندارند.
- پنج package فاقد lockfile هستند؛ build reproducible ثابت نشده است.
- CI فعال وب/Backend، OpenAPI/AsyncAPI versioned و typed client وجود ندارد؛ Browser characterization محلی اکنون موجود است ولی در CI عمومی enforce نمی‌شود.
- migration path مستند با migration chain واقعی ناسازگار است.

## مرز هدف، بدون تعهد به Rewrite

- Frontend: Shell، Design System، Chart Core، Data Client، Drawings، Indicators، Workspace، Alerts، Replay/Backtest/Paper، NamaScript، Discovery، Account و Telemetry.
- Backend: Identity، Entitlement، Workspace، Symbol Master، Market/Stream Gateway، Alert، Backtest/Paper، Provider، Referral، Audit و Observability.
- قراردادها: OpenAPI/AsyncAPI versioned، command idempotency، Problem Details، correlation ID و permission check سمت سرور.

انتخاب Modular Monolith یا استخراج سرویس فقط پس از Benchmark و ADR انجام می‌شود.
