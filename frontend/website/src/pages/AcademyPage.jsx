import { motion } from 'framer-motion';
import useSeo from '../hooks/useSeo';

const ACADEMY_URL = 'https://academy.fx.trade-future.ir';

const LEVELS = [
  { n: 'مقدماتی', d: 'از صفرِ مطلق: مفاهیم فارکس، جفت‌ارز، پیپ و اسپرد، پلتفرم معاملاتی', c: '۴۰ درس' },
  { n: 'متوسط', d: 'تحلیل تکنیکال، الگوهای کندلی، حمایت/مقاومت، اندیکاتورها', c: '۴۰ درس' },
  { n: 'پیشرفته', d: 'پرایس‌اکشن، اسمارت‌مانی، مولتی‌تایم‌فریم، مدیریت ریسک حرفه‌ای', c: '۴۰ درس' },
  { n: 'حرفه‌ای', d: 'استراتژی‌های نهادی، روان‌شناسی، ژورنال‌نویسی، معامله‌گری برای درآمد', c: '۴۰ درس' },
];

const FEATURES = [
  { icon: '🎬', t: '۱۶۰ ویدیوی تخصصی', d: 'آموزشِ تصویریِ گام‌به‌گام با صدای فارسی و کیفیت بالا' },
  { icon: '🤖', t: 'مربیِ هوشِ مصنوعی', d: 'پاسخ به هر سوالِ بازار و آموزش، اختصاصیِ تو، ۲۴ ساعته' },
  { icon: '📊', t: 'تمرینِ زنده + شبیه‌ساز', d: 'تمرینِ معامله روی دادهٔ واقعی بدون ریسکِ پول' },
  { icon: '📈', t: 'حسابِ مجازی و چارتِ AI', d: 'تحلیلِ خودکارِ نمودار + کشیدنِ ستاپ روی چارت' },
  { icon: '🏆', t: 'گواهیِ معتبر + پورتفولیو', d: 'مدرکِ قابل‌راستی‌آزمایی و صفحهٔ عمومیِ مهارت‌ها' },
  { icon: '🎯', t: 'بوت‌کمپ + چالشِ فاندد', d: 'مسیرِ زمان‌بندی‌شده تا آمادگیِ حسابِ سرمایه' },
];

function Cta({ big }) {
  return (
    <a href={ACADEMY_URL} target="_blank" rel="noopener"
      className={`inline-flex items-center justify-center gap-2 btn-primary ${big ? 'text-base px-8 py-4' : 'text-sm px-6 py-3'}`}>
      🚀 ورود به آکادمی VIP
    </a>
  );
}

export default function AcademyPage() {
  useSeo({
    title: 'آکادمی VIP فارکس — آموزش صفر تا حرفه‌ای با ۱۶۰ ویدیو و مربی هوش مصنوعی',
    description: 'آکادمی آنلاین فارکس کوین‌پرو: ۱۶۰ ویدیوی آموزشی فارسی در ۴ سطح (مقدماتی تا حرفه‌ای)، مربی هوش مصنوعی اختصاصی، شبیه‌ساز تمرین، حساب مجازی، گواهی معتبر و بوت‌کمپ. همین حالا رایگان شروع کن.',
    path: '/academy',
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Course',
      name: 'آکادمی VIP فارکس کوین‌پرو',
      description: 'دورهٔ جامع آموزش فارکس از صفر تا حرفه‌ای شامل ۱۶۰ ویدیو در ۴ سطح، مربی هوش مصنوعی، تمرین و گواهی.',
      provider: { '@type': 'Organization', name: 'CoinePro FX', sameAs: ACADEMY_URL },
      inLanguage: 'fa', educationalLevel: 'Beginner to Professional',
      offers: { '@type': 'Offer', category: 'Education', priceCurrency: 'USDT', availability: 'https://schema.org/InStock' },
    },
  });

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden py-16 lg:py-24">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
            <span className="inline-block text-xs font-bold text-accent bg-accent/10 rounded-full px-4 py-1.5 mb-5">دانشگاهِ عملیِ فارکس · فارسی</span>
            <h1 className="text-3xl lg:text-5xl font-black text-white leading-tight mb-5">
              از <span className="text-accent">صفر</span> تا <span className="text-bullish">معامله‌گرِ حرفه‌ای</span><br />با آکادمیِ VIP کوین‌پرو
            </h1>
            <p className="text-dark-300 text-lg max-w-2xl mx-auto leading-8 mb-8">
              ۱۶۰ ویدیوی تخصصی، مربیِ هوشِ مصنوعیِ اختصاصی، تمرینِ زنده روی دادهٔ واقعی، حسابِ مجازی، گواهیِ معتبر و بوت‌کمپ — همه در یک مسیرِ ساختاریافته و فارسی.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Cta big />
              <a href={ACADEMY_URL} target="_blank" rel="noopener" className="text-dark-300 hover:text-white text-sm underline underline-offset-4">academy.fx.trade-future.ir</a>
            </div>
            <p className="text-dark-500 text-xs mt-4">۵ درسِ نخستِ هر سطح رایگان است — همین حالا بدونِ هزینه شروع کن.</p>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 bg-dark-900/30">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl lg:text-3xl font-black text-white text-center mb-10">چرا آکادمیِ VIP کوین‌پرو؟</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.t} className="glass-card p-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-white font-bold text-lg mb-1">{f.t}</h3>
                <p className="text-dark-400 text-sm leading-7">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Levels */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl lg:text-3xl font-black text-white text-center mb-3">۴ سطح، ۱۶۰ درس، یک مسیرِ روشن</h2>
          <p className="text-dark-400 text-center mb-10">هر سطح بر پایهٔ سطحِ قبل ساخته شده تا گام‌به‌گام حرفه‌ای شوی.</p>
          <div className="grid sm:grid-cols-2 gap-5">
            {LEVELS.map((l, i) => (
              <div key={l.n} className="glass-card p-6 flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent font-black flex items-center justify-center shrink-0">{i + 1}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1"><h3 className="text-white font-bold text-lg">{l.n}</h3><span className="text-xs text-accent bg-accent/10 rounded-full px-2 py-0.5">{l.c}</span></div>
                  <p className="text-dark-400 text-sm leading-7">{l.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-gradient-to-b from-transparent to-accent/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl lg:text-4xl font-black text-white mb-4">امروز اولین قدمِ حرفه‌ای‌شدنت را بردار</h2>
          <p className="text-dark-300 text-lg mb-8 leading-8">ثبت‌نامِ رایگان با ایمیل، دسترسی به درس‌های رایگان، و ارتقا به VIP هر وقت خواستی. پرداخت فقط با USDT.</p>
          <Cta big />
        </div>
      </section>
    </div>
  );
}
