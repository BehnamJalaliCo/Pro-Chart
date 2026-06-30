import React from 'react';
import {
  User, Crown, LogOut, Loader2, Bitcoin, LineChart, Link2, Copy, Check, ShieldCheck,
  ExternalLink, Eye, EyeOff, Star, Bell, Code2, LayoutGrid, BellRing, Lock, Share2,
  Menu, X, Plus, Trash2, RefreshCw, CalendarClock, Mail, ChevronLeft, Clock, CircleDot,
} from 'lucide-react';
import { api, tokenStore } from './api/client';

// ───────────────────────── تمِ مشترک (توکن‌های موجود) ─────────────────────────
const FS = { background: '#0f1117', border: '1px solid #2a2e3d', color: '#e4e6ed' };
const inp = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 transition';
const TIER = { free: 'رایگان', vip: 'VIP', premium: 'پرمیوم' };
const CHART_URL = 'https://pro-chart.ir/';

const authStore = {
  get: () => { try { return JSON.parse(localStorage.getItem('bn_auth') || 'null'); } catch (e) { return null; } },
  set: (v) => localStorage.setItem('bn_auth', JSON.stringify(v)),
  clear: () => localStorage.removeItem('bn_auth'),
};

// ───────────────────────── primitives ─────────────────────────

// ورودیِ رمز با آیکونِ چشم (موجود — حفظِ سازگاری)
function PwInput({ value, onChange, placeholder }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <input className={inp + ' pl-9'} style={FS} type={show ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange} dir="ltr" />
      <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)} className="absolute left-2 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 text-gray-300">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// کارت (موجود — حفظِ سازگاری)
function Card({ title, icon, children, action }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161923] p-5 mb-4">
      {(title || action) && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-bold">{icon}{title}</div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Badge({ tier }) {
  const t = tier || 'free';
  const cls = t === 'premium' || t === 'vip'
    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    : 'bg-white/5 text-gray-300 border-white/10';
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${cls}`}>{(t === 'premium' || t === 'vip') && <Crown size={11} />}{TIER[t] || t}</span>;
}

function CopyButton({ text, k }) {
  const [done, setDone] = React.useState(false);
  const copy = () => { try { navigator.clipboard?.writeText(text); } catch (e) { /* noop */ } setDone(true); setTimeout(() => setDone(false), 1500); };
  return (
    <button onClick={copy} title="کپی" className="p-1.5 rounded bg-white/10 hover:bg-white/20 shrink-0">
      {done ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
    </button>
  );
}

function EmptyState({ icon, text, cta }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 text-gray-400">
      <div className="opacity-40 mb-3">{icon}</div>
      <div className="text-sm">{text}</div>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

function Spinner() {
  return <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 size={22} className="animate-spin" /></div>;
}

function Toggle({ on, onChange, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={() => !disabled && onChange && onChange(!on)}
      className={`relative w-10 h-6 rounded-full transition shrink-0 ${on ? 'bg-indigo-600' : 'bg-white/15'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <span className={`absolute top-0.5 ${on ? 'right-0.5' : 'right-[18px]'} w-5 h-5 rounded-full bg-white transition-all`} />
    </button>
  );
}

function SoonBadge() {
  return <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-gray-400 border border-white/10">به‌زودی</span>;
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return iso; }
}

// ───────────────────────── ریشهٔ پنل ─────────────────────────

export default function UserPanel() {
  const [auth, setAuth] = React.useState(authStore.get());
  const [me, setMe] = React.useState(null);
  const reloadMe = React.useCallback(() => { if (authStore.get()) api.me().then(setMe).catch(() => {}); }, []);
  React.useEffect(() => { if (auth) reloadMe(); }, [auth, reloadMe]);
  const onAuthed = (username, tier, account_type) => {
    const a = { username, tier: tier || 'free', account_type }; authStore.set(a); setAuth(a);
  };
  const logout = () => { authStore.clear(); tokenStore.clear(); setAuth(null); setMe(null); };

  if (!auth) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#0b0e14] text-gray-200">
        <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0f1117]">
          <div className="font-extrabold text-lg">Pro<span className="text-indigo-400">·</span>Chart <span className="text-sm opacity-60 font-normal">پنلِ کاربری</span></div>
        </header>
        <div className="max-w-3xl mx-auto p-5"><AuthGate onAuthed={onAuthed} /></div>
      </div>
    );
  }
  return <PanelShell auth={auth} me={me} reloadMe={reloadMe} logout={logout} />;
}

// ───────────────────────── ورود/ثبت‌نام (موجود — بدونِ تغییرِ منطق) ─────────────────────────

function AuthGate({ onAuthed }) {
  const [mode, setMode] = React.useState('login'); // login | register
  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="rounded-2xl border border-white/10 bg-[#161923] p-6">
        <div className="flex gap-2 mb-5">
          <button onClick={() => setMode('login')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === 'login' ? 'bg-indigo-600' : 'bg-white/5'}`}>ورود</button>
          <button onClick={() => setMode('register')} className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === 'register' ? 'bg-indigo-600' : 'bg-white/5'}`}>ثبت‌نام</button>
        </div>
        {mode === 'login' ? <LoginForm onAuthed={onAuthed} /> : <RegisterForm onAuthed={onAuthed} />}
      </div>
    </div>
  );
}

function LoginForm({ onAuthed }) {
  const [u, setU] = React.useState(''); const [p, setP] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState('');
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api.login(u.trim(), p); if (r?.token) { tokenStore.set(r.token); onAuthed(r.username || u.trim(), r.tier, r.account_type); } }
    catch (e) { setErr(e?.message || 'نام‌کاربری یا رمز اشتباه است.'); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <input className={inp} style={FS} placeholder="ایمیل یا نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
      <PwInput value={p} onChange={(e) => setP(e.target.value)} placeholder="رمزِ عبور" />
      {err && <div className="text-[12px] text-red-400">{err}</div>}
      <button onClick={submit} disabled={busy || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} ورود</button>
    </div>
  );
}

