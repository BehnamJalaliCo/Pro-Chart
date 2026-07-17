import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, AtSign, MessageSquareReply, Send, Inbox as InboxIcon,
  ClipboardList, Rocket, Image as ImageIcon, LogOut, Instagram, ChevronDown, Plus,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../store';

const NAV = [
  { to: '/', label: 'پیشخوان', icon: LayoutDashboard, end: true },
  { to: '/accounts', label: 'اکانت‌ها', icon: AtSign, perm: 'accounts' },
  { to: '/smart', label: 'پاسخ هوشمند', icon: MessageSquareReply, perm: 'smart_reply' },
  { to: '/content', label: 'انتشار محتوا', icon: Send, perm: 'content' },
  { to: '/cover', label: 'ساخت کاور', icon: ImageIcon, perm: 'content' },
  { to: '/inbox', label: 'صندوق', icon: InboxIcon, perm: 'inbox' },
  { to: '/forms', label: 'فرم‌ساز', icon: ClipboardList, perm: 'forms' },
  { to: '/autopilot', label: 'خلبان خودکار', icon: Rocket, perm: 'autopilot' },
];

// آیا این آیتمِ منو برای کاربر باز است؟ (قفلِ فیچر از سمتِ ادمین)
const navAllowed = (perms, key) => !key || !perms || perms[key] !== false;

function AccountSwitcher() {
  const { account, setAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [accts, setAccts] = useState([]);
  useEffect(() => {
    api.accounts().then((a) => { setAccts(a); if (a.length && !account) setAccount(a[0]); }).catch(() => {});
  }, []);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 rounded-xl bg-white/70 border border-white/70 px-3 py-2.5 hover:bg-white transition">
        <div className="w-9 h-9 rounded-full bg-brand-grad grid place-items-center text-white shrink-0 overflow-hidden">
          {account?.avatar_url ? <img src={account.avatar_url} className="w-full h-full object-cover" /> : <Instagram size={18} />}
        </div>
        <div className="text-right flex-1 min-w-0">
          <div className="text-sm font-bold text-ink truncate">{account ? '@' + account.username : 'اکانتی نیست'}</div>
          <div className="text-[11px] text-ink-muted">{account?.status === 'online' ? '🟢 آنلاین' : 'آفلاین'}</div>
        </div>
        <ChevronDown size={16} className="text-ink-muted" />
      </button>
      {open && (
        <div className="absolute z-20 mt-2 w-full card p-1.5 fade-in">
          {accts.map((a) => (
            <button key={a.id} onClick={() => { setAccount(a); setOpen(false); }}
              className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-brand-50 ${account?.id === a.id ? 'bg-brand-50 font-bold' : ''}`}>
              <span className="w-2 h-2 rounded-full" style={{ background: a.status === 'online' ? '#10b981' : '#cbd5e1' }} />
              @{a.username}
            </button>
          ))}
          <NavLink to="/accounts" onClick={() => setOpen(false)} className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-brand font-bold hover:bg-brand-50">
            <Plus size={15} /> افزودن اکانت
          </NavLink>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const { me, logout } = useAuth();
  const loc = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => setMobileNav(false), [loc.pathname]);

  const Side = (
    <aside className="w-64 shrink-0 h-full flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2.5 px-1 pt-1">
        <div className="w-10 h-10 rounded-2xl bg-brand-grad grid place-items-center text-white shadow-glow"><Instagram size={20} /></div>
        <div>
          <div className="font-black text-ink leading-tight">کوین‌پرو <span className="text-brand">IG</span></div>
          <div className="text-[10px] text-ink-muted">پنل مدیریت اینستاگرام</div>
        </div>
      </div>
      <AccountSwitcher />
      <nav className="flex-1 flex flex-col gap-1">
        {NAV.filter((n) => navAllowed(me?.permissions, n.perm)).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${isActive ? 'bg-brand-grad text-white shadow-glow' : 'text-ink-soft hover:bg-white/70'}`}>
            <n.icon size={18} /> {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="card p-3 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-brand-50 grid place-items-center text-brand font-black">{(me?.display_name || me?.username || '?')[0]}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-ink truncate">{me?.display_name || me?.username}</div>
          <div className="text-[11px] text-ink-muted">{me?.accounts_used}/{me?.max_accounts} اکانت</div>
        </div>
        <button onClick={logout} className="p-2 rounded-lg text-ink-muted hover:text-accent-red hover:bg-red-50" title="خروج"><LogOut size={17} /></button>
      </div>
    </aside>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      <div className="hidden lg:block">{Side}</div>
      {mobileNav && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-black/20" onClick={() => setMobileNav(false)} /><div className="absolute right-0 top-0 h-full bg-cine">{Side}</div></div>}
      <main className="flex-1 h-full overflow-y-auto">
        <header className="lg:hidden sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-white/60 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setMobileNav(true)} className="btn-ghost px-3 py-2">☰</button>
          <div className="font-black text-ink">کوین‌پرو IG</div>
        </header>
        <div className="p-4 sm:p-6 max-w-6xl mx-auto fade-in">{children}</div>
      </main>
    </div>
  );
}
