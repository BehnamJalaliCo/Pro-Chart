# Central Auth — سرویسِ هویتِ مرکزیِ Pro-Chart (M2)

سرویسِ SSO که JWT واحد (RS256) صادر و تأیید می‌کند و روی PostgreSQL مرکزی می‌نشیند.
طرحِ کامل: [`../docs/M2-DESIGN.md`](../docs/M2-DESIGN.md).

> ⚠️ این اسکلت است؛ روی سرورِ زنده هنوز دیپلوی نشده. دیپلوی نیازمندِ نصبِ Docker روی سرورِ مرکزی (رمزِ sudo) است.

## راه‌اندازی (روی سرورِ مرکزی، بعد از نصبِ Docker)
```bash
cd central-auth
cp .env.example .env          # DB_PASSWORD و LEGACY_HS256_SECRET را ست کن
bash scripts/gen-keys.sh      # جفت‌کلیدِ RS256 (خصوصی commit نمی‌شود)
docker compose -f docker-compose.central.yml up -d --build
curl -s http://127.0.0.1:8100/health
curl -s http://127.0.0.1:8100/.well-known/jwks.json
```

## معماری
- **RS256 + JWKS:** سرویسِ مرکزی با کلیدِ خصوصی امضا می‌کند؛ هاب/کریپتو/فارکس فقط با کلیدِ عمومی (`/.well-known/jwks.json`) verify می‌کنند.
- **سازگاریِ عقب‌رو:** با `LEGACY_HS256_ENABLED=1` توکن‌های HS256ِ قدیمیِ اپ هم پذیرفته می‌شوند تا گذار بی‌قطعی باشد.
- **منبعِ واحد:** جدولِ `identities` تنها منبعِ حقیقتِ هویت/tier؛ کاربرانِ فعلی با `legacy_student_id` مهاجرت می‌شوند.

## Endpointها
`POST /auth/login` · `POST /auth/guest` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `POST /admin/set-tier` · `GET /.well-known/jwks.json` · `GET /health`

## کارهای بعدی (سیم‌کشی)
- ثبت‌نامِ OTP ایمیل (`/auth/register/*`) — اتصال به همان فرستندهٔ فعلیِ آکادمی.
- اسکریپتِ مهاجرتِ `academy_students` → `identities` (فقط SELECT از مبدأ).
- افزودنِ verifyِ RS256/JWKS به `src/core/security.py`ِ اپ (کارِ Claudeِ اپ).
- جایگزینیِ Base.metadata.create_all با Alembic برای تولید.
