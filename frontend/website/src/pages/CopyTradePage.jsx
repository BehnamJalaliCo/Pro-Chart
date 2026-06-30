import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { APP_CONFIG } from '../utils/constants';

/* ───────────────────────── کمک‌کامپوننت‌ها ───────────────────────── */

// ظاهرشدنِ نرم هنگامِ اسکرول
function Reveal({ children, delay = 0, y = 28, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// شمارندهٔ انیمیشنی برای آمار
function Counter({ to, suffix = '', decimals = 0, duration = 1800 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return (
    <span ref={ref}>
      {val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ───────────────────────── داده‌ها ───────────────────────── */

const STEPS = [
  { n: '۱', icon: '🔗', title: 'حسابت را لینک کن', desc: 'فقط شمارهٔ حسابِ متاتریدرِ بروکرت را در پنل وارد می‌کنی. هیچ نرم‌افزاری نصب نمی‌کنی، لپ‌تاپت لازم نیست همیشه روشن باشد.' },
  { n: '۲', icon: '🤖', title: 'ربات کپی می‌کند', desc: 'هر سیگنالِ تیمِ حرفه‌ایِ ما، لحظه‌ای و خودکار روی حسابِ خودت اجرا می‌شود — با حجمِ متناسبِ سرمایه‌ات و مدیریتِ ریسکِ کامل.' },
  { n: '۳', icon: '📈', title: 'سود را تماشا کن', desc: 'حد ضرر، حد سود، بریک‌ایون و تریلینگ‌استاپ خودکار مدیریت می‌شوند. تو فقط رشدِ حسابت را در پنل می‌بینی.' },
];

const FEATURES = [
  { icon: '⚡', title: 'اجرای لحظه‌ای و خودکار', desc: 'سرورهای اختصاصیِ ما ۲۴ ساعته روشن‌اند؛ معاملات در میلی‌ثانیه روی حسابت باز می‌شوند — حتی وقتی خوابی.' },
  { icon: '🛡️', title: 'مدیریت ریسکِ حرفه‌ای', desc: 'بریک‌ایونِ خودکار پس از سود، تریلینگ‌استاپ، سقفِ ضررِ روزانه و سایزِ پوزیشن بر اساسِ سرمایه — مثلِ یک صندوقِ حرفه‌ای.' },
  { icon: '🧠', title: 'بدونِ نیاز به تجربه', desc: 'لازم نیست تحلیل بلد باشی یا پای چارت بنشینی. مغزِ معاملاتیِ ما کار می‌کند، تو فقط نتیجه را می‌گیری.' },
  { icon: '🔓', title: 'پولت دستِ خودت', desc: 'حساب در بروکرِ خودت می‌ماند؛ ما فقط معامله می‌کنیم. هر لحظه می‌توانی کپی را خاموش کنی یا خارج شوی.' },
  { icon: '🎯', title: 'سیگنالِ باکیفیت، نه پرتعداد', desc: 'فقط ستاپ‌هایی با ادجِ واقعی؛ هر سیگنال از چند لایه فیلتر و نظرِ دومِ هوش مصنوعی عبور می‌کند.' },
  { icon: '📊', title: 'شفافیتِ کامل', desc: 'هر معامله، هر سود و ضرر، در پنل و کانال زنده ثبت می‌شود. آماری که می‌بینی، واقعی است.' },
];

const STATS = [
  { to: 24, suffix: '/۷', label: 'اجرای بی‌وقفه (ساعته)' },
  { to: 2063, suffix: '+', label: 'نمادِ قابلِ معامله' },
  { to: 30, suffix: 'ثانیه', label: 'تأخیرِ کپی (حداکثر)' },
  { to: 0, suffix: '٪', label: 'دخالتِ دستیِ تو' },
];

// قیمتِ کپی‌ترید = اشتراکِ سیگنال + سرورِ اختصاصیِ کپی (۳۰$/ماه). سرور برای OneRoyal رایگان است.
const PLANS = [
  { name: 'تریال رایگان', price: '۰', period: '۴۸ ساعت', desc: 'فقط مشاهدهٔ سیگنال‌ها (بدونِ پنلِ کپی)', features: ['دسترسی به سیگنال‌ها در کانال', 'پیش از پرداخت، خودت بسنج', 'ارتقا به VIP هر لحظه'], cta: 'شروعِ رایگان', highlight: false },
  { name: 'ماهانه', price: '۹۰', period: 'دلار / ماه', desc: '۶۰ اشتراک + ۳۰ سرورِ کپی', features: ['کپی‌تریدِ کامل و خودکار', 'سرورِ اختصاصیِ ۲۴/۷', 'مدیریتِ ریسکِ کامل', 'پشتیبانیِ اختصاصی'], cta: 'فعال‌سازی VIP', highlight: false },
  { name: 'سه‌ماهه', price: '۲۳۰', period: 'دلار / ۳ ماه', desc: 'محبوب‌ترین — معادلِ ۷۷$/ماه (۱۵٪ کمتر)', features: ['همهٔ امکاناتِ ماهانه', 'سرورِ اختصاصیِ کپی', 'اولویتِ پشتیبانی', 'گزارشِ عملکردِ هفتگی'], cta: 'فعال‌سازی VIP', highlight: true },
  { name: 'شش‌ماهه', price: '۴۲۰', period: 'دلار / ۶ ماه', desc: 'بیشترین صرفه — معادلِ ۷۰$/ماه (۲۲٪ کمتر)', features: ['همهٔ امکاناتِ سه‌ماهه', 'پایین‌ترین هزینهٔ ماهانه', 'مشاورهٔ اختصاصی', 'دسترسیِ زودهنگام به امکانات'], cta: 'فعال‌سازی VIP', highlight: false },
];

const FAQ = [
  { q: 'کپی‌ترید یعنی چی و چطور کار می‌کند؟', a: 'یعنی معاملاتِ تیمِ حرفه‌ایِ ما به‌صورتِ خودکار و لحظه‌ای روی حسابِ خودت کپی می‌شود. تو فقط حسابت را لینک می‌کنی؛ بقیه‌اش با ربات است.' },
  { q: 'آیا پولم را به شما می‌دهم؟', a: 'هرگز. حساب در بروکرِ خودت و به نامِ خودت می‌ماند. ما فقط دسترسیِ معامله داریم، نه برداشت. هر لحظه می‌توانی قطع کنی.' },
  { q: 'لپ‌تاپم باید روشن بماند؟', a: 'نه. همه‌چیز روی سرورهای اختصاصیِ ما اجرا می‌شود؛ حتی با گوشیِ خاموش هم معاملاتت باز و مدیریت می‌شوند.' },
  { q: 'تجربه‌ای ندارم، می‌توانم استفاده کنم؟', a: 'دقیقاً برای همین ساخته شده. نیازی به دانشِ تحلیل نداری — سیستم همه‌چیز را خودکار مدیریت می‌کند.' },
  { q: 'ریسک چطور کنترل می‌شود؟', a: 'بریک‌ایونِ خودکار، تریلینگ‌استاپ، حد ضرر و سقفِ ضررِ روزانه روی هر معامله اعمال می‌شود و حجم بر اساسِ سرمایه‌ات تنظیم می‌گردد.' },
];

/* ───────────────────────── صفحه ───────────────────────── */

export default function CopyTradePage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const yBlob = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => { document.title = 'کپی‌ترید VIP | CoinePro FX'; }, []);

  return (
    <div className="overflow-hidden">
      {/* ═══ HERO ═══ */}
      <section ref={heroRef} className="relative min-h-[92vh] flex items-center bg-grid">
        {/* بلابِ نورانیِ متحرک */}
        <motion.div style={{ y: yBlob }} className="pointer-events-none absolute -top-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-bullish/20 blur-[120px] animate-pulse-slow" />
        <motion.div style={{ y: yBlob }} className="pointer-events-none absolute -bottom-40 -left-40 w-[34rem] h-[34rem] rounded-full bg-accent/20 blur-[120px] animate-pulse-slow" />

        <div className="container mx-auto px-4 relative z-10 text-center max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-bullish/10 border border-bullish/30 text-bullish text-sm font-bold mb-6">
            <span className="w-2 h-2 rounded-full bg-bullish animate-ping" /> قلبِ درآمدزاییِ هوشمند
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-7xl font-black text-white leading-[1.15] mb-6">
            بگذار ربات <span className="gradient-text">به‌جای تو</span> معامله کند
            <br />تو فقط <span className="gradient-text">سود</span> بگیر
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg sm:text-xl text-dark-300 max-w-2xl mx-auto mb-9 leading-relaxed">
            معاملاتِ تیمِ حرفه‌ایِ ما، <b className="text-white">لحظه‌ای و کاملاً خودکار</b> روی حسابِ خودت کپی می‌شود.
            بدونِ تجربه، بدونِ نصبِ نرم‌افزار، بدونِ نیاز به روشن‌ماندنِ لپ‌تاپ — ۲۴ ساعتِ شبانه‌روز.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={APP_CONFIG.BOT_URL} target="_blank" rel="noopener noreferrer"
              className="btn-primary text-base py-4 px-8 animate-glow">🚀 شروعِ رایگانِ ۴۸ ساعته</a>
            <a href="#how" className="btn-outline text-base py-4 px-8">چطور کار می‌کند؟</a>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="text-sm text-dark-400 mt-6">بدونِ کارتِ اعتباری · هر لحظه قابلِ لغو · پولت دستِ خودت</motion.p>
        </div>

        {/* فلشِ اسکرول */}
        <motion.div animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-dark-400">
          <svg width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
        </motion.div>
      </section>

      {/* ═══ آمار ═══ */}
      <section className="py-14 border-y border-dark-800/50 bg-dark-900/40">
        <div className="container mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="text-3xl sm:text-4xl font-black gradient-text mb-1"><Counter to={s.to} suffix={s.suffix} /></div>
              <div className="text-sm text-dark-300">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ چطور کار می‌کند ═══ */}
      <section id="how" className="py-20">
        <div className="container mx-auto px-4">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">در <span className="gradient-text">۳ قدم</span> تا سودِ خودکار</h2>
            <p className="text-dark-300 max-w-xl mx-auto">از لینک‌کردنِ حساب تا اولین معاملهٔ خودکار، کمتر از چند دقیقه فاصله است.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 relative">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.12}>
                <div className="card h-full p-7 text-center relative group hover:border-bullish/40 transition-colors">
                  <div className="text-5xl mb-4 group-hover:animate-float">{s.icon}</div>
                  <div className="absolute top-5 right-5 w-9 h-9 rounded-full bg-bullish/10 text-bullish font-black flex items-center justify-center">{s.n}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-dark-300 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ چرا ما ═══ */}
      <section className="py-20 bg-dark-900/40">
        <div className="container mx-auto px-4">
          <Reveal className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">چرا کپی‌تریدِ <span className="gradient-text">CoinePro</span>؟</h2>
            <p className="text-dark-300 max-w-xl mx-auto">یک سیستمِ معاملاتیِ نهادی، در دستانِ تو.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.1}>
                <div className="card h-full p-6 hover:-translate-y-1 transition-transform">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 text-2xl flex items-center justify-center mb-4">{f.icon}</div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-dark-300 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ پلن‌های VIP ═══ */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Reveal className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">عضویتِ <span className="gradient-text">VIP</span> را انتخاب کن</h2>
            <p className="text-dark-300 max-w-xl mx-auto">با تریالِ رایگان شروع کن؛ هر وقت خواستی ارتقا بده. ثبت‌نام در چند ثانیه از طریقِ ربات.</p>
          </Reveal>

          {/* ★ پیشنهادِ ویژه — رایگان با بروکر ★ */}
          <Reveal className="mb-10">
            <div className="relative rounded-3xl p-[2px] bg-gradient-to-l from-bullish via-accent to-bullish animate-glow">
              <div className="rounded-3xl bg-dark-950/90 backdrop-blur p-7 sm:p-9 grid lg:grid-cols-[1.4fr_1fr] gap-7 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-bullish/15 border border-bullish/40 text-bullish text-xs font-black mb-4">
                    🎁 پیشنهادِ ویژه — محبوب‌ترین راهِ شروع
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-3">
                    همهٔ امکانات، <span className="gradient-text">کاملاً رایگان</span> — با بروکر
                  </h3>
                  <p className="text-dark-200 leading-relaxed mb-5">
                    چرا ماهانه هزینه بدهی؟ کافی است در بروکرِ <b className="text-white">OneRoyal</b> (با لینکِ ما) ثبت‌نام کنی و
                    <b className="text-bullish"> ۵۰۰ تتر به حسابِ خودت</b> واریز کنی — همین و بس. از این لحظه <b className="text-white">همهٔ امکاناتِ VIP،
                    کپی‌تریدِ خودکار و سرورِ اختصاصی را رایگان</b> داری.
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-2.5 mb-6">
                    {['بدونِ هیچ هزینهٔ ماهانه', 'پولت در حسابِ خودت می‌ماند', 'کپی‌تریدِ کاملِ خودکار', 'سرورِ اختصاصیِ کپی رایگان', 'همهٔ سیگنال‌ها و امکاناتِ VIP', 'پشتیبانیِ اختصاصی'].map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-dark-100">
                        <svg className="w-4 h-4 text-bullish shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>{f}
                      </li>
                    ))}
                  </ul>
                  <a href={APP_CONFIG.BROKER_REFERRAL_URL} target="_blank" rel="noopener noreferrer"
                    className="inline-block bg-bullish text-dark-950 font-black py-3.5 px-8 rounded-xl hover:bg-bullish-light transition-colors">
                    🚀 ثبت‌نامِ رایگان در بروکر
                  </a>
                </div>
                <div className="text-center lg:border-r lg:border-dark-700/60 lg:pr-7">
                  <div className="text-dark-300 text-sm mb-1">هزینهٔ اشتراک</div>
                  <div className="text-6xl font-black gradient-text mb-1">۰<span className="text-2xl"> تومان</span></div>
                  <div className="text-bullish font-bold text-sm mb-4">برای همیشه رایگان</div>
                  <div className="rounded-xl bg-dark-900/60 border border-dark-700/50 p-4 text-sm">
                    <div className="text-dark-400 mb-1">تنها شرط:</div>
                    <div className="text-white font-bold">واریزِ ۵۰۰ تتر</div>
                    <div className="text-dark-400 text-xs mt-1">به حسابِ بروکرِ <b className="text-dark-200">خودت</b> (نه به ما)</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal className="text-center mb-6"><p className="text-sm text-dark-400">یا یکی از پلن‌های اشتراکیِ زیر را انتخاب کن:</p></Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08} className="h-full">
                <div className={`relative h-full rounded-2xl p-6 flex flex-col border transition-all ${p.highlight ? 'border-bullish bg-bullish/5 shadow-[0_0_40px_rgba(0,200,83,0.15)] scale-[1.03]' : 'border-dark-800 bg-dark-900/40 hover:border-accent/40'}`}>
                  {p.highlight && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-bullish text-dark-950 text-xs font-black">محبوب‌ترین</div>}
                  <h3 className="text-lg font-bold text-white">{p.name}</h3>
                  <p className="text-xs text-dark-400 mb-4 h-8">{p.desc}</p>
                  <div className="mb-5"><span className="text-4xl font-black gradient-text">{p.price}</span><span className="text-dark-400 text-sm mr-1">{p.period}</span></div>
                  <ul className="space-y-2.5 mb-6 flex-1">
                    {p.features.map((ft) => (
                      <li key={ft} className="flex items-start gap-2 text-sm text-dark-200">
                        <svg className="w-4 h-4 text-bullish shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {ft}
                      </li>
                    ))}
                  </ul>
                  <a href={APP_CONFIG.BOT_URL} target="_blank" rel="noopener noreferrer"
                    className={`block text-center py-3 rounded-xl font-bold text-sm transition-colors ${p.highlight ? 'bg-bullish text-dark-950 hover:bg-bullish-light' : 'bg-dark-800 text-white hover:bg-accent'}`}>{p.cta}</a>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="text-center mt-6">
            <p className="text-sm text-dark-300">قیمت‌ها شاملِ <b className="text-white">سرورِ اختصاصیِ کپی (۳۰$/ماه)</b> است.</p>
            <p className="text-xs text-bullish mt-1">🎁 برای کاربرانِ بروکرِ <b>OneRoyal</b> هزینهٔ سرور رایگان است — یعنی فقط ۶۰ / ۱۴۰ / ۲۴۰ دلار می‌پردازی.</p>
            <p className="text-xs text-dark-400 mt-2">⚠️ پنلِ کپی‌ترید فقط برای اعضای VIP فعال است؛ تریالِ رایگانِ ۴۸ساعته فقط مشاهدهٔ سیگنال‌هاست.</p>
          </Reveal>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-20 bg-dark-900/40">
        <div className="container mx-auto px-4 max-w-3xl">
          <Reveal className="text-center mb-12"><h2 className="text-3xl sm:text-4xl font-black text-white">سؤالاتِ <span className="gradient-text">پرتکرار</span></h2></Reveal>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <Reveal key={i} delay={i * 0.05}>
                <div className="card overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? -1 : i)} className="w-full flex items-center justify-between p-5 text-right">
                    <span className="font-bold text-white">{f.q}</span>
                    <svg className={`w-5 h-5 text-bullish shrink-0 transition-transform ${openFaq === i ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg>
                  </button>
                  <motion.div initial={false} animate={{ height: openFaq === i ? 'auto' : 0, opacity: openFaq === i ? 1 : 0 }} className="overflow-hidden">
                    <p className="px-5 pb-5 text-dark-300 text-sm leading-relaxed">{f.a}</p>
                  </motion.div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA نهایی ═══ */}
      <section className="py-24 relative bg-grid">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-bullish/5 to-transparent" />
        <div className="container mx-auto px-4 text-center relative z-10 max-w-3xl">
          <Reveal>
            <h2 className="text-3xl sm:text-5xl font-black text-white mb-5">امروز شروع کن، <span className="gradient-text">رایگان</span></h2>
            <p className="text-lg text-dark-300 mb-8">۴۸ ساعت کاملِ کپی‌ترید را بدونِ پرداخت تجربه کن. اگر راضی نبودی، هیچ هزینه‌ای نداری.</p>
            <a href={APP_CONFIG.BOT_URL} target="_blank" rel="noopener noreferrer"
              className="btn-primary text-lg py-4 px-10 inline-block animate-glow">🚀 همین حالا شروع کن</a>
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-dark-400">
              <Link to="/performance" className="hover:text-bullish transition-colors">📊 عملکردِ واقعی</Link>
              <a href={APP_CONFIG.SUPPORT_TELEGRAM} target="_blank" rel="noopener noreferrer" className="hover:text-bullish transition-colors">💬 پشتیبانی</a>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
