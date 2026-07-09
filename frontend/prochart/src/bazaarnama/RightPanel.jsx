import React from 'react';
import { X, Sparkles, ShoppingCart, Plus, Flag, Search, MoreVertical, ChevronDown, List, Table, FolderPlus, Pencil, Trash2, Star, BrainCircuit, ScanLine, Info, Newspaper, CalendarDays, LineChart, BellRing, ChevronRight, ChevronLeft } from 'lucide-react';
import AlertsPanel from './AlertsPanel';
import Screener from './panels/Screener';
import Details from './panels/Details';
import NewsTab from './panels/NewsTab';
import Calendar from './panels/Calendar';
import SymbolLogo from './SymbolLogo';
import OrderTicket from './OrderTicket';

// پنلِ راست — نوارِ تب + بدنه‌های inline (watch/ai/trade) و واگذاری به پنل‌های جدا
// (Screener/Details/NewsTab/Calendar/AlertsPanel). همهٔ state/handlerها از props می‌آیند؛
// رفتارِ max-md drawer عیناً حفظ شده است.
//
// #15 — بازطراحیِ واچ‌لیست: لوگوی بزرگ‌تر و نمایان، تفکیکِ رنگی (Flag)، گروه‌بندی
// (سکشن دستی / نوعِ خودکار)، نمای لیست/جدول، مرتب‌سازی، جستجوی افزودنِ نماد و چند
// واچ‌لیستِ مجزا. منبعِ «وجودِ نماد» همان propِ `watch` (آرایهٔ مسطح، سینکِ سرور)
// می‌ماند؛ متادیتای غنی (flag/section/prefs/چندلیست) فقط در localStorage نگه‌داری
// می‌شود تا backend و BazaarNama.jsx دست‌نخورده و سازگارِ عقب‌رو بمانند.

const _CCY3 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'XAU', 'XAG', 'XPT', 'XPD'];
// نمایشِ خواناتر: جفت‌ارز → EUR/USD ؛ بقیه بدونِ تغییر.
const prettySym = (s = '') => {
  const u = String(s).toUpperCase();
  if (u.length === 6 && _CCY3.includes(u.slice(0, 3)) && _CCY3.includes(u.slice(3, 6))) return `${u.slice(0, 3)}/${u.slice(3, 6)}`;
  return s;
};

// ── تفکیکِ رنگیِ TradingView (۷ رنگ) ──────────────────────────────────────────
const FLAG_HEX = {
  red: '#f23645', orange: '#ff9800', yellow: '#ffd60a', green: '#22c55e',
  blue: '#2196f3', purple: '#9c27b0', gray: '#787b86',
};
const FLAG_ORDER = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'];

// ── نوعِ نماد (برای گروه‌بندیِ خودکار) — هم‌منطق با SymbolLogo.jsx ─────────────
const KIND_LABEL = { forex: 'فارکس', metal: 'فلزات', index: 'شاخص‌ها', crypto: 'کریپتو' };
const KIND_ORDER = ['forex', 'metal', 'index', 'crypto'];

// ── ستون‌های قابل‌انتخابِ واچ‌لیست (سبکِ TV) — قیمت همیشه هست؛ این‌ها اختیاری‌اند ──
// High/Low/Range از streamِ زندهٔ همین سشن ساخته می‌شوند (دادهٔ واقعی، نه ساختگی)،
// چون payloadِ سرور فقط { mid, dir } دارد.
const COLUMNS = [
  ['change', 'تغییر٪'],
  ['high', 'سقف'],
  ['low', 'کف'],
  ['range', 'دامنه٪'],
];
function symbolKind(sym = '') {
  const s = String(sym).toUpperCase();
  const a = s.replace(/[^A-Z]/g, '');
  if (a.length >= 6) {
    const x = a.slice(0, 3), y = a.slice(3, 6);
    if (_CCY3.includes(x) && _CCY3.includes(y)) {
      if (/^(XAU|XAG|XPT|XPD)/.test(s)) return 'metal';
      return 'forex';
    }
  }
  if (/^(XAU|XAG|XPT|XPD)/.test(s)) return 'metal';
  if (/US30|US500|NAS100|NAS|SPX|DJI|NDX|UK100|DE40|JP225|US100|FRA40|HK50/.test(s)) return 'index';
  return 'crypto';
}

// ── persist محلی (مستقل از سرور؛ کلیدِ جدا تا WS_KEY دست‌نخورده بماند) ─────────
const WM_KEY = 'bn_watch_meta';
const uid = () => Math.random().toString(36).slice(2, 9);

function defaultMeta() {
  const id = uid();
  return {
    lists: [{ id, name: 'پیش‌فرض', items: {}, sections: [] }], // items: { [sym]: {flag, section} }
    activeListId: id,
    view: 'list',          // 'list' | 'table'
    showLogo: true,
    showDesc: false,
    logoSize: 'lg',        // 'md' | 'lg'
    sortBy: 'manual',      // 'manual' | 'name' | 'price' | 'changePct'
    sortDir: 'asc',
    groupBy: 'none',       // 'section' | 'type' | 'none'
    flagFilter: null,      // یک رنگ برای فیلتر یا null
    columns: ['change'],   // ستون‌های عددیِ اختیاری (قیمت همیشه هست)
  };
}

function loadMeta() {
  try {
    const raw = JSON.parse(localStorage.getItem(WM_KEY) || 'null');
    if (!raw || !Array.isArray(raw.lists) || raw.lists.length === 0) return defaultMeta();
    // مهاجرتِ نرم: کلیدهای جا‌افتاده را با پیش‌فرض پر کن
    const base = defaultMeta();
    const lists = raw.lists.map((l) => ({
      id: l.id || uid(),
      name: l.name || 'لیست',
      items: l.items && typeof l.items === 'object' ? l.items : {},
      sections: Array.isArray(l.sections) ? l.sections : [],
    }));
    const activeListId = lists.some((l) => l.id === raw.activeListId) ? raw.activeListId : lists[0].id;
    const columns = Array.isArray(raw.columns) ? raw.columns : base.columns;
    return { ...base, ...raw, lists, activeListId, columns };
  } catch (e) {
    return defaultMeta();
  }
}

