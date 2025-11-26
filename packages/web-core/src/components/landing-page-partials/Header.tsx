import { Button, Dropdown } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStoreShallow } from '@refly/stores';
import { useState, useEffect, useMemo } from 'react';
import {
  useNavigate,
  useLocation,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';
import './header.scss';
import { FaDiscord, FaCaretDown } from 'react-icons/fa6';
import { FaWeixin } from 'react-icons/fa';
import { EXTENSION_DOWNLOAD_LINK } from '@refly/utils';
import { IconDown } from '@refly-packages/ai-workspace-common/components/common/icon';
import { UILocaleList } from '@refly-packages/ai-workspace-common/components/ui-locale-list';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Language } from 'refly-icons';
import logoIcon from '@refly-packages/ai-workspace-common/assets/logo.svg';

function Header() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

  const [value, setValue] = useState('product');

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
        onClick: () => window.open('https://discord.gg/YVuYFjFvRC', '_blank'),
      },
      {
        key: 'wechat',
        label: (
          <div className="flex items-center gap-2">
            <FaWeixin />
            <span>{t('landingPage.tab.wechat')}</span>
          </div>
        ),
        onClick: () => window.open('https://static.refly.ai/landing/wechat-qrcode.webp', '_blank'),
      },
    ],
    [t],
  );

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
      label: t('landingPage.tab.home'),
      value: 'home',
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
    {
      label: t('landingPage.loginModal.privacyPolicy'),
      value: 'privacy',
    },
  ];

  useEffect(() => {
    const path = location.pathname.split('/')[1];
    setValue(path || 'product');
  }, [location.pathname]);

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
    <div
      className="fixed z-20 flex w-full justify-between items-center backdrop-blur-lg px-5 py-3"
      style={{ top: 'var(--banner-height)' }}
    >
      <div className="mr-4 flex shrink-0 flex-row items-center" style={{ height: 45 }}>
        <Logo onClick={() => navigate('/')} className="mr-2" />
        <GithubStar />
        <div className="flex shrink-0 mr-4 ml-5 self-stretch my-auto w-[1px] h-6 bg-refly-Card-Border" />

        <div className="flex flex-row items-center gap-3">
          {tabOptions.map((item) => (
            <Button
              type="text"
              key={item.value}
              className={`${value === item.value ? 'font-semibold text-refly-primary-default' : ''} px-2`}
              onClick={() => {
                if (['community', 'docs', 'gallery'].includes(item.value)) return;
                switch (item.value) {
                  case 'home':
                    navigate('/');
                    break;
                  case 'pricing':
                    navigate('/pricing');
                    break;
                  case 'privacy':
                    window.open('https://docs.refly.ai/about/privacy-policy', '_blank');
                    break;
                }
              }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <UILocaleList>
          <Button
            type="text"
            size="middle"
            className="px-2 text-gray-600 hover:text-green-600 dark:text-gray-300 dark:hover:text-green-300 "
          >
            <Language size={16} />
            {t('language')}{' '}
            <IconDown
              size={16}
              className="ml-1 transition-transform duration-200 group-hover:rotate-180"
            />
          </Button>
        </UILocaleList>

        <Button
          type="text"
          variant="filled"
          className="border-solid border-[1px] border-refly-Card-Border"
          onClick={() => {
            window.open(EXTENSION_DOWNLOAD_LINK, '_blank');
          }}
        >
          <span className="font-semibold text-refly-text-0">{t('landingPage.addToChrome')}</span>
        </Button>

        <Button type="primary" onClick={() => setLoginModalOpen(true)}>
          <img
            src={logoIcon}
            className="object-contain shrink-0 self-stretch my-auto w-4 aspect-square"
            alt="Start icon"
          />
          <span className="font-semibold">{t('landingPage.tryForFree')}</span>
        </Button>
      </div>
    </div>
  );
}

export default Header;
