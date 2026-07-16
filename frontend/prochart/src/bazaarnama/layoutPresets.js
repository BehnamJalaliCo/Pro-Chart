// ─────────────────────────────────────────────────────────────────────────────
// layoutPresets.js — پریست‌های چیدمانِ چند-چارت + کمک‌کننده‌های قالبِ چارت
// (فصل ۱۰.۱ و ۱۰.۳ از اسپک).
//
// دو بخش:
//  ۱) GRID_LAYOUTS — جدولِ پریست‌های شبکه (۱، ۲ افقی/عمودی، ۳، ۴، ۶، ۸) با
//     templateِ CSS-grid آماده برای استفاده در state و استایلِ موجود، به‌همراه
//     متادیتای sync (نماد/فاصله/کراسهر/زمان/ترسیم) و ذخیرهٔ چیدمانِ نام‌دار.
//  ۲) قالبِ چارت/اندیکاتور — ذخیره/بارگیری از localStorage (پورتابل، بدونِ
//     نماد/تایم‌فریم) برای اعمالِ مجددِ سریعِ یک «دسته‌اندیکاتور» یا «استایل».
//
// همه‌چیز خالص (pure) و بدونِ وابستگیِ React تا drop-in باشد.
// ─────────────────────────────────────────────────────────────────────────────

// ── پریست‌های شبکه ──
// هر پریست: cells (تعداد سلول)، cols/rows (templateِ CSS-grid)، label فارسی،
// و legacyGrid (نگاشت به state موجودِ `grid` که 1/2/4 است) برای سازگاریِ عقب‌رو.
export const GRID_LAYOUTS = {
  '1':  { id: '1',  cells: 1, cols: '1fr',         rows: '1fr',     label: 'تکی',          legacyGrid: 1 },
  '2h': { id: '2h', cells: 2, cols: '1fr 1fr',     rows: '1fr',     label: 'دوتایی افقی',  legacyGrid: 2 },
  '2v': { id: '2v', cells: 2, cols: '1fr',         rows: '1fr 1fr', label: 'دوتایی عمودی', legacyGrid: 2 },
  '3':  { id: '3',  cells: 3, cols: '1fr 1fr 1fr', rows: '1fr',     label: 'سه‌تایی',      legacyGrid: 4 },
  '4':  { id: '4',  cells: 4, cols: '1fr 1fr',     rows: '1fr 1fr', label: 'چهارتایی',     legacyGrid: 4 },
  '6':  { id: '6',  cells: 6, cols: '1fr 1fr 1fr', rows: '1fr 1fr', label: 'شش‌تایی',      legacyGrid: 4 },
  '8':  { id: '8',  cells: 8, cols: '1fr 1fr 1fr 1fr', rows: '1fr 1fr', label: 'هشت‌تایی', legacyGrid: 4 },
  // چیدمان‌های متقارنِ افزوده (هم‌ترازِ منوی چند-چارتِ TradingView): سه‌تاییِ عمودی، چهارتاییِ افقی/عمودی.
  '3v': { id: '3v', cells: 3, cols: '1fr',             rows: '1fr 1fr 1fr',         label: 'سه‌تاییِ عمودی',   legacyGrid: 4 },
  '4h': { id: '4h', cells: 4, cols: '1fr 1fr 1fr 1fr', rows: '1fr',                 label: 'چهارتاییِ افقی',   legacyGrid: 4 },
  '4v': { id: '4v', cells: 4, cols: '1fr',             rows: '1fr 1fr 1fr 1fr',     label: 'چهارتاییِ عمودی',  legacyGrid: 4 },
};

// ترتیبِ نمایش در انتخابگرِ پریست (سبکِ TradingView)
export const GRID_PRESET_ORDER = ['1', '2h', '2v', '3', '3v', '4', '4h', '4v', '6', '8'];

// گرفتنِ پریست با fallbackِ امن
export function getGridLayout(id) {
  return GRID_LAYOUTS[id] || GRID_LAYOUTS['1'];
}

// استایلِ inlineِ آماده برای container شبکه (همان شکلی که کدِ موجود می‌سازد):
//   <div style={gridStyle(getGridLayout(layoutId))}>...</div>
export function gridStyle(layout, gap = 4) {
  const L = typeof layout === 'string' ? getGridLayout(layout) : layout;
  return {
    display: 'grid',
    gap: `${gap}px`,
    gridTemplateColumns: L.cols,
    gridTemplateRows: L.rows,
  };
}

// پل به state موجودِ `grid` (1/2/4): از idِ پریست → عددِ legacy.
// تا زمانی که گرید به‌صورتِ کاملِ ChartCell یکپارچه نشده، انتخابگرِ پریست
// می‌تواند setGrid(presetToLegacyGrid('4')) را صدا بزند.
export function presetToLegacyGrid(id) {
  return getGridLayout(id).legacyGrid;
}

