import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';
import { useSiderStoreShallow } from '@refly/stores';
import cn from 'classnames';
import { logEvent } from '@refly/telemetry-web';

const WorkflowPage = () => {
  const { workflowId = '' } = useParams();
  const isShareMode = workflowId?.startsWith('can-');

  const { collapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
  }));

  useEffect(() => {
    if (workflowId) {
      if (isShareMode) {
        logEvent('enter_share_canvas', null, { canvasId: workflowId });
      } else {
        logEvent('enter_canvas', null, { canvasId: workflowId });
      }
    }
  }, [workflowId, isShareMode]);

  if (isShareMode) {
    return (
      <div className={cn('w-full h-full flex flex-col p-2', { '!p-0': collapse })}>
        <Canvas canvasId={workflowId} readonly />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <Canvas canvasId={workflowId} />
    </div>
  );
};

export default WorkflowPage;
