import { useSubscriptionStoreShallow } from '@refly/stores';
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

  if (!earnedVoucherResult) return null;

  return (
    <VoucherPopup
      visible={earnedVoucherPopupVisible}
      onClose={hideEarnedVoucherPopup}
      voucherResult={earnedVoucherResult}
    />
  );
};

export default EarnedVoucherPopup;
