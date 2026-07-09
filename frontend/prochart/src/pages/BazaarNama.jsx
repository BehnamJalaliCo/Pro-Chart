import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries, BarSeries, BaselineSeries, HistogramSeries, createSeriesMarkers, createTextWatermark } from 'lightweight-charts';
import {
  CandlestickChart, LineChart, AreaChart, BarChart3, BarChart, Activity, Plus, X, Save,
  Play, Code2, Star, Search, Settings2, Trash2, Bell, FolderOpen, Sun, Moon,
  Minus, Type, Layers, SlidersHorizontal, MoreVertical, Gift, Crosshair,
  FlaskConical, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, LayoutGrid, Maximize2,
  Magnet, Sparkles,
  Undo2, Redo2, Lock, Unlock, Eye, EyeOff, List, Pencil, Table2, Camera,
  TrendingUp, TrendingDown, ArrowUpDown, Scaling, GitCompare, Calendar, Copy,
} from 'lucide-react';
import { api } from '../api/client';
import { detectCandlePatterns, PATTERN_COUNT } from '../bazaarnama/candlePatterns';
import { detectDivergences } from '../bazaarnama/divergence';
import { detectHarmonics } from '../bazaarnama/harmonic';
import { detectGaps } from '../bazaarnama/gaps';
import { REGISTRY } from '../bazaarnama/indicators';
import { NONSTANDARD, buildNonStandard } from '../bazaarnama/chartbuilders';
import { runScript } from '../bazaarnama/namascript';
import { ReplayController, SPEED_LADDER } from '../bazaarnama/ReplayController';
import { runScriptBar } from '../bazaarnama/namascript_bar';
import { DrawingLayer } from '../bazaarnama/drawings';
import ToolRail from '../bazaarnama/ToolRail';
import { EXT_CHART_TYPES, EXT_TYPES, EXT_VALUE_TYPES, EXT_HISTOGRAM_TYPES, buildExtType, columnsLivePoint, kagiSpec, kagiSegmentOptions, pnfColumns, pnfHostOptions } from '../bazaarnama/charttypes_ext';
import CodeEditor from '../bazaarnama/CodeEditor';
import BottomDock, { NotesTab, StrategyTesterTab } from '../bazaarnama/BottomDock';
import { EXAMPLES, REFERENCE } from '../bazaarnama/scriptlib';
import bnLogo from '../assets/bn-logo.png';
import MiniChart from '../bazaarnama/MiniChart';
import { CROSSHAIR_MODES, crosshairModeById, crosshairOptions, paintCrosshairGlyph, PRICE_SCALE_MODES, priceScaleOptions, resetPriceScaleOptions, SESSIONS, sessionBands, paintSessions, secondsToClose, formatCountdown, countdownTint, TIMEZONES, timeZoneOptions, CH3_DEFAULTS } from '../bazaarnama/scales_crosshair';
import { attachHotkeys, SHORTCUT_GROUPS } from '../bazaarnama/hotkeys';
import { useBreakpoint, MobileToolSheet, CompactTopBar, MobileBottomNav, BREAKPOINTS } from '../bazaarnama/mobile';
import { useViewport } from '../bazaarnama/useViewport';
import { GRID_PRESET_ORDER, getGridLayout, presetToLegacyGrid, legacyGridToPreset } from '../bazaarnama/layoutPresets';
import { Legend, ChartLegend, CountdownChip, Watermark, ReplayBar } from '../bazaarnama/overlays/ChartOverlays';
import SymbolLogo from '../bazaarnama/SymbolLogo';
import SymbolSearchModal from '../bazaarnama/SymbolSearchModal';
import { buildMeta } from '../bazaarnama/symbolMeta';
import ScreenshotMenu from '../bazaarnama/ScreenshotMenu';
import { captureChart, canvasToBlob, copyBlobToClipboard, downloadBlob } from '../bazaarnama/screenshot';
import RightPanel from '../bazaarnama/RightPanel';
import Partners from '../bazaarnama/Partners';
import AuthMenu from '../AuthMenu';
import HelpModal, { HelpDot } from '../bazaarnama/Help';
import Legal from './Legal';
import { getHelp } from '../bazaarnama/help';
import { HelpCircle } from 'lucide-react';

const TFS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'D1', 'W1', 'MN'];
// باسِ همگام‌سازیِ چندچارتی (زمان + کراس‌هیر) — هر MiniChart مشترک می‌شود
function makeSyncBus() { let subs = []; return { enabled: true, subscribe(fn) { subs.push(fn); return () => { subs = subs.filter((s) => s !== fn); }; }, emit(type, payload, self) { if (!this.enabled) return; subs.forEach((fn) => { if (fn !== self) fn(type, payload); }); } }; }
// برچسبِ کوتاه + عنوانِ فارسی برای نوارِ تایم‌فریمِ حرفه‌ای
const TF_LABEL = { M1: '1m', M5: '5m', M15: '15m', M30: '30m', H1: '1H', H2: '2H', H4: '4H', D1: '1D', W1: '1W', MN: '1Mo' };
const TF_TITLE = { M1: '۱ دقیقه', M5: '۵ دقیقه', M15: '۱۵ دقیقه', M30: '۳۰ دقیقه', H1: '۱ ساعته', H2: '۲ ساعته', H4: '۴ ساعته', D1: 'روزانه', W1: 'هفتگی', MN: 'ماهانه' };
// برچسبِ اندیکاتور با پارامترها (مثلِ TradingView: «EMA 20»، «MACD 12 26 9») — مقادیرِ عددیِ ورودی را ضمیمه می‌کند
const indParamStr = (inputs) => {
  if (!inputs || typeof inputs !== 'object') return '';
  const vals = Object.values(inputs).filter((v) => typeof v === 'number' && Number.isFinite(v));
  return vals.length ? ' ' + vals.join(' ') : '';
};
// پارسِ «تایپِ بازهٔ زمانی» (مثلِ TradingView): «15»/«5m»/«1h»/«4h»/«1d»/«1w»/«1mo» → کدِ داخلی
const parseIntervalToTf = (raw) => {
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^(\d+)(mo|min|month|week|hour|day|m|h|d|w)?$/);
  if (!m) return null;
  const n = parseInt(m[1], 10); let u = m[2] || 'm';
  if (u === 'min') u = 'm'; else if (u === 'hour') u = 'h'; else if (u === 'day') u = 'd'; else if (u === 'week') u = 'w'; else if (u === 'month') u = 'mo';
  const MAP = { m1: 'M1', m5: 'M5', m15: 'M15', m30: 'M30', m60: 'H1', m120: 'H2', m240: 'H4', h1: 'H1', h2: 'H2', h4: 'H4', d1: 'D1', w1: 'W1', mo1: 'MN' };
  return MAP[`${u}${n}`] || null;
};
// طولِ هر کندل به ثانیه — برای ساختِ کندلِ زندهٔ بعدی و پروجکشنِ رو به جلوی ناحیه‌ها
const TF_SEC = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H2: 7200, H4: 14400, D1: 86400, W1: 604800, MN: 2592000 };
const tfSec = (t) => TF_SEC[t] || 3600;
// دقتِ اعشارِ قیمت بر اساسِ نماد (مثلِ TradingView): JPY=3، طلا=2، شاخص/نفت=2، کریپتو=1، فارکس=5
const priceDigits = (sym = '') => {
  const s = String(sym).toUpperCase();
  if (s.includes('JPY')) return 3;
  if (s.includes('XAU') || s.includes('GOLD')) return 2;
  if (s.includes('XAG')) return 3;
  if (s.includes('BTC') || s.includes('ETH')) return 1;
  if (/XTI|USOIL|UKOIL|WTI|BRENT/.test(s)) return 2;
  if (/US30|US500|NAS100|DE40|SPX|DJI|NDX|UK100|JP225|US100/.test(s)) return 2;
  return 5;
};
const fmtPrice = (sym, v) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(priceDigits(sym)));
// قالبِ فشردهٔ حجم برای پنجرهٔ داده (K/M/B)
const fmtVol = (v) => {
  const n = Number(v); if (v == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return String(Math.round(n));
};
// تایم‌فریم‌های مشتق‌شده: از تایم‌فریمِ پایه با تجمیع ساخته می‌شوند [پایه, ضریب]
const DERIVED_TF = { M30: ['M15', 2], H2: ['H1', 2], W1: ['D1', 5], MN: ['D1', 22] };
// پالتِ رنگِ نمادهای مقایسه‌ای (Compare) — رنگ‌های متمایز و اورجینال
const CMP_PALETTE = ['#f59e0b', '#a855f7', '#22d3ee', '#ef4444', '#84cc16', '#ec4899', '#14b8a6', '#f97316'];

// خطوطِ عمودیِ جداکننده روی کانواسِ overlay (مثلِ separators تریدینگ‌ویو) — واحدِ تطبیقی: روز/ماه/سال
function paintDaySeparators(ctx, chart, candles, height, color, unit = 'day') {
  if (!candles || !candles.length) return;
  const ts = chart.timeScale();
  const keyOf = (dt) => unit === 'year' ? String(dt.getUTCFullYear())
    : unit === 'month' ? dt.getUTCFullYear() + '-' + dt.getUTCMonth()
      : dt.getUTCFullYear() + '-' + dt.getUTCMonth() + '-' + dt.getUTCDate();
  ctx.save();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  let prevKey = null;
  for (const c of candles) {
    const key = keyOf(new Date(c.t * 1000));
    if (prevKey !== null && key !== prevKey) {
      const x = ts.timeToCoordinate(c.t);
      if (x != null) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    }
    prevKey = key;
  }
  ctx.restore();
}
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
// لِی‌اوتهای نام‌دار (مثلِ Saved Layouts تریدینگ‌ویو) — نگاشتِ name→snapshotِ کاملِ میزِکار، محلی
const LAYOUTS_KEY = 'bn_layouts';
const loadLayouts = () => { try { return JSON.parse(localStorage.getItem(LAYOUTS_KEY) || '{}') || {}; } catch (e) { return {}; } };
const saveLayouts = (obj) => { try { localStorage.setItem(LAYOUTS_KEY, JSON.stringify(obj)); } catch (e) { /* noop */ } };
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
  ...EXT_CHART_TYPES,
];
// ابزارهای ترسیم اکنون در کامپوننتِ ToolRail (گروه‌بندی‌شده، سبکِ TradingView) تعریف می‌شوند.

