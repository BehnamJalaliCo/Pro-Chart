import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Link2,
  ShieldCheck,
  ShieldOff,
  CheckCircle2,
  XCircle,
  Power,
  PowerOff,
  Bitcoin,
  CandlestickChart,
  Lock,
  Info,
} from 'lucide-react';

import { bnAPI } from '../api/client';
import { useNotificationStore } from '../store';

import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import SearchInput from '../components/common/SearchInput';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { CardSkeleton, TableSkeleton } from '../components/common/Skeleton';

import { toPersianDigits, formatDateTime } from '../utils/formatters';

// ─────────────────────────────────────────────────────────────
// اتصال صرافی — bn_exchange_accounts
// حساب‌های واقعیِ متصلِ کاربران (LBank/MT5) با وضعیت اتصال و
// راستی‌آزماییِ رفرال. کلید/سکرت هرگز از سرور نمی‌آید و نمایش داده نمی‌شود.
// ─────────────────────────────────────────────────────────────

const KIND_META = {
  lbank: { label: 'LBank (کریپتو)', short: 'LBank', icon: Bitcoin, variant: 'warning' },
  mt5: { label: 'MT5 (فارکس)', short: 'MT5', icon: CandlestickChart, variant: 'info' },
};

function KindBadge({ kind }) {
  const meta = KIND_META[kind] || {
    label: kind || '—',
    short: kind || '—',
    icon: Link2,
    variant: 'neutral',
  };
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">
      <Icon size={13} className="text-text-muted" />
      {meta.short}
    </span>
  );
}

