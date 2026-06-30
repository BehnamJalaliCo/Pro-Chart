import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Percent, Activity, DollarSign, Layers, Download, Trash2, Scale,
} from 'lucide-react';
import { tradeHistoryAPI } from '../api/client';

const fa = (n, d = 2) => (n ?? 0).toLocaleString('fa-IR', { minimumFractionDigits: 0, maximumFractionDigits: d });
const money = (n) => `${n >= 0 ? '+' : ''}${fa(n)}$`;
const RANGES = [{ d: 1, l: 'امروز' }, { d: 7, l: '۷ روز' }, { d: 30, l: '۳۰ روز' }, { d: 90, l: '۹۰ روز' }];
const REASONS = { sl: 'حد ضرر', tp: 'حد سود', breakeven: 'سربه‌سر', manual: 'دستی', stopout: 'استاپ‌اوت' };
const fmtDur = (s) => {
  if (!s) return '—';
  if (s < 3600) return `${Math.round(s / 60)}د`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}س`;
  return `${(s / 86400).toFixed(1)}ر`;
};
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('fa-IR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

function Stat({ icon: Icon, label, value, color = '#2979FF', sub }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-secondary text-xs mb-1">{label}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          {sub && <p className="text-text-secondary text-[11px] mt-1">{sub}</p>}
        </div>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${color}1a`, color }}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

