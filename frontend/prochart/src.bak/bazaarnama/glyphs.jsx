// بازارنما — ست آیکونِ خطی (line-art) و اوریجینالِ ابزارهای ترسیمِ Pro-Chart.
// ─────────────────────────────────────────────────────────────────────────────
// هر گلیف یک طراحیِ هندسیِ تازه و مفهومی است (نه کپیِ هیچ محصولی). سبکِ مشترک:
//   viewBox 0 0 24 24 · fill none · stroke currentColor · stroke-width 1.6
//   stroke-linecap/linejoin round · نقاطِ دستگیره به‌صورتِ دایرهٔ توپُرِ r=1.4.
// همهٔ کامپوننت‌ها امضای یکسان دارند: ({ size = 16, ...props }) → <svg .../>.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

// پوستهٔ مشترکِ SVG: سبکِ یکدست را روی همهٔ گلیف‌ها اعمال می‌کند.
function S({ size = 16, children, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

// دایرهٔ دستگیره (نقطهٔ توپُر). filled با currentColor، بدونِ stroke.
function Dot({ cx, cy }) {
  return <circle cx={cx} cy={cy} r="1.4" fill="currentColor" stroke="none" />;
}

/* ─── cursors ──────────────────────────────────────────────────────────── */

// نشانگرِ فلش (arrow pointer).
const Cursor = (p) => (
  <S {...p}>
    <path d="M5 4l6.5 15 2-6 6-2L5 4z" />
  </S>
);

// انتخاب: نشانگر + کادرِ انتخابِ نقطه‌چین.
const Select = (p) => (
  <S {...p}>
    <path d="M4 4l5.2 12 1.6-4.8L15.6 9 4 4z" />
    <rect x="11" y="11" width="9" height="9" rx="1" strokeDasharray="2 2" />
  </S>
);

/* ─── lines ────────────────────────────────────────────────────────────── */

// خط روند: قطری با دو نقطهٔ انتها.
const Trend = (p) => (
  <S {...p}>
    <path d="M5 18L19 6" />
    <Dot cx="5" cy="18" />
    <Dot cx="19" cy="6" />
  </S>
);

// پرتو: از یک نقطه، با سرپیکان در انتهای دور.
const Ray = (p) => (
  <S {...p}>
    <path d="M4 20L18 6" />
    <path d="M13 6h5v5" />
    <Dot cx="4" cy="20" />
  </S>
);

// خطِ امتدادیافته: کشیده به هر دو سو، نقطهٔ میانی.
const ExtLine = (p) => (
  <S {...p}>
    <path d="M3 21L21 3" />
    <Dot cx="12" cy="12" />
  </S>
);

// پرتوِ افقی: از یک نقطه به راست با پیکان.
const HRay = (p) => (
  <S {...p}>
    <path d="M4 12h15" />
    <path d="M15 8l4 4-4 4" />
    <Dot cx="4" cy="12" />
  </S>
);

// خط افقی: تمام‌عرض.
const HLine = (p) => (
  <S {...p}>
    <path d="M3 12h18" />
    <Dot cx="6" cy="12" />
    <Dot cx="18" cy="12" />
  </S>
);

// خط عمودی: تمام‌ارتفاع.
const VLine = (p) => (
  <S {...p}>
    <path d="M12 3v18" />
    <Dot cx="12" cy="6" />
    <Dot cx="12" cy="18" />
  </S>
);

// خطِ صلیبی: نشانهٔ + .
const CrossLine = (p) => (
  <S {...p}>
    <path d="M12 3v18M3 12h18" />
    <Dot cx="12" cy="12" />
  </S>
);

// زاویهٔ روند: دو خط که در یک رأس به هم می‌رسند + کمانِ کوچک.
const Angle = (p) => (
  <S {...p}>
    <path d="M4 19h15M4 19L17 6" />
    <path d="M12 19a8 8 0 00-2.4-5.7" />
    <Dot cx="4" cy="19" />
  </S>
);

// خطِ اطلاعاتی: خطِ قطری با تیکِ اندازه‌گیری و حروفِ «i».
const InfoLine = (p) => (
  <S {...p}>
    <path d="M4 20L16 8" />
    <path d="M13 5l4 4" />
    <Dot cx="20.3" cy="6.7" />
    <path d="M20.3 9.5v3.2" />
  </S>
);

/* ─── channels ─────────────────────────────────────────────────────────── */

// کانال: دو خطِ قطریِ موازی.
const Channel = (p) => (
  <S {...p}>
    <path d="M4 16L18 4M6 20L20 8" />
    <Dot cx="4" cy="16" />
    <Dot cx="20" cy="8" />
  </S>
);

// چنگال: یک دسته که به ۳ شاخهٔ موازی می‌رسد.
const Pitchfork = (p) => (
  <S {...p}>
    <path d="M4 12h6" />
    <path d="M10 5v14" />
    <path d="M10 5l9 5M10 12h9M10 19l9-5" />
    <Dot cx="4" cy="12" />
  </S>
);

/* ─── fib ──────────────────────────────────────────────────────────────── */

// فیبوناچی: ۵ ترازِ افقی با لبهٔ عمودیِ چپ.
const Fib = (p) => (
  <S {...p}>
    <path d="M5 4v16" />
    <path d="M5 5h15M5 9.5h15M5 14h15M5 18.5h15" />
  </S>
);

// فیبوی گسترشی: ترازها فراتر از یک روند پرتاب می‌شوند، ۳ نقطه.
const FibExt = (p) => (
  <S {...p}>
    <path d="M4 19l5-7 4 4" />
    <path d="M13 7h7M13 11h7M13 15h7" strokeWidth="1.3" />
    <Dot cx="4" cy="19" />
    <Dot cx="9" cy="12" />
    <Dot cx="13" cy="16" />
  </S>
);

// فیبوی ۳نقطه: زیگزاگِ A-B-C با خطوطِ تراز.
const Fib3 = (p) => (
  <S {...p}>
    <path d="M4 18l5-9 5 6 6-8" strokeWidth="1.3" />
    <path d="M6 14h14M6 11h14" strokeWidth="1.2" opacity="0.85" />
    <Dot cx="4" cy="18" />
    <Dot cx="9" cy="9" />
    <Dot cx="14" cy="15" />
  </S>
);

// بادبزنِ فیبو: پرتوها از یک گوشه روی یک کادر باز می‌شوند.
const FibFan = (p) => (
  <S {...p}>
    <path d="M4 20h16M4 20V5" opacity="0.7" />
    <path d="M4 20L20 5M4 20l16 4M4 20L8 4" />
  </S>
);

// زمانیِ فیبو: خطوطِ عمودی با فاصله‌گذاریِ فیبوناچی.
const FibTime = (p) => (
  <S {...p}>
    <path d="M4 4v16M6 4v16M9 4v16M14 4v16M21 4v16" />
  </S>
);

// زمانیِ روندی: خطوطِ زمانیِ فیبو که از یک پایهٔ ۳نقطه پرتاب می‌شوند.
const FibTimeExt = (p) => (
  <S {...p}>
    <path d="M4 18l4-4 4 3" strokeWidth="1.3" />
    <path d="M12 4v16M15 4v16M20 4v16" />
    <Dot cx="4" cy="18" />
    <Dot cx="8" cy="14" />
    <Dot cx="12" cy="17" />
  </S>
);

// کانالِ فیبو: کانالِ موازی با خطوطِ فیبوی درونی.
const FibChannel = (p) => (
  <S {...p}>
    <path d="M4 18L18 6" />
    <path d="M8 21L22 9" />
    <path d="M5.3 19.3L19.3 7.3M6.7 20.7L20.7 8.7" strokeWidth="1.1" opacity="0.8" />
  </S>
);

// دایره‌های فیبو: حلقه‌های هم‌مرکز از یک نقطهٔ مرکزی.
const FibCircles = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="8" opacity="0.8" />
    <Dot cx="12" cy="12" />
  </S>
);

// کمان‌های فیبو: کمان‌های هم‌مرکزِ نیم‌دایره روی یک خطِ پایه.
const FibArcs = (p) => (
  <S {...p}>
    <path d="M3 18h18" opacity="0.7" />
    <path d="M5 18a7 7 0 0114 0" />
    <path d="M8 18a4 4 0 018 0" opacity="0.85" />
    <Dot cx="12" cy="18" />
  </S>
);

/* ─── gann ─────────────────────────────────────────────────────────────── */

// جعبهٔ گان: مربعِ شبکه‌بندی‌شده + قطر.
const GannBox = (p) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <path d="M12 4v16M4 12h16" strokeWidth="1.1" opacity="0.7" />
    <path d="M4 20L20 4" />
  </S>
);

