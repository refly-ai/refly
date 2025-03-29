import { useSearchParams } from 'react-router-dom';
import { Canvas } from '../canvas';
import { NoCanvas } from './no-canvas';
export const Project = ({ projectId }: { projectId: string }) => {
  const [searchParams] = useSearchParams();
  const canvasId = searchParams.get('canvasId');
  console.log('projectId', projectId);
  if (!canvasId || canvasId === 'empty') {
    return <NoCanvas projectId={projectId} />;
  }

  return <Canvas canvasId={canvasId} />;
};
