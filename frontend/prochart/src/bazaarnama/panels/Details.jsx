// جزئیات (Details) — مشخصاتِ نمادِ فعال: قیمتِ زنده، بید/اَسک، بازهٔ روز،
// اسپرد، تغییرِ روز و متادیتای ابزار. بدنهٔ یک تبِ پنلِ راست.
// props: { symbol, TH, symbols, prices }
// prices[sym] = { mid: string|number, dir: -1|0|1 }
// بازهٔ روز/تغییر از کندلِ روزانه (api.chart) خوانده می‌شود؛ نبودِ داده ⇐ حالتِ خالیِ تمیز.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };

// متادیتای ایستا برای انواعِ ابزار (وقتی spec دقیق نداریم، گرافِ‌ول degrade)
function metaFor(symbol = '') {
  const s = symbol.toUpperCase();
  if (/BTC|ETH|USDT|SOL|XRP|DOGE|BNB|ADA/.test(s)) return { type: 'رمزارز', contract: '۱', session: '۲۴/۷' };
  if (/XAU|GOLD/.test(s)) return { type: 'فلزِ گران‌بها (طلا)', contract: '۱۰۰', session: 'لندن/نیویورک' };
  if (/XAG|SILVER/.test(s)) return { type: 'فلزِ گران‌بها (نقره)', contract: '۵۰۰۰', session: 'لندن/نیویورک' };
  if (/OIL|WTI|BRENT|USOIL/.test(s)) return { type: 'انرژی (نفت)', contract: '۱۰۰۰', session: 'نیویورک' };
  if (/US30|NAS|SPX|GER|DAX|UK100|JPN/.test(s)) return { type: 'شاخص', contract: '۱', session: 'بورسِ مربوطه' };
  if (/^[A-Z]{6}$/.test(s)) return { type: 'جفت‌ارز (فارکس)', contract: '۱۰۰٬۰۰۰', session: 'سیدنی→نیویورک' };
  return { type: 'ابزار', contract: '—', session: '—' };
}

// شمارشِ ارقامِ اعشار برای نمایشِ هم‌ترازِ بید/اَسک
function decimals(mid) { const s = String(mid ?? ''); return s.includes('.') ? s.split('.')[1].length : 2; }

