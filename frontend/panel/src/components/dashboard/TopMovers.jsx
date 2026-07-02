import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { bnAPI } from '../../api/client';
import { toPersianDigits } from '../../utils/formatters';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { SkeletonBox } from '../common/Skeleton';
import LiveDot from '../common/LiveDot';

/**
 * TopMovers — دو فهرست فشرده‌ی «بیشترین رشد» و «بیشترین افت» بازار.
 *
 * داده‌ی واقعی از bnAPI.getMarket() → topGainers / topLosers (refetch هر ۵ ثانیه).
 * هر ردیف: نماد، آخرین قیمت، درصد تغییر (بزرگ و رنگی).
 *
 * export: default TopMovers  (بدون props)
 */

const UP = '#00C853';
const DOWN = '#FF1744';

// آخرین قیمت را خوانا فرمت می‌کند (بدون رقم‌های اضافه برای اعداد بزرگ)
function formatLast(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 2 : 5;
  const s = n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return toPersianDigits(s);
}

function formatPct(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return toPersianDigits(`${sign}${n.toFixed(2)}٪`);
}

function MoverRow({ item }) {
  const chg = typeof item.changePct === 'string' ? parseFloat(item.changePct) : item.changePct;
  const isUp = (chg ?? 0) >= 0;
  const color = isUp ? UP : DOWN;
  const Arrow = isUp ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-[background,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-surface-hover motion-reduce:transition-none">
      {/* نماد */}
      <div className="min-w-0 flex-1">
        <span dir="ltr" className="block truncate font-mono text-sm font-semibold text-text-primary tabular-nums">
          {item.symbol}
        </span>
      </div>

      {/* آخرین قیمت */}
      <div dir="ltr" className="shrink-0 font-mono text-sm text-text-secondary tabular-nums">
        {formatLast(item.last)}
      </div>

      {/* درصد تغییر — بزرگ و رنگی */}
      <div
        className="shrink-0 flex items-center gap-1 justify-end min-w-[84px] font-mono text-sm font-bold tabular-nums"
        style={{ color }}
      >
        <Arrow size={14} strokeWidth={2.5} />
        <span dir="ltr">{formatPct(item.changePct)}</span>
      </div>
    </div>
  );
}

function MoverList({ title, icon: Icon, tone, items }) {
  const accent = tone === 'up' ? UP : DOWN;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            <Icon size={16} strokeWidth={2.25} />
          </span>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        </div>
        <span
          className="text-xs font-medium tabular-nums px-2 py-0.5 rounded-md"
          style={{ backgroundColor: `${accent}14`, color: accent }}
        >
          {toPersianDigits(items.length)}
        </span>
      </div>

      <div className="p-2">
        {items.length === 0 ? (
          <EmptyState compact icon={Activity} title="داده‌ای موجود نیست" />
        ) : (
          <div className="space-y-0.5">
            {items.map((it, i) => (
              <MoverRow key={it.symbol || i} item={it} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div className="flex items-center gap-2">
          <SkeletonBox className="w-7 h-7 rounded-lg" />
          <SkeletonBox className="h-3 w-24" />
        </div>
        <SkeletonBox className="h-4 w-6 rounded-md" />
      </div>
      <div className="p-2 space-y-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <SkeletonBox className="h-3 w-16" />
            <SkeletonBox className="h-3 w-14" />
            <SkeletonBox className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TopMovers() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['bn-market-movers'],
    queryFn: () => bnAPI.getMarket(),
    refetchInterval: 5000,
  });

  const { gainers, losers } = useMemo(() => {
    const g = Array.isArray(data?.topGainers) ? data.topGainers : [];
    const l = Array.isArray(data?.topLosers) ? data.topLosers : [];
    return { gainers: g, losers: l };
  }, [data]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HeaderSkeleton />
        <HeaderSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card p-4">
        <ErrorState
          description="دریافت اطلاعات بازار ناموفق بود."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const empty = gainers.length === 0 && losers.length === 0;
  if (empty) {
    return (
      <div className="card p-4">
        <EmptyState
          icon={Activity}
          title="داده‌ی بازار در دسترس نیست"
          description="در حال حاضر حرکتی برای نمایش وجود ندارد."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2 text-xs text-text-muted">
        <span>به‌روزرسانی زنده</span>
        <LiveDot active={isFetching} color="green" size={7} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoverList title="بیشترین رشد" icon={TrendingUp} tone="up" items={gainers} />
        <MoverList title="بیشترین افت" icon={TrendingDown} tone="down" items={losers} />
      </div>
    </div>
  );
}
