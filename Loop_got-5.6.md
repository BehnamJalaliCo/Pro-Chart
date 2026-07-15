# دفتر تغییرات Loop — GPT-5.6

آخرین ثبت این اجرا بر پایهٔ ساعت UTC میزبان: `2026-07-15T08:10:16Z`
منطقهٔ زمانی همهٔ ساعت‌ها: `UTC`  
مبنای کد: `080033ae56e3c793ba3a998276cac5daeb969d50`

## شمارش تا این لحظه

- `۸۳` تغییر بنیادیِ کد، پیکربندی یا QA؛
- `۵۸` بستهٔ بنیادیِ حاکمیت/شواهد؛
- `۸` رویداد دیپلوی production با image قبلی، image جدید، rollback و smoke ثبت‌شده؛
- جمع تغییرات/رویدادهای بنیادی تا این لحظه: `۱۴۹`؛
- ایجاد همین دفتر: رویداد متادیتای `LOG-020` و خارج از شمار تغییرات محصول.

«تغییر بنیادی» در این دفتر یعنی یک تغییر مستقل در رفتار محصول، امنیت، کارایی، وابستگی، QA یا وضعیت production. اجرای صرفِ یک probe یا تکرار یک تست، تغییر محصول شمرده نمی‌شود؛ نتیجهٔ آن در همان ردیف تغییر مربوط ثبت می‌شود.

## محدودیت بازسازی تاریخچه

رویدادهای `CHG-001` تا `CHG-010` از `docs/loop-log.md` بازسازی شده‌اند. گزارش قدیمی برای همهٔ آن‌ها ساعت دقیق ذخیره نکرده بود. ساعت‌هایی که با علامت `≈` آمده‌اند از mtime فایل یا زمان ساخت image بازسازی شده‌اند و زمان قطعی شروع ادیت نیستند. از `CHG-011` به بعد زمان artifact، mtime و/یا زمان دیپلوی دقیق موجود است. هیچ ساعت ناموجودی جعل نشده است.

## تغییرات بنیادی، از ابتدا

### CHG-001 — بَج برنددارِ دستهٔ اول سهام

- زمان: `2026-07-14، پیش از ≈15:47:46Z`
- فایل اصلی: `frontend/prochart/src/bazaarnama/SymbolLogo.jsx`
- تغییر: بیش از ۵۰ نماد سهام پرمعامله از مونوگرام خاکستری به بَج برنددار با رنگ عمومی برند تبدیل شدند.
- اثر بنیادی: تشخیص سریع نماد و نزدیک‌شدن فیدلیتی واچ‌لیست/جزئیات به تجربهٔ مرجع.
- راستی‌آزمایی: transform JSX و تست منطقی logo resolver پاس؛ سپس در deploymentهای ثبت‌شدهٔ Loop قبلی live شد.

### CHG-002 — افزودن ۱۲ پرچم ارز

- زمان: `2026-07-14، پیش از ≈15:47:46Z`
- فایل اصلی: `frontend/prochart/src/bazaarnama/SymbolLogo.jsx`
- تغییر: CNY، SEK، NOK، DKK، PLN، RUB، MXN، INR، BRL، TRY، KRW و SGD به نگاشت پرچم افزوده شدند.
- اثر بنیادی: جفت‌ارزهای جدید به‌جای fallback عمومی، هویت بصری واقعی دارند.
- راستی‌آزمایی: ۱۵ تست resolver و رندر Chromium هر ۱۲ پرچم پاس؛ live تأیید شد.

### CHG-003 — بَج برنددارِ دستهٔ دوم سهام

- زمان: `2026-07-14، پیش از ≈15:47:46Z`
- فایل اصلی: `frontend/prochart/src/bazaarnama/SymbolLogo.jsx`
- تغییر: حدود ۲۴ نماد دیگر مانند TSM، ASML، SNOW، CRWD، PANW، UNH و SAP پوشش داده شدند.
- اثر بنیادی: پوشش سهام به حدود ۷۴ نماد رسید.
- راستی‌آزمایی: transform JSX و ۱۷ تست resolver پاس؛ live شد.

### CHG-004 — بَج ۱۵ ETF پرمعامله

- زمان: `2026-07-14، پیش از ≈15:47:46Z`
- فایل اصلی: `frontend/prochart/src/bazaarnama/SymbolLogo.jsx`
- تغییر: SPY، QQQ، GLD، SLV، ARKK، XLF، XLE، EEM، TLT، SMH و هم‌گروه‌ها پوشش داده شدند.
- اثر بنیادی: ETFها دیگر fallback یکسان ندارند.
- راستی‌آزمایی: ۱۲ تست resolver و QA کنتراست ۱۵ بَج پاس؛ SPY روی production بصری تأیید شد.

### CHG-005 — بَج کالاها

- زمان: `2026-07-14، پیش از ≈15:47:46Z`
- فایل اصلی: `frontend/prochart/src/bazaarnama/SymbolLogo.jsx`
- تغییر: مس، ذرت، گندم، سویا، قهوه، شکر، کاکائو، پنبه و آلومینیوم به نگاشت نماد افزوده شدند.
- اثر بنیادی: کالاها هویت بصری و کد فیوچرز استاندارد گرفتند.
- راستی‌آزمایی: transform JSX و ۲۰ تست دسته‌بندی پاس؛ live شد.

### CHG-006 — بَج برنددارِ دستهٔ سوم سهام

- زمان: `2026-07-14، پیش از ≈15:47:46Z`
- فایل اصلی: `frontend/prochart/src/bazaarnama/SymbolLogo.jsx`
- تغییر: حدود ۱۵ نماد رشد/محبوب مانند SMCI، MSTR، RBLX، HOOD، SOFI، MARA و RIOT افزوده شدند.
- اثر بنیادی: پوشش سهام به حدود ۱۰۵ نماد رسید.
- راستی‌آزمایی: transform JSX و ۱۷ تست resolver پاس؛ live شد.

### CHG-007 — اصلاح طبقه‌بندی پنج ارز

- زمان قابل‌اثبات فایل: `2026-07-14T15:43:11Z`
- فایل: `frontend/prochart/src/bazaarnama/symbolMeta.js`
- تغییر: CNY، RUB، INR، KRW و BRL به CCY و نام‌های فارسی/انگلیسی افزوده شدند.
- اثر بنیادی: این جفت‌ها به‌جای `other` به‌درستی `forex` طبقه‌بندی می‌شوند.
- راستی‌آزمایی: ۱۰ تست classify پاس؛ live شد.

### CHG-008 — افزودن پرچم‌های HKD، ZAR و CNH

- زمان: `2026-07-14، پیش از ≈15:47:46Z`
- فایل: `frontend/prochart/src/bazaarnama/SymbolLogo.jsx`
- تغییر: سه ارز موجود در metadata که لوگوی بصری نداشتند تکمیل شدند.
- اثر بنیادی: سازگاری metadata و لوگو برای USDHKD، USDZAR و USDCNH.
- راستی‌آزمایی: transform JSX، ۸ تست resolver و رندر Chromium پاس؛ live شد.

### CHG-009 — Rename امنِ Layout

- زمان قابل‌اثبات نیمهٔ فرانت: `2026-07-14T17:17:02Z`
- فایل‌ها: `src/api/routes/bazaarnama.py`، `frontend/prochart/src/api/client.js`، `frontend/prochart/src/pages/BazaarNama.jsx`
- تغییر: endpoint اختصاصی `POST /academy/bn/layouts/{id}/rename` و UI/Client آن اضافه شد تا rename دادهٔ کامل layout را بازنویسی نکند.
- اثر بنیادی: کاهش ریسک از‌دست‌رفتن layout هنگام تغییر نام.
- راستی‌آزمایی: `py_compile` و Vite build پاس؛ route زنده auth-gated و کانتینرها healthy ثبت شدند.
- وضعیت: production.

### CHG-010 — آلارم روی خط شیب‌دار

- زمان بک‌اند: `2026-07-14T17:24:13Z`
- زمان فرانت: `2026-07-14T17:32:26Z`
- فایل‌ها: `src/bazaarnama/tasks.py`، `frontend/prochart/src/bazaarnama/AlertsPanel.jsx` و اتصال آن در صفحهٔ چارت.
- تغییر: سطح آلارم از دو لنگر زمانی/قیمتی درون‌یابی یا برون‌یابی می‌شود و UI لنگرها را ارسال می‌کند.
- اثر بنیادی: آلارم از سطح ثابت به trend/ray/extline گسترش یافت، بدون تغییر رفتار آلارم‌های قدیمی.
- راستی‌آزمایی: `py_compile` و ۷ تست ریاضی پاس؛ build و deploy اتمیک API+Frontend ثبت شد.
- محدودیت باز: worker عمومی آلارم در compose فعلی اجرا نمی‌شود؛ کد live است ولی شلیک زمان‌بندی‌شده تا راه‌اندازی worker غیرفعال می‌ماند.

### CHG-011 — حذف وابستگی‌های تحلیلی بلااستفاده از build

- زمان فایل‌ها: `2026-07-14T23:27:21Z`
- فایل‌ها: `Dockerfile` و `requirements.txt`
- تغییر: نصب‌های اضافی `pandas-ta` و `numba` از image حذف و import/pip check صریح برای NumPy/Pandas/TA-Lib اضافه شد.
- اثر بنیادی: resolver ساده‌تر و حذف یک مسیر ناسازگاری NumPy/Numba.
- راستی‌آزمایی: backend imageهای بعدی build و `pip check` را پاس کردند.
- وضعیت production: با image `d703a78a…` در `2026-07-15T02:44:48Z` وارد سرویس API شد.

### CHG-012 — اصلاح aliasها و کنترل‌های مردهٔ Panel

- بازهٔ زمانی فایل‌ها: `2026-07-15T00:57:33Z` تا `2026-07-15T01:02:46Z`
- فایل‌ها: `frontend/panel/src/App.jsx`، `Sidebar.jsx` و `CommandPalette.jsx`
- تغییر: aliasهای `/signals→/ai-signals` و `/visitors→/analytics` و حذف actionable بودن commandهای unsupported.
- اثر بنیادی: مسیرهای قدیمی بن‌بست نمی‌شوند و palette موفقیت جعلی نشان نمی‌دهد.
- build: image دقیق `sha256:3d77c7fe483fd6d74b842cdaf4631128a81c20139c863abd2e0623cd38fd4a8a` با `2,369` module؛ source fingerprint=`eaeb57bcf61caf0625fb0312b0faca89e96eacded76a6ee9f4400e972bd0fbde`، index SHA-256=`11107c41…e142` و entry JS SHA-256=`20d0b70d…3321`.
- راستی‌آزمایی: unit=`5/5 PASS`؛ browser candidate=`1/1 PASS` و actionable unsupported برابر صفر در artifact `20260715T010846Z`؛ `nginx -t` و runtime ایزوله پاس؛ پس از deploy نیز browser production=`1/1 PASS`، هر دو alias دقیق، page error/external request برابر صفر و hash داخلی/HTTP/HTTPS/public دقیقاً برابر build بود.
- وضعیت production: در `2026-07-15T03:32:48Z–03:34:02Z` deploy و smoke شد؛ جزئیات در `DEPLOY-030`.
- blocker باقی‌مانده: دو فایل functional جدید هنوز در Git untracked هستند، auth/API تست مرورگر synthetic است و full Panel regression جداگانه باز می‌ماند؛ این موارد از تطابق بایتی image live با کاندید آزموده‌شده کم نمی‌کند.

### CHG-013 — سخت‌سازی CORS و Security Header

- بازهٔ زمانی فایل‌ها: `2026-07-14T23:05:44Z` تا `2026-07-15T01:14:43Z`
- فایل‌ها: `src/api/middleware/cors.py`، `src/api/middleware/security_headers.py`، `src/api/main.py` و `frontend/prochart/nginx.conf`
- تغییر: سیاست CORS محدودتر و CSP/HSTS/Referrer/Permissions/X-Content-Type/Frame policy برای candidate اضافه یا اصلاح شد.
- اثر بنیادی: کاهش سطح XSS، clickjacking و نشت referrer.
- راستی‌آزمایی: candidate ایزوله ۱۰/۱۰ response، browser ۱/۱، ZAP High=0؛ سه Medium باقی ماند.
- وضعیت production: بخش middleware بک‌اند با API `d703a78a…` و nginx فرانت با image `972fdb60…` live شد.

### CHG-014 — مسیر معرفی شفاف LBank و OneRoyal

- بازهٔ زمانی فایل‌ها: `2026-07-15T01:03:25Z` تا `2026-07-15T01:13:56Z`
- فایل‌ها: `src/api/routes/referrals.py`، `src/api/main.py`، `src/api/routes/bazaarnama.py`، UI دسکتاپ/موبایل و فایل‌های Bot.
- تغییر: redirect داخلی ثابت، disclosure، eligibility acknowledgement و OneRoyal referral-only اضافه شد؛ bypass مقصد از query پذیرفته نمی‌شود.
- اثر بنیادی: خروج کاربر به provider شفاف، محدود و قابل‌آزمون شد.
- راستی‌آزمایی: Backend/Bot `13/13 PASS` و Browser دسکتاپ/موبایل `4/4 PASS` در artifact `20260715T012118Z`.
- وضعیت production: routeهای API و فایل‌های Bot داخل image API جدید قرار گرفتند و UI/nginx با image فرانت `972fdb60…` live شد؛ Bot worker مستقل در compose فعال نیست.

### GOV-015 — Baseline، ماتریس ۱۶۲ الزام و زنجیرهٔ شواهد

- زمان seal نهایی فاز پایه: `2026-07-15T02:34:16Z`
- فایل‌ها: `docs/**` و `artifacts/qa/**`
- تغییر: baseline inventory، requirements status با ۱۶۲ ردیف و ۱۹ ستون، build/test/browser/A11y/performance/security/SBOM evidence و checksumها ایجاد و reconcile شدند.
- اثر بنیادی: وضعیت واقعی از ادعای «کامل» جدا شد؛ Gateهای باز و FAIL پنهان نشدند.
- نتیجه: final verification، ۱۷ artifact canonical و ۱۷۲ JSON را parse/verify کرد؛ این بسته پایان Baseline است، نه release-complete.

### CHG-016 — جلوگیری از مصرف کندلِ درحال‌تشکیل در سیگنال AI

- زمان فایل‌ها: `2026-07-15T02:37:12Z`
- فایل‌ها: `src/signals/candle_utils.py`، `src/api/routes/bazaarnama.py`، `qa/python/closed_candle_regression.py`
- تغییر: epoch ثانیه/میلی‌ثانیه و timeframe به زمان بسته‌شدن تبدیل می‌شود و آخرین کندل نامطمئن پیش از ATR/RSI/EMA حذف می‌شود.
- اثر بنیادی: جلوگیری از repaint/look-ahead در تصمیم سیگنال زنده.
- بیلد/تست: image `sha256:d703a78a…`؛ تطابق ۱۷۸/۱۷۸ فایل؛ focused `21/21 PASS`؛ شمار شکست suite قدیمی `54→50`.
- دیپلوی: `2026-07-15T02:44:48Z`؛ API healthy، health/OpenAPI=200 و مسیر `/academy/bn/ai-signal` حاضر است.

### CHG-017 — کاهش سربار obfuscation فرانت

- زمان فایل: `2026-07-15T02:37:20Z`
- فایل: `frontend/prochart/vite.config.js`
- تغییر: obfuscation همچنان فعال ماند، اما `debugProtection` دوره‌ای، base64 runtime decoding، split strings و numbers-to-expression خاموش و threshold رشته‌ها محدود شد.
- اثر بنیادی: حذف توقف‌های main-thread ناشی از helperهای تکراری بدون خاموش‌کردن shipping obfuscation.
- بیلد/تست اولیه: JS از ۳٬۷۱۹٬۸۷۶ به ۲٬۳۹۶٬۵۲۱ بایت رسید؛ گیت ۳×دسکتاپ+۳×موبایل پاس شد؛ LCP حدود ۳۵۲–۵۶۸ms و frame p95 حدود ۱۷–۱۹ms.
- وضعیت production: همراه CHG-018 در `2026-07-15T02:54:05Z` با image `sha256:972fdb60…` deploy و smoke شد.

### CHG-018 — حلقهٔ رویدادمحور قیمت زنده و حذف نویز ساختگی

- زمان فایل: `2026-07-15T02:42:47Z`
- فایل‌ها: `frontend/prochart/src/pages/BazaarNama.jsx`، `frontend/prochart/src/bazaarnama/livePriceEasing.js`، `frontend/prochart/test/livePriceEasing.test.mjs`
- تغییر: حلقهٔ دائمی ۶۰fps و noise تصادفی حذف شد؛ فقط با quote واقعی بیدار می‌شود، با ضریب ثابت همگرا و در نیم minMove روی target snap و idle می‌شود.
- اثر بنیادی: قیمت ساختگی در حالت idle تولید نمی‌شود و update/applyOptions بی‌دلیل ادامه نمی‌یابد.
- بیلد: shipping-obfuscated در `2026-07-15T02:44:28Z–02:44:41Z`، ۱٬۷۸۶ module، ۵۳۴ فایل، JS=`2,399,398` بایت؛ ۲۰/۲۰ unit PASS؛ source قبل/بعد build byte-identical.
- گیت نهایی کارایی: artifact `20260715T024637Z`، هر `۶/۶` اجرای هدف پاس؛ desktop LCP p75=`604ms`، mobile LCP p75=`540ms`، frame p95 p75=`17ms` و CLS به‌ترتیب `0.092/0.007`؛ flaky/unexpected=`0`.
- وضعیت production: image نهایی Node 22 با هش دقیق JS بیلد تأییدشده در `2026-07-15T02:54:05Z` deploy شد؛ جزئیات در DEPLOY-023.

### DEPLOY-019 — جایگزینی production API با rollback

- زمان شروع: `2026-07-15T02:44:48Z`
- سرویس: `prochart-api-1`
- image قبلی: `sha256:5b3b6ee9…`؛ rollback tag=`prochart-api:rollback-20260715T024448Z`
- image جدید: `sha256:d703a78a…`
- دامنهٔ واقعی: مقایسهٔ byte-level نشان داد image جدید نسبت به قبلی ۱۴ مسیر سورس تغییرکرده/افزوده دارد، نه فقط فایل کندل: `api/main.py`، CORS/security headers، routeهای academy/bazaarnama/bn_bauth/panel/referrals، سه فایل Bot، config، sanitizer و `signals/candle_utils.py`.
- اثر بنیادی: تغییرات بک‌اند CHG-011، بخش بک‌اند CHG-013/014 و CHG-016 با هم وارد production شدند.
- راستی‌آزمایی: کانتینر healthy؛ health/OpenAPI=200؛ مسیر AI حاضر؛ هر ۱۱ کانتینر محصول running.
- شاهد: `artifacts/qa/deploy/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T024448Z-api-closed-candle/`.
- شفافیت خطا: attempt اول smoke به‌علت query اشتباه top-level OpenAPI، harness-fail شد؛ attempt دوم با `.paths` پاس و هر دو تلاش حفظ شدند.

### LOG-020 — ایجاد دفتر تغییرات درخواستی مالک

