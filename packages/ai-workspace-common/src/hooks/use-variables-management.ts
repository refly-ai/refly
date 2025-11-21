import { useState, useCallback, useEffect } from 'react';
import { useGetWorkflowVariables } from '@refly-packages/ai-workspace-common/queries';
import { useUserStoreShallow } from '@refly/stores';
import { useQueryClient } from '@tanstack/react-query';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { WorkflowVariable } from '@refly/openapi-schema';

export const useVariablesManagement = (canvasId: string) => {
  const isSharePage = location?.pathname?.startsWith('/share/') ?? false;
  const isLogin = useUserStoreShallow((state) => state.isLogin);
  const queryClient = useQueryClient();

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

  // Local state for optimistic updates
  const [localVariables, setLocalVariables] = useState<WorkflowVariable[]>(
    workflowVariables?.data ?? [],
  );

  // Sync local state with server data when it changes
  useEffect(() => {
    if (workflowVariables?.data) {
      setLocalVariables(workflowVariables.data);
    }
  }, [workflowVariables?.data]);

  const setVariables = useCallback(
    (variables: WorkflowVariable[]) => {
      // Update local state immediately for optimistic UI
      setLocalVariables(variables);

      // Asynchronously update server (fire-and-forget)
      getClient()
        .updateWorkflowVariables({
          body: {
            canvasId,
            variables,
          },
        })
        .then(() => {
          // Invalidate and refetch to ensure consistency
          queryClient.invalidateQueries({
            queryKey: ['GetWorkflowVariables', { query: { canvasId } }],
          });
        })
        .catch((error) => {
          console.error('Failed to update workflow variables:', error);
          // Revert local state on error
          setLocalVariables(workflowVariables?.data ?? []);
        });
    },
    [canvasId, queryClient, workflowVariables?.data],
  );

  return {
    data: localVariables,
    isLoading: isLoading && !localVariables,
    refetch,
    setVariables,
  };
};
