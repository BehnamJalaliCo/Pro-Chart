# اسپکِ #7 — UXِ نمایش/اسکرول/جستجوی نماد (تا سطحِ TradingView)

> هدف: فاصلهٔ تجربهٔ کاربریِ انتخاب/جستجوی نماد در بازارنما با TradingView را ببندیم.
> مدالِ جستجوی **fuzzy** با **دسته‌بندی** (فارکس/کریپتو/فلز/شاخص/انرژی)، **لوگو**،
> **اسکرولِ مجازی** برای ۲۰۰۰+ نماد، **میان‌بُرهای کیبورد**، و یک **سویچرِ بهبودیافتهٔ** سایدبار.

نسخه: ۱ — تاریخ: ۱۴۰۵/۰۴/۰۹ (2026-06-30) — مالک: بازارنما/ProChart

---

## ۱) وضعِ فعلی (Baseline) و شکاف‌ها

مسیرها (همگی مطلق):

- `frontend/prochart/src/pages/BazaarNama.jsx`
  - state: `symbol`, `symbols` (آرایهٔ رشته‌ایِ تخت)، `search`، `watch`.
  - منبعِ نمادها: `api.chartSymbols()` → `GET /academy/chart/symbols` → `{ symbols: string[] }`.
  - جستجوی فعلی (خطِ ~۱۱۲۰):
    ```js
    const filteredSymbols = symbols.filter((s) => s.toLowerCase().includes(search.toLowerCase()));
    // ...
    {filteredSymbols.slice(0, 30).map((s) => (
      <button onClick={() => { setSymbol(s); setSearch(''); }} dir="ltr">{s}</button>
    ))}
    ```
- `frontend/prochart/src/bazaarnama/RightPanel.jsx` — تبِ واچ‌لیست + لیستِ نمادها (`.slice(0,16)`)، از `SymbolLogo` استفاده می‌کند.
- `frontend/prochart/src/bazaarnama/SymbolLogo.jsx` — **موجود و باکیفیت**: جفت‌ارز = دو پرچمِ دایره‌ایِ روی‌هم؛ کریپتو = لوگوی واقعی از `/crypto-icons/{ticker}.svg` با fallbackِ بَجِ رنگی؛ فلز/شاخص = بَج. این کامپوننت **بازاستفاده** می‌شود؛ بازنویسی لازم نیست.
- `frontend/prochart/src/api/client.js` — `chartSymbols`, `bnWatchlist`, `bnWatchlistSet`, `bnPrices`.

شکاف‌ها نسبت به TradingView:

| محور | الان | هدف |
|---|---|---|
| تطبیق | فقط `includes` ساده، حساس به ترتیبِ حروف | fuzzy + رتبه‌بندیِ relevance |
| دسته‌بندی | ندارد | تب‌های همه/فارکس/کریپتو/فلز/شاخص/انرژی |
| ظرفیت | `slice(0,30)`، dropdownِ کوچک | مدالِ تمام‌قد + **virtual scroll** برای ۲۰۰۰+ |
| لوگو در نتایج | ندارد (متنِ خام) | `SymbolLogo` + توضیحِ فارسی + پرچمِ کشور |
| کیبورد | ندارد | `/` یا `Ctrl/⌘+K` باز، `↑/↓` پیمایش، `Enter` انتخاب، `Esc` بستن |
| میان‌بُر | ندارد | اخیراً‌دیده‌شده‌ها، نمادهای محبوب، واچ‌لیست به‌صورتِ ردیفِ اول |

> نکته: نه `fuse.js` و نه کتابخانهٔ virtual-scroll نصب است → پیاده‌سازیِ سبک و **بدونِ وابستگیِ خارجی** (مطابق با قانونِ پروژه: بدونِ CDN خارجی؛ همه self-host). الگوریتم fuzzy و virtual list را inline می‌نویسیم (~۸۰ خط مجموعاً).

---

## ۲) مدلِ داده — از `string[]` به `SymbolMeta[]`