function RegisterForm({ onAuthed }) {
  const [acct, setAcct] = React.useState(''); // crypto | broker — جداسازیِ از بدوِ ثبت‌نام
  const [step, setStep] = React.useState(1);
  const [email, setEmail] = React.useState(''); const [code, setCode] = React.useState('');
  const [u, setU] = React.useState(''); const [p, setP] = React.useState(''); const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState(''); const [info, setInfo] = React.useState('');
  const send = async () => { setErr(''); setBusy(true); try { await api.registerRequest(email.trim()); setInfo('کدِ تأیید به ایمیلت ارسال شد.'); setStep(3); } catch (e) { setErr(e?.message || 'ارسالِ کد ناموفق.'); } finally { setBusy(false); } };
  const verify = async () => {
    setErr(''); setBusy(true);
    try {
      await api.registerVerify(email.trim(), code.trim(), u.trim(), p, name.trim() || null, acct);
      const lr = await api.login(u.trim(), p);
      if (lr?.token) { tokenStore.set(lr.token); onAuthed(lr.username || u.trim(), lr.tier, acct); }
    } catch (e) { setErr(e?.message || 'تأیید ناموفق.'); } finally { setBusy(false); }
  };
  if (!acct) {
    return (
      <div className="space-y-3">
        <p className="text-sm opacity-80 mb-1">نوعِ حسابت را انتخاب کن (جدا و بدونِ تداخل):</p>
        <button onClick={() => { setAcct('crypto'); setStep(2); }} className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition">
          <Bitcoin size={22} className="text-amber-400" />
          <div className="text-right"><div className="font-bold">کاربرِ کریپتو</div><div className="text-[12px] opacity-70">تریدِ واقعیِ کریپتو روی صرافیِ LBank (البنک)</div></div>
        </button>
        <button onClick={() => { setAcct('broker'); setStep(2); }} className="w-full flex items-center gap-3 p-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition">
          <LineChart size={22} className="text-indigo-400" />
          <div className="text-right"><div className="font-bold">کاربرِ فارکس</div><div className="text-[12px] opacity-70">تریدِ واقعیِ فارکس روی بروکرِ وان‌رویال (MT5)</div></div>
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-[12px] opacity-70 flex items-center gap-2">
        {acct === 'crypto' ? <Bitcoin size={14} className="text-amber-400" /> : <LineChart size={14} className="text-indigo-400" />}
        نوعِ حساب: <b>{acct === 'crypto' ? 'کریپتو (LBank)' : 'فارکس (وان‌رویال)'}</b>
        <button onClick={() => { setAcct(''); setStep(1); }} className="opacity-50 hover:opacity-100 underline">تغییر</button>
      </div>
      {step === 2 && (<>
        <input className={inp} style={FS} placeholder="ایمیل" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        {err && <div className="text-[12px] text-red-400">{err}</div>}
        <button onClick={send} disabled={busy || !email} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} ارسالِ کدِ تأیید</button>
      </>)}
      {step === 3 && (<>
        {info && <div className="text-[12px] text-green-400">{info}</div>}
        <input className={inp} style={FS} placeholder="کدِ تأیید" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
        <input className={inp} style={FS} placeholder="نامِ کامل (اختیاری)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inp} style={FS} placeholder="نام‌کاربری" value={u} onChange={(e) => setU(e.target.value)} dir="ltr" />
        <PwInput value={p} onChange={(e) => setP(e.target.value)} placeholder="رمزِ عبور" />
        {err && <div className="text-[12px] text-red-400">{err}</div>}
        <button onClick={verify} disabled={busy || !code || !u || !p} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />} تأیید و ساختِ حساب</button>
      </>)}
    </div>
  );
}

// ───────────────────────── Shell: Header + Sidebar + Content ─────────────────────────

// ترتیبِ تب‌ها مطابقِ اسپک — «داشبورد/امروز» دیفالت (#12)
const TABS = [
  { id: 'dashboard', label: 'داشبوردِ امروز', icon: LayoutGrid },
  { id: 'account', label: 'حساب', icon: User },
  { id: 'billing', label: 'اشتراک', icon: Crown },
  { id: 'connect', label: 'اتصالِ حساب', icon: Link2 },
  { id: 'watchlist', label: 'واچ‌لیست', icon: Star },
  { id: 'alerts', label: 'آلارم‌ها', icon: Bell },
  { id: 'scripts', label: 'اسکریپت‌ها', icon: Code2 },
  { id: 'layouts', label: 'لِی‌اوت‌ها', icon: LayoutGrid },
  { id: 'notifications', label: 'اعلان‌ها', icon: BellRing },
  { id: 'security', label: 'امنیت', icon: Lock },
  { id: 'referral', label: 'معرفی', icon: Share2 },
];

function readHashTab() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  return TABS.some((t) => t.id === h) ? h : null;
}

