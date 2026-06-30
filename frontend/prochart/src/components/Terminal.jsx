import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, LineStyle, CandlestickSeries, HistogramSeries, LineSeries, createSeriesMarkers } from 'lightweight-charts';
import { useQuery } from '@tanstack/react-query';
import { Minus, Maximize2, Trash2, X, Loader2, TrendingUp, Square, Spline, Eraser, MousePointer } from 'lucide-react';
import { api } from '../api/client';

/*
  ترمینالِ نموداریِ حرفه‌ای (سبکِ TradingView) برای آکادمی — مبتنی بر lightweight-charts v4.
  - کندل‌استیک + حجم (هیستوگرام) روی نمودارِ اصلی
  - اندیکاتورهای روهم (MA20/MA50/Bollinger) که سمتِ کلاینت محاسبه می‌شوند
  - پنل‌های جدا برای RSI/MACD/ATR که از سرور درخواست و با تایم‌اسکیلِ نمودارِ اصلی هم‌گام می‌شوند
  - افسانهٔ OHLC، ابزارِ خطِ افقی، markers و priceLines از بیرون (تحلیلِ AI)
  v4 چندپَنلی ندارد؛ پس هر زیر-اندیکاتور یک نمونهٔ نمودارِ مستقل است.
*/

// ── کمک‌محاسبات سمتِ کلاینت ──
const sma = (a, p) => a.map((_, i) => (i < p - 1 ? null : a.slice(i - p + 1, i + 1).reduce((x, y) => x + y, 0) / p));
function bollinger(a, p = 20, k = 2) {
  const mid = sma(a, p), up = [], lo = [];
  for (let i = 0; i < a.length; i++) {
    if (mid[i] == null) { up.push(null); lo.push(null); continue; }
    const sl = a.slice(i - p + 1, i + 1), m = mid[i];
    const sd = Math.sqrt(sl.reduce((x, y) => x + (y - m) ** 2, 0) / p);
    up.push(m + k * sd); lo.push(m - k * sd);
  }
  return { mid, up, lo };
}

// خطوطِ خطی از آرایهٔ هم‌ترازِ کندل‌ها (مقادیرِ null حذف می‌شوند)
const toLine = (candles, arr) => {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (let i = 0; i < candles.length && i < arr.length; i++) {
    const v = arr[i];
    if (v != null && isFinite(v)) out.push({ time: candles[i].t, value: v });
  }
  return out;
};

// تمِ تیره/روشن
function palette(dark) {
  return dark
    ? { bg: '#0b0f17', text: '#94a3b8', grid: 'rgba(148,163,184,.08)', border: 'rgba(148,163,184,.18)', up: '#22c55e', down: '#ef4444', upVol: 'rgba(34,197,94,.45)', downVol: 'rgba(239,68,68,.45)', panelBg: '#0b0f17' }
    : { bg: '#ffffff', text: '#475569', grid: 'rgba(100,116,139,.10)', border: 'rgba(100,116,139,.22)', up: '#16a34a', down: '#dc2626', upVol: 'rgba(22,163,74,.4)', downVol: 'rgba(220,38,38,.4)', panelBg: '#ffffff' };
}

const baseOpts = (pal) => ({
  layout: { background: { type: ColorType.Solid, color: pal.bg }, textColor: pal.text, fontFamily: 'Vazirmatn, sans-serif', fontSize: 11 },
  grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
  rightPriceScale: { borderColor: pal.border },
  timeScale: { borderColor: pal.border, timeVisible: true, secondsVisible: false },
  crosshair: { mode: CrosshairMode.Normal },
  handleScale: true,
  handleScroll: true,
});

// سطوحِ فیبوناچیِ ریتریسمنت (0 تا 1)
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ['#94a3b8', '#22d3ee', '#60a5fa', '#a78bfa', '#f59e0b', '#f97316', '#ef4444'];
// رنگ‌های پیش‌فرضِ ابزارهای رسم
const DRAW_COLORS = { trendline: '#a78bfa', rect: '#22d3ee', fib: '#f59e0b' };

// ابزارهای رسم (افزوده) — حالتِ انتخاب + سه ابزارِ مبتنی بر دو-کلیک
const TOOLS = [
  { key: 'none', label: 'انتخاب', icon: MousePointer, clicks: 0 },
  { key: 'trendline', label: 'خطِ روند', icon: TrendingUp, clicks: 2 },
  { key: 'fib', label: 'فیبوناچی', icon: Spline, clicks: 2 },
  { key: 'rect', label: 'مستطیل', icon: Square, clicks: 2 },
];

const TFS = ['M5', 'M15', 'H1', 'H4', 'D1'];
const OVERLAYS = [
  { key: 'ma20', label: 'MA20', color: '#60a5fa' },
  { key: 'ma50', label: 'MA50', color: '#f59e0b' },
  { key: 'bb', label: 'BB', color: '#94a3b8' },
];
// زیر-اندیکاتورها که از سرور می‌آیند
const SUBS = [
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
  { key: 'atr', label: 'ATR' },
];

const fmt = (v, d = 5) => (v == null || !isFinite(v) ? '—' : Number(v).toFixed(d));

