import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { userAPI } from '../api/client';
import { Stat, Spinner } from './ui';

const fa = (n, d = 2) => (n ?? 0).toLocaleString('fa-IR', { maximumFractionDigits: d });
const money = (n) => `${n >= 0 ? '+' : ''}${fa(n)}$`;
const RANGES = [{ d: 7, l: '۷ روز' }, { d: 30, l: '۳۰ روز' }, { d: 90, l: '۹۰ روز' }];
const REASONS = { sl: 'حد ضرر', tp: 'حد سود', breakeven: 'سربه‌سر', manual: 'دستی', stopout: 'استاپ‌اوت' };
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('fa-IR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default function PnlHistory() {
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const { data: stats } = useQuery({ queryKey: ['u-th-stats', days], queryFn: () => userAPI.tradeStats(days).then(r => r.data), refetchInterval: 30000 });
  const { data: list } = useQuery({ queryKey: ['u-th-list', page], queryFn: () => userAPI.tradeHistory({ page, per_page: 30 }).then(r => r.data), refetchInterval: 20000, keepPreviousData: true });

  const s = stats || {};
  const net = s.net ?? 0;
  const netTone = net >= 0 ? 'text-brand-green' : 'text-brand-red';
  const netColor = net >= 0 ? '#16a34a' : '#dc2626';
  const curve = (s.equity_curve || []).map((p, i) => ({ i, equity: p.equity }));
  const items = list?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-black text-text-primary">سود و زیانِ واقعی (حسابِ شما)</h2>
        <div className="flex gap-1 bg-bg-soft rounded-lg p-1">
          {RANGES.map(r => (
            <button key={r.d} onClick={() => setDays(r.d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${days === r.d ? 'bg-brand-blue text-white' : 'text-text-muted'}`}>{r.l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="سود/زیانِ خالص" value={money(net)} tone={netTone}
          sub={`کمیسیون ${fa(s.commission)} · سواپ ${fa(s.swap)}`} />
        <Stat label="نرخِ برد" value={`${fa(s.win_rate, 1)}٪`} sub={`${fa(s.wins, 0)} برد / ${fa(s.losses, 0)} باخت`} />
        <Stat label="Profit Factor" value={fa(s.profit_factor, 2)} sub={`${fa(s.trades, 0)} معامله`} />
        <Stat label="بیشترین افت" value={money(s.max_drawdown)} tone="text-brand-amber" sub={`بهترین ${money(s.best)}`} />
      </div>

      {curve.length > 1 && (
        <div className="card p-4">
          <div className="text-sm font-bold text-text-primary mb-3">منحنیِ سرمایه</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={curve}>
              <defs>
                <linearGradient id="ueq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={netColor} stopOpacity={0.3} /><stop offset="95%" stopColor={netColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="i" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="2 2" />
              <Area type="monotone" dataKey="equity" name="سرمایه" stroke={netColor} fill="url(#ueq)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted border-b border-border">
                {['زمان', 'نماد', 'جهت', 'حجم', 'کمیسیون', 'سواپ', 'خالص', 'علت'].map(h => (
                  <th key={h} className="text-right font-medium py-2.5 px-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className="border-b border-border/40">
                  <td className="py-2 px-3 text-text-muted whitespace-nowrap">{fmtTime(t.close_time)}</td>
                  <td className="py-2 px-3 text-text-primary font-medium">{t.symbol}</td>
                  <td className={`py-2 px-3 ${t.direction === 'buy' ? 'text-brand-green' : 'text-brand-red'}`}>{t.direction === 'buy' ? 'خرید' : 'فروش'}</td>
                  <td className="py-2 px-3 text-text-muted">{fa(t.volume)}</td>
                  <td className="py-2 px-3 text-text-muted">{fa(t.commission)}</td>
                  <td className="py-2 px-3 text-text-muted">{fa(t.swap)}</td>
                  <td className={`py-2 px-3 font-bold ${t.net_profit >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{money(t.net_profit)}</td>
                  <td className="py-2 px-3"><span className="px-1.5 py-0.5 rounded text-[11px] bg-bg-soft text-text-muted">{REASONS[t.close_reason] || t.close_reason || '—'}</span></td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-text-muted">
                  هنوز معاملهٔ بسته‌شده‌ای ندارید. (پس از فعال‌شدنِ کپی و بسته‌شدنِ معاملات، اینجا زنده می‌شود)
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {list && list.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg bg-bg-soft text-text-muted text-xs disabled:opacity-40">قبلی</button>
            <span className="text-text-muted text-xs">{fa(page, 0)} / {fa(list.total_pages, 0)}</span>
            <button disabled={page >= list.total_pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg bg-bg-soft text-text-muted text-xs disabled:opacity-40">بعدی</button>
          </div>
        )}
      </div>
    </div>
  );
}
