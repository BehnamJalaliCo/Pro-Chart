import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  ScrollText,
  RefreshCw,
  ShieldCheck,
  Info,
  ExternalLink,
  Globe,
  Users,
  CreditCard,
  Megaphone,
  Sparkles,
  Activity,
  ChevronDown,
} from 'lucide-react';

import { bnAPI } from '../api/client';
import { useAuthStore } from '../store';
import StatCard from '../components/common/StatCard';
import DataTable from '../components/common/DataTable';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import SearchInput from '../components/common/SearchInput';
import { CardSkeleton } from '../components/common/Skeleton';
import {
  toPersianDigits,
  formatDateTime,
  formatRelativeTime,
} from '../utils/formatters';

// نسخه و برند
const APP_NAME = 'بازارنما';
const APP_NAME_EN = 'BazaarNama';
const APP_VERSION = '1.0.0';
const APP_URL = 'https://pro-chart.ir';

// نگاشتِ کنشِ audit به برچسبِ فارسیِ خوانا (fallback: خودِ کنش)
const ACTION_LABELS = {
  create: 'ایجاد',
  update: 'ویرایش',
  delete: 'حذف',
  cancel: 'لغو',
  approve: 'تأیید',
  reject: 'رد',
  extend: 'تمدید',
  reset_password: 'بازنشانی رمز',
  set_tier: 'تغییر سطح',
  set_status: 'تغییر وضعیت',
  login: 'ورود',
  logout: 'خروج',
};

// نگاشتِ نوعِ موجودیت به برچسبِ فارسی
const ENTITY_LABELS = {
  user: 'کاربر',
  users: 'کاربر',
  order: 'سفارش',
  subscription: 'اشتراک',
  payment: 'پرداخت',
  ad: 'تبلیغ',
  ads: 'تبلیغ',
  signal: 'سیگنال',
  ai_signal: 'سیگنال AI',
  exchange_account: 'حساب صرافی',
  broadcast: 'پیام‌رسانی',
  student: 'دانشجو',
};

function actionLabel(action) {
  if (!action) return '—';
  const key = String(action).toLowerCase();
  return ACTION_LABELS[key] || action;
}

function entityLabel(type) {
  if (!type) return '—';
  const key = String(type).toLowerCase();
  return ENTITY_LABELS[key] || type;
}

// دسترسیِ سریع به بخش‌های پرکاربردِ پنل
const QUICK_LINKS = [
  { to: '/users', label: 'کاربران', icon: Users },
  { to: '/subscriptions', label: 'اشتراک‌ها و پرداخت‌ها', icon: CreditCard },
  { to: '/ai-signals', label: 'سیگنال‌های AI', icon: Sparkles },
  { to: '/ads', label: 'تبلیغات', icon: Megaphone },
];

const PAGE_SIZE = 15;

