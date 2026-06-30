// بازارنما — کمک‌کارهای موبایل/لمسی (فصل ۱۱ §11.3).
// ─────────────────────────────────────────────────────────────────────────────
// سه چیز را فراهم می‌کند، همگی توکن‌محورِ TH و RTL:
//   • useBreakpoint() — هوکِ ریسپانسیو که نقطه‌شکستِ جاری را به‌صورتِ {name, isMobile,
//                       isTablet, isDesktop, width} برمی‌گرداند. نام‌ها: xl≥1280 / lg≥1024 /
//                       md≥768 / sm<768. مرزِ موبایل = <768 (هم‌راستا با §11.3 و showRight).
//   • MobileToolSheet — یک «بات‌اِم‌شیت» که زیر ۷۶۸px ابزارها/تب‌ها را نمایش می‌دهد؛ از پایینِ
//                       صفحه بالا می‌آید، پس‌زمینهٔ تار/ماسک دارد، با ضربه روی ماسک یا کشیدنِ
//                       دستگیره به پایین بسته می‌شود. هدف‌های لمسی ≥44px (TOUCH).
//   • TouchButton    — دکمهٔ کمکیِ با حداقلِ هدفِ لمسیِ ۴۴px برای استفادهٔ داخلِ شیت.
// هیچ رنگِ هاردکد؛ همه از پراپِ TH (همان آبجکتِ تمِ صفحه). prose فارسی + dir="rtl"؛
// اعداد/تیکرها در صورتِ نیاز dir="ltr" بگیرند (مصرف‌کننده تعیین می‌کند).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';

// نقطه‌شکست‌ها (px). md = مرزِ موبایل/دسکتاپ، هم‌خوان با window.innerWidth>760 صفحه.
export const BREAKPOINTS = { sm: 0, md: 768, lg: 1024, xl: 1280 };
// حداقلِ اندازهٔ هدفِ لمسی (px) طبقِ WCAG / دستورالعملِ §11.3.
export const TOUCH = 44;

const hasWindow = typeof window !== 'undefined';

function computeBp(w) {
  let name = 'sm';
  if (w >= BREAKPOINTS.xl) name = 'xl';
  else if (w >= BREAKPOINTS.lg) name = 'lg';
  else if (w >= BREAKPOINTS.md) name = 'md';
  return {
    name,
    width: w,
    isMobile: w < BREAKPOINTS.md,          // <768 → موبایل
    isTablet: w >= BREAKPOINTS.md && w < BREAKPOINTS.lg, // 768..1023
    isDesktop: w >= BREAKPOINTS.lg,        // ≥1024
    isWide: w >= BREAKPOINTS.xl,           // ≥1280
    coarse: hasWindow && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches : false,
  };
}

/**
 * useBreakpoint — وضعیتِ ریسپانسیوِ زنده. روی resize/چرخش با rAF کوئلس‌شده آپدیت می‌شود.
 * @returns {{name:'xl'|'lg'|'md'|'sm', width:number, isMobile:boolean, isTablet:boolean, isDesktop:boolean, isWide:boolean, coarse:boolean}}
 */
