// تقویمِ اقتصادی — رویدادهای واقعیِ هفتهٔ جاری از /academy/bn/calendar
// (فیدِ بین‌المللیِ faireconomy/ForexFactory، عنوان‌ها فارسی‌شده توسطِ Claudeِ داخلِ سرور).
// بدنهٔ تبِ پنلِ راست. props: { symbol, TH }. بدونِ عکس.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';

const IMPACT = {
  high: { label: 'بالا', dots: 3, color: '#ef4444' },
  medium: { label: 'متوسط', dots: 2, color: '#f59e0b' },
  low: { label: 'پایین', dots: 1, color: '#9aa0b5' },
};
const IMPACT_ORDER = ['high', 'medium', 'low'];

const PERSIAN_DAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

// منطقه‌های زمانیِ پرکاربردِ تریدرها (محلی = رفتارِ پیش‌فرضِ قبلی)
const TZONES = [
  { id: 'local', label: 'محلی', tz: undefined },
  { id: 'tehran', label: 'تهران', tz: 'Asia/Tehran' },
  { id: 'utc', label: 'UTC', tz: 'UTC' },
  { id: 'london', label: 'لندن', tz: 'Europe/London' },
  { id: 'newyork', label: 'نیویورک', tz: 'America/New_York' },
];

function symbolCurrencies(symbol = '') {
  const s = symbol.toUpperCase();
  const found = [];
  ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY'].forEach((c) => { if (s.includes(c)) found.push(c); });
  if (/XAU|GOLD|BTC|OIL|XTI|US30|US500|NAS|SPX/.test(s)) found.push('USD');
  return [...new Set(found)];
}

// مقایسهٔ عددیِ actual با forecast برای رنگِ سبز/قرمز (بالاتر=up، پایین‌تر=down)
const toNum = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : null; };

