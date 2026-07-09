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

// —— متادیتای تکمیلی برای پنلِ جزئیات (#۸): جلسهٔ معاملاتی + منطقهٔ زمانی + اندازهٔ قرارداد/تیک ——
// جلسهٔ معاملاتیِ پیش‌فرضِ هر دسته (فارکس/کریپتو/فلز/انرژی ۲۴ساعته‌اند؛ شاخص‌ها ساعتِ بورسِ خود).
const SESSION = {
  forex: { session: '۲۴ ساعته · یکشنبه ۲۲:۰۰ تا جمعه ۲۲:۰۰', tz: 'UTC' },
  crypto: { session: '۲۴/۷ · بدونِ تعطیلی', tz: 'UTC' },
  metal: { session: '۲۴ ساعته · یکشنبه ۲۳:۰۰ تا جمعه ۲۲:۰۰', tz: 'UTC' },
  energy: { session: '۲۴ ساعته · یکشنبه ۲۳:۰۰ تا جمعه ۲۲:۰۰', tz: 'America/New_York' },
  other: { session: '—', tz: 'UTC' },
};
// جلسهٔ بورسِ هر شاخص (ساعتِ محلیِ همان بورس) بر پایهٔ کشورِ INDEX_CC.
const INDEX_SESSION = {
  US: { session: '۰۹:۳۰ تا ۱۶:۰۰', tz: 'America/New_York' },
  GB: { session: '۰۸:۰۰ تا ۱۶:۳۰', tz: 'Europe/London' },
  DE: { session: '۰۹:۰۰ تا ۱۷:۳۰', tz: 'Europe/Berlin' },
  FR: { session: '۰۹:۰۰ تا ۱۷:۳۰', tz: 'Europe/Paris' },
  JP: { session: '۰۹:۰۰ تا ۱۵:۰۰', tz: 'Asia/Tokyo' },
  HK: { session: '۰۹:۳۰ تا ۱۶:۰۰', tz: 'Asia/Hong_Kong' },
  AU: { session: '۱۰:۰۰ تا ۱۶:۰۰', tz: 'Australia/Sydney' },
  EU: { session: '۰۹:۰۰ تا ۱۷:۳۰', tz: 'Europe/Berlin' },
};
// اندازهٔ قرارداد + کمینه‌تیکِ هر فلز (اونسِ ترویِ استاندارد).
const METAL_SPEC = {
  XAU: { contract: '۱۰۰ اونس', tick: 0.01 },
  XAG: { contract: '۵٬۰۰۰ اونس', tick: 0.001 },
  XPT: { contract: '۵۰ اونس', tick: 0.1 },
  XPD: { contract: '۱۰۰ اونس', tick: 0.01 },
};

function up(s) { return String(s || '').toUpperCase(); }

// افزودنِ فیلدهای تکمیلی (name/session/tz/contract/tick/pip) روی متادیتای پایه — فقط اضافه، بدون تغییرِ فیلدهای موجود.
function enrich(m) {
  // نامِ کاملِ خوانا برای پنلِ جزئیات (همان توضیحِ فارسیِ ساخته‌شده).
  m.name = m.desc;
  // جلسهٔ معاملاتی + منطقهٔ زمانی
  const sess = m.cat === 'index' ? (INDEX_SESSION[m.country] || INDEX_SESSION.US) : (SESSION[m.cat] || SESSION.other);
  m.session = sess.session;
  m.tz = sess.tz;
  // اندازهٔ قرارداد + کمینه‌تیک (مقادیرِ رایجِ بروکرها؛ نمایشی برای پنلِ مشخصات)
  if (m.cat === 'forex') {
    m.contract = '۱۰۰٬۰۰۰ ' + (m.base || '');
    m.tick = m.quote === 'JPY' ? 0.001 : 0.00001;
    m.pip = m.quote === 'JPY' ? 0.01 : 0.0001;
  } else if (m.cat === 'metal') {
    const spec = METAL_SPEC[m.base] || { contract: '—', tick: 0.01 };
    m.contract = spec.contract; m.tick = spec.tick;
  } else if (m.cat === 'index') {
    m.contract = '۱ واحد به‌ازای هر پوینت'; m.tick = 0.1;
  } else if (m.cat === 'energy') {
    m.contract = '۱٬۰۰۰ بشکه'; m.tick = 0.01;
  } else if (m.cat === 'crypto') {
    m.contract = '۱ ' + (m.base || ''); m.tick = 0.01;
  } else {
    m.contract = '—'; m.tick = 0.01;
  }
  return m;
}

export function classify(symRaw) {
  return enrich(classifyRaw(symRaw));
}

function classifyRaw(symRaw) {
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
