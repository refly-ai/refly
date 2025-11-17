import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { motion } from 'motion/react';
import { IContextItem } from '@refly/common-types';
import { GenericToolset, ModelInfo } from '@refly/openapi-schema';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useTranslation } from 'react-i18next';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useLaunchpadStoreShallow } from '@refly/stores';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';
import { genActionResultID, processQueryWithMentions } from '@refly/utils';
import { ChatComposer } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-composer';
import { convertContextItemsToNodeFilters } from '@refly/canvas-common';
import { useFetchProviderItems } from '@refly-packages/ai-workspace-common/hooks/use-fetch-provider-items';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';

interface FollowingActionsProps {
  initContextItems: IContextItem[];
  initModelInfo: ModelInfo | null;
  nodeId: string;
  initSelectedToolsets?: GenericToolset[];
}
export const FollowingActions = ({
  initContextItems,
  initModelInfo,
  initSelectedToolsets,
}: FollowingActionsProps) => {
  const { canvasId } = useCanvasContext();
  const { t } = useTranslation();
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const { selectedToolsets: selectedToolsetsFromStore } = useLaunchpadStoreShallow((state) => ({
    selectedToolsets: state.selectedToolsets,
  }));

  const [selectedToolsets, setSelectedToolsets] = useState<GenericToolset[]>(
    selectedToolsetsFromStore ?? [],
  );
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [followUpContextItems, setFollowUpContextItems] =
    useState<IContextItem[]>(initContextItems);
  const [followUpModelInfo, setFollowUpModelInfo] = useState<ModelInfo | null>(initModelInfo);

  const textareaRef = useRef<HTMLDivElement>(null);
  const { invokeAction } = useInvokeAction();
  const { addNode } = useAddNode();
  const { getFinalProjectId } = useAskProject();

  const { data: providerItemList } = useFetchProviderItems({
    category: 'llm',
    enabled: true,
  });

  // Fetch workflow variables for mentions (startNode/resourceLibrary)
  const { data: workflowVariables } = useVariablesManagement(canvasId);

  const defaultProviderItem = providerItemList.find((item) => item.category === 'llm');
  const defaultModelInfo: ModelInfo | null = useMemo(() => {
    if (defaultProviderItem) {
      return {
        name: defaultProviderItem.name,
        label: defaultProviderItem.name,
        provider: defaultProviderItem.provider?.name ?? '',
        providerItemId: defaultProviderItem.itemId,
        contextLimit: (defaultProviderItem.config as any)?.contextLimit ?? 0,
        maxOutput: (defaultProviderItem.config as any)?.maxOutput ?? 0,
        capabilities: (defaultProviderItem.config as any)?.capabilities ?? {},
        category: 'llm',
      };
    }
    return null;
  }, [defaultProviderItem]);

  // Add handler for follow-up question
  const handleFollowUpSend = useCallback(() => {
    if (!followUpQuery?.trim() || !canvasId) return;

    const resultId = genActionResultID();
    const finalProjectId = getFinalProjectId();

    // Use selected model or fallback to default
    const modelInfo = followUpModelInfo || initModelInfo;

    // Check if this is a media generation model
    const isMediaGeneration = modelInfo?.category === 'mediaGeneration';
    if (isMediaGeneration) {
      const capabilities = modelInfo?.capabilities as any;
      const mediaType = capabilities?.image
        ? 'image'
        : capabilities?.video
          ? 'video'
          : capabilities?.audio
            ? 'audio'
            : 'image'; // Default fallback

      // Emit media generation event
      nodeOperationsEmitter.emit('generateMedia', {
        providerItemId: modelInfo?.providerItemId ?? '',
        targetType: 'canvas',
        targetId: canvasId ?? '',
        mediaType,
        query: followUpQuery,
        modelInfo: modelInfo,
        nodeId: '',
        contextItems: followUpContextItems,
      });

      setFollowUpQuery('');
      setFollowUpContextItems([]);
      setFollowUpModelInfo(null);
      setShowFollowUpInput(false);
      return;
    }

    // Process query with workflow variables
    const variables = workflowVariables;
    const { processedQuery } = processQueryWithMentions(followUpQuery, {
      replaceVars: true,
      variables,
    });

    // Invoke the action
    invokeAction(
      {
        query: processedQuery,
        resultId,
        selectedToolsets,
        modelInfo,
        contextItems: followUpContextItems,
        projectId: finalProjectId,
      },
      {
        entityId: canvasId,
        entityType: 'canvas',
      },
    );

    const connectTo = convertContextItemsToNodeFilters(followUpContextItems);

    addNode(
      {
        type: 'skillResponse',
        data: {
          title: processedQuery,
          entityId: resultId,
          metadata: {
            query: followUpQuery,
            status: 'executing',
            selectedToolsets,
            modelInfo,
            contextItems: followUpContextItems,
            projectId: finalProjectId,
          },
        },
      },
      connectTo,
      true,
      true,
    );

    // Clear input and hide input box
    setFollowUpQuery('');
    setFollowUpContextItems([]);
    setFollowUpModelInfo(null);
    setShowFollowUpInput(false);
  }, [
    followUpQuery,
    canvasId,
    followUpModelInfo,
    followUpContextItems,
    invokeAction,
    addNode,
    getFinalProjectId,
    selectedToolsets,
    initModelInfo,
    workflowVariables,
  ]);

  useEffect(() => {
    setFollowUpContextItems(initContextItems);
  }, [initContextItems]);

  useEffect(() => {
    setFollowUpModelInfo(initModelInfo || defaultModelInfo);
  }, [initModelInfo]);

  useEffect(() => {
    setSelectedToolsets(initSelectedToolsets ?? selectedToolsetsFromStore ?? []);
  }, [initSelectedToolsets]);

  return (
    <div className="px-3">
      <AnimatePresence>
        {showFollowUpInput && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
              scale: 0.95,
              y: -10,
            }}
            animate={{
              opacity: 1,
              height: 'auto',
              scale: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              height: 0,
              scale: 0.95,
              y: -10,
            }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1], // easeOutCubic
              height: {
                duration: 0.3,
              },
            }}
            className="mx-1 mt-2 overflow-hidden"
          >
            <div className="px-4 py-3 border-[1px] border-solid border-refly-primary-default rounded-[16px]">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.2 }}
              >
                <ChatComposer
                  ref={textareaRef}
                  query={followUpQuery}
                  setQuery={setFollowUpQuery}
                  handleSendMessage={handleFollowUpSend}
                  contextItems={followUpContextItems}
                  setContextItems={setFollowUpContextItems}
                  modelInfo={followUpModelInfo}
                  setModelInfo={setFollowUpModelInfo}
                  selectedToolsets={selectedToolsets}
                  onSelectedToolsetsChange={setSelectedToolsets}
                  placeholder={t('canvas.launchpad.commonChatInputPlaceholder')}
                  enableRichInput={true}
                  mentionPosition="top-start"
                />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
