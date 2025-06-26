import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface AuthState {
  email: string | null;
  sessionId: string | null;
  loginInProgress: boolean;
  loginProvider: string;
  loginModalOpen: boolean;
  isSignUpMode: boolean;
  verificationModalOpen: boolean;
  resetPasswordModalOpen: boolean;

  setEmail: (val: string | null) => void;
  setSessionId: (val: string | null) => void;
  setLoginInProgress: (val: boolean) => void;
  setLoginProvider: (val: string) => void;
  setLoginModalOpen: (val: boolean) => void;
  setIsSignUpMode: (val: boolean) => void;
  setVerificationModalOpen: (val: boolean) => void;
  setResetPasswordModalOpen: (val: boolean) => void;

  reset: () => void;
}

const defaultState = {
  email: null,
  sessionId: null,
  loginInProgress: false,
  loginProvider: '',
  loginModalOpen: false,
  isSignUpMode: false,
  verificationModalOpen: false,
  resetPasswordModalOpen: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...defaultState,

      setEmail: (val: string | null) => set((state) => ({ ...state, email: val })),
      setSessionId: (val: string | null) => set((state) => ({ ...state, sessionId: val })),
      setLoginInProgress: (val: boolean) => set((state) => ({ ...state, loginInProgress: val })),
      setLoginProvider: (val: string) => set((state) => ({ ...state, loginProvider: val })),
      setLoginModalOpen: (val: boolean) => set((state) => ({ ...state, loginModalOpen: val })),
      setIsSignUpMode: (val: boolean) => set((state) => ({ ...state, isSignUpMode: val })),
      setVerificationModalOpen: (val: boolean) =>
        set((state) => ({ ...state, verificationModalOpen: val })),
      setResetPasswordModalOpen: (val: boolean) =>
        set((state) => ({ ...state, resetPasswordModalOpen: val })),
      reset: () => set({ ...defaultState }),
    }),
    {
      name: 'verification-storage',
      partialize: (state) => ({
        verificationModalOpen: state.verificationModalOpen,
        resetPasswordModalOpen: state.resetPasswordModalOpen,
        sessionId: state.sessionId,
        email: state.email,
      }),
    },
  ),
);

export const useAuthStoreShallow = <T>(selector: (state: AuthState) => T) => {
  return useAuthStore(useShallow(selector));
};
