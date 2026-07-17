// تقویمِ اقتصادی — رویدادهای واقعیِ هفتهٔ جاری از /academy/bn/calendar
// (فیدِ بین‌المللیِ faireconomy/ForexFactory، عنوان‌ها فارسی‌شده توسطِ Claudeِ داخلِ سرور).
// بدنهٔ تبِ پنلِ راست. props: { symbol, TH }. بدونِ عکس.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from '../tvIcons';
import { api } from '../../api/client';
import { CountryFlag } from '../SymbolSearchModal';

// نرمال‌سازیِ فارسی برای سرچِ رویداد (یِ/کِ عربی → فارسی، حذفِ نیم‌فاصله) — هم‌سبکِ سرچِ NewsTab/Indicators.
const normFa = (s) => (s || '').toString().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, '').trim();

// نگاشتِ ارز → کدِ کشورِ پرچم (مثلِ ستونِ پرچم‌دارِ تقویمِ اقتصادیِ TV). نامعلوم ⇒ fallbackِ CountryFlag کدِ ارز را در جعبه نشان می‌دهد.
const CCY_COUNTRY = { USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', CHF: 'CH', CAD: 'CA', AUD: 'AU', NZD: 'NZ', CNY: 'CN' };

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

export function symbolCurrencies(symbol = '') {
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

// نشانگرِ اهمیت به‌سبکِ TV: سه میلهٔ عمودیِ صعودی، پُر تا سطحِ اهمیت (impact meter)
const IMP_BAR_H = [4, 7, 10];
function ImpactBars({ imp }) {
  const m = IMPACT[imp] || IMPACT.low;
  return (
    <span className="inline-flex items-end gap-[1.5px] shrink-0" style={{ height: 10 }} title={`اهمیتِ ${m.label}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-[3px] rounded-[1px]" style={{ height: IMP_BAR_H[i], background: i < m.dots ? m.color : `${m.color}33` }} />
      ))}
    </span>
  );
}

// سلولِ «واقعی» — روی تغییرِ مقدار سبز/قرمز فلَش می‌زند (زنده‌بودنِ TV) + پیکانِ جهت نسبت به پیش‌بینی
function ActualCell({ value, color, arrow, TH }) {
  const ref = useRef(null);
  const prev = useRef(value);
  useEffect(() => {
    const p = toNum(prev.current), n = toNum(value);
    if (ref.current && p != null && n != null && n !== p) {
      const cls = n > p ? 'flash-up' : 'flash-down';
      ref.current.classList.remove('flash-up', 'flash-down');
      void ref.current.offsetWidth; // ری‌استارتِ انیمیشن
      ref.current.classList.add(cls);
    }
    prev.current = value;
  }, [value]);
  const show = value != null && value !== '';
  return (
    <span ref={ref} className="w-11 text-left text-[10px] shrink-0 font-semibold tnum rounded-sm inline-flex items-center justify-end gap-0.5" dir="ltr"
      style={{ color: show ? color : TH.text, opacity: show ? 1 : 0.35 }}>
      {show && arrow ? <span className="text-[7px] leading-none">{arrow === 'up' ? '▲' : '▼'}</span> : null}
      {show ? value : '—'}
    </span>
  );
}

export default function Calendar({ symbol, TH }) {
  const [items, setItems] = useState(null);
  const [onlyRelevant, setOnlyRelevant] = useState(false);
  // فیلترِ اهمیت (پایین/متوسط/بالا) — همه روشن = بدونِ فیلتر
  const [imp, setImp] = useState({ high: true, medium: true, low: true });
  const [country, setCountry] = useState('all');
  const [q, setQ] = useState(''); // سرچِ نامِ رویداد (مثلِ سرچِ تقویمِ TV)
  const [tzId, setTzId] = useState('local');
  const [menu, setMenu] = useState(null); // 'country' | 'tz' | null
  const [tick, setTick] = useState(0); // ضربانِ ۶۰ثانیه‌ای برای بازمحاسبهٔ «رویدادِ بعدی»
  const rootRef = useRef(null);
  const scrollRef = useRef(null);       // ناحیهٔ اسکرولِ رویدادها
  const dayRefs = useRef({});           // نگاشتِ کلیدِ روز → المانِ سرگروه (برای پرشِ نوارِ هفته)

  // «الان» را هر دقیقه تازه کن تا نشانگرِ رویدادِ بعدی زنده بماند
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60000); return () => clearInterval(id); }, []);

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
  // ستونِ «واقعی» فقط وقتی نشان داده می‌شود که حداقل یک رویداد مقدارِ واقعی داشته باشد؛
  // خوراکِ فعلی فقط پیش‌بینی/قبلی دارد، پس این ستونِ همیشه-خالی حذف می‌شود تا نامِ رویداد جا بگیرد.
  const hasActual = useMemo(() => (items || []).some((e) => { const a = e.actual ?? e.act; return a != null && a !== ''; }), [items]);

  const groups = useMemo(() => {
    let all = (items || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    // فیلترِ اهمیت (اگر همه روشن باشند، رد نمی‌شود؛ اهمیتِ ناشناخته همیشه می‌ماند)
    const allImp = imp.high && imp.medium && imp.low;
    if (!allImp) all = all.filter((e) => imp[e.impact] ?? true);
    if (country !== 'all') all = all.filter((e) => (e.country || '').toUpperCase() === country);
    if (onlyRelevant && curs.length) all = all.filter((e) => curs.includes((e.country || '').toUpperCase()));
    const ql = normFa(q);
    if (ql) all = all.filter((e) => normFa(e.title).includes(ql) || normFa(e.country).includes(ql));
    const g = {};
    all.forEach((e) => { const k = dayKey(e.date, tz); (g[k] = g[k] || []).push(e); });
    return Object.entries(g);
  }, [items, imp, country, onlyRelevant, curs, tz, q]);

  // نخستین رویدادِ آینده (>= الان) — نشانگرِ «بعدی» با ضربانِ آبی، مثل خطِ زمانِ فعلیِ TV
  const nextIso = useMemo(() => {
    const now = Date.now();
    const ev = (items || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date)).find((e) => new Date(e.date).getTime() >= now);
    return ev ? ev.date : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tick]);

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
  // کلیدِ روزِ «امروز» برای علامتِ TV روی سرگروه (وابسته به منطقهٔ زمانی و ضربانِ دقیقه‌ای)
  const todayKey = useMemo(() => dayKey(new Date().toISOString(), tz), [tz, tick]);

  return (
    <div ref={rootRef} className="flex flex-col text-xs" style={{ color: TH.text, fontVariantNumeric: 'tabular-nums' }}>
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b shrink-0 flex-wrap" style={{ borderColor: TH.border }}>
        <span className="opacity-50 text-[11px]">تقویمِ اقتصادی</span>
        {/* دکمهٔ «امروز» (مثلِ TV) — پرشِ سریع به رویدادهای امروز؛ فقط وقتی امروز در هفتهٔ جاری رویداد دارد */}
        {groups.some(([day]) => day === todayKey) && (
          <button onClick={() => { const el = dayRefs.current[todayKey]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            title="پرش به امروز" className="text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors shrink-0"
            style={{ background: TH.chipBg, border: `1px solid ${TH.border}`, color: TH.textStrong }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
            امروز
          </button>
        )}
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

      {/* سرچِ رویداد (مثلِ سرچِ تقویمِ اقتصادیِ TV) — فیلترِ کلاینتی روی نام/کشورِ رویداد؛ خالی = بی‌اثر */}
      <div className="px-3 py-1.5 border-b shrink-0" style={{ borderColor: TH.border }}>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: TH.chipBg, border: `1px solid ${TH.border}` }}>
          <Search size={12} className="opacity-45 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی رویداد…" dir="rtl"
            className="flex-1 min-w-0 bg-transparent outline-none text-[11px]" style={{ color: TH.textStrong }} />
          {q && (
            <button onClick={() => setQ('')} title="پاک‌کردن" className="shrink-0 opacity-50 hover:opacity-100" style={{ color: TH.text }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* نوارِ روزهای هفته (خلاصهٔ هر روز + شمارِ رویداد) — هم‌ترازِ نوارِ هفتهٔ TV؛ کلیک ⇒ پرش به آن روز */}
      {items !== null && groups.length > 0 && (
        <div className="flex items-stretch gap-1 px-2 py-1.5 border-b shrink-0 overflow-x-auto bn-thin-scroll" style={{ borderColor: TH.border }}>
          {groups.map(([day, evs]) => {
            const isToday = day === todayKey;
            const parts = day.split(' ');
            const wd = parts[0];
            const dm = parts.slice(1).join(' ');
            return (
              <button key={day} onClick={() => { const el = dayRefs.current[day]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                title={`${evs.length} رویداد`}
                className="flex flex-col items-center justify-center px-2 py-1 rounded-md shrink-0 min-w-[52px] transition-colors"
                style={{ background: isToday ? `${TH.accent}1f` : TH.chipBg, border: `1px solid ${isToday ? TH.accent + '66' : TH.border}` }}
                onMouseEnter={(e) => { if (!isToday) e.currentTarget.style.background = TH.chipBgHover; }}
                onMouseLeave={(e) => { if (!isToday) e.currentTarget.style.background = TH.chipBg; }}>
                <span className="text-[10px] font-semibold leading-tight" style={{ color: isToday ? TH.accent : TH.textStrong }}>{wd}</span>
                <span className="text-[9px] leading-tight opacity-60" dir="ltr">{dm}</span>
                <span className="text-[9px] leading-[13px] mt-0.5 px-1 rounded-full tnum" style={{ background: `${TH.accent}1f`, color: TH.accent }}>{evs.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* سرستونِ actual/forecast/previous — همیشه انتهای ردیف (RTL) */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b shrink-0 text-[9px] opacity-45" style={{ borderColor: TH.border }}>
        <span className="flex-1 min-w-0">رویداد</span>
        {hasActual && <span className="w-11 text-left shrink-0" dir="ltr">واقعی</span>}
        <span className="w-9 text-left shrink-0" dir="ltr">پیش‌بینی</span>
        <span className="w-9 text-left shrink-0" dir="ltr">قبلی</span>
      </div>

      <div ref={scrollRef} className="overflow-auto">
        {items === null && <div className="px-3 py-8 text-center opacity-40 text-[11px]">در حالِ دریافتِ تقویم…</div>}
        {items !== null && groups.length === 0 && (
          <div className="px-3 py-8 text-center opacity-40 text-[11px]">رویدادی برای نمایش نیست.</div>
        )}
        {groups.map(([day, evs]) => (
          <div key={day} ref={(el) => { if (el) dayRefs.current[day] = el; }}>
            <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold border-b" style={{ background: TH.panel, color: TH.textStrong, borderColor: TH.border }}>
              <span>{day}</span>
              {day === todayKey && <span className="px-1 rounded-sm text-[11px] leading-[14px] font-medium" style={{ background: `${TH.accent}1f`, color: TH.accent }}>امروز</span>}
            </div>
            {evs.map((e, i) => {
              const actual = e.actual ?? e.act;
              const forecast = e.forecast ?? e.fc;
              const previous = e.previous ?? e.prev;
              const na = toNum(actual), nf = toNum(forecast);
              const diff = na != null && nf != null && na !== nf;
              const actUp = diff && na > nf;
              const actColor = diff ? (actUp ? TH.up : TH.down) : TH.textStrong;
              const isNext = e.date === nextIso;
              const rowBg = isNext ? `${TH.accent}14` : 'transparent';
              return (
                <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 border-b transition-colors" style={{ borderColor: TH.border, background: rowBg, boxShadow: isNext ? `inset 2px 0 0 ${TH.accent}` : 'none' }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = TH.chipBgHover)}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = rowBg)}>
                  <span className="text-[10px] w-9 shrink-0 inline-flex items-center gap-1 tnum" dir="ltr" style={{ color: isNext ? TH.accent : TH.text, opacity: isNext ? 1 : 0.6 }}>
                    {isNext && <span className="w-1.5 h-1.5 rounded-full shrink-0" title="رویدادِ بعدی" style={{ background: TH.accent, animation: 'pcGlow 2.4s ease-in-out infinite' }} />}
                    {fmtTime(e.date, tz)}
                  </span>
                  {/* پرچمِ کشورِ ارز + کد — مثلِ ستونِ پرچم‌دارِ ردیف‌های تقویمِ TV */}
                  <span className="shrink-0 inline-flex items-center gap-1" dir="ltr">
                    <CountryFlag code={CCY_COUNTRY[e.country] || e.country} size={13} />
                    <span className="text-[10px] font-semibold w-7" style={{ color: TH.textStrong }}>{e.country}</span>
                  </span>
                  <ImpactBars imp={e.impact} />
                  <span className="text-[11px] leading-4 flex-1 min-w-0 truncate" title={e.title}>{e.title}</span>
                  {hasActual && <ActualCell value={actual} color={actColor} arrow={diff ? (actUp ? 'up' : 'down') : null} TH={TH} />}
                  <span className="w-9 text-left text-[10px] shrink-0 opacity-60 tnum" dir="ltr">{forecast != null && forecast !== '' ? forecast : '—'}</span>
                  <span className="w-9 text-left text-[10px] shrink-0 opacity-40 tnum" dir="ltr">{previous != null && previous !== '' ? previous : '—'}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
