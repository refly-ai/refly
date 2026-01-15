import { setupI18n, setupSentry } from '@refly/web-core';
import { useEffect, useState, useRef } from 'react';
import { LightLoading, ReflyConfigProvider, useConfigProviderStore } from '@refly/ui-kit';
import { ConfigProvider, theme } from 'antd';
import { useThemeStoreShallow } from '@refly/stores';
import { setRuntime } from '@refly/utils/env';
import { setupStatsig } from '@refly/telemetry-web';

export interface InitializationSuspenseProps {
  children: React.ReactNode;
}

export function InitializationSuspense({ children }: InitializationSuspenseProps) {
  // Detect if page is being prerendered
  // Skip initialization during prerender, quickly initialize on activation
  const [isInitialized, setIsInitialized] = useState(false);
  const isPrerendering = useRef(
    typeof document !== 'undefined' && 'prerendering' in document && document.prerendering === true,
  );
  const updateTheme = useConfigProviderStore((state) => state.updateTheme);

  const { isDarkMode, initTheme } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    initTheme: state.initTheme,
  }));

  const init = async () => {
    // If prerendering, defer initialization
    if (isPrerendering.current) {
      console.log('[Init] Page is being prerendered, deferring initialization');
      return;
    }

    setRuntime('web');
    initTheme();

    // Initialization for normal load or after prerender activation
    try {
      await setupI18n();
      setIsInitialized(true);
      console.log('[Init] Initialization complete');
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
      // Allow continuation even on failure to avoid permanent loading state
      setIsInitialized(true);
    }

    // non-blocking initialization
    Promise.all([setupSentry(), setupStatsig()]).catch((e) => {
      console.error('Failed to initialize metrics:', e);
    });
  };

  useEffect(() => {
    init();

    // Listen for prerender activation event
    if ('prerendering' in document) {
      const handleActivation = () => {
        console.log('[Init] Page activated from prerender');
        init();
      };
      document.addEventListener('prerenderingchange', handleActivation);
      return () => document.removeEventListener('prerenderingchange', handleActivation);
    }
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
