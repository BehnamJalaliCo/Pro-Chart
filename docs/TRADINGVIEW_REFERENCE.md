# مرجعِ کاملِ TradingView برای بازارنما — کاتالوگِ فیچرها + چک‌لیستِ پیاده‌سازی

> **هدفِ این فایل:** منبعِ واحدِ حقیقت برای کلودِ سرور. هر بخش، ابزار و قابلیتِ TradingView
> این‌جا به‌صورتِ **چک‌لیستِ قابلِ‌پیاده‌سازی** فهرست شده، با **نگاشت به بازارنما** و **وضعیتِ فعلی**.
> کلودِ سرور باید فیچر به فیچر این فایل را بخواند و در `frontend/academy/src/bazaarnama/` پیاده کند.
>
> **علائمِ وضعیت:** ✅ کامل · ◑ ناقص/پایه · ☐ نساخته
> **آخرین به‌روزرسانی:** ۲۰۲۶-۰۶-۲۲ (بر اساسِ منابعِ عمومیِ TradingView — رجوع به انتهای فایل)
>
> ⚠️ **قاعدهٔ حقوقی:** ما **فیچر و رفتار** را بازتولید می‌کنیم، نه کدِ اختصاصیِ TradingView را.
> موتورِ ما **lightweight-charts** (متن‌بازِ خودِ TradingView، مجاز) است. زبانِ ما «نمااسکریپت»
> الهام‌گرفته از Pine است، نه کپیِ آن.

---

## فهرستِ مطالب
1. چیدمانِ کلیِ رابط (UI Shell)
2. انواعِ چارت (Chart Types)
3. تایم‌فریم‌ها و محورها
4. ابزارهای ترسیم (Drawing Tools) — ۱۱۰+
5. اندیکاتورها (Indicators) — ۴۰۰+
6. نمااسکریپت / Pine Script ← جزئیات در `PINESCRIPT_REFERENCE.md`
7. آلارم‌ها (Alerts)
8. واچ‌لیست، اسکرینر، جزئیات
9. بخش‌های لایو / Real-time
10. بازپخش (Bar Replay) و معامله از روی چارت
11. چیدمانِ چندگانه و تنظیمات
12. داده، کارایی، موبایل
13. جمع‌بندیِ شکافِ فعلی

---

## ۱) چیدمانِ کلیِ رابط

TradingView پنج ناحیهٔ ثابت دارد. بازارنما هم همین ساختار را دارد.

| ناحیه | محتوای TradingView | وضعیتِ بازارنما |
|---|---|---|
| **نوارِ بالا (Top Toolbar)** | سرچِ نماد، تایم‌فریم، نوعِ چارت، اندیکاتورها، آلارم، Replay، چیدمان، تنظیمات، تمام‌صفحه، Publish | ✅ کامل |
| **نوارِ ابزارِ چپ (Left Toolbar)** | گروه‌های ابزارِ ترسیم (عمودی)، رنگ، مگنت، قفل، مخفی، Object Tree | ◑ ۱۲ ابزار بدونِ گروه‌بندیِ منویی |
| **چارتِ مرکزی (Chart Area)** | چارتِ چندپنلی + کراسهر + لجند + watermark | ✅ pane نیتیوِ v5 |
| **پنلِ راست (Right Panel)** | واچ‌لیست، Details، Alerts، News، DOM، Hotlists | ◑ واچ/AI/اسکنر/ترید/آلارم |
| **نوارِ پایین (Bottom Panel)** | Pine Editor، Stock Screener، Strategy Tester، Paper Trading، Text Notes | ◑ فقط استودیوی نمااسکریپت |

**چک‌لیست:**
- [x] چهار/پنج ناحیهٔ اصلی موجود است
- [ ] گروه‌بندیِ منوییِ ابزارِ ترسیم در نوارِ چپ (مثلِ TV که هر آیکن یک زیرمنو دارد)
- [ ] Object Tree (درختِ مدیریتِ همهٔ آبجکت‌های روی چارت)
- [ ] تبِ News و تبِ Hotlists در پنلِ راست
- [ ] نوارِ پایینِ تب‌دار (Pine/Screener/Tester/Paper در تب‌های جدا)

---

## ۲) انواعِ چارت

TradingView **۲۱+ نوع چارت** دارد. فهرستِ کامل:

