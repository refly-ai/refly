import Header from '@/components/landing-page-partials/Header';
import HeroHome from '@/components/landing-page-partials/HeroHome';
import WorkflowBlocks from '@/components/landing-page-partials/workflow-blocks';
import FeatureBlocks from '@/components/landing-page-partials/feature-blocks';
import Testimonials from '@/components/landing-page-partials/Testimonials';
import Footer from '@/components/landing-page-partials/Footer';
import AOS from 'aos';

import 'aos/dist/aos.css';
import './index.scss';
import { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';

function Home() {
  const { t } = useTranslation();
  useEffect(() => {
    AOS.init({
      once: true,
      disable: 'phone',
      duration: 600,
      easing: 'ease-out-sine',
    });
  }, []);

  useEffect(() => {
    document.querySelector('html')!.style.scrollBehavior = 'auto';
    window.scroll({ top: 0 });
    document.querySelector('html')!.style.scrollBehavior = '';
  }, [location.pathname]); // triggered on route change

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[#FFFFFF]">
      <Helmet>
        <title>{t('landingPage.slogan')} · Refly</title>
        <meta name="description" content={t('landingPage.description')} />
      </Helmet>

      {/*  Site header */}
      <Header />

      {/*  Page content */}
      <main className="grow">
        <HeroHome />
        <FeatureBlocks />
        <WorkflowBlocks />
        <Testimonials />
      </main>

      {/*  Site footer */}
      <Footer />
    </div>
  );
}

export default Home;
