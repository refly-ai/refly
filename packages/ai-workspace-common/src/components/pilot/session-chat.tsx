import { Input, Button, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { SendOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import { CreatePilotSessionRequest } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { usePilotStoreShallow } from '@refly-packages/ai-workspace-common/stores/pilot';
import { useAbortAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-abort-action';

export const SessionChat = ({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const { abortAction } = useAbortAction();
  const { setActiveSessionId } = usePilotStoreShallow((state) => ({
    setActiveSessionId: state.setActiveSessionId,
  }));

  const handleCreatePilotSession = useCallback(async (param: CreatePilotSessionRequest) => {
    setLoading(true);
    const { data, error } = await getClient().createPilotSession({
      body: param,
    });
    if (error) {
      message.error(
        t('pilot.createPilotSessionFailed', {
          defaultValue: 'Failed to create pilot session',
        }),
      );
      return;
    }

    if (data.data?.sessionId) {
      setActiveSessionId(data.data?.sessionId);
      setSessionId(data.data?.sessionId);
    } else {
      message.error(
        t('pilot.createPilotSessionFailed', {
          defaultValue: 'Failed to create pilot session',
        }),
      );
    }
    setLoading(false);
  }, []);

  const handleSend = () => {
    handleCreatePilotSession({
      targetId: canvasId,
      targetType: 'canvas',
      title: inputValue,
      input: { query: inputValue },
      maxEpoch: 3,
      providerItemId: skillSelectedModel.providerItemId,
    });
  };

  const handleAbort = () => {
    abortAction(sessionId);
    setLoading(false);
    setSessionId('');
  };

  const { skillSelectedModel, setSkillSelectedModel } = useChatStoreShallow((state) => ({
    skillSelectedModel: state.skillSelectedModel,
    setSkillSelectedModel: state.setSkillSelectedModel,
  }));
  return (
    <div className="w-full ring-1 ring-gray-200 dark:ring-gray-700 rounded-lg p-2">
      <Input.TextArea
        className="border-none"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={t('pilot.sessionInputPlaceholder', {
          defaultValue: 'Ask a question...',
        })}
        autoSize={{ minRows: 1, maxRows: 6 }}
      />
      <div className="mt-2 flex items-center justify-between">
        <ModelSelector model={skillSelectedModel} setModel={setSkillSelectedModel} />
        {loading ? (
          <Button
            size="small"
            type="default"
            className="text-[11px] flex items-center gap-1 h-5 font-medium border-red-200 text-red-600 hover:border-red-300 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:border-red-700 dark:hover:text-red-300 dark:bg-red-950/20 dark:hover:bg-red-900/30 shadow-sm hover:shadow-md transition-all duration-200"
            onClick={handleAbort}
          >
            <span>{t('copilot.chatActions.stop')}</span>
          </Button>
        ) : (
          <Button
            size="small"
            type="primary"
            disabled={!inputValue}
            className="text-[11px] flex items-center gap-1 h-5"
            onClick={handleSend}
          >
            <SendOutlined className="h-3 w-3 flex items-center" />
            <span>{t('copilot.chatActions.send')}</span>
          </Button>
        )}
      </div>
    </div>
  );
};