// ── نمایشِ نماد / قیمت ────────────────────────────────────────────────────────
// درصدِ تغییر: اول از فیلدهای رایجِ live (changePct/prevClose/open) استفاده می‌کند
// تا با هر ساختارِ payload سازگارِ عقب‌رو بماند؛ اگر هیچ‌کدام نبود، نسبت به baselineِ
// سشن (اولین mid که دیده‌ایم) محاسبه می‌کند تا فیچرِ ٪ واقعاً زنده کار کند —
// چون payloadِ فعلیِ سرور فقط { mid, dir } دارد.
function changePctOf(lp, baseline) {
  if (!lp) return null;
  if (typeof lp.changePct === 'number') return lp.changePct;
  if (typeof lp.chgPct === 'number') return lp.chgPct;
  const cur = typeof lp.mid === 'number' ? lp.mid : (typeof lp.price === 'number' ? lp.price : null);
  const prev = typeof lp.prevClose === 'number' ? lp.prevClose
    : (typeof lp.open === 'number' ? lp.open : (typeof baseline === 'number' ? baseline : null));
  if (cur != null && prev) return ((cur - prev) / prev) * 100;
  return null;
}

// ── متادیتای تب‌ها (آیکن + برچسب) — مرجعِ واحد برای نوارِ تب و دستگیرهٔ drawer ──
const TABS = [
  ['watch', 'واچ‌لیست', Star],
  ['ai', 'سیگنال AI', BrainCircuit],
  ['screener', 'اسکنر', ScanLine],
  ['details', 'جزئیات', Info],
  ['news', 'اخبار', Newspaper],
  ['cal', 'تقویم', CalendarDays],
  ['trade', 'ترید', LineChart],
  ['alerts', 'آلارم', BellRing],
];

