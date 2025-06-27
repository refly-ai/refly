import { Artifact } from '@refly/openapi-schema';
import { CanvasNodeData } from '@refly/canvas-common';
import {
  IconCanvas,
  IconDocument,
} from '@refly-packages/ai-workspace-common/components/common/icon';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { ResponseNodeMeta } from '@refly/canvas-common';

export const getArtifactIcon = (artifact: Artifact, className?: string) => {
  switch (artifact.type) {
    case 'document':
      return <IconDocument className={cn('w-4 h-4', className)} />;
    default:
      return <IconCanvas className={cn('w-4 h-4', className)} />;
  }
};

export const getResultDisplayContent = (
  data: CanvasNodeData<ResponseNodeMeta>,
  className?: string,
) => {
  if (data.contentPreview) return <span className={className}>{data.contentPreview}</span>;

  // If content is empty, find the first artifact
  if (data.metadata?.artifacts?.length) {
    const artifact = data.metadata?.artifacts[0];
    return (
      <span className={cn('flex items-center', className)}>
        {getArtifactIcon(artifact, 'w-3 h-3 mr-1')} {artifact.title}
      </span>
    );
  }

  return '';
};
