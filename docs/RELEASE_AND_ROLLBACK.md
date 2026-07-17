# Release، Backup و Rollback

وضعیت: `NO_RELEASE — Phase 0`

## Baseline قابل بازیابی

- Commit مبنا: `080033ae56e3c793ba3a998276cac5daeb969d50`.
- Worktree patch و untracked archive پیش از تغییر در backup محدودشده ذخیره شد.
- PostgreSQL full custom dump و Valkey snapshot دارای SHA-256 هستند.
- config/secret backup با permission فقط مالک نگهداری می‌شود و نباید commit یا artifact عمومی شود.

مسیر: `/home/bazaarnama/Pro-Chart/.codex-backups/phase0-20260714T222745Z`

## Restore drill انجام‌شده

1. dump به PostgreSQL container کپی شد؛
2. DB موقت مستقل ساخته شد؛
3. `pg_restore --exit-on-error --no-owner --no-privileges` اجرا شد؛
4. ۳۷۹ table منبع و Restore برابر و Alembic version حاضر بود؛
5. DB موقت و فایل موقت حذف شد.

نتیجه: `PASS`. RPO/RTO و restore زمان‌سنجی‌شده هنوز تعریف نشده‌اند.

## سیاست Release آینده

Release فقط با build reproducible، SBOM/provenance، migration dry-run، backup، Canary، مشاهده SLO، post-release smoke و rollback command آزموده مجاز است. Feature flag نباید جای پیاده‌سازی یا permission server-side را بگیرد.

## محدودیت Rollback فعلی

مسیر deploy موجود با migration chain Alembic همسو نیست و compose قدیمی build contextهای مفقود دارد. بنابراین هیچ Rollback production تا انتخاب compose canonical و مسیر migration واحد «آزموده» تلقی نمی‌شود.