export default function ExchangePage() {
  const queryClient = useQueryClient();
  const notify = useNotificationStore();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null); // ردیفِ درگاهِ جزئیات
  const [confirm, setConfirm] = useState(null); // { type, account }

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['bn-exchange-accounts', search],
    queryFn: () => bnAPI.getExchangeAccounts(search || undefined),
  });

  const accounts = Array.isArray(data) ? data : [];

  const stats = useMemo(() => {
    return {
      total: accounts.length,
      verified: accounts.filter((a) => a.referralVerified).length,
      active: accounts.filter((a) => a.status === 'active').length,
      lbank: accounts.filter((a) => a.kind === 'lbank').length,
      mt5: accounts.filter((a) => a.kind === 'mt5').length,
    };
  }, [accounts]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bn-exchange-accounts'] });
  };

  const referralMutation = useMutation({
    mutationFn: ({ id, verified }) => bnAPI.setExchangeReferral(id, verified),
    onSuccess: (_res, vars) => {
      invalidate();
      notify.success(vars.verified ? 'رفرال تأیید شد.' : 'تأیید رفرال لغو شد.');
      setSelected((prev) =>
        prev && prev.id === vars.id ? { ...prev, referralVerified: vars.verified } : prev
      );
    },
    onError: () => notify.error('خطا در به‌روزرسانی وضعیت رفرال.'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => bnAPI.setExchangeStatus(id, status),
    onSuccess: (_res, vars) => {
      invalidate();
      notify.success(vars.status === 'active' ? 'حساب فعال شد.' : 'حساب غیرفعال شد.');
      setSelected((prev) =>
        prev && prev.id === vars.id ? { ...prev, status: vars.status } : prev
      );
    },
    onError: () => notify.error('خطا در تغییر وضعیت حساب.'),
  });

  const mutating = referralMutation.isPending || statusMutation.isPending;

  const openConfirm = (type, account) => setConfirm({ type, account });
  const closeConfirm = () => setConfirm(null);

  const runConfirm = async () => {
    if (!confirm) return;
    const { type, account } = confirm;
    if (type === 'verify') {
      await referralMutation.mutateAsync({ id: account.id, verified: true });
    } else if (type === 'reject') {
      await referralMutation.mutateAsync({ id: account.id, verified: false });
    } else if (type === 'enable') {
      await statusMutation.mutateAsync({ id: account.id, status: 'active' });
    } else if (type === 'disable') {
      await statusMutation.mutateAsync({ id: account.id, status: 'disabled' });
    }
    closeConfirm();
  };

  const confirmMeta = useMemo(() => {
    if (!confirm) return null;
    const name = confirm.account?.username || `#${confirm.account?.id}`;
    switch (confirm.type) {
      case 'verify':
        return {
          variant: 'info',
          title: 'تأیید رفرال',
          confirmText: 'تأیید رفرال',
          message: `آیا رفرالِ حسابِ «${name}» تأیید شود؟ پس از تأیید، تریدِ واقعی روی این حساب مجاز می‌شود.`,
        };
      case 'reject':
        return {
          variant: 'warning',
          title: 'رد رفرال',
          confirmText: 'رد رفرال',
          message: `آیا تأییدِ رفرالِ حسابِ «${name}» لغو شود؟ تریدِ واقعی روی این حساب متوقف می‌شود.`,
        };
      case 'enable':
        return {
          variant: 'info',
          title: 'فعال‌سازی حساب',
          confirmText: 'فعال کن',
          message: `آیا حسابِ «${name}» فعال شود؟`,
        };
      case 'disable':
        return {
          variant: 'danger',
          title: 'غیرفعال‌سازی حساب',
          confirmText: 'غیرفعال کن',
          message: `آیا حسابِ «${name}» غیرفعال شود؟ سفارش‌های واقعیِ این حساب متوقف می‌شود.`,
        };
      default:
        return null;
    }
  }, [confirm]);

  const columns = useMemo(
    () => [
      {
        key: 'username',
        header: 'کاربر',
        render: (val, row) => (
          <div className="flex flex-col">
            <span className="font-medium text-text-primary">{val || '—'}</span>
            <span className="text-[11px] text-text-muted">
              شناسه کاربر: {row.studentId ? toPersianDigits(row.studentId) : '—'}
            </span>
          </div>
        ),
      },
      {
        key: 'kind',
        header: 'صرافی',
        render: (val) => <KindBadge kind={val} />,
      },
      {
        key: 'accountRef',
        header: 'شناسه حساب',
        render: (val, row) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs text-text-secondary" dir="ltr">
              {val ? toPersianDigits(val) : '—'}
            </span>
            {row.server && (
              <span className="text-[11px] text-text-muted" dir="ltr">
                {row.server}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'referralVerified',
        header: 'رفرال',
        sortValue: (row) => (row.referralVerified ? 1 : 0),
        render: (val) =>
          val ? (
            <StatusBadge status="success" label="تأییدشده" size="sm" variant="success" />
          ) : (
            <StatusBadge status="pending" label="تأیید‌نشده" size="sm" variant="warning" />
          ),
      },
      {
        key: 'status',
        header: 'وضعیت',
        render: (val) =>
          val === 'active' ? (
            <StatusBadge status="active" label="فعال" size="sm" variant="success" />
          ) : (
            <StatusBadge status="inactive" label="غیرفعال" size="sm" variant="neutral" />
          ),
      },
      {
        key: 'lastCheckAt',
        header: 'آخرین بررسی',
        render: (val) => (
          <span className="text-xs text-text-muted">
            {val ? formatDateTime(val) : 'بررسی‌نشده'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'اکشن‌ها',
        sortable: false,
        render: (_val, row) => (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {row.referralVerified ? (
              <button
                type="button"
                title="رد رفرال"
                disabled={mutating}
                onClick={() => openConfirm('reject', row)}
                className="p-1.5 rounded-lg text-yellow-500 hover:bg-yellow-500/10 transition-colors disabled:opacity-40"
              >
                <ShieldOff size={16} />
              </button>
            ) : (
              <button
                type="button"
                title="تأیید رفرال"
                disabled={mutating}
                onClick={() => openConfirm('verify', row)}
                className="p-1.5 rounded-lg text-brand-green hover:bg-brand-green/10 transition-colors disabled:opacity-40"
              >
                <ShieldCheck size={16} />
              </button>
            )}

            {row.status === 'active' ? (
              <button
                type="button"
                title="غیرفعال‌سازی"
                disabled={mutating}
                onClick={() => openConfirm('disable', row)}
                className="p-1.5 rounded-lg text-brand-red hover:bg-brand-red/10 transition-colors disabled:opacity-40"
              >
                <PowerOff size={16} />
              </button>
            ) : (
              <button
                type="button"
                title="فعال‌سازی"
                disabled={mutating}
                onClick={() => openConfirm('enable', row)}
                className="p-1.5 rounded-lg text-brand-blue hover:bg-brand-blue/10 transition-colors disabled:opacity-40"
              >
                <Power size={16} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [mutating]
  );

  // ── Header (همیشه نمایش داده می‌شود) ──
  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Link2 size={22} className="text-brand-blue" />
          اتصال صرافی
        </h1>
        <p className="text-sm text-text-muted mt-1">
          حساب‌های واقعیِ متصلِ کاربران (LBank / MT5) و مدیریت راستی‌آزماییِ رفرال.
        </p>
      </div>
      <div className="w-full sm:w-72">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="جستجو بر اساس کاربر یا شناسه حساب…"
        />
      </div>
    </div>
  );

  // ── هشدارِ امنیتی (کلید/سکرت هرگز نمایش داده نمی‌شود) ──
  const securityNote = (
    <div className="card flex items-start gap-3 border-brand-blue/20 bg-brand-blue/5">
      <Lock size={18} className="text-brand-blue mt-0.5 shrink-0" />
      <p className="text-xs leading-relaxed text-text-secondary">
        کلید و سکرتِ صرافی با رمزنگاریِ Fernet در دیتابیس ذخیره می‌شوند و
        <span className="text-text-primary font-medium"> هرگز </span>
        در این پنل نمایش داده نمی‌شوند. تریدِ واقعی تنها زمانی مجاز است که رفرال
        تأییدشده و وضعیت حساب فعال باشد.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {header}
      {securityNote}

      {/* ── کارت‌های آماری ── */}
      {isLoading ? (
        <CardSkeleton count={4} />
      ) : isError ? null : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Link2}
            title="کل حساب‌ها"
            value={toPersianDigits(stats.total)}
            variant="info"
          />
          <StatCard
            icon={ShieldCheck}
            title="رفرال تأییدشده"
            value={toPersianDigits(stats.verified)}
            variant="success"
          />
          <StatCard
            icon={Power}
            title="حساب فعال"
            value={toPersianDigits(stats.active)}
            variant="default"
          />
          <StatCard
            icon={Bitcoin}
            title="LBank / MT5"
            value={`${toPersianDigits(stats.lbank)} / ${toPersianDigits(stats.mt5)}`}
            variant="warning"
          />
        </div>
      )}

      {/* ── جدولِ حساب‌ها ── */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-2">
            <TableSkeleton columns={7} rows={6} />
          </div>
        ) : isError ? (
          <ErrorState
            description="دریافتِ فهرستِ حساب‌های صرافی ناموفق بود."
            onRetry={refetch}
          />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={Link2}
            title={search ? 'نتیجه‌ای یافت نشد' : 'هنوز حسابی متصل نشده'}
            description={
              search
                ? 'برای این جستجو حسابی پیدا نشد. عبارت دیگری را امتحان کنید.'
                : 'وقتی کاربری حسابِ واقعیِ صرافیِ خود را متصل کند، اینجا نمایش داده می‌شود.'
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={accounts}
            onRowClick={(row) => setSelected(row)}
            emptyMessage="حسابی برای نمایش وجود ندارد"
          />
        )}
      </div>

      {isFetching && !isLoading && (
        <p className="text-center text-xs text-text-muted">در حال به‌روزرسانی…</p>
      )}

      {/* ── درگاهِ جزئیاتِ حساب ── */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="جزئیات حساب صرافی"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <KindBadge kind={selected.kind} />
              {selected.status === 'active' ? (
                <StatusBadge status="active" label="فعال" variant="success" />
              ) : (
                <StatusBadge status="inactive" label="غیرفعال" variant="neutral" />
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <DetailRow label="کاربر" value={selected.username || '—'} />
              <DetailRow
                label="شناسه کاربر"
                value={selected.studentId ? toPersianDigits(selected.studentId) : '—'}
              />
              <DetailRow
                label="نوع صرافی"
                value={KIND_META[selected.kind]?.label || selected.kind || '—'}
              />
              <DetailRow
                label="شناسه حساب"
                value={selected.accountRef ? toPersianDigits(selected.accountRef) : '—'}
                ltr
              />
              {selected.server && (
                <DetailRow label="سرور" value={selected.server} ltr />
              )}
              <DetailRow
                label="رفرال"
                value={selected.referralVerified ? 'تأییدشده' : 'تأیید‌نشده'}
              />
              <DetailRow
                label="آخرین بررسی"
                value={selected.lastCheckAt ? formatDateTime(selected.lastCheckAt) : 'بررسی‌نشده'}
              />
              <DetailRow
                label="تاریخ اتصال"
                value={selected.createdAt ? formatDateTime(selected.createdAt) : '—'}
              />
            </dl>

            {selected.note && (
              <div className="flex items-start gap-2 rounded-lg bg-surface-elevated p-3 text-xs text-text-secondary">
                <Info size={14} className="mt-0.5 shrink-0 text-text-muted" />
                <span>{selected.note}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-surface-border pt-4">
              {selected.referralVerified ? (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => openConfirm('reject', selected)}
                  className="btn-ghost flex items-center gap-1.5"
                >
                  <XCircle size={15} /> رد رفرال
                </button>
              ) : (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => openConfirm('verify', selected)}
                  className="btn-success flex items-center gap-1.5"
                >
                  <CheckCircle2 size={15} /> تأیید رفرال
                </button>
              )}

              {selected.status === 'active' ? (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => openConfirm('disable', selected)}
                  className="btn-danger flex items-center gap-1.5"
                >
                  <PowerOff size={15} /> غیرفعال‌سازی
                </button>
              ) : (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => openConfirm('enable', selected)}
                  className="btn-primary flex items-center gap-1.5"
                >
                  <Power size={15} /> فعال‌سازی
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── دیالوگِ تأیید ── */}
      <ConfirmDialog
        isOpen={!!confirm}
        onClose={closeConfirm}
        onConfirm={runConfirm}
        loading={mutating}
        title={confirmMeta?.title}
        message={confirmMeta?.message}
        variant={confirmMeta?.variant || 'info'}
        confirmText={confirmMeta?.confirmText}
      />
    </div>
  );
}

function DetailRow({ label, value, ltr = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-text-muted">{label}</dt>
      <dd
        className={`text-text-primary font-medium ${ltr ? 'font-mono text-xs' : ''}`}
        dir={ltr ? 'ltr' : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
