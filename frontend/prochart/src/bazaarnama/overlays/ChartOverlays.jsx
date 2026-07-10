import React, { useState } from 'react';
import { Eye, EyeOff, Settings2, Trash2, MoreHorizontal, ChevronDown, ChevronUp, HelpCircle, Copy, Rows3, X,
  CandlestickChart, LineChart, AreaChart, BarChart3, Activity } from 'lucide-react';
import { SPEED_LADDER } from '../ReplayController';
import SymbolLogo from '../SymbolLogo';
import { classify } from '../symbolMeta';

// ─────────────────────────────────────────────────────────────────────────────
// اجزای مشترکِ سرِ لجند (سبکِ TradingView) — لوگو + نامِ نماد + بازار/تایم‌فریمِ
//   کم‌رنگ + O/H/L/C با لیبلِ کوچک و مقدارِ رنگیِ up/down + چیپِ تغییر. همه رندرِ خالص.
// ─────────────────────────────────────────────────────────────────────────────

// حدسِ ساده‌یِ نامِ بازار از روی نماد (مثلِ نمایشِ صرافی/دسته در TV). اختیاری؛ اگر
//   caller مقدارِ `market` بدهد همان استفاده می‌شود.
function marketOf(sym = '') {
  const s = String(sym).toUpperCase();
  const clean = s.replace(/[^A-Z]/g, '');
  const CCYS = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
  if (/^(XAU|XAG|XPT|XPD)/.test(s)) return 'فلزات';
  if (/US30|US500|NAS100|NAS|SPX|DJI|NDX|UK100|DE40|JP225|US100|FRA40|HK50/.test(s)) return 'شاخص';
  if (/OIL|WTI|BRENT|^XTI|^XBR|^XNG/.test(s)) return 'انرژی';
  if (clean.length >= 6 && CCYS.includes(clean.slice(0, 3)) && CCYS.includes(clean.slice(3, 6))) return 'فارکس';
  if (/USDT$|USD$/.test(s)) return 'کریپتو';
  return '';
}

// افزودنِ آلفا به رنگِ hexِ ۶رقمی برای پس‌زمینه‌یِ کم‌رنگِ چیپ.
function tint(col, a = '22') {
  return typeof col === 'string' && /^#[0-9a-fA-F]{6}$/.test(col) ? col + a : col;
}

// شمارِ ارقامِ اعشارِ یک عدد — تا تغییرِ مطلق دقیقاً با اعشارِ قیمت هم‌تراز شود.
function decimalsOf(n) {
  if (n == null) return 0;
  const s = String(n);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}
// تغییرِ مطلق با علامت و اعشارِ درست، سبکِ TV: «+2.83» / «−0.00041» (مینوسِ تایپوگرافیک).
function fmtDelta(v, decimals) {
  if (v == null || Number.isNaN(v)) return null;
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(decimals);
}

// نگاشتِ نوعِ چارت → گلیفِ lucide (سبکِ آیکونِ نوعِ چارتِ TV در لجند، کنارِ نماد).
//   انواعِ ناشناخته/سفارشی به کندل‌استیک برمی‌گردند تا همیشه یک آیکونِ معقول باشد.
const CHART_TYPE_ICONS = {
  candles: CandlestickChart, hollow: CandlestickChart, heikin: CandlestickChart,
  bars: BarChart3, columns: BarChart3, hilo: BarChart3, volcandle: BarChart3,
  line: LineChart, linemarkers: LineChart, step: LineChart, kagi: LineChart, linebreak: LineChart,
  area: AreaChart, hlcarea: AreaChart, baseline: Activity, renko: BarChart3, pnf: Activity, range: BarChart3,
};
// آیکونِ کوچکِ نوعِ چارت — کم‌رنگ و شارپ، فقط اگر chartType داده شود.
function ChartTypeIcon({ chartType, TH, size = 13 }) {
  if (!chartType) return null;
  const Ic = CHART_TYPE_ICONS[chartType] || CandlestickChart;
  return <Ic size={size} className="shrink-0" style={{ color: TH.text, opacity: 0.6 }} />;
}

// جهتِ نرمال‌شده از priceDir/dir به up|down|'' — پشتیبانی از رشته ('up'/'down') و عدد (1/-1).
function normDir(d) {
  if (d === 'up' || d === 1) return 'up';
  if (d === 'down' || d === -1) return 'down';
  return '';
}

