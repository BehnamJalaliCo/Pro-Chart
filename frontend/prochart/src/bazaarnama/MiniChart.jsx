import React, { useEffect, useId, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { REGISTRY } from './indicators';
import { api } from '../api/client';
import { useApp } from '../appStore';
import { priceDigits } from './symbolMeta';

// جداکنندهٔ هزارگان روی محورِ قیمت + برچسبِ آخرِ MiniChart — هم‌راستا با چارتِ اصلی و TradingView.
const grp = (v, d) => Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const grpFmt = (d) => ({ type: 'custom', minMove: Math.pow(10, -d), formatter: (p) => (p == null || !Number.isFinite(Number(p)) ? '' : grp(p, d)) });

// پالتِ روشن/تیره هم‌ترازِ TradingView (توکن‌های --pc-* از نقشهٔ راه).
// سبز/قرمزِ کندل teal/red؛ متنِ off-white در تیره، #131722 در روشن؛ گریدِ بسیار کم‌رنگ.
const PAL = {
  dark:  { bg: '#131722', grid: 'rgba(255,255,255,.06)', text: '#d1d4dc', border: '#2a2e39', cross: '#9598a1', up: '#089981', down: '#f23645' },
  light: { bg: '#ffffff', grid: 'rgba(0,0,0,.06)',       text: '#131722', border: '#e0e3eb', cross: '#9598a1', up: '#089981', down: '#f23645' },
};
const TH = PAL.dark; // سازگاریِ عقب‌رو (پیش‌فرضِ تیره)

// تایم‌فریم‌های per-cell (P2.2): فقط نیتیوهای بک‌اند (پایه‌های DERIVED_TFِ چارتِ اصلی) تا MiniChart
// بدونِ منطقِ resample مستقیم fetch کند. tfِ ارثی اگر خارجِ این لیست بود، پویا اضافه می‌شود.
const CELL_TFS = [['M1', '1m'], ['M5', '5m'], ['M15', '15m'], ['H1', '1H'], ['H4', '4H'], ['D1', '1D']];

// ── اسپارک‌لاینِ ردیفِ واچ‌لیست (سبکِ TradingView) ──────────────────────────
// خطِ کوچکِ روند به‌صورتِ ستونِ اختیاری در واچ‌لیست: SVG سبک، بی‌لرزش، تم‌آگاه، شارپ.
// رنگِ سبز/قرمز از همان پالتِ کندلِ این چارت گرفته می‌شود تا هم‌خانواده بماند.
//   data: آرایهٔ اعداد (بسته‌شدن‌ها).  up: اختیاری؛ اگر نیامد از خودِ داده استنتاج می‌شود.
//   stroke: بازنویسیِ رنگ.  fill: پرکردنِ گرادیانتیِ کم‌رنگِ زیرِ خط (حسِ TV).
//   smooth: هموارسازیِ نرمِ کاتمول-رام (بی‌اورشوت).  dot: نقطهٔ پایانیِ برجسته.
export function Sparkline({ data, up, width = 56, height = 22, stroke, fill = true, smooth = true, dot = false }) {
  const theme = useApp((s) => s.theme) || 'light';
  const uid = useId(); // شناسهٔ یکتای گرادیانت — جلوگیری از تداخلِ چند اسپارک‌لاین در یک صفحه
  const th = PAL[theme] || PAL.dark;
  const isDark = theme === 'dark';
  // فضای ثابت رزرو می‌شود حتی وقتی داده نیست → بی‌جهش/بی‌لرزش در ردیف.
  if (!data || data.length < 2) return <svg width={width} height={height} style={{ display: 'block', flex: '0 0 auto' }} aria-hidden="true" />;
  const rise = up != null ? up : data[data.length - 1] >= data[0]; // روندِ کلی: آخر vs اول
  const unchanged = up == null && data[data.length - 1] === data[0]; // بی‌تغییر → خاکستریِ خنثی (سبکِ TV)
  const col = stroke || (unchanged ? th.cross : rise ? th.up : th.down);
  const pad = 2, lastI = data.length - 1;
  let min = data[0], max = data[0];
  for (let i = 1; i < data.length; i++) { const v = data[i]; if (v < min) min = v; else if (v > max) max = v; }
  const flat = max === min;              // سریِ صاف → خطِ افقیِ مرکزی (مثلِ TV، نه چسبیده به کف)
  const rng = flat ? 1 : (max - min);
  const stepX = (width - pad * 2) / lastI;
  const topY = pad, botY = height - pad, innerH = height - pad * 2;
  const clampY = (y) => (y < topY ? topY : y > botY ? botY : y); // مهارِ کنترل‌پوینت‌ها → بی‌اورشوت
  const xs = [], ys = [];
  for (let i = 0; i < data.length; i++) { xs.push(pad + i * stepX); ys.push(flat ? topY + innerH / 2 : botY - ((data[i] - min) / rng) * innerH); }
  // مسیرِ خط: پلی‌لاینِ تیز، یا منحنیِ نرمِ کاتمول-رام→بزیه با کنترلِ مهارشده
  let linePath = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`;
  if (smooth && data.length > 2) {
    for (let i = 0; i < lastI; i++) {
      const x0 = xs[i - 1 < 0 ? 0 : i - 1], y0 = ys[i - 1 < 0 ? 0 : i - 1];
      const x1 = xs[i], y1 = ys[i];
      const x2 = xs[i + 1], y2 = ys[i + 1];
      const x3 = xs[i + 2 > lastI ? lastI : i + 2], y3 = ys[i + 2 > lastI ? lastI : i + 2];
      const c1x = x1 + (x2 - x0) / 6, c1y = clampY(y1 + (y2 - y0) / 6);
      const c2x = x2 - (x3 - x1) / 6, c2y = clampY(y2 - (y3 - y1) / 6);
      linePath += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
    }
  } else {
    for (let i = 1; i < data.length; i++) linePath += ` L ${xs[i].toFixed(2)} ${ys[i].toFixed(2)}`;
  }
  const b = botY.toFixed(2);
  const areaPath = `${linePath} L ${xs[lastI].toFixed(2)} ${b} L ${xs[0].toFixed(2)} ${b} Z`;
  const gid = `sl-${uid}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" shapeRendering="geometricPrecision" style={{ display: 'block', flex: '0 0 auto' }} aria-hidden="true">
      {fill && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity={isDark ? 0.28 : 0.20} />
            <stop offset="100%" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={areaPath} fill={`url(#${gid})`} stroke="none" />}
      <path d={linePath} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {dot && <circle cx={xs[lastI].toFixed(2)} cy={ys[lastI].toFixed(2)} r="1.7" fill={col} stroke={th.bg} strokeWidth="0.9" />}
    </svg>
  );
}

