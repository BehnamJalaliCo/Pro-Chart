import React, { useMemo, useId } from 'react';

/**
 * Sparkline — SVG کوچک برای نمایش روند قیمت/داده. بدون کتابخانه خارجی.
 *
 * props:
 *   points : Array<{c:number}> | number[]   (داده‌ی خام؛ خالی → خطوط چین ملایم)
 *   color  : string  = '#00C853'            (رنگ خط/ناحیه)
 *   height : number  = 32
 *   width  : number|string = '100%'
 *   fill   : boolean = false                (پرکردن زیر خط با گرادیان ملایم)
 *   strokeWidth : number = 1.5
 */
export default function Sparkline({
  points = [],
  color = '#00C853',
  height = 32,
  width = '100%',
  fill = false,
  strokeWidth = 1.5,
  className = '',
}) {
  const gradId = useId();

  const values = useMemo(() => {
    if (!Array.isArray(points)) return [];
    return points
      .map((p) => (typeof p === 'number' ? p : p && typeof p.c === 'number' ? p.c : null))
      .filter((v) => v !== null && !Number.isNaN(v));
  }, [points]);

  // ابعاد داخلی viewBox (مقیاس‌پذیر)
  const W = 100;
  const H = 100;
  const pad = strokeWidth * 2;

  const geometry = useMemo(() => {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = (W - pad * 2) / (values.length - 1);
    const coords = values.map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (H - pad * 2) * (1 - (v - min) / range);
      return [x, y];
    });
    const line = coords
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
      .join(' ');
    const area = `${line} L${coords[coords.length - 1][0].toFixed(2)},${H - pad} L${coords[0][0].toFixed(2)},${H - pad} Z`;
    return { line, area };
  }, [values, pad]);

  // حالت خالی → خط‌چین ملایم
  if (!geometry) {
    return (
      <svg
        className={className}
        width={width}
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line
          x1={pad}
          y1={H / 2}
          x2={W - pad}
          y2={H / 2}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray="3 4"
          className="text-surface-border"
          opacity="0.6"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={geometry.area} fill={`url(#${gradId})`} stroke="none" />
        </>
      )}
      <path
        d={geometry.line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
