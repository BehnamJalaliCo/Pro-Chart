import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  X,
  Eye,
  ListChecks,
  ShoppingCart,
  Sparkles,
  Landmark,
  Mail,
  Phone,
  BadgeCheck,
  CalendarClock,
  CalendarPlus,
  LogIn,
  ShieldCheck,
  KeyRound,
  Pencil,
  Trash2,
  Save,
  Crown,
  Ban,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { bnAPI } from '../../api/client';
import { useToast } from '../common/Toast';
import ConfirmDialog from '../common/ConfirmDialog';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import AnimatedCounter from '../common/AnimatedCounter';
import { SkeletonBox } from '../common/Skeleton';
import {
  toPersianDigits,
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from '../../utils/formatters';

/* ─────────────────────────────────────────────────────────────
 * UserDetailDrawer — کشوی سمت راست برای مدیریت کاملِ یک کاربر.
 * همهٔ داده‌ها واقعی از bnAPI. props: { userId, onClose, onChanged }
 * ───────────────────────────────────────────────────────────── */

const TIER_META = {
  free: { label: 'رایگان', chip: 'bg-surface-elevated text-text-secondary' },
  vip: { label: 'ویژه', chip: 'bg-brand-blue/15 text-brand-blue' },
  premium: { label: 'پریمیوم', chip: 'bg-amber-500/15 text-amber-400' },
};

const TIER_OPTIONS = ['free', 'vip', 'premium'];
const EXTEND_PRESETS = [7, 30, 90, 365];

function TierPill({ tier }) {
  const meta = TIER_META[tier] || {
    label: tier || '—',
    chip: 'bg-surface-elevated text-text-secondary',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        meta.chip
      )}
    >
      <Crown size={12} />
      {meta.label}
    </span>
  );
}

function StatusPill({ status }) {
  const isActive = status === 'active';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        isActive
          ? 'bg-brand-green/15 text-brand-green'
          : 'bg-brand-red/15 text-brand-red'
      )}
    >
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full',
          isActive
            ? 'bg-brand-green shadow-[0_0_6px_rgba(0,200,83,0.6)]'
            : 'bg-brand-red shadow-[0_0_6px_rgba(255,23,68,0.6)]'
        )}
      />
      {isActive ? 'فعال' : 'مسدود'}
    </span>
  );
}

function StatMini({ icon: Icon, label, value, tint }) {
  return (
    <div className="rounded-xl bg-surface-card border border-surface-border p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-xs">{label}</span>
        <span
          className={clsx(
            'w-7 h-7 rounded-lg flex items-center justify-center',
            tint
          )}
        >
          <Icon size={15} />
        </span>
      </div>
      <AnimatedCounter
        value={Number(value) || 0}
        className="text-xl font-bold text-text-primary tabular-nums"
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-border/60 last:border-0">
      <span className="w-7 h-7 mt-0.5 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
        <Icon size={14} className="text-text-muted" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-text-muted mb-0.5">{label}</p>
        <div className="text-sm text-text-primary break-words">{children}</div>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-text-secondary mb-3">{children}</h3>
  );
}

