import React, { useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Filter,
  Eye,
  Send,
  Bitcoin,
  LineChart,
} from 'lucide-react';
import { bnAPI } from '../api/client';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';
import { useConfirm } from '../hooks/useConfirm';
import {
  toPersianDigits,
  formatNumber,
  formatDateTime,
} from '../utils/formatters';

const PAGE_SIZE = 25;

// ── نگاشتِ وضعیت‌ها به برچسبِ فارسی + variantِ StatusBadge ──
const STATUS_META = {
  pending: { label: 'در انتظار', variant: 'warning' },
  sent: { label: 'ارسال‌شده', variant: 'info' },
  filled: { label: 'اجراشده', variant: 'success' },
  failed: { label: 'ناموفق', variant: 'danger' },
  canceled: { label: 'لغوشده', variant: 'neutral' },
};

const STATUS_FILTERS = [
  { value: '', label: 'همهٔ وضعیت‌ها' },
  { value: 'pending', label: 'در انتظار' },
  { value: 'sent', label: 'ارسال‌شده' },
  { value: 'filled', label: 'اجراشده' },
  { value: 'failed', label: 'ناموفق' },
  { value: 'canceled', label: 'لغوشده' },
];

const MARKET_FILTERS = [
  { value: '', label: 'همهٔ بازارها' },
  { value: 'crypto', label: 'کریپتو' },
  { value: 'forex', label: 'فارکس' },
];

const MARKET_META = {
  crypto: { label: 'کریپتو', icon: Bitcoin },
  forex: { label: 'فارکس', icon: LineChart },
};

const SIDE_META = {
  buy: { label: 'خرید', className: 'text-brand-green' },
  sell: { label: 'فروش', className: 'text-brand-red' },
  long: { label: 'خرید', className: 'text-brand-green' },
  short: { label: 'فروش', className: 'text-brand-red' },
};

function OrderStatus({ status }) {
  const meta = STATUS_META[status];
  if (!meta) return <StatusBadge status={status} />;
  return <StatusBadge status={status} variant={meta.variant} label={meta.label} />;
}

function MarketCell({ market }) {
  const meta = MARKET_META[market];
  if (!meta) return <span className="text-text-muted">{market || '-'}</span>;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-text-secondary">
      <Icon size={14} className="text-text-muted" />
      {meta.label}
    </span>
  );
}

function SideCell({ side }) {
  if (!side) return <span className="text-text-muted">-</span>;
  const meta = SIDE_META[String(side).toLowerCase()] || {
    label: side,
    className: 'text-text-secondary',
  };
  return <span className={`font-medium ${meta.className}`}>{meta.label}</span>;
}

