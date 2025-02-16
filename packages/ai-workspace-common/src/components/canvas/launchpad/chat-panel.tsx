import { Form } from '@arco-design/web-react';
import { notification, Button } from 'antd';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useContextPanelStore,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useContextFilterErrorTip } from './context-manager/hooks/use-context-filter-errror-tip';
import { genActionResultID } from '@refly-packages/utils/id';
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
import { omit } from '@refly-packages/utils/index';

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
    <div className="flex items-center justify-between px-3 py-0.5 bg-gray-100 border-b">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs text-gray-600 flex-1 whitespace-nowrap">
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

export const ChatPanel = () => {
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
  const { contextItems, setContextItems, filterErrorInfo } = useContextPanelStoreShallow(
    (state) => ({
      contextItems: state.contextItems,
      setContextItems: state.setContextItems,
      filterErrorInfo: state.filterErrorInfo,
    }),
  );
  const skillStore = useSkillStoreShallow((state) => ({
    selectedSkill: state.selectedSkill,
    setSelectedSkill: state.setSelectedSkill,
  }));
  const chatStore = useChatStoreShallow((state) => ({
    newQAText: state.newQAText,
    setNewQAText: state.setNewQAText,
    selectedModel: state.selectedModel,
    setSelectedModel: state.setSelectedModel,
  }));

  const [form] = Form.useForm();

  // hooks
  const { canvasId } = useCanvasContext();
  const { handleFilterErrorTip } = useContextFilterErrorTip();
  const { addNode } = useAddNode();
  const { invokeAction, abortAction } = useInvokeAction();
  const { handleUploadImage } = useUploadImage();

  // automatically sync selected nodes to context
  useSyncSelectedNodesToContext();

  useEffect(() => {
    if (!selectedSkill?.configSchema?.items?.length) {
      form.setFieldValue('tplConfig', undefined);
    } else {
      // Create default config from schema if no config exists
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

      // Use existing config or fallback to default config
      const initialConfig = selectedSkill?.tplConfig ?? defaultConfig;
      form.setFieldValue('tplConfig', initialConfig);
    }
  }, [selectedSkill, form.setFieldValue]);

  const handleSendMessage = (userInput?: string) => {
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

    const { selectedSkill } = useSkillStore.getState();
    const { newQAText, selectedModel } = useChatStore.getState();
    const query = userInput || newQAText.trim();

    const { contextItems } = useContextPanelStore.getState();

    const resultId = genActionResultID();

    chatStore.setNewQAText('');

    // Reset selected skill after sending message
    skillStore.setSelectedSkill(null);
    setContextItems([]);

    invokeAction(
      {
        query,
        resultId,
        selectedSkill,
        modelInfo: selectedModel,
        contextItems,
        tplConfig,
      },
      {
        entityType: 'canvas',
        entityId: canvasId,
      },
    );

    addNode(
      {
        type: 'skillResponse',
        data: {
          title: query,
          entityId: resultId,
          metadata: {
            status: 'executing',
            contextItems: contextItems.map((item) => omit(item, ['isPreview'])),
          },
        },
      },
      convertContextItemsToNodeFilters(contextItems),
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

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: <PiMagicWand className="flex items-center" />,
        title: t('copilot.chatActions.recommendQuestions'),
        onClick: () => {
          handleRecommendQuestionsToggle();
        },
      },
    ],
    [handleRecommendQuestionsToggle, t],
  );

  const handleImageUpload = async (file: File) => {
    const nodeData = await handleUploadImage(file, canvasId);
    if (nodeData) {
      setContextItems([
        ...contextItems,
        {
          type: 'image',
          ...nodeData,
        },
      ]);
    }
  };

  return (
    <div className="relative w-full" data-cy="launchpad-chat-panel">
      <div className="ai-copilot-chat-container">
        <div className="chat-input-container rounded-[7px] overflow-hidden">
          <SelectedSkillHeader
            skill={selectedSkill}
            setSelectedSkill={setSelectedSkill}
            onClose={() => setSelectedSkill(null)}
          />
          {!userProfile?.subscription && <PremiumBanner />}
          <ContextManager
            className="p-2 px-3"
            contextItems={contextItems}
            setContextItems={setContextItems}
            filterErrorInfo={filterErrorInfo}
          />
          <div className="px-3">
            <ChatInput
              query={chatStore.newQAText}
              setQuery={chatStore.setNewQAText}
              selectedSkillName={selectedSkill?.name}
              autoCompletionPlacement={'topLeft'}
              handleSendMessage={handleSendMessage}
              onUploadImage={handleImageUpload}
            />
          </div>

          {selectedSkill?.configSchema?.items?.length > 0 && (
            <ConfigManager
              key={selectedSkill?.name}
              form={form}
              formErrors={formErrors}
              setFormErrors={setFormErrors}
              schema={selectedSkill?.configSchema}
              tplConfig={selectedSkill?.tplConfig}
              fieldPrefix="tplConfig"
              configScope="runtime"
              resetConfig={() => {
                const defaultConfig = selectedSkill?.tplConfig ?? {};
                form.setFieldValue('tplConfig', defaultConfig);
              }}
            />
          )}

          <ChatActions
            className="p-2 px-3"
            query={chatStore.newQAText}
            model={chatStore.selectedModel}
            setModel={chatStore.setSelectedModel}
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
  );
};
