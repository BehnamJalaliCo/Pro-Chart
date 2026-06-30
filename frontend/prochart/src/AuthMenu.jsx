import React from 'react';
import {
  Menu, X, LogIn, UserPlus, Crown, LogOut, User, Loader2, Eye, EyeOff,
  ExternalLink, Sparkles, Code2, LineChart, List, Bell, Search, CalendarDays,
  HelpCircle, Send, LifeBuoy, FileText, ChevronLeft, ArrowUpRight,
} from 'lucide-react';
import { api, tokenStore } from './api/client';

// آدرسِ پنلِ کاربری (ثبت‌نام/پرداخت/بروکر). از env قابلِ تنظیم؛ پیش‌فرضِ امن.
const PANEL_URL = (import.meta.env && import.meta.env.VITE_USER_PANEL_URL) || 'https://user.pro-chart.com';
// رویدادِ سفارشی برای ارتباط با والد (BazaarNama.jsx) بدونِ prop-drilling
const fire = (name, detail) => {
  try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* noop */ }
};

// ورودیِ رمز با آیکونِ چشم (نمایش/مخفی‌کردنِ رمز)
function PasswordField({ P, value, onChange, placeholder }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input className={inpCls + ' pl-9'} style={fieldStyle(P)} type={show ? 'text' : 'password'}
             placeholder={placeholder} value={value} onChange={onChange} dir="ltr" />
      <button type="button" onClick={() => setShow((s) => !s)} tabIndex={-1}
              className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
              style={{ color: P.text }} title={show ? 'مخفی' : 'نمایش'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// منوی همبرگری ورود/ثبت‌نام/اشتراک — theme-aware (روشن/تاریک) + انیمیشنِ نرم.
const authStore = {
  get: () => { try { return JSON.parse(localStorage.getItem('bn_auth') || 'null'); } catch (e) { return null; } },
  set: (v) => localStorage.setItem('bn_auth', JSON.stringify(v)),
  clear: () => localStorage.removeItem('bn_auth'),
};
const tierLabel = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };

// پالتِ رنگ بر اساسِ تم
function palette(dark) {
  return dark
    ? { panel: '#0f1117', card: '#161923', border: 'rgba(255,255,255,.10)', text: '#e4e6ed', sub: 'rgba(255,255,255,.6)', field: '#0f1117', fieldBorder: '#2a2e3d', soft: 'rgba(255,255,255,.05)', softHover: 'rgba(255,255,255,.1)' }
    : { panel: '#ffffff', card: '#ffffff', border: 'rgba(15,23,42,.10)', text: '#0f172a', sub: 'rgba(15,23,42,.55)', field: '#f8fafc', fieldBorder: '#e2e8f0', soft: 'rgba(15,23,42,.04)', softHover: 'rgba(15,23,42,.08)' };
}

export default function AuthMenu({ theme = 'dark', panelUrl }) {
  const dark = theme !== 'light';
  const P = palette(dark);
  const [open, setOpen] = React.useState(false);
  const [shown, setShown] = React.useState(false);      // برای انیمیشنِ نرم (mount→slide)
  const [view, setView] = React.useState(null);
  const [auth, setAuth] = React.useState(authStore.get());

  // اجازهٔ override به والد برای آدرسِ پنل (backward-compatible؛ propِ اختیاری)
  const goPanel = React.useCallback((path = '') => {
    const base = panelUrl || PANEL_URL;
    try { window.open(base + path, '_blank', 'noopener'); } catch (e) { /* noop */ }
  }, [panelUrl]);

  React.useEffect(() => {
    if (open) { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }
    setShown(false);
  }, [open]);
  React.useEffect(() => {
    if (open && auth) api.me().then((m) => { if (m?.tier) { const a = { ...auth, tier: m.tier }; authStore.set(a); setAuth(a); } }).catch(() => {});
  }, [open]); // eslint-disable-line
  const close = () => { setShown(false); setView(null); setTimeout(() => setOpen(false), 220); };

  const onAuthed = (username, tier) => { const a = { username, tier: tier || 'free' }; authStore.set(a); setAuth(a); setView(null); close(); setTimeout(() => location.reload(), 250); };
  const logout = () => { authStore.clear(); tokenStore.clear(); location.reload(); };

  // شورت‌کاتِ فیچرها: رویداد به والد + بستنِ منو
  const feature = (name, detail) => { fire(name, detail); close(); };

  return (
    <>
      <button onClick={() => setOpen(true)} title="حساب / ورود / ثبت‌نام"
              className="p-1.5 rounded-md transition-colors duration-[120ms]"
              style={{ background: P.soft, color: P.text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = P.softHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = P.soft)}>
        <Menu size={16} />
      </button>

      {open && (
        <div dir="rtl" className="fixed inset-0 z-[150]" onClick={close}>
          {/* backdrop با fade نرم */}
          <div className="absolute inset-0 transition-opacity duration-200"
               style={{ background: 'rgba(0,0,0,.45)', opacity: shown ? 1 : 0 }} />
          {/* پنل با slide نرم */}
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] flex flex-col shadow-2xl transition-transform duration-200 ease-out"
               style={{ background: P.panel, color: P.text, borderLeft: `1px solid ${P.border}`,
                        transform: shown ? 'translateX(0)' : 'translateX(100%)' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="font-extrabold">Pro<span className="text-indigo-400">·</span>Chart</div>
              <button onClick={close} className="opacity-60 hover:opacity-100 transition-opacity"><X size={18} /></button>
            </div>

            <div className="p-4 overflow-auto flex-1">
              {/* کارتِ کاربر */}
              <div className="rounded-xl p-3 mb-4 flex items-center gap-3" style={{ background: P.soft }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(99,102,241,.25)' }}>
                  {auth ? <Crown size={18} className="text-amber-400" /> : <User size={18} style={{ color: P.sub }} />}
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate">{auth ? auth.username : 'کاربرِ مهمان'}</div>
                  <div className="text-[12px]" style={{ color: P.sub }}>{auth ? `اشتراک: ${tierLabel[auth.tier] || auth.tier}` : 'بدونِ حساب'}</div>
                </div>
              </div>

              {!view ? (
                <>
                  {/* جایگاهِ تبلیغِ بالا (مدیریت‌پذیر از ادمین) */}
                  <AdSlot P={P} slot="menu_top" tier={auth?.tier} />

                  {/* بخشِ حساب */}
                  <Section P={P} title="حساب">
                    {!auth ? (<>
                      <MenuBtn P={P} icon={<LogIn size={16} />} label="ورود به حساب" onClick={() => setView('login')} />
                      <MenuBtn P={P} icon={<UserPlus size={16} />} label="ثبت‌نام در پنلِ کاربری" external accent onClick={() => goPanel('/register?from=chart')} />
                    </>) : (
                      <MenuBtn P={P} icon={<LogOut size={16} />} label="خروج از حساب" onClick={logout} danger />
                    )}
                    <MenuBtn P={P} icon={<User size={16} />} label="پنلِ کاربری (حساب · اشتراک · بروکر)" external onClick={() => goPanel('/?from=chart')} />
                  </Section>

                  {/* ارتقا به پریمیوم (بدونِ آدرسِ خام) */}
                  <Section P={P} title="ارتقا به پریمیوم">
                    <PremiumPitch P={P} onUpgrade={() => goPanel('/subscribe?from=chart')} />
                  </Section>

                  {/* امکاناتِ بازارنما (شورت‌کاتِ فیچرها) */}
                  <Section P={P} title="امکاناتِ بازارنما">
                    <div className="grid grid-cols-3 gap-2">
                      <FeatureChip P={P} icon={<List size={18} />}        label="واچ‌لیست"  onClick={() => feature('bn:rightTab', 'watch')} />
                      <FeatureChip P={P} icon={<Bell size={18} />}        label="آلارم‌ها"  onClick={() => feature('bn:rightTab', 'alerts')} />
                      <FeatureChip P={P} icon={<Search size={18} />}      label="اسکرینر"   onClick={() => feature('bn:rightTab', 'screener')} />
                      <FeatureChip P={P} icon={<CalendarDays size={18} />} label="تقویم"     onClick={() => feature('bn:rightTab', 'calendar')} />
                      <FeatureChip P={P} icon={<Code2 size={18} />}       label="نمااسکریپت" onClick={() => feature('bn:openScript')} />
                      <FeatureChip P={P} icon={<HelpCircle size={18} />}  label="راهنما"    onClick={() => feature('bn:help')} />
                    </div>
                  </Section>

                  {/* جایگاهِ تبلیغِ پایین (مدیریت‌پذیر از ادمین) */}
                  <AdSlot P={P} slot="menu_inline" tier={auth?.tier} compact />

                  {/* پشتیبانی و اجتماعی */}
                  <Section P={P} title="پشتیبانی و اجتماعی">
                    <MenuBtn P={P} icon={<Send size={16} />}      label="کانالِ تلگرام" external onClick={() => feature('bn:telegram')} />
                    <MenuBtn P={P} icon={<LifeBuoy size={16} />}  label="پشتیبانی"      external onClick={() => feature('bn:support')} />
                    <MenuBtn P={P} icon={<FileText size={16} />}  label="قوانین و حریمِ خصوصی" external onClick={() => feature('bn:terms')} />
                  </Section>

                  <div className="text-center text-[11px] pt-1" style={{ color: P.sub }}>نسخه ۱.۰ · بازارنما</div>
                </>
              ) : (
                <button onClick={() => setView(null)} className="mb-3 flex items-center gap-1 text-[12px] opacity-70 hover:opacity-100">
                  <ChevronLeft size={14} /> بازگشت به منو
                </button>
              )}

              {view === 'login' && <LoginForm P={P} onBack={() => setView(null)} onAuthed={onAuthed} onPanel={() => goPanel('/?from=chart')} />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// سرگروهِ بخش‌ها — عنوانِ کوچک + فاصله‌گذاریِ یکنواخت
function Section({ P, title, children }) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-bold mb-2 px-1 uppercase tracking-wide" style={{ color: P.sub }}>{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MenuBtn({ P, icon, label, onClick, accent, danger, external }) {
  const style = accent ? { background: '#4f46e5', color: '#fff' }
    : danger ? { background: 'rgba(239,68,68,.18)', color: '#f87171' }
    : { background: P.soft, color: P.text };
  return (
    <button onClick={onClick} style={style}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-transform duration-100 hover:scale-[1.01] active:scale-[.99]">
      {icon}<span className="flex-1 text-right">{label}</span>
      {external && <ArrowUpRight size={14} className="opacity-70 shrink-0" />}
    </button>
  );
}

// چیپِ فیچر — شبکهٔ سه‌تایی (سبکِ TradingView right-rail)
function FeatureChip({ P, icon, label, onClick }) {
  return (
    <button onClick={onClick}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[11px] font-medium transition-transform duration-100 hover:scale-[1.03] active:scale-[.97]"
            style={{ background: P.soft, color: P.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = P.softHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = P.soft)}>
      <span className="text-indigo-400">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function fieldStyle(P) { return { background: P.field, border: `1px solid ${P.fieldBorder}`, color: P.text }; }
const inpCls = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition';

// ── بازاریابیِ پریمیومِ تمیز (G1) — کارت‌های مزیت، بدونِ آدرسِ کیف‌پولِ خام ──
function PremiumPitch({ P, onUpgrade }) {
  const [pr, setPr] = React.useState(null);
  React.useEffect(() => { api.pricing().then(setPr).catch(() => {}); }, []);
  // قیمت‌ها به‌صورتِ «از N تتر در ماه»؛ هیچ آدرسِ واریزی در منو رندر نمی‌شود.
  const monthly = pr?.monthly_usdt ?? pr?.premium_monthly ?? 15;
  const PERKS = [
    { icon: <Sparkles size={16} />,  t: 'هوشِ مصنوعی',     d: 'سیگنالِ زندهٔ هوشمند روی هر نماد و تایم‌فریم' },
    { icon: <Code2 size={16} />,     t: 'نمااسکریپت',      d: 'نوشتنِ اندیکاتور و استراتژیِ اختصاصی' },
    { icon: <LineChart size={16} />, t: 'تریدِ روی چارت',  d: 'اجرای سفارش روی البنک / وان‌رویال' },
  ];
  return (
    <div className="space-y-2">
      <div className="rounded-xl p-3 space-y-2.5" style={{ background: P.soft, border: `1px solid ${P.border}` }}>
        {PERKS.map((k) => (
          <div key={k.t} className="flex items-start gap-3">
            <span className="mt-0.5 text-amber-400 shrink-0">{k.icon}</span>
            <div className="min-w-0">
              <div className="font-bold text-sm">{k.t}</div>
              <div className="text-[12px] leading-5" style={{ color: P.sub }}>{k.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center text-[13px]" style={{ color: P.sub }}>
        از <b className="text-indigo-400">{monthly} تتر</b> در ماه
      </div>
      <button onClick={onUpgrade}
              className="w-full py-2.5 rounded-xl bg-gradient-to-l from-amber-500 to-indigo-600 text-white font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[.99]">
        ارتقا و پرداخت در پنلِ کاربری <ExternalLink size={14} />
      </button>
      <p className="text-[11px] text-center leading-5" style={{ color: P.sub }}>
        پرداخت امن داخلِ پنل انجام می‌شود؛ پس از تأیید، قفلِ امکانات باز می‌شود.
      </p>
    </div>
  );
}

// ── جایگاهِ تبلیغاتیِ مدیریت‌پذیر از ادمین (G4) ──
// داده از API می‌آید (api.bnAds یا fallbackِ مستقیم به /academy/bn/ads). نبودِ تبلیغ ⇒ هیچ فضای خالی.
async function fetchAds(slot) {
  // ۱) اگر متدِ اختصاصیِ client اضافه شده باشد، از آن استفاده کن (forward-compatible)
  if (typeof api.bnAds === 'function') {
    try { const r = await api.bnAds(slot); return (r && r.ads) || []; } catch (e) { return null; }
  }
  // ۲) fallback مستقیم به اندپوینتِ عمومی با همان baseURL و توکنِ آکادمی (اگر بود)
  try {
    const base = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
    const headers = {};
    try { const t = tokenStore.get(); if (t) headers.Authorization = `Bearer ${t}`; } catch (e) { /* noop */ }
    const res = await fetch(`${base}/academy/bn/ads?slot=${encodeURIComponent(slot)}`, { headers });
    if (!res.ok) return null;
    const j = await res.json();
    return (j && j.ads) || [];
  } catch (e) { return null; }
}
function adClick(ad) {
  try {
    if (typeof api.bnAdClick === 'function') { api.bnAdClick(ad.id); }
    else {
      const base = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
      fetch(`${base}/academy/bn/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
    }
  } catch (e) { /* noop */ }
  try { window.open(ad.cta_url, '_blank', 'noopener'); } catch (e) { /* noop */ }
}

function AdSlot({ P, slot, tier, compact }) {
  const [ad, setAd] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    fetchAds(slot).then((ads) => {
      if (!alive) return;
      const pick = pickAd(ads, tier);
      setAd(pick);
    });
    return () => { alive = false; };
  }, [slot, tier]);

  if (!ad) return null;  // نبودِ تبلیغ ⇒ فضای خالی اشغال نمی‌شود
  const logo = ad.logo_url || ad.logo_path;
  const onLight = !!ad.bg_color; // اگر رنگِ سفارشی داشت، متن/CTA روی پس‌زمینهٔ پررنگ
  return (
    <div className="mb-4">
      <button onClick={() => adClick(ad)}
              className={`w-full text-right rounded-xl flex items-center gap-3 transition-transform hover:scale-[1.01] active:scale-[.99] ${compact ? 'p-2.5' : 'p-3'}`}
              style={{ background: ad.bg_color || P.soft, border: `1px solid ${P.border}`, color: onLight ? '#fff' : P.text }}>
        {logo && <img src={logo} alt="" loading="lazy" className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg object-contain shrink-0 bg-white/90 p-0.5`} />}
        <div className="min-w-0 flex-1">
          <div className={`font-bold ${compact ? 'text-[13px]' : 'text-sm'} truncate`}>{ad.title}</div>
          {ad.body && !compact && <div className="text-[11px] leading-5 opacity-80 line-clamp-2">{ad.body}</div>}
        </div>
        {ad.cta_label && (
          <span className="shrink-0 text-[11px] px-2 py-1 rounded-lg flex items-center gap-1"
                style={{ background: onLight ? 'rgba(255,255,255,.18)' : P.softHover }}>
            {ad.cta_label}<ArrowUpRight size={12} />
          </span>
        )}
      </button>
    </div>
  );
}

// انتخابِ تبلیغ از فهرست: تیرِ هدف + اولویت (سرور هم همین را اعمال می‌کند؛ این لایهٔ دفاعیِ کلاینت است)
function pickAd(ads, tier) {
  if (!Array.isArray(ads) || ads.length === 0) return null;
  const t = tier || 'free';
  const eligible = ads.filter((a) => {
    if (a.active === false) return false;
    const tt = a.target_tier || 'all';
    return tt === 'all' || tt === t;
  });
  const pool = eligible.length ? eligible : ads;
  pool.sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.id || 0) - (a.id || 0));
  return pool[0] || null;
}

function LoginForm({ P, onBack, onAuthed, onPanel }) {
  const [u, setU] = React.useState(''); const [p, setP] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState('');
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api.login(u.trim(), p); if (r?.token) { tokenStore.set(r.token); onAuthed(r.username || u.trim(), r.tier); } }
    catch (e) { setErr(e?.message || 'ایمیل/نام‌کاربری یا رمز اشتباه است.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <h4 className="font-bold">ورود به حساب</h4>
      <input className={inpCls} style={fieldStyle(P)} placeholder="ایمیل یا نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
      <PasswordField P={P} value={p} onChange={(e) => setP(e.target.value)} placeholder="رمزِ عبور" />
      {err && <div className="text-[12px] text-red-400">{err}</div>}
      <button onClick={submit} disabled={busy || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} ورود</button>
      {onPanel && (
        <button onClick={onPanel} className="w-full text-[12px] flex items-center justify-center gap-1 opacity-70 hover:opacity-100" style={{ color: P.sub }}>
          ورود/مدیریت در پنلِ کاربری <ArrowUpRight size={12} />
        </button>
      )}
      <button onClick={onBack} className="w-full text-[12px] opacity-60 hover:opacity-100">بازگشت</button>
    </div>
  );
}
