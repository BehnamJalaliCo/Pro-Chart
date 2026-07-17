# اهداف سطح خدمت Pro Chart

وضعیت: `DRAFT / NOT ENFORCED`  
دامنه فعلی: تعریف Gateهای قابل‌اندازه‌گیری برای Baseline؛ هنوز RUM، Alert و Error-budget production فعال نیست.

این سند SLO را از نتیجه آزمون جدا می‌کند. عددهای زیر هدف محصول‌اند؛ عبور یک اجرای lab یا در دسترس‌بودن سرویس محلی، شاهد تحقق SLO production نیست.

## شاخص‌ها و هدف‌ها

| SLI | دامنه و جمعیت | هدف | پنجره | منبع اندازه‌گیری | وضعیت فعلی |
|---|---|---:|---|---|---|
| LCP | Routeهای عمومی P0، Mobile و Desktop جدا | p75 ≤ 2.5s | rolling 28d | RUM تأییدشده؛ lab فقط regression | RUM موجود نیست |
| INP | تعامل‌های P0، Mobile و Desktop جدا | p75 ≤ 200ms | rolling 28d | RUM + interaction trace تشخیصی | اندازه‌گیری نشده |
| CLS | Routeهای عمومی P0، Mobile و Desktop جدا | p75 ≤ 0.1 | rolling 28d | RUM تأییدشده؛ lab regression | فقط slice آزمایشگاهی |
| TTFB | document/APIهای P0 | هدف < 800ms | rolling 28d | edge/server timing + RUM | production baseline موجود نیست |
| Frame time چارت | Pan/Zoom روی device profile مصوب | p95 < 20ms | هر release candidate | trace قفل‌شده | Gate فعلی FAIL؛ device profile هنوز ADR می‌خواهد |
| Crosshair response | ورودی تا نمایش مقدار متناظر | < 50ms | هر release candidate | User Timing + trace | اندازه‌گیری نشده |
| Quote-to-paint داخلی | دریافت quote معتبر تا frame قابل‌مشاهده | < 100ms | هر release candidate | timestamped synthetic/live-sandbox trace | quote-to-canvas اندازه‌گیری ungated شده؛ visible-pixel اندازه‌گیری نشده |
| Layout restore | Shell-ready تا workspace معمولی قابل‌استفاده | < 2s | هر release candidate | E2E trace | slice آزمایشگاهی پاس؛ matrix ناقص |
| Indicator P0 | افزودن روی 10,000 bar در device profile مصوب | < 500ms | هر release candidate | worker benchmark | اندازه‌گیری نشده |
| Memory stability | chart soak بدون رشد کنترل‌نشده | tolerance نیازمند ADR | هر release candidate | heap/DOM/listener soak | اندازه‌گیری نشده |
| API Availability | document و APIهای P0 به تفکیک endpoint/tenant | هدف نیازمند تصویب Product/SRE | rolling 28d | edge و server telemetry با health dependency | `NOT_DEFINED` |
| Signal Generation Latency | event معتبر بازار تا تولید signal قابل‌مصرف | target و مرز event نیازمند ADR | rolling 28d + release benchmark | timestampهای feed/engine/output | `NOT_MEASURED` |
| Data Feed Freshness | فاصله event-time آخرین quote/candle معتبر تا زمان مشاهده | target جداگانه برای market/session نیازمند ADR | rolling 28d | provider timestamp و ingest/serve telemetry | `NOT_MEASURED` |
| Service availability | stream/alert/workspace write به تفکیک | هدف نیازمند تصویب Product/SRE | rolling 28d | server telemetry | تعریف نشده |

## قواعد اندازه‌گیری

- صدک‌های Web Vitals از کاربران واقعی هدف و برای Mobile/Desktop جدا محاسبه می‌شوند؛ sample کوچک lab با p75 میدانی یکسان تلقی نمی‌شود.
- Route، نسخه release، device class، network class و consent باید همراه event ثبت شوند؛ Secret، payload معاملاتی و PII در telemetry مجاز نیست.
- failure، timeout و درخواست لغوشده از مخرج حذف نمی‌شوند مگر با قاعده ازپیش‌ثبت‌شده و قابل‌ممیزی.
- داده fixture، clock، browser، font، locale، timezone، viewport و device profile در benchmark release قفل و versioned می‌شوند.
- Threshold فقط با ADR و Approval مالک محصول تغییر می‌کند. گردکردن، retry پنهان، حذف outlier یا میانگین‌گیری بین Mobile/Desktop برای سبزکردن Gate ممنوع است.

## Error budget و Release gate

تا وقتی availability target، service boundaries، maintenance policy و telemetry production تصویب نشده‌اند، Error budget عملیاتی `NOT_DEFINED` است و هیچ release نمی‌تواند بر مبنای آن مجاز شمرده شود.

پس از تصویب، بودجه هر SLO برابر `1 - target` در همان پنجره است. مصرف بودجه باید بر مبنای event معتبر و deduplicated محاسبه شود و این سیاست‌ها را enforce کند:

1. Critical/High امنیتی، corruption داده، معامله ناخواسته یا نقض permission مستقل از Error budget، release blocker هستند.
2. عبور از 100٪ بودجه، release قابلیت جدید را متوقف و فقط fix/reliability work را مجاز می‌کند.
3. burn-rate alert کوتاه‌مدت و بلندمدت باید قبل از استفاده production تعریف، تمرین و runbook آن پیوند داده شود.
4. نبود telemetry یا sample کافی نتیجه `NOT_MEASURED` است، نه `PASS`.

## تصمیم‌های باز اجباری

- device و network profile مرجع؛
- مرز و target availability برای document، API، stream، alert و workspace write؛
- حداقل sample و سیاست داده کم‌ترافیک؛
- window/tolerance آزمون memory؛
- RPO/RTO و maintenance exclusion؛
- retention، sampling و consent برای RUM؛
- owner، escalation و runbook هر SLI.

شاهدهای جاری در `docs/performance/LATEST_REPORT.md` و `docs/qa/EVIDENCE_INDEX.md` ثبت می‌شوند؛ این سند خودِ شاهد قبولی نیست.
