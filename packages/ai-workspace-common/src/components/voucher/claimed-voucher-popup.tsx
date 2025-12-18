import { useSubscriptionStoreShallow } from '@refly/stores';
import { VoucherPopup } from './voucher-popup';
import { VoucherTriggerResult } from '@refly/openapi-schema';

/**
 * Global component for showing voucher popup after claiming via invitation.
 * This should be placed in the app layout alongside SubscribeModal.
 *
 * Features:
 * - For non-Plus users: Shows "Use It Now" button to subscribe with voucher
 * - For Plus users: Shows "Publish to Get Coupon" button (no need to subscribe)
 * - Controlled by subscription store state
 * - Used after user claims voucher from QR code / invite link
 * - Always hides "Share With Friend" button since claimed vouchers cannot be re-shared
 */
export const ClaimedVoucherPopup = () => {
  const {
    claimedVoucherPopupVisible,
    claimedVoucher,
    claimedVoucherInviterName,
    hideClaimedVoucherPopup,
  } = useSubscriptionStoreShallow((state) => ({
    claimedVoucherPopupVisible: state.claimedVoucherPopupVisible,
    claimedVoucher: state.claimedVoucher,
    claimedVoucherInviterName: state.claimedVoucherInviterName,
    hideClaimedVoucherPopup: state.hideClaimedVoucherPopup,
  }));

  if (!claimedVoucher) return null;

  // Convert Voucher to VoucherTriggerResult format for VoucherPopup
  const voucherResult: VoucherTriggerResult = {
    voucher: claimedVoucher,
    score: 0, // Not applicable for claimed vouchers
    triggerLimitReached: false,
  };

  return (
    <VoucherPopup
      visible={claimedVoucherPopupVisible}
      onClose={hideClaimedVoucherPopup}
      voucherResult={voucherResult}
      useOnlyMode // Always true for claimed vouchers - they cannot be re-shared
      inviterName={claimedVoucherInviterName || undefined}
    />
  );
};

export default ClaimedVoucherPopup;
