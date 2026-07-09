// جزئیات (Details) — مشخصاتِ نمادِ فعال: قیمتِ زنده، بید/اَسک، بازهٔ روز،
// اسپرد، تغییرِ روز و متادیتای ابزار. بدنهٔ یک تبِ پنلِ راست.
// props: { symbol, TH, symbols, prices }
// prices[sym] = { mid: string|number, dir: -1|0|1 }
// بازهٔ روز/تغییر از کندلِ روزانه (api.chart) خوانده می‌شود؛ نبودِ داده ⇐ حالتِ خالیِ تمیز.
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';

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

  // بازهٔ ۵۲ هفته + موقعیتِ قیمت درونِ آن
  const lo52 = yr?.lo52 != null ? Math.min(yr.lo52, lo != null ? lo : yr.lo52) : null;
  const hi52 = yr?.hi52 != null ? Math.max(yr.hi52, hi != null ? hi : yr.hi52) : null;
  const pos52 = (lo52 != null && hi52 != null && hi52 > lo52 && ref != null)
    ? Math.max(0, Math.min(1, (ref - lo52) / (hi52 - lo52))) : null;

  const Row = ({ k, v, c, last }) => (
    <div className="flex items-center justify-between py-1" style={{ borderBottom: last ? 'none' : `1px solid ${TH.border}` }}>
      <span className="opacity-60">{k}</span>
      <span className="tabular-nums" dir="ltr" style={{ color: c || TH.textStrong }}>{v}</span>
    </div>
  );

  // سرتیترِ بخش هم‌ترازِ TV: عنوانِ فارسی + برچسبِ انگلیسیِ کم‌رنگ
  const Label = ({ fa, en }) => (
    <div className="flex items-baseline gap-1.5 mb-1 mt-3">
      <span className="text-[11px] font-bold" style={{ color: TH.textStrong }}>{fa}</span>
      <span className="text-[9px] uppercase tracking-wide opacity-40" dir="ltr">{en}</span>
    </div>
  );

  if (!symbol) return (
    <div className="h-full flex items-center justify-center p-6 text-[11px] opacity-40 text-center">نمادی انتخاب نشده.</div>
  );

  return (
    <div className="p-3 text-xs" style={{ color: TH.text, fontVariantNumeric: 'tabular-nums' }}>
      {/* سربرگ: نماد + قیمتِ زنده + تغییرِ روز */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between">
          <span className="font-bold text-sm" style={{ color: TH.textStrong }} dir="ltr">{symbol}</span>
          <span className="text-[10px] opacity-50">{meta.type}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-1" dir="ltr">
          <span className="text-lg font-bold tabular-nums" style={{ color: dir > 0 ? TH.up : dir < 0 ? TH.down : TH.textStrong }}>
            {mid != null ? fmt(mid) : '—'}
          </span>
          {chgPct != null && (
            <span className="text-[11px] tabular-nums" style={{ color: chgCol }}>
              {chgAbs >= 0 ? '+' : ''}{fmt(chgAbs)} ({chgPct >= 0 ? '+' : ''}{chgPct.toFixed(2)}%)
            </span>
          )}
        </div>
      </div>

      {/* نوارِ بازهٔ روز */}
      <div className="mb-1">
        <div className="flex items-center justify-between text-[10px] opacity-60 mb-1">
          <span>بازهٔ روز</span>
          <span dir="ltr" className="tabular-nums">{fmt(lo)} – {fmt(hi)}</span>
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

      {/* نوارِ بازهٔ ۵۲ هفته */}
      <div className="mb-1">
        <div className="flex items-center justify-between text-[10px] opacity-60 mb-1">
          <span>بازهٔ ۵۲ هفته</span>
          <span dir="ltr" className="tabular-nums">{pos52 != null ? `${fmt(lo52)} – ${fmt(hi52)}` : '—'}</span>
        </div>
        <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: TH.chipBg }}>
          {pos52 != null && (
            <>
              <div className="absolute inset-y-0 right-0" style={{ width: `${(1 - pos52) * 100}%`, background: TH.accent, opacity: 0.18 }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{ right: `calc(${(1 - pos52) * 100}% - 3px)`, background: dir < 0 ? TH.down : TH.up }} />
            </>
          )}
        </div>
      </div>

      {/* آمارِ کلیدی — باز/سقف/کف روز، حجم، بازهٔ ۵۲ هفته */}
      <Label fa="آمارِ کلیدی" en="Key stats" />
      <div className="rounded-md border px-2.5 py-0.5" style={{ borderColor: TH.border, background: TH.subtle }}>
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
      <div className="rounded-md border px-2.5 py-0.5" style={{ borderColor: TH.border, background: TH.subtle }}>
        <Row k="بید (Bid)" v={fmt(bid)} c={TH.down} />
        <Row k="اَسک (Ask)" v={fmt(ask)} c={TH.up} />
        <Row k="اسپرد" v={spread != null ? spread.toFixed(dec) : '—'} last />
      </div>

      {/* حقایقِ کلیدی — مشخصاتِ قرارداد و بازار */}
      <Label fa="حقایقِ کلیدی" en="Key facts" />
      <div className="rounded-md border px-2.5 py-0.5" style={{ borderColor: TH.border, background: TH.subtle }}>
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
