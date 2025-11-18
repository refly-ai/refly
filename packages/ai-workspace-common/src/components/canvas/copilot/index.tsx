import { memo, useCallback, useRef, useState } from 'react';

import { ChatBox } from './chat-box';
import { Greeting } from './greeting';
import { SessionDetail } from './session-detail';
import { CopilotHeader } from './copilot-header';

import { useCopilotStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface CopilotProps {
  copilotWidth: number;
  setCopilotWidth: (width: number) => void;
}

export const Copilot = memo(({ copilotWidth, setCopilotWidth }: CopilotProps) => {
  const { canvasId } = useCanvasContext();
  const [query, setQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { currentSessionId: sessionId } = useCopilotStoreShallow((state) => ({
    currentSessionId: state.currentSessionId[canvasId] ?? null,
  }));

  const [isUserScrollingUp, setIsUserScrollingUp] = useState(false);
  const handleScrollBottom = useCallback(() => {
    setIsUserScrollingUp(false);
    scrollContainerRef.current?.scrollTo({
      top: scrollContainerRef.current?.scrollHeight,
      behavior: 'instant',
    });
  }, [setIsUserScrollingUp, scrollContainerRef]);

  const handleQueryClick = useCallback((query: string) => {
    setQuery(query);
  }, []);

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-refly-bg-body">
      <CopilotHeader
        canvasId={canvasId}
        sessionId={sessionId}
        copilotWidth={copilotWidth}
        setCopilotWidth={setCopilotWidth}
      />

      <div ref={scrollContainerRef} className="flex-grow overflow-y-auto">
        {sessionId ? (
          <SessionDetail
            sessionId={sessionId}
            setQuery={setQuery}
            scrollContainerRef={scrollContainerRef}
            isUserScrollingUp={isUserScrollingUp}
            setIsUserScrollingUp={setIsUserScrollingUp}
          />
        ) : (
          <Greeting onQueryClick={handleQueryClick} />
        )}
      </div>

      <div className="w-full p-3 pt-2">
        <ChatBox
          canvasId={canvasId}
          query={query}
          setQuery={setQuery}
          onSendMessage={handleScrollBottom}
        />
      </div>
    </div>
  );
});

Copilot.displayName = 'Copilot';
