import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Bot, LogOut, Crown, BookA, Search, NotebookPen, Users, LineChart, Menu, X, Sun, Moon, CandlestickChart, User, Wallet, ClipboardCheck, FlaskConical, Cpu, Target, CalendarClock, Gauge, Lock, Trophy, Award, Brain } from 'lucide-react';
import { useAuth } from '../store';

const NAV = [
  { to: '/', label: 'دوره‌ها', icon: GraduationCap },
  { to: '/assessment', label: 'سطح‌سنجی', icon: ClipboardCheck },
  { to: '/leaderboard', label: 'لیدربورد', icon: Trophy },
  { to: '/achievements', label: 'دستاوردها', icon: Award },
  { to: '/mentor', label: 'مربیِ AI', icon: Bot, vip: true },
  { to: '/coach', label: 'کوچِ رفتاری', icon: Brain, vip: true },
  { to: '/lab', label: 'آزمایشگاه', icon: FlaskConical, vip: true },
  { to: '/algo', label: 'اتوماسیون', icon: Cpu, vip: true },
  { to: '/funded', label: 'فاندد', icon: Target, vip: true },
  { to: '/bootcamp', label: 'بوت‌کمپ', icon: CalendarClock, vip: true },
  { to: '/tools', label: 'ابزارها', icon: Gauge, vip: true },
  { to: '/journal', label: 'ژورنال', icon: NotebookPen, vip: true },
  { to: '/backtest', label: 'تمرین', icon: LineChart, vip: true },
  { to: '/paper', label: 'حسابِ مجازی', icon: Wallet, vip: true },
  { to: '/livechart', label: 'چارتِ زنده', icon: CandlestickChart, vip: true },
  { to: '/bazaarnama', label: 'بازارنما', icon: CandlestickChart, vip: true },
  { to: '/community', label: 'انجمن', icon: Users, vip: true },
  { to: '/glossary', label: 'واژه‌نامه', icon: BookA },
  { to: '/search', label: 'جستجو', icon: Search },
];

export default function Layout({ children }) {
  const { me, logout } = useAuth();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(() => localStorage.getItem('cp_theme') === 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('light', light);
    localStorage.setItem('cp_theme', light ? 'light' : 'dark');
  }, [light]);
  useEffect(() => { setOpen(false); }, [loc.pathname]);

  const isFree = (me?.tier || 'free') === 'free';
  const NavLinks = ({ onClick }) => NAV.map((n) => {
    const Active = loc.pathname === n.to; const I = n.icon;
    const locked = n.vip && isFree;
    return (
      <Link key={n.to} to={n.to} onClick={onClick}
        className={`px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 whitespace-nowrap shrink-0 ${Active ? 'bg-brand-green/15 text-brand-green' : locked ? 'text-text-muted hover:text-text-secondary' : 'text-text-secondary hover:text-text-primary'}`}>
        <I size={16} /> {n.label}
        {locked && <Lock size={11} className="text-amber-400/80" />}
      </Link>
    );
  });

  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <header className="sticky top-0 z-30 backdrop-blur bg-surface/80 border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 h-24 sm:h-32 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img src="/logo.png" alt="CoinePro Academy" className="h-20 sm:h-28 w-auto" />
            {me?.tier && me.tier !== 'free' && (
              <span className="hidden sm:flex text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 items-center gap-1">
                <Crown size={12} /> {me.tier.toUpperCase()}
              </span>
            )}
          </Link>

          {/* دسکتاپ — اسکرولِ افقی تا با تعدادِ زیادِ آیتم، چیدمان به‌هم نریزد */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto min-w-0 flex-1 mx-2 scrollbar-thin">
            <NavLinks />
          </nav>

          <div className="flex items-center gap-1">
            <Link to="/profile" title="پروفایل"
              className={`w-9 h-9 rounded-full flex items-center justify-center ${loc.pathname === '/profile' ? 'bg-brand-green/20 text-brand-green' : 'bg-surface-elevated text-text-secondary hover:text-brand-green'}`}>
              <User size={18} />
            </Link>
            <button onClick={() => setLight((l) => !l)} title="تمِ روشن/تاریک"
              className="p-2 rounded-lg text-text-secondary hover:text-brand-green">
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button onClick={logout} className="p-2 rounded-lg text-text-muted hover:text-brand-red hidden lg:block" title="خروج">
              <LogOut size={18} />
            </button>
            {/* همبرگرِ موبایل */}
            <button onClick={() => setOpen((o) => !o)} className="p-2 rounded-lg text-text-secondary lg:hidden">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* منوی موبایل */}
        {open && (
          <div className="lg:hidden border-t border-surface-border bg-surface/95 backdrop-blur">
            <nav className="max-w-5xl mx-auto px-4 py-2 grid grid-cols-2 gap-1">
              <NavLinks onClick={() => setOpen(false)} />
              <button onClick={logout} className="px-3 py-2 rounded-lg text-sm flex items-center gap-1.5 text-brand-red">
                <LogOut size={16} /> خروج
              </button>
            </nav>
          </div>
        )}
      </header>
      <main className="max-w-5xl mx-auto px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}
