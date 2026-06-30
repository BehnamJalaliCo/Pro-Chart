import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { performanceAPI } from '../api/client';
import { TrendingUp, Target, Award, BarChart3 } from 'lucide-react';

const mockEquityCurve = Array.from({ length: 60 }, (_, i) => ({
  date: `روز ${i + 1}`,
  equity: 10000 + i * 85 + Math.random() * 200 - 100,
}));

const mockWinRateBySymbol = [
  { name: 'EUR/USD', winRate: 76, total: 120 },
  { name: 'GBP/JPY', winRate: 71, total: 85 },
  { name: 'XAU/USD', winRate: 68, total: 95 },
  { name: 'USD/JPY', winRate: 74, total: 110 },
  { name: 'BTC/USD', winRate: 65, total: 45 },
  { name: 'AUD/USD', winRate: 78, total: 60 },
  { name: 'EUR/GBP', winRate: 72, total: 40 },
  { name: 'NZD/USD', winRate: 69, total: 35 },
];

const mockWinRateByTimeframe = [
  { name: 'M15', winRate: 62, total: 200 },
  { name: 'M30', winRate: 68, total: 180 },
  { name: 'H1', winRate: 74, total: 150 },
  { name: 'H4', winRate: 79, total: 90 },
  { name: 'D1', winRate: 82, total: 50 },
];

const mockWinRateByDay = [
  { name: 'شنبه', winRate: 70 },
  { name: 'یکشنبه', winRate: 73 },
  { name: 'دوشنبه', winRate: 76 },
  { name: 'سه‌شنبه', winRate: 74 },
  { name: 'چهارشنبه', winRate: 72 },
  { name: 'پنجشنبه', winRate: 69 },
  { name: 'جمعه', winRate: 65 },
];

const mockHeatmap = [
  { symbol: 'EUR/USD', H1: 78, H4: 82, D1: 85 },
  { symbol: 'GBP/JPY', H1: 65, H4: 73, D1: 79 },
  { symbol: 'XAU/USD', H1: 60, H4: 71, D1: 76 },
  { symbol: 'USD/JPY', H1: 72, H4: 77, D1: 80 },
  { symbol: 'BTC/USD', H1: 55, H4: 64, D1: 70 },
  { symbol: 'AUD/USD', H1: 74, H4: 80, D1: 83 },
];

const mockMetrics = {
  profitFactor: 2.34,
  sharpeRatio: 1.87,
  maxDrawdown: 8.2,
  avgWin: 42.5,
  avgLoss: 28.3,
  totalTrades: 590,
  consecutiveWins: 12,
  consecutiveLosses: 4,
};

function MetricCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            color === 'blue'
              ? 'bg-brand-blue/15 text-brand-blue'
              : color === 'green'
              ? 'bg-brand-green/15 text-brand-green'
              : 'bg-brand-red/15 text-brand-red'
          }`}
        >
          <Icon size={16} />
        </div>
        <span className="text-xs text-text-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text-primary mt-2">{value}</p>
      {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
    </div>
  );
}

function HeatmapCell({ value }) {
  const getColor = (v) => {
    if (v >= 80) return 'bg-brand-green/30 text-brand-green';
    if (v >= 70) return 'bg-brand-green/15 text-brand-green';
    if (v >= 60) return 'bg-yellow-500/15 text-yellow-400';
    return 'bg-brand-red/15 text-brand-red';
  };

  return (
    <td className={`px-3 py-2 text-center text-sm font-medium border-t border-surface-border`}>
      <span className={`inline-block px-2 py-1 rounded-md ${getColor(value)}`}>{value}٪</span>
    </td>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
        </p>
      ))}
    </div>
  );
}

export default function PerformancePage() {
  const [period, setPeriod] = useState('30');

  const { data: equityData } = useQuery({
    queryKey: ['performance-equity', period],
    queryFn: () => performanceAPI.getEquityCurve({ days: period }).then((r) => r.data),
    placeholderData: mockEquityCurve,
  });

  const { data: winRateData } = useQuery({
    queryKey: ['performance-winrate'],
    queryFn: () => performanceAPI.getWinRate({}).then((r) => r.data),
    placeholderData: {
      bySymbol: mockWinRateBySymbol,
      byTimeframe: mockWinRateByTimeframe,
      byDay: mockWinRateByDay,
    },
  });

  const { data: heatmapData } = useQuery({
    queryKey: ['performance-heatmap'],
    queryFn: () => performanceAPI.getHeatmap().then((r) => r.data),
    placeholderData: mockHeatmap,
  });

  const { data: metricsData } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: () => performanceAPI.getMetrics().then((r) => r.data),
    placeholderData: mockMetrics,
  });

  const equity = equityData || mockEquityCurve;
  const winRate = winRateData || { bySymbol: mockWinRateBySymbol, byTimeframe: mockWinRateByTimeframe, byDay: mockWinRateByDay };
  const heatmap = heatmapData || mockHeatmap;
  const metrics = metricsData || mockMetrics;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">عملکرد</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="text-sm min-w-[120px]"
        >
          <option value="7">۷ روز</option>
          <option value="30">۳۰ روز</option>
          <option value="90">۹۰ روز</option>
          <option value="365">۱ سال</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={TrendingUp}
          label="ضریب سود"
          value={metrics.profitFactor}
          sub="Profit Factor"
          color="green"
        />
        <MetricCard
          icon={Award}
          label="نسبت شارپ"
          value={metrics.sharpeRatio}
          sub="Sharpe Ratio"
          color="blue"
        />
        <MetricCard
          icon={BarChart3}
          label="حداکثر افت"
          value={`${metrics.maxDrawdown}٪`}
          sub="Max Drawdown"
          color="red"
        />
        <MetricCard
          icon={Target}
          label="کل معاملات"
          value={metrics.totalTrades}
          sub={`میانگین برد: ${metrics.avgWin} | میانگین باخت: ${metrics.avgLoss}`}
          color="blue"
        />
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-4">منحنی سرمایه</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={equity}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00C853" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" />
            <XAxis
              dataKey="date"
              tick={{ fill: '#636882', fontSize: 10 }}
              axisLine={{ stroke: '#2a2e3d' }}
            />
            <YAxis tick={{ fill: '#636882', fontSize: 10 }} axisLine={{ stroke: '#2a2e3d' }} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="equity"
              stroke="#00C853"
              strokeWidth={2}
              dot={false}
              name="سرمایه ($)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">نرخ برد بر اساس نماد</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={winRate.bySymbol} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: '#636882', fontSize: 10 }}
                axisLine={{ stroke: '#2a2e3d' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#9499ae', fontSize: 11 }}
                axisLine={{ stroke: '#2a2e3d' }}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="winRate" name="نرخ برد (٪)" radius={[0, 4, 4, 0]} barSize={18}>
                {(winRate.bySymbol || []).map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.winRate >= 70 ? '#00C853' : entry.winRate >= 60 ? '#FFC107' : '#FF1744'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">نرخ برد بر اساس تایم‌فریم</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={winRate.byTimeframe}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9499ae', fontSize: 11 }}
                axisLine={{ stroke: '#2a2e3d' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#636882', fontSize: 10 }}
                axisLine={{ stroke: '#2a2e3d' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="winRate" name="نرخ برد (٪)" fill="#2979FF" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">نرخ برد بر اساس روز هفته</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={winRate.byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#9499ae', fontSize: 10 }}
                axisLine={{ stroke: '#2a2e3d' }}
              />
              <YAxis
                domain={[50, 100]}
                tick={{ fill: '#636882', fontSize: 10 }}
                axisLine={{ stroke: '#2a2e3d' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="winRate" name="نرخ برد (٪)" radius={[4, 4, 0, 0]} barSize={28}>
                {(winRate.byDay || []).map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.winRate >= 73 ? '#00C853' : entry.winRate >= 68 ? '#2979FF' : '#FF1744'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">نقشه حرارتی نرخ برد</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>نماد</th>
                  <th className="text-center">H1</th>
                  <th className="text-center">H4</th>
                  <th className="text-center">D1</th>
                </tr>
              </thead>
              <tbody>
                {heatmap.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-medium text-text-primary text-sm">{row.symbol}</td>
                    <HeatmapCell value={row.H1} />
                    <HeatmapCell value={row.H4} />
                    <HeatmapCell value={row.D1} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-center gap-4 mt-4 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-brand-red/30" />
              <span className="text-text-muted">کمتر از ۶۰٪</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-yellow-500/30" />
              <span className="text-text-muted">۶۰-۷۰٪</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-brand-green/20" />
              <span className="text-text-muted">۷۰-۸۰٪</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-brand-green/40" />
              <span className="text-text-muted">بیشتر از ۸۰٪</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-4">آمار تکمیلی</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatItem label="میانگین سود (پیپ)" value={metrics.avgWin} color="green" />
          <StatItem label="میانگین ضرر (پیپ)" value={metrics.avgLoss} color="red" />
          <StatItem label="بیشترین بردهای متوالی" value={metrics.consecutiveWins} color="blue" />
          <StatItem label="بیشترین باخت‌های متوالی" value={metrics.consecutiveLosses} color="red" />
        </div>
      </div>
    </div>
  );
}

function StatItem({ label, value, color }) {
  const colorClass =
    color === 'green'
      ? 'text-brand-green'
      : color === 'red'
      ? 'text-brand-red'
      : 'text-brand-blue';

  return (
    <div className="bg-surface-elevated rounded-lg p-3">
      <p className="text-[11px] text-text-muted mb-1">{label}</p>
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
