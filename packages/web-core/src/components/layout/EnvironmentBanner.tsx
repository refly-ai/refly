import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { envTag } from '@refly/ui-kit';
import { Button } from 'antd';

/**
 * Environment banner component that displays for test and staging environments
 */
const EnvironmentBannerComponent = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only show banner for test and staging environments
    if (!envTag || (envTag !== 'test' && envTag !== 'staging')) {
      setIsVisible(false);
      return;
    }

    // Banner is visible by default for test and staging environments
    setIsVisible(true);
  }, []);

  // Set CSS variables based on banner visibility and measured height
  useEffect(() => {
    const root = document?.documentElement;
    if (!root) {
      return;
    }

    if (isVisible && bannerRef.current) {
      // Measure actual banner height
      const bannerHeight = bannerRef.current.offsetHeight;
      root.style.setProperty('--banner-height', `${bannerHeight}px`);
      root.style.setProperty('--screen-height', `calc(100vh - ${bannerHeight}px)`);
    } else {
      root.style.setProperty('--banner-height', '0px');
      root.style.setProperty('--screen-height', '100vh');
    }
  }, [isVisible]);

  useEffect(() => {
    if (envTag !== 'test') {
      return;
    }

    // Find existing favicon link or create new one
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;

    if (link) {
      // Update existing favicon
      link.href = '/logo-test.svg';
      link.type = 'image/svg+xml';
    } else {
      // Create new favicon link if none exists
      link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      link.href = '/logo-test.svg';
      const head = document.getElementsByTagName('head')[0];
      if (head) {
        head.appendChild(link);
      }
    }
  }, []);

  const hideBanner = useCallback(() => {
    setIsVisible(false);
  }, []);

  if (!isVisible) {
    return null;
  }

  const isTest = envTag === 'test';
  const bannerColor = isTest ? 'bg-orange-400' : 'bg-yellow-400';
  const bannerText = t(`environmentBanner.${isTest ? 'test' : 'staging'}`);

  return (
    <div
      ref={bannerRef}
      className={`fixed top-0 left-0 right-0 z-50 ${bannerColor} text-black font-semibold text-center py-2 text-sm flex items-center justify-center relative`}
    >
      <span>{bannerText}</span>
      <Button
        type="text"
        onClick={hideBanner}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-black hover:bg-black/10 rounded-full border-none p-1 transition-colors flex items-center hover:cursor-pointer"
        aria-label="Close banner"
        icon={
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        }
      />
    </div>
  );
};

export const EnvironmentBanner = memo(EnvironmentBannerComponent);