export default function Details({ symbol, TH, prices = {} }) {
  const [day, setDay] = useState(null); // {o,h,l,c} کندلِ روز
  const [year, setYear] = useState(null); // {hi,lo} بازهٔ ۵۲ هفته
  const [perf, setPerf] = useState(null); // {w,m} تغییرِ ۱ هفته / ۱ ماه (درصد)
  const lp = prices[symbol];
  const mid = num(lp?.mid);
  const dir = lp?.dir || 0;

  // واکشیِ کندلِ روزانه برای بازهٔ روز و تغییرِ روز
  useEffect(() => {
    let on = true;
    setDay(null); setYear(null); setPerf(null);
    if (!symbol) return;
    (async () => {
      try {
        // ~۵۲ هفته کندلِ روزانه — هم برای بازهٔ روز (آخرین) هم سقف/کفِ سالانه
        const res = await api.chart(symbol, 'D1', undefined, 260);
        const cs = res?.candles || res?.data || res || [];
        const arr = Array.isArray(cs) ? cs : [];
        const last = arr[arr.length - 1];
        if (on && last && last.o != null) setDay({ o: last.o, h: last.h, l: last.l, c: last.c });
        if (on && arr.length) {
          let hi = -Infinity, lo = Infinity;
          for (const c of arr) { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; }
          if (Number.isFinite(hi)) setYear({ hi, lo });
          // تغییرِ ۱ هفته (~۵ کندلِ روزانه) و ۱ ماه (~۲۲ کندل)
          const lastC = last && last.c != null ? last.c : null;
          const wAgo = arr[arr.length - 6]; const mAgo = arr[arr.length - 23];
          const w = (lastC != null && wAgo && wAgo.c) ? ((lastC - wAgo.c) / wAgo.c) * 100 : null;
          const m = (lastC != null && mAgo && mAgo.c) ? ((lastC - mAgo.c) / mAgo.c) * 100 : null;
          setPerf({ w, m });
        }
      } catch { if (on) { setDay(null); setYear(null); } }
    })();
    return () => { on = false; };
  }, [symbol]);

  const meta = useMemo(() => metaFor(symbol), [symbol]);
  const dec = decimals(lp?.mid);
  const fmt = (v) => (v == null ? '—' : Number(v).toFixed(dec));

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

  // موقعیتِ قیمت در بازهٔ روز (0..1) برای نوارِ بازه
  const lo = day?.l, hi = day?.h;
  const pos = (lo != null && hi != null && hi > lo && ref != null)
    ? Math.max(0, Math.min(1, (ref - lo) / (hi - lo))) : null;

  const Row = ({ k, v, c, last }) => (
    <div className="flex items-center justify-between gap-3 py-1.5" style={{ borderBottom: last ? 'none' : `1px solid ${TH.border}` }}>
      <span className="opacity-60 truncate">{k}</span>
      <span className="tabular-nums font-medium whitespace-nowrap" dir="ltr" style={{ color: c || TH.textStrong }}>{v}</span>
    </div>
  );

  if (!symbol) return (
    <div className="h-full flex items-center justify-center p-6 text-[11px] opacity-40 text-center">نمادی انتخاب نشده.</div>
  );

  return (
    <div className="p-3.5 text-xs" style={{ color: TH.text, fontVariantNumeric: 'tabular-nums' }}>
      {/* سربرگ: نماد + قیمتِ زنده + تغییرِ روز */}
      <div className="mb-3.5 pb-3" style={{ borderBottom: `1px solid ${TH.border}` }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-bold text-sm tracking-wide" style={{ color: TH.textStrong }} dir="ltr">{symbol}</span>
          <span className="text-[10px] opacity-50 truncate">{meta.type}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-1.5" dir="ltr">
          <span className="text-xl font-bold tabular-nums tracking-tight" style={{ color: dir > 0 ? TH.up : dir < 0 ? TH.down : TH.textStrong }}>
            {mid != null ? fmt(mid) : '—'}
          </span>
          {chgPct != null && (
            <span className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded" style={{ color: chgCol, background: TH.chipBg }}>
              {chgAbs >= 0 ? '+' : ''}{fmt(chgAbs)} ({chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* نوارِ بازهٔ روز */}
      <div className="mb-3.5">
        <div className="flex items-center justify-between text-[10px] opacity-60 mb-1.5">
          <span className="font-medium">بازهٔ روز</span>
          <span dir="ltr" className="tabular-nums font-medium">{fmt(lo)} – {fmt(hi)}</span>
        </div>
        <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: TH.chipBg }}>
          {pos != null && (
            <>
              <div className="absolute inset-y-0 right-0" style={{ width: `${(1 - pos) * 100}%`, background: TH.accent, opacity: 0.25 }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{ right: `calc(${(1 - pos) * 100}% - 3px)`, background: dir < 0 ? TH.down : TH.up }} />
            </>
          )}
        </div>
      </div>

      {/* مشخصاتِ معاملاتی */}
      <div className="text-[10px] font-semibold opacity-50 mb-1.5 px-0.5">مشخصاتِ معاملاتی</div>
      <div className="rounded-lg border px-3 py-1" style={{ borderColor: TH.border, background: TH.subtle }}>
        <Row k="بید (Bid)" v={fmt(bid)} c={TH.down} />
        <Row k="اَسک (Ask)" v={fmt(ask)} c={TH.up} />
        <Row k="اسپرد" v={spread != null ? spread.toFixed(dec) : '—'} />
        <Row k="بالاترینِ روز" v={fmt(hi)} />
        <Row k="پایین‌ترینِ روز" v={fmt(lo)} />
        <Row k="بازشدنِ روز" v={fmt(day?.o)} />
        <Row k="بالاترینِ ۵۲ هفته" v={fmt(year?.hi)} c={TH.up} />
        <Row k="پایین‌ترینِ ۵۲ هفته" v={fmt(year?.lo)} c={TH.down} />
        <Row k="تغییرِ ۱ هفته" v={perf?.w != null ? `${perf.w >= 0 ? '+' : ''}${perf.w.toFixed(2)}%` : '—'} c={perf?.w == null ? TH.text : perf.w >= 0 ? TH.up : TH.down} />
        <Row k="تغییرِ ۱ ماه" v={perf?.m != null ? `${perf.m >= 0 ? '+' : ''}${perf.m.toFixed(2)}%` : '—'} c={perf?.m == null ? TH.text : perf.m >= 0 ? TH.up : TH.down} last />
      </div>

      {/* متادیتای ابزار */}
      <div className="text-[10px] font-semibold opacity-50 mt-3.5 mb-1.5 px-0.5">مشخصاتِ ابزار</div>
      <div className="rounded-lg border px-3 py-1" style={{ borderColor: TH.border, background: TH.subtle }}>
        <Row k="نوعِ ابزار" v={meta.type} />
        <Row k="اندازهٔ قرارداد" v={meta.contract} />
        <Row k="جلسهٔ معاملاتی" v={meta.session} last />
      </div>

      {mid == null && (
        <div className="mt-3.5 text-[10px] text-center leading-5 rounded-lg border px-3 py-2" style={{ color: TH.down, borderColor: TH.border, background: TH.subtle, opacity: 0.85 }}>قیمتِ زنده هنوز دریافت نشده — هنگامِ بازشدنِ بازار به‌روز می‌شود.</div>
      )}
    </div>
  );
}
