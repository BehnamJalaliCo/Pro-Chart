import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries, BarSeries, BaselineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import {
  CandlestickChart, LineChart, AreaChart, BarChart3, Activity, Plus, X, Save,
  Play, Code2, Star, Search, Settings2, Trash2, Bell, FolderOpen, Sun, Moon,
  MousePointer2, Minus, TrendingUp, Move, Square, GitBranch, Type, Crosshair,
  FlaskConical, ShoppingCart, ChevronDown, LayoutGrid, Maximize2,
  ArrowUpRight, Slash, Ruler, Spline, Magnet, Sparkles,
  Undo2, Redo2, Lock, Unlock, Eye, EyeOff, List, Pencil,
} from 'lucide-react';
import { api } from '../api/client';
import { REGISTRY } from '../bazaarnama/indicators';
import { NONSTANDARD, buildNonStandard } from '../bazaarnama/chartbuilders';
import { runScript } from '../bazaarnama/namascript';
import { DrawingLayer } from '../bazaarnama/drawings';
import CodeEditor from '../bazaarnama/CodeEditor';
import { EXAMPLES, REFERENCE } from '../bazaarnama/scriptlib';
import bnLogo from '../assets/bn-logo.png';
import MiniChart from '../bazaarnama/MiniChart';

const TFS = ['M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'D1', 'W1', 'MN'];
// طولِ هر کندل به ثانیه — برای ساختِ کندلِ زندهٔ بعدی و پروجکشنِ رو به جلوی ناحیه‌ها
const TF_SEC = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H2: 7200, H4: 14400, D1: 86400, W1: 604800, MN: 2592000 };
const tfSec = (t) => TF_SEC[t] || 3600;
// تایم‌فریم‌های مشتق‌شده: از تایم‌فریمِ پایه با تجمیع ساخته می‌شوند [پایه, ضریب]
const DERIVED_TF = { M30: ['M15', 2], H2: ['H1', 2], W1: ['D1', 5], MN: ['D1', 22] };
// تجمیعِ کندل‌ها: هر «factor» کندل → یک کندل
const resampleCandles = (cs, factor) => {
  if (factor <= 1) return cs;
  const out = [];
  for (let i = 0; i < cs.length; i += factor) {
    const g = cs.slice(i, i + factor); if (!g.length) break;
    out.push({ t: g[0].t, o: g[0].o, h: Math.max(...g.map((c) => c.h)), l: Math.min(...g.map((c) => c.l)), c: g[g.length - 1].c, v: g.reduce((s, c) => s + (c.v || 0), 0) });
  }
  return out;
};

// نگه‌داریِ میزِکارِ کاربر در مرورگر تا با رفرش/خروج، نماد/تایم‌فریم/اندیکاتورها/ترسیم‌ها پاک نشوند
const WS_KEY = 'bn_workspace';
const loadWS = () => { try { return JSON.parse(localStorage.getItem(WS_KEY) || '{}') || {}; } catch (e) { return {}; } };
const saveWS = (patch) => { try { localStorage.setItem(WS_KEY, JSON.stringify({ ...loadWS(), ...patch })); } catch (e) { /* noop */ } };
const CHART_TYPES = [
  { id: 'candles', label: 'کندل', Icon: CandlestickChart },
  { id: 'hollow', label: 'توخالی', Icon: CandlestickChart },
  { id: 'heikin', label: 'هایکین', Icon: CandlestickChart },
  { id: 'bars', label: 'میله', Icon: BarChart3 },
  { id: 'line', label: 'خطی', Icon: LineChart },
  { id: 'area', label: 'ناحیه', Icon: AreaChart },
  { id: 'baseline', label: 'پایه', Icon: AreaChart },
  { id: 'step', label: 'پلکانی', Icon: LineChart },
  { id: 'renko', label: 'رنکو (Renko)', Icon: CandlestickChart },
  { id: 'range', label: 'بازه‌ای (Range)', Icon: CandlestickChart },
  { id: 'linebreak', label: 'شکستِ خط', Icon: CandlestickChart },
  { id: 'kagi', label: 'کاگی (Kagi)', Icon: LineChart },
  { id: 'pnf', label: 'نقطه‌وشکل (P&F)', Icon: LineChart },
];
const TOOLS = [
  { id: 'cursor', label: 'نشانگر (پیمایشِ چارت)', Icon: MousePointer2 },
  { id: 'select', label: 'انتخاب/ویرایشِ آبجکت — کلیک کن، handleها را بکش', Icon: Move },
  { id: 'trend', label: 'خط روند', Icon: TrendingUp },
  { id: 'ray', label: 'شعاع (ادامه‌دار)', Icon: ArrowUpRight },
  { id: 'hline', label: 'خط افقی', Icon: Minus },
  { id: 'vline', label: 'خط عمودی', Icon: Slash },
  { id: 'rect', label: 'مستطیل', Icon: Square },
  { id: 'fib', label: 'فیبوناچی', Icon: Ruler },
  { id: 'fibext', label: 'فیبوناچی اکستنشن', Icon: Spline },
  { id: 'channel', label: 'کانال موازی (۳ نقطه)', Icon: Move },
  { id: 'pitchfork', label: 'چنگالِ اندروز (۳ نقطه)', Icon: GitBranch },
  { id: 'longshort', label: 'موقعیت لانگ/شورت', Icon: Crosshair },
  { id: 'text', label: 'متن', Icon: Type },
];

const THEMES = {
  dark: { bg: '#0e1117', grid: '#1c2230', text: '#9aa0b5', up: '#26a69a', down: '#ef5350', panel: '#0b0e14', border: '#1c2230' },
  light: { bg: '#ffffff', grid: '#eef1f6', text: '#3a3f50', up: '#089981', down: '#f23645', panel: '#f7f9fc', border: '#e3e8f0' },
};

function heikin(cs) {
  const out = []; let po = null, pc = null;
  for (const c of cs) {
    const hc = (c.o + c.h + c.l + c.c) / 4;
    const ho = po == null ? (c.o + c.c) / 2 : (po + pc) / 2;
    out.push({ t: c.t, o: ho, h: Math.max(c.h, ho, hc), l: Math.min(c.l, ho, hc), c: hc, v: c.v });
    po = ho; pc = hc;
  }
  return out;
}
const valSeries = (cs) => cs.map((c) => ({ time: c.t, value: c.c }));
const ohlc = (cs) => cs.map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }));

let _uid = 0; const uid = () => `i${++_uid}_${Math.floor(Math.random() * 1e6)}`;

