import React, { useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Megaphone,
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  Clock,
  FileText,
  Radio,
} from 'lucide-react';

import { broadcastsAPI } from '../api/client';
import StatCard from '../components/common/StatCard';
import DataTable from '../components/common/DataTable';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { CardSkeleton } from '../components/common/Skeleton';
import { useToast } from '../components/common/Toast';
import useConfirm from '../hooks/useConfirm';
import { toPersianDigits, formatNumber, formatDateTime } from '../utils/formatters';

const PAGE_SIZE = 20;

// تب‌های فیلتر بر اساس وضعیت
const TABS = [
  { value: '', label: 'همه' },
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'scheduled', label: 'زمان‌بندی‌شده' },
  { value: 'sending', label: 'در حال ارسال' },
  { value: 'sent', label: 'ارسال‌شده' },
];

// نگاشتِ وضعیتِ پیام به برچسب/رنگ
const STATUS_MAP = {
  draft: { label: 'پیش‌نویس', variant: 'neutral' },
  scheduled: { label: 'زمان‌بندی‌شده', variant: 'warning' },
  sending: { label: 'در حال ارسال', variant: 'info' },
  sent: { label: 'ارسال‌شده', variant: 'success' },
  failed: { label: 'ناموفق', variant: 'danger' },
};

// نگاشتِ پلنِ هدف
const PLAN_LABELS = {
  all: 'همه کاربران',
  free: 'کاربران رایگان',
  premium: 'کاربران ویژه',
};

// اسکیمای فرمِ ساختِ پیام
const composeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'عنوان الزامی است')
    .max(200, 'عنوان حداکثر ۲۰۰ نویسه'),
  message: z
    .string()
    .trim()
    .min(1, 'متنِ پیام الزامی است')
    .max(4096, 'متن حداکثر ۴۰۹۶ نویسه'),
  target_plan: z.enum(['all', 'free', 'premium']),
  scheduled_at: z.string().optional(),
});

function BroadcastStatus({ status }) {
  const mapped = STATUS_MAP[status];
  if (!mapped) return <StatusBadge status={status} size="sm" />;
  return (
    <StatusBadge
      status={status}
      size="sm"
      label={mapped.label}
      variant={mapped.variant}
    />
  );
}

