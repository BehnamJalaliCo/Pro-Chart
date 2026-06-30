import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Play,
  RefreshCw,
  Trash2,
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  ChevronLeft,
  Plus,
  Activity,
} from 'lucide-react';
import { backtestAPI } from '../api/client';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';

// ── کمکی‌ها ───────────────────────────────────────────────

function formatNumber(n, decimals = 2) {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(n) {
  if (n === null || n === undefined) return '—';
  return `${(Number(n) * 100).toFixed(1)}٪`;
}

function statusStyle(status) {
  switch (status) {
    case 'completed': return 'bg-bullish/10 text-bullish border-bullish/20';
    case 'running': return 'bg-brand-blue/10 text-brand-blue border-brand-blue/20';
    case 'pending': return 'bg-warning/10 text-warning border-warning/20';
    case 'failed': return 'bg-bearish/10 text-bearish border-bearish/20';
    default: return 'bg-surface-hover text-text-muted border-surface-border';
  }
}

// ── کارت یک run ──
function RunCard({ run, onSelect, onDelete }) {
  const pnl = (run.final_balance || 0) - (run.initial_balance || 0);
  const isProfitable = pnl > 0;

  return (
    <div
      onClick={() => onSelect(run)}
      className="bg-surface-card border border-surface-border rounded-xl p-4 hover:border-brand-blue/30 hover:shadow-lg transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-text-primary truncate">{run.name}</h3>
          <p className="text-xs text-text-muted mt-1">
            {new Date(run.created_at).toLocaleString('fa-IR')}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-md border ${statusStyle(run.status)}`}>
          {run.status === 'completed' ? 'تکمیل‌شده' :
           run.status === 'running' ? 'در حال اجرا' :
           run.status === 'pending' ? 'در صف' : 'ناموفق'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-muted">معاملات</p>
          <p className="font-medium text-text-primary">{run.trades_executed || 0}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">نسبت برد</p>
          <p className="font-medium text-text-primary">{formatPercent(run.win_rate)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">profit factor</p>
          <p className="font-medium text-text-primary">{formatNumber(run.profit_factor, 2)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">P&L</p>
          <p className={`font-medium ${isProfitable ? 'text-bullish' : 'text-bearish'}`}>
            {isProfitable ? '+' : ''}{formatNumber(pnl, 2)}$
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-border">
        <span className="text-xs text-text-muted">
          {run.symbol || 'همه نمادها'} • {run.timeframe || 'H1'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(run.id); }}
          className="text-text-muted hover:text-bearish transition-colors"
          aria-label="حذف"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ── جزئیات یک run ──
function RunDetail({ run, onBack }) {
  const queryClient = useQueryClient();
  const { data: detailResp, isLoading } = useQuery({
    queryKey: ['backtest-run', run.id],
    queryFn: () => backtestAPI.getRun(run.id, { sample_size: 50 }).then(r => r.data),
    refetchInterval: run.status === 'running' || run.status === 'pending' ? 3000 : false,
  });

  const detail = detailResp || run;
  const metrics = detail.metrics_full || {};
  const attribution = detail.attribution || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-hover transition"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text-primary truncate">{detail.name}</h1>
          <p className="text-xs text-text-muted">
            {new Date(detail.created_at).toLocaleString('fa-IR')} • {detail.kind === 'walk_forward' ? 'Walk-Forward' : 'Signal Replay'}
          </p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-md border ${statusStyle(detail.status)}`}>
          {detail.status === 'completed' ? 'تکمیل‌شده' :
           detail.status === 'running' ? 'در حال اجرا' :
           detail.status === 'pending' ? 'در صف' : 'ناموفق'}
        </span>
      </div>

      {detail.status === 'failed' && detail.error_message && (
        <div className="bg-bearish/10 border border-bearish/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-bearish shrink-0" />
          <div>
            <p className="font-medium text-text-primary">خطا در اجرای run</p>
            <p className="text-sm text-text-muted mt-1 break-all">{detail.error_message}</p>
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="نسبت برد"
          value={formatPercent(detail.win_rate || metrics.win_rate)}
          icon={Award}
          iconColor="text-bullish"
        />
        <StatCard
          title="profit factor"
          value={formatNumber(detail.profit_factor || metrics.profit_factor, 2)}
          icon={TrendingUp}
          iconColor="text-brand-blue"
        />
        <StatCard
          title="Sharpe ratio"
          value={formatNumber(detail.sharpe_ratio || metrics.sharpe_ratio, 2)}
          icon={Activity}
          iconColor="text-brand-purple"
        />
        <StatCard
          title="حداکثر افت"
          value={formatPercent(detail.max_drawdown_pct || metrics.max_drawdown_pct)}
          icon={TrendingDown}
          iconColor="text-bearish"
        />
      </div>

      {/* Detailed metrics */}
      {metrics && Object.keys(metrics).length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <h3 className="font-bold text-text-primary mb-4">متریک‌های کامل</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <MetricRow label="کل معاملات" value={metrics.total_trades} />
            <MetricRow label="برنده" value={metrics.winning_trades} color="text-bullish" />
            <MetricRow label="بازنده" value={metrics.losing_trades} color="text-bearish" />
            <MetricRow label="میانگین R" value={formatNumber(metrics.expectancy_r, 3)} />
            <MetricRow label="Sortino" value={formatNumber(metrics.sortino_ratio, 2)} />
            <MetricRow label="Calmar" value={formatNumber(metrics.calmar_ratio, 2)} />
            <MetricRow label="بلندترین زنجیره برد" value={metrics.longest_winning_streak} />
            <MetricRow label="بلندترین زنجیره باخت" value={metrics.longest_losing_streak} />
            <MetricRow label="هزینه commission" value={`${formatNumber(metrics.total_commission_dollar, 2)}$`} />
          </div>
        </div>
      )}

      {/* Attribution */}
      {attribution && Object.keys(attribution).length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <h3 className="font-bold text-text-primary mb-4">تخصیص (Attribution)</h3>
          <p className="text-xs text-text-muted mb-4">
            عملکرد سیگنال‌ها بر اساس مؤلفه‌ی غالب در امتیاز
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(attribution).map(([component, m]) => (
              <div key={component} className="bg-surface-bg border border-surface-border rounded-lg p-4">
                <p className="text-xs uppercase text-text-muted">
                  {component === 'technical' ? 'تکنیکال' :
                   component === 'pattern' ? 'الگو' :
                   component === 'ml' ? 'هوش مصنوعی' : component}
                </p>
                <p className="text-2xl font-bold text-text-primary mt-2">
                  {formatPercent(m.win_rate)}
                </p>
                <p className="text-xs text-text-muted">
                  {m.total_trades || 0} معامله • PF {formatNumber(m.profit_factor, 2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample trades */}
      {detail.sample_trades && detail.sample_trades.length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <h3 className="font-bold text-text-primary mb-4">نمونه معاملات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-text-muted border-b border-surface-border">
                  <th className="py-2">نماد</th>
                  <th className="py-2">جهت</th>
                  <th className="py-2">زمان ورود</th>
                  <th className="py-2">R</th>
                  <th className="py-2">P&L</th>
                  <th className="py-2">خروج</th>
                </tr>
              </thead>
              <tbody>
                {detail.sample_trades.map((t) => (
                  <tr key={t.id} className="border-b border-surface-border/50 hover:bg-surface-hover">
                    <td className="py-2 font-medium">{t.symbol}</td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${t.direction === 'long' ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'}`}>
                        {t.direction === 'long' ? 'خرید' : 'فروش'}
                      </span>
                    </td>
                    <td className="py-2 text-text-muted">{new Date(t.entry_time).toLocaleDateString('fa-IR')}</td>
                    <td className="py-2">{formatNumber(t.r_multiple, 2)}</td>
                    <td className={`py-2 font-medium ${(t.net_pnl_dollar || 0) > 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {formatNumber(t.net_pnl_dollar, 2)}$
                    </td>
                    <td className="py-2 text-xs text-text-muted">
                      {t.exit_reason === 'take_profit_1' ? 'TP1' :
                       t.exit_reason === 'take_profit_2' ? 'TP2' :
                       t.exit_reason === 'take_profit_3' ? 'TP3' :
                       t.exit_reason === 'stop_loss' ? 'SL' :
                       t.exit_reason === 'timeout' ? 'انقضا' : t.exit_reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="text-center text-text-muted py-4">در حال بارگذاری جزئیات...</div>
      )}
    </div>
  );
}

function MetricRow({ label, value, color = 'text-text-primary' }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-text-muted text-xs">{label}</span>
      <span className={`font-medium ${color}`}>{value ?? '—'}</span>
    </div>
  );
}

// ── trigger run modal ──
function TriggerModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: '',
    kind: 'replay',
    symbol: '',
    timeframe: 'H1',
    initial_balance: 10000,
    risk_per_trade_pct: 1.0,
  });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-card border border-surface-border rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-text-primary mb-4">اجرای bock‌تست جدید</h2>
        <div className="space-y-3">
          <Input label="نام" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="نمونه: EURUSD-H1-Aug2024" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="نوع" value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={[
              { value: 'replay', label: 'Signal Replay' },
              { value: 'walk_forward', label: 'Walk-Forward' },
            ]} />
            <Select label="تایم‌فریم" value={form.timeframe} onChange={(v) => setForm({ ...form, timeframe: v })} options={[
              { value: 'M15', label: 'M15' },
              { value: 'H1', label: 'H1' },
              { value: 'H4', label: 'H4' },
              { value: 'D1', label: 'D1' },
            ]} />
          </div>
          <Input label="نماد (اختیاری)" value={form.symbol} onChange={(v) => setForm({ ...form, symbol: v })} placeholder="EURUSD یا خالی برای همه" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="موجودی اولیه ($)" type="number" value={form.initial_balance} onChange={(v) => setForm({ ...form, initial_balance: Number(v) })} />
            <Input label="ریسک per trade (٪)" type="number" step="0.1" value={form.risk_per_trade_pct} onChange={(v) => setForm({ ...form, risk_per_trade_pct: Number(v) })} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg border border-surface-border text-text-secondary hover:bg-surface-hover">انصراف</button>
          <button
            onClick={() => form.name && onSubmit(form)}
            disabled={!form.name || form.name.length < 3}
            className="flex-1 py-2 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            شروع
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, type = 'text', value, onChange, placeholder, step }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      <input
        type={type} value={value} step={step}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-surface-bg border border-surface-border rounded-lg text-text-primary placeholder-text-muted focus:border-brand-blue focus:outline-none text-sm"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-surface-bg border border-surface-border rounded-lg text-text-primary focus:border-brand-blue focus:outline-none text-sm"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── صفحه‌ی اصلی ──
export default function BacktestPage() {
  const [selectedRun, setSelectedRun] = useState(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: runsResp, isLoading, refetch } = useQuery({
    queryKey: ['backtest-runs'],
    queryFn: () => backtestAPI.listRuns({ limit: 50 }).then(r => r.data),
    refetchInterval: 10000,
  });

  const runs = runsResp || [];

  const deleteMutation = useMutation({
    mutationFn: (id) => backtestAPI.deleteRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backtest-runs'] }),
  });

  const triggerMutation = useMutation({
    mutationFn: (data) => backtestAPI.triggerRun(data),
    onSuccess: () => {
      setShowTriggerModal(false);
      queryClient.invalidateQueries({ queryKey: ['backtest-runs'] });
    },
  });

  if (selectedRun) {
    return <RunDetail run={selectedRun} onBack={() => setSelectedRun(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">بک‌تست</h1>
          <p className="text-sm text-text-muted">اعتبارسنجی استراتژی روی داده‌ی تاریخی</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-hover transition"
            title="بروزرسانی"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowTriggerModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 transition"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">run جدید</span>
          </button>
        </div>
      </div>

      {isLoading && runs.length === 0 ? (
        <div className="text-center text-text-muted py-12">در حال بارگذاری...</div>
      ) : runs.length === 0 ? (
        <div className="bg-surface-card border border-surface-border rounded-xl p-12 text-center">
          <Play size={48} className="mx-auto text-text-muted mb-3" />
          <p className="text-text-secondary mb-2">هنوز هیچ bock‌تستی اجرا نشده است</p>
          <p className="text-xs text-text-muted">روی "run جدید" کلیک کنید تا شروع کنید</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {runs.map((run) => (
            <RunCard
              key={run.id}
              run={run}
              onSelect={setSelectedRun}
              onDelete={(id) => {
                if (window.confirm('این run حذف شود؟ تمام معاملات مرتبط هم پاک می‌شوند.')) {
                  deleteMutation.mutate(id);
                }
              }}
            />
          ))}
        </div>
      )}

      {showTriggerModal && (
        <TriggerModal
          onClose={() => setShowTriggerModal(false)}
          onSubmit={(data) => triggerMutation.mutate(data)}
        />
      )}
    </div>
  );
}