| # | نوع | توضیح | بازارنما |
|---|---|---|---|
| 1 | **Bars (OHLC)** | میلهٔ کلاسیک | ✅ |
| 2 | **Candles** | کندلِ استاندارد | ✅ |
| 3 | **Hollow Candles** | کندلِ توخالی (بسته به جهت) | ✅ |
| 4 | **Volume Candles** | کندل با پهنای متناسبِ حجم | ☐ |
| 5 | **Line** | خطِ بسته‌شدن | ✅ |
| 6 | **Line with markers** | خط با نقطهٔ هر کندل | ☐ |
| 7 | **Step Line** | خطِ پلکانی | ✅ |
| 8 | **Area** | ناحیه‌ای | ✅ |
| 9 | **HLC Area** | ناحیهٔ High-Low-Close | ☐ |
| 10 | **Baseline** | دوطرفه نسبت به خطِ مبنا | ✅ |
| 11 | **Columns** | ستونی | ☐ |
| 12 | **High-Low** | فقط سقف/کف | ☐ |
| 13 | **Heikin Ashi** | کندلِ هموارشدهٔ ژاپنی | ✅ |
| 14 | **Renko** | آجری (مستقل از زمان) | ☐ |
| 15 | **Line Break** | شکستِ خط (جعبه‌های عمودی) | ☐ |
| 16 | **Kagi** | خطِ پیوستهٔ تغییرِ جهت | ☐ |
| 17 | **Point & Figure** | X/O (مستقل از زمان) | ☐ |
| 18 | **Range** | کندل بر اساسِ بازهٔ قیمت | ☐ |

**نکتهٔ فنی:** انواعِ ۱۴–۱۸ «non-standard» هستند و **داده را بازنویسی می‌کنند** (نه نگاشتِ ساده).
نیاز به توابعِ ساختِ آجر/جعبه/ستون از سری OHLC دارند. اولویت: Renko → Range → Point&Figure.

**چک‌لیست:**
- [x] ۸ نوعِ پایه (Bars, Candles, Hollow, Line, Step, Area, Baseline, Heikin Ashi)
- [ ] Renko (با اندازهٔ آجرِ ATR/Traditional)
- [ ] Line Break (تعدادِ خطِ تنظیم‌پذیر)
- [ ] Kagi (Reversal amount)
- [ ] Point & Figure (Box size + Reversal)
- [ ] Range, Columns, High-Low, HLC Area, Volume Candles

---

## ۳) تایم‌فریم‌ها و محورها

**تایم‌فریم‌های TradingView:** از ۱ ثانیه تا ماهانه + Range bars + سفارشی
`1s 5s 10s 15s 30s · 1m 3m 5m 15m 30m 45m · 1h 2h 3h 4h · 1D 1W 1M 3M 6M 12M`

| قابلیت | TradingView | بازارنما |
|---|---|---|
| تایم‌فریم‌ها | ۲۰+ از ثانیه تا ماهانه | ◑ M5/M15/H1/H4/D1 (۵ تا — محدود به دادهٔ موجود) |
| تایم‌فریمِ سفارشی | بله | ☐ |
| اسکیلِ قیمت: Regular | بله | ✅ |
| اسکیلِ قیمت: Logarithmic | بله | ✅ |
| اسکیلِ قیمت: Percent | بله | ✅ |
| اسکیلِ قیمت: Indexed to 100 | بله | ☐ |
| Auto / Lock scale | بله | ◑ |
| چند مقیاسِ قیمتِ هم‌زمان (دوگانه) | بله | ☐ |
| Invert scale | بله | ☐ |
| کراسهر: Cross/Dot/Arrow/Hidden | بله | ◑ فقط Cross |
| شمارشِ معکوسِ بسته‌شدنِ کندل | بله | ☐ |
| نشانگرِ سشن‌ها (London/NY/Tokyo) روی محور | بله | ☐ |

**چک‌لیست:**
- [ ] افزودنِ تایم‌فریم‌های بیشتر (نیاز به دادهٔ M1/W1/MN در `candles`)
- [ ] Indexed scale + دو مقیاسِ هم‌زمان
- [ ] شمارشِ معکوسِ کندل + خطِ سشن‌ها

---

## ۴) ابزارهای ترسیم

TradingView **۱۱۰+ ابزار** در ۸ گروه دارد. فهرستِ **کاملِ** هر گروه (مرجعِ پیاده‌سازی).
بازارنما الان ۱۲ ابزار روی Canvas overlay دارد؛ هدف رساندن به این فهرست است.

