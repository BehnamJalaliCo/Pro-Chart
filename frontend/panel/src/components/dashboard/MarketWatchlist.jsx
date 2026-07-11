import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, LineChart, ArrowUpDown } from 'lucide-react';
import Sparkline from '../common/Sparkline';
import LiveDot from '../common/LiveDot';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { SkeletonBox } from '../common/Skeleton';
import { bnAPI } from '../../api/client';
import {
  toPersianDigits,
  formatPrice,
  formatPercent,
} from '../../utils/formatters';

const UP = '#00C853';
const DOWN = '#FF1744';
const FLAT = '#7a8194';

/* رنگ روند بر اساس درصد تغییر */
function trendColor(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n) || n === 0) return FLAT;
  return n > 0 ? UP : DOWN;
}

/**
 * RowSparkline — اسپارک‌لاین هر ردیف؛ کوئری مستقل و کش‌شده بر اساس نماد.
 * داده‌ی واقعی از bnAPI.getMarketSpark(symbol). بدون داده → خط پایه‌ی ملایم.
 */
function RowSparkline({ symbol, color }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['bn', 'market', 'spark', symbol],
    queryFn: () => bnAPI.getMarketSpark(symbol, 40),
    enabled: Boolean(symbol),
    staleTime: 25000,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (isLoading) {
    return <SkeletonBox className="h-6 w-16" />;
  }
  if (isError) {
    return <span className="text-text-muted text-xs">—</span>;
  }

  const points = Array.isArray(data?.points) ? data.points : [];
  return (
    <Sparkline
      points={points}
      color={color}
      height={24}
      width={64}
      strokeWidth={1.5}
      className="text-surface-border"
    />
  );
}

