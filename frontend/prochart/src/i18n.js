// i18n سبک و بدونِ وابستگی — دوزبانه (فارسی/انگلیسی). پیش‌فرض فارسی.
// استفاده: const t = useT();  t('nav.chart')
import { useApp } from './appStore';

export const dict = {
  fa: {
    'nav.chart': 'چارت',
    'nav.watchlist': 'واچ‌لیست',
    'nav.ai': 'سیگنالِ AI',
    'nav.markets': 'بازارها',
    'nav.profile': 'پروفایل',

    'common.loading': 'در حال بارگذاری…',
    'common.empty': 'چیزی برای نمایش نیست',
    'common.retry': 'تلاشِ مجدد',
    'common.search': 'جستجو',
    'common.change': 'تغییر',
    'common.price': 'قیمت',
    'common.symbol': 'نماد',

    'watch.title': 'واچ‌لیست',
    'watch.empty': 'واچ‌لیستِ تو خالی است — از چارت نماد اضافه کن.',

    'ai.title': 'سیگنال‌های هوش مصنوعی',
    'ai.empty': 'سیگنالِ فعالی نیست. از چارت، «سیگنالِ AI» بگیر.',
    'ai.entry': 'ورود',
    'ai.sl': 'حدِ ضرر',
    'ai.tp': 'هدف',
    'ai.buy': 'خرید',
    'ai.sell': 'فروش',

    'markets.title': 'بازارها و اخبار',
    'markets.news': 'آخرین اخبار',
    'markets.empty': 'خبری در دسترس نیست.',

    'profile.title': 'پروفایل',
    'profile.language': 'زبان',
    'profile.theme': 'تم',
    'profile.theme.light': 'روشن',
    'profile.theme.dark': 'تاریک',
    'profile.account': 'حساب',
    'profile.guest': 'کاربرِ مهمان',
    'profile.connect': 'اتصالِ بروکر/صرافی',
    'profile.connected': 'متصل',
    'profile.notConnected': 'متصل نیست',
    'profile.version': 'نسخهٔ اپ',
    'profile.about': 'دربارهٔ Pro-Chart',
    'profile.aboutText': 'پلتفرمِ چارت و تحلیلِ مستقل — کریپتو (LBank) و فارکس (OneRoyal).',
  },
  en: {
    'nav.chart': 'Chart',
    'nav.watchlist': 'Watchlist',
    'nav.ai': 'AI Signal',
    'nav.markets': 'Markets',
    'nav.profile': 'Profile',

    'common.loading': 'Loading…',
    'common.empty': 'Nothing to show',
    'common.retry': 'Retry',
    'common.search': 'Search',
    'common.change': 'Change',
    'common.price': 'Price',
    'common.symbol': 'Symbol',

    'watch.title': 'Watchlist',
    'watch.empty': 'Your watchlist is empty — add symbols from the chart.',

    'ai.title': 'AI Signals',
    'ai.empty': 'No active signals. Get one from the chart via “AI Signal”.',
    'ai.entry': 'Entry',
    'ai.sl': 'Stop loss',
    'ai.tp': 'Target',
    'ai.buy': 'Buy',
    'ai.sell': 'Sell',

    'markets.title': 'Markets & News',
    'markets.news': 'Latest news',
    'markets.empty': 'No news available.',

    'profile.title': 'Profile',
    'profile.language': 'Language',
    'profile.theme': 'Theme',
    'profile.theme.light': 'Light',
    'profile.theme.dark': 'Dark',
    'profile.account': 'Account',
    'profile.guest': 'Guest user',
    'profile.connect': 'Broker / Exchange link',
    'profile.connected': 'Connected',
    'profile.notConnected': 'Not connected',
    'profile.version': 'App version',
    'profile.about': 'About Pro-Chart',
    'profile.aboutText': 'Independent charting & analysis — crypto (LBank) and forex (OneRoyal).',
  },
};

export function tr(lang, key) {
  return (dict[lang] && dict[lang][key]) || dict.fa[key] || key;
}

// هوکِ ترجمه — با تغییرِ زبان، کامپوننت‌ها دوباره رندر می‌شوند.
export function useT() {
  const lang = useApp((s) => s.lang);
  return (key) => tr(lang, key);
}
