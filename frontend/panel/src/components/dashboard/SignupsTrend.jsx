import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { UserPlus, TrendingUp } from 'lucide-react';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { ChartSkeleton } from '../common/Skeleton';
import AnimatedCounter from '../common/AnimatedCounter';
import { bnAPI } from '../../api/client';
import { toPersianDigits } from '../../utils/formatters';

/**
 * SignupsTrend — نمودار ثبت‌نام کاربران جدید در ۳۰ روز گذشته.
 *
 * داده واقعی از bnAPI.getSignups(30) -> [{ date, count }].
 * حالت‌های loading / empty / error مدیریت می‌شوند و هیچ داده‌ی ساختگی وجود ندارد.
 *
 * default export — بدون props.
 */

// تبدیل تاریخ ISO به برچسب کوتاه فارسی (روز/ماه)
function faShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('fa-IR', { month: '2-digit', day: '2-digit' });
  } catch {
    return toPersianDigits(dateStr);
  }
}

function faFullDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return toPersianDigits(dateStr);
  }
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 shadow-2xl">
      <div className="text-xs text-text-muted mb-1">{faFullDate(row.date)}</div>
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary tabular-nums">
        <span className="w-2 h-2 rounded-full bg-brand-blue" />
        {toPersianDigits(row.count ?? 0)} کاربر جدید
      </div>
    </div>
  );
}

export default function SignupsTrend() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['bn', 'signups', 30],
    queryFn: () => bnAPI.getSignups(30),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // به‌روزرسانی هر ۵ دقیقه
  });

  const series = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data
      .filter((d) => d && d.date != null)
      .map((d) => ({ date: d.date, count: Number(d.count) || 0 }));
  }, [data]);

  const { total, peak } = useMemo(() => {
    let t = 0;
    let p = 0;
    for (const d of series) {
      t += d.count;
      if (d.count > p) p = d.count;
    }
    return { total: t, peak: p };
  }, [series]);

  const hasData = series.length > 0 && total > 0;

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
            <UserPlus size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary leading-tight">
              روند ثبت‌نام کاربران
            </h3>
            <p className="text-xs text-text-muted mt-0.5">۳۰ روز گذشته</p>
          </div>
        </div>

        {hasData && (
          <div className="text-left">
            <div className="text-2xl font-bold text-text-primary tabular-nums leading-none">
              <AnimatedCounter value={total} />
            </div>
            <div className="flex items-center justify-end gap-1 mt-1 text-xs text-text-muted">
              <TrendingUp size={12} className="text-brand-green" />
              <span className="tabular-nums">
                بیشینه {toPersianDigits(peak)} در روز
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <ChartSkeleton height={260} />
      ) : isError ? (
        <ErrorState
          compact
          description="دریافت آمار ثبت‌نام‌ها ناموفق بود."
          onRetry={refetch}
        />
      ) : !hasData ? (
        <EmptyState
          compact
          icon={UserPlus}
          title="هنوز ثبت‌نامی ثبت نشده"
          description="با ثبت‌نام کاربران جدید، روند رشد در این نمودار نمایش داده می‌شود."
        />
      ) : (
        <div
          className={`h-[260px] w-full transition-opacity duration-200 ${
            isFetching ? 'opacity-70' : 'opacity-100'
          }`}
          dir="ltr"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={series}
              margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2979FF" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2979FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#2a2e3d"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={faShortDate}
                tick={{ fill: '#636882', fontSize: 11 }}
                axisLine={{ stroke: '#2a2e3d' }}
                tickLine={false}
                minTickGap={24}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                width={36}
                tick={{ fill: '#636882', fontSize: 11 }}
                tickFormatter={(v) => toPersianDigits(v)}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: '#2a2e3d', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#2979FF"
                strokeWidth={2}
                fill="url(#signupsFill)"
                activeDot={{
                  r: 4,
                  fill: '#2979FF',
                  stroke: '#161923',
                  strokeWidth: 2,
                }}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
