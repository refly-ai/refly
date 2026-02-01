import { useEffect } from 'react';
import { useCookie } from 'react-use';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from '@refly-packages/ai-workspace-common/utils/router';

import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { LocalSettings, useSubscriptionStore, useUserStoreShallow } from '@refly/stores';
import { safeStringifyJSON } from '@refly-packages/ai-workspace-common/utils/parse';
import { mapDefaultLocale } from '@refly-packages/ai-workspace-common/utils/locale';
import { LOCALE, OutputLocale } from '@refly/common-types';
import { UserPreferences, UserSettings } from '@refly/openapi-schema';
import { UID_COOKIE } from '@refly/utils/cookie';
import { isPublicAccessPageByPath } from '@refly-packages/ai-workspace-common/hooks/use-is-share-page';
import { isDesktop } from '@refly/ui-kit';
import { updateUserProperties } from '@refly/telemetry-web';
import { authChannel } from '@refly-packages/ai-workspace-common/utils/auth-channel';

let activeRequestId = 0;
let activeRequestPromise: Promise<void> | null = null;
let activeRequestKey: string | null = null;

export const resetUserSettingsRequestState = () => {
  activeRequestId += 1;
  activeRequestPromise = null;
  activeRequestKey = null;
};

export const useGetUserSettings = () => {
  const userStore = useUserStoreShallow((state) => ({
    setUserProfile: state.setUserProfile,
    setLocalSettings: state.setLocalSettings,
    setIsCheckingLoginStatus: state.setIsCheckingLoginStatus,
    setIsLogin: state.setIsLogin,
    setShowInvitationCodeModal: state.setShowInvitationCodeModal,
    setShowOnboardingFormModal: state.setShowOnboardingFormModal,
    userProfile: state.userProfile,
    localSettings: state.localSettings,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
    isLogin: state.isLogin,
  }));
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [uid] = useCookie(UID_COOKIE);

  const hasLoginCredentials = !!uid || isDesktop();

  const { i18n } = useTranslation();

  const getLoginStatus = async () => {
    const requestId = ++activeRequestId;
    const isLatestRequest = () => requestId === activeRequestId;
    let error: any;
    let settings: UserSettings | undefined;

    if (!isLatestRequest()) return;
    userStore.setIsCheckingLoginStatus(true);
    (window as any).__REFLY_SHOW_LOADING__?.();
    if (hasLoginCredentials) {
      const resp = await getClient().getSettings();
      error = resp.error;
      if (resp.data?.data) {
        settings = resp.data.data;
      }
    }
    (window as any).__REFLY_HIDE_LOADING__?.();
    let { localSettings } = userStore;

    // Handle
    if (!hasLoginCredentials || error || !settings) {
      if (!isLatestRequest()) return;
      userStore.setIsCheckingLoginStatus(false);
      userStore.setUserProfile(undefined);
      userStore.setIsLogin(false);

      // Clear authChannel's currentUid to prevent false logout detection
      authChannel.updateCurrentUid(null);

      // Use window.location.pathname to get current route (always latest, no dependency needed).
      // We use isPublicAccessPageByPath (extracted from usePublicAccessPage) to check.
      // This ensures we get the latest route value even in async context.
      const currentPath = window?.location?.pathname ?? '';
      const isPublicPage = isPublicAccessPageByPath(currentPath);

      // Short-circuit to avoid redirect loops:
      // - Do NOT navigate if we are already on public pages (including /login)
      // - Do NOT navigate when we are already at root '/', because AppLayout will handle root redirection
      if (!isPublicPage && currentPath !== '/' && currentPath !== '/login') {
        // Preserve current path and query params as returnUrl for post-login redirect
        const currentSearch = window?.location?.search ?? '';
        const fullPath = currentPath + currentSearch;
        const returnUrl = encodeURIComponent(fullPath);
        navigate(
          `/login?returnUrl=${returnUrl}${searchParams.toString() ? `&${searchParams.toString()}` : ''}`,
        );
      }

      return;
    }

    if (!isLatestRequest()) return;
    userStore.setUserProfile(settings);
    const subscriptionPlanType = settings?.subscription?.planType;
    const subscriptionLookupKey = settings?.subscription?.lookupKey;

    const { setPlanType, setUserType } = useSubscriptionStore.getState();
    let userTypeForUserProperties: string | null = null;
    if (!subscriptionPlanType) {
      setPlanType('free');
      setUserType('Free');
      userTypeForUserProperties = 'Free';
    }
    if (subscriptionPlanType) {
      setPlanType(subscriptionPlanType);
    }
    if (subscriptionLookupKey) {
      let userType = subscriptionLookupKey;
      if (subscriptionPlanType === 'starter' || subscriptionPlanType === 'maker') {
        userType = subscriptionPlanType.charAt(0).toUpperCase() + subscriptionPlanType.slice(1);
      } else if (subscriptionPlanType === 'plus') {
        if (
          subscriptionLookupKey === 'refly_plus_monthly_stable_v3' ||
          subscriptionLookupKey === 'refly_plus_yearly_stable_v3'
        ) {
          userType = 'Plus';
        } else {
          userType = 'Plus_old';
        }
      } else if (subscriptionPlanType === 'pro') {
        userType = 'Pro_old';
      }
      setUserType(userType);
      userTypeForUserProperties = userType;
    }

    // Check if this is a transition from not-logged-in to logged-in
    // This happens after OAuth callback, email verification, or other backend auth flows
    const wasNotLoggedIn = !userStore.isLogin;

    localStorage.setItem('refly-user-profile', safeStringifyJSON(settings));
    userStore.setIsLogin(true);

    // Update authChannel current uid (for user-changed detection)
    const currentUid = settings?.uid;
    if (currentUid) {
      authChannel.updateCurrentUid(currentUid);
    }

    // Broadcast login event to other tabs only on transition from not-logged-in to logged-in
    // This covers OAuth callbacks and email verification redirects
    if (wasNotLoggedIn && currentUid) {
      console.log('[Auth] Broadcasting login event after authentication (OAuth/verification)');
      authChannel.broadcast({ type: 'login', uid: currentUid });
    }

    // Update user properties after identity is resolved
    const userAttributes = settings?.attributes;
    if (userAttributes) {
      updateUserProperties({
        ...userAttributes,
        ...(userTypeForUserProperties ? { user_plan: userTypeForUserProperties } : {}),
      });
    }

    // Update modal status based on user preferences
    const updateModalStatus = (preferences: UserPreferences) => {
      const hasBeenInvited = preferences.hasBeenInvited;
      userStore.setShowInvitationCodeModal(!preferences.hasBeenInvited);

      // Only check form filling status if user has been invited
      if (hasBeenInvited) {
        const hasFilledForm = preferences.hasFilledForm ?? false;
        userStore.setShowOnboardingFormModal(!hasFilledForm);
      }
    };

    if (settings?.preferences) {
      updateModalStatus(settings?.preferences);
    }

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
    (window as any).__REFLY_HIDE_LOADING__?.();
  };

  useEffect(() => {
    const requestKey = hasLoginCredentials
      ? uid
        ? `uid:${uid}`
        : isDesktop()
          ? 'desktop'
          : 'credentials-unknown'
      : 'no-credentials';

    if (activeRequestPromise && activeRequestKey === requestKey) {
      return;
    }
    activeRequestKey = requestKey;
    const promise = getLoginStatus().finally(() => {
      if (activeRequestPromise === promise) {
        activeRequestPromise = null;
      }
    });
    activeRequestPromise = promise;
  }, [hasLoginCredentials, uid]);
};
