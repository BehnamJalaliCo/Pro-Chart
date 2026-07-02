import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';
import { bnAPI } from '../../api/client';
import { toPersianDigits } from '../../utils/formatters';
import AnimatedCounter from '../common/AnimatedCounter';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { SkeletonBox } from '../common/Skeleton';

/**
 * TierBreakdown — توزیع کاربران بر اساس سطح اشتراک (رایگان / VIP / پرمیوم).
 *
 * داده‌ی واقعی از bnAPI.getStats().users → { free, vip, premium }.
 * نمودار دونات (recharts) + راهنما با تعداد و درصد هر سطح.
 *
 * export: default TierBreakdown  (بدون props)
 */

const TIERS = [
  { key: 'free', label: 'رایگان', color: '#2979FF' },
  { key: 'vip', label: 'VIP', color: '#00C853' },
  { key: 'premium', label: 'پرمیوم', color: '#FFB300' },
];

function pct(part, total) {
  if (!total) return 0;
  return (part / total) * 100;
}

function CardShell({ children }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
          <Users size={18} strokeWidth={2.25} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-text-primary">توزیع سطوح اشتراک</h3>
          <p className="text-xs text-text-muted">تفکیک کاربران بر اساس نوع اشتراک</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function TierBreakdown() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bn-stats-tiers'],
    queryFn: () => bnAPI.getStats(),
    refetchInterval: 30000,
  });

  const { segments, total } = useMemo(() => {
    const u = data?.users || {};
    const segs = TIERS.map((t) => ({
      ...t,
      value: Number(u[t.key]) || 0,
    }));
    const tot = segs.reduce((s, x) => s + x.value, 0);
    return { segments: segs, total: tot };
  }, [data]);

  if (isLoading) {
    return (
      <CardShell>
        <div className="flex items-center gap-6">
          <SkeletonBox className="w-40 h-40 rounded-full shrink-0" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <SkeletonBox className="w-3 h-3 rounded-sm" />
                  <SkeletonBox className="h-3 w-20" />
                </div>
                <SkeletonBox className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </CardShell>
    );
  }

  if (isError) {
    return (
      <CardShell>
        <ErrorState
          compact
          description="دریافت آمار سطوح اشتراک ناموفق بود."
          onRetry={() => refetch()}
        />
      </CardShell>
    );
  }

  if (total === 0) {
    return (
      <CardShell>
        <EmptyState
          compact
          icon={Users}
          title="کاربری ثبت نشده است"
          description="با افزوده‌شدن کاربران، توزیع سطوح اینجا نمایش داده می‌شود."
        />
      </CardShell>
    );
  }

  const chartData = segments.filter((s) => s.value > 0);

  return (
    <CardShell>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* دونات */}
        <div className="relative w-40 h-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="66%"
                outerRadius="100%"
                paddingAngle={chartData.length > 1 ? 2 : 0}
                startAngle={90}
                endAngle={-270}
                stroke="none"
                isAnimationActive={false}
              >
                {chartData.map((s) => (
                  <Cell key={s.key} fill={s.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* مرکز: مجموع کاربران */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <AnimatedCounter
              value={total}
              className="text-2xl font-bold text-text-primary tabular-nums"
            />
            <span className="text-xs text-text-muted mt-0.5">کل کاربران</span>
          </div>
        </div>

        {/* راهنما */}
        <ul className="flex-1 w-full space-y-2.5">
          {segments.map((s) => {
            const p = pct(s.value, total);
            return (
              <li key={s.key} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className="text-sm text-text-secondary flex-1 min-w-0 truncate">
                  {s.label}
                </span>
                <span className="text-sm font-semibold text-text-primary tabular-nums shrink-0">
                  {toPersianDigits(s.value)}
                </span>
                <span
                  className="text-xs font-medium tabular-nums shrink-0 min-w-[42px] text-left px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: `${s.color}1a`, color: s.color }}
                  dir="ltr"
                >
                  {toPersianDigits(p.toFixed(1))}٪
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </CardShell>
  );
}