// فلَشِ جهت‌دارِ سبز/قرمز روی هر تغییرِ مقدار (حسِ زنده‌بودنِ TV). از کلاس‌های سراسریِ
//   .flash-up/.flash-down (index.css) استفاده می‌کند؛ برای ری‌استارتِ انیمیشن روی هر تغییر،
//   عنصر با keyِ نو ری‌مونت می‌شود. جهت از تیکِ فید (dir) گرفته می‌شود، نبودش ⇐ مقایسهٔ مقدار.
function FlashNum({ value, dir, className = '', style, children }) {
  const prev = React.useRef(value);
  const [st, setSt] = React.useState({ cls: '', n: 0 });
  React.useEffect(() => {
    if (value != null && prev.current != null && value !== prev.current) {
      const nd = normDir(dir);
      const up = nd ? nd === 'up' : value > prev.current;
      setSt((s) => ({ cls: up ? 'flash-up' : 'flash-down', n: s.n + 1 }));
    }
    prev.current = value;
  }, [value, dir]);
  return <span key={st.n} className={`${className} ${st.cls} rounded-sm`} style={style}>{children}</span>;
}

// لوگو + نامِ نماد (پررنگ) + بازار/تایم‌فریمِ کم‌رنگ. فرگمنت (بدونِ wrapper) تا در
//   هر دو Legend و ChartLegend داخلِ ردیفِ موجود بنشیند. سبکِ دقیقِ TradingView:
//   نامِ نماد پررنگ و پرکنتراست، بازار/تایم‌فریم به‌صورتِ لیبلِ کم‌رنگِ کوچک با میان‌فاصلهٔ ·.
function SymbolHead({ TH, symbol, tf, market, chartType, name }) {
  const mk = market != null ? market : marketOf(symbol);
  // نامِ کاملِ نماد (سبکِ TV: «Apple Inc») — اگر caller مقدارِ name ندهد، از symbolMeta
  //   استخراج و memoize می‌شود تا در تیک‌های زندهٔ OHLC دوباره محاسبه نشود.
  const full = React.useMemo(() => {
    if (name != null) return name;
    try { const m = classify(symbol); return m && m.name && m.name !== symbol ? m.name : ''; }
    catch (e) { return ''; }
  }, [name, symbol]);
  return (
    <>
      <SymbolLogo symbol={symbol} size={18} />
      <span className="text-[13px] font-bold whitespace-nowrap tracking-tight" dir="ltr"
        style={{ color: TH.textStrong, letterSpacing: '-.01em' }}>{symbol}</span>
      {full && (
        <span className="text-[11px] whitespace-nowrap font-medium max-w-[168px] truncate" style={{ color: TH.text, opacity: 0.74 }}>{full}</span>
      )}
      {(mk || tf) && (
        <span className="text-[10px] tnum whitespace-nowrap font-medium" dir="ltr" style={{ color: TH.text, opacity: 0.55 }}>
          {tf}{tf && mk ? ' · ' : ''}{mk}
        </span>
      )}
      <ChartTypeIcon chartType={chartType} TH={TH} />
    </>
  );
}

// O/H/L/C با لیبلِ کوچکِ کم‌رنگ و مقدارِ رنگیِ جهت (up/down) — دقیقاً مثلِ نوارِ لجندِ TV.
//   لیبل‌ها خاکستریِ کم‌رنگ، مقادیر پررنگِ رنگی و .tnum برای هم‌ترازیِ ارقام.
function OhlcTape({ legend, col, TH, dir }) {
  if (!legend) return null;
  const cells = legend.open != null
    ? [['O', legend.open], ['H', legend.high], ['L', legend.low], ['C', legend.close]]
    : [['C', legend.close]];
  return (
    <span className="flex items-center gap-1.5 text-[11px] tnum whitespace-nowrap" dir="ltr">
      {cells.map(([k, v]) => (
        <span key={k} className="flex items-center gap-0.5">
          <span className="font-medium" style={{ color: TH.text, opacity: 0.5 }}>{k}</span>
          {/* فقط Close با تیکِ زنده فلَش می‌زند (مثلِ TV) تا حسِ زنده‌بودن بدهد */}
          {k === 'C'
            ? <FlashNum value={v} dir={dir} className="font-semibold px-0.5 -mx-0.5" style={{ color: col }}>{v}</FlashNum>
            : <span className="font-semibold" style={{ color: col }}>{v}</span>}
        </span>
      ))}
    </span>
  );
}

