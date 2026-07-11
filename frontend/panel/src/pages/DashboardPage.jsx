import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import LiveDot from '../components/common/LiveDot';
import LiveMarketTape from '../components/dashboard/LiveMarketTape';
import KpiDeck from '../components/dashboard/KpiDeck';
import MarketWatchlist from '../components/dashboard/MarketWatchlist';
import TopMovers from '../components/dashboard/TopMovers';
import ServerResources from '../components/dashboard/ServerResources';
import SignupsTrend from '../components/dashboard/SignupsTrend';
import TierBreakdown from '../components/dashboard/TierBreakdown';
import OrdersPulse from '../components/dashboard/OrdersPulse';
import SystemActivity from '../components/dashboard/SystemActivity';

import { bnAPI } from '../api/client';
import { toPersianDigits } from '../utils/formatters';

/**
 * DashboardPage — داشبورد پیشرفته‌ی بازارنما.
 *
 * صرفاً چیدمان و کامپوز کردن ویجت‌ها. هیچ داده‌ای در خودِ صفحه واکشی/تولید
 * نمی‌شود؛ هر ویجت مالکِ کوئری خودش است. تنها استثنا: ساعتِ سرور در هدر که
 * از همان کلیدِ کششِ بازار (['bn','market']) خوانده می‌شود و به‌خاطر
 * dedupe در react-query هیچ درخواستِ اضافه‌ای ایجاد نمی‌کند.
 */
export default function DashboardPage() {
  const { data, isError, isFetching } = useQuery({
    queryKey: ['bn', 'market'],
    queryFn: () => bnAPI.getMarket(),
    refetchInterval: 5000,
    staleTime: 4000,
  });

  const serverTimeText = useMemo(() => {
    if (!data?.serverTime) return '';
    const d = new Date(data.serverTime);
    if (Number.isNaN(d.getTime())) return '';
    return toPersianDigits(
      d.toLocaleTimeString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }, [data?.serverTime]);

  return (
    <div className="pb-10">
      {/* نوار قیمت زنده — تمام‌عرض، بالای صفحه */}
      <LiveMarketTape />

      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-8 py-6 space-y-6">
        {/* هدر صفحه */}
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-text-primary leading-tight">
              داشبورد بازارنما
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              نمای کلیِ زنده از کاربران، بازار و زیرساخت
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-card px-3 py-1.5">
            <LiveDot active={isFetching} color={isError ? 'red' : 'green'} size={8} />
            <span className="text-xs text-text-secondary">
              {isError ? 'قطع ارتباط' : 'زنده'}
            </span>
            {serverTimeText && (
              <>
                <span className="text-surface-border">·</span>
                <span
                  className="text-xs text-text-secondary font-mono tabular-nums"
                  dir="ltr"
                >
                  {serverTimeText}
                </span>
              </>
            )}
          </div>
        </header>

        {/* استریپِ KPI — تمام‌عرض */}
        <KpiDeck />

        {/* واچ‌لیستِ بازار (شاه‌کلید) کنارِ برترین حرکت‌ها */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <MarketWatchlist />
          </div>
          <div className="lg:col-span-4">
            <TopMovers />
          </div>
        </div>

        {/* منابعِ سرور — تمام‌عرض */}
        <ServerResources />

        {/* ثبت‌نام‌ها + تفکیکِ سطح + نبضِ سفارش‌ها */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <SignupsTrend />
          <TierBreakdown />
          <OrdersPulse />
        </div>

        {/* فعالیتِ سیستم — تمام‌عرض */}
        <SystemActivity />
      </div>
    </div>
  );
}
