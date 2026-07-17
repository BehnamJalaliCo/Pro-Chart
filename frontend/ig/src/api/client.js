import axios from 'axios';

const TOKEN_KEY = 'cp_ig_token';
const REFRESH_KEY = 'cp_ig_refresh';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setRefresh: (t) => localStorage.setItem(REFRESH_KEY, t),
  clear: () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_KEY); },
};

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
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

export const api = {
  // auth
  login: (username, password) => client.post('/ig/auth/login', { username, password }),
  me: () => client.get('/ig/me'),
  // accounts
  accounts: () => client.get('/ig/accounts'),
  addAccount: (d) => client.post('/ig/accounts', d),
  removeAccount: (id) => client.delete(`/ig/accounts/${id}`),
  smartToggle: (id) => client.post(`/ig/accounts/${id}/smart-toggle`),
  accountLive: (id) => client.get(`/ig/accounts/${id}/live`),
  accountMedia: (id, amount = 12, refresh = false) => client.get(`/ig/accounts/${id}/media`, { params: { amount, refresh } }),
  // dashboard
  dashboard: () => client.get('/ig/dashboard'),
  // messages
  messages: (aid) => client.get(`/ig/accounts/${aid}/messages`),
  createMessage: (d) => client.post('/ig/messages', d),
  updateMessage: (id, d) => client.put(`/ig/messages/${id}`, d),
  deleteMessage: (id) => client.delete(`/ig/messages/${id}`),
  // auto-replies
  rules: (aid) => client.get(`/ig/accounts/${aid}/auto-replies`),
  createRule: (d) => client.post('/ig/auto-replies', d),
  updateRule: (id, d) => client.put(`/ig/auto-replies/${id}`, d),
  toggleRule: (id) => client.post(`/ig/auto-replies/${id}/toggle`),
  deleteRule: (id) => client.delete(`/ig/auto-replies/${id}`),
  // inbox
  inbox: (aid, kind = 'comment', limit = 50) => client.get(`/ig/accounts/${aid}/inbox`, { params: { kind, limit } }),
  // forms
  forms: (aid) => client.get(`/ig/accounts/${aid}/forms`),
  createForm: (d) => client.post('/ig/forms', d),
  updateForm: (id, d) => client.put(`/ig/forms/${id}`, d),
  toggleForm: (id) => client.post(`/ig/forms/${id}/toggle`),
  deleteForm: (id) => client.delete(`/ig/forms/${id}`),
  // content
  contents: (status) => client.get('/ig/contents', { params: status ? { status } : {} }),
  createContent: (d) => client.post('/ig/contents', d),
  updateContent: (id, d) => client.put(`/ig/contents/${id}`, d),
  publishContent: (id) => client.post(`/ig/contents/${id}/publish`),
  generateVideo: (id) => client.post(`/ig/contents/${id}/generate-video`),
  deleteContent: (id) => client.delete(`/ig/contents/${id}`),
  upload: (file) => { const fd = new FormData(); fd.append('file', file); return client.post('/ig/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); },
  // ai + cover
  aiCaption: (prompt) => client.post('/ig/ai/caption', { prompt }),
  aiFull: (topic, post_type) => client.post('/ig/ai/full-content', { topic, post_type }),
  suggestTopics: (count) => client.post('/ig/ai/suggest-topics', { count }),
  coverFonts: () => client.get('/ig/cover/fonts'),
  coverSearch: (query) => client.post('/ig/cover/search', { query }),
  coverRender: (spec) => client.post('/ig/cover/render', spec),
  // autopilot
  autopilots: () => client.get('/ig/autopilots'),
  createAutopilot: (d) => client.post('/ig/autopilots', d),
  updateAutopilot: (id, d) => client.put(`/ig/autopilots/${id}`, d),
  toggleAutopilot: (id) => client.post(`/ig/autopilots/${id}/toggle`),
  runAutopilot: (id) => client.post(`/ig/autopilots/${id}/run-now`),
  deleteAutopilot: (id) => client.delete(`/ig/autopilots/${id}`),
};
