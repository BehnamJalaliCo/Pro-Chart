import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import {
  Users as UsersIcon,
  UserCheck,
  Gem,
  Crown,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

import StatCard from '../components/common/StatCard';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

import UsersToolbar from '../components/users/UsersToolbar';
import UsersTable from '../components/users/UsersTable';
import UserFormModal from '../components/users/UserFormModal';
import UserDetailDrawer from '../components/users/UserDetailDrawer';
import UserBulkBar from '../components/users/UserBulkBar';

import usePagination from '../hooks/usePagination';
import { bnAPI } from '../api/client';
import { toPersianDigits } from '../utils/formatters';

const PAGE_SIZE = 20;

/* ─────────────────────────────────────────────────────────────
 * UsersPage — صفحهٔ پیشرفتهٔ مدیریت کاربران بازارنما.
 * مالکِ داده و state؛ کامپوننت‌های ارائه‌ای را ترکیب می‌کند.
 * همهٔ داده‌ها واقعی از bnAPI هستند؛ هیچ داده‌ی ساختگی وجود ندارد.
 * ───────────────────────────────────────────────────────────── */
export default function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  // ── فیلترها ──
  const [q, setQ] = useState('');
  const [tier, setTier] = useState('all');
  const [status, setStatus] = useState('all');
  const [accountType, setAccountType] = useState('all');

  // ── انتخاب / مودال‌ها ──
  const [selectedIds, setSelectedIds] = useState([]);
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', user? }
  const [drawerUserId, setDrawerUserId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // row در انتظارِ تأیید حذف

  // ── صفحه‌بندی ──
  // totalItems را از پاسخِ سرور نگه می‌داریم تا clamp داخلیِ hook درست کار کند.
  const [totalItems, setTotalItems] = useState(0);
  const pagination = usePagination({ totalItems, pageSize: PAGE_SIZE });
  const { page } = pagination;

  const filtersActive =
    Boolean(q) || tier !== 'all' || status !== 'all' || accountType !== 'all';

  // با تغییرِ فیلترها به صفحهٔ اول برگرد و انتخاب را پاک کن.
  const resetToFirst = useCallback(() => {
    pagination.setPage(1);
    setSelectedIds([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearchChange = useCallback(
    (v) => {
      setQ(v);
      resetToFirst();
    },
    [resetToFirst]
  );
  const onTierChange = useCallback(
    (v) => {
      setTier(v);
      resetToFirst();
    },
    [resetToFirst]
  );
  const onStatusChange = useCallback(
    (v) => {
      setStatus(v);
      resetToFirst();
    },
    [resetToFirst]
  );
  const onAccountTypeChange = useCallback(
    (v) => {
      setAccountType(v);
      resetToFirst();
    },
    [resetToFirst]
  );

  const clearFilters = useCallback(() => {
    setQ('');
    setTier('all');
    setStatus('all');
    setAccountType('all');
    resetToFirst();
  }, [resetToFirst]);

  // ── آمار (نوارِ KPI) ──
  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: () => bnAPI.getStats(),
    staleTime: 30_000,
  });
  const uStats = statsQuery.data?.users || {};

  // ── فهرست کاربران ──
  const usersQuery = useQuery({
    queryKey: ['users', { q, tier, status, accountType, page, limit: PAGE_SIZE }],
    queryFn: () =>
      bnAPI.getUsers({
        q: q || undefined,
        tier: tier !== 'all' ? tier : undefined,
        status: status !== 'all' ? status : undefined,
        accountType: accountType !== 'all' ? accountType : undefined,
        page,
        limit: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const data = usersQuery.data;
  const serverRows = useMemo(() => data?.items || [], [data]);
  const total = typeof data?.total === 'number' ? data.total : undefined;
  const totalPages = pagination.totalPages;

  // همگام‌سازیِ totalItems با پاسخِ سرور (برای منطقِ صفحه‌بندی).
  useEffect(() => {
    if (typeof data?.total === 'number' && data.total !== totalItems) {
      setTotalItems(data.total);
    }
  }, [data, totalItems]);

  // فیلترِ دفاعیِ نوعِ حساب روی سمتِ کلاینت (اگر بک‌اند آن را اعمال نکند).
  const rows = useMemo(() => {
    if (accountType === 'all') return serverRows;
    return serverRows.filter((r) => {
      const t = String(r.accountType || '').toLowerCase();
      if (accountType === 'real') return t === 'real' || t === 'live';
      if (accountType === 'demo') return t === 'demo' || t === 'paper';
      return true;
    });
  }, [serverRows, accountType]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
  }, [queryClient]);

  // ── mutation: تغییرِ وضعیت (فعال/مسدود) از منوی ردیف ──
  const statusMutation = useMutation({
    mutationFn: ({ id, next }) => bnAPI.setStatus(id, next),
    onSuccess: (_d, v) => {
      invalidate();
      toast.success(v.next === 'active' ? 'کاربر فعال شد' : 'کاربر مسدود شد');
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.detail || 'تغییرِ وضعیت کاربر ناموفق بود'
      ),
  });

  // ── mutation: حذفِ تکی ──
  const deleteMutation = useMutation({
    mutationFn: (id) => bnAPI.deleteUser(id),
    onSuccess: () => {
      invalidate();
      toast.success('کاربر حذف شد');
      setSelectedIds((ids) =>
        deleteTarget ? ids.filter((x) => x !== deleteTarget.id) : ids
      );
      setDeleteTarget(null);
    },
    onError: (err) =>
      toast.error(err?.response?.data?.detail || 'حذفِ کاربر ناموفق بود'),
  });

  // ── هندلرهای ردیف ──
  const handleView = useCallback((row) => setDrawerUserId(row.id), []);
  const handleEdit = useCallback(
    (row) => setModal({ mode: 'edit', user: row }),
    []
  );
  // عملیاتِ تفصیلی (تیر/تمدید/بازنشانی رمز) در کشوی جزئیات انجام می‌شود.
  const openDrawer = useCallback((row) => setDrawerUserId(row.id), []);
  const handleStatus = useCallback(
    (row) =>
      statusMutation.mutate({
        id: row.id,
        next: row.status === 'active' ? 'disabled' : 'active',
      }),
    [statusMutation]
  );
  const handleDelete = useCallback((row) => setDeleteTarget(row), []);

  const isRefreshing = usersQuery.isFetching && !usersQuery.isLoading;
  const startItem = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const endItem = total ? Math.min(page * PAGE_SIZE, total) : 0;

  const pageNumbers = useMemo(() => {
    const list = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) list.push(i);
    return list;
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
      {/* ── هدر صفحه ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <UsersIcon size={24} className="text-brand-blue" />
            مدیریت کاربران
          </h1>
          <p className="text-sm text-text-muted mt-1">
            مدیریت کامل کاربران، سطوح اشتراک و دسترسی‌های بازارنما
          </p>
        </div>
        {isRefreshing && (
          <span className="text-xs text-text-muted animate-pulse">
            در حال به‌روزرسانی…
          </span>
        )}
      </div>

      {/* ── نوارِ KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={UsersIcon}
          title="کل کاربران"
          value={toPersianDigits(uStats.total ?? 0)}
          variant="info"
          loading={statsQuery.isLoading}
        />
        <StatCard
          icon={UserCheck}
          title="کاربران فعال"
          value={toPersianDigits(uStats.active ?? 0)}
          variant="success"
          loading={statsQuery.isLoading}
        />
        <StatCard
          icon={Gem}
          title="اشتراک حرفه‌ای"
          value={toPersianDigits(uStats.premium ?? 0)}
          variant="default"
          loading={statsQuery.isLoading}
        />
        <StatCard
          icon={Crown}
          title="اشتراک ویژه"
          value={toPersianDigits(uStats.vip ?? 0)}
          variant="warning"
          loading={statsQuery.isLoading}
        />
      </div>

      {/* ── نوارِ ابزار (جستجو + فیلترها + افزودن) ── */}
      <UsersToolbar
        q={q}
        onSearchChange={onSearchChange}
        tier={tier}
        onTierChange={onTierChange}
        status={status}
        onStatusChange={onStatusChange}
        accountType={accountType}
        onAccountTypeChange={onAccountTypeChange}
        onAddUser={() => setModal({ mode: 'add' })}
        total={total}
        loading={usersQuery.isLoading}
      />

      {/* ── جدول کاربران ── */}
      <UsersTable
        rows={rows}
        loading={usersQuery.isLoading}
        error={usersQuery.isError ? usersQuery.error : null}
        onRetry={usersQuery.refetch}
        filtersActive={filtersActive}
        onClearFilters={clearFilters}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onView={handleView}
        onEdit={handleEdit}
        onTier={openDrawer}
        onExtend={openDrawer}
        onResetPassword={openDrawer}
        onStatus={handleStatus}
        onDelete={handleDelete}
        onRowClick={handleView}
      />

      {/* ── فوترِ صفحه‌بندی ── */}
      {!usersQuery.isLoading &&
        !usersQuery.isError &&
        rows.length > 0 &&
        totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-text-muted tabular-nums">
              نمایش{' '}
              <span className="text-text-secondary">
                {toPersianDigits(startItem)}–{toPersianDigits(endItem)}
              </span>{' '}
              از{' '}
              <span className="text-text-secondary">
                {toPersianDigits(total ?? rows.length)}
              </span>{' '}
              کاربر
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={pagination.prev}
                disabled={!pagination.hasPrev}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="صفحهٔ قبل"
              >
                <ChevronRight size={16} />
              </button>

              {pageNumbers[0] > 1 && (
                <span className="px-1 text-text-muted text-xs">…</span>
              )}

              {pageNumbers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => pagination.goToPage(p)}
                  className={
                    'flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm tabular-nums transition-colors duration-200 ' +
                    (p === page
                      ? 'border-brand-blue/40 bg-brand-blue/15 text-brand-blue font-semibold'
                      : 'border-surface-border bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary')
                  }
                >
                  {toPersianDigits(p)}
                </button>
              ))}

              {pageNumbers[pageNumbers.length - 1] < totalPages && (
                <span className="px-1 text-text-muted text-xs">…</span>
              )}

              <button
                type="button"
                onClick={pagination.next}
                disabled={!pagination.hasNext}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-border bg-surface-card text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="صفحهٔ بعد"
              >
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        )}

      {/* ── نوارِ عملیات گروهی ── */}
      <UserBulkBar
        selectedIds={selectedIds}
        onDone={() => setSelectedIds([])}
        onClear={() => setSelectedIds([])}
      />

      {/* ── مودالِ افزودن/ویرایش ── */}
      {modal && (
        <UserFormModal
          mode={modal.mode}
          user={modal.user}
          onClose={() => setModal(null)}
          onSaved={invalidate}
        />
      )}

      {/* ── کشوی جزئیات کاربر ── */}
      <UserDetailDrawer
        userId={drawerUserId}
        onClose={() => setDrawerUserId(null)}
        onChanged={invalidate}
      />

      {/* ── تأییدِ حذفِ تکی ── */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => !deleteMutation.isPending && setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
        variant="danger"
        title="حذف کاربر"
        message={
          deleteTarget
            ? `آیا از حذف «${
                deleteTarget.username || deleteTarget.fullName || ''
              }» اطمینان دارید؟ این عملیات قابل بازگشت نیست.`
            : ''
        }
        confirmText="حذف کاربر"
      />
    </div>
  );
}
