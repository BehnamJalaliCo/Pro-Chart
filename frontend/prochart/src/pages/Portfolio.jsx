import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Award, BookOpenCheck, ShieldCheck, GraduationCap } from 'lucide-react';
import { api } from '../api/client';

export default function Portfolio() {
  const { username } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['portfolio', username],
    queryFn: () => api.portfolio(username),
    retry: false,
  });

  if (isLoading) return <Shell><p className="text-text-secondary text-center py-10">در حال بارگذاری…</p></Shell>;
  if (error) return <Shell><p className="text-text-secondary text-center py-10">این پورتفولیو یافت نشد.</p></Shell>;

  const pct = data.total ? Math.round((100 * data.completed) / data.total) : 0;

  return (
    <Shell>
      <div className="card p-6 text-center mb-5">
        <div className="w-20 h-20 rounded-full bg-brand-green/15 flex items-center justify-center mx-auto mb-3">
          <GraduationCap size={38} className="text-brand-green" />
        </div>
        <h1 className="text-xl font-black">{data.name}</h1>
        <p className="text-xs text-text-muted mt-1" dir="ltr">@{data.username}</p>
        <div className="mt-4 max-w-xs mx-auto">
          <div className="flex justify-between text-xs mb-1"><span className="text-text-muted">پیشرفتِ یادگیری</span><span className="font-black text-brand-green">{pct}٪</span></div>
          <div className="w-full h-2.5 bg-surface-border rounded-full overflow-hidden"><div className="h-full bg-brand-green rounded-full" style={{ width: `${pct}%` }} /></div>
          <p className="text-[11px] text-text-muted mt-1">{data.completed} از {data.total} درس</p>
        </div>
      </div>

      {data.masteries?.length > 0 && (
        <div className="mb-5">
          <div className="font-bold text-sm mb-2 flex items-center gap-1.5"><ShieldCheck size={16} className="text-brand-green" /> سطوحِ تسلط‌یافته</div>
          <div className="flex flex-wrap gap-2">
            {data.masteries.map((m) => <span key={m} className="text-xs bg-brand-green/15 text-brand-green rounded-full px-3 py-1.5 font-bold">{m}</span>)}
          </div>
        </div>
      )}

      <div className="font-bold text-sm mb-2 flex items-center gap-1.5"><Award size={16} className="text-amber-400" /> گواهی‌نامه‌ها</div>
      {data.certificates?.length > 0 ? (
        <div className="space-y-2">
          {data.certificates.map((c) => (
            <div key={c.code} className="card p-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><BookOpenCheck size={16} className="text-brand-green" /><span className="text-sm font-bold">گواهیِ {c.level}</span></div>
              <span className="text-[11px] text-text-muted font-mono" dir="ltr">{c.code}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted">هنوز گواهی‌ای دریافت نشده.</p>
      )}

      <p className="text-center text-[11px] text-text-muted mt-8">
        صادرشده توسطِ <Link to="/" className="text-brand-green">CoinePro FX Academy</Link>
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-surface-bg text-text-primary px-4 py-8" dir="rtl">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="CoinePro FX Academy" className="h-16 mx-auto" />
        </div>
        {children}
      </div>
    </div>
  );
}
