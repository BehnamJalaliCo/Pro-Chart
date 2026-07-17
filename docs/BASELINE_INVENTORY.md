# Inventory مبنای Pro Chart

وضعیت: `IN_PROGRESS`
Commit مبنا: `080033ae56e3c793ba3a998276cac5daeb969d50`
آخرین به‌روزرسانی: `2026-07-15T01:56:43Z`

این فایل وضعیت مشاهده‌شده را ثبت می‌کند. حضور فایل/route یا PASS یک slice به معنی کامل‌بودن Requirement، reproducibility یا deploy نیست.

## Repository و Runtime

- Stack Backend: Python/FastAPI/SQLAlchemy async، PostgreSQL/TimescaleDB، Valkey، Celery و Alembic.
- Stack ProChart: React/Vite، Zustand، TanStack Query، Lightweight Charts و Capacitor.
- Compose canonical `docker-compose.prochart.yml`: ۱۱ سرویس محصول؛ در evidence Backend current نام/ID/image هر ۱۱ سرویس پیش و پس run ثابت بود.
- API، TimescaleDB، Valkey و Frontend live healthy مشاهده شدند؛ candidateهای این فاز deploy/restart نشده‌اند.
- Worktree اولیه ۶۰۵ entry تغییرکرده داشت و متعلق به کاربر فرض شده است؛ clean checkout با current candidate یکسان نیست.

## API current candidate

Backend image local-only `sha256:20bbe4292bbc7a601ef3f77cccf5cceb2ea994063c8928a9077b201e09b82faf` با ۱۷۷ فایل `/app/src` byte-matched به worktree frozen بررسی شد:

- ۴۸۹ route object؛ ۴۸۸ HTTP method/path یکتا؛ duplicate=0؛
- دو WebSocket: `/live/ws/chat` و `/ws/prices`؛
- ۱۷ مسیر HTTP live شامل ۱۵ مسیر مدیریتی با dependency ادمین؛
- دو GET عمومی exact `/go/lbank` و `/go/oneroyal`؛
- security middleware، auth/core و absence مسیرهای top-level EA contract شدند؛
- application lifespan و live service/data در contract آفلاین اجرا نشد.

Evidence: `artifacts/qa/backend-build/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T011720Z/`. Overall artifact `FAIL` است، چون suite Python هنوز ۵۴ failure و ۳۲ error دارد. Image push/sign/deploy نشده است.

## Frontend source و navigation

Inventory current `20260715T012524Z` tracked baseline و current candidate را جدا کرد. دو serialize مستقل byte-identical با SHA-256=`14cdffdb75430ca2ed2f0b4cbe5a2b707870331758648ff8b71e452010a0e191` هستند.

| معیار current candidate | مقدار |
|---|---:|
| Application تحلیل‌شده | 2؛ Panel و ProChart |
| Source file | 197 |
| Tracked / Untracked | 188 / 9 |
| Reachable / Reachable-untracked | 145 / 8 |
| Route غیرwildcard | 15 |
| Navigation target | 35 |
| Non-actionable command metadata | 9 |
| Unmatched navigation target | 0 |
| Static resolution issue | 0 |
| High reproducibility gap | 4 |

Wildcard به‌عنوان support route شمرده نشده است. این تحلیل static و conservative است؛ runtime support یا نبود کامل dead control/fake success را ثابت نمی‌کند. Academy، IG، User و Website treeهای legacy/ignored/deleted در inventory canonical tracked قابل بازتولید نیستند؛ Compose User همچنان شکاف reproducibility دارد.

Panel candidate دو alias legacy `/signals→/ai-signals` و `/visitors→/analytics` را در browser exact pass کرد و commandهای unsupported scoped actionable result صفر داشتند. Registry/test جدید untracked است؛ full legacy-route crawl باز است.

ProChart build shipping-obfuscated current با fingerprint `a58cda730224cf38cec1c27c412cd5a4e99fa753c94c6292eafa8b250d33033d`، ۱٬۷۸۵ module و ۵۳۴ فایل پاس شد. JS اصلی ۳٬۷۱۹٫۸۸kB raw است؛ modified/untracked input و نبود signature/deploy Gateهای بازند.

## Referral surfaces

