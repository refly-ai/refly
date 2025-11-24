import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { ListProviderItemsData } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { useUserStoreShallow } from '@refly/stores';
import { providerItemToModelInfo } from '@refly/utils';

export const useFetchProviderItems = (params: ListProviderItemsData['query']) => {
  const { isLogin, userProfile } = useUserStoreShallow((state) => ({
    isLogin: state.isLogin,
    userProfile: state.userProfile,
  }));
  const defaultChatModelId = userProfile?.preferences?.defaultModel?.chat?.itemId;

  const {
    data: providerItems,
    isLoading,
    refetch,
  } = useListProviderItems(
    {
      query: {
        isGlobal: userProfile?.preferences?.providerMode === 'global',
        ...params,
      },
    },
    undefined,
    {
      enabled: isLogin,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  );

  const defaultChatModel = providerItems?.data?.find((item) => item.itemId === defaultChatModelId);

  return {
    data: providerItems?.data ?? [],
    isLoading,
    refetch,
    defaultChatModel: defaultChatModel ? providerItemToModelInfo(defaultChatModel) : null,
  };
};
