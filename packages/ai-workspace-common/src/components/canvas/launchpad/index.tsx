import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { notification } from 'antd';
import { Form } from '@arco-design/web-react';

import { ChatInput } from './chat-input';
import { SkillDisplay } from './skill-display';
import { ChatHistory } from './chat-history';

// stores
import { useSkillStoreShallow } from '@refly-packages/ai-workspace-common/stores/skill';
import { useContextPanelStore } from '@refly-packages/ai-workspace-common/stores/context-panel';
import {
  useChatStore,
  MessageIntentContext,
  useChatStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/chat';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';

// types
import { editorEmitter, InPlaceSendMessagePayload } from '@refly-packages/utils/event-emitter/editor';
import { LOCALE } from '@refly/common-types';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/use-invoke-action';
import { useContextFilterErrorTip } from './context-manager/hooks/use-context-filter-errror-tip';
import { InvokeSkillRequest } from '@refly/openapi-schema';
import { genActionResultID } from '@refly-packages/utils/id';
import { useCanvasControl } from '@refly-packages/ai-workspace-common/hooks/use-canvas-control';
import { useChatHistory } from './hooks/use-chat-history';
import { convertContextItemsToContext } from '@refly-packages/ai-workspace-common/utils/map-context-items';
import { RecommendQuestionsPanel } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/recommend-questions-panel';

export const LaunchPad = () => {
  const { t } = useTranslation();

  // stores
  const skillStore = useSkillStoreShallow((state) => ({
    selectedSkill: state.selectedSkill,
  }));
  const chatStore = useChatStoreShallow((state) => ({
    setNewQAText: state.setNewQAText,
    setMessageIntentContext: state.setMessageIntentContext,
  }));

  const [form] = Form.useForm();

  // hooks
  const { handleFilterErrorTip } = useContextFilterErrorTip();
  const { invokeAction, abortAction } = useInvokeAction();
  const { canvasId } = useCanvasContext();

  // Replace chat history related code with hook
  const {
    chatHistoryOpen,
    setChatHistoryOpen,
    historyItems,
    clearHistoryItems,
    handleItemClick,
    handleItemPin,
    handleItemDelete,
  } = useChatHistory();

  const { recommendQuestionsOpen, setRecommendQuestionsOpen } = useLaunchpadStoreShallow((state) => ({
    recommendQuestionsOpen: state.recommendQuestionsOpen,
    setRecommendQuestionsOpen: state.setRecommendQuestionsOpen,
  }));

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

    invokeAction(param);
  };

  const handleAbort = () => {
    abortAction();
  };

  const handleInPlaceEditSendMessage = (data: InPlaceSendMessagePayload) => {
    const { canvasEditConfig, userInput, inPlaceActionType } = data;
    const { localSettings } = useUserStore.getState();
    const locale = localSettings?.uiLocale || LOCALE.EN;

    const { messageIntentContext } = useChatStore.getState();
    let newUserInput = userInput;

    // TODO: temp handle in frontend: 1) edit need set canvasEditConfig 2) chat for normal chat
    const isEditAction = inPlaceActionType === 'edit';
    let newMessageIntentContext: Partial<MessageIntentContext> = {
      ...(messageIntentContext || {}),
      inPlaceActionType,
    };

    if (isEditAction) {
      newMessageIntentContext = {
        ...(newMessageIntentContext || {}),
        canvasEditConfig,
      };
    } else {
      const { selection } = canvasEditConfig || {};
      const selectedText = selection?.highlightedText || '';

      if (selectedText) {
        newUserInput =
          `> ${locale === LOCALE.EN ? '**User Selected Text:** ' : '**用户选中的文本:** '} ${selectedText}` +
          `\n\n` +
          `${locale === LOCALE.EN ? '**Please answer question based on the user selected text:** ' : '**请根据用户选中的文本回答问题:** '} ${userInput}`;
      }
    }

    chatStore.setMessageIntentContext(newMessageIntentContext as MessageIntentContext);
    handleSendMessage(newUserInput);
  };

  useEffect(() => {
    editorEmitter.on('inPlaceSendMessage', handleInPlaceEditSendMessage);

    return () => {
      editorEmitter.off('inPlaceSendMessage', handleInPlaceEditSendMessage);
    };
  }, []);

  return (
    <div className="ai-copilot-operation-container">
      <div className="ai-copilot-operation-body">
        <SkillDisplay />
        <ChatHistory
          isOpen={chatHistoryOpen}
          onClose={() => setChatHistoryOpen(false)}
          items={historyItems}
          onCleanup={clearHistoryItems}
          onItemClick={handleItemClick}
          onItemPin={handleItemPin}
          onItemDelete={handleItemDelete}
        />
        <RecommendQuestionsPanel isOpen={recommendQuestionsOpen} onClose={() => setRecommendQuestionsOpen(false)} />
        <ChatInput form={form} handleSendMessage={handleSendMessage} handleAbort={handleAbort} />
      </div>
    </div>
  );
};
