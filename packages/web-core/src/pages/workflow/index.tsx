import { useParams } from 'react-router-dom';
import { useEffect, memo } from 'react';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';
import { useSiderStoreShallow } from '@refly/stores';
import cn from 'classnames';
import { logEvent } from '@refly/telemetry-web';

const WorkflowPage = memo(() => {
  const { workflowId = '' } = useParams();
  const isShareMode = workflowId?.startsWith('can-');

  // Use a stable selector to prevent unnecessary re-renders
  const collapse = useSiderStoreShallow((state) => state.collapse);

  useEffect(() => {
    if (workflowId) {
      if (isShareMode) {
        logEvent('enter_share_canvas', null, { canvasId: workflowId });
      } else {
        logEvent('enter_canvas', null, { canvasId: workflowId });
      }
    }
  }, [workflowId, isShareMode]);

  return (
    <div
      className={cn('w-full h-full flex flex-col', {
        'p-2': isShareMode,
        '!p-0': isShareMode && collapse,
      })}
    >
      <Canvas canvasId={workflowId} readonly={isShareMode} />
    </div>
  );
});

WorkflowPage.displayName = 'WorkflowPage';

export default WorkflowPage;
