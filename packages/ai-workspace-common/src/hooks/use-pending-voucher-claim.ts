import { useEffect, useRef } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import getClient from '../requests/proxiedRequest';
import { useIsLogin } from './use-is-login';
import { logEvent } from '@refly/telemetry-web';
import { useSubscriptionStoreShallow, useUserStoreShallow } from '@refly/stores';
import type { Voucher } from '@refly/openapi-schema';

const PENDING_VOUCHER_KEY = 'pendingVoucherInviteCode';

/**
 * Hook to handle claiming a voucher that was pending when user was not logged in.
 * Should be used in main workspace/dashboard component that loads after login.
 *
 * Flow:
 * 1. User visits /?invite=code while not logged in
 * 2. Code is stored in localStorage, user logs in
 * 3. User is redirected to /workspace
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

  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  const currentUid = userProfile?.uid;

  useEffect(() => {
    // Only run once and only when logged in
    if (hasChecked.current || !isLoggedIn || !currentUid) {
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

        const verifyData = verifyResponse.data?.data as
          | {
              valid?: boolean;
              claimedByUid?: string;
              claimedVoucher?: Voucher;
              inviterName?: string;
              invitation?: { inviterUid?: string };
            }
          | undefined;

        // Check if this is the user's own invitation (they created it)
        if (verifyData?.invitation?.inviterUid === currentUid) {
          return;
        }

        // Check if already claimed by current user
        if (!verifyData?.valid && verifyData?.claimedByUid === currentUid) {
          // This invitation was already claimed by current user
          // If the voucher exists and is unused, show the popup
          if (
            verifyData.claimedVoucher &&
            verifyData.claimedVoucher.status === 'unused' &&
            new Date(verifyData.claimedVoucher.expiresAt) > new Date()
          ) {
            setTimeout(() => {
              showClaimedVoucherPopup(verifyData.claimedVoucher!, verifyData.inviterName);
            }, 500);
          }
          return;
        }

        if (!verifyResponse.data?.success || !verifyData?.valid) {
          // Invitation is no longer valid (already claimed by someone else or expired)
          message.info({
            content: t(
              'voucher.invite.alreadyClaimed',
              'Code already claimed. Publish a template to get your own.',
            ),
            duration: 5,
          });
          return;
        }

        // Claim the voucher
        const claimResponse = await getClient().claimVoucherInvitation({
          body: { inviteCode: pendingCode },
        });

        if (claimResponse.data?.success && claimResponse.data.data?.voucher) {
          const voucher = claimResponse.data.data.voucher;
          const inviterName = claimResponse.data.data.inviterName;

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
            showClaimedVoucherPopup(voucher, inviterName);
          }, 500);
        } else {
          // Claim failed - check the specific error message
          const errorMessage = claimResponse.data?.data?.message;

          if (errorMessage === 'Cannot claim your own invitation') {
            // User tried to claim their own invitation - just ignore silently
          } else {
            // Other failures (already claimed by another user, etc.)
            message.info({
              content: t(
                'voucher.invite.alreadyClaimed',
                'Code already claimed. Publish a template to get your own.',
              ),
              duration: 5,
            });
          }
        }
      } catch (error) {
        console.error('Failed to claim pending voucher:', error);
        // Don't show error to user as this is a background operation
      }
    };

    claimPendingVoucher();
  }, [isLoggedIn, currentUid, t, showClaimedVoucherPopup]);
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
