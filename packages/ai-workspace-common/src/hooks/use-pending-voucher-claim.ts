import { useEffect, useRef } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '../requests/proxiedRequest';
import { useIsLogin } from './use-is-login';
import { logEvent } from '@refly/telemetry-web';
import { useSubscriptionStoreShallow } from '@refly/stores';

const PENDING_VOUCHER_KEY = 'pendingVoucherInviteCode';

/**
 * Hook to handle claiming a voucher that was pending when user was not logged in.
 * Should be used in main workspace/dashboard component that loads after login.
 *
 * Flow:
 * 1. User visits /invite/:code or /?invite=code while not logged in
 * 2. User clicks "Claim" or scans QR -> code is stored in localStorage, user redirected to login
 * 3. User logs in and is redirected to /workspace
 * 4. This hook detects the pending code and automatically claims it
 * 5. Shows voucher popup (use-only mode) so user can use it immediately
 */
export const usePendingVoucherClaim = () => {
  const { t } = useTranslation();
  const { getLoginStatus } = useIsLogin();
  const isLoggedIn = getLoginStatus();
  const hasChecked = useRef(false);

  const { showClaimedVoucherPopup } = useSubscriptionStoreShallow((state) => ({
    showClaimedVoucherPopup: state.showClaimedVoucherPopup,
  }));

  useEffect(() => {
    // Only run once and only when logged in
    if (hasChecked.current || !isLoggedIn) {
      return;
    }

    const pendingCode = localStorage.getItem(PENDING_VOUCHER_KEY);
    if (!pendingCode) {
      return;
    }

    hasChecked.current = true;

    const claimPendingVoucher = async () => {
      try {
        // Clear the pending code first to prevent duplicate claims
        localStorage.removeItem(PENDING_VOUCHER_KEY);

        // First verify the invitation is still valid
        const verifyResponse = await getClient().verifyVoucherInvitation({
          query: { code: pendingCode },
        });

        if (!verifyResponse.data?.success || !verifyResponse.data.data) {
          console.log('Pending voucher invitation is no longer valid');
          return;
        }

        // Claim the voucher
        const claimResponse = await getClient().claimVoucherInvitation({
          body: { inviteCode: pendingCode },
        });

        if (claimResponse.data?.success && claimResponse.data.data?.voucher) {
          const voucher = claimResponse.data.data.voucher;

          // Log telemetry event
          logEvent('voucher_claim', null, {
            inviteCode: pendingCode,
            discountPercent: voucher.discountPercent,
            source: 'pending_after_login',
          });

          // Show success message
          message.success({
            content: t('voucher.invite.claimSuccess', 'Voucher claimed successfully!'),
            duration: 3,
          });

          // Show the voucher popup (use-only mode) after a short delay
          setTimeout(() => {
            showClaimedVoucherPopup(voucher);
          }, 500);
        }
      } catch (error) {
        console.error('Failed to claim pending voucher:', error);
        // Don't show error to user as this is a background operation
      }
    };

    claimPendingVoucher();
  }, [isLoggedIn, t, showClaimedVoucherPopup]);
};

/**
 * Store a voucher invite code for claiming after login
 */
export const storePendingVoucherCode = (inviteCode: string) => {
  localStorage.setItem(PENDING_VOUCHER_KEY, inviteCode);
};

/**
 * Clear any pending voucher code
 */
export const clearPendingVoucherCode = () => {
  localStorage.removeItem(PENDING_VOUCHER_KEY);
};

/**
 * Get any pending voucher code
 */
export const getPendingVoucherCode = (): string | null => {
  return localStorage.getItem(PENDING_VOUCHER_KEY);
};
