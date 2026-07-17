// جزئیات (Details) — مشخصاتِ نمادِ فعال: قیمتِ زنده، بید/اَسک، بازهٔ روز،
// اسپرد، تغییرِ روز و متادیتای ابزار. بدنهٔ یک تبِ پنلِ راست.
// props: { symbol, TH, symbols, prices }
// prices[sym] = { mid: string|number, dir: -1|0|1 }
// بازهٔ روز/تغییر از کندلِ روزانه (api.chart) خوانده می‌شود؛ نبودِ داده ⇐ حالتِ خالیِ تمیز.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import SymbolLogo from '../SymbolLogo';
import { RATING_FA, technicalRating } from '../techRating';

const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };

// حجم/اعدادِ بزرگ به‌صورتِ فشرده (K/M/B) — نمایشِ هم‌ترازِ TV
function compact(v) {
  const n = num(v);
  if (n == null) return null;
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return String(Math.round(n));
}

// متادیتای ایستا برای انواعِ ابزار (وقتی spec دقیق نداریم، گرافِ‌ول degrade)
// market = برچسبِ بازار/صرافیِ کوتاه (سبکِ «• NASDAQ»ِ سرتیترِ TV) · cat = دستهٔ منطقی برای متن.
function metaFor(symbol = '') {
  const s = symbol.toUpperCase();
  if (/BTC|ETH|USDT|SOL|XRP|DOGE|BNB|ADA/.test(s)) return { type: 'رمزارز', contract: '۱', session: '۲۴/۷', market: 'CRYPTO', cat: 'crypto' };
  if (/XAU|GOLD/.test(s)) return { type: 'فلزِ گران‌بها (طلا)', contract: '۱۰۰', session: 'لندن/نیویورک', market: 'COMEX', cat: 'metal' };
  if (/XAG|SILVER/.test(s)) return { type: 'فلزِ گران‌بها (نقره)', contract: '۵۰۰۰', session: 'لندن/نیویورک', market: 'COMEX', cat: 'metal' };
  if (/OIL|WTI|BRENT|USOIL/.test(s)) return { type: 'انرژی (نفت)', contract: '۱۰۰۰', session: 'نیویورک', market: 'NYMEX', cat: 'energy' };
  if (/US30|NAS|SPX|GER|DAX|UK100|JPN/.test(s)) return { type: 'شاخص', contract: '۱', session: 'بورسِ مربوطه', market: 'INDEX', cat: 'index' };
  if (/^[A-Z]{6}$/.test(s)) return { type: 'جفت‌ارز (فارکس)', contract: '۱۰۰٬۰۰۰', session: 'سیدنی→نیویورک', market: 'FX', cat: 'forex' };
  return { type: 'ابزار', contract: '—', session: '—', market: '', cat: 'other' };
}

// جملهٔ توصیفیِ «حقایقِ کلیدی» (کارتِ بنفشِ سبکِ TV) — بر پایهٔ دستهٔ ابزار، بدونِ دادهٔ ساختگی.
function factsFor(cat, label) {
  const n = label || 'این نماد';
  switch (cat) {
    case 'crypto': return `${n} یک دارایی دیجیتال است که به‌صورتِ ۲۴ساعته و ۷روزِ هفته در بازارهای جهانیِ رمزارز دادوستد می‌شود؛ نوسانِ آن بالا و نقدشوندگی‌اش زیاد است.`;
    case 'metal': return `${n} از فلزاتِ گران‌بها و دارایی‌های امن به شمار می‌آید و قیمتش با نرخِ بهرهٔ دلار و ریسکِ جهانی رابطهٔ نزدیک دارد.`;
    case 'energy': return `${n} از قراردادهای پرمعاملهٔ انرژی است و قیمتش تابعِ عرضه‌وتقاضای جهانی، ذخایرِ هفتگی و تصمیمِ تولیدکنندگان است.`;
    case 'index': return `${n} شاخصی از بزرگ‌ترین شرکت‌های بازارِ مربوطه است و نمایانگرِ روندِ کلیِ آن بازار محسوب می‌شود.`;
    case 'forex': return `${n} از پرمعامله‌ترین جفت‌ارزهای بازارِ فارکس است و به‌صورتِ ۲۴ساعته از سیدنی تا نیویورک دادوستد می‌شود.`;
    default: return `${n} در پلتفرمِ Pro-Chart به‌صورتِ زنده قابلِ رهگیری و تحلیل است.`;
  }
}

// شمارشِ ارقامِ اعشار برای نمایشِ هم‌ترازِ بید/اَسک
function decimals(mid) { const s = String(mid ?? ''); return s.includes('.') ? s.split('.')[1].length : 2; }

// نامِ کاملِ فارسیِ نماد (سبکِ سرتیترِ TV: «یورو / دلار آمریکا»). نبودِ نگاشت ⇐ null.
const CCY_FA = { USD: 'دلار آمریکا', EUR: 'یورو', GBP: 'پوند', JPY: 'ین ژاپن', CHF: 'فرانک سوئیس', CAD: 'دلار کانادا', AUD: 'دلار استرالیا', NZD: 'دلار نیوزیلند', XAU: 'طلا', XAG: 'نقره', XPT: 'پلاتین', XPD: 'پالادیوم' };
const CRYPTO_FA = { BTC: 'بیت‌کوین', ETH: 'اتریوم', BNB: 'بایننس‌کوین', SOL: 'سولانا', XRP: 'ریپل', ADA: 'کاردانو', DOGE: 'دوج‌کوین', TRX: 'ترون', LTC: 'لایت‌کوین', DOT: 'پولکادات', LINK: 'چین‌لینک', AVAX: 'آوالانچ', MATIC: 'پالیگان', TON: 'تون‌کوین', SHIB: 'شیبا اینو', PEPE: 'پپه', BCH: 'بیت‌کوین‌کش', ATOM: 'کازموس', UNI: 'یونی‌سواپ', NEAR: 'نیر', APT: 'اپتاس', ARB: 'آربیتروم', OP: 'اپتیمیزم' };
const IDX_FA = { US30: 'داوجونز ۳۰', US500: 'اس‌اند‌پی ۵۰۰', SPX: 'اس‌اند‌پی ۵۰۰', NAS100: 'نزدک ۱۰۰', US100: 'نزدک ۱۰۰', NAS: 'نزدک', UK100: 'فوتسی ۱۰۰', DE40: 'دکسِ آلمان', JP225: 'نیکی ۲۲۵', HK50: 'هنگ‌سنگ', FRA40: 'کَکِ فرانسه' };
function nameFor(symbol = '') {
  const s = String(symbol).toUpperCase();
  const clean = s.replace(/[^A-Z0-9]/g, '');
  const a = clean.slice(0, 3), b = clean.slice(3, 6);
  if (clean.length >= 6 && CCY_FA[a] && CCY_FA[b]) return `${CCY_FA[a]} / ${CCY_FA[b]}`;
  for (const k of Object.keys(IDX_FA)) if (s.includes(k)) return IDX_FA[k];
  if (/OIL|WTI|USOIL|XTI/.test(s)) return 'نفتِ خامِ WTI';
  if (/BRENT|UKOIL|XBR/.test(s)) return 'نفتِ برنت';
  const base = clean.replace(/USDT$|USD$/, '');
  if (CRYPTO_FA[base]) return `${CRYPTO_FA[base]} / دلار`;
  if (CCY_FA[base]) return CCY_FA[base];
  return null;
}

