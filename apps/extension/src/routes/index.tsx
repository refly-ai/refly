import { Route, Routes } from '@refly-packages/ai-workspace-common/utils/router';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { LOCALE } from '@refly/common-types';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Components
import { Login } from '@/pages/login';

// Hooks
import { useGetUserSettings } from '@/hooks/use-get-user-settings';
import { SuspenseLoading } from '@refly-packages/ai-workspace-common/components/common/loading';

export const AppRouter = (props: {
  children: React.ReactNode;
  loadingElement?: React.ReactNode;
  loginElement?: React.ReactNode;
}) => {
  const userStore = useUserStore((state) => ({
    localSettings: state.localSettings,
    userProfile: state.userProfile,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

  const locale = userStore?.localSettings?.uiLocale || LOCALE.EN;
  const { i18n } = useTranslation();
  const language = i18n.languages?.[0];

  // Check user login status
  useGetUserSettings();

  // Handle i18n
  useEffect(() => {
    if (locale && language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  // Show loading while checking login status
  if (userStore.isCheckingLoginStatus === undefined || userStore.isCheckingLoginStatus) {
    return props?.loadingElement || <SuspenseLoading />;
  }

  // Show login page if not logged in
  if (!userStore.userProfile) {
    return (
      <Routes>
        <Route path="*" element={props.loginElement || <Login />} />
      </Routes>
    );
  }

  return <Routes>{props.children}</Routes>;
};
