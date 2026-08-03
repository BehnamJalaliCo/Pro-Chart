# Pro-Chart — راهنمای Claude Code

**اول از همه `docs/SERVER-HANDOFF.md` را کامل بخوان** — کلِ وضعیتِ پروژه، قوانینِ مالک، و نقشهٔ راهِ M1..M8 آنجاست.

## قوانینِ مطلق
- ⛔ هیچ سرور/سرویس/DBای را بدونِ تأییدِ صریحِ مالک تغییر نده یا حذف نکن؛ پیش‌فرض: فقط-خواندنی.
- زبانِ گفتگو با مالک: فارسی. مدلِ ترجیحیِ مالک: `claude-fable-5`.

## ریپو (به‌روزرسانیِ ۲۰۲۶-۰۸-۰۳)
- ریپوی فعال: **`https://github.com/BehnamJalaliCo/Pro-Chart`** (private).
  دو اکانتِ قبلی (`behnamjalali88/pro-chart` و سپس `BehnamJalali-Co/Pro-Chart`)
  تعلیق شدند و هر دو ۴۰۴ هستند؛ توکن‌هایشان باطل است.
- ریشهٔ گیت `/home/bazaarnama/Pro-Chart/app` است (نه `Pro-Chart/`). فایل‌هایی که
  یک سطح بالاتر بودند در `server-home/` کپی شده‌اند — `server-home/README.md`.
- ⚠️ قانونِ «هرگز secret کامیت نکن» **به دستورِ صریحِ مالک لغو شد**: ریپو private
  است و کلِ `.env`، `.cf`، `certbot/`، `secrets/` و کلیدهای JWT روی آن هستند.
  یعنی: **این ریپو هرگز نباید public شود** و توکنش مثلِ یک راز نگه‌داری شود.
- **Git LFS دیگر استفاده نمی‌شود.** سه فایلِ سنگینِ بی‌ربط (`wav2lip_gan.pth`،
  `blogvid_demo916.mp4`، `database.dump`) به دستورِ مالک هم از سرور و هم از
  تاریخچهٔ گیت حذف شدند و `.gitattributes` برداشته شد. هیچ فایلی در ریپو
  بالای ۱۰۰ مگابایت نیست. اگر روزی لازم شد، `git-lfs` در `~/.local/bin` هست.
- `.gitignore` از ۲۰۲۶-۰۸-۰۳ فقط `node_modules/` و `__pycache__/` را بیرون
  می‌گذارد. **`artifacts/` (۴.۶ گیگابایت خروجیِ تست) هم روی ریپو رفت.** تنها
  استثنای دیگر: `artifacts/qa/grype-db-cache/6/vulnerability.db` (۱.۶ گیگ،
  بالاتر از سقفِ ۱۰۰ مگابایتیِ گیت‌هاب — بدونِ LFS نمی‌شود فرستاد).

## نکاتِ فنیِ حیاتی
- برنچِ توسعه: `claude/android-apk-project-build-l9a960`
- فرانتِ اپ: `frontend/prochart/` — بیلد: `VITE_API_URL=https://pro-chart.com/api npm run build` (دیباگِ خوانا: `NO_OBF=1`)
- **چانکِ dynamic/React.lazy ممنوع** (در APK گم می‌شود) — تک‌چانک در vite.config.js اعمال شده.
- APK اندروید: workflow `android-apk.yml` → GitHub Release تگِ `android-apk-<N>` (debug + release امضاشده با کلیدِ پایدارِ Secrets).
  ⚠️ چهار سیکرتِ `ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` /
  `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` با اکانتِ قبلی از بین رفتند و
  کپی‌شان روی سرور نیست. تا وقتی مالک keystore را دوباره نسازد و در
  Settings→Secrets ریپوی جدید بگذارد، بیلدِ release امضا نمی‌شود.
- اسکریپت‌های ممیزیِ فقط-خواندنیِ سرورها: `scripts/audit/`
