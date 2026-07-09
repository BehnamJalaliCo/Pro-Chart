import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Star } from 'lucide-react';
import SymbolLogo from './SymbolLogo';
import VirtualList from './VirtualList';
import { searchSymbols, highlightPositions } from './fuzzy';
import { CATEGORIES, CAT_FA } from './symbolMeta';

// #۷ رنگِ بَجِ نوعِ دارایی، هم‌خانوادهٔ پالتِ TradingView (هر کلاس یک رنگِ امضا)
const TYPE_COLOR = {
  forex: '#2962FF', crypto: '#F7931A', metal: '#E0A526',
  index: '#9C56E6', energy: '#26A69A', other: '#787B86',
};

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
export default function SymbolSearchModal({ open, onClose, metaList = [], watch = [], current, onPick, TH, coarse = false }) {
  const T = TH || { panel: '#131722', border: '#2a2e39', text: '#b2b5be', textStrong: '#d1d4dc', accent: '#2962FF', chipBg: 'rgba(255,255,255,.06)', chipBgHover: 'rgba(255,255,255,.10)' };
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');       // debounced
  const [cat, setCat] = useState('all');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  // debounce ۸۰ms (معادلِ symbol_search_request_delay در TradingView)
  useEffect(() => { const t = setTimeout(() => setDq(q), 80); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (open) { setQ(''); setDq(''); setCat('all'); setActive(0); setTimeout(() => inputRef.current && inputRef.current.focus(), 30); } }, [open]);

  const results = useMemo(() => searchSymbols(metaList, dq, cat), [metaList, dq, cat]);
  // کوئریِ پاک‌شده برای های‌لایتِ نماد (نمادها الفبا-عددی‌اند؛ اسلش/فاصله حذف می‌شود).
  const qSym = useMemo(() => dq.replace(/[^A-Za-z0-9]/g, ''), [dq]);
  const qDesc = useMemo(() => dq.trim(), [dq]);
  useEffect(() => { setActive(0); }, [dq, cat]);

  const recent = useMemo(() => loadRecent().filter((s) => metaList.some((m) => m.symbol === s)), [metaList, open]);
  const watchSet = useMemo(() => new Set(watch), [watch]);

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

        {/* نوارِ جستجو */}
        <div className="flex items-center gap-2 px-4 shrink-0" style={{ height: 56, borderBottom: `1px solid ${T.border}` }}>
          <Search size={18} className="opacity-60" style={{ color: T.text }} />
          <input ref={inputRef} dir="ltr" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="جستجوی نماد… (EURUSD، طلا، BTC)"
            className="flex-1 bg-transparent outline-none text-base tabular-nums placeholder:opacity-50"
            style={{ color: T.textStrong }} />
          <kbd className="text-[11px] opacity-50 px-1.5 py-0.5 rounded border" style={{ borderColor: T.border, color: T.text }}>Esc</kbd>
          <button onClick={onClose} aria-label="بستن" className="opacity-60 hover:opacity-100" style={{ color: T.text }}><X size={18} /></button>
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
        {!dq && (recent.length > 0 || watch.length > 0) && (
          <div className="px-3 pt-2 pb-1.5 flex flex-wrap gap-1.5 text-[12px] shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
            {recent.map((s) => (
              <button key={'r' + s} onClick={() => pick(s)} className="flex items-center gap-1 px-2 rounded-lg" dir="ltr"
                style={{ height: 30, background: T.chipBg, color: T.textStrong }}
                onMouseEnter={(e) => (e.currentTarget.style.background = T.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = T.chipBg)}>
                <SymbolLogo symbol={s} size={16} /> {s}
              </button>
            ))}
            {watch.filter((s) => !recent.includes(s)).slice(0, 6).map((s) => (
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
              return (
                <button onClick={() => pick(m.symbol)} onMouseEnter={() => setActive(i)}
                  role="option" aria-selected={isActive}
                  className="flex items-center gap-3 w-full h-full px-4 text-right transition-colors duration-[120ms]"
                  style={{ background: isActive ? T.chipBgHover : 'transparent', boxShadow: isCur ? `inset 0 0 0 1px ${T.accent}` : 'none', color: T.textStrong }}>
                  <SymbolLogo symbol={m.symbol} size={coarse ? 30 : 26} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-bold leading-tight" dir="ltr">{mark(m.symbol, highlightPositions(m.symbol, qSym), T)}</div>
                    <div className="text-[12px] opacity-60 leading-tight truncate">{mark(m.desc, highlightPositions(m.desc, qDesc), T)}</div>
                  </div>
                  {watchSet.has(m.symbol) && <Star size={13} className="text-amber-400 shrink-0" />}
                  {/* بَجِ نوعِ دارایی، سبکِ TradingView: نقطهٔ رنگی + برچسبِ کلاس */}
                  <span className="flex items-center gap-1.5 shrink-0 px-2 rounded-md text-[10.5px] font-semibold"
                    style={{ height: 22, color: TYPE_COLOR[m.cat] || TYPE_COLOR.other, background: (TYPE_COLOR[m.cat] || TYPE_COLOR.other) + '1f' }}>
                    <span style={{ width: 6, height: 6, borderRadius: 99, background: TYPE_COLOR[m.cat] || TYPE_COLOR.other }} />
                    {CAT_FA[m.cat] || m.cat}
                  </span>
                </button>
              );
            }}
          />
        ) : (
          <div className="py-10 text-center text-sm opacity-50" style={{ color: T.text }}>نمادی مطابقِ «{q}» پیدا نشد</div>
        )}
      </div>
    </div>
  );
}
