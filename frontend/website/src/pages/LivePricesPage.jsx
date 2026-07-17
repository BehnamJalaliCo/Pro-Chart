import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { pricesAPI } from '../api/client';
import useSeo from '../hooks/useSeo';

/* ─── متادیتای نمادها (نام فارسی + دسته) برای نمایش ─── */
const META = {
  EURUSD: { name: 'یورو/دلار', cat: 'major' },
  GBPUSD: { name: 'پوند/دلار', cat: 'major' },
  USDJPY: { name: 'دلار/ین', cat: 'major' },
  USDCHF: { name: 'دلار/فرانک', cat: 'major' },
  AUDUSD: { name: 'دلار استرالیا/دلار', cat: 'major' },
  NZDUSD: { name: 'دلار نیوزلند/دلار', cat: 'major' },
  USDCAD: { name: 'دلار/دلار کانادا', cat: 'major' },
  EURGBP: { name: 'یورو/پوند', cat: 'cross' },
  EURJPY: { name: 'یورو/ین', cat: 'cross' },
  GBPJPY: { name: 'پوند/ین', cat: 'cross' },
  AUDJPY: { name: 'دلار استرالیا/ین', cat: 'cross' },
  EURAUD: { name: 'یورو/دلار استرالیا', cat: 'cross' },
  EURCHF: { name: 'یورو/فرانک', cat: 'cross' },
  GBPCHF: { name: 'پوند/فرانک', cat: 'cross' },
  XAUUSD: { name: 'طلا', cat: 'commodity' },
  XAGUSD: { name: 'نقره', cat: 'commodity' },
  XTIUSD: { name: 'نفت خام', cat: 'commodity' },
  XNGUSD: { name: 'گاز طبیعی', cat: 'commodity' },
  US30: { name: 'داوجونز', cat: 'index' },
  US500: { name: 'اس اند پی ۵۰۰', cat: 'index' },
  NAS100: { name: 'نزدک ۱۰۰', cat: 'index' },
  DE40: { name: 'دکس آلمان', cat: 'index' },
};

function getChange(current, prev) {
  const change = ((current - prev) / prev) * 100;
  return {
    value: change,
    formatted: (change >= 0 ? '+' : '') + change.toFixed(2) + '%',
    positive: change >= 0,
  };
}

function formatPrice(price) {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  return price.toFixed(4);
}

const categories = [
  { key: '', label: 'همه' },
  { key: 'major', label: 'جفت‌ارز اصلی' },
  { key: 'cross', label: 'جفت‌ارز فرعی' },
  { key: 'commodity', label: 'کالا' },
  { key: 'index', label: 'شاخص' },
];

