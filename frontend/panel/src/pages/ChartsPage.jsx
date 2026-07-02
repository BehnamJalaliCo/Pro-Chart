import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  LineChart,
  ListChecks,
  Layout,
  Code2,
  Bell,
  BarChart3,
} from 'lucide-react';

import { bnAPI } from '../api/client';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { CardSkeleton, ChartSkeleton } from '../components/common/Skeleton';
import { toPersianDigits } from '../utils/formatters';

const BAR_COLORS = ['#2979FF', '#00C853', '#FF1744', '#FFB300', '#7C4DFF'];

// Tooltipِ سفارشی برای نمودارِ نمادها
function SymbolTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-text-primary">{item.symbol}</p>
      <p className="text-xs text-text-muted mt-0.5">
        در {toPersianDigits(item.count)} واچ‌لیست
      </p>
    </div>
  );
}

export default function ChartsPage() {
  const overviewQuery = useQuery({
    queryKey: ['bn-charts-overview'],
    queryFn: () => bnAPI.getChartsOverview(),
  });

  const data = overviewQuery.data || {};
  const watchlists = data.watchlists || {};
  const layouts = data.layouts || {};
  const scripts = data.scripts || {};
  const alerts = data.alerts || {};
  const topSymbols = Array.isArray(watchlists.topSymbols)
    ? watchlists.topSymbols
    : [];

  return (
    <div className="space-y-6">
      {/* سرصفحه */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <LineChart size={22} className="text-brand-blue" />
            چارت‌ها و واچ‌لیست‌ها
          </h1>
          <p className="text-sm text-text-muted mt-1">
            خلاصهٔ استفادهٔ کاربران از واچ‌لیست‌ها، چیدمان‌ها، اسکریپت‌ها و هشدارها
          </p>
        </div>
      </div>

      {/* کارت‌های آماری */}
      {overviewQuery.isLoading ? (
        <CardSkeleton count={4} />
      ) : overviewQuery.isError ? (
        <div className="card">
          <ErrorState onRetry={overviewQuery.refetch} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={ListChecks}
            title="واچ‌لیست‌ها"
            value={toPersianDigits(watchlists.count || 0)}
            variant="info"
          />
          <StatCard
            icon={Layout}
            title="چیدمان‌ها"
            value={toPersianDigits(layouts.count || 0)}
            variant="default"
          />
          <StatCard
            icon={Code2}
            title="اسکریپت‌ها"
            value={toPersianDigits(scripts.count || 0)}
            variant="success"
          />
          <StatCard
            icon={Bell}
            title="هشدارها"
            value={`${toPersianDigits(alerts.active || 0)} فعال / ${toPersianDigits(
              alerts.count || 0
            )}`}
            variant="warning"
          />
        </div>
      )}

      {/* محبوب‌ترین نمادها */}
      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <BarChart3 size={18} className="text-brand-blue" />
            محبوب‌ترین نمادها
          </h2>
          {!overviewQuery.isLoading &&
            !overviewQuery.isError &&
            topSymbols.length > 0 && (
              <span className="text-xs text-text-muted">
                بر اساس تعداد واچ‌لیست‌ها
              </span>
            )}
        </div>

        {overviewQuery.isLoading ? (
          <ChartSkeleton height={320} />
        ) : overviewQuery.isError ? (
          <ErrorState onRetry={overviewQuery.refetch} />
        ) : topSymbols.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="نمادی برای نمایش نیست"
            description="هنوز نمادی در واچ‌لیست‌ها ثبت نشده است. با افزودنِ نماد توسطِ کاربران، پرتکرارترین‌ها اینجا رسم می‌شوند."
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={topSymbols}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#ffffff10"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: '#8892a0', fontSize: 11 }}
                tickFormatter={(v) => toPersianDigits(v)}
                tickLine={false}
                axisLine={{ stroke: '#ffffff15' }}
              />
              <YAxis
                type="category"
                dataKey="symbol"
                tick={{ fill: '#c7ced8', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={88}
                orientation="right"
              />
              <Tooltip
                content={<SymbolTooltip />}
                cursor={{ fill: '#ffffff08' }}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
                {topSymbols.map((entry, index) => (
                  <Cell
                    key={entry.symbol || index}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
