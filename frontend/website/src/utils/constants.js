/**
 * constants.js - ثابت‌های پروژه سیگنال فارکس
 */

/**
 * نمادهای تحت پوشش
 * هر نماد شامل نام فارسی، نام انگلیسی و دسته‌بندی
 */
export const SYMBOLS = [
  // جفت‌ارزهای اصلی (Majors)
  { name_fa: 'یورو/دلار', name_en: 'EUR/USD', category: 'major' },
  { name_fa: 'پوند/دلار', name_en: 'GBP/USD', category: 'major' },
  { name_fa: 'دلار/ین', name_en: 'USD/JPY', category: 'major' },
  { name_fa: 'دلار/فرانک', name_en: 'USD/CHF', category: 'major' },
  { name_fa: 'دلار استرالیا/دلار', name_en: 'AUD/USD', category: 'major' },
  { name_fa: 'دلار نیوزلند/دلار', name_en: 'NZD/USD', category: 'major' },
  { name_fa: 'دلار/دلار کانادا', name_en: 'USD/CAD', category: 'major' },

  // جفت‌ارزهای فرعی (Crosses)
  { name_fa: 'یورو/پوند', name_en: 'EUR/GBP', category: 'cross' },
  { name_fa: 'یورو/ین', name_en: 'EUR/JPY', category: 'cross' },
  { name_fa: 'پوند/ین', name_en: 'GBP/JPY', category: 'cross' },
  { name_fa: 'یورو/فرانک', name_en: 'EUR/CHF', category: 'cross' },
  { name_fa: 'پوند/فرانک', name_en: 'GBP/CHF', category: 'cross' },
  { name_fa: 'استرالیا/ین', name_en: 'AUD/JPY', category: 'cross' },
  { name_fa: 'استرالیا/نیوزلند', name_en: 'AUD/NZD', category: 'cross' },
  { name_fa: 'یورو/استرالیا', name_en: 'EUR/AUD', category: 'cross' },
  { name_fa: 'پوند/استرالیا', name_en: 'GBP/AUD', category: 'cross' },
  { name_fa: 'کانادا/ین', name_en: 'CAD/JPY', category: 'cross' },
  { name_fa: 'نیوزلند/ین', name_en: 'NZD/JPY', category: 'cross' },

  // فلزات (Metals)
  { name_fa: 'طلا', name_en: 'XAU/USD', category: 'metal' },
  { name_fa: 'نقره', name_en: 'XAG/USD', category: 'metal' },

  // شاخص‌ها (Indices)
  { name_fa: 'داو جونز', name_en: 'US30', category: 'index' },
  { name_fa: 'نزدک', name_en: 'NAS100', category: 'index' },
  { name_fa: 'اس‌اند‌پی ۵۰۰', name_en: 'SPX500', category: 'index' },
  { name_fa: 'دکس آلمان', name_en: 'GER40', category: 'index' },
  { name_fa: 'فوتسی بریتانیا', name_en: 'UK100', category: 'index' },

  // انرژی (Energy)
  { name_fa: 'نفت خام', name_en: 'USOIL', category: 'energy' },
  { name_fa: 'نفت برنت', name_en: 'UKOIL', category: 'energy' },
  { name_fa: 'گاز طبیعی', name_en: 'NATGAS', category: 'energy' },

  // رمزارز (Crypto)
  { name_fa: 'بیت‌کوین', name_en: 'BTC/USD', category: 'crypto' },
  { name_fa: 'اتریوم', name_en: 'ETH/USD', category: 'crypto' },
];

/**
 * دسته‌بندی نمادها با برچسب فارسی
 */
export const SYMBOL_CATEGORIES = {
  major: { label_fa: 'جفت‌ارز اصلی', label_en: 'Major Pairs' },
  cross: { label_fa: 'جفت‌ارز فرعی', label_en: 'Cross Pairs' },
  metal: { label_fa: 'فلزات گران‌بها', label_en: 'Metals' },
  index: { label_fa: 'شاخص‌ها', label_en: 'Indices' },
  energy: { label_fa: 'انرژی', label_en: 'Energy' },
  crypto: { label_fa: 'رمزارز', label_en: 'Crypto' },
};

