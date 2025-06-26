import { memo, useEffect } from 'react';
import { SessionContainer } from './session-container';
import { usePilotStoreShallow } from '@refly-packages/ai-workspace-common/stores/pilot';
import { useListPilotSessions } from '@refly-packages/ai-workspace-common/queries/queries';

export const Pilot = memo(({ canvasId }: { canvasId: string }) => {
  const { activeSessionId, setActiveSessionId } = usePilotStoreShallow((state) => ({
    activeSessionId: state.activeSessionId,
    setActiveSessionId: state.setActiveSessionId,
  }));

  const { data: sessionsData } = useListPilotSessions(
    {
      query: {
        targetId: canvasId,
        targetType: 'canvas',
        page: 1,
        pageSize: 1,
      },
    },
    undefined,
    {
      enabled: !!canvasId && !activeSessionId,
    },
  );

  useEffect(() => {
    if (sessionsData?.data?.length > 0) {
      setActiveSessionId(sessionsData.data[0].sessionId);
    }
  }, [sessionsData, setActiveSessionId]);

  return <SessionContainer sessionId={activeSessionId} canvasId={canvasId} />;
});

Pilot.displayName = 'Pilot';
