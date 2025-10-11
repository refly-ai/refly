import { memo, useCallback, useEffect } from 'react';
import { useFrontPageStoreShallow } from '@refly/stores';
import { useAuthStoreShallow } from '@refly/stores';
import Header from '../../components/landing-page-partials/Header';
import { useSearchParams } from 'react-router-dom';
import HeroTitle from '../../components/landing-page-partials/HeroTitle';
import VideoPlaceholder from '../../components/landing-page-partials/VideoPlaceholder';
import CTAButton from '../../components/landing-page-partials/CTAButton';
import FeaturesSection from '../../components/landing-page-partials/FeaturesSection';

const UnsignedFrontPage = memo(() => {
  const [searchParams] = useSearchParams();

  const { reset } = useFrontPageStoreShallow((state) => ({
    reset: state.reset,
  }));

  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const handleLogin = useCallback(() => {
    setLoginModalOpen(true);
  }, [setLoginModalOpen]);

  // Check for autoLogin parameter and auto-open login modal
  useEffect(() => {
    const autoLogin = searchParams.get('autoLogin');
    if (autoLogin === 'true') {
      setLoginModalOpen(true);
    }
  }, [searchParams, setLoginModalOpen]);

  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <div
      className="relative overflow-y-auto"
      style={{
        background:
          'linear-gradient(124deg,rgba(31,201,150,0.1) 0%,rgba(69,190,255,0.06) 24.85%),var(--refly-bg-body-z0)',
      }}
    >
      <Header />

      {/* Hero title section following Figma design */}
      <div className="w-full flex justify-center">
        <HeroTitle />
      </div>

      {/* Video placeholder section following Figma design */}
      <div className="w-full flex flex-col items-center gap-8 px-4">
        <VideoPlaceholder />
        <CTAButton onClick={handleLogin} />
      </div>

      {/* Features section following Figma design */}
      <FeaturesSection />
    </div>
  );
});

UnsignedFrontPage.displayName = 'UnsignedFrontPage';

export default UnsignedFrontPage;
