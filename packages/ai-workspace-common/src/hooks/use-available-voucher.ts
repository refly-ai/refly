import { useEffect } from 'react';
import { useSubscriptionStoreShallow, useUserStoreShallow } from '@refly/stores';
import getClient from '../requests/proxiedRequest';

/**
 * Hook to fetch and store user's available vouchers.
 * Should be called when subscribe modal is opened or when navigating to pricing page.
 *
 * This hook:
 * 1. Fetches available vouchers from the API
 * 2. Stores the best voucher (highest discount) in subscription store
 * 3. Automatically refetches when user changes or modal opens
 */
export const useAvailableVoucher = () => {
  const { isLogin } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
  }));

  const {
    subscribeModalVisible,
    availableVoucher,
    voucherLoading,
    setAvailableVoucher,
    setVoucherLoading,
  } = useSubscriptionStoreShallow((state) => ({
    subscribeModalVisible: state.subscribeModalVisible,
    availableVoucher: state.availableVoucher,
    voucherLoading: state.voucherLoading,
    setAvailableVoucher: state.setAvailableVoucher,
    setVoucherLoading: state.setVoucherLoading,
  }));

  useEffect(() => {
    // Only fetch when logged in and modal is visible
    if (!isLogin || !subscribeModalVisible) {
      return;
    }

    const fetchVouchers = async () => {
      setVoucherLoading(true);
      try {
        const response = await getClient().getAvailableVouchers();
        if (response.data?.success && response.data.data?.bestVoucher) {
          setAvailableVoucher(response.data.data.bestVoucher);
        } else {
          setAvailableVoucher(null);
        }
      } catch (error) {
        console.error('Failed to fetch available vouchers:', error);
        setAvailableVoucher(null);
      } finally {
        setVoucherLoading(false);
      }
    };

    fetchVouchers();
  }, [isLogin, subscribeModalVisible, setAvailableVoucher, setVoucherLoading]);

  return {
    voucher: availableVoucher,
    loading: voucherLoading,
  };
};

/**
 * Fetch available vouchers immediately (for use outside of modal)
 */
// export const fetchAvailableVoucher = async (): Promise<{
//   voucher: ReturnType<typeof getClient>['getAvailableVouchers'] extends Promise<infer R>
//     ? R extends { data?: { data?: { bestVoucher?: infer V } } }
//       ? V | null
//       : null
//     : null;
// }> => {
//   try {
//     const response = await getClient().getAvailableVouchers();
//     if (response.data?.success && response.data.data?.bestVoucher) {
//       return { voucher: response.data.data.bestVoucher };
//     }
//     return { voucher: null };
//   } catch (error) {
//     console.error('Failed to fetch available vouchers:', error);
//     return { voucher: null };
//   }
// };
