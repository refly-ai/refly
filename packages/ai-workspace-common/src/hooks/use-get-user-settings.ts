import { useEffect } from 'react';
import { useCookie } from 'react-use';
import { useTranslation } from 'react-i18next';
import {
  useMatch,
  useNavigate,
  useSearchParams,
} from '@refly-packages/ai-workspace-common/utils/router';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { LocalSettings, useUserStoreShallow } from '@refly/stores';
import { safeStringifyJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import { mapDefaultLocale } from '@refly-packages/ai-workspace-common/utils/locale';
import { LOCALE, OutputLocale } from '@refly/common-types';
import { UserSettings } from '@refly/openapi-schema';
import { UID_COOKIE } from '@refly/utils/cookie';
import { usePublicAccessPage } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { isDesktop } from '@refly/ui-kit';

export const useGetUserSettings = () => {
  const userStore = useUserStoreShallow((state) => ({
    setUserProfile: state.setUserProfile,
    setLocalSettings: state.setLocalSettings,
    setIsCheckingLoginStatus: state.setIsCheckingLoginStatus,
    setIsLogin: state.setIsLogin,
    setShowTourModal: state.setShowTourModal,
    setShowSettingsGuideModal: state.setShowSettingsGuideModal,
    setShowInvitationCodeModal: state.setShowInvitationCodeModal,
    setShowOnboardingFormModal: state.setShowOnboardingFormModal,
    userProfile: state.userProfile,
    localSettings: state.localSettings,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [uid] = useCookie(UID_COOKIE);

  const hasLoginCredentials = !!uid || isDesktop();

  const { i18n } = useTranslation();

  const isPublicAcessPage = usePublicAccessPage();
  const isPricing = useMatch('/pricing');

  const getLoginStatus = async () => {
    let error: any;
    let settings: UserSettings | undefined;

    userStore.setIsCheckingLoginStatus(true);
    if (hasLoginCredentials) {
      const resp = await getClient().getSettings();
      error = resp.error;
      if (resp.data?.data) {
        settings = resp.data.data;
      }
    }
    let { localSettings } = userStore;

    // Handle
    if (!hasLoginCredentials || error || !settings) {
      userStore.setIsCheckingLoginStatus(false);
      userStore.setUserProfile(undefined);
      userStore.setIsLogin(false);

      if (!isPublicAcessPage && !isPricing) {
        navigate(`/?${searchParams.toString()}`); // Extension should navigate to home
      }

      return;
    }

    userStore.setUserProfile(settings);
    localStorage.setItem('refly-user-profile', safeStringifyJSON(settings));
    userStore.setIsLogin(true);

    // Show onboarding form when user enters the workspace
    userStore.setShowOnboardingFormModal(true);

    // Check if user has been invited to show invitation code modal
    try {
      const invitationResp = await getClient().hasBeenInvited();
      const hasBeenInvited = invitationResp.data?.data ?? false;
      userStore.setShowInvitationCodeModal(!hasBeenInvited);
    } catch (_error) {
      // If invitation check fails, don't block user login, default to not showing modal
      userStore.setShowInvitationCodeModal(false);
    }

    // set tour guide
    const showSettingsGuideModal = !['skipped', 'completed'].includes(
      settings?.onboarding?.settings ?? '',
    );
    userStore.setShowSettingsGuideModal(showSettingsGuideModal);
    const showTourModal =
      !showSettingsGuideModal &&
      !['skipped', 'completed'].includes(settings?.onboarding?.tour ?? '');
    userStore.setShowTourModal(showTourModal);

    // Add localSettings
    let uiLocale = mapDefaultLocale(settings?.uiLocale as LOCALE) as LOCALE;
    let outputLocale = settings?.outputLocale as OutputLocale;

    // Write back first
    localSettings = {
      ...localSettings,
      uiLocale,
      outputLocale,
      isLocaleInitialized: true,
      canvasMode: settings?.preferences?.operationMode || 'mouse',
      disableHoverCard: settings?.preferences?.disableHoverCard || false,
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
    if (i18n.isInitialized) {
      i18n.changeLanguage(uiLocale);
    }

    userStore.setLocalSettings(localSettings);
    localStorage.setItem('refly-user-profile', safeStringifyJSON(settings));
    localStorage.setItem('refly-local-settings', safeStringifyJSON(localSettings));
    userStore.setIsCheckingLoginStatus(false);
  };

  useEffect(() => {
    getLoginStatus();
  }, [hasLoginCredentials]);
};
