import { useCallback, useMemo } from 'react';
import { IContextItem } from '@refly/common-types';
import { useNodeData } from './use-node-data';
import { GenericToolset, ModelInfo } from '@refly/openapi-schema';
import { CanvasNodeData, ResponseNodeMeta } from '@refly/canvas-common';
import { purgeContextItems } from '@refly/canvas-common';
import { useRealtimeCanvasData } from './use-realtime-canvas-data';
// Hook for batch updating toolsetId across all canvas nodes
export const useCanvasToolsetUpdater = () => {
  const { nodes } = useRealtimeCanvasData();
  const { setNodeData: _setNodeData } = useNodeData();

  const setNodeData = useCallback(
    <T = any>(
      id: string,
      data: Partial<CanvasNodeData<T>> | ((prev: CanvasNodeData<T>) => Partial<CanvasNodeData<T>>),
    ) => {
      _setNodeData<T>(id, (prev) => {
        const next = typeof data === 'function' ? data(prev) : data;
        const metadata = (next.metadata ?? prev.metadata ?? {}) as any;
        if (metadata.untouched) {
          return {
            ...next,
            metadata: {
              ...metadata,
              untouched: false,
            },
          };
        }
        return next;
      });
    },
    [_setNodeData],
  );

  const updateToolsetIdForAllNodes = useCallback(
    (toolsetKey: string, newToolsetId: string) => {
      // Find all skillResponse nodes that have the matching toolset
      const nodesToUpdate = nodes.filter((node) => {
        if (node.type === 'skillResponse' && node.data?.metadata) {
          const metadata = node.data.metadata as ResponseNodeMeta;

          if (metadata.selectedToolsets && Array.isArray(metadata.selectedToolsets)) {
            const selectedToolsets = metadata.selectedToolsets as GenericToolset[];
            const hasMatchingToolset = selectedToolsets.some((toolset) => {
              const match = toolset.toolset?.key === toolsetKey;
              return match;
            });
            return hasMatchingToolset;
          }
        }
        return false;
      });

      // Directly update each node's data instead of using events
      for (const node of nodesToUpdate) {
        if (node.id) {
          setNodeData<ResponseNodeMeta>(node.id, (prevData) => {
            const prevMetadata =
              (prevData?.metadata as ResponseNodeMeta) ?? ({} as ResponseNodeMeta);
            const prevToolsets = Array.isArray(prevMetadata?.selectedToolsets)
              ? (prevMetadata?.selectedToolsets as GenericToolset[])
              : [];

            const nextToolsets = prevToolsets.map((toolset) => {
              // Update toolsetId if the toolset key matches
              if (toolset.toolset?.key === toolsetKey) {
                const updatedToolset = {
                  ...toolset,
                  id: newToolsetId,
                  toolset: toolset.toolset
                    ? {
                        ...toolset.toolset,
                        toolsetId: newToolsetId,
                      }
                    : toolset.toolset,
                };
                return updatedToolset;
              }
              return toolset;
            });

            return {
              metadata: {
                selectedToolsets: nextToolsets ?? [],
              },
            };
          });
        }
      }
    },
    [nodes, setNodeData],
  );

  return { updateToolsetIdForAllNodes };
};

export const useAgentNodeManagement = (nodeId: string) => {
  const { nodesLookup } = useRealtimeCanvasData();
  const node = nodesLookup.get(nodeId);
  const metadata = useMemo<ResponseNodeMeta>(() => {
    const nodeData = (node?.data as CanvasNodeData<ResponseNodeMeta>) ?? undefined;
    return nodeData?.metadata ?? ({} as ResponseNodeMeta);
  }, [node]);

  const { query, modelInfo, contextItems, selectedToolsets } = metadata;

  const { setNodeData: _setNodeData } = useNodeData();

  const setNodeData = useCallback(
    <T = any>(
      id: string,
      data: Partial<CanvasNodeData<T>> | ((prev: CanvasNodeData<T>) => Partial<CanvasNodeData<T>>),
    ) => {
      _setNodeData<T>(id, (prev) => {
        const next = typeof data === 'function' ? data(prev) : data;
        const metadata = (next.metadata ?? prev.metadata ?? {}) as any;
        if ((prev.metadata as ResponseNodeMeta)?.untouched) {
          return {
            ...next,
            metadata: {
              ...metadata,
              untouched: false,
            },
          };
        }
        return next;
      });
    },
    [_setNodeData],
  );

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
