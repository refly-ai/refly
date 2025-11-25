import { memo, useEffect, useMemo, useRef, useCallback } from 'react';
import { Divider, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { Thinking } from 'refly-icons';
import { ActionResult, GenericToolset } from '@refly/openapi-schema';
// import { ActionContainer } from './action-container';
import { ActionStepCard } from './action-step';
import { FailureNotice } from './failure-notice';
import EmptyImage from '@refly-packages/ai-workspace-common/assets/noResource.svg';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';

interface LastRunTabProps {
  loading: boolean;
  isStreaming: boolean;
  resultId: string;
  result?: ActionResult;
  outputStep?: ActionResult['steps'][number];
  statusText: string;
  query?: string | null;
  title?: string;
  nodeId: string;
  selectedToolsets: GenericToolset[];
  handleRetry: () => void;
}

const LastRunTabComponent = ({
  loading,
  isStreaming,
  resultId,
  result,
  outputStep,
  statusText,
  query,
  title,
  handleRetry,
}: LastRunTabProps) => {
  const { t } = useTranslation();
  const displayQuery = useMemo(() => query ?? title ?? '', [query, title]);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const isAtBottomRef = useRef(true);
  const isScrolledToBottom = useCallback((container: HTMLElement) => {
    const threshold = 50;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  const handleContainerScroll = useCallback(() => {
    const container = previewContainerRef.current;
    if (!container) {
      return;
    }

    const currentScrollTop = container.scrollTop;
    const atBottom = isScrolledToBottom(container);

    if (currentScrollTop < lastScrollTopRef.current) {
      isAtBottomRef.current = false;
    }

    if (atBottom) {
      isAtBottomRef.current = true;
    }

    lastScrollTopRef.current = currentScrollTop;
  }, [isScrolledToBottom]);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) {
      return;
    }

    container.addEventListener('scroll', handleContainerScroll);
    lastScrollTopRef.current = container.scrollTop;
    isAtBottomRef.current = isScrolledToBottom(container);

    return () => {
      container.removeEventListener('scroll', handleContainerScroll);
    };
  }, [resultId, handleContainerScroll, isScrolledToBottom]);

  const handleUpdateResult = useCallback(
    (event: { resultId: string; payload: ActionResult }) => {
      if (event.resultId !== resultId) {
        return;
      }

      if (!isAtBottomRef.current) {
        return;
      }

      const container = previewContainerRef.current;
      if (!container) {
        return;
      }

      window.requestAnimationFrame(() => {
        const { scrollHeight, clientHeight } = container;
        container.scroll({
          behavior: 'smooth',
          top: scrollHeight - clientHeight + 50,
        });
      });
    },
    [resultId],
  );

  useEffect(() => {
    actionEmitter.on('updateResult', handleUpdateResult);
    return () => {
      actionEmitter.off('updateResult', handleUpdateResult);
    };
  }, [handleUpdateResult]);

  return (
    <div className="h-full w-full flex flex-col mb-4">
      <div
        ref={previewContainerRef}
        className="flex-1 overflow-auto last-run-preview-container transition-opacity duration-500 px-4"
      >
        {!result && !loading ? (
          <div className="h-full w-full flex flex-col items-center justify-center">
            <img src={EmptyImage} alt="no content" className="w-[180px] h-[180px] -mb-4" />
            <div className="text-sm text-refly-text-2 leading-5">{t('agent.noResult')}</div>
          </div>
        ) : (
          <>
            {loading && !isStreaming && (
              <Skeleton className="mt-1" active paragraph={{ rows: 5 }} />
            )}
            {(result?.status === 'executing' || result?.status === 'waiting') &&
              !outputStep &&
              statusText && (
                <div className="flex flex-col gap-2 animate-pulse">
                  <Divider dashed className="my-2" />
                  <div className="m-2 flex items-center gap-1 text-gray-500">
                    <Thinking size={16} />
                    <span className="text-sm">{statusText}</span>
                  </div>
                </div>
              )}
            {outputStep && (
              <ActionStepCard
                result={result}
                step={outputStep}
                status={result?.status}
                query={displayQuery}
              />
            )}
            {result?.status === 'failed' && !loading && (
              <FailureNotice result={result} handleRetry={handleRetry} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const LastRunTab = memo(LastRunTabComponent);
LastRunTab.displayName = 'LastRunTab';
