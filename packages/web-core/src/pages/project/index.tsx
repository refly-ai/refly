import { Project } from '@refly-packages/ai-workspace-common/components/project';
import { useParams } from 'react-router-dom';

const ProjectPage = () => {
  const { projectId = '' } = useParams();

  return (
    <div className="w-full h-full">
      <Project projectId={projectId} />
    </div>
  );
};

export default ProjectPage;
