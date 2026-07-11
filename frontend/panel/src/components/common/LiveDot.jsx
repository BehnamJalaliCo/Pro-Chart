import React from 'react';

/**
 * LiveDot — نقطه‌ی وضعیت کوچک با پالس نرم (زنده/آفلاین).
 *
 * props:
 *   active : boolean = true            (پالس فعال؟)
 *   color  : 'green'|'red'|'blue'|'amber' = 'green'
 *   size   : number = 8   (px)
 */
const COLORS = {
  green: '#00C853',
  red: '#FF1744',
  blue: '#2979FF',
  amber: '#FFB300',
};

export default function LiveDot({ active = true, color = 'green', size = 8, className = '' }) {
  const c = COLORS[color] || COLORS.green;
  return (
    <span
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {active && (
        <span
          className="absolute inset-0 rounded-full animate-soft-pulse"
          style={{ backgroundColor: c }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: active ? c : '#5b6172',
          boxShadow: active ? `0 0 ${size}px ${c}66` : 'none',
        }}
      />
    </span>
  );
}
