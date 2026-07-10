import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries, BarSeries, BaselineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import {
  CandlestickChart, LineChart, AreaChart, BarChart3, Activity, Plus, X, Save,
  Play, Code2, Star, Search, Settings2, Trash2, Bell, FolderOpen, Sun, Moon,
  Minus,
  FlaskConical, ChevronDown, LayoutGrid, Maximize2,
  Magnet, Sparkles,
  Undo2, Redo2, Lock, Unlock, Eye, EyeOff, List, Pencil, Table2, Camera,
  TrendingUp, TrendingDown, ArrowUpDown, Scaling,
} from 'lucide-react';
import { api } from '../api/client';
import { useApp } from '../appStore';
import { tap } from '../app/haptics';
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
import { useBreakpoint, MobileToolSheet, CompactTopBar, BREAKPOINTS } from '../bazaarnama/mobile';
import { useViewport } from '../bazaarnama/useViewport';
import { GRID_PRESET_ORDER, getGridLayout, presetToLegacyGrid, legacyGridToPreset } from '../bazaarnama/layoutPresets';
import { Legend, ChartLegend, CountdownChip, Watermark, ReplayBar, DataWindow, CrosshairAxisTag } from '../bazaarnama/overlays/ChartOverlays';
import SymbolLogo from '../bazaarnama/SymbolLogo';
import SymbolSearchModal from '../bazaarnama/SymbolSearchModal';
import { buildMeta } from '../bazaarnama/symbolMeta';
import ScreenshotMenu from '../bazaarnama/ScreenshotMenu';
import { captureChart, canvasToBlob, copyBlobToClipboard, downloadBlob } from '../bazaarnama/screenshot';
import RightPanel from '../bazaarnama/RightPanel';
import IndicatorsDialog from '../bazaarnama/IndicatorsDialog';
import ChartSettingsDialog from '../bazaarnama/ChartSettingsDialog';
import RightIconRail from '../bazaarnama/RightIconRail';
import ContextMenu from '../bazaarnama/ContextMenu';
import AuthMenu from '../AuthMenu';
import HelpModal, { HelpDot } from '../bazaarnama/Help';
import Legal from './Legal';
import { getHelp } from '../bazaarnama/help';
import { HelpCircle } from 'lucide-react';

const TFS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'D1', 'W1', 'MN'];
// باسِ همگام‌سازیِ چندچارتی (زمان + کراس‌هیر) — هر MiniChart مشترک می‌شود
function makeSyncBus() { let subs = []; return { subscribe(fn) { subs.push(fn); return () => { subs = subs.filter((s) => s !== fn); }; }, emit(type, payload, self) { subs.forEach((fn) => { if (fn !== self) fn(type, payload); }); } }; }
// برچسبِ کوتاه + عنوانِ فارسی برای نوارِ تایم‌فریمِ حرفه‌ای
const TF_LABEL = { M1: '1m', M5: '5m', M15: '15m', M30: '30m', H1: '1H', H2: '2H', H4: '4H', D1: '1D', W1: '1W', MN: '1Mo' };
const TF_TITLE = { M1: '۱ دقیقه', M5: '۵ دقیقه', M15: '۱۵ دقیقه', M30: '۳۰ دقیقه', H1: '۱ ساعته', H2: '۲ ساعته', H4: '۴ ساعته', D1: 'روزانه', W1: 'هفتگی', MN: 'ماهانه' };
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
// بازه‌های سریعِ نمایش (سطحِ چارت — مثلِ TradingView): برچسب → تعدادِ روز | 'ytd' | 'all'.
// این رنجِ *نمایش* را تنظیم می‌کند (setVisibleRange)، مستقل از اینتروال/تایم‌فریم.
const QUICK_RANGES = [['1D', 1], ['5D', 5], ['1M', 30], ['3M', 90], ['6M', 180], ['YTD', 'ytd'], ['1Y', 365], ['5Y', 1825], ['All', 'all']];
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
  ...EXT_CHART_TYPES,
];
// ابزارهای ترسیم اکنون در کامپوننتِ ToolRail (گروه‌بندی‌شده، سبکِ TradingView) تعریف می‌شوند.

