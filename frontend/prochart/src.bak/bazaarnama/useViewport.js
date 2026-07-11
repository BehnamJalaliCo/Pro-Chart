// بازارنما — هوکِ تشخیصِ خودکارِ ویوپورت (ریسپانسیوِ جامع).
// ─────────────────────────────────────────────────────────────────────────────
// useViewport() اندازهٔ زندهٔ پنجره را می‌دهد و آن را به یک «کلاسِ دستگاهِ» استاندارد
// نگاشت می‌کند تا چیدمان فوری به حالتِ متناظر سوییچ شود. هم width، هم height، هم
// orientation در نظر گرفته می‌شوند تا تبلتِ landscapeِ کم‌ارتفاع هم درست تشخیص داده شود.
//
// کلاس‌های دستگاه (deviceClass):
//   'phone'         گوشیِ پرتره            width < 480
//   'phoneLand'     گوشیِ لنداسکیپ/تبلتِ کوچک  480 ≤ width < 768  (اغلب landscapeِ کم‌ارتفاع)
//   'tablet'        تبلتِ پرتره             768 ≤ width < 1024
//   'tabletLand'    تبلتِ لنداسکیپ/دسکتاپِ کوچک 1024 ≤ width < 1280
//   'desktop'       دسکتاپ                 width ≥ 1280
//
// پرچم‌های کمکی:
//   isPhone     = phone | phoneLand
//   isTablet    = tablet | tabletLand
//   isDesktop   = desktop
//   compact     = هر چیزی که چیدمانِ فشرده می‌خواهد (هرچیز جز desktop) → تولبارِ آیکونی + شیت‌ها
//   isLandscape = width > height
//   isShort     = height < 560  (لنداسکیپِ کم‌ارتفاع → پنل‌ها باید overlay شوند نه ستونی)
//   coarse      = نشانگرِ لمسی (pointer: coarse)
//
// آپدیتِ فوری با resize/orientationchange، با throttle سبکِ rAF (بدونِ jank).
// SSR-safe: اگر window نبود، یک پیش‌فرضِ desktop می‌دهد.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';

// مرزهای استانداردِ کلاسِ دستگاه (px). هم‌راستا با BREAKPOINTS در mobile.jsx.
export const VP = { phone: 480, tablet: 768, tabletLand: 1024, desktop: 1280 };
// ارتفاعی که زیرِ آن، لنداسکیپ «کوتاه» محسوب می‌شود (تبلت/گوشیِ خوابیده).
export const SHORT_H = 560;

const hasWindow = typeof window !== 'undefined';

function classify(w, h) {
  let deviceClass = 'desktop';
  if (w < VP.phone) deviceClass = 'phone';
  else if (w < VP.tablet) deviceClass = 'phoneLand';
  else if (w < VP.tabletLand) deviceClass = 'tablet';
  else if (w < VP.desktop) deviceClass = 'tabletLand';
  else deviceClass = 'desktop';

  const isPhone = deviceClass === 'phone' || deviceClass === 'phoneLand';
  const isTablet = deviceClass === 'tablet' || deviceClass === 'tabletLand';
  const isDesktop = deviceClass === 'desktop';
  const isLandscape = w >= h;
  const isShort = h < SHORT_H;
  const coarse = hasWindow && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches : false;

  return {
    width: w,
    height: h,
    deviceClass,
    isPhone,
    isTablet,
    isDesktop,
    // چیدمانِ فشرده برای هرچیزی که دسکتاپِ تمام‌عرض نیست؛ یا لنداسکیپِ کوتاه (حتی اگر عریض)
    // تا تبلتِ خوابیدهٔ کم‌ارتفاع، تولبارِ آیکونی + شیت بگیرد و چیزی روی چارت نیفتد.
    compact: !isDesktop || (isLandscape && isShort && w < 1366),
    isLandscape,
    isShort,
    orientation: isLandscape ? 'landscape' : 'portrait',
    coarse,
  };
}

function read() {
  if (!hasWindow) return classify(1440, 900);
  return classify(window.innerWidth, window.innerHeight);
}

/**
 * useViewport — وضعیتِ زندهٔ ویوپورت + کلاسِ دستگاه. با resize/چرخش فوری (rAF-throttled) آپدیت می‌شود.
 * @returns {{width:number,height:number,deviceClass:'phone'|'phoneLand'|'tablet'|'tabletLand'|'desktop',
 *   isPhone:boolean,isTablet:boolean,isDesktop:boolean,compact:boolean,isLandscape:boolean,
 *   isShort:boolean,orientation:'landscape'|'portrait',coarse:boolean}}
 */
export function useViewport() {
  const [vp, setVp] = useState(read);
  const frame = useRef(0);

  useEffect(() => {
    if (!hasWindow) return undefined;
    const apply = () => {
      frame.current = 0;
      setVp((prev) => {
        const next = read();
        // فقط وقتی چیزی واقعاً تغییر کرد re-render کن (جلوگیری از رندرِ بی‌مورد در رگبارِ resize)
        if (next.width === prev.width && next.height === prev.height
          && next.deviceClass === prev.deviceClass && next.compact === prev.compact
          && next.orientation === prev.orientation && next.coarse === prev.coarse) return prev;
        return next;
      });
    };
    const onResize = () => {
      if (frame.current) return; // کوئلسِ رگبارِ resize در یک فریم
      frame.current = window.requestAnimationFrame(apply);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    // پشتیبانیِ matchMedia برای تغییرِ نشانگرِ لمسی/چگالی (اختیاری، بدونِ خطا اگر نبود)
    let mql = null;
    try {
      if (typeof window.matchMedia === 'function') {
        mql = window.matchMedia('(orientation: landscape)');
        if (mql.addEventListener) mql.addEventListener('change', onResize);
        else if (mql.addListener) mql.addListener(onResize);
      }
    } catch (e) { /* noop */ }
    // یک read اولیه بعد از mount (پوششِ اختلافِ SSR/کلاینت)
    onResize();
    return () => {
      if (frame.current) window.cancelAnimationFrame(frame.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      try {
        if (mql) { if (mql.removeEventListener) mql.removeEventListener('change', onResize); else if (mql.removeListener) mql.removeListener(onResize); }
      } catch (e) { /* noop */ }
    };
  }, []);

  return vp;
}

export default useViewport;
