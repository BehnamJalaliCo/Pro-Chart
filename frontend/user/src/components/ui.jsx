import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, Inbox, RefreshCw } from 'lucide-react';

// ── ارقامِ فارسی ──
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
export const toPersianDigits = (v) =>
  v == null ? '' : String(v).replace(/[0-9]/g, (d) => FA_DIGITS[+d]);

// عددِ فارسی با جداکنندهٔ هزارگان
export const faNum = (v, d = 0) =>
  v == null || v === '' || Number.isNaN(Number(v))
    ? '—'
    : toPersianDigits(Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 }));

export const money = (v, c = '') =>
  v == null ? '—'
    : `${toPersianDigits(Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}${c ? ' ' + c : ''}`;

// ── المان‌های کوچکِ مشترک ──
export function StatusLight({ tone }) {
  const c = { green: 'bg-brand-green', amber: 'bg-brand-amber', red: 'bg-brand-red' }[tone] || 'bg-text-muted';
  const blink = tone === 'green' || tone === 'amber';
  return (
    <span className="relative inline-flex w-3.5 h-3.5 shrink-0">
      {blink && <span className={`absolute inline-flex w-full h-full rounded-full ${c} opacity-70 animate-ping`} />}
      <span className={`relative inline-flex w-3.5 h-3.5 rounded-full ${c}`} />
    </span>
  );
}

export function Stat({ label, value, tone = 'text-text-primary', sub }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={`text-xl font-black ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Spinner({ label = 'در حال بارگذاری…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-10 h-10 border-4 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
      <p className="text-text-muted text-sm">{label}</p>
    </div>
  );
}

// اسکلتِ بارگذاری
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-surface-elevated rounded-xl ${className}`} />;
}

// حالتِ خالیِ دوستانه
export function EmptyState({ icon: Icon = Inbox, title = 'چیزی برای نمایش نیست', desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-surface-elevated flex items-center justify-center text-text-muted mb-3">
        <Icon size={26} />
      </div>
      <p className="text-text-primary font-bold">{title}</p>
      {desc && <p className="text-text-muted text-sm mt-1 max-w-xs leading-relaxed">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// حالتِ خطا با دکمهٔ تلاشِ دوباره
export function ErrorState({ message = 'دریافتِ اطلاعات ناموفق بود.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="w-14 h-14 rounded-2xl bg-brand-red/12 flex items-center justify-center text-brand-red mb-3">
        <AlertTriangle size={26} />
      </div>
      <p className="text-text-primary font-bold">خطا</p>
      <p className="text-text-muted text-sm mt-1 max-w-xs leading-relaxed">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-4 inline-flex items-center gap-2">
          <RefreshCw size={16} /> تلاشِ دوباره
        </button>
      )}
    </div>
  );
}

// ── سیستمِ Toast ──
const ToastCtx = createContext(() => {});
const TONE = {
  success: { I: CheckCircle2, c: 'text-brand-green', b: 'border-brand-green/40' },
  error: { I: XCircle, c: 'text-brand-red', b: 'border-brand-red/40' },
  warn: { I: AlertTriangle, c: 'text-brand-amber', b: 'border-brand-amber/40' },
  info: { I: Info, c: 'text-brand-blue', b: 'border-brand-blue/40' },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'info', ttl = 3800) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), ttl);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed top-4 inset-x-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
        {items.map((t) => {
          const { I, c, b } = TONE[t.tone] || TONE.info;
          return (
            <div key={t.id}
              className={`pointer-events-auto flex items-center gap-2.5 max-w-sm w-full sm:w-auto bg-surface-card border ${b} rounded-2xl shadow-2xl px-4 py-3 animate-[fadeIn_.2s_ease]`}>
              <I size={19} className={`${c} shrink-0`} />
              <span className="text-sm text-text-primary leading-relaxed">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

// useToast() → tab(message, tone) ؛ tone ∈ success|error|warn|info
export function useToast() {
  const push = useContext(ToastCtx);
  return {
    toast: push,
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    warn: (m) => push(m, 'warn'),
    info: (m) => push(m, 'info'),
  };
}