const fmtTime = (iso, tz) => { try { const d = new Date(iso); return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }); } catch { return ''; } };
const dayKey = (iso, tz) => { try { const d = new Date(iso); const wd = tz ? new Date(d.toLocaleString('en-US', { timeZone: tz })).getDay() : d.getDay(); return `${PERSIAN_DAYS[wd]} ${d.toLocaleDateString('fa-IR', { day: '2-digit', month: 'long', timeZone: tz })}`; } catch { return ''; } };

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
  // فیلترِ اهمیت (پایین/متوسط/بالا) — همه روشن = بدونِ فیلتر
  const [imp, setImp] = useState({ high: true, medium: true, low: true });
  const [country, setCountry] = useState('all');
  const [tzId, setTzId] = useState('local');
  const [menu, setMenu] = useState(null); // 'country' | 'tz' | null
  const rootRef = useRef(null);

  useEffect(() => {
    let on = true;
    const load = () => api.bnCalendar().then((r) => { if (on) setItems(r?.items || []); }).catch(() => { if (on && items === null) setItems([]); });
    load();
    const id = setInterval(load, 300000);
    return () => { on = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // بستنِ منوها با کلیکِ بیرون
  useEffect(() => {
    if (!menu) return;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setMenu(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);

  const tz = useMemo(() => (TZONES.find((z) => z.id === tzId) || TZONES[0]).tz, [tzId]);
  const curs = useMemo(() => symbolCurrencies(symbol), [symbol]);
  const countries = useMemo(() => [...new Set((items || []).map((e) => (e.country || '').toUpperCase()).filter(Boolean))].sort(), [items]);

  const groups = useMemo(() => {
    let all = (items || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    // فیلترِ اهمیت (اگر همه روشن باشند، رد نمی‌شود؛ اهمیتِ ناشناخته همیشه می‌ماند)
    const allImp = imp.high && imp.medium && imp.low;
    if (!allImp) all = all.filter((e) => imp[e.impact] ?? true);
    if (country !== 'all') all = all.filter((e) => (e.country || '').toUpperCase() === country);
    if (onlyRelevant && curs.length) all = all.filter((e) => curs.includes((e.country || '').toUpperCase()));
    const g = {};
    all.forEach((e) => { const k = dayKey(e.date, tz); (g[k] = g[k] || []).push(e); });
    return Object.entries(g);
  }, [items, imp, country, onlyRelevant, curs, tz]);

  const Toggle = ({ on, set, children }) => (
    <button onClick={() => set((v) => !v)} className="px-2 h-[26px] rounded-md text-[10px] transition-colors"
      style={{ background: on ? TH.accent : TH.chipBg, color: on ? '#fff' : TH.text }}
      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = TH.chipBg; }}>{children}</button>
  );

  // چیپِ فیلترِ اهمیت با نقطهٔ رنگی
  const ImpChip = ({ id }) => {
    const on = imp[id]; const m = IMPACT[id];
    return (
      <button onClick={() => setImp((s) => ({ ...s, [id]: !s[id] }))} title={`اهمیتِ ${m.label}`}
        className="inline-flex items-center gap-1 px-1.5 h-[26px] rounded-md text-[10px] transition-colors"
        style={{ background: on ? TH.chipBgHover : 'transparent', color: on ? TH.textStrong : TH.text, opacity: on ? 1 : 0.5, border: `1px solid ${on ? m.color + '66' : TH.border}` }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.color }} />{m.label}
      </button>
    );
  };

  // دراپ‌داونِ سبکِ همان فایل (کشور/منطقهٔ زمانی)
  const Dropdown = ({ id, label, value, options, onPick }) => (
    <div className="relative">
      <button onClick={() => setMenu((v) => (v === id ? null : id))} className="px-2 h-[26px] rounded-md text-[10px] transition-colors"
        style={{ background: menu === id ? TH.chipBgHover : TH.chipBg, color: TH.text }}
        onMouseEnter={(e) => { if (menu !== id) e.currentTarget.style.background = TH.chipBgHover; }}
        onMouseLeave={(e) => { if (menu !== id) e.currentTarget.style.background = TH.chipBg; }}>{label}{value ? `: ${value}` : ''} ▾</button>
      {menu === id && (
        <div className="absolute z-40 mt-1 rounded-md py-1 max-h-64 overflow-auto min-w-[92px]" style={{ background: TH.panel, border: `1px solid ${TH.border}`, insetInlineEnd: 0 }}>
          {options.map((o) => (
            <button key={o.id} onClick={() => { onPick(o.id); setMenu(null); }} className="block w-full text-right px-2.5 py-1 text-[11px] transition-colors"
              style={{ color: o.id === o.active ? TH.accent : TH.text, background: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <span dir={o.ltr ? 'ltr' : undefined} className="inline-block">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const tzLabel = (TZONES.find((z) => z.id === tzId) || TZONES[0]).label;

  return (
    <div ref={rootRef} className="flex flex-col text-xs" style={{ color: TH.text, fontVariantNumeric: 'tabular-nums' }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b shrink-0 flex-wrap" style={{ borderColor: TH.border }}>
        <span className="opacity-50 text-[10px]">تقویمِ اقتصادی</span>
        <div className="flex-1" />
        {IMPACT_ORDER.map((k) => <ImpChip key={k} id={k} />)}
        <Dropdown id="country" label="کشور" value={country === 'all' ? '' : country}
          options={[{ id: 'all', label: 'همه کشورها', active: country }, ...countries.map((c) => ({ id: c, label: c, ltr: true, active: country }))]}
          onPick={setCountry} />
        <Dropdown id="tz" label="ساعت" value={tzLabel}
          options={TZONES.map((z) => ({ id: z.id, label: z.label, active: tzId }))}
          onPick={setTzId} />
        <Toggle on={onlyRelevant} set={setOnlyRelevant}>مرتبط با <span dir="ltr">{symbol}</span></Toggle>
      </div>

      {/* سرستونِ actual/forecast/previous — همیشه انتهای ردیف (RTL) */}
      <div className="flex items-center gap-2 px-3 py-1 border-b shrink-0 text-[9px] opacity-45" style={{ borderColor: TH.border }}>
        <span className="flex-1">رویداد</span>
        <span className="w-11 text-left shrink-0" dir="ltr">واقعی</span>
        <span className="w-11 text-left shrink-0" dir="ltr">پیش‌بینی</span>
        <span className="w-11 text-left shrink-0" dir="ltr">قبلی</span>
      </div>

      <div className="overflow-auto">
        {items === null && <div className="px-3 py-8 text-center opacity-40 text-[11px]">در حالِ دریافتِ تقویم…</div>}
        {items !== null && groups.length === 0 && (
          <div className="px-3 py-8 text-center opacity-40 text-[11px]">رویدادی برای نمایش نیست.</div>
        )}
        {groups.map(([day, evs]) => (
          <div key={day}>
            <div className="sticky top-0 z-10 px-3 py-1 text-[10px] font-semibold border-b" style={{ background: TH.panel, color: TH.textStrong, borderColor: TH.border }}>{day}</div>
            {evs.map((e, i) => {
              const actual = e.actual ?? e.act;
              const forecast = e.forecast ?? e.fc;
              const previous = e.previous ?? e.prev;
              const na = toNum(actual), nf = toNum(forecast);
              const actColor = na != null && nf != null && na !== nf ? (na > nf ? TH.up : TH.down) : TH.textStrong;
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b transition-colors" style={{ borderColor: TH.border }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = TH.chipBgHover)}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}>
                  <span className="text-[10px] opacity-60 w-10 shrink-0" dir="ltr">{fmtTime(e.date, tz)}</span>
                  <span className="text-[10px] font-semibold w-8 shrink-0" dir="ltr" style={{ color: TH.textStrong }}>{e.country}</span>
                  <Dots imp={e.impact} />
                  <span className="text-[11px] leading-4 flex-1 min-w-0 truncate">{e.title}</span>
                  <span className="w-11 text-left text-[10px] shrink-0 font-semibold" dir="ltr" style={{ color: actual != null && actual !== '' ? actColor : TH.text, opacity: actual != null && actual !== '' ? 1 : 0.35 }}>{actual != null && actual !== '' ? actual : '—'}</span>
                  <span className="w-11 text-left text-[10px] shrink-0 opacity-60" dir="ltr">{forecast != null && forecast !== '' ? forecast : '—'}</span>
                  <span className="w-11 text-left text-[10px] shrink-0 opacity-40" dir="ltr">{previous != null && previous !== '' ? previous : '—'}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
