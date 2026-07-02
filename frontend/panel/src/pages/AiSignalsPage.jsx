import React, { useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  Sparkles,
  Activity,
  Target,
  ShieldCheck,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

import { bnAPI } from '../api/client';
import StatCard from '../components/common/StatCard';
import DataTable from '../components/common/DataTable';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { CardSkeleton } from '../components/common/Skeleton';
import { useToast } from '../components/common/Toast';
import useConfirm from '../hooks/useConfirm';
import { toPersianDigits, formatDateTime } from '../utils/formatters';

const PAGE_SIZE = 25;

// فیلترهای وضعیت
const STATUS_FILTERS = [
  { value: '', label: 'همه' },
  { value: 'active', label: 'فعال' },
  { value: 'closed', label: 'بسته‌شده' },
  { value: 'deleted', label: 'حذف‌شده' },
];

// نگاشتِ ستونِ hit به StatusBadge
const HIT_MAP = {
  tp1: { status: 'tp1_hit' },
  tp2: { status: 'tp2_hit' },
  tp3: { status: 'tp3_hit' },
  sl: { status: 'sl_hit' },
};

function DirectionCell({ direction }) {
  const d = (direction || '').toLowerCase();
  const isBuy = d === 'buy' || d === 'long';
  const isSell = d === 'sell' || d === 'short';
  if (!isBuy && !isSell) {
    return <span className="text-text-muted">{direction || '-'}</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${
        isBuy ? 'text-brand-green' : 'text-brand-red'
      }`}
    >
      {isBuy ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {isBuy ? 'خرید' : 'فروش'}
    </span>
  );
}

function PriceCell({ value }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-text-muted">—</span>;
  }
  return <span className="tabular-nums">{toPersianDigits(value)}</span>;
}

export default function AiSignalsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, confirmState } = useConfirm();

  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // آمارِ سیگنال‌ها
  const statsQuery = useQuery({
    queryKey: ['bn-ai-signals-stats'],
    queryFn: () => bnAPI.getAiSignalsStats(),
  });

  // لیستِ سیگنال‌ها
  const listQuery = useQuery({
    queryKey: ['bn-ai-signals', statusFilter, page],
    queryFn: () =>
      bnAPI.getAiSignals({ status: statusFilter, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  // حذفِ نرمِ سیگنال
  const deleteMutation = useMutation({
    mutationFn: (id) => bnAPI.deleteAiSignal(id),
    onSuccess: () => {
      toast.success('سیگنال حذف شد.');
      queryClient.invalidateQueries({ queryKey: ['bn-ai-signals'] });
      queryClient.invalidateQueries({ queryKey: ['bn-ai-signals-stats'] });
    },
    onError: () => {
      toast.error('حذفِ سیگنال ناموفق بود.');
    },
  });

  const handleDelete = async (row) => {
    const ok = await confirm(
      'حذفِ سیگنال',
      `آیا از حذفِ سیگنالِ ${row.symbol} (${row.tf}) اطمینان دارید؟`,
      { variant: 'danger', confirmText: 'حذف' }
    );
    if (ok) {
      deleteMutation.mutate(row.id);
    }
  };

  const stats = statsQuery.data || {};
  const items = listQuery.data?.items || [];
  const total = listQuery.data?.total || 0;
  const totalPages = listQuery.data?.pages || 0;

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  // ── ستون‌های جدول ──
  const columns = [
    {
      key: 'symbol',
      header: 'نماد',
      render: (v) => <span className="font-medium text-text-primary">{v || '-'}</span>,
    },
    {
      key: 'tf',
      header: 'تایم‌فریم',
      render: (v) => <span className="text-text-secondary">{v || '-'}</span>,
    },
    {
      key: 'direction',
      header: 'جهت',
      render: (v) => <DirectionCell direction={v} />,
    },
    { key: 'entry', header: 'ورود', render: (v) => <PriceCell value={v} /> },
    { key: 'sl', header: 'حد ضرر', render: (v) => <PriceCell value={v} /> },
    { key: 'tp1', header: 'هدف ۱', render: (v) => <PriceCell value={v} /> },
    { key: 'tp2', header: 'هدف ۲', render: (v) => <PriceCell value={v} /> },
    { key: 'tp3', header: 'هدف ۳', render: (v) => <PriceCell value={v} /> },
    {
      key: 'confidence',
      header: 'اطمینان',
      render: (v) =>
        v === null || v === undefined ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="tabular-nums text-text-primary">
            {toPersianDigits(v)}٪
          </span>
        ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (v) => <StatusBadge status={v} size="sm" />,
    },
    {
      key: 'hit',
      header: 'برخورد',
      sortable: false,
      render: (v) => {
        const mapped = HIT_MAP[v];
        if (!mapped) return <span className="text-text-muted">—</span>;
        return <StatusBadge status={mapped.status} size="sm" />;
      },
    },
    {
      key: 'createdAt',
      header: 'تاریخ',
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
      render: (_, row) =>
        row.status === 'deleted' ? null : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row);
            }}
            disabled={deleteMutation.isPending}
            className="p-1.5 rounded-lg text-text-muted hover:bg-brand-red/15 hover:text-brand-red transition-colors disabled:opacity-40"
            title="حذف سیگنال"
          >
            <Trash2 size={16} />
          </button>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* سرصفحه */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Sparkles size={22} className="text-brand-blue" />
            سیگنال‌های هوش مصنوعی
          </h1>
          <p className="text-sm text-text-muted mt-1">
            سیگنال‌های لحظه‌ای تولیدشده توسط موتور AI به همراه ستاپِ کامل و ردیابیِ برخورد
          </p>
        </div>
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
            icon={Sparkles}
            title="کل سیگنال‌ها"
            value={toPersianDigits(stats.total || 0)}
            variant="info"
          />
          <StatCard
            icon={Activity}
            title="سیگنال‌های فعال"
            value={toPersianDigits(stats.active || 0)}
            variant="success"
          />
          <StatCard
            icon={Target}
            title="نرخ برد"
            value={`${toPersianDigits(stats.hitRate ?? 0)}٪`}
            variant="warning"
          />
          <StatCard
            icon={ShieldCheck}
            title="برخورد هدف / حد ضرر"
            value={`${toPersianDigits(
              (stats.tp1 || 0) + (stats.tp2 || 0) + (stats.tp3 || 0)
            )} / ${toPersianDigits(stats.sl || 0)}`}
            variant="default"
          />
        </div>
      )}

      {/* فیلترها */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            onClick={() => handleStatusChange(f.value)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.value
                ? 'bg-brand-blue text-white'
                : 'bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-surface-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* جدول */}
      <div className="card">
        {listQuery.isError ? (
          <ErrorState onRetry={listQuery.refetch} />
        ) : !listQuery.isLoading && items.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="سیگنالی برای نمایش نیست"
            description={
              statusFilter
                ? 'با این فیلتر سیگنالی یافت نشد. فیلتر دیگری را امتحان کنید.'
                : 'هنوز هیچ سیگنالِ AI ثبت نشده است. با تولیدِ سیگنال‌ها، اینجا نمایش داده می‌شوند.'
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            loading={listQuery.isLoading}
            emptyMessage="سیگنالی برای نمایش نیست"
            pagination={{
              page,
              totalPages,
              totalItems: total,
            }}
            onPageChange={setPage}
          />
        )}
      </div>

      <ConfirmDialog {...confirmState} loading={deleteMutation.isPending} />
    </div>
  );
}