### ۴.۱ مکان‌نماها (Cursors)
- [ ] Cross · [ ] Dot · [ ] Arrow · [ ] Demonstration · [ ] Magic (انتخابِ هوشمند) · [ ] Eraser
- ✅ بازارنما: نشانگرِ پایه (cursor) دارد.

### ۴.۲ خطوط و روند (Lines)
| ابزار | بازارنما |
|---|---|
| Trend Line | ✅ |
| Ray (شعاع) | ✅ |
| Info Line (با فاصله/درصد) | ☐ |
| Extended Line (دوسر بی‌نهایت) | ☐ |
| Trend Angle | ☐ |
| Horizontal Line | ✅ |
| Horizontal Ray | ☐ |
| Vertical Line | ✅ |
| Cross Line (افقی+عمودی هم‌زمان) | ☐ |

### ۴.۳ کانال‌ها و چنگال‌ها (Channels / Pitchforks)
- [✅] Parallel Channel (کانالِ موازی)
- [ ] Regression Trend (کانالِ رگرسیون)
- [ ] Flat Top/Bottom
- [ ] Disjoint Channel
- [✅] Andrews Pitchfork (چنگالِ کلاسیک)
- [ ] Schiff Pitchfork · [ ] Modified Schiff · [ ] Inside Pitchfork

### ۴.۴ فیبوناچی (Fibonacci) — ۱۱ ابزار
| ابزار | بازارنما |
|---|---|
| Fib Retracement | ✅ |
| Trend-Based Fib Extension | ✅ |
| Fib Channel | ☐ |
| Fib Time Zone | ☐ |
| Fib Speed Resistance Fan | ☐ |
| Trend-Based Fib Time | ☐ |
| Fib Circles | ☐ |
| Fib Spiral | ☐ |
| Fib Speed Resistance Arcs | ☐ |
| Fib Wedge | ☐ |
| Pitchfan | ☐ |

### ۴.۵ گن (Gann)
- [ ] Gann Box · [ ] Gann Square Fixed · [ ] Gann Square · [ ] Gann Fan

### ۴.۶ الگوها (Patterns)
- [ ] XABCD Pattern · [ ] Cypher Pattern · [ ] ABCD Pattern · [ ] Triangle Pattern
- [ ] Three Drives · [ ] Head and Shoulders · [ ] Elliott Impulse Wave (12345)
- [ ] Elliott Correction (ABC) · [ ] Elliott Triangle/Double/Triple Combo
- [ ] Cyclic Lines · [ ] Time Cycles · [ ] Sine Line

### ۴.۷ پیش‌بینی و اندازه‌گیری (Projection / Measurement)
| ابزار | بازارنما |
|---|---|
| Long Position (ریسک/ریوارد) | ✅ |
| Short Position | ✅ |
| Forecast | ☐ |
| Bars Pattern | ☐ |
| Ghost Feed | ☐ |
| Projection | ☐ |
| Price Range | ☐ |
| Date Range | ☐ |
| Date and Price Range | ☐ |
| Anchored VWAP | ☐ |
| Fixed Range Volume Profile | ◑ (VP کلی هست، Anchored نیست) |
| Anchored Volume Profile | ☐ |

### ۴.۸ اشکالِ هندسی (Shapes)
- [✅] Rectangle · [ ] Rotated Rectangle · [ ] Circle · [ ] Ellipse · [ ] Triangle
- [ ] Arc · [ ] Curve · [ ] Double Curve · [ ] Path · [ ] Polyline
- [ ] Brush (قلم) · [ ] Highlighter (هایلایتر)

### ۴.۹ علامت‌گذاری (Annotations)
- [✅] Text · [ ] Anchored Text · [ ] Note · [ ] Price Note · [ ] Callout
- [ ] Comment · [ ] Price Label · [ ] Signpost · [ ] Flag Mark · [ ] Pin
- [ ] Table · [ ] Arrow Marker · [ ] Arrow (up/down/left/right) · [ ] Image
- [ ] Icons / Emojis / Stickers (صدها)

