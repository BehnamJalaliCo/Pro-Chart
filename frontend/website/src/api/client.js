import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor — توکنِ VIPِ وب‌سایت (ورود با تلگرام)
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('vip_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        localStorage.removeItem('vip_token');
      }
      return Promise.reject({
        status,
        message: data?.detail || 'خطایی در سرور رخ داده است',
      });
    }
    if (error.request) {
      return Promise.reject({
        status: 0,
        message: 'ارتباط با سرور برقرار نشد. اتصال اینترنت خود را بررسی کنید.',
      });
    }
    return Promise.reject({
      status: -1,
      message: 'خطای ناشناخته رخ داده است',
    });
  }
);

// API endpoints
// سیگنال‌ها از روترِ عمومیِ واقعیِ پروژه خوانده می‌شوند (بدون auth، دادهٔ واقعی)
export const signalsAPI = {
  getActive: (params) => apiClient.get('/public/signals/active', { params }),
  getRecent: (params) => apiClient.get('/public/signals/recent', { params }),
  getHistory: (params) => apiClient.get('/public/signals/recent', { params }),
  getById: (id) => apiClient.get(`/signals/${id}`),
  getStats: () => apiClient.get('/public/signals/stats'),
};

// ── احرازِ VIPِ وب‌سایت (ورود با تلگرام) + بک‌تست ──
export const vipAuthAPI = {
  getConfig: () => apiClient.get('/public/auth/config'),
  loginTelegram: (data) => apiClient.post('/public/auth/telegram', data),
};

export const backtestAPI = {
  simulate: (data) => apiClient.post('/public/backtest/simulate', data),
};

// مدیریتِ نشستِ VIP در مرورگر
export const vipSession = {
  get: () => {
    try { return JSON.parse(localStorage.getItem('vip_user') || 'null'); }
    catch { return null; }
  },
  save: (res) => {
    if (res?.token) localStorage.setItem('vip_token', res.token);
    localStorage.setItem('vip_user', JSON.stringify({
      name: res?.name || '', is_vip: !!res?.is_vip, telegram_id: res?.telegram_id || null,
    }));
  },
  clear: () => {
    localStorage.removeItem('vip_token');
    localStorage.removeItem('vip_user');
  },
  isVip: () => {
    try { return !!JSON.parse(localStorage.getItem('vip_user') || 'null')?.is_vip; }
    catch { return false; }
  },
};

export const pricesAPI = {
  getLive: () => apiClient.get('/public/prices/live'),
  getHistory: (symbol, timeframe) =>
    apiClient.get(`/prices/history/${symbol}`, { params: { timeframe } }),
  getSymbols: () => apiClient.get('/prices/symbols'),
};

export const performanceAPI = {
  getSummary: () => apiClient.get('/performance/summary'),
  getEquityCurve: (params) => apiClient.get('/performance/equity-curve', { params }),
  getMonthly: () => apiClient.get('/performance/monthly'),
  getBySymbol: () => apiClient.get('/performance/by-symbol'),
  getDrawdown: () => apiClient.get('/performance/drawdown'),
};

// آموزش = همان ۱۲۰ درسِ آکادمیِ ربات (مدلِ Article)
export const educationAPI = {
  getArticles: (params) => apiClient.get('/articles', { params }),
  getArticle: (slug) => apiClient.get(`/articles/${slug}`),
  getCategories: () => apiClient.get('/articles/categories'),
};

// تبدیلِ مسیرِ سرورِ تصویرِ درس (/app/edu_assets/x.png) به URLِ قابل‌بارگذاری در مرورگر
export const eduAssetUrl = (coverImage) => {
  if (!coverImage) return null;
  if (/^https?:\/\//i.test(coverImage)) return coverImage;
  const name = String(coverImage).split('/').pop();
  return name ? `/api/public/edu-asset/${name}` : null;
};

export const contactAPI = {
  submit: (data) => apiClient.post('/contact', data),
};

// لایو ترید — پیکربندی پخش + ورود تلگرام
export const liveAPI = {
  getConfig: () => apiClient.get('/live/config'),
  authTelegram: (data) => apiClient.post('/live/auth/telegram', data),
};

// WebSocket connection for live prices
export const createPriceSocket = (onMessage, onError) => {
  // پروتکلِ امن: روی صفحهٔ HTTPS باید wss باشد وگرنه مرورگر SecurityError می‌دهد و صفحه کرش می‌کند.
  const proto = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss' : 'ws';
  const wsUrl = import.meta.env.VITE_WS_URL || `${proto}://${window.location.host}/ws/prices`;
  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch (err) {
    // هرگز نگذار ساختِ WebSocket صفحه را کرش کند (مثلاً mixed-content)
    console.error('WebSocket init failed:', err);
    if (onError) onError(err);
    return { close: () => {} };
  }

  ws.onopen = () => { /* connected */ };
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };
  ws.onerror = (error) => { if (onError) onError(error); };
  ws.onclose = () => {
    setTimeout(() => { try { createPriceSocket(onMessage, onError); } catch { /* noop */ } }, 5000);
  };
  return ws;
};

export default apiClient;
