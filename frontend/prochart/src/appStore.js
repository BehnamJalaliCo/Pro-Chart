// فروشگاهِ سراسریِ اپ (پوسته/ناوبری/زبان/تم) — مستقل از وضعیتِ داخلیِ BazaarNama.
// zustand (از قبل در پروژه هست). با localStorage پایدار می‌ماند تا رفرش/بازکردنِ مجدد چیزی را از دست ندهد.
import { create } from 'zustand';

const LS = 'pc_app_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } };
const saved = load();

// اعمالِ زبان روی سند: جهت (rtl/ltr) + lang. اعداد لاتین می‌مانند (تصمیمِ محصول).
export function applyLang(lang) {
  try {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === 'fa' ? 'rtl' : 'ltr';
  } catch (e) { /* noop */ }
}

// اعمالِ تم: کلاسِ light/dark روی <html> (هم‌خوان با متغیرهای CSS و tailwind darkMode:'class').
export function applyTheme(theme) {
  try {
    const el = document.documentElement;
    if (theme === 'dark') { el.classList.add('dark'); el.classList.remove('light'); }
    else { el.classList.add('light'); el.classList.remove('dark'); }
  } catch (e) { /* noop */ }
}

export const useApp = create((set, get) => ({
  lang: saved.lang || 'fa',      // پیش‌فرض: فارسی
  theme: saved.theme || 'light', // پیش‌فرض: روشن و مینیمال
  tab: 'chart',                  // تبِ فعالِ ناوبری
  setLang: (lang) => { applyLang(lang); localStorage.setItem(LS, JSON.stringify({ ...load(), lang })); set({ lang }); },
  toggleLang: () => get().setLang(get().lang === 'fa' ? 'en' : 'fa'),
  setTheme: (theme) => { applyTheme(theme); localStorage.setItem(LS, JSON.stringify({ ...load(), theme })); set({ theme }); },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setTab: (tab) => set({ tab }),
}));

// اعمالِ اولیه هنگامِ بارگذاریِ ماژول (قبل از رندرِ اپ).
applyLang(useApp.getState().lang);
applyTheme(useApp.getState().theme);
