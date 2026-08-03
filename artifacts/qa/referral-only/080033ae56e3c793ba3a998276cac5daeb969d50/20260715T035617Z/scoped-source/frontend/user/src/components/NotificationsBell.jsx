import { useState } from 'react';
import { Bell, BellOff } from 'lucide-react';

// نکته: هنوز نقطهٔ اتصالِ اعلانِ آکادمی موجود نیست؛ این زنگ امن (no-op) است
// تا صفحه دچارِ خطا نشود. پس از افزودنِ endpoint، به /academy/... وصل می‌شود.
export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const items = [];
  const unread = 0;

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-xl hover:bg-surface-hover flex items-center justify-center text-text-secondary" aria-label="اعلان‌ها">
        <Bell size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-brand-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-2 w-80 max-w-[90vw] z-40 rounded-2xl bg-surface-card border border-surface-border shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-border flex items-center gap-2">
              <Bell size={16} className="text-brand-blue" />
              <span className="font-bold text-text-primary text-sm">اعلان‌ها</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-text-muted">
                  <BellOff size={22} />
                  <p className="text-sm">اعلانی ندارید.</p>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
