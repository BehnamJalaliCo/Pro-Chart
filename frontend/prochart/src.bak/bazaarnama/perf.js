// بازارنما — ابزارهای کارایی (فصل ۱۱ §11.2).
// ─────────────────────────────────────────────────────────────────────────────
// چهار کمک‌کار سبک و بدون‌وابستگی برای روان نگه‌داشتنِ چارت با رشدِ دیتاست و روی موبایل:
//   • rafThrottle  — کوئلسِ رویدادهای پرتکرار (حرکتِ کراس‌هیر، resize، اسکرولِ بازه) در
//                    یک requestAnimationFrame تا رندرهای سنگین (DrawingLayer، Volume Profile)
//                    به‌جای چند بار در هر فریم، فقط یک بار در هر فریم اجرا شوند (§11.2.2/§11.2.4).
//   • debounce     — به‌تعویق‌انداختنِ کارِ سنگین تا آرام‌شدنِ رویداد (مثلِ ذخیرهٔ میزِکار،
//                    محاسبهٔ مجددِ اندیکاتور پس از پایانِ resize).
//   • sizeCanvas   — سایزدهیِ صحیحِ بومِ canvas با احتسابِ devicePixelRatio تا خطوطِ ترسیم
//                    روی صفحه‌های رتینا/موبایل تیز بمانند و تار نشوند.
//   • onVisibility — توقفِ کار وقتی تب پنهان است یا مرورگر بی‌کار (idle)؛ تا حلقه‌های
//                    انیمیشن/پولینگ روی تبِ پس‌زمینه باتری و CPU نسوزانند.
// همگی پیورِ JS و درون‌مرورگری امن (محافظت در برابر SSR / نبودِ window).
// ─────────────────────────────────────────────────────────────────────────────

const hasWindow = typeof window !== 'undefined';
const _raf = hasWindow && window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : (cb) => setTimeout(() => cb(Date.now()), 16);
const _caf = hasWindow && window.cancelAnimationFrame
  ? window.cancelAnimationFrame.bind(window)
  : clearTimeout;

/**
 * rafThrottle — تابعِ fn را چنان می‌پیچد که در هر فریمِ نمایش حداکثر یک‌بار اجرا شود.
 * فراخوانی‌های مکرر بین دو فریم، فقط آخرین آرگومان‌ها را نگه می‌دارند (کوئلس).
 * مناسب برای: subscribeCrosshairMove، ResizeObserver، subscribeVisibleLogicalRangeChange.
 * خروجی یک متدِ .cancel() هم دارد تا در cleanup فریمِ معلق لغو شود.
 *
 * @param {(...args:any[])=>void} fn تابعِ سنگین (مثلِ dl.render)
 * @returns {((...args:any[])=>void) & { cancel: ()=>void }}
 */
export function rafThrottle(fn) {
  let frame = 0;        // شناسهٔ فریمِ معلق (۰ = هیچ)
  let lastArgs = null;  // آخرین آرگومان‌ها برای اجرا در فریمِ بعد

  const wrapped = function (...args) {
    lastArgs = args;
    if (frame) return; // فریمی در صف است؛ فقط آرگومان‌ها به‌روز شد
    frame = _raf(() => {
      frame = 0;
      const a = lastArgs; lastArgs = null;
      try { fn.apply(this, a); } catch (e) { /* رندرِ یک فریم نباید کلِ حلقه را بشکند */ }
    });
  };

  wrapped.cancel = () => { if (frame) { _caf(frame); frame = 0; } lastArgs = null; };
  return wrapped;
}

/**
 * debounce — اجرای fn را تا گذشتِ wait میلی‌ثانیه از آخرین فراخوانی به‌تعویق می‌اندازد.
 * با leading=true یک‌بار در ابتدای رگبار هم اجرا می‌شود.
 * مناسب برای: ذخیرهٔ میزِکار، resizeِ نهایی، جست‌وجوی نماد.
 *
 * @param {(...args:any[])=>void} fn
 * @param {number} wait میلی‌ثانیه
 * @param {{leading?:boolean}} [opts]
 * @returns {((...args:any[])=>void) & { cancel: ()=>void, flush: ()=>void }}
 */
export function debounce(fn, wait = 150, { leading = false } = {}) {
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  const run = () => {
    timer = null;
    const a = lastArgs, t = lastThis; lastArgs = lastThis = null;
    if (a) fn.apply(t, a);
  };

  const wrapped = function (...args) {
    lastArgs = args; lastThis = this;
    const callNow = leading && !timer;
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, wait);
    if (callNow) { const a = lastArgs; lastArgs = lastThis = null; fn.apply(this, a); }
  };

  wrapped.cancel = () => { if (timer) { clearTimeout(timer); timer = null; } lastArgs = lastThis = null; };
  wrapped.flush = () => { if (timer) { clearTimeout(timer); run(); } };
  return wrapped;
}

