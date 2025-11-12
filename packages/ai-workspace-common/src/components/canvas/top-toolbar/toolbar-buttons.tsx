import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanvasResourcesPanelStoreShallow, useUserStoreShallow } from '@refly/stores';
import { useCallback } from 'react';
import { Divider, Button } from 'antd';
import { Resource, SideLeft, SideRight } from 'refly-icons';
import { ToolsDependency } from '../tools-dependency';
import { cn } from '@refly/utils/cn';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface ToolbarButtonsProps {
  canvasId: string;
  copilotWidth: number;
  setCopilotWidth: (width: number | null) => void;
}

export const ToolbarButtons = memo(
  ({ canvasId, copilotWidth, setCopilotWidth }: ToolbarButtonsProps) => {
    const { t } = useTranslation();
    const isLogin = useUserStoreShallow((state) => state.isLogin);
    const { readonly } = useCanvasContext();

    const { sidePanelVisible, setSidePanelVisible, showWorkflowRun, setShowWorkflowRun } =
      useCanvasResourcesPanelStoreShallow((state) => ({
        sidePanelVisible: state.sidePanelVisible,
        setSidePanelVisible: state.setSidePanelVisible,
        showWorkflowRun: state.showWorkflowRun,
        setShowWorkflowRun: state.setShowWorkflowRun,
      }));

    const isResourceLibraryVisible = useMemo(() => {
      return sidePanelVisible && !showWorkflowRun;
    }, [sidePanelVisible, showWorkflowRun]);

    const handleResourcesPanelOpen = useCallback(() => {
      if (isResourceLibraryVisible) {
        setSidePanelVisible(false);
        setShowWorkflowRun(false);
      } else {
        setSidePanelVisible(true);
        setShowWorkflowRun(false);
      }
    }, [isResourceLibraryVisible, setSidePanelVisible, setShowWorkflowRun]);

    const handleCopilotOpen = useCallback(() => {
      if (copilotWidth === 0) {
        setCopilotWidth(400);
      } else {
        setCopilotWidth(0);
      }
    }, [copilotWidth, setCopilotWidth]);

    return (
      <div className="absolute top-0 left-0 right-0 z-20 p-2 flex items-center justify-center pointer-events-none">
        <div className="flex items-center gap-2 p-2 bg-refly-bg-content-z2 rounded-2xl border-solid border-[1px] border-refly-Card-Border pointer-events-auto">
          {isLogin && !readonly && (
            <>
              <Button
                type="text"
                icon={copilotWidth === 0 ? <SideRight size={18} /> : <SideLeft size={18} />}
                onClick={handleCopilotOpen}
                className={cn('p-2 font-semibold', copilotWidth !== 0 ? 'bg-refly-fill-hover' : '')}
              >
                Copilot
              </Button>

              <Divider type="vertical" className="m-0 h-5 bg-refly-Card-Border" />
            </>
          )}

          <ToolsDependency canvasId={canvasId} />

          <Button
            type="text"
            icon={<Resource size={18} />}
            onClick={handleResourcesPanelOpen}
            className={`p-2 font-semibold ${isResourceLibraryVisible ? 'bg-refly-fill-hover' : ''}`}
          >
            {t('canvas.toolbar.tooltip.resourceLibrary')}
          </Button>
        </div>
      </div>
    );
  },
);

ToolbarButtons.displayName = 'ToolbarButtons';
