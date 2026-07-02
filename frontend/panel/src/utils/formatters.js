const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\d/g, (d) => persianDigits[parseInt(d)]);
}

export function formatNumber(value, locale = 'fa-IR') {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return num.toLocaleString(locale);
}

export function formatPrice(price, decimals = 2) {
  if (price === null || price === undefined) return '';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '';
  return toPersianDigits(num.toFixed(decimals));
}

export function formatPips(pips) {
  if (pips === null || pips === undefined) return '';
  const num = typeof pips === 'string' ? parseFloat(pips) : pips;
  if (isNaN(num)) return '';
  const sign = num >= 0 ? '+' : '';
  return toPersianDigits(`${sign}${num.toFixed(1)}`);
}

export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return toPersianDigits(`${num.toFixed(decimals)}٪`);
}

export function formatDate(dateInput) {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDateTime(dateInput) {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const datePart = date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timePart = date.toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} ${timePart}`;
}

export function formatRelativeTime(dateInput) {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 0) {
    return 'الان';
  }
  if (diffSeconds < 60) {
    return 'لحظاتی پیش';
  }
  if (diffMinutes < 60) {
    return `${toPersianDigits(diffMinutes)} دقیقه پیش`;
  }
  if (diffHours < 24) {
    return `${toPersianDigits(diffHours)} ساعت پیش`;
  }
  if (diffDays < 7) {
    return `${toPersianDigits(diffDays)} روز پیش`;
  }
  if (diffWeeks < 4) {
    return `${toPersianDigits(diffWeeks)} هفته پیش`;
  }
  if (diffMonths < 12) {
    return `${toPersianDigits(diffMonths)} ماه پیش`;
  }
  return `${toPersianDigits(diffYears)} سال پیش`;
}

export function getSignalStrengthLabel(score) {
  if (score === null || score === undefined) return '';
  const num = typeof score === 'string' ? parseInt(score) : score;
  if (num >= 90) return 'بسیار قوی';
  if (num >= 75) return 'قوی';
  if (num >= 60) return 'متوسط';
  if (num >= 40) return 'ضعیف';
  return 'بسیار ضعیف';
}

export function getDirectionLabel(direction) {
  if (!direction) return '';
  const d = direction.toUpperCase();
  if (d === 'BUY' || d === 'LONG') return 'خرید';
  if (d === 'SELL' || d === 'SHORT') return 'فروش';
  return direction;
}
