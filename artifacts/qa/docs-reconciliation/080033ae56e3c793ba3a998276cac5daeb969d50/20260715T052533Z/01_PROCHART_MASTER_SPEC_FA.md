<!--
منبع: ProChart_Master_Spec_FA.docx
SHA-256: 35b325713034406dfa5fbdf11a95e68da508f5892ef571bfad1fe366f27ae7b8
تبدیل مکانیکی برای استفاده به‌عنوان منبع حقیقت Repository؛ محتوای الزام‌ها تغییر نکرده است.
-->

# PRO CHART

سند مادر محصول، معماری، پیاده‌سازی و پذیرش Pro Chart

مبنای الزام‌آور برای طراحی، توسعه، آزمون و تحویل

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

نسخه ۱.۰  •  ۱۴ ژوئیه ۲۰۲۶

## فهرست مطالب

راهنمای استفاده از این سند

۱. فرمان محصول

۱.۱ اصول غیرقابل مذاکره

۱.۲ چیزهایی که نباید در محصول دیده شوند

۲. تعریف دقیق «۱۰۰٪» و معیار توقف

۲.۱ شش محور برابری

۲.۲ معیار توقف نهایی Codex

۳. جایگاه محصول و مزیت رقابتی

۳.۱ وعده اصلی

۳.۲ مزیت‌های الزامی برای فارسی‌زبانان

۳.۳ اصول تجربه

۴. کاربران و سناریوهای اصلی

۴.۱ شخصیت‌های هدف

۴.۲ سفرهای P0

۵. دامنه نسخه هدف

۵.۱ در دامنه

۵.۲ خارج از دامنه مگر با دستور بعدی

۶. حفظ کامل Pro Chart موجود

۶.۱ Baseline اجباری پیش از اولین تغییر

۶.۲ سیاست عدم حذف

۷. ماتریس شکاف در برابر استاندارد بازار

۸. معماری اطلاعات و Routeها

۸.۱ ساختار اصلی دسکتاپ

۸.۲ Routeهای پیشنهادی

۸.۳ ساختار موبایل

۹. سیاست زبان، RTL و Microcopy

۹.۱ قواعد پایه

۹.۲ Whitelist اصطلاح‌های انگلیسی

۹.۳ نمونه Microcopy مصوب

۹.۴ آزمون زبانی خودکار

۱۰. Design System و برابری بصری

۱۰.۱ راهبرد

۱۰.۲ Tokenهای پایه

۱۰.۳ Componentهای اجباری

۱۰.۴ آیکون‌ها و لوگوها

۱۰.۵ معیار Visual Fidelity

۱۱. Motion، Gesture و رفتار تعاملی

۱۱.۱ اصول حرکت

۱۱.۲ Gestureهای چارت

۱۱.۳ Motion Regression

۱۲. موتور چارت

۱۲.۱ معماری پیشنهادی

۱۲.۲ انواع چارت

۱۲.۳ Scale و محور

۱۲.۴ Multi-pane و Multi-chart

۱۲.۵ Drawing scene graph

۱۲.۶ خروجی و اشتراک

۱۳. لایه داده بازار

۱۳.۱ اصل Adapter-based

۱۳.۲ مدل Instrument

۱۳.۳ قرارداد OHLCV

۱۳.۴ Streaming

۱۳.۵ Cache و تاریخچه

۱۳.۶ کیفیت داده

۱۴. LBank: تنها صرافی مجاز

۱۴.۱ دامنه نمایش

۱۴.۲ سطح‌های یکپارچه‌سازی

۱۴.۳ کنترل محدوده جغرافیایی

۱۴.۴ آزمون‌های حیاتی LBank

۱۵. OneRoyal: تنها بروکر مجاز

۱۵.۱ دامنه نمایش

۱۵.۲ سطح فعلی پیشنهادی

۱۵.۳ Adapter آینده

۱۵.۴ کنترل محدوده جغرافیایی

۱۶. ابزارهای ترسیم

۱۶.۱ خانواده‌ها

۱۶.۲ رفتار مشترک

۱۶.۳ دقت

۱۷. اندیکاتورها

۱۷.۱ مجموعه P0

۱۷.۲ قرارداد اندیکاتور

۱۷.۳ صحت محاسبات

۱۷.۴ Indicator manager

۱۸. Layout، دیده‌بان و Workspace

۱۸.۱ Layout

۱۸.۲ دیده‌بان

۱۸.۳ Object Tree

۱۹. هشدارها

۱۹.۱ انواع شرط

۱۹.۲ اجرای سروری

۱۹.۳ کانال‌ها

۲۰. Replay، Backtest و Paper Trading

۲۰.۱ Replay

۲۰.۲ Backtest

۲۰.۳ Paper Trading

۲۱. NamaScript

۲۱.۱ هدف

۲۱.۲ اجزای پلتفرم

۲۱.۳ قواعد زبان

۲۱.۴ Editor

۲۱.۵ Debugger و Profiler

۲۱.۶ انتشار و مجوز

۲۱.۷ مثال حداقلی

۲۲. جست‌وجو، Screener و Heatmap

۲۲.۱ Symbol Search

۲۲.۲ Screener

۲۲.۳ Heatmap

۲۳. تقویم، اخبار و رویدادها

۲۳.۱ Calendar

۲۳.۲ News

۲۴. دستیار هوش مصنوعی و قابلیت گفتاری

۲۴.۱ نقش دستیار

۲۴.۲ اصل تأیید

۲۴.۳ Voice

۲۴.۴ ارزیابی AI

۲۵. حساب، احراز هویت و تنظیمات

۲۵.۱ ورود و ثبت‌نام

۲۵.۲ تنظیمات

۲۵.۳ سطح دسترسی و اشتراک

۲۶. معماری نرم‌افزار

۲۶.۱ اصل کلی

۲۶.۲ ماژول‌های Frontend

۲۶.۳ ماژول‌های Backend

۲۶.۴ API

۲۶.۵ Storage

۲۶.۶ Repository

۲۷. امنیت و حریم خصوصی

۲۷.۱ کنترل‌های پایه

۲۷.۲ NamaScript sandbox

۲۷.۳ Webhook و Provider keys

۲۷.۴ AI security

۲۷.۵ حریم خصوصی

۲۸. Performance و پایداری

۲۸.۱ Budgetهای Web

۲۸.۲ Budget چارت

۲۸.۳ Load و Resilience

۲۹. دسترس‌پذیری

۲۹.۱ الزامات

۲۹.۲ Accessibility overlay چارت

۳۰. Observability، Analytics و پشتیبانی

۳۰.۱ Telemetry

۳۰.۲ Product analytics

۳۰.۳ Support bundle

۳۱. روش شات‌به‌شات و مقایسه رفتار

۳۱.۱ محیط قفل‌شده

۳۱.۲ Viewportهای اجباری

۳۱.۳ State matrix هر صفحه

۳۱.۴ Pipeline تصویری

۳۱.۵ مقایسه با محصول مرجع

۳۱.۶ مسیرهای Screenshot اجباری

۳۲. راهبرد آزمون

۳۲.۱ هرم آزمون

۳۲.۲ Coverage

۳۲.۳ Flaky test

۳۲.۴ Test data

۳۳. CI/CD و کنترل کیفیت

۳۳.۱ Pipeline Pull Request

۳۳.۲ Pipeline Nightly

۳۳.۳ Release

۳۴. برنامه پیاده‌سازی

فاز ۰ - Baseline و ایمن‌سازی

فاز ۱ - Foundation

فاز ۲ - Chart Core و Data

فاز ۳ - تحلیل

فاز ۴ - Automation

فاز ۵ - NamaScript

فاز ۶ - کشف بازار و محتوا

فاز ۷ - اتصال‌های منتخب

فاز ۸ - Hardening و برابری

۳۵. خروجی‌های اجباری تیم

۳۵.۱ کد و زیرساخت

۳۵.۲ مستندات

۳۵.۳ گزارش وضعیت

۳۶. Risk Register

۳۷. Definition of Done هر قابلیت

۳۸. معیار پذیرش نهایی نسخه

۳۸.۱ Product

۳۸.۲ Engineering

۳۸.۳ Visual/Motion

۳۸.۴ Data/Trading

۳۹. قالب گزارش اختلاف بصری

۴۰. قالب ADR

۴۱. منابع فنی پایه

۴۲. فرمان نهایی به تیم اجرا

نسخه: ۱.۰ تاریخ مبنا: ۲۳ تیر ۱۴۰۵ / ۱۴ ژوئیه ۲۰۲۶ وضعیت: مبنای الزام‌آور برای طراحی، توسعه، آزمون و تحویل مالک محصول: Pro Chart هدف شماره ۱: ساخت بهترین سامانه تحلیل و معامله برای فارسی‌زبانان؛ از نظر کیفیت، عمق، سرعت و یکپارچگی در سطحی بالاتر از TradingView، بدون حذف قابلیت‌های موجود Pro Chart.

### راهنمای استفاده از این سند

این سند «منبع حقیقت واحد» پروژه است. هر تصمیم طراحی، پیاده‌سازی، آزمون و پذیرش باید به یک بند یا شناسه الزام در این سند متصل باشد. در صورت تعارض میان کد موجود، برداشت توسعه‌دهنده، تصویر مرجع و این سند، ترتیب اولویت چنین است:

۱. الزام‌های ثابت و امنیتی این سند؛

۲. رفتار صحیح و ثبت‌شده نسخه موجود Pro Chart؛

۳. قراردادهای داده و آزمون‌های خودکار؛

۴. طراحی و تصاویر مرجع تأییدشده؛

۵. تصمیم‌های جدید ثبت‌شده در ADR.

هیچ قابلیت موجودی صرفاً برای ساده‌شدن توسعه حذف، پنهان، غیرفعال یا جایگزین نمی‌شود. هر تغییر ناسازگار نیازمند مسیر مهاجرت، Feature Flag، آزمون بازگشت‌پذیری و تأیید صریح مالک محصول است.

## ۱. فرمان محصول

Pro Chart باید یک Superchart فارسی‌محور، سریع، دقیق، قابل‌اعتماد و قابل‌گسترش باشد که تحلیل تکنیکال، داده بازار، ابزارهای ترسیم، اندیکاتورها، اسکریپت‌نویسی، هشدار، Replay، Backtest، دیده‌بان، غربالگر، هوش مصنوعی و مسیرهای اتصال منتخب را در یک تجربه منسجم ارائه کند.

محصول نباید یک پوسته تصویری یا Demo ثابت باشد. همه اجزای قابل‌کلیک باید رفتار واقعی، وضعیت‌های کامل، ذخیره‌سازی پایدار، خطایابی، Undo/Redo، دسترس‌پذیری و آزمون خودکار داشته باشند. هیچ دکمه، پنجره، تب، اندیکاتور، ابزار یا مسیر اصلی با داده ساختگی دائمی، Placeholder یا تابع خالی تحویل‌پذیر نیست.

### ۱.۱ اصول غیرقابل مذاکره

- رابط عمومی کاملاً فارسی و راست‌به‌چپ است؛ فقط نام برندها، نمادها، کدها و اصطلاح‌های فنی مصوب می‌توانند انگلیسی باشند.

- Pro Chart هویت بصری مستقل دارد. کیفیت، چگالی، هندسه و رفتار می‌تواند هم‌سطح مرجع باشد، اما کد، فونت، SVG، تصویر، متن اختصاصی یا Asset شخص ثالث از منبع غیرمجاز استخراج نمی‌شود.

- همه قابلیت‌های فعلی پیش از تغییر مستندسازی و با آزمون Golden محافظت می‌شوند.

- تنها صرافی معرفی‌شده LBank و تنها بروکر معرفی‌شده OneRoyal است. هیچ نام، لوگو، منو یا اتصال صرافی/بروکر دیگری در محصول نمایش داده نمی‌شود مگر با دستور مکتوب بعدی مالک محصول.

- لینک LBank دقیقاً https://www.lbank.com/ref/PROCHART است.

- لینک OneRoyal دقیقاً https://vc.cabinet.oneroyal.com/fa/links/go/12412 است.

