import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  UserPlus,
  UserCog,
  UserX,
  Trash2,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  CalendarPlus,
  CrownIcon,
  LogIn,
  Layers,
  Pencil,
} from 'lucide-react';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import LiveDot from '../common/LiveDot';
import { bnAPI } from '../../api/client';
import { toPersianDigits } from '../../utils/formatters';

/**
 * SystemActivity — فید فعالیت اخیر مدیران (bnAPI.getAudit(30)).
 *
 * تایم‌لاین از اقدامات ادمین: نوع اقدام، موجودیت، زمان نسبی فارسی و شناسه‌ی ادمین.
 * آیکون و رنگ بر اساس نوع اقدام. داده‌ی واقعی؛ هیچ مقدار ساختگی وجود ندارد.
 *
 * حالت‌ها: loading (skeleton نرم) / empty (EmptyState) / error (ErrorState).
 * default export — بدون props.
 */

// نگاشت نوع اقدام → آیکون + رنگ (توکن‌های brand) + برچسب فارسی
const ACTION_MAP = {
  'create-user': { icon: UserPlus, tone: 'green', label: 'ایجاد کاربر' },
  'user.create': { icon: UserPlus, tone: 'green', label: 'ایجاد کاربر' },
  'update-user': { icon: Pencil, tone: 'blue', label: 'ویرایش کاربر' },
  'user.update': { icon: Pencil, tone: 'blue', label: 'ویرایش کاربر' },
  'delete-user': { icon: Trash2, tone: 'red', label: 'حذف کاربر' },
  'user.delete': { icon: Trash2, tone: 'red', label: 'حذف کاربر' },
  'set-tier': { icon: CrownIcon, tone: 'amber', label: 'تغییر سطح اشتراک' },
  'user.tier': { icon: CrownIcon, tone: 'amber', label: 'تغییر سطح اشتراک' },
  'set-status': { icon: UserCog, tone: 'blue', label: 'تغییر وضعیت' },
  'user.status': { icon: UserCog, tone: 'blue', label: 'تغییر وضعیت' },
  'enable-user': { icon: ShieldCheck, tone: 'green', label: 'فعال‌سازی کاربر' },
  'disable-user': { icon: ShieldOff, tone: 'red', label: 'غیرفعال‌سازی کاربر' },
  'block-user': { icon: UserX, tone: 'red', label: 'مسدودسازی کاربر' },
  'extend-user': { icon: CalendarPlus, tone: 'green', label: 'تمدید اشتراک' },
  'user.extend': { icon: CalendarPlus, tone: 'green', label: 'تمدید اشتراک' },
  'reset-password': { icon: KeyRound, tone: 'amber', label: 'بازنشانی گذرواژه' },
  'user.password': { icon: KeyRound, tone: 'amber', label: 'بازنشانی گذرواژه' },
  'bulk': { icon: Layers, tone: 'blue', label: 'اقدام گروهی' },
  'bulk-users': { icon: Layers, tone: 'blue', label: 'اقدام گروهی' },
  'login': { icon: LogIn, tone: 'blue', label: 'ورود' },
};

const TONE = {
  green: { chip: 'bg-brand-green/10 text-brand-green', line: 'bg-brand-green/30' },
  red: { chip: 'bg-brand-red/10 text-brand-red', line: 'bg-brand-red/30' },
  blue: { chip: 'bg-brand-blue/10 text-brand-blue', line: 'bg-brand-blue/30' },
  amber: { chip: 'bg-[#FFB300]/10 text-[#FFB300]', line: 'bg-[#FFB300]/30' },
  neutral: { chip: 'bg-surface-hover text-text-muted', line: 'bg-surface-border' },
};

const ENTITY_LABELS = {
  user: 'کاربر',
  subscription: 'اشتراک',
  order: 'سفارش',
  signal: 'سیگنال',
  watchlist: 'واچ‌لیست',
};

