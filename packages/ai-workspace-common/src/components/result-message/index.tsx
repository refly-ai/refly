import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionMessage, ActionResult } from '@refly/openapi-schema';
import { useActionResultStoreShallow } from '@refly/stores';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import ToolCall from '@refly-packages/ai-workspace-common/components/markdown/plugins/tool-call/render';
import { ReasoningContentPreview } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/reasoning-content-preview';
import { ThinkingDots } from '@refly-packages/ai-workspace-common/components/common/thinking-dots';
import { FailureNotice } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response/failure-notice';

interface AIMessageCardProps {
  message: ActionMessage;
  resultId: string;
  stepStatus: 'executing' | 'finish';
}

interface ToolMessageCardProps {
  message: ActionMessage;
}

interface MessageListProps {
  result: ActionResult;
  stepStatus: 'executing' | 'finish';
  handleRetry?: () => void;
}

/**
 * Render AI message with markdown content
 */
export const AIMessageCard = memo(({ message, resultId, stepStatus }: AIMessageCardProps) => {
  const content = message.content ?? '';
  const reasoningContent = message.reasoningContent ?? '';
  const hasReasoningContent = Boolean(reasoningContent?.trim());

  if (!content?.trim()) return null;

  return (
    <div className="my-2 px-3 text-base">
      <div className={`skill-response-content-${resultId}-${message.messageId}`}>
        {hasReasoningContent && (
          <ReasoningContentPreview
            content={reasoningContent}
            stepStatus={stepStatus}
            className="my-3"
            resultId={resultId}
          />
        )}
        <Markdown content={content} resultId={resultId} />
      </div>
    </div>
  );
});
AIMessageCard.displayName = 'AIMessageCard';

/**
 * Render tool message using ToolCall component
 */
export const ToolMessageCard = memo(({ message }: ToolMessageCardProps) => {
  const toolCallMeta = message.toolCallMeta;
  const toolCallResult = message.toolCallResult;

  // Parse content to get arguments and result
  // For tool messages, content might contain the result
  const toolProps = useMemo(
    () => ({
      'data-tool-name': toolCallMeta?.toolName ?? 'unknown',
      'data-tool-toolset-key': toolCallMeta?.toolsetKey ?? 'unknown',
      'data-tool-call-id': toolCallMeta?.toolCallId ?? message.toolCallId ?? '',
      'data-tool-call-status': toolCallResult?.status ?? toolCallMeta?.status ?? 'executing',
      'data-tool-created-at': String(
        toolCallMeta?.startTs ?? new Date(toolCallResult?.createdAt ?? 0).getTime(),
      ),
      'data-tool-updated-at': String(
        toolCallMeta?.endTs ?? new Date(toolCallResult?.updatedAt ?? 0).getTime(),
      ),
      'data-tool-arguments': JSON.stringify(toolCallResult?.input),
      'data-tool-result': JSON.stringify(toolCallResult?.output),
      'data-tool-error': toolCallMeta?.error,
    }),
    [toolCallMeta, message, toolCallResult],
  );

  return (
    <div className="my-2">
      <ToolCall {...toolProps} />
    </div>
  );
});
ToolMessageCard.displayName = 'ToolMessageCard';

/**
 * Render message list based on message type
 */
export const MessageList = memo(({ result, stepStatus, handleRetry }: MessageListProps) => {
  const { resultId, messages = [], status } = result ?? {};

  const { t } = useTranslation();
  const { streamChoked } = useActionResultStoreShallow((state) => ({
    streamChoked: resultId ? state.streamChoked[resultId] : false,
  }));

  if (!result) {
    return null;
  }

  if (!messages?.length) {
    if (status === 'executing' || status === 'waiting') {
      return (
        <div className="my-4 mx-2 px-1 flex items-center gap-1 text-gray-500">
          <ThinkingDots label={t('common.thinking')} />
        </div>
      );
    }
    if (status === 'failed') {
      return <FailureNotice result={result} />;
    }
    return null;
  }

  return (
    <div className="flex flex-col">
      {messages.map((message) => {
        if (message.type === 'ai') {
          return (
            <AIMessageCard
              key={message.messageId}
              message={message}
              resultId={resultId}
              stepStatus={stepStatus}
            />
          );
        }
        if (message.type === 'tool') {
          return <ToolMessageCard key={message.messageId} message={message} />;
        }
        return null;
      })}
      {(status === 'executing' || status === 'waiting') && streamChoked && (
        <div className="my-4 mx-2 px-1 flex items-center gap-1 text-gray-500">
          <ThinkingDots />
        </div>
      )}
      {status === 'failed' && <FailureNotice result={result} handleRetry={handleRetry} />}
    </div>
  );
});
MessageList.displayName = 'MessageList';
