# بازارنما — اسپکِ نسخهٔ موبایل/تبلت (چارتِ سبکِ TradingView-mobile)

> فصلِ #4 از فهرستِ بهبودها. هدف: تجربهٔ چارتِ بازارنما روی موبایل و تبلت به‌اندازهٔ
> اپِ موبایلِ TradingView روان، تمام‌صفحه و لمسی شود — بدون شکستنِ نسخهٔ دسکتاپ.
> مرجعِ کد: `frontend/prochart/src/bazaarnama/mobile.jsx` و `pages/BazaarNama.jsx`.

---

## 0) خلاصهٔ وضعِ فعلی (چه داریم، چه کم داریم)

**داریم (در `mobile.jsx`):**
- `useBreakpoint()` — هوکِ زندهٔ ریسپانسیو با خروجیِ `{name, width, isMobile, isTablet, isDesktop, isWide, coarse}`.
  - نقطه‌شکست‌ها: `sm:0 / md:768 / lg:1024 / xl:1280`.
  - `isMobile = w<768` ، `isTablet = 768..1023` ، `isDesktop = ≥1024` ، `coarse` = لمسی‌بودنِ اشاره‌گر.
  - با rAF کوئلس‌شده روی `resize`/`orientationchange`.
- `MobileToolSheet` — بات‌اِم‌شیتِ پایین‌صفحه با ماسکِ تار، دستگیرهٔ کشیدنی، بستن با Esc/ماسک/کشیدن، قفلِ اسکرولِ بدنه، `safe-area-inset-bottom`، `md:hidden`.
- `TouchButton` — دکمهٔ با حداقلِ هدفِ لمسیِ `TOUCH=44px`، توکن‌محورِ `TH`.

**کم داریم (شکاف‌ها — موضوعِ این اسپک):**
1. **تولبارِ بالا** (`BazaarNama.jsx` خطوط ۱۱۲۶–۱۲۳۰) یک ردیفِ `flex-wrap` با ~۲۰ کنترل است؛ روی موبایل به ۳–۴ ردیف می‌شکند و نصفِ صفحه را می‌خورد. هیچ حالتِ فشرده‌ای ندارد جز یک دکمهٔ همبرگرِ تنها (`bp.name==='sm'` خط ۱۲۱۷) که فقط شیتِ ابزار/تب را باز می‌کند.
2. **ToolRail** (نوارِ ترسیمِ سمتِ چپ، خط ۱۲۴۹، عرضِ `w-10`) روی موبایل همیشه دیده می‌شود و فضای افقیِ گران‌بها را می‌گیرد؛ باید به یک شیتِ پایین منتقل شود.
3. **RightPanel** فقط `max-md:absolute` drawer دارد (خط ۱۴۱۹/RightPanel.jsx) ولی نه دستگیره دارد نه ماسکِ بستن نه تب‌بارِ شیتیِ موبایل.
4. **BottomDock** (داکِ پایینِ تب‌دار) روی موبایل با ارتفاعِ ثابتِ ۲۰۰–۶۰۰px چارت را له می‌کند.
5. **ژست‌های لمسیِ روی بومِ چارت** (long-press = کراس‌هیر/tracking، double-tap = جابه‌جاییِ خط، pinch = زوم) تعریفِ صریح ندارند.
6. هیچ **nav-bar پایینیِ موبایل** (نماد/تایم‌فریم/ابزار/اندیکاتور/تب) — معادلِ تولبارِ پایینیِ اپِ TV — وجود ندارد.

---

## 1) اصولِ طراحی (هم‌راستا با اپِ موبایلِ TradingView)

طبقِ مستنداتِ موبایلِ TradingView، روی صفحه‌های کوچک این رفتارها استاندارد است:
- **نوارِ ویجتِ راست حذف می‌شود** و محتوایش (واچ‌لیست، جزئیات، اخبار، پنجرهٔ داده) به شیت/دراور می‌رود.
- **فقط یک محورِ قیمت** نمایش داده می‌شود.
- **افسانه (Legend) فشرده** فقط قیمتِ بسته و درصدِ تغییر را نشان می‌دهد؛ بقیهٔ مقادیر فقط در حالتِ tracking (با long-press) ظاهر می‌شوند.
- **چارت قهرمانِ صفحه است**: همهٔ تولبارها فشرده/پنهان می‌شوند تا بیشترین مساحت به بومِ قیمت برسد.
- **ژست‌ها**: tap=درگ/اسکرول، long-press=کراس‌هیر+context-menu، double-tap=حالتِ جابه‌جاییِ خط، pinch=زوم.

