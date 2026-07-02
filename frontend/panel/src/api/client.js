import axios from 'axios';
import { useAuthStore } from '../store';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

client.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;

      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = response.data;
        useAuthStore.getState().setTokens(access_token, refresh_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        processQueue(null, access_token);

        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;

// پاسخِ کامل → فقط data
const _d = (p) => p.then((r) => r.data);

// ── احراز هویت (ورود از طریق admins-table اصلی) ──
export const authAPI = {
  login: (credentials) => client.post('/auth/login', credentials),
  logout: () => client.post('/auth/logout'),
  me: () => client.get('/auth/me'),
};

// ── آنالیتیکس (endpoint موجود) ──
export const analyticsAPI = {
  getOverview: (days = 7) => client.get('/admin/analytics/overview', { params: { days } }),
  getLive: (params) => client.get('/admin/analytics/live', { params }),
  getOnline: () => client.get('/admin/analytics/online'),
};

// ── پیام‌رسانی (روترِ کاملِ /broadcasts) ──
export const broadcastsAPI = {
  getAll: (params) => client.get('/broadcasts', { params }),
  create: (data) => client.post('/broadcasts', data),
  send: (id) => client.post(`/broadcasts/${id}/send`),
  status: (id) => client.get(`/broadcasts/${id}/status`),
  overview: () => client.get('/broadcasts/stats'),
};

// ── آکادمی (endpoint موجود) ──
export const academyAPI = {
  stats: () => _d(client.get('/admin/academy/stats')),
  listStudents: (params) => _d(client.get('/admin/academy/students', { params })),
  createStudent: (data) => _d(client.post('/admin/academy/students', data)),
  getStudent: (id) => _d(client.get(`/admin/academy/students/${id}`)),
  updateStudent: (id, data) => _d(client.patch(`/admin/academy/students/${id}`, data)),
  resetPassword: (id, password) => _d(client.post(`/admin/academy/students/${id}/reset-password`, { password })),
  extendStudent: (id, days) => _d(client.post(`/admin/academy/students/${id}/extend`, { days })),
  deleteStudent: (id) => _d(client.delete(`/admin/academy/students/${id}`)),
  listLessons: (level) => _d(client.get('/admin/academy/lessons', { params: level ? { level } : {} })),
  updateLesson: (id, data) => _d(client.patch(`/admin/academy/lessons/${id}`, data)),
  // پرداخت‌ها
  listPayments: (status = 'pending') => _d(client.get('/admin/academy/payments', { params: { status } })),
  approvePayment: (id, months) => _d(client.post(`/admin/academy/payments/${id}/approve`, { months })),
  rejectPayment: (id) => _d(client.post(`/admin/academy/payments/${id}/reject`)),
  // انجمن
  communityPosts: (status = 'pending') => _d(client.get('/admin/academy/community', { params: { status } })),
  approvePost: (id) => _d(client.post(`/admin/academy/community/${id}/approve`)),
  deletePost: (id) => _d(client.delete(`/admin/academy/community/${id}`)),
};

// ── اشتراک‌ها (endpoint موجود) ──
export const subscriptionsAPI = {
  getStats: () => client.get('/admin/subscriptions/stats'),
  getAll: (params) => client.get('/admin/subscriptions', { params }),
  getById: (id) => client.get('/admin/subscriptions/' + id),
  extend: (id, days) => client.post('/admin/subscriptions/' + id + '/extend', { days }),
};

// ── پرداخت‌ها (endpoint موجود) ──
export const paymentsAPI = {
  getAll: (params) => client.get('/admin/payments', { params }),
  getById: (id) => client.get('/admin/payments/' + id),
  approve: (id, note) => client.post('/admin/payments/' + id + '/approve', { note }),
  reject: (id, note) => client.post('/admin/payments/' + id + '/reject', { note }),
};

// ─────────────────────────────────────────────────────────────
// BazaarNama (بازارنما) — پنلِ اختصاصی زیرِ prefix /admin/bn
// همهٔ متدها فقط data را برمی‌گردانند و empty-safe هستند.
// ─────────────────────────────────────────────────────────────
export const bnAPI = {
  // ── CORE ──
  getStats: () => _d(client.get('/admin/bn/stats')),
  getSignups: (days = 30) => _d(client.get('/admin/bn/signups', { params: { days } })),

  getUsers: (params) => _d(client.get('/admin/bn/users', { params })),
  getUser: (id) => _d(client.get('/admin/bn/users/' + id)),
  createUser: (data) => _d(client.post('/admin/bn/users', data)),
  setTier: (id, tier, days) => _d(client.post('/admin/bn/users/' + id + '/tier', { tier, days })),
  setStatus: (id, status) => _d(client.post('/admin/bn/users/' + id + '/status', { status })),
  extendUser: (id, days) => _d(client.post('/admin/bn/users/' + id + '/extend', { days })),
  resetPassword: (id, password) => _d(client.post('/admin/bn/users/' + id + '/reset-password', { password })),
  updateUser: (id, data) => _d(client.patch('/admin/bn/users/' + id, data)),

  getChartsOverview: () => _d(client.get('/admin/bn/charts-overview')),

  getAds: () => _d(client.get('/admin/bn/ads')),
  setAd: (data) => _d(client.post('/admin/bn/ads', data)),

  getNews: () => _d(client.get('/admin/bn/news')),
  getCalendar: () => _d(client.get('/admin/bn/calendar')),

  getAudit: (limit = 100) => _d(client.get('/admin/bn/audit', { params: { limit } })),

  // ── TRADING ──
  getOrders: (params) => _d(client.get('/admin/bn/orders', { params })),
  cancelOrder: (id) => _d(client.post('/admin/bn/orders/' + id + '/cancel')),

  getExchangeAccounts: (q) => _d(client.get('/admin/bn/exchange-accounts', { params: q ? { q } : {} })),
  setExchangeReferral: (id, verified) => _d(client.post('/admin/bn/exchange-accounts/' + id + '/referral', { verified })),
  setExchangeStatus: (id, status) => _d(client.post('/admin/bn/exchange-accounts/' + id + '/status', { status })),

  getAiSignals: (params) => _d(client.get('/admin/bn/ai-signals', { params })),
  getAiSignalsStats: () => _d(client.get('/admin/bn/ai-signals/stats')),
  deleteAiSignal: (id) => _d(client.delete('/admin/bn/ai-signals/' + id)),

  // ── USERS (bulk / delete) ──
  deleteUser: (id) => client.delete('/admin/bn/users/' + id).then((r) => r.data),
  bulkUsers: (action, ids, opts = {}) =>
    client.post('/admin/bn/users/bulk', { action, ids, ...opts }).then((r) => r.data),

  // ── SERVER / MARKET ──
  getServerMetrics: () => client.get('/admin/bn/server-metrics').then((r) => r.data),
  getMarket: () => client.get('/admin/bn/market').then((r) => r.data),
  getMarketSpark: (symbol, n = 40) =>
    client.get('/admin/bn/market/' + symbol + '/spark', { params: { n } }).then((r) => r.data),
};
