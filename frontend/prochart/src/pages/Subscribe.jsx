import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Crown, Copy, Check, ShieldCheck, ArrowRight, Send } from 'lucide-react';
import { api } from '../api/client';

const SUPPORT_URL = 'https://t.me/CoinePro_Admin';

export default function Subscribe() {
  const nav = useNavigate();
  const { data } = useQuery({ queryKey: ['pricing'], queryFn: () => api.pricing() });
  const [tier, setTier] = useState('vip');
  const [months, setMonths] = useState(1);
  const [tx, setTx] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  const tiers = (data?.tiers || []).filter((t) => t.key !== 'free');
  const price = tiers.find((t) => t.key === tier)?.price_monthly || 0;
  const total = price * months;
  const wallet = data?.wallet || '';

  const submit = async () => {
    if (tx.trim().length < 10) { alert('هشِ تراکنش را وارد کن.'); return; }
    setBusy(true);
    try { await api.subscribe(tier, tx.trim(), months); setDone(true); }
    catch (e) { alert(e?.message || 'خطا'); } finally { setBusy(false); }
  };

  if (done) return (
    <div className="max-w-md mx-auto card p-8 text-center">
      <Check size={44} className="text-brand-green mx-auto mb-3" />
      <h2 className="font-black text-lg mb-2">درخواستت ثبت شد ✅</h2>
      <p className="text-text-secondary text-sm mb-3">پس از تأییدِ پرداخت توسطِ ادمین، اشتراکت فعال می‌شود.</p>
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3 text-sm text-right mb-4">
        <b className="text-amber-300">مهم:</b> برای فعال‌سازیِ سریع‌تر، <b>هشِ تراکنش (رسید)</b> را همین حالا برای پشتیبانی بفرست.
      </div>
      <a href={SUPPORT_URL} target="_blank" rel="noreferrer"
         className="btn-success w-full flex items-center justify-center gap-2 mb-2">
        <Send size={18} /> ارسالِ رسید به پشتیبانی
      </a>
      <button onClick={() => nav('/')} className="btn-ghost w-full">بازگشت به دوره‌ها</button>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={() => nav('/')} className="text-text-muted text-sm flex items-center gap-1 mb-4 hover:text-text-primary">
        <ArrowRight size={16} /> بازگشت
      </button>
      <h1 className="text-xl font-black flex items-center gap-2 mb-4"><Crown className="text-amber-400" /> تهیهٔ اشتراک</h1>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {tiers.map((t) => (
          <button key={t.key} onClick={() => setTier(t.key)}
            className={`card p-4 text-center ${tier === t.key ? 'ring-2 ring-brand-green' : ''}`}>
            <div className="font-black">{t.name}</div>
            <div className="text-brand-green font-black mt-1">{t.price_monthly} USDT<span className="text-xs text-text-muted">/ماه</span></div>
          </button>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <label className="text-xs text-text-muted">مدت (ماه)</label>
        <div className="flex gap-2 mt-1">
          {[1, 3, 6, 12].map((m) => (
            <button key={m} onClick={() => setMonths(m)} className={`px-3 py-1.5 rounded-lg text-sm border ${months === m ? 'bg-brand-green/15 border-brand-green text-brand-green' : 'border-surface-border text-text-secondary'}`}>{m}</button>
          ))}
        </div>
        <div className="mt-3 text-sm">مبلغِ قابلِ پرداخت: <b className="text-brand-green">{total} USDT</b> (شبکهٔ {data?.network || 'BEP-20'})</div>
      </div>

      {wallet && (
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-2 mb-2 text-sm font-bold"><ShieldCheck size={16} className="text-brand-green" /> آدرسِ کیفِ‌پول</div>
          <div className="flex items-center justify-between bg-black/30 rounded-lg p-2 gap-2">
            <span className="font-mono text-xs break-all" dir="ltr">{wallet}</span>
            <button onClick={() => { navigator.clipboard?.writeText(wallet); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-text-muted hover:text-brand-green shrink-0">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-[11px] text-text-muted mt-2">مبلغِ بالا را به این آدرس واریز کن، بعد هشِ تراکنش (TxID) را پایین وارد کن — یا مستقیم برای پشتیبانی بفرست.</p>
        </div>
      )}

      <div className="card p-4">
        <label className="text-xs text-text-muted">هشِ تراکنش (TxID)</label>
        <input value={tx} onChange={(e) => setTx(e.target.value)} dir="ltr" placeholder="0x…"
          className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2.5 text-sm mt-1 focus:outline-none focus:border-brand-green" />
        <button onClick={submit} disabled={busy} className="btn-success w-full mt-3 disabled:opacity-50">
          {busy ? 'در حال ثبت…' : 'ثبتِ پرداخت'}
        </button>
        <div className="mt-3 pt-3 border-t border-surface-border text-center">
          <p className="text-[11px] text-text-muted mb-2">بعد از پرداخت، رسید/هشِ تراکنش را برای پشتیبانی بفرست تا اشتراکت فعال شود.</p>
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1.5 text-sm text-brand-green hover:underline font-bold">
            <Send size={15} /> ارسالِ رسید به پشتیبانی (CoinePro_Admin@)
          </a>
        </div>
      </div>
    </div>
  );
}
