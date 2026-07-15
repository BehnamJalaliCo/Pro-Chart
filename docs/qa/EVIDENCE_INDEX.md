# فهرست شواهد

آخرین ثبت این اجرا بر پایهٔ ساعت UTC میزبان: `2026-07-15T08:08:21Z`

Commit مبنا: `080033ae56e3c793ba3a998276cac5daeb969d50`

همه نتیجه‌ها به scope همان artifact محدودند. `PASS` یک slice به معنی VERIFIEDشدن Requirement یا deployشدن candidate نیست.

| شناسه | Requirement | شاهد canonical فعلی | نتیجه و محدودیت |
|---|---|---|---|
| SRC-001 | PC-001، PC-004، PC-007 | `docs/source/` و `docs/03_REQUIREMENTS_MATRIX.{csv,json}` | ساختار ورودی PASS؛ ۱۶۲ ID پیوسته، P0=85/P1=77؛ اجرای محصول هنوز `IN_PROGRESS` |
| BASE-DB-001 | PC-135 | backup محدودشده `phase0-20260714T222745Z` و `docs/RELEASE_AND_ROLLBACK.md` | Restore drill ۳۷۹/۳۷۹ table PASS؛ RPO/RTO عدد مصوب ندارد |
| QA-INV-003 | PC-002، PC-003، PC-005، PC-007، PC-133، PC-157، PC-159 | `artifacts/qa/frontend-inventory/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012524Z/` | دو output byte-identical؛ ۲ app/۱۹۷ source/۹ untracked/۸ reachable-untracked؛ route mismatch و static resolution issue صفر؛ ۴ gap High reproducibility؛ static runtime proof نیست |
| QA-JS-003 | PC-003، PC-005، PC-147، PC-159 | `artifacts/qa/javascript/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T013052Z/` | ProChart ۱۸/۱۸ و Panel ۵/۵ PASS؛ اجرای اشتباه `npm test` به‌عنوان harness failure حفظ شده؛ full-system coverage نیست |
| QA-FE-BUILD-003 | PC-133، PC-156، PC-159 | `artifacts/qa/frontend-build/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011751Z/` | shipping-obfuscated، ۱٬۷۸۵ module/۵۳۴ file، fp=`a58cda…33d`؛ Gitleaks scoped=0؛ modified/untracked و deploy/push/sign نشده |
| QA-PANEL-001 | PC-003، PC-005، PC-147، PC-159 | `artifacts/qa/panel-navigation/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T010846Z/` | ۱/۱ browser PASS؛ aliasهای `/signals` و `/visitors` دقیق؛ commandهای unsupported actionable=0؛ source registry/test untracked و full Panel audit باز |
| QA-BE-003 | PC-005، PC-119، PC-121، PC-130، PC-132، PC-156، PC-159 | `artifacts/qa/backend-build/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011720Z/` | image local `sha256:20bbe…2faf`؛ build/source parity و ۴۸۹ route/۴۸۸ method-path PASS؛ overall FAIL به‌علت Python. دو live-container Command field پس از کشف credential sanitize و artifact reseal شد؛ manifest نهایی ۹۶/۹۶ با SHA=`ada5ea…4818`؛ Rotation/Revoke الزامی |
| QA-REF-BE-001 | PC-119، PC-121، PC-126، PC-159 | همان Backend artifact، `focused.log` و `focused-results.xml` | Referral redirect + Bot focused suite برابر ۱۳/۱۳ PASS، retry/skip/flaky=0، network=none؛ undeployed/untracked candidate |
| QA-PY-004 | PC-110، PC-130، PC-132، PC-156، PC-159 | همان Backend artifact، `clean-python/` | ۳۴۱ case: ۲۵۵ pass شامل ۳۹ subtest، ۵۴ fail، ۳۲ error، ۰ skip؛ `pip check` و API header regression pass؛ overall FAIL |
| QA-BRW-003 | PC-002، PC-009، PC-146، PC-153، PC-159 | `artifacts/qa/baseline/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011904Z/` | ۲/۲ PASS، retry/skip/flaky=0، fp=`a58cda…33d`، network/runtime errors=0؛ Desktop contrast incomplete=33؛ full route/manual audit باز |
| QA-BRW-HARNESS-001 | PC-159 | `artifacts/qa/baseline/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011842Z/` | تلاش host-run به‌علت resolveنشدن `prochart.local` پیش از product assertion FAIL و صریحاً harness-only/superseded ثبت شد |
| QA-A11Y-005 | PC-146–150، PC-159 | `artifacts/qa/a11y-matrix/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011941Z/` | ۵/۵ state موبایل PASS؛ WCAG/structure violation=0؛ ۱۶۳ node contrast incomplete؛ compliance claim نیست |
| QA-INT-002 | PC-003، PC-147، PC-148، PC-159 | `artifacts/qa/interactions/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012351Z/` | شش case هدف PASS + شش device skip عمدی؛ Watchlist mouse/keyboard و onboarding focus؛ walkthrough کامل P0 نیست |
| QA-MOT-006 | PC-030 | `qa/tests/drawing-history.test.mjs`، `qa/tests/drawing-history-e2e.spec.mjs` و `artifacts/qa/playwright/test-results/drawing-history-e2e-MOT-00-08fbe--persistence-survive-reload-chromium-desktop/` | Property برابر 3/3 PASS؛ E2E برابر 1/1 PASS در 12.7s: 50 create + 50 toolbar undo + 50 toolbar redo، state دقیق، reload hydration و post-reload create/undo؛ retry/flaky=0 |
| QA-REF-UI-001 | PC-118–123، PC-126، PC-147، PC-159 | `artifacts/qa/referral-compliance/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012118Z/` | ۴/۴ LBank/OneRoyal در desktop/mobile PASS؛ متن/ترتیب/keyboard gate و فقط `/go/*`؛ direct bypass/window.open=0؛ undeployed/untracked candidate |
| QA-VIS-003 | PC-153–155، PC-159 | `artifacts/qa/visual-determinism/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012203Z/`، `.../20260715T012250Z/` و capture-only rerun `20260716T090000Z` | هر run سه pass + سه project skip عمدی؛ candidateهای deterministic؛ Golden تصویب‌شده=۰ و approval دستی pending |
| PERF-003 | PC-138، PC-140، PC-141، PC-159 | `artifacts/qa/performance/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T013244Z/` | FAIL: Desktop LCP=۴۳۴۴ms/frame=۲۸ms و Mobile LCP=۴۱۸۸ms؛ CLS/TTFB/restore و Mobile frame pass؛ RUM نیست |
| PERF-004 | PC-141، PC-159 | `artifacts/qa/quote-commit/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T013516Z/` | ۳/۳ `MEASURED_UNGATED`؛ p95 quote→canvas=۱۷۹٫۴ms و quote→next-rAF=۱۹۸٫۷ms؛ visible-pixel/60fps/threshold PASS نیست |
| QA-SEC-003 | PC-128، PC-130، PC-132، PC-159 | `artifacts/qa/security-headers/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012839Z/` | NO_OBF=1 non-shipping candidate؛ ۱۰/۱۰ response و browser ۱/۱؛ ZAP High=0/Medium=3؛ live header=0 و `/go/*`=SPA 200؛ undeployed؛ final Gitleaks فقط evidence-dir=0 |
| QA-SCA-002 | PC-133، PC-159، PC-162 | `artifacts/qa/supply-chain/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T012504Z/` | FAIL: exact image `20bbe…2faf`؛ CycloneDX=۸٬۹۷۱، SPDX=۳۴۶ package/۹٬۰۷۵ file؛ applicable=۸۱۷ شامل ۲۹ Critical/۷۳ High؛ unsigned/unattested؛ Gitleaks evidence-dir exit=1 با ۳ شناسه عمومی GPG تکراری و بدون waiver |
| QA-SEC-SRC-001 | PC-132، PC-159 | `artifacts/qa/current-source-secrets/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T015218Z/` | ۱٬۲۸۲ tracked+untracked non-ignored source/config/migration/QA file؛ config صریح default-only بدون project config/allowlist، network-none، redacted، exit=0/finding=0؛ docs/artifacts/ignored/runtime/history خارج scope و Release pass صادر نشده |
| QA-SEC-ART-001 | PC-132، PC-159 | `artifacts/qa/all-artifacts-secrets/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T014820Z/` | کل `artifacts/qa` پس از correction: ۲٬۷۲۰ file/۲٬۰۸۳٬۹۴۹٬۱۶۱ byte؛ exit=1، ۱۹ finding در ۱۶ فایل = ۱۱ public GPG id + ۸ local image-tag heuristic، other=0؛ raw credential pattern=0، scanner failure/no-waiver حفظ و Rotation/Revoke باز |
| QA-FINAL-001 | PC-004، PC-156، PC-159 | `artifacts/qa/final-verification/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T023416Z/` | ۱۷ manifest canonical و ۱۷۲ JSON پاس؛ source fingerprintها و ۱۱ container محصول ثابت؛ matrix ۱۶۲×۱۹ معتبر؛ result=`PASS_WITH_RELEASE_BLOCKERS` و نه Release/COMPLETE |
| SEC-001 | PC-132 | `docs/security/SECURITY_REPORT.md` و raw baseline redacted در backup محدودشده | FAIL: history baseline finding و Rotation/Revoke/cleanup/صفرشدن اسکن کامل انجام نشده؛ هیچ Secret در سند منتشر نمی‌شود |