// ارزِ مظنه برای نمایشِ کنارِ قیمتِ بزرگ (سبکِ سرتیترِ TV: «۱٫۱۰۲۳ USD»). نبود ⇐ null.
function quoteFor(symbol = '') {
  const s = String(symbol).toUpperCase();
  const clean = s.replace(/[^A-Z0-9]/g, '');
  if (/USDT$/.test(clean)) return 'USDT';
  const b = clean.slice(3, 6);
  if (clean.length >= 6 && CCY_FA[b]) return b; // جفت‌ارز/فلز → ارزِ دوم
  if (/USD$/.test(clean) && clean.length > 3) return 'USD';
  return null;
}

// اعشارِ دقیقِ نمایشِ قیمت به سبکِ TradingView (نه ۸ رقمِ خامِ فید):
// فارکس ۵ رقم، جفت‌های ین ۳، طلا ۲، نقره ۳، نفت ۲، شاخص ۲، رمزارز بر اساسِ بزرگیِ قیمت.
function priceDecimals(symbol, mid) {
  const s = String(symbol).toUpperCase();
  const clean = s.replace(/[^A-Z0-9]/g, '');
  const a = clean.slice(0, 3), b = clean.slice(3, 6);
  if (/XAG|SILVER/.test(s)) return 3;
  if (/XAU|GOLD|XPT|XPD/.test(s)) return 2;
  if (/OIL|WTI|BRENT|USOIL|UKOIL|XTI|XBR/.test(s)) return 2;
  if (/US30|US500|SPX|US100|NAS|UK100|DE40|GER|DAX|FRA40|CAC|JP225|N225|HK50|HSI|AUS200|VIX|DJI/.test(s)) return 2;
  // جفت‌ارزِ فارکس (۶ حرفِ ارزِ شناخته‌شده)
  if (clean.length >= 6 && CCY_FA[a] && CCY_FA[b]) return b === 'JPY' ? 3 : 5;
  // رمزارز و بقیه → بر اساسِ بزرگیِ قیمت (سبکِ نردبانِ TV)
  const n = num(mid);
  if (n != null) {
    const x = Math.abs(n);
    if (x >= 1) return 2;
    if (x >= 0.1) return 4;
    if (x >= 0.001) return 5;
    if (x > 0) return 8;
  }
  // آخرین پناه: اعشارِ خودِ فید (سقفِ ۵ برای پرهیز از ۸ رقمِ زشت)
  return Math.min(decimals(mid), 5);
}

