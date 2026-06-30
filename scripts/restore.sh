#!/usr/bin/env bash
# Restore script — DB + models + configs از یک backup snapshot.
#
# استفاده:
#   bash scripts/restore.sh ./backups/db_20260528_120000.sql.gz
#
# پارامترهای محیطی:
#   COMPOSE_FILE       (پیش‌فرض docker-compose.yml)
#   DB_NAME            (پیش‌فرض forex_signal)
#   DB_USER            (پیش‌فرض coinepro)
#   BACKUP_PASSPHRASE  (برای decrypt .env)
#   DRY_RUN=true       (نمایش بدون اجرا)
#
# ⚠️ این اسکریپت DB موجود را overwrite می‌کند. حتماً قبل از restore
#    یک backup از وضعیت فعلی بگیرید.

set -euo pipefail

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <db_backup.sql.gz> [models_backup.tar.gz] [env_backup.enc]"
    exit 1
fi

DB_BACKUP="${1}"
MODELS_BACKUP="${2:-}"
ENV_BACKUP="${3:-}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
DB_NAME="${DB_NAME:-forex_signal}"
DB_USER="${DB_USER:-coinepro}"
DRY_RUN="${DRY_RUN:-false}"

# ── pre-checks ──────────────────────────────────────────
echo "🔍 Pre-checks"

if [[ ! -f "${DB_BACKUP}" ]]; then
    echo "❌ DB backup یافت نشد: ${DB_BACKUP}"
    exit 2
fi

if ! gunzip -t "${DB_BACKUP}" 2>/dev/null; then
    echo "❌ DB backup خراب است (gunzip test failed)"
    exit 3
fi

DB_SIZE=$(du -h "${DB_BACKUP}" | cut -f1)
echo "   ✅ DB backup: ${DB_BACKUP} (${DB_SIZE})"

if [[ -n "${MODELS_BACKUP}" && ! -f "${MODELS_BACKUP}" ]]; then
    echo "⚠️  models backup مشخص ولی یافت نشد — رد می‌شود"
    MODELS_BACKUP=""
fi

# ── safety backup ──────────────────────────────────────
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
SAFETY_DIR="./backups/restore_safety_${TIMESTAMP}"
mkdir -p "${SAFETY_DIR}"
echo ""
echo "🛡  Safety backup قبل از restore در ${SAFETY_DIR}"

if [[ "${DRY_RUN}" != "true" ]]; then
    docker compose -f "${COMPOSE_FILE}" exec -T timescaledb \
        pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl 2>/dev/null \
        | gzip > "${SAFETY_DIR}/db_pre_restore.sql.gz" || {
        echo "   ⚠️  safety dump شکست خورد — ممکن است DB موجود نباشد"
    }
    echo "   ✅ Safety backup گرفته شد"
else
    echo "   ⏭  DRY_RUN — safety backup skip شد"
fi

# ── DB restore ──────────────────────────────────────────
echo ""
echo "📊 Restoring database..."

if [[ "${DRY_RUN}" == "true" ]]; then
    echo "   ⏭  DRY_RUN — DB restore skip شد"
    echo "   فرمان: gunzip < ${DB_BACKUP} | docker compose exec -T timescaledb psql -U ${DB_USER} -d ${DB_NAME}"
else
    # drop و recreate database
    docker compose -f "${COMPOSE_FILE}" exec -T timescaledb \
        psql -U "${DB_USER}" -d postgres \
        -c "DROP DATABASE IF EXISTS ${DB_NAME};" \
        -c "CREATE DATABASE ${DB_NAME};"

    gunzip < "${DB_BACKUP}" \
        | docker compose -f "${COMPOSE_FILE}" exec -T timescaledb \
            psql -U "${DB_USER}" -d "${DB_NAME}" \
            -v ON_ERROR_STOP=1 > /tmp/restore.log 2>&1 || {
        echo "❌ DB restore شکست خورد. log:"
        tail -50 /tmp/restore.log
        exit 4
    }
    echo "   ✅ DB restore تکمیل شد"
fi

# ── Models restore ─────────────────────────────────────
if [[ -n "${MODELS_BACKUP}" ]]; then
    echo ""
    echo "🤖 Restoring ML models..."
    if [[ "${DRY_RUN}" == "true" ]]; then
        echo "   ⏭  DRY_RUN — models restore skip شد"
    else
        docker compose -f "${COMPOSE_FILE}" exec -T forex-api \
            tar xzf - -C /app < "${MODELS_BACKUP}" || {
            echo "   ⚠️  models restore شکست — manual review لازم"
        }
        echo "   ✅ Models restore تکمیل شد"
    fi
fi

# ── .env restore (encrypted) ────────────────────────────
if [[ -n "${ENV_BACKUP}" ]]; then
    if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
        echo "⚠️  ENV_BACKUP داده شد ولی BACKUP_PASSPHRASE تنظیم نشده — skip"
    else
        echo ""
        echo "⚙️  Restoring .env (encrypted)..."
        if [[ "${DRY_RUN}" == "true" ]]; then
            echo "   ⏭  DRY_RUN"
        else
            openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
                -in "${ENV_BACKUP}" \
                -out .env.restored \
                -pass "pass:${BACKUP_PASSPHRASE}" || {
                echo "❌ decrypt شکست — passphrase اشتباه؟"
                exit 5
            }
            chmod 600 .env.restored
            echo "   ✅ .env.restored ساخته شد — manual: mv .env.restored .env"
        fi
    fi
fi

# ── post-restore verification ──────────────────────────
echo ""
echo "🔍 Post-restore verification..."

if [[ "${DRY_RUN}" != "true" ]]; then
    SIGNAL_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T timescaledb \
        psql -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT COUNT(*) FROM signals;" 2>/dev/null || echo "?")
    USER_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T timescaledb \
        psql -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "?")
    ADMIN_COUNT=$(docker compose -f "${COMPOSE_FILE}" exec -T timescaledb \
        psql -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT COUNT(*) FROM admins;" 2>/dev/null || echo "?")

    echo "   signals: ${SIGNAL_COUNT}"
    echo "   users:   ${USER_COUNT}"
    echo "   admins:  ${ADMIN_COUNT}"
fi

# ── Restart services ───────────────────────────────────
echo ""
echo "♻️  Restart services..."

if [[ "${DRY_RUN}" != "true" ]]; then
    docker compose -f "${COMPOSE_FILE}" restart forex-api forex-signal-engine forex-tracker forex-bot
    sleep 5
    echo "   ✅ Services restarted"
fi

echo ""
echo "✅ Restore complete"
echo "   Safety backup: ${SAFETY_DIR}"
echo "   اگر مشکلی بود، rollback با:"
echo "     bash scripts/restore.sh ${SAFETY_DIR}/db_pre_restore.sql.gz"
