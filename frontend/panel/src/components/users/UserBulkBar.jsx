import React, { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Crown,
  Gem,
  UserCircle,
  ShieldCheck,
  ShieldOff,
  Trash2,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { bnAPI } from '../../api/client';
import { useToast } from '../common/Toast';
import ConfirmDialog from '../common/ConfirmDialog';
import { toPersianDigits } from '../../utils/formatters';

/**
 * UserBulkBar — floating bulk-action bar for the users table.
 *
 * Props:
 *  - selectedIds: number[]  (ids of selected users; bar hidden when empty)
 *  - onDone:      () => void (called after a successful bulk op — e.g. refetch + clear)
 *  - onClear:     () => void (clear the current selection)
 *
 * All actions hit the REAL backend via bnAPI.bulkUsers(action, ids, opts).
 * No mock data. Persian UI, Persian digits.
 */

const TIER_OPTIONS = [
  { value: 'free', label: 'رایگان', Icon: UserCircle, accent: 'text-text-secondary' },
  { value: 'vip', label: 'ویژه', Icon: Crown, accent: 'text-yellow-500' },
  { value: 'premium', label: 'پریمیوم', Icon: Gem, accent: 'text-brand-blue' },
];

const DAYS_PRESETS = [7, 30, 90, 180, 365];

function useOutsideClick(ref, handler, active) {
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, handler, active]);
}

