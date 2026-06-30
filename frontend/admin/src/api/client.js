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

export const authAPI = {
  login: (credentials) => client.post('/auth/login', credentials),
  logout: () => client.post('/auth/logout'),
  me: () => client.get('/auth/me'),
};

export const dashboardAPI = {
  getStats: () => client.get('/admin/dashboard/stats'),
  getSignalChart: (days = 30) => client.get(`/admin/dashboard/signal-chart?days=${days}`),
  getUserGrowth: (days = 30) => client.get(`/admin/dashboard/user-growth?days=${days}`),
  getServiceStatus: () => client.get('/admin/dashboard/services'),
  getActiveSignals: () => client.get('/admin/dashboard/active-signals'),
};

export const signalsAPI = {
  getAll: (params) => client.get('/admin/signals', { params }),
  getById: (id) => client.get(`/admin/signals/${id}`),
  create: (data) => client.post('/admin/signals', data),
  close: (id, data) => client.post(`/admin/signals/${id}/close`, data),
  delete: (id) => client.delete(`/admin/signals/${id}`),
};

export const usersAPI = {
  getAll: (params) => client.get('/admin/users', { params }),
  getStats: () => client.get('/admin/users/stats'),
  getById: (id) => client.get(`/admin/users/${id}`),
  ban: (id, reason) => client.post(`/admin/users/${id}/ban`, { reason }),
  unban: (id) => client.post(`/admin/users/${id}/unban`),
  updatePlan: (id, plan) => client.patch(`/admin/users/${id}/plan`, { plan }),
  updateStatus: (id, status) => client.patch(`/admin/users/${id}/status`, { status }),
  grant: (id, days, plan) => client.post(`/admin/users/${id}/grant`, { days, plan }),
  sendMessage: (id, message) => client.post(`/admin/users/${id}/message`, { message }),
  // خروجیِ کاملِ کاربران برای پرینت/اکسلِ پشتیبانی
  exportRoster: (params) => client.get('/admin/users/export', { params }),
  // اعطای دسترسیِ رایگانِ کانالِ سیگنال برای N روز + اعلان به کاربر
  grantSignalAccess: (id, days, message) => client.post(`/admin/users/${id}/grant-signal-access`, { days, message }),
};

export const performanceAPI = {
  getEquityCurve: (params) => client.get('/admin/performance/equity-curve', { params }),
  getWinRate: (params) => client.get('/admin/performance/win-rate', { params }),
  getHeatmap: () => client.get('/admin/performance/heatmap'),
  getMetrics: () => client.get('/admin/performance/metrics'),
};

export const mlAPI = {
  getModels: () => client.get('/admin/ml/models'),
  retrain: (modelId) => client.post(`/admin/ml/models/${modelId}/retrain`),
  getFeatureImportance: (modelId) => client.get(`/admin/ml/models/${modelId}/features`),
  getEnsembleWeights: () => client.get('/admin/ml/ensemble-weights'),
  updateEnsembleWeights: (weights) => client.put('/admin/ml/ensemble-weights', { weights }),
};

export const monitoringAPI = {
  getSystemMetrics: () => client.get('/admin/monitoring/system'),
  getContainers: () => client.get('/admin/monitoring/containers'),
  getDataFeeds: () => client.get('/admin/monitoring/data-feeds'),
  getLogs: (params) => client.get('/admin/monitoring/logs', { params }),
};

export const analyticsAPI = {
  getOverview: (days = 7) => client.get('/admin/analytics/overview', { params: { days } }),
  getLive: (params) => client.get('/admin/analytics/live', { params }),
  getOnline: () => client.get('/admin/analytics/online'),
};

