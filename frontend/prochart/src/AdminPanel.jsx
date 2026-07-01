import React from 'react';
import {
  Shield, Search, Crown, Check, X, RefreshCw, LogOut, Loader2, Users, ListOrdered,
  LayoutDashboard, BadgeCheck, Megaphone, TrendingUp, TrendingDown, UserCheck,
  Wallet, Activity, ChevronLeft, Sparkles, Save, Link2, Eye, EyeOff,
} from 'lucide-react';
import { api, adminToken } from './api/client';

// ── پنلِ ادمینِ بازارنما — داشبوردِ مدیریتیِ سطحِ جهانی. مسیر: /admin ──
// توکن‌های تمِ محلی (هم‌خوان با تمِ تیرهٔ بازارنما، بدونِ CDN/فونتِ خارجی)
const TH = {
  bg: '#0a0c12',
  panel: '#0f1117',
  panel2: '#13161f',
  card: '#12141c',
  border: 'rgba(255,255,255,.08)',
  borderStrong: 'rgba(255,255,255,.14)',
  text: '#e4e6ed',
  textDim: '#9aa0b5',
  textFaint: '#6b7280',
  accent: '#6366f1',
  accentSoft: 'rgba(99,102,241,.16)',
  up: '#22c55e',
  down: '#ef4444',
  warn: '#f59e0b',
  info: '#3b82f6',
  field: { background: '#0f1117', border: '1px solid #2a2e3d', color: '#e4e6ed' },
};
const FS = TH.field; // backward-compatible alias

const TIER = { free: ['رایگان', '#64748b'], vip: ['VIP', '#6366f1'], premium: ['پرمیوم', '#f59e0b'] };
const OST = {
  pending: ['در صف', '#f59e0b'], sent: ['ارسال‌شده', '#3b82f6'], filled: ['اجراشده', '#22c55e'],
  failed: ['ناموفق', '#ef4444'], canceled: ['لغو', '#64748b'],
};
const inp = 'rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500';

// قیمتِ اشتراک (طبقِ سیاستِ برند)
const PRICE = { monthly: 25, yearly: 200 };
// پشتیبانیِ رسمیِ CoinePro FX (کانالِ تلگرام نمایش داده نمی‌شود)
const SUPPORT = { handle: '@CoinePro_Admin', url: 'https://t.me/CoinePro_Admin' };

export default function AdminPanel() {
  const [authed, setAuthed] = React.useState(!!adminToken.get());
  return authed
    ? <Dash onLogout={() => { adminToken.clear(); setAuthed(false); }} />
    : <Login onLogin={() => setAuthed(true)} />;
}

