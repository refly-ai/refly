import { useParams, useMatch, useSearchParams } from 'react-router-dom';

export const useGetProjectCanvasId = () => {
  const [searchParams] = useSearchParams();
  const match = useMatch('/project/:projectId');
  const params = useParams();
  const projectId = params?.projectId || match?.params?.projectId;
  const canvasId = searchParams.get('canvasId');

  return { projectId, canvasId };
};
