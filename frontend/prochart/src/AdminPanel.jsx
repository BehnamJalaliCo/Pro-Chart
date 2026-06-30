import React from 'react';
import { Shield, Search, Crown, Check, X, RefreshCw, LogOut, Loader2 } from 'lucide-react';
import { api, adminToken } from './api/client';

// پنلِ ادمینِ بازارنما — تأییدِ پرمیوم/مدیریتِ کاربران. مسیر: /admin
const TIER = { free: ['رایگان', '#64748b'], vip: ['VIP', '#6366f1'], premium: ['پرمیوم', '#f59e0b'] };
const inp = 'rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500';
const FS = { background: '#0f1117', border: '1px solid #2a2e3d', color: '#e4e6ed' };

export default function AdminPanel() {
  const [authed, setAuthed] = React.useState(!!adminToken.get());
  return authed ? <Dash onLogout={() => { adminToken.clear(); setAuthed(false); }} />
                : <Login onLogin={() => setAuthed(true)} />;
}

function Login({ onLogin }) {
  const [pw, setPw] = React.useState(''); const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState('');
  const submit = async () => {
    setErr(''); setBusy(true);
    try { const r = await api.bnAdminLogin(pw); if (r?.token) { adminToken.set(r.token); onLogin(); } else setErr('پاسخِ نامعتبر.'); }
    catch (e) { setErr(e?.message || 'رمز نادرست است.'); } finally { setBusy(false); }
  };
  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#0b0e14] text-gray-200 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#161923] p-6">
        <div className="flex items-center gap-2 mb-4"><Shield size={20} className="text-indigo-400" /><h1 className="text-lg font-extrabold">پنلِ ادمینِ بازارنما</h1></div>
        <input className={`${inp} w-full mb-3`} style={FS} type="password" placeholder="رمزِ ادمین" value={pw}
               onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} dir="ltr" />
        {err && <div className="text-[12px] text-red-400 mb-2">{err}</div>}
        <button onClick={submit} disabled={busy || !pw} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {busy && <Loader2 size={15} className="animate-spin" />} ورود
        </button>
      </div>
    </div>
  );
}

function Dash({ onLogout }) {
  const [users, setUsers] = React.useState([]); const [q, setQ] = React.useState(''); const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const load = async (query = '') => {
    setLoading(true);
    try { const r = await api.bnAdminUsers(query); setUsers(r?.users || []); }
    catch (e) { if (e?.status === 401) { adminToken.clear(); onLogout(); } }
    finally { setLoading(false); }
  };
  React.useEffect(() => { load(); }, []); // eslint-disable-line
  const setTier = async (id, tier, days) => {
    setMsg('');
    try { await api.bnAdminSetTier(id, tier, days); setMsg(`کاربر #${id} → ${TIER[tier][0]} (${days || '∞'} روز)`); load(q); }
    catch (e) { setMsg(e?.message || 'خطا'); }
  };
  const toggleStatus = async (u) => {
    try { await api.bnAdminSetStatus(u.id, u.status === 'active' ? 'disabled' : 'active'); load(q); } catch (e) { /* */ }
  };
  const fmt = (s) => s ? new Date(s).toLocaleDateString('fa-IR') : '—';

  return (
    <div dir="rtl" className="min-h-screen bg-[#0b0e14] text-gray-200">
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0f1117]">
        <div className="flex items-center gap-2"><Shield size={18} className="text-indigo-400" /><b>پنلِ ادمینِ بازارنما</b></div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(q)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10" title="تازه‌سازی"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={() => { adminToken.clear(); onLogout(); }} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 text-sm"><LogOut size={14} /> خروج</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 rounded-lg px-3 flex-1 max-w-md" style={FS}>
            <Search size={15} className="opacity-50" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(q)}
                   placeholder="جستجوی نام‌کاربری/ایمیل…" className="bg-transparent py-2 outline-none w-full text-sm" />
          </div>
          <span className="text-sm opacity-60">{users.length} کاربر</span>
        </div>
        {msg && <div className="mb-3 text-[13px] text-green-400">{msg}</div>}

        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[12px] opacity-70">
              <tr>
                <th className="text-right px-3 py-2">کاربر</th><th className="text-right px-3 py-2">ایمیل</th>
                <th className="px-3 py-2">اشتراک</th><th className="px-3 py-2">انقضا</th>
                <th className="px-3 py-2">ساخت</th><th className="px-3 py-2">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2">
                    <div className="font-semibold" dir="ltr">{u.username}</div>
                    {u.full_name && <div className="text-[11px] opacity-50">{u.full_name}</div>}
                  </td>
                  <td className="px-3 py-2 text-[12px] opacity-80" dir="ltr">{u.email || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: (TIER[u.tier]?.[1] || '#64748b') + '33', color: TIER[u.tier]?.[1] || '#64748b' }}>{TIER[u.tier]?.[0] || u.tier}</span>
                  </td>
                  <td className="px-3 py-2 text-center text-[12px] opacity-70">{fmt(u.expires_at)}</td>
                  <td className="px-3 py-2 text-center text-[12px] opacity-70">{fmt(u.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <button onClick={() => setTier(u.id, 'premium', 30)} className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px] flex items-center gap-1"><Crown size={11} /> پرمیوم ۳۰</button>
                      <button onClick={() => setTier(u.id, 'premium', 365)} className="px-2 py-1 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-[11px]">۳۶۵</button>
                      <button onClick={() => setTier(u.id, 'vip', 30)} className="px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 text-[11px]">VIP ۳۰</button>
                      <button onClick={() => setTier(u.id, 'free', 0)} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-[11px]">رایگان</button>
                      <button onClick={() => toggleStatus(u)} className={`px-2 py-1 rounded-md text-[11px] ${u.status === 'active' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>{u.status === 'active' ? <X size={11} /> : <Check size={11} />}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!users.length && !loading && <tr><td colSpan={6} className="text-center py-10 opacity-40">کاربری نیست.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
