#!/bin/bash
# بکاپِ کاملِ سرورِ BazaarNama (pro-chart) به همان گوگل‌درایوِ مشترک، فولدرِ جدا.
# روی خودِ pro-chart اجرا می‌شود (root). مقصد: gdrive:BazaarNama-Backups
set -u
exec 9>/tmp/gdrive_backup_bn.lock
flock -n 9 || { echo "[1000 27 100 1000 1001date +%F_%T)] backup already running — skip"; exit 0; }
RCLONE=/usr/bin/rclone
CONF=/root/.config/rclone/rclone.conf
PROJECT=/home/bazaarnama/Pro-Chart
REMOTE="gdrive:BazaarNama-Backups"
TS=$(date +%Y-%m-%d_%H%M%S)
TMP="/tmp/bn_bk_$TS"
mkdir -p "$TMP"
echo "[$TS] BazaarNama gdrive backup start"

# ۱) دامپِ دیتابیس + redis/valkey + crontab
docker exec -t prochart-timescaledb-1 pg_dump -U coinepro -d forex_signal 2>/dev/null | gzip > "$TMP/database_dump.sql.gz"
docker exec prochart-redis-1 sh -c 'redis-cli SAVE || valkey-cli SAVE' >/dev/null 2>&1
docker cp prochart-redis-1:/data/dump.rdb "$TMP/redis_dump.rdb" >/dev/null 2>&1
crontab -l > "$TMP/crontab.txt" 2>/dev/null

# ۲) آینهٔ کاملِ ۱:۱ — همه‌چیز (node_modules، .git، …). فقط backup-logs کنار.
$RCLONE --config "$CONF" sync "$PROJECT" "$REMOTE/project-mirror" \
  --copy-links \
  --exclude '/backup-logs/' \
  --transfers 32 --checkers 64 --fast-list --drive-pacer-min-sleep 10ms --drive-pacer-burst 200 --drive-chunk-size 64M 2>&1 | tail -2

# ۳) اسنپ‌شاتِ تاریخ‌دارِ دیتابیس
$RCLONE --config "$CONF" copy "$TMP" "$REMOTE/db/$TS" --transfers 4 2>&1 | tail -1

# ۴) هرسِ اسنپ‌شاتِ قدیمی‌ترِ از ۱۴ روز
$RCLONE --config "$CONF" delete "$REMOTE/db" --min-age 14d 2>/dev/null
$RCLONE --config "$CONF" rmdirs "$REMOTE/db" --leave-root 2>/dev/null

rm -rf "$TMP"
echo "[$TS] BazaarNama gdrive backup done"
