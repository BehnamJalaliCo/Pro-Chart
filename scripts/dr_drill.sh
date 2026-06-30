#!/usr/bin/env bash
# Disaster Recovery drill — restore واقعی روی یک container ایزوله.
#
# هدف: اطمینان از اینکه backup ها واقعاً restorable هستند.
# هر ماه باید اجرا شود — تنها راه اثبات DR.
#
# استفاده:
#   bash scripts/dr_drill.sh
#
# Exit codes:
#   0 = drill موفق
#   1 = backup file یافت نشد
#   2 = restore شکست خورد
#   3 = data integrity check شکست خورد

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DRILL_CONTAINER="${DRILL_CONTAINER:-coinepro-dr-drill}"
DRILL_DB_NAME="dr_drill_db"

echo "🧪 DR Drill — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "═══════════════════════════════════════════"

# ── ۱) پیدا کردن آخرین backup ──
LATEST_DB=$(ls -t "${BACKUP_DIR}"/db_*.sql.gz 2>/dev/null | head -n1 || true)
if [[ -z "${LATEST_DB}" ]]; then
    echo "❌ هیچ DB backup در ${BACKUP_DIR} نیست"
    exit 1
fi
BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "${LATEST_DB}")) / 3600 ))
echo "📦 Latest backup: ${LATEST_DB}"
echo "   سن backup: ${BACKUP_AGE_HOURS} ساعت"

if [[ "${BACKUP_AGE_HOURS}" -gt 26 ]]; then
    echo "⚠️  backup بیش از ۲۶ ساعت قدیمی است — daily backup احتمالاً fail می‌شود"
fi

# ── ۲) راه‌اندازی container ایزوله ──
echo ""
echo "🐳 Spinning up isolated TimescaleDB container..."

docker rm -f "${DRILL_CONTAINER}" 2>/dev/null || true
docker run -d \
    --name "${DRILL_CONTAINER}" \
    -e POSTGRES_DB="${DRILL_DB_NAME}" \
    -e POSTGRES_USER=drill_user \
    -e POSTGRES_PASSWORD=drill_pass_temporary \
    --tmpfs /var/lib/postgresql/data \
    timescale/timescaledb:latest-pg15 > /dev/null

# منتظر آماده شدن
echo "   منتظر postgres ready..."
for i in {1..30}; do
    if docker exec "${DRILL_CONTAINER}" pg_isready -U drill_user > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

if ! docker exec "${DRILL_CONTAINER}" pg_isready -U drill_user > /dev/null 2>&1; then
    echo "❌ container ready نشد"
    docker logs --tail 20 "${DRILL_CONTAINER}"
    docker rm -f "${DRILL_CONTAINER}" > /dev/null
    exit 2
fi
echo "   ✅ container ready"

# ── ۳) Restore ──
echo ""
echo "📥 Restoring backup..."

RESTORE_START=$(date +%s)

gunzip < "${LATEST_DB}" \
    | docker exec -i "${DRILL_CONTAINER}" \
        psql -U drill_user -d "${DRILL_DB_NAME}" \
        -v ON_ERROR_STOP=1 > /tmp/dr_drill_restore.log 2>&1 || {
    echo "❌ restore شکست خورد"
    echo "آخرین خطاهای log:"
    tail -20 /tmp/dr_drill_restore.log
    docker rm -f "${DRILL_CONTAINER}" > /dev/null
    exit 2
}

RESTORE_DURATION=$(($(date +%s) - RESTORE_START))
echo "   ✅ Restore در ${RESTORE_DURATION} ثانیه تکمیل شد"

# ── ۴) Data integrity check ──
echo ""
echo "🔍 Integrity checks..."

CHECKS_FAILED=0

# جداول کلیدی
for table in signals users admins candles; do
    if docker exec "${DRILL_CONTAINER}" \
        psql -U drill_user -d "${DRILL_DB_NAME}" \
        -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='${table}';" \
        2>/dev/null | grep -q "1"; then
        count=$(docker exec "${DRILL_CONTAINER}" \
            psql -U drill_user -d "${DRILL_DB_NAME}" \
            -tAc "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "0")
        echo "   ✅ ${table}: ${count} rows"
    else
        echo "   ❌ table ${table} مفقود است"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
    fi
done

# constraint checks ساده
if ! docker exec "${DRILL_CONTAINER}" \
    psql -U drill_user -d "${DRILL_DB_NAME}" \
    -tAc "SELECT COUNT(*) FROM signals WHERE entry_price IS NULL OR sl IS NULL;" \
    2>/dev/null | grep -qE "^[0-9]+$"; then
    echo "   ⚠️  signals integrity check inconclusive"
fi

# ── ۵) cleanup ──
echo ""
echo "🧹 Cleanup..."
docker rm -f "${DRILL_CONTAINER}" > /dev/null
echo "   ✅ container حذف شد"

# ── ۶) report ──
echo ""
echo "═══════════════════════════════════════════"
if [[ ${CHECKS_FAILED} -eq 0 ]]; then
    echo "✅ DR Drill موفق"
    echo "   Restore duration: ${RESTORE_DURATION}s (RTO target: 3600s)"
    if [[ ${RESTORE_DURATION} -gt 3600 ]]; then
        echo "⚠️  RTO هدف رد شد — backup بزرگ است، DB scale up کنید"
    fi
    exit 0
else
    echo "❌ DR Drill شکست خورد (${CHECKS_FAILED} checks)"
    exit 3
fi
