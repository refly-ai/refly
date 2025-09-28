import { useParams } from 'react-router-dom';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';
import { FrontPage } from '@refly-packages/ai-workspace-common/components/canvas/front-page';

const CanvasPage = () => {
  const { canvasId = '' } = useParams();

  return (
    <div className="w-full h-full">
      {canvasId && canvasId !== 'empty' ? (
        <Canvas canvasId={canvasId} />
      ) : (
        <FrontPage projectId={null} />
      )}
    </div>
  );
};

export default CanvasPage;
