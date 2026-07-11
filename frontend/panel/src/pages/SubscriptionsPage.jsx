import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Wallet,
  CreditCard,
  CheckCircle2,
  XCircle,
  Users,
  Clock,
  DollarSign,
  BadgeCheck,
  CalendarPlus,
} from 'lucide-react';

import { academyAPI, subscriptionsAPI } from '../api/client';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import StatusBadge from '../components/common/StatusBadge';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { TableSkeleton, CardSkeleton } from '../components/common/Skeleton';
import { useToast } from '../components/common/Toast';
import { useConfirm } from '../hooks/useConfirm';
import { toPersianDigits, formatDateTime } from '../utils/formatters';

// ── نگاشتِ تب‌های صف پرداخت به وضعیتِ بک‌اند آکادمی ──
const PAYMENT_TABS = [
  { key: 'pending', label: 'در انتظار', apiStatus: 'pending' },
  { key: 'approved', label: 'تأیید شده', apiStatus: 'active' },
  { key: 'rejected', label: 'رد شده', apiStatus: 'cancelled' },
];

const TIER_LABELS = {
  vip: 'ویژه (VIP)',
  premium: 'پرمیوم',
  free: 'رایگان',
};

function fmtUsdt(v) {
  if (v === null || v === undefined) return '—';
  return `${toPersianDigits(Number(v).toLocaleString('en-US'))} USDT`;
}

