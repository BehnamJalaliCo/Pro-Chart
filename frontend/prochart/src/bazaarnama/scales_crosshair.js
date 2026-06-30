// بازارنما — فصل ۳: تایم‌فریم، محورها، مقیاسِ قیمت، کراس‌هیر و سشن‌ها.
// همهٔ صادرات‌ها «توابعِ خالص» یا «جدولِ ثابت» هستند تا به‌صورتِ drop-in در
// BazaarNama.jsx مصرف شوند. هیچ وابستگی به state یا به lightweight-charts ندارند؛
// خروجی‌ها payloadِ آمادهٔ applyOptions یا توصیف‌گرِ باندِ سشن هستند.
//
// شکلِ کندلِ سرتاسرِ پروژه: {t,o,h,l,c,v} با t = یونیکس‌ثانیه.
// مقادیرِ enum با اعدادِ ثابتِ lightweight-charts v5 هم‌خوان‌اند تا نیازی به
// import از کتابخانه نباشد (CrosshairMode: Normal=0, Magnet=1, Hidden=2 ؛
// PriceScaleMode: Normal=0, Logarithmic=1, Percentage=2, IndexedTo100=3).

/* ──────────────────────────────────────────────────────────────────────────
 * (الف) کراس‌هیر — حالت‌های Cross / Dot / Arrow / Hidden + Magnet
 * ────────────────────────────────────────────────────────────────────────── */

// مقادیرِ ثابتِ enumِ CrosshairMode در lightweight-charts v5
export const CROSSHAIR_MODE = { Normal: 0, Magnet: 1, Hidden: 2 };

// حالت‌های کاربرپسند. native enum فقط Normal/Magnet/Hidden را پوشش می‌دهد؛
// «Dot» و «Arrow» نمایش‌های نشانگر روی حالتِ Normal هستند که روی overlay رسم می‌شوند.
// glyph: نوعِ نشانه‌ای که میزبان باید روی نقطهٔ تقاطع بکشد ('none'|'dot'|'arrow').
// cursor: مقدارِ CSS cursor برای کانتینرِ چارت.
export const CROSSHAIR_MODES = [
  { id: 'cross', label: 'صلیبی', mode: CROSSHAIR_MODE.Normal, glyph: 'none', cursor: 'crosshair', linesVisible: true },
  { id: 'dot', label: 'نقطه‌ای', mode: CROSSHAIR_MODE.Normal, glyph: 'dot', cursor: 'crosshair', linesVisible: true },
  { id: 'arrow', label: 'پیکانی', mode: CROSSHAIR_MODE.Normal, glyph: 'arrow', cursor: 'default', linesVisible: true },
  { id: 'hidden', label: 'بدون', mode: CROSSHAIR_MODE.Hidden, glyph: 'none', cursor: 'default', linesVisible: false },
];

export const crosshairModeById = (id) =>
  CROSSHAIR_MODES.find((m) => m.id === id) || CROSSHAIR_MODES[0];

/**
 * ساختِ payloadِ آمادهٔ chart.applyOptions({...}) برای کراس‌هیر.
 * @param {string} id            یکی از 'cross'|'dot'|'arrow'|'hidden'
 * @param {boolean} magnet       اگر true → حالت روی Magnet می‌رود (snap به OHLC)
 * @param {object}  th           تمِ جاری (THEMES[theme]) برای رنگِ خط/برچسب
 * @returns {{crosshair:object, _ui:{glyph:string,cursor:string}}}
 *   crosshair: مستقیماً به chart.applyOptions داده می‌شود.
 *   _ui: راهنمای میزبان برای نشانگر/نشانه (نباید به applyOptions داده شود).
 */
export const crosshairOptions = (id, magnet, th) => {
  const m = crosshairModeById(id);
  // Magnet توگلِ متعامد است: اگر روشن باشد، حالتِ پایه (وقتی پنهان نیست) به Magnet می‌رود.
  const mode = m.mode === CROSSHAIR_MODE.Hidden
    ? CROSSHAIR_MODE.Hidden
    : (magnet ? CROSSHAIR_MODE.Magnet : CROSSHAIR_MODE.Normal);
  const T = th || {};
  const lineColor = T.text || '#9598a1';
  const labelBg = T.accent || '#2962FF';
  const lineCfg = {
    visible: m.linesVisible,
    color: lineColor,
    width: 1,
    style: 3,                 // LineStyle.LargeDashed
    labelVisible: m.linesVisible,
    labelBackgroundColor: labelBg,
  };
  return {
    crosshair: { mode, vertLine: { ...lineCfg }, horzLine: { ...lineCfg } },
    _ui: { glyph: m.glyph, cursor: m.cursor },
  };
};