// نگاشتِ معکوس: از عددِ legacyِ `grid` → نزدیک‌ترین idِ پریست (برای هایلایتِ UI).
export function legacyGridToPreset(grid) {
  if (grid <= 1) return '1';
  if (grid === 2) return '2h';
  return '4';
}

// ─────────────────────────────────────────────────────────────────────────────
// متادیتای Sync — همگام‌سازیِ بینِ سلول‌های چند-چارت (سبکِ TradingView)
//
// پنج بُعدِ همگام‌سازی مطابقِ TradingView: نماد/فاصله(تایم‌فریم)/کراسهر/زمان/ترسیم.
// هر بُعد یک toggleِ مستقل است؛ caller state را نگه می‌دارد و این ماژول فقط
// شکلِ داده + کمک‌کننده‌های خالص را می‌دهد (هیچ سایداِفکتی ندارد).
// ─────────────────────────────────────────────────────────────────────────────
export const SYNC_DIMENSIONS = {
  symbol:    { id: 'symbol',    label: 'نماد',   default: false },
  interval:  { id: 'interval',  label: 'فاصله',  default: false },
  crosshair: { id: 'crosshair', label: 'کراسهر', default: true  },
  time:      { id: 'time',      label: 'زمان',   default: true  },
  drawings:  { id: 'drawings',  label: 'ترسیم',  default: false },
};

// ترتیبِ نمایشِ toggleهای sync در نوارِ چند-چارت.
export const SYNC_ORDER = ['symbol', 'interval', 'crosshair', 'time', 'drawings'];

// stateِ پیش‌فرضِ sync از روی defaultِ هر بُعد ساخته می‌شود.
export const DEFAULT_SYNC = SYNC_ORDER.reduce((acc, id) => {
  acc[id] = SYNC_DIMENSIONS[id].default;
  return acc;
}, {});

// ساختِ یک شیءِ syncِ نرمال‌شده: هر بُعدِ ناموجود از default پر می‌شود،
// کلیدهای ناشناخته دور ریخته می‌شوند و همه به boolean تبدیل می‌شوند.
export function makeSync(partial) {
  const p = partial && typeof partial === 'object' ? partial : {};
  const out = {};
  for (const id of SYNC_ORDER) {
    out[id] = Object.prototype.hasOwnProperty.call(p, id) ? !!p[id] : SYNC_DIMENSIONS[id].default;
  }
  return out;
}

// خواندنِ یک بُعد به‌صورتِ امن.
export function isSyncOn(sync, id) {
  return !!(sync && sync[id]);
}

// برگرداندنِ یک شیءِ syncِ تازه با toggleِ یک بُعد (immutable).
export function toggleSync(sync, id) {
  const base = makeSync(sync);
  if (Object.prototype.hasOwnProperty.call(base, id)) base[id] = !base[id];
  return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// قالب‌ها (Templates) — ذخیرهٔ محلی در localStorage
//
//  • قالبِ اندیکاتور (indicator template): بسته‌ای نام‌دار از overlays + subs
//    «با تنظیماتشان» اما بدونِ id (idها هنگامِ اعمال دوباره ساخته می‌شوند) و
//    بدونِ نماد/تایم‌فریم.
//  • قالبِ چارت/استایل (chart template): بسته‌ای از ظاهر/مقیاس‌ها
//    ({ theme, chartType, scaleMode, scaleLocked, scaleInvert, crosshairId, tz,
//      sessionsOn }).
//
// API همگی sync و defensive است (هیچ throwی به render نشت نمی‌کند).
// ─────────────────────────────────────────────────────────────────────────────

const IND_KEY = 'bn_ind_templates';
const CHART_KEY = 'bn_chart_templates';

let _tid = 0;
const tplId = () => `t${Date.now().toString(36)}_${(++_tid)}_${Math.floor(Math.random() * 1e4)}`;

function _read(key) {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function _write(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); return true; }
  catch (e) { return false; }
}

// idها را از آیتم‌های اندیکاتور حذف می‌کنیم تا قالب پورتابل بماند.
function _stripIds(arr) {
  return (arr || []).map(({ id, ...rest }) => ({ ...rest }));
}
// هنگامِ اعمال، idهای تازه می‌سازیم تا با state موجود تداخل نکنند.
function _withIds(arr) {
  return (arr || []).map((it) => ({ ...it, id: tplId() }));
}

// ── قالبِ اندیکاتور ──
export function listIndicatorTemplates() {
  return _read(IND_KEY);
}
// ذخیره: { name, overlays, subs } → آیتمِ ذخیره‌شده { id, name, overlays, subs, ts }
export function saveIndicatorTemplate(name, overlays, subs) {
  const list = _read(IND_KEY);
  const item = {
    id: tplId(),
    name: String(name || 'قالبِ اندیکاتور').trim() || 'قالبِ اندیکاتور',
    overlays: _stripIds(overlays),
    subs: _stripIds(subs),
    ts: Date.now(),
  };
  list.unshift(item);
  _write(IND_KEY, list);
  return item;
}
// بارگیریِ یک قالب → { overlays, subs } با idهای تازه، آمادهٔ setOverlays/setSubs.
export function applyIndicatorTemplate(id) {
  const item = _read(IND_KEY).find((t) => t.id === id);
  if (!item) return null;
  return { overlays: _withIds(item.overlays), subs: _withIds(item.subs) };
}
export function deleteIndicatorTemplate(id) {
  const list = _read(IND_KEY).filter((t) => t.id !== id);
  _write(IND_KEY, list);
  return list;
}

