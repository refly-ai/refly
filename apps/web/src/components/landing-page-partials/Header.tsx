import Logo from '@/assets/logo.svg';
import { Button, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStoreShallow } from '@refly-packages/ai-workspace-common/stores/auth';
import { useState, useEffect, useMemo } from 'react';
import {
  useNavigate,
  useLocation,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';
import './header.scss';
import { FaDiscord, FaGithub, FaCaretDown } from 'react-icons/fa6';
import { FaWeixin } from 'react-icons/fa';
import { EXTENSION_DOWNLOAD_LINK } from '@refly/utils/url';
import {
  IconChrome,
  IconDown,
  IconLanguage,
  MemoizedIcon,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { UILocaleList } from '@refly-packages/ai-workspace-common/components/ui-locale-list';

function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const [value, setValue] = useState('product');
  const [starCount, setStarCount] = useState('913');

  const feedbackItems = useMemo(
    () => [
      {
        key: 'discord',
        label: (
          <div className="flex items-center gap-2">
            <FaDiscord />
            <span>{t('landingPage.tab.discord')}</span>
          </div>
        ),
        onClick: () => window.open('https://discord.gg/bWjffrb89h', '_blank'),
      },
      {
        key: 'wechat',
        label: (
          <div className="flex items-center gap-2">
            <FaWeixin />
            <span>{t('landingPage.tab.wechat')}</span>
          </div>
        ),
        onClick: () => window.open('https://docs.refly.ai/images/wechat-qrcode.webp', '_blank'),
      },
    ],
    [t],
  );

  // const galleryItems = useMemo(
  //   () => [
  //     {
  //       key: 'use-cases',
  //       label: (
  //         <div className="flex items-center gap-2">
  //           <span>{t('landingPage.tab.useCases')}</span>
  //         </div>
  //       ),
  //       onClick: () => navigate('/use-cases-gallery'),
  //     },
  //     {
  //       key: 'artifacts',
  //       label: (
  //         <div className="flex items-center gap-2">
  //           <span>{t('landingPage.tab.artifacts')}</span>
  //         </div>
  //       ),
  //       onClick: () => navigate('/artifact-gallery'),
  //     },
  //   ],
  //   [t, navigate],
  // );

  const docsItems = useMemo(
    () => [
      {
        key: 'docs',
        label: (
          <div className="flex items-center gap-2">
            <span>{t('landingPage.tab.docs')}</span>
          </div>
        ),
        onClick: () => window.open('https://docs.refly.ai', '_blank'),
      },
      {
        key: 'video-tutorials',
        label: (
          <div className="flex items-center gap-2">
            <span>{t('landingPage.tab.videoTutorials') || 'Video Tutorials'}</span>
          </div>
        ),
        onClick: () => window.open('https://docs.refly.ai/guide/video-tutorials', '_blank'),
      },
    ],
    [t],
  );

  const tabOptions = [
    {
      label: t('landingPage.tab.product'),
      value: 'product',
    },
    {
      label: t('landingPage.tab.price'),
      value: 'pricing',
    },
    {
      label: (
        <Dropdown menu={{ items: docsItems }} placement="bottom">
          <div className="flex cursor-pointer items-center gap-1">
            <span>{t('landingPage.tab.docs')}</span>
            <FaCaretDown className="text-xs" />
          </div>
        </Dropdown>
      ),
      value: 'docs',
    },
    // {
    //   label: (
    //     <Dropdown menu={{ items: galleryItems }} placement="bottom">
    //       <div className="flex cursor-pointer items-center gap-1">
    //         <span>{t('landingPage.tab.gallery')}</span>
    //         <FaCaretDown className="text-xs" />
    //       </div>
    //     </Dropdown>
    //   ),
    //   value: 'gallery',
    // },
    {
      label: (
        <Dropdown menu={{ items: feedbackItems }} placement="bottom">
          <div className="flex cursor-pointer items-center gap-1">
            <span>{t('landingPage.tab.community')}</span>
            <FaCaretDown className="text-xs" />
          </div>
        </Dropdown>
      ),
      value: 'community',
    },
  ];

  useEffect(() => {
    setValue(location.pathname.split('/')[1] || 'product');
  }, [location.pathname]);

  useEffect(() => {
    // Fetch GitHub star count
    fetch('https://api.github.com/repos/refly-ai/refly')
      .then((res) => res.json())
      .then((data) => {
        const stars = data.stargazers_count;
        setStarCount(stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars.toString());
      })
      .catch(() => {
        // Keep default value if fetch fails
      });
  }, []);

  // Add effect to check for openLogin parameter
  useEffect(() => {
    const shouldOpenLogin = searchParams.get('openLogin');
    if (shouldOpenLogin) {
      setLoginModalOpen(true);
      // Remove the openLogin parameter from URL
      searchParams.delete('openLogin');
      navigate({ search: searchParams.toString() });
    }
  }, [searchParams, setLoginModalOpen, navigate]);

  return (
    <div className="fixed top-0 z-20 flex w-full !justify-center px-4 backdrop-blur-lg sm:px-6 md:px-6 lg:px-8">
      <div className="relative flex w-full max-w-[1280px] items-center justify-between py-4 header-container">
        <div className="mr-4 flex shrink-0 flex-row items-center" style={{ height: 45 }}>
          <div
            className="flex h-full cursor-pointer flex-row items-center"
            onClick={() => navigate('/')}
          >
            <img src={Logo} className="w-[35px]" alt="Refly Logo" />
            <span className="ml-2 text-base font-bold">Refly</span>
          </div>
          <div className="ml-4 flex flex-row items-center">
            {tabOptions.map((item) => (
              <Button
                type="text"
                key={item.value}
                className={`${value === item.value ? 'font-bold text-[#00968f]' : ''}`}
                onClick={() => {
                  if (['community', 'docs', 'gallery'].includes(item.value)) return;
                  switch (item.value) {
                    case 'product':
                      navigate('/');
                      break;
                    case 'pricing':
                      navigate('/pricing');
                      break;
                  }
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <UILocaleList>
            <Button
              type="text"
              size="middle"
              className="px-2 text-gray-600 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-300 "
            >
              <IconLanguage className="h-4 w-4" />
              {t('language')}{' '}
              <IconDown className="ml-1 transition-transform duration-200 group-hover:rotate-180" />
            </Button>
          </UILocaleList>

          <Button
            type="text"
            size="middle"
            onClick={() => window.open('https://github.com/refly-ai/refly', '_blank')}
            className="flex items-center gap-1 px-4 text-gray-600 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-300"
          >
            <FaGithub className="h-4 w-4 mr-1" />
            <span>{starCount}</span>
          </Button>

          <Button
            onClick={() => {
              window.open(EXTENSION_DOWNLOAD_LINK, '_blank');
            }}
            icon={<MemoizedIcon icon={IconChrome} />}
          >
            {t('landingPage.addToChrome')}
          </Button>
          <Button type="primary" onClick={() => setLoginModalOpen(true)}>
            {t('landingPage.tryForFree')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Header;