/**
 * رسمِ glyphِ نقطه/پیکان روی بوم overlay در محلِ تقاطعِ کراس‌هیر.
 * میزبان آن را داخلِ هندلرِ subscribeCrosshairMove (همان‌جا که dl.render() صدا زده می‌شود)
 * صدا می‌زند: paintCrosshairGlyph(ctx, glyph, x, y, th).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} glyph  'dot' | 'arrow' | 'none'
 * @param {number} x      مختصاتِ پیکسلیِ افقی (از param.point.x)
 * @param {number} y      مختصاتِ پیکسلیِ عمودی (از param.point.y)
 */
export const paintCrosshairGlyph = (ctx, glyph, x, y, th) => {
  if (!ctx || glyph === 'none' || x == null || y == null) return;
  const color = (th && th.accent) || '#2962FF';
  ctx.save();
  if (glyph === 'dot') {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  } else if (glyph === 'arrow') {
    // پیکانِ کوچک که از بالا-چپ به نقطه اشاره می‌کند
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 12, y - 5);
    ctx.lineTo(x - 7, y - 5);
    ctx.lineTo(x - 5, y - 12);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
};

/* ──────────────────────────────────────────────────────────────────────────
 * (ب) مقیاسِ قیمت — حالت‌های Regular / Log / Percent / Indexed-to-100 + Invert/Lock
 * ────────────────────────────────────────────────────────────────────────── */

// مقادیرِ ثابتِ enumِ PriceScaleMode در lightweight-charts v5
export const PRICE_SCALE_MODE = { Normal: 0, Logarithmic: 1, Percentage: 2, IndexedTo100: 3 };

// جدولِ حالت‌های مقیاس برای پر کردنِ <select>. value مستقیماً به applyOptions({mode}) می‌رود.
export const PRICE_SCALE_MODES = [
  { value: PRICE_SCALE_MODE.Normal, label: 'عادی' },
  { value: PRICE_SCALE_MODE.Logarithmic, label: 'لگاریتمی' },
  { value: PRICE_SCALE_MODE.Percentage, label: 'درصدی' },
  { value: PRICE_SCALE_MODE.IndexedTo100, label: 'پایه ۱۰۰' },
];

/**
 * payloadِ آمادهٔ chart.priceScale(id).applyOptions({...}) برای حالت/قفل/وارونگیِ مقیاس.
 * @param {object} opt
 * @param {number}  opt.mode        یکی از PRICE_SCALE_MODE (پیش‌فرض Normal)
 * @param {boolean} opt.locked      true → autoScale خاموش (قفلِ بازهٔ دستی)
 * @param {boolean} opt.invert      true → محور عمودی وارونه
 * @returns {object} payloadِ applyOptions
 */
export const priceScaleOptions = ({ mode = PRICE_SCALE_MODE.Normal, locked = false, invert = false } = {}) => ({
  mode,
  autoScale: !locked,
  invertScale: !!invert,
});

// payloadِ «بازنشانیِ مقیاس» (دابل‌کلیکِ روی محور) — autoScale را دوباره روشن می‌کند.
// میزبان پس از این باید chart.timeScale().fitContent() را هم صدا بزند.
export const resetPriceScaleOptions = () => ({ autoScale: true, invertScale: false });

/* ──────────────────────────────────────────────────────────────────────────
 * (پ) سشن‌ها — باندهای London / NY / Tokyo (TZ-aware با Intl، DST خودکار)
 * ────────────────────────────────────────────────────────────────────────── */

// تعریفِ سشن‌ها برحسبِ ساعتِ UTC (تقریبیِ هماهنگ با backend session-coverage).
// startUtc/endUtc ساعتِ شناورِ UTC. اگر end < start یعنی سشن از نیمه‌شبِ UTC عبور می‌کند.
export const SESSIONS = [
  { id: 'tokyo', label: 'توکیو', startUtc: 0, endUtc: 9, color: 'rgba(99,102,241,0.10)', edge: 'rgba(99,102,241,0.45)' },
  { id: 'london', label: 'لندن', startUtc: 8, endUtc: 17, color: 'rgba(34,197,94,0.10)', edge: 'rgba(34,197,94,0.45)' },
  { id: 'newyork', label: 'نیویورک', startUtc: 13, endUtc: 22, color: 'rgba(234,179,8,0.10)', edge: 'rgba(234,179,8,0.45)' },
];

