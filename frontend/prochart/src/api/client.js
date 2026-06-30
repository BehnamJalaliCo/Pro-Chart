import axios from 'axios';

const TOKEN_KEY = 'cp_academy_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 95000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const t = tokenStore.get();
  // اگر هدرِ Authorization صریحاً ست شده باشد (مثلاً توکنِ ادمین) آن را بازنویسی نکن
  if (t && !config.headers.Authorization) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export const adminToken = {
  get: () => localStorage.getItem('bn_admin_token'),
  set: (t) => localStorage.setItem('bn_admin_token', t),
  clear: () => localStorage.removeItem('bn_admin_token'),
};
const _ah = () => ({ Authorization: `Bearer ${adminToken.get() || ''}` });

client.interceptors.response.use(
  (r) => r.data,
  (err) => {
    if (err.response) {
      const { status, data } = err.response;
      if (status === 401) {
        // مستقل از آکادمی: توکنِ منقضی را پاک و صفحه را reload کن تا App یک مهمانِ نو بگیرد
        tokenStore.clear();
        location.reload();
      }
      // ۴۰۳ پرمیوم: قابلیتِ ویژه برای کاربرِ free → مودالِ ارتقاء را باز کن
      const det = data?.detail;
      if (status === 403 && det && typeof det === 'object' && det.premium_required) {
        try { window.dispatchEvent(new CustomEvent('bn:premium', { detail: det.msg || '' })); } catch (e) { /* noop */ }
        return Promise.reject({ status, message: det.msg || 'قابلیتِ پرمیوم', premium: true, data });
      }
      return Promise.reject({ status, message: (typeof det === 'string' ? det : det?.msg) || 'خطایی رخ داد', data });
    }
    return Promise.reject({ status: 0, message: 'ارتباط با سرور برقرار نشد.' });
  }
);

// شناسهٔ پایدارِ دستگاه (برای سقفِ ۲ دستگاه) — در همین مرورگر ثابت می‌ماند
function deviceId() {
  let id = localStorage.getItem('cp_academy_device');
  if (!id) {
    const seed = [navigator.userAgent, screen.width + 'x' + screen.height, navigator.language, Math.random().toString(36).slice(2)].join('|');
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    id = 'd' + h.toString(36) + Date.now().toString(36).slice(-4);
    localStorage.setItem('cp_academy_device', id);
  }
  return id;
}
function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'دستگاه';
  const br = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari' : 'مرورگر';
  return `${br} روی ${os}`;
}

