import { create } from 'zustand';
import { tokenStore } from './api/client';

export const useAuth = create((set) => ({
  me: null,
  ready: false,
  account: null,            // اکانتِ فعالِ انتخاب‌شده (object)
  setMe: (me) => set({ me }),
  setReady: (ready) => set({ ready }),
  setAccount: (account) => set({ account }),
  login: (token, refresh) => { tokenStore.set(token); if (refresh) tokenStore.setRefresh(refresh); },
  logout: () => { tokenStore.clear(); set({ me: null, account: null }); location.href = '/login'; },
}));
