import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Clock, Rocket, ChevronLeft } from 'lucide-react';
import { userAPI } from '../api/client';
import { useAuth } from '../store';

export default function OnboardingChecklist() {
  const { profile } = useAuth();
  const { data: status } = useQuery({ queryKey: ['copyStatus'], queryFn: () => userAPI.copyStatus(), refetchInterval: 10000 });
  if (!profile) return null;

  const kyc = profile.kyc_status;
  const hasAccount = !!(profile.account || status?.account);
  const copyOn = !!status?.copy?.enabled;

  const steps = [
    { key: 'email', label: 'ثبت‌نام و تأییدِ ایمیل', done: !!profile.email_verified, to: '/profile', cta: 'تکمیل' },
    {
      key: 'kyc', label: 'احرازِ هویت (KYC)',
      done: kyc === 'approved', pending: kyc === 'pending',
      to: '/profile', cta: 'تکمیلِ احراز',
    },
    { key: 'account', label: 'اتصالِ حساب MT5', done: hasAccount, to: '/account', cta: 'اتصالِ حساب' },
    { key: 'copy', label: 'فعال‌سازیِ کپی‌ترید', done: copyOn, to: '/copy', cta: 'روشن کن' },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // همه کامل → پنهان

  const pct = Math.round((doneCount / steps.length) * 100);
  const next = steps.find((s) => !s.done);

  return (
    <div className="card p-5 border-brand-blue/30 bg-brand-blue/5">
      <div className="flex items-center gap-2 mb-1">
        <Rocket size={18} className="text-brand-blue" />
        <h3 className="font-bold text-text-primary">راه‌اندازیِ حساب</h3>
        <span className="ms-auto text-sm font-bold text-brand-blue">{doneCount.toLocaleString('fa-IR')} از {steps.length.toLocaleString('fa-IR')}</span>
      </div>
      <p className="text-xs text-text-muted mb-3">برای رسیدن به اولین معاملهٔ خودکار، این گام‌ها را کامل کن.</p>

      {/* نوارِ پیشرفت */}
      <div className="h-2 rounded-full bg-surface-elevated overflow-hidden mb-4">
        <div className="h-full bg-brand-blue transition-all duration-700 rounded-full" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-2">
        {steps.map((s, i) => {
          const Icon = s.done ? CheckCircle2 : s.pending ? Clock : Circle;
          const color = s.done ? 'text-brand-green' : s.pending ? 'text-brand-amber' : 'text-text-muted';
          const isNext = next?.key === s.key;
          return (
            <div key={s.key} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isNext ? 'bg-brand-blue/10 border border-brand-blue/30' : ''}`}>
              <Icon size={20} className={`${color} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${s.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                  <span className="text-text-muted">{(i + 1).toLocaleString('fa-IR')}.</span> {s.label}
                </div>
                {s.pending && <div className="text-[11px] text-brand-amber">در انتظارِ تأییدِ مدیریت</div>}
              </div>
              {!s.done && !s.pending && (
                <Link to={s.to} className={`shrink-0 flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg ${isNext ? 'bg-brand-blue text-white' : 'border border-surface-border text-text-secondary'}`}>
                  {s.cta} <ChevronLeft size={14} />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
