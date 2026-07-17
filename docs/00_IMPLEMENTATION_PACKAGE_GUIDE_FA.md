# راهنمای بسته پیاده‌سازی Pro Chart

این بسته، ورودی مرجع برای اجرای پروژه در Codex است. ترتیب استفاده:

1. فایل `01_PROCHART_MASTER_SPEC_FA.md` را در ریشه Repository یا پوشه `docs/` قرار دهید و آن را منبع حقیقت واحد پروژه نگه دارید.
2. فایل‌های `03_REQUIREMENTS_MATRIX.csv` و `03_REQUIREMENTS_MATRIX.json` را کنار سند مادر قرار دهید. وضعیت هر الزام باید با شاهد قابل‌بازتولید به‌روزرسانی شود.
3. محتوای کامل `02_CODEX_MASTER_PROMPT_FA.md` را در Session اصلی Codex وارد کنید؛ آن را خلاصه یا تکه‌تکه نکنید.
4. فایل `04_REFERENCE_SOURCES.md` را برای بازبینی دوره‌ای منابع رسمی، APIها، محدودیت‌های منطقه‌ای و استانداردها نگه دارید.
5. Codex باید ابتدا Baseline کامل Repository را بسازد و سپس چرخه پیاده‌سازی، آزمون، مقایسه تصویری/حرکتی، رفع Regression و ثبت شواهد را ادامه دهد.
6. اعلام `COMPLETE` فقط طبق Gateهای سند و پس از سه اجرای Clean متوالی مجاز است. در نبود دسترسی یا وابستگی خارجی، وضعیت باید `BLOCKED` با شواهد و دستور Resume باشد.

## فایل‌های اصلی

- `01_PROCHART_MASTER_SPEC_FA.md`: سند مادر محصول، معماری، پیاده‌سازی و پذیرش.
- `02_CODEX_MASTER_PROMPT_FA.md`: پرامپت اجرایی و حلقه ادامه کار Codex.
- `03_REQUIREMENTS_MATRIX.csv`: ماتریس ۱۶۲ الزام برای ویرایش مستقیم و CI.
- `03_REQUIREMENTS_MATRIX.json`: نسخه ماشینی ماتریس.
- `04_REFERENCE_SOURCES.md`: فهرست منابع رسمی.

## نسخه‌های خواندنی

- `ProChart_Master_Spec_FA.docx` و `ProChart_Master_Spec_FA.pdf`
- `ProChart_Codex_Prompt_FA.docx` و `ProChart_Codex_Prompt_FA.pdf`
- `ProChart_Requirements_Matrix_FA.docx` و `ProChart_Requirements_Matrix_FA.pdf`

## محدودیت‌های ثابت محصول

- رابط عمومی فارسی و RTL واقعی؛ انگلیسی فقط برای برندها، نمادها، کدها و اصطلاح‌های فنی مصوب.
- تنها صرافی قابل نمایش: LBank با لینک معرفی دقیق `https://www.lbank.com/ref/PROCHART`.
- تنها بروکر قابل نمایش: OneRoyal با لینک معرفی دقیق `https://vc.cabinet.oneroyal.com/fa/links/go/12412`.
- هیچ قابلیت موجود Pro Chart بدون مسیر مهاجرت، آزمون و تأیید صریح حذف یا غیرفعال نمی‌شود.
- دارایی، داده و اتصال شخص ثالث فقط از مسیر رسمی یا مجاز در معماری Production استفاده می‌شود؛ تصاویر مرجع صرفاً برای QA داخلی کنترل‌شده هستند.