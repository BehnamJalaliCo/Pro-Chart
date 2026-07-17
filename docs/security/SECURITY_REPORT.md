# گزارش امنیت فاز صفر

زمان آخرین به‌روزرسانی: `2026-07-15T01:56:43Z`

وضعیت Release Gate: `FAIL`

هیچ نتیجه زیر به معنی deploy، penetration test کامل، امضا یا تأیید Release نیست.

## Secret scan

ابزار: Gitleaks `8.30.1`، Redaction=100%. هیچ مقدار Secret در این سند ثبت نمی‌شود.

| Scope | نتیجه | تفسیر |
|---|---|---|
| Baseline Git history | ۱ finding generic API key | `FAIL`؛ finding tracked تاریخی باقی است و پاک‌سازی/Rotation/Revoke هماهنگ نشده |
| Baseline Worktree | ۱۶۱ finding: ۱۵۴ generic، ۶ Telegram token، ۱ private key | `FAIL`؛ شامل local/ignored و snapshot اولیه؛ خودکار حذف نشده‌اند |
| Strict current source bounded، run `20260715T015218Z` | ۱٬۲۸۲ فایل، config صریح default-only بدون config/allowlist پروژه، exit=0، finding=0 | `PASS` فقط برای tracked+untracked non-ignored source/config/migration/QA؛ docs/artifacts/ignored/dependency/build output خارج scope‌اند |
| Security-header evidence directory | finding=0 | فقط خود bundle `20260715T012839Z` پس از field-minimize؛ current source/history را پوشش نمی‌دهد |
| Supply-chain evidence directory | exit=1، سه finding redacted تکراری | شناسه عمومی `GPG_KEY` base image در سه raw inspect؛ private-key material شناخته نشد، ولی scanner failure حفظ و waiver Release صادر نشد |
| کل `artifacts/qa` پس از Backend correction، run `20260715T014820Z` | ۲٬۷۲۰ فایل/۲٬۰۸۳٬۹۴۹٬۱۶۱ byte؛ exit=1؛ ۱۹ finding در ۱۶ فایل | review: ۱۱ شناسه عمومی GPG + هشت heuristic tag image محلی + صفر other؛ raw credential-bearing command pattern صفر، scanner failure/no-waiver حفظ |

Strict current-source scan با network=none و manifest source برابر `2b1c8936d24136a44a891cc3d9ef660057380b54c11023905bf13f6de091fe86` در `artifacts/qa/current-source-secrets/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T015218Z/` مهر شده است؛ config ثبت‌شده فقط built-in default ruleهای Gitleaks را extend می‌کند و هیچ allowlist ندارد؛ config/policy پروژه استفاده نشد. Manifest bundle تعداد ۹/۹ entry و SHA-256=`df9a0ab0cb05bd00ffcf5d8b7ab62698f598e9558f1ee96c5c5c2fa40d531dd4` دارد. Run قدیمی `20260715T014323Z` همان manifest را با policy config پروژه اسکن کرده بود و canonical strict نیست.

فایل tracked `.cf` از candidate حذف و در Git/Docker ignore قرار گرفته؛ loader، backup و rotation برای permission/symlink/exclusion سخت‌سازی شده‌اند. این اقدامات finding تاریخی، clone/cacheهای احتمالی، local ignored secrets یا credential واقعی را rotate/revoke نمی‌کنند. بنابراین `PC-132` همچنان `FAIL` است.

در Backend evidence اولیه دو live-container `Command` field حاوی یک credential live بود. هر دو field sanitize، `security-redaction-notice.json` و اسکن redacted post-correction اضافه و artifact دوباره seal شد؛ مقدار credential در این سند یا scan جدید ذخیره نشده است. جست‌وجوی whole-artifacts پس از correction الگوی raw credential-bearing command را صفر ثبت کرد، اما exposure قبلی با حذف artifact خنثی نمی‌شود و Rotation/Revoke آن credential الزامی است. Backend bundle نهایی ۹۸ فایل و manifest ۹۶/۹۶ با SHA-256=`ada5ea790555953760d7f4b2daa41a4bc7c39b4f41af1afcc7e4264072744818` دارد؛ manifest قدیمی superseded است.

Whole-artifacts evidence در `artifacts/qa/all-artifacts-secrets/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T014820Z/` قرار دارد؛ هفت ورودی manifest و SHA-256=`c10dbe064826b87c7fe938a3a5dbb27e01375ca051d289d197c9e6d9f63e40cf`. Result آن `FAIL_REVIEWED_NONSECRET_HEURISTICS` است و به‌دلیل scope detector-only و exposure قبلی fully verified نیست.

اقدام اجباری: Owner credentialها، Rotation/Revoke، انتقال runtime به secret manager/env امن، پاک‌سازی history فقط با برنامه هماهنگ، کنترل clone/cache و سپس اسکن مستقل history/current/runtime/artifact با نتیجه مصوب.

## Dependency، SBOM و provenance

Target دقیق اسکن local-only:

