// اسکنر (Screener) — جدولِ زندهٔ همهٔ نمادها با مرتب‌سازی + فیلترِ سریع
// بدنهٔ یک تبِ پنلِ راست. props: { symbol, TH, symbols, prices, setSymbol }
// prices[sym] = { mid: string|number, dir: -1|0|1 }  (همان آبجکتِ live در BazaarNama)
// — کاملاً سمتِ کلاینت و درجا (drop-in)؛ هیچ فراخوانیِ سرور لازم ندارد.
import React, { useMemo, useState } from 'react';
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

export default function Screener({ symbol, TH, symbols = [], prices = {}, setSymbol }) {
  const [sortBy, setSortBy] = useState('value');    // value | symbol | last | dir
  const [sortDir, setSortDir] = useState('asc');    // asc | desc  (value: asc = باارزش‌ترین بالا)
  const [q, setQ] = useState('');                   // فیلترِ متنیِ نماد
  const [onlyMovers, setOnlyMovers] = useState(false); // فقط نمادهای در حالِ حرکت (dir≠0)

  const click = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir(col === 'symbol' || col === 'value' ? 'asc' : 'desc'); }
  };

  const rows = useMemo(() => {
    const qq = q.trim().toUpperCase();
    let list = symbols.filter((s) => (!qq || s.toUpperCase().includes(qq)));
    if (onlyMovers) list = list.filter((s) => (prices[s]?.dir || 0) !== 0);
    const dirOf = (s) => prices[s]?.dir || 0;
    const lastOf = (s) => num(prices[s]?.mid);
    list = [...list].sort((a, b) => {
      let r = 0;
      // #۵ پیش‌فرض: مرتب‌سازی بر اساسِ ارزش/اهمیت (باارزش‌ترین بالا)، با نامِ نماد به‌عنوانِ گره‌گشا
      if (sortBy === 'value') r = (valueRank(a) - valueRank(b)) || a.localeCompare(b);
      else if (sortBy === 'symbol') r = a.localeCompare(b);
      else if (sortBy === 'last') r = (lastOf(a) ?? -Infinity) - (lastOf(b) ?? -Infinity);
      else if (sortBy === 'dir') r = dirOf(a) - dirOf(b);
      return sortDir === 'asc' ? r : -r;
    });
    return list;
  }, [symbols, prices, q, onlyMovers, sortBy, sortDir]);

  const arrow = (col) => (sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '');

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

  return (
    <div className="flex flex-col text-xs" style={{ color: TH.text, fontVariantNumeric: 'tabular-nums' }}>
      {/* نوارِ فیلتر */}
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
      </div>

      {/* سرستونِ قابلِ‌مرتب‌سازی */}
      <div className="grid items-center gap-2 px-3 h-7 border-b text-[10px] shrink-0"
        style={{ borderColor: TH.border, gridTemplateColumns: 'auto 1fr auto 1.25rem' }}>
        <span className="w-5" />
        <HCell col="symbol">نماد</HCell>
        <HCell col="last" className="justify-end" dir="ltr">قیمت</HCell>
        <HCell col="dir" className="justify-end" dir="ltr">روند</HCell>
      </div>

      {/* بدنهٔ جدول */}
      <div className="overflow-auto">
        {rows.length === 0 && (
          <div className="px-3 py-8 text-center opacity-40 text-[11px]">نمادی مطابقِ فیلتر یافت نشد.</div>
        )}
        {rows.map((s) => {
          const lp = prices[s];
          const dir = lp?.dir || 0;
          const col = lp ? (dir > 0 ? TH.up : dir < 0 ? TH.down : TH.text) : TH.text;
          const active = symbol === s;
          return (
            <button
              key={s} onClick={() => setSymbol && setSymbol(s)}
              className="grid items-center gap-2 w-full px-3 h-8 transition-colors"
              style={{ gridTemplateColumns: 'auto 1fr auto 1.25rem', background: active ? TH.subtle : 'transparent' }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              dir="ltr"
            >
              <SymbolLogo symbol={s} size={20} />
              <span className="text-left truncate" style={{ color: active ? TH.accent : TH.textStrong, fontWeight: active ? 600 : 400 }}>{s}</span>
              <span className="text-right tabular-nums" style={{ color: col }}>{lp ? fmtP(s, lp.mid) : '—'}</span>
              <span className="text-right" style={{ color: col }}>{dir !== 0 ? (dir > 0 ? '▲' : '▼') : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
