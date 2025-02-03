import { useEffect } from 'react';
import { useNavigate } from '@refly-packages/ai-workspace-common/utils/router';

// request
import { LocalSettings, useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { safeParseJSON } from '@refly-packages/ai-workspace-common/utils/parse';

import { LOCALE } from '@refly/common-types';
import { useTranslation } from 'react-i18next';
import { mapDefaultLocale } from '@/utils/locale';
import { storage } from '@refly-packages/ai-workspace-common/utils/storage';
import { useStorage } from './use-storage';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { getRuntime } from '@refly/utils/env';
import { UserSettings } from '@refly/openapi-schema';
import { browser } from 'wxt/browser';
import debounce from 'lodash.debounce';

export const useGetUserSettings = () => {
  const userStore = useUserStore((state) => ({
    resetState: state.resetState,
    setUserProfile: state.setUserProfile,
    setLocalSettings: state.setLocalSettings,
    setIsCheckingLoginStatus: state.setIsCheckingLoginStatus,
  }));
  const navigate = useNavigate();

  const { i18n } = useTranslation();
  const [loginNotification, _setLoginNotification] = useStorage('refly-login-notify', '', 'sync');

  const getLoginStatus = async () => {
    try {
      let { localSettings, userProfile } = useUserStore.getState();
      const lastStatusIsLogin = !!userProfile?.uid;

      if (lastStatusIsLogin) {
        return;
      }

      userStore.setIsCheckingLoginStatus(true);
      const res = await getClient().getSettings();

      console.log('loginStatus', res);

      if (!res?.error || !res) {
        userStore.resetState();
        // await storage.removeItem('local:refly-user-profile');
        // await storage.removeItem('local:refly-local-settings');
        userStore.setIsCheckingLoginStatus(false);
        navigate('/login');
      } else {
        const data = res?.data?.data as UserSettings;
        userStore.setUserProfile(data);

        // 增加 localSettings
        let uiLocale = mapDefaultLocale(data?.uiLocale as string) as LOCALE;
        let outputLocale = data?.outputLocale as LOCALE;

        // 先写回
        localSettings = {
          ...localSettings,
          uiLocale,
          outputLocale,
          isLocaleInitialized: true,
        } as LocalSettings;

        // 说明是第一次注册使用，此时没有 locale，需要写回
        if (!uiLocale && !outputLocale) {
          uiLocale = (mapDefaultLocale(navigator?.language) || LOCALE.EN) as LOCALE;
          outputLocale = (navigator?.language || LOCALE.EN) as LOCALE;
          // 不阻塞写回用户配置
          getClient().updateSettings({
            body: { uiLocale, outputLocale },
          });

          // 如果是初始化的再替换
          localSettings = {
            ...localSettings,
            uiLocale,
            outputLocale,
            isLocaleInitialized: false,
          };
        }

        // 应用 locale
        i18n.changeLanguage(uiLocale);
        userStore.setLocalSettings(localSettings);
        userStore.setIsCheckingLoginStatus(false);

        if (!lastStatusIsLogin) {
          navigate('/');
        }
      }
    } catch (err) {
      console.log('getLoginStatus err', err);
      userStore.setIsCheckingLoginStatus(false);
      userStore.resetState();

      navigate('/login');
    }
  };

  const debounceLogin = debounce(getLoginStatus, 300);

  const handleLogout = async () => {
    await storage.removeItem('sync:refly-login-notify');

    userStore.resetState();
    navigate('/login');
  };

  // sync storage
  useEffect(() => {
    const loginNotify = safeParseJSON(loginNotification);
    if (loginNotify) {
      if (loginNotify?.login) {
        debounceLogin();
      } else if (loginNotify?.login === false) {
        handleLogout();
      }
    }
  }, [loginNotification]);

  // 监听打开关闭
  useEffect(() => {
    debounceLogin();
  }, []);

  // 收到消息之后，关闭窗口，保活检查
  const handleExtensionMessage = (request: any) => {
    if (request?.name === 'reflyStatusCheck' && getRuntime() === 'extension-csui') {
      // getLoginStatus();
      // checkBrowserArc();
    }
  };

  useEffect(() => {
    browser.runtime.onMessage.addListener(handleExtensionMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleExtensionMessage);
    };
  }, []);

  return {
    getLoginStatus,
  };
};
