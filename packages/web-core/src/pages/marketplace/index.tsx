import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { logEvent } from '@refly/telemetry-web';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { getEnv, IENV } from '@refly/utils';
import { useThemeStoreShallow } from '@refly/stores';
import { MarketplaceErrorBoundary } from './error-boundary';

const MarketplacePageContent = memo(() => {
  const { t, i18n } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { isDarkMode, themeMode } = useThemeStoreShallow((state) => ({
    isDarkMode: state.isDarkMode,
    themeMode: state.themeMode,
  }));

  // Get current language
  const currentLanguage = i18n.languages?.[0] || i18n.language || 'en';

  useEffect(() => {
    logEvent('enter_marketplace');
  }, []);

  // Initialize iframe URL only once to avoid reloads on theme/language changes
  const [iframeSrc] = useState(() => {
    const isDevelopment = getEnv() === IENV.DEVELOPMENT;
    const baseUrl = isDevelopment
      ? 'http://localhost:3000/workflow-marketplace'
      : `${window.location.origin}/workflow-marketplace`;

    const url = new URL(baseUrl);
    // Indicate embedded mode (hide standalone page elements)
    url.searchParams.set('embedded', 'true');
    // Initial theme and language (subsequent changes sent via postMessage)
    url.searchParams.set('theme', isDarkMode ? 'dark' : 'light');
    url.searchParams.set('themeMode', themeMode);
    url.searchParams.set('lang', currentLanguage);

    return url.toString();
  });

  // Get target origin for postMessage
  const targetOrigin = useMemo(() => {
    const isDevelopment = getEnv() === IENV.DEVELOPMENT;
    return isDevelopment ? 'http://localhost:3000' : window.location.origin;
  }, []);

  // Send theme and language updates via postMessage when they change
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const sendUpdate = () => {
      iframe.contentWindow?.postMessage(
        {
          type: 'theme-update',
          theme: isDarkMode ? 'dark' : 'light',
          themeMode: themeMode,
          language: currentLanguage,
        },
        targetOrigin,
      );
    };

    // Wait for iframe to load
    if (iframe.contentDocument?.readyState === 'complete') {
      sendUpdate();
    } else {
      iframe.addEventListener('load', sendUpdate, { once: true });
    }

    // Also send update when theme or language changes
    sendUpdate();

    return () => {
      iframe.removeEventListener('load', sendUpdate);
    };
  }, [isDarkMode, themeMode, currentLanguage, targetOrigin]);

  return (
    <>
      <Helmet>
        <title>{t('loggedHomePage.siderMenu.marketplace')}</title>
      </Helmet>
      <div className="w-full h-full flex flex-col overflow-hidden">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="w-full h-full border-0 flex-1"
          title={t('loggedHomePage.siderMenu.marketplace')}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </>
  );
});

MarketplacePageContent.displayName = 'MarketplacePageContent';

const MarketplacePage = () => {
  return (
    <MarketplaceErrorBoundary>
      <MarketplacePageContent />
    </MarketplaceErrorBoundary>
  );
};

MarketplacePage.displayName = 'MarketplacePage';

export default MarketplacePage;