// رنگِ همپوشانیِ لندن↔نیویورک (پررنگ‌تر) برای تأکید.
export const SESSION_OVERLAP_COLOR = 'rgba(239,68,68,0.12)';

// تبدیلِ یک یونیکس‌ثانیه به اجزای تاریخِ تقویمیِ wall-clock در منطقهٔ زمانیِ داده‌شده.
// از Intl استفاده می‌کند تا DST خودکار اعمال شود (هیچ آفستِ ثابتی).
const _fmtCache = {};
const _zoneFmt = (tz) => {
  if (!_fmtCache[tz]) {
    _fmtCache[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    });
  }
  return _fmtCache[tz];
};

// آفستِ منطقهٔ زمانی (ثانیه) نسبت به UTC در لحظهٔ unixSec داده‌شده — DST-aware.
// روش: اختلافِ «UTC تفسیرشده به‌عنوانِ wall-clockِ آن منطقه» با «UTC واقعی».
export const tzOffsetSec = (unixSec, tz) => {
  try {
    const d = new Date(unixSec * 1000);
    const parts = _zoneFmt(tz).formatToParts(d);
    const get = (t) => Number(parts.find((p) => p.type === t)?.value);
    let hour = get('hour');
    if (hour === 24) hour = 0; // برخی محیط‌ها نیمه‌شب را 24 می‌دهند
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour,
      new Date(unixSec * 1000).getUTCMinutes(), new Date(unixSec * 1000).getUTCSeconds());
    return Math.round((asUtc - unixSec * 1000) / 1000);
  } catch (e) {
    return 0;
  }
};

/**
 * تولیدِ باندهای سشن برای بازهٔ زمانیِ مرئی. هر باند یک بازهٔ زمانی است (یونیکس‌ثانیه)
 * که میزبان می‌تواند با timeScale().timeToCoordinate() به پیکسل تبدیل کرده و مستطیلِ
 * نیمه‌شفاف بکشد (مثلِ aiZonesRef/drawZone).
 *
 * @param {number} fromSec  ابتدای بازهٔ مرئی (یونیکس‌ثانیه) — معمولاً اولین کندلِ مرئی.
 * @param {number} toSec    انتهای بازهٔ مرئی (یونیکس‌ثانیه) — معمولاً آخرین کندل + کمی آینده.
 * @param {string} tz       منطقهٔ زمانیِ نمایش (مثلِ 'Asia/Tehran').
 * @param {object} [opt]    { sessions?: string[] فقطِ idهای انتخابی، overlap?: boolean }
 * @returns {Array<{id,label,from,to,color,edge}>}
 *   from/to یونیکس‌ثانیه؛ color رنگِ پر؛ edge رنگِ لبه. باندهای overlap با id='overlap'.
 *
 * نکته: مرزها در منطقهٔ زمانیِ نمایش با DST محاسبه می‌شوند؛ از این رو با تغییرِ tz
 * این تابع دوباره صدا زده می‌شود تا باندها جابه‌جا شوند.
 */
export const sessionBands = (fromSec, toSec, tz = 'UTC', opt = {}) => {
  if (!(toSec > fromSec)) return [];
  const wantOverlap = opt.overlap !== false;
  const pick = opt.sessions && opt.sessions.length
    ? SESSIONS.filter((s) => opt.sessions.includes(s.id))
    : SESSIONS;
  const bands = [];
  const DAY = 86400;
  // از یک روزِ UTC پیش از from تا یک روزِ پس از to پیمایش می‌کنیم تا باندهای لبه‌ای جا نمانند.
  const startDay = Math.floor(fromSec / DAY) * DAY - DAY;
  const endDay = Math.floor(toSec / DAY) * DAY + DAY;
  for (let day = startDay; day <= endDay; day += DAY) {
    for (const s of pick) {
      // ساعتِ UTC را به یونیکس‌ثانیه تبدیل کن؛ عبور از نیمه‌شب را با +DAY مدیریت کن.
      const bStart = day + s.startUtc * 3600;
      const bEnd = day + (s.endUtc > s.startUtc ? s.endUtc : s.endUtc + 24) * 3600;
      const from = Math.max(bStart, fromSec);
      const to = Math.min(bEnd, toSec);
      if (to > from) bands.push({ id: s.id, label: s.label, from, to, color: s.color, edge: s.edge });
    }
  }
  // همپوشانیِ لندن↔نیویورک: اشتراکِ بازهٔ این دو سشن در هر روز.
  if (wantOverlap && pick.find((s) => s.id === 'london') && pick.find((s) => s.id === 'newyork')) {
    const L = SESSIONS.find((s) => s.id === 'london');
    const N = SESSIONS.find((s) => s.id === 'newyork');
    for (let day = startDay; day <= endDay; day += DAY) {
      const oFrom = Math.max(day + L.startUtc * 3600, day + N.startUtc * 3600, fromSec);
      const oTo = Math.min(day + L.endUtc * 3600, day + N.endUtc * 3600, toSec);
      if (oTo > oFrom) bands.push({ id: 'overlap', label: 'همپوشانی', from: oFrom, to: oTo, color: SESSION_OVERLAP_COLOR, edge: 'rgba(239,68,68,0.4)' });
    }
  }
  return bands;
};