export function useBreakpoint() {
  const [bp, setBp] = useState(() => computeBp(hasWindow ? window.innerWidth : 1280));
  const frame = useRef(0);

  useEffect(() => {
    if (!hasWindow) return undefined;
    const onResize = () => {
      if (frame.current) return; // کوئلسِ رگبارِ resize در یک فریم
      frame.current = window.requestAnimationFrame(() => {
        frame.current = 0;
        setBp((prev) => {
          const next = computeBp(window.innerWidth);
          // فقط وقتی نام یا coarse عوض شد re-render کن (width را هم نگه می‌داریم)
          if (next.name === prev.name && next.coarse === prev.coarse && next.width === prev.width) return prev;
          return next;
        });
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      if (frame.current) window.cancelAnimationFrame(frame.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return bp;
}

/**
 * TouchButton — دکمهٔ با حداقلِ هدفِ لمسیِ ۴۴px، استایلِ TH. برای ردیف‌های داخلِ شیت.
 */
export function TouchButton({ TH, active, onClick, icon, label, dirNum = false, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel || label}
      aria-pressed={active ? 'true' : 'false'}
      className="flex items-center gap-2.5 w-full rounded-lg px-3 transition-colors text-sm"
      style={{
        minHeight: TOUCH,
        color: active ? '#fff' : TH.textStrong,
        background: active ? TH.accent : TH.chipBg,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = TH.chipBgHover; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = TH.chipBg; }}
    >
      {icon ? <span className="shrink-0 flex items-center justify-center" style={{ width: 20 }}>{icon}</span> : null}
      <span className={dirNum ? '' : ''} dir={dirNum ? 'ltr' : undefined}>{label}</span>
    </button>
  );
}

/**
 * MobileToolSheet — بات‌اِم‌شیتِ پایین‌صفحه برای موبایل (<768px).
 * فقط وقتی open=true رندر می‌شود؛ مصرف‌کننده با useBreakpoint().isMobile گِیتش می‌کند.
 * محتوا را به‌صورتِ children می‌گیرد (هر چیزی: ردیف TouchButton، تب‌ها، فهرستِ ابزار).
 *
 * پراپ‌ها:
 *   TH       آبجکتِ تم (الزامی)
 *   open     باز/بسته
 *   onClose  بستن (ماسک، دکمهٔ ✕، کشیدنِ دستگیره به پایین، یا Esc)
 *   title    عنوانِ فارسیِ سربرگ
 *   children محتوای شیت
 *   maxVh    بیشینهٔ ارتفاع به‌صورتِ درصدِ ویوپورت (پیش‌فرض ۷۰)
 */
export function MobileToolSheet({ TH, open, onClose, title, children, maxVh = 70 }) {
  const startY = useRef(null);
  const [dragDy, setDragDy] = useState(0);

  // بستن با Esc + قفلِ اسکرولِ بدنه هنگامِ باز بودن
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // کشیدنِ دستگیره به پایین برای بستن (ژستِ آشنای موبایل)
  const onHandleDown = useCallback((e) => {
    startY.current = e.touches ? e.touches[0].clientY : e.clientY;
  }, []);
  const onHandleMove = useCallback((e) => {
    if (startY.current == null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    setDragDy(Math.max(0, y - startY.current));
  }, []);
  const onHandleUp = useCallback(() => {
    if (dragDy > 80) onClose && onClose(); // کشیدنِ کافی به پایین = بستن
    startY.current = null; setDragDy(0);
  }, [dragDy, onClose]);

  if (!open) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[60] flex flex-col justify-end md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'ابزارها'}
    >
      {/* ماسکِ تار پشتِ شیت */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{ background: TH.overlayMask || 'rgba(0,0,0,.42)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* بدنهٔ شیت */}
      <div
        className="relative rounded-t-2xl border-t shadow-2xl flex flex-col"
        style={{
          background: TH.panel,
          borderColor: TH.border,
          maxHeight: `${maxVh}vh`,
          transform: `translateY(${dragDy}px)`,
          transition: startY.current == null ? 'transform .18s ease' : 'none',
        }}
      >
        {/* دستگیرهٔ کشیدن + سربرگ */}
        <div
          className="shrink-0 px-3 pt-2 pb-1 select-none"
          style={{ touchAction: 'none' }}
          onTouchStart={onHandleDown}
          onTouchMove={onHandleMove}
          onTouchEnd={onHandleUp}
          onPointerDown={onHandleDown}
          onPointerMove={(e) => { if (e.pressure > 0 || e.buttons) onHandleMove(e); }}
          onPointerUp={onHandleUp}
        >
          <div className="mx-auto mb-2 rounded-full" style={{ width: 40, height: 4, background: TH.border }} />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: TH.textStrong }}>{title || 'ابزارها'}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن"
              className="rounded-lg flex items-center justify-center transition-colors"
              style={{ width: TOUCH, height: TOUCH, color: TH.text, background: TH.chipBg }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TH.chipBgHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = TH.chipBg; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* محتوا (اسکرول‌پذیر) */}
        <div className="overflow-y-auto px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 flex flex-col gap-1.5">
          {children}
        </div>
      </div>
    </div>
  );
}

export default { useBreakpoint, MobileToolSheet, TouchButton, BREAKPOINTS, TOUCH };
