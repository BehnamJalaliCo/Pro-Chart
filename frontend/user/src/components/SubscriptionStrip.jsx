import { useQuery } from '@tanstack/react-query';
import { Crown, Clock, ArrowUpCircle } from 'lucide-react';
import { userAPI } from '../api/client';

export default function SubscriptionStrip() {
  const { data } = useQuery({ queryKey: ['subscription'], queryFn: () => userAPI.subscription(), refetchInterval: 60000 });
  if (!data) return null;

  if (!data.active) {
    return (
      <div className="card p-4 flex items-center gap-3 border-brand-amber/40">
        <Crown size={20} className="text-brand-amber shrink-0" />
        <div className="flex-1 text-sm text-text-secondary">اشتراکِ فعالی یافت نشد.</div>
        <a href={data.bot_url || '#'} target="_blank" rel="noreferrer" className="btn-primary text-sm shrink-0">تهیهٔ اشتراک</a>
      </div>
    );
  }

  const soon = data.expiring_soon;
  const days = data.days_left;
  return (
    <div className={`card p-4 flex items-center gap-3 ${soon ? 'border-brand-amber/50' : 'border-brand-green/30'}`}>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${soon ? 'bg-brand-amber/15 text-brand-amber' : 'bg-brand-green/15 text-brand-green'}`}>
        <Crown size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-text-primary text-sm">اشتراکِ {data.plan_fa} <span className="text-[11px] bg-brand-green/15 text-brand-green px-2 py-0.5 rounded-full">فعال</span></div>
        <div className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
          <Clock size={12} />
          {days > 0 ? <>{days.toLocaleString('fa-IR')} روز باقی‌مانده{data.hours_left ? ` و ${data.hours_left.toLocaleString('fa-IR')} ساعت` : ''}</> : 'امروز منقضی می‌شود'}
        </div>
      </div>
      <a href={data.bot_url || '#'} target="_blank" rel="noreferrer"
        className={`shrink-0 flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl ${soon ? 'bg-brand-amber text-white' : 'border border-surface-border text-text-secondary hover:text-brand-blue hover:border-brand-blue'} transition`}>
        <ArrowUpCircle size={16} /> {soon ? 'تمدید کن' : 'تمدید / ارتقا'}
      </a>
    </div>
  );
}
