#!/usr/bin/env bash
# Secrets rotation helper — یک فایل .env جدید با مقادیر تصادفی قوی تولید می‌کند.
#
# استفاده:
#   bash scripts/rotate_secrets.sh                    # → .env.new
#   ROTATE_ALL=true bash scripts/rotate_secrets.sh    # تولید همه‌ی secrets جدید
#
# پس از تولید:
#   1. مقادیر را با .env فعلی مقایسه کنید
#   2. backup قبل: cp .env .env.backup-$(date +%Y%m%d)
#   3. mv .env.new .env
#   4. docker compose down && docker compose up -d
#   5. تأیید: تمام services healthy
#
# ⚠️ ROTATE_JWT_SECRET = تمام token‌های فعال invalidate می‌شوند → کاربران re-login

set -euo pipefail

OUTPUT_FILE="${1:-.env.new}"
SOURCE_FILE="${ENV_FILE:-.env}"

if [[ -f "${OUTPUT_FILE}" ]]; then
    echo "❌ ${OUTPUT_FILE} موجود است — لطفاً ابتدا آن را حذف یا پشتیبان بگیرید."
    exit 1
fi

if ! command -v openssl &>/dev/null; then
    echo "❌ openssl نصب نیست"
    exit 2
fi

echo "🔐 تولید secrets جدید..."

gen_password() {
    # ۳۲ کاراکتر base64 — قوی و URL-safe
    openssl rand -base64 32 | tr -d '\n=' | head -c 32
}

gen_hex_secret() {
    openssl rand -hex 32
}

NEW_DB_PASSWORD=$(gen_password)
NEW_REDIS_PASSWORD=$(gen_password)
NEW_ADMIN_PASSWORD=$(gen_password)
NEW_GRAFANA_PASSWORD=$(gen_password)
NEW_JWT_SECRET=$(gen_hex_secret)
NEW_BACKUP_PASSPHRASE=$(gen_hex_secret)

if [[ -f "${SOURCE_FILE}" ]]; then
    # کپی کن، فقط passwords را جایگزین کن
    cp "${SOURCE_FILE}" "${OUTPUT_FILE}"

    sed -i.bak \
        -e "s|^DB_PASSWORD=.*|DB_PASSWORD=${NEW_DB_PASSWORD}|" \
        -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=${NEW_REDIS_PASSWORD}|" \
        -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${NEW_ADMIN_PASSWORD}|" \
        -e "s|^GRAFANA_PASSWORD=.*|GRAFANA_PASSWORD=${NEW_GRAFANA_PASSWORD}|" \
        -e "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${NEW_JWT_SECRET}|" \
        -e "s|^BACKUP_PASSPHRASE=.*|BACKUP_PASSPHRASE=${NEW_BACKUP_PASSPHRASE}|" \
        "${OUTPUT_FILE}"
    rm -f "${OUTPUT_FILE}.bak"
else
    # ساخت .env جدید از پایه
    cat > "${OUTPUT_FILE}" <<EOF
# .env تولید شده توسط rotate_secrets.sh در $(date -u +%Y-%m-%dT%H:%M:%SZ)
# ⚠️ هرگز این فایل را commit نکنید

DEBUG=false

# Database
DB_NAME=forex_signal
DB_USER=coinepro
DB_PASSWORD=${NEW_DB_PASSWORD}
DB_HOST=timescaledb
DB_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${NEW_REDIS_PASSWORD}

# JWT
JWT_SECRET_KEY=${NEW_JWT_SECRET}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${NEW_ADMIN_PASSWORD}

# Grafana
GRAFANA_PASSWORD=${NEW_GRAFANA_PASSWORD}

# Backup
BACKUP_PASSPHRASE=${NEW_BACKUP_PASSPHRASE}

# Telegram (دستی پر کنید)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=
TELEGRAM_ADMIN_IDS=

# Trading mode (paper تا کاملاً آماده شدن)
TRADING_MODE=paper
EOF
fi

chmod 600 "${OUTPUT_FILE}"

echo ""
echo "✅ secrets جدید تولید شد در ${OUTPUT_FILE}"
echo ""
echo "مراحل بعدی:"
echo "  1) cp .env .env.backup-\$(date +%Y%m%d-%H%M%S)"
echo "  2) diff .env ${OUTPUT_FILE}   # بررسی تغییرات"
echo "  3) mv ${OUTPUT_FILE} .env"
echo "  4) docker compose down && docker compose up -d"
echo "  5) curl -f https://api.your-domain/health"
echo ""
echo "⚠️  هشدار: JWT_SECRET_KEY تغییر کرد — تمام کاربران/ادمین‌ها re-login می‌کنند."
