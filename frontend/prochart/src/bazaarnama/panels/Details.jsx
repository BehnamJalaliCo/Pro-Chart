// جزئیات (Details) — مشخصاتِ نمادِ فعال: قیمتِ زنده، بید/اَسک، بازهٔ روز،
// اسپرد، تغییرِ روز و متادیتای ابزار. بدنهٔ یک تبِ پنلِ راست.
// props: { symbol, TH, symbols, prices }
// prices[sym] = { mid: string|number, dir: -1|0|1 }
// بازهٔ روز/تغییر از کندلِ روزانه (api.chart) خوانده می‌شود؛ نبودِ داده ⇐ حالتِ خالیِ تمیز.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import SymbolLogo from '../SymbolLogo';

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

export default function Details({ symbol, TH, prices = {} }) {
  const [day, setDay] = useState(null); // {o,h,l,c,v} کندلِ روز
  const [yr, setYr] = useState(null);   // {hi52,lo52,avgVol} از یک سالِ کندلِ روزانه
  const lp = prices[symbol];
  const mid = num(lp?.mid);
  const dir = lp?.dir || 0;

  // واکشیِ کندلِ روزانه برای بازهٔ روز و تغییرِ روز (+حجمِ روز اگر موجود)
  useEffect(() => {
    let on = true;
    setDay(null);
    if (!symbol) return;
    (async () => {
      try {
        const res = await api.chart(symbol, 'D1', undefined, 2);
        const cs = res?.candles || res?.data || res || [];
        const arr = Array.isArray(cs) ? cs : [];
        const last = arr[arr.length - 1];
        if (on && last && last.o != null) setDay({ o: last.o, h: last.h, l: last.l, c: last.c, v: last.v ?? last.volume ?? null });
      } catch { if (on) setDay(null); }
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
        if (on) setYr({
          hi52: Number.isFinite(hi52) ? hi52 : null,
          lo52: Number.isFinite(lo52) ? lo52 : null,
          avgVol: vN ? vSum / vN : null,
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

  // تغییرِ روز نسبت به openِ کندلِ روزانه
  const base = day?.o != null ? day.o : (day?.c ?? null);
  const ref = mid != null ? mid : (day?.c ?? null);
  const chgAbs = (base != null && ref != null) ? ref - base : null;
  const chgPct = (base && ref != null) ? (chgAbs / base) * 100 : null;
  const chgCol = chgPct == null ? TH.text : chgPct >= 0 ? TH.up : TH.down;
  // رنگِ نشانگرِ نوارِ رنج (جهتِ روز؛ نبودِ داده ⇐ اکسنت)
  const trendCol = chgPct == null ? TH.accent : chgPct >= 0 ? TH.up : TH.down;

  // موقعیتِ قیمت در بازهٔ روز (0..1) برای نوارِ بازه
  const lo = day?.l, hi = day?.h;
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
        <span className="text-[10px] tabular-nums shrink-0 w-14 text-right" style={{ color: TH.textStrong, opacity: 0.85 }}>{loVal}</span>
        <div className="relative flex-1 h-1.5 rounded-full"
          style={{ background: p == null ? TH.chipBg : `linear-gradient(90deg, ${TH.down}, ${TH.up})` }}>
          {p != null && (
            <span className="absolute top-1/2 rounded-full"
              style={{
                left: `${p * 100}%`, transform: 'translate(-50%,-50%)',
                width: 12, height: 12, background: TH.bg,
                border: `2.5px solid ${trendCol}`,
                boxShadow: '0 1px 3px rgba(0,0,0,.35)',
              }} />
          )}
        </div>
        <span className="text-[10px] tabular-nums shrink-0 w-14 text-left" style={{ color: TH.textStrong, opacity: 0.85 }}>{hiVal}</span>
      </div>
    </div>
  );

  if (!symbol) return (
    <div className="h-full flex items-center justify-center p-6 text-[11px] opacity-40 text-center">نمادی انتخاب نشده.</div>
  );

  return (
    <div className="p-3 text-xs" style={{ color: TH.text, fontVariantNumeric: 'tabular-nums' }}>
      {/* سربرگ: آیکون + نماد + نامِ کامل + بازار + آیکون‌های عملیاتِ راست (سبکِ سرتیترِ نمادِ TV) */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <SymbolLogo symbol={symbol} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[15px] leading-none tracking-tight" style={{ color: TH.textStrong }} dir="ltr">{symbol}</span>
              <span className="text-[8.5px] font-bold uppercase tracking-[0.06em] shrink-0 px-1.5 py-0.5 rounded"
                style={{ color: TH.text, background: TH.chipBg }} dir="ltr">{meta.type}</span>
            </div>
            {/* نامِ کامل • بازار (سبکِ «Apple Inc • NASDAQ»ِ TV) */}
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              {name && <span className="text-[11px] truncate leading-tight" style={{ color: TH.text }}>{name}</span>}
              {meta.market && (
                <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em] shrink-0 opacity-55" dir="ltr" style={{ color: TH.text }}>· {meta.market}</span>
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
              <span key={i} title={['مقایسه', 'ویرایش', 'بیشتر'][i]}
                className="grid place-items-center rounded transition-colors duration-[120ms] cursor-default"
                style={{ width: 24, height: 24, color: TH.text, opacity: 0.5 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBg; e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.5'; }}>
                <svg width="18" height="18" viewBox="0 0 20 20">{g}</svg>
              </span>
            ))}
          </div>
        </div>

        {/* قیمتِ بزرگ (رنگِ خنثی + فلَشِ گذرا) + ارزِ مظنه + تغییرِ روزِ رنگیِ ساده (سبکِ سرتیترِ TV) */}
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-2.5" dir="ltr">
          <Flash value={mid} dir={dir}
            className="text-[28px] font-extrabold tabular-nums leading-none tracking-tight rounded px-0.5 -mx-0.5 inline-block"
            style={{ color: TH.textStrong }}>
            {mid != null ? fmt(mid) : '—'}
          </Flash>
          {quoteCcy && mid != null && (
            <span className="text-[11px] font-semibold" style={{ color: TH.text }}>{quoteCcy}</span>
          )}
          {chgPct != null && (
            <span className="text-[12.5px] font-bold tabular-nums" style={{ color: chgCol }}>
              {chgAbs >= 0 ? '+' : ''}{fmt(chgAbs)}&nbsp;&nbsp;{chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%
            </span>
          )}
        </div>
        {/* زمانِ آخرین به‌روزرسانی (سبکِ «Last update at … GMT»ِ TV) */}
        {mid != null && (
          <div className="text-[10px] mt-1.5 opacity-55" style={{ color: TH.text }} dir="ltr">
            آخرین به‌روزرسانی · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} GMT
          </div>
        )}
      </div>

      {/* کارتِ «حقایقِ کلیدی» (توصیفیِ سبکِ TV، تینتِ اکسنتِ بنفش) */}
      <div className="rounded-lg p-2.5 mb-1" style={{ background: tint(TH.accentAi, 0.10), border: `1px solid ${tint(TH.accentAi, 0.22)}` }}>
        <div className="flex items-center gap-1.5 mb-1">
          <svg width="13" height="13" viewBox="0 0 20 20" style={{ color: TH.accentAi }}>
            <path d="M10 2l1.6 4.6L16 8.2l-4.4 1.6L10 14l-1.6-4.2L4 8.2l4.4-1.6zM15.5 12l.7 2 .8-2 1.5-.6-1.5-.7-.8-1.9-.7 1.9-1.5.7z" fill="currentColor" />
          </svg>
          <span className="text-[11px] font-extrabold" style={{ color: TH.textStrong }}>حقایقِ کلیدی</span>
          <span className="text-[9px] uppercase tracking-[0.08em] opacity-40" dir="ltr">Key facts</span>
        </div>
        <div className="text-[11px] leading-[1.7]" style={{ color: TH.text }}>{facts}</div>
        <div className="text-[10px] font-semibold mt-1.5 cursor-default" style={{ color: TH.accent }}>بیشتر بخوانید ›</div>
      </div>

      {/* نوارهای رنجِ روز و ۵۲ هفته (گِیجِ گرادیانِ سبکِ TV) */}
      <RangeBar title="بازهٔ روز" loVal={fmt(lo)} hiVal={fmt(hi)} p={pos} />
      <RangeBar title="بازهٔ ۵۲ هفته" loVal={pos52 != null ? fmt(lo52) : '—'} hiVal={pos52 != null ? fmt(hi52) : '—'} p={pos52} />

      {/* آمارِ کلیدی — باز/سقف/کف روز، حجم، بازهٔ ۵۲ هفته */}
      <Label fa="آمارِ کلیدی" en="Key stats" />
      <div className="rounded-lg border px-3 py-1" style={{ borderColor: TH.border, background: TH.subtle }}>
        <Row k="بازشدنِ روز" v={fmt(day?.o)} />
        <Row k="بالاترینِ روز" v={fmt(hi)} c={TH.up} />
        <Row k="پایین‌ترینِ روز" v={fmt(lo)} c={TH.down} />
        <Row k="حجمِ روز" v={compact(day?.v) ?? '—'} />
        <Row k="میانگینِ حجم" v={compact(yr?.avgVol) ?? '—'} />
        <Row k="بالاترینِ ۵۲ هفته" v={hi52 != null ? fmt(hi52) : '—'} />
        <Row k="پایین‌ترینِ ۵۲ هفته" v={lo52 != null ? fmt(lo52) : '—'} last />
      </div>

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
        <Row k="اندازهٔ قرارداد" v={meta.contract} />
        <Row k="جلسهٔ معاملاتی" v={meta.session} last />
      </div>

      {mid == null && (
        <div className="mt-3 text-[10px] text-center leading-5" style={{ color: TH.down, opacity: 0.7 }}>قیمتِ زنده هنوز دریافت نشده — هنگامِ بازشدنِ بازار به‌روز می‌شود.</div>
      )}
    </div>
  );
}
