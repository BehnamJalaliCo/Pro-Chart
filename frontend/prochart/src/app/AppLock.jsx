// صفحهٔ قفلِ اپ — ورودِ PIN با کیبوردِ عددی. تم‌آگاه، دوزبانه، لوگوی برند.
import React, { useState } from 'react';
import { Delete } from 'lucide-react';
import { verifyPin } from './lock';
import { useApp } from '../appStore';
import { tap } from './haptics';

const ACCENT = '#2962FF';

export default function AppLock({ onUnlock }) {
  const lang = useApp((s) => s.lang);
  const [pin, setPinVal] = useState('');
  const [err, setErr] = useState(false);
  const title = lang === 'fa' ? 'ورودِ رمز' : 'Enter PIN';

  const push = (d) => {
    if (pin.length >= 8) return;
    tap();
    const next = pin + d; setPinVal(next); setErr(false);
    if (next.length >= 4) {
      // تأیید با کمی تأخیر تا کاربر بتواند رقم‌های بیشتر هم بزند؛ اینجا بلافاصله برای طول ۴..۸ چک می‌کنیم
      if (verifyPin(next)) { onUnlock(); }
    }
  };
  const back = () => { tap(); setPinVal((p) => p.slice(0, -1)); setErr(false); };
  const submit = () => { if (verifyPin(pin)) onUnlock(); else { setErr(true); setPinVal(''); tap(); } };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'ok', '0', 'del'];
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center" style={{ background: 'var(--surface-default)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <img src="/logo.png" alt="Pro-Chart" style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 18 }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 18 }}>{title}</div>
      {/* نقطه‌های PIN */}
      <div className="flex gap-3 mb-8" style={err ? { animation: 'pcShake .4s' } : undefined}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? ACCENT : 'transparent', border: `2px solid ${i < pin.length ? ACCENT : 'var(--surface-border)'}`, transition: '.15s' }} />
        ))}
      </div>
      {/* کیبورد */}
      <div className="grid grid-cols-3 gap-3" style={{ width: 250 }}>
        {keys.map((k) => {
          if (k === 'del') return <button key={k} onClick={back} className="flex items-center justify-center active:scale-90 transition-transform" style={{ height: 62, borderRadius: 18, background: 'transparent', border: 0, color: 'var(--text-secondary)', cursor: 'pointer' }}><Delete size={22} /></button>;
          if (k === 'ok') return <button key={k} onClick={submit} className="flex items-center justify-center active:scale-90 transition-transform" style={{ height: 62, borderRadius: 18, background: ACCENT, border: 0, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>OK</button>;
          return <button key={k} onClick={() => push(k)} className="flex items-center justify-center active:scale-90 transition-transform tabular-nums" style={{ height: 62, borderRadius: 18, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 22, cursor: 'pointer' }} dir="ltr">{k}</button>;
        })}
      </div>
    </div>
  );
}
