#!/bin/sh
# nginx-reloader — هر بار کانتینرِ api یا فرانت‌اندها (re)start شوند، nginx را reload
# می‌کند تا IPِ جدید را بگیرد. رفعِ ریشه‌ایِ «۵۰۲ بعد از recreate» بدونِ دست‌زدن به
# کانفیگِ routing. nginx با ارسالِ سیگنالِ HUP بدونِ قطعی reload می‌شود.
set -u
echo "[nginx-reloader] started; watching docker start events…"

# کانتینرِ nginx را با imageِ آن پیدا می‌کند (تا با خودِ reloader اشتباه نشود)
find_nginx() {
  docker ps -q --filter ancestor=nginx:alpine | head -1
}

# یک reloadِ اولیه (محضِ اطمینان از تازه‌بودنِ resolveها)
sleep 5
nid=$(find_nginx); [ -n "$nid" ] && docker kill -s HUP "$nid" >/dev/null 2>&1

docker events --filter 'event=start' --format '{{.Actor.Attributes.name}}' |
while read -r name; do
  case "$name" in
    *-api-*|*-frontend-website-*|*-frontend-admin-*)
      # کمی صبر تا سرویس کاملاً بالا و آمادهٔ پاسخ شود
      sleep 3
      nid=$(find_nginx)
      if [ -n "$nid" ]; then
        docker kill -s HUP "$nid" >/dev/null 2>&1 \
          && echo "[nginx-reloader] reloaded nginx after start of $name"
      fi
      ;;
  esac
done
