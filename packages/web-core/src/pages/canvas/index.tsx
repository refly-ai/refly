import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';
import { logEvent } from '@refly/telemetry-web';

const CanvasPage = () => {
  const { canvasId = '' } = useParams();

  useEffect(() => {
    if (canvasId === 'empty') {
      logEvent('enter_workspace');
    } else if (canvasId) {
      logEvent('enter_canvas', null, { canvasId });
    }
  }, [canvasId]);

  return (
    <div className="w-full h-full">
      {canvasId && canvasId !== 'empty' ? <Canvas canvasId={canvasId} /> : <FrontPage />}
    </div>
  );
};

export default CanvasPage;
