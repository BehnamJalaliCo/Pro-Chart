import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award, TrendingUp, TrendingDown, Activity, RefreshCw,
  Calendar, AlertTriangle, BarChart3,
} from 'lucide-react';
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { reportsAPI } from '../api/client';
import StatCard from '../components/common/StatCard';

const PERSIAN_MONTHS = [
  'ژانویه', 'فوریه', 'مارس', 'آپریل', 'می', 'ژوئن',
  'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر',
];

function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  const num = Number(v);
  if (Number.isNaN(num)) return '—';
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}٪`;
}

function fmtNum(v, d = 2) {
  if (v === null || v === undefined) return '—';
  const num = Number(v);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString('fa-IR', {
    minimumFractionDigits: d, maximumFractionDigits: d,
  });
}

function cellColor(pct) {
  if (pct === null || pct === undefined) return 'bg-surface-bg';
  const num = Number(pct);
  if (num > 5) return 'bg-bullish/30 text-bullish';
  if (num > 1) return 'bg-bullish/20 text-bullish';
  if (num > 0) return 'bg-bullish/10 text-bullish';
  if (num === 0) return 'bg-surface-hover text-text-muted';
  if (num > -1) return 'bg-bearish/10 text-bearish';
  if (num > -5) return 'bg-bearish/20 text-bearish';
  return 'bg-bearish/30 text-bearish';
}

// ── Advanced Metrics Panel ──
function AdvancedMetricsPanel({ days, symbol }) {
  const { data, isLoading } = useQuery({
    queryKey: ['adv-metrics', days, symbol],
    queryFn: () => reportsAPI.getAdvancedMetrics({ days, symbol: symbol || undefined })
      .then(r => r.data),
  });

  if (isLoading) return <div className="text-center py-8 text-text-muted">در حال بارگذاری...</div>;
  if (!data?.ok) return (
    <div className="bg-warning/10 border border-warning/30 rounded-xl p-6 text-center">
      <p className="text-warning">{data?.reason || 'داده کافی نیست'}</p>
    </div>
  );

  const m = data.metrics;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="MAR Ratio" value={fmtNum(m.mar_ratio, 2)} icon={Award} iconColor="text-bullish" />
        <StatCard title="Calmar" value={fmtNum(m.calmar_ratio, 2)} icon={TrendingUp} iconColor="text-brand-blue" />
        <StatCard title="Omega" value={fmtNum(m.omega_ratio, 2)} icon={Activity} iconColor="text-brand-purple" />
        <StatCard title="Tail Ratio" value={fmtNum(m.tail_ratio, 2)} icon={BarChart3} iconColor="text-warning" />
      </div>
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <h3 className="font-bold text-text-primary mb-4">آماره‌های توزیع</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Row label="Ulcer Index" value={fmtNum(m.ulcer_index, 4)} hint="penalty for prolonged DD" />
          <Row label="Skewness" value={fmtNum(m.skewness, 3)} hint="مثبت = right tail بزرگ‌تر" />
          <Row label="Excess Kurtosis" value={fmtNum(m.excess_kurtosis, 3)} hint="مثبت = fat tails" />
          <Row label="PSR" value={fmtPct((m.probabilistic_sharpe_ratio || 0) * 100)} hint="احتمال Sharpe > 0" />
          <Row label="DSR" value={fmtPct((m.deflated_sharpe_ratio || 0) * 100)} hint="با multiple testing تعدیل" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, hint }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-bold text-text-primary mt-1">{value}</p>
      {hint && <p className="text-[10px] text-text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Monthly Heatmap ──
function MonthlyHeatmapPanel({ symbol }) {
  const { data, isLoading } = useQuery({
    queryKey: ['heatmap', symbol],
    queryFn: () => reportsAPI.getMonthlyHeatmap({ years: 3, symbol: symbol || undefined })
      .then(r => r.data),
  });

  if (isLoading) return <div className="text-center py-8 text-text-muted">در حال بارگذاری...</div>;
  if (!data?.rows?.length) return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
      <p className="text-text-secondary">داده‌ای برای heatmap نیست</p>
    </div>
  );

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <h3 className="font-bold text-text-primary mb-4">Heatmap بازده ماهانه (٪)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-2 text-right text-text-muted">سال</th>
              {PERSIAN_MONTHS.map((m, i) => (
                <th key={i} className="px-2 py-2 text-center text-text-muted">
                  {m.slice(0, 3)}
                </th>
              ))}
              <th className="px-2 py-2 text-center text-text-muted font-bold">سال</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(row => (
              <tr key={row.year}>
                <td className="px-2 py-2 font-bold text-text-primary">{row.year}</td>
                {PERSIAN_MONTHS.map((_, i) => {
                  const m = i + 1;
                  const val = row.months[String(m)];
                  return (
                    <td key={m} className={`px-2 py-2 text-center font-medium ${cellColor(val)}`}>
                      {val !== undefined ? fmtPct(val) : '—'}
                    </td>
                  );
                })}
                <td className={`px-2 py-2 text-center font-bold ${cellColor(row.annual_return_pct)}`}>
                  {fmtPct(row.annual_return_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Rolling CAGR Chart ──
function RollingCagrPanel({ symbol }) {
  const { data, isLoading } = useQuery({
    queryKey: ['rolling-cagr', symbol],
    queryFn: () => reportsAPI.getRollingCagr({
      window_days: 365, step_days: 7, symbol: symbol || undefined,
    }).then(r => r.data),
  });

  if (isLoading) return <div className="text-center py-8 text-text-muted">در حال بارگذاری...</div>;
  if (!data?.points?.length) return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
      <p className="text-text-secondary">داده‌ای برای rolling CAGR نیست (نیاز به > ۱ سال داده)</p>
    </div>
  );

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <h3 className="font-bold text-text-primary mb-2">Rolling 12-Month CAGR</h3>
      <p className="text-xs text-text-muted mb-4">پنجره ۳۶۵ روز، گام ۷ روز</p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data.points}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v.toFixed(1)}٪`} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#cbd5e1' }}
            formatter={(v) => [`${Number(v).toFixed(2)}٪`, 'CAGR']}
          />
          <Area dataKey="value" stroke="#22c55e" fill="rgba(34,197,94,0.15)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Drawdown Periods Table ──
