#!/usr/bin/env bash
# اسکریپت backup روزانه — DB، مدل‌های ML، تنظیمات.
#
# استفاده:
#   bash scripts/backup.sh           # backup در ./backups
#   BACKUP_DIR=/mnt/backups bash scripts/backup.sh
#
# اضافه کردن به cron برای backup روزانه ساعت ۲۰:۰۰ UTC (قبل از rollover):
#   0 20 * * * cd /opt/coinepro-fx && bash scripts/backup.sh >> /var/log/coinepro-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

DB_NAME="${DB_NAME:-forex_signal}"
DB_USER="${DB_USER:-coinepro}"

mkdir -p "${BACKUP_DIR}"
echo "📦 Backup CoinePro FX — ${TIMESTAMP}"
echo "   مقصد: ${BACKUP_DIR}"

# ── ۱) Database dump ──
DB_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.sql.gz"
echo "📊 Dumping database → ${DB_FILE}"
docker compose -f "${COMPOSE_FILE}" exec -T timescaledb \
    pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl \
    | gzip > "${DB_FILE}"
DB_SIZE=$(du -h "${DB_FILE}" | cut -f1)
echo "   ✅ DB backup: ${DB_SIZE}"

# ── ۲) ML models ──
MODELS_FILE="${BACKUP_DIR}/models_${TIMESTAMP}.tar.gz"
echo "🤖 Backing up ML models → ${MODELS_FILE}"
if docker compose -f "${COMPOSE_FILE}" exec -T forex-api ls /app/models 2>/dev/null | grep -q .; then
    docker compose -f "${COMPOSE_FILE}" exec -T forex-api \
        tar czf - -C /app models > "${MODELS_FILE}"
    MODELS_SIZE=$(du -h "${MODELS_FILE}" | cut -f1)
    echo "   ✅ Models backup: ${MODELS_SIZE}"
else
    echo "   ⏭  مدلی برای backup نیست"
    rm -f "${MODELS_FILE}"
fi

# ── ۳) Configs (.env بدون commit) ──
CONFIGS_FILE="${BACKUP_DIR}/configs_${TIMESTAMP}.tar.gz"
echo "⚙️  Backing up configs → ${CONFIGS_FILE}"
tar czf "${CONFIGS_FILE}" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='__pycache__' \
    --exclude='backups' \
    docker-compose.yml \
    nginx/ \
    monitoring/ \
    alembic.ini 2>/dev/null || true

if [[ -f ".env" ]]; then
    # .env فقط رمزدار backup می‌شود — هرگز plaintext
    if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
        echo "   ❌ BACKUP_PASSPHRASE تنظیم نشده — backup .env اجبارا متوقف شد"
        if [[ "${ALLOW_UNENCRYPTED_BACKUP:-false}" != "true" ]]; then
            echo "   ❌ ERROR: برای backup .env باید BACKUP_PASSPHRASE تنظیم شود."
            echo "      تولید: export BACKUP_PASSPHRASE=\$(openssl rand -hex 32)"
            echo "      یا برای override (فقط dev): export ALLOW_UNENCRYPTED_BACKUP=true"
            exit 2
        fi
        echo "   ⚠️  ALLOW_UNENCRYPTED_BACKUP=true — این فقط برای dev مجاز است"
    elif ! command -v openssl &>/dev/null; then
        echo "   ❌ openssl نصب نیست — نمی‌توان .env رمز کرد"
        exit 3
    else
        openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
            -in .env \
            -out "${BACKUP_DIR}/env_${TIMESTAMP}.enc" \
            -pass "pass:${BACKUP_PASSPHRASE}"
        # حذف permission سطحی
        chmod 600 "${BACKUP_DIR}/env_${TIMESTAMP}.enc"
        echo "   ✅ .env رمزدار شد (AES-256-CBC، iter 100k)"
    fi
fi
echo "   ✅ Configs backup"

# ── ۴) Cleanup قدیمی‌ها ──
echo "🗑  حذف backup های قدیمی‌تر از ${RETENTION_DAYS} روز"
find "${BACKUP_DIR}" -name "db_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "models_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "configs_*.tar.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "env_*.enc" -mtime +${RETENTION_DAYS} -delete

# ── ۵) verify که DB قابل restore است ──
echo "🔍 بررسی integrity backup..."
if gunzip -t "${DB_FILE}" 2>/dev/null; then
    echo "   ✅ DB backup سالم است"
else
    echo "   ❌ DB backup خراب — بررسی کن!"
    exit 1
fi

# گزارش نهایی
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo ""
echo "✅ Backup کامل شد"
echo "   حجم کل دایرکتوری backup: ${TOTAL_SIZE}"
echo "   فایل‌های امروز:"
ls -lh "${BACKUP_DIR}/" | grep "${TIMESTAMP}"