export const api = {
  // احراز (نام‌کاربری/رمزِ مستقل — ادمین می‌سازد) — با شناسهٔ دستگاه (سقفِ ۲ دستگاه)
  login: (username, password) => client.post('/academy/auth/login', { username, password, device_id: deviceId(), device_name: deviceName() }),
  removeDevicePre: (manage_token, device_id) => client.post('/academy/auth/remove-device', { manage_token, device_id }),
  devices: () => client.get('/academy/devices'),
  removeDevice: (id) => client.delete(`/academy/devices/${id}`),
  updateProfile: (d) => client.post('/academy/profile', d),
  registerRequest: (email) => client.post('/academy/auth/register/request', { email, app: 'bazaarnama' }),
  registerVerify: (email, code, username, password, full_name, account_type) =>
    client.post('/academy/auth/register/verify', { email, code, username, password, full_name, account_type }),
  // آکادمی
  pricing: () => client.get('/academy/pricing'),
  me: () => client.get('/academy/me'),
  catalog: () => client.get('/academy/catalog'),
  lesson: (slug) => client.get(`/academy/lesson/${slug}`),
  setProgress: (slug, quiz_score) => client.post(`/academy/progress/${slug}`, { quiz_score }),
  lessonQuiz: (slug) => client.get(`/academy/lesson/${slug}/quiz`),
  submitQuiz: (slug, answers) => client.post(`/academy/lesson/${slug}/quiz/submit`, { answers }),
  search: (q) => client.get('/academy/search', { params: { q } }),
  searchGlobal: (q) => client.get('/academy/search/global?q=' + encodeURIComponent(q)),
  searchSuggest: (prefix) => client.get('/academy/search/suggestions?prefix=' + encodeURIComponent(prefix)),
  glossary: () => client.get('/academy/glossary'),
  cheatsheet: (level) => client.get(`/academy/cheatsheet/${level}`),
  // ژورنال
  journal: () => client.get('/academy/journal'),
  journalStats: () => client.get('/academy/journal/stats'),
  journalAdd: (data) => client.post('/academy/journal', data), // data می‌تواند شاملِ tags (آرایه) و screenshot_url باشد
  journalDelete: (id) => client.delete(`/academy/journal/${id}`),
  journalAiReview: (jid) => client.post(`/academy/journal/${jid}/ai-review`),
  // جامعه
  community: (page = 1, category = '') => client.get('/academy/community', { params: { page, category } }),
  communityPost: (content, category) => client.post('/academy/community', { content, category }),
  communityDetail: (id) => client.get(`/academy/community/${id}`),
  communityReply: (id, content, parent_id) => client.post(`/academy/community/${id}/reply`, { content, parent_id }),
  communityLike: (id) => client.post(`/academy/community/${id}/like`),
  communityReport: (id) => client.post(`/academy/community/${id}/report`),
  reactPost: (pid, emoji) => client.post(`/academy/community/${pid}/react`, { emoji }),
  searchCommunity: (q) => client.get('/academy/community/search?q=' + encodeURIComponent(q)),
  bestReply: (pid, rid) => client.post(`/academy/community/${pid}/best-reply/${rid}`),
  backtest: () => client.get('/academy/backtest'),
  chartSymbols: () => client.get('/academy/chart/symbols'),
  chart: (symbol, tf, indicators, limit, before) => client.get(`/academy/chart/${symbol}`, { params: { tf, indicators: indicators || undefined, limit: limit || undefined, before: before || undefined } }),
  chartRange: (symbol, tf) => client.get(`/academy/chart/${symbol}/range`, { params: { tf } }),
  chartAnalyze: (symbol, tf) => client.post('/academy/chart/analyze', { symbol, tf }),
  // میزِکارِ ترمینال (نماد/تایم‌فریم/اندیکاتورها/رسم‌ها) — برای بازیابیِ خودکار در LiveChart
  getWorkspace: () => client.get('/academy/terminal/workspace'),
  saveWorkspace: (layout) => client.put('/academy/terminal/workspace', { layout }),
  // بازارنما (TradingView ایرانی)
  bnLayouts: () => client.get('/academy/bn/layouts'),
  bnLayoutGet: (id) => client.get(`/academy/bn/layouts/${id}`),
  bnLayoutSave: (d) => client.post('/academy/bn/layouts', d),
  bnLayoutDelete: (id) => client.delete(`/academy/bn/layouts/${id}`),
  bnScripts: () => client.get('/academy/bn/scripts'),
  bnScriptGet: (id) => client.get(`/academy/bn/scripts/${id}`),
  bnScriptSave: (d) => client.post('/academy/bn/scripts', d),
  bnScriptDelete: (id) => client.delete(`/academy/bn/scripts/${id}`),
  bnWatchlist: () => client.get('/academy/bn/watchlist'),
  bnWatchlistSet: (symbols) => client.put('/academy/bn/watchlist', { symbols }),
  // trade-from-chart — اعتبارسنجی/پیش‌نمایش؛ اجرای زنده فقط برای مالک با کلید (localStorage.bn_owner_key)
  manualOrder: (o) => {
    let k = '';
    try { k = localStorage.getItem('bn_owner_key') || ''; } catch (e) { /* noop */ }
    return client.post('/academy/bn/manual-order', o, k ? { headers: { 'X-BN-Owner-Key': k } } : undefined);
  },
  bnPrices: (symbols) => client.get('/academy/bn/prices', { params: { symbols } }),
  bnReferralLink: () => client.get('/academy/bn/referral-link'),
  bnPaymentSubmit: (tx_hash, plan) => client.post('/academy/bn/payment/submit', { tx_hash, plan }),
  bnConnectStatus: () => client.get('/academy/bn/connect/status'),
  bnConnectLbank: (api_key, api_secret, uid) => client.post('/academy/bn/connect/lbank', { api_key, api_secret, uid }),
  bnConnectMt5: (login, password, server) => client.post('/academy/bn/connect/mt5', { login, password, server }),
  bnConnectRemove: (kind) => client.delete(`/academy/bn/connect/${kind}`),
  bnRealOrder: (side, symbol, amount, price) => client.post('/academy/bn/real-order', { side, symbol, amount, price: price || 0 }),
  bnNews: () => client.get('/academy/bn/news'),
  bnCalendar: () => client.get('/academy/bn/calendar'),
  bnAiSignal: (symbol, tf) => client.post('/academy/bn/ai-signal', { symbol, tf }),
  bnAiQuota: () => client.get('/academy/bn/ai-signal/quota'),
  bnAiActive: () => client.get('/academy/bn/ai-signal/active'),
  bnAiDelete: (id) => client.delete(`/academy/bn/ai-signal/${id}`),
  // ── ادمینِ بازارنما (توکنِ جدا) ──
  bnAdminLogin: (password) => client.post('/academy/bn/admin/login', { password }),
  bnAdminUsers: (q) => client.get('/academy/bn/admin/users', { params: { q: q || undefined }, headers: _ah() }),
  bnAdminSetTier: (student_id, tier, days) => client.post('/academy/bn/admin/set-tier', { student_id, tier, days }, { headers: _ah() }),
  bnAdminSetStatus: (student_id, status) => client.post('/academy/bn/admin/set-status', { student_id, status }, { headers: _ah() }),
  bnAdminOrders: (status, market) => client.get('/academy/bn/admin/orders', { params: { status: status || undefined, market: market || undefined }, headers: _ah() }),
  bnAdminSetReferral: (student_id, kind, verified) => client.post('/academy/bn/admin/set-referral', { student_id, kind: kind || 'lbank', verified }, { headers: _ah() }),
  bnAlerts: () => client.get('/academy/bn/alerts'),
  bnAlertCreate: (d) => client.post('/academy/bn/alerts', d),
  bnAlertDelete: (id) => client.delete(`/academy/bn/alerts/${id}`),
  practiceRecord: (d) => client.post('/academy/practice/record', d),
  practiceStats: () => client.get('/academy/practice/stats'),
  practiceFeedback: (d) => client.post('/academy/practice/feedback', d),
  paperOpen: (d) => client.post('/academy/paper/open', d),
  paperPositions: () => client.get('/academy/paper/positions'),
  paperClose: (id) => client.post(`/academy/paper/close/${id}`),
  paperClosePartial: (pid, fraction) => client.post(`/academy/paper/close-partial/${pid}`, { fraction }),
  paperCalcSize: (symbol, entry, sl, risk_usd) => client.post('/academy/paper/calc-size', { symbol, entry, sl, risk_usd }),
  paperAccount: () => client.get('/academy/paper/account'),
  mentorCoach: () => client.post('/academy/mentor/coach'),
  coachDashboard: () => client.get('/academy/coach/dashboard'),
  assessment: () => client.get('/academy/assessment'),
  assessmentSubmit: (answers) => client.post('/academy/assessment/submit', { answers }),
  strategyBacktest: (d) => client.post('/academy/strategy/backtest', d),
  saveStrategy: (d) => client.post('/academy/strategy/save', d),
  savedStrategies: () => client.get('/academy/strategy/saved'),
  deleteStrategy: (id) => client.delete(`/academy/strategy/saved/${id}`),
  optimizeStrategy: (d) => client.post('/academy/strategy/optimize', d),
  walkForward: (d) => client.post('/academy/strategy/walkforward', d),
  algoCode: (d) => client.post('/academy/algo/code', d),
  algoSignal: (d) => client.post('/academy/algo/signal', d),
  fundedStatus: (tier) => client.get('/academy/funded/status', tier ? { params: { tier } } : undefined),
  claimFunded: (tier) => client.post('/academy/funded/certificate', { tier }),
  bootcamps: () => client.get('/academy/bootcamps'),
  bootcampEnroll: (bootcamp_id) => client.post('/academy/bootcamp/enroll', { bootcamp_id }),
  bootcampMy: () => client.get('/academy/bootcamp/my'),
  bootcampLeaderboard: () => client.get('/academy/bootcamp/leaderboard'),
  bootcampToday: () => client.get('/academy/bootcamp/today'),
  claimCert: (level) => client.post(`/academy/certificate/claim/${level}`),
  verifyCert: (code) => client.get(`/academy/public/verify/${code}`),
  portfolio: (username) => client.get(`/academy/public/portfolio/${username}`),
  toolsOverview: () => client.get('/academy/tools/overview'),
  toolsCorrelations: () => client.get('/academy/tools/correlations'),
  // ماشین‌حساب‌های حرفه‌ای
  toolPositionSize: ({ account, risk_pct, entry, sl, symbol }) =>
    client.get('/academy/tools/position-size', { params: { account, risk_pct, entry, sl, symbol } }),
  toolPip: ({ symbol, pips, size }) =>
    client.get('/academy/tools/pip-calc', { params: { symbol, pips, size } }),
  toolRR: ({ entry, sl, tp }) =>
    client.get('/academy/tools/rr', { params: { entry, sl, tp } }),
  toolSessions: () => client.get('/academy/tools/sessions'),
  // اشتراک
  subscribe: (tier, tx_hash, months) => client.post('/academy/subscribe', { tier, tx_hash, months }),
  subscribe: (tier, tx_hash, months) => client.post('/academy/subscribe', { tier, tx_hash, months }),
  // مربیِ AI
  mentorAsk: (question, lang, thread_id) => client.post('/academy/mentor/ask', { question, lang, thread_id }),
  mentorThreads: () => client.get('/academy/mentor/threads'),
  mentorThread: (id) => client.get(`/academy/mentor/thread/${id}`),
  // برنامهٔ مطالعهٔ هوشمند
  genStudyPlan: (goal, days) => client.post('/academy/mentor/study-plan', { goal, days }),
  getStudyPlan: () => client.get('/academy/mentor/study-plan'),
  toggleStudyDay: (idx) => client.post(`/academy/mentor/study-plan/day/${idx}/toggle`),
  deleteStudyPlan: () => client.delete('/academy/mentor/study-plan'),
  // گیمیفیکیشن و تعامل
  roadmap: (level) => client.get(`/academy/lessons/${level}/roadmap`),
  skillTree: () => client.get('/academy/lessons/skilltree'),
  streak: () => client.get('/academy/streak'),
  achievements: () => client.get('/academy/achievements'),
  leaderboard: () => client.get('/academy/leaderboard'),
  lessonRating: (slug) => client.get(`/academy/lesson/${slug}/rating`),
  rateLesson: (slug, stars, review) => client.post(`/academy/lesson/${slug}/rate`, { stars, review }),
  lessonComments: (slug) => client.get(`/academy/lesson/${slug}/comments`),
  addLessonComment: (slug, content) => client.post(`/academy/lesson/${slug}/comment`, { content }),
  lessonNote: (slug) => client.get(`/academy/lesson/${slug}/note`),
  saveLessonNote: (slug, content) => client.put(`/academy/lesson/${slug}/note`, { content }),
};
