# 🧩 طرحِ M2 — سرویسِ Auth مرکزی + دیتابیسِ هویتِ مرکزی

> وضعیت: ✅ **دیپلوی شد و تست شد (۲۰۲۶-۰۷-۰۲).** سرویس روی سرورِ مرکزی زنده است؛ ۷ کاربر مهاجرت کردند. گزارش: `docs/reports/M2-REPORT.md`.
> باقی‌مانده: فعال‌سازیِ سمتِ اپ (`docs/reports/M2-APP-HANDOFF-PATCH.md`) + تصمیمِ شبکه (Cloud Network vs TLS عمومی).

## هدف (از SERVER-HANDOFF §M2)
یک سرویسِ Auth مرکزی روی سرورِ مرکزی (`App-Central-Server`, 91.107.183.210) که:
- **JWT واحد** برای همهٔ اجزا (اپ، آکادمی، پنل‌های ادمین/کاربر) صادر و تأیید کند.
- روی یک **PostgreSQL مرکزی** به‌عنوان منبعِ حقیقتِ هویت/tier بنشیند.
- کاربرانِ فعلی (`academy_students` + مهمان‌های `bn-guest`) را مهاجرت/فدره کند.
- خروجی: **SSO** برای همهٔ سطوحِ اپ.

## وضعیتِ فعلی (خلاصهٔ ممیزیِ کد — کامل در حافظهٔ فاز)
- JWT فعلی: `python-jose`, **HS256 با `JWT_SECRET_KEY` مشترک** (`src/core/security.py`).
- هویتِ tier-دار: مدلِ `AcademyStudent` (جدولِ `academy_students`)، ستون‌های `tier` (free/vip/premium)، `status`، `expires_at`، `phone_verified`, `account_type`.
- گِیتِ tier: `_require_premium` → 403 با `{"premium_required": true}` (`bazaarnama.py`).
- حالتِ `BN_STANDALONE_AUTH=1`: اپ مستقل، کاربران از روی claimهای JWT ساخته می‌شوند (کلیدِ مشترک).
- فرانت: توکن در `localStorage['cp_academy_token']`, هدرِ `Authorization: Bearer`.
- DB اپ: `forex_signal` روی TimescaleDB سرورِ فارکس/هاب.

## تصمیم‌های معماری (پیشنهادِ Claude — علامت‌گذاری‌شده؛ منتظرِ تأیید)

### ۱) امضای توکن: **RS256 + JWKS** ✅ پیشنهاد
- سرویسِ مرکزی با **کلیدِ خصوصیِ RSA** امضا می‌کند؛ هر سرویسِ دیگر (هاب/کریپتو/فارکس) فقط با **کلیدِ عمومی** (از endpointِ `/.well-known/jwks.json`) verify می‌کند.
- مزیت: کلیدِ مخفی هیچ‌وقت از سرورِ مرکزی خارج نمی‌شود؛ استانداردِ واقعیِ SSO؛ چرخشِ کلید (kid) ممکن.
- سازگاریِ عقب‌رو: در دورهٔ گذار، سرویسِ مرکزی می‌تواند **هم** RS256 صادر کند **و هم** توکن‌های HS256ِ قدیمی را (با کلیدِ مشترکِ فعلی) بپذیرد تا کاربرانِ زنده قطع نشوند.

### ۲) دیتابیسِ مرکزی: **منبعِ واحد + مهاجرتِ یک‌باره** ✅ پیشنهاد
- DB مرکزیِ جدید (`central_identity`) روی سرورِ مرکزی، تنها منبعِ حقیقتِ هویت/tier.
- کاربرانِ فعلیِ `academy_students` یک‌بار import می‌شوند (اسکریپتِ مهاجرت، فقط-خواندنی از مبدأ).
- سرویسِ Auth تنها نویسندهٔ هویت است؛ اپ‌ها از طریقِ API/توکن می‌خوانند.

### ۳) گذار بدونِ قطعی (rollout)
1. سرویسِ مرکزی بالا می‌آید، ایزوله (فقط پورتِ داخلی).
2. مهاجرتِ کاربران (dry-run → واقعی).
3. اپ برای verify، از JWKS مرکزی استفاده می‌کند (کدِ `security.py` توسعه می‌یابد تا هر دو را بپذیرد).
4. صدورِ توکنِ لاگین به سرویسِ مرکزی منتقل می‌شود.
5. بعد از پایداری، پذیرشِ HS256 قدیمی حذف می‌شود.