function PaymentStatusBadge({ status }) {
  if (status === 'pending') return <StatusBadge status="pending" size="sm" />;
  if (status === 'active')
    return <StatusBadge variant="success" label="تأیید شده" size="sm" />;
  if (status === 'cancelled')
    return <StatusBadge variant="danger" label="رد شده" size="sm" />;
  return <StatusBadge variant="neutral" label={status || '—'} size="sm" />;
}

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, confirmState } = useConfirm();

  const [section, setSection] = useState('payments'); // 'payments' | 'subscriptions'
  const [paymentTab, setPaymentTab] = useState('pending');

  const [approveTarget, setApproveTarget] = useState(null);
  const [extendTarget, setExtendTarget] = useState(null);

  // ── آمار درآمد / اشتراک‌ها ──
  const statsQuery = useQuery({
    queryKey: ['sub-stats'],
    queryFn: () => subscriptionsAPI.getStats().then((r) => r.data),
  });

  // ── تعدادِ در انتظارِ آکادمی (برای StatCard) ──
  const pendingCountQuery = useQuery({
    queryKey: ['academy-pending-count'],
    queryFn: () => academyAPI.listPayments('pending'),
  });

  // ── صف پرداخت‌های آکادمی ──
  const activeTab = PAYMENT_TABS.find((t) => t.key === paymentTab) || PAYMENT_TABS[0];
  const paymentsQuery = useQuery({
    queryKey: ['academy-payments', activeTab.apiStatus],
    queryFn: () => academyAPI.listPayments(activeTab.apiStatus),
    enabled: section === 'payments',
  });

  // ── لیست اشتراک‌ها ──
  const [subsPage, setSubsPage] = useState(1);
  const subsQuery = useQuery({
    queryKey: ['subscriptions', subsPage],
    queryFn: () =>
      subscriptionsAPI
        .getAll({ page: subsPage, per_page: 20 })
        .then((r) => r.data),
    enabled: section === 'subscriptions',
    keepPreviousData: true,
  });

  // ── mutationها ──
  const approveMutation = useMutation({
    mutationFn: ({ id, months }) => academyAPI.approvePayment(id, months),
    onSuccess: () => {
      toast.success('پرداخت تأیید شد و اشتراک فعال گردید.');
      setApproveTarget(null);
      queryClient.invalidateQueries({ queryKey: ['academy-payments'] });
      queryClient.invalidateQueries({ queryKey: ['academy-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['sub-stats'] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || 'تأیید پرداخت ناموفق بود.'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => academyAPI.rejectPayment(id),
    onSuccess: () => {
      toast.success('پرداخت رد شد.');
      queryClient.invalidateQueries({ queryKey: ['academy-payments'] });
      queryClient.invalidateQueries({ queryKey: ['academy-pending-count'] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || 'رد پرداخت ناموفق بود.'),
  });

  const extendMutation = useMutation({
    mutationFn: ({ id, days }) => subscriptionsAPI.extend(id, days),
    onSuccess: () => {
      toast.success('اشتراک با موفقیت تمدید شد.');
      setExtendTarget(null);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['sub-stats'] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.detail || 'تمدید اشتراک ناموفق بود.'),
  });

  const handleReject = async (row) => {
    const ok = await confirm(
      'رد پرداخت',
      `آیا از رد پرداختِ «${row.full_name || row.username || row.id}» مطمئن هستید؟`,
      { variant: 'danger', confirmText: 'رد پرداخت' }
    );
    if (ok) rejectMutation.mutate(row.id);
  };

  // ─────────────────────────────────────────────
  // StatCards
  // ─────────────────────────────────────────────
  const stats = statsQuery.data;
  const pendingCount = pendingCountQuery.data?.items?.length ?? 0;

  const renderStats = () => {
    if (statsQuery.isLoading) return <CardSkeleton count={4} />;
    if (statsQuery.isError) {
      return (
        <div className="card">
          <ErrorState compact onRetry={statsQuery.refetch} />
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          variant="success"
          title="درآمد کل"
          value={fmtUsdt(stats?.total_revenue_usdt ?? 0)}
        />
        <StatCard
          icon={Users}
          variant="info"
          title="اشتراک فعال"
          value={toPersianDigits(stats?.active_now ?? 0)}
        />
        <StatCard
          icon={BadgeCheck}
          variant="success"
          title="اشتراک پولی فعال"
          value={toPersianDigits(stats?.paid_active ?? 0)}
        />
        <StatCard
          icon={Clock}
          variant="warning"
          title="در انتظار تأیید"
          value={toPersianDigits(pendingCount)}
        />
      </div>
    );
  };

  // ─────────────────────────────────────────────
  // بخشِ صف پرداخت‌های آکادمی
  // ─────────────────────────────────────────────
  const renderPayments = () => (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-bold text-text-primary">
          صف پرداخت‌های آکادمی
        </h2>
        <div className="flex items-center gap-1 bg-surface-elevated rounded-xl p-1">
          {PAYMENT_TABS.map((t) => {
            const isActive = t.key === paymentTab;
            return (
              <button
                key={t.key}
                onClick={() => setPaymentTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-blue text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.label}
                {t.key === 'pending' && pendingCount > 0 && (
                  <span className="mr-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[10px]">
                    {toPersianDigits(pendingCount)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {paymentsQuery.isLoading ? (
        <TableSkeleton columns={6} rows={5} />
      ) : paymentsQuery.isError ? (
        <ErrorState onRetry={paymentsQuery.refetch} />
      ) : (paymentsQuery.data?.items?.length ?? 0) === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="پرداختی در این وضعیت نیست"
          description={
            paymentTab === 'pending'
              ? 'هیچ پرداخت آکادمی در انتظار بررسی وجود ندارد.'
              : 'موردی برای نمایش در این تب یافت نشد.'
          }
        />
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="px-4 py-3 text-right text-text-secondary font-medium">
                  دانش‌آموز
                </th>
                <th className="px-4 py-3 text-right text-text-secondary font-medium">
                  سطح
                </th>
                <th className="px-4 py-3 text-right text-text-secondary font-medium">
                  مبلغ
                </th>
                <th className="px-4 py-3 text-right text-text-secondary font-medium">
                  وضعیت
                </th>
                <th className="px-4 py-3 text-right text-text-secondary font-medium">
                  تاریخ
                </th>
                <th className="px-4 py-3 text-left text-text-secondary font-medium">
                  عملیات
                </th>
              </tr>
            </thead>
            <tbody>
              {paymentsQuery.data.items.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-surface-hover transition-colors"
                >
                  <td className="px-4 py-3 text-right border-t border-surface-border">
                    <div className="font-medium text-text-primary">
                      {row.full_name || '—'}
                    </div>
                    <div className="text-xs text-text-muted">
                      {row.username ? `@${row.username}` : `#${toPersianDigits(row.student_id)}`}
                    </div>
                    {row.tx_note && (
                      <div className="text-[11px] text-text-muted mt-0.5 max-w-[220px] truncate" title={row.tx_note}>
                        {row.tx_note}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right border-t border-surface-border">
                    {TIER_LABELS[row.tier] || row.tier || '—'}
                  </td>
                  <td className="px-4 py-3 text-right border-t border-surface-border font-medium text-brand-green">
                    {fmtUsdt(row.amount_usdt)}
                  </td>
                  <td className="px-4 py-3 text-right border-t border-surface-border">
                    <PaymentStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right border-t border-surface-border text-text-secondary whitespace-nowrap">
                    {row.created_at ? formatDateTime(row.created_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-left border-t border-surface-border whitespace-nowrap">
                    {row.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setApproveTarget(row)}
                          className="btn-success !px-3 !py-1.5 text-xs flex items-center gap-1"
                        >
                          <CheckCircle2 size={14} />
                          تأیید
                        </button>
                        <button
                          onClick={() => handleReject(row)}
                          disabled={rejectMutation.isPending}
                          className="btn-danger !px-3 !py-1.5 text-xs flex items-center gap-1"
                        >
                          <XCircle size={14} />
                          رد
                        </button>
                      </div>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // بخشِ لیست اشتراک‌ها
  // ─────────────────────────────────────────────
  const subsData = subsQuery.data;
  const subColumns = [
    {
      key: 'user',
      header: 'کاربر',
      sortable: false,
      render: (_v, row) => (
        <div>
          <div className="font-medium text-text-primary">
            {row.telegram_id ? toPersianDigits(row.telegram_id) : `#${toPersianDigits(row.user_id ?? row.id)}`}
          </div>
          <div className="text-xs text-text-muted">
            شناسه: {toPersianDigits(row.id)}
          </div>
        </div>
      ),
    },
    {
      key: 'plan_label',
      header: 'پلن',
      render: (v, row) => v || row.plan || '—',
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (v) => <StatusBadge status={v} size="sm" />,
    },
    {
      key: 'amount_usdt',
      header: 'مبلغ',
      render: (v) => fmtUsdt(v),
    },
    {
      key: 'expires_at',
      header: 'انقضا',
      render: (v) => (v ? formatDateTime(v) : '—'),
    },
    {
      key: 'actions',
      header: 'عملیات',
      sortable: false,
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      render: (_v, row) => (
        <button
          onClick={() => setExtendTarget(row)}
          className="btn-ghost !px-3 !py-1.5 text-xs inline-flex items-center gap-1"
        >
          <CalendarPlus size={14} />
          تمدید
        </button>
      ),
    },
  ];

  const renderSubscriptions = () => (
    <div className="card">
      <h2 className="text-base font-bold text-text-primary mb-4">
        لیست اشتراک‌ها
      </h2>
      {subsQuery.isError ? (
        <ErrorState onRetry={subsQuery.refetch} />
      ) : !subsQuery.isLoading && (subsData?.items?.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title="هنوز اشتراکی ثبت نشده"
          description="اشتراک‌های فعال کاربران پس از خرید در این جدول نمایش داده می‌شوند."
        />
      ) : (
        <DataTable
          columns={subColumns}
          data={subsData?.items || []}
          loading={subsQuery.isLoading}
          sortable={false}
          pagination={{
            page: subsData?.page || subsPage,
            totalPages: subsData?.total_pages || 1,
            totalItems: subsData?.total,
          }}
          onPageChange={setSubsPage}
          emptyMessage="اشتراکی برای نمایش نیست"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* سرتیتر */}
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Wallet size={22} className="text-brand-blue" />
          اشتراک‌ها و پرداخت‌ها
        </h1>
        <p className="text-sm text-text-muted mt-1">
          مدیریت صف پرداخت‌های آکادمی، اشتراک‌ها و مشاهدهٔ درآمد
        </p>
      </div>

      {renderStats()}

      {/* سوییچرِ بخش */}
      <div className="flex items-center gap-1 bg-surface-elevated rounded-xl p-1 w-fit">
        <button
          onClick={() => setSection('payments')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === 'payments'
              ? 'bg-brand-blue text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          صف پرداخت‌ها
        </button>
        <button
          onClick={() => setSection('subscriptions')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            section === 'subscriptions'
              ? 'bg-brand-blue text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          اشتراک‌ها
        </button>
      </div>

      {section === 'payments' ? renderPayments() : renderSubscriptions()}

      {/* مودالِ تأیید پرداخت (تعیین تعداد ماه) */}
      <ApproveModal
        target={approveTarget}
        onClose={() => setApproveTarget(null)}
        onConfirm={(months) =>
          approveMutation.mutate({ id: approveTarget.id, months })
        }
        loading={approveMutation.isPending}
      />

      {/* مودالِ تمدید اشتراک */}
      <ExtendModal
        target={extendTarget}
        onClose={() => setExtendTarget(null)}
        onConfirm={(days) =>
          extendMutation.mutate({ id: extendTarget.id, days })
        }
        loading={extendMutation.isPending}
      />

      <ConfirmDialog {...confirmState} />
    </div>
  );
}

// ── مودالِ تأیید پرداخت آکادمی ──
function ApproveModal({ target, onClose, onConfirm, loading }) {
  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: { months: '' },
  });

  React.useEffect(() => {
    if (target) reset({ months: '' });
  }, [target, reset]);

  const submit = (data) => {
    const months = data.months ? parseInt(data.months, 10) : undefined;
    onConfirm(months);
  };

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title="تأیید پرداخت آکادمی"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={loading}>
            انصراف
          </button>
          <button
            onClick={handleSubmit(submit)}
            className="btn-success flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            تأیید و فعال‌سازی
          </button>
        </>
      }
    >
      {target && (
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <div className="bg-surface-elevated rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">دانش‌آموز</span>
              <span className="text-text-primary font-medium">
                {target.full_name || target.username || `#${toPersianDigits(target.student_id)}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">سطح</span>
              <span className="text-text-primary">
                {TIER_LABELS[target.tier] || target.tier || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">مبلغ</span>
              <span className="text-brand-green font-medium">
                {fmtUsdt(target.amount_usdt)}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              تعداد ماه (اختیاری)
            </label>
            <input
              type="number"
              min="1"
              max="60"
              placeholder="خالی = محاسبهٔ خودکار بر اساس مبلغ"
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-blue"
              {...register('months')}
            />
            <p className="text-xs text-text-muted mt-1.5">
              در صورت خالی بودن، مدت اشتراک بر اساس مبلغ پرداختی محاسبه می‌شود.
            </p>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ── مودالِ تمدید اشتراک ──
function ExtendModal({ target, onClose, onConfirm, loading }) {
  const { register, handleSubmit, reset, formState } = useForm({
    defaultValues: { days: 30 },
  });

  React.useEffect(() => {
    if (target) reset({ days: 30 });
  }, [target, reset]);

  const submit = (data) => {
    const days = parseInt(data.days, 10);
    if (days > 0) onConfirm(days);
  };

  return (
    <Modal
      isOpen={!!target}
      onClose={onClose}
      title="تمدید اشتراک"
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost" disabled={loading}>
            انصراف
          </button>
          <button
            onClick={handleSubmit(submit)}
            className="btn-primary flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CalendarPlus size={16} />
            )}
            تمدید
          </button>
        </>
      }
    >
      {target && (
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <p className="text-sm text-text-secondary">
            تمدید اشتراک شمارهٔ {toPersianDigits(target.id)}
            {target.plan_label ? ` (${target.plan_label})` : ''}.
          </p>
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              تعداد روز
            </label>
            <input
              type="number"
              min="1"
              max="3650"
              className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-blue"
              {...register('days', { required: true, min: 1 })}
            />
            {formState.errors.days && (
              <p className="text-xs text-brand-red mt-1.5">
                تعداد روز باید عددی بزرگ‌تر از صفر باشد.
              </p>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
