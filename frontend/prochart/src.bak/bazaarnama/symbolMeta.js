// بازارنما — غنی‌سازیِ متادیتای نماد (کلاینت‌ساید، بدون تماسِ بک‌اند اضافه).
// خروجیِ خامِ chartSymbols() (آرایهٔ رشته‌ای) را به SymbolMeta[] تبدیل می‌کند تا
// مدالِ جستجوی #7 بتواند دسته‌بندی/توضیحِ فارسی/پرچم بدهد. بک‌اند تغییر نمی‌کند؛
// اگر بعداً سرور فیلدها را داد، فقط buildMeta با merge جایگزین می‌شود.
const CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'];
const CCY_FA = {
  USD: 'دلار آمریکا', EUR: 'یورو', GBP: 'پوند انگلیس', JPY: 'ین ژاپن',
  CHF: 'فرانک سوئیس', CAD: 'دلار کانادا', AUD: 'دلار استرالیا', NZD: 'دلار نیوزیلند',
};
const METAL = { XAU: ['طلا', 'metal'], XAG: ['نقره', 'metal'], XPT: ['پلاتین', 'metal'], XPD: ['پالادیوم', 'metal'] };
const ENERGY = /^(OIL|WTI|BRENT|XTI|XBR|XNG|NGAS|UKOIL|USOIL)/;
const INDEX = /^(US30|US500|US100|NAS100|NAS|SPX|DJI|NDX|UK100|DE40|GER40|JP225|FRA40|HK50|AUS200|EU50)/;
const INDEX_FA = {
  US30: 'داوجونز ۳۰', US500: 'اس‌اند‌پی ۵۰۰', US100: 'نزدک ۱۰۰', NAS100: 'نزدک ۱۰۰',
  UK100: 'فوتسی ۱۰۰', DE40: 'دکس ۴۰', GER40: 'دکس ۴۰', JP225: 'نیکی ۲۲۵', FRA40: 'کک ۴۰',
  HK50: 'هنگ‌سنگ', AUS200: 'ASX 200', EU50: 'یوروستاکس ۵۰',
};
const INDEX_CC = { US30: 'US', US500: 'US', US100: 'US', NAS100: 'US', UK100: 'GB', DE40: 'DE', GER40: 'DE', JP225: 'JP', FRA40: 'FR', HK50: 'HK', AUS200: 'AU', EU50: 'EU' };
// نام‌های نمایشیِ فارسیِ برخی کریپتوهای پرتکرار (برای جستجو روی توضیح)
const CRYPTO_FA = {
  BTC: 'بیت‌کوین', ETH: 'اتریوم', BNB: 'بایننس‌کوین', SOL: 'سولانا', XRP: 'ریپل',
  ADA: 'کاردانو', DOGE: 'دوج‌کوین', TRX: 'ترون', AVAX: 'آوالانچ', LINK: 'چین‌لینک',
  DOT: 'پولکادات', MATIC: 'پالیگان', LTC: 'لایت‌کوین', TON: 'تون', SHIB: 'شیبا',
  PEPE: 'پپه', NEAR: 'نیر', ATOM: 'کازماس',
};
// محبوب‌ها برای رتبهٔ پیش‌فرض
const POPULAR = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSDT', 'ETHUSDT', 'BTCUSD', 'ETHUSD', 'US30', 'US500', 'NAS100', 'AUDUSD', 'USDCAD', 'USDCHF', 'GBPJPY']);

function up(s) { return String(s || '').toUpperCase(); }

export function classify(symRaw) {
  const sym = up(symRaw);
  const clean = sym.replace(/[^A-Z0-9]/g, '');
  // فلز در برابر دلار
  for (const m of Object.keys(METAL)) {
    if (clean.startsWith(m)) {
      const q = clean.slice(m.length, m.length + 3);
      return {
        symbol: sym, cat: 'metal', base: m, quote: q || 'USD',
        desc: `${METAL[m][0]}${q && CCY_FA[q] ? (' / ' + CCY_FA[q]) : ''}`,
      };
    }
  }
  // انرژی
  if (ENERGY.test(clean)) return { symbol: sym, cat: 'energy', desc: 'نفت/انرژی', country: 'US' };
  // شاخص
  if (INDEX.test(clean)) {
    const key = Object.keys(INDEX_FA).find((k) => clean.startsWith(k)) || clean.slice(0, 5);
    return { symbol: sym, cat: 'index', desc: INDEX_FA[key] || sym, country: INDEX_CC[key] || 'US' };
  }
  // جفت‌ارزِ فیات
  if (clean.length >= 6) {
    const a = clean.slice(0, 3), b = clean.slice(3, 6);
    if (CCY.includes(a) && CCY.includes(b)) {
      return { symbol: sym, cat: 'forex', base: a, quote: b, desc: `${CCY_FA[a]} / ${CCY_FA[b]}` };
    }
  }
  // کریپتو (پسوندِ USDT/USDC/USD/BTC/ETH)
  const base = clean.replace(/(USDT|USDC|USD|BTC|ETH)$/, '');
  if (base && base !== clean) {
    const quote = clean.slice(base.length);
    return { symbol: sym, cat: 'crypto', base, quote, desc: CRYPTO_FA[base] ? `${CRYPTO_FA[base]} (${base})` : base };
  }
  return { symbol: sym, cat: 'other', desc: sym };
}

export function buildMeta(list) {
  return (list || []).map((s) => { const m = classify(s); m.popular = POPULAR.has(up(s).replace(/[^A-Z0-9]/g, '')); return m; });
}

export const CATEGORIES = [
  { id: 'all', label: 'همه' },
  { id: 'forex', label: 'فارکس' },
  { id: 'crypto', label: 'کریپتو' },
  { id: 'metal', label: 'فلزات' },
  { id: 'index', label: 'شاخص‌ها' },
  { id: 'energy', label: 'انرژی' },
];

// برچسبِ فارسیِ دسته برای نمایش در ردیفِ نتیجه
export const CAT_FA = { forex: 'فارکس', crypto: 'کریپتو', metal: 'فلز', index: 'شاخص', energy: 'انرژی', other: 'سایر' };