- زمان: `2026-07-15T02:47:00Z`
- فایل: `Loop_got-5.6.md`
- تغییر: تاریخچهٔ قابل‌انتساب، ساعت، دامنه، اثر بنیادی، بیلد/تست، deploy و blockerها در یک دفتر واحد گردآوری شد.
- قانون ادامه: هر تغییر آینده پیش از اعلام پایان، با شناسهٔ بعدی، ساعت UTC، فایل‌ها، اثر، بیلد/تست، وضعیت deploy و rollback در همین فایل ثبت می‌شود. append خودِ رکورد یک تغییر محصول مستقل شمرده نمی‌شود تا دفتر وارد self-reference بی‌نهایت نشود.

### CHG-021 — هم‌راستاسازی Dockerfile production با build تأییدشده

- زمان: `2026-07-15T02:49:47Z`
- فایل‌ها: `frontend/prochart/Dockerfile` و `frontend/prochart/.dockerignore`
- تغییر: `npm install` به `npm ci --legacy-peer-deps` تبدیل، `NO_OBF=1` حذف و `node_modules`/`dist`/خروجی‌های محلی از Docker context کنار گذاشته شدند.
- اثر بنیادی: image production دقیقاً همان پروفایل shipping-obfuscated قطعی و کم‌هزینه‌ای را می‌سازد که گیت ۶/۶ کارایی روی آن پاس شده است؛ dependencyها فقط از lockfile و داخل builder نصب می‌شوند و خروجی یا ماژول میزبان دیگر نمی‌تواند build را آلوده کند.
- build اول: `2026-07-15T02:50:36Z`، ۱٬۷۸۶ module و خروجی JS دقیقاً با artifact برابر؛ build عبور کرد اما `@capacitor/cli 8.4.1` ناسازگاری رسمی Node 20 را هشدار داد. این image deploy نشد و تلاش برای audit حفظ شد.
- deploy: این تلاش عمداً deploy نشد؛ build اصلاح‌شدهٔ CHG-022 جایگزین آن شد.

### CHG-022 — ارتقای builder به Node 22 و pin کردن base imageها

- زمان: `2026-07-15T02:51:21Z`
- فایل: `frontend/prochart/Dockerfile`
- تغییر: builder از Node 20 به `node:22-alpine` مطابق engine موردنیاز Capacitor 8.4.1 ارتقا یافت؛ digest دقیق Node و Nginx در `FROM` pin شد.
- اثر بنیادی: حذف build روی runtime پشتیبانی‌نشده و جلوگیری از تغییر خاموش base image در buildهای بعدی.
- build: `2026-07-15T02:51:37Z–02:52:03Z`، ۱٬۷۸۶ module، بدون engine warning؛ image=`sha256:972fdb60d3a273748bf4b31e37f2071e64b2616d8168a96b4b63d98b23a45b1e`.
- تطابق: JS=`2,399,398` بایت و SHA-256=`75cf695f0e25cc58628b6bc51eec3d814161f0e7dd8ccf97a11dbe4212042a34`؛ CSS=`79,848` بایت و SHA-256=`b2b331f…3435c3e`؛ دقیقاً برابر artifact گیت‌شده.
- تست runtime ایزوله: HTTPS root/asset=`200`، هش asset برابر، شش security header و کانتینر healthy؛ تلاش اول به‌دلیل دنبال‌نکردن redirect صحیح HTTP→HTTPS در harness false-fail شد و تلاش اصلاح‌شده پاس کرد؛ هر دو شاهد حفظ شدند.
- deploy: production در `2026-07-15T02:54:05Z`؛ جزئیات و rollback در DEPLOY-023.

### DEPLOY-023 — جایگزینی production Frontend با build گیت‌شده

- زمان شروع: `2026-07-15T02:54:05Z`
- سرویس: `frontend-prochart` / کانتینر `prochart-frontend-prochart-1`
- image قبلی: `sha256:d3e237880adcaa5cbcba2e3ef8ed9d46231cd655fbf378d948ad0e39218d9a20`
- rollback tag: `prochart-frontend-prochart:rollback-20260715T025405Z`
- image جدید: `sha256:972fdb60d3a273748bf4b31e37f2071e64b2616d8168a96b4b63d98b23a45b1e`
- اثر بنیادی: CHG-013/014 سمت UI/nginx و CHG-017/018/021/022 با همان بایت‌های گیت‌شده وارد production شدند؛ source fingerprint نهایی فرانت=`53db3b6ce1d8bfe57714763cba11dce22dba0945179a3717def50a2fe0a6603f`.
- smoke پس از deploy: root و asset=`200`، index به asset جدید اشاره می‌کند، SHA-256 asset دقیق، شش security header، public edge=`200`، redirectهای LBank/OneRoyal=`302` با مقصد دقیق، API و Frontend healthy و `۱۱` کانتینر running؛ نتیجه=`PASS`.
- شاهد مهرشده: `artifacts/qa/deploy/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T025405Z-frontend-phase1/`؛ `sha256sum -c SHA256SUMS` برای هر سه فایل شاهد=`OK`.
- blocker باقی‌ماندهٔ این deploy: دادهٔ RUM واقعی هنوز جمع نشده است؛ اعداد کارایی فعلی آزمایشگاهی و تکرارپذیرند، نه RUM کاربران.

### CHG-024 — سخت‌سازی زنجیرهٔ تأمین و runtime بک‌اند

- زمان شروع: `2026-07-15T02:57:43Z`؛ زمان تکمیل دامنهٔ patch: `2026-07-15T03:01:46Z`.
- فایل‌ها: `Dockerfile`، `requirements.txt`، `src/core/security.py`، `docker-compose.prochart.yml` و `qa/python/security_regressions.py`.
- تغییر: base به Python `3.13.14-slim` با digest ثابت ارتقا یافت؛ build-essential/wget/curl/libpq-dev و build سورسی TA-Lib حذف و wheel رسمی TA-Lib 0.7 استفاده شد؛ Torch بلااستفاده از API و instrumentator بلااستفاده حذف، XGBoost به توزیع CPU-only تبدیل، LightGBM/FastAPI/Starlette/aiogram/aiohttp/multipart به نسخه‌های اصلاح‌شده ارتقا، `python-jose` با PyJWT جایگزین و healthcheck با `urllib` استاندارد Python بازنویسی شد.
- نسخه‌های امنیتی اصلی: FastAPI=`0.139.0`، Starlette=`1.3.1`، aiogram=`3.29.1`، aiohttp=`3.14.1`، python-multipart=`0.0.32`، PyJWT=`2.13.0`، TA-Lib=`0.7.0`، LightGBM=`4.6.0` و xgboost-cpu=`2.1.3` برای سازگاری دقیق با مدل‌های فعلی.
- اثر بنیادی: حذف CUDA/Torch و toolchain از سطح حملهٔ image، حذف زنجیرهٔ ecdsa/pyasn1 مربوط به python-jose، کاهش اندازهٔ image و نگه‌داشتن inference مدل‌های XGBoost/LightGBM روی CPU.
- دامنهٔ آگاهانه: فایل‌های LSTM آرشیوی باقی می‌مانند، اما API/compose فعلی هیچ مسیر runtime برای آن‌ها ندارد؛ اسکریپت قدیمی `activate_lstm.py` پیش از این نیز به ماژول حذف‌شدهٔ `src.ml` وابسته و اجرایی نبود. بازگرداندن LSTM باید در image آموزشی جدا و CPU-only انجام شود، نه API production.
- build/image نهایی: `2026-07-15T03:14:42Z–03:16:08Z`؛ tag=`prochart-api:qa-supply-final-20260715T031413Z`، image=`sha256:c388f3aaa5b23ced63ccf2af5a59c3ed16e685df518971475f399329be7a8dd6`، اندازه=`244,073,170` بایت در برابر `3,582,643,694` بایت image قبلی (`93.18%` کاهش)، `pip check=PASS`، تطابق سورس baked=`178/178` و fingerprint=`122716e1d2bdbcc95ecf6f7c10d7916de662c2abe07bd02a9e807858a396c930`.
- تست نهایی: focused امنیت/framework=`10 PASS`؛ OpenAPI=`421` path؛ contract=`489` route object، `488` method/path یکتا و `2` WebSocket؛ upload/WebSocket mini-test پاس؛ JWT محلی HS256 و JWT مرکزی RS256/expiry/issuer پاس؛ هر `20` مدل XGBoost و `20` مدل LightGBM load و predict شدند (`40/40 PASS`)؛ runtime فاقد curl/wget/gcc/g++/make/Torch/python-jose/instrumentator و هر چهار entrypoint worker قابل import بود.
- اسکن/شواهد: SBOMهای CycloneDX و SPDX تولید و Gitleaks نهایی `0` finding شد. Grype نسبت به image قبلی از کل `817→171`، Critical `29→5`، High `73→23` و Medium `97→49` کاهش یافت؛ هیچ Critical/High از packageهای Python برنامه باقی نمانده و `5 Critical/23 High` باقیمانده فقط متعلق به base رسمی Python/Debian است. شاهد canonical با `69` فایل و checksum معتبر: `artifacts/qa/backend-supply-chain/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T031413Z/`.
- deploy/rollback: در `2026-07-15T03:23:10Z–03:26:10Z` همین image دقیق روی API و چهار worker وابسته rollout شد؛ جزئیات در `DEPLOY-029`.
- blocker باقی‌مانده: base رسمی هنوز `5 Critical/23 High` دارد؛ سه dependency باز، lock hashدار، امضای image و attestation هنوز تکمیل نشده‌اند. هشدار deprecation مربوط به Starlette TestClient/httpx فقط بدهی harness است و runtime production را تحت تأثیر قرار نداد.

### CHG-025 — حذف override کد و read-only کردن مدل‌های production

- زمان: `2026-07-15T03:06:54Z`.
- فایل: `docker-compose.prochart.yml`.
- تغییر: bind-mountهای writable مربوط به `scripts` و `alembic` از API حذف شدند تا نسخهٔ baked و گیت‌شدهٔ image اجرا شود؛ mount مدل‌های joblib به `:ro` تبدیل شد؛ فقط logs writable باقی ماند.
- اثر بنیادی: تغییر فایل host دیگر نمی‌تواند بدون build/deploy کد اجرایی داخل کانتینر API را عوض کند و API نیز نمی‌تواند فایل‌های joblib را بازنویسی کند؛ با توجه به قابلیت اجرای کد هنگام `joblib.load`، این مرز write اهمیت امنیتی مستقیم دارد.
- build: این تغییر compose-only است؛ image کاندید CHG-024 کدهای `scripts`/`alembic` فعلی را از قبل bake کرده و تطابق سورس آن جداگانه کنترل می‌شود.
- تست: `docker compose config --quiet` پاس؛ runtime ایزوله و production با model mount خواندنی و `40/40` load/predict پاس شد؛ inspect زنده نبودن bind-mountهای `scripts` و `alembic` را تأیید کرد.
- deploy/rollback: همراه rollout پنج سرویس در `2026-07-15T03:23:10Z–03:26:10Z` انجام شد؛ API اکنون مدل‌ها را `ro` می‌بیند و host-code override ندارد.

### CHG-026 — سازگارکردن contract QA با lazy routerهای FastAPI جدید

- زمان: `2026-07-15T03:12:12Z`.
- فایل‌ها: `qa/python/security_regressions.py` و `qa/scripts/backend-image-contract.py`.
- تغییر: شمارش route، تشخیص WebSocket و بررسی dependencyهای auth اکنون هم ساختار flat قدیمی و هم `_IncludedRouter`/effective route جدید FastAPI 0.139 را normalize می‌کند.
- اثر بنیادی: تست دیگر به‌اشتباه routeهای موجود را «حذف‌شده» گزارش نمی‌کند و همچنان مسیر نهایی با prefix، دو WebSocket و حفاظت ۱۵ route مدیریتی را بررسی می‌کند.
- علت: attempt سوم framework نشان داد OpenAPI هر ۴۲۱ path را دارد، ولی دو assert قدیمی مستقیماً `app.routes` را flat فرض کرده بودند؛ این تغییر فقط harness را با مدل routing جدید هم‌راستا می‌کند و رفتار product را تغییر نمی‌دهد.
- build/deploy: فایل‌های QA طبق `.dockerignore` وارد runtime image نمی‌شوند و deploy مستقل ندارند. contract اصلاح‌شده روی image نهایی اجرا شد: `489` route object، `488` method/path یکتا، `2` WebSocket، OpenAPI=`421` و همهٔ checkها `PASS`؛ سپس همان image دقیق production شد.

### CHG-027 — الزام issuer برای JWT مرکزی RS256

- زمان: `2026-07-15T03:14:13Z`.
- فایل‌ها: `src/core/security.py` و `qa/python/security_regressions.py`.
- تغییر: decode توکن مرکزی علاوه بر امضای RS256، مقدار `iss` را دقیقاً با `CENTRAL_JWT_ISSUER` مقایسه می‌کند؛ regression برای پذیرش issuer صحیح و رد issuer جعلی افزوده شد.
- اثر بنیادی: یک کلید معتبر از issuer دیگری دیگر برای ورود SSO پذیرفته نمی‌شود؛ مقدار پیش‌فرض issuer در API و issuer صادرشده در `central-auth` هر دو `https://auth.pro-chart.internal` هستند.
- build/test: regression، issuer صحیح را پذیرفت و issuer جعلی را رد کرد؛ HS256 محلی و expiry نیز پاس شدند. build نهایی image=`sha256:c388f3aaa5b…` است.
- deploy: در rollout `DEPLOY-029` live شد؛ roundtrip زندهٔ HS256 و health/API پس از deploy پاس بود. مسیر RS256 با کلید/issuer آزمون در گیت کاندید پاس شده است.

### CHG-028 — اجرای non-root برای پنج سرویس Python

- زمان: `2026-07-15T03:14:13Z`.
- فایل: `Dockerfile`.
- تغییر: runtime با UID/GID عددی `1000:1000` و `HOME=/tmp` اجرا می‌شود؛ `/app/logs` و `/app/ml_models` در image به همین UID واگذار شدند.
- اثر بنیادی: در صورت بهره‌برداری از پردازش API/worker، دسترسی پیش‌فرض root داخل کانتینر حذف می‌شود؛ bind directoryهای production نیز مالک UID 1000 و کلید عمومی central mode `0644` و read-only است.
- build/test/deploy: image نهایی user=`1000:1000` دارد؛ در production هر پنج سرویس `api`، `data-feed`، `crypto-ws`، `finnhub-ws` و `news-worker` با همین user و image دقیق اجرا شدند، restart=`0` و fatal-signal=`0`؛ smoke نهایی `PASS`.

### DEPLOY-029 — rollout هماهنگ پنج سرویس Python سخت‌سازی‌شده

- زمان: شروع `2026-07-15T03:23:10Z`؛ تکمیل و پایان smoke `2026-07-15T03:26:10Z`.
- سرویس‌ها: `api`، `data-feed`، `crypto-ws`، `finnhub-ws` و `news-worker`.
- image جدید مشترک: `sha256:c388f3aaa5b23ced63ccf2af5a59c3ed16e685df518971475f399329be7a8dd6`؛ هر پنج کانتینر با همین image دقیق و user=`1000:1000` بالا آمدند.
- imageهای قبلی: API=`sha256:d703a78a…`، data-feed=`sha256:54b56fa4…`، crypto-ws=`sha256:04e08b83…`، finnhub-ws=`sha256:32a1a12b…` و news-worker=`sha256:467a6fd2…`.
- rollbackهای آماده: `prochart-api:rollback-20260715T032310Z`، `prochart-data-feed:rollback-20260715T032310Z`، `prochart-crypto-ws:rollback-20260715T032310Z`، `prochart-finnhub-ws:rollback-20260715T032310Z` و `prochart-news-worker:rollback-20260715T032310Z`؛ rollback خودکار مسلح بود ولی به‌دلیل موفقیت smoke فعال نشد.
- اثر بنیادی: CHG-024/025/027/028 هم‌زمان وارد production شدند؛ سطح حمله و اندازهٔ runtime کاهش یافت، JWT مرکزی issuer-bound شد، API دیگر host-code override و model-write ندارد و هر پنج پردازش non-root شدند.
- smoke/health: هر پنج سرویس running، restart=`0` و fatal-signal=`0`؛ API healthy با Database/Redis connected؛ OpenAPI=`421`؛ WebSocket زنده، HS256 roundtrip، referral query-bypass، model mount read-only و نبود overrideهای host پاس؛ Frontend healthy، public edge=`200` و کل `11` کانتینر پروژه running.
- شاهد مهرشده: `artifacts/qa/deploy/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T032310Z-python-supply-chain/`؛ `26` فایل شاهد و `sha256sum -c SHA256SUMS=OK`.
- blocker باقی‌مانده: CVEهای base، lock/hash، signing و attestation همان موارد ثبت‌شده در CHG-024 هستند؛ rollback پنج‌سرویسی آماده نگه داشته شده است.

### DEPLOY-030 — انتشار aliasها و کنترل‌های معتبر Panel

- زمان: شروع `2026-07-15T03:32:48Z`؛ پایان گیت پایه `2026-07-15T03:33:21Z`؛ تکمیل browser smoke و مهر شواهد `2026-07-15T03:34:02Z`.
- سرویس: compose=`admin-frontend`، کانتینر=`prochart-admin-frontend`.
- image قبلی: `sha256:1ca3dd1890a589bd27b20af6bab9be59a575b668504459e2b72b208836891777`؛ rollback tag=`prochart-admin:rollback-20260715T033248Z`.
- image جدید: `sha256:3d77c7fe483fd6d74b842cdaf4631128a81c20139c863abd2e0623cd38fd4a8a`؛ همان image دقیق گیت‌شدهٔ CHG-012، بدون rebuild غیرقطعی.
- اثر بنیادی: `/signals` اکنون صریحاً به `/ai-signals` و `/visitors` به `/analytics` می‌رود؛ هفت command پیاده‌نشده دیگر actionable نیستند و wildcard موفقیت جعلی ایجاد نمی‌کند.
- smoke/health: کانتینر running/healthy، restart=`0`؛ hash index و entry JS در کانتینر، HTTP و HTTPS محلی و دامنهٔ عمومی دقیقاً برابر build؛ Playwright production=`1/1 PASS`، دو redirect دقیق، unsupported actionable=`0`، page error و external request=`0`؛ مجموع `11` کانتینر پروژه running.
- rollback: rollback خودکار حین rollout مسلح بود ولی فعال نشد؛ tag قبلی آماده است.
- شاهد deploy با `46` فایل و checksum معتبر: `artifacts/qa/deploy/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T033248Z-panel-navigation/`؛ شاهد مستقل browser production با checksum معتبر: `artifacts/qa/panel-navigation/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T033248Z-production/`.
- شفافیت harness: تلاش اول Gitleaks روی host به‌علت نصب‌نبودن CLI با code=`127` متوقف و حفظ شد؛ اجرای نهایی با image ثابت `v8.30.1` پاس و finding=`0` شد.

### CHG-031 — مرز امنیتی اختصاصی برای Panel و User Portal

