import { useState } from 'react';
import { motion } from 'framer-motion';
import { APP_CONFIG } from '../utils/constants';
import useSeo from '../hooks/useSeo';

const REF = APP_CONFIG.BROKER_REFERRAL_URL;

/* ─── دکمهٔ ثبت‌نام (رفرال) ─── */
function RegisterBtn({ className = '', children }) {
  return (
    <a
      href={REF}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn-primary inline-flex items-center justify-center gap-2 ${className}`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
      {children || 'ثبت‌نام در OneRoyal'}
    </a>
  );
}

function Section({ children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

const whyCards = [
  { icon: '🌐', t: 'پشتیبانیِ کاملِ فارسی', d: 'سایت و پشتیبانیِ فارسی‌زبانِ ۲۴ ساعته، مخصوصِ کاربرانِ ایرانی.' },
  { icon: '💳', t: 'واریز و برداشتِ ریالی', d: 'درگاهِ ریالی (سورینکس) + رمزارز USDT روی TRC20/ERC20، بدونِ کارمزد.' },
  { icon: '⚡', t: 'اهرم تا ۱:۱۰۰۰', d: 'اسپرد از ۰.۰ پیپ روی حساب‌های ECN؛ اجرای سریعِ سفارش‌ها.' },
  { icon: '🪙', t: 'حساب اسلامی (بدون سواپ)', d: 'مناسبِ معاملهٔ شرعی، بدونِ بهرهٔ شبانه.' },
  { icon: '🛡️', t: 'چند مجوزِ معتبر', d: 'تحتِ نظارتِ ASIC، CySEC، VFSC و FSA + عضوِ Financial Commission.' },
  { icon: '💻', t: 'پلتفرم‌های MT4/MT5', d: 'به‌همراه WebTrader، کپی‌تریدینگ و اپلیکیشن موبایل.' },
];

const accounts = [
  { name: 'Cent', dep: '۵ دلار', spread: 'متغیر', comm: '—', best: 'شروع با ریسکِ کم و سرمایهٔ خرد' },
  { name: 'Classic', dep: '۵۰ دلار', spread: 'از ۱.۴ پیپ', comm: 'بدون کمیسیون', best: 'معامله‌گرانِ عمومی' },
  { name: 'ECN', dep: '۵۰ دلار', spread: 'از ۰.۰ پیپ', comm: '~۷$ هر لات', best: 'اسکالپ و اسپردِ خام' },
  { name: 'VIP', dep: '۱۰٬۰۰۰ دلار', spread: 'از ۰.۴ پیپ', comm: 'کم', best: 'حجمِ بالا' },
  { name: 'ECN Elite', dep: '۱۰٬۰۰۰ دلار', spread: 'از ۰.۰ پیپ', comm: '~۳.۵$ هر لات', best: 'حرفه‌ای‌ها' },
  { name: 'اسلامی', dep: 'بسته به نوع', spread: '—', comm: 'بدون سواپ', best: 'معاملهٔ شرعی' },
];

const licenses = [
  ['ASIC استرالیا', '#420268'],
  ['CySEC قبرس', '#312/16'],
  ['VFSC وانواتو', '#700284'],
  ['FSA سنت‌وینسنت', '#149LLC2019'],
  ['Financial Commission', 'پوششِ اختلاف تا ۲۰٬۰۰۰ یورو'],
];

const steps = [
  ['ورود از لینکِ اختصاصیِ ما', 'روی دکمهٔ «ثبت‌نام در OneRoyal» بزنید تا با لینکِ رفرالِ ما وارد شوید و از پشتیبانیِ ویژهٔ ما بهره‌مند شوید.'],
  ['ساختِ حساب', 'ایمیل را وارد و کشور را «ایران» انتخاب کنید؛ کدِ تأیید به ایمیلتان می‌آید.'],
  ['تکمیلِ پروفایل', 'نام، تاریخ تولد، ملیت و چند سؤالِ مالیِ ساده (طبقِ قوانینِ بین‌المللی) را پر کنید.'],
  ['احراز هویت (KYC)', 'یک مدرکِ شناساییِ معتبر + یک سلفی آپلود کنید؛ معمولاً در چند دقیقه تأیید می‌شود.'],
  ['انتخابِ حساب و واریز', 'حسابِ مناسب (Cent/Classic/ECN) بسازید و با روشِ ریالی یا USDT شارژ کنید.'],
  ['دانلود و ورود به پلتفرم', 'MT4/MT5 یا اپ orTrader را نصب و با اطلاعاتِ حساب وارد شوید — آمادهٔ معامله‌اید!'],
];

const install = [
  {
    head: '🖥️ نصب روی کامپیوتر (ویندوز / مک)',
    items: [
      'وارد حسابِ کاربری (Cabinet) وان‌رویال شوید و از بخشِ Downloads، MetaTrader 4 یا 5 را دانلود کنید.',
      'فایلِ نصب را اجرا و مراحلِ Next را تا پایان طی کنید.',
      'پلتفرم را باز کنید → File → Login to Trade Account.',
      'شمارهٔ حساب، رمز و سِروِرِ اعلام‌شده در ایمیلِ ثبت‌نام را وارد کنید → Login.',
    ],
  },
  {
    head: '📱 نصب روی موبایل (iOS / Android)',
    items: [
      'از App Store یا Google Play، اپِ «MetaTrader 4» یا «MetaTrader 5» را نصب کنید.',
      'اپ را باز کنید → Login to existing account.',
      'نامِ کارگزار را جستجو کنید (OneRoyal) و سِروِرِ صحیح را انتخاب کنید.',
      'شمارهٔ حساب و رمز را وارد کنید → ورود. اعلان‌ها را برای آگاهی از سفارش‌ها فعال کنید.',
    ],
  },
  {
    head: '🌐 بدونِ نصب (WebTrader)',
    items: [
      'اگر نمی‌خواهید چیزی نصب کنید، از WebTraderِ وان‌رویال مستقیم در مرورگر معامله کنید.',
      'کافی است با اطلاعاتِ حساب در WebTrader وارد شوید — روی هر سیستم‌عاملی کار می‌کند.',
    ],
  },
];

const funding = [
  ['💰 ریالی (درگاهِ سورینکس)', 'سریع‌ترین راه برای کاربرانِ داخلِ ایران؛ معمولاً آنی.'],
  ['🪙 رمزارز (USDT)', 'روی شبکه‌های TRC20 و ERC20 — کم‌هزینه و سریع.'],
  ['💳 کارت/Skrill/Neteller/انتقال بانکی', 'برای کاربرانِ خارج از ایران.'],
];

const faqs = [
  ['آیا واریز و برداشت کارمزد دارد؟', 'خیر، OneRoyal برای واریز و برداشت کارمزدی نمی‌گیرد. توصیه می‌شود اولین بار یک واریز/برداشتِ آزمایشیِ کوچک انجام دهید.'],
  ['حداقل سرمایه برای شروع چقدر است؟', 'با حسابِ Cent تنها با ۵ دلار می‌توانید شروع کنید؛ حسابِ Classic/ECN از ۵۰ دلار.'],
  ['آیا حساب اسلامی (بدون سواپ) دارد؟', 'بله، حسابِ اسلامی بدونِ بهرهٔ شبانه برای معاملهٔ شرعی موجود است.'],
  ['از چه پلتفرم‌هایی پشتیبانی می‌کند؟', 'MetaTrader 4 و 5 (دسکتاپ/موبایل)، WebTrader مرورگری، اپ orTrader و کپی‌تریدینگ. در حالِ حاضر cTrader ارائه نمی‌شود.'],
  ['آیا معتبر است؟', 'بله؛ سابقهٔ ~۲۰ ساله، چند مجوزِ معتبر (ASIC/CySEC/VFSC/FSA) و عضویت در Financial Commission. امتیازِ ~۴.۴ از ۵ در Trustpilot.'],
];

export default function BrokerPage() {
  useSeo({
    title: 'بروکر OneRoyal (وان رویال) — معرفی، ثبت‌نام و آموزش نصب',
    description: 'راهنمای کاملِ بروکر OneRoyal برای کاربران ایرانی: مجوزها، انواع حساب، واریز و برداشت ریالی، آموزش گام‌به‌گام ثبت‌نام و نصب MT4/MT5، و لینک ثبت‌نام اختصاصی کوین پرو FX.',
    path: '/broker',
  });
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen">
      {/* ══ Hero ══ */}
      <section className="relative overflow-hidden bg-grid">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-bullish/10 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-bullish animate-pulse" />
            <span className="text-accent text-sm font-medium">بروکرِ پیشنهادیِ کوین پرو FX</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white mb-4">
            بروکر <span className="gradient-text">OneRoyal</span>
          </h1>
          <p className="text-dark-300 text-lg lg:text-xl leading-9 max-w-3xl mx-auto mb-8">
            کارگزاریِ بین‌المللی با سابقهٔ <b className="text-white">~۲۰ سال (از ۲۰۰۶)</b>، چند مجوزِ معتبر،
            <b className="text-white"> پشتیبانیِ کاملِ فارسی</b> و واریز/برداشتِ ریالی — انتخابِ مطمئن برای
            معامله‌گرانِ ایرانی. با لینکِ اختصاصیِ ما ثبت‌نام کنید و از پشتیبانیِ ویژه بهره‌مند شوید.
          </p>
          <div className="flex items-center justify-center">
            <RegisterBtn className="text-base py-4 px-10" />
          </div>
          {/* Trust stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 max-w-3xl mx-auto">
            {[['~۲۰', 'سال سابقه'], ['۱:۱۰۰۰', 'حداکثر اهرم'], ['۲۰۰۰+', 'نماد معاملاتی'], ['۴.۴/۵', 'امتیاز Trustpilot']].map(([v, l]) => (
              <div key={l} className="glass-card p-4">
                <div className="text-2xl lg:text-3xl font-black text-white">{v}</div>
                <div className="text-dark-400 text-sm mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 space-y-20">
        {/* ══ چرا OneRoyal ══ */}
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">چرا OneRoyal برای کاربرانِ ایرانی؟</h2>
            <p className="text-dark-400">مزیت‌هایی که این بروکر را برای ما متفاوت می‌کند</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyCards.map((c) => (
              <div key={c.t} className="glass-card p-6 hover:border-accent/30 transition-all">
                <div className="text-3xl mb-3">{c.icon}</div>
                <h3 className="text-white font-bold mb-2">{c.t}</h3>
                <p className="text-dark-400 text-sm leading-7">{c.d}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ══ مجوزها ══ */}
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">مجوزها و اعتبار</h2>
            <p className="text-dark-400">تحتِ نظارتِ نهادهای مالیِ معتبرِ بین‌المللی</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {licenses.map(([n, code]) => (
              <div key={n} className="glass-card p-5 text-center">
                <div className="w-10 h-10 rounded-xl bg-bullish/10 text-bullish flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.96 11.96 0 013.6 6 12 12 0 003 9.75c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.31-.21-2.57-.6-3.75h-.15c-3.2 0-6.1-1.25-8.25-3.29z" />
                  </svg>
                </div>
                <div className="text-white font-bold text-sm">{n}</div>
                <div className="text-dark-500 text-xs mt-1">{code}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ══ انواع حساب ══ */}
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">انواع حساب</h2>
            <p className="text-dark-400">برای هر سطحِ سرمایه و سبکِ معاملاتی</p>
          </div>
          <div className="glass-card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-800 text-dark-400">
                  <th className="text-right py-4 px-4">حساب</th>
                  <th className="text-right py-4 px-3">حداقل واریز</th>
                  <th className="text-right py-4 px-3">اسپرد</th>
                  <th className="text-right py-4 px-3">کمیسیون</th>
                  <th className="text-right py-4 px-3">مناسبِ</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.name} className="border-b border-dark-800/50 hover:bg-dark-800/30">
                    <td className="py-3 px-4 text-white font-bold">{a.name}</td>
                    <td className="py-3 px-3 text-dark-200">{a.dep}</td>
                    <td className="py-3 px-3 text-bullish">{a.spread}</td>
                    <td className="py-3 px-3 text-dark-300">{a.comm}</td>
                    <td className="py-3 px-3 text-dark-400">{a.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ══ پلتفرم‌ها + آموزش نصب ══ */}
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">پلتفرم‌ها و آموزش نصب</h2>
            <p className="text-dark-400">MetaTrader 4/5، WebTrader و اپلیکیشن — گام‌به‌گام</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {install.map((blk) => (
              <div key={blk.head} className="glass-card p-6">
                <h3 className="text-white font-bold mb-4">{blk.head}</h3>
                <ol className="space-y-3">
                  {blk.items.map((it, i) => (
                    <li key={i} className="flex gap-3 text-sm text-dark-300 leading-7">
                      <span className="shrink-0 w-6 h-6 rounded-lg bg-accent/15 text-accent flex items-center justify-center text-xs font-bold">
                        {(i + 1).toLocaleString('fa-IR')}
                      </span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Section>

        {/* ══ واریز و برداشت ══ */}
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">واریز و برداشت</h2>
            <p className="text-dark-400">روش‌های راحت برای کاربرانِ ایرانی — بدونِ کارمزد</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {funding.map(([t, d]) => (
              <div key={t} className="glass-card p-6">
                <h3 className="text-white font-bold mb-2">{t}</h3>
                <p className="text-dark-400 text-sm leading-7">{d}</p>
              </div>
            ))}
          </div>
          <p className="text-dark-500 text-sm text-center mt-6">
            ⏱️ واریزها معمولاً آنی تا چند دقیقه؛ برداشت‌ها اغلب در همان روزِ کاری پردازش می‌شوند.
          </p>
        </Section>

        {/* ══ راهنمای ثبت‌نام ══ */}
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">راهنمای گام‌به‌گامِ ثبت‌نام</h2>
            <p className="text-dark-400">از صفر تا شروعِ معامله، در ۶ گام</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map(([t, d], i) => (
              <div key={t} className="glass-card p-5 flex gap-4">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-bullish text-white flex items-center justify-center font-black">
                  {(i + 1).toLocaleString('fa-IR')}
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">{t}</h3>
                  <p className="text-dark-400 text-sm leading-7">{d}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <RegisterBtn className="text-base py-4 px-10" >همین حالا ثبت‌نام کنید</RegisterBtn>
          </div>
        </Section>

        {/* ══ FAQ ══ */}
        <Section>
          <div className="text-center mb-10">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">سوالات متداول</h2>
          </div>
          <div className="max-w-3xl mx-auto space-y-3">
            {faqs.map(([q, a], i) => (
              <div key={i} className="glass-card overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-dark-800/30 transition-colors"
                >
                  <span className="text-white font-medium text-sm lg:text-base">{q}</span>
                  <svg className={`w-5 h-5 text-accent shrink-0 mr-4 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <p className="px-6 pb-4 text-dark-400 text-sm leading-7">{a}</p>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ══ CTA نهایی ══ */}
        <Section>
          <div className="relative glass-card p-8 lg:p-14 text-center overflow-hidden gradient-border">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-bullish/5" />
            <div className="relative">
              <h2 className="text-2xl lg:text-4xl font-black text-white mb-4">آمادهٔ شروعِ معامله‌اید؟</h2>
              <p className="text-dark-300 text-lg mb-8 max-w-2xl mx-auto leading-8">
                با لینکِ اختصاصیِ کوین پرو FX در OneRoyal ثبت‌نام کنید، حساب بسازید و در کنارِ
                سیگنال‌ها و آموزش‌های ما، حرفه‌ای معامله کنید.
              </p>
              <RegisterBtn className="text-lg py-4 px-12" />
            </div>
          </div>
        </Section>

        {/* ══ ریسک ══ */}
        <div className="bg-dark-900/40 rounded-2xl p-5">
          <p className="text-dark-500 text-xs leading-6 text-center max-w-3xl mx-auto">
            <span className="text-dark-400 font-medium">هشدار ریسک:</span>{' '}
            معاملهٔ فارکس و CFD ریسکِ بالایی دارد و ممکن است بخشی یا تمامِ سرمایه‌تان را از دست بدهید.
            هیچ بروکری بی‌نقص نیست؛ پیش از معامله قوانینِ کارگزاری (به‌ویژه دربارهٔ اسکالپ/ربات) را بخوانید،
            مدیریتِ ریسک را رعایت کنید و فقط با سرمایه‌ای وارد شوید که توانِ از دست دادنش را دارید. اطلاعاتِ
            این صفحه جنبهٔ معرفی دارد و توصیهٔ سرمایه‌گذاری نیست.
          </p>
        </div>
      </div>
    </div>
  );
}