- image ID: `sha256:20bbe4292bbc7a601ef3f77cccf5cceb2ea994063c8928a9077b201e09b82faf`؛
- tag محلی: `prochart-api:qa-backend-080033ae56e3-20260715T011720Z`؛
- RepoDigest گزارش‌شده فقط از Docker Engine محلی است؛ registry lookup/pull/push انجام نشده؛
- Syft `1.44.0`: CycloneDX 1.6 با ۸٬۹۷۱ component؛ SPDX 2.3 با ۳۴۶ package و ۹٬۰۷۵ file؛
- Grype `0.112.0` با DB معتبر point-in-time و scan canonical با network=none.

| Severity | Applicable | Default-suppressed |
|---|---:|---:|
| Critical | 29 | 11 |
| High | 73 | 67 |
| Medium | 97 | 154 |
| Low | 32 | 1 |
| Negligible | 538 | 58 |
| Unknown | 48 | 53 |
| **جمع** | **817** | **344** |

Applicableها ۲۴۲ vulnerability ID یکتا دارند. ۷۸ match record دارای حداقل یک fixed-version candidate است که ۱۱۶ tuple یکتای vulnerability/package/installed/fixed می‌سازد. این اعداد package-to-advisory match هستند، نه exploitability/reachability verdict؛ VEX، reachability و package-owner triage انجام نشده است.

Artifact: `artifacts/qa/supply-chain/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012504Z/`. Image و هر دو SBOM unsigned و unattested هستند؛ registry-published digest وجود ندارد. checksum فقط integrity محلی را نشان می‌دهد. `PC-133` و `PC-162` `FAIL` می‌مانند.

## Security header و DAST

Artifact نهایی: `artifacts/qa/security-headers/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012839Z/`، Source fingerprint=`a58cda730224cf38cec1c27c412cd5a4e99fa753c94c6292eafa8b250d33033d`.

نکته هویت build: این Docker candidate عمداً `NO_OBF=1` دارد و shipping-obfuscated نیست. Image محلی آن `sha256:018cf92e3b491615a9ca8abb5ff14b1326b31a19e8873144f0d27e0a10492456` است؛ build از dirty worktree با فایل‌های untracked انجام شده و clean-checkout reproducibility را اثبات نمی‌کند.

- Nginx syntax و source-to-image config match پاس؛ دو exact Referral location با `access_log off` ثبت شد.
- runtime ایزوله و read-only: ۱۰/۱۰ response case پاس، شامل root، asset، 404، 405، health، manifest، service worker و دو redirect 302؛ header policy در همه یکسان بود.
- referral runtime: مقصد ثابت، query override بی‌اثر، `Cache-Control: no-store` و `Pragma: no-cache`، صفر frontend access-log entry.
- Browser CSP: ۱/۱ PASS، retry/skip/flaky=0؛ Blob Worker/eval لازم کار کرد و script origin غیرمجاز مسدود شد.
- API middleware regression ۱۱ assertion و Referral middleware ۲۳ assertion پاس؛ دو setup failure اولیه در artifact حفظ شده‌اند.
- ZAP 2.17.0 passive/unauthenticated: exit=2 با warning؛ FAIL-NEW=0، FAIL-INPROG=0، High instance=0، Medium=3، Low=11، Informational=29.
- سه Medium باقی‌مانده: wildcard HTTPS در image source، `unsafe-eval` برای compatibility فعلی و `unsafe-inline` style.

این نتیجه `IMPLEMENTED_CANDIDATE_RUNTIME_PASS_DEPLOYMENT_PENDING` و فقط `PARTIAL` است. Active/authenticated scan، CSP reporting/COOP policy و remediation residualها بازند.

Production عمداً deploy/restart نشد: live container/image/start time در طول run ثابت ماند، root=200، تعداد headerهای آزموده‌شده=0 و `/go/lbank` و `/go/oneroyal` هر دو SPA document با 200 برگرداندند. candidate deploy نشده است.

Bundle امنیت ۱۱۶ فایل دارد؛ `SHA256SUMS` تعداد ۱۱۴/۱۱۴ فایل را تأیید می‌کند و SHA-256 نهایی manifest برابر `c851dc0890cc2dc3e81a369e6a06bdf1e843ec5f90c9d3fbbe99afe5aacea3ff` است.

## Gateهای باز

| Gate | وضعیت |
|---|---|
| Secret scan / PC-132 | `FAIL`؛ current-source bounded صفر است، اما history، ignored/runtime stores، Rotation/Revoke و کل artifact universe بسته نشده‌اند |
| Dependency/SBOM / PC-133 | `FAIL`؛ ۲۹ Critical و ۷۳ High applicable و SBOM unsigned |
| Release provenance / PC-162 | `FAIL`؛ registry verification/signature/attestation وجود ندارد |
| Header/DAST / PC-130 | `PARTIAL`؛ candidate High=0 ولی سه Medium، فقط passive/unauthenticated و live بدون header است |
| Python SAST | `NOT_RUN` |
| Container/IaC config scan | `NOT_RUN`؛ SBOM/Grype جای آن را نمی‌گیرد |
| Authorization matrix | `NOT_RUN` |
| Backup/Restore | `PARTIAL`؛ restore baseline پاس ولی RPO/RTO و external rotation jobs مصوب نیست |

تا بستن Gateهای بالا هیچ ادعای VERIFIED یا Release-ready مجاز نیست.
