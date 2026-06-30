import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Play, Save, FolderOpen, Trash2, Zap, BarChart3, Activity } from 'lucide-react';
import { api } from '../api/client';
import { makeStore } from '../lib/persist';
import { GuideButton, InfoTip } from '../components/Guide';

const store = makeStore('academy_strategylab');

function Curve({ pts }) {
  if (!pts || pts.length < 2) return null;
  const w = 600, h = 130, p = 4, lo = Math.min(0, ...pts), hi = Math.max(0, ...pts), rng = (hi - lo) || 1;
  const x = (i) => p + (w - p * 2) * i / (pts.length - 1), y = (v) => p + (h - p * 2) * (1 - (v - lo) / rng);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <line x1={p} x2={w - p} y1={y(0)} y2={y(0)} stroke="#475569" strokeDasharray="3 3" strokeWidth="0.7" />
      <polyline fill="none" stroke={pts[pts.length - 1] >= 0 ? '#34d399' : '#f87171'} strokeWidth="2" points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
    </svg>
  );
}

// نمودارِ میله‌ایِ کوچک برای net_r هر پنجره (تست پیش‌رونده)
function WindowBars({ windows }) {
  if (!windows || !windows.length) return null;
  const vals = windows.map((w) => w.net_r ?? 0);
  const hi = Math.max(1, ...vals.map(Math.abs));
  return (
    <div className="flex items-end gap-2 h-28 mt-2" dir="ltr">
      {windows.map((w, i) => {
        const v = w.net_r ?? 0;
        const hpct = Math.max(4, (Math.abs(v) / hi) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div className="text-[10px] text-text-muted mb-0.5">{v > 0 ? '+' : ''}{Number(v).toFixed(1)}</div>
            <div className="w-full flex flex-col justify-end" style={{ height: '70%' }}>
              <div className={`w-full rounded ${v >= 0 ? 'bg-brand-green' : 'bg-brand-red'}`} style={{ height: `${hpct}%` }} />
            </div>
            <div className="text-[10px] text-text-muted mt-1">#{i + 1}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function StrategyLab() {
  const qc = useQueryClient();
  const { data: meta } = useQuery({ queryKey: ['chartSymbols'], queryFn: () => api.chartSymbols(), staleTime: 3600e3 });
  const { data: saved } = useQuery({ queryKey: ['savedStrategies'], queryFn: () => api.savedStrategies() });
  // پیکربندیِ استراتژی با رفرش پاک نمی‌شود (در مرورگر ذخیره می‌شود)
  const [c, setC] = useState(() => store.load().c || { symbol: 'EURUSD', tf: 'H1', fast: 20, slow: 50, use_rsi: false, rsi_lo: 30, rsi_hi: 70, sl_atr: 1.5, tp_atr: 3 });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const up = (k, v) => setC((s) => ({ ...s, [k]: v }));
  // ذخیرهٔ خودکارِ پیکربندی + ورودی‌های بهینه‌سازی در مرورگر
  useEffect(() => { store.save({ c, optIn }); }, [c, optIn]);

  // ساختِ پارامترهای عددیِ تمیز از وضعیتِ فعلی
  const cleanParams = () => ({ ...c, fast: +c.fast, slow: +c.slow, rsi_lo: +c.rsi_lo, rsi_hi: +c.rsi_hi, sl_atr: +c.sl_atr, tp_atr: +c.tp_atr });

  const run = async () => {
    setBusy(true);
    try { setRes(await api.strategyBacktest(cleanParams())); }
    catch (e) { alert(e?.message || 'خطا'); setRes(null); } finally { setBusy(false); }
  };

  // ذخیرهٔ استراتژی روی سرور (پارامترهای فعلی + متریک‌های آخرین بک‌تست)
  const saveStrategy = async () => {
    const name = saveName.trim();
    if (!name) { alert('نامِ استراتژی را وارد کنید.'); return; }
    setSaving(true);
    try {
      await api.saveStrategy({ name, kind: 'lab', params: cleanParams(), metrics: res || null });
      setSaveName('');
      qc.invalidateQueries({ queryKey: ['savedStrategies'] });
    } catch (e) { alert(e?.message || 'خطا در ذخیره'); } finally { setSaving(false); }
  };

  const loadStrategy = (s) => { if (s?.params) setC((prev) => ({ ...prev, ...s.params })); };
  const removeStrategy = async (id) => {
    try { await api.deleteStrategy(id); qc.invalidateQueries({ queryKey: ['savedStrategies'] }); }
    catch (e) { alert(e?.message || 'خطا در حذف'); }
  };

  // ── بهینه‌سازی ─────────────────────────────────────────────
  const [optIn, setOptIn] = useState(() => store.load().optIn || { fast_list: '10,20,30', slow_list: '50,100,200' });
  const [optRows, setOptRows] = useState(null);
  const [optBusy, setOptBusy] = useState(false);
  const parseList = (s) => s.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n));
  const runOptimize = async () => {
    const fast_list = parseList(optIn.fast_list), slow_list = parseList(optIn.slow_list);
    if (!fast_list.length || !slow_list.length) { alert('فهرستِ میانگین‌ها را وارد کنید (مثل ۱۰،۲۰،۳۰).'); return; }
    setOptBusy(true);
    try {
      const r = await api.optimizeStrategy({ symbol: c.symbol, tf: c.tf, fast_list, slow_list, use_rsi: c.use_rsi, sl_atr: +c.sl_atr, tp_atr: +c.tp_atr });
      const rows = (Array.isArray(r) ? r : r?.results || []).slice().sort((a, b) => (b.net_r ?? -1e9) - (a.net_r ?? -1e9));
      setOptRows(rows);
    } catch (e) { alert(e?.message || 'خطا در بهینه‌سازی'); setOptRows(null); } finally { setOptBusy(false); }
  };
  const applyBest = () => {
    if (!optRows?.length) return;
    const b = optRows[0];
    setC((s) => ({ ...s, fast: b.fast, slow: b.slow }));
  };

  // ── تستِ پیش‌رونده (Walk-forward) ──────────────────────────
  const [windows, setWindows] = useState(5);
  const [wf, setWf] = useState(null);
  const [wfBusy, setWfBusy] = useState(false);
  const runWalkForward = async () => {
    setWfBusy(true);
    try {
      const r = await api.walkForward({ symbol: c.symbol, tf: c.tf, fast: +c.fast, slow: +c.slow, use_rsi: c.use_rsi, sl_atr: +c.sl_atr, tp_atr: +c.tp_atr, windows: +windows });
      setWf(r);
    } catch (e) { alert(e?.message || 'خطا در تستِ پیش‌رونده'); setWf(null); } finally { setWfBusy(false); }
  };

  const symbols = meta?.symbols || [];
  const tfs = meta?.timeframes || ['M15', 'H1', 'H4', 'D1'];
  const Field = ({ label, k, w }) => <div className={w || ''}><label className="text-xs text-text-muted">{label}</label><input value={c[k]} onChange={(e) => up(k, e.target.value)} dir="ltr" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" /></div>;

  const wfWindows = wf?.windows || [];
  const consistency = wf?.consistency != null ? wf.consistency : wfWindows.filter((w) => (w.net_r ?? 0) > 0).length;
  const wfTotal = wf?.windows_count != null ? wf.windows_count : wfWindows.length;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2"><FlaskConical className="text-brand-green" /> آزمایشگاهِ استراتژی</h1>
        <GuideButton guideKey="strategylab" auto />
      </div>

      <div className="card p-4 mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-text-muted">نماد</label><select value={c.symbol} onChange={(e) => up('symbol', e.target.value)} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1">{symbols.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-text-muted">تایم‌فریم</label><select value={c.tf} onChange={(e) => up('tf', e.target.value)} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1">{tfs.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="text-xs font-bold text-text-secondary">ورود: کراسِ میانگینِ متحرک</div>
        <div className="grid grid-cols-2 gap-2"><Field label="میانگینِ سریع" k="fast" /><Field label="میانگینِ کند" k="slow" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.use_rsi} onChange={(e) => up('use_rsi', e.target.checked)} /> فیلترِ RSI</label>
        {c.use_rsi && <div className="grid grid-cols-2 gap-2"><Field label="RSI حداقل" k="rsi_lo" /><Field label="RSI حداکثر" k="rsi_hi" /></div>}
        <div className="text-xs font-bold text-text-secondary">خروج (بر پایهٔ ATR):</div>
        <div className="grid grid-cols-2 gap-2"><Field label="حد ضرر (×ATR)" k="sl_atr" /><Field label="حد سود (×ATR)" k="tp_atr" /></div>
        <button onClick={run} disabled={busy} className="btn-success w-full flex items-center justify-center gap-2 disabled:opacity-50"><Play size={16} /> {busy ? 'در حال بک‌تست…' : 'اجرای بک‌تست'}</button>
      </div>

      {/* ذخیرهٔ استراتژی روی سرور + فهرستِ من */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="text-sm font-bold text-text-secondary flex items-center gap-2"><FolderOpen size={16} className="text-brand-green" /> استراتژی‌های من</div>
        <div className="flex gap-2">
          <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="نامِ استراتژی" className="flex-1 bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm" />
          <button onClick={saveStrategy} disabled={saving} className="btn-ghost flex items-center gap-1.5 disabled:opacity-50"><Save size={15} /> {saving ? '…' : 'ذخیرهٔ استراتژی'}</button>
        </div>
        {Array.isArray(saved) && saved.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {saved.map((s) => (
              <span key={s.id} className="text-xs bg-surface-elevated border border-surface-border rounded-lg px-2 py-1 flex items-center gap-2">
                <button onClick={() => loadStrategy(s)} className="text-brand-green font-bold">{s.name}</button>
                {s.metrics?.net_r != null && <span className={`text-[10px] ${s.metrics.net_r >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{s.metrics.net_r > 0 ? '+' : ''}{s.metrics.net_r}R</span>}
                <button onClick={() => removeStrategy(s.id)} className="text-text-muted hover:text-brand-red"><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">هنوز استراتژی‌ای ذخیره نکرده‌اید. پارامترها را تنظیم کنید و «ذخیرهٔ استراتژی» را بزنید.</p>
        )}
      </div>

      {res && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-center">
            <div><div className={`font-black text-lg ${res.net_r >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{res.net_r > 0 ? '+' : ''}{res.net_r}R</div><div className="text-[11px] text-text-muted">سودِ خالص</div></div>
            <div><div className="font-black text-lg">{res.win_rate != null ? res.win_rate + '٪' : '—'}</div><div className="text-[11px] text-text-muted">نرخِ برد</div></div>
            <div><div className="font-black text-lg">{res.profit_factor}</div><div className="text-[11px] text-text-muted">فاکتورِ سود</div></div>
            <div><div className="font-black text-lg">{res.trades}</div><div className="text-[11px] text-text-muted">معاملات</div></div>
          </div>
          <div className="text-xs text-text-muted mb-1">منحنیِ سرمایه (R تجمعی) · روی {res.bars} کندل</div>
          <Curve pts={res.equity} />
          <p className="text-[11px] text-text-muted mt-2 leading-6">📈 بک‌تست روی دادهٔ واقعیِ تاریخی. این صرفاً تمرینِ آموزشیِ ساختِ استراتژی است، نه توصیهٔ معاملاتی.</p>
        </div>
      )}

      {/* بهینه‌سازی */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="text-sm font-bold text-text-secondary flex items-center gap-2"><Zap size={16} className="text-brand-green" /> بهینه‌سازی <InfoTip text="چند مقدارِ میانگینِ سریع و کند را با کاما بده تا همهٔ ترکیب‌ها را تست کند و بهترین را پیدا کنی؛ بعد «اعمالِ بهترین» را بزن." /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-text-muted">فهرستِ میانگینِ سریع</label><input value={optIn.fast_list} onChange={(e) => setOptIn((s) => ({ ...s, fast_list: e.target.value }))} dir="ltr" placeholder="10,20,30" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" /></div>
          <div><label className="text-xs text-text-muted">فهرستِ میانگینِ کند</label><input value={optIn.slow_list} onChange={(e) => setOptIn((s) => ({ ...s, slow_list: e.target.value }))} dir="ltr" placeholder="50,100,200" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" /></div>
        </div>
        <button onClick={runOptimize} disabled={optBusy} className="btn-success w-full flex items-center justify-center gap-2 disabled:opacity-50"><Zap size={16} /> {optBusy ? 'در حال بهینه‌سازی…' : 'بهینه‌سازی'}</button>
        {optRows && (optRows.length > 0 ? (
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center" dir="ltr">
                <thead className="text-text-muted">
                  <tr className="border-b border-surface-border">
                    <th className="py-1.5 px-1 font-bold">Fast</th>
                    <th className="py-1.5 px-1 font-bold">Slow</th>
                    <th className="py-1.5 px-1 font-bold">Win%</th>
                    <th className="py-1.5 px-1 font-bold">Net R</th>
                    <th className="py-1.5 px-1 font-bold">PF</th>
                    <th className="py-1.5 px-1 font-bold">Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {optRows.map((r, i) => (
                    <tr key={i} className={`border-b border-surface-border/50 ${i === 0 ? 'bg-brand-green/15 font-bold' : ''}`}>
                      <td className="py-1.5 px-1">{r.fast}</td>
                      <td className="py-1.5 px-1">{r.slow}</td>
                      <td className="py-1.5 px-1">{r.win_rate != null ? r.win_rate + '%' : '—'}</td>
                      <td className={`py-1.5 px-1 ${(r.net_r ?? 0) >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{(r.net_r ?? 0) > 0 ? '+' : ''}{r.net_r}R</td>
                      <td className="py-1.5 px-1">{r.profit_factor ?? '—'}</td>
                      <td className="py-1.5 px-1">{r.trades ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={applyBest} className="btn-ghost w-full flex items-center justify-center gap-1.5"><BarChart3 size={15} /> اعمالِ بهترین (سریع {optRows[0].fast} / کند {optRows[0].slow})</button>
          </div>
        ) : (
          <p className="text-xs text-text-muted">نتیجه‌ای یافت نشد.</p>
        ))}
      </div>

      {/* تستِ پیش‌رونده */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="text-sm font-bold text-text-secondary flex items-center gap-2"><Activity size={16} className="text-brand-green" /> تستِ پیش‌رونده <InfoTip text="استراتژی را روی چند بازهٔ زمانیِ پیاپی می‌سنجد؛ ثباتِ بالا در پنجره‌ها یعنی به یک دورهٔ خاص وابسته نیستی و قابل‌اعتمادتر است." /></div>
        <div className="flex items-end gap-2">
          <div className="w-28"><label className="text-xs text-text-muted">تعدادِ پنجره</label><input value={windows} onChange={(e) => setWindows(e.target.value)} dir="ltr" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" /></div>
          <button onClick={runWalkForward} disabled={wfBusy} className="btn-success flex-1 flex items-center justify-center gap-2 disabled:opacity-50"><Activity size={16} /> {wfBusy ? 'در حال اجرا…' : 'تستِ پیش‌رونده'}</button>
        </div>
        {wf && (
          <div>
            <WindowBars windows={wfWindows} />
            <div className="text-center text-sm mt-2">
              <span className="font-black text-brand-green">ثباتِ {consistency}/{wfTotal} پنجره</span>
              <span className="text-text-muted"> سودده بوده‌اند.</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 leading-6">تستِ پیش‌رونده استراتژی را روی بازه‌های پیاپیِ زمان می‌سنجد؛ ثباتِ بالاتر یعنی استراتژی به یک دورهٔ خاص وابسته نیست.</p>
          </div>
        )}
      </div>
    </div>
  );
}
