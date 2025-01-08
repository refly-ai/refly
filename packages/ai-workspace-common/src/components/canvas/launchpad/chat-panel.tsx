import { Form } from '@arco-design/web-react';
import { notification } from 'antd';
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
import { useSkillStore, useSkillStoreShallow } from '@refly-packages/ai-workspace-common/stores/skill';
import { ContextManager } from './context-manager';
import { ConfigManager } from './config-manager';
import { ChatActions, CustomAction } from './chat-actions';
import { ChatInput } from './chat-input';

import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useSyncSelectedNodesToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-sync-selected-nodes-to-context';
import { PiMagicWand } from 'react-icons/pi';
import { useAddNode } from '@refly-packages/ai-workspace-common/hooks/canvas/use-add-node';
import { convertContextItemsToNodeFilters } from '@refly-packages/ai-workspace-common/utils/map-context-items';

export const ChatPanel = () => {
  const { t } = useTranslation();
  const { formErrors, setFormErrors } = useContextPanelStore((state) => ({
    formErrors: state.formErrors,
    setFormErrors: state.setFormErrors,
  }));

  // stores
  const { selectedSkill, setSelectedSkill } = useSkillStoreShallow((state) => ({
    selectedSkill: state.selectedSkill,
    setSelectedSkill: state.setSelectedSkill,
  }));
  const { contextItems, setContextItems, filterErrorInfo } = useContextPanelStoreShallow((state) => ({
    contextItems: state.contextItems,
    setContextItems: state.setContextItems,
    filterErrorInfo: state.filterErrorInfo,
  }));
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

  // automatically sync selected nodes to context
  useSyncSelectedNodesToContext();

  useEffect(() => {
    if (!selectedSkill?.configSchema?.items?.length) {
      form.setFieldValue('tplConfig', undefined);
    } else {
      // Create default config from schema if no config exists
      const defaultConfig = {};
      selectedSkill?.configSchema?.items?.forEach((item) => {
        if (item.defaultValue !== undefined) {
          defaultConfig[item.key] = {
            value: item.defaultValue,
            label: item.labelDict?.['en'] ?? item.key,
            displayValue: String(item.defaultValue),
          };
        }
      });

      // Use existing config or fallback to default config
      const initialConfig = selectedSkill?.tplConfig ?? defaultConfig;
      form.setFieldValue('tplConfig', initialConfig);
    }
  }, [selectedSkill?.name]);

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
            contextItems,
          },
        },
      },
      convertContextItemsToNodeFilters(contextItems),
    );
  };

  const handleAbort = () => {
    abortAction();
  };

  const { setRecommendQuestionsOpen, recommendQuestionsOpen } = useLaunchpadStoreShallow((state) => ({
    setRecommendQuestionsOpen: state.setRecommendQuestionsOpen,
    recommendQuestionsOpen: state.recommendQuestionsOpen,
  }));

  const handleRecommendQuestionsToggle = useCallback(() => {
    setRecommendQuestionsOpen(!recommendQuestionsOpen);
  }, [recommendQuestionsOpen, setRecommendQuestionsOpen]);

  const customActions: CustomAction[] = useMemo(
    () => [
      {
        icon: <PiMagicWand />,
        title: t('copilot.chatActions.recommendQuestions'),
        onClick: () => {
          handleRecommendQuestionsToggle();
        },
      },
    ],
    [handleRecommendQuestionsToggle],
  );

  return (
    <div className="ai-copilot-chat-container">
      <div className="chat-input-container">
        <SelectedSkillHeader
          skill={selectedSkill}
          setSelectedSkill={setSelectedSkill}
          onClose={() => setSelectedSkill(null)}
          className="rounded-t-[7px]"
        />
        <ContextManager
          className="p-2 px-3"
          contextItems={contextItems}
          setContextItems={setContextItems}
          filterErrorInfo={filterErrorInfo}
        />
        <ChatInput
          query={chatStore.newQAText}
          setQuery={chatStore.setNewQAText}
          selectedSkillName={selectedSkill?.name}
          autoCompletionPlacement={'topLeft'}
          handleSendMessage={handleSendMessage}
        />

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
        />
      </div>
    </div>
  );
};
