import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  // Theme mode
  themeMode: ThemeMode;
  // Whether it's dark mode
  isDarkMode: boolean;
  // Whether user is logged in
  isLoggedIn: boolean;

  // Set theme mode
  setThemeMode: (mode: ThemeMode) => void;
  // Initialize theme
  initTheme: () => void;
  // Set login status
  setLoggedIn: (status: boolean) => void;
}

// Check if system is in dark mode
const isSystemDarkMode = () => {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
};

// Apply dark mode to document
const applyDarkMode = (isDark: boolean) => {
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Track last init time to prevent excessive calls
let lastInitTime = 0;
const INIT_DEBOUNCE_MS = 100; // Only allow initTheme once per 100ms

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'system',
      isDarkMode: false,
      isLoggedIn: false,

      setThemeMode: (mode: ThemeMode) => {
        set({ themeMode: mode });

        // Set dark mode status based on mode
        let isDark = false;
        if (mode === 'dark') {
          isDark = true;
        } else if (mode === 'system') {
          isDark = isSystemDarkMode();
        }

        set({ isDarkMode: isDark });
        applyDarkMode(isDark);
      },

      setLoggedIn: (status: boolean) => {
        const currentStatus = get().isLoggedIn;
        // Only update and re-initialize if status actually changed
        if (currentStatus !== status) {
          set({ isLoggedIn: status });
          // Re-initialize theme when login status changes
          setTimeout(() => get().initTheme(), 0);
        }
      },

      initTheme: () => {
        // Debounce to prevent excessive calls
        const now = Date.now();
        if (now - lastInitTime < INIT_DEBOUNCE_MS) {
          return;
        }
        lastInitTime = now;

        const { themeMode, isLoggedIn } = get();

        // If not logged in, default to light mode
        if (!isLoggedIn) {
          set({ themeMode: 'light', isDarkMode: false });
          applyDarkMode(false);
          return;
        }

        // If logged in, follow stored theme settings

        // Initialize based on current theme mode
        let isDark = false;
        if (themeMode === 'dark') {
          isDark = true;
        } else if (themeMode === 'system') {
          isDark = isSystemDarkMode();

          // Listen for system theme changes
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleChange = (e: MediaQueryListEvent) => {
            if (get().themeMode === 'system') {
              set({ isDarkMode: e.matches });
              applyDarkMode(e.matches);
            }
          };

          mediaQuery.addEventListener('change', handleChange);
        }

        set({ isDarkMode: isDark });
        applyDarkMode(isDark);
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({
        themeMode: state.themeMode,
        isLoggedIn: state.isLoggedIn,
      }),
    },
  ),
);

export const useThemeStoreShallow = <T>(selector: (state: ThemeState) => T) => {
  return useThemeStore(useShallow(selector));
};
