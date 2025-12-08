import { useSubscriptionStoreShallow } from '@refly/stores';
import { VoucherPopup } from './voucher-popup';
import { VoucherTriggerResult } from '@refly/openapi-schema';

/**
 * Global component for showing voucher popup after claiming via invitation.
 * This should be placed in the app layout alongside SubscribeModal.
 *
 * Features:
 * - Shows voucher popup in "use only" mode (no share button)
 * - Controlled by subscription store state
 * - Used after user claims voucher from QR code / invite link
 */
export const ClaimedVoucherPopup = () => {
  const { claimedVoucherPopupVisible, claimedVoucher, hideClaimedVoucherPopup } =
    useSubscriptionStoreShallow((state) => ({
      claimedVoucherPopupVisible: state.claimedVoucherPopupVisible,
      claimedVoucher: state.claimedVoucher,
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
      useOnlyMode={true}
    />
  );
};

export default ClaimedVoucherPopup;
