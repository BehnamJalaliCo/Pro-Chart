import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import CommandPalette from '../common/CommandPalette';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useThemeStore, useNotificationStore } from '../../store';
import { X, CheckCircle, AlertTriangle, Info, Menu, Command } from 'lucide-react';

function Notification({ notification, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(notification.id), notification.duration);
    return () => clearTimeout(timer);
  }, [notification, onRemove]);

  const styles = {
    success: 'border-brand-green/30 bg-brand-green/10',
    error: 'border-brand-red/30 bg-brand-red/10',
    info: 'border-brand-blue/30 bg-brand-blue/10',
  };

  const icons = {
    success: <CheckCircle size={18} className="text-brand-green shrink-0" />,
    error: <AlertTriangle size={18} className="text-brand-red shrink-0" />,
    info: <Info size={18} className="text-brand-blue shrink-0" />,
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
        styles[notification.type]
      } animate-slide-in`}
    >
      {icons[notification.type]}
      <span className="text-sm text-text-primary flex-1">{notification.message}</span>
      <button
        onClick={() => onRemove(notification.id)}
        className="text-text-muted hover:text-text-primary"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function NotificationContainer({ isMobile }) {
  const { notifications, removeNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  // موبایل: bottom-center برای جلوگیری از برخورد با header؛ دسکتاپ: top-left
  const position = isMobile
    ? 'bottom-4 left-1/2 -translate-x-1/2 w-[90vw] max-w-sm'
    : 'top-4 left-4 w-80';

  return (
    <div className={`fixed z-[100] space-y-2 ${position}`}>
      {notifications.map((n) => (
        <Notification key={n.id} notification={n} onRemove={removeNotification} />
      ))}
    </div>
  );
}

export default function AdminLayout() {
  const sidebarCollapsed = useThemeStore((s) => s.sidebarCollapsed);
  const openMobileDrawer = useThemeStore((s) => s.openMobileDrawer);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // در موبایل margin صفر است؛ در دسکتاپ بسته به collapse
  const contentMargin = isMobile
    ? 'mr-0'
    : sidebarCollapsed
      ? 'mr-[68px]'
      : 'mr-[240px]';

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <CommandPalette />
      <div className={`transition-all duration-300 ${contentMargin}`}>
        <header className="h-16 border-b border-surface-border bg-surface-card/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={openMobileDrawer}
                className="text-text-secondary hover:text-text-primary p-1"
                aria-label="باز کردن منو"
              >
                <Menu size={22} />
              </button>
            )}
            <h2 className="text-base md:text-lg font-semibold text-text-primary">پنل مدیریت بازارنما</h2>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            {!isMobile && (
              <button
                onClick={() => {
                  // شبیه‌سازی Cmd+K برای کاربران موس
                  const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                  window.dispatchEvent(e);
                }}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-border text-text-muted hover:text-text-primary hover:border-brand-blue/40 transition text-xs"
                aria-label="جستجوی سریع"
              >
                <Command size={14} />
                <span>جستجو</span>
                <kbd className="px-1 py-0.5 rounded bg-surface-bg border border-surface-border text-[10px]">⌘K</kbd>
              </button>
            )}
            <div className="hidden sm:block text-xs text-text-muted">
              {new Date().toLocaleDateString('fa-IR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center text-brand-blue text-xs font-bold">
              م
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <NotificationContainer isMobile={isMobile} />
    </div>
  );
}