برای دسته‌بندی/توضیح/پرچم، آرایهٔ رشته‌ای کافی نیست. یک لایهٔ غنی‌سازیِ **کلاینت‌ساید** اضافه می‌کنیم که خروجیِ خامِ `chartSymbols()` را به متادیتا تبدیل می‌کند (بک‌اند تغییر نمی‌کند؛ بعداً اگر بک‌اند فیلدها را بدهد، همین تابع override می‌شود).

```ts
// نوعِ مفهومی (JS، نه TS؛ صرفاً برای مستند)
type SymbolMeta = {
  symbol: string;        // 'EURUSD'
  cat: 'forex' | 'crypto' | 'metal' | 'index' | 'energy' | 'other';
  desc: string;          // 'یورو / دلار آمریکا'  (فارسی)
  base?: string;         // 'EUR'
  quote?: string;        // 'USD'
  country?: string;      // ISO-2 برای پرچمِ کشورِ بازار (شاخص‌ها)
  popular?: boolean;     // برای مرتب‌سازیِ پیش‌فرض
};
```

فایلِ جدید: `frontend/prochart/src/bazaarnama/symbolMeta.js`

```js
// بازارنما — غنی‌سازیِ متادیتای نماد (کلاینت‌ساید، بدون تماسِ بک‌اند اضافه).
const CCY = ['USD','EUR','GBP','JPY','CHF','CAD','AUD','NZD'];
const CCY_FA = {
  USD:'دلار آمریکا', EUR:'یورو', GBP:'پوند انگلیس', JPY:'ین ژاپن',
  CHF:'فرانک سوئیس', CAD:'دلار کانادا', AUD:'دلار استرالیا', NZD:'دلار نیوزیلند',
};
const METAL = { XAU:['طلا','metal'], XAG:['نقره','metal'], XPT:['پلاتین','metal'], XPD:['پالادیوم','metal'] };
const ENERGY = /^(OIL|WTI|BRENT|XTI|XBR|XNG|NGAS|UKOIL|USOIL)/;
const INDEX  = /^(US30|US500|US100|NAS100|NAS|SPX|DJI|NDX|UK100|DE40|GER40|JP225|FRA40|HK50|AUS200|EU50)/;
const INDEX_FA = {
  US30:'داوجونز ۳۰', US500:'اس‌اند‌پی ۵۰۰', US100:'نزدک ۱۰۰', NAS100:'نزدک ۱۰۰',
  UK100:'فوتسی ۱۰۰', DE40:'دکس ۴۰', GER40:'دکس ۴۰', JP225:'نیکی ۲۲۵', FRA40:'کک ۴۰',
  HK50:'هنگ‌سنگ', AUS200:'ASX 200', EU50:'یوروستاکس ۵۰',
};
const INDEX_CC = { US30:'US', US500:'US', US100:'US', NAS100:'US', UK100:'GB', DE40:'DE', GER40:'DE', JP225:'JP', FRA40:'FR', HK50:'HK', AUS200:'AU', EU50:'EU' };
// محبوب‌ها برای رتبهٔ پیش‌فرض
const POPULAR = new Set(['EURUSD','GBPUSD','USDJPY','XAUUSD','BTCUSDT','ETHUSDT','US30','US500','NAS100','AUDUSD','USDCAD']);

function up(s){ return String(s||'').toUpperCase(); }

export function classify(symRaw) {
  const sym = up(symRaw);
  const clean = sym.replace(/[^A-Z0-9]/g,'');
  // فلز در برابر دلار
  for (const m of Object.keys(METAL)) if (clean.startsWith(m)) {
    const q = clean.slice(m.length,m.length+3);
    return { symbol: sym, cat:'metal', base:m, quote:q||'USD',
      desc:`${METAL[m][0]}${q&&CCY_FA[q]?(' / '+CCY_FA[q]):''}` };
  }
  // انرژی
  if (ENERGY.test(clean)) return { symbol:sym, cat:'energy', desc:'نفت/انرژی', country:'US' };
  // شاخص
  if (INDEX.test(clean)) {
    const key = Object.keys(INDEX_FA).find(k=>clean.startsWith(k)) || clean.slice(0,5);
    return { symbol:sym, cat:'index', desc:INDEX_FA[key]||sym, country:INDEX_CC[key]||'US' };
  }
  // جفت‌ارزِ فیات
  if (clean.length>=6) {
    const a=clean.slice(0,3), b=clean.slice(3,6);
    if (CCY.includes(a) && CCY.includes(b))
      return { symbol:sym, cat:'forex', base:a, quote:b, desc:`${CCY_FA[a]} / ${CCY_FA[b]}` };
  }
  // کریپتو (پسوندِ USDT/USD/BTC)
  const base = clean.replace(/(USDT|USDC|USD|BTC|ETH)$/,'');
  if (base && base !== clean) return { symbol:sym, cat:'crypto', base, quote:clean.slice(base.length), desc:base };
  return { symbol:sym, cat:'other', desc:sym };
}

export function buildMeta(list){
  return (list||[]).map((s)=>{ const m = classify(s); m.popular = POPULAR.has(up(s).replace(/[^A-Z0-9]/g,'')); return m; });
}

export const CATEGORIES = [
  { id:'all',    label:'همه' },
  { id:'forex',  label:'فارکس' },
  { id:'crypto', label:'کریپتو' },
  { id:'metal',  label:'فلزات' },
  { id:'index',  label:'شاخص‌ها' },
  { id:'energy', label:'انرژی' },
];
```

