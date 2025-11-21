import { useCallback, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries';
import { useCanvasStoreShallow, useUserStoreShallow } from '@refly/stores';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { WorkflowVariable } from '@refly/openapi-schema';

export const useVariablesManagement = (canvasId: string) => {
  const isSharePage = location?.pathname?.startsWith('/share/') ?? false;
  const isLogin = useUserStoreShallow((state) => state.isLogin);

  const {
    data: workflowVariables,
    isLoading,
    refetch,
  } = useGetWorkflowVariables(
    {
      query: {
        canvasId,
      },
    },
    undefined,
    {
      enabled: !!canvasId && isLogin && !isSharePage,
    },
  );
  const remoteVariables = workflowVariables?.data;

  const { canvasVariables: localVariables, setCanvasVariables: setLocalVariables } =
    useCanvasStoreShallow((state) => ({
      canvasVariables: state.canvasVariables[canvasId],
      setCanvasVariables: state.setCanvasVariables,
    }));

  // Sync local state with server data when it changes
  useEffect(() => {
    if (remoteVariables && localVariables === undefined) {
      setLocalVariables(canvasId, remoteVariables);
    }
  }, [canvasId, remoteVariables, localVariables, setLocalVariables]);

  // Debounced function to update server
  const debouncedUpdateVariables = useDebouncedCallback(
    async (variables: WorkflowVariable[]) => {
      try {
        await getClient().updateWorkflowVariables({
          body: {
            canvasId,
            variables,
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
    (variables: WorkflowVariable[]) => {
      // Update local state immediately for optimistic UI
      setLocalVariables(canvasId, variables);

      // Asynchronously update server with debounce (fire-and-forget)
      debouncedUpdateVariables(variables);
    },
    [canvasId, remoteVariables, setLocalVariables, debouncedUpdateVariables],
  );

  return {
    data: localVariables ?? [],
    isLoading: isLoading && !localVariables === undefined,
    refetch,
    setVariables,
  };
};