function resolveAction(action) {
  if (!action) return { icon: Activity, tone: 'neutral', label: 'فعالیت' };
  const key = String(action).toLowerCase();
  if (ACTION_MAP[key]) return ACTION_MAP[key];
  // تطبیق تقریبی بر اساس کلمات کلیدی
  if (key.includes('delete')) return { icon: Trash2, tone: 'red', label: 'حذف' };
  if (key.includes('create')) return { icon: UserPlus, tone: 'green', label: 'ایجاد' };
  if (key.includes('update') || key.includes('edit'))
    return { icon: Pencil, tone: 'blue', label: 'ویرایش' };
  if (key.includes('tier') || key.includes('extend'))
    return { icon: CrownIcon, tone: 'amber', label: 'اشتراک' };
  if (key.includes('password')) return { icon: KeyRound, tone: 'amber', label: 'گذرواژه' };
  if (key.includes('status') || key.includes('block') || key.includes('disable'))
    return { icon: UserCog, tone: 'blue', label: 'وضعیت' };
  if (key.includes('bulk')) return { icon: Layers, tone: 'blue', label: 'اقدام گروهی' };
  // نمایش خام اما تمیز به‌عنوان fallback
  return { icon: Activity, tone: 'neutral', label: action.replace(/[-_.]/g, ' ') };
}

// زمان نسبی فارسی
function relativeTimeFa(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 0) return 'همین حالا';
  if (sec < 60) return 'همین حالا';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${toPersianDigits(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${toPersianDigits(hr)} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${toPersianDigits(day)} روز پیش`;
  const wk = Math.floor(day / 7);
  if (day < 30) return `${toPersianDigits(wk)} هفته پیش`;
  try {
    return d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return toPersianDigits(dateStr);
  }
}

function absTimeFa(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return toPersianDigits(dateStr);
  }
}

function entityLabel(entityType, entityId) {
  const name = ENTITY_LABELS[String(entityType || '').toLowerCase()] || entityType;
  if (!name) return '';
  if (entityId == null || entityId === '') return name;
  return `${name} #${toPersianDigits(entityId)}`;
}

function ActivityRow({ item, isLast }) {
  const meta = resolveAction(item.action);
  const Icon = meta.icon || Activity;
  const tone = TONE[meta.tone] || TONE.neutral;
  const ent = entityLabel(item.entityType, item.entityId);
  const admin = item.adminId != null ? `مدیر #${toPersianDigits(item.adminId)}` : 'سیستم';

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* خط تایم‌لاین */}
      {!isLast && (
        <span
          className="absolute right-[17px] top-9 bottom-0 w-px bg-surface-border"
          aria-hidden="true"
        />
      )}
      {/* آیکون */}
      <span
        className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.chip}`}
      >
        <Icon size={16} />
      </span>
      {/* محتوا */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-text-primary leading-snug">
            {meta.label}
            {ent && (
              <span className="text-text-secondary font-normal"> — {ent}</span>
            )}
          </p>
          <time
            className="shrink-0 text-xs text-text-muted tabular-nums whitespace-nowrap"
            title={absTimeFa(item.createdAt)}
          >
            {relativeTimeFa(item.createdAt)}
          </time>
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{admin}</p>
      </div>
    </li>
  );
}

export default function SystemActivity() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ['bn', 'audit', 30],
    queryFn: () => bnAPI.getAudit(30),
    staleTime: 30_000,
    refetchInterval: 60_000, // به‌روزرسانی هر ۶۰ ثانیه
  });

  const items = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.filter((it) => it && (it.id != null || it.action));
  }, [data]);

  const hasData = items.length > 0;

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary leading-tight">
              فعالیت اخیر سیستم
            </h3>
            <p className="text-xs text-text-muted mt-0.5">آخرین اقدامات مدیران</p>
          </div>
        </div>
        {hasData && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <LiveDot active={!!dataUpdatedAt} color="green" size={7} />
            <span>زنده</span>
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <ul className="space-y-4" aria-label="در حال بارگذاری" role="status">
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i} className="flex gap-3">
              <div className="h-9 w-9 shrink-0 rounded-lg bg-surface-hover motion-safe:animate-pulse" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-2/3 rounded bg-surface-hover motion-safe:animate-pulse" />
                <div className="h-2.5 w-1/3 rounded bg-surface-hover motion-safe:animate-pulse" />
              </div>
            </li>
          ))}
        </ul>
      ) : isError ? (
        <ErrorState
          compact
          description="دریافت فعالیت‌های اخیر ناموفق بود."
          onRetry={refetch}
        />
      ) : !hasData ? (
        <EmptyState
          compact
          icon={Activity}
          title="فعالیتی ثبت نشده"
          description="اقدامات مدیران پس از انجام، به‌صورت زنده در این تایم‌لاین نمایش داده می‌شود."
        />
      ) : (
        <ul
          className={`transition-opacity duration-200 ${
            isFetching ? 'opacity-70' : 'opacity-100'
          }`}
        >
          {items.map((item, i) => (
            <ActivityRow
              key={item.id ?? `${item.action}-${item.createdAt}-${i}`}
              item={item}
              isLast={i === items.length - 1}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