> توجه به #6 (حذفِ BTCUSD از فارکس): `classify` به‌درستی هر نمادی با پسوندِ ارزی‌رمز را در `crypto` می‌گذارد؛ پس فیلترِ تبِ «فارکس» فقط `cat==='forex'` را نشان می‌دهد و BTC* هرگز در فارکس دیده نمی‌شود. این اسپک با تسکِ #6 سازگار است.

---

## ۳) موتورِ جستجوی fuzzy (بدونِ وابستگی)

رتبه‌بندی: تطبیقِ دقیق > startsWith > زیررشتهٔ پیوسته > subsequence (حروفِ پراکنده با ترتیب). امتیازِ بالاتر = بهتر. هم روی `symbol` و هم روی `desc` (فارسی) اجرا می‌شود.

فایلِ جدید: `frontend/prochart/src/bazaarnama/fuzzy.js`

```js
// بازارنما — fuzzy matcher سبک. خروجی: امتیاز (هرچه بیشتر بهتر) یا -1 برای عدمِ تطبیق.
function scoreOne(hay, needle){
  if (!needle) return 0;
  const H = hay.toLowerCase(), N = needle.toLowerCase();
  if (H === N) return 1000;
  if (H.startsWith(N)) return 800 - (H.length - N.length); // پیشوند، کوتاه‌تر بهتر
  const idx = H.indexOf(N);
  if (idx >= 0) return 600 - idx - (H.length - N.length) * 0.2; // زیررشتهٔ پیوسته
  // subsequence: همهٔ حروفِ N به ترتیب داخلِ H باشند
  let i = 0, j = 0, gaps = 0, last = -1;
  while (i < H.length && j < N.length){
    if (H[i] === N[j]){ if (last>=0) gaps += i-last-1; last=i; j++; }
    i++;
  }
  if (j === N.length) return 300 - gaps; // تطبیقِ پراکنده، فاصلهٔ کمتر بهتر
  return -1;
}

// روی نماد و توضیح؛ بهترین امتیاز را برمی‌گرداند.
export function matchSymbol(meta, q){
  if (!q) return 0;
  const a = scoreOne(meta.symbol, q);
  const b = scoreOne(meta.desc || '', q);
  let s = Math.max(a, b);
  if (s < 0) return -1;
  if (meta.popular) s += 25;       // بوستِ محبوب‌ها
  return s;
}

export function searchSymbols(metaList, q, cat){
  const filtered = cat && cat !== 'all' ? metaList.filter(m=>m.cat===cat) : metaList;
  if (!q) {
    // بدونِ کوئری: محبوب‌ها اول، بعد الفبایی
    return [...filtered].sort((x,y)=> (Number(y.popular)-Number(x.popular)) || x.symbol.localeCompare(y.symbol));
  }
  const scored = [];
  for (const m of filtered){ const s = matchSymbol(m, q); if (s >= 0) scored.push([s, m]); }
  scored.sort((p,n)=> n[0]-p[0] || p[1].symbol.localeCompare(n[1].symbol));
  return scored.map(x=>x[1]);
}
```

