import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { backtestAPI } from '../api/client';
import useSeo from '../hooks/useSeo';

const PRESETS = [500, 1000, 5000, 10000];
const fa = (n) => Number(n || 0).toLocaleString('fa-IR');
const usd = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}$`;

function StatCard({ label, value, cls = 'text-white', sub }) {
  return (
    <div className="glass-card p-4">
      <div className="text-dark-400 text-xs mb-1">{label}</div>
      <div className={`text-xl lg:text-2xl font-black ${cls}`}>{value}</div>
      {sub && <div className="text-dark-500 text-xs mt-1">{sub}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-dark-900/95 border border-dark-700 rounded-lg px-3 py-2 text-xs">
      <div className="text-white font-bold">{usd(p.balance)}</div>
      <div className="text-dark-400">معاملهٔ {fa(p.i)}</div>
    </div>
  );
}

export default function BacktestPage() {
  useSeo({
    title: 'بک‌تست سیگنال‌ها — چقدر سود می‌کردی؟',
    description: 'با وارد کردن سرمایهٔ دلخواه ببین اگر از ابتدا تمام سیگنال‌های کوین پرو FX را دنبال کرده بودی، اکنون چقدر سود کرده بودی.',
    path: '/backtest',
  });

  const [capital, setCapital] = useState(1000);
  const [riskPct, setRiskPct] = useState(2);

  const mut = useMutation({
    mutationFn: () => backtestAPI.simulate({ capital: Number(capital), risk_pct: Number(riskPct) }),
  });
  const r = mut.data;
  const profitUp = r && r.profit >= 0;

  return (
    <div className="min-h-screen py-8 lg:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <h1 className="text-3xl lg:text-4xl font-black text-white mb-2">بک‌تست سیگنال‌ها</h1>
          <p className="text-dark-400 text-lg max-w-2xl mx-auto leading-8">
            اگر از همان ابتدا تمام سیگنال‌های ما را دنبال کرده بودی، حالا سرمایه‌ات چقدر شده بود؟
            مبلغ و درصد ریسک را انتخاب کن و روی نتایجِ واقعیِ سیگنال‌ها شبیه‌سازی کن.
          </p>
        </motion.div>

        {/* Input card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }} className="glass-card p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Capital */}
            <div>
              <label className="block text-sm text-dark-300 mb-2 font-medium">سرمایهٔ اولیه (دلار)</label>
              <input type="number" min={100} step={100} value={capital}
                onChange={(e) => setCapital(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700 text-white text-lg font-bold rounded-xl px-4 py-3 focus:border-accent focus:outline-none" />
              <div className="flex flex-wrap gap-2 mt-3">
                {PRESETS.map((p) => (
                  <button key={p} onClick={() => setCapital(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      Number(capital) === p ? 'bg-accent text-white' : 'bg-dark-800 text-dark-400 hover:text-white'}`}>
                    {usd(p)}
                  </button>
                ))}
              </div>
            </div>
            {/* Risk */}
            <div>
              <label className="block text-sm text-dark-300 mb-2 font-medium">
                ریسک در هر معامله: <span className="text-accent font-bold">{fa(riskPct)}٪</span>
              </label>
              <input type="range" min={0.5} max={5} step={0.5} value={riskPct}
                onChange={(e) => setRiskPct(e.target.value)}
                className="w-full accent-accent mt-3" />
              <div className="flex justify-between text-dark-500 text-xs mt-1">
                <span>محافظه‌کار (۰.۵٪)</span><span>تهاجمی (۵٪)</span>
              </div>
              <p className="text-dark-500 text-xs mt-3 leading-6">
                در هر سیگنال همین درصد از سرمایهٔ لحظه‌ای ریسک می‌شود (سرمایهٔ مرکب).
              </p>
            </div>
          </div>

          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="w-full mt-6 py-3.5 bg-accent text-white rounded-xl font-bold text-lg hover:bg-accent/90 disabled:opacity-60 transition-colors">
            {mut.isPending ? 'در حال محاسبه…' : 'محاسبهٔ سود'}
          </button>
          {mut.isError && (
            <p className="text-bearish text-sm mt-3 text-center">
              {mut.error?.message || 'محاسبه ناموفق بود.'}
            </p>
          )}
        </motion.div>

        {/* Results */}
        {r && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {r.total_trades === 0 ? (
              <div className="glass-card p-10 text-center text-dark-400">
                هنوز سیگنالِ بسته‌شدهٔ کافی برای بک‌تست وجود ندارد.
              </div>
            ) : (
              <>
                {/* Hero result */}
                <div className={`glass-card p-6 mb-6 text-center ${profitUp ? 'glow-bullish' : 'glow-bearish'}`}>
                  <div className="text-dark-400 text-sm mb-1">سرمایهٔ نهایی</div>
                  <div className={`text-4xl lg:text-5xl font-black ${profitUp ? 'text-bullish' : 'text-bearish'}`}>
                    {usd(r.final_capital)}
                  </div>
                  <div className={`text-lg font-bold mt-2 ${profitUp ? 'text-bullish' : 'text-bearish'}`}>
                    {profitUp ? '▲ +' : '▼ '}{fa(r.total_return_pct)}٪
                    <span className="text-dark-400 font-normal text-sm mr-2">
                      ({profitUp ? '+' : ''}{usd(r.profit)} از {usd(r.initial_capital)})
                    </span>
                  </div>
                  {r.blown && (
                    <div className="text-bearish text-sm mt-3">
                      ⚠️ با این درصدِ ریسک، حساب در میانهٔ مسیر صفر شد. درصد ریسک را کمتر کن.
                    </div>
                  )}
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <StatCard label="تعداد معاملات" value={fa(r.total_trades)} />
                  <StatCard label="نرخ برد" value={`${fa(r.win_rate)}٪`} cls="text-bullish"
                    sub={`${fa(r.wins)} برد / ${fa(r.losses)} باخت`} />
                  <StatCard label="بیشترین افت سرمایه" value={`${fa(r.max_drawdown_pct)}٪`} cls="text-yellow-500" />
                  <StatCard label="ضریب سود" value={r.profit_factor != null ? fa(r.profit_factor) : '—'}
                    cls="text-accent" />
                </div>

                {/* Equity curve */}
                <div className="glass-card p-5 mb-6">
                  <h3 className="text-white font-bold mb-4">رشد سرمایه</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={r.equity_curve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={profitUp ? '#22c55e' : '#ef4444'} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={profitUp ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="i" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false}
                          tickFormatter={(v) => `${(v / 1000).toFixed(v >= 1000 ? 0 : 1)}k`} width={45} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="balance" stroke={profitUp ? '#22c55e' : '#ef4444'}
                          strokeWidth={2} fill="url(#eq)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Trades table */}
                <div className="glass-card p-5">
                  <h3 className="text-white font-bold mb-4">آخرین معاملات شبیه‌سازی‌شده</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-dark-400 text-xs border-b border-dark-800">
                          <th className="text-right py-2 font-medium">نماد</th>
                          <th className="text-right py-2 font-medium">جهت</th>
                          <th className="text-right py-2 font-medium">R</th>
                          <th className="text-right py-2 font-medium">سود/زیان</th>
                          <th className="text-right py-2 font-medium">موجودی</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.trades.slice(-25).reverse().map((t, i) => (
                          <tr key={i} className="border-b border-dark-800/50">
                            <td className="py-2 text-white font-medium">{t.symbol}</td>
                            <td className="py-2">
                              <span className={t.direction === 'long' || t.direction === 'buy' ? 'text-bullish' : 'text-bearish'}>
                                {t.direction === 'long' || t.direction === 'buy' ? 'خرید' : 'فروش'}
                              </span>
                            </td>
                            <td className={`py-2 font-mono ${t.r_multiple >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {t.r_multiple >= 0 ? '+' : ''}{fa(t.r_multiple)}
                            </td>
                            <td className={`py-2 font-mono ${t.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {t.pnl >= 0 ? '+' : ''}{usd(t.pnl)}
                            </td>
                            <td className="py-2 text-dark-300 font-mono">{usd(t.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="text-dark-500 text-xs text-center mt-6 leading-6">
                  این شبیه‌سازی بر اساس نتیجهٔ واقعیِ سیگنال‌های بسته‌شده است و تضمینی برای عملکرد آینده نیست.
                  معاملات با ریسک همراه‌اند.
                </p>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
