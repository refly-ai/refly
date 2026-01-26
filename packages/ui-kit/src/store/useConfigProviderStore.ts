import { type ThemeConfig, theme } from 'antd';
import { create } from 'zustand';
import { deepmerge } from '@refly/utils';

interface ConfigProviderState {
  theme: ThemeConfig;
  updateTheme: (config: Partial<ThemeConfig>) => void;
}

export const useConfigProviderStore = create<ConfigProviderState>((set) => ({
  theme: {
    cssVar: {
      key: 'refly',
    },
    token: {
      colorPrimary: '#0E9F77',
      borderRadius: 8,
      controlItemBgActive: 'var(--refly-tertiary-hover)',
      controlItemBgActiveHover: 'var(--refly-tertiary-hover)',
      // Modal specific tokens
      colorBgMask: 'var(--refly-modal-mask)',
      boxShadow: '0 8px 32px 0 #00000014',
      // Input focus styles - remove outline and box-shadow
      controlOutline: 'none',
      controlOutlineWidth: 0,
      controlBoxShadow: 'none',
    },
    algorithm: theme.defaultAlgorithm,
  },
  updateTheme: (config) =>
    set((state) => ({
      theme: deepmerge(state.theme, config),
    })),
}));