اصولِ بازارنما:
- **بدونِ رنگِ هاردکد** — همه از `TH`.
- **RTL برای چیدمان، LTR برای اعداد/تیکرها/تایم‌فریم** (مثلِ `dir="ltr"` روی TFها).
- **هدف‌های لمسی ≥ `TOUCH` (۴۴px)**.
- **هیچ رگرسیونِ دسکتاپی**: هر چیزِ موبایل پشتِ `useBreakpoint()` یا `md:hidden`/`max-md:*` گِیت می‌شود.
- **احترام به `env(safe-area-inset-*)`** برای نوچ/هوم‌باندل.

---

## 2) نقاط‌شکست و حالت‌های چیدمان

| حالت | عرض | چیدمان |
|---|---|---|
| **Mobile** | `<768` (`sm`) | تک‌ستون، تمام‌صفحه. تولبارِ بالا = فشرده. ToolRailِ چپ پنهان. نوارِ پایینیِ ناوبری ظاهر. RightPanel/BottomDock فقط به‌صورتِ شیت. |
| **Tablet-portrait** | `768..1023` (`md`) | چارت + RightPanel به‌صورتِ overlay-drawer (نه ستونِ دائمی). ToolRail باریک (`w-10`) می‌ماند. تولبارِ بالا نیمه‌فشرده (پرکاربردها inline، بقیه در «بیشتر»). |
| **Tablet-landscape / Desktop-S** | `1024..1279` (`lg`) | نزدیک به دسکتاپ: ToolRail + چارت + RightPanelِ دائمیِ باریک (`w-56`). تولبار کامل ولی با wrap. |
| **Desktop** | `≥1280` (`xl`) | چیدمانِ کاملِ فعلی بدونِ تغییر. |

> مرزِ کلیدی برای «حالتِ موبایلِ کامل» = `bp.isMobile` (`<768`).
> برای «overlay drawer به‌جای ستون» = `bp.width < BREAKPOINTS.lg` (`<1024`) — معادلِ `max-lg`.
> **توجه:** `showRight` فعلاً با `window.innerWidth>760` مقداردهیِ اولیه می‌شود؛ این را به `>= BREAKPOINTS.lg` تغییر بده تا روی تبلتِ پرتره دیفالت بسته باشد.

---

## 3) تولبارِ بالا — حالتِ فشرده (Compact Top Toolbar)

### 3.1 دسته‌بندیِ کنترل‌های فعلیِ ردیفِ بالا
ردیفِ فعلی (خطوط ۱۱۲۶–۱۲۳۰) شاملِ: جستجو، نماد، قیمتِ زنده، TFها، نوعِ چارت، اندیکاتورها، نمااسکریپت، بازپخش، سیگنالِ AI، چند-چارت، مقیاس/قفل/وارونگی/ریست، کراس‌هیر، سشن‌ها، تایم‌زون، تمام‌صفحه، اسکرین‌شات، میان‌بُرها، همبرگر، ذخیره/بارگذاریِ چیدمان، تم، نوارِ راست، AuthMenu.

دسته‌بندی برای موبایل:
- **همیشه‌inline (ردیفِ فشردهٔ بالا):** جستجو/نماد، قیمتِ زنده، انتخاب‌گرِ TF (به‌صورتِ یک دکمهٔ تک که شیتِ TF را باز می‌کند، نه ۸ دکمه)، نوعِ چارت (آیکونِ تنها)، **همبرگرِ «بیشتر»**.
- **داخلِ شیتِ «بیشتر» (More sheet):** اندیکاتورها، سیگنالِ AI، نمااسکریپت، بازپخش، چند-چارت، مقیاس/قفل/وارونگی/ریست، کراس‌هیر، سشن‌ها، تایم‌زون، اسکرین‌شات، تمام‌صفحه، میان‌بُرها، ذخیره/بارگذاریِ چیدمان، تم، AuthMenu.
- **به نوارِ پایینی (Bottom nav) منتقل:** ابزارِ ترسیم، اندیکاتور، تایم‌فریم، تب‌های راست (واچ/AI/...)، نماد — برای دسترسیِ تک‌دستی با شست.