// ردیفِ جزئیاتِ قابل‌گسترش برای details JSON
function DetailsCell({ details }) {
  const [open, setOpen] = useState(false);
  const hasDetails =
    details && typeof details === 'object' && Object.keys(details).length > 0;

  if (!hasDetails) {
    return <span className="text-text-muted">—</span>;
  }

  return (
    <div className="max-w-xs">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 text-xs text-brand-blue hover:text-brand-blue/80 transition-colors"
      >
        <ChevronDown
          size={13}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
        {open ? 'بستن' : 'مشاهده'}
      </button>
      {open && (
        <pre
          dir="ltr"
          className="mt-2 max-h-40 overflow-auto rounded-lg bg-surface-elevated p-2 text-[11px] leading-relaxed text-text-secondary whitespace-pre-wrap break-all"
        >
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const auditQuery = useQuery({
    queryKey: ['bn-audit'],
    queryFn: () => bnAPI.getAudit(200),
  });

  const logs = Array.isArray(auditQuery.data) ? auditQuery.data : [];

  // فیلترِ سمتِ کلاینت روی کنش/موجودیت
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const hay = [
        l.action,
        l.entityType,
        l.entityId,
        actionLabel(l.action),
        entityLabel(l.entityType),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [logs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () =>
      filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  // شمارشِ کنش‌های امروز
  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return logs.filter((l) => {
      if (!l.createdAt) return false;
      const t = new Date(l.createdAt).getTime();
      return !Number.isNaN(t) && t >= start.getTime();
    }).length;
  }, [logs]);

  const lastLog = logs[0];

  const columns = [
    {
      key: 'createdAt',
      header: 'زمان',
      render: (v) =>
        v ? (
          <div className="whitespace-nowrap">
            <span className="block text-xs text-text-primary">
              {formatDateTime(v)}
            </span>
            <span className="block text-[11px] text-text-muted">
              {formatRelativeTime(v)}
            </span>
          </div>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'action',
      header: 'کنش',
      render: (v) => (
        <span className="badge badge-blue">{actionLabel(v)}</span>
      ),
    },
    {
      key: 'entityType',
      header: 'موجودیت',
      render: (v, row) => (
        <span className="text-text-secondary">
          {entityLabel(v)}
          {row.entityId ? (
            <span className="text-text-muted">
              {' '}
              #{toPersianDigits(row.entityId)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'adminId',
      header: 'ادمین',
      render: (v) =>
        v === null || v === undefined ? (
          <span className="text-text-muted">سیستم</span>
        ) : (
          <span className="text-text-secondary tabular-nums">
            #{toPersianDigits(v)}
          </span>
        ),
    },
    {
      key: 'details',
      header: 'جزئیات',
      sortable: false,
      render: (v) => <DetailsCell details={v} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* سرصفحه */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <SettingsIcon size={22} className="text-brand-blue" />
            تنظیمات و لاگ فعالیت
          </h1>
          <p className="text-sm text-text-muted mt-1">
            گزارشِ فعالیتِ ادمین، اطلاعاتِ نسخه و برند، و دسترسیِ سریع به بخش‌های پنل
          </p>
        </div>
        <button
          type="button"
          onClick={() => auditQuery.refetch()}
          disabled={auditQuery.isFetching}
          className="btn-ghost flex items-center gap-2"
        >
          <RefreshCw
            size={16}
            className={auditQuery.isFetching ? 'animate-spin' : ''}
          />
          بروزرسانی
        </button>
      </div>

      {/* اطلاعات نسخه و برند */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Info size={18} className="text-brand-blue" />
            <h2 className="text-base font-semibold text-text-primary">
              اطلاعات نسخه و برند
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow label="نام محصول" value={`${APP_NAME} (${APP_NAME_EN})`} />
            <InfoRow
              label="نسخهٔ پنل"
              value={toPersianDigits(APP_VERSION)}
            />
            <InfoRow
              label="نشانی سایت"
              value={
                <a
                  href={APP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-blue hover:text-brand-blue/80 transition-colors"
                  dir="ltr"
                >
                  pro-chart.ir
                  <ExternalLink size={13} />
                </a>
              }
            />
            <InfoRow
              label="ادمینِ واردشده"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-brand-green" />
                  {user?.username || user?.name || 'behnamjalali'}
                </span>
              }
            />
          </div>
        </div>

        {/* دسترسی سریع */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-brand-blue" />
            <h2 className="text-base font-semibold text-text-primary">
              دسترسی سریع
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface-card p-4 text-center hover:bg-surface-hover hover:border-brand-blue/40 transition-colors"
                >
                  <Icon size={20} className="text-brand-blue" />
                  <span className="text-xs text-text-secondary">
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* آمارِ فعالیت */}
      {auditQuery.isLoading ? (
        <CardSkeleton count={3} />
      ) : auditQuery.isError ? null : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={ScrollText}
            title="کل رکوردهای فعالیت"
            value={toPersianDigits(logs.length)}
            variant="info"
          />
          <StatCard
            icon={Activity}
            title="فعالیت‌های امروز"
            value={toPersianDigits(todayCount)}
            variant="success"
          />
          <StatCard
            icon={RefreshCw}
            title="آخرین فعالیت"
            value={
              lastLog?.createdAt
                ? formatRelativeTime(lastLog.createdAt)
                : '—'
            }
            variant="default"
          />
        </div>
      )}

      {/* لاگِ فعالیتِ ادمین */}
      <div className="card">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-2">
            <ScrollText size={18} className="text-brand-blue" />
            <h2 className="text-base font-semibold text-text-primary">
              لاگ فعالیت ادمین
            </h2>
          </div>
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="جستجو در کنش یا موجودیت..."
            className="w-full sm:w-64"
          />
        </div>

        {auditQuery.isError ? (
          <ErrorState onRetry={auditQuery.refetch} />
        ) : !auditQuery.isLoading && logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="هنوز فعالیتی ثبت نشده است"
            description="با انجامِ عملیاتِ مدیریتی (ایجاد، ویرایش، تأیید و ...)، رکوردهای فعالیت اینجا نمایش داده می‌شوند."
          />
        ) : !auditQuery.isLoading && filtered.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="نتیجه‌ای یافت نشد"
            description="با این عبارتِ جستجو رکوردی پیدا نشد. عبارت دیگری را امتحان کنید."
          />
        ) : (
          <DataTable
            columns={columns}
            data={pageItems}
            loading={auditQuery.isLoading}
            emptyMessage="رکوردی برای نمایش نیست"
            pagination={{
              page: currentPage,
              totalPages,
              totalItems: filtered.length,
            }}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  );
}
