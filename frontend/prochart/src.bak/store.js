import { create } from 'zustand';
import { tokenStore } from './api/client';

export const useAuth = create((set) => ({
  me: null,           // {tier, completed, total_lessons, progress_pct}
  ready: false,
  setMe: (me) => set({ me }),
  setReady: (ready) => set({ ready }),
  login: (token) => { tokenStore.set(token); },
  logout: () => { tokenStore.clear(); set({ me: null }); location.href = '/login'; },
}));
