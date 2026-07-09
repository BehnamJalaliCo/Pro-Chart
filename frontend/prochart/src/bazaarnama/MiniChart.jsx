import React, { useEffect, useRef, useState } from 'react';
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
// خطِ کوچکِ روند به‌صورتِ ستونِ اختیاری در واچ‌لیست: SVG سبک، بی‌لرزش، تم‌آگاه.
// رنگِ سبز/قرمز از همان پالتِ کندلِ این چارت گرفته می‌شود تا هم‌خانواده بماند.
//   data: آرایهٔ اعداد (بسته‌شدن‌ها).  up: اختیاری؛ اگر نیامد از خودِ داده استنتاج می‌شود.
//   stroke: بازنویسیِ رنگ.  fill: پرکردنِ کم‌رنگِ زیرِ خط (حسِ TV).  radius: نرمیِ گوشه‌ها.
export function Sparkline({ data, up, width = 56, height = 22, stroke, fill = true }) {
  const theme = useApp((s) => s.theme) || 'light';
  const th = PAL[theme] || PAL.dark;
  // فضای ثابت رزرو می‌شود حتی وقتی داده نیست → بی‌جهش/بی‌لرزش در ردیف.
  if (!data || data.length < 2) return <svg width={width} height={height} style={{ display: 'block', flex: '0 0 auto' }} aria-hidden="true" />;
  const rise = up != null ? up : data[data.length - 1] >= data[0]; // روندِ کلی: آخر vs اول
  const col = stroke || (rise ? th.up : th.down);
  const pad = 2, lastI = data.length - 1;
  let min = data[0], max = data[0];
  for (let i = 1; i < data.length; i++) { const v = data[i]; if (v < min) min = v; else if (v > max) max = v; }
  const rng = (max - min) || 1;
  const stepX = (width - pad * 2) / lastI;
  const yOf = (v) => (height - pad - ((v - min) / rng) * (height - pad * 2));
  const pts = data.map((v, i) => `${(pad + i * stepX).toFixed(1)},${yOf(v).toFixed(1)}`);
  const line = pts.join(' ');
  const base = (height - pad).toFixed(1);
  const area = `${pad.toFixed(1)},${base} ${line} ${(pad + lastI * stepX).toFixed(1)},${base}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" style={{ display: 'block', flex: '0 0 auto' }} aria-hidden="true">
      {fill && <polygon points={area} fill={col} fillOpacity={theme === 'dark' ? 0.12 : 0.09} stroke="none" />}
      <polyline points={line} stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
      layout: { background: { color: th.bg }, textColor: th.text, fontFamily: 'Ravagh, AnjomanMax, Vazirmatn, sans-serif', fontSize: 11, attributionLogo: false },
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
