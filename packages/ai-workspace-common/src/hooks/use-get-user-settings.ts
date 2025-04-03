import { useEffect } from 'react';
import { useCookie } from 'react-use';
import { useTranslation } from 'react-i18next';
import {
  useMatch,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import {
  LocalSettings,
  useUserStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/user';
import { safeStringifyJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import { mapDefaultLocale } from '@refly-packages/ai-workspace-common/utils/locale';
import { LOCALE } from '@refly/common-types';
import { GetUserSettingsResponse } from '@refly/openapi-schema';
import { UID_COOKIE } from '@refly-packages/utils/cookie';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';

export const useGetUserSettings = () => {
  const userStore = useUserStoreShallow((state) => ({
    setUserProfile: state.setUserProfile,
    setLocalSettings: state.setLocalSettings,
    setIsCheckingLoginStatus: state.setIsCheckingLoginStatus,
    setIsLogin: state.setIsLogin,
    setShowTourModal: state.setShowTourModal,
    setShowSettingsGuideModal: state.setShowSettingsGuideModal,
    userProfile: state.userProfile,
    localSettings: state.localSettings,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [uid] = useCookie(UID_COOKIE);

  const hasLoginCredentials = !!uid;

  const { i18n } = useTranslation();

  const isPublicAcessPage = usePublicAccessPage();
  const isPricing = useMatch('/pricing');

  const getLoginStatus = async () => {
    let error: any;
    let res: GetUserSettingsResponse;

    userStore.setIsCheckingLoginStatus(true);
    if (hasLoginCredentials) {
      const resp = await getClient().getSettings();
      error = resp.error;
      res = resp.data;
    }
    let { localSettings } = userStore;

    // Handle
    if (!hasLoginCredentials || error || !res?.data) {
      userStore.setIsCheckingLoginStatus(false);
      userStore.setUserProfile(undefined);
      userStore.setIsLogin(false);

      if (!isPublicAcessPage && !isPricing) {
        navigate(`/?${searchParams.toString()}`); // Extension should navigate to home
      }

      return;
    }

    userStore.setUserProfile(res.data);
    localStorage.setItem('refly-user-profile', safeStringifyJSON(res.data));
    userStore.setIsLogin(true);

    // set tour guide
    const showSettingsGuideModal = !['skipped', 'completed'].includes(
      res?.data?.onboarding?.settings,
    );
    userStore.setShowSettingsGuideModal(showSettingsGuideModal);
    const showTourModal =
      !showSettingsGuideModal && !['skipped', 'completed'].includes(res?.data?.onboarding?.tour);
    userStore.setShowTourModal(showTourModal);

    // Add localSettings
    let uiLocale = mapDefaultLocale(res?.data?.uiLocale as LOCALE) as LOCALE;
    let outputLocale = res?.data?.outputLocale as LOCALE;

    // Write back first
    localSettings = {
      ...localSettings,
      uiLocale,
      outputLocale,
      isLocaleInitialized: true,
      canvasMode: res?.data?.preferences?.operationMode || 'mouse',
      disableHoverCard: res?.data?.preferences?.disableHoverCard || false,
    };

    // This indicates it's the first time registering and using, so there's no locale set. We need to write it back.
    if (!uiLocale && !outputLocale) {
      uiLocale = mapDefaultLocale((navigator?.language || LOCALE.EN) as LOCALE) as LOCALE;
      outputLocale = (navigator?.language || LOCALE.EN) as LOCALE;
      // Don't block writing back user configuration
      getClient().updateSettings({
        body: { uiLocale, outputLocale },
      });

      // Replace if it's initialization
      localSettings = {
        ...localSettings,
        uiLocale,
        outputLocale,
        isLocaleInitialized: false,
      } as LocalSettings;
    }

    // Apply locale
    i18n.changeLanguage(uiLocale);

    userStore.setLocalSettings(localSettings);
    localStorage.setItem('refly-user-profile', safeStringifyJSON(res?.data));
    localStorage.setItem('refly-local-settings', safeStringifyJSON(localSettings));
    userStore.setIsCheckingLoginStatus(false);
  };

  useEffect(() => {
    getLoginStatus();
  }, [hasLoginCredentials]);
};
