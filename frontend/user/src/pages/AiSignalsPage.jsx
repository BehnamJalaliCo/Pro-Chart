import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, TrendingUp, TrendingDown, Trash2, Crown, Target, Shield,
  Zap, Loader2, Plus, Gauge, Lock, ArrowUpRight, Activity, Clock,
} from 'lucide-react';
import { bnUserAPI } from '../api/client';
import {
  toPersianDigits, faNum, Skeleton, EmptyState, ErrorState, useToast,
} from '../components/ui';

// ── کمکی‌ها ──
const TF_OPTIONS = ['5m', '15m', '30m', '1h', '4h', '1d'];
const PREMIUM_TIERS = ['vip', 'premium'];

function isPremiumTier(tier) {
  return PREMIUM_TIERS.includes(String(tier || '').toLowerCase());
}

function tierLabel(tier) {
  const t = String(tier || '').toLowerCase();
  if (t === 'premium') return 'پریمیوم';
  if (t === 'vip') return 'ویژه';
  if (t === 'free') return 'رایگان';
  return tier || '—';
}

// نرمال‌سازیِ جهتِ سیگنال
function normDir(direction) {
  const d = String(direction || '').toLowerCase();
  if (['long', 'buy', 'up', 'bullish'].includes(d)) return 'long';
  if (['short', 'sell', 'down', 'bearish'].includes(d)) return 'short';
  return 'flat';
}

