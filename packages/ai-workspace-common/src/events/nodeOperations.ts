import mitt from 'mitt';
import { XYPosition } from '@xyflow/react';
import { CanvasNodeType } from '@refly/openapi-schema';
import { CanvasNodeData } from '@refly-packages/ai-workspace-common/components/canvas/nodes/types';
import { CanvasNodeFilter } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-selection';

export type Events = {
  addNode: {
    node: { type: CanvasNodeType; data: CanvasNodeData<any>; position?: XYPosition };
    connectTo?: CanvasNodeFilter[];
    shouldPreview?: boolean;
    needSetCenter?: boolean;
    positionCallback?: (position: XYPosition) => void;
  };
  jumpToDescendantNode: {
    entityId: string;
    descendantNodeType: CanvasNodeType;
    shouldPreview?: boolean;
  };
};

export const nodeOperationsEmitter = mitt<Events>();