### 3.2 رفتارِ ردیفِ فشرده
- ارتفاعِ ثابت، **بدونِ `flex-wrap`** روی موبایل (تک‌ردیف). `flex-wrap` فعلی فقط برای `md+` بماند.
- آیتم‌ها فقط آیکون (بدون برچسبِ متنی) با `min-width/height ≥ 36px` (هدفِ لمسی با padding به ۴۴px می‌رسد).
- نماد + قیمت در وسط، قابلِ‌فشردن؛ tap روی نماد → شیتِ جستجوی نماد (تمام‌عرض).
- دکمهٔ TF: متنِ TFِ جاری (مثلِ `H1`) + chevron؛ tap → `MobileToolSheet` با شبکهٔ TFها (هدف‌های ۴۴px، `dir="ltr"`).

### 3.3 الگوی پیاده‌سازی
```jsx
const bp = useBreakpoint();
// در نوارِ بالا:
{bp.isMobile ? (
  <CompactTopBar
    TH={TH}
    symbol={symbol} livePrice={livePrice} fmtPrice={fmtPrice}
    tf={tf} onPickTf={() => setTfSheet(true)}
    chartType={chartType} onPickType={() => setTypeSheet(true)}
    onSearch={() => setSymSheet(true)}
    onMore={() => setMoreSheet(true)}
  />
) : (
  /* همان ردیفِ کاملِ فعلی، فقط با flex-wrap محدود به md+ */
)}
```

---

## 4) شیت‌های پایین (Bottom Sheets)

همه روی `MobileToolSheet` موجود سوار می‌شوند (دستگیره، ماسک، Esc، safe-area از قبل هست). فقط `title` و `children` متفاوت‌اند. `maxVh` را بسته به محتوا تنظیم کن.

| شیت | تریگر | محتوا | `maxVh` |
|---|---|---|---|
| **More** (بیشتر) | همبرگرِ تولبار | فهرستِ `TouchButton`های گروه‌بندی‌شده (نمایش/اندیکاتور/AI/مقیاس/ابزارها/تنظیمات) | 75 |
| **Timeframe** | دکمهٔ TF | شبکهٔ `2×n` از TFها (`dir="ltr"`)، علامتِ فعال | 45 |
| **Symbol search** | tap روی نماد/جستجو | فیلدِ جستجوی چسبیده‌بالا + لیستِ نتایج با لوگوی نماد، گروه‌بندیِ فارکس/کریپتو | 80 |
| **Chart type** | آیکونِ نوعِ چارت | ردیف‌های `CHART_TYPES` با آیکون | 50 |
| **Drawing tools** | دکمهٔ «ابزار» در nav پایین | `ToolRail` بازچیده به گریدِ آیکونِ لمسی (نه فلای‌اوتِ hover) | 70 |
| **Indicators** | دکمهٔ «اندیکاتور» در nav | همان `REGISTRY` با ردیف‌های ۴۴px + منتخب‌ها + تمپلیت | 75 |
| **Right tabs** | دکمهٔ «تب‌ها» در nav | `RightPanel` با تب‌بارِ افقیِ اسکرولی، تمام‌عرض | 85 |

### 4.1 قواعدِ شیت
- روی موبایل، **هر شیت تمام‌عرض** و از پایین بالا می‌آید. فقط یکی هم‌زمان باز (state از نوعِ enum: `'none'|'more'|'tf'|'sym'|'type'|'draw'|'ind'|'tabs'`).
- بازکردنِ شیتِ جدید، شیتِ قبلی را می‌بندد.
- اسکرولِ داخلِ شیت مستقل از بوم؛ بدنهٔ صفحه قفل می‌شود (از قبل در `MobileToolSheet` هست).
- دکمهٔ بستن + کشیدنِ دستگیره به پایین + tap روی ماسک، همه ببندند.

---

