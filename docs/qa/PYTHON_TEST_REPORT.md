# گزارش Clean-room تست Python

وضعیت: `FAIL`
Run canonical: `20260715T011720Z`
Commit مبنا: `080033ae56e3c793ba3a998276cac5daeb969d50`
Snapshot test fingerprint: `80f7eaddcebc5064194a659251d4d6352c7839529853c64eaa10b904c4ac88a4`

## آخرین اجرای قابل‌اجرا پس از اصلاح non-root QA harness

Run: `20260715T054000Z-clean-python-post-docs-harness-fixed`

در QA Dockerfile، نصب pytest با `USER root` انجام و اجرای test با `USER 1000:1000` حفظ شد؛ علت این اصلاح آن بود که نصب قبلی در `/tmp/.local` با tmpfs اجرای clean پنهان می‌شد. production image هیچ تغییری نکرد.

| مورد | مقدار |
|---|---:|
| Collected | ۲۹۷ |
| Passed | ۲۲۷ |
| Subtests passed | ۴۲ |
| Failed | ۵۰ |
| Error | ۳۲ |
| Skipped | ۰ |
| Exit code | ۱ |

شاهد تازه: `artifacts/qa/python/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T054000Z-clean-python-post-docs-harness-fixed/`؛ علت‌های legacy و فایل/routeهای مفقود حفظ شده‌اند و برای سبزکردن suite حذف یا skip نشده‌اند.

## نتیجه کل suite

| مورد | مقدار |
|---|---:|
| JUnit case | 341 |
| Passed کل | 255 |
| Passed معمولی در console | 216 |
| Subtest passed | 39 |
| Failed | 54 |
| Error | 32 |
| Skipped | 0 |
| Flaky / Retry canonical | 0 / 0 |
| زمان | 11.099s |
| Exit code | 1 |

هیچ failure/error حذف، xfail، skip یا rerun نشده است. Raw failureها در `clean-python/full.log` و `clean-python/results.xml` حفظ شده‌اند.

## محیط و اتصال به Source

- Backend candidate local-only: `prochart-api:qa-backend-080033ae56e3-20260715T011720Z` با image ID `sha256:20bbe4292bbc7a601ef3f77cccf5cceb2ea994063c8928a9077b201e09b82faf`.
- production image عمداً pytest ندارد؛ derived test image فقط `pytest==9.1.1` و `pytest-asyncio==1.4.0` را از `qa/python/Dockerfile` افزود.
- ۱۷۷ فایل `/app/src` در worktree و هر دو image byte-match هستند؛ fingerprint manifest=`2525ece68233049732530995d6460cb7a93632e511bec2722f42c118a6cc7666`.
- ۲۷۰ build input با fingerprint=`ed148f670371f311664027a667d9f7d560f7d1aed983cd0e54b41c2549888787` تا پایان test ثابت ماند.
- Snapshot sanitizeشده read-only، `--network none`، بدون DB/Redis live، بدون pytest cache/bytecode؛ live services/data استفاده نشد.
- Gitleaks پیش از اجرا روی scoped Backend+QA و snapshot clean هر دو finding=0 با Redaction=100% بود؛ اسکن نهایی خود artifact پس از correction exit=1 و سه finding redacted شناسه عمومی `GPG_KEY` base image را بدون waiver حفظ کرد. `pip check` exit=0.

Image و local RepoDigest آن push، deploy، sign یا attest نشده‌اند؛ commit مبنا به‌تنهایی ورودی modified/untracked candidate را بازتولید نمی‌کند.

## دسته شکست‌های حفظ‌شده

| دسته | تعداد | نمونه علت |
|---|---:|---|
| Collection؛ معماری legacy غایب | 12 error | `src.ml`، `src.analysis` و moduleهای risk/backtest/signal/launch مفقود |
| Fixture/setup غایب | 20 error | module/fixtureهایی مانند session/holiday/trailing-stop/symbol config مفقود |
| Backend legacy module/route | 25 failure | engine/tracker/trainer و routeهای risk/launch/backtest/signals/performance |
| Frontend legacy contract | 26 failure | testها tree قدیمی `frontend/admin/` را انتظار دارند، درحالی‌که Panel فعلی canonical است |
| API contract legacy | 3 failure | health آفلاین 503 و `/signals` و `/performance/summary` mount نیستند |

