import React from 'react';
import { clsx } from 'clsx';

const variantStyles = {
  success: {
    container: 'bg-brand-green/15 text-brand-green',
    dot: 'bg-brand-green shadow-[0_0_6px_rgba(0,200,83,0.5)]',
  },
  danger: {
    container: 'bg-brand-red/15 text-brand-red',
    dot: 'bg-brand-red shadow-[0_0_6px_rgba(255,23,68,0.5)]',
  },
  warning: {
    container: 'bg-yellow-500/15 text-yellow-500',
    dot: 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]',
  },
  info: {
    container: 'bg-brand-blue/15 text-brand-blue',
    dot: 'bg-brand-blue shadow-[0_0_6px_rgba(41,121,255,0.5)]',
  },
  neutral: {
    container: 'bg-surface-elevated text-text-muted',
    dot: 'bg-text-muted',
  },
};

const sizeStyles = {
  sm: {
    container: 'px-2 py-0.5 text-[10px]',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    container: 'px-2.5 py-1 text-xs',
    dot: 'w-2 h-2',
  },
};

const statusMap = {
  active: { label: 'فعال', variant: 'info' },
  online: { label: 'فعال', variant: 'success' },
  offline: { label: 'آفلاین', variant: 'danger' },
  success: { label: 'موفق', variant: 'success' },
  error: { label: 'خطا', variant: 'danger' },
  failed: { label: 'ناموفق', variant: 'danger' },
  warning: { label: 'هشدار', variant: 'warning' },
  pending: { label: 'در انتظار', variant: 'warning' },
  processing: { label: 'در حال پردازش', variant: 'info' },
  completed: { label: 'تکمیل شده', variant: 'success' },
  cancelled: { label: 'لغو شده', variant: 'neutral' },
  expired: { label: 'منقضی شده', variant: 'neutral' },
  banned: { label: 'مسدود', variant: 'danger' },
  inactive: { label: 'غیرفعال', variant: 'neutral' },
  closed: { label: 'بسته شده', variant: 'neutral' },
  tp1_hit: { label: 'TP1 فعال', variant: 'success' },
  tp2_hit: { label: 'TP2 فعال', variant: 'success' },
  tp3_hit: { label: 'TP3 فعال', variant: 'success' },
  sl_hit: { label: 'حد ضرر فعال', variant: 'danger' },
  maintenance: { label: 'تعمیرات', variant: 'info' },
};

export default function StatusBadge({ status, size = 'md', label, variant: variantOverride }) {
  const mapped = statusMap[status] || { label: status, variant: 'neutral' };
  const variant = variantOverride || mapped.variant;
  const displayLabel = label || mapped.label;
  const styles = variantStyles[variant] || variantStyles.neutral;
  const sizeClasses = sizeStyles[size] || sizeStyles.md;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        styles.container,
        sizeClasses.container
      )}
    >
      <span className={clsx('rounded-full shrink-0', styles.dot, sizeClasses.dot)} />
      {displayLabel}
    </span>
  );
}
