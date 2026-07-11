// بازارنما — افزونهٔ «انواعِ چارت» (فصلِ ۲ از PRO_CHART_BUILD_SPEC).
// این فایل کاملاً additive است: هیچ فایلِ مشترکی را تغییر نمی‌دهد و با یک خط import + چند انشعابِ
// کوچک در buildPriceSeries مرج می‌شود. تابع‌ها «خالص»‌اند (pure transform/spec) و دقیقاً مطابقِ
// شکلِ خروجیِ chartbuilders.js داده می‌سازند تا موتورِ lightweight-charts v5 آن‌ها را رندر کند.
//
// قراردادِ داده: کندلِ خام {t,o,h,l,c,v}  —  t برحسبِ ثانیهٔ یونیکس.
// آداپتورهای موتور (مطابقِ BazaarNama.jsx):
//   valSeries(cs) → [{ time:c.t, value:c.c }]
//   ohlc(cs)      → [{ time:c.t, open:c.o, high:c.h, low:c.l, close:c.c }]
//
// انواعِ پیاده‌سازی‌شده در این فایل:
//   ۴  — Volume Candles (کندلِ حجمی، رنگ بر پایهٔ close/open + opacity ∝ حجم)
//   ۶  — Line with Markers (خط با نشانگرِ نقطه‌ای)
//   ۹  — HLC Area (ناحیهٔ close + دو خطِ کم‌رنگِ high/low) — تنها نوعِ چندسری
//   ۱۱ — Columns (هیستوگرامِ close با رنگِ جهت)
//   ۱۲ — High-Low (تنها بازهٔ high–low هر بار، بدونِ open/close)
//   به‌علاوه ارتقای رندرِ Kagi (ضخامتِ yang/yin) و P&F (ستون‌های X/O) طبقِ §2.13/§2.14

import { avgRange, kagi } from './chartbuilders';

// ────────────────────────────────────────────────────────────────────────────
//  ابزارهای کوچک
// ────────────────────────────────────────────────────────────────────────────

// تبدیلِ رنگِ hex به rgba با آلفای دلخواه (برای تینت‌های کم‌رنگ و opacityِ حجمی)
function withAlpha(color, a) {
  if (!color) return `rgba(0,0,0,${a})`;
  if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, `${a})`);
  if (color.startsWith('rgb('))  return color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
  let h = color.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
}
const clamp = (lo, hi, x) => Math.max(lo, Math.min(hi, x));

// رنگ‌های پیش‌فرض (اگر فراخواننده تم را پاس ندهد) — هم‌تراز با THEMES.dark در BazaarNama.jsx
const DEF = { up: '#26a69a', down: '#ef5350', accent: '#2962FF' };

// ────────────────────────────────────────────────────────────────────────────
//  ۴ — Volume Candles  (نوعِ «کندل»)
//  خروجی: آرایهٔ کندلِ سازگار با CandlestickSeries که هر نقطه «color/borderColor/wickColor»
//  اختصاصی دارد؛ شفافیتِ بدنه متناسب با حجمِ همان بار است (تقریبِ Equivolume بدونِ CustomSeries).
//  رنگِ بدنه: up/down بر پایهٔ close≥open. آلفا در بازهٔ [0.25,1] بر پایهٔ vol/maxVol.
//  مصرف: chart.addSeries(CandlestickSeries, {...}); s.setData(volumeCandles(cs, {up,down}));
// ────────────────────────────────────────────────────────────────────────────
export function volumeCandles(cs, opts = {}) {
  const up = opts.up || DEF.up, down = opts.down || DEF.down;
  if (!cs.length) return [];
  let maxV = 0;
  for (const c of cs) maxV = Math.max(maxV, c.v || 0);
  return cs.map((c) => {
    const bull = c.c >= c.o;
    const base = bull ? up : down;
    // آلفای بدنه ∝ حجم؛ کفِ 0.25 تا همیشه دیده شود
    const a = maxV > 0 ? clamp(0.25, 1, 0.25 + 0.75 * ((c.v || 0) / maxV)) : 0.85;
    return {
      time: c.t, open: c.o, high: c.h, low: c.l, close: c.c,
      color: withAlpha(base, a), borderColor: base, wickColor: base,
    };
  });
}

