// فروشگاهِ سراسریِ اپ (پوسته/ناوبری/زبان/تم) — مستقل از وضعیتِ داخلیِ BazaarNama.
// zustand (از قبل در پروژه هست). با localStorage پایدار می‌ماند تا رفرش/بازکردنِ مجدد چیزی را از دست ندهد.
import { create } from 'zustand';

const LS = 'pc_app_v1';
const load = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } };
const saved = load();
const normalizeLang = (lang) => (lang === 'en' ? 'en' : 'fa');

// سند عمومی همیشه فارسی/RTL می‌ماند. زبان انتخابی کاربر فقط روی جزیرهٔ اپ
// اعمال می‌شود تا metadata و ریشهٔ همهٔ entry pointهای عمومی قرارداد PC-009 را حفظ کنند.
// اعداد لاتین می‌مانند (تصمیمِ محصول).
export function applyLang(lang) {
  try {
    const selectedLang = normalizeLang(lang);
    const selectedDir = selectedLang === 'en' ? 'ltr' : 'rtl';
    const documentRoot = document.documentElement;
    documentRoot.lang = 'fa';
    documentRoot.dir = 'rtl';

    const appRoots = [document.body, document.getElementById('root')].filter(Boolean);
    for (const appRoot of appRoots) {
      appRoot.lang = selectedLang;
      appRoot.dir = selectedDir;
    }
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
  lang: normalizeLang(saved.lang), // پیش‌فرض و fallback: فارسی
  theme: saved.theme || 'light', // پیش‌فرض: روشن و مینیمال
  tab: 'chart',                  // تبِ فعالِ ناوبری
  setLang: (lang) => {
    const normalized = normalizeLang(lang);
    applyLang(normalized);
    localStorage.setItem(LS, JSON.stringify({ ...load(), lang: normalized }));
    set({ lang: normalized });
  },
  toggleLang: () => get().setLang(get().lang === 'fa' ? 'en' : 'fa'),
  setTheme: (theme) => { applyTheme(theme); localStorage.setItem(LS, JSON.stringify({ ...load(), theme })); set({ theme }); },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
  setTab: (tab) => set({ tab }),
}));

// اعمالِ اولیه هنگامِ بارگذاریِ ماژول (قبل از رندرِ اپ).
applyLang(useApp.getState().lang);
applyTheme(useApp.getState().theme);
