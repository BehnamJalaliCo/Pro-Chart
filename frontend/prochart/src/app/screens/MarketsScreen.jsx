// بازارها و اخبار — فیدِ خبریِ خلاصه‌شده. کارت‌های مینیمال، تپ → بازکردنِ منبع.
import React, { useEffect, useState } from 'react';
import { Newspaper } from 'lucide-react';
import { api } from '../../api/client';
import { useT } from '../../i18n';
import { Screen, EmptyState, Loading, ACCENT } from '../ui';

export default function MarketsScreen() {
  const t = useT();
  const [state, setState] = useState({ loading: true, news: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.bnNews();
        const news = Array.isArray(r) ? r : (r && (r.news || r.items)) || [];
        if (alive) setState({ loading: false, news });
      } catch (e) { if (alive) setState({ loading: false, news: [] }); }
    })();
    return () => { alive = false; };
  }, []);

  const openUrl = (url) => { if (url) { try { window.open(url, '_blank', 'noopener'); } catch (e) {} } };

  return (
    <Screen title={t('markets.title')} right={<Newspaper size={20} color={ACCENT} />}>
      {state.loading ? (
        <Loading text={t('common.loading')} />
      ) : state.news.length === 0 ? (
        <EmptyState icon={<Newspaper size={26} />} text={t('markets.empty')} />
      ) : (
        <ul className="p-3 flex flex-col gap-2.5">
          {state.news.map((n, i) => (
            <li key={n.id || i}>
              <button onClick={() => openUrl(n.url || n.link)} className="w-full text-start active:scale-[.99] transition-transform"
                style={{ padding: 14, borderRadius: 16, background: 'var(--surface-card)', border: '1px solid var(--surface-border)' }}>
                <div className="font-bold" style={{ color: 'var(--text-primary)', fontSize: 13.5, lineHeight: 1.7 }}>
                  {n.title || n.headline || '—'}
                </div>
                {(n.summary || n.desc) && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.7, marginTop: 5 }}>
                    {(n.summary || n.desc).toString().slice(0, 160)}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2.5" style={{ color: 'var(--text-muted)', fontSize: 10.5 }}>
                  <span style={{ color: ACCENT, fontWeight: 700 }}>{n.source || n.provider || ''}</span>
                  {(n.time || n.published || n.date) && <span>· {(n.time || n.published || n.date).toString().slice(0, 16)}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
