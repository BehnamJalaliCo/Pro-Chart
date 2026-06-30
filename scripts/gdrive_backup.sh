#!/bin/bash
# بکاپِ کاملِ ۱۰۰٪ پروژه به گوگل‌درایو (rclone).
# project-mirror: sync افزایشیِ همهٔ فایل‌ها (کد/ویدیو/مدل/کانفیگ).
# db/<TS>: دامپِ دیتابیس + redis + crontab + RESTORE (نگه‌داریِ ۱۴ روز).
set -u
RCLONE=/home/forex/bin/rclone
CONF=/home/forex/.config/rclone/rclone.conf
PROJECT=/home/forex/CoinePro-FX
REMOTE="gdrive:CoinePro-FX-Backups"
TS=$(date +%Y-%m-%d_%H%M%S)
TMP="/tmp/gdrive_bk_$TS"
mkdir -p "$TMP"
cd "$PROJECT" || exit 1
DB=$(grep -E "^DB_NAME=" .env | cut -d= -f2); DB=${DB:-forex_signal}

echo "[$TS] gdrive backup start"

# ۱) دامپِ دیتابیس + redis + سیستم
docker compose exec -T timescaledb pg_dump -U coinepro -d "$DB" 2>/dev/null | gzip > "$TMP/database_dump.sql.gz"
docker compose exec -T redis redis-cli SAVE >/dev/null 2>&1
docker compose cp redis:/data/dump.rdb "$TMP/redis_dump.rdb" >/dev/null 2>&1
crontab -l > "$TMP/crontab.txt" 2>/dev/null
docker compose config > "$TMP/docker-compose.resolved.yml" 2>/dev/null
docker volume ls > "$TMP/docker_volumes.txt" 2>/dev/null
cp "$PROJECT/RESTORE_GDRIVE.md" "$TMP/" 2>/dev/null
# گواهی‌های SSL (مالکِ root) — از طریقِ docker خوانده و tar می‌شوند (forex اجازهٔ مستقیم ندارد)
docker run --rm -v "$PROJECT/certbot/conf:/cb:ro" alpine sh -c 'tar czf - -C /cb .' > "$TMP/certbot_conf.tar.gz" 2>/dev/null

# ۲) sync کاملِ فایل‌ها (افزایشی) — کلِ محتوای واقعی؛ فقط آرتیفکت‌های قابلِ‌بازتولید کنار می‌رود.
#    الگوهای پوشه‌ایِ پایانی‌اسلش = rclone اصلاً واردِ آن پوشه‌ها نمی‌شود (هرس) → اسکنِ سریع.
#    (node_modules=۱۰٬۴۲۶ فایلِ ریز و ۱۰۰٪ با `npm install` ساخته می‌شود؛ package.json بکاپ می‌شود)
$RCLONE --config "$CONF" sync "$PROJECT" "$REMOTE/project-mirror" \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '__pycache__/' --exclude '*.pyc' \
  --exclude '/logs/' \
  --exclude '/certbot/conf/' \
  --exclude '/avatar_work/frames/' \
  --exclude '/avatar_work/stage/' \
  --transfers 8 --checkers 16 --drive-chunk-size 64M 2>&1 | tail -2

# ۳) آپلودِ اسنپ‌شاتِ دیتابیس (تاریخ‌دار)
$RCLONE --config "$CONF" copy "$TMP" "$REMOTE/db/$TS" --transfers 4 2>&1 | tail -1

# ۴) هرسِ اسنپ‌شات‌های قدیمی‌ترِ از ۱۴ روز
$RCLONE --config "$CONF" delete "$REMOTE/db" --min-age 14d 2>/dev/null
$RCLONE --config "$CONF" rmdirs "$REMOTE/db" --leave-root 2>/dev/null

rm -rf "$TMP"
echo "[$TS] gdrive backup done"
