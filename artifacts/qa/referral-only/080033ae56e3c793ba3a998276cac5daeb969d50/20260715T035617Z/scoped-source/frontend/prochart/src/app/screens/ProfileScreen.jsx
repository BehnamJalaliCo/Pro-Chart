// پروفایل — زبان، تم، اتصال مجاز LBank، معرفی OneRoyal، قفل اپ (PIN)، درباره اپ.
import React, { useEffect, useState } from 'react';
import { User, Globe, Sun, Moon, Link2, Info, Lock, ChevronDown, Check } from 'lucide-react';
import { api } from '../../api/client';
import { useApp } from '../../appStore';
import { useT } from '../../i18n';
import { Screen, ACCENT } from '../ui';
import { hasPin, setPin, clearPin } from '../lock';
import { bioEnabled, setBioEnabled, bioAvailable, bioVerify } from '../biometric';
import { Fingerprint, Crown, ChevronLeft } from 'lucide-react';
import SubscribeScreen from './SubscribeScreen';
import ReferralDeparture from '../../components/ReferralDeparture';

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

const card = { background: 'var(--surface-card)', border: '1px solid var(--surface-border)', borderRadius: 18, overflow: 'hidden' };
const inputCss = { width: '100%', height: 42, borderRadius: 10, border: '1px solid var(--surface-border)', background: 'var(--surface-elevated)', color: 'var(--text-primary)', padding: '0 12px', fontFamily: 'inherit', fontSize: 13, outline: 'none' };

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="block mb-1" style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
      <input {...props} style={inputCss} />
    </label>
  );
}