## 5) نوارِ ناوبریِ پایینی (Mobile Bottom Nav)

معادلِ تولبارِ پایینیِ اپِ TV. یک نوارِ افقیِ ثابت در پایینِ صفحه، فقط `bp.isMobile`.

- ارتفاع: `56px` + `env(safe-area-inset-bottom)`.
- ۵ دکمهٔ تک‌دستی (آیکون + برچسبِ ریز): **نماد**، **تایم‌فریم**، **ابزارِ ترسیم**، **اندیکاتور**، **تب‌ها/بیشتر**.
- هر دکمه شیتِ متناظر را باز می‌کند؛ دکمهٔ فعال با `TH.accent` هایلایت.
- `position: fixed; bottom:0; z-index < شیت‌ها`. بومِ چارت `padding-bottom` به‌اندازهٔ این نوار می‌گیرد تا محور پشتش نرود.
- روی `md+` پنهان (`md:hidden`).

```jsx
{bp.isMobile && (
  <nav dir="rtl"
    className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t md:hidden"
    style={{ background: TH.panel, borderColor: TH.border,
             paddingBottom: 'env(safe-area-inset-bottom)' }}>
    {NAV.map(it => (
      <button key={it.key} onClick={() => setSheet(it.key)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px]"
        style={{ minHeight: 56, color: sheet===it.key ? TH.accent : TH.text }}>
        {it.icon}<span>{it.label}</span>
      </button>
    ))}
  </nav>
)}
```

---

## 6) ToolRailِ ترسیم روی موبایل

- روی `bp.isMobile`، **ستونِ `w-10`ی چپ پنهان** (`max-md:hidden` روی wrapperِ خط ۱۲۴۹).
- دسترسی به ابزارها فقط از **Drawing-sheet** (بند ۴): `ToolRail` در حالتِ موبایل به‌جای فلای‌اوتِ hover، گروه‌ها را به‌صورتِ آکوردئونِ لمسی یا گریدِ تخت نشان می‌دهد (hover روی لمسی کار نمی‌کند).
- ابزارهای کمکیِ پایینِ ریل (رنگ، مگنت، واگرد/ازنو، درختِ آبجکت، پاک‌کردن) به ردیفِ بالای همان شیت یا به نوارِ شناورِ کوچک بالای بوم منتقل شوند.
- **پیشنهاد:** افزودنِ پراپِ `variant="sheet"` به `ToolRail` تا همان رجیستریِ ابزار را با چیدمانِ لمسی رندر کند (بدون دوباره‌نویسیِ TOOLS).

---

## 7) RightPanel و BottomDock روی موبایل

### RightPanel
- به‌جای `max-md:absolute`ِ بی‌دستگیره، روی موبایل از **شیتِ «تب‌ها»** (بند ۴) استفاده شود: همان `RightPanel` داخلِ `MobileToolSheet` با `maxVh=85`.
- تب‌بارِ افقی (واچ/AI/اسکنر/جزئیات/اخبار/تقویم/ترید/آلارم) به‌صورتِ اسکرولِ افقیِ لمسی (`overflow-x-auto`, از قبل هست) با هدف‌های ۴۴px.
- روی تبلتِ پرتره (`md`)، به‌جای ستونِ دائمی، **overlay-drawer با ماسک** (ماسکِ tap-to-close اضافه شود؛ الان فقط `shadow-2xl` دارد).

### BottomDock
- روی موبایل ارتفاعِ resizableِ ۲۰۰–۶۰۰ غیرفعال؛ به‌جایش **تمام‌صفحه به‌صورتِ شیت/مودال** (نوت‌ها، تستِ استراتژی، نمااسکریپت). دستگیرهٔ resize پنهان (`max-md:hidden`).
- وقتی editor/dock باز است، بومِ چارت پشتش نرود — یا dock تمام‌صفحه شود یا چارت کوچک‌نمایی شود (روی موبایل: تمام‌صفحه).

---

## 8) ژست‌های لمسی روی بومِ چارت

هم‌راستا با مستنداتِ TradingView و کتابخانهٔ چارت (lightweight-charts) که بازارنما استفاده می‌کند:

