import React, { useEffect, useId, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { api } from '../api/client';
import { useApp } from '../appStore';

// پالتِ روشن/تیره هم‌ترازِ TradingView (توکن‌های --pc-* از نقشهٔ راه).
// سبز/قرمزِ کندل teal/red؛ متنِ off-white در تیره، #131722 در روشن؛ گریدِ بسیار کم‌رنگ.
const PAL = {
  dark:  { bg: '#131722', grid: 'rgba(255,255,255,.06)', text: '#d1d4dc', border: '#2a2e39', cross: '#9598a1', up: '#26a69a', down: '#ef5350' },
  light: { bg: '#ffffff', grid: 'rgba(0,0,0,.06)',       text: '#131722', border: '#e0e3eb', cross: '#9598a1', up: '#26a69a', down: '#ef5350' },
};
const TH = PAL.dark; // سازگاریِ عقب‌رو (پیش‌فرضِ تیره)

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
export default function MiniChart({ symbols = [], tf, initial, syncBus = null }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const theme = useApp((s) => s.theme) || 'light';
  const th = PAL[theme] || PAL.dark;
  const [symbol, setSymbol] = useState(initial || 'EURUSD');
  const [last, setLast] = useState(null);
  const [dir, setDir] = useState(null); // 'up' | 'down' | null — رنگِ برچسبِ قیمت بر اساسِ روند

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
    const ro = new ResizeObserver(() => { if (elRef.current && chartRef.current) chartRef.current.applyOptions({ width: elRef.current.clientWidth, height: elRef.current.clientHeight }); });
    ro.observe(elRef.current);
    // ── همگام‌سازیِ چندچارتی (زمان + کراس‌هیر) مثلِ TradingView ──
    let applying = false, unsub = null;
    if (syncBus) {
      const onMsg = (type, payload) => {
        if (!chartRef.current) return; applying = true;
        try {
          if (type === 'time' && payload) chartRef.current.timeScale().setVisibleLogicalRange(payload);
          else if (type === 'cross') { if (payload && payload.time != null) chartRef.current.setCrosshairPosition(payload.value || 0, payload.time, seriesRef.current); else chartRef.current.clearCrosshairPosition(); }
        } catch (e) {}
        applying = false;
      };
      unsub = syncBus.subscribe(onMsg);
      chart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (!applying && r) syncBus.emit('time', r, onMsg); });
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
  }, [theme]);

  useEffect(() => {
    let stop = false;
    api.chart(symbol, tf, '', 400).then((r) => {
      if (stop || !seriesRef.current) return;
      const cs = (r.candles || []).map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }));
      seriesRef.current.setData(cs);
      chartRef.current && chartRef.current.timeScale().fitContent();
      if (cs.length) {
        const n = cs[cs.length - 1];
        const prev = cs.length > 1 ? cs[cs.length - 2].close : n.open;
        setLast(n.close);
        setDir(n.close >= prev ? 'up' : 'down'); // رنگِ سبز/قرمز بر اساسِ روند
      }
    }).catch(() => {});
    return () => { stop = true; };
  }, [symbol, tf]);

  const isDark = theme === 'dark';
  const priceColor = dir === 'up' ? th.up : dir === 'down' ? th.down : th.text;
  return (
    <div className="relative w-full h-full rounded overflow-hidden" style={{ border: `1px solid ${th.border}` }}>
      <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="text-[11px] rounded px-1 py-0.5 outline-none transition-colors duration-[120ms]" style={{ background: isDark ? 'rgba(0,0,0,.4)' : 'rgba(255,255,255,.72)', color: th.text, border: `1px solid ${th.border}` }}>
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {last != null && <span className="tnum text-[11px] font-semibold" dir="ltr" style={{ color: priceColor }}>{last}</span>}
      </div>
      <div ref={elRef} className="w-full h-full" />
    </div>
  );
}