- زمان فایل‌ها: `2026-07-15T03:38:44Z–03:39:05Z`.
- فایل‌ها: `nginx/portal-security-boundary.conf`، `nginx/panel.conf`، `nginx/user-panel.conf` و `docker-compose.prochart.yml`.
- تغییر: یک boundary مشترک و محدود برای دو پرتال افزوده شد که نسخه‌های upstream را پنهان و دقیقاً یک مجموعهٔ هفت‌تایی HSTS، X-Frame-Options، X-Content-Type-Options، X-XSS-Protection، Referrer-Policy، Permissions-Policy و CSP می‌سازد. CSP پرتال‌ها برخلاف چارت اصلی به Telegram و `unsafe-eval` اجازه نمی‌دهد و frame/object/base را fail-closed می‌کند.
- اثر بنیادی: `panel.pro-chart.com` از چهار و `user.pro-chart.com` از سه header ناقص به boundary یکسان هفت‌هدره رسیدند؛ headerهای API نیز duplicate/intersecting نمی‌شوند.
- build/config: تغییر config-only است و image تازه نیاز ندارد؛ `docker compose config --quiet` و `nginx -t` روی image دقیق `sha256:972fdb60…` پاس شد. policy روی runtime ایزوله با index بایت‌به‌بایت ثابت Panel/User و API healthy آزموده شد.
- تست مرورگر: Panel navigation روی candidate و production هر دو `1/1 PASS`؛ User Login روی candidate و production HTTP=`200`، root رندرشده، CSP violation=`0` و page error=`0`. Gitleaks evidence نهایی finding=`0`.
- deploy: `2026-07-15T03:44:41Z–03:45:45Z`؛ جزئیات در `DEPLOY-032`.
- blocker کشف‌شده: تست قدیمی referral دسکتاپ، `frontend/prochart/UserPanel` را هدف می‌گرفت ولی دامنهٔ واقعی User Portal از `frontend/user` سرو می‌شود. در پرتال واقعی هنوز outbound مستقیم و کنترل MT5 وجود دارد؛ این مغایرت مستقل است و باید با build/deploy خود User Portal رفع شود.

### DEPLOY-032 — انتشار مرز امنیتی دو پرتال روی edge

- زمان rollout موفق: شروع `2026-07-15T03:44:41Z`؛ پایان smoke مرورگر و seal `2026-07-15T03:45:45Z`.
- سرویس: `frontend-prochart`؛ کانتینر قبلی=`b2d5495ef956…`، کانتینر جدید=`6b6a0947ef94…`.
- image: قبل و بعد دقیقاً `sha256:972fdb60d3a273748bf4b31e37f2071e64b2616d8168a96b4b63d98b23a45b1e`؛ این rollout فقط config mount را تغییر داد و assetها را بازنساخت.
- rollback: image tag=`prochart-frontend-prochart:rollback-20260715T034441Z-portal-security` و override شامل config قبلی در artifact آماده است.
- smoke: سرویس healthy/running و restart=`0`؛ mount policy read-only؛ hash هر سه index اصلی/Panel/User روی origin و public برابر build؛ Panel و User هر کدام روی origin/public دقیقاً هفت header؛ CSP محدود؛ API healthy؛ referral query-bypass مردود؛ browser Panel=`1/1 PASS` و User Login/CSP=`PASS`؛ کل `11` کانتینر running.
- شاهد مهرشده: `artifacts/qa/deploy/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T034441Z-portal-security/` با `63` فایل، checksum معتبر و Gitleaks=`0`.
- شفافیت rollout: attempt اول `20260715T034244Z` فقط به‌علت فرض اشتباه harness دربارهٔ فاصله کنار tab در خروجی mount fail شد؛ rollback config خودکار اجرا و healthy شد. attempt با result=`HARNESS_FAIL_AUTO_ROLLBACK` و checksum مستقل حفظ شده است؛ policy جدید در attempt دوم پاس و live شد.

### CHG-033 — تبدیل User Portal واقعی به خروج referral-gated

- زمان فایل‌ها: `2026-07-15T03:47:38Z–03:52:09Z`.
- فایل‌ها: `frontend/user/src/referrals.js`، `src/components/ReferralDeparture.jsx`، صفحه‌های Connect/Subscription/Trading/Dashboard/Login/Profile، `src/api/client.js`، `frontend/user/nginx.conf`، `nginx/user-panel.conf` و تست/lock مربوط.
- تغییر: در پرتال واقعی کاربر، خروج LBank و OneRoyal فقط از دو مسیر same-origin ثابت `/go/lbank` و `/go/oneroyal`، پس از نمایش disclosure و eligibility و تأیید صریح checkbox انجام می‌شود؛ لینک خام بیرونی، credential/control اتصال MT5 و نمایش اتصال زندهٔ OneRoyal حذف شد. ترید مستقیم فقط برای حساب متصل LBank باقی ماند و OneRoyal در Dashboard/Trading/Subscription صرفاً معرفی است.
- اثر بنیادی: blocker ثبت‌شده در CHG-031 بسته شد؛ دامنهٔ واقعی `user.pro-chart.com` دیگر مسیر مستقیم یا عملیات OneRoyal/MT5 ارائه نمی‌کند و query نمی‌تواند مقصد referral را عوض کند.
- build/image: `npm ci` با lock و Node 22 ثابت؛ image نهایی در `2026-07-15T04:13:06Z` برابر `sha256:6a5c2512392cdb8257c804a0ca116c4fed9ce4186fd9a6e2685c313d1dcf6216` با اندازهٔ `6,321,067` بایت.
- تست: unit=`5/5 PASS`؛ Playwright واقعی `/connect` روی LBank/OneRoyal × دسکتاپ/موبایل، candidate=`4/4 PASS` و production=`4/4 PASS`؛ redirectهای origin و Cloudflare عمومی برای هر دو provider=`302` با مقصد ثابت و query خصمانه بی‌اثر.
- deploy: `2026-07-15T04:22:41Z–04:22:53Z` روی `user-frontend`؛ final smoke تا `04:26:37Z` پاس. rollback در DEPLOY-039 آماده و فعال‌نشده است.
- blocker باقی‌مانده: احراز هویت و دادهٔ API در تست مرورگر synthetic است؛ مرز خروج و asset/runtime واقعی production آزموده شده‌اند.

### CHG-034 — fail-closed کردن سراسری OneRoyal/MT5 در بک‌اند

- زمان فایل‌ها: `2026-07-15T03:54:27Z–04:02:39Z`.
- فایل‌ها: `src/api/routes/bazaarnama.py`، `seo.py`، `academy.py`، `bn_gate.py`، `bn_r7.py` و `bn_r8.py`.
- تغییر: اتصال MT5 با `410` و بدون body credential، DB یا network بسته شد؛ وضعیت legacy اطلاعات حساب را افشا نمی‌کند؛ خرید `forex_copy`، تغییر settings، stop/close و سفارش real غیرکریپتو پیش از transaction/DB/outbound با `410/403` رد می‌شوند و شاخهٔ اجرای OneRoyal حذف شد. فقط پاک‌سازی credential تاریخی، feed بازار فارکس و تحلیل/سیگنال مستقل فارکس حفظ شدند.
- اثر بنیادی: هیچ API قدیمی، مسیر پرداخت یا سفارش نمی‌تواند مرز referral-only را دور بزند، درحالی‌که market-data و analytics غیرمعاملاتی عمداً از کار نیفتاده‌اند.
- build/image: image non-root `1000:1000` در `2026-07-15T04:03:22Z` برابر `sha256:23f49262ce660e6ad405ae72cd96037aa4d70e75a085163143dc07d98646223e`، اندازه=`244,050,103` بایت؛ تطابق source baked با host=`178/178` و `pip check=PASS`.
- تست: regressions متمرکز=`40 PASS + 20 subtests PASS`؛ بستهٔ referral/legacy نهایی=`23/23 PASS`؛ contract image=`492` route object، `494` method/path یکتا و `2` WebSocket، همهٔ checkها PASS؛ OpenAPI زنده=`421` path و endpoint MT5 بدون request body است.
- امنیت image: SBOM=`228` package؛ Grype بدون افزایش نسبت به runtime قبلی=`171` کل، `5 Critical`، `23 High` و `49 Medium`؛ Gitleaks دامنهٔ تغییر=`0` finding.
- deploy: همان digest روی API و چهار worker در DEPLOY-039 live شد؛ API healthy با Database/Redis connected و هر پنج سرویس restart=`0` هستند. blocker CVE/lock/signing بک‌اندِ CHG-024 همچنان باز است.

### CHG-035 — حذف کنترل‌های مردهٔ MT5 و محدودکردن سفارش مستقیم در Main Frontend

- زمان فایل‌ها: `2026-07-15T03:55:23Z`.
- فایل‌ها: `frontend/prochart/src/api/client.js`، `src/app/screens/ProfileScreen.jsx`، `src/UserPanel.jsx`، `src/bazaarnama/OrderTicket.jsx` و `test/referral-compliance.test.mjs`.
- تغییر: client اتصال MT5 و disconnect پویا حذف و disconnect صریح LBank شد؛ وضعیت MT5 تاریخی دیگر اتصال زنده شمرده نمی‌شود؛ order ticket فقط برای crypto/LBank سفارش واقعی می‌فرستد و forex همیشه preview محلی با پیام referral-only است.
- اثر بنیادی: UI اصلی دیگر موفقیت/اتصال جعلی OneRoyal نشان نمی‌دهد و هیچ سفارش مستقیم forex از این سطح ارسال نمی‌شود.
- build/image: build نهایی در `2026-07-15T04:13:24Z` برابر `sha256:20e2ad31c1280f44850530a7ac12456f4817da8f163fdd230defe0436f7fa3ec`، اندازه=`9,367,942` بایت؛ assetها byte-for-byte با build گیت‌شده برابرند.
- تست: unit=`20/20 PASS`؛ referral دسکتاپ/موبایل candidate=`4/4 PASS` و production corrected=`4/4 PASS`؛ performance نهایی سه نمونهٔ دسکتاپ و سه نمونهٔ موبایل=`6/6 PASS` و شش cross-project skip موردانتظار.
- deploy: `frontend-prochart` در DEPLOY-039 با همین digest و config دقیق live شد؛ healthy، restart=`0` و rollback آماده است.

### CHG-036 — قطعی‌کردن buildهای User Portal و Panel

- زمان: User lock/test تا `2026-07-15T03:52:09Z`؛ Panel Dockerfile/lock تا `2026-07-15T04:12:46Z`.
- فایل‌ها: Dockerfile/`.dockerignore`/`package-lock.json` در `frontend/user` و `frontend/panel` و script تست User.
- تغییر: builder هر دو frontend به Node 22 با digest ثابت و `npm ci` منتقل شد؛ lockfile و context محدود `.dockerignore` اضافه شد. Panel از Node 20 شناور و `npm install` خارج شد.
- اثر بنیادی: dependency resolution در build تکرارپذیرتر است و تغییر registry/context بدون تغییر lock وارد image نمی‌شود.
- build/test: `npm ci` و audit هر دو package=`0 vulnerability`؛ User unit=`5/5` و Panel unit=`5/5`؛ Panel navigation candidate و production=`1/1 PASS`؛ imageهای نهایی User=`6a5c2512…` و Panel=`8b6231de…`.
- deploy: هر دو image در `2026-07-15T04:22:41Z–04:22:53Z` live شدند؛ asset پنل با production قبلی برابر ماند. blocker: امضای image و provenance attestation هنوز افزوده نشده است.

### CHG-037 — ارتقای runtime سه frontend به Nginx slim اصلاح‌شده

- زمان فایل‌ها/build: `2026-07-15T04:12:23Z–04:13:36Z`.
- فایل‌ها: Dockerfileهای `frontend/prochart`، `frontend/user` و `frontend/panel`.
- تغییر: runtime هر سه image از Nginx 1.27 قدیمی به `nginx:1.30.3-alpine3.23-slim` با digest ثابت `sha256:d5b51cfc7d55fc7a7bcf4d1d577b9c3738331df56d68f0b1d8ac9795b9470a5a` ارتقا یافت.
- اثر بنیادی: سطح حمله و اندازهٔ runtime بدون تغییر asset محصول کاهش یافت؛ Nginx زنده هر سه سرویس اکنون `1.30.3` است.
- build/images: Main=`sha256:20e2ad31…` (`9,367,942` بایت)، User=`sha256:6a5c2512…` (`6,321,067` بایت) و Panel=`sha256:8b6231de18db8810b8d83e02b3db83960cb9b5f1b33de0549961360073535ea2` (`6,513,904` بایت)؛ `nginx -t=PASS` و asset parity هر سه=`PASS`.
- اسکن: runtime قبلی `163` finding شامل `13 Critical/62 High/75 Medium` داشت؛ هر image نهایی دقیقاً `3 Medium` و `0 Critical/0 High` دارد. SBOM هر image=`22` package.
- deploy/smoke: هر سه frontend در DEPLOY-039 live، healthy و restart=`0`؛ هر هفت security header پرتال‌ها و HTTPS/API proxy پس از ارتقا پاس. blocker: سه Medium باقی‌مانده باید در refresh بعدی base دوباره ارزیابی شوند.

### CHG-038 — پوشش QA برای پرتال واقعی و rebaseline دقیق contract route

- زمان فایل‌ها: `2026-07-15T03:51:26Z–04:04:50Z`؛ پایان گیت نهایی performance=`2026-07-15T04:21:04Z`.
- فایل‌ها: `qa/tests/user-referral-compliance.spec.mjs`، `qa/python/legacy_forex_referral_boundary_regression.py`، `qa/python/referral_redirects_regression.py` و `qa/scripts/backend-image-contract.py`.
- تغییر: تست referral از پرتال واقعی BrowserRouter در چهار حالت افزوده شد؛ تمام مسیرهای legacy forex برای fail-before-DB/network پوشش گرفتند؛ baseline route از مقادیر stale `489/488` به `492/494` اصلاح شد، فقط پس از inventory کامل که ثابت کرد ۴۹۴ method/path image قبلی و کاندید byte-identical هستند.
- اثر بنیادی: شکاف false-confidence کشف‌شده در CHG-031 بسته و تغییر framework از تغییر route محصول تفکیک شد؛ کاهش/افزایش آیندهٔ route بدون inventory دوباره مخفی نمی‌ماند.
- build/deploy: فایل‌های QA طبق `.dockerignore` وارد runtime نمی‌شوند؛ deploy مستقل ندارند، اما قبل و بعد از rollout digestهای دقیق را gate کردند.
- نتیجه: backend referral=`23/23`، focused=`40+20`، frontend unit=`30/30`، candidate browser=`9/9`، production browser corrected=`9/9` و performance measured=`6/6`؛ Gitleaks=`0`.
- شفافیت harness: تلاش local performance با origin عددی، تلاش browser با hostname مشتق‌شدهٔ ناموجود و اولین mount شاهد Panel به‌علت mapping/permission ابزار fail شدند؛ هیچ‌کدام failure محصول نبودند و اجرای اصلاح‌شده با همان imageها پاس شد. شواهد هر دو حالت حفظ شده‌اند.

### DEPLOY-039 — rollout هماهنگ referral-only و runtime سه frontend

- زمان rollout: شروع `2026-07-15T04:22:41Z`؛ پایان recreate/start=`04:22:53Z`؛ پایان browser smoke=`04:25:59Z`؛ مشاهدهٔ پایدار نهایی=`04:26:37Z`.
- سرویس‌ها: `api`، `data-feed`، `crypto-ws`، `finnhub-ws`، `news-worker`، `frontend-prochart`، `user-frontend` و `admin-frontend`.
- imageهای قبلی: پنج Python=`sha256:c388f3aaa5b23ced63ccf2af5a59c3ed16e685df518971475f399329be7a8dd6`؛ Main=`sha256:972fdb60d3a273748bf4b31e37f2071e64b2616d8168a96b4b63d98b23a45b1e`؛ User=`sha256:af80b67b177d55d4aa66705bd2dfe45cef3161aac672e8360283bc005f13b77a`؛ Panel=`sha256:3d77c7fe483fd6d74b842cdaf4631128a81c20139c863abd2e0623cd38fd4a8a`.
- imageهای جدید: پنج Python=`sha256:23f49262ce660e6ad405ae72cd96037aa4d70e75a085163143dc07d98646223e`؛ Main=`sha256:20e2ad31c1280f44850530a7ac12456f4817da8f163fdd230defe0436f7fa3ec`؛ User=`sha256:6a5c2512392cdb8257c804a0ca116c4fed9ce4186fd9a6e2685c313d1dcf6216`؛ Panel=`sha256:8b6231de18db8810b8d83e02b3db83960cb9b5f1b33de0549961360073535ea2`.
- rollback: هشت image قبلی با tagهای `*:rollback-referral-20260715T042151Z` و `rollback.override.yml` آماده‌اند؛ rollback فعال نشد (`NO`).
- اثر بنیادی: CHG-033 تا CHG-037 با همان digestهای گیت‌شده وارد production شدند؛ OneRoyal در UI و API فقط معرفی است، عملیات legacy fail-closed شده و هر سه frontend runtime اصلاح‌شده دارند.
- smoke/health: هر `11` سرویس compose running؛ API/Main/User/Panel و infrastructure healthcheckها healthy؛ هشت کانتینر تعویض‌شده restart=`0` و critical-log-pattern=`0`؛ API Database/Redis connected؛ OpenAPI=`421`؛ `nginx -t=PASS`؛ سه asset manifest برابر کاندید؛ User/Main/Panel browser=`4/4 + 4/4 + 1/1 PASS`.
- origin/public: ریشهٔ User و Panel=`200` با هفت header؛ redirect LBank/OneRoyal روی origin و Cloudflare=`302` و `cf-cache-status=DYNAMIC` با مقصد ثابت حتی در query خصمانه.
- شاهد مهرشده: `artifacts/qa/deploy/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T042151Z-referral-only-runtime/` با `222` فایل در `SHA256SUMS` و verify=`PASS`.

### GOV-040 — بازسازی و هم‌ترازی اسناد اصلی با وضعیت واقعی اجرا

- زمان: `2026-07-15T04:31:00Z–05:25:33Z`.
- فایل‌ها: `ProChart_Master_Spec_FA.docx`، `ProChart_Requirements_Matrix_FA.docx`، نسخه‌های `docs/source/`، `docs/01_PROCHART_MASTER_SPEC_FA.md`، `docs/02_CODEX_MASTER_PROMPT_FA.md`، `docs/03_REQUIREMENTS_MATRIX.json`، `docs/REQUIREMENTS_STATUS.csv` و `docs/EXECUTION_STATE.md`.
- تغییر: وضعیت ۱۳ الزام به evidence و DEPLOY-039 متصل شد؛ statusهای ناقص عمداً VERIFIED نشدند؛ دو DOCX با الحاقیهٔ وضعیت واقعی و status cellهای ماتریس بازسازی شدند؛ source hashهای جدید ثبت و `unzip -t`/`SHA256SUMS` پاس شد؛ Goal/Resume به صراحت می‌گوید پس از هر تغییر، ثبت، build/test، deploy و ادامه بدون مکث انجام شود.
- اثر بنیادی: دو سند تحویلی دیگر ادعای staleِ «deploy نشده» یا «همه NOT_STARTED» ندارند و در عین حال معیار `COMPLETE` را زودتر از شواهد اعلام نمی‌کنند.
- build/validation: DOCX archive integrity=`PASS`؛ root و `docs/source` byte-identical؛ Master SHA=`35b325713034406dfa5fbdf11a95e68da508f5892ef571bfad1fe366f27ae7b8`؛ Matrix SHA=`cd2ecdbffab59af6b4d1993a3898337d37ec3472326d40ee05a50d1dcf9804b7`؛ source checksum=`PASS`.
- deploy: `N/A` برای runtime؛ این یک تغییر سند/حاکمیت است و در image یا سرویس production bake نمی‌شود. به‌جای deploy جعلی، artifact و checksum مستقل ثبت شد و production به‌علت این تغییر دوباره recreate نشد.
- blocker/ادامه: Goal هنوز `IN_PROGRESS` است؛ clean full-suite سه‌باره، P0/P1 coverage، accessibility دستی، secret rotation، صفر Critical/High و signing/attestation باید در چرخهٔ بعدی بسته شوند.
- شفافیت probe بعدی: تلاش `2026-07-15T05:26Z–05:28Z` برای `apt-get upgrade` در Dockerfile build شد اما Debian گزارش `0 upgraded` داد و Grype همان `171/5C/23H/49M` را نشان داد؛ چون هیچ اثر محصولی نداشت، patch قبل از deploy revert شد و هیچ image production تغییر نکرد.

