import { useSubscriptionStoreShallow } from '@refly/stores';
import { subscriptionEnabled } from '@refly/ui-kit';
import { VoucherPopup } from './voucher-popup';

/**
 * Global component for showing voucher popup after earning via workflow run or publish.
 * This is controlled by the subscription store and can be triggered from anywhere.
 */
export const EarnedVoucherPopup = () => {
  const { earnedVoucherPopupVisible, earnedVoucherResult, hideEarnedVoucherPopup } =
    useSubscriptionStoreShallow((state) => ({
      earnedVoucherPopupVisible: state.earnedVoucherPopupVisible,
      earnedVoucherResult: state.earnedVoucherResult,
      hideEarnedVoucherPopup: state.hideEarnedVoucherPopup,
    }));

  // Skip voucher popup when subscription features are disabled (self-deploy mode)
  if (!subscriptionEnabled) return null;

  if (!earnedVoucherResult) return null;

  return (
    <VoucherPopup
      visible={earnedVoucherPopupVisible}
      onClose={hideEarnedVoucherPopup}
      voucherResult={earnedVoucherResult}
    />
  );
};
