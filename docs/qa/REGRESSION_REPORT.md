# گزارش Regression

Commit مبنا: `080033ae56e3c793ba3a998276cac5daeb969d50`
وضعیت: `IN_PROGRESS؛ FULL_REGRESSION_GATE_FAIL`

عبارت «صفر Regression» قابل اثبات نیست: suite Python و Performance current fail هستند، Golden تصویب‌شده وجود ندارد، candidate modified/untracked و undeployed است و matrix همه Route/Stateها کامل نیست.

## خلاصه current candidate

| سطح | نتیجه | شاهد |
|---|---|---|
| ProChart JS | ۱۸/۱۸ pass، skip/retry=0 | `javascript/.../20260715T013052Z` |
| Panel JS/navigation | ۵/۵ unit + ۱/۱ browser pass؛ aliasها و commandهای disabled scoped | `javascript/.../20260715T013052Z` و `panel-navigation/.../20260715T010846Z` |
| ProChart build | shipping-obfuscated PASS؛ ۱٬۷۸۵ module/۵۳۴ file؛ release blockers باز | `frontend-build/.../20260715T011751Z` |
| Frontend inventory | deterministic PASS؛ ۴ High reproducibility gap | `frontend-inventory/.../20260715T012524Z` |
| Backend build/contract | build/parity/۴۸۹ route و Referral contract pass؛ artifact overall FAIL | `backend-build/.../20260715T011720Z` |
| Python full suite | **FAIL**: ۲۵۵ pass شامل ۳۹ subtest، ۵۴ fail، ۳۲ error، ۰ skip | همان Backend artifact، `clean-python/` |
| Referral Backend/Bot | ۱۳/۱۳ pass، network-none | همان Backend artifact، `focused-results.xml` |
| Root browser | ۲/۲ pass؛ runtime/network error=0؛ ۳۳ contrast incomplete | `baseline/.../20260715T011904Z` |
| A11y five-state | ۵/۵ pass؛ violation=0؛ ۱۶۳ contrast incomplete | `a11y-matrix/.../20260715T011941Z` |
| Watchlist/onboarding interactions | شش case pass + شش device skip عمدی؛ retry/flaky=0 | `interactions/.../20260715T012351Z` |
| Referral/provider exclusivity | Main ۴/۴ + User ۴/۴؛ scanner روی ۹۹۰ source و ۶۱۷ bundle candidate/live با finding مسدودکننده صفر؛ only `/go/*` | `provider-exclusivity/worktree/20260715T082200Z` و `referral-compliance/.../20260715T012118Z` |
| Visual pair | سه PNG byte-identical در دو run؛ Golden=0 | `visual-determinism/.../20260715T012203Z` و `.../20260715T012250Z` |
| Performance | **FAIL**: LCP هر دو viewport و frame Desktop | `performance/.../20260715T013244Z` |
| Quote characterization | ۳/۳ `MEASURED_UNGATED`؛ visible-pixel/60fps claim نیست | `quote-commit/.../20260715T013516Z` |
| Security-header candidate | ۱۰/۱۰ response + browser ۱/۱؛ ZAP High=0/Medium=3؛ live بدون header | `security-headers/.../20260715T012839Z` |
| Supply-chain | **FAIL**: ۲۹ Critical/۷۳ High؛ unsigned/unattested | `supply-chain/.../20260715T012504Z` |

مسیرهای فوق زیر `artifacts/qa/<name>/080033ae56e3c793ba3a998276cac5daeb969d50/` قرار دارند.

## Browser و interaction

همه runهای ProChart current از fingerprint `a58cda730224cf38cec1c27c412cd5a4e99fa753c94c6292eafa8b250d33033d` و build shipping-obfuscated frozen استفاده کردند. root و پنج state mobile با HTTP 200، `fa/rtl`، fixture synthetic و requestهای fail-closed اجرا شدند؛ unexpected mutation، external/unstubbed request، request/HTTP/page error صفر بود. Axe violation خودکار صفر است، اما ۱۹۶ node incomplete میان root Desktop و mobile matrix نیازمند review دستی‌اند.

Run interaction current Watchlist list/table را برای mouse/keyboard/context/geometry/flag/delete و onboarding را برای initial focus/Tab/Shift+Tab/inert/Escape/restore پوشش داد. این sliceها walkthrough کامل همه workflowهای P0 نیستند.

Referral UI در Main و User Portal هرکدام چهار ترکیب provider/device را با disclosure و eligibility دقیق و action فقط هم‌مبدأ پوشش داد. Scanner commit‌شدهٔ compose-aware نیز source، fixture، asset path، edge و bundle candidate/live هر سه frontend—including `frontend/user` ignored—را با blocking finding صفر پاس کرد؛ QA/test/legacy findings جدا و non-shipping باقی ماندند.

## Failureهای release-blocking

1. Python clean suite: ۵۴ failure و ۳۲ error؛ module/fixture/routeهای legacy و tree قدیمی Frontend مفقود‌اند.
2. Performance current: Desktop LCP p75=۴۳۴۴ms و frame p75=۲۸ms؛ Mobile LCP=۴۱۸۸ms. CLS/TTFB/restore و Mobile frame pass فقط slice هستند.
3. Supply-chain: ۸۱۷ applicable شامل ۲۹ Critical و ۷۳ High؛ SBOM/image فاقد signature/attestation.
4. Secret: current-source bounded finding=0؛ دو credential-bearing Command field در Backend evidence sanitize/reseal و whole-artifacts raw pattern صفر شد، اما exposure قبلی، history/ignored/runtime و Rotation/Revoke بسته نشده؛ `PC-132` FAIL است. Whole-artifacts scanner exit=1 و ۱۹ heuristic reviewed بدون waiver حفظ شد.
5. Reproducibility: فایل‌های functional untracked در ProChart/Panel/Backend candidate؛ commit مبنا به‌تنهایی build را بازتولید نمی‌کند.
6. Visual: Golden تصویب‌شده صفر؛ diff gate و review انسانی وجود ندارد.
7. Production: live deploy/restart نشده؛ security headerهای آزموده‌شده صفر و `/go/*` هنوز SPA 200 است.

## Attempt و flake discipline

Runهای canonical browser/current retry=0 و flaky=0 بودند. Harness/setup failureهای زیر حفظ و از product failure تفکیک شده‌اند: DNS host-run root، دو refinement اولیه Panel، command اشتباه `npm test`، setupهای Backend contract/clean و اولین security browser origin. هیچ threshold، skip یا rerun برای سبزکردن product Gate تغییر نکرد.

## Gate بعدی

ثبت intentional source برای clean-checkout، تعیین disposition suite legacy، remediation LCP/frame، triage Critical/High و Secret history، review دستی A11y/Golden و سپس سه اجرای کامل سبز روی commit تحویلی. تا آن زمان status فقط `IN_PROGRESS` است.