// نکته: برای رندرِ «تقریبیِ Route B» (کندل عادی + ساب‌پنِ حجم) از همین کندل‌ها استفاده کنید
// و یک HistogramSeries جدا برای حجم بسازید. این تابع، مسیرِ تک‌سریِ رنگ‌محور را می‌دهد.
// دادهٔ حجم برای ساب‌پنِ اختیاری:
export function volumeHistogram(cs, opts = {}) {
  const up = opts.up || DEF.up, down = opts.down || DEF.down;
  return cs.map((c) => ({ time: c.t, value: c.v || 0, color: withAlpha(c.c >= c.o ? up : down, 0.5) }));
}

// ────────────────────────────────────────────────────────────────────────────
//  ۶ — Line with Markers  (نوعِ «خطِ مقدار»)
//  همان دادهٔ خطی (close)؛ رندر با LineSeries و گزینهٔ نیتیوِ pointMarkersVisible:true.
//  این تابع داده را می‌دهد و lineMarkerOptions گزینه‌های سری را.
// ────────────────────────────────────────────────────────────────────────────
export function lineMarkersData(cs) {
  return cs.map((c) => ({ time: c.t, value: c.c }));
}
export function lineMarkerOptions(opts = {}) {
  return {
    color: opts.accent || DEF.accent,
    lineWidth: 2,
    pointMarkersVisible: true,
    pointMarkersRadius: opts.radius || 3,
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  ۹ — HLC Area  (نوعِ «چندسری»: یک AreaSeries + دو LineSeries)
//  خروجی یک spec است: { area:{options,data}, aux:[{ctor:'line',options,data}, ...] }
//  «area» سریِ اصلی/anchorِ ترسیم است؛ «aux» سری‌های فرعی (high/low) که باید removeSeries شوند.
// ────────────────────────────────────────────────────────────────────────────
export function hlcAreaSpec(cs, opts = {}) {
  const up = opts.up || DEF.up, down = opts.down || DEF.down, accent = opts.accent || DEF.accent;
  return {
    area: {
      options: { lineColor: accent, topColor: withAlpha(accent, 0.35), bottomColor: withAlpha(accent, 0) },
      data: cs.map((c) => ({ time: c.t, value: c.c })),
    },
    aux: [
      { ctor: 'line', role: 'high', options: { color: withAlpha(up, 0.35), lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false }, data: cs.map((c) => ({ time: c.t, value: c.h })) },
      { ctor: 'line', role: 'low',  options: { color: withAlpha(down, 0.35), lineWidth: 1, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false }, data: cs.map((c) => ({ time: c.t, value: c.l })) },
    ],
  };
}

// ────────────────────────────────────────────────────────────────────────────
//  ۱۱ — Columns  (نوعِ «هیستوگرام»)
//  هیستوگرامِ close؛ رنگِ هر ستون بر پایهٔ جهت (close≥prevClose).
//  مصرف: chart.addSeries(HistogramSeries, columnsOptions()); s.setData(columnsData(cs, {up,down}));
//  هشدارِ live-update: HistogramSeries.update({time,value,color}) — انشعابِ جدا لازم است.
// ────────────────────────────────────────────────────────────────────────────
export function columnsData(cs, opts = {}) {
  const up = opts.up || DEF.up, down = opts.down || DEF.down;
  if (!cs.length) return [];
  let prev = cs[0].c;
  return cs.map((c) => {
    const rising = c.c >= prev; prev = c.c;
    return { time: c.t, value: c.c, color: rising ? up : down };
  });
}
export function columnsOptions() {
  return { priceLineVisible: false, lastValueVisible: true };
}
// نقطهٔ live برای Columns (محاسبهٔ رنگ نسبت به کندلِ ماقبلِ آخر)
export function columnsLivePoint(cs, opts = {}) {
  const up = opts.up || DEF.up, down = opts.down || DEF.down;
  if (!cs.length) return null;
  const last = cs[cs.length - 1];
  const prev = cs.length > 1 ? cs[cs.length - 2].c : last.c;
  return { time: last.t, value: last.c, color: last.c >= prev ? up : down };
}

// ────────────────────────────────────────────────────────────────────────────
//  ۱۲ — High-Low  (نوعِ «کندل»، Strategy A از §2.8)
//  CandlestickSeries با open=low, close=high و بدون بوردر/ویک ⇒ میلهٔ توپُرِ high–low.
//  رنگ بر پایهٔ close-vs-prevClose (جهتِ بسته‌شدن، چون open/close واقعی پنهان است).
//  مصرف: chart.addSeries(CandlestickSeries, highLowOptions()); s.setData(highLowData(cs, {up,down}));
// ────────────────────────────────────────────────────────────────────────────
export function highLowData(cs, opts = {}) {
  const up = opts.up || DEF.up, down = opts.down || DEF.down;
  if (!cs.length) return [];
  let prevC = cs[0].c;
  return cs.map((c) => {
    const rising = c.c >= prevC; prevC = c.c;
    const col = rising ? up : down;
    // open=low, close=high تا بدنه از کف تا سقف کشیده شود
    return { time: c.t, open: c.l, high: c.h, low: c.l, close: c.h, color: col, borderColor: col, wickColor: 'rgba(0,0,0,0)' };
  });
}
export function highLowOptions() {
  return { borderVisible: false, wickUpColor: 'rgba(0,0,0,0)', wickDownColor: 'rgba(0,0,0,0)' };
}

// ────────────────────────────────────────────────────────────────────────────
//  ارتقای Kagi — ضخامتِ yang/yin  (§2.13)
//  از kagi() موجود نقاط را می‌گیریم و آن را به «قطعاتِ راست‌گوشه با ضخامتِ متغیر» می‌شکنیم.
//  چون LineSeries عرضِ یکنواخت دارد، خروجی را به‌صورتِ مجموعه‌ای از سری‌های خطیِ مجزا می‌دهیم:
//  هر «segment-run» با ضخامتِ ثابت (yang=۳، yin=۱) یک سریِ جدا با نقاطِ راست‌گوشه است.
//  این spec بدونِ CustomSeries، رفتارِ TradingView (شانه/کمر) را تقریب می‌زند.
//
//  خروجی: { segments: [ { thick:Boolean, points:[{time,value}, ...] }, ... ] }
//  راست‌گوشه‌سازی: بینِ دو رأسِ a→b یک نقطهٔ میانیِ (b.time, a.value) درج می‌شود تا
//  پله‌ای (افقی سپس عمودی) رسم شود؛ ضخامت بر پایهٔ عبور از shoulder/waist تعیین می‌گردد.
// ────────────────────────────────────────────────────────────────────────────
export function kagiSpec(cs, opts = {}) {
  const up = opts.up || DEF.up, down = opts.down || DEF.down;
  const pts = kagi(cs, opts.reversal); // [{t,value}, ...]
  if (pts.length < 2) {
    return { segments: pts.length ? [{ thick: false, color: up, points: pts.map((p) => ({ time: p.t, value: p.value })) }] : [] };
  }
  // پاسِ تعیینِ ضخامت: thick (yang) وقتی سطح از shoulderِ پیشین بالاتر رود، thin (yin) زیرِ waist.
  let shoulder = -Infinity, waist = Infinity, thick = false;
  const flags = []; // ضخامتِ هر قطعهٔ a→b (به ازای i از 1..n-1)
  for (let i = 1; i < pts.length; i++) {
    const v = pts[i].value;
    if (v > shoulder) { thick = true; shoulder = v; }
    if (v < waist)    { thick = false; waist = v; }
    flags.push(thick);
  }
  // نقاطِ راست‌گوشه + خرد کردن به run هایی با ضخامتِ یکسان
  const segments = [];
  let cur = null;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const t = flags[i - 1];
    const corner = { time: b.t, value: a.value };  // پله: ابتدا افقی تا زمانِ b، سپس عمودی
    if (!cur || cur.thick !== t) {
      if (cur) segments.push(cur);
      cur = { thick: t, color: t ? up : down, points: [{ time: a.t, value: a.value }] };
    }
    cur.points.push({ time: corner.time, value: corner.value });
    cur.points.push({ time: b.t, value: b.value });
  }
  if (cur) segments.push(cur);
  return { segments };
}
// گزینه‌های سری برای هر قطعهٔ Kagi
export function kagiSegmentOptions(seg) {
  return { color: seg.color, lineWidth: seg.thick ? 3 : 1, lineJoin: 'miter', priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
}

// ────────────────────────────────────────────────────────────────────────────
//  ارتقای Point & Figure — ستون‌های X/O  (§2.14)
//  مدلِ ستونِ جعبه‌ای: هر ستون یک جهت (+1=X صعودی / -1=O نزولی) و بازهٔ from..to (در واحدِ box) دارد.
//  چون CustomSeries نداریم، گلیف‌های X/O را به‌صورتِ «نشانگرِ نقطه‌ای روی یک سریِ خطیِ نامرئی»
//  رندر می‌کنیم: برای هر سلولِ جعبه یک نقطه با markerِ متناظر می‌سازیم.
//  هر ستون یک «زمانِ» یکتا (ایندکسِ ستون) می‌گیرد تا ستون‌ها کنارِ هم بنشینند.
//
//  خروجی: {
//    cells:    [{ time, value }, ...]      ← همهٔ سلول‌ها (دادهٔ یک LineSeriesِ نامرئی برای autoscale)
//    markers:  [{ time, position:'inBar', color, shape:'circle'|'square', text:'X'|'O' }, ...]
//    box:      اندازهٔ جعبه (برای نمایش/تنظیمات)
//  }
//  نشانگرها از طریقِ createSeriesMarkers(series, markers) به سریِ نامرئی وصل می‌شوند.
// ────────────────────────────────────────────────────────────────────────────
export function pnfColumns(cs, opts = {}) {
  if (!cs.length) return { cells: [], markers: [], columns: [], box: 1 };
  const box = opts.box || avgRange(cs) || 1;
  const reversal = opts.reversal || 3;
  const q = (p) => Math.round(p / box) * box;          // کوانتایزِ قیمت به مضربِ box
  const columns = [];                                   // { dir:+1/-1, from, to }
  let dir = 0, col = null;
  for (const c of cs) {
    const bp = q(opts.source === 'hl' ? (dir >= 0 ? c.h : c.l) : c.c);
    if (dir === 0) {
      // ستونِ آغازین — جهت را با اولین حرکتِ ≥box تعیین می‌کنیم
      if (!col) { col = { dir: 1, from: bp, to: bp }; }
      if (bp >= col.to + box) { dir = 1; col.dir = 1; col.to = bp; }
      else if (bp <= col.from - box) { dir = -1; col.dir = -1; col.from = bp; const tmp = col.from; col.from = col.to; col.to = tmp; }
      continue;
    }
    if (dir === 1) {
      if (bp >= col.to + box) { col.to = bp; }                       // ادامهٔ ستونِ X رو به بالا
      else if (bp <= col.to - reversal * box) {                       // برگشت → ستونِ O جدید
        columns.push(col);
        col = { dir: -1, from: col.to - box, to: bp }; dir = -1;
      }
    } else { // dir === -1
      if (bp <= col.to - box) { col.to = bp; }                        // ادامهٔ ستونِ O رو به پایین
      else if (bp >= col.to + reversal * box) {                       // برگشت → ستونِ X جدید
        columns.push(col);
        col = { dir: 1, from: col.to + box, to: bp }; dir = 1;
      }
    }
  }
  if (col) columns.push(col);

  // رندر: هر ستون یک «time» یکتا (ایندکسِ ستون، با مبنای زمانِ اولین کندل تا محورِ زمان معتبر بماند)
  const up = opts.up || DEF.up, down = opts.down || DEF.down;
  const t0 = cs[0].t, step = 1;
  const cells = [];
  const markers = [];
  columns.forEach((cl, idx) => {
    const time = t0 + idx * step;
    const lo = Math.min(cl.from, cl.to), hi = Math.max(cl.from, cl.to);
    for (let lvl = lo; lvl <= hi + 1e-9; lvl += box) {
      cells.push({ time, value: lvl });
      markers.push({
        time, position: 'inBar',
        color: cl.dir > 0 ? up : down,
        shape: cl.dir > 0 ? 'square' : 'circle', // X≈مربع، O≈دایره (نزدیک‌ترین گلیفِ نیتیو)
        text: cl.dir > 0 ? 'X' : 'O',
      });
    }
  });
  return { cells, markers, columns, box };
}
// گزینه‌های سریِ نامرئیِ میزبانِ گلیف‌های P&F
export function pnfHostOptions() {
  return { color: 'rgba(0,0,0,0)', lineWidth: 1, pointMarkersVisible: false, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };
}

// ────────────────────────────────────────────────────────────────────────────
//  فهرستِ انواعِ جدید برای مرج با CHART_TYPES (برچسب فارسی).
//  Icon را عمداً نمی‌گذارم تا importِ آیکونِ اضافه لازم نشود؛ فراخواننده می‌تواند Icon اضافه کند.
//  (BazaarNama.jsx آیکون را اختیاری مصرف می‌کند.)
// ────────────────────────────────────────────────────────────────────────────
export const EXT_CHART_TYPES = [
  { id: 'volcandles', label: 'کندلِ حجمی' },
  { id: 'lwm',        label: 'خطی با نشانگر' },
  { id: 'hlcarea',    label: 'ناحیهٔ HLC' },
  { id: 'columns',    label: 'ستونی' },
  { id: 'highlow',    label: 'سقف‑کف' },
];

// شناسه‌های نوعِ جدید که خانوادهٔ «مقدار» محسوب می‌شوند (برای guardهای live-update/replay).
// volcandles/highlow «کندل»‌اند؛ columns «هیستوگرام»؛ hlcarea «area/مقدار»؛ lwm «خط/مقدار».
export const EXT_VALUE_TYPES = ['lwm', 'hlcarea']; // به آرایه‌های ['line','area','baseline','step'] افزوده شوند
export const EXT_HISTOGRAM_TYPES = ['columns'];
export const EXT_CANDLE_TYPES = ['volcandles', 'highlow'];
// همهٔ انواعِ جدیدِ این فایل (برای انشعابِ buildPriceSeries)
export const EXT_TYPES = ['volcandles', 'lwm', 'hlcarea', 'columns', 'highlow'];

// ────────────────────────────────────────────────────────────────────────────
//  Dispatcher کمکی — یک‌جا برای buildPriceSeries.
//  داده/گزینه‌های لازم را بر پایهٔ نوع برمی‌گرداند تا فراخواننده فقط addSeries کند.
//  خروجی: { kind: 'candle'|'histogram'|'line-markers'|'hlc-area', ... }
//  (فراخواننده با همان ctorهای import‌شده در BazaarNama.jsx سری را می‌سازد.)
// ────────────────────────────────────────────────────────────────────────────
export function buildExtType(type, cs, opts = {}) {
  switch (type) {
    case 'volcandles':
      return { kind: 'candle', options: {}, data: volumeCandles(cs, opts) };
    case 'highlow':
      return { kind: 'candle', options: highLowOptions(), data: highLowData(cs, opts) };
    case 'columns':
      return { kind: 'histogram', options: columnsOptions(), data: columnsData(cs, opts) };
    case 'lwm':
      return { kind: 'line-markers', options: lineMarkerOptions(opts), data: lineMarkersData(cs) };
    case 'hlcarea':
      return { kind: 'hlc-area', spec: hlcAreaSpec(cs, opts) };
    default:
      return null;
  }
}
