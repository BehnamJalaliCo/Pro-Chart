import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MoreHorizontal,
  Eye,
  Pencil,
  ShieldCheck,
  CalendarPlus,
  KeyRound,
  UserCheck,
  UserX,
  Trash2,
  Users as UsersIcon,
} from 'lucide-react';

import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import LiveDot from '../common/LiveDot';
import { TableSkeleton } from '../common/Skeleton';
import { toPersianDigits, formatDate, formatDateTime } from '../../utils/formatters';

/**
 * UsersTable — جدول پیشرفتهٔ کاربران (presentational).
 *
 * داده و اکشن‌ها را کاملاً از طریق props دریافت می‌کند؛ هیچ داده‌ی ساختگی ندارد.
 * صفحهٔ والد داده را با react-query (bnAPI.getUsers) تأمین می‌کند.
 *
 * props:
 *   rows        : Array<user>                    (فهرست کاربرانِ واقعی)
 *   loading     : boolean                         (نمایش TableSkeleton)
 *   error       : any                             (نمایش ErrorState)
 *   onRetry     : () => void                      (دکمهٔ تلاش مجدد خطا)
 *   filtersActive : boolean                       (برای متنِ حالت خالی)
 *   onClearFilters: () => void
 *
 *   selectedIds : Array<id>                        (کنترل‌شده)
 *   onSelectionChange : (ids: Array<id>) => void   (انتخاب/لغو انتخاب)
 *
 *   onView / onEdit / onTier / onStatus / onExtend / onResetPassword / onDelete
 *              : (row) => void                     (اکشن‌های ردیف)
 *   onRowClick : (row) => void                     (کلیک روی ردیف؛ اختیاری)
 *
 *   skeletonRows : number = 8
 */

const TIER_META = {
  free: { label: 'رایگان', cls: 'bg-surface-elevated text-text-muted', order: 0 },
  vip: { label: 'ویژه', cls: 'bg-brand-blue/15 text-brand-blue', order: 1 },
  premium: { label: 'حرفه‌ای', cls: 'bg-brand-green/15 text-brand-green', order: 2 },
};

const STATUS_META = {
  active: { label: 'فعال', cls: 'bg-brand-green/15 text-brand-green', dot: 'bg-brand-green shadow-[0_0_6px_rgba(0,200,83,0.5)]', order: 0 },
  disabled: { label: 'غیرفعال', cls: 'bg-brand-red/15 text-brand-red', dot: 'bg-brand-red shadow-[0_0_6px_rgba(255,23,68,0.5)]', order: 2 },
  pending: { label: 'در انتظار', cls: 'bg-yellow-500/15 text-yellow-500', dot: 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]', order: 1 },
};

const ACCOUNT_TYPE_LABEL = {
  real: 'واقعی',
  live: 'واقعی',
  demo: 'آزمایشی',
  paper: 'آزمایشی',
};

function tierOrder(t) {
  return (TIER_META[t] || TIER_META.free).order;
}
function statusOrder(s) {
  return (STATUS_META[s] || { order: 3 }).order;
}
function ts(iso) {
  if (!iso) return 0;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}
function isExpired(iso) {
  if (!iso) return false;
  const t = ts(iso);
  return t !== 0 && t < Date.now();
}
function accountTypeLabel(t) {
  if (!t) return '';
  return ACCOUNT_TYPE_LABEL[String(t).toLowerCase()] || t;
}

// ─────────────────────────── نشان‌ها ───────────────────────────
function TierBadge({ tier }) {
  const meta = TIER_META[tier] || TIER_META.free;
  return <span className={clsx('badge', meta.cls)}>{meta.label}</span>;
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || {
    label: status || '—',
    cls: 'bg-surface-elevated text-text-muted',
    dot: 'bg-text-muted',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap px-2.5 py-1 text-xs',
        meta.cls
      )}
    >
      <span className={clsx('w-2 h-2 rounded-full shrink-0', meta.dot)} />
      {meta.label}
    </span>
  );
}

