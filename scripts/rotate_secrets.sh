#!/usr/bin/env bash
# Secrets rotation helper — یک فایل .env جدید با مقادیر تصادفی قوی تولید می‌کند.
#
# استفاده:
#   bash scripts/rotate_secrets.sh                    # → .env.new
#   ROTATE_ALL=true bash scripts/rotate_secrets.sh    # تولید همه‌ی secrets جدید
#
# پس از تولید:
#   1. مقادیر را با .env فعلی مقایسه کنید
#   2. backup رمزدار و آزموده با scripts/backup.sh بگیرید
#   3. mv .env.new .env
#   4. docker compose down && docker compose up -d
#   5. تأیید: تمام services healthy
#
# ⚠️ ROTATE_JWT_SECRET = تمام token‌های فعال invalidate می‌شوند → کاربران re-login

set -euo pipefail
umask 077

OUTPUT_FILE="${1:-.env.new}"
SOURCE_FILE="${ENV_FILE:-.env}"

if [[ -e "${OUTPUT_FILE}" || -L "${OUTPUT_FILE}" ]]; then
    echo "❌ ${OUTPUT_FILE} موجود است — لطفاً ابتدا آن را حذف یا پشتیبان بگیرید."
    exit 1
fi

if [[ -L "${SOURCE_FILE}" ]]; then
    echo "❌ فایل منبع Secret نباید symbolic link باشد"
    exit 1
fi
if [[ -e "${SOURCE_FILE}" ]]; then
    if [[ ! -f "${SOURCE_FILE}" || "$(stat -c '%u' -- "${SOURCE_FILE}")" != "$(id -u)" ]]; then
        echo "❌ فایل منبع Secret باید regular file و متعلق به کاربر اجراکننده باشد"
        exit 1
    fi
    SOURCE_MODE="$(stat -c '%a' -- "${SOURCE_FILE}")"
    if (( (8#$SOURCE_MODE & 077) != 0 )); then
        echo "❌ دسترسی فایل منبع Secret باز است؛ ابتدا chmod 600 اجرا شود"
        exit 1
    fi
fi

if ! command -v openssl &>/dev/null; then
    echo "❌ openssl نصب نیست"
    exit 2
fi

echo "🔐 تولید secrets جدید..."

gen_password() {
    # ۳۲ کاراکتر hex؛ بدون pipeline/SIGPIPE و مناسب URL/config.
    openssl rand -hex 16
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
    # مقدارهای تازه در argv ابزار جای نمی‌گیرند؛ awk آن‌ها را فقط از محیط
    # همان process می‌خواند و فایل خروجی از ابتدا با umask مالک-only ساخته می‌شود.
    NEW_DB_PASSWORD="${NEW_DB_PASSWORD}" \
    NEW_REDIS_PASSWORD="${NEW_REDIS_PASSWORD}" \
    NEW_ADMIN_PASSWORD="${NEW_ADMIN_PASSWORD}" \
    NEW_GRAFANA_PASSWORD="${NEW_GRAFANA_PASSWORD}" \
    NEW_JWT_SECRET="${NEW_JWT_SECRET}" \
    NEW_BACKUP_PASSPHRASE="${NEW_BACKUP_PASSPHRASE}" \
    awk '
        /^DB_PASSWORD=/ { print "DB_PASSWORD=" ENVIRON["NEW_DB_PASSWORD"]; next }
        /^REDIS_PASSWORD=/ { print "REDIS_PASSWORD=" ENVIRON["NEW_REDIS_PASSWORD"]; next }
        /^ADMIN_PASSWORD=/ { print "ADMIN_PASSWORD=" ENVIRON["NEW_ADMIN_PASSWORD"]; next }
        /^GRAFANA_PASSWORD=/ { print "GRAFANA_PASSWORD=" ENVIRON["NEW_GRAFANA_PASSWORD"]; next }
        /^JWT_SECRET_KEY=/ { print "JWT_SECRET_KEY=" ENVIRON["NEW_JWT_SECRET"]; next }
        /^BACKUP_PASSPHRASE=/ { print "BACKUP_PASSPHRASE=" ENVIRON["NEW_BACKUP_PASSPHRASE"]; next }
        { print }
    ' "${SOURCE_FILE}" > "${OUTPUT_FILE}"
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
echo "  1) BACKUP_PASSPHRASE را امن تنظیم و bash scripts/backup.sh را اجرا/اعتبارسنجی کنید"
echo "  2) فقط نام کلیدهای تغییرکرده را با ابزار redacted بررسی کنید؛ مقدارها را diff/چاپ نکنید"
echo "  3) mv ${OUTPUT_FILE} .env"
echo "  4) docker compose down && docker compose up -d"
echo "  5) curl -f https://api.your-domain/health"
echo ""
echo "⚠️  هشدار: JWT_SECRET_KEY تغییر کرد — تمام کاربران/ادمین‌ها re-login می‌کنند."
