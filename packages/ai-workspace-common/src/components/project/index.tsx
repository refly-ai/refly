import { useNavigate, useSearchParams } from 'react-router-dom';
import { Canvas } from '../canvas';
import { NoCanvas } from './no-canvas';
import { useEffect } from 'react';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const Project = ({ projectId }: { projectId: string }) => {
  const [searchParams] = useSearchParams();
  const canvasId = searchParams.get('canvasId');
  const navigate = useNavigate();

  const getProjectCanvases = async (projectId: string) => {
    const res = await getClient().listCanvases({
      query: { projectId, page: 1, pageSize: 1000 },
    });
    return res?.data?.data || [];
  };

  const goCanvas = async () => {
    if (canvasId === 'empty' || !canvasId) {
      const canvases = await getProjectCanvases(projectId);
      if (canvases?.[0]?.canvasId) {
        navigate(`/project/${projectId}?canvasId=${canvases[0]?.canvasId}`, { replace: true });
      }
    }
  };

  useEffect(() => {
    goCanvas();
  }, [canvasId, projectId, navigate]);

  if (!canvasId || canvasId === 'empty') {
    return <NoCanvas projectId={projectId} />;
  }

  return <Canvas canvasId={canvasId} />;
};
