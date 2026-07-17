import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { performanceAPI, signalsAPI } from '../api/client';
import useSeo from '../hooks/useSeo';

/* ─── کمک‌تابع‌ها ─── */
const DISPLAY_MAP = {
  XAUUSD: 'XAU/USD', XAGUSD: 'XAG/USD', EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD',
  USDJPY: 'USD/JPY', USDCHF: 'USD/CHF', AUDUSD: 'AUD/USD', NZDUSD: 'NZD/USD',
  USDCAD: 'USD/CAD', EURGBP: 'EUR/GBP', EURJPY: 'EUR/JPY', GBPJPY: 'GBP/JPY',
  AUDJPY: 'AUD/JPY', EURAUD: 'EUR/AUD', XTIUSD: 'WTI Oil', XNGUSD: 'NatGas',
  US30: 'US30', US500: 'US500', NAS100: 'NAS100', DE40: 'GER40',
};
const dispSym = (s) => DISPLAY_MAP[s] || s;
const fa = (n, d = 0) => Number(n || 0).toLocaleString('fa-IR', { maximumFractionDigits: d });
const faMonth = (ym) => {
  try {
    const [y, mo] = String(ym).split('-');
    return new Intl.DateTimeFormat('fa-IR', { month: 'long' }).format(new Date(Number(y), Number(mo) - 1, 15));
  } catch {
    return ym;
  }
};

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 text-sm shadow-lg">
        <p className="text-dark-400 mb-1">{label}</p>
        {payload.map((item, i) => (
          <p key={i} style={{ color: item.color }} className="font-bold">
            {item.name}: {typeof item.value === 'number' ? item.value.toLocaleString('fa-IR') : item.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function PerformancePage() {
  useSeo({
    title: 'عملکرد و آمار واقعی سیگنال‌ها',
    description: 'آمار کاملاً واقعی و شفاف عملکرد سیگنال‌های کوین پرو FX: نرخ برد، سود/زیان، منحنی رشد سرمایه و عملکرد هر نماد — مستقیم از دیتابیس پروژه.',
    path: '/performance',
  });
  const { data: summaryData } = useQuery({
    queryKey: ['perfSummaryPage'],
    queryFn: performanceAPI.getSummary,
    refetchInterval: 60000,
  });
  const { data: statsData } = useQuery({
    queryKey: ['signalStatsPage'],
    queryFn: signalsAPI.getStats,
    refetchInterval: 60000,
  });
  const { data: monthlyData } = useQuery({
    queryKey: ['perfMonthlyPage'],
    queryFn: performanceAPI.getMonthly,
    refetchInterval: 120000,
  });
  const { data: equityData } = useQuery({
    queryKey: ['perfEquityPage'],
    queryFn: performanceAPI.getEquityCurve,
    refetchInterval: 120000,
  });
  const { data: recentData } = useQuery({
    queryKey: ['recentSignalsPerf'],
    queryFn: () => signalsAPI.getRecent({ limit: 200 }),
    refetchInterval: 60000,
  });

  const overall = summaryData?.overall || {};
  const stats = statsData || {};
  const totalPips = Math.round(Number(overall.total_pips ?? stats.total_pips ?? 0));

  // ── کارت‌های خلاصه (واقعی) ──
  const summaryCards = [
    { label: 'کل سیگنال‌ها', value: fa(stats.total_signals), color: 'text-white' },
    { label: 'نرخ برد', value: `٪${fa(overall.win_rate, 1)}`, color: 'text-bullish' },
    { label: 'سود کل (پیپ)', value: `${totalPips >= 0 ? '' : '−'}${fa(Math.abs(totalPips), 1)}`, color: totalPips >= 0 ? 'text-bullish' : 'text-bearish' },
    { label: 'بهترین معامله', value: `+${fa(overall.best_trade, 1)}`, color: 'text-bullish' },
    { label: 'میانگین هر سیگنال', value: `${fa(overall.avg_pips, 1)} پیپ`, color: 'text-accent' },
  ];

  // ── منحنی رشد سرمایه (واقعی) ──
  const equityCurve = (equityData?.curve || []).map((p) => ({
    date: p.date,
    equity: Math.round(Number(p.balance) || 0),
  }));

  // ── افت سرمایه از روی منحنیِ واقعی ──
  let peak = -Infinity;
  const drawdownSeries = (equityData?.curve || []).map((p) => {
    const bal = Number(p.balance) || 0;
    if (bal > peak) peak = bal;
    const dd = peak > 0 ? ((bal - peak) / peak) * 100 : 0;
    return { date: p.date, drawdown: Number(dd.toFixed(2)) };
  });
  const maxDD = drawdownSeries.length ? Math.min(...drawdownSeries.map((d) => d.drawdown)) : 0;
  const avgDD = drawdownSeries.length
    ? drawdownSeries.reduce((a, b) => a + b.drawdown, 0) / drawdownSeries.length
    : 0;

  // ── آمار ماهانه (واقعی) ──
  const monthly = (monthlyData?.items || []).map((m) => ({
    month: faMonth(m.month),
    signals: m.total_signals,
    wins: m.wins,
    losses: m.losses,
    winRate: Math.round(m.win_rate),
    pips: Math.round(m.pips),
  }));

  // ── عملکرد هر نماد (تجمیع از سیگنال‌های بسته‌شدهٔ واقعی) ──
  const bySymbolMap = {};
  (recentData?.items || []).forEach((s) => {
    if (s.status === 'active' || s.pnl_pips == null) return;
    const k = dispSym(s.symbol);
    if (!bySymbolMap[k]) bySymbolMap[k] = { symbol: k, trades: 0, wins: 0, pips: 0 };
    bySymbolMap[k].trades += 1;
    if (Number(s.pnl_pips) > 0) bySymbolMap[k].wins += 1;
    bySymbolMap[k].pips += Number(s.pnl_pips) || 0;
  });
  const bySymbol = Object.values(bySymbolMap)
    .map((r) => ({
      ...r,
      pips: Math.round(r.pips),
      winRate: r.trades ? Math.round((r.wins / r.trades) * 100) : 0,
      avgPips: r.trades ? Number((r.pips / r.trades).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.pips - a.pips);

  const hasData = (stats.total_signals || 0) > 0;

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-black text-white mb-2">عملکرد و آمار</h1>
          <p className="text-dark-400 text-lg">آمارِ کاملاً واقعی و لحظه‌ایِ سیگنال‌ها — مستقیماً از دیتابیس پروژه</p>
        </motion.div>

        {/* Summary cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
        >
          {summaryCards.map((stat) => (
            <div key={stat.label} className="glass-card p-4 text-center">
              <div className={`text-xl lg:text-2xl font-black ${stat.color} mb-1`}>{stat.value}</div>
              <div className="text-dark-500 text-xs">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Equity Curve */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 mb-8"
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">منحنی رشد سرمایه</h2>
            <p className="text-dark-400 text-sm">روند موجودی فرضی بر اساس نتایج واقعی سیگنال‌ها</p>
          </div>
          {equityCurve.length > 1 ? (
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={equityCurve}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2979FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2979FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis dataKey="date" stroke="#737384" fontSize={10} />
                <YAxis stroke="#737384" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="equity" name="موجودی" stroke="#2979FF" strokeWidth={2} fill="url(#equityGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-dark-400 text-sm">
              داده‌ای برای نمایش منحنی موجود نیست
            </div>
          )}
        </motion.div>

        {/* Monthly Stats Table */}
        {monthly.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 mb-8"
        >
          <h2 className="text-xl font-bold text-white mb-6">آمار ماهانه</h2>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ماه</th>
                  <th>تعداد سیگنال</th>
                  <th>برد</th>
                  <th>باخت</th>
                  <th>نرخ برد</th>
                  <th>سود (پیپ)</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((row) => (
                  <tr key={row.month}>
                    <td className="font-medium text-white">{row.month}</td>
                    <td>{fa(row.signals)}</td>
                    <td className="text-bullish">{fa(row.wins)}</td>
                    <td className="text-bearish">{fa(row.losses)}</td>
                    <td>
                      <span className={`font-medium ${row.winRate >= 50 ? 'text-bullish' : 'text-yellow-500'}`}>
                        {fa(row.winRate)}%
                      </span>
                    </td>
                    <td className={`font-medium ${row.pips >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {row.pips >= 0 ? '+' : ''}{fa(row.pips)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Per-Symbol Performance */}
          {bySymbol.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <h2 className="text-xl font-bold text-white mb-6">عملکرد هر نماد</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bySymbol} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis type="number" stroke="#737384" fontSize={10} />
                <YAxis type="category" dataKey="symbol" stroke="#737384" fontSize={11} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="pips" name="سود (پیپ)" radius={[0, 4, 4, 0]}>
                  {bySymbol.map((entry, index) => (
                    <Cell key={index} fill={entry.pips >= 0 ? '#00C853' : '#FF1744'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 overflow-x-auto">
              <table className="data-table text-sm">
                <thead>
                  <tr>
                    <th>نماد</th>
                    <th>معاملات</th>
                    <th>نرخ برد</th>
                    <th>سود (پیپ)</th>
                    <th>میانگین</th>
                  </tr>
                </thead>
                <tbody>
                  {bySymbol.map((row) => (
                    <tr key={row.symbol}>
                      <td className="font-medium text-white">{row.symbol}</td>
                      <td>{fa(row.trades)}</td>
                      <td className={row.winRate >= 50 ? 'text-bullish' : 'text-yellow-500'}>{fa(row.winRate)}%</td>
                      <td className={row.pips >= 0 ? 'text-bullish' : 'text-bearish'}>{row.pips >= 0 ? '+' : ''}{fa(row.pips)}</td>
                      <td>{fa(row.avgPips, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
          )}

          {/* Drawdown Chart */}
          {drawdownSeries.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-6"
          >
            <h2 className="text-xl font-bold text-white mb-2">نمودار افت سرمایه</h2>
            <p className="text-dark-400 text-sm mb-6">افت موجودی از سقف تا کف (بر اساس نتایج واقعی)</p>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={drawdownSeries}>
                <defs>
                  <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF1744" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF1744" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis dataKey="date" stroke="#737384" fontSize={10} />
                <YAxis stroke="#737384" fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="drawdown" name="افت سرمایه (%)" stroke="#FF1744" strokeWidth={2} fill="url(#drawdownGrad)" />
              </AreaChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-dark-800/30 rounded-xl p-3 text-center">
                <div className="text-bearish font-bold text-lg">٪{fa(Math.abs(maxDD), 1)}−</div>
                <div className="text-dark-500 text-xs mt-1">حداکثر افت</div>
              </div>
              <div className="bg-dark-800/30 rounded-xl p-3 text-center">
                <div className="text-yellow-500 font-bold text-lg">٪{fa(Math.abs(avgDD), 1)}−</div>
                <div className="text-dark-500 text-xs mt-1">میانگین افت</div>
              </div>
            </div>
          </motion.div>
          )}
        </div>

        {/* Monthly Profit Bar Chart */}
        {monthly.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-6"
        >
          <h2 className="text-xl font-bold text-white mb-6">سود ماهانه (پیپ)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
              <XAxis dataKey="month" stroke="#737384" fontSize={10} />
              <YAxis stroke="#737384" fontSize={10} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pips" name="سود (پیپ)" radius={[4, 4, 0, 0]}>
                {monthly.map((entry, index) => (
                  <Cell key={index} fill={entry.pips >= 0 ? '#00C853' : '#FF1744'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
        )}

        {!hasData && (
          <div className="glass-card p-10 text-center text-dark-400">
            هنوز داده‌ای برای نمایش آمار ثبت نشده است.
          </div>
        )}
      </div>
    </div>
  );
}
