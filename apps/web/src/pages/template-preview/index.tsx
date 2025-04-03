import { useParams } from 'react-router-dom';
import { Canvas } from '@refly-packages/ai-workspace-common/components/canvas';

const TemplatePreviewPage = () => {
  const { shareId = '' } = useParams();

  return <Canvas canvasId={shareId} readonly />;
};

export default TemplatePreviewPage;
