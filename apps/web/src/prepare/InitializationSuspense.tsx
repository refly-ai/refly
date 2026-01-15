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
  // 检测页面是否正在被预渲染
  // 正在预渲染时跳过初始化，激活时快速初始化
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
    // 如果正在预渲染，暂停初始化
    if (isPrerendering.current) {
      console.log('[Init] Page is being prerendered, deferring initialization');
      return;
    }

    setRuntime('web');
    initTheme();

    // 正常加载或预渲染激活后的初始化
    try {
      await setupI18n();
      setIsInitialized(true);
      console.log('[Init] Initialization complete');
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

    // 监听预渲染激活事件
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
