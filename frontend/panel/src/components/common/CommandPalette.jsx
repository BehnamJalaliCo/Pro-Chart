import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';

/**
 * Command palette (Cmd+K / Ctrl+K) — برای navigation سریع.
 *
 * استفاده:
 *   <CommandPalette commands={navCommands} />
 *
 * هر command:
 *   { id, label, hint, icon, action: () => void, keywords: string[] }
 */

export const DEFAULT_NAV_COMMANDS = [
  { id: 'dashboard', label: 'داشبورد', hint: 'صفحه اصلی', path: '/dashboard', keywords: ['home', 'main'] },
  { id: 'signals', label: 'سیگنال‌ها', hint: 'مدیریت سیگنال', path: '/signals', keywords: ['signal'] },
  { id: 'backtest', label: 'بک‌تست', hint: 'اجرا و مرور', path: '/backtest', keywords: ['backtest', 'test'] },
  { id: 'risk', label: 'مدیریت ریسک', hint: 'circuit breaker', path: '/risk', keywords: ['risk', 'limit'] },
  { id: 'users', label: 'کاربران', hint: 'مدیریت اشتراک', path: '/users', keywords: ['user', 'subscriber'] },
  { id: 'performance', label: 'عملکرد', hint: 'win-rate, PnL', path: '/performance', keywords: ['perf', 'pnl'] },
  { id: 'reports', label: 'گزارش‌های پیشرفته', hint: 'MAR, Omega, heatmap', path: '/reports', keywords: ['report', 'heatmap'] },
  { id: 'ml-models', label: 'مدل‌های ML', hint: 'training و وزن', path: '/ml-models', keywords: ['ml', 'model'] },
  { id: 'monitoring', label: 'مانیتورینگ', hint: 'system + feeds', path: '/monitoring', keywords: ['monitor', 'health'] },
  { id: 'visitors', label: 'بازدیدکنندگان', hint: 'آنالیتیکس ترافیک', path: '/visitors', keywords: ['visitor', 'analytics', 'traffic', 'بازدید'] },
  { id: 'articles', label: 'مقالات', hint: 'CMS', path: '/articles', keywords: ['article', 'cms'] },
  { id: 'broadcasts', label: 'پیام‌ها', hint: 'broadcast', path: '/broadcasts', keywords: ['broadcast', 'msg'] },
  { id: 'settings', label: 'تنظیمات', hint: 'پارامترها', path: '/settings', keywords: ['settings', 'config'] },
];

function fuzzyMatch(text, query) {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] === q[qi]) qi += 1;
  }
  return qi === q.length;
}

export default function CommandPalette({ commands = DEFAULT_NAV_COMMANDS, onClose }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const navigate = useNavigate();

  // Global Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    return commands.filter((cmd) => {
      const haystack = [cmd.label, cmd.hint, cmd.id, ...(cmd.keywords || [])].join(' ');
      return fuzzyMatch(haystack, query);
    });
  }, [commands, query]);

  const runCommand = useCallback((cmd) => {
    if (cmd.action) {
      cmd.action();
    } else if (cmd.path) {
      navigate(cmd.path);
    }
    setOpen(false);
    setQuery('');
  }, [navigate]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIdx];
      if (cmd) runCommand(cmd);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-2xl mx-4 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
          <Search size={18} className="text-text-muted shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="جستجو یا دستور... (ESC برای بستن)"
            className="flex-1 bg-transparent text-text-primary placeholder-text-muted text-base outline-none"
            aria-label="جستجو"
          />
          <button
            onClick={() => setOpen(false)}
            className="text-text-muted hover:text-text-primary"
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-muted">
              <p className="text-sm">نتیجه‌ای یافت نشد</p>
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={() => runCommand(cmd)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition ${
                    idx === selectedIdx
                      ? 'bg-brand-blue/10 text-brand-blue'
                      : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {Icon && <Icon size={18} className="shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{cmd.label}</div>
                    {cmd.hint && (
                      <div className="text-xs text-text-muted truncate">{cmd.hint}</div>
                    )}
                  </div>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-surface-bg border border-surface-border text-text-muted">
                    Enter
                  </kbd>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-surface-border flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-surface-bg border border-surface-border">↑↓</kbd> ناوبری</span>
            <span><kbd className="px-1 py-0.5 rounded bg-surface-bg border border-surface-border">↵</kbd> اجرا</span>
            <span><kbd className="px-1 py-0.5 rounded bg-surface-bg border border-surface-border">Esc</kbd> بستن</span>
          </div>
          <span>{filtered.length} مورد</span>
        </div>
      </div>
    </div>
  );
}
