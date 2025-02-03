import { Button } from '@arco-design/web-react';
import { useEffect, useRef } from 'react';

// stores
import { useUserStore } from '@/stores/user';

// 静态资源
import Logo from '@/assets/logo.svg';
import { getClientOrigin } from '@refly/utils/url';
import { CommonHeader } from '@/components/header';
import { useTranslation } from 'react-i18next';
// styles
import './index.scss';
import { safeParseJSON } from '@refly/utils/parse';
import { useStorage } from '@/hooks/use-storage';
import { browser } from 'wxt/browser';

export const Login = () => {
  const userStore = useUserStore((state) => ({
    setIsLogin: state.setIsLogin,
    isLogin: state.isLogin,
  }));
  const _loginWindowRef = useRef<Window | null>();
  const { t } = useTranslation();

  const [loginNotification, _setLoginNotification] = useStorage('refly-login-notify', '', 'sync');

  /**
   * 0. 获取主站的登录态，如果没有登录就访问 Login 页面，已登录之后再展示可操作页面
   * 1. 打开一个弹窗，访问 Refly 主站进行登录
   * 2. 登录完之后，通过 chrome 的 API 给插件发消息，收到消息之后 reload 页面获取登录状态，然后持久化存储
   * 3. 之后带着 cookie or 登录状态去获取请求
   */
  const handleLogin = () => {
    // 提示正在登录
    // userStore.setIsLogin(true);

    // const left = (screen.width - 1200) / 2;
    // const top = (screen.height - 730) / 2;
    // loginWindowRef.current = window.open(
    //   `${getClientOrigin()}/login?from=refly-extension-login`,
    //   '_blank',
    //   `location=no,toolbar=no,menubar=no,width=800,height=730,left=${left} / 2,top=${top} / 2`,
    // );

    // userStore.setIsLogin(true);

    browser.tabs.create({
      url: `${getClientOrigin()}?openLogin=true`,
    });

    setTimeout(() => {
      window.close();
    }, 100);
  };

  useEffect(() => {
    const loginNotify = safeParseJSON(loginNotification);
    if (loginNotify) {
      userStore.setIsLogin(false);
    }
  }, [loginNotification]);

  return (
    <div className="login-container">
      <CommonHeader />
      <div className="login-brand">
        <div
          className="login-branch-content"
          onClick={() => window.open(getClientOrigin(), '_blank')}
        >
          <img src={Logo} alt="Refly" className="w-[38px] h-[38px]" />
          <span className="text-xl font-bold ml-2">Refly</span>
        </div>
        <Button
          type="primary"
          onClick={() => handleLogin()}
          className="w-[260px] h-[44px] mt-8"
          loading={userStore.isLogin}
        >
          {userStore.isLogin
            ? t('extension.loginPage.loggingStatus')
            : t('extension.loginPage.loginBtn')}
        </Button>
      </div>
    </div>
  );
};
