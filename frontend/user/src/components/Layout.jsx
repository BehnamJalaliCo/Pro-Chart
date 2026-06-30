import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Repeat, Link2, User, LogOut, ShieldCheck, History, Sun, Moon } from 'lucide-react';
import { useAuth, useTheme } from '../store';
import NotificationsBell from './NotificationsBell';
import AiAssistant from './AiAssistant';

const NAV = [
  { to: '/', label: 'داشبورد', icon: LayoutDashboard, end: true },
  { to: '/copy', label: 'کپی‌ترید', icon: Repeat },
  { to: '/history', label: 'تاریخچه', icon: History },
  { to: '/account', label: 'اتصالِ حساب', icon: Link2 },
  { to: '/profile', label: 'پروفایل و احراز', icon: User },
];

export default function Layout({ children }) {
  const { profile, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const name = profile?.name || 'کاربر';

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* سایدبار (دسکتاپ) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-surface-card border-l border-surface-border p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-brand-green/15 text-brand-green flex items-center justify-center font-black">C</div>
          <div>
            <div className="font-black text-text-primary leading-tight">CoinePro FX</div>
            <div className="text-[11px] text-text-muted">پنل کاربری VIP</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                isActive ? 'bg-brand-blue/15 text-brand-blue' : 'text-text-secondary hover:bg-surface-hover'}`}>
              <n.icon size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-text-muted hover:text-brand-red hover:bg-surface-hover transition">
          <LogOut size={18} /> خروج
        </button>
      </aside>

      {/* محتوا */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-surface-border bg-surface-DEFAULT/60 backdrop-blur sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-text-primary font-bold">{name}</span>
            {profile?.is_vip && <span className="text-[11px] bg-brand-green/15 text-brand-green px-2 py-0.5 rounded-full flex items-center gap-1"><ShieldCheck size={12}/>VIP</span>}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggle} className="w-9 h-9 rounded-xl hover:bg-surface-hover flex items-center justify-center text-text-secondary" aria-label="تغییرِ تم">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NotificationsBell />
            <button onClick={logout} className="md:hidden text-text-muted w-9 h-9 flex items-center justify-center"><LogOut size={20} /></button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 max-w-5xl w-full mx-auto pb-24 md:pb-6">{children}</main>

        {/* نویگیشنِ پایین (موبایل) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface-card border-t border-surface-border flex z-20">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                isActive ? 'text-brand-blue' : 'text-text-muted'}`}>
              <n.icon size={20} /> {n.label}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* دستیارِ هوشِ مصنوعی — شناور در همهٔ صفحات */}
      <AiAssistant />
    </div>
  );
}