// ─────────────────────────── ستون‌ها ───────────────────────────
// sortValue بر اساس ردیفِ خام محاسبه می‌شود.
const COLUMNS = [
  { key: 'username', header: 'نام‌کاربری', sortable: true, sortValue: (r) => (r.username || '').toLowerCase() },
  { key: 'fullName', header: 'نام کامل', sortable: true, sortValue: (r) => (r.fullName || '').toLowerCase() },
  { key: 'tier', header: 'تیر', sortable: true, sortValue: (r) => tierOrder(r.tier) },
  { key: 'status', header: 'وضعیت', sortable: true, sortValue: (r) => statusOrder(r.status) },
  { key: 'accountType', header: 'نوع حساب', sortable: true, sortValue: (r) => accountTypeLabel(r.accountType) },
  { key: 'phoneNumber', header: 'تلفن', sortable: false },
  { key: 'createdAt', header: 'عضویت', sortable: true, sortValue: (r) => ts(r.createdAt) },
  { key: 'lastLoginAt', header: 'آخرین ورود', sortable: true, sortValue: (r) => ts(r.lastLoginAt) },
  { key: 'expiresAt', header: 'انقضا', sortable: true, sortValue: (r) => ts(r.expiresAt) },
];

function SortIcon({ active, dir }) {
  if (!active) {
    return <ChevronsUpDown size={13} className="text-text-muted/60 opacity-0 group-hover:opacity-100 transition-opacity" />;
  }
  return dir === 'asc' ? (
    <ChevronUp size={13} className="text-brand-blue" />
  ) : (
    <ChevronDown size={13} className="text-brand-blue" />
  );
}

