# اسپکِ بازطراحیِ ساید‌بارِ راست (#15)

> **هدف:** بزرگ‌تر و نمایان‌تر شدنِ لوگوی نمادها + قابلیتِ شخصی‌سازی، تفکیک (Flag/رنگ) و گروه‌بندیِ واچ‌لیست — هم‌سطح با TradingView، اما با هویتِ بازارنما و RTL.
>
> **فایلِ مرجع:** `frontend/prochart/src/bazaarnama/RightPanel.jsx`
> **اجزای مرتبط:** `bazaarnama/SymbolLogo.jsx` (لوگوها)، `pages/BazaarNama.jsx` (state و persist)
> **تاریخ:** 2026-06-30

---

## ۱. وضعِ فعلی (نقطهٔ شروع)

تبِ «واچ‌لیست» در `RightPanel.jsx` (خطوط ۴۱–۷۸):

- واچ‌لیست یک **آرایهٔ مسطحِ رشته‌ای** از نمادهاست (`watch: string[]`).
- منبعِ state در `BazaarNama.jsx`:
  - `const [watch, setWatch] = useState([])` (خط ۱۸۳)
  - بارگذاری از سرور: `api.bnWatchlist().then(r => setWatch(r.symbols || []))` (خط ۹۱۵)
  - ذخیره: `toggleWatch` → `api.bnWatchlistSet(next)` (خط ۱۰۱۲)
  - localStorage helperها: `loadWS`/`saveWS` با کلیدِ `WS_KEY` (خطوط ۶۹–۷۰)
- هر ردیف: `SymbolLogo size={22}` + نام + قیمتِ زنده + جهت (▲/▼) + دکمهٔ X حذف.
- بخشِ «افزودنِ نماد»: فقط ۱۶ نمادِ اولِ فیلترشده (`.slice(0, 16)`) — **بدون جستجو**.

### کاستی‌ها نسبت به TradingView
1. لوگو کوچک (۲۲px) و کم‌رنگ؛ در حالتِ table دیده نمی‌شود.
2. هیچ تفکیکِ بصری (Flag/رنگ) نیست.
3. هیچ گروه‌بندی/سکشن (تیتر/تقسیم‌بندی) نیست.
4. چند واچ‌لیستِ مجزا وجود ندارد (فقط یک لیست).
5. افزودنِ نماد بدونِ جستجو و محدود به ۱۶ مورد.
6. ستون/مرتب‌سازی/نمای جدولی نیست.
7. drag-reorder نیست.

---

## ۲. مدلِ دادهٔ جدید

واچ‌لیست از «آرایهٔ مسطحِ رشته» به یک ساختارِ غنی ارتقا می‌یابد، با **مهاجرتِ سازگارِ عقب‌رو** (آرایهٔ قدیمی هم خوانده شود).

```ts
// یک آیتمِ نماد در واچ‌لیست
type WatchItem = {
  sym: string;            // مثلِ "EURUSD" یا "BTCUSDT"
  flag?: FlagColor | null;// رنگِ تفکیک (۷ رنگِ TradingView) یا null
  section?: string | null;// id سکشن (گروه)؛ null = بدونِ سکشن
};

type FlagColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';

// یک سکشن (تیترِ تقسیم‌بندی)
type Section = {
  id: string;            // uuid کوتاه
  name: string;          // مثلِ «فارکس» یا «کریپتوی من»
  collapsed?: boolean;   // باز/بسته
};

// یک واچ‌لیستِ نام‌دار (امکانِ چند لیست)
type Watchlist = {
  id: string;
  name: string;          // «پیش‌فرض»، «اسکالپ»، «بلندمدت» …
  items: WatchItem[];
  sections: Section[];
};

// state کلی
type WatchState = {
  lists: Watchlist[];
  activeListId: string;
  // ترجیحاتِ نمایش (سراسری)
  view: 'list' | 'table';     // ردیف یا جدول
  showLogo: boolean;          // پیش‌فرض true
  showDesc: boolean;          // نمایشِ توضیح/نامِ کاملِ نماد
  logoSize: 'md' | 'lg';      // md=28 ، lg=36 (پیش‌فرض lg طبقِ خواستهٔ #15)
  sortBy: 'manual' | 'name' | 'price' | 'changePct';
  sortDir: 'asc' | 'desc';
  groupBy: 'section' | 'type' | 'none'; // type = فارکس/فلز/کریپتو/شاخص (از SymbolLogo)
};
```