- لینک‌های معرفی باید با برچسب شفاف «لینک معرفی» و از مسیر Redirect داخلی قابل‌اندازه‌گیری باز شوند؛ مقصد نهایی نباید تغییر کند.

- منبع داده، مجوز، محدوده جغرافیایی و شرایط استفاده هر ارائه‌دهنده باید قابل‌پیکربندی و ممیزی باشد.

- امنیت، صحت داده و جلوگیری از معامله ناخواسته مقدم بر سرعت تحویل است.

- نسخه دسکتاپ، تبلت و موبایل از یک Design System مشترک استفاده می‌کنند، اما صرفاً کوچک‌سازی نسخه دسکتاپ مجاز نیست.

### ۱.۲ چیزهایی که نباید در محصول دیده شوند

- متن انگلیسی عمومی مانند Save،Cancel،Settings یا Upgrade؛

- نام یا لوگوی صرافی‌ها و بروکرهای خارج از فهرست مجاز؛

- صفحه، منو یا CTA بدون کارکرد واقعی؛

- ادعای سود قطعی، سیگنال تضمینی یا وعده بازدهی؛

- کلید API، Secret، Token یا اطلاعات حساس در مرورگر، Log، Screenshot یا Repository؛

- متن یا برچسبی خارج از هویت رسمی Pro Chart؛

- لینک مستقیم ناشناخته یا Redirect غیرقابل ممیزی؛

- کپی فایل‌های اختصاصی شخص ثالث بدون مجوز روشن.

## ۲. تعریف دقیق «۱۰۰٪» و معیار توقف

در این پروژه «۱۰۰٪» یعنی تمام الزام‌های قابل‌اندازه‌گیری این سند در محدوده نسخه هدف، با شواهد خودکار و انسانی، پذیرفته شده باشند. «۱۰۰٪» به معنی یکسان‌بودن بایت‌های دو محصول، استخراج کد شخص ثالث یا صفر بودن اختلاف پیکسل‌های پویا نیست.

### ۲.۱ شش محور برابری

| محور | تعریف پذیرش |
| --- | --- |
| کارکردی | همه مسیرهای P0 و P1، حالت‌های موفق، خالی، بارگذاری، خطا، بدون شبکه و بازیابی را کامل کنند. |
| بصری | Geometry، فاصله، Typography، رنگ، Border، سایه، Layer و Responsive behavior با Design Baseline مصوب منطبق باشد. |
| حرکتی | مدت، Easing، ترتیب، نقطه شروع/پایان، Gesture و پاسخ‌گویی تعامل مطابق Motion Spec باشد. |
| داده | OHLCV، Session، Timezone، تعدیل، Gap، Stream و Backfill طبق قرارداد داده معتبر و قابل بازتولید باشد. |
| زبانی | هیچ رشته عمومی انگلیسیِ خارج از Whitelist، شکست RTL، عدد نامتجانس یا ترجمه مبهم باقی نماند. |
| کیفی | امنیت، Performance، Accessibility، Observability و Regression Gateها پاس شوند. |

### ۲.۲ معیار توقف نهایی Codex

Codex فقط زمانی مجاز است وضعیت COMPLETE ثبت کند که هم‌زمان شرایط زیر برقرار باشد:

1. تمام الزام‌های P0 و P1 در Matrix وضعیت VERIFIED داشته باشند.

2. هیچ Defect با شدت بحرانی یا زیاد باز نباشد.

3. هیچ TODO، FIXME، Mock دائمی، Handler خالی یا Feature Flag مبهم در مسیرهای P0/P1 باقی نماند.

4. سه اجرای متوالی کل مجموعه آزمون در محیط قفل‌شده بدون Regression عبور کند.

5. Visual Regression در همه Viewportهای هدف از Threshold هر ناحیه عبور کند.

6. Motion Trace، Keyboard، Pointer، Touch و Screen Reader برای مسیرهای اصلی پذیرفته شوند.

7. Budgetهای Performance و Web Vitals در صدک ۷۵ رعایت شوند.

8. ممیزی امنیتی، Dependency scan، Secret scan و آزمون مجوز دسترسی بدون مورد بحرانی/زیاد باشند.

9. تمام متن‌ها از لایه i18n آمده و آزمون «رشته انگلیسی ناخواسته» صفر خروجی داشته باشد.

10. گزارش نهایی، شواهد Screenshot/Video/Trace، نقشه پوشش و فایل وضعیت اجرا تولید شده باشد.

اگر محدودیت محیط، دسترسی، Credential، API یا تصمیم محصول مانع تکمیل شود، Codex نباید ادعای اتمام کند. باید وضعیت BLOCKED همراه با علت دقیق، اثر، شواهد، راه رفع و نخستین دستور Resume ثبت شود.

## ۳. جایگاه محصول و مزیت رقابتی

### ۳.۱ وعده اصلی

«تمام ابزار لازم برای دیدن، فهمیدن، آزمودن و اجرای تصمیم معاملاتی در یک محیط فارسی دقیق و حرفه‌ای.»

### ۳.۲ مزیت‌های الزامی برای فارسی‌زبانان

- رابط RTL واقعی در تمام سطوح، نه ترجمه سطحی؛

- جست‌وجوی فارسی، انگلیسی، نماد، نام محاوره‌ای و Transliteration؛

- تقویم جلالی و میلادی با امکان تغییر؛

- نمایش اعداد فارسی یا لاتین بر اساس تنظیم کاربر، بدون شکستن نماد و قیمت؛

- منطقه زمانی قابل‌انتخاب با پیش‌فرض دستگاه؛

- فرمان صوتی فارسی و خواندن وضعیت چارت؛

- راهنمای خطا، Tooltip و Documentation فارسی؛

- NamaScript با Editor، خطا و مثال فارسی؛

- واژه‌نامه ثابت تحلیل تکنیکال؛

- آموزش درون‌محصولی کوتاه و Contextual؛

- پشتیبانی از شبکه ضعیف، بازیابی Session و مصرف بهینه داده؛

- مسیرهای معرفی LBank و OneRoyal با توضیح شفاف و کنترل Eligibility.

### ۳.۳ اصول تجربه

1. Chart-first: چارت مهم‌ترین عنصر است و UI نباید فضای آن را بی‌دلیل مصرف کند.

2. Progressive disclosure: ابزارهای پیشرفته در دسترس‌اند، اما کاربر تازه‌کار با ازدحام روبه‌رو نمی‌شود.

3. Direct manipulation: هرجا ممکن است تنظیم، جابه‌جایی و معامله مستقیماً روی چارت انجام شود.

4. State is visible: وضعیت اتصال، ذخیره، تأخیر داده، هشدار، سفارش و خطا همیشه روشن باشد.

5. No dead ends: هر خطا راه حل، Retry یا مسیر جایگزین دارد.

6. Keyboard and touch parity: کار مهم فقط به Hover یا Right-click وابسته نیست.

7. Trust by design: منبع داده، زمان آخرین به‌روزرسانی و ماهیت لینک معرفی پنهان نمی‌شود.

## ۴. کاربران و سناریوهای اصلی

### ۴.۱ شخصیت‌های هدف

| شخصیت | نیاز اصلی | معیار موفقیت |
| --- | --- | --- |
| تازه‌کار فارسی‌زبان | فهم چارت و ابزارها بدون اصطلاح مبهم | ساخت دیده‌بان و افزودن اندیکاتور در کمتر از ۳ دقیقه |
| تحلیلگر تکنیکال | ابزار ترسیم دقیق، Layout، Object Tree و Template | بازیابی کامل Workspace و Drawing بدون جابه‌جایی |
| اسکریپت‌نویس | NamaScript، Debug، Backtest و انتشار نسخه‌دار | اجرای Deterministic و خطای قابل‌فهم |
| معامله‌گر فعال | داده سریع، Alert، Order panel و Shortcut | واکنش UI کمتر از Budget و جلوگیری از Double-submit |
| کاربر موبایل | چارت لمسی، حالت افقی و کار با یک دست | Pan/Zoom روان و کنترل‌های بدون تداخل Gesture |
| مدیر محصول/پشتیبانی | مشاهده سلامت سرویس و بازسازی خطای کاربر | Trace قابل‌جست‌وجو بدون افشای اطلاعات حساس |

### ۴.۲ سفرهای P0

- ورود، ثبت‌نام، بازیابی رمز و مدیریت Session؛

- جست‌وجوی نماد و بازکردن چارت؛

- تغییر تایم‌فریم و نوع چارت؛

- افزودن، تنظیم، پنهان‌کردن و حذف اندیکاتور؛

- ترسیم، انتخاب، ویرایش، قفل، مخفی‌سازی و حذف ابزار؛

- Undo/Redo چندمرحله‌ای؛

- ساخت و مدیریت دیده‌بان؛

- ساخت هشدار و دریافت رویداد؛

- ذخیره و بازیابی Layout؛

- حالت تمام‌صفحه و Responsive؛

- Replay و Backtest پایه؛

- ورود به NamaScript و اجرای نمونه؛

- بازکردن صفحه LBank و OneRoyal از CTA مجاز؛

- مدیریت پروفایل، زبان نمایش عدد، Theme و منطقه زمانی.

## ۵. دامنه نسخه هدف

### ۵.۱ در دامنه

- Web App واکنش‌گرا و PWA؛

- موتور چارت و لایه داده Modular؛

- حداقل ۱۲ نوع نمایش قیمت در P0/P1؛

- بیش از ۱۰۰ ابزار ترسیم در نقشه کامل، با مجموعه اولویت‌دار در نسخه نخست؛

- کتابخانه اندیکاتور داخلی، Custom indicator و Template؛

- Multi-chart تا ۱۶ پنل بر اساس سطح دسترسی؛

- Watchlist، Symbol Search، Details و Object Tree؛

- Alert، Replay، Backtest و Paper Trading داخلی؛

- NamaScript؛

- Screener، Heatmap، Calendar و News adapter؛

- AI assistant و Voice commands فارسی؛

- اتصال داده و مسیرهای مجاز LBank؛

- مسیر معرفی OneRoyal و Adapter آماده اتصال رسمی؛

- امنیت، مانیتورینگ، Analytics و Admin controls؛

- تست‌های Unit، Integration، Contract، E2E، Visual، Motion، Load و Security.

### ۵.۲ خارج از دامنه مگر با دستور بعدی

- نمایش یا اتصال به هر صرافی یا بروکر دیگری؛

- نگهداری وجوه کاربر؛

- Custody، Wallet یا برداشت خودکار؛

- Copy trading؛

- تضمین سود یا رتبه‌بندی سرمایه‌گذاری؛

- استخراج Asset، کد یا داده از مسیرهای محافظت‌شده شخص ثالث؛

- انتشار عمومی Screenshotهای مرجع بدون مجوز؛

- فعال‌کردن معامله واقعی بدون قرارداد رسمی، Credential امن و کنترل Eligibility.

## ۶. حفظ کامل Pro Chart موجود

### ۶.۱ Baseline اجباری پیش از اولین تغییر

Codex باید پیش از ویرایش کد:

1. ساختار Repository، Stack، Packageها، محیط‌ها و Pipelineها را ثبت کند.

2. همه Routeها، منوها، Dialogها، Context menuها و Shortcutها را Crawl کند.

3. برای هر مسیر Screenshot، DOM/Accessibility snapshot، Network trace و Event trace ذخیره کند.

4. APIها، Schemaها، Storage keyها، Cookieها، Feature flagها و Permissionها را فهرست کند.

5. فهرست قابلیت‌های فعلی را با مالک محصول تطبیق دهد.

6. آزمون Characterization برای رفتارهایی که Test ندارند بنویسد.

7. Database backup و Restore drill انجام دهد.

8. خروجی را در docs/baseline/ و Matrix وضعیت BASELINED ثبت کند.

### ۶.۲ سیاست عدم حذف

- Refactor فقط پس از Characterization test مجاز است.

- Route قدیمی تا پایان Migration با Redirect یا Compatibility layer حفظ شود.

- Schema migration باید نسخه‌دار، Idempotent و دارای Rollback یا Forward-fix باشد.

- Local storage و Layoutهای قدیمی باید Migrator داشته باشند.