// نرمال‌سازیِ اطمینان به درصد (۰..۱۰۰)
function normConfidence(c) {
  if (c == null || Number.isNaN(Number(c))) return null;
  const n = Number(c);
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function confTone(pct) {
  if (pct == null) return { text: 'text-text-muted', bar: 'bg-text-muted', bg: 'bg-text-muted/10' };
  if (pct >= 75) return { text: 'text-brand-green', bar: 'bg-brand-green', bg: 'bg-brand-green/10' };
  if (pct >= 50) return { text: 'text-brand-amber', bar: 'bg-brand-amber', bg: 'bg-brand-amber/10' };
  return { text: 'text-brand-red', bar: 'bg-brand-red', bg: 'bg-brand-red/10' };
}

// قیمت با تعدادِ اعشارِ مناسب
function fmtPrice(v) {
  if (v == null || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Math.abs(Number(v));
  const d = n >= 1000 ? 2 : n >= 1 ? 4 : 6;
  return faNum(v, d);
}

const STATUS_MAP = {
  active: { label: 'فعال', cls: 'bg-brand-green/12 text-brand-green' },
  open: { label: 'فعال', cls: 'bg-brand-green/12 text-brand-green' },
  pending: { label: 'در انتظار', cls: 'bg-brand-amber/12 text-brand-amber' },
  processing: { label: 'در حالِ پردازش', cls: 'bg-brand-blue/12 text-brand-blue' },
  closed: { label: 'بسته‌شده', cls: 'bg-surface-elevated text-text-muted' },
  tp_hit: { label: 'به هدف رسید', cls: 'bg-brand-green/12 text-brand-green' },
  won: { label: 'موفق', cls: 'bg-brand-green/12 text-brand-green' },
  sl_hit: { label: 'حدِ ضرر', cls: 'bg-brand-red/12 text-brand-red' },
  lost: { label: 'ناموفق', cls: 'bg-brand-red/12 text-brand-red' },
};

function StatusPill({ status }) {
  const key = String(status || '').toLowerCase();
  const s = STATUS_MAP[key] || { label: status || 'نامشخص', cls: 'bg-surface-elevated text-text-secondary' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── کارتِ سهمیه ──
function QuotaCard({ data, tier }) {
  const limit = Number(data?.limit ?? 0);
  const used = Number(data?.used ?? 0);
  const remaining = Number(data?.remaining ?? Math.max(0, limit - used));
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const barTone = remaining <= 0 ? 'bg-brand-red' : pct >= 80 ? 'bg-brand-amber' : 'bg-brand-green';

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-brand-blue/12 flex items-center justify-center text-brand-blue">
            <Gauge size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">سهمیهٔ سیگنال</p>
            <p className="text-xs text-text-muted">ظرفیتِ روزانهٔ شما</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/12 text-brand-green px-2.5 py-1 text-xs font-bold">
          <Crown size={13} /> {tierLabel(data?.tier || tier)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-surface-elevated p-3 text-center">
          <div className="text-xs text-text-muted mb-1">سقف</div>
          <div className="text-lg font-black text-text-primary tabular-nums">{faNum(limit)}</div>
        </div>
        <div className="rounded-xl bg-surface-elevated p-3 text-center">
          <div className="text-xs text-text-muted mb-1">مصرف‌شده</div>
          <div className="text-lg font-black text-text-primary tabular-nums">{faNum(used)}</div>
        </div>
        <div className="rounded-xl bg-surface-elevated p-3 text-center">
          <div className="text-xs text-text-muted mb-1">باقی‌مانده</div>
          <div className={`text-lg font-black tabular-nums ${remaining <= 0 ? 'text-brand-red' : 'text-brand-green'}`}>
            {faNum(remaining)}
          </div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${barTone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── فرمِ تولیدِ سیگنال ──
function GenerateForm({ symbol, setSymbol, tf, setTf, onSubmit, loading, disabled }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="card p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-brand-green/12 flex items-center justify-center text-brand-green">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary">تولیدِ سیگنالِ جدید</p>
          <p className="text-xs text-text-muted">نماد و بازهٔ زمانی را انتخاب کنید</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">نماد</label>
          <input
            className="input font-mono tabular-nums"
            dir="ltr"
            placeholder="BTCUSDT"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/\s/g, ''))}
          />
        </div>
        <div>
          <label className="label">بازهٔ زمانی</label>
          <select className="input" value={tf} onChange={(e) => setTf(e.target.value)}>
            {TF_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || disabled || !symbol.trim()}
        className="btn-success w-full inline-flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
        {disabled ? 'سهمیهٔ امروز تمام شد' : loading ? 'در حالِ تولید…' : 'تولیدِ سیگنال'}
      </button>
    </form>
  );
}

// ── کارتِ سیگنالِ فعال ──
function SignalCard({ sig, onDelete, deleting }) {
  const dir = normDir(sig.direction);
  const conf = normConfidence(sig.confidence);
  const ct = confTone(conf);
  const isLong = dir === 'long';
  const dirCls = isLong ? 'text-brand-green' : dir === 'short' ? 'text-brand-red' : 'text-text-muted';
  const DirIcon = isLong ? TrendingUp : dir === 'short' ? TrendingDown : Activity;
  const tps = [sig.tp1, sig.tp2, sig.tp3].filter((x) => x != null && x !== '');

  return (
    <div className="card p-4 sm:p-5">
      {/* هدر */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isLong ? 'bg-brand-green/12' : dir === 'short' ? 'bg-brand-red/12' : 'bg-surface-elevated'} ${dirCls}`}>
            <DirIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-text-primary font-mono tabular-nums" dir="ltr">{sig.symbol || '—'}</span>
              <span className={`text-xs font-bold ${dirCls}`}>
                {isLong ? 'خرید' : dir === 'short' ? 'فروش' : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {sig.tf && (
                <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                  <Clock size={12} /> <span dir="ltr">{sig.tf}</span>
                </span>
              )}
              <StatusPill status={sig.status} />
            </div>
          </div>
        </div>
        <button
          onClick={() => onDelete(sig.id)}
          disabled={deleting}
          className="text-text-muted hover:text-brand-red transition p-1.5 rounded-lg hover:bg-brand-red/10 disabled:opacity-50"
          aria-label="حذف"
        >
          {deleting ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
        </button>
      </div>

      {/* اطمینان */}
      {conf != null && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-muted inline-flex items-center gap-1"><Zap size={13} /> اطمینان</span>
            <span className={`font-black tabular-nums ${ct.text}`}>{toPersianDigits(conf)}٪</span>
          </div>
          <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${ct.bar}`} style={{ width: `${conf}%` }} />
          </div>
        </div>
      )}

      {/* سطوحِ قیمت */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-surface-elevated p-3">
          <div className="text-xs text-text-muted mb-1 inline-flex items-center gap-1">
            <ArrowUpRight size={13} /> ورود
          </div>
          <div className="font-bold text-text-primary font-mono tabular-nums" dir="ltr">{fmtPrice(sig.entry)}</div>
        </div>
        <div className="rounded-xl bg-brand-red/8 p-3">
          <div className="text-xs text-brand-red/80 mb-1 inline-flex items-center gap-1">
            <Shield size={13} /> حدِ ضرر
          </div>
          <div className="font-bold text-brand-red font-mono tabular-nums" dir="ltr">{fmtPrice(sig.sl)}</div>
        </div>
      </div>

      {tps.length > 0 && (
        <div className="mt-2.5 rounded-xl bg-brand-green/8 p-3">
          <div className="text-xs text-brand-green/80 mb-2 inline-flex items-center gap-1">
            <Target size={13} /> اهداف
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[sig.tp1, sig.tp2, sig.tp3].map((tp, i) => (
              <div key={i} className="text-center">
                <div className="text-[10px] text-text-muted mb-0.5">هدفِ {toPersianDigits(i + 1)}</div>
                <div className="text-sm font-bold text-brand-green font-mono tabular-nums" dir="ltr">
                  {tp != null && tp !== '' ? fmtPrice(tp) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── دروازهٔ ارتقا (کاربرِ رایگان) ──
function UpgradeGate() {
  return (
    <div className="card p-8 text-center border-brand-amber/40">
      <div className="w-16 h-16 rounded-2xl bg-brand-amber/12 flex items-center justify-center text-brand-amber mx-auto mb-4">
        <Lock size={30} />
      </div>
      <h2 className="text-lg font-black text-text-primary">سیگنالِ هوشِ مصنوعی ویژهٔ اشتراکِ پرمیوم است</h2>
      <p className="text-text-muted text-sm mt-2 max-w-md mx-auto leading-relaxed">
        با ارتقا به اشتراکِ ویژه یا پریمیوم، به سیگنال‌های لحظه‌ایِ هوشِ مصنوعی با نقاطِ ورود، حدِ ضرر و اهدافِ سود دسترسی پیدا می‌کنید.
      </p>
      <Link to="/subscription" className="btn-primary inline-flex items-center gap-2 mt-5">
        <Crown size={18} /> ارتقای اشتراک
      </Link>
    </div>
  );
}

// ── اسکلتِ بارگذاری ──
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-52 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

// ── صفحهٔ اصلی ──
export default function AiSignalsPage() {
  const qc = useQueryClient();
  const { success, error: toastError } = useToast();
  const [symbol, setSymbol] = useState('');
  const [tf, setTf] = useState('1h');

  // تیر از اگرگیتِ کاربر (منبعِ معتبر)
  const overviewQ = useQuery({ queryKey: ['bn-overview'], queryFn: bnUserAPI.overview });
  const tier = overviewQ.data?.profile?.tier;
  const premium = isPremiumTier(tier);

  const quotaQ = useQuery({
    queryKey: ['ai-quota'],
    queryFn: bnUserAPI.aiQuota,
    enabled: premium,
  });
  const activeQ = useQuery({
    queryKey: ['ai-active'],
    queryFn: bnUserAPI.aiActive,
    enabled: premium,
  });

  const createMut = useMutation({
    mutationFn: (payload) => bnUserAPI.createAiSignal(payload),
    onSuccess: () => {
      success('سیگنال با موفقیت تولید شد.');
      setSymbol('');
      qc.invalidateQueries({ queryKey: ['ai-active'] });
      qc.invalidateQueries({ queryKey: ['ai-quota'] });
    },
    onError: (e) => toastError(e?.message || 'تولیدِ سیگنال ناموفق بود.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => bnUserAPI.deleteAiSignal(id),
    onSuccess: () => {
      success('سیگنال حذف شد.');
      qc.invalidateQueries({ queryKey: ['ai-active'] });
      qc.invalidateQueries({ queryKey: ['ai-quota'] });
    },
    onError: (e) => toastError(e?.message || 'حذفِ سیگنال ناموفق بود.'),
  });

  const remaining = Number(quotaQ.data?.remaining ?? 0);
  const quotaExhausted = quotaQ.isSuccess && remaining <= 0;

  const signals = useMemo(() => {
    const d = activeQ.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.items)) return d.items;
    return [];
  }, [activeQ.data]);

  const header = (
    <div className="flex items-center gap-2">
      <Sparkles size={22} className="text-brand-blue" />
      <h1 className="text-xl font-black text-text-primary">سیگنال‌های هوشِ مصنوعی</h1>
    </div>
  );

  // بارگذاریِ اولیه
  if (overviewQ.isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <LoadingSkeleton />
      </div>
    );
  }

  // خطای اگرگیت
  if (overviewQ.isError) {
    return (
      <div className="space-y-4">
        {header}
        <div className="card">
          <ErrorState message={overviewQ.error?.message} onRetry={() => overviewQ.refetch()} />
        </div>
      </div>
    );
  }

  // کاربرِ رایگان → دروازهٔ ارتقا
  if (!premium) {
    return (
      <div className="space-y-4">
        {header}
        <UpgradeGate />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {/* سهمیه */}
      {quotaQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : quotaQ.isError ? (
        <div className="card">
          <ErrorState message={quotaQ.error?.message} onRetry={() => quotaQ.refetch()} />
        </div>
      ) : (
        <QuotaCard data={quotaQ.data} tier={tier} />
      )}

      {/* فرمِ تولید */}
      <GenerateForm
        symbol={symbol}
        setSymbol={setSymbol}
        tf={tf}
        setTf={setTf}
        loading={createMut.isPending}
        disabled={quotaExhausted}
        onSubmit={() => createMut.mutate({ symbol: symbol.trim(), tf })}
      />

      {/* سیگنال‌های فعال */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={17} className="text-brand-green" />
          <h2 className="text-base font-black text-text-primary">سیگنال‌های فعال</h2>
          {activeQ.isSuccess && signals.length > 0 && (
            <span className="text-xs text-text-muted tabular-nums">({faNum(signals.length)})</span>
          )}
        </div>

        {activeQ.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : activeQ.isError ? (
          <div className="card">
            <ErrorState message={activeQ.error?.message} onRetry={() => activeQ.refetch()} />
          </div>
        ) : signals.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Sparkles}
              title="هنوز سیگنالی ندارید"
              desc="با فرمِ بالا نخستین سیگنالِ هوشِ مصنوعیِ خود را تولید کنید."
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {signals.map((sig) => (
              <SignalCard
                key={sig.id ?? `${sig.symbol}-${sig.tf}`}
                sig={sig}
                onDelete={(id) => deleteMut.mutate(id)}
                deleting={deleteMut.isPending && deleteMut.variables === sig.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
