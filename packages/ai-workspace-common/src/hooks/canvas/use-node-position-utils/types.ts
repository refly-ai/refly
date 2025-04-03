import { Node, XYPosition } from '@xyflow/react';
import { CanvasNodeFilter } from '../use-node-selection';

export interface NodeData extends Record<string, unknown> {
  connections?: string[];
}

export interface CalculateNodePositionParams {
  nodes: Node[];
  sourceNodes?: Node[];
  connectTo?: CanvasNodeFilter[];
  defaultPosition?: XYPosition;
  edges?: any[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface LayoutBranchOptions {
  fromRoot?: boolean; // 是否从根节点开始布局
  direction?: 'TB' | 'LR';
  fixedNodeLevels?: boolean;
  spacing?: {
    x: number;
    y: number;
  };
}
