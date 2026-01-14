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
  const [isInitialized, setIsInitialized] = useState(false);
  const updateTheme = useConfigProviderStore((state) => state.updateTheme);

  const { isDarkMode, initTheme } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    initTheme: state.initTheme,
  }));

  const init = async () => {
    setRuntime('web');
    initTheme();

    // support multiple initialization
    await setupI18n();
    setIsInitialized(true);

    // non-blocking initialization
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
