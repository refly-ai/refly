import { memo } from 'react';
import { DocumentEditor } from '@refly-packages/ai-workspace-common/components/document';
import { CanvasNode, DocumentNodeMeta } from '@refly/canvas-common';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

interface DocumentNodePreviewProps {
  node: CanvasNode<DocumentNodeMeta>;
}

export const DocumentNodePreview = memo(
  ({ node }: DocumentNodePreviewProps) => {
    const { readonly } = useCanvasContext();
    const { entityId, metadata } = node.data;

    // Early return if no node data
    if (!entityId) {
      return (
        <div className="h-full flex items-center justify-center text-gray-500">
          No document data available
        </div>
      );
    }

    return (
      <div className="h-full overflow-hidden">
        <DocumentEditor docId={entityId} readonly={readonly} shareId={metadata?.shareId} />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.node.data.entityId === nextProps.node.data.entityId;
  },
);
