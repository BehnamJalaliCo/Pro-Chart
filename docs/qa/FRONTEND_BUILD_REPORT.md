# گزارش Build Frontend

وضعیت current ProChart: `PASS_WITH_RELEASE_BLOCKERS`
Run canonical فعلی: `20260715T011751Z`
Commit مبنا: `080033ae56e3c793ba3a998276cac5daeb969d50`
Source fingerprint: `a58cda730224cf38cec1c27c412cd5a4e99fa753c94c6292eafa8b250d33033d`

## Build current ProChart

Build در snapshot ایزوله byte-matched و با فرمان `env -u NO_OBF npm run build` اجرا شد؛ bypass مبهم‌سازی فعال نبود.

| مورد | مقدار |
|---|---|
| Vite | 6.4.3 |
| Module transformed | 1,785 |
| زمان build | 22.87s |
| فایل خروجی | 534 |
| JavaScript | `3,719.88 kB` raw / `1,278.19 kB` gzip؛ SHA-256=`cee49cabb1e68fef79090795abc7c591b5933cef36cc3c771cef5df5078d0549` |
| CSS | `79.85 kB` raw / `15.55 kB` gzip؛ SHA-256=`b2b331f330e02008d07f4a01d954dba672225c75866fa2300799118833435c3e` |
| Index | `5.59 kB` raw / `1.64 kB` gzip |
| Gitleaks | 0 finding برای frozen frontend snapshot + QA harness، Redaction کامل |
| نتیجه | Build PASS؛ warning chunk بزرگ حفظ شده |

این artifact deploy، push، sign یا attest نشده است. ورودی candidate فایل‌های tracked تغییرکرده و functional untracked دارد؛ commit مبنا به‌تنهایی آن را بازتولید نمی‌کند. `dist` کاربر و سرویس live در این run تغییر نکردند.

Evidence: `artifacts/qa/frontend-build/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011751Z/`.

## Panel candidate

Panel candidate جداگانه build شد: ۲٬۳۶۹ module و browser route test ۱/۱ pass. `/signals` به `/ai-signals` و `/visitors` به `/analytics` redirect شدند؛ هفت command unsupported در queryهای آزموده‌شده actionable result صفر داشتند. Source fingerprint=`eaeb57bcf61caf0625fb0312b0faca89e96eacded76a6ee9f4400e972bd0fbde`.

Registry مسیر و test جدید Panel untracked هستند؛ این build نیز deploy نشده و full Panel regression نیست. Evidence: `artifacts/qa/panel-navigation/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T010846Z/`.

## Reproducibility inventory

Inventory فعلی `20260715T012524Z` دو output byte-identical با hash `14cdffdb75430ca2ed2f0b4cbe5a2b707870331758648ff8b71e452010a0e191` تولید کرد:

- ۲ application تحلیل‌شده، ۱۹۷ source؛ ۱۸۸ tracked و ۹ untracked؛
- ۱۴۵ reachable source؛ ۸ reachable-untracked؛
- ۱۵ route غیرwildcard، ۳۵ navigation target و ۹ non-actionable command metadata؛
- unmatched navigation target=0 و static resolution issue=0؛ wildcard به‌عنوان support حساب نشده؛
- ۴ شکاف High reproducibility.

این inventory static است و runtime support، نبود همه dead controlها یا clean-checkout reproducibility را ثابت نمی‌کند.

## Full six-frontend baseline تاریخی

Run `20260714T225500Z` شش tree اعلام‌شده Academy، IG، Panel، ProChart، User و Website را در copyهای موقت build کرد و ۹۰ فایل JS خروجی primary را syntax-check کرد. این شاهد baseline تاریخی است، نه current candidate تمام شش Frontend. Gateهای ثبت‌شده آن همچنان معتبرند:

- Academy/IG/Panel/User lockfile نداشتند؛
- Academy diagnosticهای obfuscator داشت؛
- Website production audit یک High transitive داشت؛
- چند tree legacy ignored/deleted هستند و clone پاک فعلی آن‌ها را بازتولید نمی‌کند.

## Gateهای باز

1. ثبت intentional فایل‌های current candidate و بازتولید از clean checkout؛
2. lockfile و dependency review برای treeهای legacy؛
3. chunk/bundle budget و remediation LCP current؛
4. runtime smoke همه Frontendهای واقعاً supported؛
5. release signing/attestation و سه clean full-suite run.

Build PASS به‌تنهایی `PC-133`، `PC-156` یا Release Gate را عبور نمی‌دهد.