ویژگی‌ها مطابق TradingView:
- تایپِ `eu` → `EURUSD`, `EURJPY` … (پیشوند).
- تایپِ `ej` → `EURJPY` (subsequence).
- تایپِ `طلا` → `XAUUSD` (تطبیق روی `desc` فارسی).
- محبوب‌ها همیشه کمی بالاتر.
- `symbol_search_request_delay` معادل: ورودی را **۸۰ms debounce** می‌کنیم (بخشِ ۵).

---

## ۴) اسکرولِ مجازی برای ۲۰۰۰+ نماد (بدونِ وابستگی)

برای دیتاستِ بزرگ، فقط ردیف‌های قابلِ‌دیدن را render می‌کنیم. ردیف‌ها **ارتفاعِ ثابت** دارند (`ROW_H = 44px`) → ریاضیِ ساده، بدونِ measure.

فایلِ جدید: `frontend/prochart/src/bazaarnama/VirtualList.jsx`

```jsx
import React, { useRef, useState, useCallback } from 'react';

// لیستِ مجازی با ردیفِ ثابت‌ارتفاع. items: آرایه، rowH: px، height: ارتفاعِ viewport،
// renderRow: (item, index) => JSX، overscan: تعدادِ ردیفِ اضافه بالا/پایین.
export default function VirtualList({ items, rowH = 44, height = 420, overscan = 6, renderRow, scrollToIndex }) {
  const ref = useRef(null);
  const [top, setTop] = useState(0);
  const onScroll = useCallback((e)=> setTop(e.currentTarget.scrollTop), []);

  // اسکرولِ برنامه‌ای به ردیفِ انتخاب‌شده (برای ناوبریِ کیبورد)
  React.useEffect(()=>{
    if (scrollToIndex == null || !ref.current) return;
    const y = scrollToIndex * rowH, vh = height, st = ref.current.scrollTop;
    if (y < st) ref.current.scrollTop = y;
    else if (y + rowH > st + vh) ref.current.scrollTop = y - vh + rowH;
  }, [scrollToIndex, rowH, height]);

  const total = items.length * rowH;
  const start = Math.max(0, Math.floor(top / rowH) - overscan);
  const end   = Math.min(items.length, Math.ceil((top + height) / rowH) + overscan);
  const slice = items.slice(start, end);

  return (
    <div ref={ref} onScroll={onScroll} style={{ height, overflowY:'auto', position:'relative' }} role="listbox">
      <div style={{ height: total, position:'relative' }}>
        {slice.map((it, i)=>{
          const index = start + i;
          return (
            <div key={it.symbol || index}
              style={{ position:'absolute', top: index*rowH, left:0, right:0, height: rowH }}>
              {renderRow(it, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- ۲۰۰۰ ردیف × ۴۴px = ۸۸٬۰۰۰px اسپیسر؛ همیشه فقط ~۱۵–۲۰ ردیف در DOM.
- بدونِ jank، چون اسکرول صرفاً `top` را آپدیت و slice را دوباره می‌سازد.
- ناوبریِ کیبورد با `scrollToIndex` همگام می‌شود (ردیفِ هایلایت همیشه دیده می‌شود).

---

## ۵) مدالِ جستجوی نماد

فایلِ جدید: `frontend/prochart/src/bazaarnama/SymbolSearchModal.jsx`

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Star } from 'lucide-react';
import SymbolLogo from './SymbolLogo';
import VirtualList from './VirtualList';
import { searchSymbols } from './fuzzy';
import { CATEGORIES } from './symbolMeta';

const RECENT_KEY = 'bn_recent_symbols';
const loadRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
const pushRecent = (s) => {
  const next = [s, ...loadRecent().filter(x=>x!==s)].slice(0, 8);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
  return next;
};

// metaList: SymbolMeta[]، watch: string[]، open/onClose/onPick، current: نمادِ فعلی.
export default function SymbolSearchModal({ open, onClose, metaList, watch = [], current, onPick }) {
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');       // debounced
  const [cat, setCat] = useState('all');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // debounce ۸۰ms (معادلِ symbol_search_request_delay در TradingView)
  useEffect(()=>{ const t = setTimeout(()=> setDq(q), 80); return ()=> clearTimeout(t); }, [q]);
  useEffect(()=>{ if (open){ setQ(''); setDq(''); setCat('all'); setActive(0); setTimeout(()=>inputRef.current?.focus(), 30); } }, [open]);

  const results = useMemo(()=> searchSymbols(metaList, dq, cat), [metaList, dq, cat]);
  useEffect(()=>{ setActive(0); }, [dq, cat]);

  const recent = useMemo(()=> loadRecent().filter(s=> metaList.some(m=>m.symbol===s)), [metaList, open]);
  const watchSet = useMemo(()=> new Set(watch), [watch]);

  const pick = (sym) => { pushRecent(sym); onPick(sym); onClose(); };

  // کیبورد: ↑/↓ پیمایش، Enter انتخاب، Esc بستن
  const onKey = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a=> Math.min(results.length-1, a+1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a=> Math.max(0, a-1)); }
    else if (e.key === 'Enter') { const r = results[active]; if (r) pick(r.symbol); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] bg-black/55 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-[min(680px,94vw)] rounded-2xl overflow-hidden shadow-2xl"
           style={{ background:'var(--bn-panel,#131722)', border:'1px solid var(--bn-border,#2a2e39)' }}
           onClick={(e)=>e.stopPropagation()} onKeyDown={onKey}>

        {/* نوارِ جستجو */}
        <div className="flex items-center gap-2 px-4 h-14 border-b" style={{ borderColor:'var(--bn-border,#2a2e39)' }}>
          <Search size={18} className="opacity-60" />
          <input ref={inputRef} dir="ltr" value={q} onChange={(e)=>setQ(e.target.value)}
            placeholder="جستجوی نماد… (EURUSD، طلا، BTC)"
            className="flex-1 bg-transparent outline-none text-[15px] tabular-nums placeholder:opacity-50" />
          <kbd className="text-[11px] opacity-50 px-1.5 py-0.5 rounded border" style={{ borderColor:'var(--bn-border,#2a2e39)' }}>Esc</kbd>
          <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={18} /></button>
        </div>

        {/* تب‌های دسته‌بندی */}
        <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto" style={{ borderColor:'var(--bn-border,#2a2e39)' }}>
          {CATEGORIES.map(c=>(
            <button key={c.id} onClick={()=>setCat(c.id)}
              className={`px-3 h-7 rounded-full text-[13px] whitespace-nowrap transition-colors ${cat===c.id?'bg-sky-500/20 text-sky-300':'opacity-70 hover:opacity-100 hover:bg-white/5'}`}>
              {c.label}
            </button>
          ))}
        </div>

        {/* میان‌بُرها: اخیر + واچ‌لیست (فقط وقتی کوئری خالی است) */}
        {!dq && (recent.length>0 || watch.length>0) && (
          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 text-[12px] border-b" style={{ borderColor:'var(--bn-border,#2a2e39)' }}>
            {recent.map(s=>(
              <button key={'r'+s} onClick={()=>pick(s)} className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/5 hover:bg-white/10" dir="ltr">
                <SymbolLogo symbol={s} size={16} /> {s}
              </button>
            ))}
            {watch.filter(s=>!recent.includes(s)).slice(0,6).map(s=>(
              <button key={'w'+s} onClick={()=>pick(s)} className="flex items-center gap-1 px-2 h-7 rounded-lg bg-amber-500/10 hover:bg-amber-500/20" dir="ltr">
                <Star size={11} className="text-amber-400" /> {s}
              </button>
            ))}
          </div>
        )}

        {/* نتایج — اسکرولِ مجازی */}
        <VirtualList
          items={results} rowH={48} height={Math.min(440, results.length*48 + 4)}
          scrollToIndex={active}
          renderRow={(m, i)=>{
            const isActive = i === active;
            const isCur = m.symbol === current;
            return (
              <button onClick={()=>pick(m.symbol)} onMouseEnter={()=>setActive(i)}
                className={`flex items-center gap-3 w-full h-full px-4 text-right ${isActive?'bg-sky-500/15':''} ${isCur?'ring-1 ring-inset ring-sky-500/40':''}`}>
                <SymbolLogo symbol={m.symbol} size={26} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold leading-tight" dir="ltr">{m.symbol}</div>
                  <div className="text-[12px] opacity-60 leading-tight truncate">{m.desc}</div>
                </div>
                {watchSet.has(m.symbol) && <Star size={13} className="text-amber-400 shrink-0" />}
                <span className="text-[10px] opacity-40 shrink-0">{m.cat}</span>
              </button>
            );
          }}
        />

        {results.length === 0 && (
          <div className="py-10 text-center text-sm opacity-50">نمادی مطابقِ «{q}» پیدا نشد</div>
        )}
      </div>
    </div>
  );
}
```

