import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // Theme
      theme: 'dark',
      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        set({ theme: newTheme });
      },
      setTheme: (newTheme) => {
        if (newTheme !== 'dark' && newTheme !== 'light') return;
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        set({ theme: newTheme });
      },

      // Live prices
      prices: {},
      setPrices: (prices) => set({ prices }),
      updatePrice: (symbol, priceData) =>
        set((state) => ({
          prices: {
            ...state.prices,
            [symbol]: {
              ...state.prices[symbol],
              ...priceData,
              previousPrice: state.prices[symbol]?.price || priceData.price,
            },
          },
        })),

      // Active signals
      signals: [],
      setSignals: (signals) => set({ signals }),
      addSignal: (signal) =>
        set((state) => ({
          signals: [signal, ...state.signals],
        })),
      updateSignal: (id, data) =>
        set((state) => ({
          signals: state.signals.map((s) => (s.id === id ? { ...s, ...data } : s)),
        })),

      // Filters
      signalFilters: {
        symbol: '',
        direction: '',
        strength: '',
      },
      setSignalFilters: (filters) =>
        set((state) => ({
          signalFilters: { ...state.signalFilters, ...filters },
        })),
      resetSignalFilters: () =>
        set({
          signalFilters: { symbol: '', direction: '', strength: '' },
        }),

      // Notifications
      notifications: [],
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            { id: Date.now(), ...notification },
            ...state.notifications.slice(0, 9),
          ],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      // Mobile menu
      isMobileMenuOpen: false,
      setMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),
    }),
    {
      name: 'coinepro-storage',
      partialize: (state) => ({
        theme: state.theme,
      }),
    }
  )
);

// Initialize theme on load
const savedTheme = JSON.parse(localStorage.getItem('coinepro-storage') || '{}')?.state?.theme;
if (savedTheme === 'light') {
  document.documentElement.classList.remove('dark');
} else {
  document.documentElement.classList.add('dark');
}
