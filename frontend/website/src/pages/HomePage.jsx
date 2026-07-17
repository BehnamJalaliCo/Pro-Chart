import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { signalsAPI, performanceAPI, pricesAPI } from '../api/client';
import { APP_CONFIG } from '../utils/constants';
import useSeo from '../hooks/useSeo';

/* ─── کمک‌تابع‌ها برای دادهٔ واقعی ─── */
const isBuy = (d) => ['long', 'buy', 'BUY'].includes(String(d || '').toLowerCase()) || d === 'long';
const dirIsBuy = (d) => {
  const x = String(d || '').toLowerCase();
  return x === 'long' || x === 'buy';
};
const fmtPrice = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  const digits = Math.abs(n) >= 100 ? 2 : Math.abs(n) >= 10 ? 3 : 5;
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};
const strengthLabel = (score) => {
  const s = Number(score) || 0;
  if (s >= 75) return 'قوی';
  if (s >= 60) return 'متوسط';
  return 'ضعیف';
};
const relTime = (iso) => {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'لحظاتی پیش';
  if (m < 60) return `${m.toLocaleString('fa-IR')} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h.toLocaleString('fa-IR')} ساعت پیش`;
  const d = Math.floor(h / 24);
  return `${d.toLocaleString('fa-IR')} روز پیش`;
};
const faMonth = (ym) => {
  try {
    const [y, mo] = String(ym).split('-');
    return new Intl.DateTimeFormat('fa-IR', { month: 'long' }).format(
      new Date(Number(y), Number(mo) - 1, 15)
    );
  } catch {
    return ym;
  }
};

/* ─── Animated Counter ─── */
function AnimatedCounter({ end, duration = 2, suffix = '', prefix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let startTime;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, end, duration]);

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString('fa-IR')}{suffix}
    </span>
  );
}

const faqItems = [
  {
    question: 'سیگنال‌های کوین پرو FX چگونه تولید می‌شوند؟',
    answer: 'سیگنال‌های ما با استفاده از ترکیب الگوریتم‌های تحلیل تکنیکال پیشرفته، الگوهای پرایس اکشن، اندیکاتورهای مختلف و هوش مصنوعی تولید می‌شوند. هر سیگنال قبل از ارسال توسط سیستم اعتبارسنجی چند لایه بررسی می‌شود.',
  },
  {
    question: 'آیا استفاده از سیگنال‌ها رایگان است؟',
    answer: 'بله، بخشی از سیگنال‌ها در کانال عمومی تلگرام به صورت رایگان ارائه می‌شوند. برای دسترسی به تمام سیگنال‌ها با جزئیات کامل و تحلیل‌های اختصاصی، می‌توانید اشتراک ویژه تهیه کنید.',
  },
  {
    question: 'نرخ موفقیت سیگنال‌ها چقدر است؟',
    answer: 'تمام آمار عملکرد ما — شامل نرخ برد، سود/زیان خالص (پیپ) و جزئیات هر سیگنال — به‌صورت کاملاً واقعی و لحظه‌ای از دیتابیس پروژه خوانده و در صفحهٔ «عملکرد» نمایش داده می‌شود. هیچ عددی دستکاری یا ساختگی نیست.',
  },
  {
    question: 'سیگنال‌ها برای چه جفت‌ارزهایی ارسال می‌شود؟',
    answer: 'سیگنال‌های ما شامل جفت‌ارزهای اصلی (مانند EUR/USD و GBP/USD)، جفت‌ارزهای فرعی، طلا (XAU/USD)، نقره و شاخص‌های مهم مانند US30 و NAS100 می‌شود.',
  },
  {
    question: 'حد ضرر و حد سود هر سیگنال مشخص است؟',
    answer: 'بله، هر سیگنال شامل نقطه ورود دقیق، حداقل یک حد سود (Take Profit) و حد ضرر (Stop Loss) مشخص است. همچنین درجه قدرت سیگنال و تحلیل مختصری نیز ارائه می‌شود.',
  },
];

/* ─── Section wrapper ─── */
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

