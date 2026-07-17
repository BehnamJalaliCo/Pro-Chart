# منابع رسمی و نسخه‌های مبنا

آخرین بازبینی: `2026-07-14T22:34:13Z`

این فهرست فقط منابع رسمی را ثبت می‌کند. Screenshot یا رفتار محصول مرجع صرفاً برای QA داخلی مجاز است و هیچ‌یک از منابع زیر مجوز استخراج Asset، کد، Endpoint خصوصی یا دورزدن کنترل دسترسی نیست.

| حوزه | نسخه/وضعیت مبنا | منبع رسمی | تصمیم اجرایی |
|---|---|---|---|
| مدل OpenAI | GPT-5.6 Sol؛ شناسه `gpt-5.6-sol` و alias برابر `gpt-5.6`؛ بالاترین reasoning مستند `max` | [OpenAI Models](https://developers.openai.com/api/docs/models) و [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) | عبارت «Ultra» در منبع رسمی به‌عنوان reasoning level نیامده است. Session فعلی امکان تعویض مدل را در اختیار عامل نگذاشته؛ بنابراین این اختلاف در Execution State ثبت شده است. |
| دسترس‌پذیری | WCAG 2.2، W3C Recommendation مورخ ۱۲ دسامبر ۲۰۲۴ | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | هدف Shell و سفرهای P0 سطح AA است. معیارهای A و AA باید تک‌به‌تک نگاشت شوند؛ نبود Finding با شدت بالا به‌تنهایی اثبات Conformance نیست. |
| Web Vitals | LCP ≤ 2.5s، INP ≤ 200ms، CLS ≤ 0.1 در صدک ۷۵، جداگانه برای Mobile/Desktop | [web.dev Web Vitals](https://web.dev/articles/vitals) | RUM مرجع پذیرش است؛ Lab برای Regression استفاده می‌شود و جای Field data را نمی‌گیرد. |
| Visual regression | Playwright `toHaveScreenshot`، baseline وابسته به browser/platform و threshold صریح | [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots) | Browser، OS، Font، Locale، Timezone، DPR، Clock و Fixture قفل می‌شوند. Baseline فقط با Approval و دلیل تغییر می‌کند. |
| Trace | Trace Viewer و `retain-on-failure`/`on-first-retry` | [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer) | چون P0 نباید با Retry پنهان شود، baseline اولیه از `retain-on-failure` استفاده می‌کند؛ Retry صرفاً پس از تعریف سیاست Flake مجاز است. |
| امنیت برنامه | OWASP ASVS `5.0.0`، انتشار ۳۰ مه ۲۰۲۵ | [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) | شناسه کنترل‌ها با قالب پایدار `v5.0.0-<chapter.section.requirement>` ثبت می‌شود. سطح هدف هر ماژول در Threat Model تعیین می‌شود. |
| LBank | API V2، REST و WebSocket؛ مستندات دارای Changelog تا ۱۸ مارس ۲۰۲۶ | [LBank API](https://www.lbank.com/docs/) | فقط API رسمی؛ Public market data قابل طراحی است. Account/trading تا Credential آزمایشی، مجوز، Vault و Kill switch فعال نمی‌شود. |
| OneRoyal | معرفی/Referral-only تا دریافت قرارداد و API رسمی | [OneRoyal](https://www.oneroyal.com/) | Scraping یا Automation کابین ممنوع؛ UI نباید اتصال یا معامله واقعی را وانمود کند. |
| TradingView | مستندات و شرایط رسمی | [Charting Library docs](https://www.tradingview.com/charting-library-docs/latest/) و [Policies](https://www.tradingview.com/policies/) | فقط تحلیل رفتار و کیفیت در QA داخلی؛ Feed خصوصی، Asset و کد مرجع وارد محصول نمی‌شود. |

## کنترل مقصد Referral

بررسی HTTP در `2026-07-14`، بدون ارسال Credential یا داده شخصی:

| ورودی الزام‌آور | نتیجه مشاهده‌شده | وضعیت |
|---|---|---|
| `https://www.lbank.com/ref/PROCHART` | یک Redirect و پاسخ نهایی `200` در Signup رسمی با کد `PROCHART` | BASELINED |
| `https://vc.cabinet.oneroyal.com/fa/links/go/12412` | یک Redirect و پاسخ نهایی `200` در Signup فارسی رسمی با شناسه Referral | BASELINED |

این مشاهده جای Eligibility، بررسی شرایط جاری Provider یا Contract test مسیرهای داخلی `/go/*` را نمی‌گیرد.
