import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Crown,
  Star,
  Activity,
  DollarSign,
  ListChecks,
  Sparkles,
  Eye,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { bnAPI } from '../../api/client';
import AnimatedCounter from '../common/AnimatedCounter';
import Sparkline from '../common/Sparkline';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { toPersianDigits } from '../../utils/formatters';

/**
 * KpiDeck — نوار کارت‌های شاخص کلیدی داشبورد بازارنما.
 * داده‌ی واقعی از bnAPI.getStats (رفرش هر ۱۵ ثانیه) + روند ثبت‌نام از getSignups.
 * هیچ داده‌ی ساختگی وجود ندارد؛ در نبود داده حالت خالی/خطا نمایش داده می‌شود.
 */

const iconTone = {
  blue: 'bg-brand-blue/15 text-brand-blue',
  green: 'bg-brand-green/15 text-brand-green',
  red: 'bg-brand-red/15 text-brand-red',
  gold: 'bg-yellow-500/15 text-yellow-500',
  violet: 'bg-purple-500/15 text-purple-400',
};

const sparkColor = {
  blue: '#2979FF',
  green: '#00C853',
  red: '#FF1744',
  gold: '#EAB308',
  violet: '#A855F7',
};

function KpiCard({
  icon: Icon,
  tone = 'blue',
  label,
  value = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  delta = null, // { value:number, label:string, positiveIsGood?:boolean }
  points = null, // real numeric series or null
}) {
  const hasDelta =
    delta && typeof delta.value === 'number' && !Number.isNaN(delta.value);
  const up = hasDelta ? delta.value >= 0 : false;
  const positiveIsGood = hasDelta ? delta.positiveIsGood !== false : true;
  const good = hasDelta ? (up ? positiveIsGood : !positiveIsGood) : false;

  return (
    <div className="stat-card group overflow-hidden">
      <div className="flex items-center justify-between">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${
            iconTone[tone] || iconTone.blue
          }`}
        >
          {Icon && <Icon size={20} />}
        </div>

        {hasDelta && (
          <div
            className={`flex items-center gap-0.5 text-xs font-medium ${
              good ? 'text-brand-green' : 'text-brand-red'
            }`}
            title={delta.label}
          >
            {up ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
            <span className="tabular-nums">
              {toPersianDigits(Math.abs(delta.value))}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="text-2xl font-bold text-text-primary tabular-nums leading-tight">
          {prefix}
          <AnimatedCounter value={value} decimals={decimals} />
          {suffix && (
            <span className="text-sm font-medium text-text-secondary mr-1">
              {suffix}
            </span>
          )}
        </p>
        <p className="text-xs text-text-muted mt-1">{label}</p>
      </div>

      <div className="mt-3 h-8 -mx-1">
        <Sparkline
          points={Array.isArray(points) ? points : []}
          color={sparkColor[tone] || sparkColor.blue}
          height={32}
          fill
        />
      </div>
    </div>
  );
}

function DeckSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="stat-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-surface-elevated animate-pulse" />
            <div className="w-10 h-4 rounded bg-surface-elevated animate-pulse" />
          </div>
          <div className="mt-3">
            <div className="w-24 h-7 rounded bg-surface-elevated animate-pulse" />
            <div className="w-16 h-3 rounded bg-surface-elevated animate-pulse mt-2" />
          </div>
          <div className="mt-3 h-8 rounded bg-surface-elevated animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export default function KpiDeck() {
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

  // روند ثبت‌نام واقعی برای اسپارک‌لاین کارت کاربران
  const { data: signups } = useQuery({
    queryKey: ['bn', 'signups', 14],
    queryFn: () => bnAPI.getSignups(14),
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <DeckSkeleton />;

  if (isError) {
    return (
      <div className="card p-6">
        <ErrorState
          description="دریافت شاخص‌های داشبورد ناموفق بود. دوباره تلاش کنید."
          onRetry={refetch}
          compact
        />
      </div>
    );
  }

  const users = stats?.users || {};
  const revenue = stats?.revenue || {};
  const orders = stats?.orders || {};
  const aiSignals = stats?.aiSignals || {};
  const watchlists = stats?.watchlists || {};

  const hasAny =
    stats &&
    (Number(users.total) ||
      Number(revenue.totalUsd) ||
      Number(orders.total) ||
      Number(aiSignals.total) ||
      Number(watchlists.count));

  if (!hasAny) {
    return (
      <div className="card p-6">
        <EmptyState
          icon={Activity}
          title="هنوز داده‌ای ثبت نشده است"
          description="با فعال شدن کاربران و تراکنش‌ها، شاخص‌های کلیدی اینجا نمایش داده می‌شوند."
          compact
        />
      </div>
    );
  }

  const signupSeries = Array.isArray(signups)
    ? signups.map((d) => Number(d?.count) || 0)
    : [];

  const cards = [
    {
      key: 'users',
      icon: Users,
      tone: 'blue',
      label: 'کل کاربران',
      value: Number(users.total) || 0,
      delta:
        users.newToday != null
          ? { value: Number(users.newToday) || 0, label: 'ثبت‌نام امروز' }
          : null,
      points: signupSeries,
    },
    {
      key: 'premium',
      icon: Crown,
      tone: 'gold',
      label: 'کاربران پرمیوم',
      value: Number(users.premium) || 0,
    },
    {
      key: 'vip',
      icon: Star,
      tone: 'violet',
      label: 'کاربران VIP',
      value: Number(users.vip) || 0,
    },
    {
      key: 'active',
      icon: Activity,
      tone: 'green',
      label: 'کاربران فعال',
      value: Number(users.active) || 0,
      delta:
        users.new7d != null
          ? { value: Number(users.new7d) || 0, label: 'رشد ۷ روز اخیر' }
          : null,
      points: signupSeries,
    },
    {
      key: 'revenue',
      icon: DollarSign,
      tone: 'green',
      label: 'درآمد این ماه',
      value: Number(revenue.monthUsd) || 0,
      decimals: 0,
      suffix: 'دلار',
    },
    {
      key: 'orders',
      icon: ListChecks,
      tone: 'blue',
      label: 'کل سفارش‌ها',
      value: Number(orders.total) || 0,
    },
    {
      key: 'signals',
      icon: Sparkles,
      tone: 'violet',
      label: 'سیگنال‌های هوش مصنوعی',
      value: Number(aiSignals.total) || 0,
      delta:
        aiSignals.active != null
          ? { value: Number(aiSignals.active) || 0, label: 'فعال' }
          : null,
    },
    {
      key: 'watchlists',
      icon: Eye,
      tone: 'blue',
      label: 'واچ‌لیست‌ها',
      value: Number(watchlists.count) || 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <KpiCard
          key={c.key}
          icon={c.icon}
          tone={c.tone}
          label={c.label}
          value={c.value}
          decimals={c.decimals}
          prefix={c.prefix}
          suffix={c.suffix}
          delta={c.delta}
          points={c.points}
        />
      ))}
    </div>
  );
}
