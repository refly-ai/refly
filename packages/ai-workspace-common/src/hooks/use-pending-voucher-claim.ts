import { useEffect, useRef } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import getClient from '../requests/proxiedRequest';
import { useIsLogin } from './use-is-login';
import { logEvent } from '@refly/telemetry-web';
import { useSubscriptionStoreShallow, useUserStoreShallow } from '@refly/stores';
import type { Voucher } from '@refly/openapi-schema';

const PENDING_VOUCHER_KEY = 'pendingVoucherInviteCode';
const SIGNUP_ENTRY_POINT_KEY = 'signupEntryPoint';

/**
 * Hook to handle claiming a voucher from URL parameter or localStorage.
 * Should be used in main workspace/dashboard component that loads after login.
 *
 * Flow:
 * 1. User visits /workspace?invite=code (directly or after login redirect)
 * 2. This hook detects the invite code from URL or localStorage
 * 3. Automatically claims the voucher and shows popup
 */
export const usePendingVoucherClaim = () => {
  const { t } = useTranslation();
  const { getLoginStatus } = useIsLogin();
  const isLoggedIn = getLoginStatus();
  const hasChecked = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();

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

    // Check URL parameter first, then localStorage
    const urlInviteCode = searchParams.get('invite');
    const pendingCode = urlInviteCode || localStorage.getItem(PENDING_VOUCHER_KEY);

    if (!pendingCode) {
      return;
    }

    hasChecked.current = true;

    // Clear URL parameter if present
    if (urlInviteCode) {
      searchParams.delete('invite');
      setSearchParams(searchParams, { replace: true });
    }

    const claimPendingVoucher = async () => {
      try {
        // Clear the pending code from localStorage
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
            showClaimedVoucherPopup(verifyData.claimedVoucher!, verifyData.inviterName);
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

          // Show the voucher popup (use-only mode)
          showClaimedVoucherPopup(voucher, inviterName);
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
  }, [isLoggedIn, currentUid, t, showClaimedVoucherPopup, searchParams, setSearchParams]);
};

/**
 * Store a voucher invite code for claiming after login
 * Also stores the signup entry point as voucher_share_link
 */
export const storePendingVoucherCode = (inviteCode: string) => {
  localStorage.setItem(PENDING_VOUCHER_KEY, inviteCode);
  // When storing voucher code, set entry point to voucher_share_link
  localStorage.setItem(SIGNUP_ENTRY_POINT_KEY, 'voucher_share_link');
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

/**
 * Store signup entry point for tracking
 */
export const storeSignupEntryPoint = (entryPoint: string) => {
  // Only store if not already set (don't overwrite voucher_share_link)
  if (!localStorage.getItem(SIGNUP_ENTRY_POINT_KEY)) {
    localStorage.setItem(SIGNUP_ENTRY_POINT_KEY, entryPoint);
  }
};

/**
 * Get and clear signup entry point
 */
export const getAndClearSignupEntryPoint = (): string | null => {
  const entryPoint = localStorage.getItem(SIGNUP_ENTRY_POINT_KEY);
  localStorage.removeItem(SIGNUP_ENTRY_POINT_KEY);
  return entryPoint;
};
