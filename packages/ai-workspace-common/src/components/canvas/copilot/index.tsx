import { memo, useCallback, useState } from 'react';

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
  const { currentSessionId: sessionId } = useCopilotStoreShallow((state) => ({
    currentSessionId: state.currentSessionId[canvasId] ?? null,
  }));

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

      <div className="flex-grow overflow-y-auto">
        {sessionId ? (
          <SessionDetail sessionId={sessionId} setQuery={setQuery} />
        ) : (
          <Greeting onQueryClick={handleQueryClick} />
        )}
      </div>

      <div className="w-full p-3 pt-2">
        <ChatBox canvasId={canvasId} query={query} setQuery={setQuery} />
      </div>
    </div>
  );
});

Copilot.displayName = 'Copilot';