export default function TradeHistoryPage() {
  const qc = useQueryClient();
  const [uid, setUid] = useState(0);
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [symbol, setSymbol] = useState('');
  const [result, setResult] = useState('');
  const [reason, setReason] = useState('');

  const params = { uid, days };
  const { data: stats } = useQuery({ queryKey: ['th-stats', uid, days], queryFn: () => tradeHistoryAPI.stats(params).then(r => r.data), refetchInterval: 30000 });
  const { data: daily } = useQuery({ queryKey: ['th-daily', uid, days], queryFn: () => tradeHistoryAPI.daily(params).then(r => r.data), refetchInterval: 30000 });
  const listParams = { uid, page, per_page: 50, ...(symbol && { symbol }), ...(result && { result }), ...(reason && { reason }) };
  const { data: list } = useQuery({ queryKey: ['th-list', listParams], queryFn: () => tradeHistoryAPI.list(listParams).then(r => r.data), refetchInterval: 20000, keepPreviousData: true });

  const s = stats || {};
  const netColor = (s.net ?? 0) >= 0 ? '#00C853' : '#F44336';
  const curve = (s.equity_curve || []).map((p, i) => ({ i, equity: p.equity }));
  const dailyBars = (daily?.items || []).map(d => ({
    label: new Date(d.date).toLocaleDateString('fa-IR', { month: 'numeric', day: 'numeric' }),
    net: d.net, wins: d.wins, losses: d.losses,
  }));
  const symbols = [...new Set((list?.items || []).map(t => t.symbol))];

  const doClear = async () => {
    if (!window.confirm('کلِ تاریخچهٔ این حساب پاک شود؟ این عمل برگشت‌ناپذیر است.')) return;
    await tradeHistoryAPI.clear({ uid });
    qc.invalidateQueries({ queryKey: ['th-list'] });
    qc.invalidateQueries({ queryKey: ['th-stats'] });
    qc.invalidateQueries({ queryKey: ['th-daily'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-text-primary">تاریخچهٔ سود و زیان</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={uid} onChange={e => setUid(Number(e.target.value))}
            className="bg-bg-tertiary text-text-primary text-xs rounded-lg px-3 py-2 border border-border">
            <option value={0}>حساب مَستر</option>
          </select>
          <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
            {RANGES.map(r => (
              <button key={r.d} onClick={() => setDays(r.d)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${days === r.d ? 'bg-accent-blue text-white' : 'text-text-secondary hover:text-text-primary'}`}>{r.l}</button>
            ))}
          </div>
          <a href={tradeHistoryAPI.exportUrl(uid)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary text-xs hover:text-text-primary">
            <Download size={14} /> CSV
          </a>
          <button onClick={doClear} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent-red/10 text-accent-red text-xs hover:bg-accent-red/20">
            <Trash2 size={14} /> پاک‌کردن
          </button>
        </div>
      </div>

      {/* کارت‌های کلیدی */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={DollarSign} label="سود/زیانِ خالص" value={money(s.net)} color={netColor}
          sub={`ناخالص ${money(s.gross)} · کمیسیون ${fa(s.commission)} · سواپ ${fa(s.swap)}`} />
        <Stat icon={Percent} label="نرخِ برد" value={`${fa(s.win_rate, 1)}٪`} color="#2979FF"
          sub={`${fa(s.wins, 0)} برد / ${fa(s.losses, 0)} باخت`} />
        <Stat icon={Scale} label="Profit Factor" value={fa(s.profit_factor, 2)} color="#9C27B0"
          sub={`انتظار/معامله ${money(s.expectancy)}`} />
        <Stat icon={TrendingDown} label="بیشترین افتِ سرمایه" value={money(s.max_drawdown)} color="#FF9800"
          sub={`${fa(s.trades, 0)} معامله · بهترین ${money(s.best)}`} />
      </div>

      {/* منحنیِ equity + جمعِ روزانه */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">منحنیِ سرمایه (تجمعی)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={curve}>
              <defs>
                <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={netColor} stopOpacity={0.3} /><stop offset="95%" stopColor={netColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" />
              <XAxis dataKey="i" tick={{ fill: '#636882', fontSize: 10 }} axisLine={{ stroke: '#2a2e3d' }} />
              <YAxis tick={{ fill: '#636882', fontSize: 10 }} axisLine={{ stroke: '#2a2e3d' }} />
              <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2e3d', borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#636882" strokeDasharray="2 2" />
              <Area type="monotone" dataKey="equity" name="سرمایه" stroke={netColor} fill="url(#eqg)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-text-primary mb-4">سود/زیانِ روزانه</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyBars}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3d" />
              <XAxis dataKey="label" tick={{ fill: '#636882', fontSize: 10 }} axisLine={{ stroke: '#2a2e3d' }} />
              <YAxis tick={{ fill: '#636882', fontSize: 10 }} axisLine={{ stroke: '#2a2e3d' }} />
              <Tooltip contentStyle={{ background: '#1a1d29', border: '1px solid #2a2e3d', borderRadius: 8, fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#636882" />
              <Bar dataKey="net" name="خالص" radius={[3, 3, 0, 0]}>
                {dailyBars.map((d, i) => <Cell key={i} fill={d.net >= 0 ? '#00C853' : '#F44336'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* فیلترها */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={symbol} onChange={e => { setSymbol(e.target.value); setPage(1); }} className="bg-bg-tertiary text-text-primary text-xs rounded-lg px-3 py-2 border border-border">
          <option value="">همهٔ نمادها</option>
          {symbols.map(sy => <option key={sy} value={sy}>{sy}</option>)}
        </select>
        <select value={result} onChange={e => { setResult(e.target.value); setPage(1); }} className="bg-bg-tertiary text-text-primary text-xs rounded-lg px-3 py-2 border border-border">
          <option value="">برد و باخت</option>
          <option value="win">فقط برد</option>
          <option value="loss">فقط باخت</option>
        </select>
        <select value={reason} onChange={e => { setReason(e.target.value); setPage(1); }} className="bg-bg-tertiary text-text-primary text-xs rounded-lg px-3 py-2 border border-border">
          <option value="">همهٔ دلایل</option>
          {Object.entries(REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-text-secondary text-xs">{fa(list?.total, 0)} معامله</span>
      </div>

      {/* جدولِ معاملات */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-secondary border-b border-border">
                {['زمان', 'نماد', 'جهت', 'حجم', 'ورود', 'خروج', 'پیپ', 'ناخالص', 'کمیسیون', 'سواپ', 'خالص', 'علت', 'مدت'].map(h => (
                  <th key={h} className="text-right font-medium py-2 px-2 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(list?.items || []).map((t) => (
                <tr key={t.id} className="border-b border-border/40 hover:bg-bg-tertiary/40">
                  <td className="py-2 px-2 text-text-secondary whitespace-nowrap">{fmtTime(t.close_time)}</td>
                  <td className="py-2 px-2 text-text-primary font-medium">{t.symbol}</td>
                  <td className="py-2 px-2">
                    <span className={t.direction === 'buy' ? 'text-accent-green' : 'text-accent-red'}>
                      {t.direction === 'buy' ? 'خرید' : 'فروش'}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-text-secondary">{fa(t.volume)}</td>
                  <td className="py-2 px-2 text-text-secondary">{t.entry_price || '—'}</td>
                  <td className="py-2 px-2 text-text-secondary">{t.exit_price || '—'}</td>
                  <td className={`py-2 px-2 ${t.pips >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>{fa(t.pips, 1)}</td>
                  <td className="py-2 px-2 text-text-secondary">{fa(t.gross_profit)}</td>
                  <td className="py-2 px-2 text-accent-red/80">{fa(t.commission)}</td>
                  <td className="py-2 px-2 text-accent-red/80">{fa(t.swap)}</td>
                  <td className={`py-2 px-2 font-bold ${t.net_profit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>{money(t.net_profit)}</td>
                  <td className="py-2 px-2">
                    <span className="px-1.5 py-0.5 rounded text-[11px] bg-bg-tertiary text-text-secondary">{REASONS[t.close_reason] || t.close_reason || '—'}</span>
                  </td>
                  <td className="py-2 px-2 text-text-secondary">{fmtDur(t.duration_sec)}</td>
                </tr>
              ))}
              {(!list?.items || list.items.length === 0) && (
                <tr><td colSpan={13} className="py-8 text-center text-text-secondary">
                  هنوز معاملهٔ بسته‌شده‌ای ثبت نشده. (پس از فعال‌شدنِ گزارشِ دیلِ EA، تاریخچه اینجا زنده می‌شود)
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {list && list.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-secondary text-xs disabled:opacity-40">قبلی</button>
            <span className="text-text-secondary text-xs">{fa(page, 0)} / {fa(list.total_pages, 0)}</span>
            <button disabled={page >= list.total_pages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-secondary text-xs disabled:opacity-40">بعدی</button>
          </div>
        )}
      </div>
    </div>
  );
}