// بادبزنِ گان: پرتوها از یک گوشه با زوایای گان.
const GannFan = (p) => (
  <S {...p}>
    <path d="M4 20h16M4 20V4" opacity="0.7" />
    <path d="M4 20L20 4M4 20l16 8M4 20l8 -16" strokeWidth="1.2" />
  </S>
);

/* ─── patterns ─────────────────────────────────────────────────────────── */

// XABCD: زیگزاگِ ۵نقطه‌ای.
const Xabcd = (p) => (
  <S {...p}>
    <path d="M3 6l4 12 4-8 4 9 6-13" strokeWidth="1.3" />
    <Dot cx="3" cy="6" />
    <Dot cx="7" cy="18" />
    <Dot cx="11" cy="10" />
    <Dot cx="15" cy="19" />
    <Dot cx="21" cy="6" />
  </S>
);

// ABCD: زیگزاگِ ۴نقطه‌ای.
const Abcd = (p) => (
  <S {...p}>
    <path d="M4 8l5 10 5-8 6 9" strokeWidth="1.3" />
    <Dot cx="4" cy="8" />
    <Dot cx="9" cy="18" />
    <Dot cx="14" cy="10" />
    <Dot cx="20" cy="19" />
  </S>
);

// سایفر: هارمونیکِ ۵نقطه‌ای با خطوطِ متقاطع.
const Cypher = (p) => (
  <S {...p}>
    <path d="M4 18l5-12 4 9 3-6 4 7" strokeWidth="1.2" />
    <path d="M4 18l12-3M9 6l8 9" strokeWidth="1" opacity="0.75" />
    <Dot cx="4" cy="18" />
    <Dot cx="9" cy="6" />
    <Dot cx="20" cy="16" />
  </S>
);

