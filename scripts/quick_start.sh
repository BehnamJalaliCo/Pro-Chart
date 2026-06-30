#!/bin/bash
# =============================================================================
# راه‌اندازی سریع CoinePro (پس از نصب Docker)
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${PROJECT_DIR}"

# بررسی Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker نصب نیست! ابتدا اجرا کنید: sudo bash scripts/setup_server.sh"
    exit 1
fi

# بررسی .env
if [ ! -f .env ]; then
    log_info "ایجاد فایل .env ..."
    cp .env.example .env
    log_warn "فایل .env ایجاد شد. لطفاً تنظیمات را ویرایش کنید:"
    log_warn "  nano ${PROJECT_DIR}/.env"
    log_warn "حداقل TELEGRAM_BOT_TOKEN را پر کنید."
    exit 0
fi

# بررسی BOT TOKEN
source .env 2>/dev/null || true
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ "${TELEGRAM_BOT_TOKEN}" = "" ]; then
    log_error "TELEGRAM_BOT_TOKEN در .env تنظیم نشده!"
    log_warn "  nano ${PROJECT_DIR}/.env"
    exit 1
fi

# ساخت پوشه‌ها
mkdir -p logs ml_models certbot/www certbot/conf

# ── مرحله ۱: استفاده از config بدون SSL برای شروع ────
log_info "تنظیم nginx بدون SSL برای شروع اولیه..."
if [ ! -f certbot/conf/live/FX.trade-future.ir/fullchain.pem ]; then
    # SSL ندارد، از config بدون SSL استفاده کن
    cp nginx/conf.d/default-no-ssl.conf.template nginx/conf.d/default-no-ssl.conf
    # غیرفعال کردن configs SSL
    for f in nginx/conf.d/website.conf nginx/conf.d/admin.conf; do
        if [ -f "$f" ]; then
            mv "$f" "${f}.ssl-disabled"
        fi
    done
    log_warn "SSL فعال نیست — پس از راه‌اندازی اجرا کنید: bash scripts/init_ssl.sh"
else
    log_info "گواهی SSL موجود است"
    # فعال کردن configs SSL
    for f in nginx/conf.d/website.conf.ssl-disabled nginx/conf.d/admin.conf.ssl-disabled; do
        if [ -f "$f" ]; then
            mv "$f" "${f%.ssl-disabled}"
        fi
    done
    rm -f nginx/conf.d/default-no-ssl.conf
fi

# ── مرحله ۲: Build و اجرا ─────────────────────────────
log_info "ساخت Docker images (ممکن است چند دقیقه طول بکشد)..."
docker compose build --parallel

log_info "اجرای سرویس‌های پایه (دیتابیس و Redis)..."
docker compose up -d timescaledb redis
log_info "منتظر آماده شدن دیتابیس..."
sleep 10

# بررسی سلامت دیتابیس
for i in $(seq 1 30); do
    if docker compose exec timescaledb pg_isready -U "${DB_USER:-coinepro}" > /dev/null 2>&1; then
        log_info "دیتابیس آماده است"
        break
    fi
    echo -n "."
    sleep 2
done

# ── مرحله ۳: مایگریشن دیتابیس ──────────────────────
log_info "اجرای مایگریشن دیتابیس..."
docker compose up -d api
sleep 5
docker compose exec api python scripts/migrate_db.py

# ── مرحله ۴: ساخت ادمین ──────────────────────────────
log_info "ساخت کاربر ادمین..."
docker compose exec api python scripts/create_admin.py || log_warn "ادمین قبلاً ساخته شده"

# ── مرحله ۵: seed اولیه ──────────────────────────────
log_info "بارگذاری داده‌های اولیه..."
docker compose exec api python scripts/seed_data.py || log_warn "داده‌های اولیه قبلاً بارگذاری شده"

# ── مرحله ۶: بقیه سرویس‌ها ────────────────────────────
log_info "اجرای تمام سرویس‌ها..."
docker compose up -d

# ── مرحله ۷: بررسی وضعیت ──────────────────────────────
sleep 5
echo ""
log_info "وضعیت سرویس‌ها:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=============================================="
echo -e "${GREEN}  CoinePro با موفقیت راه‌اندازی شد! ${NC}"
echo "=============================================="
echo ""
echo "  آدرس‌ها:"
echo "    وب‌سایت:    http://FX.trade-future.ir"
echo "    پنل ادمین:  http://Panel.FX.trade-future.ir"
echo "    API:        http://api.FX.trade-future.ir"
echo "    API Health:  http://localhost:8000/health"
echo "    Grafana:    http://localhost:3000"
echo ""
echo "  دستورات مفید:"
echo "    docker compose logs -f                    # مشاهده لاگ‌ها"
echo "    docker compose ps                         # وضعیت سرویس‌ها"
echo "    docker compose exec api python scripts/download_historical.py  # دانلود داده تاریخی"
echo "    docker compose exec api python scripts/train_models.py         # آموزش مدل‌ها"
echo "    bash scripts/init_ssl.sh                  # فعال‌سازی SSL"
echo ""