---

## ۶) میان‌بُرهای کیبورد (سراسری)

در `BazaarNama.jsx` یک state `symModal` و یک افکتِ سراسری:

```js
const [symModal, setSymModal] = useState(false);

useEffect(() => {
  const onKey = (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
    // Ctrl/⌘+K همیشه؛ "/" فقط وقتی در حالِ تایپ نیستیم (مثلِ TradingView)
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      setSymModal(true);
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);
```

> این با فایلِ `frontend/prochart/src/bazaarnama/hotkeys.js` هماهنگ شود تا تداخل نداشته باشد (آنجا میان‌بُرهای چارت تعریف‌اند).

---

## ۷) اتصال در `BazaarNama.jsx`

۱) متادیتا را یک‌بار بساز:

```js
import { buildMeta } from '../bazaarnama/symbolMeta';
import SymbolSearchModal from '../bazaarnama/SymbolSearchModal';
// ...
const symbolMeta = useMemo(() => buildMeta(symbols), [symbols]);
```

۲) ورودیِ کوچکِ فعلیِ سویچر (خطِ ~۱۱۲۹) به یک **دکمهٔ بازکنندهٔ مدال** تبدیل شود:

```jsx
<button onClick={()=>setSymModal(true)}
  className="flex items-center gap-2 h-9 px-3 rounded-lg hover:bg-white/5 border"
  style={{ borderColor:'var(--bn-border,#2a2e39)' }} title="جستجوی نماد (Ctrl+K)">
  <SymbolLogo symbol={symbol} size={20} />
  <span className="font-bold text-sm" dir="ltr">{symbol}</span>
  <Search size={14} className="opacity-50" />
</button>
```