- قابلیت جدید ابتدا پشت Feature Flag و سپس Canary فعال شود.

- حذف کد فقط وقتی مجاز است که Dead-code بودن با Coverage و Reachability ثابت شده باشد و هیچ Contract فعالی به آن وابسته نباشد.

- هر تغییر UI باید مقایسه Before/After و توضیح اثر داشته باشد.

## ۷. ماتریس شکاف در برابر استاندارد بازار

این ماتریس هدف کیفی را مشخص می‌کند؛ اعداد نهایی باید پس از Baseline دقیق Repository به‌روزرسانی شوند.

| حوزه | Baseline عمومی Pro Chart | هدف نهایی Pro Chart | اولویت |
| --- | --- | --- | --- |
| چارت | نمودار زنده و ابزارهای پایه | موتور سریع با Multi-chart، Replay، Object Tree و Rendering تطبیقی | P0 |
| اندیکاتور | بیش از ۵۰ اندیکاتور/ابزار اعلام‌شده | کتابخانه داخلی گسترده، Template، Custom indicator و Marketplace کنترل‌شده | P0/P1 |
| ترسیم | مجموعه فعلی | بیش از ۱۱۰ ابزار در خانواده‌های Trend، Fibonacci، Gann، Pattern، Projection و Annotation | P0/P1 |
| اسکریپت | NamaScript | Editor کامل، Linter، Debugger، Profiler، Versioning، Library و Backtest | P0/P1 |
| Workspace | نامشخص/محدود | Layoutهای ۱ تا ۱۶ چارت، Sync انتخابی و Cloud persistence | P0 |
| Alert | هشدار قیمت | شرط قیمت، اندیکاتور، Drawing، Script، چندشرطی، Webhook و Delivery log | P0/P1 |
| Replay | نیازمند تکمیل | Replay قطعی، چندسرعته، چندچارتی و Paper order | P1 |
| Backtest | نیازمند تکمیل | موتور Strategy، گزارش، Commission، Slippage، Margin و Deep history | P1 |
| کشف بازار | دیده‌بان | Search سریع، Screener، Heatmap، Filterهای ذخیره‌شده و Formula | P1 |
| داده | بازارهای موجود | Adapter-based، Quality flags، Backfill، Stream reconciliation و Entitlement | P0 |
| فارسی | مزیت فعلی | RTL بی‌نقص، تقویم جلالی، Voice، واژه‌نامه و راهنمای کامل | P0 |
| موبایل | نیازمند ممیزی | تجربه لمسی مستقل، Landscape، Bottom sheet و Offline recovery | P0/P1 |
| AI | سیگنال/قابلیت‌های فعلی | دستیار توضیح‌پذیر، فرمان طبیعی، ساخت Alert/Script با تأیید کاربر | P1 |
| اتصال | عمومی/نامشخص | فقط LBank و OneRoyal طبق سیاست ثابت | P0 |
| امنیت | نیازمند ممیزی | ASVS-aligned، 2FA، Session controls، Audit log و Secret isolation | P0 |
| کیفیت | نیازمند پوشش | CI چندلایه و Visual/Motion regression با شواهد | P0 |

## ۸. معماری اطلاعات و Routeها

### ۸.۱ ساختار اصلی دسکتاپ

- نوار بالایی: جست‌وجوی نماد، تایم‌فریم، نوع چارت، اندیکاتورها، Alert، Replay، Layout، Save state و پروفایل؛

- نوار ابزار سمت راست در RTL: ابزارهای ترسیم گروه‌بندی‌شده؛

- ناحیه مرکزی: یک یا چند Chart pane؛

- پنل جانبی سمت چپ: دیده‌بان، جزئیات، اخبار، تقویم، هشدارها و Object Tree؛

- نوار پایین: زمان، منطقه زمانی، وضعیت Stream، NamaScript، Backtest، Paper Trading و Log؛

- لایه‌های شناور: Dialog، Sheet، Context menu، Command palette و Tooltip.

### ۸.۲ Routeهای پیشنهادی

