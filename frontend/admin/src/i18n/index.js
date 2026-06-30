import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * i18n سبک — بدون dependency خارجی.
 *
 * منطق:
 *   فعلاً فقط فارسی، ولی ساختار کلید-محور به‌گونه‌ای است که اگر فردا
 *   انگلیسی اضافه شود، فقط یک locale dictionary جدید لازم است — هیچ
 *   تغییری در component ها نیاز نیست.
 *
 * استفاده:
 *   import { useI18n } from '../i18n';
 *   const { t, locale, setLocale } = useI18n();
 *   <span>{t('dashboard.title')}</span>
 *   <span>{t('signal.count', { n: 5 })}</span>   // interpolation
 */

const translations = {
  fa: {
    'common.loading': 'در حال بارگذاری...',
    'common.no_data': 'داده‌ای برای نمایش نیست',
    'common.error': 'خطایی رخ داده است',
    'common.retry': 'تلاش مجدد',
    'common.save': 'ذخیره',
    'common.cancel': 'انصراف',
    'common.delete': 'حذف',
    'common.confirm': 'تأیید',
    'common.search': 'جستجو',
    'common.close': 'بستن',

    'nav.dashboard': 'داشبورد',
    'nav.signals': 'سیگنال‌ها',
    'nav.backtest': 'بک‌تست',
    'nav.risk': 'مدیریت ریسک',
    'nav.users': 'کاربران',
    'nav.performance': 'عملکرد',
    'nav.reports': 'گزارش‌های پیشرفته',
    'nav.ml_models': 'مدل‌های ML',
    'nav.monitoring': 'مانیتورینگ',
    'nav.articles': 'مقالات',
    'nav.broadcasts': 'پیام‌ها',
    'nav.settings': 'تنظیمات',
    'nav.logout': 'خروج',

    'dashboard.title': 'داشبورد',
    'signals.title': 'سیگنال‌ها',
    'signals.empty': 'هنوز سیگنالی ندارید',
    'signals.empty_desc': 'هنگام تشخیص یک فرصت معاملاتی، سیگنال اینجا ظاهر می‌شود.',
    'signals.count': '{n} سیگنال',

    'status.active': 'فعال',
    'status.closed': 'بسته‌شده',
    'status.pending': 'در انتظار',
    'status.cancelled': 'لغو شده',
    'status.banned': 'مسدود',

    'direction.long': 'خرید',
    'direction.short': 'فروش',
    'direction.neutral': 'خنثی',
  },
  // en: { ... }  ← آماده برای آینده
};

export const useI18n = create(
  persist(
    (set, get) => ({
      locale: 'fa',

      setLocale: (locale) => set({ locale }),

      t: (key, params) => {
        const { locale } = get();
        const dict = translations[locale] || translations.fa;
        let text = dict[key] || translations.fa[key] || key;
        // interpolation ساده: {n} → params.n
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          });
        }
        return text;
      },
    }),
    {
      name: 'i18n-storage',
      partialize: (state) => ({ locale: state.locale }),
    }
  )
);

/**
 * map یک status enum به label محلی‌شده.
 */
export function statusLabel(status, locale = 'fa') {
  const key = `status.${String(status || '').toLowerCase()}`;
  const dict = translations[locale] || translations.fa;
  return dict[key] || status;
}

/**
 * map یک direction به label محلی‌شده.
 */
export function directionLabel(direction, locale = 'fa') {
  const key = `direction.${String(direction || '').toLowerCase()}`;
  const dict = translations[locale] || translations.fa;
  return dict[key] || direction;
}

export default useI18n;
