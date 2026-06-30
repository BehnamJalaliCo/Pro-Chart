import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, AlertTriangle, Power, XCircle, Info, CheckCheck } from 'lucide-react';
import { userAPI } from '../api/client';

const ICONS = {
  margin_alert: { I: AlertTriangle, c: 'text-brand-amber' },
  copy_stop: { I: Power, c: 'text-brand-red' },
  close_all: { I: XCircle, c: 'text-brand-red' },
};

function timeAgo(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'هم‌اکنون';
  if (s < 3600) return `${Math.floor(s / 60)} دقیقه پیش`;
  if (s < 86400) return `${Math.floor(s / 3600)} ساعت پیش`;
  return `${Math.floor(s / 86400)} روز پیش`;
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'], queryFn: () => userAPI.notifications(), refetchInterval: 20000,
  });
  const items = data?.items || [];
  const unread = data?.unread || 0;

  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      try { await userAPI.markNotificationsRead(); qc.invalidateQueries({ queryKey: ['notifications'] }); } catch { /* noop */ }
    }
  };

  return (
    <div className="relative">
      <button onClick={openPanel} className="relative w-9 h-9 rounded-xl hover:bg-surface-hover flex items-center justify-center text-text-secondary">
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
              {items.length > 0 && <CheckCheck size={15} className="ms-auto text-text-muted" />}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-10">اعلانی ندارید.</p>
              ) : items.map((n, i) => {
                const { I, c } = ICONS[n.kind] || { I: Info, c: 'text-brand-blue' };
                return (
                  <div key={i} className="flex gap-3 px-4 py-3 border-b border-surface-border/50 last:border-0">
                    <I size={18} className={`${c} shrink-0 mt-0.5`} />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-text-primary">{n.title}</div>
                      {n.body && <div className="text-xs text-text-secondary mt-0.5 leading-relaxed">{n.body}</div>}
                      <div className="text-[10px] text-text-muted mt-1">{timeAgo(n.ts)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
