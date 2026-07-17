// بازارها — اخبار + تقویمِ اقتصادی (سگمنت). اخبار: فیدِ خلاصه‌شده. تقویم: رویداد با نقطهٔ اهمیت + پیش‌بینی/قبلی/واقعی.
import React, { useEffect, useState } from 'react';
import { Newspaper, CalendarDays } from '../../bazaarnama/tvIcons';
import { api } from '../../api/client';
import { useT } from '../../i18n';
import { Screen, EmptyState, Loading, ACCENT } from '../ui';

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

const impColor = (imp) => {
  const n = typeof imp === 'string' ? ({ high: 3, medium: 2, low: 1 }[imp.toLowerCase()] || 1) : Number(imp) || 1;
  return n >= 3 ? 'var(--down)' : n === 2 ? 'var(--warn)' : 'var(--text-muted)';
};

export default function MarketsScreen() {
  const t = useT();
  const [sub, setSub] = useState('news');
  const [news, setNews] = useState({ loading: true, items: [] });
  const [cal, setCal] = useState({ loading: true, items: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const r = await api.bnNews(); const items = Array.isArray(r) ? r : (r && (r.news || r.items)) || []; if (alive) setNews({ loading: false, items }); }
      catch (e) { if (alive) setNews({ loading: false, items: [] }); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (sub !== 'cal' || !cal.loading) return undefined;
    let alive = true;
    (async () => {
      try { const r = await api.bnCalendar(); const items = Array.isArray(r) ? r : (r && (r.events || r.calendar || r.items)) || []; if (alive) setCal({ loading: false, items }); }
      catch (e) { if (alive) setCal({ loading: false, items: [] }); }
    })();
    return () => { alive = false; };
  }, [sub, cal.loading]);

  const openUrl = (url) => { if (url) { try { window.open(url, '_blank', 'noopener'); } catch (e) {} } };

  return (
    <Screen title={t('markets.title')} right={sub === 'news' ? <Newspaper size={20} color={ACCENT} /> : <CalendarDays size={20} color={ACCENT} />}>
      <Segmented value={sub} onChange={setSub}
        options={[{ value: 'news', label: t('markets.newsTab'), icon: <Newspaper size={14} /> }, { value: 'cal', label: t('markets.calTab'), icon: <CalendarDays size={14} /> }]} />

      {sub === 'news' ? (
        news.loading ? <Loading text={t('common.loading')} />
          : news.items.length === 0 ? <EmptyState icon={<Newspaper size={26} />} text={t('markets.empty')} />
            : (
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 16, boxShadow: 'var(--elev-1)', overflow: 'hidden', margin: '4px 12px 12px' }}>
                {news.items.map((n, i) => (
                  <button key={n.id || i} onClick={() => openUrl(n.url || n.link)} className="w-full text-start active:opacity-70 transition-opacity"
                    style={{ padding: 13, ...(i ? { borderTop: '1px solid var(--surface-border)' } : {}) }}>
                    <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.65 }}>{n.title || n.headline || '—'}</div>
                    {(n.summary || n.desc) && <div style={{ color: 'var(--text-secondary)', fontSize: 11.5, lineHeight: 1.65, marginTop: 5 }}>{(n.summary || n.desc).toString().slice(0, 150)}</div>}
                    <div className="mt-2" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                      <span style={{ color: ACCENT, fontWeight: 700 }}>{n.source || n.provider || ''}</span>
                      {(n.time || n.published || n.date) && <span> · {(n.time || n.published || n.date).toString().slice(0, 16)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )
      ) : (
        cal.loading ? <Loading text={t('common.loading')} />
          : cal.items.length === 0 ? <EmptyState icon={<CalendarDays size={26} />} text={t('cal.empty')} />
            : (
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 16, boxShadow: 'var(--elev-1)', overflow: 'hidden', margin: '4px 12px 12px' }}>
                {cal.items.map((e, i) => (
                  <div key={e.id || i} className="flex items-center gap-2.5 p-3" style={i ? { borderTop: '1px solid var(--surface-border)' } : undefined}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: impColor(e.importance ?? e.impact ?? e.imp), flex: '0 0 auto' }} />
                    <span className="tabular-nums" dir="ltr" style={{ fontSize: 11, color: 'var(--text-muted)', width: 40 }}>{(e.time || e.at || '').toString().slice(0, 5) || '—'}</span>
                    {(e.flag || e.country) && <span style={{ fontSize: 14 }}>{e.flag || ''}</span>}
                    <span className="flex-1 min-w-0"><b className="block truncate" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{e.title || e.event || e.name || '—'}</b>
                      {e.country && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.country}</span>}
                    </span>
                    <span className="flex gap-2.5" dir="ltr" style={{ fontSize: 10.5 }}>
                      <CalCell k={t('cal.forecast')} v={e.forecast ?? e.fc} />
                      <CalCell k={t('cal.prev')} v={e.previous ?? e.prev} muted />
                      <CalCell k={t('cal.actual')} v={e.actual ?? e.act} accent />
                    </span>
                  </div>
                ))}
              </div>
            )
      )}
    </Screen>
  );
}

function CalCell({ k, v, muted, accent }) {
  const val = (v == null || v === '') ? '—' : v;
  return (
    <div style={{ textAlign: 'center', minWidth: 30 }}>
      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{k}</div>
      <div className="tabular-nums" style={{ fontSize: 11, fontWeight: 800, color: accent && val !== '—' ? ACCENT : muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>{val}</div>
    </div>
  );
}
