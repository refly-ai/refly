import { GenericToolset } from '@refly/openapi-schema';
import { CanvasNode } from './types';

export const purgeToolsets = (toolsets: GenericToolset[]) => {
  if (!Array.isArray(toolsets)) {
    return [];
  }
  return toolsets.map((t) => {
    let next = { ...t };
    if (next.toolset) {
      const { definition, authData, ...safeToolset } = next.toolset;
      next = { ...next, toolset: safeToolset };
    }
    if (next.mcpServer) {
      const { headers, env, ...safeMcp } = next.mcpServer;
      next = { ...next, mcpServer: safeMcp };
    }
    return next;
  });
};

export interface ReferencedNode {
  id: string;
  entityId: string;
  title: string;
  type: string;
}

export interface ToolWithNodes {
  toolset: GenericToolset;
  referencedNodes: Array<ReferencedNode>;
}

/**
 * Extract toolsets with skill response nodes
 */
export const extractToolsetsWithNodes = (nodes: CanvasNode[]): ToolWithNodes[] => {
  const toolMap = new Map<string, ToolWithNodes>();

  if (!Array.isArray(nodes)) {
    return [];
  }

  for (const node of nodes) {
    if (node?.type === 'skillResponse' && node?.data?.metadata?.selectedToolsets) {
      const selectedToolsets = node.data.metadata.selectedToolsets as GenericToolset[];

      if (!Array.isArray(selectedToolsets)) {
        continue;
      }

      for (const toolset of selectedToolsets) {
        if (!toolset?.id) {
          continue;
        }

        const toolId = toolset.id;
        const existingTool = toolMap.get(toolId);

        const nodeInfo = {
          id: node.id,
          entityId: node.data?.entityId ?? '',
          title: node.data?.title || 'Untitled',
          type: node.type,
        };

        if (existingTool) {
          // Add node to existing tool if not already present
          const nodeExists = existingTool.referencedNodes.some((n) => n.id === nodeInfo.id);
          if (!nodeExists) {
            existingTool.referencedNodes.push(nodeInfo);
          }
        } else {
          // Create new tool entry
          toolMap.set(toolId, {
            toolset,
            referencedNodes: [nodeInfo],
          });
        }
      }
    }
  }

  return Array.from(toolMap.values());
};