/**
 * تایم‌فریم‌ها
 */
export const TIMEFRAMES = [
  { value: 'M1', label_fa: '۱ دقیقه', label_en: '1 Minute' },
  { value: 'M5', label_fa: '۵ دقیقه', label_en: '5 Minutes' },
  { value: 'M15', label_fa: '۱۵ دقیقه', label_en: '15 Minutes' },
  { value: 'M30', label_fa: '۳۰ دقیقه', label_en: '30 Minutes' },
  { value: 'H1', label_fa: '۱ ساعته', label_en: '1 Hour' },
  { value: 'H4', label_fa: '۴ ساعته', label_en: '4 Hours' },
  { value: 'D1', label_fa: 'روزانه', label_en: 'Daily' },
  { value: 'W1', label_fa: 'هفتگی', label_en: 'Weekly' },
  { value: 'MN', label_fa: 'ماهانه', label_en: 'Monthly' },
];

/**
 * وضعیت‌های سیگنال
 */
export const SIGNAL_STATUSES = {
  active: {
    value: 'active',
    label_fa: 'فعال',
    label_en: 'Active',
    color: 'accent',
    bgClass: 'bg-accent/10',
    textClass: 'text-accent',
    borderClass: 'border-accent/20',
  },
  pending: {
    value: 'pending',
    label_fa: 'در انتظار',
    label_en: 'Pending',
    color: 'yellow',
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-500',
    borderClass: 'border-yellow-500/20',
  },
  tp_hit: {
    value: 'tp_hit',
    label_fa: 'سود محقق شد',
    label_en: 'TP Hit',
    color: 'bullish',
    bgClass: 'bg-bullish/10',
    textClass: 'text-bullish',
    borderClass: 'border-bullish/20',
  },
  tp1_hit: {
    value: 'tp1_hit',
    label_fa: 'TP1 فعال',
    label_en: 'TP1 Hit',
    color: 'bullish',
    bgClass: 'bg-bullish/10',
    textClass: 'text-bullish',
    borderClass: 'border-bullish/20',
  },
  tp2_hit: {
    value: 'tp2_hit',
    label_fa: 'TP2 فعال',
    label_en: 'TP2 Hit',
    color: 'bullish',
    bgClass: 'bg-bullish/10',
    textClass: 'text-bullish',
    borderClass: 'border-bullish/20',
  },
  tp3_hit: {
    value: 'tp3_hit',
    label_fa: 'TP3 فعال',
    label_en: 'TP3 Hit',
    color: 'bullish',
    bgClass: 'bg-bullish/10',
    textClass: 'text-bullish',
    borderClass: 'border-bullish/20',
  },
  sl_hit: {
    value: 'sl_hit',
    label_fa: 'حد ضرر فعال شد',
    label_en: 'SL Hit',
    color: 'bearish',
    bgClass: 'bg-bearish/10',
    textClass: 'text-bearish',
    borderClass: 'border-bearish/20',
  },
  cancelled: {
    value: 'cancelled',
    label_fa: 'لغو شده',
    label_en: 'Cancelled',
    color: 'gray',
    bgClass: 'bg-dark-600/30',
    textClass: 'text-dark-400',
    borderClass: 'border-dark-600/30',
  },
  closed: {
    value: 'closed',
    label_fa: 'بسته شده',
    label_en: 'Closed',
    color: 'gray',
    bgClass: 'bg-dark-600/30',
    textClass: 'text-dark-300',
    borderClass: 'border-dark-600/30',
  },
  expired: {
    value: 'expired',
    label_fa: 'منقضی شده',
    label_en: 'Expired',
    color: 'gray',
    bgClass: 'bg-dark-600/30',
    textClass: 'text-dark-500',
    borderClass: 'border-dark-600/30',
  },
};

/**
 * جهت‌های معامله
 */
export const DIRECTIONS = {
  BUY: { value: 'BUY', label_fa: 'خرید', label_en: 'Buy', color: 'bullish' },
  SELL: { value: 'SELL', label_fa: 'فروش', label_en: 'Sell', color: 'bearish' },
};

/**
 * سطوح قدرت سیگنال
 */
