import { CanvasNode } from '@refly/canvas-common';
import { SkillNodePreview } from './skill';
import { DocumentNodePreview } from './document';
import { StartNodePreview } from './start';
import { useMemo, memo } from 'react';
import { CodeArtifactNodePreview } from './code-artifact';
import { SkillResponseNodePreview } from './skill-response';

export const PreviewComponent = memo(
  ({ node, purePreview = false }: { node: CanvasNode<any>; purePreview?: boolean }) => {
    if (!node?.type) return null;

    // Use useMemo to create the appropriate preview component
    return useMemo(() => {
      switch (node.type) {
        case 'document':
          return <DocumentNodePreview node={node} />;
        case 'skill':
          return <SkillNodePreview node={node} />;
        case 'skillResponse':
          return (
            <SkillResponseNodePreview
              purePreview={purePreview}
              node={node}
              resultId={node.data?.entityId}
            />
          );
        case 'codeArtifact':
          return <CodeArtifactNodePreview nodeId={node.id} purePreview={purePreview} />;
        case 'start':
          return <StartNodePreview />;
        default:
          return null;
      }
    }, [
      node.type,
      node.data?.entityId,
      node.data?.contentPreview,
      node.data?.title,
      node.data?.metadata?.status,
      node.data?.metadata?.activeTab,
      node.data?.metadata?.url,
      node.data?.metadata?.viewMode,
      node.data?.metadata?.contextItems,
    ]);
  },
  (prevProps, nextProps) => {
    // Check type and entity ID
    const basicPropsEqual =
      prevProps.node?.type === nextProps.node?.type &&
      prevProps.node?.data?.entityId === nextProps.node?.data?.entityId;

    if (!basicPropsEqual) return false;

    // Check content preview
    const contentEqual =
      prevProps.node?.data?.contentPreview === nextProps.node?.data?.contentPreview;

    // Check title
    const titleEqual = prevProps.node?.data?.title === nextProps.node?.data?.title;

    // Check metadata status (for generating state)
    const statusEqual =
      prevProps.node?.data?.metadata?.status === nextProps.node?.data?.metadata?.status;

    const contextItemsEqual =
      prevProps.node?.data?.metadata?.contextItems === nextProps.node?.data?.metadata?.contextItems;

    const modelInfoEqual =
      prevProps.node?.data?.metadata?.modelInfo === nextProps.node?.data?.metadata?.modelInfo;

    return (
      basicPropsEqual &&
      contentEqual &&
      titleEqual &&
      statusEqual &&
      modelInfoEqual &&
      contextItemsEqual
    );
  },
);
