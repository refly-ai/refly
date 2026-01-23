import { useCallback, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries';
import { useCanvasStoreShallow, useUserStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { WorkflowVariable } from '@refly/openapi-schema';

interface SetVariablesOptions {
  archiveOldFiles?: boolean;
}

export const useVariablesManagement = (canvasId: string) => {
  const isSharePage = location?.pathname?.startsWith('/share/') ?? false;
  const isLogin = useUserStoreShallow((state) => state.isLogin);

  const {
    data: workflowVariables,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useGetWorkflowVariables(
    {
      query: {
        canvasId,
      },
    },
    undefined,
    {
      enabled: !!canvasId && isLogin && !isSharePage,
      // Refetch when window regains focus to sync external changes (e.g., CLI uploads)
      refetchOnWindowFocus: true,
    },
  );
  const remoteVariables = workflowVariables?.data;

  const { canvasVariables: localVariables, setCanvasVariables: setLocalVariables } =
    useCanvasStoreShallow((state) => ({
      canvasVariables: state.canvasVariables[canvasId],
      setCanvasVariables: state.setCanvasVariables,
    }));

  // Track the last remote data update time to detect server-side changes
  const lastRemoteUpdateRef = useRef<number | undefined>(undefined);

  // Sync local state with server data when:
  // 1. Local state is undefined (initial load)
  // 2. Remote data has been updated (dataUpdatedAt changed) - handles external changes like CLI uploads
  useEffect(() => {
    if (!remoteVariables) return;

    const isInitialLoad = localVariables === undefined;
    const isRemoteUpdate = dataUpdatedAt !== lastRemoteUpdateRef.current;

    if (isInitialLoad || isRemoteUpdate) {
      setLocalVariables(canvasId, remoteVariables);
      lastRemoteUpdateRef.current = dataUpdatedAt;
    }
  }, [canvasId, remoteVariables, localVariables, setLocalVariables, dataUpdatedAt]);

  // Debounced function to update server
  const debouncedUpdateVariables = useDebouncedCallback(
    async (variables: WorkflowVariable[], options?: SetVariablesOptions) => {
      try {
        await getClient().updateWorkflowVariables({
          body: {
            canvasId,
            variables,
            archiveOldFiles: options?.archiveOldFiles,
          },
        });
      } catch (error) {
        console.error('Failed to update workflow variables:', error);
        // Revert local state on error
        setLocalVariables(canvasId, remoteVariables);
      }
    },
    500, // 500ms debounce delay
  );

  const setVariables = useCallback(
    (variables: WorkflowVariable[], options?: SetVariablesOptions) => {
      // Update local state immediately for optimistic UI
      setLocalVariables(canvasId, variables);

      // Asynchronously update server with debounce (fire-and-forget)
      debouncedUpdateVariables(variables, options);
    },
    [canvasId, remoteVariables, setLocalVariables, debouncedUpdateVariables],
  );

  return {
    data: localVariables ?? [],
    isLoading: isLoading && localVariables === undefined,
    refetch,
    setVariables,
  };
};
