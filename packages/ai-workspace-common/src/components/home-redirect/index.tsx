import { useEffect, useState } from 'react';
import { LightLoading } from '@refly/ui-kit';
import { ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useUserStoreShallow } from '@refly/stores';
import { storePendingVoucherCode } from '../../hooks/use-pending-voucher-claim';

// Key for storing invite code from homepage QR scan
const HOMEPAGE_INVITE_KEY = 'homepageInviteCode';

/**
 * Store invite code from homepage URL parameter
 * This is different from pendingVoucherInviteCode - it's specifically for
 * users who scan QR code and land on homepage
 */
export const storeHomepageInviteCode = (code: string) => {
  localStorage.setItem(HOMEPAGE_INVITE_KEY, code);
};

export const getHomepageInviteCode = (): string | null => {
  return localStorage.getItem(HOMEPAGE_INVITE_KEY);
};

export const clearHomepageInviteCode = () => {
  localStorage.removeItem(HOMEPAGE_INVITE_KEY);
};

export const HomeRedirect = ({ defaultNode }: { defaultNode: ReactNode }) => {
  const [element, setElement] = useState<ReactNode | null>(null);
  const [searchParams] = useSearchParams();
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  // Check for invite parameter in URL
  const inviteCode = searchParams.get('invite');

  useEffect(() => {
    // If there's an invite code in URL, store it
    if (inviteCode) {
      storeHomepageInviteCode(inviteCode);
      // Also store as pending voucher code for the claim flow
      storePendingVoucherCode(inviteCode);
    }
  }, [inviteCode]);

  const handleHomeRedirect = async () => {
    if (isLogin) {
      // If logged in, go to workspace (voucher claim will happen there)
      return <Navigate to={'/workspace'} replace />;
    }

    // If there's an invite code and user is not logged in, redirect to login
    if (inviteCode) {
      const returnUrl = encodeURIComponent(`${window.location.origin}/workspace`);
      return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
    }

    // Return defaultNode to allow server-side handling (e.g., Cloudflare Worker)
    // BackendRedirect will handle the redirect and avoid infinite loop
    return defaultNode;
  };

  useEffect(() => {
    handleHomeRedirect().then(setElement);
  }, [isLogin, defaultNode, inviteCode]);

  return element ?? <LightLoading />;
};