// مثلثِ الگو: مثلث از ۳ نقطه.
const TriPattern = (p) => (
  <S {...p}>
    <path d="M4 19l8-13 8 13z" />
    <Dot cx="4" cy="19" />
    <Dot cx="12" cy="6" />
    <Dot cx="20" cy="19" />
  </S>
);

// سر و شانه: نمایِ سه قله (کوچک-بزرگ-کوچک).
const Hns = (p) => (
  <S {...p}>
    <path d="M3 18l3-4 3 4 3-9 3 9 3-4 3 4" strokeWidth="1.3" />
    <path d="M5 18h14" strokeWidth="1" opacity="0.6" strokeDasharray="2 2" />
  </S>
);

// ایمپالسِ الیوت: زیگزاگِ ۵موجِ صعودی.
const EllImpulse = (p) => (
  <S {...p}>
    <path d="M3 20l3-5 4 2 4-7 3 3 4-9" strokeWidth="1.3" />
    <Dot cx="3" cy="20" />
    <Dot cx="21" cy="4" />
  </S>
);

// اصلاحیِ الیوت: زیگزاگِ ۳موجی (A-B-C).
const EllAbc = (p) => (
  <S {...p}>
    <path d="M4 6l5 9 5-5 6 8" strokeWidth="1.3" />
    <Dot cx="4" cy="6" />
    <Dot cx="9" cy="15" />
    <Dot cx="14" cy="10" />
    <Dot cx="20" cy="18" />
  </S>
);

// مثلث: خطوطِ بیرونیِ ساده.
const Triangle = (p) => (
  <S {...p}>
    <path d="M4 19l8-14 8 14z" />
  </S>
);

/* ─── projection ───────────────────────────────────────────────────────── */

// لانگ/شورت: جعبهٔ هدفِ پشته‌ای؛ ناحیهٔ بالا سبز / پایین قرمز، تقسیم با خطِ ورود.
const LongShort = (p) => (
  <S {...p}>
    <rect x="5" y="4" width="14" height="7" rx="1" />
    <rect x="5" y="13" width="14" height="7" rx="1" />
    <path d="M3 12h18" strokeWidth="1.8" />
  </S>
);

