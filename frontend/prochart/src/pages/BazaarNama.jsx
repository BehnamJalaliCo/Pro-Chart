import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries, BarSeries, BaselineSeries, HistogramSeries, createSeriesMarkers } from 'lightweight-charts';
import {
  CandlestickChart, LineChart, AreaChart, BarChart3, Activity, Plus, X, Save,
  Play, Code2, Star, Search, Settings2, Trash2, Bell, FolderOpen, Sun, Moon,
  Minus,
  FlaskConical, ChevronDown, LayoutGrid, Maximize2,
  Magnet, Sparkles,
  Undo2, Redo2, Lock, Unlock, Eye, EyeOff, List, Pencil, Table2, Camera, Copy,
  TrendingUp, TrendingDown, ArrowUpDown, Scaling, Clock, Check,
} from '../bazaarnama/tvIcons';
import { api, tokenStore } from '../api/client';
import { useApp } from '../appStore';
import { tap } from '../app/haptics';
import { REGISTRY } from '../bazaarnama/indicators';
import { BandFillPrimitive } from '../bazaarnama/bandFill';
import { NONSTANDARD, buildNonStandard, avgRange } from '../bazaarnama/chartbuilders';
import { runScript } from '../bazaarnama/namascript';
import { ReplayController, SPEED_LADDER, indexForTime } from '../bazaarnama/ReplayController';
import { runScriptBar } from '../bazaarnama/namascript_bar';
import { DrawingLayer } from '../bazaarnama/drawings';
import ToolRail from '../bazaarnama/ToolRail';
import { EXT_CHART_TYPES, EXT_TYPES, EXT_VALUE_TYPES, EXT_HISTOGRAM_TYPES, buildExtType, columnsLivePoint, kagiSpec, kagiSegmentOptions, pnfColumns, pnfHostOptions, pnfSegmentOptions } from '../bazaarnama/charttypes_ext';
import CodeEditor from '../bazaarnama/CodeEditor';
import BottomDock, { NotesTab, StrategyTesterTab } from '../bazaarnama/BottomDock';
import { EXAMPLES, REFERENCE } from '../bazaarnama/scriptlib';
import bnLogo from '../assets/bn-logo.png';
import MiniChart from '../bazaarnama/MiniChart';
import { parseSymbolExpr, computeSpread } from '../bazaarnama/symbolExpr';
import { resampleCandles } from '../bazaarnama/resample';
import { computeProfile } from '../bazaarnama/volumeProfile';
import { CROSSHAIR_MODES, crosshairModeById, crosshairOptions, paintCrosshairGlyph, PRICE_SCALE_MODES, priceScaleOptions, resetPriceScaleOptions, priceScaleCornerButtons, applyCornerButton, axisBottomControls, SESSIONS, sessionBands, paintSessions, secondsToClose, formatCountdown, countdownTint, TIMEZONES, timeZoneOptions, CH3_DEFAULTS } from '../bazaarnama/scales_crosshair';
import { attachHotkeys, SHORTCUT_GROUPS } from '../bazaarnama/hotkeys';
import { useBreakpoint, MobileToolSheet, CompactTopBar, BREAKPOINTS } from '../bazaarnama/mobile';
import { useViewport } from '../bazaarnama/useViewport';
import { GRID_PRESET_ORDER, getGridLayout, presetToLegacyGrid } from '../bazaarnama/layoutPresets';
import { rafThrottle } from '../bazaarnama/perf';
import { Legend, ChartLegend, SubPaneLegends, CountdownChip, Watermark, ReplayBar, DataWindow, CrosshairAxisTag } from '../bazaarnama/overlays/ChartOverlays';
import { queueIndicatorAlert, queueSeedAlert } from '../bazaarnama/AlertsPanel';
import { symbolCurrencies } from '../bazaarnama/panels/Calendar';
import { technicalRating } from '../bazaarnama/techRating';
import SymbolLogo from '../bazaarnama/SymbolLogo';
import SymbolSearchModal from '../bazaarnama/SymbolSearchModal';
import { buildMeta } from '../bazaarnama/symbolMeta';
import ScreenshotMenu from '../bazaarnama/ScreenshotMenu';
import { captureChart, canvasToBlob, copyBlobToClipboard, downloadBlob } from '../bazaarnama/screenshot';
import RightPanel from '../bazaarnama/RightPanel';
import Partners from '../bazaarnama/Partners';
import IndicatorsDialog from '../bazaarnama/IndicatorsDialog';
import ChartSettingsDialog from '../bazaarnama/ChartSettingsDialog';
import RightIconRail from '../bazaarnama/RightIconRail';
import ContextMenu from '../bazaarnama/ContextMenu';
import AuthMenu from '../AuthMenu';
import HelpModal, { HelpDot } from '../bazaarnama/Help';
import Legal from './Legal';
import { getHelp } from '../bazaarnama/help';
import { advanceLivePriceFrame } from '../bazaarnama/livePriceEasing';
import { HelpCircle } from '../bazaarnama/tvIcons';
import { TVCT } from '../bazaarnama/tvChartIcons';

const TFS = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'M45', 'H1', 'H2', 'H3', 'H4', 'D1', 'W1', 'MN', 'MN3'];

// intrabar (فاز ۶.۳): تایم‌فریمِ ریزتر برای «ذره‌بینِ بار» سبکِ TV — کاربر در replay
// داخلِ یک کندل ریزگام می‌بیند. فقط برای TFهایی که ریزکندلِ منطقی دارند.
const INTRABAR_SUB_TF = { M5: 'M1', M15: 'M5', M30: 'M5', H1: 'M15', H2: 'M15', H3: 'M30', H4: 'H1', D1: 'H1', W1: 'H4', MN: 'D1' };
// باسِ همگام‌سازیِ چندچارتی (زمان + کراس‌هیر) — هر MiniChart مشترک می‌شود
function makeSyncBus() { let subs = []; return { subscribe(fn) { subs.push(fn); return () => { subs = subs.filter((s) => s !== fn); }; }, emit(type, payload, self) { subs.forEach((fn) => { if (fn !== self) fn(type, payload); }); } }; }
// برچسبِ کوتاه + عنوانِ فارسی برای نوارِ تایم‌فریمِ حرفه‌ای
const TF_LABEL = { M1: '1m', M2: '2m', M3: '3m', M5: '5m', M10: '10m', M15: '15m', M30: '30m', M45: '45m', H1: '1H', H2: '2H', H3: '3H', H4: '4H', D1: '1D', W1: '1W', MN: '1Mo', MN3: '3M' };
const TF_TITLE = { M1: '۱ دقیقه', M2: '۲ دقیقه', M3: '۳ دقیقه', M5: '۵ دقیقه', M10: '۱۰ دقیقه', M15: '۱۵ دقیقه', M30: '۳۰ دقیقه', M45: '۴۵ دقیقه', H1: '۱ ساعته', H2: '۲ ساعته', H3: '۳ ساعته', H4: '۴ ساعته', D1: 'روزانه', W1: 'هفتگی', MN: 'ماهانه', MN3: '۳ ماهه' };
// طولِ هر کندل به ثانیه — برای ساختِ کندلِ زندهٔ بعدی و پروجکشنِ رو به جلوی ناحیه‌ها
const TF_SEC = { M1: 60, M2: 120, M3: 180, M5: 300, M10: 600, M15: 900, M30: 1800, M45: 2700, H1: 3600, H2: 7200, H3: 10800, H4: 14400, D1: 86400, W1: 604800, MN: 2592000, MN3: 2592000 * 3 };
const tfSec = (t) => TF_SEC[t] || 3600;
// ── وب‌سوکتِ استریمِ چارتِ سرور (src/api/routes/chart_stream.py) ──
// تایم‌فریم‌هایی که سرورِ استریم مستقیم می‌فهمد (_TF_SECONDS سمتِ سرور). تایم‌فریم‌های مشتق‌شدهٔ
// اپ (DERIVED_TF مثلِ M30/H2/W1/MN و بازه‌های سفارشی) عمداً subscribe نمی‌شوند: چارتشان از
// resampleِ تایم‌فریمِ پایه ساخته می‌شود و tickِ خالص همان applyTick را کامل تغذیه می‌کند.
const WS_STREAM_TFS = new Set(['M1', 'M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1', 'W1', 'MN']);
// نمادِ قابلِ‌استریم — همان قاعدهٔ نرمال‌سازیِ سرور (^[A-Z0-9]{6,20}$). عبارت‌های اسپرد
// (مثلِ EURUSD/GBPUSD که اپ خودش محاسبه می‌کند) و نمادهای نامتعارف WS ندارند؛ poll پوشششان می‌دهد.
const wsStreamSym = (s) => {
  if (typeof s !== 'string') return null;
  const n = s.trim().toUpperCase();
  return /^[A-Z0-9]{6,20}$/.test(n) ? n : null;
};
// آدرسِ استریم از روی VITE_API_URL — هم وبِ نسبی ('/api' ⇒ originِ صفحه) هم APKِ مطلق
// (https://pro-chart.com/api). مسیرِ پایه حفظ و http(s)→ws(s) می‌شود تا به همان
// nginx locationِ /api/academy/chart/stream (با هدرهای Upgrade) برسد.
const wsStreamUrl = (token) => {
  const base = String(import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');
  const u = new URL(base + '/academy/chart/stream', window.location.origin);
  u.searchParams.set('token', token);
  return u.toString().replace(/^http/, 'ws');
};
// دقتِ اعشارِ قیمت بر اساسِ نماد (مثلِ TradingView): JPY=3، طلا=2، شاخص/نفت=2، کریپتو=1، فارکس=5
const priceDigits = (sym = '') => {
  const s = String(sym).toUpperCase();
  if (s.includes('JPY')) return 3;
  if (s.includes('XAU') || s.includes('GOLD')) return 2;
  if (s.includes('XAG')) return 3;
  if (s.includes('BTC') || s.includes('ETH')) return 2; // مثلِ TradingView (مثلاً 64,029.50) — قبلاً ۱ رقم بود
  // رمزارزهای میان‌قیمت (~۱۰ تا ۱۰۰۰ دلار) = ۲ رقم؛ قبلاً به پیش‌فرضِ ۵ می‌افتادند و مثلِ «۶۰۰٫۰۰۰۰۰» زشت می‌شدند.
  if (/BNB|SOL|LTC|BCH|AVAX|DOT|LINK|ATOM|NEAR|UNI|AAVE|XMR/.test(s)) return 2;
  if (/XTI|USOIL|UKOIL|WTI|BRENT/.test(s)) return 2;
  if (/US30|US500|NAS100|DE40|SPX|DJI|NDX|UK100|JP225|US100/.test(s)) return 2;
  return 5;
};
// دقتِ مؤثرِ محورِ قیمت: اگر کاربر در تبِ Symbolِ تنظیمات «دقت» را دستی انتخاب کرده باشد
//   (override عددی) همان استفاده می‌شود؛ وگرنه دقتِ خودکارِ نماد (priceDigits). مثلِ TV → Precision.
const effDigits = (override, sym) => {
  const n = Number(override);
  return (override != null && override !== 'default' && Number.isFinite(n)) ? n : priceDigits(sym);
};
const fmtPrice = (sym, v) => (v == null || !Number.isFinite(Number(v)) ? '—' : Number(v).toFixed(priceDigits(sym)));
// ارزِ مظنه (denomination) برای برچسبِ «Currency»ِ محورِ قیمت (سبکِ TV) — از کدِ انتهاییِ نماد. #306
const quoteCcyOf = (sym = '') => { const s = String(sym).toUpperCase(); if (/USDT$/.test(s)) return 'USDT'; const m = s.match(/(USD|EUR|GBP|JPY|CHF|CAD|AUD|NZD|CNY)$/); if (m) return m[1]; if (/XAU|XAG|OIL|XTI|US30|US500|NAS|SPX|DE40|UK100|JP225/.test(s)) return 'USD'; return ''; };
// دقتِ مقدارِ اندیکاتورهای پنلِ زیرین (نوسان‌گرها) — مستقل از دقتِ قیمتِ نماد و وابسته به بزرگیِ مقدار،
// تا RSI/Stoch/CCI مثلِ TV دو رقم اعشار بگیرند (نه ۵ رقمِ فارکس) و MACDِ ریز هم رقمِ کافی داشته باشد.
const fmtIndVal = (v) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v); const a = Math.abs(n);
  const d = a >= 1 ? 2 : a >= 0.01 ? 4 : a === 0 ? 0 : 6;
  return n.toFixed(d);
};
// فرمتِ قیمتِ محورِ سریِ اصلی (سبکِ TradingView): جداکنندهٔ هزارگان + دقتِ ثابت — فقط روی همین سری
//   (type:'custom' سریِ lightweight-charts) تا اندیکاتورها/حجمِ پنل‌های دیگر دست‌نخورده بمانند.
// نسخهٔ جداکنندهٔ هزارگانِ fmtPrice — برای نمایش‌هایی که باید با محور/جزئیات هم‌راستا باشند (SELL/BUY).
const fmtPriceSep = (sym, v) => {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const d = priceDigits(sym);
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const mkPriceFmt = (d) => ({
  type: 'custom',
  minMove: Math.pow(10, -d),
  formatter: (p) => (p == null || !Number.isFinite(Number(p)) ? '' : Number(p).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })),
});
// برچسبِ فارسیِ ورودی‌های پرکاربردِ اندیکاتور (تبِ «ورودی‌ها»ِ دیالوگ) — تا دیالوگِ کاملاً فارسی، پارامترها را هم فارسی نشان دهد.
// کلیدِ ناموجود ⇒ fallback به کلیدِ Capitalize‌شده (رفتارِ قبلی).
const INPUT_FA = {
  period: 'دوره', length: 'طول', fast: 'تند', slow: 'کند', signal: 'سیگنال', cycle: 'چرخه',
  mult: 'ضریب', k: '٪K', d: '٪D', sum: 'جمع', anchorBars: 'کندلِ لنگر', source: 'منبع', smooth: 'هموارسازی',
  deviation: 'انحراف', atrLength: 'طولِ ATR', factor: 'ضریب', short: 'کوتاه', long: 'بلند',
  count: 'تعداد', left: 'چپ', right: 'راست', dev: 'انحراف٪', n: 'دوره', annual: 'سالانه',
};
const inputLabelFa = (k) => INPUT_FA[k] || (k.charAt(0).toUpperCase() + k.slice(1));
// گزینه‌های منبعِ قیمت برای dropdownِ «منبع» در تنظیماتِ اندیکاتور (هم‌ترازِ source dropdownِ TV).
// برچسب‌های منبع؛ ترکیبی‌ها حروفِ بزرگ مثلِ TV (HL2/HLC3/OHLC4/HLCC4). idها دست‌نخورده (value = 'hl2'…). #262
const SRC_LABELS = [['close', 'بسته'], ['open', 'باز'], ['high', 'سقف'], ['low', 'کف'], ['hl2', 'HL2'], ['hlc3', 'HLC3'], ['ohlc4', 'OHLC4'], ['hlcc4', 'HLCC4']];
// تبِ Visibilityِ اندیکاتور (نمایش بر اساسِ کلاسِ تایم‌فریم، هم‌ترازِ TV). پیش‌فرض/نامعلوم ⇒ همه‌جا دیده می‌شود (بدونِ رگرسیون).
const TF_CLASS = (tf) => (/^MN\d*$/.test(tf) ? 'months' : (tf === 'W1' || /\d+w$/i.test(tf)) ? 'weeks' : (tf === 'D1' || /\d+d$/i.test(tf)) ? 'days' : (tf[0] === 'H' || /\d+h$/i.test(tf)) ? 'hours' : 'minutes');
const tfAllowedVis = (tfVis, tf) => !tfVis || tfVis[TF_CLASS(tf)] !== false;
const VIS_CLASSES = [['minutes', 'دقیقه‌ای'], ['hours', 'ساعتی'], ['days', 'روزانه'], ['weeks', 'هفتگی'], ['months', 'ماهانه']];
// برچسبِ اندیکاتور با پارامترها (سبکِ TradingView: «RSI 14»، «MACD 12 26 9») — فقط ورودی‌های عددی.
// در Legend و پنجرهٔ داده هر دو استفاده می‌شود تا یک‌دست بمانند.
const indBase = (key) => (REGISTRY[key] ? REGISTRY[key].label : key);
const indArgs = (inputs) => {
  const vals = inputs ? Object.values(inputs).filter((v) => typeof v === 'number') : [];
  return vals.length ? vals.join(' ') : '';
};
const indLbl = (key, inputs) => {
  const a = indArgs(inputs);
  return a ? `${indBase(key)} ${a}` : indBase(key);
};
// بازه‌های سریعِ نمایش (سطحِ چارت — مثلِ TradingView): برچسب → تعدادِ روز | 'ytd' | 'all'.
// این رنجِ *نمایش* را تنظیم می‌کند (setVisibleRange)، مستقل از اینتروال/تایم‌فریم.
const QUICK_RANGES = [['1D', 1], ['5D', 5], ['1M', 30], ['3M', 90], ['6M', 180], ['YTD', 'ytd'], ['1Y', 365], ['5Y', 1825], ['All', 'all']];
// پالتِ رنگِ سریع (سبکِ سواچ‌های آماده‌ی TV) — مرورگر این‌ها را زیرِ پیکرِ رنگِ نیتیو نشان می‌دهد.
// یک datalistِ همیشه‌حاضر (id=bnDrawColors) در ریشه رِندر می‌شود؛ همهٔ input[type=color]ها با list به آن وصل‌اند.
const BN_DRAW_COLORS = ['#f23645', '#ff9800', '#ffb300', '#ffeb3b', '#66bb6a', '#089981', '#26a69a', '#2962ff', '#42a5f5', '#7e57c2', '#ec407a', '#ffffff', '#b2b5be', '#787b86', '#000000'];
// تایم‌فریم‌های مشتق‌شده: از تایم‌فریمِ پایه با تجمیع ساخته می‌شوند [پایه, ضریب]
const DERIVED_TF = { M2: ['M1', 2], M3: ['M1', 3], M10: ['M5', 2], M30: ['M15', 2], M45: ['M15', 3], H2: ['H1', 2], H3: ['H1', 3], W1: ['D1', 5], MN: ['D1', 22], MN3: ['D1', 66] };
// «بازهٔ سفارشی» (Add custom intervalِ TV) — ورودیِ «Nm/Nh/Nd» را به {id خوانا, base, factor} تبدیل می‌کند.
// idِ خوانا (مثلِ «90m») باعث می‌شود همهٔ نمایش‌های TF_LABEL[t]||t خودکار درست شوند؛ فقط رزولوِ resample به آن نیاز دارد.
// base از بزرگ‌ترین تایم‌فریمِ نیتیوِ بخش‌پذیر انتخاب می‌شود تا حجمِ فِچ کم بماند. null = نامعتبر/تکراری/نیتیو.
function deriveCustomTf(str) {
  // واحد اختیاری: عددِ خالی = دقیقه (مثلِ TV که «۹۰» را ۹۰دقیقه می‌گیرد). «90m/6h/2d» هم کار می‌کند.
  const m = /^(\d+)\s*([mhdwMHDW]?)$/.exec(String(str || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 10), u = (m[2] || 'm').toLowerCase();
  if (!Number.isFinite(n) || n < 1 || n > 999) return null;
  if (u === 'm') {
    if ([1, 2, 3, 5, 10, 15, 30, 45].includes(n)) return null; // نیتیو/موجود
    for (const [bMin, bId] of [[15, 'M15'], [5, 'M5'], [1, 'M1']]) if (n % bMin === 0) return { id: n + 'm', base: bId, factor: n / bMin };
    return { id: n + 'm', base: 'M1', factor: n };
  }
  if (u === 'h') { if ([1, 2, 3, 4].includes(n)) return null; return { id: n + 'h', base: 'H1', factor: n }; }
  if (u === 'd') { if (n === 1) return null; return { id: n + 'd', base: 'D1', factor: n }; }
  // هفتگیِ سفارشی (واحدِ «w»ِ TV) — هم‌راستا با نگاشتِ استانداردِ W1=D1×5، پس هیچ تقریبِ جدیدی وارد نمی‌شود. #290
  if (u === 'w') { if (n === 1) return null; return { id: n + 'w', base: 'D1', factor: n * 5 }; }
  return null;
}
// تجمیعِ کندل‌ها: هر «factor» کندل → یک کندل
// resampleCandles → به ماژولِ خالصِ testable منتقل شد (bazaarnama/resample.js). رفعِ باگِ هم‌ترازیِ درون‌روزی #475.

// نگه‌داریِ میزِکارِ کاربر در مرورگر تا با رفرش/خروج، نماد/تایم‌فریم/اندیکاتورها/ترسیم‌ها پاک نشوند
const WS_KEY = 'bn_workspace';
const loadWS = () => { try { return JSON.parse(localStorage.getItem(WS_KEY) || '{}') || {}; } catch (e) { return {}; } };
const saveWS = (patch) => { try { localStorage.setItem(WS_KEY, JSON.stringify({ ...loadWS(), ...patch })); } catch (e) { /* noop */ } };

// ── ترسیم‌ها per-symbol (فاز ۵.۱) ─────────────────────────────────────────────
// باگ: پیش‌تر ترسیم‌ها در همان WS_KEY (تک‌کلید) ذخیره می‌شدند، پس هر ترسیمی روی
// **هر** نماد رندر می‌شد — EURUSD ترسیم می‌کردی، به BTCUSD می‌رفتی، همان‌جا بود.
// حالا هر نماد کلیدِ خودش را دارد. سقفِ ۲۰۰ نماد در localStorage تا بی‌کران نشود.
const DRAW_KEY = (sym) => `bn_draw:${String(sym || '').toUpperCase()}`;
const loadSymbolDrawings = (sym) => { try { return JSON.parse(localStorage.getItem(DRAW_KEY(sym)) || '[]') || []; } catch (e) { return []; } };
const saveSymbolDrawings = (sym, drawings) => {
  try {
    const key = DRAW_KEY(sym);
    if (!drawings || !drawings.length) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(drawings));
    // خبرکردنِ سلول‌های چند-چارت (MiniChart همین رویداد را گوش می‌دهد و خطوطِ افقیِ ذخیره‌شده را
    // زنده رفرش می‌کند) — از طریقِ window تا importِ چرخه‌ای BazaarNama↔MiniChart پیش نیاید.
    try { window.dispatchEvent(new CustomEvent('bn:drawingsChanged', { detail: { symbol: String(sym || '').toUpperCase() } })); } catch (e2) { /* noop */ }
  } catch (e) { /* noop */ }
};
// آیکون‌های اختصاصیِ SVG برای نوع‌چارت‌های تخصصی — تا در منوی نوعِ چارت (سبکِ TradingView)
// هر نوع آیکونِ متمایزِ خودش را داشته باشد (قبلاً renko/range/linebreak همه آیکونِ کندل و
// kagi/pnf هر دو آیکونِ خط داشتند و از هم قابلِ‌تشخیص نبودند). اصیل‌اند، نه کپیِ آیکونِ TV.
const _ico = (size, children) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>);
const IcoRenko = ({ size = 16 }) => _ico(size, <><rect x="3" y="13.5" width="6" height="6.5" /><rect x="9" y="8.5" width="6" height="6.5" /><rect x="15" y="3.5" width="6" height="6.5" /></>);
const IcoRange = ({ size = 16 }) => _ico(size, <><path d="M4 7h11" /><path d="M8 12h12" /><path d="M4 17h9" /></>);
const IcoLineBreak = ({ size = 16 }) => _ico(size, <><rect x="6.5" y="3.5" width="11" height="4.5" /><rect x="6.5" y="10" width="11" height="4.5" /><rect x="6.5" y="16.5" width="11" height="4" /></>);
const IcoKagi = ({ size = 16 }) => _ico(size, <><path d="M4 19 L9 6" strokeWidth="3" /><path d="M9 6 L14 15" strokeWidth="1.3" /><path d="M14 15 L20 5" strokeWidth="3" /></>);
const IcoPnf = ({ size = 16 }) => _ico(size, <><path d="M3 5.5 L9 13 M9 5.5 L3 13" strokeWidth="1.8" /><circle cx="17" cy="15" r="3.4" strokeWidth="1.8" /></>);
// کندلِ توخالی: بدنه‌های بی‌پُر (outline) با فتیله — تا از کندلِ پُر متمایز باشد.
const IcoHollow = ({ size = 16 }) => _ico(size, <><line x1="7.5" y1="3.5" x2="7.5" y2="20.5" strokeWidth="1.6" /><rect x="5" y="8" width="5" height="8" strokeWidth="1.6" /><line x1="16.5" y1="5.5" x2="16.5" y2="18.5" strokeWidth="1.6" /><rect x="14" y="9" width="5" height="6" strokeWidth="1.6" /></>);
// پایه (Baseline): خطِ پایهٔ نقطه‌چینِ وسط + خطِ قیمتی که از آن عبور می‌کند.
const IcoBaseline = ({ size = 16 }) => _ico(size, <><line x1="3" y1="12" x2="21" y2="12" strokeWidth="1.3" strokeDasharray="2 2" /><path d="M3 15 L8 9 L12 13 L17 6 L21 10" strokeWidth="1.8" /></>);
// پلکانی (Step): خطِ پله‌ایِ زینه‌ای — متمایز از خطِ ساده.
const IcoStep = ({ size = 16 }) => _ico(size, <path d="M3 17 H8 V12 H13 V15 H18 V8 H21" strokeWidth="1.8" />);
// کندلِ حجمی: کندل‌ها + میله‌های حجمِ کم‌رنگِ پایین.
const IcoVolCandles = ({ size = 16 }) => _ico(size, <><line x1="7" y1="3.5" x2="7" y2="13" strokeWidth="1.5" /><rect x="5" y="6" width="4" height="5" strokeWidth="1.5" /><line x1="16" y1="5" x2="16" y2="13" strokeWidth="1.5" /><rect x="14" y="7" width="4" height="4" strokeWidth="1.5" /><rect x="5" y="16.5" width="4" height="4.5" fill="currentColor" stroke="none" opacity="0.45" /><rect x="14" y="17.5" width="4" height="3.5" fill="currentColor" stroke="none" opacity="0.45" /></>);
// خطی با نشانگر: خط + نقاطِ روی رأس‌ها.
const IcoLwm = ({ size = 16 }) => _ico(size, <><path d="M4 16l5-6 5 4 6-9" strokeWidth="1.6" /><circle cx="4" cy="16" r="1.6" fill="currentColor" stroke="none" /><circle cx="9" cy="10" r="1.6" fill="currentColor" stroke="none" /><circle cx="14" cy="14" r="1.6" fill="currentColor" stroke="none" /><circle cx="20" cy="5" r="1.6" fill="currentColor" stroke="none" /></>);
// ناحیهٔ HLC: پُرکردنِ زیرِ خط.
const IcoHlcArea = ({ size = 16 }) => _ico(size, <><path d="M3 16l5-5 5 3 6-8v14H3z" fill="currentColor" stroke="none" opacity="0.22" /><path d="M3 16l5-5 5 3 6-8" strokeWidth="1.6" /></>);
// ستونی: میله‌های عمودی از خطِ پایه.
const IcoColumns = ({ size = 16 }) => _ico(size, <path d="M5 20v-9M10 20v-14M15 20v-6M20 20v-11" strokeWidth="2.6" />);
// سقف‑کف: میله‌های عمودیِ high-low بدونِ تیکِ open/close.
const IcoHighLow = ({ size = 16 }) => _ico(size, <path d="M6 5v14M12 8v11M18 4v13" strokeWidth="1.8" />);
// نگاشتِ آیکونِ نوع‌چارت‌های تعمیمی (EXT) تا در منو آیکونِ متمایز داشته باشند (نه همه کندل).
const EXT_TYPE_ICON = { volcandles: IcoVolCandles, lwm: TVCT.lwm, hlcarea: TVCT.hlcarea, columns: TVCT.columns, highlow: TVCT.highlow };
// آیکونِ حالتِ کراس‌هیر (اصیل) — سبکِ TV: دکمهٔ آیکونی به‌جای متن. cross=صلیب، dot=نقطه، arrow=پیکان، hidden=بدون.
const CrossModeIcon = ({ id = 'cross', size = 16 }) => {
  if (id === 'dot') return _ico(size, <><path d="M12 3v6M12 15v6M3 12h6M15 12h6" strokeWidth="1.6" /><circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" /></>);
  if (id === 'arrow') return _ico(size, <path d="M5 4l6.5 15 2-6 6-2L5 4z" strokeWidth="1.6" />);
  if (id === 'hidden') return _ico(size, <><circle cx="12" cy="12" r="8.5" strokeWidth="1.6" /><path d="M6 18 L18 6" strokeWidth="1.6" /></>);
  if (id === 'eraser') return _ico(size, <><path d="M8 20H20" strokeWidth="1.6" /><path d="M4.5 13.5l6-6 6 6-4 4h-4l-4-4z" strokeWidth="1.6" strokeLinejoin="round" /></>); // پاک‌کن
  return _ico(size, <path d="M12 3v18M3 12h18" strokeWidth="1.6" />); // cross
};

// ترتیب و گروه‌بندیِ دقیقِ منویِ نوعِ چارتِ TradingView (۶ گروهِ جداشده با خط):
//  میله/کندل → خطی → ناحیه → ستونی → ویژه. (گروهِ volume-profileِ TV — footprint/TPO/session — چون دادهٔ حجم‌در‌قیمت نداریم نیامده.)
// عددِ مثبتِ معتبر یا undefined — برای پارامترهای انواعِ چارتِ غیرِزمانی (خالی/۰/نامعتبر ⇒ پیش‌فرضِ سازنده).
const posNum = (v) => { const n = Number(v); return (v != null && v !== '' && Number.isFinite(n) && n > 0) ? n : undefined; };
// آیکونِ پیش‌نمایشِ چیدمانِ چند-چارت — شبکهٔ cols×rows را از templateِ CSS می‌سازد (هم‌ترازِ آیکون‌های
// گرافیکیِ منوی Layoutِ TradingView که آرایشِ تقسیم را به‌جای متن نشان می‌دهند). عمومی برای هر پریست.
function GridPreview({ cols, rows, color }) {
  const nc = String(cols || '1fr').trim().split(/\s+/).length;
  const nr = String(rows || '1fr').trim().split(/\s+/).length;
  const W = 16, H = 13, p = 1;
  const cw = (W - 2 * p) / nc, ch = (H - 2 * p) / nr;
  const lines = [];
  for (let i = 1; i < nc; i++) lines.push(<line key={'v' + i} x1={p + i * cw} y1={p} x2={p + i * cw} y2={H - p} stroke={color} strokeWidth="1" />);
  for (let j = 1; j < nr; j++) lines.push(<line key={'h' + j} x1={p} y1={p + j * ch} x2={W - p} y2={p + j * ch} stroke={color} strokeWidth="1" />);
  return (<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0" aria-hidden="true"><rect x={p} y={p} width={W - 2 * p} height={H - 2 * p} rx="1.5" fill="none" stroke={color} strokeWidth="1.2" />{lines}</svg>);
}

// فیلدهای تنظیماتِ هر نوعِ چارتِ غیرِزمانی (هم‌ترازِ دیالوگِ «Settings»ِ نوعِ چارتِ TV). خالی ⇒ پیش‌فرضِ خودکار.
const CT_CFG = {
  renko: [{ k: 'renkoBrick', label: 'اندازهٔ آجر', ph: 'ATR خودکار' }, { k: 'atrLen', label: 'طولِ ATR', ph: '۱۴' }],
  range: [{ k: 'rangeSize', label: 'اندازهٔ بازه', ph: 'خودکار' }],
  linebreak: [{ k: 'lineBreakLines', label: 'تعدادِ خط', ph: '۳' }],
  kagi: [{ k: 'kagiReversal', label: 'بازگشت', ph: 'خودکار' }, { k: 'atrLen', label: 'طولِ ATR', ph: '۱۴' }],
  pnf: [{ k: 'pnfBox', label: 'اندازهٔ جعبه', ph: 'خودکار' }, { k: 'pnfReversal', label: 'بازگشت', ph: '۳' }, { k: 'atrLen', label: 'طولِ ATR', ph: '۱۴' }],
};
const CHART_TYPES = [
  { id: 'bars', label: 'میله', Icon: TVCT.bars, grp: 'bar' },
  { id: 'candles', label: 'کندل', Icon: TVCT.candles, grp: 'bar' },
  { id: 'hollow', label: 'توخالی', Icon: TVCT.hollow, grp: 'bar' },
  { id: 'volcandles', label: 'کندلِ حجمی', Icon: IcoVolCandles, grp: 'bar' },
  { id: 'line', label: 'خطی', Icon: TVCT.line, grp: 'line' },
  { id: 'lwm', label: 'خطی با نشانگر', Icon: TVCT.lwm, grp: 'line' },
  { id: 'step', label: 'پلکانی', Icon: TVCT.step, grp: 'line' },
  { id: 'area', label: 'ناحیه', Icon: TVCT.area, grp: 'area' },
  { id: 'hlcarea', label: 'ناحیهٔ HLC', Icon: TVCT.hlcarea, grp: 'area' },
  { id: 'baseline', label: 'پایه', Icon: TVCT.baseline, grp: 'area' },
  { id: 'columns', label: 'ستونی', Icon: TVCT.columns, grp: 'col' },
  { id: 'highlow', label: 'سقف‑کف', Icon: TVCT.highlow, grp: 'col' },
  { id: 'heikin', label: 'هایکین (Heikin Ashi)', Icon: TVCT.heikin, grp: 'special' },
  { id: 'renko', label: 'رنکو (Renko)', Icon: TVCT.renko, grp: 'special' },
  { id: 'linebreak', label: 'شکستِ خط (Line Break)', Icon: TVCT.linebreak, grp: 'special' },
  { id: 'kagi', label: 'کاگی (Kagi)', Icon: TVCT.kagi, grp: 'special' },
  { id: 'pnf', label: 'نقطه‌وشکل (P&F)', Icon: TVCT.pnf, grp: 'special' },
  { id: 'range', label: 'بازه‌ای (Range)', Icon: TVCT.range, grp: 'special' },
];
// ابزارهای ترسیم اکنون در کامپوننتِ ToolRail (گروه‌بندی‌شده، سبکِ TradingView) تعریف می‌شوند.

// پالتِ هم‌ترازِ TradingView (آبیِ برندِ Pro-Chart #2962FF). توکن‌محور — هیچ رنگِ inline.
const THEMES = {
  dark: {
    bg: '#131722', panel: '#1e222d', border: '#2a2e39', grid: '#1e222d',
    gridLine: 'rgba(255,255,255,.05)', // خطِ داخلیِ گرید: بسیار کم‌رنگ مثلِ TV (نه به پررنگیِ border)
    text: '#b2b5be', textStrong: '#d1d4dc',
    up: '#089981', down: '#f23645', // سبز/قرمزِ up/down هم‌ترازِ پالتِ فعلیِ TV (قبلاً #26a69a/#ef5350ِ قدیمی بود؛ تمِ روشن از قبل درست بود)
    // نسخهٔ **متنیِ** روشن‌ترِ رنگِ بازار — فقط برای متنِ UI (اعدادِ SELL/BUY، برچسب‌ها).
    // رنگِ کندل (up/down/accent) دست‌نخورده می‌ماند. AA روی تیره‌ترین سطح: قرمز ۴.۵ · آبی ۵.۰ · سبز ۶.۳
    upText: '#0fb894', downText: '#f6485a', accentText: '#5b8cff',
    chipBg: 'transparent', chipBgHover: 'rgba(255,255,255,.10)', chipActive: 'rgba(255,255,255,.06)',
    subtle: 'rgba(255,255,255,.04)', popoverBg: 'rgba(30,34,45,.98)',
    overlayMask: 'rgba(0,0,0,.42)', accent: '#2962FF', accentAi: '#8b5cf6',
    tpColor: '#22c55e', slColor: '#ef4444', crosshairLabelBg: '#4c525e',
    railIcon: '#e8eaed', // آیکونِ ریلِ ابزار: در تمِ تیره پررنگ و روشن (نه خاکستری)
  },
  light: {
    // panel سفیدِ خالص (LUXE_SPEC §۱): جداسازیِ پنل با مویی است، نه تفاوتِ خاکستریِ نامرئی
    bg: '#ffffff', panel: '#ffffff', border: '#e0e3eb', grid: '#e0e3eb',
    gridLine: 'rgba(42,46,57,.06)', // خطِ داخلیِ گرید: بسیار کم‌رنگ مثلِ TV (border پررنگ‌تر می‌ماند)
    text: '#5d606b', textStrong: '#131722',
    up: '#089981', down: '#f23645',
    // متن‌های جهت‌دارِ تمِ روشن باید روی panel/tint/flash هم WCAG AA بمانند؛
    // رنگ‌های اصلیِ نمودار و حاشیه‌ها عمداً دست‌نخورده‌اند.
    upText: '#086d5c', downText: '#b42335', accentText: '#1e53e5',
    chipBg: 'transparent', chipBgHover: 'rgba(0,0,0,.08)', chipActive: 'rgba(0,0,0,.06)',
    subtle: 'rgba(0,0,0,.03)', popoverBg: 'rgba(255,255,255,.98)',
    overlayMask: 'rgba(255,255,255,.8)', accent: '#2962FF', accentAi: '#7c3aed',
    tpColor: '#22c55e', slColor: '#ef4444', crosshairLabelBg: '#434651',
    railIcon: '#000000', // آیکونِ ریلِ ابزار: مشکیِ کامل در تمِ روشن
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
  const volMaRef = useRef(null); // خطِ میانگینِ متحرکِ حجم (SMA 20) روی هیستوگرام — مثلِ اندیکاتورِ Volumeِ پیش‌فرضِ TV
  const drawRef = useRef(null);
  const drawClipRef = useRef(null); // کلیپ‌بوردِ ترسیم برای کپی/چسباندن (Ctrl+C/Ctrl+V مثلِ TV)
  const overlaySeries = useRef({});
  const subChartsRef = useRef({});
  const scriptSeries = useRef([]);
  const scriptHlines = useRef([]);
  const candlesRef = useRef([]);
  const liveLineRef = useRef(null);
  const practiceLineRef = useRef(null); // { lines:[], series } — خطوطِ ورود/SL/TP معاملهٔ تمرینی روی چارت
  const hiLoLinesRef = useRef(null); // { hi, lo, series } — برچسبِ سقف/کفِ بازهٔ دیده‌شده روی محور (Scales tab)
  const prevCloseLineRef = useRef(null); // { series, line } — خطِ بستهٔ روزِ قبل (Previous close price line سبکِ TV؛ Scales tab)
  const practicePosRef = useRef(null);  // آینهٔ practice.pos برای بررسیِ برخوردِ SL/TP در حلقهٔ بازپخش
  const practiceCloseAtRef = useRef(null); // آینهٔ practiceCloseAt برای صدا زدن از replayApplyStep
  const lastMidRef = useRef({});
  const symbolRef = useRef('EURUSD'); // نمادِ جاری برای استفاده در هندلرهای mount-time (کراس‌هیر)
  const lazyRef = useRef({ loading: false, exhausted: false }); // بارگذاریِ تنبلِ تاریخ
  const loadSeqRef = useRef(0); // نگهبانِ نسل: بارگذاریِ کهنه (نمادِ قبلی) نباید سریِ جدید را بازنویسی کند
  const loadMoreRef = useRef(null);
  const easeRef = useRef({ target: null, display: null, lastApplied: null, wake: null }); // انیمیشنِ نرمِ قیمتِ زنده (حسِ تیک‌به‌تیک)

  const [symbol, setSymbol] = useState(() => loadWS().symbol || 'EURUSD');
  const [tf, setTf] = useState(() => loadWS().tf || 'H1');
  const tfRef = useRef(tf); tfRef.current = tf; // مرآتِ پایدارِ tf برای بررسیِ Visibilityِ اندیکاتور در رندر
  const [chartType, setChartType] = useState(() => loadWS().chartType || 'candles');
  // پارامترهای انواعِ چارتِ غیرِزمانی (Renko/Range/Line-break/Kagi/P&F) — هم‌ترازِ دیالوگِ تنظیماتِ نوعِ چارتِ TV.
  // خالی ⇒ سازنده به پیش‌فرضِ ATR/avgRange برمی‌گردد. ماندگار در میزِکار.
  const [ctParams, setCtParams] = useState(() => loadWS().ctParams || {});
  const ctParamsRef = useRef(ctParams);
  const [ctCfgOpen, setCtCfgOpen] = useState(false); // پاپ‌اوورِ تنظیماتِ نوعِ چارتِ غیرِزمانی
  const [theme, setTheme] = useState(() => useApp.getState().theme || loadWS().theme || 'light');
  // بذرِ جهانِ نماد با هستهٔ تأییدشده (پیش‌فرضِ واچ‌لیست). اندپوینتِ chartSymbols ورود می‌خواهد؛
  // برای بازدیدکنندهٔ خارج‌شده یا در فاصلهٔ بارگذاریِ آسنک، جستجو حداقل روی این هسته کار می‌کند
  // (کاربرِ واردشده با setSymbolsِ آسنک به جهانِ کامل جایگزین می‌شود).
  const [symbols, setSymbols] = useState(['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'XAUUSD']);
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
  const [crossMenu, setCrossMenu] = useState(false); // منوی حالتِ کراس‌هیر (دکمهٔ آیکونی به‌جای select متنی — سبکِ TV)
  const [scaleMenu, setScaleMenu] = useState(false);
  const [intrabarOn, setIntrabarOn] = useState(() => loadWS().intrabar === true); // ذره‌بینِ بارِ replay (۶.۳) // منوی حالتِ مقیاسِ قیمت (دکمهٔ نشانِ کوتاه به‌جای select متنی — سبکِ TV: log/%/…)
  // اینتروال سبکِ TV: تایم‌فریم‌های منتخبِ inline + dropdownِ کاملِ همه (audit #2)
  const [tfMenu, setTfMenu] = useState(false);
  const [tfSearch, setTfSearch] = useState(''); // فیلترِ جستجوی منوی اینتروال (سبکِ سرچ‌باکسِ بالای منوی تایم‌فریمِ TV)
  useEffect(() => { if (!tfMenu) setTfSearch(''); }, [tfMenu]); // با بسته‌شدنِ منو، جستجو پاک شود
  // پیش‌فرضِ منتخب‌ها هم‌راستا با پیش‌فرضِ TV (که 5m/15m/1h/4h/1D/1W دارد) — افزودنِ 5m برای دسترسیِ سریع به تایم‌فریمِ زیرِ ۱۵دقیقه (اسکالپِ فارکس/کریپتو). فقط پیش‌فرضِ کاربرِ جدید؛ منتخب‌های ذخیره‌شده دست‌نخورده.
  const [tfFavs, setTfFavs] = useState(() => { const f = loadWS().tfFavs; return Array.isArray(f) && f.length ? f.filter((k) => TFS.includes(k)) : ['M5', 'M15', 'H1', 'H4', 'D1', 'W1']; });
  const toggleTfFav = (k) => setTfFavs((p) => { const n = p.includes(k) ? p.filter((x) => x !== k) : [...p, k]; saveWS({ tfFavs: n }); return n; });
  // بازه‌های سفارشیِ کاربر (Add custom intervalِ TV) — [{id, base, factor}]. مقدارِ اولیه از میزِکار.
  const [customTfs, setCustomTfs] = useState(() => (loadWS().customTfs || []).filter((c) => c && c.id && c.base && c.factor));
  const [customTfInput, setCustomTfInput] = useState('');
  // نگاشتِ resampleِ سفارشی {id:[base,factor]} — همگام‌سازیِ اولیه سنکرون تا پیش از اولین load آماده باشد (تایم‌فریمِ ماندگارِ سفارشی).
  const customDerivedRef = useRef((() => { const m = {}; (loadWS().customTfs || []).forEach((c) => { if (c && c.id) m[c.id] = [c.base, c.factor]; }); return m; })());
  useEffect(() => { const m = {}; customTfs.forEach((c) => { m[c.id] = [c.base, c.factor]; }); customDerivedRef.current = m; saveWS({ customTfs }); }, [customTfs]);
  const addCustomTf = () => { const d = deriveCustomTf(customTfInput); if (!d) { setCustomTfInput(''); return; } setCustomTfs((l) => l.some((c) => c.id === d.id) ? l : [...l, d]); customDerivedRef.current[d.id] = [d.base, d.factor]; setCustomTfInput(''); setTf(d.id); setTfMenu(false); };
  const removeCustomTf = (id) => setCustomTfs((l) => l.filter((c) => c.id !== id));
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
    const onOpenSearch = () => setSymModal(true); // کلیک روی نامِ نماد در پنلِ جزئیات → مدالِ جستجو (مثلِ TradingView)
    const onShortcuts = () => setShowShortcuts(true); // «میان‌بُرهای صفحه‌کلید» از منوی همبرگری (هم‌ترازِ Keyboard shortcutsِ TV)
    const onOpenChartSettings = () => setChartSettingsOpen(true); // آیکونِ «ویرایش»ِ سرتیترِ پنلِ جزئیات → دیالوگِ تنظیماتِ چارت (هم‌ترازِ TV)
    window.addEventListener('bn:rightTab', onTab); window.addEventListener('bn:openScript', onScript); window.addEventListener('bn:help', onHelp);
    window.addEventListener('bn:support', onSup); window.addEventListener('bn:terms', onTerms); window.addEventListener('bn:toggleTheme', onThemeT);
    window.addEventListener('bn:setSymbol', onSetSym); window.addEventListener('bn:openSearch', onOpenSearch); window.addEventListener('bn:shortcuts', onShortcuts);
    window.addEventListener('bn:openChartSettings', onOpenChartSettings);
    return () => { window.removeEventListener('bn:rightTab', onTab); window.removeEventListener('bn:openScript', onScript); window.removeEventListener('bn:help', onHelp); window.removeEventListener('bn:support', onSup); window.removeEventListener('bn:terms', onTerms); window.removeEventListener('bn:toggleTheme', onThemeT); window.removeEventListener('bn:setSymbol', onSetSym); window.removeEventListener('bn:openSearch', onOpenSearch); window.removeEventListener('bn:shortcuts', onShortcuts); window.removeEventListener('bn:openChartSettings', onOpenChartSettings); };
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
  const [activeLayoutId, setActiveLayoutId] = useState(null); // چیدمانِ فعال (تیکِ کنارِ نام، مثلِ TV)
  const [techRating, setTechRating] = useState(null); // امتیازِ تکنیکالِ نمادِ فعلی (سبکِ Technicalsِ TV)
  const [compares, setCompares] = useState(() => { const c = loadWS().compares; return Array.isArray(c) ? c : []; }); // نمادهای «مقایسه» (overlay خطی؛ سبکِ TV Compare) — از ورک‌اسپیس بازیابی می‌شود (مثلِ TV که در لِی‌اوت ذخیره می‌کند)
  const comparesRef = useRef(compares); comparesRef.current = compares;
  const [cmpVals, setCmpVals] = useState({}); // مقدارِ زندهٔ هر نمادِ مقایسه زیرِ کراس‌هیر (برای چیپ، مثلِ TV)
  const [cmpChg, setCmpChg] = useState({}); // تغییرِ ٪ِ close-to-closeِ آخرین کندلِ هر مقایسه (رنگی در چیپ، مثلِ لجندِ Compareِ TV). #323
  const [cmpHidden, setCmpHidden] = useState(() => loadWS().cmpHidden || {}); // پنهان/نمایشِ هر خطِ مقایسه (چشمکِ چیپ، مثلِ TV) — جدا از compares تا refetch نکند
  const cmpHiddenRef = useRef(cmpHidden); cmpHiddenRef.current = cmpHidden; // مرآت تا applyCompares (deps=[tf]) مقدارِ جاری را بخواند
  const compareSeriesRef = useRef([]); // سری‌های lightweight-chartsِ مقایسه برای پاکسازی
  const compareDataRef = useRef({}); // دادهٔ خطیِ هر مقایسه (id→[{time,value}]) برای محاسبهٔ تغییرِ زیرِ کراس‌هیر — #326
  const [bt, setBt] = useState(null); // strategy tester result
  const [btCost, setBtCost] = useState({ comm: 0, slip: 0 }); // کارمزد/اسلیپیجِ بک‌تست
  const [btTab, setBtTab] = useState('overview'); // overview | performance | trades
  const [savedAlerts, setSavedAlerts] = useState([]);
  const [alForm, setAlForm] = useState({ op: 'above', value: '', trigger: 'recurring', telegram: false, message: '', expiryH: '' });
  const [live, setLive] = useState({});
  const [marketOpen, setMarketOpen] = useState(false);
  const [livePrice, setLivePrice] = useState(null);
  const [prevDayClose, setPrevDayClose] = useState(null); // بستهٔ سشنِ قبل — برای «تغییرِ روزِ قبل»ِ خطِ وضعیت (مثلِ TV: Last day change)
  // جهتِ حرکتِ قیمتِ زنده (برای فلَشِ سبز/قرمزِ برچسبِ قیمت) — باید بعد از تعریفِ livePrice باشد (وگرنه TDZ)
  const prevLpRef = useRef(null);
  const priceDir = (livePrice != null && prevLpRef.current != null) ? (livePrice > prevLpRef.current ? 'up' : livePrice < prevLpRef.current ? 'down' : '') : '';
  useEffect(() => { prevLpRef.current = livePrice; }, [livePrice]);
  const [atRealtime, setAtRealtime] = useState(true); // آیا چارت روی جدیدترین کندل است؟ (برای دکمهٔ «پرش به حال» سبکِ TV)
  const [countdown, setCountdown] = useState(''); // شمارشِ معکوسِ بسته‌شدنِ کندل
  const [countdownColor, setCountdownColor] = useState(null); // تینتِ نزدیکِ بسته‌شدن (قرمز/کهربایی)
  const [showVP, setShowVP] = useState(loadWS().showVP ?? false); // پروفایلِ حجم — ماندگار مثلِ سایر توگل‌های نما (showVolume/sessionsOn/showDataWin) و مثلِ TV. #315
  const [showVolume, setShowVolume] = useState(loadWS().showVolume ?? true); // حجم (هیستوگرامِ پایینِ چارت) — پیش‌فرض روشن مثلِ TradingView
  const showVolumeRef = useRef(loadWS().showVolume ?? true); // گیتِ پایدار برای applyVolume (بدونِ وابستگی → پایدار)
  const [quickRange, setQuickRange] = useState(null); // بازهٔ سریعِ نمایشِ فعال (1D/5D/…/All) — سطحِ چارت
  const [gotoOpen, setGotoOpen] = useState(false); // پاپ‌اوورِ «پرش به تاریخ»ِ نوارِ پایین (مثلِ Go to dateِ TV)
  const [tzBarOpen, setTzBarOpen] = useState(false); // منوی منطقهٔ زمانیِ نوارِ پایین (کلیکِ ساعت/TZ — مثلِ TradingView)
  const tzBtnRef = useRef(null); // برای موقعیتِ fixedِ منوی TZ (تا از overflow-clip و stacking نوارِ پایین فرار کند)
  const [tzAnchor, setTzAnchor] = useState({ right: 8, bottom: 34 });
  const [magnet, setMagnet] = useState(loadWS().magnet ?? false);
  const [magnetMode, setMagnetMode] = useState(loadWS().magnetMode ?? 'strong'); // قوی/ضعیف (سبکِ TV)
  const [allLocked, setAllLocked] = useState(false); // قفلِ همهٔ ترسیم‌ها (سبکِ TV)
  const [allHidden, setAllHidden] = useState(false); // مخفیِ همهٔ ترسیم‌ها (سبکِ TV)
  const [order, setOrder] = useState(null); // {side, entry, sl, tp} — #D: پیش‌فرض هیچ پوزیشنی باز نیست (از localStorage بازیابی نمی‌شود)
  // حالتِ تمرینِ معامله (مثلِ Bar Replay + paper-trading در TradingView) — کلاینت‌ساید، فقط حینِ بازپخش.
  // pos: { side:'buy'|'sell', entry } | null ؛ realized: مجموعِ سود/زیانِ بسته‌شده (به واحدِ قیمت) ؛ trades: تعدادِ معامله
  const [practice, setPractice] = useState({ pos: null, realized: 0, trades: 0, wins: 0, last: null });
  const [aiSig, setAiSig] = useState(() => loadWS().aiSig || null); // سیگنالِ AI — باگ۳: با رفرش پاک نشود
  const [aiList, setAiList] = useState([]); // همهٔ سیگنال‌های اخیر — همیشه در ساید‌بار می‌مانند
  const [aiBusy, setAiBusy] = useState(false);
  const [aiQuota, setAiQuota] = useState(null);
  const aiLinesRef = useRef([]);
  const aiZonesRef = useRef([]); // سری‌های ناحیهٔ سبز/قرمزِ سیگنالِ AI (پروجکشنِ رو به جلو)
  const alertLinesRef = useRef([]); // خطوطِ قیمتِ آلارم‌های ذخیره‌شده روی چارت (تبِ «آلارم‌ها»ِ تنظیمات)
  const [grid, setGrid] = useState(presetToLegacyGrid(loadWS().gridPreset || '1')); // 1/2/4 چند-چارت (legacy — همگام با gridPreset می‌مانَد)
  // idِ پریستِ کاملِ چیدمان (1/2h/2v/3/4/6/8) — مبنای رِندرِ cols/rows/cells؛ grid فقط برای مصرف‌کننده‌های legacy سینک می‌ماند.
  const [gridPreset, setGridPreset] = useState(loadWS().gridPreset || '1'); // چیدمانِ چند-چارت — ماندگار مثلِ TV (سلول‌ها از واچ‌لیستِ ماندگار پُر می‌شوند). #317
  const [gridMenu, setGridMenu] = useState(false); // منوی پریستِ چیدمانِ چند-چارت (layoutPresets)
  const [syncSymbol, setSyncSymbol] = useState(false); // لینکِ نمادِ چند-چارت (سبکِ TV) — پیش‌فرض خاموش (سلول‌ها مستقل)
  const [syncTime, setSyncTime] = useState(loadWS().syncTime !== false);        // لینکِ زمان/اسکرولِ چند-چارت — پیش‌فرض روشن (مثلِ TV)
  const [syncCrosshair, setSyncCrosshair] = useState(loadWS().syncCrosshair !== false); // لینکِ کراس‌هیرِ چند-چارت — پیش‌فرض روشن (مثلِ TV)
  useEffect(() => { saveWS({ syncTime, syncCrosshair }); }, [syncTime, syncCrosshair]);
  // ── چند-چارتِ واقعی (P2.1): سلولِ ۰ = خودِ چارتِ اصلی ──
  // به‌جای پوشاندنِ چارتِ واقعی با یک MiniChartِ ساده، سلولِ ۰ِ گرید «سوراخِ شفاف» است و
  // رَپرِ چارتِ اصلی با inset پیکسلی دقیقاً روی مستطیلِ همان سلول می‌نشیند — ترسیم/اندیکاتور/ریپلی همه زنده می‌مانند.
  const chartAreaRef = useRef(null); // ناحیهٔ چارت (والدِ positionedِ مشترکِ گرید و رَپر) — مبنای اندازه‌گیری
  const chartWrapRef = useRef(null); // رَپرِ چارتِ واقعی (کانتینرِ lightweight-charts + بومِ ترسیم + اوورلی‌ها)
  const cell0Ref = useRef(null);     // divِ خالیِ سلولِ ۰ — فقط برای گرفتنِ rect
  const [cellRect, setCellRect] = useState(null); // null ⇒ تک‌چارت (inset-0 مثلِ قبل)
  // آینه‌های زندهٔ تاگل‌های سینک برای subscribe-once (همان الگوی MiniChart) — بدونِ re-subscribe با هر تاگل
  const syncTimeRef = useRef(syncTime); syncTimeRef.current = syncTime;
  const syncCrossRef = useRef(syncCrosshair); syncCrossRef.current = syncCrosshair;
  const syncSymRef = useRef(syncSymbol); syncSymRef.current = syncSymbol;
  const gridSymFromBusRef = useRef(null); // نمادِ رسیده از باس — نگهبانِ echo برای emitِ نمادِ چارتِ اصلی
  const [cfgMenu, setCfgMenu] = useState(false); // منوی چرخ‌دندهٔ «تنظیماتِ چارت» (ظاهر/مقیاس/کراس‌هیر)
  const [chartSettingsOpen, setChartSettingsOpen] = useState(false); // دیالوگِ کاملِ «تنظیماتِ چارت» (ChartSettingsDialog)
  const [chartSettingsOverrides, setChartSettingsOverrides] = useState(() => loadWS().chartSettings || {}); // تنظیماتِ دیالوگِ چارت — حالا ماندگار (مثلِ TV که همهٔ تنظیمات را حفظ می‌کند)
  useEffect(() => { saveWS({ chartSettings: chartSettingsOverrides }); }, [chartSettingsOverrides]); // ماندگاریِ همهٔ تنظیماتِ دیالوگ (گرید/کراس‌هیر/پس‌زمینه/برچسبِ سقف‌کف/…)
  const [layoutMenu, setLayoutMenu] = useState(false); // منوی «چیدمان/لایوت» (ذخیره/بارگذاری)
  const [showShortcuts, setShowShortcuts] = useState(false); // دیالوگِ راهنمای میان‌بُرها
  const [symModal, setSymModal] = useState(false); // #7 مدالِ جستجوی نماد
  // مودالِ پارتنرها (LBank/OneRoyal) — تریگرش فقط روی برنچِ توسعه بود و هرگز به main نیامده بود؛
  // اینجا بازوصل شد (رفرالِ #۱۶۲). دکمه CTAِ توپرِ accent است (تنها CTAِ مجازِ تولبار، LUXE §۲.۲).
  const [partnersOpen, setPartnersOpen] = useState(false);
  const [searchSeed, setSearchSeed] = useState(''); // حرفِ اولیه هنگام «تایپ روی چارت → جستجو» (سبکِ TV)
  const [symModalMode, setSymModalMode] = useState('switch'); // 'switch' = تعویضِ نماد | 'compare' = افزودن به مقایسه
  const [sheet, setSheet] = useState('none'); // #4 شیتِ موبایلِ فعال: none|tf|sym|type|draw|ind|tabs
  const [legCollapsed, setLegCollapsed] = useState(() => !!loadWS().legCollapsed); // #3 جمع‌بودنِ Legend
  const [legView, setLegView] = useState(() => loadWS().legView || 'normal'); // #3 normal|compact
  const [indVals, setIndVals] = useState({}); // #3 مقدارِ زندهٔ اندیکاتورها برای Legend
  const [scaleMode, setScaleMode] = useState(loadWS().scaleMode ?? CH3_DEFAULTS.scaleMode); // 0 عادی / 1 لاگ / 2 درصد / 3 پایه۱۰۰
  const scaleModeRef = useRef(scaleMode); scaleModeRef.current = scaleMode; // مرآت تا applyCompares مودِ جاری را بخواند (حالتِ «٪ مشترک»ِ مقایسه) #272
  const [scaleLocked, setScaleLocked] = useState(loadWS().scaleLocked ?? false); // قفلِ بازهٔ مقیاس
  const [scaleInvert, setScaleInvert] = useState(loadWS().scaleInvert ?? false); // وارونگیِ محور
  const [crosshairId, setCrosshairId] = useState(loadWS().crosshairId ?? 'cross'); // حالتِ کراس‌هیر
  const crosshairIdRef = useRef(crosshairId); crosshairIdRef.current = crosshairId; // برای هندلرِ mount (حالتِ «پاک‌کن»)
  const [tz, setTz] = useState(loadWS().tz ?? CH3_DEFAULTS.tz); // منطقهٔ زمانیِ نمایش
  const [tzClock, setTzClock] = useState(''); // ساعتِ زندهٔ نوارِ پایین به‌وقتِ منطقهٔ زمانیِ انتخابی (HH:MM:SS) — مثلِ TradingView
  const [sessionsOn, setSessionsOn] = useState(loadWS().sessionsOn ?? false); // نمایشِ باندهای سشن
  const [sessionSel, setSessionSel] = useState(() => loadWS().sessionSel || SESSIONS.map((s) => s.id)); // #1 سشن‌های انتخابی
  const [sessMenu, setSessMenu] = useState(false); // #1 منوی انتخابِ سشن‌ها
  const crosshairGlyphRef = useRef('none'); // برای رسمِ glyph در هندلرِ کراس‌هیر
  const sessionsRef = useRef(null); // باندهای سشنِ محاسبه‌شدهٔ جاری برای رسم روی overlay
  const [drawColor, setDrawColor] = useState(loadWS().drawColor || '#3b82f6'); // آخرین رنگِ ترسیم — ماندگار مثلِ TV. #316
  // ── فاز ۳: ویرایشِ آبجکت ──
  const [stayDraw, setStayDraw] = useState(loadWS().stayDraw ?? false);   // ماندن در حالتِ ترسیم — ماندگار مثلِ «Stay in Drawing Mode»ِ TV. #316
  const [selDraw, setSelDraw] = useState(-1);          // ایندکسِ آبجکتِ انتخاب‌شده
  const [drawList, setDrawList] = useState([]);        // فهرستِ ترسیم‌ها (Object Tree)
  const [showTree, setShowTree] = useState(false);     // نمایشِ Object Tree
  const [showDrawRail, setShowDrawRail] = useState(() => loadWS().showDrawRail !== false); // نمایش/پنهانِ نوارِ ابزارِ ترسیمِ چپ (مثلِ «Drawings panel»ِ منوی TV)
  const [showDataWin, setShowDataWin] = useState(loadWS().showDataWin ?? false); // Data Window (مقادیرِ زیرِ کراس‌هیر)
  const [dataWin, setDataWin] = useState(null);        // {ohlc, vol, time, inds:[{label,vals,color}]}
  const [crossTag, setCrossTag] = useState(null);      // #9 تگِ محورِ قیمت/زمانِ زیرِ کراس‌هیر {price:{y,text}, time:{x,text}}
  const [axisPlus, setAxisPlus] = useState(null);      // دکمهٔ «+»ِ محورِ قیمت (سبکِ TV) — روی هاور در سطحِ کراس‌هیر {x,y,price}
  const [plusMenu, setPlusMenu] = useState(null);      // منوی فشردهٔ «+»ِ محور (آلارم/خطِ افقی/ترید در قیمت) {x,y,price,cx}
  const [ctx, setCtx] = useState(null);                // منوی راست‌کلیکِ چارت (ContextMenu) { x, y, price, cx } — x/y مختصاتِ viewport، cx مختصاتِ افقیِ نسبی برای placeLongShort
  const indLabelRef = useRef({});                       // id → {label,color} برای Data Window
  const lastIndValRef = useRef({});                     // id → [last values] برای Legend بیرون از کراس‌هیر
  const showDataWinRef = useRef(loadWS().showDataWin ?? false); // گیتِ محاسبهٔ Data Window در هندلرِ کراس‌هیر
  const crossTagOnRef = useRef((loadWS().crosshairId ?? 'cross') !== 'hidden'); // آیا تگِ محور رسم شود (خاموش در حالتِ «بدون»)
  const crossTimeFmtRef = useRef(null);                 // قالب‌بندِ زمانِ TZ-aware برای تگِ محور + پنجرهٔ داده
  const [drawVer, setDrawVer] = useState(0);           // نسخه برای رفرشِ دکمه‌های undo/redo
  const treeRefresh = useCallback(() => { const dl = drawRef.current; setDrawList(dl ? dl.getDrawings().slice() : []); setDrawVer((v) => v + 1); }, []);
  const dragDrawRef = useRef(-1);   // ایندکسِ ردیفِ در حالِ کشیده‌شدن در درختِ آبجکت (drag-to-reorder)
  const [dragOverIdx, setDragOverIdx] = useState(-1);   // ردیفِ زیرِ اشاره‌گر برای خطِ راهنما
  const rootRef = useRef(null);
  const syncBusRef = useRef(null); if (!syncBusRef.current) syncBusRef.current = makeSyncBus(); // باسِ همگام‌سازیِ چندچارتی
  const [replay, setReplay] = useState({ on: false, playing: false, speed: 1, idx: 0, length: 0 });
  const [replayPick, setReplayPick] = useState(false); // حالتِ «کلیک روی چارت برای نقطهٔ شروعِ بازپخش» (سبکِ TV)
  const replayRef = useRef({ full: [], idx: 0 });
  const enterReplayRef = useRef(null); // برای صدا زدنِ enterReplay از هندلرِ کلیک بدونِ وابستگیِ effect
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

  // راهنمای ژستِ موبایل پس از ~۸ثانیه خودکار محو می‌شود (سبکِ هینتِ کوتاهِ TV) تا اگر کاربر تپ نکرد روی چارت نمانَد.
  useEffect(() => {
    if (!showGestureHint || !compact) return undefined;
    const t = setTimeout(() => dismissGestureHint(), 8000);
    return () => clearTimeout(t);
  }, [showGestureHint, compact]);

  // ── ساختِ چارت ──
  useEffect(() => {
    if (!mainRef.current) return;
    const el = mainRef.current;
    const chart = createChart(el, {
      // #۱۰/#۱۸ فیدلیتیِ TradingView: لوگوی پیش‌فرضِ کتابخانه پنهان (لوگوی خودِ بازارنما پایین‌چپ هست)
      // جداکنندهٔ پنل‌ها سبکِ TV: خطِ نازکِ هم‌رنگِ تم، هاورِ اکسنت، قابلِ‌کشیدن برای تغییرِ ارتفاعِ پنل
      layout: { background: { color: TH.bg }, textColor: TH.text, fontFamily: 'IRANYekanX, Ravagh, AnjomanMax, Vazirmatn, sans-serif', fontSize: 12, attributionLogo: false, panes: { separatorColor: TH.grid, separatorHoverColor: TH.accent, enableResize: true } },
      grid: { vertLines: { color: TH.gridLine, style: 1 }, horzLines: { color: TH.gridLine, style: 1 } }, // style:1=Dotted — گریدِ نقطه‌چینِ کم‌رنگ مثلِ TradingView
      // مقیاسِ زمان سبکِ TV: قفلِ رِنج روی resize، آخرین کندل ثابت هنگام اسکرول، فاصلهٔ پایهٔ میله، بدونِ tickِ ریز
      timeScale: {
        timeVisible: true, secondsVisible: false, borderColor: TH.border, rightOffset: 6,
        barSpacing: 8, minBarSpacing: 1.5, lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true, ticksVisible: false,
      },
      // مقیاسِ قیمت سبکِ TV: حاشیهٔ بالا/پایین تا کندل به لبه نچسبد، متنِ کامل، بدونِ tick
      rightPriceScale: { borderColor: TH.border, scaleMargins: { top: 0.12, bottom: 0.08 }, entireTextOnly: true, ticksVisible: false },
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
    // سبکِ پیش‌فرضِ per-toolِ ذخیره‌شده (Save as defaultِ TV) را بارگذاری کن — خالی ⇒ بی‌اثر
    try { dl.setToolDefaults(JSON.parse(localStorage.getItem('bn_draw_defaults') || '{}') || {}); } catch (e) { /* noop */ }
    try { dl.setTfClass(TF_CLASS(tfRef.current)); } catch (e) { /* noop */ } // «نمایش روی تایم‌فریم‌ها»ِ ترسیم (#271)
    try { dl.setTimeFmt((t) => { const f = crossTimeFmtRef.current; return f ? f(t) : ''; }); } catch (e) { /* noop */ } // برچسبِ تاریخِ خطِ عمودی (tz-aware) #281
    // نگه‌داشتنِ خودکارِ ترسیم‌ها در مرورگر + بازیابیِ آن‌ها پس از رفرش
    dl.onChange = (drawings) => { saveSymbolDrawings(symbolRef.current, drawings); setDrawList(drawings.slice()); setDrawVer((v) => v + 1); };
    // حالتِ «پاک‌کن» (Eraserِ TV): کلیک روی ترسیم به‌جای انتخاب، حذفش می‌کند.
    dl.onSelect = (i) => { if (crosshairIdRef.current === 'eraser' && i >= 0) { try { dl.removeAt(i); } catch (e) {} treeRefresh(); } else { setSelDraw(i); } };
    // دابل‌کلیک روی ترسیم (سبکِ TV): متن ⇒ ویرایشِ محتوا با prompt؛ بقیه ⇒ فقط انتخاب (نوارِ سبکِ شناور از onSelect می‌آید).
    dl.onDblEdit = (i) => { try { const d = dl.getDrawings()[i]; if (d && (d.type === 'text' || d.type === 'callout' || d.type === 'note' || d.type === 'signpost')) { const t = window.prompt('متن (برای خطِ جدید «\\n» بنویسید):', d.text || ''); if (t != null) { dl.setStyle(i, { text: t }); treeRefresh(); } } } catch (e) {} };
    // باگ#۲: وقتی ابزار پس از ترسیم به cursor ریست می‌شود، استیتِ React هم همگام شود
    // تا انتخابِ دوبارهٔ همان ابزار دوباره effect را trigger کند (وگرنه ابزارها بعد از یک‌بار/حذف کار نمی‌کنند).
    dl.onToolReset = () => setTool('cursor');
    const savedDr = loadSymbolDrawings(symbolRef.current);
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
      // «پرش به حال» (سبکِ TV): اگر آخرین کندل بیرونِ نمای فعلی باشد، دکمه ظاهر شود.
      if (rng) { const n = candlesRef.current ? candlesRef.current.length : 0; setAtRealtime(rng.to >= n - 1); }
    });
    chart.subscribeCrosshairMove((p) => {
      dl.render();
      const ctx = overlayRef.current && overlayRef.current.getContext('2d');
      if (ctx && sessionsRef.current) paintSessions(ctx, chart, sessionsRef.current, overlayRef.current.height);
      if (ctx && p && p.point) paintCrosshairGlyph(ctx, crosshairGlyphRef.current, p.point.x, p.point.y, TH);
      if (!p || !p.time || !priceSeriesRef.current) {
        setLegend(null); setIndVals({}); setCrossTag(null); setAxisPlus(null);
        // Data Window هنگامِ خروجِ نشانگر مقادیرِ آخرین کندل را نشان می‌دهد (مثلِ TV) — نه placeholder. فقط روی mouse-leave اجرا می‌شود.
        if (showDataWinRef.current) {
          const cc = candlesRef.current; const last = cc && cc.length ? cc[cc.length - 1] : null;
          if (last) {
            const inds2 = [];
            const collectLast = (store) => Object.entries(store).forEach(([id, arr]) => {
              const meta = indLabelRef.current[id]; if (!meta || !arr || !arr.length) return;
              const vals = arr.map((s) => { try { const dd = s.data(); const lp = dd && dd.length ? dd[dd.length - 1] : null; return lp == null ? null : (lp.value != null ? lp.value : lp.close); } catch (e) { return null; } }).filter((v) => v != null);
              if (vals.length) inds2.push({ label: meta.label, color: meta.color, vals });
            });
            collectLast(overlaySeries.current); collectLast(subChartsRef.current);
            setDataWin({ time: last.t, ohlc: { open: last.o, high: last.h, low: last.l, close: last.c }, inds: inds2, vol: last.v != null ? last.v : null });
          } else setDataWin(null);
        }
        return;
      }
      const d = p.seriesData.get(priceSeriesRef.current);
      if (d) {
        // OHLCِ کندلِ زیرِ کراس‌هیر را به دقتِ نماد گِرد کن (مثلِ محور/آخرین‌مقدار) — وگرنه دادهٔ خام
        // مثلِ EURUSD «1.15366864» با ۸ رقم نشان داده می‌شد درحالی‌که محور ۵ رقم است (ناهماهنگ با TV).
        const dg = priceDigits(symbolRef.current);
        const rnd = (x) => (x == null || !Number.isFinite(x) ? x : Number(Number(x).toFixed(dg)));
        setLegend(d.close != null
          ? { ...d, open: rnd(d.open), high: rnd(d.high), low: rnd(d.low), close: rnd(d.close) }
          : { close: rnd(d.value) });
      }
      // مقدارِ زندهٔ هر اندیکاتور زیرِ کراس‌هیر — هم برای Legend (#3) هم Data Window
      const inds = [];
      const lv = {};
      const collect = (store, isPrice) => Object.entries(store).forEach(([id, arr]) => {
        const meta = indLabelRef.current[id]; if (!meta || !arr || !arr.length) return;
        const vals = arr.map((s) => { const sd = p.seriesData.get(s); return sd == null ? null : (sd.value != null ? sd.value : sd.close); }).filter((v) => v != null);
        // اورلیِ پنلِ اصلی روی مقیاسِ قیمت است ⇒ دقتِ قیمت؛ نوسان‌گرِ پنلِ زیرین ⇒ دقتِ وابسته به بزرگی (مثلِ TV).
        if (vals.length) { inds.push({ label: meta.label, color: meta.color, vals }); const pr = meta.precision; lv[id] = vals.map((v) => ((pr != null && pr !== 'default' && Number.isFinite(Number(v))) ? Number(v).toFixed(Number(pr)) : (isPrice ? fmtPrice(symbolRef.current, v) : fmtIndVal(v)))).join(' / '); }
      });
      collect(overlaySeries.current, true); collect(subChartsRef.current, false);
      setIndVals(lv);
      // مقدارِ زندهٔ نمادهای مقایسه زیرِ کراس‌هیر (چیپ مقدار را مثلِ TV نشان می‌دهد).
      if (comparesRef.current.length) { const cv = {}, cc = {}; comparesRef.current.forEach((cmp, idx) => { const s = compareSeriesRef.current[idx]; if (!s) return; const sd = p.seriesData.get(s); const v = sd == null ? null : (sd.value != null ? sd.value : sd.close); if (v != null) { cv[cmp.id] = v; const arr = compareDataRef.current[cmp.id]; if (arr) { const i = arr.findIndex((d) => d.time === p.time); if (i > 0 && arr[i - 1].value) cc[cmp.id] = ((arr[i].value - arr[i - 1].value) / arr[i - 1].value) * 100; } } }); setCmpVals(cv); if (Object.keys(cc).length) setCmpChg(cc); }
      // #9 تگِ محورِ قیمت (راست) + زمان (پایین) زیرِ کراس‌هیر — جایگزینِ برچسبِ نیتیو با دقتِ نماد + TZ.
      if (crossTagOnRef.current && p.point) {
        let py = null; try { py = priceSeriesRef.current.coordinateToPrice(p.point.y); } catch (e) { py = null; }
        const tfmt = crossTimeFmtRef.current;
        setCrossTag({
          price: (py != null && Number.isFinite(py)) ? { y: p.point.y, text: fmtPriceSep(symbolRef.current, py) } : null,
          time: (p.point.x != null) ? { x: p.point.x, text: (tfmt ? tfmt(p.time) : String(p.time)) } : null,
        });
      } else setCrossTag(null);
      // دکمهٔ «+»ِ محورِ قیمت (سبکِ TV) — همیشه روی هاور در سطحِ کراس‌هیر، مستقل از تنظیمِ برچسبِ کراس‌هیر
      if (p.point) {
        let ph = null; try { ph = priceSeriesRef.current.coordinateToPrice(p.point.y); } catch (e) { ph = null; }
        setAxisPlus((ph != null && Number.isFinite(ph)) ? { x: p.point.x, y: p.point.y, price: ph } : null);
      } else setAxisPlus(null);
      if (showDataWinRef.current) {
        const cc = candlesRef.current;
        const bar = cc && cc.length ? cc.find((c) => c.t === p.time) : null;
        // حجمِ کندلِ زیرِ کراس‌هیر — حتی اگر ۰ (فارکس) نمایش داده شود، دقیقاً مثلِ ردیفِ Vol در پنجرهٔ دادهٔ TV؛
        //   قبلاً چکِ truthy بود ⇒ حجمِ ۰ به null می‌افتاد و ردیفِ «حجم» کلاً پنهان می‌شد. #258
        setDataWin({ time: p.time, ohlc: d && d.close != null ? d : null, inds, vol: bar ? (bar.v != null ? bar.v : 0) : null });
      }
    });
    return () => { ro.disconnect(); dl.destroy(); chart.remove(); chartRef.current = null; };
    // eslint-disable-next-line
  }, []);

  // پس‌زمینهٔ چارت از تنظیمات: solid (پیش‌فرض) یا gradientِ عمودی (top=bgColor, bottom=bgColor2).
  // مقادیرِ bgType دقیقاً 'solid'|'gradient' هستند = همان ColorType، پس بدونِ importِ اضافه پاس می‌شوند.
  const bgOpts = (ov = {}) => (ov.bgType === 'gradient'
    ? { type: 'gradient', topColor: ov.bgColor || TH.bg, bottomColor: ov.bgColor2 || ov.bgColor || TH.bg }
    : { color: ov.bgColor || TH.bg });

  // اعمالِ تم
  useEffect(() => {
    const ch = chartRef.current; if (!ch) return;
    const _ov = chartSettingsOverrides;
    ch.applyOptions({ layout: { background: bgOpts(_ov), textColor: TH.text, fontSize: _ov.scaleFontSize || 12, panes: { separatorColor: TH.grid, separatorHoverColor: TH.accent, enableResize: true } }, grid: { vertLines: { color: _ov.gridVertColor || TH.gridLine, visible: _ov.gridVert !== false, style: 1 }, horzLines: { color: _ov.gridHorzColor || TH.gridLine, visible: _ov.gridHorz !== false, style: 1 } }, timeScale: { borderColor: TH.border }, rightPriceScale: { borderColor: TH.border } });
    // eslint-disable-next-line
  }, [theme]);

  // برچسب‌های محورِ بازهٔ دیده‌شده (تنظیماتِ چارت → مقیاس): سقف/کف + میانگینِ بسته — سبکِ TV.
  // خطوطِ قیمتِ داشد با برچسبِ محور که با اسکرول/زوم به مقادیرِ کندل‌های دیده‌شده به‌روز می‌شوند.
  useEffect(() => {
    const ch = chartRef.current; if (!ch) return undefined;
    const wantHL = chartSettingsOverrides.scaleHighLow, wantAvg = chartSettingsOverrides.scaleAvgClose;
    const removeAll = (cur) => { if (cur) ['hi', 'lo', 'avg'].forEach((k) => { if (cur[k]) { try { cur.series.removePriceLine(cur[k]); } catch (e) { /* */ } } }); };
    const clear = () => { removeAll(hiLoLinesRef.current); hiLoLinesRef.current = null; };
    const update = () => {
      const s = priceSeriesRef.current; if ((!wantHL && !wantAvg) || !s) { clear(); return; }
      const cs = candlesRef.current || []; if (!cs.length) return;
      let r = null; try { r = ch.timeScale().getVisibleLogicalRange(); } catch (e) { /* */ }
      const from = r ? Math.max(0, Math.floor(r.from)) : 0;
      const to = r ? Math.min(cs.length - 1, Math.ceil(r.to)) : cs.length - 1;
      let hi = -Infinity, lo = Infinity, sum = 0, n = 0;
      for (let i = from; i <= to; i++) { const cc = cs[i]; if (cc) { if (cc.h > hi) hi = cc.h; if (cc.l < lo) lo = cc.l; sum += cc.c; n++; } }
      if (!n || !Number.isFinite(hi) || !Number.isFinite(lo)) return;
      const avg = sum / n;
      if (!hiLoLinesRef.current || hiLoLinesRef.current.series !== s) { removeAll(hiLoLinesRef.current); hiLoLinesRef.current = { series: s, hi: null, lo: null, avg: null }; }
      const cur = hiLoLinesRef.current;
      const set = (key, price, color, title) => {
        if (price == null) { if (cur[key]) { try { s.removePriceLine(cur[key]); } catch (e) { /* */ } cur[key] = null; } return; }
        if (cur[key]) { try { cur[key].applyOptions({ price }); } catch (e) { /* */ } } else { try { cur[key] = s.createPriceLine({ price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title }); } catch (e) { /* */ } }
      };
      set('hi', wantHL ? hi : null, TH.up, 'سقف');
      set('lo', wantHL ? lo : null, TH.down, 'کف');
      set('avg', wantAvg ? avg : null, TH.text, 'میانگین');
    };
    update();
    let sub = null;
    if (wantHL || wantAvg) { try { sub = () => update(); ch.timeScale().subscribeVisibleLogicalRangeChange(sub); } catch (e) { /* */ } }
    return () => { try { if (sub) ch.timeScale().unsubscribeVisibleLogicalRangeChange(sub); } catch (e) { /* */ } clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartSettingsOverrides.scaleHighLow, chartSettingsOverrides.scaleAvgClose, chartType, symbol, tf, TH]);

  // خطِ «بستهٔ روزِ قبل» (Previous close price line سبکِ TV) — مرجعِ بستهٔ سشنِ گذشته: خطِ داشدِ افقی روی بستهٔ کندلِ روزانهٔ ماقبلِ آخر.
  // مستقل و بی‌صدا: فقط وقتی toggle روشن است fetch/رسم می‌کند؛ پیش‌فرض خاموش ⇒ چارتِ پیش‌فرض کاملاً دست‌نخورده. با تعویضِ نماد/تایم‌فریم دوباره رسم می‌شود.
  useEffect(() => {
    const want = !!chartSettingsOverrides.scalePrevClose;
    const removeLine = () => {
      const cur = prevCloseLineRef.current;
      if (cur && cur.series && cur.line) { try { cur.series.removePriceLine(cur.line); } catch (e) { /* */ } }
      prevCloseLineRef.current = null;
    };
    const s = priceSeriesRef.current;
    if (!want || !s || !symbol) { removeLine(); return undefined; }
    let alive = true;
    (async () => {
      try {
        const res = await api.chart(symbol, 'D1', '', 2);
        const cs = res?.candles || res?.data || res || [];
        const arr = Array.isArray(cs) ? cs : [];
        const prev = arr.length >= 2 ? arr[arr.length - 2] : null;
        const pc = prev && prev.c != null ? Number(prev.c) : null;
        if (!alive || pc == null || !Number.isFinite(pc) || priceSeriesRef.current !== s) return;
        removeLine();
        const line = s.createPriceLine({ price: pc, color: TH.text, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'بستهٔ قبل' });
        prevCloseLineRef.current = { series: s, line };
      } catch (e) { /* بی‌صدا degrade */ }
    })();
    return () => { alive = false; removeLine(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartSettingsOverrides.scalePrevClose, symbol, chartType, tf, TH]);

  // Data Window: همگام‌سازیِ گیتِ ref + ماندگاری
  useEffect(() => {
    showDataWinRef.current = showDataWin; saveWS({ showDataWin });
    if (!showDataWin) { setDataWin(null); return; }
    // هنگامِ روشن‌کردنِ Data Window، بلافاصله آخرین کندل را نشان بده (نه placeholder) — مثلِ TV. فقط اگر چیزی نشان داده نمی‌شود.
    const cc = candlesRef.current; const last = cc && cc.length ? cc[cc.length - 1] : null;
    if (last) {
      const inds2 = [];
      const collectLast = (store) => Object.entries(store).forEach(([id, arr]) => {
        const meta = indLabelRef.current[id]; if (!meta || !arr || !arr.length) return;
        const vals = arr.map((s) => { try { const dd = s.data(); const lp = dd && dd.length ? dd[dd.length - 1] : null; return lp == null ? null : (lp.value != null ? lp.value : lp.close); } catch (e) { return null; } }).filter((v) => v != null);
        if (vals.length) inds2.push({ label: meta.label, color: meta.color, vals });
      });
      collectLast(overlaySeries.current); collectLast(subChartsRef.current);
      setDataWin((prev) => prev || { time: last.t, ohlc: { open: last.o, high: last.h, low: last.l, close: last.c }, inds: inds2, vol: last.v != null ? last.v : null });
    }
  }, [showDataWin]);
  useEffect(() => { saveWS({ showDrawRail }); }, [showDrawRail]);
  // قالب‌بندِ زمانِ پنجرهٔ داده (TZ-aware، از ref که در افکتِ tz ست می‌شود) — پایدار برای پاس‌دادن به DataWindow
  const winTimeFmt = useCallback((t) => { const f = crossTimeFmtRef.current; if (f) { try { return f(t); } catch (e) { /* */ } } return (typeof t === 'number' ? new Date(t * 1000).toLocaleString() : String(t)); }, []);

  useEffect(() => { if (drawRef.current) drawRef.current.setTool(tool, drawColor); saveWS({ drawColor }); }, [tool, drawColor]);
  // «نمایش روی تایم‌فریم‌ها»ِ ترسیم‌ها — با تعویضِ tf کلاسِ آن (minutes/hours/days/…) را به لایه بده تا ترسیم‌های پنهانِ آن کلاس رندر/انتخاب نشوند. #271
  useEffect(() => { if (drawRef.current) drawRef.current.setTfClass(TF_CLASS(tf)); }, [tf]);
  useEffect(() => { try { chartRef.current && chartRef.current.priceScale('right').applyOptions(priceScaleOptions({ mode: scaleMode, locked: scaleLocked, invert: scaleInvert })); saveWS({ scaleMode, scaleLocked, scaleInvert }); } catch (e) {} }, [scaleMode, scaleLocked, scaleInvert]);
  // اعمالِ حاشیه‌های مقیاسِ ذخیره‌شده روی محورِ قیمت هنگامِ بارگذاری/تغییر (patch handler فقط تغییرِ زندهٔ دیالوگ را می‌گیرد).
  useEffect(() => { try { const mt = chartSettingsOverrides.marginTop, mb = chartSettingsOverrides.marginBottom; if (mt == null && mb == null) return; let top = Math.max(0, Math.min(45, mt != null ? mt : 12)) / 100; let bottom = Math.max(0, Math.min(45, mb != null ? mb : 8)) / 100; if (top + bottom > 0.9) { const k = 0.9 / (top + bottom); top *= k; bottom *= k; } chartRef.current && chartRef.current.priceScale('right').applyOptions({ scaleMargins: { top, bottom } }); } catch (e) {} }, [chartSettingsOverrides.marginTop, chartSettingsOverrides.marginBottom]);
  // حاشیهٔ راست بر حسبِ میله (rightOffset) — هم‌ترازِ «Right margin (bars)»ِ تبِ Canvasِ TV؛ فضای خالیِ سمتِ راستِ آخرین کندل.
  useEffect(() => { try { const mr = chartSettingsOverrides.marginRight; if (mr == null) return; chartRef.current && chartRef.current.timeScale().applyOptions({ rightOffset: Math.max(0, Math.min(50, mr)) }); } catch (e) {} }, [chartSettingsOverrides.marginRight]);

  // آینهٔ رفِ تنظیمات تا سری‌سازِ candle همیشه آخرین رنگ‌ها را بخواند بدونِ افزودن به depها
  // (افزودنِ overrides به depهای buildPriceSeries باعثِ رفچِ دوبارهٔ دیتا در افکتِ ۶۹۱ می‌شد).
  const settingsRef = useRef(chartSettingsOverrides); settingsRef.current = chartSettingsOverrides;
  // گزینه‌های رنگِ کندل از دیالوگِ تنظیمات (قبلاً مرده بود). fallback به تمِ up/down؛ toggleهای حاشیه/فتیله.
  const candleOptsFrom = (o = {}, hollow = false) => {
    const up = o.symUpColor || TH.up, down = o.symDownColor || TH.down;
    return {
      upColor: hollow ? 'rgba(0,0,0,0)' : up, downColor: down,
      borderVisible: o.symBordersShown !== false, borderUpColor: o.symBorderUpColor || up, borderDownColor: o.symBorderDownColor || down,
      wickVisible: o.symWickShown !== false, wickUpColor: o.symWickUpColor || up, wickDownColor: o.symWickDownColor || down,
    };
  };
  // نگاشتِ کندل به دیتای سری؛ اگر «رنگِ میله‌ها بر اساسِ بستهٔ قبل» روشن باشد رنگِ هر میله را
  //   نسبت به بستهٔ میلهٔ قبل تعیین می‌کند (سبز اگر close ≥ prevClose، وگرنه قرمز) — مثلِ TV.
  //   پیش‌فرض خاموش ⇒ خروجی دقیقاً همان ohlc() ساده است (رفتارِ فعلی دست‌نخورده).
  const ohlcColored = (cs, o = {}) => {
    const base = cs.map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }));
    if (!o.symBarColorByPrevClose) return base;
    const up = o.symUpColor || TH.up, down = o.symDownColor || TH.down;
    const bUp = o.symBorderUpColor || up, bDown = o.symBorderDownColor || down;
    const wUp = o.symWickUpColor || up, wDown = o.symWickDownColor || down;
    return base.map((d, i) => {
      const prev = i > 0 ? cs[i - 1].c : d.open;
      const u = d.close >= prev;
      return { ...d, color: u ? up : down, borderColor: u ? bUp : bDown, wickColor: u ? wUp : wDown };
    });
  };
  // رنگِ یک میله برای مسیرِ آپدیتِ زنده (applyMid) وقتی «رنگ بر اساسِ بستهٔ قبل» روشن است؛
  //   خاموش ⇒ {} (بدونِ override ⇒ رنگِ سریِ پیش‌فرض). تا میلهٔ زنده با تاریخِ رنگ‌شده هم‌خوان بماند.
  const barTint = (o, prevClose, close) => {
    if (!o.symBarColorByPrevClose) return {};
    const up = o.symUpColor || TH.up, down = o.symDownColor || TH.down;
    const u = close >= prevClose;
    return { color: u ? up : down, borderColor: u ? (o.symBorderUpColor || up) : (o.symBorderDownColor || down), wickColor: u ? (o.symWickUpColor || up) : (o.symWickDownColor || down) };
  };
  // خطِ قیمتِ آخر (priceLineShown) — قبلاً در دیالوگ مرده بود. روی سریِ فعال اعمال می‌شود؛
  // پس از هر ساختِ سری فراخوانی می‌شود تا با تعویضِ نماد/نوع‌چارت هم بماند (settingsRef آخرین مقدار).
  const applyPriceLineVis = () => { try { const on = settingsRef.current.priceLineShown !== false; priceSeriesRef.current && priceSeriesRef.current.applyOptions({ priceLineVisible: on, lastValueVisible: on }); if (liveLineRef.current) liveLineRef.current.applyOptions({ lineVisible: on, axisLabelVisible: on }); } catch (e) {} };

  const buildPriceSeries = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    if (priceSeriesRef.current) { try { chart.removeSeries(priceSeriesRef.current); } catch (e) {} priceSeriesRef.current = null; }
    if (auxSeriesRef.current && auxSeriesRef.current.length) { auxSeriesRef.current.forEach((s) => { try { chart.removeSeries(s); } catch (e) {} }); auxSeriesRef.current = []; }
    // ارتقای رندرِ Kagi (ضخامتِ yang/yin) و P&F (گلیفِ X/O) — پیش از بلوکِ NONSTANDARD رهگیری می‌شوند (فصل ۲ §2.13/§2.14)
    if (chartType === 'kagi') {
      const { segments } = kagiSpec(cs, { up: TH.up, down: TH.down, reversal: posNum(ctParamsRef.current.kagiReversal), atrLen: posNum(ctParamsRef.current.atrLen) });
      const arr = segments.map((seg) => { const ls = chart.addSeries(LineSeries, kagiSegmentOptions(seg)); ls.setData((seg.points || []).filter((p) => p && p.value != null && Number.isFinite(p.value))); return ls; });
      priceSeriesRef.current = arr[0] || null; auxSeriesRef.current = arr.slice(1);
      drawRef.current && arr[0] && drawRef.current.setSeries(arr[0]);
      return;
    }
    if (chartType === 'pnf') {
      const { segments } = pnfColumns(cs, { up: TH.up, down: TH.down, box: posNum(ctParamsRef.current.pnfBox), reversal: posNum(ctParamsRef.current.pnfReversal), atrLen: posNum(ctParamsRef.current.atrLen) });
      // هر ستونِ P&F یک خطِ ضخیمِ نزدیک‌عمودیِ رنگی است (سبزِ X / قرمزِ O). این روش مطمئن
      // رندر می‌شود؛ روشِ قبلی (markers روی خطِ نامرئی) در این نسخهٔ lightweight-charts کشیده نمی‌شد.
      const arr = (segments || []).map((seg) => { const ls = chart.addSeries(LineSeries, pnfSegmentOptions(seg)); ls.setData((seg.points || []).filter((p) => p && p.value != null && Number.isFinite(p.value))); return ls; });
      priceSeriesRef.current = arr[0] || null; auxSeriesRef.current = arr.slice(1);
      drawRef.current && arr[0] && drawRef.current.setSeries(arr[0]);
      return;
    }
    // انواعِ غیراستاندارد (Renko/Range/LineBreak/Kagi/P&F) — داده را بازنویسی می‌کنند
    if (NONSTANDARD.includes(chartType)) {
      const built = buildNonStandard(chartType, cs, ctParamsRef.current);
      let s2;
      if (built && built.kind === 'candle') { s2 = chart.addSeries(CandlestickSeries, candleOptsFrom(settingsRef.current)); s2.setData((built.data || []).map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }))); }
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
      if (b.kind === 'candle') s2 = chart.addSeries(CandlestickSeries, { ...candleOptsFrom(settingsRef.current), ...b.options });
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
    else if (chartType === 'hollow') s = chart.addSeries(CandlestickSeries, candleOptsFrom(settingsRef.current, true));
    // «میله‌های نازک»ِ تبِ Symbol (symThinBars، قبلاً توگلِ مرده) — مثلِ TV روی نوعِ Candles میله‌های OHLCِ نازک رِندر می‌شود (نوع «Candles» می‌ماند). #307
    else if (chartType === 'candles' && settingsRef.current.symThinBars === true) s = chart.addSeries(BarSeries, { upColor: TH.up, downColor: TH.down });
    else s = chart.addSeries(CandlestickSeries, candleOptsFrom(settingsRef.current, chartType === 'candles' && settingsRef.current.symHollow === true));
    { const d = effDigits(settingsRef.current && settingsRef.current.precision, symbol); try { s.applyOptions({ priceFormat: mkPriceFmt(d) }); } catch (e) { /* noop */ } }
    s.setData((['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) ? valSeries(data) : ohlcColored(data, settingsRef.current));
    priceSeriesRef.current = s;
    drawRef.current && drawRef.current.setSeries(s);
    // symbol در depها لازم است: وگرنه این callback نمادِ کهنه را می‌گیرد و priceFormatِ محور را با
    // دقتِ نمادِ قبلی می‌سازد (مثلاً بعد از EURUSD→BTC، محورِ بیت‌کوین ۵ رقمی می‌شد به‌جای ۱). fetch-effect از قبل symbol دارد پس رفچِ اضافه ندارد.
  }, [chartType, TH, symbol]);

  // دقتِ محورِ قیمت و برچسبِ آخر بر اساسِ نماد (فارکس ۵، JPY ۳، شاخص/طلا ۲، BTC/ETH ۱) — سبکِ TV.
  // پیش‌فرضِ کتابخانه precision:2 است و برای فارکس «1.14» نشان می‌داد؛ حالا 1.14432 مثلِ لجند.
  useEffect(() => {
    const d = effDigits(chartSettingsOverrides.precision, symbol);
    try { drawRef.current && drawRef.current.setDigits(d); } catch (e) { /* برچسبِ ابزارِ اندازه‌گیری دقتِ درستِ نماد را بگیرد */ }
    const s = priceSeriesRef.current; if (!s) return;
    try { s.applyOptions({ priceFormat: mkPriceFmt(d) }); } catch (e) { /* noop */ }
  }, [symbol, chartType, TH, chartSettingsOverrides.precision]);

  const applyOverlays = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    Object.values(overlaySeries.current).flat().forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    overlaySeries.current = {};
    const c = { open: cs.map((x) => x.o), high: cs.map((x) => x.h), low: cs.map((x) => x.l), close: cs.map((x) => x.c), volume: cs.map((x) => x.v || 0), time: cs.map((x) => x.t) };
    let anyLeft = false; // برای روشن‌کردنِ محورِ چپ وقتی اندیکاتوری به آن تخصیص یافته
    overlays.forEach((ov) => {
      const def = REGISTRY[ov.key]; if (!def || def.pane !== 'main') return;
      if (ov.visible === false || !tfAllowedVis(ov.tfVis, tfRef.current)) { overlaySeries.current[ov.id] = []; return; } // تبِ Style: نمایش/مخفی + تبِ Visibility: per-timeframe
      if (ov.scale === 'left') anyLeft = true;
      const psId = ov.scale === 'left' ? 'left' : 'right'; // محورِ قیمتِ دوگانه (تبِ Style)
      const r = def.calc(c, ov.inputs); const arr = [];
      const lc = ov.lineColors || {}; // رنگِ مجزای هر خط (اندیکاتورهای چندخطی)
      const ph = ov.plotHidden || {}; // نمایش/پنهانِ هر plot جداگانه (تبِ Style — مثلِ TV که هر خطِ اندیکاتور را می‌توان پنهان کرد)
      // override‌های استایل (تبِ Style): ضخامت، سبکِ خط (0 توپر/1 نقطه‌ای/2 خط‌چین)، شفافیت، محور، نمایشِ plot
      const mk = (series, color, w = 2, dashed = false, gaps = false, hidden = false) => {
        const lw = ov.width || w;
        const lsv = ov.lineStyle != null ? ov.lineStyle : (dashed ? 2 : 0);
        const opts = { color: applyOpacity(color, ov.opacity), lineWidth: lw, lineStyle: lsv, priceScaleId: psId, priceLineVisible: false, lastValueVisible: false, visible: !hidden };
        // gaps=true ⇒ هر «رانِ» پیوستهٔ non-null یک سریِ جدا (مثلِ Kagi) تا خط از رویِ گپ وصل نشود.
        // (whitespace {time} در این نسخهٔ lightweight-charts خطِ لاین را نمی‌شکند ⇒ خطِ اریبِ سراسریِ سوپرترند.)
        if (gaps) {
          let first = null, seg = [];
          const flush = () => { if (seg.length) { const s = chart.addSeries(LineSeries, opts); s.setData(seg); arr.push(s); if (!first) first = s; seg = []; } };
          series.forEach((v, i) => { if (v == null || !Number.isFinite(v)) flush(); else seg.push({ time: cs[i].t, value: v }); });
          flush();
          return first || (() => { const s = chart.addSeries(LineSeries, opts); arr.push(s); return s; })();
        }
        const ls = chart.addSeries(LineSeries, opts);
        ls.setData(series.map((v, i) => (v == null ? null : { time: cs[i].t, value: v })).filter(Boolean)); arr.push(ls);
        return ls;
      };
      // پُرشدگیِ نیمه‌شفافِ بینِ باندِ بالا و پایین (مثلِ باندِ بولینگرِ TV) — روی سریِ باندِ بالا نصب می‌شود.
      const attachBandFill = (upSeries, upperArr, lowerArr, fillColor, fillDown = null) => {
        try {
          if (ov.visible === false || !upSeries) return;
          const bd = cs.map((c, i) => (upperArr[i] == null || lowerArr[i] == null ? null : { time: c.t, upper: upperArr[i], lower: lowerArr[i] })).filter(Boolean);
          if (bd.length > 1) upSeries.attachPrimitive(new BandFillPrimitive(bd, fillColor, fillDown));
        } catch (e) { /* بدونِ پُرشدگی */ }
      };
      if (r.lines) {
        const lineSeries = r.lines.map((ln, i) => mk(ln.data, lc[i] || ln.color, 1, ln.dashed, ln.gaps, ph[i]));
        // ابرِ ایچیموکو: پُرشدگیِ سبز/قرمزِ بینِ دو خطِ نشان‌دار (indexهای r.cloud) بر اساسِ جهت (Span A≷B).
        if (Array.isArray(r.cloud) && r.cloud.length === 2) {
          const [ai, bi] = r.cloud;
          const sA = r.lines[ai] && r.lines[ai].data, sB = r.lines[bi] && r.lines[bi].data;
          // r.cloudColors: [up] یا [up, down]. پیش‌فرض = سبز/قرمزِ جهت‌دار (ابرِ ایچیموکو).
          const cc = Array.isArray(r.cloudColors) ? r.cloudColors : ['rgba(8,153,129,0.13)', 'rgba(242,54,69,0.13)'];
          if (sA && sB && lineSeries[ai]) attachBandFill(lineSeries[ai], sA, sB, cc[0], cc[1] || null);
        }
      }
      else if (r.multi) { const base = ov.color || def.color; const up = mk(r.upper, lc[0] || base, 1, false, false, ph[0]); mk(r.basis, lc[1] || base, 1, false, false, ph[1]); mk(r.lower, lc[2] || base, 1, false, false, ph[2]); const fillOp = ov.fillOpacity != null ? ov.fillOpacity : 0.10; const fillCol = applyOpacity(ov.fillColor || base, fillOp) || 'rgba(148,163,184,0.10)'; attachBandFill(up, r.upper, r.lower, fillCol); } // باندهای توپر + پُرشدگیِ کاربرپسند (رنگ+شفافیت) مثلِ باندِ بولینگرِ TV
      else if (r.line) mk(r.line, lc[0] || ov.color || def.color);
      // سطوحِ افقی (S/R، فیبوی خودکار، عرضه/تقاضا) — هر سطح یک خطِ افقیِ رنگی سرتاسرِ بازه (extendRight سبکِ TV)
      if (r.levels && r.levels.length) {
        const t0 = cs[0] && cs[0].t, t1 = cs[cs.length - 1] && cs[cs.length - 1].t;
        if (t0 != null && t1 != null) r.levels.forEach((lv) => {
          if (!lv || lv.price == null || !Number.isFinite(lv.price)) return;
          const ls = chart.addSeries(LineSeries, { color: applyOpacity(lv.color || ov.color || def.color, ov.opacity), lineWidth: ov.width || 1, lineStyle: lv.dashed ? 2 : (ov.lineStyle || 0), priceScaleId: psId, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          ls.setData([{ time: t0, value: lv.price }, { time: t1, value: lv.price }]); arr.push(ls);
        });
      }
      // نشانگرها (پیووتِ H/L، فرکتال، سوینگ‌های زیگزاگ) — روی یک سریِ نامرئیِ میزبان
      if (r.markers && r.markers.length) {
        try {
          const host = chart.addSeries(LineSeries, { color: 'rgba(0,0,0,0)', priceScaleId: psId, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          host.setData(cs.map((x) => ({ time: x.t, value: x.c }))); arr.push(host);
          const pm = createSeriesMarkers(host, []); pm.setMarkers(r.markers);
        } catch (e) { /* */ }
      }
      overlaySeries.current[ov.id] = arr;
      indLabelRef.current[ov.id] = { label: indLbl(ov.key, ov.inputs), color: lc[0] || ov.color || def.color, precision: ov.precision };
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
        const v = chart.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
        try { v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } }); } catch (e) {}
        volSeriesRef.current = v;
      } catch (e) { return; }
    }
    // خطِ میانگینِ متحرکِ حجم (SMA 20) روی همان مقیاسِ 'volume' تا هم‌تراز بماند — مثلِ TVِ پیش‌فرض.
    if (!volMaRef.current) {
      try {
        const m = chart.addSeries(LineSeries, { priceScaleId: 'volume', color: 'rgba(120,144,214,.9)', lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        volMaRef.current = m;
      } catch (e) { /* بدونِ MA */ }
    }
    try { volSeriesRef.current.applyOptions({ visible: !!showVolumeRef.current }); } catch (e) {}
    try { volMaRef.current && volMaRef.current.applyOptions({ visible: !!showVolumeRef.current }); } catch (e) {}
    if (!showVolumeRef.current) return; // خاموش ⇒ فقط پنهان (بدونِ حذف)، دادهٔ قبلی می‌ماند
    try {
      volSeriesRef.current.setData((cs || []).map((c) => ({
        time: c.t, value: c.v || 0,
        color: (c.c >= c.o) ? 'rgba(8,153,129,.5)' : 'rgba(242,54,69,.5)',
      })));
      if (volMaRef.current) {
        const P = 20, vols = (cs || []).map((c) => c.v || 0);
        let sum = 0;
        const ma = vols.map((v, i) => { sum += v; if (i >= P) sum -= vols[i - P]; return i >= P - 1 ? sum / P : null; });
        volMaRef.current.setData((cs || []).map((c, i) => (ma[i] == null ? null : { time: c.t, value: ma[i] })).filter(Boolean));
      }
    } catch (e) { /* */ }
  }, []);
  // توگلِ حجم: ماندگاری + همگام‌سازیِ ref + اعمال/حذفِ فوری بدونِ رفرشِ داده
  useEffect(() => { showVolumeRef.current = showVolume; saveWS({ showVolume }); applyVolume(candlesRef.current); }, [showVolume, applyVolume]);

  // ── نشانگرهای رویدادهای اقتصادی روی چارت (سبکِ TradingView Events) ──
  //   وقتی «رویدادهای اقتصادی» روشن است، رویدادهای تقویم که با ارزهای نماد مرتبط‌اند و در بازهٔ
  //   زمانیِ کندل‌های جاری‌اند، به‌صورتِ نشانگرِ نقطه‌ایِ زیرِ کندل (رنگ بر اساسِ اهمیت) رسم می‌شوند.
  //   روی لایهٔ مارکرِ مجزا (`__evMarkers`) تا با مارکرهای نمااسکریپت تداخل نکند. بی‌صدا degrade می‌شود.
  const applyEconomicMarkers = useCallback(async (cs) => {
    const s = priceSeriesRef.current; if (!s) return;
    try { if (!s.__evMarkers) s.__evMarkers = createSeriesMarkers(s, []); } catch (e) { return; }
    if (!settingsRef.current.evEconomic || !cs || !cs.length) { try { s.__evMarkers.setMarkers([]); } catch (e) {} return; }
    try {
      const r = await api.bnCalendar();
      if (priceSeriesRef.current !== s) return; // سری در این بین عوض شده — رها کن
      const items = (r && r.items) || [];
      const curs = symbolCurrencies(symbolRef.current);
      const t0 = cs[0].t, t1 = cs[cs.length - 1].t;
      const markers = [];
      items.forEach((e) => {
        const cc = (e.country || '').toUpperCase();
        if (curs.length && !curs.includes(cc)) return;
        const et = Math.floor(new Date(e.date).getTime() / 1000);
        if (!(et >= t0 && et <= t1)) return;
        let best = cs[0].t, bd = Infinity;
        for (let i = 0; i < cs.length; i++) { const d = Math.abs(cs[i].t - et); if (d < bd) { bd = d; best = cs[i].t; } }
        // رنگِ اهمیت هم‌سان با پنلِ تقویم (IMPACT: بالا #ef4444 / متوسط #f59e0b / پایین #9aa0b5) تا یک رویداد در تقویم و روی چارت رنگِ یکسان داشته باشد — رنگ‌بندیِ یک‌دستِ اهمیتِ TV. #303
        const color = e.impact === 'high' ? '#ef4444' : e.impact === 'medium' ? '#f59e0b' : '#9aa0b5';
        markers.push({ time: best, position: 'belowBar', color, shape: 'circle', text: cc });
      });
      markers.sort((a, b) => a.time - b.time);
      s.__evMarkers.setMarkers(markers);
    } catch (e) { /* noop */ }
  }, []);
  // تغییرِ توگل ⇒ اعمالِ فوری روی کندلِ موجود (بدونِ refetchِ چارت)
  useEffect(() => { applyEconomicMarkers(candlesRef.current); }, [chartSettingsOverrides.evEconomic, applyEconomicMarkers]);

  // ── نشانگرهای «آخرین اخبار» روی چارت (سبکِ TradingView Latest news) ──
  //   نشانگرِ بنفشِ بالای کندل روی زمانِ خبر؛ برای پرهیز از شلوغی به‌ازای هر کندل فقط یک نشانگر
  //   (dedup) و روی لایهٔ مجزای `__newsMarkers` (جدا از اقتصادی/نمااسکریپت). بی‌صدا degrade می‌شود.
  const applyNewsMarkers = useCallback(async (cs) => {
    const s = priceSeriesRef.current; if (!s) return;
    try { if (!s.__newsMarkers) s.__newsMarkers = createSeriesMarkers(s, []); } catch (e) { return; }
    if (!settingsRef.current.evNews || !cs || !cs.length) { try { s.__newsMarkers.setMarkers([]); } catch (e) {} return; }
    try {
      const r = await api.bnNews();
      if (priceSeriesRef.current !== s) return;
      const items = (r && r.items) || [];
      const t0 = cs[0].t, t1 = cs[cs.length - 1].t;
      const seen = new Set(); const markers = [];
      items.forEach((n) => {
        // خبر ذاتاً گذشته است؛ کرانِ بالا نمی‌گذاریم تا خبرِ «چند دقیقه پیش» (ts کمی بعد از شروعِ آخرین کندل)
        // حذف نشود و به آخرین کندل نگاشت شود (نشانگرِ «آخرین خبر»ِ TV). فقط قدیمی‌ترها از t0 حذف می‌شوند.
        const ts = Number(n.ts); if (!Number.isFinite(ts) || ts < t0) return;
        let best = cs[0].t, bd = Infinity;
        for (let i = 0; i < cs.length; i++) { const d = Math.abs(cs[i].t - ts); if (d < bd) { bd = d; best = cs[i].t; } }
        if (seen.has(best)) return; seen.add(best); // یک نشانگر به‌ازای هر کندل
        markers.push({ time: best, position: 'aboveBar', color: '#a855f7', shape: 'circle', text: '' });
      });
      markers.sort((a, b) => a.time - b.time);
      s.__newsMarkers.setMarkers(markers);
    } catch (e) { /* noop */ }
  }, []);
  useEffect(() => { applyNewsMarkers(candlesRef.current); }, [chartSettingsOverrides.evNews, applyNewsMarkers]);

  // ── مقایسهٔ نماد (TV Compare) ── هر نمادِ مقایسه به‌صورتِ یک خطِ overlay روی همان پِین رسم می‌شود،
  //   روی مقیاسِ قیمتِ مخصوصِ خودش (نامرئی، auto-scale) تا چارتِ اصلی را کج نکند. رنگ از پالت.
  const applyCompares = useCallback(async (cs) => {
    const chart = chartRef.current; if (!chart) return;
    compareSeriesRef.current.forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    compareSeriesRef.current = []; compareDataRef.current = {};
    const list = comparesRef.current || [];
    if (!list.length || !cs || !cs.length) return;
    const t0 = cs[0].t, t1 = cs[cs.length - 1].t;
    const lastVals = {}, chgMap = {};
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      try {
        const r = await api.chart(c.sym, tf, '', 800);
        if ((comparesRef.current || []).indexOf(c) === -1) continue; // در این بین حذف شده
        const data = (r.candles || []).filter((d) => d.t >= t0 && d.t <= t1).map((d) => ({ time: d.t, value: d.c }));
        if (!data.length) continue;
        // حالتِ «٪ مشترک» (Same % scaleِ TV): وقتی محورِ اصلی روی «درصد» است (scaleMode===2)، سریِ مقایسه را روی همان
        //   محورِ «right» بگذار تا lightweight-charts هر دو (اصلی + مقایسه) را از baseline به ٪ نرمال کند و معنادار روی هم بیفتند.
        //   در غیرِ این‌صورت روی محورِ مستقلِ مخفیِ خودش (رفتارِ قبلی، تا چارتِ اصلی کج نشود). #272
        const pctShared = scaleModeRef.current === 2;
        const scaleId = pctShared ? 'right' : ('cmp_' + c.id);
        // priceFormat به دقتِ نمادِ مقایسه ست می‌شود؛ وگرنه برچسبِ آخرین‌مقدارِ محور (lastValueVisible) پیش‌فرضِ ۲ رقم می‌گرفت («GBPUSD 1.34» به‌جای «1.33752»).
        const s = chart.addSeries(LineSeries, { color: c.color, lineWidth: 2, priceScaleId: scaleId, lastValueVisible: true, priceLineVisible: false, title: c.sym, priceFormat: mkPriceFmt(priceDigits(c.sym)), visible: cmpHiddenRef.current[c.id] !== true });
        if (!pctShared) { try { chart.priceScale(scaleId).applyOptions({ visible: false, scaleMargins: { top: 0.08, bottom: 0.18 } }); } catch (e) {} }
        s.setData(data);
        s._cmpId = c.id; // تگ برای toggleِ نمایش بدونِ بازساخت (find by id)
        compareSeriesRef.current.push(s);
        compareDataRef.current[c.id] = data; // برای محاسبهٔ تغییرِ زیرِ کراس‌هیر (#326)
        lastVals[c.id] = data[data.length - 1].value; // مقدارِ آخرین کندلِ مقایسه (تا چیپ حتی بدونِ hover مقدار نشان دهد، مثلِ TV)
        // تغییرِ ٪ِ close-to-closeِ آخرین کندلِ مقایسه (مثلِ لجندِ Compareِ TV) — #323
        if (data.length >= 2 && data[data.length - 2].value) chgMap[c.id] = ((data[data.length - 1].value - data[data.length - 2].value) / data[data.length - 2].value) * 100;
      } catch (e) { /* noop */ }
    }
    if (Object.keys(lastVals).length) setCmpVals((prev) => ({ ...prev, ...lastVals }));
    if (Object.keys(chgMap).length) setCmpChg((prev) => ({ ...prev, ...chgMap }));
  }, [tf]);
  // افزودن/حذفِ نمادِ مقایسه — از منوها via رویداد
  const removeCompare = useCallback((id) => { setCompares((l) => l.filter((c) => c.id !== id)); setCmpVals((v) => { if (!(id in v)) return v; const n = { ...v }; delete n[id]; return n; }); setCmpHidden((h) => { if (!(id in h)) return h; const n = { ...h }; delete n[id]; return n; }); }, []);
  // چشمکِ چیپِ مقایسه (نمایش/پنهانِ خطِ مقایسه بدونِ حذف، مثلِ TV) — مستقیم روی سری applyOptions می‌زند تا refetch نشود. #269
  const toggleCompareVis = useCallback((id) => {
    setCmpHidden((h) => {
      const nv = !h[id];
      try { const s = compareSeriesRef.current.find((x) => x && x._cmpId === id); if (s) s.applyOptions({ visible: !nv }); } catch (e) { /* noop */ }
      return { ...h, [id]: nv };
    });
  }, []);
  useEffect(() => { saveWS({ compares }); }, [compares]); // پایداریِ مقایسه‌ها در ورک‌اسپیس (مثلِ TV)
  useEffect(() => { saveWS({ cmpHidden }); }, [cmpHidden]); // پایداریِ نمایش/پنهانِ مقایسه‌ها
  useEffect(() => {
    const COMPARE_COLORS = ['#f59e0b', '#a855f7', '#22c55e', '#ef4444', '#3b82f6', '#ec4899'];
    const onAdd = (e) => {
      const sym = e && e.detail; if (!sym || typeof sym !== 'string') return;
      setCompares((l) => (l.some((c) => c.sym === sym) || sym === symbolRef.current) ? l : [...l, { id: uid(), sym, color: COMPARE_COLORS[l.length % COMPARE_COLORS.length] }]);
    };
    const onRemove = (e) => { const id = e && e.detail; if (id) removeCompare(id); };
    window.addEventListener('bn:addCompare', onAdd);
    window.addEventListener('bn:removeCompare', onRemove);
    return () => { window.removeEventListener('bn:addCompare', onAdd); window.removeEventListener('bn:removeCompare', onRemove); };
  }, [removeCompare]);
  // تغییرِ فهرستِ مقایسه ⇒ بازرسمِ overlayها روی کندلِ موجود (بدونِ refetchِ چارتِ اصلی)
  useEffect(() => { applyCompares(candlesRef.current); }, [compares, applyCompares]);
  // با تعویضِ مودِ مقیاس (به/از «درصد») سری‌های مقایسه را دوباره روی محورِ درست (right ٪-مشترک یا محورِ مستقل) بساز. #272
  useEffect(() => { if (comparesRef.current.length) applyCompares(candlesRef.current); }, [scaleMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const applySubs = useCallback((cs) => {
    const chart = chartRef.current; if (!chart) return;
    // حذفِ سری‌های ساب قبلی (pane نیتیوِ v5 — روی همان چارت)
    Object.values(subChartsRef.current).flat().forEach((s) => { try { chart.removeSeries(s); } catch (e) {} });
    subChartsRef.current = {};
    if (subWrapRef.current) subWrapRef.current.innerHTML = '';
    const c = { open: cs.map((x) => x.o), high: cs.map((x) => x.h), low: cs.map((x) => x.l), close: cs.map((x) => x.c), volume: cs.map((x) => x.v || 0), time: cs.map((x) => x.t) };
    const subList = subs.filter((sub) => { const d = REGISTRY[sub.key]; return d && d.pane === 'sub' && sub.visible !== false && tfAllowedVis(sub.tfVis, tfRef.current); }); // تبِ Style: نمایش/مخفی + Visibility: per-timeframe
    subList.forEach((sub, idx) => {
      const def = REGISTRY[sub.key];
      const pane = idx + 1;                 // pane 0 = چارتِ اصلی
      const r = def.calc(c, sub.inputs);
      const arr = [];
      // دقتِ محورِ پنلِ زیرین سازگار با بزرگیِ مقدار (مثلِ TV): RSI/Stoch/CCI (≥۱) دو رقم؛ MACD/ATRِ ریزِ فارکس
      // ۴–۶ رقم — تا محور «0.00» نشود. از دادهٔ خودِ اندیکاتور بزرگ‌ترین قدرِمطلق را می‌گیریم.
      const subPf = (() => {
        let mx = 0;
        const scan = (a) => { if (Array.isArray(a)) for (let i = 0; i < a.length; i++) { const v = a[i]; if (typeof v === 'number' && Number.isFinite(v)) { const x = v < 0 ? -v : v; if (x > mx) mx = x; } } };
        scan(r.line); scan(r.signal); scan(r.hist); scan(r.basis); scan(r.upper); scan(r.lower);
        if (Array.isArray(r.hists)) r.hists.forEach((h) => scan(h && h.data));
        return mkPriceFmt(mx >= 1 ? 2 : mx >= 0.01 ? 4 : mx > 0 ? 6 : 2);
      })();
      // honor‌کردنِ override‌های استایل (ضخامت/سبک/شفافیت) از تبِ Style
      const L = (opts, data) => {
        const lw = sub.width || opts.lineWidth || 1;
        const lsv = sub.lineStyle != null ? sub.lineStyle : (opts.lineStyle || 0);
        const s = chart.addSeries(LineSeries, { priceFormat: subPf, priceLineVisible: false, lastValueVisible: true, ...opts, color: applyOpacity(opts.color, sub.opacity), lineWidth: lw, lineStyle: lsv }, pane);
        s.setData(data.map((v, i) => (v == null ? null : { time: cs[i].t, value: v })).filter(Boolean)); arr.push(s); return s;
      };
      const sph = sub.plotHidden || {}; // نمایش/پنهانِ هر plotِ نوسان‌گر (MACD: خط=۰ سیگنال=۱ هیستوگرام=۲) — تبِ Style
      if (r.macd) {
        // هیستوگرامِ ۴-رنگیِ MACD مثلِ TV: بالای صفر روشن اگر صعودی، کم‌رنگ اگر نزولی؛ زیرِ صفر روشن اگر نزولی، کم‌رنگ اگر صعودی.
        const h = chart.addSeries(HistogramSeries, { priceFormat: subPf, priceLineVisible: false, visible: !sph[2] }, pane); h.setData(r.hist.map((v, i) => {
          if (v == null) return null;
          const prev = i > 0 ? r.hist[i - 1] : null;
          const rising = prev == null ? true : v >= prev;
          const color = v >= 0
            ? (rising ? 'rgba(8,153,129,.9)' : 'rgba(8,153,129,.32)')
            : (rising ? 'rgba(242,54,69,.32)' : 'rgba(242,54,69,.9)');
          return { time: cs[i].t, value: v, color };
        }).filter(Boolean)); arr.push(h);
        const mlc = sub.lineColors || {}; // رنگِ مجزای هر خط از تبِ Style (خطِ MACD=۰، سیگنال=۱)
        const macdLine = L({ color: mlc[0] || '#3b82f6', visible: !sph[0] }, r.line); L({ color: mlc[1] || '#f59e0b', visible: !sph[1] }, r.signal);
        // خطِ صفرِ مرجعِ MACD (داشد، خنثی) — مثلِ TradingView که پنلِ MACD یک خطِ افقیِ صفر دارد
        try { macdLine && macdLine.createPriceLine({ price: 0, color: TH.text, lineWidth: 1, lineStyle: 2 }); } catch (e) { /* */ }
      } else if (r.hist) {
        // هیستوگرامِ دورنگ: histMode='sign' ⇒ سبز اگر ≥۰ (حجمِ خالص)، وگرنه مومنتوم (سبز اگر بار ≥ بارِ قبلی) — هر دو مثلِ TV.
        const h = chart.addSeries(HistogramSeries, { priceFormat: subPf, priceLineVisible: false }, pane);
        h.setData(r.hist.map((v, i) => {
          if (v == null) return null;
          let green;
          if (r.histMode === 'sign') green = v >= 0;
          else { const prev = i > 0 ? r.hist[i - 1] : null; green = prev == null ? true : v >= prev; }
          return { time: cs[i].t, value: v, color: green ? 'rgba(8,153,129,.9)' : 'rgba(242,54,69,.9)' };
        }).filter(Boolean)); arr.push(h);
        (r.guides || []).forEach((g) => h.createPriceLine({ price: g, color: TH.text, lineWidth: 1, lineStyle: 2 }));
      } else if (r.hists) {
        // چند هیستوگرامِ هم‌پوشان با رنگِ ثابت (مثلِ Elder Ray: قدرتِ گاو سبز + قدرتِ خرس قرمز) — مثلِ TV.
        let first = null;
        r.hists.forEach((hd) => {
          const h = chart.addSeries(HistogramSeries, { priceFormat: subPf, priceLineVisible: false, color: applyOpacity(hd.color, 0.85) }, pane);
          h.setData(hd.data.map((v, i) => (v == null ? null : { time: cs[i].t, value: v })).filter(Boolean)); arr.push(h);
          if (!first) first = h;
        });
        if (first) (r.guides || []).forEach((g) => first.createPriceLine({ price: g, color: TH.text, lineWidth: 1, lineStyle: 2 }));
      } else {
        const l1 = L({ color: sub.color || def.color, visible: !sph[0] }, r.line);
        // پُرشدگیِ کم‌رنگِ زونِ اشباع بینِ دو سطحِ ثابت (مثلِ Hlines Backgroundِ RSI/Stochِ TV)
        if (Array.isArray(r.zone) && r.zone.length === 2 && l1) {
          try {
            const [lo, hi] = r.zone;
            const bd = cs.map((c) => ({ time: c.t, upper: hi, lower: lo }));
            // شفافیتِ پُرشدگیِ زون ≈ ۱۰٪ (هم‌ترازِ Hlines Backgroundِ RSI/Stochِ TV: rgba(hue,0.1))
            if (bd.length > 1) l1.attachPrimitive(new BandFillPrimitive(bd, applyOpacity(sub.color || def.color, 0.10)));
          } catch (e) { /* بدونِ پُرشدگیِ زون */ }
        }
        if (r.signal) L({ color: '#f59e0b', visible: !sph[1] }, r.signal);
        // خطِ سوم (مثلِ ADX در DMI) — رنگِ مجزا، پیش‌فرضِ خاکستریِ روشن
        if (r.signal2) L({ color: r.signal2Color || '#64748b', visible: !sph[2] }, r.signal2);
        // خطوطِ مرجعِ اسیلاتور (مثلِ ۷۰/۳۰ در RSI) — رنگِ متنِ خنثی تا مثلِ TradingView دیده شوند،
        // نه رنگِ گرید که قبلاً باعث می‌شد با خطوطِ شبکه یکی و عملاً نامرئی شوند.
        (r.guides || []).forEach((g) => l1.createPriceLine({ price: g, color: TH.text, lineWidth: 1, lineStyle: 2 }));
      }
      // ارتفاعِ پنلِ زیرین سازگار با تعداد — مثلِ TV یک نوسان‌سازِ تنها فضای بیشتری می‌گیرد
      // (پنلِ کوچکِ ثابتِ ۱۰۸ برای یک RSIِ تنها خیلی فشرده بود)؛ با زیادشدنِ پنل‌ها کوتاه‌تر می‌شود.
      const subH = subList.length <= 1 ? 168 : (subList.length === 2 ? 132 : 108);
      try { const panes = chart.panes(); if (panes && panes[pane]) panes[pane].setHeight(subH); } catch (e) {}
      subChartsRef.current[sub.id] = arr;
      indLabelRef.current[sub.id] = { label: indLbl(sub.key, sub.inputs), color: sub.color || def.color, precision: sub.precision };
      try { const src = r.line || r.hist || (r.hists && r.hists[0] && r.hists[0].data); const last = src && src.length ? src[src.length - 1] : null; lastIndValRef.current[sub.id] = (last != null && Number.isFinite(last)) ? [last] : []; } catch (e) { /* */ }
    });
  }, [subs, TH]);

  // بارگذاریِ تنبلِ کندل‌های قدیمی‌تر هنگامِ اسکرول به چپ
  const loadMoreHistory = useCallback(async () => {
    const lz = lazyRef.current; if (lz.loading || lz.exhausted) return;
    if (NONSTANDARD.includes(chartType) || DERIVED_TF[tf] || customDerivedRef.current[tf]) return; // چارت‌های زمان‌مستقل / تایم‌فریمِ تجمیعی (شاملِ سفارشی)
    const cs = candlesRef.current; if (cs.length < 50) return;
    lz.loading = true;
    try {
      const oldest = cs[0].t;
      const r = await api.chart(symbol, tf, '', 500, oldest - 1);
      const older = (r.candles || []).map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v })).filter((c) => c.t < oldest);
      if (!older.length) { lz.exhausted = true; return; }
      // سقفِ کندل (فاز ۵.۲): prepend بی‌کران بود — هر اسکرولِ چپ ۵۰۰ کندل اضافه می‌کرد
      // و همهٔ اندیکاتورها روی کلِ آرایه بازمحاسبه می‌شدند. با accelerator O(n²)ِ سابق
      // فریزِ حتمی بود. حالا: این batch prepend می‌شود، ولی اگر مجموع از MAX_BARS رد شد،
      // exhausted می‌شود تا دیگر batch نیاید. آرایه برش نمی‌خورد (نه چپ نه راست) — هر دو
      // سمت داده‌ای‌اند که کاربر ممکن است ببیند؛ فقط رشدِ بیشتر متوقف می‌شود.
      const MAX_BARS = 6000;
      const merged = older.concat(cs); candlesRef.current = merged;
      if (merged.length >= MAX_BARS) lz.exhausted = true;
      const s = priceSeriesRef.current;
      if (s) { const data = chartType === 'heikin' ? heikin(merged) : merged; s.setData((['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) ? valSeries(data) : ohlcColored(data, settingsRef.current)); }
      applyOverlays(merged); applySubs(merged); applyVolume(merged);
      if (drawRef.current) drawRef.current.setCandles(merged);
    } catch (e) { /* */ } finally { lz.loading = false; }
  }, [symbol, tf, chartType, applyOverlays, applySubs, applyVolume]);
  useEffect(() => { loadMoreRef.current = loadMoreHistory; }, [loadMoreHistory]);

  const load = useCallback(async () => {
    lazyRef.current = { loading: false, exhausted: false };
    // wake متعلق به effectِ زمان‌بندی است؛ با reset فقط حالتِ قیمت پاک می‌شود تا
    // تغییرِ نماد، انیمیشنِ فعال را از scheduler جدا نکند.
    Object.assign(easeRef.current, { target: null, display: null, lastApplied: null });
    const seq = ++loadSeqRef.current; // این بارگذاری؛ اگر نماد/تایم‌فریم عوض شد، نتیجهٔ کهنه را دور بریز
    try {
      // تایم‌فریمِ مشتق‌شده (M30/H2/W1/MN + بازه‌های سفارشی) → از تایم‌فریمِ پایه می‌گیریم و تجمیع می‌کنیم
      const der = DERIVED_TF[tf] || customDerivedRef.current[tf];
      const fetchTf = der ? der[0] : tf;
      const factor = der ? der[1] : 1;
      // نمادِ ترکیبی/اسپرد (مثلِ TradingView): parserِ کاملِ symbolExpr — نسبت/ضرب/جمع/تفریق،
      //   ثابتِ عددی (XAUUSD*2)، پرانتز و تقدم ((A+B)/2)، و چند نماد. هستهٔ خالصِ تست‌شده (test/symbolExpr.test.mjs).
      const expr = parseSymbolExpr(symbol);
      let cs;
      if (expr && expr.isExpr && expr.symbols.length) {
        // هر نماد را با یک بار تلاشِ مجدد بگیر — خطای گذرا در یکی از پایه‌ها کلِ اسپرد را خالی می‌کرد
        const fetchOne = async (s) => {
          for (let attempt = 0; attempt < 4; attempt++) {
            try { const r = await api.chart(s, fetchTf, '', 800 * factor); if (r && (r.candles || []).length) return r.candles; } catch (_) { /* retry */ }
            if (attempt < 3) await new Promise((z) => setTimeout(z, 500 * (attempt + 1))); // بک‌آفِ فزاینده برای ۵۰۰های گذرای بک‌اند (تا ~۳ث)
          }
          return [];
        };
        const results = await Promise.all(expr.symbols.map(fetchOne));
        const bySym = {}; expr.symbols.forEach((s, k) => { bySym[s] = results[k] || []; });
        cs = computeSpread(bySym, expr.ast); // {t,o,h,l,c,v} هم‌تراز بر زمانِ مشترک
        lazyRef.current = { loading: false, exhausted: true }; // اسپرد: بارگذاریِ تنبلِ تاریخ غیرفعال
      } else {
        const r = await api.chart(symbol, fetchTf, '', 800 * factor);
        cs = (r.candles || []).map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v }));
      }
      if (seq !== loadSeqRef.current) return; // نمادِ دیگری در حالِ بارگذاری است؛ این نتیجهٔ کهنه را اعمال نکن
      if (factor > 1) cs = resampleCandles(cs, factor);
      candlesRef.current = cs;
      buildPriceSeries(cs); applyPriceLineVis(); applyOverlays(cs); applySubs(cs); applyVolume(cs); applyEconomicMarkers(cs); applyNewsMarkers(cs); applyCompares(cs);
      try { setTechRating(technicalRating(cs)); } catch (e) { /* noop */ }
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
  // پارامترهای نوعِ چارتِ غیرِزمانی تغییر کرد ⇒ فقط بازساختِ سبکِ سری از کندلِ موجود (بدونِ refetch)،
  // و فقط وقتی نوعِ فعال غیرِزمانی است. ref را هم‌گام می‌کنیم چون buildPriceSeries از ctParamsRef می‌خوانَد.
  useEffect(() => {
    ctParamsRef.current = ctParams;
    saveWS({ ctParams });
    if (!NONSTANDARD.includes(chartType) || !candlesRef.current) return;
    try { buildPriceSeries(candlesRef.current); applyPriceLineVis(); } catch (e) { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctParams]);
  // نگه‌داشتنِ خودکارِ میزِکار (نماد/تایم‌فریم/نوعِ چارت/تم/اندیکاتورها) — رفرش/خروج پاکش نمی‌کند
  useEffect(() => { saveWS({ symbol, tf, chartType, theme, overlays, subs }); }, [symbol, tf, chartType, theme, overlays, subs]);
  useEffect(() => { saveWS({ intrabar: intrabarOn }); }, [intrabarOn]); // ذره‌بینِ بار (۶.۳)
  useEffect(() => { symbolRef.current = symbol; }, [symbol]);
  // تغییرِ نماد ⇒ ترسیم‌های نمادِ جدید را در لایه بگذار (فاز ۵.۱).
  // ترسیم‌های نمادِ قبلی از قبل با onChange (saveSymbolDrawings) ذخیره شده‌اند.
  // firstRun را رد می‌کنیم چون effect بالای setup خودش لودِ اولیه را می‌کند.
  const _drawSymRef = useRef(symbol);
  useEffect(() => {
    if (_drawSymRef.current === symbol) return; // همان نماد — کاری نکن
    _drawSymRef.current = symbol;
    const dl = drawRef.current;
    if (!dl) return;
    try { dl.setDrawings(loadSymbolDrawings(symbol)); } catch (e) { /* noop */ }
    setDrawList(dl.getDrawings ? dl.getDrawings().slice() : []);
    setDrawVer((v) => v + 1);
  }, [symbol]);
  // #3 ماندگاریِ ترجیحاتِ Legend (جمع‌بودن/حالتِ نمایش)
  useEffect(() => { saveWS({ legCollapsed, legView }); }, [legCollapsed, legView]);
  // #4 در چیدمانِ فشرده (گوشی/تبلت/لنداسکیپِ کوتاه) grid اجباری ۱ (RAM/پینت) — بدونِ رگرسیونِ دسکتاپ
  useEffect(() => { if (compact && grid !== 1) { setGrid(1); setGridPreset('1'); } /* eslint-disable-next-line */ }, [compact]);
  // ماندگاریِ چیدمانِ چند-چارت (فقط در حالتِ غیرِفشرده تا ریستِ اجباریِ موبایل، ترجیحِ دسکتاپ را پاک نکند). #317
  useEffect(() => { if (!compact) saveWS({ gridPreset }); }, [gridPreset, compact]);
  // ── P2.1: اندازه‌گیریِ مستطیلِ سلولِ ۰ (سوراخِ گرید) و چسباندنِ رَپرِ چارتِ واقعی به آن ──
  // useLayoutEffect + ست‌کردنِ state پیش از paint ⇒ بدونِ فریمِ «چارتِ تمام‌صفحه زیرِ گرید».
  // ResizeObserver روی خودِ سلول و ناحیهٔ چارت ⇒ با تغییرِ اندازهٔ پنجره/پنل‌ها rect تازه می‌شود؛
  // چارت‌لیب و بومِ ترسیم resize را از RO موجودِ mainRef می‌گیرند (خطِ resize در افکتِ ساختِ چارت).
  useLayoutEffect(() => {
    if (grid <= 1) { setCellRect(null); return undefined; }
    const measure = () => {
      const c0 = cell0Ref.current, host = chartAreaRef.current;
      if (!c0 || !host) return;
      const a = c0.getBoundingClientRect(), b = host.getBoundingClientRect();
      if (!a.width || !a.height) return; // هنوز layout نشده — rect صفر اعمال نشود
      const next = { left: Math.round(a.left - b.left), top: Math.round(a.top - b.top), width: Math.round(a.width), height: Math.round(a.height) };
      setCellRect((prev) => (prev && prev.left === next.left && prev.top === next.top && prev.width === next.width && prev.height === next.height) ? prev : next);
    };
    measure();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      if (cell0Ref.current) ro.observe(cell0Ref.current);
      if (chartAreaRef.current) ro.observe(chartAreaRef.current);
    }
    return () => { if (ro) ro.disconnect(); };
  }, [grid, gridPreset]);
  // ── P2.1: مشارکتِ چارتِ اصلی در باسِ همگام‌سازیِ چند-چارت (زمان/کراس‌هیر/نماد) ──
  // تا حالا فقط MiniChartها با هم سینک بودند و سلولِ ۰ (چارتِ واقعی) از قافله جدا می‌مانْد.
  // یک‌بار subscribe به‌ازای هر ورود به گرید؛ تاگل‌ها از refِ زنده خوانده می‌شوند؛ نگهبانِ applying مانعِ echo.
  useEffect(() => {
    if (grid <= 1) return undefined;
    const chart = chartRef.current, bus = syncBusRef.current;
    if (!chart || !bus) return undefined;
    let applying = false;
    const onMsg = (type, payload) => {
      if (!chartRef.current) return; applying = true;
      try {
        // نگاشتِ «فاصله از آخرین کندل»: چارتِ اصلی معمولاً تاریخچهٔ بلندتری از سلول‌های ۴۰۰تایی دارد؛
        // اندیسِ منطقیِ خام پنجره را به قدیمی‌ترین کندل‌ها می‌بُرد. طولِ برابر ⇒ off صفر (رفتارِ قبلی).
        if (type === 'time' && payload) { if (syncTimeRef.current) { const n = (candlesRef.current || []).length; if (payload.len > 0 && n > 0) { const off = n - payload.len; chartRef.current.timeScale().setVisibleLogicalRange({ from: payload.from + off, to: payload.to + off }); } } }
        else if (type === 'cross') { if (syncCrossRef.current) { if (payload && payload.time != null) chartRef.current.setCrosshairPosition(payload.value || 0, payload.time, priceSeriesRef.current); else chartRef.current.clearCrosshairPosition(); } }
        else if (type === 'symbol' && syncSymRef.current && payload) { gridSymFromBusRef.current = payload; setSymbol(payload); }
      } catch (e) { /* noop */ }
      applying = false;
    };
    const unsub = bus.subscribe(onMsg);
    const onRange = (r) => { const n = (candlesRef.current || []).length; if (!applying && r && n > 0) bus.emit('time', { from: r.from, to: r.to, len: n }, onMsg); };
    const onCross = (p) => {
      if (applying) return;
      if (p && p.time != null) { let v = 0; try { const d = p.seriesData.get(priceSeriesRef.current); v = d ? (d.close != null ? d.close : d.value) : 0; } catch (e) { v = 0; } bus.emit('cross', { time: p.time, value: v }, onMsg); }
      else bus.emit('cross', { time: null }, onMsg);
    };
    try { chart.timeScale().subscribeVisibleLogicalRangeChange(onRange); } catch (e) { /* noop */ }
    try { chart.subscribeCrosshairMove(onCross); } catch (e) { /* noop */ }
    // با ورود به گرید، رنجِ فعلیِ چارتِ اصلی یک‌بار منتشر می‌شود تا سلول‌های از-پیش-بارشده به آن هم‌تراز شوند
    try { const n0 = (candlesRef.current || []).length; const r0 = chart.timeScale().getVisibleLogicalRange(); if (r0 && n0 > 0) bus.emit('time', { from: r0.from, to: r0.to, len: n0 }, onMsg); } catch (e) { /* noop */ }
    return () => {
      unsub();
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange); } catch (e) { /* noop */ }
      try { chart.unsubscribeCrosshairMove(onCross); } catch (e) { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid]);
  // انتشارِ نمادِ چارتِ اصلی روی باس (با تاگلِ سینکِ نماد) — نگهبانِ gridSymFromBusRef مانعِ echoِ نمادی است که خودش از باس آمده.
  useEffect(() => {
    if (grid <= 1) return;
    const fromBus = gridSymFromBusRef.current === symbol;
    gridSymFromBusRef.current = null;
    if (!fromBus && syncSymRef.current && syncBusRef.current) syncBusRef.current.emit('symbol', symbol);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, grid]);
  // باگ۳: نگه‌داشتنِ سیگنالِ AI و سفارشِ ترید تا با رفرش/بازگشت پاک نشوند
  useEffect(() => { saveWS({ aiSig }); }, [aiSig]);
  useEffect(() => { saveWS({ order }); }, [order]);
  // نگه‌داشتنِ کدِ نمااسکریپت + وضعیتِ اعمال‌شدنِ آن (تا با رفرش/تعویضِ تایم‌فریم بماند)
  useEffect(() => { saveWS({ code }); }, [code]);
  useEffect(() => { scriptAppliedRef.current = scriptApplied; saveWS({ scriptApplied }); }, [scriptApplied]);

  // Volume Profile — هیستوگرامِ توزیعِ قیمت (با وزنِ حجم؛ چون حجمِ داده صفر است، توزیعِ قیمت)
  const applyVP = useCallback((cs) => {
    if (!drawRef.current) return;
    const data = cs || candlesRef.current;
    // نیم‌رخِ حجم از ماژولِ خالصِ testable (حجم روی بازهٔ high-low توزیع می‌شود، مثلِ TV — نه فقط میانه). #479
    drawRef.current.setProfile(computeProfile(data, 48));
  }, []);

  useEffect(() => { if (drawRef.current) { showVP ? applyVP() : drawRef.current.setProfile(null); } saveWS({ showVP }); }, [showVP, applyVP]);
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
    const XH_COLOR = settingsRef.current.crosshairColor || '#9598a1'; // رنگِ کراس‌هیر از دیالوگِ تنظیمات (قبلاً مرده)؛ پیش‌فرض خاکستریِ خنثیِ TV
    const XH_STYLE = settingsRef.current.crosshairStyle != null ? settingsRef.current.crosshairStyle : 1; // سبکِ خطِ کراس‌هیر از دیالوگِ تنظیمات (۰=یکسره / ۱=نقطه‌چین)؛ پیش‌فرض ۱ نقطه‌چینِ TV. قبلاً هاردکد=۱ بود ⇒ کنترلِ «سبکِ خط»ِ دیالوگ مرده بود.
    const XH_WIDTH = Math.max(1, Math.min(4, settingsRef.current.crosshairWidth || 1)); // ضخامتِ کراس‌هیر از دیالوگ
    ch.applyOptions({ crosshair: { ...crosshair, vertLine: { ...crosshair.vertLine, color: XH_COLOR, style: XH_STYLE, width: XH_WIDTH, labelVisible: !useAxisTag && crosshair.vertLine.labelVisible }, horzLine: { ...crosshair.horzLine, color: XH_COLOR, style: XH_STYLE, width: XH_WIDTH, labelVisible: !useAxisTag && crosshair.horzLine.labelVisible } } });
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
  useEffect(() => { const tzo = timeZoneOptions(tz, chartSettingsOverrides.time12h === true, chartSettingsOverrides.dowOnLabels === true); crossTimeFmtRef.current = tzo.localization.timeFormatter; const ch = chartRef.current; if (!ch) return; try { ch.applyOptions(tzo); } catch (e) {} saveWS({ tz }); }, [tz, chartSettingsOverrides.time12h, chartSettingsOverrides.dowOnLabels]);
  // dropdownِ «منطقهٔ زمانی»ِ دیالوگِ تنظیمات همیشه tzِ واقعی را نشان دهد (وگرنه پیش‌فرض UTC می‌مانْد در حالی که چارت روی تهران بود، و تغییرِ منوی سشن‌ها را بازتاب نمی‌داد). گاردِ برابری از حلقه جلوگیری می‌کند.
  useEffect(() => { setChartSettingsOverrides((prev) => (prev.timezone === tz ? prev : { ...prev, timezone: tz })); }, [tz]);
  // ساعتِ زندهٔ نوارِ پایین: هر ثانیه به‌وقتِ منطقهٔ زمانیِ فعال به‌روز می‌شود (parity با نوارِ پایینِ TradingView)
  useEffect(() => {
    let fmt; try { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz }); } catch (e) { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); }
    const tick = () => { try { setTzClock(fmt.format(new Date())); } catch (e) {} };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [tz]);
  useEffect(() => { if (drawRef.current) drawRef.current.setStayInMode(stayDraw); saveWS({ stayDraw }); }, [stayDraw]);
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
  // «یادداشتِ متنی» روی نقطهٔ کلیک — هم‌ترازِ «Add text note at …»ِ منوی راست‌کلیکِ TV.
  // متن از کاربر پرسیده می‌شود و دقیقاً روی قیمت/زمانِ کلیک‌شده ثبت می‌شود (همان شکلِ ترسیمِ ابزارِ متن).
  const placeTextNote = (price, atX) => {
    const ch = chartRef.current, dl = drawRef.current;
    if (!ch || !dl || price == null) return;
    const txt = window.prompt('متنِ یادداشت (برای خطِ جدید «\\n» بنویسید):');
    if (!txt) return;
    try {
      const ts = ch.timeScale();
      let t0 = ts.coordinateToTime(atX);
      const vr = ts.getVisibleRange();
      if (typeof t0 !== 'number') t0 = (vr && typeof vr.to === 'number' ? vr.to : Math.floor(Date.now() / 1000));
      dl.addDrawing({ type: 'text', t: t0, p: price, text: txt, color: drawColor });
      treeRefresh();
    } catch (e) { /* noop */ }
  };
  // «افزودنِ خطِ عمودی در …» — قرینهٔ افقی برای منوی راست‌کلیک؛ خطِ عمودی دقیقاً روی زمانِ کندلِ کلیک‌شده (هم‌ترازِ «Add vertical line»ِ TV).
  const placeVLine = (atX) => {
    const ch = chartRef.current, dl = drawRef.current;
    if (!ch || !dl) return;
    try {
      const ts = ch.timeScale();
      let t0 = ts.coordinateToTime(atX);
      const vr = ts.getVisibleRange();
      if (typeof t0 !== 'number') t0 = (vr && typeof vr.to === 'number' ? vr.to : Math.floor(Date.now() / 1000));
      dl.addDrawing({ type: 'vline', t: t0, color: drawColor, width: 2 });
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

  // «پرش به تاریخ» (Go to date سبکِ TV): پنجرهٔ نمایش را حولِ تاریخِ انتخابی وسط‌چین می‌کند (کلمپ به دادهٔ بارگذاری‌شده).
  const goToDate = (dateStr) => {
    setGotoOpen(false);
    const ch = chartRef.current; if (!ch || !dateStr) return;
    // «YYYY-MM-DD» (date) یا «YYYY-MM-DDTHH:MM» (datetime-local، برای پرشِ زمانِ دقیق در اینترادی مثلِ TV) — هر دو معتبر.
    let t = Math.floor(new Date(dateStr).getTime() / 1000);
    if (!Number.isFinite(t)) return;
    const cs = candlesRef.current;
    if (cs.length) t = Math.max(cs[0].t, Math.min(t, cs[cs.length - 1].t));
    const half = tfSec(tf) * 40; // ~۸۰ کندل پنجره حولِ تاریخ
    let from = t - half, to = t + half;
    if (cs.length) { if (from < cs[0].t) from = cs[0].t; if (to > cs[cs.length - 1].t) to = cs[cs.length - 1].t; }
    try { ch.timeScale().setVisibleRange({ from, to }); setQuickRange(null); } catch (e) { /* noop */ }
  };

  // دانلودِ دادهٔ چارت به‌صورتِ CSV (هم‌ترازِ «Download chart data»ِ TV) — کلاینت‌ساید، از کندل‌های موجود.
  const downloadChartData = () => {
    try {
      const cs = candlesRef.current; if (!cs || !cs.length) return;
      const rows = ['time,open,high,low,close,volume'];
      cs.forEach((c) => { const iso = new Date(c.t * (c.t < 1e12 ? 1000 : 1)).toISOString(); rows.push(`${iso},${c.o},${c.h},${c.l},${c.c},${c.v ?? 0}`); });
      const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${symbol}_${TF_LABEL[tf] || tf}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
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

  // ── خطوطِ آلارم روی چارت (سبکِ TradingView) ── برای هر آلارمِ ذخیره‌شدهٔ همین نماد یک
  //   خطِ قیمتِ افقی رسم می‌شود. قابلِ خاموش‌کردن از تبِ «آلارم‌ها»ِ تنظیماتِ چارت
  //   (alertLinesShown) و فیلترِ «فقط فعال‌ها» (alertLinesActiveOnly). رنگ بر اساسِ جهتِ شرط.
  useEffect(() => {
    const s = priceSeriesRef.current;
    if (!s) return;
    alertLinesRef.current.forEach((l) => { try { s.removePriceLine(l); } catch (e) {} });
    alertLinesRef.current = [];
    if (chartSettingsOverrides.alertLinesShown === false) return;
    const activeOnly = chartSettingsOverrides.alertLinesActiveOnly === true;
    (savedAlerts || []).forEach((a) => {
      if (!a || a.symbol !== symbol) return;
      if (activeOnly && a.active === false) return;
      const c = a.condition || {};
      const inactive = a.active === false;
      const mkLine = (price, up) => {
        if (!Number.isFinite(price)) return;
        const color = inactive ? TH.text : (up ? TH.up : TH.down);
        try {
          alertLinesRef.current.push(s.createPriceLine({
            price, color, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '🔔',
          }));
        } catch (e) { /* noop */ }
      };
      // آلارمِ کانال (ورود/خروج) دو مرز دارد ⇒ هر دو خطِ بالا/پایین رسم می‌شوند (سبکِ TV: کانال = دو خطِ مرزی). قبلاً فقط lo رسم می‌شد.
      if (c.op === 'enter_channel' || c.op === 'exit_channel') {
        mkLine(Number(c.hi), true);
        mkLine(Number(c.lo), false);
      } else {
        const up = c.op === 'above' || c.op === 'cross_up' || c.op === 'move_up_value' || c.op === 'pct_up';
        mkLine(Number(c.value != null ? c.value : c.lo), up);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAlerts, symbol, chartType, chartSettingsOverrides.alertLinesShown, chartSettingsOverrides.alertLinesActiveOnly, TH.up, TH.down, TH.text]);

  // ── بستهٔ سشنِ قبل برای «تغییرِ روزِ قبل»ِ خطِ وضعیت (مثلِ TV: Last day change values) ──
  //   کندلِ روزانه را می‌گیرد؛ بستهٔ کندلِ ماقبلِ آخر = بستهٔ روزِ گذشته. بی‌صدا degrade می‌شود.
  useEffect(() => {
    let on = true;
    setPrevDayClose(null);
    if (!symbol) return;
    (async () => {
      try {
        const res = await api.chart(symbol, 'D1', '', 2);
        const cs = res?.candles || res?.data || res || [];
        const arr = Array.isArray(cs) ? cs : [];
        const prev = arr.length >= 2 ? arr[arr.length - 2] : null;
        if (on && prev && prev.c != null) setPrevDayClose(Number(prev.c));
      } catch (e) { if (on) setPrevDayClose(null); }
    })();
    return () => { on = false; };
  }, [symbol]);

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
  // بازمحاسبهٔ throttle‌شدهٔ اندیکاتور در پخشِ replay (فاز ۶.۵ + ۶.۴).
  // باگ: replayApplyStep فقط قیمت/حجم را update می‌کرد؛ اورلی/سابِ اندیکاتورها فقط
  // با seek بازمحاسبه می‌شدند — پس هنگامِ پخش، اندیکاتورها روی آخرین seek فریز بودند.
  // rafThrottle (از perf.js که تا حالا مرده بود) چند فریم را به یکی جمع می‌کند تا
  // چند setData در یک فریم پخش را کند نکند.
  const _applyIndRef = useRef({ ov: applyOverlays, sub: applySubs });
  _applyIndRef.current.ov = applyOverlays; _applyIndRef.current.sub = applySubs; // همیشه آخرین نسخه (بدونِ stale closure)
  const _replayIndRecalc = useRef(null);
  if (!_replayIndRecalc.current) {
    _replayIndRecalc.current = rafThrottle(() => {
      const sl = candlesRef.current;
      if (!sl || !sl.length) return;
      try { _applyIndRef.current.ov(sl); _applyIndRef.current.sub(sl); } catch (e) { /* یک فریم نباید حلقه را بشکند */ }
    });
  }
  const replayApplyStep = useCallback((c, slice) => {
    candlesRef.current = slice;
    if (_replayIndRecalc.current) _replayIndRecalc.current(); // اندیکاتورها با پخش زنده می‌مانند
    // بستنِ خودکارِ معاملهٔ تمرینی اگر کندلِ تازه‌آشکارشده به SL یا TP برخورد کند (اولویت با SL — بدترین حالت).
    const pp = practicePosRef.current;
    if (pp && c && practiceCloseAtRef.current) {
      if (pp.side === 'buy') {
        if (pp.sl != null && c.l <= pp.sl) practiceCloseAtRef.current(pp.sl);
        else if (pp.tp != null && c.h >= pp.tp) practiceCloseAtRef.current(pp.tp);
      } else {
        if (pp.sl != null && c.h >= pp.sl) practiceCloseAtRef.current(pp.sl);
        else if (pp.tp != null && c.l <= pp.tp) practiceCloseAtRef.current(pp.tp);
      }
    }
    if (volSeriesRef.current && showVolumeRef.current) { try { volSeriesRef.current.update({ time: c.t, value: c.v || 0, color: (c.c >= c.o) ? 'rgba(8,153,129,.5)' : 'rgba(242,54,69,.5)' }); } catch (e) {} }
    if (EXT_HISTOGRAM_TYPES.includes(chartType)) { // ستونی: رنگِ live لازم دارد — فقط در بارگذاریِ کاملِ بازپخش به‌روز می‌شود
      try { priceSeriesRef.current.update(columnsLivePoint(candlesRef.current, { up: TH.up, down: TH.down })); } catch (e) {}
      return;
    }
    try { if (['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) priceSeriesRef.current.update({ time: c.t, value: c.c }); else priceSeriesRef.current.update({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }); } catch (e) {}
    // auto-follow (سبکِ TV): اگر کندلِ تازه‌آشکارشده به لبهٔ راستِ دید نزدیک شد، پنجرهٔ دید را یک بار به راست ببر
    // تا reveal همیشه دیده شود. اگر کاربر عقب‌تر را نگاه می‌کند (کندلِ جدید هنوز داخلِ دید است) دست نمی‌زنیم.
    try {
      const ts = chartRef.current.timeScale();
      const lr = ts.getVisibleLogicalRange();
      const lastIdx = (candlesRef.current ? candlesRef.current.length : 0) - 1;
      if (lr && lastIdx >= lr.to - 2) ts.setVisibleLogicalRange({ from: lr.from + 1, to: lr.to + 1 });
    } catch (e) { /* noop */ }
  }, [chartType, TH]);
  // بازساختِ کاملِ سری از یک برش (برای seek/step-back/scrub — همان مسیرِ enterReplay).
  const replayApplySlice = useCallback((slice) => {
    candlesRef.current = slice;
    // سری‌های فرعی (حجم/MAحجم/اورلی/ساب) را اول به برشِ جدید به‌روز کن، سپس سریِ اصلیِ کندل را.
    // اگر کندل اول کوتاه شود ولی سری‌های فرعی هنوز دادهٔ برشِ قبلیِ بلندتر را داشته باشند، رندرِ لاین
    // در آن لحظهٔ گذرا به نقطهٔ خارج‌از‌رنج می‌خورد و خطای async «Value is null» می‌دهد (هنگامِ seek/scrub).
    applyVolume(slice); applyOverlays(slice); applySubs(slice);
    buildPriceSeries(slice); applyPriceLineVis();
  }, [buildPriceSeries, applyOverlays, applySubs, applyVolume]);

  const enterReplay = (startIndex) => {
    const full = candlesRef.current.slice();
    if (!ReplayController.canEnter(full)) return; // حداقل ۳۰ کندل
    // کنترلر را با همان callbackها بساز؛ onChange ⇒ sync با React + mirror در replayRef برای applyMid/حلقهٔ ۶۰fps
    const ctrl = new ReplayController({
      speed: SPEED_LADDER.includes(replay.speed) ? replay.speed : 1,
      onStep: (c, slice) => replayApplyStep(c, slice),
      onSlice: (slice) => replayApplySlice(slice),
      // ذره‌بینِ بار (۶.۳): هر ریزکندل، کندلِ در‌حالِ‌شکل‌گیری را روی سری update می‌کند.
      onIntrabar: (sub, bar, j, slice) => {
        candlesRef.current = slice;
        try {
          const forming = { time: bar.t, open: bar.o, high: sub.h, low: sub.l, close: sub.c };
          if (['line', 'area', 'baseline', 'step'].includes(chartType) || EXT_VALUE_TYPES.includes(chartType)) priceSeriesRef.current.update({ time: bar.t, value: sub.c });
          else priceSeriesRef.current.update(forming);
        } catch (e) { /* یک ریزگام نباید حلقه را بشکند */ }
      },
      onChange: (st) => {
        replayRef.current.idx = st.idx; replayRef.current.full = ctrl.full;
        setReplay((s) => ({ ...s, on: st.on, playing: st.playing, speed: st.speed, idx: st.idx, length: st.length }));
      },
    });
    replayCtrlRef.current = ctrl;
    replayRef.current = { full, idx: 0 };
    // startIndex از «کلیک روی چارت» (سبکِ TV) — کلمپ به بازهٔ معتبر؛ نبودش ⇒ پیش‌فرضِ ۵۵٪
    const si = (startIndex != null && Number.isFinite(startIndex)) ? Math.max(1, Math.min(full.length - 2, Math.round(startIndex))) : null;
    ctrl.enter(full, si != null ? { startIndex: si } : { startPct: 0.55 }); // onSlice ⇒ سری ساخته می‌شود، onChange ⇒ state ست می‌شود
    // به‌جای fitContent (که برشِ ۰..si را تمامِ عرض پُر می‌کرد و «حذفِ آینده» بصری پیدا نبود):
    // کندلِ شروع را نزدیکِ لبهٔ راست با فضای خالیِ آینده در سمتِ راست نشان بده — دقیقاً سبکِ بازپخشِ TradingView/go-charting.
    // با پلی، کندل‌ها یکی‌یکی در همان فضای خالیِ راست ظاهر می‌شوند.
    try {
      const ts = chartRef.current.timeScale();
      const startIdx = (si != null && Number.isFinite(si)) ? si : Math.floor(full.length * 0.55);
      const vb = 170; // پهنای پنجرهٔ دید (تعداد بار)
      ts.setVisibleLogicalRange({ from: startIdx - vb * 0.72, to: startIdx + vb * 0.28 });
    } catch (e) { try { chartRef.current.timeScale().fitContent(); } catch (e2) {} }
    // بارگذاریِ ریزکندل‌ها برای ذره‌بینِ بار (۶.۳) — opt-in و ناهمگام؛ اگر ناموفق
    // شد replay بدونِ ذره‌بین کار می‌کند (سقوطِ امن به step معمولی).
    if (intrabarOn && INTRABAR_SUB_TF[tf] && !NONSTANDARD.includes(chartType) && !DERIVED_TF[tf]) {
      const subTf = INTRABAR_SUB_TF[tf];
      const from = full[0] ? full[0].t : 0;
      api.chart(symbol, subTf, '', 5000, 0).then((r) => {
        if (!replayCtrlRef.current || replayCtrlRef.current !== ctrl) return; // replay عوض شده
        const subs = (r.candles || []).filter((c) => c.t >= from);
        if (!subs.length) return;
        // نگاشتِ زمانِ بارِ والد → ریزکندل‌های داخلش (بر اساسِ بازهٔ [bar.t, nextBar.t))
        const map = new Map();
        let k = 0;
        for (let i = 0; i < full.length; i++) {
          const bt = full[i].t, nt = i + 1 < full.length ? full[i + 1].t : Infinity;
          const bucket = [];
          while (k < subs.length && subs[k].t < bt) k++;
          while (k < subs.length && subs[k].t < nt) { bucket.push({ t: subs[k].t, o: subs[k].o, h: subs[k].h, l: subs[k].l, c: subs[k].c, v: subs[k].v }); k++; }
          if (bucket.length > 1) map.set(bt, bucket);
        }
        if (map.size) { ctrl.setIntrabarData(map); ctrl.enableIntrabar(true); }
      }).catch(() => { /* بدونِ ذره‌بین ادامه بده */ });
    }
    setReplay((s) => ({ ...s, on: true, playing: false }));
  };
  const exitReplay = () => {
    if (replayCtrlRef.current) { replayCtrlRef.current.destroy(); replayCtrlRef.current = null; }
    // خطِ MAحجم را پیش از load حذف کن تا با دادهٔ کهنهٔ برشِ بازپخش (کوتاه‌تر از دادهٔ کاملِ بازساخته‌شده)
    // خطای async «Value is null» ندهد؛ applyVolume آن را تازه می‌سازد (مثلِ enter که همیشه پاک است).
    try { if (volMaRef.current && chartRef.current) { chartRef.current.removeSeries(volMaRef.current); volMaRef.current = null; } } catch (e) { /* */ }
    setReplay({ on: false, playing: false, speed: replay.speed, idx: 0, length: 0 });
    setPractice({ pos: null, realized: 0, trades: 0, wins: 0, last: null }); // بستنِ حالتِ تمرین با خروج از بازپخش
    load();
  };
  enterReplayRef.current = enterReplay;
  // ── حالتِ تمرینِ معامله (فقط حینِ بازپخش) ──
  const replayCurPrice = useCallback(() => { try { const f = replayRef.current.full || []; const c = f[replayRef.current.idx]; return c ? c.c : null; } catch (e) { return null; } }, []);
  // فاصلهٔ حدِ ضرر بر پایهٔ نوسانِ اخیر (۱٫۵×ATR) — واقع‌گرایانه‌تر از درصدِ ثابت؛ اگر ATR نبود fallback ۰٫۵٪.
  const practiceStopDist = useCallback((px) => {
    const floor = (px || 0) * 0.0015; // کفِ ~۰٫۱۵٪ تا در نوسانِ خیلی کم، SL زیرِ یک پیپ و بستنِ آنی رخ ندهد
    try { const full = replayRef.current.full || []; const idx = replayRef.current.idx; const recent = full.slice(Math.max(0, idx - 20), idx + 1); const atr = avgRange(recent, 14); if (atr && Number.isFinite(atr) && atr > 0) return Math.max(atr * 1.5, floor); } catch (e) { /* */ }
    return (px || 0) * 0.005;
  }, []);
  const practiceOpen = useCallback((side) => {
    const px = replayCurPrice(); if (px == null) return;
    const d = practiceStopDist(px); // SL ≈ ۱٫۵×ATR ، TP ≈ ۳×ATR (نسبتِ ریسک‌به‌ریوارد ۱:۲)
    setPractice((p) => (p.pos ? p : { ...p, pos: { side, entry: px, sl: side === 'buy' ? px - d : px + d, tp: side === 'buy' ? px + 2 * d : px - 2 * d } }));
  }, [replayCurPrice, practiceStopDist]);
  const practiceCloseAt = useCallback((atPx) => {
    setPractice((p) => { if (!p.pos) return p; const px = (atPx != null && Number.isFinite(atPx)) ? atPx : replayCurPrice(); if (px == null) return p; const raw = p.pos.side === 'buy' ? px - p.pos.entry : p.pos.entry - px; const pct = p.pos.entry ? (raw / p.pos.entry) * 100 : 0; return { pos: null, realized: p.realized + pct, trades: p.trades + 1, wins: p.wins + (pct > 0 ? 1 : 0), last: pct }; });
  }, [replayCurPrice]);
  const practiceClose = useCallback(() => practiceCloseAt(null), [practiceCloseAt]);
  // وارونه‌کردنِ پوزیشن (مثلِ Reverse در paper-tradingِ TV): پوزیشنِ فعلی را می‌بندد و جهتِ مخالف را با قیمتِ فعلی باز می‌کند.
  const practiceReverse = useCallback(() => {
    setPractice((p) => {
      if (!p.pos) return p; const px = replayCurPrice(); if (px == null) return p;
      const raw = p.pos.side === 'buy' ? px - p.pos.entry : p.pos.entry - px; const pct = p.pos.entry ? (raw / p.pos.entry) * 100 : 0;
      const side = p.pos.side === 'buy' ? 'sell' : 'buy'; const d = practiceStopDist(px);
      return { realized: p.realized + pct, trades: p.trades + 1, wins: p.wins + (pct > 0 ? 1 : 0), last: pct, pos: { side, entry: px, sl: side === 'buy' ? px - d : px + d, tp: side === 'buy' ? px + 2 * d : px - 2 * d } };
    });
  }, [replayCurPrice, practiceStopDist]);
  const practiceReset = useCallback(() => setPractice({ pos: null, realized: 0, trades: 0, wins: 0, last: null }), []);
  useEffect(() => { practicePosRef.current = practice.pos; }, [practice.pos]);
  practiceCloseAtRef.current = practiceCloseAt;
  // خطوطِ ورود/حدِضرر/حدِسودِ معاملهٔ تمرینی روی چارت (مثلِ خطوطِ پوزیشنِ TV) — روی seek/step که سری بازساخته می‌شود دوباره کشیده می‌شوند.
  useEffect(() => {
    const s = priceSeriesRef.current;
    const cur = practiceLineRef.current;
    const want = replay.on && practice.pos && s;
    if (cur && (!want || cur.series !== s)) { (cur.lines || []).forEach((l) => { try { cur.series.removePriceLine(l); } catch (e) {} }); practiceLineRef.current = null; }
    if (!want) return;
    if (practiceLineRef.current && practiceLineRef.current.series === s) return; // همان سری، خطوط سرِجایشان
    try {
      const isBuy = practice.pos.side === 'buy';
      const lines = [];
      lines.push(s.createPriceLine({ price: practice.pos.entry, color: '#2962ff', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: isBuy ? 'لانگِ تمرین' : 'شورتِ تمرین' }));
      if (practice.pos.sl != null) lines.push(s.createPriceLine({ price: practice.pos.sl, color: TH.down, lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'حدِ ضرر' }));
      if (practice.pos.tp != null) lines.push(s.createPriceLine({ price: practice.pos.tp, color: TH.up, lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'حدِ سود' }));
      practiceLineRef.current = { lines, series: s };
    } catch (e) { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practice.pos, replay.on, replay.idx, TH]);
  // حالتِ انتخابِ نقطهٔ شروعِ بازپخش (سبکِ TV): با کلیک روی چارت، کندلِ کلیک‌شده = نقطهٔ شروع.
  useEffect(() => {
    if (!replayPick) return undefined;
    const chart = chartRef.current; if (!chart) { setReplayPick(false); return undefined; }
    const onClick = (param) => {
      if (!param) return;
      const cs = candlesRef.current || [];
      let idx = -1;
      if (param.time != null) idx = cs.findIndex((c) => c.t === param.time);
      if (idx < 0 && param.logical != null && Number.isFinite(param.logical)) idx = Math.round(param.logical); // fallback: ایندکسِ منطقی
      if (idx < 0 || idx >= cs.length) return; // کلیکِ بیرون از کندل‌ها — منتظرِ کلیکِ معتبر بمان
      setReplayPick(false);
      if (enterReplayRef.current) enterReplayRef.current(idx);
    };
    const onKey = (e) => { if (e.key === 'Escape') setReplayPick(false); };
    chart.subscribeClick(onClick);
    window.addEventListener('keydown', onKey);
    return () => { try { chart.unsubscribeClick(onClick); } catch (e) {} window.removeEventListener('keydown', onKey); };
  }, [replayPick]);
  const replayStep = useCallback(() => {
    const ctrl = replayCtrlRef.current; if (ctrl) ctrl.step();
  }, []);
  const replayStepBack = useCallback(() => {
    const ctrl = replayCtrlRef.current; if (ctrl) ctrl.stepBack();
  }, []);
  const replaySeek = useCallback((index) => {
    const ctrl = replayCtrlRef.current; if (ctrl) ctrl.seek({ index });
  }, []);
  // پرش به ابتدا/انتهای بازپخش (سبکِ TV)
  const replayToStart = useCallback(() => { const ctrl = replayCtrlRef.current; if (ctrl) ctrl.seek({ index: Math.min(30, (ctrl.full.length || 1) - 1) }); }, []);
  const replayToEnd = useCallback(() => { const ctrl = replayCtrlRef.current; if (ctrl) ctrl.seek({ index: (ctrl.full.length || 1) - 1 }); }, []);
  // پرش با گامِ بزرگ (۱۰ کندل) جلو/عقب
  const replayJump = useCallback((delta) => { const ctrl = replayCtrlRef.current; if (ctrl) ctrl.seek({ index: Math.max(0, Math.min((ctrl.full.length || 1) - 1, ctrl.idx + delta)) }); }, []);
  // در حینِ بازپخش: کلیک روی هر کندلِ آشکارشده ⇒ پرشِ مکان‌نمای بازپخش به همان‌جا (سبکِ TV: «هر کندل را بزن تا قبل/بعدش را ببینی»)
  useEffect(() => {
    if (!replay.on || replayPick) return undefined;
    const chart = chartRef.current; if (!chart) return undefined;
    const onClick = (param) => {
      if (drawRef.current && drawRef.current.tool && drawRef.current.tool !== 'cursor') return; // ابزارِ ترسیم فعال است ⇒ کلیک برای رسم، نه پرش
      const ctrl = replayCtrlRef.current; if (!ctrl || !param || param.time == null) return;
      const idx = indexForTime(ctrl.full || [], param.time);
      if (idx >= 0) ctrl.seek({ index: idx });
    };
    chart.subscribeClick(onClick);
    return () => { try { chart.unsubscribeClick(onClick); } catch (e) {} };
  }, [replay.on, replayPick]);
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
        else if (chartType !== 'heikin') s.update({ time: curBar, open: nc.o, high: nc.h, low: nc.l, close: nc.c, ...barTint(settingsRef.current, last.c, nc.c) });
      } else {
        last.h = Math.max(last.h, mid); last.l = Math.min(last.l, mid); last.c = mid;
        if (isVal) s.update({ time: last.t, value: mid });
        else if (chartType !== 'heikin') { const pc = cs.length >= 2 ? cs[cs.length - 2].c : last.o; s.update({ time: last.t, open: last.o, high: last.h, low: last.l, close: mid, ...barTint(settingsRef.current, pc, mid) }); }
      }
    } catch (e) { /* */ }
    // خطِ LIVE با applyOptions (سبک، هر فریم بدونِ remove/create)
    // خطِ LIVE هم مثلِ برچسبِ آخرین‌قیمتِ نیتیو با توگلِ «خطِ قیمتِ آخر» (priceLineShown) کنترل می‌شود تا خاموش‌کردنِ آن، هر دو برچسب را ببرد (سازگاری با «Last price line»ِ TV). #308
    try { const showLive = settingsRef.current.priceLineShown !== false; if (liveLineRef.current) liveLineRef.current.applyOptions({ price: mid, lineVisible: showLive, axisLabelVisible: showLive }); else liveLineRef.current = s.createPriceLine({ price: mid, color: '#2962FF', lineWidth: 1, lineStyle: 1, lineVisible: showLive, axisLabelVisible: showLive, title: 'LIVE' }); } catch (e) { /* */ }
  }, [chartType, tf]);

  // تیکِ واقعی → فقط «هدف» را تنظیم می‌کند؛ حلقهٔ انیمیشن نرم به سمتش می‌بَرَد (حسِ تیک‌به‌تیک)
  const applyTick = useCallback((mid) => {
    if (NONSTANDARD.includes(chartType)) { setLivePrice(mid); return; }
    if (!Number.isFinite(mid)) return;
    const e = easeRef.current; e.target = mid;
    if (e.display == null) { e.display = mid; e.lastApplied = mid; applyMid(mid); } // اولین تیک: فوری
    else if (typeof e.wake === 'function') e.wake();
    setLivePrice(mid);
  }, [chartType, applyMid]);

  // انیمیشنِ رویدادمحور: فقط پس از رسیدنِ قیمتِ واقعی بیدار می‌شود، با ضریبِ ثابت
  // به target همگرا می‌شود و در نیمِ minMove دقیقاً snap و کاملاً idle می‌شود.
  useEffect(() => {
    let raf = 0;
    let disposed = false;
    const frame = () => {
      raf = 0;
      const e = easeRef.current;
      if (e.target != null && e.display != null && priceSeriesRef.current && !(replayRef.current && replayPlayingRef.current) && !NONSTANDARD.includes(chartType)) {
        const step = advanceLivePriceFrame(e, Math.pow(10, -priceDigits(symbolRef.current)));
        if (step.value != null) e.display = step.value;
        if (step.shouldApply) {
          e.lastApplied = step.value;
          applyMid(step.value);
        }
        if (!step.settled && !disposed) raf = requestAnimationFrame(frame);
      }
    };
    const wake = () => { if (!disposed && !raf) raf = requestAnimationFrame(frame); };
    easeRef.current.wake = wake;
    if (easeRef.current.target != null && !Object.is(easeRef.current.display, easeRef.current.target)) wake();
    return () => {
      disposed = true;
      if (easeRef.current.wake === wake) easeRef.current.wake = null;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [applyMid, chartType]);

  // ── زیرساختِ مشترکِ WSِ چارت — مرآت‌ها/وضعیت بینِ افکتِ سوکت و پولِ تطبیقی ──
  const watchRef = useRef(watch); watchRef.current = watch;                 // برای subscribe در هندلرهای mount-time سوکت
  const applyTickRef = useRef(applyTick); applyTickRef.current = applyTick; // سوکت یک‌بار mount می‌شود اما applyTick با tf/نوعِ چارت عوض می‌شود
  const wsSockRef = useRef(null);           // سوکتِ فعال (null = قطع)
  const wsLastMsgRef = useRef(0);           // زمانِ آخرین پیامِ سرور (از هر نوع، حتی pong) — معیارِ سلامت
  const wsTickAtRef = useRef({});           // آخرین tick/candleِ هر نماد از WS — مالکیتِ per-symbol در poll
  const wsSymMapRef = useRef({});           // نامِ نرمالِ سرور → نامِ اپ؛ کلیدهای live/lastMid نامِ اپ می‌مانند
  const wsChartSubRef = useRef(null);       // {symbol,timeframe}ِ اشتراکِ کندلِ فعلی — برای unsubscribe هنگامِ تعویض
  const wsPriceSubsRef = useRef(new Set()); // مجموعهٔ فعلیِ subscribe_prices (سمتِ سرور «جایگزینیِ کامل» است)
  const wsDeadTokenRef = useRef(null);      // توکنی که 4401 گرفت — تا تغییرِ توکن (login/مهمانِ نو) تلاشِ دوباره نمی‌کنیم
  const wsSyncRef = useRef(null);           // syncSubsِ داخلِ افکتِ سوکت؛ افکتِ تغییرِ نماد/تایم‌فریم/واچ صدایش می‌زند
  // سلامتِ WS: سوکتِ باز + پیامی در ۱۵ثِ اخیر (کادنسِ سرور ~۱ث است؛ سکوتِ طولانی = سوکتِ عملاً مرده)
  const wsFresh = useCallback(() => { const s = wsSockRef.current; return !!s && s.readyState === 1 && Date.now() - wsLastMsgRef.current < 15000; }, []);

  // حلقهٔ نظرسنجیِ قیمتِ زنده — برای نماد + واچ‌لیست. با WSِ سالم نقشش «مکمل» می‌شود:
  // tick/mid از سوکت می‌آید و REST فقط هر ~۱۰ث برای چیزهایی که WS ندارد (market_open و
  // اسپردِ bid/ask) صدا می‌شود؛ با مرگ/سکوتِ سوکت بی‌درنگ همان ۷۰۰msِ همیشگی برمی‌گردد.
  useEffect(() => {
    let stop = false;
    let lastFull = 0; // زمانِ آخرین فراخوانِ REST — دریچهٔ ~۱۰ثانیه‌ایِ حالتِ WSسالم
    const poll = async () => {
      lastFull = Date.now();
      try {
        const list = rightTab === 'screener' ? symbols : [symbol, ...watch];
        const syms = Array.from(new Set(list)).join(',');
        if (!syms) return;
        const r = await api.bnPrices(syms);
        if (stop) return;
        setMarketOpen(!!r.market_open); // WS معادلی برای market_open ندارد — REST همیشه مرجعِ این چیپ
        const prices = r.prices || {};
        const now = Date.now();
        // «داغِ WS» = سوکت سالم و همین نماد به‌تازگی از سوکت tick گرفته ⇒ mid/dirِ تازه‌ترِ WS
        // نباید با پاسخِ کهنه‌ترِ REST بازنویسی شود؛ فقط bid/ask (که WS ندارد) تازه می‌شود.
        const hot = (k) => wsFresh() && now - (wsTickAtRef.current[k] || 0) < 15000;
        setLive((cur) => {
          const lv = {};
          Object.entries(prices).forEach(([k, v]) => {
            if (hot(k) && cur[k] && cur[k].mid != null) { lv[k] = { ...cur[k], bid: v.bid, ask: v.ask }; return; }
            const prev = lastMidRef.current[k];
            lv[k] = { mid: v.mid, bid: v.bid, ask: v.ask, dir: prev == null ? 0 : (v.mid > prev ? 1 : v.mid < prev ? -1 : 0) };
            lastMidRef.current[k] = v.mid;
          });
          return lv;
        });
        if (prices[symbol]) { if (!hot(symbol)) applyTick(prices[symbol].mid); } // نمادِ داغ: چارت را WS می‌رانَد (applyTickِ دوباره ممنوع)
        else if (!hot(symbol)) setLivePrice(null); // غیبتِ گذرا در REST نباید قیمتِ زندهٔ WS را پاک کند
      } catch (e) {}
    };
    poll();
    const id = setInterval(() => {
      // فقط وقتی WS واقعاً چارتِ همین نماد را تغذیه می‌کند آهسته شو؛ در هر حالتِ دیگر (سوکتِ
      // مرده، نمادِ بی‌tick، تبِ اسکنر که نمادهایش خارج از اشتراکِ WSاند) همان ۷۰۰ms برقرار است.
      const symHot = wsFresh() && Date.now() - (wsTickAtRef.current[symbol] || 0) < 15000;
      if (symHot && rightTab !== 'screener' && Date.now() - lastFull < 10000) return;
      poll();
    }, 700);
    return () => { stop = true; clearInterval(id); };
  }, [symbol, watch, applyTick, rightTab, symbols, wsFresh]);

  // تازه‌سازیِ آلارم‌ها (برای نمایشِ trigger‌های سمتِ‌سرور) هر ۳۰ ثانیه
  useEffect(() => {
    const id = setInterval(() => { api.bnAlerts().then((r) => setSavedAlerts(r || [])).catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, []);

  // ── WebSocket استریمِ چارتِ سرور (/api/academy/chart/stream) — منبعِ اولِ real-time ──
  // پیش‌فرض روشن با همان JWTی که REST به‌صورتِ Bearer می‌فرستد (localStorage: cp_academy_token).
  // یک سوکت برای کلِ عمرِ صفحه؛ تعویضِ نماد/تایم‌فریم/واچ فقط resubscribe روی همان سوکت است.
  // pollِ بالا با سلامتِ همین سوکت تطبیق می‌یابد؛ نبودِ توکن یا 4401 ⇒ WS خاموش و poll مثلِ قبل.
  useEffect(() => {
    let disposed = false;
    let sock = null;
    let retryTimer = 0;   // تایمرِ اتصالِ بعدی (backoff یا انتظارِ تغییرِ توکن)
    let pingTimer = 0;    // ضربانِ ۲۵ث — عبورِ ترافیک از پروکسی را تضمین می‌کند؛ مرگ فقط با close معلوم می‌شود
    let flushTimer = 0;   // ادغامِ tickهای پیاپی در یک setLive (هر فریمِ سرور یک onmessageِ جداست)
    let attempt = 0;      // شمارندهٔ backoff — با openِ موفق صفر می‌شود
    const BACKOFF = [1000, 2000, 5000, 10000, 30000]; // نمایی تا سقفِ ۳۰ث
    const pending = {};   // tickهای منتظرِ flush: {نامِ اپ: {mid, dir}}

    const send = (obj) => { if (!sock || sock.readyState !== 1) return false; try { sock.send(JSON.stringify(obj)); return true; } catch (e) { return false; } };

    // چند tickِ هم‌زمان (سرور هر ~۱ث برای همهٔ نمادها پشتِ‌سرِهم می‌فرستد) → فقط یک رندر
    const flushLive = () => {
      flushTimer = 0;
      const keys = Object.keys(pending);
      if (!keys.length) return;
      const batch = {};
      keys.forEach((k) => { batch[k] = pending[k]; delete pending[k]; });
      // ادغام با وضعِ موجود: bid/ask از pollِ قبلی می‌ماند؛ فقط mid/dir از WS تازه می‌شود
      setLive((cur) => { const lv = { ...cur }; keys.forEach((k) => { lv[k] = { ...(cur[k] || {}), ...batch[k] }; }); return lv; });
    };

    // همگام‌سازیِ اشتراک‌ها با نماد/تایم‌فریم/واچِ جاری — idempotent و diffمحور؛
    // هم از onopen صدا می‌شود هم (روی همان سوکتِ باز) از افکتِ تغییرِ نماد/تایم‌فریم/واچ.
    const syncSubs = () => {
      if (!sock || sock.readyState !== 1) return;
      // اشتراکِ کندلِ چارتِ جاری — فقط تایم‌فریمی که سرور مستقیم می‌فهمد و اپ مشتق‌شده نمی‌سازد؛
      // در غیرِ این صورت subscribe نمی‌کنیم و tickها به‌تنهایی applyTick را می‌رانند.
      const sym = wsStreamSym(symbolRef.current);
      const tfNow = tfRef.current;
      const want = (sym && WS_STREAM_TFS.has(tfNow) && !DERIVED_TF[tfNow] && !customDerivedRef.current[tfNow])
        ? { symbol: sym, timeframe: tfNow } : null;
      const cur = wsChartSubRef.current;
      const same = cur === want || (!!cur && !!want && cur.symbol === want.symbol && cur.timeframe === want.timeframe);
      if (!same) {
        if (cur) send({ type: 'unsubscribe', symbol: cur.symbol, timeframe: cur.timeframe });
        if (want) send({ type: 'subscribe', symbol: want.symbol, timeframe: want.timeframe });
        wsChartSubRef.current = want;
      }
      // tickهای نماد+واچ‌لیست — سمتِ سرور «جایگزینیِ کاملِ مجموعه» با سقفِ ۵۰ نماد
      const wantSyms = [];
      const map = {};
      [symbolRef.current, ...watchRef.current].forEach((s) => {
        const n = wsStreamSym(s);
        if (n && !(n in map) && wantSyms.length < 50) { map[n] = s; wantSyms.push(n); }
      });
      const prev = wsPriceSubsRef.current;
      if (wantSyms.length !== prev.size || wantSyms.some((x) => !prev.has(x))) {
        if (send({ type: 'subscribe_prices', symbols: wantSyms })) {
          wsPriceSubsRef.current = new Set(wantSyms);
          wsSymMapRef.current = map;
        }
      }
    };
    wsSyncRef.current = syncSubs;

    const onMessage = (ev) => {
      wsLastMsgRef.current = Date.now(); // هر پیامی (حتی pong) یعنی سوکت زنده است
      let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'tick') {
        const key = wsSymMapRef.current[msg.symbol] || msg.symbol; // نامِ سمتِ اپ (کلیدِ live/lastMid)
        const price = Number(msg.price);
        if (!Number.isFinite(price) || price <= 0) return;
        wsTickAtRef.current[key] = Date.now();
        const prev = lastMidRef.current[key];
        pending[key] = { mid: price, dir: prev == null ? 0 : (price > prev ? 1 : price < prev ? -1 : 0) };
        lastMidRef.current[key] = price;
        if (!flushTimer) flushTimer = setTimeout(flushLive, 120);
        if (key === symbolRef.current) applyTickRef.current(price); // همان خطِ لولهٔ poll: کندلِ جاری + خطِ LIVE + easing
      } else if (msg.type === 'candle') {
        // فقط نماد/تایم‌فریمِ جاریِ چارت. closed:true هم فقط applyTick — رول‌شدنِ بار را خودِ
        // applyMid با سطلِ ساعتِ دیوار انجام می‌دهد؛ دقیقاً همان مسیری که pollِ امروز به آن
        // تکیه دارد (رفتارِ یکسان، فقط سریع‌تر). فریمِ کهنهٔ نماد/تایم‌فریمِ قبلی هم همین‌جا رد می‌شود.
        const c = msg.candle;
        const key = wsSymMapRef.current[msg.symbol] || msg.symbol;
        if (!c || key !== symbolRef.current || msg.timeframe !== tfRef.current) return;
        const close = Number(c.c);
        if (!Number.isFinite(close) || close <= 0) return;
        wsTickAtRef.current[key] = Date.now(); // کندل هم «تازگیِ» نماد است (tickِ هم‌قیمتش سمتِ سرور سرکوب شده)
        applyTickRef.current(close);
      }
      // snapshot: تاریخچه از REST (load) می‌آید — عمداً نادیده تا یک خطِ لولهٔ واحد بماند.
      // status(stale/live): یعنی «قیمت ۱۲۰ث ثابت»، نه بسته‌بودنِ بازار ⇒ با چیپِ market_open
      // هم‌معنا نیست و همان poll مرجعش می‌ماند. pong: فقط برای تازگیِ wsLastMsgRef.
    };

    const scheduleRetry = () => {
      if (disposed) return;
      const wait = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
      attempt += 1;
      retryTimer = setTimeout(connect, wait);
    };

    const connect = () => {
      if (disposed) return;
      // توکن در لحظهٔ اتصال خوانده می‌شود؛ login/logout را همین حلقهٔ اتصال برمی‌دارد (ساده و کافی)
      let token = null; try { token = tokenStore.get(); } catch (e) { /* noop */ }
      if (!token || token === wsDeadTokenRef.current) { retryTimer = setTimeout(connect, 5000); return; } // بی‌توکن/توکنِ 4401خورده ⇒ WS ممکن نیست؛ pollِ ۷۰۰ms مسیرِ کاربر می‌ماند تا توکن عوض شود
      let url; try { url = wsStreamUrl(token); } catch (e) { return; }
      try { sock = new WebSocket(url); } catch (e) { sock = null; scheduleRetry(); return; }
      wsSockRef.current = sock;
      sock.onopen = () => {
        if (disposed) return;
        attempt = 0; // اتصالِ موفق ⇒ backoff از نو
        wsLastMsgRef.current = Date.now();
        wsChartSubRef.current = null; wsPriceSubsRef.current = new Set(); // سوکتِ نو = سرورِ بی‌خبر؛ اشتراک‌ها از نو
        syncSubs();
        if (!pingTimer) pingTimer = setInterval(() => send({ type: 'ping' }), 25000);
      };
      sock.onmessage = onMessage;
      sock.onerror = () => { try { if (sock) sock.close(); } catch (e) { /* noop */ } }; // خطا → close؛ منطقِ واحدِ reconnect در onclose
      sock.onclose = (ev) => {
        if (wsSockRef.current === sock) wsSockRef.current = null; // wsFresh فوراً false ⇒ poll در ≤۷۰۰ms برمی‌گردد
        sock = null;
        if (pingTimer) { clearInterval(pingTimer); pingTimer = 0; }
        if (disposed) return;
        if (ev && ev.code === 4401) { wsDeadTokenRef.current = token; retryTimer = setTimeout(connect, 5000); return; } // مهمانِ ردشده/توکنِ منقضی: retryِ نمایی نه؛ فقط هر ۵ث منتظرِ توکنِ تازه
        scheduleRetry();
      };
    };
    connect();

    return () => {
      disposed = true;
      wsSyncRef.current = null;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (flushTimer) clearTimeout(flushTimer);
      wsSockRef.current = null;
      if (sock) { sock.onclose = null; sock.onmessage = null; try { sock.close(1000); } catch (e) { /* noop */ } sock = null; }
    };
  }, []);

  // تعویضِ نماد/تایم‌فریم/واچ‌لیست ⇒ فقط resubscribe روی همان سوکتِ باز (بدونِ قطع/وصلِ دوباره).
  // syncSubs از symbolRef می‌خواند؛ برای اینکه هرگز (مستقل از ترتیبِ افکت‌ها) نمادِ کهنه
  // subscribe نشود، ref همین‌جا هم دفاعی تازه می‌شود (تکرارِ بی‌ضررِ همان مقدار).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { symbolRef.current = symbol; if (wsSyncRef.current) wsSyncRef.current(); }, [symbol, tf, watch]);

  useEffect(() => {
    api.chartSymbols().then((r) => setSymbols(r.symbols || [])).catch(() => {});
    api.bnWatchlist().then((r) => setWatch(r.symbols || [])).catch(() => {});
    api.bnScripts().then((r) => { setScripts(r.scripts || []); if (!code) setCode(r.starter || ''); }).catch(() => {});
    api.bnLayouts().then((r) => setLayouts(r || [])).catch(() => {});
    api.bnAlerts().then((r) => setSavedAlerts(r || [])).catch(() => {});
    // eslint-disable-next-line
  }, []);

  // فِچِ نمادها فقط یک‌بار در mount اجرا می‌شود؛ اگر آن لحظه توکن نبود (قبل از login) لیست خالی/ناقص می‌مانْد.
  //   با بازگشتِ فوکوس (مثلاً بعد از login) دوباره fetch می‌کنیم تا هر ۱۰۰ کوین + ۴۳ فارکس کامل بیاید.
  useEffect(() => {
    const refetch = () => {
      api.chartSymbols().then((r) => { if (r && Array.isArray(r.symbols) && r.symbols.length) setSymbols(r.symbols); }).catch(() => {});
      api.bnWatchlist().then((r) => { if (r && Array.isArray(r.symbols)) setWatch(r.symbols); }).catch(() => {});
    };
    window.addEventListener('focus', refetch);
    return () => window.removeEventListener('focus', refetch);
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

  const onSaveScript = useCallback(async () => {
    try {
      const r = await api.bnScriptSave({ name: scriptName, source: code });
      setScripts((s) => [{ id: r.id, name: scriptName }, ...s.filter((x) => x.id !== r.id)]);
    } catch (e) { /* graceful */ }
  }, [scriptName, code]);
  const loadScript = async (id) => { try { const r = await api.bnScriptGet(id); setCode(r.source || ''); setScriptName(r.name || 'اسکریپت'); } catch (e) {} };

  // ذخیرهٔ پیش‌فرضِ per-indicator (هم‌ترازِ «Save as default»ِ TV) — در localStorage، بی‌صدا و گارددار.
  const saveIndDefault = (key, it) => { try { const all = JSON.parse(localStorage.getItem('bn_ind_defaults') || '{}') || {}; all[key] = { inputs: it.inputs, color: it.color, style: { width: it.width, lineStyle: it.lineStyle, opacity: it.opacity, lineColors: it.lineColors, plotHidden: it.plotHidden, scale: it.scale, fillColor: it.fillColor, fillOpacity: it.fillOpacity, precision: it.precision } }; localStorage.setItem('bn_ind_defaults', JSON.stringify(all)); } catch (e) { /* بی‌اعتنا */ } };
  const addInd = (key) => { const def = REGISTRY[key]; let sv = null; try { sv = (JSON.parse(localStorage.getItem('bn_ind_defaults') || '{}') || {})[key]; } catch (e) {} const item = (sv && typeof sv === 'object') ? { id: uid(), key, inputs: { ...def.inputs, ...(sv.inputs || {}) }, color: sv.color || def.color, ...(sv.style || {}) } : { id: uid(), key, inputs: { ...def.inputs }, color: def.color }; if (def.pane === 'main') setOverlays((o) => [...o, item]); else setSubs((s) => [...s, item]); setIndMenu(false); };
  const rmInd = (scope, id) => { if (scope === 'main') setOverlays((o) => o.filter((x) => x.id !== id)); else setSubs((s) => s.filter((x) => x.id !== id)); };
  const updInd = (scope, id, patch) => { const fn = (arr) => arr.map((x) => (x.id === id ? { ...x, ...patch, inputs: { ...x.inputs, ...(patch.inputs || {}) } } : x)); if (scope === 'main') setOverlays(fn); else setSubs(fn); };

  const toggleWatch = async (sym) => { const next = watch.includes(sym) ? watch.filter((s) => s !== sym) : [...watch, sym]; setWatch(next); try { await api.bnWatchlistSet(next); } catch (e) {} };

  // لِی‌اوت
  const _persistRef = useRef(null);
  const persistLayoutDebounced = () => {};
  const saveLayout = async () => {
    const name = window.prompt('نامِ چیدمان:', 'چیدمان من'); if (!name) return;
    const data = { symbol, tf, chartType, theme, overlays, subs, drawings: drawRef.current ? drawRef.current.getDrawings() : [] };
    try { const r = await api.bnLayoutSave({ name, data }); setLayouts((l) => [{ id: r.id, name }, ...l]); setActiveLayoutId(r.id); } catch (e) {}
  };
  const loadLayout = async (id) => {
    try { const r = await api.bnLayoutGet(id); const d = r.data || {};
      if (d.theme) setTheme(d.theme); if (d.chartType) setChartType(d.chartType);
      setOverlays(d.overlays || []); setSubs(d.subs || []); if (d.symbol) setSymbol(d.symbol); if (d.tf) setTf(d.tf);
      setTimeout(() => drawRef.current && drawRef.current.setDrawings(d.drawings || []), 400);
      setActiveLayoutId(id);
    } catch (e) {}
  };
  // حذفِ چیدمانِ ذخیره‌شده (هم‌ترازِ مدیریتِ چیدمان‌های TV) — از سرور و از فهرستِ محلی
  const deleteLayout = async (id, name) => {
    if (!window.confirm(`حذفِ چیدمانِ «${name}»؟`)) return;
    try { await api.bnLayoutDelete(id); } catch (e) { /* graceful */ }
    setLayouts((l) => l.filter((x) => x.id !== id));
    setActiveLayoutId((cur) => (cur === id ? null : cur));
  };
  // «تغییرِ نام» یک چیدمانِ ذخیره‌شده (هم‌ترازِ Rename‌ِ TV) — فقط نام را در سرور آپدیت می‌کند (دادهٔ چیدمان دست‌نخورده).
  const renameLayout = async (id, name) => {
    const nn = window.prompt('نامِ جدیدِ چیدمان:', name || ''); if (nn == null) return;
    const trimmed = nn.trim(); if (!trimmed || trimmed === name) return;
    try { await api.bnLayoutRename(id, trimmed); } catch (e) { /* graceful */ }
    setLayouts((l) => l.map((x) => (x.id === id ? { ...x, name: trimmed } : x)));
  };
  // «ساختِ کپی» از یک چیدمانِ ذخیره‌شده (هم‌ترازِ Make a copyِ TV) — دادهٔ چیدمان را می‌گیرد و با نامِ «(کپی)» دوباره ذخیره می‌کند.
  const duplicateLayout = async (id, name) => {
    try {
      const r = await api.bnLayoutGet(id);
      const data = r && r.data ? r.data : {};
      const copyName = `${name} (کپی)`;
      const res = await api.bnLayoutSave({ name: copyName, data });
      if (res && res.id != null) setLayouts((l) => [{ id: res.id, name: copyName }, ...l]);
    } catch (e) { /* بی‌صدا degrade */ }
  };

  // آلارم
  const OP_LABELS = { above: 'بالای', below: 'پایینِ', cross_up: 'تقاطعِ صعودی از', cross_down: 'تقاطعِ نزولی از', cross: 'تقاطعِ', enter_channel: 'ورود به کانالِ', exit_channel: 'خروج از کانالِ', move_up_value: 'صعودِ', move_down_value: 'نزولِ', pct_up: 'صعودِ ٪', pct_down: 'نزولِ ٪' };
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

  // Arrowها یک مالک دارند: اگر ترسیمی انتخاب شده باشد همان را حرکت می‌دهند؛
  // وگرنه handler مربوط، Pan/Zoom یا Replay را انجام می‌دهد.
  const nudgeDrawing = useCallback((key, large = false) => {
    const dl = drawRef.current;
    if (!dl || !dl.nudgeSelected(key, large)) return false;
    treeRefresh();
    return true;
  }, [treeRefresh]);

  // ── لایهٔ میان‌بُرهای صفحه‌کلید (فصل ۱۰) — فقط هندلرهایی که از قبل وجود دارند نگاشت می‌شوند ──
  useEffect(() => {
    const detach = attachHotkeys({
      // ابزارها
      cursor: () => { setTool('cursor'); if (drawRef.current) drawRef.current.cancelInteraction(); treeRefresh(); },
      trend: () => setTool('trend'), hline: () => setTool('hline'), vline: () => setTool('vline'),
      ray: () => setTool('ray'), rect: () => setTool('rect'), fib: () => setTool('fib'),
      channel: () => setTool('channel'), text: () => setTool('text'), longshort: () => setTool('longshort'),
      // مقیاسِ TV: Alt+P درصدی، Alt+L لگاریتمی، Alt+I وارونه — تک‌مسیر از hotkeys.js (بدونِ دابل‌فایر). (#۴۴۴)
      percentScale: () => setScaleMode((m) => (m === 2 ? 0 : 2)),
      logScale: () => setScaleMode((m) => (m === 1 ? 0 : 1)),
      magnet: () => setMagnet((v) => !v), stayDraw: () => setStayDraw((v) => !v),
      // ویرایش
      undo: () => { drawRef.current && drawRef.current.undo(); treeRefresh(); },
      redo: () => { drawRef.current && drawRef.current.redo(); treeRefresh(); },
      deleteSel: () => { if (drawRef.current) { drawRef.current.removeSelected(); treeRefresh(); } },
      cloneSel: () => { if (selDraw >= 0 && drawRef.current) { drawRef.current.clone(selDraw); treeRefresh(); } },
      // «انتخابِ همهٔ ترسیم‌ها» (Ctrl+Aِ TV) — هاتکی از قبل در hotkeys.js تعریف بود ولی هندلر نداشت (مرده). حالا به multiSel وصل شد.
      selectAll: () => { if (drawRef.current) { drawRef.current.selectAll(); treeRefresh(); } },
      clearChart: () => clearScreen(),
      removeAll: () => { drawRef.current && drawRef.current.clearAll(); treeRefresh(); },
      lockSel: () => { if (selDraw >= 0 && drawRef.current) { drawRef.current.toggleLock(selDraw); treeRefresh(); } },
      // کپی/چسباندنِ ترسیم (Ctrl+C/Ctrl+V مثلِ TV) — تا این‌جا هاتکی‌ها ثبت بودند ولی هندلر نداشتند.
      copySel: () => { if (selDraw >= 0 && drawRef.current) { const c = drawRef.current.copy(selDraw); if (c) drawClipRef.current = c; } },
      pasteSel: () => { if (drawClipRef.current && drawRef.current) { drawRef.current.paste(drawClipRef.current); treeRefresh(); } },
      hideAll: () => setAllHidden((v) => { const nv = !v; try { drawRef.current && drawRef.current.hideAll(nv); } catch (e) {} treeRefresh(); return nv; }),
      // تایم‌فریم
      tfNext: () => setTf((t) => TFS[Math.min(TFS.length - 1, TFS.indexOf(t) + 1)] || t),
      tfPrev: () => setTf((t) => TFS[Math.max(0, TFS.indexOf(t) - 1)] || t),
      gotoDate: () => setGotoOpen(true), // Alt+G — بازکردنِ «پرش به تاریخ» (مثلِ TV)
      tf1: () => setTf('M5'), tf2: () => setTf('M15'), tf3: () => setTf('H1'), tf4: () => setTf('H4'), tf5: () => setTf('D1'),
      // نوعِ چارت
      typeCandles: () => setChartType('candles'), typeBars: () => setChartType('bars'),
      typeLine: () => setChartType('line'), typeArea: () => setChartType('area'), typeHeikin: () => setChartType('heikin'),
      // ناوبری / مقیاس
      scrollLeft: () => { if (nudgeDrawing('ArrowLeft')) return; try { const ts = chartRef.current.timeScale(); ts.scrollToPosition(ts.scrollPosition() - 5, false); } catch (e) {} },
      scrollRight: () => { if (nudgeDrawing('ArrowRight')) return; try { const ts = chartRef.current.timeScale(); ts.scrollToPosition(ts.scrollPosition() + 5, false); } catch (e) {} },
      scrollEnd: () => { try { chartRef.current.timeScale().scrollToRealTime(); } catch (e) {} },
      scrollHome: () => { try { chartRef.current.timeScale().scrollToPosition(-1e6, false); } catch (e) {} },
      zoomIn: (e) => { if (e.key === 'ArrowUp' && nudgeDrawing('ArrowUp')) return; try { const ts = chartRef.current.timeScale(); const bs = (ts.options().barSpacing || 8); ts.applyOptions({ barSpacing: Math.min(60, bs * 1.25) }); } catch (err) {} },
      zoomOut: (e) => { if (e.key === 'ArrowDown' && nudgeDrawing('ArrowDown')) return; try { const ts = chartRef.current.timeScale(); const bs = (ts.options().barSpacing || 8); ts.applyOptions({ barSpacing: Math.max(1.5, bs * 0.8) }); } catch (err) {} },
      nudgeUpFast: () => { nudgeDrawing('ArrowUp', true); },
      nudgeDownFast: () => { nudgeDrawing('ArrowDown', true); },
      fit: () => { try { chartRef.current.timeScale().fitContent(); } catch (e) {} },
      resetScale: () => { try { chartRef.current.priceScale('right').applyOptions({ autoScale: true }); setScaleLocked(false); } catch (e) {} },
      invertScale: () => setScaleInvert((v) => !v),
      // نما
      toggleRight: () => setShowRight((v) => !v),
      fullscreen: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else rootRef.current && rootRef.current.requestFullscreen(); } catch (e) {} },
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      indicators: () => setIndDlg(true),
      symbolSearch: () => { setSearchSeed(''); setSymModalMode('switch'); setSymModal(true); },
      settings: () => setChartSettingsOpen(true),
      newAlert: () => { setRightTab('alerts'); setShowRight(true); },
      help: () => setShowShortcuts((v) => !v),
      screenshot: () => quickScreenshot(),
      saveScript: () => { if (editorOpen) onSaveScript(); },
      // چیدمان
      saveLayout: () => saveLayout(),
      cycleGrid: () => setGridPreset((pp) => { const next = pp === '1' ? '2h' : pp === '2h' ? '4' : '1'; setGrid(presetToLegacyGrid(next)); return next; }),
      // ترید / بازپخش
      // حینِ بازپخش: Shift+B/Shift+S معاملهٔ تمرینی باز می‌کنند (نه سفارشِ paperِ واقعی)
      buy: () => (replay.on ? practiceOpen('buy') : quickTrade('buy')), sell: () => (replay.on ? practiceOpen('sell') : quickTrade('sell')),
      replayToggle: () => (replay.on ? exitReplay() : enterReplay()),
      replayStep: () => { if (!nudgeDrawing('ArrowRight', true)) replayStep(); },
      // این دو در hotkeys.js تعریف بودند ولی به هندلر وصل نشده بودند (Space/Shift+← بی‌اثر بود):
      replayPlay: () => replayToggle(),        // Space: پخش/مکث (فقط وقتی بازپخش روشن است اثر دارد)
      replayStepBack: () => { if (!nudgeDrawing('ArrowLeft', true)) replayStepBack(); }, // Shift+←: حرکتِ ترسیم یا گامِ عقب
    }, { target: window });
    return detach;
    // eslint-disable-next-line
  }, [selDraw, replay.on, treeRefresh, replayStep, replayStepBack, replayToggle, practiceOpen, quickScreenshot, nudgeDrawing, editorOpen, onSaveScript]);

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

  // #7 تایپ مستقیم روی چارت → جستجوی نماد. Ctrl/⌘+K فقط در dispatcher
  // اعلانی hotkeys.js مدیریت می‌شود تا هر فرمان دقیقاً یک مالک داشته باشد.
  useEffect(() => {
    const onKey = (e) => {
      // نکته: میان‌بُرهای مقیاسِ TV (Alt+I وارونه، Alt+P درصدی، Alt+L لگاریتمی) عمداً این‌جا مدیریت نمی‌شوند —
      // تک‌مسیر از hotkeys.js/attachHotkeys (invertScale/percentScale/logScale). لوپ #۴۴۱ این‌جا تکراری‌شان کرده بود
      // که با بایندِ ابزارِ Alt+P=کانال/Alt+L=لانگ‌شورت دابل‌فایر می‌شد؛ در #۴۴۴ آن بایندها به مقیاس تغییر یافت و بلوکِ تکراری حذف شد.
      // «تایپِ هر حرف/عدد روی چارت → بازکردنِ جستجوی نماد با همان حرف» (سبکِ type-to-searchِ TV).
      // فقط وقتی: بدونِ مودیفایر، تک‌کاراکترِ الفبا-عدد، فوکوس روی input/textarea/contenteditable نیست، و مدال/جستجو باز نیست.
      if (e.key && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const el = document.activeElement;
        const tag = el && el.tagName;
        const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable);
        // اگر مدال/دیالوگی باز باشد، ورودیِ آن فوکوس دارد ⇒ inField صادق است و همین‌جا برمی‌گردیم.
        if (inField) return;
        e.preventDefault(); setSearchSeed(e.key); setSymModalMode('switch'); setSymModal(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // §۱۶ منوها: بستن با کلیکِ بیرون یا Escape (رفتارِ استانداردِ Dropdown)
  useEffect(() => {
    if (!ctMenu && !crossMenu && !scaleMenu && !indMenu && !gridMenu && !search && !sessMenu && !cfgMenu && !layoutMenu && !gotoOpen && !tzBarOpen) return undefined;
    const closeAll = () => { setCtMenu(false); setCtCfgOpen(false); setCrossMenu(false); setScaleMenu(false); setIndMenu(false); setGridMenu(false); setSearch(''); setSessMenu(false); setCfgMenu(false); setLayoutMenu(false); setTfMenu(false); setGotoOpen(false); setTzBarOpen(false); };
    const onDown = (e) => { if (!e.target.closest('[data-menu]')) closeAll(); };
    const onEsc = (e) => { if (e.key === 'Escape') closeAll(); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc); };
  }, [ctMenu, crossMenu, scaleMenu, indMenu, gridMenu, search, sessMenu, cfgMenu, layoutMenu, gotoOpen, tzBarOpen]);

  const filteredSymbols = symbols.filter((s) => s.toLowerCase().includes(search.toLowerCase()));
  const txt = theme === 'dark' ? 'text-gray-200' : 'text-gray-800';

  // #7 متادیتای نمادها (دسته‌بندی/توضیحِ فارسی) — یک‌بار با تغییرِ symbols ساخته می‌شود
  const symbolMeta = useMemo(() => buildMeta(symbols), [symbols]);

  // #3 آیتم‌های Legend (overlays + subs) + مقادیرِ زنده (کراس‌هیر، وگرنه آخرین کندل)
  const legendItems = useMemo(() => ([
    ...overlays.map((o) => ({ id: o.id, key: o.key, scope: 'main', label: indLbl(o.key, o.inputs), title: indBase(o.key), args: indArgs(o.inputs), color: (o.lineColors && o.lineColors[0]) || o.color || (REGISTRY[o.key] && REGISTRY[o.key].color), visible: o.visible !== false })),
    ...subs.map((o) => ({ id: o.id, key: o.key, scope: 'sub', label: indLbl(o.key, o.inputs), title: indBase(o.key), args: indArgs(o.inputs), color: o.color || (REGISTRY[o.key] && REGISTRY[o.key].color), visible: o.visible !== false })),
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
  // لجندِ per-pane: آیتم‌های پنلِ اصلی و زیرین جدا؛ tops = مختصاتِ بالای هر پنلِ زیرین در کانتینرِ چارت
  const mainLegendItems = useMemo(() => legendItems.filter((i) => i.scope === 'main'), [legendItems]);
  const subLegendItems = useMemo(() => legendItems.filter((i) => i.scope === 'sub'), [legendItems]);
  const [subTops, setSubTops] = useState({});
  const recomputeSubTops = useCallback(() => {
    try {
      const subList = subs.filter((s) => { const d = REGISTRY[s.key]; return d && d.pane === 'sub' && s.visible !== false; });
      if (!subList.length) { setSubTops((prev) => (Object.keys(prev).length ? {} : prev)); return; }
      const H = mainRef.current ? mainRef.current.clientHeight : 0;
      if (!H) return;
      let taH = 28; try { taH = chartRef.current.timeScale().height() || 28; } catch (e) { /* */ }
      const subH = subList.length <= 1 ? 168 : (subList.length === 2 ? 132 : 108);
      let top = H - taH - subH * subList.length;
      const m = {};
      subList.forEach((s) => { m[s.id] = Math.max(0, Math.round(top)) + 2; top += subH; });
      setSubTops(m);
    } catch (e) { /* */ }
  }, [subs]);
  const recomputeSubRef = useRef(() => {});
  recomputeSubRef.current = recomputeSubTops;
  useEffect(() => { recomputeSubTops(); }, [recomputeSubTops, overlays, subs, chartType, tf, symbol]);
  useEffect(() => {
    const el = mainRef.current; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => recomputeSubRef.current());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // #3 کنترل‌های Legend
  const toggleIndVisible = (it) => updInd(it.scope, it.id, { visible: it.visible === false });
  const duplicateInd = (it) => { const arr = it.scope === 'main' ? overlays : subs; const src = arr.find((x) => x.id === it.id); if (!src) return; const copy = { ...src, id: uid(), inputs: { ...src.inputs } }; if (it.scope === 'main') setOverlays((o) => [...o, copy]); else setSubs((s) => [...s, copy]); };
  // بردنِ پنلِ اندیکاتورِ زیرین به بالا/پایین (سبکِ Move pane up/downِ TV). ترتیبِ آرایهٔ subs = ترتیبِ پنل‌ها (pane=idx+1)، پس فقط جابه‌جاییِ همسایه.
  // dir=-1 بالا (نزدیک‌تر به پنلِ قیمت)، dir=+1 پایین. فقط برای اندیکاتورهای پنلِ زیرین (scope==='sub').
  const moveIndPane = (it, dir) => { if (it.scope !== 'sub') return; setSubs((prev) => { const i = prev.findIndex((s) => s.id === it.id); if (i < 0) return prev; const j = i + dir; if (j < 0 || j >= prev.length) return prev; const arr = [...prev]; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; }); };
  const indHasHelp = (it) => !!getHelp(it.key);

  // ── سطحِ چارت (اختلافِ #۱ با TradingView): دکمه‌های سریعِ SELL/BUY + تغییرِ قیمتِ لجند ──
  // Bid/Ask از فیدِ زنده (poll)؛ اگر بروکر bid/ask ندهد، به قیمتِ زنده (mid) برمی‌گردد.
  const _quote = live[symbol] || {};
  const _bidPx = _quote.bid != null ? _quote.bid : livePrice;
  const _askPx = _quote.ask != null ? _quote.ask : livePrice;
  const _spreadPts = (_bidPx != null && _askPx != null) ? Math.abs(_askPx - _bidPx) * Math.pow(10, priceDigits(symbol)) : null;
  const _csNow = candlesRef.current;
  const _lastCandle = _csNow.length ? _csNow[_csNow.length - 1] : null;
  // بستهٔ کندلِ «قبل» برای «تغییر»ِ close-to-closeِ لجند (عینِ TV): زیرِ کراس‌هیر = کندلِ ماقبلِ کندلِ اشاره‌شده؛
  //   بدونِ کراس‌هیر = کندلِ ماقبلِ آخر (هم‌تایم‌فریم). نبودِ داده ⇒ null (لجند خودش به close−open برمی‌گردد).
  const _legPrevClose = (() => {
    if (legend && legend.time != null) {
      const i = _csNow.findIndex((c) => c.t === legend.time);
      return i > 0 ? _csNow[i - 1].c : null;
    }
    return _csNow.length >= 2 ? _csNow[_csNow.length - 2].c : null;
  })();
  // لجندِ همیشه‌نمای نماد (سبکِ TradingView): وقتی کراس‌هیر فعال نیست، O/H/L/C آخرین کندل با close=قیمتِ زنده نمایش می‌شود.
  // High/Low باید همیشه closeِ نمایشی را دربر بگیرند (کندلِ در حالِ شکل‌گیری): چون _lastCandle یک اسنپ‌شاتِ رندرِ React است و
  // ممکن است از livePriceِ ref-محور عقب بماند، بدونِ clamp گاهی C زیرِ L یا بالای H می‌افتاد (نمایشِ ناممکن). max/min رفعش می‌کند.
  const _legRnd = (x) => (x == null || !Number.isFinite(x) ? x : Number(Number(x).toFixed(priceDigits(symbol))));
  const _legClose = livePrice != null ? livePrice : (_lastCandle ? _lastCandle.c : null);
  const _legendShown = legend || (_lastCandle
    ? { open: _legRnd(_lastCandle.o), high: _legRnd(_legClose != null ? Math.max(_lastCandle.h, _legClose) : _lastCandle.h), low: _legRnd(_legClose != null ? Math.min(_lastCandle.l, _legClose) : _lastCandle.l), close: _legRnd(_legClose) }
    : null);
  // تغییرِ کندلِ جاری (زیرِ کراس‌هیر → همان کندل؛ وگرنه آخرین کندل با قیمتِ زنده) — سبز/قرمز مثلِ TV
  const _barOpen = (legend && legend.open != null) ? legend.open : (_lastCandle ? _lastCandle.o : null);
  const _barClose = legend ? (legend.close != null ? legend.close : legend.value) : (livePrice != null ? livePrice : (_lastCandle ? _lastCandle.c : null));
  // «تغییر» عینِ TradingView = close-to-close (نسبت به بستهٔ کندلِ قبل)؛ نبودِ prevClose ⇒ fallback به open.
  const _chgBase = _legPrevClose != null ? _legPrevClose : _barOpen;
  const _chg = (_chgBase != null && _barClose != null) ? (_barClose - _chgBase) : null;
  const _chgPct = (_chg != null && _chgBase) ? (_chg / _chgBase) * 100 : null;
  const _chgCol = _chg == null ? TH.text : (_chg > 0 ? TH.up : _chg < 0 ? TH.down : TH.text);
  // تغییرِ روزِ قبل (Last day change) — قیمتِ زنده نسبت به بستهٔ سشنِ قبل؛ برای خطِ وضعیت (مثلِ TV).
  const _ldRef = livePrice != null ? livePrice : _barClose;
  const _lastDayChg = (prevDayClose != null && _ldRef != null) ? (_ldRef - prevDayClose) : null;
  const _lastDayPct = (_lastDayChg != null && prevDayClose) ? (_lastDayChg / prevDayClose) * 100 : null;
  // عنوانِ زندهٔ تبِ مرورگر (عینِ TradingView): «▲ قیمت ±درصد  نماد» — بدونِ نامِ سایت.
  //   از _barClose استفاده می‌کند (قیمتِ زنده و اگر نبود بستهٔ آخرین کندل) تا حتی بدونِ فیدِ لایو هم قیمت نشان دهد؛
  //   جهت/درصد از تغییرِ روز (نسبت به بستهٔ روزِ قبل) = جهتِ بازار؛ نبودش ⇒ جهتِ کندلِ جاری.
  useEffect(() => {
    if (_barClose != null && Number.isFinite(_barClose)) {
      const dir = _lastDayChg != null ? (_lastDayChg > 0 ? 'up' : _lastDayChg < 0 ? 'down' : '')
        : (_chg != null ? (_chg > 0 ? 'up' : _chg < 0 ? 'down' : '') : '');
      const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '';
      const pctStr = _lastDayPct != null ? ` ${_lastDayPct >= 0 ? '+' : ''}${_lastDayPct.toFixed(2)}%` : '';
      document.title = `${arrow ? arrow + ' ' : ''}${fmtPrice(symbol, _barClose)}${pctStr}  ${symbol}`;
    } else {
      document.title = symbol;
    }
  }, [symbol, _barClose, _lastDayPct, _lastDayChg, _chg]);
  // دکمه‌های خرید/فروشِ روی چارت — قابلِ خاموش‌کردن از تبِ «معامله»ِ تنظیمات (مثلِ TV: Buy/sell buttons)
  const _showQuickTrade = (chartSettingsOverrides.tradeButtons !== false) && grid <= 1 && !replay.on && (_bidPx != null || livePrice != null); // حینِ بازپخش پنلِ تمرین جایش را می‌گیرد

  return (
    <div ref={rootRef} dir="rtl" className={`flex flex-col h-full overflow-hidden ${txt}`} style={{ background: TH.bg }}>
      {/* پالتِ رنگِ سریعِ همیشه‌حاضر — همهٔ input[type=color]ها (ترسیم/اندیکاتور) با list=bnDrawColors به آن وصل‌اند (سبکِ سواچِ TV). */}
      <datalist id="bnDrawColors">{BN_DRAW_COLORS.map((c) => <option key={c} value={c} />)}</datalist>
      <style>{`.bn-thin-scroll{scrollbar-width:thin}.bn-thin-scroll::-webkit-scrollbar{height:4px;width:4px}.bn-thin-scroll::-webkit-scrollbar-thumb{background:${TH.border};border-radius:4px}.bn-thin-scroll::-webkit-scrollbar-track{background:transparent}`}</style>
      {/* #4 نوارِ بالای فشرده (گوشی + تبلت + لنداسکیپِ کم‌ارتفاع) — تشخیصِ خودکارِ ویوپورت */}
      {compact && (
        <CompactTopBar
          TH={TH} symbol={symbol} livePrice={livePrice} priceDir={priceDir} fmtPrice={fmtPrice} marketOpen={marketOpen}
          tf={TF_LABEL[tf] || tf} chartType={chartType} chartLabel={CHART_TYPES.find((c) => c.id === chartType)?.label}
          SymbolLogo={SymbolLogo}
          onSearch={() => setSymModal(true)} onPickTf={() => setSheet('tf')} onPickType={() => setSheet('type')} onMore={() => setSheet('more')}
        />
      )}
      {/* نوارِ بالا (فقط دسکتاپِ ≥۱۲۸۰px) — در تبلت/گوشی جایش CompactTopBar می‌آید تا wrapِ چندردیفه روی چارت نیفتد */}
      {!compact && (
      <div className="flex items-center gap-1 px-3 py-1.5 min-h-10 border-b flex-wrap relative" style={{ borderColor: TH.border, background: TH.panel }}>
        {/* #7 سویچرِ نماد — مدالِ جستجوی حرفه‌ای را باز می‌کند */}
        <button onClick={() => setSymModal(true)} data-menu className="flex items-center gap-2 h-7 px-2 rounded transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)} title="جستجوی نماد (Ctrl+K یا /)">
          <SymbolLogo symbol={symbol} size={18} />
          <span className="font-semibold text-[13px]" dir="ltr" style={{ color: TH.textStrong }}>{symbol}</span>
          <Search size={14} className="opacity-50" />
        </button>
        {/* دکمهٔ «مقایسه» (سبکِ +ِ TradingView) — نمادِ دوم را به‌صورتِ خطِ overlay اضافه می‌کند */}
        <Tip label="مقایسه/افزودنِ نماد به‌صورتِ خطِ overlay"><button onClick={() => { setSymModalMode('compare'); setSymModal(true); }} title="مقایسهٔ نماد" aria-label="مقایسهٔ نماد" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms]" style={{ background: TH.chipBg, color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Plus size={18} /></button></Tip>
        {marketOpen ? (
          <span className="flex items-center gap-1 text-[11px]" style={{ color: TH.text }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: TH.up }} />
            {/* #44/#67 فلَشِ رنگیِ قیمتِ آخر بر اساسِ جهتِ تیک (سبز بالا / قرمز پایین) — key با هر تیک انیمیشن را دوباره اجرا می‌کند */}
            {livePrice != null
              ? <b key={livePrice} dir="ltr" className={`inline-flex items-center gap-0.5 pc-num-ltr font-semibold px-1 rounded ${priceDir === 'up' ? 'flash-up' : priceDir === 'down' ? 'flash-down' : ''}`} style={{ color: priceDir === 'up' ? (TH.upText || TH.up) : priceDir === 'down' ? (TH.downText || TH.down) : TH.textStrong }}>{priceDir === 'up' ? <TrendingUp size={12} /> : priceDir === 'down' ? <TrendingDown size={12} /> : null}{fmtPrice(symbol, livePrice)}</b>
              : <span style={{ color: TH.up }}>زنده</span>}
          </span>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--pc-text-muted)' }}>● بازار بسته</span>
        )}
        <span className="pc-toolbar-sep shrink-0" />
        {/* اینتروالِ سبکِ TV: منتخب‌های inline + اینتروالِ فعال (اگر منتخب نبود) + dropdownِ کاملِ همه با ستارهٔ منتخب‌سازی */}
        <div data-menu className="flex items-center gap-0.5 relative">
          {(() => { const inline = TFS.filter((t) => tfFavs.includes(t) || t === tf); return inline.map((t) => { const on = tf === t; return (<button key={t} onClick={() => setTf(t)} title={TF_TITLE[t] || t} className="px-2 h-7 rounded text-[12px] font-semibold tabular-nums transition-colors duration-[120ms]" dir="ltr" style={on ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: 'transparent', color: TH.text }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>{TF_LABEL[t] || t}</button>); }); })()}
          <button onClick={() => setTfMenu((v) => !v)} title="همهٔ اینتروال‌ها" className="px-1 h-7 rounded transition-colors duration-[120ms] flex items-center" style={{ color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><ChevronDown size={14} /></button>
          {tfMenu && (
            <div className="absolute z-40 top-8 right-0 border rounded-md w-40 max-h-[70vh] overflow-auto p-1 pc-pop" style={{ background: TH.panel, borderColor: TH.border }}>
              {/* جستجوی اینتروال (سبکِ سرچ‌باکسِ بالای منوی تایم‌فریمِ TV) — تیکِرِ کوتاه یا برچسبِ فارسی را فیلتر می‌کند. */}
              <div className="px-1 pb-1">
                <input value={tfSearch} onChange={(e) => setTfSearch(e.target.value)} autoFocus placeholder="جستجو یا بازهٔ سفارشی (7m، 2w)…" dir="rtl"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return; e.preventDefault();
                    const q = tfSearch.trim(); if (!q) return;
                    // ۱) اگر اینتروالِ استانداردی با کوئری می‌خوانَد → همان را انتخاب کن (اولین تطابق).
                    const ALL = ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'M45', 'H1', 'H2', 'H3', 'H4', 'D1', 'W1', 'MN', 'MN3'];
                    const ql = q.toLowerCase();
                    const match = ALL.find((t) => `${TF_LABEL[t] || t} ${TF_TITLE[t] || ''} ${t}`.toLowerCase().includes(ql));
                    if (match) { setTf(match); setTfMenu(false); setTfSearch(''); return; }
                    // ۲) وگرنه اگر الگوی بازهٔ سفارشی است (7m/90m/6h/2d) → بساز و انتخاب کن (مثلِ سرچ‌باکسِ TV).
                    const d = deriveCustomTf(q);
                    if (d) { setCustomTfs((l) => l.some((c) => c.id === d.id) ? l : [...l, d]); customDerivedRef.current[d.id] = [d.base, d.factor]; setTf(d.id); setTfMenu(false); setTfSearch(''); }
                  }}
                  className="w-full px-2 h-7 rounded text-[12px] outline-none" style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }} />
              </div>
              {/* گروه‌بندیِ سبکِ TV: دقیقه‌ای / ساعتی / روزانه / هفتگی / ماهانه (بخش‌های مجزا مثلِ MINUTES/HOURS/DAYS/WEEKS/MONTHSِ TV) */}
              {[['دقیقه‌ای', ['M1', 'M2', 'M3', 'M5', 'M10', 'M15', 'M30', 'M45']], ['ساعتی', ['H1', 'H2', 'H3', 'H4']], ['روزانه', ['D1']], ['هفتگی', ['W1']], ['ماهانه', ['MN', 'MN3']]]
                .map(([gLabel, gTfs]) => [gLabel, gTfs.filter((t) => { const q = tfSearch.trim().toLowerCase(); if (!q) return true; return `${TF_LABEL[t] || t} ${TF_TITLE[t] || ''} ${t}`.toLowerCase().includes(q); })])
                .filter(([, gTfs]) => gTfs.length > 0)
                .map(([gLabel, gTfs]) => (
                <div key={gLabel}>
                  <div className="px-2 pt-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider select-none" style={{ color: TH.text, opacity: 0.45 }}>{gLabel}</div>
                  {gTfs.map((t) => { const on = tf === t; const fav = tfFavs.includes(t); return (
                    <div key={t} className="group flex items-center justify-between w-full px-2 h-7 text-[12px] rounded" style={on ? { color: 'var(--pc-accent)', background: 'var(--pc-accent-tint)' } : { color: TH.textStrong }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                      <button onClick={() => { setTf(t); setTfMenu(false); }} className="flex-1 text-right tabular-nums" dir="ltr">{TF_LABEL[t] || t} <span className="text-[10px] opacity-50">{TF_TITLE[t]}</span></button>
                      {/* ستارهٔ منتخب: منتخب‌ها همیشه پیدا (پُر)، غیرِمنتخب فقط روی hoverِ ردیف — مثلِ TV و یک‌دست با دیالوگِ اندیکاتور (دکلوتر). */}
                      <button onClick={() => toggleTfFav(t)} title={fav ? 'حذف از منتخب' : 'افزودن به منتخب'} className={fav ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms]'}><Star size={13} style={fav ? { fill: TH.accent, color: TH.accent } : { color: TH.text, opacity: 0.55 }} /></button>
                    </div>); })}
                </div>
              ))}
              {/* بازه‌های سفارشی (Add custom intervalِ TV) */}
              {customTfs.length > 0 && (
                <div>
                  <div className="px-2 pt-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider select-none" style={{ color: TH.text, opacity: 0.45 }}>سفارشی</div>
                  {customTfs.map((c) => { const on = tf === c.id; return (
                    <div key={c.id} className="flex items-center justify-between w-full px-2 h-7 text-[12px] rounded" style={on ? { color: 'var(--pc-accent)', background: 'var(--pc-accent-tint)' } : { color: TH.textStrong }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                      <button onClick={() => { setTf(c.id); setTfMenu(false); }} className="flex-1 text-right tabular-nums" dir="ltr">{c.id}</button>
                      <button onClick={() => removeCustomTf(c.id)} title="حذفِ بازهٔ سفارشی" className="opacity-50 hover:opacity-100" style={{ color: TH.text }}><X size={12} /></button>
                    </div>); })}
                </div>
              )}
              {/* افزودنِ بازهٔ سفارشی: مثلِ «7m»، «90m»، «6h»، «2d» */}
              <div className="border-t mt-1 pt-1.5 px-1" style={{ borderColor: TH.border }}>
                <div className="flex items-center gap-1">
                  <input value={customTfInput} onChange={(e) => setCustomTfInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomTf(); } }} placeholder="بازهٔ سفارشی (7m، 90m، 6h، 2w)" dir="ltr" className="flex-1 min-w-0 px-2 h-7 rounded text-[12px] outline-none" style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }} />
                  <button onClick={addCustomTf} title="افزودن" className="shrink-0 px-2 h-7 rounded text-[12px] flex items-center" style={{ background: TH.accent, color: '#fff' }}><Plus size={13} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div data-menu className="relative">
          <button onClick={() => setCtMenu((v) => !v)} title={`نوعِ چارت: ${(CHART_TYPES.find((c) => c.id === chartType) || {}).label || ''}`} className="flex items-center gap-1 px-2 h-7 rounded text-xs transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>{(() => { const CtI = (CHART_TYPES.find((c) => c.id === chartType) || {}).Icon || CandlestickChart; return <CtI size={18} />; })()}<ChevronDown size={13} /></button>
          {ctMenu && (<div className="absolute z-40 mt-1 border rounded-md w-52 max-h-[70vh] overflow-auto pc-pop" style={{ background: TH.panel, borderColor: TH.border }}><div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-wider select-none flex items-center justify-between" style={{ color: TH.text, opacity: 0.55 }}><span>نوعِ چارت</span><span dir="ltr" className="opacity-70">CHART TYPE</span></div>{CHART_TYPES.map((ct, ci) => { const I = ct.Icon || CandlestickChart; const on = chartType === ct.id; const sep = ci > 0 && CHART_TYPES[ci - 1].grp !== ct.grp; return (<React.Fragment key={ct.id}>{sep && <div className="my-1 border-t" style={{ borderColor: TH.border }} />}<button onClick={() => { setChartType(ct.id); setCtMenu(false); }} className="flex items-center gap-2 w-full text-right px-3 h-7 text-[12px] whitespace-nowrap transition-colors duration-[120ms]" style={on ? { color: 'var(--pc-accent)', background: 'var(--pc-accent-tint)' } : { color: TH.textStrong }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}><I size={16} style={{ color: on ? 'var(--pc-accent)' : TH.text }} /> {ct.label}</button></React.Fragment>); })}</div>)}
        </div>
        {/* تنظیماتِ نوعِ چارتِ غیرِزمانی (آجرِ Renko/بازگشتِ Kagi/جعبهٔ P&F/…) — فقط وقتی نوعِ فعال غیرِزمانی است، مثلِ چرخ‌دندهٔ کنارِ نوعِ چارتِ TV */}
        {CT_CFG[chartType] && (
          <div data-menu className="relative">
            <button onClick={() => setCtCfgOpen((v) => !v)} title={`تنظیماتِ ${(CHART_TYPES.find((c) => c.id === chartType) || {}).label || 'نوعِ چارت'}`} className="flex items-center px-1.5 h-7 rounded text-xs transition-colors duration-[120ms]" style={ctCfgOpen ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!ctCfgOpen) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!ctCfgOpen) e.currentTarget.style.background = TH.chipBg; }}><Settings2 size={18} /></button>
            {ctCfgOpen && (
              <div className="absolute z-40 mt-1 border rounded-md w-56 p-3 pc-pop" dir="rtl" style={{ background: TH.panel, borderColor: TH.border }}>
                <div className="text-[11px] font-semibold mb-2" style={{ color: TH.textStrong }}>تنظیماتِ {(CHART_TYPES.find((c) => c.id === chartType) || {}).label}</div>
                {CT_CFG[chartType].map((f) => (
                  <label key={f.k} className="flex items-center justify-between gap-2 mb-2 text-[12px]" style={{ color: TH.text }}>
                    <span>{f.label}</span>
                    <input type="number" min="0" step="any" inputMode="decimal" dir="ltr" value={ctParams[f.k] ?? ''} placeholder={f.ph}
                      onChange={(e) => setCtParams((p) => ({ ...p, [f.k]: e.target.value }))}
                      className="w-24 px-2 h-7 rounded text-[12px] pc-num-ltr outline-none" style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }} />
                  </label>
                ))}
                <div className="flex items-center justify-between mt-1">
                  <button onClick={() => setCtParams((p) => { const n = { ...p }; CT_CFG[chartType].forEach((f) => delete n[f.k]); return n; })} className="text-[11px] px-2 h-7 rounded" style={{ color: TH.text, background: TH.chipBg }}>بازنشانی</button>
                  <span className="text-[11px] opacity-50">خالی = خودکار (ATR)</span>
                </div>
              </div>
            )}
          </div>
        )}
        <div data-menu className="relative">
          <button onClick={() => setIndDlg(true)} title="اندیکاتورها، سنجه‌ها و استراتژی‌ها" className="flex items-center gap-1 px-2 h-7 rounded text-sm transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Activity size={18} /></button>
          {indMenu && (
            <div className="absolute z-40 mt-1 rounded-md w-56 max-h-80 overflow-auto p-1 pc-pop" style={{ background: TH.panel, border: `1px solid ${TH.border}` }}>
              {indFavs.filter((k) => REGISTRY[k]).length > 0 && (
                <>
                  <div className="px-2 py-1 text-[11px] opacity-50 flex items-center gap-1"><Star size={10} /> منتخب‌ها</div>
                  {indFavs.filter((k) => REGISTRY[k]).map((k) => (
                    <div key={'f' + k} className="flex items-center justify-between w-full px-2 h-7 text-[12px] rounded" style={{ color: TH.textStrong }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                      <button onClick={() => addInd(k)} className="flex-1 text-right">{REGISTRY[k].label}</button>
                      <button onClick={() => toggleIndFav(k)} title="حذف از منتخب"><Star size={13} style={{ fill: TH.accent, color: TH.accent }} /></button>
                    </div>
                  ))}
                  <div className="my-1 border-t" style={{ borderColor: TH.border }} />
                </>
              )}
              {Object.entries(REGISTRY).map(([k, d]) => (
                <div key={k} className="flex items-center justify-between w-full px-2 h-7 text-[12px] rounded" style={{ color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <button onClick={() => addInd(k)} className="flex-1 text-right">{d.label}</button>
                  {getHelp(k) && <HelpDot onClick={() => setHelpId(k)} TH={TH} size={12} />}
                  <button onClick={() => toggleIndFav(k)} title="افزودن/حذف از منتخب" className="mr-1"><Star size={12} style={indFavs.includes(k) ? { fill: TH.accent, color: TH.accent } : { opacity: 0.35 }} /></button>
                </div>
              ))}
              {/* تمپلیتِ اندیکاتورها (ذخیره/اعمالِ ترکیب) */}
              <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              <button onClick={saveIndTpl} className="flex items-center gap-1.5 w-full text-right px-2 h-7 text-[12px]" style={{ color: TH.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Save size={12} /> ذخیرهٔ ترکیبِ فعلی به‌عنوان تمپلیت</button>
              {Object.keys(indTpls).map((name) => (
                <div key={'t' + name} className="flex items-center justify-between w-full px-2 h-7 text-[12px] rounded" style={{ color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <button onClick={() => applyIndTpl(name)} className="flex-1 text-right flex items-center gap-1.5"><FolderOpen size={12} /> {name}</button>
                  <button onClick={() => delIndTpl(name)} title="حذف"><Trash2 size={12} className="opacity-50" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="pc-toolbar-sep shrink-0" />
        <button onClick={openNamaScript} title={bnPrem ? 'نمااسکریپت' : 'ویژهٔ پرمیوم'} className="flex items-center gap-1 px-2 h-7 rounded text-sm transition-colors duration-[120ms]" style={editorOpen ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!editorOpen) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!editorOpen) e.currentTarget.style.background = TH.chipBg; }}><Code2 size={18} />{!bnPrem && <Lock size={9} className="opacity-70 -ml-1" />}</button>
        {/* #6 دکمهٔ «هشدار» مستقلِ تولبار (مثلِ Alertِ TV) — پنلِ آلارم‌ها را باز می‌کند */}
        <button onClick={() => { setRightTab('alerts'); setShowRight(true); }} title="افزودنِ هشدارِ قیمت" className="relative flex items-center gap-1 px-2 h-7 rounded text-sm transition-colors duration-[120ms]" style={(rightTab === 'alerts' && showRight) ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!(rightTab === 'alerts' && showRight)) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!(rightTab === 'alerts' && showRight)) e.currentTarget.style.background = TH.chipBg; }}><Bell size={18} />{savedAlerts.length > 0 && (<span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-[3px] rounded-full text-[10px] font-semibold leading-none flex items-center justify-center pc-num-ltr" style={{ background: TH.down, color: '#fff' }}>{savedAlerts.length > 9 ? '9+' : savedAlerts.length}</span>)}</button>
        <button onClick={() => { if (replay.on) exitReplay(); else if (replayPick) setReplayPick(false); else setReplayPick(true); }} title={replay.on ? 'خروج از بازپخش' : replayPick ? 'لغوِ انتخابِ نقطهٔ شروع' : 'بازپخشِ تاریخی (Replay)'} aria-label="بازپخشِ تاریخی" className="flex items-center gap-1 px-2 h-7 rounded text-sm transition-colors duration-[120ms]" style={(replay.on || replayPick) ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!replay.on && !replayPick) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!replay.on && !replayPick) e.currentTarget.style.background = TH.chipBg; }}><Play size={18} /></button>
        <button onClick={getAiSignal} disabled={aiBusy} className="flex items-center gap-1 px-2 h-7 rounded text-sm disabled:opacity-60 transition-opacity duration-[120ms]" style={{ background: 'rgba(139,92,246,.12)', color: TH.accentAi }} title={`سیگنالِ AI — ستاپِ کاملِ AI در همین نماد/تایم‌فریم${aiQuota ? ` (${aiQuota.remaining}/${aiQuota.limit})` : ''}`}><Sparkles size={18} className={aiBusy ? 'animate-pulse' : ''} /></button>
        <button onClick={() => setPartnersOpen(true)} title="صرافی و بروکرِ پیشنهادی — افتتاحِ حساب (LBank / One Royal)" className="flex items-center gap-1 px-2.5 h-7 rounded text-[12px] font-semibold text-white transition-opacity duration-[120ms] hover:opacity-90" style={{ background: TH.accent }}>صرافی/بروکر</button>
        <span className="pc-toolbar-sep shrink-0" />
        {/* واگرد/ازنو/درختِ آبجکت — از ریلِ چپ به تولبارِ بالا منتقل شد (جای TV، audit #8) */}
        <button onClick={() => { drawRef.current && drawRef.current.undo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canUndo())} title="واگرد (Ctrl+Z)" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms] disabled:opacity-30" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Undo2 size={18} /></button>
        <button onClick={() => { drawRef.current && drawRef.current.redo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canRedo())} title="ازنو (Ctrl+Y)" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms] disabled:opacity-30" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Redo2 size={18} /></button>
        <button onClick={() => { setShowTree((v) => !v); treeRefresh(); }} title="درختِ آبجکت‌ها (مدیریتِ ترسیم‌ها)" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms]" style={showTree ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!showTree) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!showTree) e.currentTarget.style.background = TH.chipBg; }}><List size={18} /></button>
        <span className="pc-toolbar-sep shrink-0" />
        <div data-menu className="relative">
          <button onClick={() => setGridMenu((v) => !v)} className="flex items-center gap-1 px-2 h-7 rounded text-[12px] transition-colors duration-[120ms]" style={grid > 1 ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (grid === 1) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (grid === 1) e.currentTarget.style.background = TH.chipBg; }} title="چند-چارت — انتخابِ چیدمان"><LayoutGrid size={18} /> {getGridLayout(gridPreset).cells}× <ChevronDown size={13} /></button>
          {gridMenu && (
            <div className="absolute z-40 mt-1 left-0 border rounded-md w-40 p-1 pc-pop" style={{ background: TH.popoverBg, borderColor: TH.border }}>
              <div className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider select-none" style={{ color: TH.text, opacity: 0.55 }}>انتخابِ چیدمان</div>
              {GRID_PRESET_ORDER.map((pid) => { const L = getGridLayout(pid); const active = gridPreset === pid; return (
                <button key={pid} onClick={() => { setGridPreset(pid); setGrid(presetToLegacyGrid(pid)); setGridMenu(false); }} className="flex items-center gap-2 w-full text-right px-2 h-7 text-[12px] rounded transition-colors duration-[120ms]" style={active ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : {}} onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <GridPreview cols={L.cols} rows={L.rows} color={active ? 'var(--pc-accent)' : TH.text} />
                  <span className="flex-1">{L.label}</span>
                  <span className="pc-num-ltr opacity-70" dir="ltr">{L.cells}×</span>
                </button>
              ); })}
              {/* سینکِ نماد بینِ سلول‌ها — لینکِ چند-چارتِ TV: با روشن‌بودن، تغییرِ نمادِ هر سلول همه را همگام می‌کند. */}
              <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              <button onClick={() => setSyncSymbol((v) => !v)} className="flex items-center justify-between gap-2 w-full text-right px-2 h-7 text-[12px] rounded transition-colors duration-[120ms]" onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} title="با روشن‌بودن، تغییرِ نماد در هر سلول همهٔ سلول‌ها را همگام می‌کند">
                <span className="flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 7h8a4 4 0 0 1 0 8h-1" /><path d="M16 17H8a4 4 0 0 1 0-8h1" /></svg> همگام‌سازیِ نماد</span>
                <span className="w-8 h-4 rounded-full relative transition-colors duration-[120ms]" style={{ background: syncSymbol ? TH.accent : TH.border }}><span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-colors duration-[120ms]" style={{ [syncSymbol ? 'right' : 'left']: 2 }} /></span>
              </button>
              {/* سینکِ کراس‌هیر و زمان بینِ سلول‌ها — پیش‌فرض روشن (مثلِ TV)؛ قابلِ خاموش‌کردن مثلِ گزینه‌های Sync در چند-چارتِ TV. */}
              <button onClick={() => setSyncCrosshair((v) => !v)} className="flex items-center justify-between gap-2 w-full text-right px-2 h-7 text-[12px] rounded transition-colors duration-[120ms]" onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} title="با روشن‌بودن، کراس‌هیرِ همهٔ سلول‌ها هم‌زمان حرکت می‌کند">
                <span className="flex items-center gap-1.5"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3v18M3 12h18" /></svg> همگام‌سازیِ کراس‌هیر</span>
                <span className="w-8 h-4 rounded-full relative transition-colors duration-[120ms]" style={{ background: syncCrosshair ? TH.accent : TH.border }}><span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-colors duration-[120ms]" style={{ [syncCrosshair ? 'right' : 'left']: 2 }} /></span>
              </button>
              <button onClick={() => setSyncTime((v) => !v)} className="flex items-center justify-between gap-2 w-full text-right px-2 h-7 text-[12px] rounded transition-colors duration-[120ms]" onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')} title="با روشن‌بودن، اسکرول/زومِ زمانی همهٔ سلول‌ها هم‌گام می‌شود">
                <span className="flex items-center gap-1.5"><Clock size={13} /> همگام‌سازیِ زمان</span>
                <span className="w-8 h-4 rounded-full relative transition-colors duration-[120ms]" style={{ background: syncTime ? TH.accent : TH.border }}><span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-colors duration-[120ms]" style={{ [syncTime ? 'right' : 'left']: 2 }} /></span>
              </button>
            </div>
          )}
        </div>
        <div data-menu className="relative">
          <button onClick={() => setScaleMenu((v) => !v)} title="حالتِ مقیاسِ قیمت" className="flex items-center gap-1 px-2 h-7 rounded text-xs font-semibold transition-colors duration-[120ms]" style={{ background: TH.chipBg, color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
            <span className="tabular-nums" dir="ltr">{({ 0: 'R', 1: 'log', 2: '%', 3: '100' })[scaleMode] || 'R'}</span> <ChevronDown size={13} />
          </button>
          {scaleMenu && (
            <div className="absolute z-40 mt-1 border rounded-md w-36 p-1 pc-pop" style={{ background: TH.popoverBg, borderColor: TH.border }}>
              {PRICE_SCALE_MODES.map((m, i) => { const on = scaleMode === m.value; return (
                <button key={m.value} onClick={() => { setScaleMode(m.value); setScaleMenu(false); }} className="flex items-center gap-2 w-full text-right px-2 h-7 text-[12px] rounded transition-colors duration-[120ms]" style={on ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { color: TH.textStrong }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                  <span className="w-8 text-[11px] font-semibold tabular-nums" dir="ltr" style={{ color: on ? 'var(--pc-accent)' : TH.text }}>{['R', 'log', '%', '100'][i]}</span> <span>{m.label}</span>
                </button>
              ); })}
            </div>
          )}
        </div>
        <button onClick={() => setScaleLocked((v) => !v)} title="قفلِ مقیاس (خاموش‌کردنِ خودکار)" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms]" style={scaleLocked ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!scaleLocked) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!scaleLocked) e.currentTarget.style.background = TH.chipBg; }}>{scaleLocked ? <Lock size={18} /> : <Unlock size={18} />}</button>
        <Tip label="وارونه‌کردنِ محورِ قیمت — بالا و پایینِ نمودار جابه‌جا می‌شود (مناسبِ تحلیلِ معکوس)"><button onClick={() => setScaleInvert((v) => !v)} title="وارونه‌کردنِ محورِ قیمت (بالا↔پایین)" aria-label="وارونه‌کردنِ محورِ قیمت" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms]" style={scaleInvert ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!scaleInvert) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!scaleInvert) e.currentTarget.style.background = TH.chipBg; }}><ArrowUpDown size={18} /></button></Tip>
        <Tip label="بازنشانیِ زوم و مقیاسِ نمودار به حالتِ اولیه (اتوفیت)"><button onClick={() => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); setScaleLocked(false); setScaleInvert(false); } catch (e) {} }} title="بازنشانیِ زوم و مقیاس به حالتِ اولیه" aria-label="بازنشانیِ مقیاس" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Scaling size={18} /></button></Tip>
        <div data-menu className="relative">
          <button onClick={() => setCrossMenu((v) => !v)} title="حالتِ کراس‌هیر" className="flex items-center gap-1 px-2 h-7 rounded text-sm transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
            <CrossModeIcon id={crosshairId} size={18} /> <ChevronDown size={13} />
          </button>
          {crossMenu && (
            <div className="absolute z-40 mt-1 border rounded-md w-36 p-1 pc-pop" style={{ background: TH.popoverBg, borderColor: TH.border }}>
              {/* سرتیترِ منو (هم‌ترازِ منوی «Cursors»ِ TV) */}
              <div className="px-2 pt-0.5 pb-1 text-[11px] font-semibold uppercase tracking-wider select-none" style={{ color: TH.text, opacity: 0.45 }}>کراس‌هیر</div>
              {CROSSHAIR_MODES.filter((m) => m.id !== 'eraser').map((m) => { const on = crosshairId === m.id; return (
                <button key={m.id} onClick={() => { setCrosshairId(m.id); setCrossMenu(false); }} className="flex items-center gap-2 w-full text-right px-2 h-7 text-[12px] rounded transition-colors duration-[120ms]" style={on ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { color: TH.textStrong }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                  <CrossModeIcon id={m.id} size={16} /> <span>{m.label}</span>
                </button>
              ); })}
              {/* جداکنندهٔ ابزار: «پاک‌کن» یک ابزار است (کلیک روی ترسیم = حذف)، نه سبکِ کراس‌هیر — مثلِ TV زیرِ خطِ جدا. */}
              {(() => { const er = CROSSHAIR_MODES.find((m) => m.id === 'eraser'); if (!er) return null; const on = crosshairId === 'eraser'; return (<>
                <div className="my-1 border-t" style={{ borderColor: TH.border }} />
                <button onClick={() => { setCrosshairId('eraser'); setCrossMenu(false); }} className="flex items-center gap-2 w-full text-right px-2 h-7 text-[12px] rounded transition-colors duration-[120ms]" style={on ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { color: TH.textStrong }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                  <CrossModeIcon id="eraser" size={16} /> <span>{er.label}</span>
                </button>
              </>); })()}
            </div>
          )}
        </div>
        {/* #1 کنترلِ حرفه‌ایِ «سشن‌ها» — pillِ overflow-hidden جدا از dropdown (وگرنه منو کلیپ می‌شد و باز نمی‌شد) */}
        <div data-menu className="relative">
          <div className="flex items-center h-7 rounded overflow-hidden" style={sessionsOn ? { background: 'var(--pc-accent-tint)' } : { background: TH.chipBg }}>
            <button onClick={() => setSessionsOn((v) => !v)} title="سشن‌ها — نمایش/پنهان‌کردنِ باندهای سشنِ فارکس" className="px-1.5 h-full flex items-center transition-colors duration-[120ms]" style={sessionsOn ? { color: 'var(--pc-accent)' } : { color: TH.text }}><Clock size={18} /></button>
            <button onClick={() => setSessMenu((v) => !v)} title="انتخابِ سشن‌ها و منطقهٔ زمانی" className="px-1 h-full flex items-center" style={sessionsOn ? { color: 'var(--pc-accent)' } : { color: TH.text }}><ChevronDown size={12} style={{ transform: sessMenu ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} /></button>
          </div>
          {sessMenu && (
            <div className="absolute z-[60] top-full mt-1 right-0 rounded-md w-56 p-1.5 pc-pop" dir="rtl" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
              <div className="flex items-center justify-between px-2 pt-0.5 pb-1.5">
                <span className="text-[11px] font-semibold" style={{ color: TH.textStrong }}>سشن‌های معاملاتی</span>
                <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: TH.text }} onClick={() => setSessionsOn((v) => !v)}>
                  <span>نمایش</span>
                  <span className="relative inline-block w-7 h-4 rounded-full transition-colors" style={{ background: sessionsOn ? TH.accent : TH.border }}>
                    <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform" style={{ [sessionsOn ? 'left' : 'right']: '2px' }} />
                  </span>
                </label>
              </div>
              {SESSIONS.map((s) => { const on = sessionSel.includes(s.id); return (
                <button key={s.id} onClick={() => { setSessionSel((sel) => sel.includes(s.id) ? sel.filter((x) => x !== s.id) : [...sel, s.id]); if (!sessionsOn) setSessionsOn(true); }} className="flex items-center gap-2.5 w-full text-right px-2 h-7 text-[12px] rounded" style={{ color: TH.textStrong, background: on ? 'var(--pc-accent-tint)' : 'transparent' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = on ? 'var(--pc-accent-tint)' : 'transparent')}>
                  <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{ background: on ? s.edge : 'transparent', border: `1.5px solid ${on ? s.edge : TH.border}` }}>{on && <span className="text-[10px] text-white leading-none">✓</span>}</span>
                  <span className="w-3 h-3 rounded shrink-0" style={{ background: s.color, border: `1px solid ${s.edge}` }} />
                  <span className="flex-1 font-medium">{s.label}</span>
                </button>
              ); })}
              <div className="flex gap-1 px-1 mt-1">
                <button onClick={() => { setSessionSel(SESSIONS.map((s) => s.id)); if (!sessionsOn) setSessionsOn(true); }} className="flex-1 text-[11px] h-7 rounded font-semibold" style={{ background: TH.chipBg, color: TH.text }}>همه</button>
                <button onClick={() => setSessionSel([])} className="flex-1 text-[11px] h-7 rounded font-semibold" style={{ background: TH.chipBg, color: TH.text }}>هیچ</button>
              </div>
              <div className="my-1.5 border-t" style={{ borderColor: TH.border }} />
              <div className="px-2 pb-1 text-[11px] font-semibold" style={{ color: TH.textStrong }}>منطقهٔ زمانی (نمایشِ ساعت)</div>
              <div className="max-h-40 overflow-y-auto bn-thin-scroll">
                {TIMEZONES.map((z) => { const on = tz === z.id; return (
                  <button key={z.id} onClick={() => setTz(z.id)} className="flex items-center gap-2.5 w-full text-right px-2 h-7 text-[12px] rounded" style={{ color: TH.textStrong, background: on ? 'var(--pc-accent-tint)' : 'transparent' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = on ? 'var(--pc-accent-tint)' : 'transparent')}>
                    <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ border: `1.5px solid ${on ? TH.accent : TH.border}` }}>{on && <span className="w-2 h-2 rounded-full" style={{ background: TH.accent }} />}</span>
                    <span className="flex-1">{z.label}</span>
                  </button>
                ); })}
              </div>
            </div>
          )}
        </div>
        <button onClick={() => { try { if (document.fullscreenElement) document.exitFullscreen(); else rootRef.current && rootRef.current.requestFullscreen(); } catch (e) {} }} title="تمام‌صفحه" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><Maximize2 size={18} /></button>
        <ScreenshotMenu TH={TH} getCapture={getCapture} uploadSnapshot={uploadSnapshot} iconSize={18} coarse={bp.coarse} />
        <button onClick={() => setShowShortcuts(true)} title="راهنمای میان‌بُرهای صفحه‌کلید (؟)" aria-label="راهنمای میان‌بُرهای صفحه‌کلید" className="w-7 h-7 flex items-center justify-center rounded text-[13px] leading-none transition-colors duration-[120ms]" style={{ background: TH.chipBg }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>⌨</button>
        {getHelp(tool) && tool !== 'cursor' && (
          <button onClick={() => setHelpId(tool)} title="راهنمای ابزارِ فعال" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms]" style={{ background: TH.chipBg, color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}><HelpCircle size={18} /></button>
        )}
        <div className="flex-1" />
        {/* چرخ‌دندهٔ «تنظیماتِ چارت» — ظاهر/مقیاس/کراس‌هیر و توگل‌ها یک‌جا (فقط UI؛ وصل به stateهای موجود) */}
        <div data-menu className="relative">
          <button onClick={() => setCfgMenu((v) => !v)} title="تنظیماتِ چارت (ظاهر، مقیاس، کراس‌هیر)" aria-label="تنظیماتِ چارت" className="w-7 h-7 flex items-center justify-center rounded transition-colors duration-[120ms]" style={cfgMenu ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!cfgMenu) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!cfgMenu) e.currentTarget.style.background = TH.chipBg; }}><Settings2 size={18} /></button>
          {cfgMenu && (
            <div className="absolute z-[60] top-full mt-1 left-0 rounded-md w-60 p-2 pc-pop" dir="rtl" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
              <div className="px-1 pb-1.5 text-[11px] font-semibold" style={{ color: TH.textStrong }}>تنظیماتِ چارت</div>
              <button onClick={() => { setCfgMenu(false); setChartSettingsOpen(true); }} className="flex items-center gap-2 w-full text-right px-1.5 h-7 mb-1 rounded text-[12px] font-semibold" style={{ background: TH.chipBg, color: TH.textStrong }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>
                <Settings2 size={14} style={{ color: TH.accent }} />
                <span className="flex-1">تنظیماتِ کاملِ چارت…</span>
              </button>
              <div className="flex items-center justify-between px-1 py-1">
                <span className="text-[12px]" style={{ color: TH.text }}>تمِ نمایش</span>
                <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} className="flex items-center gap-1.5 rounded px-2 h-7 text-[12px]" style={{ background: TH.chipBg, color: TH.textStrong }}>{theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />} {theme === 'dark' ? 'تیره' : 'روشن'}</button>
              </div>
              {/* نمایش/پنهانِ نوارِ ابزارِ ترسیمِ چپ — هم‌ترازِ «Drawings panel»ِ منوی TV؛ برای فضای بیشترِ چارت. */}
              <div className="flex items-center justify-between px-1 py-1">
                <span className="text-[12px]" style={{ color: TH.text }}>نوارِ ابزارِ ترسیم</span>
                <button onClick={() => setShowDrawRail((v) => !v)} title="نمایش/پنهانِ نوارِ ابزارِ ترسیمِ چپ" className="flex items-center gap-1.5 rounded px-2 h-7 text-[12px]" style={{ background: showDrawRail ? 'var(--pc-accent-tint)' : TH.chipBg, color: showDrawRail ? 'var(--pc-accent)' : TH.textStrong }}>{showDrawRail ? <Eye size={13} /> : <EyeOff size={13} />} {showDrawRail ? 'نمایان' : 'پنهان'}</button>
              </div>
              <div className="px-1 pt-1.5 pb-0.5 text-[11px] opacity-60" style={{ color: TH.text }}>مقیاسِ قیمت</div>
              <div className="flex flex-wrap gap-1 px-1 pb-1">
                {PRICE_SCALE_MODES.map((m) => { const on = scaleMode === m.value; return (
                  <button key={m.value} onClick={() => setScaleMode(m.value)} className="px-2 h-7 rounded text-[11px] transition-colors duration-[120ms]" style={on ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg, color: TH.text }}>{m.label}</button>
                ); })}
              </div>
              <div className="px-1 pt-1 pb-0.5 text-[11px] opacity-60" style={{ color: TH.text }}>کراس‌هیر</div>
              <div className="flex flex-wrap gap-1 px-1 pb-1">
                {/* فقط سبک‌های کراس‌هیر (صلیبی/نقطه‌ای/پیکانی/بدون) مثلِ منوی Cursorِ TV؛ «پاک‌کن» یک ابزار است و در منوی کراس‌هیرِ تولبار می‌ماند. */}
                {CROSSHAIR_MODES.filter((m) => m.id !== 'eraser').map((m) => { const on = crosshairId === m.id; return (
                  <button key={m.id} onClick={() => setCrosshairId(m.id)} className="px-2 h-7 rounded text-[11px] transition-colors duration-[120ms]" style={on ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg, color: TH.text }}>{m.label}</button>
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
                <button key={i} onClick={row.set} className="flex items-center gap-2 w-full text-right px-1.5 h-7 rounded text-[12px]" style={{ color: TH.textStrong }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <row.Icon size={14} style={{ color: row.on ? TH.accent : TH.text }} />
                  <span className="flex-1">{row.label}</span>
                  <span className="relative inline-block w-7 h-4 rounded-full transition-colors shrink-0" style={{ background: row.on ? TH.accent : TH.border }}>
                    <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform" style={{ [row.on ? 'left' : 'right']: '2px' }} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* منوی «چیدمان/لایوت» — ذخیره + بارگذاریِ چیدمان‌های نام‌دار (ارتقای selectِ قبلی به منوی سبکِ TradingView) */}
        <div data-menu className="relative">
          <button onClick={() => setLayoutMenu((v) => !v)} title="چیدمان‌ها (ذخیره/بارگذاری نماد + تایم‌فریم + اندیکاتورها + ترسیم‌ها)" className="flex items-center gap-1 px-2 h-7 rounded text-xs transition-colors duration-[120ms]" style={layoutMenu ? { background: 'var(--pc-accent-tint)', color: 'var(--pc-accent)' } : { background: TH.chipBg }} onMouseEnter={(e) => { if (!layoutMenu) e.currentTarget.style.background = TH.chipBgHover; }} onMouseLeave={(e) => { if (!layoutMenu) e.currentTarget.style.background = TH.chipBg; }}><FolderOpen size={18} /><ChevronDown size={12} /></button>
          {layoutMenu && (
            <div className="absolute z-[60] top-full mt-1 left-0 rounded-md w-56 p-1 pc-pop" dir="rtl" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
              <button onClick={() => { saveLayout(); setLayoutMenu(false); }} className="flex items-center gap-1.5 w-full text-right px-2 h-7 text-[12px] rounded" style={{ color: TH.accent }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}><Save size={13} /> ذخیرهٔ چیدمانِ فعلی</button>
              <div className="my-1 border-t" style={{ borderColor: TH.border }} />
              {layouts.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] opacity-50" style={{ color: TH.text }}>چیدمانی ذخیره نشده</div>
              ) : layouts.map((l) => (
                <div key={l.id} className="group/lay flex items-center h-7 rounded" onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--pc-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <button onClick={() => { loadLayout(l.id); setLayoutMenu(false); }} className="flex items-center gap-1.5 flex-1 min-w-0 text-right px-2 text-[12px]" style={{ color: l.id === activeLayoutId ? TH.accent : TH.textStrong }}><FolderOpen size={12} className="opacity-60 shrink-0" /> <span className="flex-1 truncate">{l.name}</span>{l.id === activeLayoutId && <Check size={13} className="shrink-0" style={{ color: TH.accent }} />}</button>
                  <button onClick={(e) => { e.stopPropagation(); renameLayout(l.id, l.name); }} title="تغییرِ نام" aria-label="تغییرِ نام" className="opacity-0 group-hover/lay:opacity-100 transition-opacity p-1 rounded shrink-0" style={{ color: TH.text }} onMouseEnter={(e) => { e.currentTarget.style.color = TH.accent; }} onMouseLeave={(e) => { e.currentTarget.style.color = TH.text; }}><Pencil size={12} /></button>
                  <button onClick={(e) => { e.stopPropagation(); duplicateLayout(l.id, l.name); }} title="ساختِ کپی" aria-label="ساختِ کپی" className="opacity-0 group-hover/lay:opacity-100 transition-opacity p-1 rounded shrink-0" style={{ color: TH.text }} onMouseEnter={(e) => { e.currentTarget.style.color = TH.accent; }} onMouseLeave={(e) => { e.currentTarget.style.color = TH.text; }}><Copy size={12} /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteLayout(l.id, l.name); }} title="حذفِ چیدمان" aria-label="حذفِ چیدمان" className="opacity-0 group-hover/lay:opacity-100 transition-opacity p-1 mr-1 rounded shrink-0" style={{ color: TH.text }} onMouseEnter={(e) => { e.currentTarget.style.color = TH.down; }} onMouseLeave={(e) => { e.currentTarget.style.color = TH.text; }}><Trash2 size={12} /></button>
                </div>
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
        {/* نوارِ ابزارِ ترسیم (سمتِ چپ مثلِ TradingView) — در تبلت/گوشی پنهان (#4)، به Drawing-sheet می‌رود تا روی چارت نیفتد؛ روی دسکتاپ با تاگلِ «Drawings panel» قابلِ پنهان‌کردن */}
        {!compact && showDrawRail && (
        <div className="w-12 border-r flex flex-col items-center py-2 gap-1 shrink-0" style={{ borderColor: TH.border }}>
          <div className="flex-1 min-h-0 w-full">
            <ToolRail tool={tool} setTool={(id) => { if (id === 'eraser') { setTool('select'); setCrosshairId('eraser'); } else { if (crosshairIdRef.current === 'eraser') setCrosshairId('cross'); setTool(id); } }} TH={TH} onHelp={setHelpId}
              magnet={magnet} onToggleMagnet={(v) => setMagnet(v)}
              magnetMode={magnetMode} onSetMagnetMode={(m) => setMagnetMode(m)}
              stayInDrawing={stayDraw} onToggleStayInDrawing={(v) => setStayDraw(v)}
              allLocked={allLocked} onLockAll={(v) => { if (drawRef.current) drawRef.current.lockAll(v); setAllLocked(v); treeRefresh(); }}
              allHidden={allHidden} onHideAll={(v) => { if (drawRef.current) drawRef.current.hideAll(v); setAllHidden(v); treeRefresh(); }}
              onRemoveAll={() => { if (drawRef.current) drawRef.current.clearAll(); setAllLocked(false); setAllHidden(false); treeRefresh(); }}
              onRemoveIndicators={() => { setOverlays([]); setSubs([]); }} />
          </div>
          {/* تمیزسازیِ ریلِ چپ سبکِ TV: فقط ابزارهای ترسیم + خوشهٔ مگنت/قفل/چشم/سطل + رنگِ ترسیم می‌ماند.
              undo/redo/درختِ آبجکت به تولبارِ بالا رفتند (جای TVشان)؛ VP/پنجرهٔ داده در منوی چرخ‌دنده و کلیک‌راست‌اند؛ «پاکِ آخرین» با Undo تکراری بود. */}
          <div className="h-px w-5 my-0.5" style={{ background: TH.border }} />
          <Tip label="رنگِ ترسیم"><input type="color" list="bnDrawColors" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} aria-label="رنگِ ترسیم" className="w-5 h-5 rounded-md cursor-pointer bg-transparent border p-0" style={{ borderColor: TH.border }} /></Tip>
        </div>
        )}

        {/* چارت — دیگر به paddingِ پایین نیازی نیست؛ ناوبریِ اپ در AppShell زیرِ BazaarNama است */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* چیپ‌های «مقایسهٔ نماد» (TV Compare) — نمادِ اُورلی + نقطهٔ رنگ + حذف؛ فقط وقتی مقایسه‌ای فعال است */}
          {compares.length > 0 && (
            <div dir="rtl" className="flex flex-wrap items-center gap-1 mb-1">
              {compares.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 px-1.5 h-[20px] rounded text-[11px] font-semibold tabular-nums" dir="ltr" style={{ background: TH.chipBg, color: TH.textStrong }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color, opacity: cmpHidden[c.id] ? 0.35 : 1 }} />
                  <span className={cmpHidden[c.id] ? 'opacity-40 line-through' : ''}>{c.sym}</span>
                  {cmpVals[c.id] != null && <span className={`shrink-0 ${cmpHidden[c.id] ? 'opacity-30' : 'opacity-70'}`}>{fmtPrice(c.sym, cmpVals[c.id])}</span>}
                  {/* تغییرِ ٪ِ رنگی — مثلِ لجندِ Compareِ TV (سبز مثبت/قرمز منفی). #323 */}
                  {cmpChg[c.id] != null && <span className="shrink-0 tabular-nums" style={{ color: cmpHidden[c.id] ? TH.text : (cmpChg[c.id] >= 0 ? TH.up : TH.down), opacity: cmpHidden[c.id] ? 0.3 : 1 }}>{cmpChg[c.id] >= 0 ? '+' : ''}{cmpChg[c.id].toFixed(2)}%</span>}
                  {/* چشمکِ نمایش/پنهان — هم‌ترازِ آیکونِ visibilityِ لجندِ مقایسهٔ TV (پنهان بدونِ حذف). #269 */}
                  <button onClick={() => toggleCompareVis(c.id)} title={cmpHidden[c.id] ? 'نمایشِ مقایسه' : 'پنهان‌کردنِ مقایسه'} aria-label="نمایش/پنهانِ مقایسه" className="opacity-60 hover:opacity-100 shrink-0" style={{ color: TH.text }}>{cmpHidden[c.id] ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                  <button onClick={() => removeCompare(c.id)} title="حذفِ مقایسه" aria-label="حذفِ مقایسه" className="opacity-60 hover:opacity-100 shrink-0" style={{ color: TH.text }}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
          <div ref={chartAreaRef} className="relative flex-1 min-h-0"
               style={compact ? { touchAction: 'none', overscrollBehavior: 'none' } : undefined}
               onContextMenu={(e) => {
                 e.preventDefault();
                 // مبنای مختصات: رَپرِ چارتِ واقعی — در حالتِ گرید همان مستطیلِ سلولِ ۰ است (تک‌چارت: هم‌ارزِ قبل، inset-0)
                 const rect = (chartWrapRef.current || e.currentTarget).getBoundingClientRect();
                 const yy = e.clientY - rect.top;
                 let price = null; try { price = priceSeriesRef.current && priceSeriesRef.current.coordinateToPrice(yy); } catch (err) {}
                 const onAxis = (rect.right - e.clientX) < 62; // راست‌کلیک روی محورِ قیمت (لبهٔ راست) → منوی مقیاس (سبکِ TV)
                 const onTimeAxis = !onAxis && (rect.bottom - e.clientY) < 30; // راست‌کلیک روی محورِ زمان (لبهٔ پایین) → منوی مقیاسِ زمان
                 // راست‌کلیک روی یک ترسیم → منوی مخصوصِ ترسیم (مثلِ TV) به‌جای منوی عمومیِ چارت.
                 let drawIdx = -1; if (!onAxis && !onTimeAxis) { try { drawIdx = drawRef.current ? drawRef.current._hit(e.clientX - rect.left, yy) : -1; } catch (err) {} }
                 setCtx({ x: e.clientX, y: e.clientY, price, cx: e.clientX - rect.left, axis: onAxis, timeAxis: onTimeAxis, drawIdx });
               }}
               onDoubleClick={(e) => {
                 // دابل‌کلیک روی محورِ قیمت ⇒ اتوفیت؛ روی محورِ زمان ⇒ fitContent — میان‌بُرِ عضله‌ایِ رایجِ TV (علاوه بر دکمهٔ auto و منوی راست‌کلیک).
                 const rect = (chartWrapRef.current || e.currentTarget).getBoundingClientRect();
                 const onAxis = (rect.right - e.clientX) < 62;
                 const onTimeAxis = !onAxis && (rect.bottom - e.clientY) < 30;
                 if (onAxis) { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); setScaleLocked(false); } catch (err) {} }
                 else if (onTimeAxis) { try { chartRef.current.timeScale().fitContent(); } catch (err) {} }
               }}>
            {/* ── P2.1 رَپرِ چارتِ واقعی ──
                cellRect=null ⇒ inset-0 (تک‌چارت، رفتارِ قبلی). در گرید ⇒ inset پیکسلیِ سلولِ ۰ + zIndex بالای
                پس‌زمینهٔ گرید (z-30) تا چارتِ کامل در سوراخِ سلولِ ۰ دیده شود. resize خودکار: RO موجود روی mainRef
                عرض/ارتفاعِ چارت‌لیب و بومِ ترسیم را با اندازهٔ تازهٔ رَپر همگام می‌کند. */}
            <div ref={chartWrapRef} className="absolute"
                 style={cellRect ? { left: cellRect.left, top: cellRect.top, width: cellRect.width, height: cellRect.height, zIndex: 31 } : { inset: 0 }}>
            <div ref={mainRef} className="absolute inset-0" />
            <canvas ref={overlayRef} className="absolute inset-0 z-10" style={{ pointerEvents: 'none' }} />
            {/* #3 Legendِ یکپارچهٔ روی چارت: نماد + اندیکاتورها با کنترل‌های on-hover.
                P2.1: به داخلِ رَپرِ چارتِ واقعی منتقل شد تا در حالتِ گرید همراهِ چارت به سلولِ ۰ برود
                (موقعیتِ بصری در تک‌چارت هم‌ارزِ قبل است: absolute با topِ خودکار در بالای همان ناحیه). */}
            {legendItems.length > 0 ? (
              <div dir="rtl">
                <ChartLegend
                  reserveLeft={(_showQuickTrade && (bp.width || 9999) < 640) ? 68 : 0}
                  items={legendItems} legend={_legendShown} TH={TH} symbol={symbol} tf={TF_LABEL[tf] || tf}
                  chartType={chartType} priceDir={priceDir}
                  volume={(legend && legend.volume != null) ? legend.volume : (_lastCandle ? _lastCandle.v : undefined)}
                  indVals={legendVals} coarse={bp.coarse}
                  collapsed={legCollapsed} onCollapse={setLegCollapsed}
                  viewMode={legView} onToggleViewMode={() => setLegView((v) => (v === 'compact' ? 'normal' : 'compact'))}
                  onToggleVisible={toggleIndVisible}
                  onSettings={(it) => setEditInd({ scope: it.scope, id: it.id })}
                  onRemove={(it) => rmInd(it.scope, it.id)}
                  onAddAlert={(it) => { queueIndicatorAlert(it.id); setRightTab('alerts'); setShowRight(true); }}
                  onDuplicate={duplicateInd}
                  onHelp={(it) => setHelpId(it.key)} hasHelp={indHasHelp}
                  onClearAll={() => { setOverlays([]); setSubs([]); }}
                  onMovePane={moveIndPane}
                  onChartSettings={() => setChartSettingsOpen(true)}
                  sl={chartSettingsOverrides}
                  showVolume={showVolume}
                  lastDayChg={_lastDayChg} lastDayPct={_lastDayPct}
                  prevClose={_legPrevClose}
                  renderScope="main"
                />
              </div>
            ) : (
              <Legend legend={_legendShown} TH={TH} symbol={symbol} tf={TF_LABEL[tf] || tf}
                chartType={chartType} priceDir={priceDir} sl={chartSettingsOverrides} prevClose={_legPrevClose}
                lastDayChg={_lastDayChg} lastDayPct={_lastDayPct}
                onChartSettings={() => setChartSettingsOpen(true)}
                /* روی موبایلِ باریک چیپ‌های SELL/BUY سمتِ چپ فضا می‌گیرند — لجند نباید زیرشان برود */
                reserveLeft={(_showQuickTrade && (bp.width || 9999) < 640) ? 68 : 0}
                volume={(legend && legend.volume != null) ? legend.volume : (_lastCandle ? _lastCandle.v : undefined)} />
            )}
            {/* لجندِ per-paneِ اسیلاتورهای زیرین — بالای پنلِ خودشان مثلِ TradingView */}
            <SubPaneLegends items={subLegendItems} tops={subTops} TH={TH} indVals={legendVals} coarse={bp.coarse}
              onToggleVisible={toggleIndVisible}
              onSettings={(it) => setEditInd({ scope: it.scope, id: it.id })}
              onRemove={(it) => rmInd(it.scope, it.id)}
              onAddAlert={(it) => { queueIndicatorAlert(it.id); setRightTab('alerts'); setShowRight(true); }}
              onDuplicate={duplicateInd}
              onHelp={(it) => setHelpId(it.key)} hasHelp={indHasHelp}
              onMovePane={moveIndPane}
              sl={chartSettingsOverrides} />
            {/* سطحِ چارت: دکمه‌های سریعِ SELL/BUY (Bid/Ask) + تغییرِ قیمت — گوشهٔ بالا-چپ مثلِ TradingView.
                کلیک → همان تیکتِ سفارشِ موجود (startTrade: پنلِ ترید + خطوطِ Entry/SL/TP روی چارت). */}
            {_showQuickTrade && (
              <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start" dir="ltr" style={{ pointerEvents: 'none' }}>
                {/* سبکِ TV: جعبه‌های outline (پس‌زمینهٔ پنل، حاشیه+متنِ رنگی)، قیمت بالا / برچسب پایین، اسپردِ سادهٔ وسط */}
                <div className="flex items-stretch gap-1.5" style={{ pointerEvents: 'auto' }}>
                  <button type="button" onClick={() => startTrade('sell')} title="فروش (Sell) — بازکردنِ تیکتِ سفارش"
                    className="flex flex-col items-center justify-center px-2.5 py-0.5 rounded-md shadow-sm transition-colors duration-[120ms]"
                    style={{ background: TH.panel, border: `1.5px solid ${TH.down}`, color: TH.downText || TH.down, minWidth: 74 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.down + '14')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = TH.panel)}>
                    <span className="text-[13px] font-bold leading-tight tabular-nums">{fmtPriceSep(symbol, _bidPx)}</span>
                    <span className="text-[9px] font-bold leading-none tracking-wide -mt-0.5">SELL</span>
                  </button>
                  <div className="flex flex-col items-center justify-center px-0.5" style={{ color: TH.text }}>
                    <span className="text-[11px] tabular-nums leading-tight font-medium">{_spreadPts != null ? Math.round(_spreadPts) : '—'}</span>
                    <span className="text-[11px] leading-none opacity-55">اسپرد</span>
                  </div>
                  <button type="button" onClick={() => startTrade('buy')} title="خرید (Buy) — بازکردنِ تیکتِ سفارش"
                    className="flex flex-col items-center justify-center px-2.5 py-0.5 rounded-md shadow-sm transition-colors duration-[120ms]"
                    style={{ background: TH.panel, border: `1.5px solid ${TH.accent}`, color: TH.accentText || TH.accent, minWidth: 74 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TH.accent + '14')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = TH.panel)}>
                    <span className="text-[13px] font-bold leading-tight tabular-nums">{fmtPriceSep(symbol, _askPx)}</span>
                    <span className="text-[9px] font-bold leading-none tracking-wide -mt-0.5">BUY</span>
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
                style={{ bottom: 54, background: TH.popoverBg, color: TH.textStrong, border: `1px solid ${TH.border}`, boxShadow: 'var(--pc-shadow-modal)' }}>
                {/* آیکونِ ژستِ لمس/اشاره — SVGِ اختصاصی (به‌جای ایموجیِ 👆 که در فونتِ سایت به‌صورتِ □ رِندر می‌شد) */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                  <path d="M22 14a8 8 0 0 1-8 8" /><path d="M18 11v-1a2 2 0 0 0-4 0" /><path d="M14 10V9a2 2 0 0 0-4 0v1" /><path d="M10 9.5V4a2 2 0 0 0-4 0v10" />
                  <path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </svg>
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
            {selDraw >= 0 && drawList[selDraw] && !(drawList[selDraw].tfVis && drawList[selDraw].tfVis[TF_CLASS(tf)] === false) && (() => {
              const d = drawList[selDraw];
              // آمارِ خطِ روند/پرتو (سبکِ STATSِ TV): Δقیمت · درصد · پیپ — فقط برای ترسیمِ دونقطه‌ای با قیمتِ متفاوت.
              let dStats = null;
              if (d.p0 && d.p1 && d.p0.p != null && d.p1.p != null && d.p0.p !== d.p1.p) {
                const dg = priceDigits(symbol);
                const dp = d.p1.p - d.p0.p;
                const pct = d.p0.p ? (dp / d.p0.p) * 100 : 0;
                let bars = null;
                if (d.p0.t != null && d.p1.t != null) {
                  const cs = candlesRef.current || [];
                  const lo = Math.min(d.p0.t, d.p1.t), hi = Math.max(d.p0.t, d.p1.t);
                  const n = cs.filter((c) => c && c.t >= lo && c.t <= hi).length;
                  if (n > 1) bars = n - 1;
                }
                // Δزمان (مدتِ خط) — هم‌ترازِ «time» در آمارِ خطِ روندِ TV؛ از timestampها (پایدار، مستقل از زوم). روز/ساعت/دقیقه.
                let durLabel = null;
                if (d.p0.t != null && d.p1.t != null) {
                  const durSec = Math.abs(d.p1.t - d.p0.t);
                  if (durSec > 0) {
                    const dd = Math.floor(durSec / 86400), hh = Math.floor((durSec % 86400) / 3600), mm = Math.floor((durSec % 3600) / 60);
                    if (dd >= 1) durLabel = (hh >= 1 && dd < 7) ? `${dd}d ${hh}h` : `${dd}d`;
                    else if (hh >= 1) durLabel = (mm >= 1 && hh < 6) ? `${hh}h ${mm}m` : `${hh}h`;
                    else if (mm >= 1) durLabel = `${mm}m`;
                  }
                }
                dStats = { dp, pct, pips: dp * Math.pow(10, dg - 1), dg, up: dp >= 0, fx: /^[A-Z]{6}$/.test(symbol || ''), bars, dur: durLabel };
              }
              return (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-lg border shadow-xl px-2 py-1.5 text-xs" style={{ borderColor: TH.border, background: TH.popoverBg }} dir="rtl">
                  <span className="font-bold opacity-70">{DrawingLayer.label(d.type)}</span>
                  {dStats && (
                    <span className="flex items-center gap-1.5 tabular-nums text-[10.5px] px-1.5 py-0.5 rounded shrink-0" dir="ltr"
                      style={{ background: TH.chipBg, color: dStats.up ? TH.up : TH.down }}
                      title="آمارِ خط: تغییرِ قیمت · درصد · پیپ (مثلِ STATSِ TradingView)">
                      <span>{dStats.up ? '▲' : '▼'}{Math.abs(dStats.dp).toFixed(dStats.dg)}</span>
                      <span>{dStats.pct >= 0 ? '+' : ''}{dStats.pct.toFixed(2)}%</span>
                      {dStats.fx && <span>{Math.abs(dStats.pips).toFixed(1)} pip</span>}
                      {dStats.bars != null && <span className="opacity-80">{dStats.bars} bar</span>}
                      {dStats.dur && <span className="opacity-80" title="مدتِ زمانِ خط (Δ time)">{dStats.dur}</span>}
                    </span>
                  )}
                  {/* قیمتِ دقیقِ خطِ افقی (مثلِ تبِ Coordinatesِ TV) — Enter یا خروج ⇒ اعمال؛ uncontrolled با key تا حینِ تایپ خط نپرد. #274 */}
                  {d.type === 'hline' && d.p != null && (
                    <input key={`hlp-${selDraw}`} type="text" inputMode="decimal" defaultValue={String(d.p)}
                      title="قیمتِ خطِ افقی — مقدارِ دقیق (مختصات، مثلِ TV)؛ Enter/خروج ⇒ اعمال"
                      onKeyDown={(e) => { if (e.key === 'Enter') { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { drawRef.current.setStyle(selDraw, { p: v }); treeRefresh(); } e.currentTarget.blur(); } }}
                      onBlur={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) { drawRef.current.setStyle(selDraw, { p: v }); treeRefresh(); } }}
                      className="w-24 rounded px-1.5 py-0.5 text-[11px] outline-none tabular-nums" dir="ltr"
                      style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }} />
                  )}
                  <input type="color" list="bnDrawColors" value={d.color || '#3b82f6'} onChange={(e) => { drawRef.current.setStyle(selDraw, { color: e.target.value }); treeRefresh(); }} title="رنگِ خط" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />
                  {/* رنگِ پُرشدگی — فقط برای اشکالِ پُرشونده (مثلِ TV که رنگِ خط و رنگِ پس‌زمینه جدا دارد) */}
                  {['rect', 'rotrect', 'circle', 'ellipse', 'triangle'].includes(d.type) && (
                    <input type="color" list="bnDrawColors" value={d.fill || d.color || '#3b82f6'} onChange={(e) => { drawRef.current.setStyle(selDraw, { fill: e.target.value }); treeRefresh(); }} title="رنگِ پُرشدگی" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" style={{ filter: 'saturate(0.85)' }} />
                  )}
                  {/* شفافیتِ پُرشدگی (Fill opacity سبکِ TV) — فقط برای اشکالِ پُرشونده؛ پیش‌فرضِ فعلی حفظ می‌شود تا ترسیم‌های موجود بی‌تغییر بمانند. */}
                  {['rect', 'rotrect', 'circle', 'ellipse', 'triangle'].includes(d.type) && (() => { const fo = d.fillOpacity != null ? d.fillOpacity : (d.type === 'rect' ? 0.12 : 0.1); return (
                    <input type="range" min="0" max="1" step="0.05" value={fo} onChange={(e) => { drawRef.current.setStyle(selDraw, { fillOpacity: parseFloat(e.target.value) }); treeRefresh(); }} title={`شفافیتِ پُرشدگی: ${Math.round(fo * 100)}٪`} aria-label="شفافیتِ پُرشدگی" className="w-12 h-6 cursor-pointer" style={{ accentColor: TH.accent }} />
                  ); })()}
                  {/* کنترل‌های متن (اندازهٔ فونت + پررنگ) — فقط برای درای متن، سبکِ نوارِ استایلِ متنِ TV */}
                  {d.type === 'text' && (
                    <>
                      <div className="flex items-center gap-0.5 tabular-nums" title="اندازهٔ فونت" dir="ltr">{[12, 16, 20, 28].map((fs) => { const on = (d.fontSize || 12) === fs; return (<button key={fs} onClick={() => { drawRef.current.setStyle(selDraw, { fontSize: fs }); treeRefresh(); }} className={`px-1 rounded transition-colors duration-[120ms] ${on ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={on ? { background: TH.accent } : {}}>{fs}</button>); })}</div>
                      <button onClick={() => { drawRef.current.setStyle(selDraw, { bold: !d.bold }); treeRefresh(); }} title="پررنگ" aria-label="پررنگ" className={`w-6 h-6 rounded font-black transition-colors duration-[120ms] ${d.bold ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.bold ? { background: TH.accent } : {}} dir="ltr">B</button>
                      <button onClick={() => { drawRef.current.setStyle(selDraw, { italic: !d.italic }); treeRefresh(); }} title="کج (ایتالیک)" aria-label="ایتالیک" className={`w-6 h-6 rounded italic font-serif transition-colors duration-[120ms] ${d.italic ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.italic ? { background: TH.accent } : {}} dir="ltr">I</button>
                      {/* پس‌زمینهٔ متن (Background fillِ TV) — توگل + رنگ؛ تا متن روی هر جای چارت خوانا بمانَد. #284 */}
                      <button onClick={() => { drawRef.current.setStyle(selDraw, { bg: d.bg ? undefined : (TH.panel || '#1e222d') }); treeRefresh(); }} title={d.bg ? 'حذفِ پس‌زمینه' : 'پس‌زمینه'} aria-label="پس‌زمینهٔ متن" className={`w-6 h-6 rounded transition-colors duration-[120ms] flex items-center justify-center ${d.bg ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.bg ? { background: TH.accent } : {}}><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2" /></svg></button>
                      {d.bg && <input type="color" value={d.bg} onChange={(e) => { drawRef.current.setStyle(selDraw, { bg: e.target.value }); treeRefresh(); }} title="رنگِ پس‌زمینه" aria-label="رنگِ پس‌زمینه" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />}
                      {/* شفافیتِ پس‌زمینهٔ متن (Text background opacity سبکِ TV) — رِندر از قبل bgOpacity را اعمال می‌کند (drawings.js:617)؛ فقط UI اضافه شد. */}
                      {d.bg && (() => { const bo = d.bgOpacity != null ? d.bgOpacity : 0.9; return (
                        <input type="range" min="0" max="1" step="0.05" value={bo} onChange={(e) => { drawRef.current.setStyle(selDraw, { bgOpacity: parseFloat(e.target.value) }); treeRefresh(); }} title={`شفافیتِ پس‌زمینه: ${Math.round(bo * 100)}٪`} aria-label="شفافیتِ پس‌زمینه" className="w-12 h-6 cursor-pointer" style={{ accentColor: TH.accent }} />
                      ); })()}
                      {/* حاشیهٔ متن (Borderِ TV) — توگل + رنگ؛ خطِ دورِ کادرِ متن. #285 */}
                      <button onClick={() => { drawRef.current.setStyle(selDraw, { border: d.border ? undefined : (d.color || '#3b82f6') }); treeRefresh(); }} title={d.border ? 'حذفِ حاشیه' : 'حاشیه'} aria-label="حاشیهٔ متن" className={`w-6 h-6 rounded transition-colors duration-[120ms] flex items-center justify-center ${d.border ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={d.border ? { background: TH.accent } : {}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2" /></svg></button>
                      {d.border && <input type="color" value={d.border} onChange={(e) => { drawRef.current.setStyle(selDraw, { border: e.target.value }); treeRefresh(); }} title="رنگِ حاشیه" aria-label="رنگِ حاشیه" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0" />}
                    </>
                  )}
                  {d.type !== 'text' && (
                    <div className="flex items-center gap-0.5 tabular-nums" title="ضخامت">{[1, 2, 3, 4].map((w) => (<button key={w} onClick={() => { drawRef.current.setStyle(selDraw, { width: w }); treeRefresh(); }} className={`w-5 rounded transition-colors duration-[120ms] ${Math.round(d.width || 2) === w ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={Math.round(d.width || 2) === w ? { background: TH.accent } : {}}>{w}</button>))}</div>
                  )}
                  {/* سبکِ خط: توپر / خط‌چین / نقطه‌ای (سبکِ TV — سه گزینه به‌جای تاگلِ دوحالته) — برای متن معنا ندارد */}
                  {d.type !== 'text' && (
                    <div className="flex items-center gap-0.5" title="سبکِ خط">{(() => { const cur = d.lineStyle || (d.dashed ? 'dashed' : 'solid'); return [{ v: 'solid', dash: '' }, { v: 'dashed', dash: '5 3' }, { v: 'dotted', dash: '1.5 3' }].map((s) => { const on = cur === s.v; return (<button key={s.v} onClick={() => { drawRef.current.setStyle(selDraw, { lineStyle: s.v, dashed: s.v === 'dashed' }); treeRefresh(); }} className={`px-1 py-1 rounded flex items-center transition-colors duration-[120ms] ${on ? 'text-white' : 'opacity-60 hover:opacity-100'}`} style={on ? { background: TH.accent } : {}} title={{ solid: 'توپر', dashed: 'خط‌چین', dotted: 'نقطه‌ای' }[s.v]} aria-label="سبکِ خط"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray={s.dash} aria-hidden="true"><path d="M3 12h18" /></svg></button>); }); })()}</div>
                  )}
                  {/* نمایش/پنهان (سبکِ TV) — به متدِ موجودِ DrawingLayer.toggleVisible وصل است. */}
                  <button onClick={() => { drawRef.current.toggleVisible(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title={d.visible === false ? 'نمایش' : 'پنهان'} aria-label="نمایش/پنهان">{d.visible === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  <button onClick={() => { drawRef.current.toggleLock(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="قفل">{d.locked ? <Lock size={13} /> : <Unlock size={13} />}</button>
                  {/* ترتیبِ لایه (z-order) سبکِ TV — «آوردن به جلو» / «بردن به عقب»؛ به متدهای موجودِ bringToFront/sendToBack وصل است. */}
                  <button onClick={() => { drawRef.current.bringToFront(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="آوردن به جلو" aria-label="آوردن به جلو"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="3" width="14" height="14" rx="2" fill="currentColor" fillOpacity="0.9" stroke="none" /><path d="M3 9v10a2 2 0 0 0 2 2h10" /></svg></button>
                  <button onClick={() => { drawRef.current.sendToBack(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="بردن به عقب" aria-label="بردن به عقب"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="14" height="14" rx="2" fill="currentColor" fillOpacity="0.9" stroke="none" /><path d="M21 15V5a2 2 0 0 0-2-2H9" /></svg></button>
                  {/* کپی/تکثیر (سبکِ TV) — به متدِ موجودِ DrawingLayer.clone وصل است (همان Ctrl+D). */}
                  <button onClick={() => { drawRef.current.clone(selDraw); treeRefresh(); }} className="opacity-60 hover:opacity-100" title="کپی (Ctrl+D)" aria-label="کپی"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg></button>
                  {/* «ذخیره به‌عنوانِ پیش‌فرض» (Save as defaultِ TV): سبکِ این ترسیم را برای نوعش ذخیره می‌کند تا ترسیم‌های بعدیِ همان نوع خودکار همین سبک را بگیرند. */}
                  <button onClick={() => { try { const cur = JSON.parse(localStorage.getItem('bn_draw_defaults') || '{}') || {}; const st = {}; ['color', 'width', 'lineStyle', 'fill', 'fillOpacity', 'fontSize', 'bold', 'italic', 'bg', 'bgOpacity', 'border'].forEach((k) => { if (d[k] !== undefined) st[k] = d[k]; }); cur[d.type] = st; localStorage.setItem('bn_draw_defaults', JSON.stringify(cur)); drawRef.current && drawRef.current.setToolDefaults(cur); } catch (e) { /* noop */ } }} className="opacity-60 hover:opacity-100" title="ذخیره به‌عنوانِ پیش‌فرضِ این ابزار (Save as default)" aria-label="ذخیره پیش‌فرض"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg></button>
                  <button onClick={() => { drawRef.current.removeAt(selDraw); treeRefresh(); }} className="opacity-60 hover:text-red-400" title="حذف"><Trash2 size={13} /></button>
                </div>
              );
            })()}
            {/* راهنمای انتخابِ نقطهٔ شروعِ بازپخش (سبکِ TV: کلیک روی کندلِ شروع) */}
            {replayPick && !replay.on && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-lg text-[12px] font-semibold shadow-lg flex items-center gap-2 pointer-events-none" style={{ background: TH.accent, color: '#fff' }}>
                <Play size={13} />
                <span>روی چارت کلیک کنید تا نقطهٔ شروعِ بازپخش انتخاب شود</span>
                <span className="opacity-70 text-[11px]">Esc = لغو</span>
              </div>
            )}
            {/* درختِ آبجکت‌ها (Object Tree) */}
            {showTree && (
              <div className="absolute top-2 left-2 z-30 w-56 rounded-lg border shadow-xl overflow-hidden" style={{ borderColor: TH.border, background: TH.popoverBg }} dir="rtl">
                <div className="flex items-center justify-between px-2 py-1.5 border-b text-xs font-bold" style={{ borderColor: TH.border }}>
                  <span className="flex items-center gap-1"><List size={13} /> آبجکت‌ها ({legendItems.length + drawList.length})</span>
                  <div className="flex items-center gap-1.5">
                    {/* پنهان/قفلِ همه — دوطرفه (toggle) مثلِ Object Treeِ TV و نوارِ ابزار؛ قبلاً یک‌طرفه (فقط پنهان/قفل) بود. #267 */}
                    <button onClick={() => { const nv = !allHidden; drawRef.current.hideAll(nv); setAllHidden(nv); treeRefresh(); }} title={allHidden ? 'نمایشِ همه' : 'پنهان‌کردنِ همه'} className="opacity-60 hover:opacity-100">{allHidden ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                    <button onClick={() => { const nv = !allLocked; drawRef.current.lockAll(nv); setAllLocked(nv); treeRefresh(); }} title={allLocked ? 'بازکردنِ قفلِ همه' : 'قفلِ همه'} className="opacity-60 hover:opacity-100">{allLocked ? <Unlock size={13} /> : <Lock size={13} />}</button>
                    <button onClick={() => { drawRef.current.clearAll(); treeRefresh(); }} title="حذفِ همه" className="opacity-60 hover:text-red-400"><Trash2 size={13} /></button>
                    <button onClick={() => setShowTree(false)} title="بستن" aria-label="بستنِ درختِ اشیا" className="opacity-60 hover:opacity-100"><X size={13} /></button>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto text-xs">
                  {/* بخشِ اندیکاتورها (هم‌ترازِ Object Treeِ TV که هم اندیکاتور هم ترسیم را فهرست می‌کند) */}
                  {legendItems.length > 0 && (
                    <>
                      <div className="px-2 pt-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider select-none" style={{ color: TH.text, opacity: 0.45 }}>اندیکاتورها</div>
                      {legendItems.map((it) => (
                        <div key={it.id} className="flex items-center gap-1.5 px-2 py-1 border-b transition-colors duration-[120ms] hover:bg-black/5" style={{ borderColor: TH.border }}>
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: it.color }} />
                          {/* کلیک روی نامِ اندیکاتور ⇒ بازکردنِ تنظیماتش (هم‌رفتار با ردیفِ ترسیم که با کلیک انتخاب می‌شود؛ مثلِ Object Treeِ TV) */}
                          <span onClick={() => setEditInd({ scope: it.scope, id: it.id })} title="تنظیماتِ اندیکاتور" className={`flex-1 truncate cursor-pointer ${it.visible === false ? 'opacity-40 line-through' : ''}`}>{it.label}</span>
                          <button onClick={(e) => { e.stopPropagation(); toggleIndVisible(it); }} title="نمایش/پنهان" className="opacity-50 hover:opacity-100">{it.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                          <button onClick={(e) => { e.stopPropagation(); setEditInd({ scope: it.scope, id: it.id }); }} title="تنظیمات" className="opacity-50 hover:opacity-100"><Settings2 size={12} /></button>
                          <button onClick={(e) => { e.stopPropagation(); rmInd(it.scope, it.id); }} title="حذف" className="opacity-50 hover:text-red-400"><X size={12} /></button>
                        </div>
                      ))}
                    </>
                  )}
                  {/* بخشِ ترسیم‌ها */}
                  {drawList.length > 0 && <div className="px-2 pt-1.5 pb-0.5 text-[11px] font-semibold uppercase tracking-wider select-none" style={{ color: TH.text, opacity: 0.45 }}>ترسیم‌ها</div>}
                  {drawList.length === 0 && legendItems.length === 0 && <div className="px-3 py-3 opacity-40 text-center">آبجکتی نیست</div>}
                  {drawList.map((d, i) => (
                    <div key={i} draggable={!d.locked}
                      onDragStart={(e) => { dragDrawRef.current = i; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) {} }}
                      onDragOver={(e) => { if (dragDrawRef.current < 0) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverIdx !== i) setDragOverIdx(i); }}
                      onDragLeave={() => { if (dragOverIdx === i) setDragOverIdx(-1); }}
                      onDrop={(e) => { e.preventDefault(); const from = dragDrawRef.current; if (from >= 0 && from !== i) { try { drawRef.current.move(from, i); } catch (err) {} treeRefresh(); } dragDrawRef.current = -1; setDragOverIdx(-1); }}
                      onDragEnd={() => { dragDrawRef.current = -1; setDragOverIdx(-1); }}
                      className={`flex items-center gap-1.5 px-2 py-1 border-b cursor-pointer transition-colors duration-[120ms] ${selDraw === i ? '' : 'hover:bg-black/5'}`} style={selDraw === i ? { borderColor: TH.border, background: TH.chipBgHover } : { borderColor: dragOverIdx === i ? TH.accent : TH.border, ...(dragOverIdx === i ? { boxShadow: `inset 0 2px 0 -1px ${TH.accent}` } : {}) }} onClick={() => { setTool('select'); drawRef.current.selectAt(i); }}>
                      <span className={`shrink-0 text-[11px] leading-none select-none ${d.locked ? 'opacity-15' : 'opacity-30 hover:opacity-70 cursor-grab active:cursor-grabbing'}`} title={d.locked ? 'برای جابه‌جایی، قفل را باز کنید' : 'برای تغییرِ ترتیب بکشید'} aria-hidden="true">⠿</span>
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                      {/* برچسبِ توصیفی مثلِ Object Treeِ TV: ترسیم‌های قیمت‌محور (خطِ افقی…) قیمتشان را نشان می‌دهند تا چند خط از هم قابلِ‌تفکیک باشند — #293 */}
                      <span className={`flex-1 truncate ${d.visible === false ? 'opacity-40 line-through' : ''}`}>{DrawingLayer.label(d.type)}{d.text ? `: ${d.text}` : (d.p != null && d.t == null && Number.isFinite(d.p) ? ` ${fmtPrice(symbol, d.p)}` : '')}</span>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.toggleVisible(i); treeRefresh(); }} title="نمایش/پنهان" className="opacity-50 hover:opacity-100">{d.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.toggleLock(i); treeRefresh(); }} title="قفل" className="opacity-50 hover:opacity-100">{d.locked ? <Lock size={12} /> : <Unlock size={12} />}</button>
                      <button onClick={(e) => { e.stopPropagation(); drawRef.current.removeAt(i); treeRefresh(); }} title="حذف" className="opacity-50 hover:text-red-400"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* شمارشِ معکوسِ بسته‌شدنِ کندل + وضعیتِ بازار — سبکِ TV: روی محورِ راست، زیرِ قیمتِ آخر.
                نمایش با تاگلِ «شمارشِ معکوسِ بسته‌شدن»ِ تنظیمات کنترل می‌شود (قبلاً مرده بود؛ پیش‌فرض روشن = رفتارِ قبلی). */}
            {chartSettingsOverrides.scaleCountdown !== false && (
              <CountdownChip countdown={countdown} countdownColor={countdownColor} TH={TH} marketOpen={marketOpen}
                showMarketDot={chartSettingsOverrides.slMarketStatus !== false}
                axisY={(() => { try { return (priceSeriesRef.current && livePrice != null) ? priceSeriesRef.current.priceToCoordinate(livePrice) : null; } catch (e) { return null; } })()} />
            )}
            {/* برچسبِ «ارزِ مظنه»ِ محورِ قیمت (Currencyِ TV، توگلِ scaleCurrency که قبلاً مرده بود) — بالای محور، فقط وقتی روشن. #306 */}
            {grid <= 1 && chartSettingsOverrides.scaleCurrency === true && quoteCcyOf(symbol) && (
              <div className="absolute z-20 pointer-events-none rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums" style={{ top: 4, right: 4, background: TH.chipBg, color: TH.text, opacity: 0.85 }} dir="ltr">{quoteCcyOf(symbol)}</div>
            )}
            {/* دکمه‌های ریزِ گوشهٔ پایینِ محورِ قیمت (٪/log/A) — سبکِ TV. توگل: کلیک روی حالتِ فعال ⇒ عادی.
                روی موبایل (compact) پنهان: تارگتِ لمسیِ خیلی ریز + با برچسبِ محورِ زمان تداخل می‌کرد؛ TV موبایل هم این کلاستر را نشان نمی‌دهد (مقیاس از شیتِ «بیشتر» در دسترس است). */}
            {grid <= 1 && !compact && (
              <div className="absolute z-20 flex items-center gap-0.5" style={{ bottom: 3, right: 3 }} dir="ltr">
                {priceScaleCornerButtons({ mode: scaleMode, locked: scaleLocked }).map((btn) => (
                  <button key={btn.id} type="button" title={btn.title} aria-label={btn.title}
                    onClick={() => { const r = applyCornerButton(btn.id, { mode: scaleMode, locked: scaleLocked, invert: scaleInvert }); if (r) { setScaleMode(r.patch.mode); setScaleLocked(r.patch.locked); if (r.fitContent) { try { chartRef.current.priceScale('right').applyOptions({ autoScale: true }); } catch (e) {} } } }}
                    // سبکِ زیرِلبِ TV: غیرفعال = متنِ کم‌رنگِ بی‌پس‌زمینه؛ فعال = اکسنت. هاورِ ظریف با Tailwind
                    // (نه handlerِ imperative که با styleِ declarativeِ حالتِ فعال تداخل می‌کرد و رنگِ اکسنت را می‌پوشاند).
                    className={`px-1 h-6 min-w-6 rounded text-[11px] font-semibold leading-none tabular-nums flex items-center justify-center transition-colors duration-[120ms] ${btn.active ? '' : 'opacity-55 hover:opacity-100 hover:bg-[var(--pc-hover)]'}`}
                    style={btn.active ? { color: 'var(--pc-accent)' } : { color: 'var(--pc-text-muted)' }}>{btn.label}</button>
                ))}
                {/* چرخ‌دندهٔ تنظیماتِ محور در گوشهٔ پایین-راست (هم‌ترازِ TV) — توصیف‌گرِ axisBottomControls که تا کنون وصل نشده بود. افزایشی: دیالوگِ تنظیماتِ چارتِ موجود را باز می‌کند. */}
                {axisBottomControls().map((btn) => (
                  <button key={btn.id} type="button" title={btn.title} aria-label={btn.title}
                    onClick={() => { if (btn.action) setChartSettingsOpen(true); }}
                    className="px-1 h-6 min-w-6 rounded flex items-center justify-center transition-colors duration-[120ms] opacity-55 hover:opacity-100 hover:bg-[var(--pc-hover)]"
                    style={{ color: 'var(--pc-text-muted)' }}><Settings2 size={12} /></button>
                ))}
              </div>
            )}
            {/* دکمهٔ «پرش به جدیدترین کندل» (سبکِ TV) — فقط وقتی از حال دور شده‌ای ظاهر می‌شود. با توگلِ «دکمه‌های ناوبری»ِ تبِ Canvas کنترل می‌شود (navButtons؛ قبلاً وصل نبود = توگلِ مرده). #304 */}
            {grid <= 1 && !atRealtime && chartSettingsOverrides.navButtons !== false && (
              <button type="button" onClick={() => { try { chartRef.current.timeScale().scrollToRealTime(); setAtRealtime(true); } catch (e) {} }}
                title="پرش به جدیدترین کندل" aria-label="پرش به جدیدترین کندل"
                className="absolute z-30 flex items-center justify-center rounded-full border shadow-md transition-transform active:scale-90"
                style={{ bottom: 44, right: 10, width: 30, height: 30, background: TH.popoverBg, borderColor: TH.border, color: TH.text }}
                onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; e.currentTarget.style.color = TH.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = TH.popoverBg; e.currentTarget.style.color = TH.text; }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 6l6 6-6 6" /><path d="M14 6l4 6-4 6" />
                </svg>
              </button>
            )}
            {/* برچسبِ سریِ حجم — لبهٔ بالای باندِ حجم (مثلِ TradingView: «Vol») */}
            {showVolume && (() => {
              // حجم روی پنلِ اصلی است (بالای ۸۲٪). با افزودنِ پنل‌های زیرین، پنلِ اصلی کوتاه‌تر می‌شود و
              // «bottom: 18%»ِ ثابت برچسب را به داخلِ پنلِ زیرین می‌انداخت. ارتفاعِ پنل‌های زیرین (پیکسل، هم‌منطق با خط ۱۱۵۷)
              // را حساب و برچسب را با calc همان‌قدر بالا می‌بریم تا روی باندِ حجم بمانَد.
              const nSub = subs.filter((s) => { const d = REGISTRY[s.key]; return d && d.pane === 'sub' && s.visible !== false; }).length;
              const subPx = nSub === 0 ? 0 : nSub * (nSub <= 1 ? 168 : nSub === 2 ? 132 : 108);
              const volBottom = subPx ? `calc(18% + ${Math.round(0.82 * subPx)}px)` : '18%';
              return (
                <div className="absolute left-2 z-20 pointer-events-none text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
                     style={{ bottom: volBottom, color: TH.text, background: TH.overlayMask, backdropFilter: 'blur(2px)', border: `1px solid ${TH.border}` }} dir="ltr">
                  <BarChart3 size={11} style={{ opacity: 0.7 }} /><span>حجم · Vol</span>
                </div>
              );
            })()}
            {/* واترمارک — نمایش/شفافیت از دیالوگِ تنظیمات (قبلاً مرده). نگاشت طوری که پیش‌فرضِ ۵۰٪ = همان ۰٫۰۷ ظریفِ قبلی (بدونِ رگرسیون). */}
            {chartSettingsOverrides.watermarkShown !== false && (
              <Watermark src={bnLogo} theme={theme} opacity={chartSettingsOverrides.watermarkOpacity != null ? (chartSettingsOverrides.watermarkOpacity / 100) * 0.14 : 0.07} />
            )}
            {/* Data Window — کامپوننتِ ChartOverlays: O/H/L/C + تغییر (مطلق/درصد) + حجم + زمان + اندیکاتورهای زیرِ کراس‌هیر */}
            {showDataWin && (
              <DataWindow
                dataWin={dataWin} TH={TH} symbol={symbol} tf={TF_LABEL[tf] || tf}
                fmt={fmtPrice} fmtTime={winTimeFmt} prevClose={_legPrevClose}
                lastDayChg={_lastDayChg} lastDayPct={_lastDayPct}
                onClose={() => setShowDataWin(false)}
                pos={{ top: 48, left: 12 }}
              />
            )}
            {/* #9 تگِ محورِ قیمت (راست) و زمان (پایین) زیرِ کراس‌هیر — از دادهٔ زندهٔ subscribeCrosshairMove */}
            <CrosshairAxisTag price={crossTag && crossTag.price} time={crossTag && crossTag.time} TH={TH} />
            {/* دکمهٔ «+»ِ محورِ قیمت (سبکِ TV) — روی هاور در سطحِ کراس‌هیر ظاهر می‌شود؛ کلیک ⇒ منوی فشردهٔ افزودنِ سریع در آن قیمت */}
            {axisPlus && axisPlus.y > 14 && chartSettingsOverrides.plusButton !== false && (tool === 'cursor' || tool === 'select') && !plusMenu && (
              <button type="button" title="افزودن در این قیمت (آلارم/خطِ افقی/ترید)"
                onClick={(e) => { e.stopPropagation(); setPlusMenu({ x: e.clientX, y: e.clientY, price: axisPlus.price, cx: axisPlus.x }); }}
                className="absolute z-20 flex items-center justify-center rounded-full shadow-sm transition-colors duration-[120ms]"
                style={{ right: 60, top: axisPlus.y - 11, width: 22, height: 22, background: TH.accent, color: '#fff', pointerEvents: 'auto', opacity: 0.92 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.92')}>
                <Plus size={14} strokeWidth={2.5} />
              </button>
            )}
            {/* منوی فشردهٔ «+» — همان کنش‌های قیمتیِ منوی راست‌کلیک، ولی متمرکز مثلِ TV */}
            <ContextMenu
              open={!!plusMenu} x={plusMenu ? plusMenu.x : 0} y={plusMenu ? plusMenu.y : 0} TH={TH}
              onClose={() => setPlusMenu(null)}
              items={plusMenu ? [
                { header: fmtPriceSep(symbol, plusMenu.price) },
                { separator: true },
                { icon: <Bell size={14} />, label: 'افزودنِ آلارم', onClick: () => { setAlForm((f) => ({ ...f, op: 'above', value: fmtPrice(symbol, plusMenu.price) })); queueSeedAlert({ value: fmtPrice(symbol, plusMenu.price) }); setRightTab('alerts'); setShowRight(true); } },
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 12h18" /></svg>), label: 'خطِ افقی', onClick: () => { try { drawRef.current && drawRef.current.addHLine(plusMenu.price, drawColor); } catch (err) {} treeRefresh(); } },
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z" /><path d="M8 9h8M8 12.5h5" /></svg>), label: 'یادداشتِ متنی', onClick: () => placeTextNote(plusMenu.price, plusMenu.cx) },
                { separator: true },
                { icon: <TrendingUp size={14} />, label: 'لانگ (خرید)', onClick: () => placeLongShort('buy', plusMenu.price, plusMenu.cx) },
                { icon: <TrendingDown size={14} />, label: 'شورت (فروش)', onClick: () => placeLongShort('sell', plusMenu.price, plusMenu.cx) },
                { icon: <Activity size={14} />, label: 'ترید واقعی (پنلِ سفارش)', onClick: () => startTrade('buy', plusMenu.price) },
              ] : []}
            />
            {/* منوی راست‌کلیکِ چارت (ContextMenu — TV-parity) */}
            <ContextMenu
              open={!!ctx} x={ctx ? ctx.x : 0} y={ctx ? ctx.y : 0} TH={TH}
              onClose={() => setCtx(null)}
              items={ctx ? (ctx.drawIdx >= 0 ? [
                // منوی راست‌کلیکِ ترسیم (مثلِ TV) — ویرایش/تکثیر/ترتیبِ لایه/قفل/پنهان/حذف.
                { header: DrawingLayer.label((drawList[ctx.drawIdx] || {}).type) },
                { separator: true },
                { icon: <Settings2 size={14} />, label: 'ویرایشِ سبک', onClick: () => { setTool('select'); try { drawRef.current.selectAt(ctx.drawIdx); } catch (e) {} } },
                // «افزودنِ آلارم روی این خط» — فقط خطِ افقی؛ آلارمِ قیمتِ «تقاطع» روی قیمتِ دقیقِ خط (هم‌ترازِ Add alert on Horizontal Lineِ TV). #277
                ...(((drawList[ctx.drawIdx] || {}).type === 'hline') ? [{ icon: <Bell size={14} />, label: 'افزودنِ آلارم روی این خط', onClick: () => { try { const d = drawList[ctx.drawIdx] || {}; if (d.p != null) { queueSeedAlert({ value: fmtPrice(symbol, d.p), op: 'cross' }); setRightTab('alerts'); setShowRight(true); } } catch (e) { /* noop */ } setCtx(null); } }] : []),
                // «افزودنِ آلارم روی این خط» برای خطِ شیب‌دار (trend/ray/extline) — آستانهٔ متحرک؛ لنگرهای (t,p) به سرور می‌رود که سطح را در هر لحظه با درون‌یابی محاسبه می‌کند (_line_level). گاردِ عددی‌بودنِ t تا دادهٔ خراب ساخته نشود.
                ...((['trend', 'ray', 'extline'].includes((drawList[ctx.drawIdx] || {}).type)) ? [{ icon: <Bell size={14} />, label: 'افزودنِ آلارم روی این خط', onClick: () => { try { const d = drawList[ctx.drawIdx] || {}; if (d.p0 && d.p1 && Number.isFinite(Number(d.p0.t)) && Number.isFinite(Number(d.p1.t))) { const line = { t1: Number(d.p0.t), p1: Number(d.p0.p), t2: Number(d.p1.t), p2: Number(d.p1.p) }; queueSeedAlert({ value: fmtPrice(symbol, d.p1.p), op: 'cross', line }); setRightTab('alerts'); setShowRight(true); } } catch (e) { /* noop */ } setCtx(null); } }] : []),
                // «ویرایشِ متن» فقط برای درای متن — محتوای متن را ویرایش می‌کند (مثلِ دابل‌کلیکِ متنِ TV؛ پرو-چارت با prompt).
                ...(((drawList[ctx.drawIdx] || {}).type === 'text') ? [{ icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7V5h16v2M9 19h6M12 5v14" /></svg>), label: 'ویرایشِ متن', onClick: () => { try { const d = drawList[ctx.drawIdx] || {}; const t = window.prompt('متن (برای خطِ جدید «\\n» بنویسید):', d.text || ''); if (t != null) { drawRef.current.setStyle(ctx.drawIdx, { text: t }); treeRefresh(); } } catch (e) {} } }] : []),
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>), label: 'تکثیر', hotkey: 'Ctrl+D', onClick: () => { try { drawRef.current.clone(ctx.drawIdx); } catch (e) {} treeRefresh(); } },
                // «کپی» (Ctrl+C) — به کلیپ‌بوردِ ترسیم می‌گذارد تا با «چسباندن»ِ منوی چارت (#۳۰۰) جای دیگر پیست شود؛ مثلِ منوی ترسیمِ TV.
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>), label: 'کپی', hotkey: 'Ctrl+C', onClick: () => { try { const cc = drawRef.current.copy(ctx.drawIdx); if (cc) drawClipRef.current = cc; } catch (e) {} } },
                { separator: true },
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="7" y="3" width="14" height="14" rx="2" fill="currentColor" fillOpacity="0.9" stroke="none" /><path d="M3 9v10a2 2 0 0 0 2 2h10" /></svg>), label: 'آوردن به جلو', onClick: () => { try { drawRef.current.bringToFront(ctx.drawIdx); } catch (e) {} treeRefresh(); } },
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="7" width="14" height="14" rx="2" fill="currentColor" fillOpacity="0.9" stroke="none" /><path d="M21 15V5a2 2 0 0 0-2-2H9" /></svg>), label: 'بردن به عقب', onClick: () => { try { drawRef.current.sendToBack(ctx.drawIdx); } catch (e) {} treeRefresh(); } },
                { separator: true },
                { icon: (drawList[ctx.drawIdx] || {}).locked ? <Unlock size={14} /> : <Lock size={14} />, label: (drawList[ctx.drawIdx] || {}).locked ? 'بازکردنِ قفل' : 'قفل', onClick: () => { try { drawRef.current.toggleLock(ctx.drawIdx); } catch (e) {} treeRefresh(); } },
                { icon: (drawList[ctx.drawIdx] || {}).visible === false ? <Eye size={14} /> : <EyeOff size={14} />, label: (drawList[ctx.drawIdx] || {}).visible === false ? 'نمایش' : 'پنهان', onClick: () => { try { drawRef.current.toggleVisible(ctx.drawIdx); } catch (e) {} treeRefresh(); } },
                // «نمایش روی تایم‌فریم‌ها» (Visibility on intervalsِ TV) — ترسیم را فقط در کلاس‌های تایم‌فریمِ منتخب نشان می‌دهد. #271
                { icon: <Clock size={14} />, label: 'نمایش روی تایم‌فریم‌ها', submenu: VIS_CLASSES.map(([cls, lbl]) => { const d0 = drawList[ctx.drawIdx] || {}; const on = !(d0.tfVis && d0.tfVis[cls] === false); return { label: lbl, checked: on, onClick: () => { try { const d = drawList[ctx.drawIdx] || {}; const cur = { ...(d.tfVis || {}) }; cur[cls] = (cur[cls] !== false) ? false : true; drawRef.current.setStyle(ctx.drawIdx, { tfVis: cur }); } catch (e) {} treeRefresh(); } }; }) },
                // «مختصاتِ قیمت» — ویرایشِ دقیقِ قیمتِ دو سرِ ترسیمِ دونقطه‌ای (هم‌ترازِ تبِ Coordinatesِ TV؛ در منو تا نوار شلوغ نشود). زمانِ هر نقطه حفظ می‌شود. #276
                ...(((d0) => (d0.p0 && d0.p1 && d0.p0.p != null && d0.p1.p != null))(drawList[ctx.drawIdx] || {}) ? [
                  { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>), label: 'مختصاتِ قیمت', submenu: [
                    { label: `قیمتِ نقطهٔ ۱: ${fmtPrice(symbol, (drawList[ctx.drawIdx] || {}).p0?.p)}`, onClick: () => { try { const d = drawList[ctx.drawIdx] || {}; const s = window.prompt('قیمتِ نقطهٔ ۱:', String(d.p0.p)); const v = parseFloat(s); if (Number.isFinite(v)) { drawRef.current.setStyle(ctx.drawIdx, { p0: { t: d.p0.t, p: v } }); treeRefresh(); } } catch (e) { /* noop */ } } },
                    { label: `قیمتِ نقطهٔ ۲: ${fmtPrice(symbol, (drawList[ctx.drawIdx] || {}).p1?.p)}`, onClick: () => { try { const d = drawList[ctx.drawIdx] || {}; const s = window.prompt('قیمتِ نقطهٔ ۲:', String(d.p1.p)); const v = parseFloat(s); if (Number.isFinite(v)) { drawRef.current.setStyle(ctx.drawIdx, { p1: { t: d.p1.t, p: v } }); treeRefresh(); } } catch (e) { /* noop */ } } },
                  ] },
                ] : []),
                { separator: true },
                { icon: <Trash2 size={14} />, label: 'حذف', danger: true, hotkey: 'Delete', onClick: () => { try { drawRef.current.removeAt(ctx.drawIdx); } catch (e) {} setSelDraw(-1); treeRefresh(); } },
              ] : ctx.axis ? [
                { header: 'مقیاسِ قیمت' },
                { separator: true },
                { icon: <Scaling size={14} />, label: 'خودکار (اتوفیت)', onClick: () => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); setScaleLocked(false); } catch (err) {} } },
                { separator: true },
                ...PRICE_SCALE_MODES.map((m) => ({ label: m.label, checked: scaleMode === m.value, hotkey: m.label === 'درصدی' ? 'Alt+P' : m.label === 'لگاریتمی' ? 'Alt+L' : undefined, onClick: () => setScaleMode(m.value) })),
                { separator: true },
                { icon: <ArrowUpDown size={14} />, label: 'وارونه‌کردنِ مقیاس', hotkey: 'Alt+I', onClick: () => setScaleInvert((v) => !v) },
                { icon: scaleLocked ? <Lock size={14} /> : <Unlock size={14} />, label: scaleLocked ? 'بازکردنِ قفلِ مقیاس' : 'قفلِ مقیاس', onClick: () => setScaleLocked((v) => !v) },
                { separator: true },
                { header: 'برچسب‌ها' },
                // «برچسبِ آخرین قیمت» — هم‌ترازِ بخشِ Labelsِ منوی محورِ قیمتِ TV؛ خطِ قیمتِ جاری + برچسبِ آخر را روی سریِ فعال روشن/خاموش می‌کند.
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h12l5 4-5 4H3z" /></svg>), label: 'برچسبِ آخرین قیمت', checked: chartSettingsOverrides.priceLineShown !== false, onClick: () => { const on = chartSettingsOverrides.priceLineShown === false; setChartSettingsOverrides((p) => ({ ...p, priceLineShown: on })); try { priceSeriesRef.current && priceSeriesRef.current.applyOptions({ priceLineVisible: on, lastValueVisible: on }); } catch (err) {} } },
                // «شمارشِ معکوسِ بسته‌شدن» — تاگلِ Labelsِ محورِ قیمتِ TV (Countdown to bar close)، وصل به همان flagِ تنظیمات.
                { icon: <Clock size={14} />, label: 'شمارشِ معکوسِ بسته‌شدن', checked: chartSettingsOverrides.scaleCountdown !== false, onClick: () => setChartSettingsOverrides((p) => ({ ...p, scaleCountdown: p.scaleCountdown === false })) },
                // «خط/برچسبِ سقف‑کف» و «میانگینِ بسته» — بخشِ Labelsِ منوی محورِ قیمتِ TV (High & low price lines / Average close)؛ به همان flagهای تنظیمات (#۲۸۱/#۲۸۳) وصل.
                { icon: <ArrowUpDown size={14} />, label: 'خطِ سقف و کف', checked: !!chartSettingsOverrides.scaleHighLow, onClick: () => setChartSettingsOverrides((p) => ({ ...p, scaleHighLow: !p.scaleHighLow })) },
                { icon: <Minus size={14} />, label: 'خطِ میانگینِ بسته', checked: !!chartSettingsOverrides.scaleAvgClose, onClick: () => setChartSettingsOverrides((p) => ({ ...p, scaleAvgClose: !p.scaleAvgClose })) },
                // «خطِ بستهٔ روزِ قبل» — هم‌ترازِ توگلِ «Previous day close»ِ بخشِ Labelsِ منوی محورِ قیمتِ TV؛ به همان flagِ تنظیمات (scalePrevClose، از قبل وصل) گره خورد تا هم منو و هم دیالوگ سه خطِ مقیاس را یک‌دست داشته باشند. #299
                { icon: <Minus size={14} />, label: 'خطِ بستهٔ روزِ قبل', checked: !!chartSettingsOverrides.scalePrevClose, onClick: () => setChartSettingsOverrides((p) => ({ ...p, scalePrevClose: !p.scalePrevClose })) },
                // «دکمهٔ +» — هم‌ترازِ توگلِ «Plus button»ِ منوی محورِ قیمتِ TV؛ دکمهٔ افزودنِ سریعِ روی هاورِ محور (#۴۴۳) را روشن/خاموش می‌کند (پیش‌فرض روشن).
                { icon: <Plus size={14} />, label: 'دکمهٔ +', checked: chartSettingsOverrides.plusButton !== false, onClick: () => setChartSettingsOverrides((p) => ({ ...p, plusButton: p.plusButton === false })) },
                { separator: true },
                { icon: <Settings2 size={14} />, label: 'تنظیماتِ چارت…', onClick: () => setChartSettingsOpen(true) },
              ] : ctx.timeAxis ? [
                { header: 'مقیاسِ زمان' },
                { separator: true },
                // منطقهٔ زمانی به‌عنوانِ نخستین آیتم (پاریتیِ منوی محورِ زمانِ TV که با «Time zone ▸» شروع می‌شود)
                { icon: <Clock size={14} />, label: 'منطقهٔ زمانی', submenu: TIMEZONES.map((z) => ({ label: z.label, checked: tz === z.id, onClick: () => setTz(z.id) })) },
                // «نمایشِ سشن‌ها» — هم‌ترازِ «Session breaks»ِ منوی محورِ زمانِ TV؛ به همان state سشن‌ها (باندهای معاملاتی) وصل است.
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 4v16M16 4v16" /></svg>), label: 'نمایشِ سشن‌ها', checked: sessionsOn, onClick: () => setSessionsOn((v) => !v) },
                { separator: true },
                { icon: <Scaling size={14} />, label: 'بازنشانیِ مقیاسِ زمان', onClick: () => { try { chartRef.current.timeScale().fitContent(); } catch (err) {} } },
                { icon: <Clock size={14} />, label: 'پرش به آخرین کندل', hotkey: 'End', onClick: () => { try { chartRef.current.timeScale().scrollToRealTime(); } catch (err) {} } },
                // «پرش به تاریخ…» — هم‌ترازِ «Go to ▸ date»ِ منوی محورِ زمانِ TV؛ پاپ‌اوورِ موجودِ go-to-date (Alt+G) را باز می‌کند تا این قابلیت آنجا که کاربرِ TV انتظار دارد هم در دسترس باشد. #302
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>), label: 'پرش به تاریخ…', hotkey: 'Alt+G', onClick: () => setGotoOpen(true) },
                { separator: true },
                { icon: <Settings2 size={14} />, label: 'تنظیماتِ چارت…', onClick: () => setChartSettingsOpen(true) },
              ] : [
                { header: symbol },
                { separator: true },
                // «کپیِ قیمت» نخستین آیتم است (پاریتیِ منوی راست‌کلیکِ TV که با Copy price شروع می‌شود)، سپس آلارم.
                ...(ctx.price != null ? [
                  { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></svg>), label: `کپیِ قیمت: ${fmtPriceSep(symbol, ctx.price)}`, onClick: () => { try { navigator.clipboard && navigator.clipboard.writeText(fmtPrice(symbol, ctx.price)); } catch (err) {} } },
                  // «چسباندنِ ترسیم» (Paste) — پاریتیِ آیتمِ دومِ منوی راست‌کلیکِ TV؛ فقط وقتی چیزی در کلیپ‌بوردِ ترسیم هست.
                  ...(drawClipRef.current ? [{ icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>), label: `چسباندنِ ${DrawingLayer.label(drawClipRef.current.type)}`, hotkey: 'Ctrl+V', onClick: () => { try { drawRef.current && drawRef.current.paste(drawClipRef.current); } catch (err) {} treeRefresh(); } }] : []),
                  { icon: <Bell size={14} />, label: `افزودنِ آلارم در ${fmtPriceSep(symbol, ctx.price)}`, hotkey: 'Alt+A', onClick: () => { setAlForm((f) => ({ ...f, op: 'above', value: fmtPrice(symbol, ctx.price) })); queueSeedAlert({ value: fmtPrice(symbol, ctx.price) }); setRightTab('alerts'); setShowRight(true); } },
                  // «افزودنِ یادداشتِ متنی» — هم‌ترازِ «Add text note»ِ منوی راست‌کلیکِ TV (کنارِ آلارم، همان گروه). متن روی نقطهٔ کلیک ثبت می‌شود.
                  { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z" /><path d="M8 9h8M8 12.5h5" /></svg>), label: `افزودنِ یادداشتِ متنی در ${fmtPriceSep(symbol, ctx.price)}`, onClick: () => placeTextNote(ctx.price, ctx.cx) },
                  { separator: true },
                ] : []),
                { icon: <Activity size={14} />, label: 'افزودنِ اندیکاتور', hotkey: '/', onClick: () => setIndDlg(true) },
                ...(ctx.price != null ? [
                  { separator: true },
                  // «افزودنِ خطِ افقی در …» — استیپلِ منوی راست‌کلیکِ TV؛ خطِ افقی دقیقاً روی قیمتِ کلیک‌شده رسم می‌کند.
                  { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 12h18" /></svg>), label: `افزودنِ خطِ افقی در ${fmtPriceSep(symbol, ctx.price)}`, onClick: () => { try { drawRef.current && drawRef.current.addHLine(ctx.price, drawColor); } catch (err) {} treeRefresh(); } },
                  // «افزودنِ خطِ عمودی» — قرینهٔ خطِ افقی (هم‌ترازِ «Add vertical line»ِ منوی راست‌کلیکِ TV)؛ روی زمانِ کندلِ کلیک‌شده.
                  { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 3v18" /></svg>), label: 'افزودنِ خطِ عمودی', onClick: () => placeVLine(ctx.cx) },
                  { icon: <TrendingUp size={14} />, label: 'لانگ (خرید) — رسمِ رو‌به‌جلو', onClick: () => placeLongShort('buy', ctx.price, ctx.cx) },
                  { icon: <TrendingDown size={14} />, label: 'شورت (فروش) — رسمِ رو‌به‌جلو', onClick: () => placeLongShort('sell', ctx.price, ctx.cx) },
                  { icon: <Activity size={14} />, label: 'ترید واقعی (پنلِ سفارش)', onClick: () => startTrade('buy', ctx.price) },
                  { separator: true },
                  // «پنهان‌کردنِ همهٔ ترسیم‌ها» — توگلِ غیرِتخریبیِ TV (Ctrl+Alt+H)، جدا از «پاک‌کردن».
                  { icon: <EyeOff size={14} />, label: allHidden ? 'نمایشِ همهٔ ترسیم‌ها' : 'پنهان‌کردنِ همهٔ ترسیم‌ها', hotkey: 'Ctrl+Alt+H', checked: allHidden, onClick: () => { const on = !allHidden; try { drawRef.current && drawRef.current.hideAll(on); } catch (err) {} setAllHidden(on); treeRefresh(); } },
                  { icon: <Trash2 size={14} />, label: 'پاک‌کردنِ ترسیم‌ها/موقعیت‌ها', danger: true, onClick: () => { try { drawRef.current && drawRef.current.clearAll(); } catch (err) {} setOrder(null); setAllHidden(false); treeRefresh(); } },
                  // «پاک‌کردنِ N اندیکاتور» — هم‌ترازِ «Remove N indicator(s)»ِ منوی راست‌کلیکِ TV؛ فقط وقتی اندیکاتوری روی چارت هست، با شمارِ پویا (مثلِ TV).
                  ...((overlays.length + subs.length) > 0 ? [{ icon: <Activity size={14} />, label: `پاک‌کردنِ ${overlays.length + subs.length} اندیکاتور`, onClick: () => { setOverlays([]); setSubs([]); } }] : []),
                ] : []),
                { separator: true },
                // «تصویرِ فوریِ چارت» — هم‌ترازِ «Take a snapshot»ِ منوی راست‌کلیکِ TV؛ تصویرِ PNGِ چارت را در کلیپ‌بورد کپی می‌کند (یا در صورتِ نبودِ دسترسی دانلود).
                { icon: <Camera size={14} />, label: 'تصویرِ فوریِ چارت (کپی)', hotkey: 'Alt+S', onClick: () => { quickScreenshot(); } },
                { icon: <Table2 size={14} />, label: 'پنجرهٔ داده', onClick: () => setShowDataWin(true) },
                { icon: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></svg>), label: 'دانلودِ دادهٔ چارت (CSV)', onClick: downloadChartData },
                { icon: <List size={14} />, label: 'درختِ آبجکت‌ها', onClick: () => { setShowTree(true); treeRefresh(); } },
                { icon: <Scaling size={14} />, label: 'بازنشانیِ مقیاس', onClick: () => { try { chartRef.current.priceScale('right').applyOptions(resetPriceScaleOptions()); chartRef.current.timeScale().fitContent(); } catch (err) {} } },
                { separator: true },
                { icon: <Settings2 size={14} />, label: 'تنظیماتِ چارت…', onClick: () => setChartSettingsOpen(true) },
                { icon: <Maximize2 size={14} />, label: 'تمام‌صفحه', onClick: () => { try { rootRef.current.requestFullscreen(); } catch (err) {} } },
              ]) : []}
            />
            </div>{/* پایانِ رَپرِ چارتِ واقعی (P2.1) */}
            {grid > 1 && (() => {
              // رِندر از پریستِ کامل (cols/rows/cells) — تا «دوتایی عمودی/سه‌تایی/شش‌تایی/هشت‌تایی» واقعاً همان چیدمان را بدهند (نه فقط 2 افقی یا 4).
              // P2.1: سلولِ ۰ «سوراخِ شفاف» است (divِ خالیِ فقط-اندازه‌گیری) و چارتِ واقعی از پشت روی همان مستطیل می‌نشیند.
              // pointer-events: کانتینر none (تا موسِ سلولِ ۰ به چارتِ واقعی برسد) و هر سلولِ MiniChart خودش auto.
              const L = getGridLayout(gridPreset);
              return (
                <div className="absolute inset-0 z-30 grid gap-1 p-1 pointer-events-none" style={{ background: TH.bg, gridTemplateColumns: L.cols, gridTemplateRows: L.rows }}>
                  {Array.from({ length: L.cells }).map((_, i) => (
                    i === 0
                      ? <div key="cell0" ref={cell0Ref} className="pointer-events-none" aria-hidden="true" />
                      : <div key={i} className="relative min-w-0 min-h-0 pointer-events-auto">
                          <MiniChart symbols={symbols} tf={tf} initial={watch[i] || symbols[i] || symbol} syncBus={syncBusRef.current} syncSymbol={syncSymbol} syncTime={syncTime} syncCrosshair={syncCrosshair} overlays={overlays} />
                        </div>
                  ))}
                </div>
              );
            })()}
            {/* پنلِ حالتِ تمرینِ معامله (مثلِ Bar Replay + paper-tradingِ TradingView) — فقط حینِ بازپخش */}
            {replay.on && (() => {
              const curPx = (() => { try { return (replayRef.current.full || [])[replay.idx] ? (replayRef.current.full || [])[replay.idx].c : null; } catch (e) { return null; } })();
              const pos = practice.pos;
              const raw = (pos && curPx != null) ? (pos.side === 'buy' ? curPx - pos.entry : pos.entry - curPx) : 0;
              const pnlPct = (pos && pos.entry) ? (raw / pos.entry) * 100 : 0;
              const posCol = pnlPct > 0 ? TH.up : pnlPct < 0 ? TH.down : TH.text;
              const totCol = practice.realized > 0 ? TH.up : practice.realized < 0 ? TH.down : TH.text;
              const fmtP = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
              return (
                <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 items-start text-xs" dir="rtl">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg shadow-sm" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
                    <span className="font-bold shrink-0" style={{ color: TH.accent }}>تمرین</span>
                    {!pos ? (
                      <>
                        <button onClick={() => practiceOpen('buy')} disabled={curPx == null} title="خریدِ تمرینی با قیمتِ کندلِ فعلی (Shift+B)" className="px-2 py-0.5 rounded-md text-white font-bold text-[11px] disabled:opacity-40" style={{ background: TH.up }}>خرید</button>
                        <button onClick={() => practiceOpen('sell')} disabled={curPx == null} title="فروشِ تمرینی با قیمتِ کندلِ فعلی (Shift+S)" className="px-2 py-0.5 rounded-md text-white font-bold text-[11px] disabled:opacity-40" style={{ background: TH.down }}>فروش</button>
                      </>
                    ) : (
                      <>
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white shrink-0" style={{ background: pos.side === 'buy' ? TH.up : TH.down }}>{pos.side === 'buy' ? 'لانگ' : 'شورت'}</span>
                        <span className="opacity-70 tabular-nums shrink-0" dir="ltr">@{fmtPrice(symbol, pos.entry)}</span>
                        <span className="font-bold tabular-nums shrink-0" dir="ltr" style={{ color: posCol }}>{fmtP(pnlPct)}</span>
                        {pos.sl != null && <span className="tabular-nums shrink-0 text-[11px]" dir="ltr" title="حدِ ضرر" style={{ color: TH.down }}>SL {fmtPrice(symbol, pos.sl)}</span>}
                        {pos.tp != null && <span className="tabular-nums shrink-0 text-[11px]" dir="ltr" title="حدِ سود" style={{ color: TH.up }}>TP {fmtPrice(symbol, pos.tp)}</span>}
                        <button onClick={practiceReverse} title="وارونه‌کردنِ پوزیشن (بستن + بازکردنِ جهتِ مخالف)" className="px-2 py-0.5 rounded-md text-[11px] shrink-0" style={{ background: TH.chipBg }}>وارونه</button>
                        <button onClick={practiceClose} title="بستنِ دستیِ معاملهٔ تمرینی" className="px-2 py-0.5 rounded-md text-[11px] shrink-0" style={{ background: TH.chipBg }}>بستن</button>
                      </>
                    )}
                  </div>
                  {(practice.trades > 0 || pos) && (
                    <div className="flex items-center gap-2 px-2 py-0.5 rounded-lg text-[10px]" style={{ background: TH.popoverBg, border: `1px solid ${TH.border}` }}>
                      <span className="opacity-60">سود/زیانِ کل:</span>
                      <span className="font-bold tabular-nums" dir="ltr" style={{ color: totCol }}>{fmtP(practice.realized)}</span>
                      {practice.trades > 0 && <><span className="opacity-40">·</span><span className="opacity-70 tabular-nums">{practice.trades} معامله · {Math.round((practice.wins / practice.trades) * 100)}% برد</span></>}
                      {practice.last != null && <><span className="opacity-40">·</span><span className="opacity-60">آخرین</span><span className="font-bold tabular-nums" dir="ltr" style={{ color: practice.last > 0 ? TH.up : practice.last < 0 ? TH.down : TH.text }}>{fmtP(practice.last)}</span></>}
                      {practice.trades > 0 && <button onClick={practiceReset} title="صفرکردنِ آمارِ تمرین" className="opacity-60 hover:opacity-100" style={{ color: TH.text }}>↺</button>}
                    </div>
                  )}
                </div>
              );
            })()}
            <ReplayBar replay={replay} TH={TH} replayStepBack={replayStepBack} replayToggle={replayToggle} replayStep={replayStep} replaySeek={replaySeek} replaySetSpeed={replaySetSpeed} exitReplay={exitReplay}
              intrabarOn={intrabarOn} onToggleIntrabar={() => setIntrabarOn((v) => !v)}
              replayToStart={replayToStart} replayToEnd={replayToEnd} replayJump={replayJump}
              replayDate={(() => { try { const t = (replayRef.current.full || [])[replay.idx]; if (!t) return ''; const d = new Date(t.t * 1000); return d.toLocaleString('fa-IR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } })()} />
          </div>
          {/* ردیفِ «بازهٔ سریع» پایینِ چارت (سطحِ چارت — مثلِ TradingView): رنجِ نمایش را تنظیم می‌کند، جدا از اینترval. */}
          {grid <= 1 && !replay.on && (
            <div className="flex items-center gap-1 px-2 py-1 border-t overflow-x-auto bn-thin-scroll shrink-0" dir="ltr" style={{ borderColor: TH.border, background: TH.bg }}>
              {QUICK_RANGES.map(([lbl, r]) => {
                const active = quickRange === r;
                return (
                  <button key={lbl} type="button" onClick={() => applyQuickRange(r)} title={`بازهٔ نمایش: ${lbl}`}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold pc-num-ltr whitespace-nowrap transition-colors duration-[120ms]"
                    style={active ? { color: 'var(--pc-accent)' } : { color: 'var(--pc-text-muted)' }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--pc-hover)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>{lbl}</button>
                );
              })}
              {/* «پرش به تاریخ» (Go to date سبکِ TV) — بلافاصله بعدِ دکمه‌های بازهٔ سریع */}
              <div data-menu className="relative shrink-0">
                <button type="button" onClick={() => setGotoOpen((v) => !v)} title="پرش به تاریخ"
                  className="p-1 rounded transition-colors duration-[120ms] flex items-center"
                  style={gotoOpen ? { color: 'var(--pc-accent)' } : { color: 'var(--pc-text-muted)' }}
                  onMouseEnter={(e) => { if (!gotoOpen) e.currentTarget.style.background = 'var(--pc-hover)'; }}
                  onMouseLeave={(e) => { if (!gotoOpen) e.currentTarget.style.background = 'transparent'; }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                </button>
                {gotoOpen && (
                  <div className="absolute bottom-8 left-0 z-40 p-2 rounded-md border pc-pop" style={{ background: TH.popoverBg, borderColor: TH.border }}>
                    <div className="text-[11px] mb-1 opacity-60 whitespace-nowrap" style={{ color: TH.text }}>پرش به تاریخ و زمان</div>
                    <input type="datetime-local" autoFocus onChange={(e) => goToDate(e.target.value)}
                      className="text-[12px] rounded px-2 h-7 pc-num-ltr outline-none" dir="ltr"
                      style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}`, colorScheme: theme === 'dark' ? 'dark' : 'light' }} />
                  </div>
                )}
              </div>
              {/* ساعتِ زندهٔ منطقهٔ زمانی — کلیک‌پذیر: منوی منطقهٔ زمانی باز می‌شود (مثلِ نوارِ پایینِ TradingView که کلیکِ ساعت/TZ لیستِ زمان را می‌گشاید).
                  روی موبایل (compact) پنهان: در ویوپورتِ باریک ~۵۹px از لبهٔ راست بیرون می‌زد و لمس‌ناپذیر می‌شد؛ TV موبایل هم ساعتِ TZِ ماندگار روی چارت نشان نمی‌دهد (منطقهٔ زمانی از تنظیمات قابلِ‌تغییر است). */}
              <div data-menu className={`ml-auto relative ${compact ? 'hidden' : ''}`}>
                <button ref={tzBtnRef} onClick={() => { if (!tzBarOpen && tzBtnRef.current) { const r = tzBtnRef.current.getBoundingClientRect(); setTzAnchor({ right: Math.max(6, Math.round(window.innerWidth - r.right)), bottom: Math.round(window.innerHeight - r.top + 4) }); } setTzBarOpen((v) => !v); }} title="تغییرِ منطقهٔ زمانیِ چارت" className="flex items-center gap-1 ps-2 text-[11px] whitespace-nowrap select-none rounded transition-colors" style={{ color: tzBarOpen ? 'var(--pc-accent)' : 'var(--pc-text-muted)' }}>
                  <Clock size={12} style={{ opacity: 0.7 }} />
                  <span className="pc-num-ltr">{tzClock}</span>
                  <span>({(TIMEZONES.find((z) => z.id === tz) || {}).label || tz})</span>
                </button>
                {tzBarOpen && (
                  <div className="fixed z-[80] rounded-md border w-40 p-1 pc-pop" dir="rtl" style={{ background: TH.popoverBg, borderColor: TH.border, right: tzAnchor.right, bottom: tzAnchor.bottom }}>
                    <div className="px-2 pt-0.5 pb-1 text-[11px] font-semibold uppercase tracking-wider select-none" style={{ color: TH.text, opacity: 0.45 }}>منطقهٔ زمانی</div>
                    <div className="max-h-52 overflow-y-auto bn-thin-scroll">
                      {TIMEZONES.map((z) => { const on = tz === z.id; return (
                        <button key={z.id} onClick={() => { setTz(z.id); setTzBarOpen(false); }} className="flex items-center gap-2 w-full text-right px-2 h-7 text-[12px] rounded" style={{ color: TH.textStrong, background: on ? 'var(--pc-accent-tint)' : 'transparent' }} onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--pc-hover)'; }} onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                          <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0" style={{ border: `1.5px solid ${on ? TH.accent : TH.border}` }}>{on && <span className="w-1.5 h-1.5 rounded-full" style={{ background: TH.accent }} />}</span>
                          <span className="flex-1">{z.label}</span>
                        </button>
                      ); })}
                    </div>
                  </div>
                )}
              </div>
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
                  overlays={overlays} subs={subs} techRating={techRating}
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
              overlays={overlays} subs={subs} techRating={techRating}
                />
          )
        )}

        {/* ریلِ عمودیِ آیکونِ سمتِ راست (پنل‌سوییچرِ سبکِ TradingView) — آخرین فرزندِ فلکسِ افقی، چسبیده به لبهٔ راست.
            کلیک روی هر آیکون: تبِ راست را انتخاب و پنل را باز می‌کند. جایگزینِ دستگیرهٔ کشوییِ قدیمی است. */}
        {!compact && (
          <RightIconRail active={showRight ? rightTab : null} onSelect={(k) => { setRightTab(k); setShowRight(true); }} TH={TH} badges={{ alerts: savedAlerts.length }} />
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
            <button onClick={() => setBarMode((v) => !v)} title="حالتِ اجرا: برداری (سریع) یا بار-به-بار (سازگار با Pine)" style={{ background: barMode ? TH.accent : TH.chipBg, color: barMode ? '#fff' : TH.text, border: `1px solid ${TH.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 12 }} dir="rtl">{barMode ? 'بار-به-بار' : 'برداری'}</button>
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
        // نتیجهٔ calc را یک‌بار می‌گیریم تا هم ساختارِ خطوط (رنگِ مجزا) و هم وجودِ «پُرشدگیِ باند» را بشناسیم.
        const rrProbe = (() => {
          try {
            const cs2 = candlesRef.current; if (!cs2 || !cs2.length) return null;
            const cc = { open: cs2.map((x) => x.o), high: cs2.map((x) => x.h), low: cs2.map((x) => x.l), close: cs2.map((x) => x.c), volume: cs2.map((x) => x.v || 0) };
            return def.calc(cc, it.inputs);
          } catch (e) { return null; }
        })();
        const lineDefs = (() => {
          const rr = rrProbe; if (!rr) return null;
          if (rr.lines) return rr.lines.map((ln, i) => ({ color: ln.color, label: `خط ${i + 1}` }));
          if (rr.multi) return [{ color: def.color, label: 'بالا' }, { color: def.color, label: 'میانی' }, { color: def.color, label: 'پایین' }];
          // MACD/PPO: دو خطِ اصلی (MACD + سیگنال) رنگِ مجزا می‌گیرند؛ هیستوگرام دورنگِ خودش را نگه می‌دارد (مثلِ TV) — فقط چشمکِ نمایش/پنهان (index 2 = sph[2] در رِندر).
          if (rr.macd) return [{ color: '#3b82f6', label: 'خطِ MACD' }, { color: '#f59e0b', label: 'سیگنال' }, { label: 'هیستوگرام', hist: true }];
          return null;
        })();
        const multiLine = lineDefs && lineDefs.length > 1;
        const isBandFill = !!(rrProbe && rrProbe.multi); // فقط باندهای r.multi (بولینگر/…) که رندرشان پُرشدگیِ کاربرپسند دارد
        const curFillOp = it.fillOpacity != null ? it.fillOpacity : 0.10;
        const lineColors = it.lineColors || {};
        const plotHidden = it.plotHidden || {}; // نمایش/پنهانِ هر plot (تبِ Style)
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
                <Tab id="visibility">قابلیتِ دید</Tab>
              </div>
              <div className="p-4">
                {indDlgTab === 'inputs' && (
                  inputKeys.length ? inputKeys.map((k) => (
                    <div key={k} className="flex items-center justify-between mb-2.5 text-sm">
                      <label className="opacity-70">{inputLabelFa(k)}</label>
                      {k === 'source' ? (
                        <select value={it.inputs[k] || 'close'} onChange={(e) => upd({ inputs: { source: e.target.value } })} className="w-28 rounded px-2 py-1 outline-none text-right cursor-pointer" dir="ltr" style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }}>
                          {SRC_LABELS.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                        </select>
                      ) : (
                        <input type="number" step="any" value={it.inputs[k]} onChange={(e) => upd({ inputs: { [k]: Number(e.target.value) } })} className="w-24 rounded px-2 py-1 outline-none text-right" dir="ltr" style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }} />
                      )}
                    </div>
                  )) : <div className="text-center text-[12px] opacity-50 py-3">این اندیکاتور ورودیِ قابلِ‌تنظیم ندارد.</div>
                )}
                {indDlgTab === 'style' && (
                  <div className="space-y-3">
                    {multiLine ? (
                      <div className="space-y-1.5">
                        <label className="opacity-70 text-sm">رنگِ خطوط</label>
                        {lineDefs.map((ld, i) => {
                          const hidden = !!plotHidden[i];
                          return (
                          <div key={i} className="flex items-center justify-between text-sm pr-2">
                            <span className={`opacity-60 text-[12px] ${hidden ? 'line-through opacity-40' : ''}`}>{ld.label}</span>
                            <div className="flex items-center gap-1.5">
                              {/* نمایش/پنهانِ این plot — هم‌ترازِ چشمکِ هر خطِ اندیکاتورِ TV */}
                              <button type="button" onClick={() => upd({ plotHidden: { ...plotHidden, [i]: !hidden } })} title={hidden ? 'نمایشِ این خط' : 'پنهان‌کردنِ این خط'} className="opacity-55 hover:opacity-100 p-0.5 rounded" style={{ color: TH.text }}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                              {/* هیستوگرام (مثلِ MACD) رنگِ دورنگِ خودش را دارد ⇒ فقط چشمک، بدونِ color-picker. */}
                              {ld.hist ? <span className="w-10 h-7 flex items-center justify-center text-[9px] opacity-40" dir="ltr">auto</span>
                                : <input type="color" list="bnDrawColors" value={lineColors[i] || ld.color} disabled={hidden} onChange={(e) => upd({ lineColors: { ...lineColors, [i]: e.target.value } })} className="w-10 h-7 rounded cursor-pointer bg-transparent border-0 p-0 disabled:opacity-30" />}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm"><label className="opacity-70">رنگ</label>
                        <input type="color" list="bnDrawColors" value={it.color || def.color} onChange={(e) => upd({ color: e.target.value })} className="w-10 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
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
                    {/* پُرشدگیِ پس‌زمینهٔ باند (رنگ + شفافیت) — فقط باندهای r.multi، هم‌ترازِ ردیفِ «Background»ِ تبِ Styleِ TV */}
                    {isBandFill && (
                      <div className="flex items-center justify-between text-sm gap-2"><label className="opacity-70 shrink-0">پس‌زمینه</label>
                        <input type="color" value={it.fillColor || (it.lineColors && it.lineColors[0]) || def.color} onChange={(e) => upd({ fillColor: e.target.value })} className="w-8 h-7 rounded cursor-pointer bg-transparent border-0 p-0 shrink-0" />
                        <input type="range" min="0" max="0.5" step="0.02" value={curFillOp} onChange={(e) => upd({ fillOpacity: Number(e.target.value) })} className="flex-1 accent-current" style={{ accentColor: TH.accent }} />
                        <span className="tabular-nums text-[11px] w-9 text-left" dir="ltr">{Math.round(curFillOp * 100)}%</span>
                      </div>
                    )}
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
                    {/* دقتِ per-اندیکاتور (Precision) — هم‌ترازِ ردیفِ Precisionِ تبِ Styleِ اندیکاتورِ TV؛ تعدادِ اعشارِ مقدارِ اندیکاتور در لجند. «خودکار» = رفتارِ قبلی. */}
                    <div className="flex items-center justify-between text-sm"><label className="opacity-70">دقت (Precision)</label>
                      <select value={it.precision != null ? String(it.precision) : 'default'}
                        onChange={(e) => upd({ precision: e.target.value === 'default' ? undefined : e.target.value })}
                        className="h-7 rounded px-1.5 text-[12px] cursor-pointer" dir="ltr"
                        style={{ background: TH.chipBg, color: TH.textStrong, border: `1px solid ${TH.border}` }}>
                        <option value="default">خودکار</option>
                        <option value="0">1</option>
                        <option value="1">0.1</option>
                        <option value="2">0.01</option>
                        <option value="3">0.001</option>
                        <option value="4">0.0001</option>
                        <option value="5">0.00001</option>
                        <option value="6">0.000001</option>
                        <option value="7">0.0000001</option>
                        <option value="8">0.00000001</option>
                      </select>
                    </div>
                  </div>
                )}
                {indDlgTab === 'visibility' && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] opacity-60 mb-1">نمایش روی تایم‌فریم‌ها (هم‌ترازِ Visibilityِ TV)</div>
                    {VIS_CLASSES.map(([cls, lbl]) => {
                      const on = !(it.tfVis && it.tfVis[cls] === false);
                      return (
                        <label key={cls} className="flex items-center justify-between text-sm cursor-pointer py-1 px-1 rounded hover:bg-black/5">
                          <span className="opacity-80">{lbl}</span>
                          <input type="checkbox" checked={on} onChange={(e) => upd({ tfVis: { ...(it.tfVis || {}), [cls]: !!e.target.checked } })} className="cursor-pointer w-4 h-4" style={{ accentColor: TH.accent }} />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="px-4 pb-4 flex items-center gap-2">
                {/* «ذخیره به‌عنوانِ پیش‌فرض» — هم‌ترازِ «Save as default»ِ منوی Defaultsِ TV: تنظیماتِ فعلی برای نمونه‌های بعدیِ همین اندیکاتور ذخیره می‌شود */}
                <button onClick={() => { saveIndDefault(it.key, it); setEditInd(null); }} title="ذخیرهٔ این تنظیمات به‌عنوانِ پیش‌فرضِ این اندیکاتور (برای نمونه‌های بعدی)" className="px-3 py-1.5 rounded-md text-sm shrink-0 transition-colors duration-[120ms]" style={{ background: TH.chipBg, color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>ذخیرهٔ پیش‌فرض</button>
                {/* «بازنشانی به پیش‌فرض» — هم‌ترازِ دکمهٔ Defaults/Reset settingsِ TV: ورودی‌ها و همهٔ override‌های استایل به مقادیرِ رجیستری برمی‌گردند */}
                <button onClick={() => upd({ inputs: { ...def.inputs }, color: def.color, lineColors: {}, plotHidden: {}, width: undefined, lineStyle: undefined, opacity: undefined, fillColor: undefined, fillOpacity: undefined, scale: undefined, visible: true, tfVis: undefined })} title="بازگردانی به تنظیماتِ پیش‌فرض" className="px-3 py-1.5 rounded-md text-sm shrink-0 transition-colors duration-[120ms]" style={{ background: TH.chipBg, color: TH.text }} onMouseEnter={(e) => (e.currentTarget.style.background = TH.chipBgHover)} onMouseLeave={(e) => (e.currentTarget.style.background = TH.chipBg)}>بازنشانی</button>
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
      <Partners open={partnersOpen} onClose={() => setPartnersOpen(false)} TH={TH} />
      <SymbolSearchModal open={symModal} seed={searchSeed} compareMode={symModalMode === 'compare'} onClose={() => { setSymModal(false); setSymModalMode('switch'); setSearchSeed(''); }} metaList={symbolMeta} watch={watch} current={symbol} onPick={(s) => { if (symModalMode === 'compare') { window.dispatchEvent(new CustomEvent('bn:addCompare', { detail: s })); } else { setSymbol(s); } }} TH={TH} coarse={bp.coarse} />

      {/* دیالوگِ کاملِ اندیکاتورها (پاریتیِ TV) — با کلیک روی هر مورد addInd صدا زده می‌شود؛ دیالوگ برای افزودنِ پیاپی باز می‌مانَد */}
      <IndicatorsDialog open={indDlg} onClose={() => setIndDlg(false)} TH={TH} onPick={(key) => { if (REGISTRY[key]) addInd(key); }} onHelp={(key) => setHelpId(key)} onOpenScripts={openNamaScript} />
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
          timezone: tz,
        }}
        onChange={(patch) => {
          setChartSettingsOverrides((prev) => ({ ...prev, ...patch }));
          if ('scaleMode' in patch) setScaleMode(patch.scaleMode);
          if ('scaleInvert' in patch) setScaleInvert(patch.scaleInvert);
          if ('scaleLock' in patch) setScaleLocked(patch.scaleLock);
          if ('slVolume' in patch) setShowVolume(patch.slVolume);
          if ('timezone' in patch) setTz(patch.timezone);
          if ('crosshairStyle' in patch) setCrosshairId(patch.crosshairStyle === 0 ? 'cross' : 'dot');
          // خطوطِ شبکه (Grid lines) — قبلاً در دیالوگ بودند ولی به چارت وصل نبودند؛ اکنون زنده اعمال می‌شوند (chart-level ⇒ با تعویضِ نماد/نوع‌چارت هم می‌مانند).
          if ('gridHorz' in patch || 'gridVert' in patch || 'gridHorzColor' in patch || 'gridVertColor' in patch) {
            const ov = { ...chartSettingsOverrides, ...patch };
            try { chartRef.current && chartRef.current.applyOptions({ grid: {
              vertLines: { visible: ov.gridVert !== false, color: ov.gridVertColor || TH.gridLine, style: 1 },
              horzLines: { visible: ov.gridHorz !== false, color: ov.gridHorzColor || TH.gridLine, style: 1 },
            } }); } catch (e) {}
          }
          // رنگِ کراس‌هیر (قبلاً مرده) — chart-level؛ merge با گزینه‌های موجود پس سبک/نمایش حفظ می‌شود.
          if ('crosshairColor' in patch) {
            const c = patch.crosshairColor || '#9598a1';
            try { chartRef.current && chartRef.current.applyOptions({ crosshair: { vertLine: { color: c }, horzLine: { color: c } } }); } catch (e) {}
          }
          // ضخامتِ کراس‌هیر (۱–۴px) — هم‌ترازِ کنترلِ widthِ کراس‌هیرِ TV.
          if ('crosshairWidth' in patch) {
            const w = Math.max(1, Math.min(4, patch.crosshairWidth || 1));
            try { chartRef.current && chartRef.current.applyOptions({ crosshair: { vertLine: { width: w }, horzLine: { width: w } } }); } catch (e) {}
          }
          // سبکِ خطِ کراس‌هیر (یکسره/نقطه‌چین) — اعمالِ زندهٔ مستقیم مثلِ رنگ/ضخامت؛ قبلاً XH_STYLE هاردکد بود و این کنترل کاری نمی‌کرد.
          if ('crosshairStyle' in patch) {
            const st = patch.crosshairStyle === 0 ? 0 : 1; // 0=یکسره(Solid) / 1=نقطه‌چین(Dotted)
            try { chartRef.current && chartRef.current.applyOptions({ crosshair: { vertLine: { style: st }, horzLine: { style: st } } }); } catch (e) {}
          }
          // حاشیه‌های مقیاسِ قیمت (Top/Bottom margin) — فضای خالیِ بالا/پایینِ محورِ قیمت (سبکِ TV).
          if ('marginTop' in patch || 'marginBottom' in patch) {
            const ov = { ...chartSettingsOverrides, ...patch };
            let top = Math.max(0, Math.min(45, ov.marginTop != null ? ov.marginTop : 12)) / 100;
            let bottom = Math.max(0, Math.min(45, ov.marginBottom != null ? ov.marginBottom : 8)) / 100;
            if (top + bottom > 0.9) { const k = 0.9 / (top + bottom); top *= k; bottom *= k; } // مجموع < ۹۰٪
            try { chartRef.current && chartRef.current.priceScale('right').applyOptions({ scaleMargins: { top, bottom } }); } catch (e) {}
          }
          // حاشیهٔ راست بر حسبِ میله (rightOffset) — «Right margin (bars)»ِ TV؛ اعمالِ زندهٔ دیالوگ.
          if ('marginRight' in patch) {
            try { chartRef.current && chartRef.current.timeScale().applyOptions({ rightOffset: Math.max(0, Math.min(50, patch.marginRight)) }); } catch (e) {}
          }
          // خطِ قیمتِ آخر (قبلاً مرده) — نمایش/پنهانِ خطِ قیمتِ جاری + برچسبِ آخر روی سریِ فعال.
          if ('priceLineShown' in patch) {
            try { const on = patch.priceLineShown !== false; priceSeriesRef.current && priceSeriesRef.current.applyOptions({ priceLineVisible: on, lastValueVisible: on }); } catch (e) {}
          }
          // اسکرول/زومِ محورها با درگ (قبلاً مرده) — chart-level؛ پیش‌فرضِ کتابخانه true پس بدونِ رگرسیون.
          if ('scrollScale' in patch) {
            const on = patch.scrollScale !== false;
            try { chartRef.current && chartRef.current.applyOptions({ handleScroll: on, handleScale: on }); } catch (e) {}
          }
          // اندازهٔ فونتِ محورها (قبلاً مرده) — chart-level؛ در افکتِ تم هم لحاظ شد تا بماند.
          if ('scaleFontSize' in patch) {
            try { chartRef.current && chartRef.current.applyOptions({ layout: { fontSize: patch.scaleFontSize || 12 } }); } catch (e) {}
          }
          // پس‌زمینهٔ چارت (قبلاً مرده) — solid یا gradient؛ chart-level، در افکتِ تم هم لحاظ شد.
          if ('bgColor' in patch || 'bgType' in patch || 'bgColor2' in patch) {
            try { chartRef.current && chartRef.current.applyOptions({ layout: { background: bgOpts({ ...chartSettingsOverrides, ...patch }) } }); } catch (e) {}
          }
          // رنگ/حاشیه/فتیلهٔ کندل (قبلاً مرده) — روی سریِ فعال زنده اعمال می‌شود؛ فقط انواعِ کندلی (بدونِ rebuild/refetch).
          if (['symUpColor', 'symDownColor', 'symBordersShown', 'symBorderUpColor', 'symBorderDownColor', 'symWickShown', 'symWickUpColor', 'symWickDownColor', 'symHollow'].some((k) => k in patch)) {
            if (['candles', 'hollow', 'heikin', 'renko', 'range', 'linebreak'].includes(chartType)) {
              // «کندلِ توخالی»ِ تبِ Symbol (symHollow، قبلاً توگلِ مرده) — مثلِ TV روی نوعِ Candles اعمال می‌شود (نوع «Candles» می‌ماند، توخالی رِندر می‌شود). #305
              try { const _m = { ...chartSettingsOverrides, ...patch }; priceSeriesRef.current && priceSeriesRef.current.applyOptions(candleOptsFrom(_m, chartType === 'hollow' || (chartType === 'candles' && _m.symHollow === true))); } catch (e) {}
            }
          }
          // «رنگِ میله‌ها بر اساسِ بستهٔ قبل» رنگِ per-bar می‌خواهد ⇒ نیازمندِ setData (نه applyOptions)؛ سری را با دیتای موجود بازمی‌سازیم.
          // settingsRef را دستی با مقدارِ تازه هم‌گام می‌کنیم چون setState نامتقارن است و buildPriceSeries از settingsRef.current می‌خوانَد.
          if ('symBarColorByPrevClose' in patch) {
            settingsRef.current = { ...chartSettingsOverrides, ...patch };
            try { buildPriceSeries(candlesRef.current); applyPriceLineVis(); } catch (e) {}
          }
          // «میله‌های نازک» (symThinBars) نوعِ سری را عوض می‌کند (Candlestick↔Bar) ⇒ نیازمندِ rebuild با دیتای موجود (نه refetch)، مثلِ الگوی بالا. #307
          if ('symThinBars' in patch) {
            settingsRef.current = { ...chartSettingsOverrides, ...patch };
            try { buildPriceSeries(candlesRef.current); applyPriceLineVis(); } catch (e) {}
          }
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
            <div className="min-h-[200px]"><ToolRail tool={tool} setTool={(id) => { if (id === 'eraser') { setTool('select'); setCrosshairId('eraser'); } else { if (crosshairIdRef.current === 'eraser') setCrosshairId('cross'); setTool(id); } setSheet('none'); }} TH={TH} onHelp={setHelpId} /></div>
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              <button onClick={() => setMagnet((v) => !v)} className="rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px]" style={{ minHeight: 56, color: magnet ? '#fff' : TH.textStrong, background: magnet ? TH.accent : TH.chipBg }}><Magnet size={18} /> مگنت</button>
              <button onClick={() => { drawRef.current && drawRef.current.undo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canUndo())} className="rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] disabled:opacity-40" style={{ minHeight: 56, color: TH.textStrong, background: TH.chipBg }}><Undo2 size={18} /> واگرد</button>
              <button onClick={() => { drawRef.current && drawRef.current.redo(); treeRefresh(); }} disabled={!(drawRef.current && drawRef.current.canRedo())} className="rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] disabled:opacity-40" style={{ minHeight: 56, color: TH.textStrong, background: TH.chipBg }}><Redo2 size={18} /> ازنو</button>
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
                      <button onClick={() => toggleIndVisible(it)} title={it.visible === false ? 'نمایش' : 'پنهان‌کردن'} aria-label={it.visible === false ? 'نمایشِ اندیکاتور' : 'پنهان‌کردنِ اندیکاتور'} className="p-1" style={{ color: TH.text }}>{it.visible === false ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                      <button onClick={() => { setEditInd({ scope: it.scope, id: it.id }); setSheet('none'); }} title="تنظیمات" aria-label="تنظیماتِ اندیکاتور" className="p-1" style={{ color: TH.text }}><Settings2 size={18} /></button>
                      <button onClick={() => rmInd(it.scope, it.id)} title="حذف" aria-label="حذفِ اندیکاتور" className="p-1 text-red-400"><X size={18} /></button>
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
              {/* «میان‌بُرهای صفحه‌کلید» روی موبایل حذف شد — روی دستگاهِ لمسی قابلِ‌استفاده نیست و TV هم در موبایل نشانش نمی‌دهد (declutter/قانونِ c). روی دسکتاپ دکمهٔ ⌨ باقی است. */}
            </div>
            <div className="mt-2"><AuthMenu theme={theme} /></div>
          </MobileToolSheet>
        </>
      )}
    </div>
  );
}
