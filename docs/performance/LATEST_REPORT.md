# آخرین گزارش Performance

زمان: `2026-07-15T01:36:30Z`
Commit مبنا: `080033ae56e3c793ba3a998276cac5daeb969d50`
Source fingerprint: `a58cda730224cf38cec1c27c412cd5a4e99fa753c94c6292eafa8b250d33033d`
Run canonical: `20260715T013244Z`
نتیجه: `FAIL`

این نتیجه nearest-rank p75 از سه تکرار deterministic Chromium lab در هر سناریو است؛ RUM یا field Core Web Vitals نیست. fixture داده/شبکه synthetic است، retry صفر بود و threshold هیچ Gate تغییر نکرد.

## نتیجه Gateها

| معیار lab p75 | Desktop | Mobile | Budget | نتیجه |
|---|---:|---:|---:|---|
| LCP | ۴٬۳۴۴ms از `[4336, 4344, 4308]` | ۴٬۱۸۸ms از `[4084, 4168, 4188]` | `≤2500ms` | **FAIL هر دو** |
| CLS | ۰٫۰۹۲ | ۰٫۰۰۵ | `≤0.1` | PASS هر دو |
| TTFB | ۰٫۸ms | ۰٫۴ms | `<800ms` | PASS هر دو |
| active-chart rAF p95 | ۲۸ms از `[22, 22, 28]` | ۱۹ms از `[19, 19, 19]` | `<20ms` | **Desktop FAIL؛ Mobile PASS** |
| Layout restore پس از Shell | ۱۵۶ms | ۵۸ms | `<2000ms` | PASS هر دو |

هر سه sample هر سناریو به‌علت دست‌کم یک Gate ناموفق `FAIL` ثبت شدند. Playwright شش failure محصول و شش project skip عمدی ناشی از ماتریس دستگاه ثبت کرد؛ retry=0 و هیچ rerun جایگزین نمونه‌های ناموفق نشد.

## تشخیص LCP و bundle

ورودی current candidate از build shipping-obfuscated `20260715T011751Z` بود:

- JavaScript response body: `3,719,876` byte؛ SHA-256=`cee49cabb1e68fef79090795abc7c591b5933cef36cc3c771cef5df5078d0549`؛
- Desktop sample 01: DOMContentLoaded=`3924.9ms`، FCP=`4224ms`، LCP element=`img.pc-launch__logo` و LCP=`4336ms`؛
- run قدیمی با fingerprint متفاوت، JS=`2,129,858` byte، DOMContentLoaded=`118ms` و LCP sample 01=`380ms` داشت.

افزایش حجم entrypoint و تأخیر DOMContentLoaded/FCP با regression LCP همبستگی قوی دارد، اما fingerprint و bytes دو run متفاوت‌اند؛ این مقایسه diagnostic است و علت source/transform مشخصی را اثبات نمی‌کند.

## Characterization مستقیم quote-to-canvas

Run `20260715T013516Z` روی همین fingerprint سه sample هدفمند و retry-free را ثبت کرد:

| معیار aggregate p95 از sample-p95ها | مقدار | وضعیت |
|---|---:|---|
| quote response → تکمیل `fillText` متن دقیق روی canvas اصلی | ۱۷۹٫۴ms | `MEASURED_UNGATED` |
| تکمیل `fillText` → rAF بعدی | ۲۶٫۵ms | `MEASURED_UNGATED` |
| quote response → rAF بعد از draw | ۱۹۸٫۷ms | `MEASURED_UNGATED` |
| Long task در سه sample | ۰ | مشاهده، نه Gate |

این harness correlation ورودی synthetic با فرمان canvas هدفمند را اثبات می‌کند؛ compositor presentation یا visible pixel را اندازه نمی‌گیرد. هیچ budget مصوبی برای این semantic وجود ندارد و threshold cadence `<20ms` به آن منتقل نشده است. بنابراین این نتیجه نه 60fps PASS، نه remediation و نه field-performance claim است.

## اثر بر Requirementها

- `PC-138`: current lab LCP صریحاً fail و RUM نیز مفقود است؛ VERIFIED نیست.
- `PC-139`: INP/RUM اندازه‌گیری نشده است.
- `PC-140`: CLS فقط در این دو fixture پاس است؛ Route/RUM matrix باز است.
- `PC-141`: Desktop frame Gate صریحاً fail است؛ quote characterization آن را سبز نمی‌کند.
- bundle budget، crosshair/input latency، indicator benchmark ۱۰هزار bar، soak/memory، load/fan-out و device/network profile مصوب هنوز بازند.

## Evidence

- Gate و diagnosis current: `artifacts/qa/performance/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T013244Z/`؛ `SHA256SUMS` و Gitleaks scoped=0.
- quote-to-canvas current: `artifacts/qa/quote-commit/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T013516Z/`؛ ۳/۳ expected، skip/unexpected/flaky/retry=0، Gitleaks scoped=0.
- runهای `20260714T235150Z` و `20260715T003612Z` فقط سابقه diagnostic با fingerprint قدیمی‌اند و نتیجه current را supersede نمی‌کنند.
