import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useCountUp - هوک شمارش انیمیشنی اعداد
 *
 * @param {Object} options
 * @param {number} options.end - عدد هدف
 * @param {number} [options.start=0] - عدد شروع
 * @param {number} [options.duration=2000] - مدت انیمیشن (میلی‌ثانیه)
 * @param {number} [options.decimals=0] - تعداد ارقام اعشار
 * @param {boolean} [options.startOnMount=true] - شروع خودکار
 * @param {string} [options.easing='easeOutCubic'] - نوع easing
 * @param {string} [options.separator=','] - جداکننده هزارگان
 * @param {boolean} [options.persian=true] - تبدیل به ارقام فارسی
 *
 * @returns {Object} {
 *   value: number,          - مقدار عددی فعلی
 *   formattedValue: string, - مقدار فرمت شده
 *   isAnimating: boolean,   - در حال انیمیشن
 *   start: () => void,      - شروع دستی
 *   reset: () => void,      - بازنشانی
 * }
 *
 * @example
 * const { formattedValue } = useCountUp({ end: 2847, duration: 2000 });
 * return <span>{formattedValue}</span>;
 */

const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

function toPersian(str) {
  return String(str).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

// توابع easing
const easings = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  easeInOutCubic: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

export default function useCountUp({
  end,
  start = 0,
  duration = 2000,
  decimals = 0,
  startOnMount = true,
  easing = 'easeOutCubic',
  separator = ',',
  persian = true,
} = {}) {
  const [value, setValue] = useState(start);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const isMountedRef = useRef(true);

  const easingFn = easings[easing] || easings.easeOutCubic;

  /**
   * فرمت عدد با جداکننده هزارگان
   */
  const formatNumber = useCallback(
    (num) => {
      const fixed = num.toFixed(decimals);
      const [intPart, decPart] = fixed.split('.');
      const withSeparator = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
      const result = decPart ? `${withSeparator}.${decPart}` : withSeparator;
      return persian ? toPersian(result) : result;
    },
    [decimals, separator, persian]
  );

  /**
   * شروع انیمیشن
   */
  const startAnimation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    startTimeRef.current = null;
    setIsAnimating(true);
    setValue(start);

    const animate = (timestamp) => {
      if (!isMountedRef.current) return;

      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFn(progress);
      const currentValue = start + (end - start) * easedProgress;

      setValue(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(end);
        setIsAnimating(false);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [start, end, duration, easingFn]);

  /**
   * بازنشانی به مقدار شروع
   */
  const reset = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setValue(start);
    setIsAnimating(false);
  }, [start]);

  // شروع خودکار
  useEffect(() => {
    isMountedRef.current = true;

    if (startOnMount) {
      startAnimation();
    }

    return () => {
      isMountedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [end, startOnMount, startAnimation]);

  return {
    value: decimals > 0 ? parseFloat(value.toFixed(decimals)) : Math.floor(value),
    formattedValue: formatNumber(value),
    isAnimating,
    start: startAnimation,
    reset,
  };
}