export const SIGNAL_STRENGTHS = [
  { value: 'very_strong', label_fa: 'بسیار قوی', min: 80, max: 100, color: 'bullish' },
  { value: 'strong', label_fa: 'قوی', min: 65, max: 79, color: 'bullish' },
  { value: 'medium', label_fa: 'متوسط', min: 45, max: 64, color: 'yellow-500' },
  { value: 'weak', label_fa: 'ضعیف', min: 25, max: 44, color: 'orange-500' },
  { value: 'very_weak', label_fa: 'بسیار ضعیف', min: 0, max: 24, color: 'bearish' },
];

/**
 * آدرس‌های API
 */
export const API_ENDPOINTS = {
  // سیگنال‌ها (روترِ عمومیِ واقعی — بدونِ auth، دادهٔ واقعیِ پروژه)
  SIGNALS_ACTIVE: '/api/public/signals/active',
  SIGNALS_RECENT: '/api/public/signals/recent',
  SIGNALS_STATS: '/api/public/signals/stats',
  SIGNALS_BY_ID: '/api/signals', // + /:id

  // قیمت‌ها (لایوِ واقعی از فید پروژه)
  PRICES_LIVE: '/api/public/prices/live',
  PRICES_HISTORY: '/api/prices/history', // + /:symbol
  PRICES_SYMBOLS: '/api/prices/symbols',

  // عملکرد
  PERFORMANCE_SUMMARY: '/api/performance/summary',
  PERFORMANCE_EQUITY: '/api/performance/equity-curve',
  PERFORMANCE_MONTHLY: '/api/performance/monthly',
  PERFORMANCE_BY_SYMBOL: '/api/performance/by-symbol',
  PERFORMANCE_DRAWDOWN: '/api/performance/drawdown',

  // آموزش (همان ۱۲۰ درسِ آکادمیِ ربات — مدلِ Article)
  EDUCATION_ARTICLES: '/api/articles',
  EDUCATION_ARTICLE: '/api/articles', // + /:slug
  EDUCATION_CATEGORIES: '/api/articles/categories',

  // تماس
  CONTACT_SUBMIT: '/api/contact',

  // وب‌سوکت
  WS_PRICES: '/ws/prices',
  WS_SIGNALS: '/ws/signals',
};

/**
 * تنظیمات عمومی
 */
export const APP_CONFIG = {
  APP_NAME_FA: 'کوین پرو FX',
  APP_NAME_EN: 'CoinePro FX',
  // کانال/هندلِ تلگرام و ربات
  TELEGRAM_CHANNEL: 'https://t.me/coineprofx',
  TELEGRAM_HANDLE: 'coineprofx',
  BOT_URL: 'https://t.me/CoineProFxBot',       // «شروع رایگان» → ربات پروژه
  BOT_USERNAME: 'CoineProFxBot',               // برای ویجت ورود تلگرام در لایو
  SUPPORT_TELEGRAM: 'https://t.me/CoinePro_Admin', // آیدی پشتیبانی
  SUPPORT_HANDLE: '@CoinePro_Admin',
  INSTAGRAM: 'https://instagram.com/coineprofx',
  INSTAGRAM_HANDLE: 'coineprofx',
  OWNER_FA: 'بهنام جلالی',
  OWNER_EN: 'Behnam Jalali',
  // بروکرِ پیشنهادی (OneRoyal) — لینکِ رفرالِ اختصاصی
  BROKER_NAME: 'OneRoyal',
  BROKER_NAME_FA: 'وان رویال',
  BROKER_REFERRAL_URL: 'https://vc.cabinet.oneroyal.com/links/go/12412',
  BROKER_SITE_FA_URL: 'https://www.oneroyal.com/fa/',
  // ایمیل/توییتر/یوتیوب نداریم — حذف شده‌اند
  DEFAULT_LOCALE: 'fa-IR',
  DEFAULT_CALENDAR: 'persian',
  DEFAULT_THEME: 'dark',
  PRICE_UPDATE_INTERVAL: 5000,
  SIGNAL_REFRESH_INTERVAL: 30000,
  MAX_RECONNECT_ATTEMPTS: 10,
  RECONNECT_DELAY: 3000,
};
