import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiChat } from 'refly-icons';
import { Form } from 'antd';
import type { IContextItem } from '@refly/common-types';
import type { ModelInfo, ProviderItem } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useListProviderItems } from '@refly-packages/ai-workspace-common/queries';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { useUserStoreShallow } from '@refly/stores';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { motion, AnimatePresence } from 'motion/react';

type MediaType = 'image' | 'video' | 'audio';

interface MediaActionContainerProps {
  title?: string;
  contextItems?: IContextItem[];
  modelInfo?: ModelInfo | null;
  mediaType: MediaType;
  resultId?: string;
  storageKey?: string;
}

const MediaActionContainerComponent = ({
  title,
  contextItems,
  modelInfo,
  mediaType,
  resultId,
  storageKey,
}: MediaActionContainerProps) => {
  const { t } = useTranslation();
  const { readonly, canvasId } = useCanvasContext();
  const { userProfile } = useUserStoreShallow((state) => ({ userProfile: state.userProfile }));

  // Follow-up input state
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [followUpContextItems, setFollowUpContextItems] = useState<IContextItem[]>(
    contextItems ?? [],
  );
  const [followUpModelInfo, setFollowUpModelInfo] = useState<ModelInfo | null>(modelInfo ?? null);
  const [form] = Form.useForm();
  const textareaRef = useRef<HTMLDivElement>(null);

  // Image upload handlers for follow-up
  const { handleUploadImage, handleUploadMultipleImages } = useUploadImage();
  const handleFollowUpImageUpload = useCallback(
    async (file: File) => {
      const nodeData = await handleUploadImage(file, canvasId);
      if (nodeData) {
        setFollowUpContextItems((prev) => [...prev, { type: 'image', ...nodeData }]);
      }
    },
    [handleUploadImage, canvasId],
  );
  const handleFollowUpMultipleImagesUpload = useCallback(
    async (files: File[]) => {
      const nodesData = await handleUploadMultipleImages(files, canvasId);
      if (nodesData?.length) {
        const newItems = nodesData.map((d) => ({ type: 'image' as const, ...d }));
        setFollowUpContextItems((prev) => [...prev, ...newItems]);
      }
    },
    [handleUploadMultipleImages, canvasId],
  );

  // Media provider list
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
    if (followUpModelInfo?.providerItemId) {
      return providerItemList.find((p) => p.itemId === followUpModelInfo?.providerItemId) ?? null;
    }
    return providerItemList.length > 0 ? providerItemList[0] : null;
  }, [providerItemList, followUpModelInfo?.providerItemId]);

  const initializeFollowUpInput = useCallback(() => {
    // Merge provided context items with the current media artifact reference
    // Use media type specific item so downstream can extract storageKeys by resultId
    const mediaItem: IContextItem | null = resultId
      ? {
          type: mediaType,
          entityId: resultId,
          title: title ?? '',
          metadata: storageKey ? { storageKey } : {},
        }
      : null;

    setFollowUpContextItems((prev) => (mediaItem ? [mediaItem, ...(prev ?? [])] : (prev ?? [])));

    // Set default model info from provider item if not set
    if (!followUpModelInfo && defaultProviderItem) {
      const cfg = (defaultProviderItem.config ?? {}) as any;
      setFollowUpModelInfo({
        name: cfg?.modelId ?? defaultProviderItem.name ?? '',
        label: defaultProviderItem.name ?? '',
        provider: defaultProviderItem.provider?.name ?? '',
        providerItemId: defaultProviderItem.itemId,
        contextLimit: cfg?.contextLimit ?? 0,
        maxOutput: cfg?.maxOutput ?? 0,
        capabilities: cfg?.capabilities ?? {},
        category: 'mediaGeneration',
      });
    }

    setShowFollowUpInput((v) => !v);
  }, [resultId, mediaType, title, storageKey, followUpModelInfo, defaultProviderItem]);

  const handleFollowUpSend = useCallback(() => {
    if (!followUpQuery?.trim() || !canvasId) return;

    const selectedModel =
      followUpModelInfo ??
      (defaultProviderItem
        ? {
            name: (defaultProviderItem.config as any)?.modelId ?? defaultProviderItem.name ?? '',
            label: defaultProviderItem.name ?? '',
            provider: defaultProviderItem.provider?.name ?? '',
            providerItemId: defaultProviderItem.itemId,
            contextLimit: (defaultProviderItem.config as any)?.contextLimit ?? 0,
            maxOutput: (defaultProviderItem.config as any)?.maxOutput ?? 0,
            capabilities: (defaultProviderItem.config as any)?.capabilities ?? {},
            category: 'mediaGeneration' as const,
          }
        : undefined);

    const mediaType = selectedModel?.capabilities?.image
      ? 'image'
      : selectedModel?.capabilities?.video
        ? 'video'
        : selectedModel?.capabilities?.audio
          ? 'audio'
          : 'image';

    nodeOperationsEmitter.emit('generateMedia', {
      providerItemId: selectedModel?.providerItemId ?? '',
      targetType: 'canvas',
      targetId: canvasId ?? '',
      mediaType,
      query: followUpQuery,
      modelInfo: selectedModel as ModelInfo,
      nodeId: '',
      contextItems: followUpContextItems ?? [],
    });

    // Reset input state
    setFollowUpQuery('');
    setFollowUpContextItems([]);
    setFollowUpModelInfo(null);
    setShowFollowUpInput(false);
  }, [followUpQuery, canvasId, followUpModelInfo, defaultProviderItem, followUpContextItems]);

  const footerModelLabel = useMemo(() => {
    return followUpModelInfo?.label ?? modelInfo?.label ?? defaultProviderItem?.name ?? '';
  }, [followUpModelInfo?.label, modelInfo?.label, defaultProviderItem?.name]);

  // Avoid inline objects/functions in render
  const emptyRuntimeConfig = useMemo(() => ({}) as Record<string, unknown>, []);
  const noop = useCallback(() => {}, []);

  return (
    <div
      className="border-[1px] border-solid border-b-0 border-x-0 border-refly-Card-Border pt-3"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div className="flex flex-row items-center justify-between bg-refly-tertiary-default px-3 py-2 rounded-xl mx-3">
        <div className="flex flex-row items-center px-2">
          <span className="font-[600] pr-4">{t('canvas.nodeActions.nextStepSuggestions')}</span>
          <div
            className="bg-[#CDFFF1] border-[1px] border-solid border-refly-Card-Border hover:bg-[#CDFFF1] hover:border-refly-Card-Border px-2 py-1 rounded-lg flex items-center justify-center cursor-pointer"
            onClick={initializeFollowUpInput}
          >
            <AiChat className="w-4 h-4 mr-[2px]" color="#0E9F77" />
            <span className="text-[#0E9F77] font-[600] text-xs">
              {t('canvas.nodeActions.followUpQuestion')}
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showFollowUpInput && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, height: 'auto', scale: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1], height: { duration: 0.3 } }}
            className="mx-3 mt-2 overflow-hidden"
          >
            <div className="px-4 py-3 border-[1px] border-solid border-refly-primary-default rounded-[16px] flex flex-col gap-2">
              <ContextManager
                contextItems={followUpContextItems}
                setContextItems={setFollowUpContextItems}
              />

              <ChatInput
                ref={textareaRef}
                readonly={readonly}
                query={followUpQuery}
                setQuery={setFollowUpQuery}
                selectedSkillName={null}
                handleSendMessage={handleFollowUpSend}
                onUploadImage={handleFollowUpImageUpload}
                onUploadMultipleImages={handleFollowUpMultipleImagesUpload}
                placeholder={t('canvas.nodeActions.nextStepSuggestionsDescription')}
              />

              <ChatActions
                query={followUpQuery}
                model={followUpModelInfo ?? undefined}
                setModel={setFollowUpModelInfo}
                runtimeConfig={emptyRuntimeConfig}
                setRuntimeConfig={noop}
                handleSendMessage={handleFollowUpSend}
                handleAbort={noop}
                onUploadImage={handleFollowUpImageUpload}
                contextItems={followUpContextItems}
                form={form}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between p-3 rounded-b-xl">
        {footerModelLabel ? (
          <div className="flex flex-row text-gray-500 text-sm gap-3">
            <div className="flex items-center gap-1">{footerModelLabel}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const MediaActionContainer = memo(MediaActionContainerComponent, (prevProps, nextProps) => {
  return (
    prevProps.title === nextProps.title &&
    prevProps.modelInfo === nextProps.modelInfo &&
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.mediaType === nextProps.mediaType &&
    prevProps.resultId === nextProps.resultId &&
    prevProps.storageKey === nextProps.storageKey
  );
});

MediaActionContainer.displayName = 'MediaActionContainer';

export default MediaActionContainer;
