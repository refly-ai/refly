import { Form } from '@arco-design/web-react';
import { notification } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useContextPanelStore,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useContextFilterErrorTip } from './context-manager/hooks/use-context-filter-errror-tip';
import { InvokeSkillRequest } from '@refly/openapi-schema';
import { genActionResultID } from '@refly-packages/utils/id';
import { useChatStore, useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { convertContextItemsToContext } from '@refly-packages/ai-workspace-common/utils/map-context-items';

import { SelectedSkillHeader } from './selected-skill-header';
import { useSkillStoreShallow } from '@refly-packages/ai-workspace-common/stores/skill';
import { ContextManager } from './context-manager';
import { ConfigManager } from './config-manager';
import { ChatActions } from './chat-actions';
import { ChatInput } from './chat-input';
import { useChatHistory } from './hooks/use-chat-history';

import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useSyncSelectedNodesToContext } from '@refly-packages/ai-workspace-common/hooks/canvas/use-sync-selected-nodes-to-context';

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
  const { invokeAction, abortAction } = useInvokeAction();
  const { pinAllHistoryItems } = useChatHistory();

  // automatically sync selected nodes to context
  useSyncSelectedNodesToContext(contextItems, setContextItems);

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

    // Pin all history items before sending new message
    pinAllHistoryItems();

    const { formErrors } = useContextPanelStore.getState();
    if (formErrors && Object.keys(formErrors).length > 0) {
      notification.error({
        message: t('copilot.configManager.errorTipTitle'),
        description: t('copilot.configManager.errorTip'),
      });
      return;
    }

    const tplConfig = form?.getFieldValue('tplConfig');

    const { localSettings } = useUserStore.getState();
    const { newQAText, selectedModel } = useChatStore.getState();
    const { contextItems, historyItems } = useContextPanelStore.getState();

    const resultId = genActionResultID();
    const param: InvokeSkillRequest = {
      resultId,
      input: {
        query: userInput || newQAText.trim(),
      },
      target: {
        entityId: canvasId,
        entityType: 'canvas',
      },
      modelName: selectedModel?.name,
      context: convertContextItemsToContext(contextItems),
      resultHistory: historyItems.map((item) => ({
        resultId: item.data.entityId,
        title: item.data.title,
        steps: item.data.metadata?.steps,
      })),
      skillName: skillStore.selectedSkill?.name,
      locale: localSettings?.outputLocale,
      tplConfig,
    };

    chatStore.setNewQAText('');

    // Reset selected skill after sending message
    skillStore.setSelectedSkill(null);

    invokeAction(param);
  };

  const handleAbort = () => {
    abortAction();
  };

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
          contextItems={contextItems}
          setContextItems={setContextItems}
          filterErrorInfo={filterErrorInfo}
        />
        <ChatInput
          query={chatStore.newQAText}
          setQuery={chatStore.setNewQAText}
          selectedSkill={selectedSkill}
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
          query={chatStore.newQAText}
          model={chatStore.selectedModel}
          setModel={chatStore.setSelectedModel}
          form={form}
          handleSendMessage={handleSendMessage}
          handleAbort={handleAbort}
        />
      </div>
    </div>
  );
};