// تبدیلِ رنگِ hexِ ۶رقمی به rgba برای پس‌زمینهٔ کم‌رنگِ پیلِ تغییر (سبکِ TV).
function tint(hex, a) {
  const h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 'transparent';
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

// فلَشِ جهت‌دارِ سبز/قرمز روی هر تغییرِ قیمت (حسِ زنده‌بودنِ TV). از کلاس‌های سراسریِ
// .flash-up/.flash-down استفاده می‌کند؛ برای ری‌استارتِ انیمیشن، عنصر با key نو ری‌مونت می‌شود.
// جهتِ فلَش از تیکِ فید (dir) گرفته می‌شود؛ نبودش ⇐ مقایسهٔ مقدارِ قبلی.
function Flash({ value, dir, className = '', style, children }) {
  const prev = React.useRef(value);
  const [st, setSt] = React.useState({ cls: '', n: 0 });
  React.useEffect(() => {
    if (value != null && prev.current != null && value !== prev.current) {
      const up = dir === 1 || dir === -1 ? dir === 1 : value > prev.current;
      setSt((s) => ({ cls: up ? 'flash-up' : 'flash-down', n: s.n + 1 }));
    }
    prev.current = value;
  }, [value, dir]);
  return <span key={st.n} className={`${className} ${st.cls}`} style={style}>{children}</span>;
}

// زمانِ نسبیِ فارسی از unix-seconds — برای کارتِ «اخبار»ِ سبکِ TV در پنلِ جزئیات (هم‌سبکِ NewsTab).
function newsRelTime(ts) {
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

// کلیدواژه‌های نماد برای انتخابِ خبرِ مرتبط (زیرمجموعهٔ سبکِ symbolKeywordsِ NewsTab).
const NEWS_KW_MAP = {
  EUR: ['eur', 'یورو'], USD: ['usd', 'دلار', 'فدرال', 'fed'], GBP: ['gbp', 'پوند'], JPY: ['jpy', 'ین'],
  XAU: ['xau', 'gold', 'طلا'], CAD: ['cad', 'کانادا'], AUD: ['aud', 'استرالیا'], CHF: ['chf', 'فرانک'],
  NZD: ['nzd', 'نیوزیلند'], OIL: ['oil', 'نفت'], BTC: ['btc', 'bitcoin', 'بیت'], ETH: ['eth', 'اتر', 'اتریوم'],
};
function newsKW(symbol = '') {
  const s = String(symbol).toUpperCase();
  const out = new Set();
  Object.keys(NEWS_KW_MAP).forEach((k) => { if (s.includes(k)) NEWS_KW_MAP[k].forEach((w) => out.add(w)); });
  return [...out];
}

export default function Details({ symbol, TH, prices = {}, techRating = null }) {
  const [day, setDay] = useState(null); // {o,h,l,c,v} کندلِ روز
  // نشانگرِ بارگذاری: فقط به واکشیِ هستهٔ روزانه (D1) بسته است — که برای هر نمادِ معتبر داده برمی‌گرداند —
  // تا نوارِ shimmer پس از settle حتماً پاک شود (بنیادی/اخبار عمداً برای کریپتو/فارکس خالی می‌مانند، پس ملاکِ loading نیستند).
  const [loading, setLoading] = useState(false);
  const [yr, setYr] = useState(null);   // {hi52,lo52,avgVol} از یک سالِ کندلِ روزانه
  const [news, setNews] = useState(null); // آخرین خبرِ مرتبط (کارتِ News سبکِ TV)
  const [ratingTf, setRatingTf] = useState(null); // تایم‌فریمِ انتخابیِ امتیازِ تکنیکال (Technical Ratingِ TV دارد)؛ null = تایم‌فریمِ چارت (propِ techRating)
  const [tfRating, setTfRating] = useState(null);  // امتیازِ محاسبه‌شده روی ratingTfِ انتخابی
  const [fund, setFund] = useState(null); // داده‌های بنیادیِ سهام از Finnhub (فقط سهامِ آمریکا)
  const lp = prices[symbol];
  const mid = num(lp?.mid);
  const dir = lp?.dir || 0;

  // با تغییرِ نماد، انتخابِ تایم‌فریمِ امتیاز به پیش‌فرض (تایم‌فریمِ چارت) برگردد
  useEffect(() => { setRatingTf(null); }, [symbol]);
  // امتیازِ تکنیکال روی تایم‌فریمِ انتخابی (Technical Rating TF selectorِ TV): کندل‌های آن TF را می‌گیرد و امتیاز می‌سازد.
  useEffect(() => {
    let on = true;
    setTfRating(null);
    if (!ratingTf || !symbol) return () => { on = false; };
    (async () => {
      try {
        const r = await api.chart(symbol, ratingTf, '', 260);
        const cs = (r?.candles || []).map((c) => ({ o: num(c.o), h: num(c.h), l: num(c.l), c: num(c.c) })).filter((c) => c.c != null);
        if (on) setTfRating(technicalRating(cs));
      } catch (e) { if (on) setTfRating(null); }
    })();
    return () => { on = false; };
  }, [ratingTf, symbol]);

  // واکشیِ کندلِ روزانه برای بازهٔ روز و تغییرِ روز (+حجمِ روز اگر موجود)
  useEffect(() => {
    let on = true;
    setDay(null);
    if (!symbol) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const res = await api.chart(symbol, 'D1', undefined, 2);
        const cs = res?.candles || res?.data || res || [];
        const arr = Array.isArray(cs) ? cs : [];
        const last = arr[arr.length - 1];
        const prev = arr.length >= 2 ? arr[arr.length - 2] : null;
        if (on && last && last.o != null) setDay({ o: last.o, h: last.h, l: last.l, c: last.c, v: last.v ?? last.volume ?? null, prevClose: prev && prev.c != null ? prev.c : null, t: last.t ?? last.time ?? null });
      } catch { if (on) setDay(null); }
      finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [symbol]);

  // داده‌های بنیادیِ سهام (Finnhub) — فقط سهامِ آمریکا داده دارد؛ کریپتو/فارکس بی‌صدا خالی می‌ماند.
  useEffect(() => {
    let on = true;
    setFund(null);
    if (!symbol) return;
    (async () => {
      try {
        const res = await api.bnFundamentals(symbol);
        const d = res?.data ?? res;
        if (on && d && d.available) setFund(d);
      } catch { if (on) setFund(null); }
    })();
    return () => { on = false; };
  }, [symbol]);

  // آخرین خبرِ مرتبط با نماد (کارتِ «اخبار» سبکِ Symbol Infoِ TV) — از همان /academy/bn/news؛
  // مرتبط با نماد اگر کلیدواژه بخورد، وگرنه آخرینِ عمومی (مثلِ کارتِ خبرِ عمومیِ TV). بی‌صدا degrade.
  useEffect(() => {
    let on = true;
    setNews(null);
    if (!symbol) return undefined;
    (async () => {
      try {
        const r = await api.bnNews();
        const items = Array.isArray(r?.items) ? r.items : [];
        if (!items.length) return;
        const kws = newsKW(symbol);
        const rel = kws.length ? items.find((a) => {
          const hay = `${a?.title || ''} ${a?.summary || ''}`.toLowerCase();
          return kws.some((w) => hay.includes(w));
        }) : null;
        const pick = rel || items[0];
        if (on && pick && pick.title) setNews(pick);
      } catch { if (on) setNews(null); }
    })();
    return () => { on = false; };
  }, [symbol]);

  // واکشیِ یک سالِ کندلِ روزانه برای بازهٔ ۵۲ هفته و میانگینِ حجم (بی‌صدا degrade)
  useEffect(() => {
    let on = true;
    setYr(null);
    if (!symbol) return;
    (async () => {
      try {
        const res = await api.chart(symbol, 'D1', undefined, 365);
        const cs = res?.candles || res?.data || res || [];
        const arr = Array.isArray(cs) ? cs : [];
        if (!arr.length) return;
        let hi52 = -Infinity, lo52 = Infinity, vSum = 0, vN = 0;
        for (const c of arr) {
          const h = num(c.h), l = num(c.l), v = num(c.v ?? c.volume);
          if (h != null && h > hi52) hi52 = h;
          if (l != null && l < lo52) lo52 = l;
          if (v != null) { vSum += v; vN++; }
        }
        // بازده‌های دوره‌ای (Performanceِ TV: 1W/1M/3M/6M/YTD/1Y) از سریِ بسته‌های روزانه — بستهٔ فعلی نسبت به بستهٔ N روزِ معاملاتیِ قبل.
        const closesFull = arr.map((c) => num(c.c)).filter((x) => x != null);
        const lastC = closesFull.length ? closesFull[closesFull.length - 1] : null;
        const retN = (n) => { const i = closesFull.length - 1 - n; return (i >= 0 && closesFull[i] && lastC != null) ? ((lastC - closesFull[i]) / closesFull[i]) * 100 : null; };
        let ytd = null;
        try { const jan1 = Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000; const yc = arr.find((c) => (num(c.t ?? c.time) ?? 0) >= jan1); const yv = yc ? num(yc.c) : null; if (yv && lastC != null) ytd = ((lastC - yv) / yv) * 100; } catch (e) { /* noop */ }
        if (on) setYr({
          hi52: Number.isFinite(hi52) ? hi52 : null,
          lo52: Number.isFinite(lo52) ? lo52 : null,
          avgVol: vN ? vSum / vN : null,
          // سریِ بسته‌های اخیر برای اسپارک‌لاینِ بالای پنل (مثلِ Symbol Infoِ TV) — آخرین ۹۰ روز
          closes: closesFull.slice(-90),
          perf: { w1: retN(5), m1: retN(21), m3: retN(63), m6: retN(126), ytd, y1: retN(252) },
        });
      } catch { if (on) setYr(null); }
    })();
    return () => { on = false; };
  }, [symbol]);

  const meta = useMemo(() => metaFor(symbol), [symbol]);
  const name = useMemo(() => nameFor(symbol), [symbol]);
  const quoteCcy = useMemo(() => quoteFor(symbol), [symbol]);
  const facts = useMemo(() => factsFor(meta.cat, name || symbol), [meta.cat, name, symbol]);
  const dec = priceDecimals(symbol, mid);
  // نمایشِ هم‌ترازِ TV: اعشارِ ثابت + جداکنندهٔ هزارگان (ارقامِ لاتین، tabular، dir=ltr).
  const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));

  // اسپردِ تخمینی: نصفِ یک پیپ هرطرف (پراکسیِ نمایشی)
  const pip = Math.pow(10, -(dec > 0 ? dec - 1 : 0));
  const half = mid != null ? pip * 0.5 : null;
  const bid = mid != null ? mid - half : null;
  const ask = mid != null ? mid + half : null;
  const spread = half != null ? pip : null;

  // تغییرِ روز عینِ TradingView = close-to-close: نسبت به بستهٔ روزِ قبل (prevClose)؛ نبودش ⇒ fallback به openِ روز.
  const base = day?.prevClose != null ? day.prevClose : (day?.o != null ? day.o : (day?.c ?? null));
  const ref = mid != null ? mid : (day?.c ?? null);
  const chgAbs = (base != null && ref != null) ? ref - base : null;
  const chgPct = (base && ref != null) ? (chgAbs / base) * 100 : null;
  const chgCol = chgPct == null ? TH.text : chgPct >= 0 ? (TH.upText || TH.up) : (TH.downText || TH.down);
  // رنگِ نشانگرِ نوارِ رنج (جهتِ روز؛ نبودِ داده ⇐ اکسنت)
  const trendCol = chgPct == null ? TH.accent : chgPct >= 0 ? TH.up : TH.down;

  // موقعیتِ قیمت در بازهٔ روز (0..1) برای نوارِ بازه.
  // بازهٔ روز باید همیشه قیمتِ زندهٔ فعلی را دربر بگیرد (مثلِ TradingView): اگر ref از کف/سقفِ
  // کندلِ روزانه بیرون زد، بازه را گسترش بده تا برچسب‌ها و knob بیرونِ نوار پین نشوند
  // (هم‌راستا با همان منطقِ folding که در بازهٔ ۵۲ هفته پایین‌تر هست).
  const lo = (day?.l != null && ref != null) ? Math.min(day.l, ref) : day?.l;
  const hi = (day?.h != null && ref != null) ? Math.max(day.h, ref) : day?.h;
  const pos = (lo != null && hi != null && hi > lo && ref != null)
    ? Math.max(0, Math.min(1, (ref - lo) / (hi - lo))) : null;

  // بازهٔ ۵۲ هفته + موقعیتِ قیمت درونِ آن
  const lo52 = yr?.lo52 != null ? Math.min(yr.lo52, lo != null ? lo : yr.lo52) : null;
  const hi52 = yr?.hi52 != null ? Math.max(yr.hi52, hi != null ? hi : yr.hi52) : null;
  const pos52 = (lo52 != null && hi52 != null && hi52 > lo52 && ref != null)
    ? Math.max(0, Math.min(1, (ref - lo52) / (hi52 - lo52))) : null;

  const Row = ({ k, v, c, last }) => (
    <div className="flex items-center justify-between gap-3 py-[5px]" style={{ borderBottom: last ? 'none' : `1px solid ${TH.border}` }}>
      <span className="text-[11px] shrink-0" style={{ color: TH.text }}>{k}</span>
      <span className="text-[11.5px] font-semibold tabular-nums truncate text-left" dir="ltr" style={{ color: c || TH.textStrong }}>{v}</span>
    </div>
  );

  // سرتیترِ بخش هم‌ترازِ TV: عنوانِ فارسی + برچسبِ انگلیسیِ کم‌رنگ
  const Label = ({ fa, en }) => (
    <div className="flex items-baseline gap-1.5 mb-1.5 mt-3.5">
      <span className="text-[11px] font-extrabold" style={{ color: TH.textStrong }}>{fa}</span>
      <span className="text-[9px] uppercase tracking-[0.08em] opacity-40" dir="ltr">{en}</span>
    </div>
  );

  // نوارِ رنجِ افقیِ سبکِ TV: track گرادیانِ قرمز→سبز + knobِ شارپ در موقعیتِ قیمت،
  // با مقادیرِ کف/سقف در دو سرِ نوار. p در بازهٔ 0..1 (کف=چپ، سقف=راست) یا null.
  const RangeBar = ({ title, loVal, hiVal, p }) => (
    <div className="mb-2.5">
      <div className="text-[10.5px] mb-1.5" style={{ color: TH.text }}>{title}</div>
      <div className="flex items-center gap-2" dir="ltr">
        <span className="text-[10px] tabular-nums shrink-0 w-[70px] whitespace-nowrap text-right" style={{ color: TH.textStrong, opacity: 0.85 }}>{loVal}</span>
        <div className="relative flex-1 h-1.5 rounded-full"
          style={{ background: p == null ? TH.chipBg : `linear-gradient(90deg, ${TH.down}, ${TH.up})` }}>
          {p != null && (
            <span className="absolute top-1/2 rounded-full"
              style={{
                left: `${p * 100}%`, transform: 'translate(-50%,-50%)',
                width: 12, height: 12, background: TH.bg,
                border: `2.5px solid ${trendCol}`,
                boxShadow: 'var(--pc-shadow-chip)',
              }} />
          )}
        </div>
        <span className="text-[10px] tabular-nums shrink-0 w-[70px] whitespace-nowrap text-left" style={{ color: TH.textStrong, opacity: 0.85 }}>{hiVal}</span>
      </div>
    </div>
  );

  if (!symbol) return (
    <div className="h-full flex items-center justify-center p-6 text-[11px] opacity-40 text-center">نمادی انتخاب نشده.</div>
  );

  return (
    <div className="relative p-3 text-xs" style={{ color: TH.text, fontVariantNumeric: 'tabular-nums' }}>
      {/* نوارِ بارگذاریِ نامعین (سبکِ اسکلتِ Symbol Infoِ TV): هنگامِ سوئیچِ نماد تا رسیدنِ کندلِ روزانه
          یک نوارِ باریکِ لغزان بالای پنل نشان می‌دهد تا «—»های گذرا مثلِ پنلِ خراب به‌نظر نرسند. */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-[2px] overflow-hidden" style={{ background: TH.chipBg }} aria-hidden="true">
          <div className="h-full w-1/4 rounded-full" style={{ background: TH.accent, animation: 'pcSlide 1.1s ease-in-out infinite' }} />
        </div>
      )}
      {/* سربرگ: آیکون + نماد + نامِ کامل + بازار + آیکون‌های عملیاتِ راست (سبکِ سرتیترِ نمادِ TV) */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <SymbolLogo symbol={symbol} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => { try { window.dispatchEvent(new CustomEvent('bn:openSearch')); } catch (e) {} }}
                title="تغییرِ نماد (جستجو)" className="font-extrabold text-[15px] leading-none tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
                style={{ color: TH.textStrong, background: 'transparent', border: 0, padding: 0 }} dir="ltr">{symbol}</button>
              <span className="text-[8.5px] font-bold uppercase tracking-[0.06em] shrink-0 px-1.5 py-0.5 rounded"
                style={{ color: TH.text, background: TH.chipBg }} dir="ltr">{meta.type}</span>
            </div>
            {/* نامِ کامل • بازار (سبکِ «Apple Inc • NASDAQ»ِ TV) */}
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              {name && <span className="text-[11px] truncate leading-tight" style={{ color: TH.text }}>{name}</span>}
              {meta.market && (
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] shrink-0" dir="ltr" style={{ color: TH.text }}>· {meta.market}</span>
              )}
            </div>
          </div>
          {/* آیکون‌های عملیاتِ TV: مقایسه / ویرایش / بیشتر (نشانه‌های بصری، hover کم‌رنگ) */}
          <div className="flex items-center gap-0.5 shrink-0 self-start" dir="ltr">
            {[
              <path key="a" d="M4 4h5v5H4zM11 11h5v5h-5zM4 13h5M11 4h5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
              <path key="b" d="M13.5 3.8l2.7 2.7-8 8H5.3v-2.9zM12.2 5.1l2.7 2.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />,
              <g key="c" fill="currentColor"><circle cx="4.5" cy="10" r="1.4" /><circle cx="10" cy="10" r="1.4" /><circle cx="15.5" cy="10" r="1.4" /></g>,
            ].map((g, i) => (
              <button key={i} type="button" title={['مقایسه (تغییرِ نماد)', 'ویرایشِ تنظیماتِ چارت', 'کپیِ قیمت'][i]}
                onClick={() => { try {
                  if (i === 0) window.dispatchEvent(new CustomEvent('bn:openSearch'));
                  else if (i === 1) window.dispatchEvent(new CustomEvent('bn:openChartSettings'));
                  else if (i === 2 && navigator.clipboard && ref != null) navigator.clipboard.writeText(String(fmt(ref)));
                } catch (e) {} }}
                className="grid place-items-center rounded transition-colors duration-[120ms] cursor-pointer"
                style={{ width: 24, height: 24, color: TH.text, opacity: 0.5, background: 'transparent', border: 0, padding: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBg; e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.5'; }}>
                <svg width="18" height="18" viewBox="0 0 20 20">{g}</svg>
              </button>
            ))}
          </div>
        </div>

        {/* قیمتِ بزرگ (رنگِ خنثی + فلَشِ گذرا) + ارزِ مظنه + تغییرِ روزِ رنگیِ ساده (سبکِ سرتیترِ TV) */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-2.5" dir="ltr">
          <Flash value={mid} dir={dir}
            className="text-[28px] font-extrabold tabular-nums leading-none tracking-tight rounded px-0.5 -mx-0.5 inline-block"
            style={{ color: TH.textStrong }}>
            {ref != null ? fmt(ref) : '—'}
          </Flash>
          {quoteCcy && ref != null && (
            <span className="text-[11px] font-semibold" style={{ color: TH.text }}>{quoteCcy}</span>
          )}
          {chgPct != null && (
            <span className="text-[12.5px] font-bold tabular-nums" style={{ color: chgCol }}>
              {chgAbs >= 0 ? '+' : ''}{fmt(chgAbs)}&nbsp;&nbsp;{chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
            </span>
          )}
        </div>
        {/* وضعیتِ بازار + زمانِ آخرین به‌روزرسانی (سبکِ «● Market open · Last update … GMT»ِ سرتیترِ TV).
            heuristic هم‌راستا با ردیف‌های واچ‌لیست: وجودِ midِ زندهٔ معتبر ⇒ بازار باز (نقطهٔ سبز)، نبودش ⇒ بسته (خاکستری). */}
        <div className="flex items-center gap-1.5 text-[10px] mt-1.5" dir="ltr">
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: mid != null ? (TH.upText || TH.up) : TH.text }}>
            <span className="inline-block rounded-full shrink-0" style={{ width: 6, height: 6, background: mid != null ? TH.up : TH.text, opacity: mid != null ? 1 : 0.45 }} />
            {mid != null ? 'بازار باز' : 'بازار بسته'}
          </span>
          {mid != null ? (
            <span style={{ color: TH.text }}>
              · آخرین به‌روزرسانی · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} GMT
            </span>
          ) : day?.t != null && (() => {
            // هم‌ترازِ «Last update at Jul 10, 23:59 GMT+0»ِ TV: تاریخ ماه‌اول (en-US) + زمانِ کندلِ آخر.
            // برای کندلِ روزانه (نیمه‌شبِ UTC) زمان گمراه‌کننده است ⇒ فقط تاریخ نشان داده می‌شود.
            const d = new Date(day.t * (day.t < 1e12 ? 1000 : 1));
            const dateStr = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' });
            const hhmm = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
            return (
              <span style={{ color: TH.text }}>
                · آخرین به‌روزرسانی · {hhmm === '00:00' ? dateStr : `${dateStr}, ${hhmm}`} GMT
              </span>
            );
          })()}
        </div>
      </div>

      {/* اسپارک‌لاینِ روندِ اخیر (~۹۰ روزِ بسته) — زیرِ بلوکِ قیمت، مثلِ مینی‌چارتِ Symbol Infoِ TV. رنگ: سبز اگر بالاتر از شروعِ بازه، وگرنه قرمز. */}
      {Array.isArray(yr?.closes) && yr.closes.length >= 4 && (() => {
        const cs = yr.closes;
        const min = Math.min(...cs), max = Math.max(...cs), span = (max - min) || 1;
        const W = 300, H = 40, pad = 3, n = cs.length;
        const pts = cs.map((v, i) => `${(pad + (i / (n - 1)) * (W - 2 * pad)).toFixed(1)},${(pad + (1 - (v - min) / span) * (H - 2 * pad)).toFixed(1)}`);
        const up = cs[n - 1] >= cs[0];
        const col = up ? TH.up : TH.down;
        return (
          <div className="mb-1.5 -mt-0.5" dir="ltr">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 40, display: 'block' }} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="bnSparkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={col} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={col} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`M ${pts[0]} L ${pts.join(' L ')} L ${(W - pad).toFixed(1)},${H} L ${pad},${H} Z`} fill="url(#bnSparkFill)" />
              <polyline points={pts.join(' ')} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        );
      })()}

      {/* کارتِ «حقایقِ کلیدی» (توصیفیِ سبکِ TV، تینتِ اکسنتِ بنفش) */}
      <div className="rounded-lg p-2.5 mb-1" style={{ background: tint(TH.accentAi, 0.10), border: `1px solid ${tint(TH.accentAi, 0.22)}` }}>
        <div className="flex items-center gap-1.5 mb-1">
          <svg width="13" height="13" viewBox="0 0 20 20" style={{ color: TH.accentAi }}>
            <path d="M10 2l1.6 4.6L16 8.2l-4.4 1.6L10 14l-1.6-4.2L4 8.2l4.4-1.6zM15.5 12l.7 2 .8-2 1.5-.6-1.5-.7-.8-1.9-.7 1.9-1.5.7z" fill="currentColor" />
          </svg>
          <span className="text-[11px] font-extrabold" style={{ color: TH.textStrong }}>حقایقِ کلیدی</span>
          <span className="text-[9px] uppercase tracking-[0.08em]" dir="ltr">Key facts</span>
        </div>
        <div className="text-[11px] leading-[1.7]" style={{ color: TH.text }}>{facts}</div>
        <div className="text-[11px] font-semibold mt-1.5 cursor-default" style={{ color: TH.accentText || TH.accent }}>بیشتر بخوانید ›</div>
      </div>

      {/* کارتِ «اخبار» (News سبکِ Symbol Infoِ TV) — آخرین خبرِ مرتبط؛ کلیک ⇒ منبع در تبِ جدید. فقط اگر خبری بود. */}
      {news && news.title && (
        <a
          href={news.url || undefined}
          target={news.url ? '_blank' : undefined}
          rel="noreferrer"
          className="block rounded-lg p-2.5 mb-1 no-underline transition-colors"
          style={{ background: TH.chipBg, border: `1px solid ${TH.border}`, cursor: news.url ? 'pointer' : 'default', color: 'inherit' }}
          title={news.title}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-extrabold" style={{ color: TH.textStrong }}>اخبار</span>
            <span className="text-[9px] uppercase tracking-[0.08em]" dir="ltr">News</span>
            {news.ts != null && <span className="text-[9.5px] mr-auto">{newsRelTime(news.ts)}</span>}
          </div>
          <div className="text-[11.5px] leading-[1.6] font-medium" style={{ color: TH.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{news.title}</div>
          {news.source && (
            <div className="text-[9.5px] font-semibold uppercase tracking-wide truncate mt-1" dir="ltr" style={{ color: TH.text }}>{news.source}</div>
          )}
        </a>
      )}

      {/* امتیازِ تکنیکال (Technical Ratingِ TV) — از میانگین‌ها + نوسان‌گرها؛ گِیجِ گرادیانی + برچسبِ خرید/فروش */}
      {(() => {
        // امتیازِ مؤثر: تایم‌فریمِ انتخابی (اگر بارگذاری شد) وگرنه امتیازِ چارت (prop).
        const eff = (ratingTf && tfRating) ? tfRating : techRating;
        if (!eff || !RATING_FA[eff.label]) return null;
        const rf = RATING_FA[eff.label];
        const pct = Math.max(2, Math.min(98, (eff.overall + 1) / 2 * 100));
        const mf = RATING_FA[eff.maLabel] || RATING_FA.neutral, of = RATING_FA[eff.oscLabel] || RATING_FA.neutral;
        return (
          <div className="rounded-lg p-2.5 mb-1" style={{ border: `1px solid ${TH.border}` }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-extrabold" style={{ color: TH.textStrong }}>امتیازِ تکنیکال</span>
              <span className="text-[9px] uppercase tracking-[0.08em]" dir="ltr">Technical Rating</span>
            </div>
            {/* انتخابگرِ تایم‌فریمِ امتیاز (Technical Rating TF selectorِ TV) — «چارت» = تایم‌فریمِ فعلیِ نمودار */}
            <div className="flex items-center gap-0.5 mb-1.5 flex-wrap" dir="ltr">
              {[[null, 'چارت'], ['M5', '5m'], ['M15', '15m'], ['H1', '1H'], ['H4', '4H'], ['D1', '1D']].map(([tf, lbl]) => {
                const on = (ratingTf || null) === tf;
                return (
                  <button key={lbl} onClick={() => setRatingTf(tf)} title={tf ? `امتیاز روی ${lbl}` : 'امتیاز روی تایم‌فریمِ چارت'}
                    className="px-1.5 h-5 rounded text-[9.5px] font-semibold tabular-nums transition-colors duration-[120ms]"
                    style={on ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{lbl}</button>
                );
              })}
            </div>
            {/* گِیجِ نیم‌دایره‌ایِ عقربه‌دار + برچسبِ ریتینگ زیرِ کمان — هم‌ترازِ گِیجِ «Technical Rating»ِ TV (به‌جای نوارِ افقی + چیپِ جدا). */}
            {(() => {
              const cx = 70, cy = 58, R = 50, Rn = 42;
              const th = (180 - pct * 1.8) * Math.PI / 180;   // pct=0 ⇒ چپ (فروشِ قوی)، ۵۰ ⇒ بالا (خنثی)، ۱۰۰ ⇒ راست (خریدِ قوی)
              const nx = cx + Rn * Math.cos(th), ny = cy - Rn * Math.sin(th);
              return (
                <svg viewBox="0 0 140 66" className="w-full" style={{ maxHeight: 70 }} dir="ltr" aria-hidden="true">
                  <defs>
                    <linearGradient id="bnTechGauge" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={RATING_FA.strongSell.color} />
                      <stop offset="50%" stopColor={RATING_FA.neutral.color} />
                      <stop offset="100%" stopColor={RATING_FA.strongBuy.color} />
                    </linearGradient>
                  </defs>
                  <path d={`M ${cx - R},${cy} A ${R},${R} 0 0 1 ${cx + R},${cy}`} fill="none" stroke="url(#bnTechGauge)" strokeWidth="7" strokeLinecap="round" />
                  {/* شکافِ ۵ ناحیه‌ای (فروشِ‌قوی·فروش·خنثی·خرید·خریدِ‌قوی) — ناچ‌های نازک به رنگِ پس‌زمینه، کمانِ گرادیانی را به ۵ بخشِ مجزا می‌شکند مثلِ سرعت‌سنجِ Technical Ratingِ TV */}
                  {[20, 40, 60, 80].map((b) => {
                    const tb = (180 - b * 1.8) * Math.PI / 180;
                    return <line key={b} x1={cx + (R - 5.5) * Math.cos(tb)} y1={cy - (R - 5.5) * Math.sin(tb)} x2={cx + (R + 5.5) * Math.cos(tb)} y2={cy - (R + 5.5) * Math.sin(tb)} stroke={TH.bg} strokeWidth="2.2" />;
                  })}
                  <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={rf.color} strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx={cx} cy={cy} r="4.5" fill={rf.color} />
                </svg>
              );
            })()}
            {/* برچسبِ دو سرِ کمان (فروش/خرید) — هم‌ترازِ گِیجِ Technical Ratingِ TV؛ HTML نه textِ SVG (فارسی بدچین می‌شود). چپ=فروش(قرمز)، راست=خرید(سبز). */}
            <div className="flex justify-between items-center px-2.5 -mt-2" dir="ltr">
              <span className="text-[11px] font-bold" style={{ color: RATING_FA.sell.color, opacity: 0.65 }}>فروش</span>
              <span className="text-[11px] font-bold" style={{ color: RATING_FA.neutral.color, opacity: 0.6 }}>خنثی</span>
              <span className="text-[11px] font-bold" style={{ color: RATING_FA.buy.color, opacity: 0.65 }}>خرید</span>
            </div>
            {/* برچسبِ ریتینگ زیرِ گِیج (RTLِ HTML — نه textِ SVG که فارسی را بدچین می‌کند) */}
            <div className="text-center -mt-0.5 mb-1"><span className="text-[15px] font-extrabold" style={{ color: rf.color }}>{rf.label}</span></div>
            {/* شمارشِ کلِ سیگنال‌ها (فروش · خنثی · خرید) — هم‌ترازِ ردیفِ خلاصهٔ زیرِ برچسبِ گِیجِ Technical Ratingِ TV؛ جمعِ میانگین‌ها+نوسان‌گرها. */}
            {(() => {
              const ts = (eff.maSell || 0) + (eff.oscSell || 0), tn = (eff.maNeutral || 0) + (eff.oscNeutral || 0), tb = (eff.maBuy || 0) + (eff.oscBuy || 0);
              return (
                <div className="flex items-stretch justify-center gap-1.5 mb-1.5" dir="rtl">
                  {[['فروش', ts, RATING_FA.sell.color], ['خنثی', tn, RATING_FA.neutral.color], ['خرید', tb, RATING_FA.buy.color]].map(([lbl, cnt, col]) => (
                    <div key={lbl} className="flex-1 rounded-md py-0.5 text-center" style={{ background: TH.chipBg }}>
                      <div className="text-[13px] font-extrabold tnum leading-none" style={{ color: col }}>{cnt}</div>
                      <div className="text-[8px] opacity-55 mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {/* تفکیکِ per-بخش سبکِ Technicalsِ TV: دو کارتِ «میانگین‌ها» و «نوسان‌گرها»، هرکدام با حکم + شمارشِ فروش·خنثی·خرید خودش. */}
            <div className="grid grid-cols-2 gap-1.5 mt-2" dir="rtl">
              {[
                { key: 'ma', title: 'میانگین‌ها', vf: mf, s: eff.maSell || 0, n: eff.maNeutral || 0, bq: eff.maBuy || 0 },
                { key: 'osc', title: 'نوسان‌گرها', vf: of, s: eff.oscSell || 0, n: eff.oscNeutral || 0, bq: eff.oscBuy || 0 },
              ].map((c) => (
                <div key={c.key} className="rounded-md px-1.5 py-1 text-center" style={{ background: TH.chipBg }}>
                  <div className="text-[10px] font-extrabold leading-tight" style={{ color: c.vf.color }}>{c.vf.label}</div>
                  <div className="text-[8.5px] opacity-55 mb-0.5">{c.title}</div>
                  <div className="flex items-center justify-center gap-1 text-[11px] tnum" title="فروش · خنثی · خرید">
                    <b style={{ color: RATING_FA.sell.color }}>{c.s}</b>
                    <span className="opacity-30">·</span>
                    <b style={{ color: RATING_FA.neutral.color }}>{c.n}</b>
                    <span className="opacity-30">·</span>
                    <b style={{ color: RATING_FA.buy.color }}>{c.bq}</b>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* نوارهای رنجِ روز و ۵۲ هفته (گِیجِ گرادیانِ سبکِ TV) */}
      <RangeBar title="بازهٔ روز" loVal={fmt(lo)} hiVal={fmt(hi)} p={pos} />
      <RangeBar title="بازهٔ ۵۲ هفته" loVal={pos52 != null ? fmt(lo52) : '—'} hiVal={pos52 != null ? fmt(hi52) : '—'} p={pos52} />

      {/* عملکردِ دوره‌ای (Performanceِ Symbol Infoِ TV): بازدهٔ 1W/1M/3M/6M/YTD/1Y — کاشی‌های رنگیِ سبز/قرمز. فقط وقتی داده آمده. */}
      {yr && yr.perf && Object.values(yr.perf).some((v) => v != null) && (
        <>
          <Label fa="عملکرد" en="Performance" />
          <div className="grid grid-cols-3 gap-1.5 mb-1">
            {/* «1D» عملکردِ روز = همان chgPctِ سرتیتر (منبعِ یکسان ⇒ سازگار)، مثلِ TV که Performance با 1D شروع می‌شود — #291 */}
            {[['1D', chgPct], ['1W', yr.perf.w1], ['1M', yr.perf.m1], ['3M', yr.perf.m3], ['6M', yr.perf.m6], ['YTD', yr.perf.ytd], ['1Y', yr.perf.y1]].map(([lbl, v]) => (
              <div key={lbl} className="rounded-lg border px-1 py-1.5 text-center" style={{ borderColor: TH.border, background: TH.subtle }}>
                <div className="text-[12px] font-bold tabular-nums" dir="ltr" style={{ color: v == null ? TH.text : v >= 0 ? TH.up : TH.down }}>{v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`}</div>
                <div className="text-[9px] opacity-50 mt-0.5" dir="ltr">{lbl}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* آمارِ کلیدی — باز/سقف/کف روز، حجم، بازهٔ ۵۲ هفته */}
      <Label fa="آمارِ کلیدی" en="Key stats" />
      <div className="rounded-lg border px-3 py-1" style={{ borderColor: TH.border, background: TH.subtle }}>
        {/* سقف/کفِ روز و ۵۲هفته در نوارهای «بازهٔ روز/۵۲ هفته» (با مقدارِ عددیِ دو سرِ نوار) نشان داده می‌شوند؛
            تکرارشان این‌جا حذف شد تا مثلِ TV هر بازه فقط یک‌بار بیاید (دکلوتر، بدونِ ازدست‌رفتنِ اطلاعات). */}
        <Row k="بستهٔ روزِ قبل" v={day?.prevClose != null ? fmt(day.prevClose) : '—'} />
        <Row k="بازشدنِ روز" v={fmt(day?.o)} />
        {/* حجم فقط اگر واقعی و ناصفر باشد (فارکس غیرِمتمرکز حجمِ حقیقی ندارد ⇒ «—» مثلِ TV، نه «۰») */}
        <Row k="حجمِ روز" v={day?.v ? compact(day.v) : '—'} />
        <Row k="میانگینِ حجم" v={yr?.avgVol ? compact(yr.avgVol) : '—'} last />
      </div>

      {/* بنیادی — نسبت‌ها و متریک‌های مالی از Finnhub (فقط سهامِ آمریکا؛ کریپتو/فارکس پنهان). */}
      {fund && fund.metrics && (() => {
        const m = fund.metrics;
        const n2 = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(2));
        const pc = (v) => (v == null || !Number.isFinite(Number(v)) ? '—' : `${Number(v).toFixed(2)}٪`);
        const rows = [
          ['نسبتِ قیمت به سود (P/E)', n2(m.peTTM)],
          ['سودِ هر سهم (EPS)', n2(m.epsTTM)],
          ['قیمت به ارزشِ دفتری (P/B)', n2(m.pbAnnual)],
          ['قیمت به فروش (P/S)', n2(m.psTTM)],
          ['بازدهِ حقوقِ صاحبان (ROE)', pc(m.roeTTM)],
          ['بازدهِ دارایی (ROA)', pc(m.roaTTM)],
          ['حاشیهٔ سودِ خالص', pc(m.netMarginTTM)],
          ['حاشیهٔ سودِ ناخالص', pc(m.grossMarginTTM)],
          ['درآمد به‌ازای هر سهم', n2(m.revenuePerShareTTM)],
          ['سودِ تقسیمی (Yield)', pc(m.dividendYieldTTM)],
          ['بتا (Beta)', n2(m.beta)],
          ['بدهی به حقوقِ صاحبان', n2(m.debtToEquity)],
          ['ارزشِ بازار', m.marketCap ? compact(m.marketCap) : '—'],
        ].filter((r) => r[1] !== '—');
        if (!rows.length) return null;
        return (
          <>
            <Label fa="بنیادی" en="Fundamentals" />
            <div className="rounded-lg border px-3 py-1" style={{ borderColor: TH.border, background: TH.subtle }}>
              {rows.map((r, i) => <Row key={r[0]} k={r[0]} v={r[1]} last={i === rows.length - 1} />)}
            </div>
          </>
        );
      })()}

      {/* مشخصاتِ معاملاتی — بید/اَسک/اسپرد */}
      <Label fa="مشخصاتِ معاملاتی" en="Quote" />
      <div className="rounded-lg border px-3 py-1" style={{ borderColor: TH.border, background: TH.subtle }}>
        <Row k="بید (Bid)" v={fmt(bid)} c={TH.down} />
        <Row k="اَسک (Ask)" v={fmt(ask)} c={TH.up} />
        <Row k="اسپرد" v={spread != null ? spread.toFixed(dec) : '—'} last />
      </div>

      {/* دربارهٔ نماد — مشخصاتِ قرارداد و بازار */}
      <Label fa="دربارهٔ نماد" en="About" />
      <div className="rounded-lg border px-3 py-1" style={{ borderColor: TH.border, background: TH.subtle }}>
        <Row k="نماد" v={symbol} />
        <Row k="نوعِ ابزار" v={meta.type} />
        {/* ارزِ مظنه + حداقلِ حرکتِ قیمت (mintick) — هم‌ترازِ فیلدهای Currency/Mintickِ دیالوگِ Symbol infoِ TV */}
        <Row k="ارزِ مظنه" v={quoteCcy || '—'} />
        <Row k="اندازهٔ قرارداد" v={meta.contract} />
        <Row k="حداقلِ حرکتِ قیمت" v={dec != null && Number.isFinite(dec) ? Math.pow(10, -dec).toFixed(Math.max(0, dec)) : '—'} />
        <Row k="جلسهٔ معاملاتی" v={meta.session} last />
      </div>

      {mid == null && (
        <div className="mt-3 text-[11px] text-center leading-5" style={{ color: TH.text, opacity: 0.6 }}>قیمتِ زنده هنوز دریافت نشده — هنگامِ بازشدنِ بازار به‌روز می‌شود.</div>
      )}
    </div>
  );
}
