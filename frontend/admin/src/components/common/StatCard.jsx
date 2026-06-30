import React from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

const variantStyles = {
  default: {
    icon: 'bg-surface-elevated text-text-secondary',
  },
  success: {
    icon: 'bg-brand-green/15 text-brand-green',
  },
  danger: {
    icon: 'bg-brand-red/15 text-brand-red',
  },
  warning: {
    icon: 'bg-yellow-500/15 text-yellow-500',
  },
  info: {
    icon: 'bg-brand-blue/15 text-brand-blue',
  },
};

function Skeleton({ className }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded bg-surface-elevated',
        className
      )}
    />
  );
}

export default function StatCard({
  icon: Icon,
  title,
  value,
  change,
  trend,
  variant = 'default',
  loading = false,
}) {
  const styles = variantStyles[variant] || variantStyles.default;

  const trendDirection =
    trend !== undefined ? trend : change !== undefined && change !== null ? (change >= 0 ? 'up' : 'down') : null;

  const formattedChange =
    change !== undefined && change !== null
      ? `${change >= 0 ? '+' : ''}${toPersianDigits(typeof change === 'number' ? change.toFixed(1) : change)}٪`
      : null;

  if (loading) {
    return (
      <div className="stat-card">
        <div className="flex items-center justify-between">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <Skeleton className="w-12 h-4" />
        </div>
        <div className="mt-1">
          <Skeleton className="w-20 h-7 mb-1.5" />
          <Skeleton className="w-16 h-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        {Icon && (
          <div
            className={clsx(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              styles.icon
            )}
          >
            <Icon size={20} />
          </div>
        )}
        {formattedChange && (
          <div
            className={clsx(
              'flex items-center gap-0.5 text-xs font-medium',
              trendDirection === 'up' ? 'text-brand-green' : 'text-brand-red'
            )}
          >
            {trendDirection === 'up' ? (
              <TrendingUp size={14} />
            ) : (
              <TrendingDown size={14} />
            )}
            <span>{formattedChange}</span>
          </div>
        )}
      </div>
      <div className="mt-1">
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted mt-0.5">{title}</p>
      </div>
    </div>
  );
}
