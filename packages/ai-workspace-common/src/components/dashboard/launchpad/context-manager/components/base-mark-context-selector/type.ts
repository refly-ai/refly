import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { CanvasNodeType } from '@refly/openapi-schema';

export interface RenderItem {
  data: IContextItem;
  type: CanvasNodeType;
  icon: React.ReactNode;
  action?: boolean;
  isSelected?: boolean;
  actionHeading?: { create: string };
  onItemClick?: (item: IContextItem) => void;
  onCreateClick?: () => void;
}
