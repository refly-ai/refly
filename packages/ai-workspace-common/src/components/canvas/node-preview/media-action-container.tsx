import { memo, useMemo } from 'react';
import type { IContextItem } from '@refly/common-types';
import type { ModelInfo, ProviderItem } from '@refly/openapi-schema';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow } from '@refly/stores';
import { FollowingActions } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/sharedComponents/following-actions';
import { ModelIcon } from '@lobehub/icons';

type MediaType = 'image' | 'video' | 'audio';

interface MediaActionContainerProps {
  title?: string;
  contextItems?: IContextItem[];
  modelInfo?: ModelInfo | null;
  mediaType: MediaType;
  entityId?: string;
  storageKey?: string;
  nodeId: string;
}

const MediaActionContainerComponent = ({
  title,
  contextItems,
  modelInfo,
  mediaType,
  entityId,
  nodeId,
  storageKey,
}: MediaActionContainerProps) => {
  const { userProfile } = useUserStoreShallow((state) => ({ userProfile: state.userProfile }));

  const { data: mediaProviderItems } = useListProviderItems({
    query: {
      enabled: true,
      category: 'mediaGeneration',
      isGlobal: userProfile?.preferences?.providerMode === 'global',
    },
  });

  const providerItemList: ProviderItem[] = useMemo(
    () => mediaProviderItems?.data ?? [],
    [mediaProviderItems?.data],
  );

  // Default provider item from existing modelInfo or first item
  const defaultProviderItem = useMemo(() => {
    if (modelInfo?.providerItemId) {
      return providerItemList.find((p) => p.itemId === modelInfo?.providerItemId) ?? null;
    }
    return providerItemList.length > 0 ? providerItemList[0] : null;
  }, [providerItemList, modelInfo?.providerItemId]);

  // Prepare context items with media artifact reference
  const initContextItems: IContextItem[] = useMemo(() => {
    const mediaItem: IContextItem | null = entityId
      ? {
          type: mediaType,
          entityId: entityId,
          title: title ?? '',
          metadata: storageKey ? { storageKey } : {},
        }
      : null;

    return mediaItem ? [mediaItem, ...(contextItems ?? [])] : (contextItems ?? []);
  }, [entityId, mediaType, title, storageKey, contextItems]);

  // Prepare model info
  const initModelInfo: ModelInfo | null = useMemo(() => {
    if (modelInfo) return modelInfo;

    if (defaultProviderItem) {
      const cfg = (defaultProviderItem.config ?? {}) as any;
      return {
        name: cfg?.modelId ?? defaultProviderItem.name ?? '',
        label: defaultProviderItem.name ?? '',
        provider: defaultProviderItem.provider?.name ?? '',
        providerItemId: defaultProviderItem.itemId,
        contextLimit: cfg?.contextLimit ?? 0,
        maxOutput: cfg?.maxOutput ?? 0,
        capabilities: cfg?.capabilities ?? {},
        category: 'mediaGeneration',
      };
    }

    return null;
  }, [modelInfo, defaultProviderItem]);

  return (
    <div
      className="border-[1px] border-solid border-b-0 border-x-0 border-refly-Card-Border pt-3"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <FollowingActions
        initContextItems={initContextItems}
        initModelInfo={initModelInfo}
        nodeId={nodeId}
      />

      <div className="w-full flex items-center justify-between px-3 pt-3 rounded-b-xl">
        {modelInfo ? (
          <div className="flex items-center text-refly-text-1 text-xs gap-0.5 pb-3">
            <ModelIcon size={16} model={modelInfo.name} type="color" />
            <div className="flex items-center gap-1">{modelInfo.label}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const MediaActionContainer = memo(MediaActionContainerComponent);

MediaActionContainer.displayName = 'MediaActionContainer';

export default MediaActionContainer;
