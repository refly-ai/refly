import { memo } from 'react';
import { useCallback } from 'react';
import { ReflyAssistant } from '../copilot/refly-assistant';
import { useUserStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface ToggleCopilotPanelProps {
  copilotWidth: number;
  setCopilotWidth: (width: number | null) => void;
}

export const ToggleCopilotPanel = memo(
  ({ copilotWidth, setCopilotWidth }: ToggleCopilotPanelProps) => {
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const { readonly } = useCanvasContext();

    const handleCopilotOpen = useCallback(() => {
      setCopilotWidth(400);
    }, [copilotWidth, setCopilotWidth]);

    if (copilotWidth || !isLogin || readonly) {
      return null;
    }

    return (
      <div
        className="absolute top-6 left-6 z-20 py-2 px-4 flex items-center justify-center bg-refly-bg-content-z2 rounded-xl border-solid border-[1px] border-refly-Card-Border cursor-pointer hover:bg-refly-tertiary-hover shadow-refly-m"
        onClick={handleCopilotOpen}
      >
        <ReflyAssistant />
      </div>
    );
  },
);

ToggleCopilotPanel.displayName = 'ToggleCopilotPanel';