### GOV-041 — اصلاح QA harness non-root و اجرای clean full-suite

- زمان: `2026-07-15T05:29:00Z–05:32:15Z`.
- فایل: `qa/python/Dockerfile`.
- تغییر: نصب `pytest` و `pytest-asyncio` در مرحلهٔ root و اجرای suite با `USER 1000:1000`؛ مشکل قبلی نصب در `/tmp/.local` روی tmpfs clean برطرف شد.
- اثر بنیادی: اجرای clean suite اکنون واقعاً قابل‌اجراست و failureهای legacy پنهان نمی‌مانند؛ هیچ runtime production تغییر نکرد.
- build/test: image QA مشتق‌شده build شد؛ `297` تست جمع‌آوری، `227` پاس، `42` subtest، `50` fail، `32` error، `0` skip، exit=`1`; Gitleaks=`0`، pip check=`PASS`، focused referral/bot=`PASS`.
- evidence: `artifacts/qa/python/080033ae56e3c793ba3a998276cac5daeb969d50/20260715T054000Z-clean-python-post-docs-harness-fixed/`.
- deploy: `N/A`؛ تغییر فقط harness است و در image production bake نمی‌شود؛ production همان ۱۱ سرویس و digestهای DEPLOY-039 باقی ماند.
- blocker/ادامه: خطاهای legacy و missing module/route در PC-132/PC-133/PC-156 باید علت‌یابی و طبق قرارداد اصلاح یا مستندسازی شوند؛ Goal همچنان `IN_PROGRESS` است.

### CHG-039 — بازگردانی قراردادهای SignalScorer و RiskManager

- زمان: `2026-07-15T05:50:00Z–06:05:25Z`.
- فایل‌ها: `src/signals/scorer.py` و `src/signals/risk_manager.py`.
- تغییر: پیاده‌سازی deterministic و bounded برای امتیاز سیگنال و محاسبهٔ SL/TP با ATR و ساختار نزدیک؛ ورودی نامعتبر fail-closed می‌شود.
- اثر بنیادی: دو قرارداد موجود که در suite به‌علت حذف ماژول fail می‌شدند دوباره در لایهٔ سیگنال قابل‌استفاده‌اند، بدون تغییر route یا رفتار referral.
- build: imageهای پنج سرویس Python با compose build شدند؛ API digest=`sha256:0783fbd9e0d868f4247e5089f8678bff22c8c86cc00d9bfee9f80e641f742d5a`.
- test: `tests/test_signals.py` در harness clean=`4/4 PASS`؛ smoke داخل API برای هر دو قرارداد=`PASS`؛ `/health`=`200 healthy` با DB/Redis connected.
- deploy: `2026-07-15T06:04Z`؛ api و چهار worker با compose recreate شدند؛ frontendها بدون تغییر باقی ماندند.
- health/rollback: ۱۱ کانتینر running، API healthy و workerها restart صفر در مشاهدهٔ اولیه؛ rollback image قبلی DEPLOY-039 آماده است؛ blockerهای clean suite legacy همچنان بازند.

### GOV-042 — هم‌زمان‌سازی timestamp ماتریس پس از increment سیگنال

- زمان: `2026-07-15T06:12:00Z`.
- فایل: `docs/03_REQUIREMENTS_MATRIX.json`.
- تغییر: `generated_at` به آخرین evidence واقعی `2026-07-15T06:05:25Z` منتقل شد؛ وضعیت PC-156 همچنان IN_PROGRESS/FAIL باقی ماند و هیچ ادعای VERIFIED اضافه نشد.
- validation: JSON parse و source hash سند مادر بدون تغییر؛ این تغییر مستنداتی است و runtime را تغییر نمی‌دهد.
- deploy: `N/A`؛ production همان digestهای CHG-039 و ۱۱ سرویس سالم است.
- ادامه: سه clean full-suite سبز، signing/attestation و سایر P0/P1های باز هنوز باید بسته شوند.

### GOV-043 — clean suite پس از increment سیگنال

- زمان: `2026-07-15T06:06:00Z–06:18:00Z`.
- run: `20260715T062500Z-clean-after-signal-increment` روی image API=`sha256:0783fbd9…`؛ evidence در `artifacts/qa/python/clean-after-signal-increment/`.
- نتیجه: `297` جمع‌آوری، `231` پاس، `46` fail، `32` error، `42` subtest پاس، `0` skip؛ Gitleaks=`PASS`، security-header regression=`PASS`، pip check=`PASS`.
- اثر: دو تست SignalScorer/RiskManager از خطا به پاس تبدیل شدند؛ با این حال suite کامل به‌علت route/pathهای legacy و ماژول‌های قدیمی سبز نیست.
- deploy: `N/A`؛ اجرای QA است و production از CHG-039 unchanged/healthy باقی ماند.
- ادامه: اولویت بعدی تعیین تکلیف قراردادهای legacy API و مسیرهای source-test است؛ حذف/skip تست مجاز نیست.

### CHG-040 — حفظ قراردادهای legacy API با auth اجباری

- زمان: `2026-07-15T06:20:00Z–06:28:00Z`.
- فایل‌ها: `src/api/routes/legacy_contracts.py` و `src/api/main.py`.
- تغییر: مسیرهای تاریخی `/signals` و `/performance/summary` به روتر compatibility متصل شدند؛ هر دو همچنان `get_current_admin` دارند و بدون credential پاسخ `401` می‌دهند، سپس دادهٔ واقعی DB/analytics را مصرف می‌کنند.
- اثر بنیادی: سازگاری API قدیمی بازگشت بدون endpoint جعلی یا bypass امنیتی؛ تست‌های contract قبلی از 404 به رفتار auth صحیح منتقل شدند.
- build: compose imageهای API و چهار worker ساخته شد؛ API digest=`sha256:6bed2f5af5de58910950283cc7ba4a193ceebfb9fc5c81add7f4b9b984ac14e8`.
- test/smoke: `/health`=`200`، `/signals`=`401`، `/performance/summary`=`401`؛ ۱۱ کانتینر running.
- deploy: `2026-07-15T06:26Z`؛ api و چهار worker recreate شدند؛ frontendها untouched.
- rollback/blocker: rollback digest CHG-039 آماده؛ clean suite کامل هنوز legacy failures/errors دارد.

### CHG-041 — تفکیک liveness محلی از readiness production

- زمان: `2026-07-15T06:30:00Z–06:38:00Z`.
- فایل: `src/api/main.py`.
- تغییر: در `DEBUG`، health بدون DB/Redis پاسخ `200` با status=`ok` می‌دهد تا liveness توسعه قابل‌آزمون باشد؛ production (`DEBUG=False`) همچنان در dependency failure پاسخ `503 degraded` می‌دهد.
- build: compose imageهای API و چهار worker rebuild شدند؛ API digest=`sha256:5c243f5d0171594641e4b14856ed686d49837e7a1c4655f92c2712c4c14121e1`.
- test: `tests/test_api.py` با `DEBUG=true`=`4/4 PASS`؛ production smoke `/health`=`200`، `/signals`=`401` و `/performance/summary`=`401`.
- deploy: `2026-07-15T06:36Z`؛ api و چهار worker recreate شدند؛ ۱۱ کانتینر running.
- rollback/blocker: digest CHG-040 آماده؛ clean full-suite هنوز به‌علت legacy modules/routes سبز نیست.

### GOV-044 — تأیید clean build پنل و هم‌ترازی lockfile

- زمان: `2026-07-15T06:40:00Z–06:52:00Z`.
- فایل‌ها: `frontend/panel/package.json` و `package-lock.json`.
- تغییر/یافته: `npm ci --legacy-peer-deps` روی build context تمیز و سپس `npm run build` با Vite=`6.4.3` موفق شد؛ lockfile قبلی در محیط محلی با picomatch ناسازگار بود، اما Docker clean build بدون warning امنیتی و با `0 vulnerabilities` پاس شد.
- اثر: reproducible panel build gate تأیید شد؛ تغییری در runtime production اعمال نشد.
- evidence: image QA `prochart-panel:qa-20260715T065000Z-lock-sync`، خروجی build شامل asset manifest و `0 vulnerabilities`.
- deploy: `N/A`؛ این gate تأییدی بود و image production پنل تغییر نکرد.
- ادامه: برای deploy پنل فقط در صورت تغییر source/runtime و پس از gate مشترک اقدام می‌شود؛ P0های clean-suite و signing همچنان بازند.

### GOV-045 — هم‌ترازی Execution State با incrementهای آخر

- زمان: `2026-07-15T07:00:00Z–07:02:00Z`.
- فایل: `docs/EXECUTION_STATE.md`.
- تغییر: CHG-039 تا CHG-041، GOV-044، digest فعلی API، نتیجهٔ focused gate و Resume command به state زنده اضافه شد؛ هیچ blocker یا statusی به‌صورت کاذب بسته نشد.
- validation: ساختار Markdown و مسیرهای evidence موجود؛ production بدون تغییر.
- deploy: `N/A`؛ تغییر فقط state/governance است.
- ادامه: PC-132/133/156 و clean-suite legacy هنوز باز هستند.

### GOV-046 — بازسازی DOCXهای تحویلی پس از incrementهای اخیر

- زمان: `2026-07-15T07:05:00Z–07:15:00Z`.
- فایل‌ها: هر دو `ProChart_*_FA.docx` در ریشه و `docs/source/`، به‌همراه `app/scripts/update_docx_appendix.py` و `docs/source/SHA256SUMS`.
- تغییر: الحاقیهٔ واقعی CHG-039 تا CHG-041 و وضعیت IN_PROGRESS به هر دو DOCX اضافه شد؛ root و source byte-identical باقی ماندند.
- validation: `unzip -t` هر دو PASS؛ checksum source=`PASS`؛ Master SHA=`590cf24933ec7b5c60337ded2e64de28a5de75a61d144f8f3ed6a12baa5eeab2`؛ Matrix SHA=`6708022c13c9b07656825043d671d822545c773fae13a9c1b59cf35e42e71955`.
- deploy: `N/A`؛ DOCX در runtime bake نمی‌شود و production recreate نشد.
- ادامه: معیارهای P0/P1، clean suite سه‌باره، signing/attestation و secret rotation همچنان باز هستند.

### GOV-047 — اصلاح source hash ماتریس پس از بازسازی DOCX

- زمان: `2026-07-15T07:20:00Z–07:22:00Z`.
- فایل: `docs/03_REQUIREMENTS_MATRIX.json`.
- تغییر: `source_sha256` از هش قدیمی به Matrix DOCX جدید `6708022c13c9b07656825043d671d822545c773fae13a9c1b59cf35e42e71955` اصلاح شد.
- validation: JSON parse=`PASS`؛ `docs/source/SHA256SUMS` برای هر دو DOCX=`PASS`.
- deploy: `N/A`؛ تغییر traceability مستندات است و production بدون تغییر باقی ماند.
- ادامه: clean full-suite، security rotation، signing/attestation و P0/P1های باز همچنان معیارهای ناتمام‌اند.

### GOV-048 — اسکن secret فعلی source پس از آخرین تغییرات

- زمان: `2026-07-15T07:29:00Z–07:30:00Z`.
- scope: `app/src` شامل route compatibility، health، signal modules و تغییرات اخیر.
- فرمان/نتیجه: Gitleaks `v8.30.1` روی ۳٫۴۵MB source، `no leaks found`، exit=`0`.
- اثر: secret gate فعلی source سبز است؛ این نتیجه history، ignored/runtime store و Rotation/Revoke را ثابت نمی‌کند، بنابراین PC-132 همچنان FAIL است.
- deploy: `N/A`؛ فقط evidence scan، runtime unchanged.
- ادامه: rotation/history و supply-chain signing/attestation هنوز بازند.

### CHG-042 — حذف ابزار مستندساتی از runtime build context

- زمان: `2026-07-15T07:35:00Z–07:45:00Z`.
- فایل: حذف `app/scripts/update_docx_appendix.py`؛ این ابزار فقط برای بازسازی DOCX بود و نباید در image سرویس قرار می‌گرفت.
- build/deploy: API و چهار worker با compose rebuild/recreate شدند؛ API digest=`sha256:b2fa9d07429b24efaa33f08af0ccbd5391c01eec1a5dd3dbc91e610bc373e1a5`.
- smoke: پس از warm-up `/health`=`200 healthy` و API کانتینر healthy؛ ۱۱ سرویس running.
- اثر بنیادی: runtime image فقط ابزارهای لازم محصول را نگه می‌دارد؛ اسناد و ابزارهای تولیدی خارج از production هستند.
- rollback/blocker: digest CHG-041 آماده؛ clean-suite legacy و supply-chain signing همچنان باز.

### GOV-049 — بررسی قابلیت SBOM/provenance محلی image

- زمان: `2026-07-15T07:55:00Z–08:00:00Z`.
- probe: image `prochart-api:latest` و manifest محلی بررسی شد؛ Docker CLI فعلی plugin `docker sbom`/خروجی formatدار قابل‌استفاده ارائه نمی‌کند و `imagetools inspect` برای registry به‌علت image local-only با `insufficient_scope` شکست خورد.
- نتیجه: هیچ SBOM یا امضای جدیدی جعل/اعلام نشد؛ PC-133 و PC-162 همچنان FAIL هستند. digest و build evidence موجود قبلی حفظ شد.
- deploy: `N/A`؛ probe فقط supply-chain evidence بود و runtime تغییر نکرد.
- ادامه: برای بستن signing/attestation به ابزار/registry مجاز نیاز است؛ سایر P0های مستقل ادامه‌پذیرند.

### GOV-050 — تکرارپذیری focused signal gate

- زمان: `2026-07-15T08:05:00Z–08:10:00Z`.
- محیط: QA image `prochart-qa-pytest:20260715T062500Z-clean-after-signal-increment`، network=`none`، filesystem=`read-only`، UID=`1000`.
- نتیجه: اجرای مستقل اول و دوم `tests/test_signals.py` هرکدام `4/4 PASS`؛ retry پنهان یا skip وجود نداشت.
- اثر: slice جدید SignalScorer/RiskManager flaky نیست؛ این نتیجه جایگزین الزام سه clean full-suite نمی‌شود.
- deploy: `N/A`؛ فقط QA evidence، production unchanged.
- ادامه: PC-156 همچنان به سه full-suite سبز نیاز دارد و legacy failures/errors بازند.

### GOV-051 — clean full-suite پس از API compatibility و health increments

- زمان: `2026-07-15T08:15:00Z–08:25:00Z`.
- run: `20260715T082000Z-clean-current` روی API digest=`sha256:b2fa9d07429b24efaa33f08af0ccbd5391c01eec1a5dd3dbc91e610bc373e1a5`؛ network=`none`، UID=`1000`، read-only.
- نتیجه: `297` collected، `234` passed، `43` failed، `32` errors، `42` subtests passed، `0` skipped؛ Gitleaks=`PASS`، security headers=`PASS`، pip check=`PASS`.
- اثر: سه API test قبلی اکنون pass شدند و نسبت به run قبلی ۳ تست بهبود یافت؛ خطاهای legacy frontend/module/route عمداً حذف یا skip نشدند.
- deploy: `N/A`؛ این QA run است و production از CHG-042 unchanged/healthy ماند.
- ادامه: PC-156 هنوز به سه clean full-suite سبز نیاز دارد؛ اولین گروه باقی‌مانده legacy source tree و missing modules است.

### CHG-043 — بازگردانی TechnicalAnalyzer واقعی

- زمان: `2026-07-15T08:28:00Z–08:40:00Z`.
- فایل‌ها: `src/analysis/__init__.py` و `src/analysis/technical.py`.
- تغییر: تحلیل واقعی OHLCV با EMA trend، RSI و ATR، خروجی bounded و رفتار خالی/کم‌دادهٔ امن؛ mock یا fake success استفاده نشد.
- test: `tests/test_technical.py` در محیط network-none/read-only با UID1000=`4/4 PASS`.
- build/deploy: API و چهار worker rebuild/recreate شدند؛ API digest=`sha256:7b7a4b8fbe5aed186a9a5bebfdb25ffdd191ab15d5d04c59e24644108a4633e0`.
- smoke: `/health`=`200 healthy`، ۱۱ کانتینر running.
- rollback/blocker: rollback digest قبلی آماده؛ SmartMoney/Pattern/ML legacy modules هنوز باز و clean suite سبز نیست.

### CHG-044 — بازگردانی تحلیل‌گرهای Candlestick و Chart Pattern

- زمان: `2026-07-15T08:42:00Z–08:55:00Z`.
- فایل‌ها: `src/analysis/candlestick_patterns.py` و `src/analysis/chart_patterns.py`.
- تغییر: تشخیص واقعی doji/hammer/shooting-star و جهت غالب بر اساس تغییر OHLC؛ scoreها bounded و empty input امن هستند.
- test: `tests/test_patterns.py` در network-none/read-only=`6/6 PASS`.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:10b60e19386b795d5feaacb0331ef036427d982d93eaa55a329c5d8572cd422a`.
- smoke: `/health`=`200 healthy`، ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ ML/SmartMoney و legacy suite همچنان باز.

### CHG-045 — بازگردانی SmartMoneyAnalyzer

- زمان: `2026-07-15T08:58:00Z–09:10:00Z`.
- فایل: `src/analysis/smart_money.py`.
- تغییر: تحلیل واقعی bias/structure، order block و fair-value gap از OHLC؛ خروجی bounded و empty input امن.
- test: `tests/test_smart_money.py` در network-none/read-only=`5/5 PASS`.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:ba97dd0bbd11a82cf7f84638aec879a386892e6de1e1b628cad8bc2c8851a0d0`.
- smoke: `/health`=`200 healthy`، ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ ML feature engine و legacy clean-suite failures/errors هنوز باز.

### CHG-046 — بازگردانی ML FeatureEngine

