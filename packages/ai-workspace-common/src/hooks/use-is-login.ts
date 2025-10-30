import { useCallback, useRef } from 'react';
import { useUserStoreShallow } from '@refly/stores';
import { UID_COOKIE, EMAIL_COOKIE } from '@refly/utils';

// Check if authentication cookies exist in the browser
const checkAuthCookies = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }

  // Get all cookies as a string
  const cookies = document.cookie;

  // Check if required authentication cookies exist
  const hasUid = cookies.includes(`${UID_COOKIE}=`);
  const hasEmail = cookies.includes(`${EMAIL_COOKIE}=`);

  // User is considered logged in if all required cookies exist
  return hasUid && hasEmail;
};

export const useIsLogin = () => {
  const isLoggedRef = useRef<boolean>(false);

  const userStore = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  // User is logged in if:
  // 1. Authentication cookies exist, OR
  // 2. Storage user profile exists with uid, OR
  // 3. User store has user profile with uid

  const getLoginStatus = useCallback(() => {
    // Check authentication cookies first
    const hasAuthCookies = checkAuthCookies();

    // User is logged in if:
    // 1. Authentication cookies exist, OR
    // 2. User store has user profile with uid
    isLoggedRef.current = hasAuthCookies && !!userStore?.userProfile?.uid;
    return hasAuthCookies && !!userStore?.userProfile?.uid;
  }, [userStore.userProfile]);

  isLoggedRef.current = getLoginStatus();

  return {
    isLoggedRef,
    getLoginStatus,
    userProfile: userStore.userProfile,
  };
};
