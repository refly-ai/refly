import { NodeTypes } from '@xyflow/react';
import { DocumentNode } from './document';
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