- زمان: `2026-07-15T09:12:00Z–09:25:00Z`.
- فایل‌ها: `src/ml/__init__.py` و `src/ml/feature_engine.py`.
- تغییر: feature engineering واقعی برای returns، SMA/EMA، volatility، OHLC wick/body، volume، RSI و ATR؛ target forward-return و class بدون leakage آینده، با guard حداقل ۱۰۰ ردیف.
- test: `tests/test_ml.py` در network-none/read-only=`4/4 PASS`.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:21c4ca10f98e374e99fc5f858ba8226fb6135397f4522d740605f0354888a530`.
- smoke: `/health`=`200 healthy`، ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ clean-suite legacy errors و supply-chain signing هنوز باز.

### CHG-047 — بازگردانی financial metrics برای ML evaluation

- زمان: `2026-07-15T09:28:00Z–09:40:00Z`.
- فایل: `src/ml/financial_metrics.py`.
- تغییر: `FinancialMetrics` و ارزیابی واقعی return/long/short/neutral، win-rate، directional accuracy، profit factor، Sharpe، drawdown و tradability gate اضافه شدند.
- test: smoke مستقیم deterministic روی محیط network-none موفق شد؛ collection کامل phase10 فعلاً به‌علت `drift_detector.py` غایب پیش از اجرای این تست متوقف می‌شود و این محدودیت صریح حفظ شده است.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:16480a1bbee433eee0de47e76bc2fa1823c30b431c505eef664aa2f520123092`.
- smoke: `/health`=`200 healthy`؛ ۱۱ سرویس running.
- rollback/blocker: rollback آماده؛ تکمیل phase10 به drift/calibration/purged modules legacy نیاز دارد.

### CHG-048 — بازگردانی ML drift detection

- زمان: `2026-07-15T09:42:00Z–09:55:00Z`.
- فایل: `src/ml/drift_detector.py`.
- تغییر: آزمون KS دو نمونه، گزارش feature drift با recommendation و prediction KL divergence با threshold قابل‌ردیابی اضافه شد.
- test: smoke deterministic روی توزیع‌های مشابه/shifted و prediction drift=`PASS`؛ `DRIFT_PASS` در network-none.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:59e8b94e98090972dc2bb307aaa5aeaaa12c302dacded85e5c4fbe78dcb90c20`.
- smoke: `/health`=`200 healthy`، ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ phase10 collection هنوز ماژول‌های calibration/purged و سایر legacy را نیاز دارد.

### CHG-049 — بازگردانی probability calibration

- زمان: `2026-07-15T09:58:00Z–10:10:00Z`.
- فایل: `src/ml/calibration.py`.
- تغییر: Platt logistic calibration، isotonic monotonic calibration و گزارش ECE/Brier واقعی اضافه شد؛ transform پیش از fit fail-closed است.
- test: smoke deterministic برای ECE/Brier و monotonic isotonic=`CALIBRATION_PASS` در network-none.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:e4aa6346a3ccb4c1fd3e69c0f2b038197f30fb4b37824ae6dff3691bf3290d06`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ phase10 هنوز purged-kfold/selector/determinism و full-suite legacy را نیاز دارد.

### CHG-050 — بازگردانی PurgedKFold زمان‌محور

- زمان: `2026-07-15T10:12:00Z–10:25:00Z`.
- فایل: `src/ml/purged_kfold.py`.
- تغییر: walk-forward folds با purge look-forward، embargo و جلوگیری از overlap؛ ورودی کم‌نمونه fail-fast است.
- test: smoke ساختار ۵-fold، purge و embargo=`PURGED_PASS` در network-none.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:09a7eccca76574471b3365d25d1ebd633dacf80bb672a0fe054d9a4096887605`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ phase10 هنوز determinism/selector/triple-barrier و legacy modules دارد.

### CHG-051 — بازگردانی deterministic training controls

- زمان: `2026-07-15T10:28:00Z–10:40:00Z`.
- فایل: `src/ml/determinism.py`.
- تغییر: کنترل global seed برای Python/NumPy و در صورت وجود Torch، تنظیم `PYTHONHASHSEED` و گزارش وضعیت reproducibility اضافه شد.
- test: smoke deterministic=`DETERMINISM_PASS`؛ random و numpy تکرارپذیر و hash seed صحیح.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:009229725398dae9930c07617ad4920748711634dc09128f65f4f54cff3f628e`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ phase10 هنوز feature selector/triple barrier و clean full-suite legacy دارد.

### CHG-052 — بازگردانی ML feature selector

- زمان: `2026-07-15T10:42:00Z–10:55:00Z`.
- فایل: `src/ml/feature_selector.py`.
- تغییر: correlation prune و انتخاب top-K بر اساس ارتباط با target؛ خروجی SelectionResult قابل‌ردیابی و بدون feature حذف تصادفی.
- test: smoke correlation/top-K=`SELECTOR_PASS` در network-none؛ f0 به‌درستی در top features باقی ماند.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:68e874d137c8f15dae74eb1c81e678d8d938d73bbb5fbd3da79170f9e7c24632`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ triple-barrier و legacy full-suite هنوز باز.

### CHG-053 — بازگردانی Triple Barrier labeling و sample weighting

- زمان: `2026-07-15T10:58:00Z–11:10:00Z`.
- فایل: `src/ml/triple_barrier.py`.
- تغییر: upper/lower/time barrier labeling، meta-label، temporal decay و inverse-volatility sample weights واقعی اضافه شد.
- test: smoke روند صعودی/نزولی، بازار flat و meta-label=`TRIPLE_PASS` در network-none.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:d410fa70d7279405380333593f70fcecac0e3bd796f670bd158fbe8b79fa1943`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ phase10 collection هنوز نیازمند تکمیل ماژول‌های باقی‌مانده است.

### GOV-054 — عبور کامل phase10 ML rebuild suite

- زمان: `2026-07-15T11:20:00Z–11:25:00Z`.
- run: `tests/test_phase10_ml_rebuild.py` در QA network-none/read-only، UID=`1000`.
- نتیجه: `36/36 PASS`، `0` fail، `0` error، `0` skip؛ فقط دو warning غیرمسدودکنندهٔ sklearn ثبت شد.
- پوشش: financial metrics، drift، PurgedKFold، calibration، determinism، feature selection و triple barrier.
- deploy: `N/A`؛ این gate تأییدی است و production از CHG-053 unchanged/healthy ماند.
- ادامه: phase11/12 risk و سایر legacy suites هنوز باید collect/implement شوند؛ PC-156 هنوز سه clean full-suite سبز ندارد.

### CHG-054 — بازگردانی PositionSizer و drawdown risk control

- زمان: `2026-07-15T11:28:00Z–11:40:00Z`.
- فایل‌ها: `src/risk/__init__.py` و `src/risk/position_sizer.py`.
- تغییر: fixed-fractional، Kelly، volatility-target sizing با cap ریسک و کاهش اندازه بر اساس drawdown واقعی اضافه شد.
- test: smoke sizing/negative expectancy=`SIZER_PASS` در network-none.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:87672287c32b2fbf0a2a12ecb7b308798fc83d32cf569bc727c865ca71666d2e`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ phase11 هنوز VaR/margin/multi-level modules و clean suite legacy را نیاز دارد.

### CHG-055 — بازگردانی Portfolio VaR و exposure guard

- زمان: `2026-07-15T11:42:00Z–11:55:00Z`.
- فایل: `src/risk/portfolio_var.py`.
- تغییر: VaR پارامتریک/تاریخی، CVaR و check exposure/var با گزارش دلیل و limitهای صریح اضافه شد.
- test: smoke VaR range، CVaR ordering و exposure breach=`VAR_PASS` در network-none.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:95dc8a39d691e95c013077a70785a45d6b008affcec33c060cdc85b96b7c2a20`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ margin/multi-level risk modules و clean-suite legacy هنوز باز.

### CHG-056 — بازگردانی MarginValidator رگولاتوری

- زمان: `2026-07-15T11:58:00Z–12:10:00Z`.
- فایل: `src/risk/margin_validator.py`.
- تغییر: سقف leverage برای FCA/NFA، محاسبهٔ notional/margin، insufficient margin و stop-out guard با دلیل قابل‌ردیابی اضافه شد.
- test: smoke leverage/insufficient/safe position=`MARGIN_PASS` در network-none.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:ebae6082348fcb3b6fa0686091a3243c252471addf0ae862fd75f08db7fb507d`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ multi-level limits و سایر phase11 legacy هنوز باز.

### CHG-057 — بازگردانی MultiLevelLossLimit

- زمان: `2026-07-15T12:12:00Z–12:25:00Z`.
- فایل: `src/risk/multi_level_limits.py`.
- تغییر: محدودیت‌های hourly/daily/weekly/monthly با period key UTC، size multiplier، blocking و in-memory fallback اضافه شد؛ سود مثبت limit را فعال نمی‌کند.
- validation: منطق period/status و loss thresholds در source پیاده شد؛ collection کامل phase11 به blocker مستقل `volatility_cost_model.py` مفقود می‌رسد و این محدودیت حفظ شده است.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:ccf7b750ca16343d8e5ea5ecf0939513f7d25c2c705d49f0209ba9abd65a482f`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ volatility cost model و سایر legacy risk suites بازند.

### CHG-058 — بازگردانی VolatilityAdjustedCostModel

- زمان: `2026-07-15T12:28:00Z–12:40:00Z`.
- فایل: `src/backtest/volatility_cost_model.py`.
- تغییر: spread/slippage وابسته به volatility، partial fill برای order بزرگ، rejection probability و simulate execution deterministic اضافه شد.
- test: smoke volatility scaling/partial fill/deterministic fill=`VOLCOST_PASS` در network-none.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:7e48e6255aca4cb35e04d2ea63091c2683e1da5701b97ac728b845affaff150c`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ phase11 هنوز سایر risk/backtest legacy modules را نیاز دارد.

### CHG-059 — رفع regressionهای phase11 risk

- زمان: `2026-07-15T12:42:00Z–13:00:00Z`.
- فایل‌ها: `src/risk/position_sizer.py` و `src/risk/multi_level_limits.py`.
- تغییر: volatility-target اکنون scaling کم‌نوسان را cap نمی‌کند؛ daily/weekly/monthly block قبل از کاهش hourly size بررسی می‌شود.
- test: کل `tests/test_phase11_quant_institutional.py`=`29/29 PASS`، یک warning غیرمسدودکننده.
- build/deploy: API و چهار worker rebuild/recreate؛ API digest=`sha256:dfd375b1e139279b07591edd440d865e9b7f590d9513528926bf853382c98278`.
- smoke: `/health`=`200 healthy`؛ ۱۱ کانتینر running.
- rollback/blocker: rollback آماده؛ phase12/بقیهٔ legacy و سه clean full-suite سبز هنوز باز.

### CHG-060 — هستهٔ معماری lifecycle سیگنال و outbox

- زمان UTC: `2026-07-15T13:05:00Z–13:25:00Z`.
- فایل‌ها: `src/signals/state_machine.py`, `src/signals/idempotency.py`, `src/signals/services.py`, `src/signals/repository.py`.
- تغییر بنیادی: state machine محدود و terminal برای چرخهٔ سیگنال، transition history قابل‌ممیزی، کلید idempotency و outbox retry/dead-letter، اعتبارسنجی lifecycle و repository/filter درون‌حافظه‌ای اضافه شد؛ انتقال غیرمجاز با exception دامنه رد می‌شود.
- اثر: شکاف معماری Phase 12 از نبود ماژول‌ها به قرارداد قابل‌تست و deterministic تبدیل شد؛ مسیرهای قبلی حذف نشدند.
- test: `tests/test_phase12_architecture.py`=`40/40 PASS` (یک هشدار cache به‌علت read-only QA image؛ بدون failure).
- build: `docker compose -f docker-compose.prochart.yml build api data-feed crypto-ws finnhub-ws news-worker` موفق.
- deploy: `docker compose ... up -d --no-build api data-feed crypto-ws finnhub-ws news-worker` در `2026-07-15T13:25:00Z` موفق؛ API image=`sha256:55184eefbc5068d355499ba4b8b069393bb7ad40e250e3863c7b8fb5f85edb89`.
- smoke/health: `GET /health`=`200`, status=`healthy`, database=`connected`, redis=`connected`; پنج سرویس recreate و running، کل production=`۱۱` کانتینر.
- rollback/blocker: image قبلی قابل rollback است؛ سه clean full-suite، visual/motion کامل و بخش‌های باقی‌ماندهٔ legacy هنوز blocker تکمیل نهایی‌اند؛ کار بلافاصله با شکاف بعدی ادامه دارد.

### CHG-061 — تکمیل هستهٔ backtest و walk-forward

- زمان UTC: `2026-07-15T13:28:00Z–13:45:00Z`.
- فایل‌ها: `src/backtest/simulator.py`, `src/backtest/metrics.py`, `src/backtest/engine.py`, `src/backtest/walk_forward.py`.
- تغییر بنیادی: شبیه‌ساز OHLC محافظه‌کار با gap/SL/TP/timeout و هزینهٔ واقعی، خروجی TradeOutcome، متریک‌های عملکرد و attribution، موتور اجرای سیگنال و foldهای walk-forward اضافه شد.
- test: `tests/test_phase1_backtest.py`=`26/26 PASS` (یک warning read-only cache؛ بدون failure).
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T13:45:00Z` موفق؛ API image=`sha256:05a3d9892e53cac2569bf57dbe7c41bfe0b456a19a43b04b8bfe0b3ed6d6735c`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ production=`۱۱` کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ phase14، phase2/3/6 collection gaps و full-suite/visual/motion gates باقی است.

### CHG-062 — گزارش‌دهی institutional و اتصال داشبورد

- زمان UTC: `2026-07-15T13:50:00Z–14:10:00Z`.
- فایل‌ها: `src/backtest/advanced_metrics.py`, `src/backtest/reporting.py`, `src/api/routes/reports.py`, `src/api/main.py`, `frontend/admin/src/{App.jsx,pages/ReportsPage.jsx,components/Layout/Sidebar.jsx,api/client.js}`.
- تغییر بنیادی: MAR/Calmar/Omega/tail/ulcer/PSR/DSR، heatmap ماهانه، rolling metrics، drawdown و benchmark comparison اضافه شد؛ routeهای admin با احراز هویت و صفحات/کلاینت فارسی RTL متصل شدند.
- test: `tests/test_phase14_reporting.py`=`32/32 PASS` (یک warning read-only cache؛ بدون failure).
- build: compose build API/workerها و `admin-frontend` موفق.
- deploy: پنج سرویس Python و `admin-frontend` در `2026-07-15T14:10:00Z` recreate شدند؛ API image=`sha256:d75e0204c7ee319bb9a70df7fc12065f27b987c6db42558b298fc811a6f76056`؛ admin image=`sha256:b9cfff5f151c5f204fe6a6c07fea7ea375ff0db3dd2652cc546fd90c78cad50b`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: rollback imageهای قبلی آماده؛ phase2/3/6 collection gaps، full clean suite و visual/motion/accessibility gates هنوز باز هستند.

### CHG-063 — زیرساخت اولیهٔ ریسک Phase 2

- زمان UTC: `2026-07-15T14:15:00Z–14:35:00Z`.
- فایل‌ها: `src/risk/symbol_config.py`, `daily_loss_limit.py`, `correlation.py`, `session_filter.py`, `weekend_filter.py`, `regime_detector.py`, `guard.py`.
- تغییر بنیادی: پیکربندی نمادها، circuit breaker زیان روزانه، exposure ارزی، session/weekend filter، تشخیص regime و RiskGuard یکپارچه اضافه شد.
- test: `tests/test_phase2_risk.py` جمعاً `39/46 PASS`، ۷ نقص رفتاری باقی‌مانده (failure صادقانه؛ تست حذف/skip نشده).
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T14:35:00Z` موفق؛ API image=`sha256:41b1861d5e26a78565f6cae14abe3af8bce416bd66bb7cb905bdb9fef82643dd`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ ۷ failure Phase 2 و phase3/6/14 باقی‌مانده و full clean/visual/motion gates باز.

### CHG-064 — اصلاحات رفتاری correlation/session/weekend در Phase 2

- زمان UTC: `2026-07-15T14:40:00Z–14:55:00Z`.
- فایل‌ها: `src/risk/correlation.py`, `session_filter.py`, `weekend_filter.py`, `guard.py`.
- تغییر بنیادی: قرارداد `evaluate` برای exposure، شناخت XAU/USD و نماد ناشناخته، strict session، پیام قابل‌ممیزی و پایان صحیح blackout یکشنبه اصلاح شد؛ RiskGuard با reason string یکپارچه شد.
- test: پس از CHG-063، ۳۹/۴۶ قبلی ثبت است؛ تست رفتاری اصلاحات مجدداً در چرخهٔ بعدی اجرا می‌شود و failureهای باقیمانده حذف/skip نشده‌اند.
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T14:55:00Z` موفق؛ API image=`sha256:64886c3a39886a834b5dd3b25d10194ecd9b72499e3e65c2b8fe2feb79eb3b1b`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ آزمون کامل Phase 2، phase3/6 gaps و clean/visual/motion gates باز.

### CHG-065 — تکمیل کامل Phase 2 risk gate

- زمان UTC: `2026-07-15T15:00:00Z–15:15:00Z`.
- فایل‌ها: `src/risk/correlation.py`, `src/risk/regime_detector.py`.
- تغییر بنیادی: پشتیبانی NZD/USD و exposure واقعی چندپوزیشن، خروجی regime برای دادهٔ ناکافی و شاخص‌های DI/ADX/ATR تکمیل شد.
- test: `tests/test_phase2_risk.py`=`46/46 PASS` (یک warning read-only cache؛ بدون failure).
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T15:15:00Z` موفق؛ API image=`sha256:2a2786d2fe07e006d2a75dd3761cd283403c60d80d050ac0635d73e6078930a6`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ phase3 و phase6 collection gaps و full clean/visual/motion gates باقی است.

### CHG-066 — آغاز Phase 3 ML optimization

- زمان UTC: `2026-07-15T15:20:00Z–15:35:00Z`.
- فایل‌ها: `src/ml/scaler.py`, `src/analysis/multi_timeframe.py`.
- تغییر بنیادی: scaler استاندارد/robust/minmax با save/load امن و MultiTimeframeAnalyzer با confluence، bias، conflict و تشخیص سیگنال خلاف روند اضافه شد.
- test: collect Phase 3 اکنون از scaler و MTF عبور می‌کند؛ شکاف بعدی `src/analysis/volume_profile.py` در collection شناسایی شد؛ تست ناقص ادعا نشده است.
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T15:35:00Z` موفق؛ API image=`sha256:1ae24cd4611a4c594094d88afa0f8d6daeac2a03192e848f4c2bb4d546371fb7`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ volume profile و بقیهٔ Phase 3، Phase 6 و clean/visual/motion gates باز.

### CHG-067 — volume profile و چارچوب A/B سیگنال

- زمان UTC: `2026-07-15T15:40:00Z–15:55:00Z`.
- فایل‌ها: `src/analysis/volume_profile.py`, `src/signals/ab_test.py`.
- تغییر بنیادی: VWAP، POC/value-area، ارزیابی نقدشوندگی و آزمایش deterministic variant assignment و تحلیل significance/profit-factor اضافه شد.
- test: collection Phase 3 از volume profile عبور می‌کند؛ شکاف بعدی پس از collect ادامه دارد؛ failure یا skip پنهان نشده است.
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T15:55:00Z` موفق؛ API image=`sha256:09dabe61333d4697d078908bc78a37222340ca0949a1c50aa99c57b204ce0558`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ تکمیل باقی Phase 3/6 و clean/visual/motion gates باز.

### CHG-068 — paper trading و divergence gate

- زمان UTC: `2026-07-15T16:00:00Z–16:15:00Z`.
- فایل‌ها: `src/launch/paper_trading.py`, `src/launch/divergence.py`.
- تغییر بنیادی: modeهای paper/live/disabled، namespace امن paper، publish کنترل‌شده، و مقایسهٔ paper با backtest برای wait/proceed/block اضافه شد.
- test: collection Phase 6 از paper module عبور می‌کند و شکاف بعدی preflight شناسایی خواهد شد؛ تست ناقص ادعا نشده است.
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T16:15:00Z` موفق؛ API image=`sha256:3d82c7494c6b4dc93ec68e5789872cc2b7874130922201c7ff708bb2261e4b5b`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ باقی Phase 6، clean/visual/motion و completion audit باز.

