// اخبارِ بازار — فارسی، بدونِ عکس. منبع: /academy/bn/news (RSSِ بین‌المللی،
// خلاصه/ترجمهٔ فارسی توسطِ Claudeِ داخلِ سرور). بدنهٔ تبِ پنلِ راست. props: { symbol, TH }
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

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

  useEffect(() => {
    let on = true;
    const load = () => api.bnNews().then((r) => { if (on) setItems(r?.items || []); }).catch(() => { if (on && items === null) setItems([]); });
    load();
    const id = setInterval(load, 60000);
    return () => { on = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <span className="opacity-50 text-[10px] whitespace-nowrap">مهم‌ترین اخبارِ بازار</span>
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
          const hot = (a.impact || 0) >= 8;
          return (
            <button key={a.id || a.url || i} onClick={() => a.url && window.open(a.url, '_blank', 'noopener,noreferrer')}
              className="block w-full text-right px-3 py-2 border-b transition-colors"
              style={{ borderColor: TH.border }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              <div className="flex items-start gap-1.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: impactColor(a.impact || 0) }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    <div className="text-[11px] leading-5 flex-1" style={{ color: TH.textStrong }}>{a.title}</div>
                    {hot && (
                      <span className="shrink-0 mt-0.5 px-1.5 h-[15px] rounded text-[8px] leading-[15px] font-bold"
                        style={{ background: TH.down, color: '#fff' }}>مهم</span>
                    )}
                  </div>
                  {a.summary && <div className="text-[10px] leading-5 mt-0.5 opacity-70">{a.summary}</div>}
                  <div className="flex items-center flex-wrap gap-1.5 mt-1 text-[9px] opacity-50" dir="ltr">
                    <span>{a.source}</span><span>·</span><span dir="rtl">{relTime(a.ts)}</span>
                    {tickers.map((t) => (
                      <span key={t} className="tnum px-1 h-[14px] rounded leading-[14px]"
                        style={{ background: TH.chipBg, color: TH.text, opacity: 0.9 }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