### مهاجرت (Backward-compat)
هنگامِ بارگذاری:
```js
function normalizeWatch(raw) {
  // حالتِ قدیمی: string[]  ← آرایهٔ مسطح
  if (Array.isArray(raw)) {
    return defaultState([...raw.map(sym => ({ sym, flag: null, section: null }))]);
  }
  // حالتِ جدید: { lists, activeListId, ... }
  return { ...defaultState(), ...raw };
}
```
- `api.bnWatchlistSet` باید payloadِ غنی را بپذیرد؛ سرور فقط JSON ذخیره می‌کند. اگر سرور هنوز فقط `symbols[]` می‌پذیرد، در فازِ ۱ یک کلیدِ جداگانهٔ localStorage (`WS_KEY` → افزودنِ `watch_meta`) برای flag/section نگه داریم و `symbols[]` را همگام بفرستیم، تا backend دست‌نخورده بماند.

---

## ۳. لوگوها — بزرگ‌تر و نمایان‌تر

طبقِ خواستهٔ صریحِ #15:

| پارامتر | فعلی | جدید (list) | جدید (table) |
|---|---|---|---|
| اندازهٔ لوگو | 22 | **32** (md) / **36** (lg) | 24 |
| ارتفاعِ ردیف | `h-9` (36px) | `h-11` (44px) | `h-8` (32px) |
| فاصلهٔ لوگو↔متن | `gap-2.5` | `gap-3` | `gap-2` |

تغییراتِ ظاهری:
- حلقهٔ دورِ لوگو (`--logo-ring`) را پررنگ‌تر و با سایهٔ ملایم کنیم تا روی پس‌زمینهٔ تیره «شناور» دیده شود:
  ```css
  /* در حالتِ بزرگ */
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.45));
  ```
- در `SymbolLogo.jsx` برای جفت‌ارز، دو پرچمِ هم‌پوشان در سایزِ بزرگ‌تر طبیعی‌تر است؛ نسبتِ `r = s*0.30` حفظ می‌شود (مقیاس‌پذیر است، تغییری لازم نیست).
- نامِ نماد با `prettySym` (EUR/USD) + (در صورتِ `showDesc`) یک خطِ دومِ کوچکِ توضیح (مثلِ «یورو / دلار») با `opacity .5`.

نمونهٔ ردیفِ بازطراحی‌شده (حالتِ list، logoSize=lg):
```jsx
<div className="group/row flex items-center gap-3 w-full px-3 h-11"
     style={{ background: active ? TH.subtle : 'transparent',
              borderRight: `2px solid ${active ? TH.accent : 'transparent'}` }}>
  {/* نوارِ رنگیِ Flag در سمتِ راست */}
  {item.flag && <span className="w-1 self-stretch rounded-full" style={{ background: FLAG_HEX[item.flag] }} />}
  <SymbolLogo symbol={item.sym} size={36} />
  <div className="flex-1 min-w-0 text-left" dir="ltr">
    <div className="text-[13px] font-bold leading-tight truncate"
         style={{ color: active ? TH.accent : TH.textStrong }}>{prettySym(item.sym)}</div>
    {showDesc && <div className="text-[10px] opacity-50 truncate">{descOf(item.sym)}</div>}
  </div>
  <div className="text-right shrink-0" dir="ltr">
    <div className="tabular-nums text-[12px]" style={{ color: col }}>{fmtPrice(item.sym, lp?.mid)}</div>
    <div className="tabular-nums text-[10px]" style={{ color: col }}>{changePct}٪</div>
  </div>
</div>
```

---

## ۴. تفکیک با Flag (۷ رنگ)

عیناً مدلِ TradingView: کلیک روی آیکونِ پرچمِ کنارِ هر نماد → پاپ‌اوورِ ۷ رنگ.

```js
const FLAG_HEX = {
  red:    '#f23645',
  orange: '#ff9800',
  yellow: '#ffd60a',
  green:  '#22c55e',
  blue:   '#2196f3',
  purple: '#9c27b0',
  gray:   '#787b86',
};
```