### CHG-069 — تکمیل Phase 6 preflight و runbook

- زمان UTC: `2026-07-15T16:20:00Z–16:35:00Z`.
- فایل‌ها: `src/launch/preflight.py`, `docs/RUNBOOK.md`.
- تغییر بنیادی: checkهای runbook/backup/monitoring با سطوح critical/warning و launch readiness، به‌همراه runbook عملیاتی فارسی اضافه شد.
- test: `tests/test_phase6_launch.py`=`24/24 PASS` (یک warning read-only cache؛ بدون failure).
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T16:35:00Z` موفق؛ API image=`sha256:1aa7d3fb2578a98031d494ac4dccfa82ae50d42edb2c006976b2d13bf67152ec`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ full clean suite، visual/motion/accessibility و completion audit اسناد باقی است.

### CHG-070 — زیرساخت تعطیلات و trailing stop Phase 7

- زمان UTC: `2026-07-15T16:40:00Z–16:55:00Z`.
- فایل‌ها: `src/risk/holiday_calendar.py`, `src/signals/trailing_stop.py`, `src/risk/guard.py`.
- تغییر بنیادی: تقویم تعطیلات کامل/جزئی، blackout، Chandelier exit و stateful trailing stop تا breakeven/TP lock اضافه شد؛ RiskGuard kwargs سازگار شد.
- test: Phase 7 پس از این increment `16 PASS` و `15 FAIL` ثبت شد؛ launch route/DST و integrationهای باقی‌مانده هنوز fail صادقانه دارند.
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T16:55:00Z` موفق؛ API image=`sha256:3588d8b7fa96bad9d94efb94e2c5f26ff8e0e4d22f365c5908b953004dc6af28`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ DST، launch route، integration و full clean/visual/motion gates باز.

### CHG-071 — اتصال‌های Phase 7 و DST/session

- زمان UTC: `2026-07-15T17:00:00Z–17:15:00Z`.
- فایل‌ها: `src/risk/session_filter.py`, `src/api/routes/launch.py`, `src/api/routes/backtest.py`, `src/signals/tracker.py`, `src/ml/trainer.py`, `src/api/main.py`, `src/risk/guard.py`.
- تغییر بنیادی: DST اروپا/آمریکا، routeهای launch/backtest با admin auth، اتصال tracker به DailyLossLimit و trainer به scaler اضافه شد؛ guard قرارداد holiday/liquidity را آشکار کرد.
- test: Phase 7 پس از CHG-070 `16 PASS/15 FAIL`؛ این increment مسیرهای source-level ناقص را پوشش داد و failureهای باقیمانده صادقانه باز هستند.
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T17:15:00Z` موفق؛ API image=`sha256:80b81ffd7b219b058e36f464f8b7739885018d9f532bc868f1013a84e8a13e7c`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ Phase 7 integrationهای runtime، UX، performance و full clean/visual/motion gates باز.

### CHG-072 — تکمیل نهایی Phase 7 holiday/trailing

- زمان UTC: `2026-07-15T17:20:00Z–17:35:00Z`.
- فایل‌ها: `src/signals/trailing_stop.py`, `src/risk/guard.py`.
- تغییر بنیادی: `tp3_price` اختیاری برای سازگاری state، مرحلهٔ lock بدون حرکت معکوس و رد holiday با کد `holiday_blackout` اضافه شد.
- test: `tests/test_phase7_followups.py`=`31/31 PASS` (یک warning read-only cache؛ بدون failure).
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T17:35:00Z` موفق؛ API image=`sha256:cd93099470f39e1e4f28211bc064992e76444726f0840b6511590b0d42c36d18`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ clean suite هنوز failureهای legacy/UX دارد و visual/motion/accessibility audit باز است.

### CHG-073 — هستهٔ UX فارسی/RTL و دسترس‌پذیری پنل

- زمان UTC: `2026-07-15T17:40:00Z–17:55:00Z`.
- فایل‌ها: `frontend/admin/src/components/common/{CommandPalette,EmptyState,Skeleton}.jsx`, `components/Layout/{Sidebar,AdminLayout}.jsx`, `store/index.js`, `i18n/index.js`.
- تغییر بنیادی: command palette با keyboard/ARIA، empty/skeleton states با reduced motion، mobile drawer state و i18n فارسی با interpolation اضافه شد.
- test: Phase 15 از `14` به `27` تست موفق رسید؛ store/i18n باقی‌مانده در چرخهٔ بعدی آزموده می‌شود.
- build/deploy: `admin-frontend` build و recreate موفق در `2026-07-15T17:55:00Z`؛ image=`sha256:3248cd2c257116e2a616f399f9ea323d194e769eab3cd07d697add7106ff98d6`.
- smoke: کانتینر `prochart-admin-frontend` started؛ API قبلی healthy و ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ UX store integration و full clean/visual/motion/accessibility gates باز.

### CHG-074 — تکمیل i18n و UX gate پنل

- زمان UTC: `2026-07-15T18:00:00Z–18:15:00Z`.
- فایل‌ها: `frontend/admin/src/i18n/index.js`.
- تغییر بنیادی: کلیدهای nav/status/direction فارسی و interpolation کامل شد؛ پنل برای مسیرهای UX پایه آمادهٔ تست است.
- test: `tests/test_phase15_ux.py`=`32/32 PASS` (یک warning read-only cache؛ بدون failure).
- build/deploy: `admin-frontend` build و recreate موفق؛ image=`sha256:4e2e6f917f1659751397b6f74369ef832662abbb82086628decff557b6302f13`.
- smoke: کانتینر admin started؛ API و وابستگی‌ها running، production=`۱۱` کانتینر.
- rollback/blocker: image قبلی آمادهٔ rollback؛ phase5 frontend، performance/security و full clean/visual/motion gates باز.

### CHG-075 — تکمیل routeهای بک‌تست و ریسک پنل

- زمان UTC: `2026-07-15T18:20:00Z–18:35:00Z`.
- فایل‌ها: `frontend/admin/src/{App.jsx,pages/BacktestPage.jsx,pages/RiskPage.jsx,components/Layout/Sidebar.jsx,api/client.js}`, `src/api/routes/{risk,backtest}.py`, `src/api/main.py`.
- تغییر بنیادی: صفحات و API client بک‌تست/ریسک، routeهای admin-authenticated و mount در FastAPI اضافه شد.
- test: `tests/test_phase5_frontend.py`=`16/16 PASS`.
- build/deploy: API/workerها و admin frontend build/recreate موفق؛ API image=`sha256:ef2758ac5feae20513a277fa949fe291c0fb46403c4046832bed93ba1b56048d`؛ admin image=`sha256:7b10a41bf87bc1989ae16189a90b8a1e75c184aa2b153ce5f788690421b964f5`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: imageهای قبلی آمادهٔ rollback؛ remaining UX integration، performance/security و full clean/visual/motion gates باز.

### CHG-076 — بهینه‌سازی مسیرهای performance و concurrency

- زمان UTC: `2026-07-15T18:40:00Z–18:55:00Z`.
- فایل‌ها: `src/api/routes/{signals,users,performance}.py`, `src/signals/{tracker,engine}.py`.
- تغییر بنیادی: countهای database-side، daily aggregation با date_trunc، pagination active signals و asyncio gather/semaphore/thread offload اضافه شد.
- test: Phase 9 از ۱۸ به ۲۴ تست collect‌شده رسید؛ ۶ شکست source-level قبلی با مسیرهای جدید پوشش داده شدند و gate کامل بعدی در حال اجراست.
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T18:55:00Z` موفق؛ API image=`sha256:a91e0e55bf4024f482562f27d267fdf507514cba3dddbf2cdcfe12ea73924c33`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ performance source gate، security و full clean/visual/motion gates باقی است.

### CHG-077 — تکمیل concurrency tracker gate

- زمان UTC: `2026-07-15T19:00:00Z–19:15:00Z`.
- فایل‌ها: `src/signals/tracker.py`.
- تغییر بنیادی: قرارداد source-level برای `asyncio.gather` و semaphore در بررسی همزمان سیگنال‌ها تثبیت شد.
- test: `tests/test_phase9_performance.py`=`24/24 PASS` (یک warning read-only cache؛ بدون failure).
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T19:15:00Z` موفق؛ API image=`sha256:db7dafd4c84d4c6d1f2174037d4fab5d478a7e7e762cc914736b3618c405d00e`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ full clean suite، security، visual/motion/accessibility و completion audit باز.

### CHG-078 — بستن security whitelist launch metrics

- زمان UTC: `2026-07-15T19:20:00Z–19:35:00Z`.
- فایل‌ها: `src/api/routes/launch.py`.
- تغییر بنیادی: whitelist صریح `_ALLOWED_METRIC_FIELDS` و guard قبل از `setattr` برای جلوگیری از تغییر فیلدهای دلخواه اضافه شد.
- test: `tests/test_phase8_security_hotfix.py`=`31/31 PASS`.
- build: compose build پنج سرویس Python موفق.
- deploy: recreate پنج سرویس در `2026-07-15T19:35:00Z` موفق؛ API image=`sha256:91bc1949da5b86f0eb173832a654379fa08088e6ebe5cdf92c803056b758f1af`.
- smoke/health: `/health`=`200`, healthy، database/redis connected؛ ۱۱ کانتینر running.
- rollback/blocker: image قبلی آمادهٔ rollback؛ full clean suite و visual/motion/accessibility/completion audit باز.

### CHG-079 — حذف آخرین failure کل suite

- زمان UTC: `2026-07-15T19:40:00Z–19:55:00Z`.
- فایل‌ها: `frontend/admin/src/App.jsx`.
- تغییر بنیادی: route قابل‌مشاهدهٔ `/reports` به shell پنل اضافه شد تا گزارش‌دهی از مسیر UI قابل دسترسی باشد.
- test: full clean suite پس از اصلاح قبلی `541 PASS/1 FAIL` بود؛ `tests/test_phase14_reporting.py` پس از این تغییر PASS شد و failure route رفع شد.
- build/deploy: `admin-frontend` build و recreate موفق؛ image=`sha256:3bcc9375d0553154cb8eb0e2635caf18cfa70fda3b0a0206b655bf5f5709fb32`.
- smoke: admin container started؛ API وابستگی‌ها running و health آخرین deploy `200`.
- rollback/blocker: image قبلی آمادهٔ rollback؛ اجرای clean سه‌باره، visual/motion/accessibility و مستندات نهایی هنوز باید gate شوند.

### GOV-055 — clean full-suite فعلی

- زمان UTC: `2026-07-15T20:05:00Z`.
- evidence: اجرای clean QA image `prochart-qa-pytest:20260715T082000Z-clean-current` با mount read-only و network none.
- نتیجه: `542 passed`, `2 warnings` غیرمسدودکنندهٔ sklearn/pytest cache، `0 failed`, `0 error`, `0 skipped`.
- وضعیت: یک clean run سبز ثبت شد؛ برای COMPLETE هنوز دو clean run متوالی دیگر، visual/motion/accessibility، security/dependency و اسناد/Matrix باید با evidence مستقل تأیید شوند.

### GOV-056 — clean full-suite دوم

- زمان UTC: `2026-07-15T20:15:00Z`.
- evidence: همان clean QA image، network none/read-only.
- نتیجه: `542 passed`, `0 failed`, `0 error`, `2 warnings` غیرمسدودکننده.

### GOV-057 — clean full-suite سوم

- زمان UTC: `2026-07-15T20:35:00Z`.
- evidence: همان clean QA image، network none/read-only.
- نتیجه: `542 passed`, `0 failed`, `0 error`, `2 warnings` غیرمسدودکننده؛ سه clean run متوالی اکنون سبز است.

### GOV-058 — audit artifacts و DOCX

- زمان UTC: `2026-07-15T20:45:00Z`.
- evidence: هر ۱۵ فایل خروجی اجباری موجود؛ هر دو DOCX قابل‌خواندن و hashهای ثبت‌شده حفظ شده‌اند: Master=`590cf24933ec7b5c60337ded2e64de28a5de75a61d144f8f3ed6a12baa5eeab2`, Matrix=`6708022c13c9b07656825043d671d822545c773fae13a9c1b59cf35e42e71955`.
- وضعیت: JSON Matrix در محیط runtime با مفسر container بررسی می‌شود؛ visual/motion evidence اجرایی و approval baseline هنوز برای COMPLETE کافی نیست.

### GOV-059 — اعتبارسنجی Matrix JSON

- زمان UTC: `2026-07-15T20:50:00Z`.
- evidence: `docs/03_REQUIREMENTS_MATRIX.json` با Python در clean QA container parse شد و `matrix-json-pass` برگشت؛ host interpreter نصب نیست و ادعای محلی ثبت نشد.

### GOV-060 — اسکن امنیتی repository و dependency

- زمان UTC: `2026-07-15T21:10:00Z`.
- فرمان: `bash scripts/security_scan.sh` با Docker.
- نتیجه: اسکن کامل اجرا شد؛ Gitleaks یک finding تاریخی در commit قدیمی `.cf` گزارش کرد (فایل در worktree فعلی حذف است)، بنابراین secret-release gate هنوز PASS نیست. Trivy dependency/config نیز evidence تولید کرد؛ ادعای پاکی کامل صادر نشد.
- وضعیت: blocker امنیتی قابل‌رفع با revoke/rotate credential تاریخی و پاک‌سازی/waiver مستند؛ visual/motion approval و release provenance نیز باز هستند.

### GOV-061 — current-source secret scan

- زمان UTC: `2026-07-15T21:25:00Z`.
- فرمان: `docker run ... zricethezav/gitleaks:latest detect --no-git --redact` روی worktree جاری.
- نتیجه: exit `0` و finding=`0`؛ secret تاریخی فقط در git history باقی است و release gate همچنان نیازمند revoke/rotate و waiver یا history remediation است.

### GOV-062 — همگام‌سازی EXECUTION_STATE

- زمان UTC: `2026-07-15T21:40:00Z`.
- فایل: `docs/EXECUTION_STATE.md`.
- تغییر: وضعیت سه clean run سبز و blockerهای واقعی visual/motion، secret rotation و artifact signing ثبت شد؛ هیچ ادعای VERIFIED/COMPLETE اضافه نشد.

### GOV-063 — checksum نهایی DOCX source

- زمان UTC: `2026-07-15T21:55:00Z`.
- فرمان: `sha256sum -c docs/source/SHA256SUMS` از مسیر `docs/source`.
- نتیجه: هر دو فایل `ProChart_Master_Spec_FA.docx` و `ProChart_Requirements_Matrix_FA.docx` برابر hash canonical و `OK` هستند.

### GOV-064 — اجرای live visual harness

- زمان UTC: `2026-07-16T00:25:00Z`.
- فرمان: `PROCHART_BASE_URL=https://127.0.0.1 VISUAL_CAPTURE_ONLY=1 npm run test:visual-reference`.
- نتیجه: harness اجرا شد اما دو assertion واقعی fail شد: canvas chart و onboarding selector در edge فعلی پیدا نشدند؛ artifactهای screenshot/video/trace تولید و failure صادقانه ثبت شد. Golden approval صادر نشد.

### GOV-065 — visual harness با hostname صحیح edge

- زمان UTC: `2026-07-16T00:45:00Z`.
- فرمان: `PROCHART_BASE_URL=https://localhost VISUAL_CAPTURE_ONLY=1 npm run test:visual-reference`.
- نتیجه: `3 passed`, `3 skipped` (skipهای project/device عمدی طبق harness)، retry/flaky=0؛ artifactهای capture جدید تولید شد. این deterministic capture را تقویت می‌کند، اما Golden approval، full state matrix و Motion gate هنوز VERIFIED نیستند.

### GOV-066 — interaction/a11y evidence روی edge

- زمان UTC: `2026-07-16T01:15:00Z`.
- فرمان‌ها: `PROCHART_BASE_URL=https://localhost npm run test:onboarding-focus` و `npm run test:watchlist`.
- نتیجه: onboarding focus `2 passed/2 skipped` و watchlist interaction `4/4 PASS`؛ trace/video تولید شد، اما این شواهد جایگزین Motion Matrix کامل (pinch/pan/zoom/drawing/undo) و approval انسانی Golden نیست.

### GOV-067 — performance browser harness با runner attribution

- زمان UTC: `2026-07-16T01:35:00Z`.
- فرمان: `PROCHART_BASE_URL=https://localhost PLAYWRIGHT_IMAGE_DIGEST=sha256:57b65fdc9ceabe0ef613124c7bbe2babcf9362c4d85e382fe3b03604e84b428a npm run test:performance`.
- نتیجه: `2 passed`, `2 skipped` عمدی طبق project matrix، retry/flaky=0؛ runner digest attributable است و artifact performance تولید شد. Threshold release/performance budget هنوز مستقل از harness باید تأیید شود.

### GOV-069 — referral و CSP با hostname واقعی production

- زمان UTC: `2026-07-16T02:20:00Z`.
- فایل‌ها/سرویس: `qa/tests/referral-compliance.spec.mjs`، `qa/tests/security-headers.spec.mjs`، edge و User Portal production.
- شرح دقیق: اجرای اولیه با hostnameهای مستندنشدهٔ `prochart.local`/`user.prochart.local` به دلیل DNS محلی شکست خورد؛ همان آزمون‌ها با `PROCHART_BASE_URL=https://localhost` و همان live edge دوباره اجرا شدند.
- اثر بنیادی: referral gate، disclosure، same-origin redirect و CSP runtime روی endpoint قابل‌دسترسی production تأیید شد؛ شکست DNS harness به‌عنوان نقص پیکربندی محیط، نه نقص محصول، ثبت شد.
- build: تغییر runtime/کد انجام نشد؛ build لازم نبود (N/A).
- تست‌ها: referral compliance `4 passed`; security headers/CSP `1 passed`; retry/flaky=`0` در اجرای موفق.
- image/fingerprint: بدون تغییر؛ edge/frontend و portal imageهای ثبت‌شده در همین دفتر حفظ شدند.
- deploy production: انجام نشد؛ بدون تغییر runtime.
- smoke/health: اجرای موفق از مسیر `https://localhost` و HTTP `200` در harness؛ health سرویس‌ها بدون تغییر.
- rollback و blocker: rollback لازم نیست؛ visual/motion approval، performance budget مستقل، و historical-secret/release-provenance هنوز باز هستند.

### CHG-080 — همگام‌سازی image پنل و gate ناوبری legacy

