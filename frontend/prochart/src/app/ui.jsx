// اجزای مشترکِ پوسته — سرصفحه، حالتِ خالی/بارگذاری. توکن‌محورِ CSS (تمِ روشن/تاریک) و دوزبانه.
import React from 'react';

export const ACCENT = '#2962FF';

// کارتِ صفحه — با انیمیشنِ ورودِ نرم (fade+slide) برای حسِ ترنزیشنِ متصل.
export function Screen({ title, right, children }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden pc-screen-in"
      style={{ background: 'var(--surface-default)' }}
    >
      <header
        className="flex-none flex items-center justify-between px-4"
        style={{ height: 58, borderBottom: '1px solid var(--surface-border)' }}
      >
        <h1 className="font-extrabold" style={{ fontSize: 19, color: 'var(--text-primary)' }}>{title}</h1>
        {right}
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto pc-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center" style={{ minHeight: 260 }}>
      <div
        className="flex items-center justify-center"
        style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}
      >
        {icon}
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, lineHeight: 1.8, maxWidth: 260 }}>{text}</p>
    </div>
  );
}

// اسپارک‌لاین — نمودارِ خطیِ کوچکِ بدونِ محور (SVG، تیز). data: آرایهٔ اعداد.
export function Sparkline({ data, up, width = 54, height = 26, stroke }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => `${(i * stepX).toFixed(1)},${(height - 3 - ((v - min) / rng) * (height - 6)).toFixed(1)}`).join(' ');
  const col = stroke || (up ? 'var(--up)' : 'var(--down)') || (up ? '#089981' : '#f23645');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" style={{ flex: '0 0 auto' }}>
      <polyline points={pts} stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Loading({ text }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3" style={{ minHeight: 200 }}>
      <span className="pc-spin" style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid var(--surface-border)', borderTopColor: ACCENT, display: 'block' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{text}</p>
    </div>
  );
}
