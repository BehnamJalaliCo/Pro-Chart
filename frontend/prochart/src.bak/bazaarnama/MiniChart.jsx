import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries } from 'lightweight-charts';
import { api } from '../api/client';

const TH = { bg: '#0e1117', grid: '#1c2230', text: '#9aa0b5', up: '#26a69a', down: '#ef5350', accent: '#2962FF' };
const MINI_TFS = ['M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']; // تایم‌فریم‌های قابل‌انتخابِ هر سلول
const MINI_TYPES = [['candles', '📊'], ['line', '📈'], ['area', '⛰']]; // نوعِ چارتِ قابل‌انتخابِ هر سلول

// چارتِ کوچکِ مستقل برای حالتِ چند-چارت (هر کدام نماد + تایم‌فریمِ خود — مثلِ TradingView)
export default function MiniChart({ symbols = [], tf: tfProp, initial, syncBus = null }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [symbol, setSymbol] = useState(initial || 'EURUSD');
  const [tf, setTf] = useState(tfProp || 'H1'); // تایم‌فریمِ مستقلِ همین سلول
  const [ctype, setCtype] = useState('candles'); // نوعِ چارتِ مستقلِ همین سلول
  const [last, setLast] = useState(null);

  useEffect(() => {
    if (!elRef.current) return;
    const chart = createChart(elRef.current, {
      layout: { background: { color: TH.bg }, textColor: TH.text, fontFamily: 'AnjomanMax, Vazirmatn' },
      grid: { vertLines: { color: TH.grid }, horzLines: { color: TH.grid } },
      timeScale: { timeVisible: true, borderColor: TH.grid },
      rightPriceScale: { borderColor: TH.grid },
      width: elRef.current.clientWidth, height: elRef.current.clientHeight,
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
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

  useEffect(() => {
    const chart = chartRef.current; if (!chart) return undefined;
    // (باز)ساختِ سری بر اساسِ نوعِ چارتِ سلول
    if (seriesRef.current) { try { chart.removeSeries(seriesRef.current); } catch (e) {} seriesRef.current = null; }
    if (ctype === 'line') seriesRef.current = chart.addSeries(LineSeries, { color: TH.accent, lineWidth: 2 });
    else if (ctype === 'area') seriesRef.current = chart.addSeries(AreaSeries, { lineColor: TH.accent, topColor: 'rgba(41,98,255,.35)', bottomColor: 'rgba(41,98,255,0)' });
    else seriesRef.current = chart.addSeries(CandlestickSeries, { upColor: TH.up, downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down });
    let stop = false;
    api.chart(symbol, tf, '', 400).then((r) => {
      if (stop || !seriesRef.current) return;
      const raw = (r.candles || []);
      const cs = (ctype === 'candles')
        ? raw.map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }))
        : raw.map((c) => ({ time: c.t, value: c.c }));
      seriesRef.current.setData(cs);
      chartRef.current && chartRef.current.timeScale().fitContent();
      if (raw.length) setLast(raw[raw.length - 1].c);
    }).catch(() => {});
    return () => { stop = true; };
  }, [symbol, tf, ctype]);

  return (
    <div className="relative w-full h-full border border-white/10 rounded overflow-hidden">
      <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="text-[11px] rounded px-1 py-0.5 outline-none bg-black/40 text-gray-200 border border-white/10">
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tf} onChange={(e) => setTf(e.target.value)} title="تایم‌فریمِ این سلول" dir="ltr" className="text-[11px] rounded px-1 py-0.5 outline-none bg-black/40 text-gray-200 border border-white/10">
          {MINI_TFS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={ctype} onChange={(e) => setCtype(e.target.value)} title="نوعِ چارتِ این سلول" className="text-[11px] rounded px-1 py-0.5 outline-none bg-black/40 text-gray-200 border border-white/10">
          {MINI_TYPES.map(([v, ic]) => <option key={v} value={v}>{ic}</option>)}
        </select>
        {last != null && <span className="text-[11px] font-mono text-gray-300" dir="ltr">{last}</span>}
      </div>
      <div ref={elRef} className="w-full h-full" />
    </div>
  );
}
