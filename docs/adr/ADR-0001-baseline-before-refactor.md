# ADR-0001: Baseline پیش از Refactor

- وضعیت: پذیرفته
- تاریخ: ۲۰۲۶-۰۷-۱۴
- الزام‌های مرتبط: PC-001، PC-002، PC-004، PC-005، PC-044، PC-075، PC-135، PC-153، PC-159، PC-160

## مسئله

Repository دارای ۶۰۵ تغییر ازپیش‌موجود، رفتار host-based، چند compose، ۴۱ migration، routeهای unmounted و پوشش Browser ناچیز است. Refactor پیش از شناخت رفتار می‌تواند قابلیت فعلی یا داده کاربر را حذف کند.

## محدودیت‌ها

- تغییرهای موجود متعلق به کاربر فرض می‌شوند و نباید Revert یا Overwrite شوند.
- فقط LBank و OneRoyal در محصول مجازند.
- UI عمومی فارسی/RTL و حفظ route/data قدیمی الزام است.
- COMPLETE فقط با شواهد Matrix و سه Clean run مجاز است.

## گزینه‌ها

1. Rewrite سریع Shell و Chart؛ رد شد، چون رفتار و migration فعلی محافظ ندارد.
2. Refactor موضعی بدون Browser baseline؛ رد شد، چون Visual/State regression قابل اثبات نیست.
3. Backup، Static inventory، Browser crawl، Characterization و سپس Increment کوچک؛ انتخاب شد.

## داده و Benchmark

- Worktree مبنا: ۶۰۵ entry.
- API در لحظه تصمیم: ۴۶۸ route فعال و ۷۸ endpoint unmounted. Delta بعدی Baseline، `live.router` را با contract حفاظتی mount کرد و شمارش current-source را به ۴۸۷ route object و ۶۰ decorator unmounted رساند؛ این ADR اعداد تاریخی زمان تصمیم را حفظ می‌کند.
- Tests: ۵۱۸ تست Python و صفر Playwright/Axe/Web Vitals gate.
- Restore drill dump کامل: PASS با برابری ۳۷۹ table.

## تصمیم

تا تکمیل Baseline، فقط تغییرهای ایمن‌سازی، مستندسازی، test harness و Characterization مجازند. هر Increment بعدی باید یک Requirement ID، test شکست‌خورده، پیاده‌سازی کامل، evidence و rollback داشته باشد.

## پیامدهای مثبت

- قابلیت فعلی و داده قابل مقایسه می‌شود.
- تغییرهای کاربر از تغییرهای این چرخه جدا می‌ماند.
- Regression بصری، API و migration قابل ردیابی می‌شود.

## پیامدهای منفی

- پیاده‌سازی Feature جدید تا عبور Gate فاز صفر به‌تعویق می‌افتد.
- ساخت fixture و harness اولیه هزینه دارد.

## راه بازگشت

فایل‌های این Increment مستقل و untracked هستند؛ حذف آن‌ها رفتار Production را تغییر نمی‌دهد. Backup محدودشده و Worktree patch پیش از ایجادشان موجود است.