/**
 * رسمِ باندهای سشن روی بوم overlay. میزبان آن را در همان pass که dl.render()
 * صدا زده می‌شود اجرا می‌کند: paintSessions(ctx, chart, bands, h).
 * مختصاتِ x از timeScale().timeToCoordinate(unixSec) گرفته می‌شود.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} chart  نمونهٔ چارت (برای timeScale().timeToCoordinate)
 * @param {Array}  bands  خروجیِ sessionBands
 * @param {number} height ارتفاعِ بوم (برای کشیدنِ باندِ تمام‌قد)
 */
export const paintSessions = (ctx, chart, bands, height) => {
  if (!ctx || !chart || !bands || !bands.length) return;
  let ts;
  try { ts = chart.timeScale(); } catch (e) { return; }
  ctx.save();
  for (const b of bands) {
    let x1 = ts.timeToCoordinate(b.from);
    let x2 = ts.timeToCoordinate(b.to);
    if (x1 == null || x2 == null) continue;
    if (x2 < x1) { const t = x1; x1 = x2; x2 = t; }
    const w = Math.max(1, x2 - x1);
    ctx.fillStyle = b.color;
    ctx.fillRect(x1, 0, w, height);
    // لبه‌های نازک
    ctx.strokeStyle = b.edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 + 0.5, 0); ctx.lineTo(x1 + 0.5, height);
    ctx.moveTo(x2 - 0.5, 0); ctx.lineTo(x2 - 0.5, height);
    ctx.stroke();
  }
  ctx.restore();
};

/* ──────────────────────────────────────────────────────────────────────────
 * (ت) شمارشِ معکوسِ بسته‌شدنِ کندل — calendar-aware
 * ────────────────────────────────────────────────────────────────────────── */

// جدولِ ثانیهٔ هر تایم‌فریمِ fixed-width (هم‌خوان با TF_SEC در BazaarNama.jsx).
// تایم‌فریم‌های تقویمی (W1/MN) جداگانه و درست محاسبه می‌شوند، نه با مدولوِ ثابت.
export const TF_SECONDS = {
  S1: 1, S5: 5, S10: 10, S15: 15, S30: 30,
  M1: 60, M3: 180, M5: 300, M15: 900, M30: 1800, M45: 2700,
  H1: 3600, H2: 7200, H3: 10800, H4: 14400,
  D1: 86400, W1: 604800, MN: 2592000,
};

// آیا این تایم‌فریم تقویمی است (مرزش روی مضربِ epoch نمی‌افتد)؟
const CALENDAR_TF = { W1: 'isoWeek', MN: 'month' };

/**
 * ثانیه‌های باقی‌مانده تا بسته‌شدنِ کندلِ جاری.
 * برای تایم‌فریم‌های fixed-width: sec - (now % sec) (مثلِ کدِ فعلی).
 * برای W1/MN: مرزِ تقویمیِ بعدی را در منطقهٔ زمانیِ نمایش محاسبه می‌کند (DST-aware).
 * @param {string} tf       شناسهٔ تایم‌فریم ('M5','H1','W1','MN',...)
 * @param {number} [nowSec] اکنون (یونیکس‌ثانیه)؛ پیش‌فرض Date.now()
 * @param {string} [tz]     منطقهٔ زمانیِ نمایش برای تایم‌فریم‌های تقویمی
 * @returns {number} ثانیهٔ باقی‌مانده (>=1)
 */