/* سرستون قابل‌مرتب‌سازی */
function SortHeader({ label, active, dir, onClick, align = 'left' }) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 select-none transition-colors duration-200 hover:text-text-primary ${
        active ? 'text-brand-blue' : 'text-text-secondary'
      } ${align === 'left' ? 'flex-row-reverse' : ''}`}
    >
      <Icon size={12} className={active ? '' : 'opacity-50'} />
      <span>{label}</span>
    </button>
  );
}

/**
 * MarketWatchlist — کارت واچ‌لیست بازار (مرکز داشبورد بازار).
 * جدول متراکم نمادها با آخرین قیمت، بید/اَسک، درصد تغییر رنگی و اسپارک‌لاین زنده.
 * قابل‌مرتب‌سازی بر اساس نماد / آخرین قیمت / درصد تغییر.
 * داده‌ی کاملاً واقعی از bnAPI.getMarket (refetch هر ۵ ثانیه). بدون داده‌ی ساختگی.
 */
export default function MarketWatchlist() {
  const [sortKey, setSortKey] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['bn', 'market'],
    queryFn: () => bnAPI.getMarket(),
    refetchInterval: 5000,
    refetchOnWindowFocus: false,
    staleTime: 4000,
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  const count = Number.isFinite(data?.count) ? data.count : items.length;

  const serverTimeText = useMemo(() => {
    if (!data?.serverTime) return '';
    const d = new Date(data.serverTime);
    if (Number.isNaN(d.getTime())) return '';
    return toPersianDigits(
      d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    );
  }, [data?.serverTime]);

  const sorted = useMemo(() => {
    const arr = [...items];
    const factor = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === 'symbol') {
        return String(a.symbol || '').localeCompare(String(b.symbol || '')) * factor;
      }
      const av = Number(a[sortKey]);
      const bv = Number(b[sortKey]);
      const an = Number.isFinite(av) ? av : -Infinity;
      const bn = Number.isFinite(bv) ? bv : -Infinity;
      return (an - bn) * factor;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  }

  return (
    <div className="card p-0 overflow-hidden">
      {/* هدر کارت */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
            <LineChart size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary leading-tight">
              واچ‌لیست بازار
            </h3>
            <p className="text-xs text-text-muted">
              {toPersianDigits(count)} نماد زنده
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {serverTimeText && (
            <span className="text-xs text-text-secondary font-mono tabular-nums" dir="ltr">
              {serverTimeText}
            </span>
          )}
          <LiveDot active={isFetching} color={isError ? 'red' : 'green'} size={8} />
        </div>
      </div>

      {/* بدنه */}
      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <SkeletonBox className="h-4 flex-1" />
              <SkeletonBox className="h-4 w-20" />
              <SkeletonBox className="h-4 w-24" />
              <SkeletonBox className="h-6 w-16" />
              <SkeletonBox className="h-4 w-14" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          compact
          description="دریافت داده‌های بازار ناموفق بود."
          onRetry={refetch}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          compact
          icon={LineChart}
          title="نمادی برای نمایش نیست"
          description="در حال حاضر داده‌ی زنده‌ای از بازار در دسترس نیست."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-text-secondary border-b border-surface-border">
                <th className="text-right font-medium px-5 py-2.5">
                  <SortHeader
                    label="نماد"
                    align="right"
                    active={sortKey === 'symbol'}
                    dir={sortDir}
                    onClick={() => toggleSort('symbol')}
                  />
                </th>
                <th className="text-left font-medium px-3 py-2.5">
                  <SortHeader
                    label="آخرین"
                    active={sortKey === 'last'}
                    dir={sortDir}
                    onClick={() => toggleSort('last')}
                  />
                </th>
                <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">
                  بید / اَسک
                </th>
                <th className="text-center font-medium px-3 py-2.5 hidden sm:table-cell">
                  روند
                </th>
                <th className="text-left font-medium px-5 py-2.5">
                  <SortHeader
                    label="تغییر ٪"
                    active={sortKey === 'changePct'}
                    dir={sortDir}
                    onClick={() => toggleSort('changePct')}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/60">
              {sorted.map((it) => {
                const pct = Number(it.changePct);
                const color = trendColor(pct);
                const isUp = Number.isFinite(pct) && pct > 0;
                const isDown = Number.isFinite(pct) && pct < 0;
                const pctClass = isUp
                  ? 'text-brand-green bg-brand-green/10'
                  : isDown
                  ? 'text-brand-red bg-brand-red/10'
                  : 'text-text-muted bg-surface-hover';
                return (
                  <tr
                    key={it.symbol}
                    className="group transition-colors duration-200 hover:bg-surface-hover/60"
                  >
                    {/* نماد */}
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span
                          className="font-semibold text-text-primary tracking-wide"
                          dir="ltr"
                        >
                          {it.symbol}
                        </span>
                        {it.source && (
                          <span className="text-[11px] text-text-muted" dir="ltr">
                            {it.source}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* آخرین قیمت */}
                    <td className="px-3 py-3 text-left">
                      <span className="font-mono tabular-nums text-text-primary" dir="ltr">
                        {formatPrice(it.last)}
                      </span>
                    </td>

                    {/* بید / اَسک */}
                    <td className="px-3 py-3 text-left hidden md:table-cell">
                      <div className="flex flex-col leading-tight" dir="ltr">
                        <span className="font-mono tabular-nums text-brand-green text-xs">
                          {formatPrice(it.bid)}
                        </span>
                        <span className="font-mono tabular-nums text-brand-red text-xs">
                          {formatPrice(it.ask)}
                        </span>
                      </div>
                    </td>

                    {/* اسپارک‌لاین */}
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <div className="flex justify-center">
                        <RowSparkline symbol={it.symbol} color={color} />
                      </div>
                    </td>

                    {/* درصد تغییر */}
                    <td className="px-5 py-3 text-left">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono tabular-nums text-xs font-medium ${pctClass}`}
                        dir="ltr"
                      >
                        {isUp && <ArrowUp size={12} />}
                        {isDown && <ArrowDown size={12} />}
                        {Number.isFinite(pct) ? formatPercent(pct) : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
