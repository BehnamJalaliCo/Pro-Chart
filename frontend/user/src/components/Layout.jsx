import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, LineChart, Sparkles, ArrowLeftRight, Link2, Crown, User,
  LogOut, Sun, Moon, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../api/client';
import { bnUserAPI } from '../api/client';
import { useTheme } from '../store';
import NotificationsBell from './NotificationsBell';

const NAV = [
  { to: '/', label: 'داشبورد', short: 'داشبورد', icon: LayoutDashboard, end: true },
  { to: '/market', label: 'بازار و واچ‌لیست', short: 'بازار', icon: LineChart },
  { to: '/signals', label: 'سیگنال‌های AI', short: 'سیگنال', icon: Sparkles },
  { to: '/trade', label: 'معاملات', short: 'معاملات', icon: ArrowLeftRight },
  { to: '/connect', label: 'اتصالِ صرافی', short: 'اتصال', icon: Link2 },
  { to: '/subscription', label: 'اشتراک', short: 'اشتراک', icon: Crown },
  { to: '/profile', label: 'پروفایل', short: 'پروفایل', icon: User },
];

const TIER_LABEL = { premium: 'پرمیوم', vip: 'VIP', free: 'رایگان' };

export default function Layout({ children }) {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();

  // نمایشِ نام/سطح در هدر — نرم و بدونِ توقفِ صفحه در صورتِ خطا
  const { data } = useQuery({
    queryKey: ['overview'],
    queryFn: () => bnUserAPI.overview(),
    staleTime: 60000,
    retry: false,
  });
  const profile = data?.profile;
  const name = profile?.fullName || profile?.username || 'کاربر';
  const tier = profile?.tier;
  const isPremium = tier === 'premium' || tier === 'vip';

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* سایدبار (دسکتاپ) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-surface-card border-l border-surface-border p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-brand-green/15 text-brand-green flex items-center justify-center font-black">ب</div>
          <div>
            <div className="font-black text-text-primary leading-tight">بازارنما</div>
            <div className="text-[11px] text-text-muted">پنل کاربری</div>
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
            <span className="md:hidden font-black text-brand-green">بازارنما</span>
            <span className="hidden md:inline text-text-primary font-bold">{name}</span>
            {isPremium && (
              <span className="text-[11px] bg-brand-green/15 text-brand-green px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck size={12} />{TIER_LABEL[tier] || tier}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggle} className="w-9 h-9 rounded-xl hover:bg-surface-hover flex items-center justify-center text-text-secondary" aria-label="تغییرِ تم">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <NotificationsBell />
            <button onClick={logout} className="md:hidden text-text-muted w-9 h-9 flex items-center justify-center" aria-label="خروج"><LogOut size={20} /></button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 max-w-5xl w-full mx-auto pb-24 md:pb-6">{children}</main>

        {/* نویگیشنِ پایین (موبایل) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface-card border-t border-surface-border flex z-20">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex-1 flex flex-col items-center gap-1 py-2 text-[10px] ${
                isActive ? 'text-brand-blue' : 'text-text-muted'}`}>
              <n.icon size={19} /> {n.short}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