export default function RightPanel({
  TH, rightTab, setRightTab,
  symbol, setSymbol, symbols, live, tf,
  watch, toggleWatch, fmtPrice,
  aiBusy, aiQuota, aiList, aiSig,
  getAiSignal, gotoSignal, deleteSignal, clearAiSig,
  order, setOrder, startTrade, submitOrder, curPrice, livePrice, quickTrade,
  overlays, subs,
  // #9 — حالتِ کشویی (drawer). پراپِ اختیاریِ جدید؛ نبودش = رفتارِ قبلیِ کاملاً سازگارِ عقب‌رو.
  // drawer=true: یک دستگیرهٔ همیشه‌مرئی کنارِ پنل می‌گذارد و پنل را باز/بسته می‌کند.
  drawer = false, drawerOpen, onDrawerToggle,
}) {
  // اگر والد حالتِ باز/بسته را کنترل نکند، خودمان نگه می‌داریم (uncontrolled).
  const [openSelf, setOpenSelf] = React.useState(true);
  const isOpen = drawer ? (drawerOpen != null ? drawerOpen : openSelf) : true;
  const toggleDrawer = React.useCallback(() => {
    if (onDrawerToggle) onDrawerToggle(!isOpen);
    if (drawerOpen == null) setOpenSelf((v) => !v);
  }, [isOpen, drawerOpen, onDrawerToggle]);

  // باز کردنِ drawer روی تبِ خاص (کلیک روی آیکنِ دستگیره وقتی بسته است)
  const openTab = (k) => { setRightTab(k); if (drawer && !isOpen) toggleDrawer(); };

  // ── دستگیرهٔ عمودیِ drawer (#9) — نشانهٔ واضحِ «اینجا پنلی هست» ──
  // ریلِ باریکِ آیکن‌دار که همیشه دیده می‌شود؛ کلیک روی هر آیکن همان تب را باز می‌کند،
  // و فلش بالای ریل کلِ پنل را جمع/باز می‌کند.
  const Handle = drawer ? (
    <div className="shrink-0 flex flex-col items-center gap-1 py-2 border-l select-none" dir="rtl"
      style={{ width: 38, borderColor: TH.border, background: TH.subtle }}>
      <button onClick={toggleDrawer} title={isOpen ? 'جمع‌کردنِ پنل' : 'بازکردنِ پنل'}
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors mb-1"
        style={{ color: TH.textStrong, background: TH.chipBg }}
        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
        {isOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
      {TABS.map(([k, l, Icon]) => {
        const active = rightTab === k && isOpen;
        const acc = k === 'ai' ? TH.accentAi : TH.accent;
        return (
          <button key={k} title={l} onClick={() => openTab(k)}
            className="relative w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: active ? '#fff' : TH.text, background: active ? acc : 'transparent' }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
            <Icon size={15} />
            {!isOpen && rightTab === k && <span className="absolute right-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full" style={{ background: acc }} />}
          </button>
        );
      })}
    </div>
  ) : null;

  // وقتی drawer بسته است، فقط دستگیره را نشان بده (پنل جمع شده).
  if (drawer && !isOpen) {
    return (
      <div dir="rtl" className="flex h-full shrink-0 max-md:absolute max-md:left-0 max-md:top-0 max-md:bottom-0 max-md:z-40">
        {Handle}
      </div>
    );
  }

  const panel = (
    <div dir="rtl" className="w-64 border-l overflow-hidden shrink-0 flex flex-col max-md:absolute max-md:left-0 max-md:top-0 max-md:bottom-0 max-md:z-40 max-md:shadow-2xl" style={{ borderColor: TH.border, background: TH.bg }}>
      {/* نوارِ تب — آیکن‌دار، با اندیکاتورِ پایینِ نرم و حالتِ AI متمایز */}
      <div className="flex border-b overflow-x-auto bn-thin-scroll shrink-0" style={{ borderColor: TH.border, background: TH.bg }}>
        {TABS.map(([k, l, Icon]) => {
          const active = rightTab === k;
          const acc = k === 'ai' ? TH.accentAi : TH.accent;
          return (
            <button key={k} onClick={() => setRightTab(k)} title={l}
              className={`group/tab relative shrink-0 whitespace-nowrap flex items-center gap-1 px-2.5 py-2 text-[11px] transition-colors duration-[120ms] ${active ? '' : 'opacity-55 hover:opacity-100'}`}
              style={active ? { color: acc } : { color: TH.text }}>
              <Icon size={13} className="shrink-0" />
              <span>{l}</span>
              <span className="absolute left-1.5 right-1.5 -bottom-px h-[2px] rounded-full transition-all duration-150"
                style={{ background: acc, opacity: active ? 1 : 0, transform: active ? 'scaleX(1)' : 'scaleX(0.4)' }} />
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto min-h-0 bn-thin-scroll">
      {rightTab === 'details' ? (
        <Details symbol={symbol} TH={TH} symbols={symbols} prices={live} />
      ) : rightTab === 'news' ? (
        <NewsTab symbol={symbol} TH={TH} />
      ) : rightTab === 'cal' ? (
        <Calendar symbol={symbol} TH={TH} />
      ) : rightTab === 'watch' ? (
        <Watchlist
          TH={TH} symbol={symbol} setSymbol={setSymbol} symbols={symbols}
          live={live} watch={watch} toggleWatch={toggleWatch} fmtPrice={fmtPrice}
        />
      ) : rightTab === 'ai' ? (
        <div className="p-2 text-xs space-y-2">
          <button onClick={getAiSignal} disabled={aiBusy} className="w-full py-2 rounded-md text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 transition-opacity duration-[120ms]" style={{ background: TH.accentAi }}>
            <Sparkles size={14} className={aiBusy ? 'animate-pulse' : ''} /> {aiBusy ? 'در حال تحلیل…' : 'سیگنالِ AI برای ' + symbol}
          </button>
          {aiQuota && <div className="text-center text-[10px] opacity-60">سهمیهٔ امروز: {aiQuota.remaining} از {aiQuota.limit} ({aiQuota.tier})</div>}
          {aiList.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] opacity-50 px-1">ستاپ‌های من — روی هرکدام بزن تا چارت همان‌جا برود:</div>
              {aiList.map((s) => {
                const b = s.direction === 'buy';
                const sm = { active: ['فعال', '#3b82f6'], tp1: ['TP1 ✅', '#22c55e'], tp2: ['TP2 ✅', '#22c55e'], tp3: ['TP3 🎯', '#22c55e'], sl: ['SL', '#ef4444'] };
                const sv = sm[s.status] || sm.active;
                const cur = s.symbol === symbol && s.tf === tf;
                return (
                  <div key={s.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 border" style={{ borderColor: cur ? '#8b5cf6' : TH.border, background: TH.subtle }}>
                    <button onClick={() => gotoSignal(s)} className="flex-1 flex items-center gap-1.5 min-w-0" title="رفتن به این ستاپ روی چارت">
                      <span>{b ? '🟢' : '🔴'}</span>
                      <span className="font-bold whitespace-nowrap" dir="ltr">{s.symbol}·{s.tf}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: sv[1] + '22', color: sv[1] }}>{sv[0]}</span>
                      {cur && <span className="text-[9px] text-violet-400 whitespace-nowrap">• روی چارت</span>}
                    </button>
                    <button onClick={() => deleteSignal(s)} title="حذفِ سیگنال" className="opacity-40 hover:opacity-100 shrink-0"><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          )}
          {aiSig ? (() => {
            const buy = aiSig.direction === 'buy';
            const stMap = { active: ['فعال', '#3b82f6'], tp1: ['TP1 خورد ✅', '#22c55e'], tp2: ['TP2 خورد ✅', '#22c55e'], tp3: ['TP3 خورد 🎯', '#22c55e'], sl: ['حد ضرر خورد', '#ef4444'] };
            const stv = stMap[aiSig.status] || stMap.active;
            return (
              <div className="rounded-xl p-3 border" style={{ borderColor: TH.border, background: TH.subtle }}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-black ${buy ? 'text-green-400' : 'text-red-400'}`}>{buy ? '🟢 خرید' : '🔴 فروش'} {aiSig.symbol} · {aiSig.tf}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: stv[1] + '22', color: stv[1] }}>{stv[0]}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full" style={{ width: `${aiSig.confidence}%`, background: aiSig.confidence >= 75 ? '#22c55e' : aiSig.confidence >= 60 ? '#f59e0b' : '#ef4444' }} /></div>
                  <span className="text-[11px] font-bold">{aiSig.confidence}٪</span>
                </div>
                <p className="text-[11px] opacity-80 leading-5 mb-2">{aiSig.reason}</p>
                <div className="space-y-1 font-mono text-[11px]" dir="ltr">
                  <div className="flex justify-between"><span className="text-blue-400">Entry</span><b>{aiSig.entry}</b></div>
                  <div className="flex justify-between"><span className="text-red-400">SL</span><b className="text-red-400">{aiSig.sl}</b></div>
                  <div className="flex justify-between"><span className="text-green-400">TP1</span><b className="text-green-400">{aiSig.tp1}</b></div>
                  {aiSig.tp2 && <div className="flex justify-between"><span className="text-green-500">TP2</span><b className="text-green-500">{aiSig.tp2}</b></div>}
                  {aiSig.tp3 && <div className="flex justify-between"><span className="text-green-600">TP3</span><b className="text-green-600">{aiSig.tp3}</b></div>}
                </div>
                <button onClick={clearAiSig} className="w-full mt-2 py-1 rounded text-[11px] opacity-60 hover:opacity-100" style={{ background: TH.chipBg }}>پاک‌کردنِ سیگنال از چارت</button>
              </div>
            );
          })() : <div className="opacity-50 text-[11px] text-center py-3">دکمهٔ بالا را بزن تا قوی‌ترین هوشِ مصنوعی یک ستاپِ کامل (ورود/حدضرر/اهداف) بچیند.</div>}
        </div>
      ) : rightTab === 'screener' ? (
        <Screener symbol={symbol} TH={TH} symbols={symbols} prices={live} setSymbol={setSymbol} />
      ) : rightTab === 'trade' ? (
        <OrderTicket
          TH={TH} symbol={symbol}
          order={order} setOrder={setOrder} startTrade={startTrade} submitOrder={submitOrder}
          curPrice={curPrice} livePrice={livePrice} fmtPrice={fmtPrice}
        />
      ) : (
        <div className="p-2 text-xs">
          <AlertsPanel symbol={symbol} price={curPrice() || livePrice} TH={TH} indicators={[...overlays, ...subs]} />
          <div className="mt-3 flex gap-1"><button onClick={() => quickTrade('buy')} className="flex-1 py-1 rounded bg-green-600 text-white flex items-center justify-center gap-1"><ShoppingCart size={12} /> خرید</button><button onClick={() => quickTrade('sell')} className="flex-1 py-1 rounded bg-red-600 text-white">فروش</button></div>
        </div>
      )}
      </div>
    </div>
  );

  // در حالتِ drawer، پنل + دستگیره کنارِ هم؛ در غیرِ این صورت دقیقاً مثلِ قبل.
  if (!drawer) return panel;
  return (
    <div dir="rtl" className="flex h-full shrink-0 max-md:absolute max-md:left-0 max-md:top-0 max-md:bottom-0 max-md:z-40">
      {panel}
      {Handle}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// واچ‌لیستِ بازطراحی‌شده (#15) — کامپوننتِ داخلیِ مستقل.
// منبعِ «وجودِ نماد» = propِ `watch`؛ متادیتای غنی محلی است.
// ─────────────────────────────────────────────────────────────────────────────
function Watchlist({ TH, symbol, setSymbol, symbols, live, watch, toggleWatch, fmtPrice }) {
  const [meta, setMeta] = React.useState(loadMeta);
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [listMenuOpen, setListMenuOpen] = React.useState(false);
  const [flagFor, setFlagFor] = React.useState(null); // symِ نمادی که پاپ‌اوورِ پرچمش باز است

  // baselineِ سشن برای ٪ (اولین midِ دیده‌شدهٔ هر نماد) — وقتی payload فیلدِ prevClose ندارد
  const baseRef = React.useRef({});
  // سقف/کفِ سشن برای ستون‌های High/Low/Range — از streamِ زندهٔ همین سشن ساخته می‌شود
  const sessRef = React.useRef({});

  // persist هر تغییرِ meta
  React.useEffect(() => { try { localStorage.setItem(WM_KEY, JSON.stringify(meta)); } catch (e) { /* noop */ } }, [meta]);

  const patch = (p) => setMeta((m) => ({ ...m, ...p }));
  const list = meta.lists.find((l) => l.id === meta.activeListId) || meta.lists[0];
  const itemMeta = (sym) => (list.items && list.items[sym]) || {};

  // به‌روزرسانیِ متادیتای یک نماد در لیستِ فعال
  const setItemMeta = (sym, p) => setMeta((m) => ({
    ...m,
    lists: m.lists.map((l) => l.id !== m.activeListId ? l : {
      ...l, items: { ...l.items, [sym]: { ...(l.items[sym] || {}), ...p } },
    }),
  }));

  const setFlag = (sym, flag) => { setItemMeta(sym, { flag }); setFlagFor(null); };

  // روشن/خاموش‌کردنِ یک ستونِ عددیِ اختیاری (قیمت همیشه می‌ماند)
  const toggleCol = (key) => setMeta((m) => {
    const cols = (m.columns || []).includes(key) ? m.columns.filter((c) => c !== key) : [...(m.columns || []), key];
    return { ...m, columns: cols };
  });

  // ── سکشن‌ها ──
  const addSection = () => {
    const name = (window.prompt('نامِ سکشنِ جدید:') || '').trim();
    if (!name) return;
    setMeta((m) => ({ ...m, groupBy: 'section', lists: m.lists.map((l) => l.id !== m.activeListId ? l : { ...l, sections: [...l.sections, { id: uid(), name, collapsed: false }] }) }));
  };
  const renameSection = (sid) => {
    const sec = list.sections.find((s) => s.id === sid); if (!sec) return;
    const name = (window.prompt('نامِ جدیدِ سکشن:', sec.name) || '').trim(); if (!name) return;
    setMeta((m) => ({ ...m, lists: m.lists.map((l) => l.id !== m.activeListId ? l : { ...l, sections: l.sections.map((s) => s.id === sid ? { ...s, name } : s) }) }));
  };
  const delSection = (sid) => setMeta((m) => ({ ...m, lists: m.lists.map((l) => l.id !== m.activeListId ? l : { ...l, sections: l.sections.filter((s) => s.id !== sid), items: Object.fromEntries(Object.entries(l.items).map(([k, v]) => [k, v.section === sid ? { ...v, section: null } : v])) }) }));
  const toggleSection = (sid) => setMeta((m) => ({ ...m, lists: m.lists.map((l) => l.id !== m.activeListId ? l : { ...l, sections: l.sections.map((s) => s.id === sid ? { ...s, collapsed: !s.collapsed } : s) }) }));

  // ── چند واچ‌لیست ──
  const addList = () => { const name = (window.prompt('نامِ واچ‌لیستِ جدید:') || '').trim(); if (!name) return; const id = uid(); setMeta((m) => ({ ...m, lists: [...m.lists, { id, name, items: {}, sections: [] }], activeListId: id })); setListMenuOpen(false); };
  const renameList = () => { const name = (window.prompt('نامِ جدیدِ واچ‌لیست:', list.name) || '').trim(); if (!name) return; setMeta((m) => ({ ...m, lists: m.lists.map((l) => l.id === m.activeListId ? { ...l, name } : l) })); };
  const delList = () => { if (meta.lists.length <= 1) { window.alert('حداقل یک واچ‌لیست باید بماند.'); return; } if (!window.confirm(`حذفِ واچ‌لیستِ «${list.name}»؟ (نمادها از سرور حذف نمی‌شوند)`)) return; setMeta((m) => { const lists = m.lists.filter((l) => l.id !== m.activeListId); return { ...m, lists, activeListId: lists[0].id }; }); setListMenuOpen(false); };

  // ── دادهٔ نمایش: نمادهای واچ + متادیتا + قیمتِ زنده ──
  const rows = (watch || []).map((sym) => {
    const lp = (live || {})[sym];
    const dir = lp?.dir || 0;
    // baselineِ سشن را اولین‌بار که midِ معتبر دیدیم ثبت کن + سقف/کفِ سشن را به‌روز نگه‌دار
    const mid = typeof lp?.mid === 'number' ? lp.mid : null;
    if (mid != null) {
      if (baseRef.current[sym] == null) baseRef.current[sym] = mid;
      const s = sessRef.current[sym] || (sessRef.current[sym] = { hi: mid, lo: mid });
      if (mid > s.hi) s.hi = mid;
      if (mid < s.lo) s.lo = mid;
    }
    const chg = changePctOf(lp, baseRef.current[sym]);
    const sess = sessRef.current[sym] || null;
    const hi = sess ? sess.hi : null;
    const lo = sess ? sess.lo : null;
    const range = (hi != null && lo != null && lo) ? ((hi - lo) / lo) * 100 : null;
    const im = itemMeta(sym);
    return { sym, lp, dir, chg, hi, lo, range, flag: im.flag || null, section: im.section || null, kind: symbolKind(sym) };
  });

  // فیلترِ رنگ
  const filtered = meta.flagFilter ? rows.filter((r) => r.flag === meta.flagFilter) : rows;

  // مرتب‌سازی (manual = ترتیبِ propِ watch)
  const sorted = (() => {
    if (meta.sortBy === 'manual') return filtered;
    const arr = [...filtered];
    const dir = meta.sortDir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      if (meta.sortBy === 'name') return prettySym(a.sym).localeCompare(prettySym(b.sym)) * dir;
      if (meta.sortBy === 'price') return (((a.lp?.mid) || 0) - ((b.lp?.mid) || 0)) * dir;
      if (meta.sortBy === 'changePct') return (((a.chg) || 0) - ((b.chg) || 0)) * dir;
      return 0;
    });
    return arr;
  })();

  // گروه‌بندی → آرایه‌ای از { header, rows } یا null برای حالتِ تخت
  const groups = (() => {
    if (meta.groupBy === 'section') {
      const out = [];
      list.sections.forEach((sec) => out.push({ key: sec.id, name: sec.name, collapsed: sec.collapsed, sectionId: sec.id, rows: sorted.filter((r) => r.section === sec.id) }));
      const none = sorted.filter((r) => !r.section || !list.sections.some((s) => s.id === r.section));
      out.push({ key: '__none', name: 'بدونِ سکشن', collapsed: false, sectionId: null, rows: none });
      return out.filter((g) => g.rows.length > 0 || g.sectionId);
    }
    if (meta.groupBy === 'type') {
      return KIND_ORDER.map((k) => ({ key: k, name: KIND_LABEL[k], collapsed: false, sectionId: null, rows: sorted.filter((r) => r.kind === k) })).filter((g) => g.rows.length > 0);
    }
    return [{ key: '__flat', name: null, collapsed: false, sectionId: null, rows: sorted }];
  })();

  const isTable = meta.view === 'table';
  const logoSz = isTable ? 24 : (meta.logoSize === 'lg' ? 36 : 28);

  // افزودنِ نماد با جستجو
  const addCandidates = (symbols || []).filter((s) => !(watch || []).includes(s)).filter((s) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return s.toLowerCase().includes(q) || prettySym(s).toLowerCase().includes(q);
  }).slice(0, 60);

  const closeMenus = () => { setMenuOpen(false); setListMenuOpen(false); setFlagFor(null); };

  // ── رندرِ یک ردیف (list یا table) ──
  const cols = meta.columns || [];
  const hasExtra = cols.includes('high') || cols.includes('low') || cols.includes('range');
  const renderRow = (r) => {
    const active = symbol === r.sym;
    const col = r.dir > 0 ? TH.up : r.dir < 0 ? TH.down : TH.text;
    const chgCol = r.chg == null ? TH.text : (r.chg > 0 ? TH.up : r.chg < 0 ? TH.down : TH.text);
    const chgTxt = r.chg == null ? '' : `${r.chg > 0 ? '+' : ''}${r.chg.toFixed(2)}٪`;
    // یک ستونِ عددیِ اختیاری → { متن، رنگ }
    const numCell = (key) => {
      if (key === 'change') return { txt: chgTxt || '—', col: chgCol };
      if (key === 'high') return { txt: r.hi != null ? fmtPrice(r.sym, r.hi) : '—', col: TH.up };
      if (key === 'low') return { txt: r.lo != null ? fmtPrice(r.sym, r.lo) : '—', col: TH.down };
      if (key === 'range') return { txt: r.range != null ? `${r.range.toFixed(2)}٪` : '—', col: TH.text };
      return { txt: '', col: TH.text };
    };

    if (isTable) {
      return (
        <button key={r.sym} onClick={() => setSymbol(r.sym)} className="group/row relative flex items-center gap-2 w-full px-3 h-9 transition-colors"
          style={{ background: active ? TH.subtle : 'transparent', borderRight: `2px solid ${active ? TH.accent : 'transparent'}` }}
          onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
          onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
          {r.flag && <span className="absolute right-0 top-1 bottom-1 w-[2px] rounded-full" style={{ background: FLAG_HEX[r.flag] }} />}
          {meta.showLogo && <SymbolLogo symbol={r.sym} size={logoSz} />}
          <span className="flex-1 min-w-0 text-[12px] font-semibold truncate text-left" dir="ltr" style={{ color: active ? TH.accent : TH.textStrong }}>{prettySym(r.sym)}</span>
          <FlashNum value={r.lp?.mid} className="tnum text-[11px] w-16 text-left shrink-0 rounded" dir="ltr" style={{ color: col }}>{r.lp ? fmtPrice(r.sym, r.lp.mid) : '—'}</FlashNum>
          {cols.map((key) => { const c = numCell(key); return <span key={key} className="tnum text-[10px] w-12 text-left shrink-0" dir="ltr" style={{ color: c.col }}>{c.txt}</span>; })}
          <RowActions r={r} TH={TH} flagFor={flagFor} setFlagFor={setFlagFor} setFlag={setFlag} toggleWatch={toggleWatch} compact />
        </button>
      );
    }

    return (
      <button key={r.sym} onClick={() => setSymbol(r.sym)} className={`group/row relative flex items-center gap-3 w-full px-3 ${meta.logoSize === 'lg' ? 'h-11' : 'h-9'} transition-colors`}
        style={{ background: active ? TH.subtle : 'transparent', borderRight: `2px solid ${active ? TH.accent : 'transparent'}` }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        {r.flag && <span className="absolute right-0 top-1.5 bottom-1.5 w-[2px] rounded-full" style={{ background: FLAG_HEX[r.flag] }} />}
        {meta.showLogo && <span style={{ filter: meta.logoSize === 'lg' ? 'drop-shadow(0 1px 2px rgba(0,0,0,.45))' : 'none' }}><SymbolLogo symbol={r.sym} size={logoSz} /></span>}
        <div className="flex-1 min-w-0 text-left" dir="ltr">
          <div className="text-[13px] font-bold leading-tight truncate" style={{ color: active ? TH.accent : TH.textStrong }}>{prettySym(r.sym)}</div>
          {meta.showDesc && <div className="text-[10px] opacity-50 truncate" style={{ color: TH.text }}>{KIND_LABEL[r.kind]}</div>}
        </div>
        <div className="text-left shrink-0 leading-tight" dir="ltr">
          <FlashNum value={r.lp?.mid} className="tnum text-[12px] flex items-center gap-1 justify-end rounded" style={{ color: col }}>
            {r.dir !== 0 && <span className="text-[9px]">{r.dir > 0 ? '▲' : '▼'}</span>}
            {r.lp ? fmtPrice(r.sym, r.lp.mid) : '—'}
          </FlashNum>
          {cols.includes('change') && chgTxt && <div className="tnum text-[10px] text-left" style={{ color: chgCol }}>{chgTxt}</div>}
          {hasExtra && (
            <div className="tnum text-[9px] opacity-60 flex items-center gap-1.5 justify-end" style={{ color: TH.text }}>
              {cols.includes('high') && <span>H {r.hi != null ? fmtPrice(r.sym, r.hi) : '—'}</span>}
              {cols.includes('low') && <span>L {r.lo != null ? fmtPrice(r.sym, r.lo) : '—'}</span>}
              {cols.includes('range') && <span>{r.range != null ? `${r.range.toFixed(2)}٪` : '—'}</span>}
            </div>
          )}
        </div>
        <RowActions r={r} TH={TH} flagFor={flagFor} setFlagFor={setFlagFor} setFlag={setFlag} toggleWatch={toggleWatch} />
      </button>
    );
  };

  return (
    <div className="overflow-auto flex flex-col" onClick={(e) => { if (e.target === e.currentTarget) closeMenus(); }}>
      {/* هدر: تیتر + سویچرِ لیست + منوی شخصی‌سازی */}
      <div className="px-3 pt-2 pb-1 flex items-center justify-between select-none relative">
        <button onClick={() => { setListMenuOpen((v) => !v); setMenuOpen(false); }} className="flex items-center gap-1 text-[11px] font-semibold tracking-wide" style={{ color: TH.textStrong }}>
          <span className="truncate max-w-[110px]">{list.name}</span>
          <ChevronDown size={12} className={`transition-transform duration-[120ms] ${listMenuOpen ? 'rotate-180' : ''}`} style={{ color: TH.text }} />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums text-[10px] opacity-50" style={{ color: TH.text }}>{rows.length}</span>
          <button onClick={() => { setMenuOpen((v) => !v); setListMenuOpen(false); }} title="شخصی‌سازی" className="p-0.5 rounded transition-colors" style={{ color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <MoreVertical size={14} />
          </button>
        </div>

        {/* دراپ‌داونِ سویچرِ لیست */}
        {listMenuOpen && (
          <div className="absolute z-30 top-7 right-3 left-3 rounded-lg p-1 pc-pop" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
            {meta.lists.map((l) => (
              <button key={l.id} onClick={() => { patch({ activeListId: l.id }); setListMenuOpen(false); }} className="flex items-center justify-between w-full text-right px-2 py-1.5 text-[12px] rounded" style={{ color: l.id === meta.activeListId ? TH.accent : TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <span className="truncate">{l.name}</span>
                <span className="tabular-nums text-[10px] opacity-50">{Object.keys(l.items || {}).length}</span>
              </button>
            ))}
            <div className="my-1 border-t" style={{ borderColor: TH.border }} />
            <button onClick={addList} className="flex items-center gap-1.5 w-full text-right px-2 py-1.5 text-[12px] rounded" style={{ color: TH.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Plus size={12} /> واچ‌لیستِ جدید</button>
            <button onClick={renameList} className="flex items-center gap-1.5 w-full text-right px-2 py-1.5 text-[12px] rounded" style={{ color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Pencil size={12} /> تغییرِ نام</button>
            <button onClick={delList} className="flex items-center gap-1.5 w-full text-right px-2 py-1.5 text-[12px] rounded" style={{ color: TH.down }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Trash2 size={12} /> حذفِ این لیست</button>
          </div>
        )}

        {/* منوی شخصی‌سازی */}
        {menuOpen && (
          <div className="absolute z-30 top-7 right-3 left-3 rounded-lg p-2 pc-pop text-[12px] space-y-2" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}`, color: TH.text }}>
            {/* نمایش: لیست/جدول */}
            <Seg TH={TH} label="نمایش" value={meta.view} onChange={(v) => patch({ view: v })} options={[['list', 'لیست', List], ['table', 'جدول', Table]]} />
            {/* لوگو */}
            <div className="flex items-center justify-between">
              <span>لوگو</span>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={meta.showLogo} onChange={(e) => patch({ showLogo: e.target.checked })} /> <span className="opacity-70">نمایش</span></label>
            </div>
            <Seg TH={TH} label="اندازهٔ لوگو" value={meta.logoSize} onChange={(v) => patch({ logoSize: v })} options={[['md', 'متوسط'], ['lg', 'بزرگ']]} />
            <div className="flex items-center justify-between">
              <span>توضیحِ نماد</span>
              <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={meta.showDesc} onChange={(e) => patch({ showDesc: e.target.checked })} /> <span className="opacity-70">نمایش</span></label>
            </div>
            <div className="border-t pt-2" style={{ borderColor: TH.border }}>
              <Seg TH={TH} label="گروه‌بندی" value={meta.groupBy} onChange={(v) => patch({ groupBy: v })} options={[['none', 'بدون'], ['section', 'سکشن'], ['type', 'نوع']]} />
            </div>
            <Seg TH={TH} label="مرتب‌سازی" value={meta.sortBy} onChange={(v) => patch({ sortBy: v })} options={[['manual', 'دستی'], ['name', 'نام'], ['price', 'قیمت'], ['changePct', '٪']]} />
            {meta.sortBy !== 'manual' && (
              <Seg TH={TH} label="جهت" value={meta.sortDir} onChange={(v) => patch({ sortDir: v })} options={[['asc', 'صعودی'], ['desc', 'نزولی']]} />
            )}
            {/* ستون‌های عددیِ اختیاری — قیمت همیشه هست */}
            <div className="border-t pt-2" style={{ borderColor: TH.border }}>
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0">ستون‌ها</span>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {COLUMNS.map(([key, label]) => {
                    const on = (meta.columns || []).includes(key);
                    return (
                      <button key={key} onClick={() => toggleCol(key)} title={`ستونِ ${label}`} className="px-1.5 h-6 rounded text-[11px] transition-colors duration-[120ms]"
                        style={on ? { background: TH.accent, color: '#fff' } : { background: TH.subtle, color: TH.text }}
                        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
                        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = TH.subtle; }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {meta.groupBy === 'section' && (
              <button onClick={addSection} className="flex items-center gap-1.5 w-full text-right px-1 py-1 rounded" style={{ color: TH.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><FolderPlus size={13} /> افزودنِ سکشن</button>
            )}
          </div>
        )}
      </div>

      {/* فیلترِ رنگ (chipهای ۷ رنگ) */}
      <div className="px-3 pb-1 flex items-center gap-1.5 flex-wrap">
        {FLAG_ORDER.map((c) => {
          const on = meta.flagFilter === c;
          return <button key={c} title={`فیلترِ رنگِ ${c}`} onClick={() => patch({ flagFilter: on ? null : c })} className="w-3.5 h-3.5 rounded-full transition-transform duration-[120ms]" style={{ background: FLAG_HEX[c], outline: on ? `2px solid ${TH.accent}` : 'none', outlineOffset: 1, transform: on ? 'scale(1.15)' : 'scale(1)', opacity: meta.flagFilter && !on ? 0.4 : 1 }} />;
        })}
        {meta.flagFilter && <button onClick={() => patch({ flagFilter: null })} className="text-[10px] opacity-60 hover:opacity-100" style={{ color: TH.text }}>پاک</button>}
      </div>

      {rows.length === 0 && <div className="px-3 py-6 text-center text-[11px] opacity-40">نمادی نیست — از پایین اضافه کن.</div>}

      {/* گروه‌ها و ردیف‌ها */}
      {groups.map((g) => (
        <div key={g.key}>
          {g.name != null && (meta.groupBy === 'section' || meta.groupBy === 'type') && (
            <div className="flex items-center justify-between w-full px-3 py-1.5 text-[10px] font-semibold tracking-wide select-none sticky top-0 z-[5]" style={{ background: TH.bg }}>
              <button onClick={() => g.sectionId && toggleSection(g.sectionId)} className="flex items-center gap-1 min-w-0" style={{ color: TH.text, opacity: 0.7, cursor: g.sectionId ? 'pointer' : 'default' }}>
                {g.sectionId != null && <ChevronDown size={12} className={`transition-transform duration-[120ms] ${g.collapsed ? '-rotate-90' : ''}`} />}
                <span className="truncate">{g.name}</span>
              </button>
              <span className="flex items-center gap-1">
                <span className="tabular-nums opacity-50">{g.rows.length}</span>
                {g.sectionId != null && (
                  <span className="flex items-center gap-0.5">
                    <button onClick={(e) => { e.stopPropagation(); renameSection(g.sectionId); }} title="تغییرِ نام" className="opacity-40 hover:opacity-100"><Pencil size={10} /></button>
                    <button onClick={(e) => { e.stopPropagation(); delSection(g.sectionId); }} title="حذفِ سکشن" className="opacity-40 hover:opacity-100" style={{ color: TH.down }}><Trash2 size={10} /></button>
                  </span>
                )}
              </span>
            </div>
          )}
          {!g.collapsed && g.rows.map((r) => renderRow(r))}
        </div>
      ))}

      {/* افزودنِ نماد — با جستجوی واقعی */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between select-none">
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: TH.text, opacity: 0.55 }}>افزودنِ نماد</span>
        <button onClick={() => setAdding((v) => !v)} className="p-0.5 rounded" style={{ color: TH.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          <Plus size={14} className={`transition-transform duration-[120ms] ${adding ? 'rotate-45' : ''}`} />
        </button>
      </div>
      {adding && (
        <div className="px-2 pb-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5 rounded-md px-2 h-8" style={{ background: TH.chipBg }}>
            <Search size={13} style={{ color: TH.text, opacity: 0.6 }} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نماد…" dir="ltr"
              className="flex-1 bg-transparent outline-none text-[12px] text-left" style={{ color: TH.textStrong }} />
            {query && <button onClick={() => setQuery('')} className="opacity-50 hover:opacity-100"><X size={12} /></button>}
          </div>
          <div className="flex flex-col gap-0.5 max-h-64 overflow-auto bn-thin-scroll mt-0.5">
            {addCandidates.length === 0 && <div className="px-2 py-3 text-center text-[11px] opacity-40">موردی پیدا نشد.</div>}
            {addCandidates.map((s) => (
              <button key={s} onClick={() => toggleWatch(s)} className="flex items-center gap-2.5 px-2 h-9 rounded-md transition-colors"
                onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                <SymbolLogo symbol={s} size={24} />
                <span className="flex-1 text-[12px] font-semibold truncate text-left" dir="ltr" style={{ color: TH.textStrong }}>{prettySym(s)}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full shrink-0" style={{ background: TH.chipBg, color: TH.text }}>{KIND_LABEL[symbolKind(s)]}</span>
                <Plus size={13} className="opacity-60 shrink-0" style={{ color: TH.accent }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// اکشن‌های انتهای ردیف: پرچم + حذف
function RowActions({ r, TH, flagFor, setFlagFor, setFlag, toggleWatch, compact }) {
  const open = flagFor === r.sym;
  return (
    <span className="flex items-center gap-1 shrink-0 relative" dir="ltr" onClick={(e) => e.stopPropagation()}>
      <span role="button" tabIndex={0} title="پرچمِ تفکیک" onClick={() => setFlagFor(open ? null : r.sym)}
        className={`${r.flag ? '' : 'opacity-0 group-hover/row:opacity-50'} hover:!opacity-100 transition-opacity cursor-pointer`}>
        <Flag size={compact ? 11 : 12} style={{ color: r.flag ? FLAG_HEX[r.flag] : TH.text, fill: r.flag ? FLAG_HEX[r.flag] : 'none' }} />
      </span>
      <span role="button" tabIndex={0} title="حذف از واچ‌لیست" onClick={() => toggleWatch(r.sym)}
        className="opacity-0 group-hover/row:opacity-50 hover:!opacity-100 transition-opacity cursor-pointer">
        <X size={compact ? 11 : 12} style={{ color: TH.down }} />
      </span>
      {open && (
        <div className="absolute z-40 top-4 left-0 rounded-lg p-1.5 pc-pop flex items-center gap-1" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
          {FLAG_ORDER.map((c) => (
            <button key={c} title={c} onClick={() => setFlag(r.sym, c)} className="w-4 h-4 rounded-full transition-transform hover:scale-110" style={{ background: FLAG_HEX[c], outline: r.flag === c ? `2px solid ${TH.textStrong}` : 'none', outlineOffset: 1 }} />
          ))}
          <button title="بدونِ پرچم" onClick={() => setFlag(r.sym, null)} className="w-4 h-4 rounded-full flex items-center justify-center" style={{ border: `1px solid ${TH.border}` }}>
            <X size={9} style={{ color: TH.text }} />
          </button>
        </div>
      )}
    </span>
  );
}

// فلَشِ سبز/قرمزِ سلولِ قیمت روی هر تیک (حسِ زنده‌بودنِ TV) — از کلاس‌های سراسریِ
// .flash-up/.flash-down استفاده می‌کند. برای ری‌استارتِ انیمیشن روی هر تغییر، عنصرِ
// خروجی با یک key نو ری‌مونت می‌شود (هوک‌های خودِ کامپوننت پایدار می‌مانند).
function FlashNum({ value, className = '', style, dir, children }) {
  const prev = React.useRef(value);
  const [st, setSt] = React.useState({ cls: '', n: 0 });
  React.useEffect(() => {
    if (value != null && prev.current != null && value !== prev.current) {
      setSt((s) => ({ cls: value > prev.current ? 'flash-up' : 'flash-down', n: s.n + 1 }));
    }
    prev.current = value;
  }, [value]);
  return <span key={st.n} dir={dir} className={`${className} ${st.cls}`} style={style}>{children}</span>;
}

// سگمنتِ ساده برای منوی شخصی‌سازی
function Seg({ TH, label, value, onChange, options }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0">{label}</span>
      <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: TH.subtle }}>
        {options.map(([v, l, Icon]) => {
          const on = value === v;
          return (
            <button key={v} onClick={() => onChange(v)} className="px-1.5 h-6 rounded text-[11px] flex items-center gap-1 transition-colors duration-[120ms]"
              style={on ? { background: TH.accent, color: '#fff' } : { color: TH.text }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
              {Icon && <Icon size={11} />} {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}
