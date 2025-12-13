import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import cn from 'classnames';
import { Skeleton } from 'antd';
import { useGetCopilotSessionDetail } from '@refly-packages/ai-workspace-common/queries';
import { useActionResultStoreShallow, useCopilotStoreShallow } from '@refly/stores';
import { Greeting } from './greeting';
import { CopilotMessage } from './copilot-message';

interface SessionDetailProps {
  sessionId: string;
  setQuery: (query: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  isUserScrollingUp: boolean;
  setIsUserScrollingUp: (isUserScrollingUp: boolean) => void;
}

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
                sessionId={sessionId}
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
