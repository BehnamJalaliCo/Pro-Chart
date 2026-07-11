export const SYMBOLS = [
  { value: 'EUR/USD', label: 'EUR/USD', category: 'forex' },
  { value: 'GBP/USD', label: 'GBP/USD', category: 'forex' },
  { value: 'USD/JPY', label: 'USD/JPY', category: 'forex' },
  { value: 'USD/CHF', label: 'USD/CHF', category: 'forex' },
  { value: 'AUD/USD', label: 'AUD/USD', category: 'forex' },
  { value: 'NZD/USD', label: 'NZD/USD', category: 'forex' },
  { value: 'USD/CAD', label: 'USD/CAD', category: 'forex' },
  { value: 'EUR/GBP', label: 'EUR/GBP', category: 'forex' },
  { value: 'EUR/JPY', label: 'EUR/JPY', category: 'forex' },
  { value: 'GBP/JPY', label: 'GBP/JPY', category: 'forex' },
  { value: 'EUR/AUD', label: 'EUR/AUD', category: 'forex' },
  { value: 'GBP/AUD', label: 'GBP/AUD', category: 'forex' },
  { value: 'EUR/CAD', label: 'EUR/CAD', category: 'forex' },
  { value: 'GBP/CAD', label: 'GBP/CAD', category: 'forex' },
  { value: 'AUD/JPY', label: 'AUD/JPY', category: 'forex' },
  { value: 'CHF/JPY', label: 'CHF/JPY', category: 'forex' },
  { value: 'NZD/JPY', label: 'NZD/JPY', category: 'forex' },
  { value: 'CAD/JPY', label: 'CAD/JPY', category: 'forex' },
  { value: 'XAU/USD', label: 'طلا (XAU/USD)', category: 'commodity' },
  { value: 'XAG/USD', label: 'نقره (XAG/USD)', category: 'commodity' },
  { value: 'WTI', label: 'نفت خام (WTI)', category: 'commodity' },
  { value: 'BRENT', label: 'نفت برنت (BRENT)', category: 'commodity' },
  { value: 'BTC/USD', label: 'بیت‌کوین (BTC/USD)', category: 'crypto' },
  { value: 'ETH/USD', label: 'اتریوم (ETH/USD)', category: 'crypto' },
  { value: 'US30', label: 'داو جونز (US30)', category: 'index' },
  { value: 'SPX500', label: 'اس‌اندپی ۵۰۰ (SPX500)', category: 'index' },
  { value: 'NAS100', label: 'نزدک ۱۰۰ (NAS100)', category: 'index' },
  { value: 'DE40', label: 'داکس (DE40)', category: 'index' },
];

export const SYMBOL_CATEGORIES = {
  forex: 'جفت ارز',
  commodity: 'کالا',
  crypto: 'رمزارز',
  index: 'شاخص',
};

export const TIMEFRAMES = [
  { value: 'M1', label: '۱ دقیقه' },
  { value: 'M5', label: '۵ دقیقه' },
  { value: 'M15', label: '۱۵ دقیقه' },
  { value: 'M30', label: '۳۰ دقیقه' },
  { value: 'H1', label: '۱ ساعت' },
  { value: 'H4', label: '۴ ساعت' },
  { value: 'D1', label: 'روزانه' },
  { value: 'W1', label: 'هفتگی' },
  { value: 'MN', label: 'ماهانه' },
];

export const SIGNAL_STATUSES = {
  active: { label: 'فعال', color: 'info' },
  tp1_hit: { label: 'TP1 فعال', color: 'success' },
  tp2_hit: { label: 'TP2 فعال', color: 'success' },
  tp3_hit: { label: 'TP3 فعال', color: 'success' },
  sl_hit: { label: 'حد ضرر فعال', color: 'danger' },
  closed: { label: 'بسته شده', color: 'neutral' },
  cancelled: { label: 'لغو شده', color: 'warning' },
  expired: { label: 'منقضی شده', color: 'neutral' },
};

export const SIGNAL_TYPES = {
  BUY: 'خرید',
  SELL: 'فروش',
};

export const SIGNAL_SOURCES = {
  auto: 'خودکار',
  manual: 'دستی',
  ml: 'هوش مصنوعی',
};