- UI reachable در desktop UserPanel و mobile Profile برای LBank و OneRoyal؛
- disclosure دقیق و eligibility دقیق قبل از submit؛
- submit native تا acknowledgement keyboard disabled؛
- action فقط `/go/lbank` و `/go/oneroyal`، direct provider bypass/window.open=0؛
- OneRoyal در surfaceهای آزموده‌شده Referral-only و بدون credential/order UI؛
- Backend مقصدهای ثابت، 302 و no-store/no-cache؛ Bot پس از دو مرحله فقط آدرس داخلی OneRoyal را ارائه می‌کند.

Browser ۴/۴ و focused Backend/Bot ۱۳/۱۳ پاس است، اما فایل‌های جدید untracked و هیچ candidate deploy نشده؛ live `/go/*` هنوز SPA 200 برمی‌گرداند.

## Data و Migration

- ORM اصلی: ۶۶ table؛ Central Auth: ۵ table.
- Alembic: ۴۱ migration خطی، head=`041_bn_ai_signals`.
- `make migrate` مسیر `create_all`/SQL دستی دارد و canonical `alembic upgrade head` نیست؛ این شکاف باز است.
- Restore drill dump کامل در DB موقت ۳۷۹/۳۷۹ table را پاس کرد؛ RPO/RTO تعریف نشده است.

## Test و Evidence فعلی

| سطح | مشاهده current |
|---|---|
| JavaScript | ProChart ۱۸/۱۸ و Panel navigation ۵/۵ pass؛ focused، نه full-system |
| Python | ۳۴۱ JUnit: ۲۵۵ pass شامل ۳۹ subtest، ۵۴ fail، ۳۲ error، ۰ skip؛ focused Referral/Bot=۱۳/۱۳ |
| Root browser | ۲/۲ pass؛ HTTP 200، `fa/rtl`، error/mutation=0؛ ۳۳ contrast incomplete |
| A11y mobile matrix | ۵/۵ pass؛ WCAG/structure violation=0؛ ۱۶۳ contrast incomplete |
| Interaction | شش case هدف pass + شش device skip عمدی؛ Watchlist/onboarding |
| Visual | سه PNG در دو run byte-identical؛ Golden تصویب‌شده=0 |
| Performance | LCP Desktop=۴۳۴۴ms و Mobile=۴۱۸۸ms fail؛ Desktop frame=۲۸ms fail |
| Security header | NO_OBF=1 isolated candidate ۱۰/۱۰ response و browser ۱/۱؛ ZAP High=0/Medium=3؛ live بدون header |
| Supply | ۸٬۹۷۱ component؛ ۸۱۷ applicable شامل ۲۹ Critical/۷۳ High؛ unsigned/unattested |

## Secret و evidence hygiene

Strict current-source bounded scan روی ۱٬۲۸۲ فایل non-ignored و built-in ruleهای Gitleaks finding=0 است، ولی history/local ignored/runtime stores را پوشش نمی‌دهد. در Backend evidence اولیه، دو occurrence از credential-bearing Command field در `live-containers-before.jsonl` و `live-containers-after.jsonl` شناسایی شد؛ هر دو فایل inventory JSONL sanitize، notice/redacted scan اضافه و artifact دوباره seal شد. مقدار در سند منتشر نمی‌شود. Manifest نهایی Backend ۹۶/۹۶ entry با SHA-256=`ada5ea790555953760d7f4b2daa41a4bc7c39b4f41af1afcc7e4264072744818` است؛ artifact ۹۸ فایل دارد. Post-correction artifact scan سه finding redacted شناسه عمومی GPG base image را حفظ می‌کند. Rotation/Revoke credential live همچنان الزامی و `PC-132` `FAIL` است.

## Storage/State مشاهده‌شده

Root characterization فقط نام keyها را ثبت کرد، نه valueها:

- Desktop LocalStorage: `bn_watch_meta`، `bn_workspace`، `brn.toolrail.favorites`، `cp_academy_token`؛
- Mobile LocalStorage: `bn_workspace`، `cp_academy_token`؛
- SessionStorage، IndexedDB name و Cookie در این دو root صفر.

Migration/value قرارداد Storage، authenticated cookie policy، feature/entitlement matrix، همه Dialog/Context/Shortcut/Offline/Error/Permission stateها و WebSocket event inventory کامل نشده‌اند.

## Gate خروج Baseline

Baseline زمانی بسته می‌شود که current candidate از clean checkout قابل بازتولید باشد، crawl Route/State/Control کامل شود، Python/Performance/Security/Supply Gateها بسته شوند، A11y/Golden review دستی انجام شود و سه full clean run متوالی روی commit تحویلی سبز باشند. این Gate عبور نکرده است.
