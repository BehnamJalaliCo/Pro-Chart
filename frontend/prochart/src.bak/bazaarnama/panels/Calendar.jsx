// تقویمِ اقتصادی — رویدادهای واقعیِ هفتهٔ جاری از /academy/bn/calendar
// (فیدِ بین‌المللیِ faireconomy/ForexFactory، عنوان‌ها فارسی‌شده توسطِ Claudeِ داخلِ سرور).
// بدنهٔ تبِ پنلِ راست. props: { symbol, TH }. بدونِ عکس.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

const IMPACT = {
  high: { label: 'بالا', dots: 3, color: '#ef4444' },
  medium: { label: 'متوسط', dots: 2, color: '#f59e0b' },
  low: { label: 'پایین', dots: 1, color: '#9aa0b5' },
};

const PERSIAN_DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

function symbolCurrencies(symbol = '') {
  const s = symbol.toUpperCase();
  const found = [];
  ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY'].forEach((c) => { if (s.includes(c)) found.push(c); });
  if (/XAU|GOLD|BTC|OIL|XTI|US30|US500|NAS|SPX/.test(s)) found.push('USD');
  return [...new Set(found)];
}

const fmtTime = (iso) => { try { const d = new Date(iso); return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return ''; } };
const dayKey = (iso) => { try { const d = new Date(iso); return `${PERSIAN_DAYS[d.getDay()]} ${d.toLocaleDateString('fa-IR', { day: '2-digit', month: 'long' })}`; } catch { return ''; } };

function Dots({ imp }) {
  const m = IMPACT[imp] || IMPACT.low;
  return (
    <span className="inline-flex gap-0.5 items-center shrink-0">
      {[0, 1, 2].map((i) => (<span key={i} className="w-1 h-1 rounded-full" style={{ background: i < m.dots ? m.color : 'transparent', border: i < m.dots ? 'none' : `1px solid ${m.color}55` }} />))}
    </span>
  );
}

export default function Calendar({ symbol, TH }) {
  const [items, setItems] = useState(null);
  const [onlyRelevant, setOnlyRelevant] = useState(false);
  const [onlyHigh, setOnlyHigh] = useState(false);

  useEffect(() => {
    let on = true;
    const load = () => api.bnCalendar().then((r) => { if (on) setItems(r?.items || []); }).catch(() => { if (on && items === null) setItems([]); });
    load();
    const id = setInterval(load, 300000);
    return () => { on = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const curs = useMemo(() => symbolCurrencies(symbol), [symbol]);
  const groups = useMemo(() => {
    let all = (items || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    if (onlyHigh) all = all.filter((e) => e.impact === 'high');
    if (onlyRelevant && curs.length) all = all.filter((e) => curs.includes((e.country || '').toUpperCase()));
    const g = {};
    all.forEach((e) => { const k = dayKey(e.date); (g[k] = g[k] || []).push(e); });
    return Object.entries(g);
  }, [items, onlyHigh, onlyRelevant, curs]);

  const Toggle = ({ on, set, children }) => (
    <button onClick={() => set((v) => !v)} className="px-2 h-[26px] rounded-md text-[10px] transition-colors"
      style={{ background: on ? TH.accent : TH.chipBg, color: on ? '#fff' : TH.text }}
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = TH.chipBg; }}>{children}</button>
  );

  return (
    <div className="flex flex-col text-xs" style={{ color: TH.text, fontVariantNumeric: 'tabular-nums' }}>
      <div className="flex items-center gap-1.5 px-3 h-8 border-b shrink-0" style={{ borderColor: TH.border }}>
        <span className="opacity-50 text-[10px] flex-1">تقویمِ اقتصادی</span>
        <Toggle on={onlyHigh} set={setOnlyHigh}>اهمیتِ بالا</Toggle>
        <Toggle on={onlyRelevant} set={setOnlyRelevant}>مرتبط با <span dir="ltr">{symbol}</span></Toggle>
      </div>

      <div className="overflow-auto">
        {items === null && <div className="px-3 py-8 text-center opacity-40 text-[11px]">در حالِ دریافتِ تقویم…</div>}
        {items !== null && groups.length === 0 && (
          <div className="px-3 py-8 text-center opacity-40 text-[11px]">رویدادی برای نمایش نیست.</div>
        )}
        {groups.map(([day, evs]) => (
          <div key={day}>
            <div className="sticky top-0 z-10 px-3 py-1 text-[10px] font-semibold border-b" style={{ background: TH.panel, color: TH.textStrong, borderColor: TH.border }}>{day}</div>
            {evs.map((e, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b transition-colors" style={{ borderColor: TH.border }}
                onMouseEnter={(ev) => (ev.currentTarget.style.background = TH.chipBgHover)}
                onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}>
                <span className="text-[10px] opacity-60 w-10 shrink-0" dir="ltr">{fmtTime(e.date)}</span>
                <span className="text-[10px] font-semibold w-8 shrink-0" dir="ltr" style={{ color: TH.textStrong }}>{e.country}</span>
                <Dots imp={e.impact} />
                <span className="text-[11px] leading-4 flex-1 min-w-0">{e.title}</span>
                {(e.forecast || e.previous) && (
                  <span className="text-[9px] opacity-60 shrink-0 text-left" dir="ltr">
                    {e.forecast && <span>پ:{e.forecast} </span>}{e.previous && <span>ق:{e.previous}</span>}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
