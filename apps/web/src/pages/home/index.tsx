import AOS from 'aos';
import { LoginModal } from '@/components/login-modal';

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
        <title>{t('landingPage.slogan')} · AI Canvas</title>
        <meta name="description" content={t('landingPage.description')} />
        <meta property="og:title" content={`${t('landingPage.slogan')} · AI Canvas`} />
        <meta property="og:description" content={t('landingPage.description')} />
      </Helmet>
      <LoginModal visible={true} />
    </div>
  );
}

export default Home;
