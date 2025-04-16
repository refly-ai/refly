import mitt from 'mitt';
import { Edge } from '@xyflow/react';

export type EdgeEvents = {
  edgeChange: {
    oldEdges: Edge[];
    newEdges: Edge[];
  };
};

export const edgeEventsEmitter = mitt<EdgeEvents>();
