import { memo } from 'react';
import { DocumentEditor } from '@refly-packages/ai-workspace-common/components/document';
import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface DocumentNodePreviewProps {
  nodeData?: {
    entityId?: string;
    entityType?: 'document' | 'resource';
    node: CanvasNode<any>;
  };
}

export const DocumentNodePreview = memo(
  ({ nodeData }: DocumentNodePreviewProps) => {
    const { readonly } = useCanvasContext();

    // Early return if no node data
    if (!nodeData?.entityId || !nodeData?.entityType) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          No document data available
        </div>
      );
    }

    const { entityId } = nodeData;

    return (
      <div className="h-full overflow-hidden">
        <DocumentEditor docId={entityId} readonly={readonly} />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.nodeData?.entityId === nextProps.nodeData?.entityId;
  },
);