export default function Terminal({
  symbol: symbolProp = 'EURUSD',
  tf: tfProp = 'H1',
  height = 480,
  dark: darkProp,
  limit = 600,
  markers = [],
  priceLines = [],
  symbols: symbolsProp,
  onSymbolChange,
  onTfChange,
  candles: candlesProp,   // ← افزوده: اگر داده شود، fetchِ داخلی نادیده گرفته و دقیقاً همین کندل‌ها رِندر می‌شوند (برای شبیه‌سازِ Replay)
  showToolbar = true,     // ← افزوده: می‌توان نوارِ ابزارِ نماد/تایم‌فریم را پنهان کرد (شبیه‌ساز کنترلِ خودش را دارد)
}) {
  // وقتی کندل‌های بیرونی داده شود، حالتِ «کنترل‌شده» است: fetchِ داخلی غیرفعال می‌شود
  const controlled = Array.isArray(candlesProp);
  // تشخیصِ تم: اگر prop داده نشده باشد از کلاسِ html می‌خوانیم
  const detectedDark = typeof document !== 'undefined' ? !document.documentElement.classList.contains('light') : true;
  const dark = darkProp == null ? detectedDark : darkProp;
  const pal = useMemo(() => palette(dark), [dark]);

  // وضعیتِ کنترل‌شده‌ی نیمه‌مستقل
  const [symbol, setSymbol] = useState(symbolProp);
  const [tf, setTf] = useState(tfProp);
  useEffect(() => { setSymbol(symbolProp); }, [symbolProp]);
  useEffect(() => { setTf(tfProp); }, [tfProp]);

  const [overlays, setOverlays] = useState({ ma20: false, ma50: false, bb: false });
  const [subs, setSubs] = useState({ rsi: false, macd: false, atr: false });
  // ابزارِ فعالِ رسم: 'none' | 'hline' | 'trendline' | 'fib' | 'rect'
  const [tool, setTool] = useState('none');
  const hlineTool = tool === 'hline';
  const [hlines, setHlines] = useState([]); // {id, price, line}
  // رسم‌های روهم (در فضای نمودار: زمان+قیمت) — روی کانواسِ سرپوشی کشیده می‌شوند
  const [drawings, setDrawings] = useState([]); // {id, type, points:[{time,price},...], color}
  const [legend, setLegend] = useState(null);

  const enabledSubs = SUBS.filter((s) => subs[s.key]).map((s) => s.key);
  const indParam = enabledSubs.join(',');

  // ── نمادها ──
  const { data: symMeta } = useQuery({
    queryKey: ['terminalSymbols'],
    queryFn: () => api.chartSymbols(),
    staleTime: 3600e3,
    enabled: !symbolsProp,
  });
  const symbols = symbolsProp || symMeta?.symbols || [symbol];

  // ── داده ──
  const { data, isFetching, isError } = useQuery({
    queryKey: ['terminalChart', symbol, tf, indParam, limit],
    queryFn: () => api.chart(symbol, tf, indParam || undefined, limit),
    enabled: !!symbol && !controlled, // در حالتِ کنترل‌شده دیگر از سرور نمی‌گیریم
    keepPreviousData: true,
  });
  // در حالتِ کنترل‌شده کندل‌ها از prop می‌آیند؛ اندیکاتورهای سروری معنا ندارند
  const candles = controlled ? candlesProp : (data?.candles || []);
  const indicators = controlled ? null : (data?.indicators || null);

  // ── refs برای نمودارِ اصلی ──
  const mainBoxRef = useRef(null);
  const mainChartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volSeriesRef = useRef(null);
  const ma20Ref = useRef(null);
  const ma50Ref = useRef(null);
  const bbUpRef = useRef(null);
  const bbMidRef = useRef(null);
  const bbLoRef = useRef(null);
  const hlineLinesRef = useRef(new Map()); // id -> priceLine object
  const extPriceLinesRef = useRef([]); // priceLine objects from props
  const subRefs = useRef({}); // key -> { chart, box, series:{...} }
  const syncingRef = useRef(false); // محافظ در برابر حلقه‌ی هم‌گام‌سازی

  // ── refs برای کانواسِ سرپوشیِ رسم ──
  const overlayCanvasRef = useRef(null);
  const drawingsRef = useRef([]);             // آینهٔ آخرینِ drawings برای redraw در شنونده‌های یک‌بار
  const pendingRef = useRef(null);            // نقطهٔ اولِ یک رسمِ در حالِ انجام: {time, price}
  const hoverRef = useRef(null);              // نقطهٔ نشانگر برای پیش‌نمایشِ رابر-بَند: {time, price}
  const toolRef = useRef(tool);               // مقدارِ به‌روزِ ابزار برای شنونده‌های یک‌بار
  const palRef = useRef(pal);                 // تمِ جاری برای کشیدنِ کانواس
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { palRef.current = pal; }, [pal]);
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);

  // ── ساختِ نمودارِ اصلی (یک‌بار) ──
  useEffect(() => {
    const box = mainBoxRef.current;
    if (!box) return;
    const chart = createChart(box, {
      ...baseOpts(pal),
      width: box.clientWidth,
      height,
    });
    mainChartRef.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: pal.up, downColor: pal.down, borderUpColor: pal.up, borderDownColor: pal.down,
      wickUpColor: pal.up, wickDownColor: pal.down,
    });
    candleSeriesRef.current = candleSeries;

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeriesRef.current = volSeries;

    // افسانهٔ OHLC روی حرکتِ نشانگر + پیش‌نمایشِ رابر-بَندِ رسم
    const onCross = (param) => {
      if (param && param.time && candleSeriesRef.current) {
        const c = param.seriesData ? param.seriesData.get(candleSeriesRef.current) : null;
        if (c && c.open != null) setLegend({ o: c.open, h: c.high, l: c.low, c: c.close });
      }
      // اگر رسمی در حالِ انجام است، نقطهٔ نشانگر را برای پیش‌نمایش به‌روز کن
      if (pendingRef.current && param && param.point != null) {
        const pt = toChartRef.current(param.point.x, param.point.y);
        if (pt) { hoverRef.current = pt; redrawOverlayRef.current(); }
      }
    };
    chart.subscribeCrosshairMove(onCross);

    // هم‌گام‌سازیِ تایم‌اسکیل: اصلی → زیر-پنل‌ها + بازکشیدنِ کانواس روی pan/zoom
    const onMainRange = (range) => {
      redrawOverlayRef.current();
      if (syncingRef.current || !range) return;
      syncingRef.current = true;
      try {
        Object.values(subRefs.current).forEach((s) => {
          if (s && s.chart) s.chart.timeScale().setVisibleLogicalRange(range);
        });
      } finally { syncingRef.current = false; }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onMainRange);

    // کلیک: خطِ افقی یا نقاطِ ابزارهای دو-کلیکی
    const onClick = (param) => {
      if (!param || param.point == null || !candleSeriesRef.current) return;
      const t = toolRef.current;
      if (t === 'hline') {
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        if (price == null || !isFinite(price)) return;
        addHlineRef.current(price);
        return;
      }
      if (t === 'trendline' || t === 'fib' || t === 'rect') {
        const pt = toChartRef.current(param.point.x, param.point.y);
        if (!pt) return;
        if (!pendingRef.current) {
          // کلیکِ اول
          pendingRef.current = pt;
          hoverRef.current = pt;
        } else {
          // کلیکِ دوم → ثبتِ رسم
          const first = pendingRef.current;
          pendingRef.current = null;
          hoverRef.current = null;
          addDrawingRef.current(t, [first, pt]);
        }
        redrawOverlayRef.current();
      }
    };
    chart.subscribeClick(onClick);

    const ro = new ResizeObserver(() => {
      if (mainChartRef.current && box) mainChartRef.current.applyOptions({ width: box.clientWidth });
      redrawOverlayRef.current();
    });
    ro.observe(box);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch { /* */ }
      mainChartRef.current = null;
      candleSeriesRef.current = null;
      volSeriesRef.current = null;
      ma20Ref.current = ma50Ref.current = bbUpRef.current = bbMidRef.current = bbLoRef.current = null;
      hlineLinesRef.current = new Map();
      extPriceLinesRef.current = [];
    };
    // فقط یک‌بار ساخته شود؛ تغییرِ تم/ارتفاع از افکت‌های جدا اعمال می‌شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const addHline = useCallback((price) => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const id = 'hl_' + Date.now() + '_' + Math.round(Math.random() * 1e4);
    const line = series.createPriceLine({
      price, color: '#a78bfa', lineWidth: 1, lineStyle: LineStyle.Solid,
      axisLabelVisible: true, title: fmt(price),
    });
    setHlines((arr) => [...arr, { id, price, line }]);
  }, []);

  const removeHline = useCallback((id) => {
    setHlines((arr) => {
      const found = arr.find((h) => h.id === id);
      if (found && candleSeriesRef.current) {
        try { candleSeriesRef.current.removePriceLine(found.line); } catch { /* */ }
      }
      return arr.filter((h) => h.id !== id);
    });
  }, []);

  const clearHlines = useCallback(() => {
    setHlines((arr) => {
      arr.forEach((h) => { try { candleSeriesRef.current?.removePriceLine(h.line); } catch { /* */ } });
      return [];
    });
  }, []);

  // ── تبدیلِ نقطهٔ فضای‌نمودار (time,price) به مختصاتِ صفحه (x,y) ──
  // اگر نقطه خارج از دید/نامعتبر باشد null برمی‌گرداند تا از کشیدنِ زباله جلوگیری شود
  const toScreen = useCallback((pt) => {
    const chart = mainChartRef.current, cs = candleSeriesRef.current;
    if (!chart || !cs || !pt) return null;
    let x = null, y = null;
    try { x = chart.timeScale().timeToCoordinate(pt.time); } catch { x = null; }
    try { y = cs.priceToCoordinate(pt.price); } catch { y = null; }
    if (x == null || y == null || !isFinite(x) || !isFinite(y)) return null;
    return { x, y };
  }, []);

  // ── تبدیلِ مختصاتِ صفحه به نقطهٔ فضای‌نمودار ──
  const toChart = useCallback((x, y) => {
    const chart = mainChartRef.current, cs = candleSeriesRef.current;
    if (!chart || !cs) return null;
    let time = null, price = null;
    try { time = chart.timeScale().coordinateToTime(x); } catch { time = null; }
    try { price = cs.coordinateToPrice(y); } catch { price = null; }
    if (time == null || price == null || !isFinite(price)) return null;
    return { time, price };
  }, []);

  // ── کشیدنِ یک رسمِ منفرد روی کانواس ──
  const drawOne = useCallback((ctx, d, palc) => {
    if (!d || !Array.isArray(d.points) || !d.points.length) return;
    if (d.type === 'trendline') {
      const a = toScreen(d.points[0]), b = toScreen(d.points[1]);
      if (!a || !b) return;
      ctx.strokeStyle = d.color || DRAW_COLORS.trendline;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (d.type === 'rect') {
      const a = toScreen(d.points[0]), b = toScreen(d.points[1]);
      if (!a || !b) return;
      const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
      ctx.strokeStyle = d.color || DRAW_COLORS.rect;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = (d.color || DRAW_COLORS.rect) + '1a';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else if (d.type === 'fib') {
      const a = toScreen(d.points[0]), b = toScreen(d.points[1]);
      if (!a || !b) return;
      const p0 = d.points[0].price, p1 = d.points[1].price;
      const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
      ctx.lineWidth = 1;
      ctx.font = '10px Vazirmatn, sans-serif';
      ctx.textBaseline = 'middle';
      FIB_LEVELS.forEach((lv, i) => {
        const price = p0 + (p1 - p0) * lv;
        const sc = toScreen({ time: d.points[0].time, price });
        if (!sc) return;
        ctx.strokeStyle = FIB_COLORS[i] || palc.text;
        ctx.beginPath(); ctx.moveTo(x1, sc.y); ctx.lineTo(x2, sc.y); ctx.stroke();
        ctx.fillStyle = FIB_COLORS[i] || palc.text;
        ctx.textAlign = 'left';
        ctx.fillText(`${(lv * 100).toFixed(1)}%  ${fmt(price)}`, x1 + 4, sc.y - 6);
      });
    }
  }, [toScreen]);

  // ── بازکشیدنِ کاملِ کانواسِ سرپوشی (روی pan/zoom/resize/preview صدا زده می‌شود) ──
  const redrawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current, box = mainBoxRef.current;
    if (!canvas || !box) return;
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    // هم‌اندازه‌سازی با دقتِ صفحه
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const palc = palRef.current;
    drawingsRef.current.forEach((d) => { try { drawOne(ctx, d, palc); } catch { /* */ } });
    // پیش‌نمایشِ رابر-بَندِ رسمِ در حالِ انجام
    const pend = pendingRef.current, hov = hoverRef.current;
    if (pend && hov) {
      const t = toolRef.current;
      const ghost = { type: t, points: [pend, hov], color: DRAW_COLORS[t] };
      ctx.save();
      ctx.globalAlpha = 0.7;
      try { drawOne(ctx, ghost, palc); } catch { /* */ }
      ctx.restore();
    }
  }, [drawOne]);

  // افزودنِ یک رسمِ تازه (در فضای نمودار)
  const addDrawing = useCallback((type, points) => {
    const id = 'dr_' + Date.now() + '_' + Math.round(Math.random() * 1e4);
    setDrawings((arr) => [...arr, { id, type, points, color: DRAW_COLORS[type] }]);
  }, []);
  const removeDrawing = useCallback((id) => {
    setDrawings((arr) => arr.filter((d) => d.id !== id));
  }, []);
  // پاک‌کن: حذفِ آخرین رسم (یا اگر رسمی در حالِ انجام بود، لغوِ آن)
  const undoDrawing = useCallback(() => {
    if (pendingRef.current) { pendingRef.current = null; hoverRef.current = null; redrawOverlayRef.current(); return; }
    setDrawings((arr) => arr.slice(0, -1));
  }, []);
  const clearDrawings = useCallback(() => {
    pendingRef.current = null; hoverRef.current = null;
    setDrawings([]);
  }, []);

  // نگه‌داریِ آخرین نسخهٔ توابع برای استفاده در شنونده‌های یک‌بارِ نمودار
  const toChartRef = useRef(toChart);
  const redrawOverlayRef = useRef(redrawOverlay);
  const addHlineRef = useRef(addHline);
  const addDrawingRef = useRef(addDrawing);
  useEffect(() => { toChartRef.current = toChart; }, [toChart]);
  useEffect(() => { redrawOverlayRef.current = redrawOverlay; }, [redrawOverlay]);
  useEffect(() => { addHlineRef.current = addHline; }, [addHline]);
  useEffect(() => { addDrawingRef.current = addDrawing; }, [addDrawing]);

  // بازکشیدنِ کانواس هرگاه فهرستِ رسم‌ها/تم/کندل‌ها تغییر کند
  useEffect(() => { redrawOverlay(); }, [drawings, pal, candles, redrawOverlay]);

  // ── اعمالِ تم/ارتفاع روی نمودارِ اصلی ──
  useEffect(() => {
    const chart = mainChartRef.current;
    if (!chart) return;
    chart.applyOptions({ ...baseOpts(pal), height });
    if (candleSeriesRef.current) candleSeriesRef.current.applyOptions({
      upColor: pal.up, downColor: pal.down, borderUpColor: pal.up, borderDownColor: pal.down,
      wickUpColor: pal.up, wickDownColor: pal.down,
    });
  }, [pal, height]);

  // ── ست‌کردنِ دادهٔ کندل + حجم ──
  useEffect(() => {
    const cs = candleSeriesRef.current, vs = volSeriesRef.current;
    if (!cs || !vs) return;
    if (!candles.length) {
      cs.setData([]); vs.setData([]); setLegend(null);
      return;
    }
    cs.setData(candles.map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c })));
    vs.setData(candles.map((c) => ({ time: c.t, value: c.v || 0, color: c.c >= c.o ? pal.upVol : pal.downVol })));
    // افسانهٔ پیش‌فرض: آخرین کندل
    const last = candles[candles.length - 1];
    setLegend({ o: last.o, h: last.h, l: last.l, c: last.c });
  }, [candles, pal]);

  // ── اندیکاتورهای روهم (MA/BB) ──
  useEffect(() => {
    const chart = mainChartRef.current, cs = candleSeriesRef.current;
    if (!chart || !cs) return;
    const closes = candles.map((c) => c.c);

    const ensure = (ref, opts) => {
      if (!ref.current) ref.current = chart.addSeries(LineSeries, opts);
      return ref.current;
    };
    const drop = (ref) => { if (ref.current) { try { chart.removeSeries(ref.current); } catch { /* */ } ref.current = null; } };

    // MA20
    if (overlays.ma20 && closes.length) {
      ensure(ma20Ref, { color: '#60a5fa', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        .setData(toLine(candles, sma(closes, 20)));
    } else drop(ma20Ref);

    // MA50
    if (overlays.ma50 && closes.length) {
      ensure(ma50Ref, { color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false })
        .setData(toLine(candles, sma(closes, 50)));
    } else drop(ma50Ref);

    // Bollinger
    if (overlays.bb && closes.length) {
      const bb = bollinger(closes);
      ensure(bbUpRef, { color: '#64748b', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(toLine(candles, bb.up));
      ensure(bbMidRef, { color: '#94a3b8', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(toLine(candles, bb.mid));
      ensure(bbLoRef, { color: '#64748b', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }).setData(toLine(candles, bb.lo));
    } else { drop(bbUpRef); drop(bbMidRef); drop(bbLoRef); }
  }, [overlays, candles]);

  // ── markers از بیرون (تحلیلِ AI) ──
  useEffect(() => {
    const cs = candleSeriesRef.current;
    if (!cs) return;
    try { if (!cs.__markers) cs.__markers = createSeriesMarkers(cs, []); cs.__markers.setMarkers(Array.isArray(markers) ? markers : []); } catch { /* */ }
  }, [markers, candles]);

  // ── priceLines از بیرون (سطوح/نواحیِ AI) ──
  useEffect(() => {
    const cs = candleSeriesRef.current;
    if (!cs) return;
    // پاک‌سازیِ قبلی‌ها
    extPriceLinesRef.current.forEach((pl) => { try { cs.removePriceLine(pl); } catch { /* */ } });
    extPriceLinesRef.current = [];
    (Array.isArray(priceLines) ? priceLines : []).forEach((p) => {
      if (p == null || p.price == null || !isFinite(p.price)) return;
      try {
        const pl = cs.createPriceLine({
          price: p.price, color: p.color || '#a78bfa', lineWidth: p.lineWidth || 1,
          lineStyle: p.lineStyle != null ? p.lineStyle : LineStyle.Dashed,
          axisLabelVisible: true, title: p.title || '',
        });
        extPriceLinesRef.current.push(pl);
      } catch { /* */ }
    });
  }, [priceLines, candles]);

  // ── مدیریتِ زیر-پنل‌ها (ساخت/حذف نمونه‌های نمودار) ──
  useEffect(() => {
    enabledSubs.forEach((key) => {
      if (subRefs.current[key]) return;
      const box = document.getElementById('cp-sub-' + key);
      if (!box) return;
      const chart = createChart(box, {
        ...baseOpts(pal),
        width: box.clientWidth,
        height: 110,
        rightPriceScale: { borderColor: pal.border, scaleMargins: { top: 0.12, bottom: 0.08 } },
        timeScale: { borderColor: pal.border, visible: false },
      });
      const entry = { chart, box, series: {}, ro: null };
      subRefs.current[key] = entry;

      // هم‌گام‌سازی: زیر-پنل → اصلی و سایرین
      const onRange = (range) => {
        if (syncingRef.current || !range) return;
        syncingRef.current = true;
        try {
          if (mainChartRef.current) mainChartRef.current.timeScale().setVisibleLogicalRange(range);
          Object.entries(subRefs.current).forEach(([k, s]) => {
            if (k !== key && s && s.chart) s.chart.timeScale().setVisibleLogicalRange(range);
          });
        } finally { syncingRef.current = false; }
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);

      const ro = new ResizeObserver(() => { if (entry.chart && box) entry.chart.applyOptions({ width: box.clientWidth }); });
      ro.observe(box);
      entry.ro = ro;
    });

    // حذفِ پنل‌هایی که دیگر فعال نیستند
    Object.keys(subRefs.current).forEach((key) => {
      if (enabledSubs.includes(key)) return;
      const entry = subRefs.current[key];
      if (entry) {
        try { entry.ro && entry.ro.disconnect(); } catch { /* */ }
        try { entry.chart.remove(); } catch { /* */ }
      }
      delete subRefs.current[key];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indParam]);

  // اعمالِ تم روی زیر-پنل‌ها
  useEffect(() => {
    Object.values(subRefs.current).forEach((s) => {
      if (s && s.chart) s.chart.applyOptions({ ...baseOpts(pal), timeScale: { borderColor: pal.border, visible: false }, height: 110 });
    });
  }, [pal]);

  // ── دادهٔ زیر-پنل‌ها (RSI/MACD/ATR) ──
  useEffect(() => {
    enabledSubs.forEach((key) => {
      const entry = subRefs.current[key];
      if (!entry || !entry.chart) return;
      const chart = entry.chart, S = entry.series;

      const ensureLine = (name, opts) => {
        if (!S[name]) S[name] = chart.addSeries(LineSeries, opts);
        return S[name];
      };
      const ensureHist = (name, opts) => {
        if (!S[name]) S[name] = chart.addSeries(HistogramSeries, opts);
        return S[name];
      };

      const ind = indicators || {};
      if (key === 'rsi') {
        const arr = Array.isArray(ind.rsi) ? ind.rsi : [];
        const line = ensureLine('rsi', { color: '#22d3ee', lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
        line.setData(toLine(candles, arr));
        // خطوطِ راهنمای 30/70
        if (!entry._guides && arr.length) {
          entry._guides = true;
          try {
            line.createPriceLine({ price: 70, color: '#64748b', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '70' });
            line.createPriceLine({ price: 30, color: '#64748b', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '30' });
          } catch { /* */ }
        }
      } else if (key === 'macd') {
        const m = ind.macd || {};
        ensureLine('macd', { color: '#22d3ee', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }).setData(toLine(candles, m.macd));
        ensureLine('signal', { color: '#f59e0b', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }).setData(toLine(candles, m.signal));
        const hist = Array.isArray(m.hist) ? m.hist : [];
        const hd = [];
        for (let i = 0; i < candles.length && i < hist.length; i++) {
          const v = hist[i];
          if (v != null && isFinite(v)) hd.push({ time: candles[i].t, value: v, color: v >= 0 ? pal.upVol : pal.downVol });
        }
        ensureHist('hist', { priceLineVisible: false, lastValueVisible: false }).setData(hd);
      } else if (key === 'atr') {
        const a = ind.atr || {};
        ensureLine('atr', { color: '#a78bfa', lineWidth: 2, priceLineVisible: false, lastValueVisible: false }).setData(toLine(candles, a.atr));
      }
    });
  }, [indicators, candles, indParam, pal]);

  // ── تمیزکاریِ نهایی هنگامِ unmount: زیر-پنل‌ها ──
  useEffect(() => () => {
    Object.values(subRefs.current).forEach((s) => {
      try { s.ro && s.ro.disconnect(); } catch { /* */ }
      try { s.chart && s.chart.remove(); } catch { /* */ }
    });
    subRefs.current = {};
  }, []);

  // ── میزِکار: بازیابی هنگامِ mount (فقط در حالتِ غیرکنترل‌شده = LiveChart) ──
  const wsLoadedRef = useRef(false);
  useEffect(() => {
    if (controlled) return;           // در حالتِ کنترل‌شده (شبیه‌ساز) میزِکار را دست نمی‌زنیم
    let alive = true;
    (async () => {
      try {
        const res = await api.getWorkspace();
        const layout = res?.layout || res || null;
        if (!alive || !layout || typeof layout !== 'object') { wsLoadedRef.current = true; return; }
        if (layout.symbol) setSymbol(layout.symbol);
        if (layout.tf && TFS.includes(layout.tf)) setTf(layout.tf);
        if (Array.isArray(layout.overlays)) {
          setOverlays({ ma20: layout.overlays.includes('ma20'), ma50: layout.overlays.includes('ma50'), bb: layout.overlays.includes('bb') });
        }
        if (Array.isArray(layout.subs)) {
          setSubs({ rsi: layout.subs.includes('rsi'), macd: layout.subs.includes('macd'), atr: layout.subs.includes('atr') });
        }
        if (Array.isArray(layout.drawings)) {
          // فقط رسم‌های معتبر را بازگردان
          const valid = layout.drawings.filter((d) => d && d.type && Array.isArray(d.points) && d.points.length
            && d.points.every((p) => p && p.time != null && isFinite(p.price)));
          setDrawings(valid.map((d) => ({
            id: d.id || ('dr_' + Date.now() + '_' + Math.round(Math.random() * 1e4)),
            type: d.type, points: d.points, color: d.color || DRAW_COLORS[d.type] || '#a78bfa',
          })));
        }
      } catch { /* بی‌اعتنا به خطا؛ هرگز رِندر را مسدود نکن */ }
      finally { wsLoadedRef.current = true; }
    })();
    return () => { alive = false; };
    // فقط یک‌بار هنگامِ mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── میزِکار: ذخیرهٔ debounce-دار (فقط غیرکنترل‌شده، و بعد از بارگذاریِ اولیه) ──
  const wsSaveTimerRef = useRef(null);
  useEffect(() => {
    if (controlled) return;
    if (!wsLoadedRef.current) return; // تا بازیابیِ اولیه تمام نشده، ذخیره نکن (جلوگیری از پاک‌کردن)
    if (wsSaveTimerRef.current) clearTimeout(wsSaveTimerRef.current);
    wsSaveTimerRef.current = setTimeout(() => {
      const layout = {
        symbol, tf,
        overlays: OVERLAYS.filter((o) => overlays[o.key]).map((o) => o.key),
        subs: SUBS.filter((s) => subs[s.key]).map((s) => s.key),
        drawings: drawings.map((d) => ({ id: d.id, type: d.type, points: d.points, color: d.color })),
      };
      api.saveWorkspace(layout).catch(() => { /* بی‌اعتنا */ });
    }, 1500);
    return () => { if (wsSaveTimerRef.current) clearTimeout(wsSaveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tf, overlays, subs, drawings, controlled]);

  // ── اکشن‌ها ──
  const fitContent = () => {
    try { mainChartRef.current?.timeScale().fitContent(); } catch { /* */ }
    Object.values(subRefs.current).forEach((s) => { try { s.chart?.timeScale().fitContent(); } catch { /* */ } });
  };
  const changeSymbol = (s) => { setSymbol(s); onSymbolChange && onSymbolChange(s); };
  const changeTf = (t) => { setTf(t); onTfChange && onTfChange(t); };

  // درصدِ تغییرِ افسانه نسبت به open
  const chg = legend && legend.o ? ((legend.c - legend.o) / legend.o) * 100 : null;
  const up = legend ? legend.c >= legend.o : true;

  const Chip = ({ on, onClick, children, title, color }) => (
    <button onClick={onClick} title={title}
      className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition ${on ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary hover:bg-surface-hover'}`}
      style={on && color ? { color, borderColor: color, background: color + '22' } : undefined}>
      {children}
    </button>
  );

  const totalDrawn = hlines.length + drawings.length;

  // مجموعهٔ کنترل‌های ابزارِ رسم (هم در نوارِ اصلی و هم در نوارِ شناورِ فشرده استفاده می‌شود)
  const DrawTools = ({ compact = false }) => (
    <>
      {TOOLS.map((tdef) => {
        const Icon = tdef.icon;
        return (
          <Chip key={tdef.key} on={tool === tdef.key}
            onClick={() => setTool((v) => (v === tdef.key ? 'none' : tdef.key))} title={tdef.label}>
            <span className="inline-flex items-center gap-1"><Icon size={12} />{!compact && (' ' + tdef.label)}</span>
          </Chip>
        );
      })}
      <Chip on={tool === 'hline'} onClick={() => { pendingRef.current = null; hoverRef.current = null; setTool((v) => (v === 'hline' ? 'none' : 'hline')); }} title="خطِ افقی">
        <span className="inline-flex items-center gap-1"><Minus size={12} />{!compact && ' خطِ افقی'}</span>
      </Chip>
      {totalDrawn > 0 && (
        <>
          <Chip on={false} onClick={undoDrawing} title="حذفِ آخرین رسم">
            <span className="inline-flex items-center gap-1"><Eraser size={12} />{!compact && ' واگرد'}</span>
          </Chip>
          <Chip on={false} onClick={() => { clearDrawings(); clearHlines(); }} title="پاک‌کردنِ همهٔ رسم‌ها">
            <span className="inline-flex items-center gap-1"><Trash2 size={12} />{!compact && ' پاک‌همه'}</span>
          </Chip>
        </>
      )}
    </>
  );

  return (
    <div dir="rtl" className="w-full">
      {/* نوارِ ابزار */}
      {showToolbar && (
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <select value={symbol} onChange={(e) => changeSymbol(e.target.value)}
          className="bg-surface-card border border-surface-border rounded-lg px-2 py-1.5 text-xs">
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1">
          {TFS.map((t) => (
            <Chip key={t} on={tf === t} onClick={() => changeTf(t)} title={t}>{t}</Chip>
          ))}
        </div>
        <span className="w-px h-4 bg-surface-border mx-0.5" />
        {OVERLAYS.map((o) => (
          <Chip key={o.key} on={overlays[o.key]} color={o.color}
            onClick={() => setOverlays((s) => ({ ...s, [o.key]: !s[o.key] }))} title={o.label}>{o.label}</Chip>
        ))}
        <span className="w-px h-4 bg-surface-border mx-0.5" />
        {SUBS.map((s) => (
          <Chip key={s.key} on={subs[s.key]}
            onClick={() => setSubs((v) => ({ ...v, [s.key]: !v[s.key] }))} title={s.label}>{s.label}</Chip>
        ))}
        <span className="w-px h-4 bg-surface-border mx-0.5" />
        <DrawTools />
        <button onClick={fitContent} title="جا دادن"
          className="px-2 py-1 rounded-lg border border-surface-border text-text-secondary text-[11px] font-bold hover:bg-surface-hover inline-flex items-center gap-1">
          <Maximize2 size={12} /> جا دادن
        </button>
        {isFetching && <Loader2 size={14} className="animate-spin text-text-muted" />}
      </div>
      )}

      {/* نمودارِ اصلی + افسانهٔ OHLC + کانواسِ سرپوشیِ رسم */}
      <div className="relative rounded-xl overflow-hidden border border-surface-border">
        <div ref={mainBoxRef} style={{ width: '100%', height }} />
        {/* کانواسِ رسم: همیشه pointer-events:none تا کلیک‌ها به نمودار برسند (subscribeClick) */}
        <canvas ref={overlayCanvasRef}
          className="absolute inset-0 z-[5]"
          style={{ pointerEvents: 'none', width: '100%', height: '100%' }} />
        {/* نوارِ شناورِ فشردهٔ ابزارِ رسم (برای استفادهٔ بعدیِ شبیه‌ساز هم در دسترس است) */}
        {!showToolbar && (
          <div dir="rtl" className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-lg p-1 border border-surface-border">
            <DrawTools compact />
          </div>
        )}
        {legend && (
          <div className="absolute top-2 right-2 z-10 pointer-events-none text-[11px] leading-5 px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm border border-surface-border">
            <span className="font-black text-text-primary me-2">{symbol}</span>
            <span className="text-text-muted">O</span> <span style={{ color: up ? pal.up : pal.down }}>{fmt(legend.o)}</span>{' '}
            <span className="text-text-muted">H</span> <span style={{ color: up ? pal.up : pal.down }}>{fmt(legend.h)}</span>{' '}
            <span className="text-text-muted">L</span> <span style={{ color: up ? pal.up : pal.down }}>{fmt(legend.l)}</span>{' '}
            <span className="text-text-muted">C</span> <span style={{ color: up ? pal.up : pal.down }}>{fmt(legend.c)}</span>
            {chg != null && <span className="ms-2" style={{ color: chg >= 0 ? pal.up : pal.down }}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</span>}
          </div>
        )}
        {!candles.length && !isFetching && (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-sm">
            {isError ? 'دادهٔ این نماد در دسترس نیست.' : 'داده‌ای برای نمایش نیست.'}
          </div>
        )}
      </div>

      {/* زیر-پنل‌ها (هرکدام نمونهٔ نمودارِ جدا، هم‌گام با اصلی) */}
      {enabledSubs.map((key) => (
        <div key={key} className="relative mt-1 rounded-xl overflow-hidden border border-surface-border">
          <div id={'cp-sub-' + key} style={{ width: '100%', height: 110 }} />
          <span className="absolute top-1 right-2 z-10 pointer-events-none text-[10px] font-black text-text-muted">
            {SUBS.find((s) => s.key === key)?.label}
          </span>
        </div>
      ))}

      {/* فهرستِ خطوطِ افقی */}
      {hlines.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <span className="text-[11px] text-text-muted">خطوطِ افقی:</span>
          {hlines.map((h) => (
            <span key={h.id} className="inline-flex items-center gap-1 text-[11px] bg-surface-card border border-surface-border rounded-full px-2 py-0.5">
              <span className="text-[#a78bfa] font-bold">{fmt(h.price)}</span>
              <button onClick={() => removeHline(h.id)} className="text-text-muted hover:text-brand-red"><X size={11} /></button>
            </span>
          ))}
        </div>
      )}
      {/* فهرستِ رسم‌های روهم */}
      {drawings.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <span className="text-[11px] text-text-muted">رسم‌ها:</span>
          {drawings.map((d) => {
            const tdef = TOOLS.find((t) => t.key === d.type);
            const Icon = tdef?.icon || Minus;
            return (
              <span key={d.id} className="inline-flex items-center gap-1 text-[11px] bg-surface-card border border-surface-border rounded-full px-2 py-0.5">
                <Icon size={11} style={{ color: d.color }} />
                <span className="font-bold" style={{ color: d.color }}>{tdef?.label || d.type}</span>
                <button onClick={() => removeDrawing(d.id)} className="text-text-muted hover:text-brand-red"><X size={11} /></button>
              </span>
            );
          })}
        </div>
      )}
      {/* راهنمای حالتِ فعال */}
      {hlineTool && <p className="text-[11px] text-brand-green mt-1">حالتِ خطِ افقی فعال است — روی نمودار کلیک کن تا خط اضافه شود.</p>}
      {tool !== 'none' && tool !== 'hline' && (
        <p className="text-[11px] text-brand-green mt-1">
          {tool === 'trendline' && 'حالتِ خطِ روند — دو نقطه را با کلیک انتخاب کن.'}
          {tool === 'fib' && 'حالتِ فیبوناچی — نقطهٔ ابتدا و انتهای موج را کلیک کن.'}
          {tool === 'rect' && 'حالتِ مستطیل — دو گوشهٔ کادر را کلیک کن.'}
          {pendingRef.current ? ' (منتظرِ کلیکِ دوم…)' : ''}
        </p>
      )}
    </div>
  );
}