// ─────────────────────────── منوی اکشن ───────────────────────────
function RowActions({ row, handlers, open, onOpen, onClose }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [dropUp, setDropUp] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        btnRef.current &&
        !btnRef.current.contains(e.target)
      ) {
        onClose();
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 320);
    }
  }, [open]);

  const active = row.status === 'active';
  const items = [
    { key: 'view', label: 'مشاهده', icon: Eye, fn: handlers.onView },
    { key: 'edit', label: 'ویرایش پروفایل', icon: Pencil, fn: handlers.onEdit },
    { key: 'tier', label: 'تغییر تیر', icon: ShieldCheck, fn: handlers.onTier },
    { key: 'extend', label: 'تمدید اشتراک', icon: CalendarPlus, fn: handlers.onExtend },
    { key: 'reset', label: 'بازنشانی رمز', icon: KeyRound, fn: handlers.onResetPassword },
    {
      key: 'status',
      label: active ? 'غیرفعال‌سازی' : 'فعال‌سازی',
      icon: active ? UserX : UserCheck,
      fn: handlers.onStatus,
      tone: active ? 'warn' : 'success',
    },
    { key: 'delete', label: 'حذف کاربر', icon: Trash2, fn: handlers.onDelete, tone: 'danger', divider: true },
  ].filter((it) => typeof it.fn === 'function');

  const fire = (fn) => (e) => {
    e.stopPropagation();
    onClose();
    fn(row);
  };

  return (
    <div className="relative flex justify-end">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          open ? onClose() : onOpen();
        }}
        className={clsx(
          'p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors',
          open && 'bg-surface-hover text-text-primary'
        )}
        aria-label="اقدامات"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className={clsx(
            'absolute z-30 left-0 w-48 rounded-xl border border-surface-border bg-surface-elevated shadow-2xl p-1',
            'animate-[fadeUp_.15s_ease-out]',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          {items.map((it) => (
            <React.Fragment key={it.key}>
              {it.divider && <div className="my-1 h-px bg-surface-border" />}
              <button
                type="button"
                role="menuitem"
                onClick={fire(it.fn)}
                className={clsx(
                  'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-right transition-colors',
                  it.tone === 'danger'
                    ? 'text-brand-red hover:bg-brand-red/10'
                    : it.tone === 'success'
                    ? 'text-brand-green hover:bg-brand-green/10'
                    : it.tone === 'warn'
                    ? 'text-yellow-500 hover:bg-yellow-500/10'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                <it.icon size={15} className="shrink-0" />
                {it.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════ کامپوننت اصلی ═══════════════════════════
export default function UsersTable({
  rows = [],
  loading = false,
  error = null,
  onRetry,
  filtersActive = false,
  onClearFilters,
  selectedIds = [],
  onSelectionChange,
  onView,
  onEdit,
  onTier,
  onStatus,
  onExtend,
  onResetPassword,
  onDelete,
  onRowClick,
  skeletonRows = 8,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [openMenuId, setOpenMenuId] = useState(null);

  const handlers = { onView, onEdit, onTier, onStatus, onExtend, onResetPassword, onDelete };

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col || !col.sortValue) return rows;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue(a);
      const vb = col.sortValue(b);
      if (typeof va === 'string' || typeof vb === 'string') {
        return String(va).localeCompare(String(vb), 'fa') * dir;
      }
      return (va - vb) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = useCallback(
    (key) => {
      setSortKey((prevKey) => {
        if (prevKey === key) {
          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
          return key;
        }
        setSortDir('asc');
        return key;
      });
    },
    []
  );

  const allVisibleIds = useMemo(() => sortedRows.map((r) => r.id), [sortedRows]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedSet.has(id));
  const someSelected = allVisibleIds.some((id) => selectedSet.has(id)) && !allSelected;

  const headerCbRef = useRef(null);
  useEffect(() => {
    if (headerCbRef.current) headerCbRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !allVisibleIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...allVisibleIds]);
      onSelectionChange([...merged]);
    }
  }, [allSelected, allVisibleIds, onSelectionChange, selectedIds]);

  const toggleOne = useCallback(
    (id) => {
      if (!onSelectionChange) return;
      if (selectedSet.has(id)) {
        onSelectionChange(selectedIds.filter((x) => x !== id));
      } else {
        onSelectionChange([...selectedIds, id]);
      }
    },
    [onSelectionChange, selectedIds, selectedSet]
  );

  const selectable = typeof onSelectionChange === 'function';

  // ── حالت‌ها ──
  if (error) {
    return (
      <div className="card">
        <ErrorState
          description="دریافت فهرست کاربران ناموفق بود."
          onRetry={onRetry}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="table-container">
        <TableSkeleton columns={selectable ? 8 : 7} rows={skeletonRows} />
      </div>
    );
  }

  if (!sortedRows.length) {
    return (
      <div className="card">
        <EmptyState
          icon={UsersIcon}
          title="کاربری یافت نشد"
          description={
            filtersActive
              ? 'با فیلترهای فعلی کاربری پیدا نشد. فیلترها را تغییر دهید.'
              : 'هنوز کاربری ثبت نشده است.'
          }
          action={
            filtersActive && typeof onClearFilters === 'function' ? (
              <button type="button" className="btn-ghost" onClick={onClearFilters}>
                پاک‌کردن فیلترها
              </button>
            ) : null
          }
        />
      </div>
    );
  }

  return (
    <div className="table-container overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="sticky top-0 z-20 bg-surface-card border-b border-surface-border">
            {selectable && (
              <th className="w-10 px-3 py-3 text-center">
                <input
                  ref={headerCbRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-brand-blue w-4 h-4 cursor-pointer align-middle"
                  aria-label="انتخاب همه"
                />
              </th>
            )}
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  'px-4 py-3 text-right text-xs font-medium text-text-secondary whitespace-nowrap select-none',
                  col.sortable && 'group cursor-pointer hover:text-text-primary transition-colors'
                )}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                aria-sort={
                  sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                }
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                </span>
              </th>
            ))}
            <th className="w-12 px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border/60">
          {sortedRows.map((row) => {
            const checked = selectedSet.has(row.id);
            const clickable = typeof onRowClick === 'function';
            return (
              <tr
                key={row.id}
                onClick={clickable ? () => onRowClick(row) : undefined}
                className={clsx(
                  'group/row transition-colors',
                  clickable && 'cursor-pointer',
                  checked ? 'bg-brand-blue/[0.06]' : 'hover:bg-surface-hover/60'
                )}
              >
                {selectable && (
                  <td className="w-10 px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(row.id)}
                      className={clsx(
                        'accent-brand-blue w-4 h-4 cursor-pointer align-middle transition-opacity',
                        checked ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus:opacity-100'
                      )}
                      aria-label={`انتخاب ${row.username || ''}`}
                    />
                  </td>
                )}

                {/* نام‌کاربری + آواتار */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-[11px] font-bold text-text-secondary shrink-0">
                      {(row.username || '؟').slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <span className="block font-medium text-text-primary truncate" dir="ltr">
                        {row.username || '—'}
                      </span>
                      {row.email && (
                        <span className="block text-[11px] text-text-muted truncate" dir="ltr">
                          {row.email}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* نام کامل */}
                <td className="px-4 py-3">
                  <span className="text-text-secondary truncate block max-w-[180px]">
                    {row.fullName || <span className="text-text-muted">—</span>}
                  </span>
                </td>

                {/* تیر */}
                <td className="px-4 py-3">
                  <TierBadge tier={row.tier} />
                </td>

                {/* وضعیت */}
                <td className="px-4 py-3">
                  <StatusPill status={row.status} />
                </td>

                {/* نوع حساب */}
                <td className="px-4 py-3">
                  {row.accountType ? (
                    <span className="text-text-secondary text-xs">
                      {accountTypeLabel(row.accountType)}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>

                {/* تلفن + وضعیت تأیید */}
                <td className="px-4 py-3">
                  {row.phoneNumber ? (
                    <span className="inline-flex items-center gap-1.5">
                      <LiveDot
                        active={!!row.phoneVerified}
                        color={row.phoneVerified ? 'green' : 'amber'}
                        size={7}
                      />
                      <span className="text-text-secondary tabular-nums" dir="ltr">
                        {toPersianDigits(row.phoneNumber)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>

                {/* عضویت */}
                <td className="px-4 py-3">
                  <span className="text-text-muted tabular-nums whitespace-nowrap">
                    {row.createdAt ? toPersianDigits(formatDate(row.createdAt)) : '—'}
                  </span>
                </td>

                {/* آخرین ورود */}
                <td className="px-4 py-3">
                  <span className="text-text-muted tabular-nums whitespace-nowrap">
                    {row.lastLoginAt ? toPersianDigits(formatDateTime(row.lastLoginAt)) : '—'}
                  </span>
                </td>

                {/* انقضا */}
                <td className="px-4 py-3">
                  {row.tier === 'free' || !row.expiresAt ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <span
                      className={clsx(
                        'tabular-nums whitespace-nowrap',
                        isExpired(row.expiresAt) ? 'text-brand-red' : 'text-text-secondary'
                      )}
                    >
                      {toPersianDigits(formatDate(row.expiresAt))}
                      {isExpired(row.expiresAt) && (
                        <span className="mr-1 text-[10px]">(منقضی)</span>
                      )}
                    </span>
                  )}
                </td>

                {/* اکشن‌ها */}
                <td className="w-12 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <div
                    className={clsx(
                      'transition-opacity',
                      openMenuId === row.id ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100'
                    )}
                  >
                    <RowActions
                      row={row}
                      handlers={handlers}
                      open={openMenuId === row.id}
                      onOpen={() => setOpenMenuId(row.id)}
                      onClose={() => setOpenMenuId(null)}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