// پالتِ هم‌ترازِ TradingView (آبیِ برندِ Pro-Chart #2962FF). توکن‌محور — هیچ رنگِ inline.
const THEMES = {
  dark: {
    bg: '#131722', panel: '#1e222d', border: '#2a2e39', grid: '#1e222d',
    gridLine: 'rgba(255,255,255,.05)', // خطِ داخلیِ گرید: بسیار کم‌رنگ مثلِ TV (نه به پررنگیِ border)
    text: '#b2b5be', textStrong: '#d1d4dc',
    up: '#26a69a', down: '#ef5350',
    chipBg: 'rgba(255,255,255,.06)', chipBgHover: 'rgba(255,255,255,.10)',
    subtle: 'rgba(255,255,255,.04)', popoverBg: 'rgba(30,34,45,.98)',
    overlayMask: 'rgba(0,0,0,.42)', accent: '#2962FF', accentAi: '#8b5cf6',
    tpColor: '#22c55e', slColor: '#ef4444', crosshairLabelBg: '#4c525e',
  },
  light: {
    bg: '#ffffff', panel: '#f0f3fa', border: '#e0e3eb', grid: '#e0e3eb',
    gridLine: 'rgba(42,46,57,.06)', // خطِ داخلیِ گرید: بسیار کم‌رنگ مثلِ TV (border پررنگ‌تر می‌ماند)
    text: '#5d606b', textStrong: '#131722',
    up: '#089981', down: '#f23645',
    chipBg: 'rgba(0,0,0,.04)', chipBgHover: 'rgba(0,0,0,.07)',
    subtle: 'rgba(0,0,0,.03)', popoverBg: 'rgba(255,255,255,.98)',
    overlayMask: 'rgba(255,255,255,.8)', accent: '#2962FF', accentAi: '#7c3aed',
    tpColor: '#22c55e', slColor: '#ef4444', crosshairLabelBg: '#434651',
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
  const volSeriesRef = useRef(null); // سریِ حجمِ هیستوگرام پایینِ چارت (overlay، مثلِ TradingView)
  const drawRef = useRef(null);
  const overlaySeries = useRef({});
  const subChartsRef = useRef({});
  const scriptSeries = useRef([]);
  const scriptHlines = useRef([]);
  const candlesRef = useRef([]);
  const liveLineRef = useRef(null);
  const lastMidRef = useRef({});
  const symbolRef = useRef('EURUSD'); // نمادِ جاری برای استفاده در هندلرهای mount-time (کراس‌هیر)
  const lazyRef = useRef({ loading: false, exhausted: false }); // بارگذاریِ تنبلِ تاریخ
  const loadMoreRef = useRef(null);
  const easeRef = useRef({ target: null, display: null }); // انیمیشنِ نرمِ قیمتِ زنده (حسِ تیک‌به‌تیک)

  const [symbol, setSymbol] = useState(() => loadWS().symbol || 'EURUSD');
  const [tf, setTf] = useState(() => loadWS().tf || 'H1');
  const [chartType, setChartType] = useState(() => loadWS().chartType || 'candles');
  const [theme, setTheme] = useState(() => useApp.getState().theme || loadWS().theme || 'light');
  const [symbols, setSymbols] = useState([]);
  const [overlays, setOverlays] = useState(() => loadWS().overlays || []);
  const [subs, setSubs] = useState(() => loadWS().subs || []);
  const [indMenu, setIndMenu] = useState(false);
  const [indDlg, setIndDlg] = useState(false); // دیالوگِ کاملِ اندیکاتورها (جایگزینِ triggerِ dropdownِ قدیمی)
  const [indFavs, setIndFavs] = useState(() => loadWS().indFavs || []); // اندیکاتورهای منتخب (پین‌شده)
  const toggleIndFav = (k) => setIndFavs((f) => { const n = f.includes(k) ? f.filter((x) => x !== k) : [...f, k]; saveWS({ indFavs: n }); return n; });
  // سینکِ منتخب‌ها با دیالوگ (IndicatorsDialog رویداد bn-indfavs را dispatch می‌کند)
  useEffect(() => { const h = (e) => { if (Array.isArray(e.detail)) setIndFavs(e.detail); }; window.addEventListener('bn-indfavs', h); return () => window.removeEventListener('bn-indfavs', h); }, []);
  const [indTpls, setIndTpls] = useState(() => loadWS().indTpls || {}); // {name:{overlays,subs}} — تمپلیتِ اندیکاتورها
  const saveIndTpl = () => { const name = (window.prompt('نامِ تمپلیتِ اندیکاتورها:') || '').trim(); if (!name) return; const n = { ...indTpls, [name]: { overlays, subs } }; setIndTpls(n); saveWS({ indTpls: n }); };
  const applyIndTpl = (name) => { const t = indTpls[name]; if (!t) return; setOverlays(t.overlays || []); setSubs(t.subs || []); setIndMenu(false); };
  const delIndTpl = (name) => setIndTpls((p) => { const n = { ...p }; delete n[name]; saveWS({ indTpls: n }); return n; });
  const [ctMenu, setCtMenu] = useState(false);
  // اینتروال سبکِ TV: تایم‌فریم‌های منتخبِ inline + dropdownِ کاملِ همه (audit #2)
  const [tfMenu, setTfMenu] = useState(false);
  const [tfFavs, setTfFavs] = useState(() => { const f = loadWS().tfFavs; return Array.isArray(f) && f.length ? f.filter((k) => TFS.includes(k)) : ['M15', 'H1', 'H4', 'D1', 'W1']; });
  const toggleTfFav = (k) => setTfFavs((p) => { const n = p.includes(k) ? p.filter((x) => x !== k) : [...p, k]; saveWS({ tfFavs: n }); return n; });
  const [watch, setWatch] = useState([]);
  const [rightTab, setRightTab] = useState('watch');
  const [showRight, setShowRight] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
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
    const onSetSym = (e) => { const s = e && e.detail; if (s && typeof s === 'string') setSymbol(s); }; // از پوستهٔ اپ (واچ‌لیست/سیگنال)
    window.addEventListener('bn:rightTab', onTab); window.addEventListener('bn:openScript', onScript); window.addEventListener('bn:help', onHelp);
    window.addEventListener('bn:support', onSup); window.addEventListener('bn:terms', onTerms); window.addEventListener('bn:toggleTheme', onThemeT);
    window.addEventListener('bn:setSymbol', onSetSym);
    return () => { window.removeEventListener('bn:rightTab', onTab); window.removeEventListener('bn:openScript', onScript); window.removeEventListener('bn:help', onHelp); window.removeEventListener('bn:support', onSup); window.removeEventListener('bn:terms', onTerms); window.removeEventListener('bn:toggleTheme', onThemeT); window.removeEventListener('bn:setSymbol', onSetSym); };
  }, [tool, openNamaScript]);

  // همگام‌سازیِ تم با فروشگاهِ سراسریِ اپ (پروفایل = منبعِ اصلی؛ تاگلِ داخلی هم برمی‌گرداند)
  const lang = useApp((s) => s.lang);
  const appTheme = useApp((s) => s.theme);
  useEffect(() => { setTheme(appTheme); }, [appTheme]);
  useEffect(() => { if (useApp.getState().theme !== theme) useApp.getState().setTheme(theme); }, [theme]);

  // ── فاز۲: تجربهٔ چارت ──
  // ترنزیشنِ سینماییِ تعویضِ تایم‌فریم/نوعِ چارت + هپتیکِ سبک (بعد از mount)
  const [swapKey, setSwapKey] = useState(0);
  const bn2Mount = useRef(false);
  useEffect(() => { if (bn2Mount.current) { setSwapKey((k) => k + 1); tap(); } else { bn2Mount.current = true; } }, [tf, chartType]);
  // هپتیکِ انتخابِ ابزارِ ترسیم
  const toolMount = useRef(false);
  useEffect(() => { if (toolMount.current) tap(); else toolMount.current = true; }, [tool]);
  // راهنمای ژستِ بارِ اول
  const [showGestureHint, setShowGestureHint] = useState(() => { try { return !localStorage.getItem('bn_gesture_hint_seen'); } catch (e) { return false; } });
  const dismissGestureHint = () => { try { localStorage.setItem('bn_gesture_hint_seen', '1'); } catch (e) { /* noop */ } setShowGestureHint(false); };
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
  // جهتِ حرکتِ قیمتِ زنده (برای فلَشِ سبز/قرمزِ برچسبِ قیمت) — باید بعد از تعریفِ livePrice باشد (وگرنه TDZ)
  const prevLpRef = useRef(null);
  const priceDir = (livePrice != null && prevLpRef.current != null) ? (livePrice > prevLpRef.current ? 'up' : livePrice < prevLpRef.current ? 'down' : '') : '';
  useEffect(() => { prevLpRef.current = livePrice; }, [livePrice]);
  const [countdown, setCountdown] = useState(''); // شمارشِ معکوسِ بسته‌شدنِ کندل
  const [countdownColor, setCountdownColor] = useState(null); // تینتِ نزدیکِ بسته‌شدن (قرمز/کهربایی)
  const [showVP, setShowVP] = useState(false);
  const [showVolume, setShowVolume] = useState(loadWS().showVolume ?? true); // حجم (هیستوگرامِ پایینِ چارت) — پیش‌فرض روشن مثلِ TradingView
  const showVolumeRef = useRef(loadWS().showVolume ?? true); // گیتِ پایدار برای applyVolume (بدونِ وابستگی → پایدار)
  const [quickRange, setQuickRange] = useState(null); // بازهٔ سریعِ نمایشِ فعال (1D/5D/…/All) — سطحِ چارت
  const [magnet, setMagnet] = useState(loadWS().magnet ?? false);
  const [magnetMode, setMagnetMode] = useState(loadWS().magnetMode ?? 'strong'); // قوی/ضعیف (سبکِ TV)
  const [allLocked, setAllLocked] = useState(false); // قفلِ همهٔ ترسیم‌ها (سبکِ TV)
  const [allHidden, setAllHidden] = useState(false); // مخفیِ همهٔ ترسیم‌ها (سبکِ TV)
  const [order, setOrder] = useState(null); // {side, entry, sl, tp} — #D: پیش‌فرض هیچ پوزیشنی باز نیست (از localStorage بازیابی نمی‌شود)
  const [aiSig, setAiSig] = useState(() => loadWS().aiSig || null); // سیگنالِ AI — باگ۳: با رفرش پاک نشود
  const [aiList, setAiList] = useState([]); // همهٔ سیگنال‌های اخیر — همیشه در ساید‌بار می‌مانند
  const [aiBusy, setAiBusy] = useState(false);
  const [aiQuota, setAiQuota] = useState(null);
  const aiLinesRef = useRef([]);
  const aiZonesRef = useRef([]); // سری‌های ناحیهٔ سبز/قرمزِ سیگنالِ AI (پروجکشنِ رو به جلو)
  const [grid, setGrid] = useState(1); // 1/2/4 چند-چارت
  const [gridMenu, setGridMenu] = useState(false); // منوی پریستِ چیدمانِ چند-چارت (layoutPresets)
  const [cfgMenu, setCfgMenu] = useState(false); // منوی چرخ‌دندهٔ «تنظیماتِ چارت» (ظاهر/مقیاس/کراس‌هیر)
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false); // دیالوگِ کاملِ «تنظیماتِ چارت» (ChartSettingsDialog)
  const [chartSettingsOverrides, setChartSettingsOverrides] = useState({}); // کلیدهای دیالوگ که هنوز به chart وصل نشده‌اند (نگه‌داریِ حالتِ UI)
  const [layoutMenu, setLayoutMenu] = useState(false); // منوی «چیدمان/لایوت» (ذخیره/بارگذاری)
  const [showShortcuts, setShowShortcuts] = useState(false); // دیالوگِ راهنمای میان‌بُرها
  const [symModal, setSymModal] = useState(false); // #7 مدالِ جستجوی نماد
  const [sheet, setSheet] = useState('none'); // #4 شیتِ موبایلِ فعال: none|tf|sym|type|draw|ind|tabs
  const [legCollapsed, setLegCollapsed] = useState(() => !!loadWS().legCollapsed); // #3 جمع‌بودنِ Legend
  const [legView, setLegView] = useState(() => loadWS().legView || 'normal'); // #3 normal|compact
  const [indVals, setIndVals] = useState({}); // #3 مقدارِ زندهٔ اندیکاتورها برای Legend
  const [scaleMode, setScaleMode] = useState(loadWS().scaleMode ?? CH3_DEFAULTS.scaleMode); // 0 عادی / 1 لاگ / 2 درصد / 3 پایه۱۰۰
  const [scaleLocked, setScaleLocked] = useState(loadWS().scaleLocked ?? false); // قفلِ بازهٔ مقیاس
  const [scaleInvert, setScaleInvert] = useState(loadWS().scaleInvert ?? false); // وارونگیِ محور
  const [crosshairId, setCrosshairId] = useState(loadWS().crosshairId ?? 'cross'); // حالتِ کراس‌هیر
  const [tz, setTz] = useState(loadWS().tz ?? CH3_DEFAULTS.tz); // منطقهٔ زمانیِ نمایش
  const [sessionsOn, setSessionsOn] = useState(loadWS().sessionsOn ?? false); // نمایشِ باندهای سشن
  const [sessionSel, setSessionSel] = useState(() => loadWS().sessionSel || SESSIONS.map((s) => s.id)); // #1 سشن‌های انتخابی
  const [sessMenu, setSessMenu] = useState(false); // #1 منوی انتخابِ سشن‌ها
  const crosshairGlyphRef = useRef('none'); // برای رسمِ glyph در هندلرِ کراس‌هیر
  const sessionsRef = useRef(null); // باندهای سشنِ محاسبه‌شدهٔ جاری برای رسم روی overlay
  const [drawColor, setDrawColor] = useState('#3b82f6');
  // ── فاز ۳: ویرایشِ آبجکت ──
  const [stayDraw, setStayDraw] = useState(false);   // ماندن در حالتِ ترسیم
  const [selDraw, setSelDraw] = useState(-1);          // ایندکسِ آبجکتِ انتخاب‌شده
  const [drawList, setDrawList] = useState([]);        // فهرستِ ترسیم‌ها (Object Tree)
  const [showTree, setShowTree] = useState(false);     // نمایشِ Object Tree
  const [showDataWin, setShowDataWin] = useState(loadWS().showDataWin ?? false); // Data Window (مقادیرِ زیرِ کراس‌هیر)
  const [dataWin, setDataWin] = useState(null);        // {ohlc, vol, time, inds:[{label,vals,color}]}
  const [crossTag, setCrossTag] = useState(null);      // #9 تگِ محورِ قیمت/زمانِ زیرِ کراس‌هیر {price:{y,text}, time:{x,text}}
  const [ctx, setCtx] = useState(null);                // منوی راست‌کلیکِ چارت (ContextMenu) { x, y, price, cx } — x/y مختصاتِ viewport، cx مختصاتِ افقیِ نسبی برای placeLongShort
  const indLabelRef = useRef({});                       // id → {label,color} برای Data Window
  const lastIndValRef = useRef({});                     // id → [last values] برای Legend بیرون از کراس‌هیر
  const showDataWinRef = useRef(loadWS().showDataWin ?? false); // گیتِ محاسبهٔ Data Window در هندلرِ کراس‌هیر
  const crossTagOnRef = useRef((loadWS().crosshairId ?? 'cross') !== 'hidden'); // آیا تگِ محور رسم شود (خاموش در حالتِ «بدون»)
  const crossTimeFmtRef = useRef(null);                 // قالب‌بندِ زمانِ TZ-aware برای تگِ محور + پنجرهٔ داده
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
      layout: { background: { color: TH.bg }, textColor: TH.text, fontFamily: 'IRANYekanX, Ravagh, AnjomanMax, Vazirmatn, sans-serif', fontSize: 12, attributionLogo: false },
      grid: { vertLines: { color: TH.gridLine }, horzLines: { color: TH.gridLine } },
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
    // لایهٔ ترسیم
    const cv = overlayRef.current;
    const dl = new DrawingLayer(cv, chart);
    drawRef.current = dl;
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
      if (rng && rng.from < 12 && loadMoreRef.current) loadMoreRef.current();
    });
    chart.subscribeCrosshairMove((p) => {
      dl.render();
      const ctx = overlayRef.current && overlayRef.current.getContext('2d');
      if (ctx && sessionsRef.current) paintSessions(ctx, chart, sessionsRef.current, overlayRef.current.height);
      if (ctx && p && p.point) paintCrosshairGlyph(ctx, crosshairGlyphRef.current, p.point.x, p.point.y, TH);
      if (!p || !p.time || !priceSeriesRef.current) { setLegend(null); setIndVals({}); setCrossTag(null); if (showDataWinRef.current) setDataWin(null); return; }
      const d = p.seriesData.get(priceSeriesRef.current);
      if (d) setLegend(d.close != null ? d : { close: d.value });
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
      // #9 تگِ محورِ قیمت (راست) + زمان (پایین) زیرِ کراس‌هیر — جایگزینِ برچسبِ نیتیو با دقتِ نماد + TZ.
      if (crossTagOnRef.current && p.point) {
        let py = null; try { py = priceSeriesRef.current.coordinateToPrice(p.point.y); } catch (e) { py = null; }
        const tfmt = crossTimeFmtRef.current;
        setCrossTag({
          price: (py != null && Number.isFinite(py)) ? { y: p.point.y, text: fmtPrice(symbolRef.current, py) } : null,
          time: (p.point.x != null) ? { x: p.point.x, text: (tfmt ? tfmt(p.time) : String(p.time)) } : null,
        });
      } else setCrossTag(null);
      if (showDataWinRef.current) {
        const cc = candlesRef.current;
        const bar = cc && cc.length ? cc.find((c) => c.t === p.time) : null;
        setDataWin({ time: p.time, ohlc: d && d.close != null ? d : null, inds, vol: bar && bar.v ? bar.v : null });
      }
    });
    return () => { ro.disconnect(); dl.destroy(); chart.remove(); chartRef.current = null; };
    // eslint-disable-next-line
  }, []);

  // اعمالِ تم
  useEffect(() => {
    const ch = chartRef.current; if (!ch) return;
    ch.applyOptions({ layout: { background: { color: TH.bg }, textColor: TH.text }, grid: { vertLines: { color: TH.gridLine }, horzLines: { color: TH.gridLine } }, timeScale: { borderColor: TH.grid }, rightPriceScale: { borderColor: TH.grid } });
    // eslint-disable-next-line
  }, [theme]);

  // Data Window: همگام‌سازیِ گیتِ ref + ماندگاری
  useEffect(() => { showDataWinRef.current = showDataWin; saveWS({ showDataWin }); if (!showDataWin) setDataWin(null); }, [showDataWin]);
  // قالب‌بندِ زمانِ پنجرهٔ داده (TZ-aware، از ref که در افکتِ tz ست می‌شود) — پایدار برای پاس‌دادن به DataWindow
  const winTimeFmt = useCallback((t) => { const f = crossTimeFmtRef.current; if (f) { try { return f(t); } catch (e) { /* */ } } return (typeof t === 'number' ? new Date(t * 1000).toLocaleString() : String(t)); }, []);

  useEffect(() => { if (drawRef.current) drawRef.current.setTool(tool, drawColor); }, [tool, drawColor]);
  useEffect(() => { try { chartRef.current && chartRef.current.priceScale('right').applyOptions(priceScaleOptions({ mode: scaleMode, locked: scaleLocked, invert: scaleInvert })); saveWS({ scaleMode, scaleLocked, scaleInvert }); } catch (e) {} }, [scaleMode, scaleLocked, scaleInvert]);

  const buildPriceSeries = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    if (priceSeriesRef.current) { try { chart.removeSeries(priceSeriesRef.current); } catch (e) {} priceSeriesRef.current = null; }
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
  }, [chartType, TH]);

  const applyOverlays = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    Object.values(overlaySeries.current).flat().forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    overlaySeries.current = {};
    const c = { open: cs.map((x) => x.o), high: cs.map((x) => x.h), low: cs.map((x) => x.l), close: cs.map((x) => x.c), volume: cs.map((x) => x.v || 0) };
    let anyLeft = false; // برای روشن‌کردنِ محورِ چپ وقتی اندیکاتوری به آن تخصیص یافته
    overlays.forEach((ov) => {
      const def = REGISTRY[ov.key]; if (!def || def.pane !== 'main') return;
      if (ov.visible === false) { overlaySeries.current[ov.id] = []; return; } // تبِ Style: نمایش/مخفی
      if (ov.scale === 'left') anyLeft = true;
      const psId = ov.scale === 'left' ? 'left' : 'right'; // محورِ قیمتِ دوگانه (تبِ Style)
      const r = def.calc(c, ov.inputs); const arr = [];
      const lc = ov.lineColors || {}; // رنگِ مجزای هر خط (اندیکاتورهای چندخطی)
      // override‌های استایل (تبِ Style): ضخامت، سبکِ خط (0 توپر/1 نقطه‌ای/2 خط‌چین)، شفافیت، محور
      const mk = (series, color, w = 2, dashed = false) => {
        const lw = ov.width || w;
        const lsv = ov.lineStyle != null ? ov.lineStyle : (dashed ? 2 : 0);
        const ls = chart.addSeries(LineSeries, { color: applyOpacity(color, ov.opacity), lineWidth: lw, lineStyle: lsv, priceScaleId: psId, priceLineVisible: false, lastValueVisible: false });
        ls.setData(series.map((v, i) => (v == null ? null : { time: cs[i].t, value: v })).filter(Boolean)); arr.push(ls);
      };
      if (r.lines) r.lines.forEach((ln, i) => mk(ln.data, lc[i] || ln.color, 1, ln.dashed));
      else if (r.multi) { const base = ov.color || def.color; mk(r.upper, lc[0] || base, 1, true); mk(r.basis, lc[1] || base, 1); mk(r.lower, lc[2] || base, 1, true); }
      else mk(r.line, lc[0] || ov.color || def.color);
      overlaySeries.current[ov.id] = arr;
      indLabelRef.current[ov.id] = { label: def.label, color: lc[0] || ov.color || def.color };
      // آخرین مقدار برای نمایش در Legend وقتی کراس‌هیر فعال نیست
      try { const ld = r.lines ? r.lines.map((ln) => ln.data) : (r.multi ? [r.upper, r.basis, r.lower] : [r.line]); lastIndValRef.current[ov.id] = ld.map((a) => a && a.length ? a[a.length - 1] : null).filter((v) => v != null && Number.isFinite(v)); } catch (e) { /* */ }
    });
    try { chart.applyOptions({ leftPriceScale: { visible: anyLeft, borderColor: TH.grid } }); } catch (e) {}
  }, [overlays, TH]);

  // ── سریِ حجم (هیستوگرامِ پایینِ چارت، مثلِ TradingView) ──
  // overlay روی مقیاسِ قیمتِ مستقل (priceScaleId '') با scaleMargins پایین ⇒ فقط ~۱۸٪ پایینِ پِین را می‌گیرد
  // و مقیاسِ قیمتِ اصلی را فشرده نمی‌کند. رنگِ هر میله سبز/قرمز برحسبِ جهتِ کندل. پایدار (بدونِ وابستگیِ state).
  const applyVolume = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    if (!volSeriesRef.current) {
      if (!showVolumeRef.current) return; // خاموش و هنوز ساخته نشده ⇒ هیچ سری‌ای نساز
      try {
        const v = chart.addSeries(HistogramSeries, { priceScaleId: '', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
        try { v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } }); } catch (e) {}
        volSeriesRef.current = v;
      } catch (e) { return; }
    }
    try { volSeriesRef.current.applyOptions({ visible: !!showVolumeRef.current }); } catch (e) {}
    if (!showVolumeRef.current) return; // خاموش ⇒ فقط پنهان (بدونِ حذف)، دادهٔ قبلی می‌ماند
    try {
      volSeriesRef.current.setData((cs || []).map((c) => ({
        time: c.t, value: c.v || 0,
        color: (c.c >= c.o) ? 'rgba(38,166,154,.5)' : 'rgba(239,83,80,.5)',
      })));
    } catch (e) { /* */ }
  }, []);
  // توگلِ حجم: ماندگاری + همگام‌سازیِ ref + اعمال/حذفِ فوری بدونِ رفرشِ داده
  useEffect(() => { showVolumeRef.current = showVolume; saveWS({ showVolume }); applyVolume(candlesRef.current); }, [showVolume, applyVolume]);

  const applySubs = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    // حذفِ سری‌های ساب قبلی (pane نیتیوِ v5 — روی همان چارت)
    Object.values(subChartsRef.current).flat().forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    subChartsRef.current = {};
    if (subWrapRef.current) subWrapRef.current.innerHTML = '';
    const c = { open: cs.map((x) => x.o), high: cs.map((x) => x.h), low: cs.map((x) => x.l), close: cs.map((x) => x.c), volume: cs.map((x) => x.v || 0) };
    const subList = subs.filter((sub) => { const d = REGISTRY[sub.key]; return d && d.pane === 'sub' && sub.visible !== false; }); // تبِ Style: نمایش/مخفی
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
        (r.guides || []).forEach((g) => l1.createPriceLine({ price: g, color: TH.grid, lineWidth: 1, lineStyle: 2 }));
      }
      try { const panes = chart.panes(); if (panes && panes[pane]) panes[pane].setHeight(108); } catch (e) {}
      subChartsRef.current[sub.id] = arr;
      indLabelRef.current[sub.id] = { label: def.label, color: sub.color || def.color };
      try { const last = r.line && r.line.length ? r.line[r.line.length - 1] : null; lastIndValRef.current[sub.id] = (last != null && Number.isFinite(last)) ? [last] : []; } catch (e) { /* */ }
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
      if (s) { const data = chartType === 'heikin' ? heikin(merged) : merged; s.setData((['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) ? valSeries(data) : ohlc(data)); }
      applyOverlays(merged); applySubs(merged); applyVolume(merged);
      if (drawRef.current) drawRef.current.setCandles(merged);
    } catch (e) { /* */ } finally { lz.loading = false; }
  }, [symbol, tf, chartType, applyOverlays, applySubs, applyVolume]);
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
      buildPriceSeries(cs); applyOverlays(cs); applySubs(cs); applyVolume(cs);
      if (drawRef.current) drawRef.current.setCandles(cs);
      chartRef.current && chartRef.current.timeScale().fitContent();
      if (showVP) applyVP(cs);
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
  // نگه‌داشتنِ خودکارِ میزِکار (نماد/تایم‌فریم/نوعِ چارت/تم/اندیکاتورها) — رفرش/خروج پاکش نمی‌کند
  useEffect(() => { saveWS({ symbol, tf, chartType, theme, overlays, subs }); }, [symbol, tf, chartType, theme, overlays, subs]);
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);
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
    const data = cs || candlesRef.current; if (!data.length) { drawRef.current.setProfile(null); return; }
    let lo = Infinity, hi = -Infinity;
    data.forEach((c) => { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); });
    const B = 48, step = (hi - lo) / B || 1, buckets = Array.from({ length: B }, (_, i) => ({ lo: lo + i * step, hi: lo + (i + 1) * step, vol: 0, poc: false }));
    data.forEach((c) => { const w = (c.v || 1); const mid = (c.h + c.l) / 2; const bi = Math.min(B - 1, Math.max(0, Math.floor((mid - lo) / step))); buckets[bi].vol += w; });
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

  useEffect(() => { if (drawRef.current) { showVP ? applyVP() : drawRef.current.setProfile(null); } }, [showVP, applyVP]);
  useEffect(() => { if (drawRef.current) drawRef.current.setMagnet(magnet, magnetMode); saveWS({ magnetMode }); }, [magnet, magnetMode]);
  // کراس‌هیر (فصل ۳): حالتِ Cross/Dot/Arrow/Hidden + یکپارچه‌سازیِ Magnet با CrosshairMode
  useEffect(() => {
    const ch = chartRef.current; if (!ch) return;
    const { crosshair, _ui } = crosshairOptions(crosshairId, magnet, TH);
    // تگِ محورِ سفارشی فقط وقتی تکِ-پنل است (بدونِ ساب‌پنل) و کراس‌هیر «بدون» نیست فعال می‌شود؛ آنگاه
    // برچسبِ نیتیو خاموش می‌شود تا تکراری نشود. با ساب‌پنل، نیتیو روشن می‌ماند (درستیِ هر پنل حفظ شود).
    const visibleSubs = subs.filter((s) => { const d = REGISTRY[s.key]; return d && d.pane === 'sub' && s.visible !== false; }).length;
    const useAxisTag = crosshairId !== 'hidden' && visibleSubs === 0;
    // رنگ/سبکِ دقیقِ کراس‌هیرِ TradingView: خاکستریِ خنثیِ #9598a1 نقطه‌چین (LineStyle.Dotted=1)
    // در هر دو تم؛ فقط ظاهرِ خط را روی خروجیِ crosshairOptions override می‌کند (visible/label حفظ می‌شود).
    const XH_COLOR = '#9598a1';
    const XH_STYLE = 1;
    ch.applyOptions({ crosshair: { ...crosshair, vertLine: { ...crosshair.vertLine, color: XH_COLOR, style: XH_STYLE, labelVisible: !useAxisTag && crosshair.vertLine.labelVisible }, horzLine: { ...crosshair.horzLine, color: XH_COLOR, style: XH_STYLE, labelVisible: !useAxisTag && crosshair.horzLine.labelVisible } } });
    crosshairGlyphRef.current = _ui.glyph;
    crossTagOnRef.current = useAxisTag;
    if (!useAxisTag) setCrossTag(null);
    if (mainRef.current) mainRef.current.style.cursor = _ui.cursor;
    saveWS({ crosshairId, magnet });
    // eslint-disable-next-line
  }, [crosshairId, magnet, theme, subs]);
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
  useEffect(() => { const tzo = timeZoneOptions(tz); crossTimeFmtRef.current = tzo.localization.timeFormatter; const ch = chartRef.current; if (!ch) return; try { ch.applyOptions(tzo); } catch (e) {} saveWS({ tz }); }, [tz]);
  useEffect(() => { if (drawRef.current) drawRef.current.setStayInMode(stayDraw); }, [stayDraw]);
  // شمارشِ معکوسِ بسته‌شدنِ کندلِ جاری
  useEffect(() => {
    if (NONSTANDARD.includes(chartType)) { setCountdown(''); return undefined; }
    const tick = () => { const rem = secondsToClose(tf, undefined, tz); setCountdown(formatCountdown(rem)); setCountdownColor(countdownTint(rem)); };
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

  // بازهٔ سریعِ نمایش (سطحِ چارت — مثلِ TradingView): فقط رنجِ *دیده‌شده* را تنظیم می‌کند، نه اینتروال.
  const applyQuickRange = (r) => {
    const ch = chartRef.current; if (!ch) return;
    const ts = ch.timeScale();
    try {
      if (r === 'all') { ts.fitContent(); setQuickRange('all'); return; }
      const cs = candlesRef.current;
      const to = cs.length ? cs[cs.length - 1].t : Math.floor(Date.now() / 1000);
      let from;
      if (r === 'ytd') { const d = new Date(); from = Math.floor(new Date(d.getFullYear(), 0, 1).getTime() / 1000); }
      else from = to - r * 86400;
      // اگر بازهٔ خواسته‌شده از قدیمی‌ترین کندلِ موجود عقب‌تر باشد، تا ابتدای داده محدود می‌شود.
      if (cs.length && from < cs[0].t) from = cs[0].t;
      ts.setVisibleRange({ from, to });
      setQuickRange(r);
    } catch (e) { /* noop */ }
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
    if (volSeriesRef.current && showVolumeRef.current) { try { volSeriesRef.current.update({ time: c.t, value: c.v || 0, color: (c.c >= c.o) ? 'rgba(38,166,154,.5)' : 'rgba(239,83,80,.5)' }); } catch (e) {} }
    if (EXT_HISTOGRAM_TYPES.includes(chartType)) { // ستونی: رنگِ live لازم دارد — فقط در بارگذاریِ کاملِ بازپخش به‌روز می‌شود
      try { priceSeriesRef.current.update(columnsLivePoint(candlesRef.current, { up: TH.up, down: TH.down })); } catch (e) {}
      return;
    }
    try { if (['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) priceSeriesRef.current.update({ time: c.t, value: c.c }); else priceSeriesRef.current.update({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }); } catch (e) {}
  }, [chartType, TH]);
  // بازساختِ کاملِ سری از یک برش (برای seek/step-back/scrub — همان مسیرِ enterReplay).
  const replayApplySlice = useCallback((slice) => {
    candlesRef.current = slice;
    buildPriceSeries(slice); applyOverlays(slice); applySubs(slice); applyVolume(slice);
  }, [buildPriceSeries, applyOverlays, applySubs, applyVolume]);

  const enterReplay = () => {
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
    ctrl.enter(full, { startPct: 0.55 }); // onSlice ⇒ سری ساخته می‌شود، onChange ⇒ state ست می‌شود
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
          lv[k] = { mid: v.mid, bid: v.bid, ask: v.ask, dir: prev == null ? 0 : (v.mid > prev ? 1 : v.mid < prev ? -1 : 0) };
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
      magnet: () => setMagnet((v) => !v), stayDraw: () => setStayDraw((v) => !v),
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
      fit: () => { try { chartRef.current.timeScale().fitContent(); } catch (e) {} },
      resetScale: () => { try { chartRef.current.priceScale('right').applyOptions({ autoScale: true }); setScaleLocked(false); } catch (e) {} },
      // نما
      toggleRight: () => setShowRight((v) => !v),
      fullscreen: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else rootRef.current && rootRef.current.requestFullscreen(); } catch (e) {} },
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      indicators: () => setIndDlg(true),
      help: () => setShowShortcuts((v) => !v),
      screenshot: () => quickScreenshot(),
      // چیدمان
      saveLayout: () => saveLayout(),
      cycleGrid: () => setGrid((g) => (g === 1 ? 2 : g === 2 ? 4 : 1)),
      // ترید / بازپخش
      buy: () => quickTrade('buy'), sell: () => quickTrade('sell'),
      replayToggle: () => (replay.on ? exitReplay() : enterReplay()),
      replayStep: () => replayStep(),
    }, { target: window });
    return detach;
    // eslint-disable-next-line
  }, [selDraw, replay.on, treeRefresh, replayStep, quickScreenshot]);

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
        e.preventDefault(); setSymModal(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // §۱۶ منوها: بستن با کلیکِ بیرون یا Escape (رفتارِ استانداردِ Dropdown)
  useEffect(() => {
    if (!ctMenu && !indMenu && !gridMenu && !search && !sessMenu && !cfgMenu && !layoutMenu) return undefined;
    const closeAll = () => { setCtMenu(false); setIndMenu(false); setGridMenu(false); setSearch(''); setSessMenu(false); setCfgMenu(false); setLayoutMenu(false); setTfMenu(false); };
    const onDown = (e) => { if (!e.target.closest('[data-menu]')) closeAll(); };
    const onEsc = (e) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [ctMenu, indMenu, gridMenu, search, sessMenu, cfgMenu, layoutMenu]);

  const filteredSymbols = symbols.filter((s) => s.toLowerCase().includes(search.toLowerCase()));
  const txt = theme === 'dark' ? 'text-gray-200' : 'text-gray-800';

  // #7 متادیتای نمادها (دسته‌بندی/توضیحِ فارسی) — یک‌بار با تغییرِ symbols ساخته می‌شود
  const symbolMeta = useMemo(() => buildMeta(symbols), [symbols]);

  // #3 آیتم‌های Legend (overlays + subs) + مقادیرِ زنده (کراس‌هیر، وگرنه آخرین کندل)
  const legendItems = useMemo(() => ([
    ...overlays.map((o) => ({ id: o.id, key: o.key, scope: 'main', label: REGISTRY[o.key] ? REGISTRY[o.key].label : o.key, color: (o.lineColors && o.lineColors[0]) || o.color || (REGISTRY[o.key] && REGISTRY[o.key].color), visible: o.visible !== false })),
    ...subs.map((o) => ({ id: o.id, key: o.key, scope: 'sub', label: REGISTRY[o.key] ? REGISTRY[o.key].label : o.key, color: o.color || (REGISTRY[o.key] && REGISTRY[o.key].color), visible: o.visible !== false })),
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

  // ── سطحِ چارت (اختلافِ #۱ با TradingView): دکمه‌های سریعِ SELL/BUY + تغییرِ قیمتِ لجند ──
  // Bid/Ask از فیدِ زنده (poll)؛ اگر بروکر bid/ask ندهد، به قیمتِ زنده (mid) برمی‌گردد.
  const _quote = live[symbol] || {};
  const _bidPx = _quote.bid != null ? _quote.bid : livePrice;
  const _askPx = _quote.ask != null ? _quote.ask : livePrice;
  const _spreadPts = (_bidPx != null && _askPx != null) ? Math.abs(_askPx - _bidPx) * Math.pow(10, priceDigits(symbol)) : null;
  const _csNow = candlesRef.current;
  const _lastCandle = _csNow.length ? _csNow[_csNow.length - 1] : null;
  // لجندِ همیشه‌نمای نماد (سبکِ TradingView): وقتی کراس‌هیر فعال نیست، O/H/L/C آخرین کندل با close=قیمتِ زنده نمایش می‌شود
  const _legRnd = (x) => (x == null || !Number.isFinite(x) ? x : Number(Number(x).toFixed(priceDigits(symbol))));
  const _legendShown = legend || (_lastCandle
    ? { open: _legRnd(_lastCandle.o), high: _legRnd(_lastCandle.h), low: _legRnd(_lastCandle.l), close: _legRnd(livePrice != null ? livePrice : _lastCandle.c) }
    : null);
  // تغییرِ کندلِ جاری (زیرِ کراس‌هیر → همان کندل؛ وگرنه آخرین کندل با قیمتِ زنده) — سبز/قرمز مثلِ TV
  const _barOpen = (legend && legend.open != null) ? legend.open : (_lastCandle ? _lastCandle.o : null);
  const _barClose = legend ? (legend.close != null ? legend.close : legend.value) : (livePrice != null ? livePrice : (_lastCandle ? _lastCandle.c : null));
  const _chg = (_barOpen != null && _barClose != null) ? (_barClose - _barOpen) : null;
  const _chgPct = (_chg != null && _barOpen) ? (_chg / _barOpen) * 100 : null;
  const _chgCol = _chg == null ? TH.text : (_chg > 0 ? TH.up : _chg < 0 ? TH.down : TH.text);
  const _showQuickTrade = grid <= 1 && (_bidPx != null || livePrice != null);

  return (
    <div ref={rootRef} dir="rtl" className={`flex flex-col h-full overflow-hidden ${txt}`} style={{ background: TH.bg }}>
      <style>{`.bn-thin-scroll{scrollbar-width:thin}.bn-thin-scroll::-webkit-scrollbar{height:4px;width:4px}.bn-thin-scroll::-webkit-scrollbar-thumb{background:${TH.border};border-radius:4px}.bn-thin-scroll::-webkit-scrollbar-track{background:transparent}`}</style>
      {/* #4 نوارِ بالای فشرده (گوشی + تبلت + لنداسکیپِ کم‌ارتفاع) — تشخیصِ خودکارِ ویوپورت */}
      {compact && (
        <CompactTopBar
          TH={TH} symbol={symbol} livePrice={livePrice} priceDir={priceDir} fmtPrice={fmtPrice} marketOpen={marketOpen}
          tf={tf} chartType={chartType} chartLabel={CHART_TYPES.find((c) => c.id === chartType)?.label}
          SymbolLogo={SymbolLogo}
          onSearch={() => setSymModal(true)} onPickTf={() => setSheet('tf')} onPickType={() => setSheet('type')} onMore={() => setSheet('more')}
        />
      )}
      {/* نوارِ بالا (فقط دسکتاپِ ≥۱۲۸۰px) — در تبلت/گوشی جایش CompactTopBar می‌آید تا wrapِ چندردیفه روی چارت نیفتد */}
      {!compact && (
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b flex-wrap relative" style={{ borderColor: TH.border }}>
        {/* #7 سویچرِ نماد — مدالِ جستجوی حرفه‌ای را باز می‌کند */}
        <button onClick={() => setSymModal(true)} data-menu className="flex items-center gap-2 h-9 px-3 rounded-lg transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)} title="جستجوی نماد (Ctrl+K یا /)">
          <SymbolLogo symbol={symbol} size={20} />
          <span className="font-bold text-sm" dir="ltr" style={{ color: TH.textStrong }}>{symbol}</span>
          <Search size={14} className="opacity-50" />
        </button>
        {marketOpen ? (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: TH.text }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: TH.up }} />
            {/* #44/#67 فلَشِ رنگیِ قیمتِ آخر بر اساسِ جهتِ تیک (سبز بالا / قرمز پایین) — key با هر تیک انیمیشن را دوباره اجرا می‌کند */}
            {livePrice != null
              ? <b key={livePrice} dir="ltr" className={`inline-flex items-center gap-0.5 tabular-nums px-1 rounded ${priceDir === 'up' ? 'flash-up' : priceDir === 'down' ? 'flash-down' : ''}`} style={{ color: priceDir === 'up' ? TH.up : priceDir === 'down' ? TH.down : TH.textStrong }}>{priceDir === 'up' ? <TrendingUp size={12} /> : priceDir === 'down' ? <TrendingDown size={12} /> : null}{fmtPrice(symbol, livePrice)}</b>
              : <span style={{ color: TH.up }}>زنده</span>}
          </span>
        ) : (
          <span className="text-[11px] text-amber-500/80">● بازار بسته</span>
        )}
        <span className="w-px h-6 self-center rounded shrink-0" style={{ background: TH.border, opacity: 0.7 }} />
        {/* اینتروالِ سبکِ TV: منتخب‌های inline + اینتروالِ فعال (اگر منتخب نبود) + dropdownِ کاملِ همه با ستارهٔ منتخب‌سازی */}
        <div data-menu className="flex items-center gap-0.5 rounded-lg p-0.5 relative" style={{ background: TH.subtle }}>
          {(() => { const inline = TFS.filter((t) => tfFavs.includes(t) || t === tf); return inline.map((t) => { const on = tf === t; return (<button key={t} onClick={() => setTf(t)} title={TF_TITLE[t] || t} className="px-2 h-7 rounded-md text-[12px] font-semibold tabular-nums transition-colors duration-[120ms]" dir="ltr" style={on ? { background: TH.accent, color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)' } : { background: 'transparent', color: TH.text }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>{TF_LABEL[t] || t}</button>); }); })()}
          <button onClick={() => setTfMenu((v) => !v)} title="همهٔ اینتروال‌ها" className="px-1 h-7 rounded-md transition-colors duration-[120ms] flex items-center" style={{ color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><ChevronDown size={14} /></button>
          {tfMenu && (
            <div className="absolute z-40 top-9 right-0 border rounded-lg w-40 max-h-[70vh] overflow-auto p-1 pc-pop" style={{ background: TH.panel, borderColor: TH.border }}>
              {TFS.map((t) => { const on = tf === t; const fav = tfFavs.includes(t); return (
                <div key={t} className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded" style={on ? { color: TH.accent, background: TH.chipBg } : { color: TH.textStrong }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBg; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                  <button onClick={() => { setTf(t); setTfMenu(false); }} className="flex-1 text-right tabular-nums" dir="ltr">{TF_LABEL[t] || t} <span className="text-[10px] opacity-50">{TF_TITLE[t]}</span></button>
                  <button onClick={() => toggleTfFav(t)} title={fav ? 'حذف از منتخب' : 'افزودن به منتخب'}><Star size={13} style={fav ? { fill: TH.accent, color: TH.accent } : { color: TH.text, opacity: 0.5 }} /></button>
                </div>); })}
            </div>
          )}
        </div>
        <div data-menu className="relative">
          <button onClick={() => setCtMenu((v) => !v)} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>{(() => { const CtI = (CHART_TYPES.find((c) => c.id === chartType) || {}).Icon || CandlestickChart; return <CtI size={17} />; })()} {CHART_TYPES.find((c) => c.id === chartType)?.label}<ChevronDown size={13} /></button>
          {ctMenu && (<div className="absolute z-40 mt-1 border rounded-lg w-44 max-h-[70vh] overflow-auto pc-pop" style={{ background: TH.panel, borderColor: TH.border }}>{CHART_TYPES.map((ct) => { const I = ct.Icon || CandlestickChart; const on = chartType === ct.id; return (<button key={ct.id} onClick={() => { setChartType(ct.id); setCtMenu(false); }} className="flex items-center gap-2 w-full text-right px-3 py-1.5 text-sm transition-colors duration-[120ms]" style={on ? { color: TH.accent, background: TH.chipBg } : { color: TH.textStrong }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = TH.chipBg; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}><I size={15} style={{ color: on ? TH.accent : TH.text }} /> {ct.label}</button>); })}</div>)}
        </div>
        <div data-menu className="relative">
          <button onClick={() => setIndDlg(true)} className="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Activity size={17} /> اندیکاتورها</button>
          {indMenu && (
            <div className="absolute z-40 mt-1 rounded-lg w-56 max-h-80 overflow-auto p-1 pc-pop" style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
              {indFavs.filter((k) => REGISTRY[k]).length > 0 && (
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
              {Object.entries(REGISTRY).map(([k, d]) => (
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
          )}
        </div>
        <span className="w-px h-6 self-center rounded shrink-0" style={{ background: TH.border, opacity: 0.7 }} />
        <button onClick={openNamaScript} title={bnPrem ? 'نمااسکریپت' : 'ویژهٔ پرمیوم'} className="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-[120ms]" style={editorOpen ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!editorOpen) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!editorOpen) e.currentTarget.style.background = TH.chipBg; }}><Code2 size={17} /> نمااسکریپت{!bnPrem && <Lock size={12} className="opacity-70" />}</button>
        {/* #6 دکمهٔ «هشدار» مستقلِ تولبار (مثلِ Alertِ TV) — پنلِ آلارم‌ها را باز می‌کند */}
        <button onClick={() => { setRightTab('alerts'); setShowRight(true); }} title="افزودنِ هشدارِ قیمت" className="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-[120ms]" style={(rightTab === 'alerts' && showRight) ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!(rightTab === 'alerts' && showRight)) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!(rightTab === 'alerts' && showRight)) e.currentTarget.style.background = TH.chipBg; }}><Bell size={17} /> هشدار</button>
        <button onClick={() => (replay.on ? exitReplay() : enterReplay())} className="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-[120ms]" style={replay.on ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!replay.on) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!replay.on) e.currentTarget.style.background = TH.chipBg; }}><Play size={17} /> بازپخش</button>
        <button onClick={getAiSignal} disabled={aiBusy} className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm text-white disabled:opacity-60 transition-opacity duration-[120ms]" style={{ background: TH.accentAi }} title="ستاپِ کاملِ AI در همین نماد/تایم‌فریم"><Sparkles size={17} className={aiBusy ? 'animate-pulse' : ''} /> سیگنالِ AI {aiQuota && <span className="tabular-nums" dir="ltr">{`(${aiQuota.remaining}/${aiQuota.limit})`}</span>}</button>
        <span className="w-px h-6 self-center rounded shrink-0" style={{ background: TH.border, opacity: 0.7 }} />
        <div data-menu className="relative">
          <button onClick={() => setGridMenu((v) => !v)} className="flex items-center gap-1 px-2 py-1 rounded-md text-sm transition-colors duration-[120ms]" style={grid > 1 ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (grid === 1) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (grid === 1) e.currentTarget.style.background = TH.chipBg; }} title="چند-چارت — انتخابِ چیدمان"><LayoutGrid size={17} /> {grid}× <ChevronDown size={13} /></button>
          {gridMenu && (
            <div className="absolute z-40 mt-1 border rounded-lg w-40 p-1" style={{ background: TH.popoverBg, borderColor: TH.border }}>
              {GRID_PRESET_ORDER.map((pid) => { const L = getGridLayout(pid); const active = legacyGridToPreset(grid) === pid; return (
                <button key={pid} onClick={() => { setGrid(presetToLegacyGrid(pid)); setGridMenu(false); }} className="flex items-center justify-between w-full text-right px-2 py-1.5 text-sm rounded-md transition-colors duration-[120ms]" style={active ? { background: TH.accent, color: '#fff' } : {}} onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <span>{L.label}</span>
                  <span className="tabular-nums opacity-70" dir="ltr">{L.cells}×</span>
                </button>
              ); })}
            </div>
          )}
        </div>
        <select value={scaleMode} onChange={(e) => setScaleMode(Number(e.target.value))} title="نوعِ مقیاس" className="rounded px-1.5 py-1 text-xs outline-none" style={{ background: TH.chipBg, color: TH.text }}>
          {PRICE_SCALE_MODES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
        </select>
        <button onClick={() => setScaleLocked((v) => !v)} title="قفلِ مقیاس (خاموش‌کردنِ خودکار)" className="p-1.5 rounded-md transition-colors duration-[120ms]" style={scaleLocked ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!scaleLocked) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!scaleLocked) e.currentTarget.style.background = TH.chipBg; }}>{scaleLocked ? <Lock size={17} /> : <Unlock size={17} />}</button>
        <Tip label="وارونه‌کردنِ محورِ قیمت — بالا و پایینِ نمودار جابه‌جا می‌شود (مناسبِ تحلیلِ معکوس)"><button onClick={() => setScaleInvert((v) => !v)} title="وارونه‌کردنِ محورِ قیمت (بالا↔پایین)" aria-label="وارونه‌کردنِ محورِ قیمت" className="p-1.5 rounded-md transition-colors duration-[120ms]" style={scaleInvert ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!scaleInvert) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!scaleInvert) e.currentTarget.style.background = TH.chipBg; }}><ArrowUpDown size={16} /></button></Tip>
        <Tip label="بازنشانیِ زوم و مقیاسِ نمودار به حالتِ اولیه (اتوفیت)"><button onClick={() => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); setScaleLocked(false); setScaleInvert(false); } catch (e) {} }} title="بازنشانیِ زوم و مقیاس به حالتِ اولیه" aria-label="بازنشانیِ مقیاس" className="p-1.5 rounded-md transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Scaling size={16} /></button></Tip>
        <select value={crosshairId} onChange={(e) => setCrosshairId(e.target.value)} title="حالتِ کراس‌هیر" className="rounded px-1.5 py-1 text-xs outline-none" style={{ background: TH.chipBg, color: TH.text }}>
          {CROSSHAIR_MODES.map((m) => (<option key={m.id} value={m.id}>{m.label}</option>))}
        </select>
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
        {/* چرخ‌دندهٔ «تنظیماتِ چارت» — ظاهر/مقیاس/کراس‌هیر و توگل‌ها یک‌جا (فقط UI؛ وصل به stateهای موجود) */}
        <div data-menu className="relative">
          <button onClick={() => setCfgMenu((v) => !v)} title="تنظیماتِ چارت (ظاهر، مقیاس، کراس‌هیر)" aria-label="تنظیماتِ چارت" className="p-1.5 rounded-md transition-colors duration-[120ms]" style={cfgMenu ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!cfgMenu) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!cfgMenu) e.currentTarget.style.background = TH.chipBg; }}><Settings2 size={18} /></button>
          {cfgMenu && (
            <div className="absolute z-[60] top-full mt-1 left-0 rounded-xl w-60 p-2 shadow-2xl" dir="rtl" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
              <div className="px-1 pb-1.5 text-[11px] font-bold" style={{ color: TH.textStrong }}>تنظیماتِ چارت</div>
              <button onClick={() => { setCfgMenu(false); setChartSettingsOpen(true); }} className="flex items-center gap-2 w-full text-right px-1.5 py-1.5 mb-1 rounded-md text-[12px] font-semibold" style={{ background: TH.chipBg, color: TH.textStrong }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
                <Settings2 size={14} style={{ color: TH.accent }} />
                <span className="flex-1">تنظیماتِ کاملِ چارت…</span>
              </button>
              <div className="flex items-center justify-between px-1 py-1">
                <span className="text-[12px]" style={{ color: TH.text }}>تمِ نمایش</span>
                <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px]" style={{ background: TH.chipBg, color: TH.textStrong }}>{theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />} {theme === 'dark' ? 'تیره' : 'روشن'}</button>
              </div>
              <div className="px-1 pt-1.5 pb-0.5 text-[11px] opacity-60" style={{ color: TH.text }}>مقیاسِ قیمت</div>
              <div className="flex flex-wrap gap-1 px-1 pb-1">
                {PRICE_SCALE_MODES.map((m) => { const on = scaleMode === m.value; return (
                  <button key={m.value} onClick={() => setScaleMode(m.value)} className="px-2 py-1 rounded-md text-[11px] transition-colors duration-[120ms]" style={on ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{m.label}</button>
                ); })}
              </div>
              <div className="px-1 pt-1 pb-0.5 text-[11px] opacity-60" style={{ color: TH.text }}>کراس‌هیر</div>
              <div className="flex flex-wrap gap-1 px-1 pb-1">
                {CROSSHAIR_MODES.map((m) => { const on = crosshairId === m.id; return (
                  <button key={m.id} onClick={() => setCrosshairId(m.id)} className="px-2 py-1 rounded-md text-[11px] transition-colors duration-[120ms]" style={on ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg, color: TH.text }}>{m.label}</button>
                ); })}
              </div>
              <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              {[
                { on: magnet, set: () => setMagnet((v) => !v), label: 'مگنت (چسبیدن به قیمت)', Icon: Magnet },
                { on: showVolume, set: () => setShowVolume((v) => !v), label: 'حجم (هیستوگرامِ پایین)', Icon: BarChart3 },
                { on: showDataWin, set: () => setShowDataWin((v) => !v), label: 'پنجرهٔ داده', Icon: Table2 },
                { on: showVP, set: () => setShowVP((v) => !v), label: 'پروفایلِ حجم', Icon: BarChart3 },
                { on: sessionsOn, set: () => setSessionsOn((v) => !v), label: 'باندهای سشن', Icon: Activity },
              ].map((row, i) => (
                <button key={i} onClick={row.set} className="flex items-center gap-2 w-full text-right px-1.5 py-1.5 rounded-md text-[12px]" style={{ color: TH.textStrong }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <row.Icon size={14} style={{ color: row.on ? TH.accent : TH.text }} />
                  <span className="flex-1">{row.label}</span>
                  <span className="relative inline-block w-7 h-4 rounded-full transition-colors shrink-0" style={{ background: row.on ? TH.accent : TH.border }}>
                    <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ [row.on ? 'left' : 'right']: '2px' }} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* منوی «چیدمان/لایوت» — ذخیره + بارگذاریِ چیدمان‌های نام‌دار (ارتقای selectِ قبلی به منوی سبکِ TradingView) */}
        <div data-menu className="relative">
          <button onClick={() => setLayoutMenu((v) => !v)} title="چیدمان‌ها (ذخیره/بارگذاری نماد + تایم‌فریم + اندیکاتورها + ترسیم‌ها)" className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs transition-colors duration-[120ms]" style={layoutMenu ? { background: TH.accent, color: '#fff' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!layoutMenu) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!layoutMenu) e.currentTarget.style.background = TH.chipBg; }}><FolderOpen size={16} /> چیدمان <ChevronDown size={12} /></button>
          {layoutMenu && (
            <div className="absolute z-[60] top-full mt-1 right-0 rounded-lg w-56 p-1 pc-pop" dir="rtl" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
              <button onClick={() => { saveLayout(); setLayoutMenu(false); }} className="flex items-center gap-1.5 w-full text-right px-2 py-1.5 text-[12px] rounded" style={{ color: TH.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Save size={13} /> ذخیرهٔ چیدمانِ فعلی</button>
              <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              {layouts.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] opacity-50" style={{ color: TH.text }}>چیدمانی ذخیره نشده</div>
              ) : layouts.map((l) => (
                <button key={l.id} onClick={() => { loadLayout(l.id); setLayoutMenu(false); }} className="flex items-center gap-1.5 w-full text-right px-2 py-1.5 text-[12px] rounded" style={{ color: TH.textStrong }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBg)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><FolderOpen size={12} className="opacity-60" /> <span className="flex-1 truncate">{l.name}</span></button>
              ))}
            </div>
          )}
        </div>
        {/* دکمه‌های تکراریِ تمِ روز/شب و ستارهٔ نوارِ کناری حذف شدند (تم در تنظیمات/پروفایل موجود است؛ نوارِ راست با ریلِ آیکونِ راست کنترل می‌شود). */}
        <AuthMenu theme={theme} />
      </div>
      )}

      {/* #3 نوارِ افقیِ اندیکاتورها حذف شد؛ جایش ChartLegendِ شناورِ روی چارت (پایین‌تر) آمد. */}

      <div dir="ltr" className="flex flex-1 min-h-0 relative">
        {/* نوارِ ابزارِ ترسیم (سمتِ چپ مثلِ TradingView) — در تبلت/گوشی پنهان (#4)، به Drawing-sheet می‌رود تا روی چارت نیفتد */}
        {!compact && (
        <div className="w-12 border-r flex flex-col items-center py-2 gap-1 shrink-0" style={{ borderColor: TH.border }}>
          <div className="flex-1 min-h-0 w-full">
            <ToolRail tool={tool} setTool={setTool} TH={TH} onHelp={setHelpId}
              magnet={magnet} onToggleMagnet={(v) => setMagnet(v)}
              magnetMode={magnetMode} onSetMagnetMode={(m) => setMagnetMode(m)}
              stayInDrawing={stayDraw} onToggleStayInDrawing={(v) => setStayDraw(v)}
              allLocked={allLocked} onLockAll={(v) => { if (drawRef.current) drawRef.current.lockAll(v); setAllLocked(v); treeRefresh(); }}
              allHidden={allHidden} onHideAll={(v) => { if (drawRef.current) drawRef.current.hideAll(v); setAllHidden(v); treeRefresh(); }}
              onRemoveAll={() => { if (drawRef.current) drawRef.current.clearAll(); setAllLocked(false); setAllHidden(false); treeRefresh(); }} />
          </div>
          <div className="h-px w-5 my-0.5" style={{ background: TH.border }} />
          <Tip label="رنگِ ترسیم"><input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-4 h-4 rounded cursor-pointer bg-transparent border-0 p-0" /></Tip>
          <Tip label="پروفایلِ حجم (توزیعِ قیمت)"><button onClick={() => setShowVP((v) => !v)} className={`p-1 rounded-md transition-colors duration-[120ms] ${showVP ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={showVP ? { background: TH.accent } : {}}><BarChart3 size={12} /></button></Tip>
          <div className="h-px w-5 my-0.5" style={{ background: TH.border }} />
          <Tip label="واگرد (Ctrl+Z)"><button onClick={() => { drawRef.current && drawRef.current.undo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canUndo())} className="p-1 rounded opacity-60 hover:opacity-100 disabled:opacity-20"><Undo2 size={12} /></button></Tip>
          <Tip label="ازنو (Ctrl+Y)"><button onClick={() => { drawRef.current && drawRef.current.redo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canRedo())} className="p-1 rounded opacity-60 hover:opacity-100 disabled:opacity-20"><Redo2 size={12} /></button></Tip>
          <Tip label="درختِ آبجکت‌ها (مدیریتِ ترسیم‌ها)"><button onClick={() => { setShowTree((v) => !v); treeRefresh(); }} className={`p-1 rounded-md transition-colors duration-[120ms] ${showTree ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={showTree ? { background: TH.accent } : {}}><List size={12} /></button></Tip>
          <Tip label="پنجرهٔ داده (مقادیرِ زیرِ کراس‌هیر)"><button onClick={() => setShowDataWin((v) => !v)} className={`p-1 rounded-md transition-colors duration-[120ms] ${showDataWin ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={showDataWin ? { background: TH.accent } : {}}><Table2 size={12} /></button></Tip>
          <div className="h-px w-5 my-0.5" style={{ background: TH.border }} />
          <Tip label="پاکِ آخرین ترسیم"><button onClick={() => drawRef.current && drawRef.current.clearLast()} className="p-1 rounded opacity-60 hover:opacity-100"><Minus size={12} /></button></Tip>
          <Tip label="پاکِ همهٔ ترسیم‌ها"><button onClick={() => drawRef.current && drawRef.current.clearAll()} className="p-1 rounded opacity-60 hover:text-red-400"><Trash2 size={12} /></button></Tip>
        </div>
        )}

        {/* چارت — دیگر به paddingِ پایین نیازی نیست؛ ناوبریِ اپ در AppShell زیرِ BazaarNama است */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* #3 Legendِ یکپارچهٔ روی چارت: نماد + اندیکاتورها با کنترل‌های on-hover */}
          {legendItems.length > 0 ? (
            <div dir="rtl">
              <ChartLegend
                items={legendItems} legend={_legendShown} TH={TH} symbol={symbol} tf={tf}
                chartType={chartType} priceDir={priceDir}
                volume={(legend && legend.volume != null) ? legend.volume : (_lastCandle ? _lastCandle.v : undefined)}
                indVals={legendVals} coarse={bp.coarse}
                collapsed={legCollapsed} onCollapse={setLegCollapsed}
                viewMode={legView} onToggleViewMode={() => setLegView((v) => (v === 'compact' ? 'normal' : 'compact'))}
                onToggleVisible={toggleIndVisible}
                onSettings={(it) => setEditInd({ scope: it.scope, id: it.id })}
                onRemove={(it) => rmInd(it.scope, it.id)}
                onDuplicate={duplicateInd}
                onHelp={(it) => setHelpId(it.key)} hasHelp={indHasHelp}
                onClearAll={() => { setOverlays([]); setSubs([]); }}
              />
            </div>
          ) : (
            <Legend legend={_legendShown} TH={TH} symbol={symbol} tf={tf}
              chartType={chartType} priceDir={priceDir}
              volume={(legend && legend.volume != null) ? legend.volume : (_lastCandle ? _lastCandle.v : undefined)} />
          )}
          <div className="relative flex-1 min-h-0"
               style={compact ? { touchAction: 'none', overscrollBehavior: 'none' } : undefined}
               onContextMenu={(e) => {
                 e.preventDefault();
                 const rect = e.currentTarget.getBoundingClientRect();
                 const yy = e.clientY - rect.top;
                 let price = null; try { price = priceSeriesRef.current && priceSeriesRef.current.coordinateToPrice(yy); } catch (err) {}
                 setCtx({ x: e.clientX, y: e.clientY, price, cx: e.clientX - rect.left });
               }}>
            <div ref={mainRef} className="absolute inset-0" />
            <canvas ref={overlayRef} className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }} />
            {/* سطحِ چارت: دکمه‌های سریعِ SELL/BUY (Bid/Ask) + تغییرِ قیمت — گوشهٔ بالا-چپ مثلِ TradingView.
                کلیک → همان تیکتِ سفارشِ موجود (startTrade: پنلِ ترید + خطوطِ Entry/SL/TP روی چارت). */}
            {_showQuickTrade && (
              <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start" dir="ltr" style={{ pointerEvents: 'none' }}>
                {/* سبکِ TV: جعبه‌های outline (پس‌زمینهٔ پنل، حاشیه+متنِ رنگی)، قیمت بالا / برچسب پایین، اسپردِ سادهٔ وسط */}
                <div className="flex items-stretch gap-1.5" style={{ pointerEvents: 'auto' }}>
                  <button type="button" onClick={() => startTrade('sell')} title="فروش (Sell) — بازکردنِ تیکتِ سفارش"
                    className="flex flex-col items-center justify-center px-2.5 py-0.5 rounded-md shadow-sm transition-colors duration-[120ms]"
                    style={{ background: TH.panel, border: `1.5px solid ${TH.down}`, color: TH.down, minWidth: 74 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.down + '14')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = TH.panel)}>
                    <span className="text-[13px] font-bold leading-tight tabular-nums">{fmtPrice(symbol, _bidPx)}</span>
                    <span className="text-[9px] font-bold leading-none tracking-wide opacity-90 -mt-0.5">SELL</span>
                  </button>
                  <div className="flex flex-col items-center justify-center px-0.5" style={{ color: TH.text }}>
                    <span className="text-[11px] tabular-nums leading-tight font-medium">{_spreadPts != null ? Math.round(_spreadPts) : '—'}</span>
                    <span className="text-[8px] leading-none opacity-55">اسپرد</span>
                  </div>
                  <button type="button" onClick={() => startTrade('buy')} title="خرید (Buy) — بازکردنِ تیکتِ سفارش"
                    className="flex flex-col items-center justify-center px-2.5 py-0.5 rounded-md shadow-sm transition-colors duration-[120ms]"
                    style={{ background: TH.panel, border: `1.5px solid ${TH.accent}`, color: TH.accent, minWidth: 74 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.accent + '14')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = TH.panel)}>
                    <span className="text-[13px] font-bold leading-tight tabular-nums">{fmtPrice(symbol, _askPx)}</span>
                    <span className="text-[9px] font-bold leading-none tracking-wide opacity-90 -mt-0.5">BUY</span>
                  </button>
                </div>
                {_chg != null && (
                  <div className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm"
                    dir="ltr" style={{ background: TH.overlayMask, border: `1px solid ${TH.border}`, color: _chgCol, backdropFilter: 'blur(2px)', pointerEvents: 'auto' }}>
                    <span>{_chg >= 0 ? '+' : ''}{Number(_chg).toFixed(priceDigits(symbol))}</span>
                    {_chgPct != null && <span>({_chgPct >= 0 ? '+' : ''}{_chgPct.toFixed(2)}%)</span>}
                  </div>
                )}
              </div>
            )}
            {/* فاز۲: پردهٔ محوِ سینمایی هنگامِ تعویضِ تایم‌فریم/نوعِ چارت */}
            {swapKey > 0 && (
              <div key={swapKey} className="absolute inset-0 z-[15] pointer-events-none pc-chart-swap" style={{ background: TH.bg }} />
            )}
            {/* فاز۲: راهنمای ژستِ بارِ اول (موبایل) */}
            {showGestureHint && compact && (
              <button onClick={dismissGestureHint} className="absolute left-1/2 -translate-x-1/2 z-[22] flex items-center gap-2 px-3.5 py-2 rounded-full text-[11.5px] font-semibold pc-hint-in"
                style={{ bottom: 54, background: TH.popoverBg, color: TH.textStrong, border: `1px solid ${TH.border}`, boxShadow: '0 8px 24px rgba(0,0,0,.28)' }}>
                <span>👆</span>
                <span>{lang === 'en' ? 'Long-press for details · pinch to zoom' : 'برای جزئیات نگه‌دار · با دو انگشت زوم کن'}</span>
                <span style={{ opacity: .5 }}>✕</span>
              </button>
            )}
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
                  <span className="font-bold opacity-70">{DrawingLayer.label(d.type)}</span>
                  <input type="color" value={d.color || '#3b82f6'} onChange={(e) => { drawRef.current.setStyle(selDraw, { color: e.target.value }); treeRefresh(); }} title="رنگ" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                  <div className="flex items-center gap-0.5 tabular-nums" title="ضخامت">{[1, 2, 3].map((w) => (<button key={w} onClick={() => { drawRef.current.setStyle(selDraw, { width: w }); treeRefresh(); }} className={`w-5 rounded transition-colors duration-[120ms] ${Math.round(d.width || 2) === w ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={Math.round(d.width || 2) === w ? { background: TH.accent } : {}}>{w}</button>))}</div>
                  <button onClick={() => { drawRef.current.setStyle(selDraw, { dashed: !d.dashed }); treeRefresh(); }} className={`px-1.5 py-0.5 rounded transition-colors duration-[120ms] ${d.dashed ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.dashed ? { background: TH.accent } : {}} title="خط‌چین">┄</button>
                  <button onClick={() => { drawRef.current.toggleLock(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="قفل">{d.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                  <button onClick={() => { drawRef.current.removeAt(selDraw); treeRefresh(); }} className="opacity-60 hover:text-red-400" title="حذف"><Trash2 size={13} /></button>
                </div>
              );
            })()}
            {/* درختِ آبجکت‌ها (Object Tree) */}
            {showTree && (
              <div className="absolute top-2 left-2 z-30 w-56 rounded-lg border shadow-xl overflow-hidden" style={{ borderColor: TH.border, background: TH.popoverBg }} dir="rtl">
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
                    <div key={i} className={`flex items-center gap-1.5 px-2 py-1 border-b cursor-pointer transition-colors duration-[120ms] ${selDraw === i ? '' : 'hover:bg-black/5'}`} style={selDraw === i ? { borderColor: TH.border, background: TH.chipBgHover } : { borderColor: TH.border }} onClick={() => { setTool('select'); drawRef.current.selectAt(i); }}>
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
            <CountdownChip countdown={countdown} countdownColor={countdownColor} TH={TH} marketOpen={marketOpen} />
            {/* برچسبِ سریِ حجم — لبهٔ بالای باندِ حجم (مثلِ TradingView: «Vol») */}
            {showVolume && (
              <div className="absolute left-2 z-20 pointer-events-none text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
                   style={{ bottom: '18%', color: TH.text, background: TH.overlayMask, backdropFilter: 'blur(2px)', border: `1px solid ${TH.border}` }} dir="ltr">
                <BarChart3 size={11} style={{ opacity: 0.7 }} /><span>حجم · Vol</span>
              </div>
            )}
            <Watermark src={bnLogo} theme={theme} />
            {/* Data Window — کامپوننتِ ChartOverlays: O/H/L/C + تغییر (مطلق/درصد) + حجم + زمان + اندیکاتورهای زیرِ کراس‌هیر */}
            {showDataWin && (
              <DataWindow
                dataWin={dataWin} TH={TH} symbol={symbol} tf={tf}
                fmt={fmtPrice} fmtTime={winTimeFmt}
                onClose={() => setShowDataWin(false)}
                pos={{ top: 48, left: 12 }}
              />
            )}
            {/* #9 تگِ محورِ قیمت (راست) و زمان (پایین) زیرِ کراس‌هیر — از دادهٔ زندهٔ subscribeCrosshairMove */}
            <CrosshairAxisTag price={crossTag && crossTag.price} time={crossTag && crossTag.time} TH={TH} />
            {/* منوی راست‌کلیکِ چارت (ContextMenu — TV-parity) */}
            <ContextMenu
              open={!!ctx} x={ctx ? ctx.x : 0} y={ctx ? ctx.y : 0} TH={TH}
              onClose={() => setCtx(null)}
              items={ctx ? [
                { header: symbol },
                { separator: true },
                { icon: <Activity size={14} />, label: 'افزودنِ اندیکاتور', hotkey: '/', onClick: () => setIndDlg(true) },
                ...(ctx.price != null ? [
                  { icon: <Bell size={14} />, label: `افزودنِ آلارم در ${fmtPrice(symbol, ctx.price)}`, onClick: () => { setAlForm((f) => ({ ...f, op: 'above', value: fmtPrice(symbol, ctx.price) })); setRightTab('alerts'); setShowRight(true); } },
                  { separator: true },
                  { icon: <TrendingUp size={14} />, label: 'لانگ (خرید) — رسمِ رو‌به‌جلو', onClick: () => placeLongShort('buy', ctx.price, ctx.cx) },
                  { icon: <TrendingDown size={14} />, label: 'شورت (فروش) — رسمِ رو‌به‌جلو', onClick: () => placeLongShort('sell', ctx.price, ctx.cx) },
                  { icon: <Activity size={14} />, label: 'ترید واقعی (پنلِ سفارش)', onClick: () => startTrade('buy', ctx.price) },
                  { icon: <Trash2 size={14} />, label: 'پاک‌کردنِ ترسیم‌ها/موقعیت‌ها', danger: true, onClick: () => { try { drawRef.current && drawRef.current.clearAll(); } catch (err) {} setOrder(null); treeRefresh(); } },
                ] : []),
                { separator: true },
                { icon: <Table2 size={14} />, label: 'پنجرهٔ داده', onClick: () => setShowDataWin(true) },
                { icon: <Scaling size={14} />, label: 'بازنشانیِ مقیاس', onClick: () => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); } catch (err) {} } },
                { separator: true },
                { icon: <Settings2 size={14} />, label: 'تنظیماتِ چارت', onClick: () => setChartSettingsOpen(true) },
                { icon: <Maximize2 size={14} />, label: 'تمام‌صفحه', onClick: () => { try { rootRef.current.requestFullscreen(); } catch (err) {} } },
              ] : []}
            />
            {grid > 1 && (
              <div className="absolute inset-0 z-30 grid gap-1 p-1" style={{ background: TH.bg, gridTemplateColumns: grid === 2 ? '1fr 1fr' : '1fr 1fr', gridTemplateRows: grid === 2 ? '1fr' : '1fr 1fr' }}>
                {Array.from({ length: grid }).map((_, i) => (
                  <MiniChart key={i} symbols={symbols} tf={tf} initial={i === 0 ? symbol : (watch[i] || symbols[i] || symbol)} syncBus={syncBusRef.current} />
                ))}
              </div>
            )}
            <ReplayBar replay={replay} TH={TH} replayStepBack={replayStepBack} replayToggle={replayToggle} replayStep={replayStep} replaySeek={replaySeek} replaySetSpeed={replaySetSpeed} exitReplay={exitReplay} />
          </div>
          {/* ردیفِ «بازهٔ سریع» پایینِ چارت (سطحِ چارت — مثلِ TradingView): رنجِ نمایش را تنظیم می‌کند، جدا از اینترval. */}
          {grid <= 1 && !replay.on && (
            <div className="flex items-center gap-1 px-2 py-1 border-t overflow-x-auto bn-thin-scroll shrink-0" dir="ltr" style={{ borderColor: TH.border, background: TH.bg }}>
              {QUICK_RANGES.map(([lbl, r]) => {
                const active = quickRange === r;
                return (
                  <button key={lbl} type="button" onClick={() => applyQuickRange(r)} title={`بازهٔ نمایش: ${lbl}`}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold tabular-nums whitespace-nowrap transition-colors duration-[120ms]"
                    style={active ? { background: TH.accent, color: '#fff' } : { color: TH.text }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBg; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>{lbl}</button>
                );
              })}
            </div>
          )}
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
                  overlays={overlays} subs={subs}
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
              overlays={overlays} subs={subs}
            />
          )
        )}

        {/* ریلِ عمودیِ آیکونِ سمتِ راست (پنل‌سوییچرِ سبکِ TradingView) — آخرین فرزندِ فلکسِ افقی، چسبیده به لبهٔ راست.
            کلیک روی هر آیکون: تبِ راست را انتخاب و پنل را باز می‌کند. جایگزینِ دستگیرهٔ کشوییِ قدیمی است. */}
        {!compact && (
          <RightIconRail active={showRight ? rightTab : null} onSelect={(k) => { setRightTab(k); setShowRight(true); }} TH={TH} />
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
              <div className="px-4 pb-4">
                <button onClick={() => setEditInd(null)} className="w-full py-1.5 rounded-md text-white text-sm transition-opacity duration-[120ms]" style={{ background: TH.accent }}>تأیید</button>
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
      <SymbolSearchModal open={symModal} onClose={() => setSymModal(false)} metaList={symbolMeta} watch={watch} current={symbol} onPick={(s) => setSymbol(s)} TH={TH} coarse={bp.coarse} />

      {/* دیالوگِ کاملِ اندیکاتورها (پاریتیِ TV) — با کلیک روی هر مورد addInd صدا زده می‌شود؛ دیالوگ برای افزودنِ پیاپی باز می‌مانَد */}
      <IndicatorsDialog open={indDlg} onClose={() => setIndDlg(false)} TH={TH} onPick={(key) => { if (REGISTRY[key]) addInd(key); }} />
      {/* دیالوگِ کاملِ «تنظیماتِ چارت» — settings مسطح از stateهای موجود؛ کلیدهای هنوز-وصل‌نشده در overrides نگه‌داری می‌شوند تا UI زنده بماند. */}
      <ChartSettingsDialog
        open={chartSettingsOpen}
        onClose={() => setChartSettingsOpen(false)}
        TH={TH}
        settings={{
          ...chartSettingsOverrides,
          scaleMode,
          scaleInvert,
          scaleLock: scaleLocked,
          slVolume: showVolume,
          crosshairStyle: crosshairId === 'cross' ? 0 : 1,
        }}
        onChange={(patch) => {
          setChartSettingsOverrides((prev) => ({ ...prev, ...patch }));
          if ('scaleMode' in patch) setScaleMode(patch.scaleMode);
          if ('scaleInvert' in patch) setScaleInvert(patch.scaleInvert);
          if ('scaleLock' in patch) setScaleLocked(patch.scaleLock);
          if ('slVolume' in patch) setShowVolume(patch.slVolume);
          if ('crosshairStyle' in patch) setCrosshairId(patch.crosshairStyle === 0 ? 'cross' : 'dot');
        }}
      />

      {/* #4 نسخهٔ موبایل: شیت‌های پایین (ناوبریِ پایینیِ اپ اکنون در AppShell است؛ ابزارها از نوارِ بالا/«بیشتر» باز می‌شوند) */}
      {compact && (
        <>
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
              <button onClick={() => { setSheet('draw'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}><Pencil size={16} /> ابزارِ ترسیم</button>
              <button onClick={() => { setSheet('tabs'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}><Star size={16} /> پنل‌ها</button>
              <button onClick={() => { getAiSignal(); setSheet('none'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: '#fff', background: TH.accentAi }}><Sparkles size={16} /> سیگنالِ AI</button>
              <button onClick={() => { setIndDlg(true); setSheet('none'); }} className="rounded-lg px-3 text-sm flex items-center gap-1.5" style={{ minHeight: 44, color: TH.textStrong, background: TH.chipBg }}><Activity size={16} /> اندیکاتورها</button>
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
