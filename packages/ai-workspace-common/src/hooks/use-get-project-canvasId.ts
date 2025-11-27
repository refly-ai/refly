import { useParams, useMatch, useSearchParams } from 'react-router-dom';

export const useGetProjectCanvasId = () => {
  const [searchParams] = useSearchParams();
  // Support both old and new routes for backward compatibility
  const matchProject = useMatch('/project/:projectId');
  const matchCanvas = useMatch('/canvas/:canvasId');
  const matchWorkflow = useMatch('/workflow/:workflowId');
  const params = useParams();

  const projectId = matchProject ? params?.projectId || matchProject?.params?.projectId : undefined;
  // Support both /canvas/:canvasId (old) and /workflow/:workflowId (new)
  const canvasId = matchCanvas
    ? params?.canvasId || matchCanvas?.params?.canvasId
    : matchWorkflow
      ? params?.workflowId || matchWorkflow?.params?.workflowId
      : searchParams.get('canvasId');

  const isCanvasOpen = canvasId && canvasId !== 'empty';

  return { projectId, canvasId, isCanvasOpen };
};