/**
 * dpr — نسبتِ پیکسلِ دستگاه با کرانِ امن. روی مانیتورهای 4K/موبایل >1 است.
 * @returns {number}
 */
export function dpr() {
  if (!hasWindow) return 1;
  const r = window.devicePixelRatio || 1;
  // محدودسازی به ۳ تا روی صفحه‌های فوق‌رتینا حافظهٔ بوم بی‌رویه نشود
  return Math.max(1, Math.min(3, r));
}

/**
 * sizeCanvas — بومِ canvas را با احتسابِ devicePixelRatio به‌درستی سایز می‌دهد:
 * بافرِ بوم را به پیکسل‌های واقعیِ دستگاه می‌برد، عرض/ارتفاعِ CSS را در همان اندازهٔ منطقی
 * نگه می‌دارد، و context را با ratio مقیاس می‌کند تا ترسیم‌ها در مختصاتِ CSS تیز بمانند.
 * اگر چیزی تغییر نکرده باشد زودبازمی‌گردد (پرهیز از پاک‌شدنِ بیهودهٔ بوم).
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} cssW عرضِ منطقی (px منطقی، معمولاً clientWidth)
 * @param {number} cssH ارتفاعِ منطقی
 * @param {{ratio?:number, resetTransform?:boolean}} [opts]
 * @returns {{ratio:number, changed:boolean, ctx:CanvasRenderingContext2D|null}}
 */
export function sizeCanvas(canvas, cssW, cssH, { ratio, resetTransform = true } = {}) {
  if (!canvas || !cssW || !cssH) return { ratio: 1, changed: false, ctx: null };
  const r = ratio || dpr();
  const pw = Math.round(cssW * r);
  const ph = Math.round(cssH * r);
  let changed = false;
  if (canvas.width !== pw) { canvas.width = pw; changed = true; }
  if (canvas.height !== ph) { canvas.height = ph; changed = true; }
  // اندازهٔ نمایشیِ CSS را منطقی نگه‌دار (مستقل از بافرِ پیکسلی)
  if (canvas.style) {
    const wPx = `${cssW}px`, hPx = `${cssH}px`;
    if (canvas.style.width !== wPx) { canvas.style.width = wPx; changed = true; }
    if (canvas.style.height !== hPx) { canvas.style.height = hPx; changed = true; }
  }
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (ctx && resetTransform) {
    // ترسیم در مختصاتِ CSS؛ context با ratio مقیاس می‌شود
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  return { ratio: r, changed, ctx };
}

/**
 * onVisibility — وقتی تب پنهان/نمایان می‌شود کال‌بک را صدا می‌زند؛ برای مکثِ حلقه‌های
 * انیمیشن (easing قیمتِ زنده) و کاهشِ پولینگ روی تبِ پس‌زمینه (§11.1.2 «freeze when closed»).
 * بلافاصله یک‌بار با وضعیتِ فعلی هم فراخوانی می‌کند.
 *
 * @param {(hidden:boolean)=>void} cb
 * @returns {()=>void} تابعِ پاک‌سازی (برای cleanupِ useEffect)
 */
export function onVisibility(cb) {
  if (!hasWindow || typeof document === 'undefined') return () => {};
  const handler = () => { try { cb(document.hidden === true); } catch (e) {} };
  document.addEventListener('visibilitychange', handler);
  handler(); // وضعیتِ اولیه
  return () => document.removeEventListener('visibilitychange', handler);
}

/**
 * whenIdle — اجرای کارِ غیربحرانی در زمانِ بی‌کاریِ مرورگر (requestIdleCallback) با
 * fallback به setTimeout. خروجی یک تابعِ لغو می‌دهد. مناسب برای پیش‌محاسبه یا
 * گرم‌کردنِ کش بدونِ خفه‌کردنِ فریمِ تعاملی.
 *
 * @param {()=>void} fn
 * @param {number} [timeout] حداکثر تأخیر تا اجبار به اجرا (ms)
 * @returns {()=>void} لغو
 */
export function whenIdle(fn, timeout = 1000) {
  if (!hasWindow) { return () => {}; }
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => { try { fn(); } catch (e) {} }, { timeout });
    return () => { try { window.cancelIdleCallback(id); } catch (e) {} };
  }
  const id = setTimeout(() => { try { fn(); } catch (e) {} }, Math.min(timeout, 200));
  return () => clearTimeout(id);
}

export default { rafThrottle, debounce, dpr, sizeCanvas, onVisibility, whenIdle };