### ۴.۱۰ کنترل‌های ابزارِ ترسیم (Toolbar Controls)
- [✅] انتخابِ رنگ · [✅] Magnet (ضعیف) · [ ] Magnet قوی
- [ ] Stay in Drawing Mode (ادامهٔ کشیدن)
- [ ] Lock All Drawings · [ ] Hide All Drawings
- [ ] Sync drawings to all charts
- [ ] Remove Drawings / Remove Indicators (پاکِ گزینشی)
- [✅] Undo آخرین + پاکِ همه
- [ ] **Undo/Redo نامحدود** (تاریخچهٔ کامل)
- [ ] **ویرایش/جابه‌جاییِ آبجکت** با handle (بزرگ‌ترین شکافِ فعلی)
- [ ] دیالوگِ استایلِ هر آبجکت (رنگ/ضخامت/خط‌چین/شفافیت/فونت/متن)
- [ ] Object Tree (لیست + show/hide/lock/delete هر آبجکت)

> **اولویتِ بحرانی:** بازنویسیِ موتورِ ترسیم به سیستمِ «انتخاب + handle + drag + استایل».
> الگوی مرجع: کتابخانهٔ متن‌بازِ `deepentropy/lightweight-charts-drawing` (۶۸ ابزار، دوکلاسه:
> Tool class + PaneView با `IPrimitivePaneView`، و یک `DrawingManager` برای lifecycle/selection/drag).
> این الگو دقیقاً برای lightweight-charts v5 طراحی شده و می‌تواند نقشهٔ معماریِ ما باشد.

---

## ۵) اندیکاتورها

TradingView **۴۰۰+ اندیکاتورِ بیلت‌این** + ۱۰۰هزار اسکریپتِ کامیونیتی دارد.
بازارنما الان **۱۴** اندیکاتور دارد. فهرستِ هدف بر اساسِ دسته:

### ۵.۱ روند / میانگین (Trend / MA)
`SMA ✅` · `EMA ✅` · `WMA ✅` · `HMA ✅` · `VWMA ☐` · `VWAP ✅` · `SMMA/RMA ☐` ·
`DEMA ☐` · `TEMA ☐` · `TRIX ☐` · `SuperTrend ✅` · `Parabolic SAR ☐` ·
`Ichimoku Cloud ☐` · `ADX/DMI ☐` · `Aroon ☐` · `LinReg Curve ☐`

### ۵.۲ مومنتوم / اسیلاتور (Momentum)
`RSI ✅` · `Stochastic ✅` · `Stoch RSI ☐` · `MACD ✅` · `CCI ✅` · `Williams %R ✅` ·
`Momentum ☐` · `ROC ☐` · `Awesome Oscillator ☐` · `Ultimate Oscillator ☐` ·
`TSI ☐` · `SMI Ergodic ☐` · `Connors RSI ☐` · `Fisher Transform ☐`

### ۵.۳ نوسان (Volatility)
`Bollinger Bands ✅` · `Keltner Channel ☐` · `Donchian Channel ☐` · `ATR ✅` ·
`Bollinger %B ☐` · `Bollinger Bandwidth ☐` · `Standard Deviation ☐` · `Envelopes ☐`

### ۵.۴ حجم (Volume)
`Volume ◑` · `OBV ✅` · `Volume Profile (VPVR) ✅` · `Session Volume Profile ☐` ·
`MFI ☐` · `CMF ☐` · `Accumulation/Distribution ☐` · `VWAP Bands ☐` · `Ease of Movement ☐`

### ۵.۵ پیووت / ساختار (Pivots / Structure)
`Pivot Points Standard ☐` · `Pivot Points High Low ☐` · `ZigZag ☐` ·
`Auto Fib Retracement ☐` · `Support & Resistance ☐` · `Supply/Demand Zones ☐`

### ۵.۶ دیالوگِ تنظیماتِ اندیکاتور
| قابلیت | TradingView | بازارنما |
|---|---|---|
| تب Inputs (length/source/…) | ✅ | ◑ فقط اعداد |
| انتخابِ Source (close/hl2/hlc3/اندیکاتورِ دیگر) | ✅ | ☐ |
| تب Style (رنگ/ضخامت/visibility/خط‌چین) | ✅ | ◑ فقط رنگ |
| خطوطِ مرجع (overbought/oversold) قابل‌ویرایش | ✅ | ☐ |
| اعمال روی pane دلخواه + جابه‌جایی بینِ پنل‌ها | ✅ | ☐ |
| Save as Default + Template اندیکاتور | ✅ | ☐ |
| دیالوگِ سرچِ اندیکاتور با تب Built-in/My/Community | ✅ | ◑ منوی ساده |

