import { CanvasNodeType, SelectionKey } from '@refly/openapi-schema';

export interface Selection {
  content: string;
  sourceTitle?: string;
  sourceEntityId?: string;
  sourceEntityType?: CanvasNodeType;
}

// Context items used in canvas nodes
export interface IContextItem {
  entityId: string;
  type: CanvasNodeType | SelectionKey | 'file';
  title?: string; // deprecated, always lookup node title instead
  selection?: Selection;
  metadata?: Record<string, any>;
  isPreview?: boolean; // is preview mode
  isCurrentContext?: boolean;
}

export enum ContextTarget {
  Global = 'global',
}
