import { useCallback, useMemo } from 'react';
import { IContextItem } from '@refly/common-types';
import { useNodeData } from './use-node-data';
import { GenericToolset, ModelInfo } from '@refly/openapi-schema';
import { CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { purgeContextItems } from '@refly/canvas-common';
import { useRealtimeCanvasData } from './use-realtime-canvas-data';

export const useAgentNodeManagement = (nodeId: string) => {
  const { nodesLookup } = useRealtimeCanvasData();
  const node = nodesLookup.get(nodeId);
  const metadata = useMemo<ResponseNodeMeta>(() => {
    const nodeData = (node?.data as CanvasNodeData<ResponseNodeMeta>) ?? undefined;
    return nodeData?.metadata ?? ({} as ResponseNodeMeta);
  }, [node]);

  const { query, modelInfo, contextItems, selectedToolsets } = metadata;

  const { setNodeData } = useNodeData();

  const setQuery = useCallback(
    (updatedQuery: string | ((prevQuery: string) => string)) => {
      setNodeData<ResponseNodeMeta>(nodeId, (prevData) => {
        const prevMetadata = (prevData?.metadata as ResponseNodeMeta) ?? ({} as ResponseNodeMeta);
        const prevQuery = prevMetadata?.query ?? '';
        const nextQuery =
          typeof updatedQuery === 'function' ? updatedQuery(prevQuery) : updatedQuery;

        return {
          metadata: {
            query: nextQuery,
          },
        };
      });
    },
    [setNodeData, nodeId],
  );

  const setModelInfo = useCallback(
    (
      updatedModelInfo: ModelInfo | null | ((prevModelInfo: ModelInfo | null) => ModelInfo | null),
    ) => {
      setNodeData<ResponseNodeMeta>(nodeId, (prevData) => {
        const prevMetadata = (prevData?.metadata as ResponseNodeMeta) ?? ({} as ResponseNodeMeta);
        const prevModel = prevMetadata?.modelInfo ?? null;
        const nextModelInfo =
          typeof updatedModelInfo === 'function' ? updatedModelInfo(prevModel) : updatedModelInfo;

        return {
          metadata: {
            modelInfo: nextModelInfo,
          },
        };
      });
    },
    [setNodeData, nodeId],
  );

  const setSelectedToolsets = useCallback(
    (
      updatedToolsets: GenericToolset[] | ((prevToolsets: GenericToolset[]) => GenericToolset[]),
    ) => {
      setNodeData<ResponseNodeMeta>(nodeId, (prevData) => {
        const prevMetadata = (prevData?.metadata as ResponseNodeMeta) ?? ({} as ResponseNodeMeta);
        const prevToolsets = Array.isArray(prevMetadata?.selectedToolsets)
          ? (prevMetadata?.selectedToolsets as GenericToolset[])
          : [];
        const nextToolsets =
          typeof updatedToolsets === 'function' ? updatedToolsets(prevToolsets) : updatedToolsets;

        return {
          metadata: {
            selectedToolsets: nextToolsets ?? [],
          },
        };
      });
    },
    [setNodeData, nodeId],
  );

  const setContextItems = useCallback(
    (
      updatedContextItems: IContextItem[] | ((prevContextItems: IContextItem[]) => IContextItem[]),
    ) => {
      setNodeData<ResponseNodeMeta>(nodeId, (prevData) => {
        const prevMetadata = (prevData?.metadata as ResponseNodeMeta) ?? ({} as ResponseNodeMeta);
        const prevItems = Array.isArray(prevMetadata?.contextItems)
          ? (prevMetadata?.contextItems as IContextItem[])
          : [];
        const nextItems =
          typeof updatedContextItems === 'function'
            ? updatedContextItems(prevItems)
            : updatedContextItems;

        return {
          metadata: {
            contextItems: purgeContextItems(nextItems ?? []),
          },
        };
      });
    },
    [setNodeData, nodeId],
  );

  return {
    query,
    modelInfo,
    contextItems,
    selectedToolsets,
    setQuery,
    setModelInfo,
    setSelectedToolsets,
    setContextItems,
  };
};
