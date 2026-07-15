/**
 * Canonical client-side route registry for the administration Panel.
 *
 * App.jsx consumes these definitions directly when it declares React Router
 * routes. Navigation surfaces must reference this registry instead of
 * duplicating path literals, so a wildcard redirect can never masquerade as a
 * supported destination.
 */
export const PUBLIC_PANEL_ROUTES = Object.freeze([
  Object.freeze({ id: 'login', path: '/login' }),
]);

export const PROTECTED_PANEL_ROUTES = Object.freeze([
  Object.freeze({ id: 'dashboard', path: '/dashboard' }),
  Object.freeze({ id: 'users', path: '/users' }),
  Object.freeze({ id: 'subscriptions', path: '/subscriptions' }),
  Object.freeze({ id: 'orders', path: '/orders' }),
  Object.freeze({ id: 'exchange', path: '/exchange' }),
  Object.freeze({ id: 'ai-signals', path: '/ai-signals' }),
  Object.freeze({ id: 'charts', path: '/charts' }),
  Object.freeze({ id: 'ads', path: '/ads' }),
  Object.freeze({ id: 'news', path: '/news' }),
  Object.freeze({ id: 'broadcasts', path: '/broadcasts' }),
  Object.freeze({ id: 'analytics', path: '/analytics' }),
  Object.freeze({ id: 'settings', path: '/settings' }),
]);

export const PANEL_ROUTES = Object.freeze(
  Object.fromEntries(
    [...PUBLIC_PANEL_ROUTES, ...PROTECTED_PANEL_ROUTES].map(({ id, path }) => [id, path])
  )
);

// These URLs were previously emitted by the command palette. Keep them as
// explicit, auditable redirects so bookmarked/direct links do not fall through
// the wildcard and silently land on an unrelated page.
export const LEGACY_PANEL_REDIRECTS = Object.freeze([
  Object.freeze({ id: 'signals', from: '/signals', to: PANEL_ROUTES['ai-signals'] }),
  Object.freeze({ id: 'visitors', from: '/visitors', to: PANEL_ROUTES.analytics }),
]);

const enabledCommand = (command) => Object.freeze({ ...command, enabled: true });

const unavailableCommand = ({ path, ...command }) =>
  Object.freeze({
    ...command,
    enabled: false,
    previousPath: path,
  });

/**
 * Default command registry.
 *
 * Disabled entries remain here as auditable records of former palette
 * destinations. CommandPalette filters them before search/render/keyboard
 * selection because the current Panel has no disabled-command interaction
 * pattern and must not expose a wildcard-backed action.
 */
export const DEFAULT_NAV_COMMANDS = Object.freeze([
  enabledCommand({
    id: 'dashboard',
    label: 'داشبورد',
    hint: 'صفحه اصلی',
    path: PANEL_ROUTES.dashboard,
    keywords: ['home', 'main'],
  }),
  enabledCommand({
    id: 'signals',
    label: 'سیگنال‌ها',
    hint: 'مدیریت سیگنال',
    path: PANEL_ROUTES['ai-signals'],
    previousPath: '/signals',
    keywords: ['signal'],
  }),
  unavailableCommand({
    id: 'backtest',
    label: 'بک‌تست',
    hint: 'اجرا و مرور',
    path: '/backtest',
    unavailableReason: 'No declared Panel page implements backtest execution or review.',
    keywords: ['backtest', 'test'],
  }),
  unavailableCommand({
    id: 'risk',
    label: 'مدیریت ریسک',
    hint: 'circuit breaker',
    path: '/risk',
    unavailableReason: 'No declared Panel page implements risk or circuit-breaker management.',
    keywords: ['risk', 'limit'],
  }),
  enabledCommand({
    id: 'users',
    label: 'کاربران',
    hint: 'مدیریت اشتراک',
    path: PANEL_ROUTES.users,
    keywords: ['user', 'subscriber'],
  }),
  unavailableCommand({
    id: 'performance',
    label: 'عملکرد',
    hint: 'win-rate, PnL',
    path: '/performance',
    unavailableReason: 'No declared Panel page provides trading-performance, win-rate, or PnL views.',
    keywords: ['perf', 'pnl'],
  }),
  unavailableCommand({
    id: 'reports',
    label: 'گزارش‌های پیشرفته',
    hint: 'MAR, Omega, heatmap',
    path: '/reports',
    unavailableReason: 'No declared Panel page provides MAR, Omega, or heatmap reports.',
    keywords: ['report', 'heatmap'],
  }),
  unavailableCommand({
    id: 'ml-models',
    label: 'مدل‌های ML',
    hint: 'training و وزن',
    path: '/ml-models',
    unavailableReason: 'No declared Panel page provides model training or weight management.',
    keywords: ['ml', 'model'],
  }),
  unavailableCommand({
    id: 'monitoring',
    label: 'مانیتورینگ',
    hint: 'system + feeds',
    path: '/monitoring',
    unavailableReason: 'The dashboard overview is not equivalent to feeds, logs, and container monitoring.',
    keywords: ['monitor', 'health'],
  }),
  enabledCommand({
    id: 'visitors',
    label: 'بازدیدکنندگان',
    hint: 'آنالیتیکس ترافیک',
    path: PANEL_ROUTES.analytics,
    previousPath: '/visitors',
    keywords: ['visitor', 'analytics', 'traffic', 'بازدید'],
  }),
  unavailableCommand({
    id: 'articles',
    label: 'مقالات',
    hint: 'CMS',
    path: '/articles',
    unavailableReason: 'The read-only market-news page is not equivalent to an article CMS.',
    keywords: ['article', 'cms'],
  }),
  enabledCommand({
    id: 'broadcasts',
    label: 'پیام‌ها',
    hint: 'broadcast',
    path: PANEL_ROUTES.broadcasts,
    keywords: ['broadcast', 'msg'],
  }),
  enabledCommand({
    id: 'settings',
    label: 'تنظیمات',
    hint: 'پارامترها',
    path: PANEL_ROUTES.settings,
    keywords: ['settings', 'config'],
  }),
]);

export function getEnabledNavCommands(commands = DEFAULT_NAV_COMMANDS) {
  return commands.filter((command) => command.enabled !== false);
}
