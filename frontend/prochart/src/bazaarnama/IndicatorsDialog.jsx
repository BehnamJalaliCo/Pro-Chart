// بازارنما — دیالوگِ کاملِ اندیکاتورها (کپیِ برابرِ اصلِ پنجرهٔ «Indicators, metrics & strategies» تریدینگ‌ویو).
// جایگزینِ dropdownِ کوچکِ قبلی. کاملاً مستقل و افزایشی؛ هیچ فایلِ مشترکی را تغییر نمی‌دهد.
//
// امضا:  export default function IndicatorsDialog({ open, onClose, TH, onPick })
//   - open      : bool  — نمایش/مخفی
//   - onClose   : ()    — بستنِ دیالوگ (X / Esc / کلیکِ بیرون)
//   - TH        : توکنِ تمِ فعلی (همان THEMES[theme] در BazaarNama)
//   - onPick    : (key) — با کلیدِ رجیستری صدا زده می‌شود؛ یکپارچه‌ساز اندیکاتور را
//                          اضافه می‌کند (addInd). دیالوگ باز می‌ماند تا چند افزودنِ پشت‌سرِ هم
//                          ممکن باشد (رفتارِ TVِ مدرن). اگر بخواهید ببندید، در onPick صدا بزنید.
//
// دادهٔ اندیکاتورها از رجیستریِ موجود می‌آید: indicators.js که خودش
// indicators_ext_a + indicators_ext_b را ادغام کرده. این‌جا فقط نام/توضیح/دسته
// را روکش (overlay) می‌زنیم؛ خودِ محاسبه‌ها دست‌نخورده‌اند.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Star, ChevronLeft, TrendingUp, Layers, Users, FileCode2, Sparkles, BarChart3, Activity, Info } from 'lucide-react';
import { REGISTRY } from './indicators';

// ───────────────────────── پایداریِ منتخب‌ها (هم‌کلیدِ BazaarNama) ─────────────────────────
// از همان workspaceِ اپ می‌خوانَد/می‌نویسد تا ستاره‌ها بینِ دیالوگ و dropdown/legend سینک بمانند.
const WS_KEY = 'bn_workspace';
const loadFavs = () => {
  try { const ws = JSON.parse(localStorage.getItem(WS_KEY) || '{}') || {}; return Array.isArray(ws.indFavs) ? ws.indFavs : []; } catch (e) { return []; }
};
const saveFavs = (arr) => {
  try {
    const ws = JSON.parse(localStorage.getItem(WS_KEY) || '{}') || {};
    ws.indFavs = arr;
    localStorage.setItem(WS_KEY, JSON.stringify(ws));
    // به یکپارچه‌ساز خبر بده (اختیاری) تا در همان لحظه dropdown/legend را تازه کند.
    window.dispatchEvent(new CustomEvent('bn-indfavs', { detail: arr }));
  } catch (e) { /* noop */ }
};

