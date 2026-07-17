# گزارش Baseline دسترس‌پذیری

وضعیت: `AUTOMATED_SLICES_PASS؛ MANUAL_AND_CONTRAST_REVIEW_PENDING`
Commit مبنا: `080033ae56e3c793ba3a998276cac5daeb969d50`
Source fingerprint: `a58cda730224cf38cec1c27c412cd5a4e99fa753c94c6292eafa8b250d33033d`

این گزارش فقط sliceهای خودکار و interactionهای هدفمند candidate undeployed را پوشش می‌دهد. انطباق WCAG 2.2 AA، screen-reader، Reflow 200% و walkthrough کامل تمام Route/Stateهای P0 هنوز اثبات نشده‌اند.

## Root Desktop/Mobile

Run `20260715T011904Z` با Playwright 1.61.0، Chromium pinned، axe 4.10.3، retry=0 و build shipping-obfuscated frozen اجرا شد.

| View | HTTP / lang / dir | axe violation | Incomplete | Runtime/network | نتیجه محدود |
|---|---|---:|---:|---:|---|
| Desktop 1440×900 DPR1، Chart | `200 / fa / rtl` | 0 در همه impactها | ۳۳ node `color-contrast` | page/request/HTTP error و mutation غیرمنتظره=0 | `AUTOMATED_PASS_WITH_REVIEW` |
| Mobile 390×844 DPR2، Onboarding | `200 / fa / rtl` | 0 | 0 | همان، همگی صفر | `AUTOMATED_PASS_SLICE` |

Artifact: `artifacts/qa/baseline/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011904Z/`؛ Playwright=۲/۲ pass، skip/unexpected/flaky/retry=0. تلاش `20260715T011842Z` پیش از assertion محصول به‌علت DNS host-run fail شد و به‌عنوان harness failure حفظ شده است، نه product result.

## ماتریس پنج state موبایل

Run `20260715T011941Z` پنج state `chart`، `watchlist`، `ai`، `markets` و `profile` را با fixture synthetic/fail-closed network اجرا کرد. تمام navigation activationها با focus واقعی و Enter یا Space انجام شدند؛ `lang=fa`، `dir=rtl`، یک `main`، یک H1 درون main و یک navigation assert شد. Result برابر ۵/۵ pass، retry/skip/unexpected/flaky=0 و runtime/network error=0 بود.

| State | Keyboard | H1 | WCAG/structure violation | Contrast incomplete node |
|---|---|---|---:|---:|
| Chart | Enter→Watchlist؛ Space→Chart | Pro-Chart — چارت حرفه‌ای بازارهای مالی | 0 / 0 | 18 |
| Watchlist | Enter | واچ‌لیست | 0 / 0 | 36 |
| AI | Space | سیگنال‌های هوش مصنوعی | 0 / 0 | 36 |
| Markets | Enter | بازارها و اخبار | 0 / 0 | 37 |
| Profile | Space | پروفایل | 0 / 0 | 36 |
| **جمع** |  |  | **0 / 0** | **163** |

`incomplete`ها حذف یا mask نشده‌اند. صفر violation خودکار به معنی pass نهایی کنتراست یا WCAG compliance نیست. Artifact: `artifacts/qa/a11y-matrix/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011941Z/`.

## Keyboard و Focus

Run current `20260715T012351Z` شش case هدف را پاس کرد و شش device/project skip عمدی داشت، بدون unexpected/flaky/retry:

- Watchlist list/table: mouse، Enter/Space، context menu، geometry hover، flag و delete isolation؛
- Mobile onboarding: initial focus، containment، `inert` shell، Tab/Shift+Tab wrap، Escape و focus restore؛
- Desktop first-run: onboarding suppression و shell تعاملی.

Artifact: `artifacts/qa/interactions/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012351Z/`. این coverage walkthrough pointer-free همه workflowهای P0 نیست.

Focused unit regression current نیز ProChart ۱۸/۱۸ و Panel navigation ۵/۵ را در `javascript/.../20260715T013052Z` پاس کرد؛ native Space/hotkey behavior در scope تست باقی است.

## Referral departure accessibility slice

Run `20260715T012118Z` در چهار surface LBank/OneRoyal desktop/mobile موارد زیر را پاس کرد:

- disclosure دقیق و سپس eligibility دقیق پیش از کنترل خروج؛
- submit native تا keyboard acknowledgement disabled؛
- action فقط هم‌مبدأ `/go/lbank` یا `/go/oneroyal`؛
- direct provider bypass و `window.open` برابر صفر؛ OneRoyal Referral-only.

Playwright ۴/۴ pass و skip/unexpected/flaky/retry=0 ثبت کرد. این candidate untracked/undeployed است و redirect Backend جداگانه contract شده؛ full policy/manual accessibility را جایگزین نمی‌کند.

## نگاشت Requirement

| Requirement | نتیجه فعلی | دلیل |
|---|---|---|
| PC-009 | `PARTIAL` | `fa/rtl` روی root و پنج state آزموده‌شده پاس؛ همه Routeها پوشش ندارند |
| PC-146 | `PARTIAL` | violation خودکار صفر؛ ۳۳+۱۶۳ contrast node incomplete و audit دستی/SR/Reflow باز |
| PC-147 | `PARTIAL` | Watchlist، tabها، onboarding و Referral acknowledgement پاس؛ walkthrough همه P0 باز |
| PC-148 | `PARTIAL` | onboarding focus contract پاس؛ سایر Dialog/Popoverها باز |
| PC-149 | `PARTIAL` | incomplete contrast و Theme/عدم اتکا به رنگ نیازمند review دستی است |
| PC-150 | `PARTIAL` | meta viewport خودکار پاس؛ Zoom/Reflow 200% و loss-of-content دستی انجام نشده |

## Gate بعدی

Review دستی ۱۹۶ node incomplete، screen-reader روی مرورگر/OS مصوب، Zoom/Reflow 200%، Dark/high-contrast theme، keyboard walkthrough همه P0 و توسعه matrix به Route/Dialog/Error/Offline/Permissionهای باقی‌مانده. تا آن زمان VERIFIED ممنوع است.
