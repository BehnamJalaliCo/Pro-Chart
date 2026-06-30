import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Percent, Activity } from 'lucide-react';
import { userAPI } from '../api/client';
import { Stat } from './ui';

const faNum = (v, d = 0) => v == null ? '—' : Number(v).toLocaleString('fa-IR', { maximumFractionDigits: d });

export default function PerformanceSection() {
  const { data: eq } = useQuery({ queryKey: ['equityCurve'], queryFn: () => userAPI.equityCurve(90) });
  const { data: perf } = useQuery({ queryKey: ['perfSummary'], queryFn: () => userAPI.perfSummary() });

  const curve = (eq?.curve || []).map((p, i) => ({ i, balance: p.balance, date: p.date }));
  const ret = eq?.return_pct;
  const dd = eq?.max_drawdown_pct;
  const profit = eq?.total_profit;
  const wr = perf?.overall?.win_rate;
  const monthPips = perf?.this_month?.total_pips;
  const weekPips = perf?.this_week?.total_pips;

  const up = (ret ?? 0) >= 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity size={18} className="text-brand-green" />
        <h3 className="font-bold text-text-primary">عملکردِ راهبردِ ما</h3>
        <span className="text-[11px] text-text-muted ms-auto">۹۰ روزِ اخیر · دادهٔ واقعی</span>
      </div>

      {/* منحنیِ اکوییتی */}
      <div className="card p-4">
        {curve.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={curve} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00C853" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00C853" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
              <XAxis dataKey="i" hide />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} width={48}
                domain={['auto', 'auto']} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 12, fontSize: 12, color: 'var(--text-primary)' }}
                labelFormatter={() => ''}
                formatter={(v) => [`${Number(v).toLocaleString('en-US')} $`, 'موجودی']} />
              <Area type="monotone" dataKey="balance" stroke="#00C853" strokeWidth={2} fill="url(#eqg)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-text-muted text-sm text-center py-12">داده‌ای برای نمایشِ منحنی موجود نیست.</p>
        )}
      </div>

      {/* متریک‌ها */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="بازده (۹۰ روز)" value={ret == null ? '—' : `${up ? '+' : ''}${faNum(ret, 1)}٪`} tone={up ? 'text-brand-green' : 'text-brand-red'} />
        <Stat label="بیشینهٔ افتِ سرمایه" value={dd == null ? '—' : `${faNum(dd, 1)}٪`} tone="text-brand-amber" />
        <Stat label="نرخِ موفقیت" value={wr == null ? '—' : `${faNum(wr, 1)}٪`} tone="text-brand-green" />
        <Stat label="پیپِ این ماه" value={monthPips == null ? '—' : `${monthPips >= 0 ? '+' : ''}${faNum(monthPips, 0)}`} tone={monthPips >= 0 ? 'text-brand-blue' : 'text-brand-red'} />
      </div>
    </div>
  );
}