// چارتِ کوچکِ مستقل برای حالتِ چند-چارت (هر کدام نماد + تایم‌فریمِ خود)
export default function MiniChart({ symbols = [], tf, initial, syncBus = null, syncSymbol = false, syncTime = true, syncCrosshair = true, overlays = [] }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const ovSeriesRef = useRef([]); // سری‌های اورلیِ اندیکاتور (فاز ۷.۱ — سلول‌ها اندیکاتورِ چارتِ اصلی را نشان می‌دهند)
  const volRef = useRef(null);       // هیستوگرامِ حجم (P2.2) — اسکیلِ اورلیِ 'vol'، ۱۸٪ پایینِ سلول مثلِ چارتِ اصلی
  const lastRawRef = useRef(null);   // آخرین کندل‌های خام — برای بازرنگ‌آمیزیِ حجم هنگامِ تعویضِ تم (بدونِ fetchِ دوباره)
  const priceLinesRef = useRef([]);  // خطوطِ افقیِ فقط-خواندنیِ ترسیم‌های ذخیره‌شدهٔ نماد (P2.2)
  const theme = useApp((s) => s.theme) || 'light';
  const th = PAL[theme] || PAL.dark;
  const [symbol, setSymbol] = useState(initial || 'EURUSD');
  // تایم‌فریمِ per-cell (P2.2): null ⇒ پیرویِ زنده از تایم‌فریمِ چارتِ اصلی (رفتارِ قبلی)؛ انتخابِ دستی ⇒ مستقل.
  const [tfSel, setTfSel] = useState(null);
  const effTf = tfSel || tf;
  const syncSymRef = useRef(syncSymbol); syncSymRef.current = syncSymbol; // آینهٔ زندهٔ تاگلِ سینکِ نماد (برای onMsgِ subscribe-once)
  const syncTimeRef = useRef(syncTime); syncTimeRef.current = syncTime;    // تاگلِ سینکِ زمان/اسکرول بینِ سلول‌ها
  const syncCrossRef = useRef(syncCrosshair); syncCrossRef.current = syncCrosshair; // تاگلِ سینکِ کراس‌هیر بینِ سلول‌ها
  const [last, setLast] = useState(null);
  const [dir, setDir] = useState(null); // 'up' | 'down' | null — رنگِ برچسبِ قیمت بر اساسِ روند
  const barsRef = useRef(0); // تعدادِ کندلِ بارشده — برای نگاشتِ رنجِ منطقیِ سینک بینِ چارت‌هایی با طولِ دادهٔ متفاوت

  useEffect(() => {
    if (!elRef.current) return;
    const chart = createChart(elRef.current, {
      layout: { background: { color: th.bg }, textColor: th.text, fontFamily: 'IRANYekanX, Ravagh, AnjomanMax, Vazirmatn, sans-serif', fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: th.grid }, horzLines: { color: th.grid } },
      timeScale: { timeVisible: true, borderColor: th.border },
      rightPriceScale: { borderColor: th.border },
      width: elRef.current.clientWidth, height: elRef.current.clientHeight,
      crosshair: { mode: 0, vertLine: { color: th.cross, width: 1, style: 3 }, horzLine: { color: th.cross, width: 1, style: 3 } },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, { upColor: th.up, downColor: th.down, borderUpColor: th.up, borderDownColor: th.down, wickUpColor: th.up, wickDownColor: th.down });
    // حجم (P2.2): هیستوگرام روی اسکیلِ اورلیِ 'vol' با حاشیهٔ ۸۲٪ بالا ⇒ فقط ~۱۸٪ پایینِ سلول —
    // همان الگوی applyVolumeِ چارتِ اصلی؛ مقیاسِ قیمتِ اصلی فشرده نمی‌شود.
    try {
      const v = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
      try { v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } }); } catch (e) { /* noop */ }
      volRef.current = v;
    } catch (e) { volRef.current = null; }
    const ro = new ResizeObserver(() => { if (elRef.current && chartRef.current) chartRef.current.applyOptions({ width: elRef.current.clientWidth, height: elRef.current.clientHeight }); });
    ro.observe(elRef.current);
    // ── همگام‌سازیِ چندچارتی (زمان + کراس‌هیر) مثلِ TradingView ──
    let applying = false, unsub = null;
    if (syncBus) {
      const onMsg = (type, payload) => {
        if (!chartRef.current) return; applying = true;
        try {
          // نگاشتِ رنجِ منطقی بر مبنای «فاصله از آخرین کندل»: چارتِ اصلی تاریخچهٔ lazy-load شدهٔ بلندتری دارد
          // (مثلاً ۱۵۰۰ کندل در برابرِ ۴۰۰ کندلِ سلول) و اندیسِ خام پنجره را به قدیمی‌ترین کندل‌ها می‌انداخت.
          // طولِ برابر ⇒ off صفر ⇒ دقیقاً رفتارِ قبلیِ سلول↔سلول (بدونِ رگرسیون).
          if (type === 'time' && payload) { if (syncTimeRef.current && payload.len > 0 && barsRef.current > 0) { const off = barsRef.current - payload.len; chartRef.current.timeScale().setVisibleLogicalRange({ from: payload.from + off, to: payload.to + off }); } }
          else if (type === 'cross') { if (syncCrossRef.current) { if (payload && payload.time != null) chartRef.current.setCrosshairPosition(payload.value || 0, payload.time, seriesRef.current); else chartRef.current.clearCrosshairPosition(); } }
          // سینکِ نماد (لینکِ چند-چارتِ TV): وقتی تاگل روشن است، همهٔ سلول‌ها نمادِ منتشرشده را می‌گیرند. setSymbol باعثِ echo نمی‌شود.
          else if (type === 'symbol' && syncSymRef.current && payload) setSymbol(payload);
        } catch (e) {}
        applying = false;
      };
      unsub = syncBus.subscribe(onMsg);
      chart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (!applying && r && barsRef.current > 0) syncBus.emit('time', { from: r.from, to: r.to, len: barsRef.current }, onMsg); });
      chart.subscribeCrosshairMove((p) => { if (applying) return; if (p && p.time != null) { const d = p.seriesData.get(seriesRef.current); syncBus.emit('cross', { time: p.time, value: d ? (d.close != null ? d.close : d.value) : 0 }, onMsg); } else syncBus.emit('cross', { time: null }, onMsg); });
    }
    return () => { ro.disconnect(); if (unsub) unsub(); chart.remove(); };
  }, [syncBus]);

  // اعمالِ تمِ روشن/تیره بدونِ بازسازیِ چارت (بی‌لرزش، هم‌گام با تغییرِ تمِ اپ)
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      layout: { background: { color: th.bg }, textColor: th.text },
      grid: { vertLines: { color: th.grid }, horzLines: { color: th.grid } },
      timeScale: { borderColor: th.border },
      rightPriceScale: { borderColor: th.border },
      crosshair: { vertLine: { color: th.cross }, horzLine: { color: th.cross } },
    });
    if (seriesRef.current) seriesRef.current.applyOptions({ upColor: th.up, downColor: th.down, borderUpColor: th.up, borderDownColor: th.down, wickUpColor: th.up, wickDownColor: th.down });
    // بازرنگ‌آمیزیِ میله‌های حجم با پالتِ تمِ تازه (رنگ per-bar است و applyOptions نمی‌گیرد) — از دادهٔ خامِ کش‌شده، بدونِ fetch
    if (volRef.current && Array.isArray(lastRawRef.current)) {
      const raw = lastRawRef.current;
      const hasVol = raw.some((x) => Number(x.v) > 0);
      try { volRef.current.setData(hasVol ? raw.map((x) => ({ time: x.t, value: x.v || 0, color: (x.c >= x.o) ? th.up + '80' : th.down + '80' })) : []); } catch (e) { /* noop */ }
    }
  }, [theme]);

  useEffect(() => {
    let stop = false;
    api.chart(symbol, effTf, '', 400).then((r) => {
      if (stop || !seriesRef.current) return;
      // دقتِ اعشارِ محورِ قیمت per-symbol (فارکس ۵، JPY ۳، شاخص/طلا ۲…) — مثلِ چارتِ اصلی؛
      // قبلاً MiniChart پیش‌فرضِ کتابخانه (۲ رقم) را می‌گرفت و برای فارکس «۱٫۱۴» نشان می‌داد.
      { const d = priceDigits(symbol); try { seriesRef.current.applyOptions({ priceFormat: grpFmt(d) }); } catch (e) { /* noop */ } }
      const cs = (r.candles || []).map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }));
      seriesRef.current.setData(cs);
      barsRef.current = cs.length; // طولِ داده برای نگاشتِ رنجِ سینک (فاصله از آخرین کندل)
      // اورلیِ اندیکاتور (فاز ۷.۱): همان اندیکاتورهای main-paneِ چارتِ اصلی روی این سلول.
      // فقط pane:'main' (خطیِ روی قیمت) — نه sub-pane. سری‌های قبلی پاک می‌شوند تا نشت نکنند.
      try { for (const ss of ovSeriesRef.current) { try { chartRef.current.removeSeries(ss); } catch (e) {} } } catch (e) {}
      ovSeriesRef.current = [];
      const raw = (r.candles || []).map((c) => ({ o: c.o, h: c.h, l: c.l, c: c.c, v: c.v, t: c.t }));
      // حجم (P2.2): رنگِ هر میله برحسبِ جهتِ کندل با توکن‌های پالت (+آلفای ۵۰٪ هگز). نمادهای بی‌حجم
      // (فارکس: همهٔ vها صفر/تهی) ⇒ سریِ خالی تا باندِ پایینِ سلول بی‌خود اشغال نشود.
      lastRawRef.current = raw;
      if (volRef.current) {
        const hasVol = raw.some((x) => Number(x.v) > 0);
        try { volRef.current.setData(hasVol ? raw.map((x) => ({ time: x.t, value: x.v || 0, color: (x.c >= x.o) ? th.up + '80' : th.down + '80' })) : []); } catch (e) { /* noop */ }
      }
      const cndl = { open: raw.map((x) => x.o), high: raw.map((x) => x.h), low: raw.map((x) => x.l), close: raw.map((x) => x.c), volume: raw.map((x) => x.v), time: raw.map((x) => x.t) };
      for (const ov of (overlays || [])) {
        const def = REGISTRY[ov.key];
        if (!def || def.pane !== 'main') continue;
        try {
          const out = def.calc(cndl, { ...(def.inputs || {}), ...(ov.inputs || {}) });
          const lines = out.lines ? out.lines : (out.line ? [{ data: out.line, color: def.color }] : []);
          for (const ln of lines) {
            if (!Array.isArray(ln.data)) continue;
            const ser = chartRef.current.addSeries(LineSeries, { color: ln.color || def.color || '#888', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
            ser.setData(ln.data.map((v, i) => (v == null ? null : { time: cs[i] && cs[i].time, value: v })).filter((x) => x && x.time != null));
            ovSeriesRef.current.push(ser);
          }
        } catch (e) { /* یک اندیکاتورِ خراب نباید سلول را بشکند */ }
      }
      chartRef.current && chartRef.current.timeScale().fitContent();
      if (cs.length) {
        const n = cs[cs.length - 1];
        const prev = cs.length > 1 ? cs[cs.length - 2].close : n.open;
        setLast(n.close);
        setDir(n.close >= prev ? 'up' : 'down'); // رنگِ سبز/قرمز بر اساسِ روند
      }
    }).catch(() => {});
    return () => { stop = true; };
  }, [symbol, effTf, overlays]);

  // ── ترسیم‌های ذخیره‌شدهٔ نماد، فقط-خواندنی (P2.2) ──
  // خطوطِ افقی (hline) از localStorage با همان کلیدِ چارتِ اصلی (bn_draw:SYM) به‌صورتِ priceLine رندر می‌شوند —
  // ارزان و بدونِ DrawingLayerِ کامل. خواندنِ مستقیمِ localStorage به‌جای import از BazaarNama ⇒ بدونِ importِ چرخه‌ای.
  // trend/vline/… عمداً skip (خارج از دامنهٔ سلول). رفرشِ زنده با رویدادِ bn:drawingsChanged از saveSymbolDrawings.
  useEffect(() => {
    const apply = () => {
      const s = seriesRef.current; if (!s) return;
      for (const pl of priceLinesRef.current) { try { s.removePriceLine(pl); } catch (e) { /* noop */ } }
      priceLinesRef.current = [];
      let arr = [];
      try { arr = JSON.parse(localStorage.getItem(`bn_draw:${String(symbol).toUpperCase()}`) || '[]'); } catch (e) { arr = []; }
      if (!Array.isArray(arr)) return;
      // نگاشتِ سبکِ خطِ DrawingLayer به LineStyleِ کتابخانه: dotted=1، dashed=2 (پرچمِ legacy «dashed» هم)، وگرنه solid=0
      const ls = (d) => (d.lineStyle === 'dotted' ? 1 : (d.lineStyle === 'dashed' || d.dashed) ? 2 : 0);
      for (const d of arr) {
        if (!d || d.type !== 'hline' || d.visible === false) continue;
        const price = Number(d.p);
        if (!Number.isFinite(price)) continue;
        try { priceLinesRef.current.push(s.createPriceLine({ price, color: d.color || th.cross, lineWidth: Math.max(1, Math.min(4, Math.round(Number(d.width) || 1))), lineStyle: ls(d), axisLabelVisible: false, title: '' })); } catch (e) { /* noop */ }
      }
    };
    apply();
    const onChg = (e) => { const sy = e && e.detail && e.detail.symbol; if (!sy || sy === String(symbol).toUpperCase()) apply(); };
    window.addEventListener('bn:drawingsChanged', onChg);
    return () => window.removeEventListener('bn:drawingsChanged', onChg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const isDark = theme === 'dark';
  const priceColor = dir === 'up' ? th.up : dir === 'down' ? th.down : th.text;
  return (
    <div className="relative w-full h-full rounded overflow-hidden" style={{ border: `1px solid ${th.border}` }}>
      <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
        <select value={symbol} onChange={(e) => { const v = e.target.value; setSymbol(v); if (syncSymRef.current && syncBus) syncBus.emit('symbol', v); }} className="text-[11px] rounded px-1 py-0.5 outline-none transition-colors duration-[120ms]" style={{ background: isDark ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.72)', color: th.text, border: `1px solid ${th.border}` }}>
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {/* تایم‌فریمِ per-cell (P2.2) — هم‌سبکِ selectِ نماد (۱۱px، مویی، شعاع ۴، تک‌رنگ در سکون؛ LUXE §۳/§۴).
            پیش‌فرض = tfِ ارثیِ چارتِ اصلی؛ انتخابِ دستی سلول را مستقل می‌کند. tfِ ارثیِ خارج از لیست پویا اضافه می‌شود. */}
        <select value={effTf} onChange={(e) => setTfSel(e.target.value)} title="تایم‌فریمِ این سلول" dir="ltr" className="text-[11px] rounded px-1 py-0.5 outline-none transition-colors duration-[120ms]" style={{ background: isDark ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.72)', color: th.text, border: `1px solid ${th.border}` }}>
          {(CELL_TFS.some(([id]) => id === effTf) ? CELL_TFS : [[effTf, effTf], ...CELL_TFS]).map(([id, lbl]) => <option key={id} value={id}>{lbl}</option>)}
        </select>
        {last != null && <span className="tnum text-[11px] font-semibold" dir="ltr" style={{ color: priceColor }}>{grp(last, priceDigits(symbol))}</span>}
      </div>
      <div ref={elRef} className="w-full h-full" />
    </div>
  );
}
