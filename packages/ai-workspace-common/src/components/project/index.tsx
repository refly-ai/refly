import { useNavigate, useSearchParams } from 'react-router-dom';
import { Canvas } from '../canvas';
import { NoCanvas } from './no-canvas';
import { useEffect } from 'react';

export const Project = ({ projectId }: { projectId: string }) => {
  const [searchParams] = useSearchParams();
  const canvasId = searchParams.get('canvasId');
  const navigate = useNavigate();

  const goFrontPage = async () => {
    if (!canvasId) {
      navigate(`/project/${projectId}?canvasId=empty`, { replace: true });
    }
  };

  useEffect(() => {
    goFrontPage();
  }, [canvasId, projectId, navigate]);

  if (!canvasId || canvasId === 'empty') {
    return <NoCanvas />;
  }

  return <Canvas canvasId={canvasId} key={canvasId} />;
};