export default function UserDetailDrawer({ userId, onClose, onChanged }) {
  const toast = useToast();
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  // action state
  const [busy, setBusy] = useState(null); // key of the in-flight action
  const [tierDraft, setTierDraft] = useState('free');
  const [tierDays, setTierDays] = useState(30);
  const [newPassword, setNewPassword] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    notes: '',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOpen = !!userId;

  const query = useQuery({
    queryKey: ['bn-user', userId],
    queryFn: () => bnAPI.getUser(userId),
    enabled: isOpen,
  });

  const user = query.data;

  // sync drafts when user data lands
  useEffect(() => {
    if (user) {
      setTierDraft(user.tier || 'free');
      setForm({
        fullName: user.fullName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        notes: user.notes || '',
      });
    }
  }, [user]);

  // enter / exit animation (mirror Modal pattern)
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const t = setTimeout(() => setVisible(false), 220);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) requestClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, busy]);

  const requestClose = () => {
    if (busy) return;
    setEditing(false);
    onClose && onClose();
  };

  // generic real-API action runner
  const run = async (key, fn, successMsg) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
      await query.refetch();
      onChanged && onChanged();
      return true;
    } catch (e) {
      toast.error(
        e?.response?.data?.detail || 'انجام عملیات با خطا مواجه شد'
      );
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleSetTier = () =>
    run(
      'tier',
      () =>
        bnAPI.setTier(
          userId,
          tierDraft,
          tierDraft === 'free' ? 0 : Number(tierDays) || 0
        ),
      'سطح کاربر بروزرسانی شد'
    );

  const handleToggleStatus = () => {
    const next = user?.status === 'active' ? 'disabled' : 'active';
    return run(
      'status',
      () => bnAPI.setStatus(userId, next),
      next === 'active' ? 'کاربر فعال شد' : 'کاربر مسدود شد'
    );
  };

  const handleExtend = (days) =>
    run(
      `extend-${days}`,
      () => bnAPI.extendUser(userId, days),
      `اشتراک ${toPersianDigits(days)} روز تمدید شد`
    );

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.warning('رمز عبور باید حداقل ۶ کاراکتر باشد');
      return;
    }
    const ok = await run(
      'password',
      () => bnAPI.resetPassword(userId, newPassword),
      'رمز عبور بازنشانی شد'
    );
    if (ok) setNewPassword('');
  };

  const handleSaveEdit = async () => {
    const ok = await run(
      'edit',
      () =>
        bnAPI.updateUser(userId, {
          fullName: form.fullName,
          email: form.email,
          phoneNumber: form.phoneNumber,
          notes: form.notes,
        }),
      'اطلاعات کاربر ذخیره شد'
    );
    if (ok) setEditing(false);
  };

  const handleDelete = async () => {
    const ok = await run(
      'delete',
      () => bnAPI.deleteUser(userId),
      'کاربر حذف شد'
    );
    if (ok) {
      setConfirmDelete(false);
      onClose && onClose();
    }
  };

  const initials = useMemo(() => {
    const src = (user?.fullName || user?.username || '').trim();
    if (!src) return '؟';
    const parts = src.split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }, [user]);

  const stats = user?.stats || {};

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* backdrop */}
      <div
        onClick={requestClose}
        className={clsx(
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200',
          animating ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* panel (physically on the right edge) */}
      <div
        className={clsx(
          'absolute top-0 right-0 h-full w-full max-w-[30rem] bg-surface-card border-l border-surface-border shadow-2xl',
          'flex flex-col transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none'
        )}
        style={{ transform: animating ? 'translateX(0)' : 'translateX(100%)' }}
        role="dialog"
        aria-modal="true"
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-surface-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-brand-blue/15 text-brand-blue flex items-center justify-center font-bold text-sm shrink-0">
              {query.isLoading ? '…' : initials}
            </div>
            <div className="min-w-0">
              {query.isLoading ? (
                <>
                  <SkeletonBox className="h-4 w-28 mb-1.5" />
                  <SkeletonBox className="h-3 w-40" />
                </>
              ) : (
                <>
                  <p
                    className="text-base font-bold text-text-primary truncate"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  >
                    {user?.username || '—'}
                  </p>
                  <p className="text-xs text-text-muted truncate" dir="ltr" style={{ textAlign: 'right' }}>
                    {user?.email || 'بدون ایمیل'}
                  </p>
                </>
              )}
            </div>
          </div>
          <button
            onClick={requestClose}
            disabled={!!busy}
            className="text-text-muted hover:text-text-primary transition-colors p-1.5 rounded-lg hover:bg-surface-hover shrink-0 disabled:opacity-40"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {query.isError ? (
            <ErrorState
              description="دریافت اطلاعات کاربر با خطا مواجه شد."
              onRetry={query.refetch}
            />
          ) : query.isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonBox key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <SkeletonBox className="h-40 rounded-xl" />
              <SkeletonBox className="h-32 rounded-xl" />
            </div>
          ) : !user ? (
            <EmptyState title="کاربر یافت نشد" description="این کاربر وجود ندارد یا حذف شده است." />
          ) : (
            <>
              {/* status + tier row */}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill status={user.status} />
                <TierPill tier={user.tier} />
                {user.phoneVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-brand-green/15 text-brand-green">
                    <BadgeCheck size={12} />
                    شماره تأییدشده
                  </span>
                )}
              </div>

              {/* stat mini cards */}
              <div className="grid grid-cols-2 gap-3">
                <StatMini
                  icon={ListChecks}
                  label="واچ‌لیست‌ها"
                  value={stats.watchlists}
                  tint="bg-brand-blue/15 text-brand-blue"
                />
                <StatMini
                  icon={ShoppingCart}
                  label="سفارش‌ها"
                  value={stats.orders}
                  tint="bg-amber-500/15 text-amber-400"
                />
                <StatMini
                  icon={Sparkles}
                  label="سیگنال‌های AI"
                  value={stats.aiSignals}
                  tint="bg-brand-green/15 text-brand-green"
                />
                <StatMini
                  icon={Landmark}
                  label="حساب‌های صرافی"
                  value={stats.exchangeAccounts}
                  tint="bg-purple-500/15 text-purple-400"
                />
              </div>

              {/* profile / edit */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionTitle>اطلاعات پروفایل</SectionTitle>
                  {!editing ? (
                    <button
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 text-xs text-brand-blue hover:text-brand-blue/80 transition-colors"
                    >
                      <Pencil size={13} />
                      ویرایش
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditing(false);
                        setForm({
                          fullName: user.fullName || '',
                          email: user.email || '',
                          phoneNumber: user.phoneNumber || '',
                          notes: user.notes || '',
                        });
                      }}
                      className="text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                      انصراف
                    </button>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">نام کامل</label>
                      <input
                        className="w-full text-sm"
                        value={form.fullName}
                        onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">ایمیل</label>
                      <input
                        className="w-full text-sm"
                        dir="ltr"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">شماره تماس</label>
                      <input
                        className="w-full text-sm"
                        dir="ltr"
                        value={form.phoneNumber}
                        onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">یادداشت مدیر</label>
                      <textarea
                        rows={3}
                        className="w-full text-sm resize-none"
                        value={form.notes}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                    <button
                      onClick={handleSaveEdit}
                      disabled={busy === 'edit'}
                      className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                      {busy === 'edit' ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Save size={15} />
                          ذخیره تغییرات
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-surface-card border border-surface-border px-4 py-1">
                    <InfoRow icon={ShieldCheck} label="نام کامل">
                      {user.fullName || '—'}
                    </InfoRow>
                    <InfoRow icon={Phone} label="شماره تماس">
                      <span dir="ltr">
                        {user.phoneNumber ? toPersianDigits(user.phoneNumber) : '—'}
                      </span>
                    </InfoRow>
                    <InfoRow icon={Layers} label="نوع حساب">
                      {user.accountType === 'real'
                        ? 'واقعی'
                        : user.accountType === 'demo'
                        ? 'آزمایشی'
                        : user.accountType || '—'}
                    </InfoRow>
                    <InfoRow icon={BadgeCheck} label="سطح ارزیابی">
                      {user.assessmentLevel != null
                        ? toPersianDigits(user.assessmentLevel)
                        : '—'}
                    </InfoRow>
                    <InfoRow icon={CalendarClock} label="انقضای اشتراک">
                      {user.expiresAt ? (
                        <span>
                          {formatDate(user.expiresAt)}{' '}
                          <span className="text-text-muted text-xs">
                            ({formatRelativeTime(user.expiresAt)})
                          </span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </InfoRow>
                    <InfoRow icon={CalendarPlus} label="تاریخ عضویت">
                      {user.createdAt ? formatDate(user.createdAt) : '—'}
                    </InfoRow>
                    <InfoRow icon={LogIn} label="آخرین ورود">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'بدون ورود'}
                    </InfoRow>
                    {user.notes ? (
                      <InfoRow icon={Pencil} label="یادداشت مدیر">
                        {user.notes}
                      </InfoRow>
                    ) : null}
                  </div>
                )}
              </div>

              {/* actions */}
              <div className="space-y-5">
                <SectionTitle>عملیات مدیریتی</SectionTitle>

                {/* tier */}
                <div className="rounded-xl bg-surface-card border border-surface-border p-4 space-y-3">
                  <p className="text-xs text-text-muted">تغییر سطح اشتراک</p>
                  <div className="inline-flex items-center gap-1 rounded-lg bg-surface-elevated border border-surface-border p-0.5 w-full">
                    {TIER_OPTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTierDraft(t)}
                        className={clsx(
                          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-[background,color] duration-200',
                          tierDraft === t
                            ? 'bg-brand-blue/15 text-brand-blue'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                        )}
                      >
                        {TIER_META[t].label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={clsx(
                        'flex items-center gap-2 flex-1',
                        tierDraft === 'free' && 'opacity-40 pointer-events-none'
                      )}
                    >
                      <input
                        type="number"
                        min={1}
                        value={tierDays}
                        onChange={(e) => setTierDays(e.target.value)}
                        className="w-24 text-center text-sm tabular-nums"
                        dir="ltr"
                      />
                      <span className="text-xs text-text-muted">روز</span>
                    </div>
                    <button
                      onClick={handleSetTier}
                      disabled={busy === 'tier'}
                      className="btn-primary flex items-center gap-2 shrink-0"
                    >
                      {busy === 'tier' ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Crown size={14} />
                          اعمال
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* extend */}
                <div className="rounded-xl bg-surface-card border border-surface-border p-4 space-y-3">
                  <p className="text-xs text-text-muted">تمدید سریع اشتراک</p>
                  <div className="grid grid-cols-4 gap-2">
                    {EXTEND_PRESETS.map((d) => (
                      <button
                        key={d}
                        onClick={() => handleExtend(d)}
                        disabled={busy === `extend-${d}`}
                        className="px-2 py-2 text-xs font-medium rounded-lg bg-surface-elevated border border-surface-border text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-[background,color] duration-200 disabled:opacity-50 flex items-center justify-center"
                      >
                        {busy === `extend-${d}` ? (
                          <span className="w-3.5 h-3.5 border-2 border-text-muted/40 border-t-text-primary rounded-full animate-spin" />
                        ) : (
                          <>+{toPersianDigits(d)} روز</>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* reset password */}
                <div className="rounded-xl bg-surface-card border border-surface-border p-4 space-y-3">
                  <p className="text-xs text-text-muted">بازنشانی رمز عبور</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="رمز عبور جدید"
                      className="flex-1 text-sm"
                      dir="ltr"
                    />
                    <button
                      onClick={handleResetPassword}
                      disabled={busy === 'password'}
                      className="btn-ghost flex items-center gap-2 shrink-0"
                    >
                      {busy === 'password' ? (
                        <span className="w-4 h-4 border-2 border-text-muted/40 border-t-text-primary rounded-full animate-spin" />
                      ) : (
                        <>
                          <KeyRound size={14} />
                          بازنشانی
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* status toggle + delete */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleStatus}
                    disabled={busy === 'status'}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-[background,color] duration-200',
                      user.status === 'active'
                        ? 'bg-brand-red/10 text-brand-red hover:bg-brand-red/15'
                        : 'bg-brand-green/10 text-brand-green hover:bg-brand-green/15'
                    )}
                  >
                    {busy === 'status' ? (
                      <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : user.status === 'active' ? (
                      <>
                        <Ban size={15} />
                        مسدودسازی
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        فعال‌سازی
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={!!busy}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-red/10 text-brand-red hover:bg-brand-red/15 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    حذف
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={busy === 'delete'}
        title="حذف کاربر"
        message={`آیا از حذف «${user?.username || ''}» اطمینان دارید؟ این عملیات قابل بازگشت نیست.`}
        variant="danger"
        confirmText="حذف کاربر"
      />
    </div>
  );
}