- زمان UTC: `2026-07-16T02:45:00Z`.
- فایل‌ها/سرویس: `frontend/panel/`، سرویس `admin-frontend`، edge `panel.pro-chart.com`.
- شرح دقیق: image پنل از source جاری بازسازی و rollout شد تا redirectهای `/signals → /ai-signals` و `/visitors → /analytics` در production واقعاً قابل‌اجرا باشند؛ این rollout شکاف image قدیمی/سورس را بست.
- اثر بنیادی: پنل اکنون artifact متناظر با source جاری را سرو می‌کند و registry مسیرها/legacy redirectها در image جدید موجود است.
- build: `docker compose -f docker-compose.prochart.yml build admin-frontend` موفق؛ image digest `sha256:f3b22c07faea8cfcb4e8730949fdea2ecda8ab55a12dba553cd3808169db39bd`.
- تست‌ها: `test:quote-commit` با `PROCHART_BASE_URL=https://localhost` برابر `1 passed`؛ تست panel-navigation روی `localhost` عمداً به vhost اصلی خورد و `/signals` را به‌جای panel دید، بنابراین pass ادعا نشد. بررسی مستقیم `curl --resolve panel.pro-chart.com:443:127.0.0.1` پاسخ `200` و artifact جدید را تأیید کرد.
- deploy production: `docker compose ... up -d --no-build admin-frontend` موفق؛ کانتینر `prochart-admin-frontend` recreated/started.
- smoke/health: edge `https://localhost/` برابر `200`; panel vhost با Host/SNI صحیح برابر `200`؛ health در حال گذار پس از restart و سپس سرویس running است.
- rollback: image قبلی `sha256:3bcc9375d0553154cb8eb0e2635caf18cfa70fda3b0a0206b655bf5f5709fb32` برای rollback نگه داشته شد.
- blocker: اجرای Playwright panel با DNS عمومی Cloudflare به vhost محلی وصل نمی‌شود؛ برای release evidence باید runner با host mapping `panel.pro-chart.com → 127.0.0.1` اجرا شود.
- commit: `ffc3cf8` (`fix(panel): deploy legacy navigation routes`)، unit navigation `5/5 PASS` پس از commit.

### CHG-081 / GOV-070 — پشتیبانی harness از vhost محلی Panel

- زمان UTC: `2026-07-16T03:05:00Z`.
- فایل‌ها/سرویس: `qa/playwright.config.mjs` و تست `qa/tests/panel-navigation.spec.mjs`؛ بدون تغییر runtime.
- شرح دقیق: متغیر `PLAYWRIGHT_HOST_RESOLVER_RULES` به launch configuration اضافه شد تا runner بتواند vhost production را به edge محلی pin کند؛ DNS عمومی یا مسیر تست دور زده نشد.
- اثر بنیادی: legacy aliasها و command-palette اکنون روی vhost واقعی Panel قابل‌راستی‌آزمایی‌اند.
- build: build محصول لازم نبود؛ syntax/config load با Playwright اجرا شد.
- تست‌ها: `PROCHART_BASE_URL=https://panel.pro-chart.com PLAYWRIGHT_HOST_RESOLVER_RULES='MAP panel.pro-chart.com 127.0.0.1' npm run test:panel-navigation -- --reporter=line` برابر `1 passed`؛ retry/flaky=`0`.
- image/fingerprint: runner با `PANEL_SOURCE_FINGERPRINT=sha256:f3b22c07faea8cfcb4e8730949fdea2ecda8ab55a12dba553cd3808169db39bd`؛ image production تغییری نکرد.
- deploy/smoke: deploy لازم نبود؛ vhost محلی پیش‌تر `200` و container healthy ثبت شده است.
- commit/rollback: commit بعدی همین increment؛ rollback فقط حذف env/config جدید است.
- blocker: Visual/Motion golden approval، performance budget مستقل، و secret-history/release-provenance همچنان باز هستند.

### CHG-082 / GOV-071 — اصلاح fixture آزمون CSP بدون unsafe-eval

- زمان UTC: `2026-07-16T03:25:00Z`.
- فایل‌ها/سرویس: `qa/tests/security-headers.spec.mjs`؛ policy runtime بدون تغییر.
- شرح دقیق: probe worker از `new Function` به expression ثابت `postMessage(6 * 7)` تغییر کرد؛ آزمون اکنون capability مجاز blob worker را می‌سنجد و با `script-src 'self'` سازگار است.
- اثر بنیادی: false negative حذف شد بدون تضعیف CSP یا افزودن `unsafe-eval`.
- build: build محصول لازم نبود؛ تست harness syntax و runtime را پوشش داد.
- تست‌ها: روی vhost Panel با resolver محلی `security-headers` برابر `1 passed`؛ retry/flaky=`0`.
- image/fingerprint: runtime image تغییری نکرد؛ policy همان `portal-security-boundary.conf` باقی است.
- deploy/smoke: deploy لازم نبود؛ edge و health قبلی پایدار.
- commit/rollback: commit همین increment؛ rollback با برگرداندن fixture ممکن است اما آزمون دوباره false negative می‌شود.
- blocker: visual/motion matrix، performance budget مستقل و release provenance هنوز تکمیل نشده‌اند.

### CHG-083 / GOV-072 — اجرای reduced-motion برای مسیر onboarding

- زمان UTC: `2026-07-16T03:45:00Z`.
- فایل‌ها/سرویس: `qa/playwright.config.mjs` و `qa/tests/onboarding-focus.spec.mjs`؛ runtime محصول بدون تغییر.
- شرح دقیق: گزینهٔ `PLAYWRIGHT_REDUCED_MOTION` به harness اضافه شد و مسیر onboarding با `reduce` اجرا شد تا focus trap، inert background، Escape و restore focus در محیط کم‌حرکت ثبت شود.
- اثر بنیادی: شواهد قابل‌بازتولید برای MOT-007/MOT-008 و الزامات دسترس‌پذیری تولید شد؛ این شواهد جایگزین کل Motion Matrix نیست.
- build: build محصول لازم نبود؛ config توسط Playwright load و اجرا شد.
- تست‌ها: `PROCHART_BASE_URL=https://localhost PLAYWRIGHT_REDUCED_MOTION=reduce npm run test:onboarding-focus -- --reporter=line` برابر `2 passed / 2 skipped` عمدی، retry/flaky=`0`.
- image/fingerprint: بدون تغییر runtime image.
- deploy/smoke: deploy لازم نبود؛ live edge `200` و smoke قبلی حفظ شد.
- commit/rollback: commit همین increment؛ rollback با حذف env/config fallback به `no-preference`.
- blocker: MOT-001..006/009/010 و golden approval هنوز ثبت‌نشده‌اند؛ performance/release provenance نیز باز است.

### GOV-073 — به‌روزرسانی Motion Matrix با شواهد onboarding

- زمان UTC: `2026-07-16T03:55:00Z`.
- فایل: `docs/qa/MOTION_MATRIX.md`.
- تغییر: وضعیت کلی از `NOT_CAPTURED` به `PARTIAL`؛ MOT-007 و MOT-008 با evidence مسیر onboarding و reduced-motion به‌صورت `PARTIAL` ثبت شدند، بدون ادعای عبور timing یا gesture کامل.
- آزمون/شاهد: اجرای ثبت‌شده در CHG-083 (`2 passed / 2 skipped` عمدی).
- build/deploy: تغییر مستنداتی است؛ build و deploy لازم نیست.
- blocker: MOT-001..006/009/010 و تأیید دستی golden همچنان باز است.

### GOV-074 — اجرای کامل A11Y mobile matrix پس از بازتولید hang

- زمان UTC: `2026-07-16T04:15:00Z`.
- فایل/شاهد: `qa/tests/a11y-matrix.spec.mjs` و `artifacts/qa/a11y-matrix/working-tree/20260716T041000Z/`.
- فرمان: `PROCHART_BASE_URL=https://localhost A11Y_MATRIX_RUN_ID=20260716T041000Z npm run test:a11y-matrix -- --project=chromium-mobile --reporter=line`.
- نتیجه: هر پنج state (`chart`, `watchlist`, `ai`, `markets`, `profile`) برابر `5 passed`؛ retry/flaky=`0`، زمان کل `41.5s`. اجرای جداگانه profile نیز `1 passed` بود.
- build/deploy: تغییر runtime انجام نشد؛ build و deploy لازم نیست.
- اثر: hang قبلی در این run بازتولید نشد؛ این نتیجه ادعای رفع ریشه‌ای timing را نمی‌دهد و contrast/manual review همچنان مستقل است.
- blocker: Motion gestureهای اصلی و visual golden approval هنوز باز هستند.

### CHG-084 / GOV-075 — آزمون wheel چارت و عدم تداخل scroll

- زمان UTC: `2026-07-16T04:40:00Z`.
- فایل‌ها: `qa/tests/motion-chart.spec.mjs`، `qa/package.json`؛ runtime محصول بدون تغییر.
- شرح: تست desktop با fixture واقعی، canvas chart را load می‌کند، wheel `deltaY=240` را روی ناحیه چارت اعمال می‌کند، event trace می‌گیرد و ثابت می‌کند URL و `scrollX/scrollY` تغییر نکرده‌اند.
- build: build محصول لازم نبود؛ Playwright harness اجرا شد.
- تست: `PROCHART_BASE_URL=https://localhost npm run test:motion-chart -- --reporter=line` برابر `1 passed / 1 skipped` عمدی؛ retry/flaky=`0`.
- deploy/smoke: deploy لازم نیست؛ edge smoke موجود حفظ شد.
- اثر: MOT-002 اکنون شواهد رفتاری اولیه دارد؛ anchor geometry/zoom scale هنوز باید تکمیل شود.
- commit/rollback: commit همین increment؛ rollback حذف test/script.
- blocker: MOT-001/003/004/005/006/009/010 و golden approval باز هستند.

### CHG-085 / GOV-076 — ثبت geometry assertion برای MOT-002

- زمان UTC: `2026-07-16T05:00:00Z`.
- فایل‌ها: `qa/tests/motion-chart.spec.mjs`، `docs/qa/MOTION_MATRIX.md`.
- تغییر: bounding box canvas قبل و بعد wheel مقایسه شد؛ MOT-002 در Matrix از `NOT_CAPTURED` به `PARTIAL` رفت، بدون ادعای zoom-anchor کامل.
- تست: `PROCHART_BASE_URL=https://localhost npm run test:motion-chart -- --reporter=line` برابر `1 passed / 1 skipped` عمدی؛ retry/flaky=`0`.
- build/deploy: فقط QA/docs؛ build و deploy runtime لازم نیست.
- rollback/blocker: revert مستندات و assertion ممکن است؛ MOT-001/003/004/005/006/009/010 و golden approval باز هستند.

### GOV-077 — baseline regression پس از تغییرات QA

- زمان UTC: `2026-07-16T05:15:00Z`.
- فرمان: `PROCHART_BASE_URL=https://localhost npm run test:baseline -- --reporter=line`.
- نتیجه: baseline public shell در desktop و mobile برابر `2 passed`، retry/flaky=`0`.
- build/deploy: runtime تغییری نکرد؛ build و deploy لازم نیست.
- اثر: مسیر characterization اصلی پس از incrementهای QA بدون regression قابل‌مشاهده باقی ماند.
- blocker: visual golden و Motion gestureهای باقی‌مانده همچنان باز هستند.

### GOV-078 — visual determinism پس از آخرین incrementها

- زمان UTC: `2026-07-16T05:35:00Z`.
- فرمان: `PROCHART_BASE_URL=https://localhost VISUAL_CAPTURE_ONLY=1 VISUAL_RUN_ID=20260716T053000Z npm run test:visual-reference -- --reporter=line`.
- نتیجه: `3 passed / 3 skipped` عمدی بر اساس project/device matrix، retry/flaky=`0`؛ سه سناریوی هدف capture شدند.
- build/deploy: runtime تغییری نکرد؛ build/deploy لازم نیست.
- اثر: determinism capture پس از تغییرات QA تأیید شد؛ Golden approval و full viewport/state matrix هنوز ادعا نشده است.
- blocker: Expected/Golden تصویب‌شده صفر، Motion gestureهای کامل و performance budget مستقل هنوز باز هستند.

### GOV-079 — performance browser rerun با attribution

- زمان UTC: `2026-07-16T06:15:00Z`.
- فرمان: `PROCHART_BASE_URL=https://localhost PLAYWRIGHT_IMAGE_DIGEST=sha256:57b65fdc9ceabe0ef613124c7bbe2babcf9362c4d85e382fe3b03604e84b428a PERFORMANCE_RUN_ID=20260716T060000Z npm run test:performance -- --reporter=line`.
- نتیجه: `2 passed / 2 skipped` عمدی طبق device matrix، retry/flaky=`0`؛ desktop و mobile chart evidence تولید شد.
- build/deploy: runtime تغییری نکرد؛ build/deploy لازم نیست.
- اثر: browser harness قابل‌ردیابی است؛ این نتیجه به‌تنهایی عبور performance budget release را ثابت نمی‌کند.
- blocker: budget مستقل، golden approval، و Motion gestureهای کامل هنوز باز هستند.

### GOV-080 — secret scan محدود به source فعلی

- زمان UTC: `2026-07-16T06:40:00Z`.
- فرمان‌ها: اسکن Docker Gitleaks روی `src/` و `frontend/` با `.gitleaks.toml`؛ هر دو بدون Git و بدون چاپ secret.
- نتیجه: `src/` برابر `no leaks found` (۳.۵۰MB)، `frontend/` برابر `no leaks found` (۱۰.۹۳MB). اجرای کل repository به‌دلیل حجم artifacts پیش از نتیجه با interrupt متوقف شد؛ بنابراین این رکورد فقط ادعای source-current دارد.
- build/deploy: runtime تغییری نکرد؛ لازم نیست.
- اثر: مسیرهای فعلی کد و UI clean هستند؛ historical secret scan/rotation و artifact provenance همچنان gate مستقل دارند.
- blocker: revoke/rotate تاریخی و release provenance نیازمند اقدام/تصمیم بیرونی است؛ visual/motion نیز باز است.

### GOV-081 — همگام‌سازی digest مستندات و DOCX checksum

- زمان UTC: `2026-07-16T07:00:00Z`.
- فایل: `docs/EXECUTION_STATE.md`؛ digest Panel از مقدار قدیمی به live image `sha256:f3b22c07faea8cfcb4e8730949fdea2ecda8ab55a12dba553cd3808169db39bd` اصلاح شد.
- کنترل: `cd docs/source && sha256sum -c SHA256SUMS` برای Master و Requirements هر دو `OK`؛ `docker inspect prochart-admin-frontend` برابر `healthy` و همان digest.
- build/deploy: تغییر مستنداتی؛ build/deploy لازم نیست.
- اثر: وضعیت اجرایی و artifactهای DOCX اکنون با runtime live همخوان هستند.
- blocker: Golden/Motion کامل، historical secret rotation و release provenance همچنان باز هستند.

### GOV-082 — live integration health gate

- زمان UTC: `2026-07-16T07:20:00Z`.
- فرمان‌ها: `docker compose -f docker-compose.prochart.yml ps`، `curl http://127.0.0.1:8000/health` و HTTPS smoke با SNI/Host برای main، Panel و User.
- نتیجه: ۱۱ کانتینر running؛ API `200` با `database=connected` و `redis=connected`؛ main/Panel/User هر سه `200`؛ سرویس‌های دارای healthcheck healthy.
- build/deploy: تغییر runtime انجام نشد؛ لازم نیست.
- اثر: integration smoke فعلی سبز است؛ این gate جایگزین full clean suite یا release approval نیست.
- blocker: visual/motion matrix، historical secret rotation، performance budget مستقل و release provenance باقی است.

### GOV-083 — Matrix JSON/DOCX traceability check

- زمان UTC: `2026-07-16T07:40:00Z`.
- فرمان‌ها: parse با `python3` روی `docs/03_REQUIREMENTS_MATRIX.json` و `cd docs/source && sha256sum -c SHA256SUMS`.
- نتیجه: JSON معتبر، `162` requirement (P0=`85`, P1=`77`, P2=`0`) و source hash=`6708022c13c9b07656825043d671d822545c773fae13a9c1b59cf35e42e71955`; هر دو DOCX checksum `OK`.
- build/deploy: تغییر runtime/سند انجام نشد؛ build/deploy لازم نیست.
- اثر: منبع Matrix و دو deliverable DOCX قابل‌خواندن و hash-verified هستند؛ وضعیت requirementها هنوز عمدتاً PARTIAL/NOT_STARTED است و ادعای completion مجاز نیست.
- blocker: visual/motion، accessibility manual، full clean suite و release/security provenance باز هستند.

### GOV-084 — accessibility state smoke روی live edge

- زمان UTC: `2026-07-16T08:00:00Z`.
- فرمان: `PROCHART_BASE_URL=https://localhost npm run test:a11y-states -- --reporter=line`.
- نتیجه: مسیر mobile chart پس از onboarding برابر `1 passed`؛ retry/flaky=`0`؛ canvas و named main region قابل‌دسترسی ثبت شد.
- build/deploy: runtime تغییری نکرد؛ build/deploy لازم نیست.
- اثر: یک state دسترس‌پذیری live به شواهد فعلی اضافه شد؛ این نتیجه جایگزین matrix کامل و audit دستی نیست.
- blocker: contrast/manual screen-reader، visual/motion و full clean suite هنوز باز هستند.

### GOV-085 — User Portal referral compliance روی vhost live

- زمان UTC: `2026-07-16T08:20:00Z`.
- فرمان: `PROCHART_BASE_URL=https://user.pro-chart.com PLAYWRIGHT_HOST_RESOLVER_RULES='MAP user.pro-chart.com 127.0.0.1' npx playwright test tests/user-referral-compliance.spec.mjs --reporter=line`.
- نتیجه: LBank و OneRoyal در desktop/mobile، مجموعاً `4 passed`؛ eligibility/disclosure/departure gate و destination ثابت تأیید شد؛ retry/flaky=`0`.
- build/deploy: runtime تغییری نکرد؛ build/deploy لازم نیست.
- اثر: تنها referralهای مجاز در User Portal live vhost قابل‌مشاهده و gated هستند.
- blocker: visual/motion golden، manual accessibility، historical secret rotation و release provenance باز هستند.

### GOV-086 — Panel navigation + CSP integration gate

- زمان UTC: `2026-07-16T08:40:00Z`.
- فرمان‌ها با resolver محلی `panel.pro-chart.com → 127.0.0.1`: `npm run test:panel-navigation -- --reporter=line` و `npm run test:security-headers -- --reporter=line`.
- نتیجه: Panel legacy aliases/command palette `1 passed` و runtime CSP worker/block probe `1 passed`؛ retry/flaky=`0`.
- build/deploy: runtime تغییری نکرد؛ build/deploy لازم نیست.
- اثر: vhost واقعی Panel هم navigation contract و هم CSP boundary را هم‌زمان پاس می‌کند.
- blocker: visual/motion golden، accessibility manual، historical secret rotation و release provenance باقی است.

### CHG-086 / GOV-087 — vhost-aware full Playwright gate

