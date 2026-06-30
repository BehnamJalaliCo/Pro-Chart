import { create } from 'zustand';
import { tokenStore } from './api/client';

export const useAuth = create((set) => ({
  profile: null,
  ready: false,
  setProfile: (profile) => set({ profile }),
  setReady: (ready) => set({ ready }),
  login: (token, profile) => { tokenStore.set(token); set({ profile }); },
  logout: () => { tokenStore.clear(); set({ profile: null }); location.href = '/login'; },
}));

// ── تم (روشن/تاریک) با حفظ در localStorage ──
const THEME_KEY = 'cp_theme';
function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light') root.classList.add('light');
  else root.classList.remove('light');
}
const initialTheme = (() => {
  try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch { return 'dark'; }
})();
applyTheme(initialTheme);

export const useTheme = create((set, get) => ({
  theme: initialTheme,
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch { /* noop */ }
    applyTheme(next);
    set({ theme: next });
  },
}));
