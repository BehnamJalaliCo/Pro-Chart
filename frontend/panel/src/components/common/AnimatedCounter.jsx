import React, { useEffect, useRef, useState } from 'react';
import { toPersianDigits } from '../../utils/formatters';

/**
 * AnimatedCounter — شمارش نرم تا مقدار هدف با requestAnimationFrame.
 * به prefers-reduced-motion احترام می‌گذارد و ارقام را فارسی نمایش می‌دهد.
 *
 * props:
 *   value    : number
 *   decimals : number = 0
 *   duration : number = 800   (ms)
 *   prefix   : string = ''
 *   suffix   : string = ''
 */
export default function AnimatedCounter({
  value = 0,
  decimals = 0,
  duration = 800,
  prefix = '',
  suffix = '',
  className = '',
}) {
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = fromRef.current;
    const to = target;

    if (prefersReduced || duration <= 0 || from === to) {
      setDisplay(to);
      fromRef.current = to;
      return;
    }

    const start = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const current = from + (to - from) * easeOutCubic(t);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        fromRef.current = to;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [target, duration]);

  const formatted = toPersianDigits(
    Number(display).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
