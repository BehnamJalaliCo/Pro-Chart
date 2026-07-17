import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { api } from '../api/client';

const TH = { bg: '#0e1117', grid: '#1c2230', text: '#9aa0b5', up: '#26a69a', down: '#ef5350' };

// چارتِ کوچکِ مستقل برای حالتِ چند-چارت (هر کدام نماد + تایم‌فریمِ خود)
export default function MiniChart({ symbols = [], tf, initial }) {
  const elRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const [symbol, setSymbol] = useState(initial || 'EURUSD');
  const [last, setLast] = useState(null);

  useEffect(() => {
    if (!elRef.current) return;
    const chart = createChart(elRef.current, {
      layout: { background: { color: TH.bg }, textColor: TH.text, fontFamily: 'Vazirmatn' },
      grid: { vertLines: { color: TH.grid }, horzLines: { color: TH.grid } },
      timeScale: { timeVisible: true, borderColor: TH.grid },
      rightPriceScale: { borderColor: TH.grid },
      width: elRef.current.clientWidth, height: elRef.current.clientHeight,
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addSeries(CandlestickSeries, { upColor: TH.up, downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down });
    const ro = new ResizeObserver(() => { if (elRef.current && chartRef.current) chartRef.current.applyOptions({ width: elRef.current.clientWidth, height: elRef.current.clientHeight }); });
    ro.observe(elRef.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, []);

  useEffect(() => {
    let stop = false;
    api.chart(symbol, tf, '', 400).then((r) => {
      if (stop || !seriesRef.current) return;
      const cs = (r.candles || []).map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }));
      seriesRef.current.setData(cs);
      chartRef.current && chartRef.current.timeScale().fitContent();
      if (cs.length) setLast(cs[cs.length - 1].close);
    }).catch(() => {});
    return () => { stop = true; };
  }, [symbol, tf]);

  return (
    <div className="relative w-full h-full border border-white/10 rounded overflow-hidden">
      <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="text-[11px] rounded px-1 py-0.5 outline-none bg-black/40 text-gray-200 border border-white/10">
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {last != null && <span className="text-[11px] font-mono text-gray-300" dir="ltr">{last}</span>}
      </div>
      <div ref={elRef} className="w-full h-full" />
    </div>
  );
}
