import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { LOCALE } from '@refly/common-types';
import { UserSettings } from '@refly/openapi-schema';
import { IRuntime, OutputLocale } from '@refly/common-types';

export interface LocalSettings {
  uiLocale: LOCALE;
  outputLocale: OutputLocale;
  isLocaleInitialized: boolean;
  canvasMode: 'mouse' | 'touchpad'; // Canvas operation mode
  disableHoverCard: boolean;
}

interface UserState {
  // state
  isCheckingLoginStatus: boolean | undefined;
  isLogin: boolean;
  userProfile?: UserSettings;
  localSettings: LocalSettings;

  runtime: IRuntime;
  showInvitationCodeModal: boolean;
  showOnboardingFormModal: boolean;
  showOnboardingSuccessAnimation: boolean;
  hidePureCopilotModal: boolean;

  // method
  setIsCheckingLoginStatus: (val: boolean) => void;
  setIsLogin: (val: boolean) => void;
  setUserProfile: (val?: UserSettings) => void;
  setLocalSettings: (val: LocalSettings) => void;
  setRuntime: (val: IRuntime) => void;
  resetState: () => void;
  setShowInvitationCodeModal: (val: boolean) => void;
  setShowOnboardingFormModal: (val: boolean) => void;
  setShowOnboardingSuccessAnimation: (val: boolean) => void;
  setHidePureCopilotModal: (val: boolean) => void;
}

const getDefaultLocale = () => {
  const language = navigator.language;

  if (language?.toLocaleLowerCase()?.startsWith('en')) {
    return 'en';
  }

  if (language?.toLocaleLowerCase()?.startsWith('zh')) {
    return 'zh-CN';
  }

  return 'en';
};

const defaultLocalSettings = {
  uiLocale: getDefaultLocale(),
  outputLocale: navigator.language,
  isLocaleInitialized: false,
  canvasMode: 'mouse',
} as LocalSettings;

const defaultCheckingLoginStatus = {
  isCheckingLoginStatus: undefined,
};

const defaultExtraState = {
  isCheckingLoginStatus: false,
  isLogin: false,
  userProfile: undefined,
  runtime: 'web' as IRuntime,
  localSettings: { ...defaultLocalSettings },
  hidePureCopilotModal: false,
};

const defaultState = {
  ...defaultExtraState,
  ...defaultCheckingLoginStatus,
  showInvitationCodeModal: false,
  showOnboardingFormModal: false,
  showOnboardingSuccessAnimation: false,
};

export const useUserStore = create<UserState>()(
  devtools((set) => ({
    ...defaultState,

    setIsCheckingLoginStatus: (val: boolean) =>
      set((state) => ({ ...state, isCheckingLoginStatus: val })),
    setIsLogin: (val: boolean) => set((state) => ({ ...state, isLogin: val })),
    setUserProfile: (val?: UserSettings) => set((state) => ({ ...state, userProfile: val })),
    setLocalSettings: (val: LocalSettings) => set((state) => ({ ...state, localSettings: val })),
    setRuntime: (val: IRuntime) => set((state) => ({ ...state, runtime: val })),
    resetState: () => set((state) => ({ ...state, ...defaultExtraState })),
    setShowInvitationCodeModal: (val: boolean) =>
      set((state) => ({ ...state, showInvitationCodeModal: val })),
    setShowOnboardingFormModal: (val: boolean) =>
      set((state) => ({ ...state, showOnboardingFormModal: val })),
    setShowOnboardingSuccessAnimation: (val: boolean) =>
      set((state) => ({ ...state, showOnboardingSuccessAnimation: val })),
    setHidePureCopilotModal: (val: boolean) =>
      set((state) => ({ ...state, hidePureCopilotModal: val })),
  })),
);

export const useUserStoreShallow = <T>(selector: (state: UserState) => T) => {
  return useUserStore(useShallow(selector));
};