رفتار:
- آیکونِ `Flag` (lucide) در hover یا همیشه (تنظیم‌پذیر) سمتِ راستِ ردیف.
- کلیک → پاپ‌اوورِ کوچکِ ۷ دایره‌رنگ + گزینهٔ «بدونِ پرچم» (پاک‌کردن).
- نمایشِ رنگ: یک **نوارِ عمودیِ ۲px** در لبهٔ راستِ ردیف (نه کلِ پس‌زمینه؛ مینیمال‌تر از TV و خواناتر در دارک).
- در حالتِ `groupBy='none'` می‌توان با کلیک روی هدرِ «فیلترِ رنگ» فقط یک رنگ را نشان داد (toggle chips بالای لیست).

---

## ۵. گروه‌بندی و سکشن‌ها (تفکیک)

سه حالتِ `groupBy`:

1. **`section` (پیش‌فرض):** کاربر سکشن‌های دلخواه می‌سازد («فارکس»، «طلا/فلزات»، «کریپتو»، «سیگنال‌های امروز»…).
   - دکمهٔ «+ سکشن» در منوی واچ‌لیست.
   - هر سکشن یک هدرِ قابلِ‌collapse با تعدادِ نمادها.
   - drag نماد بین سکشن‌ها (فاز ۳).
2. **`type` (خودکار):** گروه‌بندیِ ماشینی بر پایهٔ نوعِ نماد که از `SymbolLogo.jsx` در‌می‌آید:
   - جفت‌ارز (`pair()`) → «فارکس»
   - `XAU/XAG/XPT/XPD` → «فلزات»
   - رجکسِ شاخص‌ها (US30/NAS100/…) → «شاخص‌ها»
   - بقیه (کریپتو) → «کریپتو»
   - یک util مشترک: `symbolKind(sym): 'forex'|'metal'|'index'|'crypto'` که از همان منطقِ `SymbolLogo` استخراج شود (DRY — به یک ماژولِ مشترک منتقل شود).
3. **`none`:** لیستِ تختِ ساده (مثلِ امروز) با مرتب‌سازی.

هدرِ سکشن (نمونه):
```jsx
<button onClick={() => toggleSection(sec.id)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-semibold tracking-wide select-none sticky top-0 z-10"
        style={{ color: TH.text, opacity: .7, background: TH.bg }}>
  <span className="flex items-center gap-1">
    <ChevronDown size={12} className={sec.collapsed ? '-rotate-90' : ''} />
    {sec.name}
  </span>
  <span className="tabular-nums">{count}</span>
</button>
```

---

## ۶. چند واچ‌لیست + مرتب‌سازی + نمای جدولی

### سویچرِ لیست (بالای تب)
- یک دراپ‌داون نزدیکِ تیترِ «واچ‌لیست» با نامِ لیستِ فعال + فلش.
- اکشن‌ها: ساختِ لیستِ جدید، تغییرِ نام، حذف، کپی، وارد/خروجِ متنی (هر خط یک نماد).

### مرتب‌سازی
- در نمای جدول: کلیک روی هدرِ ستون (نام/قیمت/درصد) برای sort؛ نشانگرِ ▲/▼.
- در نمای لیست: منوی «مرتب‌سازی» (manual/name/price/changePct).
- `manual` = ترتیبِ دستی (drag) محفوظ بماند.

### نمای جدول (table)
ستون‌های پیش‌فرض: `نماد | آخرین | تغییر٪`. ستون‌های اختیاری (از منوی سه‌نقطه): `تغییر مطلق | High | Low | Spread`.
- ردیف‌ها فشرده‌تر (`h-8`)، لوگو ۲۴px.
- اعداد `tabular-nums` و `dir="ltr"`.

---

## ۷. افزودنِ نماد — جستجوی واقعی

جایگزینِ `.slice(0, 16)`:
- ورودیِ جستجو (با آیکونِ `Search`) بالای بخشِ «افزودنِ نماد».
- فیلترِ زنده روی `symbols` (نام + توضیح) با debounce ساده.
- نتایج: لوگوی بزرگ + نام + نوع (chip)؛ کلیک = افزودن به سکشنِ فعال (یا «بدونِ سکشن»).
- اگر متصل به همان جستجوی سراسریِ نماد (مودالِ symbol-search پروژه) بهتر است؛ در غیرِ این‌صورت همین فیلترِ inline کافی است.

---

## ۸. منوی شخصی‌سازی (سه‌نقطه)

