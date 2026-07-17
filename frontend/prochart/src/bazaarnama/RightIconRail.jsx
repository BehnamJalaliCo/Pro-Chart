// بازارنما — ریلِ عمودیِ آیکونِ سمتِ راست (پنل‌سوییچرِ سبکِ TradingView).
// ─────────────────────────────────────────────────────────────────────────────
// موارد ۸۴–۹۰ از TV-PARITY-AUDIT: در TradingView سمتِ راستِ صفحه یک نوارِ باریکِ
// عمودیِ آیکون است که بینِ پنل‌های سمتِ راست سوییچ می‌کند (Watchlist / Alerts /
// Calendar / News / Screener / Ideas). این کامپوننت دقیقاً همان ریل است: باریک
// (~۴۰px)، آیکونِ ۲۰px، اکتیوِ tinted (accent با شفافیت، نه پُرکردنِ سخت)،
// تولتیپِ فارسیِ سمتِ چپ‌بازشونده، RTL.
//
// این فایل «ارائه‌ایِ خالص» است: هیچ stateِ سراسری/سروری نمی‌خواند و هیچ صرافی/
// بروکر/importِ npmِ جدیدی اضافه نمی‌کند. فقط lucide-react (که همین‌الان در پروژه
// هست) و React. کلیکِ هر آیکون → onSelect(key) با کلیدی که دقیقاً متناظرِ کلیدهای
// rightTab در صفحهٔ BazaarNama است (watch/alerts/cal/news/screener/ai)، پس والد
// می‌تواند مستقیماً setRightTab(key) + نمایشِ پنلِ راست را صدا بزند.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useCallback } from 'react';
import { Star, BellRing, CalendarDays, Newspaper, ScanLine, Lightbulb } from './tvIcons';

// آیتم‌های ریل. key دقیقاً متناظرِ کلیدهای rightTab (TABS در RightPanel.jsx) است تا
// onSelect(key) بدونِ نگاشتِ اضافی به setRightTab وصل شود.
//   watch=واچ‌لیست · alerts=آلارم · cal=تقویم · news=اخبار · screener=اسکنر · ai=ایده‌ها
// گروه‌بندیِ سبکِ TradingView: پنل‌های «اطلاعات/پایش» بالا (واچ‌لیست، آلارم) و ابزارها/کاوش پایین
// (اسکنر، تقویم، اخبار، ایده‌ها) با فاصلهٔ منعطف بینشان — دقیقاً مثلِ ریلِ راستِ TV که بالا/پایین جدا دارد.
const ITEMS_TOP = [
  { key: 'watch',    label: 'واچ‌لیست', Icon: Star },
  { key: 'alerts',   label: 'آلارم‌ها', Icon: BellRing },
];
const ITEMS_BOTTOM = [
  { key: 'screener', label: 'اسکنر', Icon: ScanLine },
  { key: 'cal',      label: 'تقویمِ اقتصادی', Icon: CalendarDays },
  { key: 'news',     label: 'اخبار', Icon: Newspaper },
  { key: 'ai',       label: 'ایده‌ها و سیگنال', Icon: Lightbulb },
];
const ITEMS = [...ITEMS_TOP, ...ITEMS_BOTTOM]; // برای lookupِ تولتیپ

