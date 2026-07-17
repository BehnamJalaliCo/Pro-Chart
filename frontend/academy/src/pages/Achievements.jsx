import { useQuery } from '@tanstack/react-query';
import * as Icons from 'lucide-react';
import { Award, Lock, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { GuideButton } from '../components/Guide';

function toPascal(name) {
  if (!name) return null;
  return name.replace(/(^|[-_ ])(\w)/g, (_, __, c) => c.toUpperCase());
}

function BadgeIcon({ icon, earned, size = 26 }) {
  const Comp = Icons[toPascal(icon)] || Award;
  return <Comp size={size} className={earned ? '' : 'opacity-50'} />;
}

function faDate(s) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return s; }
}

export default function Achievements() {
  const { data, isLoading } = useQuery({ queryKey: ['achievements'], queryFn: () => api.achievements(), staleTime: 60e3 });

  const items = data?.items || [];
  const earned = data?.earned_count ?? items.filter((i) => i.earned).length;
  const total = data?.total ?? items.length;
  const pct = total ? Math.round((earned / total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Award className="text-brand-green" />
        <h1 className="text-xl font-black">دستاوردها</h1>
        {!isLoading && <span className="text-xs text-text-muted">({Number(earned).toLocaleString('fa-IR')} از {Number(total).toLocaleString('fa-IR')} نشان)</span>}
        <GuideButton guideKey="achievements" auto className="ms-auto" />
      </div>

      {!isLoading && total > 0 && (
        <div className="card p-4 mb-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-bold text-text-primary">پیشرفت نشان‌ها</span>
            <span className="text-brand-green font-black">{Number(pct).toLocaleString('fa-IR')}٪</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-elevated overflow-hidden">
            <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-text-muted text-center py-10 text-sm">در حال بارگذاری…</p>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center">
          <Award size={36} className="text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm">هنوز نشانی تعریف نشده است.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((b) => (
            <div key={b.badge}
              className={`card p-4 flex flex-col items-center text-center relative overflow-hidden ${b.earned ? 'border-brand-green/30 bg-brand-green/[0.06]' : 'opacity-70'}`}>
              {b.earned ? (
                <CheckCircle2 size={16} className="absolute top-2 left-2 text-brand-green" />
              ) : (
                <Lock size={14} className="absolute top-2 left-2 text-text-muted" />
              )}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${b.earned ? 'bg-brand-green/15 text-brand-green' : 'bg-surface-elevated text-text-muted'}`}>
                <BadgeIcon icon={b.icon} earned={b.earned} />
              </div>
              <div className={`text-sm font-bold ${b.earned ? 'text-text-primary' : 'text-text-secondary'}`}>{b.title}</div>
              {b.desc && <div className="text-[11px] text-text-muted leading-5 mt-1">{b.desc}</div>}
              {b.earned ? (
                b.earned_at && <div className="text-[10px] text-brand-green/80 mt-2">{faDate(b.earned_at)}</div>
              ) : (
                <div className="text-[10px] text-text-muted mt-2">قفل‌شده</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
