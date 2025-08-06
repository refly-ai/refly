import { NodeTypes } from '@xyflow/react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { DocumentNode } from './document';
import { ResourceNode } from './resource';
import { SkillNode } from './skill';
import { MediaSkillNode } from './media/mediaSkill';
import { MediaSkillResponseNode } from './media/media-skill-response';
import { ToolNode } from './tool';
import { SkillResponseNode } from './skill-response';
import { MemoNode } from './memo/memo';
import { GroupNode } from './group';
import { ImageNode } from './image';
import { VideoNode } from './video';
import { AudioNode } from './audio';
import { CodeArtifactNode } from './code-artifact';
import { WebsiteNode } from './website';
import { GhostNode } from './ghost';
import {
  NodeMetadataMap,
  CanvasNodeData,
  DocumentNodeMeta,
  ResourceNodeMeta,
  SkillNodeMeta,
  MediaSkillNodeMeta,
  ToolNodeMeta,
  ResponseNodeMeta,
  CodeArtifactNodeMeta,
} from '@refly/canvas-common';
import { t } from 'i18next';
import { genUniqueId } from '@refly/utils/id';

// Export all components and types
export * from './document';
export * from './resource';
export * from './skill';
export * from './media/mediaSkill';
export * from './media/media-skill-response';
export * from './tool';
export * from './skill-response';
export * from './memo/memo';
export * from './group';
export * from './image';
export * from './video';
export * from './audio';
export * from './code-artifact';
export * from './website';

// Node types mapping
export const nodeTypes: NodeTypes = {
  document: DocumentNode,
  resource: ResourceNode,
  skill: SkillNode,
  mediaSkill: MediaSkillNode,
  mediaSkillResponse: MediaSkillResponseNode,
  tool: ToolNode,
  skillResponse: SkillResponseNode,
  memo: MemoNode,
  group: GroupNode,
  image: ImageNode,
  video: VideoNode,
  audio: AudioNode,
  codeArtifact: CodeArtifactNode,
  website: WebsiteNode,
  ghost: GhostNode,
};

// Helper function to prepare node data
export const prepareNodeData = <T extends CanvasNodeType>({
  type,
  data,
  position = { x: 0, y: 0 },
  connectable = true,
  selected = false,
  selectable = true,
  className,
  style,
  draggable = true,
  zIndex,
  id,
}: {
  type: T;
  data: CanvasNodeData<NodeMetadataMap[T]>;
  position?: { x: number; y: number };
  connectable?: boolean;
  selectable?: boolean;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  draggable?: boolean;
  zIndex?: number;
  id?: string;
}) => {
  return {
    id: id || `node-${genUniqueId()}`,
    type,
    position,
    data,
    connectable,
    selected,
    selectable,
    className,
    style,
    draggable,
    zIndex,
  };
};

// Helper function to get default metadata based on node type
export const getNodeDefaultMetadata = (nodeType: CanvasNodeType) => {
  if (!nodeType) {
    return {};
  }

  // Base metadata to include in all node types
  const baseMetadata = {
    sizeMode: 'adaptive' as const, // Default size mode that will be overridden with global setting
  };

  switch (nodeType) {
    case 'document':
      return {
        ...baseMetadata,
        contentPreview: t('canvas.nodePreview.document.contentPreview'),
        // Add optional fields with default values
        title: '',
        lastModified: new Date().toISOString(),
        status: 'finish',
      } as DocumentNodeMeta;

    case 'resource':
      return {
        ...baseMetadata,
        resourceType: 'weblink', // Default to weblink
        url: '',
        description: '',
        lastAccessed: new Date().toISOString(),
        contentPreview: t('canvas.nodePreview.resource.contentPreview'),
      } as ResourceNodeMeta;

    case 'skill':
      return {
        ...baseMetadata,
        query: '',
        modelInfo: undefined,
      } as SkillNodeMeta;

    case 'mediaSkill':
      return {
        ...baseMetadata,
        query: '',
        modelInfo: undefined,
      } as MediaSkillNodeMeta;

    case 'tool':
      return {
        ...baseMetadata,
        toolType: 'TextToSpeech',
        configuration: {}, // Tool-specific configuration
        status: 'ready',
        lastUsed: null,
      } as ToolNodeMeta;

    case 'skillResponse':
      return {
        ...baseMetadata,
        status: 'waiting',
        version: 0,
      } as ResponseNodeMeta;

    case 'mediaSkillResponse':
      return {
        ...baseMetadata,
        status: 'waiting',
        version: 0,
        mediaType: 'image',
        prompt: '',
        model: '',
        resultId: '',
      } as ResponseNodeMeta;

    case 'toolResponse':
      return {
        ...baseMetadata,
        modelName: 'Tool Response',
        status: 'waiting',
        executionTime: null,
      } as ResponseNodeMeta;

    case 'image':
      return {
        ...baseMetadata,
        style: {},
      };

    case 'video':
      return {
        ...baseMetadata,
        videoUrl: '',
        showBorder: true,
        showTitle: true,
        style: {},
      };

    case 'audio':
      return {
        ...baseMetadata,
        audioUrl: '',
        showBorder: true,
        showTitle: true,
        style: {},
      };

    case 'codeArtifact':
      return {
        ...baseMetadata,
        status: 'generating',
        language: 'typescript',
        style: {},
        activeTab: 'code',
      } as CodeArtifactNodeMeta;

    default:
      return baseMetadata;
  }
};

// Add this helper function to share common styles
export const getNodeCommonStyles = ({
  selected,
  isHovered,
}: { selected: boolean; isHovered: boolean }) => `
  bg-refly-bg-content-z2
  rounded-2xl
  box-border
  transition-all
  duration-200
  border-[1px]
  border-solid
  overflow-hidden
  ${selected ? 'border-refly-primary-default' : 'border-refly-Card-Border'}
  ${isHovered || selected ? 'shadow-refly-m' : ''}
`;
