import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import cn from 'classnames';
import { Skeleton, Divider, Button, Modal } from 'antd';
import {
  useGetCopilotSessionDetail,
  useListTools,
} from '@refly-packages/ai-workspace-common/queries';
import {
  useActionResultStoreShallow,
  useCanvasResourcesPanelStoreShallow,
  useCopilotStoreShallow,
} from '@refly/stores';
import { ActionResult, CanvasNode } from '@refly/openapi-schema';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { useTranslation } from 'react-i18next';
import { Greeting } from './greeting';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { safeParseJSON } from '@refly/utils/parse';
import { generateCanvasDataFromWorkflowPlan, WorkflowPlan } from '@refly/canvas-common';
import { useReactFlow } from '@xyflow/react';
import { useFetchActionResult } from '@refly-packages/ai-workspace-common/hooks/canvas/use-fetch-action-result';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';

interface SessionDetailProps {
  sessionId: string;
  setQuery: (query: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  isUserScrollingUp: boolean;
  setIsUserScrollingUp: (isUserScrollingUp: boolean) => void;
}

interface CopilotMessageProps {
  result: ActionResult;
  isFinal: boolean;
}

// Typing/thinking indicator with three scaling dots
interface ThinkingDotsProps {
  label: string;
}

const ThinkingDots = memo(({ label }: ThinkingDotsProps) => {
  // Precompute indices to avoid creating arrays on each render
  const dotIndices = useMemo(() => [0, 1, 2], []);

  // Animation delays for each dot
  const delays = useMemo(() => ['0ms', '150ms', '300ms'], []);

  return (
    <div className="flex items-center gap-2">
      <div className="text-refly-text-2">{label}</div>
      <div className="flex items-center gap-1">
        {dotIndices.map((idx) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            className="inline-block h-1.5 w-1.5 rounded-full bg-refly-text-2"
            style={{
              animation: 'rf-dot-pulse 1.2s infinite ease-in-out',
              animationDelay: delays[idx] ?? '0ms',
            }}
          />
        ))}
      </div>
      {/* Local keyframes for dot scaling animation */}
      <style>
        {`
          @keyframes rf-dot-pulse {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.6; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
});
ThinkingDots.displayName = 'ThinkingDots';

const CopilotMessage = memo(({ result, isFinal }: CopilotMessageProps) => {
  const { resultId, input, steps, status } = result;
  const content = steps?.[0]?.content ?? '';

  const workflowPlan = useMemo(() => {
    const toolCalls = steps?.[0]?.toolCalls ?? [];
    const workflowPlanToolCall = toolCalls.find((call) => call.toolName === 'generate_workflow');
    const output = workflowPlanToolCall?.output;

    if (!output) {
      return null;
    }

    // Handle different input formats
    if (typeof output === 'string') {
      return safeParseJSON(output);
    }

    // If input is already the parsed object
    return (output as { data: WorkflowPlan })?.data;
  }, [steps]);

  const { fetchActionResult } = useFetchActionResult();

  useEffect(() => {
    if (status === 'finish' && resultId) {
      fetchActionResult(resultId, { silent: true });
    }
  }, [status, resultId, fetchActionResult]);

  const { canvasId } = useCanvasContext();
  const { t } = useTranslation();
  const [modal, contextHolder] = Modal.useModal();

  const isThinking = useMemo(() => {
    return ['waiting', 'executing'].includes(status ?? '') && !content;
  }, [status, content]);

  const { data: tools } = useListTools({ query: { enabled: true } }, undefined, {
    enabled: !!canvasId,
  });

  const { getNodes, setNodes, setEdges } = useReactFlow();
  const { setVariables } = useVariablesManagement(canvasId);

  const { setShowWorkflowRun } = useCanvasResourcesPanelStoreShallow((state) => ({
    setShowWorkflowRun: state.setShowWorkflowRun,
  }));

  const handleApprove = useCallback(async () => {
    if (!workflowPlan) {
      return;
    }

    // Check current canvas nodes
    const currentNodes = getNodes() as CanvasNode[];
    const startNodes = currentNodes.filter((node) => node.type === 'start');
    const skillNodes = currentNodes.filter((node) => node.type === 'skillResponse');

    // Check if canvas only contains one start node or one start node + one skill node with empty contentPreview
    const shouldSkipConfirmation =
      (currentNodes.length === 1 && startNodes.length === 1) ||
      (currentNodes.length === 2 &&
        startNodes.length === 1 &&
        skillNodes.length === 1 &&
        !skillNodes[0]?.data?.metadata?.query);

    if (!shouldSkipConfirmation) {
      // Show confirmation modal
      const confirmed = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: t('copilot.sessionDetail.confirmClearCanvas.title'),
          content: t('copilot.sessionDetail.confirmClearCanvas.content'),
          okText: t('copilot.sessionDetail.confirmClearCanvas.confirm'),
          cancelText: t('copilot.sessionDetail.confirmClearCanvas.cancel'),
          centered: true,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) {
        return;
      }
    }

    const { nodes, edges, variables } = generateCanvasDataFromWorkflowPlan(
      workflowPlan,
      tools?.data ?? [],
      {
        autoLayout: true,
      },
    );
    setNodes(nodes);
    setEdges(edges);
    setVariables(variables);
    setShowWorkflowRun(true);
  }, [
    canvasId,
    workflowPlan,
    tools?.data,
    getNodes,
    setNodes,
    setEdges,
    t,
    modal,
    setShowWorkflowRun,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* User query - right aligned blue bubble */}
      <div className="flex justify-end pl-5">
        <div className="rounded-xl bg-[#F2FDFF] dark:bg-[#327576] text-refly-text-0 px-4 py-3 text-[15px]">
          {input?.query}
        </div>
      </div>
      {/* AI response - left aligned */}
      {isThinking ? (
        <div className="mt-4">
          <ThinkingDots label={t('copilot.sessionDetail.thinking')} />
        </div>
      ) : (
        <Markdown content={content} mode="readonly" />
      )}
      {workflowPlan && status === 'finish' && (
        <div className="mt-1">
          <Button type="primary" onClick={handleApprove}>
            {t('copilot.sessionDetail.approve')}
          </Button>
        </div>
      )}
      {!isFinal && <Divider type="horizontal" className="my-[10px] bg-refly-Card-Border h-[1px]" />}
      {contextHolder}
    </div>
  );
});
CopilotMessage.displayName = 'CopilotMessage';

export const SessionDetail = memo(
  ({
    sessionId,
    setQuery,
    scrollContainerRef,
    isUserScrollingUp,
    setIsUserScrollingUp,
  }: SessionDetailProps) => {
    const { sessionResultIds, setSessionResultIds, createdCopilotSessionIds } =
      useCopilotStoreShallow((state) => ({
        sessionResultIds: state.sessionResultIds[sessionId],
        setSessionResultIds: state.setSessionResultIds,
        createdCopilotSessionIds: state.createdCopilotSessionIds,
      }));
    const { updateActionResult, resultMap } = useActionResultStoreShallow((state) => ({
      updateActionResult: state.updateActionResult,
      resultMap: state.resultMap,
    }));

    const listRef = useRef<HTMLDivElement | null>(null);
    const isInitialMountRef = useRef(true);
    const lastScrollTopRef = useRef(0);

    const results = useMemo(() => {
      return sessionResultIds?.map((resultId) => resultMap[resultId])?.filter(Boolean) ?? [];
    }, [sessionResultIds, resultMap]);

    const lastResultContent = useMemo(() => {
      return results?.length > 0 ? (results[results.length - 1]?.steps?.[0]?.content ?? '') : '';
    }, [results]);

    const { data, isLoading } = useGetCopilotSessionDetail(
      {
        query: {
          sessionId,
        },
      },
      [sessionId],
      {
        enabled: sessionId && !createdCopilotSessionIds[sessionId],
      },
    );

    useEffect(() => {
      if (data) {
        const results = data.data?.results ?? [];
        setSessionResultIds(sessionId, results.map((result) => result.resultId) ?? []);
        for (const result of results) {
          updateActionResult(result.resultId, result);
        }
      }
    }, [data, updateActionResult, setSessionResultIds, sessionId]);

    // Check if scrolled to bottom
    const isScrolledToBottom = useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        return true;
      }
      const threshold = 50; // Allow 50px threshold for smooth scrolling
      return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
    }, []);

    // Scroll to bottom
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    }, []);

    // Handle scroll event
    const handleScroll = useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }

      const currentScrollTop = container.scrollTop;
      const isAtBottom = isScrolledToBottom();

      // Detect if user is scrolling up manually
      if (currentScrollTop < lastScrollTopRef.current && !isAtBottom) {
        setIsUserScrollingUp(true);
      }

      // Reset flag when scrolled to bottom
      if (isAtBottom) {
        setIsUserScrollingUp(false);
      }

      lastScrollTopRef.current = currentScrollTop;
    }, [isScrolledToBottom]);

    useEffect(() => {
      isInitialMountRef.current = true;
      return () => {
        isInitialMountRef.current = true;
      };
    }, [sessionId]);

    useEffect(() => {
      if (isInitialMountRef.current && results?.length > 0) {
        const timeout = setTimeout(() => {
          scrollToBottom('instant');
          isInitialMountRef.current = false;
        }, 200);
        return () => {
          clearTimeout(timeout);
        };
      }
    }, [results?.length]);

    // Auto scroll when new content arrives (only if user is not scrolling up)
    useEffect(() => {
      if (!isInitialMountRef.current && !isUserScrollingUp && results?.length > 0) {
        const timeout = setTimeout(() => {
          if (!isUserScrollingUp) {
            scrollToBottom('smooth');
          }
        }, 100);
        return () => clearTimeout(timeout);
      }
    }, [lastResultContent, isUserScrollingUp, results?.length, scrollToBottom]);

    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }

      container.addEventListener('scroll', handleScroll);

      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }, [handleScroll]);

    const loadingSkeleton = useMemo(() => {
      return (
        <div className="flex flex-col gap-4">
          <Skeleton title={false} active />
          <Skeleton title={false} active />
          <Skeleton title={false} active />
          <Skeleton title={false} active />
          <Skeleton title={false} active />
          <Skeleton title={false} active />
          <Skeleton title={false} active />
          <Skeleton title={false} active />
          <Skeleton title={false} active />
        </div>
      );
    }, []);

    return (
      <div className={cn('w-full px-4', results?.length === 0 ? 'h-full' : '')}>
        {isLoading ? (
          loadingSkeleton
        ) : results?.length > 0 ? (
          <div ref={listRef} className="flex flex-col gap-4 py-5">
            {results.map((result, index) => (
              <CopilotMessage
                key={result.resultId}
                result={result}
                isFinal={index === results.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Greeting onQueryClick={setQuery} />
          </div>
        )}
      </div>
    );
  },
);

SessionDetail.displayName = 'SessionDetail';