// ── قالبِ چارت/استایل ──
// کلیدهایی که یک قالبِ استایل می‌تواند نگه دارد (پورتابل، بدونِ نماد/تایم‌فریم).
export const CHART_TEMPLATE_KEYS = ['theme', 'chartType', 'scaleMode', 'scaleLocked', 'scaleInvert', 'crosshairId', 'tz', 'sessionsOn'];

export function listChartTemplates() {
  return _read(CHART_KEY);
}
// ذخیره: name + شیئی از stateِ جاری؛ فقط کلیدهای مجاز برداشته می‌شوند.
export function saveChartTemplate(name, state) {
  const data = {};
  for (const key of CHART_TEMPLATE_KEYS) {
    if (state && Object.prototype.hasOwnProperty.call(state, key)) data[key] = state[key];
  }
  const list = _read(CHART_KEY);
  const item = {
    id: tplId(),
    name: String(name || 'قالبِ استایل').trim() || 'قالبِ استایل',
    data,
    ts: Date.now(),
  };
  list.unshift(item);
  _write(CHART_KEY, list);
  return item;
}
// بارگیری → شیءِ data؛ caller هر کلید را با setterِ خودش اعمال می‌کند.
export function applyChartTemplate(id) {
  const item = _read(CHART_KEY).find((t) => t.id === id);
  return item ? { ...item.data } : null;
}
export function deleteChartTemplate(id) {
  const list = _read(CHART_KEY).filter((t) => t.id !== id);
  _write(CHART_KEY, list);
  return list;
}

// ─────────────────────────────────────────────────────────────────────────────
// چیدمانِ ذخیره‌شدهٔ چند-چارت (saved multi-chart layouts) — localStorage
//
// یک چیدمانِ نام‌دار = پریستِ شبکه + وضعیتِ sync + سلول‌ها (هر سلول: نماد/تایم‌فریم/…
// پورتابل، بدونِ id). این جدا از layoutِ سروریِ موجود (`bnLayoutSave`) است و
// صرفاً برای بازچینشِ سریعِ گریدِ چند-چارت به‌کار می‌رود. همه sync و defensive.
// ─────────────────────────────────────────────────────────────────────────────
const LAYOUT_KEY = 'bn_multichart_layouts';

// نرمال‌سازیِ یک چیدمان پیش از ذخیره/اعمال (preset معتبر + sync کامل + آرایهٔ cells).
function _normLayout(input) {
  const src = input && typeof input === 'object' ? input : {};
  const preset = GRID_LAYOUTS[src.preset] ? src.preset : '1';
  const cells = Array.isArray(src.cells) ? src.cells.map((c) => ({ ...c })) : [];
  return { preset, sync: makeSync(src.sync), cells };
}

export function listSavedLayouts() {
  return _read(LAYOUT_KEY);
}
// ذخیره: name + { preset, sync, cells } → آیتمِ ذخیره‌شده { id, name, ..., ts }
export function saveSavedLayout(name, layout) {
  const norm = _normLayout(layout);
  const list = _read(LAYOUT_KEY);
  const item = {
    id: tplId(),
    name: String(name || 'چیدمانِ چند-چارت').trim() || 'چیدمانِ چند-چارت',
    preset: norm.preset,
    sync: norm.sync,
    cells: norm.cells,
    ts: Date.now(),
  };
  list.unshift(item);
  _write(LAYOUT_KEY, list);
  return item;
}
// بارگیریِ یک چیدمان → { preset, sync, cells } آمادهٔ اعمال؛ null اگر نبود.
export function applySavedLayout(id) {
  const item = _read(LAYOUT_KEY).find((t) => t.id === id);
  if (!item) return null;
  return _normLayout(item);
}
export function deleteSavedLayout(id) {
  const list = _read(LAYOUT_KEY).filter((t) => t.id !== id);
  _write(LAYOUT_KEY, list);
  return list;
}

export default {
  GRID_LAYOUTS, GRID_PRESET_ORDER, getGridLayout, gridStyle,
  presetToLegacyGrid, legacyGridToPreset,
  SYNC_DIMENSIONS, SYNC_ORDER, DEFAULT_SYNC, makeSync, isSyncOn, toggleSync,
  listIndicatorTemplates, saveIndicatorTemplate, applyIndicatorTemplate, deleteIndicatorTemplate,
  listChartTemplates, saveChartTemplate, applyChartTemplate, deleteChartTemplate, CHART_TEMPLATE_KEYS,
  listSavedLayouts, saveSavedLayout, applySavedLayout, deleteSavedLayout,
};
