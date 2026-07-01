// سیگنال‌های AI — ستاپ‌های فعالِ هوش مصنوعی با ورود/حدضرر/اهداف. تپ → بازکردنِ چارتِ همان نماد.
import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { useApp } from '../../appStore';
import { useT } from '../../i18n';
import { Screen, EmptyState, Loading, ACCENT } from '../ui';

function num(n) { const v = Number(n); return Number.isFinite(v) ? v : null; }
function fmt(n) { const v = num(n); if (v == null) return '—'; const a = Math.abs(v); return v.toFixed(a >= 100 ? 2 : a >= 1 ? 4 : 5); }

export default function AiScreen() {
  const t = useT();
  const setTab = useApp((s) => s.setTab);
  const [state, setState] = useState({ loading: true, list: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.bnAiActive();
        const list = Array.isArray(r) ? r : (r && (r.signals || r.active || r.items)) || [];
        if (alive) setState({ loading: false, list });
      } catch (e) { if (alive) setState({ loading: false, list: [] }); }
    })();
    return () => { alive = false; };
  }, []);

  const open = (symbol) => {
    if (symbol) { try { window.dispatchEvent(new CustomEvent('bn:setSymbol', { detail: symbol })); } catch (e) {} }
    setTab('chart');
  };

  return (
    <Screen title={t('ai.title')} right={<Sparkles size={20} color={ACCENT} />}>
      {state.loading ? (
        <Loading text={t('common.loading')} />
      ) : state.list.length === 0 ? (
        <EmptyState icon={<Sparkles size={26} />} text={t('ai.empty')} />
      ) : (
        <ul className="p-3 flex flex-col gap-3">
          {state.list.map((s, i) => {
            const dir = (s.direction || s.side || '').toString().toLowerCase();
            const isBuy = dir.includes('buy') || dir.includes('long');
            const col = isBuy ? '#089981' : '#f23645';
            const tps = s.tps || [s.tp1, s.tp2, s.tp3].filter((x) => x != null);
            return (
              <li key={s.id || i}>
                <button onClick={() => open(s.symbol)} className="w-full text-start active:scale-[.99] transition-transform"
                  style={{ padding: 14, borderRadius: 18, background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-extrabold" style={{ color: 'var(--text-primary)', fontSize: 15 }}>{s.symbol || '—'} <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}>{s.tf || ''}</span></span>
                    <span className="font-bold" style={{ fontSize: 12, color: '#fff', background: col, padding: '3px 10px', borderRadius: 20 }}>
                      {isBuy ? t('ai.buy') : t('ai.sell')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2" dir="ltr">
                    <Cell label={t('ai.entry')} value={fmt(s.entry)} color={ACCENT} />
                    <Cell label={t('ai.sl')} value={fmt(s.sl)} color="#ef4444" />
                    <Cell label={t('ai.tp')} value={fmt(tps[0])} color="#22c55e" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}

function Cell({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface-elevated)', borderRadius: 12, padding: '8px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
      <div className="tabular-nums font-extrabold" style={{ fontSize: 13, color }}>{value}</div>
    </div>
  );
}