export default function UserBulkBar({ selectedIds = [], onDone, onClear }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  const count = Array.isArray(selectedIds) ? selectedIds.length : 0;
  const hasSelection = count > 0;

  // mount/animation control so the bar can slide out gracefully
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);

  const [openMenu, setOpenMenu] = useState(null); // 'tier' | 'status' | null
  const [tierChoice, setTierChoice] = useState('vip');
  const [days, setDays] = useState(30);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const menuRef = useRef(null);
  useOutsideClick(menuRef, () => setOpenMenu(null), openMenu !== null);

  useEffect(() => {
    if (hasSelection) {
      setMounted(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setEntered(true))
      );
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    setOpenMenu(null);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [hasSelection]);

  const mutation = useMutation({
    mutationFn: ({ action, opts }) => bnAPI.bulkUsers(action, selectedIds, opts),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast.success(successMessage(variables, count));
      setOpenMenu(null);
      setConfirmOpen(false);
      if (onDone) onDone();
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'اجرای عملیات گروهی ناموفق بود';
      toast.error(typeof msg === 'string' ? msg : 'خطا در عملیات گروهی');
    },
  });

  const busy = mutation.isPending;

  const runSetTier = () => {
    if (busy) return;
    mutation.mutate({
      action: 'set-tier',
      opts: { tier: tierChoice, days: Number(days) || 0 },
    });
  };

  const runSetStatus = (status) => {
    if (busy) return;
    mutation.mutate({ action: 'set-status', opts: { status } });
  };

  const runDelete = () => {
    if (busy) return;
    mutation.mutate({ action: 'delete', opts: {} });
  };

  if (!mounted) return null;

  return (
    <>
      <div
        className={clsx(
          'fixed bottom-6 left-1/2 z-50 w-[min(720px,calc(100vw-2rem))] -translate-x-1/2',
          'transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          entered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
        style={{ transform: entered ? 'translate(-50%, 0)' : 'translate(-50%, 1rem)' }}
        dir="rtl"
      >
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-blue/30 bg-brand-blue/[0.08] backdrop-blur-md px-3 py-2.5 shadow-2xl">
          {/* count + clear */}
          <div className="flex items-center gap-2 pl-2">
            <button
              type="button"
              onClick={onClear}
              disabled={busy}
              title="پاک‌کردن انتخاب"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors duration-200 disabled:opacity-50"
            >
              <X size={16} />
            </button>
            <span className="text-sm text-text-primary tabular-nums whitespace-nowrap">
              <span className="font-bold text-brand-blue">{toPersianDigits(count)}</span>{' '}
              انتخاب شد
            </span>
          </div>

          <div className="mx-1 h-6 w-px bg-surface-border" />

          {/* actions */}
          <div ref={menuRef} className="flex flex-1 flex-wrap items-center gap-2">
            {/* Set tier */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu((m) => (m === 'tier' ? null : 'tier'))
                }
                disabled={busy}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
                  'transition-[background,border,color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
                  'disabled:opacity-50',
                  openMenu === 'tier'
                    ? 'border-brand-blue/40 bg-surface-elevated text-text-primary'
                    : 'border-surface-border bg-surface-card text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                )}
              >
                <Crown size={14} className="text-yellow-500" />
                تغییر سطح
                <ChevronDown
                  size={13}
                  className={clsx(
                    'text-text-muted transition-transform duration-200',
                    openMenu === 'tier' && 'rotate-180'
                  )}
                />
              </button>

              {openMenu === 'tier' && (
                <div
                  className="absolute bottom-full right-0 mb-2 w-64 rounded-xl border border-surface-border bg-surface-elevated p-3 shadow-2xl animate-[bnBulkFadeUp_.2s_ease-out]"
                >
                  <p className="mb-2 text-xs text-text-muted">انتخاب سطح جدید</p>
                  <div className="mb-3 grid grid-cols-3 gap-1.5">
                    {TIER_OPTIONS.map(({ value, label, Icon, accent }) => {
                      const active = tierChoice === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTierChoice(value)}
                          className={clsx(
                            'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs',
                            'transition-[background,border] duration-200',
                            active
                              ? 'border-brand-blue/50 bg-brand-blue/10 text-text-primary'
                              : 'border-surface-border bg-surface-card text-text-secondary hover:bg-surface-hover'
                          )}
                        >
                          <Icon size={16} className={active ? 'text-brand-blue' : accent} />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {tierChoice !== 'free' && (
                    <>
                      <p className="mb-1.5 text-xs text-text-muted">مدت اعتبار (روز)</p>
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {DAYS_PRESETS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDays(d)}
                            className={clsx(
                              'rounded-md px-2 py-1 text-xs tabular-nums transition-colors duration-200',
                              Number(days) === d
                                ? 'bg-brand-blue/15 text-brand-blue'
                                : 'bg-surface-card text-text-secondary hover:bg-surface-hover'
                            )}
                          >
                            {toPersianDigits(d)}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={days}
                        onChange={(e) => setDays(e.target.value)}
                        className="mb-3 w-full rounded-lg border border-surface-border bg-surface-card px-3 py-1.5 text-sm text-text-primary tabular-nums outline-none focus:border-brand-blue/50"
                        placeholder="تعداد روز"
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={runSetTier}
                    disabled={busy}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-1.5 text-sm"
                  >
                    {busy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      'اعمال روی انتخاب‌شده‌ها'
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Set status */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu((m) => (m === 'status' ? null : 'status'))
                }
                disabled={busy}
                className={clsx(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
                  'transition-[background,border,color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
                  'disabled:opacity-50',
                  openMenu === 'status'
                    ? 'border-brand-blue/40 bg-surface-elevated text-text-primary'
                    : 'border-surface-border bg-surface-card text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                )}
              >
                <ShieldCheck size={14} className="text-brand-green" />
                تغییر وضعیت
                <ChevronDown
                  size={13}
                  className={clsx(
                    'text-text-muted transition-transform duration-200',
                    openMenu === 'status' && 'rotate-180'
                  )}
                />
              </button>

              {openMenu === 'status' && (
                <div className="absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-surface-border bg-surface-elevated p-2 shadow-2xl animate-[bnBulkFadeUp_.2s_ease-out]">
                  <button
                    type="button"
                    onClick={() => runSetStatus('active')}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors duration-200 disabled:opacity-50"
                  >
                    <ShieldCheck size={16} className="text-brand-green" />
                    فعال‌سازی
                  </button>
                  <button
                    type="button"
                    onClick={() => runSetStatus('disabled')}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors duration-200 disabled:opacity-50"
                  >
                    <ShieldOff size={16} className="text-brand-red" />
                    مسدودسازی
                  </button>
                </div>
              )}
            </div>

            {/* Delete */}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-brand-red/30 bg-brand-red/10 px-3 py-1.5 text-xs font-medium text-brand-red hover:bg-brand-red/20 transition-colors duration-200 disabled:opacity-50 mr-auto"
            >
              <Trash2 size={14} />
              حذف
            </button>
          </div>

          {busy && (
            <div className="flex items-center gap-1.5 pr-1 text-xs text-text-muted">
              <Loader2 size={13} className="animate-spin" />
              در حال اجرا...
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bnBulkFadeUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => !busy && setConfirmOpen(false)}
        onConfirm={runDelete}
        loading={busy}
        variant="danger"
        title="حذف کاربران انتخاب‌شده"
        message={`آیا از حذف ${toPersianDigits(count)} کاربر اطمینان دارید؟ این عملیات قابل بازگشت نیست.`}
        confirmText="حذف کاربران"
      />
    </>
  );
}

function successMessage(variables, count) {
  const c = toPersianDigits(count);
  if (!variables) return `عملیات روی ${c} کاربر انجام شد`;
  if (variables.action === 'delete') return `${c} کاربر حذف شد`;
  if (variables.action === 'set-status') {
    return variables.opts?.status === 'active'
      ? `${c} کاربر فعال شد`
      : `${c} کاربر مسدود شد`;
  }
  if (variables.action === 'set-tier') {
    const t = variables.opts?.tier;
    const label =
      TIER_OPTIONS.find((o) => o.value === t)?.label || t;
    return `سطح ${c} کاربر به «${label}» تغییر کرد`;
  }
  return `عملیات روی ${c} کاربر انجام شد`;
}
