# بازیابیِ کاملِ CoinePro-FX از گوگل‌درایو

این بکاپ شاملِ **۱۰۰٪ پروژه** است: کل کد، `.env` و همهٔ کلیدها، ویدیوهای آکادمی،
مدل‌های ML، voiceها، کانفیگ‌های nginx/docker، crontab و دامپِ دیتابیس/redis.

## ساختار در درایو (`CoinePro-FX-Backups/`)
- `project-mirror/` — آینهٔ کاملِ `/home/forex/CoinePro-FX` (همیشه به‌روز، sync افزایشی).
- `db/<TS>/` — اسنپ‌شاتِ تاریخ‌دار: `database_dump.sql.gz`، `redis_dump.rdb`،
  `crontab.txt`، `docker-compose.resolved.yml`، `docker_volumes.txt` (نگه‌داریِ ۱۴ روز).

## مراحلِ بازیابی روی سرورِ نو
```bash
# 0) پیش‌نیاز: docker + docker compose + rclone
# 1) دانلودِ آینهٔ پروژه
rclone copy gdrive:CoinePro-FX-Backups/project-mirror /home/forex/CoinePro-FX --transfers 8
# 2) دانلودِ آخرین اسنپ‌شاتِ دیتابیس (جدیدترین پوشهٔ db/)
rclone copy "gdrive:CoinePro-FX-Backups/db/<جدیدترین-TS>" /home/forex/restore_db
# 3) بالا آوردنِ زیرساخت
cd /home/forex/CoinePro-FX
docker compose up -d timescaledb redis
sleep 15
# 4) بازگردانیِ دیتابیس
gunzip -c /home/forex/restore_db/database_dump.sql.gz | docker compose exec -T timescaledb psql -U coinepro -d forex_signal
# 5) بازگردانیِ redis (اختیاری)
docker compose cp /home/forex/restore_db/redis_dump.rdb redis:/data/dump.rdb
docker compose restart redis
# 6) ساخت و بالا آوردنِ کلِ سرویس‌ها
docker compose build && docker compose up -d
docker compose exec api alembic upgrade head
# 7) بازگردانیِ crontab (بکاپ‌های خودکار)
crontab /home/forex/restore_db/crontab.txt
```

## بازتولیدِ موارد کنارگذاشته (دانلودی، در بکاپ نیستند)
- `avatar_work/Wav2Lip/` — وزن‌های مدلِ لب‌سینک (از مخزنِ عمومی Wav2Lip دانلود شود).
- `node_modules/`, `frontend/*/dist/` — با `npm install` و `npm run build`.
- فریم‌های میانیِ render — هنگامِ تولیدِ دوبارهٔ ویدیو ساخته می‌شوند.
