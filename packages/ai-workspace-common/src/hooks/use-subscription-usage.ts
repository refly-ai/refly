import { useGetSubscriptionUsage } from '@refly-packages/ai-workspace-common/queries/queries';
import { useUserStoreShallow } from '@refly/stores';
import { subscriptionEnabled } from '@refly/ui-kit';
import { useGetCreditBalance } from '@refly-packages/ai-workspace-common/queries/queries';

export const useSubscriptionUsage = () => {
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const {
    data: balanceData,
    refetch: refetchBalance,
    isSuccess: isBalanceSuccess,
  } = useGetCreditBalance({}, [], {
    refetchOnWindowFocus: false, // Disabled to prevent excessive requests when switching tabs
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds (reduced from 15s to minimize API calls)
    staleTime: 30 * 1000,
    gcTime: 60 * 1000, // Keep in cache for 60 seconds
    enabled: subscriptionEnabled && isLogin,
  });

  const {
    data,
    isLoading: isUsageLoading,
    refetch,
  } = useGetSubscriptionUsage({}, [], {
    refetchOnWindowFocus: false, // Disabled to prevent excessive requests when switching tabs
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds (reduced from 15s to minimize API calls)
    staleTime: 30 * 1000,
    gcTime: 60 * 1000, // Keep in cache for 60 seconds
    enabled: subscriptionEnabled && isLogin,
  });
  const { token, storage, fileParsing } = data?.data ?? {};

  const refetchUsage = () =>
    setTimeout(async () => {
      try {
        await refetch();
      } catch (error) {
        console.error('Failed to refetch usage:', error);
      }
      try {
        await refetchBalance();
      } catch (error) {
        console.error('Failed to refetch balance:', error);
      }
    }, 2000);

  return {
    tokenUsage: token,
    storageUsage: storage,
    fileParsingUsage: fileParsing,
    isUsageLoading,
    refetchUsage,
    creditBalance: balanceData?.data?.creditBalance ?? 0,
    isBalanceSuccess,
  };
};
