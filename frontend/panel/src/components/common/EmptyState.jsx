import React from 'react';
import { Inbox } from 'lucide-react';

/**
 * EmptyState — حالت خالی informative.
 *
 * به‌جای صرفاً "داده‌ای نیست"، context + action ارائه می‌دهد.
 *
 * استفاده:
 *   <EmptyState
 *     icon={Signal}
 *     title="هنوز سیگنالی ندارید"
 *     description="هنگام تشخیص یک فرصت خوب، سیگنال اینجا ظاهر می‌شود."
 *     action={<Link to="/settings">تنظیمات فیلتر</Link>}
 *   />
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = 'موردی برای نمایش نیست',
  description,
  action,
  compact = false,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'py-8' : 'py-16'
      }`}
      role="status"
    >
      <div className="w-16 h-16 rounded-2xl bg-surface-hover flex items-center justify-center mb-4">
        <Icon size={28} className="text-text-muted" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-text-muted max-w-sm mb-4">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
