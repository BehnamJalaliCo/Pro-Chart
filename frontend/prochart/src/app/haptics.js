// هپتیکِ سبک — از Web Vibration API (در WebViewِ اندروید کار می‌کند، بدونِ پلاگینِ نیتیو).
// روی دستگاه‌های بدونِ لرزش/دسکتاپ بی‌صدا no-op است. مجوزِ VIBRATE در AndroidManifest لازم است.
let _last = 0;
export function haptic(ms = 8) {
  try {
    // throttle تا رگبارِ لرزش پیش نیاید (مثلاً روی درگِ کراس‌هیر)
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    if (now && now - _last < 40) return;
    _last = now;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  } catch (e) { /* noop */ }
}

// شدت‌های نام‌دار برای خوانایی
export const tap = () => haptic(6);        // انتخابِ سبک (تب/تایم‌فریم/ابزار)
export const bump = () => haptic(12);      // تأییدِ متوسط (اجرا/ثبت)
export const success = () => haptic([8, 40, 16]); // موفقیت (سیگنال/سفارش)