مجموع failureها ۵۴ و errorها ۳۲ است. این دسته‌بندی disposition محصول نیست؛ testهای legacy برای سبزکردن حذف نشده‌اند.

## Sliceهای پاس

- Backend image contract در network-none: ۴۸۹ route object، ۴۸۸ HTTP method/path یکتا، duplicate=0، دو WebSocket؛ auth/live/admin/security middleware checks pass.
- دو GET عمومی exact `/go/lbank` و `/go/oneroyal` در contract حضور دارند و public هستند.
- focused Referral redirect + Bot suite: ۱۳/۱۳ pass، failure/error/skip/retry/flaky=0، زمان 3.441s.
- API security-header regression exit=0؛ runtime HTTPS Frontend عمداً در این suite network-none اجرا نشد و فقط CLI smoke پاس شد.
- `pip check`: PASS.

این PASSهای هدفمند suite کل را سبز نمی‌کنند و سه clean run کامل ایجاد نمی‌کنند.

## Attempt accounting

دو setup failure contract پیش از canonical pass و یک setup failure clean harness پیش از canonical suite در artifact حفظ شده‌اند: `PYTHONPATH` مفقود، synthetic security setting مفقود و تلاش BuildKit برای resolve remote یک digest محلی. Canonical contract تلاش سوم، canonical clean تلاش دوم و هر دو بدون retry پنهان‌کننده اجرا شدند.

## Evidence

## آخرین clean full-suite پس از CHG-040 تا CHG-042

- run=`20260715T082000Z-clean-current`؛ `297` collected، `234` passed، `43` failed، `32` errors، `42` subtests، `0` skipped، exit=`1`.
- API compatibility/health tests اکنون pass شدند؛ Gitleaks، security-header regression و pip check نیز PASS هستند.
- evidence: `artifacts/qa/python/clean-current-20260715T082000Z/`؛ failures legacy حفظ شده‌اند و این run یکی از سه clean run سبز محسوب نمی‌شود.

## اجرای clean پس از CHG-039

- run=`20260715T062500Z-clean-after-signal-increment`؛ image پایه API digest=`sha256:0783fbd9e0d868f4247e5089f8678bff22c8c86cc00d9bfee9f80e641f742d5a`.
- نتیجه: `297` collected، `231` passed، `46` failed، `32` errors، `42` subtests passed، `0` skipped؛ exit=`1`.
- Gitleaks=`0`، security-header regression=`PASS`، pip check=`PASS`؛ دو قرارداد `SignalScorer`/`RiskManager` اکنون در suite pass هستند.
- evidence: `artifacts/qa/python/clean-after-signal-increment/`؛ failureهای legacy حفظ شده و حذف/skip نشده‌اند.

`artifacts/qa/backend-build/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011720Z/`

Artifact شامل build/source manifests، image inspect، contract JSON، focused JUnit، clean Python JUnit/log، package freeze، `pip check`، Gitleaks redacted، live-container before/after و `SHA256SUMS` است. Overall functional-test status metadata=`fail` به‌علت suite Python است؛ security/release Gate نیز مستقل و FAIL می‌ماند.

پس از اجرای اولیه مشخص شد دو `live-containers-*.jsonl` در Command field یک credential live را ثبت کرده‌اند. هر دو field globally sanitize، notice و post-correction scan اضافه و artifact reseal شد؛ مقدار در این گزارش منتشر نمی‌شود. Manifest قبلی superseded است. Bundle نهایی ۹۸ فایل و `SHA256SUMS` با ۹۶/۹۶ entry و SHA-256=`ada5ea790555953760d7f4b2daa41a4bc7c39b4f41af1afcc7e4264072744818` دارد. Raw credential-bearing command pattern در whole-artifacts scan بعدی صفر بود، اما Rotation/Revoke credential همچنان الزامی و `PC-132` `FAIL` است.
