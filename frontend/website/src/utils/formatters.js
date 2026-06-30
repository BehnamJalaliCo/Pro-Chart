/**
 * formatters.js - توابع فرمت‌دهی برای پلتفرم سیگنال فارکس
 * تمام متن‌ها به فارسی
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * تبدیل ارقام لاتین به ارقام فارسی
 * @param {string|number} str
 * @returns {string}
 *
 * @example
 * toPersianDigits('12345') // '۱۲۳۴۵'
 * toPersianDigits(2890)    // '۲۸۹۰'
 */
export function toPersianDigits(str) {
  if (str == null) return '';
  return String(str).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

/**
 * فرمت قیمت با جداکننده هزارگان
 * @param {number|string} price - قیمت
 * @param {number} [decimals=2] - تعداد ارقام اعشار
 * @returns {string}
 *
 * @example
 * formatPrice(1234.5678)     // '1,234.57'
 * formatPrice(2041.5, 1)     // '2,041.5'
 * formatPrice('0.8745', 4)   // '0.8745'
 */
export function formatPrice(price, decimals = 2) {
  if (price == null || price === '') return '-';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '-';

  const fixed = num.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart ? `${withCommas}.${decPart}` : withCommas;
}

/**
 * فرمت پیپ با علامت مثبت/منفی
 * @param {number|string} pips
 * @returns {string}
 *
 * @example
 * formatPips(35)    // '+35'
 * formatPips(-12)   // '-12'
 * formatPips(0)     // '0'
 */
export function formatPips(pips) {
  if (pips == null || pips === '') return '-';
  const num = typeof pips === 'string' ? parseFloat(pips) : pips;
  if (isNaN(num)) return '-';

  if (num > 0) return `+${num}`;
  if (num < 0) return `${num}`;
  return '0';
}

/**
 * فرمت درصد با علامت %
 * @param {number|string} value
 * @param {number} [decimals=2]
 * @returns {string}
 *
 * @example
 * formatPercent(78.5)    // '78.50%'
 * formatPercent(-3.2, 1) // '-3.2%'
 * formatPercent(0.15)    // '0.15%'
 */
export function formatPercent(value, decimals = 2) {
  if (value == null || value === '') return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${num.toFixed(decimals)}%`;
}

/**
 * فرمت تاریخ به شمسی/فارسی با استفاده از Intl
 * @param {string|Date|number} date
 * @param {Object} [options]
 * @param {boolean} [options.showTime=false] - نمایش ساعت
 * @param {boolean} [options.showYear=true] - نمایش سال
 * @param {'long'|'short'|'numeric'} [options.monthFormat='long'] - فرمت ماه
 * @returns {string}
 *
 * @example
 * formatDate('2026-02-28')
 * // '۹ اسفند ۱۴۰۴'
 *
 * formatDate('2026-02-28T10:30:00', { showTime: true })
 * // '۹ اسفند ۱۴۰۴ - ۱۰:۳۰'
 */
export function formatDate(date, options = {}) {
  if (!date) return '-';

  const { showTime = false, showYear = true, monthFormat = 'long' } = options;

  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return '-';

    const intlOptions = {
      calendar: 'persian',
      day: 'numeric',
      month: monthFormat,
    };

    if (showYear) {
      intlOptions.year = 'numeric';
    }

    const formatter = new Intl.DateTimeFormat('fa-IR', intlOptions);
    let result = formatter.format(dateObj);

    if (showTime) {
      const timeFormatter = new Intl.DateTimeFormat('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      result += ` - ${timeFormatter.format(dateObj)}`;
    }

    return result;
  } catch {
    return '-';
  }
}

/**
 * فرمت عدد به فارسی با جداکننده هزارگان
 * @param {number|string} num
 * @param {number} [decimals=0]
 * @returns {string}
 *
 * @example
 * formatNumber(12400)   // '۱۲٬۴۰۰'
 * formatNumber(2890.5, 1) // '۲٬۸۹۰٫۵'
 */
export function formatNumber(num, decimals = 0) {
  if (num == null || num === '') return '-';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '-';

  try {
    const formatter = new Intl.NumberFormat('fa-IR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return formatter.format(n);
  } catch {
    // فال‌بک دستی
    const fixed = n.toFixed(decimals);
    return toPersianDigits(fixed.replace(/\B(?=(\d{3})+(?!\d))/g, '٬'));
  }
}

/**
 * برچسب قدرت سیگنال بر اساس امتیاز
 * @param {number} score - امتیاز ۰ تا ۱۰۰
 * @returns {string}
 *
 * @example
 * getSignalStrengthLabel(85) // 'بسیار قوی'
 * getSignalStrengthLabel(65) // 'قوی'
 * getSignalStrengthLabel(45) // 'متوسط'
 * getSignalStrengthLabel(25) // 'ضعیف'
 * getSignalStrengthLabel(10) // 'بسیار ضعیف'
 */
export function getSignalStrengthLabel(score) {
  if (score == null || isNaN(score)) return '-';
  if (score >= 80) return 'بسیار قوی';
  if (score >= 65) return 'قوی';
  if (score >= 45) return 'متوسط';
  if (score >= 25) return 'ضعیف';
  return 'بسیار ضعیف';
}

/**
 * برچسب فارسی جهت معامله
 * @param {'BUY'|'SELL'|string} direction
 * @returns {string}
 *
 * @example
 * getDirectionLabel('BUY')  // 'خرید'
 * getDirectionLabel('SELL') // 'فروش'
 */
export function getDirectionLabel(direction) {
  if (!direction) return '-';
  const upper = String(direction).toUpperCase();
  if (upper === 'BUY' || upper === 'LONG') return 'خرید';
  if (upper === 'SELL' || upper === 'SHORT') return 'فروش';
  return direction;
}

/**
 * فرمت زمان نسبی به فارسی
 * @param {string|Date} date
 * @returns {string}
 *
 * @example
 * formatRelativeTime(new Date(Date.now() - 300000)) // '۵ دقیقه پیش'
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  const dateObj = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diff = now - dateObj;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (seconds < 30) return 'لحظاتی پیش';
  if (seconds < 60) return `${toPersianDigits(seconds)} ثانیه پیش`;
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  if (hours < 24) return `${toPersianDigits(hours)} ساعت پیش`;
  if (days < 7) return `${toPersianDigits(days)} روز پیش`;
  if (weeks < 5) return `${toPersianDigits(weeks)} هفته پیش`;
  if (months < 12) return `${toPersianDigits(months)} ماه پیش`;
  return formatDate(dateObj);
}

/**
 * تبدیل وضعیت سیگنال به برچسب فارسی
 * @param {string} status
 * @returns {string}
 */
export function getStatusLabel(status) {
  const map = {
    active: 'فعال',
    tp_hit: 'سود محقق شد',
    tp1_hit: 'TP1 فعال',
    tp2_hit: 'TP2 فعال',
    tp3_hit: 'TP3 فعال',
    sl_hit: 'حد ضرر فعال شد',
    cancelled: 'لغو شده',
    closed: 'بسته شده',
    pending: 'در انتظار',
    expired: 'منقضی شده',
  };
  return map[status] || status || '-';
}

/**
 * تبدیل تایم‌فریم به برچسب فارسی
 * @param {string} tf
 * @returns {string}
 */
export function getTimeframeLabel(tf) {
  const map = {
    M1: '۱ دقیقه',
    M5: '۵ دقیقه',
    M15: '۱۵ دقیقه',
    M30: '۳۰ دقیقه',
    H1: '۱ ساعته',
    H4: '۴ ساعته',
    D1: 'روزانه',
    W1: 'هفتگی',
    MN: 'ماهانه',
  };
  return map[tf] || tf || '-';
}
