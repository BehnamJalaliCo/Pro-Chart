import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * ErrorState — حالت خطای حرفه‌ای، هم‌راستا با EmptyState.
 *
 * استفاده:
 *   <ErrorState
 *     description="سرور پاسخ نداد. دوباره تلاش کنید."
 *     onRetry={refetch}
 *   />
 */
export default function ErrorState({
  title = 'خطا در دریافت اطلاعات',
  description,
  onRetry,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8' : 'py-16'
      }`}
      role="alert"
    >
      <div className="w-16 h-16 rounded-2xl bg-surface-hover flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-brand-red" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted max-w-sm mb-4">{description}</p>
      )}
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-ghost mt-2">
          تلاش مجدد
        </button>
      )}
    </div>
  );
}
