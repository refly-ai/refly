import { useEffect } from 'react';
import { PricingModal } from '@refly-packages/ai-workspace-common/components/settings/subscribe-modal/pricing-modal';
import Header from '../../components/landing-page-partials/Header';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly/stores';
import Footer from '../../components/landing-page-partials/Footer';
import FrequentlyAskedQuestions from '../../components/landing-page-partials/frequently-asked-questions';
import { logEvent } from '@refly/telemetry-web';

const PricingPage = () => {
  const { t } = useTranslation();
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  useEffect(() => {
    logEvent('enter_pricing_page');
  }, []);

  return (
    <div className="box-border w-full h-[var(--screen-height)] bg-white dark:bg-gray-900 py-20">
      {!isLogin && (
        <>
          <Helmet>
            <title>{t('landingPage.slogan')} · Refly</title>
            <meta name="description" content={t('landingPage.description')} />
          </Helmet>

          <Header />
        </>
      )}
      <div className="my-10 bg-white/95 dark:bg-gray-900/95">
        <PricingModal mode="page" />
      </div>
      {!isLogin && (
        <>
          <FrequentlyAskedQuestions />
          <Footer />
        </>
      )}
    </div>
  );
};

export default PricingPage;
