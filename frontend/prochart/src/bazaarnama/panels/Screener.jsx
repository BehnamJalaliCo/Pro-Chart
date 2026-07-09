// اسکنر (Screener) — جدولِ زندهٔ همهٔ نمادها با ستون‌های تکنیکال/قیمتی، فیلترهای
// قابلِ‌تنظیم، پریست‌های بازار (فارکس/کریپتو/فلزات/شاخص)، مرتب‌سازی و خروجی به واچ‌لیست.
// بدنهٔ یک تبِ پنلِ راست. props: { symbol, TH, symbols, prices, setSymbol, watch?, toggleWatch? }
// prices[sym] = { mid: string|number, dir: -1|0|1 }  (همان آبجکتِ live در BazaarNama)
// — کاملاً سمتِ کلاینت و درجا (drop-in)؛ هیچ فراخوانیِ سرور لازم ندارد.
// ستون‌های ٪/سقف/کف/دامنه از streamِ زندهٔ همین سشن ساخته می‌شوند (دادهٔ واقعی، نه ساختگی)،
// چون payloadِ سرور فقط { mid, dir } دارد — دقیقاً هم‌منطق با واچ‌لیست.
import React, { useMemo, useRef, useState } from 'react';
import { Star, SlidersHorizontal, Columns3, Check, Filter } from 'lucide-react';
import SymbolLogo from '../SymbolLogo';

// تبدیلِ مطمئنِ mid به عدد (mid ممکن است رشته باشد)
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };

