import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useThemeStore } from '../../store';
import useMediaQuery from '../../hooks/useMediaQuery';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ShoppingCart,
  Wallet,
  Sparkles,
  CandlestickChart,
  Megaphone,
  Newspaper,
  Send,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  X,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'داشبورد', icon: LayoutDashboard },
  { to: '/users', label: 'کاربران', icon: Users },
  { to: '/subscriptions', label: 'اشتراک‌ها و پرداخت‌ها', icon: CreditCard },
  { to: '/orders', label: 'سفارش‌ها', icon: ShoppingCart },
  { to: '/exchange', label: 'اتصال صرافی', icon: Wallet },
  { to: '/ai-signals', label: 'سیگنال‌های AI', icon: Sparkles },
  { to: '/charts', label: 'چارت‌ها و واچ‌لیست', icon: CandlestickChart },
  { to: '/ads', label: 'تبلیغات', icon: Megaphone },
  { to: '/news', label: 'اخبار و تقویم', icon: Newspaper },
  { to: '/broadcasts', label: 'پیام‌رسانی', icon: Send },
  { to: '/analytics', label: 'آنالیتیکس', icon: BarChart3 },
  { to: '/settings', label: 'تنظیمات', icon: Settings },
];

/**
 * محتوای داخلی sidebar — مشترک بین desktop و mobile drawer.
 *
 * collapsed: فقط در desktop معنی دارد (mobile همیشه full width)
 * onNavigate: callback پس از کلیک روی item (در mobile برای بستن drawer)
 */
function SidebarContent({ collapsed, onNavigate, showCloseButton, onClose }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const toggleSidebar = useThemeStore((s) => s.toggleSidebar);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-border shrink-0">
        <div className="w-9 h-9 rounded-lg bg-brand-green flex items-center justify-center text-white font-bold text-base shrink-0">
          ب
        </div>
        {!collapsed && (
          <div className="overflow-hidden flex-1">
            <h1 className="text-sm font-bold text-text-primary truncate">بازارنما</h1>
            <p className="text-[10px] text-text-muted">پنل مدیریت</p>
          </div>
        )}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1"
            aria-label="بستن منو"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1" aria-label="ناوبری اصلی">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                  isActive
                    ? 'bg-brand-blue/10 text-brand-blue font-medium'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-2 py-3 border-t border-surface-border space-y-1 shrink-0">
        {!showCloseButton && (
          <button
            onClick={toggleSidebar}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary w-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
            aria-label={collapsed ? 'باز کردن منو' : 'جمع کردن منو'}
          >
            {collapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            {!collapsed && <span>جمع کردن</span>}
          </button>
        )}
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-brand-red hover:bg-brand-red/10 w-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red ${
            collapsed ? 'justify-center' : ''
          }`}
          aria-label="خروج"
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && <span>خروج</span>}
        </button>
      </div>
    </>
  );
}

export default function Sidebar() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const sidebarCollapsed = useThemeStore((s) => s.sidebarCollapsed);
  const mobileDrawerOpen = useThemeStore((s) => s.mobileDrawerOpen);
  const closeMobileDrawer = useThemeStore((s) => s.closeMobileDrawer);

  // ── موبایل: drawer slide-out ──
  if (isMobile) {
    return (
      <>
        {/* overlay */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={closeMobileDrawer}
            aria-hidden="true"
          />
        )}
        <aside
          className={`fixed top-0 right-0 h-screen w-[260px] bg-surface-card border-l border-surface-border flex flex-col z-50 transition-transform duration-300 md:hidden ${
            mobileDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          aria-hidden={!mobileDrawerOpen}
        >
          <SidebarContent
            collapsed={false}
            onNavigate={closeMobileDrawer}
            showCloseButton
            onClose={closeMobileDrawer}
          />
        </aside>
      </>
    );
  }

  // ── دسکتاپ: fixed sidebar ──
  return (
    <aside
      className={`fixed top-0 right-0 h-screen bg-surface-card border-l border-surface-border flex flex-col transition-all duration-300 z-40 ${
        sidebarCollapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
    >
      <SidebarContent collapsed={sidebarCollapsed} />
    </aside>
  );
}
