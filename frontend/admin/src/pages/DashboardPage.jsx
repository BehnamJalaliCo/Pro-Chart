import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { dashboardAPI } from '../api/client';
import { Users, Signal, TrendingUp, DollarSign, Activity } from 'lucide-react';

const mockStats = {
  totalUsers: 2847,
  signalsToday: 12,
  winRate: 73.5,
  totalProfit: 14520,
};

const mockSignalChart = Array.from({ length: 30 }, (_, i) => ({
  date: `${i + 1} بهمن`,
  signals: Math.floor(Math.random() * 15) + 5,
  wins: Math.floor(Math.random() * 12) + 3,
}));

const mockUserGrowth = Array.from({ length: 30 }, (_, i) => ({
  date: `${i + 1} بهمن`,
  users: 2500 + i * Math.floor(Math.random() * 20 + 5),
}));

const mockServices = [
  { name: 'موتور سیگنال', status: 'online', uptime: '۹۹.۹٪' },
  { name: 'ربات تلگرام', status: 'online', uptime: '۹۹.۸٪' },
  { name: 'مدل‌های ML', status: 'online', uptime: '۹۹.۵٪' },
  { name: 'دیتافید', status: 'warning', uptime: '۹۸.۲٪' },
  { name: 'پایگاه داده', status: 'online', uptime: '۹۹.۹٪' },
  { name: 'Redis Cache', status: 'online', uptime: '۹۹.۹٪' },
];

const mockActiveSignals = [
  {
    id: 1,
    symbol: 'EUR/USD',
    type: 'BUY',
    entry: 1.0852,
    tp: 1.092,
    sl: 1.081,
    pnl: +45,
    time: '۱۰:۳۲',
  },
  {
    id: 2,
    symbol: 'GBP/JPY',
    type: 'SELL',
    entry: 190.45,
    tp: 189.8,
    sl: 191.0,
    pnl: -12,
    time: '۱۱:۱۵',
  },
  {
    id: 3,
    symbol: 'XAU/USD',
    type: 'BUY',
    entry: 2035.5,
    tp: 2055.0,
    sl: 2025.0,
    pnl: +78,
    time: '۰۹:۴۵',
  },
  {
    id: 4,
    symbol: 'USD/JPY',
    type: 'SELL',
    entry: 149.32,
    tp: 148.5,
    sl: 149.9,
    pnl: +23,
    time: '۱۲:۰۰',
  },
  {
    id: 5,
    symbol: 'BTC/USD',
    type: 'BUY',
    entry: 43250,
    tp: 44500,
    sl: 42800,
    pnl: +156,
    time: '۰۸:۲۰',
  },
];

