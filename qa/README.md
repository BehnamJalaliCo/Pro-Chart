# Pro Chart characterization runner

این Runner برای ساخت Evidence قابل‌بازتولید است؛ وجود آن به معنی کامل‌بودن Visual/A11y coverage نیست.

## محدودیت ایمنی

Host پیش‌فرض `https://prochart.local` عمومی نیست و باید داخل container به `127.0.0.1` نگاشت شود. این شرط مانع فعال‌شدن IP canonicalization در `frontend/prochart/src/main.jsx` و خروج ناخواسته آزمون به دامنه عمومی می‌شود. Test همچنین Origin نهایی را assert می‌کند.

بوت فعلی برنامه در context خالی یک درخواست `POST /api/academy/auth/bn-guest` می‌فرستد. بازبینی Source در `src/api/routes/academy.py` نشان می‌دهد این endpoint فقط SID تصادفی و access token می‌سازد و رکورد DB ایجاد نمی‌کند؛ اثر ماندگار آن log سرور است و token فقط در context موقت مرورگر ذخیره می‌شود. Runner همین POST مشخص را مجاز و هر درخواست non-idempotent دیگر را Failure می‌کند. برای flowهای واقعاً stateful باید Backend/DB disposable مستقل ساخت؛ استفاده از live account مجاز نیست.

هیچ Storage/Cookie value در artifact نوشته نمی‌شود؛ فقط نام keyها و metadata Cookie ثبت می‌شود. Query-string valueها نیز Redact می‌شوند.

## نصب قفل‌شده

```bash
cd qa
npm ci --ignore-scripts
npx playwright test --list
```

## اجرای canonical در container

از ریشه Repository:

```bash
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
COMMIT="$(git rev-parse HEAD)"
SOURCE_FINGERPRINT="$(cd frontend/prochart && find . -type f \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/www/*' \
  -not -path '*/android/*' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
docker run --rm \
  --network host \
  --add-host prochart.local:127.0.0.1 \
  --ipc=host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e PROCHART_BASE_URL=https://prochart.local \
  -e BASELINE_COMMIT="$COMMIT" \
  -e BASELINE_SOURCE_FINGERPRINT="$SOURCE_FINGERPRINT" \
  -e BASELINE_RUN_ID="$RUN_ID" \
  -v "$PWD:/work:ro" \
  -v "$PWD/artifacts:/work/artifacts:rw" \
  -w /work/qa \
  mcr.microsoft.com/playwright:v1.61.0-noble \
  npx playwright test tests/baseline.spec.mjs
```

Exit code غیرصفر باید حفظ شود. root canonical فعلی automated pass است، اما nodeهای `incomplete` و Route/Stateهای اندازه‌گیری‌نشده نباید به‌عنوان compliance pass تعبیر شوند؛ retry، exclusion یا mask برای سبزکردن Gate ممنوع است.

## Preview کردن Source بدون Deploy

برای آزمودن تغییرهای Worktree، ابتدا Frontend را در یک copy موقت build کنید و `dist` را با `qa/nginx.preview.conf` روی port 4173 سرو کنید. این config فقط QA است، با `--network host` به API محلی port 8000 proxy می‌کند و نباید وارد image تولید شود. سپس Runner را با `PROCHART_BASE_URL=http://prochart.local:4173` اجرا کنید. در این حالت build فعلی آزموده می‌شود، بدون overwrite کردن `frontend/prochart/dist` یا recreate کردن سرویس live.

## Artifact contract

خروجی domain-specific در مسیر زیر ساخته می‌شود:

`artifacts/qa/baseline/<commit>/<run-id>/<project>-root/`

هر سناریو باید `actual.png`، `aria-snapshot.yml`، `axe.json` و `metadata.json` داشته باشد. هر Trace، Video یا report که آن run واقعاً تولید می‌کند باید پیش از اجرای بعدی به همان run-id منتقل و سپس همه فایل‌ها با `SHA256SUMS` قفل شوند؛ مسیر مشترک به‌تنهایی شاهد آرشیوی نیست و نباید artifact تولیدنشده را در گزارش ادعا کرد.

## مرجع بصریِ قطعی با دادهٔ ساختگی

`tests/visual-reference.spec.mjs` از Runnerِ characterization جداست. این Spec تمامِ `/api/**` را با دادهٔ کاملاً ساختگیِ `fixtures/visual-reference.json` پاسخ می‌دهد، هر Origin بیرونی را می‌بندد، زمان را ثابت می‌کند و دو Screenshot پیاپی را byte-for-byte مقایسه می‌کند. هیچ درخواست API به Backend محلی یا عمومی نمی‌رسد. سه State پوشش داده می‌شوند:

- چارت دسکتاپ؛
- آنبوردینگِ بار اول موبایل؛
- چارت موبایل پس از آنبوردینگ.

حالتِ Capture فقط Evidence کاندید می‌سازد و به معنی تأیید Golden نیست:

```bash
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
COMMIT="$(git rev-parse HEAD)"
SOURCE_FINGERPRINT="$(cd frontend/prochart && find . -type f \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/www/*' \
  -not -path '*/android/*' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"
docker run --rm \
  --network host \
  --add-host prochart.local:127.0.0.1 \
  --ipc=host \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e PROCHART_BASE_URL=http://prochart.local:4173 \
  -e BASELINE_COMMIT="$COMMIT" \
  -e BASELINE_SOURCE_FINGERPRINT="$SOURCE_FINGERPRINT" \
  -e VISUAL_RUN_ID="$RUN_ID" \
  -e VISUAL_CAPTURE_ONLY=1 \
  -v "$PWD:/work:ro" \
  -v "$PWD/artifacts:/work/artifacts:rw" \
  -w /work/qa \
  mcr.microsoft.com/playwright@sha256:57b65fdc9ceabe0ef613124c7bbe2babcf9362c4d85e382fe3b03604e84b428a \
  npx playwright test tests/visual-reference.spec.mjs
```

خروجیِ کاندید در `artifacts/qa/visual-determinism/<commit>/<run-id>/<scenario>/` قرار می‌گیرد و Metadata صریحاً `PENDING_MANUAL_APPROVAL` است. فایل‌های Expected عمداً توسط Capture ساخته نمی‌شوند.

حالتِ پیش‌فرض Fail-closed است: ابتدا وجودِ Golden تأییدشده را بررسی می‌کند و اگر وجود نداشته باشد، پیش از Matcher با خطا متوقف می‌شود؛ بنابراین Playwright هم نمی‌تواند در اجرای عادی Snapshot گمشده را خودکار بسازد. بعد از بازبینی انسانی و انتقالِ آگاهانهٔ کاندید به مسیر `approvedPath` ثبت‌شده در Metadata، همان دستور را بدونِ `VISUAL_CAPTURE_ONLY=1` اجرا کنید. فقط این حالت Expected/Actual/Diff و `maxDiffPixels: 0` را Gate می‌کند. اجرای `--update-snapshots` در CI یا commit کردنِ کاندید بدونِ بازبینی مجاز نیست.
