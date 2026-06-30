import { useQuery } from '@tanstack/react-query';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import { userAPI } from '../api/client';

const IMPACT = {
  high: { c: 'bg-brand-red/15 text-brand-red', t: 'بالا' },
  medium: { c: 'bg-brand-amber/15 text-brand-amber', t: 'متوسط' },
  low: { c: 'bg-brand-blue/12 text-brand-blue', t: 'کم' },
};

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function EconomicCalendar() {
  const { data } = useQuery({ queryKey: ['economicCalendar'], queryFn: () => userAPI.economicCalendar(), refetchInterval: 300000 });
  const items = data?.items || [];
  const highToday = items.filter((e) => e.impact === 'high').length;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock size={18} className="text-brand-blue" />
        <h3 className="font-bold text-text-primary">تقویمِ اقتصادی</h3>
        {highToday > 0 && (
          <span className="ms-auto flex items-center gap-1 text-[11px] bg-brand-red/12 text-brand-red px-2 py-0.5 rounded-full">
            <AlertTriangle size={12} /> {highToday.toLocaleString('fa-IR')} رویدادِ پرتأثیر
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8">رویدادِ مهمی برای ۲۴ ساعتِ آینده ثبت نشده است.</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {items.map((e, i) => {
            const im = IMPACT[e.impact] || IMPACT.low;
            const past = (e.minutes_to ?? 1) < 0;
            return (
              <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${past ? 'opacity-50' : ''} bg-surface-elevated`}>
                <div className="text-xs font-mono text-text-secondary w-12 shrink-0">{fmtTime(e.event_time)}</div>
                <span className="text-[11px] font-bold text-text-muted w-8 shrink-0">{e.currency}</span>
                <div className="flex-1 min-w-0 text-sm text-text-primary truncate">{e.title}</div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${im.c}`}>{im.t}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-text-muted mt-3">در ساعاتِ نزدیک به رویدادهای پرتأثیر، نوسانِ بازار بالاست؛ راهبردِ ما خودکار محتاط‌تر عمل می‌کند.</p>
    </div>
  );
}