| ژست | رفتار | یادداشتِ پیاده‌سازی |
|---|---|---|
| **تک‌انگشت درگ افقی** | اسکرولِ زمانی (پن) | پیش‌فرضِ lightweight-charts؛ مطمئن شو `handleScroll.horzTouchDrag=true`. |
| **تک‌انگشت درگ عمودی روی بوم** | پنِ قیمت (در حالتِ قفل‌نشده) | با `scaleLocked` غیرفعال شود. |
| **درگ روی محورِ قیمت/زمان** | فشردن/کشیدنِ مقیاس | پیش‌فرض؛ هدفِ لمسیِ محور پهن‌تر شود. |
| **Pinch دوانگشتی** | زوم | `handleScale.pinch=true` (در lightweight-charts فعال است). |
| **Long-press (~۴۵۰ms)** | فعال‌سازیِ کراس‌هیر/Tracking + Legendِ کامل + context-menu | لمسی‌سازیِ `onContextMenu` فعلی (خط ۱۲۷۱) با تایمرِ long-press روی `touchstart`؛ لغو با حرکت >۱۰px. |
| **Double-tap روی یک ترسیم/خط** | ورود به حالتِ جابه‌جایی، سپس درگِ عمودی | معادلِ double-click در `drawings.js`؛ افزودنِ مسیرِ لمسی. |
| **Double-tap روی فضای خالیِ بوم** | `fitContent()` (ریست زوم) | میان‌بُرِ آشنای موبایل. |
| **Tap تک روی ترسیم** | انتخاب + نمایشِ هندل‌ها | هندل‌ها روی موبایل بزرگ‌تر (۱۴–۱۶px) تا با شست قابلِ‌گرفتن باشند. |

**نکاتِ مهم:**
- `touch-action: none` روی بومِ چارت تا مرورگر صفحه را اسکرول نکند؛ ولی روی شیت‌ها `touch-action: pan-y` تا اسکرولِ داخلی کار کند.
- جلوگیری از **double-tap-zoomِ مرورگر** و **pull-to-refresh** روی ناحیهٔ چارت (`overscroll-behavior: none`).
- Legend روی موبایل فشرده: فقط `O/C` و `٪تغییر`؛ کاملش فقط هنگامِ long-press/tracking (مطابقِ TV).
- هندل‌های ترسیم و خطِ کراس‌هیر روی `coarse` ضخیم‌تر رسم شوند.

---

## 9) ریزه‌کاری‌های لمسی/ریسپانسیو

- **هدف‌های لمسی:** هر دکمهٔ تعاملی روی موبایل `≥44px` (از `TouchButton` یا `min-h-[44px]` استفاده کن).
- **فونتِ ورودی‌ها ≥16px** تا iOS هنگامِ فوکوس زوم نکند (فیلدِ جستجو الان `text-sm`=14px → روی موبایل به `text-base` ببر).
- **Safe-area:** پایینِ شیت‌ها و nav از `env(safe-area-inset-bottom)`؛ بالای تولبار از `env(safe-area-inset-top)` در حالتِ تمام‌صفحه.
- **`orientationchange`:** از قبل در `useBreakpoint` هندل شده؛ مطمئن شو چارت `resize` می‌شود (lightweight-charts `applyOptions({width,height})` یا `ResizeObserver`).
- **حالتِ تمام‌صفحهٔ موبایل:** دکمهٔ fullscreen موجود است؛ روی موبایل ترجیحاً «حالتِ فقط‌چارت» (پنهان‌کردنِ هر دو تولبار) به‌جای Fullscreen API (که روی iOS Safari محدود است).
- **عملکرد:** روی موبایل تعدادِ MiniChartها/گرید را محدود کن (`grid=1` اجباری زیر ۷۶۸px) تا RAM/پینت کم بماند.

---

## 10) گام‌های پیاده‌سازی (به‌ترتیبِ اولویت)

