import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Code2, Radio, Play, Copy, Check, Cpu, Globe, Save } from 'lucide-react';
import { api } from '../api/client';
import { makeStore } from '../lib/persist';
import { GuideButton, InfoTip } from '../components/Guide';

const store = makeStore('academy_algolab');

const LANGS = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'mql5', label: 'MQL5 (متاتریدر)' },
  { id: 'pine', label: 'Pine (تریدینگ‌ویو)' },
];
const langLabel = (id) => (LANGS.find((l) => l.id === id) || LANGS[0]).label;

export default function AlgoLab() {
  const qc = useQueryClient();
  const { data: meta } = useQuery({ queryKey: ['chartSymbols'], queryFn: () => api.chartSymbols(), staleTime: 3600e3 });
  // پیکربندی + زبان + کدِ تولیدشده با رفرش پاک نمی‌شوند (در مرورگر ذخیره می‌شوند)
  const [c, setC] = useState(() => store.load().c || { symbol: 'EURUSD', tf: 'H1', fast: 20, slow: 50, use_rsi: false, rsi_lo: 30, rsi_hi: 70, sl_atr: 1.5, tp_atr: 3 });
  const [language, setLanguage] = useState(() => store.load().language || 'python');
  const [code, setCode] = useState(() => store.load().code || null);
  const [sig, setSig] = useState(null);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const up = (k, v) => setC((s) => ({ ...s, [k]: v }));
  useEffect(() => { store.save({ c, language, code }); }, [c, language, code]);
  const payload = () => ({ ...c, fast: +c.fast, slow: +c.slow, rsi_lo: +c.rsi_lo, rsi_hi: +c.rsi_hi, sl_atr: +c.sl_atr, tp_atr: +c.tp_atr });

  const gen = async () => { setBusy('code'); try { setCode(await api.algoCode({ ...payload(), language })); } catch (e) { alert(e?.message); } finally { setBusy(''); } };
  const save = async () => {
    setBusy('save');
    try {
      await api.saveStrategy({ name: `${c.symbol} ${c.tf} MA ${c.fast}/${c.slow}`, kind: 'algo', params: payload(), metrics: sig ? { signal: sig.signal, price: sig.price, rsi: sig.rsi } : {} });
      alert('استراتژی ذخیره شد ✅');
    } catch (e) { alert(e?.message || 'خطا'); } finally { setBusy(''); }
  };
  const signal = async () => { setBusy('sig'); try { setSig(await api.algoSignal(payload())); } catch (e) { alert(e?.message); } finally { setBusy(''); } };
  const execute = async () => {
    if (!sig || sig.signal === 'none') return;
    try { await api.paperOpen({ symbol: c.symbol, direction: sig.signal, sl: sig.sl, tp: sig.tp, risk_usd: 100 }); alert('پوزیشن روی حسابِ مجازی باز شد ✅'); qc.invalidateQueries({ queryKey: ['paperAcc'] }); qc.invalidateQueries({ queryKey: ['paperPos'] }); }
    catch (e) { alert(e?.message || 'خطا'); }
  };

  const symbols = meta?.symbols || [], tfs = meta?.timeframes || ['M15', 'H1', 'H4', 'D1'];
  const F = ({ label, k }) => <div><label className="text-xs text-text-muted">{label}</label><input value={c[k]} onChange={(e) => up(k, e.target.value)} dir="ltr" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h1 className="text-lg sm:text-xl font-black flex items-center gap-2"><Cpu className="text-brand-green" /> مسیرِ اتوماسیون (Algo)</h1>
        <GuideButton guideKey="algolab" auto />
      </div>
      <p className="text-xs text-text-muted mb-4 leading-6">استراتژی‌ات را تعریف کن، **کدِ ربات** را با مربیِ AI بساز و یاد بگیر، و **سیگنالِ زنده** را روی حسابِ مجازی اجرا کن.</p>

      <div className="card p-4 mb-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-text-muted">نماد</label><select value={c.symbol} onChange={(e) => up('symbol', e.target.value)} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1">{symbols.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="text-xs text-text-muted">تایم‌فریم</label><select value={c.tf} onChange={(e) => up('tf', e.target.value)} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1">{tfs.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-2"><F label="میانگینِ سریع" k="fast" /><F label="میانگینِ کند" k="slow" /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.use_rsi} onChange={(e) => up('use_rsi', e.target.checked)} /> فیلترِ RSI</label>
        {c.use_rsi && <div className="grid grid-cols-2 gap-2"><F label="RSI حداقل" k="rsi_lo" /><F label="RSI حداکثر" k="rsi_hi" /></div>}
        <div className="grid grid-cols-2 gap-2"><F label="حد ضرر (×ATR)" k="sl_atr" /><F label="حد سود (×ATR)" k="tp_atr" /></div>
        <div>
          <label className="text-xs text-text-muted flex items-center gap-1.5"><Globe size={13} className="text-brand-green" /> زبانِ کد <InfoTip text="زبانِ خروجیِ ربات را انتخاب کن: Python/JavaScript برای اجرای مستقل، MQL5 برای متاتریدر و Pine برای تریدینگ‌ویو." /></label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-2 py-1.5 text-sm mt-1">
            {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={gen} disabled={busy} className="btn-ghost flex items-center justify-center gap-2 disabled:opacity-50"><Code2 size={16} /> {busy === 'code' ? 'در حال ساخت…' : 'تولیدِ کدِ ربات'}</button>
          <button onClick={signal} disabled={busy} className="btn-success flex items-center justify-center gap-2 disabled:opacity-50"><Radio size={16} /> {busy === 'sig' ? '…' : 'سیگنالِ زنده'}</button>
        </div>
        <button onClick={save} disabled={busy} className="btn-ghost w-full flex items-center justify-center gap-2 disabled:opacity-50"><Save size={16} /> {busy === 'save' ? 'در حال ذخیره…' : 'ذخیرهٔ استراتژی'}</button>
      </div>

      {sig && (
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm flex items-center gap-1.5"><Radio size={15} className="text-brand-green" /> سیگنالِ زنده</span>
            <span className={`text-sm font-black ${sig.signal === 'buy' ? 'text-brand-green' : sig.signal === 'sell' ? 'text-brand-red' : 'text-text-muted'}`}>{sig.signal === 'buy' ? '🟢 خرید' : sig.signal === 'sell' ? '🔴 فروش' : 'بدونِ سیگنال'}</span>
          </div>
          <div className="text-xs text-text-muted mt-1">قیمت {sig.price} · RSI {sig.rsi != null ? Math.round(sig.rsi) : '—'}{sig.sl ? ` · SL ${sig.sl} · TP ${sig.tp}` : ''}</div>
          {sig.signal !== 'none' && <button onClick={execute} className="btn-success w-full mt-3 flex items-center justify-center gap-2"><Play size={16} /> اجرا روی حسابِ مجازی</button>}
        </div>
      )}

      {code && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm flex items-center gap-1.5"><Bot size={15} className="text-brand-green" /> کدِ رباتِ تو</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-green/15 text-brand-green border border-brand-green/30">{langLabel(code.language || language)}</span>
              <button onClick={() => { navigator.clipboard?.writeText(code.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-xs text-text-muted hover:text-brand-green flex items-center gap-1">{copied ? <Check size={13} /> : <Copy size={13} />} کپی</button>
            </div>
          </div>
          <pre dir="ltr" className="bg-black/40 rounded-xl p-3 text-xs overflow-x-auto leading-6 text-text-secondary whitespace-pre-wrap">{code.code}</pre>
        </div>
      )}
      <p className="text-[11px] text-text-muted text-center mt-4 leading-6">🤖 آموزشِ تبدیلِ استراتژی به کد + اجرای سیگنال روی حسابِ مجازی. بدونِ پول و حسابِ واقعی.</p>
    </div>
  );
}
