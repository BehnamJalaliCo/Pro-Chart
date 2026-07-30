// اخبارِ بازار — فارسی، بدونِ عکس. منبع: /academy/bn/news (RSSِ بین‌المللی،
// خلاصه/ترجمهٔ فارسی توسطِ Claudeِ داخلِ سرور). بدنهٔ تبِ پنلِ راست. props: { symbol, TH }
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';

// کلیدِ پایدارِ خبر (مستقل از موقعیت در لیست) — برای تشخیصِ خبرِ تازه و کلیدِ React
function newsKey(a, i) {
  return (a && (a.id || a.url)) || `${a?.ts || ''}|${a?.title || ''}` || `i${i}`;
}

// زمانِ نسبیِ فارسی از unix-seconds — سبکِ TradingView: هم‌اکنون/دقیقه/ساعت، «دیروز»
// برای ۱ روز، و برای قدیمی‌ترها (≥۷ روز) به تاریخِ شمسیِ کوتاه (مثلِ «۱۵ تیر») برمی‌گردد
// به‌جای «۱۲ روز پیش»ِ بی‌فایده. تاریخ در try/catch است تا اگر Intlِ fa نبود امن degrade کند.
function relTime(ts) {
  if (!ts) return '';
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return 'هم‌اکنون';
  const m = Math.floor(s / 60); if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ساعت پیش`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'دیروز';
  if (d < 7) return `${d} روز پیش`;
  try { return new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(new Date(ts * 1000)); } catch (e) { return `${d} روز پیش`; }
}

// زمانِ مطلقِ انتشار (برای tooltipِ زمانِ نسبی) — TV زمانِ دقیق را در نمای خبر نشان می‌دهد؛ اینجا روی hoverِ «۲ دقیقه پیش».
function absTime(ts) {
  if (!ts) return '';
  try { return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts * 1000)); } catch (e) { return ''; }
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
// نگاشتِ برچسبِ خبر → نمادِ قابلِ‌معاملهٔ Pro-Chart (فقط نمادهای موجود). USD/OIL نگاشتِ تک‌نماد ندارند ⇒ کلیک‌ناپذیر.
// هم‌ترازِ «پیل‌های نمادِ مرتبطِ» خبرِ TV که با کلیک نمادِ چارت را عوض می‌کنند.
const TAG_SYMBOL = { XAU: 'XAUUSD', EUR: 'EURUSD', GBP: 'GBPUSD', JPY: 'USDJPY', BTC: 'BTCUSDT', ETH: 'ETHUSDT', NAS: 'NAS100', US30: 'US30', US500: 'US500' };

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
  const [active, setActive] = useState(null); // خبرِ بازشده در پیش‌نمایشِ درون‌برنامه‌ای (مثلِ pop-up dialogِ خبرِ TV)
  const shownRef = useRef([]);                 // آینهٔ لیستِ نمایش‌داده‌شده — برای ناوبریِ ↑/↓ در خواننده (بدونِ closureِ کهنه)
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

  // Esc → بستنِ خواننده؛ ↑/↓ → خبرِ قبلی/بعدی (ناوبریِ کیبوردِ خواننده مثلِ TV)
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); setActive(null); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = shownRef.current || [];
        if (!list.length) return;
        e.preventDefault(); e.stopPropagation();
        let idx = list.findIndex((a) => a === active || (active.url && a.url === active.url) || (active.id != null && a.id === active.id));
        if (idx < 0) idx = 0;
        const next = e.key === 'ArrowDown' ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
        if (list[next] && list[next] !== active) setActive(list[next]);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active]);

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

  // اگر دستهٔ فعال زیرِ فیلترِ فعلی خالی شد (چیپش پنهان می‌شود)، به «همه» برگرد تا کاربر روی فهرستِ خالی گیر نکند
  useEffect(() => {
    if (cat !== 'all' && (catCounts[cat] || 0) === 0) setCat('all');
  }, [cat, catCounts]);

  const shown = useMemo(() => {
    if (cat === 'all') return bySymbol;
    return bySymbol.filter((a) => newsCats(a).has(cat));
  }, [bySymbol, cat]);
  shownRef.current = shown; // همگام برای ناوبریِ کیبورد در خواننده

  const impactColor = (n) => (n >= 8 ? TH.down : n >= 5 ? '#f59e0b' : TH.text);

  // تبِ متنیِ segmented (LUXE §۸.۶): فعال = تینت + متنِ accent؛ غیرفعال = متنِ خنثی
  const segBtn = (on) => ({
    background: on ? 'var(--pc-accent-tint)' : 'transparent', color: on ? (TH.accentText || TH.accent) : TH.text,
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
          <span className="text-[12px] font-semibold" style={{ color: TH.textStrong }}>مهم‌ترین اخبارِ بازار</span>
        </span>
        <div className="flex items-center rounded-md overflow-hidden shrink-0" style={{ border: `1px solid ${TH.border}` }} dir="rtl">
          <button onClick={() => setOnlyRelevant(false)}
            className="px-2 h-[22px] text-[11px] transition-colors" style={segBtn(!onlyRelevant)}
            onMouseEnter={(e) => { if (onlyRelevant) e.currentTarget.style.background = 'var(--pc-hover)'; }}
            onMouseLeave={(e) => { if (onlyRelevant) e.currentTarget.style.background = 'transparent'; }}>
            همهٔ نمادها
          </button>
          <button onClick={() => setOnlyRelevant(true)}
            className="px-2 h-[22px] text-[11px] transition-colors flex items-center gap-1 pc-hairline-s" style={segBtn(onlyRelevant)}
            onMouseEnter={(e) => { if (!onlyRelevant) e.currentTarget.style.background = 'var(--pc-hover)'; }}
            onMouseLeave={(e) => { if (!onlyRelevant) e.currentTarget.style.background = 'transparent'; }}>
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
              className="px-2 h-[24px] rounded text-[11px] whitespace-nowrap shrink-0 transition-colors flex items-center gap-1"
              style={{ background: on ? 'var(--pc-accent-tint)' : 'transparent', color: on ? (TH.accentText || TH.accent) : TH.text }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
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
            <button key={k} onClick={() => setActive(a)}
              title="پیش‌نمایشِ خبر" aria-label={`پیش‌نمایشِ خبر: ${a.title}`}
              className={`group relative block w-full text-right pl-3 pr-3 py-2.5 border-b transition-colors${isFresh ? ' flash-up' : ''}`}
              style={{ borderColor: TH.border, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              {/* نوارِ اهمیت (لبهٔ راست، سبکِ News Flowِ TV) */}
              {hot && <span className="absolute top-0 bottom-0 right-0 w-[2px]" style={{ background: TH.down }} />}
              {/* ردیفِ متا: منبع · زمان + برچسب‌ها */}
              <div className="flex items-center gap-1.5 mb-1" dir="ltr">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
                <span className="text-[10px] font-semibold uppercase truncate" style={{ color: 'var(--pc-text-muted)', letterSpacing: '.4px', maxWidth: 130 }} title={a.source || ''}>{a.source}</span>
                <span className="text-[10px] opacity-40">·</span>
                <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--pc-text-muted)' }} dir="rtl" title={absTime(a.ts)}>{relTime(a.ts)}</span>
                <span className="flex-1" />
                {/* بج‌های معنایی به‌صورتِ متنِ رنگی، نه قرصِ پر (LUXE §۲/§۸) */}
                {isFresh && (
                  <span className="shrink-0 text-[10px] font-semibold whitespace-nowrap"
                    style={{ color: TH.accentText || TH.accent }}>جدید</span>
                )}
                {hot && (
                  <span className="shrink-0 text-[10px] font-semibold whitespace-nowrap"
                    style={{ color: TH.downText || TH.down }}>مهم</span>
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
              {a.summary && <div className="text-[11px] leading-[17px] mt-1 opacity-60 line-clamp-2">{a.summary}</div>}
              {/* برچسبِ نمادهای مرتبط */}
              {tickers.length > 0 && (
                <div className="flex items-center flex-wrap gap-1 mt-1.5" dir="ltr">
                  {tickers.map((t) => {
                    const sym = TAG_SYMBOL[t];
                    // نمادِ نگاشت‌شده ⇒ پیلِ کلیک‌پذیر که نمادِ چارت را عوض می‌کند (سبکِ نمادِ مرتبطِ خبرِ TV)؛
                    // stopPropagation تا کلیک، بازکردنِ منبعِ ردیف را تریگر نکند.
                    if (sym) return (
                      <span key={t} role="button" tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); try { window.dispatchEvent(new CustomEvent('bn:setSymbol', { detail: sym })); } catch (err) {} }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); try { window.dispatchEvent(new CustomEvent('bn:setSymbol', { detail: sym })); } catch (err) {} } }}
                        title={`نمایشِ ${sym} روی چارت`}
                        className="tnum px-1.5 h-[16px] rounded leading-[14px] text-[10px] font-semibold cursor-pointer transition-colors duration-[120ms]"
                        style={{ background: 'transparent', border: `1px solid ${TH.border}`, color: TH.accentText || TH.accent }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--pc-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>{t}</span>
                    );
                    return (
                      <span key={t} className="tnum px-1.5 h-[16px] rounded leading-[14px] text-[10px] font-semibold"
                        style={{ background: 'transparent', border: `1px solid ${TH.border}`, color: 'var(--pc-text-muted)' }}>{t}</span>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* پیش‌نمایشِ درون‌برنامه‌ایِ خبر — معادلِ green-appleِ pop-up dialogِ خبرِ TV (staying in-app؛ متنِ کاملِ خلاصه + زمانِ مطلق + نمادهای مرتبط + دکمهٔ منبع) */}
      {active && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" dir="rtl"
          style={{ background: 'rgba(0,0,0,.45)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setActive(null); }}>
          <div className="w-full max-w-[440px] max-h-[80vh] flex flex-col rounded-lg overflow-hidden"
            style={{ background: TH.popoverBg, border: `1px solid ${TH.border}`, boxShadow: 'var(--pc-shadow-modal)' }}>
            {/* هدر: منبع · زمانِ مطلق + بستن */}
            <div className="flex items-center gap-2 px-3 h-10 border-b shrink-0" style={{ borderColor: TH.border }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: impactColor(active.impact || 0) }} />
              <span className="text-[10px] font-semibold uppercase tracking-wide truncate" style={{ color: TH.text, opacity: 0.85 }} dir="ltr">{active.source}</span>
              <span className="text-[9px] opacity-40">·</span>
              <span className="text-[10px] opacity-60 whitespace-nowrap">{absTime(active.ts) || relTime(active.ts)}</span>
              <span className="flex-1" />
              <button onClick={() => setActive(null)} title="بستن" aria-label="بستن" className="shrink-0 p-1 rounded-md transition-colors" style={{ color: TH.text }}
                onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            {/* بدنه: تیتر + متنِ کاملِ خلاصه */}
            <div className="px-4 py-3 overflow-y-auto min-h-0">
              <div className="text-[15px] font-bold leading-7 mb-2" style={{ color: TH.textStrong }}>{active.title}</div>
              {active.summary && <div className="text-[12.5px] leading-6 opacity-80" style={{ color: TH.text }}>{active.summary}</div>}
              {/* نمادهای مرتبط — کلیک: نمایش روی چارت + بستن */}
              {(() => { const tk = newsTickers(active); return tk.length > 0 && (
                <div className="flex items-center flex-wrap gap-1 mt-3" dir="ltr">
                  {tk.map((t) => { const sym = TAG_SYMBOL[t]; return (
                    <span key={t} role={sym ? 'button' : undefined} tabIndex={sym ? 0 : undefined}
                      onClick={sym ? () => { try { window.dispatchEvent(new CustomEvent('bn:setSymbol', { detail: sym })); } catch (err) {} setActive(null); } : undefined}
                      title={sym ? `نمایشِ ${sym} روی چارت` : undefined}
                      className={`tnum px-2 h-[20px] rounded leading-[20px] text-[10px] font-semibold ${sym ? 'cursor-pointer' : ''}`}
                      style={{ background: TH.chipBg, color: sym ? TH.accent : TH.text }}>{t}</span>
                  ); })}
                </div>
              ); })()}
            </div>
            {/* پاورقی: دکمهٔ بازکردن در منبع */}
            {active.url && (
              <div className="px-4 py-2.5 border-t shrink-0" style={{ borderColor: TH.border }}>
                <button onClick={() => window.open(active.url, '_blank', 'noopener,noreferrer')}
                  className="w-full flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: TH.accent }}>
                  <span>خواندنِ کاملِ خبر در منبع</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
