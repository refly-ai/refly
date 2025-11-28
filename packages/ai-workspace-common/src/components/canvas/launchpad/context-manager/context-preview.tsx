import { memo } from 'react';
import { DocumentNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/document';
import { ResourceNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/resource';
import { MemoNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/memo/memo';
import { ImageNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/image';
import { CodeArtifactNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/code-artifact';
import { WebsiteNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/website';
import { SkillResponseNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/skill-response';
import { VideoNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/video';
import { AudioNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes/audio';
import {
  DocumentNodeProps,
  MemoNodeProps,
  ResourceNodeProps,
  CodeArtifactNodeProps,
  SkillResponseNodeProps,
  ImageNodeProps,
  WebsiteNodeProps,
} from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/types';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useGetResourceDetail } from '@refly-packages/ai-workspace-common/queries';
import { IContextItem } from '@refly/common-types';
import { deepmerge } from '@refly/utils';
import { ChatHistoryPreview } from './components/chat-history-preview';
import { SelectionPreview } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager/components/selection-preview';

export const ContextPreview = memo(
  ({ item }: { item: IContextItem }) => {
    const { nodes } = useCanvasData();
    const node = nodes.find((node) => node.data?.entityId === item?.entityId);

    // Fetch remote resource detail for resource type items
    const resourceId = item?.entityId ?? '';
    const { data: resourceResult } = useGetResourceDetail({ query: { resourceId } }, undefined, {
      enabled: item?.type === 'resource' && !!resourceId,
    });
    const remoteResourceData = resourceResult?.data;

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
      case 'resource': {
        const resourceProps = {
          ...commonProps,
          data: deepmerge(commonProps.data, remoteResourceData || {}),
        };
        if (item.metadata?.resourceType === 'image') {
          const imageProps = deepmerge(resourceProps, {
            data: {
              metadata: {
                imageUrl: item.metadata?.imageUrl,
              },
            },
          });
          return <ImageNode {...(imageProps as ImageNodeProps)} />;
        }
        if (item.metadata?.resourceType === 'video') {
          const videoProps = deepmerge(resourceProps, {
            data: {
              metadata: {
                videoUrl: item.metadata?.videoUrl,
              },
            },
          });
          return <VideoNode {...(videoProps as any)} />;
        }
        if (item.metadata?.resourceType === 'audio') {
          const audioProps = deepmerge(resourceProps, {
            data: {
              metadata: {
                audioUrl: item.metadata?.audioUrl,
              },
            },
          });
          return <AudioNode {...(audioProps as any)} />;
        }
        return <ResourceNode {...(resourceProps as ResourceNodeProps)} />;
      }
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
