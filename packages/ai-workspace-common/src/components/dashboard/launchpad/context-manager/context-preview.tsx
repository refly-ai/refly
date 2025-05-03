import { memo } from 'react';
import {
  DocumentNodeProps,
  MemoNodeProps,
  ResourceNodeProps,
  SkillResponseNode,
  SkillResponseNodeProps,
  ImageNodeProps,
  WebsiteNodeProps,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import {
  DocumentNode,
  ResourceNode,
  MemoNode,
  ImageNode,
  CodeArtifactNode,
  WebsiteNode,
  CodeArtifactNodeProps,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { ChatHistoryPreview } from './components/chat-history-preview';
import { SelectionPreview } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager/components/selection-preview';

export const ContextPreview = memo(
  ({ item }: { item: IContextItem }) => {
    const { nodes } = useCanvasData();
    const node = nodes.find((node) => node.data?.entityId === item?.entityId);

    const commonProps = {
      isPreview: true,
      hideActions: true,
      hideHandles: true,
      data: {
        ...node?.data,
        // Overwrite contentPreview if this is a selection
        ...(item.selection ? { contentPreview: item.selection.content } : {}),
      },
      selected: false,
      id: node?.id,
    };

    switch (item?.type) {
      case 'document':
        return <DocumentNode {...(commonProps as DocumentNodeProps)} />;
      case 'resource':
        return <ResourceNode {...(commonProps as ResourceNodeProps)} />;
      case 'skillResponse':
        if (item.metadata?.withHistory) {
          return <ChatHistoryPreview item={item} />;
        }
        return <SkillResponseNode {...(commonProps as SkillResponseNodeProps)} />;
      case 'memo':
        return <MemoNode {...(commonProps as MemoNodeProps)} />;
      case 'codeArtifact':
        return <CodeArtifactNode {...(commonProps as CodeArtifactNodeProps)} />;
      case 'website':
        return <WebsiteNode {...(commonProps as WebsiteNodeProps)} />;
      case 'resourceSelection':
      case 'documentSelection':
      case 'skillResponseSelection':
        return <SelectionPreview item={item} />;
      case 'image':
        return <ImageNode {...(commonProps as ImageNodeProps)} />;
      default:
        return null;
    }
  },
  (prevProps, nextProps) => {
    return prevProps.item.entityId === nextProps.item.entityId;
  },
);