// یک سلولِ حجم به سبکِ لجندِ TV: مربعِ رنگیِ کم‌رنگ + لیبلِ «حجم» + مقدارِ فلَش‌دار.
//   volume خام (عدد) می‌گیرد؛ اگر fmtVol داده شود از آن، وگرنه از فرمترِ پیش‌فرضِ K/M/B.
function VolumeRow({ vol, dir, TH, fmtVol, compact }) {
  const str = typeof fmtVol === 'function' ? fmtVol(vol) : dwFmtVol(null, vol);
  if (str == null) return null;
  const nd = normDir(dir);
  const col = nd === 'up' ? TH.up : nd === 'down' ? TH.down : TH.text;
  if (compact) {
    return (
      <span className="flex items-center gap-1 rounded px-1.5 h-6 text-[12px] shrink-0" style={{ background: TH.chipBg, color: TH.textStrong }} dir="rtl">
        <span className="rounded-[2px] shrink-0" style={{ width: 9, height: 9, background: col, opacity: 0.55, boxShadow: `0 0 0 1px ${TH.border}` }} />
        <span className="whitespace-nowrap">حجم</span>
        <FlashNum value={vol} dir={dir} className="tnum tabular-nums font-medium px-0.5 -mx-0.5" style={{ color: col }}>{str}</FlashNum>
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-md px-1.5 h-6"
      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <span className="rounded-[2px] shrink-0" style={{ width: 10, height: 10, background: col, opacity: 0.55, boxShadow: `0 0 0 1px ${TH.border}` }} />
      <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: TH.textStrong }}>حجم</span>
      <FlashNum value={vol} dir={dir} className="text-[12px] tabular-nums whitespace-nowrap font-medium px-0.5 -mx-0.5" style={{ color: col, direction: 'ltr' }}>{str}</FlashNum>
    </div>
  );
}

// تغییرِ مطلق و درصدی به‌صورتِ متنِ رنگیِ ساده — دقیقاً سبکِ TV: «+2.83 (+0.90%)».
//   chStr (تغییرِ مطلقِ ازپیش‌فرمت‌شده) اختیاری است؛ نبودش ⇐ فقط درصد.
function ChangeChip({ ch, chStr, col }) {
  if (ch == null) return null;
  const pct = `${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(2)}%`;
  return (
    <span className="tnum text-[11px] font-semibold shrink-0 whitespace-nowrap leading-none" dir="ltr" style={{ color: col }}>
      {chStr != null ? `${chStr} (${pct})` : pct}
    </span>
  );
}

