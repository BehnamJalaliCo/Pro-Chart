/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // brand.<c>          — رنگِ روشن. برای **متن روی پس‌زمینهٔ تیره** و تینتِ آلفا (bg-brand-x/10).
        // brand.<c>.strong   — نسخهٔ تیرهٔ AA. برای **پس‌زمینهٔ متنِ سفید**.
        //
        // یک توکن نمی‌تواند هر دو کار را بکند: #00C853 با متنِ سفید کنتراستِ ۲.۲۴ می‌دهد
        // (حداقلِ AA برابرِ ۴.۵ است) ولی روی پس‌زمینهٔ تیره درست و خواناست. پیش‌تر هر ۴
        // کلاسِ .btn-* از نسخهٔ روشن استفاده می‌کردند و همگی AA را رد می‌کردند:
        //   blue 3.98 · green 2.24 · red 3.85 · amber 2.04
        // مقادیرِ strong همان‌هایی‌اند که TH در BazaarNama.jsx از قبل ساخته و تأیید کرده
        // (upText/downText/accentText) — کارش انجام شده بود، فقط دکمه‌ها ازش استفاده نمی‌کردند.
        brand: {
          green: { DEFAULT: '#00C853', strong: '#086d5c' }, // ۶.۲۶ روی سفید
          red:   { DEFAULT: '#FF1744', strong: '#b42335' }, // ۶.۵۰
          blue:  { DEFAULT: '#2962FF', strong: '#1e53e5' }, // ۶.۱۳ — DEFAULT با --accent یکی شد (پیش‌تر #2979FF بود: دو آبیِ متفاوت هم‌زمان)
          amber: { DEFAULT: '#FFA000', strong: '#8a5a00' }, // ۵.۹۳
        },
        surface: {
          DEFAULT: 'var(--surface-default)', card: 'var(--surface-card)', elevated: 'var(--surface-elevated)',
          border: 'var(--surface-border)', hover: 'var(--surface-hover)',
        },
        text: { primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)' },
      },
      // مقیاسِ سایه = همان دو نقشِ --pc-shadow-*.
      //
      // پیش‌فرض‌های Tailwind (shadow-sm/md/lg/xl/2xl) پنج سایهٔ سیاهِ **تم‌ناآگاه**
      // می‌سازند که کنارِ توکن‌های ما نشت می‌کردند — رندرِ زنده ۱۱ سایهٔ متمایز نشان داد
      // در حالی که TradingView دقیقاً یکی دارد. ۲۷ کلاسِ shadow-* در سطوحِ زنده بود؛
      // به‌جای ویرایشِ تک‌تک، خودِ مقیاس بازتعریف شد تا هر کلاس به نقشِ درست بیفتد و
      // کدِ موجود دست‌نخورده بماند.
      boxShadow: {
        none: 'none',
        sm: 'var(--pc-shadow-pop)',
        DEFAULT: 'var(--pc-shadow-pop)',
        md: 'var(--pc-shadow-pop)',
        lg: 'var(--pc-shadow-pop)',    // منو/دراپ‌داون/پاپ‌اور
        xl: 'var(--pc-shadow-modal)',
        '2xl': 'var(--pc-shadow-modal)', // مودالِ روی بک‌دراپ
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      },
      fontFamily: { sans: ['IRANYekanX', 'Ravagh', 'AnjomanMax', 'Vazirmatn', 'sans-serif'], ravagh: ['Ravagh', 'sans-serif'], anjoman: ['AnjomanMax', 'sans-serif'], vazir: ['Vazirmatn', 'sans-serif'] },
      borderRadius: { xl: '0.875rem', '2xl': '1rem' },
    },
  },
  plugins: [],
};
