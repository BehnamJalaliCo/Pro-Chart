import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * useResizable — هوکِ کوچکِ تغییرِ اندازه با کشیدنِ دستگیره.
 *
 * یک محورِ واحد (عمودی برای داکِ پایین = ارتفاع، یا افقی برای پنلِ راست = عرض)
 * را مدیریت می‌کند، مقدار را در localStorage پایدار نگه می‌دارد و
 * هندلرهای آماده‌ی pointer را برای اتصال به دستگیره برمی‌گرداند.
 *
 * ورودی‌ها:
 *   storageKey  کلیدِ localStorage برای پایداری (مثل 'bn_dock')
 *   axis        'y' (ارتفاع، پیش‌فرض) | 'x' (عرض)
 *   min, max    کرانه‌های مجاز (px)
 *   initial     اندازه‌ی پیش‌فرض وقتی چیزی ذخیره نشده
 *   invert      جهتِ کشیدن را وارون می‌کند؛ برای داکِ پایین که دستگیره روی
 *               لبه‌ی بالاست true (کشیدن به بالا = بزرگ‌تر).
 *
 * خروجی:
 *   { size, setSize, dragging, handleProps, reset }
 *   handleProps را روی عنصرِ دستگیره بگذارید: <div {...handleProps} />
 */
export default function useResizable({
  storageKey,
  axis = 'y',
  min = 200,
  max = 600,
  initial = 320,
  invert = true,
} = {}) {
  const clamp = useCallback((v) => Math.min(max, Math.max(min, v)), [min, max]);

  const [size, setSizeRaw] = useState(() => {
    try {
      const raw = storageKey && localStorage.getItem(storageKey);
      if (raw != null) {
        const n = parseFloat(raw);
        if (!Number.isNaN(n)) return clamp(n);
      }
    } catch (e) { /* دسترسی به storage ممکن است مسدود باشد */ }
    return clamp(initial);
  });

  const [dragging, setDragging] = useState(false);

  // setSize با clamp + پایداری
  const setSize = useCallback((v) => {
    const next = clamp(typeof v === 'function' ? v(0) : v);
    setSizeRaw(next);
    try { if (storageKey) localStorage.setItem(storageKey, String(Math.round(next))); } catch (e) {}
  }, [clamp, storageKey]);

  const reset = useCallback(() => setSize(initial), [setSize, initial]);

  // مرجع‌هایی که در طولِ کشیدن نباید باعثِ re-bind شوند
  const start = useRef({ pos: 0, size: 0 });

  const onMove = useCallback((e) => {
    const cur = axis === 'y' ? e.clientY : e.clientX;
    let delta = cur - start.current.pos;
    if (invert) delta = -delta; // دستگیره بالا/راست: حرکتِ معکوس
    setSize(start.current.size + delta);
  }, [axis, invert, setSize]);

  const stop = useCallback(() => {
    setDragging(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [onMove]);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    start.current = { pos: axis === 'y' ? e.clientY : e.clientX, size };
    setDragging(true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    // در طولِ کشیدن: جلوگیری از انتخابِ متن و یکدست‌کردنِ نشانگر
    document.body.style.userSelect = 'none';
    document.body.style.cursor = axis === 'y' ? 'ns-resize' : 'ew-resize';
  }, [axis, size, onMove, stop]);

  // پاک‌سازیِ شنونده‌ها هنگامِ unmount در میانه‌ی کشیدن
  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', stop);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, [onMove, stop]);

  const handleProps = {
    onPointerDown,
    role: 'separator',
    'aria-orientation': axis === 'y' ? 'horizontal' : 'vertical',
    style: { cursor: axis === 'y' ? 'ns-resize' : 'ew-resize', touchAction: 'none' },
  };

  return { size, setSize, dragging, handleProps, reset };
}