۳) رندرِ مدال (نزدیکِ بقیهٔ مدال‌ها):

```jsx
<SymbolSearchModal
  open={symModal} onClose={()=>setSymModal(false)}
  metaList={symbolMeta} watch={watch} current={symbol}
  onPick={(s)=> setSymbol(s)} />
```

۴) `filteredSymbols`/`search`/dropdownِ قدیمی (خطوطِ ~۲۰۷، ۱۱۲۰، ۱۱۳۲–۱۱۳۵) **حذف** شوند (با مدال جایگزین شدند).

---

## ۸) بهبودِ سایدبارِ راست (هم‌راستا با #۱۵ و #۴۵)

در `frontend/prochart/src/bazaarnama/RightPanel.jsx`:

- لیستِ نمادهای واچ‌لیست از همان `SymbolLogo` با `size={22}` استفاده می‌کند (الان هم همین است؛ نگه‌داشته شود؛ برای #۱۵ به ۲۸ افزایش یابد).
- لیستِ «افزودن» که الان `.slice(0,16)` است → اگر >۳۰ نماد بود، به‌جای برش، یک دکمهٔ «جستجوی همه…» که همان `SymbolSearchModal` را باز کند (ضدِ شلوغی).
- ردیفِ هر نماد: لوگو + تیکر + توضیحِ فارسیِ کوتاه (`classify(s).desc`) + ستارهٔ واچ‌لیست. مطابقِ چیدمانِ ردیفِ مدال برای یکدستی.

```jsx
// در RightPanel، برای هر نمادِ واچ‌لیست
import { classify } from './symbolMeta';
// ...
<div className="flex-1 min-w-0 text-right">
  <div className="font-bold text-[13px]" dir="ltr">{s}</div>
  <div className="text-[11px] opacity-55 truncate">{classify(s).desc}</div>
</div>
```

---

## ۹) چک‌لیستِ پیاده‌سازی

- [ ] `bazaarnama/symbolMeta.js` (classify/buildMeta/CATEGORIES)
- [ ] `bazaarnama/fuzzy.js` (matchSymbol/searchSymbols)
- [ ] `bazaarnama/VirtualList.jsx`
- [ ] `bazaarnama/SymbolSearchModal.jsx`
- [ ] `BazaarNama.jsx`: state `symModal`، افکتِ هاتکی، دکمهٔ سویچر، رندرِ مدال، حذفِ dropdownِ قدیمی
- [ ] `RightPanel.jsx`: توضیحِ فارسی + دکمهٔ «جستجوی همه…» وقتی نماد زیاد است
- [ ] هماهنگیِ `hotkeys.js` برای `/` و `Ctrl/⌘+K`
- [ ] لوگوهای کریپتو در `public/crypto-icons/{ticker}.svg` برای تیکرهای جدید موجود باشند (fallback خودکار است)

## ۱۰) معیارهای پذیرش (Acceptance)

1. `Ctrl/⌘+K` یا `/` مدال را باز می‌کند؛ فوکوس روی input.
2. تایپِ `eu` → `EURUSD` ردیفِ اول؛ `طلا` → `XAUUSD`؛ `ej` → `EURJPY` پیدا می‌شود (fuzzy).
3. تب‌ها به‌درستی فیلتر می‌کنند؛ تبِ «فارکس» هیچ نمادِ کریپتو (مثلِ BTCUSD) نشان نمی‌دهد (سازگار با #۶).
4. با ۲۰۰۰+ نماد، اسکرول روان است و DOM فقط ~۲۰ ردیف دارد (virtual).
5. `↑/↓` ردیفِ هایلایت را جابه‌جا و ویوپورت را همگام می‌کند؛ `Enter` انتخاب؛ `Esc` می‌بندد.
6. اخیراً‌دیده‌شده‌ها (localStorage، حداکثر ۸) و واچ‌لیست به‌صورتِ چیپ بالای نتایج وقتی کوئری خالی است.
7. هر ردیف: `SymbolLogo` + تیکر + توضیحِ فارسی + نشانهٔ واچ‌لیست.
8. بدونِ هیچ وابستگیِ npm جدید و بدونِ CDN خارجی.

## ۱۱) نکاتِ کارایی/RTL

- جهتِ کلیِ مدال RTL؛ اما **تیکرها `dir="ltr"`** و `tabular-nums` (مطابقِ استایلِ موجودِ بازارنما و اسپکِ TV-fidelity).
- debounceِ ۸۰ms؛ `searchSymbols` با `useMemo` کش می‌شود.
- `VirtualList` با `rowH` ثابت → بدونِ ResizeObserver/measure؛ سبک‌ترین مسیر.
- در صورتِ افزودنِ بک‌اندِ غنی (desc/exchange سمتِ سرور)، فقط `buildMeta` را با merge جایگزین کنید؛ بقیهٔ اجزا بدونِ تغییر می‌مانند.

---

### منابع
- [TradingView — Symbol Search tips](https://www.tradingview.com/support/solutions/43000746682-tradingview-symbol-search-tips-for-finding-assets/)
- [TradingView Advanced Charts — Symbol Search UI element](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Symbol-Search/)
- [TradingView — Search box shortcut (Ctrl+K)](https://www.cgaa.org/article/tradingview-symbol-search-shortcut)
