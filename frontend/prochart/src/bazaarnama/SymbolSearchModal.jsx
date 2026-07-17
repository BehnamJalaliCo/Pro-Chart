import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Star, Clock } from './tvIcons';
import SymbolLogo from './SymbolLogo';
import VirtualList from './VirtualList';
import { searchSymbols, highlightPositions } from './fuzzy';
import { CATEGORIES, CAT_FA, filterCleanMeta, isCleanSymbol } from './symbolMeta';

// #۷ رنگِ بَجِ نوعِ دارایی، هم‌خانوادهٔ پالتِ TradingView (هر کلاس یک رنگِ امضا)
const TYPE_COLOR = {
  forex: '#2962FF', crypto: '#F7931A', metal: '#E0A526',
  index: '#9C56E6', energy: '#26A69A', other: '#787B86',
};

// ── پرچمِ کشورِ ردیف (سبکِ TradingView؛ trailing meta). نگاشتِ ارز/شاخص → کدِ ISO2 ──
// فارکس: ارزِ مظنه (پایه روی لوگوی چپ است) · فلز: مظنه (معمولاً USD) · شاخص/انرژی: کشورِ بورس.
const CCY_CC = {
  USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', CHF: 'CH', CAD: 'CA', AUD: 'AU', NZD: 'NZ',
  NOK: 'NO', SEK: 'SE', SGD: 'SG', HKD: 'HK', TRY: 'TR', ZAR: 'ZA', MXN: 'MX', CNH: 'CN',
  DKK: 'DK', PLN: 'PL',
};
function flagCodeOf(m) {
  if (!m) return null;
  if (m.cat === 'forex') return CCY_CC[m.quote] || CCY_CC[m.base] || null;
  if (m.cat === 'metal') return CCY_CC[m.quote] || 'US';
  if (m.cat === 'index') return m.country || null;
  if (m.cat === 'energy') return m.country || 'US';
  return null; // کریپتو/سایر → جهانی، بدونِ پرچم
}