export const seoAPI = {
  overview: () => client.get('/admin/seo/overview'),
  actions: (params) => client.get('/admin/seo/actions', { params }),
  resolve: (id) => client.post(`/admin/seo/actions/${id}/resolve`),
  dismiss: (id) => client.post(`/admin/seo/actions/${id}/dismiss`),
  runNow: () => client.post('/admin/seo/run-now'),
  runPagespeed: () => client.post('/admin/seo/pagespeed/run-now'),
  // PageSpeed managed URLs
  listUrls: () => client.get('/admin/seo/pagespeed/urls'),
  addUrl: (data) => client.post('/admin/seo/pagespeed/urls', data),
  toggleUrl: (id, data) => client.patch(`/admin/seo/pagespeed/urls/${id}`, data),
  deleteUrl: (id) => client.delete(`/admin/seo/pagespeed/urls/${id}`),
  testUrl: (url) => client.post('/admin/seo/pagespeed/test', { url }),
  history: (url, strategy = 'mobile') => client.get('/admin/seo/pagespeed/history', { params: { url, strategy } }),
  // Search Console tables
  queries: () => client.get('/admin/seo/queries'),
  pages: () => client.get('/admin/seo/pages'),
};

export const tradeHistoryAPI = {
  list: (params) => client.get('/admin/trade-history', { params }),
  daily: (params) => client.get('/admin/trade-history/daily', { params }),
  stats: (params) => client.get('/admin/trade-history/stats', { params }),
  clear: (params) => client.delete('/admin/trade-history', { params }),
  exportUrl: (uid = 0) => `${API_BASE}/admin/trade-history/export?uid=${uid}`,
};

export const articlesAPI = {
  getAll: (params) => client.get('/admin/articles', { params }),
  getById: (id) => client.get(`/admin/articles/${id}`),
  create: (data) => client.post('/admin/articles', data),
  update: (id, data) => client.put(`/admin/articles/${id}`, data),
  delete: (id) => client.delete(`/admin/articles/${id}`),
};

export const broadcastsAPI = {
  // روترِ کاملِ /broadcasts (stats/send/status/create) — نه panel.py ناقص
  getAll: (params) => client.get('/broadcasts', { params }),
  create: (data) => client.post('/broadcasts', data),
  send: (id) => client.post(`/broadcasts/${id}/send`),
  status: (id) => client.get(`/broadcasts/${id}/status`),
  overview: () => client.get('/broadcasts/stats'),
};

export const settingsAPI = {
  getAll: () => client.get('/admin/settings'),
  update: (data) => client.put('/admin/settings', data),
  getApiKeys: () => client.get('/admin/settings/api-keys'),
  updateApiKey: (key, data) => client.put(`/admin/settings/api-keys/${key}`, data),
};

export const backtestAPI = {
  listRuns: (params) => client.get('/backtest/runs', { params }),
  getRun: (id, params) => client.get(`/backtest/runs/${id}`, { params }),
  getTrades: (id, params) => client.get(`/backtest/runs/${id}/trades`, { params }),
  triggerRun: (data) => client.post('/backtest/runs', data),
  deleteRun: (id) => client.delete(`/backtest/runs/${id}`),
};

export const riskAPI = {
  getDailyStatus: () => client.get('/admin/risk/daily'),
  getRejections: (params) => client.get('/admin/risk/rejections', { params }),
  getPositions: () => client.get('/admin/risk/positions'),
  getRegimes: () => client.get('/admin/risk/regimes'),
  unlock: () => client.post('/admin/risk/unlock'),
  manualLock: (reason) => client.post('/admin/risk/lock', { reason }),
};

export const reportsAPI = {
  getAdvancedMetrics: (params) => client.get('/admin/reports/advanced-metrics', { params }),
  getMonthlyHeatmap: (params) => client.get('/admin/reports/monthly-heatmap', { params }),
  getRollingCagr: (params) => client.get('/admin/reports/rolling-cagr', { params }),
  getRollingSharpe: (params) => client.get('/admin/reports/rolling-sharpe', { params }),
  getDrawdownPeriods: (params) => client.get('/admin/reports/drawdown-periods', { params }),
  benchmarkCompare: (data) => client.post('/admin/reports/benchmark-compare', data),
};

// ── اتو-ترید (تنظیماتِ EA) ──
export const eaAPI = {
  getConfig: () => client.get('/admin/ea-config'),
  setConfig: (data) => client.post('/admin/ea-config', data),
  getStatus: () => client.get('/admin/ea-status'),
  closeAll: () => client.post('/admin/ea-close-all'),
  getAccount: () => client.get('/admin/ea-account'),
  setAccount: (data) => client.post('/admin/ea-account', data),
  logoutAccount: () => client.post('/admin/ea-account/logout'),
};

