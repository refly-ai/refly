import { CanvasNode } from '@refly-packages/ai-workspace-common/components/canvas/nodes';
import { CanvasNodeType } from '@refly/openapi-schema';

export interface RenderItem {
  data: CanvasNode;
  type: CanvasNodeType;
  icon: React.ReactNode;
  action?: boolean;
  isSelected?: boolean;
  actionHeading?: { create: string };
  onItemClick?: (item: CanvasNode) => void;
  onCreateClick?: () => void;
}
