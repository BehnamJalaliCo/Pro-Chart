import axios from 'axios';
import { create } from 'zustand';

// ── توکن (SSO میانِ زیردامنه‌های pro-chart.com) ──
const TOKEN_KEY = 'cp_academy_token';
const COOKIE_NAME = 'cp_academy_token';
const COOKIE_DOMAIN = '.pro-chart.com';

function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(token) {
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; domain=${COOKIE_DOMAIN}; path=/; max-age=2592000; secure; samesite=Lax`;
}
function eraseCookie() {
  // پاک‌کردن روی دامنهٔ مشترک و دامنهٔ جاری
  document.cookie = `${COOKIE_NAME}=; domain=${COOKIE_DOMAIN}; path=/; max-age=0; secure; samesite=Lax`;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY) || null,
  set: (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    try { writeCookie(token); } catch { /* noop */ }
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    try { eraseCookie(); } catch { /* noop */ }
  },
  // ورودِ یکپارچه: اگر localStorage توکن ندارد ولی کوکیِ دامنهٔ مشترک دارد، آن را بپذیر
  bootSSO: () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      const c = readCookie(COOKIE_NAME);
      if (c) localStorage.setItem(TOKEN_KEY, c);
    }
    return localStorage.getItem(TOKEN_KEY);
  },
};

// ── نمونهٔ axios ──
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t && !config.headers.Authorization) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

client.interceptors.response.use(
  (r) => r.data,
  (err) => {
    if (err.response) {
      const { status, data } = err.response;
      if (status === 401) {
        tokenStore.clear();
        if (!location.pathname.startsWith('/login')) location.href = '/login';
      }
      // پیامِ خطا را همیشه به رشته تبدیل کن — detailِ ۴۲۲ یک آرایه از آبجکت است و
      // اگر مستقیم در JSX رندر شود React کرش می‌کند (خطای #31).
      const raw = data?.detail ?? data?.message ?? 'خطایی رخ داد.';
      let message = raw;
      if (Array.isArray(raw)) message = raw.map((e) => e?.msg || (typeof e === 'string' ? e : JSON.stringify(e))).join('، ');
      else if (raw && typeof raw === 'object') message = raw.msg || raw.detail || JSON.stringify(raw);
      else message = String(raw);
      return Promise.reject({ status, message, data });
    }
    return Promise.reject({ status: 0, message: 'ارتباط با سرور برقرار نشد.', data: null });
  }
);

// ── احرازِ هویتِ آکادمی (بازارنما) ──
export const authAPI = {
  login: (username, password) => client.post('/academy/auth/login', { username, password }),
  removeDevice: (device_id, manageToken) =>
    client.post('/academy/auth/remove-device', { device_id, manage_token: manageToken }),
  registerRequest: (email) => client.post('/academy/auth/register/request', { email, app: 'bazaarnama' }),
  registerVerify: (payload) => client.post('/academy/auth/register/verify', payload), // {email, code, username, password, full_name, account_type}
  forgot: (email) => client.post('/academy/auth/forgot-password', { email }),
  reset: (payload) => client.post('/academy/auth/reset-password', payload), // {email, code, password}
  me: () => client.get('/academy/me'),
};

// ── دادهٔ واقعیِ کاربر (scope=academy) ──
export const bnUserAPI = {
  // پروفایل و دستگاه‌ها
  me: () => client.get('/academy/me'),
  updateProfile: (payload) => client.post('/academy/profile', payload), // {full_name, phone, country}
  devices: () => client.get('/academy/devices'),
  removeDevice: (id) => client.delete(`/academy/devices/${id}`),

  // اگرگیت و سفارش‌ها
  overview: () => client.get('/academy/bn/overview'),
  myOrders: (params = {}) => client.get('/academy/bn/my-orders', { params }), // {status, limit}

  // قیمت و واچ‌لیست
  prices: (symbols) => client.get('/academy/bn/prices', { params: { symbols: Array.isArray(symbols) ? symbols.join(',') : symbols } }),
  watchlist: () => client.get('/academy/bn/watchlist'),
  setWatchlist: (symbols) => client.put('/academy/bn/watchlist', { symbols }),

  // هشدارها
  alerts: () => client.get('/academy/bn/alerts'),
  createAlert: (payload) => client.post('/academy/bn/alerts', payload), // {symbol, tf, name, condition}
  deleteAlert: (id) => client.delete(`/academy/bn/alerts/${id}`),

  // سیگنالِ هوشِ مصنوعی
  aiQuota: () => client.get('/academy/bn/ai-signal/quota'),
  aiActive: () => client.get('/academy/bn/ai-signal/active'),
  createAiSignal: (payload) => client.post('/academy/bn/ai-signal', payload), // {symbol, tf}
  deleteAiSignal: (id) => client.delete(`/academy/bn/ai-signal/${id}`),

  // اتصالِ صرافی/بروکر
  connectStatus: () => client.get('/academy/bn/connect/status'),
  connectLbank: (payload) => client.post('/academy/bn/connect/lbank', payload), // {api_key, api_secret, uid?}
  disconnectLbank: () => client.delete('/academy/bn/connect/lbank'),

  // معاملهٔ واقعی
  realOrder: (payload) => client.post('/academy/bn/real-order', payload), // {side, symbol, amount, price}

  // قیمت‌گذاریِ اشتراک (دادهٔ واقعیِ بک‌اند)
  // نکته: اینترسپتورِ پاسخ در همین فایل، خروجی را به بدنهٔ پاسخ (r.data) تبدیل می‌کند،
  // پس client.get مستقیماً {currency, network, wallet, tiers:[...]} را برمی‌گرداند.
  pricing: () => client.get('/academy/pricing'),

  // رفرال و پرداخت
  referralLink: () => client.get('/academy/bn/referral-link'),
  submitPayment: (payload) => client.post('/academy/bn/payment/submit', payload), // {tx_hash, plan}

  // اخبار و تقویم
  news: () => client.get('/academy/bn/news'),
  calendar: () => client.get('/academy/bn/calendar'),
};

// ── استورِ احرازِ هویت (سبک) ──
export const useAuth = create((set) => ({
  token: tokenStore.get(),
  isAuthed: !!tokenStore.get(),
  login: (token) => {
    tokenStore.set(token);
    set({ token, isAuthed: true });
  },
  logout: () => {
    tokenStore.clear();
    set({ token: null, isAuthed: false });
    if (!location.pathname.startsWith('/login')) location.href = '/login';
  },
}));

export default client;
