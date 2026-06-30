import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { riskAPI } from '../api/client';
import StatCard from '../components/common/StatCard';

function formatNumber(n, decimals = 2) {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString('fa-IR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── بنر وضعیت روزانه ──
function DailyStatusBanner({ data, onUnlock, onLock }) {
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockReason, setLockReason] = useState('');

  if (!data) return null;

  const isLocked = data.is_locked;
  const pnl = data.realized_pnl || 0;
  const isProfitable = pnl >= 0;

  return (
    <>
      <div className={`rounded-xl p-5 border-2 ${
        isLocked
          ? 'bg-bearish/5 border-bearish/30'
          : isProfitable
            ? 'bg-bullish/5 border-bullish/20'
            : 'bg-warning/5 border-warning/20'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {isLocked ? (
              <Lock size={28} className="text-bearish shrink-0 mt-1" />
            ) : isProfitable ? (
              <ShieldCheck size={28} className="text-bullish shrink-0 mt-1" />
            ) : (
              <ShieldAlert size={28} className="text-warning shrink-0 mt-1" />
            )}
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {isLocked ? 'سیستم برای امروز قفل است' : 'سیستم فعال'}
              </h2>
              <p className="text-sm text-text-muted mt-1">
                {isLocked
                  ? data.locked_reason || 'به دلیل ریسک، سیگنال جدید صادر نمی‌شود'
                  : 'سیگنال‌ها در حال صدور هستند'}
              </p>
              <p className="text-xs text-text-muted mt-2">
                بازنشانی بعدی: {data.reset_at ? new Date(data.reset_at).toLocaleString('fa-IR') : '—'}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            {isLocked ? (
              <button
                onClick={onUnlock}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bullish text-white hover:bg-bullish/90 transition"
              >
                <Unlock size={16} />
                <span className="text-sm font-medium">آزادسازی</span>
              </button>
            ) : (
              <button
                onClick={() => setShowLockModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-card border border-surface-border text-text-secondary hover:bg-surface-hover transition"
              >
                <Ban size={16} />
                <span className="text-sm font-medium">قفل دستی</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-current/10">
          <div>
            <p className="text-xs text-text-muted">P&L روز</p>
            <p className={`text-xl font-bold ${isProfitable ? 'text-bullish' : 'text-bearish'}`}>
              {pnl >= 0 ? '+' : ''}{formatNumber(pnl, 2)}$
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">سیگنال‌های امروز</p>
            <p className="text-xl font-bold text-text-primary">{data.signal_count || 0}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">باخت‌های متوالی</p>
            <p className={`text-xl font-bold ${(data.consecutive_losses || 0) >= 3 ? 'text-warning' : 'text-text-primary'}`}>
              {data.consecutive_losses || 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-muted">دوره</p>
            <p className="text-sm font-medium text-text-primary">{data.date_key?.split(':')[2] || '—'}</p>
          </div>
        </div>
      </div>

      {showLockModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLockModal(false)}>
          <div className="bg-surface-card border border-surface-border rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-primary mb-4">قفل دستی سیستم</h3>
            <p className="text-sm text-text-muted mb-3">
              سیستم تا rollover بعدی قفل خواهد ماند. دلیل قفل را وارد کنید:
            </p>
            <textarea
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              placeholder="مثال: بازبینی استراتژی پس از NFP"
              className="w-full px-3 py-2 bg-surface-bg border border-surface-border rounded-lg text-text-primary placeholder-text-muted focus:border-brand-blue focus:outline-none text-sm"
              rows={3}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowLockModal(false)}
                className="flex-1 py-2 rounded-lg border border-surface-border text-text-secondary hover:bg-surface-hover"
              >
                انصراف
              </button>
              <button
                onClick={() => { onLock(lockReason); setShowLockModal(false); setLockReason(''); }}
                disabled={!lockReason}
                className="flex-1 py-2 rounded-lg bg-bearish text-white hover:bg-bearish/90 disabled:opacity-50"
              >
                قفل کن
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── جدول رد سیگنال‌ها (اخیر) ──
function RejectionsTable({ rejections }) {
  if (!rejections || rejections.length === 0) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
        <ShieldCheck size={40} className="mx-auto text-bullish mb-3" />
        <p className="text-text-secondary">هیچ سیگنالی در 24 ساعت اخیر رد نشده</p>
      </div>
    );
  }

  const reasonLabel = (code) => {
    const map = {
      weekend_blackout: 'تعطیلات آخر هفته',
      session_not_allowed: 'session نامناسب',
      daily_loss_limit: 'حد زیان روزانه',
      correlation_risk: 'همبستگی بالا',
      low_rr: 'R/R پایین',
      sl_too_tight: 'SL خیلی نزدیک',
      sl_too_wide: 'SL خیلی دور',
      regime_mismatch: 'عدم تطبیق رژیم',
      volatility_spike: 'spike نوسانی',
    };
    return map[code] || code;
  };

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-border">
        <h3 className="font-bold text-text-primary">سیگنال‌های رد شده اخیر</h3>
        <p className="text-xs text-text-muted mt-1">۲۴ ساعت گذشته</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-xs text-text-muted bg-surface-bg/50">
              <th className="py-3 px-4">زمان</th>
              <th className="py-3 px-4">نماد</th>
              <th className="py-3 px-4">جهت</th>
              <th className="py-3 px-4">دلایل</th>
            </tr>
          </thead>
          <tbody>
            {rejections.map((r, idx) => (
              <tr key={idx} className="border-t border-surface-border/50 hover:bg-surface-hover">
                <td className="py-3 px-4 text-xs text-text-muted">
                  {new Date(r.timestamp).toLocaleString('fa-IR')}
                </td>
                <td className="py-3 px-4 font-medium">{r.symbol}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded ${r.direction === 'long' ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'}`}>
                    {r.direction === 'long' ? 'خرید' : 'فروش'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {(r.reasons || []).map((code, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-bearish/10 text-bearish border border-bearish/20">
                        {reasonLabel(code)}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── معاملات باز (correlation view) ──
function PositionsPanel({ positions }) {
  if (!positions || positions.length === 0) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
        <p className="text-text-secondary">هیچ معامله‌ی بازی نیست</p>
      </div>
    );
  }

  // محاسبه‌ی currency exposure
  const exposure = {};
  positions.forEach(p => {
    const legs = p.currency_legs || {};
    Object.entries(legs).forEach(([ccy, side]) => {
      exposure[ccy] = (exposure[ccy] || 0) + side * (p.risk_weight || 1);
    });
  });

  return (
    <div className="space-y-4">
      <div className="bg-surface-card border border-surface-border rounded-xl p-5">
        <h3 className="font-bold text-text-primary mb-3">معاملات باز ({positions.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-text-muted">
                <th className="py-2">نماد</th>
                <th className="py-2">جهت</th>
                <th className="py-2">باز شده</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={i} className="border-t border-surface-border/50">
                  <td className="py-2 font-medium">{p.symbol}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${p.direction === 'long' ? 'bg-bullish/10 text-bullish' : 'bg-bearish/10 text-bearish'}`}>
                      {p.direction === 'long' ? 'خرید' : 'فروش'}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-text-muted">
                    {p.entry_time ? new Date(p.entry_time).toLocaleString('fa-IR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {Object.keys(exposure).length > 0 && (
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <h3 className="font-bold text-text-primary mb-3">اکسپوژر به ارز</h3>
          <p className="text-xs text-text-muted mb-4">
            مجموع وزن‌های معاملات باز برای هر ارز (+ = long، − = short)
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(exposure).map(([ccy, value]) => {
              const isHigh = Math.abs(value) >= 2;
              return (
                <div key={ccy} className={`p-3 rounded-lg border ${
                  isHigh ? 'bg-warning/10 border-warning/30' : 'bg-surface-bg border-surface-border'
                }`}>
                  <p className="text-xs text-text-muted">{ccy}</p>
                  <p className={`text-lg font-bold ${value > 0 ? 'text-bullish' : value < 0 ? 'text-bearish' : 'text-text-primary'}`}>
                    {value > 0 ? '+' : ''}{formatNumber(value, 1)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── رژیم بازار per-symbol ──
function RegimePanel({ regimes }) {
  if (!regimes || regimes.length === 0) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-8 text-center">
        <p className="text-text-secondary">اطلاعاتی برای نمایش وجود ندارد</p>
      </div>
    );
  }

  const regimeLabel = (r) => ({
    trending_up: { label: 'روند صعودی', color: 'text-bullish', icon: TrendingUp },
    trending_down: { label: 'روند نزولی', color: 'text-bearish', icon: TrendingDown },
    ranging: { label: 'سایدوی', color: 'text-text-muted', icon: Activity },
    transitional: { label: 'گذار', color: 'text-warning', icon: AlertTriangle },
    high_volatility: { label: 'نوسان بالا', color: 'text-bearish', icon: AlertTriangle },
    low_volatility: { label: 'نوسان پایین', color: 'text-text-muted', icon: Activity },
  }[r] || { label: r, color: 'text-text-muted', icon: Activity });

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <h3 className="font-bold text-text-primary mb-4">رژیم بازار per-symbol</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {regimes.map((r, i) => {
          const meta = regimeLabel(r.regime);
          const Icon = meta.icon;
          return (
            <div key={i} className="bg-surface-bg border border-surface-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-text-primary">{r.symbol}</span>
                <Icon size={16} className={meta.color} />
              </div>
              <p className={`text-sm font-medium ${meta.color}`}>{meta.label}</p>
              <p className="text-xs text-text-muted mt-1">
                ADX: {formatNumber(r.adx, 1)} • ATR ٪ {(r.atr_percentile * 100).toFixed(0)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── صفحه‌ی اصلی ──
export default function RiskPage() {
  const queryClient = useQueryClient();

  const { data: daily, refetch: refetchDaily } = useQuery({
    queryKey: ['risk-daily'],
    queryFn: () => riskAPI.getDailyStatus().then(r => r.data),
    refetchInterval: 15000,
  });

  const { data: rejections } = useQuery({
    queryKey: ['risk-rejections'],
    queryFn: () => riskAPI.getRejections({ limit: 50 }).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: positions } = useQuery({
    queryKey: ['risk-positions'],
    queryFn: () => riskAPI.getPositions().then(r => r.data),
    refetchInterval: 10000,
  });

  const { data: regimes } = useQuery({
    queryKey: ['risk-regimes'],
    queryFn: () => riskAPI.getRegimes().then(r => r.data),
    refetchInterval: 60000,
  });

  const unlockMutation = useMutation({
    mutationFn: () => riskAPI.unlock(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk-daily'] }),
  });

  const lockMutation = useMutation({
    mutationFn: (reason) => riskAPI.manualLock(reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['risk-daily'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">مدیریت ریسک</h1>
          <p className="text-sm text-text-muted">circuit breaker، correlation، رژیم بازار</p>
        </div>
        <button
          onClick={() => { refetchDaily(); }}
          className="p-2 rounded-lg bg-surface-card border border-surface-border hover:bg-surface-hover"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <DailyStatusBanner
        data={daily}
        onUnlock={() => unlockMutation.mutate()}
        onLock={(reason) => lockMutation.mutate(reason)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PositionsPanel positions={positions} />
        <RegimePanel regimes={regimes} />
      </div>

      <RejectionsTable rejections={rejections} />
    </div>
  );
}
