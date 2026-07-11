import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Eye,
  Users,
  Layers,
  UserPlus,
  Radio,
  Bot,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Link2,
  FileText,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

import { analyticsAPI } from '../api/client';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { CardSkeleton, ChartSkeleton } from '../components/common/Skeleton';
import { toPersianDigits, formatNumber, formatDateTime } from '../utils/formatters';

// ── بازه‌های زمانی ──
const RANGES = [
  { days: 1, label: 'امروز' },
  { days: 7, label: '۷ روز' },
  { days: 30, label: '۳۰ روز' },
  { days: 90, label: '۹۰ روز' },
];

// ── رنگ‌های نمودار (هم‌راستا با design tokens) ──
const CHART_COLORS = [
  '#2979FF',
  '#00C853',
  '#FF1744',
  '#FFB300',
  '#7C4DFF',
  '#00B8D4',
  '#FF6D00',
  '#EC407A',
];

// ── برچسب فارسیِ منابع ترافیک ──
const SOURCE_LABELS = {
  direct: 'مستقیم',
  search: 'جستجو',
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  social: 'شبکه اجتماعی',
  referral: 'ارجاع',
  email: 'ایمیل',
  ads: 'تبلیغات',
  organic: 'ارگانیک',
  unknown: 'نامشخص',
  نامشخص: 'نامشخص',
};

const DEVICE_LABELS = {
  desktop: 'دسکتاپ',
  mobile: 'موبایل',
  tablet: 'تبلت',
  bot: 'ربات',
  نامشخص: 'نامشخص',
};

const DEVICE_ICONS = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

function srcLabel(s) {
  if (!s) return 'نامشخص';
  return SOURCE_LABELS[String(s).toLowerCase()] || s;
}

function fmtTimelineLabel(iso, oneDay) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (oneDay) {
    return toPersianDigits(String(d.getHours()).padStart(2, '0')) + ':۰۰';
  }
  return toPersianDigits(
    new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(d)
  );
}