## معماریِ سرویس (`central-auth/`)
- **استک:** FastAPI + SQLAlchemy(async) + asyncpg + python-jose(RS256) + passlib(bcrypt) + Alembic — هم‌خانوادهٔ بک‌اندِ فعلی برای سازگاری.
- **کانتینرها (`docker-compose.central.yml`):**
  - `central-postgres` (postgres:17) — دیتابیسِ `central_identity`، فقط روی 127.0.0.1:5442
  - `central-auth` (این سرویس) — فقط روی 127.0.0.1:8100
  - (بعداً) nginx/TLS اگر لازم شد بیرونی شود؛ فعلاً پشتِ شبکهٔ خصوصی.
- **کلیدها:** جفت‌کلیدِ RSA در دیپلوی ساخته می‌شود (`scripts/gen-keys.sh`) و در volume/`.env` می‌ماند — **هرگز commit نمی‌شود** (در `.gitignore`).

### اسکیمای DB (خلاصه — کاملش در alembic)
- `identities` — منبعِ واحد: `id (uuid)`, `kind (student|admin|guest)`, `username`, `email`, `phone_number`, `password_hash`, `tier`, `status`, `expires_at`, `phone_verified`, `account_type`, `legacy_student_id`, `created_at`, `updated_at`.
- `devices` — سقفِ دستگاه (مثلِ `academy_devices`): `identity_id`, `device_id`, `last_seen`. یکتا `(identity_id, device_id)`.
- `refresh_tokens` — چرخش/ابطال: `jti`, `identity_id`, `expires_at`, `revoked`.
- `signing_keys` — کلیدهای فعال JWKS: `kid`, `public_pem`, `active`, `created_at` (کلیدِ خصوصی در DB نیست).
- `audit_log` — لاگِ صدور/ابطال/تغییرِ tier.

### Endpointها (نسخهٔ اول)
| متد | مسیر | کار |
|---|---|---|
| POST | `/auth/login` | ورود (username/email + password) → access(RS256)+refresh؛ چکِ دستگاه |
| POST | `/auth/register/request` | ارسالِ OTP ایمیل |
| POST | `/auth/register/verify` | تأییدِ OTP + ساختِ هویتِ free |
| POST | `/auth/refresh` | چرخشِ refresh (ضدِ replay با jti) |
| POST | `/auth/logout` | ابطالِ jti |
| GET | `/auth/me` | هویتِ جاری |
| POST | `/auth/guest` | مهمانِ اپ (جایگزینِ `bn-guest`) |
| GET | `/.well-known/jwks.json` | کلیدِ عمومی برای verifyِ سایرِ سرویس‌ها |
| POST | `/admin/set-tier` | تغییرِ tier (نقشِ ادمین) — قلابِ پرداختِ M4 |
| GET | `/health` | سلامت |

## کارهای موردِ نیاز از سمتِ اپ (Claudeِ اپ، بعد از دیپلوی)
- [ ] `src/core/security.py`: افزودنِ verifyِ RS256 با JWKS (کش‌شده) در کنارِ HS256 فعلی.
- [ ] تنظیمِ `CENTRAL_AUTH_URL` و آدرسِ JWKS در config.
- [ ] فرانت: نقطهٔ لاگین/مهمان به سرویسِ مرکزی (بعد از گذار) — قراردادِ توکن همان `Bearer` می‌ماند.

## بلاکرها برای مالک
1. **رمزِ sudo** روی سرورِ مرکزی برای نصبِ Docker (یا اجازه بده خودت `docker`+`docker compose` را نصب کنی).
2. تأییدِ دو تصمیمِ معماری (RS256/JWKS و منبعِ واحد) — پیش‌فرض‌های بالا اعمال شده‌اند مگر خلافش را بگویی.
3. برای مهاجرت: تأییدِ خواندنِ `academy_students` از DB فارکس (فقط SELECT).

---
*نوشتهٔ Claude (سرورِ مرکزی) — ۲۰۲۶-۰۷-۰۱. اسکلتِ کد: `central-auth/`.*