// گلیفِ پرچمِ سادهٔ ۲۴×۱۶ (تخت، شارپ، خوانا در اندازهٔ کوچک). فقط کشورهایی که واقعاً ظاهر می‌شوند.
const FLAGS = {
  US: (<><rect width="24" height="16" fill="#b22234" />{[1, 3, 5, 7, 9, 11].map((i) => (<rect key={i} y={i * (16 / 13)} width="24" height={16 / 13} fill="#fff" />))}<rect width="11" height={16 * 7 / 13} fill="#3c3b6e" /></>),
  EU: (<><rect width="24" height="16" fill="#039" /><circle cx="12" cy="8" r="4.2" fill="none" stroke="#fc0" strokeWidth="1.1" strokeDasharray="0.5 1.35" /></>),
  GB: (<><rect width="24" height="16" fill="#012169" /><path d="M0 0L24 16M24 0L0 16" stroke="#fff" strokeWidth="3.2" /><path d="M0 0L24 16M24 0L0 16" stroke="#c8102e" strokeWidth="1.4" /><path d="M12 0v16M0 8h24" stroke="#fff" strokeWidth="5" /><path d="M12 0v16M0 8h24" stroke="#c8102e" strokeWidth="2.6" /></>),
  JP: (<><rect width="24" height="16" fill="#fff" /><circle cx="12" cy="8" r="4" fill="#bc002d" /></>),
  CH: (<><rect width="24" height="16" fill="#d52b1e" /><rect x="10.5" y="3" width="3" height="10" fill="#fff" /><rect x="7" y="6.5" width="10" height="3" fill="#fff" /></>),
  CA: (<><rect width="24" height="16" fill="#fff" /><rect width="6" height="16" fill="#d52b1e" /><rect x="18" width="6" height="16" fill="#d52b1e" /><path d="M12 4l1 2.2 2.2-.6-1 2 1.6 1.2-2 .4.2 2-2-1.2-2 1.2.2-2-2-.4 1.6-1.2-1-2 2.2.6z" fill="#d52b1e" /></>),
  AU: (<><rect width="24" height="16" fill="#00247d" /><rect width="11" height="8" fill="#012169" /><path d="M0 0l11 8M11 0L0 8" stroke="#fff" strokeWidth="1.4" /><path d="M5.5 0v8M0 4h11" stroke="#fff" strokeWidth="2" /><circle cx="5.5" cy="12.5" r="1.3" fill="#fff" /><circle cx="18" cy="9.5" r="1" fill="#fff" /><circle cx="20.5" cy="5.5" r="0.9" fill="#fff" /></>),
  NZ: (<><rect width="24" height="16" fill="#00247d" /><rect width="11" height="8" fill="#012169" /><path d="M0 0l11 8M11 0L0 8" stroke="#fff" strokeWidth="1.4" /><path d="M5.5 0v8M0 4h11" stroke="#fff" strokeWidth="2" /><circle cx="18" cy="9.5" r="1.1" fill="#cc142b" /><circle cx="20.5" cy="5.5" r="0.9" fill="#cc142b" /></>),
  NO: (<><rect width="24" height="16" fill="#ef2b2d" /><rect x="6" width="4" height="16" fill="#fff" /><rect y="6" width="24" height="4" fill="#fff" /><rect x="7" width="2" height="16" fill="#002868" /><rect y="7" width="24" height="2" fill="#002868" /></>),
  SE: (<><rect width="24" height="16" fill="#006aa7" /><rect x="6" width="3" height="16" fill="#fecc00" /><rect y="6.5" width="24" height="3" fill="#fecc00" /></>),
  DK: (<><rect width="24" height="16" fill="#c60c30" /><rect x="6" width="3" height="16" fill="#fff" /><rect y="6.5" width="24" height="3" fill="#fff" /></>),
  DE: (<><rect width="24" height="16" fill="#ffce00" /><rect width="24" height="10.67" fill="#d00" /><rect width="24" height="5.33" fill="#000" /></>),
  FR: (<><rect width="24" height="16" fill="#ed2939" /><rect width="16" height="16" fill="#fff" /><rect width="8" height="16" fill="#002395" /></>),
  PL: (<><rect width="24" height="16" fill="#fff" /><rect y="8" width="24" height="8" fill="#dc143c" /></>),
  MX: (<><rect width="24" height="16" fill="#ce1126" /><rect width="16" height="16" fill="#fff" /><rect width="8" height="16" fill="#006847" /><circle cx="12" cy="8" r="1.3" fill="#8b5a2b" /></>),
  CN: (<><rect width="24" height="16" fill="#de2910" /><circle cx="5" cy="5" r="2" fill="#ffde00" /><circle cx="9.5" cy="2.6" r="0.7" fill="#ffde00" /><circle cx="11" cy="5" r="0.7" fill="#ffde00" /><circle cx="10.5" cy="8" r="0.7" fill="#ffde00" /><circle cx="8.6" cy="9.6" r="0.7" fill="#ffde00" /></>),
  HK: (<><rect width="24" height="16" fill="#de2910" /><circle cx="12" cy="8" r="3.2" fill="#fff" /><circle cx="12" cy="8" r="1.5" fill="#de2910" /></>),
  SG: (<><rect width="24" height="16" fill="#fff" /><rect width="24" height="8" fill="#ef3340" /><circle cx="6.2" cy="4" r="2.6" fill="#fff" /><circle cx="7.7" cy="4" r="2.1" fill="#ef3340" /><circle cx="9.8" cy="2.6" r="0.55" fill="#fff" /><circle cx="9.8" cy="5.4" r="0.55" fill="#fff" /><circle cx="11" cy="4" r="0.55" fill="#fff" /></>),
  TR: (<><rect width="24" height="16" fill="#e30a17" /><circle cx="10" cy="8" r="3.2" fill="#fff" /><circle cx="11.3" cy="8" r="2.5" fill="#e30a17" /><circle cx="14" cy="8" r="1.1" fill="#fff" /></>),
  ZA: (<><rect width="24" height="16" fill="#fff" /><rect width="24" height="5.3" fill="#e03c31" /><rect y="10.7" width="24" height="5.3" fill="#001489" /><path d="M0 0L9 8L0 16Z" fill="#000" /><path d="M0 2.4L10.5 8L0 13.6Z" fill="#007749" /></>),
};

