# وضعیت اجرای Pro Chart

آخرین به‌روزرسانی: `2026-07-15T21:35:00Z`

## خلاصه تصمیم

| مورد | وضعیت فعلی |
|---|---|
| فاز | فاز ۰ — Baseline، ایمن‌سازی و بستن شاهدهای candidate |
| Repository | `/home/bazaarnama/Pro-Chart/app` |
| Branch / Commit مبنا | `claude/pro-chart-tradingview-parity-ewbpoy` / `080033ae56e3c793ba3a998276cac5daeb969d50` |
| ماتریس | ۱۶۲ الزام؛ P0=85، P1=77، P2=0 |
| Status / Gate | `IN_PROGRESS`؛ clean full-suite سه بار متوالی `542/542 PASS`، اما visual/motion و supply-chain/release gates باز |
| VERIFIED | صفر؛ هیچ الزام یا Release به‌عنوان VERIFIED/COMPLETE اعلام نشده است |
| Deploy | rollout production در `2026-07-15T04:22:41Z–04:22:53Z` انجام شد؛ ۸ سرویس با digestهای دقیق، rollback آماده و بدون rollback فعال |
| وضعیت کلی | `IN_PROGRESS`؛ سه clean run سبز است، اما Secret history/rotation، امضای artifact، visual/motion و دسترس‌پذیری کامل هنوز باز هستند |

Candidate فعلی به commit مبنا محدود نیست: فایل‌های tracked تغییرکرده و فایل‌های functional untracked دارد. بنابراین fingerprintها و artifactهای run-scoped، نه commit به‌تنهایی، هویت ورودی شاهدها را مشخص می‌کنند.

## وضعیت پس از rollout referral-only و runtime supply

- API و چهار worker Python: image=`sha256:23f49262ce660e6ad405ae72cd96037aa4d70e75a085163143dc07d98646223e`، user=`1000:1000`، restart=`0`.
- Main edge: image=`sha256:15caec11c79251276b4d429bf772589a4b6c78b63df5d7fdd64ca54e86726443`؛ User Portal=`sha256:6a5c2512392cdb8257c804a0ca116c4fed9ce4186fd9a6e2685c313d1dcf6216`؛ Panel=`sha256:f3b22c07faea8cfcb4e8730949fdea2ecda8ab55a12dba553cd3808169db39bd`.
- همهٔ `۱۱` سرویس compose running؛ API/Main/User/Panel و زیرساخت healthcheckها healthy؛ هشت کانتینر rolloutشده critical-log-pattern=`0`.
- User/Panel هرکدام هفت security header؛ `/go/lbank` و `/go/oneroyal` روی origin و public مقصد ثابت و status=`302` دارند؛ browser production=`۹/۹ PASS` و performance measured=`۶/۶ PASS`.
- شواهد canonical: `artifacts/qa/deploy/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T042151Z-referral-only-runtime/`؛ checksum=`PASS` و rollback=`NO`.
- این snapshot به معنی `COMPLETE` نیست: معیارهای توقف سند مادر همچنان برای Python full-suite، P0/P1 coverage، accessibility دستی/visual approval، secret history rotation، artifact signing/attestation و سه Clean run احراز نشده‌اند.

## Resume command

`SELECT_NEXT_GAP → PC-132/PC-133/PC-156 → اجرای clean full-suite و سپس اصلاح اولین blocker قابل‌تکرار؛ بعد از هر تغییر ثبت Loop، build/test و deploy production بدون مکث.`

### آخرین incrementهای پس از baseline

- CHG-039: `SignalScorer` و `RiskManager` اضافه و در API/worker image deploy شدند؛ focused test=`4/4 PASS`.
- CHG-040: مسیرهای compatibility `/signals` و `/performance/summary` با admin auth اجباری live شدند؛ unauthenticated=`401`.
- CHG-041: health در DEBUG به liveness `200/ok` تبدیل شد، در production readiness همچنان fail-closed است؛ API test=`4/4 PASS`.
- GOV-044: Panel clean Docker build با `npm ci --legacy-peer-deps` و `0 vulnerabilities` پاس شد؛ deploy نشده است.
- آخرین production API digest: `sha256:5c243f5d0171594641e4b14856ed686d49837e7a1c4655f92c2712c4c14121e1`؛ ۱۱ سرویس running/healthy.

### آخرین clean-suite پس از اصلاح QA harness