## یکپارچگی و provenance

- artifactهای جاری دارای `SHA256SUMS` هستند. Security bundle شامل ۱۱۶ فایل است؛ ۱۱۴/۱۱۴ ورودی manifest تأیید و hash نهایی manifest برابر `c851dc0890cc2dc3e81a369e6a06bdf1e843ec5f90c9d3fbbe99afe5aacea3ff` است.
- Backend corrected bundle شامل ۹۸ فایل است؛ manifest نهایی ۹۶/۹۶ ورودی و SHA-256=`ada5ea790555953760d7f4b2daa41a4bc7c39b4f41af1afcc7e4264072744818` دارد. manifest قبلی superseded است.
- Strict current-source bundle manifest تعداد ۹/۹ ورودی و SHA-256=`df9a0ab0cb05bd00ffcf5d8b7ab62698f598e9558f1ee96c5c5c2fa40d531dd4` دارد؛ source manifest همان `2b1c8936…fe86` است.
- Whole-artifacts secret scan هفت ورودی manifest دارد؛ SHA-256 فایل manifest=`c10dbe064826b87c7fe938a3a5dbb27e01375ca051d289d197c9e6d9f63e40cf`.
- Final phase-0 verification ده ورودی manifest دارد؛ SHA-256 فایل manifest=`2e57655608ce3a4f6bbff87c735549a45533e7ee5fd4e14030ab4f6a7b5d176a`؛ indexهای self-referential مستندات عمداً داخل seal خودشان نیستند.
- checksum فقط تشخیص تغییر محلی است؛ امضا، attestation، registry publication یا provenance ناشر را اثبات نمی‌کند.
- هیچ لینک CI سه-run سبز، registry digest تأییدشده، release signature یا deployment evidence برای candidate فعلی وجود ندارد.
