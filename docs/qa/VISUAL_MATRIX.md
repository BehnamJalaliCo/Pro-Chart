# ماتریس Visual Baseline

وضعیت: `DETERMINISTIC_CAPTURE_PASS؛ GOLDEN_NOT_APPROVED`
Source fingerprint: `a58cda730224cf38cec1c27c412cd5a4e99fa753c94c6292eafa8b250d33033d`
Run A: `20260715T012203Z`
Run B: `20260715T012250Z`
Latest capture-only rerun: `20260716T090000Z` (3 target pass، 3 intentional project skips؛ Golden ایجاد/تأیید نشد)

در هر run سه سناریوی هدف pass و سه project skip عمدی ناشی از device matrix ثبت شد؛ unexpected/flaky/retry=0. هر سه PNG میان دو run byte-identical هستند. هیچ Expected/Golden ساخته یا به‌روزرسانی نشده و تعداد Golden تصویب‌شده صفر است؛ این شاهد فقط determinism capture را ثابت می‌کند.

## Candidateهای فعلی

| سناریو | Viewport / DPR | SHA-256 PNG در هر دو run | وضعیت |
|---|---|---|---|
| Desktop Chart | 1440×900 / 1 | `70b5e2fe9b408403d326691b57e471da52797cc5f8d4aad716c4e4d8568af631` | byte-identical؛ `NOT_APPROVED` |
| Mobile Onboarding | 390×844 / 2 | `fc57b6ff3237b20978e4b5c7ac5ab91de26308784553bebe1b72e9d5f751e0eb` | byte-identical؛ `NOT_APPROVED` |
| Mobile Chart | 390×844 / 2 | `48aae1ce15fbb3043d5f986418590ed10194a54d02ec9f9656aeb2e78fb03afb` | byte-identical؛ `NOT_APPROVED` |

## متغیرهای قفل‌شده

| متغیر | وضعیت current pair |
|---|---|
| Browser | Playwright 1.61.0 Chromium؛ runner digest=`sha256:57b65fdc9ceabe0ef613124c7bbe2babcf9362c4d85e382fe3b03604e84b428a` |
| Locale / Direction | `fa-IR` / RTL |
| Timezone | UTC |
| Clock | `2026-07-14T12:34:56Z` |
| Data | fixture synthetic `prochart-synthetic-market-v1`، بدون داده production/PII |
| Font | bundle font و load completion پیش از capture |
| API/network | stub/fail-closed؛ unstubbed API، external request، request/HTTP/page error همگی صفر |
| Viewport/DPR | Desktop 1440×900 DPR1؛ Mobile 390×844 DPR2 |
| Retry | صفر |

## ماتریس پوشش

| سطح | Full/current | Loading/Empty/Error/Offline/Reconnect | Dark/High contrast | Dialog/Popover/Tooltip | Golden |
|---|---|---|---|---|---|
| Desktop Chart | Captured | Pending | Pending | Pending | 0 |
| Mobile Chart | Captured | Pending | Pending | Pending | 0 |
| Mobile Onboarding | Captured | N/A برای بخشی از stateها | Pending | Dialog captured؛ سایرها pending | 0 |
| Watchlist | Screenshot A11y/interaction دارد، نه visual Golden matrix | Pending | Pending | Context menu فقط interaction | 0 |
| AI / Markets / Profile | Screenshot A11y دارد، نه visual Golden matrix | Pending | Pending | Pending | 0 |
| Panel navigation | یک Actual screenshot دارد، نه Golden | Pending | Pending | Command palette scoped | 0 |
| Referral LBank/OneRoyal | چهار Actual screenshot compliance دارد، نه Golden | Pending | Pending | departure gate captured | 0 |
| سایر Route/Stateهای P0/P1 | Not captured | Pending | Pending | Pending | 0 |

Screenshotهای A11y/referral/interaction artifactها شواهد state هستند، اما چون Expected تصویب‌شده و diff policy ندارند، به‌عنوان Golden visual regression شمرده نمی‌شوند.

## Evidence

- root current Actual: `artifacts/qa/baseline/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011904Z/`؛
- deterministic pair: `artifacts/qa/visual-determinism/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012203Z/` و `.../20260715T012250Z/`؛
- cross-run proof: `cross-run-comparison.json` در run دوم؛ `allScenariosByteIdentical=true` و `goldenCreatedOrUpdated=false`.
- latest rerun evidence: `artifacts/qa/playwright/` با `VISUAL_RUN_ID=20260716T090000Z`؛ فقط capture determinism، بدون approval دستی.

## Gate خروج

1. review انسانی و approve/reject صریح هر candidate؛
2. ثبت Golden versioned بدون overwrite خودکار؛
3. اجرای Actual/Expected/Diff با threshold مصوب؛
4. تکمیل viewport/theme/motion/Route/State matrix؛
5. سه clean run متوالی روی commit تحویلی.

تا انجام این مراحل `PC-153` و `PC-154` فقط `PARTIAL` و `PC-155` برابر `FAIL` است؛ عبارت «صفر visual regression» قابل اثبات نیست.
