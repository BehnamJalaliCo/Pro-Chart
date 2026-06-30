import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { signalsAPI } from '../api/client';
import useSeo from '../hooks/useSeo';
import { APP_CONFIG } from '../utils/constants';

/* ─── آنچه بهنام جلالی ساخته است (همه به‌دستِ یک نفر) ─── */
const built = [
  {
    name: 'موتور سیگنال چندعاملی',
    description: 'طراحی و پیاده‌سازی کاملِ موتور تولید سیگنال با ترکیب تحلیل تکنیکال، پرایس‌اکشن، اسمارت‌مانی، پروفایل حجم و مولتی‌تایم‌فریم.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
  {
    name: 'مدل‌های هوش مصنوعی',
    description: 'ساختِ خط لولهٔ یادگیری ماشین (XGBoost، LightGBM، LSTM، Ensemble) با مهندسی ویژگی، کالیبراسیون و تشخیص دریفت برای پیش‌بینی بازار.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    name: 'مدیریت ریسک پیشرفته',
    description: 'پیاده‌سازی سیستمِ کنترل ریسک: حد ضرر مبتنی بر نوسان (ATR)، محدودیت زیان روزانه، فیلتر همبستگی، تشخیص رژیم بازار و سایزینگ پوزیشن.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    name: 'ربات تلگرام',
    description: 'توسعهٔ کامل ربات هوشمند تلگرام: ثبت‌نام، آزمون سطح‌سنجی، اشتراک، انتشار سیگنال‌ها، آکادمی آموزشی و دستیار هوش مصنوعی بازار.',
    icon: (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    name: 'وب‌سایت و پنل مدیریت',
    description: 'طراحی و کدنویسیِ کاملِ وب‌سایت عمومی و پنل ادمین با React، به‌همراه API و زیرساخت بک‌اند (FastAPI، TimescaleDB، Redis، Celery).',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    name: 'آکادمی آموزشی',
    description: 'تألیف و تولیدِ دورهٔ ۱۲۰ درسیِ فارکس در سه مرحله، به‌همراه موتورِ ساختِ دیاگرام‌های آموزشی — همگی تألیفِ شخصیِ بهنام جلالی.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
      </svg>
    ),
  },
];

export default function AboutPage() {
  useSeo({
    title: 'درباره ما — ساخته‌شده توسط بهنام جلالی',
    description: 'کوین پرو FX از صفر تا صد — موتور سیگنال، هوش مصنوعی، ربات، وب‌سایت و آکادمی — توسط بهنام جلالی طراحی، توسعه و راهبری شده است.',
    path: '/about',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        name: 'بهنام جلالی',
        url: 'https://fx.trade-future.ir/about',
        jobTitle: 'بنیان‌گذار و تحلیلگر ارشد بازار فارکس',
        description: 'بنیان‌گذار کوین پرو FX؛ توسعه‌دهندهٔ موتور سیگنال، هوش مصنوعی، ربات، وب‌سایت و آکادمی آموزش فارکس.',
        image: 'https://fx.trade-future.ir/behnam-jalali.jpg',
        knowsAbout: ['فارکس', 'تحلیل تکنیکال', 'پرایس اکشن', 'مدیریت سرمایه', 'معاملات طلا'],
        worksFor: { '@type': 'Organization', name: 'کوین پرو FX' },
      },
    },
  });
  const { data: stats } = useQuery({
    queryKey: ['aboutStats'],
    queryFn: signalsAPI.getStats,
    refetchInterval: 120000,
  });
  const fa = (n, d = 0) => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: d });

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-3xl lg:text-5xl font-black text-white mb-4">درباره کوین پرو FX</h1>
          <p className="text-dark-300 text-lg lg:text-xl max-w-3xl mx-auto leading-8">
            کوین پرو FX یک پلتفرم حرفه‌ای سیگنال‌دهی فارکس است که از صفر تا صد — از موتور تحلیل و هوش مصنوعی
            تا ربات، وب‌سایت و آموزش — به‌دستِ یک نفر طراحی، توسعه و راهبری شده است.
          </p>
        </motion.div>

        {/* Founder / Owner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-8 lg:p-12 mb-16 gradient-border"
        >
          <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="shrink-0 w-32 h-32 lg:w-40 lg:h-40 rounded-3xl overflow-hidden ring-2 ring-accent/40 shadow-lg shadow-accent/10">
              <img
                src="/behnam-jalali-v2.jpg"
                alt="بهنام جلالی — بنیان‌گذار کوین پرو FX"
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center lg:text-right flex-1">
              <span className="inline-block bg-accent/10 border border-accent/20 text-accent text-xs font-medium rounded-full px-3 py-1 mb-3">
                بنیان‌گذار، مالک و توسعه‌دهندهٔ کلِ پروژه
              </span>
              <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">بهنام جلالی</h2>
              <p className="text-dark-300 leading-8 mb-4">
                تمام بخش‌های کوین پرو FX — موتور سیگنال چندعاملی، مدل‌های هوش مصنوعی، سیستم مدیریت ریسک،
                بک‌اند و دیتابیس، ربات تلگرام، وب‌سایت، پنل مدیریت و دورهٔ آموزشیِ ۱۲۰ درسی — به‌صورتِ کامل و
                مستقل توسطِ <span className="text-white font-bold">بهنام جلالی</span> نوشته، ساخته و پرداخته شده است.
                او همه‌کارهٔ پروژه است؛ از معماری و کدنویسی تا تحلیل بازار، تولید محتوای آموزشی و پشتیبانی.
              </p>
              <p className="text-dark-400 leading-8">
                این پروژه حاصلِ تعهد به ساختنِ ابزاری شفاف، دقیق و حرفه‌ای برای معامله‌گران فارسی‌زبان است —
                جایی که هر عدد و آماری واقعی و قابل‌راستی‌آزمایی باشد.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Mission */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-8 lg:p-12 mb-16 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-white mb-4">مأموریت ما</h2>
          <p className="text-dark-300 text-lg leading-8 max-w-2xl mx-auto">
            دسترس‌پذیر کردنِ تحلیل‌های حرفه‌ای بازار فارکس برای همه. ما باور داریم هر معامله‌گر —
            فارغ از سطح تجربه و سرمایه — حق دارد به ابزارها و تحلیل‌های دقیق و شفاف دسترسی داشته باشد.
          </p>
        </motion.div>

        {/* What was built */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">آنچه ساخته شده است</h2>
            <p className="text-dark-400">یک پلتفرمِ کامل، تماماً به‌دستِ بهنام جلالی</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {built.map((item, index) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="glass-card p-6 hover:border-accent/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-4">
                  {item.icon}
                </div>
                <h3 className="text-white font-bold mb-2">{item.name}</h3>
                <p className="text-dark-400 text-sm leading-7">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Real Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            { value: fa(stats?.total_signals), label: 'سیگنال ارسال‌شده' },
            { value: `٪${fa(stats?.win_rate, 1)}`, label: 'نرخ موفقیت' },
            { value: fa(stats?.symbols_covered), label: 'نماد تحت پوشش' },
            { value: fa(stats?.active), label: 'سیگنال فعال' },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-6 text-center">
              <div className="text-2xl lg:text-3xl font-black text-accent mb-2">{stat.value}</div>
              <div className="text-dark-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