**چک‌لیست (اولویت‌دار):**
- [ ] Ichimoku, ADX/DMI, Parabolic SAR, Keltner, Donchian (پرکاربردترین‌های غایب)
- [ ] Stoch RSI, MFI, CMF, Awesome Oscillator
- [ ] Pivot Points (همهٔ انواع) + Auto Fib
- [ ] دیالوگِ دوتبِ Inputs/Style کامل + انتخابِ Source

---

## ۶) نمااسکریپت / Pine Script

جزئیاتِ کاملِ زبان در فایلِ جداگانه: **`docs/PINESCRIPT_REFERENCE.md`**.
خلاصهٔ نگاشت:

| محور | Pine Script (TV) | نمااسکریپت (بازارنما) |
|---|---|---|
| مدلِ اجرا | بار-به-بار (هر کندل) | ◑ سری‌محور (vectorized) |
| سری تاریخی `close[1]` | ✅ | ☐ (شکافِ مهم) |
| `var` / حالتِ پایدار | ✅ | ☐ |
| `if/for/while` کنترلِ جریان | ✅ | ◑ (محدود) |
| توابعِ کاربر | ✅ | ◑ |
| `ta.*` | ۵۰+ تابع | ✅ ~۳۰ تابع |
| `math.*` | ✅ | ◑ ~۸ تابع |
| `array/matrix/map` | ✅ | ☐ |
| `str.*` / `color.*` | ✅ | ◑ |
| `request.security` (مولتی‌TF) | ✅ | ☐ |
| `input.*` با UI خودکار | ✅ | ✅ |
| `plot/plotshape/plotchar` | ✅ | ✅ |
| `hline/fill/bgcolor/barcolor` | ✅ | ◑ (fill/barcolor placeholder) |
| `label.new/line.new/box.new/table.new` | ✅ | ◑ فقط label |
| `strategy.*` کامل | ✅ | ◑ entry/exit/close |
| `alertcondition/alert` | ✅ | ✅ alertcondition |
| ویرایشگر | Monaco + autocomplete + داک | ◑ ادیتورِ ساده |
| سندباکس | کلود (سرور) | ✅ Web Worker (امن، تایم‌اوت) |

---

## ۷) آلارم‌ها

TradingView **۱۳ شرطِ بیلت‌این** + آلارمِ ابری دارد.

| قابلیت | TradingView | بازارنما |
|---|---|---|
| منبع: قیمت | ✅ | ✅ (above/below) |
| منبع: اندیکاتور | ✅ | ☐ |
| منبع: خطِ ترسیم | ✅ | ☐ |
| منبع: `alertcondition` اسکریپت | ✅ | ✅ |
| شرط: Crossing / Crossing Up/Down | ✅ | ◑ |
| شرط: Greater/Less than | ✅ | ✅ |
| شرط: Entering/Exiting Channel | ✅ | ☐ |
| شرط: Moving Up/Down by % | ✅ | ☐ |
| تریگر: Once / Every bar / Once per bar close | ✅ | ☐ |
| انقضا (Expiration) | ✅ | ☐ |
| پیامِ سفارشی با متغیر (`{{close}}`) | ✅ | ☐ |
| **ارزیابیِ سمتِ سرور (مستقل از مرورگر)** | ✅ ابری | ✅ Celery (`src/bazaarnama/tasks.py`) |
| تحویل: درون‌اپ | ✅ | ◑ |
| تحویل: ایمیل | ✅ | ☐ |
| تحویل: پوش/اپ | ✅ | ☐ |
| تحویل: تلگرام/وبهوک | وبهوک ✅ | ☐ (می‌توان به ربات وصل کرد) |
| Alert Log (تاریخچه) | ✅ | ◑ |
| صدا | ✅ | ☐ |

**چک‌لیست:** سازندهٔ آلارمِ کامل (منبع×شرط×تریگر×انقضا×پیام) + تحویلِ تلگرام (ربات موجود).

---

## ۸) واچ‌لیست، اسکرینر، جزئیات

