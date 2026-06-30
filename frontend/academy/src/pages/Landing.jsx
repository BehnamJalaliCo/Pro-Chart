import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Crown, Sparkles, GraduationCap, Bot, ShieldCheck, Star, Send } from 'lucide-react';
import { api } from '../api/client';

const SUPPORT_URL = 'https://t.me/CoinePro_Admin';

const STYLE = {
  free: { ring: '', badge: '', accent: 'text-text-secondary', btn: 'btn-ghost', icon: GraduationCap, iconBg: 'bg-surface-card text-text-secondary' },
  vip: { ring: 'ring-2 ring-brand-green shadow-lg shadow-brand-green/10', badge: 'محبوب‌ترین', accent: 'text-brand-green', btn: 'btn-success', icon: Crown, iconBg: 'bg-amber-500/15 text-amber-400' },
  premium: { ring: 'ring-2 ring-fuchsia-500/60 shadow-lg shadow-fuchsia-500/10', badge: 'حرفه‌ای', accent: 'text-fuchsia-400', btn: 'btn-success', icon: Sparkles, iconBg: 'bg-fuchsia-500/15 text-fuchsia-400' },
};

export default function Landing() {
  const { data } = useQuery({ queryKey: ['pricing'], queryFn: () => api.pricing() });
  const tiers = data?.tiers || [];

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      {/* هدر */}
      <header className="border-b border-surface-border/60 backdrop-blur sticky top-0 z-10 bg-surface/80">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="CoinePro Academy" className="h-16 w-auto" />
          <Link to="/login" className="text-sm font-bold text-brand-green hover:opacity-80">ورود</Link>
        </div>
      </header>

      {/* هیرو */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-green/10 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto px-4 pt-14 pb-10 text-center relative">
          <img src="/logo.png" alt="CoinePro Academy" className="h-40 w-auto mx-auto mb-6" />
          <div className="inline-flex items-center gap-1.5 text-xs font-bold bg-brand-green/10 text-brand-green rounded-full px-3 py-1 mb-5">
            <Bot size={14} /> آموزش + مربیِ هوش‌مصنوعیِ شخصی
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-4 leading-tight">
            معامله‌گریِ فارکس را <span className="text-brand-green">حرفه‌ای</span> یاد بگیر
          </h1>
          <p className="text-text-secondary leading-8 max-w-2xl mx-auto text-sm md:text-base">
            دوره‌های گام‌به‌گام به‌همراه یک مربیِ هوش‌مصنوعی که ۲۴ساعته به زبانِ خودت پاسخ می‌دهد،
            مفاهیم را ساده می‌کند و معاملاتت را نقد می‌کند.
          </p>
          <div className="flex items-center justify-center gap-5 mt-6 text-xs text-text-muted">
            <span className="flex items-center gap-1"><Star size={14} className="text-amber-400" /> ۱۲۰+ درسِ ساختاریافته</span>
            <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-brand-green" /> پرداختِ امن کریپتو</span>
          </div>
        </div>
      </section>

      {/* پلن‌ها */}
      <section className="max-w-5xl mx-auto px-4 pb-8">
        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          {tiers.map((t) => {
            const s = STYLE[t.key] || STYLE.free;
            const Icon = s.icon;
            return (
              <div key={t.key} className={`relative card p-6 flex flex-col rounded-2xl ${s.ring}`}>
                {s.badge && (
                  <span className={`absolute -top-3 right-5 text-[11px] font-black px-3 py-1 rounded-full ${t.key === 'vip' ? 'bg-brand-green text-black' : 'bg-fuchsia-500 text-white'}`}>
                    {s.badge}
                  </span>
                )}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${s.iconBg}`}><Icon size={22} /></div>
                <h3 className="font-black text-lg">{t.name}</h3>
                {t.tagline && <p className="text-xs text-text-muted mb-3">{t.tagline}</p>}

                <div className="mb-5">
                  {t.price_monthly === 0
                    ? <span className="text-3xl font-black">رایگان</span>
                    : <><span className="text-3xl font-black">{t.price_monthly}</span><span className="text-sm text-text-muted"> USDT / ماه</span></>}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {t.perks.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary leading-6">
                      <Check size={16} className={`mt-0.5 shrink-0 ${s.accent}`} /> {p}
                    </li>
                  ))}
                </ul>

                <Link to={t.key === 'free' ? '/register' : '/login'} className={`${s.btn} text-center w-full`}>
                  {t.key === 'free' ? 'شروعِ رایگان' : 'تهیهٔ اشتراک'}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* پرداخت */}
      {data?.wallet && (
        <section className="max-w-3xl mx-auto px-4 pb-14">
          <div className="card p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-2 font-bold"><ShieldCheck size={18} className="text-brand-green" /> روشِ پرداخت</div>
            <p className="text-sm text-text-secondary leading-7">
              پرداخت فقط با <b className="text-text-primary">USDT</b> روی شبکهٔ <b className="text-text-primary">{data.network}</b> است.
              مبلغ را به آدرسِ زیر واریز کن، بعد <b className="text-text-primary">هشِ تراکنش (رسید)</b> را در پنل ثبت کن یا برای پشتیبانی بفرست؛ پس از تأییدِ ادمین، اشتراکت فعال می‌شود.
            </p>
            <div className="mt-3 font-mono text-xs bg-black/30 rounded-lg p-3 break-all select-all border border-surface-border">{data.wallet}</div>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <Link to="/subscribe" className="btn-success flex-1 flex items-center justify-center gap-2 text-sm">
                <Crown size={16} /> تهیهٔ اشتراک
              </Link>
              <a href={SUPPORT_URL} target="_blank" rel="noreferrer"
                 className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm">
                <Send size={16} /> ارسالِ رسید به پشتیبانی
              </a>
            </div>
            <p className="text-[11px] text-text-muted mt-2">بعد از پرداخت، رسید/هشِ تراکنش را به پشتیبانی (CoinePro_Admin@) بفرست تا اشتراکت فعال شود.</p>
          </div>
        </section>
      )}

      <footer className="border-t border-surface-border/60 py-6 text-center text-xs text-text-muted">
        آکادمی VIP کوین‌پرو FX · آموزشِ تخصصیِ بازارهای مالی
      </footer>
    </div>
  );
}