// ───────────────────────── نام‌های انگلیسیِ نمایشی (روکشِ رجیستری) ─────────────────────────
// رجیستری فقط labelِ فارسی دارد؛ این‌جا نامِ لاتینِ استانداردِ TV را کنارش نشان می‌دهیم.
const ENG = {
  ma: 'Moving Average', ema: 'EMA', wma: 'WMA', hma: 'Hull MA', vwap: 'VWAP', avwap: 'Anchored VWAP',
  smma: 'SMMA (RMA)', zlema: 'Zero-Lag EMA', kama: 'Kaufman AMA', t3: 'Tillson T3', mcginley: 'McGinley Dynamic',
  linreg: 'Linear Regression Curve', lsma: 'Least Squares MA', dema: 'Double EMA', tema: 'Triple EMA',
  vwma: 'VWMA', alma: 'Arnaud Legoux MA', maRibbon: 'MA Ribbon', gmma: 'Guppy MMA', maCross: 'MA Cross',
  envelopes: 'Envelopes', mtfEma: 'MTF EMA', mtfRsi: 'MTF RSI',
  bb: 'Bollinger Bands', bbpercent: 'Bollinger %B', bbw: 'Bollinger BandWidth', bbWidth: 'Bollinger BandWidth',
  keltner: 'Keltner Channels', donchian: 'Donchian Channels', stdErrBands: 'Standard Error Bands',
  supertrend: 'SuperTrend', psar: 'Parabolic SAR', ichimoku: 'Ichimoku Cloud', alligator: 'Williams Alligator',
  chandeKroll: 'Chande Kroll Stop', pivots: 'Pivot Points', pivotsMulti: 'Pivot Points (Multi)',
  pivotHL: 'Pivot Points High/Low', fractals: 'Williams Fractals', zigzag: 'Zig Zag', autoFib: 'Auto Fib',
  srLevels: 'Support & Resistance', supplyDemand: 'Supply & Demand',
  rsi: 'Relative Strength Index', macd: 'MACD', stoch: 'Stochastic', stochrsi: 'Stochastic RSI',
  cci: 'CCI', willr: 'Williams %R', adx: 'ADX', dmi: 'DMI', aroon: 'Aroon', mom: 'Momentum', roc: 'Rate of Change',
  trix: 'TRIX', ppo: 'PPO', ao: 'Awesome Oscillator', ac: 'Accelerator', accelerator: 'Accelerator',
  uo: 'Ultimate Oscillator', fisher: 'Fisher Transform', crsi: 'Connors RSI', smi: 'Stochastic Momentum Index',
  smiErgodic: 'SMI Ergodic', tsi: 'True Strength Index', cmo: 'Chande Momentum', kst: 'Know Sure Thing',
  coppock: 'Coppock Curve', stc: 'Schaff Trend Cycle', rvi: 'Relative Vigor Index', bop: 'Balance of Power',
  vortex: 'Vortex Indicator', dpo: 'Detrended Price', choppiness: 'Choppiness Index', massIndex: 'Mass Index',
  elderRay: 'Elder Ray', eom: 'Ease of Movement',
  atr: 'Average True Range', stddev: 'Standard Deviation', hv: 'Historical Volatility',
  chaikinVol: 'Chaikin Volatility',
  obv: 'On Balance Volume', mfi: 'Money Flow Index', cmf: 'Chaikin Money Flow', netVolume: 'Net Volume',
  volume: 'Volume', adline: 'Accumulation/Distribution', chaikinOsc: 'Chaikin Oscillator',
  forceIndex: 'Force Index', klinger: 'Klinger Oscillator', pvt: 'Price Volume Trend',
};
const engOf = (k) => ENG[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

// ───────────────────────── توضیحِ کوتاهِ hover (fallback عمومی) ─────────────────────────
const DESC = {
  ma: 'میانگینِ سادهٔ قیمت روی n کندلِ اخیر؛ صاف‌کنندهٔ روند.',
  ema: 'میانگینِ نماییِ متحرک؛ وزنِ بیشتر به قیمت‌های اخیر.',
  vwap: 'قیمتِ میانگینِ وزن‌دهی‌شده با حجم؛ مرجعِ منصفانهٔ روز.',
  bb: 'باندهای انحرافِ معیار حولِ میانگین؛ سنجشِ نوسان و اشباع.',
  rsi: 'قدرتِ نسبیِ حرکت؛ اشباعِ خرید >۷۰ و فروش <۳۰.',
  macd: 'تفاضلِ دو EMA + خطِ سیگنال؛ مومنتوم و تقاطع‌ها.',
  stoch: 'موقعیتِ بسته‌شدن در بازهٔ n کندل؛ اشباع >۸۰/<۲۰.',
  atr: 'میانگینِ دامنهٔ واقعی؛ سنجهٔ نوسانِ خام (نه جهت).',
  adx: 'قدرتِ روند (نه جهت)؛ >۲۵ یعنی روندِ قوی.',
  supertrend: 'خطِ روندِ مبتنی‌بر ATR؛ سیگنالِ خرید/فروشِ پیوسته.',
  ichimoku: 'سیستمِ کاملِ ابر: روند، حمایت/مقاومت و سیگنال.',
  obv: 'حجمِ تجمعیِ جهت‌دار؛ تأییدِ روند با فشارِ خرید/فروش.',
  psar: 'نقاطِ توقف‌وبازگشتِ پارابولیک؛ تریلینگ‌استاپِ روندی.',
  vwma: 'میانگینِ متحرکِ وزنی با حجم؛ حساس به مشارکت.',
  mfi: 'RSIِ حجمی؛ فشارِ ورود/خروجِ پول در بازهٔ ۰ تا ۱۰۰.',
};
const descOf = (k, pane) => DESC[k] || (pane === 'main' ? 'اندیکاتورِ روی چارتِ اصلی (overlay).' : 'اندیکاتورِ پنجرهٔ جداگانه (oscillator).');

// ───────────────────────── بَجِ NEW / BETA (مجموعهٔ کوچکِ منتخب) ─────────────────────────
const BADGE = {
  supertrend: 'NEW', avwap: 'NEW', autoFib: 'NEW', supplyDemand: 'NEW',
  smiErgodic: 'BETA', crsi: 'BETA', mtfRsi: 'BETA', mtfEma: 'BETA',
};

// ───────────────────────── دسته‌بندیِ سمتِ چپِ TV (گروه‌بندی‌شده) ─────────────────────────
// TV دسته‌ها را زیرِ سرتیترهای PERSONAL / BUILT-IN / COMMUNITY می‌چیند. این‌جا همان ساختار.
// همهٔ اندیکاتورهای رجیستری «تکنیکال»‌اند؛ سایر دسته‌ها placeholderهای پاریتیِ TV‌اند.
const CAT_GROUPS = [
  {
    id: 'grp-personal', label: 'شخصی', en: 'Personal', items: [
      { id: 'favorites', label: 'منتخب‌ها',      en: 'Favorites',  icon: Star },
      { id: 'personal',  label: 'اسکریپت‌های من', en: 'My scripts', icon: FileCode2 },
    ],
  },
  {
    id: 'grp-builtin', label: 'داخلی', en: 'Built-in', items: [
      { id: 'technicals',   label: 'تکنیکال', en: 'Technicals',   icon: TrendingUp },
      { id: 'fundamentals', label: 'بنیادی',  en: 'Fundamentals', icon: BarChart3 },
    ],
  },
  {
    id: 'grp-community', label: 'جامعه', en: 'Community', items: [
      { id: 'community', label: 'جامعه', en: 'Community', icon: Users },
    ],
  },
];
const CATS = CAT_GROUPS.flatMap((g) => g.items);
const TABS = [
  { id: 'indicators', label: 'اندیکاتورها',   en: 'Indicators' },
  { id: 'strategies', label: 'استراتژی‌ها',    en: 'Strategies' },
  { id: 'profiles',   label: 'پروفایل‌ها',     en: 'Profiles' },
  { id: 'patterns',   label: 'الگوها',        en: 'Patterns' },
];

// نرمال‌سازیِ متن برای سرچِ فازیِ فارسی/عربی (یِ/کِ عربی → فارسی، حذفِ اعرابِ جزئی).
const norm = (s) => (s || '')
  .toString().toLowerCase()
  .replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ')
  .replace(/[ً-ْ]/g, '').trim();

export default function IndicatorsDialog({ open, onClose, TH, onPick }) {
  const [cat, setCat] = useState('technicals');
  const [tab, setTab] = useState('indicators');
  const [q, setQ] = useState('');
  const [favs, setFavs] = useState(loadFavs);
  const [added, setAdded] = useState(null); // کلیدِ آخرین اندیکاتورِ اضافه‌شده (فیدبکِ ✓)
  const searchRef = useRef(null);
  const addedTimer = useRef(null);

  // با هر باز شدن: فوکوس روی سرچ، تازه‌سازیِ منتخب‌ها، پاک‌سازیِ کوئری.
  useEffect(() => {
    if (!open) return undefined;
    setFavs(loadFavs());
    setQ('');
    const t = setTimeout(() => { if (searchRef.current) searchRef.current.focus(); }, 30);
    return () => clearTimeout(t);
  }, [open]);

  // Esc → بستن.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose && onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  useEffect(() => () => { if (addedTimer.current) clearTimeout(addedTimer.current); }, []);

  const toggleFav = (k) => {
    setFavs((prev) => {
      const next = prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k];
      saveFavs(next);
      return next;
    });
  };

  const handlePick = (k) => {
    if (onPick) onPick(k);
    setAdded(k);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(null), 900);
  };

  // فهرستِ کاملِ رجیستری (کلید + متادیتای نمایشی) — یک‌بار.
  const allItems = useMemo(() => Object.entries(REGISTRY).map(([key, def]) => ({
    key,
    label: def.label || key,
    eng: engOf(key),
    pane: def.pane === 'main' ? 'main' : 'sub',
    color: def.color || TH.accent,
    badge: BADGE[key] || null,
    desc: descOf(key, def.pane),
    hay: norm(`${def.label} ${key} ${engOf(key)}`),
  })), [TH.accent]);

  // فیلترِ سرچ + دسته + تب، سپس مرتبِ الفباییِ فارسی (پاریتیِ لیستِ الفباییِ TV).
  const filtered = useMemo(() => {
    const nq = norm(q);
    let base = allItems;
    if (cat === 'favorites') base = base.filter((it) => favs.includes(it.key));
    // تب‌های Strategies/Profiles/Patterns فعلاً کاتالوگِ اندیکاتوری ندارند → خالی (empty-state).
    if (tab !== 'indicators') base = [];
    if (nq) base = base.filter((it) => it.hay.includes(nq));
    return base.slice().sort((a, b) => a.label.localeCompare(b.label, 'fa'));
  }, [allItems, q, cat, tab, favs]);

  if (!open) return null;

  const isEmptyCat = (tab === 'indicators') && (cat === 'fundamentals' || cat === 'community' || cat === 'personal');
  const showEmpty = tab !== 'indicators' || isEmptyCat || filtered.length === 0;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: TH.overlayMask || 'rgba(0,0,0,.5)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
    >
      <div
        className="w-full max-w-[880px] rounded-lg overflow-hidden flex flex-col pc-pop"
        style={{
          height: 'min(600px, 88vh)',
          background: TH.panel,
          border: `1px solid ${TH.border}`,
          boxShadow: '0 12px 40px rgba(0,0,0,.35)',
          color: TH.textStrong,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ───────── هدر: عنوان + سرچِ زنده + بستن ───────── */}
        <div className="flex items-center gap-3 px-4 h-[52px] shrink-0 border-b" style={{ borderColor: TH.border }}>
          <div className="flex items-center gap-2 shrink-0">
            <Activity size={18} style={{ color: TH.accent }} />
            <span className="font-bold text-[14px]">اندیکاتورها، سنجه‌ها و استراتژی‌ها</span>
          </div>
          <div className="flex-1 min-w-0 flex items-center gap-2 h-8 px-2.5 rounded-md"
            style={{ background: TH.chipBg, border: `1px solid ${TH.border}` }}>
            <Search size={15} style={{ color: TH.text }} />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو در بیش از ۱۰۰ اندیکاتور…"
              className="flex-1 bg-transparent outline-none text-[13px] min-w-0"
              style={{ color: TH.textStrong }}
            />
            {q && (
              <button onClick={() => { setQ(''); if (searchRef.current) searchRef.current.focus(); }} title="پاک‌کردن"
                className="p-0.5 rounded hover:opacity-100 opacity-60" style={{ color: TH.text }}>
                <X size={14} />
              </button>
            )}
          </div>
          <button onClick={() => onClose && onClose()} title="بستن (Esc)"
            className="p-1.5 rounded-md transition-colors duration-[120ms] shrink-0"
            style={{ color: TH.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <X size={18} />
          </button>
        </div>

        {/* ───────── تب‌ها: Indicators / Strategies / Profiles / Patterns (پیل مثلِ TV) ───────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 shrink-0 border-b" style={{ borderColor: TH.border }}>
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-3.5 h-8 rounded-full text-[13px] font-semibold transition-colors duration-[120ms]"
                style={{
                  color: on ? (TH.panel === '#f0f3fa' ? '#fff' : TH.textStrong) : TH.text,
                  background: on ? (TH.panel === '#f0f3fa' ? '#131722' : TH.chipBg) : 'transparent',
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.subtle; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ───────── بدنه: دستهٔ کناری + لیست ───────── */}
        <div className="flex-1 flex min-h-0">
          {/* دستهٔ کناری (سمتِ شروع/راستِ RTL — همان «چپِ» TV) */}
          <div className="w-[190px] shrink-0 border-l overflow-y-auto bn-thin-scroll py-1.5" style={{ borderColor: TH.border, background: TH.subtle }}>
            {CAT_GROUPS.map((grp) => (
              <div key={grp.id} className="mb-1">
                <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold tracking-wider opacity-45 flex items-center gap-1.5">
                  <span>{grp.label}</span>
                  <span dir="ltr" className="opacity-70">{grp.en}</span>
                </div>
                {grp.items.map((c) => {
                  const on = cat === c.id;
                  const Icon = c.icon;
                  const count = c.id === 'favorites' ? favs.length : (c.id === 'technicals' ? allItems.length : 0);
                  return (
                    <button key={c.id} onClick={() => setCat(c.id)}
                      className="w-full flex items-center gap-2.5 px-4 py-1.5 text-[13px] text-right transition-colors duration-[120ms]"
                      style={{
                        color: on ? TH.textStrong : TH.text,
                        background: on ? TH.chipBg : 'transparent',
                        fontWeight: on ? 700 : 500,
                        borderRight: on ? `2px solid ${TH.accent}` : '2px solid transparent',
                      }}
                      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBg; }}
                      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                      <Icon size={16} style={{ color: on ? TH.accent : TH.text, fill: c.id === 'favorites' && on ? TH.accent : 'none' }} />
                      <span className="flex-1">{c.label}</span>
                      {count > 0 && (
                        <span className="text-[10px] tabular-nums opacity-60 tnum" dir="ltr">{count}</span>
                      )}
                    </button>
                  );
                })}

                {/* زیرشاخه‌های جامعه (پاریتیِ TV) */}
                {grp.id === 'grp-community' && cat === 'community' && (
                  <div className="mt-0.5">
                    {['منتخبِ سردبیران', 'برترین‌ها', 'پرطرفدار', 'فروشگاه'].map((s) => (
                      <div key={s} className="py-1 pr-10 pl-2 text-[12px] opacity-50">{s}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* لیستِ اصلی */}
          <div className="flex-1 min-w-0 overflow-y-auto bn-thin-scroll">
            {showEmpty ? (
              <EmptyState TH={TH} tab={tab} cat={cat} hasQuery={!!q} onOpenScripts={() => { /* یکپارچه‌ساز می‌تواند وصل کند */ }} />
            ) : (
              <div className="pb-1.5">
                {/* سرتیترِ لیستِ الفبایی — «SCRIPT NAME»ِ TV */}
                <div className="sticky top-0 z-10 px-4 py-1.5 text-[10.5px] font-bold tracking-wider flex items-center gap-1.5"
                  style={{ color: TH.text, background: TH.panel, borderBottom: `1px solid ${TH.border}` }}>
                  <span>نامِ اسکریپت</span>
                  <span className="opacity-40" dir="ltr">SCRIPT NAME</span>
                  <span className="opacity-40 tabular-nums tnum mr-auto" dir="ltr">{filtered.length}</span>
                </div>
                {filtered.map((it) => {
                  const isFav = favs.includes(it.key);
                  const justAdded = added === it.key;
                  return (
                    <div key={it.key}
                      className="group flex items-center gap-2.5 px-4 py-2 cursor-pointer transition-colors duration-[120ms]"
                      title={it.desc}
                      onClick={() => handlePick(it.key)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      {/* نام‌ها */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-[13px] font-medium truncate" style={{ color: TH.textStrong }}>{it.label}</span>
                        <span className="text-[11.5px] truncate opacity-55" dir="ltr" style={{ color: TH.text }}>{it.eng}</span>
                        {it.badge && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-px rounded"
                            dir="ltr"
                            style={it.badge === 'NEW'
                              ? { color: '#fff', background: TH.up }
                              : { color: TH.accent, border: `1px solid ${TH.accent}`, background: 'transparent' }}>
                            {it.badge}
                          </span>
                        )}
                      </div>

                      {/* بَجِ pane (روی چارت / پنجرهٔ جدا) — فقط هنگامِ hover */}
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms]"
                        style={{ color: TH.text, background: TH.chipBg }}>
                        {it.pane === 'main' ? 'روی چارت' : 'پنجرهٔ جدا'}
                      </span>

                      {/* فیدبکِ افزودن (هنگامِ hover) */}
                      {justAdded ? (
                        <span className="shrink-0 text-[11px] font-bold" style={{ color: TH.up }}>✓ افزوده شد</span>
                      ) : (
                        <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms]" style={{ color: TH.accent }}>
                          <ChevronLeft size={16} />
                        </span>
                      )}

                      {/* ستارهٔ منتخب — لبهٔ پایانی مثلِ TV؛ همیشه اگر منتخب، وگرنه هنگامِ hover */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFav(it.key); }}
                        title={isFav ? 'حذف از منتخب‌ها' : 'افزودن به منتخب‌ها'}
                        className="shrink-0 p-0.5 rounded transition-opacity duration-[120ms]"
                        style={{ opacity: isFav ? 1 : undefined }}>
                        <Star size={15}
                          className={isFav ? '' : 'opacity-0 group-hover:opacity-40'}
                          style={isFav ? { fill: TH.accent, color: TH.accent } : { color: TH.text }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ───────── پاورقی ───────── */}
        <div className="flex items-center gap-2 px-4 h-[38px] shrink-0 border-t text-[11px]" style={{ borderColor: TH.border, color: TH.text }}>
          <Info size={13} className="opacity-60" />
          <span className="opacity-70">برای افزودن روی اندیکاتور کلیک کنید؛ دیالوگ باز می‌مانَد تا چند افزودنِ پیاپی ممکن باشد.</span>
          <span className="mr-auto tabular-nums tnum opacity-60" dir="ltr">{allItems.length} indicators</span>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── حالتِ خالی (پاریتیِ تب/دستهٔ بدونِ کاتالوگ) ─────────────────────────
function EmptyState({ TH, tab, cat, hasQuery }) {
  let title = 'موردی یافت نشد';
  let sub = 'کلیدواژهٔ دیگری را امتحان کنید.';
  let Icon = Search;
  if (!hasQuery) {
    if (tab === 'strategies') { title = 'استراتژی‌ای موجود نیست'; sub = 'استراتژی‌ها با نمااسکریپت ساخته می‌شوند؛ به‌زودی در این تب فهرست می‌شوند.'; Icon = Sparkles; }
    else if (tab === 'profiles') { title = 'پروفایلِ حجمی'; sub = 'پروفایل‌های حجمی (Volume Profile) از منوی ابزارِ چارت در دسترس‌اند.'; Icon = BarChart3; }
    else if (tab === 'patterns') { title = 'الگوها'; sub = 'تشخیصِ الگوهای کندلی/هارمونیک به‌زودی افزوده می‌شود.'; Icon = Layers; }
    else if (cat === 'fundamentals') { title = 'دادهٔ بنیادی'; sub = 'سنجه‌های بنیادی برای سهام‌اند؛ برای فارکس/فلزات در دسترس نیستند.'; Icon = BarChart3; }
    else if (cat === 'community') { title = 'اسکریپت‌های جامعه'; sub = 'اسکریپت‌های منتشرشدهٔ کاربران به‌زودی این‌جا فهرست می‌شوند.'; Icon = Users; }
    else if (cat === 'personal') { title = 'اسکریپت‌های من'; sub = 'اسکریپت‌های شخصی را در ویرایشگرِ نمااسکریپت بسازید و ذخیره کنید.'; Icon = FileCode2; }
    else if (cat === 'favorites') { title = 'هنوز منتخبی ندارید'; sub = 'با ستارهٔ کنارِ هر اندیکاتور آن را به منتخب‌ها اضافه کنید.'; Icon = Star; }
  }
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2.5 px-8 text-center">
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: TH.chipBg }}>
        <Icon size={22} style={{ color: TH.text }} />
      </div>
      <div className="text-[14px] font-bold" style={{ color: TH.textStrong }}>{title}</div>
      <div className="text-[12px] max-w-[320px] leading-relaxed" style={{ color: TH.text }}>{sub}</div>
    </div>
  );
}
