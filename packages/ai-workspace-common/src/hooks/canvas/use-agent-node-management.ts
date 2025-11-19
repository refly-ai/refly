import { useCallback, useMemo } from 'react';
import { IContextItem } from '@refly/common-types';
import { useNodeData } from './use-node-data';
import { GenericToolset, ModelInfo } from '@refly/openapi-schema';
import { CanvasNode, CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@xyflow/react';
import { purgeContextItems } from '@refly/canvas-common';

const nodesLookupCache = new WeakMap<CanvasNode[], Map<string, CanvasNode>>();

const getNodesLookup = (nodes?: CanvasNode[]) => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return new Map<string, CanvasNode>();
  }

  const cachedLookup = nodesLookupCache.get(nodes);
  if (cachedLookup) {
    return cachedLookup;
  }

  const lookup = new Map<string, CanvasNode>();
  for (const canvasNode of nodes) {
    if (!canvasNode?.id) {
      continue;
    }
    lookup.set(canvasNode.id, canvasNode);
  }

  nodesLookupCache.set(nodes, lookup);
  return lookup;
};

export const useAgentNodeManagement = (nodeId: string) => {
  const { nodes } = useStore(
    useShallow((state) => ({
      nodes: state.nodes as CanvasNode[],
    })),
  );
  const nodesLookup = useMemo(() => getNodesLookup(nodes), [nodes]);
  const skillResponseNode = nodesLookup.get(nodeId);
  const node = skillResponseNode?.type === 'skillResponse' ? skillResponseNode : undefined;
  const metadata = useMemo<ResponseNodeMeta>(() => {
    const nodeData = (node?.data as CanvasNodeData<ResponseNodeMeta>) ?? undefined;
    return nodeData?.metadata ?? ({} as ResponseNodeMeta);
  }, [node]);
  const { query, modelInfo, contextItems, upstreamResultIds, selectedToolsets } = metadata;

  const { setNodeData } = useNodeData();

  const setQuery = useCallback(
    (query: string | ((prevQuery: string) => string)) => {
      const newQuery = typeof query === 'function' ? query(metadata.query ?? '') : query;
      setNodeData(nodeId, {
        metadata: { query: newQuery },
      });
    },
    [setNodeData, nodeId, metadata.query],
  );

  const setModelInfo = useCallback(
    (modelInfo: ModelInfo | null | ((prevModelInfo: ModelInfo | null) => ModelInfo | null)) => {
      const newModelInfo =
        typeof modelInfo === 'function' ? modelInfo(metadata.modelInfo) : modelInfo;
      setNodeData(nodeId, {
        metadata: { modelInfo: newModelInfo },
      });
    },
    [setNodeData, nodeId, metadata.modelInfo],
  );

  const setSelectedToolsets = useCallback(
    (toolsets: GenericToolset[] | ((prevToolsets: GenericToolset[]) => GenericToolset[])) => {
      const newToolsets =
        typeof toolsets === 'function' ? toolsets(metadata.selectedToolsets ?? []) : toolsets;
      setNodeData(nodeId, {
        metadata: { selectedToolsets: newToolsets },
      });
    },
    [setNodeData, nodeId, metadata.selectedToolsets],
  );

  const setContextItems = useCallback(
    (contextItems: IContextItem[] | ((prevContextItems: IContextItem[]) => IContextItem[])) => {
      const newContextItems =
        typeof contextItems === 'function'
          ? contextItems(metadata.contextItems ?? [])
          : contextItems;
      setNodeData(nodeId, {
        metadata: { contextItems: purgeContextItems(newContextItems) },
      });
    },
    [setNodeData, nodeId, metadata.contextItems],
  );

  const setUpstreamResultIds = useCallback(
    (resultIds: string[] | ((prevResultIds: string[]) => string[])) => {
      const newResultIds =
        typeof resultIds === 'function' ? resultIds(metadata.upstreamResultIds ?? []) : resultIds;
      setNodeData(nodeId, {
        metadata: { upstreamResultIds: newResultIds },
      });
    },
    [setNodeData, nodeId, metadata.upstreamResultIds],
  );

  return {
    query,
    modelInfo,
    contextItems,
    upstreamResultIds,
    selectedToolsets,
    setQuery,
    setModelInfo,
    setSelectedToolsets,
    setUpstreamResultIds,
    setContextItems,
  };
};
