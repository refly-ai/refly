import { PriceContent } from '@refly-packages/ai-workspace-common/components/settings/subscribe-modal/priceContent';
import Header from '@/components/landing-page-partials/Header';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import Footer from '@/components/landing-page-partials/Footer';
import FrequentlyAskedQuestions from '@/components/landing-page-partials/frequently-asked-questions';

const PricingPage = () => {
  const { t } = useTranslation();
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  return (
    <div className="box-border h-[100vh] w-full overflow-y-auto bg-white dark:bg-gray-900 py-20">
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
        <div className="my-10 flex flex-col items-center justify-center gap-5">
          <div className="w-fit bg-gradient-to-r from-green-700 to-green-400 bg-clip-text text-lg font-bold text-transparent">
            {t('landingPage.pricing.title')}
          </div>
          <div className="text-4xl font-bold">{t('landingPage.pricing.subtitle')}</div>
          <div className="text-base text-gray-500">{t('landingPage.pricing.description')}</div>
        </div>
        <PriceContent source="page" />
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
