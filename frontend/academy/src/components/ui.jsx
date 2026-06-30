// المان‌های کوچکِ مشترک
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

export const money = (v, c = '') =>
  v == null ? '—' : `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${c ? ' ' + c : ''}`;
