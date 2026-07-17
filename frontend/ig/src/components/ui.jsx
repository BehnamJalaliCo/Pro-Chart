import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ═══════════════ سربرگِ صفحه ═══════════════
export function PageHeader({ title, sub, icon: Icon, action }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
      <div className="flex items-center gap-3">
        {Icon && <div className="w-11 h-11 rounded-2xl bg-brand-grad grid place-items-center text-white shadow-glow shrink-0"><Icon size={22} /></div>}
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-ink tracking-tight">{title}</h1>
          {sub && <p className="text-sm text-ink-muted mt-0.5">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon: Icon, title, sub, action }) {
  return (
    <div className="card p-10 text-center">
      {Icon && <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-50 grid place-items-center text-brand mb-3"><Icon size={26} /></div>}
      <div className="font-black text-ink">{title}</div>
      {sub && <div className="text-sm text-ink-muted mt-1 mb-4 max-w-sm mx-auto">{sub}</div>}
      {action}
    </div>
  );
}

export function Spinner({ label = 'در حال بارگذاری…' }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3 text-ink-muted">
      <div className="w-8 h-8 rounded-full border-[3px] border-brand-50 border-t-brand-500 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

// ═══════════════ مودالِ مرکزی (هدرِ چسبان + بدنهٔ اسکرول‌شونده) ═══════════════
const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
export function Modal({ open, onClose, title, sub, icon: Icon, children, footer, size = 'md', wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  const maxW = SIZES[wide ? 'lg' : size] || SIZES.md;
  return createPortal((
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-card border border-slate-100 w-full ${maxW} max-h-[92vh] flex flex-col fade-in overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <div className="w-9 h-9 rounded-xl bg-brand-50 grid place-items-center text-brand shrink-0"><Icon size={18} /></div>}
            <div className="min-w-0">
              <h3 className="font-black text-ink truncate">{title}</h3>
              {sub && <p className="text-xs text-ink-muted truncate">{sub}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-ink-muted hover:bg-slate-100 grid place-items-center shrink-0"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto grow">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-slate-100 bg-white shrink-0">{footer}</div>}
      </div>
    </div>
  ), document.body);
}

// ═══════════════ کشوی کناری (برای فرم‌های بزرگ) ═══════════════
export function Drawer({ open, onClose, title, sub, icon: Icon, children, footer, width = 'max-w-xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal((
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`absolute inset-y-0 left-0 w-full ${width} bg-white border-r border-slate-100 shadow-2xl flex flex-col animate-[igslidein_.22s_ease]`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && <div className="w-10 h-10 rounded-2xl bg-brand-grad grid place-items-center text-white shadow-glow shrink-0"><Icon size={20} /></div>}
            <div className="min-w-0">
              <h3 className="font-black text-ink truncate">{title}</h3>
              {sub && <p className="text-xs text-ink-muted truncate">{sub}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg text-ink-muted hover:bg-slate-100 grid place-items-center shrink-0"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto grow bg-white">{children}</div>
        {footer && <div className="px-5 py-3.5 border-t border-slate-100 bg-white shrink-0">{footer}</div>}
      </div>
      <style>{`@keyframes igslidein{from{transform:translateX(-100%)}to{transform:translateX(0)}}`}</style>
    </div>
  ), document.body);
}

// ═══════════════ فیلدها و کنترل‌ها ═══════════════
export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label flex items-center justify-between"><span>{label}</span>{hint && <span className="text-[10px] text-ink-muted font-normal">{hint}</span>}</label>}
      {children}
    </div>
  );
}

export function Switch({ checked, onChange, label, sub, icon: Icon }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-right transition ${checked ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 bg-white/70 hover:bg-white'}`}>
      {Icon && <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${checked ? 'bg-brand text-white' : 'bg-slate-100 text-ink-muted'}`}><Icon size={16} /></div>}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink">{label}</div>
        {sub && <div className="text-[11px] text-ink-muted">{sub}</div>}
      </div>
      <span className={`relative w-10 h-6 rounded-full transition shrink-0 ${checked ? 'bg-brand' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'right-0.5' : 'right-[1.125rem]'}`} />
      </span>
    </button>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-slate-100 gap-1 flex-wrap">
      {options.map((o) => {
        const v = o.value ?? o; const lbl = o.label ?? o;
        return (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition ${value === v ? 'bg-white text-brand shadow-soft' : 'text-ink-muted hover:text-ink'}`}>
            {o.icon && <o.icon size={14} className="inline ml-1" />}{lbl}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-ink-soft">{label}</span>
        <span className="text-xs font-black text-brand tabular-nums">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-brand-500 h-1.5" />
    </div>
  );
}

export function ColorField({ label, value, onChange }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-2 py-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer p-0" />
        <input value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" className="flex-1 bg-transparent text-sm text-ink outline-none font-mono" />
      </div>
    </div>
  );
}

export function Tag({ children, color = 'brand', onRemove }) {
  const map = {
    brand: 'bg-brand-50 text-brand', green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600', pink: 'bg-pink-50 text-pink-600',
    slate: 'bg-slate-100 text-ink-soft', red: 'bg-red-50 text-red-500',
  };
  return (
    <span className={`chip ${map[color] || map.brand}`}>
      {children}
      {onRemove && <button onClick={onRemove} className="hover:opacity-70"><X size={12} /></button>}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, color = '#7c3aed', trend }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0" style={{ background: color + '18', color }}><Icon size={20} /></div>
        <div className="min-w-0">
          <div className="text-2xl font-black text-ink tracking-tight tabular-nums">{value ?? 0}</div>
          <div className="text-xs text-ink-muted truncate">{label}</div>
        </div>
        {trend != null && <div className={`mr-auto text-xs font-black ${trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%</div>}
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'ok') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  }, []);
  const node = toast ? (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] fade-in">
      <div className={`px-4 py-3 rounded-xl shadow-card font-bold text-sm text-white ${toast.type === 'err' ? 'bg-accent-red' : 'bg-accent-green'}`}>{toast.message}</div>
    </div>
  ) : null;
  return [show, node];
}
