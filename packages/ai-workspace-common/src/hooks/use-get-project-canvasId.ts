import { useParams, useMatch, useSearchParams } from 'react-router-dom';

export const useGetProjectCanvasId = () => {
  const [searchParams] = useSearchParams();
  const match = useMatch('/project/:projectId');
  const params = useParams();

  // 从路径参数或 URL 获取 projectId
  const projectId = params?.projectId || match?.params?.projectId;

  // 从查询参数获取 canvasId
  const canvasId = searchParams.get('canvasId');

  return { projectId, canvasId };
};
