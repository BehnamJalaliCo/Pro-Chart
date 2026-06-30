/**
 * LoadingSkeleton - کامپوننت اسکلتون بارگذاری با انیمیشن پالس
 * پشتیبانی از واریانت‌های مختلف: card, table-row, chart, text, circle
 */

const shimmerClass =
  'animate-pulse bg-dark-800/60 dark:bg-dark-800/60 rounded';

function SkeletonCard() {
  return (
    <div className="glass-card p-5 space-y-4">
      {/* هدر کارت */}
      <div className="flex items-center justify-between">
        <div className={`${shimmerClass} h-5 w-24 rounded-lg`} />
        <div className={`${shimmerClass} h-7 w-16 rounded-full`} />
      </div>
      {/* ردیف‌های داده */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className={`${shimmerClass} h-4 w-14`} />
          <div className={`${shimmerClass} h-4 w-20`} />
        </div>
        <div className="flex justify-between">
          <div className={`${shimmerClass} h-4 w-14`} />
          <div className={`${shimmerClass} h-4 w-20`} />
        </div>
        <div className="flex justify-between">
          <div className={`${shimmerClass} h-4 w-14`} />
          <div className={`${shimmerClass} h-4 w-20`} />
        </div>
      </div>
      {/* پاورقی کارت */}
      <div className="flex items-center justify-between pt-3 border-t border-dark-800/50">
        <div className={`${shimmerClass} h-3 w-20`} />
        <div className={`${shimmerClass} h-3 w-16`} />
      </div>
    </div>
  );
}

function SkeletonTableRow() {
  return (
    <tr>
      <td className="py-3 px-4">
        <div className={`${shimmerClass} h-4 w-20`} />
      </td>
      <td className="py-3 px-4">
        <div className={`${shimmerClass} h-6 w-14 rounded-full`} />
      </td>
      <td className="py-3 px-4">
        <div className={`${shimmerClass} h-4 w-16`} />
      </td>
      <td className="py-3 px-4">
        <div className={`${shimmerClass} h-4 w-16`} />
      </td>
      <td className="py-3 px-4">
        <div className={`${shimmerClass} h-4 w-16`} />
      </td>
      <td className="py-3 px-4">
        <div className={`${shimmerClass} h-4 w-12`} />
      </td>
    </tr>
  );
}

function SkeletonChart() {
  return (
    <div className="glass-card p-6 space-y-4">
      {/* عنوان نمودار */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className={`${shimmerClass} h-5 w-32`} />
          <div className={`${shimmerClass} h-3 w-48`} />
        </div>
        <div className={`${shimmerClass} h-8 w-24 rounded-full`} />
      </div>
      {/* ناحیه نمودار */}
      <div className="relative h-64 w-full flex items-end gap-1 pt-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`${shimmerClass} flex-1 rounded-t-sm`}
            style={{
              height: `${20 + Math.sin(i * 0.8) * 30 + Math.random() * 30}%`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
      {/* محور افقی */}
      <div className="flex justify-between pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`${shimmerClass} h-3 w-10`} />
        ))}
      </div>
    </div>
  );
}

function SkeletonText({ lines = 3, widths }) {
  const defaultWidths = ['100%', '92%', '75%', '88%', '60%'];
  return (
    <div className="space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`${shimmerClass} h-4`}
          style={{
            width: widths?.[i] || defaultWidths[i % defaultWidths.length],
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}

function SkeletonCircle({ size = 48 }) {
  return (
    <div
      className={`${shimmerClass} rounded-full shrink-0`}
      style={{ width: size, height: size }}
    />
  );
}

/**
 * @param {Object} props
 * @param {'card'|'table-row'|'chart'|'text'|'circle'} props.variant - نوع اسکلتون
 * @param {number} [props.count=1] - تعداد تکرار
 * @param {number} [props.lines=3] - تعداد خطوط (فقط برای variant=text)
 * @param {string[]} [props.widths] - آرایه عرض خطوط (فقط برای variant=text)
 * @param {number} [props.size=48] - اندازه دایره (فقط برای variant=circle)
 * @param {string} [props.className=''] - کلاس‌های اضافی
 */
export default function LoadingSkeleton({
  variant = 'card',
  count = 1,
  lines = 3,
  widths,
  size = 48,
  className = '',
}) {
  const items = Array.from({ length: count });

  if (variant === 'table-row') {
    return (
      <tbody className={className}>
        {items.map((_, i) => (
          <SkeletonTableRow key={i} />
        ))}
      </tbody>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={className}>
        {items.map((_, i) => (
          <SkeletonChart key={i} />
        ))}
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={className}>
        {items.map((_, i) => (
          <SkeletonText key={i} lines={lines} widths={widths} />
        ))}
      </div>
    );
  }

  if (variant === 'circle') {
    return (
      <div className={`flex gap-3 ${className}`}>
        {items.map((_, i) => (
          <SkeletonCircle key={i} size={size} />
        ))}
      </div>
    );
  }

  // پیش‌فرض: card
  return (
    <div className={`grid gap-4 ${className}`}>
      {items.map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
