import { GraduationCap, Sparkles, CandlestickChart, ShieldCheck, BadgeCheck } from 'lucide-react';

const HIGHLIGHTS = [
  { Icon: GraduationCap, t: '۱۶۰ درس در ۴ سطح', s: 'از صفر تا حرفه‌ای' },
  { Icon: Sparkles, t: 'مربیِ هوشِ مصنوعی', s: 'آموزشِ شخصی‌سازی‌شده' },
  { Icon: CandlestickChart, t: 'بازارنما — چارتِ حرفه‌ای', s: 'تحلیل و تمرینِ زنده' },
  { Icon: BadgeCheck, t: 'گواهی‌نامهٔ معتبر', s: 'حساب مجازی و فاندد' },
];

/** پوستهٔ برندِ مشترکِ ورود/ثبت‌نام — هیروِ سمتِ راست + کارتِ فرمِ سمتِ چپ (سطحِ جهانی). */
export default function AuthShell({ children, badge }) {
  return (
    <div dir="rtl" className="min-h-screen flex bg-[#070b12] text-text-primary relative overflow-hidden">
      {/* بلابِ گرادیانِ برند */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-emerald-500/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 w-[26rem] h-[26rem] rounded-full bg-teal-400/10 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/3 -left-32 w-80 h-80 rounded-full bg-sky-500/10 blur-[90px]" />

      {/* هیروِ برند (دسکتاپ) */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] p-12 relative">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="CoinePro Academy" className="h-14 w-auto" />
          <div>
            <div className="text-lg font-black leading-tight">آکادمیِ کوین پرو <span className="text-emerald-400">FX</span></div>
            <div className="text-xs text-text-muted">مدرسهٔ جامعِ فارکسِ فارسی</div>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-black leading-[1.6] mb-4">
            فارکس را <span className="text-emerald-400">اصولی</span> و <span className="text-teal-300">حرفه‌ای</span> یاد بگیر،
            نه با ویدیوهای پراکنده.
          </h2>
          <p className="text-text-secondary text-sm leading-7 max-w-md mb-8">
            یک مسیرِ یادگیریِ کامل، مربیِ هوشِ مصنوعی، چارتِ حرفه‌ای و تمرینِ بدونِ ریسک — همه در یک‌جا.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {HIGHLIGHTS.map(({ Icon, t, s }) => (
              <div key={t} className="flex items-start gap-2.5 rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0"><Icon size={18} className="text-emerald-400" /></div>
                <div><div className="text-sm font-bold leading-tight">{t}</div><div className="text-[11px] text-text-muted mt-0.5">{s}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-muted">
          <ShieldCheck size={15} className="text-emerald-400" /> پرداختِ امن · پشتیبانیِ اختصاصی · به‌روزرسانیِ مادام‌العمر
        </div>
      </div>

      {/* کارتِ فرم */}
      <div className="flex-1 flex items-center justify-center p-5 relative z-10">
        <div className="w-full max-w-md">
          {/* لوگوی موبایل */}
          <div className="lg:hidden text-center mb-5">
            <img src="/logo.png" alt="CoinePro Academy" className="h-24 w-auto mx-auto" />
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 sm:p-8 shadow-2xl">
            {badge && <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 rounded-full px-3 py-1 mb-4">{badge}</div>}
            {children}
          </div>
          <p className="text-center text-[11px] text-text-muted mt-4">© کوین پرو FX — آکادمیِ تخصصیِ فارکس</p>
        </div>
      </div>
    </div>
  );
}