// پالتِ هم‌ترازِ TradingView (آبیِ برندِ Pro-Chart #2962FF). توکن‌محور — هیچ رنگِ inline.
const THEMES = {
  dark: {
    bg: '#131722', panel: '#1e222d', border: '#2a2e39', grid: '#1e222d',
    text: '#b2b5be', textStrong: '#d1d4dc',
    up: '#26a69a', down: '#ef5350',
    chipBg: 'rgba(255,255,255,.06)', chipBgHover: 'rgba(255,255,255,.10)',
    subtle: 'rgba(255,255,255,.04)', popoverBg: 'rgba(30,34,45,.98)',
    overlayMask: 'rgba(0,0,0,.42)', accent: '#2962FF', accentAi: '#8b5cf6',
    tpColor: '#22c55e', slColor: '#ef4444',
  },
  light: {
    bg: '#ffffff', panel: '#f0f3fa', border: '#e0e3eb', grid: '#e0e3eb',
    text: '#5d606b', textStrong: '#131722',
    up: '#089981', down: '#f23645',
    chipBg: 'rgba(0,0,0,.04)', chipBgHover: 'rgba(0,0,0,.07)',
    subtle: 'rgba(0,0,0,.03)', popoverBg: 'rgba(255,255,255,.98)',
    overlayMask: 'rgba(255,255,255,.8)', accent: '#2962FF', accentAi: '#7c3aed',
    tpColor: '#22c55e', slColor: '#ef4444',
  },
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

// شفافیت روی رنگِ hex/rgb (برای تبِ Style اندیکاتور). op در [0..1]؛ null/۱ یعنی بدونِ تغییر.
const applyOpacity = (color, op) => {
  if (op == null || op >= 1 || !color) return color;
  const a = Math.max(0, Math.min(1, op));
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (m) { const n = parseInt(m[1], 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  const rm = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rm) { const p = rm[1].split(',').slice(0, 3).map((x) => x.trim()); return `rgba(${p.join(',')},${a})`; }
  return color;
};

let _uid = 0; const uid = () => `i${++_uid}_${Math.floor(Math.random() * 1e6)}`;

// تولتیپِ کوچک هنگامِ hover روی آیکونِ ابزار (توضیحِ کاربرد)
function Tip({ label, children }) {
  return (
    <span className="relative group/tip flex">
      {children}
      <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-[#11161f] text-gray-100 text-[11px] px-2 py-1 border border-white/10 shadow-lg opacity-0 transition-opacity duration-[120ms] delay-0 group-hover/tip:opacity-100 group-hover/tip:delay-[400ms] z-50">
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
  const auxSeriesRef = useRef([]); // سری‌های فرعیِ انواعِ چندسری (HLC Area / Kagi yang-yin / P&F)
  const drawRef = useRef(null);
  const overlaySeries = useRef({});
  const compareSeries = useRef({}); // symbol → LineSeries (نمادهای مقایسه‌ای روی همان چارت)
  const comparesRef = useRef([]);   // نسخهٔ تازهٔ compares برای دسترسی در هندلرِ کراس‌هیر (بدون stale closure)
  const subChartsRef = useRef({});
  const subPaneHRef = useRef({}); // ارتفاعِ کشیده‌شدهٔ کاربر برای هر پِینِ اندیکاتور (حفظ در rebuildها)
  const scriptSeries = useRef([]);
  const scriptHlines = useRef([]);
  const candlesRef = useRef([]);
  const liveLineRef = useRef(null);
  const lastMidRef = useRef({});
  const symbolRef = useRef('EURUSD'); // نمادِ جاری برای استفاده در هندلرهای mount-time (کراس‌هیر)
  const thRef = useRef(null);         // تمِ جاری برای هندلرهای mount-time (رفعِ stale-closure رنگ‌ها)
  const symHistRef = useRef({ stack: [], idx: -1 }); // تاریخچهٔ نماد (back/forward)
  const symNavRef = useRef(false);    // پرچمِ سرکوبِ push هنگام حرکتِ back/forward
  const [symHist, setSymHist] = useState({ back: false, fwd: false });
  const watchRef = useRef([]);        // واچ‌لیست (برای میان‌بُرِ نماد بعدی/قبلی)
  const symbolsRef = useRef([]);      // همهٔ نمادها (fallback)
  const lazyRef = useRef({ loading: false, exhausted: false }); // بارگذاریِ تنبلِ تاریخ
  const loadMoreRef = useRef(null);
  const easeRef = useRef({ target: null, display: null }); // انیمیشنِ نرمِ قیمتِ زنده (حسِ تیک‌به‌تیک)

  const [symbol, setSymbol] = useState(() => loadWS().symbol || 'EURUSD');
  const [tf, setTf] = useState(() => loadWS().tf || 'H1');
  const [tfQuick, setTfQuick] = useState(null); // پاپ‌آورِ «تایپِ بازهٔ زمانی» (باز = رشتهٔ ورودی)
  const [chartType, setChartType] = useState(() => loadWS().chartType || 'candles');
  const [theme, setTheme] = useState(() => loadWS().theme || 'dark');
  const [symbols, setSymbols] = useState([]);
  const [overlays, setOverlays] = useState(() => loadWS().overlays || []);
  const [subs, setSubs] = useState(() => loadWS().subs || []);
  const [indsHidden, setIndsHidden] = useState(() => loadWS().indsHidden ?? false); // توگلِ سراسریِ پنهان‌کردنِ همهٔ اندیکاتورها
  const indsHiddenRef = useRef(indsHidden);
  const [indAxisLabels, setIndAxisLabels] = useState(() => loadWS().indAxisLabels ?? true); // برچسبِ مقدارِ آخرِ اندیکاتورهای overlay روی محورِ قیمت (مثلِ TradingView)
  const indAxisLabelsRef = useRef(indAxisLabels);
  const [compares, setCompares] = useState(() => loadWS().compares || []); // نمادهای مقایسه‌ای [{symbol,color}]
  const [cmpModal, setCmpModal] = useState(false); // مودالِ افزودنِ نمادِ مقایسه
  const [cmpPercent, setCmpPercent] = useState(() => !!loadWS().cmpPercent); // مقایسهٔ درصدی (نرمال‌سازیِ % مثلِ TradingView)
  const [cmpVals, setCmpVals] = useState({}); // {symbol:{last,pct}} برای نمایش در چیپِ مقایسه
  const cmpValsRef = useRef({}); // نسخهٔ تازه برای هندلرهای mount-time (Data Window)
  const [indMenu, setIndMenu] = useState(false);
  const [indSearch, setIndSearch] = useState(''); // فیلترِ جست‌وجوی اندیکاتورها
  const [ovMenu, setOvMenu] = useState(false); // منوی «نمایش» — توگل‌های overlayِ چارت
  const [indFavs, setIndFavs] = useState(() => loadWS().indFavs || []); // اندیکاتورهای منتخب (پین‌شده)
  const toggleIndFav = (k) => setIndFavs((f) => { const n = f.includes(k) ? f.filter((x) => x !== k) : [...f, k]; saveWS({ indFavs: n }); return n; });
  const [indTpls, setIndTpls] = useState(() => loadWS().indTpls || {}); // {name:{overlays,subs}} — تمپلیتِ اندیکاتورها
  const saveIndTpl = () => { const name = (window.prompt('نامِ تمپلیتِ اندیکاتورها:') || '').trim(); if (!name) return; const n = { ...indTpls, [name]: { overlays, subs } }; setIndTpls(n); saveWS({ indTpls: n }); };
  const applyIndTpl = (name) => { const t = indTpls[name]; if (!t) return; setOverlays(t.overlays || []); setSubs(t.subs || []); setIndMenu(false); };
  const delIndTpl = (name) => setIndTpls((p) => { const n = { ...p }; delete n[name]; saveWS({ indTpls: n }); return n; });
  const [ctMenu, setCtMenu] = useState(false);
  const [watch, setWatch] = useState([]);
  const [rightTab, setRightTab] = useState(() => loadWS().rightTab || 'watch');
  const [panelWidth, setPanelWidth] = useState(() => loadWS().panelWidth || 256); // عرضِ قابل‌تنظیمِ پنلِ کناری
  const [showRight, setShowRight] = useState(() => loadWS().showRight ?? (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
  const [editorOpen, setEditorOpen] = useState(false);
  const [bnPrem, setBnPrem] = useState(false); // آیا کاربر پرمیوم/VIP است (برای گیتِ نمااسکریپت #۸)
  useEffect(() => { api.me().then((m) => setBnPrem(['vip', 'premium'].includes(m && m.tier))).catch(() => {}); }, []);
  const openNamaScript = useCallback(() => {
    if (!bnPrem) { try { window.dispatchEvent(new CustomEvent('bn:premium', { detail: 'نمااسکریپت ویژهٔ کاربرانِ پرمیومِ بازارنماست.' })); } catch (e) {} return; }
    setEditorOpen((v) => !v);
  }, [bnPrem]);
  const [helpId, setHelpId] = useState(null); // #۱۷ راهنمای «؟» ابزار/اندیکاتورِ انتخاب‌شده
  const [tool, setTool] = useState('cursor'); // ابزارِ ترسیمِ فعال (قبل از افکتِ bn:* تا TDZ نشود)
  const [showLegal, setShowLegal] = useState(false); // #۱۲ مودالِ قوانین/حریمِ خصوصی (قبل از افکت)
  // #۱۴/#۳ شورت‌کاتِ فیچرهای منوی همبرگری (AuthMenu رویدادهای bn:* را dispatch می‌کند)
  useEffect(() => {
    const onTab = (e) => { const t = e.detail === 'calendar' ? 'cal' : e.detail; if (t) setRightTab(t); setShowRight(true); };
    const onScript = () => openNamaScript();
    const onHelp = () => { if (getHelp(tool) && tool !== 'cursor') setHelpId(tool); else setShowShortcuts(true); };
    const onThemeT = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')); // #۳ تمِ روز/شب از منو
    const onTerms = () => setShowLegal(true);                                  // #۱۲ صفحهٔ قوانین
    const ext = (url) => () => { try { window.open(url, '_blank', 'noopener'); } catch (e) {} };
    const onSup = ext('https://t.me/CoinePro_Admin'); // #۱۳ پشتیبانِ CoinePro FX
    window.addEventListener('bn:rightTab', onTab); window.addEventListener('bn:openScript', onScript); window.addEventListener('bn:help', onHelp);
    window.addEventListener('bn:support', onSup); window.addEventListener('bn:terms', onTerms); window.addEventListener('bn:toggleTheme', onThemeT);
    return () => { window.removeEventListener('bn:rightTab', onTab); window.removeEventListener('bn:openScript', onScript); window.removeEventListener('bn:help', onHelp); window.removeEventListener('bn:support', onSup); window.removeEventListener('bn:terms', onTerms); window.removeEventListener('bn:toggleTheme', onThemeT); };
  }, [tool, openNamaScript]);
  const [code, setCode] = useState(() => loadWS().code || ''); // کدِ نمااسکریپت با رفرش پاک نمی‌شود
  const [barMode, setBarMode] = useState(false); // اجرای بار-به-بارِ نمااسکریپت (اختیاری)
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
  const [editInd, setEditInd] = useState(null); // {scope,id}
  const [indDlgTab, setIndDlgTab] = useState('inputs'); // تبِ دیالوگِ تنظیماتِ اندیکاتور: inputs | style
  const [layouts, setLayouts] = useState([]);
  const [bt, setBt] = useState(null); // strategy tester result
  const [btCost, setBtCost] = useState({ comm: 0, slip: 0 }); // کارمزد/اسلیپیجِ بک‌تست
  const [btTab, setBtTab] = useState('overview'); // overview | performance | trades
  const [savedAlerts, setSavedAlerts] = useState([]);
  const [alForm, setAlForm] = useState({ op: 'above', value: '', trigger: 'recurring', telegram: false, message: '', expiryH: '' });
  const [live, setLive] = useState({});
  const [marketOpen, setMarketOpen] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [showCountdown, setShowCountdown] = useState(() => loadWS().showCountdown ?? true); // نمایشِ شمارشِ معکوسِ بسته‌شدنِ کندل
  const [clock, setClock] = useState(''); // ساعتِ زندهٔ منطقهٔ زمانیِ انتخابی
  const [countdown, setCountdown] = useState(''); // شمارشِ معکوسِ بسته‌شدنِ کندل
  const [countdownFrac, setCountdownFrac] = useState(0); // کسرِ سپری‌شدهٔ کندل (برای حلقهٔ پیشرفت)
  const [countdownColor, setCountdownColor] = useState(null); // تینتِ نزدیکِ بسته‌شدن (قرمز/کهربایی)
  const [showVP, setShowVP] = useState(() => !!loadWS().showVP);
  const [showPatterns, setShowPatterns] = useState(() => !!loadWS().showPatterns); // تشخیصِ خودکارِ الگوهای کندل
  const [showDiv, setShowDiv] = useState(() => !!loadWS().showDiv); // تشخیصِ خودکارِ واگراییِ RSI
  const [showHarm, setShowHarm] = useState(() => !!loadWS().showHarm); // الگوهای هارمونیک
  const [showGaps, setShowGaps] = useState(() => !!loadWS().showGaps); // نشانگرِ گپِ قیمت
  const [markerLabels, setMarkerLabels] = useState(() => loadWS().markerLabels ?? true); // نمایشِ متنِ مارکرهای تشخیص
  const [detCounts, setDetCounts] = useState({ pat: 0, div: 0, harm: 0, gap: 0 }); // تعدادِ تشخیص‌ها (برای نمایش کنارِ توگل)
  const markerLabelsRef = useRef(loadWS().markerLabels ?? true);
  const [showVolume, setShowVolume] = useState(() => loadWS().showVolume ?? true); // هیستوگرامِ حجم روی پِینِ اصلی (پیش‌فرضِ تریدینگ‌ویو)
  const [showPD, setShowPD] = useState(() => !!loadWS().showPD); // خطوطِ سقف/کف/بستهٔ روزِ قبل (PDH/PDL/PDC)
  const [showHL, setShowHL] = useState(() => !!loadWS().showHL); // خطوطِ سقف/کفِ بازهٔ دیده‌شده (HH/LL)
  const [showDaySep, setShowDaySep] = useState(() => !!loadWS().showDaySep); // خطوطِ جداکنندهٔ روز
  const daySepRef = useRef(false); // فعال بودنِ جداکننده‌ها
  const daySepUnitRef = useRef('day'); // واحدِ جداکننده: day/month/year
  const [showWk, setShowWk] = useState(() => !!loadWS().showWk); // سطوحِ هفتهٔ قبل (PWH/PWL/PWC/WO)
  const [showMo, setShowMo] = useState(() => !!loadWS().showMo); // سطوحِ ماهِ قبل (PMH/PML/PMC/MO)
  const [showEcon, setShowEcon] = useState(() => !!loadWS().showEcon); // رویدادهای اقتصادیِ پراثر روی چارت
  const [showNews, setShowNews] = useState(() => !!loadWS().showNews); // فلگ‌های خبر روی چارت
  const [showWatermark, setShowWatermark] = useState(() => loadWS().showWatermark ?? true); // واترمارکِ متنیِ نماد
  const wmRef = useRef(null);
  const [cfgOpen, setCfgOpen] = useState(false); // دیالوگِ تنظیماتِ ظاهرِ چارت
  const [cfgTab, setCfgTab] = useState('appearance'); // تبِ فعالِ دیالوگِ تنظیمات (مثلِ Chart Settings تریدینگ‌ویو)
  const [gotoOpen, setGotoOpen] = useState(false); // پاپ‌آورِ «برو به تاریخ»
  const [gotoDate, setGotoDate] = useState(''); // مقدارِ ورودیِ تاریخ
  const [candleUp, setCandleUp] = useState(() => loadWS().candleUp || ''); // رنگِ سفارشیِ کندلِ صعودی ('' = پیش‌فرضِ تم)
  const [candleDn, setCandleDn] = useState(() => loadWS().candleDn || ''); // رنگِ سفارشیِ کندلِ نزولی
  const [candleWick, setCandleWick] = useState(() => loadWS().candleWick || ''); // رنگِ سفارشیِ سایه/فتیلهٔ کندل ('' = رنگِ بدنه)
  const [pricePrec, setPricePrec] = useState(() => loadWS().pricePrec ?? 'auto'); // دقتِ اعشارِ قیمت ('auto' یا ۰..۸) — مثلِ Precision تریدینگ‌ویو
  const pricePrecRef = useRef(pricePrec);
  const [gridOn, setGridOn] = useState(() => loadWS().gridOn ?? true); // نمایشِ خطوطِ شبکه (سازگاریِ عقب‌رو / master)
  const [gridColor, setGridColor] = useState(() => loadWS().gridColor || ''); // رنگِ سفارشیِ خطوطِ شبکه ('' = پیش‌فرضِ تم)
  const [gridVert, setGridVert] = useState(() => loadWS().gridVert ?? (loadWS().gridOn ?? true)); // خطوطِ عمودیِ شبکه (مثلِ TradingView)
  const [gridHorz, setGridHorz] = useState(() => loadWS().gridHorz ?? (loadWS().gridOn ?? true)); // خطوطِ افقیِ شبکه
  const [customBg, setCustomBg] = useState(() => loadWS().customBg || ''); // رنگِ سفارشیِ پس‌زمینه ('' = تم)
  const [showPriceLine, setShowPriceLine] = useState(() => loadWS().showPriceLine ?? true); // خطِ آخرین قیمت
  const showPriceLineRef = useRef(loadWS().showPriceLine ?? true);
  const ccRef = useRef({ up: '#26a69a', dn: '#ef5350' }); // رنگِ مؤثرِ کندل (سفارشی یا تم)
  const layoutFileRef = useRef(null); // inputِ مخفیِ ورودیِ فایلِ چیدمان
  const [vpMode, setVpMode] = useState(() => loadWS().vpMode || 'total'); // total = کلِ داده، visible = بازهٔ دیده‌شده (VPVR)
  const vpModeRef = useRef(loadWS().vpMode || 'total');
  const vpFixedRef = useRef(loadWS().vpFixed || null); // {from,to} بازهٔ ثابتِ VP
  const applyVPRef = useRef(null);
  const showVPRef = useRef(false);
  const btMarkersRef = useRef(null); // مارکرهای ورود/خروجِ بک‌تست روی چارت
  const patMarkersRef = useRef(null); // مارکرهای الگوهای کندل‌استیک
  const divMarkersRef = useRef(null); // مارکرهای واگراییِ RSI
  const divLinesRef = useRef([]);     // خطوطِ اتصالِ واگرایی
  const harmMarkersRef = useRef(null); // مارکرهای الگوهای هارمونیک
  const harmLinesRef = useRef([]);     // خطوطِ XABCD الگوهای هارمونیک
  const gapMarkersRef = useRef(null);  // مارکرهای گپِ قیمت
  const applyGapsRef = useRef(null);
  const showGapsRef = useRef(!!loadWS().showGaps);
  const applyHarmRef = useRef(null);
  const showHarmRef = useRef(!!loadWS().showHarm);
  const econMarkersRef = useRef(null); // مارکرهای رویدادهای اقتصادی
  const applyEconRef = useRef(null);
  const showEconRef = useRef(!!loadWS().showEcon);
  const newsMarkersRef = useRef(null); // فلگ‌های خبر
  const applyNewsRef = useRef(null);
  const showNewsRef = useRef(!!loadWS().showNews);
  const volSeriesRef = useRef(null);  // هیستوگرامِ حجم روی پِینِ اصلی
  const volMaRef = useRef(null);      // خطِ میانگینِ متحرکِ حجم
  const lastBarRef = useRef(null);    // آخرین کندل برای نمایشِ دائمیِ OHLC در Legend (مثلِ TradingView)
  const crosshairActiveRef = useRef(false); // آیا نشانگر روی کندلی است (برای به‌روزرسانیِ زندهٔ لِجند)
  const origTitleRef = useRef(typeof document !== 'undefined' ? document.title : ''); // عنوانِ اصلیِ تب برای بازگردانی
  const applyVolumeRef = useRef(null);
  const showVolumeRef = useRef(loadWS().showVolume ?? true);
  const alertLinesRef = useRef([]);   // خطوطِ قیمتیِ آلارم‌ها روی چارت
  const pdLinesRef = useRef([]);      // خطوطِ سقف/کف/بستهٔ روزِ قبل
  const drawPdLinesRef = useRef(null);
  const showPDRef = useRef(!!loadWS().showPD);
  const hlLinesRef = useRef([]);      // خطوطِ سقف/کفِ بازهٔ دیده‌شده
  const drawHLRef = useRef(null);
  const showHLRef = useRef(!!loadWS().showHL);
  const wkLinesRef = useRef([]);      // خطوطِ سطوحِ هفتهٔ قبل
  const drawWkRef = useRef(null);
  const showWkRef = useRef(!!loadWS().showWk);
  const moLinesRef = useRef([]);      // خطوطِ سطوحِ ماهِ قبل
  const drawMoRef = useRef(null);
  const showMoRef = useRef(!!loadWS().showMo);
  const savedAlertsRef = useRef([]);  // نسخهٔ تازهٔ savedAlerts برای رسمِ خطوط
  const alertPrevPriceRef = useRef(null); // قیمتِ تیکِ قبلی برای تشخیصِ عبور
  const alertFiredRef = useRef(new Set()); // آلارم‌های غیرتکراریِ فعال‌شده (ضدِ تکرار)
  const [alertToast, setAlertToast] = useState(null); // بنرِ درون‌مرورگریِ آلارم
  const [alertSound, setAlertSound] = useState(() => loadWS().alertSound ?? true); // صدای آلارم
  const alertSoundRef = useRef(loadWS().alertSound ?? true);
  const audioCtxRef = useRef(null);
  const drawAlertLinesRef = useRef(null);
  const [magnet, setMagnet] = useState(loadWS().magnet ?? false);
  const [magnetMode, setMagnetMode] = useState(loadWS().magnetMode ?? 'strong'); // 'weak' | 'strong' — مگنتِ سه‌حالته مثلِ TradingView
  const magnetRef = useRef(magnet); const magnetModeRef = useRef(magnetMode); // برای میان‌برِ mount-time (سیکلِ مگنت)
  const [drawingsHidden, setDrawingsHidden] = useState(loadWS().drawingsHidden ?? false); // توگلِ سراسریِ چشمِ ترسیم‌ها
  const [drawingsLocked, setDrawingsLocked] = useState(loadWS().drawingsLocked ?? false); // توگلِ سراسریِ قفلِ ترسیم‌ها
  const [order, setOrder] = useState(null); // {side, entry, sl, tp} — #D: پیش‌فرض هیچ پوزیشنی باز نیست (از localStorage بازیابی نمی‌شود)
  const [aiSig, setAiSig] = useState(() => loadWS().aiSig || null); // سیگنالِ AI — باگ۳: با رفرش پاک نشود
  const [aiList, setAiList] = useState([]); // همهٔ سیگنال‌های اخیر — همیشه در ساید‌بار می‌مانند
  const [aiBusy, setAiBusy] = useState(false);
  const [aiQuota, setAiQuota] = useState(null);
  const aiLinesRef = useRef([]);
  const aiZonesRef = useRef([]); // سری‌های ناحیهٔ سبز/قرمزِ سیگنالِ AI (پروجکشنِ رو به جلو)
  const [grid, setGrid] = useState(1); // 1/2/4 چند-چارت
  const [gridSync, setGridSync] = useState(loadWS().gridSync ?? true); // همگام‌سازیِ کراس‌هیر/زمانِ گریدِ چندچارتی
  const [gridMenu, setGridMenu] = useState(false); // منوی پریستِ چیدمانِ چند-چارت (layoutPresets)
  const [ovlMenu, setOvlMenu] = useState(false); // فلای‌اوتِ گروهِ اورلی‌ها/تحلیلِ خودکار در نوارِ ابزارِ چپ
  const [scaleMenu, setScaleMenu] = useState(false); // پاپ‌آورِ گروهِ «مقیاس و کراس‌هیر» در نوارِ بالا
  const [partnersOpen, setPartnersOpen] = useState(false); // مودالِ پارتنرها (صرافی/بروکرِ رفرال)
  const [railMenu, setRailMenu] = useState(false); // فلای‌اوتِ «پنجره‌ها» (درخت/پنجرهٔ‌داده/مقایسه) در نوارِ چپ
  const [treeIndsCol, setTreeIndsCol] = useState(false); // جمع‌شدنِ بخشِ اندیکاتورها در درختِ آبجکت
  const [treeDrawsCol, setTreeDrawsCol] = useState(false); // جمع‌شدنِ بخشِ ترسیم‌ها در درختِ آبجکت
  const [showShortcuts, setShowShortcuts] = useState(false); // دیالوگِ راهنمای میان‌بُرها
  const [symModal, setSymModal] = useState(false); // #7 مدالِ جستجوی نماد
  const [symInitQuery, setSymInitQuery] = useState(''); // کوئریِ اولیه هنگام بازشدن با تایپِ حرف (مثلِ TradingView)
  const [sheet, setSheet] = useState('none'); // #4 شیتِ موبایلِ فعال: none|tf|sym|type|draw|ind|tabs
  const [legCollapsed, setLegCollapsed] = useState(() => !!loadWS().legCollapsed); // #3 جمع‌بودنِ Legend
  const [legView, setLegView] = useState(() => loadWS().legView || 'normal'); // #3 normal|compact
  const [indVals, setIndVals] = useState({}); // #3 مقدارِ زندهٔ اندیکاتورها برای Legend
  const [scaleMode, setScaleMode] = useState(loadWS().scaleMode ?? CH3_DEFAULTS.scaleMode); // 0 عادی / 1 لاگ / 2 درصد / 3 پایه۱۰۰
  const [scaleLocked, setScaleLocked] = useState(loadWS().scaleLocked ?? false); // قفلِ بازهٔ مقیاس
  const [scaleInvert, setScaleInvert] = useState(loadWS().scaleInvert ?? false); // وارونگیِ محور
  const [crosshairId, setCrosshairId] = useState(loadWS().crosshairId ?? 'cross'); // حالتِ کراس‌هیر
  const [crosshairColor, setCrosshairColor] = useState(loadWS().crosshairColor ?? ''); // رنگِ سفارشیِ کراس‌هیر ('' = پیش‌فرضِ تم)
  const crosshairColorRef = useRef(loadWS().crosshairColor ?? ''); // برای رنگِ گلیفِ کراس‌هیر در هندلرِ mount-time
  const [crosshairWidth, setCrosshairWidth] = useState(loadWS().crosshairWidth ?? 1); // ضخامتِ کراس‌هیر (۱..۳)
  const [crosshairStyle, setCrosshairStyle] = useState(loadWS().crosshairStyle ?? 3); // سبکِ کراس‌هیر (LineStyle)
  const [crosshairLabels, setCrosshairLabels] = useState(loadWS().crosshairLabels ?? true); // نمایشِ برچسب‌های کراس‌هیر روی محورها
  const [tz, setTz] = useState(loadWS().tz ?? CH3_DEFAULTS.tz); // منطقهٔ زمانیِ نمایش
  const [sessionsOn, setSessionsOn] = useState(loadWS().sessionsOn ?? false); // نمایشِ باندهای سشن
  const [sessionSel, setSessionSel] = useState(() => loadWS().sessionSel || SESSIONS.map((s) => s.id)); // #1 سشن‌های انتخابی
  const [sessMenu, setSessMenu] = useState(false); // #1 منوی انتخابِ سشن‌ها
  const crosshairGlyphRef = useRef('none'); // برای رسمِ glyph در هندلرِ کراس‌هیر
  const sessionsRef = useRef(null); // باندهای سشنِ محاسبه‌شدهٔ جاری برای رسم روی overlay
  const [drawColor, setDrawColor] = useState(() => loadWS().drawColor || '#3b82f6');
  const [drawWidth, setDrawWidth] = useState(() => loadWS().drawWidth || 1.5); // ضخامتِ پیش‌فرضِ ترسیم
  const [drawDashed, setDrawDashed] = useState(() => !!loadWS().drawDashed); // سبکِ خطِ پیش‌فرضِ ترسیم (سازگاریِ عقب‌رو)
  const [drawLineStyle, setDrawLineStyle] = useState(() => loadWS().drawLineStyle ?? (loadWS().drawDashed ? 2 : 0)); // سبکِ سه‌حالتهٔ ترسیم‌های جدید
  // ── فاز ۳: ویرایشِ آبجکت ──
  const [stayDraw, setStayDraw] = useState(false);   // ماندن در حالتِ ترسیم
  const [selDraw, setSelDraw] = useState(-1);          // ایندکسِ آبجکتِ انتخاب‌شده
  const [drawList, setDrawList] = useState([]);        // فهرستِ ترسیم‌ها (Object Tree)
  const [showTree, setShowTree] = useState(false);     // نمایشِ Object Tree
  const [showDataWin, setShowDataWin] = useState(loadWS().showDataWin ?? false); // Data Window (مقادیرِ زیرِ کراس‌هیر)
  const [dataWin, setDataWin] = useState(null);        // {ohlc, vol, time, inds:[{label,vals,color}]}
  const [ctxMenu, setCtxMenu] = useState(null);        // منوی راست‌کلیکِ چارت {x,y,price}
  const indLabelRef = useRef({});                       // id → {label,color} برای Data Window
  const lastIndValRef = useRef({});                     // id → [last values] برای Legend بیرون از کراس‌هیر
  const showDataWinRef = useRef(loadWS().showDataWin ?? false); // گیتِ محاسبهٔ Data Window در هندلرِ کراس‌هیر
  const [drawVer, setDrawVer] = useState(0);           // نسخه برای رفرشِ دکمه‌های undo/redo
  const treeRefresh = useCallback(() => { const dl = drawRef.current; setDrawList(dl ? dl.getDrawings().slice() : []); setDrawVer((v) => v + 1); }, []);
  const rootRef = useRef(null);
  const syncBusRef = useRef(null); if (!syncBusRef.current) syncBusRef.current = makeSyncBus(); // باسِ همگام‌سازیِ چندچارتی
  const [replay, setReplay] = useState({ on: false, playing: false, speed: 1, idx: 0, length: 0 });
  const replayRef = useRef({ full: [], idx: 0 });
  const replayPlayingRef = useRef(false);
  // کنترلرِ headless برای زمان‌بندیِ سرعت/مکان‌نما/seek (additive — مسیرِ slice+series.update فعلی دست‌نخورده می‌ماند)
  const replayCtrlRef = useRef(null);

  const TH = THEMES[theme];
  const bp = useBreakpoint();
  // تشخیصِ خودکارِ ویوپورت (جامع): گوشی/تبلتِ پرتره/تبلتِ لنداسکیپ/دسکتاپ + orientation.
  // compact = هر چیدمانی که باید فشرده شود (گوشی + تبلت + لنداسکیپِ کم‌ارتفاع) تا چیزی روی چارت نیفتد.
  const vp = useViewport();
  const compact = vp.compact;            // تولبارِ آیکونی + نوارِ پایین + شیت‌ها (به‌جای تولبارِ wrapِ دسکتاپ)
  const overlayPanels = compact;          // ToolRail/RightPanel به‌صورتِ overlay (روی چارت نیفتند، فضای افقی نخورند)

  // ── ساختِ چارت ──
  useEffect(() => {
    if (!mainRef.current) return;
    const el = mainRef.current;
    const chart = createChart(el, {
      // #۱۰/#۱۸ فیدلیتیِ TradingView: لوگوی پیش‌فرضِ کتابخانه پنهان (لوگوی خودِ بازارنما پایین‌چپ هست)
      layout: { background: { color: TH.bg }, textColor: TH.text, fontFamily: 'AnjomanMax, Vazirmatn, sans-serif', fontSize: 11, attributionLogo: false, panes: { enableResize: true, separatorColor: TH.border, separatorHoverColor: TH.accent } },
      grid: { vertLines: { color: TH.grid }, horzLines: { color: TH.grid } },
      // مقیاسِ زمان سبکِ TV: قفلِ رِنج روی resize، آخرین کندل ثابت هنگام اسکرول، فاصلهٔ پایهٔ میله، بدونِ tickِ ریز
      timeScale: {
        timeVisible: true, secondsVisible: false, borderColor: TH.grid, rightOffset: 6,
        barSpacing: 8, minBarSpacing: 1.5, lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true, ticksVisible: false,
      },
      // مقیاسِ قیمت سبکِ TV: حاشیهٔ بالا/پایین تا کندل به لبه نچسبد، متنِ کامل، بدونِ tick
      rightPriceScale: { borderColor: TH.grid, scaleMargins: { top: 0.12, bottom: 0.08 }, entireTextOnly: true, ticksVisible: false },
      crosshair: { mode: 0 },
      // روانیِ تعامل سبکِ TV: کینتیک‌اسکرولِ لمسی + تعقیبِ نرمِ ماوس
      kineticScroll: { touch: true, mouse: false },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
      width: el.clientWidth || 600,
      height: el.clientHeight || 400,
    });
    chartRef.current = chart;
    compareSeries.current = {}; // چارت بازساخته شد (تعویضِ تم) → رفرنسِ سری‌های مقایسه ریست شود
    wmRef.current = null; // واترمارکِ متنی هم روی چارتِ جدید بازساخته می‌شود
    thRef.current = TH;  // تمِ جاری برای هندلرهای این چارت
    // لایهٔ ترسیم
    const cv = overlayRef.current;
    const dl = new DrawingLayer(cv, chart);
    drawRef.current = dl;
    try { dl.setWidth(loadWS().drawWidth || 1.5); dl.setDashed(!!loadWS().drawDashed); } catch (e) {} // اعمالِ ضخامت/سبکِ ذخیره‌شده
    // نگه‌داشتنِ خودکارِ ترسیم‌ها در مرورگر + بازیابیِ آن‌ها پس از رفرش
    dl.onChange = (drawings) => { saveWS({ drawings }); setDrawList(drawings.slice()); setDrawVer((v) => v + 1); };
    dl.onSelect = (i) => setSelDraw(i);
    // باگ#۲: وقتی ابزار پس از ترسیم به cursor ریست می‌شود، استیتِ React هم همگام شود
    // تا انتخابِ دوبارهٔ همان ابزار دوباره effect را trigger کند (وگرنه ابزارها بعد از یک‌بار/حذف کار نمی‌کنند).
    dl.onToolReset = () => setTool('cursor');
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
    chart.timeScale().subscribeVisibleLogicalRangeChange((rng) => {
      dl.render();
      const ctx = overlayRef.current && overlayRef.current.getContext('2d');
      if (ctx && sessionsRef.current) paintSessions(ctx, chart, sessionsRef.current, overlayRef.current.height);
      if (ctx && daySepRef.current) paintDaySeparators(ctx, chart, candlesRef.current, overlayRef.current.height, (thRef.current || TH).border, daySepUnitRef.current);
      if (rng && rng.from < 12 && loadMoreRef.current) loadMoreRef.current();
      // VPVR: در حالتِ «بازهٔ دیده‌شده»، پروفایلِ حجم با پن/زوم بازمحاسبه می‌شود
      if (vpModeRef.current === 'visible' && showVPRef.current && applyVPRef.current) applyVPRef.current();
      if (showHLRef.current && drawHLRef.current) drawHLRef.current(); // HH/LL با پن/زوم به‌روز می‌شود
      try { const n = candlesRef.current.length; setAtRealtime(!rng || rng.to >= n - 2); } catch (e) { /* */ }
    });
    chart.subscribeCrosshairMove((p) => {
      dl.render();
      const ctx = overlayRef.current && overlayRef.current.getContext('2d');
      if (ctx && sessionsRef.current) paintSessions(ctx, chart, sessionsRef.current, overlayRef.current.height);
      if (ctx && daySepRef.current) paintDaySeparators(ctx, chart, candlesRef.current, overlayRef.current.height, (thRef.current || TH).border, daySepUnitRef.current);
      if (ctx && p && p.point) paintCrosshairGlyph(ctx, crosshairGlyphRef.current, p.point.x, p.point.y, (thRef.current || TH), crosshairColorRef.current || undefined);
      if (!p || !p.time || !priceSeriesRef.current) {
        crosshairActiveRef.current = false;
        setLegend(lastBarRef.current); setIndVals({});
        if (showDataWinRef.current) {
          const cs = candlesRef.current;
          if (cs.length) {
            const i = cs.length - 1, c = cs[i], prev = i > 0 ? cs[i - 1].c : c.o;
            const inds = [];
            Object.entries(indLabelRef.current).forEach(([id, meta]) => { const lv = lastIndValRef.current[id]; if (lv && lv.length) inds.push({ label: meta.label, color: meta.color, vals: lv }); });
            const cmps = Object.entries(cmpValsRef.current || {}).map(([sym, v]) => ({ symbol: sym, val: v.last, pct: v.pct, color: (comparesRef.current.find((x) => x.symbol === sym) || {}).color }));
            setDataWin({ time: c.t, ohlc: { open: c.o, high: c.h, low: c.l, close: c.c }, change: c.c - prev, pct: prev ? ((c.c - prev) / prev) * 100 : null, vol: c.v, inds, cmps });
          } else setDataWin(null);
        }
        return;
      }
      crosshairActiveRef.current = true;
      const d = p.seriesData.get(priceSeriesRef.current);
      if (d) {
        // بستهٔ کندلِ قبل (برای تغییرِ دقیق) + حجمِ همان کندل — مثلِ TradingView
        let prevClose = null, vol = null;
        try { const cs = candlesRef.current; const idx = cs.findIndex((c) => c.t === p.time); if (idx >= 0) { vol = cs[idx].v; if (idx > 0) prevClose = cs[idx - 1].c; } } catch (e) {}
        setLegend(d.close != null ? { ...d, prevClose, vol } : { close: d.value, prevClose, vol });
      }
      // مقدارِ زندهٔ هر اندیکاتور زیرِ کراس‌هیر — هم برای Legend (#3) هم Data Window
      const inds = [];
      const lv = {};
      const collect = (store) => Object.entries(store).forEach(([id, arr]) => {
        const meta = indLabelRef.current[id]; if (!meta || !arr || !arr.length) return;
        const vals = arr.map((s) => { const sd = p.seriesData.get(s); return sd == null ? null : (sd.value != null ? sd.value : sd.close); }).filter((v) => v != null);
        if (vals.length) { inds.push({ label: meta.label, color: meta.color, vals }); lv[id] = vals.map((v) => fmtPrice(symbolRef.current, v)).join(' / '); }
      });
      collect(overlaySeries.current); collect(subChartsRef.current);
      setIndVals(lv);
      if (showDataWinRef.current) {
        // تغییر/درصد/حجم — از کندلِ زیرِ کراس‌هیر و کندلِ قبل
        let change = null, pct = null, vol = null;
        try {
          const cs = candlesRef.current;
          const idx = cs.findIndex((c) => c.t === p.time);
          if (idx >= 0) {
            vol = cs[idx].v;
            const prev = idx > 0 ? cs[idx - 1].c : cs[idx].o;
            if (prev != null && cs[idx].c != null) { change = cs[idx].c - prev; pct = prev ? (change / prev) * 100 : null; }
          }
        } catch (e) { /* noop */ }
        // مقادیرِ نمادهای مقایسه‌ای (Compare) زیرِ کراس‌هیر
        const cmps = [];
        Object.entries(compareSeries.current).forEach(([sym, s]) => {
          const sd = p.seriesData.get(s); const v = sd == null ? null : (sd.value != null ? sd.value : sd.close);
          if (v != null) cmps.push({ symbol: sym, val: v, pct: (cmpValsRef.current[sym] || {}).pct, color: (comparesRef.current.find((c) => c.symbol === sym) || {}).color });
        });
        setDataWin({ time: p.time, ohlc: d && d.close != null ? d : null, inds, change, pct, vol, cmps });
      }
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

  // Data Window: همگام‌سازیِ گیتِ ref + ماندگاری
  useEffect(() => {
    showDataWinRef.current = showDataWin; saveWS({ showDataWin });
    if (!showDataWin) { setDataWin(null); return; }
    // نمایشِ فوریِ آخرین کندل هنگام روشن‌شدن (بدونِ نیاز به حرکتِ نشانگر)
    const cs = candlesRef.current;
    if (cs.length) {
      const i = cs.length - 1, c = cs[i], prev = i > 0 ? cs[i - 1].c : c.o;
      const inds = [];
      Object.entries(indLabelRef.current).forEach(([id, meta]) => { const lv = lastIndValRef.current[id]; if (lv && lv.length) inds.push({ label: meta.label, color: meta.color, vals: lv }); });
      setDataWin({ time: c.t, ohlc: { open: c.o, high: c.h, low: c.l, close: c.c }, change: c.c - prev, pct: prev ? ((c.c - prev) / prev) * 100 : null, vol: c.v, inds, cmps: [] });
    }
  }, [showDataWin]);

  useEffect(() => { if (drawRef.current) drawRef.current.setTool(tool, drawColor); }, [tool, drawColor]);
  // حالتِ مؤثرِ مقیاسِ راست: در مقایسهٔ درصدی، Percentage(2) اجباری تا نمادِ اصلی + مقایسه‌ها هم‌مقیاس شوند
  useEffect(() => { try { const mode = (cmpPercent && compares.length) ? 2 : scaleMode; chartRef.current && chartRef.current.priceScale('right').applyOptions(priceScaleOptions({ mode, locked: scaleLocked, invert: scaleInvert })); saveWS({ scaleMode, scaleLocked, scaleInvert }); } catch (e) {} }, [scaleMode, scaleLocked, scaleInvert, cmpPercent, compares.length]);

  const buildPriceSeries = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    if (priceSeriesRef.current) { try { chart.removeSeries(priceSeriesRef.current); } catch (e) {} priceSeriesRef.current = null; }
    btMarkersRef.current = null; // سری بازساخته شد → مارکرهای بک‌تست باید دوباره روی سریِ جدید ساخته شوند
    patMarkersRef.current = null; // مارکرهای الگوی کندل هم روی سریِ جدید بازساخته می‌شوند
    divMarkersRef.current = null; // مارکرهای واگرایی روی سریِ جدید بازساخته می‌شوند
    divLinesRef.current.forEach((ls) => { try { chart.removeSeries(ls); } catch (e) {} }); divLinesRef.current = []; // خطوطِ واگرایی
    harmMarkersRef.current = null; // مارکرهای هارمونیک روی سریِ جدید بازساخته می‌شوند
    harmLinesRef.current.forEach((ls) => { try { chart.removeSeries(ls); } catch (e) {} }); harmLinesRef.current = []; // خطوطِ XABCD
    gapMarkersRef.current = null; // مارکرهای گپ روی سریِ جدید بازساخته می‌شوند
    econMarkersRef.current = null; // مارکرهای رویدادِ اقتصادی روی سریِ جدید بازساخته می‌شوند
    newsMarkersRef.current = null; // فلگ‌های خبر روی سریِ جدید بازساخته می‌شوند
    if (volSeriesRef.current) { try { chart.removeSeries(volSeriesRef.current); } catch (e) {} volSeriesRef.current = null; } // هیستوگرامِ حجم بازساخته می‌شود
    if (volMaRef.current) { try { chart.removeSeries(volMaRef.current); } catch (e) {} volMaRef.current = null; } // خطِ MAِ حجم
    alertLinesRef.current = [];   // خطوطِ آلارم روی سریِ قبلی از بین رفتند
    pdLinesRef.current = [];      // خطوطِ روزِ قبل روی سریِ جدید بازرسم می‌شوند
    hlLinesRef.current = [];      // خطوطِ سقف/کفِ بازهٔ دیده‌شده روی سریِ جدید بازرسم می‌شوند
    wkLinesRef.current = [];      // خطوطِ سطوحِ هفتهٔ قبل روی سریِ جدید بازرسم می‌شوند
    moLinesRef.current = [];      // خطوطِ سطوحِ ماهِ قبل روی سریِ جدید بازرسم می‌شوند
    if (auxSeriesRef.current && auxSeriesRef.current.length) { auxSeriesRef.current.forEach((s) => { try { chart.removeSeries(s); } catch (e) {} }); auxSeriesRef.current = []; }
    // ارتقای رندرِ Kagi (ضخامتِ yang/yin) و P&F (گلیفِ X/O) — پیش از بلوکِ NONSTANDARD رهگیری می‌شوند (فصل ۲ §2.13/§2.14)
    if (chartType === 'kagi') {
      const { segments } = kagiSpec(cs, { up: TH.up, down: TH.down });
      const arr = segments.map((seg) => { const ls = chart.addSeries(LineSeries, kagiSegmentOptions(seg)); ls.setData(seg.points); return ls; });
      priceSeriesRef.current = arr[0] || null; auxSeriesRef.current = arr.slice(1);
      drawRef.current && arr[0] && drawRef.current.setSeries(arr[0]);
      return;
    }
    if (chartType === 'pnf') {
      const { cells, markers } = pnfColumns(cs, { up: TH.up, down: TH.down });
      const host = chart.addSeries(LineSeries, pnfHostOptions()); host.setData(cells);
      try { createSeriesMarkers(host, markers); } catch (e) {}
      priceSeriesRef.current = host; auxSeriesRef.current = [];
      drawRef.current && drawRef.current.setSeries(host);
      return;
    }
    // انواعِ غیراستاندارد (Renko/Range/LineBreak/Kagi/P&F) — داده را بازنویسی می‌کنند
    if (NONSTANDARD.includes(chartType)) {
      const built = buildNonStandard(chartType, cs);
      let s2;
      if (built && built.kind === 'candle') { s2 = chart.addSeries(CandlestickSeries, { upColor: TH.up, downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down }); s2.setData((built.data || []).map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }))); }
      else { s2 = chart.addSeries(LineSeries, { color: TH.accent, lineWidth: 2 }); s2.setData((built && built.data || []).map((p) => ({ time: p.t, value: p.value }))); }
      priceSeriesRef.current = s2; drawRef.current && drawRef.current.setSeries(s2);
      return;
    }
    // انواعِ جدید (فصل ۲): کندلِ حجمی/سقف‑کف/ستونی/خطی‑نشانگر/ناحیهٔ HLC
    if (EXT_TYPES.includes(chartType)) {
      const opts = { up: TH.up, down: TH.down, accent: TH.accent };
      if (chartType === 'hlcarea') {
        const { spec } = buildExtType('hlcarea', cs, opts);
        const area = chart.addSeries(AreaSeries, spec.area.options); area.setData(spec.area.data);
        const auxArr = spec.aux.map((a) => { const ls = chart.addSeries(LineSeries, a.options); ls.setData(a.data); return ls; });
        priceSeriesRef.current = area; auxSeriesRef.current = auxArr;
        drawRef.current && drawRef.current.setSeries(area);
        return;
      }
      const b = buildExtType(chartType, cs, opts);
      let s2;
      if (b.kind === 'candle') s2 = chart.addSeries(CandlestickSeries, { upColor: TH.up, downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down, ...b.options });
      else if (b.kind === 'histogram') s2 = chart.addSeries(HistogramSeries, b.options);
      else s2 = chart.addSeries(LineSeries, b.options); // line-markers
      s2.setData(b.data);
      priceSeriesRef.current = s2; drawRef.current && drawRef.current.setSeries(s2);
      return;
    }
    const data = chartType === 'heikin' ? heikin(cs) : cs;
    let s;
    if (chartType === 'line') s = chart.addSeries(LineSeries,{ color: TH.accent, lineWidth: 2 });
    else if (chartType === 'step') s = chart.addSeries(LineSeries,{ color: TH.accent, lineWidth: 2, lineType: 1 });
    else if (chartType === 'area') s = chart.addSeries(AreaSeries,{ lineColor: TH.accent, topColor: 'rgba(41,98,255,.35)', bottomColor: 'rgba(41,98,255,0)' });
    else if (chartType === 'baseline') s = chart.addSeries(BaselineSeries,{ baseValue: { type: 'price', price: cs[0]?.c || 0 }, topLineColor: TH.up, bottomLineColor: TH.down });
    else if (chartType === 'bars') s = chart.addSeries(BarSeries,{ upColor: TH.up, downColor: TH.down });
    else if (chartType === 'hollow') s = chart.addSeries(CandlestickSeries,{ upColor: 'rgba(0,0,0,0)', downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down });
    else s = chart.addSeries(CandlestickSeries,{ upColor: TH.up, downColor: TH.down, borderUpColor: TH.up, borderDownColor: TH.down, wickUpColor: TH.up, wickDownColor: TH.down });
    s.setData((['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) ? valSeries(data) : ohlc(data));
    priceSeriesRef.current = s;
    drawRef.current && drawRef.current.setSeries(s);
    applyCandleColors(s); // اعمالِ رنگ‌های سفارشیِ کندل (تنظیماتِ چارت) روی سریِ تازه‌ساخته
    try { s.applyOptions({ priceLineVisible: showPriceLineRef.current }); } catch (e) { /* */ }
    // دقتِ اعشارِ قیمت (Precision) — سفارشی یا مشتق‌شده از نماد
    try { const pp = pricePrecRef.current; const prec = pp === 'auto' ? priceDigits(symbolRef.current) : Number(pp); s.applyOptions({ priceFormat: { type: 'price', precision: prec, minMove: Math.pow(10, -prec) } }); } catch (e) { /* */ }
  }, [chartType, TH]);

  // رنگ‌های سفارشیِ کندل (صعودی/نزولی) روی یک سریِ قیمت — گیت‌شده به انواعِ کندلی/میله‌ای
  const applyCandleColors = useCallback((s) => {
    if (!s) return;
    const up = ccRef.current.up, dn = ccRef.current.dn;
    const wu = ccRef.current.wick || up, wd = ccRef.current.wick || dn; // رنگِ سایه: سفارشی یا هم‌رنگِ بدنه
    try {
      if (['candles', 'heikin'].includes(chartType)) s.applyOptions({ upColor: up, downColor: dn, borderUpColor: up, borderDownColor: dn, wickUpColor: wu, wickDownColor: wd });
      else if (chartType === 'hollow') s.applyOptions({ downColor: dn, borderUpColor: up, borderDownColor: dn, wickUpColor: wu, wickDownColor: wd });
      else if (chartType === 'bars') s.applyOptions({ upColor: up, downColor: dn });
    } catch (e) { /* noop */ }
  }, [chartType]);

  // رنگِ مؤثرِ کندل = سفارشی یا پیش‌فرضِ تم → به‌روزرسانیِ ref + اعمالِ زندهٔ روی سریِ فعلی
  useEffect(() => {
    ccRef.current = { up: candleUp || TH.up, dn: candleDn || TH.down, wick: candleWick || '' };
    saveWS({ candleUp, candleDn, candleWick });
    applyCandleColors(priceSeriesRef.current);
    if (applyVolumeRef.current) applyVolumeRef.current(); // هیستوگرامِ حجم هم با رنگِ جدید بازرنگ شود
  }, [candleUp, candleDn, candleWick, TH, applyCandleColors]);

  // نمایش/مخفیِ خطوطِ شبکه (تنظیماتِ چارت)
  useEffect(() => {
    saveWS({ gridOn, gridColor, gridVert, gridHorz });
    const gc = gridColor || TH.grid;
    try { chartRef.current && chartRef.current.applyOptions({ grid: { vertLines: { visible: gridVert, color: gc }, horzLines: { visible: gridHorz, color: gc } } }); } catch (e) { /* noop */ }
  }, [gridOn, gridVert, gridHorz, gridColor, theme, TH.grid]);

  // خطِ آخرین قیمت (Last price line) — اعمالِ زنده روی سریِ فعلی
  useEffect(() => {
    showPriceLineRef.current = showPriceLine; saveWS({ showPriceLine });
    try { priceSeriesRef.current && priceSeriesRef.current.applyOptions({ priceLineVisible: showPriceLine }); } catch (e) { /* noop */ }
  }, [showPriceLine]);

  // رنگِ سفارشیِ پس‌زمینهٔ چارت (تنظیماتِ چارت) — پس از افکتِ تم اعمال می‌شود تا override بماند
  useEffect(() => {
    saveWS({ customBg });
    try { chartRef.current && chartRef.current.applyOptions({ layout: { background: { color: customBg || TH.bg } } }); } catch (e) { /* noop */ }
  }, [customBg, theme, TH]);

  const applyOverlays = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    Object.values(overlaySeries.current).flat().forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    overlaySeries.current = {};
    const c = { open: cs.map((x) => x.o), high: cs.map((x) => x.h), low: cs.map((x) => x.l), close: cs.map((x) => x.c), volume: cs.map((x) => x.v || 0), time: cs.map((x) => x.t) };
    let anyLeft = false; // برای روشن‌کردنِ محورِ چپ وقتی اندیکاتوری به آن تخصیص یافته
    overlays.forEach((ov) => {
      const def = REGISTRY[ov.key]; if (!def || def.pane !== 'main') return;
      if (indsHiddenRef.current || ov.visible === false) { overlaySeries.current[ov.id] = []; return; } // توگلِ سراسری + تبِ Style
      if (ov.scale === 'left') anyLeft = true;
      const psId = ov.scale === 'left' ? 'left' : 'right'; // محورِ قیمتِ دوگانه (تبِ Style)
      const r = def.calc(c, ov.inputs); const arr = [];
      const lc = ov.lineColors || {}; // رنگِ مجزای هر خط (اندیکاتورهای چندخطی)
      // override‌های استایل (تبِ Style): ضخامت، سبکِ خط (0 توپر/1 نقطه‌ای/2 خط‌چین)، شفافیت، محور
      const mk = (series, color, w = 2, dashed = false) => {
        const lw = ov.width || w;
        const lsv = ov.lineStyle != null ? ov.lineStyle : (dashed ? 2 : 0);
        const ls = chart.addSeries(LineSeries, { color: applyOpacity(color, ov.opacity), lineWidth: lw, lineStyle: lsv, priceScaleId: psId, priceLineVisible: false, lastValueVisible: indAxisLabelsRef.current });
        ls.setData(series.map((v, i) => (v == null ? null : { time: cs[i].t, value: v })).filter(Boolean)); arr.push(ls);
      };
      if (r.lines) r.lines.forEach((ln, i) => mk(ln.data, lc[i] || ln.color, 1, ln.dashed));
      else if (r.multi) { const base = ov.color || def.color; mk(r.upper, lc[0] || base, 1, true); mk(r.basis, lc[1] || base, 1); mk(r.lower, lc[2] || base, 1, true); }
      else mk(r.line, lc[0] || ov.color || def.color);
      overlaySeries.current[ov.id] = arr;
      indLabelRef.current[ov.id] = { label: def.label + indParamStr(ov.inputs), color: lc[0] || ov.color || def.color };
      // آخرین مقدار برای نمایش در Legend وقتی کراس‌هیر فعال نیست
      try { const ld = r.lines ? r.lines.map((ln) => ln.data) : (r.multi ? [r.upper, r.basis, r.lower] : [r.line]); lastIndValRef.current[ov.id] = ld.map((a) => a && a.length ? a[a.length - 1] : null).filter((v) => v != null && Number.isFinite(v)); } catch (e) { /* */ }
    });
    try { chart.applyOptions({ leftPriceScale: { visible: anyLeft, borderColor: TH.grid } }); } catch (e) {}
  }, [overlays, TH]);

  const applySubs = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    // حذفِ سری‌های ساب قبلی (pane نیتیوِ v5 — روی همان چارت)
    // پیش از بازساخت، ارتفاعِ فعلیِ پِین‌ها (شاملِ کشیده‌شدهٔ کاربر) را نگه‌دار تا ریست نشود
    try { chart.panes().forEach((p, i) => { if (i > 0) { const h = p.getHeight(); if (h > 0) subPaneHRef.current[i] = h; } }); } catch (e) { /* */ }
    Object.values(subChartsRef.current).flat().forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    subChartsRef.current = {};
    if (subWrapRef.current) subWrapRef.current.innerHTML = '';
    const c = { open: cs.map((x) => x.o), high: cs.map((x) => x.h), low: cs.map((x) => x.l), close: cs.map((x) => x.c), volume: cs.map((x) => x.v || 0), time: cs.map((x) => x.t) };
    const subList = indsHiddenRef.current ? [] : subs.filter((sub) => { const d = REGISTRY[sub.key]; return d && d.pane === 'sub' && sub.visible !== false; }); // توگلِ سراسری + تبِ Style
    subList.forEach((sub, idx) => {
      const def = REGISTRY[sub.key];
      const pane = idx + 1;                 // pane 0 = چارتِ اصلی
      const r = def.calc(c, sub.inputs);
      const arr = [];
      // honor‌کردنِ override‌های استایل (ضخامت/سبک/شفافیت) از تبِ Style
      const L = (opts, data) => {
        const lw = sub.width || opts.lineWidth || 1;
        const lsv = sub.lineStyle != null ? sub.lineStyle : (opts.lineStyle || 0);
        const s = chart.addSeries(LineSeries, { priceLineVisible: false, lastValueVisible: true, ...opts, color: applyOpacity(opts.color, sub.opacity), lineWidth: lw, lineStyle: lsv }, pane);
        s.setData(data.map((v, i) => (v == null ? null : { time: cs[i].t, value: v })).filter(Boolean)); arr.push(s); return s;
      };
      if (r.macd) {
        const h = chart.addSeries(HistogramSeries, { priceLineVisible: false }, pane); h.setData(r.hist.map((v, i) => (v == null ? null : { time: cs[i].t, value: v, color: v >= 0 ? 'rgba(38,166,154,.6)' : 'rgba(239,83,80,.6)' })).filter(Boolean)); arr.push(h);
        L({ color: '#3b82f6' }, r.line); L({ color: '#f59e0b' }, r.signal);
      } else {
        const l1 = L({ color: sub.color || def.color }, r.line);
        if (r.signal) L({ color: '#f59e0b' }, r.signal);
        { const gs = r.guides || []; const gmax = Math.max(...gs), gmin = Math.min(...gs); gs.forEach((g) => { const col = (gs.length >= 2 && g === gmax) ? 'rgba(239,83,80,.5)' : (gs.length >= 2 && g === gmin ? 'rgba(38,166,154,.5)' : TH.grid); l1.createPriceLine({ price: g, color: col, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: String(g) }); }); }
      }
      try { const panes = chart.panes(); if (panes && panes[pane]) panes[pane].setHeight(subPaneHRef.current[pane] || 108); } catch (e) {}
      subChartsRef.current[sub.id] = arr;
      indLabelRef.current[sub.id] = { label: def.label + indParamStr(sub.inputs), color: sub.color || def.color };
      try { const last = r.line && r.line.length ? r.line[r.line.length - 1] : null; lastIndValRef.current[sub.id] = (last != null && Number.isFinite(last)) ? [last] : []; } catch (e) { /* */ }
    });
  }, [subs, TH]);

  // ── Compare/Overlay: نمادهای مقایسه‌ای روی همان چارت (مثلِ TradingView) ──
  // هر نماد روی یک محورِ قیمتِ overlay مخفیِ مستقل رسم می‌شود تا مقیاسِ اصلی به‌هم نریزد.
  const applyCompares = useCallback(async () => {
    const chart = chartRef.current; if (!chart) return;
    // بازساختِ کاملِ سری‌های مقایسه (ساده و مقاوم به تغییرِ حالتِ درصدی/محور)
    Object.values(compareSeries.current).forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    compareSeries.current = {};
    const pct = !!cmpPercent; // حالتِ درصدی: همه روی محورِ راستِ مشترک (Percentage) نرمال می‌شوند
    const der = DERIVED_TF[tf]; const fetchTf = der ? der[0] : tf; const factor = der ? der[1] : 1;
    const vals = {};
    for (const cmp of compares) {
      try {
        const r = await api.chart(cmp.symbol, fetchTf, '', 800 * factor);
        let cs = (r.candles || []).map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }));
        if (factor > 1) cs = resampleCandles(cs, factor);
        if (!cs.length) continue;
        const psId = pct ? 'right' : ('cmp_' + cmp.symbol); // درصدی → محورِ راست؛ وگرنه محورِ overlay مخفیِ مستقل
        const s = chart.addSeries(LineSeries, { color: cmp.color, lineWidth: 2, priceScaleId: psId, priceLineVisible: false, lastValueVisible: true, title: cmp.symbol });
        if (!pct) { try { chart.priceScale(psId).applyOptions({ visible: false, autoScale: true, scaleMargins: { top: 0.08, bottom: 0.12 } }); } catch (e) {} }
        compareSeries.current[cmp.symbol] = s;
        s.setData(cs.map((c) => ({ time: c.t, value: c.c })));
        // آخرین قیمت + درصدِ تغییر نسبت به اولین کندلِ بارگذاری‌شده (برای نمایش در چیپ)
        const first = cs[0].c, last = cs[cs.length - 1].c;
        vals[cmp.symbol] = { last, pct: first ? ((last - first) / first) * 100 : null };
      } catch (e) { /* noop */ }
    }
    setCmpVals(vals);
  }, [compares, tf, cmpPercent]);
  useEffect(() => { applyCompares(); }, [applyCompares, theme]);
  useEffect(() => { saveWS({ compares }); comparesRef.current = compares; }, [compares]);
  useEffect(() => { cmpValsRef.current = cmpVals; }, [cmpVals]);
  useEffect(() => { saveWS({ cmpPercent }); }, [cmpPercent]);
  const addCompare = (sym) => {
    const s = (sym || '').toUpperCase(); if (!s) return;
    setCompares((cur) => (cur.some((c) => c.symbol === s) || s === symbol.toUpperCase())
      ? cur
      : [...cur, { symbol: s, color: CMP_PALETTE[cur.length % CMP_PALETTE.length] }]);
  };
  const removeCompare = (sym) => setCompares((cur) => cur.filter((c) => c.symbol !== sym));

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
      if (s) { const data = chartType === 'heikin' ? heikin(merged) : merged; s.setData((['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) ? valSeries(data) : ohlc(data)); }
      applyOverlays(merged); applySubs(merged);
      if (applyPatternsRef.current) applyPatternsRef.current(merged);
      if (applyDivRef.current) applyDivRef.current(merged);
      if (applyHarmRef.current) applyHarmRef.current(merged);
      if (applyGapsRef.current) applyGapsRef.current(merged);
      if (applyVolumeRef.current) applyVolumeRef.current(merged);
      if (drawPdLinesRef.current) drawPdLinesRef.current();
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
      // نمادِ ترکیبی/اسپرد: A/B, A*B, A+B, A-B (مثلِ TradingView) — هر دو پایه را می‌گیریم و ترکیب می‌کنیم
      const spm = symbol.match(/^([A-Za-z0-9.]+)\s*([/*+-])\s*([A-Za-z0-9.]+)$/);
      let cs;
      if (spm) {
        const op = spm[2];
        const [ra, rb] = await Promise.all([api.chart(spm[1].toUpperCase(), fetchTf, '', 800 * factor), api.chart(spm[3].toUpperCase(), fetchTf, '', 800 * factor)]);
        const bMap = new Map((rb.candles || []).map((c) => [c.t, c]));
        const cmb = (x, y) => op === '/' ? (y ? x / y : null) : op === '*' ? x * y : op === '+' ? x + y : x - y;
        cs = [];
        for (const a of (ra.candles || [])) {
          const b = bMap.get(a.t); if (!b) continue;
          const o = cmb(a.o, b.o), h = cmb(a.h, b.h), l = cmb(a.l, b.l), cc = cmb(a.c, b.c);
          if ([o, h, l, cc].some((v) => v == null || !isFinite(v))) continue;
          cs.push({ t: a.t, o, h: Math.max(o, h, l, cc), l: Math.min(o, h, l, cc), c: cc, v: a.v || 0 });
        }
        lazyRef.current = { loading: false, exhausted: true }; // اسپرد: بارگذاریِ تنبلِ تاریخ غیرفعال
      } else {
        const r = await api.chart(symbol, fetchTf, '', 800 * factor);
        cs = (r.candles || []).map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }));
      }
      if (factor > 1) cs = resampleCandles(cs, factor);
      candlesRef.current = cs;
      { const lb = cs[cs.length - 1]; if (lb) { lastBarRef.current = { open: lb.o, high: lb.h, low: lb.l, close: lb.c, prevClose: cs.length > 1 ? cs[cs.length - 2].c : null, vol: lb.v }; setLegend(lastBarRef.current); } }
      buildPriceSeries(cs); applyOverlays(cs); applySubs(cs);
      if (applyPatternsRef.current) applyPatternsRef.current(cs);
      if (applyDivRef.current) applyDivRef.current(cs);
      if (applyHarmRef.current) applyHarmRef.current(cs);
      if (applyGapsRef.current) applyGapsRef.current(cs);
      if (applyEconRef.current) applyEconRef.current();
      if (applyNewsRef.current) applyNewsRef.current();
      if (applyVolumeRef.current) applyVolumeRef.current(cs);
      if (drawPdLinesRef.current) drawPdLinesRef.current();
      if (drawWkRef.current) drawWkRef.current();
      if (drawMoRef.current) drawMoRef.current();
      if (drawHLRef.current) drawHLRef.current();
      if (drawAlertLinesRef.current) drawAlertLinesRef.current();
      if (drawRef.current) drawRef.current.setCandles(cs);
      chartRef.current && chartRef.current.timeScale().fitContent();
      if (showVPRef.current) applyVP(cs); // ref تا با تعویضِ نماد/تایم‌فریم (بدونِ حضور در deps) کهنه نشود
      // بازیابیِ سیگنالِ AIِ فعال برای این نماد/تایم‌فریم پس از رفرش یا تعویضِ نماد
      // (سیگنال در سرور ذخیره است؛ ساختِ دوبارهٔ سری، نقاشیِ قبلی را پاک می‌کند پس دوباره رسم می‌کنیم)
      try {
        const list = await api.bnAiActive();
        setAiList(list || []);
        const match = (list || []).find((x) => x.status === 'active' && x.symbol === symbol && x.tf === tf) || null;
        // باگ۳: سیگنالِ فعالِ سرور اولویت دارد؛ وگرنه سیگنالِ کش‌شدهٔ همین نماد/تایم‌فریم نگه‌داشته شود (با رفرش/بازگشت پاک نشود)
        const cachedSig = loadWS().aiSig;
        const restoreSig = match || (cachedSig && cachedSig.symbol === symbol && cachedSig.tf === tf ? cachedSig : null);
        setAiSig(restoreSig); drawAiLines(restoreSig);
        if (restoreSig) focusSetupView(); // زوم‌اوت تا کندل‌ها و جعبه‌های ستاپ دیده شوند
      } catch (e) { /* noop */ }
      // بازاجرای ستاپِ نمااسکریپت تا با تعویضِ نماد/تایم‌فریم یا رفرش، روی چارت بماند
      try { if (scriptAppliedRef.current && code && code.trim()) { await compile(); focusSetupView(); } } catch (e) { /* noop */ }
    } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, tf, buildPriceSeries, applyOverlays, applySubs, chartType]);
  useEffect(() => { load(); }, [load]);
  // عنوانِ تبِ مرورگر: نماد + قیمتِ زنده (مثلِ TradingView)
  useEffect(() => {
    const p = livePrice || (lastBarRef.current && lastBarRef.current.close);
    const lb = lastBarRef.current; const arrow = lb && lb.close != null && lb.open != null ? (lb.close >= lb.open ? '▲ ' : '▼ ') : '';
    document.title = p ? `${arrow}${symbol} ${fmtPrice(symbol, p)} · ${tf}` : `${symbol} · ${tf}`;
  }, [symbol, tf, livePrice]);
  useEffect(() => () => { try { document.title = origTitleRef.current; } catch (e) {} }, []);
  // واترمارکِ متنیِ نماد پشتِ چارت (مثلِ TradingView) — با پلاگینِ نیتیوِ lightweight-charts
  useEffect(() => {
    const chart = chartRef.current; if (!chart) return;
    saveWS({ showWatermark });
    try {
      const panes = chart.panes(); const pane = panes && panes[0]; if (!pane) return;
      if (!wmRef.current) wmRef.current = createTextWatermark(pane, { horzAlign: 'center', vertAlign: 'center', lines: [] });
      const faint = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.045)';
      wmRef.current.applyOptions({ lines: showWatermark ? [
        { text: symbol, color: faint, fontSize: 48, fontStyle: 'bold' },
        { text: tf, color: faint, fontSize: 18 },
      ] : [] });
    } catch (e) { /* noop */ }
  }, [symbol, tf, theme, showWatermark]);
  // نگه‌داشتنِ خودکارِ میزِکار (نماد/تایم‌فریم/نوعِ چارت/تم/اندیکاتورها) — رفرش/خروج پاکش نمی‌کند
  useEffect(() => { saveWS({ symbol, tf, chartType, theme, overlays, subs }); }, [symbol, tf, chartType, theme, overlays, subs]);
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);
  useEffect(() => { thRef.current = TH; }, [TH]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  // اندازه‌گیریِ سریع با Shift+درگ (مثلِ TradingView) — کادرِ موقت با Δقیمت/درصد/تعدادِ کندل
  useEffect(() => {
    const el = mainRef.current; if (!el) return undefined;
    const compute = (x0, y0, x1, y1) => {
      const chart = chartRef.current, s = priceSeriesRef.current; if (!chart || !s) return { dPrice: 0, pct: 0, bars: 0 };
      let p0, p1, l0, l1;
      try { p0 = s.coordinateToPrice(y0); p1 = s.coordinateToPrice(y1); } catch (e) {}
      try { const ts = chart.timeScale(); l0 = ts.coordinateToLogical(x0); l1 = ts.coordinateToLogical(x1); } catch (e) {}
      const bars = (l0 != null && l1 != null) ? Math.round(Math.abs(l1 - l0)) : 0;
      const dPrice = (p0 != null && p1 != null) ? (p1 - p0) : 0;
      const pct = p0 ? (dPrice / p0) * 100 : 0;
      // حجمِ تجمعیِ کندل‌های داخلِ بازه (مثلِ Measureِ TradingView)
      let vol = 0;
      try { const cs = candlesRef.current; if (cs && cs.length && l0 != null && l1 != null) { const a = Math.max(0, Math.round(Math.min(l0, l1))), b = Math.min(cs.length - 1, Math.round(Math.max(l0, l1))); for (let i = a; i <= b; i++) vol += (cs[i] && cs[i].v) || 0; } } catch (e) { /* */ }
      return { dPrice, pct, bars, vol, startP: p0, endP: p1 };
    };
    const onDown = (e) => {
      if (e.button !== 0 || !e.shiftKey || toolRef.current !== 'cursor' || !chartRef.current) return;
      const rect = el.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
      measureStart.current = { x, y };
      try { chartRef.current.applyOptions({ handleScroll: false, handleScale: false }); } catch (er) {}
      setMeasure({ x0: x, y0: y, x1: x, y1: y, ...compute(x, y, x, y) });
    };
    const onMove = (e) => {
      if (!measureStart.current) return;
      const rect = el.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const s = measureStart.current;
      setMeasure({ x0: s.x, y0: s.y, x1: x, y1: y, ...compute(s.x, s.y, x, y) });
    };
    const onUp = () => {
      if (!measureStart.current) return;
      measureStart.current = null;
      try { chartRef.current && chartRef.current.applyOptions({ handleScroll: true, handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true } }); } catch (er) {}
      setMeasure(null);
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { el.removeEventListener('mousedown', onDown); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);
  // تاریخچهٔ نماد: با هر تعویضِ نماد (به‌جز back/forward) در استک push می‌شود
  useEffect(() => {
    const h = symHistRef.current;
    if (symNavRef.current) { symNavRef.current = false; }
    else if (h.stack[h.idx] !== symbol) { h.stack = h.stack.slice(0, h.idx + 1); h.stack.push(symbol); h.idx = h.stack.length - 1; }
    setSymHist({ back: h.idx > 0, fwd: h.idx < h.stack.length - 1 });
  }, [symbol]);
  const symBack = useCallback(() => { const h = symHistRef.current; if (h.idx > 0) { symNavRef.current = true; h.idx -= 1; setSymbol(h.stack[h.idx]); } }, []);
  const symFwd = useCallback(() => { const h = symHistRef.current; if (h.idx < h.stack.length - 1) { symNavRef.current = true; h.idx += 1; setSymbol(h.stack[h.idx]); } }, []);
  useEffect(() => { watchRef.current = watch; }, [watch]);
  useEffect(() => { saveWS({ drawColor }); }, [drawColor]);
  useEffect(() => { saveWS({ showCountdown }); }, [showCountdown]);
  useEffect(() => { markerLabelsRef.current = markerLabels; saveWS({ markerLabels }); [applyPatternsRef, applyDivRef, applyHarmRef].forEach((r) => r.current && r.current()); }, [markerLabels]);
  useEffect(() => { saveWS({ rightTab }); }, [rightTab]);
  useEffect(() => { saveWS({ showRight }); }, [showRight]);
  useEffect(() => { saveWS({ panelWidth }); }, [panelWidth]);
  useEffect(() => { saveWS({ drawWidth }); try { drawRef.current && drawRef.current.setWidth(drawWidth); } catch (e) {} }, [drawWidth]);
  useEffect(() => { saveWS({ drawDashed }); try { drawRef.current && drawRef.current.setDashed(drawDashed); } catch (e) {} }, [drawDashed]);
  useEffect(() => { saveWS({ drawLineStyle }); try { drawRef.current && drawRef.current.setLineStyle(drawLineStyle); } catch (e) {} }, [drawLineStyle]);
  // نزدیک‌ترین رویدادِ اقتصادیِ پراثرِ آینده — برای چیپِ شمارشِ معکوس (فقط وقتی رویدادها روشن‌اند)
  const [atRealtime, setAtRealtime] = useState(true); // آیا آخرین کندل در دید است (برای دکمهٔ پرش به حال)
  const [measure, setMeasure] = useState(null); // اندازه‌گیریِ Shift+درگ {x0,y0,x1,y1,dPrice,pct,bars}
  const measureStart = useRef(null);
  const toolRef = useRef('cursor');
  const [nextEcon, setNextEcon] = useState(null);
  const [, setEconTick] = useState(0);
  useEffect(() => {
    if (!showEcon) { setNextEcon(null); return undefined; }
    let on = true;
    const load = () => api.bnCalendar().then((r) => {
      if (!on) return;
      const now = Date.now() / 1000;
      const up = (r && r.items ? r.items : [])
        .filter((e) => e && (e.impact === 'high' || Number(e.impact) >= 3) && new Date(e.date).getTime() / 1000 > now)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      setNextEcon(up[0] || null);
    }).catch(() => {});
    load(); const id = setInterval(load, 60000);
    return () => { on = false; clearInterval(id); };
  }, [showEcon]);
  useEffect(() => {
    if (!nextEcon) return undefined;
    const id = setInterval(() => setEconTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [nextEcon]);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);
  // چرخش بین نمادهای واچ‌لیست (میان‌بُرِ [ و ]) — مثلِ حرکتِ بالا/پایین در واچ‌لیستِ TradingView
  const cycleSymbol = useCallback((dir) => {
    const list = (watchRef.current && watchRef.current.length ? watchRef.current : symbolsRef.current) || [];
    if (!list.length) return;
    const i = list.indexOf(symbolRef.current);
    const ni = i < 0 ? 0 : (i + dir + list.length) % list.length;
    setSymbol(list[ni]);
  }, []);
  // #3 ماندگاریِ ترجیحاتِ Legend (جمع‌بودن/حالتِ نمایش)
  useEffect(() => { saveWS({ legCollapsed, legView }); }, [legCollapsed, legView]);
  // #4 در چیدمانِ فشرده (گوشی/تبلت/لنداسکیپِ کوتاه) grid اجباری ۱ (RAM/پینت) — بدونِ رگرسیونِ دسکتاپ
  useEffect(() => { if (compact && grid !== 1) setGrid(1); /* eslint-disable-next-line */ }, [compact]);
  // باگ۳: نگه‌داشتنِ سیگنالِ AI و سفارشِ ترید تا با رفرش/بازگشت پاک نشوند
  useEffect(() => { saveWS({ aiSig }); }, [aiSig]);
  useEffect(() => { saveWS({ order }); }, [order]);
  // نگه‌داشتنِ کدِ نمااسکریپت + وضعیتِ اعمال‌شدنِ آن (تا با رفرش/تعویضِ تایم‌فریم بماند)
  useEffect(() => { saveWS({ code }); }, [code]);
  useEffect(() => { scriptAppliedRef.current = scriptApplied; saveWS({ scriptApplied }); }, [scriptApplied]);

  // Volume Profile — هیستوگرامِ توزیعِ قیمت (با وزنِ حجم؛ چون حجمِ داده صفر است، توزیعِ قیمت)
  const applyVP = useCallback((cs) => {
    if (!drawRef.current) return;
    let data = cs || candlesRef.current; if (!data.length) { drawRef.current.setProfile(null); return; }
    // حالتِ Visible Range (VPVR): فقط کندل‌های داخلِ بازهٔ دیده‌شده حساب می‌شوند
    if (vpModeRef.current === 'visible' && chartRef.current) {
      try {
        const r = chartRef.current.timeScale().getVisibleRange();
        if (r && r.from != null && r.to != null) {
          const vis = data.filter((c) => c.t >= r.from && c.t <= r.to);
          if (vis.length) data = vis;
        }
      } catch (e) { /* noop */ }
    } else if (vpModeRef.current === 'fixed' && vpFixedRef.current) {
      // بازهٔ ثابت (Fixed Range) — با پن/زوم بازمحاسبه نمی‌شود
      const { from, to } = vpFixedRef.current;
      const fx = data.filter((c) => c.t >= from && c.t <= to);
      if (fx.length) data = fx;
    }
    let lo = Infinity, hi = -Infinity;
    data.forEach((c) => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
    const B = 48, step = (hi - lo) / B || 1, buckets = Array.from({ length: B }, (_, i) => ({ lo: lo + i * step, hi: lo + (i + 1) * step, vol: 0, volUp: 0, volDn: 0, poc: false }));
    data.forEach((c) => { const w = (c.v || 1); const mid = (c.h + c.l) / 2; const bi = Math.min(B - 1, Math.max(0, Math.floor((mid - lo) / step))); buckets[bi].vol += w; if (c.c >= c.o) buckets[bi].volUp += w; else buckets[bi].volDn += w; });
    let pocI = 0; buckets.forEach((b, i) => { if (b.vol > buckets[pocI].vol) pocI = i; }); buckets[pocI].poc = true;
    // ناحیهٔ ارزش (Value Area): گسترش از POC تا پوششِ ۷۰٪ حجم → علامتِ VAH/VAL
    const total = buckets.reduce((s, b) => s + b.vol, 0);
    let loI = pocI, hiI = pocI, acc = buckets[pocI].vol;
    while (acc < total * 0.7 && (loI > 0 || hiI < B - 1)) {
      const below = loI > 0 ? buckets[loI - 1].vol : -1;
      const above = hiI < B - 1 ? buckets[hiI + 1].vol : -1;
      if (above >= below) { hiI++; acc += buckets[hiI].vol; } else { loI--; acc += buckets[loI].vol; }
    }
    for (let i = loI; i <= hiI; i++) buckets[i].va = true;
    drawRef.current.setProfile(buckets);
  }, []);

  // تشخیصِ خودکارِ الگوهای کندل‌استیک → مارکر روی چارت (مثلِ اندیکاتورِ Candlestick Patterns)
  const applyPatterns = useCallback((cs) => {
    const s = priceSeriesRef.current; const data = cs || candlesRef.current;
    if (!s) return;
    if (!showPatternsRef.current) { try { patMarkersRef.current && patMarkersRef.current.setMarkers([]); } catch (e) {} setDetCounts((c) => (c.pat ? { ...c, pat: 0 } : c)); return; }
    let pats = [];
    try { pats = detectCandlePatterns(data); } catch (e) { pats = []; }
    setDetCounts((c) => (c.pat === pats.length ? c : { ...c, pat: pats.length }));
    const mk = pats.map((p) => ({
      time: p.t,
      position: p.dir === 'bull' ? 'belowBar' : p.dir === 'bear' ? 'aboveBar' : 'aboveBar',
      color: p.dir === 'bull' ? TH.up : p.dir === 'bear' ? TH.down : '#9ca3af',
      shape: p.dir === 'bull' ? 'arrowUp' : p.dir === 'bear' ? 'arrowDown' : 'circle',
      text: markerLabelsRef.current ? p.label : '',
    }));
    mk.sort((a, b) => a.time - b.time);
    try { if (!patMarkersRef.current) patMarkersRef.current = createSeriesMarkers(s, []); patMarkersRef.current.setMarkers(mk); } catch (e) { /* noop */ }
  }, [TH]);
  const applyPatternsRef = useRef(null);
  const showPatternsRef = useRef(!!loadWS().showPatterns);
  useEffect(() => { applyPatternsRef.current = applyPatterns; }, [applyPatterns]);
  useEffect(() => { showPatternsRef.current = showPatterns; saveWS({ showPatterns }); applyPatterns(); }, [showPatterns, applyPatterns]);

  // تشخیصِ خودکارِ واگراییِ RSI → مارکر روی چارت (دایره + برچسب)
  const applyDiv = useCallback((cs) => {
    const s = priceSeriesRef.current; const chart = chartRef.current; const data = cs || candlesRef.current;
    if (!s || !chart) return;
    divLinesRef.current.forEach((ls) => { try { chart.removeSeries(ls); } catch (e) {} }); divLinesRef.current = [];
    if (!showDivRef.current) { try { divMarkersRef.current && divMarkersRef.current.setMarkers([]); } catch (e) {} setDetCounts((c) => (c.div ? { ...c, div: 0 } : c)); return; }
    let divs = [];
    try { divs = detectDivergences(data); } catch (e) { divs = []; }
    setDetCounts((c) => (c.div === divs.length ? c : { ...c, div: divs.length }));
    // خطِ اتصالِ دو نقطهٔ چرخشِ واگرا (۳ الگوی آخر)
    divs.slice(-3).forEach((p) => {
      if (!p.points || p.points.length < 2 || p.points[0].t >= p.points[1].t) return;
      try {
        const ls = chart.addSeries(LineSeries, { color: applyOpacity(p.dir === 'bull' ? TH.up : TH.down, 0.55), lineWidth: 1, lineStyle: 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        divLinesRef.current.push(ls);
        ls.setData(p.points.map((pt) => ({ time: pt.t, value: pt.price })));
      } catch (e) { /* noop */ }
    });
    const mk = divs.map((p) => ({
      time: p.t,
      position: p.dir === 'bull' ? 'belowBar' : 'aboveBar',
      color: p.dir === 'bull' ? TH.up : p.dir === 'bear' ? TH.down : '#9ca3af',
      shape: 'circle',
      text: markerLabelsRef.current ? 'د: ' + p.label : '',
    }));
    mk.sort((a, b) => a.time - b.time);
    try { if (!divMarkersRef.current) divMarkersRef.current = createSeriesMarkers(s, []); divMarkersRef.current.setMarkers(mk); } catch (e) { /* noop */ }
  }, [TH]);
  const applyDivRef = useRef(null);
  const showDivRef = useRef(!!loadWS().showDiv);
  useEffect(() => { applyDivRef.current = applyDiv; }, [applyDiv]);
  useEffect(() => { showDivRef.current = showDiv; saveWS({ showDiv }); applyDiv(); }, [showDiv, applyDiv]);

  // الگوهای هارمونیک (Gartley/Bat/Butterfly/Crab) → مارکر روی نقطهٔ D
  const applyHarm = useCallback((cs) => {
    const s = priceSeriesRef.current; const chart = chartRef.current; const data = cs || candlesRef.current;
    if (!s || !chart) return;
    // پاک‌کردنِ خطوطِ XABCD قبلی
    harmLinesRef.current.forEach((ls) => { try { chart.removeSeries(ls); } catch (e) {} }); harmLinesRef.current = [];
    if (!showHarmRef.current) { try { harmMarkersRef.current && harmMarkersRef.current.setMarkers([]); } catch (e) {} setDetCounts((c) => (c.harm ? { ...c, harm: 0 } : c)); return; }
    let hs = [];
    try { hs = detectHarmonics(data); } catch (e) { hs = []; }
    setDetCounts((c) => (c.harm === hs.length ? c : { ...c, harm: hs.length }));
    // رسمِ خطوطِ XABCD برای حداکثر ۲ الگوی آخر (جلوگیری از شلوغی)
    hs.slice(-2).forEach((p) => {
      if (!p.points || p.points.length !== 5) return;
      // dedup زمان‌های تکراری (کندلی که هم سقف هم کف است) تا setData خطا ندهد؛ ترتیب صعودی است
      const pts = []; let lastT = -Infinity;
      for (const pt of p.points) { if (pt.t > lastT) { pts.push({ time: pt.t, value: pt.price }); lastT = pt.t; } }
      if (pts.length < 2) return;
      try {
        const ls = chart.addSeries(LineSeries, { color: applyOpacity(p.dir === 'bull' ? TH.up : TH.down, 0.6), lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        harmLinesRef.current.push(ls); // قبل از setData تا در صورتِ خطا هم در cleanup حذف شود
        ls.setData(pts);
      } catch (e) { /* noop */ }
    });
    const mk = hs.map((p) => ({
      time: p.t,
      position: p.dir === 'bull' ? 'belowBar' : 'aboveBar',
      color: p.dir === 'bull' ? TH.up : TH.down,
      shape: p.dir === 'bull' ? 'arrowUp' : 'arrowDown',
      text: markerLabelsRef.current ? p.label : '',
    }));
    // برچسبِ حروفِ X/A/B/C روی نقاطِ ۲ الگوی رسم‌شده (D خودش مارکرِ نام دارد)
    hs.slice(-2).forEach((p) => { if (!p.points) return; ['X', 'A', 'B', 'C'].forEach((lbl, idx) => { const pt = p.points[idx]; if (pt) mk.push({ time: pt.t, position: 'aboveBar', color: TH.text, shape: 'circle', text: markerLabelsRef.current ? lbl : '' }); }); });
    // dedup زمان‌های تکراری (اولویت با مارکرِ نامِ D که اول push شده) + مرتب‌سازی
    const byT = new Map(); mk.forEach((m) => { if (!byT.has(m.time)) byT.set(m.time, m); });
    const arr = Array.from(byT.values()).sort((a, b) => a.time - b.time);
    try { if (!harmMarkersRef.current) harmMarkersRef.current = createSeriesMarkers(s, []); harmMarkersRef.current.setMarkers(arr); } catch (e) { /* noop */ }
  }, [TH]);
  useEffect(() => { applyHarmRef.current = applyHarm; }, [applyHarm]);
  useEffect(() => { showHarmRef.current = showHarm; saveWS({ showHarm }); applyHarm(); }, [showHarm, applyHarm]);

  // نشانگرِ گپِ قیمت → مارکرِ کوچک روی کندلِ گپ‌دار
  const applyGaps = useCallback((cs) => {
    const s = priceSeriesRef.current; const data = cs || candlesRef.current;
    if (!s) return;
    if (!showGapsRef.current) { try { gapMarkersRef.current && gapMarkersRef.current.setMarkers([]); } catch (e) {} setDetCounts((c) => (c.gap ? { ...c, gap: 0 } : c)); return; }
    let gaps = [];
    try { gaps = detectGaps(data); } catch (e) { gaps = []; }
    setDetCounts((c) => (c.gap === gaps.length ? c : { ...c, gap: gaps.length }));
    const mk = gaps.map((g) => ({
      time: g.t,
      position: g.dir === 'up' ? 'belowBar' : 'aboveBar',
      color: g.dir === 'up' ? TH.up : TH.down,
      shape: 'square',
      text: markerLabelsRef.current ? `گپ ${g.pct >= 0 ? '+' : ''}${g.pct.toFixed(1)}%` : '',
    }));
    mk.sort((a, b) => a.time - b.time);
    try { if (!gapMarkersRef.current) gapMarkersRef.current = createSeriesMarkers(s, []); gapMarkersRef.current.setMarkers(mk); } catch (e) { /* noop */ }
  }, [TH]);
  useEffect(() => { applyGapsRef.current = applyGaps; }, [applyGaps]);
  useEffect(() => { showGapsRef.current = showGaps; saveWS({ showGaps }); applyGaps(); }, [showGaps, applyGaps]);

  // رویدادهای اقتصادیِ پراثر روی چارت (مثلِ Economic events تریدینگ‌ویو) — از فیدِ تقویمِ موجود
  const applyEcon = useCallback(async () => {
    const s = priceSeriesRef.current; if (!s) return;
    if (!showEconRef.current) { try { econMarkersRef.current && econMarkersRef.current.setMarkers([]); } catch (e) {} return; }
    const cs = candlesRef.current; if (!cs.length) return;
    let items = [];
    try { const r = await api.bnCalendar(); items = (r && r.items ? r.items : []).filter((e) => e && (e.impact === 'high' || Number(e.impact) >= 3)); } catch (e) { items = []; }
    if (!showEconRef.current) return; // ممکن است حین await خاموش شده باشد
    const first = cs[0].t, last = cs[cs.length - 1].t;
    const byT = new Map();
    items.forEach((e) => {
      const t = Math.floor(new Date(e.date).getTime() / 1000);
      if (!Number.isFinite(t) || t < first || t > last) return;
      let idx = 0, best = Infinity;
      for (let i = 0; i < cs.length; i++) { const d = Math.abs(cs[i].t - t); if (d < best) { best = d; idx = i; } }
      const bt = cs[idx].t;
      if (!byT.has(bt)) byT.set(bt, { time: bt, position: 'aboveBar', color: '#f59e0b', shape: 'circle', text: `📅${e.country ? ' ' + e.country : ''}` });
    });
    const arr = Array.from(byT.values()).sort((a, b) => a.time - b.time);
    try { if (!econMarkersRef.current) econMarkersRef.current = createSeriesMarkers(s, []); econMarkersRef.current.setMarkers(arr); } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { applyEconRef.current = applyEcon; }, [applyEcon]);
  useEffect(() => { showEconRef.current = showEcon; saveWS({ showEcon }); applyEcon(); }, [showEcon, applyEcon]);

  // فلگ‌های خبر روی چارت (مثلِ News on chart تریدینگ‌ویو) — از فیدِ اخبارِ موجود
  const applyNews = useCallback(async () => {
    const s = priceSeriesRef.current; if (!s) return;
    if (!showNewsRef.current) { try { newsMarkersRef.current && newsMarkersRef.current.setMarkers([]); } catch (e) {} return; }
    const cs = candlesRef.current; if (!cs.length) return;
    let items = [];
    try { const r = await api.bnNews(); items = (r && r.items ? r.items : []); } catch (e) { items = []; }
    if (!showNewsRef.current) return;
    const first = cs[0].t, last = cs[cs.length - 1].t;
    const byT = new Map();
    items.forEach((n) => {
      const t = Number(n.ts);
      if (!Number.isFinite(t) || t < first || t > last) return;
      let idx = 0, best = Infinity;
      for (let i = 0; i < cs.length; i++) { const d = Math.abs(cs[i].t - t); if (d < best) { best = d; idx = i; } }
      const bt = cs[idx].t;
      if (!byT.has(bt)) byT.set(bt, { time: bt, position: 'belowBar', color: '#38bdf8', shape: 'square', text: '📰' });
    });
    const arr = Array.from(byT.values()).sort((a, b) => a.time - b.time);
    try { if (!newsMarkersRef.current) newsMarkersRef.current = createSeriesMarkers(s, []); newsMarkersRef.current.setMarkers(arr); } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { applyNewsRef.current = applyNews; }, [applyNews]);
  useEffect(() => { showNewsRef.current = showNews; saveWS({ showNews }); applyNews(); }, [showNews, applyNews]);

  // هیستوگرامِ حجم روی پِینِ اصلی (پایینِ چارت، سبز/قرمز) — مثلِ پیش‌فرضِ تریدینگ‌ویو
  const applyVolume = useCallback((cs) => {
    const chart = chartRef.current; const data = cs || candlesRef.current;
    if (!chart) return;
    if (!showVolumeRef.current) {
      if (volSeriesRef.current) { try { chart.removeSeries(volSeriesRef.current); } catch (e) {} volSeriesRef.current = null; }
      if (volMaRef.current) { try { chart.removeSeries(volMaRef.current); } catch (e) {} volMaRef.current = null; }
      return;
    }
    if (!data || !data.length) return;
    if (!volSeriesRef.current) {
      try {
        volSeriesRef.current = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceLineVisible: false, lastValueVisible: false, priceFormat: { type: 'volume' } });
        chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
      } catch (e) { return; }
    }
    try {
      const vUp = applyOpacity(ccRef.current.up, 0.45), vDn = applyOpacity(ccRef.current.dn, 0.45); // هماهنگ با رنگِ سفارشیِ کندل
      volSeriesRef.current.setData(data.map((c) => ({ time: c.t, value: c.v || 0, color: (c.c >= c.o) ? vUp : vDn })));
      // خطِ میانگینِ متحرکِ حجم (MA20) — فقط اگر حجمِ واقعی وجود دارد
      const vols = data.map((c) => c.v || 0); const totalV = vols.reduce((a, b) => a + b, 0);
      if (totalV > 0) {
        const P = 20, ma = [];
        for (let i = 0; i < vols.length; i++) { if (i < P - 1) { ma.push(null); continue; } let sm = 0; for (let j = i - P + 1; j <= i; j++) sm += vols[j]; ma.push(sm / P); }
        if (!volMaRef.current) volMaRef.current = chart.addSeries(LineSeries, { priceScaleId: 'vol', color: '#f59e0b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        volMaRef.current.setData(data.map((c, i) => (ma[i] == null ? null : { time: c.t, value: ma[i] })).filter(Boolean));
      } else if (volMaRef.current) { try { chart.removeSeries(volMaRef.current); } catch (e) {} volMaRef.current = null; }
    } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { applyVolumeRef.current = applyVolume; }, [applyVolume]);
  useEffect(() => { showVolumeRef.current = showVolume; saveWS({ showVolume }); applyVolume(); }, [showVolume, applyVolume]);

  // خطوطِ قیمتیِ آلارم روی چارت (مثلِ تریدینگ‌ویو — خطِ نقطه‌چینِ کهربایی با زنگوله)
  const OP_SIGN = { above: '↑', below: '↓', cross_up: '⤯↑', cross_down: '⤯↓', cross: '⤯', pct_up: '%↑', pct_down: '%↓' };
  const drawAlertLines = useCallback(() => {
    const s = priceSeriesRef.current; if (!s) return;
    alertLinesRef.current.forEach((l) => { try { s.removePriceLine(l); } catch (e) {} });
    alertLinesRef.current = [];
    (savedAlertsRef.current || []).forEach((a) => {
      const cond = a.condition || a.cond || {};
      if ((cond.type || 'price') !== 'price') return;
      const sym = a.symbol || symbolRef.current;
      if (sym !== symbolRef.current) return;
      const price = Number(cond.value);
      if (!Number.isFinite(price)) return;
      try {
        alertLinesRef.current.push(s.createPriceLine({ price, color: '#f59e0b', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '🔔 ' + (OP_SIGN[cond.op] || '') }));
      } catch (e) { /* noop */ }
    });
  }, []);
  useEffect(() => { drawAlertLinesRef.current = drawAlertLines; }, [drawAlertLines]);
  useEffect(() => { savedAlertsRef.current = savedAlerts; drawAlertLines(); }, [savedAlerts, symbol, drawAlertLines]);

  // بوقِ کوتاهِ آلارم (WebAudio — بدونِ فایلِ صوتی)
  const beep = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = audioCtxRef.current || (audioCtxRef.current = new AC());
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.0001;
      o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      o.start(now); o.stop(now + 0.26);
    } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { alertSoundRef.current = alertSound; saveWS({ alertSound }); }, [alertSound]);

  // هشدارِ درون‌مرورگری: عبورِ قیمتِ زنده از سطحِ آلارمِ نمادِ فعلی → توست + Notification (مثلِ TradingView)
  useEffect(() => {
    const price = livePrice; if (price == null) return;
    const prev = alertPrevPriceRef.current; alertPrevPriceRef.current = price;
    if (prev == null) return;
    (savedAlertsRef.current || []).forEach((a) => {
      const cond = a.condition || a.cond || {};
      if ((cond.type || 'price') !== 'price') return;
      if ((a.symbol || symbol) !== symbol) return;
      const v = Number(cond.value); if (!Number.isFinite(v)) return;
      const crossedUp = prev < v && price >= v;
      const crossedDn = prev > v && price <= v;
      const hit = (cond.op === 'above' && crossedUp) || (cond.op === 'below' && crossedDn) || (cond.op === 'cross' && (crossedUp || crossedDn));
      if (!hit) return;
      const recurring = cond.trigger === 'recurring';
      if (!recurring && alertFiredRef.current.has(a.id)) return;
      if (!recurring) alertFiredRef.current.add(a.id);
      const msg = `${symbol} به ${fmtPrice(symbol, v)} رسید (قیمت: ${fmtPrice(symbol, price)})`;
      setAlertToast({ id: (a.id || 0) + '-' + Math.round(price * 1e6), msg });
      if (alertSoundRef.current) beep();
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification('Pro-Chart · آلارم', { body: msg }); } catch (e) { /* */ }
    });
  }, [livePrice, symbol]);
  useEffect(() => { if (!alertToast) return undefined; const t = setTimeout(() => setAlertToast(null), 6000); return () => clearTimeout(t); }, [alertToast]);

  // خطوطِ سقف/کف/بستهٔ روزِ قبل (PDH/PDL/PDC) — فقط در تایم‌فریم‌های درون‌روز (مثلِ تریدینگ‌ویو)
  const drawPdLines = useCallback(() => {
    const s = priceSeriesRef.current; if (!s) return;
    pdLinesRef.current.forEach((l) => { try { s.removePriceLine(l); } catch (e) {} });
    pdLinesRef.current = [];
    if (!showPDRef.current) return;
    if (!['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H4'].includes(tf)) return; // فقط درون‌روز
    const cs = candlesRef.current; if (cs.length < 2) return;
    const day = (t) => new Date(t * 1000).toISOString().slice(0, 10);
    const curDay = day(cs[cs.length - 1].t);
    let prevDay = null;
    for (let i = cs.length - 1; i >= 0; i--) { const d = day(cs[i].t); if (d !== curDay) { prevDay = d; break; } }
    if (!prevDay) return;
    let hi = -Infinity, lo = Infinity, close = null, dayOpen = null, curHi = -Infinity, curLo = Infinity;
    for (const c of cs) {
      if (day(c.t) === prevDay) { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); close = c.c; }
      else if (day(c.t) === curDay) { if (dayOpen == null) dayOpen = c.o; curHi = Math.max(curHi, c.h); curLo = Math.min(curLo, c.l); }
    }
    if (!Number.isFinite(hi)) return;
    const mk = (price, color, title, style = 2) => { if (price == null) return; try { pdLinesRef.current.push(s.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title })); } catch (e) {} };
    mk(hi, '#3b82f6', 'PDH'); mk(lo, '#3b82f6', 'PDL'); mk(close, '#9ca3af', 'PDC');
    mk(dayOpen, '#f59e0b', 'DO', 0); // بازشدنِ روزِ جاری (Day Open) — خطِ توپرِ کهربایی
    if (Number.isFinite(curHi)) mk(curHi, '#10b981', 'HOD', 0); // سقفِ روزِ جاری
    if (Number.isFinite(curLo)) mk(curLo, '#f43f5e', 'LOD', 0); // کفِ روزِ جاری
  }, [tf]);
  useEffect(() => { drawPdLinesRef.current = drawPdLines; }, [drawPdLines]);
  useEffect(() => { showPDRef.current = showPD; saveWS({ showPD }); drawPdLines(); }, [showPD, tf, drawPdLines]);

  // خطوطِ سقف/کفِ بازهٔ دیده‌شده (HH/LL) — با پن/زوم بازمحاسبه می‌شوند
  const drawHL = useCallback(() => {
    const s = priceSeriesRef.current; const chart = chartRef.current; if (!s || !chart) return;
    hlLinesRef.current.forEach((l) => { try { s.removePriceLine(l); } catch (e) {} });
    hlLinesRef.current = [];
    if (!showHLRef.current) return;
    const cs = candlesRef.current; if (!cs.length) return;
    let vis = cs;
    try { const r = chart.timeScale().getVisibleRange(); if (r && r.from != null) { const f = cs.filter((c) => c.t >= r.from && c.t <= r.to); if (f.length) vis = f; } } catch (e) { /* */ }
    let hi = -Infinity, lo = Infinity;
    vis.forEach((c) => { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; });
    if (!Number.isFinite(hi)) return;
    const mk = (price, title, color) => { try { hlLinesRef.current.push(s.createPriceLine({ price, color, lineWidth: 1, lineStyle: 3, axisLabelVisible: true, title })); } catch (e) {} };
    mk(hi, 'HH', TH.up); mk(lo, 'LL', TH.down);
  }, [TH]);
  useEffect(() => { drawHLRef.current = drawHL; }, [drawHL]);
  useEffect(() => { showHLRef.current = showHL; saveWS({ showHL }); drawHL(); }, [showHL, drawHL]);

  // سطوحِ هفتهٔ قبل (PWH/PWL/PWC) + بازشدنِ هفتهٔ جاری (WO) — گروه‌بندیِ هفته‌های دوشنبه‌محورِ UTC
  const drawWkLines = useCallback(() => {
    const s = priceSeriesRef.current; if (!s) return;
    wkLinesRef.current.forEach((l) => { try { s.removePriceLine(l); } catch (e) {} });
    wkLinesRef.current = [];
    if (!showWkRef.current) return;
    if (['W1', 'MN'].includes(tf)) return; // در هفتگی/ماهانه بی‌معناست
    const cs = candlesRef.current; if (cs.length < 2) return;
    const wk = (t) => Math.floor((t - 345600) / 604800); // اندیسِ هفتهٔ دوشنبه‌محور (۱۹۷۰-۰۱-۰۵ دوشنبه بود)
    const curWk = wk(cs[cs.length - 1].t);
    let prevWk = null;
    for (let i = cs.length - 1; i >= 0; i--) { const w = wk(cs[i].t); if (w !== curWk) { prevWk = w; break; } }
    if (prevWk == null) return;
    let hi = -Infinity, lo = Infinity, close = null, wkOpen = null, curHi = -Infinity, curLo = Infinity;
    for (const c of cs) { const w = wk(c.t); if (w === prevWk) { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); close = c.c; } else if (w === curWk) { if (wkOpen == null) wkOpen = c.o; curHi = Math.max(curHi, c.h); curLo = Math.min(curLo, c.l); } }
    if (!Number.isFinite(hi)) return;
    const mk = (price, color, title, style = 2) => { if (price == null) return; try { wkLinesRef.current.push(s.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title })); } catch (e) {} };
    mk(hi, '#a855f7', 'PWH'); mk(lo, '#a855f7', 'PWL'); mk(close, '#c084fc', 'PWC'); mk(wkOpen, '#e879f9', 'WO', 0);
    if (Number.isFinite(curHi)) { mk(curHi, '#d946ef', 'HOW', 0); mk(curLo, '#d946ef', 'LOW', 0); }
  }, [tf]);
  useEffect(() => { drawWkRef.current = drawWkLines; }, [drawWkLines]);
  useEffect(() => { showWkRef.current = showWk; saveWS({ showWk }); drawWkLines(); }, [showWk, tf, drawWkLines]);

  // سطوحِ ماهِ قبل (PMH/PML/PMC) + بازشدنِ ماهِ جاری (MO) — گروه‌بندیِ ماهِ تقویمیِ UTC
  const drawMoLines = useCallback(() => {
    const s = priceSeriesRef.current; if (!s) return;
    moLinesRef.current.forEach((l) => { try { s.removePriceLine(l); } catch (e) {} });
    moLinesRef.current = [];
    if (!showMoRef.current) return;
    if (tf === 'MN') return; // در ماهانه بی‌معناست
    const cs = candlesRef.current; if (cs.length < 2) return;
    const mo = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
    const curMo = mo(cs[cs.length - 1].t);
    let prevMo = null;
    for (let i = cs.length - 1; i >= 0; i--) { const m = mo(cs[i].t); if (m !== curMo) { prevMo = m; break; } }
    if (prevMo == null) return;
    let hi = -Infinity, lo = Infinity, close = null, moOpen = null, curHi = -Infinity, curLo = Infinity;
    for (const c of cs) { const m = mo(c.t); if (m === prevMo) { hi = Math.max(hi, c.h); lo = Math.min(lo, c.l); close = c.c; } else if (m === curMo) { if (moOpen == null) moOpen = c.o; curHi = Math.max(curHi, c.h); curLo = Math.min(curLo, c.l); } }
    if (!Number.isFinite(hi)) return;
    const mk = (price, color, title, style = 2) => { if (price == null) return; try { moLinesRef.current.push(s.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title })); } catch (e) {} };
    mk(hi, '#14b8a6', 'PMH'); mk(lo, '#14b8a6', 'PML'); mk(close, '#5eead4', 'PMC'); mk(moOpen, '#2dd4bf', 'MO', 0);
    if (Number.isFinite(curHi)) { mk(curHi, '#2dd4bf', 'HOM', 0); mk(curLo, '#2dd4bf', 'LOM', 0); }
  }, [tf]);
  useEffect(() => { drawMoRef.current = drawMoLines; }, [drawMoLines]);
  useEffect(() => { showMoRef.current = showMo; saveWS({ showMo }); drawMoLines(); }, [showMo, tf, drawMoLines]);

  // خطوطِ جداکنندهٔ روز — فقط درون‌روز؛ با تغییرِ توگل/تایم‌فریم بازنقاشی می‌شود
  useEffect(() => {
    daySepRef.current = showDaySep; // فعال در همهٔ تایم‌فریم‌ها با واحدِ تطبیقی
    daySepUnitRef.current = ['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H4'].includes(tf) ? 'day' : (tf === 'D1' ? 'month' : 'year');
    saveWS({ showDaySep });
    const chart = chartRef.current, cv = overlayRef.current;
    if (chart && cv && drawRef.current) {
      drawRef.current.render();
      const ctx = cv.getContext('2d');
      if (ctx && sessionsRef.current) paintSessions(ctx, chart, sessionsRef.current, cv.height);
      if (ctx && daySepRef.current) paintDaySeparators(ctx, chart, candlesRef.current, cv.height, TH.border, daySepUnitRef.current);
    }
  }, [showDaySep, tf, TH]);

  useEffect(() => { applyVPRef.current = applyVP; }, [applyVP]);
  useEffect(() => { showVPRef.current = showVP; saveWS({ showVP }); if (drawRef.current) { showVP ? applyVP() : drawRef.current.setProfile(null); } }, [showVP, applyVP]);
  // تعویضِ حالتِ VP (کل/دیده‌شده) → بازمحاسبه + ماندگاری
  useEffect(() => { vpModeRef.current = vpMode; saveWS({ vpMode }); if (showVP && drawRef.current) applyVP(); }, [vpMode, showVP, applyVP]);
  // قفلِ پروفایلِ حجم روی بازهٔ فعلیِ دید (Fixed Range VP)
  const lockVpRange = useCallback(() => {
    try {
      const r = chartRef.current.timeScale().getVisibleRange();
      if (r && r.from != null && r.to != null) { vpFixedRef.current = { from: r.from, to: r.to }; saveWS({ vpFixed: vpFixedRef.current }); setShowVP(true); setVpMode('fixed'); }
    } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { magnetRef.current = magnet; magnetModeRef.current = magnetMode; if (drawRef.current) drawRef.current.setMagnet(magnet ? magnetMode : 'off'); saveWS({ magnet, magnetMode }); }, [magnet, magnetMode]);
  useEffect(() => { if (drawRef.current) drawRef.current.setHiddenAll(drawingsHidden); saveWS({ drawingsHidden }); }, [drawingsHidden]);
  useEffect(() => { if (drawRef.current) drawRef.current.setLockedAll(drawingsLocked); saveWS({ drawingsLocked }); }, [drawingsLocked]);
  useEffect(() => { if (syncBusRef.current) syncBusRef.current.enabled = gridSync; saveWS({ gridSync }); }, [gridSync]);
  useEffect(() => { indsHiddenRef.current = indsHidden; saveWS({ indsHidden }); const cs = candlesRef.current; if (cs && cs.length) { try { applyOverlays(cs); applySubs(cs); } catch (e) {} } }, [indsHidden, applyOverlays, applySubs]);
  useEffect(() => { indAxisLabelsRef.current = indAxisLabels; saveWS({ indAxisLabels }); const cs = candlesRef.current; if (cs && cs.length) { try { applyOverlays(cs); } catch (e) {} } }, [indAxisLabels, applyOverlays]);
  useEffect(() => { pricePrecRef.current = pricePrec; saveWS({ pricePrec }); const prec = pricePrec === 'auto' ? priceDigits(symbol) : Number(pricePrec); try { const s = priceSeriesRef.current; if (s) s.applyOptions({ priceFormat: { type: 'price', precision: prec, minMove: Math.pow(10, -prec) } }); } catch (e) { /* */ } try { drawRef.current && drawRef.current.setPriceDigits(prec); } catch (e) { /* */ } }, [pricePrec, symbol]);
  // «تایپِ بازهٔ زمانی» (مثلِ TradingView): فشارِ یک رقمِ خام روی چارت، پاپ‌آورِ ورودیِ بازه را باز می‌کند
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); setTfQuick((q) => (q == null ? e.key : q + e.key)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { saveWS({ sessionSel }); }, [sessionSel]);
  // کراس‌هیر (فصل ۳): حالتِ Cross/Dot/Arrow/Hidden + یکپارچه‌سازیِ Magnet با CrosshairMode
  useEffect(() => {
    const ch = chartRef.current; if (!ch) return;
    const { crosshair, _ui } = crosshairOptions(crosshairId, magnet, TH, crosshairColor || undefined, crosshairWidth, crosshairStyle, crosshairLabels);
    ch.applyOptions({ crosshair });
    crosshairGlyphRef.current = _ui.glyph;
    if (mainRef.current) mainRef.current.style.cursor = _ui.cursor;
    crosshairColorRef.current = crosshairColor || '';
    saveWS({ crosshairId, magnet, crosshairColor, crosshairWidth, crosshairStyle, crosshairLabels });
    // eslint-disable-next-line
  }, [crosshairId, magnet, theme, crosshairColor, crosshairWidth, crosshairStyle, crosshairLabels]);
  // باندهای سشن (فصل ۳): محاسبهٔ بازه‌ها در منطقهٔ زمانیِ نمایش و رسمِ آن‌ها روی overlay
  useEffect(() => {
    const ch = chartRef.current;
    if (!ch || !sessionsOn) { sessionsRef.current = null; ch && drawRef.current && drawRef.current.render(); saveWS({ sessionsOn }); return; }
    try {
      const cs = candlesRef.current;
      const from = cs.length ? cs[0].t : Math.floor(Date.now() / 1000) - 86400;
      const to = (cs.length ? cs[cs.length - 1].t : Math.floor(Date.now() / 1000)) + 86400;
      sessionsRef.current = sessionBands(from, to, tz, { overlap: true, sessions: sessionSel });
      drawRef.current && drawRef.current.render();
      // A: باندها را فوری رسم کن (وگرنه تا وقتی کاربر چارت را pan/zoom نکند نمایان نمی‌شوند).
      const ctx = overlayRef.current && overlayRef.current.getContext('2d');
      if (ctx && sessionsRef.current) paintSessions(ctx, ch, sessionsRef.current, overlayRef.current.height);
    } catch (e) { /* */ }
    saveWS({ sessionsOn, sessionSel });
  }, [sessionsOn, tz, tf, symbol, sessionSel]);
  // منطقهٔ زمانی (فصل ۳): قالب‌بندیِ محورِ زمان و برچسبِ کراس‌هیر
  useEffect(() => { const ch = chartRef.current; if (!ch) return; try { ch.applyOptions(timeZoneOptions(tz)); } catch (e) {} saveWS({ tz }); }, [tz]);
  // ساعتِ زندهٔ منطقهٔ زمانی (مثلِ ساعتِ گوشهٔ چارتِ TradingView)
  useEffect(() => {
    let fmt;
    try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    catch (e) { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    const tick = () => { try { setClock(fmt.format(new Date())); } catch (e) { setClock(''); } };
    tick(); const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tz]);
  useEffect(() => { if (drawRef.current) drawRef.current.setStayInMode(stayDraw); }, [stayDraw]);
  // شمارشِ معکوسِ بسته‌شدنِ کندلِ جاری
  useEffect(() => {
    if (NONSTANDARD.includes(chartType)) { setCountdown(''); return undefined; }
    const tick = () => { const rem = secondsToClose(tf, undefined, tz); setCountdown(formatCountdown(rem)); setCountdownColor(countdownTint(rem)); const total = tfSec(tf) || 1; setCountdownFrac(rem >= 0 ? Math.max(0, Math.min(1, 1 - rem / total)) : 0); };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [tf, chartType, tz]);
  // اتصالِ خطوطِ سفارش به چارت + همگام‌سازیِ درگ
  useEffect(() => { if (drawRef.current) { drawRef.current.setOrder(order); drawRef.current.onOrder = (o) => setOrder(o); } }, [order]);
  const curPrice = () => livePrice || (candlesRef.current.length ? candlesRef.current[candlesRef.current.length - 1].c : 0);
  // #۱۰ ترید از یک سطحِ مشخص (یا قیمتِ جاری) — تیکتِ کاملاً قابلِ‌ویرایش باز می‌کند: پنلِ ترید را
  // نمایان می‌کند، entry/SL/TP را روی چارت قابلِ‌کشیدن می‌گذارد و قبل از ثبت همه‌چیز قابلِ‌تنظیم است.
  const startTrade = (side, entryAt) => { const e = (entryAt != null && Number.isFinite(+entryAt)) ? +entryAt : curPrice(); if (!e) return; const d = e * 0.005; setOrder({ side, entry: e, sl: side === 'buy' ? e - d : e + d, tp: side === 'buy' ? e + 2 * d : e - 2 * d }); setRightTab('trade'); setShowRight(true); };

  // #۹ رسمِ جعبهٔ «موقعیتِ لانگ/شورت» رو‌به‌جلو از نقطهٔ کلیک‌شده (نه خطوطِ تمام‌عرض). یک ترسیمِ قابلِ‌ویرایش/پاک است.
  const placeLongShort = (side, price, atX) => {
    const ch = chartRef.current, dl = drawRef.current;
    if (!ch || !dl || price == null) return;
    try {
      const ts = ch.timeScale();
      let t0 = ts.coordinateToTime(atX);
      const vr = ts.getVisibleRange();
      const span = (vr && typeof vr.to === 'number' && typeof vr.from === 'number') ? (vr.to - vr.from) : 86400;
      if (typeof t0 !== 'number') t0 = (vr && typeof vr.to === 'number' ? vr.to : Math.floor(Date.now() / 1000));
      const t1 = t0 + Math.round(span * 0.28); // پروجکشنِ رو‌به‌جلو ~۲۸٪ محدودهٔ دید
      const risk = price * 0.005;
      const stop = side === 'buy' ? price - risk : price + risk; // p1.p = حدِ ضرر؛ هدفِ 2R خودکار محاسبه می‌شود
      dl.addDrawing({ type: 'longshort', p0: { t: t0, p: price }, p1: { t: t1, p: stop }, color: side === 'buy' ? (TH.up || '#22c55e') : (TH.down || '#ef4444'), width: 1.5 });
      treeRefresh();
    } catch (e) { /* noop */ }
  };
  // ثبتِ سفارش از روی چارت → endpointِ معاملهٔ مستقیم (gated). تا فعال‌شدنِ اجرای واقعی،
  // سرور سفارش را اعتبارسنجی و «پیش‌نمایش» برمی‌گرداند (هیچ معاملهٔ واقعی‌ای انجام نمی‌شود).
  const submitOrder = async () => {
    if (!order) return;
    try {
      const r = await api.manualOrder({ side: order.side, symbol, entry: order.entry, sl: order.sl, tp: order.tp });
      if (r?.placed) { window.alert('سفارش ثبت و ارسال شد ✓'); setOrder(null); }
      else if (r?.preview) window.alert(`✓ سفارش معتبر است — R/R ${r.rr}\n${r.reason || 'اجرای واقعی به‌زودی فعال می‌شود.'}`);
      else window.alert('سفارش پردازش شد.');
    } catch (e) {
      window.alert(e?.message || e?.data?.detail || 'خطا در ثبتِ سفارش');
    }
  };

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

  // خروجی/ورودیِ کاملِ چیدمانِ میزِکار به JSON (Export/Import layout) — فقط localStorage، بدونِ سرویسِ بیرونی
  const exportLayout = useCallback(() => {
    try { downloadBlob(new Blob([JSON.stringify({ __prochart: 1, v: 1, ws: loadWS() }, null, 2)], { type: 'application/json' }), 'prochart-layout.json'); } catch (e) { /* noop */ }
  }, []);
  const importLayoutFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        const ws = obj && obj.ws ? obj.ws : obj;
        if (!ws || typeof ws !== 'object') { window.alert('فایلِ چیدمان نامعتبر است'); return; }
        localStorage.setItem(WS_KEY, JSON.stringify(ws));
        window.location.reload(); // بازخوانی تا همهٔ stateها از چیدمانِ جدید مقداردهی شوند
      } catch (e) { window.alert('خطا در خواندنِ فایلِ چیدمان'); }
    };
    reader.readAsText(file);
  }, []);

  // لِی‌اوتهای نام‌دار (Saved Layouts) — ذخیره/بارگذاری/حذفِ چیدمانِ کاملِ فعلی زیرِ یک نام، فقط localStorage
  const [namedLayouts, setNamedLayouts] = useState(() => loadLayouts());
  const [layoutName, setLayoutName] = useState('');
  const saveNamedLayout = useCallback(() => {
    const nm = layoutName.trim();
    if (!nm) return;
    const next = { ...loadLayouts(), [nm]: loadWS() };
    saveLayouts(next); setNamedLayouts(next); setLayoutName('');
  }, [layoutName]);
  const loadNamedLayout = useCallback((nm) => {
    const all = loadLayouts(); const ws = all[nm];
    if (!ws || typeof ws !== 'object') return;
    localStorage.setItem(WS_KEY, JSON.stringify(ws));
    window.location.reload(); // بازخوانی تا همهٔ stateها از چیدمانِ نام‌دار مقداردهی شوند
  }, []);
  const deleteNamedLayout = useCallback((nm) => {
    const all = loadLayouts(); if (!(nm in all)) return;
    delete all[nm]; saveLayouts(all); setNamedLayouts({ ...all });
  }, []);

  // بازنشانیِ چارت (مثلِ Reset chart تریدینگ‌ویو) — پاکِ اندیکاتورها/ترسیم‌ها/مقایسه‌ها (با تأییدِ کاربر)
  const resetChart = useCallback(() => {
    if (!window.confirm('همهٔ اندیکاتورها، ترسیم‌ها و نمادهای مقایسه پاک شوند؟')) return;
    setOverlays([]); setSubs([]); setCompares([]);
    try { drawRef.current && drawRef.current.clearAll(); } catch (e) { /* */ }
    setShowVP(false); setShowPD(false); setShowWk(false); setShowMo(false); setShowHL(false);
    setShowPatterns(false); setShowDiv(false); setShowHarm(false); setShowGaps(false); setShowDaySep(false); setShowEcon(false); setShowNews(false);
    setCfgOpen(false);
  }, []);

  // خروجیِ داده‌ی چارت به CSV (مثلِ Export chart data تریدینگ‌ویو) — فقط داده‌ی محلی، بدونِ سرویسِ بیرونی
  const exportCsv = useCallback(() => {
    const cs = candlesRef.current; if (!cs || !cs.length) return;
    const rows = ['time,open,high,low,close,volume'];
    cs.forEach((c) => { rows.push(`${new Date(c.t * 1000).toISOString()},${c.o},${c.h},${c.l},${c.c},${c.v || 0}`); });
    try { downloadBlob(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }), `${symbol}_${tf}.csv`); } catch (e) { /* noop */ }
  }, [symbol, tf]);

  // «برو به تاریخ» (مثلِ Go to date تریدینگ‌ویو) — نزدیک‌ترین کندل به تاریخِ واردشده را وسطِ دید می‌آورد
  const doGoto = useCallback((val) => {
    const cs = candlesRef.current; const chart = chartRef.current;
    if (!cs.length || !chart || !val) return;
    const target = Math.floor(new Date(val + 'T00:00:00').getTime() / 1000);
    if (!Number.isFinite(target)) return;
    // نزدیک‌ترین ایندکس به زمانِ هدف
    let idx = 0, best = Infinity;
    for (let i = 0; i < cs.length; i++) { const d = Math.abs(cs[i].t - target); if (d < best) { best = d; idx = i; } }
    try { chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, idx - 40), to: idx + 40 }); } catch (e) { /* noop */ }
    setGotoOpen(false);
  }, []);

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
  // مسیرِ هستهٔ موجود (slice + series.update برحسبِ نوعِ چارت) دست‌نخورده می‌ماند؛
  // ReplayController فقط مکان‌نما/سرعت/seek را به‌صورتِ headless می‌رانَد و این دو callback را صدا می‌زند:
  //   onStep  → یک گامِ رو به جلو ⇒ همان series.update روانِ قبلی
  //   onSlice → بازساختِ کاملِ برش (seek/step-back/scrub) ⇒ buildPriceSeries+overlays+subs
  // یک گامِ رو به جلو روی برشِ موجود (نسخهٔ ضد-رگرسیون از کدِ قبلی).
  const replayApplyStep = useCallback((c, slice) => {
    candlesRef.current = slice;
    if (EXT_HISTOGRAM_TYPES.includes(chartType)) { // ستونی: رنگِ live لازم دارد — فقط در بارگذاریِ کاملِ بازپخش به‌روز می‌شود
      try { priceSeriesRef.current.update(columnsLivePoint(candlesRef.current, { up: TH.up, down: TH.down })); } catch (e) {}
      return;
    }
    try { if (['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) priceSeriesRef.current.update({ time: c.t, value: c.c }); else priceSeriesRef.current.update({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }); } catch (e) {}
    { const cs = candlesRef.current; lastBarRef.current = { open: c.o, high: c.h, low: c.l, close: c.c, prevClose: cs.length > 1 ? cs[cs.length - 2].c : null, vol: c.v }; } // به‌روزرسانیِ Legendِ دائمی با تیکِ زنده
    // سطوحِ روزِ جاری (HOD/LOD) و سقف/کفِ بازه با تیکِ زنده به‌روز شوند (کندلِ جاری ممکن است سقف/کفِ تازه بسازد)
    if (showPDRef.current && drawPdLinesRef.current) drawPdLinesRef.current();
    if (showHLRef.current && drawHLRef.current) drawHLRef.current();
    if (showVolumeRef.current && applyVolumeRef.current) applyVolumeRef.current(); // حجمِ کندلِ جاری با تیک رشد می‌کند
    if (!crosshairActiveRef.current) {
      setLegend(lastBarRef.current); // لِجند وقتی hover نیستی زنده بماند
      if (showDataWinRef.current) { // Data Window هم زنده بماند
        const cs2 = candlesRef.current;
        if (cs2.length) {
          const i = cs2.length - 1, lc = cs2[i], prev = i > 0 ? cs2[i - 1].c : lc.o;
          const inds = []; Object.entries(indLabelRef.current).forEach(([id, meta]) => { const lv = lastIndValRef.current[id]; if (lv && lv.length) inds.push({ label: meta.label, color: meta.color, vals: lv }); });
          const cmps = Object.entries(cmpValsRef.current || {}).map(([sym, v]) => ({ symbol: sym, val: v.last, pct: v.pct, color: (comparesRef.current.find((x) => x.symbol === sym) || {}).color }));
          setDataWin({ time: lc.t, ohlc: { open: lc.o, high: lc.h, low: lc.l, close: lc.c }, change: lc.c - prev, pct: prev ? ((lc.c - prev) / prev) * 100 : null, vol: lc.v, inds, cmps });
        }
      }
    }
  }, [chartType, TH]);
  // بازساختِ کاملِ سری از یک برش (برای seek/step-back/scrub — همان مسیرِ enterReplay).
  const replayApplySlice = useCallback((slice) => {
    candlesRef.current = slice;
    buildPriceSeries(slice); applyOverlays(slice); applySubs(slice);
  }, [buildPriceSeries, applyOverlays, applySubs]);

  const enterReplay = (startTime = null) => {
    const full = candlesRef.current.slice();
    if (!ReplayController.canEnter(full)) return; // حداقل ۳۰ کندل
    // کنترلر را با همان callbackها بساز؛ onChange ⇒ sync با React + mirror در replayRef برای applyMid/حلقهٔ ۶۰fps
    const ctrl = new ReplayController({
      speed: SPEED_LADDER.includes(replay.speed) ? replay.speed : 1,
      onStep: (c, slice) => replayApplyStep(c, slice),
      onSlice: (slice) => replayApplySlice(slice),
      onChange: (st) => {
        replayRef.current.idx = st.idx; replayRef.current.full = ctrl.full;
        setReplay((s) => ({ ...s, on: st.on, playing: st.playing, speed: st.speed, idx: st.idx, length: st.length }));
      },
    });
    replayCtrlRef.current = ctrl;
    replayRef.current = { full, idx: 0 };
    ctrl.enter(full, (Number.isFinite(startTime) ? { startTime } : { startPct: 0.55 })); // onSlice ⇒ سری ساخته می‌شود، onChange ⇒ state ست می‌شود
    chartRef.current && chartRef.current.timeScale().fitContent();
    setReplay((s) => ({ ...s, on: true, playing: false }));
  };
  const exitReplay = () => {
    if (replayCtrlRef.current) { replayCtrlRef.current.destroy(); replayCtrlRef.current = null; }
    setReplay({ on: false, playing: false, speed: replay.speed, idx: 0, length: 0 });
    load();
  };
  const replayStep = useCallback(() => {
    const ctrl = replayCtrlRef.current; if (ctrl) ctrl.step();
  }, []);
  const replayStepBack = useCallback(() => {
    const ctrl = replayCtrlRef.current; if (ctrl) ctrl.stepBack();
  }, []);
  const replaySeek = useCallback((index) => {
    const ctrl = replayCtrlRef.current; if (ctrl) ctrl.seek({ index });
  }, []);
  const replaySetSpeed = useCallback((sp) => {
    const ctrl = replayCtrlRef.current; if (ctrl) ctrl.setSpeed(sp); else setReplay((s) => ({ ...s, speed: sp }));
  }, []);

  const replayToggle = useCallback(() => { const ctrl = replayCtrlRef.current; if (ctrl) ctrl.toggle(); }, []);
  useEffect(() => { replayPlayingRef.current = replay.on; }, [replay.on]);
  // زمان‌بندیِ پخش کاملاً درونِ ReplayController است (یک setInterval با speedToDelay، نردبانِ ۹-سرعته)؛
  // اینجا setInterval جداگانه‌ای نداریم تا گام دوبار اجرا نشود. React فقط از onChange همگام می‌شود.
  // پاک‌سازیِ امنِ کنترلر هنگامِ unmount
  useEffect(() => () => { if (replayCtrlRef.current) { replayCtrlRef.current.destroy(); replayCtrlRef.current = null; } }, []);

  // ── Real-time: آپدیتِ کندلِ در حالِ شکل‌گیری + خطِ قیمتِ زنده ──
  // به‌روزرسانیِ واقعیِ چارت با یک مقدارِ قیمت (کندلِ جاری + خطِ LIVE) — هر فریمِ انیمیشن صدا زده می‌شود
  const applyMid = useCallback((mid) => {
    if (replayRef.current && replayPlayingRef.current) return;
    if (NONSTANDARD.includes(chartType) || EXT_HISTOGRAM_TYPES.includes(chartType)) return; // ستونی: رنگِ live لازم دارد ⇒ فقط در reloadِ کامل به‌روز می‌شود (مثلِ Renko)
    const s = priceSeriesRef.current; if (!s) return;
    const cs = candlesRef.current; if (!cs.length) return;
    const last = cs[cs.length - 1];
    if (!Number.isFinite(mid) || (last.c && Math.abs(mid - last.c) / last.c > 0.2)) return;
    const isVal = ['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType);
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
    let res = await (barMode ? runScriptBar : runScript)(code, cs, inputs || scInputs);
    // حالتِ بار‌به‌بار همهٔ ta.*ها را ندارد؛ اگر تابعی پشتیبانی نشد، خودکار به موتورِ سری‌محورِ کامل برگرد.
    if (barMode && res && res.ok === false && /is not a function|is not defined/i.test(res.error || '')) {
      res = await runScript(code, cs, inputs || scInputs);
    }
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
    setScPlots([]); setAlertsOut([]); setBt(null); clearBacktestMarkers();
    try { if (drawRef.current) drawRef.current.setScriptPaint(null); } catch (e) { /* */ }
    setScTables([]);
    drawAiLines(null); setAiSig(null);
    setScriptApplied(false); // ستاپِ نمااسکریپت دیگر روی چارت اعمال نشود (با رفرش هم برنگردد)
    if (order) setOrder(null);
  };
  const onInputChange = async (key, val) => { const ni = { ...scInputs, [key]: val }; setScInputs(ni); await compile(ni); };

  // مارکرهای ورود/خروجِ بک‌تست روی چارت (مثلِ Strategy Tester تریدینگ‌ویو)
  const drawBacktestMarkers = useCallback((trades) => {
    const s = priceSeriesRef.current; if (!s) return;
    const mk = [];
    (trades || []).forEach((t) => {
      if (t.entryT != null) mk.push({ time: t.entryT, position: 'belowBar', color: '#2962FF', shape: 'arrowUp', text: 'ورود' });
      if (t.exitT != null) mk.push({ time: t.exitT, position: 'aboveBar', color: (t.r || 0) >= 0 ? TH.up : TH.down, shape: 'arrowDown', text: ((t.r || 0) >= 0 ? '+' : '') + fmtPrice(symbolRef.current, t.r) });
    });
    mk.sort((a, b) => a.time - b.time);
    try { if (!btMarkersRef.current) btMarkersRef.current = createSeriesMarkers(s, []); btMarkersRef.current.setMarkers(mk); } catch (e) { /* noop */ }
  }, [TH]);
  const clearBacktestMarkers = useCallback(() => { try { btMarkersRef.current && btMarkersRef.current.setMarkers([]); } catch (e) { /* noop */ } }, []);

  // Strategy Tester — از خروجیِ strategy.entry موتور؛ یا fallback از alertcondition
  const onBacktest = async () => {
    const res = await compile({ ...scInputs, __comm: Number(btCost.comm) || 0, __slip: Number(btCost.slip) || 0 }); if (!res) return;
    if (res.strategy) { const s = res.strategy; setBt({ ...s, full: true, pfTxt: (typeof s.pf === 'number' ? s.pf.toFixed(2) : s.pf), ddTxt: (s.dd || 0).toFixed(5) }); setBtTab('overview'); if (s.trades && Array.isArray(s.tradeList)) drawBacktestMarkers(s.tradeList); return; }
    if (!res.alerts || res.alerts.length < 2) { setBt({ err: 'برای بک‌تست از strategy.entry یا دو alertcondition (خرید/فروش) استفاده کن.' }); return; }
    const cs = candlesRef.current;
    const buys = new Set(res.alerts[0].bars), sells = new Set(res.alerts[1].bars);
    let pos = null, entryT = null, eq = 0, peak = 0, dd = 0, wins = 0, gp = 0, gl = 0, n = 0;
    const tradeList = [];
    const equity = [{ e: 0 }]; // منحنیِ سرمایه (اکوییتی) — نقطهٔ شروع + پس از هر معامله
    cs.forEach((c) => {
      if (!pos && buys.has(c.t)) { pos = c.c; entryT = c.t; }
      else if (pos && sells.has(c.t)) { const r = c.c - pos; eq += r; n++; if (r >= 0) { wins++; gp += r; } else gl += -r; tradeList.push({ entryT, entryP: pos, exitT: c.t, exitP: c.c, r }); equity.push({ e: eq }); pos = null; entryT = null; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
    });
    setBt({ trades: n, net: eq, win: n ? Math.round((wins / n) * 100) : 0, wins, pf: gl ? (gp / gl).toFixed(2) : '∞', dd: dd.toFixed(5), equity, list: tradeList.map((t) => ({ dir: 1, t: t.exitT, r: t.r })) });
    drawBacktestMarkers(tradeList);
  };
  const loadExample = (ex) => { setCode(ex.code); setScriptName(ex.name); setScInputs({}); setScInputDecls([]); };

  const onSaveScript = async () => { try { const r = await api.bnScriptSave({ name: scriptName, source: code }); setScripts((s) => [{ id: r.id, name: scriptName }, ...s.filter((x) => x.id !== r.id)]); } catch (e) {} };
  const loadScript = async (id) => { try { const r = await api.bnScriptGet(id); setCode(r.source || ''); setScriptName(r.name || 'اسکریپت'); } catch (e) {} };

  const addInd = (key) => { const def = REGISTRY[key]; const item = { id: uid(), key, inputs: { ...def.inputs }, color: def.color }; if (def.pane === 'main') setOverlays((o) => [...o, item]); else setSubs((s) => [...s, item]); setIndMenu(false); };
  const rmInd = (scope, id) => { if (scope === 'main') setOverlays((o) => o.filter((x) => x.id !== id)); else setSubs((s) => s.filter((x) => x.id !== id)); };
  const updInd = (scope, id, patch) => { const fn = (arr) => arr.map((x) => (x.id === id ? { ...x, ...patch, inputs: { ...x.inputs, ...(patch.inputs || {}) } } : x)); if (scope === 'main') setOverlays(fn); else setSubs(fn); };
  // جابه‌جاییِ ترتیبِ اندیکاتور در همان scope (Object Tree) — dir: -1 بالا / +1 پایین
  const moveInd = (scope, id, dir) => { const fn = (arr) => { const i = arr.findIndex((x) => x.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= arr.length) return arr; const n = arr.slice(); const t = n[i]; n[i] = n[j]; n[j] = t; return n; }; if (scope === 'main') setOverlays(fn); else setSubs(fn); };

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
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { /* اجازهٔ نوتیفیکیشنِ مرورگر برای هشدارِ درون‌مرورگری */ }
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

  // #5 سازندهٔ ورودیِ ScreenshotMenu — chart/overlay + واترمارک/caption با توکن‌های تم
  const getCapture = useCallback(() => ({
    chart: chartRef.current,
    overlay: overlayRef.current,
    bg: TH.bg,
    name: `${symbol}_${tf}`,
    watermark: { enabled: true, src: bnLogo, position: 'bottom-left', opacity: 0.5, size: 40, invert: theme === 'light' },
    caption: { symbol, tf, price: livePrice != null ? fmtPrice(symbol, livePrice) : '', bg: TH.bg, text: TH.textStrong, sub: TH.text, subText: 'bazaarnama' },
  }), [symbol, tf, theme, livePrice, TH]);

  // #5 آپلودِ snapshot برای «کپیِ لینک» — اگر بک‌اند endpoint داشته باشد استفاده می‌شود؛ وگرنه null
  const uploadSnapshot = useCallback(async (blob) => {
    if (!api.bnSnapshotUpload) return null;
    try { return await api.bnSnapshotUpload(blob); } catch (e) { return null; }
  }, []);

  // #5 میان‌بُرِ S: کپیِ سریعِ عکس به کلیپ‌بورد (با واترمارک)
  const quickScreenshot = useCallback(async () => {
    const cap = getCapture(); if (!cap.chart) return;
    const cv = await captureChart({ ...cap, scale: 1, format: 'png' });
    if (!cv) return;
    const blob = await canvasToBlob(cv, 'png');
    const ok = await copyBlobToClipboard(blob);
    if (!ok && blob) downloadBlob(blob, `${cap.name}.png`);
  }, [getCapture]);

  // ── لایهٔ میان‌بُرهای صفحه‌کلید (فصل ۱۰) — فقط هندلرهایی که از قبل وجود دارند نگاشت می‌شوند ──
  useEffect(() => {
    const detach = attachHotkeys({
      // ابزارها
      cursor: () => setTool('cursor'),
      trend: () => setTool('trend'), hline: () => setTool('hline'), vline: () => setTool('vline'),
      ray: () => setTool('ray'), rect: () => setTool('rect'), fib: () => setTool('fib'),
      channel: () => setTool('channel'), text: () => setTool('text'),
      longshort: () => setTool('longshort'), ruler: () => setTool('ruler'),
      magnet: () => { if (!magnetRef.current) { setMagnet(true); setMagnetMode('weak'); } else if (magnetModeRef.current === 'weak') { setMagnetMode('strong'); } else { setMagnet(false); } }, stayDraw: () => setStayDraw((v) => !v),
      // ویرایش
      undo: () => { drawRef.current && drawRef.current.undo(); treeRefresh(); },
      redo: () => { drawRef.current && drawRef.current.redo(); treeRefresh(); },
      deleteSel: () => { if (selDraw >= 0 && drawRef.current) { drawRef.current.removeAt(selDraw); treeRefresh(); } },
      clearChart: () => clearScreen(),
      removeAll: () => { drawRef.current && drawRef.current.clearAll(); treeRefresh(); },
      lockSel: () => { if (selDraw >= 0 && drawRef.current) { drawRef.current.toggleLock(selDraw); treeRefresh(); } },
      // تایم‌فریم
      tfNext: () => setTf((t) => TFS[Math.min(TFS.length - 1, TFS.indexOf(t) + 1)] || t),
      tfPrev: () => setTf((t) => TFS[Math.max(0, TFS.indexOf(t) - 1)] || t),
      tf1: () => setTf('M5'), tf2: () => setTf('M15'), tf3: () => setTf('H1'), tf4: () => setTf('H4'), tf5: () => setTf('D1'),
      // نوعِ چارت
      typeCandles: () => setChartType('candles'), typeBars: () => setChartType('bars'),
      typeLine: () => setChartType('line'), typeArea: () => setChartType('area'), typeHeikin: () => setChartType('heikin'),
      // ناوبری / مقیاس
      scrollLeft: () => { try { const ts = chartRef.current.timeScale(); ts.scrollToPosition(ts.scrollPosition() - 5, false); } catch (e) {} },
      scrollRight: () => { try { const ts = chartRef.current.timeScale(); ts.scrollToPosition(ts.scrollPosition() + 5, false); } catch (e) {} },
      scrollEnd: () => { try { chartRef.current.timeScale().scrollToRealTime(); } catch (e) {} },
      scrollHome: () => { try { chartRef.current.timeScale().setVisibleLogicalRange({ from: 0, to: 60 }); } catch (e) {} },
      zoomIn: () => { try { const ts = chartRef.current.timeScale(); const r = ts.getVisibleLogicalRange(); if (r) { const c = (r.from + r.to) / 2, h = (r.to - r.from) / 2 * 0.7; ts.setVisibleLogicalRange({ from: c - h, to: c + h }); } } catch (e) {} },
      zoomOut: () => { try { const ts = chartRef.current.timeScale(); const r = ts.getVisibleLogicalRange(); if (r) { const c = (r.from + r.to) / 2, h = (r.to - r.from) / 2 * 1.3; ts.setVisibleLogicalRange({ from: c - h, to: c + h }); } } catch (e) {} },
      cloneSel: () => { if (drawRef.current) { drawRef.current.cloneSelected(); treeRefresh(); } },
      hideAll: () => setDrawingsHidden((v) => !v), // توگلِ سراسری (Ctrl+Alt+H) — مثلِ چشمِ نوارِ ابزار
      newAlert: () => { setAlForm((f) => ({ ...f, op: 'above', value: fmtPrice(symbolRef.current, curPrice()) })); setRightTab('alerts'); setShowRight(true); },
      replayPlay: () => { const c = replayCtrlRef.current; if (c) { c.playing ? c.pause() : c.play(); } },
      saveScript: () => { onSaveScript(); },
      fit: () => { try { chartRef.current.timeScale().fitContent(); } catch (e) {} },
      resetScale: () => { try { chartRef.current.priceScale('right').applyOptions({ autoScale: true }); setScaleLocked(false); } catch (e) {} },
      // نما
      toggleRight: () => setShowRight((v) => !v),
      fullscreen: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else rootRef.current && rootRef.current.requestFullscreen(); } catch (e) {} },
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      indicators: () => setIndMenu(true),
      help: () => setShowShortcuts((v) => !v),
      screenshot: () => quickScreenshot(),
      settings: () => setCfgOpen(true),
      symbolSearch: () => setSymModal(true),
      gotoDate: () => setGotoOpen(true),
      symbolNext: () => cycleSymbol(1),
      symbolPrev: () => cycleSymbol(-1),
      symBack: () => symBack(),
      symFwd: () => symFwd(),
      // تحلیلِ روی چارت (توگل‌ها)
      toggleVolume: () => setShowVolume((v) => !v),
      togglePatterns: () => setShowPatterns((v) => !v),
      toggleDiv: () => setShowDiv((v) => !v),
      toggleVP: () => setShowVP((v) => !v),
      togglePD: () => setShowPD((v) => !v),
      toggleHarm: () => setShowHarm((v) => !v),
      toggleGaps: () => setShowGaps((v) => !v),
      // چیدمان
      saveLayout: () => saveLayout(),
      cycleGrid: () => setGrid((g) => (g === 1 ? 2 : g === 2 ? 4 : 1)),
      // ترید / بازپخش
      buy: () => quickTrade('buy'), sell: () => quickTrade('sell'),
      replayToggle: () => (replay.on ? exitReplay() : enterReplay()),
      replayStep: () => replayStep(),
      replayStepBack: () => replayStepBack(),
    }, { target: window });
    return detach;
    // eslint-disable-next-line
  }, [selDraw, replay.on, treeRefresh, replayStep, replayStepBack, quickScreenshot]);

  // جمع‌کردنِ پنلِ کناری هنگامِ ورود به چیدمانِ فشرده (تبلت/گوشی) — افزایشی و کم‌ریسک
  // (در حالتِ فشرده پنل به overlay تبدیل می‌شود؛ بسته‌نگه‌داشتنِ پیش‌فرض جلوی پوششِ چارت را می‌گیرد)
  useEffect(() => { if (compact && showRight) setShowRight(false); /* eslint-disable-next-line */ }, [compact]);

  // §۱۷ بستنِ مودال‌ها (راهنمای میان‌بُرها + تنظیماتِ اندیکاتور) با Esc
  useEffect(() => {
    if (!showShortcuts && !editInd) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); setShowShortcuts(false); setEditInd(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showShortcuts, editInd]);

  // #7 میان‌بُرِ سراسری: Ctrl/⌘+K یا "/" → مدالِ جستجوی نماد (مثلِ TradingView)
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault(); setSymInitQuery(''); setSymModal(true); return;
      }
      // تایپِ یک حرفِ خام روی چارت → بازکردنِ جست‌وجوی نماد با همان حرف (مثلِ TradingView).
      // f/s رزرو شده‌اند (تمام‌صفحه/اسکرین‌شات) پس مستثنا می‌شوند تا آن میان‌برها نشکنند.
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && /^[a-zA-Z]$/.test(e.key) && !/^[fs]$/i.test(e.key)) {
        e.preventDefault(); setSymInitQuery(e.key); setSymModal(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // §۱۶ منوها: بستن با کلیکِ بیرون یا Escape (رفتارِ استانداردِ Dropdown)
  useEffect(() => {
    if (!ctMenu && !indMenu && !gridMenu && !search && !sessMenu) return undefined;
    const closeAll = () => { setCtMenu(false); setIndMenu(false); setGridMenu(false); setSearch(''); setSessMenu(false); setOvMenu(false); };
    const onDown = (e) => { if (!e.target.closest('[data-menu]')) closeAll(); };
    const onEsc = (e) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [ctMenu, indMenu, gridMenu, search, sessMenu]);

  const filteredSymbols = symbols.filter((s) => s.toLowerCase().includes(search.toLowerCase()));
  const txt = theme === 'dark' ? 'text-gray-200' : 'text-gray-800';

  // #7 متادیتای نمادها (دسته‌بندی/توضیحِ فارسی) — یک‌بار با تغییرِ symbols ساخته می‌شود
  const symbolMeta = useMemo(() => buildMeta(symbols), [symbols]);

  // #3 آیتم‌های Legend (overlays + subs) + مقادیرِ زنده (کراس‌هیر، وگرنه آخرین کندل)
  const legendItems = useMemo(() => ([
    ...overlays.map((o) => ({ id: o.id, key: o.key, scope: 'main', label: (REGISTRY[o.key] ? REGISTRY[o.key].label : o.key) + indParamStr(o.inputs), color: (o.lineColors && o.lineColors[0]) || o.color || (REGISTRY[o.key] && REGISTRY[o.key].color), visible: o.visible !== false, pinScale: o.scale === 'left' ? 'left' : 'right' })),
    ...subs.map((o) => ({ id: o.id, key: o.key, scope: 'sub', label: (REGISTRY[o.key] ? REGISTRY[o.key].label : o.key) + indParamStr(o.inputs), color: o.color || (REGISTRY[o.key] && REGISTRY[o.key].color), visible: o.visible !== false })),
  ]), [overlays, subs]);
  const legendVals = useMemo(() => {
    const out = {};
    legendItems.forEach((it) => {
      if (indVals[it.id] != null) { out[it.id] = indVals[it.id]; return; }
      const lv = lastIndValRef.current[it.id];
      if (lv && lv.length) out[it.id] = lv.map((v) => fmtPrice(symbol, v)).join(' / ');
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legendItems, indVals, symbol, overlays, subs]);
  // #3 کنترل‌های Legend
  const toggleIndVisible = (it) => updInd(it.scope, it.id, { visible: it.visible === false });
  const duplicateInd = (it) => { const arr = it.scope === 'main' ? overlays : subs; const src = arr.find((x) => x.id === it.id); if (!src) return; const copy = { ...src, id: uid(), inputs: { ...src.inputs } }; if (it.scope === 'main') setOverlays((o) => [...o, copy]); else setSubs((s) => [...s, copy]); };
  const indHasHelp = (it) => !!getHelp(it.key);

  return (
    <div ref={rootRef} dir="rtl" className={`flex flex-col h-screen overflow-hidden ${txt}`} style={{ background: TH.bg }}>
      <style>{`.bn-thin-scroll{scrollbar-width:thin}.bn-thin-scroll::-webkit-scrollbar{height:4px;width:4px}.bn-thin-scroll::-webkit-scrollbar-thumb{background:${TH.border};border-radius:4px}.bn-thin-scroll::-webkit-scrollbar-track{background:transparent}`}</style>
      {/* #4 نوارِ بالای فشرده (گوشی + تبلت + لنداسکیپِ کم‌ارتفاع) — تشخیصِ خودکارِ ویوپورت */}
      {compact && (
        <CompactTopBar
          TH={TH} symbol={symbol} livePrice={livePrice} fmtPrice={fmtPrice} marketOpen={marketOpen}
          changePct={(legend && legend.close != null) ? (() => { const base = legend.prevClose != null ? legend.prevClose : legend.open; return (base ? ((legend.close - base) / base) * 100 : null); })() : null}
          tf={tf} chartType={chartType} chartLabel={CHART_TYPES.find((c) => c.id === chartType)?.label}
          SymbolLogo={SymbolLogo}
          onSearch={() => setSymModal(true)} onPickTf={() => setSheet('tf')} onPickType={() => setSheet('type')} onMore={() => setSheet('more')}
        />
      )}
      {/* نوارِ بالا (فقط دسکتاپِ ≥۱۲۸۰px) — در تبلت/گوشی جایش CompactTopBar می‌آید تا wrapِ چندردیفه روی چارت نیفتد */}
      {!compact && (
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b flex-wrap relative" style={{ borderColor: TH.border }}>
        {/* تاریخچهٔ نماد (back/forward) — مثلِ TradingView */}
        <div className="flex items-center">
          <button onClick={symBack} disabled={!symHist.back} title="نمادِ قبلی (تاریخچه)" className="p-1 rounded-md disabled:opacity-25 transition-colors duration-[120ms]" style={{ color: TH.text }} onMouseEnter={(e) => { if (symHist.back) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><ChevronRight size={16} /></button>
          <button onClick={symFwd} disabled={!symHist.fwd} title="نمادِ بعدی (تاریخچه)" className="p-1 rounded-md disabled:opacity-25 transition-colors duration-[120ms]" style={{ color: TH.text }} onMouseEnter={(e) => { if (symHist.fwd) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><ChevronLeft size={16} /></button>
        </div>
        {/* #7 سویچرِ نماد — مدالِ جستجوی حرفه‌ای را باز می‌کند */}
        <button onClick={() => setSymModal(true)} data-menu className="flex items-center gap-2 h-9 px-3 rounded-lg transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)} title="جستجوی نماد (Ctrl+K یا /)">
          <SymbolLogo symbol={symbol} size={20} />
          <span className="font-bold text-sm" dir="ltr" style={{ color: TH.textStrong }}>{symbol}</span>
          <Search size={14} className="opacity-50" />
        </button>
        {/* قیمتِ لحظه‌ای + تغییر کنارِ نماد (مثلِ نوارِ بالای TradingView) */}
        {legend && legend.close != null && (() => {
          const base = legend.prevClose != null ? legend.prevClose : legend.open;
          const chAbs = base != null ? (legend.close - base) : null;
          const pct = (chAbs != null && base) ? (chAbs / base) * 100 : null;
          const up = (chAbs ?? 0) >= 0; const col = chAbs == null ? TH.text : up ? TH.up : TH.down;
          return (
            <div dir="ltr" className="hidden sm:flex items-center gap-1.5 tabular-nums px-1">
              <span className="font-bold text-sm" style={{ color: col }}>{fmtPrice(symbol, legend.close)}</span>
              {chAbs != null && <span className="text-[11px]" style={{ color: col }}>{up ? '▲' : '▼'} {up ? '+' : ''}{fmtPrice(symbol, chAbs)}{pct != null ? ` (${up ? '+' : ''}${pct.toFixed(2)}%)` : ''}</span>}
              <span className="flex items-center gap-1 text-[10px]" title={marketOpen ? 'بازار باز است' : 'بازار بسته است'} style={{ color: marketOpen ? TH.up : '#f59e0b' }}>
                <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'animate-pulse' : ''}`} style={{ background: marketOpen ? TH.up : '#f59e0b' }} />
                <span className="hidden md:inline">{marketOpen ? 'باز' : 'بسته'}</span>
              </span>
              {(() => { const dsc = (symbolMeta.find((m) => m.symbol === symbol) || {}).desc; return dsc ? <span className="text-[10px] opacity-50 hidden lg:inline whitespace-nowrap" style={{ color: TH.text }} title={dsc}>{dsc}</span> : null; })()}
            </div>
          );
        })()}
        <Tip label={watch.includes(symbol) ? 'حذف از واچ‌لیست' : 'افزودن به واچ‌لیست'}><button onClick={() => toggleWatch(symbol)} className="p-1.5 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Star size={16} style={watch.includes(symbol) ? { fill: TH.accent, color: TH.accent } : { color: TH.text, opacity: 0.6 }} /></button></Tip>
        {(() => { const cs = candlesRef.current; const cur = livePrice || (cs.length ? cs[cs.length - 1].c : null); const pc = cs.length > 1 ? cs[cs.length - 2].c : (cs.length ? cs[cs.length - 1].o : null); const pct = (cur != null && pc) ? ((cur - pc) / pc) * 100 : null; return pct == null ? null : (<span dir="ltr" className="text-[12px] font-semibold tabular-nums px-1.5 py-1 rounded-md hidden sm:inline" style={{ color: pct >= 0 ? TH.up : TH.down, background: TH.chipBg }}>{cur != null ? fmtPrice(symbol, cur) : ''} · {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>); })()}
        {marketOpen ? (
          <span className="flex items-center gap-1 text-[11px] text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {livePrice != null ? <b dir="ltr" className="tabular-nums">{fmtPrice(symbol, livePrice)}</b> : 'زنده'}
          </span>
        ) : (
          <span className="text-[11px] text-amber-500/80">● بازار بسته</span>
        )}
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: TH.subtle }}>{TFS.map((t) => { const on = tf === t; return (<button key={t} onClick={() => setTf(t)} title={TF_TITLE[t] || t} className="px-2 h-7 rounded-md text-[12px] font-semibold tabular-nums transition-colors duration-[120ms]" dir="ltr" style={on ? { background: TH.accent, color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' } : { background: 'transparent', color: TH.text }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>{TF_LABEL[t] || t}</button>); })}</div>
        <span className="self-center w-px h-6 mx-0.5" style={{ background: TH.border }} aria-hidden="true" />
        <div data-menu className="relative">
          <button onClick={() => setGotoOpen((v) => !v)} title="برو به تاریخ" className="flex items-center h-8 px-2 rounded-md text-xs transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Calendar size={16} /></button>
          {gotoOpen && (
            <div className="absolute z-40 mt-1 rounded-lg p-2 pc-pop flex items-center gap-1" dir="rtl" style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
              <input autoFocus type="date" value={gotoDate} onChange={(e) => setGotoDate(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doGoto(gotoDate); if (e.key === 'Escape') setGotoOpen(false); }} dir="ltr" className="rounded px-2 py-1 text-xs outline-none" style={{ background: TH.chipBg, color: TH.textStrong }} />
              <button onClick={() => doGoto(gotoDate)} className="px-2 py-1 rounded text-xs font-semibold" style={{ background: TH.accent, color: '#fff' }}>برو</button>
            </div>
          )}
        </div>
        <span className="self-center w-px h-6 mx-0.5" style={{ background: TH.border }} aria-hidden="true" />
        <div data-menu className="relative">
          <button onClick={() => setCtMenu((v) => !v)} className="flex items-center gap-1 h-8 px-2.5 rounded-md text-xs transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><CandlestickChart size={17} /> {CHART_TYPES.find((c) => c.id === chartType)?.label}<ChevronDown size={13} /></button>
          {ctMenu && (<div className="absolute z-40 mt-1 border rounded-lg w-32 p-1" style={{ background: TH.panel, borderColor: TH.border, boxShadow: 'var(--pc-shadow-pop)' }}>{CHART_TYPES.map((ct) => (<button key={ct.id} onClick={() => { setChartType(ct.id); setCtMenu(false); }} className="block w-full text-right px-2.5 py-1.5 text-sm rounded-md transition-colors duration-[120ms]" style={chartType === ct.id ? { background: TH.accent, color: '#fff' } : {}} onMouseEnter={(e) => { if (chartType !== ct.id) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (chartType !== ct.id) e.currentTarget.style.background = 'transparent'; }}>{ct.label}</button>))}</div>)}
        </div>
        <span className="self-center w-px h-6 mx-0.5" style={{ background: TH.border }} aria-hidden="true" />
        <div data-menu className="relative">
          <button onClick={() => setIndMenu((v) => !v)} className="flex items-center gap-1 h-8 px-2.5 rounded-md text-sm transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Activity size={17} /> اندیکاتورها</button>
          {indMenu && (() => {
            const q = indSearch.trim().toLowerCase();
            const matches = ([k, d]) => !q || (d.label || '').toLowerCase().includes(q) || k.toLowerCase().includes(q);
            const filtered = Object.entries(REGISTRY).filter(matches);
            return (
            <div className="absolute z-40 mt-1 rounded-lg w-56 max-h-80 overflow-auto p-1 pc-pop" style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
              {/* جست‌وجوی اندیکاتور (مثلِ دیالوگِ اندیکاتورهای تریدینگ‌ویو) */}
              <div className="sticky top-0 z-10 p-1 -m-1 mb-1" style={{ background: TH.panel }}>
                <div className="flex items-center gap-1 rounded-md px-2 py-1" style={{ background: TH.chipBg }}>
                  <Search size={12} className="opacity-50" />
                  <input autoFocus value={indSearch} onChange={(e) => setIndSearch(e.target.value)} placeholder="جست‌وجوی اندیکاتور…" className="flex-1 bg-transparent outline-none text-[12px] min-w-0" style={{ color: TH.textStrong }} />
                  {indSearch && <button onClick={() => setIndSearch('')} className="opacity-50 hover:opacity-100"><X size={12} /></button>}
                </div>
              </div>
              {!q && indFavs.filter((k) => REGISTRY[k]).length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] opacity-50 flex items-center gap-1"><Star size={10} /> منتخب‌ها</div>
                  {indFavs.filter((k) => REGISTRY[k]).map((k) => (
                    <div key={'f' + k} className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded" style={{ color: TH.textStrong }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <button onClick={() => addInd(k)} className="flex-1 text-right">{REGISTRY[k].label}</button>
                      <button onClick={() => toggleIndFav(k)} title="حذف از منتخب"><Star size={13} style={{ fill: TH.accent, color: TH.accent }} /></button>
                    </div>
                  ))}
                  <div className="my-1 border-t" style={{ borderColor: TH.border }} />
                </>
              )}
              {filtered.length === 0 && <div className="px-2 py-3 text-center text-[12px] opacity-50">اندیکاتوری یافت نشد</div>}
              {filtered.map(([k, d]) => (
                <div key={k} className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded" style={{ color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <button onClick={() => addInd(k)} className="flex-1 text-right">{d.label}</button>
                  {getHelp(k) && <HelpDot onClick={() => setHelpId(k)} TH={TH} size={12} />}
                  <button onClick={() => toggleIndFav(k)} title="افزودن/حذف از منتخب" className="mr-1"><Star size={12} style={indFavs.includes(k) ? { fill: TH.accent, color: TH.accent } : { opacity: 0.35 }} /></button>
                </div>
              ))}
              {/* تمپلیتِ اندیکاتورها (ذخیره/اعمالِ ترکیب) */}
              <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              <button onClick={saveIndTpl} className="flex items-center gap-1.5 w-full text-right px-2 py-1.5 text-[12px]" style={{ color: TH.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Save size={12} /> ذخیرهٔ ترکیبِ فعلی به‌عنوان تمپلیت</button>
              {Object.keys(indTpls).map((name) => (
                <div key={'t' + name} className="flex items-center justify-between w-full px-2 py-1.5 text-[12px] rounded" style={{ color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <button onClick={() => applyIndTpl(name)} className="flex-1 text-right flex items-center gap-1.5"><FolderOpen size={12} /> {name}</button>
                  <button onClick={() => delIndTpl(name)} title="حذف"><Trash2 size={12} className="opacity-50" /></button>
                </div>
              ))}
            </div>
            );
          })()}
        </div>
        {/* منوی «نمایش» — همهٔ توگل‌های overlayِ چارت یک‌جا (مثلِ TradingView) */}
        <div data-menu className="relative">
          <button onClick={() => setOvMenu((v) => !v)} className="flex items-center gap-1 h-8 px-2.5 rounded-md text-sm transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)} title="نمایشِ overlayهای چارت"><Eye size={16} /> نمایش <ChevronDown size={13} /></button>
          {ovMenu && (
            <div className="absolute z-40 mt-1 rounded-lg w-52 p-1 pc-pop" dir="rtl" style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
              {[
                { h: 'حجم', items: [
                  ['هیستوگرامِ حجم', showVolume, () => setShowVolume((v) => !v)],
                  ['پروفایلِ حجم', showVP, () => setShowVP((v) => !v)],
                ] },
                { h: 'سطوح', items: [
                  ['سطوحِ روز (PDH/PDL/PDC/DO)', showPD, () => setShowPD((v) => !v)],
                  ['سطوحِ هفته (PWH/PWL/PWC/WO)', showWk, () => setShowWk((v) => !v)],
                  ['سطوحِ ماه (PMH/PML/PMC/MO)', showMo, () => setShowMo((v) => !v)],
                  ['سقف/کفِ بازهٔ دیده‌شده', showHL, () => setShowHL((v) => !v)],
                ] },
                { h: 'تشخیصِ الگو', items: [
                  [`الگوهای کندل‌استیک${showPatterns && detCounts.pat ? ` (${detCounts.pat})` : ''}`, showPatterns, () => setShowPatterns((v) => !v)],
                  [`واگراییِ RSI${showDiv && detCounts.div ? ` (${detCounts.div})` : ''}`, showDiv, () => setShowDiv((v) => !v)],
                  [`الگوهای هارمونیک${showHarm && detCounts.harm ? ` (${detCounts.harm})` : ''}`, showHarm, () => setShowHarm((v) => !v)],
                  [`نشانگرِ گپِ قیمت${showGaps && detCounts.gap ? ` (${detCounts.gap})` : ''}`, showGaps, () => setShowGaps((v) => !v)],
                ] },
                { h: 'رویدادها', items: [
                  ['خطوطِ جداکننده (روز/ماه/سال)', showDaySep, () => setShowDaySep((v) => !v)],
                  ['رویدادهای اقتصادیِ پراثر', showEcon, () => setShowEcon((v) => !v)],
                  ['فلگ‌های خبر', showNews, () => setShowNews((v) => !v)],
                ] },
              ].map((sec) => (
                <React.Fragment key={sec.h}>
                  <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-bold opacity-45" style={{ color: TH.text }}>{sec.h}</div>
                  {sec.items.map(([label, on, toggle]) => (
                    <button key={label} onClick={toggle} className="flex items-center justify-between w-full px-2 py-1.5 text-[12px] rounded text-right" style={{ color: TH.textStrong }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <span>{label}</span>
                      <span className="w-4 flex justify-center" style={{ color: on ? TH.accent : 'transparent' }}>✓</span>
                    </button>
                  ))}
                </React.Fragment>
              ))}
              {(showVolume || showVP || showPD || showWk || showMo || showHL || showPatterns || showDiv || showHarm || showGaps || showDaySep || showEcon || showNews) && (
                <>
                  <div className="my-1 border-t" style={{ borderColor: TH.border }} />
                  <button onClick={() => { setShowVolume(false); setShowVP(false); setShowPD(false); setShowWk(false); setShowMo(false); setShowHL(false); setShowPatterns(false); setShowDiv(false); setShowHarm(false); setShowGaps(false); setShowDaySep(false); setShowEcon(false); setShowNews(false); }}
                    className="flex items-center gap-1.5 w-full px-2 py-1.5 text-[12px] rounded text-right" style={{ color: TH.down }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <EyeOff size={12} /> خاموش‌کردنِ همه
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <button onClick={openNamaScript} title={bnPrem ? 'نمااسکریپت' : 'ویژهٔ پرمیوم'} className="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-[120ms]" style={editorOpen ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!editorOpen) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!editorOpen) e.currentTarget.style.background = TH.chipBg; }}><Code2 size={17} /> نمااسکریپت{!bnPrem && <Lock size={12} className="opacity-70" />}</button>
        <button onClick={() => (replay.on ? exitReplay() : enterReplay())} className="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-[120ms]" style={replay.on ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!replay.on) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!replay.on) e.currentTarget.style.background = TH.chipBg; }}><Play size={17} /> بازپخش</button>
        <button onClick={getAiSignal} disabled={aiBusy} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm text-white disabled:opacity-60 transition-opacity duration-[120ms]" style={{ background: TH.accentAi }} title="ستاپِ کاملِ AI در همین نماد/تایم‌فریم"><Sparkles size={17} className={aiBusy ? 'animate-pulse' : ''} /> سیگنالِ AI {aiQuota && <span className="tabular-nums" dir="ltr">{`(${aiQuota.remaining}/${aiQuota.limit})`}</span>}</button>
        <button onClick={() => setPartnersOpen(true)} title="صرافی و بروکرِ پیشنهادی — افتتاحِ حساب" className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm text-white font-semibold transition-transform duration-150 hover:scale-[1.03]" style={{ background: 'linear-gradient(90deg,#1f6fff,#c79a3a)', boxShadow: '0 6px 16px -8px #1f6fff' }}>صرافی/بروکر</button>
        <div data-menu className="relative">
          <button onClick={() => setGridMenu((v) => !v)} className="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-[120ms]" style={grid > 1 ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (grid === 1) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (grid === 1) e.currentTarget.style.background = TH.chipBg; }} title="چند-چارت — انتخابِ چیدمان"><LayoutGrid size={17} /> {grid}× <ChevronDown size={13} /></button>
          {gridMenu && (
            <div className="absolute z-40 mt-1 border rounded-lg w-40 p-1" style={{ background: TH.popoverBg, borderColor: TH.border, boxShadow: 'var(--pc-shadow-pop)' }}>
              {GRID_PRESET_ORDER.map((pid) => { const L = getGridLayout(pid); const active = legacyGridToPreset(grid) === pid; return (
                <button key={pid} onClick={() => { setGrid(presetToLegacyGrid(pid)); setGridMenu(false); }} className="flex items-center justify-between w-full text-right px-2 py-1.5 text-sm rounded-md transition-colors duration-[120ms]" style={active ? { background: TH.accent, color: '#fff' } : {}} onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <span>{L.label}</span>
                  <span className="tabular-nums opacity-70" dir="ltr">{L.cells}×</span>
                </button>
              ); })}
            </div>
          )}
        </div>
        {grid > 1 && (
          <Tip label={gridSync ? 'همگام‌سازیِ کراس‌هیر/زمانِ چارت‌ها روشن است' : 'همگام‌سازیِ چارت‌ها خاموش است'}>
            <button onClick={() => setGridSync((v) => !v)} title="همگام‌سازیِ چارت‌های گرید" className="p-1.5 rounded-md transition-colors duration-[120ms]" style={gridSync ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!gridSync) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!gridSync) e.currentTarget.style.background = TH.chipBg; }}><GitCompare size={16} /></button>
          </Tip>
        )}
        {/* گروهِ «مقیاس و کراس‌هیر» — ۵ کنترل که نوارِ بالا را شلوغ می‌کردند، حالا در یک پاپ‌آور */}
        <div className="relative">
          <Tip label="مقیاس و کراس‌هیر (نوع/قفل/وارونه/بازنشانی/کراس‌هیر)">
            <button onClick={() => setScaleMenu((v) => !v)} className="p-1.5 rounded-md transition-colors duration-[120ms]" style={(scaleLocked || scaleInvert || scaleMode !== 0) ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!(scaleLocked || scaleInvert || scaleMode !== 0)) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!(scaleLocked || scaleInvert || scaleMode !== 0)) e.currentTarget.style.background = TH.chipBg; }}><SlidersHorizontal size={16} /></button>
          </Tip>
          {scaleMenu && (
            <>
              <div className="fixed inset-0 z-[55]" onClick={() => setScaleMenu(false)} />
              <div dir="rtl" className="absolute z-[56] top-full mt-1 right-0 w-56 rounded-xl p-2 shadow-2xl text-xs space-y-2" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}`, color: TH.textStrong }}>
                <div className="flex items-center justify-between"><span>نوعِ مقیاس</span>
                  <select value={scaleMode} onChange={(e) => setScaleMode(Number(e.target.value))} className="rounded px-1.5 py-1 outline-none" style={{ background: TH.chipBg, color: TH.text }}>{PRICE_SCALE_MODES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}</select>
                </div>
                <div className="flex items-center justify-between"><span>حالتِ کراس‌هیر</span>
                  <select value={crosshairId} onChange={(e) => setCrosshairId(e.target.value)} className="rounded px-1.5 py-1 outline-none" style={{ background: TH.chipBg, color: TH.text }}>{CROSSHAIR_MODES.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}</select>
                </div>
                <div className="flex items-center justify-between"><span>قفلِ مقیاس (خاموش‌کردنِ خودکار)</span>
                  <button onClick={() => setScaleLocked((v) => !v)} className="px-2 py-0.5 rounded flex items-center gap-1" style={scaleLocked ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{scaleLocked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                </div>
                <div className="flex items-center justify-between"><span>وارونه‌کردنِ محورِ قیمت</span>
                  <button onClick={() => setScaleInvert((v) => !v)} className="px-2 py-0.5 rounded flex items-center gap-1" style={scaleInvert ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}><ArrowUpDown size={13} /></button>
                </div>
                <button onClick={() => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); setScaleLocked(false); setScaleInvert(false); } catch (e) {} setScaleMenu(false); }} className="w-full py-1.5 rounded-lg flex items-center justify-center gap-1.5" style={{ background: TH.chipBg, color: TH.textStrong }}><Scaling size={14} /> بازنشانیِ مقیاس (اتوفیت)</button>
              </div>
            </>
          )}
        </div>
        {/* #1 کنترلِ حرفه‌ایِ «سشن‌ها» — pillِ overflow-hidden جدا از dropdown (وگرنه منو کلیپ می‌شد و باز نمی‌شد) */}
        <div data-menu className="relative">
          <div className="flex items-center rounded-md overflow-hidden" style={sessionsOn ? { background: TH.accent } : { background: TH.chipBg }}>
            <button onClick={() => setSessionsOn((v) => !v)} title="نمایش/پنهان‌کردنِ باندهای سشنِ فارکس" className="px-2 py-1 text-xs font-semibold transition-colors duration-[120ms]" style={sessionsOn ? { color: '#fff' } : { color: TH.text }}>سشن‌ها</button>
            <button onClick={() => setSessMenu((v) => !v)} title="انتخابِ سشن‌ها و منطقهٔ زمانی" className="px-1 py-1" style={sessionsOn ? { color: '#fff' } : { color: TH.text }}><ChevronDown size={12} style={{ transform: sessMenu ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} /></button>
          </div>
          {sessMenu && (
            <div className="absolute z-[60] top-full mt-1 right-0 rounded-xl w-56 p-1.5 shadow-2xl" dir="rtl" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
              <div className="flex items-center justify-between px-2 pt-0.5 pb-1.5">
                <span className="text-[11px] font-bold" style={{ color: TH.textStrong }}>سشن‌های معاملاتی</span>
                <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: TH.text }} onClick={() => setSessionsOn((v) => !v)}>
                  <span>نمایش</span>
                  <span className="relative inline-block w-7 h-4 rounded-full transition-colors" style={{ background: sessionsOn ? TH.accent : TH.border }}>
                    <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ [sessionsOn ? 'left' : 'right']: '2px' }} />
                  </span>
                </label>
              </div>
              {SESSIONS.map((s) => { const on = sessionSel.includes(s.id); return (
                <button key={s.id} onClick={() => { setSessionSel((sel) => sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id]); if (!sessionsOn) setSessionsOn(true); }} className="flex items-center gap-2.5 w-full text-right px-2 py-2 text-[12px] rounded-lg" style={{ color: TH.textStrong, background: on ? (TH.chipBg) : 'transparent' }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = on ? TH.chipBg : 'transparent')}>
                  <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: on ? s.edge : 'transparent', border: `1.5px solid ${on ? s.edge : TH.border}` }}>{on && <span className="text-[10px] text-white leading-none">✓</span>}</span>
                  <span className="w-3 h-3 rounded shrink-0" style={{ background: s.color, border: `1px solid ${s.edge}` }} />
                  <span className="flex-1 font-medium">{s.label}</span>
                </button>
              ); })}
              <div className="flex gap-1 px-1 mt-1">
                <button onClick={() => { setSessionSel(SESSIONS.map((s) => s.id)); if (!sessionsOn) setSessionsOn(true); }} className="flex-1 text-[11px] py-1.5 rounded-lg font-semibold" style={{ background: TH.chipBg, color: TH.text }}>همه</button>
                <button onClick={() => setSessionSel([])} className="flex-1 text-[11px] py-1.5 rounded-lg font-semibold" style={{ background: TH.chipBg, color: TH.text }}>هیچ</button>
              </div>
              <div className="my-1.5 border-t" style={{ borderColor: TH.border }} />
              <div className="px-2 pb-1 text-[11px] font-bold" style={{ color: TH.textStrong }}>منطقهٔ زمانی (نمایشِ ساعت)</div>
              <div className="max-h-40 overflow-y-auto bn-thin-scroll">
                {TIMEZONES.map((z) => { const on = tz === z.id; return (
                  <button key={z.id} onClick={() => setTz(z.id)} className="flex items-center gap-2.5 w-full text-right px-2 py-1.5 text-[12px] rounded-lg" style={{ color: TH.textStrong, background: on ? TH.chipBg : 'transparent' }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = on ? TH.chipBg : 'transparent')}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ border: `1.5px solid ${on ? TH.accent : TH.border}` }}>{on && <span className="w-2 h-2 rounded-full" style={{ background: TH.accent }} />}</span>
                    <span className="flex-1">{z.label}</span>
                  </button>
                ); })}
              </div>
            </div>
          )}
        </div>
        <button onClick={() => { try { if (document.fullscreenElement) document.exitFullscreen(); else rootRef.current && rootRef.current.requestFullscreen(); } catch (e) {} }} title="تمام‌صفحه" className="p-1.5 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Maximize2 size={18} /></button>
        <ScreenshotMenu TH={TH} getCapture={getCapture} uploadSnapshot={uploadSnapshot} iconSize={18} coarse={bp.coarse} />
        <button onClick={() => setShowShortcuts(true)} title="راهنمای میان‌بُرهای صفحه‌کلید (؟)" aria-label="راهنمای میان‌بُرهای صفحه‌کلید" className="p-1.5 rounded-md text-[13px] leading-none transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>⌨</button>
        {getHelp(tool) && tool !== 'cursor' && (
          <button onClick={() => setHelpId(tool)} title="راهنمای ابزارِ فعال" className="p-1.5 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg, color: TH.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><HelpCircle size={16} /></button>
        )}
        <div className="flex-1" />
        <button onClick={() => { setRightTab('alerts'); setShowRight(true); }} title="آلارم‌ها (مدیریتِ هشدارها)" className="relative p-1.5 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
          <Bell size={18} />
          {savedAlerts.length > 0 && <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center tabular-nums" style={{ background: TH.accent, color: '#fff' }}>{savedAlerts.length}</span>}
        </button>
        <button onClick={() => setCfgOpen(true)} className="p-1.5 rounded-md transition-colors duration-[120ms]" title="تنظیماتِ ظاهرِ چارت (رنگِ کندل، شبکه)" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Settings2 size={18} /></button>
        <button onClick={saveLayout} className="p-1.5 rounded-md transition-colors duration-[120ms]" title="ذخیرهٔ چیدمانِ فعلی (نماد + تایم‌فریم + اندیکاتورها + ترسیم‌ها)" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Save size={18} /></button>
        <div className="relative">
          <select onChange={(e) => e.target.value && loadLayout(e.target.value)} title="بارگذاریِ یک چیدمانِ ذخیره‌شده (نماد/تایم‌فریم/اندیکاتور/ترسیم را یک‌جا برمی‌گرداند)" className="text-xs rounded px-2 py-1 outline-none" style={{ background: TH.chipBg, color: TH.text }}>
            <option value="">📁 چیدمان‌های ذخیره‌شده…</option>{layouts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} className="p-1.5 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
        <button onClick={() => setShowRight((v) => !v)} title="نمایش/پنهان‌کردنِ نوارِ کناری (واچ‌لیست، سیگنال AI، اسکنر، ترید، آلارم)" className="p-1.5 rounded-md transition-colors duration-[120ms]" style={showRight ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!showRight) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!showRight) e.currentTarget.style.background = TH.chipBg; }}><Star size={18} /></button>
        <AuthMenu theme={theme} />
      </div>
      )}

      {/* #3 نوارِ افقیِ اندیکاتورها حذف شد؛ جایش ChartLegendِ شناورِ روی چارت (پایین‌تر) آمد. */}

      <div dir="ltr" className="flex flex-1 min-h-0 relative">
        {/* نوارِ ابزارِ ترسیم (سمتِ چپ مثلِ TradingView) — در تبلت/گوشی پنهان (#4)، به Drawing-sheet می‌رود تا روی چارت نیفتد */}
        {!compact && (
        <div className="w-12 border-r flex flex-col items-center py-2 gap-1 shrink-0" style={{ borderColor: TH.border }}>
          <div className="flex-1 min-h-0 w-full">
            <ToolRail tool={tool} setTool={setTool} TH={TH} onHelp={setHelpId} />
          </div>
          <div className="h-px w-5 my-0.5" style={{ background: TH.border }} />
          {/* گروهِ «ظاهرِ ترسیم» — رنگ + ضخامت + سبکِ خط، همه یک‌جا (سبکِ TradingView، نوارِ تمیز) */}
          <div className="flex flex-col items-center gap-1 rounded-md py-1 px-0.5" style={{ border: `1px solid ${TH.border}` }} title="ظاهرِ ترسیم: رنگ، ضخامت و سبکِ خط">
            <Tip label="رنگِ ترسیم"><input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0" /></Tip>
            <div className="h-px w-4" style={{ background: TH.border }} />
            <Tip label="ضخامتِ ترسیم"><button onClick={() => setDrawWidth((w) => (w >= 4 ? 1 : Math.floor(w) + 1))} className="w-5 h-4 rounded text-[10px] font-bold tabular-nums opacity-70 hover:opacity-100" title="ضخامتِ خطِ ترسیم">{Math.round(drawWidth)}</button></Tip>
            <Tip label="سبکِ خطِ ترسیم: توپر → خط‌چین → نقطه‌ای"><button onClick={() => { const nx = { 0: 2, 2: 1, 1: 0 }[drawLineStyle] ?? 2; setDrawLineStyle(nx); setDrawDashed(nx === 2); }} className={`w-5 h-4 rounded text-[11px] leading-none ${drawLineStyle !== 0 ? 'text-white' : 'opacity-70 hover:opacity-100'}`} style={drawLineStyle !== 0 ? { background: TH.accent } : {}} title="سبکِ خطِ ترسیم">{{ 0: '─', 2: '┄', 1: '⋯' }[drawLineStyle]}</button></Tip>
          </div>
          <Tip label={magnet ? `مگنتِ ${magnetMode === 'strong' ? 'قوی (همیشه به O/H/L/C می‌چسبد)' : 'ضعیف (فقط نزدیکِ O/H/L/C)'} — کلیک برای تغییرِ حالت` : 'مگنت خاموش — کلیک: ضعیف → قوی → خاموش'}>
            <button onClick={() => { if (!magnet) { setMagnet(true); setMagnetMode('weak'); } else if (magnetMode === 'weak') { setMagnetMode('strong'); } else { setMagnet(false); } }}
              className={`relative p-1 rounded-md transition-colors duration-[120ms] ${magnet ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={magnet ? { background: TH.accent } : {}}>
              <Magnet size={12} />
              {magnet && <span className="absolute -bottom-0.5 -right-0.5 text-[7px] font-bold leading-none px-0.5 rounded" style={{ background: '#fff', color: TH.accent }}>{magnetMode === 'strong' ? 'S' : 'W'}</span>}
            </button>
          </Tip>
          {/* گروهِ «اورلی‌ها و تحلیلِ خودکار» — ۶ توگل که قبلاً جدا بودند و نوار را شلوغ می‌کردند، حالا در یک فلای‌اوت */}
          {(() => {
            const ovl = [
              { on: showVP, set: setShowVP, Icon: BarChart3, label: 'پروفایلِ حجم (توزیعِ قیمت)' },
              { on: showVolume, set: setShowVolume, Icon: BarChart, label: 'هیستوگرامِ حجم (پایینِ چارت)' },
              { on: showPD, set: setShowPD, Icon: Minus, label: 'سطوحِ روز (PDH/PDL/PDC + DO/HOD/LOD)' },
              { on: showHL, set: setShowHL, Icon: ArrowUpDown, label: 'سقف/کفِ بازهٔ دیده‌شده (HH/LL)' },
              { on: showPatterns, set: setShowPatterns, Icon: Sparkles, label: `الگوهای کندل‌استیک (${PATTERN_COUNT}+ الگو)` },
              { on: showDiv, set: setShowDiv, Icon: Activity, label: 'واگراییِ RSI (صعودی/نزولی + مخفی)' },
            ];
            const anyOn = ovl.some((o) => o.on); const activeCount = ovl.filter((o) => o.on).length;
            return (
              <div className="relative">
                <Tip label="اورلی‌ها و تحلیلِ خودکار (پروفایلِ حجم، سطوحِ روز، HH/LL، الگوها، واگرایی…)">
                  <button onClick={() => setOvlMenu((v) => !v)} className={`relative p-1 rounded-md transition-colors duration-[120ms] ${anyOn ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={anyOn ? { background: TH.accent } : {}}>
                    <Layers size={13} />
                    {activeCount > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[12px] h-[12px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center" style={{ background: TH.up, color: '#fff' }}>{activeCount}</span>}
                  </button>
                </Tip>
                {ovlMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOvlMenu(false)} />
                    <div dir="rtl" className="absolute left-full top-0 ml-1 z-50 w-56 rounded-lg pc-pop py-1 text-[12px]" style={{ background: TH.panel, border: `1px solid ${TH.border}`, color: TH.textStrong }}>
                      <div className="px-3 py-1 text-[10px] font-bold opacity-50">اورلی‌ها و تحلیلِ خودکار</div>
                      {ovl.map((o, i) => (
                        <button key={i} onClick={() => o.set((v) => !v)} className="w-full text-right px-3 py-1.5 flex items-center gap-2"
                          onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          <o.Icon size={14} style={{ color: o.on ? TH.accent : TH.text, opacity: o.on ? 1 : 0.6 }} />
                          <span className="flex-1" style={{ color: o.on ? TH.textStrong : TH.text }}>{o.label}</span>
                          <span className="w-8 h-4 rounded-full relative transition-colors duration-[120ms]" style={{ background: o.on ? TH.accent : TH.chipBg }}>
                            <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-[120ms]" style={{ [o.on ? 'left' : 'right']: 2 }} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          <div className="h-px w-5 my-0.5" style={{ background: TH.border }} />
          <Tip label="واگرد (Ctrl+Z)"><button onClick={() => { drawRef.current && drawRef.current.undo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canUndo())} className="p-1 rounded opacity-60 hover:opacity-100 disabled:opacity-20"><Undo2 size={12} /></button></Tip>
          <Tip label="ازنو (Ctrl+Y)"><button onClick={() => { drawRef.current && drawRef.current.redo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canRedo())} className="p-1 rounded opacity-60 hover:opacity-100 disabled:opacity-20"><Redo2 size={12} /></button></Tip>
          <Tip label="ماندن در حالتِ ترسیم (پشتِ‌سرهم بکش)"><button onClick={() => setStayDraw((v) => !v)} className={`p-1 rounded-md transition-colors duration-[120ms] ${stayDraw ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={stayDraw ? { background: TH.accent } : {}}><Pencil size={12} /></button></Tip>
          {/* گروهِ «پنجره‌ها» — درختِ آبجکت + پنجرهٔ داده + مقایسه، در یک فلای‌اوت تا نوار شلوغ نشود */}
          <div className="relative">
            <Tip label="پنجره‌ها (درختِ آبجکت، پنجرهٔ داده، مقایسه)">
              <button onClick={() => setRailMenu((v) => !v)} className={`p-1 rounded-md transition-colors duration-[120ms] ${(showTree || showDataWin || compares.length) ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={(showTree || showDataWin || compares.length) ? { background: TH.accent } : {}}><MoreVertical size={13} /></button>
            </Tip>
            {railMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setRailMenu(false)} />
                <div dir="rtl" className="absolute left-full top-0 ml-1 z-50 w-52 rounded-lg pc-pop py-1 text-[12px]" style={{ background: TH.panel, border: `1px solid ${TH.border}`, color: TH.textStrong }}>
                  <button onClick={() => { setShowTree((v) => !v); treeRefresh(); }} className="w-full text-right px-3 py-1.5 flex items-center gap-2" onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><List size={14} style={{ color: showTree ? TH.accent : TH.text }} /><span className="flex-1">درختِ آبجکت‌ها</span>{(drawList.length + legendItems.length) > 0 && <span className="text-[10px] tabular-nums px-1 rounded-full" style={{ background: TH.chipBg, color: TH.text }}>{drawList.length + legendItems.length}</span>}{showTree && <span style={{ color: TH.accent }}>●</span>}</button>
                  <button onClick={() => setShowDataWin((v) => !v)} className="w-full text-right px-3 py-1.5 flex items-center gap-2" onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Table2 size={14} style={{ color: showDataWin ? TH.accent : TH.text }} /><span className="flex-1">پنجرهٔ داده</span>{showDataWin && <span style={{ color: TH.accent }}>●</span>}</button>
                  <button onClick={() => { setCmpModal(true); setRailMenu(false); }} className="w-full text-right px-3 py-1.5 flex items-center gap-2" onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><GitCompare size={14} style={{ color: compares.length ? TH.accent : TH.text }} /><span className="flex-1">مقایسهٔ نماد</span>{compares.length > 0 && <span style={{ color: TH.accent }}>{compares.length}</span>}</button>
                </div>
              </>
            )}
          </div>
          <Tip label={drawingsHidden ? 'نمایشِ همهٔ ترسیم‌ها' : 'پنهان‌کردنِ همهٔ ترسیم‌ها'}><button onClick={() => setDrawingsHidden((v) => !v)} className={`p-1 rounded-md transition-colors duration-[120ms] ${drawingsHidden ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={drawingsHidden ? { background: TH.accent } : {}}>{drawingsHidden ? <EyeOff size={12} /> : <Eye size={12} />}</button></Tip>
          <Tip label={drawingsLocked ? 'بازکردنِ قفلِ همهٔ ترسیم‌ها' : 'قفلِ همهٔ ترسیم‌ها'}><button onClick={() => setDrawingsLocked((v) => !v)} className={`p-1 rounded-md transition-colors duration-[120ms] ${drawingsLocked ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={drawingsLocked ? { background: TH.accent } : {}}>{drawingsLocked ? <Lock size={12} /> : <Unlock size={12} />}</button></Tip>
          <div className="h-px w-5 my-0.5" style={{ background: TH.border }} />
          <Tip label="پاکِ آخرین ترسیم"><button onClick={() => drawRef.current && drawRef.current.clearLast()} className="p-1 rounded opacity-60 hover:opacity-100"><Minus size={12} /></button></Tip>
          <Tip label="پاکِ همهٔ ترسیم‌ها"><button onClick={() => drawRef.current && drawRef.current.clearAll()} className="p-1 rounded opacity-60 hover:text-red-400"><Trash2 size={12} /></button></Tip>
        </div>
        )}

        {/* چارت */}
        <div className="flex-1 flex flex-col min-w-0 relative" style={compact ? { paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' } : undefined}>
          {/* #3 Legendِ یکپارچهٔ روی چارت: نماد + اندیکاتورها با کنترل‌های on-hover */}
          {legendItems.length > 0 ? (
            <div dir="rtl">
              <ChartLegend
                items={legendItems} legend={legend} TH={TH} symbol={symbol} tf={tf}
                desc={(symbolMeta.find((m) => m.symbol === symbol) || {}).desc}
                indVals={legendVals} coarse={bp.coarse}
                collapsed={legCollapsed} onCollapse={setLegCollapsed}
                viewMode={legView} onToggleViewMode={() => setLegView((v) => (v === 'compact' ? 'normal' : 'compact'))}
                onToggleVisible={toggleIndVisible}
                onSettings={(it) => setEditInd({ scope: it.scope, id: it.id })}
                onRemove={(it) => rmInd(it.scope, it.id)}
                onDuplicate={duplicateInd}
                onHelp={(it) => setHelpId(it.key)} hasHelp={indHasHelp}
                onClearAll={() => { setOverlays([]); setSubs([]); }}
                onSymbolClick={() => { setSymInitQuery(''); setSymModal(true); }}
                indsHidden={indsHidden} onToggleIndsHidden={() => setIndsHidden((v) => !v)}
                onSymbolSettings={() => setCfgOpen(true)}
                onPinScale={(it, side) => updInd(it.scope, it.id, { scale: side })}
                SymbolLogo={SymbolLogo}
              />
            </div>
          ) : (
            <Legend legend={legend} TH={TH} symbol={symbol} tf={tf} />
          )}
          {/* Volume Profile — انتخابِ حالتِ محاسبه (کلِ داده / بازهٔ دیده‌شده = VPVR) */}
          {showVP && (
            <div dir="rtl" className="absolute z-20 top-8 right-2 flex items-center rounded overflow-hidden text-[10px] font-medium" style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
              {[{ k: 'total', t: 'کلِ داده' }, { k: 'visible', t: 'بازهٔ دیده‌شده' }].map((m) => (
                <button key={m.k} onClick={() => setVpMode(m.k)} className="px-1.5 py-0.5 transition-colors duration-[120ms]"
                  style={vpMode === m.k ? { background: TH.accent, color: '#fff' } : { color: TH.text }}>{m.t}</button>
              ))}
              <button onClick={lockVpRange} title="قفلِ پروفایل روی بازهٔ فعلیِ دید (با پن تغییر نمی‌کند)" className="px-1.5 py-0.5 transition-colors duration-[120ms]"
                style={vpMode === 'fixed' ? { background: TH.accent, color: '#fff' } : { color: TH.text }}>قفلِ بازه</button>
            </div>
          )}
          {/* شمارشِ معکوسِ نزدیک‌ترین رویدادِ اقتصادیِ پراثر */}
          {showEcon && nextEcon && (() => {
            const rem = Math.max(0, Math.floor(new Date(nextEcon.date).getTime() / 1000 - Date.now() / 1000));
            const p2 = (n) => String(n).padStart(2, '0');
            const cd = `${p2(Math.floor(rem / 3600))}:${p2(Math.floor((rem % 3600) / 60))}:${p2(rem % 60)}`;
            return (
              <div dir="rtl" className="absolute z-20 bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]" style={{ background: TH.panel, border: `1px solid ${TH.border}`, color: TH.textStrong }}>
                <span>📅</span>
                <span className="opacity-70">{nextEcon.country}</span>
                <span className="truncate max-w-[180px]">{nextEcon.title}</span>
                <span className="tabular-nums font-semibold" dir="ltr" style={{ color: rem < 900 ? TH.down : TH.accent }}>{cd}</span>
              </div>
            );
          })()}
          {/* ساعتِ زندهٔ منطقهٔ زمانی + سشنِ فعالِ فارکس — گوشهٔ پایین‌راست */}
          {clock && (() => {
            const utcH = new Date().getUTCHours();
            const active = SESSIONS.filter((s) => utcH >= s.startUtc && utcH < s.endUtc);
            return (
            <button dir="ltr" onClick={() => setSessMenu(true)} className="absolute z-10 bottom-1 right-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] tabular-nums cursor-pointer hover:brightness-125 transition-[filter] duration-[120ms]" style={{ color: TH.text, background: TH.panel + 'cc' }} title="ساعتِ منطقهٔ زمانی + سشنِ فعال — کلیک برای تغییرِ منطقهٔ زمانی">
              {active.length > 0 && (
                <span className="flex items-center gap-0.5" title={`سشنِ فعال: ${active.map((s) => s.label).join('، ')}`}>
                  {active.map((s) => <span key={s.id} className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: s.edge }} />)}
                </span>
              )}
              <span className="opacity-60">{(TIMEZONES.find((z) => z.id === tz) || {}).label || tz}</span>
              <span style={{ color: TH.textStrong }}>{clock}</span>
            </button>
            );
          })()}
          {/* اندازه‌گیریِ Shift+درگ — کادرِ موقت */}
          {measure && (() => {
            const left = Math.min(measure.x0, measure.x1), top = Math.min(measure.y0, measure.y1);
            const w = Math.abs(measure.x1 - measure.x0), h = Math.abs(measure.y1 - measure.y0);
            const up = measure.dPrice >= 0; const col = up ? TH.up : TH.down;
            const secs = measure.bars * tfSec(tf);
            const dur = (() => { const d = Math.floor(secs / 86400), hh = Math.floor((secs % 86400) / 3600), mm = Math.floor((secs % 3600) / 60); return d ? `${d}d ${hh}h` : hh ? `${hh}h ${mm}m` : `${mm}m`; })();
            const dig = priceDigits(symbol); const pip = dig >= 3 ? Math.round(Math.abs(measure.dPrice) / Math.pow(10, -(dig - 1))) : null; // پیپ برای فارکس/فلزات
            return (
              <div className="absolute z-30 pointer-events-none" style={{ left, top, width: w, height: h, background: col + '22', border: `1px solid ${col}` }}>
                <div dir="ltr" className="absolute left-1/2 -translate-x-1/2 -top-6 px-1.5 py-0.5 rounded text-[10px] tabular-nums whitespace-nowrap" style={{ background: col, color: '#fff' }}>
                  {(up ? '+' : '') + fmtPrice(symbol, measure.dPrice)} ({(up ? '+' : '') + measure.pct.toFixed(2)}%){pip != null ? ` · ${pip} pip` : ''} · {measure.bars} bar · {dur}{measure.vol > 0 ? ` · Vol ${fmtVol(measure.vol)}` : ''}
                </div>
                {measure.startP != null && measure.endP != null && (
                  <div dir="ltr" className="absolute left-1/2 -translate-x-1/2 -bottom-5 px-1.5 py-0.5 rounded text-[9px] tabular-nums whitespace-nowrap" style={{ background: col, color: '#fff' }}>
                    {fmtPrice(symbol, measure.startP)} → {fmtPrice(symbol, measure.endP)}
                  </div>
                )}
              </div>
            );
          })()}
          {/* دکمهٔ پرش به لحظهٔ حال (وقتی به عقب اسکرول شده) — مثلِ TradingView */}
          {!atRealtime && !replay.on && (
            <button onClick={() => { try { chartRef.current.timeScale().scrollToRealTime(); } catch (e) {} }} title="پرش به آخرین کندل"
              className="absolute z-20 bottom-8 right-3 flex items-center justify-center w-7 h-7 rounded-full pc-pop"
              style={{ background: TH.accent, color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.35)' }}>
              <Play size={13} style={{ marginLeft: 1 }} />
            </button>
          )}
          {/* Compare: چیپ‌های نمادهای مقایسه‌ای — قابلِ حذفِ تکی */}
          {compares.length > 0 && (
            <div dir="ltr" className="absolute z-20 top-8 left-2 flex flex-wrap gap-1 pointer-events-auto">
              <button onClick={() => setCmpPercent((v) => !v)} title="مقایسهٔ درصدی (نرمال‌سازیِ ٪)" className="flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold" style={cmpPercent ? { background: TH.accent, color: '#fff' } : { background: TH.panel, border: `1px solid ${TH.border}`, color: TH.text }}>%</button>
              {compares.map((c) => (
                <span key={c.symbol} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span style={{ color: TH.text }}>{c.symbol}</span>
                  {cmpVals[c.symbol] && <span className="tabular-nums" style={{ color: TH.textStrong }}>{fmtPrice(c.symbol, cmpVals[c.symbol].last)}</span>}
                  {cmpVals[c.symbol] && cmpVals[c.symbol].pct != null && <span className="tabular-nums" style={{ color: cmpVals[c.symbol].pct >= 0 ? TH.up : TH.down }}>{cmpVals[c.symbol].pct >= 0 ? '+' : ''}{cmpVals[c.symbol].pct.toFixed(2)}%</span>}
                  <button onClick={() => removeCompare(c.symbol)} className="opacity-60 hover:opacity-100 hover:text-red-400"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          <div className="relative flex-1 min-h-0"
               style={compact ? { touchAction: 'none', overscrollBehavior: 'none' } : undefined}
               onDoubleClick={(e) => {
                 // دابل‌کلیک روی محورِ قیمت → بازنشانیِ auto-scale؛ روی محورِ زمان → fitContent (مثلِ TradingView)
                 const rect = e.currentTarget.getBoundingClientRect();
                 const onScale = (rect.right - e.clientX) <= 64;
                 const onTime = !onScale && (rect.bottom - e.clientY) <= 30;
                 if (onScale) { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); setScaleLocked(false); } catch (err) {} }
                 else if (onTime) { try { chartRef.current.timeScale().fitContent(); } catch (err) {} }
               }}
               onContextMenu={(e) => {
                 e.preventDefault();
                 const rect = e.currentTarget.getBoundingClientRect();
                 const yy = e.clientY - rect.top;
                 let price = null; try { price = priceSeriesRef.current && priceSeriesRef.current.coordinateToPrice(yy); } catch (err) {}
                 const onScale = (rect.right - e.clientX) <= 64; // راست‌کلیک روی ناحیهٔ محورِ قیمت (سمتِ راست)
                 const onTime = !onScale && (rect.bottom - e.clientY) <= 30; // راست‌کلیک روی ناحیهٔ محورِ زمان (پایین)
                 setCtxMenu({ x: e.clientX - rect.left, y: yy, price, onScale, onTime });
               }}>
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
                    <table key={ti} className="text-[11px] rounded-lg overflow-hidden border shadow-lg" style={{ borderColor: TH.border, background: TH.popoverBg }}>
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
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-lg border shadow-xl px-2 py-1.5 text-xs" style={{ borderColor: TH.border, background: TH.popoverBg }} dir="rtl">
                  <span className="font-bold opacity-70">{d.name || DrawingLayer.label(d.type)}</span>
                  <input type="color" value={d.color || '#3b82f6'} onChange={(e) => { drawRef.current.setStyle(selDraw, { color: e.target.value }); treeRefresh(); }} title="رنگ" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                  <div className="flex items-center gap-0.5 tabular-nums" title="ضخامت">{[1, 2, 3, 4].map((w) => (<button key={w} onClick={() => { drawRef.current.setStyle(selDraw, { width: w }); treeRefresh(); }} className={`w-5 rounded transition-colors duration-[120ms] ${Math.round(d.width || 2) === w ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={Math.round(d.width || 2) === w ? { background: TH.accent } : {}}>{w}</button>))}</div>
                  {(() => { const cur = d.lineStyle != null ? d.lineStyle : (d.dashed ? 2 : 0); const nextMap = { 0: 2, 2: 1, 1: 0 }; const glyph = { 0: '─', 2: '┄', 1: '⋯' }; return (
                    <button onClick={() => { const nx = nextMap[cur]; drawRef.current.setStyle(selDraw, { lineStyle: nx, dashed: nx === 2 }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded transition-colors duration-[120ms] ${cur !== 0 ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={cur !== 0 ? { background: TH.accent } : {}} title="سبکِ خط: توپر → خط‌چین → نقطه‌ای">{glyph[cur]}</button>
                  ); })()}
                  <button onClick={() => { setDrawColor(d.color || drawColor); setDrawWidth(Math.round(d.width || 2)); setDrawDashed(!!d.dashed); }} className="opacity-60 hover:opacity-100" title="تنظیم به‌عنوانِ استایلِ پیش‌فرضِ ترسیم‌های بعدی (Save as default)"><Star size={13} /></button>
                  <span className="w-px h-4 opacity-30" style={{ background: TH.border }} />
                  <button onClick={() => { drawRef.current.cloneSelected(); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="تکثیر (Duplicate)"><Copy size={13} /></button>
                  <button onClick={() => { drawRef.current.bringToFront(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="آوردن به جلو"><ChevronUp size={13} /></button>
                  <button onClick={() => { drawRef.current.sendToBack(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="بردن به عقب"><ChevronDown size={13} /></button>
                  {d.type === 'rect' && (
                    <button onClick={() => { drawRef.current.setStyle(selDraw, { noFill: !d.noFill }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded text-[11px] transition-colors duration-[120ms] ${!d.noFill ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={!d.noFill ? { background: TH.accent } : {}} title="پُرشدگیِ مستطیل (Fill)">▩</button>
                  )}
                  {d.type === 'fib' && (
                    <button onClick={() => { drawRef.current.setStyle(selDraw, { reverse: !d.reverse }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded text-[11px] transition-colors duration-[120ms] ${d.reverse ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.reverse ? { background: TH.accent } : {}} title="معکوس‌کردنِ فیبوناچی (جابه‌جاییِ ۰٪/۱۰۰٪)">⇅</button>
                  )}
                  {d.type === 'text' && (<>
                    <button onClick={() => { const sizes = [12, 14, 18, 24, 32]; const cur = d.fontSize || 14; const next = sizes[(sizes.indexOf(cur) + 1) % sizes.length] || 14; drawRef.current.setStyle(selDraw, { fontSize: next }); treeRefresh(); }} className="px-1.5 py-0.5 rounded opacity-70 hover:opacity-100 flex items-center gap-0.5" title="اندازهٔ فونت"><Type size={12} /><span className="text-[10px] tabular-nums">{d.fontSize || 14}</span></button>
                    <button onClick={() => { drawRef.current.setStyle(selDraw, { bold: !d.bold }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded text-[12px] font-black transition-colors duration-[120ms] ${d.bold ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.bold ? { background: TH.accent } : {}} title="پررنگ (Bold)">B</button>
                    <button onClick={() => { drawRef.current.setStyle(selDraw, { italic: !d.italic }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded text-[12px] italic transition-colors duration-[120ms] ${d.italic ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.italic ? { background: TH.accent } : {}} title="کج (Italic)">I</button>
                    <button onClick={() => { drawRef.current.setStyle(selDraw, { textBg: !d.textBg }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded text-[11px] transition-colors duration-[120ms] ${d.textBg ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.textBg ? { background: TH.accent } : {}} title="پس‌زمینهٔ متن">▩</button>
                  </>)}
                  {d.type === 'trend' && (
                    <>
                      <button onClick={() => { drawRef.current.setStyle(selDraw, { extendLeft: !d.extendLeft }); treeRefresh(); }} className={`px-1 rounded transition-colors duration-[120ms] ${d.extendLeft ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.extendLeft ? { background: TH.accent } : {}} title="امتداد به چپ"><ChevronLeft size={13} /></button>
                      <button onClick={() => { drawRef.current.setStyle(selDraw, { extendRight: !d.extendRight }); treeRefresh(); }} className={`px-1 rounded transition-colors duration-[120ms] ${d.extendRight ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.extendRight ? { background: TH.accent } : {}} title="امتداد به راست"><ChevronRight size={13} /></button>
                      <button onClick={() => { drawRef.current.setStyle(selDraw, { arrowEnd: !d.arrowEnd }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded text-[11px] transition-colors duration-[120ms] ${d.arrowEnd ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.arrowEnd ? { background: TH.accent } : {}} title="پیکان در انتها">➤</button>
                    </>
                  )}
                  <button onClick={() => { drawRef.current.toggleVisible(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="نمایش/پنهان">{d.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  <button onClick={() => { drawRef.current.toggleLock(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="قفل">{d.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                  {d.type === 'hline' && d.p != null && (
                    <button onClick={() => { setAlForm((f) => ({ ...f, op: 'above', value: fmtPrice(symbol, d.p) })); setRightTab('alerts'); setShowRight(true); }} className="opacity-70 hover:opacity-100" title={`افزودنِ آلارم روی این خط (${fmtPrice(symbol, d.p)})`} style={{ color: '#f59e0b' }}><Bell size={13} /></button>
                  )}
                  <button onClick={() => { drawRef.current.removeAt(selDraw); treeRefresh(); }} className="opacity-60 hover:text-red-400" title="حذف"><Trash2 size={13} /></button>
                </div>
              );
            })()}
            {/* «تایپِ بازهٔ زمانی» — پاپ‌آورِ ورودیِ بازه (مثلِ TradingView؛ با فشارِ رقم باز می‌شود) */}
            {tfQuick != null && (() => {
              const code = parseIntervalToTf(tfQuick); const okv = !!(code && TFS.includes(code));
              return (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-lg pc-pop px-3 py-2 text-sm" style={{ background: TH.panel, border: `1px solid ${okv ? TH.accent : TH.border}` }} dir="ltr">
                  <span className="text-xs" style={{ color: TH.text, opacity: 0.7 }}>بازهٔ زمانی</span>
                  <input autoFocus value={tfQuick} onChange={(e) => setTfQuick(e.target.value)} onBlur={() => setTfQuick(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { if (okv) { setTf(code); setTfQuick(null); } } else if (e.key === 'Escape') { setTfQuick(null); } }}
                    placeholder="15 · 1h · 1d" className="w-24 bg-transparent outline-none tabular-nums" style={{ color: TH.textStrong }} />
                  <span className="text-[11px] tabular-nums" style={{ color: okv ? TH.up : TH.text, opacity: okv ? 1 : 0.4 }}>{okv ? (TF_LABEL[code] || code) : '—'}</span>
                </div>
              );
            })()}
            {/* درختِ آبجکت‌ها (Object Tree) */}
            {showTree && (
              <div className="absolute top-2 left-2 z-30 w-56 rounded-lg border shadow-xl overflow-hidden" style={{ borderColor: TH.border, background: TH.popoverBg }} dir="rtl">
                <div className="flex items-center justify-between px-2 py-1.5 border-b text-xs font-bold" style={{ borderColor: TH.border }}>
                  <span className="flex items-center gap-1"><List size={13} /> آبجکت‌ها ({drawList.length})</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setDrawingsHidden((v) => !v)} title={drawingsHidden ? 'نمایشِ همه' : 'پنهان‌کردنِ همه'} className={drawingsHidden ? 'text-white rounded px-0.5' : 'opacity-60 hover:opacity-100'} style={drawingsHidden ? { background: TH.accent } : {}}>{drawingsHidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                    <button onClick={() => setDrawingsLocked((v) => !v)} title={drawingsLocked ? 'بازکردنِ قفلِ همه' : 'قفلِ همه'} className={drawingsLocked ? 'text-white rounded px-0.5' : 'opacity-60 hover:opacity-100'} style={drawingsLocked ? { background: TH.accent } : {}}>{drawingsLocked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                    <button onClick={() => { drawRef.current.clearAll(); treeRefresh(); }} title="حذفِ همه" className="opacity-60 hover:text-red-400"><Trash2 size={13} /></button>
                    <button onClick={() => setShowTree(false)} className="opacity-60 hover:opacity-100"><X size={13} /></button>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto text-xs">
                  {/* بخشِ اندیکاتورها — مثلِ Object Tree تریدینگ‌ویو که اندیکاتورها را هم به‌عنوان لایه نشان می‌دهد */}
                  {legendItems.length > 0 && (
                    <>
                      <button onClick={() => setTreeIndsCol((v) => !v)} className="w-full px-2 py-1 text-[10px] font-bold opacity-60 hover:opacity-100 flex items-center gap-1 border-b" style={{ borderColor: TH.border }}>{treeIndsCol ? <ChevronLeft size={11} /> : <ChevronDown size={11} />}<Activity size={11} /> اندیکاتورها ({legendItems.length})</button>
                      {!treeIndsCol && legendItems.map((it) => {
                        const scopeItems = legendItems.filter((x) => x.scope === it.scope); const si = scopeItems.findIndex((x) => x.id === it.id);
                        return (
                        <div key={it.id} className="flex items-center gap-1.5 px-2 py-1 border-b hover:bg-black/5" style={{ borderColor: TH.border }}>
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: it.color }} />
                          <span className={`flex-1 truncate ${it.visible === false ? 'opacity-40 line-through' : ''}`}>{it.label}</span>
                          <button onClick={() => moveInd(it.scope, it.id, -1)} disabled={si === 0} title="بالاتر" className="opacity-50 hover:opacity-100 disabled:opacity-15"><ChevronUp size={12} /></button>
                          <button onClick={() => moveInd(it.scope, it.id, 1)} disabled={si === scopeItems.length - 1} title="پایین‌تر" className="opacity-50 hover:opacity-100 disabled:opacity-15"><ChevronDown size={12} /></button>
                          <button onClick={() => toggleIndVisible(it)} title="نمایش/پنهان" className="opacity-50 hover:opacity-100">{it.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                          <button onClick={() => setEditInd({ scope: it.scope, id: it.id })} title="تنظیمات" className="opacity-50 hover:opacity-100"><Settings2 size={12} /></button>
                          <button onClick={() => rmInd(it.scope, it.id)} title="حذف" className="opacity-50 hover:text-red-400"><X size={12} /></button>
                        </div>
                        );
                      })}
                      <button onClick={() => setTreeDrawsCol((v) => !v)} className="w-full px-2 py-1 text-[10px] font-bold opacity-60 hover:opacity-100 flex items-center gap-1 border-b" style={{ borderColor: TH.border }}>{treeDrawsCol ? <ChevronLeft size={11} /> : <ChevronDown size={11} />}<List size={11} /> ترسیم‌ها ({drawList.length})</button>
                    </>
                  )}
                  {!treeDrawsCol && drawList.length === 0 && <div className="px-3 py-3 opacity-40 text-center">ترسیمی نیست</div>}
                  {!treeDrawsCol && drawList.map((d, i) => (
                    <div key={i} className={`flex items-center gap-1.5 px-2 py-1 border-b cursor-pointer transition-colors duration-[120ms] ${selDraw === i ? '' : 'hover:bg-black/5'}`} style={selDraw === i ? { borderColor: TH.border, background: TH.chipBgHover } : { borderColor: TH.border }} onClick={() => { setTool('select'); drawRef.current.selectAt(i); }}
                      onDoubleClick={(e) => { e.stopPropagation(); const cur = d.name || DrawingLayer.label(d.type); const nm = window.prompt('نامِ آبجکت:', cur); if (nm != null) { drawRef.current.setStyle(i, { name: nm.trim() || undefined }); treeRefresh(); } }}>
                      <input type="color" value={d.color || '#3b82f6'} onClick={(e) => e.stopPropagation()} onChange={(e) => { drawRef.current.setStyle(i, { color: e.target.value }); treeRefresh(); }} title="تغییرِ رنگ" className="w-3 h-3 rounded-sm shrink-0 cursor-pointer bg-transparent border-0 p-0" />
                      <span className={`flex-1 truncate ${d.visible === false ? 'opacity-40 line-through' : ''}`} title="دابل‌کلیک برای تغییرِ نام">{d.name || (DrawingLayer.label(d.type) + (d.text ? `: ${d.text}` : ''))}</span>
                      <button onClick={(e) => { e.stopPropagation(); const at = (d.p0 && d.p0.t) ?? d.t ?? (d.pts && d.pts[0] && d.pts[0].t) ?? (d.p1 && d.p1.t); if (at != null) { try { const cs = candlesRef.current; let idx = 0, best = Infinity; for (let j = 0; j < cs.length; j++) { const dd = Math.abs(cs[j].t - at); if (dd < best) { best = dd; idx = j; } } chartRef.current.timeScale().setVisibleLogicalRange({ from: Math.max(0, idx - 40), to: idx + 40 }); } catch (er) {} } }} title="برو به این آبجکت روی چارت" className="opacity-50 hover:opacity-100"><Crosshair size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.reorder(i, i + 1); treeRefresh(); }} disabled={i === drawList.length - 1} title="یک لایه جلوتر" className="opacity-50 hover:opacity-100 disabled:opacity-15"><ChevronUp size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.reorder(i, i - 1); treeRefresh(); }} disabled={i === 0} title="یک لایه عقب‌تر" className="opacity-50 hover:opacity-100 disabled:opacity-15"><ChevronDown size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.toggleVisible(i); treeRefresh(); }} title="نمایش/پنهان" className="opacity-50 hover:opacity-100">{d.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.toggleLock(i); treeRefresh(); }} title="قفل" className="opacity-50 hover:opacity-100">{d.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.removeAt(i); treeRefresh(); }} title="حذف" className="opacity-50 hover:text-red-400"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* شمارشِ معکوسِ بسته‌شدنِ کندل + وضعیتِ بازار */}
            {showCountdown && !replay.on && <CountdownChip countdown={countdown} countdownColor={countdownColor} TH={TH} marketOpen={marketOpen} frac={countdownFrac} />}
            <Watermark src={bnLogo} theme={theme} />
            {/* دکمه‌های سریعِ گوشهٔ محورِ قیمت (Auto / Log / %) — المانِ آیکونیکِ TradingView */}
            {(() => {
              const btn = (active, label, title, onClick) => (
                <button title={title} onClick={onClick}
                  className="w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold leading-none transition-colors duration-[120ms]"
                  style={active ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text, opacity: 0.85 }}>{label}</button>
              );
              const pctForced = cmpPercent && compares.length > 0;
              return (
                <div className="absolute z-20 flex flex-col gap-0.5" style={{ bottom: 30, right: 4 }} dir="ltr" title="مقیاسِ محورِ قیمت">
                  {btn(!scaleLocked, 'A', 'اتو-اسکیل (Auto)', () => { setScaleLocked(false); try { chartRef.current.priceScale('right').applyOptions({ autoScale: true }); } catch (e) {} })}
                  {btn(scaleMode === 1 && !pctForced, 'L', 'مقیاسِ لگاریتمی (Log)', () => setScaleMode((m) => (m === 1 ? 0 : 1)))}
                  {btn(scaleMode === 2 || pctForced, '%', 'مقیاسِ درصدی (Percent)', () => setScaleMode((m) => (m === 2 ? 0 : 2)))}
                </div>
              );
            })()}
            {/* Data Window — مقادیرِ زیرِ کراس‌هیر (مثلِ TradingView) */}
            {showDataWin && (
              <div className="absolute top-12 left-3 z-30 w-52 rounded-lg pc-pop text-[11px] overflow-hidden" dir="rtl"
                   style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b" style={{ borderColor: TH.border }}>
                  <span className="font-semibold flex items-center gap-1.5" style={{ color: TH.textStrong }}><SymbolLogo symbol={symbol} size={14} /><span dir="ltr">{symbol}</span></span>
                  <div className="flex items-center gap-1">
                    {dataWin && dataWin.ohlc && (
                      <button onClick={() => { try { const o = dataWin.ohlc; const rng = (o.high != null && o.low != null) ? ` R:${fmtPrice(symbol, o.high - o.low)}` : ''; const vv = dataWin.vol ? ` V:${fmtVol(dataWin.vol)}` : ''; const txt = `${symbol} O:${fmtPrice(symbol, o.open)} H:${fmtPrice(symbol, o.high)} L:${fmtPrice(symbol, o.low)} C:${fmtPrice(symbol, o.close)}${dataWin.pct != null ? ` (${dataWin.pct >= 0 ? '+' : ''}${dataWin.pct.toFixed(2)}%)` : ''}${rng}${vv}`; navigator.clipboard.writeText(txt); } catch (e) {} }} className="pc-iconbtn w-5 h-5" title="کپیِ مقادیر"><Copy size={11} /></button>
                    )}
                    <button onClick={() => setShowDataWin(false)} className="pc-iconbtn w-5 h-5" title="بستن"><X size={12} /></button>
                  </div>
                </div>
                <div className="px-2.5 py-1.5 tabular-nums" style={{ color: TH.text }}>
                  {dataWin && dataWin.ohlc ? (
                    <>
                      {dataWin.time != null && (
                        <div className="flex justify-between mb-1 opacity-60 text-[10px]"><span>زمان</span>
                          <span dir="ltr">{(() => { try { return new Date(dataWin.time * 1000).toLocaleString('en-GB', { timeZone: tz, year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return new Date(dataWin.time * 1000).toLocaleString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } })()}</span></div>
                      )}
                      {['open', 'high', 'low', 'close'].map((k) => (
                        <div key={k} className="flex justify-between"><span>{({ open: 'O', high: 'H', low: 'L', close: 'C' })[k]}</span>
                          <span dir="ltr" style={{ color: dataWin.ohlc.close >= dataWin.ohlc.open ? TH.up : TH.down }}>{fmtPrice(symbol, dataWin.ohlc[k])}</span></div>
                      ))}
                      {dataWin.change != null && (
                        <div className="flex justify-between"><span>تغییر</span>
                          <span dir="ltr" style={{ color: dataWin.change >= 0 ? TH.up : TH.down }}>{(dataWin.change >= 0 ? '+' : '') + fmtPrice(symbol, dataWin.change)}{dataWin.pct != null ? ` (${dataWin.change >= 0 ? '+' : ''}${dataWin.pct.toFixed(2)}%)` : ''}</span></div>
                      )}
                      {dataWin.ohlc.high != null && dataWin.ohlc.low != null && (() => {
                        const rng = dataWin.ohlc.high - dataWin.ohlc.low; const dig = priceDigits(symbol);
                        const pip = dig >= 3 ? Math.round(rng / Math.pow(10, -(dig - 1))) : null;
                        return (
                          <div className="flex justify-between"><span>دامنه</span>
                            <span dir="ltr" style={{ color: TH.text }}>{fmtPrice(symbol, rng)}{pip != null ? ` · ${pip}pip` : ''}{dataWin.ohlc.low ? ` (${((rng / dataWin.ohlc.low) * 100).toFixed(2)}%)` : ''}</span></div>
                        );
                      })()}
                      {dataWin.vol != null && (
                        <div className="flex justify-between"><span>حجم</span>
                          <span dir="ltr" style={{ color: TH.textStrong }}>{fmtVol(dataWin.vol)}</span></div>
                      )}
                      {dataWin.inds && dataWin.inds.length > 0 && <div className="my-1 border-t" style={{ borderColor: TH.border }} />}
                      {(dataWin.inds || []).map((ind, i) => (
                        <div key={i} className="flex justify-between gap-2">
                          <span className="truncate" style={{ color: ind.color }}>{ind.label}</span>
                          <span dir="ltr" style={{ color: TH.textStrong }}>{ind.vals.map((v) => fmtPrice(symbol, v)).join(' / ')}</span>
                        </div>
                      ))}
                      {dataWin.cmps && dataWin.cmps.length > 0 && <div className="my-1 border-t" style={{ borderColor: TH.border }} />}
                      {(dataWin.cmps || []).map((cm, i) => (
                        <div key={i} className="flex justify-between gap-2">
                          <span className="truncate flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full" style={{ background: cm.color }} />{cm.symbol}</span>
                          <span dir="ltr" className="flex items-center gap-1.5">
                            <span style={{ color: TH.textStrong }}>{fmtPrice(cm.symbol, cm.val)}</span>
                            {cm.pct != null && <span style={{ color: cm.pct >= 0 ? TH.up : TH.down }}>{cm.pct >= 0 ? '+' : ''}{cm.pct.toFixed(2)}%</span>}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : <div className="opacity-50 text-center py-1">نشانگر را روی چارت ببر</div>}
                </div>
              </div>
            )}
            {/* هشدارِ درون‌مرورگریِ آلارم (توست) */}
            {alertToast && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-lg pc-pop text-[12px] font-semibold" dir="rtl"
                style={{ background: TH.panel, border: `1px solid ${TH.accent}`, color: TH.textStrong, boxShadow: '0 6px 22px -6px rgba(0,0,0,.5)' }}>
                <Bell size={14} style={{ color: TH.accent }} />
                <span>{alertToast.msg}</span>
                <button onClick={() => setAlertToast(null)} className="opacity-60 hover:opacity-100"><X size={12} /></button>
              </div>
            )}
            {/* منوی راست‌کلیکِ چارت (مثلِ TradingView) */}
            {ctxMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
                <div className="absolute z-50 w-52 rounded-md pc-pop py-1 text-[12px]" dir="rtl"
                     style={{ left: ctxMenu.x, top: ctxMenu.y, background: TH.panel, border: `1px solid ${TH.border}`, color: TH.textStrong }}>
                  {/* راست‌کلیک روی محورِ قیمت → گزینه‌های مقیاس (مثلِ TradingView) */}
                  {ctxMenu.onScale && (
                    <>
                      <div className="px-3 pt-1 pb-1 text-[10px] font-bold opacity-45">مقیاسِ قیمت</div>
                      {[{ v: 0, l: 'عادی (خطی)' }, { v: 1, l: 'لگاریتمی' }, { v: 2, l: 'درصدی' }].map((o) => (
                        <button key={o.v} className="w-full text-right px-3 py-1.5 flex items-center justify-between" style={{ color: TH.textStrong }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          onClick={() => { setScaleMode(o.v); setCtxMenu(null); }}><span>{o.l}</span>{scaleMode === o.v && <span style={{ color: TH.accent }}>✓</span>}</button>
                      ))}
                      <button className="w-full text-right px-3 py-1.5 flex items-center justify-between" style={{ color: TH.textStrong }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { setScaleInvert((v) => !v); setCtxMenu(null); }}><span>وارونه‌کردنِ محور</span>{scaleInvert && <span style={{ color: TH.accent }}>✓</span>}</button>
                      <button className="w-full text-right px-3 py-1.5 flex items-center justify-between" style={{ color: TH.textStrong }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { setScaleLocked((v) => !v); setCtxMenu(null); }}><span>قفلِ مقیاس (اتو خاموش)</span>{scaleLocked && <span style={{ color: TH.accent }}>✓</span>}</button>
                      <button className="w-full text-right px-3 py-1.5 flex items-center justify-between" style={{ color: TH.textStrong }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { setShowPriceLine((v) => !v); setCtxMenu(null); }}><span>خطِ آخرین قیمت</span>{showPriceLine && <span style={{ color: TH.accent }}>✓</span>}</button>
                      <button className="w-full text-right px-3 py-1.5 flex items-center justify-between" style={{ color: TH.textStrong }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { setShowCountdown((v) => !v); setCtxMenu(null); }}><span>شمارشِ معکوسِ کندل</span>{showCountdown && <span style={{ color: TH.accent }}>✓</span>}</button>
                      <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); setScaleLocked(false); setScaleInvert(false); } catch (e) {} setCtxMenu(null); }}><Scaling size={13} /> بازنشانیِ مقیاس (اتوفیت)</button>
                      <div className="my-1 border-t" style={{ borderColor: TH.border }} />
                    </>
                  )}
                  {/* راست‌کلیک روی محورِ زمان → گزینه‌های مقیاسِ زمان (مثلِ TradingView) */}
                  {ctxMenu.onTime && (
                    <>
                      <div className="px-3 pt-1 pb-1 text-[10px] font-bold opacity-45">مقیاسِ زمان</div>
                      <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { try { chartRef.current.timeScale().fitContent(); } catch (e) {} setCtxMenu(null); }}><Scaling size={13} /> بازنشانیِ مقیاسِ زمان (جا‌دادنِ همه)</button>
                      <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { try { chartRef.current.timeScale().scrollToRealTime(); } catch (e) {} setCtxMenu(null); }}><Play size={13} /> پرش به جدیدترین (لحظهٔ حال)</button>
                      <div className="my-1 border-t" style={{ borderColor: TH.border }} />
                    </>
                  )}
                  {ctxMenu.price != null && (
                    <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => { setAlForm((f) => ({ ...f, op: 'above', value: fmtPrice(symbol, ctxMenu.price) })); setRightTab('alerts'); setShowRight(true); setCtxMenu(null); }}>
                      <Bell size={13} /> افزودنِ آلارم در {fmtPrice(symbol, ctxMenu.price)}
                    </button>
                  )}
                  {ctxMenu.price != null && (
                    <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => { try { navigator.clipboard.writeText(fmtPrice(symbol, ctxMenu.price)); } catch (e) {} setCtxMenu(null); }}>
                      <Copy size={13} /> کپیِ قیمت {fmtPrice(symbol, ctxMenu.price)}
                    </button>
                  )}
                  {/* افزودنِ خطِ افقی در این قیمت (مثلِ TradingView) */}
                  {ctxMenu.price != null && (
                    <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => { try { drawRef.current && drawRef.current.addDrawing({ type: 'hline', p: ctxMenu.price, color: drawColor, width: drawWidth, dashed: drawDashed }); treeRefresh(); } catch (e) {} setCtxMenu(null); }}>
                      <Minus size={13} /> افزودنِ خطِ افقی در {fmtPrice(symbol, ctxMenu.price)}
                    </button>
                  )}
                  {/* افزودنِ خطِ عمودی روی این زمان (مثلِ TradingView) */}
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { try { const t = chartRef.current.timeScale().coordinateToTime(ctxMenu.x); if (t != null && drawRef.current) { drawRef.current.addDrawing({ type: 'vline', t, color: drawColor, width: drawWidth, dashed: drawDashed }); treeRefresh(); } } catch (e) {} setCtxMenu(null); }}>
                    <Minus size={13} className="rotate-90" /> افزودنِ خطِ عمودی اینجا
                  </button>
                  {/* افزودنِ یادداشتِ متنی اینجا */}
                  {ctxMenu.price != null && (
                    <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => { try { const t = chartRef.current.timeScale().coordinateToTime(ctxMenu.x); const txt = window.prompt('متنِ یادداشت:'); if (txt && t != null && drawRef.current) { drawRef.current.addDrawing({ type: 'text', t, p: ctxMenu.price, text: txt, color: drawColor }); treeRefresh(); } } catch (e) {} setCtxMenu(null); }}>
                      <Type size={13} /> افزودنِ یادداشتِ متنی اینجا
                    </button>
                  )}
                  {/* شروعِ بازپخش از این کندل (مثلِ TradingView) */}
                  {!replay.on && (
                    <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => { let t = null; try { t = chartRef.current.timeScale().coordinateToTime(ctxMenu.x); } catch (e) {} enterReplay(Number.isFinite(t) ? t : null); setCtxMenu(null); }}>
                      <Play size={13} /> شروعِ بازپخش از اینجا
                    </button>
                  )}
                  {/* بازنشانیِ نما (اتوفیت) — همیشه در دسترس */}
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); } catch (e) {} setCtxMenu(null); }}>
                    <Scaling size={13} /> بازنشانیِ نما (اتوفیت)
                  </button>
                  {/* گزینه‌های عمومی مثلِ منوی راست‌کلیکِ TradingView */}
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { setIndMenu(true); setCtxMenu(null); }}>
                    <Activity size={13} /> افزودنِ اندیکاتور…
                  </button>
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { setCfgOpen(true); setCtxMenu(null); }}>
                    <Settings2 size={13} /> تنظیماتِ چارت…
                  </button>
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { setCtxMenu(null); resetChart(); }}>
                    <Trash2 size={13} /> بازنشانیِ چارت (پاکِ اندیکاتور/ترسیم/مقایسه)
                  </button>
                  {ctxMenu.price != null && (
                    <>
                      <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold opacity-45" style={{ color: TH.text }}>موقعیت از {fmtPrice(symbol, ctxMenu.price)} (رسمِ رو‌به‌جلو)</div>
                      <button className="w-full text-right px-3 py-2 flex items-center gap-2 font-semibold" style={{ color: TH.up }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = (TH.up || '#26a69a') + '1f')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { placeLongShort('buy', ctxMenu.price, ctxMenu.x); setCtxMenu(null); }}>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded" style={{ background: (TH.up || '#26a69a') + '2a', color: TH.up }}><TrendingUp size={12} /></span>
                        لانگ <span className="opacity-55 font-normal text-[11px]">(Long / خرید)</span>
                      </button>
                      <button className="w-full text-right px-3 py-2 flex items-center gap-2 font-semibold" style={{ color: TH.down }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = (TH.down || '#ef5350') + '1f')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { placeLongShort('sell', ctxMenu.price, ctxMenu.x); setCtxMenu(null); }}>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded" style={{ background: (TH.down || '#ef5350') + '2a', color: TH.down }}><TrendingDown size={12} /></span>
                        شورت <span className="opacity-55 font-normal text-[11px]">(Short / فروش)</span>
                      </button>
                      {/* #۹ ترید واقعی (پنلِ سفارش) + پاک‌کردنِ ترسیم‌ها */}
                      <button className="w-full text-right px-3 py-1.5 flex items-center gap-2 opacity-80" style={{ color: TH.textStrong }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { startTrade('buy', ctxMenu.price); setCtxMenu(null); }}><Activity size={13} /> ترید واقعی (پنلِ سفارش)</button>
                      <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.down }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => { try { drawRef.current && drawRef.current.clearAll(); } catch (e) {} setOrder(null); treeRefresh(); setCtxMenu(null); }}><Trash2 size={13} /> پاک‌کردنِ ترسیم‌ها/موقعیت‌ها</button>
                      <div className="my-1 border-t" style={{ borderColor: TH.border }} />
                    </>
                  )}
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { setShowDataWin(true); setCtxMenu(null); }}><Table2 size={13} /> پنجرهٔ داده</button>
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); } catch (e) {} setCtxMenu(null); }}>بازنشانیِ مقیاس</button>
                  <button className="w-full text-right px-3 py-1.5 flex items-center gap-2" style={{ color: TH.textStrong }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    onClick={() => { try { rootRef.current.requestFullscreen(); } catch (e) {} setCtxMenu(null); }}><Maximize2 size={13} /> تمام‌صفحه</button>
                </div>
              </>
            )}
            {grid > 1 && (
              <div className="absolute inset-0 z-30 grid gap-1 p-1" style={{ background: TH.bg, gridTemplateColumns: grid === 2 ? '1fr 1fr' : '1fr 1fr', gridTemplateRows: grid === 2 ? '1fr' : '1fr 1fr' }}>
                {Array.from({ length: grid }).map((_, i) => (
                  <MiniChart key={i} symbols={symbols} tf={tf} initial={i === 0 ? symbol : (watch[i] || symbols[i] || symbol)} syncBus={syncBusRef.current} />
                ))}
              </div>
            )}
            <ReplayBar replay={replay} TH={TH} replayStepBack={replayStepBack} replayToggle={replayToggle} replayStep={replayStep} replaySeek={replaySeek} replaySetSpeed={replaySetSpeed} exitReplay={exitReplay} />
          </div>
          <div ref={subWrapRef} />
        </div>

        {/* پنلِ راست — در دسکتاپ ستونیِ درون‌جریان؛ در تبلت/گوشی به‌صورتِ overlayِ شناور (روی چارت نمی‌افتد، فضای افقی نمی‌خورد) */}
        {showRight && (
          overlayPanels ? (
            <div className="absolute inset-0 z-[55] flex" dir="ltr" style={{ pointerEvents: 'none' }}>
              {/* بک‌دراپ برای بستن با لمس */}
              <div className="absolute inset-0" style={{ background: TH.overlayMask || 'rgba(0,0,0,.42)', backdropFilter: 'blur(1px)', pointerEvents: 'auto' }} onClick={() => setShowRight(false)} />
              {/* پنل: در RTL سمتِ راست می‌چسبد، عرضِ امن، ارتفاعِ کامل با اسکرولِ داخلی */}
              <div className="ml-auto h-full shrink-0 shadow-2xl" style={{ pointerEvents: 'auto', width: 'min(86vw, 320px)' }}>
                <RightPanel
                  TH={TH} rightTab={rightTab} setRightTab={setRightTab}
                  symbol={symbol} setSymbol={setSymbol} symbols={symbols} live={live} tf={tf}
                  watch={watch} toggleWatch={toggleWatch} fmtPrice={fmtPrice}
                  aiBusy={aiBusy} aiQuota={aiQuota} aiList={aiList} aiSig={aiSig}
                  getAiSignal={getAiSignal} gotoSignal={gotoSignal} deleteSignal={deleteSignal} clearAiSig={clearAiSig}
                  order={order} setOrder={setOrder} startTrade={startTrade} submitOrder={submitOrder} curPrice={curPrice} livePrice={livePrice} quickTrade={quickTrade}
                  overlays={overlays} subs={subs} alertCount={savedAlerts.length}
                />
              </div>
            </div>
          ) : (
            <RightPanel
              TH={TH} rightTab={rightTab} setRightTab={setRightTab}
              symbol={symbol} setSymbol={setSymbol} symbols={symbols} live={live} tf={tf}
              watch={watch} toggleWatch={toggleWatch} fmtPrice={fmtPrice}
              aiBusy={aiBusy} aiQuota={aiQuota} aiList={aiList} aiSig={aiSig}
              getAiSignal={getAiSignal} gotoSignal={gotoSignal} deleteSignal={deleteSignal} clearAiSig={clearAiSig}
              order={order} setOrder={setOrder} startTrade={startTrade} submitOrder={submitOrder} curPrice={curPrice} livePrice={livePrice} quickTrade={quickTrade}
              overlays={overlays} subs={subs} alertCount={savedAlerts.length}
              width={panelWidth} onWidthChange={setPanelWidth}
            />
          )
        )}

        {/* #۹ دستگیرهٔ کشوییِ مرئیِ پنلِ راست (دسکتاپ): وقتی پنل بسته است، یک تبِ باریکِ لبه که با کلیک کشو را باز می‌کند */}
        {!showRight && !compact && (
          <button
            onClick={() => setShowRight(true)}
            title="بازکردنِ نوارِ کناری (واچ‌لیست، سیگنال AI، اسکنر، ترید، آلارم)"
            aria-label="بازکردنِ نوارِ کناری"
            className="absolute z-[56] flex flex-col items-center justify-center gap-1.5 transition-all duration-150"
            style={{
              top: '50%', right: 0, transform: 'translateY(-50%)',
              width: 22, paddingTop: 14, paddingBottom: 14,
              background: TH.panel || TH.chipBg, color: TH.textStrong,
              border: `1px solid ${TH.border}`, borderRight: 'none',
              borderTopLeftRadius: 10, borderBottomLeftRadius: 10,
              boxShadow: '-2px 0 10px rgba(0,0,0,.18)', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = TH.accent; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = TH.panel || TH.chipBg; e.currentTarget.style.color = TH.textStrong; }}
          >
            <ChevronDown size={15} style={{ transform: 'rotate(90deg)' }} />
            <span style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>پنل</span>
          </button>
        )}
      </div>

      {/* استودیوی نمااسکریپت */}
      {editorOpen && (
        <BottomDock
          TH={TH}
          storageKey="bn_dock"
          onClose={() => setEditorOpen(false)}
          tabs={[
            { key: 'editor', label: 'نمااسکریپت', node: (
        <div className="flex flex-col h-full">
          {/* نوارِ ابزار */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b text-xs flex-wrap" style={{ borderColor: TH.border }}>
            <Code2 size={14} className="text-purple-400" />
            <span className="font-bold text-purple-300">نمااسکریپت</span>
            <input value={scriptName} onChange={(e) => setScriptName(e.target.value)} className="rounded px-2 py-0.5 text-xs w-32 outline-none" style={{ background: TH.chipBg }} />
            <button onClick={onRun} className="flex items-center gap-1 px-2 py-1 rounded bg-green-600 text-white"><Play size={12} /> اجرا <kbd className="opacity-60">Ctrl+↵</kbd></button>
            <button onClick={onBacktest} className="flex items-center gap-1 px-2 py-1 rounded bg-amber-600 text-white"><FlaskConical size={12} /> بک‌تست</button>
            <button onClick={() => setBarMode((v) => !v)} title="حالتِ اجرا: برداری (سریع) یا بار-به-بار (سازگار با Pine)" style={{ background: barMode ? TH.accent : TH.chipBg, color: barMode ? '#fff' : TH.text, border: `1px solid ${TH.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 12 }} dir="ltr">{barMode ? 'Bar-by-bar' : 'Vectorized'}</button>
            <button onClick={onSaveScript} className="flex items-center gap-1 px-2 py-1 rounded" style={{ background: TH.chipBg }}><Save size={12} /> ذخیره</button>
            <button onClick={clearScreen} title="حذفِ خروجی‌های اسکریپت/سیگنال/سفارش از روی چارت" className="flex items-center gap-1 px-2 py-1 rounded text-red-400/90" style={{ background: TH.chipBg }}><Trash2 size={12} /> پاکِ صفحه</button>
            <select value="" onChange={(e) => { const ex = EXAMPLES[+e.target.value]; if (ex) loadExample(ex); }} className="rounded px-2 py-1 text-xs outline-none" style={{ background: TH.chipBg, color: TH.text }}><option value="">📚 نمونه‌ها…</option>{EXAMPLES.map((ex, i) => <option key={i} value={i}>{ex.name}</option>)}</select>
            <select value="" onChange={(e) => e.target.value && loadScript(e.target.value)} className="rounded px-2 py-1 text-xs outline-none" style={{ background: TH.chipBg, color: TH.text }}><option value="">اسکریپت‌های من…</option>{scripts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
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
                      <input value={btCost.comm} onChange={(e) => setBtCost((c) => ({ ...c, comm: e.target.value }))} dir="ltr" className="w-14 rounded px-1 py-0.5 outline-none" style={{ background: TH.chipBg }} />
                      <span className="opacity-60">اسلیپیج:</span>
                      <input value={btCost.slip} onChange={(e) => setBtCost((c) => ({ ...c, slip: e.target.value }))} dir="ltr" className="w-14 rounded px-1 py-0.5 outline-none" style={{ background: TH.chipBg }} />
                    </div>
                    {bt && (bt.err ? <div className="text-amber-400">{bt.err}</div> : (
                      <div className="rounded p-2" style={{ background: TH.subtle }}>
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
                          {(bt.list || []).slice().reverse().map((tr, i) => (<div key={i} onClick={() => { try { const cs = candlesRef.current; let idx = 0, best = Infinity; for (let j = 0; j < cs.length; j++) { const d = Math.abs(cs[j].t - tr.t); if (d < best) { best = d; idx = j; } } chartRef.current.timeScale().setVisibleLogicalRange({ from: Math.max(0, idx - 30), to: idx + 30 }); } catch (e) {} }} title="پرش به این معامله روی چارت" className="flex justify-between py-0.5 border-b cursor-pointer hover:bg-black/10 px-1 -mx-1 rounded" style={{ borderColor: TH.border }}><span className="opacity-50 flex items-center gap-1" dir="ltr">{tr.dir === 1 ? '🟢' : '🔴'} {new Date(tr.t * 1000).toLocaleDateString('fa-IR')}</span><b className={tr.r >= 0 ? 'text-green-400' : 'text-red-400'} dir="ltr">{tr.r >= 0 ? '+' : ''}{tr.r.toFixed(5)}</b></div>))}
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
                          : <input type="number" value={scInputs[inp.key] ?? inp.def} onChange={(e) => onInputChange(inp.key, inp.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))} className="w-20 rounded px-2 py-0.5 outline-none" style={{ background: TH.chipBg }} />}
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
            ) },
            { key: 'tester', label: 'تستِ استراتژی', node: <StrategyTesterTab TH={TH} /> },
            { key: 'notes', label: 'یادداشت‌ها', node: <NotesTab TH={TH} /> },
          ]}
        />
      )}

      {/* دیالوگِ تنظیماتِ ظاهرِ چارت (رنگِ کندل + شبکه) — مثلِ Chart Settings تریدینگ‌ویو */}
      {cfgOpen && (
        <>
          <div className="fixed inset-0 z-[60]" style={{ background: TH.overlayMask }} onClick={() => setCfgOpen(false)} />
          <div dir="rtl" className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 rounded-xl pc-pop overflow-hidden" style={{ background: TH.panel, border: `1px solid ${TH.border}`, color: TH.textStrong }}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: TH.border }}>
              <span className="font-semibold flex items-center gap-2"><Settings2 size={15} /> تنظیماتِ چارت</span>
              <button onClick={() => setCfgOpen(false)} className="pc-iconbtn w-6 h-6"><X size={14} /></button>
            </div>
            <div className="flex border-b text-xs" style={{ borderColor: TH.border }}>
              {[['appearance', 'ظاهر'], ['scales', 'نما و کراس‌هیر'], ['data', 'داده و چیدمان']].map(([id, label]) => (
                <button key={id} onClick={() => setCfgTab(id)} className="flex-1 py-2 font-semibold transition-colors duration-[120ms]" style={{ color: cfgTab === id ? TH.accent : TH.text, borderBottom: `2px solid ${cfgTab === id ? TH.accent : 'transparent'}` }}>{label}</button>
              ))}
            </div>
            <div className="px-4 py-3 text-[13px] space-y-3 max-h-[62vh] overflow-auto">
              {cfgTab === 'appearance' && (<>
              <div className="flex items-center justify-between">
                <span>رنگِ کندلِ صعودی</span>
                <input type="color" value={candleUp || TH.up} onChange={(e) => setCandleUp(e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
              </div>
              <div className="flex items-center justify-between">
                <span>رنگِ کندلِ نزولی</span>
                <input type="color" value={candleDn || TH.down} onChange={(e) => setCandleDn(e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
              </div>
              <div className="flex items-center justify-between">
                <span>رنگِ سایهٔ کندل</span>
                <div className="flex items-center gap-1">
                  {candleWick && <button onClick={() => setCandleWick('')} className="text-[10px] opacity-60 hover:opacity-100">پیش‌فرض</button>}
                  <input type="color" value={candleWick || TH.text} onChange={(e) => setCandleWick(e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>دقتِ اعشارِ قیمت</span>
                <select value={pricePrec} onChange={(e) => setPricePrec(e.target.value === 'auto' ? 'auto' : Number(e.target.value))} className="rounded px-1.5 py-1 text-xs outline-none" style={{ background: TH.chipBg, color: TH.text }}>
                  <option value="auto">خودکار</option>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n} رقم</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span>خطوطِ عمودیِ شبکه</span>
                <button onClick={() => setGridVert((v) => !v)} className="px-2 py-0.5 rounded text-xs" style={gridVert ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{gridVert ? 'روشن' : 'خاموش'}</button>
              </div>
              <div className="flex items-center justify-between">
                <span>خطوطِ افقیِ شبکه</span>
                <div className="flex items-center gap-1.5">
                  {(gridVert || gridHorz) && (<>
                    {gridColor && <button onClick={() => setGridColor('')} className="text-[10px] opacity-60 hover:opacity-100">پیش‌فرض</button>}
                    <input type="color" value={gridColor || TH.grid} onChange={(e) => setGridColor(e.target.value)} title="رنگِ خطوطِ شبکه" className="w-8 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                  </>)}
                  <button onClick={() => setGridHorz((v) => !v)} className="px-2 py-0.5 rounded text-xs" style={gridHorz ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{gridHorz ? 'روشن' : 'خاموش'}</button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>رنگِ پس‌زمینه</span>
                <div className="flex items-center gap-1">
                  {customBg && <button onClick={() => setCustomBg('')} className="text-[10px] opacity-60 hover:opacity-100">پیش‌فرض</button>}
                  <input type="color" value={customBg || TH.bg} onChange={(e) => setCustomBg(e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                </div>
              </div>
              </>)}
              {cfgTab === 'scales' && (<>
              <div className="flex items-center justify-between">
                <span>برچسبِ الگوها روی چارت</span>
                <button onClick={() => setMarkerLabels((v) => !v)} className="px-2 py-0.5 rounded text-xs" style={markerLabels ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{markerLabels ? 'روشن' : 'خاموش'}</button>
              </div>
              <div className="flex items-center justify-between">
                <span>شمارشِ معکوسِ کندل</span>
                <button onClick={() => setShowCountdown((v) => !v)} className="px-2 py-0.5 rounded text-xs" style={showCountdown ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{showCountdown ? 'روشن' : 'خاموش'}</button>
              </div>
              <div className="flex items-center justify-between">
                <span>خطِ آخرین قیمت</span>
                <button onClick={() => setShowPriceLine((v) => !v)} className="px-2 py-0.5 rounded text-xs" style={showPriceLine ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{showPriceLine ? 'روشن' : 'خاموش'}</button>
              </div>
              <div className="flex items-center justify-between">
                <span>برچسبِ مقدارِ اندیکاتور روی محور</span>
                <button onClick={() => setIndAxisLabels((v) => !v)} className="px-2 py-0.5 rounded text-xs" style={indAxisLabels ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{indAxisLabels ? 'روشن' : 'خاموش'}</button>
              </div>
              <div className="flex items-center justify-between">
                <span>رنگِ کراس‌هیر</span>
                <div className="flex items-center gap-1">
                  {crosshairColor && <button onClick={() => setCrosshairColor('')} className="text-[10px] opacity-60 hover:opacity-100">پیش‌فرض</button>}
                  <input type="color" value={crosshairColor || TH.text} onChange={(e) => setCrosshairColor(e.target.value)} className="w-8 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>برچسب‌های کراس‌هیر روی محور</span>
                <button onClick={() => setCrosshairLabels((v) => !v)} className="px-2 py-0.5 rounded text-xs" style={crosshairLabels ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{crosshairLabels ? 'روشن' : 'خاموش'}</button>
              </div>
              <div className="flex items-center justify-between">
                <span>ضخامت/سبکِ کراس‌هیر</span>
                <div className="flex items-center gap-1">
                  <select value={crosshairWidth} onChange={(e) => setCrosshairWidth(Number(e.target.value))} title="ضخامت" className="rounded px-1 py-0.5 text-xs outline-none" style={{ background: TH.chipBg, color: TH.text }}>
                    {[1, 2, 3].map((w) => <option key={w} value={w}>{w}px</option>)}
                  </select>
                  <select value={crosshairStyle} onChange={(e) => setCrosshairStyle(Number(e.target.value))} title="سبکِ خط" className="rounded px-1 py-0.5 text-xs outline-none" style={{ background: TH.chipBg, color: TH.text }}>
                    <option value={0}>توپر</option>
                    <option value={2}>خط‌چین</option>
                    <option value={1}>نقطه‌ای</option>
                    <option value={3}>خط‌چینِ بلند</option>
                  </select>
                </div>
              </div>
              </>)}
              {cfgTab === 'data' && (<>
              <div className="flex items-center justify-between">
                <span>صدای آلارم</span>
                <button onClick={() => { setAlertSound((v) => !v); if (!alertSound) beep(); }} className="px-2 py-0.5 rounded text-xs" style={alertSound ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{alertSound ? 'روشن' : 'خاموش'}</button>
              </div>
              <div className="flex items-center justify-between">
                <span>واترمارکِ نماد</span>
                <button onClick={() => setShowWatermark((v) => !v)} className="px-2 py-0.5 rounded text-xs" style={showWatermark ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{showWatermark ? 'روشن' : 'خاموش'}</button>
              </div>
              <button onClick={() => { setCandleUp(''); setCandleDn(''); setCandleWick(''); setGridOn(true); setGridVert(true); setGridHorz(true); setGridColor(''); setCrosshairColor(''); setCrosshairWidth(1); setCrosshairStyle(3); }} className="w-full mt-1 py-1.5 rounded-lg text-xs" style={{ background: TH.chipBg, color: TH.text }}>بازگردانی به پیش‌فرضِ تم</button>
              <button onClick={resetChart} className="w-full mt-1 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5" style={{ background: TH.chipBg, color: TH.down }}><Trash2 size={13} /> بازنشانیِ چارت (پاکِ اندیکاتور/ترسیم/مقایسه)</button>
              <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              <button onClick={() => { exportCsv(); setCfgOpen(false); }} className="w-full py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5" style={{ background: TH.chipBg, color: TH.textStrong }}><FolderOpen size={13} /> خروجیِ داده‌ی چارت (CSV)</button>
              <div className="flex gap-1 mt-1">
                <button onClick={exportLayout} className="flex-1 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5" style={{ background: TH.chipBg, color: TH.textStrong }}><Save size={13} /> خروجیِ چیدمان</button>
                <button onClick={() => layoutFileRef.current && layoutFileRef.current.click()} className="flex-1 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5" style={{ background: TH.chipBg, color: TH.textStrong }}><FolderOpen size={13} /> ورودیِ چیدمان</button>
                <input ref={layoutFileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { importLayoutFile(e.target.files && e.target.files[0]); e.target.value = ''; }} />
              </div>
              <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              {/* لِی‌اوتهای نام‌دار (Saved Layouts) — مثلِ تریدینگ‌ویو، محلی */}
              <div className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: TH.textStrong }}><Save size={12} /> لِی‌اوتهای ذخیره‌شده</div>
              <div className="flex gap-1 mt-1">
                <input value={layoutName} onChange={(e) => setLayoutName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveNamedLayout(); }} placeholder="نامِ لِی‌اوت…" className="flex-1 px-2 py-1 rounded-lg text-xs outline-none" style={{ background: TH.chipBg, color: TH.text, border: `1px solid ${TH.border}` }} />
                <button onClick={saveNamedLayout} disabled={!layoutName.trim()} className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1" style={{ background: layoutName.trim() ? TH.accent : TH.chipBg, color: layoutName.trim() ? '#fff' : TH.text }}><Save size={12} /> ذخیره</button>
              </div>
              {Object.keys(namedLayouts).length > 0 && (
                <div className="mt-1 flex flex-col gap-0.5 max-h-40 overflow-auto">
                  {Object.keys(namedLayouts).map((nm) => (
                    <div key={nm} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs" style={{ background: TH.chipBg }}>
                      <button onClick={() => loadNamedLayout(nm)} title="بارگذاریِ این لِی‌اوت" className="flex-1 text-right truncate flex items-center gap-1.5" style={{ color: TH.textStrong }}><FolderOpen size={12} /> {nm}</button>
                      <button onClick={() => deleteNamedLayout(nm)} title="حذف" className="shrink-0 p-0.5 rounded" style={{ color: TH.down }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              </>)}
            </div>
          </div>
        </>
      )}

      {/* دیالوگِ تنظیماتِ اندیکاتور */}
      {editInd && (() => {
        const arr = editInd.scope === 'main' ? overlays : subs;
        const it = arr.find((x) => x.id === editInd.id); if (!it) return null;
        const def = REGISTRY[it.key];
        const upd = (patch) => updInd(editInd.scope, it.id, patch);
        const inputKeys = Object.keys(def.inputs || {});
        const curW = it.width || 2;
        const curLS = it.lineStyle != null ? it.lineStyle : 0;        // 0 توپر / 2 خط‌چین / 1 نقطه‌ای
        const curOp = it.opacity == null ? 1 : it.opacity;
        const visible = it.visible !== false;
        // ساختارِ خطوطِ این اندیکاتور (برای رنگِ مجزای هر خط) — از روی کندل‌های جاری محاسبه می‌شود
        const lineDefs = (() => {
          try {
            const cs2 = candlesRef.current; if (!cs2 || !cs2.length) return null;
            const cc = { open: cs2.map((x) => x.o), high: cs2.map((x) => x.h), low: cs2.map((x) => x.l), close: cs2.map((x) => x.c), volume: cs2.map((x) => x.v || 0) };
            const rr = def.calc(cc, it.inputs);
            if (rr.lines) return rr.lines.map((ln, i) => ({ color: ln.color, label: `خط ${i + 1}` }));
            if (rr.multi) return [{ color: def.color, label: 'بالا' }, { color: def.color, label: 'میانی' }, { color: def.color, label: 'پایین' }];
            return null;
          } catch (e) { return null; }
        })();
        const multiLine = lineDefs && lineDefs.length > 1;
        const lineColors = it.lineColors || {};
        const curScale = it.scale === 'left' ? 'left' : 'right';
        const Tab = ({ id, children }) => (
          <button onClick={() => setIndDlgTab(id)} className="flex-1 py-1.5 text-[12px] font-semibold transition-colors duration-[120ms]"
            style={{ color: indDlgTab === id ? TH.accent : TH.text, borderBottom: `2px solid ${indDlgTab === id ? TH.accent : 'transparent'}` }}>{children}</button>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: TH.overlayMask }} onClick={() => setEditInd(null)} dir="rtl">
            <div className="rounded-xl w-80 border shadow-2xl overflow-hidden" style={{ background: TH.popoverBg, borderColor: TH.border }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: TH.border }}>
                <h3 className="font-bold text-sm" style={{ color: TH.textStrong }}>{def.label}</h3>
                <button onClick={() => setEditInd(null)} aria-label="بستن" className="p-1 rounded-md opacity-60 hover:opacity-100" style={{ background: TH.chipBg }}><X size={15} /></button>
              </div>
              <div className="flex border-b" style={{ borderColor: TH.border }}>
                <Tab id="inputs">ورودی‌ها</Tab>
                <Tab id="style">استایل</Tab>
              </div>
              <div className="p-4">
                {indDlgTab === 'inputs' && (
                  inputKeys.length ? inputKeys.map((k) => (
                    <div key={k} className="flex items-center justify-between mb-2.5 text-sm">
                      <label className="opacity-70" dir="ltr">{k}</label>
                      <input type="number" step="any" value={it.inputs[k]} onChange={(e) => upd({ inputs: { [k]: Number(e.target.value) } })} className="w-24 rounded px-2 py-1 outline-none text-right" dir="ltr" style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }} />
                    </div>
                  )) : <div className="text-center text-[12px] opacity-50 py-3">این اندیکاتور ورودیِ قابلِ‌تنظیم ندارد.</div>
                )}
                {indDlgTab === 'style' && (
                  <div className="space-y-3">
                    {multiLine ? (
                      <div className="space-y-1.5">
                        <label className="opacity-70 text-sm">رنگِ خطوط</label>
                        {lineDefs.map((ld, i) => (
                          <div key={i} className="flex items-center justify-between text-sm pr-2">
                            <span className="opacity-60 text-[12px]">{ld.label}</span>
                            <input type="color" value={lineColors[i] || ld.color} onChange={(e) => upd({ lineColors: { ...lineColors, [i]: e.target.value } })} className="w-10 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm"><label className="opacity-70">رنگ</label>
                        <input type="color" value={it.color || def.color} onChange={(e) => upd({ color: e.target.value })} className="w-10 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm"><label className="opacity-70">ضخامت</label>
                      <div className="flex items-center gap-1">{[1, 2, 3, 4].map((w) => (
                        <button key={w} onClick={() => upd({ width: w })} className="w-6 h-6 rounded text-[11px] transition-colors duration-[120ms]" style={curW === w ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{w}</button>
                      ))}</div>
                    </div>
                    <div className="flex items-center justify-between text-sm"><label className="opacity-70">سبکِ خط</label>
                      <div className="flex items-center gap-1">
                        {[{ v: 0, t: 'توپر', d: '──' }, { v: 2, t: 'خط‌چین', d: '╌╌' }, { v: 1, t: 'نقطه‌ای', d: '⋯' }].map((o) => (
                          <button key={o.v} onClick={() => upd({ lineStyle: o.v })} title={o.t} className="px-2 h-6 rounded text-[12px] transition-colors duration-[120ms]" style={curLS === o.v ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{o.d}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm gap-3"><label className="opacity-70 shrink-0">شفافیت</label>
                      <input type="range" min="0.1" max="1" step="0.05" value={curOp} onChange={(e) => upd({ opacity: Number(e.target.value) })} className="flex-1 accent-current" style={{ accentColor: TH.accent }} />
                      <span className="tabular-nums text-[11px] w-9 text-left" dir="ltr">{Math.round(curOp * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm"><label className="opacity-70">نمایش روی چارت</label>
                      <button onClick={() => upd({ visible: !visible })} className="px-3 h-6 rounded text-[11px] transition-colors duration-[120ms]" style={visible ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{visible ? 'روشن' : 'خاموش'}</button>
                    </div>
                    {editInd.scope === 'main' && (
                      <div className="flex items-center justify-between text-sm"><label className="opacity-70">محورِ قیمت</label>
                        <div className="flex items-center gap-1">
                          {[{ v: 'right', t: 'راست' }, { v: 'left', t: 'چپ' }].map((o) => (
                            <button key={o.v} onClick={() => upd({ scale: o.v })} className="px-2.5 h-6 rounded text-[11px] transition-colors duration-[120ms]" style={curScale === o.v ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{o.t}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="px-4 pb-4 flex gap-2">
                <button onClick={() => upd({ inputs: { ...def.inputs }, width: undefined, lineStyle: undefined, opacity: undefined, color: def.color, lineColors: undefined, visible: true })} title="بازگردانی به تنظیماتِ پیش‌فرضِ اندیکاتور" className="px-3 py-1.5 rounded-md text-sm transition-colors duration-[120ms]" style={{ background: TH.chipBg, color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>پیش‌فرض</button>
                <button onClick={() => setEditInd(null)} className="flex-1 py-1.5 rounded-md text-white text-sm transition-opacity duration-[120ms]" style={{ background: TH.accent }}>تأیید</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* #۱۷ مودالِ راهنمای ابزار/اندیکاتور (؟) — key={helpId} تا هر بار مرزِ خطا تازه شود و در fallback گیر نکند */}
      <HelpModal key={helpId || 'none'} entry={getHelp(helpId)} onClose={() => setHelpId(null)} TH={TH} />
      {/* #۱۲ مودالِ قوانین و حریمِ خصوصی */}
      <Legal open={showLegal} onClose={() => setShowLegal(false)} theme={theme} />

      {/* دیالوگِ راهنمای میان‌بُرهای صفحه‌کلید (؟) */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: TH.overlayMask }} onClick={() => setShowShortcuts(false)} dir="rtl">
          <div className="rounded-xl border shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" style={{ background: TH.popoverBg, borderColor: TH.border }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: TH.border }}>
              <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: TH.textStrong }}><span>⌨</span> میان‌بُرهای صفحه‌کلید</h3>
              <button onClick={() => setShowShortcuts(false)} aria-label="بستن" className="p-1 rounded-md opacity-60 hover:opacity-100 transition-colors duration-[120ms]" style={{ background: TH.chipBg }}><X size={15} /></button>
            </div>
            <div className="overflow-auto p-4 bn-thin-scroll">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {SHORTCUT_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div className="text-[11px] font-bold mb-1.5 pb-1 border-b" style={{ color: TH.accent, borderColor: TH.border }}>{g.group}</div>
                    <div className="space-y-1">
                      {g.items.map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="opacity-80 truncate" style={{ color: TH.text }}>{s.label}</span>
                          <kbd className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-mono tabular-nums border whitespace-nowrap" dir="ltr" style={{ background: TH.chipBg, borderColor: TH.border, color: TH.textStrong }}>{s.combo}</kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* بات‌اِم‌شیتِ موبایل (فقط زیرِ ۷۶۸px) — دسترسی به ابزارها/تب‌ها در صفحهٔ کوچک */}
      {/* #7 مدالِ جستجوی نمادِ حرفه‌ای (fuzzy + دسته‌بندی + اسکرولِ مجازی + کیبورد) */}
      <SymbolSearchModal open={symModal} onClose={() => { setSymModal(false); setSymInitQuery(''); }} initialQuery={symInitQuery} metaList={symbolMeta} watch={watch} current={symbol} onPick={(s) => setSymbol(s)} TH={TH} coarse={bp.coarse} />
      <Partners open={partnersOpen} onClose={() => setPartnersOpen(false)} TH={TH} />
      {/* Compare — انتخابِ نمادِ مقایسه‌ای (چارت اصلی عوض نمی‌شود، نماد اضافه می‌شود) */}
      <SymbolSearchModal open={cmpModal} onClose={() => setCmpModal(false)} metaList={symbolMeta} watch={watch} current={symbol} onPick={(s) => { addCompare(s); setCmpModal(false); }} TH={TH} coarse={bp.coarse} />

      {/* #4 نسخهٔ موبایل: نوارِ ناوبریِ پایینی + شیت‌های پایین */}
      {compact && (
        <>
          <MobileBottomNav
            TH={TH} active={sheet === 'none' ? null : sheet}
            onPick={(k) => { if (k === 'sym') setSymModal(true); else setSheet((s) => (s === k ? 'none' : k)); }}
            items={[
              { key: 'sym', label: 'نماد', icon: <Search size={20} /> },
              { key: 'tf', label: 'تایم‌فریم', icon: <span className="text-[13px] font-bold leading-none" dir="ltr">{tf}</span> },
              { key: 'draw', label: 'ابزار', icon: <Pencil size={20} /> },
              { key: 'ind', label: 'اندیکاتور', icon: <Activity size={20} /> },
              { key: 'tabs', label: 'تب‌ها', icon: <Star size={20} /> },
            ]}
          />

          {/* شیتِ تایم‌فریم */}
          <MobileToolSheet TH={TH} open={sheet === 'tf'} onClose={() => setSheet('none')} title="تایم‌فریم" maxVh={45}>
            <div className="grid grid-cols-4 gap-1.5" dir="ltr">
              {TFS.map((t) => (
                <button key={t} onClick={() => { setTf(t); setSheet('none'); }} className="rounded-lg text-sm font-bold tabular-nums transition-colors duration-[120ms]" style={{ minHeight: 48, color: tf === t ? '#fff' : TH.textStrong, background: tf === t ? TH.accent : TH.chipBg }}>{TF_LABEL[t] || t}</button>
              ))}
            </div>
          </MobileToolSheet>

          {/* شیتِ نوعِ چارت */}
          <MobileToolSheet TH={TH} open={sheet === 'type'} onClose={() => setSheet('none')} title="نوعِ چارت" maxVh={55}>
            <div className="grid grid-cols-2 gap-1.5">
              {CHART_TYPES.map((ct) => { const I = ct.Icon || CandlestickChart; return (
                <button key={ct.id} onClick={() => { setChartType(ct.id); setSheet('none'); }} className="rounded-lg px-3 text-sm text-right flex items-center gap-2 transition-colors duration-[120ms]" style={{ minHeight: 48, color: chartType === ct.id ? '#fff' : TH.textStrong, background: chartType === ct.id ? TH.accent : TH.chipBg }}><I size={18} /> {ct.label}</button>
              ); })}
            </div>
          </MobileToolSheet>

          {/* شیتِ ابزارِ ترسیم — ToolRail در حالتِ لمسی */}
          <MobileToolSheet TH={TH} open={sheet === 'draw'} onClose={() => setSheet('none')} title="ابزارِ ترسیم" maxVh={70}>
            <div className="min-h-[200px]"><ToolRail tool={tool} setTool={(id) => { setTool(id); setSheet('none'); }} TH={TH} onHelp={setHelpId} /></div>
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              <button onClick={() => setMagnet((v) => !v)} className="rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px]" style={{ minHeight: 56, color: magnet ? '#fff' : TH.textStrong, background: magnet ? TH.accent : TH.chipBg }}><Magnet size={18} /> مگنت</button>
              <button onClick={() => { drawRef.current && drawRef.current.undo(); treeRefresh(); }} className="rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px]" style={{ minHeight: 56, color: TH.textStrong, background: TH.chipBg }}><Undo2 size={18} /> واگرد</button>
              <button onClick={() => { drawRef.current && drawRef.current.redo(); treeRefresh(); }} className="rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px]" style={{ minHeight: 56, color: TH.textStrong, background: TH.chipBg }}><Redo2 size={18} /> ازنو</button>
              <button onClick={() => { drawRef.current && drawRef.current.clearAll(); treeRefresh(); }} className="rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] text-red-400" style={{ minHeight: 56, background: TH.chipBg }}><Trash2 size={18} /> پاکِ همه</button>
            </div>
          </MobileToolSheet>

          {/* شیتِ اندیکاتورها */}
          <MobileToolSheet TH={TH} open={sheet === 'ind'} onClose={() => setSheet('none')} title="اندیکاتورها" maxVh={75}>
            {legendItems.length > 0 && (
              <>
                <div className="text-[11px] opacity-60 px-1">فعال</div>
                <div className="flex flex-col gap-1">
                  {legendItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 rounded-lg px-3" style={{ minHeight: 44, background: TH.chipBg }}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: it.color }} />
                      <span className="flex-1 text-sm" style={{ color: TH.textStrong, opacity: it.visible === false ? 0.45 : 1 }}>{it.label}</span>
                      <button onClick={() => toggleIndVisible(it)} className="p-1" style={{ color: TH.text }}>{it.visible === false ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      <button onClick={() => { setEditInd({ scope: it.scope, id: it.id }); setSheet('none'); }} className="p-1" style={{ color: TH.text }}><Settings2 size={18} /></button>
                      <button onClick={() => rmInd(it.scope, it.id)} className="p-1 text-red-400"><X size={18} /></button>
                    </div>
                  ))}
                </div>
                <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              </>
            )}
            <div className="text-[11px] opacity-60 px-1">افزودن</div>
            <div className="flex flex-col gap-1">
              {Object.entries(REGISTRY).map(([k, d]) => (
                <button key={k} onClick={() => addInd(k)} className="flex items-center gap-2 rounded-lg px-3 text-right text-sm" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}><Plus size={16} /> {d.label}</button>
              ))}
            </div>
          </MobileToolSheet>

          {/* شیتِ تب‌ها/بیشتر — پنلِ راست + کنترل‌های منتقل‌شده */}
          <MobileToolSheet TH={TH} open={sheet === 'tabs'} onClose={() => setSheet('none')} title="پنل‌ها و ابزار" maxVh={85}>
            <div className="text-[11px] opacity-60 px-1">پنل‌ها</div>
            <div className="grid grid-cols-2 gap-1.5">
              {[['watch', 'واچ‌لیست'], ['ai', 'سیگنال AI'], ['screener', 'اسکنر'], ['details', 'جزئیات'], ['news', 'اخبار'], ['cal', 'تقویم'], ['trade', 'ترید'], ['alerts', 'آلارم']].map(([k, l]) => (
                <button key={k} onClick={() => { setRightTab(k); setShowRight(true); setSheet('none'); }} className="rounded-lg px-3 text-sm transition-colors duration-[120ms]" style={{ minHeight: 44, color: rightTab === k && showRight ? '#fff' : TH.textStrong, background: rightTab === k && showRight ? TH.accent : TH.chipBg }}>{l}</button>
              ))}
            </div>
          </MobileToolSheet>

          {/* شیتِ More (همبرگرِ تولبار): همهٔ کنترل‌های دسکتاپ */}
          <MobileToolSheet TH={TH} open={sheet === 'more'} onClose={() => setSheet('none')} title="بیشتر" maxVh={78}>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => { getAiSignal(); setSheet('none'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: '#fff', background: TH.accentAi }}><Sparkles size={16} /> سیگنالِ AI</button>
              <button onClick={() => { setIndMenu(true); setSheet('none'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}><Activity size={16} /> اندیکاتورها</button>
              <button onClick={() => { openNamaScript(); setSheet('none'); }} className="rounded-lg px-3 text-sm flex items-center justify-center gap-1" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}><Code2 size={16} /> نمااسکریپت{!bnPrem && <Lock size={11} className="opacity-70" />}</button>
              <button onClick={() => { (replay.on ? exitReplay() : enterReplay()); setSheet('none'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: replay.on ? '#fff' : TH.textStrong, background: replay.on ? TH.accent : TH.chipBg }}><Play size={16} /> بازپخش</button>
              <button onClick={() => setSessionsOn((v) => !v)} className="rounded-lg px-3 text-sm" style={{ minHeight: 44, color: sessionsOn ? '#fff' : TH.textStrong, background: sessionsOn ? TH.accent : TH.chipBg }}>سشن‌ها</button>
              <button onClick={() => setShowVP((v) => !v)} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: showVP ? '#fff' : TH.textStrong, background: showVP ? TH.accent : TH.chipBg }}><BarChart3 size={16} /> پروفایلِ حجم</button>
              <button onClick={() => setScaleLocked((v) => !v)} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: scaleLocked ? '#fff' : TH.textStrong, background: scaleLocked ? TH.accent : TH.chipBg }}>{scaleLocked ? <Lock size={16} /> : <Unlock size={16} />} قفلِ مقیاس</button>
              <button onClick={() => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); } catch (e) {} }} className="rounded-lg px-3 text-sm" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}>بازنشانیِ مقیاس</button>
              <button onClick={() => { setTheme((t) => (t === 'dark' ? 'light' : 'dark')); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />} تم</button>
              <button onClick={async () => { await quickScreenshot(); setSheet('none'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}><Camera size={16} /> عکس (کپی)</button>
              <button onClick={() => { setShowDataWin((v) => !v); setSheet('none'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: showDataWin ? '#fff' : TH.textStrong, background: showDataWin ? TH.accent : TH.chipBg }}><Table2 size={16} /> پنجرهٔ داده</button>
              <button onClick={() => { setShowShortcuts(true); setSheet('none'); }} className="rounded-lg px-3 text-sm" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}>⌨ میان‌بُرها</button>
            </div>
            <div className="mt-2"><AuthMenu theme={theme} /></div>
          </MobileToolSheet>
        </>
      )}
    </div>
  );
}