// ── کاربرانِ پنلِ کاربری (تأیید/حذف + رصد) ──
export const panelUsersAPI = {
  list: (q) => client.get('/admin/panel-users', { params: q ? { q } : {} }),
  detail: (tid) => client.get(`/admin/panel-users/${tid}`),
  approve: (tid) => client.post(`/admin/panel-users/${tid}/approve`),
  reject: (tid) => client.post(`/admin/panel-users/${tid}/reject`),
  remove: (tid) => client.post(`/admin/panel-users/${tid}/remove`),
  extend: (tid, days) => client.post(`/admin/panel-users/${tid}/extend`, { days }),
  message: (tid, text) => client.post(`/admin/panel-users/${tid}/message`, { text }),
  copyToggle: (tid, enabled) => client.post(`/admin/panel-users/${tid}/copy`, { enabled }),
  stop: (tid) => client.post(`/admin/panel-users/${tid}/stop`),
  closeAll: (tid) => client.post(`/admin/panel-users/${tid}/close-all`),
  kyc: (tid, approve) => client.post(`/admin/panel-users/${tid}/kyc`, { approve }),
};

// ── لایو ترید — کنترل پخش و مدیریت چت ──
export const liveAPI = {
  getState: () => client.get('/live/admin/state'),
  publishInfo: () => client.get('/live/admin/publish-info'),
  start: (data) => client.post('/live/admin/start', data),
  stop: () => client.post('/live/admin/stop'),
  setMode: (mode) => client.post('/live/admin/mode', { mode }),
  toggleChat: () => client.post('/live/admin/chat-toggle'),
  setSlowmode: (seconds) => client.post('/live/admin/slowmode', { seconds }),
  pin: (text) => client.post('/live/admin/pin', { text }),
  setTitle: (title) => client.post('/live/admin/title', { title }),
  ban: (telegram_id) => client.post('/live/admin/ban', { telegram_id }),
  unban: (telegram_id) => client.post('/live/admin/unban', { telegram_id }),
  mute: (telegram_id) => client.post('/live/admin/mute', { telegram_id }),
  unmute: (telegram_id) => client.post('/live/admin/unmute', { telegram_id }),
  deleteMessage: (id) => client.delete(`/live/admin/message/${id}`),
  clear: () => client.post('/live/admin/clear'),
};

// ── آکادمی VIP — مدیریتِ دانش‌آموزان و دروس ──
const _d = (p) => p.then((r) => r.data); // پاسخِ کامل → فقط data

// مدیریتِ کاربرانِ پنلِ مستقلِ اینستاگرام (IG Users)
export const igUsersAPI = {
  list: () => _d(client.get('/admin/ig-users')),
  overview: () => _d(client.get('/admin/ig-users/overview')),
  permsSchema: () => _d(client.get('/admin/ig-users/permissions-schema')),
  get: (id) => _d(client.get(`/admin/ig-users/${id}`)),
  activity: (id) => _d(client.get(`/admin/ig-users/${id}/activity`)),
  revealPassword: (id) => _d(client.get(`/admin/ig-users/${id}/password`)),
  setPermissions: (id, permissions) => _d(client.put(`/admin/ig-users/${id}/permissions`, { permissions })),
  create: (data) => _d(client.post('/admin/ig-users', data)),
  update: (id, data) => _d(client.put(`/admin/ig-users/${id}`, data)),
  remove: (id) => _d(client.delete(`/admin/ig-users/${id}`)),
};

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

