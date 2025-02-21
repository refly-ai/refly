import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, MenuProps, message } from 'antd';
import { useUserStore, useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { safeStringifyJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import { LOCALE } from '@refly/common-types';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { useLocation } from '@refly-packages/ai-workspace-common/utils/router';

export const UILocaleList = React.memo(
  (props: { children: React.ReactNode; width?: number; onChange?: (lng: LOCALE) => void }) => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const isLandingPage =
      !location.pathname || location.pathname === '/' || location.pathname === '/pricing';

    const userStore = useUserStoreShallow((state) => ({
      isLogin: state.isLogin,
      userProfile: state.userProfile,
      setLocalSettings: state.setLocalSettings,
      setUserProfile: state.setUserProfile,
    }));

    const changeLang = async (lng: LOCALE) => {
      const { localSettings, userProfile } = useUserStore.getState();

      // Always change i18n language
      i18n.changeLanguage(lng);

      // Only update local storage and states if not on landing page or user is logged in
      if (!isLandingPage || userStore.isLogin) {
        userStore.setLocalSettings({ ...localSettings, uiLocale: lng });
        userStore.setUserProfile({ ...userProfile, uiLocale: lng });
        localStorage.setItem(
          'refly-local-settings',
          safeStringifyJSON({ ...localSettings, uiLocale: lng }),
        );

        if (userStore.isLogin) {
          const { data: res, error } = await getClient().updateSettings({
            body: { uiLocale: lng, outputLocale: localSettings.outputLocale },
          });

          if (error || !res?.success) {
            message.error(t('settings.action.putErrorNotify'));
            return;
          }
        }
      }

      props.onChange?.(lng);
    };

    const dropList: MenuProps['items'] = [
      {
        key: 'zh-CN',
        label: '简体中文',
        onClick: () => changeLang('zh-CN' as LOCALE),
      },
      {
        key: 'en',
        label: 'English',
        onClick: () => changeLang('en' as LOCALE),
      },
      {
        key: 'ko',
        label: '한국어',
        onClick: () => changeLang('ko' as LOCALE),
      },
      {
        key: 'ja',
        label: '日本語',
        onClick: () => changeLang('ja' as LOCALE),
      },
    ];

    return (
      <div>
        <Dropdown
          menu={{
            selectedKeys: [i18n.languages?.[0]],
            items: dropList,
            style: { width: props?.width },
          }}
          trigger={['click']}
        >
          {props.children}
        </Dropdown>
      </div>
    );
  },
);

UILocaleList.displayName = 'UILocaleList';