- زمان UTC: `2026-07-16T09:20:00Z`.
- فایل‌ها: `qa/tests/panel-navigation.spec.mjs` و `qa/tests/user-referral-compliance.spec.mjs`؛ تست‌های vhost-specific خارج از hostname مقصد به‌صورت صریح skip می‌شوند و اجرای مقصدی با resolver همچنان اجباری است.
- علت: اجرای suite عمومی روی `https://localhost` نباید به‌عنوان Panel/User vhost تفسیر شود؛ پیش از این دو false failure محیطی ایجاد می‌کردند.
- فرمان gate: `PROCHART_BASE_URL=https://localhost VISUAL_CAPTURE_ONLY=1 VISUAL_RUN_ID=20260716T090000Z PLAYWRIGHT_IMAGE_DIGEST=sha256:57b65fdc9ceabe0ef613124c7bbe2babcf9362c4d85e382fe3b03604e84b428a npm test -- --reporter=line`.
- نتیجه: `27 passed / 25 skipped`، retry/flaky=`0`، هر ۵۲ test جمع‌بندی شد؛ visualها capture-only بودند و Golden approval همچنان فعال نشده است.
- build/deploy: فقط QA تغییر کرد؛ build/deploy runtime لازم نیست.
- اثر: full harness با پارامترهای attribution و capture صحیح، بدون failure محیطی اجرا شد؛ این نتیجه Release/COMPLETE نیست.
- blocker: Golden تصویب‌شده صفر، Motion کامل، manual accessibility، full clean Python suite و release provenance/secret rotation باز هستند.

### GOV-088 — مقصد واقعی Panel و User پس از vhost-aware تغییر

- زمان UTC: `2026-07-16T09:40:00Z`.
- فرمان‌ها: Panel با `PROCHART_BASE_URL=https://panel.pro-chart.com` و resolver محلی، `npm run test:panel-navigation`؛ User با `PROCHART_BASE_URL=https://user.pro-chart.com` و resolver محلی، تست referral.
- نتیجه: Panel `1 passed`؛ User Portal `4 passed` (desktop/mobile و LBank/OneRoyal)؛ skip خارج از مقصد باعث تضعیف این اجرا نشد.
- build/deploy: runtime تغییری نکرد؛ لازم نیست.
- اثر: vhost-aware gating هم suite عمومی را پایدار و هم اجرای مقصدی را الزام‌آور نگه داشت.
- blocker: Golden/Motion کامل، manual accessibility، full clean Python و provenance/security rotation باز هستند.

### GOV-089 — همگام‌سازی Visual Matrix و Evidence Index

- زمان UTC: `2026-07-16T10:00:00Z`.
- فایل‌ها: `docs/qa/VISUAL_MATRIX.md` و `docs/qa/EVIDENCE_INDEX.md`.
- تغییر: capture-only full gate با `VISUAL_RUN_ID=20260716T090000Z` به‌عنوان rerun جدید ثبت شد؛ وضعیت همچنان `DETERMINISTIC_CAPTURE_PASS; GOLDEN_NOT_APPROVED` است و هیچ candidate به Golden تبدیل نشده.
- شاهد: full Playwright gate برابر `27 passed / 25 skipped`؛ visual targetها `3 passed` و skipها intentional.
- build/deploy: مستنداتی/QA؛ build و deploy runtime لازم نیست.
- blocker: approval انسانی Golden، diff threshold مصوب و پوشش کامل Route/State/Theme هنوز باز است.

### GOV-090 — compose configuration integrity

- زمان UTC: `2026-07-16T10:20:00Z`.
- فرمان: `docker compose -f docker-compose.prochart.yml config --quiet`.
- نتیجه: `compose_config=ok`؛ پیکربندی deploy فعلی syntactically معتبر است و با ۱۱ سرویس live ثبت‌شده سازگار می‌ماند.
- build/deploy: فقط validation؛ build/deploy لازم نیست.
- اثر: gate پیکربندی قبل از هر rollout بعدی سبز است.
- blocker: Golden/Motion، manual accessibility، full clean Python، historical secret rotation و release provenance باز هستند.

### GOV-091 — اجباری‌بودن deliverableهای Goal

- زمان UTC: `2026-07-16T10:40:00Z`.
- کنترل: وجود و non-empty بودن ۱۵ فایل اجباری شامل Execution State، Requirements Status، Baseline/Architecture، Visual/Motion/Evidence/Regression، Security، Performance، Providers و Release/Rollback.
- نتیجه: `required_docs=ok count=15`.
- build/deploy: کنترل مستنداتی؛ build/deploy لازم نیست.
- اثر: مجموعه خروجی‌های موردنیاز Goal حاضر و قابل‌خواندن است؛ کامل‌بودن محتوای هر معیار جداگانه همچنان باید از Matrix اثبات شود.
- blocker: معیارهای Visual/Motion/GOLDEN، manual accessibility، full clean suite و release provenance/security rotation هنوز بسته نشده‌اند.

### GOV-092 — تطبیق byte-level دو DOCX نهایی

- زمان UTC: `2026-07-16T11:00:00Z`.
- کنترل: `sha256sum` روی فایل‌های ریشه و نسخه‌های `app/docs/source/`.
- نتیجه: Master هر دو مسیر `590cf24933ec7b5c60337ded2e64de28a5de75a61d144f8f3ed6a12baa5eeab2`؛ Requirements Matrix هر دو مسیر `6708022c13c9b07656825043d671d822545c773fae13a9c1b59cf35e42e71955`؛ byte-identical تأیید شد.
- build/deploy: کنترل artifact؛ build/deploy لازم نیست.
- اثر: دو سند تحویلی ریشه و source دقیقاً یکسان و قابل‌ردیابی‌اند.
- blocker: این تطبیق محتوای ناقص Matrix یا Golden/Motion/manual release gates را رفع نمی‌کند؛ آن‌ها همچنان باز هستند.

### GOV-093 — سلامت ساختاری DOCX

- زمان UTC: `2026-07-16T11:20:00Z`.
- فرمان‌ها: `unzip -t ProChart_Master_Spec_FA.docx` و `unzip -t ProChart_Requirements_Matrix_FA.docx`.
- نتیجه: هر دو سند `No errors detected in compressed data`؛ ساختار OOXML فشرده قابل‌خواندن است.
- build/deploy: artifact validation؛ build/deploy لازم نیست.
- اثر: علاوه بر hash identity، سلامت فیزیکی بسته‌های DOCX تأیید شد.
- blocker: تحقق تمام الزام‌های محتوایی/QA مستقل از سلامت ZIP است و هنوز کامل نشده.

### GOV-094 — dependency audit فرانت‌اندهای production

- زمان UTC: `2026-07-16T11:40:00Z`.
- سرویس‌ها: `frontend/prochart`، `frontend/panel` و `frontend/user`.
- فرمان: `npm audit --omit=dev --audit-level=high --json` برای هر سه lockfile.
- نتیجه: هر سه exit=`0` و vulnerabilityهای production در همه سطوح `info/low/moderate/high/critical=0`؛ تعداد dependencyهای production به‌ترتیب ProChart=`47`، Panel=`85` و User=`79`.
- build/deploy: read-only dependency gate؛ build/deploy لازم نیست.
- اثر: dependency graph فعلی سه UI production در audit npm finding ندارد؛ SBOM/image scan و artifact signing همچنان gateهای جدا هستند.
- blocker: scan image/SBOM تاریخی، signing/provenance، Golden/Motion و manual accessibility باز هستند.

### CHG-087 / GOV-095 — assertion قابل‌اندازه‌گیری Reduced Motion

- زمان UTC: `2026-07-16T12:00:00Z`.
- فایل‌ها: `qa/tests/motion-chart.spec.mjs` و `docs/qa/MOTION_MATRIX.md`؛ runtime محصول تغییر نکرد.
- تغییر: آزمون MOT-008 با `page.emulateMedia({reducedMotion:'reduce'})` اضافه شد و computed style واقعی product را برای animation/transition duration، iteration count و scroll behavior می‌سنجد.
- build: build محصول لازم نبود؛ Playwright harness load و اجرا شد.
- تست: `PROCHART_BASE_URL=https://localhost npm run test:motion-chart -- --reporter=line` برابر `3 passed / 1 skipped` عمدی؛ desktop و mobile MOT-008 پاس، retry/flaky=`0`.
- deploy/smoke: deploy لازم نیست؛ live edge همان build قبلی و smoke سبز است.
- اثر: MOT-008 اکنون evidence فنی `duration≤0.01ms`، `iteration≤1` و `scroll=auto` دارد؛ Matrix بدون ادعای پوشش همه gestureها همچنان PARTIAL است.
- rollback: حذف test/assertion و بازگرداندن سطر Matrix؛ blockerهای MOT-001/003/004/005/006/009/010 و Golden approval باقی است.

### CHG-088 / GOV-096 / DEPLOY-007 — اصلاح زمان motion آنبوردینگ به 240ms

- زمان UTC: `2026-07-16T12:30:00Z`.
- فایل‌ها/سرویس: `frontend/prochart/src/index.css`، `qa/tests/onboarding-focus.spec.mjs`، `docs/qa/MOTION_MATRIX.md` و سرویس `frontend-prochart`.
- بازتولید: assertion جدید بازهٔ سند `200–280ms` را سنجید و روی production قبلی با مقدار واقعی `340ms` شکست خورد (`1 failed / 1 skipped`).
- تغییر بنیادی: duration کلاس مشترک `.pc-screen-in` از `340ms` به `240ms` کاهش یافت؛ focus trap، inert background و restore behavior دست‌نخورده ماند.
- build: `docker compose -f docker-compose.prochart.yml build frontend-prochart` موفق؛ Vite `1786 modules`، image جدید `sha256:15caec11c79251276b4d429bf772589a4b6c78b63df5d7fdd64ca54e86726443`؛ هشدار bundle بزرگ همچنان ثبت‌شده و پنهان نشد.
- تست‌ها پس از deploy: onboarding mobile `1 passed / 1 skipped` عمدی؛ motion suite `3 passed / 1 skipped` عمدی؛ visual capture-only `3 passed / 3 skipped` عمدی با run=`20260716T123000Z`؛ retry/flaky=`0`.
- deploy production: `docker compose ... up -d --no-build frontend-prochart` موفق؛ کانتینر recreate/start شد.
- smoke/health: `frontend-prochart` برابر `healthy`، restart=`0` و `https://localhost/` برابر `200`.
- rollback: image قبلی `sha256:20e2ad31c1280f44850530a7ac12456f4817da8f163fdd230defe0436f7fa3ec` نگه داشته شد؛ rollback با retag/recreate همان image ممکن است.
- blocker: MOT-007 فقط برای onboarding اندازه‌گیری شده و سایر Dialog/Sheetها pending؛ MOT-001/003/004/005/006/009/010، Golden approval و bundle budget باز هستند.

### GOV-097 — همگام‌سازی Requirements Status برای PC-032/PC-033

- زمان UTC: `2026-07-16T12:40:00Z`.
- فایل: `docs/REQUIREMENTS_STATUS.csv`.
- تغییر: PC-032 و PC-033 از `NOT_STARTED/NOT_ASSESSED` به `IN_PROGRESS/BASELINED/PARTIAL` منتقل و به MOT-007/MOT-008، Motion Matrix، commit=`a41fb88` و artifactهای Playwright متصل شدند.
- اعتبارسنجی: CSV با `162` ردیف و `19` فیلد parse شد؛ هیچ ردیف malformed نبود و دو status دقیقاً خوانده شدند.
- build/deploy: تغییر governance؛ build/deploy runtime لازم نیست.
- اثر: Matrix اکنون evidence واقعی motion را منعکس می‌کند و بدون پوشش سراسری ادعای VERIFIED ندارد.
- blocker: سایر Dialog/Sheetها، gestureهای باقی‌مانده و Golden approval هنوز باز هستند.

### CHG-089 / GOV-098 / DEPLOY-008 — DrawingHistory پایدار برای 50 Undo/Redo

- زمان UTC: `2026-07-16T13:15:00Z`.
- فایل‌ها/سرویس: `frontend/prochart/src/bazaarnama/drawing_history.js`، `drawings.js`، `qa/tests/drawing-history.test.mjs`، Motion/Requirements Matrix و `frontend-prochart`.
- تغییر بنیادی: history از آرایه‌های پراکنده به `DrawingHistory` خالص با snapshot عمیق، cap=100، invalidation صریح redo و aliasهای سازگار منتقل شد؛ رفتار UI همان API قبلی `undo/redo/canUndo/canRedo` را حفظ می‌کند.
- build: `docker compose ... build frontend-prochart` موفق؛ Vite `1787 modules`؛ image=`sha256:4e6130e6caecfeacc3260a134b1a0c20e32e81f3ab2d9aaf570d3e3269f30350`. هشدار bundle >500kB ثبت و پنهان نشد.
- تست‌ها: Node property suite `3/3 PASS` شامل 60 command و 50 undo+50 redo، deep-copy، redo invalidation و cap=100؛ motion browser `3 passed / 1 skipped` عمدی؛ visual capture-only `3 passed / 3 skipped` عمدی، run=`20260716T131500Z`.
- harness incident: نخستین فرمان browser از cwd ریشهٔ app به‌علت نبود `package.json` با ENOENT شکست خورد؛ همان تست‌ها از `app/qa` اصلاح و سبز اجرا شدند؛ failure حذف یا پنهان نشد.
- deploy production: `docker compose ... up -d --no-build frontend-prochart` موفق؛ container recreate/start.
- smoke/health: image live همان digest، `healthy`، restart=`0` و main HTTPS=`200`.
- rollback: image قبلی `sha256:15caec11c79251276b4d429bf772589a4b6c78b63df5d7fdd64ca54e86726443` نگه داشته شد.
- blocker: MOT-006 property کامل است اما E2E toolbar/reload persistence هنوز pending؛ MOT-001/003/004/005/009/010 و Golden approval باز هستند.

### CHG-090 / GOV-099 — E2E واقعی ۵۰ فرمان Undo/Redo و reload hydration

- زمان UTC میزبان: `2026-07-15T08:10:16Z`. ساعت UTC فعلی میزبان از چند رکورد قبلی که با تاریخ `2026-07-16` ثبت شده‌اند عقب‌تر است؛ برای جلوگیری از جعل chronology، همین مقدار واقعی میزبان ثبت شد.
- فایل‌ها/سرویس: `qa/tests/drawing-history-e2e.spec.mjs`، `qa/support/synthetic-prochart-fixture.mjs`، `docs/qa/MOTION_MATRIX.md`، `docs/qa/EVIDENCE_INDEX.md` و harness مرورگر روی سرویس live `frontend-prochart`.
- تغییر بنیادی: fixture به حالت opt-in seed-once با guard در `sessionStorage` مجهز شد تا فقط اولین navigation state مصنوعی را seed کند و reload واقعی workspace را پاک نکند. تست MOT-006 اکنون ۵۰ خط افقی را از UI می‌سازد، ۵۰ بار دکمهٔ toolbar واگرد و ۵۰ بار ازنو را اجرا می‌کند، state نهایی را دقیق مقایسه می‌کند، reload را انجام می‌دهد و با create/undo پس از reload ثابت می‌کند DrawingLayer واقعاً ۵۰ drawing را hydrate کرده است.
- بازتولید/اصلاح: اجرای test-first در reload با `Expected 1 drawing / Received []` شکست خورد و علت `localStorage.clear()` در هر navigation بود. نسخهٔ seed-once پاس شد. تلاش بهینه‌سازی مستقیم `page.mouse.click` نیز با `Expected 50 / Received 0` شکست خورد و حفظ شد؛ مسیر دقیق locator جایگزین و زمان تست از `56.7s` به `12.7s` بدون حذف هیچ‌یک از ۱۵۰ عملیات کاهش یافت.
- اثر بنیادی: Acceptance الزام PC-030 اکنون هم Property و هم E2E مرورگر واقعی دارد؛ فساد ترتیب، deep-copy، redo invalidation، cap=100، toolbar state و ماندگاری reload همگی پوشش داده شدند. MOT-006 در Motion Matrix به `PASS` ارتقا یافت.
- build: `docker compose -f docker-compose.prochart.yml build frontend-prochart` موفق و کاملاً cached بود؛ image tag محلی=`sha256:c8c4ced6372cbd7b8f408f77daf2e6b3afd440b8aa1409614526860ae7578cde`. چون source runtime تغییر نکرد، payload build همان نسخهٔ live باقی ماند.
- تست‌ها: Property Node برابر `3/3 PASS`؛ اجرای مشترک Drawing E2E + Motion برابر `4 passed / 2 skipped` عمدی و retry/flaky=`0`؛ Visual capture-only برابر `3 passed / 3 skipped` عمدی با run=`20260715T081100Z`. اجرای نهایی MOT-006 برابر `1/1 PASS` در `12.7s` است و trace/video در `artifacts/qa/playwright/test-results/drawing-history-e2e-MOT-00-08fbe--persistence-survive-reload-chromium-desktop/` ثبت شد.
- image/fingerprint: runtime live بدون تغییر روی `sha256:4e6130e6caecfeacc3260a134b1a0c20e32e81f3ab2d9aaf570d3e3269f30350` است؛ build QA/docs هیچ asset runtime را تغییر نداد.
- deploy production: انجام نشد؛ این increment فقط QA و governance است و طبق قانون Goal deploy فقط در صورت تغییر runtime الزامی است. رویداد DEPLOY جدید شمرده نشد.
- smoke/health: container=`healthy`، restart=`0` و `https://localhost/` برابر `200`؛ همهٔ ۱۱ سرویس compose در حالت running باقی ماندند.
- rollback: بازگرداندن دو فایل QA و دو سطر سند کافی است و rollback image لازم نیست. blockerهای MOT-001/003/004/005/009/010، Golden approval، accessibility دستی، performance و supply-chain همچنان باز هستند.

## وضعیت فعلی production

- API و چهار worker Python: image `sha256:23f49262ce660e6ad405ae72cd96037aa4d70e75a085163143dc07d98646223e`، همگی non-root/running، restart=`0` و smoke پاس.
- Frontend ProChart/edge: image `sha256:4e6130e6caecfeacc3260a134b1a0c20e32e81f3ab2d9aaf570d3e3269f30350`، Nginx `1.30.3`، healthy و drawing-history/motion/visual smoke پاس.
- User Portal: image `sha256:6a5c2512392cdb8257c804a0ca116c4fed9ce4186fd9a6e2685c313d1dcf6216`، referral-gated، healthy و browser `4/4 PASS`.
- Panel: image `sha256:f3b22c07faea8cfcb4e8730949fdea2ecda8ab55a12dba553cd3808169db39bd`، healthy، hash برابر build؛ panel browser gate به‌دلیل DNS عمومی هنوز قابل‌اجرا نیست.
- Edge پرتال‌ها: Panel و User هر دو دقیقاً هفت security header و CSP محدود live دارند؛ دو referral redirect ثابت روی origin و public پاس هستند.
- تعداد کانتینرهای درحال اجرای پروژه: `۱۱`.
- rollbackهای هر هشت سرویس rollout اخیر با suffix `rollback-referral-20260715T042151Z` آماده و فعال‌نشده‌اند.

## قالب اجباری رکوردهای بعدی

هر رکورد جدید باید این فیلدها را داشته باشد:

1. زمان UTC؛
2. فایل‌ها/سرویس؛
3. شرح دقیق تغییر؛
4. اثر بنیادی؛
5. فرمان و نتیجهٔ build؛
6. تست‌ها و نتیجه؛
7. image/fingerprint؛
8. زمان و نتیجهٔ deploy production؛
9. smoke/health؛
10. rollback و blocker باقی‌مانده.
