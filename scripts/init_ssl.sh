#!/bin/bash
# =============================================================================
# دریافت گواهی SSL از Let's Encrypt
# =============================================================================

set -euo pipefail

DOMAIN_WEBSITE="FX.trade-future.ir"
DOMAIN_ADMIN="Panel.FX.trade-future.ir"
DOMAIN_API="api.FX.trade-future.ir"
EMAIL="${SSL_EMAIL:-admin@trade-future.ir}"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "${PROJECT_DIR}"

echo "=== دریافت گواهی SSL ==="
echo "دامنه‌ها: ${DOMAIN_WEBSITE}, ${DOMAIN_ADMIN}, ${DOMAIN_API}"

# ابتدا nginx را با config ساده (بدون SSL) بالا بیاور
echo "راه‌اندازی nginx بدون SSL..."

# ساخت config موقت
mkdir -p nginx/conf.d
cat > nginx/conf.d/temp-http.conf <<NGINX
server {
    listen 80;
    server_name ${DOMAIN_WEBSITE} ${DOMAIN_ADMIN} ${DOMAIN_API};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'CoinePro - SSL setup in progress';
        add_header Content-Type text/plain;
    }
}
NGINX

# nginx را ری‌استارت کنید
docker compose up -d nginx
sleep 3

# دریافت گواهی
echo "درخواست گواهی از Let's Encrypt..."
docker compose run --rm certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "${DOMAIN_WEBSITE}" \
    -d "${DOMAIN_ADMIN}" \
    -d "${DOMAIN_API}" \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --force-renewal

# حذف config موقت
rm -f nginx/conf.d/temp-http.conf

# ری‌استارت nginx با config اصلی
docker compose restart nginx

echo ""
echo "=== SSL با موفقیت فعال شد! ==="
echo "https://${DOMAIN_WEBSITE}"
echo "https://${DOMAIN_ADMIN}"
echo "https://${DOMAIN_API}"
