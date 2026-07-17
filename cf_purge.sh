#!/usr/bin/env bash
# Cloudflare cache purge برای pro-chart.com — پاک‌سازیِ فوریِ edge بعد از deploy.
# نیاز: فایلِ /home/bazaarnama/Pro-Chart/app/.cf با دو خط:
#   CF_API_TOKEN=<توکن با دسترسیِ Zone→Cache Purge روی pro-chart.com>
#   CF_ZONE_ID=<zone id دامنهٔ pro-chart.com>
# استفاده:  bash cf_purge.sh            → purge everything
#           bash cf_purge.sh <url> ...  → purge فقط این URLها
set -euo pipefail
CFENV="$(dirname "$0")/.cf"
if [ -L "$CFENV" ]; then
  echo "cf_purge: فایلِ .cf نباید symbolic link باشد" >&2
  exit 2
fi
[ -f "$CFENV" ] || { echo "cf_purge: فایلِ .cf نیست (توکن/zone تنظیم نشده)"; exit 2; }
if [ "$(stat -c '%u' -- "$CFENV")" != "$(id -u)" ]; then
  echo "cf_purge: مالکِ .cf باید کاربرِ اجراکننده باشد" >&2
  exit 2
fi
CF_MODE="$(stat -c '%a' -- "$CFENV")"
if (( (8#$CF_MODE & 077) != 0 )); then
  echo "cf_purge: دسترسیِ .cf بیش‌ازحد باز است؛ chmod 600 .cf اجرا شود" >&2
  exit 2
fi
set -a; . "$CFENV"; set +a
: "${CF_API_TOKEN:?CF_API_TOKEN لازم است}"; : "${CF_ZONE_ID:?CF_ZONE_ID لازم است}"
API="https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache"
if [ "$#" -eq 0 ]; then
  BODY='{"purge_everything":true}'
else
  FILES=$(printf '"%s",' "$@" | sed 's/,$//'); BODY="{\"files\":[${FILES}]}"
fi
RESP=$(curl -s -X POST "$API" -H "Authorization: Bearer ${CF_API_TOKEN}" -H "Content-Type: application/json" --data "$BODY")
echo "$RESP" | grep -q '"success":true' && echo "cloudflare purged ✓" || { echo "purge failed: $RESP"; exit 1; }
