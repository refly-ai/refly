import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  // 主题模式
  themeMode: ThemeMode;
  // 是否为暗色模式
  isDarkMode: boolean;
  // 是否强制使用亮色模式
  isForcedLightMode: boolean;

  // 设置主题模式
  setThemeMode: (mode: ThemeMode) => void;
  // 设置强制亮色模式状态
  setForcedLightMode: (isForcedLight: boolean) => void;
  // 初始化主题
  initTheme: () => void;
}

// 检测系统是否为暗色模式
const isSystemDarkMode = () => {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches;
};

// 应用暗色模式到文档
const applyDarkMode = (isDark: boolean, isForcedLight: boolean) => {
  if (isDark && !isForcedLight) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeMode: 'system',
      isDarkMode: false,
      isForcedLightMode: false,

      setForcedLightMode: (isForcedLight: boolean) => {
        set({ isForcedLightMode: isForcedLight });

        // Apply dark mode considering forced light mode
        applyDarkMode(get().isDarkMode, isForcedLight);
      },

      setThemeMode: (mode: ThemeMode) => {
        set({ themeMode: mode });

        // 根据模式设置暗色模式状态
        let isDark = false;
        if (mode === 'dark') {
          isDark = true;
        } else if (mode === 'system') {
          isDark = isSystemDarkMode();
        }

        set({ isDarkMode: isDark });
        applyDarkMode(isDark, get().isForcedLightMode);
      },

      initTheme: () => {
        const { themeMode, isForcedLightMode } = get();

        // 根据当前主题模式初始化
        let isDark = false;
        if (themeMode === 'dark') {
          isDark = true;
        } else if (themeMode === 'system') {
          isDark = isSystemDarkMode();

          // 监听系统主题变化
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          const handleChange = (e: MediaQueryListEvent) => {
            if (get().themeMode === 'system') {
              set({ isDarkMode: e.matches });
              applyDarkMode(e.matches, get().isForcedLightMode);
            }
          };

          mediaQuery.addEventListener('change', handleChange);
        }

        set({ isDarkMode: isDark });
        applyDarkMode(isDark, isForcedLightMode);
      },
    }),
    {
      name: 'theme-storage',
      partialize: (state) => ({ themeMode: state.themeMode }),
    },
  ),
);

export const useThemeStoreShallow = <T>(selector: (state: ThemeState) => T) => {
  return useThemeStore(useShallow(selector));
};
