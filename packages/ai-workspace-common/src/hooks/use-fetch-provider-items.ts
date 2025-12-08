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
  const defaultAgentModelId = userProfile?.preferences?.defaultModel?.agent?.itemId;

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
  const defaultAgentModel = providerItems?.data?.find(
    (item) => item.itemId === defaultAgentModelId,
  );

  return {
    data: providerItems?.data ?? [],
    isLoading,
    refetch,
    defaultChatModel: defaultChatModel ? providerItemToModelInfo(defaultChatModel) : null,
    defaultAgentModel: defaultAgentModel
      ? providerItemToModelInfo(defaultAgentModel)
      : defaultChatModel
        ? providerItemToModelInfo(defaultChatModel)
        : null,
  };
};
