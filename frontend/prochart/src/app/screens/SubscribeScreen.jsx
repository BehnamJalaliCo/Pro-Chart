// اشتراک و ارتقا (M3/M4) — کارت‌های سه tier (از /academy/pricing) + پرداختِ USDT روی BSC:
// انتخابِ پلن (ماهانه ۲۵/۳۰روز، سالانه ۲۰۰/۳۶۵ طبقِ payment/submit بک‌اند) → آدرسِ کیفِ BEP-20
// (کپی) → ثبتِ tx_hash → تأییدِ خودکار روی زنجیره → پرمیوم. overlay تمام‌صفحه روی پروفایل.
import React, { useEffect, useState } from 'react';
import { X, Crown, Check, Copy, Loader2 } from '../../bazaarnama/tvIcons';
import { api } from '../../api/client';
import { useT } from '../../i18n';
import { ACCENT } from '../ui';
import { success as hapticSuccess, tap } from '../haptics';

const PLANS = [
  { key: 'monthly', usdt: 25, daysKey: 'sub.days30' },
  { key: 'yearly', usdt: 200, daysKey: 'sub.days365' },
];

export default function SubscribeScreen({ me, onClose, onUpgraded }) {
  const t = useT();
  const [pricing, setPricing] = useState(null);
  const [plan, setPlan] = useState('monthly');
  const [tx, setTx] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { let a = true; api.pricing().then((r) => { if (a) setPricing(r || {}); }).catch(() => { if (a) setPricing({}); }); return () => { a = false; }; }, []);

  const myTier = (me && me.tier) || 'free';
  const wallet = (pricing && pricing.wallet) || '';
  const tiers = (pricing && pricing.tiers) || [];

  const copyWallet = async () => {
    try { await navigator.clipboard.writeText(wallet); setCopied(true); tap(); setTimeout(() => setCopied(false), 1600); } catch (e) { /* noop */ }
  };

  const submit = async () => {
    const h = tx.trim();
    if (!/^0x[0-9a-fA-F]{16,}$/.test(h)) { window.alert(t('sub.txPlaceholder')); return; }
    setBusy(true);
    try {
      const r = await api.bnPaymentSubmit(h, plan);
      hapticSuccess();
      window.alert(t('sub.success'));
      setTx('');
      onUpgraded && onUpgraded(r);
    } catch (e) {
      window.alert(e?.message || 'خطا');
    } finally { setBusy(false); }
  };

  const card = { background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 18 };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col pc-screen-in" style={{ background: 'var(--surface-default)' }}>
      <header className="flex-none flex items-center justify-between px-4" style={{ height: 58, borderBottom: '1px solid var(--surface-border)' }}>
        <h1 className="font-extrabold flex items-center gap-2" style={{ fontSize: 18, color: 'var(--text-primary)' }}>
          <Crown size={19} color={ACCENT} /> {t('sub.title')}
        </h1>
        <button onClick={onClose} aria-label="close" className="flex items-center justify-center active:scale-90 transition-transform"
          style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
          <X size={17} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto pc-scroll p-3 flex flex-col gap-3" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        {/* کارت‌های tier */}
        {tiers.map((ti) => {
          const isMine = ti.key === myTier;
          const isPrem = ti.key === 'premium';
          return (
            <div key={ti.key} style={{ ...card, padding: 14, ...(isMine ? { boxShadow: `0 0 0 2px ${ACCENT}` } : {}), ...(isPrem && !isMine ? { background: `linear-gradient(135deg, color-mix(in srgb, ${ACCENT} 7%, var(--surface-card)), color-mix(in srgb, #8b5cf6 8%, var(--surface-card)))` } : {}) }}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-extrabold flex items-center gap-2" style={{ fontSize: 15.5, color: 'var(--text-primary)' }}>
                  {isPrem && <Crown size={16} color="#8b5cf6" />}{t(`tier.${ti.key}`) || ti.name}
                  {isMine && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: ACCENT, borderRadius: 999, padding: '2px 8px' }}>{t('sub.current')}</span>}
                </span>
                <span className="tabular-nums font-extrabold" dir="ltr" style={{ fontSize: 14, color: ti.price_monthly ? 'var(--text-primary)' : 'var(--up)' }}>
                  {ti.price_monthly ? `${ti.price_monthly} ${t('sub.perMonth')}` : t('tier.free')}
                </span>
              </div>
              {ti.tagline && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>{ti.tagline}</div>}
              <ul className="flex flex-col gap-1.5">
                {(ti.perks || []).map((p, i) => (
                  <li key={i} className="flex items-start gap-2" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <Check size={13} color="var(--up)" style={{ flex: '0 0 auto', marginTop: 3 }} /> {p}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {/* پرداختِ BSC */}
        <div style={{ ...card, padding: 14 }}>
          <div className="font-extrabold mb-3 flex items-center gap-2" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
            💳 {t('sub.payTitle')}
          </div>

          {/* انتخابِ پلن */}
          <div className="flex gap-2 mb-3">
            {PLANS.map((p) => {
              const on = plan === p.key;
              return (
                <button key={p.key} onClick={() => { setPlan(p.key); tap(); }} className="flex-1 rounded-xl transition-colors"
                  style={{ border: `1.5px solid ${on ? ACCENT : 'var(--surface-border)'}`, background: on ? 'var(--accent-weak)' : 'var(--surface-elevated)', padding: '10px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div className="font-extrabold" style={{ fontSize: 13, color: on ? ACCENT : 'var(--text-primary)' }}>{t(`sub.plan.${p.key}`)}</div>
                  <div className="tabular-nums" dir="ltr" style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{p.usdt} USDT</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{t(p.daysKey)}</div>
                </button>
              );
            })}
          </div>

          {/* آدرسِ کیف */}
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('sub.step1')}</div>
          {wallet ? (
            <div className="flex items-center gap-2 mb-3" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-border)', borderRadius: 12, padding: '10px 12px' }}>
              <code className="flex-1 tabular-nums" dir="ltr" style={{ fontSize: 11, color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: 'monospace' }}>{wallet}</code>
              <button onClick={copyWallet} className="flex items-center gap-1 flex-none active:scale-95 transition-transform"
                style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 11, color: copied ? 'var(--up)' : '#fff', background: copied ? 'var(--up-weak)' : ACCENT, borderRadius: 9, padding: '7px 10px' }}>
                <Copy size={12} /> {copied ? t('sub.copied') : t('sub.copy')}
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 12 }}>{pricing == null ? t('common.loading') : t('sub.noWallet')}</div>
          )}

          {/* tx hash */}
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('sub.step2')}</div>
          <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder={t('sub.txPlaceholder')} dir="ltr" autoComplete="off" spellCheck={false}
            style={{ width: '100%', height: 44, borderRadius: 12, border: '1px solid var(--surface-border)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', padding: '0 12px', fontFamily: 'monospace', fontSize: 12, outline: 'none' }} />

          <button onClick={submit} disabled={busy || !wallet} className="w-full flex items-center justify-center gap-2 mt-3 active:scale-[.98] transition-transform"
            style={{ height: 48, borderRadius: 13, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14.5, color: '#fff', background: `linear-gradient(120deg, ${ACCENT}, #8b5cf6)`, opacity: busy || !wallet ? .6 : 1, boxShadow: '0 10px 24px -8px rgba(41,98,255,.5)' }}>
            {busy ? (<><Loader2 size={17} className="pc-spin" /> {t('sub.checking')}</>) : (<><Crown size={17} /> {t('sub.submit')}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