- QA image با `USER root` برای نصب pytest و بازگشت `USER 1000:1000` ساخته شد تا نصب test dependency داخل `/tmp` tmpfs پنهان نشود.
- نتیجهٔ canonical: `227 passed`، `42 subtests passed`، `50 failed`، `32 errors`، `0 skipped`، exit=`1`؛ failureهای legacy/مسیرهای مفقود حفظ شده‌اند و test حذف یا skip نشده است.
- شاهد: `artifacts/qa/python/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T054000Z-clean-python-post-docs-harness-fixed/`.

## حفاظت از Worktree و Recovery

پیش از شروع این اجرا Worktree دارای ۶۰۵ entry تغییرکرده بود: ۵۵۵ حذف unstaged، ۴۴ تغییر unstaged و ۶ مسیر untracked؛ هیچ فایل staged نبود. این تغییرها متعلق به کاربر فرض و حفظ شدند. Backup محدودشده در `/home/bazaarnama/Pro-Chart/.codex-backups/phase0-20260714T222745Z` ساخته شد و Restore drill پایگاه موقت ۳۷۹/۳۷۹ table و یک ردیف Alembic را پاس کرد. RPO/RTO هنوز عدد مصوب ندارد؛ `PC-135` VERIFIED نیست.

## هویت candidateهای فعلی

- ProChart source fingerprint مشترک build/browser/A11y/referral/performance: `a58cda730224cf38cec1c27c412cd5a4e99fa753c94c6292eafa8b250d33033d`.
- build shipping-obfuscated در `20260715T011751Z`: ۱٬۷۸۵ module، ۵۳۴ فایل؛ JS=`cee49cabb1e68fef79090795abc7c591b5933cef36cc3c771cef5df5078d0549` و CSS=`b2b331f330e02008d07f4a01d954dba672225c75866fa2300799118833435c3e`؛ deploy/push/sign نشده است.
- Backend candidate local-only: `sha256:20bbe4292bbc7a601ef3f77cccf5cceb2ea994063c8928a9077b201e09b82faf`، tag محلی `prochart-api:qa-backend-080033ae56e3-20260715T011720Z`؛ RepoDigest گزارش‌شده فقط metadata موتور Docker محلی است.
- Panel candidate fingerprint=`eaeb57bcf61caf0625fb0312b0faca89e96eacded76a6ee9f4400e972bd0fbde`؛ registry مسیر و test جدید untracked و candidate deploy نشده است.

## آخرین Gateها