function DrawdownPeriodsPanel({ symbol }) {
  const { data, isLoading } = useQuery({
    queryKey: ['dd-periods', symbol],
    queryFn: () => reportsAPI.getDrawdownPeriods({
      min_dd_pct: 0.01, symbol: symbol || undefined,
    }).then(r => r.data),
  });

  if (isLoading) return <div className="text-center py-8 text-text-muted">در حال بارگذاری...</div>;
  const periods = data?.periods || [];
  if (!periods.length) return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
      <AlertTriangle size={40} className="mx-auto text-bullish mb-2" />
      <p className="text-text-secondary">هیچ drawdown قابل توجهی ثبت نشده</p>
    </div>
  );

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border">
        <h3 className="font-bold text-text-primary">دوره‌های Drawdown (worst-first)</h3>
        <p className="text-xs text-text-muted mt-1">حداقل ۱٪ DD</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-xs text-text-muted bg-surface-bg/50">
              <th className="py-3 px-4">peak</th>
              <th className="py-3 px-4">trough</th>
              <th className="py-3 px-4">recovery</th>
              <th className="py-3 px-4">DD ٪</th>
              <th className="py-3 px-4">DD $</th>
              <th className="py-3 px-4">duration</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((p, i) => (
              <tr key={i} className="border-t border-surface-border/50 hover:bg-surface-hover">
                <td className="py-3 px-4 text-xs text-text-muted">{p.peak_date}</td>
                <td className="py-3 px-4 text-xs text-bearish">{p.trough_date}</td>
                <td className="py-3 px-4 text-xs text-bullish">
                  {p.is_ongoing ? <span className="text-warning">در حال بازیابی</span> : p.recovery_date}
                </td>
                <td className="py-3 px-4 font-bold text-bearish">{fmtPct(-p.drawdown_pct)}</td>
                <td className="py-3 px-4 text-bearish">{fmtNum(p.drawdown_dollar, 2)}$</td>
                <td className="py-3 px-4 text-text-muted text-xs">
                  {p.duration_to_recovery_days
                    ? `${p.duration_to_recovery_days} روز`
                    : `${p.duration_to_trough_days} روز و در حال ادامه`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── صفحه‌ی اصلی ──
export default function ReportsPage() {
  const [symbol, setSymbol] = useState('');
  const [tab, setTab] = useState('metrics');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">گزارش‌های پیشرفته</h1>
          <p className="text-sm text-text-muted">institutional-grade metrics برای investor reporting</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            placeholder="نماد (مثل EURUSD) یا خالی برای همه"
            className="px-3 py-2 bg-surface-card border border-surface-border rounded-lg text-text-primary placeholder-text-muted text-sm w-64"
          />
        </div>
      </div>

      <div className="flex gap-2 border-b border-surface-border">
        {[
          { id: 'metrics', label: '📊 metrics پیشرفته', icon: Activity },
          { id: 'heatmap', label: '🔥 heatmap ماهانه', icon: Calendar },
          { id: 'rolling', label: '📈 rolling CAGR', icon: TrendingUp },
          { id: 'drawdown', label: '📉 drawdown periods', icon: TrendingDown },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t.id
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'metrics' && <AdvancedMetricsPanel days={365} symbol={symbol} />}
      {tab === 'heatmap' && <MonthlyHeatmapPanel symbol={symbol} />}
      {tab === 'rolling' && <RollingCagrPanel symbol={symbol} />}
      {tab === 'drawdown' && <DrawdownPeriodsPanel symbol={symbol} />}
    </div>
  );
}