export default function BroadcastsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, confirmState } = useConfirm();

  const [tab, setTab] = useState('');
  const [page, setPage] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);

  // آمارِ کلیِ پیام‌رسانی
  const statsQuery = useQuery({
    queryKey: ['broadcasts-stats'],
    queryFn: () => broadcastsAPI.overview().then((r) => r.data),
  });

  // لیستِ پیام‌ها
  const listQuery = useQuery({
    queryKey: ['broadcasts', tab, page],
    queryFn: () =>
      broadcastsAPI
        .getAll({ status: tab || undefined, page, per_page: PAGE_SIZE })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });

  // فرمِ ساختِ پیام
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      title: '',
      message: '',
      target_plan: 'all',
      scheduled_at: '',
    },
  });

  const messageValue = watch('message') || '';

  // ساختِ پیامِ جدید (پیش‌نویس/زمان‌بندی)
  const createMutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        title: data.title,
        message: data.message,
        target_plan: data.target_plan,
        message_type: 'text',
      };
      if (data.scheduled_at) {
        payload.scheduled_at = new Date(data.scheduled_at).toISOString();
      }
      return broadcastsAPI.create(payload).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success('پیام با موفقیت ساخته شد.');
      setComposeOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts-stats'] });
    },
    onError: () => {
      toast.error('ساختِ پیام ناموفق بود.');
    },
  });

  // ارسالِ فوریِ پیام
  const sendMutation = useMutation({
    mutationFn: (id) => broadcastsAPI.send(id).then((r) => r.data),
    onSuccess: () => {
      toast.success('پیام برای ارسال در صف قرار گرفت.');
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      queryClient.invalidateQueries({ queryKey: ['broadcasts-stats'] });
    },
    onError: (err) => {
      const detail = err?.response?.data?.detail;
      toast.error(detail || 'ارسالِ پیام ناموفق بود.');
    },
  });

  const handleSend = async (row) => {
    const ok = await confirm(
      'ارسالِ پیام همگانی',
      `آیا از ارسالِ «${row.title || 'بدون عنوان'}» به ${
        PLAN_LABELS[row.target_plan] || 'همه کاربران'
      } اطمینان دارید؟ این عمل قابل بازگشت نیست.`,
      { variant: 'info', confirmText: 'ارسال' }
    );
    if (ok) {
      sendMutation.mutate(row.id);
    }
  };

  const onSubmit = (data) => createMutation.mutate(data);

  const stats = statsQuery.data || {};
  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const totalPages = listQuery.data?.total_pages || 0;

  const handleTabChange = (value) => {
    setTab(value);
    setPage(1);
  };

  // ── ستون‌های جدول ──
  const columns = [
    {
      key: 'title',
      header: 'عنوان',
      render: (v, row) => (
        <div className="min-w-0">
          <div className="font-medium text-text-primary truncate max-w-[220px]">
            {v || 'بدون عنوان'}
          </div>
          <div className="text-xs text-text-muted truncate max-w-[220px]">
            {row.message || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'target_plan',
      header: 'مخاطب',
      render: (v) => (
        <span className="text-sm text-text-secondary">
          {PLAN_LABELS[v] || v || 'همه کاربران'}
        </span>
      ),
    },
    {
      key: 'total_recipients',
      header: 'گیرندگان',
      render: (v) => (
        <span className="tabular-nums text-text-secondary">
          {toPersianDigits(formatNumber(v || 0))}
        </span>
      ),
    },
    {
      key: 'delivered',
      header: 'تحویل‌شده',
      render: (v) => (
        <span className="tabular-nums text-brand-green">
          {toPersianDigits(formatNumber(v || 0))}
        </span>
      ),
    },
    {
      key: 'failed',
      header: 'ناموفق',
      render: (v) =>
        v ? (
          <span className="tabular-nums text-brand-red">
            {toPersianDigits(formatNumber(v))}
          </span>
        ) : (
          <span className="text-text-muted">۰</span>
        ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (v) => <BroadcastStatus status={v} />,
    },
    {
      key: 'created_at',
      header: 'تاریخ ساخت',
      render: (v) =>
        v ? (
          <span className="text-xs text-text-muted whitespace-nowrap">
            {formatDateTime(v)}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      render: (_, row) => {
        const canSend = row.status === 'draft' || row.status === 'scheduled';
        if (!canSend) {
          return (
            <span className="text-xs text-text-muted">
              {row.sent_at ? formatDateTime(row.sent_at) : '—'}
            </span>
          );
        }
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSend(row);
            }}
            disabled={sendMutation.isPending}
            className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40"
            title="ارسال فوری"
          >
            <Send size={14} />
            ارسال
          </button>
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
            <Megaphone size={22} className="text-brand-blue" />
            پیام‌رسانی همگانی
          </h1>
          <p className="text-sm text-text-muted mt-1">
            ساخت و ارسالِ پیام‌های همگانی به کاربرانِ بازارنما به همراهِ آمارِ تحویل
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            setComposeOpen(true);
          }}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={18} />
          پیام جدید
        </button>
      </div>

      {/* کارت‌های آماری */}
      {statsQuery.isLoading ? (
        <CardSkeleton count={4} />
      ) : statsQuery.isError ? (
        <div className="card">
          <ErrorState compact onRetry={statsQuery.refetch} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Megaphone}
            title="کل پیام‌ها"
            value={toPersianDigits(formatNumber(stats.total_broadcasts || 0))}
            variant="info"
          />
          <StatCard
            icon={Users}
            title="مخاطبینِ فعال"
            value={toPersianDigits(formatNumber(stats.audience || 0))}
            variant="default"
          />
          <StatCard
            icon={CheckCircle2}
            title="تحویل‌شده"
            value={toPersianDigits(formatNumber(stats.total_delivered || 0))}
            change={stats.delivered_pct ?? null}
            variant="success"
          />
          <StatCard
            icon={XCircle}
            title="ناموفق"
            value={toPersianDigits(formatNumber(stats.total_failed || 0))}
            variant="danger"
          />
        </div>
      )}

      {/* تب‌های وضعیت */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.value || 'all'}
            type="button"
            onClick={() => handleTabChange(t.value)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value
                ? 'bg-brand-blue text-white'
                : 'bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-surface-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* جدول */}
      <div className="card">
        {listQuery.isError ? (
          <ErrorState onRetry={listQuery.refetch} />
        ) : !listQuery.isLoading && items.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="پیامی برای نمایش نیست"
            description={
              tab
                ? 'با این فیلتر پیامی یافت نشد. فیلترِ دیگری را امتحان کنید.'
                : 'هنوز پیامِ همگانی ساخته نشده است. با دکمهٔ «پیام جدید» اولین پیام را بسازید.'
            }
            action={
              !tab ? (
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setComposeOpen(true);
                  }}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus size={18} />
                  پیام جدید
                </button>
              ) : null
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            loading={listQuery.isLoading}
            emptyMessage="پیامی برای نمایش نیست"
            pagination={{
              page,
              totalPages,
              totalItems: total,
            }}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* مودالِ ساختِ پیام */}
      <Modal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        title="ساختِ پیامِ همگانی"
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              className="btn-ghost"
            >
              انصراف
            </button>
            <button
              type="submit"
              form="broadcast-compose-form"
              disabled={createMutation.isPending}
              className="btn-primary inline-flex items-center gap-2 disabled:opacity-40"
            >
              <FileText size={16} />
              {createMutation.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ پیام'}
            </button>
          </div>
        }
      >
        <form
          id="broadcast-compose-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          {/* عنوان */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              عنوان
            </label>
            <input
              type="text"
              {...register('title')}
              placeholder="عنوانِ پیام"
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-blue transition-colors"
            />
            {errors.title && (
              <p className="text-xs text-brand-red mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* متنِ پیام */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              متنِ پیام
            </label>
            <textarea
              rows={6}
              {...register('message')}
              placeholder="متنِ پیام را وارد کنید…"
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-blue transition-colors resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              {errors.message ? (
                <p className="text-xs text-brand-red">{errors.message.message}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-text-muted tabular-nums">
                {toPersianDigits(messageValue.length)} / {toPersianDigits(4096)}
              </span>
            </div>
          </div>

          {/* مخاطب و زمان‌بندی */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                مخاطب
              </label>
              <select
                {...register('target_plan')}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-blue transition-colors"
              >
                <option value="all">همه کاربران</option>
                <option value="free">کاربران رایگان</option>
                <option value="premium">کاربران ویژه</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5 flex items-center gap-1.5">
                <Clock size={14} />
                زمان‌بندی (اختیاری)
              </label>
              <input
                type="datetime-local"
                {...register('scheduled_at')}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-blue transition-colors"
              />
            </div>
          </div>

          <p className="text-xs text-text-muted">
            پیام ابتدا به‌صورتِ پیش‌نویس ذخیره می‌شود؛ سپس می‌توانید آن را از جدول ارسال کنید.
            در صورتِ تعیینِ زمان، به‌صورتِ زمان‌بندی‌شده ثبت می‌شود.
          </p>
        </form>
      </Modal>

      <ConfirmDialog {...confirmState} loading={sendMutation.isPending} />
    </div>
  );
}
