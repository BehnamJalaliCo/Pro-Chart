# server-home — فایل‌های سرور که بیرونِ ریشهٔ ریپو بودند

ریشهٔ گیت روی `/home/bazaarnama/Pro-Chart/app` است تا کلِ تاریخچهٔ کامیت‌ها دست‌نخورده بماند.
اما چند فایل و پوشهٔ مربوط به پروژه یک سطح بالاتر (یا در `$HOME`) بودند و بیرونِ ریپو می‌ماندند.
اینجا عیناً (با `cp -a`) کپی شده‌اند تا چیزی جا نماند.

## نقشهٔ مسیرها

| در ریپو | مسیرِ واقعی روی سرور |
|---|---|
| `Pro-Chart/gdrive_backup.sh` | `/home/bazaarnama/Pro-Chart/gdrive_backup.sh` |
| `Pro-Chart/build.log` | `/home/bazaarnama/Pro-Chart/build.log` |
| `Pro-Chart/backup-logs/` | `/home/bazaarnama/Pro-Chart/backup-logs/` |
| `Pro-Chart/.claude/` | `/home/bazaarnama/Pro-Chart/.claude/` |
| `home/docker-cache-cleanup.sh` + `.log` | `/home/bazaarnama/` |
| `home/codex-install2.log` | `/home/bazaarnama/codex-install2.log` |
| `home/.gitconfig` `.bashrc` `.bashrc.backup` `.profile` `.npmrc` `.boto` | `/home/bazaarnama/` |
| `home/crontab.txt` | خروجیِ `crontab -l` |
| `docker-ps.txt` / `docker-volumes.txt` | عکسِ لحظه‌ایِ وضعیتِ داکر |

## آنچه عمداً اینجا نیست

- `Pro-Chart/.codex-backups/` — بکاپِ یک‌بارهٔ ۱۴ ژوئیهٔ کدکس (۲۱۸ مگابایت، ۳۰۱۶ فایل).
  به خواستِ مالک از گیت حذف شد؛ نسخهٔ اصلی روی سرور و گوگل‌درایو هست.

- `~/.ssh/` — کلیدهای ورود به خودِ سرور. گذاشتنِ آن‌ها در ریپو یعنی هر کسی که
  به این ریپو دسترسی پیدا کند به سرور هم دسترسی دارد. جدا و آفلاین نگه‌داری شود.
- `~/.git-credentials` — توکنِ زندهٔ همین ریپو.
- `~/google-cloud-sdk/`، `~/vertex-env/`، `~/.npm/`، `~/.cache/`، `~/.local/`،
  `~/.npm-global/` — نصب/کشِ ابزار، با یک دستور بازنصب می‌شوند.
- `~/.claude/` و `~/.codex/` — لاگِ نشست‌های دستیارها (چند صد مگابایت متن)،
  محتوای پروژه نیستند.
- حجم‌های داکر (`prochart_tsdb_data`, `prochart_redis_data`,
  `central-auth_central_pg`, `prochart_llm_creds`) — دادهٔ زندهٔ دیتابیس؛
  بکاپشان از مسیرِ `gdrive_backup.sh` می‌رود، نه گیت.