// بازهٔ قیمت: فلشِ دوسرِ عمودی میانِ دو افقی.
const PriceRange = (p) => (
  <S {...p}>
    <path d="M5 5h14M5 19h14" opacity="0.8" />
    <path d="M12 7v10" />
    <path d="M9 9l3-2 3 2M9 15l3 2 3-2" />
  </S>
);

// بازهٔ زمان: فلشِ دوسرِ افقی میانِ دو عمودی.
const DateRange = (p) => (
  <S {...p}>
    <path d="M5 5v14M19 5v14" opacity="0.8" />
    <path d="M7 12h10" />
    <path d="M9 9l-2 3 2 3M15 9l2 3-2 3" />
  </S>
);

// قیمت و زمان: کادر با فلش‌های دوسرِ عمودی و افقی.
const DpRange = (p) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1" opacity="0.8" />
    <path d="M12 7v10M12 7l-2 2M12 7l2 2M12 17l-2-2M12 17l2-2" strokeWidth="1.2" />
    <path d="M7 12h10M7 12l2-2M7 12l2 2M17 12l-2-2M17 12l-2 2" strokeWidth="1.2" />
  </S>
);

// پیش‌بینی: خطِ پُر که با خطِ نقطه‌چین به بالا-راست پرتاب می‌شود.
const Forecast = (p) => (
  <S {...p}>
    <path d="M3 17l6-4" />
    <path d="M9 13l5 5 7-12" strokeDasharray="3 2.5" />
    <Dot cx="9" cy="13" />
  </S>
);

// خط‌کش: خط‌کش با تیک‌های اندازه‌گیری.
const Ruler = (p) => (
  <S {...p}>
    <rect x="3" y="8" width="18" height="8" rx="1" transform="rotate(0 12 12)" />
    <path d="M7 8v3M11 8v4M15 8v3M19 8v4" strokeWidth="1.1" />
  </S>
);

// خطوطِ دوره‌ای: خطوطِ عمودیِ هم‌فاصله زیرِ اشاره‌ای از موجِ سینوسی.
const Cyclic = (p) => (
  <S {...p}>
    <path d="M3 8q4.5 -5 9 0t9 0" opacity="0.8" />
    <path d="M5 11v9M11 11v9M17 11v9" strokeWidth="1.2" />
  </S>
);

// خطِ سینوسی: موجِ سینوس.
const Sine = (p) => (
  <S {...p}>
    <path d="M3 12q3 -7 6 0t6 0t6 0" />
  </S>
);

/* ─── shapes ───────────────────────────────────────────────────────────── */

// مستطیل.
const Rect = (p) => (
  <S {...p}>
    <rect x="4" y="6" width="16" height="12" rx="1" />
  </S>
);

// مستطیلِ چرخیده/کج.
const RotRect = (p) => (
  <S {...p}>
    <path d="M3 9l8-4 10 6-8 4z" />
  </S>
);

// دایره.
const Circle = (p) => (
  <S {...p}>
    <circle cx="12" cy="12" r="8" />
  </S>
);

// بیضی.
const Ellipse = (p) => (
  <S {...p}>
    <ellipse cx="12" cy="12" rx="9" ry="6" />
  </S>
);

// پیکانِ مستقیمِ پررنگ.
const Arrow = (p) => (
  <S {...p}>
    <path d="M4 20L20 4" />
    <path d="M11 4h9v9" />
  </S>
);

// قلم‌موی آزاد: یک خط‌خطیِ دست‌آزاد.
const Brush = (p) => (
  <S {...p}>
    <path d="M3 16c3 0 3-7 6-7s2 8 5 8 4-9 7-9" />
  </S>
);

// های‌لایتر: خط‌خطیِ ضخیمِ نیم‌شفاف با نوکِ ماژیک.
const Highlighter = (p) => (
  <S {...p}>
    <path d="M4 17c3 1 4-5 7-4s2 6 5 5" strokeWidth="3" opacity="0.45" strokeLinecap="round" />
    <path d="M14 7l4 4-9 9-4-4z" strokeWidth="1.4" fill="none" />
  </S>
);

/* ─── annotations ──────────────────────────────────────────────────────── */

