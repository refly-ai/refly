import { memo } from 'react';
import { Pilot } from '@refly-packages/ai-workspace-common/components/pilot';
import { usePilotStoreShallow } from '@refly/stores';
import { AgentPanelButton } from './agent-panel-button';

interface PilotControlProps {
  canvasId: string;
}

/**
 * PilotControl component - handles the pilot button and panel display
 * @param canvasId - The current canvas ID
 */
export const PilotControl = memo<PilotControlProps>(({ canvasId }) => {
  const { isPilotOpen, setIsPilotOpen } = usePilotStoreShallow((state) => ({
    isPilotOpen: state.isPilotOpen,
    setIsPilotOpen: state.setIsPilotOpen,
  }));

  const handleOpenPilot = () => {
    setIsPilotOpen(true);
  };

  if (isPilotOpen) {
    return (
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-20 shadow-sm rounded-lg w-[550px] h-[280px] border border-solid border-gray-100 dark:border-gray-800">
        <Pilot canvasId={canvasId} />
      </div>
    );
  }

  return <AgentPanelButton onClick={handleOpenPilot} />;
});

PilotControl.displayName = 'PilotControl';
