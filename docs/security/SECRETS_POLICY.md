# سیاست Secret و Credential

وضعیت: `DRAFT / PARTIALLY ENFORCED`  
مبنای کنترل: `v5.0.0-13.1.4` و `v5.0.0-13.3.1` تا `v5.0.0-13.3.4` از OWASP ASVS.

این سند فقط نوع Secret و چرخه آن را ثبت می‌کند. مقدار، fingerprint قابل‌سوءاستفاده، token، private key و recovery code نباید در Source، Build artifact، Log، Screenshot، Trace یا مستندات قرار گیرد.

## طبقه‌بندی و مالکیت نقشی

| کلاس | نمونه کاربرد | محل مجاز هدف | مالک نقش | Rotation حداکثری تا مهاجرت به token کوتاه‌عمر |
|---|---|---|---|---|
| Signing key | JWT/session، webhook signature | Vault/KMS؛ key ring نسخه‌دار | Identity/Security | 90 روز؛ overlap حداکثر برابر بیشینه عمر token |
| Database/cache credential | PostgreSQL، Valkey | secret injection با service identity | Platform/DBA | 90 روز و فوراً پس از تغییر دسترسی |
| Provider API credential | Cloudflare، market/news، Telegram، LLM | Vault؛ scope و environment جدا | Platform/Provider owner | 90 روز یا کمتر طبق Provider |
| Webhook secret | امضای پیام خروجی/ورودی | Vault؛ secret مستقل برای tenant/destination | Backend/Security | 90 روز با dual-secret transition |
| TLS/private key | edge و mTLS | ACME/KMS/HSM؛ هرگز در image | Platform/Security | خودکار پیش از expiry؛ فوری پس از exposure |
| Backup encryption key | dump/config backup | KMS/HSM جدا از backup | SRE/Security | سالانه یا طبق cryptoperiod مصوب؛ exposure فوری |
| Break-glass credential | recovery عملیاتی | vault با approval چندنفره | Security/SRE | پس از هر استفاده و حداقل هر 30 روز بازبینی |

نام فرد و Approver واقعی هنوز باید توسط مالک محصول ثبت شود؛ نقش به‌تنهایی مجوز عملیاتی نیست.

## قواعد اجباری

1. Secret جدید فقط با شناسه inventory، owner، purpose، environment، scope، creation/expiry و آخرین rotation ایجاد می‌شود؛ مقدار در inventory ثبت نمی‌شود.
2. Secret production میان dev/staging/prod، tenantها یا سرویس‌های نامرتبط مشترک نیست.
3. دسترسی least-privilege، قابل‌ممیزی و قابل‌لغو است؛ token بلندعمر فقط وقتی Provider جایگزین کوتاه‌عمر ندارد مجاز است.
4. فایل محلی اضطراری باید ignored، owner-only، regular file و بدون symlink باشد. برای `.cf` فقط mode `600` پذیرفته می‌شود و `cf_purge.sh` این مرز را پیش از source کردن enforce می‌کند.
5. Secret به process فقط هنگام اجرا تزریق می‌شود؛ Docker build arg، image layer، frontend variable، URL/query string و command-line argument محل مجاز نیستند.
6. Log و error باید credential را حذف یا کامل mask کنند. redaction جای جلوگیری از ثبت اولیه را نمی‌گیرد.
7. Backup شامل Secret فقط با encryption، permission مالک، checksum، retention و restore audit نگهداری می‌شود و وارد artifact عمومی نمی‌شود.
8. Secret scan روی history، tracked candidate، build context و artifact release blocking است؛ allowlist نیازمند rule، دلیل، owner و expiry است.

## Rotation و پاسخ به Exposure

Exposure مشکوک یا قطعی یک incident است و schedule عادی را باطل می‌کند:

1. استفاده و دامنه اثر بدون چاپ مقدار شناسایی شود؛
2. credential جدید با scope حداقلی ایجاد و consumerها به‌صورت قابل‌بازگشت منتقل شوند؛
3. health/contract test و audit انجام شود؛
4. credential قبلی revoke شود، نه فقط از فایل حذف؛
5. log، build، cache، backup و Git history از نظر نسخه افشاشده بررسی شوند؛
6. history rewrite فقط با برنامه هماهنگ clone/branch/deploy انجام شود؛
7. evidence شامل زمان، owner، سیستم‌های بررسی‌شده و شناسه incident باشد، نه مقدار Secret؛
8. پس از اسکن مجدد، status Matrix به‌روز شود.

tracked فایل `.cf` در Baseline حاوی finding بوده است. فایل از candidate worktree حذف و مسیر آن ignored شده، اما این فقط جلوگیری از commit بعدی است. تا وقتی مالک credential آن را rotate/revoke نکرده و تاریخچه Git با برنامه هماهنگ پاک و دوباره اسکن نشده، `PC-132` همچنان `FAIL` می‌ماند.

## وضعیت پیاده‌سازی

- حذف Secret از Source candidate و guard فایل محلی: `IMPLEMENTED_PENDING_FULL_SCAN`؛
- Vault/service identity مرکزی: `NOT_IMPLEMENTED`؛
- inventory بدون مقدار و owner فردی: `NOT_IMPLEMENTED`؛
- rotation finding فعلی: `REQUIRES_EXTERNAL_OWNER_ACTION`؛
- history cleanup هماهنگ: `NOT_STARTED`؛
- CI blocking برای history/build/artifact: `NOT_IMPLEMENTED`.

هیچ‌یک از وضعیت‌های بالا به‌تنهایی قبولی ASVS یا Gate امنیت release را ثابت نمی‌کند.