// دایرهٔ نه؛ مستطیلِ گِردِ ۳:۲ سبکِ TradingView (رینگِ ظریف، بدونِ سایه). fallback: کدِ خاکستری.
export function CountryFlag({ code, size = 18 }) {
  const g = FLAGS[code];
  const w = size, h = Math.round(size * 2 / 3);
  const cid = `bnfl_${code}_${size}`;
  return (
    <svg width={w} height={h} viewBox="0 0 24 16" shapeRendering="geometricPrecision" className="shrink-0" aria-hidden style={{ borderRadius: 2.5, display: 'block' }}>
      <clipPath id={cid}><rect width="24" height="16" rx="2.5" /></clipPath>
      <g clipPath={`url(#${cid})`}>
        {g || (<><rect width="24" height="16" fill="#3a3f4b" /><text x="12" y="11" textAnchor="middle" fill="#c9cdd6" fontSize="9" fontWeight="700" fontFamily="IRANYekanX, sans-serif">{code}</text></>)}
      </g>
      <rect x="0.5" y="0.5" width="23" height="15" rx="2.2" fill="none" stroke="rgba(0,0,0,.20)" strokeWidth="1" />
    </svg>
  );
}

// های‌لایتِ حروفِ منطبقِ کوئری درونِ متن (امضای جستجوی TradingView — حتی تطبیقِ پراکنده).
// positions از highlightPositions می‌آید؛ حروفِ پیوسته در یک span ادغام می‌شوند.
function mark(text, positions, T) {
  const s = String(text || '');
  if (!positions || !positions.length) return s;
  const set = new Set(positions);
  const out = [];
  let buf = '', on = false;
  const flush = (k) => { if (!buf) return; out.push(on ? <span key={k} style={{ color: T.accent, fontWeight: 800 }}>{buf}</span> : buf); buf = ''; };
  for (let i = 0; i < s.length; i++) {
    const m = set.has(i);
    if (m !== on) { flush('m' + i); on = m; }
    buf += s[i];
  }
  flush('mend');
  return <>{out}</>;
}

const RECENT_KEY = 'bn_recent_symbols';
const loadRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; } };
const pushRecent = (s) => {
  const next = [s, ...loadRecent().filter((x) => x !== s)].slice(0, 8);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch (e) { /* noop */ }
  return next;
};

