// پروفایل — کنترلِ زبان (فا/EN) و تم (روشن/تاریک)، وضعیتِ اتصال، دربارهٔ اپ.
import React, { useEffect, useState } from 'react';
import { User, Globe, Sun, Moon, Link2, Info } from 'lucide-react';
import { api } from '../../api/client';
import { useApp } from '../../appStore';
import { useT } from '../../i18n';
import { Screen, ACCENT } from '../ui';

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex" style={{ background: 'var(--surface-elevated)', borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="flex-1 flex items-center justify-center gap-1.5 font-bold transition-colors"
            style={{ height: 36, borderRadius: 9, fontSize: 12.5, color: on ? '#fff' : 'var(--text-secondary)', background: on ? ACCENT : 'transparent' }}>
            {o.icon}{o.label}
          </button>
        );
      })}
    </div>
  );
}

function Row({ icon, label, children }) {
  return (
    <div className="flex items-center justify-between gap-3" style={{ padding: '14px 14px' }}>
      <span className="flex items-center gap-3" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600 }}>
        <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-elevated)', color: ACCENT }}>{icon}</span>
        {label}
      </span>
      {children}
    </div>
  );
}

export default function ProfileScreen() {
  const t = useT();
  const { lang, theme, setLang, setTheme } = useApp();
  const [conn, setConn] = useState(null);

  useEffect(() => {
    let alive = true;
    api.bnConnectStatus().then((r) => { if (alive) setConn(r || {}); }).catch(() => { if (alive) setConn({}); });
    return () => { alive = false; };
  }, []);

  const connected = !!(conn && (conn.lbank || conn.mt5 || conn.connected || conn.any));

  const card = { background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' };
  const divider = <div style={{ height: 1, background: 'var(--surface-border)', margin: '0 14px' }} />;

  return (
    <Screen title={t('profile.title')} right={<User size={20} color={ACCENT} />}>
      <div className="p-3 flex flex-col gap-3">
        {/* هدرِ حساب */}
        <div className="flex items-center gap-3" style={{ ...card, padding: 16 }}>
          <span className="flex items-center justify-center flex-none" style={{ width: 54, height: 54, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #8b5cf6)`, color: '#fff' }}>
            <User size={26} />
          </span>
          <div className="min-w-0">
            <div className="font-extrabold" style={{ color: 'var(--text-primary)', fontSize: 16 }}>Pro-Chart</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('profile.guest')}</div>
          </div>
        </div>

        {/* زبان */}
        <div style={{ ...card, padding: 14 }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700 }}>
            <Globe size={16} color={ACCENT} /> {t('profile.language')}
          </div>
          <Segmented
            value={lang}
            onChange={setLang}
            options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]}
          />
        </div>

        {/* تم */}
        <div style={{ ...card, padding: 14 }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700 }}>
            {theme === 'dark' ? <Moon size={16} color={ACCENT} /> : <Sun size={16} color={ACCENT} />} {t('profile.theme')}
          </div>
          <Segmented
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: t('profile.theme.light'), icon: <Sun size={14} /> },
              { value: 'dark', label: t('profile.theme.dark'), icon: <Moon size={14} /> },
            ]}
          />
        </div>

        {/* اتصال + دربارهٔ اپ */}
        <div style={card}>
          <Row icon={<Link2 size={17} />} label={t('profile.connect')}>
            <span className="font-bold" style={{ fontSize: 12, color: connected ? '#089981' : 'var(--text-muted)' }}>
              {connected ? t('profile.connected') : t('profile.notConnected')}
            </span>
          </Row>
          {divider}
          <Row icon={<Info size={17} />} label={t('profile.version')}>
            <span className="tabular-nums" dir="ltr" style={{ fontSize: 12, color: 'var(--text-muted)' }}>1.0.0</span>
          </Row>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 11.5, lineHeight: 1.8, textAlign: 'center', padding: '4px 16px' }}>
          {t('profile.aboutText')}
        </p>
      </div>
    </Screen>
  );
}
