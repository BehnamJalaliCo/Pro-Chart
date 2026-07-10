// اخبارِ بازار — فارسی، بدونِ عکس. منبع: /academy/bn/news (RSSِ بین‌المللی،
// خلاصه/ترجمهٔ فارسی توسطِ Claudeِ داخلِ سرور). بدنهٔ تبِ پنلِ راست. props: { symbol, TH }
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';

// کلیدِ پایدارِ خبر (مستقل از موقعیت در لیست) — برای تشخیصِ خبرِ تازه و کلیدِ React
function newsKey(a, i) {
  return (a && (a.id || a.url)) || `${a?.ts || ''}|${a?.title || ''}` || `i${i}`;
}

// زمانِ نسبیِ فارسی از unix-seconds
function relTime(ts) {
  if (!ts) return '';
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return 'هم‌اکنون';
  const m = Math.floor(s / 60); if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ساعت پیش`;
  const d = Math.floor(h / 24); return `${d} روز پیش`;
}

function symbolKeywords(symbol = '') {
  const s = symbol.toUpperCase();
  const map = {
    EUR: ['eur', 'یورو'], USD: ['usd', 'دلار', 'فدرال', 'fed'], GBP: ['gbp', 'پوند'],
    JPY: ['jpy', 'ین'], XAU: ['xau', 'gold', 'طلا'], CAD: ['cad', 'کانادا'],
    AUD: ['aud', 'استرالیا'], CHF: ['chf', 'فرانک'], NZD: ['nzd', 'نیوزیلند'],
    OIL: ['oil', 'نفت'], XTI: ['oil', 'نفت'], US30: ['داو', 'dow'], US500: ['اس‌اند‌پی', 's&p'],
    NAS: ['نزدک', 'nasdaq'], DE40: ['دکس', 'dax'],
  };
  const out = new Set([s.toLowerCase()]);
  Object.keys(map).forEach((k) => { if (s.includes(k)) map[k].forEach((w) => out.add(w)); });
  return [...out];
}

// دسته‌بندیِ سبک بر پایهٔ کلیدواژه‌ها (دادهٔ سرور دست‌نخورده می‌ماند؛ اگر a.category بود همان اولویت دارد)
const CATS = [
  ['all', 'همه'],
  ['forex', 'فارکس'],
  ['metals', 'فلزات'],
  ['indices', 'شاخص‌ها'],
  ['crypto', 'کریپتو'],
  ['macro', 'کلان/بانک‌ها'],
];
const CAT_LABEL = Object.fromEntries(CATS.map(([k, v]) => [k, v]));
const CAT_KW = {
  forex: ['eur', 'usd', 'gbp', 'jpy', 'cad', 'aud', 'chf', 'nzd', 'forex', 'یورو', 'دلار', 'پوند', 'ین', 'فرانک', 'ارز', 'جفت‌ارز'],
  metals: ['xau', 'gold', 'طلا', 'silver', 'xag', 'نقره', 'فلز', 'پلاتین'],
  indices: ['dow', 'nasdaq', 's&p', 'dax', 'index', 'us30', 'us500', 'داو', 'نزدک', 'اس‌اند‌پی', 'دکس', 'شاخص', 'بورس'],
  crypto: ['btc', 'bitcoin', 'eth', 'ethereum', 'crypto', 'بیت', 'اتریوم', 'کریپتو', 'رمزارز', 'ارزِ دیجیتال'],
  macro: ['fed', 'ecb', 'cpi', 'gdp', 'inflation', 'interest rate', 'central bank', 'فدرال', 'تورم', 'نرخِ بهره', 'بانکِ مرکزی', 'اشتغال', 'بیکاری', 'بازارِ کار', 'رکود'],
};
function newsCats(a) {
  const own = a && (a.category || a.cat);
  const hay = `${a?.title || ''} ${a?.summary || ''} ${a?.source || ''}`.toLowerCase();
  const out = new Set();
  if (own) out.add(String(own).toLowerCase());
  Object.keys(CAT_KW).forEach((k) => { if (CAT_KW[k].some((w) => hay.includes(w))) out.add(k); });
  return out;
}

// برچسبِ نمادِ مرتبط از متنِ خبر (نمایشِ کوتاهِ ltr روی کارت)
const TICKER_KW = {
  XAU: ['طلا', 'gold', 'xau'], USD: ['دلار', 'usd', 'فدرال', 'fed'], EUR: ['یورو', 'eur'],
  GBP: ['پوند', 'gbp'], JPY: ['ین', 'jpy'], OIL: ['نفت', 'oil'], BTC: ['بیت‌کوین', 'بیت', 'bitcoin', 'btc'],
  ETH: ['اتریوم', 'ethereum', 'eth'], NAS: ['نزدک', 'nasdaq'], US30: ['داو', 'dow'], US500: ['اس‌اند‌پی', 's&p'],
};
function newsTickers(a) {
  const hay = `${a?.title || ''} ${a?.summary || ''}`.toLowerCase();
  const out = [];
  Object.keys(TICKER_KW).forEach((t) => { if (out.length < 3 && TICKER_KW[t].some((w) => hay.includes(w))) out.push(t); });
  return out;
}

export default function NewsTab({ symbol, TH }) {
  const [items, setItems] = useState(null); // null=loading
  const [onlyRelevant, setOnlyRelevant] = useState(false);
  const [cat, setCat] = useState('all');
  const [, setTick] = useState(0);            // فقط برای تازه‌کردنِ زمانِ نسبی
  const seenRef = useRef(null);               // مجموعهٔ کلیدهای دیده‌شده (null = قبل از اولین بار)
  const [freshKeys, setFreshKeys] = useState(() => new Set()); // اخبارِ تازه‌رسیده (فلَش)
  const freshTimer = useRef(null);

  useEffect(() => {
    let on = true;
    const load = () => api.bnNews().then((r) => { if (on) setItems(r?.items || []); }).catch(() => { if (on && items === null) setItems([]); });
    load();
    const id = setInterval(load, 60000);
    return () => { on = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تیکِ سبک هر ۳۰ث تا «X دقیقه پیش» بدونِ وابستگی به فچ زنده بماند
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 1e6), 30000);
    return () => clearInterval(id);
  }, []);

  // تشخیصِ خبرِ تازه‌رسیده → فلَشِ کوتاه + برچسبِ «جدید» که خودش پاک می‌شود
  useEffect(() => {
    if (items === null) return;
    const keys = items.map((a, i) => newsKey(a, i));
    const prev = seenRef.current;
    if (prev === null) { seenRef.current = new Set(keys); return; } // اولین بار: بدونِ فلَش
    const fresh = new Set();
    keys.forEach((k) => { if (!prev.has(k)) fresh.add(k); });
    keys.forEach((k) => prev.add(k));
    if (fresh.size) {
      setFreshKeys(fresh);
      if (freshTimer.current) clearTimeout(freshTimer.current);
      freshTimer.current = setTimeout(() => setFreshKeys(new Set()), 6000);
    }
  }, [items]);

  useEffect(() => () => { if (freshTimer.current) clearTimeout(freshTimer.current); }, []);

  const kw = useMemo(() => symbolKeywords(symbol), [symbol]);

  // شمارشِ دسته‌ها روی مجموعهٔ فیلترشده با نماد (تا چیپ‌ها با حالتِ نماد هم‌خوان باشند)
  const bySymbol = useMemo(() => {
    const all = items || [];
    if (!onlyRelevant) return all;
    return all.filter((a) => {
      const hay = `${a.title || ''} ${a.summary || ''}`.toLowerCase();
      return kw.some((w) => hay.includes(w));
    });
  }, [items, onlyRelevant, kw]);

  const catCounts = useMemo(() => {
    const c = { all: bySymbol.length };
    bySymbol.forEach((a) => { newsCats(a).forEach((k) => { if (CAT_LABEL[k]) c[k] = (c[k] || 0) + 1; }); });
    return c;
  }, [bySymbol]);

  const shown = useMemo(() => {
    if (cat === 'all') return bySymbol;
    return bySymbol.filter((a) => newsCats(a).has(cat));
  }, [bySymbol, cat]);

  const impactColor = (n) => (n >= 8 ? TH.down : n >= 5 ? '#f59e0b' : TH.text);

  const segBtn = (on) => ({
    background: on ? TH.accent : TH.chipBg, color: on ? '#fff' : TH.text,
  });

  return (
    <div className="flex flex-col text-xs min-h-0" style={{ color: TH.text }}>
      {/* سرتیتر + فیلترِ همهٔ نمادها / نمادِ فعلی */}
      <div className="flex items-center justify-between gap-2 px-3 h-8 border-b shrink-0" style={{ borderColor: TH.border }}>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="relative flex w-1.5 h-1.5 shrink-0">
            <span className="absolute inline-flex w-full h-full rounded-full animate-ping" style={{ background: TH.up, opacity: 0.55 }} />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ background: TH.up }} />
          </span>
          <span className="opacity-50 text-[10px]">مهم‌ترین اخبارِ بازار</span>
        </span>
        <div className="flex items-center rounded-md overflow-hidden shrink-0" style={{ border: `1px solid ${TH.border}` }} dir="rtl">
          <button onClick={() => setOnlyRelevant(false)}
            className="px-2 h-[22px] text-[10px] transition-colors" style={segBtn(!onlyRelevant)}
            onMouseEnter={(e) => { if (onlyRelevant) e.currentTarget.style.background = TH.chipBgHover; }}
            onMouseLeave={(e) => { if (onlyRelevant) e.currentTarget.style.background = TH.chipBg; }}>
            همهٔ نمادها
          </button>
          <button onClick={() => setOnlyRelevant(true)}
            className="px-2 h-[22px] text-[10px] transition-colors flex items-center gap-1" style={segBtn(onlyRelevant)}
            onMouseEnter={(e) => { if (!onlyRelevant) e.currentTarget.style.background = TH.chipBgHover; }}
            onMouseLeave={(e) => { if (!onlyRelevant) e.currentTarget.style.background = TH.chipBg; }}>
            <span dir="ltr" className="tnum">{symbol}</span>
          </button>
        </div>
      </div>

      {/* چیپ‌های دسته‌بندی */}
      <div className="flex items-center gap-1 px-2 h-8 border-b shrink-0 overflow-x-auto bn-thin-scroll" style={{ borderColor: TH.border }} dir="rtl">
        {CATS.map(([id, label]) => {
          const on = cat === id;
          const n = catCounts[id] || 0;
          if (id !== 'all' && n === 0) return null;
          return (
            <button key={id} onClick={() => setCat(id)}
              className="px-2 h-[24px] rounded-full text-[10px] whitespace-nowrap shrink-0 transition-colors flex items-center gap-1"
              style={{ background: on ? TH.accent : TH.chipBg, color: on ? '#fff' : TH.text }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = TH.chipBg; }}>
              {label}
              {n > 0 && <span className="tnum opacity-60" dir="ltr">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="overflow-auto bn-thin-scroll" style={{ scrollBehavior: 'smooth', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
        {items === null && <div className="px-3 py-8 text-center opacity-40 text-[11px]">در حالِ دریافتِ اخبار…</div>}
        {items !== null && shown.length === 0 && (
          <div className="px-3 py-10 text-center opacity-45 text-[11px] leading-6">
            {onlyRelevant
              ? <>خبرِ مرتبط با <span dir="ltr" className="tnum">{symbol}</span> {cat !== 'all' ? `در دستهٔ «${CAT_LABEL[cat]}» ` : ''}یافت نشد.</>
              : cat !== 'all'
                ? <>فعلاً خبری در دستهٔ «{CAT_LABEL[cat]}» نیست.</>
                : 'فعلاً خبری نیست.'}
          </div>
        )}
        {shown.map((a, i) => {
          const tickers = newsTickers(a);
          const impact = a.impact || 0;
          const hot = impact >= 8;
          const k = newsKey(a, i);
          const isFresh = freshKeys.has(k);
          const dot = impactColor(impact);
          return (
            <button key={k} onClick={() => a.url && window.open(a.url, '_blank', 'noopener,noreferrer')}
              title={a.url ? 'بازکردنِ خبر در منبع' : undefined} aria-label={a.url ? `بازکردنِ خبر: ${a.title}` : a.title}
              className={`group relative block w-full text-right pl-3 pr-3 py-2.5 border-b transition-colors${isFresh ? ' flash-up' : ''}`}
              style={{ borderColor: TH.border, cursor: a.url ? 'pointer' : 'default' }}
              onMouseEnter={(e) => { if (a.url) e.currentTarget.style.background = TH.chipBgHover; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              {/* نوارِ اهمیت (لبهٔ راست، سبکِ News Flowِ TV) */}
              {hot && <span className="absolute top-0 bottom-0 right-0 w-[2px]" style={{ background: TH.down }} />}
              {/* ردیفِ متا: منبع · زمان + برچسب‌ها */}
              <div className="flex items-center gap-1.5 mb-1" dir="ltr">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                <span className="text-[9.5px] font-semibold uppercase tracking-wide truncate" style={{ color: TH.text, opacity: 0.8, maxWidth: 130 }}>{a.source}</span>
                <span className="text-[9px] opacity-40">·</span>
                <span className="text-[9.5px] whitespace-nowrap opacity-55" style={{ color: TH.text }} dir="rtl">{relTime(a.ts)}</span>
                <span className="flex-1" />
                {isFresh && (
                  <span className="shrink-0 px-1.5 h-[15px] rounded text-[8px] leading-[15px] font-bold whitespace-nowrap"
                    style={{ background: TH.accent, color: '#fff' }}>جدید</span>
                )}
                {hot && (
                  <span className="shrink-0 px-1.5 h-[15px] rounded text-[8px] leading-[15px] font-bold whitespace-nowrap"
                    style={{ background: TH.down, color: '#fff' }}>مهم</span>
                )}
                {/* نشانگرِ «بازشدن در منبع» — فقط وقتی لینک دارد و روی hover (سبکِ آیتم‌های خبریِ TV) */}
                {a.url && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-0 group-hover:opacity-45 transition-opacity" style={{ color: TH.text }} aria-hidden="true">
                    <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  </svg>
                )}
              </div>
              {/* تیتر */}
              <div className="text-[12px] leading-[18px]" style={{ color: TH.textStrong }}>{a.title}</div>
              {a.summary && <div className="text-[10px] leading-[17px] mt-1 opacity-60">{a.summary}</div>}
              {/* برچسبِ نمادهای مرتبط */}
              {tickers.length > 0 && (
                <div className="flex items-center flex-wrap gap-1 mt-1.5" dir="ltr">
                  {tickers.map((t) => (
                    <span key={t} className="tnum px-1.5 h-[16px] rounded leading-[16px] text-[9px] font-semibold"
                      style={{ background: TH.chipBg, color: TH.text }}>{t}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
