import { notification, Button, Form, Badge } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useContextPanelStore,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useContextFilterErrorTip } from './context-manager/hooks/use-context-filter-errror-tip';
import { genActionResultID, genUniqueId } from '@refly/utils/id';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';
import { useChatStore, useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';

import { SelectedSkillHeader } from './selected-skill-header';
import {
  useSkillStore,
  useSkillStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/skill';
import { ContextManager } from './context-manager';
import { ConfigManager } from './config-manager';
import { ChatActions, CustomAction } from './chat-actions';
import { ChatInput } from './chat-input';

import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useSyncSelectedNodesToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-sync-selected-nodes-to-context';
import { PiMagicWand } from 'react-icons/pi';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { convertContextItemsToNodeFilters } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { IoClose } from 'react-icons/io5';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { useUploadImage } from '@refly-packages/ai-workspace-common/hooks/use-upload-image';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { omit } from '@refly/utils/index';
import { cn } from '@refly/utils/cn';
import { ActionStatus, SkillTemplateConfig } from '@refly/openapi-schema';
import { ContextTarget } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { ProjectKnowledgeToggle } from '@refly-packages/ai-workspace-common/components/project/project-knowledge-toggle';
import { useAskProject } from '@refly-packages/ai-workspace-common/hooks/canvas/use-ask-project';
import { McpSelectorPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/mcp-selector-panel';
import { ToolOutlined } from '@ant-design/icons';

const PremiumBanner = () => {
  const { t } = useTranslation();
  const { showPremiumBanner, setShowPremiumBanner } = useLaunchpadStoreShallow((state) => ({
    showPremiumBanner: state.showPremiumBanner,
    setShowPremiumBanner: state.setShowPremiumBanner,
  }));
  const setSubscribeModalVisible = useSubscriptionStoreShallow(
    (state) => state.setSubscribeModalVisible,
  );

  if (!showPremiumBanner) return null;

  const handleUpgrade = () => {
    setSubscribeModalVisible(true);
  };

  return (
    <div className="flex items-center justify-between px-3 py-0.5 bg-gray-100 border-b dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 whitespace-nowrap">
          {t('copilot.premiumBanner.message')}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="text"
            size="small"
            className="text-xs text-green-600 px-2"
            onClick={handleUpgrade}
          >
            {t('copilot.premiumBanner.upgrade')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IoClose size={14} className="flex items-center justify-center" />}
            onClick={() => setShowPremiumBanner(false)}
            className="text-gray-400 hover:text-gray-500 flex items-center justify-center w-5 h-5 min-w-0 p-0"
          />
        </div>
      </div>
    </div>
  );
};

interface ChatPanelProps {
  embeddedMode?: boolean;
  onAddMessage?: (
    message: { id: string; resultId: string; nodeId: string; data?: any },
    query?: string,
    contextItems?: any[],
  ) => void;
  onGenerateMessageIds?: () => { resultId: string; nodeId: string };
  tplConfig?: SkillTemplateConfig | null;
  onUpdateTplConfig?: (config: SkillTemplateConfig | null) => void;
  resultId?: string;
}

export const ChatPanel = ({
  embeddedMode = false,
  onAddMessage,
  onGenerateMessageIds,
  tplConfig: initialTplConfig,
  onUpdateTplConfig,
  resultId = ContextTarget.Global,
}: ChatPanelProps) => {
  const { t } = useTranslation();
  const { formErrors, setFormErrors } = useContextPanelStore((state) => ({
    formErrors: state.formErrors,
    setFormErrors: state.setFormErrors,
  }));

  // stores
  const userProfile = useUserStoreShallow((state) => state.userProfile);
  const { selectedSkill, setSelectedSkill } = useSkillStoreShallow((state) => ({
    selectedSkill: state.selectedSkill,
    setSelectedSkill: state.setSelectedSkill,
  }));
  const { contextItems, setContextItems, filterErrorInfo, runtimeConfig, setRuntimeConfig } =
    useContextPanelStoreShallow((state) => ({
      contextItems: state.contextItems,
      setContextItems: state.setContextItems,
      filterErrorInfo: state.filterErrorInfo,
      runtimeConfig: state.runtimeConfig,
      setRuntimeConfig: state.setRuntimeConfig,
    }));
  const chatStore = useChatStoreShallow((state) => ({
    newQAText: state.newQAText,
    setNewQAText: state.setNewQAText,
    selectedModel: state.selectedModel,
    setSelectedModel: state.setSelectedModel,
  }));
  const { projectId, handleProjectChange, getFinalProjectId } = useAskProject();

  // Get setActiveResultId from context panel store
  const { setActiveResultId } = useContextPanelStoreShallow((state) => ({
    setActiveResultId: state.setActiveResultId,
  }));

  // 获取选择的 MCP 服务器
  const { selectedMcpServers } = useLaunchpadStoreShallow((state) => ({
    selectedMcpServers: state.selectedMcpServers,
  }));

  const [form] = Form.useForm();

  // hooks
  const { canvasId, readonly } = useCanvasContext();
  const { handleFilterErrorTip } = useContextFilterErrorTip();
  const { addNode } = useAddNode();
  const { invokeAction, abortAction } = useInvokeAction();
  const { handleUploadImage, handleUploadMultipleImages } = useUploadImage();

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setActiveResultId(resultId);
  }, [resultId, setActiveResultId]);

  // automatically sync selected nodes to context
  useSyncSelectedNodesToContext();

  useEffect(() => {
    if (!selectedSkill?.configSchema?.items?.length) {
      form.setFieldValue('tplConfig', undefined);
    } else {
      // Create a new config object
      const newConfig = {};

      // Process each item in the schema
      for (const item of selectedSkill?.configSchema?.items || []) {
        const key = item.key;

        // Priority 0: Use external tplConfig if provided
        if (initialTplConfig && initialTplConfig[key] !== undefined) {
          newConfig[key] = initialTplConfig[key];
        }
        // Priority 1: Check if the key exists in selectedSkill.tplConfig
        else if (selectedSkill?.tplConfig && selectedSkill.tplConfig[key] !== undefined) {
          newConfig[key] = selectedSkill.tplConfig[key];
        }
        // Priority 2: Fall back to schema default value
        else if (item.defaultValue !== undefined) {
          newConfig[key] = {
            value: item.defaultValue,
            label: item.labelDict?.en ?? item.key,
            displayValue: String(item.defaultValue),
          };
        }
      }

      // Set the form value with the properly prioritized config
      form.setFieldValue('tplConfig', newConfig);
    }
  }, [selectedSkill, form, initialTplConfig]);

  const handleSendMessage = (userInput?: string) => {
    // Set active resultId when sending a message
    setActiveResultId(resultId);

    const error = handleFilterErrorTip();
    if (error) {
      return;
    }

    const { formErrors } = useContextPanelStore.getState();
    if (formErrors && Object.keys(formErrors).length > 0) {
      notification.error({
        message: t('copilot.configManager.errorTipTitle'),
        description: t('copilot.configManager.errorTip'),
      });
      return;
    }

    const tplConfig = form?.getFieldValue('tplConfig');

    // Update external tplConfig if available
    if (onUpdateTplConfig) {
      onUpdateTplConfig(tplConfig);
    }

    const { selectedSkill } = useSkillStore.getState();
    const { newQAText, selectedModel } = useChatStore.getState();
    const query = userInput || newQAText.trim();

    const { contextItems, runtimeConfig } = useContextPanelStore.getState();

    const finalProjectId = getFinalProjectId();

    // Generate new message IDs using the provided function
    const { resultId: newResultId, nodeId } = onGenerateMessageIds?.() ?? {
      resultId: genActionResultID(),
      nodeId: genUniqueId(),
    };

    // Call onAddMessage callback with all required data
    if (onAddMessage) {
      onAddMessage(
        {
          id: resultId,
          resultId: newResultId,
          nodeId,
          data: {
            title: query,
            entityId: newResultId,
            metadata: {
              status: 'executing' as ActionStatus,
              contextItems: contextItems.map((item) => omit(item, ['isPreview'])),
              selectedSkill,
              selectedMcpServers,
              modelInfo: selectedModel,
              runtimeConfig,
              tplConfig,
              structuredData: {
                query,
              },
              projectId: finalProjectId,
            },
          },
        },
        query,
        contextItems,
      );
    }

    chatStore.setNewQAText('');

    // Invoke the action with the API
    invokeAction(
      {
        query,
        resultId: newResultId,
        selectedSkill,
        modelInfo: selectedModel,
        contextItems,
        tplConfig,
        runtimeConfig,
        projectId: finalProjectId,
      },
      {
        entityType: 'canvas',
        entityId: canvasId,
      },
    );

    // Create node in the canvas
    const nodeFilters = [...convertContextItemsToNodeFilters(contextItems)];

    // Add node to canvas
    addNode(
      {
        type: 'skillResponse',
        data: {
          title: query,
          entityId: newResultId,
          metadata: {
            status: 'executing',
            contextItems: contextItems.map((item) => omit(item, ['isPreview'])),
            selectedMcpServers,
            selectedSkill,
            modelInfo: selectedModel,
            runtimeConfig,
            tplConfig,
            structuredData: {
              query,
            },
          },
        },
        id: nodeId,
      },
      nodeFilters,
      false,
      true,
    );
  };

  const handleAbort = () => {
    abortAction();
  };

  const { setRecommendQuestionsOpen, recommendQuestionsOpen } = useLaunchpadStoreShallow(
    (state) => ({
      setRecommendQuestionsOpen: state.setRecommendQuestionsOpen,
      recommendQuestionsOpen: state.recommendQuestionsOpen,
    }),
  );

  const handleRecommendQuestionsToggle = useCallback(() => {
    setRecommendQuestionsOpen(!recommendQuestionsOpen);
  }, [recommendQuestionsOpen, setRecommendQuestionsOpen]);

  const [mcpSelectorOpen, setMcpSelectorOpen] = useState<boolean>(false);

  // Toggle MCP selector panel
  const handleMcpSelectorToggle = useCallback(() => {
    setMcpSelectorOpen(!mcpSelectorOpen);
  }, [mcpSelectorOpen, setMcpSelectorOpen]);

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: (
          <Badge
            count={selectedMcpServers.length > 0 ? selectedMcpServers.length : 0}
            size="small"
            offset={[2, -2]}
          >
            <ToolOutlined className="flex items-center" />
          </Badge>
        ),
        title: t('copilot.chatActions.chooseMcp'),
        onClick: () => {
          handleMcpSelectorToggle();
        },
      },
      {
        icon: <PiMagicWand className="flex items-center" />,
        title: t('copilot.chatActions.recommendQuestions'),
        onClick: () => {
          handleRecommendQuestionsToggle();
        },
      },
    ],
    [
      handleRecommendQuestionsToggle,
      handleMcpSelectorToggle,
      t,
      selectedMcpServers,
      handleMcpSelectorToggle,
    ],
  );

  const handleImageUpload = async (file: File) => {
    // Set active resultId when uploading an image
    setActiveResultId(resultId);

    const nodeData = await handleUploadImage(file, canvasId);
    const { contextItems: oldContextItems } = useContextPanelStore.getState();
    if (nodeData) {
      setContextItems([
        ...oldContextItems,
        {
          type: 'image',
          ...nodeData,
        },
      ]);
    }
  };

  const handleMultipleImagesUpload = async (files: File[]) => {
    // Set active resultId when uploading images
    setActiveResultId(resultId);

    const nodesData = await handleUploadMultipleImages(files, canvasId);
    if (nodesData?.length) {
      const newContextItems = nodesData.map((nodeData) => ({
        type: 'image' as const,
        ...nodeData,
      }));

      setContextItems([...contextItems, ...newContextItems]);
    }
  };

  return (
    <>
      <div className="relative w-full" data-cy="launchpad-chat-panel">
        <div
          className={cn(
            'ai-copilot-chat-container chat-input-container rounded-[7px] overflow-hidden',
            embeddedMode && 'embedded-chat-panel border !border-gray-100 dark:!border-gray-700',
          )}
        >
          <McpSelectorPanel isOpen={mcpSelectorOpen} onClose={() => setMcpSelectorOpen(false)} />

          <SelectedSkillHeader
            skill={selectedSkill}
            setSelectedSkill={setSelectedSkill}
            onClose={() => setSelectedSkill(null)}
          />
          {subscriptionEnabled && !userProfile?.subscription && <PremiumBanner />}
          <div
            className={cn(
              'px-3 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800',
              embeddedMode && 'px-2 bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800',
            )}
          >
            <ContextManager
              className="py-2"
              contextItems={contextItems}
              setContextItems={setContextItems}
              filterErrorInfo={filterErrorInfo}
            />

            <div>
              <ChatInput
                readonly={readonly}
                query={chatStore.newQAText}
                setQuery={chatStore.setNewQAText}
                selectedSkillName={selectedSkill?.name}
                autoCompletionPlacement={'topLeft'}
                handleSendMessage={handleSendMessage}
                onUploadImage={handleImageUpload}
                onUploadMultipleImages={handleMultipleImagesUpload}
                onFocus={handleInputFocus}
              />
            </div>

            {selectedSkill?.configSchema?.items?.length ? (
              <ConfigManager
                readonly={readonly}
                key={selectedSkill?.name}
                form={form}
                formErrors={formErrors}
                setFormErrors={setFormErrors}
                tplConfig={initialTplConfig}
                onFormValuesChange={(_, allValues) => {
                  // Debounce form value changes to prevent cascading updates
                  const newConfig = allValues.tplConfig;
                  if (JSON.stringify(newConfig) !== JSON.stringify(initialTplConfig)) {
                    onUpdateTplConfig?.(newConfig);
                  }
                }}
                schema={selectedSkill?.configSchema}
                fieldPrefix="tplConfig"
                configScope="runtime"
                resetConfig={() => {
                  if (selectedSkill?.tplConfig) {
                    form.setFieldValue('tplConfig', selectedSkill.tplConfig);
                  } else {
                    const defaultConfig = {};
                    for (const item of selectedSkill?.configSchema?.items || []) {
                      if (item.defaultValue !== undefined) {
                        defaultConfig[item.key] = {
                          value: item.defaultValue,
                          label: item.labelDict?.en ?? item.key,
                          displayValue: String(item.defaultValue),
                        };
                      }
                    }
                    form.setFieldValue('tplConfig', defaultConfig);
                  }
                }}
              />
            ) : null}

            <ChatActions
              className="py-2"
              query={chatStore.newQAText}
              model={chatStore.selectedModel}
              setModel={chatStore.setSelectedModel}
              runtimeConfig={runtimeConfig}
              setRuntimeConfig={setRuntimeConfig}
              form={form}
              handleSendMessage={handleSendMessage}
              handleAbort={handleAbort}
              customActions={customActions}
              onUploadImage={handleImageUpload}
              contextItems={contextItems}
            />
          </div>
        </div>
      </div>
      <ProjectKnowledgeToggle
        projectSelectorClassName="max-w-[150px]"
        className="!pb-0"
        currentProjectId={projectId}
        onProjectChange={handleProjectChange}
      />
    </>
  );
};