function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '-';
  return toPersianDigits(formatNumber(v));
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-surface-border last:border-0">
      <span className="text-sm text-text-muted shrink-0">{label}</span>
      <span className="text-sm text-text-primary text-left break-all">{children}</span>
    </div>
  );
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, confirmState } = useConfirm();

  const [statusFilter, setStatusFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(marketFilter ? { market: marketFilter } : {}),
    }),
    [page, statusFilter, marketFilter]
  );

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['bn-orders', queryParams],
    queryFn: () => bnAPI.getOrders(queryParams),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 0;

  // شمارشِ کارت‌های آماری بر اساس همین صفحه (بدون endpointِ آماریِ جدا)
  const pageCounts = useMemo(() => {
    const c = { pending: 0, filled: 0, failed: 0, canceled: 0, sent: 0 };
    for (const o of items) {
      if (c[o.status] !== undefined) c[o.status] += 1;
    }
    return c;
  }, [items]);

  const cancelMutation = useMutation({
    mutationFn: (id) => bnAPI.cancelOrder(id),
    onSuccess: (_res, id) => {
      toast.success('سفارش با موفقیت لغو شد.');
      queryClient.invalidateQueries({ queryKey: ['bn-orders'] });
      setSelected((prev) =>
        prev && prev.id === id ? { ...prev, status: 'canceled' } : prev
      );
    },
    onError: () => {
      toast.error('لغو سفارش ناموفق بود. دوباره تلاش کنید.');
    },
  });

  const handleCancel = async (order) => {
    if (!order || order.status !== 'pending') return;
    const ok = await confirm(
      'لغو سفارش',
      `آیا از لغوِ سفارشِ ${order.symbol || ''} (شناسه ${toPersianDigits(
        order.id
      )}) اطمینان دارید؟`,
      { variant: 'danger', confirmText: 'لغو سفارش', cancelText: 'انصراف' }
    );
    if (ok) {
      cancelMutation.mutate(order.id);
    }
  };

  const changeStatus = (value) => {
    setStatusFilter(value);
    setPage(1);
  };
  const changeMarket = (value) => {
    setMarketFilter(value);
    setPage(1);
  };

  const columns = [
    {
      key: 'id',
      header: 'شناسه',
      width: 80,
      render: (v) => (
        <span className="text-text-muted tabular-nums">{toPersianDigits(v)}</span>
      ),
    },
    {
      key: 'username',
      header: 'کاربر',
      render: (v, row) =>
        v ? (
          <span className="text-text-primary">{v}</span>
        ) : (
          <span className="text-text-muted">
            #{toPersianDigits(row.studentId ?? '-')}
          </span>
        ),
    },
    {
      key: 'market',
      header: 'بازار',
      sortable: false,
      render: (v) => <MarketCell market={v} />,
    },
    {
      key: 'symbol',
      header: 'نماد',
      render: (v) => (
        <span className="font-medium text-text-primary">{v || '-'}</span>
      ),
    },
    {
      key: 'side',
      header: 'جهت',
      sortable: false,
      render: (v) => <SideCell side={v} />,
    },
    {
      key: 'amount',
      header: 'حجم',
      sortValue: (row) => Number(row.amount) || 0,
      render: (v) => <span className="tabular-nums">{fmtNum(v)}</span>,
    },
    {
      key: 'price',
      header: 'قیمت',
      sortValue: (row) => Number(row.price) || 0,
      render: (v) => <span className="tabular-nums">{fmtNum(v)}</span>,
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (v) => <OrderStatus status={v} />,
    },
    {
      key: 'createdAt',
      header: 'تاریخ',
      sortValue: (row) => new Date(row.createdAt).getTime() || 0,
      render: (v) => (
        <span className="text-text-secondary whitespace-nowrap">
          {v ? formatDateTime(v) : '-'}
        </span>
      ),
    },
    {
      key: '_actions',
      header: 'عملیات',
      sortable: false,
      render: (_v, row) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="جزئیات"
            onClick={(e) => {
              e.stopPropagation();
              setSelected(row);
            }}
            className="p-1.5 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
          >
            <Eye size={16} />
          </button>
          {row.status === 'pending' && (
            <button
              type="button"
              title="لغو سفارش"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel(row);
              }}
              className="p-1.5 rounded-lg text-brand-red hover:bg-brand-red/10 transition-colors"
            >
              <Ban size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(statusFilter || marketFilter);

  return (
    <div className="space-y-6">
      {/* هدر */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ShoppingCart size={24} className="text-brand-blue" />
            سفارش‌ها
          </h1>
          <p className="text-sm text-text-muted mt-1">
            سفارش‌های تریدِ واقعیِ کاربران بازارنما
          </p>
        </div>
      </div>

      {/* کارت‌های آماری (بر اساسِ صفحهٔ جاری) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={ShoppingCart}
          title="کل سفارش‌ها"
          value={toPersianDigits(total)}
          variant="info"
          loading={isLoading}
        />
        <StatCard
          icon={Clock}
          title="در انتظار (این صفحه)"
          value={toPersianDigits(pageCounts.pending)}
          variant="warning"
          loading={isLoading}
        />
        <StatCard
          icon={CheckCircle2}
          title="اجراشده (این صفحه)"
          value={toPersianDigits(pageCounts.filled)}
          variant="success"
          loading={isLoading}
        />
        <StatCard
          icon={XCircle}
          title="ناموفق (این صفحه)"
          value={toPersianDigits(pageCounts.failed)}
          variant="danger"
          loading={isLoading}
        />
      </div>

      {/* فیلترها */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
            <Filter size={16} className="text-text-muted" />
            فیلترها
          </span>

          <select
            value={statusFilter}
            onChange={(e) => changeStatus(e.target.value)}
            className="min-w-[160px] text-sm"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <select
            value={marketFilter}
            onChange={(e) => changeMarket(e.target.value)}
            className="min-w-[150px] text-sm"
          >
            {MARKET_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setMarketFilter('');
                setPage(1);
              }}
              className="btn-ghost text-sm"
            >
              پاک‌سازی فیلترها
            </button>
          )}

          {isFetching && !isLoading && (
            <span className="text-xs text-text-muted mr-auto animate-pulse">
              در حال به‌روزرسانی…
            </span>
          )}
        </div>
      </div>

      {/* جدول / حالت‌ها */}
      {isError ? (
        <div className="card">
          <ErrorState
            description="دریافت فهرست سفارش‌ها ناموفق بود."
            onRetry={refetch}
          />
        </div>
      ) : !isLoading && items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ShoppingCart}
            title={hasFilters ? 'سفارشی با این فیلترها یافت نشد' : 'هنوز سفارشی ثبت نشده است'}
            description={
              hasFilters
                ? 'فیلترها را تغییر دهید یا پاک کنید تا سفارش‌های بیشتری ببینید.'
                : 'به‌محضِ ثبتِ سفارشِ تریدِ واقعی توسط کاربران، اینجا نمایش داده می‌شود.'
            }
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={isLoading}
          skeletonRows={PAGE_SIZE > 10 ? 8 : PAGE_SIZE}
          onRowClick={(row) => setSelected(row)}
          pagination={{
            page,
            totalPages,
            totalItems: total,
          }}
          onPageChange={(p) => setPage(p)}
          emptyMessage="سفارشی برای نمایش وجود ندارد"
        />
      )}

      {/* جزئیات سفارش */}
      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `جزئیات سفارش #${toPersianDigits(selected.id)}`
            : 'جزئیات سفارش'
        }
        size="lg"
        footer={
          selected && (
            <>
              {selected.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => handleCancel(selected)}
                  disabled={cancelMutation.isPending}
                  className="btn-danger inline-flex items-center gap-2"
                >
                  <Ban size={16} />
                  لغو سفارش
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="btn-ghost"
              >
                بستن
              </button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-text-primary">
                  {selected.symbol || '-'}
                </span>
                <SideCell side={selected.side} />
              </div>
              <OrderStatus status={selected.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <DetailRow label="کاربر">
                {selected.username || (
                  <span className="text-text-muted">
                    #{toPersianDigits(selected.studentId ?? '-')}
                  </span>
                )}
              </DetailRow>
              <DetailRow label="بازار">
                <MarketCell market={selected.market} />
              </DetailRow>
              <DetailRow label="کارگزار">
                {selected.broker || '-'}
              </DetailRow>
              <DetailRow label="حجم">{fmtNum(selected.amount)}</DetailRow>
              <DetailRow label="قیمت">{fmtNum(selected.price)}</DetailRow>
              <DetailRow label="حد ضرر (SL)">{fmtNum(selected.sl)}</DetailRow>
              <DetailRow label="حد سود (TP)">{fmtNum(selected.tp)}</DetailRow>
              <DetailRow label="شناسهٔ سفارشِ کارگزار">
                {selected.brokerOrderId || '-'}
              </DetailRow>
              <DetailRow label="تاریخ ثبت">
                {selected.createdAt ? formatDateTime(selected.createdAt) : '-'}
              </DetailRow>
            </div>

            {selected.error && (
              <div className="flex items-start gap-2 rounded-lg bg-brand-red/10 border border-brand-red/30 px-3 py-2.5">
                <XCircle size={16} className="text-brand-red mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-brand-red mb-0.5">
                    خطای سفارش
                  </p>
                  <p className="text-sm text-text-secondary break-all">
                    {selected.error}
                  </p>
                </div>
              </div>
            )}

            {selected.status !== 'pending' && (
              <p className="text-xs text-text-muted inline-flex items-center gap-1.5">
                <Send size={13} />
                فقط سفارش‌های «در انتظار» قابلِ لغو هستند.
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog {...confirmState} loading={cancelMutation.isPending} />
    </div>
  );
}