function PanelShell({ auth, me, reloadMe, logout }) {
  const tier = me?.tier || auth.tier || 'free';
  const initial = readHashTab() || localStorage.getItem('bn_panel_tab') || 'dashboard';
  const [tab, setTab] = React.useState(TABS.some((t) => t.id === initial) ? initial : 'dashboard');
  const [mobileNav, setMobileNav] = React.useState(false);

  // بَج‌ها: شمارشِ آلارمِ فعال + وضعیتِ اتصال (در سطحِ Shell بارگذاری تا در سایدبار نشان داده شود)
  const [conn, setConn] = React.useState(null);
  const [alertCount, setAlertCount] = React.useState(null);
  const loadConn = React.useCallback(() => api.bnConnectStatus().then(setConn).catch(() => {}), []);
  React.useEffect(() => {
    loadConn();
    api.bnAlerts().then((a) => setAlertCount(Array.isArray(a) ? a.filter((x) => x.active).length : 0)).catch(() => {});
  }, [loadConn]);

  const go = (id) => {
    setTab(id); setMobileNav(false);
    try { localStorage.setItem('bn_panel_tab', id); location.hash = '#/' + id; } catch (e) { /* noop */ }
  };
  React.useEffect(() => {
    const onHash = () => { const h = readHashTab(); if (h) setTab(h); };
    window.addEventListener('hashchange', onHash);
    if (!location.hash) { try { location.hash = '#/' + tab; } catch (e) { /* noop */ } }
    return () => window.removeEventListener('hashchange', onHash);
  }, []); // eslint-disable-line

  const connected = conn?.accounts && (conn.accounts.lbank || conn.accounts.mt5);

  const badgeFor = (id) => {
    if (id === 'alerts' && alertCount) return <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/25 text-indigo-200 tabular-nums">{alertCount}</span>;
    if (id === 'connect') return <CircleDot size={12} className={connected ? 'text-green-400' : 'text-gray-500'} />;
    return null;
  };

  const sidebar = (
    <nav className="space-y-1">
      {TABS.map((t) => {
        const Ic = t.icon; const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => go(t.id)} aria-current={active ? 'page' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${active ? 'bg-indigo-600/20 text-indigo-200 font-bold' : 'text-gray-300 hover:bg-white/5'}`}>
            <Ic size={17} className={active ? 'text-indigo-300' : 'opacity-70'} />
            <span className="flex-1 text-right">{t.label}</span>
            {badgeFor(t.id)}
          </button>
        );
      })}
    </nav>
  );

  const ctx = { auth, me, tier, conn, loadConn, reloadMe, setAlertCount, go };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0b0e14] text-gray-200">
      <header className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 bg-[#0f1117] sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <button onClick={() => setMobileNav((v) => !v)} className="lg:hidden p-2 -mr-1 rounded-lg hover:bg-white/5">{mobileNav ? <X size={18} /> : <Menu size={18} />}</button>
          <div className="font-extrabold text-lg">Pro<span className="text-indigo-400">·</span>Chart <span className="text-sm opacity-60 font-normal">پنلِ کاربری</span></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <span className="opacity-70" dir="ltr">{auth.username}</span>
            <Badge tier={tier} />
          </div>
          <button onClick={logout} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 text-sm"><LogOut size={14} /> خروج</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-5 py-5 flex gap-5">
        {/* Sidebar (راست در RTL) */}
        <aside className="hidden lg:block w-60 shrink-0">
          <div className="sticky top-[72px] rounded-2xl border border-white/10 bg-[#161923] p-3">{sidebar}</div>
        </aside>

        {/* Mobile drawer */}
        {mobileNav && (
          <div className="lg:hidden fixed inset-0 z-40" onClick={() => setMobileNav(false)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="absolute top-0 right-0 h-full w-72 max-w-[80%] bg-[#0f1117] border-l border-white/10 p-3 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3 px-1">
                <Badge tier={tier} />
                <button onClick={() => setMobileNav(false)} className="p-1.5 rounded hover:bg-white/5"><X size={18} /></button>
              </div>
              {sidebar}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 min-w-0">
          <TabContent tab={tab} ctx={ctx} />
        </main>
      </div>
    </div>
  );
}

function TabContent({ tab, ctx }) {
  switch (tab) {
    case 'dashboard': return <DashboardTab ctx={ctx} />;
    case 'account': return <AccountTab ctx={ctx} />;
    case 'billing': return <BillingTab ctx={ctx} />;
    case 'connect': return <ConnectTab ctx={ctx} />;
    case 'watchlist': return <WatchlistTab ctx={ctx} />;
    case 'alerts': return <AlertsTab ctx={ctx} />;
    case 'scripts': return <ScriptsTab ctx={ctx} />;
    case 'layouts': return <LayoutsTab ctx={ctx} />;
    case 'notifications': return <NotificationsTab ctx={ctx} />;
    case 'security': return <SecurityTab ctx={ctx} />;
    case 'referral': return <ReferralTab ctx={ctx} />;
    default: return <DashboardTab ctx={ctx} />;
  }
}

// ───────────────────────── تب: داشبوردِ امروز (دیفالت — #12) ─────────────────────────

function DashboardTab({ ctx }) {
  const { auth, me, tier, conn, go } = ctx;
  const isVip = tier === 'vip' || tier === 'premium';
  const acct = auth.account_type || me?.account_type;
  const connected = conn?.accounts && (conn.accounts.lbank || conn.accounts.mt5);
  const [counts, setCounts] = React.useState({ alerts: null, scripts: null, layouts: null, watch: null });
  const [news, setNews] = React.useState(null);

  React.useEffect(() => {
    api.bnAlerts().then((a) => setCounts((c) => ({ ...c, alerts: Array.isArray(a) ? a.length : 0 }))).catch(() => setCounts((c) => ({ ...c, alerts: 0 })));
    api.bnScripts().then((r) => setCounts((c) => ({ ...c, scripts: (r?.scripts || []).length }))).catch(() => setCounts((c) => ({ ...c, scripts: 0 })));
    api.bnLayouts().then((r) => setCounts((c) => ({ ...c, layouts: Array.isArray(r) ? r.length : 0 }))).catch(() => setCounts((c) => ({ ...c, layouts: 0 })));
    api.bnWatchlist().then((r) => setCounts((c) => ({ ...c, watch: (r?.symbols || []).length }))).catch(() => setCounts((c) => ({ ...c, watch: 0 })));
    api.bnNews?.().then((r) => setNews(Array.isArray(r) ? r : (r?.items || []))).catch(() => setNews([]));
  }, []);

  const today = (() => { try { return new Date().toLocaleDateString('fa-IR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return ''; } })();
  const stat = (n) => (n == null ? '…' : <span className="tabular-nums">{n}</span>);

  return (
    <div>
      <div className="mb-4">
        <div className="text-xl font-extrabold">سلام، <span dir="ltr">{me?.full_name || auth.username}</span> 👋</div>
        <div className="text-sm opacity-60 mt-1 flex items-center gap-2"><CalendarClock size={14} /> {today}</div>
      </div>

      {/* وضعیتِ کلیدی */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="آلارم‌ها" value={stat(counts.alerts)} icon={<Bell size={16} className="text-indigo-300" />} onClick={() => go('alerts')} />
        <StatCard label="اسکریپت‌ها" value={stat(counts.scripts)} icon={<Code2 size={16} className="text-emerald-300" />} onClick={() => go('scripts')} />
        <StatCard label="لِی‌اوت‌ها" value={stat(counts.layouts)} icon={<LayoutGrid size={16} className="text-sky-300" />} onClick={() => go('layouts')} />
        <StatCard label="واچ‌لیست" value={stat(counts.watch)} icon={<Star size={16} className="text-amber-300" />} onClick={() => go('watchlist')} />
      </div>

      {/* کارتِ اشتراک خلاصه */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="rounded-2xl border border-white/10 bg-[#161923] p-5">
          <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 font-bold"><Crown size={16} className="text-amber-300" /> اشتراک</div><Badge tier={tier} /></div>
          {isVip ? (
            <div className="text-sm opacity-80">اشتراکِ فعال{me?.expires_at && <> — تا <b>{fmtDate(me.expires_at)}</b></>}.</div>
          ) : (
            <div className="text-sm opacity-80">برای تریدِ واقعی روی چارت به پرمیوم نیاز داری.</div>
          )}
          <button onClick={() => go('billing')} className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-300 hover:underline">مدیریتِ اشتراک <ChevronLeft size={14} /></button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#161923] p-5">
          <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 font-bold">{acct === 'crypto' ? <Bitcoin size={16} className="text-amber-400" /> : <LineChart size={16} className="text-indigo-400" />} اتصالِ حساب</div><CircleDot size={14} className={connected ? 'text-green-400' : 'text-gray-500'} /></div>
          <div className="text-sm opacity-80">{connected ? 'حسابِ معاملاتی وصل است.' : (acct ? 'هنوز حسابِ معاملاتی وصل نکرده‌ای.' : 'نوعِ حساب مشخص نیست.')}</div>
          <button onClick={() => go('connect')} className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-300 hover:underline">مدیریتِ اتصال <ChevronLeft size={14} /></button>
        </div>
      </div>

      {/* اخبارِ امروز (در صورتِ وجودِ API) */}
      <Card title="اخبارِ بازارِ امروز" icon={<BellRing size={16} className="text-rose-300" />}>
        {news == null ? <Spinner /> : news.length === 0 ? (
          <EmptyState icon={<BellRing size={34} />} text="خبرِ تازه‌ای برای امروز نیست." />
        ) : (
          <ul className="space-y-2">
            {news.slice(0, 5).map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CircleDot size={10} className="mt-1.5 text-rose-300 shrink-0" />
                <span className="opacity-90">{n.title || n.headline || n.text || String(n)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <a href={CHART_URL} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold">رفتن به چارتِ بازارنما <ExternalLink size={14} /></a>
    </div>
  );
}

function StatCard({ label, value, icon, onClick }) {
  return (
    <button onClick={onClick} className="text-right rounded-2xl border border-white/10 bg-[#161923] p-4 hover:border-indigo-500/40 transition">
      <div className="flex items-center justify-between mb-2">{icon}<ChevronLeft size={14} className="opacity-30" /></div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-[12px] opacity-60 mt-0.5">{label}</div>
    </button>
  );
}

// ───────────────────────── تب: حساب ─────────────────────────

function AccountTab({ ctx }) {
  const { auth, me, tier } = ctx;
  const acct = auth.account_type || me?.account_type;
  const row = (k, v, ltr) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="opacity-60 text-sm">{k}</span>
      <b className="text-sm" dir={ltr ? 'ltr' : undefined}>{v}</b>
    </div>
  );
  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">حساب</h2>
      <Card title="مشخصاتِ کاربری" icon={<User size={16} className="text-gray-300" />}>
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
          <div className="w-14 h-14 rounded-full bg-indigo-600/25 flex items-center justify-center text-indigo-200 font-extrabold text-xl shrink-0">
            {(me?.full_name || auth.username || '?').trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate">{me?.full_name || auth.username}</div>
            <div className="text-[12px] opacity-60" dir="ltr">@{auth.username}</div>
          </div>
          <div className="mr-auto"><Badge tier={tier} /></div>
        </div>
        {row('نامِ نمایشی', me?.full_name || '—')}
        {row('نام‌کاربری', auth.username, true)}
        {me?.email && row('ایمیل', me.email, true)}
        {me?.phone_number && row('شمارهٔ تماس', me.phone_number, true)}
        {row('نوعِ حساب', acct === 'crypto' ? 'کریپتو (LBank)' : acct === 'broker' ? 'فارکس (وان‌رویال)' : '—')}
        {me?.expires_at && row('اعتبارِ اشتراک تا', fmtDate(me.expires_at))}
      </Card>

      <Card title="ویرایشِ پروفایل" icon={<User size={16} className="text-gray-300" />}>
        <div className="flex items-center justify-between">
          <p className="text-sm opacity-70">ویرایشِ نامِ نمایشی، آواتار و بایو در نسخهٔ بعدی فعال می‌شود.</p>
          <SoonBadge />
        </div>
      </Card>
    </div>
  );
}

// ───────────────────────── تب: اشتراک ─────────────────────────

function PaymentForm() {
  const [plan, setPlan] = React.useState('monthly');
  const [tx, setTx] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const submit = async () => {
    setMsg(null); setBusy(true);
    try {
      const r = await api.bnPaymentSubmit(tx.trim(), plan);
      setMsg({ ok: true, text: `پرداخت تأیید شد ✅ پرمیوم برای ${r.days} روز فعال شد (مبلغ: ${r.amount} USDT).` });
      setTimeout(() => location.reload(), 2500);
    } catch (e) { setMsg({ ok: false, text: e?.message || 'تأییدِ پرداخت ناموفق بود.' }); }
    finally { setBusy(false); }
  };
  return (
    <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
      <div className="opacity-70 text-[12px]">پس از واریز، هشِ تراکنش را بفرست — خودکار از شبکهٔ BSC بررسی و فعال می‌شود:</div>
      <div className="flex gap-1">
        <button onClick={() => setPlan('monthly')} className={`flex-1 py-1.5 rounded text-sm ${plan === 'monthly' ? 'bg-indigo-600' : 'bg-white/5'}`}>ماهانه ۱۵</button>
        <button onClick={() => setPlan('yearly')} className={`flex-1 py-1.5 rounded text-sm ${plan === 'yearly' ? 'bg-indigo-600' : 'bg-white/5'}`}>سالانه ۲۰۰</button>
      </div>
      <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="هشِ تراکنش (0x...)" className="w-full rounded-lg px-3 py-2 outline-none text-sm" style={FS} dir="ltr" />
      {msg && <div className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</div>}
      <button onClick={submit} disabled={busy || !tx} className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} ارسال و تأییدِ خودکار</button>
    </div>
  );
}

function PlanCompare() {
  const F = ({ ok, children }) => (
    <li className="flex items-center gap-2 text-sm py-1">{ok ? <Check size={15} className="text-green-400 shrink-0" /> : <X size={15} className="text-gray-500 shrink-0" />}<span className={ok ? '' : 'opacity-50'}>{children}</span></li>
  );
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="font-bold mb-2">رایگان</div>
        <ul>
          <F ok>چارت و اندیکاتورهای پایه</F>
          <F ok>واچ‌لیست و آلارم</F>
          <F>تریدِ واقعی روی چارت</F>
          <F>نمااسکریپتِ شخصی</F>
        </ul>
      </div>
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="font-bold mb-2 flex items-center gap-1.5 text-amber-300"><Crown size={15} /> پرمیوم</div>
        <ul>
          <F ok>همهٔ امکاناتِ رایگان</F>
          <F ok>تریدِ واقعی روی چارت</F>
          <F ok>نمااسکریپتِ شخصی و خودکار</F>
          <F ok>پشتیبانیِ اولویت‌دار</F>
        </ul>
      </div>
    </div>
  );
}

function BillingTab({ ctx }) {
  const { tier, me } = ctx;
  const isVip = tier === 'vip' || tier === 'premium';
  const [pr, setPr] = React.useState(null);
  React.useEffect(() => { api.pricing().then(setPr).catch(() => {}); }, []);
  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">اشتراک</h2>

      <Card title="پلنِ فعلی" icon={<Crown size={16} className="text-amber-300" />} action={<Badge tier={tier} />}>
        {isVip ? (
          <div className="text-sm opacity-80">اشتراکِ پرمیومِ شما فعال است{me?.expires_at && <> و تا <b>{fmtDate(me.expires_at)}</b> اعتبار دارد</>}.</div>
        ) : (
          <div className="text-sm opacity-80">در حالِ حاضر رویِ پلنِ رایگان هستی. برای تریدِ واقعی روی چارت، اشتراکِ پرمیوم لازم است.</div>
        )}
      </Card>

      <Card title="مقایسهٔ پلن‌ها" icon={<Star size={16} className="text-indigo-300" />}>
        <PlanCompare />
      </Card>

      {!isVip && (
        <Card title="پرداخت و ارتقا" icon={<Crown size={16} className="text-amber-300" />}>
          {pr?.wallet ? (
            <div className="rounded-xl bg-white/5 p-3 space-y-2">
              <div className="flex justify-between text-sm"><span>ماهانه</span><b className="text-indigo-300">۱۵ تتر</b></div>
              <div className="flex justify-between text-sm"><span>سالانه</span><b className="text-indigo-300">۲۰۰ تتر</b></div>
              <div className="opacity-70 pt-1 text-[12px]">آدرسِ واریز ({pr.network} · {pr.currency}):</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all bg-black/30 rounded px-2 py-1 text-[12px]" dir="ltr">{pr.wallet}</code>
                <CopyButton text={pr.wallet} k="w" />
              </div>
              <PaymentForm />
            </div>
          ) : <Spinner />}
        </Card>
      )}

      <Card title="تاریخچهٔ پرداخت‌ها" icon={<Clock size={16} className="text-gray-300" />}>
        <div className="flex items-center justify-between">
          <p className="text-sm opacity-70">جدولِ فاکتورها و دانلودِ رسید در نسخهٔ بعدی اضافه می‌شود.</p>
          <SoonBadge />
        </div>
      </Card>
    </div>
  );
}

// ───────────────────────── تب: اتصالِ حساب ─────────────────────────

function ConnectLbank({ conn, onDone }) {
  const [key, setKey] = React.useState(''); const [sec, setSec] = React.useState(''); const [uid, setUid] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [msg, setMsg] = React.useState(null); const [edit, setEdit] = React.useState(false);
  const save = async () => {
    setMsg(null); setBusy(true);
    try { await api.bnConnectLbank(key.trim(), sec.trim(), uid.trim()); setMsg({ ok: true, text: 'کلیدِ API ذخیره شد ✅' }); setEdit(false); onDone && onDone(); }
    catch (e) { setMsg({ ok: false, text: e?.premium ? 'ابتدا اشتراکِ پرمیوم تهیه کن.' : (e?.message || 'خطا') }); }
    finally { setBusy(false); }
  };
  if (conn && !edit) {
    return (<div className="rounded-xl bg-white/5 p-3 text-[12px] space-y-1">
      <div className="flex items-center gap-2 text-green-400"><Check size={14} /> حسابِ LBank وصل است</div>
      <div className="opacity-70">تأییدِ رفرال: {conn.referral_verified ? '✅ تأییدشده' : '⏳ در انتظار (وایت‌لیستِ IP)'}</div>
      <button onClick={() => setEdit(true)} className="text-indigo-300 hover:underline">ویرایش/تعویضِ کلید</button>
    </div>);
  }
  return (<div className="rounded-xl bg-white/5 p-3 text-[12px] space-y-2">
    <div className="opacity-80">کلیدِ API صرافیِ LBank را وارد کن (برای تریدِ واقعی روی حسابِ خودت):</div>
    <input className={inp} style={FS} placeholder="API Key" value={key} onChange={(e) => setKey(e.target.value)} dir="ltr" />
    <PwInput value={sec} onChange={(e) => setSec(e.target.value)} placeholder="API Secret" />
    <input className={inp} style={FS} placeholder="UID لِی‌بنک (اختیاری — برای تأییدِ رفرال)" value={uid} onChange={(e) => setUid(e.target.value)} dir="ltr" />
    {msg && <div className={msg.ok ? 'text-green-400' : 'text-red-400'}>{msg.text}</div>}
    <button onClick={save} disabled={busy || !key || !sec} className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} ذخیرهٔ امن</button>
  </div>);
}

function ConnectMt5({ conn, onDone }) {
  const [login, setLogin] = React.useState(''); const [pass, setPass] = React.useState(''); const [server, setServer] = React.useState('');
  const [busy, setBusy] = React.useState(false); const [msg, setMsg] = React.useState(null); const [edit, setEdit] = React.useState(false);
  const save = async () => {
    setMsg(null); setBusy(true);
    try { await api.bnConnectMt5(login.trim(), pass.trim(), server.trim()); setMsg({ ok: true, text: 'حسابِ MT5 ذخیره شد ✅' }); setEdit(false); onDone && onDone(); }
    catch (e) { setMsg({ ok: false, text: e?.premium ? 'ابتدا اشتراکِ پرمیوم تهیه کن.' : (e?.message || 'خطا') }); }
    finally { setBusy(false); }
  };
  if (conn && !edit) {
    return (<div className="rounded-xl bg-white/5 p-3 text-[12px] space-y-1">
      <div className="flex items-center gap-2 text-green-400"><Check size={14} /> حسابِ MT5 وصل است (#{conn.account_ref})</div>
      <button onClick={() => setEdit(true)} className="text-indigo-300 hover:underline">ویرایش</button>
    </div>);
  }
  return (<div className="rounded-xl bg-white/5 p-3 text-[12px] space-y-2">
    <div className="opacity-80">حسابِ MT5ِ وان‌رویال را وارد کن (برای تریدِ واقعی روی حسابِ خودت):</div>
    <input className={inp} style={FS} placeholder="شمارهٔ حساب (Login)" value={login} onChange={(e) => setLogin(e.target.value)} dir="ltr" />
    <PwInput value={pass} onChange={(e) => setPass(e.target.value)} placeholder="رمزِ معاملاتی" />
    <input className={inp} style={FS} placeholder="سرور (مثلاً OneRoyal-Live)" value={server} onChange={(e) => setServer(e.target.value)} dir="ltr" />
    {msg && <div className={msg.ok ? 'text-green-400' : 'text-red-400'}>{msg.text}</div>}
    <button onClick={save} disabled={busy || !login || !pass} className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} ذخیرهٔ امن</button>
  </div>);
}

function ConnectTab({ ctx }) {
  const { auth, me, tier, conn, loadConn } = ctx;
  const acct = auth.account_type || me?.account_type;
  const isVip = tier === 'vip' || tier === 'premium';
  const [ref, setRef] = React.useState(null);
  React.useEffect(() => { api.bnReferralLink().then(setRef).catch(() => {}); }, []);
  const refUrl = ref?.url;
  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">اتصالِ حساب</h2>

      {!isVip && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-200 flex items-center gap-2">
          <ShieldCheck size={16} /> تریدِ واقعی روی چارت ویژهٔ کاربرانِ پرمیومِ زیرمجموعهٔ رفرال است.
        </div>
      )}

      {acct === 'crypto' ? (
        <Card title="اتصال به صرافیِ LBank (البنک)" icon={<Bitcoin size={16} className="text-amber-400" />}>
          <p className="text-sm opacity-80 leading-7 mb-3">برای تریدِ واقعیِ کریپتو روی چارت، باید حسابِ LBankِ خودت را وصل کنی و <b>زیرمجموعهٔ رفرالِ ما</b> باشی (شرطِ تریدِ واقعی).</p>
          <a href={refUrl || 'https://www.lbank.com'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-sm mb-3"><Link2 size={14} /> ساختِ حساب با لینکِ رفرالِ ما <ExternalLink size={12} /></a>
          <ConnectLbank conn={conn?.accounts?.lbank} isVip={isVip} onDone={loadConn} />
        </Card>
      ) : acct === 'broker' ? (
        <Card title="اتصال به بروکرِ وان‌رویال (MT5)" icon={<LineChart size={16} className="text-indigo-400" />}>
          <p className="text-sm opacity-80 leading-7 mb-3">برای تریدِ واقعیِ فارکس روی چارت، باید حسابِ MT5ِ وان‌رویالِ خودت را وصل کنی و <b>زیرمجموعهٔ رفرالِ ما</b> باشی.</p>
          <a href={refUrl || 'https://www.oneroyal.com'} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-sm mb-3"><Link2 size={14} /> ساختِ حساب با لینکِ رفرالِ ما <ExternalLink size={12} /></a>
          <ConnectMt5 conn={conn?.accounts?.mt5} isVip={isVip} onDone={loadConn} />
        </Card>
      ) : (
        <Card title="اتصالِ حساب" icon={<Link2 size={16} />}><p className="text-sm opacity-70">نوعِ حساب مشخص نیست. لطفاً دوباره ثبت‌نام کن و کریپتو یا فارکس را انتخاب کن.</p></Card>
      )}

      <Card title="تریدِ واقعی روی چارت" icon={<ShieldCheck size={16} className="text-green-400" />}>
        <p className="text-sm opacity-80 leading-7">
          {isVip ? 'اشتراکت فعال است. پس از اتصالِ حساب و تأییدِ رفرال، می‌توانی مستقیم از روی چارت سفارشِ واقعی باز کنی.'
                 : 'این قابلیت ویژهٔ کاربرانِ پرمیومِ زیرمجموعهٔ رفرال است. ابتدا اشتراک تهیه کن.'}
        </p>
        <a href={CHART_URL} className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm">رفتن به چارتِ بازارنما <ExternalLink size={12} /></a>
      </Card>
    </div>
  );
}

// ───────────────────────── تب: واچ‌لیست ─────────────────────────

function WatchlistTab() {
  const [wl, setWl] = React.useState(null);
  const [prices, setPrices] = React.useState({});
  const [add, setAdd] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api.bnWatchlist().then((r) => {
      setWl(r);
      const syms = r?.symbols || [];
      if (syms.length) api.bnPrices(syms.join(',')).then((p) => setPrices(p?.prices || p || {})).catch(() => {});
    }).catch(() => setWl({ symbols: [] }));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const save = async (syms) => {
    setBusy(true);
    try { await api.bnWatchlistSet(syms); setWl((w) => ({ ...(w || {}), symbols: syms })); if (syms.length) api.bnPrices(syms.join(',')).then((p) => setPrices(p?.prices || p || {})).catch(() => {}); }
    catch (e) { /* noop */ } finally { setBusy(false); }
  };
  const addSym = () => {
    const s = add.trim().toUpperCase(); if (!s) return;
    const cur = wl?.symbols || []; if (cur.includes(s)) { setAdd(''); return; }
    save([...cur, s]); setAdd('');
  };
  const remove = (s) => save((wl?.symbols || []).filter((x) => x !== s));

  const priceOf = (s) => { const v = prices[s]; if (v == null) return null; return typeof v === 'object' ? (v.price ?? v.last ?? v.close) : v; };

  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">واچ‌لیست</h2>
      <Card title="نمادهای منتخب" icon={<Star size={16} className="text-amber-300" />} action={<button onClick={load} className="p-1.5 rounded hover:bg-white/10" title="بروزرسانی"><RefreshCw size={14} className="opacity-70" /></button>}>
        <div className="flex gap-2 mb-3">
          <input className={inp} style={FS} placeholder="نماد (مثلاً EURUSD)" value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSym()} dir="ltr" />
          <button onClick={addSym} disabled={busy || !add.trim()} className="px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1 text-sm shrink-0"><Plus size={15} /> افزودن</button>
        </div>
        {wl == null ? <Spinner /> : (wl.symbols || []).length === 0 ? (
          <EmptyState icon={<Star size={34} />} text="هنوز نمادی به واچ‌لیست اضافه نکرده‌ای." />
        ) : (
          <ul className="divide-y divide-white/5">
            {wl.symbols.map((s) => {
              const pv = priceOf(s);
              return (
                <li key={s} className="flex items-center gap-3 py-2.5">
                  <span className="font-bold text-sm flex-1" dir="ltr">{s}</span>
                  <span className="text-sm tabular-nums opacity-90" dir="ltr">{pv != null ? pv : '—'}</span>
                  <a href={`${CHART_URL}?symbol=${encodeURIComponent(s)}`} title="بازکردن در چارت" className="p-1.5 rounded hover:bg-white/10 text-indigo-300"><ExternalLink size={14} /></a>
                  <button onClick={() => remove(s)} title="حذف" className="p-1.5 rounded hover:bg-red-500/20 text-red-300"><Trash2 size={14} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ───────────────────────── تب: آلارم‌ها ─────────────────────────

function AlertsTab({ ctx }) {
  const [list, setList] = React.useState(null);
  const [sym, setSym] = React.useState('EURUSD');
  const [op, setOp] = React.useState('above');
  const [val, setVal] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [filter, setFilter] = React.useState('all'); // all | active | fired

  const load = React.useCallback(() => {
    api.bnAlerts().then((r) => { const a = Array.isArray(r) ? r : []; setList(a); ctx.setAlertCount && ctx.setAlertCount(a.filter((x) => x.active).length); }).catch(() => setList([]));
  }, [ctx]);
  React.useEffect(() => { load(); }, [load]);

  const create = async () => {
    const v = Number(val); if (!val || Number.isNaN(v)) return;
    setBusy(true);
    try {
      await api.bnAlertCreate({ symbol: sym.trim().toUpperCase(), tf: 'H1', name: `${sym.toUpperCase()} ${op === 'above' ? '↑' : '↓'} ${v}`, condition: { type: 'price', op, value: v } });
      setVal(''); load();
    } catch (e) { /* noop */ } finally { setBusy(false); }
  };
  const del = async (id) => { try { await api.bnAlertDelete(id); load(); } catch (e) { /* noop */ } };

  const shown = (list || []).filter((a) => filter === 'all' ? true : filter === 'active' ? a.active : !a.active);
  const condText = (a) => {
    const c = a.condition || {};
    const opTxt = { above: 'بالای', below: 'پایینِ', cross_up: 'عبور به بالای', cross_down: 'عبور به پایینِ' }[c.op] || c.op || '';
    return c.value != null ? `${opTxt} ${c.value}` : (a.name || '—');
  };

  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">آلارم‌ها</h2>

      <Card title="آلارمِ جدید (قیمتی)" icon={<Plus size={16} className="text-indigo-300" />}>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-center">
          <input className={inp} style={FS} placeholder="نماد" value={sym} onChange={(e) => setSym(e.target.value)} dir="ltr" />
          <select value={op} onChange={(e) => setOp(e.target.value)} className="rounded-lg px-3 py-2.5 text-sm outline-none" style={FS}>
            <option value="above">بالای</option>
            <option value="below">پایینِ</option>
          </select>
          <input className={inp + ' tabular-nums'} style={FS} placeholder="قیمت" value={val} onChange={(e) => setVal(e.target.value)} dir="ltr" inputMode="decimal" />
          <button onClick={create} disabled={busy || !val} className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-bold shrink-0">{busy ? <Loader2 size={15} className="animate-spin" /> : 'ساخت'}</button>
        </div>
        <p className="text-[12px] opacity-60 mt-2">برای آلارم‌های تکنیکال و چندشرطی، از پنلِ کاملِ آلارم داخلِ چارت استفاده کن.</p>
      </Card>

      <Card title="آلارم‌های من" icon={<Bell size={16} className="text-indigo-300" />} action={
        <div className="flex gap-1 text-[12px]">
          {[['all', 'همه'], ['active', 'فعال'], ['fired', 'شلیک‌شده']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-2 py-1 rounded ${filter === k ? 'bg-indigo-600' : 'bg-white/5'}`}>{l}</button>
          ))}
        </div>
      }>
        {list == null ? <Spinner /> : shown.length === 0 ? (
          <EmptyState icon={<Bell size={34} />} text="آلارمی در این دسته نیست." />
        ) : (
          <ul className="divide-y divide-white/5">
            {shown.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${a.active ? 'bg-green-400' : 'bg-gray-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold" dir="ltr">{a.symbol} <span className="opacity-50">· {a.tf}</span></div>
                  <div className="text-[12px] opacity-70">{condText(a)}{a.last_triggered_at && <span className="text-amber-300"> · شلیک: {fmtDate(a.last_triggered_at)}</span>}</div>
                </div>
                <button onClick={() => del(a.id)} title="حذف" className="p-1.5 rounded hover:bg-red-500/20 text-red-300"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ───────────────────────── تب: اسکریپت‌ها ─────────────────────────

function ScriptsTab({ ctx }) {
  const { tier } = ctx;
  const isVip = tier === 'vip' || tier === 'premium';
  const [data, setData] = React.useState(null);
  const load = React.useCallback(() => { api.bnScripts().then(setData).catch(() => setData({ scripts: [] })); }, []);
  React.useEffect(() => { load(); }, [load]);
  const del = async (id) => { try { await api.bnScriptDelete(id); load(); } catch (e) { /* noop */ } };
  const scripts = data?.scripts || [];
  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">اسکریپت‌ها (نمااسکریپت)</h2>
      {!isVip && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[13px] text-amber-200 flex items-center gap-2">
          <Crown size={16} /> ساخت و ویرایشِ نمااسکریپت ویژهٔ کاربرانِ پرمیوم است.
        </div>
      )}
      <Card title="اسکریپت‌های من" icon={<Code2 size={16} className="text-emerald-300" />} action={<a href={CHART_URL} className="text-[12px] text-indigo-300 hover:underline inline-flex items-center gap-1">ادیتور <ExternalLink size={12} /></a>}>
        {data == null ? <Spinner /> : scripts.length === 0 ? (
          <EmptyState icon={<Code2 size={34} />} text="هنوز اسکریپتی نساخته‌ای." cta={<a href={CHART_URL} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm">باز کردنِ ادیتور</a>} />
        ) : (
          <ul className="divide-y divide-white/5">
            {scripts.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <Code2 size={15} className="opacity-50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{s.name}</div>
                  <div className="text-[12px] opacity-60">{s.kind === 'strategy' ? 'استراتژی' : 'اندیکاتور'} · ویرایش: {fmtDate(s.updated_at)}</div>
                </div>
                <a href={CHART_URL} title="بازکردن در ادیتور" className="p-1.5 rounded hover:bg-white/10 text-indigo-300"><ExternalLink size={14} /></a>
                <button onClick={() => del(s.id)} title="حذف" className="p-1.5 rounded hover:bg-red-500/20 text-red-300"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ───────────────────────── تب: لِی‌اوت‌ها ─────────────────────────

function LayoutsTab() {
  const [list, setList] = React.useState(null);
  const load = React.useCallback(() => { api.bnLayouts().then((r) => setList(Array.isArray(r) ? r : [])).catch(() => setList([])); }, []);
  React.useEffect(() => { load(); }, [load]);
  const del = async (id) => { try { await api.bnLayoutDelete(id); load(); } catch (e) { /* noop */ } };
  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">لِی‌اوت‌ها</h2>
      <Card title="چیدمان‌های ذخیره‌شدهٔ چارت" icon={<LayoutGrid size={16} className="text-sky-300" />} action={<a href={CHART_URL} className="text-[12px] text-indigo-300 hover:underline inline-flex items-center gap-1">چارت <ExternalLink size={12} /></a>}>
        {list == null ? <Spinner /> : list.length === 0 ? (
          <EmptyState icon={<LayoutGrid size={34} />} text="هنوز لِی‌اوتی ذخیره نکرده‌ای." cta={<a href={CHART_URL} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm">باز کردنِ چارت</a>} />
        ) : (
          <ul className="divide-y divide-white/5">
            {list.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <LayoutGrid size={15} className="opacity-50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate flex items-center gap-2">{l.name}{l.is_default && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-200">پیش‌فرض</span>}</div>
                  <div className="text-[12px] opacity-60">ویرایش: {fmtDate(l.updated_at)}</div>
                </div>
                <a href={CHART_URL} title="بازکردن در چارت" className="p-1.5 rounded hover:bg-white/10 text-indigo-300"><ExternalLink size={14} /></a>
                <button onClick={() => del(l.id)} title="حذف" className="p-1.5 rounded hover:bg-red-500/20 text-red-300"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ───────────────────────── تب: اعلان‌ها (فاز ۲ — نیازمندِ بک‌اند) ─────────────────────────

function NotificationsTab() {
  const items = [
    ['شلیکِ آلارم', true], ['اخبارِ مهمِ بازار', true], ['تأییدِ پرداخت', true],
    ['تأییدِ رفرال', true], ['پیامِ پشتیبانی', false],
  ];
  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">اعلان‌ها</h2>
      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[13px] opacity-70 flex items-center gap-2">
        <BellRing size={16} /> تنظیماتِ اعلان به‌زودی فعال می‌شود؛ پیش‌نمایشِ غیرفعال در زیر.
      </div>
      <Card title="کانال‌های اعلان" icon={<BellRing size={16} className="text-rose-300" />} action={<SoonBadge />}>
        <ul className="divide-y divide-white/5">
          {items.map(([label, on]) => (
            <li key={label} className="flex items-center justify-between py-3">
              <span className="text-sm">{label}</span>
              <Toggle on={on} disabled />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ───────────────────────── تب: امنیت (فاز ۲ — نیازمندِ بک‌اند) ─────────────────────────

function SecurityTab() {
  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">امنیت</h2>
      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[13px] opacity-70 flex items-center gap-2">
        <Lock size={16} /> این بخش‌ها در نسخهٔ بعدی فعال می‌شوند (فرم‌های غیرفعال).
      </div>

      <Card title="تغییرِ رمزِ عبور" icon={<Lock size={16} className="text-gray-300" />} action={<SoonBadge />}>
        <div className="space-y-2 opacity-50 pointer-events-none">
          <PwInput value="" onChange={() => {}} placeholder="رمزِ فعلی" />
          <PwInput value="" onChange={() => {}} placeholder="رمزِ جدید" />
          <PwInput value="" onChange={() => {}} placeholder="تکرارِ رمزِ جدید" />
          <button disabled className="w-full py-2 rounded-lg bg-indigo-600 font-bold">ذخیره</button>
        </div>
      </Card>

      <Card title="ورودِ دومرحله‌ای (۲FA)" icon={<ShieldCheck size={16} className="text-green-400" />} action={<SoonBadge />}>
        <p className="text-sm opacity-70">فعال‌سازی با QR و بک‌آپ‌کُد به‌زودی.</p>
      </Card>

      <Card title="نشست‌ها و دستگاه‌ها" icon={<User size={16} className="text-gray-300" />} action={<SoonBadge />}>
        <p className="text-sm opacity-70">لیستِ دستگاه‌های فعال و «خروج از همهٔ دستگاه‌ها» به‌زودی.</p>
      </Card>

      <Card title="حذفِ حساب" icon={<Trash2 size={16} className="text-red-400" />} action={<SoonBadge />}>
        <p className="text-sm opacity-70">حذفِ دائمیِ حساب با تأییدِ دومرحله‌ای به‌زودی.</p>
      </Card>
    </div>
  );
}

// ───────────────────────── تب: معرفی (رفرال) ─────────────────────────

function ReferralTab() {
  const [ref, setRef] = React.useState(null);
  React.useEffect(() => { api.bnReferralLink().then(setRef).catch(() => setRef({})); }, []);
  const url = ref?.url;
  return (
    <div>
      <h2 className="text-lg font-extrabold mb-4">معرفی</h2>
      <Card title="لینکِ رفرالِ من" icon={<Share2 size={16} className="text-indigo-300" />}>
        {ref == null ? <Spinner /> : (
          <>
            <p className="text-sm opacity-80 leading-7 mb-3">با این لینک، دوستانت حساب می‌سازند و زیرمجموعهٔ تو می‌شوند ({ref.broker || 'صرافی/بروکر'}).</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all bg-black/30 rounded px-3 py-2 text-[12px]" dir="ltr">{url || '—'}</code>
              {url && <CopyButton text={url} k="ref" />}
              {url && <a href={url} target="_blank" rel="noreferrer" className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-indigo-300 shrink-0"><ExternalLink size={14} /></a>}
            </div>
          </>
        )}
      </Card>
      <Card title="آمارِ زیرمجموعه" icon={<Mail size={16} className="text-gray-300" />} action={<SoonBadge />}>
        <p className="text-sm opacity-70">تعدادِ زیرمجموعه‌ها و پاداش‌ها به‌زودی نمایش داده می‌شود.</p>
      </Card>
    </div>
  );
}
