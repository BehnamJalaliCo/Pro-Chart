// بازارنما — غنی‌سازیِ متادیتای نماد (کلاینت‌ساید، بدون تماسِ بک‌اند اضافه).
// خروجیِ خامِ chartSymbols() (آرایهٔ رشته‌ای) را به SymbolMeta[] تبدیل می‌کند تا
// مدالِ جستجوی #7 بتواند دسته‌بندی/توضیحِ فارسی/پرچم بدهد. بک‌اند تغییر نمی‌کند؛
// اگر بعداً سرور فیلدها را داد، فقط buildMeta با merge جایگزین می‌شود.
// ارزهای فیاتِ واقعیِ موجود روی حسابِ مَستر (میجرها + کراس‌ها + اگزوتیک‌های رایجِ OneRoyal).
const CCY = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD',
  'NOK', 'SEK', 'SGD', 'HKD', 'TRY', 'ZAR', 'MXN', 'CNH', 'DKK', 'PLN'];
const CCY_FA = {
  USD: 'دلار آمریکا', EUR: 'یورو', GBP: 'پوند انگلیس', JPY: 'ین ژاپن',
  CHF: 'فرانک سوئیس', CAD: 'دلار کانادا', AUD: 'دلار استرالیا', NZD: 'دلار نیوزیلند',
  NOK: 'کرون نروژ', SEK: 'کرون سوئد', SGD: 'دلار سنگاپور', HKD: 'دلار هنگ‌کنگ',
  TRY: 'لیر ترکیه', ZAR: 'راند آفریقای جنوبی', MXN: 'پزو مکزیک', CNH: 'یوان چین',
  DKK: 'کرون دانمارک', PLN: 'زلوتی لهستان',
};
// نامِ کاملِ انگلیسیِ استانداردِ ارزها (سبکِ سرتیترِ TradingView).
const CCY_EN = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
  CHF: 'Swiss Franc', CAD: 'Canadian Dollar', AUD: 'Australian Dollar', NZD: 'New Zealand Dollar',
  NOK: 'Norwegian Krone', SEK: 'Swedish Krona', SGD: 'Singapore Dollar', HKD: 'Hong Kong Dollar',
  TRY: 'Turkish Lira', ZAR: 'South African Rand', MXN: 'Mexican Peso', CNH: 'Chinese Yuan',
  DKK: 'Danish Krone', PLN: 'Polish Zloty',
};
const METAL = { XAU: ['طلا', 'metal'], XAG: ['نقره', 'metal'], XPT: ['پلاتین', 'metal'], XPD: ['پالادیوم', 'metal'], XCU: ['مس', 'metal'] };
const METAL_EN = { XAU: 'Gold', XAG: 'Silver', XPT: 'Platinum', XPD: 'Palladium', XCU: 'Copper' };
const ENERGY = /^(OIL|WTI|BRENT|XTI|XBR|XNG|NGAS|NATGAS|UKOIL|USOIL)/;
// تفکیکِ نوعِ ابزارِ انرژی برای نامِ درست (WTI / برنت / گاز طبیعی) — نه برچسبِ عمومی.
const ENERGY_MAP = [
  { re: /^(XTI|WTI|USOIL|OIL)/, fa: 'نفت خام WTI', en: 'WTI Crude Oil', base: 'WTI' },
  { re: /^(XBR|UKOIL|BRENT)/, fa: 'نفت خام برنت', en: 'Brent Crude Oil', base: 'BRENT' },
  { re: /^(XNG|NGAS|NATGAS)/, fa: 'گاز طبیعی', en: 'Natural Gas', base: 'NGAS' },
];
const INDEX = /^(US30|US500|US100|NAS100|NAS|SPX|DJI|NDX|UK100|DE40|GER40|JP225|FRA40|HK50|AUS200|EU50)/;
const INDEX_FA = {
  US30: 'داوجونز ۳۰', US500: 'اس‌اند‌پی ۵۰۰', US100: 'نزدک ۱۰۰', NAS100: 'نزدک ۱۰۰',
  UK100: 'فوتسی ۱۰۰', DE40: 'دکس ۴۰', GER40: 'دکس ۴۰', JP225: 'نیکی ۲۲۵', FRA40: 'کک ۴۰',
  HK50: 'هنگ‌سنگ', AUS200: 'ASX 200', EU50: 'یوروستاکس ۵۰',
};
// نامِ کاملِ انگلیسیِ استانداردِ شاخص‌ها.
const INDEX_EN = {
  US30: 'Dow Jones 30', US500: 'S&P 500', US100: 'Nasdaq 100', NAS100: 'Nasdaq 100',
  UK100: 'FTSE 100', DE40: 'DAX 40', GER40: 'DAX 40', JP225: 'Nikkei 225', FRA40: 'CAC 40',
  HK50: 'Hang Seng', AUS200: 'ASX 200', EU50: 'Euro Stoxx 50',
};
const INDEX_CC = { US30: 'US', US500: 'US', US100: 'US', NAS100: 'US', UK100: 'GB', DE40: 'DE', GER40: 'DE', JP225: 'JP', FRA40: 'FR', HK50: 'HK', AUS200: 'AU', EU50: 'EU' };
// نام‌های نمایشیِ فارسیِ کریپتوهای موجود (پوششِ کاملِ لیستِ market-capِ فیدِ LBank).
const CRYPTO_FA = {
  BTC: 'بیت‌کوین', ETH: 'اتریوم', USDT: 'تتر', BNB: 'بایننس‌کوین', SOL: 'سولانا',
  XRP: 'ریپل', USDC: 'یواس‌دی‌کوین', ADA: 'کاردانو', DOGE: 'دوج‌کوین', TRX: 'ترون',
  TON: 'تون‌کوین', AVAX: 'آوالانچ', SHIB: 'شیبا اینو', LINK: 'چین‌لینک', DOT: 'پولکادات',
  BCH: 'بیت‌کوین‌کش', LTC: 'لایت‌کوین', NEAR: 'نیر', MATIC: 'پالیگان', UNI: 'یونی‌سواپ',
  ICP: 'اینترنت‌کامپیوتر', APT: 'اپتاس', XLM: 'استلار', ETC: 'اتریوم‌کلاسیک', FIL: 'فایل‌کوین',
  ATOM: 'کازماس', ARB: 'آربیتروم', OP: 'اپتیمیزم', INJ: 'اینجکتیو', SUI: 'سویی',
  PEPE: 'پپه', TIA: 'سلستیا', RNDR: 'رندر', IMX: 'ایمیوتبل‌ایکس', HBAR: 'هدرا',
  VET: 'وی‌چین', GRT: 'گراف', SEI: 'سِی', FTM: 'فانتوم', AAVE: 'آوه',
  ALGO: 'الگورند', FLOW: 'فلو', SAND: 'سندباکس', MANA: 'دیسنترالند', AXS: 'اکسی‌اینفینیتی',
  EGLD: 'مولتی‌ورس‌ایکس', XTZ: 'تِزوس', CHZ: 'چیلیز',
};
// نامِ کاملِ انگلیسیِ استانداردِ کریپتوها (برای پنلِ جزئیات/سرتیتر).
const CRYPTO_EN = {
  BTC: 'Bitcoin', ETH: 'Ethereum', USDT: 'Tether', BNB: 'BNB', SOL: 'Solana',
  XRP: 'XRP', USDC: 'USD Coin', ADA: 'Cardano', DOGE: 'Dogecoin', TRX: 'TRON',
  TON: 'Toncoin', AVAX: 'Avalanche', SHIB: 'Shiba Inu', LINK: 'Chainlink', DOT: 'Polkadot',
  BCH: 'Bitcoin Cash', LTC: 'Litecoin', NEAR: 'NEAR Protocol', MATIC: 'Polygon', UNI: 'Uniswap',
  ICP: 'Internet Computer', APT: 'Aptos', XLM: 'Stellar', ETC: 'Ethereum Classic', FIL: 'Filecoin',
  ATOM: 'Cosmos', ARB: 'Arbitrum', OP: 'Optimism', INJ: 'Injective', SUI: 'Sui',
  PEPE: 'Pepe', TIA: 'Celestia', RNDR: 'Render', IMX: 'Immutable', HBAR: 'Hedera',
  VET: 'VeChain', GRT: 'The Graph', SEI: 'Sei', FTM: 'Fantom', AAVE: 'Aave',
  ALGO: 'Algorand', FLOW: 'Flow', SAND: 'The Sandbox', MANA: 'Decentraland', AXS: 'Axie Infinity',
  EGLD: 'MultiversX', XTZ: 'Tezos', CHZ: 'Chiliz',
};
// محبوب‌ها برای رتبهٔ پیش‌فرض
const POPULAR = new Set(['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'XAGUSD', 'XTIUSD', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BTCUSD', 'ETHUSD', 'US30', 'US500', 'NAS100', 'DE40', 'AUDUSD', 'USDCAD', 'USDCHF', 'GBPJPY']);

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

