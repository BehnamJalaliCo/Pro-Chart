#!/usr/bin/env bash
# ممیزیِ داخلِ سرورِ لینوکسی — ۱۰۰٪ فقط-خواندنی. هیچ‌چیز را تغییر نمی‌دهد.
# رازها (رمزها/.env) را عمداً چاپ نمی‌کند — فقط نامِ سرویس‌ها و ساختار.
# اجرا روی هر سرور:  bash server-audit.sh > audit-$(hostname).txt
set -uo pipefail
sec(){ echo; echo "===== $1 ====="; }

sec "HOST"
hostname; uname -a; uptime
sec "OS"
cat /etc/os-release 2>/dev/null | head -3
sec "RESOURCES"
nproc; free -h | head -2; df -h --output=target,size,used,pcent 2>/dev/null | head -8
sec "DOCKER CONTAINERS"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo "(docker نیست/دسترسی نیست)"
sec "DOCKER COMPOSE PROJECTS"
docker compose ls 2>/dev/null || true
find / -maxdepth 4 -name "docker-compose*.yml" -not -path "*/node_modules/*" 2>/dev/null | head -10
sec "SYSTEMD SERVICES (running, غیرسیستمی)"
systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | grep -viE "systemd|dbus|network|ssh|cron|getty|polkit|udev|journal|logind|resolved|timesync" | head -20
sec "LISTENING PORTS"
ss -tlnp 2>/dev/null | head -25 || netstat -tlnp 2>/dev/null | head -25
sec "NGINX SITES"
ls /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>/dev/null
grep -rh "server_name" /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>/dev/null | sort -u | head -15
sec "DATABASES (فقط نام)"
docker exec $(docker ps -qf "name=timescale" | head -1) psql -U ${DB_USER:-postgres} -lqt 2>/dev/null | cut -d'|' -f1 | grep -v template | head -10 || echo "(از داخل کانتینر جواب نداد — اشکالی ندارد)"
sec "CRON"
crontab -l 2>/dev/null | grep -v "^#" | head -10 || echo "(خالی)"
sec "PROJECT DIRS"
ls -d /opt/* /srv/* /root/*/ /home/*/*/ 2>/dev/null | grep -viE "snap|cache" | head -15
sec "ENV FILE NAMES (فقط کلیدها، نه مقدارها)"
for f in $(find /root /opt /srv /home -maxdepth 3 -name ".env" 2>/dev/null | head -5); do echo "-- $f"; cut -d= -f1 "$f" | grep -v "^#" | head -25; done
echo; echo "DONE — این خروجی را برای Claude بفرست."
