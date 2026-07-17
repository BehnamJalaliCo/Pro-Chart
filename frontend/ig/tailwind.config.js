/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0f1320', soft: '#3a4560', muted: '#7c89a8' },
        brand: { DEFAULT: '#6d28d9', 600: '#7c3aed', 500: '#8b5cf6', 50: '#f3effe' },
        accent: { pink: '#e1306c', orange: '#f56040', amber: '#fcaf45', blue: '#2563eb', green: '#10b981', red: '#ef4444' },
        glass: 'rgba(255,255,255,0.72)',
      },
      fontFamily: { vazir: ['Vazirmatn', 'sans-serif'] },
      borderRadius: { xl: '0.9rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      boxShadow: {
        soft: '0 4px 24px -8px rgba(24,28,48,0.12)',
        card: '0 8px 40px -16px rgba(24,28,48,0.18)',
        glow: '0 10px 50px -12px rgba(109,40,217,0.35)',
      },
      backgroundImage: {
        'cine': 'radial-gradient(120% 80% at 10% 0%, #f5f3ff 0%, #eef2ff 35%, #fdf2f8 100%)',
        'brand-grad': 'linear-gradient(135deg, #7c3aed 0%, #e1306c 55%, #f56040 100%)',
      },
    },
  },
  plugins: [],
};
