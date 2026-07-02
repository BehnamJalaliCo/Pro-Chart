import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Newspaper,
  CalendarDays,
  RefreshCw,
  ExternalLink,
  Flame,
} from 'lucide-react';

import { bnAPI } from '../api/client';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import DataTable from '../components/common/DataTable';
import { SkeletonBox, SkeletonText, TableSkeleton } from '../components/common/Skeleton';
import { toPersianDigits, formatDateTime } from '../utils/formatters';

const TABS = [
  { key: 'news', label: 'اخبار بازار', icon: Newspaper },
  { key: 'calendar', label: 'تقویم اقتصادی', icon: CalendarDays },
];

// نگاشتِ درجهٔ اهمیتِ تقویم به کلاسِ رنگ
const IMPACT_META = {
  high: { label: 'زیاد', cls: 'badge-red' },
  medium: { label: 'متوسط', cls: 'badge bg-yellow-500/15 text-yellow-500' },
  low: { label: 'کم', cls: 'badge' },
};

// امتیازِ خبر (عددی) → برچسبِ اهمیت
function newsImpactBadge(score) {
  const s = Number(score) || 0;
  if (s >= 3) {
    return (
      <span className="badge-red inline-flex items-center gap-1">
        <Flame size={11} />
        پرتأثیر
      </span>
    );
  }
  if (s >= 1) {
    return (
      <span className="badge bg-yellow-500/15 text-yellow-500">قابل‌توجه</span>
    );
  }
  return null;
}

function NewsCard({ item }) {
  const when = item.ts ? formatDateTime(Number(item.ts) * 1000) : '';
  return (
    <div className="card hover:bg-surface-hover transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {(item.source || item.src) && (
            <span className="badge-blue">{item.source || item.src}</span>
          )}
          {newsImpactBadge(item.impact)}
        </div>
        {when && (
          <span className="text-xs text-text-muted whitespace-nowrap">
            {when}
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-text-primary leading-6 mb-1.5">
        {item.title || 'بدون عنوان'}
      </h3>

      {item.summary && (
        <p className="text-sm text-text-secondary leading-7">{item.summary}</p>
      )}

      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-xs text-brand-blue hover:underline"
        >
          <ExternalLink size={13} />
          مشاهدهٔ منبع
        </a>
      )}
    </div>
  );
}

function NewsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card">
          <div className="flex items-center justify-between mb-3">
            <SkeletonBox className="h-5 w-24" />
            <SkeletonBox className="h-4 w-20" />
          </div>
          <SkeletonBox className="h-4 w-3/4 mb-3" />
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}

export default function NewsPage() {
  const [tab, setTab] = useState('news');

  const newsQuery = useQuery({
    queryKey: ['bn-news'],
    queryFn: () => bnAPI.getNews(),
    enabled: tab === 'news',
  });

  const calendarQuery = useQuery({
    queryKey: ['bn-calendar'],
    queryFn: () => bnAPI.getCalendar(),
    enabled: tab === 'calendar',
  });

  const newsItems = newsQuery.data?.items || [];
  const calendarItems = calendarQuery.data?.items || [];

  const activeQuery = tab === 'news' ? newsQuery : calendarQuery;

  // ستون‌های تقویمِ اقتصادی
  const calendarColumns = [
    {
      key: 'country',
      header: 'کشور / ارز',
      sortable: false,
      render: (v) =>
        v ? (
          <span className="font-medium text-text-primary">{v}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'title',
      header: 'رویداد',
      sortable: false,
      render: (v) => (
        <span className="text-text-secondary">{v || 'بدون عنوان'}</span>
      ),
    },
    {
      key: 'impact',
      header: 'اهمیت',
      sortable: false,
      render: (v) => {
        const meta = IMPACT_META[v] || IMPACT_META.low;
        return <span className={meta.cls}>{meta.label}</span>;
      },
    },
    {
      key: 'forecast',
      header: 'پیش‌بینی',
      sortable: false,
      render: (v) =>
        v ? (
          <span className="tabular-nums text-text-primary">
            {toPersianDigits(v)}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'previous',
      header: 'قبلی',
      sortable: false,
      render: (v) =>
        v ? (
          <span className="tabular-nums text-text-secondary">
            {toPersianDigits(v)}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'date',
      header: 'زمان',
      sortable: false,
      render: (v) => {
        const t = v ? formatDateTime(v) : '';
        return t ? (
          <span className="text-xs text-text-muted whitespace-nowrap">{t}</span>
        ) : (
          <span className="text-text-muted">—</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* سرصفحه */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Newspaper size={22} className="text-brand-blue" />
            اخبار و تقویم اقتصادی
          </h1>
          <p className="text-sm text-text-muted mt-1">
            مهم‌ترین اخبارِ مؤثر بر بازار و رویدادهای اقتصادیِ پیشِ‌رو
          </p>
        </div>
        <button
          type="button"
          onClick={() => activeQuery.refetch()}
          disabled={activeQuery.isFetching}
          className="btn-ghost inline-flex items-center gap-2"
        >
          <RefreshCw
            size={16}
            className={activeQuery.isFetching ? 'animate-spin' : ''}
          />
          به‌روزرسانی
        </button>
      </div>

      {/* تب‌ها */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2 ${
                active
                  ? 'bg-brand-blue text-white'
                  : 'bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-surface-border'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* محتوای تبِ اخبار */}
      {tab === 'news' &&
        (newsQuery.isLoading ? (
          <NewsSkeleton />
        ) : newsQuery.isError ? (
          <div className="card">
            <ErrorState onRetry={newsQuery.refetch} />
          </div>
        ) : newsItems.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Newspaper}
              title="خبری برای نمایش نیست"
              description="در حال حاضر خبرِ منتشرشده‌ای وجود ندارد. اخبار به‌صورتِ خودکار از منابعِ بازار جمع‌آوری و به‌روزرسانی می‌شوند."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {newsItems.map((item, i) => (
              <NewsCard key={item.url || item.title || i} item={item} />
            ))}
          </div>
        ))}

      {/* محتوای تبِ تقویم */}
      {tab === 'calendar' && (
        <div className="card">
          {calendarQuery.isLoading ? (
            <TableSkeleton columns={6} rows={6} />
          ) : calendarQuery.isError ? (
            <ErrorState onRetry={calendarQuery.refetch} />
          ) : calendarItems.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="رویدادی در تقویم نیست"
              description="رویدادِ اقتصادیِ ثبت‌شده‌ای وجود ندارد. تقویم به‌صورتِ خودکار از منابعِ معتبر به‌روزرسانی می‌شود."
            />
          ) : (
            <DataTable
              columns={calendarColumns}
              data={calendarItems}
              emptyMessage="رویدادی در تقویم نیست"
            />
          )}
        </div>
      )}
    </div>
  );
}
