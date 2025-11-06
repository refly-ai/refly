import { useCanvasResourcesPanelStoreShallow } from '@refly/stores';
import { DocumentTopButtons } from './document-top-buttons';
import { ResourceTopButtons } from './resource-top-buttons';
import { CodeArtifactTopButtons } from './code-artifact-top-buttons';

export const TopButtons = () => {
  const { currentResource } = useCanvasResourcesPanelStoreShallow((state) => ({
    currentResource: state.currentResource,
  }));

  switch (currentResource?.type) {
    case 'document':
      return <DocumentTopButtons />;
    case 'resource':
      return <ResourceTopButtons />;
    case 'codeArtifact':
      return <CodeArtifactTopButtons />;
    default:
      return null;
  }
};