| بخش | TradingView | بازارنما |
|---|---|---|
| واچ‌لیست با قیمتِ زنده + تغییر٪ + فلشِ رنگی | ✅ | ✅ |
| چند واچ‌لیستِ نام‌دار + گروه‌بندی + Flag | ✅ | ☐ (یک لیست) |
| ستون‌های قابل‌تنظیم | ✅ | ☐ |
| تبِ Details (قیمت/بازه/تکنیکال/فاندامنتال) | ✅ | ☐ |
| **Stock Screener** (۴۰۰+ فیلتر) | ✅ | ◑ اسکنرِ سادهٔ قیمتِ زنده |
| Forex / Crypto / ETF / Bond Screener | ✅ | ☐ |
| فیلترِ اندیکاتوری در اسکرینر | ✅ | ☐ |
| Heatmap (سهام/کریپتو/ETF) | ✅ | ☐ |
| Hotlists (Gainers/Losers/Active) | ✅ | ☐ |
| اخبار (Reuters/Dow Jones) | ✅ | ☐ |
| تقویمِ اقتصادی (۸۰+ کشور) | ✅ | ☐ |
| تقویمِ Earnings/Dividends | ✅ | ☐ |

**چک‌لیست:** اسکرینرِ فیلتردار (روی همان `candles` + اندیکاتور سمتِ‌سرور) + تبِ Details + اخبار.

---

## ۹) بخش‌های لایو / Real-time

این بخش مهم‌ترین قسمتِ سؤالِ توست — «چه چیزای لایوی دارد».

| قابلیتِ لایو | TradingView | بازارنما | منبعِ داده |
|---|---|---|---|
| قیمتِ تیک‌به‌تیکِ زنده | ✅ WebSocket | ✅ poll هر ۱.۵ث | Redis (`/academy/bn/prices`) |
| کندلِ در حالِ شکل‌گیری (live bar) | ✅ | ✅ | محاسبهٔ کلاینت از تیک |
| خطِ قیمتِ آخر + برچسبِ زنده | ✅ | ✅ (`LIVE`) | — |
| واچ‌لیستِ زنده با فلشِ رنگی | ✅ | ✅ | Redis |
| اسکرینرِ زنده | ✅ | ◑ | Redis |
| نشانگرِ بازار باز/بسته | ✅ | ✅ | Redis (خالی=بسته) |
| شمارشِ معکوسِ بسته‌شدنِ کندل | ✅ | ☐ | — |
| اخبارِ زنده (stream) | ✅ | ☐ | — |
| DOM (عمقِ بازار، Level 2) | ✅ بروکر | ◑ شبیه‌سازی | — |
| P&L زندهٔ پوزیشن روی چارت | ✅ | ☐ | paper-trade |
| WebSocket پوش (به‌جای poll) | ✅ | ◑ آماده ولی proxy نشده | `/ws/prices` (با `VITE_BN_WS`) |
| سیگنالِ AI زنده | ❌ (مخصوصِ ما) | ✅ | LLM + تکنیکال |

**نکتهٔ مهمِ معماری:** TradingView از **WebSocket** برای real-time استفاده می‌کند؛ ما الان **poll هر ۱.۵ث**
داریم که کافی است، ولی برای smoothness و کاهشِ بار، فعال‌سازیِ `/ws/prices` (که کدش آماده است) توصیه می‌شود.

**چک‌لیست لایو:**
- [ ] فعال‌سازیِ WebSocket (proxy کردنِ `/ws/prices` در nginx آکادمی + `VITE_BN_WS`)
- [ ] شمارشِ معکوسِ بسته‌شدنِ کندل (countdown)
- [ ] P&L زندهٔ پوزیشن‌های باز روی چارت
- [ ] استریمِ اخبار

---

## ۱۰) بازپخش و معامله از روی چارت

| قابلیت | TradingView | بازارنما |
|---|---|---|
| Bar Replay (انتخابِ نقطهٔ شروع روی چارت) | ✅ | ◑ شروع از وسط، نه انتخابِ نقطه |
| سرعت‌های متعدد (۹ سرعت) | ✅ | ◑ ۴ سرعت |
| Play/Pause/Step | ✅ | ✅ |
| پرش به تاریخِ مشخص | ✅ | ☐ |
| پنلِ Buy/Sell | ✅ | ✅ (paper) |
| کشیدنِ Entry/SL/TP روی چارت | ✅ | ✅ |
| DOM (نردبانِ قیمت) | ✅ | ◑ شبیه‌سازی |
| خطوطِ سفارش/پوزیشن روی چارت | ✅ | ◑ |
| اتصال به بروکرِ واقعی | ✅ ۱۰۰+ بروکر | paper-trade داخلی |