export default function ProfileScreen() {
  const t = useT();
  const { lang, theme, setLang, setTheme } = useApp();
  const [conn, setConn] = useState(null);
  const [open, setOpen] = useState(null); // 'lbank' | 'oneroyal' | null
  const [lb, setLb] = useState({ api_key: '', api_secret: '', uid: '' });
  const [busy, setBusy] = useState(false);
  const [pinOn, setPinOn] = useState(hasPin());
  const [bioOn, setBioOn] = useState(bioEnabled());
  const [bioCan, setBioCan] = useState(false);
  useEffect(() => { let a = true; bioAvailable().then((v) => { if (a) setBioCan(v); }); return () => { a = false; }; }, []);
  // M3/M4 — tier فعلی + صفحهٔ اشتراک
  const [me, setMe] = useState(null);
  const [showSub, setShowSub] = useState(false);
  const loadMe = () => api.me().then((r) => setMe(r || {})).catch(() => setMe({}));
  useEffect(() => { loadMe(); }, []);
  const myTier = (me && me.tier) || 'free';
  const tierColor = myTier === 'premium' ? '#8b5cf6' : myTier === 'vip' ? ACCENT : 'color-mix(in srgb, var(--text-muted) 82%, #000)';

  const refresh = () => api.bnConnectStatus().then((r) => setConn(r || {})).catch(() => setConn({}));
  useEffect(() => { let a = true; api.bnConnectStatus().then((r) => { if (a) setConn(r || {}); }).catch(() => { if (a) setConn({}); }); return () => { a = false; }; }, []);

  const lbConnected = !!(
    conn?.accounts?.lbank?.connected || conn?.lbank || conn?.lbank_connected
  );

  const saveLbank = async () => {
    setBusy(true);
    try { await api.bnConnectLbank(lb.api_key.trim(), lb.api_secret.trim(), lb.uid.trim()); window.alert(t('connect.saved')); setOpen(null); setLb({ api_key: '', api_secret: '', uid: '' }); refresh(); }
    catch (e) { window.alert(e?.message || t('connect.error')); } finally { setBusy(false); }
  };
  const removeLbank = async () => { try { await api.bnDisconnectLbank(); refresh(); } catch (e) { /* noop */ } };

  const toggleLock = () => {
    if (pinOn) { clearPin(); setPinOn(false); setBioEnabled(false); setBioOn(false); return; } // خاموش‌کردنِ PIN بیومتریک را هم غیرفعال می‌کند
    const p = window.prompt(lang === 'fa' ? 'یک PIN چهاررقمی وارد کن:' : 'Enter a 4-digit PIN:');
    if (p && /^\d{4,8}$/.test(p.trim())) { setPin(p.trim()); setPinOn(true); }
    else if (p != null) window.alert(lang === 'fa' ? 'PIN باید ۴ تا ۸ رقم باشد.' : 'PIN must be 4-8 digits.');
  };
  const toggleBio = async () => {
    if (bioOn) { setBioEnabled(false); setBioOn(false); return; }
    const ok = await bioVerify(lang === 'fa' ? 'تأییدِ هویت' : 'Verify identity');
    if (ok) { setBioEnabled(true); setBioOn(true); }
  };

  const divider = <div style={{ height: 1, background: 'var(--surface-border)', margin: '0 14px' }} />;
  const connCard = (kind, title, connected, body) => (
    <div style={card}>
      <button onClick={() => setOpen((o) => (o === kind ? null : kind))} className="w-full flex items-center justify-between" style={{ padding: '13px 14px' }}>
        <span className="flex items-center gap-3" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 700 }}>
          <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-elevated)', color: ACCENT }}><Link2 size={17} /></span>
          {title}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-bold" style={{ fontSize: 11.5, color: connected ? 'color-mix(in srgb, var(--up) 68%, var(--text-primary))' : 'var(--text-secondary)' }}>{connected ? t('profile.connected') : t('profile.notConnected')}</span>
          <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: open === kind ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }} />
        </span>
      </button>
      {open === kind && (
        <div className="pc-screen-in" style={{ padding: '0 14px 14px' }}>
          {body}
          <div className="flex gap-2 mt-3">
            <button onClick={saveLbank} disabled={busy} className="flex-1 font-bold active:scale-[.98] transition-transform"
              style={{ height: 44, borderRadius: 11, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: '#fff', background: ACCENT, opacity: busy ? .6 : 1 }}>{t('connect.save')}</button>
            {connected && <button onClick={removeLbank} className="font-bold" style={{ height: 44, padding: '0 14px', borderRadius: 11, border: '1px solid var(--surface-border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--down)', background: 'transparent' }}>{t('connect.remove')}</button>}
          </div>
          <p style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 8 }}>{t('connect.hint')}</p>
        </div>
      )}
    </div>
  );

  return (
    <Screen title={t('profile.title')} right={<User size={20} color={ACCENT} />}>
      <div className="p-3 flex flex-col gap-3">
        {/* هدرِ حساب */}
        <div className="flex items-center gap-3" style={{ ...card, padding: 16 }}>
          <span className="flex items-center justify-center flex-none" style={{ width: 54, height: 54, borderRadius: '50%', overflow: 'hidden', background: '#0b0e14' }}>
            <img src="/logo.png" alt="Pro-Chart" style={{ width: 54, height: 54, objectFit: 'cover' }} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold" style={{ color: 'var(--text-primary)', fontSize: 16 }}>{(me && (me.full_name || me.username)) || 'Pro-Chart'}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{(me && me.username) ? me.username : t('profile.guest')}</div>
          </div>
          {/* نشانِ tier (M3) */}
          <span className="flex items-center gap-1 flex-none font-extrabold" style={{ fontSize: 11, color: '#fff', background: tierColor, borderRadius: 999, padding: '4px 10px' }}>
            {myTier !== 'free' && <Crown size={12} />} {t(`tier.${myTier}`)}
          </span>
        </div>

        {/* اشتراک و ارتقا (M4) */}
        <div style={card}>
          <button onClick={() => setShowSub(true)} className="w-full flex items-center justify-between" style={{ padding: '14px 14px' }}>
            <span className="flex items-center gap-3" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 700 }}>
              <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, var(--accent-weak), rgba(139,92,246,.15))', color: '#8b5cf6' }}><Crown size={17} /></span>
              {t('sub.title')}
            </span>
            <span className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              {myTier !== 'premium' && <span style={{ fontSize: 11, fontWeight: 800, color: 'color-mix(in srgb, #8b5cf6 72%, var(--text-primary))' }}>{t('sub.upgrade')}</span>}
              <ChevronLeft size={16} />
            </span>
          </button>
        </div>

        {/* زبان */}
        <div style={{ ...card, padding: 14 }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700 }}><Globe size={16} color={ACCENT} /> {t('profile.language')}</div>
          <Segmented value={lang} onChange={setLang} options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]} />
        </div>

        {/* تم */}
        <div style={{ ...card, padding: 14 }}>
          <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)', fontSize: 12.5, fontWeight: 700 }}>{theme === 'dark' ? <Moon size={16} color={ACCENT} /> : <Sun size={16} color={ACCENT} />} {t('profile.theme')}</div>
          <Segmented value={theme} onChange={setTheme} options={[{ value: 'light', label: t('profile.theme.light'), icon: <Sun size={14} /> }, { value: 'dark', label: t('profile.theme.dark'), icon: <Moon size={14} /> }]} />
        </div>

        {/* اتصالِ واقعیِ بروکر/صرافی */}
        <div className="flex items-center gap-2 mt-1 px-1" style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}><Link2 size={15} color={ACCENT} /> {t('profile.connect')}</div>
        {connCard('lbank', t('connect.lbankTitle'), lbConnected, (
          <div className="flex flex-col gap-2.5">
            <ReferralDeparture provider="LBank" buttonLabel="لینک معرفی — ورود به وب‌سایت LBank" compact
              buttonClassName="w-full font-bold" buttonStyle={{ minHeight: 42, borderRadius: 10, border: '1px solid var(--surface-border)', color: 'var(--text-primary)', background: 'var(--surface-elevated)' }} />
            <Field label={t('connect.apiKey')} value={lb.api_key} onChange={(e) => setLb({ ...lb, api_key: e.target.value })} dir="ltr" autoComplete="off" />
            <Field label={t('connect.apiSecret')} type="password" value={lb.api_secret} onChange={(e) => setLb({ ...lb, api_secret: e.target.value })} dir="ltr" autoComplete="off" />
            <Field label={t('connect.uid')} value={lb.uid} onChange={(e) => setLb({ ...lb, uid: e.target.value })} dir="ltr" autoComplete="off" />
          </div>
        ))}
        <div style={card}>
          <button type="button" onClick={() => setOpen((value) => (value === 'oneroyal' ? null : 'oneroyal'))}
            className="w-full flex items-center justify-between" style={{ padding: '13px 14px' }}>
            <span className="flex items-center gap-3" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 700 }}>
              <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-elevated)', color: ACCENT }}><Link2 size={17} /></span>
              معرفی OneRoyal
            </span>
            <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 700 }}>
              فقط معرفی
              <ChevronDown size={16} style={{ transform: open === 'oneroyal' ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }} />
            </span>
          </button>
          {open === 'oneroyal' && (
            <div className="pc-screen-in" style={{ padding: '0 14px 14px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.9, marginBottom: 8 }}>
                OneRoyal در Pro Chart فقط به‌عنوان مسیر معرفی نمایش داده می‌شود؛ اتصال حساب و معاملهٔ مستقیم فعال نیست.
              </p>
              <ReferralDeparture provider="OneRoyal" buttonLabel="لینک معرفی — ورود به وب‌سایت OneRoyal" compact
                buttonClassName="w-full font-bold" buttonStyle={{ minHeight: 42, borderRadius: 10, border: '1px solid var(--surface-border)', color: 'var(--text-primary)', background: 'var(--surface-elevated)' }} />
            </div>
          )}
        </div>

        {/* امنیت — قفلِ اپ */}
        <div style={card}>
          <button onClick={toggleLock} className="w-full flex items-center justify-between" style={{ padding: '14px 14px' }}>
            <span className="flex items-center gap-3" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600 }}>
              <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-elevated)', color: ACCENT }}><Lock size={17} /></span>
              {t('profile.applock')}
            </span>
            <span className="flex items-center justify-center" style={{ width: 46, height: 26, borderRadius: 999, background: pinOn ? ACCENT : 'var(--surface-elevated)', transition: '.25s', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 3, insetInlineStart: pinOn ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .25s cubic-bezier(.34,1.56,.64,1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pinOn && <Check size={12} color={ACCENT} />}</span>
            </span>
          </button>
          {/* بیومتریک — فقط اگر دستگاه پشتیبانی کند و PIN به‌عنوانِ fallback فعال باشد */}
          {bioCan && pinOn && (<>
            {divider}
            <button onClick={toggleBio} className="w-full flex items-center justify-between" style={{ padding: '14px 14px' }}>
              <span className="flex items-center gap-3" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600 }}>
                <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-elevated)', color: ACCENT }}><Fingerprint size={17} /></span>
                {t('profile.biometric')}
              </span>
              <span className="flex items-center justify-center" style={{ width: 46, height: 26, borderRadius: 999, background: bioOn ? ACCENT : 'var(--surface-elevated)', transition: '.25s', position: 'relative' }}>
                <span style={{ position: 'absolute', top: 3, insetInlineStart: bioOn ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start .25s cubic-bezier(.34,1.56,.64,1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{bioOn && <Check size={12} color={ACCENT} />}</span>
              </span>
            </button>
          </>)}
        </div>

        {/* دربارهٔ اپ */}
        <div style={card}>
          <div className="flex items-center justify-between" style={{ padding: '14px 14px' }}>
            <span className="flex items-center gap-3" style={{ color: 'var(--text-primary)', fontSize: 13.5, fontWeight: 600 }}>
              <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-elevated)', color: ACCENT }}><Info size={17} /></span>{t('profile.version')}
            </span>
            <span className="tabular-nums" dir="ltr" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>1.0.0</span>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: 11.5, lineHeight: 1.8, textAlign: 'center', padding: '4px 16px' }}>{t('profile.aboutText')}</p>
      </div>

      {/* صفحهٔ اشتراک/پرداختِ BSC (M4) */}
      {showSub && <SubscribeScreen me={me} onClose={() => setShowSub(false)} onUpgraded={() => { loadMe(); setShowSub(false); }} />}
    </Screen>
  );
}
