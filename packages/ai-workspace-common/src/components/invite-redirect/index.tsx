import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LightLoading } from '@refly/ui-kit';
import { useUserStoreShallow } from '@refly/stores';
import { storePendingVoucherCode } from '@refly-packages/ai-workspace-common/hooks/use-pending-voucher-claim';

/**
 * Invite redirect page for handling voucher invitation links.
 *
 * URL format: /invite?code=xxx
 *
 * Flow:
 * - Store invite code to localStorage
 * - If logged in → redirect to /workspace?invite=xxx
 * - If not logged in → redirect to landing page (current origin)
 */
export const InviteRedirect = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLogin, isCheckingLoginStatus } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    isCheckingLoginStatus: state.isCheckingLoginStatus,
  }));

  useEffect(() => {
    // Wait for login status check to complete
    if (isCheckingLoginStatus === undefined || isCheckingLoginStatus === true) {
      return;
    }

    const inviteCode = searchParams.get('invite');

    if (inviteCode) {
      // Store invite code for later claiming
      storePendingVoucherCode(inviteCode);
    }

    if (isLogin) {
      // User is logged in, redirect to workspace with invite param
      const targetPath = inviteCode ? `/workspace?invite=${inviteCode}` : '/workspace';
      navigate(targetPath, { replace: true });
    } else {
      // User is not logged in, redirect to landing page with invite param
      const landingUrl = inviteCode
        ? `${window.location.origin}/?invite=${inviteCode}`
        : `${window.location.origin}/`;
      window.location.replace(landingUrl);
    }
  }, [isLogin, isCheckingLoginStatus, searchParams, navigate]);

  return <LightLoading />;
};

export default InviteRedirect;
