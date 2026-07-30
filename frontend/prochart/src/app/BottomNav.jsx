// نوارِ ناوبریِ پایین — مینیمال، شست‌محور، با انیمیشنِ فنری و دکمهٔ AIِ برجسته (FAB).
// RTL/LTR-safe: هر تب پیلِ فعالِ خودش را دارد (بدونِ محاسبهٔ پیکسلیِ شکننده).
import React from 'react';
import { CandlestickChart, List, Sparkles, Newspaper, User } from '../bazaarnama/tvIcons';
import { useApp } from '../appStore';
import { useT } from '../i18n';
import { tap } from './haptics';

const ACCENT = '#2962FF';

const TABS = [
  { id: 'chart', key: 'nav.chart', Icon: CandlestickChart },
  { id: 'watchlist', key: 'nav.watchlist', Icon: List },
  { id: 'ai', key: 'nav.ai', Icon: Sparkles, fab: true },
  { id: 'markets', key: 'nav.markets', Icon: Newspaper },
  { id: 'profile', key: 'nav.profile', Icon: User },
];

export default function BottomNav() {
  const tab = useApp((s) => s.tab);
  const setTabRaw = useApp((s) => s.setTab);
  const setTab = (id) => { if (id !== tab) tap(); setTabRaw(id); };
  const t = useT();

  return (
    <nav
      className="relative flex items-stretch justify-around flex-none"
      style={{
        height: 68,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'color-mix(in srgb, var(--surface-card) 88%, transparent)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderTop: '1px solid var(--surface-border)',
      }}
    >
      {TABS.map(({ id, key, Icon, fab }) => {
        const on = tab === id;
        if (fab) {
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-label={t(key)}
              className="relative z-[1] flex-1 flex items-center justify-center"
            >
              {/* امضای برند (LUXE §۲.۳): تینتِ بنفشِ تخت + آیکونِ accentAi — گرادیانت/گلو ممنوع */}
              <span
                className="flex items-center justify-center transition-transform duration-300 active:scale-90"
                style={{
                  width: 44, height: 44, marginTop: -12, borderRadius: 14,
                  background: 'rgba(139,92,246,.12)',
                  border: '1px solid var(--pc-border)',
                  boxShadow: 'var(--pc-shadow-chip)',
                  transform: on ? 'translateY(-2px) scale(1.04)' : 'none',
                  transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)',
                }}
              >
                <Icon size={20} color="#8b5cf6" />
              </span>
            </button>
          );
        }
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-label={t(key)}
            className="relative z-[1] flex-1 flex flex-col items-center justify-center gap-1"
            style={{ color: on ? ACCENT : 'var(--text-secondary)' }}
          >
            {/* تبِ فعال = فقط متن/آیکونِ accent (LUXE §۲) — بدونِ پیلِ پرشده */}
            <Icon
              size={20}
              className="relative"
              style={{
                transition: 'transform .35s cubic-bezier(.34,1.56,.64,1)',
                transform: on ? 'translateY(-1px) scale(1.08)' : 'none',
              }}
            />
            <span className="relative" style={{ fontSize: 11, fontWeight: on ? 600 : 500 }}>{t(key)}</span>
          </button>
        );
      })}
    </nav>
  );
}
