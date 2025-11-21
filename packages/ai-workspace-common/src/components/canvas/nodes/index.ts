import { NodeTypes } from '@xyflow/react';
import { DocumentNode } from './document';
import { ResourceNode } from './resource';
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
import { StartNode } from './start';

// Export all components and types
export * from './document';
export * from './resource';
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
export * from './start';

// Node types mapping
export const nodeTypes: NodeTypes = {
  document: DocumentNode,
  resource: ResourceNode,
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
  start: StartNode,
};

// Export common styles
export { getNodeCommonStyles } from './shared/styles';
