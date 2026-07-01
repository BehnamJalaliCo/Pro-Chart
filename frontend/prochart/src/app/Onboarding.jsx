// آنبوردینگِ بارِ اول — چند اسلاید معرفی (دوزبانه، تم‌آگاه). یک‌بار نمایش (localStorage).
import React, { useState } from 'react';
import { CandlestickChart, TrendingUp, Sparkles } from 'lucide-react';
import { useT } from '../i18n';
import { tap } from './haptics';

const ACCENT = '#2962FF';
const KEY = 'pc_onboarded_v1';

export function needsOnboarding() {
  try { return !localStorage.getItem(KEY); } catch (e) { return false; }
}

export default function Onboarding({ onDone }) {
  const t = useT();
  const [i, setI] = useState(0);
  const slides = [
    { Icon: CandlestickChart, title: t('ob.t1'), desc: t('ob.d1') },
    { Icon: TrendingUp, title: t('ob.t2'), desc: t('ob.d2') },
    { Icon: Sparkles, title: t('ob.t3'), desc: t('ob.d3') },
  ];
  const last = i === slides.length - 1;
  const finish = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* noop */ } onDone && onDone(); };
  const next = () => { tap(); if (last) finish(); else setI((n) => n + 1); };

  const S = slides[i];
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col pc-screen-in" style={{ background: 'var(--surface-default)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex justify-between items-center px-5 pt-5">
        <img src="/logo.png" alt="Pro-Chart" style={{ height: 30, width: 30, borderRadius: 8 }} />
        <button onClick={finish} className="font-bold" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('ob.skip')}</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
        <div key={i} className="pc-screen-in flex flex-col items-center gap-6">
          <div className="flex items-center justify-center" style={{ width: 116, height: 116, borderRadius: 32, background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, boxShadow: '0 20px 44px -14px rgba(41,98,255,.5)' }}>
            <S.Icon size={54} color="#fff" />
          </div>
          <h2 className="font-extrabold" style={{ fontSize: 24, color: 'var(--text-primary)' }}>{S.title}</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.9, color: 'var(--text-secondary)', maxWidth: 300 }}>{S.desc}</p>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, k) => (
            <span key={k} style={{ height: 7, borderRadius: 999, transition: 'all .3s cubic-bezier(.34,1.56,.64,1)', width: k === i ? 22 : 7, background: k === i ? ACCENT : 'var(--surface-border)' }} />
          ))}
        </div>
        <button onClick={next} className="w-full active:scale-[.98] transition-transform" style={{ height: 52, borderRadius: 16, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 16, color: '#fff', background: ACCENT, boxShadow: '0 12px 26px -8px rgba(41,98,255,.55)' }}>
          {last ? t('ob.start') : t('ob.next')}
        </button>
      </div>
    </div>
  );
}