1. **گِیتِ ریسپانسیو در `BazaarNama.jsx`:** `const bp = useBreakpoint();` (موجود، خط ۲۶۵). افزودنِ stateِ شیت: `const [sheet, setSheet] = useState('none');`. اصلاحِ مقداردهیِ اولیهٔ `showRight` به `>= BREAKPOINTS.lg`.
2. **شکستنِ تولبارِ بالا:** استخراجِ `CompactTopBar` (بند ۳) و رندرِ شرطی `bp.isMobile ? <CompactTopBar/> : <ردیفِ فعلی/>`. محدودکردنِ `flex-wrap` به `md:flex-wrap`.
3. **شیتِ More:** پر کردنِ `MobileToolSheet` با `TouchButton`های گروه‌بندی‌شده برای کنترل‌هایِ منتقل‌شده (اندیکاتور/AI/مقیاس/سشن/تایم‌زون/تم/ذخیره‌بارگذاری/...).
4. **شیتِ Timeframe و Symbol و ChartType:** سه `MobileToolSheet`ِ کوچک با گریدِ لمسی؛ اتصالِ `setTf/ setSymbol/ setChartType`.
5. **نوارِ ناوبریِ پایینی** (بند ۵): افزودنِ `<nav>` ثابت + `padding-bottom` روی wrapperِ چارت.
6. **مخفی‌کردنِ ToolRailِ چپ روی موبایل** (`max-md:hidden` خط ۱۲۴۹) + افزودنِ `variant="sheet"` به `ToolRail` و رندرش در Drawing-sheet.
7. **RightPanel به شیت:** روی `bp.isMobile`، رندرِ `RightPanel` داخلِ شیتِ «تب‌ها»؛ روی `md` افزودنِ ماسکِ tap-to-close به drawer.
8. **BottomDock:** `max-md:hidden` روی دستگیرهٔ resize؛ روی موبایل تمام‌صفحه/مودال.
9. **ژست‌های بوم** (بند ۸): فعال‌سازیِ `horzTouchDrag/vertTouchDrag/pinch` در آپشن‌های چارت؛ افزودنِ long-press→کراس‌هیر/منو و double-tap→جابه‌جاییِ خط/fitContent؛ `touch-action:none` + `overscroll-behavior:none` روی بوم.
10. **ریزه‌کاری‌ها** (بند ۹): فونتِ ورودی ۱۶px، هدف‌های ۴۴px، safe-area، `grid=1` اجباری، resize روی چرخش.
11. **QAِ دستگاهی:** تستِ روی iPhone Safari (نوچ/safe-area/زوم‌نکردن)، Android Chrome (pull-to-refresh/back-gesture)، iPad پرتره و لندسکیپ (مرزِ ۷۶۸/۱۰۲۴)، چرخشِ صفحه (resizeِ چارت).

---

## 11) معیارهای پذیرش (Acceptance)

- زیر ۷۶۸px تولبارِ بالا **تک‌ردیف** است و چارت **≥۷۰٪ ارتفاع** را می‌گیرد.
- همهٔ کنترل‌های دسکتاپ روی موبایل **از طریقِ شیت‌ها/nav قابلِ‌دسترس‌اند** (هیچ قابلیتی گم نشود).
- هر دکمهٔ تعاملی **≥۴۴px**.
- long-press کراس‌هیر+Legendِ کامل را می‌آورد؛ pinch زوم می‌کند؛ double-tap روی فضای خالی `fitContent` می‌زند.
- چرخشِ صفحه چارت را درست resize می‌کند و چیدمان نمی‌شکند.
- روی `≥1280px` چیدمانِ دسکتاپ **بدونِ هیچ تغییری** کار می‌کند (بدونِ رگرسیون).
- بدونِ هیچ رنگِ هاردکد؛ همه از `TH`. RTL برای چیدمان، LTR برای اعداد/TFها.

---

## مراجع

- TradingView — Mobile app development (Advanced Charts):
  https://www.tradingview.com/charting-library-docs/latest/mobile_specifics/
- TradingView — Toolbars:
  https://www.tradingview.com/charting-library-docs/latest/ui_elements/Toolbars/
- TradingView — New Bottom Toolbar in Multi-Chart Layout (blog):
  https://www.tradingview.com/blog/en/new-bottom-toolbar-in-multichart-layout-11245/
- کدِ پایه: `frontend/prochart/src/bazaarnama/mobile.jsx` ، `frontend/prochart/src/pages/BazaarNama.jsx` ، `RightPanel.jsx` ، `ToolRail.jsx` ، `BottomDock.jsx`
