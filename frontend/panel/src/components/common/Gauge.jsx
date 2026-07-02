import React, { useId } from 'react';
import { toPersianDigits } from '../../utils/formatters';

/**
 * Gauge — گیج قوسی (SVG) برای درصدها (CPU/RAM/Disk...).
 * رنگ بر اساس آستانه‌ها سبز/کهربایی/قرمز می‌شود.
 *
 * props:
 *   percent    : number  (0..100)
 *   label      : string  (زیر درصد)
 *   size       : number = 96
 *   color      : string  (اگر داده شود، آستانه‌ها نادیده گرفته می‌شوند)
 *   thresholds : {warn:number, danger:number} = {warn:70, danger:88}
 */
export default function Gauge({
  percent = 0,
  label,
  size = 96,
  color,
  thresholds = { warn: 70, danger: 88 },
  className = '',
}) {
  const gradId = useId();
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));

  const autoColor =
    pct >= (thresholds?.danger ?? 88)
      ? '#FF1744'
      : pct >= (thresholds?.warn ?? 70)
        ? '#FFB300'
        : '#00C853';
  const stroke = color || autoColor;

  // قوس ۲۷۰ درجه (از -۲۲۵° تا +۴۵°)
  const strokeW = Math.max(6, size * 0.09);
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const START = 135; // درجه
  const SWEEP = 270;

  const polar = (angleDeg) => {
    const a = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const arcPath = (fromDeg, toDeg) => {
    const [x1, y1] = polar(fromDeg);
    const [x2, y2] = polar(toDeg);
    const large = toDeg - fromDeg > 180 ? 1 : 0;
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  };

  const trackPath = arcPath(START, START + SWEEP);
  const valuePath = arcPath(START, START + (SWEEP * pct) / 100);

  return (
    <div
      className={`inline-flex flex-col items-center justify-center ${className}`}
      role="img"
      aria-label={`${label ? label + ' ' : ''}${Math.round(pct)}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.75" />
            <stop offset="100%" stopColor={stroke} stopOpacity="1" />
          </linearGradient>
        </defs>
        <path
          d={trackPath}
          fill="none"
          stroke="currentColor"
          className="text-surface-border"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {pct > 0 && (
          <path
            d={valuePath}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeW}
            strokeLinecap="round"
            style={{ transition: 'all 600ms cubic-bezier(0.22,1,0.36,1)' }}
          />
        )}
        <text
          x={cx}
          y={label ? cy - size * 0.02 : cy + size * 0.04}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          className="text-text-primary font-bold"
          style={{ fontSize: size * 0.24 }}
        >
          {toPersianDigits(Math.round(pct))}٪
        </text>
        {label && (
          <text
            x={cx}
            y={cy + size * 0.2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            className="text-text-muted"
            style={{ fontSize: size * 0.13 }}
          >
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
