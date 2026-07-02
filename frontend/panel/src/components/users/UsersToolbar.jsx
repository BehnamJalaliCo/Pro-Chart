import React from 'react';
import { clsx } from 'clsx';
import { UserPlus, Users } from 'lucide-react';
import SearchInput from '../common/SearchInput';
import { toPersianDigits } from '../../utils/formatters';

/**
 * UsersToolbar — presentational, controlled toolbar for the users page.
 * No data fetching here; parent owns state and passes values + callbacks.
 */

const TIER_OPTIONS = [
  { value: 'all', label: 'همه' },
  { value: 'free', label: 'رایگان' },
  { value: 'vip', label: 'ویژه' },
  { value: 'premium', label: 'پریمیوم' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'همه' },
  { value: 'active', label: 'فعال' },
  { value: 'disabled', label: 'مسدود' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'all', label: 'همه' },
  { value: 'real', label: 'واقعی' },
  { value: 'demo', label: 'آزمایشی' },
];

function ChipGroup({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-text-muted text-xs shrink-0">{label}</span>
      <div className="inline-flex items-center gap-1 rounded-lg bg-surface-elevated border border-surface-border p-0.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange && onChange(opt.value)}
              className={clsx(
                'px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap',
                'transition-[background,color] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
                active
                  ? 'bg-brand-blue/15 text-brand-blue'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function UsersToolbar({
  q = '',
  onSearchChange,
  tier = 'all',
  onTierChange,
  status = 'all',
  onStatusChange,
  accountType = 'all',
  onAccountTypeChange,
  onAddUser,
  total,
  loading = false,
}) {
  const hasCount = typeof total === 'number' && !isNaN(total);

  return (
    <div className="card p-4 flex flex-col gap-4">
      {/* Row 1: search + count + primary action */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={q}
          onChange={onSearchChange}
          placeholder="جستجوی نام کاربری، ایمیل یا شماره..."
          debounceMs={300}
          className="flex-1 min-w-[220px]"
        />

        <div className="flex items-center gap-1.5 shrink-0 rounded-lg bg-surface-elevated border border-surface-border px-3 py-2">
          <Users size={15} className="text-text-muted" />
          {loading ? (
            <span className="inline-block h-3.5 w-10 rounded bg-surface-hover animate-pulse" />
          ) : (
            <span className="text-sm text-text-secondary tabular-nums">
              {hasCount ? (
                <>
                  <span className="text-text-primary font-semibold">{toPersianDigits(total)}</span> کاربر
                </>
              ) : (
                'بدون داده'
              )}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onAddUser}
          className="btn-primary flex items-center gap-2 shrink-0 active:scale-[0.98] transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
        >
          <UserPlus size={16} />
          افزودن کاربر
        </button>
      </div>

      {/* Row 2: filter chips */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ChipGroup label="سطح" options={TIER_OPTIONS} value={tier} onChange={onTierChange} />
        <ChipGroup label="وضعیت" options={STATUS_OPTIONS} value={status} onChange={onStatusChange} />
        <ChipGroup
          label="نوع حساب"
          options={ACCOUNT_TYPE_OPTIONS}
          value={accountType}
          onChange={onAccountTypeChange}
        />
      </div>
    </div>
  );
}