// متن: حروفِ «T».
const Text = (p) => (
  <S {...p}>
    <path d="M5 6h14" />
    <path d="M12 6v13" />
  </S>
);

// کال‌اوت: حبابِ گفتگو با خطِ راهنما.
const Callout = (p) => (
  <S {...p}>
    <rect x="4" y="4" width="14" height="10" rx="2" />
    <path d="M9 14l-2 5 5-5" />
    <path d="M7 8h8M7 11h5" strokeWidth="1.1" opacity="0.8" />
  </S>
);

// برچسبِ قیمت: تگ که به چپ اشاره می‌کند با تیکِ قیمت.
const PriceLabel = (p) => (
  <S {...p}>
    <path d="M3 12h4" />
    <path d="M7 8l3-1h9a1 1 0 011 1v8a1 1 0 01-1 1h-9l-3-1z" />
    <path d="M12 11h5" strokeWidth="1.1" opacity="0.8" />
  </S>
);

// یادداشت: یک کاغذِ یادداشتِ کوچک با خطوط.
const Note = (p) => (
  <S {...p}>
    <path d="M5 4h14v11l-4 5H5z" />
    <path d="M15 20v-5h4" />
    <path d="M8 8h8M8 11h6" strokeWidth="1.1" opacity="0.8" />
  </S>
);

// پیکانِ جهت‌دار: پیکانِ کوتاه و چاق.
const ArrowDir = (p) => (
  <S {...p}>
    <path d="M4 12h11" strokeWidth="2.2" />
    <path d="M13 7l6 5-6 5" strokeWidth="2.2" />
  </S>
);

/* ─── group glyphs ─────────────────────────────────────────────────────── */

const GCursors = Cursor;
const GLines = (p) => (
  <S {...p}>
    <path d="M4 18L18 6" />
    <Dot cx="4" cy="18" />
    <Dot cx="18" cy="6" />
  </S>
);
const GChannels = Channel;
const GFib = Fib;
const GGann = GannFan;
const GPatterns = (p) => (
  <S {...p}>
    <path d="M3 18l4 -9 4 7 4 -11 6 14" strokeWidth="1.3" />
  </S>
);
const GProjection = Ruler;
const GShapes = (p) => (
  <S {...p}>
    <rect x="4" y="7" width="10" height="10" rx="1" />
    <circle cx="16" cy="14" r="5" />
  </S>
);
const GAnnotations = Text;

/* ─── exports ──────────────────────────────────────────────────────────── */

export const GLYPH = {
  // cursors
  cursor: Cursor, select: Select,
  // lines
  trend: Trend, ray: Ray, extline: ExtLine, hray: HRay, hline: HLine,
  vline: VLine, crossline: CrossLine, angle: Angle, infoline: InfoLine,
  // channels
  channel: Channel, pitchfork: Pitchfork,
  // fib
  fib: Fib, fibext: FibExt, fib3: Fib3, fibfan: FibFan, fibtime: FibTime,
  fibtimeext: FibTimeExt, fibchannel: FibChannel, fibcircles: FibCircles, fibarcs: FibArcs,
  // gann
  gannbox: GannBox, gannfan: GannFan,
  // patterns
  xabcd: Xabcd, abcd: Abcd, cypher: Cypher, tripattern: TriPattern, hns: Hns,
  ell_impulse: EllImpulse, ell_abc: EllAbc, triangle: Triangle,
  // projection
  longshort: LongShort, pricerange: PriceRange, daterange: DateRange, dprange: DpRange,
  forecast: Forecast, ruler: Ruler, cyclic: Cyclic, sine: Sine,
  // shapes
  rect: Rect, rotrect: RotRect, circle: Circle, ellipse: Ellipse,
  arrow: Arrow, brush: Brush, highlighter: Highlighter,
  // annotations
  text: Text, callout: Callout, pricelabel: PriceLabel, note: Note, arrowdir: ArrowDir,
};

export const GROUP_GLYPH = {
  cursors: GCursors,
  lines: GLines,
  channels: GChannels,
  fib: GFib,
  gann: GGann,
  patterns: GPatterns,
  projection: GProjection,
  shapes: GShapes,
  annotations: GAnnotations,
};

export default GLYPH;