// چیپِ Legend (OHLC) روی چارت — رندرِ خالص؛ همهٔ ورودی‌ها از props.
//   propهای جدید (chartType/priceDir/volume/fmtVol) اختیاری و backward-compatible‌اند.
export function Legend({ legend, TH, symbol, tf, market, name, chartType, priceDir, volume, fmtVol }) {
  if (!legend) return null;
  const chAbs = legend.open != null ? (legend.close - legend.open) : null;
  const ch = chAbs != null && legend.open ? (chAbs / legend.open) * 100 : null;
  const col = ch == null ? TH.text : ch >= 0 ? TH.up : TH.down;
  const chStr = chAbs != null ? fmtDelta(chAbs, Math.max(decimalsOf(legend.close), decimalsOf(legend.open))) : null;
  const vol = volume != null ? volume : legend.volume;
  return (
    <div className="absolute top-2 right-2 z-20 rounded-md px-2 py-1 flex items-center gap-1.5 border" dir="rtl"
      style={{ background: TH.overlayMask, borderColor: TH.border, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', boxShadow: '0 1px 3px rgba(0,0,0,.10)' }}>
      <SymbolHead TH={TH} symbol={symbol} tf={tf} market={market} name={name} chartType={chartType} />
      <OhlcTape legend={legend} col={col} TH={TH} dir={priceDir} />
      <ChangeChip ch={ch} chStr={chStr} col={col} />
      {vol != null && (
        <span className="flex items-center gap-0.5 text-[11px] tnum whitespace-nowrap" dir="ltr">
          <span className="font-medium" style={{ color: TH.text, opacity: 0.5 }}>Vol</span>
          <FlashNum value={vol} dir={priceDir} className="font-semibold px-0.5 -mx-0.5" style={{ color: col, direction: 'ltr' }}>
            {typeof fmtVol === 'function' ? fmtVol(vol) : dwFmtVol(null, vol)}
          </FlashNum>
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChartLegend (#3) — Legendِ یکپارچهٔ روی چارت سبکِ TradingView:
//   ردیفِ نماد (OHLC) + یک ردیف برای هر اندیکاتورِ فعال (سواچ + نام + مقدارِ زنده +
//   کنترل‌های on-hover: چشم/تنظیمات/سه‌نقطه/حذف). فلشِ collapse + حالتِ Normal/Compact.
//   propهای جدید همگی اختیاری‌اند (backward-compatible)؛ مقادیرِ زنده از indVals می‌آید.
// ─────────────────────────────────────────────────────────────────────────────
function LegendIconBtn({ TH, title, ariaLabel, onClick, danger, children, alwaysShow }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel || title}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
      className={`flex items-center justify-center rounded-md transition-colors duration-[120ms] ${alwaysShow ? '' : 'bn-leg-ctrl'}`}
      style={{ width: 24, height: 24, color: TH.text }}
      onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; if (danger) e.currentTarget.style.color = TH.down; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TH.text; }}
    >
      {children}
    </button>
  );
}

function LegendRow({ item, TH, value, coarse, viewMode, onToggle, onSettings, onRemove, onMore, moreOpen, onCloseMore, onDup, onHelp, hasHelp }) {
  const visible = item.visible !== false;
  const color = item.color || '#2962FF';
  if (viewMode === 'compact') {
    return (
      <button type="button" onClick={() => onSettings(item)} title={item.label}
        className="flex items-center gap-1 rounded px-1.5 h-6 text-[12px] shrink-0"
        style={{ background: TH.chipBg, color: TH.textStrong, opacity: visible ? 1 : 0.45 }}>
        <span className="rounded-full shrink-0" style={{ width: 9, height: 9, background: color, boxShadow: `0 0 0 1px ${TH.border}` }} />
        <span className="whitespace-nowrap">{item.label}</span>
      </button>
    );
  }
  return (
    <div className="group/leg flex items-center gap-1.5 rounded-md px-1.5 h-7 relative"
      style={{ opacity: visible ? 1 : 0.45 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
      <button type="button" onClick={() => onSettings(item)} title="تنظیماتِ اندیکاتور"
        className="rounded-full shrink-0" style={{ width: 10, height: 10, background: color, boxShadow: `0 0 0 1px ${TH.border}` }} />
      <button type="button" onClick={() => onSettings(item)}
        className="text-[12px] font-semibold whitespace-nowrap text-right" style={{ color: TH.textStrong }}>{item.label}</button>
      {value != null && value !== '' && (
        <span className="text-[12px] tabular-nums whitespace-nowrap font-medium" dir="ltr" style={{ color }}>{value}</span>
      )}
      <span className="flex-1" />
      <div className={`flex items-center gap-0.5 ${coarse ? '' : 'bn-leg-ctrls'}`}>
        <LegendIconBtn TH={TH} alwaysShow={coarse} title={visible ? 'پنهان‌کردن' : 'نمایش'} ariaLabel="نمایش/پنهان" onClick={() => onToggle(item)}>
          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </LegendIconBtn>
        <LegendIconBtn TH={TH} alwaysShow={coarse} title="تنظیمات" ariaLabel="تنظیمات" onClick={() => onSettings(item)}><Settings2 size={16} /></LegendIconBtn>
        <div className="relative">
          <LegendIconBtn TH={TH} alwaysShow={coarse} title="بیشتر" ariaLabel="بیشتر" onClick={() => onMore(item)}><MoreHorizontal size={16} /></LegendIconBtn>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); onCloseMore(); }} />
              <div className="absolute left-0 top-7 z-[61] w-40 rounded-md py-1 text-[12px] shadow-xl" dir="rtl"
                style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
                <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={(e) => { e.stopPropagation(); onDup(item); onCloseMore(); }}><Copy size={13} /> تکثیرِ اندیکاتور</button>
                {hasHelp && (
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={(e) => { e.stopPropagation(); onHelp(item); onCloseMore(); }}><HelpCircle size={13} /> راهنما</button>
                )}
                <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.down }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={(e) => { e.stopPropagation(); onRemove(item); onCloseMore(); }}><Trash2 size={13} /> حذف</button>
              </div>
            </>
          )}
        </div>
        <LegendIconBtn TH={TH} alwaysShow={coarse} danger title="حذفِ اندیکاتور" ariaLabel="حذفِ اندیکاتور" onClick={() => onRemove(item)}><Trash2 size={16} /></LegendIconBtn>
      </div>
    </div>
  );
}