// هکسِ توکنِ تم → rgba با شفافیتِ دلخواه (بدونِ hard-code؛ از TH.accent مشتق می‌شود).
// اگر رشته rgb/rgba بود دست‌نخورده برمی‌گردد؛ فقطِ #RGB/#RRGGBB را می‌شناسد.
function tint(color, alpha) {
  if (typeof color !== 'string') return `rgba(41,98,255,${alpha})`;
  const h = color.trim();
  if (h[0] !== '#') return h; // از قبل rgb/rgba یا نامِ رنگ — بگذار عبور کند
  let s = h.slice(1);
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  if (!Number.isFinite(n)) return `rgba(41,98,255,${alpha})`;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// امضا: RightIconRail({ active, onSelect, TH })
//   active   — کلیدِ تبِ فعالِ کنونی (همان rightTab). اگر پنلِ راست بسته باشد null/'' بده.
//   onSelect — (key: string) => void ؛ کلیکِ روی آیکون این را با کلیدِ آیتم صدا می‌زند.
//   TH       — توکن‌های تم (accent, text, textStrong, border, bg, chipBgHover, popoverBg…).
export default function RightIconRail({ active, onSelect, TH, badges = {} }) {
  // تولتیپِ فعال: { key, top } — top مرکزِ عمودیِ دکمهٔ اشاره‌شده برای هم‌ترازی.
  const [tip, setTip] = useState(null);

  // اکتیوِ TV = پس‌زمینهٔ گِردِ tinted (نه پُر). alpha کمی محسوس تا مثلِ مربعِ فعالِ TV
  // به‌وضوح خوانده شود، ولی همچنان شفاف/برندِ accent (نه fillِ سخت).
  const accentTint = tint(TH.accent, 0.16);

  const showTip = useCallback((e, key) => {
    const r = e.currentTarget.getBoundingClientRect();
    const pr = e.currentTarget.offsetParent
      ? e.currentTarget.offsetParent.getBoundingClientRect()
      : { top: 0 };
    setTip({ key, top: r.top - pr.top + r.height / 2 });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);

  const tipItem = tip ? ITEMS.find((it) => it.key === tip.key) : null;

  return (
    <div
      dir="rtl"
      role="tablist"
      aria-orientation="vertical"
      className="relative shrink-0 flex flex-col items-center gap-0.5 py-1.5 border-l select-none h-full"
      style={{ width: 40, borderColor: TH.border, background: TH.bg }}
    >
      {/* کیفریمِ محلیِ تولتیپ — نامِ یکتا تا با brn-tip-in در ToolRail تداخل نکند. */}
      <style>{`@keyframes brn-rtip-in{from{opacity:0;transform:translate(-4px,-50%)}to{opacity:1;transform:translate(0,-50%)}}`}</style>

      {[ITEMS_TOP, ITEMS_BOTTOM].map((group, gi) => (
        <React.Fragment key={gi}>
          {/* فاصلهٔ منعطف بینِ دو گروه — گروهِ دوم را به پایینِ ریل می‌چسباند (سبکِ TV) */}
          {gi === 1 && <div className="flex-1 min-h-[8px]" aria-hidden="true" />}
          {group.map(({ key, label, Icon }) => {
            const on = active === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={label}
                title={label}
                onClick={() => onSelect && onSelect(key)}
                onMouseEnter={(e) => { showTip(e, key); if (!on) e.currentTarget.style.background = TH.chipBgHover; }}
                onMouseLeave={(e) => { hideTip(); if (!on) e.currentTarget.style.background = 'transparent'; }}
                onFocus={(e) => showTip(e, key)}
                onBlur={hideTip}
                className="relative flex items-center justify-center rounded-lg outline-none focus-visible:ring-1"
                style={{
                  width: 32,
                  height: 32,
                  background: on ? accentTint : 'transparent',
                  color: on ? TH.accent : TH.text,
                  transition: 'background-color 120ms ease, color 120ms ease',
                }}
              >
                {/* ریلِ پنل‌سوییچرِ راستِ TV اکتیو را فقط با مربعِ گِردِ tinted نشان می‌دهد
                    (برخلافِ ریلِ ابزارِ چپ، هیچ پیلِ لبه‌ای ندارد) — پس فقط بک‌گراند + رنگ. */}
                <Icon size={20} strokeWidth={on ? 2.1 : 1.8} />
                {/* بَجِ شمارش (مثلِ شمارندهٔ آلارمِ ریلِ راستِ TV) — فقط وقتی count>0 */}
                {badges[key] > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-[3px] rounded-full text-[9px] font-bold leading-none flex items-center justify-center tabular-nums" style={{ background: TH.down, color: '#fff' }}>{badges[key] > 9 ? '9+' : badges[key]}</span>
                )}
              </button>
            );
          })}
        </React.Fragment>
      ))}

      {/* تولتیپِ فارسیِ چپ‌بازشونده — پیلِ راست‌ایستا، Y هم‌ترازِ مرکزِ دکمه. */}
      {tipItem && (
        <div
          dir="rtl"
          className="absolute right-full mr-2 z-[60] pointer-events-none flex items-center rounded-md px-2 py-1 whitespace-nowrap"
          style={{
            top: tip.top,
            transform: 'translateY(-50%)',
            background: TH.popoverBg,
            border: `1px solid ${TH.border}`,
            boxShadow: 'var(--pc-shadow-pop)',
            animation: 'brn-rtip-in 90ms ease-out both',
          }}
        >
          <span className="text-[11px] leading-none font-medium" style={{ color: TH.textStrong }}>
            {tipItem.label}
          </span>
        </div>
      )}
    </div>
  );
}
