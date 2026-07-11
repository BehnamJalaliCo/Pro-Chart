import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle, ShoppingCart } from 'lucide-react';
import { bnAPI } from '../../api/client';
import AnimatedCounter from '../common/AnimatedCounter';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { toPersianDigits, formatPercent } from '../../utils/formatters';

/**
 * OrdersPulse — کارت فشرده‌ی وضعیت سفارش‌ها.
 * داده‌ی واقعی از bnAPI.getStats().orders (total/pending/filled/failed).
 * نمایش به‌صورت نوار انباشته‌ی افقی + راهنما (legend) با درصد واقعی.
 * هیچ داده‌ی ساختگی وجود ندارد؛ در نبود سفارش، حالت خالی نمایش داده می‌شود.
 */

const SEGMENTS = [
  {
    key: 'filled',
    label: 'تکمیل‌شده',
    color: '#00C853',
    tint: 'bg-brand-green',
    text: 'text-brand-green',
    icon: CheckCircle2,
  },
  {
    key: 'pending',
    label: 'در انتظار',
    color: '#2979FF',
    tint: 'bg-brand-blue',
    text: 'text-brand-blue',
    icon: Clock,
  },
  {
    key: 'failed',
    label: 'ناموفق',
    color: '#FF1744',
    tint: 'bg-brand-red',
    text: 'text-brand-red',
    icon: XCircle,
  },
];

function PulseSkeleton() {
  return (
    <div className="card p-5" aria-label="در حال بارگذاری" role="status">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-surface-elevated animate-pulse" />
        <div className="h-8 w-16 rounded bg-surface-elevated animate-pulse" />
      </div>
      <div className="mt-4 h-3 w-full rounded-full bg-surface-elevated animate-pulse" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-surface-elevated animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function OrdersPulse() {
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['bn', 'stats'],
    queryFn: () => bnAPI.getStats(),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) return <PulseSkeleton />;

  if (isError) {
    return (
      <div className="card p-5">
        <ErrorState
          compact
          description="دریافت وضعیت سفارش‌ها ناموفق بود."
          onRetry={refetch}
        />
      </div>
    );
  }

  const orders = stats?.orders || {};
  const total = Number(orders.total) || 0;
  const values = SEGMENTS.map((seg) => ({
    ...seg,
    value: Number(orders[seg.key]) || 0,
  }));

  // مجموع بخش‌ها (ممکن است با total برابر نباشد اگر وضعیت‌های دیگری باشد)
  const partsSum = values.reduce((acc, s) => acc + s.value, 0);
  const barTotal = partsSum > 0 ? partsSum : total;

  if (barTotal <= 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-9 h-9 rounded-lg bg-brand-blue/15 text-brand-blue flex items-center justify-center">
            <ShoppingCart size={18} />
          </span>
          <h3 className="text-sm font-semibold text-text-primary">وضعیت سفارش‌ها</h3>
        </div>
        <EmptyState
          compact
          icon={ShoppingCart}
          title="سفارشی ثبت نشده"
          description="با ثبت اولین سفارش، وضعیت آن‌ها اینجا نمایش داده می‌شود."
        />
      </div>
    );
  }

  return (
    <div className="card p-5">
      {/* هدر */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-brand-blue/15 text-brand-blue flex items-center justify-center">
            <ShoppingCart size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">وضعیت سفارش‌ها</h3>
            <p className="text-xs text-text-muted">مجموع سفارش‌ها</p>
          </div>
        </div>
        <p className="text-2xl font-bold text-text-primary tabular-nums leading-none">
          <AnimatedCounter value={total} />
        </p>
      </div>

      {/* نوار انباشته */}
      <div className="mt-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-elevated">
          {values.map((seg) => {
            const pct = barTotal > 0 ? (seg.value / barTotal) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={seg.key}
                className={`${seg.tint} h-full transition-[width] duration-500 ease-out`}
                style={{ width: `${pct}%` }}
                title={`${seg.label}: ${toPersianDigits(seg.value)}`}
              />
            );
          })}
        </div>
      </div>

      {/* راهنما */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {values.map((seg) => {
          const Icon = seg.icon;
          const pct = barTotal > 0 ? (seg.value / barTotal) * 100 : 0;
          return (
            <div
              key={seg.key}
              className="rounded-lg bg-surface-elevated/60 border border-surface-border px-3 py-2"
            >
              <div className="flex items-center gap-1.5">
                <Icon size={14} className={seg.text} />
                <span className="text-xs text-text-secondary">{seg.label}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-bold text-text-primary tabular-nums leading-none">
                  <AnimatedCounter value={seg.value} />
                </span>
                <span className="text-[11px] text-text-muted tabular-nums">
                  {formatPercent(pct)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
