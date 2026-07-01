// واچ‌لیست — نمادهای دنبال‌شده با قیمتِ زنده و درصدِ تغییر. تپ روی نماد → بازکردنِ چارت.
import React, { useEffect, useState } from 'react';
import { List, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useApp } from '../../appStore';
import { useT } from '../../i18n';
import { Screen, EmptyState, Loading, ACCENT } from '../ui';

function fmt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const d = abs >= 100 ? 2 : abs >= 1 ? 4 : 5;
  return v.toFixed(d);
}

export default function WatchlistScreen() {
  const t = useT();
  const setTab = useApp((s) => s.setTab);
  const [state, setState] = useState({ loading: true, rows: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const w = await api.bnWatchlist();
        const symbols = (w && w.symbols) || [];
        let prices = {};
        if (symbols.length) {
          try { prices = (await api.bnPrices(symbols.join(','))) || {}; } catch (e) { prices = {}; }
        }
        const pmap = prices.prices || prices || {};
        const rows = symbols.map((s) => {
          const p = pmap[s] || {};
          const price = p.mid != null ? p.mid : (p.bid != null && p.ask != null ? (Number(p.bid) + Number(p.ask)) / 2 : (p.last != null ? p.last : p.price));
          const chg = p.change_pct != null ? p.change_pct : (p.changePct != null ? p.changePct : p.chg);
          return { symbol: s, price, chg };
        });
        if (alive) setState({ loading: false, rows });
      } catch (e) {
        if (alive) setState({ loading: false, rows: [] });
      }
    })();
    return () => { alive = false; };
  }, []);

  const open = (symbol) => {
    try { window.dispatchEvent(new CustomEvent('bn:setSymbol', { detail: symbol })); } catch (e) { /* noop */ }
    setTab('chart');
  };

  const right = (
    <button aria-label={t('common.search')} className="flex items-center justify-center active:scale-90 transition-transform"
      style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
      <Search size={17} />
    </button>
  );

  return (
    <Screen title={t('watch.title')} right={right}>
      {state.loading ? (
        <Loading text={t('common.loading')} />
      ) : state.rows.length === 0 ? (
        <EmptyState icon={<List size={26} />} text={t('watch.empty')} />
      ) : (
        <ul className="p-3 flex flex-col gap-2">
          {state.rows.map((r, i) => {
            const up = Number(r.chg) >= 0;
            const col = r.chg == null ? 'var(--text-muted)' : up ? '#089981' : '#f23645';
            return (
              <li key={r.symbol}>
                <button onClick={() => open(r.symbol)} className="w-full flex items-center gap-3 text-start active:scale-[.99] transition-transform"
                  style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
                  <span className="flex items-center justify-center flex-none" style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, color: '#fff', fontWeight: 800, fontSize: 11 }}>
                    {r.symbol.slice(0, 2)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-extrabold truncate" style={{ color: 'var(--text-primary)', fontSize: 14 }}>{r.symbol}</span>
                    <span className="block" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{t('common.price')}</span>
                  </span>
                  <span className="text-end" dir="ltr">
                    <span className="block font-extrabold tabular-nums" style={{ color: 'var(--text-primary)', fontSize: 14 }}>{fmt(r.price)}</span>
                    <span className="block font-bold tabular-nums" style={{ color: col, fontSize: 11.5 }}>
                      {r.chg == null ? '—' : `${up ? '▲' : '▼'} ${Math.abs(Number(r.chg)).toFixed(2)}%`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Screen>
  );
}
