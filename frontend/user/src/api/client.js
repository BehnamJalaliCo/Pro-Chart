import axios from 'axios';

const TOKEN_KEY = 'cp_user_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
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
      return Promise.reject({ status, message: data?.detail || 'خطایی رخ داد', data });
    }
    return Promise.reject({ status: 0, message: 'ارتباط با سرور برقرار نشد.' });
  }
);

export const userAPI = {
  authConfig: () => client.get('/user/auth/config'),
  loginTelegram: (data) => client.post('/user/auth/telegram', data),
  loginWebApp: (init_data) => client.post('/user/auth/webapp', { init_data }),
  me: () => client.get('/user/me'),
  requestOtp: (email) => client.post('/user/auth/request-otp', { email }),
  verifyOtp: (email, code) => client.post('/user/auth/verify-otp', { email, code }),
  getDisclaimer: () => client.get('/user/disclaimer'),
  acceptDisclaimer: (version, full_name) => client.post('/user/disclaimer/accept', { version, full_name }),
  submitKyc: (payload) => client.post('/user/kyc', payload),
  linkAccount: (payload) => client.post('/user/account/link', payload),
  unlinkAccount: () => client.delete('/user/account'),
  getCopyConfig: () => client.get('/user/copy-config'),
  setCopyConfig: (payload) => client.post('/user/copy-config', payload),
  copyStatus: () => client.get('/user/copy-status'),
  // دستیارِ هوشِ مصنوعی
  aiChat: (message) => client.post('/user/ai/chat', { message }),
  // اعلان‌ها
  notifications: () => client.get('/user/notifications'),
  markNotificationsRead: () => client.post('/user/notifications/read'),
  // کنترلِ آنیِ کپی
  copyStop: () => client.post('/user/copy/stop'),
  copyCloseAll: () => client.post('/user/copy/close-all'),
  // تاریخچه
  history: () => client.get('/user/history'),
  // تاریخچهٔ سود/زیانِ واقعیِ کاربر (دیلِ MT5: کمیسیون/سواپ/خالص)
  tradeHistory: (params) => client.get('/user/trade-history', { params }),
  tradeStats: (days = 30) => client.get('/user/trade-history/stats', { params: { days } }),
  tradeDaily: (days = 30) => client.get('/user/trade-history/daily', { params: { days } }),
  // عملکردِ راهبرد (عمومی)
  perfSummary: () => client.get('/performance/summary'),
  equityCurve: (days = 90) => client.get('/performance/equity-curve', { params: { days } }),
  // اشتراک و تقویم
  subscription: () => client.get('/user/subscription'),
  economicCalendar: () => client.get('/user/economic-calendar'),
};

export default client;