export const USER_PLANS = {
  free: { label: 'رایگان', color: 'neutral' },
  basic: { label: 'پایه', color: 'info' },
  pro: { label: 'حرفه‌ای', color: 'success' },
  premium: { label: 'ویژه', color: 'warning' },
  lifetime: { label: 'مادام‌العمر', color: 'success' },
};

export const USER_STATUSES = {
  active: { label: 'فعال', color: 'success' },
  banned: { label: 'مسدود', color: 'danger' },
  inactive: { label: 'غیرفعال', color: 'neutral' },
  pending: { label: 'در انتظار', color: 'warning' },
};

export const ADMIN_ROLES = {
  super_admin: { label: 'مدیر ارشد', color: 'danger' },
  admin: { label: 'مدیر', color: 'warning' },
  analyst: { label: 'تحلیل‌گر', color: 'info' },
  support: { label: 'پشتیبانی', color: 'success' },
  viewer: { label: 'ناظر', color: 'neutral' },
};

export const API_ENDPOINTS = {
  AUTH_LOGIN: '/auth/login',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_ME: '/auth/me',

  DASHBOARD_STATS: '/admin/dashboard/stats',
  DASHBOARD_SIGNAL_CHART: '/admin/dashboard/signal-chart',
  DASHBOARD_USER_GROWTH: '/admin/dashboard/user-growth',
  DASHBOARD_SERVICES: '/admin/dashboard/services',
  DASHBOARD_ACTIVE_SIGNALS: '/admin/dashboard/active-signals',

  SIGNALS: '/admin/signals',
  SIGNAL_DETAIL: (id) => `/admin/signals/${id}`,
  SIGNAL_CLOSE: (id) => `/admin/signals/${id}/close`,

  USERS: '/admin/users',
  USER_DETAIL: (id) => `/admin/users/${id}`,
  USER_BAN: (id) => `/admin/users/${id}/ban`,
  USER_UNBAN: (id) => `/admin/users/${id}/unban`,
  USER_MESSAGE: (id) => `/admin/users/${id}/message`,
  USER_PLAN: (id) => `/admin/users/${id}/plan`,

  PERFORMANCE_EQUITY: '/admin/performance/equity-curve',
  PERFORMANCE_WINRATE: '/admin/performance/win-rate',
  PERFORMANCE_HEATMAP: '/admin/performance/heatmap',
  PERFORMANCE_METRICS: '/admin/performance/metrics',

  ML_MODELS: '/admin/ml/models',
  ML_RETRAIN: (id) => `/admin/ml/models/${id}/retrain`,
  ML_FEATURES: (id) => `/admin/ml/models/${id}/features`,
  ML_ENSEMBLE_WEIGHTS: '/admin/ml/ensemble-weights',

  MONITORING_SYSTEM: '/admin/monitoring/system',
  MONITORING_CONTAINERS: '/admin/monitoring/containers',
  MONITORING_DATA_FEEDS: '/admin/monitoring/data-feeds',
  MONITORING_LOGS: '/admin/monitoring/logs',

  ARTICLES: '/admin/articles',
  ARTICLE_DETAIL: (id) => `/admin/articles/${id}`,

  BROADCASTS: '/admin/broadcasts',
  BROADCAST_STATS: (id) => `/admin/broadcasts/${id}/stats`,

  SETTINGS: '/admin/settings',
  SETTINGS_API_KEYS: '/admin/settings/api-keys',
  SETTINGS_API_KEY: (key) => `/admin/settings/api-keys/${key}`,
};

export const SERVICE_NAMES = {
  signal_engine: 'موتور سیگنال',
  telegram_bot: 'ربات تلگرام',
  ml_models: 'مدل‌های ML',
  data_feed: 'دیتافید',
  database: 'پایگاه داده',
  redis: 'Redis Cache',
  api_gateway: 'درگاه API',
  scheduler: 'زمان‌بند',
  notification: 'سرویس اعلان',
  websocket: 'وب‌سوکت',
};

export const SERVICE_STATUSES = {
  online: { label: 'فعال', color: 'success' },
  offline: { label: 'آفلاین', color: 'danger' },
  warning: { label: 'هشدار', color: 'warning' },
  maintenance: { label: 'تعمیرات', color: 'info' },
};

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
};