// تولتیپِ کوچک هنگامِ hover روی آیکونِ ابزار (توضیحِ کاربرد)
function Tip({ label, children }) {
  return (
    <span className="relative group/tip flex">
      {children}
      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-[#11161f] text-gray-100 text-[11px] px-2 py-1 border border-white/10 shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </span>
  );
}

export default function BazaarNama() {
  const mainRef = useRef(null);
  const overlayRef = useRef(null);
  const subWrapRef = useRef(null);
  const chartRef = useRef(null);
  const priceSeriesRef = useRef(null);
  const drawRef = useRef(null);
  const overlaySeries = useRef({});
  const subChartsRef = useRef({});
  const scriptSeries = useRef([]);
  const scriptHlines = useRef([]);
  const candlesRef = useRef([]);
  const liveLineRef = useRef(null);
  const lastMidRef = useRef({});
  const lazyRef = useRef({ loading: false, exhausted: false }); // بارگذاریِ تنبلِ تاریخ
  const loadMoreRef = useRef(null);
  const easeRef = useRef({ target: null, display: null }); // انیمیشنِ نرمِ قیمتِ زنده (حسِ تیک‌به‌تیک)

  const [symbol, setSymbol] = useState(() => loadWS().symbol || 'EURUSD');
  const [tf, setTf] = useState(() => loadWS().tf || 'H1');
  const [chartType, setChartType] = useState(() => loadWS().chartType || 'candles');
  const [theme, setTheme] = useState(() => loadWS().theme || 'dark');
  const [symbols, setSymbols] = useState([]);
  const [overlays, setOverlays] = useState(() => loadWS().overlays || []);
  const [subs, setSubs] = useState(() => loadWS().subs || []);
  const [indMenu, setIndMenu] = useState(false);
  const [ctMenu, setCtMenu] = useState(false);
  const [watch, setWatch] = useState([]);
  const [rightTab, setRightTab] = useState('watch');
  const [showRight, setShowRight] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 760 : true));
  const [editorOpen, setEditorOpen] = useState(false);
  const [code, setCode] = useState(() => loadWS().code || ''); // کدِ نمااسکریپت با رفرش پاک نمی‌شود
  const [scriptApplied, setScriptApplied] = useState(() => !!loadWS().scriptApplied); // آیا خروجیِ اسکریپت روی چارت اعمال شده
  const scriptAppliedRef = useRef(false);
  const [scripts, setScripts] = useState([]);
  const [scriptName, setScriptName] = useState('اسکریپت من');
  const [alertsOut, setAlertsOut] = useState([]);
  const [runErr, setRunErr] = useState('');
  const [scStudioTab, setScStudioTab] = useState('console'); // console|inputs|reference
  const [scInputDecls, setScInputDecls] = useState([]);
  const [scInputs, setScInputs] = useState({});
  const [scPlots, setScPlots] = useState([]);
  const [scTables, setScTables] = useState([]); // جدول‌های table.new روی چارت
  const [legend, setLegend] = useState(null);
  const [search, setSearch] = useState('');
  const [tool, setTool] = useState('cursor');
  const [editInd, setEditInd] = useState(null); // {scope,id}
  const [layouts, setLayouts] = useState([]);
  const [bt, setBt] = useState(null); // strategy tester result
  const [btCost, setBtCost] = useState({ comm: 0, slip: 0 }); // کارمزد/اسلیپیجِ بک‌تست
  const [btTab, setBtTab] = useState('overview'); // overview | performance | trades
  const [savedAlerts, setSavedAlerts] = useState([]);
  const [alForm, setAlForm] = useState({ op: 'above', value: '', trigger: 'recurring', telegram: false, message: '', expiryH: '' });
  const [live, setLive] = useState({});
  const [marketOpen, setMarketOpen] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [countdown, setCountdown] = useState(''); // شمارشِ معکوسِ بسته‌شدنِ کندل
  const [showVP, setShowVP] = useState(false);
  const [magnet, setMagnet] = useState(false);
  const [order, setOrder] = useState(null); // {side, entry, sl, tp}
  const [aiSig, setAiSig] = useState(null);
  const [aiList, setAiList] = useState([]); // همهٔ سیگنال‌های اخیر — همیشه در ساید‌بار می‌مانند
  const [aiBusy, setAiBusy] = useState(false);
  const [aiQuota, setAiQuota] = useState(null);
  const aiLinesRef = useRef([]);
  const aiZonesRef = useRef([]); // سری‌های ناحیهٔ سبز/قرمزِ سیگنالِ AI (پروجکشنِ رو به جلو)
  const [grid, setGrid] = useState(1); // 1/2/4 چند-چارت
  const [scaleMode, setScaleMode] = useState(0); // 0 عادی / 1 لاگ / 2 درصد
  const [drawColor, setDrawColor] = useState('#3b82f6');
  // ── فاز ۳: ویرایشِ آبجکت ──
  const [stayDraw, setStayDraw] = useState(false);   // ماندن در حالتِ ترسیم
  const [selDraw, setSelDraw] = useState(-1);          // ایندکسِ آبجکتِ انتخاب‌شده
  const [drawList, setDrawList] = useState([]);        // فهرستِ ترسیم‌ها (Object Tree)
  const [showTree, setShowTree] = useState(false);     // نمایشِ Object Tree
  const [drawVer, setDrawVer] = useState(0);           // نسخه برای رفرشِ دکمه‌های undo/redo
  const treeRefresh = useCallback(() => { const dl = drawRef.current; setDrawList(dl ? dl.getDrawings().slice() : []); setDrawVer((v) => v + 1); }, []);
  const rootRef = useRef(null);
  const [replay, setReplay] = useState({ on: false, playing: false, speed: 4 });
  const replayRef = useRef({ full: [], idx: 0 });
  const replayPlayingRef = useRef(false);

  const TH = THEMES[theme];

  // ── ساختِ چارت ──
  useEffect(() => {
    if (!mainRef.current) return;
    const el = mainRef.current;
    const chart = createChart(el, {
      layout: { background: { color: TH.bg }, textColor: TH.text, fontFamily: 'Vazirmatn, sans-serif' },
      grid: { vertLines: { color: TH.grid }, horzLines: { color: TH.grid } },
      timeScale: { timeVisible: true, borderColor: TH.grid, rightOffset: 6 },
      rightPriceScale: { borderColor: TH.grid },
      crosshair: { mode: 0 },
      width: el.clientWidth || 600,
      height: el.clientHeight || 400,
    });
    chartRef.current = chart;
    // لایهٔ ترسیم
    const cv = overlayRef.current;
    const dl = new DrawingLayer(cv, chart);
    drawRef.current = dl;
    // نگه‌داشتنِ خودکارِ ترسیم‌ها در مرورگر + بازیابیِ آن‌ها پس از رفرش
    dl.onChange = (drawings) => { saveWS({ drawings }); setDrawList(drawings.slice()); setDrawVer((v) => v + 1); };
    dl.onSelect = (i) => setSelDraw(i);
    const savedDr = loadWS().drawings;
    if (savedDr && savedDr.length) setTimeout(() => { try { dl.setDrawings(savedDr); } catch (e) {} }, 500);
    // سایزدهیِ صریح (مثلِ Terminalِ کارا) — autoSize با DOMِ مطلق ارتفاعِ صفر می‌داد
    const resize = () => {
      if (!mainRef.current || !chartRef.current) return;
      const w = mainRef.current.clientWidth, h = mainRef.current.clientHeight;
      if (w && h) chartRef.current.applyOptions({ width: w, height: h });
      if (cv) { cv.width = w; cv.height = h; dl.render(); }
      // pane نیتیوِ v5 با چارتِ اصلی به‌صورتِ خودکار resize می‌شود.
    };
    const ro = new ResizeObserver(resize); ro.observe(mainRef.current);
    requestAnimationFrame(resize); setTimeout(resize, 100);
    chart.timeScale().subscribeVisibleLogicalRangeChange((rng) => { dl.render(); if (rng && rng.from < 12 && loadMoreRef.current) loadMoreRef.current(); });
    chart.subscribeCrosshairMove((p) => {
      dl.render();
      if (!p || !p.time || !priceSeriesRef.current) { setLegend(null); return; }
      const d = p.seriesData.get(priceSeriesRef.current);
      if (d) setLegend(d.close != null ? d : { close: d.value });
    });
    return () => { ro.disconnect(); dl.destroy(); chart.remove(); chartRef.current = null; };
    // eslint-disable-next-line
  }, []);

  // اعمالِ تم
  useEffect(() => {
    const ch = chartRef.current; if (!ch) return;
    ch.applyOptions({ layout: { background: { color: TH.bg }, textColor: TH.text }, grid: { vertLines: { color: TH.grid }, horzLines: { color: TH.grid } }, timeScale: { borderColor: TH.grid }, rightPriceScale: { borderColor: TH.grid } });
    // eslint-disable-next-line
  }, [theme]);

  useEffect(() => { if (drawRef.current) drawRef.current.setTool(tool, drawColor); }, [tool, drawColor]);
  useEffect(() => { try { chartRef.current && chartRef.current.priceScale('right').applyOptions({ mode: scaleMode }); } catch (e) {} }, [scaleMode]);

  const buildPriceSeries = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    if (priceSeriesRef.current) { try { chart.removeSeries(priceSeriesRef.current); } catch (e) {} priceSeriesRef.current = null; }
    // انواعِ غیراستاندارد (Renko/Range/LineBreak/Kagi/P&F) — داده را بازنویسی می‌کنند
    if (NONSTANDARD.includes(chartType)) {
      const built = buildNonStandard(chartType, cs);
      let s2;
      if (built && built.kind === 'candle') { s2 = chart.addSeries(CandlestickSeries, { upColor: TH.up, downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down }); s2.setData((built.data || []).map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }))); }
      else { s2 = chart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 }); s2.setData((built && built.data || []).map((p) => ({ time: p.t, value: p.value }))); }
      priceSeriesRef.current = s2; drawRef.current && drawRef.current.setSeries(s2);
      return;
    }
    const data = chartType === 'heikin' ? heikin(cs) : cs;
    let s;
    if (chartType === 'line') s = chart.addSeries(LineSeries,{ color: '#3b82f6', lineWidth: 2 });
    else if (chartType === 'step') s = chart.addSeries(LineSeries,{ color: '#3b82f6', lineWidth: 2, lineType: 1 });
    else if (chartType === 'area') s = chart.addSeries(AreaSeries,{ lineColor: '#3b82f6', topColor: 'rgba(59,130,246,.4)', bottomColor: 'rgba(59,130,246,0)' });
    else if (chartType === 'baseline') s = chart.addSeries(BaselineSeries,{ baseValue: { type: 'price', price: cs[0]?.c || 0 }, topLineColor: TH.up, bottomLineColor: TH.down });
    else if (chartType === 'bars') s = chart.addSeries(BarSeries,{ upColor: TH.up, downColor: TH.down });
    else if (chartType === 'hollow') s = chart.addSeries(CandlestickSeries,{ upColor: 'rgba(0,0,0,0)', downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down });
    else s = chart.addSeries(CandlestickSeries,{ upColor: TH.up, downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down });
    s.setData(['line', 'area', 'baseline', 'step'].includes(chartType) ? valSeries(data) : ohlc(data));
    priceSeriesRef.current = s;
    drawRef.current && drawRef.current.setSeries(s);
  }, [chartType, TH]);

  const applyOverlays = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    Object.values(overlaySeries.current).flat().forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    overlaySeries.current = {};
    const c = { open: cs.map((x) => x.o), high: cs.map((x) => x.h), low: cs.map((x) => x.l), close: cs.map((x) => x.c), volume: cs.map((x) => x.v || 0) };
    overlays.forEach((ov) => {
      const def = REGISTRY[ov.key]; if (!def || def.pane !== 'main') return;
      const r = def.calc(c, ov.inputs); const arr = [];
      const mk = (series, color, w = 2, dashed = false) => { const ls = chart.addSeries(LineSeries,{ color, lineWidth: w, lineStyle: dashed ? 2 : 0, priceLineVisible: false, lastValueVisible: false }); ls.setData(series.map((v, i) => (v == null ? null : { time: cs[i].t, value: v })).filter(Boolean)); arr.push(ls); };
      if (r.lines) r.lines.forEach((ln) => mk(ln.data, ln.color, 1, ln.dashed));
      else if (r.multi) { mk(r.upper, ov.color || def.color, 1, true); mk(r.basis, ov.color || def.color, 1); mk(r.lower, ov.color || def.color, 1, true); }
      else mk(r.line, ov.color || def.color);
      overlaySeries.current[ov.id] = arr;
    });
  }, [overlays]);

  const applySubs = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    // حذفِ سری‌های ساب قبلی (pane نیتیوِ v5 — روی همان چارت)
    Object.values(subChartsRef.current).flat().forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    subChartsRef.current = {};
    if (subWrapRef.current) subWrapRef.current.innerHTML = '';
    const c = { open: cs.map((x) => x.o), high: cs.map((x) => x.h), low: cs.map((x) => x.l), close: cs.map((x) => x.c), volume: cs.map((x) => x.v || 0) };
    const subList = subs.filter((sub) => { const d = REGISTRY[sub.key]; return d && d.pane === 'sub'; });
    subList.forEach((sub, idx) => {
      const def = REGISTRY[sub.key];
      const pane = idx + 1;                 // pane 0 = چارتِ اصلی
      const r = def.calc(c, sub.inputs);
      const arr = [];
      const L = (opts, data) => { const s = chart.addSeries(LineSeries, { lineWidth: 1, priceLineVisible: false, lastValueVisible: true, ...opts }, pane); s.setData(data.map((v, i) => (v == null ? null : { time: cs[i].t, value: v })).filter(Boolean)); arr.push(s); return s; };
      if (r.macd) {
        const h = chart.addSeries(HistogramSeries, { priceLineVisible: false }, pane); h.setData(r.hist.map((v, i) => (v == null ? null : { time: cs[i].t, value: v, color: v >= 0 ? 'rgba(38,166,154,.6)' : 'rgba(239,83,80,.6)' })).filter(Boolean)); arr.push(h);
        L({ color: '#3b82f6' }, r.line); L({ color: '#f59e0b' }, r.signal);
      } else {
        const l1 = L({ color: sub.color || def.color }, r.line);
        if (r.signal) L({ color: '#f59e0b' }, r.signal);
        (r.guides || []).forEach((g) => l1.createPriceLine({ price: g, color: TH.grid, lineWidth: 1, lineStyle: 2 }));
      }
      try { const panes = chart.panes(); if (panes && panes[pane]) panes[pane].setHeight(108); } catch (e) {}
      subChartsRef.current[sub.id] = arr;
    });
  }, [subs, TH]);

  // بارگذاریِ تنبلِ کندل‌های قدیمی‌تر هنگامِ اسکرول به چپ
  const loadMoreHistory = useCallback(async () => {
    const lz = lazyRef.current; if (lz.loading || lz.exhausted) return;
    if (NONSTANDARD.includes(chartType) || DERIVED_TF[tf]) return; // چارت‌های زمان‌مستقل / تایم‌فریمِ تجمیعی
    const cs = candlesRef.current; if (cs.length < 50) return;
    lz.loading = true;
    try {
      const oldest = cs[0].t;
      const r = await api.chart(symbol, tf, '', 500, oldest - 1);
      const older = (r.candles || []).map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v })).filter((c) => c.t < oldest);
      if (!older.length) { lz.exhausted = true; return; }
      const merged = older.concat(cs); candlesRef.current = merged;
      const s = priceSeriesRef.current;
      if (s) { const data = chartType === 'heikin' ? heikin(merged) : merged; s.setData(['line', 'area', 'baseline', 'step'].includes(chartType) ? valSeries(data) : ohlc(data)); }
      applyOverlays(merged); applySubs(merged);
      if (drawRef.current) drawRef.current.setCandles(merged);
    } catch (e) { /* */ } finally { lz.loading = false; }
  }, [symbol, tf, chartType, applyOverlays, applySubs]);
  useEffect(() => { loadMoreRef.current = loadMoreHistory; }, [loadMoreHistory]);

  const load = useCallback(async () => {
    lazyRef.current = { loading: false, exhausted: false };
    easeRef.current = { target: null, display: null };
    try {
      // تایم‌فریمِ مشتق‌شده (M30/H2/W1/MN) → از تایم‌فریمِ پایه می‌گیریم و تجمیع می‌کنیم
      const der = DERIVED_TF[tf];
      const fetchTf = der ? der[0] : tf;
      const factor = der ? der[1] : 1;
      const r = await api.chart(symbol, fetchTf, '', 800 * factor);
      let cs = (r.candles || []).map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }));
      if (factor > 1) cs = resampleCandles(cs, factor);
      candlesRef.current = cs;
      buildPriceSeries(cs); applyOverlays(cs); applySubs(cs);
      if (drawRef.current) drawRef.current.setCandles(cs);
      chartRef.current && chartRef.current.timeScale().fitContent();
      if (showVP) applyVP(cs);
      // بازیابیِ سیگنالِ AIِ فعال برای این نماد/تایم‌فریم پس از رفرش یا تعویضِ نماد
      // (سیگنال در سرور ذخیره است؛ ساختِ دوبارهٔ سری، نقاشیِ قبلی را پاک می‌کند پس دوباره رسم می‌کنیم)
      try {
        const list = await api.bnAiActive();
        setAiList(list || []);
        const match = (list || []).find((x) => x.status === 'active' && x.symbol === symbol && x.tf === tf) || null;
        setAiSig(match); drawAiLines(match);
        if (match) focusSetupView(); // زوم‌اوت تا کندل‌ها و جعبه‌های ستاپ دیده شوند
      } catch (e) { /* noop */ }
      // بازاجرای ستاپِ نمااسکریپت تا با تعویضِ نماد/تایم‌فریم یا رفرش، روی چارت بماند
      try { if (scriptAppliedRef.current && code && code.trim()) { await compile(); focusSetupView(); } } catch (e) { /* noop */ }
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tf, buildPriceSeries, applyOverlays, applySubs, chartType]);
  useEffect(() => { load(); }, [load]);
  // نگه‌داشتنِ خودکارِ میزِکار (نماد/تایم‌فریم/نوعِ چارت/تم/اندیکاتورها) — رفرش/خروج پاکش نمی‌کند
  useEffect(() => { saveWS({ symbol, tf, chartType, theme, overlays, subs }); }, [symbol, tf, chartType, theme, overlays, subs]);
  // نگه‌داشتنِ کدِ نمااسکریپت + وضعیتِ اعمال‌شدنِ آن (تا با رفرش/تعویضِ تایم‌فریم بماند)
  useEffect(() => { saveWS({ code }); }, [code]);
  useEffect(() => { scriptAppliedRef.current = scriptApplied; saveWS({ scriptApplied }); }, [scriptApplied]);

  // Volume Profile — هیستوگرامِ توزیعِ قیمت (با وزنِ حجم؛ چون حجمِ داده صفر است، توزیعِ قیمت)
  const applyVP = useCallback((cs) => {
    if (!drawRef.current) return;
    const data = cs || candlesRef.current; if (!data.length) { drawRef.current.setProfile(null); return; }
    let lo = Infinity, hi = -Infinity;
    data.forEach((c) => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
    const B = 48, step = (hi - lo) / B || 1, buckets = Array.from({ length: B }, (_, i) => ({ lo: lo + i * step, hi: lo + (i + 1) * step, vol: 0, poc: false }));
    data.forEach((c) => { const w = (c.v || 1); const mid = (c.h + c.l) / 2; const bi = Math.min(B - 1, Math.max(0, Math.floor((mid - lo) / step))); buckets[bi].vol += w; });
    let pocI = 0; buckets.forEach((b, i) => { if (b.vol > buckets[pocI].vol) pocI = i; }); buckets[pocI].poc = true;
    drawRef.current.setProfile(buckets);
  }, []);

  useEffect(() => { if (drawRef.current) { showVP ? applyVP() : drawRef.current.setProfile(null); } }, [showVP, applyVP]);
  useEffect(() => { if (drawRef.current) drawRef.current.setMagnet(magnet); }, [magnet]);
  useEffect(() => { if (drawRef.current) drawRef.current.setStayInMode(stayDraw); }, [stayDraw]);
  // شمارشِ معکوسِ بسته‌شدنِ کندلِ جاری
  useEffect(() => {
    if (NONSTANDARD.includes(chartType)) { setCountdown(''); return undefined; }
    const sec = tfSec(tf);
    const tick = () => { const now = Math.floor(Date.now() / 1000); const rem = sec - (now % sec); const h = Math.floor(rem / 3600), m = Math.floor((rem % 3600) / 60), s = rem % 60; setCountdown(h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [tf, chartType]);
  // اتصالِ خطوطِ سفارش به چارت + همگام‌سازیِ درگ
  useEffect(() => { if (drawRef.current) { drawRef.current.setOrder(order); drawRef.current.onOrder = (o) => setOrder(o); } }, [order]);
  const curPrice = () => livePrice || (candlesRef.current.length ? candlesRef.current[candlesRef.current.length - 1].c : 0);
  const startTrade = (side) => { const e = curPrice(); if (!e) return; const d = e * 0.005; setOrder({ side, entry: e, sl: side === 'buy' ? e - d : e + d, tp: side === 'buy' ? e + 2 * d : e - 2 * d }); setRightTab('trade'); };
  const submitOrder = async () => { if (!order) return; try { await api.paperOpen({ symbol, direction: order.side, entry: order.entry, sl: order.sl, tp: order.tp, risk_pct: 1 }); window.alert('سفارش ثبت شد ✓'); setOrder(null); } catch (e) { window.alert('خطا در ثبت'); } };

  // بازهٔ زمانیِ ناحیه‌ها: از کندلِ آخر «رو به جلو» (به آینده) امتداد می‌یابد — نه روی کندل‌های قبلی.
  const zoneWindow = useCallback(() => {
    const cs = candlesRef.current; const sec = tfSec(tf);
    const lastT = cs.length ? cs[cs.length - 1].t : Math.floor(Date.now() / 1000);
    return { from: lastT - sec, to: lastT + sec * 16 };
  }, [tf]);

  // زوم‌اوتِ مناسب: ~۸۰ کندلِ آخر + فضای آینده تا جعبه‌های ستاپ و کندل‌ها خوب دیده شوند
  const focusSetupView = useCallback(() => {
    const ch = chartRef.current; if (!ch) return;
    try {
      const n = candlesRef.current.length; if (!n) return;
      ch.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 80), to: n + 18 });
    } catch (e) { try { chartRef.current.timeScale().fitContent(); } catch (e2) {} }
  }, []);

  // بازخوانیِ فهرستِ سیگنال‌های AI (تا در ساید‌بار با عوض‌شدنِ تایم‌فریم غیب نشوند)
  const refreshAiList = useCallback(() => {
    api.bnAiActive().then((list) => setAiList(list || [])).catch(() => {});
  }, []);

  // جعبهٔ کم‌رنگِ ناحیه (بین entry و level) — برای هدف/حد ضرر. سبز = TP، قرمز = SL.
  const drawZone = useCallback((entry, level, fromTime, toTime, line, fill, title, store) => {
    const ch = chartRef.current; if (!ch || entry == null || level == null) return;
    const s = ch.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: entry },
      topLineColor: line, topFillColor1: fill, topFillColor2: fill,
      bottomLineColor: line, bottomFillColor1: fill, bottomFillColor2: fill,
      lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title,
      autoscaleInfoProvider: () => null,
    });
    s.setData([{ time: fromTime, value: level }, { time: toTime, value: level }]);
    (store || scriptSeries.current).push(s);
  }, []);

  // خطِ افقیِ مرزِ ناحیه (TP1/TP2/TP3/SL) با پروجکشنِ رو به جلو
  const drawZoneLine = useCallback((price, fromTime, toTime, color, title, store) => {
    const ch = chartRef.current; if (!ch || price == null) return;
    const s = ch.addSeries(LineSeries, {
      color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: true, title,
      autoscaleInfoProvider: () => null,
    });
    s.setData([{ time: fromTime, value: price }, { time: toTime, value: price }]);
    (store || scriptSeries.current).push(s);
  }, []);

  // رسمِ کاملِ یک ستاپ: جعبهٔ سبزِ هدف (تا TP3) + خطوطِ TP1/TP2/TP3 + جعبهٔ قرمزِ حد ضرر + خطِ SL — همه رو به جلو
  const drawSetupZones = useCallback((entry, sl, tps, store) => {
    const { from, to } = zoneWindow();
    const list = (tps || []).filter((v) => v != null);
    const tpTop = list.length ? list[list.length - 1] : null;
    if (tpTop != null) drawZone(entry, tpTop, from, to, '#22c55e', 'rgba(34,197,94,0.13)', 'هدف', store);
    if (sl != null) drawZone(entry, sl, from, to, '#ef4444', 'rgba(239,68,68,0.14)', 'حد ضرر', store);
    list.forEach((tp, i) => drawZoneLine(tp, from, to, '#22c55e', `TP${i + 1}`, store));
    if (sl != null) drawZoneLine(sl, from, to, '#ef4444', 'SL', store);
  }, [zoneWindow, drawZone, drawZoneLine]);

  // ── سیگنالِ لحظه‌ایِ AI ── خطوطِ دقیقِ ورود/SL/TP + جعبه‌های سبز/قرمزِ رو به جلو
  const drawAiLines = useCallback((sig) => {
    const s = priceSeriesRef.current; if (!s) return;
    aiLinesRef.current.forEach((l) => { try { s.removePriceLine(l); } catch (e) {} });
    aiLinesRef.current = [];
    const ch = chartRef.current;
    aiZonesRef.current.forEach((z) => { try { ch && ch.removeSeries(z); } catch (e) {} });
    aiZonesRef.current = [];
    if (!sig) return;
    const add = (price, color, title) => { try { aiLinesRef.current.push(s.createPriceLine({ price, color, lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title })); } catch (e) {} };
    add(sig.entry, '#3b82f6', `ورود ${sig.direction === 'buy' ? '🟢' : '🔴'}`);
    add(sig.sl, '#ef4444', 'حد ضرر');                 // قرمز
    add(sig.tp1, '#22c55e', 'TP1');                   // سبز
    if (sig.tp2) add(sig.tp2, '#16a34a', 'TP2');
    if (sig.tp3) add(sig.tp3, '#15803d', 'TP3');
    // جعبه‌های شفافِ رو به جلو (آینده): سبز تا TP3، قرمز تا حد ضرر
    const tps = [sig.tp1, sig.tp2, sig.tp3].filter((v) => v != null);
    drawSetupZones(sig.entry, sig.sl, tps, aiZonesRef.current);
  }, [drawSetupZones]);

  // رفتن به یک سیگنال: نماد/تایم‌فریمِ همان سیگنال را باز کن؛ اگر همان نماد/تایم‌فریم بود، رسم و زوم‌اوت کن
  const gotoSignal = useCallback((sig) => {
    if (!sig) return;
    setRightTab('ai');
    const same = sig.symbol === symbol && sig.tf === tf;
    if (sig.symbol && sig.symbol !== symbol) setSymbol(sig.symbol);
    if (sig.tf && sig.tf !== tf) setTf(sig.tf);
    if (same) { setAiSig(sig); drawAiLines(sig); focusSetupView(); } // load اجرا نمی‌شود؛ همین‌جا نشان بده
  }, [symbol, tf, drawAiLines, focusSetupView]);

  const getAiSignal = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      const r = await api.bnAiSignal(symbol, tf);
      setAiSig(r); drawAiLines(r); focusSetupView();
      setAiQuota((q) => ({ ...(q || {}), remaining: r.remaining, used: (q?.used || 0) + 1 }));
      setRightTab('ai');
      refreshAiList();
    } catch (e) {
      window.alert(e?.message || 'خطا در دریافتِ سیگنال');
    } finally { setAiBusy(false); }
  };
  // فقط از چارت پنهان می‌کند (سیگنال در فهرست/سرور می‌ماند؛ سهمیه پس داده نمی‌شود)
  const clearAiSig = () => { setAiSig(null); drawAiLines(null); };
  const deleteSignal = async (s) => { try { await api.bnAiDelete(s.id); } catch (e) {} if (aiSig?.id === s.id) { setAiSig(null); drawAiLines(null); } refreshAiList(); };

  useEffect(() => { api.bnAiQuota().then(setAiQuota).catch(() => {}); refreshAiList(); }, [refreshAiList]);
  // به‌روزرسانیِ فهرست و وضعیتِ سیگنال‌ها (TP/SL خورده) هر ۲۰ ثانیه
  useEffect(() => {
    const id = setInterval(() => {
      api.bnAiActive().then((list) => {
        setAiList(list || []);
        if (aiSig) { const cur = (list || []).find((x) => x.id === aiSig.id); if (cur) setAiSig((s) => ({ ...s, status: cur.status, hit: cur.hit })); }
      }).catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, [aiSig?.id]);

  // ── Replay (بازپخشِ تاریخی) ──
  const enterReplay = () => {
    const full = candlesRef.current.slice(); if (full.length < 30) return;
    const start = Math.floor(full.length * 0.55);
    replayRef.current = { full, idx: start };
    const slice = full.slice(0, start + 1);
    candlesRef.current = slice;
    buildPriceSeries(slice); applyOverlays(slice); applySubs(slice);
    chartRef.current && chartRef.current.timeScale().fitContent();
    setReplay({ on: true, playing: false, speed: 4 });
  };
  const exitReplay = () => { setReplay({ on: false, playing: false, speed: 4 }); load(); };
  const replayStep = useCallback(() => {
    const r = replayRef.current; if (r.idx >= r.full.length - 1) { setReplay((s) => ({ ...s, playing: false })); return; }
    r.idx += 1; const c = r.full[r.idx];
    candlesRef.current = r.full.slice(0, r.idx + 1);
    try { if (['line', 'area', 'baseline', 'step'].includes(chartType)) priceSeriesRef.current.update({ time: c.t, value: c.c }); else priceSeriesRef.current.update({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }); } catch (e) {}
  }, [chartType]);
  useEffect(() => { replayPlayingRef.current = replay.on; }, [replay.on]);
  useEffect(() => {
    if (!replay.on || !replay.playing) return;
    const id = setInterval(replayStep, Math.max(120, 1600 / replay.speed));
    return () => clearInterval(id);
  }, [replay.on, replay.playing, replay.speed, replayStep]);

  // ── Real-time: آپدیتِ کندلِ در حالِ شکل‌گیری + خطِ قیمتِ زنده ──
  // به‌روزرسانیِ واقعیِ چارت با یک مقدارِ قیمت (کندلِ جاری + خطِ LIVE) — هر فریمِ انیمیشن صدا زده می‌شود
  const applyMid = useCallback((mid) => {
    if (replayRef.current && replayPlayingRef.current) return;
    if (NONSTANDARD.includes(chartType)) return;
    const s = priceSeriesRef.current; if (!s) return;
    const cs = candlesRef.current; if (!cs.length) return;
    const last = cs[cs.length - 1];
    if (!Number.isFinite(mid) || (last.c && Math.abs(mid - last.c) / last.c > 0.2)) return;
    const isVal = ['line', 'area', 'baseline', 'step'].includes(chartType);
    const sec = tfSec(tf);
    const curBar = Math.floor(Math.floor(Date.now() / 1000) / sec) * sec;
    try {
      if (curBar > last.t) {
        const nc = { t: curBar, o: last.c, h: Math.max(last.c, mid), l: Math.min(last.c, mid), c: mid, v: 0 };
        cs.push(nc); if (cs.length > 2000) cs.shift();
        if (isVal) s.update({ time: curBar, value: mid });
        else if (chartType !== 'heikin') s.update({ time: curBar, open: nc.o, high: nc.h, low: nc.l, close: nc.c });
      } else {
        last.h = Math.max(last.h, mid); last.l = Math.min(last.l, mid); last.c = mid;
        if (isVal) s.update({ time: last.t, value: mid });
        else if (chartType !== 'heikin') s.update({ time: last.t, open: last.o, high: last.h, low: last.l, close: mid });
      }
    } catch (e) { /* */ }
    // خطِ LIVE با applyOptions (سبک، هر فریم بدونِ remove/create)
    try { if (liveLineRef.current) liveLineRef.current.applyOptions({ price: mid }); else liveLineRef.current = s.createPriceLine({ price: mid, color: '#2962FF', lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'LIVE' }); } catch (e) { /* */ }
  }, [chartType, tf]);

  // تیکِ واقعی → فقط «هدف» را تنظیم می‌کند؛ حلقهٔ انیمیشن نرم به سمتش می‌بَرَد (حسِ تیک‌به‌تیک)
  const applyTick = useCallback((mid) => {
    if (NONSTANDARD.includes(chartType)) { setLivePrice(mid); return; }
    if (!Number.isFinite(mid)) return;
    const e = easeRef.current; e.target = mid;
    if (e.display == null) { e.display = mid; applyMid(mid); } // اولین تیک: فوری
    setLivePrice(mid);
  }, [chartType, applyMid]);

  // حلقهٔ ۶۰fps: کندلِ زنده «تیک‌به‌تیک» — هم نرم به قیمتِ واقعی همگرا می‌شود،
  // هم یک نوسانِ ریزِ کران‌دار می‌گیرد تا مثلِ پلتفرم‌های واقعی پیوسته تیک بزند.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const e = easeRef.current;
      if (e.target != null && e.display != null && priceSeriesRef.current && !(replayRef.current && replayPlayingRef.current) && !NONSTANDARD.includes(chartType)) {
        // ۱) همگرایی به قیمتِ واقعی
        e.display += (e.target - e.display) * 0.18;
        // ۲) تیکِ زندهٔ ریز (فقط بصری؛ کران‌دار به کسری از دامنهٔ کندل/۰٫۳ پیپ — قیمتِ واقعی دست‌نخورده)
        const cs = candlesRef.current; const last = cs && cs.length ? cs[cs.length - 1] : null;
        const amp = last ? Math.max((last.h - last.l) * 0.06, Math.abs(e.target) * 0.00003) : 0;
        e.noise = (e.noise || 0) * 0.86 + (Math.random() - 0.5) * amp * 0.55;
        if (e.noise > amp) e.noise = amp; else if (e.noise < -amp) e.noise = -amp;
        applyMid(e.display + e.noise);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [applyMid, chartType]);

  // حلقهٔ نظرسنجیِ قیمتِ زنده (هر ۱.۵ ثانیه) — برای نماد + واچ‌لیست
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const list = rightTab === 'screener' ? symbols : [symbol, ...watch];
        const syms = Array.from(new Set(list)).join(',');
        if (!syms) return;
        const r = await api.bnPrices(syms);
        if (stop) return;
        setMarketOpen(!!r.market_open);
        const prices = r.prices || {};
        const lv = {};
        Object.entries(prices).forEach(([k, v]) => {
          const prev = lastMidRef.current[k];
          lv[k] = { mid: v.mid, dir: prev == null ? 0 : (v.mid > prev ? 1 : v.mid < prev ? -1 : 0) };
          lastMidRef.current[k] = v.mid;
        });
        setLive(lv);
        if (prices[symbol]) applyTick(prices[symbol].mid);
        else setLivePrice(null);
      } catch (e) {}
    };
    poll();
    const id = setInterval(poll, 700);
    return () => { stop = true; clearInterval(id); };
  }, [symbol, watch, applyTick, rightTab, symbols]);

  // تازه‌سازیِ آلارم‌ها (برای نمایشِ trigger‌های سمتِ‌سرور) هر ۳۰ ثانیه
  useEffect(() => {
    const id = setInterval(() => { api.bnAlerts().then((r) => setSavedAlerts(r || [])).catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, []);

  // WebSocket پوشِ قیمتِ زنده — فقط اگر مسیرِ /ws/prices در این دامنه proxy شده باشد.
  // (روی دامنهٔ آکادمی proxy نشده؛ poll هر ۱.۵ث real-time را تأمین می‌کند. برای جلوگیری
  //  از نویزِ کنسول، اتصال غیرفعال است و با ست‌شدنِ متغیرِ محیطی فعال می‌شود.)
  useEffect(() => {
    if (!import.meta.env.VITE_BN_WS) return;
    let ws, alive = true;
    try {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}/ws/prices`);
      ws.onmessage = (ev) => { if (!alive) return; try { const msg = JSON.parse(ev.data); const prices = msg.prices || msg || {}; const p = prices[symbol]; if (p) { const mid = p.mid != null ? p.mid : ((Number(p.bid) + Number(p.ask)) / 2); if (Number.isFinite(mid)) applyTick(mid); } } catch (e) {} };
      ws.onerror = () => { try { ws.close(); } catch (e) {} };
    } catch (e) {}
    return () => { alive = false; try { ws && ws.close(); } catch (e) {} };
  }, [symbol, applyTick]);

  useEffect(() => {
    api.chartSymbols().then((r) => setSymbols(r.symbols || [])).catch(() => {});
    api.bnWatchlist().then((r) => setWatch(r.symbols || [])).catch(() => {});
    api.bnScripts().then((r) => { setScripts(r.scripts || []); if (!code) setCode(r.starter || ''); }).catch(() => {});
    api.bnLayouts().then((r) => setLayouts(r || [])).catch(() => {});
    api.bnAlerts().then((r) => setSavedAlerts(r || [])).catch(() => {});
    // eslint-disable-next-line
  }, []);

  // ── نمااسکریپت ──
  const compile = async (inputs) => {
    const cs = candlesRef.current; if (!cs.length) return null;
    const res = await runScript(code, cs, inputs || scInputs);
    // پاکسازیِ خروجیِ قبلی
    scriptSeries.current.forEach((s) => { try { chartRef.current.removeSeries(s); } catch (e) {} }); scriptSeries.current = [];
    if (priceSeriesRef.current) scriptHlines.current.forEach((h) => { try { priceSeriesRef.current.removePriceLine(h); } catch (e) {} });
    scriptHlines.current = [];
    if (!res.ok) { setRunErr(res.error || 'خطا'); setScPlots([]); return null; }
    setRunErr('');
    if (res.inputs) setScInputDecls(res.inputs);
    setScPlots((res.plots || []).map((p) => ({ name: p.name, color: p.color })));
    // خطوطِ plot — از autoscale خارج می‌شوند تا اسیلاتورهای روی پنلِ اصلی، مقیاسِ کندل را نشکنند
    (res.plots || []).forEach((pl) => {
      const data = pl.data.filter((d) => Number.isFinite(d.value));
      const ls = chartRef.current.addSeries(LineSeries,{ color: pl.color, lineWidth: pl.width || 2, priceLineVisible: false, lastValueVisible: false, autoscaleInfoProvider: () => null });
      ls.setData(data.map((d) => ({ time: d.time, value: d.value }))); scriptSeries.current.push(ls);
    });
    // plotcandle — کندل‌های سفارشیِ اسکریپت
    (res.candleplots || []).forEach((cp) => {
      try {
        const cls = chartRef.current.addSeries(CandlestickSeries, { upColor: TH.up, downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down, priceLineVisible: false, lastValueVisible: false });
        cls.setData(cp.data); scriptSeries.current.push(cls);
      } catch (e) { /* */ }
    });
    // hline
    if (priceSeriesRef.current) (res.hlines || []).forEach((h) => { try { scriptHlines.current.push(priceSeriesRef.current.createPriceLine({ price: h.price, color: h.color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: h.title || '' })); } catch (e) {} });
    // ناحیه‌های ریسک/ریوارد: جعبهٔ سبزِ هدف (تا TP3) + جعبهٔ قرمزِ حد ضرر — رو به جلو (آینده)
    (res.zones || []).forEach((z) => { try { const tps = z.tps && z.tps.length ? z.tps : (z.tp != null ? [z.tp] : []); drawSetupZones(z.entry, z.sl, tps); } catch (e) {} });
    // گرافیکِ نمااسکریپت روی کانواس: fill / bgcolor / barcolor / line.new / box.new
    try { if (drawRef.current) drawRef.current.setScriptPaint({ fills: res.fills || [], bgs: res.bgs || [], barcolors: res.barcolors || [], lines: res.lines || [], boxes: res.boxes || [] }); } catch (e) { /* */ }
    // جدول‌های روی چارت (table.new) — overlayِ HTML
    setScTables(res.tables || []);
    // مارکرها: شکل‌ها + برچسب‌ها
    if (priceSeriesRef.current) {
      const markers = [];
      (res.shapes || []).forEach((sh) => sh.points.forEach((pt) => markers.push({ time: pt.time, position: pt.shape === 'down' ? 'aboveBar' : 'belowBar', color: sh.color, shape: pt.shape === 'down' ? 'arrowDown' : (pt.shape === 'circle' ? 'circle' : 'arrowUp'), text: sh.name })));
      (res.labels || []).forEach((lb) => markers.push({ time: lb.time, position: 'aboveBar', color: lb.color, shape: 'circle', text: lb.text }));
      markers.sort((a, b) => a.time - b.time);
      const s = priceSeriesRef.current;
      if (!s.__markers) s.__markers = createSeriesMarkers(s, []);
      s.__markers.setMarkers(markers);
    }
    return res;
  };
  const onRun = async () => { setBt(null); const res = await compile(); if (res) { setAlertsOut((res.alerts || []).map((a) => ({ msg: a.msg, count: a.bars.length }))); setScriptApplied(true); focusSetupView(); } };
  // پاکِ صفحه: حذفِ خروجی‌های اسکریپت (خط/بای‌سل) + سیگنالِ AI + خطوطِ سفارش از روی چارت
  const clearScreen = () => {
    const ch = chartRef.current, s = priceSeriesRef.current;
    if (ch) { scriptSeries.current.forEach((x) => { try { ch.removeSeries(x); } catch (e) {} }); scriptSeries.current = []; }
    if (s) {
      scriptHlines.current.forEach((h) => { try { s.removePriceLine(h); } catch (e) {} }); scriptHlines.current = [];
      try { if (!s.__markers) s.__markers = createSeriesMarkers(s, []); s.__markers.setMarkers([]); } catch (e) {}
    }
    setScPlots([]); setAlertsOut([]); setBt(null);
    try { if (drawRef.current) drawRef.current.setScriptPaint(null); } catch (e) { /* */ }
    setScTables([]);
    drawAiLines(null); setAiSig(null);
    setScriptApplied(false); // ستاپِ نمااسکریپت دیگر روی چارت اعمال نشود (با رفرش هم برنگردد)
    if (order) setOrder(null);
  };
  const onInputChange = async (key, val) => { const ni = { ...scInputs, [key]: val }; setScInputs(ni); await compile(ni); };

  // Strategy Tester — از خروجیِ strategy.entry موتور؛ یا fallback از alertcondition
  const onBacktest = async () => {
    const res = await compile({ ...scInputs, __comm: Number(btCost.comm) || 0, __slip: Number(btCost.slip) || 0 }); if (!res) return;
    if (res.strategy) { const s = res.strategy; setBt({ ...s, full: true, pfTxt: (typeof s.pf === 'number' ? s.pf.toFixed(2) : s.pf), ddTxt: (s.dd || 0).toFixed(5) }); setBtTab('overview'); return; }
    if (!res.alerts || res.alerts.length < 2) { setBt({ err: 'برای بک‌تست از strategy.entry یا دو alertcondition (خرید/فروش) استفاده کن.' }); return; }
    const cs = candlesRef.current;
    const buys = new Set(res.alerts[0].bars), sells = new Set(res.alerts[1].bars);
    let pos = null, eq = 0, peak = 0, dd = 0, wins = 0, gp = 0, gl = 0, n = 0;
    cs.forEach((c) => {
      if (!pos && buys.has(c.t)) pos = c.c;
      else if (pos && sells.has(c.t)) { const r = c.c - pos; eq += r; n++; if (r >= 0) { wins++; gp += r; } else gl += -r; pos = null; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
    });
    setBt({ trades: n, net: eq, win: n ? Math.round((wins / n) * 100) : 0, pf: gl ? (gp / gl).toFixed(2) : '∞', dd: dd.toFixed(5) });
  };
  const loadExample = (ex) => { setCode(ex.code); setScriptName(ex.name); setScInputs({}); setScInputDecls([]); };

  const onSaveScript = async () => { try { const r = await api.bnScriptSave({ name: scriptName, source: code }); setScripts((s) => [{ id: r.id, name: scriptName }, ...s.filter((x) => x.id !== r.id)]); } catch (e) {} };
  const loadScript = async (id) => { try { const r = await api.bnScriptGet(id); setCode(r.source || ''); setScriptName(r.name || 'اسکریپت'); } catch (e) {} };

  const addInd = (key) => { const def = REGISTRY[key]; const item = { id: uid(), key, inputs: { ...def.inputs }, color: def.color }; if (def.pane === 'main') setOverlays((o) => [...o, item]); else setSubs((s) => [...s, item]); setIndMenu(false); };
  const rmInd = (scope, id) => { if (scope === 'main') setOverlays((o) => o.filter((x) => x.id !== id)); else setSubs((s) => s.filter((x) => x.id !== id)); };
  const updInd = (scope, id, patch) => { const fn = (arr) => arr.map((x) => (x.id === id ? { ...x, ...patch, inputs: { ...x.inputs, ...(patch.inputs || {}) } } : x)); if (scope === 'main') setOverlays(fn); else setSubs(fn); };

  const toggleWatch = async (sym) => { const next = watch.includes(sym) ? watch.filter((s) => s !== sym) : [...watch, sym]; setWatch(next); try { await api.bnWatchlistSet(next); } catch (e) {} };

  // لِی‌اوت
  const _persistRef = useRef(null);
  const persistLayoutDebounced = () => {};
  const saveLayout = async () => {
    const name = window.prompt('نامِ چیدمان:', 'چیدمان من'); if (!name) return;
    const data = { symbol, tf, chartType, theme, overlays, subs, drawings: drawRef.current ? drawRef.current.getDrawings() : [] };
    try { const r = await api.bnLayoutSave({ name, data }); setLayouts((l) => [{ id: r.id, name }, ...l]); } catch (e) {}
  };
  const loadLayout = async (id) => {
    try { const r = await api.bnLayoutGet(id); const d = r.data || {};
      if (d.theme) setTheme(d.theme); if (d.chartType) setChartType(d.chartType);
      setOverlays(d.overlays || []); setSubs(d.subs || []); if (d.symbol) setSymbol(d.symbol); if (d.tf) setTf(d.tf);
      setTimeout(() => drawRef.current && drawRef.current.setDrawings(d.drawings || []), 400);
    } catch (e) {}
  };

  // آلارم
  const OP_LABELS = { above: 'بالای', below: 'پایینِ', cross_up: 'تقاطعِ صعودی از', cross_down: 'تقاطعِ نزولی از', cross: 'تقاطعِ', pct_up: 'صعودِ ٪', pct_down: 'نزولِ ٪' };
  const createAlert = async () => {
    if (!alForm.value) return;
    const expiry = alForm.expiryH ? new Date(Date.now() + Number(alForm.expiryH) * 3600 * 1000).toISOString() : null;
    const cond = { type: 'price', op: alForm.op, value: Number(alForm.value), trigger: alForm.trigger, telegram: !!alForm.telegram };
    if (alForm.message) cond.message = alForm.message;
    if (expiry) cond.expiry = expiry;
    try {
      await api.bnAlertCreate({ symbol, tf, name: `${symbol} ${OP_LABELS[alForm.op] || ''} ${alForm.value}`, condition: cond });
      const r = await api.bnAlerts(); setSavedAlerts(r || []); setAlForm({ op: 'above', value: '', trigger: 'recurring', telegram: false, message: '', expiryH: '' });
    } catch (e) { /* */ }
  };
  const delAlert = async (id) => { try { await api.bnAlertDelete(id); setSavedAlerts((a) => a.filter((x) => x.id !== id)); } catch (e) {} };

  // ترید سریع (paper)
  const quickTrade = async (dir) => {
    const px = candlesRef.current.length ? candlesRef.current[candlesRef.current.length - 1].c : 0;
    try { await api.paperOpen({ symbol, direction: dir, entry: px, sl: dir === 'buy' ? px * 0.995 : px * 1.005, tp: dir === 'buy' ? px * 1.01 : px * 0.99, risk_pct: 1 }); window.alert('سفارشِ تمرینی ثبت شد ✓'); } catch (e) { window.alert('خطا در ثبتِ سفارش'); }
  };

  const filteredSymbols = symbols.filter((s) => s.toLowerCase().includes(search.toLowerCase()));
  const txt = theme === 'dark' ? 'text-gray-200' : 'text-gray-800';

  return (
    <div ref={rootRef} dir="rtl" className={`flex flex-col h-[calc(100vh-60px)] rounded-xl overflow-hidden border ${txt}`} style={{ background: TH.bg, borderColor: TH.border }}>
      {/* نوارِ بالا */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-wrap relative" style={{ borderColor: TH.border }}>
        <div className="flex items-center gap-1 rounded-lg px-2 py-1" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}>
          <Search size={14} className="opacity-60" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={symbol} className="bg-transparent text-sm w-24 outline-none" dir="ltr" />
        </div>
        {search && (
          <div className="absolute z-40 top-12 right-3 border rounded-lg max-h-64 overflow-auto w-44" style={{ background: TH.panel, borderColor: TH.border }}>
            {filteredSymbols.slice(0, 30).map((s) => (<button key={s} onClick={() => { setSymbol(s); setSearch(''); }} className="block w-full text-right px-3 py-1.5 text-sm hover:bg-black/5" dir="ltr">{s}</button>))}
          </div>
        )}
        <span className="text-sm font-bold px-1">{symbol}</span>
        {marketOpen ? (
          <span className="flex items-center gap-1 text-[11px] text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {livePrice != null ? <b dir="ltr">{livePrice}</b> : 'زنده'}
          </span>
        ) : (
          <span className="text-[11px] text-amber-500/80">● بازار بسته</span>
        )}
        <div className="flex gap-0.5">{TFS.map((t) => (<button key={t} onClick={() => setTf(t)} className={`px-2 py-1 rounded text-xs ${tf === t ? 'bg-blue-600 text-white' : 'opacity-70'}`} style={tf !== t ? { background: theme === 'dark' ? '#ffffff10' : '#00000008' } : {}}>{t}</button>))}</div>
        <div className="relative">
          <button onClick={() => setCtMenu((v) => !v)} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}><CandlestickChart size={14} /> {CHART_TYPES.find((c) => c.id === chartType)?.label}<ChevronDown size={12} /></button>
          {ctMenu && (<div className="absolute z-40 mt-1 border rounded-lg w-32" style={{ background: TH.panel, borderColor: TH.border }}>{CHART_TYPES.map((ct) => (<button key={ct.id} onClick={() => { setChartType(ct.id); setCtMenu(false); }} className={`block w-full text-right px-3 py-1.5 text-sm hover:bg-black/5 ${chartType === ct.id ? 'text-blue-500' : ''}`}>{ct.label}</button>))}</div>)}
        </div>
        <div className="relative">
          <button onClick={() => setIndMenu((v) => !v)} className="flex items-center gap-1 px-2 py-1 rounded text-sm" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}><Activity size={14} /> اندیکاتورها</button>
          {indMenu && (<div className="absolute z-40 mt-1 border rounded-lg w-52 max-h-72 overflow-auto p-1" style={{ background: TH.panel, borderColor: TH.border }}>{Object.entries(REGISTRY).map(([k, d]) => (<button key={k} onClick={() => addInd(k)} className="flex items-center justify-between w-full text-right px-2 py-1.5 text-sm hover:bg-black/5 rounded"><span>{d.label}</span><Plus size={13} className="opacity-50" /></button>))}</div>)}
        </div>
        <button onClick={() => setEditorOpen((v) => !v)} className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${editorOpen ? 'bg-purple-600 text-white' : ''}`} style={!editorOpen ? { background: theme === 'dark' ? '#ffffff10' : '#00000008' } : {}}><Code2 size={14} /> نمااسکریپت</button>
        <button onClick={() => (replay.on ? exitReplay() : enterReplay())} className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${replay.on ? 'bg-teal-600 text-white' : ''}`} style={!replay.on ? { background: theme === 'dark' ? '#ffffff10' : '#00000008' } : {}}><Play size={14} /> بازپخش</button>
        <button onClick={getAiSignal} disabled={aiBusy} className="flex items-center gap-1 px-2.5 py-1 rounded text-sm bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white disabled:opacity-60" title="ستاپِ کاملِ AI در همین نماد/تایم‌فریم"><Sparkles size={14} className={aiBusy ? 'animate-pulse' : ''} /> سیگنالِ AI {aiQuota && `(${aiQuota.remaining}/${aiQuota.limit})`}</button>
        <button onClick={() => setGrid((g) => (g === 1 ? 2 : g === 2 ? 4 : 1))} className={`flex items-center gap-1 px-2 py-1 rounded text-sm ${grid > 1 ? 'bg-indigo-600 text-white' : ''}`} style={grid === 1 ? { background: theme === 'dark' ? '#ffffff10' : '#00000008' } : {}} title="چند-چارت"><LayoutGrid size={14} /> {grid}×</button>
        <select value={scaleMode} onChange={(e) => setScaleMode(Number(e.target.value))} title="نوعِ مقیاس" className="rounded px-1.5 py-1 text-xs outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008', color: TH.text }}>
          <option value={0}>عادی</option><option value={1}>لگاریتمی</option><option value={2}>درصدی</option>
        </select>
        <button onClick={() => { try { if (document.fullscreenElement) document.exitFullscreen(); else rootRef.current && rootRef.current.requestFullscreen(); } catch (e) {} }} title="تمام‌صفحه" className="p-1.5 rounded opacity-70" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}><Maximize2 size={15} /></button>
        <div className="flex-1" />
        <button onClick={saveLayout} className="p-1.5 rounded opacity-70" title="ذخیرهٔ چیدمانِ فعلی (نماد + تایم‌فریم + اندیکاتورها + ترسیم‌ها)" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}><Save size={15} /></button>
        <div className="relative">
          <select onChange={(e) => e.target.value && loadLayout(e.target.value)} title="بارگذاریِ یک چیدمانِ ذخیره‌شده (نماد/تایم‌فریم/اندیکاتور/ترسیم را یک‌جا برمی‌گرداند)" className="text-xs rounded px-2 py-1 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008', color: TH.text }}>
            <option value="">📁 چیدمان‌های ذخیره‌شده…</option>{layouts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} className="p-1.5 rounded opacity-70" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
        <button onClick={() => setShowRight((v) => !v)} title="نمایش/پنهان‌کردنِ نوارِ کناری (واچ‌لیست، سیگنال AI، اسکنر، ترید، آلارم)" className={`p-1.5 rounded ${showRight ? 'bg-blue-600 text-white' : 'opacity-70'}`} style={!showRight ? { background: theme === 'dark' ? '#ffffff10' : '#00000008' } : {}}><Star size={15} /></button>
      </div>

      {/* اندیکاتورهای فعال — هرکدام: چرخ‌دنده=تنظیمات، ✕=حذف */}
      {(overlays.length > 0 || subs.length > 0) && (
        <div className="flex items-center gap-1.5 px-3 py-1 border-b flex-wrap text-xs" style={{ borderColor: TH.border }}>
          <span className="opacity-50 flex items-center gap-1"><Activity size={12} /> اندیکاتورها:</span>
          {[...overlays.map((o) => ({ ...o, scope: 'main' })), ...subs.map((o) => ({ ...o, scope: 'sub' }))].map((o) => (
            <span key={o.id} className="flex items-center gap-1 rounded px-2 py-0.5 border border-white/5" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}>
              <span className="font-semibold">{REGISTRY[o.key].label}</span>
              <button title="تنظیمات" onClick={() => setEditInd({ scope: o.scope, id: o.id })}><Settings2 size={12} className="opacity-50 hover:opacity-100" /></button>
              <button title="حذفِ اندیکاتور" onClick={() => rmInd(o.scope, o.id)}><X size={13} className="opacity-60 hover:text-red-400" /></button>
            </span>
          ))}
          <button onClick={() => { setOverlays([]); setSubs([]); }} className="flex items-center gap-1 text-red-400/80 hover:text-red-400 mr-1"><Trash2 size={12} /> پاکِ همه</button>
        </div>
      )}

      <div dir="ltr" className="flex flex-1 min-h-0">
        {/* نوارِ ابزارِ ترسیم (سمتِ چپ مثلِ TradingView) */}
        <div className="w-10 border-r flex flex-col items-center py-2 gap-1 shrink-0" style={{ borderColor: TH.border }}>
          {TOOLS.map((t) => (<Tip key={t.id} label={t.label}><button onClick={() => setTool(t.id)} className={`p-1.5 rounded ${tool === t.id ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'}`}><t.Icon size={16} /></button></Tip>))}
          <div className="h-px w-6 my-1" style={{ background: TH.border }} />
          <Tip label="رنگِ ترسیم"><input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" /></Tip>
          <Tip label="مگنت — چسبیدنِ ترسیم به قیمتِ کندل"><button onClick={() => setMagnet((v) => !v)} className={`p-1.5 rounded ${magnet ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'}`}><Magnet size={16} /></button></Tip>
          <Tip label="پروفایلِ حجم (توزیعِ قیمت)"><button onClick={() => setShowVP((v) => !v)} className={`p-1.5 rounded ${showVP ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'}`}><BarChart3 size={16} /></button></Tip>
          <div className="h-px w-6 my-1" style={{ background: TH.border }} />
          <Tip label="واگرد (Ctrl+Z)"><button onClick={() => { drawRef.current && drawRef.current.undo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canUndo())} className="p-1.5 rounded opacity-60 hover:opacity-100 disabled:opacity-20"><Undo2 size={16} /></button></Tip>
          <Tip label="ازنو (Ctrl+Y)"><button onClick={() => { drawRef.current && drawRef.current.redo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canRedo())} className="p-1.5 rounded opacity-60 hover:opacity-100 disabled:opacity-20"><Redo2 size={16} /></button></Tip>
          <Tip label="ماندن در حالتِ ترسیم (پشتِ‌سرهم بکش)"><button onClick={() => setStayDraw((v) => !v)} className={`p-1.5 rounded ${stayDraw ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'}`}><Pencil size={16} /></button></Tip>
          <Tip label="درختِ آبجکت‌ها (مدیریتِ ترسیم‌ها)"><button onClick={() => { setShowTree((v) => !v); treeRefresh(); }} className={`p-1.5 rounded ${showTree ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'}`}><List size={16} /></button></Tip>
          <div className="flex-1" />
          <Tip label="پاکِ آخرین ترسیم"><button onClick={() => drawRef.current && drawRef.current.clearLast()} className="p-1.5 rounded opacity-60 hover:opacity-100"><Minus size={16} /></button></Tip>
          <Tip label="پاکِ همهٔ ترسیم‌ها"><button onClick={() => drawRef.current && drawRef.current.clearAll()} className="p-1.5 rounded opacity-60 hover:text-red-400"><Trash2 size={16} /></button></Tip>
        </div>

        {/* چارت */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {legend && (() => {
            const ch = legend.open != null ? ((legend.close - legend.open) / legend.open) * 100 : null;
            const col = ch == null ? TH.text : ch >= 0 ? '#22c55e' : '#ef4444';
            return (<div className="absolute top-2 right-2 z-20 text-[11px] rounded px-2 py-1 font-mono flex items-center gap-2" dir="ltr" style={{ background: theme === 'dark' ? '#00000060' : '#ffffffcc' }}>
              <span className="font-bold" style={{ color: TH.text }}>{symbol} · {tf}</span>
              {legend.open != null ? <span style={{ color: col }}>O {legend.open}  H {legend.high}  L {legend.low}  C {legend.close}</span> : <span style={{ color: col }}>C {legend.close}</span>}
              {ch != null && <span style={{ color: col }}>{ch >= 0 ? '+' : ''}{ch.toFixed(2)}%</span>}
            </div>);
          })()}
          <div className="relative flex-1 min-h-0">
            <div ref={mainRef} className="absolute inset-0" />
            <canvas ref={overlayRef} className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }} />
            {/* جدول‌های نمااسکریپت (table.new) — گوشهٔ بالا-راست */}
            {scTables.length > 0 && (
              <div className="absolute top-2 right-2 z-20 pointer-events-none flex flex-col gap-2" dir="rtl">
                {scTables.map((tb, ti) => {
                  const cells = tb.cells || []; if (!cells.length) return null;
                  const rows = Math.max(...cells.map((c) => c.row)) + 1, cols = Math.max(...cells.map((c) => c.col)) + 1;
                  const grid2 = Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
                  cells.forEach((c) => { if (grid2[c.row]) grid2[c.row][c.col] = c; });
                  return (
                    <table key={ti} className="text-[11px] rounded-lg overflow-hidden border shadow-lg" style={{ borderColor: TH.border, background: theme === 'dark' ? 'rgba(13,17,23,.92)' : 'rgba(255,255,255,.95)' }}>
                      <tbody>
                        {grid2.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((c, ci) => (
                              <td key={ci} className={`px-2 py-1 ${ri === 0 ? 'font-bold opacity-80' : ''}`} style={{ borderBottom: ri === 0 ? `1px solid ${TH.border}` : 'none', color: (c && c.color) || TH.text }} dir="ltr">{c ? c.text : ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })}
              </div>
            )}
            {/* نوارِ استایلِ آبجکتِ انتخاب‌شده (فاز ۳) */}
            {selDraw >= 0 && drawList[selDraw] && (() => {
              const d = drawList[selDraw];
              return (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-lg border shadow-xl px-2 py-1.5 text-xs" style={{ borderColor: TH.border, background: theme === 'dark' ? 'rgba(13,17,23,.97)' : 'rgba(255,255,255,.98)' }} dir="rtl">
                  <span className="font-bold opacity-70">{DrawingLayer.label(d.type)}</span>
                  <input type="color" value={d.color || '#3b82f6'} onChange={(e) => { drawRef.current.setStyle(selDraw, { color: e.target.value }); treeRefresh(); }} title="رنگ" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                  <div className="flex items-center gap-0.5" title="ضخامت">{[1, 2, 3].map((w) => (<button key={w} onClick={() => { drawRef.current.setStyle(selDraw, { width: w }); treeRefresh(); }} className={`w-5 rounded ${Math.round(d.width || 2) === w ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'}`}>{w}</button>))}</div>
                  <button onClick={() => { drawRef.current.setStyle(selDraw, { dashed: !d.dashed }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded ${d.dashed ? 'bg-blue-600 text-white' : 'opacity-60 hover:opacity-100'}`} title="خط‌چین">┄</button>
                  <button onClick={() => { drawRef.current.toggleLock(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="قفل">{d.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                  <button onClick={() => { drawRef.current.removeAt(selDraw); treeRefresh(); }} className="opacity-60 hover:text-red-400" title="حذف"><Trash2 size={13} /></button>
                </div>
              );
            })()}
            {/* درختِ آبجکت‌ها (Object Tree) */}
            {showTree && (
              <div className="absolute top-2 left-2 z-30 w-56 rounded-lg border shadow-xl overflow-hidden" style={{ borderColor: TH.border, background: theme === 'dark' ? 'rgba(13,17,23,.97)' : 'rgba(255,255,255,.98)' }} dir="rtl">
                <div className="flex items-center justify-between px-2 py-1.5 border-b text-xs font-bold" style={{ borderColor: TH.border }}>
                  <span className="flex items-center gap-1"><List size={13} /> آبجکت‌ها ({drawList.length})</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { drawRef.current.hideAll(true); treeRefresh(); }} title="پنهان‌کردنِ همه" className="opacity-60 hover:opacity-100"><EyeOff size={13} /></button>
                    <button onClick={() => { drawRef.current.lockAll(true); treeRefresh(); }} title="قفلِ همه" className="opacity-60 hover:opacity-100"><Lock size={13} /></button>
                    <button onClick={() => { drawRef.current.clearAll(); treeRefresh(); }} title="حذفِ همه" className="opacity-60 hover:text-red-400"><Trash2 size={13} /></button>
                    <button onClick={() => setShowTree(false)} className="opacity-60 hover:opacity-100"><X size={13} /></button>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto text-xs">
                  {drawList.length === 0 && <div className="px-3 py-3 opacity-40 text-center">ترسیمی نیست</div>}
                  {drawList.map((d, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-2 py-1 border-b cursor-pointer ${selDraw === i ? 'bg-blue-600/15' : 'hover:bg-black/5'}`} style={{ borderColor: TH.border }} onClick={() => { setTool('select'); drawRef.current.selectAt(i); }}>
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                      <span className={`flex-1 truncate ${d.visible === false ? 'opacity-40 line-through' : ''}`}>{DrawingLayer.label(d.type)}{d.text ? `: ${d.text}` : ''}</span>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.toggleVisible(i); treeRefresh(); }} title="نمایش/پنهان" className="opacity-50 hover:opacity-100">{d.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.toggleLock(i); treeRefresh(); }} title="قفل" className="opacity-50 hover:opacity-100">{d.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.removeAt(i); treeRefresh(); }} title="حذف" className="opacity-50 hover:text-red-400"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* شمارشِ معکوسِ بسته‌شدنِ کندل + وضعیتِ بازار */}
            {countdown && (
              <div className="absolute bottom-3 right-3 z-20 pointer-events-none rounded-md px-2 py-1 text-[11px] font-mono flex items-center gap-1.5 border" style={{ borderColor: TH.border, background: theme === 'dark' ? 'rgba(13,17,23,.85)' : 'rgba(255,255,255,.9)' }} dir="ltr">
                <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="opacity-60">⏱</span><b>{countdown}</b>
              </div>
            )}
            <img src={bnLogo} alt="بازارنما" className="absolute bottom-3 left-3 z-20 pointer-events-none select-none" style={{ height: 48, opacity: 0.9 }} />
            {grid > 1 && (
              <div className="absolute inset-0 z-30 grid gap-1 p-1" style={{ background: TH.bg, gridTemplateColumns: grid === 2 ? '1fr 1fr' : '1fr 1fr', gridTemplateRows: grid === 2 ? '1fr' : '1fr 1fr' }}>
                {Array.from({ length: grid }).map((_, i) => (
                  <MiniChart key={i} symbols={symbols} tf={tf} initial={i === 0 ? symbol : (watch[i] || symbols[i] || symbol)} />
                ))}
              </div>
            )}
            {replay.on && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs" style={{ background: theme === 'dark' ? '#161b27ee' : '#ffffffee', border: `1px solid ${TH.border}` }}>
                <span className="text-teal-400 font-bold">بازپخش</span>
                <button onClick={() => setReplay((s) => ({ ...s, playing: !s.playing }))} className="p-1 rounded bg-teal-600 text-white">{replay.playing ? '⏸' : '▶'}</button>
                <button onClick={replayStep} className="p-1 rounded" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}>⏭</button>
                <span className="opacity-60">سرعت</span>
                {[1, 2, 4, 8].map((sp) => (<button key={sp} onClick={() => setReplay((s) => ({ ...s, speed: sp }))} className={`px-1.5 rounded ${replay.speed === sp ? 'bg-teal-600 text-white' : 'opacity-60'}`}>{sp}×</button>))}
                <button onClick={exitReplay} className="p-1 rounded bg-red-500/20 text-red-400">✕ خروج</button>
              </div>
            )}
          </div>
          <div ref={subWrapRef} />
        </div>

        {/* پنلِ راست */}
        {showRight && (
          <div dir="rtl" className="w-52 border-l overflow-auto shrink-0 flex flex-col max-md:absolute max-md:left-0 max-md:top-0 max-md:bottom-0 max-md:z-40 max-md:shadow-2xl" style={{ borderColor: TH.border, background: TH.bg }}>
            <div className="flex border-b" style={{ borderColor: TH.border }}>
              {[['watch', 'واچ‌لیست'], ['ai', 'سیگنال AI'], ['screener', 'اسکنر'], ['trade', 'ترید'], ['alerts', 'آلارم']].map(([k, l]) => (<button key={k} onClick={() => setRightTab(k)} className={`flex-1 py-1.5 text-[10px] ${rightTab === k ? (k === 'ai' ? 'text-fuchsia-400 border-b-2 border-fuchsia-400' : 'text-blue-500 border-b-2 border-blue-500') : 'opacity-60'}`}>{l}</button>))}
            </div>
            {rightTab === 'watch' ? (
              <div className="overflow-auto">
                {watch.map((s) => { const lp = live[s]; const col = lp ? (lp.dir > 0 ? '#22c55e' : lp.dir < 0 ? '#ef4444' : TH.text) : TH.text; return (
                  <button key={s} onClick={() => setSymbol(s)} className={`flex items-center justify-between w-full px-3 py-1.5 text-sm hover:bg-black/5 ${symbol === s ? 'bg-black/5' : ''}`} dir="ltr">
                    <span className={symbol === s ? 'text-blue-500 font-semibold' : ''}>{s}</span>
                    <span className="flex items-center gap-1">
                      {lp && <span className="font-mono text-[11px]" style={{ color: col }}>{lp.mid}</span>}
                      <X size={11} className="opacity-40 hover:text-red-400" onClick={(e) => { e.stopPropagation(); toggleWatch(s); }} />
                    </span>
                  </button>
                ); })}
                <div className="px-2 py-2">{symbols.filter((s) => !watch.includes(s)).slice(0, 10).map((s) => (<button key={s} onClick={() => toggleWatch(s)} className="inline-block m-0.5 px-1.5 py-0.5 rounded text-[11px] opacity-60 hover:opacity-100" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} dir="ltr">{s}+</button>))}</div>
              </div>
            ) : rightTab === 'ai' ? (
              <div className="p-2 text-xs space-y-2">
                <button onClick={getAiSignal} disabled={aiBusy} className="w-full py-2 rounded-lg bg-gradient-to-l from-violet-600 to-fuchsia-600 text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                  <Sparkles size={14} className={aiBusy ? 'animate-pulse' : ''} /> {aiBusy ? 'در حال تحلیل…' : 'سیگنالِ AI برای ' + symbol}
                </button>
                {aiQuota && <div className="text-center text-[10px] opacity-60">سهمیهٔ امروز: {aiQuota.remaining} از {aiQuota.limit} ({aiQuota.tier})</div>}
                {aiList.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[10px] opacity-50 px-1">ستاپ‌های من — روی هرکدام بزن تا چارت همان‌جا برود:</div>
                    {aiList.map((s) => {
                      const b = s.direction === 'buy';
                      const sm = { active: ['فعال', '#3b82f6'], tp1: ['TP1 ✅', '#22c55e'], tp2: ['TP2 ✅', '#22c55e'], tp3: ['TP3 🎯', '#22c55e'], sl: ['SL', '#ef4444'] };
                      const sv = sm[s.status] || sm.active;
                      const cur = s.symbol === symbol && s.tf === tf;
                      return (
                        <div key={s.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 border" style={{ borderColor: cur ? '#8b5cf6' : TH.border, background: theme === 'dark' ? '#ffffff06' : '#00000004' }}>
                          <button onClick={() => gotoSignal(s)} className="flex-1 flex items-center gap-1.5 min-w-0" title="رفتن به این ستاپ روی چارت">
                            <span>{b ? '🟢' : '🔴'}</span>
                            <span className="font-bold whitespace-nowrap" dir="ltr">{s.symbol}·{s.tf}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: sv[1] + '22', color: sv[1] }}>{sv[0]}</span>
                            {cur && <span className="text-[9px] text-violet-400 whitespace-nowrap">• روی چارت</span>}
                          </button>
                          <button onClick={() => deleteSignal(s)} title="حذفِ سیگنال" className="opacity-40 hover:opacity-100 shrink-0"><X size={12} /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {aiSig ? (() => {
                  const buy = aiSig.direction === 'buy';
                  const stMap = { active: ['فعال', '#3b82f6'], tp1: ['TP1 خورد ✅', '#22c55e'], tp2: ['TP2 خورد ✅', '#22c55e'], tp3: ['TP3 خورد 🎯', '#22c55e'], sl: ['حد ضرر خورد', '#ef4444'] };
                  const stv = stMap[aiSig.status] || stMap.active;
                  return (
                    <div className="rounded-xl p-3 border" style={{ borderColor: TH.border, background: theme === 'dark' ? '#ffffff06' : '#00000004' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-black ${buy ? 'text-green-400' : 'text-red-400'}`}>{buy ? '🟢 خرید' : '🔴 فروش'} {aiSig.symbol} · {aiSig.tf}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: stv[1] + '22', color: stv[1] }}>{stv[0]}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full" style={{ width: `${aiSig.confidence}%`, background: aiSig.confidence >= 75 ? '#22c55e' : aiSig.confidence >= 60 ? '#f59e0b' : '#ef4444' }} /></div>
                        <span className="text-[11px] font-bold">{aiSig.confidence}٪</span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-5 mb-2">{aiSig.reason}</p>
                      <div className="space-y-1 font-mono text-[11px]" dir="ltr">
                        <div className="flex justify-between"><span className="text-blue-400">Entry</span><b>{aiSig.entry}</b></div>
                        <div className="flex justify-between"><span className="text-red-400">SL</span><b className="text-red-400">{aiSig.sl}</b></div>
                        <div className="flex justify-between"><span className="text-green-400">TP1</span><b className="text-green-400">{aiSig.tp1}</b></div>
                        {aiSig.tp2 && <div className="flex justify-between"><span className="text-green-500">TP2</span><b className="text-green-500">{aiSig.tp2}</b></div>}
                        {aiSig.tp3 && <div className="flex justify-between"><span className="text-green-600">TP3</span><b className="text-green-600">{aiSig.tp3}</b></div>}
                      </div>
                      <button onClick={clearAiSig} className="w-full mt-2 py-1 rounded text-[11px] opacity-60 hover:opacity-100" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}>پاک‌کردنِ سیگنال از چارت</button>
                    </div>
                  );
                })() : <div className="opacity-50 text-[11px] text-center py-3">دکمهٔ بالا را بزن تا قوی‌ترین هوشِ مصنوعی یک ستاپِ کامل (ورود/حدضرر/اهداف) بچیند.</div>}
              </div>
            ) : rightTab === 'screener' ? (
              <div className="overflow-auto text-xs">
                <div className="flex items-center justify-between px-3 py-1 opacity-50 border-b" style={{ borderColor: TH.border }}><span>نماد</span><span>قیمتِ زنده</span></div>
                {symbols.map((s) => { const lp = live[s]; const col = lp ? (lp.dir > 0 ? '#22c55e' : lp.dir < 0 ? '#ef4444' : TH.text) : '#64748b'; return (
                  <button key={s} onClick={() => setSymbol(s)} className={`flex items-center justify-between w-full px-3 py-1 hover:bg-black/5 ${symbol === s ? 'bg-black/5 text-blue-500' : ''}`} dir="ltr">
                    <span>{s}</span>
                    <span className="font-mono flex items-center gap-1" style={{ color: col }}>{lp ? lp.mid : '—'}{lp && lp.dir !== 0 && <span>{lp.dir > 0 ? '▲' : '▼'}</span>}</span>
                  </button>
                ); })}
                {!marketOpen && <div className="px-3 py-2 text-amber-500/70 text-[11px]">بازار بسته — قیمت‌ها هنگامِ بازشدن به‌روز می‌شوند.</div>}
              </div>
            ) : rightTab === 'trade' ? (
              <div className="p-2 text-xs space-y-2">
                <div className="flex gap-1">
                  <button onClick={() => startTrade('buy')} className="flex-1 py-1.5 rounded bg-green-600 text-white font-bold">خرید</button>
                  <button onClick={() => startTrade('sell')} className="flex-1 py-1.5 rounded bg-red-600 text-white font-bold">فروش</button>
                </div>
                {order ? (() => {
                  const risk = Math.abs(order.entry - order.sl), reward = Math.abs(order.tp - order.entry);
                  const rr = risk ? (reward / risk).toFixed(2) : '—';
                  const row = (lbl, key, col) => (<div className="flex items-center justify-between"><span style={{ color: col }}>{lbl}</span><input type="number" value={order[key]} onChange={(e) => setOrder((o) => ({ ...o, [key]: parseFloat(e.target.value) }))} className="w-24 rounded px-2 py-0.5 outline-none font-mono" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} dir="ltr" /></div>);
                  return (<div className="space-y-1.5 rounded p-2" style={{ background: theme === 'dark' ? '#ffffff08' : '#00000005' }}>
                    <div className="text-[10px] opacity-60">روی چارت خطوط را بکش (⇕) یا اینجا ویرایش کن:</div>
                    {row('🎯 هدف', 'tp', '#22c55e')}
                    {row(order.side === 'buy' ? '🔵 ورودِ خرید' : '🔴 ورودِ فروش', 'entry', '#3b82f6')}
                    {row('🛑 حد ضرر', 'sl', '#ef4444')}
                    <div className="flex justify-between border-t pt-1" style={{ borderColor: TH.border }}><span>نسبتِ ریسک/ریوارد</span><b className={reward >= risk ? 'text-green-400' : 'text-amber-400'}>R:R {rr}</b></div>
                    <div className="flex gap-1"><button onClick={submitOrder} className="flex-1 py-1 rounded bg-blue-600 text-white">ثبتِ سفارش</button><button onClick={() => setOrder(null)} className="px-2 py-1 rounded" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}>لغو</button></div>
                  </div>);
                })() : <div className="opacity-50 text-[11px]">خرید/فروش را بزن تا خطوطِ سفارشِ قابلِ‌درگ روی چارت بیاید.</div>}
                {/* DOM — نردبانِ قیمت */}
                {(() => { const px = curPrice(); if (!px) return null; const step = px * 0.0002; const rows = []; for (let i = 8; i >= -8; i--) { const lv = px + i * step; rows.push(<div key={i} onClick={() => order && setOrder((o) => ({ ...o, entry: lv }))} className={`flex justify-between px-2 py-0.5 cursor-pointer ${Math.abs(i) < 1 ? 'bg-blue-500/20' : ''}`} dir="ltr"><span className="font-mono opacity-80">{lv.toFixed(5)}</span><span className="font-mono" style={{ color: i > 0 ? '#ef4444' : i < 0 ? '#22c55e' : '#3b82f6' }}>{Math.abs(Math.round(50 * Math.exp(-Math.abs(i) / 3)))}</span></div>); } return (<div className="mt-1"><div className="text-[10px] opacity-50 px-2 mb-0.5">DOM — عمقِ بازار</div><div className="rounded overflow-hidden text-[10px] border" style={{ borderColor: TH.border }}>{rows}</div></div>); })()}
              </div>
            ) : (
              <div className="p-2 text-xs">
                <div className="rounded-lg border p-2 mb-2 space-y-1.5" style={{ borderColor: TH.border }}>
                  <div className="text-[10px] opacity-50">سازندهٔ آلارم — {symbol} · {tf}</div>
                  <div className="flex gap-1">
                    <select value={alForm.op} onChange={(e) => setAlForm((f) => ({ ...f, op: e.target.value }))} className="rounded px-1 py-1 outline-none flex-1" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008', color: TH.text }}>
                      <option value="above">قیمت بالای</option><option value="below">قیمت پایینِ</option>
                      <option value="cross_up">تقاطعِ صعودی از</option><option value="cross_down">تقاطعِ نزولی از</option>
                      <option value="pct_up">صعودِ ٪</option><option value="pct_down">نزولِ ٪</option>
                    </select>
                    <input value={alForm.value} onChange={(e) => setAlForm((f) => ({ ...f, value: e.target.value }))} placeholder={alForm.op.startsWith('pct') ? '٪' : 'قیمت'} dir="ltr" className="w-16 rounded px-2 py-1 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} />
                  </div>
                  <div className="flex gap-1">
                    <select value={alForm.trigger} onChange={(e) => setAlForm((f) => ({ ...f, trigger: e.target.value }))} title="تریگر" className="rounded px-1 py-1 outline-none flex-1" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008', color: TH.text }}><option value="recurring">هربار (با کول‌داون)</option><option value="once">فقط یک‌بار</option></select>
                    <input value={alForm.expiryH} onChange={(e) => setAlForm((f) => ({ ...f, expiryH: e.target.value }))} placeholder="انقضا (ساعت)" dir="ltr" className="w-20 rounded px-2 py-1 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} />
                  </div>
                  <input value={alForm.message} onChange={(e) => setAlForm((f) => ({ ...f, message: e.target.value }))} placeholder="پیامِ سفارشی (متغیرها: {symbol} {price} {value})" className="w-full rounded px-2 py-1 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={alForm.telegram} onChange={(e) => setAlForm((f) => ({ ...f, telegram: e.target.checked }))} /> ارسال به تلگرام</label>
                    <button onClick={createAlert} className="px-3 py-1 rounded bg-blue-600 text-white flex items-center gap-1"><Plus size={12} /> ساختِ آلارم</button>
                  </div>
                </div>
                {savedAlerts.map((a) => { const fired = a.last_triggered_at && (Date.now() - new Date(a.last_triggered_at).getTime()) < 86400000; return (
                  <div key={a.id} className="flex items-center justify-between py-1 border-b" style={{ borderColor: TH.border }}>
                    <span className="flex items-center gap-1"><Bell size={11} className={fired ? 'text-green-400' : 'text-amber-400'} />{a.name}{fired && <span className="text-[9px] text-green-400 bg-green-400/10 rounded px-1">رخ داد</span>}</span>
                    <X size={11} className="opacity-40 hover:text-red-400 cursor-pointer" onClick={() => delAlert(a.id)} />
                  </div>
                ); })}
                <div className="mt-3 flex gap-1"><button onClick={() => quickTrade('buy')} className="flex-1 py-1 rounded bg-green-600 text-white flex items-center justify-center gap-1"><ShoppingCart size={12} /> خرید</button><button onClick={() => quickTrade('sell')} className="flex-1 py-1 rounded bg-red-600 text-white">فروش</button></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* استودیوی نمااسکریپت */}
      {editorOpen && (
        <div className="border-t flex flex-col" style={{ height: 320, background: TH.panel, borderColor: TH.border }}>
          {/* نوارِ ابزار */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs flex-wrap" style={{ borderColor: TH.border }}>
            <Code2 size={14} className="text-purple-400" />
            <span className="font-bold text-purple-300">نمااسکریپت</span>
            <input value={scriptName} onChange={(e) => setScriptName(e.target.value)} className="rounded px-2 py-0.5 text-xs w-32 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} />
            <button onClick={onRun} className="flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white"><Play size={12} /> اجرا <kbd className="opacity-60">Ctrl+↵</kbd></button>
            <button onClick={onBacktest} className="flex items-center gap-1 px-2 py-1 rounded bg-amber-600 text-white"><FlaskConical size={12} /> بک‌تست</button>
            <button onClick={onSaveScript} className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}><Save size={12} /> ذخیره</button>
            <button onClick={clearScreen} title="حذفِ خروجی‌های اسکریپت/سیگنال/سفارش از روی چارت" className="flex items-center gap-1 px-2 py-1 rounded text-red-400/90" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }}><Trash2 size={12} /> پاکِ صفحه</button>
            <select value="" onChange={(e) => { const ex = EXAMPLES[+e.target.value]; if (ex) loadExample(ex); }} className="rounded px-2 py-1 text-xs outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008', color: TH.text }}><option value="">📚 نمونه‌ها…</option>{EXAMPLES.map((ex, i) => <option key={i} value={i}>{ex.name}</option>)}</select>
            <select value="" onChange={(e) => e.target.value && loadScript(e.target.value)} className="rounded px-2 py-1 text-xs outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008', color: TH.text }}><option value="">اسکریپت‌های من…</option>{scripts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            {runErr && <span className="text-red-400 text-[11px]">⚠ {runErr}</span>}
            {!runErr && scPlots.length > 0 && <span className="text-green-400 text-[11px]">✓ کامپایل شد</span>}
          </div>
          {/* بدنه: ویرایشگر + پنلِ کناری */}
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 min-w-0"><CodeEditor value={code} onChange={setCode} onRun={onRun} /></div>
            <div className="w-60 border-r flex flex-col shrink-0" style={{ borderColor: TH.border }}>
              <div className="flex border-b text-[11px]" style={{ borderColor: TH.border }}>
                {[['console', 'کنسول'], ['inputs', 'ورودی‌ها'], ['reference', 'مرجع']].map(([k, l]) => (<button key={k} onClick={() => setScStudioTab(k)} className={`flex-1 py-1.5 ${scStudioTab === k ? 'text-purple-400 border-b-2 border-purple-400' : 'opacity-60'}`}>{l}</button>))}
              </div>
              <div className="flex-1 overflow-auto p-2 text-[11px]">
                {scStudioTab === 'console' && (
                  <div className="space-y-1.5">
                    {/* کارمزد/اسلیپیجِ بک‌تست */}
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="opacity-60">کارمزد:</span>
                      <input value={btCost.comm} onChange={(e) => setBtCost((c) => ({ ...c, comm: e.target.value }))} dir="ltr" className="w-14 rounded px-1 py-0.5 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} />
                      <span className="opacity-60">اسلیپیج:</span>
                      <input value={btCost.slip} onChange={(e) => setBtCost((c) => ({ ...c, slip: e.target.value }))} dir="ltr" className="w-14 rounded px-1 py-0.5 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} />
                    </div>
                    {bt && (bt.err ? <div className="text-amber-400">{bt.err}</div> : (
                      <div className="rounded p-2" style={{ background: theme === 'dark' ? '#ffffff08' : '#00000005' }}>
                        <div className="flex gap-2 mb-1.5 border-b text-[11px]" style={{ borderColor: TH.border }}>
                          {[['overview', 'نمای کلی'], ['performance', 'عملکرد'], ['trades', 'معاملات']].map(([k, l]) => (<button key={k} onClick={() => setBtTab(k)} className={`pb-1 ${btTab === k ? 'text-purple-400 border-b-2 border-purple-400' : 'opacity-60'}`}>{l}</button>))}
                        </div>
                        {btTab === 'overview' && (<>
                          <div className="flex justify-between"><span>معاملات</span><b>{bt.trades}</b></div>
                          <div className="flex justify-between"><span>سودِ خالص</span><b className={bt.net >= 0 ? 'text-green-400' : 'text-red-400'}>{(bt.net || 0).toFixed(5)}</b></div>
                          <div className="flex justify-between"><span>نرخِ برد</span><b>{bt.win}٪ <span className="opacity-50">({bt.wins}/{bt.trades})</span></b></div>
                          <div className="flex justify-between"><span>فاکتورِ سود</span><b>{bt.pfTxt}</b></div>
                          <div className="flex justify-between"><span>حداکثر افت</span><b className="text-red-400">{bt.ddTxt}</b></div>
                          {bt.equity && bt.equity.length > 1 && (() => {
                            const es = bt.equity.map((p) => p.e); const mn = Math.min(0, ...es), mx = Math.max(0, ...es); const rng = mx - mn || 1; const W = 200, Hh = 44;
                            const pts = bt.equity.map((p, i) => `${(i / (bt.equity.length - 1)) * W},${Hh - ((p.e - mn) / rng) * Hh}`).join(' ');
                            const zeroY = Hh - ((0 - mn) / rng) * Hh;
                            return (<svg width={W} height={Hh} className="mt-2 w-full"><line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke="#ffffff20" /><polyline points={pts} fill="none" stroke={bt.net >= 0 ? '#22c55e' : '#ef4444'} strokeWidth="1.5" /></svg>);
                          })()}
                        </>)}
                        {btTab === 'performance' && (<div className="space-y-0.5">
                          <div className="flex justify-between"><span>میانگینِ معامله</span><b className={bt.avgTrade >= 0 ? 'text-green-400' : 'text-red-400'}>{(bt.avgTrade || 0).toFixed(5)}</b></div>
                          <div className="flex justify-between"><span>میانگینِ برد / باخت</span><b dir="ltr"><span className="text-green-400">{(bt.avgWin || 0).toFixed(4)}</span> / <span className="text-red-400">{(bt.avgLoss || 0).toFixed(4)}</span></b></div>
                          <div className="flex justify-between"><span>بزرگ‌ترین برد / باخت</span><b dir="ltr"><span className="text-green-400">{(bt.maxWin || 0).toFixed(4)}</span> / <span className="text-red-400">{(bt.maxLoss || 0).toFixed(4)}</span></b></div>
                          <div className="flex justify-between"><span>انتظارِ ریاضی</span><b>{(bt.expectancy || 0).toFixed(5)}</b></div>
                          <div className="flex justify-between"><span>نسبتِ شارپ (≈)</span><b>{(bt.sharpe || 0).toFixed(2)}</b></div>
                          <div className="flex justify-between"><span>بیشترین بردِ متوالی</span><b className="text-green-400">{bt.winStreak}</b></div>
                          <div className="flex justify-between"><span>بیشترین باختِ متوالی</span><b className="text-red-400">{bt.lossStreak}</b></div>
                          <div className="flex justify-between"><span>لانگ / شورت</span><b dir="ltr">{bt.longN} / {bt.shortN}</b></div>
                          <div className="flex justify-between"><span>سودِ ناخالص / زیانِ ناخالص</span><b dir="ltr"><span className="text-green-400">{(bt.grossProfit || 0).toFixed(2)}</span> / <span className="text-red-400">{(bt.grossLoss || 0).toFixed(2)}</span></b></div>
                        </div>)}
                        {btTab === 'trades' && (<div className="max-h-40 overflow-auto">
                          {(bt.list || []).slice().reverse().map((tr, i) => (<div key={i} className="flex justify-between py-0.5 border-b" style={{ borderColor: TH.border }}><span className="opacity-50 flex items-center gap-1" dir="ltr">{tr.dir === 1 ? '🟢' : '🔴'} {new Date(tr.t * 1000).toLocaleDateString('fa-IR')}</span><b className={tr.r >= 0 ? 'text-green-400' : 'text-red-400'} dir="ltr">{tr.r >= 0 ? '+' : ''}{tr.r.toFixed(5)}</b></div>))}
                          {!(bt.list || []).length && <div className="opacity-50 py-2">معامله‌ای نبود.</div>}
                        </div>)}
                      </div>
                    ))}
                    {scPlots.length > 0 && <div className="opacity-70">رسم‌ها: {scPlots.map((p, i) => <span key={i} style={{ color: p.color }}>● {p.name} </span>)}</div>}
                    {alertsOut.map((a, i) => <div key={i} className="text-amber-400 flex items-center gap-1"><Bell size={11} /> {a.msg} ({a.count} بار)</div>)}
                    {!bt && !scPlots.length && !alertsOut.length && <div className="opacity-50">«اجرا» را بزن تا خروجی اینجا بیاید.</div>}
                  </div>
                )}
                {scStudioTab === 'inputs' && (
                  <div className="space-y-2">
                    {scInputDecls.length ? scInputDecls.map((inp) => (
                      <div key={inp.key} className="flex items-center justify-between gap-2">
                        <label className="opacity-80 truncate">{inp.key}</label>
                        {inp.type === 'bool'
                          ? <input type="checkbox" checked={scInputs[inp.key] ?? inp.def} onChange={(e) => onInputChange(inp.key, e.target.checked)} />
                          : <input type="number" value={scInputs[inp.key] ?? inp.def} onChange={(e) => onInputChange(inp.key, inp.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))} className="w-20 rounded px-2 py-0.5 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} />}
                      </div>
                    )) : <div className="opacity-50">اسکریپت ورودیِ input(...) ندارد یا هنوز اجرا نشده.</div>}
                  </div>
                )}
                {scStudioTab === 'reference' && (
                  <div className="space-y-2">
                    {REFERENCE.map((grp) => (
                      <div key={grp.g}>
                        <div className="font-bold text-purple-300 mb-0.5">{grp.g}</div>
                        {grp.items.map(([sig, desc], i) => (<div key={i} className="mb-1"><code className="text-blue-400" dir="ltr">{sig}</code><div className="opacity-60">{desc}</div></div>))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* دیالوگِ تنظیماتِ اندیکاتور */}
      {editInd && (() => {
        const arr = editInd.scope === 'main' ? overlays : subs;
        const it = arr.find((x) => x.id === editInd.id); if (!it) return null;
        const def = REGISTRY[it.key];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditInd(null)}>
            <div className="rounded-xl p-4 w-72 border" style={{ background: TH.panel, borderColor: TH.border }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-sm">{def.label}</h3><X size={16} className="cursor-pointer opacity-60" onClick={() => setEditInd(null)} /></div>
              {Object.keys(def.inputs).map((k) => (
                <div key={k} className="flex items-center justify-between mb-2 text-sm"><label className="opacity-70">{k}</label><input type="number" value={it.inputs[k]} onChange={(e) => updInd(editInd.scope, it.id, { inputs: { [k]: Number(e.target.value) } })} className="w-24 rounded px-2 py-1 outline-none" style={{ background: theme === 'dark' ? '#ffffff10' : '#00000008' }} /></div>
              ))}
              <div className="flex items-center justify-between mb-3 text-sm"><label className="opacity-70">رنگ</label><input type="color" value={it.color || def.color} onChange={(e) => updInd(editInd.scope, it.id, { color: e.target.value })} className="w-10 h-7 rounded cursor-pointer bg-transparent" /></div>
              <button onClick={() => setEditInd(null)} className="w-full py-1.5 rounded bg-blue-600 text-white text-sm">تأیید</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
