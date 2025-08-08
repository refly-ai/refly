import { Input, Button, message, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { useChatStoreShallow } from '@refly/stores';
import { SendOutlined } from '@ant-design/icons';
import { useCallback, useState } from 'react';
import { CreatePilotSessionRequest } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { usePilotStoreShallow } from '@refly/stores';
import { useAbortAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-abort-action';
import { serverOrigin } from '@refly/ui-kit';

export const SessionChat = ({ canvasId }: { canvasId: string }) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [isDivergentMode, setIsDivergentMode] = useState(false);
  const [maxDivergence, setMaxDivergence] = useState(4);
  const [maxDepth, setMaxDepth] = useState(3);
  const { abortAction } = useAbortAction({ source: 'session-chat' });
  const { setActiveSessionId } = usePilotStoreShallow((state) => ({
    setActiveSessionId: state.setActiveSessionId,
  }));

  // Handle divergent session creation
  const handleCreateDivergentSession = useCallback(
    async (prompt: string) => {
      setLoading(true);
      try {
        const response = await fetch(`${serverOrigin}/v1/pilot/divergent/session/new`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            mode: 'divergent',
            prompt: prompt,
            maxDivergence: maxDivergence,
            maxDepth: maxDepth,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create divergent session');
        }

        const result = await response.json();
        if (result?.success && result?.data?.sessionId) {
          setActiveSessionId(result.data.sessionId);
          setSessionId(result.data.sessionId);
          message.success(
            t('pilot.divergentSessionCreated', {
              defaultValue: 'Divergent session created successfully!',
            }),
          );
        } else {
          throw new Error(result?.message || 'Failed to create divergent session');
        }
      } catch (error) {
        console.error('Error creating divergent session:', error);
        message.error(
          t('pilot.createDivergentSessionFailed', {
            defaultValue: 'Failed to create divergent session',
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [maxDivergence, maxDepth, setActiveSessionId, t],
  );

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

    const sessionId = data?.data?.sessionId;
    if (sessionId) {
      setActiveSessionId(sessionId);
      setSessionId(sessionId);
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
    if (!inputValue.trim()) return;

    if (isDivergentMode) {
      handleCreateDivergentSession(inputValue.trim());
    } else {
      handleCreatePilotSession({
        targetId: canvasId,
        targetType: 'canvas',
        title: inputValue,
        input: { query: inputValue },
        maxEpoch: 3,
        providerItemId: skillSelectedModel?.providerItemId,
      });
    }
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
      <div className="mt-2 space-y-2">
        {/* Mode Selection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {t('pilot.divergentMode', { defaultValue: 'Divergent Mode' })}
            </span>
            <Switch
              size="small"
              checked={isDivergentMode}
              onChange={setIsDivergentMode}
              className="bg-gray-300 dark:bg-gray-600"
            />
          </div>
          {isDivergentMode && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-400">Max:</span>
              <input
                type="number"
                min="1"
                max="8"
                value={maxDivergence}
                onChange={(e) => setMaxDivergence(Number.parseInt(e.target.value) || 4)}
                className="w-8 h-5 text-center border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
              <span className="text-gray-600 dark:text-gray-400">Depth:</span>
              <input
                type="number"
                min="1"
                max="5"
                value={maxDepth}
                onChange={(e) => setMaxDepth(Number.parseInt(e.target.value) || 3)}
                className="w-8 h-5 text-center border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800"
              />
            </div>
          )}
        </div>

        {/* Control Bar */}
        <div className="flex items-center justify-between">
          {!isDivergentMode && (
            <ModelSelector model={skillSelectedModel} setModel={setSkillSelectedModel} />
          )}
          {isDivergentMode && (
            <div className="text-xs text-blue-600 dark:text-blue-400">
              {t('pilot.divergentModeHint', {
                defaultValue: 'AI will explore multiple approaches in parallel',
              })}
            </div>
          )}
          {loading ? (
            <Button
              size="small"
              type="default"
              className="text-[11px] flex items-center gap-1 h-5 font-medium border-red-200 text-red-600 hover:border-red-300 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:border-red-700 dark:hover:text-red-300 dark:bg-red-950/20 dark:hover:bg-red-900/30 shadow-sm hover:shadow-refly-m transition-all duration-200"
              onClick={handleAbort}
            >
              <span>{t('copilot.chatActions.stop')}</span>
            </Button>
          ) : (
            <Button
              size="small"
              type="primary"
              disabled={!inputValue.trim()}
              className="text-[11px] flex items-center gap-1 h-5"
              onClick={handleSend}
            >
              <SendOutlined className="h-3 w-3 flex items-center" />
              <span>
                {isDivergentMode
                  ? t('pilot.startDivergent', { defaultValue: 'Start Divergent' })
                  : t('copilot.chatActions.send')}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
