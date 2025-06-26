import mitt from 'mitt';
import { NodeDragCreateInfo } from './nodeOperations';
export type NodeActionEvents = {
  [key: `node:${string}:rerun`]: undefined;
  [key: `node:${string}:delete`]: undefined;
  [key: `node:${string}:addToContext`]: undefined;
  [key: `node:${string}:createDocument`]: {
    dragCreateInfo?: NodeDragCreateInfo;
  };
  [key: `node:${string}:createDocument.completed`]: undefined;
  [key: `node:${string}:ungroup`]: undefined;
  [key: `node:${string}:insertToDoc`]: {
    content?: string;
  };
  [key: `node:${string}:askAI`]: {
    dragCreateInfo?: NodeDragCreateInfo;
  };
  [key: `node:${string}:cloneAskAI`]: undefined;
  [key: `node:${string}:cloneAskAI.completed`]: undefined;
  [key: `node:${string}:fullScreenPreview`]: undefined;
  [key: `node:${string}:showActionButtons`]: undefined;
  [key: `node:${string}:duplicateDocument`]: {
    content?: string;
    dragCreateInfo?: NodeDragCreateInfo;
  };
  [key: `node:${string}:duplicate`]: {
    dragCreateInfo?: NodeDragCreateInfo;
  };
};

export const nodeActionEmitter = mitt<NodeActionEvents>();

export const createNodeEventName = (nodeId: string, actionType: string) =>
  `node:${nodeId}:${actionType}` as keyof NodeActionEvents;

export const cleanupNodeEvents = (nodeId: string) => {
  const eventTypes = [
    'run',
    'rerun',
    'delete',
    'addToContext',
    'createDocument',
    'insertToDoc',
    'ungroup',
    'askAI',
    'cloneAskAI',
    'cloneAskAI.completed',
    'showActionButtons',
  ];
  for (const type of eventTypes) {
    nodeActionEmitter.all.delete(createNodeEventName(nodeId, type));
  }
};