**چک‌لیست:** انتخابِ نقطهٔ شروعِ Replay با کلیک روی چارت + پرش به تاریخ + خطوطِ پوزیشنِ زنده.

---

## ۱۱) چیدمانِ چندگانه و تنظیمات

| قابلیت | TradingView | بازارنما |
|---|---|---|
| چند-چارتِ گرید (تا ۱۶ چارت) | ✅ | ◑ ۱/۲/۴ (MiniChart) |
| Sync نماد/کراسهر/تایم/فاصله بینِ چارت‌ها | ✅ | ☐ |
| ذخیره/بارگذاریِ چند لِی‌اوتِ نام‌دار | ✅ | ✅ (`bn_layouts`) |
| Template اندیکاتور/چارت | ✅ | ☐ |
| دیالوگِ Settings چندتب (Symbol/Scales/Appearance/Trading/Events) | ✅ | ◑ ساده |
| تمِ تیره/روشن | ✅ | ✅ |
| منطقهٔ زمانی + ساعتِ بازار | ✅ | ☐ |
| میان‌برهای کیبورد | ✅ | ◑ (Ctrl+Enter اجرا) |

---

## ۱۲) داده، کارایی، موبایل

| محور | TradingView | بازارنما |
|---|---|---|
| Real-time stream | WebSocket | poll ۱.۵ث |
| بارگذاریِ تنبلِ تاریخِ قدیمی (اسکرول) | ✅ | ☐ (۸۰۰ کندلِ ثابت) |
| تستِ ۵۰٬۰۰۰+ کندل بدون لگ | ✅ | ☐ |
| موبایل: pinch-zoom/pan | ✅ | ◑ ریسپانسیوِ پایه |
| نوارِ ابزارِ جمع‌شونده موبایل | ✅ | ☐ |
| long-press منو | ✅ | ☐ |
| RTL / فارسی | — | ✅ |
| دسترس‌پذیری (ARIA) | ◑ | ☐ |

---

## ۱۳) جمع‌بندیِ شکافِ فعلی

**تخمینِ پوشش: ~۵۵–۶۰٪ از پهنای فیچرِ TradingView.** بزرگ‌ترین شکاف‌ها به ترتیبِ اولویت:

1. **موتورِ ترسیم** — ویرایش/جابه‌جاییِ آبجکت با handle + Object Tree + ۹۰ ابزارِ باقی‌مانده. (بحرانی)
2. **نمااسکریپت بار-به-بار** — `close[1]`، `var`، حلقه، `request.security`. (هستهٔ تمایز)
3. **اندیکاتورهای غایب** — Ichimoku, ADX, SAR, Pivots, Keltner/Donchian, Stoch RSI.
4. **انواعِ چارتِ non-standard** — Renko, Kagi, P&F, Line Break, Range.
5. **اسکرینرِ فیلتردار + اخبار + تقویم.**
6. **آلارمِ کامل** (منبع×شرط×تریگر×تحویلِ تلگرام).
7. **چند-چارتِ هم‌گام + بارگذاریِ تنبل + بهینهٔ ۵۰k کندل.**
8. **فعال‌سازیِ WebSocket برای لایو.**

---

## منابع (عمومی، مجاز برای مرجع)

- TradingView — Drawing tools available: https://www.tradingview.com/support/solutions/43000703396-drawing-tools-available-on-tradingview/
- TradingView — Features: https://www.tradingview.com/features/
- TradingView — Built-in Indicators: https://www.tradingview.com/support/folders/43000587405-built-in-indicators/
- TradingView — Indicators List (Charting Library): https://www.tradingview.com/charting-library-docs/latest/ui_elements/indicators/Indicators-List/
- Lightweight Charts (موتورِ متن‌باز): https://github.com/tradingview/lightweight-charts
- مرجعِ معماریِ ترسیم (۶۸ ابزار، v5): https://github.com/deepentropy/lightweight-charts-drawing
- Pine Script v6 Reference: https://www.tradingview.com/pine-script-reference/v6/
- Pine Script Built-ins: https://www.tradingview.com/pine-script-docs/language/built-ins/

> **برای نگاشتِ زبان، فایلِ `docs/PINESCRIPT_REFERENCE.md` را ببین.**
