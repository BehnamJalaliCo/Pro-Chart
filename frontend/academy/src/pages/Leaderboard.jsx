import { useQuery } from '@tanstack/react-query';
import { Trophy, Crown, Zap, BookOpen, Medal } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

const PODIUM = {
  1: { ring: 'ring-amber-400', bg: 'bg-amber-400/15', text: 'text-amber-400', label: 'طلا', order: 'order-2', h: 'sm:mt-0' },
  2: { ring: 'ring-slate-300', bg: 'bg-slate-300/15', text: 'text-slate-300', label: 'نقره', order: 'order-1', h: 'sm:mt-6' },
  3: { ring: 'ring-orange-400', bg: 'bg-orange-400/15', text: 'text-orange-400', label: 'برنز', order: 'order-3', h: 'sm:mt-10' },
};

function Avatar({ name, size = 'w-14 h-14', cls = '' }) {
  const ch = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className={`${size} rounded-full flex items-center justify-center font-black ${cls}`}>{ch}</div>
  );
}

function Podium({ item }) {
  const p = PODIUM[item.rank] || PODIUM[3];
  return (
    <div className={`${p.order} flex-1 flex flex-col items-center ${p.h}`}>
      <div className={`relative ${item.is_me ? 'scale-105' : ''}`}>
        <Avatar name={item.username} cls={`${p.bg} ${p.text} ring-2 ${p.ring}`} />
        {item.rank === 1 && <Crown size={20} className="absolute -top-3 left-1/2 -translate-x-1/2 text-amber-400" />}
        <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full ${p.bg} ${p.text} ring-2 ${p.ring} bg-surface flex items-center justify-center text-xs font-black`}>{item.rank}</span>
      </div>
      <div className={`mt-4 text-sm font-bold truncate max-w-[8rem] text-center ${item.is_me ? 'text-brand-green' : 'text-text-primary'}`}>
        {item.username}{item.is_me && ' (شما)'}
      </div>
      <div className="text-xs text-text-muted mt-0.5">{p.label}</div>
      <div className={`mt-2 px-3 py-1.5 rounded-xl ${p.bg} ${p.text} text-sm font-black flex items-center gap-1`}>
        <Zap size={13} /> {Number(item.xp || 0).toLocaleString('fa-IR')}
      </div>
      <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
        <BookOpen size={11} /> {Number(item.completed || 0).toLocaleString('fa-IR')} درس
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const { data, isLoading } = useQuery({ queryKey: ['leaderboard'], queryFn: () => api.leaderboard(), staleTime: 60e3 });

  const items = data?.items || [];
  const top3 = items.filter((i) => i.rank <= 3);
  const rest = items.filter((i) => i.rank > 3);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="text-amber-400" />
        <h1 className="text-xl font-black">لیدربورد آکادمی</h1>
        {!isLoading && <span className="text-xs text-text-muted">({Number(data?.total_students || items.length).toLocaleString('fa-IR')} دانش‌آموز)</span>}
        <GuideButton guideKey="leaderboard" auto className="ms-auto" />
      </div>

      {data?.my_rank != null && (
        <div className="card p-4 mb-5 flex items-center justify-between bg-brand-green/10 border-brand-green/30">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-green">
            <Medal size={18} /> رتبهٔ شما: {Number(data.my_rank).toLocaleString('fa-IR')} از {Number(data.total_students || items.length).toLocaleString('fa-IR')}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-text-muted text-center py-10 text-sm">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <Trophy size={36} className="text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm">هنوز رتبه‌بندی‌ای ثبت نشده است. اولین نفر باش!</p>
        </div>
      ) : (
        <>
          {top3.length > 0 && (
            <div className="flex items-end justify-center gap-3 sm:gap-6 mb-6 px-2">
              {top3.map((it) => <Podium key={it.rank} item={it} />)}
            </div>
          )}

          {rest.length > 0 && (
            <div className="space-y-2">
              {rest.map((it) => (
                <div key={it.rank}
                  className={`card p-3 flex items-center gap-3 ${it.is_me ? 'border-brand-green/40 bg-brand-green/10' : ''}`}>
                  <span className={`w-8 text-center text-sm font-black ${it.is_me ? 'text-brand-green' : 'text-text-muted'}`}>{Number(it.rank).toLocaleString('fa-IR')}</span>
                  <Avatar name={it.username} size="w-9 h-9" cls={`text-sm ${it.is_me ? 'bg-brand-green/20 text-brand-green' : 'bg-surface-elevated text-text-secondary'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold truncate ${it.is_me ? 'text-brand-green' : 'text-text-primary'}`}>
                      {it.username}{it.is_me && ' (شما)'}
                    </div>
                    <div className="text-[11px] text-text-muted flex items-center gap-1">
                      <BookOpen size={11} /> {Number(it.completed || 0).toLocaleString('fa-IR')} درس
                    </div>
                  </div>
                  <div className="text-sm font-black text-amber-400 flex items-center gap-1 shrink-0">
                    <Zap size={13} /> {Number(it.xp || 0).toLocaleString('fa-IR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
