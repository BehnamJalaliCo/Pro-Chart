# Pro-Chart — راهنمای Claude Code

**اول از همه `docs/SERVER-HANDOFF.md` را کامل بخوان** — کلِ وضعیتِ پروژه، قوانینِ مالک، و نقشهٔ راهِ M1..M8 آنجاست.

## قوانینِ مطلق
- ⛔ هیچ سرور/سرویس/DBای را بدونِ تأییدِ صریحِ مالک تغییر نده یا حذف نکن؛ پیش‌فرض: فقط-خواندنی.
- ⛔ هیچ secret/token را هرگز commit نکن (gitleaks + push-protection فعال است). توکنِ هتزنر: `/root/.secrets/hetzner_token` (فقط GET).
- زبانِ گفتگو با مالک: فارسی. مدلِ ترجیحیِ مالک: `claude-fable-5`.

## نکاتِ فنیِ حیاتی
- برنچِ توسعه: `claude/android-apk-project-build-l9a960`
- فرانتِ اپ: `frontend/prochart/` — بیلد: `VITE_API_URL=https://pro-chart.com/api npm run build` (دیباگِ خوانا: `NO_OBF=1`)
- **چانکِ dynamic/React.lazy ممنوع** (در APK گم می‌شود) — تک‌چانک در vite.config.js اعمال شده.
- APK اندروید: workflow `android-apk.yml` → GitHub Release تگِ `android-apk-<N>` (debug + release امضاشده با کلیدِ پایدارِ Secrets).
- اسکریپت‌های ممیزیِ فقط-خواندنیِ سرورها: `scripts/audit/`