// مدالِ جستجوی نمادِ حرفه‌ای (fuzzy + دسته‌بندی + لوگو + اسکرولِ مجازی + ناوبریِ کیبورد).
// propها backward-compatible: TH اختیاری (با fallback تیره)؛ coarse برای حالتِ لمسی.
export default function SymbolSearchModal({ open, onClose, metaList = [], watch = [], current, onPick, TH, coarse = false, compareMode = false, seed = '' }) {
  const T = TH || { panel: '#131722', border: '#2a2e39', text: '#b2b5be', textStrong: '#d1d4dc', accent: '#2962FF', chipBg: 'rgba(255,255,255,.06)', chipBgHover: 'rgba(255,255,255,.10)' };
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');       // debounced
  const [cat, setCat] = useState('all');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // debounce ۸۰ms (معادلِ symbol_search_request_delay در TradingView)
  useEffect(() => { const t = setTimeout(() => setDq(q), 80); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (open) { const s = seed || ''; setQ(s); setDq(s); setCat('all'); setActive(0); setTimeout(() => { if (inputRef.current) { inputRef.current.focus(); const n = inputRef.current.value.length; try { inputRef.current.setSelectionRange(n, n); } catch (e) {} } }, 30); } }, [open]); // seed = تایپِ حرف روی چارت (سبکِ type-to-searchِ TV)

  // #۷/۱۴۹ فقط نمادهای دارای لوگوی واقعی (فارکس/کریپتو/فلز/شاخص/انرژی)؛ سهام‌های تصادفیِ
  // بی‌لوگو (A/AA/AAL…) که فقط مونوگرامِ خاکستری می‌گیرند از جهانِ جستجو حذف می‌شوند.
  const cleanMeta = useMemo(() => filterCleanMeta(metaList), [metaList]);
  const results = useMemo(() => searchSymbols(cleanMeta, dq, cat), [cleanMeta, dq, cat]);
  // کوئریِ پاک‌شده برای های‌لایتِ نماد (نمادها الفبا-عددی‌اند؛ اسلش/فاصله حذف می‌شود).
  const qSym = useMemo(() => dq.replace(/[^A-Za-z0-9]/g, ''), [dq]);
  const qDesc = useMemo(() => dq.trim(), [dq]);
  useEffect(() => { setActive(0); }, [dq, cat]);

  const recent = useMemo(() => loadRecent().filter((s) => isCleanSymbol(s) && cleanMeta.some((m) => m.symbol === s)), [cleanMeta, open]);
  const cleanWatch = useMemo(() => watch.filter(isCleanSymbol), [watch]);
  const watchSet = useMemo(() => new Set(cleanWatch), [cleanWatch]);

  const pick = (sym) => { pushRecent(sym); onPick && onPick(sym); onClose && onClose(); };

  // کیبورد: ↑/↓ پیمایش، PageUp/PageDown جهش، Home/End ابتدا/انتها، Enter انتخاب، Esc بستن
  const onKey = (e) => {
    if (e.key === 'Escape') { onClose && onClose(); return; }
    const last = results.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 8)); }
    else if (e.key === 'PageUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 8)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(Math.max(0, last)); }
    else if (e.key === 'Enter') { const r = results[active]; if (r) pick(r.symbol); }
  };

  if (!open) return null;
  const ROW = coarse ? 56 : 48;
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center pt-[8vh] px-3" dir="rtl"
      style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="w-[min(680px,96vw)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: T.panel, border: `1px solid ${T.border}`, maxHeight: '84vh' }}
        onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>

        {/* سرتیترِ دیالوگ (عنوان + بستن) — هم‌ترازِ «Symbol search»ِ TV */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
          <span className="font-bold text-[15px]" style={{ color: T.textStrong }}>{compareMode ? 'مقایسهٔ نماد' : 'جستجوی نماد'}</span>
          <button onClick={onClose} aria-label="بستن" className="opacity-60 hover:opacity-100 p-1 -mr-1 rounded" style={{ color: T.text }}><X size={18} /></button>
        </div>

        {/* نوارِ جستجو */}
        <div className="flex items-center gap-2 px-4 shrink-0" style={{ height: 52, borderBottom: `1px solid ${T.border}` }}>
          <Search size={18} className="opacity-60" style={{ color: T.text }} />
          <input ref={inputRef} dir="ltr" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی نماد… (EURUSD، طلا، BTC)"
            className="flex-1 bg-transparent outline-none text-base tabular-nums placeholder:opacity-50"
            style={{ color: T.textStrong }} />
          {q && (
            <button onClick={() => { setQ(''); inputRef.current && inputRef.current.focus(); }} aria-label="پاک‌کردن"
              className="opacity-55 hover:opacity-100 shrink-0 p-0.5 rounded-full" style={{ color: T.text }}><X size={15} /></button>
          )}
          <kbd className="text-[11px] opacity-50 px-1.5 py-0.5 rounded border" style={{ borderColor: T.border, color: T.text }}>Esc</kbd>
        </div>

        {/* تب‌های دسته‌بندی */}
        <div className="flex gap-1 px-3 py-2 overflow-x-auto bn-thin-scroll shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          {CATEGORIES.map((c) => {
            const on = cat === c.id;
            return (
              <button key={c.id} onClick={() => setCat(c.id)}
                className="px-3 rounded-full text-[13px] whitespace-nowrap transition-colors duration-[120ms]"
                style={{ height: 30, background: on ? T.accent : 'transparent', color: on ? '#fff' : T.text, opacity: on ? 1 : 0.75 }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = T.chipBgHover; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                {c.label}
              </button>
            );
          })}
        </div>

        {/* میان‌بُرها: اخیر + واچ‌لیست (فقط وقتی کوئری خالی است) */}
        {!dq && (recent.length > 0 || cleanWatch.length > 0) && (
          <div className="px-3 pt-2 pb-1.5 flex flex-wrap gap-1.5 text-[12px] shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
            {recent.map((s) => (
              <button key={'r' + s} onClick={() => pick(s)} className="flex items-center gap-1 px-2 rounded-lg" dir="ltr"
                style={{ height: 30, background: T.chipBg, color: T.textStrong }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = T.chipBg)}>
                <Clock size={11} className="opacity-45 shrink-0" /> <SymbolLogo symbol={s} size={16} /> {s}
              </button>
            ))}
            {cleanWatch.filter((s) => !recent.includes(s)).slice(0, 6).map((s) => (
              <button key={'w' + s} onClick={() => pick(s)} className="flex items-center gap-1 px-2 rounded-lg" dir="ltr"
                style={{ height: 30, background: T.chipBg, color: T.textStrong }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = T.chipBg)}>
                <Star size={11} className="text-amber-400" /> {s}
              </button>
            ))}
          </div>
        )}

        {/* نتایج — اسکرولِ مجازی */}
        {results.length > 0 ? (
          <VirtualList
            items={results} rowH={ROW} height={Math.min(coarse ? 460 : 440, results.length * ROW + 4)}
            scrollToIndex={active}
            renderRow={(m, i) => {
              const isActive = i === active;
              const isCur = m.symbol === current;
              const flag = flagCodeOf(m);
              return (
                <button onClick={() => pick(m.symbol)} onMouseEnter={() => setActive(i)}
                  role="option" aria-selected={isActive}
                  className="flex items-center gap-3 w-full h-full px-4 text-right transition-colors duration-[120ms]"
                  style={{ background: isActive ? T.chipBgHover : 'transparent', boxShadow: isCur ? `inset 0 0 0 1px ${T.accent}` : 'none', color: T.textStrong }}>
                  <SymbolLogo symbol={m.symbol} size={coarse ? 30 : 26} />
                  {/* ردیفِ تک‌خطیِ TradingView: نمادِ درشتِ ltr + توضیحِ کم‌رنگِ کنارِ آن (هم‌خط، truncate) */}
                  <span className="text-[14px] font-bold leading-tight shrink-0" dir="ltr">{mark(m.symbol, highlightPositions(m.symbol, qSym), T)}</span>
                  <span className="flex-1 min-w-0 text-[12.5px] opacity-55 leading-tight truncate">{mark(m.desc, highlightPositions(m.desc, qDesc), T)}</span>
                  {watchSet.has(m.symbol) && <Star size={13} className="text-amber-400 shrink-0" />}
                  {/* trailing meta سبکِ TradingView: برچسبِ نوع = متنِ کوچکِ خاکستریِ ساده (نه پیلِ رنگی) + پرچم — دقیقاً مثلِ تگِ نوعِ ردیف‌های جستجوی TV (دکلوتر). */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] whitespace-nowrap opacity-50" style={{ color: T.text }}>
                      {CAT_FA[m.cat] || m.cat}
                    </span>
                    {flag && <CountryFlag code={flag} size={coarse ? 20 : 18} />}
                  </div>
                </button>
              );
            }}
          />
        ) : (
          <div className="py-10 text-center text-sm opacity-50" style={{ color: T.text }}>
            {/* کوئریِ ناتهی ⇒ «پیدا نشد»؛ کوئریِ خالی (جهانِ نماد هنوز بارگذاری نشده) ⇒ راهنمای تایپ به‌جای پیغامِ گمراه‌کنندهٔ «مطابقِ «» پیدا نشد». */}
            {qDesc ? `نمادی مطابقِ «${q}» پیدا نشد` : 'برای جستجو، نامِ نماد را تایپ کنید — مثلِ EURUSD، طلا یا BTC'}
          </div>
        )}

        {/* فوترِ راهنمای کیبورد سبکِ TradingView (ناوبریِ کامل: پیمایش/انتخاب/بستن) + شمارشِ نتایج */}
        <div className="flex items-center justify-between px-4 shrink-0 text-[11px] select-none"
          style={{ height: 34, borderTop: `1px solid ${T.border}`, color: T.text }}>
          <div className="flex items-center gap-3 opacity-70">
            <span className="flex items-center gap-1"><Kbd T={T}>↑</Kbd><Kbd T={T}>↓</Kbd> پیمایش</span>
            <span className="flex items-center gap-1"><Kbd T={T}>↵</Kbd> انتخاب</span>
            <span className="flex items-center gap-1"><Kbd T={T}>Esc</Kbd> بستن</span>
          </div>
          <span className="tabular-nums opacity-60">{results.length} نماد</span>
        </div>
      </div>
    </div>
  );
}

// کلیدِ راهنمای فوتر (هم‌سبکِ Esc نوارِ بالا).
function Kbd({ children, T }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border tabular-nums"
      style={{ minWidth: 18, height: 18, padding: '0 4px', fontSize: 11, lineHeight: 1, borderColor: T.border, color: T.text, background: T.chipBg }}>
      {children}
    </kbd>
  );
}
