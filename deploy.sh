#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# استقرارِ سرویس‌های Pro-Chart + پاک‌سازیِ خودکارِ کشِ Cloudflare (فراموش‌نشدنی).
#
# استفاده:
#   bash deploy.sh                      → پیش‌فرض: فقط پنلِ ادمین (admin-frontend)
#   bash deploy.sh api                  → فقط بک‌اندِ api
#   bash deploy.sh admin-frontend api   → چند سرویس با هم
#   bash deploy.sh --all                → همهٔ سرویس‌های اپ (api + فرانت‌ها + workerها)
#
# در پایان، همیشه کشِ edgeِ Cloudflare purge می‌شود تا کاربران نسخهٔ تازه را ببینند.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE="docker compose -p prochart -f docker-compose.prochart.yml"

if [ "${1:-}" = "--all" ]; then
  SERVICES=(api admin-frontend frontend-prochart data-feed crypto-ws news-worker)
else
  SERVICES=("$@")
  [ ${#SERVICES[@]} -eq 0 ] && SERVICES=(admin-frontend)
fi

echo "▶ build:  ${SERVICES[*]}"
$COMPOSE build "${SERVICES[@]}"

echo "▶ deploy: ${SERVICES[*]}"
$COMPOSE up -d --no-build "${SERVICES[@]}"

echo "▶ waiting for containers to settle..."
sleep 6
$COMPOSE ps

# پاک‌سازیِ Cloudflare — فقط اگر .cf (توکن/zone) موجود باشد.
if [ -f .cf ]; then
  echo "▶ purging Cloudflare edge cache..."
  bash cf_purge.sh
else
  echo "⚠ .cf یافت نشد — purge رد شد (توکن/zone تنظیم نشده)."
fi

echo "✅ استقرار + purge کامل شد."