| مسیر | کاربرد |
| --- | --- |
| /chart/:symbol? | محیط اصلی چارت |
| /markets | مرور بازارها و دسته‌ها |
| /screener | غربالگر |
| /heatmap | نقشه حرارتی |
| /calendar | رویدادها |
| /news | اخبار |
| /scripts | کتابخانه NamaScript |
| /editor | ویرایشگر NamaScript |
| /backtest | گزارش‌های استراتژی |
| /alerts | مرکز هشدار |
| /paper | معامله آزمایشی |
| /connect/lbank | معرفی و اتصال مجاز LBank |
| /connect/oneroyal | معرفی OneRoyal |
| /settings/* | حساب، امنیت، ظاهر، داده و اعلان‌ها |
| /help/* | راهنمای فارسی و واژه‌نامه |

Routeهای موجود نباید بدون Redirect پایدار تغییر کنند.

### ۸.۳ ساختار موبایل

- Bottom navigation با حداکثر پنج مقصد اصلی؛

- چارت تمام‌عرض با Action bar فشرده؛

- ابزارهای ترسیم و اندیکاتور در Bottom sheet جست‌وجوشونده؛

- Long-press برای Crosshair و Context actions؛

- حالت افقی برای تحلیل؛

- Safe-area و Keyboard avoidance؛

- هیچ عمل حیاتی تنها به Hover وابسته نباشد.

## ۹. سیاست زبان، RTL و Microcopy

### ۹.۱ قواعد پایه

- lang="fa" و dir="rtl" در ریشه سند؛

- تمام Stringها از فایل‌های i18n و دارای شناسه معنایی؛

- استفاده مستقیم از متن در Component ممنوع؛

- اعداد قیمت، Symbol، Formula، Shortcut و Code با dir="ltr" در Span ایزوله؛

- حروف عربی «ي/ك» در ورودی جست‌وجو به «ی/ک» Normalize شوند؛

- فاصله مجازی، نیم‌فاصله و علائم نگارشی استاندارد شوند؛

- Placeholder باید نمونه واقعی و کوتاه داشته باشد؛

- پیام خطا شامل «چه شد»، «چرا ممکن است رخ داده باشد» و «کار بعدی» باشد؛

- لحن حرفه‌ای، مستقیم و غیرتبلیغاتی باشد.

### ۹.۲ Whitelist اصطلاح‌های انگلیسی

نام برندها و موارد زیر می‌توانند انگلیسی بمانند، ولی توضیح پیرامون آن‌ها فارسی است:

Pro Chart, LBank, OneRoyal, NamaScript, OHLCV, WebSocket, REST, API, RSI, MACD, ATR, VWAP, EMA, SMA, PWA, CSV, JSON, Webhook, Backtest, Replay, Paper Trading, Stop Loss, Take Profit, Long, Short, Limit, Market, Stop, OCO, DOM, PnL, UTC.

هر اصطلاح جدید باید در واژه‌نامه و Whitelist ثبت شود.

### ۹.۳ نمونه Microcopy مصوب

| موقعیت | متن پیشنهادی |
| --- | --- |
| ذخیره Layout | «چیدمان ذخیره شد» |
| قطع Stream | «ارتباط داده قطع شد؛ تلاش برای اتصال دوباره…» |
| خطای هشدار | «هشدار ساخته نشد. شرط را بررسی کنید و دوباره تلاش کنید.» |
| حذف Drawing | «این ترسیم حذف شود؟ بازگردانی از Undo ممکن است.» |
| ارسال سفارش | «جزئیات سفارش را بررسی و تأیید کنید.» |
| لینک معرفی | «با استفاده از این لینک ممکن است Pro Chart اعتبار معرفی دریافت کند.» |
| Eligibility | «ارائه این خدمت به محل اقامت و شرایط ارائه‌دهنده بستگی دارد.» |

### ۹.۴ آزمون زبانی خودکار

CI باید DOM و Bundle را برای String انگلیسی خارج از Whitelist، متن Hard-coded، جهت اشتباه، Placeholder گمشده و Key ترجمه ناقص Scan کند. خروجی P0 باید صفر باشد.

## ۱۰. Design System و برابری بصری

### ۱۰.۱ راهبرد

Design System باید از صفر برای Pro Chart ساخته شود و تمام Screenها از Tokenها و Componentهای مشترک استفاده کنند. هیچ رنگ، فاصله، Radius، Shadow، Z-index یا Typography نباید به‌صورت پراکنده و بدون Token در کد تکرار شود.

هدف، دستیابی به همان سطح از تراکم حرفه‌ای، وضوح، قابلیت کشف و واکنش‌پذیری محصولات مرجع است؛ نه انتقال فایل‌های اختصاصی آن‌ها. آیکون‌ها باید از هندسه مشترک، Grid ثابت و Stroke هماهنگ ساخته شوند. مفهوم استاندارد ابزار حفظ می‌شود، اما Asset نهایی بخشی از هویت Pro Chart است.

### ۱۰.۲ Tokenهای پایه

#### رنگ

- Canvas: پس‌زمینه چارت؛

- Surface 1 تا 4: نوار، پنل، Dialog و Overlay؛

- Text primary/secondary/disabled/inverse؛

- Border subtle/default/strong/focus؛

- Accent primary/hover/pressed/soft؛

- Positive، Negative، Warning، Info؛

- Candle up/down، Wick، Grid، Crosshair و Selection؛

- Overlay scrim و Shadow elevation.

حداقل Themeها:

1. تیره استاندارد؛

2. روشن استاندارد؛

3. کنتراست بالا؛

4. تنظیم سفارشی چارت مستقل از Shell.

#### فاصله و اندازه

مقیاس پیشنهادی: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64 پیکسل. ارتفاع کنترل دسکتاپ: ۲۸، ۳۲، ۳۶ و ۴۰ پیکسل. Touch target موبایل: حداقل ۴۴×۴۴ CSS px. Radius: ۴، ۶، ۸، ۱۲ و Pill. Stroke آیکون: ۱.۵ یا ۱.۷۵ پیکسل بر اساس اندازه.

#### Typography

- فونت فارسی دارای مجوز و بارگذاری محلی؛

- Fallback: Noto Sans Arabic, system sans؛

- عدد و کد: فونت Monospace دارای خوانایی مناسب؛

- Tabular numbers برای قیمت و زمان؛

- اندازه پایه دسکتاپ ۱۳ یا ۱۴ پیکسل؛

- Line-height حداقل ۱.۵ برای متن توضیحی و فشرده‌تر برای Toolbar؛

- وزن‌ها محدود و معنی‌دار: Regular، Medium، Semibold، Bold.

### ۱۰.۳ Componentهای اجباری

Button، IconButton، SplitButton، Toggle، Checkbox، Radio، Switch، Input، NumericInput، SearchBox، Select، Combobox، Tabs، SegmentedControl، Tooltip، Popover، ContextMenu، Dropdown، Dialog، Drawer، BottomSheet، Toast، Banner، Table، VirtualList، Tree، DateTimePicker، ColorPicker، SymbolPicker، TimeframePicker، IndicatorPicker، DrawingToolbar، OrderTicket، EmptyState، Skeleton و ErrorBoundary.

هر Component باید این حالت‌ها را داشته باشد:

- default، hover، focus-visible، active، selected، disabled، loading، error؛

- RTL/LTR island؛

- keyboard، pointer و touch؛

- light/dark/high-contrast؛

- کاهش حرکت؛

- اندازه‌های responsive.

### ۱۰.۴ آیکون‌ها و لوگوها

- Icon set اختصاصی با Gridهای ۱۶، ۲۰ و ۲۴؛

- Stroke، Cap، Join و Optical correction ثابت؛

- هر آیکون نام معنایی و تست Snapshot دارد؛

- آیکون بدون Label باید Accessible name داشته باشد؛

- لوگوی نماد از Brand kit رسمی، منبع داده دارای حق نمایش یا Asset تأییدشده دریافت شود؛

- در نبود لوگوی معتبر، Monogram استاندارد نمایش داده شود؛

- لوگوی LBank و OneRoyal فقط از منبع رسمی و در محدوده مجاز برند استفاده شود؛

- Assetهای مرجع شخص ثالث در Bundle محصول قرار نگیرند.

### ۱۰.۵ معیار Visual Fidelity

برای هر State یک Reference capture در محیط ثابت ساخته می‌شود. مقایسه در سه سطح است:

1. Layout mask: موقعیت و اندازه ناحیه‌ها؛

2. Component mask: Border، Radius، Icon، Text baseline و State؛

3. Pixel region: ناحیه‌های ثابت و غیرپویا.

آستانه‌ها به‌صورت ناحیه‌ای تعریف می‌شوند:

- Component ثابت حیاتی: حداکثر ۰.۱٪ پیکسل متفاوت؛

- Layout عمومی: حداکثر ۰.۳٪؛

- Canvas چارت با داده ثابت: حداکثر ۰.۵٪؛

- ناحیه پویا: Mask یا Semantic assertion؛

- شکست متن، Overlap، Clipping و تغییر Hit area: صفر تحمل.

Diff عددی به‌تنهایی کافی نیست. هر اختلاف باید Overlay، Blink comparison و توضیح علت داشته باشد.

## ۱۱. Motion، Gesture و رفتار تعاملی

### ۱۱.۱ اصول حرکت

- حرکت برای توضیح تغییر وضعیت است، نه تزئین؛

- ورودی کاربر باید در کمتر از ۱۰۰ میلی‌ثانیه بازخورد بصری بگیرد؛

- انیمیشن‌های کوچک ۱۲۰ تا ۱۸۰ میلی‌ثانیه؛

- پنل/Popover حدود ۱۶۰ تا ۲۲۰ میلی‌ثانیه؛

- Dialog/Sheet حدود ۲۰۰ تا ۲۸۰ میلی‌ثانیه؛

- تغییر Layout بزرگ حداکثر ۳۲۰ میلی‌ثانیه؛

- خروج معمولاً ۱۵ تا ۲۰٪ سریع‌تر از ورود؛

- prefers-reduced-motion باید Transitionهای غیرضروری را حذف کند.

### ۱۱.۲ Gestureهای چارت

| ورودی | رفتار |
| --- | --- |
| Drag افقی | Pan زمان با حفظ Crosshair state |
| Drag عمودی روی Price scale | Scale قیمت |
| Wheel/Trackpad | Zoom حول Pointer |
| Pinch | Zoom دو محوره با Anchor پایدار |
| Double click روی Scale | Auto fit |
| Long press | فعال‌سازی Crosshair در موبایل |
| Tap | انتخاب Object یا نقطه داده |
| Drag handle | ویرایش Drawing با Snap اختیاری |
| Escape | لغو ابزار/بستن لایه فعال |
| Delete/Backspace | حذف Object منتخب با Undo |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z یا Ctrl+Y | Redo |

Gestureها نباید با Scroll صفحه، Pull-to-refresh یا Browser navigation تعارض ناخواسته داشته باشند.

### ۱۱.۳ Motion Regression

برای مسیرهای حیاتی، علاوه بر Screenshot باید Video یا Frame sequence با Timestamp ثبت شود. آزمون‌ها این موارد را مقایسه می‌کنند:

- آغاز و پایان؛

- مدت؛

- Easing؛

- Opacity/Transform؛

- جابه‌جایی Layout؛

- Focus transfer؛

- Event order؛

- Dropped frame و Long task.

انحراف مدت بیش از ۱۶ میلی‌ثانیه یا یک Frame در Motionهای حیاتی نیازمند بررسی است.

## ۱۲. موتور چارت

### ۱۲.۱ معماری پیشنهادی

موتور چارت باید از Shell رابط جدا باشد و حداقل لایه‌های زیر را داشته باشد:

- Data model و normalized series؛

- Time scale؛

- Price scale؛

- Series renderer؛

- Indicator renderer؛

- Drawing scene graph؛

- Hit testing؛

- Interaction controller؛

- Layout engine؛

- Theme/token bridge؛

- Serialization؛

- Undo/Redo command stack؛

- Worker pipeline؛

- Accessibility overlay؛

- Export renderer.

انتخاب Canvas2D، WebGL یا ترکیبی باید با Benchmark انجام شود. UI Shell نباید به جزئیات Renderer قفل شود. Adapter interface امکان تعویض Renderer و Data provider را حفظ کند.

### ۱۲.۲ انواع چارت

#### P0

- شمعی؛

- شمع توخالی؛

- میله‌ای؛

- خطی؛

- ناحیه‌ای؛

- Baseline؛

- Heikin Ashi؛

- Step line؛

- Column؛

- High-Low؛

- Line with markers؛

- Volume overlay.

#### P1

- Renko؛

- Kagi؛

- Point & Figure؛

- Line Break؛

- Range؛

- Session Volume Profile؛

- Fixed Range Volume Profile؛

- Anchored Volume Profile؛

- TPO/Market Profile؛

- Volume Footprint.

هر نوع باید Contract دقیق محاسبه، Session handling، Gap handling و تطبیق با داده مرجع داشته باشد.

### ۱۲.۳ Scale و محور

- Linear، Logarithmic، Percentage و Indexed to 100؛

- Auto scale و Manual scale؛

- Invert scale؛

- Lock price-to-bar ratio؛

- Right/left scale و Multiple scales؛

- Timezone و Session-aware ticks؛

- Jalali display بدون تغییر Timestamp داخلی؛

- Label collision avoidance؛

- Precision و Min tick بر اساس Instrument metadata؛

- Extended hours و Session separators؛

- Countdown تا بسته‌شدن Bar در صورت معتبر بودن Stream.

### ۱۲.۴ Multi-pane و Multi-chart

- چند Series در یک Pane؛

- Paneهای مستقل اندیکاتور با Resize؛

- Layout از ۱ تا ۱۶ چارت؛

- Sync انتخابی Symbol، Interval، Time range، Crosshair و Drawing؛

- Group ID برای Sync؛

- Maximize pane؛

- Drag-and-drop pane؛

- ذخیره نسبت اندازه‌ها؛

- Lazy render پنل خارج از View؛

- محدودسازی منابع بر اساس Device capability.

### ۱۲.۵ Drawing scene graph

هر Drawing یک Entity مستقل با این ویژگی‌ها است:

- شناسه پایدار؛

- نوع و Version schema؛

- نقاط Anchor در Coordinate منطقی؛

- Style؛

- Visibility interval؛

- Lock، hidden و favorite؛

- Z-order؛

- Group؛

- Owner و Permission؛

- Metadata و Created/updated time؛

- Serialization و Migration؛

- Hit shape جدا از Visual stroke؛

- Snap mode؛

- Alert binding.

### ۱۲.۶ خروجی و اشتراک

- Export تصویر PNG/WebP با Scale بالا؛

- Copy image؛

- Export داده مجاز CSV/JSON؛

- Template بدون داده حساس؛

- Watermark اختیاری Pro Chart؛

- حذف اطلاعات حساب از Screenshot؛

- لینک Share با Permission و Expiry؛

- چاپ با Layout خوانا.

## ۱۳. لایه داده بازار

### ۱۳.۱ اصل Adapter-based

هیچ Component نباید مستقیماً به Schema یک Provider وابسته باشد. Providerها از interface مشترک استفاده می‌کنند:

```typescript
interface MarketDataProvider {
  searchSymbols(query: SymbolQuery): Promise<SymbolResult[]>;
  resolveSymbol(id: SymbolId): Promise<Instrument>;
  getHistory(request: HistoryRequest): Promise<BarBatch>;
  subscribeBars(request: StreamRequest, sink: BarSink): Unsubscribe;
  getQuotes(ids: SymbolId[]): Promise<Quote[]>;
  subscribeQuotes(ids: SymbolId[], sink: QuoteSink): Unsubscribe;
  getServerTime(): Promise<number>;
  getEntitlements(userId: string): Promise<DataEntitlement[]>;
  health(): Promise<ProviderHealth>;
}
```

### ۱۳.۲ مدل Instrument

حداقل فیلدها:

id, provider, ticker, displayNameFa, displayNameEn, assetClass, exchange, currency, baseAsset, quoteAsset, timezone, session, holidays, priceScale, minTick, volumePrecision, status, logoRef, dataDelay, entitlements, metadataVersion.

### ۱۳.۳ قرارداد OHLCV

- Timestamp داخلی UTC و بر مبنای شروع Bar؛

- Open/High/Low/Close به Decimal یا integer scaled؛

- Volume و optional trade count؛

- Flagهای isFinal, isSynthetic, isAdjusted, quality, sourceSequence؛

- ترتیب صعودی، بدون Duplicate؛

- Gapها صریح و قابل‌تشخیص؛

- اصلاح Bar با Version یا Sequence؛

- Timeframe aggregation قطعی؛

- Session boundary و DST آزموده شود.

### ۱۳.۴ Streaming

- WebSocket با Heartbeat؛

- Exponential backoff با Jitter؛

- Resume از Sequence در صورت پشتیبانی؛

- Reconciliation پس از Reconnect؛

- Deduplication؛

- Clock skew monitoring؛

- Backpressure؛

- Shared connection بین Tabها در صورت امن‌بودن؛

- وضعیت زنده، با تأخیر، در حال اتصال و قطع در UI؛

- عدم نمایش Quote کهنه بدون Badge.

### ۱۳.۵ Cache و تاریخچه

- Cache چندلایه Memory، IndexedDB و Server؛

- Key شامل Provider، Symbol، Interval، Session و Adjustment؛

- TTL متفاوت برای Bar نهایی و جاری؛

- Checksum و Corruption recovery؛

- Prefetch کنترل‌شده هنگام Pan؛

- Downsampling/LOD برای بازه‌های بسیار بزرگ؛

- Purge بر اساس سهمیه و LRU؛

- عدم Cache داده خارج از Entitlement.

### ۱۳.۶ کیفیت داده

Dashboard داخلی باید این شاخص‌ها را نشان دهد:

- تأخیر دریافت؛

- Gap rate؛

- Duplicate rate؛

- Out-of-order rate؛

- اختلاف Stream با Backfill؛

- Correction count؛

- Provider uptime؛

- Symbol resolution failure؛

- Last healthy timestamp.

هر Bar قابل ردیابی تا Provider و Sequence باشد.

## ۱۴. LBank: تنها صرافی مجاز

### ۱۴.۱ دامنه نمایش

نام و لوگوی LBank فقط در این نقاط مجاز است:

- صفحه /connect/lbank؛

- CTA مشخص در محیط چارت یا Paper/Trading panel؛

- تنظیمات اتصال؛

- وضعیت Provider داده یا حساب در صورت اتصال رسمی؛

- راهنمای فارسی مرتبط.

لینک معرفی ثابت:

https://www.lbank.com/ref/PROCHART

مسیر داخلی پیشنهادی:

/go/lbank → ثبت رویداد بدون اطلاعات حساس → Redirect 302 به لینک ثابت.

### ۱۴.۲ سطح‌های یکپارچه‌سازی

#### سطح A - معرفی

- نمایش توضیح فارسی؛

- Disclosure لینک معرفی؛

- بررسی Eligibility بر اساس اعلام خود کاربر و قوانین Provider؛

- بازشدن امن در Tab جدید با noopener,noreferrer؛

- Analytics فقط برای کلیک و نتیجه Redirect، بدون ذخیره Credential.

#### سطح B - داده عمومی

- استفاده از REST/WebSocket رسمی LBank؛

- Symbol mapping؛

- OHLCV، Trades، Ticker و Order book در محدوده API؛

- Rate-limit handling؛

- Server time sync؛

- Testnet/Sandbox در صورت ارائه؛

- Contract tests مقابل نمونه پاسخ رسمی.

#### سطح C - اتصال حساب، فقط پس از تأیید

- API key در Secret vault سمت سرور؛

- Secret هرگز به Browser برنگردد؛

- حداقل Permission لازم؛

- Withdrawal permission ممنوع؛

- IP allowlist در صورت پشتیبانی؛

- Encryption at rest و rotation؛

- Revoke فوری؛

- Signed requests در Backend؛

- Idempotency برای سفارش؛

- Confirm screen؛

- Audit log؛

- Kill switch.

### ۱۴.۳ کنترل محدوده جغرافیایی

پیش از نمایش CTA عملیاتی یا فعال‌کردن اتصال حساب، سیستم باید شرایط جاری Provider را بررسی کند. زبان فارسی به معنی مجازبودن خدمت در همه محل‌ها نیست. UI باید پیام خنثی و شفاف نمایش دهد و از دورزدن محدودیت یا توصیه روش جایگزین خودداری کند.

### ۱۴.۴ آزمون‌های حیاتی LBank

- امضای Request؛

- Drift زمان؛

- Rate limit؛

- Duplicate order؛

- Timeout پس از ارسال سفارش؛

- Partial fill؛

- Reject؛

- Reconnect Stream؛

- Mapping precision/min tick؛

- revoked key؛

- Permission ناکافی؛

- Regional ineligibility؛

- Referral redirect integrity.

## ۱۵. OneRoyal: تنها بروکر مجاز

### ۱۵.۱ دامنه نمایش

لینک معرفی ثابت:

https://vc.cabinet.oneroyal.com/fa/links/go/12412

مسیر داخلی پیشنهادی:

/go/oneroyal → ثبت رویداد بدون اطلاعات حساس → Redirect 302 به مقصد ثابت.

هیچ بروکر دیگری در Search، منو، Footer، Integrations یا Documentation نمایش داده نمی‌شود.

### ۱۵.۲ سطح فعلی پیشنهادی

تا زمان ارائه قرارداد، مستندات API رسمی، Credential آزمایشی و تأیید محدوده خدمت، OneRoyal در سطح معرفی باقی می‌ماند. UI نباید وانمود کند حساب متصل یا معامله مستقیم فعال است.

صفحه معرفی شامل:

- معرفی کوتاه فارسی و بی‌طرف؛

- ابزارها/پلتفرم‌های اعلام‌شده رسمی؛

- Disclosure لینک معرفی؛

- هشدار بررسی شرایط و Eligibility؛

- CTA «ورود به وب‌سایت OneRoyal»؛

- عدم جمع‌آوری رمز، شناسه کابین یا اطلاعات حساس.

### ۱۵.۳ Adapter آینده

Interface بروکر باید مستقل باشد:

```typescript
interface BrokerAdapter {
  capabilities(): Promise<BrokerCapabilities>;
  connect(input: BrokerConnectionInput): Promise<ConnectionResult>;
  accounts(): Promise<TradingAccount[]>;
  positions(accountId: string): Promise<Position[]>;
  orders(accountId: string): Promise<Order[]>;
  placeOrder(command: PlaceOrderCommand): Promise<OrderReceipt>;
  cancelOrder(command: CancelOrderCommand): Promise<OrderReceipt>;
  streamEvents(sink: BrokerEventSink): Unsubscribe;
  disconnect(): Promise<void>;
}
```

این Interface نباید تا دریافت API رسمی با Scraping یا Automation پنل شخصی پیاده‌سازی شود.

### ۱۵.۴ کنترل محدوده جغرافیایی

شرایط جاری OneRoyal باید پیش از CTA عملیاتی بررسی شود. سامانه نباید در منطقه‌ای که Provider خدمت ارائه نمی‌کند، پیام دسترسی قطعی یا وعده افتتاح حساب نمایش دهد.

## ۱۶. ابزارهای ترسیم

### ۱۶.۱ خانواده‌ها

#### Trend و Line

Trend Line، Ray، Extended Line، Horizontal/Vertical line، Cross line، Parallel channel، Regression trend، Flat top/bottom، Disjoint channel، Pitchfork variants.

#### Fibonacci

Retracement، Extension، Projection، Time zone، Time-based trend، Speed resistance fan، Circles، Spiral، Wedge و Channel.

#### Gann

Gann fan، Gann square، Gann box و Grid.

#### Pattern و Projection

XABCD، Cypher، Head and Shoulders، Triangle، Elliott waves، Elliott triangles، Three drives، Time cycles، Price range، Date range، Forecast، Long/Short position و Bars pattern.

#### Annotation

Text، Anchored text، Note، Callout، Comment، Price note، Arrow، Marker، Flag، Image مجاز، Table و Path/freehand.

#### Geometric

Rectangle، Rotated rectangle، Circle، Ellipse، Arc، Polyline، Triangle، Curve و Brush.

### ۱۶.۲ رفتار مشترک

- Favorite toolbar؛

- Keep drawing mode؛

- Magnet ضعیف/قوی؛

- Snap به OHLC و Indicator points؛

- Lock all؛

- Hide all؛

- Clone؛

- Copy/paste؛

- Group؛

- Bring forward/send backward؛

- Template سبک؛

- Visibility by timeframe؛

- Alert on crossing؛

- Context menu فارسی؛

- Properties dialog؛

- Keyboard nudging؛

- Touch handles بزرگ‌تر؛

- Undo/Redo؛

- Object Tree integration.

### ۱۶.۳ دقت

Hit testing باید مستقل از ضخامت ظاهری باشد. Anchor در Zoomهای مختلف نباید Drift کند. Serialization پس از Save/Load باید با Tolerance کمتر از ۰.۱ پیکسل منطقی یا معادل Coordinate تعریف‌شده بازسازی شود.

## ۱۷. اندیکاتورها

### ۱۷.۱ مجموعه P0

SMA، EMA، WMA، RMA/SMMA، VWMA، Bollinger Bands، Keltner Channels، Donchian Channels، RSI، Stochastic، Stochastic RSI، MACD، ATR، ADX/DMI، CCI، ROC، Momentum، Williams %R، Awesome Oscillator، Parabolic SAR، Ichimoku، Supertrend، Pivot Points، VWAP، Anchored VWAP، OBV، MFI، CMF، Accumulation/Distribution، Volume، Volume MA، Historical Volatility، Standard Deviation، Correlation، Linear Regression و Zig Zag.

### ۱۷.۲ قرارداد اندیکاتور

هر اندیکاتور باید داشته باشد:

- شناسه و Version؛

- ورودی Typed؛

- Defaultهای مستند؛

- خروجی Series/Plot؛

- Warm-up period؛

- مدیریت na؛

- Multi-timeframe semantics؛

- Realtime/recalculation rules؛

- Style schema؛

- Alert conditions؛

- Localization؛

- Test vectors؛

- Benchmark؛

- Migration.

### ۱۷.۳ صحت محاسبات

برای هر اندیکاتور حداقل این آزمون‌ها لازم است:

- Golden vector مستقل؛

- داده ثابت، صعودی، نزولی، نوسانی و دارای Gap؛

- ورودی کوتاه‌تر از Warm-up؛

- Null/NaN؛

- Precision؛

- Streaming update؛

- Bar correction؛

- Timeframe aggregation؛

- عدم Look-ahead؛

- تطابق Worker و Main-thread.

### ۱۷.۴ Indicator manager

- جست‌وجوی فارسی/انگلیسی/اختصار؛

- دسته‌بندی؛

- Favorite و Recent؛

- Built-in، شخصی، عمومی و دعوتی؛

- Preview؛

- Input/Style/Visibility tabs؛

- Template؛

- افزودن چندباره با Instance ID؛

- جابه‌جایی Pane؛

- Object Tree؛

- Performance warning برای Script سنگین.

## ۱۸. Layout، دیده‌بان و Workspace

### ۱۸.۱ Layout

- Auto-save با Debounce و نشان وضعیت؛

- Save as و Duplicate؛

- Version history؛

- Rename، Favorite و Archive؛

- Conflict resolution بین دستگاه‌ها؛

- Offline queue؛

- Export/Import نسخه‌دار؛

- Sync انتخابی Symbol/Interval/Crosshair/Time/Drawing؛

- Workspace startup preference؛

- Recover unsaved session پس از Crash.

### ۱۸.۲ دیده‌بان

- چند Watchlist؛

- Drag reorder؛

- Section؛

- Import/Export CSV؛

- ستون‌های قابل‌تنظیم؛

- Sort و Filter؛

- Color flag؛

- Note؛

- Alert badge؛

- Streaming quote؛

- Virtualization؛

- Keyboard navigation؛

- Context actions؛

- Duplicate prevention و Alias resolution.

### ۱۸.۳ Object Tree

Tree باید Series، Indicator، Drawing و Group را نمایش دهد و عملیات Visibility، Lock، Select، Rename، Reorder، Group، Delete و Properties را پشتیبانی کند. Selection بین Tree و Canvas دوطرفه است.

## ۱۹. هشدارها

### ۱۹.۱ انواع شرط

- عبور/رسیدن قیمت؛

- ورود یا خروج از Channel؛

- مقدار یا Cross اندیکاتور؛

- Drawing؛

- NamaScript condition؛

- چندشرطی AND/OR؛

- درصد تغییر، Volume و Gap؛

- Calendar event؛

- Watchlist/screener result؛

- Order/position event در اتصال رسمی.

### ۱۹.۲ اجرای سروری

هشدار نباید به بازبودن مرورگر وابسته باشد. موتور باید:

- شرط را نسخه‌دار ذخیره کند؛

- Entitlement را بررسی کند؛

- داده را Stream یا Schedule کند؛

- Exactly-once notification را تا حد ممکن با Deduplication فراهم کند؛

- Retry و Dead-letter queue داشته باشد؛

- Delivery log و علت خطا نشان دهد؛

- Pause، Resume، Clone و Expiry را پشتیبانی کند؛

- Timezone و Session را رعایت کند.

### ۱۹.۳ کانال‌ها

اعلان درون‌برنامه، Push، Email و Webhook. کانال جدید فقط با تأیید مالک محصول. Webhook باید Secret signing، Retry policy، Timeout، IP controls و Redaction داشته باشد.

## ۲۰. Replay، Backtest و Paper Trading

### ۲۰.۱ Replay

- انتخاب نقطه شروع؛

- Step یک Bar؛

- سرعت‌های چندگانه؛

- Pause/Resume؛

- چندچارتی با Clock مشترک یا مستقل؛

- Indicator/Drawing سازگار؛

- عدم افشای آینده؛

- Jump controls؛

- Session/Gaps؛

- Paper order روی داده تاریخی؛

- ذخیره Session؛

- Reset قطعی.

تمام محاسبات باید بر Clock مجازی Replay اجرا شوند، نه Date.now().

### ۲۰.۲ Backtest

#### تنظیمات

Initial capital، Currency، Order size، Commission، Slippage، Margin، Pyramiding، Date range، Session، Fill model و Bar magnifier در صورت داده مناسب.

#### خروجی

Net profit، Gross profit/loss، Max drawdown، Buy & hold، Profit factor، Win rate، Average trade، Expectancy، Sharpe/Sortino در صورت داده کافی، Exposure، تعداد معاملات، Equity curve، Drawdown curve، Trade list و Distribution.

#### قواعد صحت

- عدم Look-ahead؛

- استفاده از Bar final/Intrabar طبق Mode؛

- Fill model مستند؛

- Commission و Slippage واقعی در Report؛

- Reproducible seed برای مدل احتمالی؛

- Hash تنظیمات و نسخه Script در نتیجه؛

- Dataset lineage؛

- تست در برابر سناریوهای دستی کوچک.

### ۲۰.۳ Paper Trading

- حساب آزمایشی مستقل؛

- Reset balance؛

- Market/Limit/Stop/OCO در محدوده پیاده‌سازی؛

- Position، Orders، History و PnL؛

- Commission/Leverage قابل‌تنظیم؛

- Confirm اختیاری؛

- Drag order روی چارت؛

- Partial fill simulation؛

- Trading hours؛

- Audit log؛

- برچسب واضح «آزمایشی» در تمام نقاط.

## ۲۱. NamaScript

### ۲۱.۱ هدف

NamaScript باید زبان بومی و امن Pro Chart برای ساخت اندیکاتور، شرط هشدار و استراتژی باشد. زبان باید برای کاربر تازه‌کار قابل‌آموزش و برای توسعه‌دهنده حرفه‌ای قابل‌پیش‌بینی، نسخه‌دار و قابل‌تست باشد.

### ۲۱.۲ اجزای پلتفرم

- Lexer و Parser با Grammar نسخه‌دار؛

- AST و Type checker؛

- Intermediate representation یا Bytecode؛

- Runtime ایزوله در Worker/Sandbox؛

- Standard library؛

- Plot API؛

- Drawing API محدود؛

- Alert API؛

- Strategy API؛

- Data/timeframe API؛

- Package/Library system؛

- Editor؛

- Linter و Formatter؛

- Debugger؛

- Profiler؛

- Test runner؛

- Documentation generator؛

- Publication workflow.

### ۲۱.۳ قواعد زبان

- Typeهای پایه: int, float, bool, string, color, time, series<T>؛

- مقدار ناموجود صریح؛

- Mutation محدود و قابل‌فهم؛

- دسترسی تاریخی با Bound check؛

- توابع خالص در اولویت؛

- Timeframe request با قواعد Merge روشن؛

- عدم دسترسی مستقیم به DOM، Network، File system یا Secret؛

- محدودیت CPU، Memory، Loop و Plot؛

- Seed ثابت برای هر رفتار تصادفی؛

- Version directive و Compatibility mode؛

- Error code پایدار همراه با پیام فارسی.

### ۲۱.۴ Editor

- Syntax highlighting؛

- Autocomplete؛

- Signature help؛

- Hover documentation؛

- Go to definition؛

- Find references؛

- Rename symbol؛

- Multi-cursor؛

- Bracket matching؛

- Minimap اختیاری؛

- Problems panel؛

- Console/Log؛

- Format document؛

- Diff نسخه‌ها؛

- Auto-save؛

- Restore draft؛

- Keyboard shortcuts؛

- RTL Shell با Code area کاملاً LTR.

### ۲۱.۵ Debugger و Profiler

- Breakpoint روی Bar/Line؛

- Step؛

- Watch expression؛

- Inspect variable/series window؛

- Bar index و زمان فعلی؛

- Call stack؛

- Execution time per function؛

- Memory estimate؛

- Recalculation count؛

- Warning درباره عملیات پرهزینه؛

- Export trace بدون داده حساس.

### ۲۱.۶ انتشار و مجوز

حالت‌ها:

- خصوصی؛

- اشتراک با لینک؛

- عمومی متن‌باز؛

- محافظت‌شده؛

- دسترسی دعوتی.

مالکیت، نسخه، Changelog، Dependency، مجوز، Attribution و Moderation باید ثبت شود. واردکردن کد شخص ثالث فقط طبق مجوز همان کد و با ثبت منبع مجاز است.

### ۲۱.۷ مثال حداقلی

```typescript
//@version=1
indicator("میانگین‌های نمایی", overlay=true)

fastLength = input.int(9, "دوره سریع", min=1)
slowLength = input.int(21, "دوره کند", min=1)

fast = ta.ema(close, fastLength)
slow = ta.ema(close, slowLength)

plot(fast, "EMA سریع")
plot(slow, "EMA کند")
alertcondition(ta.crossover(fast, slow), "تقاطع صعودی")
```

Syntax نهایی فقط پس از ADR و Grammar رسمی قطعی می‌شود.

## ۲۲. جست‌وجو، Screener و Heatmap

### ۲۲.۱ Symbol Search

Ranking باید این سیگنال‌ها را ترکیب کند:

- تطبیق دقیق Ticker؛

- نام فارسی/انگلیسی؛

- Alias و Transliteration؛

- Asset class؛

- Provider/Exchange؛

- Popularity کنترل‌شده؛

- Recent و Favorite؛

- Entitlement؛

- وضعیت فعال/تعلیق؛

- Typo tolerance.

نتیجه هر Symbol باید نام، Ticker، نوع دارایی، بازار، Currency، وضعیت داده، تأخیر و Logo معتبر را نشان دهد.

### ۲۲.۲ Screener

- جدول Virtualized؛

- Filter builder؛

- فیلتر تکنیکال، قیمت، Volume، تغییر، Volatility و Metadata؛

- Multi-timeframe؛

- Sort چندستونه؛

- ستون سفارشی؛

- Preset؛

- Save، Share و Alert؛

- Export مجاز؛

- NamaScript formula در P1؛

- Query cancellation؛

- Server-side pagination/stream؛

- نمایش زمان آخرین محاسبه.

### ۲۲.۳ Heatmap

- اندازه بر اساس Market cap/Volume/وزن قابل‌انتخاب؛

- رنگ بر اساس تغییر/شاخص منتخب؛

- Grouping؛

- Zoom و Drill-down؛

- Tooltip؛

- Search highlight؛

- Timeframe؛

- Snapshot deterministic؛

- Accessible table alternative.

## ۲۳. تقویم، اخبار و رویدادها

### ۲۳.۱ Calendar

- تقویم اقتصادی، سود، تقسیم سود، رویداد بازار و رویداد سفارشی؛

- نمایش جلالی/میلادی؛

- Timezone؛

- Filter کشور، اهمیت، نوع و Symbol؛

- Reminder؛

- نمایش Marker روی چارت؛

- Source و زمان انتشار؛

- Revised values؛

- عدم ادغام رویدادهای تکراری.

### ۲۳.۲ News

- Provider adapter؛

- Deduplication؛

- Source attribution؛

- زمان انتشار و به‌روزرسانی؛

- Symbol/entity tagging؛

- خلاصه فارسی تولیدشده با برچسب روشن؛

- Link به منبع؛

- Bookmark؛

- Filter؛

- عدم نمایش متن کامل فاقد مجوز؛

- Prompt-injection isolation هنگام پردازش محتوا.

## ۲۴. دستیار هوش مصنوعی و قابلیت گفتاری

### ۲۴.۱ نقش دستیار

دستیار باید توضیح، راهنمایی، جست‌وجو و ساخت Draft انجام دهد؛ تصمیم مالی قطعی یا اجرای معامله بدون تأیید صریح انجام نمی‌دهد.

قابلیت‌ها:

- توضیح اندیکاتور و وضعیت چارت به فارسی؛

- پاسخ بر اساس Context انتخاب‌شده، نه دسترسی نامحدود؛

- ساخت Draft هشدار؛

- ساخت Draft NamaScript؛

- توضیح خطای Script؛

- خلاصه خبر با Attribution؛

- یافتن ابزار در UI؛

- تبدیل فرمان طبیعی به Action قابل‌پیش‌نمایش؛

- مقایسه سناریوهای Backtest؛

- راهنمای تعاملی.

### ۲۴.۲ اصل تأیید

Actionهای تغییر‌دهنده مانند حذف Drawing، تغییر گسترده Layout، ساخت Webhook، اتصال حساب یا سفارش باید Preview و Confirm داشته باشند. دستیار هیچ Secret یا Credentialی درخواست یا نمایش نمی‌دهد.

### ۲۴.۳ Voice

- Speech-to-text فارسی؛

- Text-to-speech فارسی؛

- Push-to-talk و قطع فوری؛

- نمایش Transcript پیش از Action؛

- Command grammar برای عملیات پرتکرار؛

- تأیید دو مرحله‌ای عملیات حساس؛

- مدیریت Noise و Confidence؛

- حفظ Privacy و Retention قابل‌تنظیم؛

- Keyboard alternative؛

- مثال: «نماد بیت‌کوین را باز کن»، «RSI با دوره ۱۴ اضافه کن»، «چارت را تمام‌صفحه کن».

### ۲۴.۴ ارزیابی AI

Dataset ارزیابی فارسی باید شامل ابهام، اصطلاح عامیانه، نمادهای مشابه، فرمان خطرناک، Prompt injection، متن خبر آلوده و درخواست خارج از دسترسی باشد. معیارها:

- Intent accuracy؛

- Parameter accuracy؛

- Action safety؛

- Hallucination rate؛

- Citation/source correctness؛

- Persian quality؛

- Refusal correctness؛

- Latency.

## ۲۵. حساب، احراز هویت و تنظیمات

### ۲۵.۱ ورود و ثبت‌نام

- Email/phone بر اساس سیاست محصول؛

- Verification؛

- Password policy؛

- Passkey در P1؛

- 2FA با TOTP و Backup code؛

- Recovery امن؛

- Rate limit و Bot protection؛

- Session list و Logout device؛

- Login notification؛

- Risk-based challenge؛

- پیام‌های فارسی بدون افشای وجود حساب.

### ۲۵.۲ تنظیمات

- پروفایل؛

- امنیت؛

- Theme؛

- Language policy؛

- عدد فارسی/لاتین؛

- تقویم؛

- Timezone؛

- اعلان‌ها؛

- داده و Cache؛

- Shortcut؛

- Accessibility؛

- Privacy؛

- اتصال‌های LBank/OneRoyal؛

- Export/Delete account طبق سیاست.

### ۲۵.۳ سطح دسترسی و اشتراک

Feature entitlement از Backend دریافت می‌شود و UI فقط نمایشی نیست. Server باید محدودیت Layout، Alert، تاریخچه، Export و قابلیت‌های پیشرفته را enforce کند. Downgrade نباید داده کاربر را بی‌هشدار حذف کند؛ قابلیت‌های بیش از سقف Read-only یا Archived می‌شوند.

## ۲۶. معماری نرم‌افزار

### ۲۶.۱ اصل کلی

Codex باید Stack موجود را ابتدا ارزیابی کند. بازنویسی کامل تنها با شواهد Benchmark و ADR مجاز است. معماری هدف Modular monolith یا سرویس‌های محدود و هدفمند است؛ Microserviceهای بی‌دلیل ممنوع.

### ۲۶.۲ ماژول‌های Frontend

- App shell؛

- Design system؛

- Chart core؛

- Data client؛

- Drawings؛

- Indicators؛

- NamaScript editor/runtime bridge؛

- Workspace؛

- Watchlist؛

- Alerts؛

- Replay/Backtest؛

- Trading/Paper؛

- Search/Screener/Heatmap؛

- Calendar/News؛

- AI/Voice؛

- Account/Settings؛

- Telemetry؛

- i18n.

Module boundaries باید با ESLint/Build rule enforce شوند.

### ۲۶.۳ ماژول‌های Backend

- Identity؛

- User profile/settings؛

- Entitlement؛

- Workspace storage؛

- Symbol master؛

- Market data gateway؛

- Stream gateway؛

- Alert engine؛

- Notification؛

- NamaScript registry/execution؛

- Backtest jobs؛

- Paper trading؛

- Provider connections؛

- Referral redirect؛

- AI orchestration؛

- Audit؛

- Admin؛

- Observability.

### ۲۶.۴ API

- Contract-first با OpenAPI/AsyncAPI یا معادل؛

- Versioning؛

- Typed client generation؛

- Idempotency برای Commandها؛

- Cursor pagination؛

- Problem Details استاندارد؛

- Correlation ID؛

- Permission check سمت سرور؛

- Rate limit header؛

- Schema validation در مرز؛

- Deprecation policy.

### ۲۶.۵ Storage

- Relational DB برای حساب و Metadata؛

- Time-series/columnar store برای داده حجیم بر اساس Benchmark؛

- Object storage برای Snapshot/Export؛

- Redis یا معادل برای Cache/Queue در صورت نیاز؛

- Secret manager؛

- Encryption at rest؛

- Backup و Restore drill؛

- Data retention و deletion jobs؛

- Migration check در CI.

### ۲۶.۶ Repository

ساختار پیشنهادی در صورت Monorepo:

```text
/apps/web
/apps/api
/apps/worker-alerts
/apps/worker-backtest
/packages/design-system
/packages/chart-core
/packages/market-data-contracts
/packages/namascript
/packages/i18n-fa
/packages/testing
/docs/adr
/docs/baseline
/docs/qa
```

نام واقعی باید با Stack موجود تطبیق یابد.

## ۲۷. امنیت و حریم خصوصی

### ۲۷.۱ کنترل‌های پایه

- Threat model برای Auth، Data، Script، Alert، Webhook، AI و Trading؛

- Secure headers: CSP، HSTS، Referrer policy، Permissions policy؛

- CSRF، XSS، SQL/NoSQL injection و SSRF controls؛

- Strict input validation؛

- Output encoding؛

- SameSite/Secure/HttpOnly cookies؛

- Session rotation؛

- Least privilege؛

- RBAC/ABAC؛

- Audit log تغییرناپذیر برای عملیات حساس؛

- Secret scan در pre-commit و CI؛

- Dependency/SBOM scan؛

- Container/IaC scan؛

- Patch SLA؛

- Incident runbook.

### ۲۷.۲ NamaScript sandbox

- CPU quota؛

- Memory quota؛

- Instruction count؛

- Timeout؛

- No network/file/DOM؛

- محدودیت recursion و collection؛

- Deterministic clock؛

- Validate bytecode/AST؛

- Isolate tenant؛

- Kill runaway execution؛

- Security fuzzing.

### ۲۷.۳ Webhook و Provider keys

- HMAC signing؛

- Replay protection؛

- Secret rotation؛

- Encrypted vault؛

- Redaction در Log؛

- عدم نمایش Secret پس از ثبت؛

- Test event؛

- URL allow/deny controls؛

- SSRF protection؛

- Retry bounded؛

- Revocation.

### ۲۷.۴ AI security

- جداسازی System instruction از محتوای خبر/کاربر؛

- Tool permission allowlist؛

- عدم اجرای Action از متن خارجی؛

- Confirm برای تغییر؛

- PII redaction؛

- Prompt/response logging کنترل‌شده؛

- Abuse rate limit؛

- Eval برای Injection و data exfiltration.

### ۲۷.۵ حریم خصوصی

- Data minimization؛

- Purpose limitation؛

- Consent برای Voice/Telemetry غیرضروری؛

- Retention قابل‌تعریف؛

- Export و حذف؛

- عدم قرار دادن PII در Analytics؛

- Mask در Screenshotهای QA؛

- دسترسی پشتیبانی با Approval و Audit.

## ۲۸. Performance و پایداری

### ۲۸.۱ Budgetهای Web

در صدک ۷۵ کاربران واقعی هدف:

- LCP حداکثر ۲.۵ ثانیه؛

- INP حداکثر ۲۰۰ میلی‌ثانیه؛

- CLS حداکثر ۰.۱؛

- TTFB ترجیحاً کمتر از ۸۰۰ میلی‌ثانیه؛

- JS اولیه Route چارت با Budget ثبت‌شده و روند کاهشی؛

- Memory leak صفر در تست Soak؛

- Long taskهای بیش از ۵۰ میلی‌ثانیه محدود و رصدشده.

### ۲۸.۲ Budget چارت

- Pan/Zoom هدف ۶۰fps روی دستگاه مرجع؛

- صدک ۹۵ Frame time کمتر از ۲۰ms؛

- Crosshair response کمتر از ۵۰ms؛

- Quote-to-paint طبق SLA Provider و شبکه، با overhead داخلی هدف کمتر از ۱۰۰ms؛

- افزودن اندیکاتور P0 روی ۱۰هزار Bar کمتر از ۵۰۰ms در دستگاه مرجع؛

- بازیابی Layout معمولی کمتر از ۲ ثانیه پس از آماده‌شدن Shell؛

- Virtualization برای فهرست‌های بیش از ۲۰۰ ردیف؛

- Worker برای محاسبات سنگین؛

- Adaptive LOD.

### ۲۸.۳ Load و Resilience

- Load test برای Stream fan-out، Alert engine، Backtest queue و Workspace save؛

- Circuit breaker و bulkhead؛

- Backpressure؛

- Graceful degradation؛

- Retry با Jitter؛

- Idempotency؛

- Chaos test کنترل‌شده؛

- RTO/RPO تعریف‌شده؛

- Runbook برای Provider outage؛

- Read-only mode در قطعی سرویس‌های نوشتنی.

## ۲۹. دسترس‌پذیری

هدف WCAG 2.2 سطح AA برای Shell و مسیرهای اصلی است.

### ۲۹.۱ الزامات

- Keyboard کامل؛

- Focus visible و ترتیب منطقی RTL؛

- Skip link؛

- Landmarks؛

- Accessible name/description؛

- Dialog focus trap و restore؛

- Contrast؛

- Zoom تا ۲۰۰٪؛

- Reflow؛

- Reduced motion؛

- Screen reader announcements برای اتصال، Alert و سفارش؛

- جایگزین متنی/جدولی برای اطلاعات ضروری چارت؛

- عدم اتکا صرف به رنگ؛

- Error association؛

- Touch target؛

- Caption/Transcript برای محتوای صوتی.

### ۲۹.۲ Accessibility overlay چارت

Canvas باید یک لایه DOM/ARIA مکمل داشته باشد که:

- نام Symbol و Interval؛

- OHLCV نقطه منتخب؛

- فهرست Series/Indicator؛

- خلاصه روند اختیاری؛

- جدول داده قابل‌پیمایش؛

- Shortcutهای حرکت Crosshair؛

- اعلام Drawing منتخب؛

- عملیات جایگزین برای Drag

را فراهم کند.

## ۳۰. Observability، Analytics و پشتیبانی

### ۳۰.۱ Telemetry

- Structured logs؛

- Metrics؛

- Distributed traces؛

- Frontend error reporting؛

- Web Vitals؛

- Chart FPS/Memory؛

- Provider latency/quality؛

- Alert delivery؛

- Backtest queue؛

- AI latency/safety؛

- Referral redirect status؛

- Release/version/feature flag context.

PII و Secret باید قبل از خروج از Client/Service Redact شود.

### ۳۰.۲ Product analytics

Eventها باید Schema registry، Version و Data dictionary داشته باشند. نمونه:

- symbol_searched؛

- chart_opened؛

- indicator_added؛

- drawing_created؛

- alert_created؛

- layout_saved؛

- replay_started؛

- namascript_run؛

- lbank_referral_opened؛

- oneroyal_referral_opened.

ثبت متن آزاد کاربر، کد خصوصی یا Credential در Analytics ممنوع است.

### ۳۰.۳ Support bundle

کاربر با رضایت می‌تواند بسته عیب‌یابی تولید کند که شامل نسخه، Browser، Feature flags، Logهای Redact‌شده و Trace محدود است. Screenshot و Layout خصوصی پیش‌فرض در بسته نیست.

## ۳۱. روش شات‌به‌شات و مقایسه رفتار

### ۳۱.۱ محیط قفل‌شده

برای Baseline و Regression:

- Browser و Version ثابت؛

- سیستم‌عامل Container ثابت؛

- Fontهای دقیق؛

- Viewport و DPR ثابت؛

- Locale fa-IR؛

- Timezone ثابت؛

- Theme ثابت؛

- Clock Freeze؛

- داده Fixture ثابت؛

- Animation policy ثابت؛

- Network mock برای حالات قطعی؛

- Disable random/A-B behavior؛

- حساب Seed شده با داده غیرحساس.

### ۳۱.۲ Viewportهای اجباری

- ۳۲۰×۶۸۰ موبایل کوچک؛

- ۳۶۰×۸۰۰ موبایل؛

- ۳۹۰×۸۴۴ موبایل؛

- ۷۶۸×۱۰۲۴ تبلت عمودی؛

- ۱۰۲۴×۷۶۸ تبلت افقی؛

- ۱۳۶۶×۷۶۸ لپ‌تاپ؛

- ۱۴۴۰×۹۰۰ دسکتاپ؛

- ۱۹۲۰×۱۰۸۰ دسکتاپ؛

- ۲۵۶۰×۱۴۴۰ نمایشگر بزرگ؛

- DPRهای ۱ و ۲ برای مجموعه منتخب.

### ۳۱.۳ State matrix هر صفحه

- بارگذاری؛

- داده کامل؛

- خالی؛

- خطای API؛

- قطع شبکه؛

- Reconnect؛

- Permission denied؛

- Loading slow؛

- Theme روشن/تیره؛

- Keyboard focus؛

- Dialog/Popover باز؛

- Tooltip؛

- متن طولانی؛

- عدد بسیار بزرگ/کوچک؛

- Mobile portrait/landscape.

### ۳۱.۴ Pipeline تصویری

1. Navigate و Seed؛

2. صبر برای Font، Stream mock و Stable layout؛

3. Mask Timestamp/Quote پویا در سناریوی زنده؛

4. Capture full page و Component regions؛

5. Pixel diff؛

6. SSIM یا perceptual diff؛

7. Layout/DOM assertions؛

8. Accessibility snapshot؛

9. ذخیره Actual، Expected، Diff و Metadata؛

10. Review اجباری اختلاف جدید؛

11. Update baseline فقط با Approval و علت ثبت‌شده.

### ۳۱.۵ مقایسه با محصول مرجع

Screenshot مرجع فقط برای تحلیل داخلی کیفیت و رفتار در Session مجاز و کنترل‌شده استفاده می‌شود. فرآیند نباید Auth را دور بزند، Assetها را استخراج کند یا کد/Endpoint خصوصی را بازیابی کند. خروجی مورد استفاده در Pro Chart، Design token، Component و Asset مستقل است.

مقایسه باید روی ویژگی‌ها تمرکز کند:

- اندازه و تراکم؛

- ترتیب و قابلیت کشف؛

- رفتار Pointer/Touch؛

- Motion؛

- State coverage؛

- Performance؛

- Accessibility؛

- خطا و بازیابی.

### ۳۱.۶ مسیرهای Screenshot اجباری

حداقل:

- Shell خالی؛

- چارت با هر نوع P0؛

- Indicator dialog و تنظیمات؛

- Drawing toolbar و هر خانواده؛

- Object Tree؛

- Multi-chart layouts؛

- Watchlist؛

- Symbol search؛

- Alert create/edit/log؛

- Replay؛

- Backtest report؛

- Paper ticket/positions/orders؛

- NamaScript editor/error/debug؛

- Screener؛

- Heatmap؛

- Calendar؛

- News؛

- AI panel؛

- Voice transcript/confirm؛

- Settings؛

- LBank؛

- OneRoyal؛

- Login/2FA/recovery؛

- تمام Error/Empty/Offline states.

## ۳۲. راهبرد آزمون

### ۳۲.۱ هرم آزمون

| لایه | هدف |
| --- | --- |
| Unit | محاسبات، reducer، formatter، parser، validation |
| Property-based | invariantهای سری زمانی، Drawing و Parser |
| Component | State و Accessibility اجزا |
| Contract | API، Provider، Stream و Schema |
| Integration | Moduleها و Storage |
| E2E | سفرهای واقعی کاربر |
| Visual | Screenshot و layout |
| Motion | Frame/event trace |
| Performance | Browser، Worker، API و Load |
| Security | SAST، DAST، dependency، secret، fuzz |
| Resilience | قطع Provider، شبکه، Queue و DB |

### ۳۲.۲ Coverage

Coverage عددی تنها معیار نیست، اما حداقل پیشنهادی:

- Domain logic: ۹۰٪ branch؛

- Parser/runtime/indicator: ۹۵٪؛

- UI عمومی: ۸۰٪؛

- P0 E2E: ۱۰۰٪ مسیر و State تعریف‌شده؛

- Contract Provider: ۱۰۰٪ Endpointهای استفاده‌شده؛

- Visual: ۱۰۰٪ صفحه‌ها و Stateهای Matrix؛

- Accessibility automated + manual برای P0.

### ۳۲.۳ Flaky test

Retry برای پنهان‌کردن Flake ممنوع. هر Flaky test باید Quarantine محدود، Owner، علت و Deadline داشته باشد. نرخ Flake در Release gate باید کمتر از ۰.۵٪ و برای P0 صفر باشد.

### ۳۲.۴ Test data

- Synthetic و مجاز؛

- deterministic؛

- بدون PII؛

- شامل DST، Gap، Split/Adjustment در صورت نیاز، precision extreme، negative values در ابزارهای مربوط، zero volume و correction؛

- Factory و Seed versioned؛

- cleanup idempotent.

## ۳۳. CI/CD و کنترل کیفیت

### ۳۳.۱ Pipeline Pull Request

1. Format/Lint؛

2. Type check؛

3. Unit/Property tests؛

4. Contract tests؛

5. Build؛

6. i18n scan؛

7. Secret/dependency/license scan؛

8. Component/accessibility tests؛

9. E2E منتخب؛

10. Visual منتخب؛

11. Bundle budget؛

12. Preview environment؛

13. Required review.

### ۳۳.۲ Pipeline Nightly

- E2E کامل؛

- Visual همه Viewportها؛

- Motion؛

- Cross-browser؛

- Backtest golden suite؛

- Long-running chart soak؛

- Load منتخب؛

- Provider sandbox contract؛

- Accessibility sweep؛

- Dead link و documentation test.

### ۳۳.۳ Release

- Signed artifact و provenance؛

- SBOM؛

- Migration dry-run؛

- Backup؛

- Canary؛

- SLO observation؛

- Error budget check؛

- Rollback command آزموده؛

- Release notes فارسی؛

- Feature flag plan؛

- Post-release smoke.

## ۳۴. برنامه پیاده‌سازی

ترتیب، وابستگی را نشان می‌دهد؛ تیم می‌تواند Streamهای مستقل را موازی اجرا کند.

### فاز ۰ - Baseline و ایمن‌سازی

خروجی:

- Inventory کامل؛

- Characterization tests؛

- Screenshots/Traces؛

- Matrix اولیه؛

- Backup/restore؛

- Threat model؛

- Performance baseline؛

- ADRهای اصلی.

Gate: هیچ تغییر بزرگ پیش از پذیرش Baseline.

### فاز ۱ - Foundation

- Design system؛

- i18n/RTL؛

- Shell responsive؛

- Auth hardening؛

- Observability؛

- CI layers؛

- API contracts؛

- Feature flags.

### فاز ۲ - Chart Core و Data

- Provider interface؛

- Symbol master؛

- History/stream/cache؛

- Renderer؛

- Scale/interaction؛

- P0 chart types؛

- Workspace serialization؛

- Performance harness.

### فاز ۳ - تحلیل

- P0 indicators؛

- Drawing engine و ابزارهای اولویت‌دار؛

- Object Tree؛

- Templates؛

- Multi-pane/Multichart؛

- Watchlist/Search.

### فاز ۴ - Automation

- Alert engine؛

- Replay؛

- Backtest؛

- Paper Trading؛

- Notification/Webhook؛

- Reporting.

### فاز ۵ - NamaScript

- Grammar/runtime؛

- Standard library؛

- Editor؛

- Debugger/Profiler؛

- Publication؛

- Security fuzzing.

### فاز ۶ - کشف بازار و محتوا

- Screener؛

- Heatmap؛

- Calendar؛

- News؛

- Search ranking؛

- AI/Voice.

### فاز ۷ - اتصال‌های منتخب

- LBank referral و public market data؛

- LBank account connection فقط با مجوز و Credential مناسب؛

- OneRoyal referral؛

- Broker adapter scaffold؛

- Eligibility و disclosure؛

- Audit.

### فاز ۸ - Hardening و برابری

- Visual/motion loop؛

- Cross-device؛

- Accessibility manual؛

- Load/soak؛

- Security؛

- Migration؛

- سه اجرای پاک؛

- گزارش تحویل.

## ۳۵. خروجی‌های اجباری تیم

### ۳۵.۱ کد و زیرساخت

- کد Production؛

- Tests؛

- Migrations؛

- IaC؛

- CI/CD؛

- Feature flags؛

- Monitoring dashboards؛

- Alerting؛

- Runbooks؛

- Seed/test data.

### ۳۵.۲ مستندات

- README فارسی برای راه‌اندازی؛

- معماری C4 یا معادل؛

- ADRها؛

- OpenAPI/AsyncAPI؛

- Data dictionary؛

- Design tokens؛

- Component catalog؛

- NamaScript language reference؛

- Security model؛

- Backup/restore؛

- Provider integration؛

- QA evidence index؛

- Release/rollback guide؛

- Known limitations واقعی، بدون پنهان‌کاری.

### ۳۵.۳ گزارش وضعیت

فایل docs/EXECUTION_STATE.md باید همیشه شامل این موارد باشد:

- Commit/branch؛

- آخرین زمان اجرا؛

- فاز جاری؛

- الزام‌های Verified/Failed/Blocked؛

- آزمون‌های آخر؛

- Defectهای باز؛

- تصمیم‌های لازم؛

- نخستین Action بعدی؛

- فرمان Resume؛

- درصد فقط بر اساس تعداد الزام Weighted، نه تخمین ذهنی.

## ۳۶. Risk Register

| ریسک | اثر | کنترل |
| --- | --- | --- |
| بازنویسی شتاب‌زده | حذف رفتار موجود | Baseline، Characterization، Feature Flag |
| تفاوت داده Providerها | خروجی متناقض | Normalization، lineage، contract test |
| کندی چارت | تجربه ضعیف | Benchmark، Worker، LOD، budget gate |
| خطای RTL در UI فشرده | خوانایی پایین | component-level RTL test و viewport matrix |
| Script مخرب/سنگین | اختلال یا نشت | Sandbox، quota، fuzz، isolation |
| سفارش تکراری | زیان کاربر | Idempotency، confirm، state machine، audit |
| محدودیت جغرافیایی Provider | پیام یا اتصال نادرست | Eligibility gate و متن خنثی |
| Asset نامعتبر | ریسک حقوقی/برندی | registry منبع و approval |
| Screenshot ناپایدار | Flake | clock/data/font/browser lock و masks |
| AI action اشتباه | تغییر ناخواسته | preview، confirm، permission و eval |
| مهاجرت Layout | از دست رفتن تنظیمات | versioned schema و fixtureهای قدیمی |
| Scope انفجاری | توقف پروژه | P0/P1 gates، phase و matrix |
| ادعای اتمام زودهنگام | تحویل ناقص | توقف فقط با شواهد و سه اجرای پاک |

## ۳۷. Definition of Done هر قابلیت

یک قابلیت فقط Done است اگر:

1. شناسه الزام و Acceptance criteria دارد؛

2. UX همه Stateها طراحی شده؛

3. Persian/RTL و Whitelist رعایت شده؛

4. Permission و Threat model بررسی شده؛

5. Unit/Integration/E2E مناسب دارد؛

6. Visual و در صورت نیاز Motion baseline دارد؛

7. Accessibility بررسی شده؛

8. Performance budget پاس شده؛

9. Analytics/Telemetry کمینه و امن دارد؛

10. Error/Offline/Retry کامل است؛

11. Documentation و Changelog به‌روز است؛

12. Feature flag و Rollback در صورت نیاز دارد؛

13. Code review و QA evidence ثبت شده؛

14. هیچ Placeholder، TODO یا مسیر مرده باقی نمانده؛

15. Matrix به VERIFIED تغییر کرده است.

## ۳۸. معیار پذیرش نهایی نسخه

### ۳۸.۱ Product

- همه سفرهای P0/P1 پذیرفته؛

- امکانات Baseline حفظ‌شده؛

- فقط LBank و OneRoyal در Integrations؛

- لینک‌ها دقیق و آزموده؛

- UI عمومی فارسی؛

- Onboarding، Help و خطاها کامل؛

- هیچ CTA نمایشی بدون کارکرد.

### ۳۸.۲ Engineering

- Build reproducible؛

- Test suite سه بار متوالی سبز؛

- Migration/rollback آزموده؛

- صفر Critical/High security issue؛

- SLO و budget پاس؛

- Browser/device matrix پاس؛

- Backup/restore پاس؛

- Observability فعال.

### ۳۸.۳ Visual/Motion

- تمام صفحات و Stateهای Matrix Screenshot دارند؛

- Diff خارج Threshold صفر؛

- Clipping/overlap صفر؛

- Motion trace حیاتی پاس؛

- RTL و focus snapshot پاس؛

- Baseline updateها Approved و مستند.

### ۳۸.۴ Data/Trading

- Data lineage و quality قابل‌مشاهده؛

- Stream reconnect و correction پاس؛

- Backtest deterministic؛

- Paper Trading کاملاً برچسب‌دار؛

- اتصال واقعی فقط با مجوز، Sandbox و Kill switch؛

- Referral/Eligibility شفاف.

## ۳۹. قالب گزارش اختلاف بصری

```text
## VIS-<شناسه>
- مسیر:
- Viewport / DPR / Theme:
- State و Fixture:
- Expected:
- Actual:
- Pixel diff:
- Perceptual diff:
- ناحیه اختلاف:
- علت ریشه‌ای:
- اصلاح:
- آزمون جلوگیری از بازگشت:
- لینک Expected / Actual / Diff / Trace:
- وضعیت Review:
```

## ۴۰. قالب ADR

```text
# ADR-<شماره>: <عنوان>
- وضعیت: پیشنهاد / پذیرفته / منسوخ
- تاریخ:
- مسئله:
- محدودیت‌ها:
- گزینه‌ها:
- داده و Benchmark:
- تصمیم:
- پیامدهای مثبت:
- پیامدهای منفی:
- راه بازگشت:
- الزام‌های مرتبط:
```

## ۴۱. منابع فنی پایه

منابع باید در زمان اجرا دوباره بررسی شوند؛ نسخه و تاریخ دسترسی در ADR ثبت شود.

- OpenAI، معرفی GPT-5.6 و حالت Sol/Ultra؛

- OpenAI، مستندات مدل‌های Codex؛

- TradingView، صفحه رسمی قابلیت‌ها و مستندات Charting Library؛

- TradingView، شرایط استفاده و سیاست داده؛

- LBank، مستندات رسمی REST/WebSocket API و شرایط استفاده؛

- OneRoyal، صفحات رسمی پلتفرم و شرایط ارائه خدمت؛

- W3C، WCAG 2.2؛

- Google web.dev، Core Web Vitals؛

- Microsoft Playwright، Visual comparisons؛

- OWASP، ASVS نسخه جاری.

فهرست URLهای بررسی‌شده در فایل مستقل 04_REFERENCE_SOURCES.md نگهداری می‌شود.

## ۴۲. فرمان نهایی به تیم اجرا

ساخت Pro Chart با «نزدیک به کامل» یا «از نظر ظاهری خوب است» پایان نمی‌یابد. هر ادعا باید با شناسه الزام، Test، Screenshot/Trace و نتیجه قابل‌بازتولید پشتیبانی شود. کیفیت مورد انتظار در تمام جزئیات است: متن، فاصله، آیکون، Gesture، خطا، داده، ذخیره، امنیت و بازیابی.

تیم باید قابلیت‌های فعلی را حفظ کند، کمبودها را مرحله‌به‌مرحله جبران کند و هر دور توسعه را با اندازه‌گیری ببندد. توقف تنها بر اساس معیارهای بخش ۲ و ۳۸ مجاز است.

## الحاقیه وضعیت اجرای واقعی — ۱۵ ژوئیهٔ ۲۰۲۶

این الحاقیه وضعیت اجرای سند را از وضعیت الزام‌ها جدا می‌کند و جایگزین معیار `COMPLETE` بخش ۲.۲ نیست.

- rollout production در `2026-07-15T04:22:41Z–04:22:53Z` روی هشت سرویس انجام شد؛ ۱۱ سرویس compose running هستند.
- OneRoyal در User Portal واقعی و Main Frontend فقط referral-only است؛ اتصال/سفارش MT5 و forex copy قدیمی fail-closed شده‌اند و تحلیل بازار غیرمعاملاتی حفظ شده است.
- digestهای اجرایی: Backend=`sha256:23f49262ce660e6ad405ae72cd96037aa4d70e75a085163143dc07d98646223e`، Main=`sha256:20e2ad31c1280f44850530a7ac12456f4817da8f163fdd230defe0436f7fa3ec`، User=`sha256:6a5c2512392cdb8257c804a0ca116c4fed9ce4186fd9a6e2685c313d1dcf6216`، Panel=`sha256:8b6231de18db8810b8d83e02b3db83960cb9b5f1b33de0549961360073535ea2`.
- Gateهای همین بسته: backend focused=`40 PASS + 20 subtests`، frontend unit=`30/30`، browser production=`9/9`، performance measured=`6/6`، Gitleaks=`0`؛ با این حال معیار توقف نهایی به‌دلیل clean full-suite سه‌باره، accessibility دستی، secret rotation، صفر Critical/High و signing/attestation هنوز برقرار نشده است.
- rollback هشت سرویس آماده و فعال‌نشده است. شاهد قابل بازتولید و checksum در مسیر deployment ثبت شده است.