export const secondsToClose = (tf, nowSec, tz = 'UTC') => {
  const now = nowSec != null ? nowSec : Math.floor(Date.now() / 1000);
  const cal = CALENDAR_TF[tf];
  if (!cal) {
    const sec = TF_SECONDS[tf] || 3600;
    return sec - (now % sec) || sec;
  }
  // تقویمی: مرزِ بعدی را در منطقهٔ زمانیِ نمایش بیاب.
  const off = tzOffsetSec(now, tz);
  const local = new Date((now + off) * 1000); // UTC-fields = wall-clock محلی
  let next;
  if (cal === 'isoWeek') {
    // ابتدای هفتهٔ ISO بعدی = دوشنبهٔ 00:00 محلی
    const dow = (local.getUTCDay() + 6) % 7; // 0=دوشنبه
    const daysToNextMon = 7 - dow;
    next = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysToNextMon, 0, 0, 0);
  } else { // month
    next = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1, 0, 0, 0);
  }
  // next بر حسبِ wall-clockِ محلی است؛ به یونیکسِ واقعی برگردان.
  const rem = Math.round(next / 1000) - off - now;
  return rem > 0 ? rem : 1;
};

/**
 * قالب‌بندیِ ثانیهٔ باقی‌مانده به رشته: H:MM:SS یا M:SS (مثلِ کدِ فعلی).
 * @param {number} rem ثانیه
 * @returns {string}
 */
export const formatCountdown = (rem) => {
  const h = Math.floor(rem / 3600), m = Math.floor((rem % 3600) / 60), s = rem % 60;
  return h
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * رنگِ هشدارِ نزدیکِ بسته‌شدن: < 10s قرمز، < 60s کهربایی، وگرنه null (پیش‌فرض).
 * میزبان از آن برای tint کردنِ نشانگرِ شمارش استفاده می‌کند.
 * @param {number} rem ثانیه
 * @returns {string|null}
 */
export const countdownTint = (rem) => {
  if (rem <= 10) return '#ef4444';
  if (rem <= 60) return '#f59e0b';
  return null;
};

/* ──────────────────────────────────────────────────────────────────────────
 * (ث) قالب‌بندیِ محورِ زمان — TZ-aware (tickMarkFormatter / timeFormatter)
 * ────────────────────────────────────────────────────────────────────────── */

// منطقه‌های آمادهٔ انتخاب در picker (پیش‌فرضِ مخاطبِ ما: تهران).
export const TIMEZONES = [
  { id: 'Asia/Tehran', label: 'تهران' },
  { id: 'UTC', label: 'UTC' },
  { id: 'Europe/London', label: 'لندن' },
  { id: 'America/New_York', label: 'نیویورک' },
  { id: 'Asia/Tokyo', label: 'توکیو' },
];

/**
 * ساختِ payloadِ chart.applyOptions({ timeScale, localization }) برای قالب‌بندیِ
 * محورِ زمان و برچسبِ کراس‌هیر در منطقهٔ زمانیِ انتخابی.
 * @param {string} tz منطقهٔ زمانیِ نمایش
 * @returns {{timeScale:{tickMarkFormatter:Function}, localization:{timeFormatter:Function}}}
 */
export const timeZoneOptions = (tz = 'UTC') => {
  const dateFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: tz, month: 'short', day: 'numeric' });
  const timeFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const fullFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: tz, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  // tickType: 0=Year 1=Month 2=DayOfMonth 3=Time 4=TimeWithSeconds
  const tickMarkFormatter = (time, tickType) => {
    const d = new Date((typeof time === 'number' ? time : 0) * 1000);
    return tickType >= 3 ? timeFmt.format(d) : dateFmt.format(d);
  };
  const timeFormatter = (time) => fullFmt.format(new Date((typeof time === 'number' ? time : 0) * 1000));
  return { timeScale: { tickMarkFormatter }, localization: { timeFormatter } };
};

// پیش‌فرضِ کاملِ این فصل برای ذخیره/بازیابیِ میزِکار (saveWS/loadWS).
export const CH3_DEFAULTS = {
  scaleMode: PRICE_SCALE_MODE.Normal,
  scaleLocked: false,
  scaleInvert: false,
  crosshairId: 'cross',
  magnet: false,
  tz: 'Asia/Tehran',
  sessionsOn: false,
};
