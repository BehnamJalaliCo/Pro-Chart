// کاتالوگِ لوگوی TradingView برای کریپتو — یک‌بار از بک‌اند لود می‌شود و ماژول‌سطح کش می‌ماند.
// SymbolLogo برای هر کوینِ کریپتو logoidِ TV را از اینجا می‌گیرد (وقتی آیکونِ محلی نداریم) و
// از پراکسیِ /api/public/symbol-logo رِندر می‌کند. workerِ بک‌اند کاتالوگ را با نمادهای جدیدِ TV سینک می‌کند.
let _crypto = {};
let _ready = false;
const _subs = new Set();

function _norm(sym) {
  let s = String(sym || '').toUpperCase().replace(/_/g, '');
  if (s.endsWith('USD') && !s.endsWith('USDT')) s = s.slice(0, -3) + 'USDT';
  if (!s.endsWith('USDT')) s += 'USDT';
  return s;
}

// logoidِ کریپتوی TV برای یک نماد (یا null اگر TV لوگو نداشت / هنوز لود نشده).
export function cryptoLogoId(symbol) {
  return _crypto[_norm(symbol)] || null;
}

export function catalogReady() {
  return _ready;
}

// اشتراک برای re-render وقتی کاتالوگ آماده شد (لوگوها بدونِ نیاز به تعامل ظاهر می‌شوند).
export function onCatalogReady(cb) {
  _subs.add(cb);
  return () => _subs.delete(cb);
}

(function load() {
  try {
    const base = (import.meta.env && import.meta.env.VITE_API_URL) || '/api';
    fetch(base + '/public/symbol-catalog')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.crypto) _crypto = d.crypto;
        _ready = true;
        _subs.forEach((fn) => { try { fn(); } catch (e) { /* noop */ } });
      })
      .catch(() => { /* شبکه/فیلترینگ — بی‌صدا؛ fallback به بَجِ رنگی */ });
  } catch (e) { /* SSR/غیرمرورگر */ }
})();
