import { useCallback } from 'react';
import { useAppStore } from '../store';

/**
 * useTheme - هوک مدیریت تم (روشن/تاریک)
 *
 * از Zustand store استفاده می‌کند و تم در localStorage ذخیره می‌شود.
 * کلاس 'dark' روی document.documentElement اعمال می‌شود.
 *
 * @returns {Object} {
 *   theme: 'dark' | 'light',
 *   isDark: boolean,
 *   isLight: boolean,
 *   toggleTheme: () => void,
 *   setTheme: (theme: 'dark' | 'light') => void,
 * }
 *
 * @example
 * const { theme, isDark, toggleTheme } = useTheme();
 *
 * return (
 *   <button onClick={toggleTheme}>
 *     {isDark ? 'تم روشن' : 'تم تاریک'}
 *   </button>
 * );
 */
export default function useTheme() {
  const theme = useAppStore((state) => state.theme);
  const storeToggleTheme = useAppStore((state) => state.toggleTheme);
  const storeSetTheme = useAppStore((state) => state.setTheme);

  const isDark = theme === 'dark';
  const isLight = theme === 'light';

  /**
   * تغییر تم بین روشن و تاریک
   */
  const toggleTheme = useCallback(() => {
    storeToggleTheme();
  }, [storeToggleTheme]);

  /**
   * تنظیم تم مشخص (store خودش کلاس و localStorage را مدیریت می‌کند)
   * @param {'dark'|'light'} newTheme
   */
  const setTheme = useCallback(
    (newTheme) => {
      storeSetTheme(newTheme);
    },
    [storeSetTheme]
  );

  return {
    theme,
    isDark,
    isLight,
    toggleTheme,
    setTheme,
  };
}
