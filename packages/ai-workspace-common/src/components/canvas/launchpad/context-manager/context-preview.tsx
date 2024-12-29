import { memo } from 'react';
import {
  CanvasNode,
  DocumentNodeProps,
  MemoNodeProps,
  ResourceNodeProps,
  SkillResponseNode,
  SkillResponseNodeProps,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { DocumentNode, ResourceNode, MemoNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useReactFlow } from '@xyflow/react';

export const ContextPreview = memo(
  ({ item }: { item: CanvasNode }) => {
    const { getNode } = useReactFlow();

    const node = getNode(item?.id);
    const commonProps = {
      isPreview: true,
      hideActions: true,
      hideHandles: true,
      data: node?.data,
      selected: false,
      id: item?.id,
    };

    switch (item?.type) {
      case 'document':
        return <DocumentNode {...(commonProps as DocumentNodeProps)} />;
      case 'resource':
        return <ResourceNode {...(commonProps as ResourceNodeProps)} />;
      case 'skillResponse':
        return <SkillResponseNode {...(commonProps as SkillResponseNodeProps)} />;
      case 'memo':
        return <MemoNode {...(commonProps as MemoNodeProps)} />;
      default:
        return null;
    }
  },
  (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id && prevProps.item.type === nextProps.item.type;
  },
);