آیکونِ `MoreVertical` کنارِ تیترِ واچ‌لیست → منو:

- **نمایش:** لیست / جدول
- **لوگو:** نمایش/مخفی، اندازهٔ متوسط/بزرگ
- **توضیحِ نماد:** نمایش/مخفی
- **گروه‌بندی:** سکشن / نوعِ خودکار / بدون
- **ستون‌ها** (در حالتِ جدول): چک‌باکسِ متریک‌ها
- **مدیریتِ سکشن‌ها:** افزودن/تغییرِ نام/حذف
- **وارد/خروجِ لیست** (متنِ خط‌به‌خط)

همهٔ ترجیحات در `WatchState` و در localStorage (`WS_KEY`) persist شوند.

---

## ۹. RTL و توکن‌های تم

- کلِ پنل `dir="rtl"`؛ مقادیرِ عددی/نماد `dir="ltr"` (مثلِ امروز).
- رنگ‌ها صرفاً از `TH` (`TH.bg`, `TH.border`, `TH.text`, `TH.textStrong`, `TH.subtle`, `TH.accent`, `TH.up`, `TH.down`, `TH.chipBg`, `TH.chipBgHover`) — هیچ رنگِ هاردکدِ جدید جز `FLAG_HEX`.
- ترنزیشن‌ها `duration-[120ms]` هم‌سطحِ بقیهٔ پنل.
- `bn-thin-scroll` برای اسکرول.
- آیکون‌ها از `lucide-react` (هم‌خانوادهٔ X/Plus/Sparkles موجود): `Flag`, `Search`, `MoreVertical`, `ChevronDown`, `GripVertical`, `List`, `Table`.

---

## ۱۰. فازبندیِ پیاده‌سازی

| فاز | محتوا | ریسک |
|---|---|---|
| **۱ — لوگوی بزرگ + ساختار** | بزرگ‌کردنِ لوگو (۳۶) و ردیف (`h-11`)، خطِ دومِ درصدِ تغییر، نرمالایزِ مدلِ داده با backward-compat، جستجوی افزودنِ نماد | کم |
| **۲ — تفکیک (Flag)** | پاپ‌اوورِ ۷ رنگ، نوارِ رنگیِ ردیف، فیلترِ رنگ، persist | کم |
| **۳ — گروه‌بندی** | سکشن‌های دستی + گروه‌بندیِ خودکارِ نوع (util مشترکِ `symbolKind`)، collapse، هدرهای sticky | متوسط |
| **۴ — چند لیست + جدول + drag** | سویچرِ لیست، نمای جدول با ستون‌های قابلِ‌مرتب‌سازی، drag-reorder، وارد/خروج | متوسط/بالا |

> توصیه: فاز ۱ و ۲ سریع و کم‌ریسک‌اند و بیشترِ ارزشِ بصریِ خواستهٔ #15 (لوگوی بزرگ + تفکیک) را می‌دهند. فاز ۳/۴ تدریجی.

---

## ۱۱. چک‌لیستِ پذیرش

- [ ] لوگوی نمادها به‌وضوح بزرگ‌تر و با حلقه/سایهٔ نمایان دیده می‌شود.
- [ ] هر نماد قابلِ flag با ۷ رنگ است و رنگ persist می‌شود.
- [ ] کاربر می‌تواند سکشن بسازد و نمادها را تفکیک کند؛ یا گروه‌بندیِ خودکارِ نوع را بزند.
- [ ] جستجوی افزودنِ نماد کار می‌کند (نه محدود به ۱۶).
- [ ] رفتارِ `max-md` drawer و همگام‌سازیِ سرور (`bnWatchlistSet`) دست‌نخورده و سازگارِ عقب‌رو می‌ماند.
- [ ] هیچ رنگِ خارج از `TH`/`FLAG_HEX`؛ RTL درست؛ اعداد `tabular-nums`.

---

## منابع (TradingView)

- [Mastering the TradingView watchlists](https://www.tradingview.com/support/solutions/43000745825-mastering-the-tradingview-watchlists/)
- [New Watchlist features — TradingView Blog](https://www.tradingview.com/blog/en/new-watchlist-features-21389/)
- [The evolution of flagged symbols — TradingView Blog](https://www.tradingview.com/blog/en/flagged-lists-improved-9521/)