// ماژولِ مستقلِ اینستاگرام (هیچ ربطی به آکادمی ندارد)
export const instagramAPI = {
  dashboard: () => _d(client.get('/admin/instagram/dashboard')),
  accounts: () => _d(client.get('/admin/instagram/accounts')),
  syncAccounts: () => _d(client.post('/admin/instagram/accounts/sync')),
  accountLive: (id) => _d(client.get(`/admin/instagram/accounts/${id}/live`)),
  smartToggle: (id) => _d(client.post(`/admin/instagram/accounts/${id}/smart-toggle`)),
  accountMedia: (id, amount = 12) => _d(client.get(`/admin/instagram/accounts/${id}/media`, { params: { amount } })),
  // پیام‌های قابلِ‌استفادهٔ مجدد
  messages: (aid) => _d(client.get(`/admin/instagram/accounts/${aid}/messages`)),
  createMessage: (data) => _d(client.post('/admin/instagram/messages', data)),
  updateMessage: (id, data) => _d(client.put(`/admin/instagram/messages/${id}`, data)),
  deleteMessage: (id) => _d(client.delete(`/admin/instagram/messages/${id}`)),
  // پاسخِ خودکار
  rules: (aid) => _d(client.get(`/admin/instagram/accounts/${aid}/auto-replies`)),
  createRule: (data) => _d(client.post('/admin/instagram/auto-replies', data)),
  updateRule: (id, data) => _d(client.put(`/admin/instagram/auto-replies/${id}`, data)),
  toggleRule: (id) => _d(client.post(`/admin/instagram/auto-replies/${id}/toggle`)),
  deleteRule: (id) => _d(client.delete(`/admin/instagram/auto-replies/${id}`)),
  pollNow: () => _d(client.post('/admin/instagram/poll-now')),
  // فرم‌ساز
  forms: (aid) => _d(client.get(`/admin/instagram/accounts/${aid}/forms`)),
  createForm: (data) => _d(client.post('/admin/instagram/forms', data)),
  updateForm: (id, data) => _d(client.put(`/admin/instagram/forms/${id}`, data)),
  toggleForm: (id) => _d(client.post(`/admin/instagram/forms/${id}/toggle`)),
  deleteForm: (id) => _d(client.delete(`/admin/instagram/forms/${id}`)),
  // صندوق
  inbox: (aid, kind) => _d(client.get(`/admin/instagram/accounts/${aid}/inbox`, { params: { kind } })),
  // نرخِ ارسال + صف
  settings: () => _d(client.get('/admin/instagram/settings')),
  setRateCap: (rate_cap) => _d(client.post('/admin/instagram/settings', { rate_cap })),
  // انتشارِ محتوا (فاز ۴)
  contents: (status) => _d(client.get('/admin/instagram/contents', { params: status ? { status } : {} })),
  createContent: (data) => _d(client.post('/admin/instagram/contents', data)),
  publishContent: (id) => _d(client.post(`/admin/instagram/contents/${id}/publish`)),
  deleteContent: (id) => _d(client.delete(`/admin/instagram/contents/${id}`)),
  aiCaption: (prompt) => _d(client.post('/admin/instagram/ai/caption', { prompt })),
  aiCover: (title, subtitle) => _d(client.post('/admin/instagram/ai/cover', { title, subtitle })),
  uploadMedia: (formData) => _d(client.post('/admin/instagram/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })),
  // سازندهٔ کاور
  coverFonts: () => _d(client.get('/admin/instagram/cover/fonts')),
  coverSearch: (query) => _d(client.post('/admin/instagram/cover/search', { query })),
  coverRender: (opts) => _d(client.post('/admin/instagram/cover/render', opts)),
  // هوشِ مصنوعیِ محتوا + خلبانِ خودکار
  aiFullContent: (topic, post_type) => _d(client.post('/admin/instagram/ai/full-content', { topic, post_type })),
  aiSuggestTopics: (count, context) => _d(client.post('/admin/instagram/ai/suggest-topics', { count, context })),
  autopilots: () => _d(client.get('/admin/instagram/autopilots')),
  createAutopilot: (data) => _d(client.post('/admin/instagram/autopilots', data)),
  updateAutopilot: (id, data) => _d(client.put(`/admin/instagram/autopilots/${id}`, data)),
  toggleAutopilot: (id) => _d(client.post(`/admin/instagram/autopilots/${id}/toggle`)),
  runAutopilotNow: (id) => _d(client.post(`/admin/instagram/autopilots/${id}/run-now`)),
  deleteAutopilot: (id) => _d(client.delete(`/admin/instagram/autopilots/${id}`)),
};
