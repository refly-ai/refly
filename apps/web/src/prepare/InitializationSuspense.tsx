import { setupI18n, setupSentry } from '@refly/web-core';
import { useEffect, useState } from 'react';
import { LightLoading, ReflyConfigProvider, useConfigProviderStore } from '@refly/ui-kit';
import { ConfigProvider, theme } from 'antd';
import { useThemeStoreShallow } from '@refly/stores';
import { setRuntime } from '@refly/utils/env';
import { setupStatsig } from '@refly/telemetry-web';

export interface InitializationSuspenseProps {
  children: React.ReactNode;
}

export function InitializationSuspense({ children }: InitializationSuspenseProps) {
  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false);
  const updateTheme = useConfigProviderStore((state) => state.updateTheme);

  const { isDarkMode, initTheme } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    initTheme: state.initTheme,
  }));

  const init = async () => {
    // Initialize runtime and theme regardless of prerendering state
    setRuntime('web');
    initTheme();

    // Initialization for normal load or prerender
    try {
      await setupI18n();
      setIsInitialized(true);

      // Hide loading - safe to call during prerendering
      (window as any).__REFLY_HIDE_LOADING__?.();
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
      // Allow continuation even on failure to avoid permanent loading state
      setIsInitialized(true);
    }

    // Non-blocking initialization - can run during prerendering
    // These services should handle prerendering internally if needed
    Promise.all([setupSentry(), setupStatsig()]).catch((e) => {
      console.error('Failed to initialize metrics:', e);
    });
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    const themeConfig = {
      token: {
        // Modal specific tokens
        colorBgMask: 'var(--refly-modal-mask)',
        boxShadow: '0 8px 32px 0 #00000014',
        ...(isDarkMode
          ? {
              controlItemBgActive: 'rgba(255, 255, 255, 0.08)',
              controlItemBgActiveHover: 'rgba(255, 255, 255, 0.12)',
            }
          : {
              controlItemBgActive: '#f1f1f0',
              controlItemBgActiveHover: '#e0e0e0',
            }),
      },
      algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
    };
    updateTheme(themeConfig);

    ConfigProvider.config({
      holderRender: (children) => <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>,
    });
  }, [isDarkMode]);

  return <ReflyConfigProvider>{isInitialized ? children : <LightLoading />}</ReflyConfigProvider>;
}