function Section({ children, className = '' }) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      variants={fadeInUp}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ─── FAQ Accordion ─── */
function FAQItem({ question, answer, isOpen, onClick }) {
  return (
    <div className="border border-dark-800/50 rounded-xl overflow-hidden">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between px-6 py-4 text-right hover:bg-dark-800/30 transition-colors"
      >
        <span className="text-white font-medium text-sm lg:text-base">{question}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="w-5 h-5 text-accent shrink-0 mr-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <motion.div
        initial={false}
        animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <p className="px-6 pb-4 text-dark-400 text-sm leading-7">{answer}</p>
      </motion.div>
    </div>
  );
}

/* ─── Custom Tooltip ─── */
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 text-sm">
        <p className="text-dark-400 mb-1">{label}</p>
        <p className="text-bullish font-bold">{payload[0].value.toLocaleString('fa-IR')} پیپ</p>
      </div>
    );
  }
  return null;
}

/* ─── Main HomePage ─── */
export default function HomePage() {
  useSeo({
    title: 'سیگنال فارکس هوشمند با هوش مصنوعی',
    description: 'کوین پرو FX؛ سیگنال‌های واقعی و دقیق فارکس، طلا و شاخص‌ها با موتور چندعاملی و هوش مصنوعی. قیمت لحظه‌ای، عملکرد شفاف و آکادمی آموزش فارکس.',
    path: '/',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    },
  });
  const [openFaq, setOpenFaq] = useState(null);

  // ── دادهٔ واقعیِ پروژه (بدونِ هیچ مقدارِ فیک) ──
  const { data: statsData } = useQuery({
    queryKey: ['signalStats'],
    queryFn: signalsAPI.getStats,
    refetchInterval: 60000,
  });

  const { data: summaryData } = useQuery({
    queryKey: ['perfSummary'],
    queryFn: performanceAPI.getSummary,
    refetchInterval: 60000,
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['perfMonthly'],
    queryFn: performanceAPI.getMonthly,
    refetchInterval: 120000,
  });

  const { data: pricesRaw } = useQuery({
    queryKey: ['livePricesHome'],
    queryFn: pricesAPI.getLive,
    refetchInterval: 30000,
  });

  const stats = statsData || {};
  const overall = summaryData?.overall || {};

  // قیمت‌های واقعیِ لایو (۸ نمادِ اول)
  const symbols = (pricesRaw?.items || []).slice(0, 8).map((p) => ({
    symbol: p.symbol,
    price: fmtPrice(p.price),
    change: `${p.change_pct >= 0 ? '+' : ''}${Number(p.change_pct).toLocaleString('fa-IR')}%`,
    positive: !!p.positive,
  }));

  // نمودارِ سودِ تجمعیِ واقعی از عملکردِ ماهانه
  let cum = 0;
  const chartData = (monthlyData?.items || []).map((m) => {
    cum += Number(m.pips) || 0;
    return { month: faMonth(m.month), profit: Math.round(cum) };
  });
  const totalPips = Math.round(Number(stats.total_pips ?? overall.total_pips ?? 0));
  const pipsLabel = `${totalPips >= 0 ? '+' : ''}${totalPips.toLocaleString('fa-IR')} پیپ`;

  return (
    <div className="overflow-hidden">
      {/* ══════ Hero Section ══════ */}
      <section className="relative min-h-[90vh] flex items-center bg-grid">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-bullish/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Text side */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 rounded-full bg-bullish animate-pulse" />
                <span className="text-accent text-sm font-medium">سیگنال‌های فعال در حال ارسال</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
                سیگنال فارکس{' '}
                <span className="gradient-text">هوشمند</span>
                <br />
                با دقت بالا
              </h1>
              <p className="text-dark-300 text-lg leading-8 mb-8 max-w-xl">
                با استفاده از الگوریتم‌های پیشرفته تحلیل تکنیکال و هوش مصنوعی، دقیق‌ترین
                سیگنال‌های خرید و فروش را برای جفت‌ارزها، طلا و شاخص‌ها دریافت کنید.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <a
                  href={APP_CONFIG.BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex items-center justify-center gap-2 text-base py-4"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  شروع رایگان در ربات
                </a>
                <Link
                  to="/signals"
                  className="btn-outline flex items-center justify-center gap-2 text-base py-4"
                >
                  مشاهده سیگنال‌ها
                  <svg className="w-4 h-4 rtl-flip" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>

              {/* Stats — واقعی از پروژه */}
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center sm:text-right">
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    <AnimatedCounter end={stats.total_signals || 0} />
                  </div>
                  <div className="text-dark-400 text-sm mt-1">سیگنال ارسال‌شده</div>
                </div>
                <div className="text-center sm:text-right">
                  <div className="text-2xl sm:text-3xl font-black text-bullish">
                    <AnimatedCounter end={Math.round(stats.win_rate || 0)} suffix="%" />
                  </div>
                  <div className="text-dark-400 text-sm mt-1">نرخ موفقیت</div>
                </div>
                <div className="text-center sm:text-right">
                  <div className="text-2xl sm:text-3xl font-black text-white">
                    <AnimatedCounter end={stats.symbols_covered || 0} suffix="+" />
                  </div>
                  <div className="text-dark-400 text-sm mt-1">نماد تحت پوشش</div>
                </div>
              </div>
            </motion.div>

            {/* Chart / Visual side */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="hidden lg:block"
            >
              <div className="glass-card p-6 glow-accent">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold">سود تجمعی</h3>
                    <p className="text-dark-400 text-sm">بر حسب پیپ - عملکرد واقعی</p>
                  </div>
                  <span className={totalPips >= 0 ? 'badge-bullish' : 'badge-bearish'}>
                    {pipsLabel}
                  </span>
                </div>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={totalPips >= 0 ? '#00C853' : '#FF1744'} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={totalPips >= 0 ? '#00C853' : '#FF1744'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                      <XAxis dataKey="month" stroke="#737384" fontSize={11} />
                      <YAxis stroke="#737384" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke={totalPips >= 0 ? '#00C853' : '#FF1744'}
                        strokeWidth={2}
                        fill="url(#colorProfit)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-dark-400 text-sm">
                    داده‌ای برای نمایش نمودار موجود نیست
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════ Performance Stats ══════ */}
      <Section className="py-16 lg:py-24 bg-dark-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">آمار عملکرد</h2>
            <p className="text-dark-400 max-w-2xl mx-auto">
              شفافیت کامل در عملکرد. تمام سیگنال‌های ارسال شده و نتایج آن‌ها به صورت عمومی قابل بررسی هستند.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-12">
            {[
              { label: 'کل سیگنال‌ها', value: stats.total_signals || 0, suffix: '', color: 'text-white' },
              { label: 'نرخ برد', value: Math.round(stats.win_rate || 0), suffix: '%', color: 'text-bullish' },
              { label: 'سود خالص (پیپ)', value: totalPips, suffix: '', color: totalPips >= 0 ? 'text-bullish' : 'text-bearish' },
              { label: 'سیگنال‌های فعال', value: stats.active || 0, suffix: '', color: 'text-accent' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 text-center"
              >
                <div className={`text-3xl lg:text-4xl font-black ${stat.color} mb-2`}>
                  {Math.abs(stat.value) > 100 ? (
                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  ) : (
                    <>{Number(stat.value).toLocaleString('fa-IR')}{stat.suffix}</>
                  )}
                </div>
                <div className="text-dark-400 text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Mobile chart */}
          {chartData.length > 0 && (
          <div className="lg:hidden glass-card p-4">
            <h3 className="text-white font-bold mb-4">نمودار سود تجمعی</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorProfitMobile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={totalPips >= 0 ? '#00C853' : '#FF1744'} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={totalPips >= 0 ? '#00C853' : '#FF1744'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis dataKey="month" stroke="#737384" fontSize={10} />
                <YAxis stroke="#737384" fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke={totalPips >= 0 ? '#00C853' : '#FF1744'}
                  strokeWidth={2}
                  fill="url(#colorProfitMobile)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          )}

          <div className="text-center mt-8">
            <Link to="/performance" className="btn-outline text-sm py-2.5 px-6">
              مشاهده جزئیات کامل عملکرد
            </Link>
          </div>
        </div>
      </Section>

      {/* ══════ Supported Symbols ══════ */}
      <Section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">نمادهای تحت پوشش</h2>
            <p className="text-dark-400">قیمت لحظه‌ای نمادهای اصلی بازار فارکس</p>
          </div>

          {symbols.length === 0 ? (
            <div className="glass-card p-10 text-center text-dark-400">در حال دریافت قیمت‌های لحظه‌ای…</div>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
            {symbols.map((item, index) => (
              <motion.div
                key={item.symbol}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4 hover:border-dark-600/50 transition-all cursor-pointer group"
              >
                <div className="text-white font-bold text-sm mb-1 group-hover:text-accent transition-colors">
                  {item.symbol}
                </div>
                <div className="text-white font-mono text-lg">{item.price}</div>
                <div
                  className={`text-sm font-medium mt-1 ${
                    item.positive ? 'text-bullish' : 'text-bearish'
                  }`}
                >
                  {item.change}
                </div>
              </motion.div>
            ))}
          </div>
          )}

          <div className="text-center mt-8">
            <Link to="/live-prices" className="btn-outline text-sm py-2.5 px-6">
              مشاهده همه قیمت‌ها
            </Link>
          </div>
        </div>
      </Section>

      {/* ══════ Features ══════ */}
      <Section className="py-16 lg:py-24 bg-dark-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">چرا کوین پرو FX؟</h2>
            <p className="text-dark-400">ویژگی‌هایی که ما را متفاوت می‌کند</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: 'تحلیل هوش مصنوعی',
                desc: 'الگوریتم‌های یادگیری ماشین ما بیش از ۵۰ اندیکاتور را همزمان تحلیل می‌کنند تا بهترین نقاط ورود و خروج را پیدا کنند.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                ),
              },
              {
                title: 'ارسال لحظه‌ای',
                desc: 'سیگنال‌ها بلافاصله پس از تولید از طریق تلگرام و وب‌سایت ارسال می‌شوند. هیچ فرصت معاملاتی را از دست نمی‌دهید.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                ),
              },
              {
                title: 'مدیریت ریسک',
                desc: 'هر سیگنال شامل حد ضرر مشخص و نسبت ریسک به ریوارد بهینه است. محافظت از سرمایه اولویت اول ماست.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
              {
                title: 'شفافیت کامل',
                desc: 'تمام سیگنال‌ها و نتایج آن‌ها به صورت عمومی ثبت می‌شوند. آمار عملکرد واقعی و بدون دستکاری.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
              {
                title: 'پشتیبانی ۲۴/۷',
                desc: 'تیم پشتیبانی ما در تمام ساعات شبانه‌روز آماده پاسخگویی به سوالات شما در تلگرام است.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                ),
              },
              {
                title: 'آموزش رایگان',
                desc: 'مقالات و ویدیوهای آموزشی رایگان درباره تحلیل تکنیکال، مدیریت سرمایه و روانشناسی معامله‌گری.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                  </svg>
                ),
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-6 hover:border-accent/30 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-4 group-hover:bg-accent/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-dark-400 text-sm leading-7">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* ══════ FAQ ══════ */}
      <Section className="py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-black text-white mb-3">سوالات متداول</h2>
            <p className="text-dark-400">پاسخ سوالاتی که بیشتر پرسیده می‌شوند</p>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, index) => (
              <FAQItem
                key={index}
                question={item.question}
                answer={item.answer}
                isOpen={openFaq === index}
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              />
            ))}
          </div>
        </div>
      </Section>

      {/* ══════ CTA ══════ */}
      <Section className="py-16 lg:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative glass-card p-8 lg:p-16 text-center overflow-hidden gradient-border">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-bullish/5" />
            <div className="relative">
              <h2 className="text-2xl lg:text-4xl font-black text-white mb-4">
                همین الان به جمع معامله‌گران موفق بپیوندید
              </h2>
              <p className="text-dark-300 text-lg mb-8 max-w-2xl mx-auto leading-8">
                با ورود به ربات تلگرام کوین پرو FX، سیگنال‌های رایگان دریافت کنید و
                از تحلیل‌های روزانه بازار بهره‌مند شوید.
              </p>
              <a
                href={APP_CONFIG.BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 text-lg py-4 px-10"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
                ورود به ربات تلگرام
              </a>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
