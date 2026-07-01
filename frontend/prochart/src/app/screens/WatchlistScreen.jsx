// واچ‌لیست + پوزیشن‌ها — دو زیرنما با سگمنت. واچ‌لیست: قیمتِ زنده + اسپارک‌لاین + تغییر.
// پوزیشن‌ها: هدرِ خلاصهٔ چسبان (اکوییتی/P&L) + کارتِ پوزیشن با سود/زیان. تپ روی نماد → چارت.
import React, { useEffect, useState } from 'react';
import { List, Search, Briefcase } from 'lucide-react';
import { api } from '../../api/client';
import { useApp } from '../../appStore';
import { useT } from '../../i18n';
import { Screen, EmptyState, Loading, Sparkline, ACCENT } from '../ui';

const numf = (n) => { const v = Number(n); if (!Number.isFinite(v)) return '—'; const a = Math.abs(v); return v.toFixed(a >= 100 ? 2 : a >= 1 ? 4 : 5); };
const money = (n) => { const v = Number(n); return Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'; };

function Segmented({ value, onChange, options }) {
  return (
    <div className="flex mx-3 mt-2 mb-1" style={{ background: 'var(--surface-elevated)', borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="flex-1 flex items-center justify-center gap-1.5 font-bold transition-colors"
            style={{ height: 34, borderRadius: 9, fontSize: 12.5, color: on ? ACCENT : 'var(--text-secondary)', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--elev-1)' : 'none' }}>
            {o.icon}{o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function WatchlistScreen() {
  const t = useT();
  const setTab = useApp((s) => s.setTab);
  const [sub, setSub] = useState('watch');
  const [wl, setWl] = useState({ loading: true, rows: [] });
  const [pos, setPos] = useState({ loading: true, list: [], account: null });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const w = await api.bnWatchlist();
        const symbols = (w && w.symbols) || [];
        let pmap = {};
        if (symbols.length) { try { const p = await api.bnPrices(symbols.join(',')); pmap = (p && (p.prices || p)) || {}; } catch (e) { pmap = {}; } }
        const rows = symbols.map((s) => {
          const p = pmap[s] || {};
          const price = p.mid != null ? p.mid : (p.bid != null && p.ask != null ? (Number(p.bid) + Number(p.ask)) / 2 : (p.last != null ? p.last : p.price));
          const chg = p.change_pct != null ? p.change_pct : (p.changePct != null ? p.changePct : p.chg);
          return { symbol: s, price, chg, spark: null };
        });
        if (alive) setWl({ loading: false, rows });
        // اسپارک‌لاین‌ها را موازی و با تحملِ خطا بگیر
        rows.forEach(async (r, i) => {
          try {
            const c = await api.chart(r.symbol, 'H1', undefined, 24);
            const arr = (c && (c.candles || c.data || c)) || [];
            const closes = arr.map((k) => Number(k.c ?? k.close ?? k[4])).filter(Number.isFinite);
            if (alive && closes.length > 1) setWl((st) => { const rows2 = st.rows.slice(); if (rows2[i]) rows2[i] = { ...rows2[i], spark: closes }; return { ...st, rows: rows2 }; });
          } catch (e) { /* بی‌اسپارک */ }
        });
      } catch (e) { if (alive) setWl({ loading: false, rows: [] }); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (sub !== 'pos' || !pos.loading) return undefined;
    let alive = true;
    (async () => {
      try {
        const [pRes, aRes] = await Promise.all([
          api.paperPositions().catch(() => null),
          api.paperAccount().catch(() => null),
        ]);
        const list = Array.isArray(pRes) ? pRes : (pRes && (pRes.positions || pRes.items)) || [];
        if (alive) setPos({ loading: false, list, account: aRes || null });
      } catch (e) { if (alive) setPos({ loading: false, list: [], account: null }); }
    })();
    return () => { alive = false; };
  }, [sub, pos.loading]);

  const open = (symbol) => { if (symbol) { try { window.dispatchEvent(new CustomEvent('bn:setSymbol', { detail: symbol })); } catch (e) {} } setTab('chart'); };

  const right = sub === 'watch' ? (
    <button aria-label={t('common.search')} className="flex items-center justify-center active:scale-90 transition-transform"
      style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', color: 'var(--text-secondary)' }}>
      <Search size={17} />
    </button>
  ) : null;

  return (
    <Screen title={t('watch.title')} right={right}>
      <Segmented value={sub} onChange={setSub}
        options={[{ value: 'watch', label: t('watch.tab'), icon: <List size={14} /> }, { value: 'pos', label: t('pos.tab'), icon: <Briefcase size={14} /> }]} />

      {sub === 'watch' ? (
        wl.loading ? <Loading text={t('common.loading')} />
          : wl.rows.length === 0 ? <EmptyState icon={<List size={26} />} text={t('watch.empty')} />
            : (
              <ul className="p-3 pt-2 flex flex-col gap-2">
                {wl.rows.map((r) => {
                  const up = Number(r.chg) >= 0; const col = r.chg == null ? 'var(--text-muted)' : up ? 'var(--up)' : 'var(--down)';
                  return (
                    <li key={r.symbol}>
                      <button onClick={() => open(r.symbol)} className="w-full flex items-center gap-3 text-start active:scale-[.99] transition-transform"
                        style={{ padding: '11px 12px', borderRadius: 16, background: 'var(--surface-card)', border: '1px solid var(--surface-border)', boxShadow: 'var(--elev-1)' }}>
                        <span className="flex items-center justify-center flex-none" style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, color: '#fff', fontWeight: 800, fontSize: 11 }}>{r.symbol.slice(0, 2)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-extrabold truncate" style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{r.symbol}</span>
                          <span className="block" style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>{t('common.price')}</span>
                        </span>
                        <Sparkline data={r.spark} up={up} />
                        <span className="text-end" dir="ltr">
                          <span className="block font-extrabold tabular-nums" style={{ color: 'var(--text-primary)', fontSize: 13.5 }}>{numf(r.price)}</span>
                          <span className="inline-flex items-center gap-1 font-extrabold tabular-nums" style={{ color: col, fontSize: 11, background: r.chg == null ? 'transparent' : up ? 'var(--up-weak)' : 'var(--down-weak)', padding: '1px 6px', borderRadius: 999, marginTop: 2 }}>
                            {r.chg == null ? '—' : `${up ? '▲' : '▼'} ${Math.abs(Number(r.chg)).toFixed(2)}%`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
      ) : (
        pos.loading ? <Loading text={t('common.loading')} />
          : (
            <div className="p-3 pt-2">
              {/* هدرِ خلاصهٔ چسبان */}
              <div className="sticky top-0 z-[5]" style={{ background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, borderRadius: 18, padding: 15, color: '#fff', boxShadow: 'var(--elev-2)', marginBottom: 10 }}>
                <div style={{ fontSize: 11, opacity: .85 }}>{t('pos.equity')}</div>
                <div className="tabular-nums" dir="ltr" style={{ fontSize: 27, fontWeight: 800, marginTop: 2 }}>${money(pos.account?.equity ?? pos.account?.balance ?? 0)}</div>
                <div className="flex gap-5 mt-2.5">
                  <div style={{ fontSize: 11, opacity: .9 }}>{t('pos.today')}<b className="block tabular-nums" dir="ltr" style={{ fontSize: 14 }}>{fmtSigned(pos.account?.pnl ?? pos.account?.upnl)}</b></div>
                  <div style={{ fontSize: 11, opacity: .9 }}>{t('pos.margin')}<b className="block tabular-nums" dir="ltr" style={{ fontSize: 14 }}>${money(pos.account?.free_margin ?? pos.account?.available ?? pos.account?.balance ?? 0)}</b></div>
                </div>
              </div>

              {pos.list.length === 0 ? <EmptyState icon={<Briefcase size={26} />} text={t('pos.empty')} /> : (
                <div style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 16, boxShadow: 'var(--elev-1)', overflow: 'hidden' }}>
                  {pos.list.map((p, i) => {
                    const side = (p.side || p.direction || '').toString().toLowerCase();
                    const isBuy = side.includes('buy') || side.includes('long');
                    const pnl = Number(p.pnl ?? p.upnl ?? p.unrealized ?? 0);
                    const up = pnl >= 0;
                    return (
                      <div key={p.id || i} className="p-3" style={i ? { borderTop: '1px solid var(--surface-border)' } : undefined}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, color: '#fff', fontWeight: 800, fontSize: 10 }}>{(p.symbol || '').slice(0, 2)}</span>
                            <b style={{ fontSize: 14, color: 'var(--text-primary)' }}>{p.symbol}</b>
                            {p.leverage && <span style={{ fontSize: 10, color: 'var(--text-muted)' }} dir="ltr">{p.leverage}×</span>}
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: isBuy ? 'var(--up)' : 'var(--down)', padding: '2px 8px', borderRadius: 999 }}>{isBuy ? t('trade.buy') : t('trade.sell')}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2.5" dir="ltr">
                          <PCell k={t('pos.entry')} v={numf(p.entry ?? p.entry_price ?? p.open)} />
                          <PCell k={t('pos.current')} v={numf(p.current ?? p.price ?? p.mark)} />
                          <PCell k={t('pos.pnl')} v={fmtSigned(pnl)} color={up ? 'var(--up)' : 'var(--down)'} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
      )}
    </Screen>
  );
}

function PCell({ k, v, color }) {
  return (
    <div style={{ background: 'var(--surface-elevated)', borderRadius: 10, padding: '6px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 9.5, color: 'var(--text-muted)' }}>{k}</div>
      <div className="tabular-nums" style={{ fontSize: 12, fontWeight: 800, color: color || 'var(--text-primary)', marginTop: 2 }}>{v}</div>
    </div>
  );
}
function fmtSigned(n) { const v = Number(n); if (!Number.isFinite(v)) return '—'; const s = v >= 0 ? '+' : '−'; return `${s}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`; }