export default function LivePricesPage() {
  useSeo({
    title: 'قیمت لحظه‌ای فارکس، طلا و شاخص‌ها',
    description: 'قیمت‌های زنده و لحظه‌ای جفت‌ارزها، طلا (XAUUSD)، نقره، نفت و شاخص‌های جهانی در کوین پرو FX؛ مستقیم از فید دادهٔ واقعی پروژه.',
    path: '/live-prices',
  });
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  // تاریخچهٔ کوتاهِ قیمتِ هر نماد برای ساختِ اسپارک‌لاینِ واقعی از پول‌های متوالی
  const sparkRef = useRef({});
  const prevPriceRef = useRef({});
  const [tick, setTick] = useState(0);

  // قیمتِ لایوِ واقعیِ پروژه (هر ۱۰ ثانیه)
  const { data: liveRaw, dataUpdatedAt } = useQuery({
    queryKey: ['livePricesPage'],
    queryFn: pricesAPI.getLive,
    refetchInterval: 20000,
  });

  // با هر دادهٔ جدید، تاریخچهٔ اسپارک‌لاین و فلش را به‌روزرسانی کن
  useEffect(() => {
    const items = liveRaw?.items || [];
    items.forEach((p) => {
      const key = p.raw_symbol || p.symbol;
      const hist = sparkRef.current[key] || [];
      const next = [...hist, { v: p.price }].slice(-20);
      sparkRef.current[key] = next;
    });
    setTick((t) => t + 1);
    // بعد از فلش، مرجعِ قیمتِ قبلی را به‌روز کن
    const timer = setTimeout(() => {
      items.forEach((p) => {
        const key = p.raw_symbol || p.symbol;
        prevPriceRef.current[key] = p.price;
      });
      setTick((t) => t + 1);
    }, 600);
    return () => clearTimeout(timer);
  }, [dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = liveRaw?.items || [];
  const prices = items.map((p) => {
    const key = p.raw_symbol || p.symbol;
    const meta = META[key] || { name: p.symbol, cat: 'major' };
    const prev = prevPriceRef.current[key];
    const flash = prev == null ? null : p.price > prev ? 'green' : p.price < prev ? 'red' : null;
    // prevClose را از درصدِ تغییرِ روزانهٔ واقعی بازسازی کن تا getChange همان را بدهد
    const prevClose = p.change_pct != null ? p.price / (1 + p.change_pct / 100) : p.price;
    return {
      symbol: p.symbol,
      raw: key,
      name: meta.name,
      category: meta.cat,
      currentPrice: p.price,
      prevClose,
      sparkline: sparkRef.current[key] || [{ v: p.price }],
      flash,
    };
  });

  const filtered = prices.filter((item) => {
    if (filter && item.category !== filter) return false;
    if (search && !item.symbol.toLowerCase().includes(search.toLowerCase()) && !item.name.includes(search)) return false;
    return true;
  });

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl lg:text-4xl font-black text-white">قیمت لحظه‌ای</h1>
            <span className="flex items-center gap-1.5 bg-bullish/10 border border-bullish/20 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-bullish animate-pulse" />
              <span className="text-bullish text-xs font-medium">زنده</span>
            </span>
          </div>
          <p className="text-dark-400 text-lg">قیمت‌های لحظه‌ای ۲۰ نماد پرمعامله بازار فارکس</p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6"
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setFilter(cat.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  filter === cat.key
                    ? 'bg-accent text-white'
                    : 'bg-dark-800/50 text-dark-400 hover:text-white hover:bg-dark-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-auto">
            <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="جستجوی نماد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 bg-dark-800 border border-dark-700 text-white text-sm rounded-lg pr-10 pl-4 py-2.5 focus:border-accent focus:outline-none placeholder:text-dark-500"
            />
          </div>
        </motion.div>

        {/* Desktop Table View */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="hidden lg:block glass-card overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-800">
                <th className="text-right text-dark-400 text-sm font-medium py-4 px-6">نماد</th>
                <th className="text-right text-dark-400 text-sm font-medium py-4 px-4">نام</th>
                <th className="text-left text-dark-400 text-sm font-medium py-4 px-4">قیمت</th>
                <th className="text-left text-dark-400 text-sm font-medium py-4 px-4">تغییر روزانه</th>
                <th className="text-center text-dark-400 text-sm font-medium py-4 px-4">نمودار</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, index) => {
                const change = getChange(item.currentPrice, item.prevClose);
                return (
                  <motion.tr
                    key={item.symbol}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className={`border-b border-dark-800/50 hover:bg-dark-800/30 transition-all ${
                      item.flash === 'green' ? 'bg-bullish/5' : item.flash === 'red' ? 'bg-bearish/5' : ''
                    }`}
                  >
                    <td className="py-3 px-6">
                      <span className="text-white font-bold">{item.symbol}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-dark-400 text-sm">{item.name}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        dir="ltr"
                        className={`font-mono font-bold text-lg transition-colors duration-300 ${
                          item.flash === 'green' ? 'text-bullish' : item.flash === 'red' ? 'text-bearish' : 'text-white'
                        }`}
                      >
                        {formatPrice(item.currentPrice)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`font-medium text-sm ${
                          change.positive ? 'text-bullish' : 'text-bearish'
                        }`}
                      >
                        {change.formatted}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-24 h-10 mx-auto">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={item.sparkline}>
                            <Line
                              type="monotone"
                              dataKey="v"
                              stroke={change.positive ? '#00C853' : '#FF1744'}
                              strokeWidth={1.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3">
          {filtered.map((item, index) => {
            const change = getChange(item.currentPrice, item.prevClose);
            return (
              <motion.div
                key={item.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`glass-card p-4 transition-all ${
                  item.flash === 'green' ? 'border-bullish/30' : item.flash === 'red' ? 'border-bearish/30' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold">{item.symbol}</span>
                      <span className="text-dark-500 text-xs">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        dir="ltr"
                        className={`font-mono font-bold text-lg ${
                          item.flash === 'green' ? 'text-bullish' : item.flash === 'red' ? 'text-bearish' : 'text-white'
                        }`}
                      >
                        {formatPrice(item.currentPrice)}
                      </span>
                      <span className={`text-sm font-medium ${change.positive ? 'text-bullish' : 'text-bearish'}`}>
                        {change.formatted}
                      </span>
                    </div>
                  </div>
                  <div className="w-20 h-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={item.sparkline}>
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke={change.positive ? '#00C853' : '#FF1744'}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-dark-500 text-lg">نمادی با فیلتر انتخابی یافت نشد</p>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 glass-card p-4 text-center">
          <p className="text-dark-500 text-xs">
            قیمت‌ها مستقیماً از فید دادهٔ زندهٔ پروژهٔ کوین پرو FX خوانده شده و هر ۱۰ ثانیه به‌روزرسانی می‌شوند.
            این قیمت‌ها جنبه اطلاع‌رسانی دارند و ممکن است با قیمت واقعی بروکر شما اندکی تفاوت داشته باشد.
          </p>
        </div>
      </div>
    </div>
  );
}
