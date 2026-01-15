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
  // 优化：如果页面是从预渲染激活的，直接显示内容，不显示 loading
  // document.prerendering 在预渲染期间为 true，激活后为 false
  const wasPrerendered = useRef(
    typeof document !== 'undefined' && 'prerendering' in document && !document.prerendering,
  );

  // 如果是从预渲染激活的，直接设为已初始化
  const [isInitialized, setIsInitialized] = useState(wasPrerendered.current);
  const updateTheme = useConfigProviderStore((state) => state.updateTheme);

  const { isDarkMode, initTheme } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    initTheme: state.initTheme,
  }));

  const init = async () => {
    setRuntime('web');
    initTheme();

    // 如果是预渲染激活的页面，在后台静默初始化，不阻塞渲染
    if (wasPrerendered.current) {
      console.log('[Init] Page was prerendered, initializing in background');
      // 后台初始化，不阻塞
      Promise.all([setupI18n(), setupSentry(), setupStatsig()]).catch((e) => {
        console.error('Failed to initialize:', e);
      });
      return;
    }

    // 正常首次加载，需要等待 i18n 初始化
    try {
      await setupI18n();
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
      // 即使失败也允许继续，避免永久 loading
      setIsInitialized(true);
    }

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