/* ───────────────────────── ورود ───────────────────────── */
function Login({ onLogin }) {
  const [user, setUser] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const submit = async () => {
    if (!user || !pw) return;
    setErr(''); setBusy(true);
    try {
      const r = await api.bnAdminLogin(user.trim(), pw);
      if (r?.token) { adminToken.set(r.token); onLogin(); }
      else setErr('پاسخِ نامعتبر.');
    } catch (e) { setErr(e?.message || 'نام‌کاربری یا رمز نادرست است.'); }
    finally { setBusy(false); }
  };
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
         style={{ background: TH.bg, color: TH.text }}>
      {/* درخششِ پس‌زمینهٔ ظریف */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(60% 50% at 50% 0%, rgba(99,102,241,.18), transparent 70%)',
      }} />
      <div className="w-full max-w-sm rounded-2xl border p-7 relative"
           style={{ background: TH.panel, borderColor: TH.border, boxShadow: '0 30px 80px -30px rgba(0,0,0,.8)' }}>
        <div className="flex items-center gap-3 mb-1.5">
          <div className="grid place-items-center w-10 h-10 rounded-xl" style={{ background: TH.accentSoft }}>
            <Shield size={20} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold leading-tight">پنلِ ادمینِ بازارنما</h1>
            <p className="text-[12px]" style={{ color: TH.textDim }}>ورودِ مدیریت</p>
          </div>
        </div>
        <div className="mt-5 mb-3">
          <input
            className={`${inp} w-full`} style={FS}
            type="text" placeholder="نام‌کاربری" value={user} dir="ltr"
            onChange={(e) => setUser(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus autoComplete="username" />
        </div>
        <div className="mb-3 relative">
          <input
            className={`${inp} w-full pl-9`} style={FS}
            type={show ? 'text' : 'password'} placeholder="رمزِ عبور" value={pw} dir="ltr"
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} autoComplete="current-password" />
          <button type="button" onClick={() => setShow((s) => !s)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-90"
                  title={show ? 'پنهان' : 'نمایش'}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {err && <div className="text-[12px] text-red-400 mb-2">{err}</div>}
        <button onClick={submit} disabled={busy || !user || !pw}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 size={15} className="animate-spin" />} ورود
        </button>
        <p className="mt-4 text-center text-[11px]" style={{ color: TH.textFaint }}>
          پشتیبانی: <a href={SUPPORT.url} target="_blank" rel="noreferrer" className="text-indigo-400" dir="ltr">{SUPPORT.handle}</a>
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────── داشبورد ───────────────────────── */
const NAV = [
  ['overview', 'نمای کلی', LayoutDashboard],
  ['users', 'کاربران', Users],
  ['orders', 'سفارش‌های تریدِ واقعی', ListOrdered],
  ['referral', 'تأییدِ رفرال', BadgeCheck],
  ['ads', 'تبلیغات', Megaphone],
];

function Dash({ onLogout }) {
  const [tab, setTab] = React.useState('overview');
  const [users, setUsers] = React.useState([]);
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [toast, setToast] = React.useState('');

  const flash = React.useCallback((m) => { setToast(m); window.clearTimeout(flash._t); flash._t = window.setTimeout(() => setToast(''), 3200); }, []);
  const auth401 = React.useCallback((e) => { if (e?.status === 401) { adminToken.clear(); onLogout(); } }, [onLogout]);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [u, o] = await Promise.all([
        api.bnAdminUsers('').catch((e) => { auth401(e); return null; }),
        api.bnAdminOrders('', '').catch((e) => { auth401(e); return null; }),
      ]);
      if (u) setUsers(u.users || []);
      if (o) setOrders(o.orders || []);
    } finally { setLoading(false); }
  }, [auth401]);

  React.useEffect(() => { loadAll(); }, [loadAll]);

  const ctx = { users, setUsers, orders, setOrders, loading, loadAll, flash, auth401 };

  return (
    <div dir="rtl" className="min-h-screen flex" style={{ background: TH.bg, color: TH.text }}>
      {/* ساید‌بارِ ناوبری */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-l" style={{ background: TH.panel, borderColor: TH.border }}>
        <div className="flex items-center gap-3 px-5 h-16 border-b" style={{ borderColor: TH.border }}>
          <div className="grid place-items-center w-9 h-9 rounded-lg" style={{ background: TH.accentSoft }}>
            <Shield size={18} className="text-indigo-400" />
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-[15px]">بازارنما</div>
            <div className="text-[11px]" style={{ color: TH.textDim }}>پنلِ ادمین</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(([key, label, Icon]) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition group"
                style={{ background: active ? TH.accent : 'transparent', color: active ? '#fff' : TH.textDim }}
                onMouseOver={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
                onMouseOut={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <Icon size={17} /> <span className="flex-1 text-right">{label}</span>
                {active && <ChevronLeft size={15} className="opacity-70" />}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t" style={{ borderColor: TH.border }}>
          <a href={SUPPORT.url} target="_blank" rel="noreferrer"
             className="block text-center text-[11px] mb-3" style={{ color: TH.textFaint }}>
            پشتیبانیِ CoinePro FX · <span dir="ltr">{SUPPORT.handle}</span>
          </a>
          <button onClick={() => { adminToken.clear(); onLogout(); }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-600/15 text-red-300 hover:bg-red-600/25 text-[13px] font-semibold">
            <LogOut size={14} /> خروج
          </button>
        </div>
      </aside>

      {/* ستونِ اصلی */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* هدر */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 h-16 border-b backdrop-blur"
                style={{ background: 'rgba(15,17,23,.85)', borderColor: TH.border }}>
          <div className="flex items-center gap-2 min-w-0">
            {/* ناوبریِ موبایل */}
            <div className="md:hidden flex items-center gap-1 overflow-x-auto no-scrollbar">
              {NAV.map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap"
                  style={{ background: tab === key ? TH.accent : 'rgba(255,255,255,.05)', color: tab === key ? '#fff' : TH.textDim }}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <h2 className="hidden md:block text-[15px] font-extrabold">
              {NAV.find((n) => n[0] === tab)?.[1]}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className="p-2 rounded-lg hover:bg-white/10" style={{ background: 'rgba(255,255,255,.05)' }} title="تازه‌سازی">
              <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-400' : ''} />
            </button>
            <button onClick={() => { adminToken.clear(); onLogout(); }}
                    className="md:hidden flex items-center gap-1 px-3 py-2 rounded-lg bg-red-600/20 text-red-300 text-sm">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-[1200px] w-full mx-auto">
          {tab === 'overview' && <Overview {...ctx} go={setTab} />}
          {tab === 'users' && <UsersTab {...ctx} />}
          {tab === 'orders' && <Orders {...ctx} />}
          {tab === 'referral' && <Referral {...ctx} />}
          {tab === 'ads' && <Ads {...ctx} />}
        </main>
      </div>

      {/* توستِ سراسری */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-[13px] font-semibold border shadow-2xl flex items-center gap-2"
             style={{ background: TH.panel2, borderColor: TH.borderStrong, color: TH.text }}>
          <Check size={15} className="text-green-400" /> {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── اجزای مشترک ───────────────────────── */
function StatCard({ icon: Icon, label, value, sub, tone = TH.accent }) {
  return (
    <div className="rounded-2xl border p-4 relative overflow-hidden"
         style={{ background: TH.card, borderColor: TH.border }}>
      <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full opacity-20" style={{ background: tone }} />
      <div className="flex items-center justify-between">
        <span className="text-[12.5px]" style={{ color: TH.textDim }}>{label}</span>
        <span className="grid place-items-center w-8 h-8 rounded-lg" style={{ background: tone + '22', color: tone }}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-2 text-[26px] font-extrabold tabular-nums" dir="ltr">{value}</div>
      {sub && <div className="text-[11.5px] mt-0.5" style={{ color: TH.textFaint }}>{sub}</div>}
    </div>
  );
}

const Pill = ({ text, color }) => (
  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"
        style={{ background: (color || '#64748b') + '26', color: color || '#64748b' }}>{text}</span>
);

const Card = ({ children, className = '', pad = true }) => (
  <div className={`rounded-2xl border ${pad ? 'p-4 md:p-5' : ''} ${className}`}
       style={{ background: TH.card, borderColor: TH.border }}>{children}</div>
);

const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('fa-IR') : '—');
const fmtDateTime = (s) => (s ? new Date(s).toLocaleString('fa-IR') : '—');

/* ───────────────────────── نمای کلی ───────────────────────── */
function Overview({ users, orders, go }) {
  const m = React.useMemo(() => {
    const tierCount = { free: 0, vip: 0, premium: 0 };
    let active = 0;
    const now = Date.now();
    let expiring = 0;
    users.forEach((u) => {
      tierCount[u.tier] = (tierCount[u.tier] || 0) + 1;
      if (u.status === 'active') active += 1;
      if (u.expires_at) {
        const d = new Date(u.expires_at).getTime();
        if (d > now && d < now + 7 * 864e5) expiring += 1;
      }
    });
    const paid = (tierCount.vip || 0) + (tierCount.premium || 0);
    const ost = {};
    orders.forEach((o) => { ost[o.status] = (ost[o.status] || 0) + 1; });
    const mrr = (tierCount.premium || 0) * PRICE.monthly; // برآوردِ تقریبیِ درآمدِ ماهانه
    return { tierCount, active, paid, expiring, ost, mrr, total: users.length, totalOrders: orders.length };
  }, [users, orders]);

  const recentOrders = orders.slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="کلِ کاربران" value={m.total.toLocaleString('fa-IR')} sub={`${m.active.toLocaleString('fa-IR')} فعال`} tone={TH.accent} />
        <StatCard icon={Crown} label="اشتراکِ پولی" value={m.paid.toLocaleString('fa-IR')} sub={`${(m.tierCount.premium || 0).toLocaleString('fa-IR')} پرمیوم · ${(m.tierCount.vip || 0).toLocaleString('fa-IR')} VIP`} tone={TH.warn} />
        <StatCard icon={Wallet} label="درآمدِ ماهانهٔ تقریبی" value={`${m.mrr.toLocaleString('fa-IR')}₮`} sub={`ماهانه ${PRICE.monthly}₮ · سالانه ${PRICE.yearly}₮`} tone={TH.up} />
        <StatCard icon={Activity} label="سفارش‌های ترید" value={m.totalOrders.toLocaleString('fa-IR')} sub={`${(m.ost.filled || 0).toLocaleString('fa-IR')} اجراشده`} tone={TH.info} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ترکیبِ اشتراک‌ها */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <b className="text-[14px]">ترکیبِ اشتراک‌ها</b>
            <button onClick={() => go('users')} className="text-[12px] text-indigo-400 flex items-center gap-1">مدیریت <ChevronLeft size={13} /></button>
          </div>
          {(() => {
            const total = Math.max(1, m.total);
            return (
              <div className="space-y-3">
                {Object.entries(TIER).map(([k, [label, color]]) => {
                  const c = m.tierCount[k] || 0;
                  const pct = Math.round((c / total) * 100);
                  return (
                    <div key={k}>
                      <div className="flex items-center justify-between text-[12.5px] mb-1">
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: color }} /> {label}</span>
                        <span style={{ color: TH.textDim }} dir="ltr">{c} · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {m.expiring > 0 && (
            <div className="mt-4 text-[12px] rounded-lg px-3 py-2 flex items-center gap-2"
                 style={{ background: TH.warn + '1a', color: TH.warn }}>
              <Sparkles size={14} /> {m.expiring.toLocaleString('fa-IR')} اشتراک طیِ ۷ روزِ آینده منقضی می‌شود.
            </div>
          )}
        </Card>

        {/* وضعیتِ سفارش‌ها */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <b className="text-[14px]">وضعیتِ سفارش‌ها</b>
            <button onClick={() => go('orders')} className="text-[12px] text-indigo-400 flex items-center gap-1">همه <ChevronLeft size={13} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(OST).map(([k, [label, color]]) => (
              <div key={k} className="rounded-xl px-3 py-2.5 border" style={{ background: TH.panel2, borderColor: TH.border }}>
                <div className="text-[20px] font-extrabold tabular-nums" style={{ color }} dir="ltr">{(m.ost[k] || 0).toLocaleString('fa-IR')}</div>
                <div className="text-[11.5px]" style={{ color: TH.textDim }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* آخرین سفارش‌ها */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <b className="text-[14px]">آخرین سفارش‌ها</b>
            <button onClick={() => go('orders')} className="text-[12px] text-indigo-400 flex items-center gap-1">همه <ChevronLeft size={13} /></button>
          </div>
          {recentOrders.length ? (
            <div className="space-y-2">
              {recentOrders.map((o) => (
                <div key={o.id} className="flex items-center gap-2 text-[12.5px] rounded-lg px-2.5 py-2" style={{ background: TH.panel2 }}>
                  {o.side === 'buy' ? <TrendingUp size={15} className="text-green-400 shrink-0" /> : <TrendingDown size={15} className="text-red-400 shrink-0" />}
                  <span className="font-bold" dir="ltr">{o.symbol}</span>
                  <span className="opacity-50" dir="ltr">{o.amount}</span>
                  <span className="mr-auto"><Pill text={OST[o.status]?.[0] || o.status} color={OST[o.status]?.[1]} /></span>
                </div>
              ))}
            </div>
          ) : <div className="text-center py-8 text-[13px]" style={{ color: TH.textFaint }}>سفارشی ثبت نشده.</div>}
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── کاربران ───────────────────────── */
function UsersTab({ users, setUsers, loading, flash, auth401 }) {
  const [q, setQ] = React.useState('');
  const [tierFilter, setTierFilter] = React.useState('');
  const [busyId, setBusyId] = React.useState(null);
  const [local, setLocal] = React.useState(false);

  const search = React.useCallback(async (query) => {
    setLocal(true);
    try { const r = await api.bnAdminUsers(query || ''); setUsers(r?.users || []); }
    catch (e) { auth401(e); }
    finally { setLocal(false); }
  }, [setUsers, auth401]);

  const setTier = async (id, tier, days) => {
    setBusyId(id);
    try { await api.bnAdminSetTier(id, tier, days); flash(`کاربر #${id} → ${TIER[tier][0]} (${days || '∞'} روز)`); await search(q); }
    catch (e) { flash(e?.message || 'خطا'); }
    finally { setBusyId(null); }
  };
  const toggleStatus = async (u) => {
    setBusyId(u.id);
    try { await api.bnAdminSetStatus(u.id, u.status === 'active' ? 'disabled' : 'active'); await search(q); }
    catch (e) { auth401(e); }
    finally { setBusyId(null); }
  };

  const shown = React.useMemo(() => (
    tierFilter ? users.filter((u) => u.tier === tierFilter) : users
  ), [users, tierFilter]);

  const busy = loading || local;

  return (
    <div className="space-y-4">
      {/* نوارِ ابزار */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded-xl px-3 flex-1 min-w-[220px] max-w-md border" style={{ background: TH.field.background, borderColor: TH.border }}>
          <Search size={15} className="opacity-50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(q)}
                 placeholder="جستجوی نام‌کاربری/ایمیل…" className="bg-transparent py-2.5 outline-none w-full text-sm" />
          {q && <button onClick={() => { setQ(''); search(''); }} className="opacity-50 hover:opacity-90"><X size={14} /></button>}
        </div>
        <div className="flex items-center gap-1 rounded-xl p-1 border" style={{ background: TH.field.background, borderColor: TH.border }}>
          {[['', 'همه'], ...Object.entries(TIER).map(([k, v]) => [k, v[0]])].map(([k, label]) => (
            <button key={k} onClick={() => setTierFilter(k)}
              className="px-2.5 py-1 rounded-lg text-[12px] font-semibold"
              style={{ background: tierFilter === k ? TH.accent : 'transparent', color: tierFilter === k ? '#fff' : TH.textDim }}>{label}</button>
          ))}
        </div>
        <button onClick={() => search(q)} className="p-2.5 rounded-xl hover:bg-white/10 border" style={{ background: TH.field.background, borderColor: TH.border }} title="تازه‌سازی">
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
        </button>
        <span className="text-[13px]" style={{ color: TH.textDim }}>{shown.length.toLocaleString('fa-IR')} کاربر</span>
      </div>

      {/* جدول */}
      <Card pad={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-[12px]" style={{ color: TH.textDim, background: 'rgba(255,255,255,.03)' }}>
                <th className="text-right px-4 py-3 font-semibold">کاربر</th>
                <th className="text-right px-3 py-3 font-semibold">ایمیل</th>
                <th className="px-3 py-3 font-semibold">اشتراک</th>
                <th className="px-3 py-3 font-semibold">انقضا</th>
                <th className="px-3 py-3 font-semibold">عضویت</th>
                <th className="px-3 py-3 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className="border-t hover:bg-white/[.03] transition" style={{ borderColor: TH.border }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid place-items-center w-8 h-8 rounded-full text-[12px] font-bold shrink-0"
                            style={{ background: (TIER[u.tier]?.[1] || '#64748b') + '22', color: TIER[u.tier]?.[1] || '#64748b' }}>
                        {(u.username || '?').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold truncate" dir="ltr">{u.username}</div>
                        {u.full_name && <div className="text-[11px] truncate" style={{ color: TH.textFaint }}>{u.full_name}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[12px]" style={{ color: TH.textDim }} dir="ltr">{u.email || '—'}</td>
                  <td className="px-3 py-3 text-center"><Pill text={TIER[u.tier]?.[0] || u.tier} color={TIER[u.tier]?.[1]} /></td>
                  <td className="px-3 py-3 text-center text-[12px]" style={{ color: TH.textDim }}>{fmtDate(u.expires_at)}</td>
                  <td className="px-3 py-3 text-center text-[12px]" style={{ color: TH.textDim }}>{fmtDate(u.created_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <button disabled={busyId === u.id} onClick={() => setTier(u.id, 'premium', 30)} className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 text-[11px] flex items-center gap-1 disabled:opacity-40"><Crown size={11} /> پرمیوم ۳۰</button>
                      <button disabled={busyId === u.id} onClick={() => setTier(u.id, 'premium', 365)} className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 text-[11px] disabled:opacity-40">۳۶۵</button>
                      <button disabled={busyId === u.id} onClick={() => setTier(u.id, 'vip', 30)} className="px-2 py-1 rounded-md bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 text-[11px] disabled:opacity-40">VIP ۳۰</button>
                      <button disabled={busyId === u.id} onClick={() => setTier(u.id, 'free', 0)} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-[11px] disabled:opacity-40">رایگان</button>
                      <button disabled={busyId === u.id} onClick={() => toggleStatus(u)}
                              className={`px-2 py-1 rounded-md text-[11px] flex items-center gap-1 disabled:opacity-40 ${u.status === 'active' ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-green-500/15 text-green-300 hover:bg-green-500/25'}`}>
                        {u.status === 'active' ? <><X size={11} /> غیرفعال</> : <><Check size={11} /> فعال</>}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && !busy && (
                <tr><td colSpan={6} className="text-center py-12" style={{ color: TH.textFaint }}>کاربری یافت نشد.</td></tr>
              )}
              {busy && !shown.length && (
                <tr><td colSpan={6} className="text-center py-12"><Loader2 size={22} className="animate-spin inline text-indigo-400" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── سفارش‌ها ───────────────────────── */
function Orders({ orders, setOrders, loading, auth401 }) {
  const [fStatus, setFStatus] = React.useState('');
  const [fMarket, setFMarket] = React.useState('');
  const [local, setLocal] = React.useState(false);

  const load = React.useCallback(async () => {
    setLocal(true);
    try { const r = await api.bnAdminOrders(fStatus, fMarket); setOrders(r?.orders || []); }
    catch (e) { auth401(e); }
    finally { setLocal(false); }
  }, [fStatus, fMarket, setOrders, auth401]);

  React.useEffect(() => { load(); }, [load]);

  const busy = loading || local;
  const sel = 'rounded-lg px-3 py-2 text-sm outline-none border';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={fMarket} onChange={(e) => setFMarket(e.target.value)} className={sel} style={{ ...FS, borderColor: TH.border }}>
          <option value="">همهٔ بازارها</option><option value="crypto">کریپتو</option><option value="forex">فارکس</option>
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={sel} style={{ ...FS, borderColor: TH.border }}>
          <option value="">همهٔ وضعیت‌ها</option>{Object.entries(OST).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
        </select>
        <button onClick={load} className="p-2.5 rounded-xl hover:bg-white/10 border" style={{ background: TH.field.background, borderColor: TH.border }} title="تازه‌سازی">
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
        </button>
        <span className="text-[13px]" style={{ color: TH.textDim }}>{orders.length.toLocaleString('fa-IR')} سفارش</span>
      </div>

      <Card pad={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-[12px]" style={{ color: TH.textDim, background: 'rgba(255,255,255,.03)' }}>
                <th className="px-3 py-3 font-semibold">#</th>
                <th className="text-right px-3 py-3 font-semibold">کاربر</th>
                <th className="px-3 py-3 font-semibold">بازار</th>
                <th className="px-3 py-3 font-semibold">نماد</th>
                <th className="px-3 py-3 font-semibold">جهت</th>
                <th className="px-3 py-3 font-semibold">حجم</th>
                <th className="px-3 py-3 font-semibold">حساب</th>
                <th className="px-3 py-3 font-semibold">وضعیت</th>
                <th className="px-3 py-3 font-semibold">زمان</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t hover:bg-white/[.03] transition" style={{ borderColor: TH.border }}>
                  <td className="px-3 py-3 text-center text-[12px]" style={{ color: TH.textFaint }} dir="ltr">{o.id}</td>
                  <td className="px-3 py-3" dir="ltr">{o.user || '—'}</td>
                  <td className="px-3 py-3 text-center text-[12px]">
                    {o.market === 'crypto' ? 'کریپتو' : 'فارکس'}
                    {o.broker && <div className="text-[10px]" style={{ color: TH.textFaint }}>{o.broker}</div>}
                  </td>
                  <td className="px-3 py-3 text-center font-semibold" dir="ltr">{o.symbol}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 ${o.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {o.side === 'buy' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{o.side === 'buy' ? 'خرید' : 'فروش'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center text-[12px]" dir="ltr">{o.amount}</td>
                  <td className="px-3 py-3 text-center text-[11px]" style={{ color: TH.textDim }} dir="ltr">{o.account_ref || '—'}</td>
                  <td className="px-3 py-3 text-center">
                    <Pill text={OST[o.status]?.[0] || o.status} color={OST[o.status]?.[1]} />
                    {o.error && <div className="text-[10px] text-red-400 mt-1 max-w-[150px] truncate mx-auto" title={o.error}>{o.error}</div>}
                  </td>
                  <td className="px-3 py-3 text-center text-[11px]" style={{ color: TH.textFaint }}>{fmtDateTime(o.created_at)}</td>
                </tr>
              ))}
              {!orders.length && !busy && (
                <tr><td colSpan={9} className="text-center py-12" style={{ color: TH.textFaint }}>سفارشی نیست.</td></tr>
              )}
              {busy && !orders.length && (
                <tr><td colSpan={9} className="text-center py-12"><Loader2 size={22} className="animate-spin inline text-indigo-400" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── تأییدِ رفرال ───────────────────────── */
function Referral({ users, setUsers, loading, flash, auth401 }) {
  const [q, setQ] = React.useState('');
  const [busyId, setBusyId] = React.useState(null);
  const [local, setLocal] = React.useState(false);

  const search = React.useCallback(async (query) => {
    setLocal(true);
    try { const r = await api.bnAdminUsers(query || ''); setUsers(r?.users || []); }
    catch (e) { auth401(e); }
    finally { setLocal(false); }
  }, [setUsers, auth401]);

  const setRef = async (u, verified) => {
    setBusyId(u.id);
    try {
      await api.bnAdminSetReferral(u.id, u.referral_kind || 'lbank', verified);
      flash(`رفرالِ کاربر #${u.id} ${verified ? 'تأیید' : 'لغوِ تأیید'} شد.`);
      await search(q);
    } catch (e) { flash(e?.message || 'خطا'); }
    finally { setBusyId(null); }
  };

  const busy = loading || local;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-lg shrink-0" style={{ background: TH.up + '22', color: TH.up }}><BadgeCheck size={18} /></span>
          <div className="text-[13px]" style={{ color: TH.textDim }}>
            تأییدِ رفرالِ صرافی (LBank/البنک) دسترسیِ تریدِ واقعی را برای کاربر باز می‌کند. وضعیتِ هر کاربر را بررسی و دستی تأیید/لغو کنید.
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 rounded-xl px-3 flex-1 min-w-[220px] max-w-md border" style={{ background: TH.field.background, borderColor: TH.border }}>
          <Search size={15} className="opacity-50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(q)}
                 placeholder="جستجوی کاربر…" className="bg-transparent py-2.5 outline-none w-full text-sm" />
          {q && <button onClick={() => { setQ(''); search(''); }} className="opacity-50 hover:opacity-90"><X size={14} /></button>}
        </div>
        <button onClick={() => search(q)} className="p-2.5 rounded-xl hover:bg-white/10 border" style={{ background: TH.field.background, borderColor: TH.border }} title="تازه‌سازی">
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      <Card pad={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[12px]" style={{ color: TH.textDim, background: 'rgba(255,255,255,.03)' }}>
                <th className="text-right px-4 py-3 font-semibold">کاربر</th>
                <th className="px-3 py-3 font-semibold">صرافی</th>
                <th className="px-3 py-3 font-semibold">وضعیتِ رفرال</th>
                <th className="px-3 py-3 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const verified = !!(u.referral_verified ?? u.lbank_verified);
                return (
                  <tr key={u.id} className="border-t hover:bg-white/[.03] transition" style={{ borderColor: TH.border }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" dir="ltr">{u.username}</div>
                      {u.email && <div className="text-[11px]" style={{ color: TH.textFaint }} dir="ltr">{u.email}</div>}
                    </td>
                    <td className="px-3 py-3 text-center text-[12px]" style={{ color: TH.textDim }}>{(u.referral_kind || 'lbank').toUpperCase()}</td>
                    <td className="px-3 py-3 text-center">
                      <Pill text={verified ? 'تأییدشده' : 'تأییدنشده'} color={verified ? TH.up : TH.textFaint} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button disabled={busyId === u.id || verified} onClick={() => setRef(u, true)}
                                className="px-2.5 py-1 rounded-md bg-green-500/15 text-green-300 hover:bg-green-500/25 text-[11px] flex items-center gap-1 disabled:opacity-40">
                          <UserCheck size={12} /> تأیید
                        </button>
                        <button disabled={busyId === u.id || !verified} onClick={() => setRef(u, false)}
                                className="px-2.5 py-1 rounded-md bg-red-500/15 text-red-300 hover:bg-red-500/25 text-[11px] flex items-center gap-1 disabled:opacity-40">
                          <X size={12} /> لغو
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!users.length && !busy && (
                <tr><td colSpan={4} className="text-center py-12" style={{ color: TH.textFaint }}>کاربری نیست.</td></tr>
              )}
              {busy && !users.length && (
                <tr><td colSpan={4} className="text-center py-12"><Loader2 size={22} className="animate-spin inline text-indigo-400" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────── تبلیغات ───────────────────────── */
const AD_SLOTS = [
  ['top', 'بنرِ بالا'],
  ['sidebar', 'کنارهٔ صفحه'],
  ['footer', 'پاورقی'],
];

function Ads({ flash, auth401 }) {
  const [ads, setAds] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [savingSlot, setSavingSlot] = React.useState(null);

  const load = React.useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.bnAds();
      const map = {};
      (Array.isArray(r?.ads) ? r.ads : Array.isArray(r) ? r : []).forEach((a) => { if (a?.slot) map[a.slot] = a; });
      // اگر پاسخ به‌صورتِ شیِ کلید→تبلیغ بود
      if (r?.ads && !Array.isArray(r.ads)) Object.assign(map, r.ads);
      setAds(map);
    } catch (e) { auth401(e); }
    finally { setBusy(false); }
  }, [auth401]);

  React.useEffect(() => { load(); }, [load]);

  const setField = (slot, field, val) => setAds((p) => ({ ...p, [slot]: { ...(p[slot] || {}), [field]: val } }));

  const save = async (slot) => {
    const a = ads[slot] || {};
    setSavingSlot(slot);
    try {
      await api.bnAdminSetAds(slot, a.logo || '', a.text || '', a.link || '', a.active !== false);
      flash(`تبلیغِ «${AD_SLOTS.find((s) => s[0] === slot)?.[1] || slot}» ذخیره شد.`);
      await load();
    } catch (e) { flash(e?.message || 'خطا'); }
    finally { setSavingSlot(null); }
  };

  const field = 'w-full rounded-lg px-3 py-2 text-sm outline-none border focus:border-indigo-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px]" style={{ color: TH.textDim }}>اسلات‌های تبلیغاتیِ بازارنما را مدیریت کنید (لوگو، متن، لینک، فعال/غیرفعال).</p>
        <button onClick={load} className="p-2.5 rounded-xl hover:bg-white/10 border" style={{ background: TH.field.background, borderColor: TH.border }} title="تازه‌سازی">
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {AD_SLOTS.map(([slot, label]) => {
          const a = ads[slot] || {};
          const active = a.active !== false;
          return (
            <Card key={slot}>
              <div className="flex items-center justify-between mb-3">
                <b className="text-[14px] flex items-center gap-2"><Megaphone size={15} className="text-indigo-400" /> {label}</b>
                <button onClick={() => setField(slot, 'active', !active)}
                  className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: (active ? TH.up : TH.textFaint) + '26', color: active ? TH.up : TH.textFaint }}>
                  {active ? 'فعال' : 'غیرفعال'}
                </button>
              </div>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11.5px] block mb-1" style={{ color: TH.textDim }}>متن</label>
                  <input className={field} style={{ ...FS, borderColor: TH.border }} value={a.text || ''} onChange={(e) => setField(slot, 'text', e.target.value)} placeholder="متنِ تبلیغ…" />
                </div>
                <div>
                  <label className="text-[11.5px] block mb-1" style={{ color: TH.textDim }}>آدرسِ لوگو</label>
                  <input className={field} style={{ ...FS, borderColor: TH.border }} value={a.logo || ''} onChange={(e) => setField(slot, 'logo', e.target.value)} placeholder="https://…" dir="ltr" />
                </div>
                <div>
                  <label className="text-[11.5px] block mb-1" style={{ color: TH.textDim }}>لینکِ مقصد</label>
                  <div className="relative">
                    <input className={`${field} pl-8`} style={{ ...FS, borderColor: TH.border }} value={a.link || ''} onChange={(e) => setField(slot, 'link', e.target.value)} placeholder="https://…" dir="ltr" />
                    <Link2 size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
                  </div>
                </div>
                {a.logo && (
                  <div className="rounded-lg overflow-hidden border grid place-items-center p-2" style={{ borderColor: TH.border, background: TH.panel2 }}>
                    <img src={a.logo} alt="" className="max-h-12 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  </div>
                )}
                <button onClick={() => save(slot)} disabled={savingSlot === slot}
                        className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-[13px] flex items-center justify-center gap-2 disabled:opacity-50">
                  {savingSlot === slot ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} ذخیره
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