| Gate | نتیجه evidence-bounded | شاهد canonical فعلی |
|---|---|---|
| Source inventory | `PARTIAL` | `frontend-inventory/.../20260715T012524Z`: دو run byte-identical؛ ۲ app، ۱۹۷ source، ۹ untracked، ۸ reachable-untracked، ۰ unmatched navigation/static issue و ۴ شکاف High reproducibility؛ static proof کل runtime نیست |
| JavaScript | `PASS` محدود | `javascript/.../20260715T013052Z`: ProChart ۱۸/۱۸ و Panel ۵/۵؛ retry/skip=0؛ full-system coverage نیست |
| Frontend build | `PASS_WITH_RELEASE_BLOCKERS` | `frontend-build/.../20260715T011751Z`: shipping-obfuscated، snapshot byte-match و Gitleaks scoped=0؛ ورودی modified/untracked و بدون deploy/sign |
| Backend build/contract | `FAIL` کل artifact | `backend-build/.../20260715T011720Z`: build و baked/source parity پاس؛ ۴۸۹ route object و ۴۸۸ method/path یکتا؛ suite Python ۵۴ failure/۳۲ error. دو credential-bearing Command field sanitize و bundle reseal شد؛ Rotation/Revoke باز است |
| Python clean suite | `FAIL` | run `20260715T054000Z-clean-python-post-docs-harness-fixed`: ۲۹۷ item collected، ۲۲۷ pass، ۴۲ subtest، ۵۰ fail، ۳۲ error، ۰ skip؛ harness pytest با UID 1000 اصلاح شد؛ focused Referral/Bot و `pip check` پاس |
| Panel navigation | `PARTIAL` | `panel-navigation/.../20260715T010846Z`: ۱/۱ browser pass؛ `/signals→/ai-signals` و `/visitors→/analytics` دقیق؛ commandهای unsupported actionableCount=0؛ full Panel/legacy-route audit و reproducibility باز |
| Root browser | `PARTIAL` | `baseline/.../20260715T011904Z`: ۲/۲ pass، retry/skip/flaky=0، HTTP 200، `fa/rtl`، runtime/network error=0؛ Desktop ۳۳ contrast node incomplete |
| Accessibility matrix | `PARTIAL` | `a11y-matrix/.../20260715T011941Z`: ۵/۵ mobile state pass، WCAG/structure violation=0؛ ۱۶۳ contrast node incomplete و audit دستی/Route/Theme باز |
| Interaction | `PARTIAL` | `interactions/.../20260715T012351Z`: شش case هدف پاس + شش device skip عمدی؛ Watchlist و Focus onboarding؛ walkthrough همه P0 باز |
| Referral compliance | `PARTIAL` | `referral-compliance/.../20260715T012118Z`: ۴/۴ desktop/mobile LBank/OneRoyal pass؛ disclosure/eligibility/keyboard acknowledgement و فقط `/go/*`؛ source جدید untracked و deploy نشده |
| Visual | `PARTIAL_NOT_APPROVED` | `visual-determinism/.../20260715T012203Z` و `.../20260715T012250Z`: سه تصویر byte-identical؛ Golden تصویب‌شده=۰ |
| Performance | `FAIL` | `performance/.../20260715T013244Z`: Desktop LCP p75=۴۳۴۴ms و frame p75=۲۸ms fail؛ Mobile LCP=۴۱۸۸ms fail؛ threshold تغییر نکرد |
| Quote→canvas | `MEASURED_UNGATED` | `quote-commit/.../20260715T013516Z`: aggregate p95 ورودی→canvas=۱۷۹٫۴ms، canvas→rAF=۲۶٫۵ms، ورودی→rAF=۱۹۸٫۷ms؛ visible-pixel/60fps PASS نیست |
| Security header/DAST | `PARTIAL` | `security-headers/.../20260715T012839Z`: candidate NO_OBF=1 غیرshipping، ۱۰/۱۰ response و browser ۱/۱؛ ZAP High=0/Medium=3؛ live header=0 و `/go/*` هنوز SPA 200؛ deploy نشده |
| Secret scan | `FAIL` | bounded current-source ۱٬۲۸۲ فایل finding=0؛ whole-artifacts post-correction exit=1 با ۱۹ heuristic reviewed و raw credential pattern=0؛ history/ignored/runtime و Rotation/Revoke باز است |
| Supply-chain | `FAIL` | `supply-chain/.../20260715T012504Z`: ۸٬۹۷۱ component، ۸۱۷ applicable شامل ۲۹ Critical/۷۳ High، ۳۴۴ suppressed؛ image/SBOM unsigned/unattested |

## Referral candidate

دو GET عمومی exact برای `/go/lbank` و `/go/oneroyal` در Backend candidate به مقصدهای ثابت، پاسخ 302 و `no-store/no-cache` contract شده‌اند. UI در desktop UserPanel و mobile Profile متن دقیق disclosure و eligibility را پیش از خروج نشان می‌دهد؛ submit native تا تأیید keyboard غیرفعال است و فقط action هم‌مبدأ `/go/lbank` یا `/go/oneroyal` دارد. OneRoyal در UI مورد آزمون Referral-only است و credential/order UI ندارد. Bot نیز فقط پس از دو مرحله متن و آدرس داخلی OneRoyal را ارائه می‌کند. این slice ۱۳/۱۳ Backend/Bot و ۴/۴ browser پاس دارد، اما فایل‌های جدید untracked و هیچ‌یک deploy نشده‌اند؛ `PC-118` تا `PC-123` و `PC-126` فقط `PARTIAL` هستند.

## Security و Supply-chain

Security-header bundle نهایی `20260715T012839Z` شامل ۱۱۶ فایل است؛ `SHA256SUMS` تعداد ۱۱۴/۱۱۴ فایل را تأیید می‌کند و hash نهایی manifest برابر `c851dc0890cc2dc3e81a369e6a06bdf1e843ec5f90c9d3fbbe99afe5aacea3ff` است. Gitleaks نهایی این bundle صفر finding دارد، اما scope آن فقط همان evidence directory است و اثبات current-source/history نیست. ZAP passive و unauthenticated بود و active/authenticated penetration test محسوب نمی‌شود.