// ─────────────────────────────────────────────
// نمودار تایم‌لاین بازدید (Area)
// ─────────────────────────────────────────────
function TimelineChart({ timeline, oneDay }) {
  if (!timeline || timeline.length === 0) {
    return (
      <EmptyState
        icon={TrendingUp}
        compact
        title="داده‌ای برای این بازه نیست"
        description="با ثبت بازدیدهای جدید، نمودار روند اینجا نمایش داده می‌شود."
      />
    );
  }

  const data = timeline.map((r) => ({
    label: fmtTimelineLabel(r.t, oneDay),
    views: r.views || 0,
    visitors: r.visitors || 0,
  }));

  return (
    <div style={{ width: '100%', height: 300 }} dir="ltr">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2979FF" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#2979FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gVisitors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00C853" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#1f2937' }}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => toPersianDigits(v)}
          />
          <Tooltip
            contentStyle={{
              background: '#111827',
              border: '1px solid #1f2937',
              borderRadius: 12,
              fontSize: 12,
              direction: 'rtl',
            }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(value, name) => [
              toPersianDigits(formatNumber(value)),
              name === 'views' ? 'بازدید' : 'بازدیدکننده',
            ]}
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="#2979FF"
            strokeWidth={2}
            fill="url(#gViews)"
          />
          <Area
            type="monotone"
            dataKey="visitors"
            stroke="#00C853"
            strokeWidth={2}
            fill="url(#gVisitors)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─────────────────────────────────────────────
// نمودار دایره‌ای (منابع/دستگاه‌ها)
// ─────────────────────────────────────────────
function DonutChart({ rows, labelKey, mapLabel }) {
  const clean = (rows || []).filter((r) => (r.count || 0) > 0);
  if (clean.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        compact
        title="داده‌ای موجود نیست"
        description="پس از ثبت بازدید، تفکیک اینجا نمایش داده می‌شود."
      />
    );
  }
  const total = clean.reduce((s, r) => s + (r.count || 0), 0);
  const data = clean.map((r) => ({
    name: mapLabel ? mapLabel(r[labelKey]) : r[labelKey] || 'نامشخص',
    value: r.count || 0,
  }));

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div style={{ width: 180, height: 180 }} dir="ltr">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#111827',
                border: '1px solid #1f2937',
                borderRadius: 12,
                fontSize: 12,
                direction: 'rtl',
              }}
              formatter={(value, name) => [toPersianDigits(formatNumber(value)), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 w-full space-y-2">
        {data.slice(0, 6).map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-text-secondary flex-1 truncate">{d.name}</span>
              <span className="text-text-primary font-medium tabular-nums">
                {toPersianDigits(formatNumber(d.value))}
              </span>
              <span className="text-text-muted text-xs w-10 text-left tabular-nums">
                ٪{toPersianDigits(pct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// لیست رتبه‌بندی‌شده (کشور/صفحه/ارجاع)
// ─────────────────────────────────────────────
function RankList({ rows, labelKey, mapLabel, icon: Icon, emptyTitle }) {
  const clean = (rows || []).filter((r) => (r.count || 0) > 0);
  if (clean.length === 0) {
    return (
      <EmptyState icon={Icon || FileText} compact title={emptyTitle || 'موردی نیست'} />
    );
  }
  const max = Math.max(...clean.map((r) => r.count || 0), 1);

  return (
    <div className="space-y-2.5">
      {clean.map((r, i) => {
        const label = mapLabel ? mapLabel(r[labelKey]) : r[labelKey] || 'نامشخص';
        const pct = Math.round(((r.count || 0) / max) * 100);
        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-text-secondary truncate max-w-[75%]" title={label}>
                {label}
              </span>
              <span className="text-text-primary font-medium tabular-nums">
                {toPersianDigits(formatNumber(r.count || 0))}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-blue/70 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeviceIcon({ name, className }) {
  const key = String(name || '').toLowerCase();
  const Icon = DEVICE_ICONS[key] || Monitor;
  return <Icon size={16} className={className} />;
}

// ─────────────────────────────────────────────
// صفحه اصلی
// ─────────────────────────────────────────────
export default function AnalyticsPage() {
  const [days, setDays] = useState(7);

  const overviewQuery = useQuery({
    queryKey: ['analytics-overview', days],
    queryFn: () => analyticsAPI.getOverview(days).then((r) => r.data),
    keepPreviousData: true,
  });

  const onlineQuery = useQuery({
    queryKey: ['analytics-online'],
    queryFn: () => analyticsAPI.getOnline().then((r) => r.data),
    refetchInterval: 20000,
  });

  const liveQuery = useQuery({
    queryKey: ['analytics-live'],
    queryFn: () => analyticsAPI.getLive({ limit: 25 }).then((r) => r.data),
    refetchInterval: 20000,
  });

  const data = overviewQuery.data;
  const cards = data?.cards || {};
  const online = onlineQuery.data?.online ?? 0;
  const liveItems = liveQuery.data?.items || [];

  // ── سرتیتر + انتخاب بازه ──
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <BarChart3 size={22} className="text-brand-blue" />
          آنالیتیکس بازدید
        </h1>
        <p className="text-sm text-text-muted mt-1">
          بازدیدها، کاربران آنلاین، منابع ترافیک، دستگاه‌ها و کشورها
        </p>
      </div>
      <div className="flex items-center gap-3">
        {/* شمارنده آنلاین */}
        <div className="flex items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 py-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-green" />
          </span>
          <span className="text-sm text-text-secondary">آنلاین:</span>
          <span className="text-sm font-bold text-brand-green tabular-nums">
            {onlineQuery.isLoading ? '…' : toPersianDigits(online)}
          </span>
        </div>
        {/* انتخاب بازه */}
        <div className="flex items-center gap-1 bg-surface-elevated rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                days === r.days
                  ? 'bg-brand-blue text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── وضعیت خطا (کل صفحه به overview وابسته است) ──
  if (overviewQuery.isError) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card">
          <ErrorState onRetry={overviewQuery.refetch} />
        </div>
      </div>
    );
  }

  const loading = overviewQuery.isLoading;

  return (
    <div className="space-y-6">
      {header}

      {/* ── کارت‌های کلیدی ── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Eye}
            variant="info"
            title="بازدید کل"
            value={toPersianDigits(formatNumber(cards.pageviews ?? 0))}
          />
          <StatCard
            icon={Users}
            variant="success"
            title="بازدیدکننده یکتا"
            value={toPersianDigits(formatNumber(cards.visitors ?? 0))}
          />
          <StatCard
            icon={Layers}
            variant="default"
            title="نشست‌ها"
            value={toPersianDigits(formatNumber(cards.sessions ?? 0))}
          />
          <StatCard
            icon={UserPlus}
            variant="success"
            title="بازدیدکننده جدید"
            value={toPersianDigits(formatNumber(cards.new_visitors ?? 0))}
          />
        </div>
      )}

      {/* ── کارت‌های فرعی ── */}
      {loading ? (
        <CardSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Radio}
            variant="info"
            title="بازدید امروز"
            value={toPersianDigits(formatNumber(cards.today_views ?? 0))}
          />
          <StatCard
            icon={Users}
            variant="default"
            title="بازدیدکننده امروز"
            value={toPersianDigits(formatNumber(cards.today_visitors ?? 0))}
          />
          <StatCard
            icon={UserPlus}
            variant="default"
            title="بازگشتی"
            value={toPersianDigits(formatNumber(cards.returning_visitors ?? 0))}
          />
          <StatCard
            icon={Bot}
            variant="warning"
            title="ربات‌ها"
            value={toPersianDigits(formatNumber(cards.bots ?? 0))}
          />
        </div>
      )}

      {/* ── نمودار روند بازدید ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <TrendingUp size={18} className="text-brand-blue" />
            روند بازدید
          </h2>
          {!loading && (
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-blue" /> بازدید
              </span>
              <span className="flex items-center gap-1.5 text-text-secondary">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-green" /> بازدیدکننده
              </span>
            </div>
          )}
        </div>
        {loading ? (
          <ChartSkeleton height={300} />
        ) : (
          <TimelineChart timeline={data?.timeline} oneDay={days <= 1} />
        )}
      </div>

      {/* ── منابع ترافیک + دستگاه‌ها ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
            <Link2 size={18} className="text-brand-blue" />
            منابع ترافیک
          </h2>
          {loading ? (
            <ChartSkeleton height={180} />
          ) : (
            <DonutChart rows={data?.sources} labelKey="source" mapLabel={srcLabel} />
          )}
        </div>

        <div className="card">
          <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
            <Smartphone size={18} className="text-brand-blue" />
            دستگاه‌ها
          </h2>
          {loading ? (
            <ChartSkeleton height={180} />
          ) : (
            <DonutChart
              rows={data?.devices}
              labelKey="device"
              mapLabel={(d) => DEVICE_LABELS[String(d).toLowerCase()] || d || 'نامشخص'}
            />
          )}
        </div>
      </div>

      {/* ── کشورها + صفحات پربازدید + ارجاع‌دهنده‌ها ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
            <Globe size={18} className="text-brand-blue" />
            کشورها
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 rounded bg-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : (
            <RankList
              rows={data?.countries}
              labelKey="country"
              icon={Globe}
              emptyTitle="کشوری ثبت نشده"
            />
          )}
        </div>

        <div className="card">
          <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
            <FileText size={18} className="text-brand-blue" />
            صفحات پربازدید
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 rounded bg-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : (
            <RankList
              rows={data?.top_pages}
              labelKey="path"
              icon={FileText}
              emptyTitle="صفحه‌ای ثبت نشده"
            />
          )}
        </div>

        <div className="card">
          <h2 className="text-base font-bold text-text-primary mb-4 flex items-center gap-2">
            <Link2 size={18} className="text-brand-blue" />
            ارجاع‌دهنده‌ها
          </h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-6 rounded bg-surface-elevated animate-pulse" />
              ))}
            </div>
          ) : (
            <RankList
              rows={data?.referrers}
              labelKey="host"
              icon={Link2}
              emptyTitle="ارجاعی ثبت نشده"
            />
          )}
        </div>
      </div>

      {/* ── فید زندهٔ آخرین بازدیدها ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Radio size={18} className="text-brand-green" />
            آخرین بازدیدها
          </h2>
          <span className="text-xs text-text-muted">به‌روزرسانی خودکار</span>
        </div>

        {liveQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : liveQuery.isError ? (
          <ErrorState compact onRetry={liveQuery.refetch} />
        ) : liveItems.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="بازدید زنده‌ای نیست"
            description="آخرین بازدیدهای انسانی به‌محض ثبت اینجا نمایش داده می‌شوند."
          />
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th className="px-4 py-3 text-right text-text-secondary font-medium">زمان</th>
                  <th className="px-4 py-3 text-right text-text-secondary font-medium">صفحه</th>
                  <th className="px-4 py-3 text-right text-text-secondary font-medium">منبع</th>
                  <th className="px-4 py-3 text-right text-text-secondary font-medium">دستگاه</th>
                  <th className="px-4 py-3 text-right text-text-secondary font-medium">کشور</th>
                  <th className="px-4 py-3 text-right text-text-secondary font-medium">نوع</th>
                </tr>
              </thead>
              <tbody>
                {liveItems.map((v, i) => (
                  <tr key={i} className="hover:bg-surface-hover transition-colors">
                    <td className="px-4 py-3 text-right border-t border-surface-border text-text-secondary whitespace-nowrap text-xs">
                      {v.ts ? formatDateTime(v.ts) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right border-t border-surface-border">
                      <span
                        className="font-mono text-xs text-text-primary block max-w-[220px] truncate"
                        dir="ltr"
                        title={v.path}
                      >
                        {v.path || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right border-t border-surface-border">
                      <span className="text-text-secondary text-sm">{srcLabel(v.source)}</span>
                      {v.source_detail && (
                        <span className="block text-[11px] text-text-muted truncate max-w-[140px]">
                          {v.source_detail}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right border-t border-surface-border">
                      <span className="inline-flex items-center gap-1.5 text-text-secondary text-sm">
                        <DeviceIcon name={v.device} className="text-text-muted" />
                        {DEVICE_LABELS[String(v.device || '').toLowerCase()] || v.device || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right border-t border-surface-border text-text-secondary text-sm">
                      {v.country || '—'}
                      {v.city && (
                        <span className="block text-[11px] text-text-muted">{v.city}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right border-t border-surface-border">
                      {v.is_new_visitor ? (
                        <span className="badge badge-green">جدید</span>
                      ) : (
                        <span className="badge">بازگشتی</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
