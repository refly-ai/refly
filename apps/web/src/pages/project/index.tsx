import { Project } from '@refly-packages/ai-workspace-common/components/project';
import { useParams } from 'react-router-dom';

const ProjectPage = () => {
  const { projectId = '' } = useParams();

  return <Project projectId={projectId} />;
};

export default ProjectPage;