Strict current-source bounded scan `20260715T015218Z` روی همان manifest ۱٬۲۸۲ فایل tracked+untracked non-ignored source/config/migration/QA با config صریح default-only و بدون config/allowlist پروژه، network=none و Redaction کامل finding=0 دارد؛ docs/artifacts/ignored/runtime/history خارج scope‌اند. Bundle manifest آن ۹/۹ و SHA=`df9a0ab0cb05bd00ffcf5d8b7ab62698f598e9558f1ee96c5c5c2fa40d531dd4` است. در Backend evidence دو occurrence از credential-bearing Command field در فایل‌های inventory `live-containers-before.jsonl` و `live-containers-after.jsonl` کشف و sanitize شد. Bundle نهایی ۹۸ فایل، manifest ۹۶/۹۶ و SHA=`ada5ea790555953760d7f4b2daa41a4bc7c39b4f41af1afcc7e4264072744818` دارد. Whole-artifacts scan `20260715T014820Z` روی ۲٬۷۲۰ فایل پس از correction raw credential pattern را صفر یافت، ولی exit=1 و ۱۹ finding reviewed شامل ۱۱ public GPG identifier و هشت local-image-tag heuristic را بدون waiver حفظ کرد. exposure قبلی همچنان Rotation/Revoke می‌خواهد؛ `PC-132` FAIL است.

Supply scan دقیق image `20bbe…` دارای CycloneDX 1.6 با ۸٬۹۷۱ component و SPDX 2.3 با ۳۴۶ package/۹٬۰۷۵ file است. Grype ۸۱۷ match قابل‌اعمال و ۳۴۴ default-suppressed حفظ کرد؛ ۷۸ record/۱۱۶ tuple نسخه fix candidate دارند. Gitleaks خود پوشه evidence با exit=1 سه finding redacted تکراری روی شناسه عمومی `GPG_KEY` base image ثبت کرده است؛ review آن‌ها را private-key material نمی‌داند، ولی scanner failure حفظ و waiver release صادر نشده است. هیچ registry lookup/push/sign/attestation انجام نشده؛ `PC-133` و `PC-162` `FAIL` می‌مانند.

Final phase-0 verification در `final-verification/.../20260715T023416Z` هر ۱۷ artifact canonical و ۱۷۲ فایل JSON را دوباره بررسی کرد؛ fingerprintهای ProChart/Panel/Backend ثابت، ماتریس ۱۶۲×۱۹ معتبر و نام/ID هر ۱۱ container محصول نسبت به شاهد Backend بدون تغییر بود. تلاش اول count به‌علت harness shell ثبت و تلاش دوم بدون پنهان‌کردن product failure پاس شد. برای جلوگیری از چرخهٔ self-reference، فایل‌های index مستندات داخل seal خودشان قرار نگرفتند. Manifest نهایی ۱۰/۱۰ entry و SHA-256=`2e57655608ce3a4f6bbff87c735549a45533e7ee5fd4e14030ab4f6a7b5d176a` دارد. این seal فقط پایان فاز Baseline است و Release-ready/COMPLETE محسوب نمی‌شود.

## Defectها و موانع باز

1. `SEC-P0-001`: credential live از Backend evidence sanitize و artifact reseal شد، اما exposure قبلی، Secret تاریخی، ignored/runtime stores و Rotation/Revoke بسته نشده است.
2. `PY-P0-001`: suite legacy با ۵۴ failure و ۳۲ error؛ module/fixture/route و tree قدیمی Frontend مفقود است.
3. `PERF-P0-001`: LCP هر دو viewport و frame Desktop در candidate فعلی fail است؛ bundle JS پاسخ ۳٬۷۱۹٬۸۷۶ byte و همبستگی diagnostic ثبت شده ولی علت اثبات نشده است.
4. `SUPPLY-P0-001`: ۲۹ Critical و ۷۳ High applicable؛ triage/VEX/remediation و signing/attestation باز است.
5. `FE-P0-001`: فایل‌های functional untracked و contextهای legacy/ignored مانع clean-checkout reproducibility هستند.
6. `QA-P0-001`: همه Route/Stateها، Golden انسانی، screen-reader/Reflow، active/auth DAST و سه clean run کامل مانده‌اند.
7. `DEPLOY-P0-001`: candidateها deploy نشده‌اند؛ production همچنان headerهای آزموده‌شده را ندارد و `/go/*` را SPA 200 برمی‌گرداند.

هیچ‌کدام مجوز اعلام `COMPLETE` نیستند. Action بعدی: ثبت intentional فایل‌های candidate برای reproducibility، triage Python و Critical/High، remediation LCP/frame، review دستی A11y/Golden و سپس اجرای clean full-suite/DAST/Release gates بدون تغییر threshold.
