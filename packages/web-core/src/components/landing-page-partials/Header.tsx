import { Button } from 'antd';
import { useAuthStoreShallow } from '@refly/stores';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';
import './header.scss';
import { IconDown } from '@refly-packages/ai-workspace-common/components/common/icon';
import { UILocaleList } from '@refly-packages/ai-workspace-common/components/ui-locale-list';
import { Logo } from '@refly-packages/ai-workspace-common/components/common/logo';
import { GithubStar } from '@refly-packages/ai-workspace-common/components/common/github-star';
import { Language } from 'refly-icons';
import logoIcon from '@refly-packages/ai-workspace-common/assets/logo.svg';

function Header() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setLoginModalOpen } = useAuthStoreShallow((state) => ({
    setLoginModalOpen: state.setLoginModalOpen,
  }));

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
      className="fixed top-0 z-20 flex w-full justify-between items-center backdrop-blur-lg px-5 py-3"
      style={{ fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif' }}
    >
      {/* Left Section: Logo + GitHub Star */}
      <div className="flex items-center gap-2">
        <Logo onClick={() => navigate('/')} />
        <GithubStar />
      </div>

      {/* Right Section: Language Selector + Start Button */}
      <div className="flex items-center gap-3">
        <UILocaleList>
          <Button
            type="text"
            size="middle"
            className="px-3 py-1.5 h-8 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
            style={{ fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif' }}
          >
            <Language size={16} />
            <span className="ml-1">English</span>
            <IconDown
              size={16}
              className="ml-1 transition-transform duration-200 group-hover:rotate-180"
            />
          </Button>
        </UILocaleList>

        <Button
          type="primary"
          onClick={() => setLoginModalOpen(true)}
          className="h-8 px-3 py-1.5"
          style={{
            backgroundColor: '#0E9F77',
            borderColor: '#0E9F77',
            fontFamily: 'PingFang SC, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <img src={logoIcon} className="w-4 h-4 mr-2" alt="Refly icon" />
          <span className="font-semibold">开始使用</span>
        </Button>
      </div>
    </div>
  );
}

export default Header;