// دقتِ اعشار بر اساسِ نماد (مثلِ TradingView)
const digits = (sym = '') => {
  const s = String(sym).toUpperCase();
  if (s.includes('JPY')) return 3;
  if (s.includes('XAU') || s.includes('GOLD')) return 2;
  if (s.includes('BTC') || s.includes('ETH')) return 1;
  if (/XTI|USOIL|WTI|BRENT/.test(s)) return 2;
  if (/US30|US500|NAS100|DE40|US100/.test(s)) return 2;
  return 5;
};
const fmtP = (sym, v) => { const n = num(v); return n == null ? '—' : n.toFixed(digits(sym)); };
// درصد با علامت و دو رقم (سبکِ فارسیِ واچ‌لیست)
const fmtPct = (n) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}٪`);

// #۵ رتبهٔ «ارزش/اهمیت» — باارزش‌ترین (طلا، شاخص‌ها، میجرها، کریپتوی برتر) بالا، بقیه پایین.
// نمادها از همین رتبه به‌صورتِ نزولی (باارزش→بی‌ارزش) چیده می‌شوند؛ پایه (USDT/USD) نادیده گرفته می‌شود.
const _VALUE_ORDER = [
  'XAUUSD', 'XAGUSD', 'BTCUSDT', 'ETHUSDT', 'US30', 'US500', 'NAS100', 'US100', 'DE40', 'GER40',
  'UK100', 'JP225', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'XTIUSD', 'USOIL', 'WTIUSD', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'EURGBP', 'EURJPY', 'GBPJPY',
];
const _VRANK = _VALUE_ORDER.reduce((m, s, i) => { m[s] = i; return m; }, {});
const valueRank = (sym = '') => {
  const s = String(sym).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s in _VRANK) return _VRANK[s];
  // کریپتوی USDT بعد از لیستِ منتخب، بعد بقیه (الفبایی به‌عنوانِ گره‌گشا در sort اعمال می‌شود)
  if (s.endsWith('USDT')) return _VALUE_ORDER.length + 1;
  return _VALUE_ORDER.length + 5;
};

// تخمینِ اسپرد از روی تعدادِ ارقامِ اعشار (پراکسیِ سبک — بک‌اند فیدِ اسپرد جدا ندارد)
function spreadPips(mid) {
  const n = num(mid); if (n == null) return null;
  const s = String(mid);
  const dec = s.includes('.') ? s.split('.')[1].length : 0;
  // پیپ = یک واحد در رقمِ یکی‌مانده‌به‌آخر (مدلِ ساده‌شده)
  const pip = Math.pow(10, -(dec > 0 ? dec - 1 : 0));
  return pip; // مقدارِ نمایشی؛ صرفاً برای مرتب‌سازیِ نسبی
}

// ── نوعِ نماد برای پریست‌های بازار — هم‌منطق با SymbolLogo/RightPanel (بدونِ صرافیِ جدید) ──
const _CCY3 = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'XAU', 'XAG', 'XPT', 'XPD'];
function symbolKind(sym = '') {
  const s = String(sym).toUpperCase();
  const a = s.replace(/[^A-Z]/g, '');
  if (/^(XAU|XAG|XPT|XPD)/.test(s)) return 'metal';
  if (a.length >= 6) {
    const x = a.slice(0, 3), y = a.slice(3, 6);
    if (_CCY3.includes(x) && _CCY3.includes(y)) return 'forex';
  }
  if (/US30|US500|NAS100|NAS|SPX|DJI|NDX|UK100|DE40|JP225|US100|FRA40|HK50|GER40/.test(s)) return 'index';
  return 'crypto';
}

// پریست‌های بازار (از همان نمادهای موجود؛ هیچ بازار/بروکرِ جدیدی اضافه نمی‌شود)
const PRESETS = [
  ['all', 'همه'],
  ['forex', 'فارکس'],
  ['metal', 'فلزات'],
  ['index', 'شاخص'],
  ['crypto', 'کریپتو'],
];

// ستون‌های عددیِ اختیاری (قیمت همیشه هست) — تکنیکال/قیمتیِ ساخته‌شده از سشنِ زنده
const OPT_COLS = [
  ['change', 'تغییر٪'],
  ['high', 'سقف'],
  ['low', 'کف'],
  ['range', 'دامنه٪'],
  ['spread', 'اسپرد~'],
];

// persist محلیِ ترجیحاتِ اسکنر (کلیدِ مستقل تا چیزی از واچ‌لیست/ورک‌اسپیس دست‌نخورده بماند)
const SC_KEY = 'bn_screener_prefs';
const loadPrefs = () => {
  const base = { preset: 'all', changeDir: 'all', minChg: '', columns: ['change'], sortBy: 'value', sortDir: 'asc' };
  try {
    const raw = JSON.parse(localStorage.getItem(SC_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    return { ...base, ...raw, columns: Array.isArray(raw.columns) ? raw.columns : base.columns };
  } catch (e) { return base; }
};

export default function Screener({ symbol, TH, symbols = [], prices = {}, setSymbol, watch = [], toggleWatch }) {
  const _p = loadPrefs();
  const [sortBy, setSortBy] = useState(_p.sortBy);   // value | symbol | last | change | high | low | range | spread | dir
  const [sortDir, setSortDir] = useState(_p.sortDir); // asc | desc  (value: asc = باارزش‌ترین بالا)
  const [q, setQ] = useState('');                    // فیلترِ متنیِ نماد
  const [onlyMovers, setOnlyMovers] = useState(false); // فقط نمادهای در حالِ حرکت (dir≠0)
  const [preset, setPreset] = useState(_p.preset);   // پریستِ بازار
  const [changeDir, setChangeDir] = useState(_p.changeDir); // all | gainers | losers
  const [minChg, setMinChg] = useState(_p.minChg);   // حداقلِ |تغییر٪| (رشته برای input)
  const [columns, setColumns] = useState(_p.columns); // ستون‌های عددیِ فعال
  const [colMenu, setColMenu] = useState(false);     // منوی انتخابِ ستون
  const [filtMenu, setFiltMenu] = useState(false);   // منوی فیلترهای پیشرفته

  // baselineِ سشن (اولین midِ معتبر) + سقف/کفِ سشن برای ٪/دامنه — از streamِ زنده
  const baseRef = useRef({});
  const sessRef = useRef({});

  // persist هر تغییرِ ترجیحات
  React.useEffect(() => {
    try { localStorage.setItem(SC_KEY, JSON.stringify({ preset, changeDir, minChg, columns, sortBy, sortDir })); } catch (e) { /* noop */ }
  }, [preset, changeDir, minChg, columns, sortBy, sortDir]);

  const click = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir(col === 'symbol' || col === 'value' ? 'asc' : 'desc'); }
  };
  const toggleCol = (key) => setColumns((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));

  // متریکِ هر نماد از سشنِ زنده (ref را همین‌جا به‌روز می‌کند — هم‌الگو با واچ‌لیست)
  const metricsFor = (s) => {
    const lp = prices[s];
    const mid = num(lp?.mid);
    if (mid != null) {
      if (baseRef.current[s] == null) baseRef.current[s] = mid;
      const ss = sessRef.current[s] || (sessRef.current[s] = { hi: mid, lo: mid });
      if (mid > ss.hi) ss.hi = mid;
      if (mid < ss.lo) ss.lo = mid;
    }
    const base = baseRef.current[s];
    const sess = sessRef.current[s] || null;
    const hi = sess ? sess.hi : null;
    const lo = sess ? sess.lo : null;
    const chg = (mid != null && base) ? ((mid - base) / base) * 100 : null;
    const range = (hi != null && lo != null && lo) ? ((hi - lo) / lo) * 100 : null;
    return { last: mid, dir: lp?.dir || 0, chg, hi, lo, range, spread: spreadPips(lp?.mid) };
  };

  const rows = useMemo(() => {
    const qq = q.trim().toUpperCase();
    const minN = parseFloat(minChg);
    // متریک را برای همهٔ نمادها بساز (تا baselineِ سشن پایدار بماند حتی با تعویضِ پریست)
    const M = {};
    symbols.forEach((s) => { M[s] = metricsFor(s); });

    let list = symbols.filter((s) => {
      if (qq && !s.toUpperCase().includes(qq)) return false;
      if (preset !== 'all' && symbolKind(s) !== preset) return false;
      const m = M[s];
      if (onlyMovers && (m.dir || 0) === 0) return false;
      if (changeDir === 'gainers' && !(m.chg > 0)) return false;
      if (changeDir === 'losers' && !(m.chg < 0)) return false;
      if (Number.isFinite(minN) && minN > 0 && !(Math.abs(m.chg || 0) >= minN)) return false;
      return true;
    });

    const val = (s) => M[s];
    list = [...list].sort((a, b) => {
      let r = 0;
      const ma = val(a), mb = val(b);
      // #۵ پیش‌فرض: مرتب‌سازی بر اساسِ ارزش/اهمیت (باارزش‌ترین بالا)، با نامِ نماد به‌عنوانِ گره‌گشا
      if (sortBy === 'value') r = (valueRank(a) - valueRank(b)) || a.localeCompare(b);
      else if (sortBy === 'symbol') r = a.localeCompare(b);
      else if (sortBy === 'last') r = (ma.last ?? -Infinity) - (mb.last ?? -Infinity);
      else if (sortBy === 'change') r = (ma.chg ?? -Infinity) - (mb.chg ?? -Infinity);
      else if (sortBy === 'high') r = (ma.hi ?? -Infinity) - (mb.hi ?? -Infinity);
      else if (sortBy === 'low') r = (ma.lo ?? -Infinity) - (mb.lo ?? -Infinity);
      else if (sortBy === 'range') r = (ma.range ?? -Infinity) - (mb.range ?? -Infinity);
      else if (sortBy === 'spread') r = (ma.spread ?? Infinity) - (mb.spread ?? Infinity);
      else if (sortBy === 'dir') r = ma.dir - mb.dir;
      return sortDir === 'asc' ? r : -r;
    });
    return list.map((s) => ({ s, m: M[s] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols, prices, q, onlyMovers, preset, changeDir, minChg, sortBy, sortDir]);

  const arrow = (col) => (sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '');
  const inWatch = (s) => (watch || []).includes(s);
  // خروجی به واچ‌لیست: افزودنِ همهٔ نمادهای نمایان که هنوز در واچ نیستند
  const addVisible = () => {
    if (!toggleWatch) return;
    rows.forEach(({ s }) => { if (!inWatch(s)) toggleWatch(s); });
  };
  const missingCount = (rows || []).filter(({ s }) => !inWatch(s)).length;

  // سرستونِ قابلِ‌مرتب‌سازی با اکسنتِ ظریفِ ستونِ فعال
  const HCell = ({ col, children, className = '', ...rest }) => {
    const on = sortBy === col;
    return (
      <span
        onClick={() => click(col)}
        className={`cursor-pointer select-none inline-flex items-center gap-0.5 transition-colors ${className}`}
        style={{ color: on ? TH.accent : TH.text, opacity: on ? 1 : 0.6 }}
        {...rest}
      >
        {children}
        <span className="w-2 text-[9px]">{arrow(col)}</span>
      </span>
    );
  };

  // عرضِ ستون‌های اختیاری برای گریدِ اسکرول‌شونده
  const optActive = OPT_COLS.filter(([k]) => columns.includes(k));
  const gridCols = `auto minmax(3.25rem,1fr) 3.75rem${optActive.map(() => ' 3rem').join('')} 1rem${toggleWatch ? ' 1.1rem' : ''}`;

  return (
    <div className="flex flex-col text-xs" style={{ color: TH.text }}>
      {/* نوارِ فیلترِ اصلی: جستجو + movers + ستون‌ها + فیلترِ پیشرفته */}
      <div className="flex items-center gap-1.5 px-2 h-8 border-b shrink-0" style={{ borderColor: TH.border }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی نماد…"
          dir="ltr" className="flex-1 min-w-0 rounded-md px-2 py-1 outline-none text-[11px] transition-colors"
          style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }}
        />
        <button
          onClick={() => setOnlyMovers((v) => !v)} title="فقط نمادهای در حالِ حرکت"
          className="px-2 h-[26px] rounded-md text-[10px] whitespace-nowrap transition-colors"
          style={{ background: onlyMovers ? TH.accent : TH.chipBg, color: onlyMovers ? '#fff' : TH.text }}
          onMouseEnter={(e) => { if (!onlyMovers) e.currentTarget.style.background = TH.chipBgHover; }}
          onMouseLeave={(e) => { if (!onlyMovers) e.currentTarget.style.background = TH.chipBg; }}
        >فعال</button>
        <div className="relative">
          <button onClick={() => { setColMenu((v) => !v); setFiltMenu(false); }} title="ستون‌ها"
            className="p-1 rounded-md transition-colors" style={{ background: colMenu ? TH.accent : TH.chipBg, color: colMenu ? '#fff' : TH.text }}>
            <Columns3 size={14} />
          </button>
          {colMenu && (
            <div className="absolute z-30 top-8 left-0 rounded-lg p-1 pc-pop text-[12px]" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}`, minWidth: 130 }}>
              {OPT_COLS.map(([key, label]) => {
                const on = columns.includes(key);
                return (
                  <button key={key} onClick={() => toggleCol(key)} className="flex items-center justify-between w-full text-right px-2 py-1.5 rounded gap-3"
                    style={{ color: on ? TH.accent : TH.text }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <span>{label}</span>
                    {on && <Check size={13} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="relative">
          <button onClick={() => { setFiltMenu((v) => !v); setColMenu(false); }} title="فیلترهای پیشرفته"
            className="p-1 rounded-md transition-colors" style={{ background: filtMenu ? TH.accent : TH.chipBg, color: filtMenu ? '#fff' : TH.text }}>
            <SlidersHorizontal size={14} />
          </button>
          {filtMenu && (
            <div className="absolute z-30 top-8 left-0 rounded-lg p-2 pc-pop text-[12px] space-y-2" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}`, minWidth: 172, color: TH.text }}>
              <div>
                <div className="flex items-center gap-1 mb-1 opacity-70"><Filter size={11} /> جهتِ تغییر</div>
                <div className="flex items-center gap-0.5 rounded-md p-0.5" style={{ background: TH.subtle }}>
                  {[['all', 'همه'], ['gainers', 'صعودی'], ['losers', 'نزولی']].map(([v, l]) => {
                    const on = changeDir === v;
                    return (
                      <button key={v} onClick={() => setChangeDir(v)} className="flex-1 px-1.5 h-6 rounded text-[11px] transition-colors"
                        style={on ? { background: TH.accent, color: '#fff' } : { color: TH.text }}
                        onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
                        onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>{l}</button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-70">حداقلِ تغییر٪</span>
                <input value={minChg} onChange={(e) => setMinChg(e.target.value)} inputMode="decimal" placeholder="۰" dir="ltr"
                  className="tnum w-16 rounded px-2 py-1 outline-none text-left text-[11px]"
                  style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }} />
              </div>
              {(changeDir !== 'all' || (minChg && minChg !== '0')) && (
                <button onClick={() => { setChangeDir('all'); setMinChg(''); }} className="w-full text-center py-1 rounded text-[11px]"
                  style={{ background: TH.chipBg, color: TH.text }}>پاک‌کردنِ فیلترها</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* پریست‌های بازار + خروجی به واچ‌لیست */}
      <div className="flex items-center gap-1 px-2 h-8 border-b shrink-0 overflow-x-auto bn-thin-scroll" style={{ borderColor: TH.border }}>
        {PRESETS.map(([id, label]) => {
          const on = preset === id;
          return (
            <button key={id} onClick={() => setPreset(id)}
              className="px-2 h-[24px] rounded-full text-[10px] whitespace-nowrap shrink-0 transition-colors"
              style={{ background: on ? TH.accent : TH.chipBg, color: on ? '#fff' : TH.text }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = TH.chipBg; }}>{label}</button>
          );
        })}
        <div className="flex-1" />
        {toggleWatch && missingCount > 0 && (
          <button onClick={addVisible} title="افزودنِ نمادهای نمایان به واچ‌لیست"
            className="flex items-center gap-1 px-2 h-[24px] rounded-full text-[10px] whitespace-nowrap shrink-0 transition-colors"
            style={{ background: TH.chipBg, color: TH.accent }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
            <Star size={11} /> +واچ
          </button>
        )}
      </div>

      {/* بدنه + سرستونِ هم‌عرض (اسکرولِ افقی برای ستون‌های اضافه) */}
      <div className="overflow-auto">
        <div style={{ minWidth: '100%' }}>
          {/* سرستونِ قابلِ‌مرتب‌سازی */}
          <div className="grid items-center gap-2 px-3 h-7 border-b text-[10px] shrink-0 sticky top-0 z-[5]"
            style={{ borderColor: TH.border, gridTemplateColumns: gridCols, background: TH.bg }}>
            <span className="w-5" />
            <HCell col="symbol">نماد</HCell>
            <HCell col="last" className="justify-end" dir="ltr">قیمت</HCell>
            {optActive.map(([key, label]) => (
              <HCell key={key} col={key} className="justify-end" dir="ltr">{label}</HCell>
            ))}
            <HCell col="dir" className="justify-end" dir="ltr" />
            {toggleWatch && <span />}
          </div>

          {rows.length === 0 && (
            <div className="px-3 py-8 text-center opacity-40 text-[11px]">نمادی مطابقِ فیلتر یافت نشد.</div>
          )}
          {rows.map(({ s, m }) => {
            const dir = m.dir;
            const col = dir > 0 ? TH.up : dir < 0 ? TH.down : TH.text;
            const active = symbol === s;
            const on = inWatch(s);
            return (
              <div
                key={s}
                onClick={() => setSymbol && setSymbol(s)}
                role="button" tabIndex={0}
                className="grid items-center gap-2 w-full px-3 h-8 transition-colors cursor-pointer"
                style={{ gridTemplateColumns: gridCols, background: active ? TH.subtle : 'transparent' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                dir="ltr"
              >
                <SymbolLogo symbol={s} size={20} />
                <span className="text-left truncate" style={{ color: active ? TH.accent : TH.textStrong, fontWeight: active ? 600 : 400 }}>{s}</span>
                <span className="tnum text-right" style={{ color: col }}>{m.last != null ? fmtP(s, m.last) : '—'}</span>
                {optActive.map(([key]) => {
                  let txt = '—', c = TH.text;
                  if (key === 'change') { txt = fmtPct(m.chg); c = m.chg == null ? TH.text : m.chg > 0 ? TH.up : m.chg < 0 ? TH.down : TH.text; }
                  else if (key === 'high') { txt = m.hi != null ? fmtP(s, m.hi) : '—'; c = TH.up; }
                  else if (key === 'low') { txt = m.lo != null ? fmtP(s, m.lo) : '—'; c = TH.down; }
                  else if (key === 'range') { txt = m.range != null ? `${m.range.toFixed(2)}٪` : '—'; }
                  else if (key === 'spread') { txt = m.spread != null ? String(m.spread) : '—'; }
                  return <span key={key} className="tnum text-right text-[10px] truncate" style={{ color: c }}>{txt}</span>;
                })}
                <span className="text-right" style={{ color: col }}>{dir !== 0 ? (dir > 0 ? '▲' : '▼') : ''}</span>
                {toggleWatch && (
                  <span role="button" tabIndex={0} title={on ? 'حذف از واچ‌لیست' : 'افزودن به واچ‌لیست'}
                    onClick={(e) => { e.stopPropagation(); toggleWatch(s); }}
                    className={`${on ? '' : 'opacity-40'} hover:!opacity-100 transition-opacity cursor-pointer flex items-center justify-center`}>
                    <Star size={12} style={{ color: on ? TH.accent : TH.text, fill: on ? TH.accent : 'none' }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