// items: [{id, key, label, color, visible, scope}]، indVals: {id: 'value-string'}
export function ChartLegend({
  items = [], legend, TH, symbol, tf, market, name, indVals = {},
  collapsed = false, onCollapse, viewMode = 'normal', onToggleViewMode,
  onToggleVisible, onSettings, onRemove, onDuplicate, onHelp, hasHelp, onClearAll, coarse = false,
  chartType, priceDir, volume, fmtVol, showVolume = true,
}) {
  const [moreId, setMoreId] = useState(null);
  const chAbs = legend && legend.open != null ? (legend.close - legend.open) : null;
  const ch = chAbs != null && legend.open ? (chAbs / legend.open) * 100 : null;
  const col = ch == null ? TH.text : ch >= 0 ? TH.up : TH.down;
  const chStr = chAbs != null ? fmtDelta(chAbs, Math.max(decimalsOf(legend.close), decimalsOf(legend.open))) : null;
  const hasInds = items.length > 0;
  const compact = viewMode === 'compact';
  const vol = volume != null ? volume : (legend && legend.volume);
  const hasVol = showVolume && vol != null;
  const rowsOpen = (hasInds || hasVol) && !collapsed;

  return (
    <div className="absolute top-2 right-2 z-20 max-w-[min(70%,520px)]"
      style={{ background: TH.overlayMask, backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', border: `1px solid ${TH.border}`, borderRadius: 8, padding: '4px 6px', boxShadow: '0 1px 3px rgba(0,0,0,.10)' }}>
      <style>{`.bn-leg-ctrls{opacity:0;transition:opacity 120ms ease}.group\\/leg:hover .bn-leg-ctrls{opacity:1}.bn-leg-ctrl{opacity:0}.group\\/leg:hover .bn-leg-ctrl{opacity:1}`}</style>
      {/* ردیفِ نماد (OHLC) */}
      <div className="flex items-center gap-1.5 px-1.5 h-7">
        {(hasInds || hasVol) && (
          <button type="button" onClick={() => onCollapse && onCollapse(!collapsed)} title={collapsed ? 'بازکردنِ اندیکاتورها' : 'جمع‌کردنِ اندیکاتورها'} aria-label="جمع/باز"
            className="flex items-center justify-center rounded shrink-0" style={{ width: 18, height: 18, color: TH.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        <SymbolHead TH={TH} symbol={symbol} tf={tf} market={market} name={name} chartType={chartType} />
        <OhlcTape legend={legend} col={col} TH={TH} dir={priceDir} />
        <ChangeChip ch={ch} chStr={chStr} col={col} />
        {hasInds && (
          <>
            <span className="flex-1" />
            <button type="button" onClick={onToggleViewMode} title={compact ? 'نمای کامل' : 'نمای فشرده'} aria-label="حالتِ نمایش"
              className="flex items-center justify-center rounded shrink-0" style={{ width: 22, height: 22, color: compact ? TH.accent : TH.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Rows3 size={14} /></button>
            <button type="button" onClick={() => { if (window.confirm('همهٔ اندیکاتورها حذف شوند؟')) onClearAll && onClearAll(); }} title="پاکِ همهٔ اندیکاتورها" aria-label="حذفِ همهٔ اندیکاتورها"
              className="flex items-center justify-center rounded shrink-0" style={{ width: 22, height: 22, color: TH.text }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; e.currentTarget.style.color = TH.down; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TH.text; }}><Trash2 size={14} /></button>
          </>
        )}
      </div>
      {/* ردیف‌های اندیکاتور + ردیفِ جدای حجم (سبکِ status-line‌یِ TV) */}
      {rowsOpen && (
        compact ? (
          <div className="flex flex-wrap items-center gap-1 px-1 pt-0.5 pb-0.5">
            {items.map((it) => (
              <LegendRow key={it.id} item={it} TH={TH} viewMode="compact" coarse={coarse} onSettings={onSettings} onToggle={onToggleVisible} onRemove={onRemove} onMore={() => {}} onDup={onDuplicate} onHelp={onHelp} hasHelp={hasHelp && hasHelp(it)} />
            ))}
            {hasVol && <VolumeRow vol={vol} dir={priceDir} TH={TH} fmtVol={fmtVol} compact />}
          </div>
        ) : (
          <div className="flex flex-col">
            {items.map((it) => (
              <LegendRow key={it.id} item={it} TH={TH} value={indVals[it.id]} coarse={coarse} viewMode="normal"
                onToggle={onToggleVisible} onSettings={onSettings} onRemove={onRemove}
                onMore={() => setMoreId((m) => (m === it.id ? null : it.id))} moreOpen={moreId === it.id} onCloseMore={() => setMoreId(null)}
                onDup={onDuplicate} onHelp={onHelp} hasHelp={hasHelp && hasHelp(it)} />
            ))}
            {hasVol && <VolumeRow vol={vol} dir={priceDir} TH={TH} fmtVol={fmtVol} />}
          </div>
        )
      )}
      {(hasInds || hasVol) && collapsed && (
        <button type="button" onClick={() => onCollapse && onCollapse(false)} className="text-[11px] px-1.5 pb-0.5 text-right w-full" style={{ color: TH.text, opacity: 0.7 }}>
          {items.length ? `${items.length} اندیکاتور` : 'نمایشِ حجم'}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DataWindow (#2) — پنجرهٔ دادهٔ شناورِ سبکِ TradingView: زیرِ crosshair مقدارِ
//   O/H/L/C + تغییر (مطلق و درصد) + حجم + زمان + مقدارِ زندهٔ هر اندیکاتورِ فعال
//   را نشان می‌دهد. رندرِ خالص؛ همهٔ داده از prop `dataWin` می‌آید (هم‌شکلِ همان
//   ساختاری که BazaarNama می‌سازد: { time, ohlc, inds, vol }). اگر داده در دسترس
//   نباشد (crosshair بیرونِ چارت) حالتِ خالی نشان داده می‌شود.
//   propهای اختیاری‌اند و backward-compatible؛ اعداد با .tnum، جهت RTL.
// ─────────────────────────────────────────────────────────────────────────────
function dwFmt(fmt, symbol, v) {
  if (v == null || Number.isNaN(v)) return '—';
  if (typeof fmt === 'function') return fmt(symbol, v);
  return typeof v === 'number' ? String(v) : String(v);
}
function dwFmtVol(fmtVol, v) {
  if (v == null || Number.isNaN(v)) return null;
  if (typeof fmtVol === 'function') return fmtVol(v);
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return String(n);
}
function dwFmtTime(fmtTime, t) {
  if (t == null) return null;
  if (typeof fmtTime === 'function') return fmtTime(t);
  // t می‌تواند epochِ ثانیه‌ای یا BusinessDay ({year,month,day}) از lightweight-charts باشد.
  if (typeof t === 'object' && t.year != null) {
    const p = (n) => String(n).padStart(2, '0');
    return `${t.year}-${p(t.month)}-${p(t.day)}`;
  }
  if (typeof t === 'number') { try { return new Date(t * 1000).toLocaleString(); } catch (e) { return String(t); } }
  return String(t);
}

// pos: {top,left} با پیش‌فرضِ گوشهٔ بالا-چپ (هم‌راستا با پیاده‌سازیِ inlineِ قبلی).
export function DataWindow({
  dataWin, TH, symbol, tf, fmt, fmtVol, fmtTime, onClose,
  pos = { top: 48, left: 12 }, title = 'پنجرهٔ داده',
}) {
  const ohlc = dataWin && dataWin.ohlc;
  const inds = (dataWin && dataWin.inds) || [];
  const up = ohlc && ohlc.close >= ohlc.open;
  const dirCol = up ? TH.up : TH.down;
  const chAbs = ohlc && ohlc.open != null ? ohlc.close - ohlc.open : null;
  const chPct = ohlc && ohlc.open ? (chAbs / ohlc.open) * 100 : null;
  const vol = dataWin ? (dataWin.vol != null ? dataWin.vol : (ohlc && ohlc.volume != null ? ohlc.volume : null)) : null;
  const volStr = dwFmtVol(fmtVol, vol);
  const timeStr = dataWin ? dwFmtTime(fmtTime, dataWin.time) : null;

  return (
    <div className="absolute z-30 w-52 rounded-lg pc-pop text-[11px] overflow-hidden" dir="rtl"
         style={{ top: pos.top, left: pos.left, background: TH.panel, border: `1px solid ${TH.border}` }}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b" style={{ borderColor: TH.border }}>
        <span className="font-semibold whitespace-nowrap" style={{ color: TH.textStrong }}>{title}</span>
        <span className="flex items-center gap-1.5">
          {(symbol || tf) && <span className="tnum whitespace-nowrap opacity-60" dir="ltr" style={{ color: TH.text }}>{symbol}{symbol && tf ? ' · ' : ''}{tf}</span>}
          {onClose && <button onClick={onClose} className="pc-iconbtn w-5 h-5" title="بستن" aria-label="بستن"><X size={12} /></button>}
        </span>
      </div>
      <div className="px-2.5 py-1.5 tnum" style={{ color: TH.text }}>
        {ohlc ? (
          <>
            {timeStr && (
              <div className="flex justify-between gap-2 mb-0.5">
                <span className="opacity-60">زمان</span>
                <span className="truncate" dir="ltr" style={{ color: TH.textStrong }}>{timeStr}</span>
              </div>
            )}
            {['open', 'high', 'low', 'close'].map((k) => (
              <div key={k} className="flex justify-between"><span>{({ open: 'O', high: 'H', low: 'L', close: 'C' })[k]}</span>
                <span dir="ltr" style={{ color: dirCol }}>{dwFmt(fmt, symbol, ohlc[k])}</span></div>
            ))}
            {chAbs != null && (
              <div className="flex justify-between"><span>تغییر</span>
                <span dir="ltr" style={{ color: dirCol }}>
                  {chAbs >= 0 ? '+' : ''}{dwFmt(fmt, symbol, chAbs)}
                  {chPct != null ? `  (${chPct >= 0 ? '+' : ''}${chPct.toFixed(2)}%)` : ''}
                </span>
              </div>
            )}
            {volStr != null && (
              <div className="flex justify-between"><span>حجم</span>
                <span dir="ltr" style={{ color: TH.textStrong }}>{volStr}</span></div>
            )}
            {inds.length > 0 && <div className="my-1 border-t" style={{ borderColor: TH.border }} />}
            {inds.map((ind, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="truncate" style={{ color: ind.color }}>{ind.label}</span>
                <span dir="ltr" style={{ color: TH.textStrong }}>{(ind.vals || []).map((v) => dwFmt(fmt, symbol, v)).join(' / ')}</span>
              </div>
            ))}
          </>
        ) : <div className="opacity-50 text-center py-1">نشانگر را روی چارت ببر</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CrosshairAxisTag (#9) — تگِ محورِ قیمت (راست) و زمان (پایین) زیرِ crosshair.
//   lightweight-charts خودش این لیبل‌ها را وقتی crosshair فعال است رسم می‌کند؛ این
//   کامپوننت یک fallbackِ خالصِ اختیاری است برای وقتی که نیستند. اگر مختصات/متنی
//   داده نشود، چیزی رسم نمی‌کند. price:{y,text} روی لبهٔ راست، time:{x,text} روی لبهٔ پایین.
// ─────────────────────────────────────────────────────────────────────────────
export function CrosshairAxisTag({ price, time, TH }) {
  if ((!price || price.text == null) && (!time || time.text == null)) return null;
  const chipBg = (TH && (TH.crosshairLabelBg || TH.popoverBg)) || 'rgba(30,34,45,.98)';
  // متنِ سفید روی پس‌زمینهٔ خاکستریِ خنثیِ تگِ کراس‌هیر (سبکِ TV) — کنتراست در هر دو تم.
  const chipFg = '#ffffff';
  const chipBorder = 'transparent';
  return (
    <>
      {price && price.text != null && price.y != null && (
        <div className="absolute right-0 z-30 pointer-events-none tnum text-[11px] px-1.5 py-0.5 rounded-sm whitespace-nowrap"
             dir="ltr" style={{ top: price.y, transform: 'translateY(-50%)', background: chipBg, color: chipFg, border: `1px solid ${chipBorder}` }}>
          {price.text}
        </div>
      )}
      {time && time.text != null && time.x != null && (
        <div className="absolute bottom-0 z-30 pointer-events-none tnum text-[11px] px-1.5 py-0.5 rounded-sm whitespace-nowrap"
             dir="ltr" style={{ left: time.x, transform: 'translateX(-50%)', background: chipBg, color: chipFg, border: `1px solid ${chipBorder}` }}>
          {time.text}
        </div>
      )}
    </>
  );
}

// شمارشِ معکوسِ بسته‌شدنِ کندل + وضعیتِ بازار — رندرِ خالص.
//   سبکِ TV: اگر axisY (مختصاتِ yِ قیمتِ آخر روی محور) داده شود، تگ زیرِ برچسبِ قیمتِ
//   آخر روی محورِ راست می‌نشیند (دنبالِ قیمت)؛ وگرنه fallback به گوشهٔ پایین-راست.
export function CountdownChip({ countdown, countdownColor, TH, marketOpen, axisY }) {
  if (!countdown) return null;
  const onAxis = axisY != null && Number.isFinite(axisY);
  const pos = onAxis ? { top: Math.round(axisY) + 16, right: 2 } : { bottom: 12, right: 12 };
  return (
    <div className="absolute z-20 pointer-events-none rounded-md px-2 py-1 text-[11px] font-mono tabular-nums flex items-center gap-1.5 border shadow-sm" style={{ ...pos, borderColor: countdownColor || TH.border, background: TH.popoverBg, color: countdownColor || undefined }} dir="ltr">
      <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-green-400' : 'bg-red-400'}`} />
      {/* آیکونِ ساعتِ اختصاصیِ SVG (به‌جای ایموجیِ ⏱ که در فونتِ سایت رِندر نمی‌شد و به‌صورتِ □ می‌افتاد) */}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" />
      </svg><b>{countdown}</b>
    </div>
  );
}

// واترمارکِ لوگوی بازارنما — رندرِ خالص. سبکِ دقیقِ TradingView: بسیار کم‌رنگ (شبح)
//   تا فقط برندینگِ ظریف باشد و خواناییِ چارت را خدشه‌دار نکند. opacity/height اختیاری‌اند.
export function Watermark({ src, theme, opacity = 0.13, height = 60 }) {
  // لوگوی سفیدِ شفاف؛ روی تمِ روشن invert می‌شود. بالاتر از محورِ تاریخ (bottom-8).
  return (
    <img
      src={src}
      alt="بازارنما"
      className="absolute bottom-8 left-3 z-20 pointer-events-none select-none"
      style={{ height, opacity, filter: theme === 'light' ? 'invert(1)' : 'none' }}
    />
  );
}

// نوارِ کنترلِ بازپخش — رندرِ خالص؛ همهٔ هندلرها از props.
export function ReplayBar({ replay, TH, replayStepBack, replayToggle, replayStep, replaySeek, replaySetSpeed, exitReplay }) {
  if (!replay.on) return null;
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
      <span className="font-bold" style={{ color: TH.accent }}>بازپخش</span>
      <button onClick={replayStepBack} title="گامِ عقب" className="p-1 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)} aria-label="گامِ عقب">
        {/* آیکون‌های اختصاصیِ SVG برای کنترلِ بازپخش (به‌جای گلیف‌های ⏮/⏸/▶/⏭ که وابسته به فونت‌اند و می‌توانند □ شوند) */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="6" width="2.2" height="12" rx="1" /><path d="M19 6v12l-9-6z" /></svg></button>
      <button onClick={replayToggle} title="پخش/مکث" className="p-1 rounded-md text-white transition-colors duration-[120ms] flex items-center justify-center" style={{ background: TH.accent }} aria-label="پخش/مکث">
        {replay.playing
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="5" width="4" height="14" rx="1" /><rect x="13" y="5" width="4" height="14" rx="1" /></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>}
      </button>
      <button onClick={replayStep} title="گامِ جلو" className="p-1 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)} aria-label="گامِ جلو">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 6v12l9-6z" /><rect x="16.8" y="6" width="2.2" height="12" rx="1" /></svg></button>
      {/* اسلایدرِ scrub: پرش به هر کندل */}
      <input type="range" min={0} max={Math.max(0, replay.length - 1)} value={replay.idx} onChange={(e) => replaySeek(Number(e.target.value))} title="پرش به کندل" className="w-28 h-1 cursor-pointer transition-colors duration-[120ms]" style={{ accentColor: TH.accent }} />
      <span className="opacity-60 tabular-nums">{replay.length ? `${replay.idx + 1}/${replay.length}` : ''}</span>
      <span className="opacity-60">سرعت</span>
      {SPEED_LADDER.map((sp) => (<button key={sp} onClick={() => replaySetSpeed(sp)} className={`px-1.5 rounded-md tabular-nums transition-colors duration-[120ms] ${replay.speed === sp ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={replay.speed === sp ? { background: TH.accent } : {}}>{sp}×</button>))}
      <button onClick={exitReplay} className="p-1 rounded-md bg-red-500/20 text-red-400 transition-colors duration-[120ms]">✕ خروج</button>
    </div>
  );
}