// نامِ کاملِ انگلیسیِ استانداردِ نماد (سبکِ سرتیترِ TradingView: «Euro / US Dollar»). نبودِ نگاشت ⇐ خودِ نماد.
function nameEnOf(m) {
  if (m.cat === 'forex') return `${CCY_EN[m.base] || m.base} / ${CCY_EN[m.quote] || m.quote}`;
  if (m.cat === 'metal') return (METAL_EN[m.base] || m.base) + (m.quote && CCY_EN[m.quote] ? ' / ' + CCY_EN[m.quote] : '');
  if (m.cat === 'index') return INDEX_EN[m.indexKey] || m.symbol;
  if (m.cat === 'energy') return m.enName || 'Energy';
  if (m.cat === 'crypto') return (CRYPTO_EN[m.base] || m.base) + (m.quote ? ' / ' + m.quote : '');
  return m.symbol;
}

// افزودنِ فیلدهای تکمیلی (name/nameEn/session/tz/contract/tick/pip) روی متادیتای پایه — فقط اضافه، بدون تغییرِ فیلدهای موجود.
function enrich(m) {
  // نامِ کاملِ خوانا برای پنلِ جزئیات (همان توضیحِ فارسیِ ساخته‌شده).
  m.name = m.desc;
  // نامِ کاملِ انگلیسیِ استاندارد (برای سرتیترِ دووجهیِ فارسی/انگلیسیِ سبکِ TradingView).
  m.nameEn = nameEnOf(m);
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
    // گاز طبیعی: قراردادِ ۱۰٬۰۰۰ MMBtu؛ نفت (WTI/برنت): ۱٬۰۰۰ بشکه (هم‌ترازِ instruments.py).
    const isGas = m.base === 'NGAS';
    m.contract = isGas ? '۱۰٬۰۰۰ MMBtu' : '۱٬۰۰۰ بشکه';
    m.tick = isGas ? 0.001 : 0.01;
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
  // انرژی — نامِ درستِ ابزار (WTI / برنت / گاز طبیعی) به‌جای برچسبِ عمومی؛ همه USD-مظنه‌اند.
  if (ENERGY.test(clean)) {
    const e = ENERGY_MAP.find((x) => x.re.test(clean)) || { fa: 'نفت/انرژی', en: 'Energy', base: 'OIL' };
    return { symbol: sym, cat: 'energy', base: e.base, quote: 'USD', desc: e.fa, enName: e.en, country: 'US' };
  }
  // شاخص
  if (INDEX.test(clean)) {
    const key = Object.keys(INDEX_FA).find((k) => clean.startsWith(k)) || clean.slice(0, 5);
    return { symbol: sym, cat: 'index', indexKey: key, desc: INDEX_FA[key] || sym, country: INDEX_CC[key] || 'US' };
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