function StatCard({ icon: Icon, label, value, change, color }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            color === 'blue'
              ? 'bg-brand-blue/15 text-brand-blue'
              : color === 'green'
              ? 'bg-brand-green/15 text-brand-green'
              : color === 'red'
              ? 'bg-brand-red/15 text-brand-red'
              : 'bg-surface-elevated text-text-secondary'
          }`}
        >
          <Icon size={20} />
        </div>
        {change !== undefined && (
          <span
            className={`text-xs font-medium ${change >= 0 ? 'text-brand-green' : 'text-brand-red'}`}
          >
            {change >= 0 ? '+' : ''}
            {change}٪
          </span>
        )}
      </div>
      <div className="mt-1">
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-text-muted mb-1">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: statsData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardAPI.getStats().then((r) => r.data),
    placeholderData: mockStats,
  });

  const { data: signalChartData } = useQuery({
    queryKey: ['dashboard-signal-chart'],
    queryFn: () => dashboardAPI.getSignalChart().then((r) => r.data),
    placeholderData: mockSignalChart,
  });

  const { data: userGrowthData } = useQuery({
    queryKey: ['dashboard-user-growth'],
    queryFn: () => dashboardAPI.getUserGrowth().then((r) => r.data),
    placeholderData: mockUserGrowth,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['dashboard-services'],
    queryFn: () => dashboardAPI.getServiceStatus().then((r) => r.data),
    placeholderData: mockServices,
    refetchInterval: 30000,
  });

  const { data: activeSignalsData } = useQuery({
    queryKey: ['dashboard-active-signals'],
    queryFn: () => dashboardAPI.getActiveSignals().then((r) => r.data),
    placeholderData: mockActiveSignals,
    refetchInterval: 15000,
  });

  const stats = statsData || mockStats;
  const signalChart = signalChartData || mockSignalChart;
  const userGrowth = userGrowthData || mockUserGrowth;
  const services = servicesData || mockServices;
  const activeSignals = activeSignalsData || mockActiveSignals;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-text-primary">داشبورد</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="کل کاربران"
          value={stats.totalUsers?.toLocaleString('fa-IR')}
          change={5.2}
          color="blue"
        />
        <StatCard
          icon={Signal}
          label="سیگنال‌های امروز"
          value={stats.signalsToday?.toLocaleString('fa-IR')}
          change={12}
          color="green"
        />
        <StatCard
          icon={TrendingUp}
          label="نرخ برد"
          value={`${stats.winRate}٪`}
          change={2.1}
          color="green"
        />
        <StatCard
          icon={DollarSign}
          label="سود کل (پیپ)"
          value={stats.totalProfit?.toLocaleString('fa-IR')}
          change={8.7}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">سیگنال‌ها - ۳۰ روز اخیر</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={signalChart}>
              <defs>
                <linearGradient id="signalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2979FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2979FF" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="winsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C853" stopOpacity={0.3} />
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
              <Area
                type="monotone"
                dataKey="signals"
                stroke="#2979FF"
                fill="url(#signalGrad)"
                strokeWidth={2}
                name="کل سیگنال"
              />
              <Area
                type="monotone"
                dataKey="wins"
                stroke="#00C853"
                fill="url(#winsGrad)"
                strokeWidth={2}
                name="سیگنال برنده"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">رشد کاربران</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={userGrowth}>
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
                dataKey="users"
                stroke="#2979FF"
                strokeWidth={2}
                dot={false}
                name="کاربران"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-1">
          <h3 className="text-sm font-semibold text-text-primary mb-4">وضعیت سرویس‌ها</h3>
          <div className="space-y-3">
            {services.map((svc, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 border-b border-surface-border last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      svc.status === 'online'
                        ? 'bg-brand-green shadow-[0_0_6px_rgba(0,200,83,0.5)]'
                        : svc.status === 'warning'
                        ? 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]'
                        : 'bg-brand-red shadow-[0_0_6px_rgba(255,23,68,0.5)]'
                    }`}
                  />
                  <span className="text-sm text-text-primary">{svc.name}</span>
                </div>
                <span className="text-xs text-text-muted">{svc.uptime}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">سیگنال‌های فعال</h3>
            <div className="flex items-center gap-1.5">
              <Activity size={14} className="text-brand-green" />
              <span className="text-xs text-text-muted">
                {activeSignals.length} سیگنال فعال
              </span>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>نماد</th>
                  <th>نوع</th>
                  <th>ورود</th>
                  <th>TP</th>
                  <th>SL</th>
                  <th>سود/ضرر</th>
                  <th>زمان</th>
                </tr>
              </thead>
              <tbody>
                {activeSignals.map((sig) => (
                  <tr key={sig.id}>
                    <td className="font-medium text-text-primary">{sig.symbol}</td>
                    <td>
                      <span
                        className={`badge ${
                          sig.type === 'BUY' ? 'badge-green' : 'badge-red'
                        }`}
                      >
                        {sig.type === 'BUY' ? 'خرید' : 'فروش'}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{sig.entry}</td>
                    <td className="font-mono text-xs text-brand-green">{sig.tp}</td>
                    <td className="font-mono text-xs text-brand-red">{sig.sl}</td>
                    <td>
                      <span
                        className={`font-medium text-sm ${
                          sig.pnl >= 0 ? 'text-brand-green' : 'text-brand-red'
                        }`}
                      >
                        {sig.pnl >= 0 ? '+' : ''}
                        {sig.pnl}
                      </span>
                    </td>
                    <td className="text-text-muted text-xs">{sig.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
